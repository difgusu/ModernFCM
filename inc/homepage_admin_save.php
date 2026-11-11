<?php
/**
 * HOMEPAGE ADMIN SAVE & API
 * Endpoint protetto da password amministratore per la gestione del layout di Lega, Sponsor e Custom Widgets.
 * ModernFCM
 */

require_once __DIR__ . '/admin_security.inc.php';
fcm_ensure_session();

header('Content-Type: application/json; charset=utf-8');

$baseDir = dirname(__DIR__);
$configPath = $baseDir . '/inc/data/homepage_config.json';
$backupPath = $baseDir . '/inc/data/homepage_config.json.bak';
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

function fcm_sanitize_sponsor_url($url) {
    $trimmed = trim((string)$url);
    if ($trimmed === '') return '';
    $normalized = preg_replace('/[\x00-\x20\x7f]+/', '', $trimmed);
    if (preg_match('/^(javascript|vbscript|data):/i', $normalized)) {
        return '';
    }
    if (preg_match('/^https?:\/\//i', $trimmed) || strpos($trimmed, '/') === 0 || strpos($trimmed, './') === 0 || strpos($trimmed, '../') === 0 || strpos($trimmed, '#') === 0) {
        return $trimmed;
    }
    if (!preg_match('/^[a-zA-Z][a-zA-Z0-9+.-]*:/', $trimmed)) {
        return $trimmed;
    }
    return '';
}

/**
 * Restituisce la struttura predefinita della homepage (visualizzazione standard di Lega)
 */
function fcm_get_default_homepage_config() {
    $now = round(microtime(true) * 1000);
    return [
        'version' => 1,
        'lastUpdated' => $now,
        'layoutResetAt' => $now,
        'defaultSettings' => [
            'topFlopDefaultTab' => 'top',
            'quotesMode' => 'all',
            'gpAccordionOpen' => true,
            'coppaAccordionOpen' => false,
            'coppaDefaultTab' => 'knockout'
        ],
        'columns' => [
            'main' => [
                ['id' => 'liveMatchday', 'enabled' => true],
                ['id' => 'news', 'enabled' => true],
                ['id' => 'results', 'enabled' => true],
                ['id' => 'countdown', 'enabled' => true],
                ['id' => 'topFlop11', 'enabled' => true],
                ['id' => 'bestWorstMister', 'enabled' => true],
                ['id' => 'anticipo', 'enabled' => true],
                ['id' => 'nextDayPreview', 'enabled' => true],
                ['id' => 'bilancio', 'enabled' => true],
                ['id' => 'quotes', 'enabled' => true]
            ],
            'side' => [
                ['id' => 'standings', 'enabled' => true],
                ['id' => 'gpStandings', 'enabled' => true],
                ['id' => 'coppa', 'enabled' => true],
                ['id' => 'liveTools', 'enabled' => true],
                ['id' => 'guestbook', 'enabled' => true],
                ['id' => 'sponsors', 'enabled' => true],
                ['id' => 'counter', 'enabled' => true]
            ]
        ],
        'sponsors' => [],
        'customWidgets' => []
    ];
}

$action = isset($_REQUEST['action']) ? trim($_REQUEST['action']) : '';

// 1. Azione pubblica consentita: recupero configurazione (in sola lettura o auto-creazione default)
if ($action === 'get_config') {
    $config = null;
    if (file_exists($configPath)) {
        $raw = file_get_contents($configPath);
        $json = json_decode($raw, true);
        if ($json && isset($json['columns']) && is_array($json['columns']['main']) && !empty($json['columns']['main'])) {
            $config = $json;
        }
    }

    // Se non esiste sul disco o è vuoto/invalido, crea automaticamente con la visualizzazione di default
    if (!$config) {
        $config = fcm_get_default_homepage_config();
        fcm_write_file_atomic(
            $configPath,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            0644
        );
    }

    echo json_encode([
        'success' => true,
        'isAdmin' => $isAdminLogged,
        'csrfToken' => fcm_csrf_token(),
        'config' => $config
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Per tutte le altre azioni (scrittura/modifica), è richiesto l'accesso admin
if (!$isAdminLogged) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Accesso negato: password di amministrazione richiesta'
    ]);
    exit;
}

