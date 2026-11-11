<?php
if (!defined('PN_ADMIN_RANKING_VIEW') && !isset($isAdminLogged)) {
    die('Accesso diretto non consentito.');
}

$sqliteBase = realpath(__DIR__ . '/../sqlite');
require_once __DIR__ . '/api_storico.php';

// Carica configurazione ranking attuale
$cfgRanking = getRankingConfig($sqliteBase);

// Helper percentuale per input
$toPct = function($val, $default = 0) {
    if ($val === null || $val === '') $val = $default;
    $v = floatval($val);
    if ($v <= 1.0 && $v > 0) return round($v * 100);
    return round($v);
};

// Carica stagioni disponibili e franchigie master
$stagioniDisponibili = getStagioniDisponibili($sqliteBase);
$latestSeason = !empty($stagioniDisponibili) ? (int)$stagioniDisponibili[0]['id'] : 14;
$franchiseInfo = getFranchiseResolver($sqliteBase, $latestSeason);
$masterTeams = $franchiseInfo['alboTeams']; // ID, IDAttuale, Nome
$customOverrides = $franchiseInfo['override']; // [season => [localTeamId => masterId]]
$alboTeamNames = $franchiseInfo['alboTeamNames'] ?? [];

// Carica competizioni master, mappature e loghi configurati
$compInfo = getCompetitionResolver($sqliteBase, $latestSeason);
$masterComps = $compInfo['alboComps']; // ID, IDAttuale, Nome, icon, autoIcon, customIcon
$customCompOverrides = $compInfo['override']; // [season => [localCompId => masterCompId]]
$alboCompNames = $compInfo['alboCompNames'] ?? [];
$customCompLogos = $compInfo['customLogos'] ?? [];
$cfgRanking = getRankingConfig($sqliteBase, $masterComps);

// Scansiona eventuali loghi custom già caricati in img/comp_logos/
$uploadedCompLogos = [];
$compLogosDir = dirname(__DIR__) . '/img/comp_logos';
if (is_dir($compLogosDir)) {
    $logoFiles = @scandir($compLogosDir);
    if (is_array($logoFiles)) {
        foreach ($logoFiles as $lf) {
            if ($lf === '.' || $lf === '..') continue;
            if (preg_match('/\.(png|jpe?g|gif|webp)$/i', $lf)) {
                $uploadedCompLogos['comp_logos/' . $lf] = $lf;
            }
        }
    }
}
foreach ($customCompLogos as $cIdKey => $cLogoVal) {
    if (strpos((string)$cLogoVal, 'comp_logos/') === 0 && !isset($uploadedCompLogos[$cLogoVal])) {
        $uploadedCompLogos[$cLogoVal] = basename($cLogoVal);
    }
}

// Helper visualizzazione logo competizione con fallback trasparente a emoji
if (!function_exists('renderCompLogoWithFallback')) {
    function renderCompLogoWithFallback($cName, $cEmoji = '🏆', $size = 20, $cId = 0) {
        global $masterComps;
        $configuredIcon = '';
        if (!empty($masterComps) && is_array($masterComps)) {
            if ($cId > 0 && isset($masterComps[$cId])) {
                $configuredIcon = $masterComps[$cId]['icon'] ?? '';
            } else {
                $normTarget = strtolower(trim((string)$cName));
                foreach ($masterComps as $mc) {
                    if (strtolower(trim((string)($mc['Nome'] ?? ''))) === $normTarget) {
                        $configuredIcon = $mc['icon'] ?? '';
                        $cId = (int)($mc['ID'] ?? 0);
                        break;
                    }
                }
            }
        }

        $imgSrc = '';
        if ($configuredIcon !== '') {
            if ($configuredIcon === 'ico-scudetto.gif') $imgSrc = '../img/scudo.png';
            elseif ($configuredIcon === 'ico-coppa.gif') $imgSrc = '../img/coppa.png';
            elseif ($configuredIcon === 'ico-supercoppa.gif') $imgSrc = '../img/supercoppa.png';
            elseif ($configuredIcon === 'ico-gp.gif') $imgSrc = '../img/gp.png';
            else $imgSrc = '../img/' . $configuredIcon;
        } else {
            $clean = strtolower(trim((string)$cName));
            $imgSrc = '../img/coppa.png';
            if (strpos($clean, 'supercoppa') !== false || strpos($clean, 'shield') !== false) {
                $imgSrc = '../img/supercoppa.png';
            } elseif (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false) {
                $imgSrc = '../img/gp.png';
            } elseif (strpos($clean, 'coppa') !== false || strpos($clean, 'cup') !== false) {
                $imgSrc = '../img/coppa.png';
            } elseif (strpos($clean, 'scudetto') !== false || strpos($clean, 'lega') !== false || strpos($clean, 'campionato') !== false || strpos($clean, 'premier') !== false || strpos($clean, 'serie') !== false) {
                $imgSrc = '../img/scudo.png';
            }
        }

        $escName = htmlspecialchars($cName);
        $escEmoji = $cEmoji ?: '🏆';
        $sz = (int)$size;
        $fontSize = round($sz * 0.85);
        $dataAttr = $cId > 0 ? ' data-comp-badge-img="' . (int)$cId . '"' : '';

        return '<span class="comp-icon-badge" style="display:inline-flex;align-items:center;justify-content:center;width:' . $sz . 'px;height:' . $sz . 'px;flex-shrink:0;vertical-align:middle;" title="' . $escName . '">'
            . '<img src="' . htmlspecialchars($imgSrc) . '" alt="' . $escName . '" width="' . $sz . '" height="' . $sz . '"' . $dataAttr . ' style="object-fit:contain;vertical-align:middle;display:inline-block;" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline\';" />'
            . '<span class="comp-emoji-fallback" style="display:none;font-size:' . $fontSize . 'px;line-height:1;">' . $escEmoji . '</span>'
            . '</span>';
    }
}

// Carica configurazione cartelle storiche legacy (inc/data/storico_config.json)
$storicoConfigFile = __DIR__ . '/data/storico_config.json';
$storicoConfig = file_exists($storicoConfigFile) ? json_decode(file_get_contents($storicoConfigFile), true) : ['showLegacySites' => true, 'seasons' => []];
if (!is_array($storicoConfig)) $storicoConfig = ['showLegacySites' => true, 'seasons' => []];

// Scansione cartelle candidate sul server per i siti storici (locali e cartelle parente)
$rootDir = dirname(__DIR__);
$parentDir = @dirname($rootDir);
$legacyCandidates = [];
$seenFolders = [];
$excludeFolders = ['.git', '.agents', '.gemini', '.idea', '.vscode', 'css', 'js', 'img', 'images', 'inc', 'sqlite', 'tests', 'scratch', 'doc', 'persjs', 'invform', 'mercato', 'fantam', 'probform', 'liberi', 'node_modules', 'vendor', 'cache', 'temp', 'tmp', 'uploads', 'assets', 'logs', 'cgi-bin', '$recycle.bin'];

$scanDirs = function($dir, $prefix = '', $depth = 1, $maxDepth = 3) use (&$scanDirs, &$legacyCandidates, &$seenFolders, $excludeFolders, $rootDir) {
    if ($depth > $maxDepth) return;
    $items = @scandir($dir);
    if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || in_array(strtolower($item), $excludeFolders)) continue;
        $full = $dir . '/' . $item;
        if (!@is_dir($full)) continue;
        // Evita di scansionare nuovamente la root corrente quando si naviga la cartella parente
        if (realpath($full) && realpath($full) === realpath($rootDir)) continue;

        $rel = $prefix ? $prefix . '/' . $item : $item;
        $relNormalized = str_replace('\\', '/', $rel);

        $idx = null;
        if (@file_exists($full . '/index.php')) $idx = 'index.php';
        elseif (@file_exists($full . '/index.htm')) $idx = 'index.htm';
        elseif (@file_exists($full . '/index.html')) $idx = 'index.html';

        $hasIndex = ($idx !== null);
        $isRelevantName = (bool)preg_match('/(archiv|storic|stagion|season|edizion|old|backup|fcm|lega|20\d\d|19\d\d)/i', $item);

        // Aggiungi ai candidati se ha un file index, se è di 1° livello o se il nome è pertinente
        if (!isset($seenFolders[$relNormalized]) && ($hasIndex || $depth === 1 || $isRelevantName)) {
            $seenFolders[$relNormalized] = true;
            $legacyCandidates[] = [
                'folder' => $relNormalized,
                'index' => $idx,
                'hasIndex' => $hasIndex,
                'isParent' => (strpos($relNormalized, '..') === 0)
            ];
        }

        // Continua scansione ricorsiva delle sottocartelle
        $scanDirs($full, $rel, $depth + 1, $maxDepth);
    }
};

// 1. Scansione cartelle locali e relative sottocartelle (fino a 3 livelli)
$scanDirs($rootDir, '', 1, 3);

// 2. Scansione cartelle parente e loro sottocartelle (fino a 2 livelli)
if ($parentDir && $parentDir !== $rootDir && @is_dir($parentDir) && @is_readable($parentDir)) {
    $scanDirs($parentDir, '..', 1, 2);
}

// Prepariamo l'elenco delle squadre, competizioni e statistiche per ogni stagione
$squadrePerStagione = [];
$statsStagione = [];
$competizioniPerStagione = [];
$statsCompStagione = [];

