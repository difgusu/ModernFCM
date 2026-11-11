<?php
/**
 * ModernFCM - API Storico & Archivio SQLite
 * Fornisce dati storici di Lega e Serie A direttamente dai database SQLite (.sqlite)
 * Sostituisce completamente i file persjs/*Dati.js con query veloci (<5ms)
 * e cache JSON statiche per prestazioni istantanee.
 */

require_once __DIR__ . '/admin_security.inc.php';

// Se invocato da CLI, gestisci query string da argv
if (php_sapi_name() === 'cli') {
    $argStr = implode('&', array_slice($argv ?? [], 1));
    if (!empty($argStr)) {
        if (!str_contains($argStr, '=')) {
            $_GET['action'] = $argStr;
        } else {
            parse_str($argStr, $_GET);
        }
    }
}

// Fallback per ambienti CLI/CGI o server interni dove QUERY_STRING è in $_SERVER
if (empty($_GET) && !empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $_GET);
}

if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
}

// Modular guard: verifica se il modulo Storico Avanzato è attivo
$fcmVarFile = __DIR__ . '/../js/fcmVariabili.js';
if (file_exists($fcmVarFile)) {
    $raw = @file_get_contents($fcmVarFile);
    if (preg_match('/var\s+ModStoricoAvanzato\s*=\s*["\']?(.*?)["\']?\s*;?$/m', $raw, $m)) {
        $val = strtolower(trim($m[1]));
        if ($val === 'no' || $val === '0' || $val === 'false') {
            if (php_sapi_name() !== 'cli') http_response_code(403);
            echo json_encode(['error' => 'Modulo Storico Avanzato disabilitato'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

$action = $_GET['action'] ?? 'stagioni';
$sqliteBase = realpath(__DIR__ . '/../sqlite');

if (!$sqliteBase || !is_dir($sqliteBase)) {
    if (php_sapi_name() !== 'cli') http_response_code(404);
    echo json_encode(['error' => 'Cartella sqlite non trovata'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!function_exists('getFallbackSeasonYear')) {
    function getFallbackSeasonYear($sqliteBase, $seasonId) {
        static $anchors = [];
        $baseKey = (string)$sqliteBase;
        if (!array_key_exists($baseKey, $anchors)) {
            $anchors[$baseKey] = null;
            $subDirs = glob($sqliteBase . '/stagione_*') ?: [];
            $candidates = [];
            foreach ($subDirs as $dir) {
                if (preg_match('/stagione_(\d+)$/', $dir, $m)) {
                    $num = (int)$m[1];
                    $legaDb = "$dir/lega_$num.sqlite";
                    if (file_exists($legaDb)) {
                        $candidates[$num] = $legaDb;
                    }
                }
            }
            krsort($candidates);
            foreach ($candidates as $num => $legaDb) {
                try {
                    $db = new PDO("sqlite:$legaDb", null, null, [PDO::ATTR_TIMEOUT => 2]);
                    $row = $db->query("SELECT AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    if ($row && !empty($row['AnnoArchivio'])) {
                        $anchors[$baseKey] = ['id' => (int)$num, 'anno' => (int)$row['AnnoArchivio']];
                        break;
                    }
                } catch (Exception $e) {}
            }
        }
        $anchor = $anchors[$baseKey];
        if ($anchor) {
            return $anchor['anno'] + ((int)$seasonId - $anchor['id']);
        }
        return (int)date('Y');
    }
}

if (!function_exists('getLatestCreditiTotali')) {
    function getLatestCreditiTotali($sqliteBase, $seasons = null) {
        if ($seasons === null) {
            $seasons = getStagioniDisponibili($sqliteBase);
        }
        foreach ($seasons as $sInfo) {
            $legaDb = $sInfo['lega_db'] ?? null;
            if (!$legaDb || !file_exists($legaDb)) continue;
            try {
                $db = new PDO("sqlite:$legaDb", null, null, [PDO::ATTR_TIMEOUT => 2]);
                $row = $db->query("SELECT CreditiTotali FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                if ($row && !empty($row['CreditiTotali']) && (float)$row['CreditiTotali'] > 0) {
                    return (float)$row['CreditiTotali'];
                }
            } catch (Exception $e) {}
        }
        return 500.0;
    }
}

if (!function_exists('getStagioniDisponibili')) {
    function getStagioniDisponibili($sqliteBase) {
        $seasons = [];
        $subDirs = glob($sqliteBase . '/stagione_*') ?: [];
        $parsedMeta = [];
        $anchor = null;
        foreach ($subDirs as $dir) {
            if (preg_match('/stagione_(\d+)$/', $dir, $m)) {
                $num = (int)$m[1];
                $legaDb = "$dir/lega_$num.sqlite";
                $serieaDb = "$dir/seriea_$num.sqlite";
                if (file_exists($legaDb)) {
                    $anno = null;
                    $nomeLega = "Stagione $num";
                    try {
                        $db = new PDO("sqlite:$legaDb", null, null, [PDO::ATTR_TIMEOUT => 2]);
                        $row = $db->query("SELECT Nome, Stagione, AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                        if ($row) {
                            if (!empty($row['AnnoArchivio'])) $anno = (int)$row['AnnoArchivio'];
                            if (!empty($row['Nome'])) $nomeLega = $row['Nome'];
                        }
                    } catch (Exception $e) {}

                    if ($anno !== null && ($anchor === null || $num > $anchor['id'])) {
                        $anchor = ['id' => $num, 'anno' => $anno];
                    }

                    $parsedMeta[] = [
                        'id' => $num,
                        'anno' => $anno,
                        'nome_lega' => $nomeLega,
                        'cartella' => "stagione_$num",
                        'lega_db' => $legaDb,
                        'seriea_db' => file_exists($serieaDb) ? $serieaDb : null
                    ];
                }
            }
        }
        foreach ($parsedMeta as $meta) {
            $anno = $meta['anno'] !== null
                ? $meta['anno']
                : ($anchor ? ($anchor['anno'] + ($meta['id'] - $anchor['id'])) : (int)date('Y'));
            $seasons[] = [
                'id' => $meta['id'],
                'anno' => $anno,
                'anni_stagione' => "$anno/" . ($anno + 1),
                'nome_lega' => $meta['nome_lega'],
                'cartella' => $meta['cartella'],
                'lega_db' => $meta['lega_db'],
                'seriea_db' => $meta['seriea_db']
            ];
        }
        usort($seasons, fn($a, $b) => $b['id'] - $a['id']);
        return $seasons;
    }
}

if (!function_exists('getLatestSqliteMtime')) {
    function getLatestSqliteMtime($sqliteBase, $seasonId = null) {
        static $cachedMtime = [];
        $key = $seasonId ? (int)$seasonId : 'all';
        if (isset($cachedMtime[$key])) {
            return $cachedMtime[$key];
        }

        $max = 0;
        if ($seasonId !== null) {
            $files = glob($sqliteBase . "/stagione_{$seasonId}/*.sqlite");
            if ($files) {
                foreach ($files as $f) {
                    $mt = @filemtime($f);
                    if ($mt > $max) $max = $mt;
                }
            }
        } else {
            $files = glob($sqliteBase . '/stagione_*/*.sqlite');
            if ($files) {
                foreach ($files as $f) {
                    $mt = @filemtime($f);
                    if ($mt > $max) $max = $mt;
                }
            }
            foreach (['ranking_config.json', 'franchise_map.json'] as $cfg) {
                $f = "$sqliteBase/$cfg";
                if (file_exists($f)) {
                    $mt = @filemtime($f);
                    if ($mt > $max) $max = $mt;
                }
            }
        }

        $cachedMtime[$key] = $max;
        return $max;
    }
}

if (!function_exists('isCacheValid')) {
    function isCacheValid($cacheFile, $sqliteBase, $seasonId = null) {
        if (!file_exists($cacheFile)) return false;
        $size = @filesize($cacheFile);
        if ($size === false || $size === 0) return false;

        $cacheMtime = @filemtime($cacheFile);
        if (!$cacheMtime) return false;

        $latestDbMtime = getLatestSqliteMtime($sqliteBase, $seasonId);
        return $cacheMtime >= $latestDbMtime;
    }
}

if (!function_exists('serveCacheFile')) {
    function serveCacheFile($filePath) {
        while (ob_get_level()) {
            ob_end_clean();
        }

        $mtime = @filemtime($filePath) ?: time();
        $etag = '"' . md5_file($filePath) . '"';

        $ifModifiedSince = isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) ? strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) : false;
        $ifNoneMatch = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH']) : false;

        if (($ifNoneMatch && $ifNoneMatch === $etag) || ($ifModifiedSince && $ifModifiedSince >= $mtime)) {
            header('HTTP/1.1 304 Not Modified');
            exit;
        }

        header('Content-Type: application/json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . filesize($filePath));
        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
        header('ETag: ' . $etag);
        header('Cache-Control: public, no-cache');
        readfile($filePath);
        exit;
    }
}

if (!function_exists('getFranchiseResolver')) {
    function getFranchiseResolver($sqliteBase, $latestSeasonId) {
        $override = [];
        $mapFile = "$sqliteBase/franchise_map.json";
        if (file_exists($mapFile)) {
            $override = json_decode(file_get_contents($mapFile), true) ?: [];
        }

        $masterPath = "$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite";
        if ((int)$latestSeasonId <= 0 || !file_exists($masterPath)) {
            $fallback = function($s, $localId, $nome = '', $pres = '') use ($override) {
                return isset($override[$s][$localId]) ? (int)$override[$s][$localId] : (int)$localId;
            };
            return [
                'resolver' => $fallback,
                'autoResolver' => function($s, $localId) { return (int)$localId; },
                'alboTeams' => [],
                'alboTeamNames' => [],
                'override' => $override
            ];
        }

        $dbMaster = new PDO("sqlite:$masterPath");
        $alboTeamsRaw = $dbMaster->query("SELECT ID, IDAttuale, Nome FROM AlboFantasquadra ORDER BY ID")->fetchAll(PDO::FETCH_ASSOC);
        $primaryCompId = 0;
        try {
            $pComp = $dbMaster->query("SELECT ID FROM AlboCompetizione ORDER BY (CASE WHEN IDAttuale = 1 THEN 0 WHEN LOWER(Nome) LIKE '%lega%' OR LOWER(Nome) LIKE '%campionato%' OR LOWER(Nome) LIKE '%serie%' THEN 1 ELSE 2 END), ID ASC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if ($pComp && !empty($pComp['ID'])) {
                $primaryCompId = (int)$pComp['ID'];
            }
        } catch (Exception $e) {}
        if ($primaryCompId > 0) {
            $stmtPos = $dbMaster->prepare("SELECT Stagione, IDFantasquadra, Presidente FROM AlboPosizione WHERE IDCompetizione = ?");
            $stmtPos->execute([$primaryCompId]);
            $alboPos = $stmtPos->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $alboPos = $dbMaster->query("SELECT Stagione, IDFantasquadra, Presidente FROM AlboPosizione ORDER BY IDCompetizione ASC")->fetchAll(PDO::FETCH_ASSOC);
        }

        $posBySeasonPres = [];
        foreach ($alboPos as $ap) {
            $posBySeasonPres[(int)$ap['Stagione']][strtoupper(trim($ap['Presidente'] ?? ''))] = (int)$ap['IDFantasquadra'];
        }

        $alboTeams = [];
        $alboTeamNames = [];
        $currentByLocalId = [];
        foreach ($alboTeamsRaw as $at) {
            $tId = (int)$at['ID'];
            $tName = $at['Nome'];
            $tAtt = (int)($at['IDAttuale'] ?? 0);
            $alboTeams[] = [
                'id' => $tId,
                'ID' => $tId,
                'name' => $tName,
                'Nome' => $tName,
                'idAttuale' => $tAtt,
                'IDAttuale' => $tAtt,
                'currentId' => $tAtt
            ];
            $alboTeamNames[$tId] = $tName;
            if ($tAtt > 0) {
                $currentByLocalId[$tAtt] = $tId;
            }
        }

        $autoResolver = function($s, $localId, $nome = '', $pres = '') use ($latestSeasonId, $currentByLocalId, $posBySeasonPres) {
            if ($s === $latestSeasonId && isset($currentByLocalId[$localId])) {
                return $currentByLocalId[$localId];
            }
            $presKey = strtoupper(trim($pres ?? ''));
            if ($presKey && isset($posBySeasonPres[$s][$presKey])) {
                return $posBySeasonPres[$s][$presKey];
            }
            return $localId;
        };

        $resolver = function($s, $localId, $nome = '', $pres = '') use ($override, $autoResolver) {
            if (isset($override[$s][$localId])) {
                return (int)$override[$s][$localId];
            }
            return $autoResolver($s, $localId, $nome, $pres);
        };

        return [
            'resolver' => $resolver,
            'autoResolver' => $autoResolver,
            'alboTeams' => $alboTeams,
            'alboTeamNames' => $alboTeamNames,
            'override' => $override
        ];
    }
}

if (!function_exists('getCompetitionResolver')) {
    function getCompetitionResolver($sqliteBase, $latestSeasonId) {
        $override = [];
        $mapFile = "$sqliteBase/competition_map.json";
        if (file_exists($mapFile)) {
            $override = json_decode(file_get_contents($mapFile), true) ?: [];
        }

        $masterPath = "$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite";
        if ((int)$latestSeasonId <= 0 || !file_exists($masterPath)) {
            return [
                'resolver' => function($s, $rawCId) use ($override) {
                    return isset($override[$s][$rawCId]) ? (int)$override[$s][$rawCId] : (int)$rawCId;
                },
                'autoResolver' => function($s, $rawCId) { return (int)$rawCId; },
                'masterComps' => [],
                'alboCompNames' => [],
                'override' => $override
            ];
        }

        $dbMaster = new PDO("sqlite:$masterPath");
        $alboCompsRaw = $dbMaster->query("SELECT ID, IDAttuale, Nome, IniziataNel FROM AlboCompetizione ORDER BY ID ASC")->fetchAll(PDO::FETCH_ASSOC);

        $masterComps = [];
        $alboCompNames = [];
        $currentByLocalId = [];
        $nameToAlboId = [];
        $masterIdsSeen = [];

        foreach ($alboCompsRaw as $ac) {
            $cId = (int)$ac['ID'];
            $cName = trim($ac['Nome'] ?? '');
            $cAtt = (int)($ac['IDAttuale'] ?? 0);
            $masterIdsSeen[$cId] = true;

            $clean = strtolower($cName);
            $icon = 'ico-coppa.gif';
            $emoji = '🏆';
            if (strpos($clean, 'supercoppa') !== false || strpos($clean, 'shield') !== false) {
                $icon = 'ico-supercoppa.gif';
                $emoji = '🛡️';
            } elseif (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false) {
                $icon = 'ico-gp.gif';
                $emoji = '🏎️';
            } elseif (strpos($clean, 'coppa') !== false || strpos($clean, 'cup') !== false) {
                $icon = 'ico-coppa.gif';
                $emoji = '🍷';
            } elseif (strpos($clean, 'scudetto') !== false || strpos($clean, 'lega') !== false || strpos($clean, 'campionato') !== false || strpos($clean, 'serie') !== false) {
                $icon = 'ico-scudetto.gif';
                $emoji = '🏆';
            } else {
                $icon = 'ico-coppa.gif';
                $emoji = '🎖️';
            }

            $masterComps[] = [
                'id' => $cId,
                'ID' => $cId,
                'name' => $cName,
                'Nome' => $cName,
                'idAttuale' => $cAtt,
                'IDAttuale' => $cAtt,
                'icon' => $icon,
                'Icona' => $icon,
                'emoji' => $emoji,
                'iniziataNel' => (int)($ac['IniziataNel'] ?? 0)
            ];
            $alboCompNames[$cId] = $cName;
            if ($cAtt > 0) {
                $currentByLocalId[$cAtt] = $cId;
            }
            $nameToAlboId[$clean] = $cId;
            if (strpos($clean, 'lega') !== false && strpos($clean, 'coppa') === false) {
                $nameToAlboId['lega'] = $cId;
                $nameToAlboId['campionato'] = $cId;
            }
            if (strpos($clean, 'coppa') !== false) {
                $nameToAlboId['coppa'] = $cId;
            }
            if (strpos($clean, 'supercoppa') !== false) {
                $nameToAlboId['supercoppa'] = $cId;
            }
            if (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false) {
                $nameToAlboId['gp'] = $cId;
                $nameToAlboId['formula 1'] = $cId;
            }
        }

        // Recupera eventuali competizioni storiche dismesse presenti solo nelle vecchie stagioni
        $allDbs = glob("$sqliteBase/stagione_*/lega_*.sqlite");
        foreach ($allDbs as $sFile) {
            try {
                $sDb = new PDO("sqlite:$sFile");
                $rows = $sDb->query("SELECT ID, IDAttuale, Nome, IniziataNel FROM AlboCompetizione")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $sac) {
                    $scId = (int)$sac['ID'];
                    if (!isset($masterIdsSeen[$scId])) {
                        $masterIdsSeen[$scId] = true;
                        $scName = trim($sac['Nome'] ?? "Competizione $scId");
                        $clean = strtolower($scName);
                        $icon = (strpos($clean, 'supercoppa') !== false) ? 'ico-supercoppa.gif' : ((strpos($clean, 'gp') !== false) ? 'ico-gp.gif' : 'ico-coppa.gif');
                        $masterComps[] = [
                            'id' => $scId,
                            'ID' => $scId,
                            'name' => $scName,
                            'Nome' => $scName,
                            'idAttuale' => (int)($sac['IDAttuale'] ?? 0),
                            'IDAttuale' => (int)($sac['IDAttuale'] ?? 0),
                            'icon' => $icon,
                            'Icona' => $icon,
                            'emoji' => '🎖️',
                            'iniziataNel' => (int)($sac['IniziataNel'] ?? 0)
                        ];
                        $alboCompNames[$scId] = $scName;
                        $nameToAlboId[$clean] = $scId;
                    }
                }
            } catch (Exception $e) {}
        }

        // Include anche eventuali nuove competizioni attive nella stagione in corso non ancora registrate nell'Albo d'Oro
        try {
            $curComps = $dbMaster->query("SELECT ID, Nome FROM Competizione")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($curComps as $cc) {
                $ccId = (int)$cc['ID'];
                if (!isset($currentByLocalId[$ccId])) {
                    $synthMasterId = 1000 + $ccId;
                    if (!isset($masterIdsSeen[$synthMasterId])) {
                        $masterIdsSeen[$synthMasterId] = true;
                        $ccName = trim($cc['Nome'] ?? "Competizione $ccId");
                        $clean = strtolower($ccName);
                        $icon = 'ico-coppa.gif';
                        $masterComps[] = [
                            'id' => $synthMasterId,
                            'ID' => $synthMasterId,
                            'name' => $ccName,
                            'Nome' => $ccName,
                            'idAttuale' => $ccId,
                            'IDAttuale' => $ccId,
                            'icon' => $icon,
                            'Icona' => $icon,
                            'emoji' => '⚽',
                            'iniziataNel' => 0
                        ];
                        $alboCompNames[$synthMasterId] = $ccName;
                        $currentByLocalId[$ccId] = $synthMasterId;
                        $nameToAlboId[$clean] = $synthMasterId;
                    }
                }
            }
        } catch (Exception $e) {}

        $alboIdToLocalId = [];
        foreach ($currentByLocalId as $lId => $mId) {
            $alboIdToLocalId[$mId] = $lId;
        }

        $autoResolver = function($s, $localId, $nome = '') use ($currentByLocalId, $nameToAlboId, $masterIdsSeen) {
            $localId = (int)$localId;
            if (isset($currentByLocalId[$localId])) {
                return $currentByLocalId[$localId];
            }
            $clean = strtolower(trim($nome ?? ''));
            if ($clean && isset($nameToAlboId[$clean])) {
                return $nameToAlboId[$clean];
            }
            if (isset($masterIdsSeen[$localId])) {
                return $localId;
            }
            return $localId;
        };

        $resolver = function($s, $localId, $nome = '') use ($override, $autoResolver, $alboIdToLocalId) {
            $localId = (int)$localId;
            if (isset($override[$s][$localId])) {
                return (int)$override[$s][$localId];
            }
            if (isset($alboIdToLocalId[$localId]) && isset($override[$s][$alboIdToLocalId[$localId]])) {
                return (int)$override[$s][$alboIdToLocalId[$localId]];
            }
            return $autoResolver($s, $localId, $nome);
        };

        return [
            'resolver' => $resolver,
            'autoResolver' => $autoResolver,
            'masterComps' => $masterComps,
            'alboComps' => $masterComps,
            'alboCompNames' => $alboCompNames,
            'override' => $override
        ];
    }
}

if (!function_exists('getRankingConfig')) {
    function getRankingConfig($sqliteBase, $masterComps = []) {
        $configFile = "$sqliteBase/ranking_config.json";
        $defaults = [
            'extra_time_mode' => 'regular_only',
            'placement' => [],
            'matches' => [],
            'goals' => [
                'gf' => 1.3,
                'gs' => -1.3
            ],
            'decay' => [
                0 => 1.0,
                1 => 1.0,
                2 => 0.75,
                3 => 0.50,
                4 => 0.25
            ],
            'older_decay' => 0.0
        ];

        if (empty($masterComps) && function_exists('getCompetitionResolver') && function_exists('getStagioniDisponibili')) {
            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $compData = $latestSeasonId > 0 ? getCompetitionResolver($sqliteBase, $latestSeasonId) : ['masterComps' => []];
            $masterComps = $compData['masterComps'] ?? [];
        }

        foreach ($masterComps as $mc) {
            $cId = (int)$mc['ID'];
            $clean = strtolower($mc['Nome'] ?? '');

            if (strpos($clean, 'supercoppa') !== false || strpos($clean, 'shield') !== false) {
                $defaults['placement'][$cId] = [1 => 10, 2 => 0, 3 => 0, 4 => 0];
                $defW = 1.3; $defD = 1.0;
            } elseif (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false) {
                $defaults['placement'][$cId] = [1 => 30, 2 => 15, 3 => 5, 4 => 0];
                $defW = 0.0; $defD = 0.0;
            } elseif (strpos($clean, 'coppa') !== false || strpos($clean, 'cup') !== false) {
                $defaults['placement'][$cId] = [1 => 50, 2 => 30, 3 => 15, 4 => 0];
                $defW = 1.8; $defD = 1.1;
            } elseif (strpos($clean, 'lega') !== false || strpos($clean, 'campionato') !== false || strpos($clean, 'serie') !== false) {
                $defaults['placement'][$cId] = [1 => 100, 2 => 70, 3 => 50, 4 => 30];
                $defW = 2.0; $defD = 1.2;
            } else {
                $defaults['placement'][$cId] = [1 => 50, 2 => 30, 3 => 15, 4 => 0];
                $defW = 1.8; $defD = 1.1;
            }

            $defaults['matches'][$cId] = [
                'home'    => ['win' => $defW, 'draw' => $defD, 'loss' => 0.0, 'gf' => 1.3, 'gs' => -1.3],
                'away'    => ['win' => $defW, 'draw' => $defD, 'loss' => 0.0, 'gf' => 1.3, 'gs' => -1.3],
                'neutral' => ['win' => $defW, 'draw' => $defD, 'loss' => 0.0, 'gf' => 1.3, 'gs' => -1.3],
            ];
        }

        if (file_exists($configFile)) {
            $custom = json_decode(file_get_contents($configFile), true);
            if (is_array($custom)) {
                return array_replace_recursive($defaults, $custom);
            }
        }
        return $defaults;
    }
}

if (!function_exists('getCompetitionMatchVenueParams')) {
    function getCompetitionMatchVenueParams($cfg, $cComp, $venue = 'home') {
        $cComp = (int)$cComp;
        $compMatches = $cfg['matches'][$cComp] ?? null;
        $globalGf = floatval($cfg['goals']['gf'] ?? 1.3);
        $globalGs = floatval($cfg['goals']['gs'] ?? -1.3);

        // Se è presente la configurazione per venue specifica (home, away, neutral)
        if (is_array($compMatches) && isset($compMatches[$venue]) && is_array($compMatches[$venue])) {
            $v = $compMatches[$venue];
            return [
                'win'  => floatval($v['win'] ?? ($compMatches['win'] ?? 2.0)),
                'draw' => floatval($v['draw'] ?? ($compMatches['draw'] ?? 1.2)),
                'loss' => floatval($v['loss'] ?? 0.0),
                'gf'   => floatval($v['gf'] ?? $globalGf),
                'gs'   => floatval($v['gs'] ?? $globalGs),
            ];
        }

        // Fallback backward compatibility per vecchio formato piatto: matches[cId]['win']
        $flatWin = isset($compMatches['win']) ? floatval($compMatches['win']) : 2.0;
        $flatDraw = isset($compMatches['draw']) ? floatval($compMatches['draw']) : 1.2;
        $flatLoss = isset($compMatches['loss']) ? floatval($compMatches['loss']) : 0.0;

        return [
            'win'  => $flatWin,
            'draw' => $flatDraw,
            'loss' => $flatLoss,
            'gf'   => $globalGf,
            'gs'   => $globalGs,
        ];
    }
}

if (!function_exists('getDecayWeight')) {
    function getDecayWeight($cfg, $age) {
        if (isset($cfg['decay'][$age])) {
            $w = floatval($cfg['decay'][$age]);
            return $w > 1.0 ? ($w / 100.0) : $w;
        }
        if (isset($cfg['older_decay'])) {
            $w = floatval($cfg['older_decay']);
            return $w > 1.0 ? ($w / 100.0) : $w;
        }
        return 0.0;
    }
}

if (!function_exists('buildHistoricalStandings')) {
    function buildHistoricalStandings($sqliteBase, $seasonId) {
        $dbPath = "$sqliteBase/stagione_$seasonId/lega_$seasonId.sqlite";
        if (!file_exists($dbPath)) return null;

        $db = new PDO("sqlite:$dbPath");
        
        $anno = getFallbackSeasonYear($sqliteBase, (int)$seasonId);
        $nomeLega = "Stagione $seasonId";
        try {
            $row = $db->query("SELECT Nome, AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                if (!empty($row['AnnoArchivio'])) $anno = (int)$row['AnnoArchivio'];
                if (!empty($row['Nome'])) $nomeLega = $row['Nome'];
            }
        } catch (Exception $e) {}

        $seasons = getStagioniDisponibili($sqliteBase);
        $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : (int)$seasonId;
        $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
        $resolver = $franchiseData['resolver'];

        $teams = [];
        foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
            $tId = (int)$t['ID'];
            $franchiseId = $resolver($seasonId, $tId, $t['Nome'], $t['Presidente']);
            $teams[$tId] = [
                'id' => $tId,
                'name' => $t['Nome'],
                'coach' => $t['Presidente'] ?? '',
                'franchiseId' => $franchiseId
            ];
        }

        $comps = $db->query("SELECT ID, Nome, Predefinita FROM Competizione ORDER BY ID ASC")->fetchAll(PDO::FETCH_ASSOC);
        $gironi = $db->query("SELECT ID, IDCompetizione, Nome FROM Girone ORDER BY ID ASC")->fetchAll(PDO::FETCH_ASSOC);

        $gironiByComp = [];
        foreach ($gironi as $g) {
            $gironiByComp[(int)$g['IDCompetizione']][] = $g;
        }

        $outCompetitions = [];
        foreach ($comps as $c) {
            $cId = (int)$c['ID'];
            $cName = $c['Nome'];
            $cGroups = $gironiByComp[$cId] ?? [];

            $outGroups = [];
            foreach ($cGroups as $g) {
                $gId = (int)$g['ID'];
                $gName = $g['Nome'];

                $iscrittiRows = $db->query("SELECT IDSquadra, PuntiBonusMalus, InPosizione FROM Iscritta WHERE IDGirone = $gId")->fetchAll(PDO::FETCH_ASSOC);
                if (empty($iscrittiRows)) continue;

                $groupTeams = [];
                foreach ($iscrittiRows as $isc) {
                    $tId = (int)$isc['IDSquadra'];
                    if (!isset($teams[$tId])) continue;
                    $bm = (float)$isc['PuntiBonusMalus'];
                    $groupTeams[$tId] = [
                        'teamId' => $tId,
                        'groupId' => $gId,
                        'compId' => $cId,
                        'pos' => 0,
                        'name' => $teams[$tId]['name'],
                        'coach' => $teams[$tId]['coach'],
                        'franchiseId' => $teams[$tId]['franchiseId'],
                        'points' => $bm,
                        'bonusMalus' => $bm,
                        'winsHome' => 0,
                        'winsAway' => 0,
                        'winsTot' => 0,
                        'drawsHome' => 0,
                        'drawsAway' => 0,
                        'drawsTot' => 0,
                        'lossesHome' => 0,
                        'lossesAway' => 0,
                        'lossesTot' => 0,
                        'played' => 0,
                        'goalsFor' => 0,
                        'goalsAgainst' => 0,
                        'goalDiff' => 0,
                        'goalsForHome' => 0,
                        'goalsAgainstHome' => 0,
                        'goalsForAway' => 0,
                        'goalsAgainstAway' => 0,
                        'mediaInglese' => 0,
                        'sommaTotali' => 0.0,
                        'mediaTotali' => 0.0,
                        'minTotali' => 999.0,
                        'maxTotali' => 0.0,
                        'devStd' => 0.0,
                        'devStdTotali' => 0.0,
                        'mediaAvversari' => 0.0,
                        'mediaAvversariTotali' => 0.0,
                        'sommaParziali' => 0.0,
                        'mediaParziali' => 0.0,
                        'minParziali' => 999.0,
                        'maxParziali' => 0.0,
                        'devStdParziali' => 0.0,
                        'mediaAvversariParziali' => 0.0,
                        'totaliList' => [],
                        'parzialiList' => [],
                        'oppTotaliList' => [],
                        'oppParzialiList' => [],
                        'inPosizione' => (int)$isc['InPosizione']
                    ];
                }

                $matches = $db->query("SELECT * FROM Incontro WHERE IDGirone = $gId AND Giocato = 1 AND IDTipo != 2 AND IDTipo != 3 AND IDCasa > 0 AND IDFuori > 0")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($matches as $m) {
                    $cT = (int)$m['IDCasa'];
                    $fT = (int)$m['IDFuori'];
                    if (!isset($groupTeams[$cT]) || !isset($groupTeams[$fT])) continue;

                    $gc = (int)$m['GolCasa'];
                    $gf = (int)$m['GolFuori'];
                    $tc = (float)$m['TotCasa'];
                    $tf = (float)$m['TotFuori'];
                    $pc = (float)$m['ParzCasa'];
                    $pf = (float)$m['ParzFuori'];

                    $groupTeams[$cT]['played']++;
                    $groupTeams[$cT]['goalsFor'] += $gc;
                    $groupTeams[$cT]['goalsAgainst'] += $gf;
                    $groupTeams[$cT]['goalsForHome'] += $gc;
                    $groupTeams[$cT]['goalsAgainstHome'] += $gf;
                    $groupTeams[$cT]['sommaTotali'] += $tc;
                    $groupTeams[$cT]['sommaParziali'] += $pc;
                    $groupTeams[$cT]['totaliList'][] = $tc;
                    $groupTeams[$cT]['parzialiList'][] = $pc;
                    $groupTeams[$cT]['oppTotaliList'][] = $tf;
                    $groupTeams[$cT]['oppParzialiList'][] = $pf;
                    if ($tc < $groupTeams[$cT]['minTotali']) $groupTeams[$cT]['minTotali'] = $tc;
                    if ($tc > $groupTeams[$cT]['maxTotali']) $groupTeams[$cT]['maxTotali'] = $tc;
                    if ($pc < $groupTeams[$cT]['minParziali']) $groupTeams[$cT]['minParziali'] = $pc;
                    if ($pc > $groupTeams[$cT]['maxParziali']) $groupTeams[$cT]['maxParziali'] = $pc;

                    $groupTeams[$fT]['played']++;
                    $groupTeams[$fT]['goalsFor'] += $gf;
                    $groupTeams[$fT]['goalsAgainst'] += $gc;
                    $groupTeams[$fT]['goalsForAway'] += $gf;
                    $groupTeams[$fT]['goalsAgainstAway'] += $gc;
                    $groupTeams[$fT]['sommaTotali'] += $tf;
                    $groupTeams[$fT]['sommaParziali'] += $pf;
                    $groupTeams[$fT]['totaliList'][] = $tf;
                    $groupTeams[$fT]['parzialiList'][] = $pf;
                    $groupTeams[$fT]['oppTotaliList'][] = $tc;
                    $groupTeams[$fT]['oppParzialiList'][] = $pc;
                    if ($tf < $groupTeams[$fT]['minTotali']) $groupTeams[$fT]['minTotali'] = $tf;
                    if ($tf > $groupTeams[$fT]['maxTotali']) $groupTeams[$fT]['maxTotali'] = $tf;
                    if ($pf < $groupTeams[$fT]['minParziali']) $groupTeams[$fT]['minParziali'] = $pf;
                    if ($pf > $groupTeams[$fT]['maxParziali']) $groupTeams[$fT]['maxParziali'] = $pf;

                    if ($gc > $gf) {
                        $groupTeams[$cT]['winsHome']++;
                        $groupTeams[$cT]['winsTot']++;
                        $groupTeams[$cT]['points'] += 3;
                        $groupTeams[$fT]['lossesAway']++;
                        $groupTeams[$fT]['lossesTot']++;
                    } elseif ($gc < $gf) {
                        $groupTeams[$fT]['winsAway']++;
                        $groupTeams[$fT]['winsTot']++;
                        $groupTeams[$fT]['points'] += 3;
                        $groupTeams[$cT]['lossesHome']++;
                        $groupTeams[$cT]['lossesTot']++;
                    } else {
                        $groupTeams[$cT]['drawsHome']++;
                        $groupTeams[$cT]['drawsTot']++;
                        $groupTeams[$cT]['points'] += 1;
                        $groupTeams[$fT]['drawsAway']++;
                        $groupTeams[$fT]['drawsTot']++;
                        $groupTeams[$fT]['points'] += 1;
                    }
                }

                $standings = array_values($groupTeams);
                foreach ($standings as &$st) {
                    $st['goalDiff'] = $st['goalsFor'] - $st['goalsAgainst'];
                    $st['mediaInglese'] = ($st['winsAway'] * 2) - $st['lossesAway'] - ($st['drawsHome'] * 2) - ($st['lossesHome'] * 3);
                    if ($st['played'] > 0) {
                        $n = (int)$st['played'];
                        $st['mediaTotali'] = round($st['sommaTotali'] / $n, 3);
                        $st['mediaParziali'] = round($st['sommaParziali'] / $n, 3);
                        $st['sommaTotali'] = round($st['sommaTotali'], 2);
                        $st['sommaParziali'] = round($st['sommaParziali'], 2);

                        $oppTotSum = array_sum($st['oppTotaliList']);
                        $oppParzSum = array_sum($st['oppParzialiList']);
                        $st['mediaAvversariTotali'] = round($oppTotSum / $n, 3);
                        $st['mediaAvversari'] = $st['mediaAvversariTotali'];
                        $st['mediaAvversariParziali'] = round($oppParzSum / $n, 3);

                        // Deviazione Standard (popolazione / n, conforme a Fantacalcio Manager)
                        $meanT = $st['sommaTotali'] / $n;
                        $varT = 0.0;
                        foreach ($st['totaliList'] as $v) {
                            $varT += pow($v - $meanT, 2);
                        }
                        $st['devStdTotali'] = round(sqrt($varT / $n), 3);
                        $st['devStd'] = $st['devStdTotali'];

                        $meanP = $st['sommaParziali'] / $n;
                        $varP = 0.0;
                        foreach ($st['parzialiList'] as $v) {
                            $varP += pow($v - $meanP, 2);
                        }
                        $st['devStdParziali'] = round(sqrt($varP / $n), 3);

                        $st['minTotali'] = round($st['minTotali'], 3);
                        $st['maxTotali'] = round($st['maxTotali'], 3);
                        $st['minParziali'] = round($st['minParziali'], 3);
                        $st['maxParziali'] = round($st['maxParziali'], 3);
                    } else {
                        $st['minTotali'] = 0.0;
                        $st['minParziali'] = 0.0;
                        $st['maxTotali'] = 0.0;
                        $st['maxParziali'] = 0.0;
                        $st['mediaTotali'] = 0.0;
                        $st['mediaParziali'] = 0.0;
                        $st['devStdTotali'] = 0.0;
                        $st['devStd'] = 0.0;
                        $st['devStdParziali'] = 0.0;
                        $st['mediaAvversariTotali'] = 0.0;
                        $st['mediaAvversari'] = 0.0;
                        $st['mediaAvversariParziali'] = 0.0;
                    }
                    unset($st['totaliList'], $st['parzialiList'], $st['oppTotaliList'], $st['oppParzialiList']);
                }
                unset($st);

                usort($standings, function($a, $b) {
                    if ($b['points'] !== $a['points']) return $b['points'] - $a['points'];
                    if ($b['sommaTotali'] !== $a['sommaTotali']) return ($b['sommaTotali'] > $a['sommaTotali']) ? 1 : -1;
                    if ($b['goalDiff'] !== $a['goalDiff']) return $b['goalDiff'] - $a['goalDiff'];
                    return $b['goalsFor'] - $a['goalsFor'];
                });

                foreach ($standings as $idx => &$st) {
                    $st['pos'] = $idx + 1;
                }
                unset($st);

                $outGroups[] = [
                    'id' => $gId,
                    'name' => $gName,
                    'compId' => $cId,
                    'matchesCount' => count($matches),
                    'standings' => $standings
                ];
            }

            if (!empty($outGroups)) {
                $outCompetitions[] = [
                    'id' => $cId,
                    'name' => $cName,
                    'isDefault' => (int)$c['Predefinita'] === 1,
                    'groups' => $outGroups
                ];
            }
        }

        return [
            'season' => (int)$seasonId,
            'anno' => $anno,
            'anni_stagione' => "$anno/" . ($anno + 1),
            'nome_lega' => $nomeLega,
            'competitions' => $outCompetitions
        ];
    }
}

if (!function_exists('buildHistoricalCalendar')) {
    function buildHistoricalCalendar($sqliteBase, $seasonId) {
        $dbPath = "$sqliteBase/stagione_$seasonId/lega_$seasonId.sqlite";
        if (!file_exists($dbPath)) return null;

        $db = new PDO("sqlite:$dbPath");

        $anno = getFallbackSeasonYear($sqliteBase, (int)$seasonId);
        $nomeLega = "Stagione $seasonId";
        try {
            $row = $db->query("SELECT Nome, AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                if (!empty($row['AnnoArchivio'])) $anno = (int)$row['AnnoArchivio'];
                if (!empty($row['Nome'])) $nomeLega = $row['Nome'];
            }
        } catch (Exception $e) {}

        $teams = [];
        $teamMap = [];
        $tStmt = $db->query("SELECT ID, Nome FROM Fantasquadra ORDER BY ID ASC");
        if ($tStmt) {
            foreach ($tStmt as $t) {
                $tId = (int)$t['ID'];
                $tName = (string)($t['Nome'] ?? '');
                if ($tId <= 0 || trim($tName) === '') continue;
                $teams[] = ['ID' => $tId, 'Nome' => $tName];
                $teamMap[$tId] = $tName;
            }
        }

        $competitions = [];
        $compMap = [];
        $cStmt = $db->query("SELECT ID, Nome, Predefinita FROM Competizione ORDER BY ID ASC");
        if ($cStmt) {
            foreach ($cStmt as $c) {
                $cId = (int)$c['ID'];
                $cName = (string)($c['Nome'] ?? '');
                $competitions[] = [
                    'id' => $cId,
                    'name' => $cName,
                    'isDefault' => (int)($c['Predefinita'] ?? 0) === 1
                ];
                $compMap[$cId] = $cName;
            }
        }

        $gironeMap = [];
        $girStmt = $db->query("SELECT ID, IDCompetizione, Nome FROM Girone ORDER BY ID ASC");
        if ($girStmt) {
            foreach ($girStmt as $g) {
                $gironeMap[(int)$g['ID']] = [
                    'compId' => (int)$g['IDCompetizione'],
                    'name' => (string)($g['Nome'] ?? '')
                ];
            }
        }

        $giornataMap = [];
        $gioStmt = $db->query('SELECT ID, "Desc" FROM Giornata');
        if ($gioStmt) {
            foreach ($gioStmt as $gd) {
                $giornataMap[(int)$gd['ID']] = (string)($gd['Desc'] ?? '');
            }
        }

        $toFloat = static fn($v) => (float)str_replace(',', '.', (string)($v ?? 0));

        $matches = [];
        $matchdaysMap = [];
        $maxPlayedDay = 0;
        $minUnplayedDay = 999;

        $iStmt = $db->query("
            SELECT i.ID, i.IDTipo, i.IDCasa, i.IDFuori, i.IDGirone,
                   i.ParzCasa, i.ParzFuori, i.TotCasa, i.TotFuori,
                   i.GolCasa, i.GolFuori, i.Giocato, i.GiornataDiA, i.IDGiornata
            FROM Incontro i
            LEFT JOIN Girone gir ON gir.ID = i.IDGirone
            ORDER BY i.GiornataDiA ASC, COALESCE(gir.IDCompetizione, 9999) ASC, i.IDGirone ASC, i.ID ASC
        ");

        if ($iStmt) {
            while ($row = $iStmt->fetch(PDO::FETCH_ASSOC)) {
                $type = (int)$row['IDTipo'];
                $isRiposo = ($type === 2);
                $isPlayed = ((int)$row['Giocato'] === 1 && !$isRiposo);
                $serieADay = (int)$row['GiornataDiA'];
                $fantagiornataId = (int)$row['IDGiornata'];
                $fantagiornataNome = $giornataMap[$fantagiornataId] ?? '';

                $groupId = (int)$row['IDGirone'];
                $gInfo = $gironeMap[$groupId] ?? null;
                $compId = $gInfo ? $gInfo['compId'] : 0;
                $groupName = $gInfo ? $gInfo['name'] : '';
                $compName = $compMap[$compId] ?? ($compId > 0 ? "Competizione $compId" : '');

                $homeId = (int)$row['IDCasa'];
                $awayId = $isRiposo ? 0 : (int)$row['IDFuori'];
                $homeName = $teamMap[$homeId] ?? ($homeId > 0 ? "Squadra $homeId" : '');
                $awayName = $isRiposo ? '' : ($teamMap[$awayId] ?? ($awayId > 0 ? "Squadra $awayId" : ''));

                $matches[] = [
                    'id' => (int)$row['ID'],
                    'type' => $type,
                    'isRiposo' => $isRiposo,
                    'played' => $isPlayed,
                    'fantagiornataId' => $fantagiornataId,
                    'fantagiornataNome' => $fantagiornataNome,
                    'compId' => $compId,
                    'compName' => $compName,
                    'groupId' => $groupId,
                    'groupName' => $groupName,
                    'serieADay' => $serieADay,
                    'homeTeamId' => $homeId,
                    'awayTeamId' => $awayId,
                    'homeTeamName' => $homeName,
                    'awayTeamName' => $awayName,
                    'homeGoals' => (int)$row['GolCasa'],
                    'awayGoals' => (int)$row['GolFuori'],
                    'homePartial' => $toFloat($row['ParzCasa']),
                    'awayPartial' => $toFloat($row['ParzFuori']),
                    'homeTotal' => $toFloat($row['TotCasa']),
                    'awayTotal' => $toFloat($row['TotFuori'])
                ];

                if (!isset($matchdaysMap[$serieADay])) {
                    $matchdaysMap[$serieADay] = [
                        'serieADay' => $serieADay,
                        'name' => $fantagiornataNome ?: "{$serieADay}ª Giornata",
                        'played' => $isPlayed
                    ];
                } elseif ($isPlayed) {
                    $matchdaysMap[$serieADay]['played'] = true;
                }

                if ($isPlayed && $serieADay > $maxPlayedDay) {
                    $maxPlayedDay = $serieADay;
                }
                if (!$isPlayed && !$isRiposo && $serieADay > 0 && $serieADay < $minUnplayedDay) {
                    $minUnplayedDay = $serieADay;
                }
            }
        }

        ksort($matchdaysMap, SORT_NUMERIC);
        $matchdays = array_values($matchdaysMap);
        $lastPlayed = $maxPlayedDay > 0 ? $maxPlayedDay : 0;
        $nextMatchday = $minUnplayedDay < 999
            ? $minUnplayedDay
            : ($lastPlayed > 0 ? $lastPlayed : (!empty($matchdays) ? $matchdays[0]['serieADay'] : 1));

        return [
            'season' => (int)$seasonId,
            'anno' => $anno,
            'anni_stagione' => "$anno/" . ($anno + 1),
            'nome_lega' => $nomeLega,
            'teams' => $teams,
            'competitions' => $competitions,
            'calendar' => [
                'matchdays' => $matchdays,
                'matches' => $matches,
                'lastPlayed' => $lastPlayed,
                'nextMatchday' => $nextMatchday
            ]
        ];
    }
}

if (!function_exists('buildClassificaPerpetua')) {
    function buildClassificaPerpetua($sqliteBase) {
        $seasons = getStagioniDisponibili($sqliteBase);
        $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
        if ($latestSeasonId <= 0 || !file_exists("$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite")) {
            return ['totalSeasons' => 0, 'palmares' => [], 'ranking' => []];
        }
        $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
        $resolver = $franchiseData['resolver'];
        $compResolverData = getCompetitionResolver($sqliteBase, $latestSeasonId);
        $compResolver = $compResolverData['resolver'];

        $dbMaster = new PDO("sqlite:$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite");
        $alboPos = $dbMaster->query("SELECT Stagione, IDFantasquadra, Presidente, IDCompetizione, Posizione FROM AlboPosizione")->fetchAll(PDO::FETCH_ASSOC);

        $trophiesMap = [];
        foreach ($alboPos as $ap) {
            if ((int)$ap['Posizione'] === 1) {
                $s = (int)$ap['Stagione'];
                $sqId = (int)$ap['IDFantasquadra'];
                $rawCId = (int)$ap['IDCompetizione'];
                $cId = $compResolver($s, $rawCId);
                if ($cId > 0) {
                    $trophiesMap[$sqId][$cId] = ($trophiesMap[$sqId][$cId] ?? 0) + 1;
                }
            }
        }

        $perpetua = [];
        foreach ($franchiseData['alboTeams'] as $t) {
            $tId = (int)$t['ID'];
            $perpetua[$tId] = [
                'id' => $tId,
                'idAlbo' => $tId,
                'idAttuale' => (int)$t['IDAttuale'],
                'name' => $t['Nome'],
                'isCurrent' => ((int)$t['IDAttuale'] !== 0),
                'seasons' => 0,
                'played' => 0,
                'winsTot' => 0,
                'drawsTot' => 0,
                'lossesTot' => 0,
                'goalsFor' => 0,
                'goalsAgainst' => 0,
                'goalDiff' => 0,
                'points' => 0,
                'sommaTotali' => 0.0,
                'mediaTotali' => 0.0,
                'mediaPunti' => 0.0,
                'trophies' => (object)[],
                'seasonsList' => []
            ];
        }

        for ($s = 1; $s <= $latestSeasonId; $s++) {
            $dbPath = "$sqliteBase/stagione_$s/lega_$s.sqlite";
            if (!file_exists($dbPath)) continue;
            $db = new PDO("sqlite:$dbPath");

            $compRow = $db->query("SELECT ID FROM Competizione WHERE Nome LIKE '%Lega%' OR Nome LIKE '%Campionato%' ORDER BY ID ASC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if (!$compRow) continue;
            $cId = (int)$compRow['ID'];

            $gironi = $db->query("SELECT ID FROM Girone WHERE IDCompetizione = $cId")->fetchAll(PDO::FETCH_COLUMN);
            if (empty($gironi)) continue;
            $gList = implode(',', $gironi);

            $localTeams = [];
            foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $lt) {
                $mId = $resolver($s, (int)$lt['ID'], $lt['Nome'], $lt['Presidente']);
                $localTeams[(int)$lt['ID']] = $mId;
                if (isset($perpetua[$mId])) {
                    $perpetua[$mId]['seasonsList'][$s] = true;
                }
            }

            foreach ($db->query("SELECT IDSquadra, PuntiBonusMalus FROM Iscritta WHERE IDGirone IN ($gList) AND PuntiBonusMalus != 0") as $isc) {
                $lId = (int)$isc['IDSquadra'];
                $mId = $localTeams[$lId] ?? null;
                if ($mId && isset($perpetua[$mId])) {
                    $perpetua[$mId]['points'] += (float)$isc['PuntiBonusMalus'];
                }
            }

            $matches = $db->query("SELECT * FROM Incontro WHERE IDGirone IN ($gList) AND Giocato = 1 AND IDTipo != 2 AND IDTipo != 3 AND IDCasa > 0 AND IDFuori > 0")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($matches as $m) {
                $c = $localTeams[(int)$m['IDCasa']] ?? null;
                $f = $localTeams[(int)$m['IDFuori']] ?? null;
                if (!$c || !$f || !isset($perpetua[$c]) || !isset($perpetua[$f])) continue;

                $gc = (int)$m['GolCasa'];
                $gf = (int)$m['GolFuori'];
                $tc = (float)$m['TotCasa'];
                $tf = (float)$m['TotFuori'];

                $perpetua[$c]['played']++;
                $perpetua[$f]['played']++;
                $perpetua[$c]['goalsFor'] += $gc;
                $perpetua[$c]['goalsAgainst'] += $gf;
                $perpetua[$f]['goalsFor'] += $gf;
                $perpetua[$f]['goalsAgainst'] += $gc;
                $perpetua[$c]['sommaTotali'] += $tc;
                $perpetua[$f]['sommaTotali'] += $tf;

                if ($gc > $gf) {
                    $perpetua[$c]['winsTot']++;
                    $perpetua[$c]['points'] += 3;
                    $perpetua[$f]['lossesTot']++;
                } elseif ($gc < $gf) {
                    $perpetua[$f]['winsTot']++;
                    $perpetua[$f]['points'] += 3;
                    $perpetua[$c]['lossesTot']++;
                } else {
                    $perpetua[$c]['drawsTot']++;
                    $perpetua[$f]['drawsTot']++;
                    $perpetua[$c]['points'] += 1;
                    $perpetua[$f]['points'] += 1;
                }
            }
        }

        foreach ($perpetua as &$p) {
            $p['seasons'] = count($p['seasonsList']);
            $p['goalDiff'] = $p['goalsFor'] - $p['goalsAgainst'];
            $p['mediaPunti'] = $p['played'] > 0 ? round($p['points'] / $p['played'], 2) : 0.0;
            $p['mediaTotali'] = $p['played'] > 0 ? round($p['sommaTotali'] / $p['played'], 2) : 0.0;
            $p['sommaTotali'] = round($p['sommaTotali'], 2);
            $p['trophies'] = $trophiesMap[$p['idAlbo']] ?? (object)[];
            unset($p['seasonsList']);
        }
        unset($p);

        usort($perpetua, function($a, $b) {
            if ($b['points'] !== $a['points']) return $b['points'] - $a['points'];
            if ($b['sommaTotali'] !== $a['sommaTotali']) return ($b['sommaTotali'] > $a['sommaTotali']) ? 1 : -1;
            if ($b['goalDiff'] !== $a['goalDiff']) return $b['goalDiff'] - $a['goalDiff'];
            return $b['goalsFor'] - $a['goalsFor'];
        });

        $ranking = [];
        $pos = 1;
        foreach ($perpetua as $p) {
            if ($p['played'] === 0) continue;
            $p['pos'] = $pos++;
            $ranking[] = $p;
        }

        return [
            'totalSeasons' => count($seasons),
            'palmares' => $compResolverData['masterComps'],
            'ranking' => $ranking
        ];
    }
}

if (!function_exists('fcmEvalMatchVote')) {
    function fcmEvalMatchVote(array $row, string $mode): ?float {
        $v1 = (float)($row['Voto1'] ?? -1);
        $v2 = (float)($row['Voto2'] ?? -1);
        $v3 = (float)($row['Voto3'] ?? -1);
        switch ($mode) {
            case '1':
                return $v1 > 0 ? $v1 : null;
            case '2':
                return $v2 > 0 ? $v2 : null;
            case '3':
                return $v3 > 0 ? $v3 : null;
            case '12_any':
                if ($v1 > 0 && $v2 > 0) return ($v1 + $v2) / 2.0;
                return $v1 > 0 ? $v1 : ($v2 > 0 ? $v2 : null);
            case '12_all':
                return ($v1 > 0 && $v2 > 0) ? ($v1 + $v2) / 2.0 : null;
            case '13_any':
                if ($v1 > 0 && $v3 > 0) return ($v1 + $v3) / 2.0;
                return $v1 > 0 ? $v1 : ($v3 > 0 ? $v3 : null);
            case '13_all':
                return ($v1 > 0 && $v3 > 0) ? ($v1 + $v3) / 2.0 : null;
            case '23_any':
                if ($v2 > 0 && $v3 > 0) return ($v2 + $v3) / 2.0;
                return $v2 > 0 ? $v2 : ($v3 > 0 ? $v3 : null);
            case '23_all':
                return ($v2 > 0 && $v3 > 0) ? ($v2 + $v3) / 2.0 : null;
            case '123_all':
                return ($v1 > 0 && $v2 > 0 && $v3 > 0) ? ($v1 + $v2 + $v3) / 3.0 : null;
            case '123_any':
                $sum = 0.0;
                $cnt = 0;
                if ($v1 > 0) { $sum += $v1; $cnt++; }
                if ($v2 > 0) { $sum += $v2; $cnt++; }
                if ($v3 > 0) { $sum += $v3; $cnt++; }
                return $cnt > 0 ? ($sum / $cnt) : null;
            default:
                return null;
        }
    }
}

if (!function_exists('fcmComputeSeasonSerieAFallbackStats')) {
    /**
     * Calcola statistiche Serie A reali (presenze, gol, MV, FMV) da GiocaIn + Punteggio
     * per i calciatori assenti/svincolati da sa.Statistiche (es. ceduti all'estero/minori a stagione in corso),
     * calibrando automaticamente quotidiani e bonus (rigori/imbattibilità) sulle regole effettive della stagione.
     */
    function fcmComputeSeasonSerieAFallbackStats(PDO $db, array $targetPlayerIds = [], string $saAlias = 'sa'): array {
        $ids = array_values(array_unique(array_filter(array_map('intval', $targetPlayerIds), fn($id) => $id > 0)));
        if (empty($ids)) return [];
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $saAlias)) {
            $saAlias = 'sa';
        }

        try {
            $giStmt = $db->query("
                SELECT
                    gi.IDGiocatore,
                    COALESCE(g.Ruolo, 0) as Ruolo,
                    p.Voto1, p.Voto2, p.Voto3,
                    p.GolFatti1, p.GolFattiSuRigore1, p.GolSubiti,
                    p.Assist, p.Amm, p.Esp, p.Autogol1, p.RigPar, p.RigSba
                FROM {$saAlias}.GiocaIn gi
                JOIN {$saAlias}.Punteggio p ON p.ID = gi.IDPunteggio
                LEFT JOIN {$saAlias}.GiocatoreA g ON g.ID = gi.IDGiocatore
            ");
            if (!$giStmt) return [];

            $byPlayer = [];
            $roleByPlayer = [];
            $hasV1 = false;
            $hasV2 = false;
            $hasV3 = false;
            while ($r = $giStmt->fetch(PDO::FETCH_ASSOC)) {
                $pid = (int)$r['IDGiocatore'];
                $byPlayer[$pid][] = $r;
                if (!isset($roleByPlayer[$pid]) && (int)$r['Ruolo'] > 0) {
                    $roleByPlayer[$pid] = (int)$r['Ruolo'];
                }
                if ((float)($r['Voto1'] ?? 0) > 0) $hasV1 = true;
                if ((float)($r['Voto2'] ?? 0) > 0) $hasV2 = true;
                if ((float)($r['Voto3'] ?? 0) > 0) $hasV3 = true;
            }
            if (empty($byPlayer)) return [];

            // Calibrazione automatica delle regole della stagione dai calciatori presenti in sa.Statistiche
            $bestMode = ($hasV1 && $hasV2 && $hasV3)
                ? '123_any'
                : (($hasV1 && $hasV2) ? '12_any' : ($hasV2 && !$hasV1 ? '2' : ($hasV3 && !$hasV1 ? '3' : '1')));
            $bestRigPts = 3;
            $bestCleanSheetPts = 0;

            $refStats = [];
            try {
                $refStmt = $db->query("SELECT ID, Ruolo, Presenze, MVT, FMT FROM {$saAlias}.Statistiche WHERE Presenze > 0");
                if ($refStmt) {
                    $refStats = $refStmt->fetchAll(PDO::FETCH_ASSOC);
                }
            } catch (Exception $e) {}

            if (!empty($refStats)) {
                $voteModes = ['1', '2', '3', '12_any', '12_all', '13_any', '13_all', '23_any', '23_all', '123_any', '123_all'];
                $bestScore = INF;
                foreach ($voteModes as $mode) {
                    $mvErr = 0.0;
                    $cntDiff = 0;
                    foreach ($refStats as $st) {
                        $rows = $byPlayer[(int)$st['ID']] ?? [];
                        $sumV = 0.0;
                        $cnt = 0;
                        foreach ($rows as $r) {
                            $v = fcmEvalMatchVote($r, $mode);
                            if ($v !== null) {
                                $sumV += $v;
                                $cnt++;
                            }
                        }
                        $cntDiff += abs($cnt - (int)$st['Presenze']);
                        $mvErr += $cnt > 0
                            ? abs(round($sumV / $cnt, 2) - round((float)$st['MVT'], 2))
                            : 5.0;
                    }
                    $score = $mvErr + $cntDiff * 0.01;
                    if ($score < $bestScore) {
                        $bestScore = $score;
                        $bestMode = $mode;
                    }
                }

                $bestFmErr = INF;
                foreach ([3, 2] as $rp) {
                    foreach ([0, 1] as $cs) {
                        $fmErr = 0.0;
                        foreach ($refStats as $st) {
                            $rows = $byPlayer[(int)$st['ID']] ?? [];
                            $isGk = ((int)($st['Ruolo'] ?? 0) === 1);
                            $sumFm = 0.0;
                            $cnt = 0;
                            foreach ($rows as $r) {
                                $v = fcmEvalMatchVote($r, $bestMode);
                                if ($v === null) continue;
                                $cnt++;
                                $gfTot = (int)($r['GolFatti1'] ?? 0);
                                $gfRig = (int)($r['GolFattiSuRigore1'] ?? 0);
                                $gfAz = max(0, $gfTot - $gfRig);
                                $gs = (int)($r['GolSubiti'] ?? 0);
                                $sumFm += $v
                                    + $gfAz * 3.0
                                    + $gfRig * (float)$rp
                                    - $gs * 1.0
                                    + ($isGk && $gs === 0 ? (float)$cs : 0.0)
                                    + (int)($r['Assist'] ?? 0) * 1.0
                                    - (int)($r['Amm'] ?? 0) * 0.5
                                    - (int)($r['Esp'] ?? 0) * 1.0
                                    - (int)($r['Autogol1'] ?? 0) * 2.0
                                    + (int)($r['RigPar'] ?? 0) * 3.0
                                    - (int)($r['RigSba'] ?? 0) * 3.0;
                            }
                            $fmErr += $cnt > 0
                                ? abs(round($sumFm / $cnt, 2) - round((float)$st['FMT'], 2))
                                : 5.0;
                        }
                        if ($fmErr < $bestFmErr) {
                            $bestFmErr = $fmErr;
                            $bestRigPts = $rp;
                            $bestCleanSheetPts = $cs;
                        }
                    }
                }
            }

            $out = [];
            foreach ($ids as $pid) {
                $rows = $byPlayer[$pid] ?? [];
                if (empty($rows)) continue;
                $isGk = (($roleByPlayer[$pid] ?? 0) === 1);
                $cnt = 0;
                $goals = 0;
                $sumV = 0.0;
                $sumFm = 0.0;
                foreach ($rows as $r) {
                    $v = fcmEvalMatchVote($r, $bestMode);
                    if ($v === null) continue;
                    $cnt++;
                    $gfTot = (int)($r['GolFatti1'] ?? 0);
                    $gfRig = (int)($r['GolFattiSuRigore1'] ?? 0);
                    $gfAz = max(0, $gfTot - $gfRig);
                    $gs = (int)($r['GolSubiti'] ?? 0);
                    $goals += $gfTot;
                    $sumV += $v;
                    $sumFm += $v
                        + $gfAz * 3.0
                        + $gfRig * (float)$bestRigPts
                        - $gs * 1.0
                        + ($isGk && $gs === 0 ? (float)$bestCleanSheetPts : 0.0)
                        + (int)($r['Assist'] ?? 0) * 1.0
                        - (int)($r['Amm'] ?? 0) * 0.5
                        - (int)($r['Esp'] ?? 0) * 1.0
                        - (int)($r['Autogol1'] ?? 0) * 2.0
                        + (int)($r['RigPar'] ?? 0) * 3.0
                        - (int)($r['RigSba'] ?? 0) * 3.0;
                }
                if ($cnt > 0) {
                    $out[$pid] = [
                        'pres' => $cnt,
                        'goals' => $goals,
                        'mv' => round($sumV / $cnt, 2),
                        'fmv' => round($sumFm / $cnt, 2),
                    ];
                }
            }

            return $out;
        } catch (Exception $e) {
            return [];
        }
    }
}

function handleApiAction($action, $sqliteBase, $isCli = false) {
    if (!$isCli && php_sapi_name() !== 'cli') {
        $wantsRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
        if ($action === 'genera_cache' || $wantsRefresh) {
            fcm_ensure_session();
            if (empty($_SESSION['pn_admin_logged'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Accesso amministratore richiesto per aggiornare la cache'], JSON_UNESCAPED_UNICODE);
                return null;
            }
        }
    }

    switch ($action) {
        case 'stagioni':
            $seasons = getStagioniDisponibili($sqliteBase);
            $out = array_map(function($s) {
                return [
                    'id' => $s['id'],
                    'anno' => $s['anno'],
                    'anni_stagione' => $s['anni_stagione'],
                    'nome_lega' => $s['nome_lega'],
                    'cartella' => $s['cartella']
                ];
            }, $seasons);
            @fcm_write_file_atomic("$sqliteBase/stagioni.json", json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            if (!$isCli) echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            return $out;

        case 'confronti':
            $cacheFile = "$sqliteBase/confronti.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $resolver = $franchiseData['resolver'];

            // Competizioni e Palmares master dinamici da Albo d'Oro
            $compResolverData = getCompetitionResolver($sqliteBase, $latestSeasonId);
            $compResolver = $compResolverData['resolver'];
            $defaultCompId = !empty($compResolverData['masterComps'][0]['ID']) ? (int)$compResolverData['masterComps'][0]['ID'] : 1;

            $palmares = array_map(function($mc) {
                return [
                    'id' => (int)$mc['ID'],
                    'Competizione' => (int)$mc['ID'],
                    'compId' => (int)$mc['ID'],
                    'name' => $mc['Nome'],
                    'Label' => $mc['Nome'],
                    'label' => $mc['Nome'],
                    'icon' => $mc['icon'],
                    'Icona' => $mc['icon']
                ];
            }, $compResolverData['masterComps']);

            $posizioni = [];
            try {
                $dbMaster = new PDO("sqlite:$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite");
                $posStmt = $dbMaster->query("SELECT IDCompetizione, IDFantasquadra, Anno, Stagione, Posizione, Presidente, Punti FROM AlboPosizione ORDER BY Anno, IDCompetizione, Posizione");
                if ($posStmt) {
                    while ($r = $posStmt->fetch(PDO::FETCH_ASSOC)) {
                        $rawCId = (int)$r['IDCompetizione'];
                        $sNum = (int)$r['Stagione'];
                        $resolvedCId = $compResolver($sNum, $rawCId);
                        if ($resolvedCId <= 0) continue; // Competizione esclusa dallo storico

                        $posizioni[] = [
                            'idCompetizione' => $resolvedCId,
                            'IDCompetizione' => $resolvedCId,
                            'rawIdCompetizione' => $rawCId,
                            'idSquadra' => (int)$r['IDFantasquadra'],
                            'IDFantasquadra' => (int)$r['IDFantasquadra'],
                            'anno' => (int)$r['Anno'],
                            'Anno' => (int)$r['Anno'],
                            'stagione' => $sNum,
                            'Stagione' => $sNum,
                            'posizione' => (int)$r['Posizione'],
                            'Posizione' => (int)$r['Posizione'],
                            'presidente' => $r['Presidente'] ?? '',
                            'punti' => (float)$r['Punti']
                        ];
                    }
                }
            } catch (Exception $e) {}

            $teamsList = [];
            foreach ($franchiseData['alboTeams'] as $at) {
                $tId = (int)($at['ID'] ?? $at['id']);
                $tName = $at['Nome'] ?? $at['name'];
                $tAtt = (int)($at['IDAttuale'] ?? $at['idAttuale'] ?? 0);
                if ($tId > 0 && !empty($tName)) {
                    $teamsList[] = [
                        'id' => $tId,
                        'ID' => $tId,
                        'name' => $tName,
                        'Nome' => $tName,
                        'idAttuale' => $tAtt,
                        'IDAttuale' => $tAtt,
                        'currentId' => $tAtt
                    ];
                }
            }

            $seasonsAsc = array_reverse($seasons);
            $matches = [];
            $mIdx = 1;

            foreach ($seasonsAsc as $sInfo) {
                $s = $sInfo['id'];
                $dbPath = $sInfo['lega_db'];
                if (!file_exists($dbPath)) continue;

                try {
                    $db = new PDO("sqlite:$dbPath");

                    $teams = [];
                    foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
                        $lId = (int)$t['ID'];
                        $teams[$lId] = [
                            'name' => $t['Nome'],
                            'masterId' => $resolver($s, $lId, $t['Nome'], $t['Presidente'])
                        ];
                    }

                    $gironeComp = [];
                    foreach ($db->query("SELECT g.ID, g.IDCompetizione, c.Nome FROM Girone g LEFT JOIN Competizione c ON g.IDCompetizione = c.ID") as $g) {
                        $locComp = (int)$g['IDCompetizione'];
                        $locName = $g['Nome'] ?? '';
                        $gironeComp[(int)$g['ID']] = $compResolver($s, $locComp, $locName);
                    }

                    $datesMap = [];
                    $saDbPath = $sInfo['seriea_db'] ?? null;
                    if ($saDbPath && file_exists($saDbPath)) {
                        try {
                            $saDb = new PDO("sqlite:$saDbPath");
                            $gRows = $saDb->query("SELECT Giornata, UltimoUpdateA FROM GiornataDiA WHERE Giocata = 1")->fetchAll(PDO::FETCH_ASSOC);
                            foreach ($gRows as $gr) {
                                $dtStr = trim($gr['UltimoUpdateA'] ?? '');
                                if ($dtStr && $dtStr !== '30/12/1899 00:00:00') {
                                    $parts = explode(' ', $dtStr);
                                    $dParts = explode('/', $parts[0]);
                                    if (count($dParts) === 3) {
                                        $datesMap[(int)$gr['Giornata']] = "{$dParts[2]}-{$dParts[1]}-{$dParts[0]}";
                                    } else {
                                        $datesMap[(int)$gr['Giornata']] = $dtStr;
                                    }
                                }
                            }
                        } catch (Exception $e) {}
                    }

                    $tabellinoMap = [];
                    try {
                        $tabStmt = $db->query("SELECT IDIncontro, IDSquadra, Supplementari, GolSupplementari, Rigori, GolRigori, Gol FROM Tabellino");
                        if ($tabStmt) {
                            while ($tab = $tabStmt->fetch(PDO::FETCH_ASSOC)) {
                                $tabellinoMap[(int)$tab['IDIncontro']][(int)$tab['IDSquadra']] = $tab;
                            }
                        }
                    } catch (Exception $e) {}

                    $stmt = $db->query("
                        SELECT ID, IDTipo, IDCasa, IDFuori, IDGirone, ParzCasa, ParzFuori, TotCasa, TotFuori, GolCasa, GolFuori, GiornataDiA, Giocato
                        FROM Incontro
                        WHERE Giocato = 1 AND IDTipo != 2 AND IDCasa > 0 AND IDFuori > 0
                        ORDER BY GiornataDiA ASC, IDGirone ASC, IDTipo ASC, ID ASC
                    ");

                    while ($inc = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $cId = (int)$inc['IDCasa'];
                        $fId = (int)$inc['IDFuori'];
                        if (!isset($teams[$cId]) || !isset($teams[$fId])) continue;

                        $gId = (int)$inc['IDGirone'];
                        $alboCompId = $gironeComp[$gId] ?? $defaultCompId;

                        $homeMaster = $teams[$cId]['masterId'];
                        $awayMaster = $teams[$fId]['masterId'];
                        $homeName = $franchiseData['alboTeamNames'][$homeMaster] ?? $teams[$cId]['name'];
                        $awayName = $franchiseData['alboTeamNames'][$awayMaster] ?? $teams[$fId]['name'];

                        $incId = (int)$inc['ID'];
                        $tabCasa = $tabellinoMap[$incId][$cId] ?? null;
                        $tabFuori = $tabellinoMap[$incId][$fId] ?? null;

                        $isSuppl = (!empty($tabCasa['Supplementari']) || !empty($tabFuori['Supplementari']));
                        $isRigori = (!empty($tabCasa['Rigori']) || !empty($tabFuori['Rigori']));

                        $tipoRis = 0;
                        if ($isRigori) {
                            $tipoRis = 2;
                        } elseif ($isSuppl) {
                            $tipoRis = 1;
                        }

                        $golCasa = (int)$inc['GolCasa'];
                        $golFuori = (int)$inc['GolFuori'];

                        $golSupplCasa = !empty($tabCasa['GolSupplementari']) ? (int)$tabCasa['GolSupplementari'] : 0;
                        $golSupplFuori = !empty($tabFuori['GolSupplementari']) ? (int)$tabFuori['GolSupplementari'] : 0;

                        $golRigoriCasa = !empty($tabCasa['GolRigori']) ? (int)$tabCasa['GolRigori'] : 0;
                        $golRigoriFuori = !empty($tabFuori['GolRigori']) ? (int)$tabFuori['GolRigori'] : 0;

                        $golRegoCasa = $golCasa;
                        $golRegoFuori = $golFuori;
                        if ($tabCasa) {
                            $golRegoCasa = (int)$tabCasa['Gol'] - ($isSuppl ? $golSupplCasa : 0) - ($isRigori ? $golRigoriCasa : 0);
                        }
                        if ($tabFuori) {
                            $golRegoFuori = (int)$tabFuori['Gol'] - ($isSuppl ? $golSupplFuori : 0) - ($isRigori ? $golRigoriFuori : 0);
                        }

                        $giornataDiA = (int)$inc['GiornataDiA'];
                        $matches[] = [
                            'idx' => $mIdx++,
                            'matchId' => $incId,
                            'season' => $s,
                            'comp' => $alboCompId,
                            'matchday' => $giornataDiA,
                            'date' => $datesMap[$giornataDiA] ?? '',
                            'isNeutro' => in_array((int)$inc['IDTipo'], [4, 7]),
                            'homeId' => $homeMaster,
                            'homeTeam' => $homeName,
                            'awayId' => $awayMaster,
                            'awayTeam' => $awayName,
                            'golCasa' => $golCasa,
                            'golFuori' => $golFuori,
                            'tipoRis' => $tipoRis,
                            'golRegoCasa' => $golRegoCasa,
                            'golRegoFuori' => $golRegoFuori,
                            'golSupplCasa' => $golSupplCasa,
                            'golSupplFuori' => $golSupplFuori,
                            'golRigoriCasa' => $golRigoriCasa,
                            'golRigoriFuori' => $golRigoriFuori,
                            'ptCasa' => (float)$inc['TotCasa'],
                            'ptFuori' => (float)$inc['TotFuori']
                        ];
                    }
                } catch (Exception $e) {}
            }

            $out = [
                'count' => count($matches),
                'palmares' => $palmares,
                'posizioni' => $posizioni,
                'teams' => $teamsList,
                'matches' => $matches
            ];

            $jsonOut = json_encode($out, JSON_UNESCAPED_UNICODE);
            @fcm_write_file_atomic($cacheFile, $jsonOut);
            if (!$isCli) echo $jsonOut;
            return $out;

        case 'album':
            $cacheFile = "$sqliteBase/album.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $resolver = $franchiseData['resolver'];
            $ruoliMap = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];

            $album = [];
            $axIdx = 1;

            foreach ($seasons as $sInfo) {
                $s = $sInfo['id'];
                $legaDb = $sInfo['lega_db'];
                $serieaDb = $sInfo['seriea_db'];
                if (!file_exists($legaDb) || !file_exists($serieaDb)) continue;

                try {
                    $db = new PDO("sqlite:$legaDb");
                    $db->exec("ATTACH DATABASE '$serieaDb' AS sa");

                    $infoRow = $db->query("SELECT AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    $anno = (int)($infoRow['AnnoArchivio'] ?? ($sInfo['anno'] ?? getFallbackSeasonYear($sqliteBase, $s)));
                    $annoStagione = "$anno/" . ($anno + 1);

                    $teams = [];
                    foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
                        $lId = (int)$t['ID'];
                        $teams[$lId] = [
                            'name' => $t['Nome'],
                            'masterId' => $resolver($s, $lId, $t['Nome'], $t['Presidente'])
                        ];
                    }

                    $tabStmt = $db->query("
                        SELECT t.IDSquadra, t.Lista, t.Voto, t.Modif, t.Tot, i.GiornataDiA
                        FROM Tabellino t
                        JOIN Incontro i ON i.ID = t.IDIncontro
                        WHERE i.Giocato = 1
                    ");

                    $statsByTeamPlayer = [];
                    while ($row = $tabStmt->fetch(PDO::FETCH_ASSOC)) {
                        $tId = (int)$row['IDSquadra'];
                        $ids = explode('%', $row['Lista']);
                        $voti = explode('%', $row['Voto']);
                        $modifs = explode('%', $row['Modif']);
                        $tots = explode('%', $row['Tot']);
                        $starters = min(11, count($ids));

                        for ($idx = 0; $idx < $starters; $idx++) {
                            $pId = (int)($ids[$idx] ?? 0);
                            if ($pId <= 0) continue;

                            if (!isset($statsByTeamPlayer[$tId][$pId])) {
                                $statsByTeamPlayer[$tId][$pId] = [
                                    'pres' => 0,
                                    'totVoti' => 0.0,
                                    'totFV' => 0.0,
                                    'goals' => 0,
                                    'cautions' => 0,
                                    'expulsions' => 0
                                ];
                            }

                            $v = (float)str_replace(',', '.', $voti[$idx] ?? 0);
                            $fv = (float)str_replace(',', '.', $tots[$idx] ?? 0);
                            $m = (float)str_replace(',', '.', $modifs[$idx] ?? 0);

                            $statsByTeamPlayer[$tId][$pId]['pres']++;
                            $statsByTeamPlayer[$tId][$pId]['totVoti'] += $v;
                            $statsByTeamPlayer[$tId][$pId]['totFV'] += $fv;

                            if ($m >= 3.0) {
                                $goalsCount = (int)floor($m / 3.0);
                                $statsByTeamPlayer[$tId][$pId]['goals'] += $goalsCount;
                                $rem = $m - ($goalsCount * 3.0);
                                if (abs($rem - (-0.5)) < 0.01) $statsByTeamPlayer[$tId][$pId]['cautions']++;
                            } elseif ($m === 2.5) {
                                $statsByTeamPlayer[$tId][$pId]['goals'] += 1;
                                $statsByTeamPlayer[$tId][$pId]['cautions'] += 1;
                            } elseif ($m === -0.5) {
                                $statsByTeamPlayer[$tId][$pId]['cautions']++;
                            } elseif ($m === -1.0) {
                                $statsByTeamPlayer[$tId][$pId]['expulsions']++;
                            }
                        }
                    }

                    // Mappatura squadre reali di Serie A per ciascun giocatore da GiocaIn
                    $playerTeamsMap = [];
                    try {
                        $giocaStmt = $db->query("
                            SELECT g.IDGiocatore, s.Nome as squadraNome
                            FROM sa.GiocaIn g
                            JOIN sa.SquadraDiA s ON s.ID = g.IDSquadra
                            WHERE s.Nome NOT LIKE '{%}' AND s.Nome != ''
                            GROUP BY g.IDGiocatore, s.Nome
                            ORDER BY g.IDGiocatore, MIN(g.Giornata) ASC
                        ");
                        while ($gr = $giocaStmt->fetch(PDO::FETCH_ASSOC)) {
                            $pId = (int)$gr['IDGiocatore'];
                            $sName = trim($gr['squadraNome']);
                            if (!isset($playerTeamsMap[$pId])) {
                                $playerTeamsMap[$pId] = [];
                            }
                            if (!in_array($sName, $playerTeamsMap[$pId])) {
                                $playerTeamsMap[$pId][] = $sName;
                            }
                        }
                    } catch (Exception $e) {}

                    $tessStmt = $db->query("
                        SELECT 
                            t.IDSquadra, t.IDGiocatore, t.Ruolo, t.CostoAcq,
                            g.CodiceGazza, g.Nome as nomeGiocatore,
                            st.Squadra as serieATeam
                        FROM Tesserato t
                        JOIN sa.GiocatoreA g ON g.ID = t.IDGiocatore
                        LEFT JOIN sa.Statistiche st ON st.ID = t.IDGiocatore
                        ORDER BY t.IDSquadra, g.Nome
                    ");

                    while ($r = $tessStmt->fetch(PDO::FETCH_ASSOC)) {
                        $tId = (int)$r['IDSquadra'];
                        $pId = (int)$r['IDGiocatore'];
                        $sq = $teams[$tId] ?? ['name' => "Squadra $tId", 'masterId' => $tId];
                        $st = $statsByTeamPlayer[$tId][$pId] ?? ['pres' => 0, 'totVoti' => 0.0, 'totFV' => 0.0, 'goals' => 0, 'cautions' => 0, 'expulsions' => 0];

                        $serieAStr = '';
                        if (!empty($playerTeamsMap[$pId])) {
                            $serieAStr = implode(', ', $playerTeamsMap[$pId]);
                        } elseif (!empty($r['serieATeam'])) {
                            $serieAStr = $r['serieATeam'];
                        }

                        $album[] = [
                            'id' => $axIdx++,
                            'playerId' => (int)($r['CodiceGazza'] ?: $pId),
                            'playerName' => $r['nomeGiocatore'],
                            'season' => $annoStagione,
                            'seasonNum' => (int)$s,
                            'seasonYear' => $annoStagione,
                            'Stagione' => (int)$s,
                            'AnnoStagione' => $annoStagione,
                            'teamId' => $tId,
                            'historicalTeamId' => $sq['masterId'],
                            'teamName' => $sq['name'],
                            'role' => $ruoliMap[(int)$r['Ruolo']] ?? 'C',
                            'roleShort' => $ruoliMap[(int)$r['Ruolo']] ?? 'C',
                            'serieA' => $serieAStr,
                            'appearances' => $st['pres'],
                            'totVoti' => round($st['totVoti'], 2),
                            'totFV' => round($st['totFV'], 2),
                            'goals' => $st['goals'],
                            'expulsions' => $st['expulsions'],
                            'cautions' => $st['cautions'],
                            'cost' => (float)$r['CostoAcq']
                        ];
                    }
                } catch (Exception $e) {}
            }

            $out = [
                'count' => count($album),
                'teams' => $franchiseData['alboTeams'],
                'album' => $album
            ];

            $jsonOut = json_encode($out, JSON_UNESCAPED_UNICODE);
            @fcm_write_file_atomic($cacheFile, $jsonOut);
            if (!$isCli) echo $jsonOut;
            return $out;

        case 'almanacco':
            $cacheFile = "$sqliteBase/almanacco.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $resolver = $franchiseData['resolver'];
            $topCrediti = max(1.0, (float)getLatestCreditiTotali($sqliteBase, $seasons));

            $albumFile = "$sqliteBase/album.json";
            if (!file_exists($albumFile) || $forceRefresh) {
                handleApiAction('album', $sqliteBase, true);
            }

            $albumRaw = file_exists($albumFile) ? json_decode(file_get_contents($albumFile), true) : null;
            $albumRecords = $albumRaw['album'] ?? [];

            $fotoDir = dirname(__DIR__) . '/img/foto';
            $stCodeMap = [];
            $stStoricheFile = "$sqliteBase/statistiche_storiche.json";
            if (file_exists($stStoricheFile)) {
                $stRaw = @json_decode((string)@file_get_contents($stStoricheFile), true);
                if (!empty($stRaw['players']) && is_array($stRaw['players'])) {
                    foreach ($stRaw['players'] as $stp) {
                        $stpName = strtoupper(trim((string)($stp['nome'] ?? '')));
                        $stpCode = (int)($stp['codice'] ?? 0);
                        if ($stpName !== '' && $stpCode > 0) {
                            $stCodeMap[$stpName] = $stpCode;
                        }
                    }
                }
            }

            $pickPlayerCode = function(int $currCode, int $candCode, string $playerName = '') use ($fotoDir, $stCodeMap): int {
                $stCode = $playerName !== '' ? (int)($stCodeMap[strtoupper(trim($playerName))] ?? 0) : 0;
                $candidates = array_values(array_unique(array_filter([$candCode, $currCode, $stCode], fn($c) => $c > 0)));
                foreach ($candidates as $c) {
                    if (is_file("$fotoDir/$c.jpg")) {
                        return $c;
                    }
                }
                foreach ($candidates as $c) {
                    if ($c >= 10000) {
                        return $c;
                    }
                }
                return $candidates[0] ?? 0;
            };

            $byTeamPlayer = [];
            foreach ($albumRecords as $ar) {
                $hId = (int)$ar['historicalTeamId'];
                $pName = $ar['playerName'];
                $key = "$hId:$pName";
                $arCode = (int)($ar['playerId'] ?? 0);

                if (!isset($byTeamPlayer[$key])) {
                    $byTeamPlayer[$key] = [
                        'teamId' => $hId,
                        'teamName' => $franchiseData['alboTeamNames'][$hId] ?? $ar['teamName'],
                        'player' => $pName,
                        'code' => 0,
                        'role' => $ar['role'],
                        'appearances' => 0,
                        'totVoti' => 0.0,
                        'totFV' => 0.0,
                        'goals' => 0,
                        'cautions' => 0,
                        'expulsions' => 0,
                        'totCost' => 0.0,
                        'seasonsCount' => 0
                    ];
                }

                $byTeamPlayer[$key]['code'] = $pickPlayerCode((int)$byTeamPlayer[$key]['code'], $arCode, $pName);
                $byTeamPlayer[$key]['teamName'] = $ar['teamName'];
                $byTeamPlayer[$key]['appearances'] += (int)$ar['appearances'];
                $byTeamPlayer[$key]['totVoti'] += (float)$ar['totVoti'];
                $byTeamPlayer[$key]['totFV'] += (float)$ar['totFV'];
                $byTeamPlayer[$key]['goals'] += (int)$ar['goals'];
                $byTeamPlayer[$key]['cautions'] += (int)$ar['cautions'];
                $byTeamPlayer[$key]['expulsions'] += (int)$ar['expulsions'];
                $byTeamPlayer[$key]['totCost'] += (float)$ar['cost'];
                $byTeamPlayer[$key]['seasonsCount']++;
            }

            $fedelissimi = [];
            $cannonieri = [];
            $cattivi = [];
            $ratings = [];
            $allCandidates = [];

            foreach ($byTeamPlayer as $it) {
                $pres = $it['appearances'];
                $mv = $pres > 0 ? round($it['totVoti'] / $pres, 2) : 0;
                $fmv = $pres > 0 ? round($it['totFV'] / $pres, 2) : 0;
                $avgCost = $it['seasonsCount'] > 0 ? round($it['totCost'] / $it['seasonsCount'], 1) : 0;
                $pCode = (int)($it['code'] ?? 0);

                // Formula ufficiale decompilata da SortStatistiche.java
                $ruoloInt = match($it['role']) {
                    'P' => 1,
                    'D' => 2,
                    'C' => 3,
                    default => 4
                };
                $refRating = 6.0;
                $bonusPortiere = ($ruoloInt === 1) ? 0.75 : 0.0;
                $fattore = match($ruoloInt) {
                    1 => 1.75,
                    2 => 1.5,
                    3 => 1.25,
                    default => 1.0
                };
                $voto = $fmv + $bonusPortiere;
                if ($voto < $refRating) {
                    $valRating = ($voto - $refRating) * ($avgCost / ($topCrediti + 0.5)) * $pres / $fattore * 200.0;
                } else {
                    $voto += 0.5;
                    $valRating = ($voto - $refRating) * (($topCrediti * 2.0 - $avgCost) / $topCrediti) * $pres * $fattore;
                }
                $rating = round($valRating, 2);

                if ($pres > 0) {
                    $fedelissimi[] = [
                        'teamId' => $it['teamId'],
                        'teamName' => $it['teamName'],
                        'player' => $it['player'],
                        'code' => $pCode,
                        'role' => $it['role'],
                        'roleShort' => $it['role'],
                        'appearances' => $pres
                    ];

                    $ratings[] = [
                        'teamId' => $it['teamId'],
                        'teamName' => $it['teamName'],
                        'player' => $it['player'],
                        'code' => $pCode,
                        'role' => $it['role'],
                        'roleShort' => $it['role'],
                        'rating' => $rating,
                        'fmv' => $fmv,
                        'costo' => $avgCost,
                        'appearances' => $pres
                    ];

                    $allCandidates[] = [
                        'teamId' => $it['teamId'],
                        'teamName' => $it['teamName'],
                        'player' => $it['player'],
                        'code' => $pCode,
                        'role' => $it['role'],
                        'roleShort' => $it['role'],
                        'goals' => $it['goals'],
                        'appearances' => $pres,
                        'mv' => $mv,
                        'fmv' => $fmv
                    ];
                }
                if ($it['goals'] > 0) {
                    $cannonieri[] = [
                        'teamId' => $it['teamId'],
                        'teamName' => $it['teamName'],
                        'player' => $it['player'],
                        'code' => $pCode,
                        'role' => $it['role'],
                        'roleShort' => $it['role'],
                        'goals' => $it['goals'],
                        'appearances' => $pres,
                        'mv' => $mv,
                        'fmv' => $fmv
                    ];
                }
                if ($it['cautions'] > 0 || $it['expulsions'] > 0) {
                    $cattivi[] = [
                        'teamId' => $it['teamId'],
                        'teamName' => $it['teamName'],
                        'player' => $it['player'],
                        'code' => $pCode,
                        'role' => $it['role'],
                        'roleShort' => $it['role'],
                        'expulsions' => $it['expulsions'],
                        'cautions' => $it['cautions'],
                        'appearances' => $pres,
                        'mv' => $mv,
                        'fmv' => $fmv
                    ];
                }
            }

            usort($fedelissimi, fn($a, $b) => $b['appearances'] <=> $a['appearances']);
            usort($cannonieri, fn($a, $b) => $b['goals'] <=> $a['goals']);
            usort($cattivi, fn($a, $b) => ($b['expulsions'] * 3 + $b['cautions']) <=> ($a['expulsions'] * 3 + $a['cautions']));

            $topRating = $ratings;
            usort($topRating, fn($a, $b) => ($b['rating'] <=> $a['rating']) ?: ($b['appearances'] <=> $a['appearances']));

            $flopRating = $ratings;
            usort($flopRating, fn($a, $b) => ($a['rating'] <=> $b['rating']) ?: ($b['appearances'] <=> $a['appearances']));

            $top11 = $allCandidates;
            usort($top11, fn($a, $b) => ($b['fmv'] <=> $a['fmv']) ?: ($b['appearances'] <=> $a['appearances']));

            $flop11 = $allCandidates;
            usort($flop11, fn($a, $b) => ($a['fmv'] <=> $b['fmv']) ?: ($b['appearances'] <=> $a['appearances']));

            $ruoliMap = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];

            $bestieNereAgg = [];
            foreach ($seasons as $sInfo) {
                $s = $sInfo['id'];
                $legaDb = $sInfo['lega_db'];
                $serieaDb = $sInfo['seriea_db'];
                if (!file_exists($legaDb) || !file_exists($serieaDb)) continue;

                try {
                    $db = new PDO("sqlite:$legaDb");
                    $db->exec("ATTACH DATABASE '$serieaDb' AS sa");

                    $teams = [];
                    foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
                        $lId = (int)$t['ID'];
                        $teams[$lId] = [
                            'name' => $t['Nome'],
                            'masterId' => $resolver($s, $lId, $t['Nome'], $t['Presidente'])
                        ];
                    }

                    $stmt = $db->query("
                        SELECT 
                            t.IDSquadra, t.Lista, t.Modif, t.Voto, t.Tot,
                            i.IDCasa, i.IDFuori
                        FROM Tabellino t
                        JOIN Incontro i ON i.ID = t.IDIncontro
                        WHERE i.Giocato = 1
                    ");

                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $myTeamLoc = (int)$row['IDSquadra'];
                        $oppTeamLoc = ($myTeamLoc === (int)$row['IDCasa']) ? (int)$row['IDFuori'] : (int)$row['IDCasa'];
                        if (!isset($teams[$oppTeamLoc])) continue;

                        $victimMaster = $teams[$oppTeamLoc]['masterId'];
                        $victimName = $franchiseData['alboTeamNames'][$victimMaster] ?? $teams[$oppTeamLoc]['name'];

                        $ids = explode('%', $row['Lista']);
                        $modifs = explode('%', $row['Modif']);
                        $voti = explode('%', $row['Voto']);
                        $tots = explode('%', $row['Tot']);
                        $starters = min(11, count($ids));

                        for ($i = 0; $i < $starters; $i++) {
                            $pId = (int)($ids[$i] ?? 0);
                            if ($pId <= 0) continue;
                            $m = (float)str_replace(',', '.', $modifs[$i] ?? 0);
                            $gol = ($m >= 3.0) ? (int)floor($m / 3.0) : ($m === 2.5 ? 1 : 0);
                            if ($gol <= 0) continue;

                            $pNameRow = $db->query("SELECT Nome, Ruolo, CodiceGazza FROM sa.GiocatoreA WHERE ID = $pId LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                            $pName = $pNameRow['Nome'] ?? "ID $pId";
                            $pRole = $ruoliMap[(int)($pNameRow['Ruolo'] ?? 3)] ?? 'C';
                            $pCode = (int)($pNameRow['CodiceGazza'] ?? 0);

                            $bnKey = "$victimMaster:$pName";
                            if (!isset($bestieNereAgg[$bnKey])) {
                                $bestieNereAgg[$bnKey] = [
                                    'teamId' => $victimMaster,
                                    'teamName' => $victimName,
                                    'player' => $pName,
                                    'code' => 0,
                                    'role' => $pRole,
                                    'goals' => 0,
                                    'appearances' => 0,
                                    'totVoti' => 0.0,
                                    'totFV' => 0.0
                                ];
                            }
                            $bestieNereAgg[$bnKey]['code'] = $pickPlayerCode((int)$bestieNereAgg[$bnKey]['code'], $pCode, $pName);
                            $bestieNereAgg[$bnKey]['goals'] += $gol;
                            $bestieNereAgg[$bnKey]['appearances']++;
                            $bestieNereAgg[$bnKey]['totVoti'] += (float)str_replace(',', '.', $voti[$i] ?? 0);
                            $bestieNereAgg[$bnKey]['totFV'] += (float)str_replace(',', '.', $tots[$i] ?? 0);
                        }
                    }
                } catch (Exception $e) {}
            }

            $bestieNere = [];
            foreach ($bestieNereAgg as $bn) {
                $pres = $bn['appearances'];
                $bestieNere[] = [
                    'teamId' => $bn['teamId'],
                    'teamName' => $bn['teamName'],
                    'player' => $bn['player'],
                    'code' => (int)($bn['code'] ?? 0),
                    'role' => $bn['role'],
                    'roleShort' => $bn['role'],
                    'goals' => $bn['goals'],
                    'appearances' => $pres,
                    'mv' => $pres > 0 ? round($bn['totVoti'] / $pres, 2) : 0,
                    'fmv' => $pres > 0 ? round($bn['totFV'] / $pres, 2) : 0
                ];
            }
            usort($bestieNere, fn($a, $b) => $b['goals'] <=> $a['goals']);

            // Ottimizzazione dimensioni cache: filtriamo al massimo le migliori quote per fantasquadra
            // per evitare di serializzare migliaia di record a zero presenze/gol
            $filterTopByTeam = function(array $list, int $maxPerTeam): array {
                $counts = [];
                $res = [];
                foreach ($list as $item) {
                    $tId = $item['teamId'] ?? 0;
                    $counts[$tId] = ($counts[$tId] ?? 0) + 1;
                    if ($counts[$tId] <= $maxPerTeam) {
                        $res[] = $item;
                    }
                }
                return $res;
            };

            $filterTopByTeamRole = function(array $list, int $maxPerRolePerTeam): array {
                $counts = [];
                $res = [];
                foreach ($list as $item) {
                    $tId = $item['teamId'] ?? 0;
                    $r = $item['roleShort'] ?? $item['role'] ?? 'C';
                    $key = "$tId:$r";
                    $counts[$key] = ($counts[$key] ?? 0) + 1;
                    if ($counts[$key] <= $maxPerRolePerTeam) {
                        $res[] = $item;
                    }
                }
                return $res;
            };

            $out = [
                'teams' => $franchiseData['alboTeams'],
                'fedelissimi' => $filterTopByTeam($fedelissimi, 30),
                'cannonieri' => $filterTopByTeam($cannonieri, 30),
                'cattivi' => $filterTopByTeam($cattivi, 30),
                'bestieNere' => $filterTopByTeam($bestieNere, 30),
                'top11' => $filterTopByTeamRole($top11, 25),
                'flop11' => $filterTopByTeamRole($flop11, 25),
                'ratings' => $topRating,
                'topRating' => $filterTopByTeam($topRating, 30),
                'flopRating' => $filterTopByTeam($flopRating, 30)
            ];

            $jsonOut = json_encode($out, JSON_UNESCAPED_UNICODE);
            @fcm_write_file_atomic($cacheFile, $jsonOut);
            if (!$isCli) echo $jsonOut;
            return $out;

        case 'ranking':
        case 'ranking_divisioni':
            $cacheFile = "$sqliteBase/ranking.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $resolver = $franchiseData['resolver'];
            $compResolverData = getCompetitionResolver($sqliteBase, $latestSeasonId);
            $compResolver = $compResolverData['resolver'];
            $cfg = getRankingConfig($sqliteBase, $compResolverData['masterComps']);
            $extraTimeMode = $cfg['extra_time_mode'] ?? 'regular_only';

            $masterPath = "$sqliteBase/stagione_$latestSeasonId/lega_$latestSeasonId.sqlite";
            if ($latestSeasonId <= 0 || !file_exists($masterPath)) {
                $emptyRanking = [
                    'ranking' => [],
                    'palmares' => [],
                    'config' => [
                        'placement' => $cfg['placement'] ?? [],
                        'matches' => $cfg['matches'] ?? [],
                        'goals' => $cfg['goals'] ?? [],
                        'decay' => $cfg['decay'] ?? [],
                        'older_decay' => $cfg['older_decay'] ?? 0,
                        'extra_time_mode' => $extraTimeMode
                    ],
                    'divisions' => []
                ];
                $jsonOut = json_encode($emptyRanking, JSON_UNESCAPED_UNICODE);
                @fcm_write_file_atomic($cacheFile, $jsonOut);
                if (!$isCli) echo $jsonOut;
                return $emptyRanking;
            }

            $dbMaster = new PDO("sqlite:$masterPath");
            $alboPos = $dbMaster->query("SELECT Stagione, IDFantasquadra, Presidente, IDCompetizione, Posizione FROM AlboPosizione")->fetchAll(PDO::FETCH_ASSOC);

            // Calcola la giornata attuale e la giornata immediatamente precedente nella stagione in corso
            $playedDaysStmt = $dbMaster->query("
                SELECT DISTINCT GiornataDiA 
                FROM Incontro 
                WHERE Giocato = 1 AND IDTipo != 2 AND IDTipo != 3 AND IDCasa > 0 AND IDFuori > 0 
                ORDER BY GiornataDiA ASC
            ");
            $playedDays = $playedDaysStmt ? $playedDaysStmt->fetchAll(PDO::FETCH_COLUMN) : [];
            $currentDay = !empty($playedDays) ? (int)end($playedDays) : 0;
            $prevDay = count($playedDays) >= 2 ? (int)$playedDays[count($playedDays) - 2] : 0;

            $ranking = [];
            foreach ($franchiseData['alboTeams'] as $t) {
                $tId = (int)$t['ID'];
                $ranking[$tId] = [
                    'idAlbo' => $tId,
                    'idAttuale' => (int)$t['IDAttuale'],
                    'teamName' => $t['Nome'],
                    'points' => 0.0,
                    'prevPoints' => 0.0,
                    'seasons' => 0,
                    'isCurrent' => ((int)$t['IDAttuale'] !== 0),
                    'seasonsList' => []
                ];
            }

            foreach ($alboPos as $ap) {
                $s = (int)$ap['Stagione'];
                $tId = (int)$ap['IDFantasquadra'];
                $rawCId = (int)$ap['IDCompetizione'];
                $pos = (int)$ap['Posizione'];
                if (!isset($ranking[$tId])) continue;

                $cId = $compResolver($s, $rawCId);
                if ($cId <= 0) continue; // Competizione esclusa dal ranking

                $age = $latestSeasonId - $s;
                $weight = getDecayWeight($cfg, $age);
                $pts = $cfg['placement'][$cId][$pos] ?? 0;

                if ($pts > 0 && $weight > 0) {
                    $ranking[$tId]['points'] += $pts * $weight;
                    $ranking[$tId]['prevPoints'] += $pts * $weight;
                }
            }

            for ($s = 1; $s <= $latestSeasonId; $s++) {
                $age = $latestSeasonId - $s;
                $weight = getDecayWeight($cfg, $age);
                $isCurrentSeason = ($s === $latestSeasonId);

                $dbPath = "$sqliteBase/stagione_$s/lega_$s.sqlite";
                if (!file_exists($dbPath)) continue;

                try {
                    $db = new PDO("sqlite:$dbPath");
                    $teams = [];
                    foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
                        $lId = (int)$t['ID'];
                        $mId = $resolver($s, $lId, $t['Nome'], $t['Presidente']);
                        $teams[$lId] = $mId;
                        if (isset($ranking[$mId])) {
                            $ranking[$mId]['seasonsList'][$s] = true;
                        }
                    }

                    if ($weight <= 0) continue;

                    $gironeComp = [];
                    foreach ($db->query("SELECT g.ID, g.IDCompetizione, c.Nome FROM Girone g LEFT JOIN Competizione c ON g.IDCompetizione = c.ID") as $g) {
                        $locComp = (int)$g['IDCompetizione'];
                        $locName = $g['Nome'] ?? '';
                        $gironeComp[(int)$g['ID']] = $compResolver($s, $locComp, $locName);
                    }

                    $stmt = $db->query("
                        SELECT i.ID, i.IDCasa, i.IDFuori, i.IDGirone, i.IDTipo, i.GolCasa, i.GolFuori, i.GiornataDiA as gDay,
                               t1.Gol as t1Gol, t1.GolSupplementari as t1Supp, t1.GolRigori as t1Rig,
                               t2.Gol as t2Gol, t2.GolSupplementari as t2Supp, t2.GolRigori as t2Rig
                        FROM Incontro i
                        LEFT JOIN Tabellino t1 ON i.ID = t1.IDIncontro AND i.IDCasa = t1.IDSquadra
                        LEFT JOIN Tabellino t2 ON i.ID = t2.IDIncontro AND i.IDFuori = t2.IDSquadra
                        WHERE i.Giocato = 1 AND i.IDTipo != 2 AND i.IDTipo != 3 AND i.IDCasa > 0 AND i.IDFuori > 0
                    ");

                    while ($inc = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $cId = (int)$inc['IDCasa'];
                        $fId = (int)$inc['IDFuori'];
                        if (!isset($teams[$cId]) || !isset($teams[$fId])) continue;

                        $mCasa = $teams[$cId];
                        $mFuori = $teams[$fId];
                        $cComp = $gironeComp[(int)$inc['IDGirone']] ?? 5;

                        $isNeutro = in_array((int)$inc['IDTipo'], [4, 7]);
                        $venueCasa = $isNeutro ? 'neutral' : 'home';
                        $venueFuori = $isNeutro ? 'neutral' : 'away';

                        $pCasa = getCompetitionMatchVenueParams($cfg, $cComp, $venueCasa);
                        $pFuori = getCompetitionMatchVenueParams($cfg, $cComp, $venueFuori);

                        $t1G = floatval($inc['t1Gol'] ?? $inc['GolCasa']);
                        $t2G = floatval($inc['t2Gol'] ?? $inc['GolFuori']);
                        $t1Supp = intval($inc['t1Supp'] ?? 0);
                        $t2Supp = intval($inc['t2Supp'] ?? 0);
                        $t1Rig = intval($inc['t1Rig'] ?? 0);
                        $t2Rig = intval($inc['t2Rig'] ?? 0);

                        if ($extraTimeMode === 'with_all') {
                            $gfCasa = $t1G;
                            $gsCasa = $t2G;
                        } elseif ($extraTimeMode === 'with_supp_no_rig') {
                            $gfCasa = max(0, $t1G - $t1Rig);
                            $gsCasa = max(0, $t2G - $t2Rig);
                        } else { // 'regular_only' (default standard UEFA: tempi regolamentari)
                            $gfCasa = max(0, $t1G - $t1Supp - $t1Rig);
                            $gsCasa = max(0, $t2G - $t2Supp - $t2Rig);
                        }

                        $gfFuori = $gsCasa;
                        $gsFuori = $gfCasa;

                        if ($gfCasa > $gsCasa) {
                            $resCasa = $pCasa['win'];
                            $resFuori = $pFuori['loss'];
                        } elseif ($gfCasa == $gsCasa) {
                            $resCasa = $pCasa['draw'];
                            $resFuori = $pFuori['draw'];
                        } else {
                            $resCasa = $pCasa['loss'];
                            $resFuori = $pFuori['win'];
                        }

                        $ptsCasa = round($resCasa + ($gfCasa * $pCasa['gf']) + ($gsCasa * $pCasa['gs']), 3);
                        $ptsFuori = round($resFuori + ($gfFuori * $pFuori['gf']) + ($gsFuori * $pFuori['gs']), 3);

                        $gDay = (int)($inc['gDay'] ?? 0);

                        if ($weight > 0) {
                            if (isset($ranking[$mCasa])) {
                                $ranking[$mCasa]['points'] += $ptsCasa * $weight;
                                if (!$isCurrentSeason || ($gDay <= $prevDay)) {
                                    $ranking[$mCasa]['prevPoints'] += $ptsCasa * $weight;
                                }
                            }
                            if (isset($ranking[$mFuori])) {
                                $ranking[$mFuori]['points'] += $ptsFuori * $weight;
                                if (!$isCurrentSeason || ($gDay <= $prevDay)) {
                                    $ranking[$mFuori]['prevPoints'] += $ptsFuori * $weight;
                                }
                            }
                        }
                    }
                } catch (Exception $e) {}
            }

            $trophiesMap = [];
            foreach ($alboPos as $ap) {
                if ((int)$ap['Posizione'] === 1) {
                    $s = (int)$ap['Stagione'];
                    $sqId = (int)$ap['IDFantasquadra'];
                    $rawCId = (int)$ap['IDCompetizione'];
                    $cId = $compResolver($s, $rawCId);
                    if ($cId > 0) {
                        $trophiesMap[$sqId][$cId] = ($trophiesMap[$sqId][$cId] ?? 0) + 1;
                    }
                }
            }

            foreach ($ranking as &$r) {
                $r['seasons'] = count($r['seasonsList']);
                $r['points'] = round($r['points'], 3);
                $r['prevPoints'] = round($r['prevPoints'], 3);
                $r['trophies'] = $trophiesMap[$r['idAlbo']] ?? (object)[];
                unset($r['seasonsList']);
            }
            unset($r);

            $rawList = array_values($ranking);
            $prevSorted = $rawList;
            usort($prevSorted, function($a, $b) {
                $ptsA = $a['prevPoints'];
                $ptsB = $b['prevPoints'];
                if ($ptsB !== $ptsA) return $ptsB <=> $ptsA;
                return $b['seasons'] <=> $a['seasons'];
            });

            $prevRankMap = [];
            foreach ($prevSorted as $idx => $item) {
                $prevRankMap[$item['idAlbo']] = $idx + 1;
            }

            usort($rawList, function($a, $b) {
                if ($b['points'] !== $a['points']) return $b['points'] <=> $a['points'];
                return $b['seasons'] <=> $a['seasons'];
            });

            $finalRanking = [];
            foreach ($rawList as $idx => $item) {
                $curPos = $idx + 1;
                $prevPos = $prevRankMap[$item['idAlbo']] ?? $curPos;
                $finalRanking[] = array_merge($item, [
                    'position' => $curPos,
                    'prevPosition' => $prevPos,
                    'delta' => $prevPos - $curPos
                ]);
            }

            $palmares = array_map(function($mc) {
                return [
                    'id' => (int)$mc['ID'],
                    'Competizione' => (int)$mc['ID'],
                    'compId' => (int)$mc['ID'],
                    'name' => $mc['Nome'],
                    'Label' => $mc['Nome'],
                    'label' => $mc['Nome'],
                    'icon' => $mc['icon'],
                    'Icona' => $mc['icon']
                ];
            }, $compResolverData['masterComps']);

            // Calcolo Ranking Divisioni (se la lega corrente ha divisioni in Divisione / Fantasquadra)
            $divisionsMap = [];
            try {
                $divRows = $dbMaster->query("SELECT ID, Nome FROM Divisione ORDER BY ID ASC")->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($divRows)) {
                    $teamDivMap = [];
                    foreach ($dbMaster->query("SELECT ID, IDDivisione FROM Fantasquadra WHERE IDDivisione > 0") as $fd) {
                        $teamDivMap[(int)$fd['ID']] = (int)$fd['IDDivisione'];
                    }

                    if (!empty($teamDivMap)) {
                        foreach ($divRows as $dr) {
                            $dId = (int)$dr['ID'];
                            $dName = trim($dr['Nome'] ?? "Divisione $dId");
                            $divTeams = [];
                            foreach ($finalRanking as $rItem) {
                                $currId = (int)($rItem['idAttuale'] ?? 0);
                                if ($currId > 0 && isset($teamDivMap[$currId]) && $teamDivMap[$currId] === $dId) {
                                    $divTeams[] = $rItem;
                                }
                            }
                            if (!empty($divTeams)) {
                                usort($divTeams, function($a, $b) {
                                    if ($b['points'] !== $a['points']) return $b['points'] <=> $a['points'];
                                    return $b['seasons'] <=> $a['seasons'];
                                });
                                $prevDivSorted = $divTeams;
                                usort($prevDivSorted, function($a, $b) {
                                    if ($b['prevPoints'] !== $a['prevPoints']) return $b['prevPoints'] <=> $a['prevPoints'];
                                    return $b['seasons'] <=> $a['seasons'];
                                });
                                $prevDivMap = [];
                                foreach ($prevDivSorted as $pIdx => $pItem) {
                                    $prevDivMap[$pItem['idAlbo']] = $pIdx + 1;
                                }
                                $rankedDivTeams = [];
                                foreach ($divTeams as $dIdx => $dItem) {
                                    $dCurPos = $dIdx + 1;
                                    $dPrevPos = $prevDivMap[$dItem['idAlbo']] ?? $dCurPos;
                                    $rankedDivTeams[] = array_merge($dItem, [
                                        'position' => $dCurPos,
                                        'prevPosition' => $dPrevPos,
                                        'delta' => $dPrevPos - $dCurPos
                                    ]);
                                }
                                $divisionsMap[$dName] = $rankedDivTeams;
                            }
                        }
                    }
                }
            } catch (Exception $e) {}

            $outRanking = [
                'ranking' => $finalRanking,
                'palmares' => $palmares,
                'config' => [
                    'placement' => $cfg['placement'],
                    'matches' => $cfg['matches'],
                    'goals' => $cfg['goals'],
                    'decay' => $cfg['decay'],
                    'older_decay' => $cfg['older_decay'],
                    'extra_time_mode' => $extraTimeMode
                ],
                'divisions' => $divisionsMap
            ];

            $jsonOut = json_encode($outRanking, JSON_UNESCAPED_UNICODE);
            @fcm_write_file_atomic($cacheFile, $jsonOut);
            if (!$isCli) echo $jsonOut;
            return $outRanking;

        case 'top_costi':
            $cacheFile = "$sqliteBase/top_costi.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $franchiseData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $resolver = $franchiseData['resolver'];
            $ruoliMap = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];

            // Indice codici foto canonici da statistiche_storiche.json + img/foto per risoluzioni multi-stagione
            $fotoDir = dirname(__DIR__) . '/img/foto';
            $stCodeMap = [];
            $stByAnyCode = [];
            $stStoricheFile = "$sqliteBase/statistiche_storiche.json";
            if (file_exists($stStoricheFile)) {
                $stRaw = @json_decode((string)@file_get_contents($stStoricheFile), true);
                if (!empty($stRaw['players']) && is_array($stRaw['players'])) {
                    foreach ($stRaw['players'] as $stp) {
                        $stpName = strtoupper(trim((string)($stp['nome'] ?? '')));
                        $stpCode = (int)($stp['codice'] ?? 0);
                        if ($stpName !== '' && $stpCode > 0) {
                            $stCodeMap[$stpName] = $stpCode;
                        }
                        if ($stpCode > 0 && !empty($stp['codici']) && is_array($stp['codici'])) {
                            foreach ($stp['codici'] as $altC) {
                                $altInt = (int)$altC;
                                if ($altInt > 0 && !isset($stByAnyCode[$altInt])) {
                                    $stByAnyCode[$altInt] = $stpCode;
                                }
                            }
                        }
                    }
                }
            }

            $pickCostiCode = function(int $rawCode, string $playerName = '') use ($fotoDir, $stCodeMap, $stByAnyCode): int {
                $mappedCode = $rawCode > 0 ? (int)($stByAnyCode[$rawCode] ?? 0) : 0;
                $stCode = $playerName !== '' ? (int)($stCodeMap[strtoupper(trim($playerName))] ?? 0) : 0;
                $candidates = array_values(array_unique(array_filter([$mappedCode, $stCode, $rawCode], fn($c) => $c > 0)));
                foreach ($candidates as $c) {
                    if (is_file("$fotoDir/$c.jpg")) {
                        return $c;
                    }
                }
                if ($mappedCode > 0) return $mappedCode;
                if ($stCode >= 10000) return $stCode;
                if ($rawCode >= 10000) return $rawCode;
                return $candidates[0] ?? 0;
            };

            $costi = [];
            foreach ($seasons as $sInfo) {
                $s = (int)$sInfo['id'];
                $legaDb = $sInfo['lega_db'];
                $serieaDb = $sInfo['seriea_db'];
                if (!file_exists($legaDb) || !file_exists($serieaDb)) continue;

                try {
                    $db = new PDO("sqlite:$legaDb");
                    $db->exec("ATTACH DATABASE '$serieaDb' AS sa");

                    $infoRow = $db->query("SELECT AnnoArchivio FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    $anno = (int)($infoRow['AnnoArchivio'] ?? ($sInfo['anno'] ?? getFallbackSeasonYear($sqliteBase, $s)));
                    $annoStagione = "$anno/" . ($anno + 1);

                    $teams = [];
                    foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $t) {
                        $lId = (int)$t['ID'];
                        $teams[$lId] = [
                            'name' => $t['Nome'],
                            'masterId' => $resolver($s, $lId, $t['Nome'], $t['Presidente'])
                        ];
                    }

                    // Mappatura squadre reali di Serie A per ciascun giocatore (gestione cambi squadra durante l'anno)
                    $playerTeamsMap = [];
                    try {
                        $giocaStmt = $db->query("
                            SELECT g.IDGiocatore, s.Nome as squadraNome
                            FROM sa.GiocaIn g
                            JOIN sa.SquadraDiA s ON s.ID = g.IDSquadra
                            WHERE s.Nome NOT LIKE '{%}' AND s.Nome != ''
                            ORDER BY g.Giornata ASC
                        ");
                        while ($gr = $giocaStmt->fetch(PDO::FETCH_ASSOC)) {
                            $pId = (int)$gr['IDGiocatore'];
                            $sName = trim($gr['squadraNome']);
                            if (!isset($playerTeamsMap[$pId])) {
                                $playerTeamsMap[$pId] = [];
                            }
                            if (!in_array($sName, $playerTeamsMap[$pId])) {
                                $playerTeamsMap[$pId][] = $sName;
                            }
                        }
                    } catch (Exception $e) {}

                    $stmt = $db->query("
                        SELECT 
                            t.IDGiocatore, t.IDSquadra, t.Ruolo, t.CostoAcq,
                            g.Nome as nomeGiocatore, g.CodiceGazza,
                            st.Squadra as serieATeam, st.Presenze, st.GolFatti, st.MVT, st.FMT
                        FROM Tesserato t
                        JOIN sa.GiocatoreA g ON g.ID = t.IDGiocatore
                        LEFT JOIN sa.Statistiche st ON st.ID = t.IDGiocatore
                        WHERE t.CostoAcq > 0
                    ");

                    $rawRows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
                    $missingIds = [];
                    foreach ($rawRows as $r) {
                        if ((int)($r['Presenze'] ?? 0) === 0) {
                            $missingIds[] = (int)$r['IDGiocatore'];
                        }
                    }
                    $fallbackStats = !empty($missingIds)
                        ? fcmComputeSeasonSerieAFallbackStats($db, $missingIds, 'sa')
                        : [];

                    foreach ($rawRows as $r) {
                        $tId = (int)$r['IDSquadra'];
                        $sq = $teams[$tId] ?? ['name' => "Squadra $tId", 'masterId' => $tId];
                        $pres = (int)($r['Presenze'] ?? 0);
                        $goals = (int)($r['GolFatti'] ?? 0);
                        $mvt = (float)($r['MVT'] ?? 0);
                        $fmt = (float)($r['FMT'] ?? 0);

                        $pGId = (int)$r['IDGiocatore'];
                        if ($pres === 0 && isset($fallbackStats[$pGId])) {
                            $fb = $fallbackStats[$pGId];
                            $pres = (int)$fb['pres'];
                            $goals = (int)$fb['goals'];
                            $mvt = (float)$fb['mv'];
                            $fmt = (float)$fb['fmv'];
                        }
                        $rawCode = (int)($r['CodiceGazza'] ?? 0);
                        $resolvedCode = $pickCostiCode($rawCode, (string)$r['nomeGiocatore']);
                        $serieAStr = '';
                        if (!empty($playerTeamsMap[$pGId])) {
                            $serieAStr = implode(' / ', $playerTeamsMap[$pGId]);
                        } elseif (!empty($r['serieATeam'])) {
                            $serieAStr = $r['serieATeam'];
                        }

                        $costi[] = [
                            'id' => (int)($rawCode ?: $pGId),
                            'code' => $resolvedCode,
                            'playerId' => $pGId,
                            'name' => $r['nomeGiocatore'],
                            'season' => $annoStagione,
                            'seasonNum' => $s,
                            'teamId' => $sq['masterId'],
                            'localTeamId' => $tId,
                            'teamName' => $franchiseData['alboTeamNames'][$sq['masterId']] ?? $sq['name'],
                            'seasonTeamName' => $sq['name'],
                            'role' => $ruoliMap[(int)$r['Ruolo']] ?? 'C',
                            'roleShort' => $ruoliMap[(int)$r['Ruolo']] ?? 'C',
                            'serieA' => $serieAStr,
                            'cost' => (float)$r['CostoAcq'],
                            'appearances' => $pres,
                            'goals' => $goals,
                            'mv' => $pres > 0 ? number_format($mvt, 2, '.', '') : '-',
                            'fmv' => $pres > 0 ? number_format($fmt, 2, '.', '') : '-'
                        ];
                    }
                } catch (Exception $e) {}
            }

            usort($costi, fn($a, $b) => $b['cost'] <=> $a['cost']);

            $out = [
                'count' => count($costi),
                'maxSeason' => $latestSeasonId,
                'teams' => $franchiseData['alboTeams'],
                'players' => $costi
            ];

            $jsonOut = json_encode($out, JSON_UNESCAPED_UNICODE);
            @fcm_write_file_atomic($cacheFile, $jsonOut);
            if (!$isCli) echo $jsonOut;
            return $out;

        case 'squadre_rose':
        case 'rose':
        case 'eta_rose':
            $seasonId = isset($_GET['stagione']) ? (int)$_GET['stagione'] : (isset($_GET['season']) ? (int)$_GET['season'] : 0);
            $seasonsAll = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasonsAll) ? (int)$seasonsAll[0]['id'] : 0;
            if ($seasonId <= 0) {
                $seasonId = $latestSeasonId;
            }
            $dir = "$sqliteBase/stagione_$seasonId";
            $legaDb = "$dir/lega_$seasonId.sqlite";
            $serieaDb = "$dir/seriea_$seasonId.sqlite";
            $cacheFile = "$dir/rose.json";

            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase, $seasonId) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            if (!file_exists($legaDb)) {
                if (!$isCli) {
                    http_response_code(404);
                    echo json_encode(['error' => "Database lega per stagione $seasonId non trovato"], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

            try {
                $db = new PDO("sqlite:$legaDb");
                $hasSerieA = file_exists($serieaDb);
                if ($hasSerieA) {
                    $db->exec("ATTACH DATABASE '$serieaDb' AS seriea");
                }

                $infoRow = $db->query("SELECT Nome, Stagione, AnnoArchivio, CreditiTotali FROM Lega LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                $anno = (int)($infoRow['AnnoArchivio'] ?? getFallbackSeasonYear($sqliteBase, $seasonId));
                $creditiTotali = !empty($infoRow['CreditiTotali']) ? (int)$infoRow['CreditiTotali'] : (int)getLatestCreditiTotali($sqliteBase, $seasonsAll);

                // Fetch balance transactions per team
                $bilancio = [];
                $bilancioTotals = [];
                try {
                    $bRows = $db->query("SELECT IDSquadra as teamId, Progressivo as prog, Descrizione as description, Crediti as value, DataTransazione as date FROM EntryInBilancio ORDER BY IDSquadra, Progressivo ASC")->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($bRows as $br) {
                        $tId = (int)$br['teamId'];
                        if (!isset($bilancio[$tId])) $bilancio[$tId] = [];
                        $val = (int)$br['value'];
                        if (!isset($bilancioTotals[$tId])) $bilancioTotals[$tId] = 0;
                        $bilancioTotals[$tId] += $val;
                        $bilancio[$tId][] = [
                            'date' => $br['date'],
                            'description' => $br['description'],
                            'value' => abs($val),
                            'isIncome' => $val > 0
                        ];
                    }
                } catch (Exception $e) {}

                $fInfo = getFranchiseResolver($sqliteBase, $latestSeasonId > 0 ? $latestSeasonId : $seasonId);
                $resolver = $fInfo['resolver'];
                $alboTeamNames = $fInfo['alboTeamNames'];

                $squadreRaw = $db->query("SELECT ID as id, Nome as nome, Presidente as presidente FROM Fantasquadra ORDER BY ID")->fetchAll(PDO::FETCH_ASSOC);
                $squadre = [];
                foreach ($squadreRaw as $sq) {
                    $tId = (int)$sq['id'];
                    $fId = $resolver($seasonId, $tId, $sq['nome'], $sq['presidente']);
                    $spent = isset($bilancioTotals[$tId]) ? $bilancioTotals[$tId] : 0;
                    $squadre[] = [
                        'id' => $tId,
                        'nome' => $sq['nome'],
                        'presidente' => $sq['presidente'],
                        'franchiseId' => $fId,
                        'franchiseName' => $alboTeamNames[$fId] ?? $sq['nome'],
                        'creditiResidui' => max(0, $creditiTotali + $spent)
                    ];
                }

                $calciatori = [];
                if ($hasSerieA) {
                    // Mappatura squadre reali di Serie A da GiocaIn per ciascun calciatore (gestione cambi squadra e passaggi a estero/minori)
                    $playerRealTeams = [];
                    try {
                        $realTeamRows = $db->query("
                            SELECT gi.IDGiocatore, sq.Nome, MIN(gi.Giornata) as minG
                            FROM seriea.GiocaIn gi
                            JOIN seriea.SquadraDiA sq ON gi.IDSquadra = sq.ID
                            WHERE sq.Nome NOT LIKE '{%' AND sq.Nome != ''
                            GROUP BY gi.IDGiocatore, sq.Nome
                            ORDER BY gi.IDGiocatore, minG ASC
                        ")->fetchAll(PDO::FETCH_ASSOC);

                        foreach ($realTeamRows as $rtr) {
                            $pid = (int)$rtr['IDGiocatore'];
                            if (!isset($playerRealTeams[$pid])) $playerRealTeams[$pid] = [];
                            $playerRealTeams[$pid][] = trim($rtr['Nome']);
                        }
                    } catch (Exception $e) {}

                    // Mappatura squadre fallback (inclusi {SERIE ESTERA}, {SERIE MINORE}, {ELIMINATA})
                    $playerFallbackTeams = [];
                    try {
                        $allTeamRows = $db->query("
                            SELECT gi.IDGiocatore, sq.Nome, MIN(gi.Giornata) as minG
                            FROM seriea.GiocaIn gi
                            JOIN seriea.SquadraDiA sq ON gi.IDSquadra = sq.ID
                            WHERE sq.Nome != ''
                            GROUP BY gi.IDGiocatore, sq.Nome
                            ORDER BY gi.IDGiocatore, minG ASC
                        ")->fetchAll(PDO::FETCH_ASSOC);

                        foreach ($allTeamRows as $atr) {
                            $pid = (int)$atr['IDGiocatore'];
                            if (!isset($playerFallbackTeams[$pid])) $playerFallbackTeams[$pid] = [];
                            $playerFallbackTeams[$pid][] = trim($atr['Nome']);
                        }
                    } catch (Exception $e) {}

                    // Fallback statistiche reali da GiocaIn + Punteggio per calciatori con 0 presenze in Statistiche (es. emigrati/relegati)
                    $playerFallbackStats = [];
                    try {
                        $fbStatRows = $db->query("
                            SELECT 
                                gi.IDGiocatore,
                                COUNT(CASE WHEN p.Voto1 > 0 THEN 1 END) as pr,
                                ROUND(AVG(CASE WHEN p.Voto1 > 0 THEN p.Voto1 END), 2) as mv,
                                ROUND(AVG(CASE WHEN p.Voto1 > 0 THEN (p.Voto1 + p.GolFatti1 * 3 + p.Assist * 1 - p.Amm * 0.5 - p.Esp * 1 - p.Autogol1 * 2) END), 2) as fm,
                                SUM(p.GolFatti1) as goals,
                                SUM(p.Assist) as assist,
                                SUM(p.Amm) as amm,
                                SUM(p.Esp) as esp
                            FROM seriea.GiocaIn gi
                            JOIN seriea.Punteggio p ON gi.IDPunteggio = p.ID
                            GROUP BY gi.IDGiocatore
                            HAVING pr > 0
                        ")->fetchAll(PDO::FETCH_ASSOC);

                        foreach ($fbStatRows as $fsr) {
                            $playerFallbackStats[(int)$fsr['IDGiocatore']] = $fsr;
                        }
                    } catch (Exception $e) {}

                    $sql = "
                        SELECT 
                            f.ID as teamId, f.Nome as teamName, f.Presidente as coach,
                            t.Ruolo as role, t.CostoAcq as cost, t.CostoCess as costoCess,
                            t.Venduto as venduto, t.AnnoDiContratto as contract, t.InizioInfortunio as gioInf,
                            g.ID as playerId, g.Nome as name, g.CodiceGazza as code,
                            g.DataDiNascita as birthDateRaw, g.LuogoDiNascita as birthPlace,
                            g.Altezza as height, g.Peso as weight,
                            st.Squadra as serieATeam,
                            COALESCE(st.MVT, 0) as mv, COALESCE(st.FMT, 0) as fm,
                            COALESCE(NULLIF(st.CostoGazza, 0), NULLIF(g.CostoGazza, 0), 0) as val,
                            COALESCE(st.Presenze, 0) as pr, COALESCE(st.GolFatti, 0) as goals, COALESCE(st.Assist, 0) as assist,
                            COALESCE(st.Amm, 0) as amm, COALESCE(st.Esp, 0) as esp
                        FROM Fantasquadra f
                        JOIN Tesserato t ON t.IDSquadra = f.ID
                        JOIN seriea.GiocatoreA g ON t.IDGiocatore = g.ID
                        LEFT JOIN seriea.Statistiche st ON g.ID = st.ID
                        ORDER BY f.ID, t.Ruolo, g.Nome
                    ";
                    $rawCalciatori = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($rawCalciatori as $c) {
                        // PHP < 8.1: PDO SQLite restituisce stringhe, il client confronta numeri
                        foreach (['teamId', 'role', 'cost', 'costoCess', 'venduto', 'playerId', 'code', 'height', 'weight', 'val', 'pr', 'goals', 'assist', 'amm', 'esp'] as $k) {
                            if (isset($c[$k])) $c[$k] = (int)$c[$k];
                        }
                        foreach (['mv', 'fm'] as $k) {
                            if (isset($c[$k])) $c[$k] = (float)$c[$k];
                        }
                        $pId = (int)$c['playerId'];
                        $stOrig = trim($c['serieATeam'] ?? '');
                        
                        $finalTeam = '';
                        if (!empty($playerRealTeams[$pId])) {
                            $finalTeam = implode(', ', $playerRealTeams[$pId]);
                        } elseif (!empty($stOrig) && !str_starts_with($stOrig, '{')) {
                            $finalTeam = $stOrig;
                        } elseif (!empty($playerFallbackTeams[$pId])) {
                            $finalTeam = implode(', ', $playerFallbackTeams[$pId]);
                        } else {
                            $finalTeam = $stOrig;
                        }

                        $c['serieATeam'] = $finalTeam;

                        // Fallback statistiche se Statistiche non ha presenze ma il calciatore ha giocato
                        $pPr = (int)$c['pr'];
                        if ($pPr === 0 && isset($playerFallbackStats[$pId])) {
                            $fb = $playerFallbackStats[$pId];
                            $c['pr'] = (int)$fb['pr'];
                            $c['mv'] = (float)$fb['mv'];
                            $c['fm'] = (float)$fb['fm'];
                            $c['goals'] = (int)$fb['goals'];
                            $c['assist'] = (int)$fb['assist'];
                            $c['amm'] = (int)$fb['amm'];
                            $c['esp'] = (int)$fb['esp'];
                        }

                        // Calcolo stato (0 = rosa attiva, 1 = svincolato/ceduto, 2 = infortunato su lista infortuni)
                        $isSold = ((int)($c['venduto'] ?? 0) === 1);
                        $gioInf = (int)($c['gioInf'] ?? 0);
                        $rawContract = (int)($c['contract'] ?? 1);

                        if ($isSold) {
                            $state = 1;
                        } elseif ($gioInf > 0) {
                            $state = 2;
                        } else {
                            $state = 0;
                        }

                        $c['state'] = $state;
                        $c['gioInf'] = $gioInf;

                        // Rimpiazzi infortunati hanno contratto -1 (formattato come 'Inf') o -2 (come 'Pres')
                        if ($rawContract === -1) {
                            $c['contract'] = 'Inf';
                        } elseif ($rawContract === -2) {
                            $c['contract'] = 'Pres';
                        } else {
                            $c['contract'] = $rawContract > 0 ? (string)$rawContract : '-';
                        }

                        $calciatori[] = $c;
                    }
                }

                $out = [
                    'info' => [
                        'id' => $seasonId,
                        'anno' => $anno,
                        'anni_stagione' => "$anno/" . ($anno + 1),
                        'nome_lega' => $infoRow['Nome'] ?? "Stagione $seasonId",
                        'creditiTotali' => $creditiTotali
                    ],
                    'squadre' => $squadre,
                    'calciatori' => $calciatori,
                    'bilancio' => $bilancio
                ];

                $jsonOut = json_encode($out, JSON_UNESCAPED_UNICODE);
                @fcm_write_file_atomic($cacheFile, $jsonOut);
                if (!$isCli) echo $jsonOut;
                return $out;
            } catch (Exception $e) {
                if (!$isCli) {
                    http_response_code(500);
                    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

        case 'risultati_giornata':
            $seasonId = isset($_GET['stagione']) ? (int)$_GET['stagione'] : (isset($_GET['season']) ? (int)$_GET['season'] : 0);
            if ($seasonId <= 0) {
                $seasonsAll = getStagioniDisponibili($sqliteBase);
                $seasonId = !empty($seasonsAll) ? (int)$seasonsAll[0]['id'] : 0;
            }
            $day = isset($_GET['giornata']) ? (int)$_GET['giornata'] : (isset($_GET['day']) ? (int)$_GET['day'] : 1);

            $dir = "$sqliteBase/stagione_$seasonId";
            $legaDb = "$dir/lega_$seasonId.sqlite";
            $serieaDb = "$dir/seriea_$seasonId.sqlite";

            if (!file_exists($legaDb)) {
                http_response_code(404);
                echo json_encode(['error' => "Database per stagione $seasonId non trovato"], JSON_UNESCAPED_UNICODE);
                return null;
            }

            try {
                $db = new PDO("sqlite:$legaDb");
                $hasSerieA = file_exists($serieaDb);
                if ($hasSerieA) {
                    $db->exec("ATTACH DATABASE '$serieaDb' AS sa");
                }

                $teams = [];
                $teamDivMap = [];
                foreach ($db->query("SELECT ID, Nome, IDDivisione FROM Fantasquadra") as $t) {
                    $tId = (int)$t['ID'];
                    $teams[$tId] = $t['Nome'];
                    $teamDivMap[$tId] = (int)($t['IDDivisione'] ?? 0);
                }

                $comps = [];
                $competitionsList = [];
                $cStmt = $db->query("SELECT ID, Nome FROM Competizione ORDER BY ID");
                if ($cStmt) {
                    while ($cRow = $cStmt->fetch(PDO::FETCH_ASSOC)) {
                        $cId = (int)$cRow['ID'];
                        $comps[$cId] = $cRow['Nome'];
                        $competitionsList[] = ['id' => $cId, 'name' => $cRow['Nome']];
                    }
                }

                $divisionsList = [];
                $divisionsMap = [];
                $chkDiv = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Divisione'")->fetchColumn();
                if ($chkDiv > 0) {
                    $dStmt = $db->query("SELECT ID, Nome FROM Divisione ORDER BY ID");
                    if ($dStmt) {
                        while ($dRow = $dStmt->fetch(PDO::FETCH_ASSOC)) {
                            $dId = (int)$dRow['ID'];
                            $dName = trim($dRow['Nome'] ?? '');
                            if (!empty($dName)) {
                                $divisionsMap[$dId] = $dName;
                                $divisionsList[] = ['id' => $dId, 'name' => $dName];
                            }
                        }
                    }
                }

                $gironeToComp = [];
                $gironiMap = [];
                $gStmt = $db->query("SELECT ID, IDCompetizione, Nome FROM Girone");
                if ($gStmt) {
                    while ($gRow = $gStmt->fetch(PDO::FETCH_ASSOC)) {
                        $gId = (int)$gRow['ID'];
                        $gironeToComp[$gId] = (int)$gRow['IDCompetizione'];
                        $gironiMap[$gId] = $gRow['Nome'];
                    }
                }

                $divCompMap = [];
                if (!empty($divisionsList)) {
                    $chkDivComp = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='DivComp'")->fetchColumn();
                    if ($chkDivComp > 0) {
                        foreach ($db->query("SELECT IDDivisione, IDCompetizione FROM DivComp") as $dcRow) {
                            $divCompMap[(int)$dcRow['IDCompetizione']] = (int)$dcRow['IDDivisione'];
                        }
                    }
                }

                // Elenco giornate disponibili per questa stagione
                $availableDays = [];
                $adStmt = $db->query("SELECT DISTINCT GiornataDiA FROM Incontro WHERE IDTipo != 2 ORDER BY GiornataDiA ASC");
                if ($adStmt) {
                    while ($adRow = $adStmt->fetch(PDO::FETCH_ASSOC)) {
                        $adVal = (int)$adRow['GiornataDiA'];
                        if ($adVal > 0) $availableDays[] = $adVal;
                    }
                }

                // Se la giornata richiesta non contiene incontri (es. la lega è iniziata alla 2a o 3a di Serie A),
                // seleziona automaticamente la prima giornata effettivamente disputata o disponibile
                $origDay = $day;
                $chkCount = (int)$db->query("SELECT COUNT(*) FROM Incontro WHERE GiornataDiA = $day AND IDTipo != 2")->fetchColumn();
                if ($chkCount === 0 && !empty($availableDays)) {
                    $firstPlayed = (int)$db->query("SELECT MIN(GiornataDiA) FROM Incontro WHERE IDTipo != 2 AND Giocato = 1")->fetchColumn();
                    if ($firstPlayed > 0) {
                        $day = $firstPlayed;
                    } else {
                        $day = $availableDays[0];
                    }
                }

                $stmt = $db->query("
                    SELECT ID, IDTipo, IDCasa, IDFuori, IDGirone, ParzCasa, ParzFuori, TotCasa, TotFuori, GolCasa, GolFuori, GiornataDiA, Giocato
                    FROM Incontro
                    WHERE GiornataDiA = $day AND IDTipo != 2
                    ORDER BY ID
                ");

                $matches = [];
                $matchIds = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $mId = (int)$row['ID'];
                    $matchIds[] = $mId;
                    $cId = (int)$row['IDCasa'];
                    $fId = (int)$row['IDFuori'];
                    $gId = (int)($row['IDGirone'] ?? 0);
                    $cCompId = $gironeToComp[$gId] ?? 0;
                    $cDivId = $divCompMap[$cCompId] ?? ($teamDivMap[$cId] ?? ($teamDivMap[$fId] ?? 0));
                    $matches[] = [
                        'id' => $mId,
                        'season' => $seasonId,
                        'serieADay' => (int)$row['GiornataDiA'],
                        'homeTeamId' => $cId,
                        'homeTeamName' => $teams[$cId] ?? "Squadra $cId",
                        'awayTeamId' => $fId,
                        'awayTeamName' => $teams[$fId] ?? "Squadra $fId",
                        'homeScore' => (int)$row['GolCasa'],
                        'awayScore' => (int)$row['GolFuori'],
                        'homeTotal' => (float)$row['TotCasa'],
                        'awayTotal' => (float)$row['TotFuori'],
                        'compId' => $cCompId,
                        'compName' => $comps[$cCompId] ?? ($cCompId > 0 ? "Competizione $cCompId" : ''),
                        'gironeId' => $gId,
                        'gironeName' => $gironiMap[$gId] ?? '',
                        'divisionId' => $cDivId,
                        'divisionName' => $divisionsMap[$cDivId] ?? '',
                        'played' => (bool)$row['Giocato']
                    ];
                }

                $tabellini = [];
                if (!empty($matchIds)) {
                    $mList = implode(',', $matchIds);
                    $tabStmt = $db->query("
                        SELECT 
                            t.IDIncontro, t.IDSquadra, t.Lista, t.Ruolo, t.Voto, t.Modif, t.Tot,
                            t.ParzialeSquadra, t.FattoreCampo, t.ModPortiere, t.ModDifesa, t.ModCentrocampo, t.ModAttacco, t.ModModulo, t.TotaleSquadra, t.Gol,
                            t.Supplementari, t.ListaSupplementari, t.VotoSupplementari, t.FattoreCampoSupplementari, t.ParzialeSquadraSupplementari, t.GolSupplementari,
                            t.Rigori, t.ListaRigori, t.VotoRigori, t.GolRigori
                        FROM Tabellino t
                        WHERE t.IDIncontro IN ($mList)
                    ");

                    $playerMap = [];
                    if ($hasSerieA) {
                        $pRows = $db->query("SELECT g.ID, g.Nome, g.CodiceGazza, g.Ruolo, st.Squadra as club FROM sa.GiocatoreA g LEFT JOIN sa.Statistiche st ON st.ID = g.ID")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($pRows as $pr) {
                            $playerMap[(int)$pr['ID']] = [
                                'name' => $pr['Nome'],
                                'code' => $pr['CodiceGazza'] ?: $pr['ID'],
                                'role' => (int)($pr['Ruolo'] ?? 0),
                                'club' => $pr['club'] ?? ''
                            ];
                        }
                    }

                    while ($t = $tabStmt->fetch(PDO::FETCH_ASSOC)) {
                        $tId = (int)$t['IDSquadra'];
                        $incId = (int)$t['IDIncontro'];

                        $ids = explode('%', $t['Lista']);
                        $roles = explode('%', $t['Ruolo']);
                        $voti = explode('%', $t['Voto']);
                        $modifs = explode('%', $t['Modif']);
                        $tots = explode('%', $t['Tot']);

                        $players = [];
                        for ($j = 0; $j < count($ids); $j++) {
                            $pIdStr = $ids[$j] ?? '';
                            if ($j > 10 && (!$pIdStr || $pIdStr === '0')) continue;

                            $pRole = (int)($roles[$j] ?? 0);
                            $baseRole = 0;
                            if ($pRole >= 1 && $pRole <= 4) $baseRole = $pRole;
                            elseif ($pRole >= 5 && $pRole <= 8) $baseRole = $pRole - 4;
                            elseif ($pRole >= -4 && $pRole <= -1) $baseRole = abs($pRole);
                            elseif ($pRole >= -8 && $pRole <= -5) $baseRole = abs($pRole) - 4;

                            $isStarter = ($j <= 10);
                            $isOfficeReserve = ($pIdStr === '-1');
                            $isTribuna = ($j > 10 && $pRole >= -8 && $pRole <= -5);

                            $pId = (int)$pIdStr;
                            $pInfo = $playerMap[$pId] ?? ['name' => "Calciatore $pId", 'code' => $pId, 'role' => $baseRole, 'club' => ''];
                            $normRole = $baseRole ?: (int)($pInfo['role'] ?? 0);

                            $isSubbedIn = ($isStarter && $pRole >= 5 && $pRole <= 8);
                            $isSubbedOut = (!$isStarter && $pRole < 0 && $pRole >= -4);

                            $roleLabel = '-';
                            if ($isStarter) {
                                if ($isSubbedIn) {
                                    $roleLabel = ($pRole === 5 ? 'PR' : ($pRole === 6 ? 'DR' : ($pRole === 7 ? 'CR' : 'AR')));
                                } else if ($isOfficeReserve) {
                                    $roleLabel = ($normRole === 1 ? 'PU' : ($normRole === 2 ? 'DU' : ($normRole === 3 ? 'CU' : 'AU')));
                                } else {
                                    $roleLabel = ($normRole === 1 ? 'P' : ($normRole === 2 ? 'D' : ($normRole === 3 ? 'C' : 'A')));
                                }
                            } else if ($isSubbedOut) {
                                $roleLabel = ($pRole === -1 ? 'Ps' : ($pRole === -2 ? 'Ds' : ($pRole === -3 ? 'Cs' : 'As')));
                            } else {
                                $roleLabel = ($normRole === 1 ? 'P' : ($normRole === 2 ? 'D' : ($normRole === 3 ? 'C' : 'A')));
                            }

                            $rawVote = $voti[$j] ?? '-';
                            $totVote = $tots[$j] ?? '-';
                            $mod = $modifs[$j] ?? '0';

                            $players[] = [
                                'id' => $pInfo['code'] ?: $pId,
                                'code' => $pInfo['code'] ?: $pId,
                                'localId' => $pId,
                                'name' => $isOfficeReserve ? "Riserva d'Ufficio" : $pInfo['name'],
                                'club' => $pInfo['club'],
                                'role' => $normRole,
                                'roleNum' => $pRole,
                                'roleLabel' => $roleLabel,
                                'isStarter' => $isStarter,
                                'isTribuna' => $isTribuna,
                                'isSubbedIn' => $isSubbedIn,
                                'isSubbedOut' => $isSubbedOut,
                                'isOfficeReserve' => $isOfficeReserve,
                                'rawVote' => $rawVote,
                                'bonusMalus' => $mod,
                                'totVote' => $totVote
                            ];
                        }

                        $hasExtraTime = (!empty($t['Supplementari']) && (int)$t['Supplementari'] === 1 && ($t['ParzialeSquadraSupplementari'] ?? '') !== 'x');
                        $extraTimePlayers = [];
                        if ($hasExtraTime && !empty($t['ListaSupplementari'])) {
                            $arrLS = explode('%', $t['ListaSupplementari']);
                            $arrVS = explode('%', $t['VotoSupplementari'] ?? '');
                            $rolesS = [2, 3, 4];
                            $rolesLabelS = ['D', 'C', 'A'];
                            for ($s = 0; $s < min(3, count($arrLS)); $s++) {
                                $idSStr = $arrLS[$s] ?? '';
                                $idS = (int)$idSStr;
                                $isOfficeReserve = ($idSStr === '-1');
                                $isAbsent = ($idSStr === '0' || $idSStr === '');
                                $pInfoS = $playerMap[$idS] ?? ['name' => ($isOfficeReserve ? "Riserva d'Ufficio" : "Calciatore $idS"), 'code' => $idS, 'role' => $rolesS[$s], 'club' => ''];
                                $vS = $arrVS[$s] ?? '-';
                                $vSNum = (float)str_replace(',', '.', $vS);
                                $isSuccess = (!empty($vS) && $vS !== '-' && $vSNum >= 6.0);
                                $extraTimePlayers[] = [
                                    'id' => $pInfoS['code'] ?: $idS,
                                    'code' => $pInfoS['code'] ?: $idS,
                                    'localId' => $idS,
                                    'name' => $isAbsent ? '-----------------' : ($isOfficeReserve ? "Riserva d'Ufficio" : $pInfoS['name']),
                                    'club' => $pInfoS['club'] ?? '',
                                    'role' => $rolesS[$s],
                                    'roleLabel' => $isOfficeReserve ? $rolesLabelS[$s] . 'U' : $rolesLabelS[$s],
                                    'rawVote' => $vS,
                                    'isSuccess' => $isSuccess,
                                    'isOfficeReserve' => $isOfficeReserve,
                                    'isAbsent' => $isAbsent
                                ];
                            }
                        }

                        $hasPenalties = (!empty($t['Rigori']) && (int)$t['Rigori'] === 1 && ($t['GolRigori'] ?? '') !== 'x');
                        $penaltyPlayers = [];
                        if ($hasPenalties && !empty($t['ListaRigori'])) {
                            $arrLR = explode('%', $t['ListaRigori']);
                            $arrVR = explode('%', $t['VotoRigori'] ?? '');
                            for ($r = 0; $r < count($arrLR); $r++) {
                                $valLR = $arrLR[$r] ?? '';
                                if ($valLR === '' && $valLR !== '0') continue;
                                $idR = (int)$valLR;
                                $isOfficeReserve = ($valLR === '-1');
                                $isAbsent = ($valLR === '0');
                                $pInfoR = $playerMap[$idR] ?? ['name' => ($isOfficeReserve ? "Riserva d'Ufficio" : "Calciatore $idR"), 'code' => $idR, 'role' => 0, 'club' => ''];
                                $vR = $arrVR[$r] ?? '-';
                                $vRNum = (float)str_replace(',', '.', $vR);
                                $isScored = (!empty($vR) && $vR !== '-' && $vRNum >= 6.0);
                                $penaltyPlayers[] = [
                                    'id' => $pInfoR['code'] ?: $idR,
                                    'code' => $pInfoR['code'] ?: $idR,
                                    'localId' => $idR,
                                    'name' => $isAbsent ? '-----------------' : ($isOfficeReserve ? "Riserva d'Ufficio" : $pInfoR['name']),
                                    'club' => $pInfoR['club'] ?? '',
                                    'role' => (int)($pInfoR['role'] ?? 0),
                                    'rawVote' => $vR,
                                    'isScored' => $isScored,
                                    'isOfficeReserve' => $isOfficeReserve,
                                    'isAbsent' => $isAbsent
                                ];
                            }
                        }

                        $tabellini[] = [
                            'matchId' => $incId,
                            'teamId' => $tId,
                            'teamName' => $teams[$tId] ?? "Squadra $tId",
                            'parziale' => (float)($t['ParzialeSquadra'] ?? 0),
                            'fattoreCampo' => (float)($t['FattoreCampo'] ?? 0),
                            'modDifesa' => (float)($t['ModDifesa'] ?? 0),
                            'modCentrocampo' => (float)($t['ModCentrocampo'] ?? 0),
                            'modAttacco' => (float)($t['ModAttacco'] ?? 0),
                            'modPortiere' => (float)($t['ModPortiere'] ?? 0),
                            'totale' => (float)($t['TotaleSquadra'] ?? 0),
                            'gol' => (int)($t['Gol'] ?? 0),
                            'hasExtraTime' => $hasExtraTime,
                            'extraTimePlayers' => $extraTimePlayers,
                            'extraTimePartial' => (float)str_replace(',', '.', $t['ParzialeSquadraSupplementari'] ?? 0),
                            'extraTimeHomeAdvantage' => (float)str_replace(',', '.', $t['FattoreCampoSupplementari'] ?? 0),
                            'extraTimeGoals' => (int)($t['GolSupplementari'] ?? 0),
                            'hasPenalties' => $hasPenalties,
                            'penaltyPlayers' => $penaltyPlayers,
                            'penaltyGoals' => (int)($t['GolRigori'] ?? 0),
                            'players' => $players
                        ];
                    }
                }

                $out = [
                    'season' => $seasonId,
                    'matchday' => $day,
                    'day' => $day,
                    'requestedDay' => $origDay,
                    'availableDays' => $availableDays,
                    'competitions' => $competitionsList,
                    'divisions' => $divisionsList,
                    'matches' => $matches,
                    'tabellini' => $tabellini
                ];
                if (!$isCli) echo json_encode($out, JSON_UNESCAPED_UNICODE);
                return $out;
            } catch (Exception $e) {
                if (!$isCli) {
                    http_response_code(500);
                    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

        case 'classifica_stagione':
            $seasonId = isset($_GET['season']) ? (int)$_GET['season'] : (isset($_GET['stagione']) ? (int)$_GET['stagione'] : 0);
            if ($seasonId <= 0) {
                $seasons = getStagioniDisponibili($sqliteBase);
                $seasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            }

            $cacheFile = "$sqliteBase/stagione_$seasonId/classifica.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase, $seasonId) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $out = buildHistoricalStandings($sqliteBase, $seasonId);
            if (!$out) {
                if (!$isCli) {
                    http_response_code(404);
                    echo json_encode(['error' => "Stagione $seasonId non trovata"], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

            @fcm_write_file_atomic($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            if (!$isCli) echo json_encode($out, JSON_UNESCAPED_UNICODE);
            return $out;

        case 'calendario_stagione':
            $seasonId = isset($_GET['season']) ? (int)$_GET['season'] : (isset($_GET['stagione']) ? (int)$_GET['stagione'] : 0);
            if ($seasonId <= 0) {
                $seasons = getStagioniDisponibili($sqliteBase);
                $seasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            }

            $cacheFile = "$sqliteBase/stagione_$seasonId/calendario.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase, $seasonId) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            try {
                $out = buildHistoricalCalendar($sqliteBase, $seasonId);
            } catch (Exception $e) {
                if (!$isCli) {
                    http_response_code(500);
                    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

            if (!$out) {
                if (!$isCli) {
                    http_response_code(404);
                    echo json_encode(['error' => "Stagione $seasonId non trovata"], JSON_UNESCAPED_UNICODE);
                }
                return null;
            }

            @fcm_write_file_atomic($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE));
            if (!$isCli) echo json_encode($out, JSON_UNESCAPED_UNICODE);
            return $out;

        case 'classifica_perpetua':
            $cacheFile = "$sqliteBase/classifica_perpetua.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $out = buildClassificaPerpetua($sqliteBase);
            @fcm_write_file_atomic($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            if (!$isCli) echo json_encode($out, JSON_UNESCAPED_UNICODE);
            return $out;

        case 'statistiche_storiche':
            $cacheFile = "$sqliteBase/statistiche_storiche.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $byCode = [];
            $byName = [];
            $players = [];
            $norm = fn($n) => strtoupper(preg_replace('/\s+/', ' ', trim($n ?? '')));
            $ruoliMap = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];

            foreach ($seasons as $i => $s) {
                if (!$s['seriea_db']) continue;
                $era = ($s['id'] <= 4) ? 'old' : 'new';
                $numStagione = (int)$s['id'];

                try {
                    $db = new PDO("sqlite:" . $s['lega_db']);
                    $db->exec("ATTACH DATABASE '" . $s['seriea_db'] . "' AS seriea");

                    $tesseratiByPlayer = [];
                    try {
                        $tStmt = $db->query("
                            SELECT t.IDGiocatore, t.IDSquadra, f.Nome as fNome, t.CostoAcq, t.AnnoDiContratto, t.Venduto, t.InizioInfortunio, t.ID
                            FROM Tesserato t
                            JOIN Fantasquadra f ON f.ID = t.IDSquadra
                            ORDER BY t.IDGiocatore, t.ID ASC
                        ");
                        while ($tr = $tStmt->fetch(PDO::FETCH_ASSOC)) {
                            $pid = (int)$tr['IDGiocatore'];
                            $tesseratiByPlayer[$pid][] = $tr;
                        }
                    } catch (Exception $e) {}

                    $playerRealTeams = [];
                    try {
                        $realTeamRows = $db->query("
                            SELECT gi.IDGiocatore, sq.Nome, MIN(gi.Giornata) as minG
                            FROM seriea.GiocaIn gi
                            JOIN seriea.SquadraDiA sq ON gi.IDSquadra = sq.ID
                            WHERE sq.Nome NOT LIKE '{%' AND sq.Nome != ''
                            GROUP BY gi.IDGiocatore, sq.Nome
                            ORDER BY gi.IDGiocatore, minG ASC
                        ")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($realTeamRows as $rtr) {
                            $playerRealTeams[(int)$rtr['IDGiocatore']][] = trim($rtr['Nome']);
                        }
                    } catch (Exception $e) {}

                    $playerFallbackStats = [];
                    try {
                        $fbStatRows = $db->query("
                            SELECT 
                                gi.IDGiocatore,
                                COUNT(CASE WHEN p.Voto1 > 0 THEN 1 END) as pr,
                                ROUND(AVG(CASE WHEN p.Voto1 > 0 THEN p.Voto1 END), 2) as mv,
                                ROUND(AVG(CASE WHEN p.Voto1 > 0 THEN (p.Voto1 + p.GolFatti1 * 3 + p.Assist * 1 - p.Amm * 0.5 - p.Esp * 1 - p.Autogol1 * 2) END), 2) as fm,
                                SUM(p.GolFatti1) as goals,
                                SUM(p.Assist) as assist,
                                SUM(p.Amm) as amm,
                                SUM(p.Esp) as esp
                            FROM seriea.GiocaIn gi
                            JOIN seriea.Punteggio p ON gi.IDPunteggio = p.ID
                            GROUP BY gi.IDGiocatore
                            HAVING pr > 0
                        ")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($fbStatRows as $fsr) {
                            $playerFallbackStats[(int)$fsr['IDGiocatore']] = $fsr;
                        }
                    } catch (Exception $e) {}

                    $stmt = $db->query("
                        SELECT 
                            g.ID as id,
                            g.CodiceGazza as codice,
                            g.Nome as nome,
                            g.Ruolo as ruolo,
                            COALESCE(NULLIF(st.CostoGazza, 0), NULLIF(g.CostoGazza, 0), 0) as quotazione,
                            g.LuogoDiNascita as luogo,
                            g.DataDiNascita as nascita,
                            g.Altezza as altezza,
                            g.Peso as peso,
                            g.Extracom as extracom,
                            st.Squadra as squadra,
                            COALESCE(st.Presenze, 0) as pres,
                            COALESCE(st.Affidabilita, 0) as aff,
                            COALESCE(st.GolFatti, 0) as gol,
                            COALESCE(st.GolFattiSuRigore, 0) as golRig,
                            COALESCE(st.GolSubiti, 0) as gs,
                            COALESCE(st.GolSubitiSuRigore, 0) as gsRig,
                            COALESCE(st.Assist, 0) as ass,
                            COALESCE(st.Autogol, 0) as ag,
                            COALESCE(st.RigSba, 0) as rs,
                            COALESCE(st.RigPar, 0) as rp,
                            COALESCE(st.Amm, 0) as amm,
                            COALESCE(st.Esp, 0) as esp,
                            COALESCE(st.MVT, 0) as mv,
                            COALESCE(st.MVC, 0) as mvc,
                            COALESCE(st.MVF, 0) as mvf,
                            COALESCE(st.DevStMV, 0) as devMv,
                            COALESCE(st.RendimMV, 0) as rendimMv,
                            COALESCE(st.DeltaMV, 0) as deltaMv,
                            COALESCE(st.MVAnd, 0) as mvAnd,
                            COALESCE(st.FMT, 0) as fm,
                            COALESCE(st.FMC, 0) as fmc,
                            COALESCE(st.FMF, 0) as fmf,
                            COALESCE(st.DevStFM, 0) as devFm,
                            COALESCE(st.RendimFM, 0) as rendimFm,
                            COALESCE(st.DeltaFM, 0) as deltaFm,
                            COALESCE(st.FMAnd, 0) as fmAnd
                        FROM seriea.GiocatoreA g
                        LEFT JOIN seriea.Statistiche st ON g.ID = st.ID
                        WHERE (st.ID IS NOT NULL AND st.Squadra NOT LIKE '{%}')
                           OR (g.ID IN (SELECT IDGiocatore FROM Tesserato))
                    ");

                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $pNome = $row['nome'];
                        $ruoloLettera = $ruoliMap[(int)$row['ruolo']] ?? 'C';
                        $pCode = $row['codice'] ? (int)$row['codice'] : null;
                        $codeKey = $pCode ? "$era:$pCode" : null;
                        $nameKey = $norm($pNome);

                        $pId = (int)$row['id'];
                        $sqOrig = trim($row['squadra'] ?? '');
                        if (empty($sqOrig) || str_starts_with($sqOrig, '{')) {
                            if (!empty($playerRealTeams[$pId])) {
                                $sqOrig = implode(', ', $playerRealTeams[$pId]);
                            }
                        }
                        $row['squadra'] = $sqOrig;

                        $tList = $tesseratiByPlayer[$pId] ?? [];

                        $fantaEntries = [];
                        $activeTeams = [];
                        $allTeamNames = [];
                        $firstCosto = null;
                        $firstContratto = null;

                        foreach ($tList as $tr) {
                            $fn = trim($tr['fNome'] ?? '');
                            if (!$fn) continue;
                            $isVenduto = ((int)($tr['Venduto'] ?? 0) === 1);
                            $cCost = (int)($tr['CostoAcq'] ?? 0);
                            $cContr = (int)($tr['AnnoDiContratto'] ?? 1);
                            if ($firstCosto === null) {
                                $firstCosto = $cCost;
                                $firstContratto = $cContr;
                            }
                            $fantaEntries[] = [
                                'nome' => $fn,
                                'costo' => $cCost,
                                'contratto' => $cContr,
                                'venduto' => $isVenduto ? 1 : 0
                            ];
                            if (!$isVenduto) {
                                $activeTeams[] = $fn;
                            }
                            $allTeamNames[] = $fn;
                        }

                        $uniqueAllTeams = array_values(array_unique($allTeamNames));
                        $uniqueActiveTeams = array_values(array_unique($activeTeams));
                        $isSvincolatoFineStagione = (count($tList) > 0 && count($activeTeams) === 0);
                        $fantaStr = '-';
                        if (count($activeTeams) > 0) {
                            $fantaStr = implode(', ', $uniqueActiveTeams);
                        } elseif (count($allTeamNames) > 0) {
                            $fantaStr = implode(', ', $uniqueAllTeams);
                        }

                        $a = null;
                        if ($codeKey && isset($byCode[$codeKey])) {
                            $a = &$byCode[$codeKey];
                        }
                        if (!$a) {
                            $parts = explode(' ', $nameKey);
                            $surname = $parts[0];
                            if (isset($byName[$surname])) {
                                $candidates = [];
                                foreach ($byName[$surname] as $c) {
                                    if ($c['rec']['lastSeason'] !== $i && ($c['name'] === $nameKey || str_starts_with($c['name'], $nameKey . ' ') || str_starts_with($nameKey, $c['name'] . ' '))) {
                                        $candidates[] = $c['rec_idx'];
                                    }
                                }
                                $unique = array_unique($candidates);
                                if (count($unique) === 1) {
                                    $a = &$players[$unique[0]];
                                }
                            }
                        }

                        if (!$a) {
                            $idx = count($players);
                            $players[$idx] = [
                                'idx' => $idx,
                                'nome' => $pNome,
                                'ruolo' => $ruoloLettera,
                                'squadra' => $row['squadra'] ?? '',
                                'fantasquadra' => $fantaStr !== '-' ? $fantaStr : null,
                                'codice' => $pCode,
                                'codici' => $pCode ? [$pCode] : [],
                                'quotazione' => (int)($row['quotazione'] ?? 0),
                                'nascita' => $row['nascita'] ?? '',
                                'luogo' => $row['luogo'] ?? '',
                                'altezza' => (int)($row['altezza'] ?? 0),
                                'peso' => (int)($row['peso'] ?? 0),
                                'extracom' => (int)($row['extracom'] ?? 0),
                                'stagioni' => 0,
                                'pres' => 0,
                                'sumMv' => 0.0,
                                'sumMvc' => 0.0,
                                'sumMvf' => 0.0,
                                'sumFm' => 0.0,
                                'sumFmc' => 0.0,
                                'sumFmf' => 0.0,
                                'gol' => 0,
                                'golRig' => 0,
                                'ass' => 0,
                                'gs' => 0,
                                'gsRig' => 0,
                                'rp' => 0,
                                'rs' => 0,
                                'ag' => 0,
                                'amm' => 0,
                                'esp' => 0,
                                'lastSeason' => -1,
                                'dettaglio' => []
                            ];
                            $a = &$players[$idx];
                        } else {
                            if ($pCode && !in_array($pCode, $a['codici'])) {
                                $a['codici'][] = $pCode;
                            }
                            if ($pCode && $i === 0) {
                                $a['codice'] = $pCode;
                            }
                            if ($i === 0) {
                                $a['squadra'] = $row['squadra'] ?? $a['squadra'];
                                if ($fantaStr !== '-') {
                                    $a['fantasquadra'] = $fantaStr;
                                }
                                $a['quotazione'] = (int)($row['quotazione'] ?? $a['quotazione']);
                            }
                            if (!empty($row['nascita']) && empty($a['nascita'])) $a['nascita'] = $row['nascita'];
                            if (!empty($row['luogo']) && empty($a['luogo'])) $a['luogo'] = $row['luogo'];
                            if (!empty($row['altezza']) && empty($a['altezza'])) $a['altezza'] = (int)$row['altezza'];
                            if (!empty($row['peso']) && empty($a['peso'])) $a['peso'] = (int)$row['peso'];
                        }

                        $pres = (int)$row['pres'];
                        $mv = (float)($row['mv'] ?? 0);
                        $mvc = (float)($row['mvc'] ?? 0);
                        $mvf = (float)($row['mvf'] ?? 0);
                        $fm = (float)($row['fm'] ?? 0);
                        $fmc = (float)($row['fmc'] ?? 0);
                        $fmf = (float)($row['fmf'] ?? 0);
                        $gol = (int)($row['gol'] ?? 0);
                        $golRig = (int)($row['golRig'] ?? 0);
                        $ass = (int)($row['ass'] ?? 0);
                        $gs = (int)($row['gs'] ?? 0);
                        $gsRig = (int)($row['gsRig'] ?? 0);
                        $rp = (int)($row['rp'] ?? 0);
                        $rs = (int)($row['rs'] ?? 0);
                        $ag = (int)($row['ag'] ?? 0);
                        $amm = (int)($row['amm'] ?? 0);
                        $esp = (int)($row['esp'] ?? 0);

                        if ($pres === 0 && isset($playerFallbackStats[$pId])) {
                            $fb = $playerFallbackStats[$pId];
                            $pres = (int)$fb['pr'];
                            $mv = (float)$fb['mv'];
                            $mvc = $mv;
                            $mvf = $mv;
                            $fm = (float)$fb['fm'];
                            $fmc = $fm;
                            $fmf = $fm;
                            $gol = (int)$fb['goals'];
                            $ass = (int)$fb['assist'];
                            $amm = (int)$fb['amm'];
                            $esp = (int)$fb['esp'];
                        }

                        $a['dettaglio'][] = [
                            'stagione' => $numStagione,
                            'anni' => $s['anni_stagione'],
                            'id' => (int)$row['id'],
                            'codice' => $pCode,
                            'squadra' => $row['squadra'] ?? '',
                            'fantasquadra' => $fantaStr,
                            'fantasquadre' => $uniqueAllTeams,
                            'fantasquadreDettaglio' => $fantaEntries,
                            'svincolatoFineStagione' => $isSvincolatoFineStagione,
                            'costo' => $firstCosto,
                            'contratto' => $firstContratto,
                            'quotazione' => (int)($row['quotazione'] ?? 0),
                            'ruolo' => $ruoloLettera,
                            'pres' => $pres,
                            'mv' => $mv,
                            'mvc' => $mvc,
                            'mvf' => $mvf,
                            'devMv' => (float)($row['devMv'] ?? 0),
                            'rendimMv' => (float)($row['rendimMv'] ?? 0),
                            'deltaMv' => (float)($row['deltaMv'] ?? 0),
                            'mvAnd' => (float)($row['mvAnd'] ?? 0),
                            'fm' => $fm,
                            'fmc' => $fmc,
                            'fmf' => $fmf,
                            'devFm' => (float)($row['devFm'] ?? 0),
                            'rendimFm' => (float)($row['rendimFm'] ?? 0),
                            'deltaFm' => (float)($row['deltaFm'] ?? 0),
                            'fmAnd' => (float)($row['fmAnd'] ?? 0),
                            'aff' => (int)($row['aff'] ?? 0),
                            'gol' => $gol,
                            'golRig' => $golRig,
                            'ass' => $ass,
                            'gs' => $gs,
                            'gsRig' => $gsRig,
                            'rp' => $rp,
                            'rs' => $rs,
                            'ag' => $ag,
                            'amm' => $amm,
                            'esp' => $esp
                        ];

                        if ($codeKey) $byCode[$codeKey] = &$a;
                        $parts = explode(' ', $nameKey);
                        $surname = $parts[0];
                        if (!isset($byName[$surname])) $byName[$surname] = [];
                        $found = false;
                        foreach ($byName[$surname] as $it) {
                            if ($it['rec_idx'] === $a['idx'] && $it['name'] === $nameKey) {
                                $found = true;
                                break;
                            }
                        }
                        if (!$found) {
                            $byName[$surname][] = ['name' => $nameKey, 'rec_idx' => $a['idx'], 'rec' => &$a];
                        }

                        $a['lastSeason'] = $i;
                        $a['stagioni']++;
                        $a['pres'] += $pres;
                        $a['sumMv'] += $mv * $pres;
                        $a['sumMvc'] += $mvc * $pres;
                        $a['sumMvf'] += $mvf * $pres;
                        $a['sumFm'] += $fm * $pres;
                        $a['sumFmc'] += $fmc * $pres;
                        $a['sumFmf'] += $fmf * $pres;
                        $a['gol'] += $gol;
                        $a['golRig'] += $golRig;
                        $a['ass'] += $ass;
                        $a['gs'] += $gs;
                        $a['gsRig'] += $gsRig;
                        $a['rp'] += $rp;
                        $a['rs'] += $rs;
                        $a['ag'] += $ag;
                        $a['amm'] += $amm;
                        $a['esp'] += $esp;

                        unset($a);
                    }
                } catch (Exception $e) {}
            }

            foreach ($players as &$p) {
                $p['mv'] = $p['pres'] > 0 ? round($p['sumMv'] / $p['pres'], 3) : 0;
                $p['mvc'] = $p['pres'] > 0 ? round($p['sumMvc'] / $p['pres'], 3) : 0;
                $p['mvf'] = $p['pres'] > 0 ? round($p['sumMvf'] / $p['pres'], 3) : 0;
                $p['fm'] = $p['pres'] > 0 ? round($p['sumFm'] / $p['pres'], 3) : 0;
                $p['fmc'] = $p['pres'] > 0 ? round($p['sumFmc'] / $p['pres'], 3) : 0;
                $p['fmf'] = $p['pres'] > 0 ? round($p['sumFmf'] / $p['pres'], 3) : 0;
                unset($p['lastSeason'], $p['sumMv'], $p['sumMvc'], $p['sumMvf'], $p['sumFm'], $p['sumFmc'], $p['sumFmf']);
            }
            unset($p);

            $last = $seasons[0] ?? null;
            $first = $seasons[count($seasons) - 1] ?? null;
            $loaded = count($seasons);
            $subtitle = count($players) . " giocatori in $loaded stagioni" . ($first && $last ? " ({$first['anni_stagione']} - {$last['anni_stagione']})" : '');

            $result = [
                'subtitle' => $subtitle,
                'count' => count($players),
                'stagioni_count' => $loaded,
                'players' => $players
            ];

            $jsonOutput = json_encode($result, JSON_UNESCAPED_UNICODE);
            fcm_write_file_atomic($cacheFile, $jsonOutput);
            if (!$isCli) echo $jsonOutput;
            return $result;

        case 'fantamister_storico':
            $cacheFile = "$sqliteBase/fantamister_storico.json";
            $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
            if (!$forceRefresh && isCacheValid($cacheFile, $sqliteBase) && !$isCli) {
                serveCacheFile($cacheFile);
            }

            $seasons = getStagioniDisponibili($sqliteBase);
            $latestSeasonId = !empty($seasons) ? (int)$seasons[0]['id'] : 0;
            $fData = getFranchiseResolver($sqliteBase, $latestSeasonId);
            $fResolver = $fData['resolver'];
            $fNames = $fData['alboTeamNames'];
            $alboTeamsById = [];
            foreach ($fData['alboTeams'] as $at) {
                $alboTeamsById[(int)$at['id']] = $at;
            }

            $cData = getCompetitionResolver($sqliteBase, $latestSeasonId);
            $cResolver = $cData['resolver'];

            $allowedModules = [
                [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1]
            ];
            $allowedModuleStrings = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
            $ruoliMap = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];

            $seasonYearsMap = [];
            foreach ($seasons as $s) {
                $seasonYearsMap[(int)$s['id']] = $s['anni_stagione'] ?? $s['anno'];
            }

            // Pre-scansione Serie A per codice giocatore (ultima stagione in A) e tutti i club
            $playerCodes = [];
            $playerAllClubs = [];

            foreach ($seasons as $s) {
                $sId = (int)$s['id'];
                $serieaDb = $s['seriea_db'] ?? '';
                if ($serieaDb && file_exists($serieaDb)) {
                    $saDb = new PDO("sqlite:$serieaDb");
                    $rows = $saDb->query("SELECT g.Nome, g.CodiceGazza, st.Squadra as club FROM GiocatoreA g LEFT JOIN Statistiche st ON st.ID = g.ID")->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as $r) {
                        $name = trim($r['Nome']);
                        $code = trim($r['CodiceGazza'] ?? '');
                        $club = trim($r['club'] ?? '');
                        if ($code && (!isset($playerCodes[$name]) || $sId > ($playerCodes[$name]['latestSeason'] ?? 0))) {
                            $playerCodes[$name] = [
                                'code' => $code,
                                'latestSeason' => $sId
                            ];
                        }
                        if ($club) {
                            $playerAllClubs[$name][$club] = true;
                        }
                    }
                }
            }

            // Rileva competizioni con partite giocate
            $compMatchesCount = [];
            foreach ($seasons as $s) {
                $sId = $s['id'];
                $legaDb = $s['lega_db'];
                if (!file_exists($legaDb)) continue;
                $db = new PDO("sqlite:$legaDb");
                $gironi = [];
                foreach ($db->query("SELECT ID, IDCompetizione FROM Girone") as $g) {
                    $gironi[(int)$g['ID']] = (int)$g['IDCompetizione'];
                }
                foreach ($db->query("SELECT ID, IDGirone, Giocato FROM Incontro WHERE IDTipo != 2") as $inc) {
                    if ($inc['Giocato']) {
                        $localComp = $gironi[(int)$inc['IDGirone']] ?? 0;
                        $mCompId = $cResolver($sId, $localComp);
                        $compMatchesCount[$mCompId] = ($compMatchesCount[$mCompId] ?? 0) + 1;
                    }
                }
            }

            $targetComps = [
                0 => 'Tutte le competizioni'
            ];
            foreach ($cData['masterComps'] as $mc) {
                $mcId = (int)$mc['id'];
                if (($compMatchesCount[$mcId] ?? 0) > 0) {
                    $targetComps[$mcId] = $mc['name'];
                }
            }

            $byComp = [];
            foreach ($targetComps as $cId => $cName) {
                $byComp[$cId] = [
                    'id' => $cId,
                    'name' => $cName,
                    'matchesCount' => 0,
                    'allTimeTeams' => [],
                    'topIdeali' => [],
                    'worstScarti' => [],
                    'incompresiAllTime' => [],
                    'allScorers' => [],
                    'momCount' => [],
                    'allFieldedStats' => [],
                    'seasonSummaries' => [],
                    'seasonScorers' => [],
                    'seasonMom' => [],
                    'seasonFielded' => [],
                    'seasonMatches' => [],
                    'modulesOptimalGlobal' => array_fill_keys($allowedModuleStrings, 0),
                    'seasonModulesGlobal' => []
                ];
            }

            foreach ($seasons as $s) {
                $sId = $s['id'];
                $legaDb = $s['lega_db'];
                $serieaDb = $s['seriea_db'];
                if (!file_exists($legaDb)) continue;

                $db = new PDO("sqlite:$legaDb");
                $hasSa = ($serieaDb && file_exists($serieaDb));
                if ($hasSa) {
                    $db->exec("ATTACH DATABASE '$serieaDb' AS sa");
                }

                $playerMap = [];
                if ($hasSa) {
                    $pRows = $db->query("SELECT g.ID, g.Nome, g.Ruolo, g.CodiceGazza, st.Squadra as club FROM sa.GiocatoreA g LEFT JOIN sa.Statistiche st ON st.ID = g.ID")->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($pRows as $pr) {
                        $playerMap[(int)$pr['ID']] = [
                            'name' => $pr['Nome'],
                            'role' => (int)$pr['Ruolo'],
                            'code' => $pr['CodiceGazza'] ?? '',
                            'club' => $pr['club'] ?? ''
                        ];
                    }
                }

                $squadre = [];
                foreach ($db->query("SELECT ID, Nome, Presidente FROM Fantasquadra") as $tRow) {
                    $squadre[(int)$tRow['ID']] = $tRow;
                }

                $gironi = [];
                foreach ($db->query("SELECT ID, IDCompetizione FROM Girone") as $g) {
                    $gironi[(int)$g['ID']] = (int)$g['IDCompetizione'];
                }

                $incStmt = $db->query("SELECT ID, IDGirone, IDCasa, IDFuori, GolCasa, GolFuori, ParzCasa, ParzFuori, GiornataDiA, Giocato FROM Incontro WHERE IDTipo != 2");
                $incontri = [];
                while ($r = $incStmt->fetch(PDO::FETCH_ASSOC)) {
                    if ($r['Giocato']) {
                        $localComp = $gironi[(int)$r['IDGirone']] ?? 0;
                        $mCompId = $cResolver($sId, $localComp);
                        $incontri[(int)$r['ID']] = [
                            'id' => (int)$r['ID'],
                            'mCompId' => $mCompId,
                            'giornata' => (int)$r['GiornataDiA'],
                            'idCasa' => (int)$r['IDCasa'],
                            'idFuori' => (int)$r['IDFuori'],
                            'golCasa' => (int)$r['GolCasa'],
                            'golFuori' => (int)$r['GolFuori'],
                            'parzCasa' => (float)$r['ParzCasa'],
                            'parzFuori' => (float)$r['ParzFuori']
                        ];
                    }
                }

                $tabStmt = $db->query("SELECT IDIncontro, IDSquadra, Lista, Ruolo, Voto, Modif, Tot, ParzialeSquadra, Gol FROM Tabellino");
                $tabelliniByMatch = [];
                while ($t = $tabStmt->fetch(PDO::FETCH_ASSOC)) {
                    $incId = (int)$t['IDIncontro'];
                    if (!isset($incontri[$incId])) continue;
                    $tabelliniByMatch[$incId][] = $t;
                }

                $seasonCumulativeScorers = [];

                foreach ($incontri as $incId => $inc) {
                    $mCompId = $inc['mCompId'];
                    $tabs = $tabelliniByMatch[$incId] ?? [];
                    if (count($tabs) < 2) continue;

                    $activeCompKeys = [0];
                    if (isset($byComp[$mCompId])) {
                        $activeCompKeys[] = $mCompId;
                    }

                    $matchTeamsData = [];

                    foreach ($tabs as $t) {
                        $teamId = (int)$t['IDSquadra'];
                        $localTeam = $squadre[$teamId] ?? ['Nome' => "Squadra $teamId", 'Presidente' => ''];
                        $fId = $fResolver($sId, $teamId, $localTeam['Nome'], $localTeam['Presidente']);
                        $fName = $fNames[$fId] ?? $localTeam['Nome'];

                        $ids = explode('%', $t['Lista'] ?? '');
                        $roles = explode('%', $t['Ruolo'] ?? '');
                        $voti = explode('%', $t['Voto'] ?? '');
                        $modifs = explode('%', $t['Modif'] ?? '');
                        $tots = explode('%', $t['Tot'] ?? '');

                        $starters = [];
                        $unstarted = [];
                        $validByRole = [1 => [], 2 => [], 3 => [], 4 => []];
                        $votiCount = 0;

                        $totalPlayers = count($ids);
                        for ($j = 0; $j < $totalPlayers; $j++) {
                            $pIdStr = $ids[$j] ?? '';
                            if ($j > 10 && (!$pIdStr || $pIdStr === '0')) continue;

                            $pRoleRaw = (int)($roles[$j] ?? 0);
                            $baseRole = 0;
                            if ($pRoleRaw >= 1 && $pRoleRaw <= 4) $baseRole = $pRoleRaw;
                            elseif ($pRoleRaw >= 5 && $pRoleRaw <= 8) $baseRole = $pRoleRaw - 4;
                            elseif ($pRoleRaw >= -4 && $pRoleRaw <= -1) $baseRole = abs($pRoleRaw);
                            elseif ($pRoleRaw >= -8 && $pRoleRaw <= -5) $baseRole = abs($pRoleRaw) - 4;

                            $isStarter = ($j <= 10);
                            $rawVote = trim(str_replace(',', '.', $voti[$j] ?? ''));
                            $totVote = trim(str_replace(',', '.', $tots[$j] ?? ''));
                            $modVote = (float)str_replace(',', '.', $modifs[$j] ?? '0');

                            $isValid = ($pIdStr !== '0' && $pIdStr !== '-1' && $totVote !== '' && $totVote !== 'sv/ng' && $totVote !== '-' && is_numeric($totVote));
                            $totNum = $isValid ? (float)$totVote : 0.0;
                            $rawNum = ($isValid && is_numeric($rawVote)) ? (float)$rawVote : 0.0;
                            $pId = (int)$pIdStr;

                            $pInfo = $playerMap[$pId] ?? ['name' => "Giocatore #$pId", 'role' => $baseRole, 'club' => '', 'code' => ''];
                            $pCode = $pInfo['code'] ?: ($playerCodes[$pInfo['name']]['code'] ?? '');

                            $pObj = [
                                'id' => $pId,
                                'name' => $pInfo['name'],
                                'club' => $pInfo['club'] ?? '',
                                'code' => $pCode,
                                'role' => $baseRole,
                                'isStarter' => $isStarter,
                                'totNum' => $totNum,
                                'rawNum' => $rawNum,
                                'mod' => $modVote,
                                'isValid' => $isValid
                            ];

                            if ($isValid) $votiCount++;

                            if ($isStarter) {
                                $starters[] = $pObj;
                            } else if ($isValid && $pId > 0) {
                                $unstarted[] = $pObj;
                            }

                            if ($isValid && $baseRole >= 1 && $baseRole <= 4) {
                                $validByRole[$baseRole][] = $pObj;
                            }
                        }

                        $realPartial = isset($t['ParzialeSquadra']) && is_numeric($t['ParzialeSquadra'])
                            ? (float)$t['ParzialeSquadra']
                            : array_sum(array_column($starters, 'totNum'));

                        for ($r = 1; $r <= 4; $r++) {
                            usort($validByRole[$r], fn($a, $b) => ($b['totNum'] <=> $a['totNum']) ?: ($b['rawNum'] <=> $a['rawNum']));
                        }

                        $bestMax = -1.0;
                        $bestModStr = '3-4-3';
                        foreach ($allowedModules as [$reqD, $reqC, $reqA]) {
                            if (count($validByRole[1]) < 1 || count($validByRole[2]) < $reqD || count($validByRole[3]) < $reqC || count($validByRole[4]) < $reqA) continue;
                            $lineup = array_merge(
                                array_slice($validByRole[1], 0, 1),
                                array_slice($validByRole[2], 0, $reqD),
                                array_slice($validByRole[3], 0, $reqC),
                                array_slice($validByRole[4], 0, $reqA)
                            );
                            $sum = round(array_sum(array_column($lineup, 'totNum')), 2);
                            if ($sum > $bestMax) {
                                $bestMax = $sum;
                                $bestModStr = "$reqD-$reqC-$reqA";
                            }
                        }
                        if ($bestMax < $realPartial || $bestMax < 0) {
                            $bestMax = $realPartial;
                        }
                        $scarto = max(0.0, round($bestMax - $realPartial, 2));
                        $excessVotes = max(0, $votiCount - 11);
                        $scSuVoti = $excessVotes > 0 ? ($scarto / $excessVotes) : 0.0;

                        $matchTeamsData[$teamId] = [
                            'teamId' => $teamId,
                            'franchiseId' => $fId,
                            'franchiseName' => $fName,
                            'idAttuale' => (int)($alboTeamsById[$fId]['idAttuale'] ?? 0),
                            'starters' => $starters,
                            'unstarted' => $unstarted,
                            'realPartial' => $realPartial,
                            'bestMax' => $bestMax,
                            'bestModStr' => $bestModStr,
                            'scarto' => $scarto,
                            'votiCount' => $votiCount,
                            'excessVotes' => $excessVotes,
                            'scSuVoti' => $scSuVoti,
                            'goals' => (int)($t['Gol'] ?? 0)
                        ];
                    }

                    // Elabora match per ciascuna competizione attiva
                    foreach ($activeCompKeys as $cKey) {
                        $compRef = &$byComp[$cKey];
                        $compRef['matchesCount']++;

                        // 1. Man of the Match
                        $team1 = array_values($matchTeamsData)[0] ?? null;
                        $team2 = array_values($matchTeamsData)[1] ?? null;
                        if ($team1 && $team2) {
                            $allMatchStarters = [];
                            foreach ($team1['starters'] as $p) {
                                if ($p['isValid']) {
                                    $allMatchStarters[] = array_merge($p, [
                                        'isWinningTeam' => $team1['goals'] > $team2['goals'],
                                        'franchiseId' => $team1['franchiseId'],
                                        'franchiseName' => $team1['franchiseName']
                                    ]);
                                }
                            }
                            foreach ($team2['starters'] as $p) {
                                if ($p['isValid']) {
                                    $allMatchStarters[] = array_merge($p, [
                                        'isWinningTeam' => $team2['goals'] > $team1['goals'],
                                        'franchiseId' => $team2['franchiseId'],
                                        'franchiseName' => $team2['franchiseName']
                                    ]);
                                }
                            }

                            if (!empty($allMatchStarters)) {
                                usort($allMatchStarters, function($a, $b) {
                                    if ($b['totNum'] != $a['totNum']) return ($b['totNum'] > $a['totNum']) ? 1 : -1;
                                    if ($a['isWinningTeam'] != $b['isWinningTeam']) return $a['isWinningTeam'] ? -1 : 1;
                                    if ($b['rawNum'] != $a['rawNum']) return ($b['rawNum'] > $a['rawNum']) ? 1 : -1;
                                    $roleOrder = [2 => 1, 3 => 2, 4 => 3, 1 => 4];
                                    return ($roleOrder[$a['role']] ?? 5) <=> ($roleOrder[$b['role']] ?? 5);
                                });
                                $mom = $allMatchStarters[0];
                                $momKey = $mom['name'];
                                $pCode = $mom['code'] ?: ($playerCodes[$momKey]['code'] ?? '');

                                if (!isset($compRef['momCount'][$momKey])) {
                                    $compRef['momCount'][$momKey] = [
                                        'name' => $mom['name'],
                                        'role' => $ruoliMap[$mom['role']] ?? 'C',
                                        'club' => $mom['club'],
                                        'code' => $pCode,
                                        'teamName' => $mom['franchiseName'],
                                        'fantasquadre' => [],
                                        'count' => 0
                                    ];
                                }
                                $compRef['momCount'][$momKey]['count']++;
                                $compRef['momCount'][$momKey]['fantasquadre'][$mom['franchiseName']] = true;

                                if (!isset($compRef['seasonMom'][$sId][$momKey])) {
                                    $compRef['seasonMom'][$sId][$momKey] = [
                                        'name' => $mom['name'],
                                        'role' => $ruoliMap[$mom['role']] ?? 'C',
                                        'club' => $mom['club'],
                                        'code' => $pCode,
                                        'teamName' => $mom['franchiseName'],
                                        'fantasquadre' => [],
                                        'count' => 0
                                    ];
                                }
                                $compRef['seasonMom'][$sId][$momKey]['count']++;
                                $compRef['seasonMom'][$sId][$momKey]['fantasquadre'][$mom['franchiseName']] = true;
                            }

                            $compRef['seasonMatches'][$sId][] = [
                                't1FId' => $team1['franchiseId'],
                                't1P' => $team1['realPartial'],
                                't2FId' => $team2['franchiseId'],
                                't2P' => $team2['realPartial']
                            ];
                        }

                        // 2. Fantamarcatori
                        foreach ($matchTeamsData as $mtd) {
                            $fId = $mtd['franchiseId'];
                            $fName = $mtd['franchiseName'];
                            $goals = $mtd['goals'];

                            $bMod = $mtd['bestModStr'];
                            if (isset($compRef['modulesOptimalGlobal'][$bMod])) {
                                $compRef['modulesOptimalGlobal'][$bMod]++;
                            }
                            if (!isset($compRef['seasonModulesGlobal'][$sId][$bMod])) {
                                $compRef['seasonModulesGlobal'][$sId][$bMod] = 0;
                            }
                            $compRef['seasonModulesGlobal'][$sId][$bMod]++;

                            if ($goals > 0 && !empty($mtd['starters'])) {
                                $candidates = [];
                                foreach ($mtd['starters'] as $idx => $stP) {
                                    if ($stP['isValid']) {
                                        $prevG = $seasonCumulativeScorers[$cKey][$fId][$stP['name']] ?? 0;
                                        $candidates[] = [
                                            'name' => $stP['name'],
                                            'role' => $stP['role'],
                                            'club' => $stP['club'],
                                            'code' => $stP['code'],
                                            'currentTot' => $stP['totNum'],
                                            'rawVote' => $stP['rawNum'],
                                            'originalIndex' => $idx,
                                            'previousGoals' => $prevG
                                        ];
                                    }
                                }

                                for ($g = 0; $g < $goals && !empty($candidates); $g++) {
                                    usort($candidates, function($a, $b) {
                                        if ($b['currentTot'] != $a['currentTot']) return ($b['currentTot'] > $a['currentTot']) ? 1 : -1;
                                        if ($b['rawVote'] != $a['rawVote']) return ($b['rawVote'] > $a['rawVote']) ? 1 : -1;
                                        $roleOrder = [2 => 1, 3 => 2, 4 => 3, 1 => 4];
                                        $rA = $roleOrder[$a['role']] ?? 5;
                                        $rB = $roleOrder[$b['role']] ?? 5;
                                        if ($rA != $rB) return $rA - $rB;
                                        if ($a['previousGoals'] != $b['previousGoals']) return $a['previousGoals'] - $b['previousGoals'];
                                        return $a['originalIndex'] - $b['originalIndex'];
                                    });
                                    $sc = &$candidates[0];
                                    $scKey = $sc['name'];
                                    $pCode = $sc['code'] ?: ($playerCodes[$scKey]['code'] ?? '');

                                    if (!isset($compRef['allScorers'][$scKey])) {
                                        $compRef['allScorers'][$scKey] = [
                                            'name' => $sc['name'],
                                            'role' => $ruoliMap[$sc['role']] ?? 'A',
                                            'club' => $sc['club'],
                                            'code' => $pCode,
                                            'teamName' => $fName,
                                            'fantasquadre' => [],
                                            'goals' => 0
                                        ];
                                    }
                                    $compRef['allScorers'][$scKey]['goals']++;
                                    $compRef['allScorers'][$scKey]['fantasquadre'][$fName] = true;

                                    if (!isset($compRef['seasonScorers'][$sId][$scKey])) {
                                        $compRef['seasonScorers'][$sId][$scKey] = [
                                            'name' => $sc['name'],
                                            'role' => $ruoliMap[$sc['role']] ?? 'A',
                                            'club' => $sc['club'],
                                            'code' => $pCode,
                                            'teamName' => $fName,
                                            'fantasquadre' => [],
                                            'goals' => 0
                                        ];
                                    }
                                    $compRef['seasonScorers'][$sId][$scKey]['goals']++;
                                    $compRef['seasonScorers'][$sId][$scKey]['fantasquadre'][$fName] = true;

                                    if (!isset($seasonCumulativeScorers[$cKey][$fId][$scKey])) {
                                        $seasonCumulativeScorers[$cKey][$fId][$scKey] = 0;
                                    }
                                    $seasonCumulativeScorers[$cKey][$fId][$scKey]++;

                                    $sc['previousGoals']++;
                                    $sc['currentTot'] -= 3.0;
                                }
                            }

                            // 3. Statistiche Squadra
                            if (!isset($compRef['seasonSummaries'][$sId]['teams'][$fId])) {
                                $compRef['seasonSummaries'][$sId]['teams'][$fId] = [
                                    'franchiseId' => $fId,
                                    'idAttuale' => $mtd['idAttuale'],
                                    'name' => $fName,
                                    'matches' => 0,
                                    'sumScarto' => 0.0,
                                    'sumVoti' => 0,
                                    'excessVotes' => 0,
                                    'scSuVotiSum' => 0.0,
                                    'scartoZero' => 0,
                                    'sumLost' => 0.0,
                                    'sumReal' => 0.0,
                                    'sumIdeal' => 0.0,
                                    'modulesOptimal' => array_fill_keys($allowedModuleStrings, 0)
                                ];
                            }
                            $st = &$compRef['seasonSummaries'][$sId]['teams'][$fId];
                            $st['matches']++;
                            $st['sumScarto'] += $mtd['scarto'];
                            $st['sumVoti'] += $mtd['votiCount'];
                            $st['excessVotes'] += $mtd['excessVotes'];
                            $st['scSuVotiSum'] += $mtd['scSuVoti'];
                            $st['sumLost'] += $mtd['scarto'];
                            $st['sumReal'] += $mtd['realPartial'];
                            $st['sumIdeal'] += $mtd['bestMax'];
                            if ($mtd['scarto'] == 0) $st['scartoZero']++;
                            if (isset($st['modulesOptimal'][$bMod])) {
                                $st['modulesOptimal'][$bMod]++;
                            }

                            // Record Primati
                            $compRef['topIdeali'][] = [
                                'season' => $sId,
                                'seasonYears' => $s['anni_stagione'],
                                'matchday' => $inc['giornata'],
                                'teamId' => $fId,
                                'teamName' => $fName,
                                'idealScore' => $mtd['bestMax'],
                                'realScore' => $mtd['realPartial'],
                                'module' => $mtd['bestModStr']
                            ];

                            if ($mtd['scarto'] > 0) {
                                $compRef['worstScarti'][] = [
                                    'season' => $sId,
                                    'seasonYears' => $s['anni_stagione'],
                                    'matchday' => $inc['giornata'],
                                    'teamId' => $fId,
                                    'teamName' => $fName,
                                    'scarto' => $mtd['scarto'],
                                    'idealScore' => $mtd['bestMax'],
                                    'realScore' => $mtd['realPartial']
                                ];
                            }

                            // 4. Incompresi
                            foreach ($mtd['unstarted'] as $unP) {
                                $uKey = $unP['name'];
                                $pCode = $unP['code'] ?: ($playerCodes[$uKey]['code'] ?? '');
                                if (!isset($compRef['incompresiAllTime'][$uKey])) {
                                    $compRef['incompresiAllTime'][$uKey] = [
                                        'name' => $unP['name'],
                                        'roleNum' => $unP['role'],
                                        'role' => $ruoliMap[$unP['role']] ?? 'C',
                                        'club' => $unP['club'],
                                        'code' => $pCode,
                                        'fantasquadre' => [],
                                        'times' => 0,
                                        'totPoints' => 0.0,
                                        'totBonusMalus' => 0.0
                                    ];
                                }
                                $compRef['incompresiAllTime'][$uKey]['times']++;
                                $compRef['incompresiAllTime'][$uKey]['totPoints'] += $unP['totNum'];
                                $compRef['incompresiAllTime'][$uKey]['totBonusMalus'] += $unP['mod'];
                                $compRef['incompresiAllTime'][$uKey]['fantasquadre'][$fName] = true;
                            }

                            // 5. Titolari scesi in campo per Top/Flop 11
                            foreach ($mtd['starters'] as $stP) {
                                if ($stP['isValid'] && $stP['id'] > 0) {
                                    $pKey = $stP['name'];
                                    $pCode = $stP['code'] ?: ($playerCodes[$pKey]['code'] ?? '');
                                    if (!isset($compRef['allFieldedStats'][$pKey])) {
                                        $compRef['allFieldedStats'][$pKey] = [
                                            'name' => $stP['name'],
                                            'roleNum' => $stP['role'],
                                            'role' => $ruoliMap[$stP['role']] ?? 'C',
                                            'club' => $stP['club'],
                                            'code' => $pCode,
                                            'teamName' => $fName,
                                            'appearances' => 0,
                                            'sumTot' => 0.0
                                        ];
                                    }
                                    $compRef['allFieldedStats'][$pKey]['appearances']++;
                                    $compRef['allFieldedStats'][$pKey]['sumTot'] += $stP['totNum'];

                                    if (!isset($compRef['seasonFielded'][$sId][$pKey])) {
                                        $compRef['seasonFielded'][$sId][$pKey] = [
                                            'name' => $stP['name'],
                                            'roleNum' => $stP['role'],
                                            'role' => $ruoliMap[$stP['role']] ?? 'C',
                                            'club' => $stP['club'],
                                            'code' => $pCode,
                                            'teamName' => $fName,
                                            'appearances' => 0,
                                            'sumTot' => 0.0
                                        ];
                                    }
                                    $compRef['seasonFielded'][$sId][$pKey]['appearances']++;
                                    $compRef['seasonFielded'][$sId][$pKey]['sumTot'] += $stP['totNum'];
                                }
                            }
                        }
                    }
                }
            }

            // Finalizzazione dati e graduatorie
            $buildTopFlop = function($fieldedArray, $minAppearances, $allowedModules) {
                $eligible = [];
                foreach ($fieldedArray as $p) {
                    if ($p['appearances'] >= $minAppearances) {
                        $avgTot = round($p['sumTot'] / $p['appearances'], 2);
                        $eligible[] = array_merge($p, ['avgTot' => $avgTot]);
                    }
                }

                $topByRole = [1 => [], 2 => [], 3 => [], 4 => []];
                $flopByRole = [1 => [], 2 => [], 3 => [], 4 => []];
                foreach ($eligible as $p) {
                    $r = $p['roleNum'];
                    if ($r >= 1 && $r <= 4) {
                        $topByRole[$r][] = $p;
                        $flopByRole[$r][] = $p;
                    }
                }

                for ($r = 1; $r <= 4; $r++) {
                    usort($topByRole[$r], fn($a, $b) => ($b['avgTot'] <=> $a['avgTot']) ?: ($b['appearances'] <=> $a['appearances']));
                    usort($flopByRole[$r], fn($a, $b) => ($a['avgTot'] <=> $b['avgTot']) ?: ($b['appearances'] <=> $a['appearances']));
                }

                $bestTopSum = -999.0;
                $bestTopPlayers = [];
                $bestTopMod = '3-4-3';
                $topByMod = [];

                $worstFlopSum = 9999.0;
                $worstFlopPlayers = [];
                $worstFlopMod = '3-4-3';
                $flopByMod = [];

                foreach ($allowedModules as [$reqD, $reqC, $reqA]) {
                    $mStr = "$reqD-$reqC-$reqA";
                    if (count($topByRole[1]) >= 1 && count($topByRole[2]) >= $reqD && count($topByRole[3]) >= $reqC && count($topByRole[4]) >= $reqA) {
                        $lineup = array_merge(
                            array_slice($topByRole[1], 0, 1),
                            array_slice($topByRole[2], 0, $reqD),
                            array_slice($topByRole[3], 0, $reqC),
                            array_slice($topByRole[4], 0, $reqA)
                        );
                        $sum = round(array_sum(array_column($lineup, 'avgTot')), 2);
                        $topByMod[$mStr] = ['module' => $mStr, 'players' => $lineup, 'sum' => $sum];
                        if ($sum > $bestTopSum) {
                            $bestTopSum = $sum;
                            $bestTopPlayers = $lineup;
                            $bestTopMod = $mStr;
                        }
                    }

                    if (count($flopByRole[1]) >= 1 && count($flopByRole[2]) >= $reqD && count($flopByRole[3]) >= $reqC && count($flopByRole[4]) >= $reqA) {
                        $lineup = array_merge(
                            array_slice($flopByRole[1], 0, 1),
                            array_slice($flopByRole[2], 0, $reqD),
                            array_slice($flopByRole[3], 0, $reqC),
                            array_slice($flopByRole[4], 0, $reqA)
                        );
                        $sum = round(array_sum(array_column($lineup, 'avgTot')), 2);
                        $flopByMod[$mStr] = ['module' => $mStr, 'players' => $lineup, 'sum' => $sum];
                        if ($sum < $worstFlopSum) {
                            $worstFlopSum = $sum;
                            $worstFlopPlayers = $lineup;
                            $worstFlopMod = $mStr;
                        }
                    }
                }

                return [
                    'top' => [
                        'players' => $bestTopPlayers,
                        'module' => $bestTopMod,
                        'sum' => max(0.0, $bestTopSum),
                        'byModule' => $topByMod
                    ],
                    'flop' => [
                        'players' => $worstFlopPlayers,
                        'module' => $worstFlopMod,
                        'sum' => $worstFlopSum < 9999.0 ? $worstFlopSum : 0.0,
                        'byModule' => $flopByMod
                    ]
                ];
            };

            $finalByComp = [];
            foreach ($byComp as $cId => $cData) {
                if ($cData['matchesCount'] === 0) continue;

                $allTimeAgg = [];
                $allTimeFantasfiga = [];
                $seasonSummariesFinal = [];
                $seasonBestRoseFinal = [];
                $seasonFantasfigaFinal = [];
                $seasonModuliFinal = [];

                foreach ($seasons as $s) {
                    $sId = $s['id'];
                    $sTeams = $cData['seasonSummaries'][$sId]['teams'] ?? [];
                    if (empty($sTeams)) continue;

                    $teamsAvgPartial = [];
                    foreach ($sTeams as $fId => $st) {
                        $teamsAvgPartial[$fId] = $st['matches'] > 0 ? ($st['sumReal'] / $st['matches']) : 0.0;
                    }

                    $sFantasfigaAcc = [];
                    foreach ($sTeams as $fId => $st) {
                        $sFantasfigaAcc[$fId] = ['sumDelta' => 0.0, 'count' => 0];
                    }

                    $sMatches = $cData['seasonMatches'][$sId] ?? [];
                    foreach ($sMatches as $m) {
                        $t1 = $m['t1FId'];
                        $t2 = $m['t2FId'];
                        if (isset($sFantasfigaAcc[$t1])) {
                            $expected = $teamsAvgPartial[$t2] ?? 0.0;
                            $delta = $m['t2P'] - $expected;
                            $sFantasfigaAcc[$t1]['sumDelta'] += $delta;
                            $sFantasfigaAcc[$t1]['count']++;
                        }
                        if (isset($sFantasfigaAcc[$t2])) {
                            $expected = $teamsAvgPartial[$t1] ?? 0.0;
                            $delta = $m['t1P'] - $expected;
                            $sFantasfigaAcc[$t2]['sumDelta'] += $delta;
                            $sFantasfigaAcc[$t2]['count']++;
                        }
                    }

                    $sRanking = [];
                    $sBestRose = [];
                    $sFantasfiga = [];
                    $sModuliTeams = [];

                    foreach ($sTeams as $fId => $st) {
                        $avgScarto = $st['matches'] > 0 ? round($st['sumScarto'] / $st['matches'], 3) : 999.0;
                        $excess = $st['excessVotes'];
                        $scartoPesato = $excess > 0 ? round($st['sumScarto'] / $excess, 3) : ($st['matches'] > 0 ? round($st['scSuVotiSum'] / $st['matches'], 3) : 0.0);
                        $avgReal = $st['matches'] > 0 ? round($st['sumReal'] / $st['matches'], 2) : 0.0;
                        $avgIdeal = $st['matches'] > 0 ? round($st['sumIdeal'] / $st['matches'], 2) : 0.0;

                        $sRanking[] = [
                            'teamId' => $st['franchiseId'],
                            'idAttuale' => $st['idAttuale'],
                            'teamName' => $st['name'],
                            'matches' => $st['matches'],
                            'scartoMedio' => $avgScarto,
                            'scartoMedioPesato' => $scartoPesato,
                            'scartoZero' => $st['scartoZero'],
                            'scartoZeroPct' => $st['matches'] > 0 ? round(($st['scartoZero'] / $st['matches']) * 100, 1) : 0.0,
                            'puntiPersi' => round($st['sumLost'], 1),
                            'mediaReale' => $avgReal,
                            'mediaIdeale' => $avgIdeal
                        ];

                        $sBestRose[] = [
                            'teamId' => $st['franchiseId'],
                            'idAttuale' => $st['idAttuale'],
                            'teamName' => $st['name'],
                            'matches' => $st['matches'],
                            'bestRoseMedio' => $avgIdeal
                        ];

                        $fAcc = $sFantasfigaAcc[$fId] ?? ['sumDelta' => 0.0, 'count' => 1];
                        $diff = $fAcc['count'] > 0 ? round($fAcc['sumDelta'] / $fAcc['count'], 2) : 0.0;
                        $sFantasfiga[] = [
                            'teamId' => $st['franchiseId'],
                            'idAttuale' => $st['idAttuale'],
                            'teamName' => $st['name'],
                            'matches' => $st['matches'],
                            'diff' => $diff
                        ];

                        $sModuliTeams[] = [
                            'teamId' => $st['franchiseId'],
                            'idAttuale' => $st['idAttuale'],
                            'teamName' => $st['name'],
                            'matches' => $st['matches'],
                            'modulesOptimal' => $st['modulesOptimal']
                        ];

                        if (!isset($allTimeAgg[$fId])) {
                            $allTimeAgg[$fId] = [
                                'teamId' => $fId,
                                'idAttuale' => $st['idAttuale'],
                                'teamName' => $st['name'],
                                'seasons' => 0,
                                'matches' => 0,
                                'sumScarto' => 0.0,
                                'sumVoti' => 0,
                                'excessVotes' => 0,
                                'scSuVotiSum' => 0.0,
                                'scartoZero' => 0,
                                'sumLost' => 0.0,
                                'sumReal' => 0.0,
                                'sumIdeal' => 0.0,
                                'modulesOptimal' => array_fill_keys($allowedModuleStrings, 0)
                            ];
                            $allTimeFantasfiga[$fId] = ['sumDelta' => 0.0, 'count' => 0];
                        }
                        $allTimeAgg[$fId]['seasons']++;
                        $allTimeAgg[$fId]['matches'] += $st['matches'];
                        $allTimeAgg[$fId]['sumScarto'] += $st['sumScarto'];
                        $allTimeAgg[$fId]['sumVoti'] += $st['sumVoti'];
                        $allTimeAgg[$fId]['excessVotes'] += $st['excessVotes'];
                        $allTimeAgg[$fId]['scSuVotiSum'] += $st['scSuVotiSum'];
                        $allTimeAgg[$fId]['scartoZero'] += $st['scartoZero'];
                        $allTimeAgg[$fId]['sumLost'] += $st['sumLost'];
                        $allTimeAgg[$fId]['sumReal'] += $st['sumReal'];
                        $allTimeAgg[$fId]['sumIdeal'] += $st['sumIdeal'];
                        foreach ($allowedModuleStrings as $mStr) {
                            $allTimeAgg[$fId]['modulesOptimal'][$mStr] += ($st['modulesOptimal'][$mStr] ?? 0);
                        }

                        $allTimeFantasfiga[$fId]['sumDelta'] += $fAcc['sumDelta'];
                        $allTimeFantasfiga[$fId]['count'] += $fAcc['count'];
                    }

                    usort($sRanking, fn($a, $b) => ($a['scartoMedioPesato'] <=> $b['scartoMedioPesato']) ?: ($a['scartoMedio'] <=> $b['scartoMedio']));
                    usort($sBestRose, fn($a, $b) => $b['bestRoseMedio'] <=> $a['bestRoseMedio']);
                    usort($sFantasfiga, fn($a, $b) => $b['diff'] <=> $a['diff']);
                    usort($sModuliTeams, fn($a, $b) => strcmp($a['teamName'], $b['teamName']));

                    $sWinner = $sRanking[0] ?? null;

                    $seasonSummariesFinal[$sId] = [
                        'season' => $sId,
                        'year' => $s['anno'],
                        'years' => $s['anni_stagione'],
                        'winner' => $sWinner ? [
                            'id' => $sWinner['teamId'],
                            'name' => $sWinner['teamName'],
                            'scartoMedio' => $sWinner['scartoMedio'],
                            'scartoMedioPesato' => $sWinner['scartoMedioPesato']
                        ] : null,
                        'ranking' => $sRanking
                    ];
                    $seasonBestRoseFinal[$sId] = $sBestRose;
                    $seasonFantasfigaFinal[$sId] = $sFantasfiga;
                    $seasonModuliFinal[$sId] = [
                        'teams' => $sModuliTeams,
                        'global' => $cData['seasonModulesGlobal'][$sId] ?? array_fill_keys($allowedModuleStrings, 0)
                    ];
                }

                $allTimeRanking = [];
                $allTimeBestRose = [];
                $allTimeFantasfigaList = [];
                $allTimeModuliTeams = [];

                foreach ($allTimeAgg as $fId => $t) {
                    if ($t['matches'] === 0) continue;
                    $allTimeExcess = $t['excessVotes'];
                    $allTimePesato = $allTimeExcess > 0 ? round($t['sumScarto'] / $allTimeExcess, 3) : ($t['matches'] > 0 ? round($t['scSuVotiSum'] / $t['matches'], 3) : 0.0);
                    $scMedio = round($t['sumScarto'] / $t['matches'], 3);
                    $mReal = round($t['sumReal'] / $t['matches'], 2);
                    $mIdeal = round($t['sumIdeal'] / $t['matches'], 2);

                    $allTimeRanking[] = [
                        'teamId' => $t['teamId'],
                        'idAttuale' => $t['idAttuale'],
                        'teamName' => $t['teamName'],
                        'seasons' => $t['seasons'],
                        'matches' => $t['matches'],
                        'scartoMedio' => $scMedio,
                        'scartoMedioPesato' => $allTimePesato,
                        'scartoZero' => $t['scartoZero'],
                        'scartoZeroPct' => round(($t['scartoZero'] / $t['matches']) * 100, 1),
                        'puntiPersi' => round($t['sumLost'], 1),
                        'mediaReale' => $mReal,
                        'mediaIdeale' => $mIdeal
                    ];

                    $allTimeBestRose[] = [
                        'teamId' => $t['teamId'],
                        'idAttuale' => $t['idAttuale'],
                        'teamName' => $t['teamName'],
                        'matches' => $t['matches'],
                        'bestRoseMedio' => $mIdeal
                    ];

                    $allTimeModuliTeams[] = [
                        'teamId' => $t['teamId'],
                        'idAttuale' => $t['idAttuale'],
                        'teamName' => $t['teamName'],
                        'matches' => $t['matches'],
                        'modulesOptimal' => $t['modulesOptimal']
                    ];

                    $fAcc = $allTimeFantasfiga[$fId] ?? ['sumDelta' => 0.0, 'count' => 1];
                    $diff = $fAcc['count'] > 0 ? round($fAcc['sumDelta'] / $fAcc['count'], 2) : 0.0;
                    $allTimeFantasfigaList[] = [
                        'teamId' => $t['teamId'],
                        'idAttuale' => $t['idAttuale'],
                        'teamName' => $t['teamName'],
                        'matches' => $t['matches'],
                        'diff' => $diff
                    ];
                }

                usort($allTimeRanking, fn($a, $b) => ($a['scartoMedioPesato'] <=> $b['scartoMedioPesato']) ?: ($a['scartoMedio'] <=> $b['scartoMedio']));
                usort($allTimeBestRose, fn($a, $b) => $b['bestRoseMedio'] <=> $a['bestRoseMedio']);
                usort($allTimeFantasfigaList, fn($a, $b) => $b['diff'] <=> $a['diff']);
                usort($allTimeModuliTeams, fn($a, $b) => strcmp($a['teamName'], $b['teamName']));

                usort($cData['topIdeali'], fn($a, $b) => $b['idealScore'] <=> $a['idealScore']);
                $topIdeali = array_slice($cData['topIdeali'], 0, 15);

                usort($cData['worstScarti'], fn($a, $b) => $b['scarto'] <=> $a['scarto']);
                $worstScarti = array_slice($cData['worstScarti'], 0, 15);

                // Incompresi con codice, club storici e fantasquadre storiche
                $incompresiEligible = [];
                foreach ($cData['incompresiAllTime'] as $uKey => $inc) {
                    if ($inc['times'] >= 20) {
                        $avgFV = round($inc['totPoints'] / $inc['times'], 2);
                        $pClubs = !empty($playerAllClubs[$inc['name']]) ? array_keys($playerAllClubs[$inc['name']]) : ($inc['club'] ? [$inc['club']] : []);
                        $pFants = array_keys($inc['fantasquadre']);
                        $pCode = $inc['code'] ?: ($playerCodes[$inc['name']]['code'] ?? '');

                        $incompresiEligible[] = [
                            'name' => $inc['name'],
                            'role' => $inc['role'],
                            'club' => $inc['club'],
                            'code' => $pCode,
                            'clubs' => $pClubs,
                            'fantasquadre' => $pFants,
                            'times' => $inc['times'],
                            'totPoints' => round($inc['totPoints'], 1),
                            'totBonusMalus' => round($inc['totBonusMalus'], 1),
                            'mediaFantavoto' => $avgFV
                        ];
                    }
                }
                usort($incompresiEligible, fn($a, $b) => ($b['mediaFantavoto'] <=> $a['mediaFantavoto']) ?: ($b['times'] <=> $a['times']));
                $topIncompresi = array_slice($incompresiEligible, 0, 100);

                // Fantabomber con codice, club storici e fantasquadre storiche
                $allScorersList = [];
                foreach ($cData['allScorers'] as $scKey => $sc) {
                    $pClubs = !empty($playerAllClubs[$sc['name']]) ? array_keys($playerAllClubs[$sc['name']]) : ($sc['club'] ? [$sc['club']] : []);
                    $pFants = array_keys($sc['fantasquadre']);
                    $pCode = $sc['code'] ?: ($playerCodes[$sc['name']]['code'] ?? '');
                    $allScorersList[] = [
                        'name' => $sc['name'],
                        'role' => $sc['role'],
                        'club' => $sc['club'],
                        'code' => $pCode,
                        'clubs' => $pClubs,
                        'fantasquadre' => $pFants,
                        'teamName' => $sc['teamName'],
                        'goals' => $sc['goals']
                    ];
                }
                usort($allScorersList, fn($a, $b) => ($b['goals'] <=> $a['goals']) ?: strcmp($a['name'], $b['name']));
                $allScorersList = array_slice($allScorersList, 0, 150);

                $seasonScorersList = [];
                foreach ($cData['seasonScorers'] as $sId => $scList) {
                    $arr = [];
                    foreach ($scList as $scKey => $sc) {
                        $pClubs = !empty($playerAllClubs[$sc['name']]) ? array_keys($playerAllClubs[$sc['name']]) : ($sc['club'] ? [$sc['club']] : []);
                        $pFants = array_keys($sc['fantasquadre']);
                        $pCode = $sc['code'] ?: ($playerCodes[$sc['name']]['code'] ?? '');
                        $arr[] = [
                            'name' => $sc['name'],
                            'role' => $sc['role'],
                            'club' => $sc['club'],
                            'code' => $pCode,
                            'clubs' => $pClubs,
                            'fantasquadre' => $pFants,
                            'teamName' => $sc['teamName'],
                            'goals' => $sc['goals']
                        ];
                    }
                    usort($arr, fn($a, $b) => ($b['goals'] <=> $a['goals']) ?: strcmp($a['name'], $b['name']));
                    $seasonScorersList[$sId] = array_slice($arr, 0, 50);
                }

                // Uomo Partita
                $allMomList = [];
                foreach ($cData['momCount'] as $mKey => $m) {
                    $pClubs = !empty($playerAllClubs[$m['name']]) ? array_keys($playerAllClubs[$m['name']]) : ($m['club'] ? [$m['club']] : []);
                    $pFants = array_keys($m['fantasquadre']);
                    $pCode = $m['code'] ?: ($playerCodes[$m['name']]['code'] ?? '');
                    $allMomList[] = [
                        'name' => $m['name'],
                        'role' => $m['role'],
                        'club' => $m['club'],
                        'code' => $pCode,
                        'clubs' => $pClubs,
                        'fantasquadre' => $pFants,
                        'teamName' => $m['teamName'],
                        'count' => $m['count']
                    ];
                }
                usort($allMomList, fn($a, $b) => ($b['count'] <=> $a['count']) ?: strcmp($a['name'], $b['name']));
                $allMomList = array_slice($allMomList, 0, 100);

                $seasonMomList = [];
                foreach ($cData['seasonMom'] as $sId => $mList) {
                    $arr = [];
                    foreach ($mList as $mKey => $m) {
                        $pClubs = !empty($playerAllClubs[$m['name']]) ? array_keys($playerAllClubs[$m['name']]) : ($m['club'] ? [$m['club']] : []);
                        $pFants = array_keys($m['fantasquadre']);
                        $pCode = $m['code'] ?: ($playerCodes[$m['name']]['code'] ?? '');
                        $arr[] = [
                            'name' => $m['name'],
                            'role' => $m['role'],
                            'club' => $m['club'],
                            'code' => $pCode,
                            'clubs' => $pClubs,
                            'fantasquadre' => $pFants,
                            'teamName' => $m['teamName'],
                            'count' => $m['count']
                        ];
                    }
                    usort($arr, fn($a, $b) => ($b['count'] <=> $a['count']) ?: strcmp($a['name'], $b['name']));
                    $seasonMomList[$sId] = array_slice($arr, 0, 50);
                }

                $allTimeMinApps = ($cId === 6) ? 10 : 20;
                $allTimeTopFlop = $buildTopFlop($cData['allFieldedStats'], $allTimeMinApps, $allowedModules);

                $seasonTopFlop = [];
                foreach ($cData['seasonFielded'] as $sId => $sFielded) {
                    $sMinApps = ($cId === 6) ? 3 : 5;
                    $seasonTopFlop[$sId] = $buildTopFlop($sFielded, $sMinApps, $allowedModules);
                }

                $finalByComp[$cId] = [
                    'id' => $cId,
                    'name' => $cData['name'],
                    'matchesCount' => $cData['matchesCount'],
                    'allTime' => $allTimeRanking,
                    'records' => [
                        'topIdeali' => $topIdeali,
                        'worstScarti' => $worstScarti,
                        'incompresi' => $topIncompresi
                    ],
                    'moduli' => [
                        'allTime' => [
                            'teams' => $allTimeModuliTeams,
                            'global' => $cData['modulesOptimalGlobal']
                        ],
                        'bySeason' => $seasonModuliFinal
                    ],
                    'fantabomber' => [
                        'allTime' => $allScorersList,
                        'bySeason' => $seasonScorersList
                    ],
                    'mom' => [
                        'allTime' => $allMomList,
                        'bySeason' => $seasonMomList
                    ],
                    'topFlop' => [
                        'allTime' => $allTimeTopFlop,
                        'bySeason' => $seasonTopFlop
                    ],
                    'fantasfiga' => [
                        'allTime' => $allTimeFantasfigaList,
                        'bySeason' => $seasonFantasfigaFinal
                    ],
                    'bestRose' => [
                        'allTime' => $allTimeBestRose,
                        'bySeason' => $seasonBestRoseFinal
                    ],
                    'stagioni' => $seasonSummariesFinal
                ];
            }

            $result = [
                'updatedAt' => date('c'),
                'countSeasons' => count($seasons),
                'seasonYears' => $seasonYearsMap,
                'competitions' => array_map(fn($id, $name) => ['id' => $id, 'name' => $name], array_keys($targetComps), array_values($targetComps)),
                'byComp' => $finalByComp,
                'allTime' => $finalByComp[0]['allTime'] ?? [],
                'records' => $finalByComp[0]['records'] ?? [],
                'stagioni' => $finalByComp[0]['stagioni'] ?? []
            ];

            $jsonOutput = json_encode($result, JSON_UNESCAPED_UNICODE);
            fcm_write_file_atomic($cacheFile, $jsonOutput);
            if (!$isCli) echo $jsonOutput;
            return $result;

        case 'genera_cache':
            echo "=== AVVIO GENERAZIONE CACHE SQLITE ===\n";

            echo "1/7 Rigenerazione stagioni.json...\n";
            $_GET['refresh'] = '1';
            handleApiAction('stagioni', $sqliteBase, true);

            echo "2/7 Rigenerazione confronti.json...\n";
            handleApiAction('confronti', $sqliteBase, true);

            echo "3/7 Rigenerazione album.json...\n";
            handleApiAction('album', $sqliteBase, true);

            echo "4/7 Rigenerazione almanacco.json...\n";
            handleApiAction('almanacco', $sqliteBase, true);

            echo "5/7 Rigenerazione ranking.json...\n";
            handleApiAction('ranking', $sqliteBase, true);

            echo "6/7 Rigenerazione top_costi.json...\n";
            handleApiAction('top_costi', $sqliteBase, true);

            echo "7/8 Rigenerazione statistiche_storiche.json...\n";
            handleApiAction('statistiche_storiche', $sqliteBase, true);

            echo "8/8 Rigenerazione fantamister_storico.json...\n";
            handleApiAction('fantamister_storico', $sqliteBase, true);

            echo "Rigenerazione classifica_perpetua.json...\n";
            handleApiAction('classifica_perpetua', $sqliteBase, true);

            $seasons = getStagioniDisponibili($sqliteBase);
            echo "Salvataggio classifiche storiche per " . count($seasons) . " stagioni...\n";
            foreach ($seasons as $s) {
                $_GET['season'] = $s['id'];
                handleApiAction('classifica_stagione', $sqliteBase, true);
            }

            echo "Salvataggio rose per " . count($seasons) . " stagioni...\n";
            foreach ($seasons as $s) {
                $_GET['stagione'] = $s['id'];
                handleApiAction('squadre_rose', $sqliteBase, true);
            }

            echo "Salvataggio calendari storici per " . count($seasons) . " stagioni...\n";
            foreach ($seasons as $s) {
                $_GET['season'] = $s['id'];
                handleApiAction('calendario_stagione', $sqliteBase, true);
            }

            echo "=== COMPLETATO CON SUCCESSO! ===\n";
            return ['success' => true];

        default:
            if (!$isCli) {
                http_response_code(400);
                echo json_encode(['error' => "Azione '$action' non valida"], JSON_UNESCAPED_UNICODE);
            }
            return null;
    }
}

// Esecuzione azione automatica solo se lo script viene chiamato direttamente (via web o CLI)
$isDirectCall = false;
if (php_sapi_name() === 'cli') {
    $isDirectCall = isset($_SERVER['SCRIPT_FILENAME']) && (realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__));
} else {
    $isDirectCall = (isset($_SERVER['SCRIPT_NAME']) && str_ends_with($_SERVER['SCRIPT_NAME'], 'api_storico.php'))
        || (isset($_SERVER['SCRIPT_FILENAME']) && (basename($_SERVER['SCRIPT_FILENAME']) === 'api_storico.php' || realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)));
}
if ($isDirectCall) {
    handleApiAction($action, $sqliteBase, php_sapi_name() === 'cli' && ($action === 'genera_cache'));
}
