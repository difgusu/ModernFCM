<?php
/**
 * ModernFCM - AI Matchday Editorial / News API & Cache Manager
 * Gestione proxy sicura per la generazione della cronaca di giornata con Google Gemini (Free Tier)
 * e salvataggio/lettura della cache locale.
 */

require_once __DIR__ . '/admin_security.inc.php';
// La sessione si apre solo se il browser ne ha già una: le letture pubbliche (es. l'elenco per la
// home) non ne creano una per ogni visitatore
$hasAdminSession = fcm_admin_session_active();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// Senza sessione PHP mancherebbero le sue intestazioni anti-cache: la risposta non va memorizzata
header('Cache-Control: no-store, no-cache, must-revalidate');

$baseDir = dirname(__DIR__);
$adminConfigFile = $baseDir . '/inc/admin_config.inc.php';
$aiConfigFile = $baseDir . '/inc/data/ai_config.json';
$cacheDir = $baseDir . '/inc/cache_ai';

// Caricamento password amministratore
$adminPassword = '';
if (file_exists($adminConfigFile)) {
    require $adminConfigFile;
}

// Caricamento configurazione AI esclusivamente da inc/data/ai_config.json
$geminiApiKey = '';
$geminiModel = 'gemini-3.8-flash';
$aiDefaultTone = 'ironico';
if (file_exists($aiConfigFile)) {
    $aiJson = @json_decode(@file_get_contents($aiConfigFile), true);
    if (is_array($aiJson)) {
        if (isset($aiJson['apiKey']) && is_string($aiJson['apiKey'])) {
            $geminiApiKey = trim($aiJson['apiKey']);
        }
        if (!empty($aiJson['model']) && is_string($aiJson['model'])) {
            $geminiModel = trim($aiJson['model']);
        }
        if (!empty($aiJson['defaultTone']) && is_string($aiJson['defaultTone'])) {
            $aiDefaultTone = trim($aiJson['defaultTone']);
        }
    }
}

$isPasswordConfigured = fcm_is_password_configured($adminPassword);
$isAdminLogged = $isPasswordConfigured && $hasAdminSession;
$hasInlinePasswordAuth = false;

// Lettura e buffering input JSON o POST/GET
$rawInput = file_get_contents('php://input');
$inputJson = !empty($rawInput) ? json_decode($rawInput, true) : null;

// Controllo autenticazione immediata tramite parametro admin_pwd / password
if (!$isAdminLogged && $isPasswordConfigured) {
    $providedPwd = $_POST['admin_pwd'] ?? $_POST['password'] ?? ($inputJson['admin_pwd'] ?? ($inputJson['password'] ?? ''));
    if (is_scalar($providedPwd) && (string)$providedPwd !== '') {
        // Verifica con limite ai tentativi, lo stesso contatore di tutti i punti di login admin
        $loginAttempt = fcm_admin_login_attempt((string)$providedPwd, $adminPassword);
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

// Inizializza cartella cache se non presente. Lo fa solo l'admin (le letture pubbliche non scrivono su
// disco) e la cartella nasce chiusa via HTTP: gli editoriali si leggono solo tramite questo script
if ($isAdminLogged && !is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
    @file_put_contents(
        $cacheDir . '/.htaccess',
        "Options -Indexes\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
        . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
    );
}

// Azione richiesta
$action = $_GET['action'] ?? ($inputJson['action'] ?? ($_POST['action'] ?? 'get'));

/**
 * Valore testuale di un parametro: NULL se manca o se arriva un array al posto di una stringa
 */
function fcm_ai_text($value) {
    return is_scalar($value) ? trim((string)$value) : null;
}

/**
 * Funzione helper per eseguire chiamate HTTP POST sicure (cURL o stream)
 */
function fcm_ai_http_post($url, $payloadJson, $timeout = 25, array $extraHeaders = []) {
    $headers = array_merge(['Content-Type: application/json; charset=utf-8'], $extraHeaders);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        fcm_apply_curl_ssl($ch);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        if (PHP_VERSION_ID < 80500) {
            curl_close($ch);
        }
        
        if ($response === false) {
            return ['error' => 'Errore cURL: ' . $curlError, 'httpCode' => $httpCode];
        }
        return ['response' => $response, 'httpCode' => $httpCode];
    }
    
    // Fallback con stream_context
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers) . "\r\n",
            'content' => $payloadJson,
            'timeout' => $timeout,
            // Nessun redirect: gli header (chiave API compresa) non devono arrivare ad altri host
            'follow_location' => 0,
            'ignore_errors' => true
        ]
    ]);
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return ['error' => 'Errore HTTP stream wrapper', 'httpCode' => 500];
    }
    return ['response' => $response, 'httpCode' => 200];
}

