<?php
/**
 * View & UI per il tab Gestione Associazioni Live Unificate (Tutte le Fonti)
 * File: inc_associazioni_view.php
 */
?>

<!-- BANNER INTESTAZIONE MODULO ASSOCIAZIONI -->
<div class="assoc-header-banner">
    <div>
        <h3 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>🔗</span>
            <span>Gestione e Aggiornamento Associazioni Live (Tutte le Fonti)</span>
        </h3>
        <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            Associa i giocatori attivi in <strong>Serie A</strong> con le rispettive anagrafiche e codici di <strong>Pianetafanta.it</strong>, <strong>Fantacalcio.it</strong>, <strong>Fantapazz.com</strong> e <strong>FantaMaster</strong> per aggiornare <code>inc/data/liveVU_associazioni.php</code>.
        </p>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="calc-btn-action" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px;" onclick="loadCurrentAssocState()">
            <span>👁️ Ispeziona Stato Attuale</span>
        </button>
    </div>
</div>

<!-- SEZIONE CARICAMENTO E DOWNLOAD FILE QUOTAZIONI (4 FONTI) -->
<div class="assoc-upload-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
    <!-- Box 1: Pianetafanta.it -->
    <div class="assoc-upload-box" id="boxUploadPF">
        <div class="assoc-upload-icon" style="color: #8b5cf6;">🌐</div>
        <div class="assoc-upload-title">1. Pianetafanta.it</div>
        <div class="assoc-upload-subtitle">Listone Serie A (Voti Ufficiosi)</div>
        
        <button type="button" class="calc-btn-action" id="btnDownloadPF" style="width: 100%; margin: 10px 0 6px 0; background: #534ab7; color: #fff; font-weight: 700; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="downloadAssocPF()">
            <span>📥</span>
            <span>Scarica da Pianetafanta</span>
        </button>
        <div id="pfOnlineStatus" style="font-size: 0.76rem; font-weight: 600; color: var(--accent-emerald, #10b981); display: none; margin-bottom: 6px;"></div>

        <div style="display: flex; align-items: center; margin: 8px 0; color: var(--text-muted); font-size: 0.72rem;">
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
            <span>oppure file locale (.xlsx)</span>
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
        </div>

        <label class="assoc-file-label" id="labelPF">
            <input type="file" id="fileExcelPF" accept=".xlsx" onchange="onAssocFileSelected('pf', this)">
            <span id="btnLabelPF">📁 Seleziona .xlsx</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNamePF">Nessun file selezionato</div>
    </div>

    <!-- Box 2: Fantacalcio.it -->
    <div class="assoc-upload-box" id="boxUploadFC">
        <div class="assoc-upload-icon" style="color: #0284c7;">⚽</div>
        <div class="assoc-upload-title">2. Fantacalcio.it</div>
        <div class="assoc-upload-subtitle">Listone Ufficiale Serie A (ID/Ruolo)</div>
        
        <button type="button" class="calc-btn-action" id="btnDownloadFC" style="width: 100%; margin: 10px 0 6px 0; background: #0284c7; color: #fff; font-weight: 700; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="downloadAssocFC()">
            <span>📥</span>
            <span>Scarica da Fantacalcio</span>
        </button>
        <div id="fcOnlineStatus" style="font-size: 0.76rem; font-weight: 600; color: var(--accent-emerald, #10b981); display: none; margin-bottom: 6px;"></div>

        <div style="display: flex; align-items: center; margin: 8px 0; color: var(--text-muted); font-size: 0.72rem;">
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
            <span>oppure file locale (.xlsx)</span>
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
        </div>

        <label class="assoc-file-label" id="labelFC">
            <input type="file" id="fileExcelFC" accept=".xlsx" onchange="onAssocFileSelected('fc', this)">
            <span id="btnLabelFC">📁 Seleziona .xlsx</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNameFC">Nessun file selezionato</div>
    </div>

    <!-- Box 3: Fantapazz.com -->
    <div class="assoc-upload-box" id="boxUploadFP">
        <div class="assoc-upload-icon" style="color: #0ea5e9;">⚡</div>
        <div class="assoc-upload-title">3. Fantapazz.com</div>
        <div class="assoc-upload-subtitle">Listone Live Voti e Bonus/Malus</div>
        
        <button type="button" class="calc-btn-action" id="btnDownloadFP" style="width: 100%; margin: 10px 0 6px 0; background: #0369a1; color: #fff; font-weight: 700; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="downloadAssocFP()">
            <span>📥</span>
            <span>Scarica da Fantapazz</span>
        </button>
        <div id="fpOnlineStatus" style="font-size: 0.76rem; font-weight: 600; color: var(--accent-emerald, #10b981); display: none; margin-bottom: 6px;"></div>

        <div style="display: flex; align-items: center; margin: 8px 0; color: var(--text-muted); font-size: 0.72rem;">
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
            <span>oppure file locale (.csv)</span>
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
        </div>

        <label class="assoc-file-label" id="labelFP">
            <input type="file" id="fileCsvFP" accept=".csv" onchange="onAssocFileSelected('fp', this)">
            <span id="btnLabelFP">📁 Seleziona .csv</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNameFP">Nessun file selezionato</div>
    </div>

    <!-- Box 4: FantaMaster -->
    <div class="assoc-upload-box" id="boxUploadFM">
        <div class="assoc-upload-icon" style="color: #f59e0b;">🔥</div>
        <div class="assoc-upload-title">4. FantaMaster</div>
        <div class="assoc-upload-subtitle">Listone Live Voti e Statistiche CDN</div>
        
        <button type="button" class="calc-btn-action" id="btnDownloadFM" style="width: 100%; margin: 10px 0 6px 0; background: #b45309; color: #fff; font-weight: 700; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="downloadAssocFM()">
            <span>📥</span>
            <span>Scarica da FantaMaster</span>
        </button>
        <div id="fmOnlineStatus" style="font-size: 0.76rem; font-weight: 600; color: var(--accent-emerald, #10b981); display: none; margin-bottom: 6px;"></div>

        <div style="display: flex; align-items: center; margin: 8px 0; color: var(--text-muted); font-size: 0.72rem;">
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
            <span>oppure file locale (.json)</span>
            <hr style="flex: 1; border: none; border-top: 1px solid var(--border-subtle); margin: 0 6px;">
        </div>

        <label class="assoc-file-label" id="labelFM">
            <input type="file" id="fileJsonFM" accept=".json" onchange="onAssocFileSelected('fm', this)">
            <span id="btnLabelFM">📁 Seleziona .json</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNameFM">Nessun file selezionato</div>
    </div>
</div>

<!-- PULSANTI AZIONE: DOWNLOAD AUTOMATICO / ELABORAZIONE -->
<div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 24px 0;">
    <button type="button" id="btnDownloadAndAnalyze" class="calc-btn-action calc-btn-save" style="padding: 12px 26px; font-size: 0.95rem; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35); font-weight: 800;" onclick="downloadAndAnalyzeAssoc()">
        <span>⚡</span>
        <span>Scarica ed Elabora Automaticamente Tutte le Fonti (4 in 1)</span>
    </button>
    <button type="button" id="btnAnalyzeAssoc" class="calc-btn-action" style="padding: 12px 20px; font-size: 0.88rem; border-radius: 12px; cursor: pointer; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary);" onclick="analyzeAssocFiles()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Analizza File Caricati / Scaricati</span>
    </button>
