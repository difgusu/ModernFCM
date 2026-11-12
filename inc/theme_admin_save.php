<?php
/**
 * ModernFCM - Theme Admin Save & API
 * File: inc/theme_admin_save.php
 * Endpoint protetto per il salvataggio e ripristino delle personalizzazioni del tema grafico.
 */

require_once __DIR__ . '/admin_security.inc.php';
// La sessione si apre solo se il browser ne ha già una: la lettura pubblica non ne crea di nuove
$hasAdminSession = fcm_admin_session_active();

header('Content-Type: application/json; charset=utf-8');
// Senza sessione PHP mancherebbero le sue intestazioni anti-cache: la risposta non va memorizzata
header('Cache-Control: no-store, no-cache, must-revalidate');

$baseDir = dirname(__DIR__);
$configPath = __DIR__ . '/data/theme_config.json';
$backupPath = __DIR__ . '/data/theme_config.json.bak';
$adminConfigFile = $baseDir . '/inc/admin_config.inc.php';

require_once __DIR__ . '/theme_loader.php';

// Carica configurazione admin per la password
$adminPassword = '';
if (file_exists($adminConfigFile)) {
    require_once $adminConfigFile;
}

$isPasswordConfigured = fcm_is_password_configured($adminPassword);
$isAdminLogged = $isPasswordConfigured && $hasAdminSession;
$hasInlinePasswordAuth = false;

// Lettura input JSON
$rawInput = file_get_contents('php://input');
$inputJson = !empty($rawInput) ? json_decode($rawInput, true) : null;

// Consenti autenticazione immediata tramite password se inviata
if (!$isAdminLogged && $isPasswordConfigured) {
    $submittedPwd = '';
    if (isset($_POST['admin_pwd'])) {
        $submittedPwd = $_POST['admin_pwd'];
    } elseif (is_array($inputJson) && isset($inputJson['password'])) {
        $submittedPwd = $inputJson['password'];
    } elseif (is_array($inputJson) && isset($inputJson['admin_pwd'])) {
        $submittedPwd = $inputJson['admin_pwd'];
    }

    if (is_scalar($submittedPwd) && (string)$submittedPwd !== '') {
        // Verifica con limite ai tentativi, lo stesso contatore di tutti i punti di login admin
        $loginAttempt = fcm_admin_login_attempt((string)$submittedPwd, $adminPassword);
        if ($loginAttempt['ok']) {
            fcm_admin_session_grant();
            $isAdminLogged = true;
            $hasInlinePasswordAuth = true;
        } elseif ($loginAttempt['retry_after'] > 0) {
            // Troppi errori recenti: finché dura il blocco la password non viene nemmeno verificata
            http_response_code(429);
            header('Retry-After: ' . (int)$loginAttempt['retry_after']);
            echo json_encode(['success' => false, 'error' => fcm_throttle_message($loginAttempt['retry_after'])]);
            exit;
        }
    }
}

$action = (isset($_REQUEST['action']) && is_string($_REQUEST['action'])) ? trim($_REQUEST['action']) : '';

// 1. Azione pubblica: recupero configurazione attiva o default
if ($action === 'get_theme_config') {
    $config = fcm_get_active_theme_config();
    echo json_encode([
        'success' => true,
        'isAdmin' => $isAdminLogged,
        'hasCustomFile' => file_exists($configPath),
        'csrfToken' => (session_status() === PHP_SESSION_ACTIVE) ? fcm_csrf_token() : '',
        'config' => $config
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Per tutte le altre azioni (scrittura/reset), è richiesto l'accesso admin + POST + CSRF
fcm_require_post();
if (!$isAdminLogged) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Accesso negato: password di amministrazione richiesta'
    ]);
    exit;
}
if (!$hasInlinePasswordAuth) {
    fcm_require_csrf($inputJson);
}

// 2. Azione: Salvataggio configurazione tema
if ($action === 'save_theme_config') {
    $payload = $inputJson;
    if (!$payload && isset($_POST['config']) && is_string($_POST['config'])) {
        $payload = json_decode($_POST['config'], true);
    }

    if (!$payload || !isset($payload['tokens']) || !is_array($payload['tokens'])) {
        echo json_encode([
            'success' => false,
            'error' => 'Dati di configurazione tema non validi'
        ]);
        exit;
    }

    $defaultConfig = fcm_get_default_theme_config();

    // Pulizia e validazione tokens
    $sanitized = [
        'version' => 1,
        'lastUpdated' => round(microtime(true) * 1000),
        'defaultTheme' => in_array($payload['defaultTheme'] ?? '', ['system', 'light', 'dark']) ? $payload['defaultTheme'] : 'system',
        'tokens' => [
            'dark' => [],
            'light' => [],
            'accents' => [],
            'roles' => [],
            'ui' => []
        ]
    ];

    foreach (['dark', 'light', 'accents', 'roles', 'ui'] as $group) {
        if (!empty($payload['tokens'][$group]) && is_array($payload['tokens'][$group])) {
            foreach ($payload['tokens'][$group] as $k => $v) {
                if (fcm_is_theme_token($group, $k)) {
                    $sanitized['tokens'][$group][$k] = fcm_sanitize_css_val($v);
                }
            }
        }
        // Se mancano valori nel payload, mantieni il default
        if (isset($defaultConfig['tokens'][$group])) {
            foreach ($defaultConfig['tokens'][$group] as $k => $v) {
                if (!isset($sanitized['tokens'][$group][$k]) || $sanitized['tokens'][$group][$k] === '') {
                    $sanitized['tokens'][$group][$k] = $v;
                }
            }
        }
    }

    // Crea backup
    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
    }

    $written = fcm_write_file_atomic(
        $configPath,
        json_encode($sanitized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        0644
    );

    if ($written !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Configurazione del tema salvata con successo',
            'lastUpdated' => $sanitized['lastUpdated']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile scrivere il file inc/data/theme_config.json. Verificare i permessi sul server.'
        ]);
    }
    exit;
}

// 3. Azione: Ripristino tema di fabbrica (ModernFCM Classic)
if ($action === 'reset_theme_defaults') {
    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
        @unlink($configPath);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Tema ripristinato con successo ai valori originali di fabbrica',
        'defaultConfig' => fcm_get_default_theme_config()
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Azione non riconosciuta']);
exit;

