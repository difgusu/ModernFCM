<?php
require_once __DIR__ . '/admin_security.inc.php';
fcm_ensure_session();

/**
 * Impostazioni Calcolo Risultati - ModernFCM Admin
 * Permette la modifica visuale delle impostazioni di fcmCalcoloRisultatiVariabili.js
 */

// 1. Caricamento configurazione password amministratore (stesso file di invform_prec.php)
$baseDir = dirname(__DIR__);
if (file_exists($baseDir . '/inc/admin_config.inc.php')) {
    require_once $baseDir . '/inc/admin_config.inc.php';
} elseif (file_exists($baseDir . '/invform/invform.inc.php')) {
    require_once $baseDir . '/invform/invform.inc.php';
}

$isPasswordConfigured = fcm_is_password_configured($adminPassword ?? '');
$jsFilePath = $baseDir . '/js/fcmCalcolorisultatiVariabili.js';

// 2. Logout: distrugge la sessione e reindirizza alla schermata di inserimento password (POST + CSRF)
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['action']) && $_POST['action'] === 'logout') {
    fcm_require_csrf();
    unset($_SESSION['pn_admin_logged']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    header('Location: impostazioni.php');
    exit;
}

// 2b. Logout AJAX da SPA (POST + CSRF)
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'admin_logout') {
    header('Content-Type: application/json; charset=utf-8');
    fcm_require_post();
    fcm_require_csrf();
    unset($_SESSION['pn_admin_logged']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    echo json_encode(['success' => true]);
    exit;
}

// 3. Login POST (Tradizionale & AJAX)
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && (isset($_POST['admin_login_pwd']) || (isset($_POST['action']) && $_POST['action'] === 'admin_login'))) {
    $isAjax = (isset($_POST['action']) && $_POST['action'] === 'admin_login');
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
    }

    if (!$isPasswordConfigured) {
        $loginError = 'Accesso disabilitato: password amministratore non configurata in admin_config.inc.php.';
        if ($isAjax) {
            echo json_encode(['success' => false, 'error' => $loginError]);
            exit;
        }
    } else {
        $submittedPwd = (string)(isset($_POST['pwd']) ? $_POST['pwd'] : (isset($_POST['admin_login_pwd']) ? $_POST['admin_login_pwd'] : ''));
        if ($submittedPwd !== '' && fcm_verify_password($submittedPwd, $adminPassword)) {
            if (!headers_sent() && session_status() === PHP_SESSION_ACTIVE) {
                @session_regenerate_id(true);
            }
            $_SESSION['pn_admin_logged'] = true;
            if ($isAjax) {
                echo json_encode(['success' => true, 'csrfToken' => fcm_csrf_token()]);
                exit;
            }
            header('Location: impostazioni.php');
            exit;
        } else {
            $loginError = 'Password amministratore errata. Riprova.';
            if ($isAjax) {
                echo json_encode(['success' => false, 'error' => $loginError]);
                exit;
            }
        }
    }
}

$isAdminLogged = $isPasswordConfigured && !empty($_SESSION['pn_admin_logged']);

// 3b. Gestione modulo associazioni Live unificato (Tutte le fonti: Pianetafanta / Fantacalcio.it / Fantapazz / FantaMaster / FCM)
if (file_exists(__DIR__ . '/liveVU_associazioni_manager.inc.php')) {
    require_once __DIR__ . '/liveVU_associazioni_manager.inc.php';
    handleAssocAjaxRequests($baseDir, $isAdminLogged);
}