</div>

<!-- WORKSPACE RISULTATI (Visibile dopo analisi o ispezione stato) -->
<div id="assocWorkspace" style="display: none;">
    <!-- METRICHE STATISTICHE PRINCIPALI -->
    <div class="assoc-stats-grid">
        <div class="assoc-stat-card">
            <div class="assoc-stat-val" id="statTotalFcm">0</div>
            <div class="assoc-stat-lbl">Giocatori Serie A FCM</div>
        </div>
        <div class="assoc-stat-card stat-card-confirmed">
            <div class="assoc-stat-val" id="statConfirmed">0</div>
            <div class="assoc-stat-lbl">✅ Convalidati / Sicuri</div>
        </div>
        <div class="assoc-stat-card stat-card-doubtful">
            <div class="assoc-stat-val" id="statDoubtful">0</div>
            <div class="assoc-stat-lbl">⚠️ Casi Dubbi da Risolvere</div>
        </div>
        <div class="assoc-stat-card stat-card-notfound">
            <div class="assoc-stat-val" id="statNotFound">0</div>
            <div class="assoc-stat-lbl">⚪ Non Trovati / Vuoti</div>
        </div>
    </div>

    <!-- METRICHE COPERTURA FONTI -->
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;">
        <div style="flex: 1; min-width: 150px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.78rem; font-weight: 700; color: #8b5cf6;">🌐 Pianetafanta:</span>
            <span id="coveragePf" style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">0 / 0</span>
        </div>
        <div style="flex: 1; min-width: 150px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.78rem; font-weight: 700; color: #0284c7;">⚽ Fantacalcio:</span>
            <span id="coverageFc" style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">0 / 0</span>
        </div>
        <div style="flex: 1; min-width: 150px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.78rem; font-weight: 700; color: #0ea5e9;">⚡ Fantapazz:</span>
            <span id="coverageFp" style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">0 / 0</span>
        </div>
        <div style="flex: 1; min-width: 150px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.78rem; font-weight: 700; color: #f59e0b;">🔥 FantaMaster:</span>
            <span id="coverageFm" style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">0 / 0</span>
        </div>
    </div>

    <!-- BARRA FILTRI & RICERCA -->
    <div class="assoc-toolbar">
        <div class="assoc-filter-pills">
            <button type="button" class="assoc-pill-btn active" data-filter="all" onclick="setAssocFilter('all')">
                Tutti (<span id="countPillAll">0</span>)
            </button>
            <button type="button" class="assoc-pill-btn pill-doubtful" data-filter="dubbio" onclick="setAssocFilter('dubbio')">
                ⚠️ Da Risolvere (<span id="countPillDoubtful">0</span>)
            </button>
            <button type="button" class="assoc-pill-btn pill-confirmed" data-filter="confermato" onclick="setAssocFilter('confermato')">
                ✅ Convalidati (<span id="countPillConfirmed">0</span>)
            </button>
            <button type="button" class="assoc-pill-btn pill-notfound" data-filter="non_trovato" onclick="setAssocFilter('non_trovato')">
                ⚪ Non Trovati (<span id="countPillNotFound">0</span>)
            </button>
        </div>
        <div class="assoc-search-wrap">
            <input type="text" id="assocSearchInput" class="assoc-search-input" placeholder="🔍 Filtra per nome, squadra o codice..." oninput="onAssocSearchInput()">
        </div>
    </div>

    <!-- TABELLA INTERATTIVA A 4 FONTI -->
    <div class="assoc-table-wrap">
        <table class="assoc-table" id="assocTable">
            <thead>
                <tr>
                    <th style="width: 36px; text-align: center;">R</th>
                    <th>Giocatore FCM</th>
                    <th style="min-width: 220px; color: #8b5cf6;">🌐 Pianetafanta (Cod / Nome)</th>
                    <th style="min-width: 220px; color: #0284c7;">⚽ Fantacalcio (Id / Nome)</th>
                    <th style="min-width: 220px; color: #0ea5e9;">⚡ Fantapazz (Nome)</th>
                    <th style="min-width: 220px; color: #f59e0b;">🔥 FantaMaster (Id / Nome)</th>
                    <th style="width: 80px; text-align: center;">Azione</th>
                </tr>
            </thead>
            <tbody id="assocTableBody">
                <!-- Generato via JavaScript -->
            </tbody>
        </table>
    </div>

    <!-- ACTION BAR STICKY INFERIORE -->
    <div class="calc-actions-bar is-sticky-bottom" style="margin-top: 18px;">
        <div class="badge-wrap">
            <span class="badge-status-changes" id="assocSaveStatusBadge">
                <span>⚪</span> In attesa di revisione
            </span>
        </div>
        <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveAssoc" onclick="saveAssociazioni()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Salva inc/data/liveVU_associazioni.php</span>
            </button>
        </div>
    </div>
</div>

<script type="text/javascript">
/**
 * Controller JavaScript per la gestione delle associazioni live unificate (4 fonti)
 */
var assocState = {
    items: [],           // Tutti gli elementi attivi
    filteredItems: [],   // Elementi filtrati correnti
    activeFilter: 'all', // 'all', 'dubbio', 'confermato', 'non_trovato'
    searchTerm: '',
    unassignedPF: [],
    unassignedFC: [],
    unassignedFP: [],
    unassignedFM: [],
    selectedFilePF: null,
    selectedFileFC: null,
    selectedFileFP: null,
    selectedFileFM: null,
    hasDownloadedPF: false,
    hasDownloadedFC: false,
    hasDownloadedFP: false,
    hasDownloadedFM: false
};

function normAssocTeam(t) {
    if (!t) return '';
    t = String(t).toUpperCase().trim();
    if (t.indexOf('VERONA') > -1) return 'VERONA';
    if (t.indexOf('INTER') > -1) return 'INTER';
    if (t.indexOf('JUVE') > -1) return 'JUVENTUS';
    return t;
}

function getUnassignedPfPlayers() {
    var assigned = {};
    (assocState.items || []).forEach(function(item) {
        if (item.pfSelected && item.pfSelected.cod) {
            assigned[item.pfSelected.cod] = true;
        }
    });
    return (assocState.unassignedPF || []).filter(function(p) {
        return !assigned[p.cod];
    });
}

function getUnassignedFcPlayers() {
    var assigned = {};
    (assocState.items || []).forEach(function(item) {
        if (item.fcSelected && item.fcSelected.id) {
            assigned[item.fcSelected.id] = true;
        }
    });
    return (assocState.unassignedFC || []).filter(function(p) {
        return !assigned[p.id];
    });
}

