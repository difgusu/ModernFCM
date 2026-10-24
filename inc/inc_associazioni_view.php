<?php
/**
 * View & UI per il tab Gestione Associazioni Live
 * File: inc_associazioni_view.php
 */
?>

<!-- BANNER INTESTAZIONE MODULO ASSOCIAZIONI -->
<div class="assoc-header-banner">
    <div>
        <h3 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>🔗</span>
            <span>Gestione e Aggiornamento Associazioni Live</span>
        </h3>
        <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            Associa i giocatori attivi in <strong>Serie A</strong> (<code>arrGiocatoriA</code>) con le rispettive quotazioni e codici di <strong>Pianetafanta.it</strong> e <strong>Fantacalcio.it</strong> per aggiornare <code>liveVU_associazioni.php</code>.
        </p>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="calc-btn-action" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px;" onclick="loadCurrentAssocState()">
            <span>👁️ Ispeziona Stato Attuale</span>
        </button>
    </div>
</div>

<!-- SEZIONE CARICAMENTO FILE EXCEL -->
<div class="assoc-upload-grid">
    <!-- Box Pianetafanta -->
    <div class="assoc-upload-box" id="boxUploadPF">
        <div class="assoc-upload-icon">🌐</div>
        <div class="assoc-upload-title">1. Quotazioni Pianetafanta.it</div>
        <div class="assoc-upload-subtitle">Template: <code>quotazioni-giornataX.xlsx</code></div>
        <label class="assoc-file-label" id="labelPF">
            <input type="file" id="fileExcelPF" accept=".xlsx" onchange="onAssocFileSelected('pf', this)">
            <span id="btnLabelPF">📁 Seleziona File (.xlsx)</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNamePF">Nessun file selezionato</div>
    </div>

    <!-- Box Fantacalcio.it -->
    <div class="assoc-upload-box" id="boxUploadFC">
        <div class="assoc-upload-icon">⚽</div>
        <div class="assoc-upload-title">2. Quotazioni Fantacalcio.it</div>
        <div class="assoc-upload-subtitle">Template: <code>Quotazioni_Fantacalcio_Stagione_XXXX.xlsx</code></div>
        <label class="assoc-file-label" id="labelFC">
            <input type="file" id="fileExcelFC" accept=".xlsx" onchange="onAssocFileSelected('fc', this)">
            <span id="btnLabelFC">📁 Seleziona File (.xlsx)</span>
        </label>
        <div class="assoc-file-selected-name" id="fileNameFC">Nessun file selezionato</div>
    </div>
</div>

<!-- PULSANTE ANALISI ED ELABORAZIONE -->
<div style="text-align: center; margin: 18px 0 24px 0;">
    <button type="button" id="btnAnalyzeAssoc" class="calc-btn-action calc-btn-save" style="padding: 12px 28px; font-size: 0.95rem; border-radius: 12px; cursor: pointer;" onclick="analyzeAssocFiles()">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Analizza ed Elabora Associazioni</span>
    </button>
</div>

<!-- WORKSPACE RISULTATI (Visibile dopo analisi o ispezione stato) -->
<div id="assocWorkspace" style="display: none;">
    <!-- METRICHE STATISTICHE -->
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
            <input type="text" id="assocSearchInput" class="assoc-search-input" placeholder="🔍 Filtra nome o squadra..." oninput="onAssocSearchInput()">
        </div>
    </div>

    <!-- TABELLA INTERATTIVA -->
    <div class="assoc-table-wrap">
        <table class="assoc-table" id="assocTable">
            <thead>
                <tr>
                    <th style="width: 44px; text-align: center;">R</th>
                    <th>Giocatore FCM</th>
                    <th>Squadra Serie A</th>
                    <th style="width: 140px; text-align: center;">Stato Associazione</th>
                    <th style="min-width: 250px;">Pianetafanta.it (Cod / Nome)</th>
                    <th style="min-width: 250px;">Fantacalcio.it (Id / Nome)</th>
                    <th style="width: 90px; text-align: center;">Azione</th>
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
                <span>Salva liveVU_associazioni.php</span>
            </button>
        </div>
    </div>
</div>

<script type="text/javascript">
/**
 * Controller JavaScript per la gestione delle associazioni live
 */
