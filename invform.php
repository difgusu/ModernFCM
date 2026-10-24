<?php
error_reporting(0);
ini_set('display_errors', 0);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (file_exists(__DIR__ . '/inc/getprossima.php')) {
    require_once __DIR__ . '/inc/getprossima.php';
} elseif (file_exists(__DIR__ . '/getprossima.php')) {
    require_once __DIR__ . '/getprossima.php';
}
$defaultProssimaGiornata = function_exists('getprossima') ? getprossima() : 1;

// Caricamento configurazione amministratore (admin_config.inc.php o invform.inc.php)
if (file_exists(__DIR__ . '/invform/admin_config.inc.php')) {
    require_once __DIR__ . '/invform/admin_config.inc.php';
} elseif (file_exists(__DIR__ . '/invform/invform.inc.php')) {
    require_once __DIR__ . '/invform/invform.inc.php';
}

$isAdminMode = !empty($_GET['admin']) || basename($_SERVER['SCRIPT_NAME'] ?? '') === 'invform_prec.php';

// Gestione Logout per modalità amministratore
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    unset($_SESSION['pn_admin_logged']);
    $redir = $isAdminMode ? (basename($_SERVER['SCRIPT_NAME'] ?? '') === 'invform_prec.php' ? 'invform_prec.php' : 'invform.php?admin=1') : 'invform.php';
    header("Location: $redir");
    exit;
}

$isPasswordConfigured = !empty($adminPassword) && $adminPassword !== '[PASSWORD]';
$loginError = '';

// Gestione Login Amministratore POST
if ($isAdminMode && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_login_pwd'])) {
    if (!$isPasswordConfigured) {
        $loginError = 'Accesso disabilitato: password amministratore non configurata in admin_config.inc.php.';
    } else {
        $submittedPwd = (string)$_POST['admin_login_pwd'];
        if (hash_equals((string)$adminPassword, $submittedPwd)) {
            $_SESSION['pn_admin_logged'] = true;
            $redir = basename($_SERVER['PHP_SELF'] ?? 'invform.php');
            if (!empty($_SERVER['QUERY_STRING'])) {
                $redir .= '?' . $_SERVER['QUERY_STRING'];
            }
            header("Location: $redir");
            exit;
        } else {
            $loginError = 'Password amministratore errata. Riprova.';
        }
    }
}

$isAdminLogged = $isPasswordConfigured && !empty($_SESSION['pn_admin_logged']);

if (!function_exists('fcm_module_enabled')) {
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
}

if (!fcm_module_enabled('ModInvioFormazione') && !$isAdminMode) {
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invio Formazione Disabilitato - ModernFCM</title>
    <link href="css/style.css" rel="stylesheet" type="text/css" />
</head>
<body style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 20px;">
    <div style="max-width: 500px; text-align: center; background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
        <h2 style="margin: 0 0 12px 0; font-size: 1.5rem; font-weight: 700;">Modulo Invio Formazione Non Attivo</h2>
        <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">Il modulo per l'invio delle formazioni online è stato disabilitato dall'amministratore di lega nelle impostazioni del sito.</p>
        <a href="index.php#home" style="display: inline-flex; align-items: center; gap: 8px; background: #3b82f6; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Torna al Sito</a>
    </div>
</body>
</html>
<?php
    exit;
}

$reqGio = !empty($_GET['Gio']) ? intval($_GET['Gio']) : (!empty($_GET['day']) ? intval($_GET['day']) : (!empty($_GET['gio']) ? intval($_GET['gio']) : $defaultProssimaGiornata));
if ($reqGio < 1) $reqGio = 1;
if ($reqGio > 38) $reqGio = 38;
$reqFsq = !empty($_GET['Fsq']) ? intval($_GET['Fsq']) : 1;
$reqGioPrec = ($reqGio > 1) ? ($reqGio - 1) : 1;

