<?php
/**
 * Helper di sicurezza condivisi per pannelli admin e moduli ModernFCM.
 * Gestisce sessioni sicure, verifica password in tempo costante, token CSRF e scritture atomiche.
 */

if (!function_exists('fcm_is_https')) {
    function fcm_is_https() {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
    }
}

if (!function_exists('fcm_ensure_session')) {
    function fcm_ensure_session() {
        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            $secure = fcm_is_https();
            if (PHP_VERSION_ID >= 70300) {
                @session_set_cookie_params([
                    'lifetime' => 0,
                    'path'     => '/',
                    'secure'   => $secure,
                    'httponly' => true,
                    'samesite' => 'Lax',
                ]);
            } else {
                @session_set_cookie_params(0, '/; samesite=Lax', '', $secure, true);
            }
            @session_start();
        }
        if (!isset($_SESSION) || !is_array($_SESSION)) {
            $_SESSION = [];
        }
    }
}

if (!function_exists('fcm_is_password_configured')) {
    function fcm_is_password_configured($pwd) {
        return is_string($pwd) && $pwd !== '' && $pwd !== '[PASSWORD]';
    }
}

if (!function_exists('fcm_verify_password')) {
    function fcm_verify_password($submitted, $expected) {
        if (!is_string($submitted) || !is_string($expected) || $expected === '') {
            return false;
        }
        return hash_equals($expected, $submitted);
    }
}

if (!function_exists('fcm_csrf_token')) {
    function fcm_csrf_token() {
        fcm_ensure_session();
        if (empty($_SESSION['pn_csrf_token']) || !is_string($_SESSION['pn_csrf_token'])) {
            $_SESSION['pn_csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['pn_csrf_token'];
    }
}

if (!function_exists('fcm_extract_csrf')) {
    function fcm_extract_csrf($inputJson = null) {
        if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
            return (string)$_SERVER['HTTP_X_CSRF_TOKEN'];
        }
        if (isset($_POST['_csrf']) && is_string($_POST['_csrf'])) {
            return $_POST['_csrf'];
        }
        if (is_array($inputJson)) {
            if (!empty($inputJson['_csrf']) && is_string($inputJson['_csrf'])) {
                return $inputJson['_csrf'];
            }
            if (!empty($inputJson['csrfToken']) && is_string($inputJson['csrfToken'])) {
                return $inputJson['csrfToken'];
            }
        }
        return '';
    }
}

if (!function_exists('fcm_verify_csrf')) {
    function fcm_verify_csrf($provided = null, $inputJson = null) {
        $expected = fcm_csrf_token();
        $actual = $provided !== null ? (string)$provided : fcm_extract_csrf($inputJson);
        if ($actual === '') {
            return false;
        }
        return hash_equals($expected, $actual);
    }
}

if (!function_exists('fcm_require_post')) {
    function fcm_require_post() {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            if (!headers_sent()) {
                http_response_code(405);
                header('Content-Type: application/json; charset=UTF-8');
            }
            echo json_encode(['success' => false, 'error' => 'Metodo HTTP non consentito: richiesto POST.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

if (!function_exists('fcm_require_csrf')) {
    function fcm_require_csrf($inputJson = null, $provided = null) {
        if (!fcm_verify_csrf($provided, $inputJson)) {
            if (!headers_sent()) {
                http_response_code(403);
                header('Content-Type: application/json; charset=UTF-8');
            }
            echo json_encode(['success' => false, 'error' => 'Token CSRF non valido o sessione scaduta. Ricarica la pagina.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

if (!function_exists('fcm_write_file_atomic')) {
    function fcm_write_file_atomic($path, $content, $mode = 0644) {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                return false;
            }
        }
        $tmp = @tempnam($dir, '.tmp_');
        if ($tmp === false) {
            return false;
        }
        $written = @file_put_contents($tmp, $content, LOCK_EX);
        if ($written === false) {
            @unlink($tmp);
            return false;
        }
        @chmod($tmp, $mode);
        if (@rename($tmp, $path)) {
            return true;
        }
        if (@copy($tmp, $path)) {
            @chmod($path, $mode);
            @unlink($tmp);
            return true;
        }
        @unlink($tmp);
        return false;
    }
}

if (!function_exists('fcm_apply_curl_ssl')) {
    function fcm_apply_curl_ssl($ch) {
        if (!$ch) {
            return;
        }
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        if (defined('CURLSSLOPT_NATIVE_CA') && PHP_OS_FAMILY === 'Windows' && empty(ini_get('curl.cainfo'))) {
            @curl_setopt($ch, CURLOPT_SSL_OPTIONS, CURLSSLOPT_NATIVE_CA);
        }
    }
}