// 4. Mappatura e metadati di tutti i parametri di fcmCalcoloRisultatiVariabili.js
$definitions = [
    'base' => [
        'title' => '⚙️ Variabili Base',
        'desc' => 'Configurazione dei parametri generali di calcolo e dei modificatori di reparto.',
        'fields' => [
            'fattorecampo' => [
                'label' => 'Fattore Campo',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Numero di punti previsto per il fattore campo della squadra che gioca in casa.',
                'comment' => 'Numero di punti previsto per il fattore campo'
            ],
            'diffT' => [
                'label' => 'Differenza Pareggio tra Fasce',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Differenza massima tra i totali per forzare il pareggio tra due punteggi in due fasce diverse (es: 72-70 finisce 2-2; 67-65 finisce 0-0).',
                'comment' => 'Differenza massima tra i totali per forzare il pareggio tra due punteggi in due fasce diverse (Esempi: 72-70 non finisce 2-1 ma 2-2; 67-65 non finisce 1-0 ma 0-0)'
            ],
            'modP' => [
                'label' => 'Modificatore Portiere',
                'type' => 'boolean',
                'desc' => 'Attiva o disattiva il calcolo del modificatore del portiere.',
                'comment' => 'Modificatore portiere: 1 - attivo; 0 - non attivo'
            ],
            'modD' => [
                'label' => 'Modificatore Difesa',
                'type' => 'boolean',
                'desc' => 'Attiva o disattiva il calcolo del modificatore di difesa.',
                'comment' => 'Modificatore difesa: 1 - attivo; 0 - non attivo'
            ],
            'modC' => [
                'label' => 'Modificatore Centrocampo',
                'type' => 'boolean',
                'desc' => 'Attiva o disattiva il calcolo del modificatore di centrocampo.',
                'comment' => 'Modificatore centrocampo: 1 - attivo; 0 - non attivo'
            ],
            'modA' => [
                'label' => 'Modificatore Attacco',
                'type' => 'boolean',
                'desc' => 'Attiva o disattiva il calcolo del modificatore di attacco.',
                'comment' => 'Modificatore attacco: 1 - attivo; 0 - non attivo'
            ],
            'modX' => [
                'label' => 'Modificatore Personalizzato',
                'type' => 'boolean',
                'desc' => 'Attiva o disattiva il calcolo del modificatore personalizzato.',
                'comment' => 'Modificatore personalizzato: 1 - attivo; 0 - non attivo'
            ],
            'golVP' => [
                'label' => 'Gol Decisivo Vittoria / Pareggio',
                'type' => 'boolean',
                'desc' => 'Calcola il bonus per il gol decisivo per la vittoria o per il pareggio.',
                'comment' => 'Calcola il Gol Decisivo per Vittoria/Pareggio: 1 - attivo; 0 - non attivo'
            ],
            'autoGol' => [
                'label' => 'Regola Autogol Squadra',
                'type' => 'boolean',
                'desc' => 'Se una squadra totalizza meno di 59 punti, la squadra avversaria ottiene un gol omaggio (un autogol), a patto che abbia raggiunto quota 59 e abbia staccato l’avversaria di almeno 3 punti.',
                'comment' => 'Regola autogol squadra: 1 - attivo; 0 - non attivo'
            ],
            'pAutogol' => [
                'label' => 'Soglia Punteggio per Concessione Autogol',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punteggio totale inferiore a questo valore per concedere un gol omaggio/autogol all\'avversario (default: 59).',
                'comment' => 'Punteggio minore di X per regalare un gol all\'avversario'
            ],
            'pMinAutogol' => [
                'label' => 'Punteggio Minimo Squadra Beneficiaria',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punteggio totale minimo che deve raggiungere la squadra per beneficiare dell\'autogol omaggio (default: 59).',
                'comment' => 'Punteggio maggiore o uguale a X per la squadra che beneficia dell\'autogol'
            ],
            'pScarAutogol' => [
                'label' => 'Scarto Minimo tra Squadre per Autogol',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Scarto minimo di punti tra le due squadre necessario per assegnare il gol omaggio (default: 3).',
                'comment' => 'Scarto minimo tra le squadre per assegnare l\'autogol'
            ]
        ]
    ],
    'gioco' => [
        'title' => '⚽ Variabili di Gioco (Bonus & Malus)',
        'desc' => 'Punteggi attribuiti agli eventi di gioco (gol, assist, cartellini, rigori).',
        'fields' => [
            'pGolF' => [
                'label' => 'Gol Segnato (Fatto)',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus assegnati per ogni gol realizzato.',
                'comment' => 'Punti per Gol fatto'
            ],
            'pGolS' => [
                'label' => 'Gol Subito',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti malus per ogni gol subito (senza segno meno davanti).',
                'comment' => 'Punti per Gol Subito'
            ],
            'pAutoG' => [
                'label' => 'Autogol',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti malus per autogol (senza segno meno davanti).',
                'comment' => 'Punti per Autogol (senza il segno meno davanti)'
            ],
            'pRigF' => [
                'label' => 'Rigore Segnato',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus per ogni rigore trasformato.',
                'comment' => 'Punti per Rigore segnato'
            ],
            'pRigS' => [
                'label' => 'Rigore Sbagliato',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti malus per rigore fallito (senza segno meno davanti).',
                'comment' => 'Punti per Rigore sbagliato (senza il segno meno davanti)'
            ],
            'pRigP' => [
                'label' => 'Rigore Parato',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus assegnati al portiere per rigore neutralizzato.',
                'comment' => 'Punti per Rigore parato'
            ],
            'pAss' => [
                'label' => 'Assist',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus assegnati per ogni assist vincente.',
                'comment' => 'Punti per Assist'
            ],
            'pAmm' => [
                'label' => 'Ammonizione',
                'type' => 'number',
                'step' => '0.25',
                'desc' => 'Punti malus per cartellino giallo (senza segno meno davanti).',
                'comment' => "Punti per l'Ammonizione (senza il segno meno davanti)"
            ],
            'pEsp' => [
                'label' => 'Espulsione',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti malus per cartellino rosso (senza segno meno davanti).',
                'comment' => "Punti per l'Espulsione (senza il segno meno davanti)"
            ],
            'pPorI' => [
                'label' => 'Portiere Imbattuto',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus per portiere che termina la gara senza subire reti.',
                'comment' => 'Punti per il Portiere imbattuto'
            ],
            'pGolV' => [
                'label' => 'Gol Vittoria',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus aggiuntivi per il gol decisivo vittoria.',
                'comment' => 'Punti per Gol Decisivo per la Vittoria'
            ],
            'pGolP' => [
                'label' => 'Gol Pareggio',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punti bonus aggiuntivi per il gol decisivo pareggio.',
                'comment' => 'Punti per Gol Decisivo per il Pareggio'
            ]
        ]
    ],
    'calcolo' => [
        'title' => '🔢 Variabili di Calcolo & Panchina',
        'desc' => 'Regole su riserve, sostituzioni massime e arrotondamenti.',
        'fields' => [
            'pMaxS' => [
                'label' => 'Numero Massimo Sostituzioni',
                'type' => 'number',
                'step' => '1',
                'desc' => 'Numero massimo di cambi consentiti per squadra durante il calcolo.',
                'comment' => 'Numero massimo di sostituzioni'
            ],
            'intervallovoti' => [
                'label' => 'Intervallo Voti',
                'type' => 'number',
                'step' => '0.05',
                'desc' => 'Frazione o intervallo dei voti da calcolare (es. 0.25 per quarti di voto, 0.5 per mezzi voti).',
                'comment' => 'Intervallo dei voti da calcolare'
            ],
            'totaleNumeroMassimoRiserve' => [
                'label' => 'Riserve in Panchina',
                'type' => 'number',
                'step' => '1',
                'desc' => 'Numero di riserve in panchina (imposta a -1 se tutta la rosa va in panchina).',
                'comment' => 'Numero di riserve della panchina (settare -1 se tutta la rosa va in panchina)'
            ],
            'pMaxRisU' => [
                'label' => 'Max Riserve d\'Ufficio',
                'type' => 'number',
                'step' => '1',
                'desc' => 'Numero massimo di riserve d\'ufficio (6 d\'ufficio) assegnabili per incontro.',
                'comment' => "Numero massimo di Riserve d'ufficio"
            ],
            'pRisUP' => [
                'label' => 'Punti Riserva Ufficio Portiere',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punteggio d\'ufficio assegnato al portiere non subentrato.',
                'comment' => "Punti Riserva d'ufficio Portiere"
            ],
            'pRisU' => [
                'label' => 'Punti Riserva Ufficio Giocatore',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Punteggio d\'ufficio assegnato per gli altri ruoli (D, C, A).',
                'comment' => "Punti Riserva d'ufficio Altro giocatore"
            ],
            'pModDRisU' => [
                'label' => 'Voto Riserva Ufficio per Mod. Difesa',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Voto attribuito alla riserva d\'ufficio nel computo del modificatore difesa.',
                'comment' => "Punti Riserva d'ufficio per il calcolo del modificatore difesa"
            ],
            'pModCRisU' => [
                'label' => 'Voto Riserva Ufficio per Mod. Centrocampo',
                'type' => 'number',
                'step' => '0.5',
                'desc' => 'Voto attribuito alla riserva d\'ufficio nel computo del modificatore centrocampo.',
                'comment' => "Punti Riserva d'ufficio per il calcolo del modificatore centrocampo"
            ],
            'pModAArr' => [
                'label' => 'Arrotondamento Modificatore Attacco',
                'type' => 'boolean',
                'desc' => 'Arrotondamento per difetto al mezzo voto nel calcolo del modificatore attacco.',
                'comment' => 'Arrotondamento per difetto al mezzo voto nel calcolo del modificatore attacco: 1 - attivo; 0 - non attivo'
            ],
            'CalcoloPreciso' => [
                'label' => 'Usa Metodo di Calcolo "Preciso"',
                'type' => 'boolean',
                'default' => 0,
                'desc' => 'Mantiene le frazioni esatte delle medie voto fino al calcolo del totale squadra (es. 19/3 + 20/3 = 13 invece di arrotondare per singolo calciatore).',
                'comment' => 'Usa metodo di calcolo preciso senza arrotondamenti intermedi per giocatore: 1 - attivo; 0 - classico regolamentare'
            ]
        ]
    ],
    'fonti_vu' => [
        'title' => '🌐 Fonti Dati Ufficiosi (liveVU & Calcolo)',
        'desc' => 'Selezione dei quotidiani e delle medie di riferimento per voti, gol e assist ufficiosi (PianetaFanta).',
        'fields' => [
            'VotoSource' => [
                'label' => 'Fonte Voti Ufficiosi',
                'type' => 'select',
                'default' => 6,
                'desc' => 'Quotidiano o combinazione media per i voti ufficiosi del Match Center Live e del Calcolo.',
                'comment' => 'Fonte Voti Ufficiosi: 1 - Gazzetta dello Sport; 2 - Corriere dello Sport; 3 - TuttoSport; 4 - Media Gaz-Cor; 5 - Media 3 quotidiani; 6 - Media Gaz-Cor prevale s.v.',
                'options' => [
                    1 => '1 - Gazzetta dello Sport',
                    2 => '2 - Corriere dello Sport',
                    3 => '3 - TuttoSport',
                    4 => '4 - Media Gazzetta - Corriere',
                    5 => '5 - Media 3 Quotidiani (Gaz-Cor-Tut)',
                    6 => '6 - Media Gaz-Cor (prevale s.v.)'
                ]
            ],
            'Media3_2Voti' => [
                'label' => 'Media 3 Quotidiani: 2 Voti e 1 s.v.',
                'type' => 'select',
                'default' => 1,
                'desc' => 'Regola applicata con Fonte 5 quando il calciatore ha 2 voti validi e 1 senza voto.',
                'comment' => 'Media 3 Quotidiani (2 voti e 1 s.v.): 1 - Media a 2 (voto1+voto2); 2 - Media a 3 (voto1+voto2+6); 3 - Senza voto (SV)',
                'options' => [
                    1 => 'a) Media a 2 (voto1 + voto2)',
                    2 => 'b) Media a 3 (voto1 + voto2 + 6)',
                    3 => 'c) Senza voto (S.V.)'
                ]
            ],
            'Media3_1Voto' => [
                'label' => 'Media 3 Quotidiani: 1 Voto e 2 s.v.',
                'type' => 'select',
                'default' => 3,
                'desc' => 'Regola applicata con Fonte 5 quando il calciatore ha 1 voto valido e 2 senza voto.',
                'comment' => 'Media 3 Quotidiani (1 voto e 2 s.v.): 1 - Valore voto1; 2 - Media a 3 (voto1+6+6); 3 - Senza voto (SV)',
                'options' => [
                    1 => 'a) Valore voto singolo (voto1)',
                    2 => 'b) Media a 3 (voto1 + 6 + 6)',
                    3 => 'c) Senza voto (S.V.)'
                ]
            ],
            'GolSource' => [
                'label' => 'Fonte Gol / Autogol Ufficiosi',
                'type' => 'select',
                'default' => 1,
                'desc' => 'Quotidiano di riferimento per l\'assegnazione di reti e autoreti ufficiosi.',
                'comment' => 'Fonte Gol/Autogol Ufficiosi: 1 - Gazzetta dello Sport; 2 - Corriere dello Sport; 3 - TuttoSport',
                'options' => [
                    1 => '1 - Gazzetta dello Sport',
                    2 => '2 - Corriere dello Sport',
                    3 => '3 - TuttoSport'
                ]
            ],
            'AssistSource' => [
                'label' => 'Fonte Assist Ufficiosi',
                'type' => 'select',
                'default' => 1,
                'desc' => 'Quotidiano di riferimento per l\'assegnazione degli assist ufficiosi.',
                'comment' => 'Fonte Assist Ufficiosi: 1 - Gazzetta dello Sport; 2 - Corriere dello Sport; 3 - TuttoSport',
                'options' => [
                    1 => '1 - Gazzetta dello Sport',
                    2 => '2 - Corriere dello Sport',
                    3 => '3 - TuttoSport'
                ]
            ]
        ]
    ],
    'fasce' => [
        'title' => '🥅 Variabili delle Fasce Gol',
        'desc' => 'Punteggi minimi per ciascun gol (da 1 a 15 gol).',
        'fields' => [
            'fgol1' => ['label' => 'Fascia 1° Gol (soglia minima 1 gol)', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 1 gol.', 'comment' => ''],
            'fgol2' => ['label' => 'Fascia 2° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 2 gol.', 'comment' => ''],
            'fgol3' => ['label' => 'Fascia 3° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 3 gol.', 'comment' => ''],
            'fgol4' => ['label' => 'Fascia 4° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 4 gol.', 'comment' => ''],
            'fgol5' => ['label' => 'Fascia 5° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 5 gol.', 'comment' => ''],
            'fgol6' => ['label' => 'Fascia 6° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 6 gol.', 'comment' => ''],
            'fgol7' => ['label' => 'Fascia 7° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 7 gol.', 'comment' => ''],
            'fgol8' => ['label' => 'Fascia 8° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 8 gol.', 'comment' => ''],
            'fgol9' => ['label' => 'Fascia 9° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 9 gol.', 'comment' => ''],
            'fgol10' => ['label' => 'Fascia 10° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 10 gol.', 'comment' => ''],
            'fgol11' => ['label' => 'Fascia 11° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 11 gol.', 'comment' => ''],
            'fgol12' => ['label' => 'Fascia 12° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 12 gol.', 'comment' => ''],
            'fgol13' => ['label' => 'Fascia 13° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 13 gol.', 'comment' => ''],
            'fgol14' => ['label' => 'Fascia 14° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 14 gol.', 'comment' => ''],
            'fgol15' => ['label' => 'Fascia 15° Gol', 'type' => 'number', 'step' => '0.5', 'desc' => 'Punteggio necessario per realizzare 15 gol.', 'comment' => '']
        ]
    ]
];

// Helper per leggere i valori correnti da fcmCalcolorisultatiVariabili.js
if (!function_exists('parseCurrentJsVariables')) {
function parseCurrentJsVariables($filePath) {
    $vals = [];
    if (!file_exists($filePath)) {
        return $vals;
    }
    $lines = file($filePath, FILE_IGNORE_NEW_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/^(?:var\s+)?([a-zA-Z0-9_]+)\s*=\s*([^;]+);/', $line, $m)) {
            $key = $m[1];
            $val = trim($m[2]);
            if (is_numeric($val)) {
                $vals[$key] = (strpos($val, '.') !== false) ? floatval($val) : intval($val);
            } else {
                $vals[$key] = $val;
            }
        }
    }
    return $vals;
}
}

