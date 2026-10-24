<?php
// Popola $_GET se lanciato da CLI o server.js con QUERY_STRING
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str(getenv('QUERY_STRING'), $_GET);
}
$isAjax = !empty($_GET['ajax']) || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest');

$baseDir = dirname(__DIR__);
if (file_exists(__DIR__ . "/liveVU_associazioni.php")) {
    include_once(__DIR__ . "/liveVU_associazioni.php");
} elseif (file_exists($baseDir . "/inc/liveVU_associazioni.php")) {
    include_once($baseDir . "/inc/liveVU_associazioni.php");
} elseif (file_exists($baseDir . "/liveVU_associazioni.php")) {
    include_once($baseDir . "/liveVU_associazioni.php");
}

$Gio = !empty($_GET["Gio"]) ? $_GET["Gio"] : (!empty($_GET["cGio"]) ? $_GET["cGio"] : (!empty($_GET["GIO"]) ? $_GET["GIO"] : null));
if (empty($Gio)) {
    $calFile = $baseDir . "/js/fcmCalendarioDati.js";
    if (!file_exists($calFile)) { $calFile = "js/fcmCalendarioDati.js"; }
    if (file_exists($calFile)) {
        $gioc = explode("\n", file_get_contents($calFile));
        $giornateCalendario = array();
        foreach ($gioc as $riga) {
            if (preg_match('/new I\(([^)]*)\)/', $riga, $incontro)) {
                $campiIncontro = explode(",", $incontro[1]);
                if (isset($campiIncontro[10]) && $campiIncontro[2] != 2) {
                    $giornateCalendario[(int)$campiIncontro[10]] = true;
                }
            }
        }
    }
    $Gio = 1;
    $dataAFile = $baseDir . "/js/DataA.js";
    if (!file_exists($dataAFile)) { $dataAFile = "js/DataA.js"; }
    if (file_exists($dataAFile)) {
        $dateGiornate = file_get_contents($dataAFile);
        if (preg_match_all('/dataGiornata\[(\d+)\]\s*=\s*"([^"]+)"/', $dateGiornate, $dateMatches, PREG_SET_ORDER)) {
            $adesso = new DateTime();
            foreach ($dateMatches as $dateMatch) {
                $numeroGiornata = (int)$dateMatch[1];
                $dataGiornata = DateTime::createFromFormat("F d Y H:i", $dateMatch[2]);
                if ($dataGiornata && isset($giornateCalendario[$numeroGiornata]) && $dataGiornata <= $adesso) {
                    $Gio = $numeroGiornata;
                }
            }
        }
    }
}

$votiTarget = $baseDir . "/js/fcmVotiDatiVU.js";
$metaTarget = $baseDir . "/js/fcmVotiDatiVUMeta.json";

// Gestione sessione per identificare amministratori autenticati
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
$isAdmin = !empty($_SESSION['pn_admin_logged']);
$isCli = (php_sapi_name() === 'cli');

// Controllo forzatura manuale e TTL cache (cooldown rate-limit 60s per utenti non-admin)
$force = !empty($_GET['force']) && ($_GET['force'] == '1' || $_GET['force'] === 'true' || $_GET['force'] === 'force');
$cacheTtl = isset($_GET['ttl']) ? (int)$_GET['ttl'] : (15 * 60); // Limite di default di 15 minuti (900s)

$minCooldown = 60; // Cooldown minimo di 60 secondi per evitare ban IP da PianetaFanta
if (!$isAdmin && !$isCli) {
    $cacheTtl = max($minCooldown, $cacheTtl);
}

$metaData = null;
if (file_exists($metaTarget)) {
    $rawMeta = @file_get_contents($metaTarget);
    if ($rawMeta) {
        $rawMeta = preg_replace('/^\xEF\xBB\xBF/', '', $rawMeta);
        $metaData = json_decode($rawMeta, true);
    }
}

$cacheTime = 0;
if (file_exists($votiTarget)) {
    $cacheTime = isset($metaData["timestamp"]) ? (int)$metaData["timestamp"] : filemtime($votiTarget);
}

// Se non è admin né CLI, impedisci di bypassare la cache se è stata aggiornata meno di 60s fa
if (!$isAdmin && !$isCli && $force && (time() - $cacheTime < $minCooldown)) {
    $force = false;
}

