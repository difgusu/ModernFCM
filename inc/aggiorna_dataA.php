<?php
/**
 * Sincronizza gli orari delle giornate di Serie A in js/DataA.js:
 * 1) Da arrDateA in js/fcmSerieADati.js (appeso dal plugin Invio Formazione di johndoe);
 * 2) In subordine, dall'endpoint orariseriea di johndoe per l'anno della stagione in corso.
 */

require_once __DIR__ . '/admin_security.inc.php';

if (!function_exists('fcm_get_current_season_start_year')) {
    function fcm_get_current_season_start_year($baseDir) {
        $legaPath = rtrim((string)$baseDir, "/\\") . '/js/fcmLegaDati.js';
        if (is_file($legaPath) && is_readable($legaPath)) {
            $raw = @file_get_contents($legaPath);
            if ($raw !== false && preg_match('/(?:^|[\r\n;])\s*(?:var\s+)?anno\s*=\s*["\']\s*(\d{4})(?:\s*[\/\-]\s*\d{2,4})?\s*["\']/i', $raw, $m)) {
                return (int)$m[1];
            }
        }
        $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Rome'));
        $month = (int)$now->format('n');
        $year = (int)$now->format('Y');
        return ($month >= 7) ? $year : ($year - 1);
    }
}

if (!function_exists('fcm_format_dataA_date_value')) {
    function fcm_format_dataA_date_value($rawDateStr) {
        $clean = trim((string)$rawDateStr, " \t\n\r\0\x0B\"'");
        if ($clean === '') {
            return null;
        }
        // Normalizza il formato HH.MM restituito dal servizio di johndoe (es. "2026-08-22 18.30")
        $normalized = preg_replace_callback(
            '/(\d{4}-\d{2}-\d{2}[T\s]\d{1,2})\.(\d{2})(?:\.(\d{2}))?/',
            function ($m) {
                return $m[1] . ':' . $m[2] . (isset($m[3]) && $m[3] !== '' ? ':' . $m[3] : '');
            },
            $clean
        );
        $romeTz = new DateTimeZone('Europe/Rome');
        try {
            $dt = new DateTimeImmutable($normalized, $romeTz);
            $dt = $dt->setTimezone($romeTz);
        } catch (Exception $e) {
            return null;
        }
        if ((int)$dt->format('Y') < 1990) {
            return null;
        }
        return $dt->format('F j Y H:i');
    }
}

if (!function_exists('fcm_parse_arrDateA_from_file')) {
    function fcm_parse_arrDateA_from_file($serieAPath) {
        if (!is_file($serieAPath) || !is_readable($serieAPath)) {
            return [];
        }
        $content = @file_get_contents($serieAPath);
        if ($content === false || !preg_match('/(?:^|[;\r\n])[ \t]*((?:var\s+)?arrDateA\s*=)/im', $content, $m, PREG_OFFSET_CAPTURE)) {
            return [];
        }

        // Isola solo il blocco arrDateA evitando collisioni con a[i]=new IncontroA(...) o blocchi successivi
        $tail = substr($content, $m[1][1]);
        if (preg_match('/\R[ \t]*var\s+(?!arrDateA\b)(?![a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*arrDateA\b)[a-zA-Z_$]/', $tail, $stopMatch, PREG_OFFSET_CAPTURE)) {
            $tail = substr($tail, 0, $stopMatch[0][1]);
        }

        $targetPattern = 'arrDateA';
        if (preg_match('/^\s*(?:var\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*arrDateA\b/m', $tail, $aliasMatch)) {
            $targetPattern = '(?:arrDateA|' . preg_quote($aliasMatch[1], '/') . ')';
        }

        if (!preg_match_all('/\b' . $targetPattern . '\[(\d+)\]\s*=\s*new\s+Date\s*\(([^)]+)\)/', $tail, $matches, PREG_SET_ORDER)) {
            return [];
        }

        $out = [];
        foreach ($matches as $row) {
            $idx = (int)$row[1];
            if ($idx <= 0) {
                continue;
            }
            $arg = trim($row[2]);
            $formatted = null;
            if (preg_match('/^(["\'])(.+)\1$/s', $arg, $qm)) {
                $formatted = fcm_format_dataA_date_value($qm[2]);
            } elseif (preg_match('/^(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})(?:\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})(?:\s*,\s*(\d{1,2}))?)?$/', $arg, $nm)) {
                $m0 = (int)$nm[2];
                if ($m0 >= 0 && $m0 <= 11) {
                    $iso = sprintf(
                        '%04d-%02d-%02d %02d:%02d:%02d',
                        (int)$nm[1],
                        $m0 + 1,
                        (int)$nm[3],
                        isset($nm[4]) ? (int)$nm[4] : 0,
                        isset($nm[5]) ? (int)$nm[5] : 0,
                        isset($nm[6]) ? (int)$nm[6] : 0
                    );
                    $formatted = fcm_format_dataA_date_value($iso);
                }
            }
            if ($formatted !== null) {
                $out[$idx] = $formatted;
            }
        }

        ksort($out, SORT_NUMERIC);
        return $out;
    }
}