$currentValues = parseCurrentJsVariables($jsFilePath);

// 4b. Endpoint GET per recupero variabili e stato autenticazione da SPA
if ((isset($_GET['action']) && $_GET['action'] === 'get_calcolo_vars') || (isset($_POST['action']) && $_POST['action'] === 'get_calcolo_vars')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'isAdmin' => $isAdminLogged,
        'isConfigured' => $isPasswordConfigured,
        'csrfToken' => fcm_csrf_token(),
        'lastUpdated' => file_exists($jsFilePath) ? date('d/m/Y H:i', filemtime($jsFilePath)) : 'N/D',
        'definitions' => $definitions,
        'currentValues' => $currentValues
    ]);
    exit;
}

// 5. Salvataggio AJAX / POST delle modifiche (protetto da password admin)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_calcolo_vars') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();

    $postedData = isset($_POST['vars']) && is_array($_POST['vars']) ? $_POST['vars'] : [];

    // Generazione del contenuto del file js/fcmCalcolorisultatiVariabili.js
    $jsOut = "";
    foreach ($definitions as $sectionKey => $section) {
        $sectionHeaderName = match($sectionKey) {
            'base' => '// Variabili base',
            'gioco' => '// Variabili di gioco',
            'calcolo' => '// Variabili di Calcolo',
            'fonti_vu' => '// Fonti Voti Ufficiosi (liveVU & Calcolo)',
            'fasce' => '// Variabili delle fasce gol',
            default => '// ' . $section['title']
        };

        if ($jsOut !== "") {
            $jsOut .= "\n";
        }
        $jsOut .= $sectionHeaderName . "\n";

        foreach ($section['fields'] as $key => $field) {
            $defaultVal = isset($field['default']) ? $field['default'] : 0;
            $rawVal = isset($postedData[$key]) ? trim($postedData[$key]) : (isset($currentValues[$key]) ? $currentValues[$key] : $defaultVal);
            if ($field['type'] === 'boolean') {
                $numVal = ($rawVal === '1' || $rawVal === 1 || $rawVal === 'true' || $rawVal === true) ? 1 : 0;
            } else {
                $numVal = is_numeric($rawVal) ? ((strpos((string)$rawVal, '.') !== false) ? floatval($rawVal) : intval($rawVal)) : 0;
            }

            $comment = !empty($field['comment']) ? " // " . $field['comment'] : "";
            $jsOut .= "{$key} = {$numVal};{$comment}\n";
        }
    }

    // Backup di sicurezza prima di sovrascrivere
    if (file_exists($jsFilePath)) {
        @copy($jsFilePath, $jsFilePath . '.bak');
    }

    $written = fcm_write_file_atomic($jsFilePath, $jsOut, 0644) ? strlen($jsOut) : false;
    if ($written !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'File fcmCalcoloRisultatiVariabili.js salvato con successo!',
            'bytes' => $written,
            'updated' => date('d/m/Y H:i:s')
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile scrivere il file. Verificare i permessi di scrittura sulla cartella js/.'
        ]);
    }
    exit;
}

// 5b. Salvataggio Regole Ranking Storico
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_ranking_config') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();
    $cfg = [];
    if (isset($_POST['cfg']) && is_array($_POST['cfg'])) {
        $cfg = $_POST['cfg'];
    } else {
        if (isset($_POST['placement']) && is_array($_POST['placement'])) {
            $cfg['placement'] = [];
            foreach ($_POST['placement'] as $cId => $ranks) {
                foreach ($ranks as $pos => $val) {
                    $cfg['placement'][(int)$cId][(int)$pos] = floatval($val);
                }
            }
        }
        if (isset($_POST['matches']) && is_array($_POST['matches'])) {
            $cfg['matches'] = [];
            foreach ($_POST['matches'] as $cId => $vals) {
                $cIdInt = (int)$cId;
                if (!is_array($vals)) continue;
                if (isset($vals['home']) || isset($vals['away']) || isset($vals['neutral'])) {
                    foreach (['home', 'away', 'neutral'] as $vKey) {
                        $vData = $vals[$vKey] ?? [];
                        $cfg['matches'][$cIdInt][$vKey] = [
                            'win'  => floatval($vData['win'] ?? 2.0),
                            'draw' => floatval($vData['draw'] ?? 1.2),
                            'loss' => floatval($vData['loss'] ?? 0.0),
                            'gf'   => floatval($vData['gf'] ?? 1.3),
                            'gs'   => floatval($vData['gs'] ?? -1.3),
                        ];
                    }
                } else {
                    $w = floatval($vals['win'] ?? 2.0);
                    $d = floatval($vals['draw'] ?? 1.2);
                    $l = floatval($vals['loss'] ?? 0.0);
                    $gf = floatval($_POST['goals']['gf'] ?? 1.3);
                    $gs = floatval($_POST['goals']['gs'] ?? -1.3);
                    foreach (['home', 'away', 'neutral'] as $vKey) {
                        $cfg['matches'][$cIdInt][$vKey] = [
                            'win' => $w, 'draw' => $d, 'loss' => $l, 'gf' => $gf, 'gs' => $gs
                        ];
                    }
                }
            }
        }
        if (isset($_POST['goals']) && is_array($_POST['goals'])) {
            $cfg['goals'] = [
                'gf' => floatval($_POST['goals']['gf'] ?? 1.3),
                'gs' => floatval($_POST['goals']['gs'] ?? -1.3)
            ];
        }
        $isPct = !empty($_POST['input_is_percentage']);
        if (isset($_POST['decay']) && is_array($_POST['decay'])) {
            $cfg['decay'] = [];
            foreach ($_POST['decay'] as $age => $val) {
                if ($val === '' || $val === null) continue;
                $valFloat = floatval($val);
                if ($isPct) {
                    $cfg['decay'][(int)$age] = round(max(0, min(100, $valFloat)) / 100.0, 4);
                } else {
                    $cfg['decay'][(int)$age] = $valFloat > 1.0 ? round($valFloat / 100.0, 4) : $valFloat;
                }
            }
        }
        if (isset($_POST['older_decay'])) {
            $valFloat = floatval($_POST['older_decay']);
            if ($isPct) {
                $cfg['older_decay'] = round(max(0, min(100, $valFloat)) / 100.0, 4);
            } else {
                $cfg['older_decay'] = $valFloat > 1.0 ? round($valFloat / 100.0, 4) : $valFloat;
            }
        }
        if (isset($_POST['extra_time_mode'])) {
            $em = trim($_POST['extra_time_mode']);
            if (in_array($em, ['regular_only', 'with_supp_no_rig', 'with_all'])) {
                $cfg['extra_time_mode'] = $em;
            }
        }
    }
    $sqliteBase = realpath(__DIR__ . '/../sqlite');
    $dest = "$sqliteBase/ranking_config.json";
    $ok = fcm_write_file_atomic($dest, json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 0644);
    if ($ok !== false) {
        // Rigenera cache ranking
        if (file_exists(__DIR__ . '/api_storico.php')) {
            ob_start();
            $_GET['action'] = 'ranking'; $_GET['refresh'] = '1';
            require_once __DIR__ . '/api_storico.php';
            handleApiAction('ranking', $sqliteBase, true);
            ob_end_clean();
        }
        echo json_encode(['success' => true, 'message' => 'Regole Ranking salvate e ricalcolate con successo!', 'updated' => date('d/m/Y H:i:s')]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Impossibile salvare ranking_config.json in sqlite/.']);
    }
    exit;
}

