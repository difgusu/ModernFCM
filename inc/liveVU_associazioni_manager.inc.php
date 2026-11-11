<?php
/**
 * ModernFCM - Gestore Associazioni Live (Pianetafanta / Fantacalcio.it / FCM)
 * File: liveVU_associazioni_manager.inc.php
 * 
 * Permette la lettura e il matching automatico dei listoni Excel su arrGiocatoriA (Serie A),
 * la gestione e risoluzione dei casi dubbi, e la scrittura di inc/data/liveVU_associazioni.php.
 */

require_once __DIR__ . '/admin_security.inc.php';

if (!defined('FCM_ASSOC_MANAGER')) {
    define('FCM_ASSOC_MANAGER', true);
}

/**
 * Parser XLSX universale compatibile sia con ZipArchive che con PharData.
 */
function parseXlsxCellsUniversal($filePath, $targetSheetIndex = 1) {
    $rows = [];
    $sharedStrings = [];
    $sheetXmlStr = null;

    // Metodo 1: ZipArchive (se disponibile su host Linux)
    if (class_exists('ZipArchive')) {
        $zip = new ZipArchive();
        if ($zip->open($filePath) === true) {
            $sstXml = $zip->getFromName('xl/sharedStrings.xml');
            if ($sstXml) {
                $xml = @simplexml_load_string($sstXml);
                if ($xml && isset($xml->si)) {
                    foreach ($xml->si as $si) {
                        $text = '';
                        if (isset($si->t)) {
                            $text = (string)$si->t;
                        } elseif (isset($si->r)) {
                            foreach ($si->r as $r) {
                                $text .= (string)$r->t;
                            }
                        }
                        $sharedStrings[] = $text;
                    }
                }
            }

            $sheetXmlStr = $zip->getFromName("xl/worksheets/sheet{$targetSheetIndex}.xml");
            if (!$sheetXmlStr) {
                $sheetXmlStr = $zip->getFromName('xl/worksheets/sheet1.xml');
            }
            $zip->close();
        }
    }

    // Metodo 2: Fallback su PharData nativo (Windows / PHP senza php_zip.dll)
    if ($sheetXmlStr === null && class_exists('PharData')) {
        $tempZip = sys_get_temp_dir() . '/' . uniqid('xlsx_parse_', true) . '.zip';
        if (@copy($filePath, $tempZip)) {
            try {
                $phar = new PharData($tempZip);
                if (isset($phar['xl/sharedStrings.xml'])) {
                    $xmlStr = $phar['xl/sharedStrings.xml']->getContent();
                    $xml = @simplexml_load_string($xmlStr);
                    if ($xml && isset($xml->si)) {
                        foreach ($xml->si as $si) {
                            $text = '';
                            if (isset($si->t)) {
                                $text = (string)$si->t;
                            } elseif (isset($si->r)) {
                                foreach ($si->r as $r) {
                                    $text .= (string)$r->t;
                                }
                            }
                            $sharedStrings[] = $text;
                        }
                    }
                }

                $sheetPath = "xl/worksheets/sheet{$targetSheetIndex}.xml";
                if (!isset($phar[$sheetPath])) {
                    $sheetPath = 'xl/worksheets/sheet1.xml';
                }
                if (isset($phar[$sheetPath])) {
                    $sheetXmlStr = $phar[$sheetPath]->getContent();
                }
            } catch (Exception $e) {
                $sheetXmlStr = null;
            } finally {
                @unlink($tempZip);
            }
        }
    }

    if ($sheetXmlStr === null) {
        throw new Exception("Impossibile decomprimere e leggere il file Excel. Verificare l'estensione o i permessi temporanei.");
    }

    $sheetXml = @simplexml_load_string($sheetXmlStr);
    if (!$sheetXml || !isset($sheetXml->sheetData->row)) {
        return $rows;
    }

    // Helper colonna: es. 'A' -> 0, 'B' -> 1, 'AA' -> 26
    $colLetterToIdx = function($col) {
        $idx = 0;
        $len = strlen($col);
        for ($i = 0; $i < $len; $i++) {
            $idx = $idx * 26 + ord($col[$i]) - 64;
        }
        return $idx - 1;
    };

    foreach ($sheetXml->sheetData->row as $row) {
        $rowCells = [];
        foreach ($row->c as $c) {
            $cellRef = (string)$c['r'];
            $colIdx = 0;
            if (preg_match('/^([A-Z]+)(\d+)$/', $cellRef, $m)) {
                $colIdx = $colLetterToIdx($m[1]);
            }
            $type = (string)$c['t'];
            $val = (string)$c->v;
            if ($type === 's' && is_numeric($val) && isset($sharedStrings[(int)$val])) {
                $val = $sharedStrings[(int)$val];
            }
            $rowCells[$colIdx] = trim($val);
        }
        if (!empty($rowCells)) {
            $maxIdx = max(array_keys($rowCells));
            $fullRow = [];
            for ($k = 0; $k <= $maxIdx; $k++) {
                $fullRow[$k] = isset($rowCells[$k]) ? $rowCells[$k] : '';
            }
            $rows[] = $fullRow;
        }
    }

    return $rows;
}

/**
 * Estrae tutti i giocatori FCM attivi in Serie A (IDSquadra <= 20)
 * combinando js/fcmSerieADatiDettaglio.js e js/fcmSerieADati.js.
 */
function getSerieAPlayersFromFcm($baseDir) {
    $namesFile = $baseDir . '/js/fcmSerieADati.js';
    $detailFile = $baseDir . '/js/fcmSerieADatiDettaglio.js';

    $names = [];
    $squadre = [];
    if (file_exists($namesFile)) {
        $lines = file($namesFile, FILE_IGNORE_NEW_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (preg_match('/^xg(\d+)\s*=\s*"([^"]+)"/', $line, $m)) {
                $names[(int)$m[1]] = trim($m[2]);
            } elseif (preg_match('/^xa(\d+)\s*=\s*"([^"]+)"/', $line, $m)) {
                $squadre[(int)$m[1]] = trim($m[2]);
            }
        }
    }

    $players = [];
    if (file_exists($detailFile)) {
        $lines = file($detailFile, FILE_IGNORE_NEW_LINES);
        foreach ($lines as $line) {
            if (preg_match('/new\s+GiocatoreA\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/', $line, $m)) {
                $id = (int)$m[1];
                $idSquadra = (int)$m[2];
                $ruoloNum = (int)$m[3];
                $codice = (int)$m[4];

                // REGOLA UTENTE: Salta giocatori non più in Serie A (> 20)
                if ($idSquadra > 20) {
                    continue;
                }

                $ruoloLettera = match($ruoloNum) {
                    1 => 'P',
                    2 => 'D',
                    3 => 'C',
                    4 => 'A',
                    default => 'C'
                };

                $nomeFCM = isset($names[$id]) ? $names[$id] : "Giocatore_$id";
                $squadraFCM = isset($squadre[$idSquadra]) ? $squadre[$idSquadra] : "";

                $players[] = [
                    'id' => $id,
                    'codice' => $codice,
                    'nome' => $nomeFCM,
                    'squadra_id' => $idSquadra,
                    'squadra' => $squadraFCM,
                    'ruolo' => $ruoloLettera,
                    'ruolo_num' => $ruoloNum
                ];
            }
        }
    }

    // Ordine prioritario: RUOLO (P, D, C, A) poi ALFABETICO PURO per nome calciatore (senza considerare la squadra)
    $roleOrder = ['P' => 1, 'D' => 2, 'C' => 3, 'A' => 4];
    usort($players, function($a, $b) use ($roleOrder) {
        $rA = isset($roleOrder[$a['ruolo']]) ? $roleOrder[$a['ruolo']] : 99;
        $rB = isset($roleOrder[$b['ruolo']]) ? $roleOrder[$b['ruolo']] : 99;
        if ($rA !== $rB) {
            return $rA <=> $rB;
        }
        return strcasecmp($a['nome'], $b['nome']);
    });

    return $players;
}

/**
 * Carica le associazioni storiche esistenti da inc/data/liveVU_associazioni.php.
 */
function loadCurrentLiveVUAssociazioni($baseDir) {
    $assocFile = $baseDir . '/inc/data/liveVU_associazioni.php';
    if (!file_exists($assocFile)) {
        $assocFile = __DIR__ . '/data/liveVU_associazioni.php';
    }
    $existing = [];
    if (!file_exists($assocFile)) {
        return $existing;
    }

    $lines = file($assocFile, FILE_IGNORE_NEW_LINES);
    foreach ($lines as $line) {
        if (preg_match('/\$arrAssociazioni\[(\d+)\]\s*=\s*array\((.*)\);/', $line, $m)) {
            if ((int)$m[1] === 0) continue;
            $raw = $m[2];
            $parts = array_map(function($p) {
                return trim($p, " \t\n\r\0\x0B\"");
            }, explode(',', $raw));

            if (count($parts) >= 6) {
                $codFCM = (int)$parts[4];
                $nomeFP = '';
                $codFM = '';
                $nomeFM = '';
                if (count($parts) >= 11) {
                    // Formato legacy transitorio a 11 elementi (con codFP al posto 7)
                    $nomeFP = isset($parts[8]) ? $parts[8] : '';
                    $codFM = isset($parts[9]) && $parts[9] !== '' ? $parts[9] : '';
                    $nomeFM = isset($parts[10]) ? $parts[10] : '';
                } elseif (count($parts) >= 10) {
                    // Formato a 10 elementi (senza codFP)
                    $nomeFP = isset($parts[7]) ? $parts[7] : '';
                    $codFM = isset($parts[8]) && $parts[8] !== '' ? $parts[8] : '';
                    $nomeFM = isset($parts[9]) ? $parts[9] : '';
                }
                $existing[$codFCM] = [
                    'codPF' => $parts[0] !== '' ? (int)$parts[0] : '',
                    'nomePF' => $parts[1],
                    'codFC' => $parts[2] !== '' ? (int)$parts[2] : '',
                    'nomeFC' => $parts[3],
                    'codFCM' => $codFCM,
                    'nomeFCM' => $parts[5],
                    'idFCM' => isset($parts[6]) ? (int)$parts[6] : 0,
                    'nomeFP' => $nomeFP,
                    'codFM' => $codFM,
                    'nomeFM' => $nomeFM
                ];
            }
        }
    }
    return $existing;
}

