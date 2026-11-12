<?php

// Aumenta il tempo massimo di esecuzione dello script per prevenire timeout
set_time_limit(300);

require_once __DIR__ . '/admin_security.inc.php';

// Popola $_GET se lanciato da CLI o server.js con QUERY_STRING
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str(getenv('QUERY_STRING'), $_GET);
}
$isAjax = !empty($_GET['ajax']) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') || (php_sapi_name() === 'cli');

// Definisci le costanti
define('API_URL', "https://api.fantapazz.com/live.php");
define('VOTI_OUTPUT_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFP.js");
define('VOTI_META_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFPMeta.json");

// La funzione che segue e' ripetuta identica negli altri endpoint dei dati live
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

$isCli = (php_sapi_name() === 'cli');

// Modulo disattivato nelle variabili del sito: l'endpoint non scarica e non scrive nulla
if (!$isCli && !fcm_live_modulo_attivo('ModLiveFantapazz')) {
    if ($isAjax) {
        if (!headers_sent()) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(array('success' => false, 'error' => 'Modulo Live Fantapazz disattivato'));
        exit;
    }
    return;
}

// Limite condiviso tra tutti i visitatori: da Fantapazz si scarica al massimo una volta ogni 20
// secondi (il client aggiorna ogni 60); nel frattempo si risponde con i dati gia' salvati.
// Lo scavalcano solo la riga di comando e l'admin autenticato che chiede force.
$forzaAggiornamento = $isCli
    || (!empty($_GET['force']) && is_scalar($_GET['force']) && fcm_admin_session_active(true));
if (!$forzaAggiornamento && !fcm_cooldown_acquire('live_fp', 20)) {
    if ($isAjax) {
        $metaCache = file_exists(VOTI_OUTPUT_FILE) ? @json_decode((string)@file_get_contents(VOTI_META_FILE), true) : null;
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
        }
        if (is_array($metaCache) && isset($metaCache['timestamp'])) {
            $cachedCount = isset($metaCache['count']) ? (int)$metaCache['count'] : 0;
            echo json_encode(array(
                'success' => true,
                // dati gia' salvati, non scaricati ora: il client lo dice. Chi ha chiesto force ed e'
                // arrivato qui non e' admin e non deve piu' vedere "Forza Aggiornamento"; per gli altri non
                // si apre la sessione solo per saperlo (null = non noto)
                'cached' => true,
                'canForce' => empty($_GET['force']) ? null : false,
                'count' => $cachedCount,
                'source' => 'fantapazz',
                'giornataFP' => isset($metaCache['giornataFP']) ? (int)$metaCache['giornataFP'] : 0,
                'hasMatchLive' => !empty($metaCache['hasMatchLive']),
                'error' => null,
                'timestamp' => (int)$metaCache['timestamp'],
                'updated' => date('H:i:s', (int)$metaCache['timestamp']),
                'message' => 'Voti Fantapazz.com caricati dalla cache locale (' . $cachedCount . ' giocatori)'
            ));
        } else {
            echo json_encode(array(
                'success' => false,
                'count' => 0,
                'source' => 'fantapazz',
                'giornataFP' => 0,
                'hasMatchLive' => false,
                'error' => "Voti Fantapazz.com non ancora disponibili: riprova tra qualche secondo",
                'timestamp' => time(),
                'updated' => date('H:i:s')
            ));
        }
        exit;
    }
    return;
}

// Caricamento associazioni per mapping automatico verso nome canonico FCM
$fpToFcmMap = array();
$baseDir = dirname(__DIR__);
$assocFile = __DIR__ . '/data/liveVU_associazioni.php';
if (!file_exists($assocFile)) {
    $assocFile = $baseDir . '/inc/data/liveVU_associazioni.php';
}
if (file_exists($assocFile)) {
    include_once($assocFile);
    if (isset($arrAssociazioni) && is_array($arrAssociazioni)) {
        foreach ($arrAssociazioni as $assoc) {
            $nomeFCM = !empty($assoc[5]) ? trim($assoc[5]) : '';
            if ($nomeFCM === '') continue;

            $nomeFP = '';
            if (count($assoc) >= 11) {
                $nomeFP = !empty($assoc[8]) ? trim($assoc[8]) : '';
            } elseif (count($assoc) >= 10) {
                $nomeFP = !empty($assoc[7]) ? trim($assoc[7]) : '';
            }

            if (!empty($nomeFP)) {
                $fpToFcmMap[$nomeFP] = $nomeFCM;
                $fpToFcmMap[mb_strtoupper($nomeFP, 'UTF-8')] = $nomeFCM;
            }
            if (!empty($assoc[3])) {
                $fpToFcmMap[trim($assoc[3])] = $nomeFCM;
                $fpToFcmMap[mb_strtoupper(trim($assoc[3]), 'UTF-8')] = $nomeFCM;
            }
            if (!empty($assoc[1])) {
                $fpToFcmMap[trim($assoc[1])] = $nomeFCM;
                $fpToFcmMap[mb_strtoupper(trim($assoc[1]), 'UTF-8')] = $nomeFCM;
            }
            $fpToFcmMap[$nomeFCM] = $nomeFCM;
            $fpToFcmMap[mb_strtoupper($nomeFCM, 'UTF-8')] = $nomeFCM;
        }
    }
}

// Funzioni helper
// Voto, minuto e codici bonus arrivano dal feed esterno e finiscono nella pagina live:
// si accettano solo valori numerici.
function returnvoto($voto) {
    if (is_int($voto) || is_float($voto)) {
        return $voto;
    }
    if (is_string($voto)) {
        // Il separatore decimale puo' essere la virgola ("6,5"), come accetta anche il client
        $voto = str_replace(',', '.', trim($voto));
        if (is_numeric($voto)) {
            return $voto;
        }
    }
    return "SV";
}

function checkmin($min) {
    return ($min !== null && $min !== "" && is_scalar($min)) ? 1 : 0;
}

function returnmin($min) {
    if (is_scalar($min) && preg_match('/^\s*([0-9]{1,3})/', (string)$min, $cifre)) {
        return (string)(int)$cifre[1];
    }
    return "0";
}

function getParametri($bonus) {
    $eventi = array(
        15 => "golvittoria", 16 => "golpareggio", 1 => "golfatto",
        2 => "golsubito", 3 => "rigoresegnato", 4 => "rigoresbagliato",
        5 => "rigoreparato", 6 => "ammonito", 7 => "espulso",
        8 => "autogol", 9 => "assist"
    );

    $counts = array_fill_keys(array_values($eventi), 0);
    if ($bonus && is_array($bonus)) {
        foreach (array_slice($bonus, 0, 50) as $codice) {
            if (is_string($codice) && preg_match('/^[1-9][0-9]?\z/', $codice)) {
                $codice = (int)$codice;
            }
            if (is_int($codice) && isset($eventi[$codice])) {
                $counts[$eventi[$codice]]++;
            }
        }
    }

    return array(
        (string)$counts["golfatto"], (string)$counts["golsubito"], (string)$counts["autogol"],
        (string)$counts["ammonito"], (string)$counts["espulso"], (string)$counts["rigoresegnato"],
        (string)$counts["rigoreparato"], (string)$counts["rigoresbagliato"], (string)$counts["assist"],
        (string)$counts["golvittoria"], (string)$counts["golpareggio"]
    );
}

// --------------------------------------------------------------------------------

// 1. Estrazione dati
$json = false;
$httpCode = 0;
$curlError = "";

if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, API_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
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
            "user_agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ModernFCM/3.0"
        )
    ));
    $json = @file_get_contents(API_URL, false, $context);
}

