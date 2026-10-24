<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/fcm_parser.php';

function mercato_resolve_session($idSessione, $isFinal = false) {
    $sessione = mercato_db_get_session($idSessione);
    if (!$sessione) throw new Exception("Sessione non trovata.");

    if (!empty($sessione['elaborata']) && $isFinal) {
        throw new Exception("Questa sessione è già stata elaborata in via definitiva.");
    }

    $fcmData = fcm_parse_all_data();
    $fantasquadre = $fcmData['fantasquadre'];

    // 1. Estrazione e decifratura di tutte le buste della sessione
    $rawBuste = mercato_db_get_bids($idSessione);

    $busteDecifrate = [];
    foreach ($rawBuste as $b) {
        $importo = mercato_decrypt($b['crediti_cifrati'], $b['vettore_iv']);
        $b['crediti_in_chiaro'] = $importo;
        $b['nome_squadra'] = $fantasquadre[$b['id_squadra']]['nome'] ?? "Squadra #{$b['id_squadra']}";
        $busteDecifrate[] = $b;
    }

    // 2. Raggruppamento per Divisione e Calciatore
    $gruppi = [];
    foreach ($busteDecifrate as $b) {
        $chiave = $b['id_divisione'] . '_' . $b['codice_giocatore'];
        $gruppi[$chiave][] = $b;
    }

    $esiti = [];
    $assegnazioni = [];
    $operazioniPerSquadra = []; // Per la Scheda Operazioni FCM

    foreach ($gruppi as $chiave => $busteGruppo) {
        // Ordina per crediti decrescenti, poi per timestamp
        usort($busteGruppo, function($a, $b) {
            if ($a['crediti_in_chiaro'] !== $b['crediti_in_chiaro']) {
                return $b['crediti_in_chiaro'] <=> $a['crediti_in_chiaro'];
            }
            return strcmp($a['timest'], $b['timest']);
        });

        $topOfferta = $busteGruppo[0];
        $topValore = $topOfferta['crediti_in_chiaro'];

        // Controlla quanti hanno offerto la stessa cifra massima
        $pariMerito = array_filter($busteGruppo, function($item) use ($topValore) {
            return $item['crediti_in_chiaro'] === $topValore;
        });

        $isConflitto = (count($pariMerito) > 1);

        foreach ($busteGruppo as $b) {
            if ($b['crediti_in_chiaro'] === $topValore) {
                $stato = $isConflitto ? 'CONFLITTO' : 'ASSEGNATO';
            } else {
                $stato = 'PERSA';
            }

            $record = [
                'id_offerta'        => $b['id'],
                'id_squadra'        => $b['id_squadra'],
                'nome_squadra'      => $b['nome_squadra'],
                'divisione'         => $b['id_divisione'],
                'codice_giocatore'  => $b['codice_giocatore'],
                'nome_giocatore'    => $b['nome_giocatore'],
                'ruolo'             => $b['ruolo'],
                'crediti'           => $b['crediti_in_chiaro'],
                'stato'             => $stato,
                'nome_tagliato'     => $b['nome_giocatore_taglio'],
                'crediti_recupero'  => $b['crediti_recuperati'],
                'timest'            => $b['timest']
            ];

            $esiti[] = $record;

            if ($stato === 'ASSEGNATO') {
                $assegnazioni[] = $record;
                $sqId = $b['id_squadra'];
                if (!isset($operazioniPerSquadra[$sqId])) {
                    $operazioniPerSquadra[$sqId] = [
                        'nome_squadra' => $b['nome_squadra'],
                        'divisione'    => $b['id_divisione'],
                        'acquisti'     => [],
                        'tagli'        => [],
                        'saldo_netto'  => 0
                    ];
                }
                $operazioniPerSquadra[$sqId]['acquisti'][] = [
                    'giocatore' => $b['nome_giocatore'],
                    'ruolo'     => $b['ruolo'],
                    'costo'     => $b['crediti_in_chiaro']
                ];
                if (!empty($b['nome_giocatore_taglio'])) {
                    $operazioniPerSquadra[$sqId]['tagli'][] = [
                        'giocatore' => $b['nome_giocatore_taglio'],
                        'recupero'  => $b['crediti_recuperati']
                    ];
                }
                $operazioniPerSquadra[$sqId]['saldo_netto'] += ((int)$b['crediti_recuperati'] - (int)$b['crediti_in_chiaro']);
            }
        }
    }

    // 4. Generazione Report Testuale Completo (Senza troncamenti)
    $formattedDate = date('d/m/Y H:i', strtotime($sessione['data_chiusura']));
    $reportTxt = "========================================================================================\n";
    $reportTxt .= "REPORT MERCATO: {$sessione['nome']}\n";
    $reportTxt .= "Data Chiusura: {$formattedDate} | Tipo: " . ($isFinal ? "FINALE (Crediti Applicati)" : "SIMULAZIONE") . "\n";
    $reportTxt .= "========================================================================================\n\n";

    $reportTxt .= "DETTAGLIO BUSTE E ASSEGNAZIONI:\n";
    $reportTxt .= sprintf("%-28s | %-22s | %-9s | %-12s | %s\n", "Giocatore", "Squadra", "Offerta", "Stato", "Eventuale Taglio");
    $reportTxt .= str_repeat("-", 95) . "\n";

    if (empty($esiti)) {
        $reportTxt .= "Nessuna offerta pervenuta per questa sessione.\n";
    } else {
        foreach ($esiti as $e) {
            $taglio = !empty($e['nome_tagliato']) ? "{$e['nome_tagliato']} (+{$e['crediti_recupero']} cr)" : "---";
            $reportTxt .= sprintf("%-28s | %-22s | %6d cr | %-12s | %s\n",
                $e['nome_giocatore'],
                $e['nome_squadra'],
                $e['crediti'],
                $e['stato'],
                $taglio
            );
        }
    }

    $reportTxt .= "\n========================================================================================\n";
    $reportTxt .= "RIEPILOGO OPERAZIONI DA APPLICARE IN FCM:\n";
    $reportTxt .= "========================================================================================\n";

    if (empty($operazioniPerSquadra)) {
        $reportTxt .= "Nessun calciatore assegnato in questa sessione.\n";
    } else {
        foreach ($operazioniPerSquadra as $sqId => $op) {
            $reportTxt .= "\n[" . $op['nome_squadra'] . "] (Divisione " . $op['divisione'] . ")\n";
            if (!empty($op['acquisti'])) {
                $reportTxt .= "  - ACQUISTI:\n";
                foreach ($op['acquisti'] as $acq) {
                    $reportTxt .= "    * {$acq['giocatore']} (Costo: {$acq['costo']} cr)\n";
                }
            } else {
                $reportTxt .= "  - Nessun acquisto\n";
            }
            if (!empty($op['tagli'])) {
                $reportTxt .= "  - TAGLI:\n";
                foreach ($op['tagli'] as $tag) {
                    $reportTxt .= "    * {$tag['giocatore']} (Recupero: +{$tag['recupero']} cr)\n";
                }
            } else {
                $reportTxt .= "  - Nessun taglio\n";
            }
            $saldoSign = $op['saldo_netto'] >= 0 ? "+{$op['saldo_netto']}" : $op['saldo_netto'];
            $reportTxt .= "  -> SALDO CREDITI NETTO IN FCM: {$saldoSign} crediti\n";
        }
    }
    $reportTxt .= "\n========================================================================================\n";

    // 3. Esecuzione Finale se richiesta (con salvataggio del report)
    if ($isFinal) {
        // Rimuove preliminarmente eventuali crediti extra precedentemente registrati per questa sessione per garantire idempotenza
        mercato_db_delete_extra_saldo_by_session($idSessione);

        foreach ($assegnazioni as $a) {
            $diff = (int)$a['crediti_recupero'] - (int)$a['crediti'];
            $desc = "Acquisto {$a['nome_giocatore']} (-{$a['crediti']} cr)";
            if (!empty($a['nome_tagliato'])) {
                $desc .= ", Taglio {$a['nome_tagliato']} (+{$a['crediti_recupero']} cr)";
            }
            mercato_db_add_extra_saldo($a['id_squadra'], $diff, $idSessione, $desc);
        }

        mercato_db_save_session([
            'id'         => $idSessione,
            'attiva'     => 0,
            'elaborata'  => 1,
            'report_txt' => $reportTxt
        ]);

        $dir = MERCATO_REPORTS_DIR;
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $cleanDate = date('Y-m-d_H-i', strtotime($sessione['data_chiusura']));
        file_put_contents("$dir/Report-Assegnazioni-Sess-{$idSessione}-{$cleanDate}.txt", $reportTxt);
    }

    return [
        'esiti'                  => $esiti,
        'assegnazioni'           => $assegnazioni,
        'operazioni_per_squadra' => $operazioniPerSquadra,
        'report_txt'             => $reportTxt,
        'is_finale'              => $isFinal
    ];
}

/**
 * Recupera il report testuale di una sessione (salvato su record, file o simulato al volo)
 */
function mercato_get_session_report($idSessione) {
    $session = mercato_db_get_session($idSessione);
    if (!$session) return null;

    if (!empty($session['report_txt'])) {
        return $session['report_txt'];
    }

    $dir = MERCATO_REPORTS_DIR;
    if (is_dir($dir)) {
        $files = glob("$dir/Report-Assegnazioni-Sess-{$idSessione}-*.txt");
        if ($files && file_exists($files[0])) {
            return file_get_contents($files[0]);
        }
    }

    // Se non ancora salvato su file o se simulazione, genera al volo
    try {
        $res = mercato_resolve_session($idSessione, false);
        return $res['report_txt'] ?? '';
    } catch (Exception $e) {
        return "Impossibile recuperare il report: " . $e->getMessage();
    }
}