var assocState = {
    items: [],           // Tutti gli elementi attivi
    filteredItems: [],   // Elementi filtrati correnti
    activeFilter: 'all', // 'all', 'dubbio', 'confermato', 'non_trovato'
    searchTerm: '',
    unassignedPF: [],
    unassignedFC: [],
    selectedFilePF: null,
    selectedFileFC: null
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

function onAssocFileSelected(source, input) {
    var file = input.files && input.files[0] ? input.files[0] : null;
    if (source === 'pf') {
        assocState.selectedFilePF = file;
        var nameEl = document.getElementById('fileNamePF');
        var boxEl = document.getElementById('boxUploadPF');
        if (file) {
            nameEl.textContent = '📄 ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
            boxEl.classList.add('has-file');
        } else {
            nameEl.textContent = 'Nessun file selezionato';
            boxEl.classList.remove('has-file');
        }
    } else {
        assocState.selectedFileFC = file;
        var nameEl = document.getElementById('fileNameFC');
        var boxEl = document.getElementById('boxUploadFC');
        if (file) {
            nameEl.textContent = '📄 ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
            boxEl.classList.add('has-file');
        } else {
            nameEl.textContent = 'Nessun file selezionato';
            boxEl.classList.remove('has-file');
        }
    }
}

function analyzeAssocFiles() {
    var filePF = document.getElementById('fileExcelPF').files[0];
    var fileFC = document.getElementById('fileExcelFC').files[0];

    if (!filePF || !fileFC) {
        showToast('Seleziona entrambi i file Excel (Pianetafanta e Fantacalcio.it) per procedere.', 'error');
        return;
    }

    var btn = document.getElementById('btnAnalyzeAssoc');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Elaborazione e matching in corso...</span>';

    var fd = new FormData();
    fd.append('assoc_action', 'analyze_files');
    fd.append('excel_pf', filePF);
    fd.append('excel_fc', fileFC);

    fetch('impostazioni_calcolo.php', {
        method: 'POST',
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

        assocState.unassignedPF = data.unassigned_pf || [];
        assocState.unassignedFC = data.unassigned_fc || [];

        // Normalizza elementi per la tabella
        assocState.items = (data.all || []).map(function(item, idx) {
            return {
                id: idx,
                codiceFCM: item.player.codice,
                idFCM: item.player.id,
                nomeFCM: item.player.nome,
                squadraFCM: item.player.squadra,
                ruoloFCM: item.player.ruolo,
                status: item.status, // 'dubbio', 'confermato', 'non_trovato'
                isDoubtful: item.is_doubtful,
                conflict: !!(item.pf_conflict || item.fc_conflict),

                // Pianetafanta
                pfSelected: item.pf_selected ? { cod: item.pf_selected.cod, nome: item.pf_selected.nome } : null,
                pfCandidates: item.pf_candidates || [],

                // Fantacalcio.it
                fcSelected: item.fc_selected ? { id: item.fc_selected.id, nome: item.fc_selected.nome } : null,
                fcCandidates: item.fc_candidates || [],

                isManualEdit: false
            };
        });

        // Mostra workspace e aggiorna statistiche
        document.getElementById('assocWorkspace').style.display = 'block';
        updateAssocStats();
        
        // Se ci sono casi dubbi, imposta di default il filtro sui casi dubbi!
        var doubtfulCount = assocState.items.filter(function(i) { return i.status === 'dubbio'; }).length;
        if (doubtfulCount > 0) {
            setAssocFilter('dubbio');
            showToast('Analisi completata: trovati ' + doubtfulCount + ' casi dubbi o conflitti da risolvere.', 'info');
        } else {
            setAssocFilter('all');
            showToast('Analisi completata con successo! Tutte le corrispondenze sono univoche.', 'success');
        }

        document.getElementById('assocWorkspace').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = oldText;
        showToast('Errore di comunicazione con il server: ' + err.message, 'error');
    });
}

function loadCurrentAssocState() {
    showToast('Caricamento stato attuale da liveVU_associazioni.php...', 'info');

    fetch('impostazioni_calcolo.php?assoc_action=get_current_state')
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data.success) {
            showToast('Errore: ' + (data.error || 'Impossibile leggere il file'), 'error');
            return;
        }

        assocState.unassignedPF = data.unassigned_pf || [];
        assocState.unassignedFC = data.unassigned_fc || [];

        assocState.items = (data.items || []).map(function(item, idx) {
            var hasPf = (item.codPF !== '' && item.codPF !== 0);
            var hasFc = (item.codFC !== '' && item.codFC !== 0);
            var isConf = (hasPf || hasFc);

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
                pfSelected: hasPf ? { cod: item.codPF, nome: item.nomePF } : null,
                pfCandidates: [],
                fcSelected: hasFc ? { id: item.codFC, nome: item.nomeFC } : null,
                fcCandidates: [],
                isManualEdit: false
            };
        });

        document.getElementById('assocWorkspace').style.display = 'block';
        updateAssocStats();
        setAssocFilter('all');
        showToast('Stato attuale caricato: ' + data.total_fcm + ' giocatori Serie A rilevati (' + data.associated_count + ' associati).', 'success');
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

    assocState.items.forEach(function(item) {
        if (item.status === 'dubbio') doubtful++;
        else if (item.status === 'confermato') confirmed++;
        else notFound++;
    });

    document.getElementById('statTotalFcm').textContent = total;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statDoubtful').textContent = doubtful;
    document.getElementById('statNotFound').textContent = notFound;

    document.getElementById('countPillAll').textContent = total;
    document.getElementById('countPillDoubtful').textContent = doubtful;
    document.getElementById('countPillConfirmed').textContent = confirmed;
    document.getElementById('countPillNotFound').textContent = notFound;

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

    var html = '';
    visible.forEach(function(item) {
        var rowClass = (item.status === 'dubbio') ? 'row-doubtful' : '';

        // Status badge
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

        // Colonna Pianetafanta
        var colPF = '';
        if (isEditable) {
            colPF = '<select class="assoc-cand-select" onchange="onAssocSelectPF(' + item.id + ', this.value)">';
            colPF += '<option value="">-- Seleziona Pianetafanta --</option>';
            colPF += '<option value="EMPTY" ' + (!item.pfSelected ? 'selected' : '') + '>[Nessuna corrispondenza / Lascia vuoto]</option>';

            var candPfMap = {};
            // 1. Suggeriti
            if (item.pfCandidates && item.pfCandidates.length > 0) {
                colPF += '<optgroup label="Candidati Suggeriti (' + item.pfCandidates.length + ')">';
                item.pfCandidates.forEach(function(c) {
                    candPfMap[c.cod] = true;
                    var isSel = (item.pfSelected && item.pfSelected.cod == c.cod) ? 'selected' : '';
                    colPF += '<option value="' + c.cod + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ' - ' + (c.ruolo || '') + ') [Cod: ' + c.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            // 2. Non assegnati stessa squadra
            var sameTeamPf = unassignedPfAll.filter(function(p) {
                if (candPfMap[p.cod]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamPf.length > 0) {
                colPF += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamPf.length + ')">';
                sameTeamPf.forEach(function(p) {
                    candPfMap[p.cod] = true;
                    var isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
                    colPF += '<option value="' + p.cod + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ' - ' + (p.ruolo || '') + ') [Cod: ' + p.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            // 3. Altri non assegnati
            var otherPf = unassignedPfAll.filter(function(p) { return !candPfMap[p.cod]; });
            if (otherPf.length > 0) {
                colPF += '<optgroup label="Altri Non Assegnati (' + otherPf.length + ')">';
                otherPf.forEach(function(p) {
                    var isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
                    colPF += '<option value="' + p.cod + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ' - ' + (p.ruolo || '') + ') [Cod: ' + p.cod + ']</option>';
                });
                colPF += '</optgroup>';
            }

            if (item.pfSelected && item.pfSelected.cod && !candPfMap[item.pfSelected.cod]) {
                colPF += '<optgroup label="Attualmente Selezionato">';
                colPF += '<option value="' + item.pfSelected.cod + '" selected>' + escapeHtml(item.pfSelected.nome) + ' [Cod: ' + item.pfSelected.cod + ']</option>';
                colPF += '</optgroup>';
            }

            colPF += '</select>';
        } else {
            if (item.pfSelected && item.pfSelected.cod) {
                colPF = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">' + escapeHtml(item.pfSelected.nome) + '</span> <code style="font-size: 0.74rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 4px;">Cod: ' + item.pfSelected.cod + '</code>';
            } else {
                colPF = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
            }
        }

        // Colonna Fantacalcio.it
        var colFC = '';
        if (isEditable) {
            colFC = '<select class="assoc-cand-select" onchange="onAssocSelectFC(' + item.id + ', this.value)">';
            colFC += '<option value="">-- Seleziona Fantacalcio.it --</option>';
            colFC += '<option value="EMPTY" ' + (!item.fcSelected ? 'selected' : '') + '>[Nessuna corrispondenza / Lascia vuoto]</option>';

            var candFcMap = {};
            // 1. Suggeriti
            if (item.fcCandidates && item.fcCandidates.length > 0) {
                colFC += '<optgroup label="Candidati Suggeriti (' + item.fcCandidates.length + ')">';
                item.fcCandidates.forEach(function(c) {
                    candFcMap[c.id] = true;
                    var isSel = (item.fcSelected && item.fcSelected.id == c.id) ? 'selected' : '';
                    colFC += '<option value="' + c.id + '" ' + isSel + '>' + escapeHtml(c.nome) + ' (' + escapeHtml(c.squadra) + ' - ' + (c.ruolo || '') + ') [Id: ' + c.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            // 2. Non assegnati stessa squadra
            var sameTeamFc = unassignedFcAll.filter(function(p) {
                if (candFcMap[p.id]) return false;
                return normAssocTeam(p.squadra) === normAssocTeam(item.squadraFCM);
            });
            if (sameTeamFc.length > 0) {
                colFC += '<optgroup label="Non Assegnati - ' + escapeHtml(item.squadraFCM) + ' (' + sameTeamFc.length + ')">';
                sameTeamFc.forEach(function(p) {
                    candFcMap[p.id] = true;
                    var isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
                    colFC += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ' - ' + (p.ruolo || '') + ') [Id: ' + p.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            // 3. Altri non assegnati
            var otherFc = unassignedFcAll.filter(function(p) { return !candFcMap[p.id]; });
            if (otherFc.length > 0) {
                colFC += '<optgroup label="Altri Non Assegnati (' + otherFc.length + ')">';
                otherFc.forEach(function(p) {
                    var isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
                    colFC += '<option value="' + p.id + '" ' + isSel + '>' + escapeHtml(p.nome) + ' (' + escapeHtml(p.squadra) + ' - ' + (p.ruolo || '') + ') [Id: ' + p.id + ']</option>';
                });
                colFC += '</optgroup>';
            }

            if (item.fcSelected && item.fcSelected.id && !candFcMap[item.fcSelected.id]) {
                colFC += '<optgroup label="Attualmente Selezionato">';
                colFC += '<option value="' + item.fcSelected.id + '" selected>' + escapeHtml(item.fcSelected.nome) + ' [Id: ' + item.fcSelected.id + ']</option>';
                colFC += '</optgroup>';
            }

            colFC += '</select>';
        } else {
            if (item.fcSelected && item.fcSelected.id) {
                colFC = '<span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">' + escapeHtml(item.fcSelected.nome) + '</span> <code style="font-size: 0.74rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 4px;">Id: ' + item.fcSelected.id + '</code>';
            } else {
                colFC = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
            }
        }

        // Azione (Conferma o Modifica)
        var colAction = '';
        if (isEditable) {
            colAction = '<button type="button" class="calc-btn-action calc-btn-save" style="padding: 5px 10px; font-size: 0.76rem;" onclick="confirmRowAssoc(' + item.id + ')"><span>Salva</span></button>';
        } else {
            colAction = '<button type="button" class="calc-btn-action calc-btn-cancel" style="padding: 5px 8px; font-size: 0.74rem;" onclick="toggleEditRow(' + item.id + ')"><span>✏️</span></button>';
        }

        html += '<tr class="' + rowClass + '">';
        html += '<td style="text-align: center;"><span class="badge-role badge-role-' + item.ruoloFCM + '">' + item.ruoloFCM + '</span></td>';
        html += '<td><strong style="font-size: 0.88rem; color: var(--text-primary); display: block;">' + escapeHtml(item.nomeFCM) + '</strong><span style="font-size: 0.74rem; color: var(--text-muted); font-family: ui-monospace, monospace;">Cod: ' + item.codiceFCM + ' • ID: ' + item.idFCM + '</span></td>';
        html += '<td><span style="font-weight: 600; color: var(--text-secondary);">' + escapeHtml(item.squadraFCM) + '</span></td>';
        html += '<td style="text-align: center;">' + statusBadge + '</td>';
        html += '<td>' + colPF + '</td>';
        html += '<td>' + colFC + '</td>';
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
            item.pfSelected = { cod: cand.cod, nome: cand.nome };
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
            item.fcSelected = { id: cand.id, nome: cand.nome };
        } else {
            item.fcSelected = { id: val, nome: '' };
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

    if (item.pfSelected || item.fcSelected) {
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

    // Validazione preventiva unicità su PF e FC
    var seenPf = {};
    var seenFc = {};
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

    // Prepara payload
    var payload = items.map(function(item) {
        return {
            codPF: item.pfSelected ? item.pfSelected.cod : '',
            nomePF: item.pfSelected ? item.pfSelected.nome : '',
            codFC: item.fcSelected ? item.fcSelected.id : '',
            nomeFC: item.fcSelected ? item.fcSelected.nome : '',
            codFCM: item.codiceFCM,
            nomeFCM: item.nomeFCM,
            idFCM: item.idFCM
        };
    });

    var fd = new FormData();
    fd.append('assoc_action', 'save_associations');
    fd.append('associations_json', JSON.stringify(payload));

    fetch('impostazioni_calcolo.php', {
        method: 'POST',
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
