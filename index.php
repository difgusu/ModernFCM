<?php
// Helper per cache busting basato su data di modifica del file (filemtime)
function fcm_ver($path) {
    if (file_exists($path)) {
        return $path . '?v=' . filemtime($path);
    }
    return $path;
}

// Helper per la modularità: verifica flag in js/fcmVariabili.js ed eventuale presenza del file su disco
function fcm_module_enabled($varName, $requiredFile = null) {
    static $iniVars = null;
    if ($iniVars === null) {
        $iniVars = [];
        if (file_exists('js/fcmVariabili.js')) {
            $raw = file_get_contents('js/fcmVariabili.js');
            if (preg_match_all('/var\s+([a-zA-Z0-9_]+)\s*=\s*["\']?(.*?)["\']?\s*;?$/m', $raw, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $m) {
                    $iniVars[$m[1]] = trim($m[2]);
                }
            }
        }
    }
    $val = isset($iniVars[$varName]) ? strtolower($iniVars[$varName]) : 'si';
    $isEnabled = ($val === 'si' || $val === '1' || $val === 'true');
    if ($isEnabled && $requiredFile !== null) {
        if (is_array($requiredFile)) {
            foreach ($requiredFile as $rf) {
                if (file_exists($rf)) return true;
            }
            return false;
        }
        return file_exists($requiredFile);
    }
    return $isEnabled;
}

// Timestamp generale ultimo aggiornamento FCM (usato per i dati dinamici)
$fcmGlobalVersion = file_exists('js/fcmVariabili.js') ? filemtime('js/fcmVariabili.js') : time();

// Estrae dinamicamente il nome della lega e il numero di stagione da js/fcmLegaDati.js
$fcmNomeLega = 'ModernFCM';
$currentStagNum = 1;
if (file_exists('js/fcmLegaDati.js')) {
    $legaContent = file_get_contents('js/fcmLegaDati.js');
    if (preg_match('/var\s+nomelega\s*=\s*["\'](.*?)["\']/i', $legaContent, $matches)) {
        $parsed = trim($matches[1]);
        if ($parsed !== '') {
            $fcmNomeLega = $parsed;
        }
    }
    if (preg_match('/var\s+stagione\s*=\s*["\']?(\d+)["\']?/i', $legaContent, $mStag)) {
        $currentStagNum = (int)$mStag[1];
    }
}
$fcmAppName = $fcmNomeLega . ' - ModernFCM';
$fcmAppShortName = $fcmNomeLega;

// Calcolo dinamico URL canonico e immagine assoluta per Open Graph e Twitter Card
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
$siteHost = !empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$siteScript = $_SERVER['SCRIPT_NAME'] ?? '';
$siteDirPath = rtrim(dirname($siteScript), '/\\');
$ogBaseUrl = 'https://' . $siteHost . ($siteDirPath ? $siteDirPath . '/' : '/');
$ogCanonicalUrl = 'https://' . $siteHost . ($_SERVER['REQUEST_URI'] ?? '/');
$ogImageUrl = $ogBaseUrl . 'img/logo.png';
$fcmDescrizione = 'Sito ufficiale di ' . $fcmNomeLega . ' (Stagione ' . $currentStagNum . ') su piattaforma ModernFCM: classifica, formazioni, risultati live, statistiche e albo d\'oro.';

// ====================================================================
// CONFIGURAZIONE STAGIONI CON SKIN ModernFCM
// ====================================================================
// Elenco manuale opzionale delle stagioni passate (interi) che adottavano la skin ModernFCM (es. [13, 14]).
// La stagione corrente è sempre considerata ModernFCM.
// Nelle stagioni non presenti in questo elenco (vecchie skin), i link punteranno 
// ai file dedicati (es. rose.htm e ris.php / ris.htm) all'interno delle cartelle
// indicate in arrDirectory (persjs/fcmConfrontiDati.js generato dal plugin FCM).
$fcmModernSeasonsConfig = [
    // es. 13, 14
];

// Estrae dinamicamente le cartelle delle stagioni da arrDirectory in persjs/fcmConfrontiDati.js (generato dal plugin FCM)
$fcmSeasonDirs = [];
$confrontiCurrentStag = null;
if (file_exists('persjs/fcmConfrontiDati.js') && fcm_module_enabled('ModStoricoAvanzato')) {
    $confrontiContent = file_get_contents('persjs/fcmConfrontiDati.js');
    if (preg_match_all('/new\s+X\s*\(\s*(\d+)\s*,\s*[^,]+\s*,\s*["\'](.*?)["\']\s*\)/i', $confrontiContent, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $sNum = (int)$m[1];
            $rawDir = trim($m[2]);
            if ($rawDir === '.' || $rawDir === './') {
                $confrontiCurrentStag = $sNum;
            } else {
                $cleanDir = ltrim($rawDir, './');
                $fcmSeasonDirs[$sNum] = $cleanDir;
            }
        }
    }
}
if ($confrontiCurrentStag !== null && $confrontiCurrentStag > 0) {
    $currentStagNum = $confrontiCurrentStag;
}

