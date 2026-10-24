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
    $adminConfig = dirname(dirname(__DIR__)) . '/invform/admin_config.inc.php';
    $adminPassword = '';
    if (file_exists($adminConfig)) {
        include $adminConfig;
    }
    return $adminPassword;
}

function mercato_login_team($idSquadra, $password) {
    $passwords = mercato_get_team_credentials();
    $idSquadra = (int)$idSquadra;
    
    if (!isset($passwords[$idSquadra])) {
        return ['success' => false, 'error' => 'Squadra non trovata o senza password configurata.'];
    }

    $hash = $passwords[$idSquadra];
    $isValid = false;
    if (function_exists('password_verify') && password_verify($password, $hash)) {
        $isValid = true;
    } elseif (hash_equals((string)$hash, (string)crypt($password, $hash))) {
        $isValid = true;
    } elseif (hash_equals((string)$hash, (string)$password)) { // fallback testo in chiaro se non ancora hashata
        $isValid = true;
    }

    if ($isValid) {
        $data = fcm_parse_all_data();
        $sqInfo = $data['fantasquadre'][$idSquadra] ?? null;
        
        $_SESSION['mercato_team_id'] = $idSquadra;
        $_SESSION['mercato_team_name'] = $sqInfo ? $sqInfo['nome'] : "Squadra #$idSquadra";
        $_SESSION['mercato_divisione'] = $sqInfo ? $sqInfo['divisione'] : 0;
        return ['success' => true];
    }

    return ['success' => false, 'error' => 'Password non corretta.'];
}

function mercato_login_admin($password) {
    $adminPwd = mercato_get_admin_password();
    if (empty($adminPwd) || $adminPwd === '[PASSWORD]') {
        return ['success' => false, 'error' => 'Password amministratore non ancora impostata in invform/admin_config.inc.php.'];
    }

    if (hash_equals((string)$adminPwd, (string)$password)) {
        $_SESSION['mercato_admin_logged'] = true;
        return ['success' => true];
    }

    return ['success' => false, 'error' => 'Password amministratore errata.'];
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
}

function mercato_get_logged_team_id() {
    return $_SESSION['mercato_team_id'] ?? null;
}
