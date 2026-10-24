<?php
/**
 * ModernFCM - Gestore Associazioni Fantapazz (liveFP)
 * Modulo dedicato e indipendente per il caricamento del listone Fantapazz (CSV)
 * e la sincronizzazione di js/fcmVotiAssociazioni.js.
 */

require_once __DIR__ . '/liveVU_associazioni_manager.inc.php';

/**
 * Normalizza una stringa di testo rimuovendo accenti, apostrofi e spazi superflui
 */
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

/**
 * Normalizza il nome della squadra di Serie A
 */
function normalizeFpTeamName($team) {
    $t = normalizeFpString($team);
    if (strpos($t, 'VERONA') !== false) return 'HELLAS VERONA';
    if (strpos($t, 'INTER') !== false) return 'INTER';
    return $t;
}

/**
 * Effettua il parsing del file CSV Listone Fantapazz (delimitatore punto e virgola ;)
 */
function parseFantapazzCsv($filePath) {
    if (!file_exists($filePath)) {
        throw new Exception("File CSV Fantapazz non trovato: " . basename($filePath));
    }

    $content = file_get_contents($filePath);
    if ($content === false) {
        throw new Exception("Impossibile leggere il file CSV Fantapazz.");
    }

    // Rimuove eventuale BOM UTF-8
    if (str_starts_with($content, "\xEF\xBB\xBF")) {
        $content = substr($content, 3);
    }

    $lines = preg_split('/\r\n|\r|\n/', trim($content));
    if (empty($lines)) {
        throw new Exception("Il file CSV Fantapazz è vuoto.");
    }

    $headerLine = array_shift($lines);
    // Determina il delimitatore (solitamente ';' ma supporta anche ',')
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

/**
 * Legge le associazioni esistenti da js/fcmVotiAssociazioni.js
 */
function getCurrentFpAssociations($baseDir) {
    $jsPath = $baseDir . '/js/fcmVotiAssociazioni.js';
    $assoc = [];
    if (!file_exists($jsPath)) {
        return $assoc;
    }

    $content = file_get_contents($jsPath);
    if (empty($content)) {
        return $assoc;
    }

    // Pattern a["NOME_FP"] = "NOME_FCM" o arrAssociazioni["NOME_FP"] = "NOME_FCM"
    if (preg_match_all('/(?:a|arrAssociazioni)\["([^"]+)"\]\s*=\s*"([^"]+)"/i', $content, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $fpKey = trim($m[1]);
            $fcmVal = trim($m[2]);
            $assoc[$fpKey] = $fcmVal;
        }
    }

    return $assoc;
}

/**
 * Estrae tutti i token significativi da un nome (gestisce apostrofi, trattini, stopword, caratteri speciali)
 */
function extractFpNameTokens($str) {
    if (!$str) return [];
    $norm = normalizeFpString($str);
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
function matchFantapazzExtended($fcmNome, $fcmSquadra, $candNome, $candSquadra) {
    $fcmTokens = extractFpNameTokens($fcmNome);
    $candTokens = extractFpNameTokens($candNome);
    if (empty($fcmTokens) || empty($candTokens)) return false;

    $normFcmTeam = normalizeFpTeamName($fcmSquadra);
    $normCandTeam = normalizeFpTeamName($candSquadra);
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
 * Esegue il matching intelligente tra i giocatori FCM Serie A e il listone Fantapazz.
 */
function matchFantapazzWithFcm($fcmPlayers, $fpPlayers, $existingAssoc = []) {
    // Indicizza associazioni esistenti per FCM name
    $existingByFcm = [];
    foreach ($existingAssoc as $fpKey => $fcmVal) {
        $existingByFcm[normalizeFpString($fcmVal)] = $fpKey;
    }

    $results = [];
    $confirmedCount = 0;
    $doubtfulCount = 0;
    $notFoundCount = 0;

    foreach ($fcmPlayers as $fcm) {
        $fcmNome = $fcm['nome'];
        $fcmNorm = normalizeFpString($fcmNome);
        $fcmSqNorm = normalizeFpTeamName($fcm['squadra']);
        $fcmRuolo = $fcm['ruolo'];

        // Estrazione cognome FCM
        $parts = explode(' ', $fcmNorm);
        $cognome = $parts[0];
        $multipartPrefixes = ['DE', 'DI', 'DA', 'DEL', 'DELLA', 'VAN', 'SAN', 'LE'];
        if (count($parts) > 1 && in_array($parts[0], $multipartPrefixes)) {
            $cognome = $parts[0] . ' ' . $parts[1];
        }

        $item = [
            'player' => $fcm,
            'fp_selected' => null,
            'fp_candidates' => [],
            'status' => 'non_trovato',
            'is_doubtful' => false
        ];

        // 1. Priorità: Associazione già esistente in fcmVotiAssociazioni.js
        if (isset($existingByFcm[$fcmNorm])) {
            $savedFpName = $existingByFcm[$fcmNorm];
            $item['fp_selected'] = [
                'calciatore' => $savedFpName,
                'squadra' => $fcm['squadra'],
                'ruolo' => $fcmRuolo
            ];
            $item['status'] = 'confermato';
            $confirmedCount++;
            $results[] = $item;
            continue;
        }

        // 2. Ricerca candidati in FP
        $candidates = [];
        foreach ($fpPlayers as $fp) {
            $fpNorm = $fp['norm_name'];
            $fpSqNorm = $fp['norm_team'];

            $sameTeam = ($fpSqNorm !== '' && $fpSqNorm === $fcmSqNorm);
            $emptyTeam = ($fpSqNorm === '');

            // Base senza punto per abbreviazioni come Martinez J.
            $fpBase = explode('.', $fpNorm)[0];
            if (strpos($fpNorm, '.') !== false && strpos($fpBase, ' ') !== false) {
                $sub = explode(' ', $fpBase);
                array_pop($sub);
                $fpBase = implode(' ', $sub);
            }
            $fpBase = trim($fpBase);

            $isMatch = false;

            // Se stessa squadra
            if ($sameTeam) {
                if ($fpNorm === $fcmNorm || $fpBase === $cognome || str_starts_with($fcmNorm, $fpNorm) || str_starts_with($fcmNorm, $fpBase) || strpos($fcmNorm, $fpNorm) !== false) {
                    $isMatch = true;
                }
            } elseif ($emptyTeam) {
                // Squadra vuota su Fantapazz ma cognome corrisponde esattamente
                if ($fpBase === $cognome && strlen($cognome) >= 4) {
                    $isMatch = true;
                }
            } else {
                // Squadra diversa: possibile trasferimento non aggiornato
                if ($fpNorm === $fcmNorm || ($fpBase === $cognome && strlen($cognome) >= 5)) {
                    $isMatch = true;
                }
            }

            if ($isMatch) {
                $sameRole = ($fp['ruolo'] === $fcmRuolo);
                $score = $sameTeam ? 100 : 70;
                if ($sameRole) {
                    $score += 25;
                }

                // Raffinamento con iniziale del nome se presente punto (es. Martinez J., Martinez L., Karlsson J.)
                if (preg_match('/\b([A-Z])\./i', $fp['calciatore'], $mInit)) {
                    $candInit = strtoupper($mInit[1]);
                    // Se corrisponde all'iniziale del primo nome ($parts[1])
                    if (count($parts) > 1 && strlen($parts[1]) > 0 && $parts[1][0] === $candInit) {
                        $score += 35;
                    } elseif (count($parts) > 2) {
                        // Se corrisponde a uno dei secondi nomi
                        $matchedOther = false;
                        for ($k = 2; $k < count($parts); $k++) {
                            if (strlen($parts[$k]) > 0 && $parts[$k][0] === $candInit) {
                                $score += 10;
                                $matchedOther = true;
                                break;
                            }
                        }
                        if (!$matchedOther) {
                            $score -= 30;
                        }
                    } else {
                        $score -= 40;
                    }
                }

                $candidates[] = [
                    'calciatore' => $fp['calciatore'],
                    'squadra' => $fp['squadra'],
                    'ruolo' => $fp['ruolo'],
                    'same_team' => $sameTeam,
                    'same_role' => $sameRole,
                    'score' => $score
                ];
            }
        }

        $wasExtendedMatch = false;

        // Se nessun candidato trovato, o se tutti i candidati sono di squadra diversa o multipli,
        // esegui sempre la ricerca estesa per giocatori con più nomi (nomi composti, doppi nomi, inversioni)
        $hasSameTeamCand = false;
        foreach ($candidates as $c) {
            if ($c['same_team']) { $hasSameTeamCand = true; break; }
        }

        if (empty($candidates) || !$hasSameTeamCand || count($candidates) > 1) {
            $existingNames = array_column($candidates, 'calciatore');
            foreach ($fpPlayers as $fp) {
                if (in_array($fp['calciatore'], $existingNames)) continue;
                $extMatch = matchFantapazzExtended($fcmNome, $fcm['squadra'], $fp['calciatore'], $fp['squadra']);
                if ($extMatch) {
                    $sameRole = ($fp['ruolo'] === $fcmRuolo);
                    $extScore = $extMatch['score'] + ($sameRole ? 15 : 0);
                    $candidates[] = [
                        'calciatore' => $fp['calciatore'],
                        'squadra' => $fp['squadra'],
                        'ruolo' => $fp['ruolo'],
                        'same_team' => $extMatch['same_team'],
                        'same_role' => $sameRole,
                        'score' => $extScore
                    ];
                    $wasExtendedMatch = true;
                }
            }
        }

        if (!empty($candidates)) {
            usort($candidates, function($a, $b) {
                return $b['score'] <=> $a['score'];
            });
        }

        // Decisione: confermato o dubbio
        if (!empty($candidates)) {
            $best = $candidates[0];
            $hasRunnerUp = (count($candidates) > 1 && ($best['score'] - $candidates[1]['score'] < 20));

            // Auto-conferma solo se stessa squadra, punteggio elevato e margine chiaro
            if ($best['same_team'] && $best['score'] >= 100 && !$hasRunnerUp && !$wasExtendedMatch) {
                $item['fp_selected'] = $best;
                $item['status'] = 'confermato';
                $item['fp_candidates'] = $candidates;
            } else {
                $item['status'] = 'dubbio';
                $item['is_doubtful'] = true;
                $item['fp_candidates'] = $candidates;
                $item['fp_selected'] = $best;
            }
        } else {
            $item['status'] = 'non_trovato';
        }

        $results[] = $item;
    }

    // PASS 2: UNICITÀ RIGOROSA 1-TO-1 (Nessun giocatore Fantapazz duplicato)
    $assignedUsage = [];
    foreach ($results as $idx => $r) {
        if (!empty($r['fp_selected']['calciatore'])) {
            $key = normalizeFpString($r['fp_selected']['calciatore']);
            $assignedUsage[$key][] = $idx;
        }
    }

    foreach ($assignedUsage as $key => $indices) {
        if (count($indices) > 1) {
            // Collisione! Più giocatori FCM assegnati allo stesso calciatore Fantapazz.
            // L'utente deve scegliere: marca tutti i contendenti come casi dubbi con conflitto!
            foreach ($indices as $i) {
                $results[$i]['status'] = 'dubbio';
                $results[$i]['is_doubtful'] = true;
                $results[$i]['conflict'] = true;
            }
        }
    }

    // Calcolo lista dei calciatori Fantapazz NON ancora assegnati
    $assignedNames = [];
    foreach ($results as $r) {
        if (!empty($r['fp_selected']['calciatore'])) {
            $assignedNames[normalizeFpString($r['fp_selected']['calciatore'])] = true;
        }
    }
    $unassignedFp = [];
    foreach ($fpPlayers as $fp) {
        $norm = normalizeFpString($fp['calciatore']);
        if (!isset($assignedNames[$norm])) {
            $unassignedFp[] = [
                'calciatore' => $fp['calciatore'],
                'squadra' => $fp['squadra'],
                'ruolo' => $fp['ruolo']
            ];
        }
    }
    usort($unassignedFp, function($a, $b) {
        return strcasecmp($a['calciatore'], $b['calciatore']);
    });

    // Conteggio finale accurato
    $confirmedCount = 0;
    $doubtfulCount = 0;
    $notFoundCount = 0;
    foreach ($results as $r) {
        if ($r['status'] === 'confermato') $confirmedCount++;
        elseif ($r['status'] === 'dubbio') $doubtfulCount++;
        else $notFoundCount++;
    }

    // Ordina alfabeticamente per nome FCM
    usort($results, function($a, $b) {
        return strcasecmp($a['player']['nome'], $b['player']['nome']);
    });

    return [
        'all' => $results,
        'unassigned_fp' => $unassignedFp,
        'stats' => [
            'total_fcm' => count($results),
            'confirmed' => $confirmedCount,
            'doubtful' => $doubtfulCount,
            'not_found' => $notFoundCount
        ]
    ];
}

/**
 * Salva le associazioni su js/fcmVotiAssociazioni.js
 */
function saveFantapazzAssociationsToFile($associations, $baseDir) {
    $targetJs = $baseDir . '/js/fcmVotiAssociazioni.js';

    // Costruisce mappa univoca Fantapazz Name -> FCM Name con validazione di unicità
    $uniqueMap = [];
    $seenFp = [];
    foreach ($associations as $item) {
        $fpNome = isset($item['fpNome']) ? trim($item['fpNome']) : '';
        $fcmNome = isset($item['fcmNome']) ? trim($item['fcmNome']) : '';

        if ($fpNome === '' || $fcmNome === '' || $fpNome === 'EMPTY') {
            continue;
        }

        $normKey = normalizeFpString($fpNome);
        if (isset($seenFp[$normKey]) && strcasecmp($seenFp[$normKey], $fcmNome) !== 0) {
            throw new Exception("Assegnazione duplicata non consentita: il calciatore Fantapazz '{$fpNome}' è associato sia a '{$seenFp[$normKey]}' che a '{$fcmNome}'. Risolvi il conflitto per continuare.");
        }
        $seenFp[$normKey] = $fcmNome;

        // Salva con chiave originale e chiave maiuscola
        $uniqueMap[$fpNome] = $fcmNome;
        $uniqueMap[mb_strtoupper($fpNome, 'UTF-8')] = $fcmNome;
    }

    ksort($uniqueMap);

    $jsContent = "// Array per associare il nome del giocatore su Fantapazz con il nome corretto in FCM\n";
    $jsContent .= "// Generato dinamicamente da Gestione Associazioni Fantapazz (ModernFCM)\n";
    $jsContent .= "if (typeof arrAssociazioni === 'undefined' || !arrAssociazioni) {\n";
    $jsContent .= "  var arrAssociazioni = new Array();\n";
    $jsContent .= "}\n";
    $jsContent .= "var a = arrAssociazioni;\n\n";

    foreach ($uniqueMap as $key => $val) {
        $escKey = addcslashes($key, '"\\');
        $escVal = addcslashes($val, '"\\');
        $jsContent .= "a[\"{$escKey}\"] = \"{$escVal}\";\n";
    }

    // Backup prima di sovrascrivere
    if (file_exists($targetJs)) {
        @copy($targetJs, $targetJs . '.bak');
    }

    $written = @file_put_contents($targetJs, $jsContent, LOCK_EX);
    if ($written === false) {
        throw new Exception("Impossibile salvare il file js/fcmVotiAssociazioni.js. Verificare i permessi.");
    }

    return [
        'count' => count($uniqueMap),
        'bytes' => $written,
        'updated' => date('d/m/Y H:i:s')
    ];
}

/**
 * Controller AJAX dedicato per il modulo Associazioni Fantapazz
 */
function handleFpAssocAjaxRequests($baseDir, $isAdminLogged) {
    if (!isset($_REQUEST['fp_assoc_action'])) {
        return;
    }

    header('Content-Type: application/json; charset=utf-8');

    if (!$isAdminLogged) {
        echo json_encode([
            'success' => false,
            'error' => 'Accesso non autorizzato. Effettuare il login come amministratore.'
        ]);
        exit;
    }

    $action = $_REQUEST['fp_assoc_action'];

    try {
        switch ($action) {
            case 'get_current_state':
                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $existingAssoc = getCurrentFpAssociations($baseDir);

                $indexedByFcm = [];
                foreach ($existingAssoc as $fpKey => $fcmVal) {
                    $indexedByFcm[normalizeFpString($fcmVal)] = $fpKey;
                }

                $items = [];
                $confirmedCount = 0;
                $notFoundCount = 0;

                foreach ($fcmPlayers as $p) {
                    $fcmNorm = normalizeFpString($p['nome']);
                    $hasFp = isset($indexedByFcm[$fcmNorm]);
                    $fpName = $hasFp ? $indexedByFcm[$fcmNorm] : '';

                    if ($hasFp) $confirmedCount++;
                    else $notFoundCount++;

                    $items[] = [
                        'player' => $p,
                        'fp_name' => $fpName,
                        'status' => $hasFp ? 'confermato' : 'non_trovato'
                    ];
                }

                $unassignedFp = [];
                $testCsv = $baseDir . '/tests/Listone_Fantapazz.csv';
                if (file_exists($testCsv)) {
                    try {
                        $fpPlayers = parseFantapazzCsv($testCsv);
                        $assignedNames = [];
                        foreach ($items as $it) {
                            if (!empty($it['fp_name'])) {
                                $assignedNames[normalizeFpString($it['fp_name'])] = true;
                            }
                        }
                        foreach ($fpPlayers as $fp) {
                            if (!isset($assignedNames[normalizeFpString($fp['calciatore'])])) {
                                $unassignedFp[] = [
                                    'calciatore' => $fp['calciatore'],
                                    'squadra' => $fp['squadra'],
                                    'ruolo' => $fp['ruolo']
                                ];
                            }
                        }
                        usort($unassignedFp, fn($a, $b) => strcasecmp($a['calciatore'], $b['calciatore']));
                    } catch (Exception $ignored) {}
                }

                echo json_encode([
                    'success' => true,
                    'total_fcm' => count($fcmPlayers),
                    'confirmed' => $confirmedCount,
                    'not_found' => $notFoundCount,
                    'items' => $items,
                    'unassigned_fp' => $unassignedFp
                ]);
                break;

            case 'analyze_file':
                if (empty($_FILES['csv_fp']['tmp_name'])) {
                    throw new Exception("File CSV Listone Fantapazz non ricevuto.");
                }

                $fcmPlayers = getSerieAPlayersFromFcm($baseDir);
                $fpPlayers = parseFantapazzCsv($_FILES['csv_fp']['tmp_name']);
                $existingAssoc = getCurrentFpAssociations($baseDir);

                $matchResult = matchFantapazzWithFcm($fcmPlayers, $fpPlayers, $existingAssoc);

                echo json_encode([
                    'success' => true,
                    'stats' => $matchResult['stats'],
                    'all' => $matchResult['all'],
                    'unassigned_fp' => $matchResult['unassigned_fp']
                ]);
                break;

            case 'save_associations':
                $rawJson = isset($_POST['associations_json']) ? $_POST['associations_json'] : '';
                if (empty($rawJson)) {
                    throw new Exception("Nessun dato di associazione ricevuto.");
                }

                $data = json_decode($rawJson, true);
                if (!is_array($data)) {
                    throw new Exception("Dati non validi.");
                }

                $res = saveFantapazzAssociationsToFile($data, $baseDir);

                echo json_encode([
                    'success' => true,
                    'message' => 'File js/fcmVotiAssociazioni.js salvato con successo!',
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
