<?php
/**
 * ModernFCM - Estrattore Voti Live & Ufficiali Fantacalcio.it
 * Strategia dual-layer senza dipendenze esterne:
 *  - Layer 1 (Live in corso): decodifica binaria Protobuf pura (.dat via /api/v1/SignedUri)
 *  - Layer 2 (Fallback / Giornate concluse): parsing SSR HTML da /voti-fantacalcio-serie-a
 * Genera js/fcmVotiDatiFC.js e js/fcmVotiDatiFCMeta.json conformi a VotoGiocatore.
 */

require_once __DIR__ . '/admin_security.inc.php';

if (!defined('FC_LIVE_PAGE_URL')) {
    define('FC_LIVE_PAGE_URL', 'https://www.fantacalcio.it/live-serie-a');
}
if (!defined('FC_SIGNED_URI_URL')) {
    define('FC_SIGNED_URI_URL', 'https://www.fantacalcio.it/api/v1/SignedUri');
}
if (!defined('FC_SSR_BASE_URL')) {
    define('FC_SSR_BASE_URL', 'https://www.fantacalcio.it/voti-fantacalcio-serie-a');
}
if (!defined('FC_DAT_URL_TEMPLATE')) {
    define('FC_DAT_URL_TEMPLATE', 'https://api.fantacalcio.it/v1/st/%d/matches/live/%d.dat');
}
if (!defined('FC_VOTI_OUTPUT_FILE')) {
    define('FC_VOTI_OUTPUT_FILE', dirname(__DIR__) . '/js/fcmVotiDatiFC.js');
}
if (!defined('FC_VOTI_META_FILE')) {
    define('FC_VOTI_META_FILE', dirname(__DIR__) . '/js/fcmVotiDatiFCMeta.json');
}

/**
 * Normalizza un nome calciatore per il fallback testuale.
 */
function fc_normalize_name($s) {
    $s = mb_strtoupper(trim((string)$s), 'UTF-8');
    $s = str_replace(array("'", "\xE2\x80\x99", "`", "."), '', $s);
    $s = preg_replace('/\s+/', ' ', $s);
    return trim($s);
}

/**
 * Normalizza il nome squadra Serie A per compatibilita' FCM.
 */
function fc_normalize_team_name($teamName) {
    $t = trim((string)$teamName);
    if ($t === '') return '';
    if (strcasecmp($t, 'Verona') === 0) {
        return 'Hellas Verona';
    }
    return $t;
}

/**
 * Registra lo stato partita della squadra (con alias maiuscolo e Hellas Verona).
 */
function fc_register_team_status(&$partiteStato, $teamName, $finaleVal) {
    $t = trim((string)$teamName);
    if ($t === '') return;
    $partiteStato[$t] = $finaleVal;
    $partiteStato[mb_strtoupper($t, 'UTF-8')] = $finaleVal;
    if (strtolower($t) === 'verona' || strtolower($t) === 'hellas verona') {
        $partiteStato['Verona'] = $finaleVal;
        $partiteStato['VERONA'] = $finaleVal;
        $partiteStato['Hellas Verona'] = $finaleVal;
        $partiteStato['HELLAS VERONA'] = $finaleVal;
    }
}

/**
 * Costruisce le mappe di lookup (codFC -> nomeFCM e nomeFC -> nomeFCM) da $arrAssociazioni.
 */
function fc_build_assoc_maps($arrAssociazioni) {
    $codFcToFcm = array();
    $nameFcToFcm = array();

    if (!is_array($arrAssociazioni)) {
        return array($codFcToFcm, $nameFcToFcm);
    }

    foreach ($arrAssociazioni as $assoc) {
        if (!is_array($assoc)) continue;
        $nomeFCM = !empty($assoc[5]) ? trim((string)$assoc[5]) : '';
        if ($nomeFCM === '') continue;

        if (isset($assoc[2]) && $assoc[2] !== '' && is_numeric($assoc[2]) && (int)$assoc[2] > 0) {
            $codFcToFcm[(int)$assoc[2]] = $nomeFCM;
        }

        if (!empty($assoc[3])) {
            $nomeFC = trim((string)$assoc[3]);
            $nameFcToFcm[$nomeFC] = $nomeFCM;
            $nameFcToFcm[mb_strtoupper($nomeFC, 'UTF-8')] = $nomeFCM;
            $nameFcToFcm[fc_normalize_name($nomeFC)] = $nomeFCM;
        }

        if (!empty($assoc[1])) {
            $nomePF = trim((string)$assoc[1]);
            $nameFcToFcm[$nomePF] = $nomeFCM;
            $nameFcToFcm[mb_strtoupper($nomePF, 'UTF-8')] = $nomeFCM;
            $nameFcToFcm[fc_normalize_name($nomePF)] = $nomeFCM;
        }

        $nameFcToFcm[$nomeFCM] = $nomeFCM;
        $nameFcToFcm[mb_strtoupper($nomeFCM, 'UTF-8')] = $nomeFCM;
        $nameFcToFcm[fc_normalize_name($nomeFCM)] = $nomeFCM;
    }

    return array($codFcToFcm, $nameFcToFcm);
}

/**
 * Risolve il nome FCM di un calciatore dando priorita' assoluta al codice univoco Fantacalcio.it ($codFC).
 */
function fc_resolve_player_name($codFC, $rawName, $codFcToFcm, $nameFcToFcm) {
    $id = (int)$codFC;
    if ($id > 0 && isset($codFcToFcm[$id])) {
        return $codFcToFcm[$id];
    }

    $trimmed = trim((string)$rawName);
    if ($trimmed !== '') {
        if (isset($nameFcToFcm[$trimmed])) return $nameFcToFcm[$trimmed];
        $upper = mb_strtoupper($trimmed, 'UTF-8');
        if (isset($nameFcToFcm[$upper])) return $nameFcToFcm[$upper];
        $norm = fc_normalize_name($trimmed);
        if (isset($nameFcToFcm[$norm])) return $nameFcToFcm[$norm];
    }

    return $trimmed;
}

