<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/db.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/fcm_parser.php';
require_once __DIR__ . '/inc/crypto.php';
require_once __DIR__ . '/inc/rules.php';
require_once __DIR__ . '/inc/resolver.php';

$action = $_REQUEST['action'] ?? '';

try {
    switch ($action) {
        case 'login_team':
            $idSquadra = (int)($_POST['id_squadra'] ?? 0);
            $password = (string)($_POST['password'] ?? '');
            $res = mercato_login_team($idSquadra, $password);
            echo json_encode($res);
            break;

        case 'login_admin':
            $password = (string)($_POST['password'] ?? '');
            $res = mercato_login_admin($password);
            echo json_encode($res);
            break;

        case 'logout':
            mercato_logout();
            echo json_encode(['success' => true]);
            break;

        case 'get_state':
            $sessione = mercato_get_current_session();
            $teamId = mercato_get_logged_team_id();
            $isAdmin = mercato_is_admin();

            $financials = null;
            $liberi = [];
            if ($teamId && $sessione) {
                $financials = mercato_get_team_financials($teamId, $sessione['id']);
                $div = $_SESSION['mercato_divisione'] ?? 0;
                $liberi = fcm_get_liberi_per_divisione($div);
            }

            // Elenco squadre per la tendina di login
            $fcmData = fcm_parse_all_data();
            $squadreElenco = [];
            foreach ($fcmData['fantasquadre'] as $sq) {
                $squadreElenco[] = [
                    'id'   => $sq['id'],
                    'nome' => $sq['nome'],
                    'div'  => $sq['divisione']
                ];
            }

            echo json_encode([
                'success'        => true,
                'is_team_logged' => !empty($teamId),
                'team_id'        => $teamId,
                'team_name'      => $_SESSION['mercato_team_name'] ?? null,
                'is_admin'       => $isAdmin,
                'sessione'       => $sessione,
                'financials'     => $financials,
                'liberi'         => $liberi,
                'squadre'        => $squadreElenco,
                'settings'       => get_mercato_settings()
            ]);
            break;

        case 'calcola_taglio':
            if (!mercato_is_team_logged()) throw new Exception("Accesso non effettuato.");
            $teamId = (int)$_SESSION['mercato_team_id'];
            $idTaglio = (int)($_GET['id_taglio'] ?? 0);

            $rosaAttiva = fcm_get_rosa_attiva($teamId);
            $giocatoreTaglio = null;
            foreach ($rosaAttiva as $r) {
                if ($r['id'] === $idTaglio) {
                    $giocatoreTaglio = $r;
                    break;
                }
            }

            if (!$giocatoreTaglio) throw new Exception("Calciatore da tagliare non trovato nella tua rosa.");

            $settings = get_mercato_settings();
            $calc = mercato_calcola_recupero_taglio($giocatoreTaglio['club'], $giocatoreTaglio['costo_acq'], $settings);
            echo json_encode(['success' => true, 'data' => $calc]);
            break;

        case 'place_bid':
            if (!mercato_is_team_logged()) throw new Exception("Accesso non effettuato.");
            $sessione = mercato_get_current_session();
            if (!$sessione || empty($sessione['is_open'])) throw new Exception("Il mercato è attualmente chiuso.");

            $teamId = (int)$_SESSION['mercato_team_id'];
            $codiceG = (int)($_POST['codice_giocatore'] ?? 0);
            $offerta = (int)($_POST['offerta'] ?? 0);
            $idTaglio = !empty($_POST['id_taglio']) ? (int)$_POST['id_taglio'] : null;

            if ($offerta <= 0) throw new Exception("L'offerta deve essere maggiore di 0 crediti.");

            // Informazioni calciatore
            $fcmData = fcm_parse_all_data();
            $giocatore = $fcmData['giocatori'][$codiceG] ?? null;
            if (!$giocatore) throw new Exception("Calciatore non trovato.");

            $div = (int)($_SESSION['mercato_divisione'] ?? 0);
            if (isset($fcmData['tesserati_divisione'][$div][$codiceG])) {
                throw new Exception("Questo calciatore è già tesserato o inserito in lista infortunati per una squadra della tua divisione.");
            }

            $settings = get_mercato_settings();
            if (empty($settings['mostra_estera_minore_eliminata'])) {
                $clubUpper = strtoupper($giocatore['club']);
                if (strpos($clubUpper, 'ESTERA') !== false ||
                    strpos($clubUpper, 'MINORE') !== false ||
                    strpos($clubUpper, 'ELIMINAT') !== false ||
                    strpos($clubUpper, 'SVINCOLAT') !== false) {
                    throw new Exception("I calciatori appartenenti a {ESTERA}, {MINORE} o {ELIMINATA} non sono disponibili per l'acquisto.");
                }
            }

            // Calcolo crediti e riserva
            $fin = mercato_get_team_financials($teamId, $sessione['id']);

            // Calcolo eventuale taglio
            $nomeTagliato = null;
            $creditiRecupero = 0;
            $settings = get_mercato_settings();

            if ($idTaglio) {
                foreach ($fin['rosa_attiva'] as $r) {
                    if ($r['id'] === $idTaglio) {
                        $nomeTagliato = $r['nome'];
                        $calc = mercato_calcola_recupero_taglio($r['club'], $r['costo_acq'], $settings);
                        $creditiRecupero = $calc['recupero'];
                        break;
                    }
                }
            } else {
                // Controllo se il ruolo è già saturo
                $ruoloG = (int)$giocatore['ruolo'];
                $limiteRuolo = $fin['limiti_ruolo'][$ruoloG] ?? 8;
                $attualiRuolo = $fin['conteggi_ruolo'][$ruoloG] ?? 0;
                if ($attualiRuolo >= $limiteRuolo) {
                    throw new Exception("Il reparto è già al completo ({$attualiRuolo}/{$limiteRuolo}). È obbligatorio selezionare un giocatore da tagliare.");
                }
            }

            // Controllo Riserva Strategica: conservare 1 credito per ogni slot vuoto rimasto
            $slotVuotiRimanenti = $idTaglio ? $fin['mancanti_totale'] : max(0, $fin['mancanti_totale'] - 1);
            $maxConsentito = $fin['budget_disponibile'] - $slotVuotiRimanenti;

            if ($offerta > $maxConsentito) {
                throw new Exception("Offerta troppo alta! Devi conservare almeno 1 credito per ciascuno dei {$slotVuotiRimanenti} giocatori mancanti per completare la rosa (Max: {$maxConsentito} crediti).");
            }

            // Cifratura dell'offerta
            $cript = mercato_encrypt($offerta);

            // Inserimento / Aggiornamento nuova busta
            mercato_db_save_bid([
                'id_sessione'            => $sessione['id'],
                'id_squadra'             => $teamId,
                'id_divisione'           => $div,
                'codice_giocatore'       => $codiceG,
                'nome_giocatore'         => $giocatore['nome'],
                'ruolo'                  => $giocatore['ruolo'],
                'squadra_serie_a'        => $giocatore['club'],
                'crediti_cifrati'        => $cript['cifrato'],
                'vettore_iv'             => $cript['iv'],
                'id_giocatore_taglio'    => $idTaglio,
                'nome_giocatore_taglio'  => $nomeTagliato,
                'crediti_recuperati'     => $creditiRecupero
            ]);

            echo json_encode(['success' => true, 'msg' => "Busta segreta per {$giocatore['nome']} inviata con successo!"]);
            break;

        case 'delete_bid':
            if (!mercato_is_team_logged()) throw new Exception("Accesso non effettuato.");
            $sessione = mercato_get_current_session();
            if (!$sessione || empty($sessione['is_open'])) throw new Exception("Il mercato è chiuso.");

            $idOfferta = (int)($_POST['id_offerta'] ?? 0);
            $teamId = (int)$_SESSION['mercato_team_id'];

            mercato_db_delete_bid($idOfferta, $teamId, $sessione['id']);
            echo json_encode(['success' => true, 'msg' => "Offerta annullata correttamente."]);
            break;

        case 'admin_save_session':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = !empty($_POST['id']) ? (int)$_POST['id'] : null;
            $nome = trim($_POST['nome'] ?? '');
            $apertura = trim($_POST['data_apertura'] ?? '');
            $chiusura = trim($_POST['data_chiusura'] ?? '');

            if (empty($nome) || empty($apertura) || empty($chiusura)) {
                throw new Exception("Tutti i campi della sessione sono obbligatori.");
            }

            mercato_db_save_session([
                'id'            => $id,
                'nome'          => $nome,
                'data_apertura' => $apertura,
                'data_chiusura' => $chiusura
            ]);

            echo json_encode(['success' => true]);
            break;

        case 'admin_toggle_session':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_POST['id'] ?? 0);
            $attiva = (int)($_POST['attiva'] ?? 0);

            mercato_db_toggle_session($id, $attiva);
            echo json_encode(['success' => true]);
            break;

        case 'admin_save_settings':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $current = get_mercato_settings();

            $updated = [
                'max_giocatori'           => isset($_POST['max_giocatori']) ? (int)$_POST['max_giocatori'] : $current['max_giocatori'],
                'num_p'                   => isset($_POST['num_p']) ? (int)$_POST['num_p'] : $current['num_p'],
                'num_d'                   => isset($_POST['num_d']) ? (int)$_POST['num_d'] : $current['num_d'],
                'num_c'                   => isset($_POST['num_c']) ? (int)$_POST['num_c'] : $current['num_c'],
                'num_a'                   => isset($_POST['num_a']) ? (int)$_POST['num_a'] : $current['num_a'],
                'obbligo_taglio'          => isset($_POST['obbligo_taglio']) ? (int)$_POST['obbligo_taglio'] : $current['obbligo_taglio'],
                'perc_recupero_estera'    => isset($_POST['perc_recupero_estera']) ? max(0, min(100, (int)$_POST['perc_recupero_estera'])) : 100,
                'perc_recupero_minore'    => isset($_POST['perc_recupero_minore']) ? max(0, min(100, (int)$_POST['perc_recupero_minore'])) : 50,
                'perc_recupero_eliminata' => isset($_POST['perc_recupero_eliminata']) ? max(0, min(100, (int)$_POST['perc_recupero_eliminata'])) : 0,
                'perc_recupero_serie_a'          => isset($_POST['perc_recupero_serie_a']) ? max(0, min(100, (int)$_POST['perc_recupero_serie_a'])) : 0,
                'arrotonda_eccesso'              => !empty($_POST['arrotonda_eccesso']) ? 1 : 0,
                'mostra_estera_minore_eliminata' => !empty($_POST['mostra_estera_minore_eliminata']) ? 1 : 0
            ];

            save_mercato_settings($updated);
            echo json_encode(['success' => true, 'msg' => 'Impostazioni e percentuali salvate correttamente!']);
            break;

        case 'admin_resolve':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $idSessione = (int)($_POST['id_sessione'] ?? 0);
            $tipo = $_POST['tipo'] ?? 'simulazione';
            $isFinal = ($tipo === 'finale');

            $res = mercato_resolve_session($idSessione, $isFinal);
            echo json_encode(['success' => true, 'data' => $res]);
            break;

        case 'admin_delete_session':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_POST['id_sessione'] ?? 0);
            if (!$id) throw new Exception("ID sessione mancante.");

            mercato_db_delete_session($id);
            echo json_encode(['success' => true, 'msg' => 'Sessione eliminata con successo!']);
            break;

        case 'admin_get_report':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_GET['id_sessione'] ?? $_POST['id_sessione'] ?? 0);
            if (!$id) throw new Exception("ID sessione mancante.");

            $session = mercato_db_get_session($id);
            if (!$session) throw new Exception("Sessione non trovata.");

            $reportTxt = mercato_get_session_report($id);
            echo json_encode([
                'success'       => true,
                'id_sessione'   => $id,
                'nome_sessione' => $session['nome'],
                'report_txt'    => $reportTxt
            ]);
            break;

        default:
            throw new Exception("Azione non supportata.");
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
