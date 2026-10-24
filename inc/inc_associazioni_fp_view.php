<?php
/**
 * Vista HTML e logica JavaScript per il Tab Associazioni Fantapazz (liveFP)
 * Inclusa all'interno di impostazioni_calcolo.php
 */
?>

<!-- BANNER INTESTAZIONE MODULO ASSOCIAZIONI FANTAPAZZ -->
<div class="assoc-header-banner">
    <div>
        <h3 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span style="color: #f59e0b;">⚡</span>
            <span>Gestione Associazioni Live Fantapazz</span>
        </h3>
        <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            Associa i nomi dei giocatori del listone <strong>Fantapazz</strong> (<code>Listone_Fantapazz.csv</code>) con i giocatori attivi in <strong>Serie A</strong> (<code>arrGiocatoriA</code>) per aggiornare <code>js/fcmVotiAssociazioni.js</code>.
        </p>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="calc-btn-action" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px; cursor: pointer;" onclick="loadCurrentFpAssocState()">
            <span>👁️ Ispeziona Stato Attuale</span>
        </button>
    </div>
</div>

<!-- SEZIONE UPLOAD FILE CSV FANTAPAZZ -->
<div style="max-width: 640px; margin: 0 auto 20px auto;">
    <div class="assoc-upload-box" id="boxUploadFP" style="padding: 28px 20px;">
        <div class="assoc-upload-icon" style="color: #f59e0b;">📄</div>
        <div class="assoc-upload-title">Listone Calciatori Fantapazz (.csv)</div>
        <div class="assoc-upload-subtitle">Template: <code>Listone_Fantapazz.csv</code> (delimitatore <code>;</code>)</div>
        <label class="assoc-file-label" id="labelFP" style="margin-top: 10px;">
            <input type="file" id="fileCsvFP" accept=".csv" onchange="onFpFileSelected(this)">
            <span id="btnLabelFP">📁 Seleziona File (.csv)</span>
        </label>
        <div class="assoc-file-selected-name" id="nameFileFP">Nessun file selezionato</div>
    </div>
</div>

<!-- PULSANTE ANALISI -->
<div style="text-align: center; margin-bottom: 24px;">
    <button type="button" id="btnAnalyzeFP" class="calc-btn-action calc-btn-save" style="padding: 12px 28px; font-size: 0.95rem; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);" onclick="analyzeFpFiles()">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Analizza ed Elabora Associazioni Fantapazz</span>
    </button>
</div>