if (!function_exists('fcm_parse_johndoe_orari_json')) {
    function fcm_parse_johndoe_orari_json($raw) {
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }
        $json = json_decode($raw, true);
        if (!is_array($json) || empty($json['orari']) || !is_array($json['orari'])) {
            return [];
        }

        $out = [];
        foreach ($json['orari'] as $k => $v) {
            if (!is_string($v) && !is_numeric($v)) {
                continue;
            }
            if (preg_match('/^(\d+)\s*a?$/i', trim((string)$k), $km)) {
                $idx = (int)$km[1];
                if ($idx > 0) {
                    $formatted = fcm_format_dataA_date_value((string)$v);
                    if ($formatted !== null) {
                        $out[$idx] = $formatted;
                    }
                }
            }
        }

        ksort($out, SORT_NUMERIC);
        return $out;
    }
}

if (!function_exists('fcm_fetch_johndoe_orari')) {
    function fcm_fetch_johndoe_orari($anno, $timeout = 8, $endpointUrl = null) {
        $url = $endpointUrl ?: ('https://a-c-m-e.com/j-o-h-n-d-o-e/jdPI4FCM_v2/services.php?servizio=orariseriea&anno=' . (int)$anno);
        $raw = false;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch) {
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(4, max(1, (int)$timeout)));
                curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int)$timeout));
                curl_setopt($ch, CURLOPT_USERAGENT, 'ModernFCM-DataA-Updater/1.0');
                fcm_apply_curl_ssl($ch);
                $resp = curl_exec($ch);
                $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $errno = curl_errno($ch);
                if (PHP_VERSION_ID < 80000) {
                    curl_close($ch);
                }
                if ($errno === 0 && $code === 200 && is_string($resp) && $resp !== '') {
                    $raw = $resp;
                }
            }
        } else {
            $ctx = stream_context_create([
                'http' => [
                    'method'  => 'GET',
                    'timeout' => max(1, (int)$timeout),
                    'header'  => "User-Agent: ModernFCM-DataA-Updater/1.0\r\n",
                ],
                'ssl' => [
                    'verify_peer'      => true,
                    'verify_peer_name' => true,
                ],
            ]);
            $resp = @file_get_contents($url, false, $ctx);
            if (is_string($resp) && $resp !== '') {
                $raw = $resp;
            }
        }

        return fcm_parse_johndoe_orari_json($raw);
    }
}

