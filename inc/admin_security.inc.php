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
            // ID di sessione accettati solo se generati dal server e solo via cookie
            @ini_set('session.use_strict_mode', '1');
            @ini_set('session.use_only_cookies', '1');
            @ini_set('session.use_trans_sid', '0');
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
        // Il segnaposto e la password d'esempio del README non sono password valide.
        return is_string($pwd) && $pwd !== '' && $pwd !== '[PASSWORD]' && $pwd !== 'LaTuaPasswordSegreta';
    }
}

if (!function_exists('fcm_password_is_hash')) {
    /**
     * TRUE se il valore configurato è un hash prodotto da password_hash() (bcrypt/argon2).
     */
    function fcm_password_is_hash($value) {
        if (!is_string($value) || $value === '') {
            return false;
        }
        $info = password_get_info($value);
        return !empty($info['algo']);
    }
}

if (!function_exists('fcm_verify_password')) {
    /**
     * Verifica della password amministratore in tempo costante.
     * $expected può essere la password in chiaro (compatibilità) oppure, meglio, un hash
     * generato con password_hash(): in quel caso si usa password_verify().
     */
    function fcm_verify_password($submitted, $expected) {
        if (!is_string($submitted) || !is_string($expected) || $expected === '' || $submitted === '') {
            return false;
        }
        if (fcm_password_is_hash($expected)) {
            return password_verify($submitted, $expected);
        }
        return hash_equals($expected, $submitted);
    }
}

