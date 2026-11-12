<?php
/**
 * Configurazione Modulo Mercato Libero ModernFCM
 */
require_once dirname(__DIR__, 2) . '/inc/admin_security.inc.php';
fcm_ensure_session();

date_default_timezone_set('Europe/Rome');

define('MERCATO_DIR', dirname(__DIR__));
define('MERCATO_DATA_DIR', MERCATO_DIR . '/data');
define('MERCATO_DB_PATH', MERCATO_DATA_DIR . '/mercato.sqlite');
define('MERCATO_REPORTS_DIR', MERCATO_DATA_DIR . '/reports');
define('MERCATO_REGISTRO_PATH', MERCATO_DATA_DIR . '/registro_admin.txt');

/**
 * Crea la cartella dati se manca e ne ripristina l'.htaccess: se la cartella viene ricreata dal
 * codice (o caricata senza i file nascosti) chiave, buste e registro non devono restare leggibili via HTTP.
 */
function mercato_ensure_data_dir() {
    if (!is_dir(MERCATO_DATA_DIR)) {
        if (!@mkdir(MERCATO_DATA_DIR, 0755, true) && !is_dir(MERCATO_DATA_DIR)) {
            return false;
        }
    }
    $htaccess = MERCATO_DATA_DIR . '/.htaccess';
    if (!file_exists($htaccess)) {
        @file_put_contents(
            $htaccess,
            "# Protezione cartella dati e report da accesso diretto via browser:\n"
            . "# qui dentro nulla va servito via HTTP, quindi si nega l'intera cartella (sottocartelle comprese)\n"
            . "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n"
        );
    }
    return true;
}

// Helper per la modularità: verifica flag in js/fcmVariabili.js ed eventuale presenza del file su disco
if (!function_exists('fcm_module_enabled')) {
    function fcm_module_enabled($varName, $requiredFile = null) {
        static $iniVars = null;
        if ($iniVars === null) {
            $iniVars = [];
            $varsPath = dirname(MERCATO_DIR) . '/js/fcmVariabili.js';
            if (file_exists($varsPath)) {
                $raw = @file_get_contents($varsPath);
                if (preg_match_all('/var\s+([a-zA-Z0-9_]+)\s*=\s*["\']?(.*?)["\']?\s*;?$/m', $raw, $matches, PREG_SET_ORDER)) {
                    foreach ($matches as $m) {
                        $iniVars[$m[1]] = trim($m[2]);
                    }
                }
            }
        }
        $val = isset($iniVars[$varName]) ? strtolower($iniVars[$varName]) : 'si';
        $isEnabled = ($val === 'si' || $val === '1' || $val === 'true');
        if ($isEnabled && $requiredFile !== null) {
            if (is_array($requiredFile)) {
                foreach ($requiredFile as $rf) {
                    if (file_exists($rf)) return true;
                }
                return false;
            }
            return file_exists($requiredFile);
        }
        return $isEnabled;
    }
}

// Chiave AES-256-CBC per la segretezza delle offerte a busta chiusa (generata e salvata localmente per istanza)
$keyFile = MERCATO_DATA_DIR . '/secret.key';
$mercatoKey = file_exists($keyFile) ? trim((string)@file_get_contents($keyFile)) : '';
if ($mercatoKey === '') {
    $mercatoKey = bin2hex(random_bytes(16));
    if (!mercato_ensure_data_dir()) {
        throw new \RuntimeException('Impossibile creare la directory dati del Mercato.');
    }
    if (!fcm_write_file_atomic($keyFile, $mercatoKey, 0600)) {
        throw new \RuntimeException('Impossibile salvare la chiave di cifratura secret.key in mercato/data/.');
    }
}
define('MERCATO_KEY', $mercatoKey);

// Regole di default se non diversamente impostate nel DB o file impostazioni
$MERCATO_DEFAULT_SETTINGS = [
    'max_giocatori'                  => 25,
    'num_p'                          => 3,
    'num_d'                          => 8,
    'num_c'                          => 8,
    'num_a'                          => 6,
    'obbligo_taglio'                 => 1,
    'perc_recupero_estera'           => 100, // {ESTERA} (default 100%)
    'perc_recupero_minore'           => 50,  // {MINORE} (default 50%)
    'perc_recupero_eliminata'        => 0,   // {ELIMINATA} (default 0%)
    'perc_recupero_serie_a'          => 0,   // Giocatore di A (default 0%)
    'arrotonda_eccesso'              => 1,   // 1: Attivo (arrotonda per eccesso), 0: Disattivo (per difetto)
    'mostra_estera_minore_eliminata' => 1,   // 1: Mostra {ESTERA}, {MINORE}, {ELIMINATA} tra i disponibili, 0: Nascondi
    'mostra_chiamate_altri'          => 0,   // 1: Utenti possono vedere chiamate e tagli altrui (senza importo), 0: Buste private
    'abilita_simulazione'            => 1    // 1: Permette simulazione asta all'admin, 0: Disattiva simulazione (offerte segrete fino alla fine)
];
