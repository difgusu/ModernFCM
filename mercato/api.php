<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/db.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/fcm_parser.php';
require_once __DIR__ . '/inc/crypto.php';
require_once __DIR__ . '/inc/rules.php';
require_once __DIR__ . '/inc/resolver.php';

if (!fcm_module_enabled('ModMercatoLibero')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Modulo Mercato Libero disabilitato']);
    exit;
}

$action = $_REQUEST['action'] ?? '';

try {
    switch ($action) {
        case 'login_team':
            fcm_require_post();
            // Un id non numerico (o un array) vale come squadra inesistente
            $idSquadra = $_POST['id_squadra'] ?? '';
            $idSquadra = (is_string($idSquadra) && preg_match('/^[0-9]{1,9}\z/', $idSquadra)) ? (int)$idSquadra : 0;
            $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
            $res = mercato_login_team($idSquadra, $password);
            if (!empty($res['success'])) {
                $res['csrf_token'] = fcm_csrf_token();
            } elseif (!empty($res['retry_after'])) {
                // Limite ai tentativi: stato 429, corpo JSON nel formato degli altri errori
                http_response_code(429);
                header('Retry-After: ' . (int)$res['retry_after']);
                unset($res['retry_after']);
            }
            echo json_encode($res);
            break;

        case 'login_admin':
            fcm_require_post();
            $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
            $res = mercato_login_admin($password);
            if (!empty($res['success'])) {
                $res['csrf_token'] = fcm_csrf_token();
            } elseif (!empty($res['retry_after'])) {
                // Limite ai tentativi: stato 429, corpo JSON nel formato degli altri errori
                http_response_code(429);
                header('Retry-After: ' . (int)$res['retry_after']);
                unset($res['retry_after']);
            }
            echo json_encode($res);
            break;

        case 'logout':
            fcm_require_post();
            fcm_require_csrf();
            mercato_logout();
            echo json_encode(['success' => true]);
            break;

        case 'get_state':
            $sessione = mercato_get_current_session();
            $teamId = mercato_get_logged_team_id();
            $isAdmin = mercato_is_admin();
            $settings = get_mercato_settings();

            $financials = null;
            $liberi = [];
            $chiamateAltri = [];
            if ($teamId && $sessione) {
                $financials = mercato_get_team_financials($teamId, $sessione['id']);
                $div = $_SESSION['mercato_divisione'] ?? 0;
                $liberi = fcm_get_liberi_per_divisione($div);
                if (!empty($settings['mostra_chiamate_altri'])) {
                    $chiamateAltri = mercato_get_session_public_bids($sessione['id'], $teamId, $div);
                }
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
                'csrf_token'     => fcm_csrf_token(),
                'is_team_logged' => !empty($teamId),
                'team_id'        => $teamId,
                'team_name'      => $_SESSION['mercato_team_name'] ?? null,
                'is_admin'       => $isAdmin,
                'sessione'       => $sessione,
                'financials'     => $financials,
                'liberi'         => $liberi,
                'chiamate_altri' => $chiamateAltri,
                'squadre'        => $squadreElenco,
                'settings'       => $settings
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
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_team_logged()) throw new Exception("Accesso non effettuato.");
            $sessione = mercato_get_current_session();
            if (!$sessione || empty($sessione['is_open'])) throw new Exception("Il mercato è attualmente chiuso.");

            $teamId = (int)$_SESSION['mercato_team_id'];
            $codiceG = (int)($_POST['codice_giocatore'] ?? 0);
            $offerta = (int)($_POST['offerta'] ?? 0);
            $idTaglio = !empty($_POST['id_taglio']) ? (int)$_POST['id_taglio'] : null;

            if ($codiceG <= 0) throw new Exception("Calciatore non valido.");
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

            $ruoliDesc = [1 => 'Portiere', 2 => 'Difensore', 3 => 'Centrocampista', 4 => 'Attaccante'];
            $idSessione = (int)$sessione['id'];

            // Validazione e salvataggio atomico sotto LOCK_EX (previene race condition, budget doppio e tagli duplicati)
            $savedOk = mercato_json_update('offerte.json', function($bids) use (
                $idSessione, $teamId, $div, $codiceG, $offerta, $idTaglio, $giocatore, $settings, $ruoliDesc
            ) {
                if (!is_array($bids)) $bids = [];

                // Calcolo crediti e riserva escludendo l'eventuale busta precedente sullo stesso calciatore
                $fin = mercato_get_team_financials($teamId, $idSessione, $codiceG, $bids);

                $nomeTagliato = null;
                $creditiRecupero = 0;

                if ($idTaglio) {
                    $taglioInfo = null;
                    foreach ($fin['rosa_attiva'] as $r) {
                        if ((int)$r['id'] === $idTaglio) {
                            $taglioInfo = $r;
                            break;
                        }
                    }
                    if (!$taglioInfo) {
                        throw new Exception("Calciatore da tagliare non trovato nella tua rosa attiva.");
                    }
                    if ((int)$taglioInfo['ruolo'] !== (int)$giocatore['ruolo']) {
                        $ruoloAtteso = $ruoliDesc[(int)$giocatore['ruolo']] ?? 'stesso ruolo';
                        throw new Exception("Puoi tagliare solo un calciatore dello stesso ruolo ({$ruoloAtteso}).");
                    }
                    foreach ($bids as $existingBid) {
                        if ((int)($existingBid['id_sessione'] ?? 0) === $idSessione
                            && (int)($existingBid['id_squadra'] ?? 0) === $teamId
                            && (int)($existingBid['codice_giocatore'] ?? 0) !== $codiceG
                            && !empty($existingBid['id_giocatore_taglio'])
                            && (int)$existingBid['id_giocatore_taglio'] === $idTaglio) {
                            throw new Exception("Hai già utilizzato {$taglioInfo['nome']} come taglio in un'altra busta attiva.");
                        }
                    }
                    $nomeTagliato = $taglioInfo['nome'];
                    $calc = mercato_calcola_recupero_taglio($taglioInfo['club'], $taglioInfo['costo_acq'], $settings);
                    $creditiRecupero = $calc['recupero'];
                } else {
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

                $cript = mercato_encrypt($offerta);

                // Sostituisce eventuale offerta precedente sullo stesso giocatore in questa sessione
                $bids = array_values(array_filter($bids, function($b) use ($idSessione, $teamId, $codiceG) {
                    return !((int)($b['id_sessione'] ?? 0) === $idSessione
                        && (int)($b['id_squadra'] ?? 0) === $teamId
                        && (int)($b['codice_giocatore'] ?? 0) === $codiceG);
                }));

                $maxId = 0;
                foreach ($bids as $b) {
                    if (($b['id'] ?? 0) > $maxId) $maxId = (int)$b['id'];
                }

                $bids[] = [
                    'id'                    => $maxId + 1,
                    'id_sessione'           => $idSessione,
                    'id_squadra'            => $teamId,
                    'id_divisione'          => $div,
                    'codice_giocatore'      => $codiceG,
                    'nome_giocatore'        => $giocatore['nome'],
                    'ruolo'                 => $giocatore['ruolo'],
                    'squadra_serie_a'       => $giocatore['club'],
                    'crediti_cifrati'       => $cript['cifrato'],
                    'vettore_iv'            => $cript['iv'],
                    'id_giocatore_taglio'   => $idTaglio,
                    'nome_giocatore_taglio' => $nomeTagliato,
                    'crediti_recuperati'    => $creditiRecupero,
                    'timest'                => date('Y-m-d H:i:s')
                ];

                return ['data' => $bids, 'result' => true];
            }, []);

            if (!$savedOk) {
                throw new Exception("Impossibile salvare la busta su disco.");
            }

            echo json_encode(['success' => true, 'msg' => "Busta segreta per {$giocatore['nome']} inviata con successo!"]);
            break;

        case 'delete_bid':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_team_logged()) throw new Exception("Accesso non effettuato.");
            $sessione = mercato_get_current_session();
            if (!$sessione || empty($sessione['is_open'])) throw new Exception("Il mercato è chiuso.");

            $idOfferta = (int)($_POST['id_offerta'] ?? 0);
            $teamId = (int)$_SESSION['mercato_team_id'];

            mercato_db_delete_bid($idOfferta, $teamId, $sessione['id']);
            echo json_encode(['success' => true, 'msg' => "Offerta annullata correttamente."]);
            break;

        case 'admin_save_session':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = !empty($_POST['id']) ? (int)$_POST['id'] : null;
            $nome = is_string($_POST['nome'] ?? null) ? trim($_POST['nome']) : '';
            $apertura = is_string($_POST['data_apertura'] ?? null) ? trim($_POST['data_apertura']) : '';
            $chiusura = is_string($_POST['data_chiusura'] ?? null) ? trim($_POST['data_chiusura']) : '';

            if (empty($nome) || empty($apertura) || empty($chiusura)) {
                throw new Exception("Tutti i campi della sessione sono obbligatori.");
            }

            // Nome e date finiscono nel registro mostrato alle squadre: testo UTF-8 valido e corto,
            // date solo assolute (come quelle del modulo), così il registro resta sempre leggibile
            $nome = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $nome);
            if ($nome === null || preg_match_all('/./su', $nome) > 100) {
                throw new Exception("Il nome della sessione deve essere un testo di al massimo 100 caratteri.");
            }
            foreach ([$apertura, $chiusura] as $dataInviata) {
                if (!preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?\z/', $dataInviata) || strtotime($dataInviata) === false) {
                    throw new Exception("Date della sessione non valide: indica giorno e ora di apertura e di chiusura.");
                }
            }

            // Creazione e modifiche (date comprese) vengono prima annotate nel registro visibile alle squadre
            $esistente = $id ? mercato_db_get_session($id) : null;
            if (!$esistente) {
                mercato_registro_annota('sessione', "Nuova sessione «{$nome}» creata: apertura " . mercato_registro_data($apertura) . ", chiusura " . mercato_registro_data($chiusura) . ".", $id);
            } else {
                $modifiche = [];
                if ((string)($esistente['nome'] ?? '') !== $nome) {
                    $modifiche[] = "nuovo nome «{$nome}»";
                }
                if ((string)($esistente['data_apertura'] ?? '') !== $apertura) {
                    $modifiche[] = "apertura " . mercato_registro_data($esistente['data_apertura'] ?? '') . " → " . mercato_registro_data($apertura);
                }
                if ((string)($esistente['data_chiusura'] ?? '') !== $chiusura) {
                    $modifiche[] = "chiusura " . mercato_registro_data($esistente['data_chiusura'] ?? '') . " → " . mercato_registro_data($chiusura);
                }
                if ($modifiche) {
                    mercato_registro_annota('date', "Sessione " . mercato_registro_sessione($esistente) . " modificata: " . implode('; ', $modifiche) . ".", $id);
                }
            }

            $salvata = mercato_db_save_session([
                'id'            => $id,
                'nome'          => $nome,
                'data_apertura' => $apertura,
                'data_chiusura' => $chiusura
            ]);
            if (!$salvata) {
                // La voce appena annotata descrive una modifica che non è avvenuta: lo si dice nel registro
                try {
                    mercato_registro_annota($esistente ? 'date' : 'sessione', "Salvataggio non riuscito: la modifica annotata sopra non è stata applicata.", $id);
                } catch (Exception $eRegistro) {
                    // l'errore principale è il salvataggio, segnalato qui sotto
                }
                throw new Exception("Impossibile salvare la sessione.");
            }

            echo json_encode(['success' => true]);
            break;

        case 'admin_toggle_session':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_POST['id'] ?? 0);
            $attiva = (int)($_POST['attiva'] ?? 0);

            $esistente = mercato_db_get_session($id);
            if ($esistente && !empty($esistente['attiva']) !== !empty($attiva)) {
                mercato_registro_annota('stato', "Sessione " . mercato_registro_sessione($esistente) . ($attiva ? " riaperta" : " chiusa") . " manualmente.", $id);
            }

            mercato_db_toggle_session($id, $attiva);
            echo json_encode(['success' => true]);
            break;

        case 'admin_save_settings':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $current = get_mercato_settings();

            $updated = [
                'max_giocatori'                  => isset($_POST['max_giocatori']) ? (int)$_POST['max_giocatori'] : $current['max_giocatori'],
                'num_p'                          => isset($_POST['num_p']) ? (int)$_POST['num_p'] : $current['num_p'],
                'num_d'                          => isset($_POST['num_d']) ? (int)$_POST['num_d'] : $current['num_d'],
                'num_c'                          => isset($_POST['num_c']) ? (int)$_POST['num_c'] : $current['num_c'],
                'num_a'                          => isset($_POST['num_a']) ? (int)$_POST['num_a'] : $current['num_a'],
                'obbligo_taglio'                 => isset($_POST['obbligo_taglio']) ? (int)$_POST['obbligo_taglio'] : $current['obbligo_taglio'],
                'perc_recupero_estera'           => isset($_POST['perc_recupero_estera']) ? max(0, min(100, (int)$_POST['perc_recupero_estera'])) : 100,
                'perc_recupero_minore'           => isset($_POST['perc_recupero_minore']) ? max(0, min(100, (int)$_POST['perc_recupero_minore'])) : 50,
                'perc_recupero_eliminata'        => isset($_POST['perc_recupero_eliminata']) ? max(0, min(100, (int)$_POST['perc_recupero_eliminata'])) : 0,
                'perc_recupero_serie_a'          => isset($_POST['perc_recupero_serie_a']) ? max(0, min(100, (int)$_POST['perc_recupero_serie_a'])) : 0,
                'arrotonda_eccesso'              => !empty($_POST['arrotonda_eccesso']) ? 1 : 0,
                'mostra_estera_minore_eliminata' => !empty($_POST['mostra_estera_minore_eliminata']) ? 1 : 0,
                'mostra_chiamate_altri'          => !empty($_POST['mostra_chiamate_altri']) ? 1 : 0,
                'abilita_simulazione'            => !empty($_POST['abilita_simulazione']) ? 1 : 0
            ];

            if (!save_mercato_settings($updated)) {
                throw new Exception("Impossibile salvare le impostazioni su disco.");
            }
            echo json_encode(['success' => true, 'msg' => 'Impostazioni e percentuali salvate correttamente!']);
            break;

        case 'admin_resolve':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $idSessione = (int)($_POST['id_sessione'] ?? 0);
            $tipo = $_POST['tipo_risoluzione'] ?? $_POST['tipo'] ?? 'simulazione';
            $isFinal = ($tipo === 'finale');

            $settings = get_mercato_settings();
            if (!$isFinal && empty($settings['abilita_simulazione'])) {
                throw new Exception("La simulazione dell'asta è disabilitata nelle impostazioni di lega per garantire la segretezza delle offerte.");
            }

            $res = mercato_resolve_session($idSessione, $isFinal);
            echo json_encode(['success' => true, 'data' => $res]);
            break;

        case 'admin_delete_session':
            fcm_require_post();
            fcm_require_csrf();
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_POST['id_sessione'] ?? 0);
            if (!$id) throw new Exception("ID sessione mancante.");

            $esistente = mercato_db_get_session($id);
            if ($esistente) {
                mercato_registro_annota('eliminazione', "Sessione " . mercato_registro_sessione($esistente) . " eliminata con le sue buste, i crediti assegnati e i report.", $id);
            }

            mercato_db_delete_session($id);
            echo json_encode(['success' => true, 'msg' => 'Sessione eliminata con successo!']);
            break;

        case 'admin_get_report':
            if (!mercato_is_admin()) throw new Exception("Accesso non autorizzato.");
            $id = (int)($_GET['id_sessione'] ?? $_POST['id_sessione'] ?? 0);
            if (!$id) throw new Exception("ID sessione mancante.");

            $session = mercato_db_get_session($id);
            if (!$session) throw new Exception("Sessione non trovata.");

            // Prima dell'assegnazione finale il report equivale a una simulazione (decifra le buste e
            // lascia una voce nel registro): deve essere una richiesta voluta, non un semplice link.
            if (empty($session['elaborata'])) {
                fcm_require_post();
                fcm_require_csrf();
            }

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
