<?php
/**
 * ModernFCM - Gestore Associazioni Live (Pianetafanta / Fantacalcio.it / FCM)
 * File: liveVU_associazioni_manager.inc.php
 * 
 * Permette la lettura e il matching automatico dei listoni Excel su arrGiocatoriA (Serie A),
 * la gestione e risoluzione dei casi dubbi, e la scrittura di liveVU_associazioni.php
 * e js/fcmVotiAssociazioni.js.
 */

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

    return $players;
}

/**
 * Carica le associazioni storiche esistenti da liveVU_associazioni.php.
 */
function loadCurrentLiveVUAssociazioni($baseDir) {
    $assocFile = $baseDir . '/inc/liveVU_associazioni.php';
    if (!file_exists($assocFile)) {
        $assocFile = __DIR__ . '/liveVU_associazioni.php';
    }
    if (!file_exists($assocFile)) {
        $assocFile = $baseDir . '/liveVU_associazioni.php';
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
                $existing[$codFCM] = [
                    'codPF' => $parts[0] !== '' ? (int)$parts[0] : '',
                    'nomePF' => $parts[1],
                    'codFC' => $parts[2] !== '' ? (int)$parts[2] : '',
                    'nomeFC' => $parts[3],
                    'codFCM' => $codFCM,
                    'nomeFCM' => $parts[5],
                    'idFCM' => isset($parts[6]) ? (int)$parts[6] : 0
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

/**
 * Motore di associazione orientato esclusivamente sui giocatori di arrGiocatoriA.
 */
function runAssociationMatching($fcmPlayers, $pfList, $fcList, $existingAssoc) {
    $pfByCode = [];
    foreach ($pfList as $item) {
        $pfByCode[$item['cod']] = $item;
    }

    $fcById = [];
    foreach ($fcList as $item) {
        $fcById[$item['id']] = $item;
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

        // --- 1. PIANETAFANTA MATCHING ---
        $pfSelected = null;
        $pfCandidates = [];
        $pfIsDoubtful = false;

        // Livello 1: Storico
        if (isset($existingAssoc[$codFCM]) && !empty($existingAssoc[$codFCM]['codPF']) && isset($pfByCode[$existingAssoc[$codFCM]['codPF']])) {
            $pfSelected = $pfByCode[$existingAssoc[$codFCM]['codPF']];
        } else {
            // Ricerca candidati per cognome
            foreach ($pfList as $cand) {
                list($candSurname, , ) = assocGetNameParts($cand['nome']);
                $candSurnameNoSpace = str_replace(' ', '', $candSurname);
                
                $isSurnameMatch = ($candSurname === $surname) || 
                                  (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);

                if ($isSurnameMatch) {
                    $pfCandidates[] = $cand;
                }
            }

            // Filtro per squadra
            $sameTeam = array_values(array_filter($pfCandidates, fn($c) => assocNormTeam($c['squadra']) === $teamFCM));
            if (count($sameTeam) === 1) {
                $pfSelected = $sameTeam[0];
            } elseif (count($sameTeam) > 1) {
                // Disambigua per iniziale se presente
                $initMatch = array_values(array_filter($sameTeam, fn($c) => $initial !== '' && str_contains(assocCleanStr($c['nome']), $initial)));
                if (count($initMatch) === 1) {
                    $pfSelected = $initMatch[0];
                } else {
                    $pfIsDoubtful = true;
                }
            } elseif (!empty($pfCandidates)) {
                // Trovato cognome identico ma in altra squadra (possibile trasferimento)
                $pfIsDoubtful = true;
            }

            // Ricerca estesa per giocatori con più nomi (nomi composti, doppi nomi, inversioni) se non trovato o dubbio
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

                $isSurnameMatch = ($candSurname === $surname) || 
                                  (!empty($surnameNoSpace) && $candSurnameNoSpace === $surnameNoSpace);

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

            // Ricerca estesa per giocatori con più nomi in Fantacalcio.it se non trovato o dubbio
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

        // Determinazione dello status complessivo
        $isDoubtful = ($pfIsDoubtful || $fcIsDoubtful);
        $hasAnyMatch = ($pfSelected !== null || $fcSelected !== null);

        $rowItem = [
            'player' => $p,
            'is_doubtful' => $isDoubtful,
            'pf_selected' => $pfSelected,
            'pf_candidates' => $pfCandidates,
            'fc_selected' => $fcSelected,
            'fc_candidates' => $fcCandidates,
            'status' => $isDoubtful ? 'dubbio' : ($hasAnyMatch ? 'confermato' : 'non_trovato')
        ];

        $all[] = $rowItem;
    }

    // PASS 2: UNICITÀ RIGOROSA 1-TO-1 (Nessun giocatore Pianetafanta o Fantacalcio duplicato)
    $pfUsage = [];
    $fcUsage = [];
    foreach ($all as $idx => $r) {
        if (!empty($r['pf_selected']['cod'])) {
            $pfUsage[$r['pf_selected']['cod']][] = $idx;
        }
        if (!empty($r['fc_selected']['id'])) {
            $fcUsage[$r['fc_selected']['id']][] = $idx;
        }
    }

    foreach ($pfUsage as $cod => $indices) {
        if (count($indices) > 1) {
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['pf_conflict'] = true;
            }
        }
    }

    foreach ($fcUsage as $id => $indices) {
        if (count($indices) > 1) {
            foreach ($indices as $i) {
                $all[$i]['status'] = 'dubbio';
                $all[$i]['is_doubtful'] = true;
                $all[$i]['fc_conflict'] = true;
            }
        }
    }

    // Calcolo liste dei giocatori NON ancora assegnati per Pianetafanta e Fantacalcio.it
    $assignedPfCods = [];
    $assignedFcIds = [];
    foreach ($all as $r) {
        if (!empty($r['pf_selected']['cod'])) {
            $assignedPfCods[$r['pf_selected']['cod']] = true;
        }
        if (!empty($r['fc_selected']['id'])) {
            $assignedFcIds[$r['fc_selected']['id']] = true;
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

    // Ripartizione accurata dopo verifica unicità
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

    return [
        'confirmed' => $confirmed,
        'doubtful' => $doubtful,
        'not_found' => $notFound,
        'all' => $all,
        'unassigned_pf' => $unassignedPf,
        'unassigned_fc' => $unassignedFc,
        'stats' => [
            'total_fcm_serie_a' => count($fcmPlayers),
            'confirmed' => count($confirmed),
            'doubtful' => count($doubtful),
            'not_found' => count($notFound)
        ]
    ];
}

/**
 * Scrittura del file liveVU_associazioni.php ordinato alfabeticamente per nome FCM.
 */
function saveAssociazioniFiles($associations, $baseDir) {
    // 1. Ordina alfabeticamente per nome FCM
    usort($associations, function($a, $b) {
        $nA = isset($a['nomeFCM']) ? $a['nomeFCM'] : (isset($a['player']['nome']) ? $a['player']['nome'] : '');
        $nB = isset($b['nomeFCM']) ? $b['nomeFCM'] : (isset($b['player']['nome']) ? $b['player']['nome'] : '');
        return strcasecmp($nA, $nB);
    });

    $targetPhp = $baseDir . '/inc/liveVU_associazioni.php';

    // Validazione unicità: nessun codPF e nessun codFC può essere assegnato a più giocatori FCM
    $seenPf = [];
    $seenFc = [];
    foreach ($associations as $item) {
        $codPF = isset($item['codPF']) ? $item['codPF'] : (isset($item['pf_selected']['cod']) ? $item['pf_selected']['cod'] : '');
        $codFC = isset($item['codFC']) ? $item['codFC'] : (isset($item['fc_selected']['id']) ? $item['fc_selected']['id'] : '');
        $nomeFCM = isset($item['nomeFCM']) ? $item['nomeFCM'] : (isset($item['player']['nome']) ? $item['player']['nome'] : '');
        $nomePF = isset($item['nomePF']) ? $item['nomePF'] : (isset($item['pf_selected']['nome']) ? $item['pf_selected']['nome'] : '');
        $nomeFC = isset($item['nomeFC']) ? $item['nomeFC'] : (isset($item['fc_selected']['nome']) ? $item['fc_selected']['nome'] : '');

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
    }

    // Generazione contenuto PHP
    $phpContent = "<?php\n\n";
    $phpContent .= "// Array per associare il nome e i codici del giocatore su Pianetafanta e Fantacalcio.it con il nome e i codici in FCM\n";
    $phpContent .= "// \$arrAssociazioni[0]=array(codice Pianetafanta,\"nome Pianetafanta\",codice Fantacalcio.it,\"nome Fantacalcio.it\",codice FCM,\"nome FCM\",id FCM);\n\n";

    $idx = 1;
    foreach ($associations as $item) {
        $codPF = isset($item['codPF']) ? $item['codPF'] : (isset($item['pf_selected']['cod']) ? $item['pf_selected']['cod'] : '');
        $nomePF = isset($item['nomePF']) ? $item['nomePF'] : (isset($item['pf_selected']['nome']) ? $item['pf_selected']['nome'] : '');

        $codFC = isset($item['codFC']) ? $item['codFC'] : (isset($item['fc_selected']['id']) ? $item['fc_selected']['id'] : '');
        $nomeFC = isset($item['nomeFC']) ? $item['nomeFC'] : (isset($item['fc_selected']['nome']) ? $item['fc_selected']['nome'] : '');

        $codFCM = isset($item['codFCM']) ? $item['codFCM'] : (isset($item['player']['codice']) ? $item['player']['codice'] : 0);
        $nomeFCM = isset($item['nomeFCM']) ? $item['nomeFCM'] : (isset($item['player']['nome']) ? $item['player']['nome'] : '');
        $idFCM = isset($item['idFCM']) ? $item['idFCM'] : (isset($item['player']['id']) ? $item['player']['id'] : 0);

        // Formattazione valori riga PHP
        $valCodPF = (!empty($codPF) && is_numeric($codPF)) ? (int)$codPF : '""';
        $valNomePF = !empty($nomePF) ? '"' . addcslashes($nomePF, '"\\') . '"' : '""';

        $valCodFC = (!empty($codFC) && is_numeric($codFC)) ? (int)$codFC : '""';
        $valNomeFC = !empty($nomeFC) ? '"' . addcslashes($nomeFC, '"\\') . '"' : '""';

        $valCodFCM = (int)$codFCM;
        $valNomeFCM = '"' . addcslashes($nomeFCM, '"\\') . '"';
        $valIdFCM = (int)$idFCM;

        $phpContent .= "\$arrAssociazioni[{$idx}]=array({$valCodPF},{$valNomePF},{$valCodFC},{$valNomeFC},{$valCodFCM},{$valNomeFCM},{$valIdFCM});\n";
        $idx++;
    }

    $phpContent .= "\n?>\n";

    // Backup di sicurezza prima di sovrascrivere
    if (file_exists($targetPhp)) {
        @copy($targetPhp, $targetPhp . '.bak');
    }

    // Scrittura diretta
    $writtenPhp = @file_put_contents($targetPhp, $phpContent, LOCK_EX);

    if ($writtenPhp === false) {
        throw new Exception("Impossibile salvare il file liveVU_associazioni.php. Verificare i permessi di scrittura nella root.");
    }

    return [
        'count' => count($associations),
        'bytes_php' => $writtenPhp,
        'updated' => date('d/m/Y H:i:s')
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

    try {
        switch ($action) {
            case 'analyze_files':
                if (empty($_FILES['excel_pf']['tmp_name']) || empty($_FILES['excel_fc']['tmp_name'])) {
                    throw new Exception("È necessario selezionare entrambi i file Excel (Pianetafanta e Fantacalcio.it).");
                }

                $pfPath = $_FILES['excel_pf']['tmp_name'];
                $fcPath = $_FILES['excel_fc']['tmp_name'];

                $pfRows = parseXlsxCellsUniversal($pfPath);
                $fcRows = parseXlsxCellsUniversal($fcPath);

                // Estrai lista Pianetafanta
                $pfList = [];
                for ($i = 1; $i < count($pfRows); $i++) {
                    $r = $pfRows[$i];
                    if (count($r) > 4 && is_numeric($r[0])) {
                        $pfList[] = [
                            'cod' => (int)$r[0],
                            'ruolo' => trim($r[1]),
                            'nome' => trim($r[3]),
                            'squadra' => trim($r[4])
                        ];
                    }
                }

                // Estrai lista Fantacalcio.it (foglio Tutti ha intestazione a riga 1, dati a partire da riga 2)
                $fcList = [];
                for ($i = 2; $i < count($fcRows); $i++) {
                    $r = $fcRows[$i];
                    if (count($r) > 4 && is_numeric($r[0])) {
                        $fcList[] = [
                            'id' => (int)$r[0],
                            'ruolo' => trim($r[1]),
                            'nome' => trim($r[3]),
                            'squadra' => trim($r[4])
                        ];
                    }
                }

                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = loadCurrentLiveVUAssociazioni($baseDir);

                $matchResult = runAssociationMatching($fcmPlayers, $pfList, $fcList, $existingAssoc);

                echo json_encode([
                    'success' => true,
                    'stats' => $matchResult['stats'],
                    'doubtful' => $matchResult['doubtful'],
                    'confirmed' => $matchResult['confirmed'],
                    'not_found' => $matchResult['not_found'],
                    'all' => $matchResult['all'],
                    'unassigned_pf' => $matchResult['unassigned_pf'],
                    'unassigned_fc' => $matchResult['unassigned_fc'],
                    'pf_count' => count($pfList),
                    'fc_count' => count($fcList)
                ]);
                break;

            case 'get_current_state':
                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = loadCurrentLiveVUAssociazioni($baseDir);

                $items = [];
                $hasHistorical = 0;
                foreach ($fcmPlayers as $p) {
                    $cod = $p['codice'];
                    $assoc = isset($existingAssoc[$cod]) ? $existingAssoc[$cod] : null;
                    if ($assoc) $hasHistorical++;

                    $items[] = [
                        'player' => $p,
                        'codPF' => $assoc ? $assoc['codPF'] : '',
                        'nomePF' => $assoc ? $assoc['nomePF'] : '',
                        'codFC' => $assoc ? $assoc['codFC'] : '',
                        'nomeFC' => $assoc ? $assoc['nomeFC'] : '',
                        'codFCM' => $p['codice'],
                        'nomeFCM' => $p['nome'],
                        'idFCM' => $p['id'],
                        'has_assoc' => ($assoc && (!empty($assoc['codPF']) || !empty($assoc['codFC'])))
                    ];
                }

                // Carica eventuali liste unassigned dai file test di default se presenti
                $unassignedPf = [];
                $unassignedFc = [];
                $testPf = $baseDir . '/tests/quotazioni-giornata7.xlsx';
                $testFc = $baseDir . '/tests/Quotazioni_Fantacalcio_Stagione_2026_27 (1).xlsx';
                if (file_exists($testPf) && file_exists($testFc)) {
                    try {
                        $pfRows = parseXlsxCellsUniversal($testPf);
                        $fcRows = parseXlsxCellsUniversal($testFc);
                        $pfList = [];
                        for ($i = 1; $i < count($pfRows); $i++) {
                            $r = $pfRows[$i];
                            if (count($r) > 4 && is_numeric($r[0])) {
                                $pfList[] = ['cod' => (int)$r[0], 'ruolo' => trim($r[1]), 'nome' => trim($r[3]), 'squadra' => trim($r[4])];
                            }
                        }
                        $fcList = [];
                        for ($i = 2; $i < count($fcRows); $i++) {
                            $r = $fcRows[$i];
                            if (count($r) > 4 && is_numeric($r[0])) {
                                $fcList[] = ['id' => (int)$r[0], 'ruolo' => trim($r[1]), 'nome' => trim($r[3]), 'squadra' => trim($r[4])];
                            }
                        }

                        $assignedPfCods = [];
                        $assignedFcIds = [];
                        foreach ($items as $it) {
                            if (!empty($it['codPF'])) $assignedPfCods[(int)$it['codPF']] = true;
                            if (!empty($it['codFC'])) $assignedFcIds[(int)$it['codFC']] = true;
                        }

                        foreach ($pfList as $p) {
                            if (!isset($assignedPfCods[$p['cod']])) $unassignedPf[] = $p;
                        }
                        usort($unassignedPf, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

                        foreach ($fcList as $p) {
                            if (!isset($assignedFcIds[$p['id']])) $unassignedFc[] = $p;
                        }
                        usort($unassignedFc, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));
                    } catch (Exception $e) {}
                }

                echo json_encode([
                    'success' => true,
                    'total_fcm' => count($fcmPlayers),
                    'associated_count' => $hasHistorical,
                    'items' => $items,
                    'unassigned_pf' => $unassignedPf,
                    'unassigned_fc' => $unassignedFc,
                    'last_file_update' => file_exists($baseDir . '/inc/liveVU_associazioni.php') ? date('d/m/Y H:i', filemtime($baseDir . '/inc/liveVU_associazioni.php')) : (file_exists($baseDir . '/liveVU_associazioni.php') ? date('d/m/Y H:i', filemtime($baseDir . '/liveVU_associazioni.php')) : 'N/D')
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
                    'message' => 'File liveVU_associazioni.php salvato con successo!',
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
