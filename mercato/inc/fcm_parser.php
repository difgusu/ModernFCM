<?php
/**
 * Parser per i dati FCM generati settimanalmente.
 * Legge direttamente i file JS senza richiedere database o importazioni manuali.
 */

function fcm_parse_all_data() {
    static $cache = null;
    if ($cache !== null) return $cache;

    $baseJs = dirname(dirname(__DIR__)) . '/js';
    $fileSerieA = $baseJs . '/fcmSerieADati.js';
    $fileDettaglio = $baseJs . '/fcmSerieADatiDettaglio.js';
    $fileFantasquadre = $baseJs . '/fcmFantasquadreDati.js';

    $nomiGiocatori = []; // xgID => Nome
    $nomiSquadreA = [];  // xaID => Nome Squadra Serie A

    // 1. Lettura Nomi e Squadre Serie A
    if (file_exists($fileSerieA)) {
        $content = file_get_contents($fileSerieA);
        if (preg_match_all('/xg(\d+)\s*=\s*(["\'])(.*?)\2/s', $content, $m)) {
            foreach ($m[1] as $idx => $id) {
                $nomiGiocatori[(int)$id] = trim($m[3][$idx]);
            }
        }
        if (preg_match_all('/xa(\d+)\s*=\s*(["\'])(.*?)\2/s', $content, $m)) {
            foreach ($m[1] as $idx => $id) {
                $nomiSquadreA[(int)$id] = trim($m[3][$idx]);
            }
        }
    }

    // 2. Lettura Calciatori Serie A (Ruolo, Costo, Codice)
    // GiocatoreA(ID, IDSquadra, Ruolo, Codice, Crediti, Extracom)
    $giocatoriSerieA = [];
    if (file_exists($fileDettaglio)) {
        $content = file_get_contents($fileDettaglio);
        if (preg_match_all('/new\s+GiocatoreA\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/', $content, $m, PREG_SET_ORDER)) {
            foreach ($m as $row) {
                $id = (int)$row[1];
                $idSq = (int)$row[2];
                $ruolo = (int)$row[3];
                $codice = (int)$row[4];
                $crediti = (int)$row[5];
                $nome = $nomiGiocatori[$id] ?? "Calciatore $id";
                $club = $nomiSquadreA[$idSq] ?? "Serie A";

                $giocatoriSerieA[$id] = [
                    'id'       => $id,
                    'nome'     => $nome,
                    'ruolo'    => $ruolo,
                    'club'     => $club,
                    'costo'    => $crediti,
                    'codice'   => $codice
                ];
            }
        }
    }

    // 3. Lettura Fantasquadre e Rose
    // F(ID, Nome, Presidente, Telef1, Telef2, Telef3, Email, IDDivisione, CreditiResidui)
    $fantasquadre = [];
    $rose = []; // idSquadra => [ array di calciatori ]
    $tesseratiPerDivisione = []; // idDivisione => [ idCalciatore => idSquadra ]

    if (file_exists($fileFantasquadre)) {
        $content = file_get_contents($fileFantasquadre);

        if (preg_match_all('/new\s+F\((\d+)\s*,\s*(["\'])(.*?)\2\s*,\s*(["\'])(.*?)\4.*?,\s*(\d+)\s*,\s*(\d+)\)/', $content, $m, PREG_SET_ORDER)) {
            foreach ($m as $row) {
                $idSq = (int)$row[1];
                $nomeSq = trim($row[3]);
                $pres = trim($row[5]);
                $div = (int)$row[6];
                $crediti = (int)$row[7];

                $fantasquadre[$idSq] = [
                    'id'          => $idSq,
                    'nome'        => $nomeSq,
                    'presidente'  => $pres,
                    'divisione'   => $div,
                    'crediti_fcm' => $crediti
                ];
                $rose[$idSq] = [];
            }
        }

        // R(IDSquadra, Ruolo, Nome, Squadra, Extracom, Stato, Contratto, Acq, Svinc, GioInf)
        // Nome è xgNNN, Squadra è xaNNN
        if (preg_match_all('/new\s+R\((\d+)\s*,\s*(\d+)\s*,\s*xg(\d+)\s*,\s*xa(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)/', $content, $m, PREG_SET_ORDER)) {
            foreach ($m as $row) {
                $idSq = (int)$row[1];
                $ruolo = (int)$row[2];
                $idG = (int)$row[3];
                $idClub = (int)$row[4];
                $stato = (int)$row[6];     // 0: in rosa, 1: svincolato, 2: infortunato
                $costoAcq = (int)$row[8];

                $nomeG = $nomiGiocatori[$idG] ?? "Calciatore $idG";
                $clubG = $nomiSquadreA[$idClub] ?? "Club $idClub";

                $giocatoreRosa = [
                    'id'          => $idG,
                    'nome'        => $nomeG,
                    'ruolo'       => $ruolo,
                    'club'        => $clubG,
                    'costo_acq'   => $costoAcq,
                    'tagliato'    => ($stato === 1) ? 1 : 0,
                    'stato'       => $stato
                ];

                $rose[$idSq][] = $giocatoreRosa;

                // Tesserati per divisione: sia i calciatori attivi in rosa ($stato === 0)
                // sia i tagli temporanei per inserimento in lista infortunati ($stato === 2)
                // appartengono alla fantasquadra e non devono comparire tra i disponibili per quella divisione.
                if (($stato === 0 || $stato === 2) && isset($fantasquadre[$idSq])) {
                    $div = $fantasquadre[$idSq]['divisione'];
                    $tesseratiPerDivisione[$div][$idG] = $idSq;
                }
            }
        }
    }

    $cache = [
        'giocatori'              => $giocatoriSerieA,
        'fantasquadre'           => $fantasquadre,
        'rose'                   => $rose,
        'tesserati_divisione'    => $tesseratiPerDivisione
    ];

    return $cache;
}

