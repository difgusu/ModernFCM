/**
 * RECORD & PRIMATI STORICI VIEW
 * Record partite, serie positive/negative, strisce vincenti e punteggi estremi
 * ModernFCM
 */

const recordStoriciView = {
  currentTipo: '001',
  currentTeamId: 0,    // 0 = Tutte
  currentCompId: 0,    // 0 = Tutte
  currentStadio: 'T',  // 'T' = Tutti, 'C' = Casa, 'F' = Trasferta, 'N' = Neutro
  currentLimit: 5,
  currentContinuaSePari: 'S',

  tipoOptions: [
    { id: '001', label: '⚽ Partite con più gol nei tempi regolamentari', desc: 'Incontri con il maggior numero complessivo di gol segnati nei 90 minuti' },
    { id: '002', label: '🎯 Partite con più scarto nei tempi regolamentari', desc: 'Incontri vinti con la maggior differenza reti' },
    { id: '003', label: '🛡️ Serie Positive (All-Time)', desc: 'Strisce di imbattibilità più lunghe senza sconfitte attraverso più stagioni' },
    { id: '004', label: '🛡️ Serie Positive (per Stagione)', desc: 'Strisce di imbattibilità più lunghe all\'interno della stessa stagione' },
    { id: '005', label: '🌧️ Serie Negative (All-Time)', desc: 'Strisce più lunghe senza vittorie (pareggi o sconfitte) attraverso più stagioni' },
    { id: '006', label: '🌧️ Serie Negative (per Stagione)', desc: 'Strisce più lunghe senza vittorie all\'interno della medesima stagione' },
    { id: '007', label: '🏆 Vittorie Consecutive (All-Time)', desc: 'Maggior numero di vittorie consecutive ottenute' },
    { id: '008', label: '🏆 Vittorie Consecutive (per Stagione)', desc: 'Maggior numero di vittorie consecutive nella stessa stagione' },
    { id: '009', label: '🤝 Pareggi Consecutivi (All-Time)', desc: 'Maggior numero di pareggi consecutivi registrati' },
    { id: '010', label: '🤝 Pareggi Consecutivi (per Stagione)', desc: 'Maggior numero di pareggi consecutivi nella stessa stagione' },
    { id: '011', label: '💔 Sconfitte Consecutive (All-Time)', desc: 'Maggior numero di sconfitte consecutive subite' },
    { id: '012', label: '💔 Sconfitte Consecutive (per Stagione)', desc: 'Maggior numero di sconfitte consecutive nella stessa stagione' },
    { id: '013', label: '🚀 Maggior Numero Punti', desc: 'Punteggi fantacalcio più alti realizzati da una fantasquadra in una singola partita' },
    { id: '014', label: '📉 Minor Numero Punti', desc: 'Punteggi fantacalcio più bassi registrati da una fantasquadra in una singola partita' }
  ],

  formatDate(dStr) {
    if (!dStr) return '-';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const DOW = ['', 'Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const MOY = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const dow = DOW[d.getDay() + 1] || '';
    const moy = MOY[d.getMonth() + 1] || '';
    return `${dow} ${d.getDate()} ${moy} ${d.getFullYear()}`;
  },

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('tipo')) this.currentTipo = params.get('tipo');
      if (params.has('fsq') || params.has('team')) {
        const fId = parseInt(params.get('fsq') || params.get('team'), 10);
        if (!isNaN(fId)) this.currentTeamId = fId;
      }
      if (params.has('comp')) {
        const cId = parseInt(params.get('comp'), 10);
        if (!isNaN(cId)) this.currentCompId = cId;
      }
      if (params.has('stadio')) this.currentStadio = params.get('stadio');
      if (params.has('limit')) {
        const l = parseInt(params.get('limit'), 10);
        if (!isNaN(l)) this.currentLimit = l;
      }
      if (params.has('pari')) this.currentContinuaSePari = params.get('pari');
    }

    container.innerHTML = `
      <style>
        @media (max-width: 768px) {
          .record-desktop-view { display: none !important; }
          .record-mobile-view { display: flex !important; flex-direction: column; gap: 10px; }
          .record-toolbar { padding: 12px !important; }
          .record-toolbar-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .record-toolbar-footer { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
          .record-toolbar-controls { justify-content: space-between !important; width: 100% !important; }
        }
        @media (min-width: 769px) {
          .record-desktop-view { display: block !important; }
          .record-mobile-view { display: none !important; }
        }
      </style>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
                <path d="M7 4h10v5a5 5 0 0 1-10 0z"></path>
                <path d="M7 6H4.5a2.5 2.5 0 0 0 0 5H7"></path>
                <path d="M17 6h2.5a2.5 2.5 0 0 1 0 5H17"></path>
                <path d="m12 6.8.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z"></path>
              </svg>
              Record Storici
            </div>
            <div class="card-subtitle">Archivio storico dei record: match spettacolari, punteggi estremi e grandi serie</div>
          </div>
        </div>

        <div id="recordStoriciContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento primati e statistiche storiche...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#recordStoriciContent');
    await this.renderView(subContainer);
  },

  async renderView(subContainer) {
    const confData = await fcmDataLoader.loadConfronti();
    if (!confData || !confData.getRecordStorici) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati record non disponibili.</div>`;
      return;
    }

    const currentTipoObj = this.tipoOptions.find(t => t.id === this.currentTipo) || this.tipoOptions[0];
    const recordData = confData.getRecordStorici(
      this.currentTipo,
      this.currentTeamId,
      this.currentCompId,
      this.currentStadio,
      this.currentLimit,
      this.currentContinuaSePari
    );

    // Risoluzione link risultati partite (stessa logica di confrontiStoriciView)
    if (!recordData.isStreak && recordData.results && recordData.results.length > 0) {
      await fcmDataLoader.resolveMatchesLinks(recordData.results);
    }

    subContainer.innerHTML = `
      <!-- Toolbar Filtri Record -->
      <div class="record-toolbar" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:18px;margin-bottom:20px;">
        <div class="record-toolbar-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin-bottom:14px;">
          <!-- Tipo Record -->
          <div>
            <label for="recTipoSelect" style="display:block;font-size:0.75rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;margin-bottom:5px;">
              Tipo di Record:
            </label>
            <select id="recTipoSelect" class="form-select" style="width:100%;font-weight:700;font-size:0.85rem;">
              ${this.tipoOptions.map(t => `
                <option value="${t.id}" ${t.id === this.currentTipo ? 'selected' : ''}>
                  ${t.label}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Fantasquadra -->
          <div>
            <label for="recTeamSelect" style="display:block;font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:5px;">
              Fantasquadra:
            </label>
            <select id="recTeamSelect" class="form-select" style="width:100%;font-size:0.85rem;font-weight:600;">
              <option value="0" ${this.currentTeamId === 0 ? 'selected' : ''}>-- Tutte le Fantasquadre --</option>
              ${confData.teams.map(t => `
                <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>

          <!-- Competizione -->
          <div>
            <label for="recCompSelect" style="display:block;font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:5px;">
              Competizione:
            </label>
            <select id="recCompSelect" class="form-select" style="width:100%;font-size:0.85rem;font-weight:600;">
              <option value="0" ${this.currentCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
              ${(confData.competitions || []).map(c => `
                <option value="${c.id}" ${this.currentCompId === c.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <!-- Stadio -->
          <div>
            <label for="recStadioSelect" style="display:block;font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:5px;">
              Campo / Stadio:
            </label>
            <select id="recStadioSelect" class="form-select" style="width:100%;font-size:0.85rem;font-weight:600;">
              <option value="T" ${this.currentStadio === 'T' ? 'selected' : ''}>Tutti i Campi</option>
              <option value="C" ${this.currentStadio === 'C' ? 'selected' : ''}>Solo in Casa</option>
              <option value="F" ${this.currentStadio === 'F' ? 'selected' : ''}>Solo in Trasferta</option>
              <option value="N" ${this.currentStadio === 'N' ? 'selected' : ''}>Solo Campo Neutro</option>
            </select>
          </div>
        </div>

        <div class="record-toolbar-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:10px;border-top:1px solid var(--border-subtle);">
          <div style="font-size:0.8rem;color:var(--text-secondary);flex:1;min-width:240px;">
            Descrizione: <strong style="color:var(--text-primary);">${currentTipoObj.desc}</strong>
          </div>

          <div class="record-toolbar-controls" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <label for="recLimitSelect" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">Righe:</label>
              <select id="recLimitSelect" class="form-select" style="padding:4px 8px;font-size:0.8rem;">
                <option value="5" ${this.currentLimit === 5 ? 'selected' : ''}>5</option>
                <option value="10" ${this.currentLimit === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${this.currentLimit === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${this.currentLimit === 50 ? 'selected' : ''}>50</option>
              </select>
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <label for="recPariSelect" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">Continua se pari:</label>
              <select id="recPariSelect" class="form-select" style="padding:4px 8px;font-size:0.8rem;">
                <option value="S" ${this.currentContinuaSePari === 'S' ? 'selected' : ''}>Sì (inclusi pari merito)</option>
                <option value="N" ${this.currentContinuaSePari === 'N' ? 'selected' : ''}>No (taglio esatto)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabella Record Risultati -->
      <div id="recordTableContainer">
        ${recordData.isStreak
        ? this.renderStreakTable(recordData.results)
        : this.renderMatchTable(recordData.results, this.currentTipo)
      }
      </div>
    `;

    // Event listeners
    subContainer.querySelector('#recTipoSelect').addEventListener('change', (e) => {
      this.currentTipo = e.target.value;
      this.renderView(subContainer);
    });

    subContainer.querySelector('#recTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.renderView(subContainer);
    });

    subContainer.querySelector('#recCompSelect').addEventListener('change', (e) => {
      this.currentCompId = parseInt(e.target.value, 10);
      this.renderView(subContainer);
    });

    subContainer.querySelector('#recStadioSelect').addEventListener('change', (e) => {
      this.currentStadio = e.target.value;
      this.renderView(subContainer);
    });

    subContainer.querySelector('#recLimitSelect').addEventListener('change', (e) => {
      this.currentLimit = parseInt(e.target.value, 10);
      this.renderView(subContainer);
    });

    subContainer.querySelector('#recPariSelect').addEventListener('change', (e) => {
      this.currentContinuaSePari = e.target.value;
      this.renderView(subContainer);
    });
  },

  renderMatchTable(list, tipo) {
    if (!list || list.length === 0) {
      return `
        <div class="text-center" style="padding:30px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessun incontro trovato per i filtri selezionati.
        </div>
      `;
    }

    const isPoints = tipo === '013' || tipo === '014';
    const scoreHeader = isPoints ? 'Punti Record' : (tipo === '002' ? 'Scarto Gol' : 'Totale Gol');

    return `
      <div class="card" style="margin:0;padding:18px;">
        <!-- Visualizzazione Desktop: Tabella Classica -->
        <div class="record-desktop-view table-responsive" style="margin:0;">
          <table class="modern-table" style="font-size:0.82rem;">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th style="text-align:right;min-width:180px;">Squadra Casa</th>
                <th class="text-center" style="width:110px;">Punteggio</th>
                <th style="text-align:left;min-width:180px;">Squadra Fuori</th>
                <th class="text-center font-bold" style="color:var(--accent-gold);min-width:110px;">${scoreHeader}</th>
                <th class="text-center">Stagione</th>
                <th>Competizione</th>
                <th class="text-center">Giornata</th>
                <th style="min-width:120px;">Data</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((m, idx) => `
                <tr>
                  <td class="text-center font-bold" style="color:var(--text-muted);">${idx + 1}</td>
                  <td style="text-align:right;font-weight:700;">
                    <span style="display:inline-flex;align-items:center;gap:8px;justify-content:flex-end;">
                      <a href="#confronti?fsq=${m.homeId}" style="color:var(--text-primary);text-decoration:none;" title="Apri confronti storici">
                        ${m.homeTeam}
                      </a>
                      <img src="img/sq/${encodeURI(m.homeTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.homeTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:20px;width:auto;vertical-align:middle;" alt="" />
                    </span>
                  </td>
                  <td class="text-center font-bold" style="font-size:0.95rem;letter-spacing:0.04em;">
                    <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link result-link" style="text-decoration:none;color:inherit;display:inline-block;" title="Vedi tabellino incontro">
                      ${m.displayScore}
                    </a>
                  </td>
                  <td style="text-align:left;font-weight:700;">
                    <span style="display:inline-flex;align-items:center;gap:8px;">
                      <img src="img/sq/${encodeURI(m.awayTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.awayTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:20px;width:auto;vertical-align:middle;" alt="" />
                      <a href="#confronti?fsq=${m.awayId}" style="color:var(--text-primary);text-decoration:none;" title="Apri confronti storici">
                        ${m.awayTeam}
                      </a>
                    </span>
                  </td>
                  <td class="text-center font-bold" style="font-size:1.05rem;color:var(--accent-gold);">
                    ${m.scoreVal}
                  </td>
                  <td class="text-center font-bold">
                    ${m.season}ª
                  </td>
                  <td>
                    <span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.75rem;">
                      ${m.compName}
                    </span>
                  </td>
                  <td class="text-center">
                    <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" style="text-decoration:none;color:inherit;font-weight:700;" title="Vedi risultati ${m.matchday}ª giornata">
                      ${m.matchday}ª
                    </a>
                  </td>
                  <td style="font-size:0.75rem;color:var(--text-muted);">
                    ${this.formatDate(m.date || m.rawDate)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Visualizzazione Mobile: Card Responsive Senza Scorrimento Orizzontale -->
        <div class="record-mobile-view">
          ${list.map((m, idx) => `
            <div class="match-card" style="padding:12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
              <!-- Riga Intestazione Card: Posizione, Competizione, Stagione e Data -->
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;gap:6px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-weight:800;color:var(--accent-gold);background:var(--bg-surface);border:1px solid var(--border-subtle);padding:2px 7px;border-radius:var(--radius-sm);font-size:0.75rem;">
                    #${idx + 1}
                  </span>
                  <span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.68rem;padding:2px 6px;">
                    ${m.compName}
                  </span>
                  <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" style="text-decoration:none;color:inherit;font-weight:700;display:inline-flex;align-items:center;gap:3px;" title="Vedi risultati ${m.matchday}ª giornata">
                    <span>${m.season}ª &bull; ${m.matchday}ª Giorn.</span>
                    <span style="font-size:0.68rem;opacity:0.7;">↗</span>
                  </a>
                </div>
                <span style="font-size:0.7rem;color:var(--text-muted);">${this.formatDate(m.date || m.rawDate)}</span>
              </div>

              <!-- Riga Squadre e Risultato Centrato con Link -->
              <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:8px;">
                <!-- Casa -->
                <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                  <img src="img/sq/${encodeURI(m.homeTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.homeTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;flex-shrink:0;" alt="" />
                  <a href="#confronti?fsq=${m.homeId}" style="color:var(--text-primary);text-decoration:none;font-size:0.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.homeTeam}">
                    ${m.homeTeam}
                  </a>
                </div>

                <!-- Pillola Risultato Centrata con Link -->
                <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} style="text-decoration:none;color:inherit;display:block;" title="Vedi tabellino incontro">
                  <div style="text-align:center;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:4px 10px;min-width:65px;cursor:pointer;transition:border-color 0.15s, background 0.15s;">
                    <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary);line-height:1.1;letter-spacing:0.03em;">
                      ${m.displayScore}
                    </div>
                  </div>
                </a>

                <!-- Trasferta -->
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;text-align:right;">
                  <a href="#confronti?fsq=${m.awayId}" style="color:var(--text-primary);text-decoration:none;font-size:0.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.awayTeam}">
                    ${m.awayTeam}
                  </a>
                  <img src="img/sq/${encodeURI(m.awayTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.awayTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;flex-shrink:0;" alt="" />
                </div>
              </div>

              <!-- Footer Card: Valore Record in Evidenza -->
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.75rem;">
                <span style="color:var(--text-secondary);font-weight:600;">${scoreHeader}:</span>
                <span style="font-weight:800;font-size:0.95rem;color:var(--accent-gold);">${m.scoreVal}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderStreakTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="text-center" style="padding:30px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessuna serie registrata per i filtri selezionati.
        </div>
      `;
    }

    return `
      <div class="card" style="margin:0;padding:18px;">
        <!-- Visualizzazione Desktop: Tabella Classica -->
        <div class="record-desktop-view table-responsive" style="margin:0;">
          <table class="modern-table" style="font-size:0.82rem;">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th style="text-align:left;min-width:200px;">Fantasquadra</th>
                <th class="text-center font-bold" style="color:var(--accent-gold);min-width:110px;">Totale Partite</th>
                <th class="text-center" style="min-width:120px;">Dettaglio Parziali</th>
                <th style="min-width:160px;">Inizio Serie</th>
                <th style="min-width:160px;">Fine Serie</th>
                <th class="text-center" style="min-width:90px;">Stato</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((s, idx) => `
                <tr>
                  <td class="text-center font-bold" style="color:var(--text-muted);">${idx + 1}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <img src="img/sq/${encodeURI(s.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(s.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;vertical-align:middle;flex-shrink:0;" alt="" />
                      <a href="#confronti?fsq=${s.teamId}" style="color:var(--text-primary);text-decoration:none;font-weight:700;" title="Apri confronti storici">
                        ${s.teamName}
                      </a>
                    </div>
                  </td>
                  <td class="text-center font-bold" style="font-size:1.15rem;color:var(--accent-gold);">
                    ${s.totale}
                  </td>
                  <td class="text-center" style="font-size:0.8rem;">
                    ${s.parziale1 > 0 ? `<span style="color:var(--accent-emerald);font-weight:700;">${s.parziale1}V</span> ` : ''}
                    ${s.parziale2 > 0 ? `<span style="color:var(--accent-cyan);font-weight:700;">${s.parziale2}N</span>` : ''}
                  </td>
                  <td>
                    <div style="font-weight:700;">Stagione ${s.stagioneI} &bull; ${s.giornataI}ª Giorn.</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${this.formatDate(s.dataI)}</div>
                  </td>
                  <td>
                    ${s.chiusa
        ? `
                          <div style="font-weight:700;">Stagione ${s.stagioneF} &bull; ${s.giornataF}ª Giorn.</div>
                          <div style="font-size:0.72rem;color:var(--text-muted);">${this.formatDate(s.dataF)}</div>
                        `
        : `<span style="color:var(--accent-emerald);font-weight:800;font-size:0.82rem;">In corso</span>`
      }
                  </td>
                  <td class="text-center">
                    ${s.chiusa
        ? `<span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.72rem;color:var(--text-muted);">Chiusa</span>`
        : `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-size:0.72rem;font-weight:800;border:1px solid rgba(16,185,129,0.3);">Attiva</span>`
      }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Visualizzazione Mobile: Card Responsive Senza Scorrimento Orizzontale -->
        <div class="record-mobile-view">
          ${list.map((s, idx) => `
            <div class="match-card" style="padding:12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
              <!-- Riga Header: Posizione, Squadra e Badge Stato -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <span style="font-weight:800;color:var(--accent-gold);background:var(--bg-surface);border:1px solid var(--border-subtle);padding:2px 7px;border-radius:var(--radius-sm);font-size:0.75rem;flex-shrink:0;">
                    #${idx + 1}
                  </span>
                  <img src="img/sq/${encodeURI(s.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(s.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:24px;width:auto;flex-shrink:0;" alt="" />
                  <a href="#confronti?fsq=${s.teamId}" style="color:var(--text-primary);text-decoration:none;font-weight:800;font-size:0.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="Apri confronti storici">
                    ${s.teamName}
                  </a>
                </div>
                ${s.chiusa
          ? `<span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.7rem;color:var(--text-muted);flex-shrink:0;">Chiusa</span>`
          : `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-size:0.7rem;font-weight:800;border:1px solid rgba(16,185,129,0.3);flex-shrink:0;">Attiva</span>`
        }
              </div>

              <!-- Statistiche Totale e Parziali -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:6px 10px;text-align:center;">
                  <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Totale Partite</div>
                  <div style="font-size:1.15rem;font-weight:800;color:var(--accent-gold);margin-top:2px;">${s.totale}</div>
                </div>
                <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:6px 10px;text-align:center;">
                  <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Parziali</div>
                  <div style="font-size:0.95rem;font-weight:800;margin-top:4px;">
                    ${s.parziale1 > 0 ? `<span style="color:var(--accent-emerald);">${s.parziale1}V</span> ` : ''}
                    ${s.parziale2 > 0 ? `<span style="color:var(--accent-cyan);">${s.parziale2}N</span>` : ''}
                    ${s.parziale1 === 0 && s.parziale2 === 0 ? '<span style="color:var(--text-muted);">-</span>' : ''}
                  </div>
                </div>
              </div>

              <!-- Durata Serie: Inizio e Fine -->
              <div style="display:flex;justify-content:space-between;font-size:0.72rem;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-secondary);">
                <div>
                  <span style="color:var(--text-muted);font-weight:600;">Inizio:</span> <strong>${s.stagioneI}ª (${s.giornataI}ª g.)</strong>
                  <div style="font-size:0.68rem;color:var(--text-muted);">${this.formatDate(s.dataI)}</div>
                </div>
                <div style="text-align:right;">
                  <span style="color:var(--text-muted);font-weight:600;">Fine:</span> 
                  ${s.chiusa
          ? `<strong>${s.stagioneF}ª (${s.giornataF}ª g.)</strong><div style="font-size:0.68rem;color:var(--text-muted);">${this.formatDate(s.dataF)}</div>`
          : `<strong style="color:var(--accent-emerald);">In corso</strong>`
        }
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.recordStoriciView = recordStoriciView;
}
