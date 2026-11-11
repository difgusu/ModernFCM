<?php
/**
 * Backward compatibility redirect: impostazioni_calcolo.php -> impostazioni.php
 * Preserves query string and forwards POST requests seamlessly.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/impostazioni.php';
    exit;
}

$queryString = !empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '';
header('Location: impostazioni.php' . $queryString, true, 302);
exit;
