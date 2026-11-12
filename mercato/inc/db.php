<?php
require_once __DIR__ . '/config.php';

/**
 * Storage Engine JSON Flat-File NoSQL per il Mercato Libero.
 * Elimina la necessità di driver SQLite/MySQL e funziona su qualsiasi ambiente PHP.
 * Utilizza file lock (LOCK_EX) per garantire consistenza e prevenire race condition.
 */

function mercato_json_read($filename, $default = []) {
    $filePath = MERCATO_DATA_DIR . '/' . $filename;
    if (!file_exists($filePath)) {
        return $default;
    }
    $fp = fopen($filePath, 'r');
    if (!$fp) return $default;
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if (empty($content)) return $default;
    $data = json_decode($content, true);
    return is_array($data) ? $data : $default;
}

function mercato_json_update($filename, callable $mutator, $default = []) {
    if (!mercato_ensure_data_dir()) {
        return false;
    }
    $filePath = MERCATO_DATA_DIR . '/' . $filename;
    $fp = @fopen($filePath, 'c+');
    if (!$fp) return false;

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }

    $result = true;
    $shouldWrite = true;
    try {
        rewind($fp);
        $content = stream_get_contents($fp);
        $data = $default;
        if ($content !== false && trim($content) !== '') {
            $decoded = json_decode($content, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        $mutated = $mutator($data);
        if (is_array($mutated) && array_key_exists('data', $mutated)) {
            $data = $mutated['data'];
            $result = $mutated['result'] ?? true;
            if (isset($mutated['write']) && $mutated['write'] === false) {
                $shouldWrite = false;
            }
        } else {
            $data = $mutated;
        }

        if ($shouldWrite) {
            $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($encoded === false) {
                return false;
            }
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, $encoded);
            fflush($fp);
        }
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    return $result;
}

function mercato_json_write($filename, $data) {
    return (bool)mercato_json_update($filename, function() use ($data) {
        return ['data' => $data, 'result' => true];
    }, []);
}

// ==========================================
// SESSIONI
// ==========================================
function mercato_db_get_sessions() {
    $sessions = mercato_json_read('sessioni.json', []);
    usort($sessions, function($a, $b) {
        return ($b['id'] ?? 0) <=> ($a['id'] ?? 0);
    });
    return $sessions;
}

function mercato_db_get_session($id) {
    $sessions = mercato_db_get_sessions();
    foreach ($sessions as $s) {
        if ((int)$s['id'] === (int)$id) return $s;
    }
    return null;
}

function mercato_db_get_active_session() {
    $sessions = mercato_db_get_sessions();
    foreach ($sessions as $s) {
        // Una sessione già assegnata in via definitiva non torna "in corso" nemmeno se riattivata:
        // le sue buste restano quelle dell'assegnazione e il suo report non finisce tra i dati pubblici.
        if (!empty($s['attiva']) && empty($s['elaborata'])) return $s;
    }
    return null;
}

/**
 * Restituisce la prima sessione non ancora assegnata in via definitiva che contiene almeno una
 * busta, oppure null. Date e stato aperta/chiusa non contano: finché le buste non sono state
 * assegnate i loro importi restano un segreto da proteggere.
 */
function mercato_db_find_pending_session($bids = null) {
    if (!is_array($bids)) {
        $bids = mercato_json_read('offerte.json', []);
    }
    $conBuste = [];
    foreach ($bids as $b) {
        if (is_array($b) && isset($b['id_sessione'])) {
            $conBuste[(int)$b['id_sessione']] = true;
        }
    }
    foreach (mercato_db_get_sessions() as $s) {
        if (empty($s['elaborata']) && isset($conBuste[(int)($s['id'] ?? 0)])) {
            return $s;
        }
    }
    return null;
}

function mercato_db_save_session($data) {
    return (bool)mercato_json_update('sessioni.json', function($sessions) use ($data) {
        if (!is_array($sessions)) $sessions = [];
        $id = !empty($data['id']) ? (int)$data['id'] : null;

        if ($id) {
            $found = false;
            foreach ($sessions as &$s) {
                if ((int)$s['id'] === $id) {
                    $s['nome'] = $data['nome'] ?? $s['nome'];
                    $s['data_apertura'] = $data['data_apertura'] ?? $s['data_apertura'];
                    $s['data_chiusura'] = $data['data_chiusura'] ?? $s['data_chiusura'];
                    if (isset($data['attiva'])) $s['attiva'] = (int)$data['attiva'];
                    if (isset($data['elaborata'])) $s['elaborata'] = (int)$data['elaborata'];
                    if (isset($data['report_txt'])) $s['report_txt'] = (string)$data['report_txt'];
                    $found = true;
                    break;
                }
            }
            unset($s);
            if (!$found) {
                $newItem = [
                    'id'            => $id,
                    'nome'          => $data['nome'] ?? "Sessione #$id",
                    'data_apertura' => $data['data_apertura'] ?? date('Y-m-d H:i:s'),
                    'data_chiusura' => $data['data_chiusura'] ?? date('Y-m-d H:i:s', time() + 86400),
                    'attiva'        => isset($data['attiva']) ? (int)$data['attiva'] : 1,
                    'elaborata'     => isset($data['elaborata']) ? (int)$data['elaborata'] : 0,
                    'creato_il'     => date('Y-m-d H:i:s')
                ];
                if (isset($data['report_txt'])) $newItem['report_txt'] = (string)$data['report_txt'];
                $sessions[] = $newItem;
            }
        } else {
            $maxId = 0;
            foreach ($sessions as $s) {
                if (($s['id'] ?? 0) > $maxId) $maxId = $s['id'];
            }
            $newSession = [
                'id'            => $maxId + 1,
                'nome'          => $data['nome'],
                'data_apertura' => $data['data_apertura'],
                'data_chiusura' => $data['data_chiusura'],
                'attiva'        => 1,
                'elaborata'     => 0,
                'creato_il'     => date('Y-m-d H:i:s')
            ];
            $sessions[] = $newSession;
        }

        return ['data' => $sessions, 'result' => true];
    }, []);
}

function mercato_db_toggle_session($id, $attiva) {
    return (bool)mercato_json_update('sessioni.json', function($sessions) use ($id, $attiva) {
        if (!is_array($sessions)) $sessions = [];
        foreach ($sessions as &$s) {
            if ((int)$s['id'] === (int)$id) {
                $s['attiva'] = (int)$attiva;
                break;
            }
        }
        unset($s);
        return ['data' => $sessions, 'result' => true];
    }, []);
}

function mercato_db_delete_session($id) {
    mercato_json_update('sessioni.json', function($sessions) use ($id) {
        if (!is_array($sessions)) $sessions = [];
        $filtered = array_values(array_filter($sessions, function($s) use ($id) {
            return (int)$s['id'] !== (int)$id;
        }));
        return ['data' => $filtered, 'result' => true];
    }, []);

    // Rimuove tutte le offerte relative a questa sessione
    mercato_json_update('offerte.json', function($bids) use ($id) {
        if (!is_array($bids)) $bids = [];
        $filtered = array_values(array_filter($bids, function($b) use ($id) {
            return (int)$b['id_sessione'] !== (int)$id;
        }));
        return ['data' => $filtered, 'result' => true];
    }, []);

    // Rimuove eventuali crediti extra assegnati da questa sessione
    mercato_db_delete_extra_saldo_by_session($id);

    // Rimuove eventuali file report associati a questa sessione
    $dir = MERCATO_REPORTS_DIR;
    if (is_dir($dir)) {
        $files = glob("$dir/Report-Assegnazioni-Sess-{$id}-*.txt");
        if ($files) {
            foreach ($files as $f) {
                @unlink($f);
            }
        }
    }
    return true;
}

// ==========================================
// OFFERTE / BUSTE
// ==========================================
function mercato_db_get_bids($idSessione, $idSquadra = null) {
    $bids = mercato_json_read('offerte.json', []);
    $filtered = [];
    foreach ($bids as $b) {
        if ((int)$b['id_sessione'] === (int)$idSessione) {
            if ($idSquadra === null || (int)$b['id_squadra'] === (int)$idSquadra) {
                $filtered[] = $b;
            }
        }
    }
    return $filtered;
}

function mercato_db_count_bids($idSessione) {
    return count(mercato_db_get_bids($idSessione));
}

function mercato_db_save_bid($bidData) {
    return (bool)mercato_json_update('offerte.json', function($bids) use ($bidData) {
        if (!is_array($bids)) $bids = [];
        $idSessione = (int)$bidData['id_sessione'];
        $idSquadra = (int)$bidData['id_squadra'];
        $codiceG = (int)$bidData['codice_giocatore'];

        // Rimuove eventuale offerta precedente per lo stesso giocatore in questa sessione
        $bids = array_values(array_filter($bids, function($b) use ($idSessione, $idSquadra, $codiceG) {
            return !((int)$b['id_sessione'] === $idSessione && (int)$b['id_squadra'] === $idSquadra && (int)$b['codice_giocatore'] === $codiceG);
        }));

        $maxId = 0;
        foreach ($bids as $b) {
            if (($b['id'] ?? 0) > $maxId) $maxId = $b['id'];
        }

        $bidData['id'] = $maxId + 1;
        $bidData['timest'] = date('Y-m-d H:i:s');
        $bids[] = $bidData;

        return ['data' => $bids, 'result' => true];
    }, []);
}

function mercato_db_delete_bid($idOfferta, $idSquadra, $idSessione) {
    return (bool)mercato_json_update('offerte.json', function($bids) use ($idOfferta, $idSquadra, $idSessione) {
        if (!is_array($bids)) $bids = [];
        $filtered = array_values(array_filter($bids, function($b) use ($idOfferta, $idSquadra, $idSessione) {
            return !((int)$b['id'] === (int)$idOfferta && (int)$b['id_squadra'] === (int)$idSquadra && (int)$b['id_sessione'] === (int)$idSessione);
        }));
        return ['data' => $filtered, 'result' => true];
    }, []);
}

// ==========================================
// SALDI EXTRA & IMPOSTAZIONI
// ==========================================

/**
 * Restituisce il saldo crediti extra accumulato per una squadra.
 * Calcola la somma di tutti i movimenti registrati legati alle varie sessioni.
 * Mantiene retrocompatibilità nel caso di file legacy (mappa id_squadra => crediti).
 */
function mercato_db_get_extra_saldo($idSquadra) {
    $entries = mercato_json_read('crediti_extra.json', []);
    if (!is_array($entries)) return 0;

    $total = 0;
    // Supporto formato legacy (se presente chiave numerica diretta idSquadra => int)
    if (isset($entries[(int)$idSquadra]) && is_numeric($entries[(int)$idSquadra])) {
        $total += (int)$entries[(int)$idSquadra];
    }

    // Formato strutturato (lista di movimenti legati a id_sessione)
    foreach ($entries as $e) {
        if (is_array($e) && isset($e['id_squadra']) && (int)$e['id_squadra'] === (int)$idSquadra) {
            $total += (int)($e['diff'] ?? 0);
        }
    }
    return $total;
}

/**
 * Registra un movimento di crediti extra legato a una sessione (o manuale).
 */
function mercato_db_add_extra_saldo($idSquadra, $diff, $idSessione = null, $desc = '') {
    $diff = (int)$diff;
    if ($diff === 0) return true;

    return (bool)mercato_json_update('crediti_extra.json', function($entries) use ($idSquadra, $diff, $idSessione, $desc) {
        if (!is_array($entries)) $entries = [];

        $maxId = 0;
        foreach ($entries as $e) {
            if (is_array($e) && isset($e['id']) && (int)$e['id'] > $maxId) {
                $maxId = (int)$e['id'];
            }
        }

        $entries[] = [
            'id'          => $maxId + 1,
            'id_sessione' => $idSessione !== null ? (int)$idSessione : null,
            'id_squadra'  => (int)$idSquadra,
            'diff'        => $diff,
            'descrizione' => $desc,
            'data'        => date('Y-m-d H:i:s')
        ];

        return ['data' => $entries, 'result' => true];
    }, []);
}

/**
 * Elimina tutti i movimenti di crediti extra associati a una sessione (ad es. quando viene cancellata).
 */
function mercato_db_delete_extra_saldo_by_session($idSessione) {
    if (!$idSessione) return false;
    return (bool)mercato_json_update('crediti_extra.json', function($entries) use ($idSessione) {
        if (!is_array($entries)) return ['data' => [], 'result' => true];

        $filtered = array_values(array_filter($entries, function($e) use ($idSessione) {
            if (!is_array($e)) return true; // preserva eventuali chiavi legacy
            if (!isset($e['id_sessione'])) return true;
            return (int)$e['id_sessione'] !== (int)$idSessione;
        }));

        return ['data' => $filtered, 'result' => true];
    }, []);
}

/**
 * Restituisce lo storico di tutti i movimenti di crediti extra per una sessione o per tutte.
 */
function mercato_db_get_extra_saldi_history($idSessione = null) {
    $entries = mercato_json_read('crediti_extra.json', []);
    if (!is_array($entries)) return [];
    if ($idSessione === null) return $entries;
    return array_values(array_filter($entries, function($e) use ($idSessione) {
        return is_array($e) && isset($e['id_sessione']) && (int)$e['id_sessione'] === (int)$idSessione;
    }));
}

function get_mercato_settings() {
    global $MERCATO_DEFAULT_SETTINGS;
    $saved = mercato_json_read('impostazioni.json', []);
    return array_merge($MERCATO_DEFAULT_SETTINGS, $saved);
}

/**
 * Salva le impostazioni. L'opzione 'abilita_simulazione' non cambia finché esistono buste non
 * ancora assegnate (altrimenti si potrebbe accenderla, guardare gli importi e rispegnerla): in
 * quel caso lancia un'eccezione e non salva nulla. Ogni modifica viene annotata nel registro.
 */
function save_mercato_settings($newSettings) {
    if (!is_array($newSettings)) return false;

    // Controllo, annotazione e scrittura avvengono tenendo il lock di offerte.json: tra il
    // controllo sulle buste e il salvataggio non può arrivare nessuna nuova offerta.
    return (bool)mercato_json_update('offerte.json', function($bids) use ($newSettings) {
        global $MERCATO_DEFAULT_SETTINGS;
        $current = get_mercato_settings();
        $effettive = array_merge($MERCATO_DEFAULT_SETTINGS, $newSettings);

        $cambiaSimulazione = !empty($effettive['abilita_simulazione']) !== !empty($current['abilita_simulazione']);
        if ($cambiaSimulazione) {
            $pendente = mercato_db_find_pending_session($bids);
            if ($pendente) {
                throw new Exception("L'opzione «Consenti la simulazione dell'asta» non può essere modificata finché la sessione " . mercato_registro_sessione($pendente) . " contiene buste non ancora assegnate. Esegui prima l'assegnazione finale oppure elimina la sessione.");
            }
        }

        $modifiche = [];
        foreach ($effettive as $chiave => $valore) {
            $modifica = mercato_registro_impostazione($chiave, $current[$chiave] ?? null, $valore);
            if ($modifica !== null) {
                $modifiche[] = $modifica;
            }
        }
        if ($modifiche) {
            // Un cambio dell'opzione sulla simulazione ha un'azione propria, per distinguerlo nel
            // registro dalle altre modifiche alle impostazioni
            mercato_registro_annota($cambiaSimulazione ? 'impostazioni_simulazione' : 'impostazioni', 'Impostazioni modificate: ' . implode('; ', $modifiche) . '.');
        }

        return ['data' => $bids, 'write' => false, 'result' => mercato_json_write('impostazioni.json', $newSettings)];
    }, []);
}

// ==========================================
// REGISTRO AZIONI AMMINISTRATORE
// ==========================================

/**
 * Annota un'azione sensibile dell'amministratore nel registro mostrato alle squadre.
 * Il file contiene una riga JSON per evento e viene aperto solo in append, sotto lock esclusivo:
 * nessuna funzione del modulo lo riscrive, lo accorcia o lo cancella.
 * Se l'annotazione non riesce lancia un'eccezione: l'azione non deve avvenire senza lasciare traccia.
 * Da $azione dipende anche quali voci restano sempre in elenco nelle pagine (vedi mercato_registro_da_mostrare).
 */
function mercato_registro_annota($azione, $testo, $idSessione = null) {
    // Ogni voce resta corta: il registro viene riletto per intero a ogni pagina delle squadre
    $testo = (string)$testo;
    if (strlen($testo) > 600) {
        $testo = (function_exists('mb_strcut') ? mb_strcut($testo, 0, 597, 'UTF-8') : substr($testo, 0, 597)) . '...';
    }
    $riga = json_encode([
        'ts'          => date('Y-m-d H:i:s'),
        'azione'      => (string)$azione,
        'id_sessione' => $idSessione !== null ? (int)$idSessione : null,
        'testo'       => (string)$testo
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    $ok = false;
    $fp = ($riga !== false && mercato_ensure_data_dir()) ? @fopen(MERCATO_REGISTRO_PATH, 'a+') : false;
    if ($fp) {
        if (flock($fp, LOCK_EX)) {
            // Se una scrittura precedente è rimasta a metà si riparte da una riga nuova,
            // così la voce resta leggibile (in modalità append la scrittura va comunque in coda).
            $stat = fstat($fp);
            if (!empty($stat['size']) && fseek($fp, -1, SEEK_END) === 0 && fread($fp, 1) !== "\n") {
                $riga = "\n" . $riga;
            }
            $ok = (fwrite($fp, $riga . "\n") === strlen($riga) + 1) && fflush($fp);
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
    if (!$ok) {
        throw new Exception("Impossibile aggiornare il registro delle azioni dell'amministratore: operazione annullata.");
    }
}

/**
 * Legge il registro delle azioni dell'amministratore, dalla voce più recente alla più vecchia.
 * Le righe non valide vengono ignorate.
 */
function mercato_registro_leggi() {
    $fp = is_file(MERCATO_REGISTRO_PATH) ? @fopen(MERCATO_REGISTRO_PATH, 'r') : false;
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $content = (string)stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $voci = [];
    foreach (explode("\n", $content) as $riga) {
        $voce = ($riga !== '') ? json_decode($riga, true) : null;
        if (is_array($voce) && isset($voce['ts'], $voce['testo']) && is_string($voce['ts']) && is_string($voce['testo'])) {
            $voci[] = $voce;
        }
    }
    return array_reverse($voci);
}

/**
 * Sceglie le voci del registro da mostrare nelle pagine (l'elenco arriva dalla voce più recente).
 * Solo le azioni di routine elencate qui sotto sono limitate alle $limite più recenti: aperture e
 * chiusure manuali, creazione di sessioni, simulazioni e report che non hanno mostrato importi
 * ancora segreti. Tutte le altre voci restano sempre: simulazioni e report anticipati che hanno
 * reso visibili importi ancora segreti, assegnazioni finali, modifiche alle impostazioni e alle
 * sessioni (date comprese), eliminazioni di sessioni. Così aprire e chiudere una sessione
 * centinaia di volte non basta a far uscire dall'elenco né la prova che gli importi sono stati
 * visti né una modifica a regole o date.
 */
function mercato_registro_da_mostrare($registro, $limite = 200) {
    $routine = ['stato', 'sessione', 'simulazione_senza_segreti', 'report_senza_segreti'];
    $voci = [];
    $altre = 0;
    foreach ($registro as $voce) {
        if (in_array($voce['azione'] ?? '', $routine, true)) {
            if ($altre >= $limite) continue;
            $altre++;
        }
        $voci[] = $voce;
    }
    return $voci;
}

/**
 * Riepilogo calcolato sull'intero registro: quante volte una simulazione o un report anticipato
 * hanno reso visibili all'amministratore importi ancora segreti e quando è successo l'ultima
 * volta. Stringa vuota se non è mai successo. Resta in evidenza anche quando l'elenco è molto lungo.
 */
function mercato_registro_riepilogo($registro) {
    $volte = 0;
    $ultima = '';
    foreach ($registro as $voce) {
        if (in_array($voce['azione'] ?? '', ['simulazione', 'report'], true)) {
            if ($volte === 0) $ultima = $voce['ts'] ?? '';
            $volte++;
        }
    }
    if ($volte === 0) return '';
    return "Importi delle buste resi visibili all'amministratore prima dell'assegnazione finale (simulazioni e report anticipati): "
        . ($volte === 1 ? "1 volta, il " : "{$volte} volte, l'ultima il ") . mercato_registro_data($ultima) . '.';
}

/**
 * Descrive per il registro la modifica di un'impostazione con parole comprensibili alle squadre
 * al posto di chiavi interne e valori grezzi, es. «Simulazione dell'asta: disattivata → attivata»
 * o «Recupero {MINORE}: 50% → 60%». Restituisce null se ciò che si leggerebbe non cambia.
 */
function mercato_registro_impostazione($chiave, $prima, $dopo) {
    $chiave = (string)$chiave;
    $etichette = [
        'max_giocatori'                  => 'Numero massimo di giocatori in rosa',
        'num_p'                          => 'Portieri in rosa',
        'num_d'                          => 'Difensori in rosa',
        'num_c'                          => 'Centrocampisti in rosa',
        'num_a'                          => 'Attaccanti in rosa',
        'obbligo_taglio'                 => 'Obbligo di taglio',
        'perc_recupero_estera'           => 'Recupero {ESTERA}',
        'perc_recupero_minore'           => 'Recupero {MINORE}',
        'perc_recupero_eliminata'        => 'Recupero {ELIMINATA}',
        'perc_recupero_serie_a'          => 'Recupero giocatore di A',
        'arrotonda_eccesso'              => 'Opzione «Arrotonda recupero crediti per eccesso»',
        'mostra_estera_minore_eliminata' => 'Opzione «Mostra tra i giocatori disponibili anche {ESTERA}, {MINORE}, {ELIMINATA}»',
        'mostra_chiamate_altri'          => 'Opzione «Consenti agli utenti di vedere le chiamate e i tagli altrui»',
        'abilita_simulazione'            => "Simulazione dell'asta"
    ];
    // Opzioni sì/no: come nel resto del modulo conta solo se sono attive oppure no
    $opzioni = ['arrotonda_eccesso', 'mostra_estera_minore_eliminata', 'mostra_chiamate_altri', 'abilita_simulazione'];

    $valori = [];
    foreach ([$prima, $dopo] as $valore) {
        if (in_array($chiave, $opzioni, true)) {
            $valori[] = !empty($valore) ? 'attivata' : 'disattivata';
        } else {
            $valori[] = is_scalar($valore) ? $valore . (strpos($chiave, 'perc_') === 0 ? '%' : '') : '?';
        }
    }
    if ($valori[0] === $valori[1]) return null;
    return ($etichette[$chiave] ?? $chiave) . ': ' . $valori[0] . ' → ' . $valori[1];
}

/**
 * Etichetta di una sessione nelle voci del registro, es. #3 «1ª Sessione Riparazione».
 */
function mercato_registro_sessione($sessione) {
    return '#' . (int)($sessione['id'] ?? 0) . ' «' . (string)($sessione['nome'] ?? '') . '»';
}

/**
 * Data in formato leggibile per il registro. Solo le date assolute vengono riformattate: qualsiasi
 * altro valore (es. una data relativa) resta visibile così com'è stato inserito.
 */
function mercato_registro_data($valore) {
    $valore = (string)$valore;
    if (preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?\z/', $valore, $m) && ($ts = strtotime($valore)) !== false) {
        return date(isset($m[1]) && $m[1] !== ':00' ? 'd/m/Y H:i:s' : 'd/m/Y H:i', $ts);
    }
    return $valore;
}