function getUnassignedFpPlayers() {
    var assigned = {};
    (assocState.items || []).forEach(function(item) {
        if (item.fpSelected && item.fpSelected.nome) {
            assigned[item.fpSelected.nome.toUpperCase().trim()] = true;
        }
    });
    return (assocState.unassignedFP || []).filter(function(p) {
        return !assigned[(p.nome || '').toUpperCase().trim()];
    });
}

function getUnassignedFmPlayers() {
    var assigned = {};
    (assocState.items || []).forEach(function(item) {
        if (item.fmSelected && item.fmSelected.id) {
            assigned[item.fmSelected.id] = true;
        }
    });
    return (assocState.unassignedFM || []).filter(function(p) {
        return !assigned[p.id];
    });
}

function onAssocFileSelected(source, input) {
    var file = input.files && input.files[0] ? input.files[0] : null;
    var map = {
        'pf': { prop: 'selectedFilePF', nameEl: 'fileNamePF', boxEl: 'boxUploadPF' },
        'fc': { prop: 'selectedFileFC', nameEl: 'fileNameFC', boxEl: 'boxUploadFC' },
        'fp': { prop: 'selectedFileFP', nameEl: 'fileNameFP', boxEl: 'boxUploadFP' },
        'fm': { prop: 'selectedFileFM', nameEl: 'fileNameFM', boxEl: 'boxUploadFM' }
    };
    var cfg = map[source];
    if (!cfg) return;

    assocState[cfg.prop] = file;
    var nameEl = document.getElementById(cfg.nameEl);
    var boxEl = document.getElementById(cfg.boxEl);
    if (file) {
        nameEl.textContent = '📄 ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
        boxEl.classList.add('has-file');
    } else {
        nameEl.textContent = 'Nessun file selezionato';
        boxEl.classList.remove('has-file');
    }
}

function getAssocCsrfHeaders() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    var token = meta ? meta.getAttribute('content') : '';
    return token ? { 'X-CSRF-Token': token } : {};
}

function downloadAssocPF() {
    var btn = document.getElementById('btnDownloadPF');
    var statusEl = document.getElementById('pfOnlineStatus');
    var box = document.getElementById('boxUploadPF');
    var oldText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Connessione...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'download_pf');

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                showToast('Errore download Pianetafanta: ' + (data.error || 'Errore sconosciuto'), 'error');
                return;
            }

            assocState.hasDownloadedPF = true;
            box.classList.add('has-file');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = '✅ Online: ' + data.count + ' giocatori (G' + data.giornata + ')';
            }
            showToast(data.message || 'Quotazioni Pianetafanta scaricate!', 'success');
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            showToast('Errore rete Pianetafanta: ' + err.message, 'error');
        });
}

function downloadAssocFC() {
    var btn = document.getElementById('btnDownloadFC');
    var statusEl = document.getElementById('fcOnlineStatus');
    var box = document.getElementById('boxUploadFC');
    var oldText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Connessione...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'download_fc');

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                showToast('Errore download Fantacalcio: ' + (data.error || 'Errore sconosciuto'), 'error');
                return;
            }

            assocState.hasDownloadedFC = true;
            box.classList.add('has-file');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = '✅ Online: ' + data.count + ' giocatori';
            }
            showToast(data.message || 'Quotazioni Fantacalcio scaricate!', 'success');
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            showToast('Errore rete Fantacalcio: ' + err.message, 'error');
        });
}

function downloadAssocFP() {
    var btn = document.getElementById('btnDownloadFP');
    var statusEl = document.getElementById('fpOnlineStatus');
    var box = document.getElementById('boxUploadFP');
    var oldText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Connessione...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'download_fp');

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                showToast('Errore download Fantapazz: ' + (data.error || 'Errore sconosciuto'), 'error');
                return;
            }

            assocState.hasDownloadedFP = true;
            box.classList.add('has-file');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = '✅ Online: ' + data.count + ' giocatori (CSV)';
            }
            showToast(data.message || 'Quotazioni Fantapazz scaricate!', 'success');
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            showToast('Errore rete Fantapazz: ' + err.message, 'error');
        });
}

function downloadAssocFM() {
    var btn = document.getElementById('btnDownloadFM');
    var statusEl = document.getElementById('fmOnlineStatus');
    var box = document.getElementById('boxUploadFM');
    var oldText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Connessione...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'download_fm');

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                showToast('Errore download FantaMaster: ' + (data.error || 'Errore sconosciuto'), 'error');
                return;
            }

            assocState.hasDownloadedFM = true;
            box.classList.add('has-file');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = '✅ Online: ' + data.count + ' giocatori (CDN)';
            }
            showToast(data.message || 'Quotazioni FantaMaster scaricate!', 'success');
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            showToast('Errore rete FantaMaster: ' + err.message, 'error');
        });
}

function sortAssocItems(items) {
    var roleOrder = { 'P': 1, 'D': 2, 'C': 3, 'A': 4 };
    return items.sort(function(a, b) {
        var rA = roleOrder[a.ruoloFCM] || 99;
        var rB = roleOrder[b.ruoloFCM] || 99;
        if (rA !== rB) {
            return rA - rB;
        }
        return (a.nomeFCM || '').localeCompare(b.nomeFCM || '', 'it');
    });
}

