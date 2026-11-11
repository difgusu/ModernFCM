<?php
/**
 * STORICO ADMIN SAVE & API
 * Endpoint protetto da password amministratore per la gestione delle cartelle dei siti storici legacy.
 * ModernFCM
 */

require_once __DIR__ . '/admin_security.inc.php';
fcm_ensure_session();

header('Content-Type: application/json; charset=utf-8');

$baseDir = dirname(__DIR__);
$configPath = $baseDir . '/inc/data/storico_config.json';
$backupPath = $baseDir . '/inc/data/storico_config.json.bak';
$adminConfigFile = $baseDir . '/inc/admin_config.inc.php';

// Carica configurazione admin per la password
$adminPassword = '';
if (file_exists($adminConfigFile)) {
    require_once $adminConfigFile;
}

$isPasswordConfigured = fcm_is_password_configured($adminPassword);
$isAdminLogged = $isPasswordConfigured && !empty($_SESSION['pn_admin_logged']);
$hasInlinePasswordAuth = false;

// Lettura e buffering input JSON
$rawInput = file_get_contents('php://input');
$inputJson = !empty($rawInput) ? json_decode($rawInput, true) : null;

// Consenti autenticazione immediata tramite parametro 'admin_pwd' o 'password' se passato via POST o JSON
if (!$isAdminLogged && $isPasswordConfigured) {
    $submittedPwd = $_POST['admin_pwd'] ?? ($inputJson['password'] ?? ($inputJson['admin_pwd'] ?? ''));
    if ($submittedPwd !== '' && fcm_verify_password((string)$submittedPwd, $adminPassword)) {
        if (!headers_sent() && session_status() === PHP_SESSION_ACTIVE) {
            @session_regenerate_id(true);
        }
        $_SESSION['pn_admin_logged'] = true;
        $isAdminLogged = true;
        $hasInlinePasswordAuth = true;
    }
}

$action = isset($_REQUEST['action']) ? trim($_REQUEST['action']) : '';

// 1. Azione pubblica consentita: recupero configurazione (in sola lettura)
if ($action === 'get_config') {
    if (file_exists($configPath)) {
        $content = file_get_contents($configPath);
        $decoded = json_decode($content, true);
        if ($decoded !== null) {
            echo json_encode([
                'success' => true,
                'config' => $decoded,
                'isAdmin' => $isAdminLogged,
                'csrfToken' => fcm_csrf_token()
            ]);
            exit;
        }
    }

    echo json_encode([
        'success' => true,
        'config' => [
            'showLegacySites' => true,
            'seasons' => new stdClass()
        ],
        'isAdmin' => $isAdminLogged,
        'csrfToken' => fcm_csrf_token()
    ]);
    exit;
}

// Per qualsiasi altra azione di scrittura è richiesta l'autenticazione admin + POST + CSRF
fcm_require_post();
if (!$isAdminLogged) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Accesso non autorizzato. Password amministratore richiesta.'
    ]);
    exit;
}
if (!$hasInlinePasswordAuth) {
    fcm_require_csrf($inputJson);
}

// 2. Azione protetta: salvataggio configurazione cartelle storiche
if ($action === 'save_config') {
    $payload = null;
    if (is_array($inputJson) && isset($inputJson['config'])) {
        $payload = $inputJson['config'];
    } elseif (is_array($inputJson) && isset($inputJson['showLegacySites'])) {
        $payload = $inputJson;
    } elseif (isset($_POST['config'])) {
        $payload = json_decode($_POST['config'], true);
    }

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato payload di configurazione non valido.']);
        exit;
    }

    // Sanitizzazione della configurazione
    $cleanConfig = [
        'showLegacySites' => !empty($payload['showLegacySites']),
        'seasons' => []
    ];

    if (isset($payload['seasons']) && is_array($payload['seasons'])) {
        foreach ($payload['seasons'] as $sId => $item) {
            $num = (int)$sId;
            if ($num > 0 && is_array($item)) {
                $folder = isset($item['folder']) ? trim(strip_tags((string)$item['folder'])) : '';
                // Normalizza backslash in slash e rimuove eventuali slash finali, preservando esattamente il percorso relativo (es. ../Stagione_y)
                $folder = str_replace('\\', '/', $folder);
                $folder = rtrim($folder, '/');
                $index = isset($item['index']) ? trim(strip_tags((string)$item['index'])) : 'index.php';
                if (!empty($folder)) {
                    $cleanConfig['seasons'][(string)$num] = [
                        'folder' => $folder,
                        'index' => $index
                    ];
                }
            }
        }
    }

    // Backup di sicurezza se il file esiste già
    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
    }

    $jsonStr = json_encode($cleanConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $saved = fcm_write_file_atomic($configPath, $jsonStr, 0644);

    if ($saved !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Configurazione cartelle storiche salvata con successo.',
            'config' => $cleanConfig
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare il file di configurazione in inc/data/. Verificare i permessi di scrittura.'
        ]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Azione non riconosciuta.']);
exit;