/**
 * Formatta il voto numerico o restituisce "SV" per valori non validi/sentinella (es. 55 SSR).
 */
function fc_format_vote($val) {
    if ($val === null || $val === '') return 'SV';
    if (is_string($val)) {
        $clean = trim(str_replace(',', '.', $val));
        $lower = strtolower($clean);
        if ($clean === '' || $clean === '-' || $lower === 's.v.' || $lower === 's.v' || $lower === 'sv' || $lower === 's/v') {
            return 'SV';
        }
        if (!is_numeric($clean)) return 'SV';
        $num = (float)$clean;
    } elseif (is_numeric($val)) {
        $num = (float)$val;
    } else {
        return 'SV';
    }

    // Nel sistema Fantacalcio i voti reali sono compresi nell'intervallo (0, 10];
    // valori sentinella (es. data-value="55" nell'HTML SSR o 0 pre-gara) rappresentano SV.
    if ($num <= 0.0 || $num > 10.0 || is_nan($num)) {
        return 'SV';
    }

    $rounded = round($num, 2);
    return (string)$rounded;
}

/* ============================================================================
 * DECODER BINARIO PROTOBUF PURO (WIRE FORMAT PROTO3 - ZERO DIPENDENZE)
 * Basato sullo schema live.txt di Fantacalcio.it (.dat)
 * ============================================================================ */

function fc_pb_read_varint($buf, &$pos, $len) {
    if (PHP_INT_SIZE >= 8) {
        $res = 0;
        $shift = 0;
        while ($pos < $len) {
            $b = ord($buf[$pos++]);
            $res |= (($b & 0x7F) << $shift);
            if (($b & 0x80) === 0) {
                return $res;
            }
            $shift += 7;
            if ($shift > 63) {
                throw new RuntimeException("Varint overflow at pos $pos");
            }
        }
        throw new RuntimeException("Unexpected EOF in varint at pos $pos");
    }

    // Fallback portabile per PHP 32-bit
    $low = 0;
    $high = 0.0;
    $shift = 0;
    while ($pos < $len) {
        $b = ord($buf[$pos++]);
        $val = $b & 0x7F;
        if ($shift < 28) {
            $low |= ($val << $shift);
        } else {
            if ($shift === 28) {
                $low |= (($val & 0x0F) << 28);
            }
            $high += $val * pow(2, $shift);
        }
        if (($b & 0x80) === 0) {
            return ($high > 0) ? ($low + $high) : $low;
        }
        $shift += 7;
        if ($shift > 63) {
            throw new RuntimeException("Varint overflow at pos $pos");
        }
    }
    throw new RuntimeException("Unexpected EOF in varint at pos $pos");
}

function fc_pb_to_int32($v) {
    if (PHP_INT_SIZE >= 8) {
        if ($v > 0x7FFFFFFF && $v <= 0xFFFFFFFF) {
            return $v - 0x100000000;
        }
        return (int)$v;
    }
    return (int)$v;
}

function fc_pb_skip_field($buf, &$pos, $len, $wireType) {
    switch ($wireType) {
        case 0:
            fc_pb_read_varint($buf, $pos, $len);
            break;
        case 1:
            if ($pos + 8 > $len) throw new RuntimeException("Unexpected EOF skipping 64-bit at pos $pos");
            $pos += 8;
            break;
        case 2:
            $l = (int)fc_pb_read_varint($buf, $pos, $len);
            if ($l < 0 || $pos + $l > $len) throw new RuntimeException("Invalid length $l at pos $pos");
            $pos += $l;
            break;
        case 5:
            if ($pos + 4 > $len) throw new RuntimeException("Unexpected EOF skipping 32-bit at pos $pos");
            $pos += 4;
            break;
        default:
            throw new RuntimeException("Unsupported protobuf wireType $wireType at pos $pos");
    }
}

function fc_pb_decode_player($buf) {
    $pos = 0;
    $len = strlen($buf);
    $p = array(
        'id' => 0,
        'name' => '',
        'position' => '',
        'vote' => 0.0,
        'events' => array(),
        'eventsMinutes' => array(),
        'stampId' => 0,
        'index' => 0,
        'substitutionId' => 0,
    );

    while ($pos < $len) {
        $tag = (int)fc_pb_read_varint($buf, $pos, $len);
        $field = $tag >> 3;
        $wire = $tag & 0x07;

        switch ($field) {
            case 1:
                $p['id'] = (int)fc_pb_read_varint($buf, $pos, $len);
                break;
            case 2:
                $l = (int)fc_pb_read_varint($buf, $pos, $len);
                $p['name'] = substr($buf, $pos, $l);
                $pos += $l;
                break;
            case 3:
                $l = (int)fc_pb_read_varint($buf, $pos, $len);
                $p['position'] = substr($buf, $pos, $l);
                $pos += $l;
                break;
            case 4:
                if ($wire === 1 && $pos + 8 <= $len) {
                    $u = unpack('e', substr($buf, $pos, 8)); // IEEE 754 little-endian double
                    $p['vote'] = isset($u[1]) ? (float)$u[1] : 0.0;
                    $pos += 8;
                } elseif ($wire === 5 && $pos + 4 <= $len) {
                    $u = unpack('g', substr($buf, $pos, 4)); // IEEE 754 little-endian float fallback
                    $p['vote'] = isset($u[1]) ? (float)$u[1] : 0.0;
                    $pos += 4;
                } else {
                    fc_pb_skip_field($buf, $pos, $len, $wire);
                }
                break;
            case 5:
                if ($wire === 2) {
                    $l = (int)fc_pb_read_varint($buf, $pos, $len);
                    $end = min($len, $pos + $l);
                    while ($pos < $end) {
                        $p['events'][] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $end));
                    }
                } else {
                    $p['events'][] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $len));
                }
                break;
            case 6:
                if ($wire === 2) {
                    $l = (int)fc_pb_read_varint($buf, $pos, $len);
                    $end = min($len, $pos + $l);
                    while ($pos < $end) {
                        $p['eventsMinutes'][] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $end));
                    }
                } else {
                    $p['eventsMinutes'][] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $len));
                }
                break;
            case 7:
                $p['stampId'] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $len));
                break;
            case 8:
                $p['index'] = (int)fc_pb_read_varint($buf, $pos, $len);
                break;
            case 9:
                $p['substitutionId'] = (int)fc_pb_read_varint($buf, $pos, $len);
                break;
            default:
                fc_pb_skip_field($buf, $pos, $len, $wire);
                break;
        }
    }

    return $p;
}

