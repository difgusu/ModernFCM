<?php
/**
 * ModernFCM - Estrattore Voti Live FantaMaster
 * Estrae voti live, formazioni ed eventi in tempo reale dall'API pubblica di FantaMaster
 * e genera js/fcmVotiDatiFM.js conforme al costruttore VotoGiocatore di Fantacalcio Manager.
 */

// Aumenta il tempo massimo di esecuzione dello script per prevenire timeout
set_time_limit(300);

require_once __DIR__ . '/admin_security.inc.php';

// Orari delle giornate di Serie A (js/DataA.js): servono a riconoscere una giornata già iniziata
if (file_exists(__DIR__ . '/aggiorna_dataA.php')) {
    if (!defined('FCM_AGGIORNA_DATAA_HELPERS_ONLY')) {
        define('FCM_AGGIORNA_DATAA_HELPERS_ONLY', true);
    }
    require_once __DIR__ . '/aggiorna_dataA.php';
}

// Popola $_GET se lanciato da CLI o server con QUERY_STRING
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str(getenv('QUERY_STRING'), $_GET);
}
if (empty($_GET) && !empty($argv)) {
    foreach ($argv as $arg) {
        if (strpos($arg, '=') !== false) {
            parse_str($arg, $cliParams);
            $_GET = array_merge($_GET, $cliParams);
        }
    }
}
$isAjax = !empty($_GET['ajax']) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') || (php_sapi_name() === 'cli');

