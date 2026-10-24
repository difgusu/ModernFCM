<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/fcm_parser.php';
require_once __DIR__ . '/crypto.php';

function mercato_get_current_session() {
    $session = mercato_db_get_active_session();
    if (!$session) return null;

    $now = time();
    $start = strtotime($session['data_apertura']);
    $end = strtotime($session['data_chiusura']);

    $session['is_open'] = ($now >= $start && $now <= $end);
    $session['is_future'] = ($now < $start);
    $session['is_expired'] = ($now > $end);
    $session['seconds_to_close'] = max(0, $end - $now);
    $session['seconds_to_open'] = max(0, $start - $now);

    return $session;
}

/**
 * Calcola la categoria e il rimborso crediti per un calciatore tagliato
 * in base alle percentuali configurate ({ESTERA}, {MINORE}, {ELIMINATA}, SERIE A)
 * e all'eventuale arrotondamento in eccesso.
 */
function mercato_calcola_recupero_taglio($clubCalciatore, $costoAcq, $settings = null) {
    if ($settings === null) {
        $settings = get_mercato_settings();
    }
    $costoAcq = max(0, (int)$costoAcq);
    $club = strtoupper(trim((string)$clubCalciatore));

    $categoria = 'SERIE_A';
    $labelCategoria = 'Giocatore di Serie A';
    $perc = (int)($settings['perc_recupero_serie_a'] ?? 0);

    if (strpos($club, 'ESTERA') !== false) {
        $categoria = 'ESTERA';
        $labelCategoria = '{ESTERA}';
        $perc = (int)($settings['perc_recupero_estera'] ?? 100);
    } elseif (strpos($club, 'MINORE') !== false) {
        $categoria = 'MINORE';
        $labelCategoria = '{MINORE}';
        $perc = (int)($settings['perc_recupero_minore'] ?? 50);
    } elseif (strpos($club, 'ELIMINAT') !== false || strpos($club, 'SVINCOLAT') !== false) {
        $categoria = 'ELIMINATA';
        $labelCategoria = '{ELIMINATA}';
        $perc = (int)($settings['perc_recupero_eliminata'] ?? 0);
    }

    $perc = max(0, min(100, $perc));
    $arrotondaEccesso = !empty($settings['arrotonda_eccesso']);

    if ($costoAcq <= 0 || $perc === 0) {
        $recupero = 0;
    } elseif ($perc === 100) {
        $recupero = $costoAcq;
    } else {
        $valoreEsatto = $costoAcq * ($perc / 100.0);
        if ($arrotondaEccesso) {
            $recupero = (int)ceil($valoreEsatto);
        } else {
            $recupero = (int)floor($valoreEsatto);
        }
        $recupero = min($costoAcq, max(0, $recupero));
    }

    return [
        'categoria'       => $categoria,
        'label'           => $labelCategoria,
        'percentuale'     => $perc,
        'costo_acq'       => $costoAcq,
        'recupero'        => $recupero,
        'arrotondato'     => $arrotondaEccesso
    ];
}

function mercato_get_team_financials($idSquadra, $idSessione = null) {
    $data = fcm_parse_all_data();
    $sq = $data['fantasquadre'][$idSquadra] ?? null;
    $creditiBase = $sq ? (int)$sq['crediti_fcm'] : 0;

    $extra = mercato_db_get_extra_saldo($idSquadra);
    $budgetTotale = $creditiBase + $extra;

    // Calcolo crediti impegnati nelle offerte attive
    $creditiImpegnati = 0;
    $buste = [];
    if ($idSessione) {
        $rows = mercato_db_get_bids($idSessione, $idSquadra);
        foreach ($rows as $r) {
            $offertaChiaro = mercato_decrypt($r['crediti_cifrati'], $r['vettore_iv']);
            $creditiImpegnati += $offertaChiaro;
            $r['crediti_in_chiaro'] = $offertaChiaro;
            $r['club'] = $r['squadra_serie_a'] ?? ($data['giocatori'][(int)$r['codice_giocatore']]['club'] ?? '');
            if (!empty($r['id_giocatore_taglio'])) {
                $r['club_taglio'] = $data['giocatori'][(int)$r['id_giocatore_taglio']]['club'] ?? '';
            }
            $buste[] = $r;
        }
    }

    $budgetDisponibile = max(0, $budgetTotale - $creditiImpegnati);

    // Dati rosa e slot mancanti
    $settings = get_mercato_settings();
    $rosaAttiva = fcm_get_rosa_attiva($idSquadra);
    
    $conteggiRuolo = [1 => 0, 2 => 0, 3 => 0, 4 => 0];
    foreach ($rosaAttiva as $g) {
        $r = (int)$g['ruolo'];
        if (isset($conteggiRuolo[$r])) $conteggiRuolo[$r]++;
    }

    $totaleRichiesto = (int)$settings['num_p'] + (int)$settings['num_d'] + (int)$settings['num_c'] + (int)$settings['num_a'];
    $mancantiTotale = max(0, $totaleRichiesto - count($rosaAttiva));

    return [
        'budget_totale'       => $budgetTotale,
        'crediti_base'        => $creditiBase,
        'crediti_extra'       => $extra,
        'crediti_impegnati'   => $creditiImpegnati,
        'budget_disponibile'  => $budgetDisponibile,
        'rosa_attiva'         => $rosaAttiva,
        'conteggi_ruolo'      => $conteggiRuolo,
        'limiti_ruolo'        => [
            1 => (int)$settings['num_p'],
            2 => (int)$settings['num_d'],
            3 => (int)$settings['num_c'],
            4 => (int)$settings['num_a']
        ],
        'mancanti_totale'     => $mancantiTotale,
        'buste_attive'        => $buste,
        'settings'            => $settings
    ];
}