/**
 * Normalizzazione e splitting di nomi e squadre per il matching.
 */
function assocNormTeam($t) {
    $t = mb_strtoupper(trim($t), 'UTF-8');
    $t = str_replace(['HELLAS VERONA', 'VERONA FC'], 'VERONA', $t);
    $t = str_replace(['INTERNAZIONALE'], 'INTER', $t);
    return $t;
}

function assocCleanStr($s) {
    $s = mb_strtoupper(trim($s), 'UTF-8');
    $map = [
        'À'=>'A','Á'=>'A','È'=>'E','É'=>'E','Ì'=>'I','Í'=>'I','Ò'=>'O','Ó'=>'O','Ù'=>'U','Ú'=>'U',
        '\''=>'','-'=>' ','_'=>' ','.'=>''
    ];
    return strtr($s, $map);
}

function assocGetNameParts($fullName) {
    $cleaned = assocCleanStr($fullName);
    $words = preg_split('/\s+/', $cleaned);
    if (empty($words) || empty($words[0])) return ['', '', ''];
    $prefixes = ['DE', 'DI', 'DA', 'DEL', 'DELL', 'DELLA', 'DEI', 'DOS', 'VAN', 'VON', 'LA', 'LE', 'EL', 'AL', 'SAN', 'SANTA'];
    if (count($words) > 1 && in_array($words[0], $prefixes)) {
        $surname = $words[0] . ' ' . $words[1];
        $firstnames = array_slice($words, 2);
    } else {
        $surname = $words[0];
        $firstnames = array_slice($words, 1);
    }
    $initial = !empty($firstnames) && strlen($firstnames[0]) > 0 ? $firstnames[0][0] : '';
    return [$surname, implode(' ', $firstnames), $initial];
}

/**
 * Estrae tutti i token significativi da un nome (gestisce apostrofi, trattini, stopword, caratteri speciali)
 */
function assocExtractNameTokens($str) {
    if (!$str) return [];
    $norm = assocCleanStr($str);
    $map = [
        '’'=>'','‘'=>'','`'=>'','´'=>'','\''=>'','.'=>' ','-'=>' ','_'=>' ','"'=>'',';'=>'',','=>' '
    ];
    $norm = strtr($norm, $map);
    $parts = preg_split('/\s+/', trim($norm));
    $stopwords = ['DE', 'DI', 'DA', 'DEL', 'DELL', 'DELLA', 'DEI', 'DOS', 'DAS', 'VAN', 'VON', 'DER', 'DEN', 'LA', 'LE', 'EL', 'AL', 'SAN', 'SANTA'];
    
    $tokens = [];
    foreach ($parts as $p) {
        $p = trim($p);
        if ($p !== '' && !in_array($p, $stopwords)) {
            $tokens[] = $p;
        }
    }
    return array_values(array_unique($tokens));
}

/**
 * Valuta corrispondenza avanzata anche per giocatori con più nomi (nomi multipli, composti o invertiti)
 */
function assocMatchPlayerExtended($fcmNome, $fcmSquadra, $candNome, $candSquadra) {
    $fcmTokens = assocExtractNameTokens($fcmNome);
    $candTokens = assocExtractNameTokens($candNome);
    
    if (empty($fcmTokens) || empty($candTokens)) {
        return false;
    }
    
    $normFcmTeam = assocNormTeam($fcmSquadra);
    $normCandTeam = assocNormTeam($candSquadra);
    $sameTeam = ($normFcmTeam !== '' && $normFcmTeam === $normCandTeam);
    $emptyTeam = ($normCandTeam === '');
    
    // Token significativi (>= 3 caratteri)
    $candSigTokens = array_values(array_filter($candTokens, fn($w) => strlen($w) >= 3));
    
    $common = array_intersect($fcmTokens, $candTokens);
    $sigCommon = array_values(array_filter($common, fn($w) => strlen($w) >= 3));
    
    // Iniziali di tutti i token di FCM (per confrontare es. Martinez J., Karlsson J., Esposito P., Esposito F.)
    $fcmInits = [];
    foreach ($fcmTokens as $t) {
        if (strlen($t) > 0) $fcmInits[] = $t[0];
    }
    
    $score = 0;
    $matchType = '';
    
    // 1. Tutti i token significativi del candidato sono contenuti nei molteplici nomi di FCM
    // (es. "Pio Esposito", "Rocha Livramento", "Carlos Augusto", "Kolo Muani", "Joao Felix", "Dele Bashiru")
    if (!empty($candSigTokens) && count($sigCommon) === count($candSigTokens)) {
        $score = $sameTeam ? 100 : ($emptyTeam ? 85 : 75);
        $matchType = 'cand_subset';
    }
    // 2. Almeno due token significativi in comune (>= 3 caratteri)
    elseif (count($sigCommon) >= 2) {
        $score = $sameTeam ? 95 : ($emptyTeam ? 80 : 70);
        $matchType = 'multi_token';
    }
    // 3. Stessa squadra e 1 token significativo in comune (es. "Livramento" al Verona, "Anguissa" a Napoli)
    elseif ($sameTeam && count($sigCommon) >= 1) {
        $score = 65;
        $matchType = 'same_team_token';
    }
    // 4. Iniziale corrispondente a uno QUALSIASI dei molteplici nomi di FCM (es. Martinez J., Karlsson J.)
    else {
        $singleLetters = array_values(array_filter($candTokens, fn($w) => strlen($w) === 1));
        $longerCandTokens = array_values(array_filter($candTokens, fn($w) => strlen($w) >= 3));
        if (!empty($singleLetters) && !empty($longerCandTokens)) {
            $matchedMain = array_intersect($longerCandTokens, $fcmTokens);
            if (!empty($matchedMain)) {
                foreach ($singleLetters as $sl) {
                    if (in_array($sl, $fcmInits)) {
                        $score = $sameTeam ? 90 : ($emptyTeam ? 75 : 55);
                        $matchType = 'initial_match';
                        break;
                    }
                }
            }
        }
    }
    
    // 5. Squadra vuota o diversa ma token distintivo raro (>= 5 caratteri)
    $commonFirstNames = ['DAVID', 'LORENZO', 'MARCO', 'ANTONIO', 'GENNARO', 'PEDRO', 'GABRIEL', 'JUNIOR', 'MARTIN', 'KEVIN', 'JEAN', 'CARLOS', 'SAMUEL', 'DANIEL', 'ALEX', 'LUCAS', 'NICOLAS', 'MICHAEL', 'CHRISTIAN', 'LUIS', 'FELIPE', 'LEONARDO', 'MATTEO', 'ANDREA', 'FRANCESCO', 'SIMONE', 'STEFANO', 'FEDERICO', 'TOMAS', 'DIEGO'];
    if ($score === 0 && ($emptyTeam || !$sameTeam) && count($sigCommon) >= 1 && strlen($sigCommon[0]) >= 5) {
        if (!in_array($sigCommon[0], $commonFirstNames)) {
            $score = $emptyTeam ? 60 : 45;
            $matchType = 'distinctive_token';
        }
    }
    
    if ($score > 0) {
        return [
            'type' => $matchType,
            'score' => $score,
            'same_team' => $sameTeam,
            'common' => $common,
            'sig_common' => $sigCommon
        ];
    }
    
    return false;
}

// Mappature manuali note FantaMaster -> FCM per disambiguazione immediata
$GLOBALS['manualFMtoFCM'] = [
    'Rossi F' => 'ROSSI Francesco',
    'Nico Paz' => 'PAZ MARTINEZ Nicolas',
    'Rafa Marin' => 'MARIN ZAMORA Rafael',
    'Caviglia' => 'NICOLUSSI CAVIGLIA Hans',
    'Adams' => 'ADAMS Che\' Zach',
    'Ale Gomes' => 'GOMES Candido Alexsandro',
    'Kike Perez' => 'PEREZ Enrique',
    'Pellegrini' => 'PELLEGRINI Lorenzo',
    'Vasquez' => 'VASQUEZ IBARRA Johan Felipe',
    'Thuram' => 'THURAM Marcus Lilian',
    'Colombo' => 'COLOMBO Lorenzo',
    'El Bilal Toure' => 'TOURE\' El Bilal',
    'Sulemana' => 'SULEMANA Ibrahim Kakari'
];

/**
 * Normalizzazione stringa specifica per Fantapazz
 */
if (!function_exists('normalizeFpString')) {
function normalizeFpString($str) {
    if ($str === null || $str === '') return '';
    $s = mb_strtoupper(trim((string)$str), 'UTF-8');
    $s = str_replace(["’", "‘", "`", "´"], "'", $s);
    $map = [
        'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A', 'Å' => 'A',
        'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E',
        'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I',
        'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O',
        'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U',
        'Ý' => 'Y', 'Ç' => 'C', 'Ñ' => 'N'
    ];
    $s = strtr($s, $map);
    return preg_replace('/\s+/', ' ', $s);
}
}

/**
 * Normalizzazione squadra specifica per Fantapazz
 */
if (!function_exists('normalizeFpTeamName')) {
function normalizeFpTeamName($team) {
    $t = normalizeFpString($team);
    if (strpos($t, 'VERONA') !== false) return 'HELLAS VERONA';
    if (strpos($t, 'INTER') !== false) return 'INTER';
    return $t;
}
}

/**
 * Parsing del contenuto CSV del Listone Fantapazz
 */
