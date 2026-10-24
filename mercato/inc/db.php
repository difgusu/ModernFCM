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

function mercato_json_write($filename, $data) {
    if (!is_dir(MERCATO_DATA_DIR)) {
        mkdir(MERCATO_DATA_DIR, 0755, true);
    }
    $filePath = MERCATO_DATA_DIR . '/' . $filename;
    $fp = fopen($filePath, 'c+');
    if (!$fp) return false;
    
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
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
        if (!empty($s['attiva'])) return $s;
    }
    return null;
}

function mercato_db_save_session($data) {
    $sessions = mercato_json_read('sessioni.json', []);
    $id = !empty($data['id']) ? (int)$data['id'] : null;

    if ($id) {
        foreach ($sessions as &$s) {
            if ((int)$s['id'] === $id) {
                $s['nome'] = $data['nome'] ?? $s['nome'];
                $s['data_apertura'] = $data['data_apertura'] ?? $s['data_apertura'];
                $s['data_chiusura'] = $data['data_chiusura'] ?? $s['data_chiusura'];
                if (isset($data['attiva'])) $s['attiva'] = (int)$data['attiva'];
                if (isset($data['elaborata'])) $s['elaborata'] = (int)$data['elaborata'];
                break;
            }
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

    mercato_json_write('sessioni.json', $sessions);
    return true;
}

function mercato_db_toggle_session($id, $attiva) {
    $sessions = mercato_json_read('sessioni.json', []);
    foreach ($sessions as &$s) {
        if ((int)$s['id'] === (int)$id) {
            $s['attiva'] = (int)$attiva;
            break;
        }
    }
    return mercato_json_write('sessioni.json', $sessions);
}

function mercato_db_delete_session($id) {
    $sessions = mercato_json_read('sessioni.json', []);
    $sessions = array_values(array_filter($sessions, function($s) use ($id) {
        return (int)$s['id'] !== (int)$id;
    }));
    mercato_json_write('sessioni.json', $sessions);

    // Rimuove tutte le offerte relative a questa sessione
    $bids = mercato_json_read('offerte.json', []);
    $bids = array_values(array_filter($bids, function($b) use ($id) {
        return (int)$b['id_sessione'] !== (int)$id;
    }));
    mercato_json_write('offerte.json', $bids);

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
    $bids = mercato_json_read('offerte.json', []);
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

    mercato_json_write('offerte.json', $bids);
    return true;
}

function mercato_db_delete_bid($idOfferta, $idSquadra, $idSessione) {
    $bids = mercato_json_read('offerte.json', []);
    $bids = array_values(array_filter($bids, function($b) use ($idOfferta, $idSquadra, $idSessione) {
        return !((int)$b['id'] === (int)$idOfferta && (int)$b['id_squadra'] === (int)$idSquadra && (int)$b['id_sessione'] === (int)$idSessione);
    }));
    return mercato_json_write('offerte.json', $bids);
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

    $entries = mercato_json_read('crediti_extra.json', []);
    if (!is_array($entries)) $entries = [];

    $maxId = 0;
    foreach ($entries as $e) {
        if (is_array($e) && isset($e['id']) && (int)$e['id'] > $maxId) {
            $maxId = (int)$e['id'];
        }
    }

    $newEntry = [
        'id'          => $maxId + 1,
        'id_sessione' => $idSessione !== null ? (int)$idSessione : null,
        'id_squadra'  => (int)$idSquadra,
        'diff'        => $diff,
        'descrizione' => $desc,
        'data'        => date('Y-m-d H:i:s')
    ];

    $entries[] = $newEntry;
    return mercato_json_write('crediti_extra.json', $entries);
}

/**
 * Elimina tutti i movimenti di crediti extra associati a una sessione (ad es. quando viene cancellata).
 */
function mercato_db_delete_extra_saldo_by_session($idSessione) {
    if (!$idSessione) return false;
    $entries = mercato_json_read('crediti_extra.json', []);
    if (!is_array($entries)) return true;

    $filtered = array_values(array_filter($entries, function($e) use ($idSessione) {
        if (!is_array($e)) return true; // preserva eventuali chiavi legacy
        if (!isset($e['id_sessione'])) return true;
        return (int)$e['id_sessione'] !== (int)$idSessione;
    }));

    return mercato_json_write('crediti_extra.json', $filtered);
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

function save_mercato_settings($newSettings) {
    return mercato_json_write('impostazioni.json', $newSettings);
}