function applyMatchingResults(data) {
    assocState.unassignedPF = data.unassigned_pf || [];
    assocState.unassignedFC = data.unassigned_fc || [];
    assocState.unassignedFP = (data.unassigned_fp || []).map(function(p) {
        return {
            cod: p.quotazione || p.cod || '',
            nome: p.calciatore || p.nome || '',
            squadra: p.squadra || '',
            ruolo: p.ruolo || ''
        };
    });
    assocState.unassignedFM = (data.unassigned_fm || []).map(function(p) {
        return {
            id: p.id,
            nome: p.name || p.nome || '',
            squadra: p.team || p.squadra || '',
            ruolo: p.role || p.ruolo || ''
        };
    });

    // Normalizza elementi per la tabella
    var rawItems = (data.all || []).map(function(item, idx) {
        return {
            id: idx,
            codiceFCM: item.player.codice,
            idFCM: item.player.id,
            nomeFCM: item.player.nome,
            squadraFCM: item.player.squadra,
            ruoloFCM: item.player.ruolo,
            status: item.status, // 'dubbio', 'confermato', 'non_trovato'
            isDoubtful: item.is_doubtful,
            conflict: !!(item.pf_conflict || item.fc_conflict || item.fm_conflict),

            // Pianetafanta
            pfSelected: item.pf_selected ? { cod: item.pf_selected.cod, nome: item.pf_selected.nome, squadra: item.pf_selected.squadra, ruolo: item.pf_selected.ruolo } : null,
            pfCandidates: item.pf_candidates || [],

            // Fantacalcio.it
            fcSelected: item.fc_selected ? { id: item.fc_selected.id, nome: item.fc_selected.nome, squadra: item.fc_selected.squadra, ruolo: item.fc_selected.ruolo } : null,
            fcCandidates: item.fc_candidates || [],

            // Fantapazz.com (matching univoco solo per Nome)
            fpSelected: item.fp_selected ? {
                nome: item.fp_selected.calciatore || item.fp_selected.nome || '',
                squadra: item.fp_selected.squadra || '',
                ruolo: item.fp_selected.ruolo || ''
            } : null,
            fpCandidates: (item.fp_candidates || []).map(function(c) {
                return {
                    nome: c.calciatore || c.nome || '',
                    squadra: c.squadra || '',
                    ruolo: c.ruolo || ''
                };
            }),

            // FantaMaster
            fmSelected: item.fm_selected ? {
                id: item.fm_selected.id,
                nome: item.fm_selected.name || item.fm_selected.nome || '',
                squadra: item.fm_selected.team || item.fm_selected.squadra || '',
                ruolo: item.fm_selected.role || item.fm_selected.ruolo || ''
            } : null,
            fmCandidates: (item.fm_candidates || []).map(function(c) {
                return {
                    id: c.id,
                    nome: c.name || c.nome || '',
                    squadra: c.team || c.squadra || '',
                    ruolo: c.role || c.ruolo || ''
                };
            }),

            isManualEdit: false
        };
    });

    sortAssocItems(rawItems);
    rawItems.forEach(function(item, idx) { item.id = idx; });
    assocState.items = rawItems;

    document.getElementById('assocWorkspace').style.display = 'block';
    updateAssocStats();

    var doubtfulCount = assocState.items.filter(function(i) { return i.status === 'dubbio'; }).length;
    if (doubtfulCount > 0) {
        setAssocFilter('dubbio');
        showToast('Elaborazione completata: rilevati ' + doubtfulCount + ' casi dubbi o conflitti da risolvere.', 'info');
    } else {
        setAssocFilter('all');
        showToast('Elaborazione 4-in-1 completata con successo! Tutte le corrispondenze sono state verificate.', 'success');
    }

    document.getElementById('assocWorkspace').scrollIntoView({ behavior: 'smooth' });
}

function downloadAndAnalyzeAssoc() {
    var btn = document.getElementById('btnDownloadAndAnalyze');
    var oldText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Scaricamento online da 4 fonti ed elaborazione in corso...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'download_and_analyze');

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                showToast('Errore durante lo scaricamento/analisi: ' + (data.error || 'Errore sconosciuto'), 'error');
                return;
            }

            // Segna i 4 box come scaricati
            assocState.hasDownloadedPF = true;
            assocState.hasDownloadedFC = true;
            assocState.hasDownloadedFP = true;
            assocState.hasDownloadedFM = true;

            var boxPF = document.getElementById('boxUploadPF');
            var boxFC = document.getElementById('boxUploadFC');
            var boxFP = document.getElementById('boxUploadFP');
            var boxFM = document.getElementById('boxUploadFM');
            if (boxPF) boxPF.classList.add('has-file');
            if (boxFC) boxFC.classList.add('has-file');
            if (boxFP) boxFP.classList.add('has-file');
            if (boxFM) boxFM.classList.add('has-file');

            var stPF = document.getElementById('pfOnlineStatus');
            var stFC = document.getElementById('fcOnlineStatus');
            var stFP = document.getElementById('fpOnlineStatus');
            var stFM = document.getElementById('fmOnlineStatus');
            if (stPF) { stPF.style.display = 'block'; stPF.innerHTML = '✅ Online: ' + data.pf_count + ' giocatori (G' + data.pf_giornata + ')'; }
            if (stFC) { stFC.style.display = 'block'; stFC.innerHTML = '✅ Online: ' + data.fc_count + ' giocatori'; }
            if (stFP) { stFP.style.display = 'block'; stFP.innerHTML = '✅ Online: ' + data.fp_count + ' giocatori (CSV)'; }
            if (stFM) { stFM.style.display = 'block'; stFM.innerHTML = '✅ Online: ' + data.fm_count + ' giocatori (CDN)'; }

            applyMatchingResults(data);
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            showToast('Errore di connessione: ' + err.message, 'error');
        });
}

function analyzeAssocFiles() {
    var filePF = document.getElementById('fileExcelPF').files[0];
    var fileFC = document.getElementById('fileExcelFC').files[0];
    var fileFP = document.getElementById('fileCsvFP').files[0];
    var fileFM = document.getElementById('fileJsonFM').files[0];

    var hasFiles = (filePF && fileFC);
    var hasDownloaded = (assocState.hasDownloadedPF && assocState.hasDownloadedFC);

    if (!hasFiles && !hasDownloaded) {
        showToast('Seleziona i file Excel/CSV/JSON oppure clicca su "Scarica ed Elabora Automaticamente".', 'error');
        return;
    }

    var btn = document.getElementById('btnAnalyzeAssoc');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Elaborazione e matching a 4 vie in corso...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'analyze_files');
    if (hasFiles) {
        fd.append('excel_pf', filePF);
        fd.append('excel_fc', fileFC);
        if (fileFP) fd.append('file_fp', fileFP);
        if (fileFM) fd.append('file_fm', fileFM);
    } else {
        fd.append('use_downloaded', '1');
    }

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        btn.disabled = false;
        btn.innerHTML = oldText;

        if (!data.success) {
            showToast('Errore analisi: ' + (data.error || 'Errore sconosciuto'), 'error');
            return;
        }

        applyMatchingResults(data);
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = oldText;
        showToast('Errore di connessione durante l\'analisi: ' + err.message, 'error');
    });
}

function loadCurrentAssocState() {
    showToast('Caricamento stato attuale da inc/data/liveVU_associazioni.php...', 'info');

    fetch('impostazioni.php?assoc_action=get_current_state&_t=' + Date.now())
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data.success) {
            showToast('Errore: ' + (data.error || 'Impossibile leggere il file'), 'error');
            return;
        }

        assocState.unassignedPF = data.unassigned_pf || [];
        assocState.unassignedFC = data.unassigned_fc || [];
        assocState.unassignedFP = (data.unassigned_fp || []).map(function(p) {
            return {
                cod: p.quotazione || p.cod || '',
                nome: p.calciatore || p.nome || '',
                squadra: p.squadra || '',
                ruolo: p.ruolo || ''
            };
        });
        assocState.unassignedFM = (data.unassigned_fm || []).map(function(p) {
            return {
                id: p.id,
                nome: p.name || p.nome || '',
                squadra: p.team || p.squadra || '',
                ruolo: p.role || p.ruolo || ''
            };
        });

        var rawItems = (data.items || []).map(function(item, idx) {
            var hasPf = (item.codPF !== '' && item.codPF !== 0);
            var hasFc = (item.codFC !== '' && item.codFC !== 0);
            var hasFp = (item.nomeFP && item.nomeFP !== '');
            var hasFm = (item.codFM !== '' && item.codFM !== 0) || (item.nomeFM && item.nomeFM !== '');
            var isConf = (hasPf || hasFc || hasFp || hasFm);

            return {
                id: idx,
                codiceFCM: item.player.codice,
                idFCM: item.player.id,
                nomeFCM: item.player.nome,
                squadraFCM: item.player.squadra,
                ruoloFCM: item.player.ruolo,
                status: isConf ? 'confermato' : 'non_trovato',
                isDoubtful: false,
                conflict: false,

                pfSelected: hasPf ? { cod: item.codPF, nome: item.nomePF, squadra: item.player.squadra, ruolo: item.player.ruolo } : null,
                pfCandidates: [],

                fcSelected: hasFc ? { id: item.codFC, nome: item.nomeFC, squadra: item.player.squadra, ruolo: item.player.ruolo } : null,
                fcCandidates: [],

                fpSelected: hasFp ? { nome: item.nomeFP, squadra: item.player.squadra, ruolo: item.player.ruolo } : null,
                fpCandidates: [],

                fmSelected: hasFm ? { id: item.codFM, nome: item.nomeFM, squadra: item.player.squadra, ruolo: item.player.ruolo } : null,
                fmCandidates: [],

                isManualEdit: false
            };
        });

        sortAssocItems(rawItems);
        rawItems.forEach(function(item, idx) { item.id = idx; });
        assocState.items = rawItems;

        document.getElementById('assocWorkspace').style.display = 'block';
        updateAssocStats();
        setAssocFilter('all');
        showToast('Stato attuale caricato: ' + data.total_fcm + ' giocatori Serie A rilevati (' + data.associated_count + ' associati). Ultima modifica: ' + (data.last_file_update || 'N/D'), 'success');
    })
    .catch(function(err) {
        showToast('Errore: ' + err.message, 'error');
    });
}