define('FM_BASE_URL', "https://publicapi.fantamaster.it/livescores/");
define('VOTI_OUTPUT_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFM.js");
define('VOTI_META_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFMMeta.json");

// Le funzioni fcm_live_* che seguono sono ripetute identiche negli altri endpoint dei dati live
// (inc/live_extract*.php, inc/probform_extract.php): ogni modifica va riportata in tutte le copie.
if (!function_exists('fcm_live_modulo_attivo')) {
    /**
     * TRUE se il modulo risulta attivo in js/fcmVariabili.js. Stessa regola del menu del sito e
     * del client: attivo se la variabile manca oppure vale Si, 1 o true.
     */
    function fcm_live_modulo_attivo($nomeVariabile) {
        $raw = @file_get_contents(dirname(__DIR__) . '/js/fcmVariabili.js');
        if (!is_string($raw) || !preg_match_all('/^[ \t]*var\s+' . preg_quote($nomeVariabile, '/') . '\s*=\s*["\']?([^"\'\r\n;]*)/m', $raw, $m)) {
            return true;
        }
        return in_array(strtolower(trim(end($m[1]))), array('si', '1', 'true'), true);
    }
}

if (!function_exists('fcm_live_giornata_richiesta')) {
    /**
     * Giornata di Serie A chiesta dal client: vale solo se e' un intero tra 1 e 38 in forma
     * canonica (niente zeri iniziali, decimali o array). NULL se manca o non e' valida.
     */
    function fcm_live_giornata_richiesta(array $nomiParametro) {
        foreach ($nomiParametro as $nome) {
            if (!empty($_GET[$nome])) {
                $g = filter_var($_GET[$nome], FILTER_VALIDATE_INT, array('options' => array('min_range' => 1, 'max_range' => 38)));
                return ($g === false) ? null : $g;
            }
        }
        return null;
    }
}

if (!function_exists('fcm_live_giornata_corrente')) {
    /**
     * Giornata di Serie A corrente per la lega: la prima che nel calendario FCM ha ancora incontri
     * da calcolare, cioe' quella che il sito mostra in home e nel live. NULL se il calendario
     * manca, non e' leggibile o non ha piu' incontri da calcolare.
     */
    function fcm_live_giornata_corrente() {
        $raw = @file_get_contents(dirname(__DIR__) . '/js/fcmCalendarioDati.js');
        // new I(ID, IncAcc, IDTipo, Giocato, IDFantagiornata, Fantagiornata, IDCompetizione,
        //       Competizione, IDGirone, Girone, GiornataDiA, ...): i tre nomi possono contenere virgole
        $nome = '(?:"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'|[^,()]*)';
        $re = '/new\s+I\(\s*[^,()]*,[^,()]*,\s*(\d+)\s*,\s*(\d+)\s*,[^,()]*,\s*' . $nome . '\s*,[^,()]*,\s*' . $nome
            . '\s*,[^,()]*,\s*' . $nome . '\s*,\s*(\d+)\s*[,)]/';
        $corrente = null;
        if (is_string($raw) && preg_match_all($re, $raw, $incontri, PREG_SET_ORDER)) {
            foreach ($incontri as $inc) {
                // tipo 2 = turno di riposo; giocato 1 = incontro gia' calcolato
                if ((int)$inc[1] !== 2 && (int)$inc[2] !== 1 && ($corrente === null || (int)$inc[3] < $corrente)) {
                    $corrente = (int)$inc[3];
                }
            }
        }
        return ($corrente !== null && $corrente >= 1 && $corrente <= 38) ? $corrente : null;
    }
}

$isCli = (php_sapi_name() === 'cli');

// Modulo disattivato nelle variabili del sito: l'endpoint non scarica e non scrive nulla
if (!$isCli && !fcm_live_modulo_attivo('ModLiveFantaMaster')) {
    if ($isAjax) {
        if (!headers_sent()) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(array('success' => false, 'error' => 'Modulo Live FantaMaster disattivato'));
        exit;
    }
    return;
}

// Admin riconosciuto dalla sessione già aperta: per i visitatori anonimi non se ne crea una nuova
$isAdmin = !$isCli && fcm_admin_session_active(true);

// I visitatori possono far scaricare solo la giornata corrente della lega o, vedi sotto, una
// successiva appena iniziata: sono le sole che possono finire nel file condiviso letto da tutti.
// Senza giornata (o con una giornata non valida) vale quella corrente.
$gio = fcm_live_giornata_richiesta(array('Gio', 'cGio', 'day'));
$giornataLega = fcm_live_giornata_corrente();
if ($gio === null && !$isCli) {
    $gio = $giornataLega;
}
$altraGiornata = false;
if (!$isCli && !$isAdmin) {
    if ($giornataLega === null) {
        // Giornata della lega non determinabile (calendario assente o tutto già calcolato): a FantaMaster
        // non si chiede quella scelta dal visitatore, vale la sua giornata in corso
        $gio = null;
    } elseif ($gio !== $giornataLega) {
        // Vale anche una giornata successiva iniziata di recente secondo js/DataA.js: capita quando
        // la lega non ha ancora calcolato una giornata e in Serie A si gioca già la seguente
        $altraGiornata = !($gio > $giornataLega && function_exists('fcm_dataA_giornate_recenti')
            && in_array($gio, fcm_dataA_giornate_recenti(dirname(__DIR__)), true));
    }
}

// Limite condiviso tra tutti i visitatori: da FantaMaster si scarica al massimo una volta ogni 20
// secondi (il client aggiorna ogni 60); nel frattempo si risponde con i dati già salvati.
// Lo scavalcano solo la riga di comando e l'admin autenticato che chiede force.
$forzaAggiornamento = $isCli || ($isAdmin && !empty($_GET['force']) && is_scalar($_GET['force']));
// La giornata successiva già in campo ha un turno suo: non toglie l'aggiornamento a quella della lega
$chiaveCooldown = ($giornataLega !== null && $gio !== null && $gio !== $giornataLega) ? 'live_fm_succ' : 'live_fm';
if ($altraGiornata || (!$forzaAggiornamento && !fcm_cooldown_acquire($chiaveCooldown, 20))) {
    if ($isAjax) {
        $metaCache = file_exists(VOTI_OUTPUT_FILE) ? @json_decode((string)@file_get_contents(VOTI_META_FILE), true) : null;
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
        }
        if (is_array($metaCache) && isset($metaCache['timestamp'])) {
            $cachedCount = isset($metaCache['count']) ? (int)$metaCache['count'] : 0;
            // giornataFM è quella dei dati salvati: se non è quella chiesta il client li ignora
            echo json_encode(array(
                'success' => true,
                // dati già salvati, non scaricati ora: il client lo dice e propone "Forza Aggiornamento"
                // solo a chi può davvero forzare
                'cached' => true,
                'canForce' => $isAdmin,
                'count' => $cachedCount,
                'source' => 'fantamaster',
                'giornataFM' => isset($metaCache['giornataFM']) ? (int)$metaCache['giornataFM'] : 0,
                'hasMatchLive' => !empty($metaCache['hasMatchLive']),
                'error' => null,
                'timestamp' => (int)$metaCache['timestamp'],
                'updated' => date('H:i:s', (int)$metaCache['timestamp']),
                'message' => 'Voti FantaMaster caricati dalla cache locale (' . $cachedCount . ' giocatori)'
            ));
        } else {
            echo json_encode(array(
                'success' => false,
                'count' => 0,
                'source' => 'fantamaster',
                'giornataFM' => 0,
                'hasMatchLive' => false,
                // rifiuto per la giornata, non un errore della fonte: il client lo presenta come avviso
                'altraGiornata' => $altraGiornata,
                'error' => $altraGiornata
                    ? "Voti FantaMaster disponibili solo per la giornata in corso"
                    : "Voti FantaMaster non ancora disponibili: riprova tra qualche secondo",
                'timestamp' => time(),
                'updated' => date('H:i:s')
            ));
        }
        exit;
    }
    return;
}