<!-- WORKSPACE RISULTATI MATCHING -->
<div id="fpAssocWorkspace" style="display: none;">

    <!-- STATS CARDS -->
    <div class="assoc-stats-grid">
        <div class="assoc-stat-card">
            <div class="assoc-stat-val" id="fpStatTotalFcm">0</div>
            <div class="assoc-stat-lbl">Giocatori Serie A FCM</div>
        </div>
        <div class="assoc-stat-card stat-card-confirmed">
            <div class="assoc-stat-val" id="fpStatConfirmed">0</div>
            <div class="assoc-stat-lbl">✅ Convalidati / Mappati</div>
        </div>
        <div class="assoc-stat-card stat-card-doubtful">
            <div class="assoc-stat-val" id="fpStatDoubtful">0</div>
            <div class="assoc-stat-lbl">⚠️ Da Risolvere</div>
        </div>
        <div class="assoc-stat-card stat-card-notfound">
            <div class="assoc-stat-val" id="fpStatNotFound">0</div>
            <div class="assoc-stat-lbl">⚪ Non Trovati / Vuoti</div>
        </div>
    </div>

    <!-- TOOLBAR FILTRI -->
    <div class="assoc-toolbar">
        <div class="assoc-filter-pills" id="fpAssocPills">
            <button type="button" class="assoc-pill-btn active" data-filter="all" onclick="filterFpTable('all')">Tutti (<span id="fpCountPillAll">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-doubtful" data-filter="dubbio" onclick="filterFpTable('dubbio')">⚠️ Da Risolvere (<span id="fpCountPillDoubtful">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-confirmed" data-filter="confermato" onclick="filterFpTable('confermato')">✅ Convalidati (<span id="fpCountPillConfirmed">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-notfound" data-filter="non_trovato" onclick="filterFpTable('non_trovato')">⚪ Non Trovati (<span id="fpCountPillNotFound">0</span>)</button>
        </div>
        <div class="assoc-search-wrap">
            <input type="text" id="fpAssocSearchInput" class="assoc-search-input" placeholder="🔍 Filtra nome o squadra..." oninput="onFpSearchChange(this.value)">
        </div>
    </div>

    <!-- TABELLA INTERATTIVA DEI GIOCATORI -->
    <div class="assoc-table-wrap">
        <table class="assoc-table">
            <thead>
                <tr>
                    <th style="width: 44px; text-align: center;">R</th>
                    <th>Giocatore FCM</th>
                    <th>Squadra Serie A</th>
                    <th style="width: 140px; text-align: center;">Stato</th>
                    <th style="min-width: 280px;">Fantapazz (Nome Assegnato)</th>
                    <th style="width: 80px; text-align: center;">Azione</th>
                </tr>
            </thead>
            <tbody id="fpAssocTableBody">
                <!-- Popolato dinamicamente -->
            </tbody>
        </table>
    </div>

    <!-- ACTION BAR INFERIORE (Sticky Bottom) PER SALVATAGGIO -->
    <div class="calc-actions-bar is-sticky-bottom" style="margin-top: 18px;">
        <div class="badge-wrap">
            <span class="badge-status-changes" id="fpAssocSaveStatusBadge">
                <span>⚪</span> In attesa di revisione
            </span>
        </div>
        <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveFpAssoc" onclick="saveFpAssociazioni()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Salva js/fcmVotiAssociazioni.js</span>
            </button>
        </div>
    </div>

</div>

<script>
// Stato globale del modulo Associazioni Fantapazz
var fpAssocState = {
    items: [],
    unassignedPlayers: [],
    filter: 'all',
    search: ''
};

function onFpFileSelected(input) {
    var nameEl = document.getElementById('nameFileFP');
    var box = document.getElementById('boxUploadFP');
    if (input.files && input.files[0]) {
        nameEl.textContent = '📄 ' + input.files[0].name + ' (' + Math.round(input.files[0].size / 1024) + ' KB)';
        box.classList.add('has-file');
    } else {
        nameEl.textContent = 'Nessun file selezionato';
        box.classList.remove('has-file');
    }
}

function fpShowToast(msg, type) {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else {
        console.log('[Toast ' + (type || 'info') + ']: ' + msg);
    }
}

function normFpTeam(t) {
    if (!t) return '';
    t = String(t).toUpperCase().trim();
    if (t.indexOf('VERONA') > -1) return 'VERONA';
    if (t.indexOf('INTER') > -1) return 'INTER';
    if (t.indexOf('JUVE') > -1) return 'JUVENTUS';
    return t;
}

function getUnassignedFpPlayers() {
    var assigned = {};
    (fpAssocState.items || []).forEach(function(item) {
        if (item.fpSelected && item.fpSelected.calciatore) {
            assigned[item.fpSelected.calciatore.toLowerCase().trim()] = true;
        }
    });
    return (fpAssocState.unassignedPlayers || []).filter(function(p) {
        return !assigned[p.calciatore.toLowerCase().trim()];
    });
}

// 1. Ispeziona lo stato attuale da js/fcmVotiAssociazioni.js
function loadCurrentFpAssocState() {
    fpShowToast("Caricamento stato attuale da js/fcmVotiAssociazioni.js...", "info");
    fetch('impostazioni_calcolo.php?fp_assoc_action=get_current_state&_t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.success) {
                alert("Errore: " + (data.error || "Impossibile caricare lo stato attuale"));
                return;
            }

            fpAssocState.unassignedPlayers = data.unassigned_fp || [];
            fpAssocState.items = (data.items || []).map(function(item, idx) {
                var hasFp = (item.fp_name && item.fp_name !== '');
                return {
                    id: idx,
                    codiceFCM: item.player.codice,
                    idFCM: item.player.id,
                    nomeFCM: item.player.nome,
                    squadraFCM: item.player.squadra,
                    ruoloFCM: item.player.ruolo,
                    status: hasFp ? 'confermato' : 'non_trovato',
                    isDoubtful: false,
                    conflict: false,
                    fpSelected: hasFp ? { calciatore: item.fp_name, squadra: item.player.squadra } : null,
                    fpCandidates: [],
                    isManualEdit: false
                };
            });

            document.getElementById('fpAssocWorkspace').style.display = 'block';
            updateFpStats();
            renderFpTable();
            fpShowToast("Caricati " + data.total_fcm + " giocatori Serie A da js/fcmVotiAssociazioni.js.", "success");
        })
        .catch(function(err) {
            alert("Errore di connessione: " + err.message);
        });
}

