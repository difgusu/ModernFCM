<?php
/**
 * Configurazione Modulo Mercato Libero ModernFCM
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

date_default_timezone_set('Europe/Rome');

define('MERCATO_DIR', dirname(__DIR__));
define('MERCATO_DATA_DIR', MERCATO_DIR . '/data');
define('MERCATO_DB_PATH', MERCATO_DATA_DIR . '/mercato.sqlite');
define('MERCATO_REPORTS_DIR', MERCATO_DATA_DIR . '/reports');

// Chiave AES-256-CBC per la segretezza delle offerte a busta chiusa (generata e salvata localmente per istanza)
$keyFile = MERCATO_DATA_DIR . '/secret.key';
$mercatoKey = file_exists($keyFile) ? trim((string)@file_get_contents($keyFile)) : '';
if (empty($mercatoKey)) {
    try {
        $mercatoKey = bin2hex(random_bytes(16));
    } catch (Exception $e) {
        $mercatoKey = md5(uniqid('mercato_', true));
    }
    if (!is_dir(MERCATO_DATA_DIR)) {
        @mkdir(MERCATO_DATA_DIR, 0755, true);
    }
    @file_put_contents($keyFile, $mercatoKey);
}
define('MERCATO_KEY', !empty($mercatoKey) ? $mercatoKey : 'ModernFCM_MercatoKey2026_Secr3tToken!');

// Regole di default se non diversamente impostate nel DB o file impostazioni
$MERCATO_DEFAULT_SETTINGS = [
    'max_giocatori'           => 25,
    'num_p'                   => 3,
    'num_d'                   => 8,
    'num_c'                   => 8,
    'num_a'                   => 6,
    'obbligo_taglio'          => 1,
    'perc_recupero_estera'    => 100, // {ESTERA} (default 100%)
    'perc_recupero_minore'    => 50,  // {MINORE} (default 50%)
    'perc_recupero_eliminata' => 0,   // {ELIMINATA} (default 0%)
    'perc_recupero_serie_a'           => 0,   // Giocatore di A (default 0%)
    'arrotonda_eccesso'               => 1,   // 1: Attivo (arrotonda per eccesso), 0: Disattivo (per difetto)
    'mostra_estera_minore_eliminata'  => 1    // 1: Mostra {ESTERA}, {MINORE}, {ELIMINATA} tra i disponibili, 0: Nascondi
];