// Caricamento associazioni giocatori unificate
$baseDir = dirname(__DIR__);
if (file_exists(__DIR__ . "/data/liveVU_associazioni.php")) {
    include_once(__DIR__ . "/data/liveVU_associazioni.php");
} elseif (file_exists($baseDir . "/inc/data/liveVU_associazioni.php")) {
    include_once($baseDir . "/inc/data/liveVU_associazioni.php");
}

$fmToFcmMap = array();
if (isset($arrAssociazioni) && is_array($arrAssociazioni)) {
    foreach ($arrAssociazioni as $assoc) {
        $nomeFCM = !empty($assoc[5]) ? trim($assoc[5]) : "";
        if ($nomeFCM === "") continue;

        $nomeFM = '';
        if (count($assoc) >= 11) {
            $nomeFM = !empty($assoc[10]) ? trim($assoc[10]) : '';
        } elseif (count($assoc) >= 10) {
            $nomeFM = !empty($assoc[9]) ? trim($assoc[9]) : '';
        }

        if (!empty($nomeFM)) {
            $fmToFcmMap[$nomeFM] = $nomeFCM;
            $fmToFcmMap[mb_strtoupper($nomeFM, 'UTF-8')] = $nomeFCM;
        }
        if (!empty($assoc[3])) {
            $fmToFcmMap[trim($assoc[3])] = $nomeFCM;
            $fmToFcmMap[mb_strtoupper(trim($assoc[3]), 'UTF-8')] = $nomeFCM;
        }
        if (!empty($assoc[1])) {
            $fmToFcmMap[trim($assoc[1])] = $nomeFCM;
            $fmToFcmMap[mb_strtoupper(trim($assoc[1]), 'UTF-8')] = $nomeFCM;
        }
        $fmToFcmMap[$nomeFCM] = $nomeFCM;
        $fmToFcmMap[mb_strtoupper($nomeFCM, 'UTF-8')] = $nomeFCM;
    }
}

// Helper per voti
function fm_returnvoto($voto) {
    if ($voto === null || $voto === "" || $voto === "0" || $voto === 0) {
        return "SV";
    }
    // Il voto arriva dal feed esterno e finisce nella pagina live: si accetta solo un numero
    if (is_int($voto) || is_float($voto)) {
        return (string)$voto;
    }
    if (is_string($voto)) {
        // Il separatore decimale può essere la virgola ("6,5"), come accetta anche il client
        $voto = str_replace(',', '.', trim($voto));
        if (is_numeric($voto)) {
            return $voto;
        }
    }
    return "SV";
}