function fc_pb_decode_protodata($buf) {
    $pos = 0;
    $len = strlen($buf);
    $m = array(
        'matchId' => 0,
        'stampMatch' => 0,
        'teamIdHome' => 0,
        'teamIdAway' => 0,
        'goalHome' => 0,
        'goalAway' => 0,
        'fhDate' => 0,
        'shDate' => 0,
        'matchDate' => 0,
        'status' => 0,
        'trendHome' => '',
        'trendAway' => '',
        'teamHome' => '',
        'teamAway' => '',
        'playersHome' => array(),
        'playersAway' => array(),
    );

    while ($pos < $len) {
        $tag = (int)fc_pb_read_varint($buf, $pos, $len);
        $field = $tag >> 3;
        $wire = $tag & 0x07;

        switch ($field) {
            case 1: $m['matchId'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 2: $m['stampMatch'] = fc_pb_to_int32(fc_pb_read_varint($buf, $pos, $len)); break;
            case 3: $m['teamIdHome'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 4: $m['teamIdAway'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 5: $m['goalHome'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 6: $m['goalAway'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 7: $m['fhDate'] = fc_pb_read_varint($buf, $pos, $len); break;
            case 8: $m['shDate'] = fc_pb_read_varint($buf, $pos, $len); break;
            case 9: $m['matchDate'] = fc_pb_read_varint($buf, $pos, $len); break;
            case 10: $m['status'] = (int)fc_pb_read_varint($buf, $pos, $len); break;
            case 11: $l = (int)fc_pb_read_varint($buf, $pos, $len); $m['trendHome'] = substr($buf, $pos, $l); $pos += $l; break;
            case 12: $l = (int)fc_pb_read_varint($buf, $pos, $len); $m['trendAway'] = substr($buf, $pos, $l); $pos += $l; break;
            case 13: $l = (int)fc_pb_read_varint($buf, $pos, $len); $m['teamHome'] = substr($buf, $pos, $l); $pos += $l; break;
            case 14: $l = (int)fc_pb_read_varint($buf, $pos, $len); $m['teamAway'] = substr($buf, $pos, $l); $pos += $l; break;
            case 15:
                $l = (int)fc_pb_read_varint($buf, $pos, $len);
                $m['playersHome'][] = fc_pb_decode_player(substr($buf, $pos, $l));
                $pos += $l;
                break;
            case 16:
                $l = (int)fc_pb_read_varint($buf, $pos, $len);
                $m['playersAway'][] = fc_pb_decode_player(substr($buf, $pos, $l));
                $pos += $l;
                break;
            default:
                fc_pb_skip_field($buf, $pos, $len, $wire);
                break;
        }
    }

    return $m;
}

function fc_pb_decode_live_message($buf) {
    $pos = 0;
    $len = strlen($buf);
    $matches = array();

    while ($pos < $len) {
        $tag = (int)fc_pb_read_varint($buf, $pos, $len);
        $field = $tag >> 3;
        $wire = $tag & 0x07;
        if ($field === 1 && $wire === 2) {
            $l = (int)fc_pb_read_varint($buf, $pos, $len);
            $matches[] = fc_pb_decode_protodata(substr($buf, $pos, $l));
            $pos += $l;
        } else {
            fc_pb_skip_field($buf, $pos, $len, $wire);
        }
    }

    return $matches;
}

/**
 * Converte i match decodificati dal Protobuf .dat in record VotoGiocatore + arrPartite.
 */
function fc_extract_from_dat_matches($matches, $codFcToFcm, $nameFcToFcm) {
    $partiteStato = array();
    $votiRows = array();
    $hasMatchLive = false;
    $nonIdleMatches = 0;

    foreach ($matches as $m) {
        $status = isset($m['status']) ? (int)$m['status'] : 0;
        // MatchStatusType: 0=Idle, 1=FirstHalf, 2=Interval, 3=SecondHalf, 4=FullTime, 5=Suspended, 6=Postponed
        if ($status === 4) {
            $finaleVal = '1';
        } elseif ($status >= 1 && $status <= 3) {
            $finaleVal = '0';
            $hasMatchLive = true;
        } else {
            $finaleVal = '';
        }

        $clubH = fc_normalize_team_name(isset($m['teamHome']) ? $m['teamHome'] : '');
        $clubA = fc_normalize_team_name(isset($m['teamAway']) ? $m['teamAway'] : '');
        fc_register_team_status($partiteStato, isset($m['teamHome']) ? $m['teamHome'] : '', $finaleVal);
        fc_register_team_status($partiteStato, isset($m['teamAway']) ? $m['teamAway'] : '', $finaleVal);

        // Non emettere voti prima del fischio d'inizio (evita il 6.0 placeholder delle distinte pre-gara)
        if ($status === 0 || $status === 6) {
            continue;
        }
        $nonIdleMatches++;

        $sides = array(
            array($clubH, isset($m['playersHome']) ? $m['playersHome'] : array()),
            array($clubA, isset($m['playersAway']) ? $m['playersAway'] : array())
        );

        foreach ($sides as $sideEntry) {
            $teamName = $sideEntry[0];
            $players = $sideEntry[1];
            foreach ($players as $pl) {
                $posRole = strtoupper(trim(isset($pl['position']) ? $pl['position'] : ''));
                if ($posRole === 'ALL' || $posRole === '') {
                    continue;
                }

                $rawId = isset($pl['id']) ? (int)$pl['id'] : 0;
                $rawName = trim(isset($pl['name']) ? $pl['name'] : '');
                $resolvedName = fc_resolve_player_name($rawId, $rawName, $codFcToFcm, $nameFcToFcm);
                if ($resolvedName === '') continue;

                $votoStr = fc_format_vote(isset($pl['vote']) ? (float)$pl['vote'] : 0.0);

                $counts = array(
                    'golfatto' => 0, 'golsubito' => 0, 'autogol' => 0,
                    'ammonito' => 0, 'espulso' => 0, 'rigoresegnato' => 0,
                    'rigoreparato' => 0, 'rigoresbagliato' => 0, 'assist' => 0,
                    'golvittoria' => 0, 'golpareggio' => 0
                );
                $subId = isset($pl['substitutionId']) ? (int)$pl['substitutionId'] : 0;
                $titolare = ($subId > 0) ? 0 : 1;
                $sostituzione = ($subId > 0) ? 1 : 0;
                $minuto = 0;

                $events = isset($pl['events']) && is_array($pl['events']) ? $pl['events'] : array();
                $eventsMins = isset($pl['eventsMinutes']) && is_array($pl['eventsMinutes']) ? $pl['eventsMinutes'] : array();

                foreach ($events as $idx => $evId) {
                    $evMinRaw = isset($eventsMins[$idx]) ? (int)$eventsMins[$idx] : 0;
                    $evMinAbs = abs($evMinRaw);
                    switch ((int)$evId) {
                        case 1: $counts['ammonito'] = 1; break;      // YellowCard
                        case 2: $counts['espulso'] = 1; break;       // RedCard
                        case 3: $counts['golfatto']++; break;        // GoalScored (azione)
                        case 4: $counts['golsubito']++; break;       // GoalConceded
                        case 7: $counts['rigoreparato']++; break;    // PenaltySaved
                        case 8: $counts['rigoresbagliato']++; break; // PenaltyNotScored
                        case 9: $counts['rigoresegnato']++; break;   // PenaltyScored (separato)
                        case 10: $counts['autogol']++; break;        // OwnGoal
                        case 11: $counts['golvittoria']++; break;    // WinningGoal
                        case 12: $counts['golpareggio']++; break;    // DrawingGoal
                        case 14:                                     // PlayerOut
                            $sostituzione = 1;
                            if ($evMinAbs > 0) $minuto = $evMinAbs;
                            break;
                        case 15:                                     // PlayerIn
                            $titolare = 0;
                            $sostituzione = 1;
                            if ($evMinAbs > 0) $minuto = $evMinAbs;
                            break;
                        case 16:                                     // CanceledGoal (VAR) -> ignora
                            break;
                        case 21:                                     // AssistSoft
                        case 22:                                     // Assist
                        case 23:                                     // AssistGold
                            $counts['assist']++;
                            break;
                        default:
                            break;
                    }
                }

                $votiRows[] = array(
                    $resolvedName,
                    $votoStr,
                    'SV',
                    (string)$counts['golfatto'],
                    (string)$counts['golsubito'],
                    (string)$counts['autogol'],
                    (string)$counts['ammonito'],
                    (string)$counts['espulso'],
                    (string)$counts['rigoresegnato'],
                    (string)$counts['rigoreparato'],
                    (string)$counts['rigoresbagliato'],
                    (string)$counts['assist'],
                    (string)$counts['golvittoria'],
                    (string)$counts['golpareggio'],
                    $teamName,
                    (string)$titolare,
                    (string)$sostituzione,
                    (string)$minuto,
                    $finaleVal
                );
            }
        }
    }

    return array(
        'partiteStato' => $partiteStato,
        'votiRows' => $votiRows,
        'hasMatchLive' => $hasMatchLive,
        'nonIdleMatches' => $nonIdleMatches
    );
}

/* ============================================================================
 * PARSER HTML SSR (/voti-fantacalcio-serie-a) + BRIDGE LIVE
 * ============================================================================ */

function fc_extract_header_live_bridge($html) {
    $res = array('seasonId' => 0, 'matchweek' => 0);
    if (!$html) return $res;
    if (preg_match('/HeaderLiveBridge\s*=\s*(\{.*?\})\s*;?/s', $html, $m)) {
        $bridge = @json_decode($m[1], true);
        if (is_array($bridge)) {
            $res['seasonId'] = isset($bridge['seasonId']) ? (int)$bridge['seasonId'] : 0;
            $res['matchweek'] = isset($bridge['matchweek']) ? (int)$bridge['matchweek'] : 0;
        }
    }
    return $res;
}

/**
 * Estrae slug stagione (es. "2026-27") e giornata selezionata dalla pagina SSR /voti-fantacalcio-serie-a.
 */
function fc_extract_ssr_selectors($html) {
    $seasonSlug = '';
    $matchweek = 0;
    if (!$html) return array($seasonSlug, $matchweek);

    if (preg_match('#<select[^>]*id=["\']season["\'][^>]*>(.*?)</select>#is', $html, $sm)) {
        if (preg_match('#<option[^>]*value=["\']([^"\']+)["\'][^>]*selected#i', $sm[1], $om) ||
            preg_match('#<option[^>]*selected[^>]*value=["\']([^"\']+)["\']#i', $sm[1], $om)) {
            $seasonSlug = str_replace('/', '-', trim($om[1]));
        } elseif (preg_match('#<option[^>]*value=["\']([^"\']+)["\']#i', $sm[1], $om)) {
            $seasonSlug = str_replace('/', '-', trim($om[1]));
        }
    }

    if (preg_match('#<select[^>]*id=["\']matchweek["\'][^>]*>(.*?)</select>#is', $html, $mm)) {
        if (preg_match('#<option[^>]*value=["\'](\d+)["\'][^>]*selected#i', $mm[1], $om) ||
            preg_match('#<option[^>]*selected[^>]*value=["\'](\d+)["\']#i', $mm[1], $om)) {
            $matchweek = (int)$om[1];
        }
    }

    return array($seasonSlug, $matchweek);
}

/**
 * Esegue il parsing delle tabelle voti SSR Fantacalcio.it in record VotoGiocatore + arrPartite.
 */
function fc_parse_ssr_html($html, $codFcToFcm, $nameFcToFcm) {
    $partiteStato = array();
    $votiRows = array();

    if (!is_string($html) || trim($html) === '' || !class_exists('DOMDocument')) {
        return array('partiteStato' => $partiteStato, 'votiRows' => $votiRows);
    }

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
    libxml_clear_errors();
    $xp = new DOMXPath($dom);

    $tables = $xp->query('//table[.//div[contains(@class,"team-info")] and .//a[contains(@class,"team-name")]]');
    if (!$tables || $tables->length === 0) {
        return array('partiteStato' => $partiteStato, 'votiRows' => $votiRows);
    }

    foreach ($tables as $tbl) {
        $teamNode = $xp->query('.//div[contains(@class,"team-info")]//a[contains(@class,"team-name")]', $tbl)->item(0);
        if (!$teamNode) continue;

        $rawTeam = trim($teamNode->textContent);
        if ($rawTeam === '') continue;

        $teamNorm = fc_normalize_team_name($rawTeam);
        fc_register_team_status($partiteStato, $rawTeam, '1');

        $rows = $xp->query('.//tbody/tr', $tbl);
        foreach ($rows as $tr) {
            $link = $xp->query('.//a[contains(@class,"player-link")]', $tr)->item(0);
            if (!$link) continue;

            $roleNode = $xp->query('.//span[contains(@class,"role")]', $tr)->item(0);
            $roleAttr = $roleNode ? strtolower(trim($roleNode->getAttribute('data-value'))) : '';
            if ($roleAttr === 'all') continue;

            $rawName = trim($link->textContent);
            $href = (string)$link->getAttribute('href');
            $codFC = 0;
            if (preg_match('#/(\d+)(?:/[\d-]+)?$#', $href, $hm)) {
                $codFC = (int)$hm[1];
            }

            $resolvedName = fc_resolve_player_name($codFC, $rawName, $codFcToFcm, $nameFcToFcm);
            if ($resolvedName === '') continue;

            $pills = $xp->query('.//div[contains(@class,"pill")]', $tr);
            $gradeNode = ($pills && $pills->length > 0)
                ? $xp->query('.//span[contains(@class,"player-grade")]', $pills->item(0))->item(0)
                : $xp->query('.//span[contains(@class,"player-grade")]', $tr)->item(0);

            $rawGrade = '';
            $gradeClass = '';
            if ($gradeNode) {
                $rawGrade = trim($gradeNode->getAttribute('data-value'));
                if ($rawGrade === '') {
                    $rawGrade = trim($gradeNode->textContent);
                }
                $gradeClass = ' ' . (string)$gradeNode->getAttribute('class') . ' ';
            }
            $votoStr = fc_format_vote($rawGrade);

            $ammonito = (preg_match('/\byellow-card\b/i', $gradeClass)) ? 1 : 0;
            $espulso = (preg_match('/\bred-card\b/i', $gradeClass)) ? 1 : 0;

            $titolare = 1;
            $sostituzione = 0;
            $subImgs = $xp->query('.//img[contains(@class,"player-icon")]', $tr);
            if ($subImgs && $subImgs->length > 0) {
                foreach ($subImgs as $img) {
                    $src = strtolower((string)$img->getAttribute('src'));
                    $title = strtolower((string)$img->getAttribute('title'));
                    if (strpos($src, 'in.webp') !== false || strpos($title, 'subentrat') !== false) {
                        $titolare = 0;
                        $sostituzione = 1;
                    } elseif (strpos($src, 'out.webp') !== false || strpos($title, 'sostituit') !== false) {
                        $titolare = 1;
                        $sostituzione = 1;
                    }
                }
            }

            $counts = array(
                'golfatto' => 0, 'golsubito' => 0, 'autogol' => 0,
                'rigoresegnato' => 0, 'rigoresbagliato' => 0,
                'rigoreparato' => 0, 'assist' => 0
            );

            $bonusSpans = $xp->query('.//span[contains(@class,"player-bonus")]', $tr);
            if ($bonusSpans) {
                foreach ($bonusSpans as $bs) {
                    $bTitle = strtolower(trim((string)$bs->getAttribute('title')));
                    $bRawVal = trim(str_replace(',', '.', (string)$bs->getAttribute('data-value')));
                    $bVal = is_numeric($bRawVal) ? (int)$bRawVal : 0;
                    if ($bVal <= 0) continue;

                    if (strpos($bTitle, 'gol segnati') !== false) {
                        $counts['golfatto'] = $bVal;
                    } elseif (strpos($bTitle, 'gol subiti') !== false) {
                        $counts['golsubito'] = $bVal;
                    } elseif (strpos($bTitle, 'autoret') !== false) {
                        $counts['autogol'] = $bVal;
                    } elseif (strpos($bTitle, 'rigori segnati') !== false) {
                        $counts['rigoresegnato'] = $bVal;
                    } elseif (strpos($bTitle, 'rigori sbagliati') !== false) {
                        $counts['rigoresbagliato'] = $bVal;
                    } elseif (strpos($bTitle, 'rigori parati') !== false) {
                        $counts['rigoreparato'] = $bVal;
                    } elseif (strpos($bTitle, 'assist') !== false) {
                        $counts['assist'] = $bVal;
                    }
                }
            }

            $votiRows[] = array(
                $resolvedName,
                $votoStr,
                'SV',
                (string)$counts['golfatto'],
                (string)$counts['golsubito'],
                (string)$counts['autogol'],
                (string)$ammonito,
                (string)$espulso,
                (string)$counts['rigoresegnato'],
                (string)$counts['rigoreparato'],
                (string)$counts['rigoresbagliato'],
                (string)$counts['assist'],
                '0', // golvittoria
                '0', // golpareggio
                $teamNorm,
                (string)$titolare,
                (string)$sostituzione,
                '0',
                '1'
            );
        }
    }

    return array(
        'partiteStato' => $partiteStato,
        'votiRows' => $votiRows
    );
}

/**
 * Serializza arrPartite e arrVoti in sintassi JS compatibile VotoGiocatore.
 */
function fc_render_voti_js($partiteStato, $votiRows) {
    $output = 'arrPartite = ' . json_encode($partiteStato, JSON_UNESCAPED_UNICODE) . ";\r\n";
    $output .= "arrStatoPartite = arrPartite;\r\n";
    $output .= "arrVoti = new Array();\r\n";
    foreach ($votiRows as $index => $args) {
        $argsJson = array_map(function($c) {
            return json_encode((string)$c, JSON_UNESCAPED_UNICODE);
        }, $args);
        $output .= 'arrVoti[' . (int)$index . '] = new VotoGiocatore(' . implode(',', $argsJson) . ");\r\n";
    }
    return $output;
}

/**
 * Client HTTP leggero via cURL con fallback stream PHP.
 */
function fc_http_request($url, $method = 'GET', $jsonBody = null, $timeout = 12) {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ModernFCM/3.0';
    $httpCode = 0;
    $body = false;
    $err = '';

    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_ENCODING, '');
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        fcm_apply_curl_ssl($ch);
        curl_setopt($ch, CURLOPT_USERAGENT, $ua);

        $headers = array(
            'Accept-Language: it-IT,it;q=0.9,en;q=0.8',
            'Origin: https://www.fantacalcio.it',
            'Referer: https://www.fantacalcio.it/'
        );
        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            $payload = is_string($jsonBody) ? $jsonBody : json_encode($jsonBody);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            $headers[] = 'Content-Type: application/json';
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $body = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        if (PHP_VERSION_ID < 80500) {
            curl_close($ch);
        }
        return array('ok' => ($body !== false && $httpCode >= 200 && $httpCode < 400), 'code' => $httpCode, 'body' => $body, 'error' => $err);
    }

    $headerStr = "Accept-Encoding: gzip, deflate\r\nAccept-Language: it-IT,it;q=0.9\r\nReferer: https://www.fantacalcio.it/\r\n";
    $httpOpts = array(
        'method' => strtoupper($method),
        'timeout' => $timeout,
        'user_agent' => $ua,
        'ignore_errors' => true
    );
    if (strtoupper($method) === 'POST') {
        $payload = is_string($jsonBody) ? $jsonBody : json_encode($jsonBody);
        $headerStr .= "Content-Type: application/json\r\n";
        $httpOpts['content'] = $payload;
    }
    $httpOpts['header'] = $headerStr;

    $ctx = stream_context_create(array(
        'ssl' => array('verify_peer' => true, 'verify_peer_name' => true),
        'http' => $httpOpts
    ));
    $fp = @fopen($url, 'rb', false, $ctx);
    if ($fp !== false) {
        $body = stream_get_contents($fp);
        $meta = stream_get_meta_data($fp);
        fclose($fp);
        if (isset($meta['wrapper_data']) && is_array($meta['wrapper_data']) && isset($meta['wrapper_data'][0]) && preg_match('/\s(\d{3})\s/', $meta['wrapper_data'][0], $hm)) {
            $httpCode = (int)$hm[1];
        }
    }
    if ($body !== false && substr($body, 0, 2) === "\x1f\x8b" && function_exists('gzdecode')) {
        $dec = @gzdecode($body);
        if ($dec !== false) $body = $dec;
    }

    return array(
        'ok' => ($body !== false && $httpCode >= 200 && $httpCode < 400),
        'code' => $httpCode,
        'body' => $body,
        'error' => ($body === false ? 'Stream request failed' : '')
    );
}

/* ============================================================================
 * ESECUZIONE PRINCIPALE (SOLO SE INVOCATO DIRETTAMENTE, NON IN TEST INCLUDE)
 * ============================================================================ */
if (!defined('LIVE_EXTRACT_FC_NO_AUTO_RUN')) {
    set_time_limit(300);

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

    $isAjax = !empty($_GET['ajax'])
        || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
        || (php_sapi_name() === 'cli');

    $rawGio = !empty($_GET['Gio']) ? $_GET['Gio'] : (!empty($_GET['cGio']) ? $_GET['cGio'] : (!empty($_GET['day']) ? $_GET['day'] : null));
    $requestedGio = ($rawGio !== null && is_numeric($rawGio) && (int)$rawGio > 0) ? (int)$rawGio : null;
    $forceRefresh = !empty($_GET['force']) && (string)$_GET['force'] !== '0';

    // Controllo rapido cache locale se la giornata coincide ed e' ancora fresca
    if (!$forceRefresh && $requestedGio !== null && file_exists(FC_VOTI_META_FILE) && file_exists(FC_VOTI_OUTPUT_FILE)) {
        $cachedMeta = @json_decode(@file_get_contents(FC_VOTI_META_FILE), true);
        if (is_array($cachedMeta) && isset($cachedMeta['giornataFC']) && (int)$cachedMeta['giornataFC'] === $requestedGio && isset($cachedMeta['timestamp'])) {
            $cacheTtl = !empty($cachedMeta['hasMatchLive']) ? 45 : 600;
            $age = time() - (int)$cachedMeta['timestamp'];
            if ($age >= 0 && $age < $cacheTtl && isset($cachedMeta['count']) && (int)$cachedMeta['count'] > 0) {
                if ($isAjax) {
                    if (!headers_sent()) {
                        header('Content-Type: application/json; charset=utf-8');
                        header('Cache-Control: no-cache, no-store, must-revalidate');
                    }
                    echo json_encode(array(
                        'success' => true,
                        'cached' => true,
                        'count' => (int)$cachedMeta['count'],
                        'source' => 'fantacalcio',
                        'method' => isset($cachedMeta['method']) ? $cachedMeta['method'] : 'cache',
                        'giornataFC' => (int)$cachedMeta['giornataFC'],
                        'hasMatchLive' => !empty($cachedMeta['hasMatchLive']),
                        'lastUpdated' => isset($cachedMeta['lastUpdated']) ? $cachedMeta['lastUpdated'] : date('d/m/Y H:i:s'),
                        'updated' => isset($cachedMeta['updated']) ? $cachedMeta['updated'] : date('H:i:s'),
                        'timestamp' => (int)$cachedMeta['timestamp'],
                        'message' => 'Voti Fantacalcio.it caricati dalla cache locale (' . (int)$cachedMeta['count'] . ' giocatori)'
                    ));
                    exit;
                }
            }
        }
    }

    // Caricamento associazioni unificate
    $baseDir = dirname(__DIR__);
    if (!isset($arrAssociazioni)) {
        if (file_exists(__DIR__ . '/data/liveVU_associazioni.php')) {
            include_once __DIR__ . '/data/liveVU_associazioni.php';
        } elseif (file_exists($baseDir . '/inc/data/liveVU_associazioni.php')) {
            include_once $baseDir . '/inc/data/liveVU_associazioni.php';
        }
    }
    list($codFcToFcm, $nameFcToFcm) = fc_build_assoc_maps(isset($arrAssociazioni) ? $arrAssociazioni : array());

    $success = false;
    $votiCount = 0;
    $hasMatchLive = false;
    $giornataFC = $requestedGio;
    $methodUsed = '';
    $errorMsg = null;

    $partiteStato = array();
    $votiRows = array();
    $datIdleSnapshot = null;

    // ------------------------------------------------------------------------
    // LAYER 1: LIVE PROTOBUF (.dat via SignedUri)
    // ------------------------------------------------------------------------
    $livePageRes = fc_http_request(FC_LIVE_PAGE_URL, 'GET', null, 10);
    $bridge = ($livePageRes['ok'] && $livePageRes['body']) ? fc_extract_header_live_bridge($livePageRes['body']) : array('seasonId' => 0, 'matchweek' => 0);

    $seasonId = (int)$bridge['seasonId'];
    $liveMatchweek = (int)$bridge['matchweek'];
    if ($giornataFC === null && $liveMatchweek > 0) {
        $giornataFC = $liveMatchweek;
    }

    if ($seasonId > 0 && $liveMatchweek > 0 && ($giornataFC === null || $giornataFC === $liveMatchweek)) {
        $targetDatUrl = sprintf(FC_DAT_URL_TEMPLATE, $seasonId, $liveMatchweek);
        $signRes = fc_http_request(FC_SIGNED_URI_URL, 'POST', array('resourcesUri' => array($targetDatUrl)), 10);
        if ($signRes['ok'] && $signRes['body']) {
            $signJson = @json_decode($signRes['body'], true);
            $signedUri = '';
            if (is_array($signJson)) {
                if (!empty($signJson['signedUri'])) {
                    $signedUri = $signJson['signedUri'];
                } elseif (!empty($signJson['signedUris'][0])) {
                    $signedUri = $signJson['signedUris'][0];
                } elseif (isset($signJson[0]) && is_string($signJson[0])) {
                    $signedUri = $signJson[0];
                }
            }
            if ($signedUri !== '') {
                $datRes = fc_http_request($signedUri, 'GET', null, 12);
                if ($datRes['ok'] && is_string($datRes['body']) && strlen($datRes['body']) > 0) {
                    try {
                        $matches = fc_pb_decode_live_message($datRes['body']);
                        if (!empty($matches)) {
                            $parsedDat = fc_extract_from_dat_matches($matches, $codFcToFcm, $nameFcToFcm);
                            if ($parsedDat['nonIdleMatches'] > 0 && !empty($parsedDat['votiRows'])) {
                                $partiteStato = $parsedDat['partiteStato'];
                                $votiRows = $parsedDat['votiRows'];
                                $hasMatchLive = $parsedDat['hasMatchLive'];
                                $giornataFC = $liveMatchweek;
                                $methodUsed = 'protobuf';
                            } else {
                                // Conserva lo stato delle partite (pre-kickoff) in caso neanche l'SSR abbia voti
                                $datIdleSnapshot = $parsedDat;
                            }
                        }
                    } catch (Throwable $e) {
                        $errorMsg = 'Errore decodifica Protobuf: ' . $e->getMessage();
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------------
    // LAYER 2: FALLBACK SSR (/voti-fantacalcio-serie-a/{seasonSlug}/{giornata})
    // ------------------------------------------------------------------------
    if ($methodUsed === '') {
        $ssrIndexRes = fc_http_request(FC_SSR_BASE_URL, 'GET', null, 12);
        if ($ssrIndexRes['ok'] && $ssrIndexRes['body']) {
            list($seasonSlug, $ssrSelectedMw) = fc_extract_ssr_selectors($ssrIndexRes['body']);
            if ($giornataFC === null && $ssrSelectedMw > 0) {
                $giornataFC = $ssrSelectedMw;
            }

            $ssrHtmlToParse = null;
            if ($giornataFC !== null && $ssrSelectedMw > 0 && $giornataFC === $ssrSelectedMw && strpos($ssrIndexRes['body'], 'player-link') !== false) {
                $ssrHtmlToParse = $ssrIndexRes['body'];
            } elseif ($seasonSlug !== '' && $giornataFC !== null) {
                $ssrDayUrl = FC_SSR_BASE_URL . '/' . rawurlencode($seasonSlug) . '/' . (int)$giornataFC;
                $ssrDayRes = fc_http_request($ssrDayUrl, 'GET', null, 12);
                if ($ssrDayRes['ok'] && $ssrDayRes['body']) {
                    $ssrHtmlToParse = $ssrDayRes['body'];
                } elseif (!$errorMsg) {
                    $errorMsg = 'Pagina voti Fantacalcio.it non disponibile (HTTP ' . $ssrDayRes['code'] . ')';
                }
            } elseif (strpos($ssrIndexRes['body'], 'player-link') !== false) {
                $ssrHtmlToParse = $ssrIndexRes['body'];
            }

            if ($ssrHtmlToParse !== null) {
                $parsedSsr = fc_parse_ssr_html($ssrHtmlToParse, $codFcToFcm, $nameFcToFcm);
                if (!empty($parsedSsr['votiRows'])) {
                    $partiteStato = $parsedSsr['partiteStato'];
                    $votiRows = $parsedSsr['votiRows'];
                    $hasMatchLive = false;
                    $methodUsed = 'ssr';
                }
            }
        } elseif (!$errorMsg) {
            $errorMsg = 'Impossibile collegarsi a Fantacalcio.it' . ($ssrIndexRes['error'] ? ': ' . $ssrIndexRes['error'] : ' (HTTP ' . $ssrIndexRes['code'] . ')');
        }
    }

    // Se sia Layer 1 (.dat tutto Idle pre-kickoff) sia Layer 2 non hanno voti emessi,
    // preserva uno snapshot pulito pre-gara (arrPartite con '' e arrVoti vuoto) se il .dat aveva le gare.
    if ($methodUsed === '' && $datIdleSnapshot !== null && !empty($datIdleSnapshot['partiteStato'])) {
        $partiteStato = $datIdleSnapshot['partiteStato'];
        $votiRows = array();
        $hasMatchLive = false;
        $methodUsed = 'protobuf';
    }

    $votiCount = count($votiRows);
    if ($methodUsed !== '' && ($votiCount > 0 || !empty($partiteStato))) {
        $jsContent = fc_render_voti_js($partiteStato, $votiRows);
        $tmpOut = FC_VOTI_OUTPUT_FILE . '.' . uniqid('tmp', true);
        if (@file_put_contents($tmpOut, $jsContent, LOCK_EX) !== false) {
            @rename($tmpOut, FC_VOTI_OUTPUT_FILE);
            $success = true;
        } else {
            $success = (@file_put_contents(FC_VOTI_OUTPUT_FILE, $jsContent, LOCK_EX) !== false);
        }

        if ($success) {
            $metaFC = array(
                'source' => 'fantacalcio',
                'method' => $methodUsed,
                'giornataFC' => $giornataFC,
                'hasMatchLive' => $hasMatchLive,
                'count' => $votiCount,
                'timestamp' => time(),
                'lastUpdated' => date('d/m/Y H:i:s'),
                'updated' => date('H:i:s')
            );
            $tmpMeta = FC_VOTI_META_FILE . '.' . uniqid('tmp', true);
            $metaJson = json_encode($metaFC, JSON_PRETTY_PRINT);
            if (@file_put_contents($tmpMeta, $metaJson, LOCK_EX) !== false) {
                @rename($tmpMeta, FC_VOTI_META_FILE);
            } else {
                @file_put_contents(FC_VOTI_META_FILE, $metaJson, LOCK_EX);
            }
            $errorMsg = null;
        } else {
            $errorMsg = 'Impossibile scrivere il file js/fcmVotiDatiFC.js';
        }
    } elseif (!$errorMsg) {
        $errorMsg = 'Nessun voto disponibile su Fantacalcio.it per la giornata richiesta';
    }

    if ($isAjax) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
        }
        echo json_encode(array(
            'success' => $success,
            'cached' => false,
            'count' => $votiCount,
            'source' => 'fantacalcio',
            'method' => $methodUsed,
            'giornataFC' => $giornataFC,
            'hasMatchLive' => $hasMatchLive,
            'error' => $success ? null : $errorMsg,
            'timestamp' => time(),
            'lastUpdated' => date('d/m/Y H:i:s'),
            'updated' => date('H:i:s')
        ));
        exit;
    }
}
