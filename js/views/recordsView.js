/**
 * RECORDS VIEW (Records di Lega FCM)
 * Calcola e visualizza dinamicamente i primati e le statistiche stagionali per competizione
 * alimentandosi esclusivamente dai file ufficiali *Dati.js di FCM (senza alcun plugin records.exe esterno)
 * ModernFCM
 */

const recordsView = {
  currentTab: 'all', // 'all' oppure nome competizione (es. 'Lega', 'Coppa di Lega', ecc.)
  data: null,

  async render(container) {
    // 1. Skeleton di caricamento iniziale se necessario
    if (!container.querySelector('#recordsWrapper')) {
      container.innerHTML = (typeof fcmSkeleton !== 'undefined')
        ? fcmSkeleton.recordStorici()
        : `
        <div class="card" style="padding: 48px 24px; text-align: center; color: var(--text-muted, #94a3b8);">
          <div class="records-spin-loader" style="margin: 0 auto 14px; width: 32px; height: 32px; border: 3px solid rgba(2,132,199,0.2); border-top-color: var(--accent-primary, #0284c7); border-radius: 50%; animation: recSpin 0.7s linear infinite;"></div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary, #f1f5f9);">Calcolo Records di Lega FCM in corso...</div>
          <div style="font-size: 0.8rem; margin-top: 5px;">Elaborazione statistica in tempo reale dai dati del campionato</div>
        </div>
        <style>@keyframes recSpin { to { transform: rotate(360deg); } }</style>
      `;
    }

    // 2. Caricamento script FCM necessari se non ancora in memoria
    if (typeof arrCompetizioni === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCompetizioniDati.js');
    }
    if (typeof arrFantasquadre === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }
    if (typeof arrIncontri === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCalendarioDati.js');
    }
    if (typeof aggiornamento === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmLegaDati.js');
    }

    // 3. Elaborazione dei record nativamente dai dati FCM
    try {
      this.data = this._computeRecordsData();
    } catch (err) {
      console.error('Errore durante il calcolo dei records FCM:', err);
      container.innerHTML = `
        <div class="card" style="padding: 36px 20px; text-align: center;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary, #f1f5f9); margin-bottom: 6px;">
            Impossibile calcolare i Records di Lega
          </div>
          <div style="color: var(--text-muted, #94a3b8); font-size: 0.85rem; max-width: 500px; margin: 0 auto 16px;">
            Si &egrave; verificato un errore durante l'elaborazione dei dati del calendario e delle competizioni.
          </div>
          <button id="recBtnRetry" class="records-tab-btn active" style="margin: 0 auto;">Riprova</button>
        </div>
      `;
      const retryBtn = container.querySelector('#recBtnRetry');
      if (retryBtn) retryBtn.addEventListener('click', () => this.render(container));
      return;
    }

    // 4. Render dell'interfaccia utente
    this._renderShell(container);
    this._bindEvents(container);
    this._renderResults(container);
  },

  /**
   * Motore di calcolo puro che estrae i record per competizione da arrIncontri e arrCompetizioni
   */
  _computeRecordsData() {
    let aggiornato = '';
    if (typeof aggiornamento !== 'undefined' && aggiornamento) {
      aggiornato = String(aggiornamento).trim();
    }

    // Mappa fantasquadre per ID
    const teamNameMap = new Map();
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      arrFantasquadre.forEach(f => {
        if (f) teamNameMap.set(f.ID, f.Nome);
      });
    }

    // Elenco competizioni
    const compMap = new Map();
    if (typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni)) {
      arrCompetizioni.forEach(c => {
        if (c && c.ID) compMap.set(c.ID, c);
      });
    }

    const incList = (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) ? arrIncontri : [];

    // Trova le competizioni che hanno almeno un incontro programmato o disputato
    const compIdsWithMatches = new Set();
    incList.forEach(inc => {
      if (inc && inc.IDCompetizione) compIdsWithMatches.add(inc.IDCompetizione);
    });

    // Mantiene l'ordine definito in arrCompetizioni
    const activeCompIds = [];
    compMap.forEach((c, id) => {
      if (compIdsWithMatches.has(id)) activeCompIds.push(id);
    });
    compIdsWithMatches.forEach(id => {
      if (!activeCompIds.includes(id)) activeCompIds.push(id);
    });

    const competitions = [];

    activeCompIds.forEach(idComp => {
      const compObj = compMap.get(idComp);
      const compName = compObj ? compObj.Nome : `Competizione ${idComp}`;

      // Incontri reali giocati della competizione
      // Esclude turni di riposo / bye (dove la squadra è accoppiata contro se stessa o IDFuori === 0)
      const matches = [];
      incList.forEach(inc => {
        if (!inc || inc.IDCompetizione !== idComp || inc.Giocato !== 1) return;
        if (!inc.IDSquadre.Casa || !inc.IDSquadre.Fuori || inc.IDSquadre.Casa === inc.IDSquadre.Fuori) return;
        matches.push(inc);
      });

      // Ordina cronologicamente per GiornataDiA (o IDFantagiornata)
      matches.sort((a, b) => {
        const ga = (a.GiornataDiA !== undefined && a.GiornataDiA > 0) ? a.GiornataDiA : a.IDFantagiornata;
        const gb = (b.GiornataDiA !== undefined && b.GiornataDiA > 0) ? b.GiornataDiA : b.IDFantagiornata;
        return ga - gb;
      });

      if (matches.length === 0) {
        competitions.push({
          id: idComp,
          name: compName,
          categories: [],
          hasRecords: false,
          totalEntriesCount: 0
        });
        return;
      }

      // Accumulatore statistiche per squadra
      const teamStats = new Map();
      function getOrCreateTeam(id, fallbackName) {
        if (!teamStats.has(id)) {
          const name = teamNameMap.get(id) || fallbackName || `Squadra ${id}`;
          teamStats.set(id, {
            id,
            name,
            wins: 0,
            draws: 0,
            losses: 0,
            gf: 0,
            gs: 0,
            maxScore: -Infinity,
            minScore: Infinity,
            history: []
          });
        }
        return teamStats.get(id);
      }

      // Popola statistiche partita per partita
      matches.forEach(m => {
        const home = getOrCreateTeam(m.IDSquadre.Casa, m.Nomi.Casa);
        const away = getOrCreateTeam(m.IDSquadre.Fuori, m.Nomi.Fuori);

        const totCasa = Number(m.Totali.Casa);
        const totFuori = Number(m.Totali.Fuori);
        const golCasa = Number(m.Gol.Casa);
        const golFuori = Number(m.Gol.Fuori);

        if (totCasa > home.maxScore) home.maxScore = totCasa;
        if (totCasa < home.minScore) home.minScore = totCasa;

        if (totFuori > away.maxScore) away.maxScore = totFuori;
        if (totFuori < away.minScore) away.minScore = totFuori;

        home.gf += golCasa;
        home.gs += golFuori;
        away.gf += golFuori;
        away.gs += golCasa;

        if (golCasa > golFuori) {
          home.wins++;
          away.losses++;
          home.history.push('W');
          away.history.push('L');
        } else if (golCasa < golFuori) {
          away.wins++;
          home.losses++;
          away.history.push('W');
          home.history.push('L');
        } else {
          home.draws++;
          away.draws++;
          home.history.push('D');
          away.history.push('D');
        }
      });

      // Calcola strisce cronologiche (serie positiva e serie negativa)
      teamStats.forEach(t => {
        let curPos = 0, maxPos = 0;
        let curNeg = 0, maxNeg = 0;
        t.history.forEach(outcome => {
          if (outcome === 'W' || outcome === 'D') {
            curPos++;
            if (curPos > maxPos) maxPos = curPos;
          } else {
            curPos = 0;
          }

          if (outcome === 'L' || outcome === 'D') {
            curNeg++;
            if (curNeg > maxNeg) maxNeg = curNeg;
          } else {
            curNeg = 0;
          }
        });
        t.maxPosStreak = maxPos;
        t.maxNegStreak = maxNeg;
      });

      const teams = [...teamStats.values()];

      // Funzione ausiliaria per trovare i primati (supporta ex aequo)
      const findExtremes = (prop, isMin = false) => {
        if (teams.length === 0) return { value: '-', list: [] };
        let extremeVal = isMin ? Infinity : -Infinity;
        teams.forEach(t => {
          const v = t[prop];
          if (isMin ? (v < extremeVal) : (v > extremeVal)) {
            extremeVal = v;
          }
        });
        const tied = teams.filter(t => t[prop] === extremeVal);
        return {
          value: extremeVal,
          list: tied.map(t => ({
            value: this._formatNum(extremeVal),
            team: t.name,
            id: t.id
          }))
        };
      };

      // 6 Coppie Canoniche
      const catPoints = {
        posTitle: 'Maggior numero di punti fatti',
        negTitle: 'Minor numero di punti fatti',
        posList: findExtremes('maxScore', false).list,
        negList: findExtremes('minScore', true).list
      };

      const catWins = {
        posTitle: 'Maggior numero di vittorie',
        negTitle: 'Minor numero di vittorie',
        posList: findExtremes('wins', false).list,
        negList: findExtremes('wins', true).list
      };

      const catLosses = {
        posTitle: 'Minor numero di sconfitte',
        negTitle: 'Maggior numero di sconfitte',
        posList: findExtremes('losses', true).list,
        negList: findExtremes('losses', false).list
      };

      const catStreaks = {
        posTitle: 'Partite consecutive senza sconfitte (serie positiva)',
        negTitle: 'Partite consecutive senza vittorie (serie negativa)',
        posList: findExtremes('maxPosStreak', false).list,
        negList: findExtremes('maxNegStreak', false).list
      };

      const catGoalsFor = {
        posTitle: 'Maggior numero di goals fatti',
        negTitle: 'Minor numero di goals fatti',
        posList: findExtremes('gf', false).list,
        negList: findExtremes('gf', true).list
      };

      const catGoalsAgainst = {
        posTitle: 'Minor numero di goals subiti',
        negTitle: 'Maggior numero di goals subiti',
        posList: findExtremes('gs', true).list,
        negList: findExtremes('gs', false).list
      };

      const categories = [catPoints, catWins, catLosses, catStreaks, catGoalsFor, catGoalsAgainst];
      let totalEntriesCount = 0;
      categories.forEach(c => {
        totalEntriesCount += c.posList.length + c.negList.length;
      });

      competitions.push({
        id: idComp,
        name: compName,
        categories,
        hasRecords: totalEntriesCount > 0,
        totalEntriesCount
      });
    });

    return {
      aggiornato,
      competitions
    };
  },

  _formatNum(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (Number.isInteger(num)) return String(num);
    return String(num).replace('.', ',');
  },

  _getTeamLogo(teamName) {
    if (!teamName) return 'img/sq/undefined.svg';
    return `img/sq/${encodeURIComponent(teamName)}.png`;
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
            <div class="card-subtitle">Primati e statistiche stagionali per competizione calcolati in tempo reale dai dati FCM</div>
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
        .rec-entry-row.table-row-favorite {
          background: rgba(2, 132, 199, 0.12) !important;
          border-color: rgba(2, 132, 199, 0.45) !important;
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

        /* Responsive Breakpoint Mobile */
        @media (max-width: 640px) {
          .rec-pair-body {
            grid-template-columns: 1fr;
          }
          .rec-col-pos {
            border-right: none;
            border-bottom: 1px solid var(--border-subtle, #334155);
          }
        }
      </style>
    `;
  },

  _bindEvents(container) {
    const tabBtns = container.querySelectorAll('.records-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (this.currentTab === tab) return;
        this.currentTab = tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this._renderResults(container);
      });
    });
  },

  _renderResults(container) {
    const resultsContainer = container.querySelector('#recordsResultsContainer');
    if (!resultsContainer) return;

    const d = this.data;
    if (!d || !d.competitions || d.competitions.length === 0) {
      resultsContainer.innerHTML = `
        <div class="records-empty-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Nessuna competizione con record disponibile
        </div>
      `;
      return;
    }

    const filteredComps = this.currentTab === 'all'
      ? d.competitions
      : d.competitions.filter(c => c.name === this.currentTab);

    if (filteredComps.length === 0) {
      resultsContainer.innerHTML = `
        <div class="records-empty-box">
          Nessun record per la competizione selezionata
        </div>
      `;
      return;
    }

    const html = filteredComps.map(c => {
      if (!c.hasRecords) {
        return `
          <div class="records-comp-section">
            <div class="records-comp-header">
              <span>🏆 ${this._esc(c.name)}</span>
              <span class="comp-tag">0 primati</span>
            </div>
            <div class="records-empty-box">
              Nessun incontro disputato per questa competizione
            </div>
          </div>
        `;
      }

      const cardsHtml = c.categories.map(cat => this._renderPairCard(cat)).join('');

      return `
        <div class="records-comp-section">
          <div class="records-comp-header">
            <span>🏆 ${this._esc(c.name)}</span>
            <span class="comp-tag">${c.totalEntriesCount} primati</span>
          </div>
          <div class="records-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    resultsContainer.innerHTML = html;
  },

  _renderPairCard(cat) {
    // Record Positivo (Verde)
    let posEntriesHtml = '';
    if (cat.posList && cat.posList.length > 0) {
      posEntriesHtml = cat.posList.map(item => {
        const isFav = typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.isFavoriteTeam(item.team);
        const favStar = isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : '';
        const logoUrl = this._getTeamLogo(item.team);
        return `
          <div class="rec-entry-row ${isFav ? 'table-row-favorite' : ''}">
            <div class="rec-team-info">
              <img src="${logoUrl}" class="rec-fsq-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURIComponent(item.team)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
              <span class="rec-team-name">${favStar}${this._esc(item.team)}</span>
            </div>
            <span class="rec-badge-val rec-badge-pos">${this._esc(item.value)}</span>
          </div>
        `;
      }).join('');
    } else {
      posEntriesHtml = `
        <div class="rec-entry-empty">
          <span>-</span>
        </div>
      `;
    }

    // Record Negativo (Rosso)
    let negEntriesHtml = '';
    if (cat.negList && cat.negList.length > 0) {
      negEntriesHtml = cat.negList.map(item => {
        const isFav = typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.isFavoriteTeam(item.team);
        const favStar = isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : '';
        const logoUrl = this._getTeamLogo(item.team);
        return `
          <div class="rec-entry-row ${isFav ? 'table-row-favorite' : ''}">
            <div class="rec-team-info">
              <img src="${logoUrl}" class="rec-fsq-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURIComponent(item.team)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
              <span class="rec-team-name">${favStar}${this._esc(item.team)}</span>
            </div>
            <span class="rec-badge-val rec-badge-neg">${this._esc(item.value)}</span>
          </div>
        `;
      }).join('');
    } else {
      negEntriesHtml = `
        <div class="rec-entry-empty">
          <span>-</span>
        </div>
      `;
    }

    return `
      <div class="rec-pair-card">
        <div class="rec-pair-body">
          <div class="rec-col-pos">
            <div class="rec-header-pos">
              <span>▲ ${this._esc(cat.posTitle)}</span>
            </div>
            <div class="rec-teams-list">
              ${posEntriesHtml}
            </div>
          </div>
          <div class="rec-col-neg">
            <div class="rec-header-neg">
              <span>▼ ${this._esc(cat.negTitle)}</span>
            </div>
            <div class="rec-teams-list">
              ${negEntriesHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