// 1. Costruzione URL con timestamp e giornata opzionale
$tcache = round(microtime(true) * 1000);

$apiUrl = FM_BASE_URL . "?tcache=" . $tcache;
if ($gio !== null) {
    $apiUrl .= "&day=" . $gio;
}

// 2. Estrazione dati via cURL o stream
$json = false;
$httpCode = 0;
$curlError = "";

if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_ENCODING, ''); // Supporto decompressione automatica gzip / deflate
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    fcm_apply_curl_ssl($ch);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ModernFCM/3.0');
    $json = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    if (PHP_VERSION_ID < 80500) {
        curl_close($ch);
    }
}

if ($json === false || empty($json)) {
    $context = stream_context_create(array(
        "ssl" => array(
            "verify_peer" => true,
            "verify_peer_name" => true
        ),
        "http" => array(
            "timeout" => 10,
            "header" => "Accept-Encoding: gzip, deflate\r\n",
            "user_agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ModernFCM/3.0"
        )
    ));
    $json = @file_get_contents($apiUrl, false, $context);
}

// Se la risposta è compressa (header gzip), decomprimi
if ($json !== false && !empty($json)) {
    if (substr($json, 0, 2) === "\x1f\x8b" && function_exists('gzdecode')) {
        $decompressed = @gzdecode($json);
        if ($decompressed !== false) {
            $json = $decompressed;
        }
    }
}

$success = false;
$votiCount = 0;
$errorMsg = "";
$hasMatchLive = false;
$giornataFM = 0;