// 5c. Salvataggio Mappatura Franchigie
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_franchise_map') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();
    $rawMap = isset($_POST['map']) && is_array($_POST['map']) ? $_POST['map'] : [];
    $cleanMap = [];
    foreach ($rawMap as $s => $teams) {
        if (!is_array($teams)) continue;
        foreach ($teams as $locId => $mId) {
            $mIdStr = trim((string)$mId);
            if ($mIdStr === '' || $mIdStr === 'auto' || $mIdStr === '0') {
                continue;
            }
            $cleanMap[(int)$s][(int)$locId] = (int)$mIdStr;
        }
    }
    $sqliteBase = realpath(__DIR__ . '/../sqlite');
    $dest = "$sqliteBase/franchise_map.json";
    $ok = fcm_write_file_atomic($dest, json_encode((object)$cleanMap, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 0644);
    if ($ok !== false) {
        // Rigenera cache confronti, album, almanacco
        if (file_exists(__DIR__ . '/api_storico.php')) {
            ob_start();
            $_GET['refresh'] = '1';
            require_once __DIR__ . '/api_storico.php';
            handleApiAction('confronti', $sqliteBase, true);
            handleApiAction('album', $sqliteBase, true);
            handleApiAction('almanacco', $sqliteBase, true);
            handleApiAction('ranking', $sqliteBase, true);
            handleApiAction('top_costi', $sqliteBase, true);
            handleApiAction('fantamister_storico', $sqliteBase, true);
            handleApiAction('classifica_perpetua', $sqliteBase, true);
            ob_end_clean();
        }
        echo json_encode(['success' => true, 'message' => 'Mappatura franchigie salvata e storico ricalcolato con successo!', 'updated' => date('d/m/Y H:i:s')]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Impossibile salvare franchise_map.json in sqlite/.']);
    }
    exit;
}

// 5d. Salvataggio Mappatura Competizioni
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_competition_map') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();
    $rawMap = isset($_POST['map']) && is_array($_POST['map']) ? $_POST['map'] : [];
    $cleanMap = [];
    foreach ($rawMap as $s => $comps) {
        if (!is_array($comps)) continue;
        foreach ($comps as $locId => $mId) {
            $mIdStr = trim((string)$mId);
            if ($mIdStr === '' || $mIdStr === 'auto') {
                continue;
            }
            $cleanMap[(int)$s][(int)$locId] = (int)$mIdStr;
        }
    }
    $sqliteBase = realpath(__DIR__ . '/../sqlite');
    $dest = "$sqliteBase/competition_map.json";
    $ok = fcm_write_file_atomic($dest, json_encode((object)$cleanMap, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 0644);
    if ($ok !== false) {
        // Rigenera cache confronti, ranking e classifica perpetua
        if (file_exists(__DIR__ . '/api_storico.php')) {
            ob_start();
            $_GET['refresh'] = '1';
            require_once __DIR__ . '/api_storico.php';
            handleApiAction('confronti', $sqliteBase, true);
            handleApiAction('ranking', $sqliteBase, true);
            handleApiAction('classifica_perpetua', $sqliteBase, true);
            ob_end_clean();
        }
        echo json_encode(['success' => true, 'message' => 'Mappatura competizioni salvata e ranking/confronti ricalcolati con successo!', 'updated' => date('d/m/Y H:i:s')]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Impossibile salvare competition_map.json in sqlite/.']);
    }
    exit;
}

// 5d-bis. Upload Logo Competizione Custom
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'upload_competition_logo') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();

    $uploadedFile = $_FILES['logo_file'] ?? ($_FILES['logo'] ?? null);
    if (!$uploadedFile || $uploadedFile['error'] !== UPLOAD_ERR_OK) {
        $errorCode = $uploadedFile ? $uploadedFile['error'] : 'no_file';
        echo json_encode([
            'success' => false,
            'error' => 'Nessun file selezionato o errore durante il caricamento (codice: ' . $errorCode . ')'
        ]);
        exit;
    }

    $compLogosDir = dirname(__DIR__) . '/img/comp_logos';
    if (!is_dir($compLogosDir)) {
        @mkdir($compLogosDir, 0755, true);
    }

    $file = $uploadedFile;
    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        echo json_encode(['success' => false, 'error' => 'Upload non valido.']);
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

    $cleanName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
    if (empty($cleanName)) {
        $cleanName = 'comp_logo_' . time();
    }
    $targetFilename = $cleanName . '.' . $ext;
    $targetPath = $compLogosDir . '/' . $targetFilename;

    if (file_exists($targetPath)) {
        $targetFilename = $cleanName . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
        $targetPath = $compLogosDir . '/' . $targetFilename;
    }

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        @chmod($targetPath, 0644);
        echo json_encode([
            'success' => true,
            'filename' => $targetFilename,
            'value' => 'comp_logos/' . $targetFilename,
            'path' => 'img/comp_logos/' . $targetFilename
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare il file nella cartella img/comp_logos. Verificare i permessi.'
        ]);
    }
    exit;
}

// 5d-ter. Salvataggio Configurazione Loghi Competizioni
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_competition_logos') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();

    $rawLogos = isset($_POST['logos']) && is_array($_POST['logos']) ? $_POST['logos'] : [];
    $allowedDefaults = ['ico-scudetto.gif', 'ico-coppa.gif', 'ico-supercoppa.gif', 'ico-gp.gif'];
    $cleanLogos = [];

    foreach ($rawLogos as $cId => $val) {
        $cIdInt = (int)$cId;
        if ($cIdInt <= 0) continue;
        $valStr = trim((string)$val);
        if ($valStr === '' || $valStr === 'auto') {
            continue;
        }
        if (in_array($valStr, $allowedDefaults, true) || preg_match('/^comp_logos\/[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|gif|webp)$/i', $valStr)) {
            $cleanLogos[(string)$cIdInt] = $valStr;
        }
    }

    $dataDir = __DIR__ . '/data';
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }
    $logosFile = $dataDir . '/competition_logos.json';
    if (file_exists($logosFile)) {
        @copy($logosFile, $logosFile . '.bak');
    }

    $ok = fcm_write_file_atomic($logosFile, json_encode((object)$cleanLogos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 0644);
    if ($ok !== false) {
        $sqliteBase = realpath(__DIR__ . '/../sqlite');
        if ($sqliteBase && file_exists(__DIR__ . '/api_storico.php')) {
            ob_start();
            $_GET['refresh'] = '1';
            require_once __DIR__ . '/api_storico.php';
            handleApiAction('confronti', $sqliteBase, true);
            handleApiAction('ranking', $sqliteBase, true);
            handleApiAction('classifica_perpetua', $sqliteBase, true);
            ob_end_clean();
        }
        echo json_encode([
            'success' => true,
            'message' => 'Loghi competizioni salvati e applicati con successo!',
            'logos' => $cleanLogos,
            'updated' => date('d/m/Y H:i:s')
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare inc/data/competition_logos.json. Verificare i permessi di scrittura.'
        ]);
    }
    exit;
}