// 2. Azione: Salvataggio configurazione globale
if ($action === 'save_config') {
    fcm_require_post();
    if (!$hasInlinePasswordAuth) {
        fcm_require_csrf($inputJson);
    }
    $payload = $inputJson;

    if (!$payload && isset($_POST['config'])) {
        $payload = json_decode($_POST['config'], true);
    }

    if (!$payload || !isset($payload['columns']) || !is_array($payload['columns']['main']) || !is_array($payload['columns']['side'])) {
        echo json_encode([
            'success' => false,
            'error' => 'Dati di configurazione non validi'
        ]);
        exit;
    }

    $payload['lastUpdated'] = time() * 1000;
    if (!empty($payload['layoutResetAt'])) {
        $payload['layoutResetAt'] = (int)$payload['layoutResetAt'];
    }

    // Normalizzazione array sponsor
    if (isset($payload['sponsors']) && is_array($payload['sponsors'])) {
        $cleanSponsors = [];
        foreach ($payload['sponsors'] as $idx => $sp) {
            if (!is_array($sp)) continue;
            $title = isset($sp['title']) ? trim((string)$sp['title']) : '';
            $link = isset($sp['link']) ? fcm_sanitize_sponsor_url($sp['link']) : '';
            $logo = isset($sp['logo']) ? fcm_sanitize_sponsor_url($sp['logo']) : '';
            if ($title === '' && $link === '' && $logo === '') continue;
            $cleanSponsors[] = [
                'id' => !empty($sp['id']) ? (string)$sp['id'] : 'sp_' . ($idx + 1) . '_' . bin2hex(random_bytes(2)),
                'title' => $title,
                'link' => $link,
                'logo' => $logo
            ];
        }
        $payload['sponsors'] = $cleanSponsors;
    } else {
        $payload['sponsors'] = [];
    }

    // Crea copia di backup
    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
    }

    $written = fcm_write_file_atomic(
        $configPath,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        0644
    );

    if ($written !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Configurazione della homepage salvata con successo',
            'lastUpdated' => $payload['lastUpdated']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile scrivere il file inc/data/homepage_config.json. Verificare i permessi della cartella.'
        ]);
    }
    exit;
}

// 2b. Azione: Elenco immagini presenti in img/sponsor
if ($action === 'list_sponsor_images') {
    $sponsorDir = $baseDir . '/img/sponsor';
    $images = [];
    if (is_dir($sponsorDir)) {
        $allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        $files = @scandir($sponsorDir) ?: [];
        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || $file === '.gitkeep') continue;
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExts, true)) {
                $images[] = [
                    'filename' => $file,
                    'path' => 'img/sponsor/' . $file
                ];
            }
        }
    }
    echo json_encode([
        'success' => true,
        'images' => $images
    ]);
    exit;
}