if (!function_exists('fcm_verify_team_password')) {
    /**
     * Verifica della password di una squadra contro l'hash crypt() generato da FCM/jdPI
     * (invform/invform.inc.php). Nessun ripiego sul confronto in chiaro: hash o password vuoti
     * vengono sempre rifiutati.
     */
    function fcm_verify_team_password($password, $hash) {
        if (!is_string($password) || !is_string($hash) || $password === '' || $hash === '') {
            return false;
        }
        return password_verify($password, $hash);
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
        // Il temporaneo finisce in ".tmp": è già negato via HTTP dalle regole FilesMatch del sito,
        // quindi il contenuto (anche chiavi e configurazioni) non è leggibile nemmeno per un istante.
        try {
            $tmp = $dir . DIRECTORY_SEPARATOR . '.' . bin2hex(random_bytes(8)) . '.tmp';
        } catch (\Throwable $e) {
            return false;
        }
        $fh = @fopen($tmp, 'x');
        if ($fh === false) {
            return false;
        }
        @chmod($tmp, 0600);
        $written = @fwrite($fh, (string)$content);
        @fflush($fh);
        @fclose($fh);
        if ($written === false || $written !== strlen((string)$content)) {
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

// ---------------------------------------------------------------------------
// Protezione dai tentativi ripetuti di login (schema "device cookie" OWASP)
// ---------------------------------------------------------------------------
// - I tentativi falliti si contano lato server, in file sotto inc/data/throttle/, mai in sessione:
//   chi attacca può semplicemente non rimandare i cookie.
// - Dopo FCM_THROTTLE_MAX_FAILS errori in FCM_THROTTLE_WINDOW secondi i client "non fidati"
//   (senza device cookie valido per quell'account) restano bloccati per FCM_THROTTLE_LOCK secondi.
// - Un browser che ha già fatto login con successo riceve un device cookie firmato (HMAC) e ha un
//   contatore separato: il legittimo proprietario non viene tagliato fuori da chi sbaglia apposta
//   la sua password (es. un rivale a ridosso della scadenza delle formazioni).
// - Se la cartella non è scrivibile la verifica procede senza limiti (fail-open) e resta un avviso
//   nell'error_log: meglio un login non limitato che un sito inutilizzabile.

if (!defined('FCM_THROTTLE_MAX_FAILS')) {
    define('FCM_THROTTLE_MAX_FAILS', 8);       // errori consentiti nella finestra
}
if (!defined('FCM_THROTTLE_WINDOW')) {
    define('FCM_THROTTLE_WINDOW', 900);        // finestra di conteggio: 15 minuti
}
if (!defined('FCM_THROTTLE_LOCK')) {
    define('FCM_THROTTLE_LOCK', 900);          // durata del blocco: 15 minuti
}
if (!defined('FCM_DEVICE_COOKIE_TTL')) {
    define('FCM_DEVICE_COOKIE_TTL', 31536000); // device cookie: 1 anno
}
if (!defined('FCM_THROTTLE_GUARD')) {
    // Prima riga di ogni file di stato: se il file venisse mai servito come PHP non stampa nulla.
    define('FCM_THROTTLE_GUARD', "<?php exit; ?>\n");
}

if (!function_exists('fcm_throttle_dir')) {
    /**
     * Cartella dei file di stato (creata al primo uso). NULL se non è utilizzabile.
     */
    function fcm_throttle_dir() {
        static $dir = false;
        if ($dir !== false) {
            return $dir;
        }
        $path = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'throttle';
        if (!is_dir($path)) {
            @mkdir($path, 0755, true);
        }
        if (!is_dir($path) || !is_writable($path)) {
            @error_log('[ModernFCM] inc/data/throttle non scrivibile: limite ai tentativi di login disattivato');
            return $dir = null;
        }
        $ht = $path . DIRECTORY_SEPARATOR . '.htaccess';
        if (!file_exists($ht)) {
            @file_put_contents(
                $ht,
                "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
            );
        }
        return $dir = $path;
    }
}

if (!function_exists('fcm_throttle_transaction')) {
    /**
     * Legge, passa a $fn e riscrive lo stato di un contatore tenendo un lock esclusivo.
     * $fn riceve (array &$state, bool $persistent): con $persistent FALSE lo stato non verrà salvato
     * (cartella non scrivibile) e il chiamante deve comportarsi in modo permissivo.
     * Restituisce il valore di ritorno di $fn.
     */
    function fcm_throttle_transaction($bucket, callable $fn) {
        $state = [];
        $dir = fcm_throttle_dir();
        if ($dir === null) {
            return $fn($state, false);
        }
        $file = $dir . DIRECTORY_SEPARATOR . hash('sha256', (string)$bucket) . '.php';
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return $fn($state, false);
        }
        try {
            if (!@flock($fh, LOCK_EX)) {
                return $fn($state, false);
            }
            $raw = (string)@stream_get_contents($fh);
            $guardLen = strlen(FCM_THROTTLE_GUARD);
            if (strlen($raw) > $guardLen) {
                $decoded = json_decode(substr($raw, $guardLen), true);
                if (is_array($decoded)) {
                    $state = $decoded;
                }
            }
            $result = $fn($state, true);
            @ftruncate($fh, 0);
            @rewind($fh);
            @fwrite($fh, FCM_THROTTLE_GUARD . json_encode($state));
            @fflush($fh);
            @flock($fh, LOCK_UN);
            return $result;
        } finally {
            @fclose($fh);
        }
    }
}

if (!function_exists('fcm_throttle_gc')) {
    /**
     * Rimuove i file di stato non toccati da più di due giorni.
     */
    function fcm_throttle_gc() {
        $dir = fcm_throttle_dir();
        if ($dir === null) {
            return;
        }
        $limit = time() - 172800;
        $files = @glob($dir . DIRECTORY_SEPARATOR . '*.php');
        if (!is_array($files)) {
            return;
        }
        foreach ($files as $f) {
            if (basename($f) === 'secret.php') {
                continue;
            }
            $mt = @filemtime($f);
            if ($mt !== false && $mt < $limit) {
                @unlink($f);
            }
        }
    }
}

if (!function_exists('fcm_throttle_secret')) {
    /**
     * Chiave HMAC dei device cookie, generata al primo uso. Stringa vuota se non disponibile
     * (in quel caso i device cookie sono disattivati e tutti i client contano come non fidati).
     */
    function fcm_throttle_secret() {
        static $secret = null;
        if ($secret !== null) {
            return $secret;
        }
        $dir = fcm_throttle_dir();
        if ($dir === null) {
            return $secret = '';
        }
        $file = $dir . DIRECTORY_SEPARATOR . 'secret.php';
        $read = function () use ($file) {
            $raw = @file_get_contents($file);
            if (!is_string($raw) || strlen($raw) <= strlen(FCM_THROTTLE_GUARD)) {
                return '';
            }
            $val = trim(substr($raw, strlen(FCM_THROTTLE_GUARD)));
            return preg_match('/^[0-9a-f]{64}$/', $val) ? $val : '';
        };
        $val = $read();
        if ($val !== '') {
            return $secret = $val;
        }
        try {
            $new = bin2hex(random_bytes(32));
        } catch (\Throwable $e) {
            return $secret = '';
        }
        $fh = @fopen($file, 'x'); // creazione esclusiva: nessuna gara tra richieste concorrenti
        if ($fh !== false) {
            @chmod($file, 0600);
            @fwrite($fh, FCM_THROTTLE_GUARD . $new);
            @fclose($fh);
            return $secret = $new;
        }
        return $secret = $read();
    }
}

if (!function_exists('fcm_device_cookie_name')) {
    function fcm_device_cookie_name($scope, $account) {
        return 'pn_dc_' . substr(hash('sha256', $scope . '|' . $account), 0, 16);
    }
}

if (!function_exists('fcm_device_cookie_nonce')) {
    /**
     * Nonce del device cookie presentato dal browser per quell'account, o NULL se assente/non valido.
     */
    function fcm_device_cookie_nonce($scope, $account) {
        $secret = fcm_throttle_secret();
        if ($secret === '') {
            return null;
        }
        $name = fcm_device_cookie_name($scope, $account);
        $val = (isset($_COOKIE[$name]) && is_string($_COOKIE[$name])) ? $_COOKIE[$name] : '';
        if (!preg_match('/^([0-9a-f]{32})\.([0-9a-f]{64})$/', $val, $m)) {
            return null;
        }
        $mac = hash_hmac('sha256', $scope . '|' . $account . '|' . $m[1], $secret);
        return hash_equals($mac, $m[2]) ? $m[1] : null;
    }
}

if (!function_exists('fcm_device_cookie_issue')) {
    function fcm_device_cookie_issue($scope, $account) {
        $secret = fcm_throttle_secret();
        if ($secret === '') {
            return;
        }
        try {
            $nonce = bin2hex(random_bytes(16));
        } catch (\Throwable $e) {
            return;
        }
        $name = fcm_device_cookie_name($scope, $account);
        $value = $nonce . '.' . hash_hmac('sha256', $scope . '|' . $account . '|' . $nonce, $secret);
        $_COOKIE[$name] = $value;
        if (headers_sent()) {
            return;
        }
        $expires = time() + FCM_DEVICE_COOKIE_TTL;
        if (PHP_VERSION_ID >= 70300) {
            @setcookie($name, $value, [
                'expires'  => $expires,
                'path'     => '/',
                'secure'   => fcm_is_https(),
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } else {
            @setcookie($name, $value, $expires, '/; samesite=Lax', '', fcm_is_https(), true);
        }
    }
}

if (!function_exists('fcm_login_attempt')) {
    /**
     * Esegue un tentativo di login con limite ai tentativi.
     *
     * @param string   $scope   tipo di account ('admin', 'team', ...)
     * @param string   $account identificativo dell'account (es. id squadra)
     * @param callable $verify  funzione senza argomenti che restituisce TRUE se le credenziali sono giuste
     * @return array{ok:bool,locked:bool,retry_after:int}
     *         locked=TRUE: troppi errori recenti, $verify NON è stata eseguita;
     *         retry_after: secondi di attesa (0 se non bloccato).
     */
    function fcm_login_attempt($scope, $account, callable $verify) {
        $scope = (string)$scope;
        $account = (string)$account;
        $nonce = fcm_device_cookie_nonce($scope, $account);
        $trusted = ($nonce !== null);
        $bucket = $trusted
            ? 'd|' . $scope . '|' . $account . '|' . $nonce
            : 'u|' . $scope . '|' . $account;
        $now = time();

        $out = fcm_throttle_transaction($bucket, function (array &$state, $persistent) use ($verify, $now, $trusted) {
            $lockedUntil = isset($state['locked_until']) ? (int)$state['locked_until'] : 0;
            if ($persistent && $lockedUntil > $now) {
                return ['ok' => false, 'locked' => true, 'retry_after' => $lockedUntil - $now];
            }
            if (call_user_func($verify) === true) {
                if ($trusted) {
                    // gli errori di battitura del proprietario si azzerano; il contatore dei client
                    // non fidati invece no, altrimenti un login riuscito cancellerebbe un attacco in corso
                    $state = ['fails' => [], 'locked_until' => 0];
                }
                return ['ok' => true, 'locked' => false, 'retry_after' => 0];
            }
            $fails = [];
            if (isset($state['fails']) && is_array($state['fails'])) {
                foreach ($state['fails'] as $ts) {
                    if (is_int($ts) && $ts > $now - FCM_THROTTLE_WINDOW && $ts <= $now) {
                        $fails[] = $ts;
                    }
                }
            }
            $fails[] = $now;
            $retry = 0;
            if (count($fails) >= FCM_THROTTLE_MAX_FAILS) {
                $state = ['fails' => [], 'locked_until' => $now + FCM_THROTTLE_LOCK];
                $retry = FCM_THROTTLE_LOCK;
            } else {
                $state = ['fails' => $fails, 'locked_until' => 0];
            }
            return ['ok' => false, 'locked' => false, 'retry_after' => $retry];
        });

        if (!is_array($out)) {
            $out = ['ok' => false, 'locked' => false, 'retry_after' => 0];
        }
        if ($out['ok']) {
            if (!$trusted) {
                fcm_device_cookie_issue($scope, $account);
            }
        } elseif (!$out['locked']) {
            @error_log(sprintf(
                '[ModernFCM] login fallito: scope=%s account=%s ip=%s',
                $scope,
                $account,
                isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '-'
            ));
        }
        try {
            if (random_int(1, 100) === 1) {
                fcm_throttle_gc();
            }
        } catch (\Throwable $e) {
            // la pulizia è facoltativa
        }
        return $out;
    }
}

if (!function_exists('fcm_throttle_message')) {
    /**
     * Messaggio per l'utente quando fcm_login_attempt() risponde locked / retry_after > 0.
     */
    function fcm_throttle_message($retryAfter) {
        $min = max(1, (int)ceil(((int)$retryAfter) / 60));
        return 'Troppi tentativi falliti. Riprova tra ' . $min . ($min === 1 ? ' minuto.' : ' minuti.');
    }
}

if (!function_exists('fcm_admin_login_attempt')) {
    /**
     * Tentativo di login amministratore con limite ai tentativi (contatore unico per tutti i punti
     * d'ingresso admin del sito). NON modifica la sessione: se 'ok' è TRUE il chiamante concede
     * l'accesso (di norma con fcm_admin_session_grant()).
     *
     * @return array{ok:bool,locked:bool,retry_after:int}
     */
    function fcm_admin_login_attempt($submitted, $adminPassword) {
        if (!fcm_is_password_configured($adminPassword) || !is_string($submitted) || $submitted === '') {
            return ['ok' => false, 'locked' => false, 'retry_after' => 0];
        }
        return fcm_login_attempt('admin', 'admin', function () use ($submitted, $adminPassword) {
            return fcm_verify_password($submitted, $adminPassword);
        });
    }
}

if (!function_exists('fcm_admin_session_grant')) {
    /**
     * Segna la sessione come amministratore dopo un login riuscito, rigenerando l'ID di sessione.
     */
    function fcm_admin_session_grant() {
        fcm_ensure_session();
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            @session_regenerate_id(true);
        }
        $_SESSION['pn_admin_logged'] = true;
    }
}

if (!function_exists('fcm_team_login_attempt')) {
    /**
     * Tentativo di login di una squadra (password verificata contro l'hash di invform.inc.php) con
     * limite ai tentativi. Il contatore è lo stesso per invio formazione e mercato.
     *
     * @return array{ok:bool,locked:bool,retry_after:int}
     */
    function fcm_team_login_attempt($idSquadra, $password, $hash) {
        $idSquadra = (int)$idSquadra;
        if ($idSquadra <= 0 || !is_string($hash) || $hash === '' || !is_string($password) || $password === '') {
            return ['ok' => false, 'locked' => false, 'retry_after' => 0];
        }
        return fcm_login_attempt('team', (string)$idSquadra, function () use ($password, $hash) {
            return fcm_verify_team_password($password, $hash);
        });
    }
}

if (!function_exists('fcm_admin_session_active')) {
    /**
     * TRUE se la richiesta arriva da una sessione amministratore già autenticata.
     * Non crea sessioni per i visitatori anonimi: la apre solo se il browser manda già il cookie.
     * Con $closeAfter TRUE la sessione aperta qui viene subito rilasciata (utile negli endpoint
     * lenti, per non tenere bloccate le altre richieste dello stesso utente).
     */
    function fcm_admin_session_active($closeAfter = false) {
        $openedHere = false;
        if (session_status() !== PHP_SESSION_ACTIVE) {
            $cookieId = (isset($_COOKIE[session_name()]) && is_string($_COOKIE[session_name()])) ? $_COOKIE[session_name()] : '';
            if ($cookieId === '' || headers_sent()) {
                return false;
            }
            fcm_ensure_session();
            $openedHere = true;
            // Con lo strict mode un ID che il server non conosce viene sostituito da uno nuovo: non è una
            // sessione esistente. Quella appena creata va eliminata subito, altrimenti basterebbe mandare
            // cookie inventati per riempire la cartella delle sessioni.
            if (session_status() === PHP_SESSION_ACTIVE && session_id() !== $cookieId) {
                $_SESSION = [];
                @session_destroy();
                // Il cookie con il nuovo ID non serve: si toglie solo l'intestazione del cookie di sessione
                $prefix = 'set-cookie: ' . strtolower(session_name()) . '=';
                $others = [];
                foreach (headers_list() as $h) {
                    if (stripos($h, 'Set-Cookie:') === 0 && strpos(strtolower($h), $prefix) !== 0) {
                        $others[] = $h;
                    }
                }
                header_remove('Set-Cookie');
                foreach ($others as $h) {
                    header($h, false);
                }
                return false;
            }
        }
        $isAdmin = !empty($_SESSION['pn_admin_logged']);
        if ($openedHere && $closeAfter && session_status() === PHP_SESSION_ACTIVE) {
            @session_write_close();
        }
        return $isAdmin;
    }
}

if (!function_exists('fcm_cooldown_acquire')) {
    /**
     * Limita la frequenza di un'operazione costosa condivisa tra tutti i visitatori (es. lo
     * scaricamento dei dati live da un sito esterno).
     * TRUE se sono passati almeno $seconds secondi dall'ultima acquisizione riuscita con lo stesso
     * $name: in quel caso l'istante viene registrato e il chiamante può procedere. FALSE se
     * l'operazione è stata eseguita troppo di recente: il chiamante deve servire i dati in cache.
     * Se lo stato non è scrivibile risponde TRUE (nessun limite).
     */
    function fcm_cooldown_acquire($name, $seconds) {
        $seconds = max(0, (int)$seconds);
        $now = time();
        return (bool)fcm_throttle_transaction('cd|' . $name, function (array &$state, $persistent) use ($seconds, $now) {
            if (!$persistent) {
                return true;
            }
            $last = isset($state['last']) ? (int)$state['last'] : 0;
            if ($last > 0 && $last <= $now && ($now - $last) < $seconds) {
                return false;
            }
            $state = ['last' => $now];
            return true;
        });
    }
}
