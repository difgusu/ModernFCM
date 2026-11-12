<?php
/**
 * STORICO ADMIN SAVE & API
 * Endpoint protetto da password amministratore per la gestione delle cartelle dei siti storici legacy.
 * ModernFCM
 */

require_once __DIR__ . '/admin_security.inc.php';
// La sessione si apre solo se il browser ne ha già una: la lettura pubblica non ne crea di nuove
$hasAdminSession = fcm_admin_session_active();

header('Content-Type: application/json; charset=utf-8');
// Senza sessione PHP mancherebbero le sue intestazioni anti-cache: la risposta non va memorizzata
header('Cache-Control: no-store, no-cache, must-revalidate');

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
$isAdminLogged = $isPasswordConfigured && $hasAdminSession;
$hasInlinePasswordAuth = false;

// Lettura e buffering input JSON
$rawInput = file_get_contents('php://input');
$inputJson = !empty($rawInput) ? json_decode($rawInput, true) : null;

// Consenti autenticazione immediata tramite parametro 'admin_pwd' o 'password' se passato via POST o JSON
if (!$isAdminLogged && $isPasswordConfigured) {
    $submittedPwd = $_POST['admin_pwd'] ?? ($inputJson['password'] ?? ($inputJson['admin_pwd'] ?? ''));
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

/**
 * TRUE se $path è un percorso relativo utilizzabile nel link al sito storico di una stagione.
 * Sul sito pubblico il valore finisce in un href: niente schemi (due punti), apici, virgolette,
 * parentesi angolari, backslash o caratteri di controllo, e niente percorsi assoluti o che
 * risalgono oltre la cartella che contiene il sito (un solo "../" iniziale, come nel pannello).
 * Con $allowSubfolders FALSE deve essere un semplice nome di file.
 */
function fcm_storico_is_safe_path($path, $allowSubfolders) {
    if ($path === '' || strlen($path) > 255 || !preg_match('//u', $path) || preg_match('/[\x00-\x1f\x7f"\'<>:\\\\]/', $path)) {
        return false;
    }
    $segments = explode('/', $path);
    // Il sito codifica ogni segmento del link: "?" e "#" nel file di avvio diventerebbero parte
    // del nome e il link porterebbe a un file che non esiste
    if (!$allowSubfolders && (count($segments) > 1 || strpbrk($path, '?#') !== false)) {
        return false;
    }
    foreach ($segments as $i => $segment) {
        // Un segmento vuoto renderebbe il percorso assoluto ("/x", "//host", anche dopo un "./" iniziale,
        // che il sito toglie); per i browser anche "%2e%2e" è un segmento ".."
        if ($segment === '' || (rawurldecode($segment) === '..' && ($i > 0 || !$allowSubfolders))) {
            return false;
        }
    }
    return true;
}

$action = (isset($_REQUEST['action']) && is_string($_REQUEST['action'])) ? trim($_REQUEST['action']) : '';
// Token CSRF solo a chi ha già una sessione
$csrfToken = (session_status() === PHP_SESSION_ACTIVE) ? fcm_csrf_token() : '';

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
                'csrfToken' => $csrfToken
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
        'csrfToken' => $csrfToken
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
    } elseif (isset($_POST['config']) && is_string($_POST['config'])) {
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
                    if (!fcm_storico_is_safe_path($folder, true) || ($index !== '' && !fcm_storico_is_safe_path($index, false))) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Cartella o file di avvio non validi per la stagione ' . $num . '. Usa un percorso relativo alla cartella del sito (es. archivio/2013-14 oppure ../Stagione_y) senza due punti, apici, virgolette o parentesi angolari. Nel file di avvio non sono ammessi parametri (?) né ancore (#).']);
                        exit;
                    }
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