// 5d-quater. Eliminazione Logo Competizione Custom dal server
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_competition_logo') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();

    $rawLogo = trim((string)($_POST['logo'] ?? ''));
    $filename = basename(str_replace('\\', '/', $rawLogo));
    if ($filename === '' || !preg_match('/^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|gif|webp)$/i', $filename)) {
        echo json_encode([
            'success' => false,
            'error' => 'Nome file logo custom non valido.'
        ]);
        exit;
    }

    $compLogosDir = dirname(__DIR__) . '/img/comp_logos';
    $targetPath = $compLogosDir . '/' . $filename;
    $relValue = 'comp_logos/' . $filename;

    if (file_exists($targetPath)) {
        if (!@unlink($targetPath)) {
            echo json_encode([
                'success' => false,
                'error' => 'Impossibile eliminare il file da img/comp_logos/. Verificare i permessi.'
            ]);
            exit;
        }
    }

    // Rimuove eventuali riferimenti al file eliminato in inc/data/competition_logos.json
    $resetCompIds = [];
    $logosFile = __DIR__ . '/data/competition_logos.json';
    if (file_exists($logosFile)) {
        $existingLogos = json_decode(@file_get_contents($logosFile), true);
        if (is_array($existingLogos)) {
            $changed = false;
            foreach ($existingLogos as $cIdKey => $val) {
                if ($val === $relValue) {
                    unset($existingLogos[$cIdKey]);
                    $resetCompIds[] = (int)$cIdKey;
                    $changed = true;
                }
            }
            if ($changed) {
                @copy($logosFile, $logosFile . '.bak');
                fcm_write_file_atomic($logosFile, json_encode((object)$existingLogos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 0644);
                $sqliteBase = realpath(__DIR__ . '/../sqlite');
                if ($sqliteBase && file_exists(__DIR__ . '/api_storico.php')) {
                    ob_start();
                    $_GET['refresh'] = '1';
                    require_once __DIR__ . '/api_storico.php';
                    handleApiAction('confronti', $sqliteBase, true);
                    handleApiAction('ranking', $sqliteBase, true);
                    handleApiAction('classifica_perpetua', $sqliteBase, true);
                    ob_end_clean();
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Logo custom "' . $filename . '" eliminato dal server.',
        'filename' => $filename,
        'deletedValue' => $relValue,
        'resetCompIds' => $resetCompIds
    ]);
    exit;
}

// 5e. Salvataggio Configurazione Cartelle Storiche Legacy
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_storico_config') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isAdminLogged) {
        echo json_encode(['success' => false, 'error' => 'Non autorizzato: sessione amministratore scaduta o non valida.']);
        exit;
    }
    fcm_require_csrf();

    $configFile = __DIR__ . '/data/storico_config.json';
    $currentConfig = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : ['showLegacySites' => true, 'seasons' => []];
    if (!is_array($currentConfig)) $currentConfig = ['showLegacySites' => true, 'seasons' => []];

    $showLegacySites = isset($_POST['showLegacySites']) ? (bool)$_POST['showLegacySites'] : ($currentConfig['showLegacySites'] ?? true);
    $seasonsIn = isset($_POST['seasons']) && is_array($_POST['seasons']) ? $_POST['seasons'] : [];

    $cleanSeasons = [];
    foreach ($seasonsIn as $sKey => $sVal) {
        $sId = (int)$sKey;
        if ($sId <= 0) continue;
        $folder = trim((string)($sVal['folder'] ?? ''));
        // Normalizza backslash in slash e rimuove eventuali slash finali, preservando esattamente il percorso relativo (es. ../Stagione_y)
        $folder = str_replace('\\', '/', $folder);
        $folder = rtrim($folder, '/');

        $index = trim((string)($sVal['index'] ?? 'index.php'));
        $index = str_replace(['..', '/', '\\'], '', $index);
        if (empty($index)) $index = 'index.php';

        if (!empty($folder)) {
            $cleanSeasons[(string)$sId] = [
                'folder' => $folder,
                'index' => $index
            ];
        }
    }

    $newConfig = [
        'showLegacySites' => $showLegacySites,
        'seasons' => (object)$cleanSeasons
    ];

    if (file_exists($configFile)) {
        @copy($configFile, $configFile . '.bak');
    }

    $ok = fcm_write_file_atomic($configFile, json_encode($newConfig, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 0644);
    if ($ok !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Configurazione cartelle storiche salvata con successo!',
            'config' => $newConfig
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Impossibile salvare il file inc/data/storico_config.json. Verificare i permessi di scrittura.'
        ]);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="it" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="csrf-token" content="<?php echo htmlspecialchars(fcm_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
    <title>Pannello Amministrazione Lega - ModernFCM</title>

    <!-- Sincronizzazione tema Dark / Light e classe in-iframe -->
    <script type="text/javascript">
        (function() {
            var savedTheme = localStorage.getItem('pn_theme') || 'system';
            var resolved = savedTheme;
            if (savedTheme === 'system' || (savedTheme !== 'light' && savedTheme !== 'dark')) {
                resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.setAttribute('data-theme-preference', savedTheme);
            if (window.self !== window.top) {
                document.documentElement.classList.add('in-iframe');
            }
        })();
    </script>

    <!-- Design System CSS -->
    <link href="../css/style.css" rel="stylesheet" type="text/css" />
    <?php if (file_exists(__DIR__ . '/theme_loader.php')) { require_once __DIR__ . '/theme_loader.php'; echo fcm_render_custom_theme_css(); } ?>

    <style>
        .calc-settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 16px;
            margin-top: 14px;
        }

        .calc-card-section {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            border-radius: var(--radius-lg, 14px);
            padding: 20px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.06);
            margin-bottom: 22px;
        }

        .calc-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .calc-section-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: var(--text-primary, #f8fafc);
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .calc-section-desc {
            font-size: 0.82rem;
            color: var(--text-secondary, #94a3b8);
            margin: 4px 0 0 0;
            line-height: 1.45;
        }

        .calc-field-row {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
            border-radius: var(--radius-md, 10px);
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.2s ease;
        }

        .calc-field-row:focus-within, .calc-field-row:hover {
            border-color: var(--accent-primary, #3b82f6);
            background: rgba(59, 130, 246, 0.03);
        }

        .calc-field-row.is-modified {
            border-color: var(--accent-amber, #f59e0b) !important;
            background: rgba(245, 158, 11, 0.08) !important;
            box-shadow: 0 0 0 1px var(--accent-amber, #f59e0b);
        }

        .calc-field-label-wrap {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 8px;
        }

        .calc-field-label {
            font-size: 0.88rem;
            font-weight: 700;
            color: var(--text-primary, #f8fafc);
        }

        .calc-field-varname {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.72rem;
            color: var(--text-muted, #64748b);
            background: rgba(0,0,0,0.2);
            padding: 2px 6px;
            border-radius: 4px;
        }

        .calc-field-desc {
            font-size: 0.76rem;
            color: var(--text-secondary, #94a3b8);
            line-height: 1.4;
        }

        .calc-control-wrap {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 4px;
        }

        /* Toggle Si / No */
        .toggle-switch {
            display: inline-flex;
            background: var(--bg-surface-elevated, #1e293b);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
            border-radius: 9999px;
            padding: 3px;
            user-select: none;
            gap: 2px;
            position: relative;
        }

        .toggle-btn-opt {
            border: none;
            background: transparent;
            padding: 5px 14px;
            font-size: 0.8rem;
            font-weight: 700;
            border-radius: 9999px;
            cursor: pointer;
            color: var(--text-secondary, #94a3b8);
            transition: all 0.2s ease;
        }

        .toggle-btn-opt.active.opt-si {
            background: var(--accent-emerald, #10b981);
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
        }

        .toggle-btn-opt.active.opt-no {
            background: #ef4444;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
        }

        /* Input numerico */
        .calc-input-number {
            width: 130px;
            background: var(--bg-surface-elevated, #1e293b);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
            border-radius: 8px;
            color: var(--text-primary, #f8fafc);
            font-size: 0.95rem;
            font-weight: 700;
            padding: 7px 12px;
            text-align: right;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .calc-input-number:focus {
            border-color: var(--accent-primary, #3b82f6);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }

        /* Select a tendina opzioni */
        .calc-input-select {
            width: 100%;
            max-width: 270px;
            background: var(--bg-surface-elevated, #1e293b);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
            border-radius: 8px;
            color: var(--text-primary, #f8fafc);
            font-size: 0.85rem;
            font-weight: 700;
            padding: 7px 10px;
            outline: none;
            transition: border-color 0.2s ease;
            cursor: pointer;
        }

        .calc-input-select:focus {
            border-color: var(--accent-primary, #3b82f6);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }

        /* Barra delle Azioni (Sia Superiore che Sticky Bottom) */
        .calc-actions-bar {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
            border-radius: var(--radius-lg, 16px);
            padding: 12px 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
            margin-bottom: 22px;
            box-sizing: border-box;
        }

        .calc-actions-bar.is-sticky-bottom {
            position: sticky;
            bottom: 12px;
            margin-top: 24px;
            margin-bottom: 16px;
            z-index: 100;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .calc-actions-buttons {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .calc-btn-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid transparent;
            white-space: nowrap;
        }

        .calc-btn-save {
            background: var(--accent-emerald, #10b981);
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .calc-btn-save:hover:not(:disabled) {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }

        .calc-btn-cancel {
            background: var(--bg-surface-elevated, #1e293b);
            color: var(--text-primary, #f8fafc);
            border-color: var(--border-subtle, rgba(255, 255, 255, 0.15));
        }

        .calc-btn-cancel:hover:not(:disabled) {
            background: rgba(255,255,255,0.08);
            transform: translateY(-1px);
        }

        .calc-btn-reset {
            background: var(--bg-surface-elevated, #1e293b);
            color: var(--accent-cyan, #06b6d4);
            border-color: rgba(6, 182, 212, 0.3);
        }

        .calc-btn-reset:hover:not(:disabled) {
            background: rgba(6, 182, 212, 0.12);
            border-color: var(--accent-cyan, #06b6d4);
            transform: translateY(-1px);
        }

        /* Stato Disabilitato / Grigio */
        .calc-btn-action:disabled {
            background: var(--bg-surface-elevated, #1e293b) !important;
            color: var(--text-muted, #64748b) !important;
            border-color: var(--border-subtle, rgba(255, 255, 255, 0.08)) !important;
            cursor: not-allowed !important;
            box-shadow: none !important;
            opacity: 0.55;
            transform: none !important;
        }

        .badge-status-changes {
            font-size: 0.82rem;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            line-height: 1.3;
        }

        .badge-status-changes.no-changes {
            background: rgba(148, 163, 184, 0.12);
            color: var(--text-muted, #94a3b8);
        }

        .badge-status-changes.has-changes {
            background: rgba(245, 158, 11, 0.15);
            color: var(--accent-amber, #f59e0b);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        /* Banner Feedback Toast */
        #notificationToast {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 700;
            display: none;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            animation: slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInToast {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Ottimizzazione Mobile */
        @media (max-width: 640px) {
            .calc-actions-bar {
                flex-direction: column;
                align-items: stretch;
                padding: 12px 14px;
                gap: 10px;
                border-radius: var(--radius-md, 12px);
            }

            .calc-actions-bar .badge-wrap {
                width: 100%;
                text-align: center;
            }

            .badge-status-changes {
                width: 100%;
                justify-content: center;
                box-sizing: border-box;
                font-size: 0.8rem;
                padding: 6px 10px;
            }

            .calc-actions-buttons {
                width: 100%;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }

            .calc-btn-action {
                width: 100%;
                padding: 10px 8px;
                font-size: 0.82rem;
                gap: 6px;
            }

            .calc-settings-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .calc-card-section {
                padding: 14px 12px;
            }

            .calc-field-row {
                padding: 10px 12px;
            }

            .calc-input-number {
                width: 110px;
                font-size: 0.9rem;
            }
        }

        /* Stili Barra Tab Amministratore */
        .admin-tab-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
            padding: 6px;
            border-radius: var(--radius-lg, 14px);
            box-shadow: 0 4px 14px rgba(0,0,0,0.15);
            box-sizing: border-box;
            margin-bottom: 22px;
        }

        .admin-tab-btn {
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 10px 18px;
            border-radius: var(--radius-md, 10px);
            border: none;
            background: transparent;
            color: var(--text-secondary, #94a3b8);
            font-size: 0.92rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.25s ease;
        }

        .admin-tab-btn:hover {
            color: var(--text-primary, #f8fafc);
            background: rgba(255, 255, 255, 0.04);
        }

        .admin-tab-btn.active {
            background: var(--accent-primary, #3b82f6);
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
        }

        /* Stili Gestione Associazioni Live */
        .assoc-header-banner {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
            border-radius: var(--radius-lg, 14px);
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }

        .assoc-upload-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-bottom: 16px;
        }

        @media (max-width: 768px) {
            .assoc-upload-grid { grid-template-columns: 1fr; }
        }

        .assoc-upload-box {
            background: var(--bg-surface, #131d35);
            border: 2px dashed var(--border-subtle, rgba(255, 255, 255, 0.16));
            border-radius: var(--radius-lg, 14px);
            padding: 24px 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s ease;
        }

        .assoc-upload-box:hover, .assoc-upload-box.has-file {
            border-color: var(--accent-primary, #3b82f6);
            background: rgba(59, 130, 246, 0.03);
        }

        .assoc-upload-box.has-file {
            border-color: var(--accent-emerald, #10b981);
            background: rgba(16, 185, 129, 0.04);
        }

        .assoc-upload-icon {
            font-size: 2.2rem;
            line-height: 1;
        }

        .assoc-upload-title {
            font-size: 1rem;
            font-weight: 800;
            color: var(--text-primary, #f8fafc);
        }

        .assoc-upload-subtitle {
            font-size: 0.78rem;
            color: var(--text-muted, #64748b);
            font-family: ui-monospace, monospace;
        }

        .assoc-file-label {
            display: inline-block;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            background: var(--bg-surface-elevated, #1e293b);
            color: var(--text-primary, #f8fafc);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.2));
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 0.85rem;
            font-weight: 700;
            transition: all 0.2s ease;
        }

        .assoc-file-label:hover {
            border-color: var(--accent-primary, #3b82f6);
            background: rgba(59, 130, 246, 0.1);
        }

        .assoc-file-label input[type="file"] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
        }

        .assoc-file-selected-name {
            font-size: 0.78rem;
            color: var(--text-secondary, #94a3b8);
            word-break: break-all;
        }

        .assoc-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        @media (max-width: 768px) {
            .assoc-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .assoc-stat-card {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
            border-radius: var(--radius-md, 10px);
            padding: 14px 16px;
            text-align: center;
        }

        .assoc-stat-val {
            font-size: 1.6rem;
            font-weight: 900;
            color: var(--text-primary, #f8fafc);
            line-height: 1.2;
        }

        .assoc-stat-lbl {
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--text-secondary, #94a3b8);
            margin-top: 4px;
        }

        .stat-card-confirmed .assoc-stat-val { color: var(--accent-emerald, #10b981); }
        .stat-card-doubtful .assoc-stat-val { color: var(--accent-amber, #f59e0b); }
        .stat-card-notfound .assoc-stat-val { color: var(--text-muted, #64748b); }

        .assoc-toolbar {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
            border-radius: var(--radius-md, 10px);
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 14px;
        }

        .assoc-filter-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .assoc-pill-btn {
            background: transparent;
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
            color: var(--text-secondary, #94a3b8);
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .assoc-pill-btn:hover { background: rgba(255,255,255,0.05); }
        .assoc-pill-btn.active {
            background: var(--accent-primary, #3b82f6);
            border-color: var(--accent-primary, #3b82f6);
            color: #ffffff;
        }
        .assoc-pill-btn.pill-doubtful.active {
            background: var(--accent-amber, #f59e0b);
            border-color: var(--accent-amber, #f59e0b);
            color: #000000;
        }
        .assoc-pill-btn.pill-confirmed.active {
            background: var(--accent-emerald, #10b981);
            border-color: var(--accent-emerald, #10b981);
            color: #ffffff;
        }
        .assoc-pill-btn.pill-notfound.active {
            background: rgba(148, 163, 184, 0.3);
            border-color: #94a3b8;
            color: #ffffff;
        }

        .assoc-search-input {
            background: var(--bg-surface-elevated, #1e293b);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
            border-radius: 8px;
            color: var(--text-primary, #f8fafc);
            padding: 7px 12px;
            font-size: 0.85rem;
            width: 220px;
            outline: none;
        }

        .assoc-table-wrap {
            background: var(--bg-surface, #131d35);
            border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
            border-radius: var(--radius-lg, 14px);
            overflow-x: auto;
            margin-bottom: 22px;
            max-height: none;
            overflow-y: visible;
        }

        .assoc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            text-align: left;
        }

        .assoc-table th {
            background: var(--bg-surface-elevated, #1e293b);
            color: var(--text-muted, #94a3b8);
            font-weight: 700;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .assoc-table td {
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: var(--text-primary, #f8fafc);
            vertical-align: middle;
        }

        .assoc-table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .assoc-table tr.row-doubtful td {
            background: rgba(245, 158, 11, 0.04);
        }

        .assoc-cand-select {
            background: var(--bg-surface-elevated, #1e293b);
            border: 1px solid var(--accent-amber, #f59e0b);
            color: var(--text-primary, #f8fafc);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 0.82rem;
            width: 100%;
            max-width: 280px;
            outline: none;
        }

        .badge-role {
            display: inline-block;
            width: 24px;
            height: 24px;
            line-height: 24px;
            border-radius: 6px;
            text-align: center;
            font-size: 0.76rem;
            font-weight: 900;
            color: #ffffff;
        }
        .badge-role-P { background: #eab308; color: #000; }
        .badge-role-D { background: #3b82f6; }
        .badge-role-C { background: #10b981; }
        .badge-role-A { background: #ef4444; }
    </style>
</head>
<body class="invform-page">

<div id="notificationToast"></div>

<div class="invform-container">

    <!-- HEADER DI NAVIGAZIONE -->
    <header class="invform-nav">
        <a href="../index.php#home" class="invform-brand">
            <img src="../img/logo.png" alt="ModernFCM" onerror="this.src='../img/sq/0.gif'">
            <div class="invform-title-wrap">
                <span class="invform-main-title">ModernFCM • Gestione &amp; Amministrazione Lega</span>
                <span class="invform-subtitle">Pannello di Controllo Unificato</span>
            </div>
        </a>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button type="button" id="btnToggleTheme" class="invform-back-btn" title="Cambia tema (Chiaro / Scuro / Sistema)" aria-label="Cambia tema" style="cursor: pointer; padding: 8px 12px;">
                <span id="themeIcon">🌓</span>
            </button>
            <?php if ($isAdminLogged): ?>
            <!-- Pulsante Esci da sessione autenticata (con reindirizzamento al login) -->
            <form method="post" action="impostazioni.php" style="display:inline;margin:0;">
                <input type="hidden" name="action" value="logout">
                <input type="hidden" name="_csrf" value="<?php echo htmlspecialchars(fcm_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                <button type="submit" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-weight: 700; cursor: pointer;" title="Esci dalla sessione amministratore">
                    <span>🚪 Esci</span>
                </button>
            </form>
            <?php endif; ?>
            <a href="../index.php#home" class="invform-back-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Torna al Sito</span>
            </a>
        </div>
    </header>

    <?php if (!$isAdminLogged): ?>
    <!-- FORM DI LOGIN AMMINISTRATORE -->
    <div style="max-width: 440px; margin: 40px auto; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg, 12px); padding: 28px; box-shadow: 0 12px 30px rgba(0,0,0,0.15);">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 2.8rem; margin-bottom: 8px;">🔐</div>
            <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Accesso Riservato Amministratore</h2>
            <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Inserisci la password di amministrazione (configurata in <code>admin_config.inc.php</code>) per gestire e modificare i parametri del calcolo risultati.
            </p>
        </div>

        <?php if (!$isPasswordConfigured): ?>
        <div style="color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 14px; font-size: 0.88rem; font-weight: 600; text-align: center; line-height: 1.5; margin-bottom: 18px;">
            ⚠️ <strong>Configurazione Amministratore Incompleta</strong><br>
            La variabile <code>$adminPassword</code> non è impostata in <code>admin_config.inc.php</code>.<br>
            Configura la password per abilitare l'accesso.
        </div>
        <?php else: ?>
        <?php if (!empty($loginError)): ?>
        <div style="color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; font-weight: 600; margin-bottom: 18px; text-align: center;">
            ⚠️ <?php echo htmlspecialchars($loginError); ?>
        </div>
        <?php endif; ?>

        <form method="post" action="impostazioni.php<?php echo !empty($_SERVER['QUERY_STRING']) ? '?' . htmlspecialchars($_SERVER['QUERY_STRING']) : ''; ?>">
            <div style="margin-bottom: 20px;">
                <label for="admin_login_pwd" style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Password Amministrazione:</label>
                <input type="password" id="admin_login_pwd" name="admin_login_pwd" class="inv-password-input" placeholder="Inserisci password admin..." required autofocus style="width: 100%; box-sizing: border-box; padding: 10px 14px; font-size: 0.95rem; border-radius: 8px;">
            </div>
            <button type="submit" class="inv-btn-submit" style="width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; border-radius: 8px; margin-bottom: 12px;">
                🔑 Sblocca Pannello Configurazione
            </button>
        </form>
        <?php endif; ?>

        <!-- Pulsante Torna al Sito dalla schermata di login -->
        <div style="text-align: center; margin-top: 10px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); padding-top: 14px;">
            <a href="../index.php#home" class="invform-back-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 10px; font-size: 0.85rem; font-weight: 700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Torna al Sito</span>
            </a>
        </div>
    </div>

    <?php else: ?>

    <!-- PANNELLO DI CONFIGURAZIONE PARAMETRI -->
    <div style="background: var(--bg-surface-elevated, #1e293b); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-md, 8px); padding: 12px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.4rem;">🛡️</span>
            <div>
                <strong style="font-size: 0.9rem; color: var(--accent-emerald, #10b981); display: block;">Sessione Amministratore Attiva</strong>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <form method="post" action="impostazioni.php" style="display:inline;margin:0;">
                <input type="hidden" name="action" value="logout">
                <input type="hidden" name="_csrf" value="<?php echo htmlspecialchars(fcm_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                <button type="submit" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); padding: 6px 10px; font-size: 0.76rem; font-weight: 700; cursor: pointer;" title="Esci dalla sessione amministratore">
                    <span>🚪 Esci</span>
                </button>
            </form>
        </div>
    </div>

    <!-- BARRA DI NAVIGAZIONE TAB AMMINISTRATORE -->
    <div class="admin-tab-bar">
        <button type="button" class="admin-tab-btn active" id="tabBtnCalc" onclick="switchAdminTab('calc')">
            <span style="font-size: 1.1rem;">⚙️</span>
            <span>Parametri Calcolo Risultati</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnAssoc" onclick="switchAdminTab('assoc')">
            <span style="font-size: 1.1rem;">🔗</span>
            <span>Associazioni Live (Tutte le Fonti)</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnRanking" onclick="switchAdminTab('ranking')">
            <span style="font-size: 1.1rem;">🏆</span>
            <span>Ranking &amp; Storico</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnHome" onclick="switchAdminTab('home')">
            <span style="font-size: 1.1rem;">🏠</span>
            <span>Personalizzazione Home</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnTheme" onclick="switchAdminTab('theme')">
            <span style="font-size: 1.1rem;">🎨</span>
            <span>Personalizzazione Tema</span>
        </button>
    </div>

    <!-- TAB 1: PARAMETRI CALCOLO RISULTATI -->
    <div id="tabContentCalc" class="admin-tab-content">
        <form id="calcSettingsForm" onsubmit="return false;">

        <!-- ACTION BAR SUPERIORE (In testa: subito dopo il banner sessione e prima di Variabili Base) -->
        <div class="calc-actions-bar">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes badgeChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>

            <div class="calc-actions-buttons">
                <!-- Pulsante Annulla Modifiche (Superiore) -->
                <button type="button" class="calc-btn-action calc-btn-cancel btnCancelChanges" disabled onclick="annullaModifiche()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    <span>Annulla modifiche</span>
                </button>

                <!-- Pulsante Salva Modifiche (Superiore) -->
                <button type="button" class="calc-btn-action calc-btn-save btnSaveModifiche" disabled onclick="salvaModifiche()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva modifiche</span>
                </button>
            </div>
        </div>

        <?php foreach ($definitions as $sectionKey => $section): ?>
        <section class="calc-card-section">
            <div class="calc-section-header">
                <div>
                    <h3 class="calc-section-title"><?php echo htmlspecialchars($section['title']); ?></h3>
                    <p class="calc-section-desc"><?php echo htmlspecialchars($section['desc']); ?></p>
                </div>
            </div>

            <div class="calc-settings-grid">
                <?php foreach ($section['fields'] as $key => $field): 
                    $currentVal = isset($currentValues[$key]) ? $currentValues[$key] : ($field['type'] === 'boolean' ? 0 : 0);
                ?>
                <div class="calc-field-row" id="row_<?php echo htmlspecialchars($key); ?>" data-var="<?php echo htmlspecialchars($key); ?>">
                    <div class="calc-field-label-wrap">
                        <span class="calc-field-label"><?php echo htmlspecialchars($field['label']); ?></span>
                        <code class="calc-field-varname"><?php echo htmlspecialchars($key); ?></code>
                    </div>
                    <div class="calc-field-desc"><?php echo htmlspecialchars($field['desc']); ?></div>

                    <div class="calc-control-wrap">
                        <?php if ($field['type'] === 'boolean'): ?>
                            <!-- Toggle Si / No in Linguaggio Naturale -->
                            <div class="toggle-switch" data-var="<?php echo htmlspecialchars($key); ?>" role="group" aria-label="<?php echo htmlspecialchars($field['label']); ?>">
                                <button type="button" class="toggle-btn-opt opt-si <?php echo ($currentVal == 1) ? 'active' : ''; ?>" data-value="1" onclick="setBoolVal('<?php echo htmlspecialchars($key); ?>', 1)">Sì</button>
                                <button type="button" class="toggle-btn-opt opt-no <?php echo ($currentVal == 0) ? 'active' : ''; ?>" data-value="0" onclick="setBoolVal('<?php echo htmlspecialchars($key); ?>', 0)">No</button>
                            </div>
                            <input type="hidden" id="input_<?php echo htmlspecialchars($key); ?>" name="<?php echo htmlspecialchars($key); ?>" value="<?php echo ($currentVal == 1) ? '1' : '0'; ?>" data-initial="<?php echo ($currentVal == 1) ? '1' : '0'; ?>">
                        <?php elseif ($field['type'] === 'select'): ?>
                            <!-- Select Dropdown per Opzioni -->
                            <select id="input_<?php echo htmlspecialchars($key); ?>" 
                                    name="<?php echo htmlspecialchars($key); ?>" 
                                    class="calc-input-select" 
                                    data-initial="<?php echo htmlspecialchars((string)$currentVal); ?>" 
                                    onchange="checkFormChanges()">
                                <?php foreach ($field['options'] as $optVal => $optLabel): ?>
                                    <option value="<?php echo htmlspecialchars((string)$optVal); ?>" <?php echo ((string)$currentVal === (string)$optVal) ? 'selected' : ''; ?>>
                                        <?php echo htmlspecialchars($optLabel); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        <?php else: ?>
                            <!-- Input Numerico -->
                            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Valore:</div>
                            <input type="number" 
                                   id="input_<?php echo htmlspecialchars($key); ?>" 
                                   name="<?php echo htmlspecialchars($key); ?>" 
                                   class="calc-input-number" 
                                   step="<?php echo htmlspecialchars($field['step']); ?>" 
                                   value="<?php echo htmlspecialchars((string)$currentVal); ?>" 
                                   data-initial="<?php echo htmlspecialchars((string)$currentVal); ?>"
                                   oninput="checkFormChanges()">
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endforeach; ?>

        <!-- ACTION BAR INFERIORE (Sticky Bottom) -->
        <div class="calc-actions-bar is-sticky-bottom">
            <div class="badge-wrap">
                <span class="badge-status-changes no-changes badgeChanges">
                    <span>⚪</span> Nessuna modifica non salvata
                </span>
            </div>

            <div class="calc-actions-buttons">
                <!-- Pulsante Annulla Modifiche (Inferiore) -->
                <button type="button" class="calc-btn-action calc-btn-cancel btnCancelChanges" disabled onclick="annullaModifiche()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    <span>Annulla modifiche</span>
                </button>

                <!-- Pulsante Salva Modifiche (Inferiore) -->
                <button type="button" class="calc-btn-action calc-btn-save btnSaveModifiche" disabled onclick="salvaModifiche()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Salva modifiche</span>
                </button>
            </div>
        </div>
    </form>
    </div> <!-- Fine #tabContentCalc -->

    <!-- TAB 2: GESTIONE ASSOCIAZIONI LIVE UNIFICATE (Tutte le Fonti) -->
    <div id="tabContentAssoc" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_associazioni_view.php')) { include __DIR__ . '/inc_associazioni_view.php'; } ?>
    </div>

    <!-- TAB 4: REGOLE RANKING E MAPPATURA FRANCHIGIE STORICHE -->
    <div id="tabContentRanking" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_ranking_storico_view.php')) { include __DIR__ . '/inc_ranking_storico_view.php'; } ?>
    </div>

    <!-- TAB 5: PERSONALIZZAZIONE HOMEPAGE E WIDGET -->
    <div id="tabContentHome" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_homepage_admin_view.php')) { include __DIR__ . '/inc_homepage_admin_view.php'; } ?>
    </div>

    <!-- TAB 6: PERSONALIZZAZIONE TEMA GRAFICO -->
    <div id="tabContentTheme" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_theme_admin_view.php')) { include __DIR__ . '/inc_theme_admin_view.php'; } ?>
    </div>

    <script type="text/javascript">
        // Stato e gestione modifiche
        var initialValues = <?php echo json_encode($currentValues); ?>;
        var modifiedKeys = new Set();

        function setBoolVal(key, val) {
            var hiddenInput = document.getElementById('input_' + key);
            if (!hiddenInput) return;
            hiddenInput.value = val.toString();

            var row = document.getElementById('row_' + key);
            if (row) {
                var toggleContainer = row.querySelector('.toggle-switch');
                if (toggleContainer) {
                    var btns = toggleContainer.querySelectorAll('.toggle-btn-opt');
                    btns.forEach(function(b) {
                        var bVal = b.getAttribute('data-value');
                        if (bVal === val.toString()) {
                            b.classList.add('active');
                        } else {
                            b.classList.remove('active');
                        }
                    });
                }
            }
            checkFormChanges();
        }

        function checkFormChanges() {
            modifiedKeys.clear();
            var allInputs = document.querySelectorAll('input[data-initial], select[data-initial]');

            allInputs.forEach(function(input) {
                var initial = input.getAttribute('data-initial');
                var current = input.value;
                var varKey = input.name;
                var row = document.getElementById('row_' + varKey);

                // Normalizzazione numerica per confronto affidabile
                var isDiff = false;
                if (!isNaN(parseFloat(initial)) && !isNaN(parseFloat(current))) {
                    isDiff = (parseFloat(initial) !== parseFloat(current));
                } else {
                    isDiff = (initial !== current);
                }

                if (isDiff) {
                    modifiedKeys.add(varKey);
                    if (row) row.classList.add('is-modified');
                } else {
                    if (row) row.classList.remove('is-modified');
                }
            });

            var btnSaveList = document.querySelectorAll('.btnSaveModifiche');
            var btnCancelList = document.querySelectorAll('.btnCancelChanges');
            var badgeList = document.querySelectorAll('.badgeChanges');

            var hasModifications = (modifiedKeys.size > 0);

            btnSaveList.forEach(function(btn) {
                btn.disabled = !hasModifications;
            });
            btnCancelList.forEach(function(btn) {
                btn.disabled = !hasModifications;
            });

            badgeList.forEach(function(badge) {
                if (hasModifications) {
                    badge.className = 'badge-status-changes has-changes badgeChanges';
                    badge.innerHTML = '<span>🟡</span> ' + modifiedKeys.size + (modifiedKeys.size === 1 ? ' modifica non salvata' : ' modifiche non salvate');
                } else {
                    badge.className = 'badge-status-changes no-changes badgeChanges';
                    badge.innerHTML = '<span>⚪</span> Nessuna modifica non salvata';
                }
            });
        }

        function annullaModifiche() {
            var allInputs = document.querySelectorAll('input[data-initial], select[data-initial]');
            allInputs.forEach(function(input) {
                var initial = input.getAttribute('data-initial');
                input.value = initial;
                var varKey = input.name;

                // Se è un toggle Si/No, aggiorna i bottoni
                if (input.type === 'hidden') {
                    setBoolVal(varKey, parseInt(initial, 10));
                }
            });

            checkFormChanges();
            showToast('Modifiche ripristinate ai valori attuali.', 'info');
        }

        function salvaModifiche() {
            var btnSaveList = document.querySelectorAll('.btnSaveModifiche');
            var btnCancelList = document.querySelectorAll('.btnCancelChanges');
            if (!btnSaveList.length || btnSaveList[0].disabled) return;

            btnSaveList.forEach(function(b) {
                b.disabled = true;
                b.innerHTML = '<span>⏳ Salvataggio...</span>';
            });
            btnCancelList.forEach(function(b) {
                b.disabled = true;
            });

            var formData = new FormData();
            formData.append('action', 'save_calcolo_vars');

            var allInputs = document.querySelectorAll('input[data-initial], select[data-initial]');
            allInputs.forEach(function(input) {
                formData.append('vars[' + input.name + ']', input.value);
            });

            var csrfMeta = document.querySelector('meta[name="csrf-token"]');
            var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
            fetch('impostazioni.php', {
                method: 'POST',
                headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
                body: formData
            })
            .then(function(res) {
                return res.json();
            })
            .then(function(data) {
                if (data.success) {
                    // Aggiorna data-initial con i nuovi valori confermati
                    allInputs.forEach(function(input) {
                        input.setAttribute('data-initial', input.value);
                    });
                    checkFormChanges();

                    var lastNotice = document.getElementById('lastSavedNotice');
                    if (lastNotice && data.updated) {
                        lastNotice.textContent = 'Ultima sincronizzazione file: ' + data.updated;
                    }

                    showToast('✅ Parametri salvati con successo su fcmCalcoloRisultatiVariabili.js!', 'success');
                } else {
                    showToast('❌ Errore durante il salvataggio: ' + (data.error || 'Errore sconosciuto'), 'error');
                    checkFormChanges();
                }
            })
            .catch(function(err) {
                showToast('❌ Errore di connessione: ' + err.message, 'error');
                checkFormChanges();
            })
            .finally(function() {
                btnSaveList.forEach(function(b) {
                    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>Salva modifiche</span>';
                });
            });
        }

        function showToast(msg, type) {
            var t = document.getElementById('notificationToast');
            if (!t) return;
            t.textContent = msg;
            if (type === 'success') {
                t.style.background = '#059669';
                t.style.color = '#ffffff';
                t.style.border = '1px solid #10b981';
            } else if (type === 'error') {
                t.style.background = '#dc2626';
                t.style.color = '#ffffff';
                t.style.border = '1px solid #ef4444';
            } else {
                t.style.background = '#1e293b';
                t.style.color = '#f8fafc';
                t.style.border = '1px solid #475569';
            }
            t.style.display = 'block';
            setTimeout(function() {
                t.style.display = 'none';
            }, 3500);
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Inizializza stato pulsanti
            checkFormChanges();

            // Inizializzazione tab attivo da hash URL o parametro tab (?tab=home, #home, ?tab=home&section=ai, ecc.)
            var urlParams = new URLSearchParams(window.location.search);
            var tabParam = (urlParams.get('tab') || '').toLowerCase();
            var sectionParam = (urlParams.get('section') || '').toLowerCase();
            var hash = (window.location.hash || '').toLowerCase();

            if (tabParam === 'home' || tabParam === 'homepage' || tabParam === 'widgets' || tabParam === 'ai' || sectionParam === 'ai' || hash === '#home' || hash === '#homepage' || hash === '#widgets' || hash.indexOf('ai') !== -1) {
                var targetAnchor = (sectionParam === 'ai' || hash.indexOf('ai') !== -1) ? '#sezione-ai-news' : null;
                switchAdminTab('home', targetAnchor);
            } else if (tabParam === 'theme' || tabParam === 'tema' || hash === '#theme' || hash === '#tema') {
                switchAdminTab('theme');
            } else if (tabParam === 'ranking' || tabParam === 'storico' || hash === '#ranking' || hash === '#storico') {
                switchAdminTab('ranking');
            } else if (tabParam === 'assoc' || tabParam === 'livevu' || tabParam === 'assoc-vu' || tabParam === 'assoc-fp' || tabParam === 'livefp' || tabParam === 'fantapazz' || hash === '#assoc' || hash === '#livevu' || hash === '#assoc-vu' || hash === '#assoc-fp' || hash === '#livefp' || hash === '#fantapazz') {
                switchAdminTab('assoc');
            } else if (tabParam === 'calc' || hash === '#calc') {
                switchAdminTab('calc');
            }
        });

        function switchAdminTab(tab, targetHash) {
            var btnCalc = document.getElementById('tabBtnCalc');
            var btnAssoc = document.getElementById('tabBtnAssoc');
            var btnRanking = document.getElementById('tabBtnRanking');
            var btnHome = document.getElementById('tabBtnHome');
            var btnTheme = document.getElementById('tabBtnTheme');
            var contentCalc = document.getElementById('tabContentCalc');
            var contentAssoc = document.getElementById('tabContentAssoc');
            var contentRanking = document.getElementById('tabContentRanking');
            var contentHome = document.getElementById('tabContentHome');
            var contentTheme = document.getElementById('tabContentTheme');

            if (!btnCalc || !btnAssoc || !contentCalc || !contentAssoc) return;

            btnCalc.classList.remove('active');
            btnAssoc.classList.remove('active');
            if (btnRanking) btnRanking.classList.remove('active');
            if (btnHome) btnHome.classList.remove('active');
            if (btnTheme) btnTheme.classList.remove('active');

            contentCalc.style.display = 'none';
            contentAssoc.style.display = 'none';
            if (contentRanking) contentRanking.style.display = 'none';
            if (contentHome) contentHome.style.display = 'none';
            if (contentTheme) contentTheme.style.display = 'none';

            if (tab === 'assoc' || tab === 'assoc-vu' || tab === 'livevu' || tab === 'assoc-fp' || tab === 'livefp' || tab === 'fantapazz') {
                btnAssoc.classList.add('active');
                contentAssoc.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#assoc');
                }
            } else if (tab === 'ranking' || tab === 'storico') {
                if (btnRanking) btnRanking.classList.add('active');
                if (contentRanking) contentRanking.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#ranking');
                }
            } else if (tab === 'home' || tab === 'homepage' || tab === 'widgets' || tab === 'ai') {
                if (btnHome) btnHome.classList.add('active');
                if (contentHome) contentHome.style.display = 'block';

                var finalHash = targetHash || (window.location.hash || '');
                if (finalHash && (finalHash.indexOf('ai') !== -1 || finalHash === '#sezione-ai-news')) {
                    if (history.replaceState) {
                        history.replaceState(null, null, '#sezione-ai-news');
                    }
                    setTimeout(function() {
                        var targetEl = document.getElementById('sezione-ai-news');
                        if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            targetEl.style.transition = 'box-shadow 0.4s ease';
                            targetEl.style.boxShadow = '0 0 0 3px var(--accent-primary)';
                            setTimeout(function() { targetEl.style.boxShadow = ''; }, 2500);
                        }
                    }, 250);
                } else if (history.replaceState) {
                    history.replaceState(null, null, '#home');
                }

                if (typeof fcmHomepageAdmin !== 'undefined' && !window.fcmHomeAdminInitialized) {
                    window.fcmHomeAdminInitialized = true;
                    fcmHomepageAdmin.init();
                }
            } else if (tab === 'theme' || tab === 'tema') {
                if (btnTheme) btnTheme.classList.add('active');
                if (contentTheme) contentTheme.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#theme');
                }
                if (typeof fcmThemeAdmin !== 'undefined' && !window.fcmThemeAdminInitialized) {
                    window.fcmThemeAdminInitialized = true;
                    fcmThemeAdmin.init();
                }
            } else {
                btnCalc.classList.add('active');
                contentCalc.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#calc');
                }
            }
        }
    </script>
    <?php endif; ?>

    <footer style="text-align: center; padding: 24px 10px; font-size: 0.75rem; color: var(--text-muted, #64748b);">
        ModernFCM • Pannello di Controllo Unificato Amministratore Lega
    </footer>

</div>

<script src="../js/fcmThemeToggle.js?v=<?php echo filemtime(__DIR__ . '/../js/fcmThemeToggle.js'); ?>"></script>
</body>
</html>