foreach ($stagioniDisponibili as $stg) {
    $sNum = (int)$stg['id'];
    $dbPath = "$sqliteBase/stagione_$sNum/lega_$sNum.sqlite";
    $squadrePerStagione[$sNum] = [];
    $competizioniPerStagione[$sNum] = [];
    $countAuto = 0;
    $countManual = 0;
    $countCompAuto = 0;
    $countCompManual = 0;

    if (file_exists($dbPath)) {
        try {
            $db = new PDO("sqlite:$dbPath");
            $squadre = $db->query("SELECT ID, Nome, Presidente FROM Fantasquadra ORDER BY ID ASC")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($squadre as $sq) {
                $locId = (int)$sq['ID'];
                $isOverridden = isset($customOverrides[$sNum][$locId]);
                
                // Risoluzione automatica (senza override)
                $autoMasterId = call_user_func($franchiseInfo['autoResolver'], $sNum, $locId, $sq['Nome'], $sq['Presidente'] ?? '');
                $autoMasterName = $alboTeamNames[$autoMasterId] ?? "ID $autoMasterId";

                // Risoluzione attuale effettiva
                $currentMasterId = $isOverridden ? (int)$customOverrides[$sNum][$locId] : $autoMasterId;
                $currentMasterName = $alboTeamNames[$currentMasterId] ?? "ID $currentMasterId";

                if ($isOverridden) {
                    $countManual++;
                } else {
                    $countAuto++;
                }

                $squadrePerStagione[$sNum][] = [
                    'id' => $locId,
                    'nome' => $sq['Nome'],
                    'presidente' => $sq['Presidente'] ?? '',
                    'autoMasterId' => $autoMasterId,
                    'autoMasterName' => $autoMasterName,
                    'currentMasterId' => $currentMasterId,
                    'currentMasterName' => $currentMasterName,
                    'isOverridden' => $isOverridden
                ];
            }

            $compsList = [];
            $seenCompIds = [];

            // 1. Competizioni locali dal DB di lega (incontri a calendario)
            try {
                $stmtComps = $db->query("
                    SELECT c.ID, c.Nome, 
                           (SELECT COUNT(*) FROM Incontro i JOIN Girone g ON i.IDGirone = g.ID WHERE g.IDCompetizione = c.ID AND i.Giocato = 1) as numPartite
                    FROM Competizione c 
                    ORDER BY c.ID ASC
                ");
                if ($stmtComps) {
                    while ($cp = $stmtComps->fetch(PDO::FETCH_ASSOC)) {
                        $locId = (int)$cp['ID'];
                        $seenCompIds[$locId] = true;
                        $compsList[] = [
                            'id' => $locId,
                            'nome' => $cp['Nome'],
                            'numPartite' => (int)($cp['numPartite'] ?? 0),
                            'tipo' => 'partite'
                        ];
                    }
                }
            } catch (Exception $e) {}

            // 2. Competizioni presenti in AlboPosizione per questa stagione (podi, trofei, GP)
            try {
                $stmtAlbo = $db->query("SELECT DISTINCT IDCompetizione FROM AlboPosizione WHERE Stagione = $sNum");
                if ($stmtAlbo) {
                    while ($ar = $stmtAlbo->fetch(PDO::FETCH_ASSOC)) {
                        $alboCId = (int)$ar['IDCompetizione'];
                        // Controlla se questo alboCId è già rappresentato da una competizione locale via IDAttuale
                        $isAlreadyRepresented = false;
                        foreach ($masterComps as $mc) {
                            if ((int)$mc['ID'] === $alboCId) {
                                $attId = (int)($mc['IDAttuale'] ?? 0);
                                if ($attId > 0 && isset($seenCompIds[$attId])) {
                                    $isAlreadyRepresented = true;
                                    break;
                                }
                            }
                        }

                        if (!$isAlreadyRepresented && !isset($seenCompIds[$alboCId])) {
                            $seenCompIds[$alboCId] = true;
                            $alboCName = $alboCompNames[$alboCId] ?? "Competizione Storica #$alboCId";
                            $compsList[] = [
                                'id' => $alboCId,
                                'nome' => $alboCName,
                                'numPartite' => 0,
                                'tipo' => 'albo'
                            ];
                        }
                    }
                }
            } catch (Exception $e) {}

            // 3. Risoluzione e stato abbinamento per ciascuna competizione
            foreach ($compsList as $cp) {
                $locId = (int)$cp['id'];
                $isOverridden = isset($customCompOverrides[$sNum][$locId]);
                
                $autoMasterId = call_user_func($compInfo['autoResolver'], $sNum, $locId, $cp['nome']);
                $autoMasterName = $alboCompNames[$autoMasterId] ?? "ID $autoMasterId";

                $currentMasterId = $isOverridden ? (int)$customCompOverrides[$sNum][$locId] : $autoMasterId;
                $currentMasterName = $alboCompNames[$currentMasterId] ?? ($currentMasterId === 0 ? 'Nessuna / Escludi dallo Storico' : "ID $currentMasterId");

                if ($isOverridden) {
                    $countCompManual++;
                } else {
                    $countCompAuto++;
                }

                $competizioniPerStagione[$sNum][] = [
                    'id' => $locId,
                    'nome' => $cp['nome'],
                    'numPartite' => $cp['numPartite'],
                    'tipo' => $cp['tipo'],
                    'autoMasterId' => $autoMasterId,
                    'autoMasterName' => $autoMasterName,
                    'currentMasterId' => $currentMasterId,
                    'currentMasterName' => $currentMasterName,
                    'isOverridden' => $isOverridden
                ];
            }
        } catch (Exception $e) {
            // Ignora errori lettura stagione
        }
    }

    $statsStagione[$sNum] = [
        'total' => count($squadrePerStagione[$sNum]),
        'auto' => $countAuto,
        'manual' => $countManual
    ];
    $statsCompStagione[$sNum] = [
        'total' => count($competizioniPerStagione[$sNum]),
        'auto' => $countCompAuto,
        'manual' => $countCompManual
    ];
}
?>

<style>
/* Stili dedicati per il tab Ranking & Storico */
.ranking-header-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 14px);
    padding: 18px 22px;
    margin-bottom: 22px;
}
.ranking-banner-title {
    margin: 0 0 6px 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-primary, #f8fafc);
    display: flex;
    align-items: center;
    gap: 10px;
}
.ranking-banner-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary, #94a3b8);
    line-height: 1.5;
}
.ranking-grid-3cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 18px;
    margin-top: 14px;
}
.ranking-card {
    background: var(--bg-surface, #131d35);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-lg, 14px);
    padding: 20px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
}
.ranking-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    padding-bottom: 12px;
    margin-bottom: 16px;
}
.ranking-card-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text-primary, #f8fafc);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.ranking-card-badge {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 8px;
    border-radius: 9999px;
    background: rgba(2, 132, 199, 0.15);
    color: var(--accent-primary, #0284c7);
    border: 1px solid rgba(2, 132, 199, 0.25);
}
.comp-group-block {
    background: var(--bg-surface-elevated, #1e293b);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    box-sizing: border-box;
}
.comp-group-block:last-child {
    margin-bottom: 0;
}
.comp-group-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text-primary, #f8fafc);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.comp-podium-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.param-input-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
}
.param-input-item .calc-input-number {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    text-align: center !important;
    padding: 7px 6px !important;
    font-size: 0.95rem !important;
    font-weight: 700 !important;
}
/* Rimuovi frecce spin native per garantire spazio e leggibilità a tutte le colonne */
.param-input-item input[type=number]::-webkit-inner-spin-button,
.param-input-item input[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.param-input-item input[type=number] {
    -moz-appearance: textfield;
}
.param-label {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--text-secondary, #94a3b8);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 4px;
    margin-bottom: 2px;
    line-height: 1.3;
}
.param-label > span:first-child {
    color: var(--text-primary, #f8fafc);
    white-space: nowrap;
}
.param-default {
    font-size: 0.68rem;
    color: var(--text-muted, #64748b);
    font-weight: 500;
    white-space: nowrap;
}
.comp-podium-grid .param-label {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
}
.pct-input-wrap {
    display: flex;
    align-items: stretch;
    position: relative;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}
.pct-input-wrap input.calc-input-number,
.pct-input-wrap input {
    flex: 1 1 auto;
    width: 100% !important;
    min-width: 0 !important;
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    text-align: right;
    font-weight: 700;
    padding: 7px 8px !important;
    margin: 0;
    box-sizing: border-box;
}
/* Rimuovi frecce spin native anche per la percentuale */
.pct-input-wrap input[type=number]::-webkit-inner-spin-button,
.pct-input-wrap input[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.pct-input-wrap input[type=number] {
    -moz-appearance: textfield;
}
.pct-addon {
    flex: 0 0 auto;
    background: var(--bg-surface-elevated, #1e293b);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
    border-left: none;
    color: var(--text-muted, #94a3b8);
    font-size: 0.84rem;
    font-weight: 800;
    padding: 0 10px;
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    box-sizing: border-box;
    line-height: 1;
    transition: border-color 0.2s ease;
}
.pct-input-wrap:focus-within .pct-addon {
    border-color: var(--accent-primary, #3b82f6);
}
.decay-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--bg-surface-elevated, #1e293b);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 8px;
    box-sizing: border-box;
}
.decay-input-wrap {
    width: 100px;
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    box-sizing: border-box;
}
/* Rimuovi scorrimento verticale interno dal contenitore tabelle in impostazioni#ranking */
.assoc-table-wrap {
    max-height: none !important;
    overflow-y: visible !important;
}
.decay-row-older {
    background: rgba(6, 182, 212, 0.06);
    border: 1px dashed rgba(6, 182, 212, 0.4);
}
.decay-label-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.decay-label-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text-primary, #f8fafc);
}
.decay-label-sub {
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
}
.season-stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 700;
    background: rgba(255,255,255,0.06);
    color: var(--text-secondary, #94a3b8);
    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
}
.season-stat-badge.stat-auto {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.25);
}
.season-stat-badge.stat-manual {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.25);
}
.franchise-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.franchise-status-pill.pill-auto {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
}
.franchise-status-pill.pill-manual {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.35);
}
.franchise-status-pill.pill-modified {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.4);
}
.ranking-callout-info {
    display: flex;
    gap: 10px;
    background: rgba(2, 132, 199, 0.08);
    border-left: 3px solid var(--accent-primary, #0284c7);
    border-radius: 6px;
    padding: 10px 12px;
    margin-top: 14px;
    font-size: 0.78rem;
    color: var(--text-secondary, #94a3b8);
    line-height: 1.45;
}
</style>

<div style="margin-bottom: 30px;">
    <!-- BANNER TESTATA RANKING & STORICO -->
    <div class="ranking-header-banner">
        <div>
            <h3 class="ranking-banner-title">
                <span>🏆</span>
                <span>Ranking Storico Perpetuo &amp; Continuità Franchigie</span>
            </h3>
            <p class="ranking-banner-desc">
                Gestisci le formule del Ranking Storico perpetuo (stile Ranking UEFA) e assicura la continuità storica e statistica delle fantasquadre attraverso le edizioni della lega.
            </p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <a href="../#ranking" class="calc-btn-action" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px; text-decoration: none;" title="Visualizza la classifica del Ranking Storico nella SPA">
                <span>👁️ Apri Ranking Live</span>
            </a>
        </div>
    </div>

    <!-- SEZIONE 1: REGOLE E PARAMETRI RANKING STORICO -->
    <section class="calc-card-section" style="margin-bottom: 24px;">
        <div class="calc-section-header">
            <div>
                <h3 class="calc-section-title">
                    <span>⚙️</span>
                    <span>Regole e Coefficienti di Calcolo</span>
                </h3>
                <p class="calc-section-desc">Personalizza i coefficienti per il calcolo del Ranking Storico perpetuo. Le modifiche salvate ricalcolano automaticamente e all'istante la classifica completa della lega.</p>
            </div>
        </div>

        <!-- ACTION BAR SEZIONE REGOLE RANKING -->
        <div class="calc-actions-bar" style="margin-top: 14px; margin-bottom: 16px;">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes" id="badgeRankingRulesChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>
            <div class="calc-actions-buttons">
                <button type="button" class="calc-btn-action calc-btn-cancel" id="btnResetRankingRules" disabled onclick="ripristinaRegoleRanking()">
                    <span>Annulla</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveRankingRules" disabled onclick="salvaRegoleRanking()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva Regole Ranking</span>
                </button>
            </div>
        </div>

        <!-- FORM PARAMETRI RANKING -->
        <form id="rankingRulesForm" onsubmit="return false;">
            <input type="hidden" name="input_is_percentage" value="1">
            <div class="ranking-grid-3cols">
                <!-- CARD 1: PUNTI PIAZZAMENTO -->
                <div class="ranking-card">
                    <div class="ranking-card-head">
                        <h4 class="ranking-card-title">
                            <span>🥇</span>
                            <span>Punti Piazzamento</span>
                        </h4>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <?php foreach ($masterComps as $mc): 
                            $cId = (int)$mc['ID'];
                            $cName = $mc['Nome'];
                            $cEmoji = $mc['emoji'] ?? '🏆';
                            $clean = strtolower($cName);
                            $isGp = (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false);
                            $isSupercup = (strpos($clean, 'supercoppa') !== false || strpos($clean, 'shield') !== false);
                            $isCup = !$isSupercup && (strpos($clean, 'coppa') !== false || strpos($clean, 'cup') !== false);
                            $isLeague = !$isCup && !$isSupercup && (strpos($clean, 'lega') !== false || strpos($clean, 'campionato') !== false || strpos($clean, 'premier') !== false || strpos($clean, 'serie') !== false);
                        ?>
                            <div class="comp-group-block">
                                <div class="comp-group-title">
                                    <?php echo renderCompLogoWithFallback($cName, $cEmoji, 22, $cId); ?>
                                    <span><?php echo htmlspecialchars($cName); ?></span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">(ID Master <?php echo $cId; ?>)</span>
                                </div>
                                <?php if ($isSupercup): ?>
                                    <div class="param-input-item">
                                        <label class="param-label"><span>🏆 1° Posto (Vincitore)</span><span class="param-default">(def: 10 pt)</span></label>
                                        <input type="number" step="1" name="placement[<?php echo $cId; ?>][1]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][1] ?? 10); ?>" class="calc-input-number">
                                    </div>
                                <?php elseif ($isLeague): ?>
                                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥇 1° Posto</span><span class="param-default">(def: 100 pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][1]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][1] ?? 100); ?>" class="calc-input-number">
                                        </div>
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥈 2° Posto</span><span class="param-default">(def: 70 pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][2]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][2] ?? 70); ?>" class="calc-input-number">
                                        </div>
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥉 3° Posto</span><span class="param-default">(def: 50 pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][3]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][3] ?? 50); ?>" class="calc-input-number">
                                        </div>
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🎖️ 4° Posto</span><span class="param-default">(def: 30 pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][4]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][4] ?? 30); ?>" class="calc-input-number">
                                        </div>
                                    </div>
                                <?php else: 
                                    $def1 = $isGp ? 30 : 50;
                                    $def2 = $isGp ? 15 : 30;
                                    $def3 = $isGp ? 5 : 15;
                                ?>
                                    <div class="comp-podium-grid">
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥇 1° Posto</span><span class="param-default">(def: <?php echo $def1; ?> pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][1]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][1] ?? $def1); ?>" class="calc-input-number">
                                        </div>
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥈 2° Posto</span><span class="param-default">(def: <?php echo $def2; ?> pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][2]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][2] ?? $def2); ?>" class="calc-input-number">
                                        </div>
                                        <div class="param-input-item">
                                            <label class="param-label"><span>🥉 3° Posto</span><span class="param-default">(def: <?php echo $def3; ?> pt)</span></label>
                                            <input type="number" step="1" name="placement[<?php echo $cId; ?>][3]" value="<?php echo htmlspecialchars($cfgRanking['placement'][$cId][3] ?? $def3); ?>" class="calc-input-number">
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <?php
                $isUniformVenue = true;
                foreach ($masterComps as $mc) {
                    $cId = (int)$mc['ID'];
                    $clean = strtolower($mc['Nome'] ?? '');
                    if (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false) continue;
                    $mH = getCompetitionMatchVenueParams($cfgRanking, $cId, 'home');
                    $mA = getCompetitionMatchVenueParams($cfgRanking, $cId, 'away');
                    $mN = getCompetitionMatchVenueParams($cfgRanking, $cId, 'neutral');
                    if ($mH['win'] != $mA['win'] || $mH['draw'] != $mA['draw'] || $mH['loss'] != $mA['loss'] ||
                        $mH['gf'] != $mA['gf'] || $mH['gs'] != $mA['gs'] ||
                        $mH['win'] != $mN['win'] || $mH['draw'] != $mN['draw'] || $mH['loss'] != $mN['loss'] ||
                        $mH['gf'] != $mN['gf'] || $mH['gs'] != $mN['gs']) {
                        $isUniformVenue = false;
                        break;
                    }
                }
                ?>
                <!-- CARD 2: PUNTI PARTITA E RETI -->
                <div class="ranking-card">
                    <div class="ranking-card-head" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <h4 class="ranking-card-title" style="margin: 0;">
                            <span>⚽</span>
                            <span>Partite &amp; Differenza Reti</span>
                        </h4>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <button type="button" class="pill-btn btn-copia-tutti" onclick="copiaValoriCasaTutti()" style="padding: 4px 10px; font-size: 0.74rem; line-height: 1; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); <?php if ($isUniformVenue) echo 'display:none;'; ?>" title="Copia i valori di Casa su Trasferta e Neutro per tutte le competizioni">
                                📋 Copia Casa a tutti
                            </button>
                            <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; margin: 0; background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: var(--radius-sm, 6px); padding: 5px 12px; color: var(--text-primary); user-select: none;" title="Seleziona per utilizzare gli stessi valori per tutte le sedi di gara (Casa, Trasferta, Neutro). Deseleziona per configurare valori differenziati.">
                                <input type="checkbox" id="chkUniformaVenue" onchange="toggleUniformaVenue(this.checked)" <?php if ($isUniformVenue) echo 'checked'; ?> style="width: 16px; height: 16px; accent-color: var(--accent-primary, #3b82f6); cursor: pointer;">
                                <span>Uniforma Casa / Neutro / Trasferta</span>
                            </label>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <?php foreach ($masterComps as $mc): 
                            $cId = (int)$mc['ID'];
                            $cName = $mc['Nome'];
                            $cEmoji = $mc['emoji'] ?? '⚽';
                            $clean = strtolower($cName);
                            $isGp = (strpos($clean, 'gp') !== false || strpos($clean, 'gran prix') !== false || strpos($clean, 'formula') !== false);
                            if ($isGp) continue; // Competizione a punti senza incontri a calendario

                            $isSupercup = (strpos($clean, 'supercoppa') !== false || strpos($clean, 'shield') !== false);
                            $isCup = !$isSupercup && (strpos($clean, 'coppa') !== false || strpos($clean, 'cup') !== false);
                            $isLeague = !$isCup && !$isSupercup && (strpos($clean, 'lega') !== false || strpos($clean, 'campionato') !== false || strpos($clean, 'premier') !== false || strpos($clean, 'serie') !== false);

                            $defWin = $isLeague ? 2.0 : ($isSupercup ? 1.3 : 1.8);
                            $defDraw = $isLeague ? 1.2 : ($isSupercup ? 1.0 : 1.1);

                            $mHome = getCompetitionMatchVenueParams($cfgRanking, $cId, 'home');
                            $mAway = getCompetitionMatchVenueParams($cfgRanking, $cId, 'away');
                            $mNeutral = getCompetitionMatchVenueParams($cfgRanking, $cId, 'neutral');
                        ?>
                            <div class="comp-group-block" data-comp-id="<?php echo $cId; ?>">
                                <div class="comp-group-title" style="justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <?php echo renderCompLogoWithFallback($cName, $cEmoji, 22, $cId); ?>
                                        <span>Incontri <?php echo htmlspecialchars($cName); ?></span>
                                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">(ID Master <?php echo $cId; ?>)</span>
                                    </div>
                                    <button type="button" class="pill-btn btn-copia-casa" onclick="copiaValoriCasa(<?php echo $cId; ?>)" style="padding: 3px 8px; font-size: 0.72rem; line-height: 1; border: 1px solid var(--border-subtle); background: var(--bg-surface); <?php if ($isUniformVenue) echo 'display:none;'; ?>" title="Copia i valori di Casa anche su Trasferta e Neutro">
                                        📋 Copia Casa &rarr; Trasferta e Neutro
                                    </button>
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                                    <!-- IN CASA (o UNIFICATO se chkUniformaVenue è attivo) -->
                                    <div class="venue-block-home" style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px;">
                                        <div class="venue-home-badge" style="font-size: 0.76rem; font-weight: 700; color: var(--accent-emerald, #10b981); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                            <?php if ($isUniformVenue): ?>
                                                <span>⚽</span>
                                                <span>Valori Partita (Tutti i campi: Casa, Trasferta, Neutro)</span>
                                            <?php else: ?>
                                                <span>🏠</span>
                                                <span>In Casa</span>
                                            <?php endif; ?>
                                        </div>
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px;">
                                            <div class="param-input-item">
                                                <label class="param-label"><span>Vittoria</span><span class="param-default">(def: <?php echo $defWin; ?>)</span></label>
                                                <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][home][win]" value="<?php echo htmlspecialchars($mHome['win']); ?>" class="calc-input-number">
                                            </div>
                                            <div class="param-input-item">
                                                <label class="param-label"><span>Pareggio</span><span class="param-default">(def: <?php echo $defDraw; ?>)</span></label>
                                                <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][home][draw]" value="<?php echo htmlspecialchars($mHome['draw']); ?>" class="calc-input-number">
                                            </div>
                                            <div class="param-input-item">
                                                <label class="param-label"><span>Sconfitta</span><span class="param-default">(def: 0.0)</span></label>
                                                <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][home][loss]" value="<?php echo htmlspecialchars($mHome['loss']); ?>" class="calc-input-number">
                                            </div>
                                            <div class="param-input-item">
                                                <label class="param-label"><span>Gol Fatto (+)</span><span class="param-default">(def: +1.3)</span></label>
                                                <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][home][gf]" value="<?php echo htmlspecialchars($mHome['gf']); ?>" class="calc-input-number">
                                            </div>
                                            <div class="param-input-item">
                                                <label class="param-label"><span>Gol Subito (-)</span><span class="param-default">(def: -1.3)</span></label>
                                                <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][home][gs]" value="<?php echo htmlspecialchars($mHome['gs']); ?>" class="calc-input-number">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- BLOCCHI DIFFERENZIATI: IN TRASFERTA E CAMPO NEUTRO -->
                                    <div class="venue-differentiated" style="<?php echo $isUniformVenue ? 'display: none;' : 'display: flex; flex-direction: column; gap: 8px;'; ?>">
                                        <!-- IN TRASFERTA -->
                                        <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px;">
                                            <div style="font-size: 0.76rem; font-weight: 700; color: var(--accent-cyan, #06b6d4); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                                <span>✈️</span>
                                                <span>In Trasferta</span>
                                            </div>
                                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px;">
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Vittoria</span><span class="param-default">(def: <?php echo $defWin; ?>)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][away][win]" value="<?php echo htmlspecialchars($mAway['win']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Pareggio</span><span class="param-default">(def: <?php echo $defDraw; ?>)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][away][draw]" value="<?php echo htmlspecialchars($mAway['draw']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Sconfitta</span><span class="param-default">(def: 0.0)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][away][loss]" value="<?php echo htmlspecialchars($mAway['loss']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Gol Fatto (+)</span><span class="param-default">(def: +1.3)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][away][gf]" value="<?php echo htmlspecialchars($mAway['gf']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Gol Subito (-)</span><span class="param-default">(def: -1.3)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][away][gs]" value="<?php echo htmlspecialchars($mAway['gs']); ?>" class="calc-input-number">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- CAMPO NEUTRO -->
                                        <div style="border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px;">
                                            <div style="font-size: 0.76rem; font-weight: 700; color: var(--accent-gold, #f59e0b); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                                <span>⚖️</span>
                                                <span>Campo Neutro</span>
                                            </div>
                                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px;">
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Vittoria</span><span class="param-default">(def: <?php echo $defWin; ?>)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][neutral][win]" value="<?php echo htmlspecialchars($mNeutral['win']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Pareggio</span><span class="param-default">(def: <?php echo $defDraw; ?>)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][neutral][draw]" value="<?php echo htmlspecialchars($mNeutral['draw']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Sconfitta</span><span class="param-default">(def: 0.0)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][neutral][loss]" value="<?php echo htmlspecialchars($mNeutral['loss']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Gol Fatto (+)</span><span class="param-default">(def: +1.3)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][neutral][gf]" value="<?php echo htmlspecialchars($mNeutral['gf']); ?>" class="calc-input-number">
                                                </div>
                                                <div class="param-input-item">
                                                    <label class="param-label"><span>Gol Subito (-)</span><span class="param-default">(def: -1.3)</span></label>
                                                    <input type="number" step="0.1" name="matches[<?php echo $cId; ?>][neutral][gs]" value="<?php echo htmlspecialchars($mNeutral['gs']); ?>" class="calc-input-number">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <!-- Valori Globali di Fallback per le Reti -->
                        <input type="hidden" name="goals[gf]" value="<?php echo htmlspecialchars($cfgRanking['goals']['gf'] ?? 1.3); ?>">
                        <input type="hidden" name="goals[gs]" value="<?php echo htmlspecialchars($cfgRanking['goals']['gs'] ?? -1.3); ?>">

                        <!-- Eliminazione diretta / Supplementari e Rigori -->
                        <div class="comp-group-block" style="background: rgba(6, 182, 212, 0.08); border-color: rgba(6, 182, 212, 0.3);">
                            <div class="comp-group-title">
                                <span>⏱️</span>
                                <span>Eliminazione Diretta (Supplementari e Rigori)</span>
                            </div>
                            <div class="param-input-item">
                                <label class="param-label">
                                    <span>Conteggio Esito &amp; Reti</span>
                                    <span class="param-default">(Standard: Tempi Regolamentari)</span>
                                </label>
                                <select name="extra_time_mode" class="calc-input-select" style="width:100%;font-weight:700;">
                                    <option value="regular_only" <?php echo ($cfgRanking['extra_time_mode'] ?? 'regular_only') === 'regular_only' ? 'selected' : ''; ?>>
                                        Tempi Regolamentari (Consigliato / Standard UEFA - esclude supplementari e rigori)
                                    </option>
                                    <option value="with_supp_no_rig" <?php echo ($cfgRanking['extra_time_mode'] ?? '') === 'with_supp_no_rig' ? 'selected' : ''; ?>>
                                        Includi Supplementari (120') - esclude rigori (rigori = pareggio)
                                    </option>
                                    <option value="with_all" <?php echo ($cfgRanking['extra_time_mode'] ?? '') === 'with_all' ? 'selected' : ''; ?>>
                                        Includi Tutto (Supplementari e Rigori contano come gol ed esito)
                                    </option>
                                </select>
                            </div>
                            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;line-height:1.4;">
                                Nello standard ufficiale UEFA, le gare a eliminazione diretta decise ai calci di rigore sono registrate come pareggio e i tiri dal dischetto non alterano la differenza reti.
                            </div>
                        </div>

                        <div class="ranking-callout-info">
                            <span>💡</span>
                            <span>I punti incontro e i gol fatti/subiti vengono calcolati per ogni partita disputata (esclusi eventuali rigori di spareggio) e moltiplicati per il coefficiente di ponderazione stagionale.</span>
                        </div>
                    </div>
                </div>

                <!-- CARD 3: PONDERAZIONE TEMPORALE (DECAY) -->
                <div class="ranking-card">
                    <div class="ranking-card-head">
                        <h4 class="ranking-card-title">
                            <span>⏳</span>
                            <span>Ponderazione Stagionale (Decay)</span>
                        </h4>
                    </div>

                    <p style="font-size: 0.8rem; color: var(--text-secondary, #94a3b8); margin: 0 0 14px 0; line-height: 1.45;">
                        Percentuale di peso (da <strong>0</strong> a <strong>100%</strong>) applicata in base all'anzianità della stagione (es. <strong>100</strong> per 100%, <strong>50</strong> per 50%, <strong>0</strong> per escludere).
                    </p>

                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <!-- Stagione 0 (in corso) -->
                        <div class="decay-row">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title">Stagione in corso (0 fa)</span>
                                <span class="decay-label-sub">Punteggio pieno stagione corrente</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="decay[0]" value="<?php echo $toPct($cfgRanking['decay'][0] ?? 1.0); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Stagione -1 -->
                        <div class="decay-row">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title">1 stagione fa (-1)</span>
                                <span class="decay-label-sub">Precedente immediata (def: 100%)</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="decay[1]" value="<?php echo $toPct($cfgRanking['decay'][1] ?? 1.0); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Stagione -2 -->
                        <div class="decay-row">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title">2 stagioni fa (-2)</span>
                                <span class="decay-label-sub">2 anni fa (def: 75%)</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="decay[2]" value="<?php echo $toPct($cfgRanking['decay'][2] ?? 0.75); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Stagione -3 -->
                        <div class="decay-row">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title">3 stagioni fa (-3)</span>
                                <span class="decay-label-sub">3 anni fa (def: 50%)</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="decay[3]" value="<?php echo $toPct($cfgRanking['decay'][3] ?? 0.50); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Stagione -4 -->
                        <div class="decay-row">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title">4 stagioni fa (-4)</span>
                                <span class="decay-label-sub">4 anni fa (def: 25%)</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="decay[4]" value="<?php echo $toPct($cfgRanking['decay'][4] ?? 0.25); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Stagioni antecedenti alla -4 -->
                        <div class="decay-row decay-row-older">
                            <div class="decay-label-wrap">
                                <span class="decay-label-title" style="color: var(--accent-cyan, #06b6d4);">Stagioni antecedenti alla -4</span>
                                <span class="decay-label-sub">Da 5 o più anni fa in poi (def: 0%)</span>
                            </div>
                            <div class="decay-input-wrap">
                                <div class="pct-input-wrap">
                                    <input type="number" step="1" min="0" max="100" name="older_decay" value="<?php echo $toPct($cfgRanking['older_decay'] ?? 0.0); ?>" class="calc-input-number">
                                    <span class="pct-addon">%</span>
                                </div>
                            </div>
                        </div>

                        <?php if (count($stagioniDisponibili) > 5): ?>
                            <!-- Dettaglio singole stagioni passate -->
                            <details style="margin-top: 8px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); border-radius: 8px; padding: 10px 12px; background: rgba(255,255,255,0.015);">
                                <summary style="cursor: pointer; color: var(--accent-cyan, #06b6d4); font-size: 0.82rem; font-weight: 700; outline: none; user-select: none;">
                                    ⚙️ Dettaglio singole stagioni passate (-5, -6, ...)
                                </summary>
                                <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
                                    <?php 
                                    for ($age = 5; $age < count($stagioniDisponibili); $age++): 
                                        $sId = $latestSeason - $age;
                                        if ($sId < 1) break;
                                        $specificVal = $cfgRanking['decay'][$age] ?? null;
                                    ?>
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                                            <label style="font-size: 0.78rem; color: var(--text-secondary);">Stagione <?php echo $sId; ?> (-<?php echo $age; ?> anni):</label>
                                            <div class="decay-input-wrap">
                                                <div class="pct-input-wrap">
                                                    <input type="number" step="1" min="0" max="100" name="decay[<?php echo $age; ?>]" placeholder="<?php echo $toPct($cfgRanking['older_decay'] ?? 0); ?>" value="<?php echo ($specificVal !== null) ? $toPct($specificVal) : ''; ?>" class="calc-input-number">
                                                    <span class="pct-addon">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    <?php endfor; ?>
                                </div>
                            </details>
                        <?php endif; ?>

                        <div style="font-size: 0.73rem; color: var(--text-muted, #64748b); margin-top: 8px; line-height: 1.35;">
                            * Il valore per le stagioni antecedenti alla -4 fa da base predefinita per ogni stagione con più di 4 anni di anzianità.
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </section>

    <!-- SEZIONE 1b: LOGHI E ICONE COMPETIZIONI -->
    <section class="calc-card-section">
        <div class="calc-section-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
                <h3 class="calc-section-title">
                    <span>🖼️</span>
                    <span>Loghi e Icone Competizioni</span>
                </h3>
                <p class="calc-section-desc">
                    Imposta il logo associato a ciascuna competizione nel sito (Albo d'Oro, Ranking, Archivio, Rose, Confronti e Classifica Perpetua). Puoi scegliere uno dei loghi di default della skin (<strong>Scudetto</strong>, <strong>Coppa</strong>, <strong>Supercoppa</strong>, <strong>GP</strong>), caricare un logo personalizzato oppure mantenere il riconoscimento automatico dal nome.
                </p>
            </div>
            <div style="background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: var(--radius-sm, 6px); padding: 8px 12px; font-size: 0.78rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 8px;">
                <span>📐</span>
                <span>Dimensioni consigliate logo custom: <strong>250×250 px</strong> (PNG trasparente, WEBP, JPG, GIF)</span>
            </div>
        </div>

        <!-- ACTION BAR SEZIONE LOGHI COMPETIZIONI -->
        <div class="calc-actions-bar" style="margin-top: 14px; margin-bottom: 16px;">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes" id="badgeCompLogosChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>
            <div class="calc-actions-buttons">
                <button type="button" class="calc-btn-action calc-btn-cancel" id="btnResetCompLogos" disabled onclick="ripristinaLoghiCompetizioni()">
                    <span>Annulla</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveCompLogos" disabled onclick="salvaLoghiCompetizioni()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva Loghi Competizioni</span>
                </button>
            </div>
        </div>

        <form id="competitionLogosForm" onsubmit="return false;">
            <div class="table-responsive">
                <table class="calc-mapping-table">
                    <thead>
                        <tr>
                            <th style="width: 70px; text-align: center;">ID Master</th>
                            <th>Competizione Master</th>
                            <th style="width: 110px; text-align: center;">Anteprima</th>
                            <th>Logo / Icona Selezionata</th>
                            <th style="width: 125px; text-align: center;">Stato</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($masterComps)): ?>
                            <tr>
                                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 22px;">
                                    Nessuna competizione trovata nell'Albo d'Oro o negli archivi.
                                </td>
                            </tr>
                        <?php else: 
                            $defaultSkinLabels = [
                                'ico-scudetto.gif'   => '🛡️ Scudetto / Campionato (ico-scudetto.gif)',
                                'ico-coppa.gif'      => '🏆 Coppa / Torneo (ico-coppa.gif)',
                                'ico-supercoppa.gif' => '⚡ Supercoppa / Shield (ico-supercoppa.gif)',
                                'ico-gp.gif'         => '🏎️ Gran Premio / Formula GP (ico-gp.gif)',
                            ];
                            $defaultSkinShortLabels = [
                                'ico-scudetto.gif'   => 'Scudetto',
                                'ico-coppa.gif'      => 'Coppa',
                                'ico-supercoppa.gif' => 'Supercoppa',
                                'ico-gp.gif'         => 'GP',
                            ];
                        ?>
                            <?php foreach ($masterComps as $mc):
                                $cId = (int)$mc['ID'];
                                $cName = $mc['Nome'];
                                $autoIcon = $mc['autoIcon'] ?? 'ico-coppa.gif';
                                $customIcon = $mc['customIcon'] ?? '';
                                $effectiveIcon = $mc['icon'] ?? $autoIcon;
                                $origVal = ($customIcon !== '') ? $customIcon : 'auto';
                                $autoShortLabel = $defaultSkinShortLabels[$autoIcon] ?? $autoIcon;
                                $isCustomUploaded = (strpos($customIcon, 'comp_logos/') === 0);
                                $isManualDefault = ($customIcon !== '' && !$isCustomUploaded);
                            ?>
                                <tr class="comp-logo-row" data-comp-id="<?php echo $cId; ?>">
                                    <td style="text-align: center; font-weight: 700; color: var(--text-muted);">
                                        #<?php echo $cId; ?>
                                    </td>
                                    <td>
                                        <div style="font-weight: 800; color: var(--text-primary); font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                                            <?php echo renderCompLogoWithFallback($cName, $mc['emoji'] ?? '🏆', 20, $cId); ?>
                                            <span><?php echo htmlspecialchars($cName); ?></span>
                                        </div>
                                        <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 3px;">
                                            Riconoscimento automatico dal nome: <strong><?php echo htmlspecialchars($autoShortLabel); ?></strong> (<code><?php echo htmlspecialchars($autoIcon); ?></code>)
                                        </div>
                                    </td>
                                    <td style="text-align: center;">
                                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 6px 10px; min-width: 56px; height: 42px;">
                                            <img id="compLogoPreview_<?php echo $cId; ?>" src="../img/<?php echo htmlspecialchars($effectiveIcon); ?>" alt="<?php echo htmlspecialchars($cName); ?>" style="max-height: 28px; max-width: 44px; width: auto; height: auto; object-fit: contain;" onerror="this.onerror=null;this.src='../img/ico-coppa.gif';" />
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <label for="compLogoSelect_<?php echo $cId; ?>" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;">Logo per <?php echo htmlspecialchars($cName); ?></label>
                                            <select id="compLogoSelect_<?php echo $cId; ?>" name="logos[<?php echo $cId; ?>]" class="calc-input-select comp-logo-select" style="flex: 1; min-width: 220px; max-width: 340px;" data-comp-id="<?php echo $cId; ?>" data-original="<?php echo htmlspecialchars($origVal); ?>" data-auto-icon="<?php echo htmlspecialchars($autoIcon); ?>" onchange="onCompLogoSelectChange(this)">
                                                <option value="auto" <?php echo ($origVal === 'auto') ? 'selected' : ''; ?>>
                                                    🤖 Automatico da nome: <?php echo htmlspecialchars($autoShortLabel); ?> (<?php echo htmlspecialchars($autoIcon); ?>)
                                                </option>
                                                <optgroup label="── Loghi di Default della Skin ──">
                                                    <?php foreach ($defaultSkinLabels as $iconFile => $iconLabel): ?>
                                                        <option value="<?php echo htmlspecialchars($iconFile); ?>" <?php echo ($origVal === $iconFile) ? 'selected' : ''; ?>>
                                                            <?php echo htmlspecialchars($iconLabel); ?>
                                                        </option>
                                                    <?php endforeach; ?>
                                                </optgroup>
                                                <optgroup label="── Loghi Custom Caricati ──" class="comp-custom-logos-optgroup">
                                                    <?php foreach ($uploadedCompLogos as $relPath => $fileName): ?>
                                                        <option value="<?php echo htmlspecialchars($relPath); ?>" <?php echo ($origVal === $relPath) ? 'selected' : ''; ?>>
                                                            🖼️ Custom: <?php echo htmlspecialchars($fileName); ?>
                                                        </option>
                                                    <?php endforeach; ?>
                                                </optgroup>
                                            </select>

                                            <button type="button" class="pill-btn" id="btnUploadCompLogo_<?php echo $cId; ?>" onclick="triggerCompLogoUpload(<?php echo $cId; ?>)" style="padding: 6px 12px; font-size: 0.78rem; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); color: var(--text-primary); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; min-height: 36px;" title="Carica un file immagine personalizzato (consigliato 250×250 px — PNG, JPG, WEBP, GIF)">
                                                <span>📁 Carica Custom (250×250px)</span>
                                            </button>
                                            <button type="button" class="pill-btn" id="btnDeleteCompLogo_<?php echo $cId; ?>" onclick="deleteSelectedCompLogo(<?php echo $cId; ?>)" style="padding: 6px 10px; font-size: 0.78rem; border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); color: var(--accent-crimson, #ef4444); display: <?php echo $isCustomUploaded ? 'inline-flex' : 'none'; ?>; align-items: center; gap: 4px; cursor: pointer; min-height: 36px;" title="Elimina definitivamente questo logo custom dal server">
                                                <span>🗑️ Elimina Custom</span>
                                            </button>
                                            <input type="file" id="compLogoFile_<?php echo $cId; ?>" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;" onchange="handleCompLogoUpload(this, <?php echo $cId; ?>)" />
                                        </div>
                                    </td>
                                    <td style="text-align: center;">
                                        <?php if ($isCustomUploaded): ?>
                                            <span class="franchise-status-pill pill-manual" id="statusCompLogoPill_<?php echo $cId; ?>" style="background: rgba(168, 85, 247, 0.14); color: var(--accent-purple, #a855f7); border-color: rgba(168, 85, 247, 0.3);">
                                                🟣 Custom
                                            </span>
                                        <?php elseif ($isManualDefault): ?>
                                            <span class="franchise-status-pill pill-manual" id="statusCompLogoPill_<?php echo $cId; ?>">
                                                🔵 Default Skin
                                            </span>
                                        <?php else: ?>
                                            <span class="franchise-status-pill pill-auto" id="statusCompLogoPill_<?php echo $cId; ?>">
                                                🟢 Auto
                                            </span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <!-- GESTIONE LOGHI CUSTOM CARICATI SUL SERVER -->
            <div id="customCompLogosGalleryWrap" style="margin-top: 14px; padding: 12px 16px; background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: var(--radius-sm, 6px); display: <?php echo !empty($uploadedCompLogos) ? 'block' : 'none'; ?>;">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <span>🗂️ Loghi Custom presenti sul server (<code>img/comp_logos/</code>)</span>
                    <span style="font-weight: 500; color: var(--text-muted);">Puoi rimuovere i file caricati non più utilizzati</span>
                </div>
                <div id="customCompLogosGalleryList" style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <?php foreach ($uploadedCompLogos as $relPath => $fileName): ?>
                        <div class="custom-logo-chip" data-logo-value="<?php echo htmlspecialchars($relPath); ?>" style="display: inline-flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm, 6px); padding: 5px 10px; font-size: 0.8rem;">
                            <img src="../img/<?php echo htmlspecialchars($relPath); ?>" alt="<?php echo htmlspecialchars($fileName); ?>" style="width: 24px; height: 24px; object-fit: contain;" />
                            <span style="color: var(--text-primary); font-weight: 600;"><?php echo htmlspecialchars($fileName); ?></span>
                            <button type="button" onclick="deleteCustomCompLogoByValue('<?php echo htmlspecialchars(addslashes($relPath)); ?>')" style="background: transparent; border: none; color: var(--accent-crimson, #ef4444); cursor: pointer; padding: 2px 4px; font-size: 0.85rem; line-height: 1;" title="Elimina <?php echo htmlspecialchars($fileName); ?> dal server">
                                🗑️
                            </button>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </form>
    </section>

    <!-- SEZIONE 2: MAPPATURA FRANCHIGIE STORICHE -->
    <section class="calc-card-section">
        <div class="calc-section-header">
            <div>
                <h3 class="calc-section-title">
                    <span>🔗</span>
                    <span>Mappatura e Continuità Franchigie Storiche</span>
                </h3>
                <p class="calc-section-desc">
                    Associa le fantasquadre di ciascuna stagione alla rispettiva franchigia master dell'Albo d'Oro. Il sistema riconosce in automatico la continuità storica tramite presidente e albi, ma puoi sovrascrivere o personalizzare qualsiasi associazione.
                </p>
            </div>
        </div>

        <!-- ACTION BAR SEZIONE FRANCHIGIE -->
        <div class="calc-actions-bar" style="margin-top: 14px; margin-bottom: 16px;">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes" id="badgeFranchiseChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>
            <div class="calc-actions-buttons">
                <button type="button" class="calc-btn-action calc-btn-cancel" id="btnResetFranchiseMap" disabled onclick="ripristinaMappaFranchigie()">
                    <span>Annulla</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveFranchiseMap" disabled onclick="salvaMappaFranchigie()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva Mappatura Franchigie</span>
                </button>
            </div>
        </div>

        <!-- TOOLBAR STAGIONE & RICERCA -->
        <div class="assoc-toolbar" style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label for="selectStagioneFranchigie" style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 6px;">
                    <span>📅</span>
                    <span>Stagione:</span>
                </label>
                <select id="selectStagioneFranchigie" onchange="mostraStagioneFranchigie(this.value)" class="calc-input-select" style="min-width: 240px; font-weight: 700;">
                    <?php foreach ($stagioniDisponibili as $stg): ?>
                        <option value="<?php echo (int)$stg['id']; ?>">
                            Stagione <?php echo (int)$stg['id']; ?> (<?php echo htmlspecialchars($stg['anni_stagione']); ?> - <?php echo htmlspecialchars($stg['nome_lega']); ?>)
                        </option>
                    <?php endforeach; ?>
                </select>

                <!-- Badge contatori stagione attiva -->
                <div style="display: inline-flex; align-items: center; gap: 6px; margin-left: 6px;">
                    <span class="season-stat-badge" title="Fantasquadre presenti in questa stagione">
                        👥 Squadre: <strong id="statSeasonTotal">0</strong>
                    </span>
                    <span class="season-stat-badge stat-auto" title="Squadre con associazione automatica">
                        🟢 Auto: <strong id="statSeasonAuto">0</strong>
                    </span>
                    <span class="season-stat-badge stat-manual" title="Squadre con override manuale">
                        🟠 Manuali: <strong id="statSeasonManual">0</strong>
                    </span>
                </div>
            </div>

            <!-- Filtri pill e input ricerca rapida -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div class="assoc-filter-pills">
                    <button type="button" class="assoc-pill-btn active" id="btnFilterFranchiseAll" onclick="setFranchiseFilter('all')">
                        Tutte
                    </button>
                    <button type="button" class="assoc-pill-btn pill-doubtful" id="btnFilterFranchiseManual" onclick="setFranchiseFilter('manual')">
                        🟠 Solo Manuali
                    </button>
                    <button type="button" class="assoc-pill-btn pill-confirmed" id="btnFilterFranchiseAuto" onclick="setFranchiseFilter('auto')">
                        🟢 Solo Auto
                    </button>
                </div>
                <div class="assoc-search-wrap">
                    <input type="text" id="franchiseSearchInput" class="assoc-search-input" placeholder="🔍 Cerca squadra o presidente..." oninput="filtraFranchigie()">
                </div>
            </div>
        </div>

        <!-- FORM MAPPATURA FRANCHIGIE -->
        <form id="franchiseMappingForm" onsubmit="return false;">
            <?php foreach ($stagioniDisponibili as $index => $stg): 
                $sNum = (int)$stg['id'];
                $display = ($index === 0) ? 'block' : 'none';
                $squadre = $squadrePerStagione[$sNum] ?? [];
                $stat = $statsStagione[$sNum] ?? ['total' => 0, 'auto' => 0, 'manual' => 0];
            ?>
                <div class="stagione-franchigie-box" id="boxStagione_<?php echo $sNum; ?>" data-season="<?php echo $sNum; ?>" data-total="<?php echo $stat['total']; ?>" data-auto="<?php echo $stat['auto']; ?>" data-manual="<?php echo $stat['manual']; ?>" style="display: <?php echo $display; ?>;">
                    <div class="assoc-table-wrap" style="max-height: none; overflow-y: visible;">
                        <table class="assoc-table" id="tableStagione_<?php echo $sNum; ?>">
                            <thead>
                                <tr>
                                    <th style="width: 70px; text-align: center;">ID Loc.</th>
                                    <th>Squadra Stagione <?php echo $sNum; ?></th>
                                    <th>Presidente</th>
                                    <th style="min-width: 320px;">Franchigia Master Albo d'Oro</th>
                                    <th style="width: 140px; text-align: center;">Stato</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($squadre)): ?>
                                    <tr>
                                        <td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">
                                            Nessuna fantasquadra trovata nel database della Stagione <?php echo $sNum; ?>.
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($squadre as $sq): 
                                        $locId = $sq['id'];
                                        $isOver = $sq['isOverridden'];
                                        $origVal = $isOver ? (string)$sq['currentMasterId'] : 'auto';
                                    ?>
                                        <tr class="franchise-row" data-team-name="<?php echo htmlspecialchars(strtolower($sq['nome'])); ?>" data-pres-name="<?php echo htmlspecialchars(strtolower($sq['presidente'])); ?>" data-is-manual="<?php echo $isOver ? '1' : '0'; ?>">
                                            <td style="text-align: center; font-weight: 700; color: var(--text-muted); font-size: 0.8rem;">
                                                #<?php echo $sq['id']; ?>
                                            </td>
                                            <td style="font-weight: 700; color: var(--text-primary);">
                                                <?php echo htmlspecialchars($sq['nome']); ?>
                                            </td>
                                            <td style="color: var(--text-secondary);">
                                                <?php echo htmlspecialchars($sq['presidente'] ?: '—'); ?>
                                            </td>
                                            <td>
                                                <select name="map[<?php echo $sNum; ?>][<?php echo $locId; ?>]" class="calc-input-select franchise-select" style="width: 100%; max-width: 360px;" data-season="<?php echo $sNum; ?>" data-team-id="<?php echo $locId; ?>" data-original="<?php echo $origVal; ?>" data-auto-id="<?php echo $sq['autoMasterId']; ?>" data-auto-name="<?php echo htmlspecialchars($sq['autoMasterName']); ?>" onchange="onFranchiseSelectChange(this)">
                                                    <option value="auto" <?php echo (!$isOver) ? 'selected' : ''; ?>>
                                                        🤖 Automatico: <?php echo htmlspecialchars($sq['autoMasterName']); ?> (ID Master <?php echo $sq['autoMasterId']; ?>)
                                                    </option>
                                                    <optgroup label="── Sovrascrivi Franchigia Master ──">
                                                        <?php foreach ($masterTeams as $mt): ?>
                                                            <option value="<?php echo $mt['ID']; ?>" <?php echo ($isOver && (int)$sq['currentMasterId'] === (int)$mt['ID']) ? 'selected' : ''; ?>>
                                                                <?php echo htmlspecialchars($mt['Nome']); ?> (ID Master <?php echo $mt['ID']; ?>)
                                                            </option>
                                                        <?php endforeach; ?>
                                                    </optgroup>
                                                </select>
                                            </td>
                                            <td style="text-align: center;">
                                                <span class="franchise-status-pill <?php echo $isOver ? 'pill-manual' : 'pill-auto'; ?>" id="statusPill_<?php echo $sNum; ?>_<?php echo $locId; ?>">
                                                    <?php echo $isOver ? '🟠 Manuale' : '🟢 Auto'; ?>
                                                </span>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            <?php endforeach; ?>
        </form>
    </section>

    <!-- SEZIONE 3: MAPPATURA COMPETIZIONI STORICHE -->
    <section class="calc-card-section" style="margin-bottom: 24px;">
        <div class="calc-section-header">
            <div>
                <h3 class="calc-section-title">
                    <span>🏆</span>
                    <span>Mappatura e Continuità Competizioni Storiche</span>
                </h3>
                <p class="calc-section-desc">
                    Associa le competizioni di ciascuna stagione (Campionato, Coppe, Tornei) alle competizioni master dell'Albo d'Oro. Garantisce che i punteggi del Ranking e i trofei siano attribuiti correttamente anche in caso di cambi di ID o denominazione tra le edizioni della lega.
                </p>
            </div>
        </div>

        <!-- ACTION BAR MAPPATURA COMPETIZIONI -->
        <div class="calc-actions-bar" style="margin-top: 14px; margin-bottom: 16px;">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes" id="badgeCompetitionChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>
            <div class="calc-actions-buttons">
                <button type="button" class="calc-btn-action calc-btn-cancel" id="btnResetCompetitionMap" disabled onclick="ripristinaMappaCompetizioni()">
                    <span>Annulla</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveCompetitionMap" disabled onclick="salvaMappaCompetizioni()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva Mappatura Competizioni</span>
                </button>
            </div>
        </div>

        <!-- TOOLBAR STAGIONE & RICERCA COMPETIZIONI -->
        <div class="assoc-toolbar" style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label for="selectStagioneCompetizioni" style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 6px;">
                    <span>📅</span>
                    <span>Stagione:</span>
                </label>
                <select id="selectStagioneCompetizioni" onchange="mostraStagioneCompetizioni(this.value)" class="calc-input-select" style="min-width: 240px; font-weight: 700;">
                    <?php foreach ($stagioniDisponibili as $stg): ?>
                        <option value="<?php echo (int)$stg['id']; ?>">
                            Stagione <?php echo (int)$stg['id']; ?> (<?php echo htmlspecialchars($stg['anni_stagione']); ?> - <?php echo htmlspecialchars($stg['nome_lega']); ?>)
                        </option>
                    <?php endforeach; ?>
                </select>

                <!-- Badge contatori stagione attiva -->
                <div style="display: inline-flex; align-items: center; gap: 6px; margin-left: 6px;">
                    <span class="season-stat-badge" title="Competizioni presenti in questa stagione">
                        🏆 Competizioni: <strong id="statCompSeasonTotal">0</strong>
                    </span>
                    <span class="season-stat-badge stat-auto" title="Competizioni con associazione automatica">
                        🟢 Auto: <strong id="statCompSeasonAuto">0</strong>
                    </span>
                    <span class="season-stat-badge stat-manual" title="Competizioni con override manuale">
                        🟠 Manuali: <strong id="statCompSeasonManual">0</strong>
                    </span>
                </div>
            </div>

            <!-- Filtri pill -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div class="assoc-filter-pills">
                    <button type="button" class="assoc-pill-btn active" id="btnFilterCompAll" onclick="setCompetitionFilter('all')">
                        Tutte
                    </button>
                    <button type="button" class="assoc-pill-btn pill-doubtful" id="btnFilterCompManual" onclick="setCompetitionFilter('manual')">
                        🟠 Solo Manuali
                    </button>
                    <button type="button" class="assoc-pill-btn pill-confirmed" id="btnFilterCompAuto" onclick="setCompetitionFilter('auto')">
                        🟢 Solo Auto
                    </button>
                </div>
            </div>
        </div>

        <!-- FORM MAPPATURA COMPETIZIONI -->
        <form id="competitionMappingForm" onsubmit="return false;">
            <?php foreach ($stagioniDisponibili as $index => $stg): 
                $sNum = (int)$stg['id'];
                $display = ($index === 0) ? 'block' : 'none';
                $comps = $competizioniPerStagione[$sNum] ?? [];
                $stat = $statsCompStagione[$sNum] ?? ['total' => 0, 'auto' => 0, 'manual' => 0];
            ?>
                <div class="stagione-competizioni-box" id="boxStagioneComp_<?php echo $sNum; ?>" style="display: <?php echo $display; ?>;" data-season="<?php echo $sNum; ?>" data-total="<?php echo $stat['total']; ?>" data-auto="<?php echo $stat['auto']; ?>" data-manual="<?php echo $stat['manual']; ?>">
                    <div class="table-responsive">
                        <table class="calc-modern-table" style="width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 70px; text-align: center;">ID Loc</th>
                                    <th>Competizione nella Stagione</th>
                                    <th>Abbinamento Automatico Rilevato</th>
                                    <th style="min-width: 320px;">Competizione Master / Albo di Destinazione</th>
                                    <th style="width: 120px; text-align: center;">Stato</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($comps)): ?>
                                    <tr>
                                        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 22px;">
                                            Nessuna competizione trovata per la Stagione <?php echo $sNum; ?>.
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($comps as $cp): 
                                        $locId = $cp['id'];
                                        $isOver = $cp['isOverridden'];
                                        $origVal = $isOver ? $cp['currentMasterId'] : 'auto';
                                    ?>
                                        <tr class="competition-row" data-season="<?php echo $sNum; ?>" data-comp-id="<?php echo $locId; ?>" data-comp-name="<?php echo htmlspecialchars(strtolower($cp['nome'])); ?>" data-is-manual="<?php echo $isOver ? '1' : '0'; ?>">
                                            <td style="text-align: center; font-weight: 700; color: var(--text-muted);">
                                                #<?php echo $locId; ?>
                                            </td>
                                            <td>
                                                <div style="font-weight: 800; color: var(--text-primary); font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                                                    <?php echo renderCompLogoWithFallback($cp['nome'], '🏆', 18, (int)$cp['currentMasterId']); ?>
                                                    <span><?php echo htmlspecialchars($cp['nome']); ?></span>
                                                </div>
                                                <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                                                    <?php if (($cp['tipo'] ?? '') === 'partite'): ?>
                                                        <span style="color: var(--accent-emerald, #10b981);">⚽ <?php echo (int)($cp['numPartite'] ?? 0); ?> partite a calendario</span>
                                                    <?php else: ?>
                                                        <span style="color: var(--accent-cyan, #06b6d4);">🏆 Albo d'Oro / Piazzamenti a podio</span>
                                                    <?php endif; ?>
                                                </div>
                                            </td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--text-secondary);">
                                                    <?php echo renderCompLogoWithFallback($cp['autoMasterName'], '🤖', 18, (int)$cp['autoMasterId']); ?>
                                                    <span><strong><?php echo htmlspecialchars($cp['autoMasterName']); ?></strong></span>
                                                    <span style="font-size: 0.72rem; color: var(--text-muted);">(ID Master <?php echo $cp['autoMasterId']; ?>)</span>
                                                </div>
                                            </td>
                                            <td>
                                                <select name="map[<?php echo $sNum; ?>][<?php echo $locId; ?>]" class="calc-input-select competition-select" style="width: 100%; max-width: 360px;" data-season="<?php echo $sNum; ?>" data-comp-id="<?php echo $locId; ?>" data-original="<?php echo $origVal; ?>" data-auto-id="<?php echo $cp['autoMasterId']; ?>" data-auto-name="<?php echo htmlspecialchars($cp['autoMasterName']); ?>" onchange="onCompetitionSelectChange(this)">
                                                    <option value="auto" <?php echo (!$isOver) ? 'selected' : ''; ?>>
                                                        🤖 Automatico: <?php echo htmlspecialchars($cp['autoMasterName']); ?> (ID Master <?php echo $cp['autoMasterId']; ?>)
                                                    </option>
                                                    <optgroup label="── Sovrascrivi Competizione Master ──">
                                                        <?php foreach ($masterComps as $mc): ?>
                                                            <option value="<?php echo $mc['ID']; ?>" <?php echo ($isOver && (int)$cp['currentMasterId'] === (int)$mc['ID']) ? 'selected' : ''; ?>>
                                                                <?php echo ($mc['emoji'] ?? '🏆'); ?> <?php echo htmlspecialchars($mc['Nome']); ?> (ID Master <?php echo $mc['ID']; ?>)
                                                            </option>
                                                        <?php endforeach; ?>
                                                        <option value="0" <?php echo ($isOver && (int)$cp['currentMasterId'] === 0) ? 'selected' : ''; ?>>
                                                            🚫 Nessuna / Escludi dallo Storico
                                                        </option>
                                                    </optgroup>
                                                </select>
                                            </td>
                                            <td style="text-align: center;">
                                                <span class="franchise-status-pill <?php echo $isOver ? 'pill-manual' : 'pill-auto'; ?>" id="statusCompPill_<?php echo $sNum; ?>_<?php echo $locId; ?>">
                                                    <?php echo $isOver ? '🟠 Manuale' : '🟢 Auto'; ?>
                                                </span>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            <?php endforeach; ?>
        </form>
    </section>

    <!-- TAB 4 / SEZIONE 4: CARTELLE SITI STORICI ORIGINALI (ARCHIVIO LEGACY) -->
    <section class="calc-card-section" style="margin-bottom: 24px;">
        <div class="calc-section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div class="calc-section-title-wrap">
                <h3 class="calc-section-title" style="display:flex;align-items:center;gap:8px;">
                    <span>🌐</span> Cartelle Siti Storici Originali (Archivio Legacy)
                </h3>
                <p class="calc-section-desc">
                    Configura i percorsi delle cartelle storiche legacy (es. vecchi siti FCM). Il pulsante <strong>"🌐 Sito Originale"</strong> apparirà nelle schede di <code>#archivio</code> solo per le stagioni con cartella configurata.
                </p>
            </div>
        </div>

        <!-- ACTION BAR SEZIONE CARTELLE SITI STORICI (ARCHIVIO LEGACY) -->
        <div class="calc-actions-bar" style="margin-top: 14px; margin-bottom: 16px;">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes" id="badgeLegacyFoldersChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>
            <div class="calc-actions-buttons">
                <button type="button" class="calc-btn-action calc-btn-cancel" id="btnResetLegacyFolders" disabled onclick="ripristinaCartelleLegacy()">
                    <span>Annulla</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveLegacyFolders" disabled onclick="saveLegacyFoldersConfig()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva Configurazione Cartelle Storiche</span>
                </button>
            </div>
        </div>

        <form id="legacyFoldersForm" onsubmit="return false;" style="margin-top:16px;">
            <!-- Toggle globale visualizzazione siti legacy -->
            <div style="background:var(--bg-surface-elevated, #f8fafc);border:1px solid var(--border-subtle, #e2e8f0);border-radius:var(--radius-sm, 6px);padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <label style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:0.9rem;cursor:pointer;margin:0;">
                    <input type="checkbox" id="chkShowLegacySites" name="showLegacySites" value="1" <?php if (!isset($storicoConfig['showLegacySites']) || $storicoConfig['showLegacySites'] !== false) echo 'checked'; ?> style="width:18px;height:18px;accent-color:var(--accent-purple, #a855f7);cursor:pointer;" />
                    <span>Abilita la visualizzazione dei pulsanti "🌐 Sito Originale" nelle schede delle stagioni</span>
                </label>
                <span style="font-size:0.75rem;color:var(--text-muted, #64748b);">Se disattivato, nessun pulsante legacy verrà mostrato sul sito</span>
            </div>

            <!-- Elenco per ciascuna stagione storica conclusa -->
            <div style="display:flex;flex-direction:column;gap:12px;">
                <?php 
                $pastStagioni = array_filter($stagioniDisponibili, function($stg) use ($latestSeason) {
                    return (int)$stg['id'] < $latestSeason;
                });
                foreach ($pastStagioni as $stg): 
                    $sNum = (int)$stg['id'];
                    $sCfg = $storicoConfig['seasons'][(string)$sNum] ?? null;
                    $configuredFolder = $sCfg['folder'] ?? '';
                    $configuredIndex = $sCfg['index'] ?? 'index.php';
                    $sLabel = htmlspecialchars($stg['anni_stagione'] ?? ($stg['anno'] ?? "Stagione $sNum"));
                    $sLeague = htmlspecialchars($stg['nome_lega'] ?? '');
                ?>
                <div class="legacy-season-row" data-season="<?php echo $sNum; ?>" style="background:var(--bg-surface-elevated, #f8fafc);border:1px solid var(--border-subtle, #e2e8f0);border-radius:var(--radius-sm, 6px);padding:12px 16px;display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-weight:800;color:var(--accent-gold, #f59e0b);font-size:0.95rem;"><?php echo $sNum; ?>ª Edizione</span>
                            <span style="font-weight:700;color:var(--text-primary);font-size:0.88rem;">(<?php echo $sLabel; ?>)</span>
                            <?php if ($sLeague): ?>
                                <span style="font-size:0.75rem;color:var(--text-muted);">• <?php echo $sLeague; ?></span>
                            <?php endif; ?>
                        </div>
                        <div>
                            <span class="legacy-status-badge badge-s-<?php echo $sNum; ?>" style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:var(--radius-full, 9999px);background:<?php echo !empty($configuredFolder) ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)'; ?>;color:<?php echo !empty($configuredFolder) ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted, #64748b)'; ?>;">
                                <?php echo !empty($configuredFolder) ? '🟢 Collegato' : '⚪ Nessuna cartella'; ?>
                            </span>
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <!-- Selettore Cartella Rilevata / Manuale -->
                        <div style="flex:2;min-width:240px;">
                            <label style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;display:block;">Cartella sul server:</label>
                            <select class="form-select legacy-folder-select" data-season="<?php echo $sNum; ?>" onchange="onLegacyFolderSelectChange(this)" style="width:100%;font-size:0.85rem;padding:6px 10px;border-radius:var(--radius-sm);">
                                <option value="" <?php if (empty($configuredFolder)) echo 'selected'; ?>>-- Nessuna cartella (disattivato) --</option>
                                <?php 
                                $foundInCandidates = false;
                                $localCandidates = array_filter($legacyCandidates, function($c) { return empty($c['isParent']); });
                                $parentCandidates = array_filter($legacyCandidates, function($c) { return !empty($c['isParent']); });

                                if (!empty($localCandidates)): ?>
                                    <optgroup label="📁 Cartelle nel sito attuale">
                                        <?php foreach ($localCandidates as $c): 
                                            $isSel = ($configuredFolder === $c['folder']);
                                            if ($isSel) $foundInCandidates = true;
                                        ?>
                                            <option value="<?php echo htmlspecialchars($c['folder']); ?>" data-index="<?php echo htmlspecialchars($c['index'] ?: 'index.php'); ?>" <?php if ($isSel) echo 'selected'; ?>>
                                                📁 <?php echo htmlspecialchars($c['folder']); ?><?php if ($c['hasIndex']) echo ' [' . htmlspecialchars($c['index']) . ']'; ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </optgroup>
                                <?php endif; ?>

                                <?php if (!empty($parentCandidates)): ?>
                                    <optgroup label="⬆️ Cartelle sul server (parente / ..)">
                                        <?php foreach ($parentCandidates as $c): 
                                            $isSel = ($configuredFolder === $c['folder']);
                                            if ($isSel) $foundInCandidates = true;
                                        ?>
                                            <option value="<?php echo htmlspecialchars($c['folder']); ?>" data-index="<?php echo htmlspecialchars($c['index'] ?: 'index.php'); ?>" <?php if ($isSel) echo 'selected'; ?>>
                                                ⬆️ <?php echo htmlspecialchars($c['folder']); ?><?php if ($c['hasIndex']) echo ' [' . htmlspecialchars($c['index']) . ']'; ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </optgroup>
                                <?php endif; ?>

                                <option value="__custom__" <?php if (!empty($configuredFolder) && !$foundInCandidates) echo 'selected'; ?>>✍️ Percorso personalizzato / manuale...</option>
                            </select>
                        </div>

                        <!-- Input personalizzato (visibile se __custom__ o percorso non in lista) -->
                        <div class="legacy-custom-wrap-<?php echo $sNum; ?>" style="flex:2;min-width:200px;<?php if (empty($configuredFolder) || $foundInCandidates) echo 'display:none;'; ?>">
                            <label style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;display:block;">Percorso relativo:</label>
                            <input type="text" class="form-control legacy-custom-input" data-season="<?php echo $sNum; ?>" value="<?php echo htmlspecialchars($configuredFolder); ?>" placeholder="es. archivio/2013-14" style="width:100%;font-size:0.85rem;padding:6px 10px;border-radius:var(--radius-sm);" oninput="onLegacyCustomInputChange(this)" />
                        </div>

                        <!-- File Index (rilevato in automatico o personalizzato) -->
                        <div style="flex:1;min-width:130px;">
                            <label style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;display:block;">File di avvio (auto-rilevato):</label>
                            <input type="text" class="form-control legacy-index-input" data-season="<?php echo $sNum; ?>" value="<?php echo htmlspecialchars($configuredIndex); ?>" placeholder="index.php" style="width:100%;font-size:0.85rem;padding:6px 10px;border-radius:var(--radius-sm);" />
                        </div>

                        <!-- Pulsante test link -->
                        <div style="align-self:flex-end;">
                            <button type="button" class="btn btn-sm btn-outline-secondary btn-test-legacy-<?php echo $sNum; ?>" onclick="testLegacyLink(<?php echo $sNum; ?>)" title="Prova ad aprire la cartella in una nuova scheda" style="font-size:0.78rem;padding:6px 10px;min-height:34px;display:inline-flex;align-items:center;gap:4px;" <?php if (empty($configuredFolder)) echo 'disabled'; ?>>
                                <span>🌐 Prova</span>
                            </button>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </form>
    </section>