if ($json !== false && !empty($json)) {
    $data = json_decode($json, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
        if (!empty($data['day'])) {
            $giornataFM = intval($data['day']);
        }

        $marks = !empty($data['marks']) && is_array($data['marks']) ? $data['marks'] : array();
        $scores = !empty($data['scores']) && is_array($data['scores']) ? $data['scores'] : array();

        $partiteStato = array();
        $votiGiocatori = array();
        $n = 0;

        foreach ($scores as $match) {
            $clubH = !empty($match['home_name']) ? trim($match['home_name']) : '';
            $clubA = !empty($match['away_name']) ? trim($match['away_name']) : '';
            if (empty($clubH) || empty($clubA)) continue;

            // Determina lo stato della partita
            $rawTime = isset($match['time']) ? trim((string)$match['time']) : '';
            $voting = isset($match['voting']) ? strtoupper(trim((string)$match['voting'])) : '';

            $finaleVal = "";
            if (strtoupper($rawTime) === 'FT' || $voting === 'F') {
                $finaleVal = "1";
            } elseif (strpos($rawTime, "'") !== false || strtoupper($rawTime) === 'HT') {
                $finaleVal = "0";
                $hasMatchLive = true;
            } else {
                // Non iniziata (es. orario futuro '18:00', '20:45')
                $finaleVal = "";
            }

            $partiteStato[$clubH] = $finaleVal;
            $partiteStato[strtoupper($clubH)] = $finaleVal;
            $partiteStato[$clubA] = $finaleVal;
            $partiteStato[strtoupper($clubA)] = $finaleVal;

            if (strtolower($clubH) === "verona") {
                $partiteStato["Hellas Verona"] = $finaleVal;
                $partiteStato["HELLAS VERONA"] = $finaleVal;
            }
            if (strtolower($clubA) === "verona") {
                $partiteStato["Hellas Verona"] = $finaleVal;
                $partiteStato["HELLAS VERONA"] = $finaleVal;
            }

            // Aggrega eventi per giocatore
            $eventsByPlayer = array();
            $getOrInitEvent = function($pName) use (&$eventsByPlayer) {
                if (!isset($eventsByPlayer[$pName])) {
                    $eventsByPlayer[$pName] = array(
                        'golfatto' => 0,
                        'golsubito' => 0,
                        'autogol' => 0,
                        'ammonito' => 0,
                        'espulso' => 0,
                        'rigoresegnato' => 0,
                        'rigoreparato' => 0,
                        'rigoresbagliato' => 0,
                        'assist' => 0,
                        'sostituzione' => 0,
                        'minuto' => 0
                    );
                }
            };

            if (!empty($match['events']) && is_array($match['events'])) {
                foreach ($match['events'] as $ev) {
                    $type = isset($ev['type']) ? strtoupper(trim($ev['type'])) : '';
                    $pName = isset($ev['player']) ? trim($ev['player']) : '';
                    $min = isset($ev['minute']) ? intval($ev['minute']) : 0;

                    if ($pName !== '') {
                        $getOrInitEvent($pName);
                    }

                    switch ($type) {
                        case 'G':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['golfatto']++;
                            }
                            // Assist Classic
                            if (!empty($ev['assistman'])) {
                                $assister = trim($ev['assistman']);
                                $isClassic = isset($ev['assist_classic']) && strtolower(trim($ev['assist_classic'])) === 'yes';
                                if ($isClassic) {
                                    $getOrInitEvent($assister);
                                    $eventsByPlayer[$assister]['assist']++;
                                }
                            }
                            break;
                        case 'PEN':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['rigoresegnato']++;
                            }
                            break;
                        case 'GG':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['golsubito']++;
                            }
                            break;
                        case 'YC':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['ammonito'] = 1;
                            }
                            break;
                        case 'RC':
                        case 'RYC':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['espulso'] = 1;
                            }
                            break;
                        case 'OG':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['autogol']++;
                            }
                            break;
                        case 'SP':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['rigoreparato']++;
                            }
                            break;
                        case 'MP':
                            if ($pName !== '') {
                                $eventsByPlayer[$pName]['rigoresbagliato']++;
                            }
                            break;
                        case 'S':
                            if (!empty($ev['in'])) {
                                $inName = trim($ev['in']);
                                $getOrInitEvent($inName);
                                $eventsByPlayer[$inName]['sostituzione'] = 1;
                                $eventsByPlayer[$inName]['minuto'] = $min;
                            }
                            if (!empty($ev['out'])) {
                                $outName = trim($ev['out']);
                                $getOrInitEvent($outName);
                                $eventsByPlayer[$outName]['sostituzione'] = 1;
                                $eventsByPlayer[$outName]['minuto'] = $min;
                            }
                            break;
                    }
                }
            }

            // Funzione interna per registrare un giocatore
            $processPlayer = function($pName, $squadra, $titolare) use (&$votiGiocatori, &$n, $marks, &$eventsByPlayer, $finaleVal, $fmToFcmMap) {
                if (empty($pName)) return;
                $pTrim = trim($pName);
                $pUpper = mb_strtoupper($pTrim, 'UTF-8');
                $pResolved = isset($fmToFcmMap[$pTrim]) ? $fmToFcmMap[$pTrim] : (isset($fmToFcmMap[$pUpper]) ? $fmToFcmMap[$pUpper] : $pTrim);

                $voto = isset($marks[$pName]) ? $marks[$pName] : (isset($marks[$pTrim]) ? $marks[$pTrim] : null);
                $ev = isset($eventsByPlayer[$pName]) ? $eventsByPlayer[$pName] : (isset($eventsByPlayer[$pTrim]) ? $eventsByPlayer[$pTrim] : array(
                    'golfatto' => 0, 'golsubito' => 0, 'autogol' => 0,
                    'ammonito' => 0, 'espulso' => 0, 'rigoresegnato' => 0,
                    'rigoreparato' => 0, 'rigoresbagliato' => 0, 'assist' => 0,
                    'sostituzione' => 0, 'minuto' => 0
                ));

                $votiGiocatori[$n] = array(
                    $pResolved,
                    fm_returnvoto($voto),
                    "SV",
                    (string)$ev['golfatto'],
                    (string)$ev['golsubito'],
                    (string)$ev['autogol'],
                    (string)$ev['ammonito'],
                    (string)$ev['espulso'],
                    (string)$ev['rigoresegnato'],
                    (string)$ev['rigoreparato'],
                    (string)$ev['rigoresbagliato'],
                    (string)$ev['assist'],
                    "0", // golvittoria
                    "0", // golpareggio
                    $squadra,
                    $titolare ? "1" : "0",
                    (string)$ev['sostituzione'],
                    (string)$ev['minuto'],
                    (string)$finaleVal
                );
                $n++;
            };

            // Elaborazione titolari e panchinari squadra casa
            $homeProcessed = array();
            if (!empty($match['home_lineups']) && is_array($match['home_lineups'])) {
                foreach ($match['home_lineups'] as $p) {
                    $processPlayer($p, $clubH, 1);
                    $homeProcessed[$p] = true;
                }
            }
            if (!empty($match['home_bench']) && is_array($match['home_bench'])) {
                foreach ($match['home_bench'] as $p) {
                    if (!isset($homeProcessed[$p])) {
                        $processPlayer($p, $clubH, 0);
                        $homeProcessed[$p] = true;
                    }
                }
            }

            // Elaborazione titolari e panchinari squadra trasferta
            $awayProcessed = array();
            if (!empty($match['away_lineups']) && is_array($match['away_lineups'])) {
                foreach ($match['away_lineups'] as $p) {
                    $processPlayer($p, $clubA, 1);
                    $awayProcessed[$p] = true;
                }
            }
            if (!empty($match['away_bench']) && is_array($match['away_bench'])) {
                foreach ($match['away_bench'] as $p) {
                    if (!isset($awayProcessed[$p])) {
                        $processPlayer($p, $clubA, 0);
                        $awayProcessed[$p] = true;
                    }
                }
            }
        }

        // 4. Scrittura atomica del file js/fcmVotiDatiFM.js
        $output = "arrPartite = " . json_encode($partiteStato, JSON_UNESCAPED_UNICODE) . ";\r\n";
        $output .= "arrStatoPartite = arrPartite;\r\n";
        $output .= "arrVoti = new Array();\r\n";
        foreach ($votiGiocatori as $index => $campi) {
            $campiJson = array_map(function($c) { return json_encode((string)$c, JSON_UNESCAPED_UNICODE); }, $campi);
            $output .= "arrVoti[".$index."] = new VotoGiocatore(".implode(",", $campiJson).");\r\n";
        }

        $tmpOut = VOTI_OUTPUT_FILE . '.' . uniqid('tmp', true);
        if (file_put_contents($tmpOut, $output, LOCK_EX) !== false) {
            @rename($tmpOut, VOTI_OUTPUT_FILE);
            $success = true;
        } else {
            $success = (file_put_contents(VOTI_OUTPUT_FILE, $output, LOCK_EX) !== false);
        }
        $votiCount = count($votiGiocatori);

        // 5. Scrittura metadati
        $metaFM = array(
            'source' => 'fantamaster',
            'giornataFM' => $giornataFM,
            'hasMatchLive' => $hasMatchLive,
            'count' => $votiCount,
            'timestamp' => time(),
            'lastUpdated' => date('d/m/Y H:i:s'),
            'updated' => date('H:i:s')
        );
        $tmpMeta = VOTI_META_FILE . '.' . uniqid('tmp', true);
        $metaJson = json_encode($metaFM, JSON_PRETTY_PRINT);
        if (@file_put_contents($tmpMeta, $metaJson, LOCK_EX) !== false) {
            @rename($tmpMeta, VOTI_META_FILE);
        } else {
            @file_put_contents(VOTI_META_FILE, $metaJson, LOCK_EX);
        }
    } else {
        $errorMsg = "Risposta non valida o formato JSON non conforme da FantaMaster";
    }
} else {
    $errorMsg = "Impossibile collegarsi all'API di FantaMaster" . ($curlError ? ": $curlError" : "");
}

// Risposta JSON per chiamate AJAX
if ($isAjax) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
    }
    echo json_encode(array(
        'success' => $success,
        'count' => $votiCount,
        'source' => 'fantamaster',
        'giornataFM' => $giornataFM,
        'hasMatchLive' => $hasMatchLive,
        'error' => $success ? null : $errorMsg,
        'timestamp' => time(),
        'updated' => date('H:i:s')
    ));
    exit;
}
?>