if (!function_exists('parseFantapazzCsvContent')) {
function parseFantapazzCsvContent($content) {
    if (empty($content)) {
        throw new Exception("Il contenuto CSV Fantapazz è vuoto.");
    }
    if (str_starts_with($content, "\xEF\xBB\xBF")) {
        $content = substr($content, 3);
    }
    $lines = preg_split('/\r\n|\r|\n/', trim($content));
    if (empty($lines)) {
        throw new Exception("Il file CSV Fantapazz è privo di righe.");
    }
    $headerLine = array_shift($lines);
    $delim = (strpos($headerLine, ';') !== false) ? ';' : ',';

    $players = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $cols = str_getcsv($line, $delim, '"', "\\");
        if (count($cols) < 2) continue;
        $ruolo = isset($cols[0]) ? trim($cols[0]) : '';
        $calciatore = isset($cols[1]) ? trim($cols[1]) : '';
        $squadra = isset($cols[2]) ? trim($cols[2]) : '';
        $quotazione = isset($cols[3]) ? trim($cols[3]) : '';
        if ($calciatore === '') continue;
        $players[] = [
            'ruolo' => strtoupper($ruolo),
            'calciatore' => $calciatore,
            'squadra' => $squadra,
            'quotazione' => $quotazione,
            'norm_name' => normalizeFpString($calciatore),
            'norm_team' => normalizeFpTeamName($squadra)
        ];
    }
    return $players;
}
}

if (!function_exists('parseFantapazzCsv')) {
function parseFantapazzCsv($filePath) {
    if (!file_exists($filePath)) {
        throw new Exception("File CSV Fantapazz non trovato: " . basename($filePath));
    }
    $content = file_get_contents($filePath);
    if ($content === false) {
        throw new Exception("Impossibile leggere il file CSV Fantapazz.");
    }
    return parseFantapazzCsvContent($content);
}
}

if (!function_exists('getFantapazzCsvFile')) {
function getFantapazzCsvFile($baseDir) {
    $candidates = [
        $baseDir . '/inc/data/Listone_Fantapazz.csv',
        $baseDir . '/tests/Listone_Fantapazz.csv',
        sys_get_temp_dir() . '/Listone_Fantapazz.csv'
    ];
    foreach ($candidates as $f) {
        if (file_exists($f) && filesize($f) > 100) {
            return $f;
        }
    }
    return null;
}
}

if (!function_exists('saveFantapazzCsvFile')) {
function saveFantapazzCsvFile($baseDir, $content) {
    $candidates = [
        $baseDir . '/inc/data/Listone_Fantapazz.csv',
        $baseDir . '/tests/Listone_Fantapazz.csv',
        sys_get_temp_dir() . '/Listone_Fantapazz.csv'
    ];
    foreach ($candidates as $targetFile) {
        $dir = dirname($targetFile);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (@file_put_contents($targetFile, $content) !== false) {
            return $targetFile;
        }
    }
    return null;
}
}

if (!function_exists('fetchFantapazzCsvOnline')) {
function fetchFantapazzCsvOnline($baseDir) {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    $cookieFile = sys_get_temp_dir() . '/fp_cookie_' . uniqid() . '.txt';

    $ch = curl_init('https://www.fantapazz.com/fantacalcio/listone-e-quotazioni');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_USERAGENT => $ua,
        CURLOPT_TIMEOUT => 25,
    ]);
    fcm_apply_curl_ssl($ch);
    $html = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code !== 200 || !$html) {
        @unlink($cookieFile);
        throw new Exception("Impossibile connettersi a Fantapazz.com (HTTP $code).");
    }

    if (!preg_match('/name=["\']form_build_id["\']\s+value=["\']([^"\']+)["\']/i', $html, $m)) {
        @unlink($cookieFile);
        throw new Exception("Token form_build_id non trovato nella pagina di Fantapazz.");
    }
    $formBuildId = $m[1];

    $postData = [
        'op' => '<i class="fa fa-download" aria-hidden="true"></i> Scarica listone',
        'form_build_id' => $formBuildId,
        'form_id' => 'listone_download_csv_form'
    ];

    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://www.fantapazz.com/fantacalcio/listone-e-quotazioni',
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Referer: https://www.fantapazz.com/fantacalcio/listone-e-quotazioni',
            'Origin: https://www.fantapazz.com'
        ]
    ]);

    $csvContent = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    @unlink($cookieFile);

    if ($code !== 200 || empty($csvContent) || strlen($csvContent) < 100) {
        throw new Exception("Download del listone Fantapazz non riuscito (HTTP $code).");
    }

    $players = parseFantapazzCsvContent($csvContent);
    if (empty($players)) {
        throw new Exception("Nessun calciatore trovato nel listone CSV scaricato da Fantapazz.");
    }

    $savedPath = saveFantapazzCsvFile($baseDir, $csvContent);
    saveAssocCacheJson($baseDir, 'latest_fp.json', $players);
    $_SESSION['pn_assoc_fp_players'] = $players;

    return [
        'count' => count($players),
        'players' => $players,
        'bytes' => strlen($csvContent),
        'saved_path' => $savedPath
    ];
}
}

/**
 * Scarica automaticamente tutte e 4 le fonti online in una sola operazione.
 */
function fetchAllSourcesOnline($baseDir) {
    $pf = fetchPianetafantaPlayersOnline($baseDir);
    $fc = fetchFantacalcioPlayersOnline($baseDir);
    $fp = fetchFantapazzCsvOnline($baseDir);
    $fm = fetchFantamasterPlayersOnline($baseDir);

    saveAssocCacheJson($baseDir, 'latest_pf.json', $pf['list']);
    saveAssocCacheJson($baseDir, 'latest_fc.json', $fc['list']);
    saveAssocCacheJson($baseDir, 'latest_fp.json', $fp['players']);
    saveAssocCacheJson($baseDir, 'latest_fm.json', $fm['players']);

    $_SESSION['pn_assoc_pf_list'] = $pf['list'];
    $_SESSION['pn_assoc_fc_list'] = $fc['list'];
    $_SESSION['pn_assoc_fp_players'] = $fp['players'];
    $_SESSION['pn_assoc_fm_players'] = $fm['players'];

    return [
        'pf' => $pf,
        'fc' => $fc,
        'fp' => $fp,
        'fm' => $fm,
        'pf_count' => $pf['count'],
        'fc_count' => $fc['count'],
        'fp_count' => $fp['count'],
        'fm_count' => $fm['count'],
        'updated' => date('d/m/Y H:i:s')
    ];
}

/**
 * Motore di associazione unificato orientato sui giocatori di arrGiocatoriA con tutte e 4 le fonti (PF, FC, FP, FM).
 */