$success = false;
$votiCount = 0;
$errorMsg = "";

if ($json !== false && !empty($json)) {
    $data = json_decode($json, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {

        // 2. Mappatura dinamica delle squadre e delle partite (stato terminata, in corso, non iniziata)
        $mappaturaInversaSquadre = array();
        $partiteStato = array();
        $hasMatchLive = false;
        $now = time();

        if (isset($data["data"]["calendario"]["partite"])) {
            foreach ($data["data"]["calendario"]["partite"] as $partita) {
                $mappaturaInversaSquadre[intval($partita["ID_ClubH"])] = $partita["nomeClubH"];
                $mappaturaInversaSquadre[intval($partita["ID_ClubA"])] = $partita["nomeClubA"];

                $isFin = isset($partita["isFinale"]) ? intval($partita["isFinale"]) : 0;
                $status = isset($partita["status"]) ? strtoupper(trim($partita["status"])) : "";
                $kickoff = !empty($partita["timestamp"]) ? intval($partita["timestamp"]) : 0;
                $hasScore = (isset($partita["golH"]) && $partita["golH"] !== null && isset($partita["golA"]) && $partita["golA"] !== null);

                $finaleVal = "";
                if ($isFin === 1 || $status === "FP") {
                    $finaleVal = "1";
                } elseif ($status !== "" && $status !== "RINV" && $status !== "POST" && $status !== "ND") {
                    $finaleVal = "0";
                    $hasMatchLive = true;
                } elseif ($kickoff > 0) {
                    if ($now < $kickoff) {
                        $finaleVal = "";
                    } elseif ($hasScore && $now >= ($kickoff + (100 * 60))) {
                        $finaleVal = "1";
                    } elseif ($now >= ($kickoff + (115 * 60))) {
                        $finaleVal = "1";
                    } else {
                        $finaleVal = "0";
                        $hasMatchLive = true;
                    }
                } elseif ($hasScore) {
                    $finaleVal = "1";
                }

                $clubH = $partita["nomeClubH"];
                $clubA = $partita["nomeClubA"];

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
            }
        }

        // 3. Elaborazione dei giocatori e dei voti
        $votiGiocatori = array();
        $n = 0; // Contatore per l'array finale

        $resolveFpPlayerName = function($rawName) use ($fpToFcmMap) {
            $trimmed = trim($rawName);
            if (isset($fpToFcmMap[$trimmed])) return $fpToFcmMap[$trimmed];
            $upper = mb_strtoupper($trimmed, 'UTF-8');
            if (isset($fpToFcmMap[$upper])) return $fpToFcmMap[$upper];
            return $trimmed;
        };

        if (isset($data["data"]["clubs"])) {
            foreach ($data["data"]["clubs"] as $clubId => $clubData) {
                $nomeSquadra = isset($mappaturaInversaSquadre[$clubId]) ? $mappaturaInversaSquadre[$clubId] : null;

                if ($nomeSquadra && isset($clubData["formazione"]["titolari"][0]["calciatore"]) && $clubData["formazione"]["titolari"][0]["calciatore"] !== "Non ufficializzata") {
                    
                    // Elaborazione dei titolari
                    if (!empty($clubData["formazione"]["titolari"]) && is_array($clubData["formazione"]["titolari"])) {
                        foreach ($clubData["formazione"]["titolari"] as $giocatore) {
                            if (isset($giocatore['calciatore'])) {
                                $voto = isset($giocatore['voto']) ? $giocatore['voto'] : null;
                                $bonus = isset($giocatore['bonus']) ? $giocatore['bonus'] : null;
                                $min = isset($giocatore['min']) ? $giocatore['min'] : null;

                                $votiGiocatori[$n] = array_merge(
                                    array($resolveFpPlayerName($giocatore["calciatore"]), (string)returnvoto($voto), "SV"),
                                    getParametri($bonus),
                                    array($nomeSquadra, "1", (string)checkmin($min), (string)returnmin($min), isset($partiteStato[$nomeSquadra]) ? (string)$partiteStato[$nomeSquadra] : "")
                                );
                                $n++;
                            }
                        }
                    }

                    // Elaborazione dei panchinari
                    if (!empty($clubData["formazione"]["panchinari"]) && is_array($clubData["formazione"]["panchinari"])) {
                        foreach ($clubData["formazione"]["panchinari"] as $giocatore) {
                            if (isset($giocatore['calciatore'])) {
                                $voto = isset($giocatore['voto']) ? $giocatore['voto'] : null;
                                $bonus = isset($giocatore['bonus']) ? $giocatore['bonus'] : null;
                                $min = isset($giocatore['min']) ? $giocatore['min'] : null;

                                $votiGiocatori[$n] = array_merge(
                                    array($resolveFpPlayerName($giocatore["calciatore"]), (string)returnvoto($voto), "SV"),
                                    getParametri($bonus),
                                    array($nomeSquadra, "0", (string)checkmin($min), (string)returnmin($min), isset($partiteStato[$nomeSquadra]) ? (string)$partiteStato[$nomeSquadra] : "")
                                );
                                $n++;
                            }
                        }
                    }
                }
            }
        }

        // 4. Scrittura del file di output con serializzazione sicura e scrittura atomica
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

        // 5. Rilevamento giornata attiva Fantapazz e stato partite in corso
        $giornataFP = 0;
        if (!empty($data["data"]["calendario"]["nGiornata"])) {
            $giornataFP = intval($data["data"]["calendario"]["nGiornata"]);
        } elseif (!empty($data["data"]["calendario"]["partite"][0]["nGiornata"])) {
            $giornataFP = intval($data["data"]["calendario"]["partite"][0]["nGiornata"]);
        }

        $hasMatchLive = false;
        if (!empty($data["data"]["calendario"]["partite"])) {
            foreach ($data["data"]["calendario"]["partite"] as $partita) {
                $isFin = isset($partita["isFinale"]) ? intval($partita["isFinale"]) : 1;
                $status = isset($partita["status"]) ? strtoupper(trim($partita["status"])) : "";
                if ($isFin === 0 && $status !== "FP" && $status !== "RINV" && $status !== "POST" && $status !== "ND") {
                    $hasMatchLive = true;
                    break;
                }
            }
        }

        $metaFP = array(
            'source' => 'fantapazz',
            'giornataFP' => $giornataFP,
            'hasMatchLive' => $hasMatchLive,
            'count' => $votiCount,
            'timestamp' => time(),
            'lastUpdated' => date('d/m/Y H:i:s'),
            'updated' => date('H:i:s')
        );
        $tmpMeta = VOTI_META_FILE . '.' . uniqid('tmp', true);
        $metaJson = json_encode($metaFP, JSON_PRETTY_PRINT);
        if (@file_put_contents($tmpMeta, $metaJson, LOCK_EX) !== false) {
            @rename($tmpMeta, VOTI_META_FILE);
        } else {
            @file_put_contents(VOTI_META_FILE, $metaJson, LOCK_EX);
        }
    } else {
        $errorMsg = "Risposta non valida o formato non conforme da Fantapazz.com";
    }
} else {
    $errorMsg = "Impossibile collegarsi all'API di Fantapazz.com" . ($curlError ? ": $curlError" : "");
}

// Se invocato via AJAX/Fetch, invia risposta JSON strutturata
if ($isAjax) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
    }
    echo json_encode(array(
        'success' => $success,
        'count' => $votiCount,
        'source' => 'fantapazz',
        'giornataFP' => isset($giornataFP) ? $giornataFP : 0,
        'hasMatchLive' => isset($hasMatchLive) ? $hasMatchLive : false,
        'error' => $success ? null : $errorMsg,
        'timestamp' => time(),
        'updated' => date('H:i:s')
    ));
    exit;
}
?>