function updateAssocStats() {
    var total = assocState.items.length;
    var confirmed = 0;
    var doubtful = 0;
    var notFound = 0;

    var pfCount = 0;
    var fcCount = 0;
    var fpCount = 0;
    var fmCount = 0;

    assocState.items.forEach(function(item) {
        if (item.status === 'dubbio') doubtful++;
        else if (item.status === 'confermato') confirmed++;
        else notFound++;

        if (item.pfSelected && item.pfSelected.cod) pfCount++;
        if (item.fcSelected && item.fcSelected.id) fcCount++;
        if (item.fpSelected && item.fpSelected.nome) fpCount++;
        if (item.fmSelected && (item.fmSelected.id || item.fmSelected.nome)) fmCount++;
    });

    document.getElementById('statTotalFcm').textContent = total;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statDoubtful').textContent = doubtful;
    document.getElementById('statNotFound').textContent = notFound;

    document.getElementById('countPillAll').textContent = total;
    document.getElementById('countPillDoubtful').textContent = doubtful;
    document.getElementById('countPillConfirmed').textContent = confirmed;
    document.getElementById('countPillNotFound').textContent = notFound;

    var covPfEl = document.getElementById('coveragePf');
    var covFcEl = document.getElementById('coverageFc');
    var covFpEl = document.getElementById('coverageFp');
    var covFmEl = document.getElementById('coverageFm');

    if (covPfEl) covPfEl.textContent = pfCount + ' / ' + total + ' (' + (total ? Math.round(pfCount / total * 100) : 0) + '%)';
    if (covFcEl) covFcEl.textContent = fcCount + ' / ' + total + ' (' + (total ? Math.round(fcCount / total * 100) : 0) + '%)';
    if (covFpEl) covFpEl.textContent = fpCount + ' / ' + total + ' (' + (total ? Math.round(fpCount / total * 100) : 0) + '%)';
    if (covFmEl) covFmEl.textContent = fmCount + ' / ' + total + ' (' + (total ? Math.round(fmCount / total * 100) : 0) + '%)';

    var statusBadge = document.getElementById('assocSaveStatusBadge');
    if (statusBadge) {
        if (doubtful > 0) {
            statusBadge.className = 'badge-status-changes has-changes';
            statusBadge.innerHTML = '<span>⚠️</span> ' + doubtful + ' casi da risolvere rimanenti';
        } else {
            statusBadge.className = 'badge-status-changes';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = 'var(--accent-emerald, #10b981)';
            statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            statusBadge.innerHTML = '<span>✅</span> Pronto al salvataggio univoco';
        }
    }
}