function runAssociationMatching($fcmPlayers, $pfList, $fcList, $existingAssoc, $fpList = [], $fmList = []) {
    global $baseDir, $manualFMtoFCM;
    if (empty($baseDir)) $baseDir = dirname(__DIR__);

    // Carica FP se non fornito
    if (empty($fpList)) {
        if (!empty($_SESSION['pn_assoc_fp_players'])) {
            $fpList = $_SESSION['pn_assoc_fp_players'];
        } else {
            $fpList = loadAssocCacheJson($baseDir, 'latest_fp.json');
            if (empty($fpList)) {
                $cachedCsv = getFantapazzCsvFile($baseDir);
                if ($cachedCsv) {
                    try { $fpList = parseFantapazzCsv($cachedCsv); } catch (Exception $e) {}
                }
            }
        }
    }
    if (!is_array($fpList)) $fpList = [];

    // Carica FM se non fornito
    if (empty($fmList)) {
        if (!empty($_SESSION['pn_assoc_fm_players'])) {
            $fmList = $_SESSION['pn_assoc_fm_players'];
        } else {
            $fmList = loadAssocCacheJson($baseDir, 'latest_fm.json');
        }
    }
    if (!is_array($fmList)) $fmList = [];

    // Indicizzazione lookup O(1)
    $pfByCode = [];
    foreach ($pfList as $item) {
        $pfByCode[$item['cod']] = $item;
    }

    $fcById = [];
    foreach ($fcList as $item) {
        $fcById[$item['id']] = $item;
    }

    $fpByName = [];
    foreach ($fpList as $item) {
        $nameClean = assocCleanStr($item['calciatore'] ?? '');
        if ($nameClean !== '') $fpByName[$nameClean] = $item;
    }

    $fmById = [];
    $fmByName = [];
    foreach ($fmList as $item) {
        if (!empty($item['id'])) $fmById[(int)$item['id']] = $item;
        $nameClean = assocCleanStr($item['name'] ?? '');
        if ($nameClean !== '') $fmByName[$nameClean] = $item;
    }

    // Inverti manualFMtoFCM per lookup FCM -> FM
    $manualFMtoFCM_inv = [];
    if (!empty($manualFMtoFCM) && is_array($manualFMtoFCM)) {
        foreach ($manualFMtoFCM as $fmN => $fcmN) {
            $manualFMtoFCM_inv[assocCleanStr($fcmN)] = $fmN;
        }
    }

    $confirmed = [];
    $doubtful = [];
    $notFound = [];
    $all = [];

    foreach ($fcmPlayers as $p) {
        $codFCM = $p['codice'];
        $teamFCM = assocNormTeam($p['squadra']);
        $ruoloFCM = $p['ruolo'];
        list($surname, $firstnames, $initial) = assocGetNameParts($p['nome']);
        $surnameNoSpace = str_replace(' ', '', $surname);
        $cleanFcmName = assocCleanStr($p['nome']);

        // --- 1. PIANETAFANTA MATCHING ---
        $pfSelected = null;
        $pfCandidates = [];
        $pfIsDoubtful = false;

        if (isset($existingAssoc[$codFCM]) && !empty($existingAssoc[$codFCM]['codPF']) && isset($pfByCode[$existingAssoc[$codFCM]['codPF']])) {
            $pfSelected = $pfByCode[$existingAssoc[$codFCM]['codPF']];
        } else {
            foreach ($pfList as $cand) {
                list($candSurname, , ) = assocGetNameParts($cand['nome']);
                $candSurnameNoSpace = str_replace(' ', '', $candSurname);
                $isSurnameMatch = ($candSurname === $surname) || (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);
                if ($isSurnameMatch) {
                    $pfCandidates[] = $cand;
                }
            }

            $sameTeam = array_values(array_filter($pfCandidates, fn($c) => assocNormTeam($c['squadra']) === $teamFCM));
            if (count($sameTeam) === 1) {
                $pfSelected = $sameTeam[0];
            } elseif (count($sameTeam) > 1) {
                $initMatch = array_values(array_filter($sameTeam, fn($c) => $initial !== '' && str_contains(assocCleanStr($c['nome']), $initial)));
                if (count($initMatch) === 1) {
                    $pfSelected = $initMatch[0];
                } else {
                    $pfIsDoubtful = true;
                }
            } elseif (!empty($pfCandidates)) {
                $pfIsDoubtful = true;
            }

            if ($pfSelected === null || $pfIsDoubtful || empty($pfCandidates) || count($sameTeam) !== 1) {
                $candIds = array_column($pfCandidates, 'cod');
                $extCandidates = [];
                foreach ($pfList as $cand) {
                    if (in_array($cand['cod'], $candIds)) continue;
                    $match = assocMatchPlayerExtended($p['nome'], $p['squadra'], $cand['nome'], $cand['squadra']);
                    if ($match) {
                        $cand['_match'] = $match;
                        $extCandidates[] = $cand;
                    }
                }
                if (!empty($extCandidates)) {
                    usort($extCandidates, fn($a, $b) => $b['_match']['score'] <=> $a['_match']['score']);
                    $pfCandidates = array_merge($pfCandidates, $extCandidates);
                    $pfIsDoubtful = true;
                    if ($pfSelected === null) {
                        $pfSelected = $extCandidates[0];
                    }
                }
            }
        }

        // --- 2. FANTACALCIO.IT MATCHING ---
        $fcSelected = null;
        $fcCandidates = [];
        $fcIsDoubtful = false;

        if (isset($existingAssoc[$codFCM]) && !empty($existingAssoc[$codFCM]['codFC']) && isset($fcById[$existingAssoc[$codFCM]['codFC']])) {
            $fcSelected = $fcById[$existingAssoc[$codFCM]['codFC']];
        } else {
            foreach ($fcList as $cand) {
                list($candSurname, , ) = assocGetNameParts($cand['nome']);
                $candSurnameNoSpace = str_replace(' ', '', $candSurname);
                $isSurnameMatch = ($candSurname === $surname) || (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);
                if ($isSurnameMatch) {
                    $fcCandidates[] = $cand;
                }
            }

            $sameTeam = array_values(array_filter($fcCandidates, fn($c) => assocNormTeam($c['squadra']) === $teamFCM));
            if (count($sameTeam) === 1) {
                $fcSelected = $sameTeam[0];
            } elseif (count($sameTeam) > 1) {
                $initMatch = array_values(array_filter($sameTeam, fn($c) => $initial !== '' && str_contains(assocCleanStr($c['nome']), $initial)));
                if (count($initMatch) === 1) {
                    $fcSelected = $initMatch[0];
                } else {
                    $fcIsDoubtful = true;
                }
            } elseif (!empty($fcCandidates)) {
                $fcIsDoubtful = true;
            }

            if ($fcSelected === null || $fcIsDoubtful || empty($fcCandidates) || count($sameTeam) !== 1) {
                $candIds = array_column($fcCandidates, 'id');
                $extCandidates = [];
                foreach ($fcList as $cand) {
                    if (in_array($cand['id'], $candIds)) continue;
                    $match = assocMatchPlayerExtended($p['nome'], $p['squadra'], $cand['nome'], $cand['squadra']);
                    if ($match) {
                        $cand['_match'] = $match;
                        $extCandidates[] = $cand;
                    }
                }
                if (!empty($extCandidates)) {
                    usort($extCandidates, fn($a, $b) => $b['_match']['score'] <=> $a['_match']['score']);
                    $fcCandidates = array_merge($fcCandidates, $extCandidates);
                    $fcIsDoubtful = true;
                    if ($fcSelected === null) {
                        $fcSelected = $extCandidates[0];
                    }
                }
            }
        }

        // --- 3. FANTAPAZZ MATCHING ---
        $fpSelected = null;
        $fpCandidates = [];
        $fpIsDoubtful = false;

        $existingFpName = isset($existingAssoc[$codFCM]['nomeFP']) ? trim($existingAssoc[$codFCM]['nomeFP']) : '';
        if ($existingFpName !== '' && isset($fpByName[assocCleanStr($existingFpName)])) {
            $fpSelected = $fpByName[assocCleanStr($existingFpName)];
        } else {
            foreach ($fpList as $cand) {
                $candName = $cand['calciatore'] ?? '';
                list($candSurname, , ) = assocGetNameParts($candName);
                $candSurnameNoSpace = str_replace(' ', '', $candSurname);
                $isSurnameMatch = ($candSurname === $surname) || (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);
                if ($isSurnameMatch) {
                    $fpCandidates[] = $cand;
                }
            }

            $sameTeam = array_values(array_filter($fpCandidates, fn($c) => assocNormTeam($c['squadra'] ?? '') === $teamFCM));
            if (count($sameTeam) === 1) {
                $fpSelected = $sameTeam[0];
            } elseif (count($sameTeam) > 1) {
                $initMatch = array_values(array_filter($sameTeam, fn($c) => $initial !== '' && str_contains(assocCleanStr($c['calciatore'] ?? ''), $initial)));
                if (count($initMatch) === 1) {
                    $fpSelected = $initMatch[0];
                } else {
                    $fpIsDoubtful = true;
                }
            } elseif (!empty($fpCandidates)) {
                $fpIsDoubtful = true;
            }

            if ($fpSelected === null && !empty($existingFpName)) {
                $fpSelected = [
                    'calciatore' => $existingFpName,
                    'squadra' => $p['squadra'],
                    'ruolo' => $p['ruolo'],
                    'quotazione' => ''
                ];
            }
        }

        // --- 4. FANTAMASTER MATCHING ---
        $fmSelected = null;
        $fmCandidates = [];
        $fmIsDoubtful = false;

        $existingFmId = isset($existingAssoc[$codFCM]['codFM']) ? (int)$existingAssoc[$codFCM]['codFM'] : 0;
        $existingFmName = isset($existingAssoc[$codFCM]['nomeFM']) ? trim($existingAssoc[$codFCM]['nomeFM']) : '';

        if ($existingFmId > 0 && isset($fmById[$existingFmId])) {
            $fmSelected = $fmById[$existingFmId];
        } elseif ($existingFmName !== '' && isset($fmByName[assocCleanStr($existingFmName)])) {
            $fmSelected = $fmByName[assocCleanStr($existingFmName)];
        } else {
            $manualMatch = null;
            if (isset($manualFMtoFCM_inv[$cleanFcmName])) {
                $fmKey = $manualFMtoFCM_inv[$cleanFcmName];
                if (isset($fmByName[assocCleanStr($fmKey)])) {
                    $manualMatch = $fmByName[assocCleanStr($fmKey)];
                }
            }

            if ($manualMatch) {
                $fmSelected = $manualMatch;
            } else {
                foreach ($fmList as $cand) {
                    $candName = $cand['name'] ?? '';
                    list($candSurname, , ) = assocGetNameParts($candName);
                    $candSurnameNoSpace = str_replace(' ', '', $candSurname);
                    $isSurnameMatch = ($candSurname === $surname) || (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);
                    if ($isSurnameMatch) {
                        $fmCandidates[] = $cand;
                    }
                }

                $sameTeam = array_values(array_filter($fmCandidates, fn($c) => assocNormTeam($c['team'] ?? '') === $teamFCM));
                if (count($sameTeam) === 1) {
                    $fmSelected = $sameTeam[0];
                } elseif (count($sameTeam) > 1) {
                    $initMatch = array_values(array_filter($sameTeam, fn($c) => $initial !== '' && str_contains(assocCleanStr($c['name'] ?? ''), $initial)));
                    if (count($initMatch) === 1) {
                        $fmSelected = $initMatch[0];
                    } else {
                        $fmIsDoubtful = true;
                    }
                } elseif (!empty($fmCandidates)) {
                    $fmIsDoubtful = true;
                }

                if ($fmSelected === null && ($existingFmId > 0 || $existingFmName !== '')) {
                    $fmSelected = [
                        'id' => $existingFmId,
                        'name' => $existingFmName,
                        'team' => $p['squadra'],
                        'role' => $p['ruolo']
                    ];
                }
            }
        }

        // Determinazione dello status complessivo
        $isDoubtful = ($pfIsDoubtful || $fcIsDoubtful || $fpIsDoubtful || $fmIsDoubtful);
        $hasAnyMatch = ($pfSelected !== null || $fcSelected !== null || $fpSelected !== null || $fmSelected !== null);

        $rowItem = [
            'player' => $p,
            'is_doubtful' => $isDoubtful,
            'pf_selected' => $pfSelected,
            'pf_candidates' => $pfCandidates,
            'fc_selected' => $fcSelected,
            'fc_candidates' => $fcCandidates,
            'fp_selected' => $fpSelected,
            'fp_candidates' => $fpCandidates,
            'fm_selected' => $fmSelected,
            'fm_candidates' => $fmCandidates,
            'status' => $isDoubtful ? 'dubbio' : ($hasAnyMatch ? 'confermato' : 'non_trovato')
        ];

        $all[] = $rowItem;
    }

    // PASS 2: UNICITÀ RIGOROSA 1-TO-1
    $pfUsage = [];
    $fcUsage = [];
    $fmUsage = [];
    foreach ($all as $idx => $r) {
        if (!empty($r['pf_selected']['cod'])) {
            $pfUsage[$r['pf_selected']['cod']][] = $idx;
        }
        if (!empty($r['fc_selected']['id'])) {
            $fcUsage[$r['fc_selected']['id']][] = $idx;
        }
        if (!empty($r['fm_selected']['id'])) {
            $fmUsage[$r['fm_selected']['id']][] = $idx;
        }
    }

    foreach ($pfUsage as $cod => $indices) {
        if (count($indices) > 1) {
            $ownerIdx = null;
            foreach ($indices as $i) {
                $pCod = $all[$i]['player']['codice'];
                if (isset($existingAssoc[$pCod]['codPF']) && (int)$existingAssoc[$pCod]['codPF'] === (int)$cod) {
                    $ownerIdx = $i;
                    break;
                }
            }
            if ($ownerIdx === null) {
                $ownerIdx = $indices[0];
            }
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['pf_conflict'] = true;
                if ($ownerIdx !== null && $i !== $ownerIdx) {
                    $all[$i]['pf_selected'] = null;
                }
            }
        }
    }

    foreach ($fcUsage as $id => $indices) {
        if (count($indices) > 1) {
            $ownerIdx = null;
            foreach ($indices as $i) {
                $pCod = $all[$i]['player']['codice'];
                if (isset($existingAssoc[$pCod]['codFC']) && (int)$existingAssoc[$pCod]['codFC'] === (int)$id) {
                    $ownerIdx = $i;
                    break;
                }
            }
            if ($ownerIdx === null) {
                $ownerIdx = $indices[0];
            }
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['fc_conflict'] = true;
                if ($ownerIdx !== null && $i !== $ownerIdx) {
                    $all[$i]['fc_selected'] = null;
                }
            }
        }
    }

    foreach ($fmUsage as $id => $indices) {
        if (count($indices) > 1) {
            $ownerIdx = null;
            foreach ($indices as $i) {
                $pCod = $all[$i]['player']['codice'];
                if (isset($existingAssoc[$pCod]['codFM']) && (int)$existingAssoc[$pCod]['codFM'] === (int)$id) {
                    $ownerIdx = $i;
                    break;
                }
            }
            if ($ownerIdx === null) {
                $ownerIdx = $indices[0];
            }
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['fm_conflict'] = true;
                if ($ownerIdx !== null && $i !== $ownerIdx) {
                    $all[$i]['fm_selected'] = null;
                }
            }
        }
    }

    // Controllo unicità su Fantapazz per nome
    $fpUsage = [];
    foreach ($all as $idx => $r) {
        $fpName = $r['fp_selected']['calciatore'] ?? ($r['fp_selected']['nome'] ?? '');
        if (!empty($fpName)) {
            $fpUsage[assocCleanStr($fpName)][] = $idx;
        }
    }
    foreach ($fpUsage as $fpClean => $indices) {
        if (count($indices) > 1) {
            $ownerIdx = null;
            foreach ($indices as $i) {
                $pCod = $all[$i]['player']['codice'];
                if (isset($existingAssoc[$pCod]['nomeFP']) && assocCleanStr($existingAssoc[$pCod]['nomeFP']) === $fpClean) {
                    $ownerIdx = $i;
                    break;
                }
            }
            if ($ownerIdx === null) {
                $ownerIdx = $indices[0];
            }
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['fp_conflict'] = true;
                if ($ownerIdx !== null && $i !== $ownerIdx) {
                    $all[$i]['fp_selected'] = null;
                }
            }
        }
    }

    // Calcolo liste dei giocatori NON ancora assegnati per le 4 fonti
    $assignedPfCods = [];
    $assignedFcIds = [];
    $assignedFpNames = [];
    $assignedFmIds = [];

    $pfMatched = 0; $fcMatched = 0; $fpMatched = 0; $fmMatched = 0;
    foreach ($all as $r) {
        if (!empty($r['pf_selected']['cod'])) {
            $assignedPfCods[$r['pf_selected']['cod']] = true;
            $pfMatched++;
        }
        if (!empty($r['fc_selected']['id'])) {
            $assignedFcIds[$r['fc_selected']['id']] = true;
            $fcMatched++;
        }
        if (!empty($r['fp_selected']['calciatore'])) {
            $assignedFpNames[assocCleanStr($r['fp_selected']['calciatore'])] = true;
            $fpMatched++;
        }
        if (!empty($r['fm_selected']['id'])) {
            $assignedFmIds[(int)$r['fm_selected']['id']] = true;
            $fmMatched++;
        }
    }

    $unassignedPf = [];
    foreach ($pfList as $p) {
        if (!isset($assignedPfCods[$p['cod']])) {
            $unassignedPf[] = [
                'cod' => $p['cod'],
                'nome' => $p['nome'],
                'squadra' => $p['squadra'],
                'ruolo' => $p['ruolo']
            ];
        }
    }
    usort($unassignedPf, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

    $unassignedFc = [];
    foreach ($fcList as $p) {
        if (!isset($assignedFcIds[$p['id']])) {
            $unassignedFc[] = [
                'id' => $p['id'],
                'nome' => $p['nome'],
                'squadra' => $p['squadra'],
                'ruolo' => $p['ruolo']
            ];
        }
    }
    usort($unassignedFc, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

    $unassignedFp = [];
    foreach ($fpList as $p) {
        $cName = assocCleanStr($p['calciatore'] ?? '');
        if ($cName !== '' && !isset($assignedFpNames[$cName])) {
            $unassignedFp[] = [
                'cod' => $p['quotazione'] ?? '',
                'nome' => $p['calciatore'] ?? '',
                'squadra' => $p['squadra'] ?? '',
                'ruolo' => $p['ruolo'] ?? ''
            ];
        }
    }
    usort($unassignedFp, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

    $unassignedFm = [];
    foreach ($fmList as $p) {
        $fmId = (int)($p['id'] ?? 0);
        if ($fmId > 0 && !isset($assignedFmIds[$fmId])) {
            $unassignedFm[] = [
                'id' => $fmId,
                'nome' => $p['name'] ?? '',
                'squadra' => $p['team'] ?? '',
                'ruolo' => $p['role'] ?? ''
            ];
        }
    }
    usort($unassignedFm, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

    // Ordine: RUOLO poi ALFABETICO
    $roleOrder = ['P' => 1, 'D' => 2, 'C' => 3, 'A' => 4];
    $sortFn = function($a, $b) use ($roleOrder) {
        $rA = isset($roleOrder[$a['player']['ruolo']]) ? $roleOrder[$a['player']['ruolo']] : 99;
        $rB = isset($roleOrder[$b['player']['ruolo']]) ? $roleOrder[$b['player']['ruolo']] : 99;
        if ($rA !== $rB) return $rA <=> $rB;
        return strcasecmp($a['player']['nome'], $b['player']['nome']);
    };
    usort($all, $sortFn);

    $confirmed = [];
    $doubtful = [];
    $notFound = [];
    foreach ($all as $item) {
        if ($item['status'] === 'dubbio') {
            $doubtful[] = $item;
        } elseif ($item['status'] === 'confermato') {
            $confirmed[] = $item;
        } else {
            $notFound[] = $item;
        }
    }
    usort($confirmed, $sortFn);
    usort($doubtful, $sortFn);
    usort($notFound, $sortFn);

    return [
        'confirmed' => $confirmed,
        'doubtful' => $doubtful,
        'not_found' => $notFound,
        'all' => $all,
        'unassigned_pf' => $unassignedPf,
        'unassigned_fc' => $unassignedFc,
        'unassigned_fp' => $unassignedFp,
        'unassigned_fm' => $unassignedFm,
        'stats' => [
            'total_fcm' => count($fcmPlayers),
            'total_fcm_serie_a' => count($fcmPlayers),
            'confirmed' => count($confirmed),
            'doubtful' => count($doubtful),
            'not_found' => count($notFound),
            'pf_matched' => $pfMatched,
            'fc_matched' => $fcMatched,
            'fp_matched' => $fpMatched,
            'fm_matched' => $fmMatched,
            'pf_count' => count($pfList),
            'fc_count' => count($fcList),
            'fp_count' => count($fpList),
            'fm_count' => count($fmList)
        ]
    ];
}

/**
 * Scrittura del file inc/data/liveVU_associazioni.php ordinato prioritariamente per ruolo (P, D, C, A) e poi alfabeticamente per nome FCM.
 */
function saveAssociazioniFiles($associations, $baseDir) {
    // 1. Ordina per ruolo (P, D, C, A) e poi alfabeticamente puro per nome FCM
    $roleOrder = ['P' => 1, 'D' => 2, 'C' => 3, 'A' => 4];
    usort($associations, function($a, $b) use ($roleOrder) {
        $rA = isset($a['player']['ruolo']) ? $a['player']['ruolo'] : (isset($a['ruolo']) ? $a['ruolo'] : '');
        $rB = isset($b['player']['ruolo']) ? $b['player']['ruolo'] : (isset($b['ruolo']) ? $b['ruolo'] : '');
        $ordA = isset($roleOrder[$rA]) ? $roleOrder[$rA] : 99;
        $ordB = isset($roleOrder[$rB]) ? $roleOrder[$rB] : 99;
        if ($ordA !== $ordB) {
            return $ordA <=> $ordB;
        }
        $nA = isset($a['nomeFCM']) ? $a['nomeFCM'] : (isset($a['player']['nome']) ? $a['player']['nome'] : '');
        $nB = isset($b['nomeFCM']) ? $b['nomeFCM'] : (isset($b['player']['nome']) ? $b['player']['nome'] : '');
        return strcasecmp($nA, $nB);
    });

    $targetIncPhp = $baseDir . '/inc/data/liveVU_associazioni.php';

    // Validazione unicità: nessun codPF, nessun codFC e nessun codFM può essere assegnato a più giocatori FCM
    $seenPf = [];
    $seenFc = [];
    $seenFm = [];
    foreach ($associations as $item) {
        $codPF = isset($item['codPF']) ? $item['codPF'] : (isset($item['pf_selected']['cod']) ? $item['pf_selected']['cod'] : '');
        $codFC = isset($item['codFC']) ? $item['codFC'] : (isset($item['fc_selected']['id']) ? $item['fc_selected']['id'] : '');
        $codFM = isset($item['codFM']) ? $item['codFM'] : (isset($item['fm_selected']['id']) ? $item['fm_selected']['id'] : '');
        $nomeFCM = isset($item['nomeFCM']) ? $item['nomeFCM'] : (isset($item['player']['nome']) ? $item['player']['nome'] : '');
        $nomePF = isset($item['nomePF']) ? $item['nomePF'] : (isset($item['pf_selected']['nome']) ? $item['pf_selected']['nome'] : '');
        $nomeFC = isset($item['nomeFC']) ? $item['nomeFC'] : (isset($item['fc_selected']['nome']) ? $item['fc_selected']['nome'] : '');
        $nomeFM = isset($item['nomeFM']) ? $item['nomeFM'] : (isset($item['fm_selected']['name']) ? $item['fm_selected']['name'] : '');

        if (!empty($codPF) && is_numeric($codPF)) {
            $c = (int)$codPF;
            if (isset($seenPf[$c]) && strcasecmp($seenPf[$c], $nomeFCM) !== 0) {
                throw new Exception("Assegnazione duplicata per Pianetafanta: il calciatore '{$nomePF}' (Cod: {$c}) è assegnato sia a '{$seenPf[$c]}' sia a '{$nomeFCM}'. Risolvi il conflitto prima di salvare.");
            }
            $seenPf[$c] = $nomeFCM;
        }

        if (!empty($codFC) && is_numeric($codFC)) {
            $c = (int)$codFC;
            if (isset($seenFc[$c]) && strcasecmp($seenFc[$c], $nomeFCM) !== 0) {
                throw new Exception("Assegnazione duplicata per Fantacalcio.it: il calciatore '{$nomeFC}' (ID: {$c}) è assegnato sia a '{$seenFc[$c]}' sia a '{$nomeFCM}'. Risolvi il conflitto prima di salvare.");
            }
            $seenFc[$c] = $nomeFCM;
        }

        if (!empty($codFM) && is_numeric($codFM)) {
            $c = (int)$codFM;
            if (isset($seenFm[$c]) && strcasecmp($seenFm[$c], $nomeFCM) !== 0) {
                throw new Exception("Assegnazione duplicata per FantaMaster: il calciatore '{$nomeFM}' (ID: {$c}) è assegnato sia a '{$seenFm[$c]}' sia a '{$nomeFCM}'. Risolvi il conflitto prima di salvare.");
            }
            $seenFm[$c] = $nomeFCM;
        }
    }

    // Generazione contenuto PHP
    $phpContent = "<?php\n\n";
    $phpContent .= "// Array per associare il nome e i codici del giocatore su Pianetafanta, Fantacalcio.it, Fantapazz e FantaMaster con il nome e i codici in FCM\n";
    $phpContent .= "// \$arrAssociazioni[0]=array(codice Pianetafanta,\"nome Pianetafanta\",codice Fantacalcio.it,\"nome Fantacalcio.it\",codice FCM,\"nome FCM\",id FCM,\"nome Fantapazz\",codice FantaMaster,\"nome FantaMaster\");\n\n";

    $idx = 1;
    foreach ($associations as $item) {
        $codPF = isset($item['codPF']) ? $item['codPF'] : (isset($item['pf_selected']['cod']) ? $item['pf_selected']['cod'] : '');
        $nomePF = isset($item['nomePF']) ? $item['nomePF'] : (isset($item['pf_selected']['nome']) ? $item['pf_selected']['nome'] : '');

        $codFC = isset($item['codFC']) ? $item['codFC'] : (isset($item['fc_selected']['id']) ? $item['fc_selected']['id'] : '');
        $nomeFC = isset($item['nomeFC']) ? $item['nomeFC'] : (isset($item['fc_selected']['nome']) ? $item['fc_selected']['nome'] : '');

        $codFCM = isset($item['codFCM']) ? $item['codFCM'] : (isset($item['player']['codice']) ? $item['player']['codice'] : 0);
        $nomeFCM = isset($item['nomeFCM']) ? $item['nomeFCM'] : (isset($item['player']['nome']) ? $item['player']['nome'] : '');
        $idFCM = isset($item['idFCM']) ? $item['idFCM'] : (isset($item['player']['id']) ? $item['player']['id'] : 0);

        $nomeFP = isset($item['nomeFP']) ? $item['nomeFP'] : (isset($item['fp_selected']['nome']) ? $item['fp_selected']['nome'] : '');

        $codFM = isset($item['codFM']) ? $item['codFM'] : (isset($item['fm_selected']['id']) ? $item['fm_selected']['id'] : '');
        $nomeFM = isset($item['nomeFM']) ? $item['nomeFM'] : (isset($item['fm_selected']['name']) ? $item['fm_selected']['name'] : '');

        // Formattazione valori riga PHP
        $valCodPF = (!empty($codPF) && is_numeric($codPF)) ? (int)$codPF : '""';
        $valNomePF = !empty($nomePF) ? '"' . addcslashes($nomePF, '"\\') . '"' : '""';

        $valCodFC = (!empty($codFC) && is_numeric($codFC)) ? (int)$codFC : '""';
        $valNomeFC = !empty($nomeFC) ? '"' . addcslashes($nomeFC, '"\\') . '"' : '""';

        $valCodFCM = (int)$codFCM;
        $valNomeFCM = '"' . addcslashes($nomeFCM, '"\\') . '"';
        $valIdFCM = (int)$idFCM;

        $valNomeFP = !empty($nomeFP) ? '"' . addcslashes($nomeFP, '"\\') . '"' : '""';

        $valCodFM = (!empty($codFM) && is_numeric($codFM)) ? (int)$codFM : (!empty($codFM) ? '"' . addcslashes($codFM, '"\\') . '"' : '""');
        $valNomeFM = !empty($nomeFM) ? '"' . addcslashes($nomeFM, '"\\') . '"' : '""';

        $phpContent .= "\$arrAssociazioni[{$idx}]=array({$valCodPF},{$valNomePF},{$valCodFC},{$valNomeFC},{$valCodFCM},{$valNomeFCM},{$valIdFCM},{$valNomeFP},{$valCodFM},{$valNomeFM});\n";
        $idx++;
    }

    $phpContent .= "\n?>\n";

    // Scrittura atomica esclusiva su inc/data/liveVU_associazioni.php
    if (!fcm_write_file_atomic($targetIncPhp, $phpContent, 0644)) {
        throw new Exception("Impossibile salvare il file inc/data/liveVU_associazioni.php. Verificare i permessi di scrittura nella cartella inc/data/.");
    }
    $writtenPhp = strlen($phpContent);

    // Rimuove eventuale file js/fcmVotiAssociazioni.js obsoleto
    $legacyJs = $baseDir . '/js/fcmVotiAssociazioni.js';
    if (file_exists($legacyJs)) {
        @unlink($legacyJs);
    }

    return [
        'count' => count($associations),
        'bytes_php' => $writtenPhp,
        'updated' => date('d/m/Y H:i:s')
    ];
}

/**
 * Scarica l'elenco ufficiale dei calciatori di Serie A con statistiche e ID da FantaMaster.
 */
function fetchFantamasterPlayersOnline($baseDir) {
    $url = 'https://apicdn.fantamaster.it/playersstats/';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_USERAGENT, 'ModernFCM/3.0');
    fcm_apply_curl_ssl($ch);
    curl_setopt($ch, CURLOPT_ENCODING, '');
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code !== 200 || empty($res)) {
        throw new Exception("Download quotazioni FantaMaster non riuscito (HTTP $code).");
    }
    $data = json_decode($res, true);
    $players = isset($data['players']) ? $data['players'] : [];
    if (empty($players)) {
        throw new Exception("Nessun calciatore trovato nel JSON di FantaMaster.");
    }
    return [
        'count' => count($players),
        'players' => $players,
        'bytes' => strlen($res)
    ];
}

/**
 * Salva un file JSON di cache provando prima in inc/data/, poi tests/, poi temp.
 */
function saveAssocCacheJson($baseDir, $name, $data) {
    $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $candidates = [
        $baseDir . '/inc/data/' . $name,
        $baseDir . '/tests/' . $name,
        sys_get_temp_dir() . '/' . $name
    ];
    foreach ($candidates as $target) {
        $dir = dirname($target);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (@file_put_contents($target, $content) !== false) {
            return $target;
        }
    }
    return null;
}

/**
 * Carica un file JSON di cache provando in inc/data/, tests/, temp.
 */
function loadAssocCacheJson($baseDir, $name) {
    $candidates = [
        $baseDir . '/inc/data/' . $name,
        $baseDir . '/tests/' . $name,
        sys_get_temp_dir() . '/' . $name
    ];
    foreach ($candidates as $target) {
        if (file_exists($target)) {
            $data = json_decode(@file_get_contents($target), true);
            if (is_array($data) && !empty($data)) {
                return $data;
            }
        }
    }
    return [];
}

/**
 * Scarica automaticamente le quotazioni aggiornate di tutti i giocatori da Pianetafanta.it via API.
 */
function fetchPianetafantaPlayersOnline($baseDir) {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    $referer = 'https://pianetafanta.it/quotazioni-fantacalcio';

    // 1. Recupero impostazioni e giornata di default
    $ch = curl_init('https://pianetafanta.it/api/quotazioni?soloSettings=1');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERAGENT => $ua,
        CURLOPT_HTTPHEADER => [
            'Referer: ' . $referer,
            'Accept: application/json, text/plain, */*'
        ],
        CURLOPT_TIMEOUT => 20,
    ]);
    fcm_apply_curl_ssl($ch);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code !== 200 || !$raw) {
        throw new Exception("Errore durante il recupero dei settings da Pianetafanta.it (HTTP $code).");
    }
    $settings = json_decode($raw, true);
    if (!$settings || !isset($settings['giornataDefault'])) {
        throw new Exception("Risposta settings non valida da Pianetafanta.it.");
    }
    $giornata = (int)$settings['giornataDefault'];

    // 2. Download listone completo di tutti i calciatori Serie A (tutti i ruoli)
    $url = "https://pianetafanta.it/api/quotazioni?testata=0&giornata={$giornata}&ord=Quota&dir=DESC";
    curl_setopt($ch, CURLOPT_URL, $url);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code !== 200 || !$raw) {
        throw new Exception("Errore durante il download delle quotazioni da Pianetafanta.it (HTTP $code).");
    }
    $data = json_decode($raw, true);
    if (!isset($data['giocatori']) || !is_array($data['giocatori'])) {
        throw new Exception("Formato dati quotazioni non valido ricevuto da Pianetafanta.it.");
    }

    $pfList = [];
    foreach ($data['giocatori'] as $g) {
        if (!empty($g['CodGiocatore'])) {
            $pfList[] = [
                'cod' => (int)$g['CodGiocatore'],
                'ruolo' => strtoupper(trim($g['Ruolo'] ?? '')),
                'nome' => trim($g['Nome'] ?? ''),
                'squadra' => trim($g['Squadra'] ?? '')
            ];
        }
    }

    // Salva in cache (inc/data/ o tests/) per persistenza
    saveAssocCacheJson($baseDir, 'latest_pf.json', $pfList);

    return [
        'success' => true,
        'giornata' => $giornata,
        'count' => count($pfList),
        'list' => $pfList
    ];
}