// 2c. Azione: Caricamento manuale logo sponsor
if ($action === 'upload_sponsor_logo') {
    fcm_require_post();
    if (!$hasInlinePasswordAuth) {
        fcm_require_csrf($inputJson);
    }
    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        $errorCode = isset($_FILES['logo']) ? $_FILES['logo']['error'] : 'no_file';
        echo json_encode([
            'success' => false,
            'error' => 'Nessun file selezionato o errore durante il caricamento (codice: ' . $errorCode . ')'
        ]);
        exit;
    }

    $sponsorDir = $baseDir . '/img/sponsor';
    if (!is_dir($sponsorDir)) {
        @mkdir($sponsorDir, 0755, true);
    }

    $file = $_FILES['logo'];
    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        echo json_encode([
            'success' => false,
            'error' => 'Upload non valido.'
        ]);
        exit;
    }

    $origName = basename($file['name']);
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

    if (!in_array($ext, $allowedExts, true)) {
        echo json_encode([
            'success' => false,
            'error' => 'Estensione file non valida. Formati consentiti: PNG, JPG, JPEG, GIF, WEBP.'
        ]);
        exit;
    }

    $imgInfo = @getimagesize($file['tmp_name']);
    $expectedTypes = [
        'png'  => IMAGETYPE_PNG,
        'jpg'  => IMAGETYPE_JPEG,
        'jpeg' => IMAGETYPE_JPEG,
        'gif'  => IMAGETYPE_GIF,
        'webp' => defined('IMAGETYPE_WEBP') ? IMAGETYPE_WEBP : 18
    ];
    if (!$imgInfo || !isset($expectedTypes[$ext]) || (int)$imgInfo[2] !== $expectedTypes[$ext]) {
        echo json_encode([
            'success' => false,
            'error' => 'Il contenuto del file non corrisponde a un\'immagine valida del formato dichiarato.'
        ]);
        exit;
    }

    // Sanitize filename
    $cleanName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
    if (empty($cleanName)) {
        $cleanName = 'sponsor_' . time();
    }
    $targetFilename = $cleanName . '.' . $ext;
    $targetPath = $sponsorDir . '/' . $targetFilename;

    if (file_exists($targetPath)) {
        $targetFilename = $cleanName . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $targetPath = $sponsorDir . '/' . $targetFilename;
    }

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        @chmod($targetPath, 0644);
        echo json_encode([
            'success' => true,
            'filename' => $targetFilename,
            'path' => 'img/sponsor/' . $targetFilename
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare il file nella cartella img/sponsor. Verificare i permessi.'
        ]);
    }
    exit;
}

// 2d. Azione: Salva specificamente la lista Sponsor e Preferiti
if ($action === 'save_sponsors') {
    fcm_require_post();
    if (!$hasInlinePasswordAuth) {
        fcm_require_csrf($inputJson);
    }
    $rawSponsors = isset($_POST['sponsors']) ? json_decode($_POST['sponsors'], true) : (is_array($inputJson) && isset($inputJson['sponsors']) ? $inputJson['sponsors'] : $inputJson);

    if (!is_array($rawSponsors)) {
        $rawSponsors = [];
    }

    $cleanSponsors = [];
    foreach ($rawSponsors as $idx => $sp) {
        if (!is_array($sp)) continue;
        $title = isset($sp['title']) ? trim((string)$sp['title']) : '';
        $link = isset($sp['link']) ? fcm_sanitize_sponsor_url($sp['link']) : '';
        $logo = isset($sp['logo']) ? fcm_sanitize_sponsor_url($sp['logo']) : '';
        if ($title === '' && $link === '' && $logo === '') continue;
        $cleanSponsors[] = [
            'id' => !empty($sp['id']) ? (string)$sp['id'] : 'sp_' . ($idx + 1) . '_' . bin2hex(random_bytes(2)),
            'title' => $title,
            'link' => $link,
            'logo' => $logo
        ];
    }

    $current = [];
    if (file_exists($configPath)) {
        $current = json_decode(file_get_contents($configPath), true) ?: [];
    }
    if (!isset($current['columns']) || !is_array($current['columns'])) {
        $current = fcm_get_default_homepage_config();
    }

    $current['sponsors'] = $cleanSponsors;
    $current['lastUpdated'] = time() * 1000;

    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
    }

    $ok = fcm_write_file_atomic(
        $configPath,
        json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        0644
    );

    if ($ok !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Sponsor e Preferiti salvati con successo',
            'sponsors' => $cleanSponsors,
            'lastUpdated' => $current['lastUpdated']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare il file inc/data/homepage_config.json. Verificare i permessi.'
        ]);
    }
    exit;
}