if (!function_exists('fcm_update_dataA_js_content')) {
    function fcm_update_dataA_js_content($currentContent, array $scheduleMap) {
        if (empty($scheduleMap)) {
            return (string)$currentContent;
        }
        ksort($scheduleMap, SORT_NUMERIC);
        $currentContent = (string)$currentContent;
        $eol = (strpos($currentContent, "\r\n") !== false || $currentContent === '') ? "\r\n" : "\n";

        if (trim($currentContent) === '') {
            $lines = [
                'var dataGiornata = new Array()',
                '// Immettere le date nel formato inglese: Mese Giorno Anno',
            ];
            foreach ($scheduleMap as $idx => $val) {
                $lines[] = 'dataGiornata[' . (int)$idx . '] = "' . $val . '"';
            }
            $lines[] = '';
            $lines[] = 'function initArray() {';
            $lines[] = '   this.length = initArray.arguments.length';
            $lines[] = '    for (var i = 0; i < this.length; i++)';
            $lines[] = '    this[i+1] = initArray.arguments[i]';
            $lines[] = '}';
            $lines[] = 'var DOWArray = new initArray("Dom","Lun","Mar","Mer","Gio","Ven","Sab")';
            $lines[] = 'var MOYArray = new initArray("Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic")';
            $lines[] = 'var Year,Ore,Minuti';
            $lines[] = '';
            $lines[] = 'for (t = 1; t < dataGiornata.length ;t++ ) {';
            $lines[] = '   data = new Date(dataGiornata[t])';
            $lines[] = '   Year = data.getFullYear()';
            $lines[] = '   if(data.getHours()<=9?Ore="0"+data.getHours():Ore=data.getHours())';
            $lines[] = '   if(data.getMinutes()<=9?Minuti="0"+data.getMinutes():Minuti=data.getMinutes())';
            $lines[] = '   dataGiornata[t] = DOWArray[(data.getDay()+1)] + " " + data.getDate() + " " + MOYArray[(data.getMonth()+1)] + " " + Year + " ore " + Ore +":" + Minuti';
            $lines[] = '}';
            return implode($eol, $lines);
        }

        $handled = [];
        $updated = preg_replace_callback(
            '/^([ \t]*dataGiornata\[(\d+)\]\s*=\s*)(["\'])[^\r\n]*?\3([ \t]*;?(?:[ \t]*\/\/[^\r\n]*)?)(?=\r?$)/m',
            function ($m) use ($scheduleMap, &$handled) {
                $idx = (int)$m[2];
                if (!isset($scheduleMap[$idx])) {
                    return $m[0];
                }
                $handled[$idx] = true;
                return $m[1] . '"' . $scheduleMap[$idx] . '"' . $m[4];
            },
            $currentContent
        );
        if ($updated === null) {
            return $currentContent;
        }

        $missing = array_diff_key($scheduleMap, $handled);
        if (!empty($missing)) {
            $insertLines = [];
            foreach ($missing as $idx => $val) {
                $insertLines[] = 'dataGiornata[' . (int)$idx . '] = "' . $val . '"';
            }
            $insertBlock = implode($eol, $insertLines);
            if (preg_match_all('/^[ \t]*dataGiornata\[\d+\]\s*=[^\r\n]*(?=\r?$)/m', $updated, $allMatches, PREG_OFFSET_CAPTURE)) {
                $last = end($allMatches[0]);
                $pos = $last[1] + strlen($last[0]);
                $updated = substr($updated, 0, $pos) . $eol . $insertBlock . substr($updated, $pos);
            } elseif (preg_match('/^[ \t]*function\s+initArray\b/m', $updated, $initMatch, PREG_OFFSET_CAPTURE)) {
                $pos = $initMatch[0][1];
                $updated = substr($updated, 0, $pos) . $insertBlock . $eol . substr($updated, $pos);
            } else {
                $updated = rtrim($updated, "\r\n") . $eol . $insertBlock . $eol;
            }
        }

        return $updated;
    }
}

if (!function_exists('fcm_dataA_giornate_recenti')) {
    /**
     * Giornate di Serie A che secondo gli orari di js/DataA.js (ora italiana) sono iniziate da non
     * piu' di $maxDays giorni: quella in corso e le ultime giocate. Il limite esclude gli orari
     * rimasti da una stagione precedente. Restituisce i numeri di giornata: nessuno se il file
     * manca o non contiene orari leggibili.
     */
    function fcm_dataA_giornate_recenti($baseDir, $now = null, $maxDays = 30) {
        $raw = @file_get_contents(rtrim((string)$baseDir, "/\\") . '/js/DataA.js');
        if (!is_string($raw) || !preg_match_all('/^[ \t]*dataGiornata\[(\d+)\]\s*=\s*(["\'])([^"\'\r\n]+)\2/m', $raw, $righe, PREG_SET_ORDER)) {
            return [];
        }
        $now = ($now !== null) ? (int)$now : time();
        $oldest = $now - max(1, (int)$maxDays) * 86400;
        $romeTz = new DateTimeZone('Europe/Rome');
        $recenti = [];
        foreach ($righe as $riga) {
            // Solo orari nel formato scritto dal sito ('F j Y H:i', o senza ora): un testo libero come
            // 'now' o 'today' non deve far risultare iniziata una giornata
            $testo = trim($riga[3]);
            $dt = DateTimeImmutable::createFromFormat('!F j Y H:i', $testo, $romeTz);
            if ($dt === false) {
                $dt = DateTimeImmutable::createFromFormat('!F j Y', $testo, $romeTz);
            }
            if ($dt === false) {
                continue;
            }
            $inizio = $dt->getTimestamp();
            if ($inizio <= $now && $inizio >= $oldest) {
                $recenti[(int)$riga[1]] = true;
            }
        }
        return array_keys($recenti);
    }
}