$isCacheValid = false;
if (!$force && file_exists($votiTarget) && filesize($votiTarget) > 100 && is_array($metaData)) {
    $sameGiornata = isset($metaData["giornata"]) && (string)$metaData["giornata"] === (string)$Gio;
    if ($sameGiornata && (time() - $cacheTime < $cacheTtl)) {
        $isCacheValid = true;
    }
}

if ($isCacheValid) {
    if ($isAjax) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
        }
        $lastTime = isset($metaData["lastUpdated"]) ? $metaData["lastUpdated"] : date("d/m/Y H:i:s", filemtime($votiTarget));
        $cacheRemaining = max(0, $cacheTtl - (time() - (isset($metaData["timestamp"]) ? (int)$metaData["timestamp"] : filemtime($votiTarget))));
        echo json_encode(array(
            'success' => true,
            'cached' => true,
            'changed' => false,
            'count' => isset($metaData["count"]) ? (int)$metaData["count"] : 0,
            'source' => 'pianetafanta',
            'giornata' => (int)$Gio,
            'stagione' => isset($metaData["stagione"]) ? $metaData["stagione"] : '',
            'hasMatchLive' => !empty($metaData["hasMatchLive"]),
            'timestamp' => isset($metaData["timestamp"]) ? (int)$metaData["timestamp"] : filemtime($votiTarget),
            'lastUpdated' => $lastTime,
            'cacheTtl' => $cacheTtl,
            'cacheRemaining' => $cacheRemaining,
            'message' => "Voti caricati dalla cache locale (aggiornati alle " . $lastTime . ").",
            'error' => null
        ));
        exit;
    } else {
        // Chiamata sincrona PHP: i dati sono freschi in cache, esci senza scaricare da PianetaFanta
        return;
    }
}

$pianetaHeaders = array(
    "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer: https://pianetafanta.it/voti-fantacalcio",
    "Origin: https://pianetafanta.it",
    "Accept: application/json, text/plain, */*",
    "Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest: empty",
    "Sec-Fetch-Mode: cors",
    "Sec-Fetch-Site: same-origin"
);

function pianeta_api_json($url, $timeout = 20) {
    global $pianetaHeaders;
    $contenuto = false;

    // Metodo 1: cURL nativo
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $pianetaHeaders);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        $contenuto = curl_exec($ch);
        if (PHP_VERSION_ID < 80500) {
            curl_close($ch);
        }
    }

    // Metodo 2: Fallback con stream_context_create
    if ($contenuto === false || $contenuto === null || $contenuto === '') {
        $headerStr = implode("\r\n", $pianetaHeaders) . "\r\n";
        $context = stream_context_create(array(
            "http" => array(
                "method" => "GET",
                "header" => $headerStr,
                "timeout" => $timeout,
                "ignore_errors" => true
            ),
            "ssl" => array(
                "verify_peer" => true,
                "verify_peer_name" => true
            )
        ));
        $contenuto = @file_get_contents($url, false, $context);
    }

    if ($contenuto === false || empty($contenuto)) { return null; }
    $risposta = json_decode($contenuto, true);
    if (!is_array($risposta) || empty($risposta["ok"])) { return null; }
    return isset($risposta["data"]) ? $risposta["data"] : null;
}

$Stagione = !empty($_GET["Stagione"]) ? $_GET["Stagione"] : null;
if (empty($Stagione)) {
    // 1. Rileva automaticamente la stagione attiva dalle impostazioni dell'API di Pianetafanta
    $settings = pianeta_api_json("https://pianetafanta.it/api/voti/settings", 10);
    if (is_array($settings) && !empty($settings["Stagione"])) {
        $Stagione = $settings["Stagione"];
    } elseif (file_exists(__DIR__ . "/js/fcmLegaDati.js")) {
        // 2. Ricava dinamicamente dalla variabile anno di fcmLegaDati.js (es: "2025/2026" -> "2025_2026")
        $legaContent = @file_get_contents(__DIR__ . "/js/fcmLegaDati.js");
        if ($legaContent && preg_match('/anno\s*=\s*["\'](\d{4})\/(\d{4})["\']/', $legaContent, $m)) {
            $Stagione = $m[1] . "_" . $m[2];
        }
    }
    // 3. Fallback dinamico basato sul calendario solare corrente
    if (empty($Stagione)) {
        $curYear = (int)date('Y');
        $Stagione = (date('n') >= 7) ? ($curYear . '_' . ($curYear + 1)) : (($curYear - 1) . '_' . $curYear);
    }
}

// Lettura fonti voti, gol e assist da fcmVariabili.js (con default 6, 1, 1)
$votosource = 6;
$golsource = 1;
$assistsource = 1;

