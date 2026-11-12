<?php
// Prob Form Extract by difgusu per ModernFCM - Estrazione diretta DOM (DOMDocument & DOMXPath)

require_once __DIR__ . '/admin_security.inc.php';

// --- CONFIGURAZIONE ---
$baseDir = dirname(__DIR__);
$output = $baseDir . "/js/ProbFGDati.js";

// Funzione cURL migliorata
function file_get_contents_curl($url) {
    if (!function_exists('curl_init')) {
        return @file_get_contents($url);
    }
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    fcm_apply_curl_ssl($ch);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    $data = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Errore cURL: ' . curl_error($ch));
        return false;
    }
    if (function_exists('curl_close')) {
        @curl_close($ch);
    }
    return $data;
}

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
if (!$isCli && !fcm_live_modulo_attivo('ModIndisponibili')) {
    return;
}

// Esecuzione scaricamento (Cache 1 ora o forzatura manuale)
// La forzatura vale solo da riga di comando e per l'admin autenticato
$force = (isset($_GET['force']) && ($_GET['force'] == '1' || $_GET['force'] === 'true') && ($isCli || fcm_admin_session_active(true)))
    || ($isCli && in_array('--force', $argv ?? []));

if (!file_exists($output) || (time() - filemtime($output) > 3600) || $force) {
    
    // Limite condiviso tra tutti i visitatori: se il file manca o lo scaricamento fallisce non si
    // torna su Fantacalcio.it a ogni richiesta, ma al massimo una volta ogni 5 minuti
    if (!$force && !$isCli && !fcm_cooldown_acquire('probform', 300)) {
        return;
    }

    if (file_exists(__DIR__ . "/data/liveVU_associazioni.php")) {
        include(__DIR__ . "/data/liveVU_associazioni.php");
    } elseif (file_exists($baseDir . "/inc/data/liveVU_associazioni.php")) {
        include($baseDir . "/inc/data/liveVU_associazioni.php");
    } else {
        die("Errore critico: manca inc/data/liveVU_associazioni.php");
    }

    $fantagazzetta = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    $str = file_get_contents_curl($fantagazzetta); 

    if (!$str) {
        // Se non scarica, aggiorniamo il tempo del file esistente per non riprovare a ogni refresh
        if (file_exists($output)) touch($output);
        return; 
    }

    $doc = new DOMDocument();
    $prevErrors = libxml_use_internal_errors(true);
    // L'inserimento del prologo XML assicura la corretta interpretazione di UTF-8
    $loaded = $doc->loadHTML('<?xml encoding="UTF-8">' . $str, LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors();
    libxml_use_internal_errors($prevErrors);
    
    // Verifica che il DOM sia stato caricato correttamente
    if (!$loaded) {
        if (file_exists($output)) touch($output);
        error_log("Impossibile processare l'HTML: parsing DOM non riuscito.");
        return;
    }

    $xpath = new DOMXPath($doc);

    // Mappa O(1) per codice Fantacalcio.it ($assoc[2])
    $assocByFgKey = [];
    if (isset($arrAssociazioni) && is_array($arrAssociazioni)) {
        foreach ($arrAssociazioni as $assoc) {
            $fgKey = (string)($assoc[2] ?? '');
            if ($fgKey !== '') {
                $assocByFgKey[$fgKey] = $assoc;
            }
        }
    }

    $probabili = [];
    $indisponibili = [];
    $p = 0; $i = 0;

    // Funzione helper per processare i giocatori (lookup O(1))
    $processPlayer = function(DOMElement $node, DOMXPath $xpath) use (&$assocByFgKey) {
        $linkNodes = $xpath->query('.//a[contains(concat(" ", normalize-space(@class), " "), " player-name ") and contains(concat(" ", normalize-space(@class), " "), " player-link ")]', $node);
        if ($linkNodes->length === 0) return null;
        $linkObj = $linkNodes->item(0);
        $href = $linkObj->getAttribute('href');

        $linkArr = explode('/', $href);
        $playerKey = (string)($linkArr[7] ?? ''); 

        $percNodes = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " progress-value ")]', $node);
        $perc = 0;
        if ($percNodes->length > 0) {
            $perc = str_replace("%", "", $percNodes->item(0)->textContent);
        }

        if ($playerKey !== '' && isset($assocByFgKey[$playerKey])) {
            $assoc = $assocByFgKey[$playerKey];
            return [
                "nome" => $assoc[4],
                "id" => $assoc[6],
                "percent" => trim($perc),
                "nome_indis" => $assoc[5] ?? $assoc[4]
            ];
        }
        return null;
    };

    // 1. TITOLARI
    $starterLists = $xpath->query('//ul[contains(concat(" ", normalize-space(@class), " "), " player-list ") and contains(concat(" ", normalize-space(@class), " "), " starters ")]');
    foreach ($starterLists as $lolle) {
        $items = $xpath->query('.//li[contains(concat(" ", normalize-space(@class), " "), " player-item ") and contains(concat(" ", normalize-space(@class), " "), " pill ")]', $lolle);
        foreach ($items as $tonteddu) {
            $data = $processPlayer($tonteddu, $xpath);
            $probabili[$p++] = $data ? 
                ["nome" => $data["nome"], "id" => $data["id"], "percent" => $data["percent"], "status" => 1] : 
                ["nome" => 100000, "id" => 100000, "percent" => 0, "status" => 0];
        }
    }

    // 2. RISERVE
    $reserveLists = $xpath->query('//ul[contains(concat(" ", normalize-space(@class), " "), " player-list ") and contains(concat(" ", normalize-space(@class), " "), " reserves ")]');
    foreach ($reserveLists as $lolle) {
        $items = $xpath->query('.//li[contains(concat(" ", normalize-space(@class), " "), " player-item ") and contains(concat(" ", normalize-space(@class), " "), " pill ")]', $lolle);
        foreach ($items as $tonteddu) {
            $data = $processPlayer($tonteddu, $xpath);
            $probabili[$p++] = $data ? 
                ["nome" => $data["nome"], "id" => $data["id"], "percent" => $data["percent"], "status" => 0] : 
                ["nome" => 100000, "id" => 100000, "percent" => 0, "status" => 0];
        }
    }

    // 3. SQUALIFICATI
    $suspendedSections = $xpath->query('//section[contains(concat(" ", normalize-space(@class), " "), " suspendeds ")]');
    foreach ($suspendedSections as $lolle) {
        $links = $xpath->query('.//a[contains(concat(" ", normalize-space(@class), " "), " player-name ") and contains(concat(" ", normalize-space(@class), " "), " player-link ")]', $lolle);
        foreach ($links as $tonteddu) {
            $linkArr = explode('/', $tonteddu->getAttribute('href'));
            $playerKey = (string)($linkArr[7] ?? '');
            if ($playerKey !== '' && isset($assocByFgKey[$playerKey])) {
                $assoc = $assocByFgKey[$playerKey];
                $probabili[$p++] = ["nome" => $assoc[4], "id" => $assoc[6], "percent" => 0, "status" => 2];
                $indisponibili[$i++] = ["nome" => $assoc[5], "motivo" => "Squalificato", "rientro" => "", "id" => $assoc[6], "status" => 2];
            }
        }
    }

    // 4. INFORTUNATI
    $injuredLists = $xpath->query('//ul[contains(concat(" ", normalize-space(@class), " "), " injured-list ")]');
    foreach ($injuredLists as $lolle) {
        $items = $xpath->query('.//li', $lolle);
        foreach ($items as $tonteddu) {
            $linkNodes = $xpath->query('.//a', $tonteddu);
            if ($linkNodes->length === 0) continue;
            $linkArr = explode('/', $linkNodes->item(0)->getAttribute('href'));
            $playerKey = (string)($linkArr[7] ?? '');
            
            $pNodes = $xpath->query('.//p', $tonteddu);
            $motivoRaw = $pNodes->length > 0 ? $pNodes->item(0)->textContent : '';
            $motivoArr = explode(', ', $motivoRaw);
            
            if ($playerKey !== '' && isset($assocByFgKey[$playerKey])) {
                $assoc = $assocByFgKey[$playerKey];
                $probabili[$p++] = ["nome" => $assoc[4], "id" => $assoc[6], "percent" => 0, "status" => 3];
                $indisponibili[$i++] = [
                    "nome" => $assoc[5],
                    "motivo" => trim(htmlentities(implode(", ", array_slice($motivoArr, 0, max(0, count($motivoArr) - 1))))),
                    "rientro" => trim(htmlentities(end($motivoArr))),
                    "id" => $assoc[6],
                    "status" => 3
                ];
            }
        }
    }

    // Scrittura File JS (scrittura atomica protetta per evitare troncamenti)
    $titoloNodes = $xpath->query('//p[contains(concat(" ", normalize-space(@class), " "), " titalign ")]');
    $titolo = $titoloNodes->length > 0 ? trim($titoloNodes->item(0)->textContent) : "Dati Aggiornati";
    
    // Tutto il testo scaricato entra nel file JS solo come stringa json_encode: a-capo e separatori
    // di riga Unicode diventano sequenze di escape (il titolo resta dentro il commento) e i byte
    // non UTF-8 vengono sostituiti invece di far fallire la serializzazione.
    $jsFlags = JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_HEX_TAG | JSON_HEX_AMP;

    $buf = "// " . json_encode(html_entity_decode($titolo, ENT_QUOTES, 'UTF-8'), $jsFlags | JSON_UNESCAPED_SLASHES) . "\r\n";
    $buf .= "function Ppc(Giocatore,Percentuale,Stato) {\r\nthis.Giocatore = Giocatore\r\nthis.Percentuale = Percentuale\r\nthis.Stato = Stato\r\n}\r\nvar arrPercento = new Array()\r\na=arrPercento\r\n";

    foreach ($probabili as $pr) {
        $percNum = is_numeric(trim((string)$pr['percent'])) ? (float)trim((string)$pr['percent']) : 0;
        // Solo percentuali vere: un valore come 1e999 diventerebbe INF e renderebbe il file non valido
        if (!is_finite($percNum) || $percNum < 0 || $percNum > 100) {
            $percNum = 0;
        }
        $buf .= "a[" . (int)$pr['id'] . "] = new Ppc(" . json_encode((string)$pr['nome'], $jsFlags) . "," . $percNum . "," . (int)$pr['status'] . ");\n";
    }

    $buf .= "\r\nfunction Ind(ID,Giocatore,Motivo,Rientro,Stato) {\r\nthis.ID = ID\r\nthis.Giocatore = Giocatore\r\nthis.Motivo = Motivo\r\nthis.Rientro = Rientro\r\nthis.Stato = Stato\r\n}\r\nvar arrIndisponibili = new Array()\r\na=arrIndisponibili\r\n";

    foreach ($indisponibili as $in) {
        $mot = html_entity_decode($in['motivo'], ENT_QUOTES | ENT_HTML5 | ENT_XML1, 'UTF-8');
        $rie = html_entity_decode($in['rientro'], ENT_QUOTES | ENT_HTML5 | ENT_XML1, 'UTF-8');
        $buf .= "a[" . (int)$in['id'] . "] = new Ind(" . (int)$in['id'] . "," . json_encode((string)$in['nome'], $jsFlags) . "," . json_encode($mot, $jsFlags) . "," . json_encode($rie, $jsFlags) . "," . (int)$in['status'] . ");\n";
    }

    $tmpOut = $output . '.' . uniqid('tmp', true);
    if (file_put_contents($tmpOut, $buf, LOCK_EX) !== false) {
        @rename($tmpOut, $output);
    } else {
        @file_put_contents($output, $buf, LOCK_EX);
    }
}
?>