</div>

<script type="text/javascript">
(function() {
    // -------------------------------------------------------------
    // STATO INIZIALE & CHANGE TRACKING PER LE REGOLE DEL RANKING
    // -------------------------------------------------------------
    var rankingRulesInitialData = '';
    var activeFranchiseFilter = 'all';

    function serializeRankingRules() {
        var form = document.getElementById('rankingRulesForm');
        if (!form) return '';
        var formData = new FormData(form);
        var obj = {};
        formData.forEach(function(val, key) {
            obj[key] = val;
        });
        return JSON.stringify(obj);
    }

    window.checkRankingRulesChanges = function() {
        var currentData = serializeRankingRules();
        var badge = document.getElementById('badgeRankingRulesChanges');
        var btnSave = document.getElementById('btnSaveRankingRules');
        var btnReset = document.getElementById('btnResetRankingRules');

        if (!badge || !btnSave) return;

        var isModified = (currentData !== rankingRulesInitialData);
        if (isModified) {
            badge.className = 'badge-status-changes has-changes';
            badge.innerHTML = '<span>🟡</span> Modifiche alle regole non salvate';
            btnSave.disabled = false;
            if (btnReset) btnReset.disabled = false;
        } else {
            badge.className = 'badge-status-changes no-changes';
            badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
            btnSave.disabled = true;
            if (btnReset) btnReset.disabled = true;
        }
    };

    window.isAllVenuesUniform = function() {
        var form = document.getElementById('rankingRulesForm');
        if (!form) return true;
        var compBlocks = document.querySelectorAll('.comp-group-block[data-comp-id]');
        for (var i = 0; i < compBlocks.length; i++) {
            var cId = compBlocks[i].getAttribute('data-comp-id');
            var fields = ['win', 'draw', 'loss', 'gf', 'gs'];
            for (var j = 0; j < fields.length; j++) {
                var f = fields[j];
                var h = form.elements['matches[' + cId + '][home][' + f + ']'];
                var a = form.elements['matches[' + cId + '][away][' + f + ']'];
                var n = form.elements['matches[' + cId + '][neutral][' + f + ']'];
                if (h && a && n && (h.value !== a.value || h.value !== n.value)) {
                    return false;
                }
            }
        }
        return true;
    };

    window.toggleUniformaVenue = function(isUniform, skipConfirm) {
        var form = document.getElementById('rankingRulesForm');
        if (!form) return;

        if (isUniform && !skipConfirm) {
            if (!isAllVenuesUniform()) {
                if (!confirm('Uniformare tutti i valori copiando quelli di Casa su Trasferta e Campo Neutro?')) {
                    var chk = document.getElementById('chkUniformaVenue');
                    if (chk) chk.checked = false;
                    return;
                }
            }

            // Copia i valori di Casa su Trasferta e Neutro per tutte le competizioni
            var compBlocks = document.querySelectorAll('.comp-group-block[data-comp-id]');
            compBlocks.forEach(function(block) {
                var cId = block.getAttribute('data-comp-id');
                var fields = ['win', 'draw', 'loss', 'gf', 'gs'];
                fields.forEach(function(f) {
                    var h = form.elements['matches[' + cId + '][home][' + f + ']'];
                    if (h) {
                        var a = form.elements['matches[' + cId + '][away][' + f + ']'];
                        var n = form.elements['matches[' + cId + '][neutral][' + f + ']'];
                        if (a) a.value = h.value;
                        if (n) n.value = h.value;
                    }
                });
            });
        }

        // Mostra o nascondi i blocchi differenziati
        var diffBlocks = document.querySelectorAll('.venue-differentiated');
        diffBlocks.forEach(function(el) {
            el.style.display = isUniform ? 'none' : 'flex';
            if (!isUniform) {
                el.style.flexDirection = 'column';
                el.style.gap = '8px';
            }
        });

        // Mostra o nascondi i pulsanti copia
        var copyBtns = document.querySelectorAll('.btn-copia-casa, .btn-copia-tutti');
        copyBtns.forEach(function(btn) {
            btn.style.display = isUniform ? 'none' : 'inline-flex';
        });

        // Aggiorna l'etichetta del blocco Casa/Unificato
        var homeBadges = document.querySelectorAll('.venue-home-badge');
        homeBadges.forEach(function(b) {
            b.innerHTML = isUniform 
                ? '<span>⚽</span><span>Valori Partita (Tutti i campi: Casa, Trasferta, Neutro)</span>' 
                : '<span>🏠</span><span>In Casa</span>';
        });

        if (typeof checkRankingRulesChanges === 'function') {
            checkRankingRulesChanges();
        }
    };

    window.ripristinaRegoleRanking = function() {
        if (!rankingRulesInitialData) return;
        var initialObj = JSON.parse(rankingRulesInitialData);
        var form = document.getElementById('rankingRulesForm');
        if (!form) return;

        for (var key in initialObj) {
            var elem = form.elements[key];
            if (elem) elem.value = initialObj[key];
        }
        var chk = document.getElementById('chkUniformaVenue');
        if (chk) {
            chk.checked = isAllVenuesUniform();
            toggleUniformaVenue(chk.checked, true);
        }
        checkRankingRulesChanges();
        if (typeof showToast === 'function') {
            showToast('Regole ripristinate ai valori iniziali.', 'info');
        }
    };

    function getRankingCsrfHeaders() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        var token = meta ? meta.getAttribute('content') : '';
        return token ? { 'X-CSRF-Token': token } : {};
    }

    window.salvaRegoleRanking = function() {
        var form = document.getElementById('rankingRulesForm');
        var btnSave = document.getElementById('btnSaveRankingRules');
        if (!form || !btnSave) return;

        btnSave.disabled = true;
        var originalBtnHtml = btnSave.innerHTML;
        btnSave.innerHTML = '<span>⏳ Salvataggio &amp; Ricalcolo...</span>';

        var formData = new FormData(form);
        formData.append('action', 'save_ranking_config');

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                rankingRulesInitialData = serializeRankingRules();
                checkRankingRulesChanges();
                if (typeof showToast === 'function') {
                    showToast('✅ ' + data.message, 'success');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast('❌ Errore: ' + (data.error || 'Errore salvataggio'), 'error');
                }
                checkRankingRulesChanges();
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            }
            checkRankingRulesChanges();
        })
        .finally(function() {
            btnSave.innerHTML = originalBtnHtml;
        });
    };

    window.copiaValoriCasa = function(cId, silent) {
        var form = document.getElementById('rankingRulesForm');
        if (!form) return;
        var fields = ['win', 'draw', 'loss', 'gf', 'gs'];
        fields.forEach(function(f) {
            var homeInput = form.elements['matches[' + cId + '][home][' + f + ']'];
            if (homeInput) {
                var val = homeInput.value;
                var awayInput = form.elements['matches[' + cId + '][away][' + f + ']'];
                var neutralInput = form.elements['matches[' + cId + '][neutral][' + f + ']'];
                if (awayInput) awayInput.value = val;
                if (neutralInput) neutralInput.value = val;
            }
        });
        if (typeof checkRankingRulesChanges === 'function') {
            checkRankingRulesChanges();
        }
        if (!silent && typeof showToast === 'function') {
            showToast('Valori di Casa copiati su Trasferta e Neutro.', 'info');
        }
    };

    window.copiaValoriCasaTutti = function() {
        var compBlocks = document.querySelectorAll('.comp-group-block[data-comp-id]');
        compBlocks.forEach(function(b) {
            var cId = b.getAttribute('data-comp-id');
            if (cId) {
                copiaValoriCasa(cId, true);
            }
        });
        if (typeof checkRankingRulesChanges === 'function') {
            checkRankingRulesChanges();
        }
        if (typeof showToast === 'function') {
            showToast('Valori di Casa copiati su Trasferta e Neutro per tutte le competizioni.', 'info');
        }
    };

    // -------------------------------------------------------------
    // GESTIONE SELEZIONE E FILTRI MAPPATURA FRANCHIGIE
    // -------------------------------------------------------------
    window.mostraStagioneFranchigie = function(sNum) {
        var boxes = document.querySelectorAll('.stagione-franchigie-box');
        boxes.forEach(function(b) {
            b.style.display = 'none';
        });
        var target = document.getElementById('boxStagione_' + sNum);
        if (target) {
            target.style.display = 'block';
            aggiornaContatoriStagione(sNum);
            filtraFranchigie();
        }
    };

    window.aggiornaContatoriStagione = function(sNum) {
        var box = document.getElementById('boxStagione_' + sNum);
        if (!box) return;

        var total = 0;
        var manual = 0;
        var auto = 0;

        var selects = box.querySelectorAll('.franchise-select');
        total = selects.length;
        selects.forEach(function(sel) {
            var val = sel.value;
            if (val === 'auto') {
                auto++;
            } else {
                manual++;
            }
        });

        var elTotal = document.getElementById('statSeasonTotal');
        var elAuto = document.getElementById('statSeasonAuto');
        var elManual = document.getElementById('statSeasonManual');

        if (elTotal) elTotal.textContent = total;
        if (elAuto) elAuto.textContent = auto;
        if (elManual) elManual.textContent = manual;
    };

    window.onFranchiseSelectChange = function(selectElem) {
        var sNum = selectElem.getAttribute('data-season');
        var locId = selectElem.getAttribute('data-team-id');
        var origVal = selectElem.getAttribute('data-original');
        var currentVal = selectElem.value;
        var pill = document.getElementById('statusPill_' + sNum + '_' + locId);
        var row = selectElem.closest('.franchise-row');

        if (pill) {
            if (currentVal !== origVal) {
                pill.className = 'franchise-status-pill pill-modified';
                pill.innerHTML = '✏️ Modificato';
                if (row) row.setAttribute('data-is-manual', currentVal === 'auto' ? '0' : '1');
            } else {
                if (origVal === 'auto') {
                    pill.className = 'franchise-status-pill pill-auto';
                    pill.innerHTML = '🟢 Auto';
                    if (row) row.setAttribute('data-is-manual', '0');
                } else {
                    pill.className = 'franchise-status-pill pill-manual';
                    pill.innerHTML = '🟠 Manuale';
                    if (row) row.setAttribute('data-is-manual', '1');
                }
            }
        }

        aggiornaContatoriStagione(sNum);
        checkFranchiseChanges();
        filtraFranchigie();
    };

    window.checkFranchiseChanges = function() {
        var allSelects = document.querySelectorAll('.franchise-select');
        var modifiedCount = 0;

        allSelects.forEach(function(sel) {
            if (sel.value !== sel.getAttribute('data-original')) {
                modifiedCount++;
            }
        });

        var badge = document.getElementById('badgeFranchiseChanges');
        var btnSave = document.getElementById('btnSaveFranchiseMap');
        var btnReset = document.getElementById('btnResetFranchiseMap');

        if (!badge || !btnSave) return;

        if (modifiedCount > 0) {
            badge.className = 'badge-status-changes has-changes';
            badge.innerHTML = '<span>🟡</span> ' + modifiedCount + ' associazione/i modificata/e non salvata/e';
            btnSave.disabled = false;
            if (btnReset) btnReset.disabled = false;
        } else {
            badge.className = 'badge-status-changes no-changes';
            badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
            btnSave.disabled = true;
            if (btnReset) btnReset.disabled = true;
        }
    };

    window.setFranchiseFilter = function(filter) {
        activeFranchiseFilter = filter;
        var btnAll = document.getElementById('btnFilterFranchiseAll');
        var btnManual = document.getElementById('btnFilterFranchiseManual');
        var btnAuto = document.getElementById('btnFilterFranchiseAuto');

        if (btnAll) btnAll.classList.remove('active');
        if (btnManual) btnManual.classList.remove('active');
        if (btnAuto) btnAuto.classList.remove('active');

        if (filter === 'manual' && btnManual) btnManual.classList.add('active');
        else if (filter === 'auto' && btnAuto) btnAuto.classList.add('active');
        else if (btnAll) btnAll.classList.add('active');

        filtraFranchigie();
    };

    window.filtraFranchigie = function() {
        var activeBox = document.querySelector('.stagione-franchigie-box[style*="display: block"]');
        if (!activeBox) return;

        var searchInput = document.getElementById('franchiseSearchInput');
        var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        var rows = activeBox.querySelectorAll('.franchise-row');

        rows.forEach(function(row) {
            var teamName = row.getAttribute('data-team-name') || '';
            var presName = row.getAttribute('data-pres-name') || '';
            var isManual = row.getAttribute('data-is-manual') === '1';

            var matchSearch = (!query || teamName.indexOf(query) !== -1 || presName.indexOf(query) !== -1);
            var matchFilter = true;

            if (activeFranchiseFilter === 'manual') {
                matchFilter = isManual;
            } else if (activeFranchiseFilter === 'auto') {
                matchFilter = !isManual;
            }

            row.style.display = (matchSearch && matchFilter) ? '' : 'none';
        });
    };

    window.ripristinaMappaFranchigie = function() {
        var allSelects = document.querySelectorAll('.franchise-select');
        allSelects.forEach(function(sel) {
            var orig = sel.getAttribute('data-original');
            sel.value = orig;
            var sNum = sel.getAttribute('data-season');
            var locId = sel.getAttribute('data-team-id');
            var pill = document.getElementById('statusPill_' + sNum + '_' + locId);
            var row = sel.closest('.franchise-row');

            if (pill) {
                if (orig === 'auto') {
                    pill.className = 'franchise-status-pill pill-auto';
                    pill.innerHTML = '🟢 Auto';
                    if (row) row.setAttribute('data-is-manual', '0');
                } else {
                    pill.className = 'franchise-status-pill pill-manual';
                    pill.innerHTML = '🟠 Manuale';
                    if (row) row.setAttribute('data-is-manual', '1');
                }
            }
        });

        var sSelect = document.getElementById('selectStagioneFranchigie');
        if (sSelect) aggiornaContatoriStagione(sSelect.value);
        checkFranchiseChanges();
        filtraFranchigie();

        if (typeof showToast === 'function') {
            showToast('Mappature ripristinate ai valori salvati.', 'info');
        }
    };

    window.salvaMappaFranchigie = function() {
        var form = document.getElementById('franchiseMappingForm');
        var btnSave = document.getElementById('btnSaveFranchiseMap');
        if (!form || !btnSave) return;

        btnSave.disabled = true;
        var originalBtnHtml = btnSave.innerHTML;
        btnSave.innerHTML = '<span>⏳ Salvataggio &amp; Ricalcolo...</span>';

        var formData = new FormData(form);
        formData.append('action', 'save_franchise_map');

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                // Aggiorna data-original su tutte le select
                var allSelects = document.querySelectorAll('.franchise-select');
                allSelects.forEach(function(sel) {
                    var currentVal = sel.value;
                    sel.setAttribute('data-original', currentVal);
                    var sNum = sel.getAttribute('data-season');
                    var locId = sel.getAttribute('data-team-id');
                    var pill = document.getElementById('statusPill_' + sNum + '_' + locId);
                    var row = sel.closest('.franchise-row');

                    if (pill) {
                        if (currentVal === 'auto') {
                            pill.className = 'franchise-status-pill pill-auto';
                            pill.innerHTML = '🟢 Auto';
                            if (row) row.setAttribute('data-is-manual', '0');
                        } else {
                            pill.className = 'franchise-status-pill pill-manual';
                            pill.innerHTML = '🟠 Manuale';
                            if (row) row.setAttribute('data-is-manual', '1');
                        }
                    }
                });

                var sSelect = document.getElementById('selectStagioneFranchigie');
                if (sSelect) aggiornaContatoriStagione(sSelect.value);
                checkFranchiseChanges();
                filtraFranchigie();

                if (typeof showToast === 'function') {
                    showToast('✅ ' + data.message, 'success');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast('❌ Errore: ' + (data.error || 'Errore salvataggio'), 'error');
                }
                checkFranchiseChanges();
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            }
            checkFranchiseChanges();
        })
        .finally(function() {
            btnSave.innerHTML = originalBtnHtml;
        });
    };

    // -------------------------------------------------------------
    // GESTIONE MAPPATURA COMPETIZIONI STORICHE
    // -------------------------------------------------------------
    var activeCompFilter = 'all';

    window.mostraStagioneCompetizioni = function(sNum) {
        var boxes = document.querySelectorAll('.stagione-competizioni-box');
        boxes.forEach(function(b) {
            b.style.display = 'none';
        });
        var target = document.getElementById('boxStagioneComp_' + sNum);
        if (target) {
            target.style.display = 'block';
            aggiornaContatoriStagioneComp(sNum);
            filtraCompetizioni();
        }
    };

    window.aggiornaContatoriStagioneComp = function(sNum) {
        var box = document.getElementById('boxStagioneComp_' + sNum);
        if (!box) return;

        var total = 0;
        var manual = 0;
        var auto = 0;

        var selects = box.querySelectorAll('.competition-select');
        total = selects.length;
        selects.forEach(function(sel) {
            var val = sel.value;
            if (val === 'auto') {
                auto++;
            } else {
                manual++;
            }
        });

        var elTotal = document.getElementById('statCompSeasonTotal');
        var elAuto = document.getElementById('statCompSeasonAuto');
        var elManual = document.getElementById('statCompSeasonManual');

        if (elTotal) elTotal.textContent = total;
        if (elAuto) elAuto.textContent = auto;
        if (elManual) elManual.textContent = manual;
    };

    window.onCompetitionSelectChange = function(selectElem) {
        var sNum = selectElem.getAttribute('data-season');
        var locId = selectElem.getAttribute('data-comp-id');
        var origVal = selectElem.getAttribute('data-original');
        var currentVal = selectElem.value;
        var pill = document.getElementById('statusCompPill_' + sNum + '_' + locId);
        var row = selectElem.closest('.competition-row');

        if (pill) {
            if (currentVal !== origVal) {
                pill.className = 'franchise-status-pill pill-modified';
                pill.innerHTML = '✏️ Modificato';
                if (row) row.setAttribute('data-is-manual', currentVal === 'auto' ? '0' : '1');
            } else {
                if (currentVal === 'auto') {
                    pill.className = 'franchise-status-pill pill-auto';
                    pill.innerHTML = '🟢 Auto';
                    if (row) row.setAttribute('data-is-manual', '0');
                } else {
                    pill.className = 'franchise-status-pill pill-manual';
                    pill.innerHTML = '🟠 Manuale';
                    if (row) row.setAttribute('data-is-manual', '1');
                }
            }
        }

        aggiornaContatoriStagioneComp(sNum);
        checkCompetitionChanges();
        filtraCompetizioni();
    };

    window.checkCompetitionChanges = function() {
        var allSelects = document.querySelectorAll('.competition-select');
        var hasChanges = false;

        allSelects.forEach(function(sel) {
            var orig = sel.getAttribute('data-original');
            var curr = sel.value;
            if (orig !== curr) {
                hasChanges = true;
            }
        });

        var badge = document.getElementById('badgeCompetitionChanges');
        var btnSave = document.getElementById('btnSaveCompetitionMap');
        var btnReset = document.getElementById('btnResetCompetitionMap');

        if (!badge || !btnSave) return;

        if (hasChanges) {
            badge.className = 'badge-status-changes has-changes';
            badge.innerHTML = '<span>🟡</span> Modifiche alle competizioni non salvate';
            btnSave.disabled = false;
            if (btnReset) btnReset.disabled = false;
        } else {
            badge.className = 'badge-status-changes no-changes';
            badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
            btnSave.disabled = true;
            if (btnReset) btnReset.disabled = true;
        }
    };

    window.setCompetitionFilter = function(filterType) {
        activeCompFilter = filterType;
        var pills = document.querySelectorAll('#btnFilterCompAll, #btnFilterCompManual, #btnFilterCompAuto');
        pills.forEach(function(p) { p.classList.remove('active'); });

        if (filterType === 'manual') {
            document.getElementById('btnFilterCompManual')?.classList.add('active');
        } else if (filterType === 'auto') {
            document.getElementById('btnFilterCompAuto')?.classList.add('active');
        } else {
            document.getElementById('btnFilterCompAll')?.classList.add('active');
        }

        filtraCompetizioni();
    };

    window.filtraCompetizioni = function() {
        var sSelect = document.getElementById('selectStagioneCompetizioni');
        if (!sSelect) return;
        var activeSeason = sSelect.value;
        var box = document.getElementById('boxStagioneComp_' + activeSeason);
        if (!box) return;

        var rows = box.querySelectorAll('.competition-row');
        rows.forEach(function(row) {
            var isManual = row.getAttribute('data-is-manual') === '1';
            var matchFilter = true;

            if (activeCompFilter === 'manual') {
                matchFilter = isManual;
            } else if (activeCompFilter === 'auto') {
                matchFilter = !isManual;
            }

            row.style.display = matchFilter ? '' : 'none';
        });
    };

    window.ripristinaMappaCompetizioni = function() {
        var allSelects = document.querySelectorAll('.competition-select');
        allSelects.forEach(function(sel) {
            var orig = sel.getAttribute('data-original');
            sel.value = orig;
            var sNum = sel.getAttribute('data-season');
            var locId = sel.getAttribute('data-comp-id');
            var pill = document.getElementById('statusCompPill_' + sNum + '_' + locId);
            var row = sel.closest('.competition-row');

            if (pill) {
                if (orig === 'auto') {
                    pill.className = 'franchise-status-pill pill-auto';
                    pill.innerHTML = '🟢 Auto';
                    if (row) row.setAttribute('data-is-manual', '0');
                } else {
                    pill.className = 'franchise-status-pill pill-manual';
                    pill.innerHTML = '🟠 Manuale';
                    if (row) row.setAttribute('data-is-manual', '1');
                }
            }
        });

        var sSelect = document.getElementById('selectStagioneCompetizioni');
        if (sSelect) aggiornaContatoriStagioneComp(sSelect.value);
        checkCompetitionChanges();
        filtraCompetizioni();

        if (typeof showToast === 'function') {
            showToast('Mappature competizioni ripristinate.', 'info');
        }
    };

    window.salvaMappaCompetizioni = function() {
        var form = document.getElementById('competitionMappingForm');
        var btnSave = document.getElementById('btnSaveCompetitionMap');
        if (!form || !btnSave) return;

        btnSave.disabled = true;
        var originalBtnHtml = btnSave.innerHTML;
        btnSave.innerHTML = '<span>⏳ Salvataggio &amp; Ricalcolo...</span>';

        var formData = new FormData(form);
        formData.append('action', 'save_competition_map');

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                var allSelects = document.querySelectorAll('.competition-select');
                allSelects.forEach(function(sel) {
                    var currentVal = sel.value;
                    sel.setAttribute('data-original', currentVal);
                    var sNum = sel.getAttribute('data-season');
                    var locId = sel.getAttribute('data-comp-id');
                    var pill = document.getElementById('statusCompPill_' + sNum + '_' + locId);
                    var row = sel.closest('.competition-row');

                    if (pill) {
                        if (currentVal === 'auto') {
                            pill.className = 'franchise-status-pill pill-auto';
                            pill.innerHTML = '🟢 Auto';
                            if (row) row.setAttribute('data-is-manual', '0');
                        } else {
                            pill.className = 'franchise-status-pill pill-manual';
                            pill.innerHTML = '🟠 Manuale';
                            if (row) row.setAttribute('data-is-manual', '1');
                        }
                    }
                });

                var sSelect = document.getElementById('selectStagioneCompetizioni');
                if (sSelect) aggiornaContatoriStagioneComp(sSelect.value);
                checkCompetitionChanges();
                filtraCompetizioni();

                if (typeof showToast === 'function') {
                    showToast('✅ ' + data.message, 'success');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast('❌ Errore: ' + (data.error || 'Errore salvataggio'), 'error');
                }
                checkCompetitionChanges();
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            }
            checkCompetitionChanges();
        })
        .finally(function() {
            btnSave.innerHTML = originalBtnHtml;
        });
    };

    // -------------------------------------------------------------
    // GESTIONE CARTELLE SITI STORICI (ARCHIVIO LEGACY)
    // -------------------------------------------------------------
    var legacyFoldersInitialData = '';

    function serializeLegacyFolders() {
        var form = document.getElementById('legacyFoldersForm');
        if (!form) return '';
        var chk = document.getElementById('chkShowLegacySites');
        var obj = {
            showLegacySites: chk ? (chk.checked ? 1 : 0) : 1,
            seasons: {}
        };
        var rows = document.querySelectorAll('.legacy-season-row');
        rows.forEach(function(row) {
            var sNum = row.getAttribute('data-season');
            var sel = row.querySelector('.legacy-folder-select');
            var customInput = row.querySelector('.legacy-custom-input');
            var indexInput = row.querySelector('.legacy-index-input');
            if (sNum) {
                obj.seasons[sNum] = {
                    sel: sel ? sel.value : '',
                    custom: customInput ? customInput.value.trim() : '',
                    index: indexInput ? indexInput.value.trim() : ''
                };
            }
        });
        return JSON.stringify(obj);
    }

    window.checkLegacyFoldersChanges = function() {
        var currentData = serializeLegacyFolders();
        var badge = document.getElementById('badgeLegacyFoldersChanges');
        var btnSave = document.getElementById('btnSaveLegacyFolders');
        var btnReset = document.getElementById('btnResetLegacyFolders');

        if (!badge || !btnSave) return;

        var isModified = (currentData !== legacyFoldersInitialData);
        if (isModified) {
            badge.className = 'badge-status-changes has-changes';
            badge.innerHTML = '<span>🟡</span> Modifiche alle cartelle non salvate';
            btnSave.disabled = false;
            if (btnReset) btnReset.disabled = false;
        } else {
            badge.className = 'badge-status-changes no-changes';
            badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
            btnSave.disabled = true;
            if (btnReset) btnReset.disabled = true;
        }
    };

    window.ripristinaCartelleLegacy = function() {
        if (!legacyFoldersInitialData) return;
        var initialObj = JSON.parse(legacyFoldersInitialData);
        var chk = document.getElementById('chkShowLegacySites');
        if (chk && initialObj.showLegacySites !== undefined) {
            chk.checked = (initialObj.showLegacySites === 1);
        }
        var rows = document.querySelectorAll('.legacy-season-row');
        rows.forEach(function(row) {
            var sNum = row.getAttribute('data-season');
            var initSeason = initialObj.seasons ? initialObj.seasons[sNum] : null;
            if (!initSeason) return;

            var sel = row.querySelector('.legacy-folder-select');
            var customWrap = document.querySelector('.legacy-custom-wrap-' + sNum);
            var customInput = row.querySelector('.legacy-custom-input');
            var indexInput = row.querySelector('.legacy-index-input');
            var btnTest = document.querySelector('.btn-test-legacy-' + sNum);
            var badge = document.querySelector('.badge-s-' + sNum);

            if (sel) {
                sel.value = initSeason.sel;
            }
            if (customInput) {
                customInput.value = initSeason.custom;
            }
            if (indexInput) {
                indexInput.value = initSeason.index;
            }
            if (customWrap) {
                customWrap.style.display = (sel && sel.value === '__custom__') ? 'block' : 'none';
            }

            var effectiveFolder = (sel && sel.value === '__custom__') ? (customInput ? customInput.value.trim() : '') : (sel ? sel.value.trim() : '');
            if (btnTest) {
                btnTest.disabled = (effectiveFolder === '');
            }
            if (badge) {
                if (sel && sel.value === '__custom__') {
                    if (effectiveFolder) {
                        badge.style.background = 'rgba(16,185,129,0.12)';
                        badge.style.color = 'var(--accent-emerald, #10b981)';
                        badge.textContent = '🟢 Collegato (Manuale)';
                    } else {
                        badge.style.background = 'rgba(245,158,11,0.12)';
                        badge.style.color = 'var(--accent-gold, #f59e0b)';
                        badge.textContent = '✍️ Personalizzato';
                    }
                } else if (effectiveFolder !== '') {
                    badge.style.background = 'rgba(16,185,129,0.12)';
                    badge.style.color = 'var(--accent-emerald, #10b981)';
                    badge.textContent = '🟢 Collegato';
                } else {
                    badge.style.background = 'rgba(100,116,139,0.12)';
                    badge.style.color = 'var(--text-muted, #64748b)';
                    badge.textContent = '⚪ Nessuna cartella';
                }
            }
        });
        checkLegacyFoldersChanges();
    };

    window.onLegacyFolderSelectChange = function(selectElem) {
        var sNum = selectElem.getAttribute('data-season');
        var val = selectElem.value;
        var customWrap = document.querySelector('.legacy-custom-wrap-' + sNum);
        var customInput = document.querySelector('.legacy-custom-input[data-season="' + sNum + '"]');
        var indexInput = document.querySelector('.legacy-index-input[data-season="' + sNum + '"]');
        var badge = document.querySelector('.badge-s-' + sNum);
        var btnTest = document.querySelector('.btn-test-legacy-' + sNum);

        if (val === '__custom__') {
            if (customWrap) customWrap.style.display = 'block';
            if (customInput) customInput.focus();
            if (badge) {
                badge.style.background = 'rgba(245,158,11,0.12)';
                badge.style.color = 'var(--accent-gold, #f59e0b)';
                badge.textContent = '✍️ Personalizzato';
            }
            if (btnTest) btnTest.disabled = !customInput || !customInput.value.trim();
        } else if (val === '') {
            if (customWrap) customWrap.style.display = 'none';
            if (badge) {
                badge.style.background = 'rgba(100,116,139,0.12)';
                badge.style.color = 'var(--text-muted, #64748b)';
                badge.textContent = '⚪ Nessuna cartella';
            }
            if (btnTest) btnTest.disabled = true;
        } else {
            if (customWrap) customWrap.style.display = 'none';
            var selectedOpt = selectElem.options[selectElem.selectedIndex];
            var detectedIndex = selectedOpt ? selectedOpt.getAttribute('data-index') : 'index.php';
            if (indexInput) indexInput.value = detectedIndex || 'index.php';
            if (badge) {
                badge.style.background = 'rgba(16,185,129,0.12)';
                badge.style.color = 'var(--accent-emerald, #10b981)';
                badge.textContent = '🟢 Collegato';
            }
            if (btnTest) btnTest.disabled = false;
        }
        checkLegacyFoldersChanges();
    };

    window.onLegacyCustomInputChange = function(inputElem) {
        var sNum = inputElem.getAttribute('data-season');
        var val = inputElem.value.trim();
        var badge = document.querySelector('.badge-s-' + sNum);
        var btnTest = document.querySelector('.btn-test-legacy-' + sNum);
        if (badge) {
            if (val) {
                badge.style.background = 'rgba(16,185,129,0.12)';
                badge.style.color = 'var(--accent-emerald, #10b981)';
                badge.textContent = '🟢 Collegato (Manuale)';
            } else {
                badge.style.background = 'rgba(100,116,139,0.12)';
                badge.style.color = 'var(--text-muted, #64748b)';
                badge.textContent = '⚪ Nessuna cartella';
            }
        }
        if (btnTest) btnTest.disabled = !val;
        checkLegacyFoldersChanges();
    };

    window.testLegacyLink = function(sNum) {
        var sel = document.querySelector('.legacy-folder-select[data-season="' + sNum + '"]');
        var customInput = document.querySelector('.legacy-custom-input[data-season="' + sNum + '"]');
        var indexInput = document.querySelector('.legacy-index-input[data-season="' + sNum + '"]');
        var folder = '';
        if (sel) {
            folder = sel.value === '__custom__' ? (customInput ? customInput.value.trim() : '') : sel.value.trim();
        }
        if (!folder) {
            alert('Nessuna cartella specificata per la stagione ' + sNum);
            return;
        }
        var cleanFolder = folder.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
        var indexFile = (indexInput && indexInput.value.trim()) ? indexInput.value.trim() : 'index.php';
        window.open('../' + cleanFolder + '/' + indexFile, '_blank');
    };

    window.saveLegacyFoldersConfig = function() {
        var btnSave = document.getElementById('btnSaveLegacyFolders');
        var originalBtnHtml = btnSave ? btnSave.innerHTML : '';
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<span>⏳ Salvataggio...</span>';
        }

        var chk = document.getElementById('chkShowLegacySites');
        var showLegacySites = chk ? (chk.checked ? 1 : 0) : 1;

        var seasonsData = {};
        var rows = document.querySelectorAll('.legacy-season-row');
        rows.forEach(function(row) {
            var sNum = row.getAttribute('data-season');
            var sel = row.querySelector('.legacy-folder-select');
            var customInput = row.querySelector('.legacy-custom-input');
            var indexInput = row.querySelector('.legacy-index-input');

            var folder = '';
            if (sel) {
                folder = sel.value === '__custom__' ? (customInput ? customInput.value.trim() : '') : sel.value.trim();
            }
            var indexFile = (indexInput && indexInput.value.trim()) ? indexInput.value.trim() : 'index.php';

            if (sNum) {
                seasonsData[sNum] = {
                    folder: folder,
                    index: indexFile
                };
            }
        });

        var formData = new FormData();
        formData.append('action', 'save_storico_config');
        formData.append('showLegacySites', showLegacySites);

        for (var sKey in seasonsData) {
            formData.append('seasons[' + sKey + '][folder]', seasonsData[sKey].folder);
            formData.append('seasons[' + sKey + '][index]', seasonsData[sKey].index);
        }

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.success) {
                if (typeof showToast === 'function') {
                    showToast('✅ ' + data.message, 'success');
                } else {
                    alert('✅ ' + data.message);
                }
                legacyFoldersInitialData = serializeLegacyFolders();
                checkLegacyFoldersChanges();
            } else {
                var err = (data && data.error) ? data.error : 'Errore durante il salvataggio.';
                if (typeof showToast === 'function') {
                    showToast('❌ ' + err, 'error');
                } else {
                    alert('❌ ' + err);
                }
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            } else {
                alert('❌ Errore connessione: ' + err.message);
            }
        })
        .finally(function() {
            if (btnSave) {
                btnSave.innerHTML = originalBtnHtml;
            }
            checkLegacyFoldersChanges();
        });
    };

    // -------------------------------------------------------------
    // SEZIONE 1b: LOGHI E ICONE COMPETIZIONI
    // -------------------------------------------------------------
    function mapCompIconToBadgeSrc(iconVal) {
        if (iconVal === 'ico-scudetto.gif') return '../img/scudo.png';
        if (iconVal === 'ico-coppa.gif') return '../img/coppa.png';
        if (iconVal === 'ico-supercoppa.gif') return '../img/supercoppa.png';
        if (iconVal === 'ico-gp.gif') return '../img/gp.png';
        return '../img/' + iconVal;
    }

    function updateCompLogoRowVisuals(selectElem) {
        if (!selectElem) return;
        var cId = selectElem.getAttribute('data-comp-id');
        var origVal = selectElem.getAttribute('data-original') || 'auto';
        var autoIcon = selectElem.getAttribute('data-auto-icon') || 'ico-coppa.gif';
        var currentVal = selectElem.value;
        var effectiveIcon = (currentVal === 'auto' || !currentVal) ? autoIcon : currentVal;

        var previewImg = document.getElementById('compLogoPreview_' + cId);
        if (previewImg) {
            previewImg.src = '../img/' + effectiveIcon;
        }

        var btnDelete = document.getElementById('btnDeleteCompLogo_' + cId);
        if (btnDelete) {
            btnDelete.style.display = (currentVal.indexOf('comp_logos/') === 0) ? 'inline-flex' : 'none';
        }

        // Aggiorna in tempo reale i badge di questa competizione nella pagina
        var badgeImgs = document.querySelectorAll('img[data-comp-badge-img="' + cId + '"]');
        var badgeSrc = mapCompIconToBadgeSrc(effectiveIcon);
        badgeImgs.forEach(function(img) {
            img.src = badgeSrc;
            img.style.display = 'inline-block';
            if (img.nextElementSibling) img.nextElementSibling.style.display = 'none';
        });

        var pill = document.getElementById('statusCompLogoPill_' + cId);
        if (pill) {
            pill.removeAttribute('style');
            if (currentVal !== origVal) {
                pill.className = 'franchise-status-pill pill-modified';
                pill.textContent = '✏️ Modificato';
            } else if (currentVal.indexOf('comp_logos/') === 0) {
                pill.className = 'franchise-status-pill pill-manual';
                pill.style.background = 'rgba(168, 85, 247, 0.14)';
                pill.style.color = 'var(--accent-purple, #a855f7)';
                pill.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                pill.textContent = '🟣 Custom';
            } else if (currentVal !== 'auto') {
                pill.className = 'franchise-status-pill pill-manual';
                pill.textContent = '🔵 Default Skin';
            } else {
                pill.className = 'franchise-status-pill pill-auto';
                pill.textContent = '🟢 Auto';
            }
        }
    }

    window.onCompLogoSelectChange = function(selectElem) {
        updateCompLogoRowVisuals(selectElem);
        checkCompLogosChanges();
    };

    window.checkCompLogosChanges = function() {
        var selects = document.querySelectorAll('.comp-logo-select');
        var changedCount = 0;
        selects.forEach(function(sel) {
            var orig = sel.getAttribute('data-original') || 'auto';
            if (sel.value !== orig) changedCount++;
        });

        var badge = document.getElementById('badgeCompLogosChanges');
        var btnSave = document.getElementById('btnSaveCompLogos');
        var btnReset = document.getElementById('btnResetCompLogos');
        if (!badge || !btnSave) return;

        if (changedCount > 0) {
            badge.className = 'badge-status-changes has-changes';
            badge.innerHTML = '<span>🟡</span> ' + changedCount + (changedCount === 1 ? ' logo modificato non salvato' : ' loghi modificati non salvati');
            btnSave.disabled = false;
            if (btnReset) btnReset.disabled = false;
        } else {
            badge.className = 'badge-status-changes no-changes';
            badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
            btnSave.disabled = true;
            if (btnReset) btnReset.disabled = true;
        }
    };

    window.ripristinaLoghiCompetizioni = function() {
        var selects = document.querySelectorAll('.comp-logo-select');
        selects.forEach(function(sel) {
            sel.value = sel.getAttribute('data-original') || 'auto';
            updateCompLogoRowVisuals(sel);
        });
        checkCompLogosChanges();
        if (typeof showToast === 'function') {
            showToast('Loghi competizioni ripristinati ai valori salvati.', 'info');
        }
    };

    window.triggerCompLogoUpload = function(cId) {
        var fileInput = document.getElementById('compLogoFile_' + cId);
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    };

    window.handleCompLogoUpload = function(fileInput, cId) {
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        var file = fileInput.files[0];
        var btnUpload = document.getElementById('btnUploadCompLogo_' + cId);
        var origBtnHtml = btnUpload ? btnUpload.innerHTML : '';
        if (btnUpload) {
            btnUpload.disabled = true;
            btnUpload.innerHTML = '<span>⏳ Upload...</span>';
        }

        var formData = new FormData();
        formData.append('action', 'upload_competition_logo');
        formData.append('comp_id', cId);
        formData.append('logo_file', file);

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.success && data.value) {
                // Aggiungi l'opzione a tutte le select dei loghi competizione se non presente
                var allSelects = document.querySelectorAll('.comp-logo-select');
                allSelects.forEach(function(sel) {
                    var optGroup = sel.querySelector('.comp-custom-logos-optgroup');
                    if (!optGroup) return;
                    var exists = false;
                    for (var i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value === data.value) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        var opt = document.createElement('option');
                        opt.value = data.value;
                        opt.textContent = '🖼️ Custom: ' + (data.filename || data.value.replace('comp_logos/', ''));
                        optGroup.appendChild(opt);
                    }
                });

                var targetSelect = document.getElementById('compLogoSelect_' + cId);
                if (targetSelect) {
                    targetSelect.value = data.value;
                    onCompLogoSelectChange(targetSelect);
                }

                // Aggiungi chip nella galleria dei loghi custom caricati
                var galleryWrap = document.getElementById('customCompLogosGalleryWrap');
                var galleryList = document.getElementById('customCompLogosGalleryList');
                if (galleryWrap && galleryList) {
                    galleryWrap.style.display = 'block';
                    var existingChip = galleryList.querySelector('.custom-logo-chip[data-logo-value="' + data.value + '"]');
                    if (!existingChip) {
                        var fName = data.filename || data.value.replace('comp_logos/', '');
                        var chip = document.createElement('div');
                        chip.className = 'custom-logo-chip';
                        chip.setAttribute('data-logo-value', data.value);
                        chip.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm, 6px); padding: 5px 10px; font-size: 0.8rem;';
                        chip.innerHTML = '<img src="../img/' + data.value + '" alt="" style="width: 24px; height: 24px; object-fit: contain;" />'
                            + '<span style="color: var(--text-primary); font-weight: 600;"></span>'
                            + '<button type="button" style="background: transparent; border: none; color: var(--accent-crimson, #ef4444); cursor: pointer; padding: 2px 4px; font-size: 0.85rem; line-height: 1;" title="Elimina dal server">🗑️</button>';
                        chip.querySelector('span').textContent = fName;
                        chip.querySelector('button').onclick = function() {
                            deleteCustomCompLogoByValue(data.value);
                        };
                        galleryList.appendChild(chip);
                    }
                }

                if (typeof showToast === 'function') {
                    showToast('✅ Logo caricato! Clicca su "Salva Loghi Competizioni" per confermare.', 'success');
                }
            } else {
                var errMsg = (data && data.error) ? data.error : 'Errore durante il caricamento del file.';
                if (typeof showToast === 'function') {
                    showToast('❌ ' + errMsg, 'error');
                } else {
                    alert('❌ ' + errMsg);
                }
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            } else {
                alert('❌ Errore connessione: ' + err.message);
            }
        })
        .finally(function() {
            if (btnUpload) {
                btnUpload.disabled = false;
                btnUpload.innerHTML = origBtnHtml;
            }
        });
    };

    window.deleteSelectedCompLogo = function(cId) {
        var sel = document.getElementById('compLogoSelect_' + cId);
        if (!sel || sel.value.indexOf('comp_logos/') !== 0) return;
        deleteCustomCompLogoByValue(sel.value);
    };

    window.deleteCustomCompLogoByValue = function(logoValue) {
        if (!logoValue || logoValue.indexOf('comp_logos/') !== 0) return;
        var fileName = logoValue.replace('comp_logos/', '');
        if (!confirm('Vuoi eliminare definitivamente il logo custom "' + fileName + '" dal server?\nEventuali competizioni che lo utilizzano torneranno al logo automatico.')) {
            return;
        }

        var formData = new FormData();
        formData.append('action', 'delete_competition_logo');
        formData.append('logo', logoValue);

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.success) {
                var delVal = data.deletedValue || logoValue;
                var allSelects = document.querySelectorAll('.comp-logo-select');
                allSelects.forEach(function(sel) {
                    var wasSelected = (sel.value === delVal);
                    var wasOriginal = (sel.getAttribute('data-original') === delVal);
                    for (var i = sel.options.length - 1; i >= 0; i--) {
                        if (sel.options[i].value === delVal) {
                            sel.remove(i);
                        }
                    }
                    if (wasOriginal) {
                        sel.setAttribute('data-original', 'auto');
                    }
                    if (wasSelected) {
                        sel.value = sel.getAttribute('data-original') || 'auto';
                    }
                    updateCompLogoRowVisuals(sel);
                });

                var galleryList = document.getElementById('customCompLogosGalleryList');
                var galleryWrap = document.getElementById('customCompLogosGalleryWrap');
                if (galleryList) {
                    var chip = galleryList.querySelector('.custom-logo-chip[data-logo-value="' + delVal + '"]');
                    if (chip) chip.remove();
                    if (galleryWrap && galleryList.children.length === 0) {
                        galleryWrap.style.display = 'none';
                    }
                }

                checkCompLogosChanges();
                if (typeof showToast === 'function') {
                    showToast('🗑️ ' + (data.message || 'Logo custom eliminato.'), 'info');
                }
            } else {
                var errMsg = (data && data.error) ? data.error : 'Errore durante l\'eliminazione del logo.';
                if (typeof showToast === 'function') {
                    showToast('❌ ' + errMsg, 'error');
                } else {
                    alert('❌ ' + errMsg);
                }
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            } else {
                alert('❌ Errore connessione: ' + err.message);
            }
        });
    };

    window.salvaLoghiCompetizioni = function() {
        var form = document.getElementById('competitionLogosForm');
        var btnSave = document.getElementById('btnSaveCompLogos');
        if (!form || !btnSave) return;

        var origBtnHtml = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<span>⏳ Salvataggio &amp; Aggiornamento...</span>';

        var formData = new FormData(form);
        formData.append('action', 'save_competition_logos');

        fetch('impostazioni.php', {
            method: 'POST',
            headers: getRankingCsrfHeaders(),
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.success) {
                var selects = document.querySelectorAll('.comp-logo-select');
                selects.forEach(function(sel) {
                    sel.setAttribute('data-original', sel.value);
                    updateCompLogoRowVisuals(sel);
                });
                checkCompLogosChanges();
                if (typeof showToast === 'function') {
                    showToast('✅ ' + data.message, 'success');
                } else {
                    alert('✅ ' + data.message);
                }
            } else {
                var errMsg = (data && data.error) ? data.error : 'Errore durante il salvataggio dei loghi.';
                if (typeof showToast === 'function') {
                    showToast('❌ ' + errMsg, 'error');
                } else {
                    alert('❌ ' + errMsg);
                }
                checkCompLogosChanges();
            }
        })
        .catch(function(err) {
            if (typeof showToast === 'function') {
                showToast('❌ Errore connessione: ' + err.message, 'error');
            } else {
                alert('❌ Errore connessione: ' + err.message);
            }
            checkCompLogosChanges();
        })
        .finally(function() {
            btnSave.innerHTML = origBtnHtml;
            checkCompLogosChanges();
        });
    };

    // -------------------------------------------------------------
    // INIZIALIZZAZIONE ALL'AVVIO
    // -------------------------------------------------------------
    function initRankingStorico() {
        // Inizializza stato regole ranking
        rankingRulesInitialData = serializeRankingRules();
        var rulesForm = document.getElementById('rankingRulesForm');
        if (rulesForm) {
            rulesForm.addEventListener('input', checkRankingRulesChanges);
            rulesForm.addEventListener('change', checkRankingRulesChanges);

            // Sincronizzazione real-time di away e neutral quando è attiva la spunta "Uniforma"
            rulesForm.addEventListener('input', function(e) {
                var chk = document.getElementById('chkUniformaVenue');
                if (!chk || !chk.checked) return;
                var target = e.target;
                if (!target || !target.name) return;
                var match = target.name.match(/^matches\[(\d+)\]\[home\]\[(\w+)\]$/);
                if (match) {
                    var cId = match[1];
                    var field = match[2];
                    var away = rulesForm.elements['matches[' + cId + '][away][' + field + ']'];
                    var neutral = rulesForm.elements['matches[' + cId + '][neutral][' + field + ']'];
                    if (away) away.value = target.value;
                    if (neutral) neutral.value = target.value;
                }
            });
        }

        // Inizializza contatori stagione attiva franchigie
        var sSelect = document.getElementById('selectStagioneFranchigie');
        if (sSelect) {
            aggiornaContatoriStagione(sSelect.value);
        }

        // Inizializza contatori stagione attiva competizioni
        var sSelectComp = document.getElementById('selectStagioneCompetizioni');
        if (sSelectComp) {
            aggiornaContatoriStagioneComp(sSelectComp.value);
        }

        // Inizializza stato cartelle legacy
        legacyFoldersInitialData = serializeLegacyFolders();
        var legacyForm = document.getElementById('legacyFoldersForm');
        if (legacyForm) {
            legacyForm.addEventListener('input', checkLegacyFoldersChanges);
            legacyForm.addEventListener('change', checkLegacyFoldersChanges);
        }
        checkLegacyFoldersChanges();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRankingStorico);
    } else {
        initRankingStorico();
    }
})();
</script>