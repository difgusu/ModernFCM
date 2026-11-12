<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/fcm_parser.php';

function mercato_get_team_credentials() {
    $invformPath = dirname(dirname(__DIR__)) . '/invform/invform.inc.php';
    $passwords = [];
    if (file_exists($invformPath)) {
        include $invformPath;
    }
    return $passwords;
}

function mercato_get_admin_password() {
    $adminConfig = dirname(dirname(__DIR__)) . '/inc/admin_config.inc.php';
    $adminPassword = '';
    if (file_exists($adminConfig)) {
        include $adminConfig;
    }
    return $adminPassword;
}

/**
 * Esito di un login non riuscito: se è scattato il limite ai tentativi il messaggio dice solo
 * quanto attendere ('retry_after' in secondi), altrimenti resta l'errore indicato.
 */
function mercato_login_failure($attempt, $error) {
    $retryAfter = (int)($attempt['retry_after'] ?? 0);
    if ($retryAfter > 0) {
        return ['success' => false, 'error' => fcm_throttle_message($retryAfter), 'retry_after' => $retryAfter];
    }
    return ['success' => false, 'error' => $error];
}

function mercato_login_team($idSquadra, $password) {
    $passwords = mercato_get_team_credentials();
    $idSquadra = (int)$idSquadra;
    
    $hash = (is_array($passwords) && isset($passwords[$idSquadra]) && is_string($passwords[$idSquadra])) ? $passwords[$idSquadra] : '';

    // Squadra inesistente, senza password o con password sbagliata: stesso esito e stesso messaggio
    $attempt = fcm_team_login_attempt($idSquadra, $password, $hash);
    if (!empty($attempt['ok'])) {
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            @session_regenerate_id(true);
        }
        $data = fcm_parse_all_data();
        $sqInfo = $data['fantasquadre'][$idSquadra] ?? null;
        
        $_SESSION['mercato_team_id'] = $idSquadra;
        $_SESSION['mercato_team_name'] = $sqInfo ? $sqInfo['nome'] : "Squadra #$idSquadra";
        $_SESSION['mercato_divisione'] = $sqInfo ? $sqInfo['divisione'] : 0;
        return ['success' => true];
    }

    return mercato_login_failure($attempt, 'Squadra o password non corrette.');
}

function mercato_login_admin($password) {
    $adminPwd = mercato_get_admin_password();
    if (!fcm_is_password_configured($adminPwd)) {
        return ['success' => false, 'error' => 'Password amministratore non ancora impostata in inc/admin_config.inc.php.'];
    }

    $attempt = fcm_admin_login_attempt($password, $adminPwd);
    if (!empty($attempt['ok'])) {
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            @session_regenerate_id(true);
        }
        $_SESSION['mercato_admin_logged'] = true;
        return ['success' => true];
    }

    return mercato_login_failure($attempt, 'Password amministratore errata.');
}

function mercato_is_team_logged() {
    return !empty($_SESSION['mercato_team_id']);
}

function mercato_is_admin() {
    return !empty($_SESSION['mercato_admin_logged']);
}

function mercato_logout() {
    unset($_SESSION['mercato_team_id']);
    unset($_SESSION['mercato_team_name']);
    unset($_SESSION['mercato_divisione']);
    unset($_SESSION['mercato_admin_logged']);
    // Il vecchio ID di sessione non deve restare valido dopo l'uscita
    if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
        @session_regenerate_id(true);
    }
}

function mercato_get_logged_team_id() {
    return $_SESSION['mercato_team_id'] ?? null;
}