// 3. Azione: Salva o aggiorna un singolo Custom Widget
if ($action === 'save_custom_widget') {
    fcm_require_post();
    if (!$hasInlinePasswordAuth) {
        fcm_require_csrf($inputJson);
    }
    $widgetRaw = isset($_POST['widget']) ? json_decode($_POST['widget'], true) : $inputJson;

    if (!$widgetRaw || empty($widgetRaw['title'])) {
        echo json_encode(['success' => false, 'error' => 'Dati del widget mancanti o incompleti']);
        exit;
    }

    $targetCol = (isset($widgetRaw['column']) && $widgetRaw['column'] === 'side') ? 'side' : 'main';

    // Se l'id non esiste o è nuovo, genera un ID univoco
    if (empty($widgetRaw['id'])) {
        $widgetRaw['id'] = 'custom_' . time() . '_' . substr(md5(uniqid()), 0, 6);
    }

    $widgetRaw['isCustom'] = true;
    if (!isset($widgetRaw['enabled'])) {
        $widgetRaw['enabled'] = true;
    }

    // Carica configurazione esistente
    $current = [];
    if (file_exists($configPath)) {
        $current = json_decode(file_get_contents($configPath), true) ?: [];
    }

    if (!isset($current['customWidgets']) || !is_array($current['customWidgets'])) {
        $current['customWidgets'] = [];
    }
    if (!isset($current['columns']) || !is_array($current['columns'])) {
        $current['columns'] = ['main' => [], 'side' => []];
    }

    // Aggiorna o inserisci in customWidgets
    $found = false;
    foreach ($current['customWidgets'] as &$cw) {
        if ($cw['id'] === $widgetRaw['id']) {
            $cw = $widgetRaw;
            $found = true;
            break;
        }
    }
    unset($cw);

    if (!$found) {
        $current['customWidgets'][] = $widgetRaw;
    }

    // Assicura che sia presente nella colonna di competenza
    $colList = &$current['columns'][$targetCol];
    $inCol = false;
    foreach ($colList as $ci) {
        if ($ci['id'] === $widgetRaw['id']) {
            $inCol = true;
            break;
        }
    }
    if (!$inCol) {
        // Se si trovava nell'altra colonna, rimuovilo da lì
        $otherCol = ($targetCol === 'main') ? 'side' : 'main';
        $current['columns'][$otherCol] = array_values(array_filter(
            $current['columns'][$otherCol],
            function($item) use ($widgetRaw) { return $item['id'] !== $widgetRaw['id']; }
        ));

        // Inserisci in cima alla colonna scelta
        array_unshift($colList, [
            'id' => $widgetRaw['id'],
            'enabled' => $widgetRaw['enabled'],
            'isCustom' => true
        ]);
    }

    $current['lastUpdated'] = time() * 1000;

    // Backup e scrittura
    if (file_exists($configPath)) {
        @copy($configPath, $backupPath);
    }

    $ok = fcm_write_file_atomic(
        $configPath,
        json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        0644
    );

    if ($ok !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Widget personalizzato salvato con successo',
            'widget' => $widgetRaw
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Errore durante la scrittura su disco']);
    }
    exit;
}

// 4. Azione: Elimina un Custom Widget
if ($action === 'delete_custom_widget') {
    fcm_require_post();
    if (!$hasInlinePasswordAuth) {
        fcm_require_csrf($inputJson);
    }
    $widgetId = isset($_POST['id']) ? trim((string)$_POST['id']) : (is_array($inputJson) && isset($inputJson['id']) ? trim((string)$inputJson['id']) : '');
    if (!$widgetId) {
        echo json_encode(['success' => false, 'error' => 'ID widget mancante']);
        exit;
    }

    if (!file_exists($configPath)) {
        echo json_encode(['success' => false, 'error' => 'Configurazione non trovata']);
        exit;
    }

    $current = json_decode(file_get_contents($configPath), true) ?: [];

    if (isset($current['customWidgets']) && is_array($current['customWidgets'])) {
        $current['customWidgets'] = array_values(array_filter(
            $current['customWidgets'],
            function($w) use ($widgetId) { return $w['id'] !== $widgetId; }
        ));
    }

    if (isset($current['columns'])) {
        foreach (['main', 'side'] as $col) {
            if (isset($current['columns'][$col]) && is_array($current['columns'][$col])) {
                $current['columns'][$col] = array_values(array_filter(
                    $current['columns'][$col],
                    function($w) use ($widgetId) { return $w['id'] !== $widgetId; }
                ));
            }
        }
    }

    $current['lastUpdated'] = time() * 1000;

    @copy($configPath, $backupPath);
    $ok = fcm_write_file_atomic(
        $configPath,
        json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        0644
    );

    echo json_encode([
        'success' => ($ok !== false),
        'message' => ($ok !== false) ? 'Widget rimosso con successo' : 'Errore salvataggio'
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Azione non riconosciuta']);
