<?php
/**
 * HOMEPAGE ADMIN REDIRECT
 * Tutti i controlli di amministrazione della Lega sono stati unificati in impostazioni.php
 * Reindirizzamento automatico al tab 'Personalizzazione Home'.
 * ModernFCM
 */
require_once __DIR__ . '/admin_security.inc.php';
fcm_ensure_session();

// Gestione logout protetta (POST + CSRF)
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['action']) && $_POST['action'] === 'logout') {
    fcm_require_csrf();
    unset($_SESSION['pn_admin_logged']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    header('Location: impostazioni.php');
    exit;
}

$queryString = !empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '';
if ($queryString === '') {
    $queryString = '?tab=home';
} elseif (!str_contains($queryString, 'tab=')) {
    $queryString .= '&tab=home';
}

header('Location: impostazioni.php' . $queryString . '#home', true, 302);
exit;