if (!function_exists('fcm_sync_dataA')) {
    function fcm_sync_dataA($baseDir, array $options = []) {
        $baseDir = rtrim((string)$baseDir, "/\\");
        $force = !empty($options['force']);
        $allowRemote = array_key_exists('remote', $options) ? (bool)$options['remote'] : true;
        $ttl = isset($options['ttl']) ? max(60, (int)$options['ttl']) : 21600;
        $timeout = isset($options['timeout']) ? max(1, (int)$options['timeout']) : 8;
        $remoteForceCooldown = isset($options['remoteForceCooldown']) ? max(0, (int)$options['remoteForceCooldown']) : 0;
        $remoteCooldown = isset($options['remoteCooldown']) ? max(0, (int)$options['remoteCooldown']) : 0;
        $now = isset($options['now']) ? (int)$options['now'] : time();
        $fetcher = (isset($options['fetcher']) && is_callable($options['fetcher'])) ? $options['fetcher'] : 'fcm_fetch_johndoe_orari';

        $dataAPath = $baseDir . '/js/DataA.js';
        $serieAPath = $baseDir . '/js/fcmSerieADati.js';
        $metaPath = $baseDir . '/js/DataAMeta.json';

        $anno = fcm_get_current_season_start_year($baseDir);
        clearstatcache(true, $dataAPath);
        clearstatcache(true, $serieAPath);
        $dataAMtime = is_file($dataAPath) ? (int)@filemtime($dataAPath) : null;
        $serieAMtime = is_file($serieAPath) ? (int)@filemtime($serieAPath) : null;

        $meta = null;
        if (is_file($metaPath) && is_readable($metaPath)) {
            $decoded = json_decode((string)@file_get_contents($metaPath), true);
            if (is_array($decoded)) {
                $meta = $decoded;
            }
        }

        // Controllo mtime congiunto (fcmSerieADati + DataA): evita di usare cache stantie se l'utente ricarica DataA.js via FTP
        $sameState = is_array($meta)
            && array_key_exists('serieAMtime', $meta) && $meta['serieAMtime'] === $serieAMtime
            && array_key_exists('dataAMtime', $meta) && $meta['dataAMtime'] === $dataAMtime
            && (int)($meta['anno'] ?? 0) === $anno;

        if (!$force && $sameState) {
            $metaSource = (string)($meta['source'] ?? '');
            if ($metaSource === 'arrDateA') {
                return [
                    'updated'     => false,
                    'status'      => 'cached',
                    'source'      => 'arrDateA',
                    'anno'        => $anno,
                    'count'       => (int)($meta['count'] ?? 0),
                    'needsRemote' => false,
                ];
            }
            if ($metaSource === 'johndoe' || $metaSource === 'johndoe_unavailable') {
                $age = $now - (int)($meta['lastCheck'] ?? 0);
                if ($age >= 0 && $age < $ttl) {
                    return [
                        'updated'     => false,
                        'status'      => 'cached',
                        'source'      => $metaSource,
                        'anno'        => $anno,
                        'count'       => (int)($meta['count'] ?? 0),
                        'needsRemote' => false,
                    ];
                }
            }
        }

        // Priorita 1: arrDateA dentro js/fcmSerieADati.js
        $schedule = fcm_parse_arrDateA_from_file($serieAPath);
        $source = !empty($schedule) ? 'arrDateA' : null;

        // Priorita 2 (in subordine): API orariseriea di johndoe
        if (empty($schedule)) {
            if (!$allowRemote) {
                return [
                    'updated'     => false,
                    'status'      => 'needs_remote',
                    'source'      => null,
                    'anno'        => $anno,
                    'count'       => 0,
                    'needsRemote' => true,
                ];
            }
            if ($force && $remoteForceCooldown > 0 && is_array($meta) && isset($meta['lastCheck'])) {
                $sinceLast = $now - (int)$meta['lastCheck'];
                if ($sinceLast >= 0 && $sinceLast < $remoteForceCooldown) {
                    return [
                        'updated'     => false,
                        'status'      => 'cooldown',
                        'source'      => $meta['source'] ?? null,
                        'anno'        => $anno,
                        'count'       => (int)($meta['count'] ?? 0),
                        'needsRemote' => false,
                    ];
                }
            }

            // Limite condiviso tra tutte le richieste: anche se i metadati mancano o non si possono
            // scrivere, il servizio esterno non viene contattato a ogni richiesta
            if ($remoteCooldown > 0 && !fcm_cooldown_acquire('dataA', $remoteCooldown)) {
                return [
                    'updated'     => false,
                    'status'      => 'cooldown',
                    'source'      => is_array($meta) ? ($meta['source'] ?? null) : null,
                    'anno'        => $anno,
                    'count'       => is_array($meta) ? (int)($meta['count'] ?? 0) : 0,
                    'needsRemote' => false,
                ];
            }

            $schedule = ($fetcher === 'fcm_fetch_johndoe_orari')
                ? fcm_fetch_johndoe_orari($anno, $timeout)
                : (array)call_user_func($fetcher, $anno, $timeout);

            if (empty($schedule)) {
                $failMeta = [
                    'source'      => 'johndoe_unavailable',
                    'anno'        => $anno,
                    'serieAMtime' => $serieAMtime,
                    'dataAMtime'  => $dataAMtime,
                    'lastCheck'   => $now,
                    'count'       => (int)($meta['count'] ?? 0),
                ];
                @fcm_write_file_atomic($metaPath, json_encode($failMeta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                return [
                    'updated'     => false,
                    'status'      => 'unavailable',
                    'source'      => null,
                    'anno'        => $anno,
                    'count'       => 0,
                    'needsRemote' => false,
                ];
            }
            $source = 'johndoe';
        }

        $oldContent = (is_file($dataAPath) && is_readable($dataAPath)) ? (string)@file_get_contents($dataAPath) : '';
        $newContent = fcm_update_dataA_js_content($oldContent, $schedule);
        $changed = ($newContent !== $oldContent);

        if ($changed) {
            if (!fcm_write_file_atomic($dataAPath, $newContent)) {
                return [
                    'updated'     => false,
                    'status'      => 'write_error',
                    'source'      => $source,
                    'anno'        => $anno,
                    'count'       => count($schedule),
                    'needsRemote' => false,
                    'error'       => 'Impossibile scrivere js/DataA.js',
                ];
            }
            clearstatcache(true, $dataAPath);
            $dataAMtime = is_file($dataAPath) ? (int)@filemtime($dataAPath) : $dataAMtime;
        }

        $newMeta = [
            'source'      => $source,
            'anno'        => $anno,
            'serieAMtime' => $serieAMtime,
            'dataAMtime'  => $dataAMtime,
            'lastCheck'   => $now,
            'count'       => count($schedule),
        ];
        @fcm_write_file_atomic($metaPath, json_encode($newMeta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return [
            'updated'     => $changed,
            'status'      => $changed ? 'updated' : 'up_to_date',
            'source'      => $source,
            'anno'        => $anno,
            'count'       => count($schedule),
            'needsRemote' => false,
        ];
    }
}

if (!defined('FCM_AGGIORNA_DATAA_HELPERS_ONLY')) {
    if (empty($_GET) && getenv('QUERY_STRING')) {
        parse_str((string)getenv('QUERY_STRING'), $_GET);
    }
    // La forzatura vale solo da riga di comando e per l'admin autenticato
    $force = (isset($_GET['force']) && ($_GET['force'] == '1' || $_GET['force'] === 'true') && (PHP_SAPI === 'cli' || fcm_admin_session_active(true)))
        || (PHP_SAPI === 'cli' && in_array('--force', $argv ?? [], true));

    $res = fcm_sync_dataA(dirname(__DIR__), [
        'force'               => $force,
        'remote'              => true,
        'remoteForceCooldown' => (PHP_SAPI === 'cli' ? 0 : 60),
        'remoteCooldown'      => (PHP_SAPI === 'cli' ? 0 : 60),
    ]);

    if (PHP_SAPI !== 'cli' && !headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');
    }
    echo json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . (PHP_SAPI === 'cli' ? "\n" : '');
}
