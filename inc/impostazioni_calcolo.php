<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Impostazioni Calcolo Risultati - ModernFCM Admin
 * Permette la modifica visuale delle impostazioni di fcmCalcoloRisultatiVariabili.js
 */

// 1. Caricamento configurazione password amministratore (stesso file di invform_prec.php)
$baseDir = dirname(__DIR__);
if (file_exists($baseDir . '/invform/admin_config.inc.php')) {
    require_once $baseDir . '/invform/admin_config.inc.php';
} elseif (file_exists($baseDir . '/invform/invform.inc.php')) {
    require_once $baseDir . '/invform/invform.inc.php';
}

$isPasswordConfigured = !empty($adminPassword) && $adminPassword !== '[PASSWORD]';
$jsFilePath = $baseDir . '/js/fcmCalcolorisultatiVariabili.js';

// 2. Logout: distrugge la sessione e reindirizza alla schermata di inserimento password
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    unset($_SESSION['pn_admin_logged']);
    // Distruzione opzionale sessione per pulizia totale
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    header('Location: impostazioni_calcolo.php');
    exit;
}

// 2b. Logout AJAX da SPA
if ((isset($_POST['action']) && $_POST['action'] === 'admin_logout') || (isset($_GET['action']) && $_GET['action'] === 'admin_logout')) {
    header('Content-Type: application/json; charset=utf-8');
    unset($_SESSION['pn_admin_logged']);
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
        if ($submittedPwd === $adminPassword) {
            $_SESSION['pn_admin_logged'] = true;
            if ($isAjax) {
                echo json_encode(['success' => true]);
                exit;
            }
            header('Location: impostazioni_calcolo.php');
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

// 3b. Gestione modulo associazioni live Voti Ufficiosi (Pianetafanta / Fantacalcio.it / FCM)
if (file_exists(__DIR__ . '/liveVU_associazioni_manager.inc.php')) {
    require_once __DIR__ . '/liveVU_associazioni_manager.inc.php';
    handleAssocAjaxRequests($baseDir, $isAdminLogged);
}

// 3c. Gestione modulo associazioni Live Fantapazz (liveFP)
if (file_exists(__DIR__ . '/liveFP_associazioni_manager.inc.php')) {
    require_once __DIR__ . '/liveFP_associazioni_manager.inc.php';
    handleFpAssocAjaxRequests($baseDir, $isAdminLogged);
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

$currentValues = parseCurrentJsVariables($jsFilePath);

// 4b. Endpoint GET per recupero variabili e stato autenticazione da SPA
if ((isset($_GET['action']) && $_GET['action'] === 'get_calcolo_vars') || (isset($_POST['action']) && $_POST['action'] === 'get_calcolo_vars')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'isAdmin' => $isAdminLogged,
        'isConfigured' => $isPasswordConfigured,
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

    $postedData = isset($_POST['vars']) && is_array($_POST['vars']) ? $_POST['vars'] : [];

    // Generazione del contenuto del file js/fcmCalcolorisultatiVariabili.js
    $jsOut = "";
    foreach ($definitions as $sectionKey => $section) {
        $sectionHeaderName = match($sectionKey) {
            'base' => '// Variabili base',
            'gioco' => '// Variabili di gioco',
            'calcolo' => '// Variabili di Calcolo',
            'fasce' => '// Variabili delle fasce gol',
            default => '// ' . $section['title']
        };

        if ($jsOut !== "") {
            $jsOut .= "\n";
        }
        $jsOut .= $sectionHeaderName . "\n";

        foreach ($section['fields'] as $key => $field) {
            $rawVal = isset($postedData[$key]) ? trim($postedData[$key]) : (isset($currentValues[$key]) ? $currentValues[$key] : 0);
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

    $written = @file_put_contents($jsFilePath, $jsOut);
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
?>
<!DOCTYPE html>
<html lang="it" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="author" content="difgusu">
    <title>Configurazione Parametri Calcolo Risultati - ModernFCM</title>

    <!-- Sincronizzazione tema Dark / Light e classe in-iframe -->
    <script type="text/javascript">
        (function() {
            var savedTheme = localStorage.getItem('pn_theme') || 'system';
            var resolved = savedTheme;
            if (savedTheme === 'system' || (savedTheme !== 'light' && savedTheme !== 'dark')) {
                resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', resolved);
            if (window.self !== window.top) {
                document.documentElement.classList.add('in-iframe');
            }
        })();
    </script>

    <!-- Design System CSS -->
    <link href="../css/style.css" rel="stylesheet" type="text/css" />

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
            max-height: 620px;
            overflow-y: auto;
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
                <span class="invform-main-title">ModernFCM • Configurazione Lega</span>
                <span class="invform-subtitle">Parametri di Calcolo Risultati</span>
            </div>
        </a>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button type="button" id="btnToggleTheme" class="invform-back-btn" title="Cambia tema chiaro/scuro" style="cursor: pointer; padding: 8px 12px;">
                <span id="themeIcon">🌓</span>
            </button>
            <a href="../index.php#calcolo" class="invform-back-btn" title="Torna a Calcolo Risultati Manuale">
                <span>🧮 Calcolo Risultati</span>
            </a>
            <?php if ($isAdminLogged): ?>
            <!-- Pulsante Esci da sessione autenticata (con reindirizzamento al login) -->
            <a href="impostazioni_calcolo.php?action=logout" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-weight: 700;" title="Esci dalla sessione amministratore">
                <span>🚪 Esci</span>
            </a>
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

        <form method="post" action="impostazioni_calcolo.php<?php echo !empty($_SERVER['QUERY_STRING']) ? '?' . htmlspecialchars($_SERVER['QUERY_STRING']) : ''; ?>">
            <div style="margin-bottom: 20px;">
                <label for="admin_login_pwd" style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Password Amministrazione:</label>
                <input type="password" id="admin_login_pwd" name="admin_login_pwd" class="inv-password-input" placeholder="Inserisci password admin..." required autofocus style="width: 100%; box-sizing: border-box; padding: 10px 14px; font-size: 0.95rem; border-radius: 8px;">
            </div>
            <button type="submit" class="inv-btn-submit" style="width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; border-radius: 8px; margin-bottom: 12px;">
                🔑 Sblocca Pannello Configurazione
            </button>
        </form>
        <?php endif; ?>

        <!-- Pulsante Torna a Calcolo Manuale dalla schermata di login -->
        <div style="text-align: center; margin-top: 10px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); padding-top: 14px;">
            <a href="index.php#calcolo" class="invform-back-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 10px; font-size: 0.85rem; font-weight: 700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Torna a Calcolo Manuale</span>
            </a>
        </div>
    </div>

    <?php else: ?>

    <!-- PANNELLO DI CONFIGURAZIONE PARAMETRI -->
    <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-md, 8px); padding: 12px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.4rem;">🛡️</span>
            <div>
                <strong style="font-size: 0.9rem; color: var(--accent-emerald, #10b981); display: block;">Sessione Amministratore Attiva</strong>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">
                    File target: <code>js/fcmCalcolorisultatiVariabili.js</code>. I parametri salvati vengono aggiornati istantaneamente per il calcolo dei risultati online.
                </span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div id="lastSavedNotice" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                Ultima sincronizzazione file: <?php echo file_exists($jsFilePath) ? date('d/m/Y H:i', filemtime($jsFilePath)) : 'N/D'; ?>
            </div>
            <a href="impostazioni_calcolo.php?action=logout" class="invform-back-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); padding: 6px 10px; font-size: 0.76rem; font-weight: 700;" title="Esci dalla sessione amministratore">
                <span>🚪 Esci</span>
            </a>
        </div>
    </div>

    <!-- BARRA DI NAVIGAZIONE TAB AMMINISTRATORE -->
    <div class="admin-tab-bar">
        <button type="button" class="admin-tab-btn active" id="tabBtnCalc" onclick="switchAdminTab('calc')">
            <span style="font-size: 1.1rem;">⚙️</span>
            <span>Parametri Calcolo Risultati</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnAssoc" onclick="switchAdminTab('assoc')">
            <span style="font-size: 1.1rem;">🌐</span>
            <span>Associazioni Voti Ufficiosi (liveVU)</span>
        </button>
        <button type="button" class="admin-tab-btn" id="tabBtnAssocFp" onclick="switchAdminTab('assoc-fp')">
            <span style="font-size: 1.1rem;">⚡</span>
            <span>Associazioni Fantapazz (liveFP)</span>
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

    <!-- TAB 2: GESTIONE ASSOCIAZIONI VOTI UFFICIOSI (Pianetafanta / Fantacalcio.it) -->
    <div id="tabContentAssoc" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_associazioni_view.php')) { include __DIR__ . '/inc_associazioni_view.php'; } ?>
    </div>

    <!-- TAB 3: GESTIONE ASSOCIAZIONI FANTAPAZZ (liveFP) -->
    <div id="tabContentAssocFp" class="admin-tab-content" style="display: none;">
        <?php if (file_exists(__DIR__ . '/inc_associazioni_fp_view.php')) { include __DIR__ . '/inc_associazioni_fp_view.php'; } ?>
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
            var allInputs = document.querySelectorAll('input[data-initial]');

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
            var allInputs = document.querySelectorAll('input[data-initial]');
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

            var allInputs = document.querySelectorAll('input[data-initial]');
            allInputs.forEach(function(input) {
                formData.append('vars[' + input.name + ']', input.value);
            });

            fetch('impostazioni_calcolo.php', {
                method: 'POST',
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

        // Gestione cambio tema dinamico
        document.addEventListener('DOMContentLoaded', function() {
            var themeBtn = document.getElementById('btnToggleTheme');
            var themeIcon = document.getElementById('themeIcon');
            function updateIcon(th) {
                if (themeIcon) themeIcon.textContent = (th === 'dark') ? '🌙' : '☀️';
            }
            var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            updateIcon(currentTheme);

            if (themeBtn) {
                themeBtn.addEventListener('click', function() {
                    var curr = document.documentElement.getAttribute('data-theme') || 'light';
                    var next = curr === 'dark' ? 'light' : 'dark';
                    document.documentElement.setAttribute('data-theme', next);
                    localStorage.setItem('pn_theme', next);
                    updateIcon(next);
                });
            }

            // Inizializza stato pulsanti
            checkFormChanges();

            // Inizializzazione tab attivo da hash URL (#assoc, #assoc-fp o #calc)
            if (window.location.hash === '#assoc' || window.location.hash === '#livevu' || window.location.hash === '#assoc-vu') {
                switchAdminTab('assoc');
            } else if (window.location.hash === '#assoc-fp' || window.location.hash === '#livefp' || window.location.hash === '#fantapazz') {
                switchAdminTab('assoc-fp');
            }
        });

        function switchAdminTab(tab) {
            var btnCalc = document.getElementById('tabBtnCalc');
            var btnAssoc = document.getElementById('tabBtnAssoc');
            var btnAssocFp = document.getElementById('tabBtnAssocFp');
            var contentCalc = document.getElementById('tabContentCalc');
            var contentAssoc = document.getElementById('tabContentAssoc');
            var contentAssocFp = document.getElementById('tabContentAssocFp');

            if (!btnCalc || !btnAssoc || !contentCalc || !contentAssoc) return;

            btnCalc.classList.remove('active');
            btnAssoc.classList.remove('active');
            if (btnAssocFp) btnAssocFp.classList.remove('active');

            contentCalc.style.display = 'none';
            contentAssoc.style.display = 'none';
            if (contentAssocFp) contentAssocFp.style.display = 'none';

            if (tab === 'assoc' || tab === 'assoc-vu' || tab === 'livevu') {
                btnAssoc.classList.add('active');
                contentAssoc.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#assoc');
                }
            } else if (tab === 'assoc-fp' || tab === 'livefp' || tab === 'fantapazz') {
                if (btnAssocFp) btnAssocFp.classList.add('active');
                if (contentAssocFp) contentAssocFp.style.display = 'block';
                if (history.replaceState) {
                    history.replaceState(null, null, '#assoc-fp');
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
        ModernFCM • Configurazione Parametri Calcolo Risultati • Pagina Amministratore Riservata
    </footer>

</div>

</body>
</html>