// 2. Analisi del file CSV Fantapazz caricato
function analyzeFpFiles() {
    var fileFP = document.getElementById('fileCsvFP').files[0];
    if (!fileFP) {
        alert("Seleziona il file CSV Listone Fantapazz per procedere con l'analisi.");
        return;
    }

    var btn = document.getElementById('btnAnalyzeFP');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Elaborazione in corso...</span>';

    var fd = new FormData();
    fd.append('fp_assoc_action', 'analyze_file');
    fd.append('csv_fp', fileFP);

    fetch('impostazioni_calcolo.php', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                alert("Errore analisi: " + (data.error || "Errore sconosciuto"));
                return;
            }

            fpAssocState.unassignedPlayers = data.unassigned_fp || [];
            fpAssocState.items = (data.all || []).map(function(item, idx) {
                return {
                    id: idx,
                    codiceFCM: item.player.codice,
                    idFCM: item.player.id,
                    nomeFCM: item.player.nome,
                    squadraFCM: item.player.squadra,
                    ruoloFCM: item.player.ruolo,
                    status: item.status,
                    isDoubtful: item.is_doubtful,
                    conflict: !!item.conflict,
                    fpSelected: item.fp_selected ? { calciatore: item.fp_selected.calciatore, squadra: item.fp_selected.squadra } : null,
                    fpCandidates: item.fp_candidates || [],
                    isManualEdit: false
                };
            });

            document.getElementById('fpAssocWorkspace').style.display = 'block';
            updateFpStats();

            var doubtfulCount = fpAssocState.items.filter(function(i) { return i.status === 'dubbio'; }).length;
            if (doubtfulCount > 0) {
                filterFpTable('dubbio');
                fpShowToast("Analisi completata: trovati " + doubtfulCount + " casi da verificare (risolvi prima del salvataggio).", "info");
            } else {
                filterFpTable('all');
                fpShowToast("Analisi completata con successo! Nessun conflitto rilevato.", "success");
            }

            document.getElementById('fpAssocWorkspace').scrollIntoView({ behavior: 'smooth' });
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            alert("Errore durante l'elaborazione: " + err.message);
        });
}

// 3. Aggiorna i contatori statistici
function updateFpStats() {
    var items = fpAssocState.items || [];
    var confirmed = 0;
    var doubtful = 0;
    var notFound = 0;

    items.forEach(function(i) {
        if (i.status === 'dubbio') doubtful++;
        else if (i.status === 'confermato') confirmed++;
        else notFound++;
    });

    document.getElementById('fpStatTotalFcm').textContent = items.length;
    document.getElementById('fpStatConfirmed').textContent = confirmed;
    document.getElementById('fpStatDoubtful').textContent = doubtful;
    document.getElementById('fpStatNotFound').textContent = notFound;

    document.getElementById('fpCountPillAll').textContent = items.length;
    document.getElementById('fpCountPillDoubtful').textContent = doubtful;
    document.getElementById('fpCountPillConfirmed').textContent = confirmed;
    document.getElementById('fpCountPillNotFound').textContent = notFound;

    var statusBadge = document.getElementById('fpAssocSaveStatusBadge');
    if (statusBadge) {
        if (doubtful > 0) {
            statusBadge.className = 'badge-status-changes has-changes';
            statusBadge.innerHTML = '<span>⚠️</span> ' + doubtful + ' casi dubbi o conflitti rimanenti';
        } else {
            statusBadge.className = 'badge-status-changes';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = 'var(--accent-emerald, #10b981)';
            statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            statusBadge.innerHTML = '<span>✅</span> Pronto al salvataggio univoco';
        }
    }
}