/**
 * Calcola i giocatori liberi (svincolati) per una determinata divisione.
 * Esclude i tesserati e i tagli temporanei per infortunio ($stato === 2).
 * Se l'impostazione mostra_estera_minore_eliminata è deselezionata, esclude anche {ESTERA}, {MINORE}, {ELIMINATA}.
 */
function fcm_get_liberi_per_divisione($idDivisione) {
    $data = fcm_parse_all_data();
    $tesserati = $data['tesserati_divisione'][$idDivisione] ?? [];
    $settings = function_exists('get_mercato_settings') ? get_mercato_settings() : [];
    $mostraNonSerieA = !isset($settings['mostra_estera_minore_eliminata']) || !empty($settings['mostra_estera_minore_eliminata']);
    $liberi = [];

    foreach ($data['giocatori'] as $id => $g) {
        if (!isset($tesserati[$id])) {
            if (!$mostraNonSerieA) {
                $clubUpper = strtoupper($g['club']);
                if (strpos($clubUpper, 'ESTERA') !== false ||
                    strpos($clubUpper, 'MINORE') !== false ||
                    strpos($clubUpper, 'ELIMINAT') !== false ||
                    strpos($clubUpper, 'SVINCOLAT') !== false) {
                    continue; // Non mostrare se l'opzione è disattivata
                }
            }
            $liberi[] = $g;
        }
    }

    usort($liberi, function($a, $b) {
        if ($a['ruolo'] !== $b['ruolo']) return $a['ruolo'] <=> $b['ruolo'];
        return strcmp($a['nome'], $b['nome']);
    });

    return $liberi;
}

/**
 * Restituisce la rosa attiva (in rosa sana, escludendo svincolati e tagliati temporanei per infortunio)
 */
function fcm_get_rosa_attiva($idSquadra) {
    $data = fcm_parse_all_data();
    $rosaCompleta = $data['rose'][$idSquadra] ?? [];
    return array_values(array_filter($rosaCompleta, function($g) {
        return empty($g['tagliato']) && (!isset($g['stato']) || (int)$g['stato'] === 0);
    }));
}
