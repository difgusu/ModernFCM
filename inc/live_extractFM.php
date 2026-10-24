<?php
/**
 * ModernFCM - Estrattore Voti Live FantaMaster
 * Estrae voti live, formazioni ed eventi in tempo reale dall'API pubblica di FantaMaster
 * e genera js/fcmVotiDatiFM.js conforme al costruttore VotoGiocatore di Fantacalcio Manager.
 */

// Aumenta il tempo massimo di esecuzione dello script per prevenire timeout
set_time_limit(300);

// Popola $_GET se lanciato da CLI o server con QUERY_STRING
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str(getenv('QUERY_STRING'), $_GET);
}
$isAjax = !empty($_GET['ajax']) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest');

define('FM_BASE_URL', "https://publicapi.fantamaster.it/livescores/");
define('VOTI_OUTPUT_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFM.js");
define('VOTI_META_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFMMeta.json");

// Helper per voti
function fm_returnvoto($voto) {
    if ($voto === null || $voto === "" || $voto === "0" || $voto === 0) {
        return "SV";
    }
    return (string)$voto;
}

// 1. Costruzione URL con timestamp e giornata opzionale
$gio = !empty($_GET['Gio']) ? $_GET['Gio'] : (!empty($_GET['cGio']) ? $_GET['cGio'] : (!empty($_GET['day']) ? $_GET['day'] : null));
$tcache = round(microtime(true) * 1000);

$apiUrl = FM_BASE_URL . "?tcache=" . $tcache;
if (!empty($gio) && is_numeric($gio)) {
    $apiUrl .= "&day=" . intval($gio);
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
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
            "timeout" => 20,
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
            $processPlayer = function($pName, $squadra, $titolare) use (&$votiGiocatori, &$n, $marks, &$eventsByPlayer, $finaleVal) {
                if (empty($pName)) return;
                $voto = isset($marks[$pName]) ? $marks[$pName] : null;
                $ev = isset($eventsByPlayer[$pName]) ? $eventsByPlayer[$pName] : array(
                    'golfatto' => 0, 'golsubito' => 0, 'autogol' => 0,
                    'ammonito' => 0, 'espulso' => 0, 'rigoresegnato' => 0,
                    'rigoreparato' => 0, 'rigoresbagliato' => 0, 'assist' => 0,
                    'sostituzione' => 0, 'minuto' => 0
                );

                $parametri = array(
                    $ev['golfatto'],
                    $ev['golsubito'],
                    $ev['autogol'],
                    $ev['ammonito'],
                    $ev['espulso'],
                    $ev['rigoresegnato'],
                    $ev['rigoreparato'],
                    $ev['rigoresbagliato'],
                    $ev['assist'],
                    0, // golvittoria
                    0  // golpareggio
                );

                $votiGiocatori[$n] = implode("_", array(
                    strtoupper($pName),
                    fm_returnvoto($voto),
                    "SV",
                    implode("_", $parametri),
                    $squadra,
                    $titolare ? 1 : 0,
                    $ev['sostituzione'],
                    $ev['minuto'],
                    $finaleVal
                ));
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
        foreach ($votiGiocatori as $index => $linea) {
            $campi = explode("_", $linea);
            $campiJson = array_map(function($c) { return json_encode($c, JSON_UNESCAPED_UNICODE); }, $campi);
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