// 4. Filtro tabella
function filterFpTable(filter) {
    fpAssocState.filter = filter;
    var pills = document.querySelectorAll('#fpAssocPills .assoc-pill-btn');
    pills.forEach(function(p) {
        p.classList.remove('active');
        if (p.getAttribute('data-filter') === filter) {
            p.classList.add('active');
        }
    });
    renderFpTable();
}

function onFpSearchChange(val) {
    fpAssocState.search = val.toLowerCase().trim();
    renderFpTable();
}

// 5. Renderizza tabella interattiva
function renderFpTable() {
    var tbody = document.getElementById('fpAssocTableBody');
    if (!tbody) return;

    var filter = fpAssocState.filter;
    var term = fpAssocState.search;
    var items = fpAssocState.items;

    var visible = items.filter(function(item) {
        if (filter !== 'all' && item.status !== filter) return false;
        if (term !== '') {
            var matchNome = item.nomeFCM.toLowerCase().indexOf(term) > -1;
            var matchSq = item.squadraFCM.toLowerCase().indexOf(term) > -1;
            var matchCod = item.codiceFCM.toString().indexOf(term) > -1;
            if (!matchNome && !matchSq && !matchCod) return false;
        }
        return true;
    });

    if (visible.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 26px; color: var(--text-muted); font-size: 0.88rem;">Nessun giocatore corrisponde ai filtri selezionati.</td></tr>';
        return;
    }

    function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var unassignedAll = getUnassignedFpPlayers();

    var html = '';
    visible.forEach(function(item) {
        var rowClass = (item.status === 'dubbio') ? 'row-doubtful' : '';

        var statusBadge = '';
        if (item.status === 'dubbio') {
            var badgeText = item.conflict ? '⚠️ Conflitto Univocità' : '⚠️ Da Risolvere';
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);">' + badgeText + '</span>';
        } else if (item.status === 'confermato') {
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Confermato</span>';
        } else {
            statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: rgba(148, 163, 184, 0.1); color: #94a3b8;">⚪ Non Trovato</span>';
        }

        var isEditable = (item.status === 'dubbio' || item.status === 'non_trovato' || item.isManualEdit);

        var colFP = '';
        if (isEditable) {
            colFP = '<select class="assoc-cand-select" onchange="onFpCandidateSelected(' + item.id + ', this.value)">';
            colFP += '<option value="">-- Seleziona Calciatore Fantapazz --</option>';
            colFP += '<option value="EMPTY" ' + (!item.fpSelected ? 'selected' : '') + '>[Nessuna corrispondenza / Lascia vuoto]</option>';

            var candNames = {};
            // 1. Candidati suggeriti dall'algoritmo
            if (item.fpCandidates && item.fpCandidates.length > 0) {
                colFP += '<optgroup label="Candidati Suggeriti (' + item.fpCandidates.length + ')">';
                item.fpCandidates.forEach(function(c) {
                    candNames[c.calciatore.toLowerCase().trim()] = true;
                    var isSel = (item.fpSelected && item.fpSelected.calciatore === c.calciatore) ? 'selected' : '';
                    colFP += '<option value="' + esc(c.calciatore) + '" ' + isSel + '>' + esc(c.calciatore) + ' (' + esc(c.squadra) + ' - ' + (c.ruolo || '') + ')</option>';
                });
                colFP += '</optgroup>';
            }

            // 2. Calciatori non ancora assegnati della stessa squadra
            var sameTeamUnassigned = unassignedAll.filter(function(p) {
                if (candNames[p.calciatore.toLowerCase().trim()]) return false;
                return normFpTeam(p.squadra) === normFpTeam(item.squadraFCM);
            });
            if (sameTeamUnassigned.length > 0) {
                colFP += '<optgroup label="Non Assegnati - ' + esc(item.squadraFCM) + ' (' + sameTeamUnassigned.length + ')">';
                sameTeamUnassigned.forEach(function(p) {
                    candNames[p.calciatore.toLowerCase().trim()] = true;
                    var isSel = (item.fpSelected && item.fpSelected.calciatore === p.calciatore) ? 'selected' : '';
                    colFP += '<option value="' + esc(p.calciatore) + '" ' + isSel + '>' + esc(p.calciatore) + ' (' + esc(p.squadra) + ' - ' + (p.ruolo || '') + ')</option>';
                });
                colFP += '</optgroup>';
            }

            // 3. Tutti gli altri calciatori non assegnati
            var otherUnassigned = unassignedAll.filter(function(p) {
                return !candNames[p.calciatore.toLowerCase().trim()];
            });
            if (otherUnassigned.length > 0) {
                colFP += '<optgroup label="Altri Giocatori Non Assegnati (' + otherUnassigned.length + ')">';
                otherUnassigned.forEach(function(p) {
                    var isSel = (item.fpSelected && item.fpSelected.calciatore === p.calciatore) ? 'selected' : '';
                    colFP += '<option value="' + esc(p.calciatore) + '" ' + isSel + '>' + esc(p.calciatore) + ' (' + esc(p.squadra) + ' - ' + (p.ruolo || '') + ')</option>';
                });
                colFP += '</optgroup>';
            }

            // Se il calciatore attualmente selezionato non era presente tra i candidati né tra gli unassigned (es. riassegnazione)
            if (item.fpSelected && item.fpSelected.calciatore && !candNames[item.fpSelected.calciatore.toLowerCase().trim()]) {
                colFP += '<optgroup label="Attualmente Selezionato">';
                colFP += '<option value="' + esc(item.fpSelected.calciatore) + '" selected>' + esc(item.fpSelected.calciatore) + ' (' + esc(item.fpSelected.squadra) + ')</option>';
                colFP += '</optgroup>';
            }

            colFP += '</select>';
        } else {
            if (item.fpSelected && item.fpSelected.calciatore) {
                colFP = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">' + esc(item.fpSelected.calciatore) + '</span>';
                if (item.fpSelected.squadra) {
                    colFP += ' <span style="font-size: 0.75rem; color: var(--text-muted);">(' + esc(item.fpSelected.squadra) + ')</span>';
                }
            } else {
                colFP = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
            }
        }

        var colAction = '';
        if (isEditable) {
            colAction = '<button type="button" class="calc-btn-action calc-btn-save" style="padding: 5px 10px; font-size: 0.76rem;" onclick="confirmFpRow(' + item.id + ')"><span>Salva</span></button>';
        } else {
            colAction = '<button type="button" class="calc-btn-action calc-btn-cancel" style="padding: 5px 8px; font-size: 0.74rem;" title="Modifica associazione" onclick="editFpRow(' + item.id + ')"><span>✏️</span></button>';
        }

        html += '<tr class="' + rowClass + '">';
        html += '<td style="text-align: center;"><span class="badge-role badge-role-' + item.ruoloFCM + '">' + item.ruoloFCM + '</span></td>';
        html += '<td><strong style="font-size: 0.88rem; color: var(--text-primary); display: block;">' + esc(item.nomeFCM) + '</strong><span style="font-size: 0.74rem; color: var(--text-muted); font-family: ui-monospace, monospace;">Cod: ' + item.codiceFCM + ' • ID: ' + item.idFCM + '</span></td>';
        html += '<td><span style="font-weight: 600; color: var(--text-secondary);">' + esc(item.squadraFCM) + '</span></td>';
        html += '<td style="text-align: center;">' + statusBadge + '</td>';
        html += '<td>' + colFP + '</td>';
        html += '<td style="text-align: center;">' + colAction + '</td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function onFpCandidateSelected(idx, val) {
    var item = fpAssocState.items[idx];
    if (!item) return;
    if (val === 'EMPTY' || val === '') {
        item.fpSelected = null;
    } else {
        // Cerca in candidati o unassigned
        var cand = (item.fpCandidates || []).find(function(c) { return c.calciatore === val; });
        if (!cand) {
            cand = (fpAssocState.unassignedPlayers || []).find(function(c) { return c.calciatore === val; });
        }
        if (cand) {
            item.fpSelected = { calciatore: cand.calciatore, squadra: cand.squadra, ruolo: cand.ruolo };
        } else {
            item.fpSelected = { calciatore: val, squadra: '' };
        }
    }
}

function confirmFpRow(idx) {
    var item = fpAssocState.items[idx];
    if (!item) return;
    item.isManualEdit = false;
    item.conflict = false;

    if (item.fpSelected && item.fpSelected.calciatore) {
        item.status = 'confermato';
        item.isDoubtful = false;

        // VERIFICA UNICITÀ RIGOROSA: se questo calciatore era assegnato ad un altro elemento FCM, genera avviso e rendi il duplicato dubbio!
        var selNorm = item.fpSelected.calciatore.toLowerCase().trim();
        fpAssocState.items.forEach(function(other) {
            if (other.id !== item.id && other.fpSelected && other.fpSelected.calciatore.toLowerCase().trim() === selNorm) {
                other.status = 'dubbio';
                other.isDoubtful = true;
                other.conflict = true;
                fpShowToast("⚠️ Attenzione: '" + item.fpSelected.calciatore + "' era assegnato a " + other.nomeFCM + ". Assegnazione spostata su " + item.nomeFCM + "!", "warning");
            }
        });
    } else {
        item.status = 'non_trovato';
        item.isDoubtful = false;
    }

    updateFpStats();
    renderFpTable();
    fpShowToast("Associazione Fantapazz per " + item.nomeFCM + " aggiornata!", "success");
}

function editFpRow(idx) {
    var item = fpAssocState.items[idx];
    if (!item) return;
    item.isManualEdit = !item.isManualEdit;
    renderFpTable();
}

// 6. Salvataggio su js/fcmVotiAssociazioni.js
function saveFpAssociazioni() {
    var items = fpAssocState.items || [];

    // Controllo unicità prima del salvataggio
    var seen = {};
    var hasDuplicates = false;
    var dupDetails = [];
    items.forEach(function(item) {
        if (item.fpSelected && item.fpSelected.calciatore) {
            var k = item.fpSelected.calciatore.toLowerCase().trim();
            if (seen[k]) {
                hasDuplicates = true;
                dupDetails.push(item.fpSelected.calciatore + ' (assegnato sia a ' + seen[k] + ' sia a ' + item.nomeFCM + ')');
            }
            seen[k] = item.nomeFCM;
        }
    });

    if (hasDuplicates) {
        alert("Errore salvataggio: rilevate assegnazioni duplicate del medesimo calciatore Fantapazz:\n- " + dupDetails.join("\n- ") + "\n\nIl match dev'essere univoco 1-a-1. Risolvi i conflitti prima di salvare.");
        filterFpTable('dubbio');
        return;
    }

    var doubtfulCount = items.filter(function(i) { return i.status === 'dubbio'; }).length;
    if (doubtfulCount > 0) {
        if (!confirm("Attenzione: sono ancora presenti " + doubtfulCount + " casi da verificare non risolti. Vuoi procedere comunque con il salvataggio su js/fcmVotiAssociazioni.js?")) {
            filterFpTable('dubbio');
            return;
        }
    }

    var btn = document.getElementById('btnSaveFpAssoc');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    var payload = [];
    items.forEach(function(item) {
        if (item.fpSelected && item.fpSelected.calciatore) {
            payload.push({
                fpNome: item.fpSelected.calciatore,
                fcmNome: item.nomeFCM
            });
        }
    });

    var fd = new FormData();
    fd.append('fp_assoc_action', 'save_associations');
    fd.append('associations_json', JSON.stringify(payload));

    fetch('impostazioni_calcolo.php', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = oldText;

            if (!data.success) {
                alert("Errore salvataggio: " + (data.error || "Errore sconosciuto"));
                return;
            }

            fpShowToast("✅ " + data.message + " (" + data.count + " associazioni salvate)", "success");
        })
        .catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = oldText;
            alert("Errore di connessione: " + err.message);
        });
}
</script>