/**
 * Scarica automaticamente le quotazioni aggiornate dei giocatori da Fantacalcio.it.
 * Estrazione diretta in chiaro dalla pagina pubblica https://www.fantacalcio.it/quotazioni-fantacalcio (senza login).
 */
function fetchFantacalcioPlayersOnline($baseDir) {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    $ch = curl_init('https://www.fantacalcio.it/quotazioni-fantacalcio');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERAGENT => $ua,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => true
    ]);
    fcm_apply_curl_ssl($ch);
    $html = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code !== 200 || !$html) {
        throw new Exception("Impossibile connettersi alla pagina quotazioni di Fantacalcio.it (HTTP $code).");
    }

    // Estrazione mappa squadre da <select id="team">
    $teamMap = [];
    if (preg_match('/<select[^>]*id=["\']team["\'][^>]*>(.*?)<\/select>/is', $html, $m)) {
        if (preg_match_all('/<option\s+value=["\'](\d+)["\']>([^<]+)<\/option>/i', $m[1], $opts, PREG_SET_ORDER)) {
            foreach ($opts as $opt) {
                $teamMap[(int)$opt[1]] = trim($opt[2]);
            }
        }
    }

    // Estrazione righe calciatori player-row
    $pattern = '/<tr\s+class=["\']player-row["\'][^>]*data-filter-team-id=["\'](\d+)["\'][^>]*data-filter-role-classic=["\']([a-z])["\'][^>]*>.*?<a\s+class=["\']player-name\s+player-link["\'][^>]*href=["\'][^"\']*\/(\d+)["\'][^>]*>\s*<span>(.*?)<\/span>.*?<\/tr>/is';

    preg_match_all($pattern, $html, $matches, PREG_SET_ORDER);
    if (empty($matches)) {
        throw new Exception("Nessun calciatore trovato nella pagina quotazioni di Fantacalcio.it. La struttura della pagina potrebbe essere cambiata.");
    }

    $fcList = [];
    foreach ($matches as $row) {
        $teamId = (int)$row[1];
        $role = strtoupper($row[2]);
        $playerId = (int)$row[3];
        $playerName = trim(html_entity_decode($row[4], ENT_QUOTES, 'UTF-8'));
        $teamName = isset($teamMap[$teamId]) ? $teamMap[$teamId] : 'Team_' . $teamId;

        $fcList[] = [
            'id' => $playerId,
            'ruolo' => $role,
            'nome' => $playerName,
            'squadra' => $teamName
        ];
    }

    // Salva in cache (inc/data/ o tests/)
    saveAssocCacheJson($baseDir, 'latest_fc.json', $fcList);

    return [
        'success' => true,
        'source' => 'public_page',
        'count' => count($fcList),
        'list' => $fcList
    ];
}