switch ($action) {

    // 1. STATO CONFIGURAZIONE (Verifica se la chiave è configurata)
    case 'status': {
        echo json_encode([
            'success' => true,
            'configured' => !empty($geminiApiKey),
            'model' => !empty($geminiModel) ? $geminiModel : 'gemini-3.8-flash',
            'defaultTone' => !empty($aiDefaultTone) ? $aiDefaultTone : 'ironico',
            'isAdmin' => (bool)$isAdminLogged,
            'csrfToken' => (session_status() === PHP_SESSION_ACTIVE) ? fcm_csrf_token() : ''
        ]);
        exit;
    }

    // 2. LETTURA CRONACA SALVATA IN CACHE (Pubblico)
    case 'get': {
        $giornata = isset($_GET['giornata']) ? intval($_GET['giornata']) : (isset($inputJson['giornata']) ? intval($inputJson['giornata']) : 0);
        $cacheFile = '';

        if ($giornata > 0) {
            $cacheFile = $cacheDir . "/news_gio_{$giornata}.json";
        } else {
            // Cerca la giornata più recente in cache
            $files = glob($cacheDir . '/news_gio_*.json');
            if (!empty($files)) {
                rsort($files, SORT_NATURAL);
                $cacheFile = $files[0];
            }
        }

        if (!empty($cacheFile) && file_exists($cacheFile)) {
            $content = @file_get_contents($cacheFile);
            $article = json_decode($content, true);
            if ($article && is_array($article)) {
                echo json_encode([
                    'success' => true,
                    'available' => true,
                    'article' => $article
                ]);
                exit;
            }
        }

        echo json_encode([
            'success' => true,
            'available' => false,
            'message' => 'Nessun editoriale pubblicato per questa giornata.'
        ]);
        exit;
    }

    // 2b. LISTA TUTTI GLI EDITORIALI PUBBLICATI IN CACHE
    case 'list': {
        $files = glob($cacheDir . '/news_gio_*.json');
        $list = [];

        if (!empty($files)) {
            foreach ($files as $file) {
                $content = @file_get_contents($file);
                $article = json_decode($content, true);
                if ($article && is_array($article)) {
                    $list[] = [
                        'giornata' => intval($article['giornata'] ?? 0),
                        'title' => $article['title'] ?? '',
                        'subtitle' => $article['subtitle'] ?? '',
                        'content' => $article['content'] ?? '',
                        'highlights' => $article['highlights'] ?? [],
                        'publishedFormatted' => $article['publishedFormatted'] ?? '',
                        'publishedAt' => $article['publishedAt'] ?? '',
                        'model' => $article['model'] ?? 'Google Gemini'
                    ];
                }
            }
            usort($list, function($a, $b) {
                return $b['giornata'] <=> $a['giornata'];
            });
        }

        echo json_encode([
            'success' => true,
            'list' => $list
        ]);
        exit;
    }

    // 3. SALVATAGGIO CONFIGURAZIONE API (Riservato Admin)
    case 'save_config': {
        fcm_require_post();
        if (!$isAdminLogged) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Non autorizzato. Accesso amministratore richiesto.']);
            exit;
        }
        if (!$hasInlinePasswordAuth) {
            fcm_require_csrf($inputJson);
        }

        $newApiKey = fcm_ai_text($inputJson['apiKey'] ?? ($_POST['apiKey'] ?? null));
        $newModel = fcm_ai_text($inputJson['model'] ?? ($_POST['model'] ?? null));
        $newTone = fcm_ai_text($inputJson['defaultTone'] ?? ($_POST['defaultTone'] ?? null));

        if ($newApiKey === null && $newModel === null && $newTone === null) {
            echo json_encode(['success' => false, 'error' => 'Nessun parametro valido fornito.']);
            exit;
        }

        $apiKeyToSave = ($newApiKey !== null) ? $newApiKey : $geminiApiKey;
        $modelToSave = (!empty($newModel)) ? $newModel : ($geminiModel ?: 'gemini-3.8-flash');
        $toneToSave = (!empty($newTone)) ? $newTone : ($aiDefaultTone ?: 'ironico');

        if (!preg_match('/^[a-zA-Z0-9._-]+$/', $modelToSave)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nome modello Gemini non valido.']);
            exit;
        }

        $aiConfigPayload = [
            'apiKey' => $apiKeyToSave,
            'model' => $modelToSave,
            'defaultTone' => $toneToSave,
            'updatedAt' => date('c')
        ];
        $aiJsonContent = json_encode($aiConfigPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

        if (fcm_write_file_atomic($aiConfigFile, $aiJsonContent, 0644)) {
            echo json_encode([
                'success' => true,
                'message' => 'Configurazione AI salvata con successo in inc/data/ai_config.json.',
                'configured' => !empty($apiKeyToSave),
                'model' => $modelToSave,
                'defaultTone' => $toneToSave
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Impossibile scrivere il file inc/data/ai_config.json.']);
        }
        exit;
    }

    // 4. GENERAZIONE BOZZA CON GOOGLE GEMINI (Riservato Admin)
    case 'generate': {
        fcm_require_post();
        if (!$isAdminLogged) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Non autorizzato. Accesso amministratore richiesto.']);
            exit;
        }
        if (!$hasInlinePasswordAuth) {
            fcm_require_csrf($inputJson);
        }

        if (empty($geminiApiKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Chiave API Google Gemini non configurata. Inseriscila nelle impostazioni.']);
            exit;
        }
        // La chiave viaggia in un header HTTP: niente spazi né caratteri di controllo (a-capo compresi)
        if (!preg_match('/^[\x21-\x7e]+\z/', $geminiApiKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Chiave API Google Gemini non valida. Reinseriscila nelle impostazioni.']);
            exit;
        }

        $giornata = isset($inputJson['giornata']) ? intval($inputJson['giornata']) : 0;
        $systemPrompt = (string)fcm_ai_text($inputJson['systemPrompt'] ?? null);
        $dataSummary = isset($inputJson['dataSummary']) ? $inputJson['dataSummary'] : null;
        $requestedModel = fcm_ai_text($inputJson['model'] ?? null) ?: ($geminiModel ?: 'gemini-3.8-flash');
        // Se il client ha inviato un vecchio modello deprecato (gemini-2.5 o gemini-1.5), migra silenziosamente a gemini-3.8-flash
        if ($requestedModel === 'gemini-2.5-flash' || $requestedModel === 'gemini-1.5-flash') {
            $requestedModel = 'gemini-3.8-flash';
        }
        if (!preg_match('/^[a-zA-Z0-9._-]+$/', $requestedModel)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nome modello Gemini non valido.']);
            exit;
        }

        if (empty($systemPrompt)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Prompt di istruzioni mancante.']);
            exit;
        }

        // Costruzione payload per Google Gemini con istruzioni di output JSON
        $dataSummaryText = is_array($dataSummary) ? json_encode($dataSummary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : (string)$dataSummary;

        $fullPrompt = "Sei un giornalista sportivo esperto di Fantacalcio.\n\n"
            . "REGOLA FONDAMENTALE E IMPERATIVA (ANTI-ALLUCINAZIONE):\n"
            . "- Devi basare la tua cronaca, i commenti, i nomi dei calciatori, i marcatori, i punteggi, i fantavoti, i dati del FantaMister e le posizioni in classifica ESCLUSIVAMENTE sui DATI REALI forniti nel blocco JSON sottostante.\n"
            . "- NON INVENTARE MAI marcatori, gol, calciatori, voti o risultati che non siano presenti in questi dati.\n"
            . "- Ogni gol menzionato deve corrispondere all'elenco marcatori reale del match. Se una squadra non ha marcatori o ha segnato 0 gol, non attribuirle marcatori inventati.\n"
            . "- Cita fedelmente il Top Player assoluto (il calciatore con il fantavoto più alto del turno indicato nei dati in 'miglioreAssoluto' o 'migliorGiocatoreMovimento', NON un portiere generico a meno che non sia stato lui a prendere il voto più alto della giornata) e il Flop Player.\n"
            . "- Cita fedelmente il Miglior Allenatore e il Peggior Allenatore FantaMister (con i relativi scarti e i punti lasciati colpevolmente in panchina).\n"
            . "- Racconta TUTTI i risultati delle partite giocate nel turno anche se appartengono a differenti competizioni, coppe, divisioni o gironi (usa 'riepilogoPerCompetizione' e i campi 'competizione' / 'divisioneGirone' di ogni partita).\n"
            . "- Confronta la 'classificaAttuale' con la 'classificaTurnoPrecedente' (e usa l'elenco 'sorpassiInClassifica' e 'classifichePerCompetizione') per segnalare con precisione tutti i sorpassi, i cambi di vetta e i movimenti reali in classifica avvenuti in questa giornata, senza inventare variazioni di posizione.\n\n"
            . "ISTRUZIONI EDITORIALI E STILE RICHIESTO:\n" . $systemPrompt . "\n\n"
            . "DATI DELLA GIORNATA (RIGOROSAMENTE REALI):\n" . $dataSummaryText . "\n\n"
            . "REQUISITI DI OUTPUT:\n"
            . "Restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza testo prima o dopo, senza blocchi di codice markdown ```json) con questa esatta struttura:\n"
            . "{\n"
            . "  \"title\": \"Titolo d'impatto accattivante della giornata\",\n"
            . "  \"subtitle\": \"Breve sommario o sottotitolo in una o due frasi\",\n"
            . "  \"content\": \"Testo completo dell'articolo suddiviso in paragrafi separati da doppio a capo (cronaca fedele delle sfide con i marcatori reali e fantavoti decisivi, match clou, rubrica FantaMister con scelte tattiche/rimpianti di panchina, top player con fantavoto reale e flop di giornata, e l'impatto sulla classifica attuale)\",\n"
            . "  \"highlights\": {\n"
            . "    \"clou\": \"Breve sintesi sul match più importante o combattuto con punteggio e marcatori reali\",\n"
            . "    \"top\": \"Il calciatore o la prestazione top assoluta della giornata (miglioreAssoluto o migliorGiocatoreMovimento con fantavoto reale)\",\n"
            . "    \"beffa\": \"La beffa o rimpianto più clamoroso (es. punti lasciati in panchina al FantaMister o sconfitta di misura)\"\n"
            . "  }\n"
            . "}";

        // La chiave va nell'header x-goog-api-key: nell'URL finirebbe nei log di server e proxy
        $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$requestedModel}:generateContent";
        $geminiHeaders = ['x-goog-api-key: ' . $geminiApiKey];

        $geminiPayload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $fullPrompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'temperature' => 0.35,
                'maxOutputTokens' => 2048
            ]
        ];

        $callResult = fcm_ai_http_post($geminiUrl, json_encode($geminiPayload), 30, $geminiHeaders);

        if (isset($callResult['error'])) {
            http_response_code(502);
            echo json_encode(['success' => false, 'error' => 'Errore di connessione verso Google AI: ' . $callResult['error']]);
            exit;
        }

        $rawResponse = $callResult['response'];
        $respData = json_decode($rawResponse, true);

        // Se il modello restituisce errore di non disponibilità o deprecazione, ritenta con gemini-3.8-flash
        if (!empty($respData['error'])) {
            $errMsg = $respData['error']['message'] ?? '';
            if ($requestedModel !== 'gemini-3.8-flash' && (stripos($errMsg, 'no longer available') !== false || stripos($errMsg, 'not found') !== false)) {
                $requestedModel = 'gemini-3.8-flash';
                $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$requestedModel}:generateContent";
                $retryResult = fcm_ai_http_post($geminiUrl, json_encode($geminiPayload), 30, $geminiHeaders);
                if (!isset($retryResult['error'])) {
                    $rawResponse = $retryResult['response'];
                    $respData = json_decode($rawResponse, true);
                }
            }
        }

        if (!empty($respData['error'])) {
            $errMsg = $respData['error']['message'] ?? 'Errore restituito da Google Gemini API';
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Google Gemini API: ' . $errMsg]);
            exit;
        }

        $generatedText = '';
        if (isset($respData['candidates'][0]['content']['parts'][0]['text'])) {
            $generatedText = trim($respData['candidates'][0]['content']['parts'][0]['text']);
        }

        if (empty($generatedText)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Nessun testo generato dalla risposta AI.']);
            exit;
        }

        // Pulisci eventuale markdown wrapping se presente
        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', $generatedText);
        $cleanJson = trim($cleanJson);

        $parsedArticle = json_decode($cleanJson, true);
        if (!$parsedArticle || !is_array($parsedArticle) || empty($parsedArticle['title'])) {
            // Fallback: se l'AI non ha formattato come JSON puro, incapsula il testo generato
            $parsedArticle = [
                'title' => "Editoriale Giornata {$giornata}",
                'subtitle' => "Resoconto e cronaca della giornata",
                'content' => $generatedText,
                'highlights' => [
                    'clou' => "Tutte le sfide dell'ultimo turno",
                    'top' => "Protagonisti di giornata",
                    'beffa' => "I dettagli dai campi"
                ]
            ];
        }

        echo json_encode([
            'success' => true,
            'giornata' => $giornata,
            'model' => $requestedModel,
            'draft' => $parsedArticle
        ]);
        exit;
    }

    // 5. PUBBLICAZIONE CRONACA IN CACHE (Riservato Admin)
    case 'publish': {
        fcm_require_post();
        if (!$isAdminLogged) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Non autorizzato. Accesso amministratore richiesto.']);
            exit;
        }
        if (!$hasInlinePasswordAuth) {
            fcm_require_csrf($inputJson);
        }

        $giornata = isset($inputJson['giornata']) ? intval($inputJson['giornata']) : 0;
        $article = isset($inputJson['article']) ? $inputJson['article'] : null;

        if ($giornata <= 0 || !is_array($article) || empty($article['title'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Dati articolo non validi o incompleti.']);
            exit;
        }

        // Arricchisci metadati articolo
        $article['giornata'] = $giornata;
        $article['publishedAt'] = date('c');
        $article['publishedFormatted'] = date('d/m/Y H:i');
        $article['model'] = !empty($geminiModel) ? $geminiModel : 'gemini-3.8-flash';

        $filePath = $cacheDir . "/news_gio_{$giornata}.json";
        $encoded = json_encode($article, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if (fcm_write_file_atomic($filePath, $encoded, 0644)) {
            echo json_encode([
                'success' => true,
                'message' => "Editoriale per la Giornata {$giornata} pubblicato con successo!",
                'giornata' => $giornata,
                'article' => $article
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => "Impossibile salvare il file di cache per la giornata {$giornata}."]);
        }
        exit;
    }

    // 6. ELIMINAZIONE CRONACA (Riservato Admin)
    case 'delete': {
        fcm_require_post();
        if (!$isAdminLogged) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Non autorizzato.']);
            exit;
        }
        if (!$hasInlinePasswordAuth) {
            fcm_require_csrf($inputJson);
        }
        $giornata = isset($inputJson['giornata']) ? intval($inputJson['giornata']) : 0;
        if ($giornata > 0) {
            $filePath = $cacheDir . "/news_gio_{$giornata}.json";
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Cache eliminata con successo.']);
        exit;
    }

    default: {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Azione non valida.']);
        exit;
    }
}