if (file_exists(__DIR__ . "/js/fcmVariabili.js")) {
    $varContent = @file_get_contents(__DIR__ . "/js/fcmVariabili.js");
    if ($varContent) {
        if (preg_match('/var\s+VotoSource\s*=\s*["\']?(\d+)["\']?/i', $varContent, $m)) {
            $votosource = (int)$m[1];
        }
        if (preg_match('/var\s+GolSource\s*=\s*["\']?(\d+)["\']?/i', $varContent, $m)) {
            $golsource = (int)$m[1];
        }
        if (preg_match('/var\s+AssistSource\s*=\s*["\']?(\d+)["\']?/i', $varContent, $m)) {
            $assistsource = (int)$m[1];
        }
    }
}
if (!empty($_GET["votosource"])) $votosource = (int)$_GET["votosource"];
if (!empty($_GET["golsource"])) $golsource = (int)$_GET["golsource"];
if (!empty($_GET["assistsource"])) $assistsource = (int)$_GET["assistsource"];

function pianeta_valore($valore) {
    return ($valore === null || $valore === "") ? "" : (string)$valore;
}

function pianeta_voto($giocatore, $fonte) {
    $gazzetta = isset($giocatore["VotoGazzetta"]) ? pianeta_valore($giocatore["VotoGazzetta"]) : "";
    $corriere = isset($giocatore["VotoCorriere"]) ? pianeta_valore($giocatore["VotoCorriere"]) : "";
    if ($fonte == 1) { return $gazzetta; }
    if ($fonte == 2) { return $corriere; }
    if ($fonte == 3) { return isset($giocatore["VotoTuttoSport"]) ? pianeta_valore($giocatore["VotoTuttoSport"]) : ""; }
    if ($fonte == 4) { return isset($giocatore["MediaVoto2"]) ? pianeta_valore($giocatore["MediaVoto2"]) : ""; }
    if ($fonte == 5) { return isset($giocatore["MediaVoto3"]) ? pianeta_valore($giocatore["MediaVoto3"]) : ""; }
    if ($gazzetta === "s.v." || $corriere === "s.v.") { return "SV"; }
    return isset($giocatore["MediaVoto2"]) ? pianeta_valore($giocatore["MediaVoto2"]) : "";
}

function pianeta_fonte($giocatore, $campo, $fonte) {
    $campi = array(
        "GoalReal" => array("GoalReal", "GoalRealCor", "GoalRealTut"),
        "GoalSub" => array("GoalSub", "GoalSubCor", "GoalSubTut"),
        "Autorete" => array("Autorete", "AutoreteCor", "AutoreteTut"),
        "Assist" => array("Assist", "AssistCor", "AssistTut")
    );
    $key = $campi[$campo][$fonte - 1];
    return isset($giocatore[$key]) ? pianeta_valore($giocatore[$key]) : "";
}

$partiteUrl = "https://pianetafanta.it/api/voti/partite?giornata=" . rawurlencode($Gio) . "&stagione=" . rawurlencode($Stagione);
$partiteData = pianeta_api_json($partiteUrl, 15);
$squadre = array();
$statoSquadra = array();
$hasMatchLive = false;

