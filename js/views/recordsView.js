/**
 * RECORDS VIEW (Records di Lega FCM)
 * Legge e visualizza dinamicamente fantam/records.htm (o in fallback records/records.htm) generato dal plugin FCM
 * ModernFCM
 */

const recordsView = {
  currentTab: 'all', // 'all' oppure nome competizione (es. 'Lega', 'Coppa di Lega', ecc.)
  data: null,

  async render(container) {
    // Carica dati fantasquadre se non ancora presenti (per loghi e stemmi)
    if (typeof arrFantasquadre === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }

    // Mostra skeleton di caricamento iniziale se necessario
    if (!container.querySelector('#recordsWrapper')) {
      container.innerHTML = `
        <div class="card" style="padding: 48px 24px; text-align: center; color: var(--text-muted, #94a3b8);">
          <div class="records-spin-loader" style="margin: 0 auto 14px; width: 32px; height: 32px; border: 3px solid rgba(2,132,199,0.2); border-top-color: var(--accent-primary, #0284c7); border-radius: 50%; animation: recSpin 0.7s linear infinite;"></div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary, #f1f5f9);">Caricamento Records di Lega FCM...</div>
          <div style="font-size: 0.8rem; margin-top: 5px;">Elaborazione primati storici e stagionali delle competizioni</div>
        </div>
        <style>@keyframes recSpin { to { transform: rotate(360deg); } }</style>
      `;
    }

    // Fetch del file records.htm generato dal plugin FCM (fantam/ con fallback su records/)
    let htmlText = null;
    const candidatePaths = ['fantam/records.htm', 'records/records.htm'];

    for (const path of candidatePaths) {
      try {
        const resp = await fetch(path, { cache: 'no-store' });
        if (resp.ok) {
          htmlText = await resp.text();
          break;
        }
      } catch (err) {
        // Fallback al percorso successivo in caso di errore
      }
    }

    if (!htmlText) {
      console.error('Errore caricamento records.htm da fantam/ o records/');
      container.innerHTML = `
        <div class="card" style="padding: 36px 20px; text-align: center;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary, #f1f5f9); margin-bottom: 6px;">
            Impossibile caricare i Records di Lega
          </div>
          <div style="color: var(--text-muted, #94a3b8); font-size: 0.85rem; max-width: 500px; margin: 0 auto 16px;">
            Il file <code>records.htm</code> non &egrave; stato trovato nelle cartelle <code>fantam/</code> o <code>records/</code>. Assicurati che il plugin FCM abbia pubblicato la pagina dei record.
          </div>
          <button id="recBtnRetry" class="records-tab-btn active" style="margin: 0 auto;">Riprova</button>
        </div>
      `;
      const retryBtn = container.querySelector('#recBtnRetry');
      if (retryBtn) retryBtn.addEventListener('click', () => this.render(container));
      return;
    }

    try {
      this.data = this._parseRecordsHtml(htmlText);
    } catch (parseErr) {
      console.error('Errore durante il parsing di records.htm:', parseErr);
    }

    this._renderShell(container);
    this._bindEvents(container);
    this._renderResults(container);
  },

  /**
   * Parser robusto del file HTML generato da FCM
   */
  _parseRecordsHtml(html) {
    let aggiornato = '';
    const dMatch = html.match(/Aggiornati al\s*<b>(.*?)<\/b>/i);
    if (dMatch) {
      // Se contiene script document.lastModified, prendiamo la data corrente o testo
      aggiornato = dMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim();
    }

    const competitions = [];
    const compBlocks = html.split(/<h1 class=['\"]?competizione['\"]?>/i);

    for (let i = 1; i < compBlocks.length; i++) {
      const block = compBlocks[i];
      const compName = block.substring(0, block.indexOf('</h1>')).trim();
      const tablePart = block.substring(block.indexOf('<table'));
      const rows = tablePart.split(/<tr[^>]*>/i);

      let currentPair = null;
      const categories = [];
      let totalEntriesCount = 0;

      for (let j = 1; j < rows.length; j++) {
        const row = rows[j].split(/<\/tr>/i)[0];

        // Riga di intestazione delle categorie (comptit / comptitneg)
        if (row.includes('comptit') || row.includes('comptitneg')) {
          const posMatch = row.match(/class=['\"]?comptit['\"]?[^>]*>([^<]+)<\/td>/i);
          const negMatch = row.match(/class=['\"]?comptitneg['\"]?[^>]*>([^<]+)<\/td>/i);
          currentPair = {
            posTitle: posMatch ? posMatch[1].trim() : '',
            negTitle: negMatch ? negMatch[1].trim() : '',
            posList: [],
            negList: []
          };
          categories.push(currentPair);
          continue;
        }

        if (!currentPair) continue;

        // Estrazione record positivo (compnum + compsquadra)
        if (row.includes('compsquadra')) {
          const numMatch = row.match(/class=['\"]?compnum['\"]?[^>]*>([^<]+)<\/td>/i);
          const teamMatch = row.match(/class=['\"]?compsquadra['\"]?[^>]*>([^<]+)<\/td>/i);
          if (numMatch && teamMatch) {
            currentPair.posList.push({
              value: numMatch[1].trim(),
              team: teamMatch[1].trim()
            });
            totalEntriesCount++;
          }
        }

        // Estrazione record negativo (compsquadraneg + compnum)
        if (row.includes('compsquadraneg')) {
          const teamNegMatch = row.match(/class=['\"]?compsquadraneg['\"]?[^>]*>([^<]+)<\/td>/i);
          const afterNeg = row.substring(row.indexOf('compsquadraneg'));
          const numNegMatch = afterNeg.match(/class=['\"]?compnum['\"]?[^>]*>([^<]+)<\/td>/i);
          if (teamNegMatch && numNegMatch) {
            currentPair.negList.push({
              team: teamNegMatch[1].trim(),
              value: numNegMatch[1].trim()
            });
            totalEntriesCount++;
          }
        }
      }

      competitions.push({
        name: compName,
        categories,
        hasRecords: totalEntriesCount > 0,
        totalEntriesCount
      });
    }

    return {
      aggiornato,
      competitions
    };
  },

  _renderShell(container) {
    const d = this.data;
    const comps = d.competitions || [];

    const tabButtons = comps.map(c => {
      const active = this.currentTab === c.name ? 'active' : '';
      const countBadge = c.hasRecords
        ? `<span class="rec-tab-count">${c.totalEntriesCount}</span>`
        : `<span class="rec-tab-count rec-count-empty">0</span>`;
      return `
        <button class="records-tab-btn ${active}" data-tab="${this._esc(c.name)}">
          <span>${this._esc(c.name)}</span>
          ${countBadge}
        </button>
      `;
    }).join('');

    const allActive = this.currentTab === 'all' ? 'active' : '';

    container.innerHTML = `
      <div class="card" id="recordsWrapper">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary,#0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="7"></circle>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
              </svg>
              Records di Lega
            </div>
            <div class="card-subtitle">Primati e statistiche stagionali per competizione generati dal plugin FCM</div>
          </div>
          ${d.aggiornato ? `
            <div class="records-badge-date" title="Data ultimo aggiornamento dati">
              &#128197; ${this._esc(d.aggiornato)}
            </div>
          ` : ''}
        </div>

        <!-- Selettore Competizioni a Tab -->
        <div class="records-tab-bar">
          <button class="records-tab-btn ${allActive}" data-tab="all">
            <span>Tutte le Competizioni</span>
          </button>
          ${tabButtons}
        </div>

        <!-- Contenitore Risultati Dinamici -->
        <div id="recordsResultsContainer"></div>
      </div>

      <style>
        .records-tab-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .records-tab-btn {
          padding: 8px 16px;
          border-radius: var(--radius-md, 8px);
          border: 1px solid var(--border-subtle, #334155);
          background: var(--bg-surface-elevated, #1e293b);
          color: var(--text-muted, #94a3b8);
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .records-tab-btn:hover {
          border-color: var(--accent-primary, #0284c7);
          color: var(--text-primary, #f1f5f9);
        }
        .records-tab-btn.active {
          background: var(--accent-primary, #0284c7);
          border-color: var(--accent-primary, #0284c7);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
        }
        .rec-tab-count {
          font-size: 0.72rem;
          background: rgba(255, 255, 255, 0.15);
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 800;
        }
        .rec-tab-count.rec-count-empty {
          opacity: 0.6;
        }
        .records-badge-date {
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--text-muted, #94a3b8);
          background: var(--bg-surface-elevated, #1e293b);
          border: 1px solid var(--border-subtle, #334155);
          padding: 4px 10px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        /* Sezioni Competizione */
        .records-comp-section {
          margin-bottom: 32px;
        }
        .records-comp-section:last-child {
          margin-bottom: 10px;
        }
        .records-comp-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: var(--bg-surface-elevated, #1e293b);
          border: 1px solid var(--border-subtle, #334155);
          border-radius: var(--radius-md, 8px);
          font-weight: 800;
          font-size: 1rem;
          color: var(--text-primary, #f1f5f9);
          margin-bottom: 14px;
          letter-spacing: 0.02em;
        }
        .records-comp-header .comp-tag {
          font-size: 0.72rem;
          text-transform: uppercase;
          background: rgba(2, 132, 199, 0.15);
          color: var(--accent-primary, #0284c7);
          border: 1px solid rgba(2, 132, 199, 0.3);
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: auto;
          font-weight: 700;
        }

        /* Griglia delle Card di Record */
        .records-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        /* Card Coppia Record (Positivo vs Negativo) */
        .rec-pair-card {
          background: var(--bg-surface, #0f172a);
          border: 1px solid var(--border-subtle, #334155);
          border-radius: var(--radius-md, 8px);
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rec-pair-card:hover {
          border-color: var(--border-focus, #475569);
        }

        .rec-pair-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 90px;
        }

        /* Colonna Record Positivo */
        .rec-col-pos {
          padding: 12px 16px;
          border-right: 1px solid var(--border-subtle, #334155);
          background: rgba(16, 185, 129, 0.03);
          display: flex;
          flex-direction: column;
        }
        .rec-header-pos {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 800;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
        }

        /* Colonna Record Negativo */
        .rec-col-neg {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.03);
          display: flex;
          flex-direction: column;
        }
        .rec-header-neg {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 800;
          color: #ef4444;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
        }

        /* Lista Voci di Squadre per Record */
        .rec-teams-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
        }
        .rec-entry-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: var(--bg-surface-elevated, #1e293b);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
          border-radius: var(--radius-sm, 6px);
          padding: 6px 10px;
        }
        .rec-team-info {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow: hidden;
        }
        .rec-fsq-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .rec-team-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rec-badge-val {
          font-size: 0.82rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .rec-badge-pos {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .rec-badge-neg {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .rec-entry-empty {
          color: var(--text-muted, #94a3b8);
          font-size: 0.78rem;
          font-style: italic;
          padding: 8px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Box Competizione Vuota / Nessun Record */
        .records-empty-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 28px 20px;
          background: var(--bg-surface, #0f172a);
          border: 1px dashed var(--border-subtle, #334155);
          border-radius: var(--radius-md, 8px);
          color: var(--text-muted, #94a3b8);
          font-size: 0.88rem;
          font-weight: 600;
          text-align: center;
        }
        .records-empty-box svg {
          color: var(--accent-primary, #0284c7);
          flex-shrink: 0;
        }

        /* Ottimizzazione Mobile (<768px) */
        @media (max-width: 768px) {
          .rec-pair-body {
            grid-template-columns: 1fr;
          }
          .rec-col-pos {
            border-right: none;
            border-bottom: 1px solid var(--border-subtle, #334155);
          }
          .records-tab-btn {
            padding: 6px 12px;
            font-size: 0.78rem;
          }
          .records-comp-header {
            font-size: 0.92rem;
            padding: 8px 12px;
          }
          .rec-team-name {
            font-size: 0.82rem;
          }
        }
      </style>
    `;
  },

  _bindEvents(container) {
    // Gestione cambio tab competizione
    container.querySelectorAll('.records-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        container.querySelectorAll('.records-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderResults(container);
      });
    });
  },

  _renderResults(container) {
    const resultsEl = container.querySelector('#recordsResultsContainer');
    if (!resultsEl || !this.data) return;

    const comps = this.data.competitions || [];
    const selectedComps = this.currentTab === 'all'
      ? comps
      : comps.filter(c => c.name === this.currentTab);

    if (selectedComps.length === 0) {
      resultsEl.innerHTML = `
        <div class="records-empty-box">
          Nessuna competizione trovata per il filtro selezionato.
        </div>
      `;
      return;
    }

    let html = '';

    for (const comp of selectedComps) {
      const compIcon = this._compIcon(comp.name);

      html += `
        <div class="records-comp-section">
          <div class="records-comp-header">
            <span>${compIcon} ${this._esc(comp.name)}</span>
            <span class="comp-tag">${comp.hasRecords ? `${comp.totalEntriesCount} record registrati` : 'In attesa di gare'}</span>
          </div>
      `;

      // Se la competizione non ha ancora record registrati (es. Coppa di Lega o Supercoppa a inizio stagione)
      if (!comp.hasRecords) {
        html += `
          <div class="records-empty-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div>Nessun record ancora registrato per la competizione <b>${this._esc(comp.name)}</b>.</div>
          </div>
        </div>
        `;
        continue;
      }

      // Griglia dei record della competizione
      html += `<div class="records-grid">`;

      for (const pair of comp.categories) {
        // Se entrambi i lati sono vuoti, salta
        if (pair.posList.length === 0 && pair.negList.length === 0) continue;

        // Render lato positivo
        let posRows = '';
        if (pair.posList.length > 0) {
          posRows = pair.posList.map(item => `
            <div class="rec-entry-row">
              <div class="rec-team-info">
                ${this._fsqLogoHtml(item.team, 22)}
                <span class="rec-team-name">${this._esc(item.team)}</span>
              </div>
              <span class="rec-badge-val rec-badge-pos">${this._esc(item.value)}</span>
            </div>
          `).join('');
        } else {
          posRows = `<div class="rec-entry-empty">Nessun record registrato</div>`;
        }

        // Render lato negativo
        let negRows = '';
        if (pair.negList.length > 0) {
          negRows = pair.negList.map(item => `
            <div class="rec-entry-row">
              <div class="rec-team-info">
                ${this._fsqLogoHtml(item.team, 22)}
                <span class="rec-team-name">${this._esc(item.team)}</span>
              </div>
              <span class="rec-badge-val rec-badge-neg">${this._esc(item.value)}</span>
            </div>
          `).join('');
        } else {
          negRows = `<div class="rec-entry-empty">Nessun record registrato</div>`;
        }

        html += `
          <div class="rec-pair-card">
            <div class="rec-pair-body">
              <!-- Colonna Positiva (Verde) -->
              <div class="rec-col-pos">
                <div class="rec-header-pos">
                  <span>&#127942;</span>
                  <span>${this._esc(pair.posTitle || 'Record Positivo')}</span>
                </div>
                <div class="rec-teams-list">
                  ${posRows}
                </div>
              </div>

              <!-- Colonna Negativa (Rossa) -->
              <div class="rec-col-neg">
                <div class="rec-header-neg">
                  <span>&#128308;</span>
                  <span>${this._esc(pair.negTitle || 'Record Negativo')}</span>
                </div>
                <div class="rec-teams-list">
                  ${negRows}
                </div>
              </div>
            </div>
          </div>
        `;
      }

      html += `</div></div>`; // Chiusura .records-grid e .records-comp-section
    }

    resultsEl.innerHTML = html;
  },

  _fsqLogoHtml(fsqName, size = 22) {
    if (!fsqName) return '';
    // Cerca la squadra in arrFantasquadre per ottenere il nome esatto e il logo
    let logoName = fsqName;
    if (typeof arrFantasquadre !== 'undefined') {
      const f = arrFantasquadre.find(t => t && t.Nome && t.Nome.toLowerCase().trim() === fsqName.toLowerCase().trim());
      if (f && f.Nome) logoName = f.Nome;
    }
    const safe = encodeURIComponent(logoName);
    return `<img class="rec-fsq-logo" src="img/sq/${safe}.png" width="${size}" height="${size}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${safe}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="">`;
  },

  _compIcon(compName) {
    const n = (compName || '').toLowerCase();
    if (n.includes('supercoppa')) return '&#127941;';
    if (n.includes('coppa')) return '&#127942;';
    return '&#9917;';
  },

  _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

if (typeof window !== 'undefined') {
  window.recordsView = recordsView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = recordsView;
}