$fcmModernSeasons = $fcmModernSeasonsConfig;
if (!in_array($currentStagNum, $fcmModernSeasons)) {
    $fcmModernSeasons[] = $currentStagNum;
}

// Se non specificato manualmente in $fcmModernSeasonsConfig, verifica solo per le cartelle indicate in arrDirectory
if (empty($fcmModernSeasonsConfig)) {
    foreach ($fcmSeasonDirs as $sNum => $dirPath) {
        if (!in_array($sNum, $fcmModernSeasons) && is_dir($dirPath)) {
            $indexPath = $dirPath . '/index.php';
            if (file_exists($indexPath)) {
                $sample = @file_get_contents($indexPath, false, null, 0, 1000);
                if ($sample && (stripos($sample, 'ModernFCM') !== false || stripos($sample, 'fcmDataLoader') !== false)) {
                    $fcmModernSeasons[] = $sNum;
                }
            }
        }
    }
}
sort($fcmModernSeasons);

// Sincronizza manifest.json statico su disco se fcmLegaDati.js è più recente
if (!file_exists('manifest.json') || (file_exists('js/fcmLegaDati.js') && filemtime('js/fcmLegaDati.js') > filemtime('manifest.json'))) {
    $manifestData = [
        'name' => $fcmAppName,
        'short_name' => $fcmAppShortName,
        'description' => 'Skin ModernFCM per Fantacalcio Manager: classifica, calendario, formazioni, risultati e statistiche FCM.',
        'start_url' => 'index.php',
        'scope' => './',
        'display' => 'standalone',
        'orientation' => 'portrait-primary',
        'background_color' => '#0b1120',
        'theme_color' => '#0284c7',
        'icons' => [
            [
                'src' => 'img/icon-192.png',
                'sizes' => '192x192',
                'type' => 'image/png',
                'purpose' => 'any maskable'
            ],
            [
                'src' => 'img/icon-512.png',
                'sizes' => '512x512',
                'type' => 'image/png',
                'purpose' => 'any maskable'
            ],
            [
                'src' => 'img/logo.png',
                'sizes' => '1024x1024',
                'type' => 'image/png',
                'purpose' => 'any'
            ]
        ]
    ];
    @file_put_contents('manifest.json', json_encode($manifestData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}
?>
<!DOCTYPE html>
<html lang="it">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <script>
    (function() {
      try {
        var mode = localStorage.getItem('pn_theme') || 'system';
        var resolved = mode;
        if (mode === 'system' || (mode !== 'light' && mode !== 'dark')) {
          resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.setAttribute('data-theme-preference', mode);
      } catch (e) {}
    })();
  </script>
  <meta name="theme-color" content="#0284c7">
  <meta name="description" content="<?php echo htmlspecialchars($fcmDescrizione); ?>">
  <title><?php echo htmlspecialchars($fcmAppName); ?></title>

  <!-- Open Graph / Facebook / WhatsApp / Telegram Social Previews -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="<?php echo htmlspecialchars($fcmNomeLega); ?>">
  <meta property="og:title" content="<?php echo htmlspecialchars($fcmAppName); ?>">
  <meta property="og:description" content="<?php echo htmlspecialchars($fcmDescrizione); ?>">
  <meta property="og:url" content="<?php echo htmlspecialchars($ogCanonicalUrl); ?>">
  <meta property="og:image" content="<?php echo htmlspecialchars($ogImageUrl); ?>">
  <meta property="og:image:secure_url" content="<?php echo htmlspecialchars($ogImageUrl); ?>">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:image:alt" content="Stemma <?php echo htmlspecialchars($fcmNomeLega); ?>">
  <meta property="og:locale" content="it_IT">

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="<?php echo htmlspecialchars($fcmAppName); ?>">
  <meta name="twitter:description" content="<?php echo htmlspecialchars($fcmDescrizione); ?>">
  <meta name="twitter:image" content="<?php echo htmlspecialchars($ogImageUrl); ?>">

  <!-- PWA Web App Manifest (Dinamico e sincronizzato) -->
  <link rel="manifest" href="<?php echo fcm_ver('manifest.php'); ?>">

  <!-- Meta tag PWA per Android Chrome -->
  <meta name="mobile-web-app-capable" content="yes">

  <!-- Meta tag PWA per Apple iOS Safari -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="<?php echo htmlspecialchars($fcmAppShortName); ?>">

  <link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
  <link rel="icon" type="image/png" sizes="192x192" href="img/icon-192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="img/icon-512.png">
  <link rel="icon" type="image/png" href="img/logo.png">
  <link rel="apple-touch-icon" href="img/icon-192.png">
  <link rel="stylesheet" href="<?php echo fcm_ver('css/style.css'); ?>">
  <link rel="stylesheet" href="<?php echo fcm_ver('fantam/fantamister.css'); ?>">

  <!-- ====================================================================
       FCM DATA CORE (Generated weekly by Fantacalcio Manager)
       ==================================================================== -->
  <!-- Variabili globali FCM passate a JavaScript (versione dinamica per cache-busting e rilevamento skin) -->
  <script>
    window.FCM_VERSION = '<?php echo $fcmGlobalVersion; ?>';
    window.FCM_CURRENT_SEASON = <?php echo $currentStagNum; ?>;
    window.FCM_MODERN_SEASONS = <?php echo json_encode($fcmModernSeasons); ?>;
  </script>

  <script src="<?php echo fcm_ver('js/fcmCostruttori.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmVariabili.js'); ?>" charset="ISO-8859-1"></script>
  <?php if (file_exists('js/fcmCalcolorisultatiVariabili.js')): ?>
  <script src="<?php echo fcm_ver('js/fcmCalcolorisultatiVariabili.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
  <script src="<?php echo fcm_ver('js/DataA.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmLegaDati.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmSerieADati.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmSerieADatiDettaglio.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmCompetizioniDati.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmFantasquadreDati.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmClassificaDati.js'); ?>" charset="ISO-8859-1"></script>
  <script src="<?php echo fcm_ver('js/fcmCalendarioDati.js'); ?>" charset="ISO-8859-1"></script>
  <?php if (file_exists('js/fcmTop11.js') && fcm_module_enabled('ModFantamister')): ?>
  <script src="<?php echo fcm_ver('js/fcmTop11.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
  <script src="<?php echo fcm_ver('js/fcmAlboDOroDati.js'); ?>" charset="ISO-8859-1"></script>
  <?php if (file_exists('persjs/fcmConfrontiDati.js') && fcm_module_enabled('ModStoricoAvanzato')): ?>
  <script src="<?php echo fcm_ver('persjs/fcmConfrontiDati.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
  <?php if (file_exists('js/fcmDocumentiDati.js')): ?>
  <script src="<?php echo fcm_ver('js/fcmDocumentiDati.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
  <?php if (file_exists('js/fcmQueryDati.js')): ?>
  <script src="<?php echo fcm_ver('js/fcmQueryDati.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
  <?php if (file_exists('js/incrociacalendari.js') && fcm_module_enabled('ModIncroci')): ?>
  <script src="<?php echo fcm_ver('js/incrociacalendari.js'); ?>" charset="ISO-8859-1"></script>
  <?php endif; ?>
</head>

<body>

  <!-- ====================================================================
       APP HEADER / TOP BAR
       ==================================================================== -->
  <header class="app-header">
    <div class="header-container">

      <!-- Brand / Logo -->
      <a href="#home" class="brand-wrapper">
        <img src="img/logo.png" class="brand-logo" alt="ModernFCM Logo" onerror="this.src='img/logo.jpg'" />
        <div class="brand-titles" style="display: flex; flex-direction: column; gap: 2px;">
          <span class="brand-name" style="margin: 0; line-height: 1.2;"><?php echo htmlspecialchars($fcmNomeLega); ?></span>
          <span class="brand-subtitle" id="headerLeagueSubtitle">Stagione in corso</span>
        </div>
      </a>

      <!-- Desktop Navigation Menu -->
      <nav class="desktop-nav">
        <a href="#home" class="nav-item active">Home</a>
        <?php if (fcm_module_enabled('ModInvioFormazione', 'invform.php')): ?>
        <a href="#invform" class="nav-item" title="Invio Formazione">
          <span>Invio Formazione</span>
        </a>
        <?php endif; ?>
        <a href="#classifica" class="nav-item">Classifica</a>
        <a href="#calendario" class="nav-item">Calendario</a>
        <a href="#rose" class="nav-item">Rose</a>
        <?php if (fcm_module_enabled('ModMercatoLibero', 'mercato/index.php')): ?>
        <a href="#mercato" class="nav-item">Mercato</a>
        <?php endif; ?>
        <a href="#formazioni" class="nav-item">Formazioni</a>
        <a href="#risultati" class="nav-item">Risultati</a>
        <a href="#statistiche" class="nav-item">Statistiche</a>
        <?php if (fcm_module_enabled('ModStoricoAvanzato', 'persjs/fcmConfrontiDati.js')): ?>
        <a href="#storico" class="nav-item">Storico</a>
        <?php else: ?>
        <a href="#albo" class="nav-item">Albo d'Oro</a>
        <?php endif; ?>
        <a href="#registri" class="nav-item">Registri</a>
        <a href="#extra" class="nav-item">Extra</a>
      </nav>

      <!-- Header Actions: Menu tutto a destra -->
      <div class="header-actions">
        <!-- Pulsante Menu Drawer per Desktop, Tablet e Mobile -->
        <button class="icon-btn icon-btn-menu" id="btnOpenDrawer" aria-label="Apri Menu" title="Menu" aria-controls="drawer-menu" aria-expanded="false">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span class="btn-menu-label">Menu</span>
        </button>
      </div>

    </div>
  </header>

  <!-- ====================================================================
       MAIN APPLICATION CONTENT (Rendered by SPA Views)
       ==================================================================== -->
  <main class="main-content" id="appContent">
    <!-- View content is injected here -->
  </main>

  <!-- ====================================================================
       FOOTER
       ==================================================================== -->
  <footer class="app-footer">
    <div style="max-width: 1200px; margin: 0 auto;">
      <p class="footer-credits">
        Skin <b>ModernFCM</b> • Webmaster: <a href="mailto:difgusu@yahoo.it">difgusu</a>
      </p>
      <p id="footerLastUpdated" style="color:var(--accent-cyan);font-weight:600;">
        Caricamento aggiornamento...
      </p>
      <p style="font-size: 0.72rem; margin-top: 10px;">
        Powered by <b>difgusu</b>
      </p>
    </div>
  </footer>

  <!-- ====================================================================
       MOBILE BOTTOM NAVIGATION BAR
       ==================================================================== -->
  <?php
  // Determinazione stato iniziale pulsante dinamico footer mobile
  $bnavHasInvform = fcm_module_enabled('ModInvioFormazione', 'invform.php');
  $bnavHasLiveFP = fcm_module_enabled('ModLiveFantapazz');
  $bnavHasLiveFM = fcm_module_enabled('ModLiveFantaMaster');
  $bnavHasLiveVU = fcm_module_enabled('ModLiveVU');
  $bnavIsLiveEnabled = $bnavHasLiveFP || $bnavHasLiveFM || $bnavHasLiveVU;
  $bnavLiveRoute = $bnavHasLiveFP ? '#liveFP' : ($bnavHasLiveFM ? '#liveFM' : '#liveVU');

  $bnavIsInvformUnlocked = false;
  if ($bnavHasInvform && file_exists('js/fcmInvioFormazioneDati.js')) {
      $invDatiRaw = file_get_contents('js/fcmInvioFormazioneDati.js');
      if (preg_match('/var\s+disabilitaGiornata\s*=\s*0\b/i', $invDatiRaw)) {
          $bnavIsInvformUnlocked = true;
      }
  }

  $bnavIsInProgress = false;
  $bnavTargetDay = 1;
  if (file_exists('invform/invform.inc.php')) {
      include_once 'invform/invform.inc.php';
      if (!empty($orariInizio) && is_array($orariInizio)) {
          $now = time();
          $ant = isset($anticipoInvio) ? (int)$anticipoInvio : 30;
          foreach ($orariInizio as $g => $dtStr) {
              $ts = strtotime(str_replace('.', ':', $dtStr));
              if ($ts !== false) {
                  $deadline = $ts - ($ant * 60);
                  if ($deadline > $now) {
                      $bnavTargetDay = $g;
                      $bnavIsInProgress = false;
                      break;
                  } else {
                      $bnavTargetDay = $g;
                      $bnavIsInProgress = true;
                  }
              }
          }
      }
  }

  $bnavHref = '#calendario';
  $bnavLabel = 'Calendario';
  $bnavType = 'calendario';

  if (!$bnavIsInProgress) {
      if ($bnavHasInvform) {
          $bnavHref = '#invform';
          $bnavLabel = 'Invio Formazione';
          $bnavType = 'invform';
      }
  } else {
      if ($bnavIsLiveEnabled) {
          $bnavHref = $bnavLiveRoute;
          $bnavLabel = 'Live';
          $bnavType = 'live';
      } elseif ($bnavIsInvformUnlocked) {
          $bnavHref = '#invform?Gio=' . ($bnavTargetDay + 1);
          $bnavLabel = 'Invio Formazione';
          $bnavType = 'invform';
      }
  }
  ?>
  <nav class="bottom-nav">
    <a href="#home" class="bnav-item active">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span>Home</span>
    </a>

    <a href="#classifica" class="bnav-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
        <path d="M4 22h16"></path>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
      </svg>
      <span>Classifica</span>
    </a>

     <!-- Invio Formazione (o Live / Calendario se in corso) tra Classifica e Rose -->
    <a href="<?php echo htmlspecialchars($bnavHref); ?>" class="bnav-item" id="bnavDynamicItem" data-bnav-type="<?php echo htmlspecialchars($bnavType); ?>">
      <?php if ($bnavType === 'live'): ?>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <?php elseif ($bnavType === 'invform'): ?>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      <?php else: ?>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <?php endif; ?>
      <span><?php echo htmlspecialchars($bnavLabel); ?></span>
    </a>

    <a href="#rose" class="bnav-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span>Rose</span>
    </a>

    <button type="button" class="bnav-item" id="btnBnavMore" aria-label="Apri menu completo" aria-controls="drawer-menu" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
      <span>Menu</span>
    </button>
  </nav>

  <!-- ====================================================================
       OFF-CANVAS DRAWER MENU
       ==================================================================== -->
  <div class="drawer-backdrop" id="drawerBackdrop"></div>

  <aside class="drawer" id="drawer-menu" aria-label="Menu di navigazione" aria-hidden="true" inert>
    <div class="drawer-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="img/logo.png" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" alt="Logo" />
        <span class="drawer-title"><?php echo htmlspecialchars($fcmNomeLega); ?></span>
      </div>
      <button class="modal-close-btn" id="btnCloseDrawer" aria-label="Chiudi Menu">&times;</button>
    </div>

    <!-- Selettore Rapido Tema in Testa al Drawer (Chiaro / Scuro / Sistema) -->
    <div class="drawer-theme-box" id="drawerThemeBox">
      <span class="drawer-theme-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <span>Tema</span>
      </span>
      <div class="theme-segmented-group" role="radiogroup" aria-label="Seleziona tema grafico">
        <button type="button" class="theme-seg-btn" data-theme-val="light" role="radio" aria-checked="false" title="Tema Chiaro">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <span>Chiaro</span>
        </button>
        <button type="button" class="theme-seg-btn" data-theme-val="dark" role="radio" aria-checked="false" title="Tema Scuro">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span>Scuro</span>
        </button>
        <button type="button" class="theme-seg-btn active" data-theme-val="system" role="radio" aria-checked="true" title="Segui impostazioni dispositivo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Sistema</span>
        </button>
      </div>
    </div>

    <div class="drawer-links">
      <!-- 1. 🏆 Competizioni & Partite -->
      <details class="drawer-accordion" open>
        <summary class="drawer-accordion-summary">
          <span class="drawer-accordion-title">⚽ Competizioni &amp; Partite</span>
          <svg class="drawer-accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <div class="drawer-accordion-body">
          <a href="#home" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
            Home Dashboard
          </a>
          <?php if (fcm_module_enabled('ModInvioFormazione', 'invform.php')): ?>
          <a href="#invform" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Invio Formazione
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModMercatoLibero', 'mercato/index.php')): ?>
          <a href="#mercato" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            Mercato Libero
          </a>
          <?php endif; ?>
          <a href="#classifica" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
              <path d="M4 22h16"></path>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
            </svg>
            Classifica
          </a>
          <a href="#calendario" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Calendario
          </a>
          <a href="#rose" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Rose
          </a>
          <a href="#formazioni" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="4"></rect>
              <circle cx="12" cy="12" r="4"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
            Formazioni
          </a>
          <a href="#risultati" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 4h20v12H2z"></path>
              <path d="M7 4v6h10V4"></path>
              <path d="M9.5 4v3h5V4"></path>
              <circle cx="12" cy="13" r="0.8"></circle>
              <path d="M9 16a3 3 0 0 1 6 0"></path>
            </svg>
            Risultati
          </a>
          <a href="#statistiche" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Statistiche (Giocatori liberi, etc.)
          </a>
          <?php if (fcm_module_enabled('ModLiveFantapazz')): ?>
          <a href="#liveFP" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Live Fantapazz
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModLiveFantaMaster')): ?>
          <a href="#liveFM" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="12 6 15 12 12 18 9 12 12 6"></polygon>
            </svg>
            Live FantaMaster
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModLiveVU')): ?>
          <a href="#liveVU" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Voti Ufficiosi PianetaFanta
          </a>
          <?php endif; ?>
          <a href="#calcolo" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"></rect>
              <line x1="8" y1="6" x2="16" y2="6"></line>
              <line x1="16" y1="14" x2="16" y2="18"></line>
              <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
            </svg>
            Calcolo Risultati Manuale
          </a>
          <a href="#registri" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Registri Voti FCM
          </a>
          <?php if (fcm_module_enabled('ModIndisponibili')): ?>
          <a href="#indisponibili" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Indisponibili &amp; Infortunati
          </a>
          <?php endif; ?>
          <a href="#schede_giocatori" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Schede Giocatori Serie A
          </a>
        </div>
      </details>

      <!-- 3. 📊 Statistiche & Archivio Storico -->
      <details class="drawer-accordion">
        <summary class="drawer-accordion-summary">
          <span class="drawer-accordion-title">📊 Statistiche &amp; Archivio Storico</span>
          <svg class="drawer-accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <div class="drawer-accordion-body">
          <?php if (fcm_module_enabled('ModStoricoAvanzato', 'persjs/fcmConfrontiDati.js')): ?>
          <a href="#storico" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"></path>
              <path d="M3 4v5h5"></path>
              <path d="M12 7v5l4 2"></path>
            </svg>
            Storico
          </a>
          <?php endif; ?>
          <a href="#albo" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            Albo d'Oro &amp; Palmares
          </a>
          <?php if (fcm_module_enabled('ModStoricoAvanzato', 'persjs/fcmConfrontiDati.js')): ?>
          <a href="#ranking" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Ranking Storico
          </a>
          <a href="#album" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Album Storico
          </a>
          <a href="#topflop" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            Top &amp; Flop Storico
          </a>
          <a href="#confrontidiretti" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 4l-4 4 4 4"></path>
              <path d="M4 8h11a5 5 0 0 1 5 5v1"></path>
              <path d="M16 20l4-4-4-4"></path>
              <path d="M20 16H9a5 5 0 0 1-5-5v-1"></path>
            </svg>
            Scontri Diretti
          </a>
          <a href="#confronti" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 21h18"></path>
              <path d="M7 21v-6"></path>
              <path d="M12 21v-10"></path>
              <path d="M17 21v-4"></path>
              <circle cx="17" cy="7" r="4"></circle>
              <path d="M17 5.5V7l1 1"></path>
            </svg>
            Confronti Storici
          </a>
          <a href="#recordstorici" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 21h8"></path>
              <path d="M12 17v4"></path>
              <path d="M7 4h10v5a5 5 0 0 1-10 0z"></path>
              <path d="M7 6H4.5a2.5 2.5 0 0 0 0 5H7"></path>
              <path d="M17 6h2.5a2.5 2.5 0 0 1 0 5H17"></path>
              <path d="m12 6.8.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z"></path>
            </svg>
            Record Storici
          </a>
          <a href="#almanacco" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Almanacco Storico
          </a>
          <a href="#rating" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 18a8 8 0 1 1 16 0"></path>
              <path d="M12 18l4-6"></path>
              <circle cx="12" cy="18" r="1"></circle>
              <path d="M6 18h1"></path>
              <path d="M17 18h1"></path>
              <path d="m18.5 4.5.5 1 1.1.2-.8.8.2 1.1-1-.5-1 .5.2-1.1-.8-.8 1.1-.2z"></path>
            </svg>
            Fanta Rating
          </a>
          <a href="#topcosti" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Top Costi Storico
          </a>
          <a href="#topcostistagione" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
              <line x1="12" y1="18" x2="12" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="6"></line>
            </svg>
            Top Costi Stagione
          </a>
          <a href="#archivio" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path d="M5 6v14h14V6"></path>
              <path d="M9 10h6M9 14h6"></path>
              <path d="M8 3h8l1 3H7l1-3z"></path>
            </svg>
            Archivio Stagioni
          </a>
          <?php endif; ?>
        </div>
      </details>

      <!-- 4. 🧰 Extra & Utility -->
      <details class="drawer-accordion">
        <summary class="drawer-accordion-summary">
          <span class="drawer-accordion-title">🧰 Extra &amp; Utility</span>
          <svg class="drawer-accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <div class="drawer-accordion-body">
          <a href="#extra" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
              <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"></path>
            </svg>
            Extra
          </a>
          <?php if (fcm_module_enabled('ModIncroci', 'js/incrociacalendari.js')): ?>
          <a href="#seavessiavuto" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Se avessi avuto...
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModFantaMassimi') && fcm_module_enabled('ModFantamister')): ?>
          <a href="#fantaMassimi" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 21h8"></path>
              <path d="M12 17v4"></path>
              <path d="M3 21h5v-6H3z"></path>
              <path d="M16 21h5v-9h-5z"></path>
              <path d="M9.5 15h5V9h-5z"></path>
              <path d="m12 2 1.2 2.4 2.6.4-1.9 1.9.4 2.6L12 8.1l-2.3 1.2.4-2.6L8.2 4.8l2.6-.4z"></path>
            </svg>
            FantaMassimi di Giornata
          </a>
          <a href="#fantaClassifica" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"></path>
              <path d="m19 9-5 5-4-4-3 3"></path>
            </svg>
            FantaClassifica Ipotetica
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModRecords', ['fantam/records.htm', 'records/records.htm'])): ?>
          <a href="#records" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            Records di Lega
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModFantamister')): ?>
          <a href="#fantam" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
              <path d="M2 2l7.5 6"></path>
              <path d="M22 2l-7.5 6"></path>
              <path d="M10.5 7h3l.5 2-2 1-2-1 .5-2z"></path>
              <path d="M11 10l-1.5 7 2.5 3.5 2.5-3.5-1.5-7"></path>
            </svg>
            FantaMister
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModEtaRose', 'js/fcmGiocatoriDati.js')): ?>
          <a href="#etaRose" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
              <path d="M8 3l-2-2M16 3l2-2"></path>
            </svg>
            Età Rose
          </a>
          <?php endif; ?>
          <a href="#documenti" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="8" y1="13" x2="16" y2="13"></line>
              <line x1="8" y1="17" x2="14" y2="17"></line>
            </svg>
            Documenti
          </a>
          <?php if (fcm_module_enabled('ModGuestbook', 'gbook182/gbook.php')): ?>
          <a href="#gbook" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Guestbook di Lega
          </a>
          <?php endif; ?>
          <?php if (fcm_module_enabled('ModCounter', 'fkounter5/counter.js.php')): ?>
          <a href="#stats" class="drawer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 20V10"></path>
              <path d="M12 20V4"></path>
              <path d="M6 20v-6"></path>
            </svg>
            Statistiche Visite
          </a>
          <?php endif; ?>
        </div>
      </details>
    </div>

    <!-- Pulsante Installa PWA in Calce al Drawer (visibile solo se non tramite PWA) -->
    <div class="drawer-pwa-install" id="drawerPwaInstall" style="display:none;">
      <button type="button" class="btn-pwa-drawer" id="btnDrawerInstall">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>📲 Installa come App</span>
      </button>
    </div>
  </aside>

  <!-- ====================================================================
       APPLICATION SCRIPTS
       ==================================================================== -->
  <script src="<?php echo fcm_ver('js/fcmDataLoader.js'); ?>"></script>
  <script src="<?php echo fcm_ver('js/views/homeView.js'); ?>"></script>
  <script src="<?php echo fcm_ver('js/views/classificaView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/calendarioView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/roseView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/formazioniView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/risultatiView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/statisticheView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/alboView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/almanaccoView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/topFlopView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/ratingView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/albumView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/confrontiStoriciView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/recordStoriciView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/topCostiView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/schedeGiocatoriView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/rankingView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/rankingDivisioniView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/registriView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/extraView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/fantaMassimiView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/fantaClassificaView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/indisponibiliView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/fantamView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/recordsView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/sectionsView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/fcmVotiLiveManager.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/fcmCalcoloMotore.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/liveVotiView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/views/calcoloView.js'); ?>" charset="UTF-8"></script>
  <script src="<?php echo fcm_ver('js/app.js'); ?>" charset="UTF-8"></script>

  <!-- ====================================================================
       PWA INSTALL OVERLAY BANNER (Mobile / Browser non standalone)
       ==================================================================== -->
  <div class="pwa-install-banner" id="pwaInstallBanner" style="display: none;">
    <div class="pwa-install-content">
      <img src="img/icon-192.png" alt="App Icon" class="pwa-install-icon" onerror="this.src='img/logo.png'">
      <div class="pwa-install-text">
        <div class="pwa-install-title" id="pwaInstallTitle">Installa <?php echo htmlspecialchars($fcmAppShortName); ?></div>
        <div class="pwa-install-subtitle" id="pwaInstallSubtitle">Aggiungi alla schermata Home</div>
      </div>
      <div class="pwa-install-actions">
        <button type="button" class="pwa-install-btn" id="btnPwaInstall">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Installa</span>
        </button>
        <button type="button" class="pwa-install-close" id="btnPwaDismiss" aria-label="Chiudi banner">&times;</button>
      </div>
    </div>
  </div>

  <!-- ====================================================================
       PWA IOS INSTRUCTIONS MODAL (Per utenti iPhone / Safari)
       ==================================================================== -->
  <div class="pwa-ios-modal" id="pwaIosModal" style="display: none;">
    <div class="pwa-ios-backdrop" id="pwaIosBackdrop"></div>
    <div class="pwa-ios-sheet">
      <div class="pwa-ios-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="img/icon-192.png" style="width:34px;height:34px;border-radius:8px;object-fit:cover;" alt="Logo" onerror="this.src='img/logo.png'">
          <div>
            <h4 id="iosModalTitle" style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">Installa <?php echo htmlspecialchars($fcmAppShortName); ?> su iPhone</h4>
            <span style="font-size:0.8rem;color:var(--text-muted);">Segui questi semplici passaggi</span>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="btnCloseIosModal" aria-label="Chiudi">&times;</button>
      </div>
      <div class="pwa-ios-body">
        <div class="pwa-ios-step">
          <div class="pwa-ios-step-num">1</div>
          <div class="pwa-ios-step-info">
            Tocca il pulsante <strong>Condividi</strong> in basso in Safari:
            <div>
              <div class="pwa-ios-badge">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                <span>Condividi</span>
              </div>
            </div>
          </div>
        </div>
        <div class="pwa-ios-step">
          <div class="pwa-ios-step-num">2</div>
          <div class="pwa-ios-step-info">
            Scorri l'elenco e tocca:
            <div>
              <div class="pwa-ios-badge">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span>Aggiungi alla schermata Home</span>
              </div>
            </div>
          </div>
        </div>
        <div class="pwa-ios-step">
          <div class="pwa-ios-step-num">3</div>
          <div class="pwa-ios-step-info">
            Premi <strong>"Aggiungi"</strong> in alto a destra per completare l'installazione.
          </div>
        </div>
      </div>
      <div class="pwa-ios-footer">
        <button type="button" class="btn-primary" id="btnIosGotIt" style="width:100%;border-radius:12px;padding:12px;font-weight:600;display:flex;align-items:center;justify-content:center;">
          Ho capito
        </button>
      </div>
    </div>
  </div>

  <!-- ====================================================================
       GESTIONE PWA SERVICE WORKER & PROMPT INSTALLAZIONE MOBILE
       ==================================================================== -->
  <script>
    (function() {
      // 1. Registrazione Service Worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('sw.js').catch(function(err) {
            navigator.serviceWorker.register('js/sw.js').catch(function(e) {
              console.warn('Service Worker non registrato:', e);
            });
          });
        });
      }

      // 2. Controllo se l'app è GIÀ in esecuzione in modalità Standalone (PWA installata)
      var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true ||
                         document.referrer.includes('android-app://');

      if (isStandalone) {
        // L'utente è già nella PWA: non mostrare banner né pulsanti
        return;
      }

      var banner = document.getElementById('pwaInstallBanner');
      var btnInstall = document.getElementById('btnPwaInstall');
      var btnDismiss = document.getElementById('btnPwaDismiss');
      var drawerItem = document.getElementById('drawerPwaInstall');
      var btnDrawerInstall = document.getElementById('btnDrawerInstall');
      var iosModal = document.getElementById('pwaIosModal');
      var iosBackdrop = document.getElementById('pwaIosBackdrop');
      var btnCloseIos = document.getElementById('btnCloseIosModal');
      var btnIosGotIt = document.getElementById('btnIosGotIt');

      // Se non in standalone, attiva il pulsante nel drawer laterale
      if (drawerItem) {
        drawerItem.style.display = 'block';
      }

      // Imposta i testi con il nome dinamico della lega
      var leagueName = (typeof nomelega !== 'undefined' && nomelega) ? nomelega : <?php echo json_encode($fcmAppShortName); ?>;
      var pwaTitle = document.getElementById('pwaInstallTitle');
      var pwaSubtitle = document.getElementById('pwaInstallSubtitle');
      var iosTitle = document.getElementById('iosModalTitle');
      if (pwaTitle) pwaTitle.textContent = 'Installa ' + leagueName;
      if (pwaSubtitle) pwaSubtitle.textContent = 'Aggiungi alla schermata Home';
      if (iosTitle) iosTitle.textContent = 'Installa ' + leagueName + ' su iPhone';

      var deferredPrompt = null;
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var bannerShown = false;
      var timeElapsed = false;

      // Gestione persistenza chiusura in localStorage per 7 giorni
      var STORAGE_KEY = 'pn_pwa_dismissed_until';
      function isDismissed() {
        try {
          var val = localStorage.getItem(STORAGE_KEY);
          if (!val) return false;
          var until = parseInt(val, 10);
          return !isNaN(until) && Date.now() < until;
        } catch (e) {
          return false;
        }
      }

      function recordDismissal() {
        try {
          var sevenDays = 7 * 24 * 60 * 60 * 1000;
          localStorage.setItem(STORAGE_KEY, (Date.now() + sevenDays).toString());
        } catch (e) {}
      }

      // Tracciamento navigazione sezioni differenti (almeno 2)
      var visitedSections = {};
      function recordSectionVisit() {
        var sec = (window.location.hash || '#home').split('?')[0];
        visitedSections[sec] = true;
        checkTriggerConditions();
      }

      function getVisitedSectionsCount() {
        var count = 0;
        for (var k in visitedSections) {
          if (visitedSections.hasOwnProperty(k)) count++;
        }
        return count;
      }

      function checkTriggerConditions() {
        if (bannerShown || isStandalone || isDismissed()) return;
        // Mostra solo se l'utente ha navigato almeno 2 sezioni differenti O dopo 20 secondi di navigazione
        var sectionsCondition = (getVisitedSectionsCount() >= 2);
        var timeCondition = timeElapsed;

        if (sectionsCondition || timeCondition) {
          if (deferredPrompt || isIOS) {
            showBanner();
          }
        }
      }

      function showBanner() {
        if (!banner || bannerShown || isDismissed()) return;
        bannerShown = true;
        banner.style.display = 'block';
        requestAnimationFrame(function() {
          banner.classList.add('visible');
        });
      }

      function hideBanner(userDismissed) {
        if (!banner) return;
        banner.classList.remove('visible');
        setTimeout(function() {
          banner.style.display = 'none';
        }, 350);
        if (userDismissed) {
          recordDismissal();
        }
      }

      function showIosModal() {
        if (iosModal) iosModal.style.display = 'flex';
      }

      function hideIosModal(userDismissed) {
        if (iosModal) iosModal.style.display = 'none';
        if (userDismissed) {
          recordDismissal();
        }
      }

      function triggerInstall() {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function(choice) {
            if (choice.outcome === 'accepted') {
              hideBanner(false);
              if (drawerItem) drawerItem.style.display = 'none';
            }
            deferredPrompt = null;
          });
        } else if (isIOS) {
          showIosModal();
        } else {
          alert("Per installare l'app, apri il menu del browser (⋮) e tocca 'Installa app' o 'Aggiungi a schermata Home'.");
        }
      }

      // Timer di 20 secondi di navigazione prima di consentire l'apertura
      setTimeout(function() {
        timeElapsed = true;
        checkTriggerConditions();
      }, 20000);

      // Tracciamento sezioni
      recordSectionVisit();
      window.addEventListener('hashchange', recordSectionVisit);

      // Android / Chrome: intercetta l'evento senza mostrare banner al caricamento iniziale
      window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        checkTriggerConditions();
      });

      if (btnInstall) btnInstall.addEventListener('click', triggerInstall);
      if (btnDrawerInstall) btnDrawerInstall.addEventListener('click', function() {
        if (typeof App !== 'undefined' && App.closeDrawer) App.closeDrawer();
        triggerInstall();
      });

      if (btnDismiss) btnDismiss.addEventListener('click', function() { hideBanner(true); });
      if (btnCloseIos) btnCloseIos.addEventListener('click', function() { hideIosModal(true); });
      if (btnIosGotIt) btnIosGotIt.addEventListener('click', function() { hideIosModal(false); });
      if (iosBackdrop) iosBackdrop.addEventListener('click', function() { hideIosModal(true); });

      window.addEventListener('appinstalled', function() {
        hideBanner(false);
        if (drawerItem) drawerItem.style.display = 'none';
        deferredPrompt = null;
      });
    })();
  </script>
</body>

</html>