if (is_array($partiteData) && isset($partiteData["partite"])) {
    $now = time();
    foreach ($partiteData["partite"] as $partita) {
        foreach (array("SquadraCasa", "SquadraOspite") as $lato) {
            if (!empty($partita[$lato])) { $squadre[$partita[$lato]] = true; }
        }

        $sqCasa = !empty($partita["SquadraCasa"]) ? strtoupper(trim((string)$partita["SquadraCasa"])) : "";
        $sqOspite = !empty($partita["SquadraOspite"]) ? strtoupper(trim((string)$partita["SquadraOspite"])) : "";
        $hasScore = (isset($partita["GolCasa"]) && $partita["GolCasa"] !== null && isset($partita["GolOspite"]) && $partita["GolOspite"] !== null);
        $kickoff = !empty($partita["Data"]) ? strtotime($partita["Data"]) : 0;

        $finaleVal = "";
        if ($kickoff > 0) {
            if ($now < $kickoff) {
                // Non iniziata
                $finaleVal = "";
            } elseif ($hasScore && $now >= ($kickoff + (100 * 60))) {
                // Risultato presente e oltre 100 minuti dal calcio d'inizio: terminata
                $finaleVal = "1";
            } elseif ($now >= ($kickoff + (115 * 60))) {
                // Oltre 115 minuti trascorsi dal fischio d'inizio: terminata
                $finaleVal = "1";
            } else {
                // Partita in corso (tra orario di inizio e fine gara)
                $finaleVal = "0";
                $hasMatchLive = true;
            }
        } elseif ($hasScore) {
            // Se Data non presente ma c'è già il risultato
            $finaleVal = "1";
        }

        if ($sqCasa !== "") {
            $statoSquadra[$sqCasa] = $finaleVal;
            $sqNormCasa = (strtolower($sqCasa) === "verona" ? "Hellas Verona" : ucfirst(strtolower($sqCasa)));
            $statoSquadra[$sqNormCasa] = $finaleVal;
            if (strtolower($sqCasa) === "verona") {
                $statoSquadra["Verona"] = $finaleVal;
                $statoSquadra["VERONA"] = $finaleVal;
            }
        }
        if ($sqOspite !== "") {
            $statoSquadra[$sqOspite] = $finaleVal;
            $sqNormOspite = (strtolower($sqOspite) === "verona" ? "Hellas Verona" : ucfirst(strtolower($sqOspite)));
            $statoSquadra[$sqNormOspite] = $finaleVal;
            if (strtolower($sqOspite) === "verona") {
                $statoSquadra["Verona"] = $finaleVal;
                $statoSquadra["VERONA"] = $finaleVal;
            }
        }
    }
}

if (!function_exists('cleanAssocName')) {
    function cleanAssocName($str) {
        if (!$str) return "";
        $s = mb_strtoupper((string)$str, 'UTF-8');
        $s = str_replace(
            array('À','Á','Â','Ã','Ä','Å','È','É','Ê','Ë','Ì','Í','Î','Ï','Ò','Ó','Ô','Õ','Ö','Ù','Ú','Û','Ü','Ý','Ñ','Ç'),
            array('A','A','A','A','A','A','E','E','E','E','I','I','I','I','O','O','O','O','O','U','U','U','U','Y','N','C'),
            $s
        );
        return preg_replace('/[^A-Z0-9]/', '', $s);
    }
}

// Mappe associative dinamiche da liveVU_associazioni.php
$mapAssocByCode = array();
$mapAssocByName = array();
$mapAssocByClean = array();
$mapAssocByFcmClean = array();

if (isset($arrAssociazioni) && is_array($arrAssociazioni)) {
    foreach ($arrAssociazioni as $assoc) {
        $nomeFCM = !empty($assoc[5]) ? trim($assoc[5]) : "";
        if ($nomeFCM === "") continue;

        $codPF = (!empty($assoc[0]) && (int)$assoc[0] > 0) ? (string)$assoc[0] : "";
        $nomePF = !empty($assoc[1]) ? trim($assoc[1]) : "";
        $nomeFG = !empty($assoc[3]) ? trim($assoc[3]) : "";

        if ($codPF !== "") {
            $mapAssocByCode[$codPF] = $nomeFCM;
        }
        if ($nomePF !== "") {
            $mapAssocByName[$nomePF] = $nomeFCM;
            $cPF = cleanAssocName($nomePF);
            if ($cPF !== "") $mapAssocByClean[$cPF] = $nomeFCM;
        }
        if ($nomeFG !== "") {
            $cFG = cleanAssocName($nomeFG);
            if ($cFG !== "") $mapAssocByClean[$cFG] = $nomeFCM;
        }
        $cFCM = cleanAssocName($nomeFCM);
        if ($cFCM !== "") $mapAssocByFcmClean[$cFCM] = $nomeFCM;
    }
}

$squadreKeys = array_keys($squadre);
$squadreData = array();