// Verifica lato server termine d'invio (saltata per modalità amministratore)
$isTermineScadutoServer = false;
if (!$isAdminMode && file_exists('invform/invform.inc.php')) {
    @include 'invform/invform.inc.php';
    if (isset($controllaOrarioInvio) && $controllaOrarioInvio && isset($orariInizio[$reqGio])) {
        try {
            $dtTermine = new DateTime($orariInizio[$reqGio], new DateTimeZone('Europe/Rome'));
            $antVal = isset($anticipoInvio) ? intval($anticipoInvio) : 30;
            $dtTermine->sub(new DateInterval("PT{$antVal}M"));
            $dtNow = new DateTime('now', new DateTimeZone('Europe/Rome'));
            if ($dtTermine->getTimestamp() <= $dtNow->getTimestamp()) {
                $isTermineScadutoServer = true;
            }
        } catch (Exception $e) {
            $isTermineScadutoServer = false;
        }
    }
}
$pname = $isAdminMode ? "invform_prec" : "invform";
?>
<!DOCTYPE html>
<html lang="it" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="author" content="difgusu">
    <title><?php echo $isAdminMode ? 'Servizio Admin - Inserimento Formazioni' : 'Invio Formazione - ModernFCM'; ?></title>
    
    <!-- Design System & Styles (Master Unified CSS) -->
    <link href="css/style.css?v=<?php echo filemtime('css/style.css'); ?>" rel="stylesheet" type="text/css" />

    <script type="text/javascript">
        window.pname = "<?php echo $pname; ?>";
        // Sincronizzazione immediata tema Dark / Light da localStorage (anti-flicker) e modalità iframe
        (function() {
            var savedTheme = localStorage.getItem('pn_theme') || 'system';
            var resolved = savedTheme;
            if (savedTheme === 'system' || (savedTheme !== 'light' && savedTheme !== 'dark')) {
                resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', resolved);
            if (window.self !== window.top) {
                document.documentElement.classList.add('in-iframe');
            }
        })();
    </script>

    <script src="js/fcmCostruttori.js" type="text/javascript"></script>
    <script src="js/fcmVariabili.js?<?php echo filemtime('js/fcmVariabili.js');?>" type="text/javascript"></script>
    <script src="js/fcmLegaDati.js?<?php echo filemtime('js/fcmLegaDati.js');?>" type="text/javascript"></script>
    <script src="js/fcmSerieADati.js?<?php echo filemtime('js/fcmSerieADati.js');?>" type="text/javascript"></script>
    <script src="js/fcmCompetizioniDati.js?<?php echo filemtime('js/fcmCompetizioniDati.js');?>" type="text/javascript"></script>
    <script src="js/fcmCalendarioDati.js?<?php echo filemtime('js/fcmCalendarioDati.js');?>" type="text/javascript"></script>
    <script src="js/fcmFantasquadreDati.js?<?php echo filemtime('js/fcmFantasquadreDati.js');?>" type="text/javascript"></script>
    <script src="js/javacrypt.js" type="text/javascript"></script>
    <script src="js/fcmDataLoader.js?<?php echo filemtime('js/fcmDataLoader.js');?>" type="text/javascript"></script>

    <?php 
    $formazioniDatiFile = "js/fcmFormazioniDati{$reqGio}.js";
    $formazioniDatiVer = file_exists($formazioniDatiFile) ? filemtime($formazioniDatiFile) : time();
    ?>
    <?php if (!$isTermineScadutoServer || $isAdminMode): ?>
    <script src="<?php echo $formazioniDatiFile; ?>?v=<?php echo $formazioniDatiVer; ?>" type="text/javascript"></script>
    <?php endif; ?>
    <script src="invform/invform.php?azione=ottieneTermine&giornataDiA=<?php echo $reqGio; ?>" type="text/javascript"></script>
    <?php if (!$isTermineScadutoServer || $isAdminMode): ?>
    <script src="invform/formprec.php?giornata=<?php echo $reqGioPrec; ?>&fsq=<?php echo $reqFsq; ?>" type="text/javascript"></script>
    <?php endif; ?>

    <script language="JavaScript" type="text/javascript">
        var cGio, cFsq, cGioPrec, cVmin, cMod, cAff, cMvFm, cCF, cPanc;
        var pname = "<?php echo $pname; ?>";
        window.pname = "<?php echo $pname; ?>";
        cFsq = parseInt(JSQueryString("Fsq")) || <?php echo $reqFsq; ?>;
        cGio = parseInt(JSQueryString("Gio")) || <?php echo $reqGio; ?>;
        cVmin = JSQueryString("Vmin"); cMod = JSQueryString("Mod");
        cAff = JSQueryString("Aff"); cMvFm = JSQueryString("MvFm");
        cCF = JSQueryString("CF"); cPanc = JSQueryString("Panc");

        var serverProxGio = <?php echo intval($defaultProssimaGiornata); ?>;
        var maxLimit = (typeof MaxA !== 'undefined' && MaxA > 0) ? MaxA : 38;
        var ultGio = (typeof GetUltimaGiornataGiocata === 'function') ? GetUltimaGiornataGiocata() : 1;
        var proxGio = (serverProxGio && serverProxGio >= 1 && serverProxGio <= maxLimit)
            ? serverProxGio
            : ((typeof GetProssimaGiornataDaGiocare === 'function') ? GetProssimaGiornataDaGiocare() : 1);
        if (proxGio > maxLimit) proxGio = maxLimit;

        if (isNaN(cFsq) && typeof arrFantasquadre !== 'undefined' && arrFantasquadre[1]) {
            cFsq = arrFantasquadre[1].ID;
        }

        if (isNaN(cGio) || cGio < 1 || cGio > maxLimit) { 
            cGio = proxGio; 
        }

        cGioPrec = (cGio > 1) ? (cGio - 1) : 1;
        var termineInvio;
        var isTermineScadutoServer = <?php echo $isTermineScadutoServer ? 'true' : 'false'; ?>;
    </script>

    <script src="js/fcmInvioFormazioneFunzioni.js?<?php echo filemtime('js/fcmInvioFormazioneFunzioni.js');?>" type="text/javascript"></script>
    <?php if (file_exists('js/fcmInvioFormazioneDati.js')): ?>
    <script src="js/fcmInvioFormazioneDati.js?<?php echo filemtime('js/fcmInvioFormazioneDati.js');?>" type="text/javascript"></script>
    <?php endif; ?>
    <?php if (!$isAdminMode || $isAdminLogged): ?>
    <?php if (!$isTermineScadutoServer || $isAdminMode): ?>
    <script src="js/fcmSerieADatiDettaglio.js?<?php echo filemtime('js/fcmSerieADatiDettaglio.js');?>" type="text/javascript"></script>
    <?php if (fcm_module_enabled('ModIndisponibili')): ?>
    <?php if (file_exists('js/probform_extractFunzioni.js')): ?>
    <script src="js/probform_extractFunzioni.js" type="text/javascript"></script>
    <?php endif; ?>
    <?php if (file_exists('js/ProbFGDati.js')): ?>
    <script src="js/ProbFGDati.js?<?php $lolledati = filemtime('js/ProbFGDati.js'); echo $lolledati; ?>" type="text/javascript"></script>
    <?php if ((time() - filemtime('js/ProbFGDati.js')) > 3600): ?>
    <script type="text/javascript">
        if (window.fetch) { fetch('inc/probform_extract.php', { cache: 'no-store' }).catch(function(){}); }
    </script>
    <?php endif; ?>
    <?php elseif (file_exists('inc/probform_extract.php') || file_exists('probform_extract.php')): ?>
    <script type="text/javascript">
        if (window.fetch) { fetch('inc/probform_extract.php', { cache: 'no-store' }).catch(function(){}); }
    </script>
    <?php endif; ?>
    <?php endif; ?>
    <?php endif; ?>
    <?php endif; ?>
    <script src="js/fcmVariabiliJdPI.js?<?php echo filemtime('js/fcmVariabiliJdPI.js');?>" type="text/javascript"></script>
</head>
<body class="invform-page">

<div class="invform-container">

    <!-- HEADER DI NAVIGAZIONE MODERNO -->
    <header class="invform-nav">
        <a href="index.php#home" class="invform-brand">
            <img src="img/logo.png" alt="ModernFCM" onerror="this.src='img/sq/0.gif'">
            <div class="invform-title-wrap">
                <span class="invform-main-title"><?php echo $isAdminMode ? 'ModernFCM • Servizio Admin' : 'ModernFCM'; ?></span>
                <span class="invform-subtitle"><?php echo $isAdminMode ? 'Inserimento Formazioni a Termine Scaduto' : 'Modulo Invio Formazione'; ?></span>
            </div>
        </a>
        <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" id="btnToggleTheme" class="invform-back-btn" title="Cambia tema chiaro/scuro" style="cursor: pointer; padding: 8px 12px;">
                <span id="themeIcon">🌓</span>
            </button>
            <?php if ($isAdminMode && $isAdminLogged): ?>
            <a href="?action=logout<?php echo !empty($_GET['admin']) ? '&admin=1' : ''; ?>" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Esci dalla sessione amministratore">
                <span>🚪 Esci</span>
            </a>
            <?php endif; ?>
            <a href="index.php#home" class="invform-back-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Torna al Sito</span>
            </a>
        </div>
    </header>

    <!-- CARD TITOLO PAGINA (Stile unificato con le altre pagine della skin) -->
    <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
            <div>
                <div class="card-title" style="display: flex; align-items: center; gap: 10px; font-size: 1.25rem;">
                    <span style="display:inline-flex;align-items:center;justify-content:center;color:var(--accent-primary, #0284c7);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </span>
                    <span><?php echo $isAdminMode ? 'Invio Formazione • Servizio Admin' : 'Invio Formazione'; ?></span>
                </div>
                <div class="card-subtitle" style="margin-top: 4px;">
                    <?php echo $isAdminMode ? 'Inserimento formazioni a termine scaduto (accesso amministratore)' : 'Schieramento calciatori titolari, riserve e rigoristi per la giornata'; ?>
                </div>
            </div>
            <div id="invHeaderActions" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <?php if ($isAdminMode): ?>
                <a id="btnTornaInvformStandard" href="invform.php?Gio=<?php echo $reqGio; ?>&Fsq=<?php echo $reqFsq; ?>" class="standalone-btn" title="Torna alla pagina normale di invio formazione">
                    &larr; Invio Formazione Standard
                </a>
                <?php if ($isAdminLogged): ?>
                <span class="standalone-btn" style="background:rgba(16,185,129,0.15); color:#10b981; border-color:rgba(16,185,129,0.3); cursor:default;">
                    🛡️ Servizio Admin Attivo
                </span>
                <a href="?action=logout<?php echo !empty($_GET['admin']) ? '&admin=1' : ''; ?>" class="standalone-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.4); font-weight:700;" title="Disconnettiti dalla sessione amministratore">
                    🚪 Esci
                </a>
                <?php endif; ?>
                <?php else: ?>
                <!-- Pulsante Admin visualizzato solo quando il termine è scaduto -->
                <a id="btnAdminScaduto" href="invform_prec.php?Gio=<?php echo $reqGio; ?>&Fsq=<?php echo $reqFsq; ?>" class="standalone-btn" style="display:none; color:#f59e0b; border-color:rgba(245,158,11,0.4);" title="Servizio Amministratore: Inserisci formazione a termine scaduto">
                    🛡️ Servizio Admin (Scaduto) &rarr;
                </a>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <?php if ($isAdminMode && !$isAdminLogged): ?>
    <!-- FORM DI AUTENTICAZIONE AMMINISTRATORE -->
    <div style="max-width: 440px; margin: 40px auto; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg, 12px); padding: 28px; box-shadow: 0 12px 30px rgba(0,0,0,0.15);">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 2.8rem; margin-bottom: 8px;">🔐</div>
            <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Accesso Riservato Amministratore</h2>
            <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Inserisci la password di amministrazione per accedere al pannello di servizio ed inserire formazioni direttamente sul sito a termine scaduto.
            </p>
        </div>

        <?php if (!$isPasswordConfigured): ?>
        <div style="color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 14px; font-size: 0.88rem; font-weight: 600; text-align: center; line-height: 1.5; margin-bottom: 18px;">
            ⚠️ <strong>Configurazione Amministratore Incompleta</strong><br>
            La variabile <code>$adminPassword</code> non è impostata in <code>admin_config.inc.php</code>.<br>
            Per motivi di sicurezza, l'accesso a questo pannello è disabilitato finché non configuri la password.
        </div>
        <?php else: ?>
        <?php if (!empty($loginError)): ?>
        <div style="color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; font-weight: 600; margin-bottom: 18px; text-align: center;">
            ⚠️ <?php echo htmlspecialchars($loginError); ?>
        </div>
        <?php endif; ?>

        <form method="post" action="<?php echo htmlspecialchars($_SERVER['REQUEST_URI'] ?? ''); ?>">
            <div style="margin-bottom: 20px;">
                <label for="admin_login_pwd" style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Password Amministrazione:</label>
                <input type="password" id="admin_login_pwd" name="admin_login_pwd" class="inv-password-input" placeholder="Inserisci password admin..." required autofocus style="width: 100%; box-sizing: border-box; padding: 10px 14px; font-size: 0.95rem; border-radius: 8px;">
            </div>
            <button type="submit" class="inv-btn-submit" style="width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; border-radius: 8px; margin-bottom: 12px;">
                🔑 Sblocca Pagina di Servizio
            </button>
        </form>
        <?php endif; ?>

        <!-- Pulsante Torna a Invio Formazione Standard dalla schermata di login -->
        <div style="text-align: center; margin-top: 10px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); padding-top: 14px;">
            <a href="invform.php?Gio=<?php echo $reqGio; ?>&Fsq=<?php echo $reqFsq; ?>" class="invform-back-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 10px; font-size: 0.85rem; font-weight: 700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Torna a Invio Formazione Standard</span>
            </a>
        </div>
    </div>
    <?php else: ?>

    <?php if ($isAdminMode): ?>
    <!-- BANNER MODALITÀ AMMINISTRATORE -->
    <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-md, 8px); padding: 12px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.4rem;">🛡️</span>
            <div>
                <strong style="font-size: 0.9rem; color: var(--accent-emerald, #10b981); display: block;">Modalità Servizio Amministratore Attiva</strong>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">
                    Le formazioni salvate da questo pannello vengono registrate sul sito <strong>senza inviare alcuna e-mail o notifica Telegram</strong>, anche dopo la scadenza del termine di consegna.
                </span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <a href="?action=logout<?php echo !empty($_GET['admin']) ? '&admin=1' : ''; ?>" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.35); font-weight: 700; background: rgba(239, 68, 68, 0.08);" title="Disconnettiti dalla sessione amministratore">
                <span>🚪 Esci da Sessione Admin</span>
            </a>
        </div>
    </div>
    <?php endif; ?>

    <script language="JavaScript" type="text/javascript">
        // ==========================================================================
        // TOOLTIP MODERNO VANILLA JS: Infortuni, Squalifiche e Dubbi
        // ==========================================================================
        (function() {
            var tooltipEl = null;
            var currentTarget = null;
            var hideTimeout = null;

            function getOrCreateTooltip(ownerDoc) {
                var doc = ownerDoc || document;
                if (tooltipEl && tooltipEl.ownerDocument !== doc) {
                    tooltipEl.style.display = 'none';
                    tooltipEl.classList.remove('visible');
                }
                var tt = doc.getElementById('injuryTooltip');
                if (!tt) {
                    tt = doc.createElement('div');
                    tt.id = 'injuryTooltip';
                    tt.className = 'injury-tooltip';
                    tt.setAttribute('role', 'tooltip');
                    tt.setAttribute('aria-hidden', 'true');
                    doc.body.appendChild(tt);
                }
                tooltipEl = tt;
                return tt;
            }

            function decodeHtmlEntities(str) {
                if (!str) return '';
                var txt = document.createElement('textarea');
                txt.innerHTML = str;
                return txt.value;
            }

            function escapeHtml(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            }

            function showTooltip(el) {
                clearTimeout(hideTimeout);
                if (!el || !el.classList || !el.classList.contains('infortunio')) return;

                var id = el.getAttribute('data-id');
                var motivo = (el.getAttribute('data-motivo') || '').trim();
                var rientro = (el.getAttribute('data-rientro') || '').trim();
                var alt = (el.getAttribute('alt') || '').trim();

                // Fallback di sicurezza: se presente data-id, recupera i testi integri direttamente da arrIndisponibili
                if (id && typeof arrIndisponibili !== 'undefined' && arrIndisponibili && arrIndisponibili[id]) {
                    var indData = arrIndisponibili[id];
                    if (!motivo) motivo = indData.Motivo || '';
                    if (!rientro) rientro = indData.Rientro || '';
                }

                if (!motivo && !rientro && !alt) return;

                // Decodifica entità HTML e ripulisce backslash residui di escaping PHP/JS
                motivo = decodeHtmlEntities(motivo.replace(/\\'/g, "'"));
                rientro = decodeHtmlEntities(rientro.replace(/\\'/g, "'"));

                // Previene il tooltip browser nativo salvando e rimuovendo title
                if (el.hasAttribute('title')) {
                    el.setAttribute('data-orig-title', el.getAttribute('title'));
                    el.removeAttribute('title');
                }

                var doc = el.ownerDocument || document;
                var win = doc.defaultView || window;
                var tt = getOrCreateTooltip(doc);
                currentTarget = el;

                var isSqualif = (alt.toLowerCase().indexOf('squalif') !== -1 || motivo.toLowerCase().indexOf('squalif') !== -1);
                var isDubbio = (alt.toLowerCase().indexOf('dubbio') !== -1 || motivo.toLowerCase().indexOf('dubbio') !== -1);

                var badgeClass = isSqualif ? 'badge-squalificato' : (isDubbio ? 'badge-dubbio' : 'badge-infortunato');
                var badgeLabel = isSqualif ? '🟥 Squalificato' : (isDubbio ? '⚠️ In Dubbio' : '🚑 Infortunato');
                var motivoText = motivo || (isSqualif ? 'Squalificato' : (isDubbio ? 'In dubbio' : 'Infortunato'));

                var html = '<div class="injury-tooltip-top">' +
                           '<span class="injury-tooltip-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
                           '</div>' +
                           '<div class="injury-tooltip-motivo">' + escapeHtml(motivoText) + '</div>';

                if (rientro) {
                    html += '<div class="injury-tooltip-rientro">' + escapeHtml(rientro) + '</div>';
                }

                tt.innerHTML = html;
                tt.style.display = 'block';
                tt.classList.remove('pos-bottom');

                // Posizionamento dinamico intelligente
                var rect = el.getBoundingClientRect();
                var ttRect = tt.getBoundingClientRect();
                var ttWidth = ttRect.width || 210;
                var ttHeight = ttRect.height || 64;

                var scrollX = win.pageXOffset || doc.documentElement.scrollLeft || 0;
                var scrollY = win.pageYOffset || doc.documentElement.scrollTop || 0;

                // Default: sopra l'icona
                var top = rect.top + scrollY - ttHeight - 8;
                if (rect.top - ttHeight - 8 < 10) {
                    top = rect.bottom + scrollY + 8;
                    tt.classList.add('pos-bottom');
                }

                var iconCenterX = rect.left + (rect.width / 2);
                var left = iconCenterX - (ttWidth / 2) + scrollX;

                // Evita overflow orizzontale a sinistra o a destra del viewport
                var minLeft = scrollX + 8;
                var maxLeft = scrollX + (win.innerWidth || doc.documentElement.clientWidth) - ttWidth - 8;
                var clampedLeft = Math.max(minLeft, Math.min(left, maxLeft));

                var arrowLeft = Math.max(12, Math.min(iconCenterX + scrollX - clampedLeft, ttWidth - 12));
                tt.style.setProperty('--arrow-left', Math.round(arrowLeft) + 'px');

                tt.style.top = Math.round(top) + 'px';
                tt.style.left = Math.round(clampedLeft) + 'px';

                requestAnimationFrame(function() {
                    tt.classList.add('visible');
                    tt.setAttribute('aria-hidden', 'false');
                });
            }

            function hideTooltip(immediate) {
                if (!tooltipEl) return;
                if (immediate) {
                    clearTimeout(hideTimeout);
                    tooltipEl.classList.remove('visible');
                    tooltipEl.setAttribute('aria-hidden', 'true');
                    tooltipEl.style.display = 'none';
                    currentTarget = null;
                } else {
                    clearTimeout(hideTimeout);
                    hideTimeout = setTimeout(function() {
                        if (tooltipEl) {
                            tooltipEl.classList.remove('visible');
                            tooltipEl.setAttribute('aria-hidden', 'true');
                            setTimeout(function() {
                                if (tooltipEl && !tooltipEl.classList.contains('visible')) {
                                    tooltipEl.style.display = 'none';
                                }
                            }, 180);
                        }
                        currentTarget = null;
                    }, 100);
                }
            }

            function handleTargetClick(e) {
                var target = e.target ? e.target.closest('.infortunio') : null;
                if (target) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (currentTarget === target && tooltipEl && tooltipEl.classList.contains('visible')) {
                        hideTooltip(true);
                    } else {
                        showTooltip(target);
                    }
                } else {
                    hideTooltip(true);
                }
            }

            function attachListeners(doc) {
                if (!doc || doc._hasInjuryTooltipListeners) return;
                doc._hasInjuryTooltipListeners = true;

                // Event delegation globale con useCapture: true per intercettare prima dei click inline
                doc.addEventListener('mouseover', function(e) {
                    var target = e.target ? e.target.closest('.infortunio') : null;
                    if (target) {
                        showTooltip(target);
                    }
                }, true);

                doc.addEventListener('mouseout', function(e) {
                    var target = e.target ? e.target.closest('.infortunio') : null;
                    if (target) {
                        hideTooltip(false);
                    }
                }, true);

                doc.addEventListener('click', handleTargetClick, true);

                var win = doc.defaultView || window;
                win.addEventListener('scroll', function() {
                    if (tooltipEl && tooltipEl.classList.contains('visible')) {
                        hideTooltip(true);
                    }
                }, { passive: true });

                doc.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' || e.keyCode === 27) {
                        hideTooltip(true);
                    }
                });
            }

            attachListeners(document);
            try {
                if (window.top && window.top !== window && window.top.document) {
                    attachListeners(window.top.document);
                }
            } catch (err) {}

            // Funzione globale mantenuta per piena retrocompatibilità con i richiami in fcmInvioFormazioneFunzioni.js
            window.InizializzaQTipInfortuni = function(context) {
                getOrCreateTooltip();
                try {
                    if (window.top && window.top !== window && window.top.document) {
                        attachListeners(window.top.document);
                    }
                } catch (err) {}
                var root = context ? (typeof context === 'string' ? document.querySelector(context) : context) : document.body;
                if (root) {
                    var items = root.querySelectorAll ? root.querySelectorAll('.infortunio') : [];
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].hasAttribute('title')) {
                            items[i].setAttribute('data-orig-title', items[i].getAttribute('title'));
                            items[i].removeAttribute('title');
                        }
                    }
                }
            };
        })();

        document.addEventListener('DOMContentLoaded', function () {
            // Inizializza tooltip infortuni nativo
            if (typeof InizializzaQTipInfortuni === 'function') {
                InizializzaQTipInfortuni();
            }

            // Gestione del pulsante cambio tema
            var themeBtn = document.getElementById('btnToggleTheme');
            var themeIcon = document.getElementById('themeIcon');
            function updateIcon(th) {
                if (themeIcon) themeIcon.textContent = (th === 'dark') ? '🌙' : '☀️';
            }
            var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            updateIcon(currentTheme);

            if (themeBtn) {
                themeBtn.addEventListener('click', function() {
                    var curr = document.documentElement.getAttribute('data-theme') || 'light';
                    var next = curr === 'dark' ? 'light' : 'dark';
                    document.documentElement.setAttribute('data-theme', next);
                    localStorage.setItem('pn_theme', next);
                    updateIcon(next);
                });
            }

            // Sincronizzazione tema quando invocato da SPA (messaggi postMessage)
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'pn_theme_change') {
                    var th = e.data.theme || 'light';
                    document.documentElement.setAttribute('data-theme', th);
                    updateIcon(th);
                }
            });

            // Observer sul cambio attributo data-theme per aggiornare icona
            if (window.MutationObserver) {
                var themeObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        if (m.attributeName === 'data-theme') {
                            var th = document.documentElement.getAttribute('data-theme') || 'light';
                            updateIcon(th);
                        }
                    });
                });
                themeObserver.observe(document.documentElement, { attributes: true });
            }

            <?php if (!$isAdminMode): ?>
            // Controllo per far comparire il pulsante Admin solo quando la formazione è scaduta
            function AggiornaPulsanteAdminScaduto() {
                var btnAdmin = document.getElementById('btnAdminScaduto');
                if (!btnAdmin) return;
                var scaduto = (typeof IsTermineScaduto === 'function') ? IsTermineScaduto() : false;
                if (!scaduto && typeof termineInvio !== 'undefined' && termineInvio && termineInvio.secondiRimasti !== undefined) {
                    if (termineInvio.secondiRimasti <= 0) scaduto = true;
                }
                if (scaduto) {
                    var targetGio = (typeof cGio !== 'undefined' && cGio) ? cGio : <?php echo $reqGio; ?>;
                    var targetFsq = (typeof cFsq !== 'undefined' && cFsq) ? cFsq : <?php echo $reqFsq; ?>;
                    btnAdmin.href = 'invform_prec.php?Gio=' + encodeURIComponent(targetGio) + '&Fsq=' + encodeURIComponent(targetFsq);
                    btnAdmin.style.display = 'inline-flex';
                } else {
                    btnAdmin.style.display = 'none';
                }
            }

            AggiornaPulsanteAdminScaduto();
            var adminScadutoTimer = setInterval(function () {
                AggiornaPulsanteAdminScaduto();
                var scaduto = (typeof IsTermineScaduto === 'function') ? IsTermineScaduto() : false;
                if (!scaduto && typeof termineInvio !== 'undefined' && termineInvio && termineInvio.secondiRimasti !== undefined) {
                    if (termineInvio.secondiRimasti <= 0) scaduto = true;
                }
                if (scaduto && adminScadutoTimer) {
                    clearInterval(adminScadutoTimer);
                    adminScadutoTimer = null;
                }
            }, 1000);

            window.addEventListener('pagehide', function () {
                if (adminScadutoTimer) {
                    clearInterval(adminScadutoTimer);
                    adminScadutoTimer = null;
                }
            });
            <?php endif; ?>
        });
    </script>
    
    <?php 
    // --- FIX PHP 8: Gestione date senza strftime ---
    $day = date("d");
    $month = date("m");
    $year = date("Y");
    $hour = date("H");
    $min = date("i");
    $timeinv = $year . $month . $day . $hour . $min;
    $time = "$day/$month/$year $hour.$min";

    function getGiornoIta($timestamp) {
        $giorni = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
        return $giorni[date("w", $timestamp)];
    }

    $lolledati = ((fcm_module_enabled('ModIndisponibili') || $isAdminMode) && file_exists('js/ProbFGDati.js')) ? filemtime('js/ProbFGDati.js') : time();
    $lolle = strtolower(getGiornoIta($lolledati)) . " " . date("d/m/Y, H:i", $lolledati); 
    ?>   

    <!-- CONTENITORE SELETTORE FANTASQUADRA & GIORNATA -->
    <div id="invFormHeaderContainer"></div>

    <script language="JavaScript" type="text/javascript">
        var lolle = "<?php echo $lolle; ?>"; 
        GeneraIntestazioneInvioFormazione(cFsq, cGio, "<?php echo $pname; ?>");
    </script>

    <div id="MainContainer">
        <!-- Incontri e termine invio -->
        <div id="invCompArea"></div>

        <!-- Area invio (Campetto, Tabella Dettagliata, Probabili) -->
        <div id="invTabelleArea"></div>

        <!-- Controlli per invio e password -->
        <div id="invControlliArea"></div>

        <script language="JavaScript" type="text/javascript">
            if (GeneraSelezioneCompetizioni(cFsq, cGio, "<?php echo $pname; ?>")) {
                <?php if ($isAdminMode): ?>
                GeneraTabelleGiocatori(); 
                GeneraControlliPerInvio("invform_prec");
                ReimpostaFormazione();
                <?php else: ?>
                <?php if (!$isTermineScadutoServer): ?>
                if (!IsTermineScaduto()) {
                    GeneraTabelleGiocatori(); 
                    GeneraControlliPerInvio("invform");
                    ReimpostaFormazione();
                } else {
                    GestisciTermineScaduto(true);
                }
                <?php else: ?>
                GestisciTermineScaduto(true);
                <?php endif; ?>
                <?php endif; ?>
            }
        </script>
    </div>
    <?php endif; ?>

    <footer style="text-align: center; padding: 24px 10px; font-size: 0.75rem; color: var(--text-muted, #64748b);">
        ModernFCM • <?php echo $isAdminMode ? 'Pagina di Servizio Amministratore' : 'Modulo Invio Formazione'; ?> • Powered by John Doe, Puffin, Frbiag, Maelstrom, difgusu
    </footer>

</div>

<!-- Tooltip Giocatore Campetto Tattico Desktop -->
<div id="tacticalPlayerTooltip"></div>

<?php if (file_exists('fkounter5/counter.js.php') && (!function_exists('fcm_module_enabled') || fcm_module_enabled('ModCounter'))): ?>
<script type="text/javascript">
if (window.self === window.top) {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'fkounter5/counter.js.php?id=invform&mode=hidden';
    document.body.appendChild(s);
}
</script>
<?php endif; ?>
</body>
</html>