/**
 * Controller per le richieste AJAX del modulo associazioni.
 */
function handleAssocAjaxRequests($baseDir, $isAdminLogged) {
    if (!isset($_REQUEST['assoc_action'])) {
        return;
    }

    header('Content-Type: application/json; charset=utf-8');

    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }

    $action = $_REQUEST['assoc_action'];
    $mutatingAssocActions = [
        'download_pf',
        'download_fc',
        'download_fp',
        'download_fm',
        'download_all',
        'download_and_analyze',
        'analyze_files',
        'save_associations'
    ];
    if (in_array($action, $mutatingAssocActions, true)) {
        fcm_require_post();
        fcm_require_csrf();
    }

    try {
        switch ($action) {
            case 'download_pf':
                $res = fetchPianetafantaPlayersOnline($baseDir);
                $_SESSION['pn_assoc_pf_list'] = $res['list'];
                echo json_encode([
                    'success' => true,
                    'count' => $res['count'],
                    'giornata' => $res['giornata'],
                    'message' => "Scaricati con successo {$res['count']} giocatori da Pianetafanta.it (Giornata {$res['giornata']})."
                ]);
                break;

            case 'download_fc':
                $res = fetchFantacalcioPlayersOnline($baseDir);
                $_SESSION['pn_assoc_fc_list'] = $res['list'];
                echo json_encode([
                    'success' => true,
                    'count' => $res['count'],
                    'source' => 'public_page',
                    'message' => "Scaricati con successo {$res['count']} giocatori da Fantacalcio.it (pagina pubblica)."
                ]);
                break;

            case 'download_fp':
                $res = fetchFantapazzCsvOnline($baseDir);
                echo json_encode([
                    'success' => true,
                    'count' => $res['count'],
                    'bytes' => $res['bytes'],
                    'message' => "Scaricati con successo {$res['count']} giocatori dal Listone Fantapazz.com."
                ]);
                break;

            case 'download_fm':
                $res = fetchFantamasterPlayersOnline($baseDir);
                saveAssocCacheJson($baseDir, 'latest_fm.json', $res['players']);
                $_SESSION['pn_assoc_fm_players'] = $res['players'];
                echo json_encode([
                    'success' => true,
                    'count' => $res['count'],
                    'bytes' => $res['bytes'],
                    'message' => "Scaricati con successo {$res['count']} giocatori da FantaMaster."
                ]);
                break;

            case 'download_all':
                $allRes = fetchAllSourcesOnline($baseDir);
                echo json_encode([
                    'success' => true,
                    'pf_count' => $allRes['pf_count'],
                    'fc_count' => $allRes['fc_count'],
                    'fp_count' => $allRes['fp_count'],
                    'fm_count' => $allRes['fm_count'],
                    'updated' => $allRes['updated'],
                    'message' => "Download completato con successo da tutte e 4 le fonti: {$allRes['pf_count']} Pianetafanta, {$allRes['fc_count']} Fantacalcio, {$allRes['fp_count']} Fantapazz, {$allRes['fm_count']} FantaMaster."
                ]);
                break;

            case 'download_and_analyze':
                $allRes = fetchAllSourcesOnline($baseDir);

                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = loadCurrentLiveVUAssociazioni($baseDir);

                $matchResult = runAssociationMatching(
                    $fcmPlayers,
                    $allRes['pf']['list'],
                    $allRes['fc']['list'],
                    $existingAssoc,
                    $allRes['fp']['players'],
                    $allRes['fm']['players']
                );

                echo json_encode([
                    'success' => true,
                    'stats' => $matchResult['stats'],
                    'doubtful' => $matchResult['doubtful'],
                    'confirmed' => $matchResult['confirmed'],
                    'not_found' => $matchResult['not_found'],
                    'all' => $matchResult['all'],
                    'unassigned_pf' => $matchResult['unassigned_pf'],
                    'unassigned_fc' => $matchResult['unassigned_fc'],
                    'unassigned_fp' => $matchResult['unassigned_fp'],
                    'unassigned_fm' => $matchResult['unassigned_fm'],
                    'pf_count' => $allRes['pf_count'],
                    'fc_count' => $allRes['fc_count'],
                    'fp_count' => $allRes['fp_count'],
                    'fm_count' => $allRes['fm_count'],
                    'message' => "Download ed elaborazione completati con successo per tutte e 4 le fonti!"
                ]);
                break;

            case 'analyze_files':
                $useDownloaded = !empty($_POST['use_downloaded']);
                $pfList = [];
                $fcList = [];
                $fpList = [];
                $fmList = [];

                if ($useDownloaded || (empty($_FILES['excel_pf']['tmp_name']) && empty($_FILES['excel_fc']['tmp_name']))) {
                    $pfList = !empty($_SESSION['pn_assoc_pf_list']) ? $_SESSION['pn_assoc_pf_list'] : loadAssocCacheJson($baseDir, 'latest_pf.json');
                    $fcList = !empty($_SESSION['pn_assoc_fc_list']) ? $_SESSION['pn_assoc_fc_list'] : loadAssocCacheJson($baseDir, 'latest_fc.json');
                    $fpList = !empty($_SESSION['pn_assoc_fp_players']) ? $_SESSION['pn_assoc_fp_players'] : loadAssocCacheJson($baseDir, 'latest_fp.json');
                    $fmList = !empty($_SESSION['pn_assoc_fm_players']) ? $_SESSION['pn_assoc_fm_players'] : loadAssocCacheJson($baseDir, 'latest_fm.json');

                    if (empty($pfList) || empty($fcList)) {
                        throw new Exception("Dati non disponibili. Seleziona i file oppure scarica le quotazioni online.");
                    }
                } else {
                    if (empty($_FILES['excel_pf']['tmp_name']) || empty($_FILES['excel_fc']['tmp_name'])) {
                        throw new Exception("È necessario selezionare almeno i file di Pianetafanta e Fantacalcio.it.");
                    }

                    $pfRows = parseXlsxCellsUniversal($_FILES['excel_pf']['tmp_name']);
                    $fcRows = parseXlsxCellsUniversal($_FILES['excel_fc']['tmp_name']);

                    for ($i = 1; $i < count($pfRows); $i++) {
                        $r = $pfRows[$i];
                        if (count($r) > 4 && is_numeric($r[0])) {
                            $pfList[] = ['cod' => (int)$r[0], 'ruolo' => trim($r[1]), 'nome' => trim($r[3]), 'squadra' => trim($r[4])];
                        }
                    }

                    for ($i = 2; $i < count($fcRows); $i++) {
                        $r = $fcRows[$i];
                        if (count($r) > 4 && is_numeric($r[0])) {
                            $fcList[] = ['id' => (int)$r[0], 'ruolo' => trim($r[1]), 'nome' => trim($r[3]), 'squadra' => trim($r[4])];
                        }
                    }

                    if (!empty($_FILES['file_fp']['tmp_name'])) {
                        try {
                            $fpList = parseFantapazzCsv($_FILES['file_fp']['tmp_name']);
                        } catch (Exception $e) {}
                    }
                    if (empty($fpList)) {
                        $fpList = loadAssocCacheJson($baseDir, 'latest_fp.json');
                    }

                    if (!empty($_FILES['file_fm']['tmp_name'])) {
                        try {
                            $fmRaw = @file_get_contents($_FILES['file_fm']['tmp_name']);
                            $fmDec = json_decode($fmRaw, true);
                            if (is_array($fmDec)) {
                                $fmList = [];
                                foreach ($fmDec as $it) {
                                    if (isset($it['id']) && isset($it['name'])) {
                                        $fmList[] = [
                                            'id' => (int)$it['id'],
                                            'name' => trim($it['name']),
                                            'team' => trim($it['team'] ?? ($it['squadra'] ?? '')),
                                            'role' => trim($it['role'] ?? ($it['ruolo'] ?? ''))
                                        ];
                                    }
                                }
                            }
                        } catch (Exception $e) {}
                    }
                    if (empty($fmList)) {
                        $fmList = loadAssocCacheJson($baseDir, 'latest_fm.json');
                    }

                    saveAssocCacheJson($baseDir, 'latest_pf.json', $pfList);
                    saveAssocCacheJson($baseDir, 'latest_fc.json', $fcList);
                }

                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = loadCurrentLiveVUAssociazioni($baseDir);

                $matchResult = runAssociationMatching($fcmPlayers, $pfList, $fcList, $existingAssoc, $fpList, $fmList);

                echo json_encode([
                    'success' => true,
                    'stats' => $matchResult['stats'],
                    'doubtful' => $matchResult['doubtful'],
                    'confirmed' => $matchResult['confirmed'],
                    'not_found' => $matchResult['not_found'],
                    'all' => $matchResult['all'],
                    'unassigned_pf' => $matchResult['unassigned_pf'],
                    'unassigned_fc' => $matchResult['unassigned_fc'],
                    'unassigned_fp' => $matchResult['unassigned_fp'],
                    'unassigned_fm' => $matchResult['unassigned_fm'],
                    'pf_count' => count($pfList),
                    'fc_count' => count($fcList),
                    'fp_count' => count($fpList),
                    'fm_count' => count($fmList)
                ]);
                break;

            case 'get_current_state':
                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = loadCurrentLiveVUAssociazioni($baseDir);

                $items = [];
                $hasHistorical = 0;
                $pfMatched = 0; $fcMatched = 0; $fpMatched = 0; $fmMatched = 0;

                foreach ($fcmPlayers as $p) {
                    $cod = $p['codice'];
                    $assoc = isset($existingAssoc[$cod]) ? $existingAssoc[$cod] : null;
                    if ($assoc) $hasHistorical++;

                    $codPF = $assoc ? $assoc['codPF'] : '';
                    $nomePF = $assoc ? $assoc['nomePF'] : '';
                    $codFC = $assoc ? $assoc['codFC'] : '';
                    $nomeFC = $assoc ? $assoc['nomeFC'] : '';
                    $nomeFP = $assoc ? $assoc['nomeFP'] : '';
                    $codFM = $assoc ? $assoc['codFM'] : '';
                    $nomeFM = $assoc ? $assoc['nomeFM'] : '';

                    if (!empty($codPF)) $pfMatched++;
                    if (!empty($codFC)) $fcMatched++;
                    if (!empty($nomeFP)) $fpMatched++;
                    if (!empty($codFM) || !empty($nomeFM)) $fmMatched++;

                    $items[] = [
                        'player' => $p,
                        'codPF' => $codPF,
                        'nomePF' => $nomePF,
                        'codFC' => $codFC,
                        'nomeFC' => $nomeFC,
                        'nomeFP' => $nomeFP,
                        'codFM' => $codFM,
                        'nomeFM' => $nomeFM,
                        'codFCM' => $p['codice'],
                        'nomeFCM' => $p['nome'],
                        'idFCM' => $p['id'],
                        'has_assoc' => ($assoc && (!empty($codPF) || !empty($codFC) || !empty($nomeFP) || !empty($nomeFM)))
                    ];
                }

                // Carica liste non assegnati
                $unassignedPf = [];
                $unassignedFc = [];
                $unassignedFp = [];
                $unassignedFm = [];

                $pfList = loadAssocCacheJson($baseDir, 'latest_pf.json');
                $fcList = loadAssocCacheJson($baseDir, 'latest_fc.json');
                $fpList = loadAssocCacheJson($baseDir, 'latest_fp.json');
                $fmList = loadAssocCacheJson($baseDir, 'latest_fm.json');

                if (!is_array($pfList)) $pfList = [];
                if (!is_array($fcList)) $fcList = [];
                if (!is_array($fpList)) $fpList = [];
                if (!is_array($fmList)) $fmList = [];

                $assignedPfCods = [];
                $assignedFcIds = [];
                $assignedFpNames = [];
                $assignedFmIds = [];

                foreach ($items as $it) {
                    if (!empty($it['codPF'])) $assignedPfCods[(int)$it['codPF']] = true;
                    if (!empty($it['codFC'])) $assignedFcIds[(int)$it['codFC']] = true;
                    if (!empty($it['nomeFP'])) $assignedFpNames[assocCleanStr($it['nomeFP'])] = true;
                    if (!empty($it['codFM'])) $assignedFmIds[(int)$it['codFM']] = true;
                }

                foreach ($pfList as $p) {
                    if (!isset($assignedPfCods[(int)$p['cod']])) $unassignedPf[] = $p;
                }
                foreach ($fcList as $p) {
                    if (!isset($assignedFcIds[(int)$p['id']])) $unassignedFc[] = $p;
                }
                foreach ($fpList as $p) {
                    $cName = assocCleanStr($p['calciatore'] ?? '');
                    if ($cName !== '' && !isset($assignedFpNames[$cName])) {
                        $unassignedFp[] = ['cod' => $p['quotazione'] ?? '', 'nome' => $p['calciatore'] ?? '', 'squadra' => $p['squadra'] ?? '', 'ruolo' => $p['ruolo'] ?? ''];
                    }
                }
                foreach ($fmList as $p) {
                    $fmId = (int)($p['id'] ?? 0);
                    if ($fmId > 0 && !isset($assignedFmIds[$fmId])) {
                        $unassignedFm[] = ['id' => $fmId, 'nome' => $p['name'] ?? '', 'squadra' => $p['team'] ?? '', 'ruolo' => $p['role'] ?? ''];
                    }
                }

                usort($unassignedPf, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
                usort($unassignedFc, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
                usort($unassignedFp, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
                usort($unassignedFm, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

                echo json_encode([
                    'success' => true,
                    'total_fcm' => count($fcmPlayers),
                    'associated_count' => $hasHistorical,
                    'pf_matched' => $pfMatched,
                    'fc_matched' => $fcMatched,
                    'fp_matched' => $fpMatched,
                    'fm_matched' => $fmMatched,
                    'items' => $items,
                    'unassigned_pf' => $unassignedPf,
                    'unassigned_fc' => $unassignedFc,
                    'unassigned_fp' => $unassignedFp,
                    'unassigned_fm' => $unassignedFm,
                    'last_file_update' => file_exists($baseDir . '/inc/data/liveVU_associazioni.php') ? date('d/m/Y H:i', filemtime($baseDir . '/inc/data/liveVU_associazioni.php')) : 'N/D'
                ]);
                break;

            case 'save_associations':
                $rawJson = isset($_POST['associations_json']) ? $_POST['associations_json'] : '';
                if (empty($rawJson)) {
                    throw new Exception("Nessun dato di associazione ricevuto per il salvataggio.");
                }

                $data = json_decode($rawJson, true);
                if (!is_array($data) || empty($data)) {
                    throw new Exception("Formato dati non valido.");
                }

                $res = saveAssociazioniFiles($data, $baseDir);

                echo json_encode([
                    'success' => true,
                    'message' => 'File inc/data/liveVU_associazioni.php salvato con successo!',
                    'count' => $res['count'],
                    'updated' => $res['updated']
                ]);
                break;

            default:
                throw new Exception("Azione non riconosciuta: " . htmlspecialchars($action));
        }
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}