// DOWNLOAD PARALLELO VELOCE (curl_multi): velocizza l'estrazione da ~25s a ~1.5s
if (function_exists('curl_multi_init') && count($squadreKeys) > 0) {
    $mh = curl_multi_init();
    $curlHandles = array();

    foreach ($squadreKeys as $squadra) {
        $url = "https://pianetafanta.it/api/voti/squadra?squadra=" . rawurlencode($squadra) . "&giornata=" . rawurlencode($Gio) . "&stagione=" . rawurlencode($Stagione);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $pianetaHeaders);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_multi_add_handle($mh, $ch);
        $curlHandles[$squadra] = $ch;
    }

    $running = null;
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running > 0) {
            curl_multi_select($mh, 0.05);
        }
    } while ($running > 0 && $status === CURLM_OK);

    foreach ($curlHandles as $squadra => $ch) {
        $content = curl_multi_getcontent($ch);
        $decoded = json_decode($content, true);
        if (is_array($decoded) && !empty($decoded["ok"]) && isset($decoded["data"])) {
            $squadreData[$squadra] = $decoded["data"];
        }
        curl_multi_remove_handle($mh, $ch);
        if (PHP_VERSION_ID < 80500) {
            curl_close($ch);
        }
    }
    curl_multi_close($mh);
} else {
    // Fallback sequenziale se curl_multi non è disponibile
    foreach ($squadreKeys as $squadra) {
        $url = "https://pianetafanta.it/api/voti/squadra?squadra=" . rawurlencode($squadra) . "&giornata=" . rawurlencode($Gio) . "&stagione=" . rawurlencode($Stagione);
        $dati = pianeta_api_json($url, 15);
        if ($dati) {
            $squadreData[$squadra] = $dati;
        }
    }
}

$datiPianeta = array();
foreach ($squadreData as $squadra => $datiSquadra) {
    if (!is_array($datiSquadra) || empty($datiSquadra["giocatori"])) { continue; }

    $sqKey = strtoupper(trim((string)$squadra));
    $finaleSquadra = isset($statoSquadra[$sqKey]) ? $statoSquadra[$sqKey] : "";

    foreach ($datiSquadra["giocatori"] as $giocatore) {
        $id = isset($giocatore["CodGiocatore"]) ? (string)$giocatore["CodGiocatore"] : "";
        $rawNomePF = isset($giocatore["Nome"]) ? trim((string)$giocatore["Nome"]) : "";
        $cleanNomePF = cleanAssocName($rawNomePF);

        $nome = "";
        if ($id !== "" && (int)$id > 0 && isset($mapAssocByCode[$id])) {
            $nome = $mapAssocByCode[$id];
        } elseif ($rawNomePF !== "" && isset($mapAssocByName[$rawNomePF])) {
            $nome = $mapAssocByName[$rawNomePF];
        } elseif ($cleanNomePF !== "" && isset($mapAssocByClean[$cleanNomePF])) {
            $nome = $mapAssocByClean[$cleanNomePF];
        } elseif ($cleanNomePF !== "" && isset($mapAssocByFcmClean[$cleanNomePF])) {
            $nome = $mapAssocByFcmClean[$cleanNomePF];
        }

        if ($nome === "") {
            if ($rawNomePF !== "") {
                $nome = $rawNomePF;
            } else {
                continue;
            }
        }

        $squadraFCM = (strtolower($squadra) === "verona" ? "Hellas Verona" : ucfirst(strtolower($squadra)));
        $keyUnique = ($id !== "" && (int)$id > 0) ? $id : ($cleanNomePF !== "" ? $cleanNomePF : $nome);

        // Calcolo titolarità, sostituzione e minuto con la stessa logica di #liveFP
        $isTit = (!empty($giocatore["Titolare"]) && (int)$giocatore["Titolare"] === 1);
        $isUscito = (!empty($giocatore["TitolareUscito"]) && (int)$giocatore["TitolareUscito"] === 1);
        $rawMin = isset($giocatore["Minuti"]) ? trim((string)$giocatore["Minuti"]) : "";
        $minNum = (int)preg_replace('/[^0-9]/', '', $rawMin);

        $titolareStr = $isTit ? "1" : "0";
        $sostituzioneStr = "0";
        $minutoStr = "0";

        if ($isTit && $isUscito) {
            // Titolare sostituito uscito dal campo
            $sostituzioneStr = "1";
            $minutoStr = ($minNum > 0) ? ($minNum . "'") : "0";
        } elseif (!$isTit && $minNum > 0) {
            // Panchinaro subentrato a partita in corso
            $sostituzioneStr = "1";
            $minutoStr = $minNum . "'";
        }

        $datiPianeta[$keyUnique] = array(
            "nome" => $nome,
            "voto" => pianeta_voto($giocatore, $votosource),
            "fantavoto" => "SV",
            "golfatto" => pianeta_fonte($giocatore, "GoalReal", $golsource),
            "golsubito" => pianeta_fonte($giocatore, "GoalSub", $golsource),
            "autogol" => pianeta_fonte($giocatore, "Autorete", $golsource),
            "ammonizione" => isset($giocatore["Amm"]) ? pianeta_valore($giocatore["Amm"]) : "",
            "espulsione" => isset($giocatore["Esp"]) ? pianeta_valore($giocatore["Esp"]) : "",
            "rigore" => isset($giocatore["RigoreTra"]) ? pianeta_valore($giocatore["RigoreTra"]) : "",
            "rigoreparato" => isset($giocatore["RigorePar"]) ? pianeta_valore($giocatore["RigorePar"]) : "",
            "rigoresbagliato" => isset($giocatore["RigoreSba"]) ? pianeta_valore($giocatore["RigoreSba"]) : "",
            "assist" => pianeta_fonte($giocatore, "Assist", $assistsource),
            "golvittoria" => isset($giocatore["GoalDecisivoV"]) ? pianeta_valore($giocatore["GoalDecisivoV"]) : "",
            "golpareggio" => isset($giocatore["GoalDecisivoP"]) ? pianeta_valore($giocatore["GoalDecisivoP"]) : "",
            "squadra" => $squadraFCM,
            "titolare" => $titolareStr,
            "sostituzione" => $sostituzioneStr,
            "minuto" => $minutoStr,
            "finale" => $finaleSquadra
        );
    }
}

