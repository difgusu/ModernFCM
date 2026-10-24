<?php

// Aumenta il tempo massimo di esecuzione dello script per prevenire timeout
set_time_limit(300);

// Popola $_GET se lanciato da CLI o server.js con QUERY_STRING
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str(getenv('QUERY_STRING'), $_GET);
}
$isAjax = !empty($_GET['ajax']) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest');

// Definisci le costanti
define('API_URL', "https://api.fantapazz.com/live.php");
define('VOTI_OUTPUT_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFP.js");
define('VOTI_META_FILE', dirname(__DIR__) . "/js/fcmVotiDatiFPMeta.json");

// Funzioni helper
function returnvoto($voto) {
    if ($voto === null || $voto === "") {
        return "SV";
    }
    return $voto;
}

function checkmin($min) {
    return ($min !== null && $min !== "") ? 1 : 0;
}

function returnmin($min) {
    if ($min === null || $min === "") {
        return "0";
    }
    return $min;
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
        foreach ($bonus as $codice) {
            if (isset($eventi[$codice])) {
                $counts[$eventi[$codice]]++;
            }
        }
    }

    return implode("_", array(
        $counts["golfatto"], $counts["golsubito"], $counts["autogol"],
        $counts["ammonito"], $counts["espulso"], $counts["rigoresegnato"],
        $counts["rigoreparato"], $counts["rigoresbagliato"], $counts["assist"],
        $counts["golvittoria"], $counts["golpareggio"]
    ));
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
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
            "user_agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
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

                                $votiGiocatori[$n] = implode("_", array(
                                    strtoupper($giocatore["calciatore"]),
                                    returnvoto($voto),
                                    "SV",
                                    getParametri($bonus),
                                    $nomeSquadra,
                                    1, // Ruolo: 1 per i titolari
                                    checkmin($min),
                                    returnmin($min),
                                    isset($partiteStato[$nomeSquadra]) ? $partiteStato[$nomeSquadra] : ""
                                ));
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

                                $votiGiocatori[$n] = implode("_", array(
                                    strtoupper($giocatore["calciatore"]),
                                    returnvoto($voto),
                                    "SV",
                                    getParametri($bonus),
                                    $nomeSquadra,
                                    0, // Ruolo: 0 per i panchinari
                                    checkmin($min),
                                    returnmin($min),
                                    isset($partiteStato[$nomeSquadra]) ? $partiteStato[$nomeSquadra] : ""
                                ));
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