function setAssocFilter(filter) {
    assocState.activeFilter = filter;
    var pills = document.querySelectorAll('.assoc-pill-btn');
    pills.forEach(function(btn) {
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderAssocTable();
}

function onAssocSearchInput() {
    var input = document.getElementById('assocSearchInput');
    assocState.searchTerm = (input ? input.value : '').toLowerCase().trim();
    renderAssocTable();
}

function renderAssocTable() {
    var tbody = document.getElementById('assocTableBody');
    if (!tbody) return;

    var filter = assocState.activeFilter;
    var term = assocState.searchTerm;

    var visible = assocState.items.filter(function(item) {
        if (filter !== 'all' && item.status !== filter) {
            return false;
        }
        if (term !== '') {
            var matchNome = item.nomeFCM.toLowerCase().indexOf(term) > -1;
            var matchSq = item.squadraFCM.toLowerCase().indexOf(term) > -1;
            var matchCod = item.codiceFCM.toString().indexOf(term) > -1;
            if (!matchNome && !matchSq && !matchCod) {
                return false;
            }
        }
        return true;
    });

    if (visible.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;">Nessun giocatore corrisponde ai filtri selezionati.</td></tr>';
        return;
    }

    var unassignedPfAll = getUnassignedPfPlayers();
    var unassignedFcAll = getUnassignedFcPlayers();
    var unassignedFpAll = getUnassignedFpPlayers();
    var unassignedFmAll = getUnassignedFmPlayers();

    var html = '';
    visible.forEach(function(item) {
        var rowClass = (item.status === 'dubbio') ? 'row-doubtful' : '';

        // Status badge
        var statusBadge = '';
        if (item.status === 'dubbio') {
            var badgeText = item.conflict ? '⚠️ Conflitto' : '⚠️ Da Risolvere';
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);">' + badgeText + '</span>';
        } else if (item.status === 'confermato') {
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Confermato</span>';
        } else {
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; background: rgba(148, 163, 184, 0.1); color: #94a3b8;">⚪ Non Trovato</span>';
        }

        var isEditable = (item.status === 'dubbio' || item.status === 'non_trovato' || item.isManualEdit);

        // 1. Colonna Pianetafanta
        var colPF = '';
        if (isEditable) {
            colPF = '<select class="assoc-cand-select" onchange="onAssocSelectPF(' + item.id + ', this.value)">';
            colPF += '<option value="">-- Seleziona PF --</option>';
            colPF += '<option value="EMPTY" ' + (!item.pfSelected ? 'selected' : '') + '>[Lascia vuoto]</option>';

            var candPfMap = {};
            if (item.pfCandidates && item.pfCandidates.length > 0) {
                colPF += '<optgroup label="Candidati Suggeriti (' + item.pfCandidates.length + ')">';
                item.pfCandidates.forEach(function(c) {
                    candPfMap[c.cod] = true;
                    var isSel = (item.pfSelected && item.pfSelected.cod == c.cod) ? 'selected' : '';
                    colPF += '<option value="' + c.cod + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ') [' + c.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            var sameTeamPf = unassignedPfAll.filter(function(p) {
                if (candPfMap[p.cod]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamPf.length > 0) {
                colPF += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamPf.length + ')">';
                sameTeamPf.forEach(function(p) {
                    candPfMap[p.cod] = true;
                    var isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
                    colPF += '<option value="' + p.cod + '" ' + isSel + '>' + escapeHtml(p.nome) + ' [' + p.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            var otherPf = unassignedPfAll.filter(function(p) { return !candPfMap[p.cod]; });
            if (otherPf.length > 0) {
                colPF += '<optgroup label="Altri Non Assegnati (' + otherPf.length + ')">';
                otherPf.forEach(function(p) {
                    var isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
                    colPF += '<option value="' + p.cod + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ') [' + p.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            if (item.pfSelected && item.pfSelected.cod && !candPfMap[item.pfSelected.cod]) {
                colPF += '<optgroup label="Attualmente Selezionato">';
                colPF += '<option value="' + item.pfSelected.cod + '" selected>' + escapeHtml(item.pfSelected.nome) + ' [' + item.pfSelected.cod + ']</option>';
                colPF += '</optgroup>';
            }
            colPF += '</select>';
        } else {
            if (item.pfSelected && item.pfSelected.cod) {
                colPF = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem;">' + escapeHtml(item.pfSelected.nome) + '</span> <code style="font-size: 0.72rem; color: #a78bfa; background: rgba(139,92,246,0.15); padding: 1px 4px; border-radius: 4px;">Cod: ' + item.pfSelected.cod + '</code>';
            } else {
                colPF = '<span style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;">Nessuna</span>';
            }
        }

        // 2. Colonna Fantacalcio.it
        var colFC = '';
        if (isEditable) {
            colFC = '<select class="assoc-cand-select" onchange="onAssocSelectFC(' + item.id + ', this.value)">';
            colFC += '<option value="">-- Seleziona FC --</option>';
            colFC += '<option value="EMPTY" ' + (!item.fcSelected ? 'selected' : '') + '>[Lascia vuoto]</option>';

            var candFcMap = {};
            if (item.fcCandidates && item.fcCandidates.length > 0) {
                colFC += '<optgroup label="Candidati Suggeriti (' + item.fcCandidates.length + ')">';
                item.fcCandidates.forEach(function(c) {
                    candFcMap[c.id] = true;
                    var isSel = (item.fcSelected && item.fcSelected.id == c.id) ? 'selected' : '';
                    colFC += '<option value="' + c.id + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ') [' + c.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            var sameTeamFc = unassignedFcAll.filter(function(p) {
                if (candFcMap[p.id]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamFc.length > 0) {
                colFC += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamFc.length + ')">';
                sameTeamFc.forEach(function(p) {
                    candFcMap[p.id] = true;
                    var isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
                    colFC += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' [' + p.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            var otherFc = unassignedFcAll.filter(function(p) { return !candFcMap[p.id]; });
            if (otherFc.length > 0) {
                colFC += '<optgroup label="Altri Non Assegnati (' + otherFc.length + ')">';
                otherFc.forEach(function(p) {
                    var isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
                    colFC += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ') [' + p.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            if (item.fcSelected && item.fcSelected.id && !candFcMap[item.fcSelected.id]) {
                colFC += '<optgroup label="Attualmente Selezionato">';
                colFC += '<option value="' + item.fcSelected.id + '" selected>' + escapeHtml(item.fcSelected.nome) + ' [' + item.fcSelected.id + ']</option>';
                colFC += '</optgroup>';
            }
            colFC += '</select>';
        } else {
            if (item.fcSelected && item.fcSelected.id) {
                colFC = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem;">' + escapeHtml(item.fcSelected.nome) + '</span> <code style="font-size: 0.72rem; color: #38bdf8; background: rgba(2,132,199,0.15); padding: 1px 4px; border-radius: 4px;">ID: ' + item.fcSelected.id + '</code>';
            } else {
                colFC = '<span style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;">Nessuna</span>';
            }
        }

        // 3. Colonna Fantapazz.com
        var colFP = '';
        if (isEditable) {
            colFP = '<select class="assoc-cand-select" onchange="onAssocSelectFP(' + item.id + ', this.value)">';
            colFP += '<option value="">-- Seleziona FP --</option>';
            colFP += '<option value="EMPTY" ' + (!item.fpSelected ? 'selected' : '') + '>[Lascia vuoto]</option>';

            var candFpMap = {};
            if (item.fpCandidates && item.fpCandidates.length > 0) {
                colFP += '<optgroup label="Candidati Suggeriti (' + item.fpCandidates.length + ')">';
                item.fpCandidates.forEach(function(c) {
                    candFpMap[c.nome.toUpperCase().trim()] = true;
                    var isSel = (item.fpSelected && item.fpSelected.nome.toUpperCase().trim() === c.nome.toUpperCase().trim()) ? 'selected' : '';
                    colFP += '<option value="' + escapeHtml(c.nome) + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ')</option>';
                });
                colFP += '</optgroup>';
            }

            var sameTeamFp = unassignedFpAll.filter(function(p) {
                if (candFpMap[(p.nome || '').toUpperCase().trim()]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamFp.length > 0) {
                colFP += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamFp.length + ')">';
                sameTeamFp.forEach(function(p) {
                    candFpMap[(p.nome || '').toUpperCase().trim()] = true;
                    var isSel = (item.fpSelected && item.fpSelected.nome.toUpperCase().trim() === p.nome.toUpperCase().trim()) ? 'selected' : '';
                    colFP += '<option value="' + escapeHtml(p.nome) + '" ' + isSel + '>' + escapeHtml(p.nome) + '</option>';
                });
                colFP += '</optgroup>';
            }

            var otherFp = unassignedFpAll.filter(function(p) { return !candFpMap[(p.nome || '').toUpperCase().trim()]; });
            if (otherFp.length > 0) {
                colFP += '<optgroup label="Altri Non Assegnati (' + otherFp.length + ')">';
                otherFp.forEach(function(p) {
                    var isSel = (item.fpSelected && item.fpSelected.nome.toUpperCase().trim() === p.nome.toUpperCase().trim()) ? 'selected' : '';
                    colFP += '<option value="' + escapeHtml(p.nome) + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ')</option>';
                });
                colFP += '</optgroup>';
            }

            if (item.fpSelected && item.fpSelected.nome && !candFpMap[item.fpSelected.nome.toUpperCase().trim()]) {
                colFP += '<optgroup label="Attualmente Selezionato">';
                colFP += '<option value="' + escapeHtml(item.fpSelected.nome) + '" selected>' + escapeHtml(item.fpSelected.nome) + '</option>';
                colFP += '</optgroup>';
            }
            colFP += '</select>';
        } else {
            if (item.fpSelected && item.fpSelected.nome) {
                colFP = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem;">' + escapeHtml(item.fpSelected.nome) + '</span>';
            } else {
                colFP = '<span style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;">Nessuna</span>';
            }
        }

        // 4. Colonna FantaMaster
        var colFM = '';
        if (isEditable) {
            colFM = '<select class="assoc-cand-select" onchange="onAssocSelectFM(' + item.id + ', this.value)">';
            colFM += '<option value="">-- Seleziona FM --</option>';
            colFM += '<option value="EMPTY" ' + (!item.fmSelected ? 'selected' : '') + '>[Lascia vuoto]</option>';

            var candFmMap = {};
            if (item.fmCandidates && item.fmCandidates.length > 0) {
                colFM += '<optgroup label="Candidati Suggeriti (' + item.fmCandidates.length + ')">';
                item.fmCandidates.forEach(function(c) {
                    candFmMap[c.id] = true;
                    var isSel = (item.fmSelected && item.fmSelected.id == c.id) ? 'selected' : '';
                    colFM += '<option value="' + c.id + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ') [' + c.id + ']</option>';
                });
                colFM += '</optgroup>';
            }

            var sameTeamFm = unassignedFmAll.filter(function(p) {
                if (candFmMap[p.id]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamFm.length > 0) {
                colFM += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamFm.length + ')">';
                sameTeamFm.forEach(function(p) {
                    candFmMap[p.id] = true;
                    var isSel = (item.fmSelected && item.fmSelected.id == p.id) ? 'selected' : '';
                    colFM += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' [' + p.id + ']</option>';
                });
                colFM += '</optgroup>';
            }

            var otherFm = unassignedFmAll.filter(function(p) { return !candFmMap[p.id]; });
            if (otherFm.length > 0) {
                colFM += '<optgroup label="Altri Non Assegnati (' + otherFm.length + ')">';
                otherFm.forEach(function(p) {
                    var isSel = (item.fmSelected && item.fmSelected.id == p.id) ? 'selected' : '';
                    colFM += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ') [' + p.id + ']</option>';
                });
                colFM += '</optgroup>';
            }

            if (item.fmSelected && item.fmSelected.id && !candFmMap[item.fmSelected.id]) {
                colFM += '<optgroup label="Attualmente Selezionato">';
                colFM += '<option value="' + item.fmSelected.id + '" selected>' + escapeHtml(item.fmSelected.nome) + ' [' + item.fmSelected.id + ']</option>';
                colFM += '</optgroup>';
            }
            colFM += '</select>';
        } else {
            if (item.fmSelected && (item.fmSelected.id || item.fmSelected.nome)) {
                var fmLabel = item.fmSelected.nome ? escapeHtml(item.fmSelected.nome) : '';
                var fmIdPart = item.fmSelected.id ? ' <code style="font-size: 0.72rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 1px 4px; border-radius: 4px;">ID: ' + item.fmSelected.id + '</code>' : '';
                colFM = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem;">' + fmLabel + '</span>' + fmIdPart;
            } else {
                colFM = '<span style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;">Nessuna</span>';
            }
        }

        // Azione (Conferma o Modifica)
        var colAction = '';
        if (isEditable) {
            colAction = '<button type="button" class="calc-btn-action calc-btn-save" style="padding: 5px 10px; font-size: 0.76rem;" onclick="confirmRowAssoc(' + item.id + ')"><span>Salva</span></button>';
        } else {
            colAction = '<button type="button" class="calc-btn-action calc-btn-cancel" style="padding: 5px 8px; font-size: 0.74rem;" onclick="toggleEditRow(' + item.id + ')"><span>✏️</span></button>';
        }

        var squadraStr = item.squadraFCM ? ' (' + escapeHtml(item.squadraFCM) + ')' : '';

        html += '<tr class="' + rowClass + '">';
        html += '<td style="text-align: center;"><span class="badge-role badge-role-' + item.ruoloFCM + '">' + item.ruoloFCM + '</span></td>';
        html += '<td><strong style="font-size: 0.86rem; color: var(--text-primary); display: block;">' + escapeHtml(item.nomeFCM) + '<span style="font-weight: 600; color: var(--text-secondary); font-size: 0.82rem; margin-left: 4px;">' + squadraStr + '</span></strong><span style="font-size: 0.72rem; color: var(--text-muted); font-family: ui-monospace, monospace;">Cod: ' + item.codiceFCM + ' • ID: ' + item.idFCM + '</span></td>';
        html += '<td>' + colPF + '</td>';
        html += '<td>' + colFC + '</td>';
        html += '<td>' + colFP + '</td>';
        html += '<td>' + colFM + '</td>';
        html += '<td style="text-align: center;">' + colAction + '</td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function onAssocSelectPF(id, val) {
    var item = assocState.items[id];
    if (!item) return;
    if (val === 'EMPTY' || val === '') {
        item.pfSelected = null;
    } else {
        var cand = (item.pfCandidates || []).find(function(c) { return c.cod == val; });
        if (!cand) {
            cand = (assocState.unassignedPF || []).find(function(c) { return c.cod == val; });
        }
        if (cand) {
            item.pfSelected = { cod: cand.cod, nome: cand.nome, squadra: cand.squadra, ruolo: cand.ruolo };
        } else {
            item.pfSelected = { cod: val, nome: '' };
        }
    }
}

function onAssocSelectFC(id, val) {
    var item = assocState.items[id];
    if (!item) return;
    if (val === 'EMPTY' || val === '') {
        item.fcSelected = null;
    } else {
        var cand = (item.fcCandidates || []).find(function(c) { return c.id == val; });
        if (!cand) {
            cand = (assocState.unassignedFC || []).find(function(c) { return c.id == val; });
        }
        if (cand) {
            item.fcSelected = { id: cand.id, nome: cand.nome, squadra: cand.squadra, ruolo: cand.ruolo };
        } else {
            item.fcSelected = { id: val, nome: '' };
        }
    }
}

function onAssocSelectFP(id, val) {
    var item = assocState.items[id];
    if (!item) return;
    if (val === 'EMPTY' || val === '') {
        item.fpSelected = null;
    } else {
        var cleanVal = val.toUpperCase().trim();
        var cand = (item.fpCandidates || []).find(function(c) { return (c.nome || '').toUpperCase().trim() === cleanVal; });
        if (!cand) {
            cand = (assocState.unassignedFP || []).find(function(c) { return (c.nome || '').toUpperCase().trim() === cleanVal; });
        }
        if (cand) {
            item.fpSelected = { nome: cand.nome, squadra: cand.squadra, ruolo: cand.ruolo };
        } else {
            item.fpSelected = { nome: val, squadra: item.squadraFCM, ruolo: item.ruoloFCM };
        }
    }
}

function onAssocSelectFM(id, val) {
    var item = assocState.items[id];
    if (!item) return;
    if (val === 'EMPTY' || val === '') {
        item.fmSelected = null;
    } else {
        var cand = (item.fmCandidates || []).find(function(c) { return c.id == val; });
        if (!cand) {
            cand = (assocState.unassignedFM || []).find(function(c) { return c.id == val; });
        }
        if (cand) {
            item.fmSelected = { id: cand.id, nome: cand.nome, squadra: cand.squadra, ruolo: cand.ruolo };
        } else {
            item.fmSelected = { id: val, nome: '' };
        }
    }
}

function confirmRowAssoc(id) {
    var item = assocState.items[id];
    if (!item) return;

    item.isManualEdit = false;
    item.conflict = false;

    // Controllo unicità su Pianetafanta
    if (item.pfSelected && item.pfSelected.cod) {
        var pfCod = item.pfSelected.cod;
        assocState.items.forEach(function(other) {
            if (other.id !== item.id && other.pfSelected && other.pfSelected.cod == pfCod) {
                other.status = 'dubbio';
                other.isDoubtful = true;
                other.conflict = true;
                showToast("⚠️ Attenzione: il codice PF " + pfCod + " era associato a " + other.nomeFCM + ". Assegnazione aggiornata!", "warning");
            }
        });
    }

    // Controllo unicità su Fantacalcio.it
    if (item.fcSelected && item.fcSelected.id) {
        var fcId = item.fcSelected.id;
        assocState.items.forEach(function(other) {
            if (other.id !== item.id && other.fcSelected && other.fcSelected.id == fcId) {
                other.status = 'dubbio';
                other.isDoubtful = true;
                other.conflict = true;
                showToast("⚠️ Attenzione: l'ID FC " + fcId + " era associato a " + other.nomeFCM + ". Assegnazione aggiornata!", "warning");
            }
        });
    }

    // Controllo unicità su FantaMaster
    if (item.fmSelected && item.fmSelected.id) {
        var fmId = item.fmSelected.id;
        assocState.items.forEach(function(other) {
            if (other.id !== item.id && other.fmSelected && other.fmSelected.id == fmId) {
                other.status = 'dubbio';
                other.isDoubtful = true;
                other.conflict = true;
                showToast("⚠️ Attenzione: l'ID FM " + fmId + " era associato a " + other.nomeFCM + ". Assegnazione aggiornata!", "warning");
            }
        });
    }

    // Controllo unicità su Fantapazz
    if (item.fpSelected && item.fpSelected.nome) {
        var fpName = item.fpSelected.nome.toUpperCase().trim();
        assocState.items.forEach(function(other) {
            if (other.id !== item.id && other.fpSelected && (other.fpSelected.nome || '').toUpperCase().trim() === fpName) {
                other.status = 'dubbio';
                other.isDoubtful = true;
                other.conflict = true;
                showToast("⚠️ Attenzione: il nome FP " + item.fpSelected.nome + " era associato a " + other.nomeFCM + ". Assegnazione aggiornata!", "warning");
            }
        });
    }

    if (item.pfSelected || item.fcSelected || item.fpSelected || item.fmSelected) {
        item.status = 'confermato';
        item.isDoubtful = false;
    } else {
        item.status = 'non_trovato';
        item.isDoubtful = false;
    }

    updateAssocStats();
    renderAssocTable();
    showToast('Associazione per ' + item.nomeFCM + ' aggiornata!', 'success');
}

function toggleEditRow(id) {
    var item = assocState.items[id];
    if (!item) return;
    item.isManualEdit = !item.isManualEdit;
    renderAssocTable();
}

function saveAssociazioni() {
    var items = assocState.items || [];

    // Validazione preventiva unicità su PF, FC, FM
    var seenPf = {};
    var seenFc = {};
    var seenFm = {};
    var seenFp = {};
    var duplicates = [];

    items.forEach(function(item) {
        if (item.pfSelected && item.pfSelected.cod) {
            var c = item.pfSelected.cod;
            if (seenPf[c]) {
                duplicates.push('Pianetafanta Cod ' + c + ' assegnato sia a ' + seenPf[c] + ' sia a ' + item.nomeFCM);
            }
            seenPf[c] = item.nomeFCM;
        }
        if (item.fcSelected && item.fcSelected.id) {
            var c = item.fcSelected.id;
            if (seenFc[c]) {
                duplicates.push('Fantacalcio.it ID ' + c + ' assegnato sia a ' + seenFc[c] + ' sia a ' + item.nomeFCM);
            }
            seenFc[c] = item.nomeFCM;
        }
        if (item.fmSelected && item.fmSelected.id) {
            var c = item.fmSelected.id;
            if (seenFm[c]) {
                duplicates.push('FantaMaster ID ' + c + ' assegnato sia a ' + seenFm[c] + ' sia a ' + item.nomeFCM);
            }
            seenFm[c] = item.nomeFCM;
        }
        if (item.fpSelected && item.fpSelected.nome) {
            var n = item.fpSelected.nome.toUpperCase().trim();
            if (seenFp[n]) {
                duplicates.push('Fantapazz nome "' + item.fpSelected.nome + '" assegnato sia a ' + seenFp[n] + ' sia a ' + item.nomeFCM);
            }
            seenFp[n] = item.nomeFCM;
        }
    });

    if (duplicates.length > 0) {
        alert("Errore salvataggio: rilevate assegnazioni duplicate:\n- " + duplicates.join("\n- ") + "\n\nIl matching dev'essere univoco 1-a-1. Risolvi i duplicati per continuare.");
        setAssocFilter('dubbio');
        return;
    }

    var doubtfulCount = items.filter(function(i) { return i.status === 'dubbio'; }).length;
    if (doubtfulCount > 0) {
        if (!confirm('Attenzione: sono ancora presenti ' + doubtfulCount + ' casi da risolvere non confermati. Vuoi procedere comunque con il salvataggio?')) {
            setAssocFilter('dubbio');
            return;
        }
    }

    var btn = document.getElementById('btnSaveAssoc');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    // Prepara payload unificato a 10 colonne (senza codFP)
    var payload = items.map(function(item) {
        return {
            codPF: item.pfSelected ? item.pfSelected.cod : '',
            nomePF: item.pfSelected ? item.pfSelected.nome : '',
            codFC: item.fcSelected ? item.fcSelected.id : '',
            nomeFC: item.fcSelected ? item.fcSelected.nome : '',
            codFCM: item.codiceFCM,
            nomeFCM: item.nomeFCM,
            idFCM: item.idFCM,
            nomeFP: item.fpSelected ? item.fpSelected.nome : '',
            codFM: item.fmSelected ? item.fmSelected.id : '',
            nomeFM: item.fmSelected ? item.fmSelected.nome : ''
        };
    });

    var fd = new FormData();
    fd.append('assoc_action', 'save_associations');
    fd.append('associations_json', JSON.stringify(payload));

    fetch('impostazioni.php', {
        method: 'POST',
        headers: getAssocCsrfHeaders(),
        body: fd
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        btn.disabled = false;
        btn.innerHTML = oldText;

        if (!data.success) {
            showToast('Errore durante il salvataggio: ' + (data.error || 'Errore sconosciuto'), 'error');
            return;
        }

        showToast(data.message + ' (' + data.count + ' record)', 'success');
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = oldText;
        showToast('Errore di comunicazione: ' + err.message, 'error');
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
</script>