$countVoti = count($datiPianeta);
$success = false;

$contentJs = "arrPartite = " . json_encode($statoSquadra, JSON_UNESCAPED_UNICODE) . ";\r\n";
$contentJs .= "arrStatoPartite = arrPartite;\r\n";
$contentJs .= "arrVoti = new Array();\r\n";
$z = 0;
foreach ($datiPianeta as $voto) {
    $campi = array(
        $voto["nome"], $voto["voto"], $voto["fantavoto"],
        $voto["golfatto"], $voto["golsubito"], $voto["autogol"],
        $voto["ammonizione"], $voto["espulsione"], $voto["rigore"],
        $voto["rigoreparato"], $voto["rigoresbagliato"], $voto["assist"],
        $voto["golvittoria"], $voto["golpareggio"], $voto["squadra"],
        $voto["titolare"], $voto["sostituzione"], $voto["minuto"],
        $voto["finale"]
    );
    $campiJson = array();
    foreach ($campi as $campo) { $campiJson[] = json_encode($campo, JSON_UNESCAPED_UNICODE); }
    $contentJs .= "arrVoti[" . $z . "] = new VotoGiocatore(" . implode(",", $campiJson) . ");\r\n";
    $z++;
}

if ($countVoti > 0) {
    $tmpVoti = $votiTarget . '.' . uniqid('tmp', true);
    if (@file_put_contents($tmpVoti, $contentJs, LOCK_EX) !== false) {
        @rename($tmpVoti, $votiTarget);
        $success = true;
    } else {
        $success = (@file_put_contents($votiTarget, $contentJs, LOCK_EX) !== false);
    }

    $metaData = array(
        "source" => "pianetafanta",
        "giornata" => (int)$Gio,
        "stagione" => $Stagione,
        "hasMatchLive" => $hasMatchLive,
        "count" => $countVoti,
        "timestamp" => time(),
        "lastUpdated" => date("d/m/Y H:i:s")
    );
    $metaJson = json_encode($metaData, JSON_PRETTY_PRINT);
    $tmpMeta = $metaTarget . '.' . uniqid('tmp', true);
    if (@file_put_contents($tmpMeta, $metaJson, LOCK_EX) !== false) {
        @rename($tmpMeta, $metaTarget);
    } else {
        @file_put_contents($metaTarget, $metaJson, LOCK_EX);
    }
}

// Risposta JSON se invocato via AJAX/Fetch
if ($isAjax) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
    }
    $lastTime = isset($metaData["lastUpdated"]) ? $metaData["lastUpdated"] : date("d/m/Y H:i:s");
    $message = "Voti e bonus/malus scaricati con successo da PianetaFanta! ($countVoti giocatori)";
        
    echo json_encode(array(
        'success' => $success && ($countVoti > 0 || count($squadreKeys) == 0),
        'cached' => false,
        'count' => $countVoti,
        'source' => 'pianetafanta',
        'giornata' => (int)$Gio,
        'stagione' => $Stagione,
        'hasMatchLive' => $hasMatchLive,
        'squadreCount' => count($squadreKeys),
        'timestamp' => time(),
        'lastUpdated' => $lastTime,
        'cacheTtl' => $cacheTtl,
        'updated' => date('H:i:s'),
        'message' => $message,
        'error' => ($success && ($countVoti > 0 || count($squadreKeys) == 0)) ? null : "Nessun voto trovato o errore di connessione con PianetaFanta"
    ));
    exit;
}
?>
