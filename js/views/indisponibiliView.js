/**
 * INDISPONIBILI VIEW
 * Calciatori indisponibili: Serie A, Fantasquadre, Lista Infortunati
 * ModernFCM
 */

const indisponibiliView = {
  currentTab: 'seriea', // 'seriea' | 'fantasquadre' | 'check'
  searchQuery: '',

  async render(container) {
    // Se il container non ha ancora la card, mostriamo un indicatore di caricamento
    if (!container.querySelector('#indCardWrapper')) {
      container.innerHTML = `
        <div class="card" style="padding: 48px 24px; text-align: center; color: var(--text-muted, #94a3b8);">
          <div class="ind-spin-loader" style="margin: 0 auto 14px; width: 32px; height: 32px; border: 3px solid rgba(2,132,199,0.2); border-top-color: var(--accent-primary, #0284c7); border-radius: 50%; animation: indSpin 0.7s linear infinite;"></div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary, #f1f5f9);">Caricamento indisponibili &amp; infortunati...</div>
          <div style="font-size: 0.8rem; margin-top: 5px;">Sincronizzazione report Serie A e fantarose in corso</div>
        </div>
        <style>@keyframes indSpin { to { transform: rotate(360deg); } }</style>
      `;
    }

    // Carica dati necessari
    if (typeof arrGiocatoriA === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
    }
    if (typeof xa1 === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADati.js');
    }
    if (typeof arrFantasquadre === 'undefined' || typeof arrRose === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }

    // Esegui probform_extract.php per sincronizzare le indisponibilità (cache 1h) e carica ProbFGDati.js
    await this._syncProbFG(false);

    // Parse URL tab param
    const fullHash = window.location.hash || '';
    const hash = fullHash.split('?')[0];
    const query = fullHash.includes('?') ? fullHash.split('?')[1] : '';
    const params = new URLSearchParams(query);

    if (params.has('tab')) {
      const t = params.get('tab').toLowerCase();
      if (['seriea', 'fantasquadre', 'check'].includes(t)) {
        this.currentTab = t;
      }
    } else if (hash === '#indisponibili_check') {
      this.currentTab = 'check';
    } else if (hash === '#indisponibili_covid') {
      this.currentTab = 'seriea';
    } else if (hash === '#indisponibili' && !params.has('tab')) {
      if (!['seriea', 'fantasquadre', 'check'].includes(this.currentTab)) {
        this.currentTab = 'seriea';
      }
    }

    this._renderShell(container);
    this._bindEvents(container);
    this._renderResults(container);
  },

  async _syncProbFG(force = false) {
    try {
      const url = force ? 'inc/probform_extract.php?force=1' : 'inc/probform_extract.php';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      console.warn('Prob Form Extract non disponibile o errore fetch:', e);
    }
    // Ricarica sempre ProbFGDati.js con forceReload per acquisire subito i dati freschi
    await fcmDataLoader.loadScript('js/ProbFGDati.js', true);
  },

  _renderShell(container) {
    const q = this.searchQuery;
    const tabSeriea = this.currentTab === 'seriea' ? 'active' : '';
    const tabFsq = this.currentTab === 'fantasquadre' ? 'active' : '';
    const tabCheck = this.currentTab === 'check' ? 'active' : '';
    const clearDisplay = q ? 'flex' : 'none';

    container.innerHTML = `
      <div class="card" id="indCardWrapper">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red,#ef4444)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Indisponibili &amp; Infortunati
            </div>
            <div class="card-subtitle">Report infortuni Serie A, infermeria fantasquadre e controllo reintegri</div>
          </div>
          <button id="indBtnRefresh" class="ind-btn-refresh" title="Sincronizza e aggiorna indisponibilità ora da Fantacalcio.it">
            <svg id="indRefreshIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span id="indRefreshLabel">Aggiorna</span>
          </button>
        </div>

        <!-- 3 Pulsanti di selezione / Tab -->
        <div class="ind-tab-bar">
          <button id="indTabSeriea" class="ind-tab-btn ${tabSeriea}" data-tab="seriea">&#127973; Serie A</button>
          <button id="indTabFantasquadre" class="ind-tab-btn ${tabFsq}" data-tab="fantasquadre">&#128101; Fantasquadre</button>
          <button id="indTabCheck" class="ind-tab-btn ${tabCheck}" data-tab="check">&#128203; Lista Infortunati</button>
        </div>

        <!-- Barra di ricerca rapida con pulsante 'X' di svuotamento -->
        <div class="ind-search-wrapper">
          <svg class="ind-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="indSearchInput" class="search-input"
            placeholder="Cerca calciatore, motivo o squadra..."
            value="${this._esc(q)}"
            autocomplete="off" spellcheck="false" />
          <button id="indSearchClear" style="display:${clearDisplay};" title="Svuota ricerca" aria-label="Cancella ricerca">&times;</button>
        </div>

        <!-- Contenitore dinamico dei risultati -->
        <div id="indResultsContainer"></div>
      </div>

      <style>
        .ind-tab-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .ind-tab-btn {
          padding: 8px 18px;
          border-radius: var(--radius-md, 8px);
          border: 1px solid var(--border-subtle, #334155);
          background: var(--bg-surface-elevated, #1e293b);
          color: var(--text-muted, #94a3b8);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ind-tab-btn:hover {
          border-color: var(--accent-primary, #0284c7);
          color: var(--text-primary, #f1f5f9);
        }
        .ind-tab-btn.active {
          background: var(--accent-primary, #0284c7);
          border-color: var(--accent-primary, #0284c7);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
        }

        .ind-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        .ind-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.5;
          pointer-events: none;
        }
        #indSearchInput {
          padding-left: 38px;
          padding-right: 36px;
          width: 100%;
          box-sizing: border-box;
          height: 40px;
          border-radius: var(--radius-md, 8px);
          background: var(--bg-surface-elevated, #1e293b);
          border: 1px solid var(--border-subtle, #334155);
          color: var(--text-primary, #f1f5f9);
          font-size: 0.88rem;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        #indSearchInput:focus {
          outline: none;
          border-color: var(--accent-primary, #0284c7);
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25);
        }
        #indSearchClear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          color: var(--text-muted, #94a3b8);
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          padding: 0;
          transition: all 0.15s ease;
          z-index: 2;
        }
        #indSearchClear:hover {
          background: var(--bg-surface, rgba(255,255,255,0.1));
          color: var(--text-primary, #ffffff);
        }

        .ind-btn-refresh {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-md, 8px);
          background: var(--bg-surface-elevated, #1e293b);
          border: 1px solid var(--border-subtle, #334155);
          color: var(--text-muted, #94a3b8);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ind-btn-refresh:hover {
          border-color: var(--accent-primary, #0284c7);
          color: var(--text-primary, #f1f5f9);
        }
        .ind-btn-refresh.loading {
          opacity: 0.75;
          pointer-events: none;
        }
        .ind-btn-refresh.loading #indRefreshIcon {
          animation: indSpin 0.8s linear infinite;
        }

        .ind-team-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-surface-elevated, #1e293b);
          border-radius: var(--radius-md, 8px);
          border: 1px solid var(--border-subtle, #334155);
          margin: 16px 0 6px;
          font-weight: 700;
          font-size: 0.92rem;
          color: var(--text-primary, #f1f5f9);
        }
        .ind-team-header:first-of-type {
          margin-top: 6px;
        }
        .ind-team-header img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          border-radius: 4px;
        }

        /* Intestazione Colonne Desktop (Ordine: Calciatore, Squadra/Fantasquadra, Motivo, Stato, Rientro) */
        .ind-table-header {
          display: grid;
          grid-template-columns: 240px 160px minmax(200px, 1.4fr) 140px minmax(190px, 1.2fr);
          align-items: center;
          gap: 12px;
          padding: 8px 14px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #94a3b8);
          border-bottom: 1px solid var(--border-subtle, #334155);
          margin: 10px 0 6px;
        }
        .ind-th-rientro {
          text-align: right;
        }
        .ind-th-status {
          text-align: center;
        }

        /* Riga Calciatore Desktop (CSS Grid fisso) */
        .ind-player-row {
          display: grid;
          grid-template-columns: 240px 160px minmax(200px, 1.4fr) 140px minmax(190px, 1.2fr);
          align-items: center;
          gap: 12px;
          padding: 9px 14px;
          border-radius: var(--radius-sm, 6px);
          border: 1px solid var(--border-subtle, #334155);
          background: var(--bg-surface, #0f172a);
          margin-bottom: 5px;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .ind-player-row:hover {
          background: var(--bg-surface-elevated, #1e293b);
          border-color: var(--border-focus, #475569);
        }

        .ind-col-player {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .ind-player-photo {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-subtle, #334155);
          background: var(--bg-surface-elevated, #1e293b);
          flex-shrink: 0;
        }
        .ind-role-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 800;
          flex-shrink: 0;
        }
        .ind-role-1 { background: #fbbf24; color: #1e1b4b; }
        .ind-role-2 { background: #22c55e; color: #052e16; }
        .ind-role-3 { background: #3b82f6; color: #eff6ff; }
        .ind-role-4 { background: #ef4444; color: #ffffff; }

        .ind-player-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .ind-player-name {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--text-primary, #f1f5f9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ind-player-name.in-lista {
          color: var(--text-muted, #94a3b8);
          font-style: italic;
        }
        .ind-team-mobile {
          display: none;
        }

        .ind-col-team {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
        }
        .ind-team-desktop {
          display: flex;
        }

        .ind-col-motivo {
          min-width: 0;
          font-size: 0.78rem;
          color: var(--text-muted, #94a3b8);
          line-height: 1.35;
          word-break: break-word;
        }
        .ind-col-status {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ind-status-placeholder {
          color: var(--text-muted, #94a3b8);
          opacity: 0.35;
          font-size: 0.85rem;
        }
        .ind-col-rientro {
          min-width: 0;
          text-align: right;
          font-size: 0.76rem;
          color: var(--accent-primary, #0284c7);
          font-weight: 600;
          line-height: 1.35;
          word-break: break-word;
        }

        .ind-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ind-badge-lista {
          background: rgba(148, 163, 184, 0.15);
          color: var(--text-muted, #94a3b8);
          border: 1px solid var(--border-subtle, #334155);
        }
        .ind-badge-lista-red {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.35);
          font-weight: 700;
        }
        .ind-badge-inrosa {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        .ind-badge-fsq {
          background: rgba(2, 132, 199, 0.15);
          color: var(--accent-primary, #0284c7);
          border: 1px solid rgba(2, 132, 199, 0.3);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ind-badge-svinc {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-muted, #94a3b8);
          border: 1px solid var(--border-subtle, #334155);
          font-style: italic;
        }
        .ind-badge-reintegra-si {
          background: rgba(34, 197, 94, 0.18);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.4);
          font-weight: 800;
        }
        .ind-badge-reintegra-no {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .ind-fsq-logo {
          width: 20px;
          height: 20px;
          object-fit: contain;
          border-radius: 3px;
          vertical-align: middle;
          flex-shrink: 0;
        }
        .ind-empty {
          text-align: center;
          padding: 40px 10px;
          color: var(--text-muted, #94a3b8);
          font-size: 0.92rem;
        }

        /* Testo Reintegro responsive */
        .reintegra-mobile {
          display: none;
        }
        .reintegra-desktop {
          display: inline;
        }

        /* Ottimizzazione Tablet e Mobile (<960px): layout gerarchico ordinato */
        @media (max-width: 960px) {
          .ind-table-header {
            display: none;
          }
          .ind-team-desktop {
            display: none !important;
          }
          .ind-team-mobile {
            display: block;
            margin-top: 4px;
          }
          .ind-status-placeholder {
            display: none;
          }

          .reintegra-desktop {
            display: none;
          }
          .reintegra-mobile {
            display: inline;
          }

          .ind-player-row {
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "player player"
              "motivo status"
              "rientro rientro";
            gap: 8px 12px;
            padding: 12px 14px;
            margin-bottom: 8px;
            border-radius: var(--radius-md, 8px);
          }

          .ind-col-player {
            grid-area: player;
            width: 100%;
          }
          .ind-player-photo {
            width: 38px;
            height: 38px;
          }

          .ind-col-motivo {
            grid-area: motivo;
            min-width: 0;
            word-break: break-word;
            font-size: 0.78rem;
            line-height: 1.35;
            align-self: center;
            padding-left: 48px; /* Allineato sotto il nome e stemma */
            text-align: left;
          }

          .ind-col-status {
            grid-area: status;
            justify-content: flex-end;
            align-self: center;
            white-space: nowrap;
          }

          /* Tempo di rientro allineato a sinistra su mobile */
          .ind-col-rientro {
            grid-area: rientro;
            width: 100%;
            text-align: left;
            padding-left: 48px; /* Stesso allineamento a sinistra del motivo indisponibilità */
            padding-top: 6px;
            border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
            font-size: 0.76rem;
            line-height: 1.35;
            word-break: break-word;
          }

          .ind-col-rientro.ind-rientro-empty,
          .ind-col-rientro:has(.ind-status-placeholder) {
            display: none !important;
          }

          .ind-tab-btn {
            padding: 7px 12px;
            font-size: 0.78rem;
          }
        }
      </style>
    `;
  },

  _bindEvents(container) {
    // Tab switching
    container.querySelectorAll('.ind-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        container.querySelectorAll('.ind-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderResults(container);
      });
    });

    const input = container.querySelector('#indSearchInput');
    const clearBtn = container.querySelector('#indSearchClear');

    if (input) {
      input.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (clearBtn) {
          clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
        }
        this._renderResults(container);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchQuery = '';
          input.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          this._renderResults(container);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.searchQuery = '';
        if (input) {
          input.value = '';
          input.focus();
        }
        clearBtn.style.display = 'none';
        this._renderResults(container);
      });
    }

    const refreshBtn = container.querySelector('#indBtnRefresh');
    const refreshLabel = container.querySelector('#indRefreshLabel');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('loading');
        if (refreshLabel) refreshLabel.textContent = 'Aggiornamento...';
        try {
          await this._syncProbFG(true);
          this._renderResults(container);
          if (refreshLabel) refreshLabel.textContent = 'Aggiornato!';
          setTimeout(() => {
            if (refreshLabel) refreshLabel.textContent = 'Aggiorna';
          }, 2000);
        } catch (err) {
          console.error('Errore aggiornamento indisponibili:', err);
          if (refreshLabel) refreshLabel.textContent = 'Errore';
          setTimeout(() => {
            if (refreshLabel) refreshLabel.textContent = 'Aggiorna';
          }, 2000);
        } finally {
          refreshBtn.classList.remove('loading');
        }
      });
    }
  },

  _renderResults(container) {
    const resultsEl = container.querySelector('#indResultsContainer');
    if (!resultsEl) return;

    if (this.currentTab === 'seriea') {
      resultsEl.innerHTML = this._buildSerieATab();
    } else if (this.currentTab === 'fantasquadre') {
      resultsEl.innerHTML = this._buildFantasquadreTab();
    } else if (this.currentTab === 'check') {
      resultsEl.innerHTML = this._buildCheckTab();
    }
  },

  _decodeEntities(str) {
    if (!str) return '';
    const temp = document.createElement('textarea');
    temp.innerHTML = str;
    return temp.value;
  },

  _esc(s) {
    if (!s) return '';
    const decoded = this._decodeEntities(String(s));
    return decoded
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _roleName(r) {
    return ['', 'P', 'D', 'C', 'A'][r] || '?';
  },

  _playerPhotoHtml(codice) {
    const src = (codice && codice !== 0) ? `img/foto/${codice}.jpg` : 'img/foto/misterx.gif';
    return `<img class="ind-player-photo" src="${src}" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="">`;
  },

  _teamLogoHtml(teamName, size = 28) {
    if (!teamName) return '';
    const safe = teamName.replace(/'/g, '_');
    return `<img src="img/live/sq/${safe}.png" width="${size}" height="${size}" style="object-fit:contain;" onerror="this.onerror=null;this.src='img/sq/${safe}.gif';" alt="${this._esc(teamName)}">`;
  },

  _fsqLogoHtml(fsqName, size = 22) {
    if (!fsqName) return '';
    const safe = fsqName.replace(/'/g, '_');
    return `<img class="ind-fsq-logo" src="img/sq/${safe}.png" width="${size}" height="${size}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${safe}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${this._esc(fsqName)}">`;
  },

  _getFsq(idSquadra) {
    if (typeof arrFantasquadre === 'undefined') return null;
    return arrFantasquadre.find(f => f && f.ID === idSquadra) || null;
  },

  _findRoseEntry(playerName) {
    if (typeof arrRose === 'undefined' || !playerName) return null;
    for (let i = 1; i < arrRose.length; i++) {
      const r = arrRose[i];
      if (r && r.Stato !== 1 && r.Nome === playerName) return r;
    }
    return null;
  },

  _matchesSearch(playerName, motivo, teamName = '') {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return true;
    const cleanPlayer = this._decodeEntities(playerName || '').toLowerCase();
    const cleanMotivo = this._decodeEntities(motivo || '').toLowerCase();
    const cleanTeam = this._decodeEntities(teamName || '').toLowerCase();
    return (
      cleanPlayer.includes(q) ||
      cleanMotivo.includes(q) ||
      cleanTeam.includes(q)
    );
  },

  /**
   * TAB 1: Serie A (Precedentemente indisponibili_covid.php)
   */
  _buildSerieATab() {
    if (typeof arrGiocatoriA === 'undefined' || typeof arrIndisponibili === 'undefined') {
      return '<div class="ind-empty">Dati indisponibili non disponibili.</div>';
    }

    let html = `
      <div class="ind-table-header">
        <div>Calciatore</div>
        <div>Fantasquadra</div>
        <div>Motivo Indisponibilit&agrave;</div>
        <div class="ind-th-status">Lista Infortunati</div>
        <div class="ind-th-rientro">Previsione Rientro</div>
      </div>
    `;
    let totalCount = 0;

    for (let i = 1; i <= 20; i++) {
      const squadra = window['xa' + i] || `Squadra ${i}`;
      const players = [];

      for (let j = 1; j < arrGiocatoriA.length; j++) {
        const ga = arrGiocatoriA[j];
        if (!ga || ga.IDSquadra !== i) continue;

        const id = ga.ID;
        const ind = arrIndisponibili[id];
        if (!ind || ind.ID !== id) continue;

        const playerName = window['xg' + id] || ind.Giocatore || '';
        const motivo = ind.Motivo || '';

        const roseEntry = this._findRoseEntry(playerName);
        const fsq = roseEntry ? this._getFsq(roseEntry.IDSquadra) : null;
        const fsqName = fsq ? fsq.Nome : null;
        const inLista = roseEntry ? roseEntry.Stato === 2 : false;

        if (!this._matchesSearch(playerName, motivo, `${squadra} ${fsqName || ''}`)) continue;

        players.push({
          id,
          ga,
          ind,
          playerName,
          motivo,
          fsqName,
          inLista
        });
      }

      if (players.length === 0) continue;
      totalCount += players.length;

      html += `
        <div class="ind-team-header">
          ${this._teamLogoHtml(squadra, 28)}
          <span>${this._esc(squadra)}</span>
          <span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);font-weight:600;">
            ${players.length} indisponibil${players.length !== 1 ? 'i' : 'e'}
          </span>
        </div>
      `;

      for (const p of players) {
        const fsqBadge = p.fsqName
          ? `<span class="ind-badge ind-badge-fsq">${this._fsqLogoHtml(p.fsqName, 18)} <span>${this._esc(p.fsqName)}</span></span>`
          : '';

        const listaBadge = p.inLista
          ? '<span class="ind-badge ind-badge-lista-red">&#128657; Lista infortunati</span>'
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const hasRientro = Boolean(p.ind && p.ind.Rientro);
        const rientroContent = hasRientro
          ? `<span title="Previsione rientro">&#9201; ${this._esc(p.ind.Rientro)}</span>`
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const rientroClass = hasRientro ? 'ind-col-rientro' : 'ind-col-rientro ind-rientro-empty';

        html += `
          <div class="ind-player-row">
            <!-- 1. Calciatore -->
            <div class="ind-col-player">
              ${this._playerPhotoHtml(p.ga.Codice)}
              <span class="ind-role-badge ind-role-${p.ga.Ruolo}">${this._roleName(p.ga.Ruolo)}</span>
              <div class="ind-player-info">
                <span class="ind-player-name ${p.inLista ? 'in-lista' : ''}">${this._esc(p.playerName)}</span>
                <div class="ind-team-mobile">${fsqBadge}</div>
              </div>
            </div>

            <!-- 2. Squadra / Fantasquadra -->
            <div class="ind-col-team ind-team-desktop">${fsqBadge}</div>

            <!-- 3. Motivo Indisponibilità -->
            <div class="ind-col-motivo">
              <span>${this._esc(p.motivo)}</span>
            </div>

            <!-- 4. Stato / Lista Infortunati -->
            <div class="ind-col-status">${listaBadge}</div>

            <!-- 5. Previsione Rientro -->
            <div class="${rientroClass}">${rientroContent}</div>
          </div>
        `;
      }
    }

    if (totalCount === 0) {
      const msg = this.searchQuery
        ? `Nessun risultato per "${this._esc(this.searchQuery)}"`
        : 'Nessun calciatore indisponibile al momento.';
      return `<div class="ind-empty">${msg}</div>`;
    }
    return html;
  },

  /**
   * TAB 2: Fantasquadre (Precedentemente indisponibili.php)
   */
  _buildFantasquadreTab() {
    if (typeof arrFantasquadre === 'undefined' || typeof arrRose === 'undefined' || typeof arrIndisponibili === 'undefined') {
      return '<div class="ind-empty">Dati fantasquadre non disponibili.</div>';
    }

    const nameToGA = {};
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let j = 1; j < arrGiocatoriA.length; j++) {
        const ga = arrGiocatoriA[j];
        if (!ga) continue;
        const pname = window['xg' + ga.ID];
        if (pname) {
          nameToGA[pname.trim()] = ga;
          nameToGA[pname.trim().toLowerCase()] = ga;
        }
      }
    }

    let html = `
      <div class="ind-table-header">
        <div>Calciatore</div>
        <div>Squadra Serie A</div>
        <div>Motivo Indisponibilit&agrave;</div>
        <div class="ind-th-status">Lista Infortunati</div>
        <div class="ind-th-rientro">Previsione Rientro</div>
      </div>
    `;
    let totalCount = 0;

    for (let fi = 0; fi < arrFantasquadre.length; fi++) {
      const fsq = arrFantasquadre[fi];
      if (!fsq) continue;
      const players = [];

      for (let i = 1; i < arrRose.length; i++) {
        const r = arrRose[i];
        if (!r || r.IDSquadra !== fsq.ID || r.Stato === 1) continue;

        const playerName = r.Nome || '';
        const gaP = nameToGA[playerName.trim()] || nameToGA[playerName.trim().toLowerCase()];
        if (!gaP) continue;

        const ind = arrIndisponibili[gaP.ID];
        if (!ind || ind.ID !== gaP.ID) continue;

        const motivo = ind.Motivo || '';
        const squadraSerieA = window['xa' + gaP.IDSquadra] || '';

        if (!this._matchesSearch(playerName, motivo, `${fsq.Nome} ${squadraSerieA}`)) continue;

        players.push({
          r,
          ga: gaP,
          ind,
          playerName,
          motivo,
          squadraSerieA
        });
      }

      if (players.length === 0) continue;
      totalCount += players.length;

      html += `
        <div class="ind-team-header">
          ${this._fsqLogoHtml(fsq.Nome, 28)}
          <span>${this._esc(fsq.Nome)}</span>
          <span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);font-weight:600;">
            ${players.length} indisponibil${players.length !== 1 ? 'i' : 'e'}
          </span>
        </div>
      `;

      for (const p of players) {
        const inLista = p.r.Stato === 2;
        // Solo se inserito in lista infortunati: in rosso 🚑 Lista infortunati
        const statusBadge = inLista
          ? '<span class="ind-badge ind-badge-lista-red">&#128657; Lista infortunati</span>'
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const serieABadge = p.squadraSerieA
          ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.82rem;color:var(--text-primary);font-weight:600;">
              ${this._teamLogoHtml(p.squadraSerieA, 18)} ${this._esc(p.squadraSerieA)}
            </span>`
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const hasRientro = Boolean(p.ind && p.ind.Rientro);
        const rientroContent = hasRientro
          ? `<span title="Previsione rientro">&#9201; ${this._esc(p.ind.Rientro)}</span>`
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const rientroClass = hasRientro ? 'ind-col-rientro' : 'ind-col-rientro ind-rientro-empty';

        html += `
          <div class="ind-player-row">
            <!-- 1. Calciatore -->
            <div class="ind-col-player">
              ${this._playerPhotoHtml(p.ga.Codice)}
              <span class="ind-role-badge ind-role-${p.ga.Ruolo}">${this._roleName(p.ga.Ruolo)}</span>
              <div class="ind-player-info">
                <span class="ind-player-name ${inLista ? 'in-lista' : ''}">${this._esc(p.playerName)}</span>
                <div class="ind-team-mobile">${serieABadge}</div>
              </div>
            </div>

            <!-- 2. Squadra Serie A -->
            <div class="ind-col-team ind-team-desktop">${serieABadge}</div>

            <!-- 3. Motivo Indisponibilità -->
            <div class="ind-col-motivo">
              <span>${this._esc(p.motivo)}</span>
            </div>

            <!-- 4. Lista Infortunati -->
            <div class="ind-col-status">${statusBadge}</div>

            <!-- 5. Previsione Rientro -->
            <div class="${rientroClass}">${rientroContent}</div>
          </div>
        `;
      }
    }

    if (totalCount === 0) {
      const msg = this.searchQuery
        ? `Nessun risultato per "${this._esc(this.searchQuery)}"`
        : 'Nessun calciatore indisponibile nelle fantasquadre.';
      return `<div class="ind-empty">${msg}</div>`;
    }
    return html;
  },

  /**
   * TAB 3: Lista Infortunati / Check (Precedentemente indisponibili_check.php)
   */
  _buildCheckTab() {
    if (typeof arrRose === 'undefined' || typeof arrGiocatoriA === 'undefined') {
      return '<div class="ind-empty">Dati lista infortunati non disponibili.</div>';
    }

    const nameToGA = {};
    for (let j = 1; j < arrGiocatoriA.length; j++) {
      const ga = arrGiocatoriA[j];
      if (!ga) continue;
      const pname = window['xg' + ga.ID];
      if (pname) {
        nameToGA[pname.trim()] = ga;
        nameToGA[pname.trim().toLowerCase()] = ga;
      }
    }

    // Raggruppa per fantasquadra i soli giocatori in lista infortunati (Stato === 2)
    const byFsqOrder = [];
    const byFsqMap = {};

    for (let i = 1; i < arrRose.length; i++) {
      const r = arrRose[i];
      if (!r || r.Stato !== 2) continue;

      const playerName = r.Nome || '';
      const gaP = nameToGA[playerName.trim()] || nameToGA[playerName.trim().toLowerCase()];
      const ind = (gaP && typeof arrIndisponibili !== 'undefined') ? arrIndisponibili[gaP.ID] : undefined;
      const isStillOut = Boolean(ind && gaP && ind.ID === gaP.ID);
      const motivo = isStillOut ? (ind.Motivo || '') : 'Recuperato / Nessun infortunio';
      const squadraSerieA = gaP ? (window['xa' + gaP.IDSquadra] || '') : '';

      const fsq = this._getFsq(r.IDSquadra);
      const fsqName = fsq ? fsq.Nome : `Squadra ${r.IDSquadra}`;

      if (!this._matchesSearch(playerName, motivo, `${fsqName} ${squadraSerieA}`)) continue;

      const fsqId = r.IDSquadra;
      if (!byFsqMap[fsqId]) {
        byFsqMap[fsqId] = [];
        byFsqOrder.push(fsqId);
      }
      byFsqMap[fsqId].push({
        r,
        ga: gaP,
        ind,
        playerName,
        motivo,
        isStillOut,
        squadraSerieA
      });
    }

    if (byFsqOrder.length === 0) {
      const msg = this.searchQuery
        ? `Nessun risultato per "${this._esc(this.searchQuery)}"`
        : 'Nessun calciatore inserito in lista infortunati.';
      return `<div class="ind-empty">${msg}</div>`;
    }

    let html = `
      <div class="ind-table-header">
        <div>Calciatore</div>
        <div>Squadra Serie A</div>
        <div>Motivo Indisponibilit&agrave;</div>
        <div class="ind-th-status">Da Reintegrare</div>
        <div class="ind-th-rientro">Previsione Rientro</div>
      </div>
    `;

    for (const fsqId of byFsqOrder) {
      const players = byFsqMap[fsqId];
      const fsq = this._getFsq(fsqId);
      const fsqName = fsq ? fsq.Nome : `Squadra ${fsqId}`;

      html += `
        <div class="ind-team-header">
          ${this._fsqLogoHtml(fsqName, 28)}
          <span>${this._esc(fsqName)}</span>
          <span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);font-weight:600;">
            ${players.length} in lista infortunati
          </span>
        </div>
      `;

      for (const p of players) {
        const codice = p.ga ? p.ga.Codice : null;
        const ruolo = p.ga ? p.ga.Ruolo : 0;

        // Se da reintegrare: su mobile scrive "✅ Da reintegrare", su desktop "✅ SÌ (Disponibile)"
        const reintegraBadge = p.isStillOut
          ? '<span class="ind-badge ind-badge-reintegra-no">&#10060; NO (Infortunato)</span>'
          : `<span class="ind-badge ind-badge-reintegra-si">
              <span class="reintegra-desktop">&#9989; S&Igrave; (Disponibile)</span>
              <span class="reintegra-mobile">&#9989; Da reintegrare</span>
            </span>`;

        const serieABadge = p.squadraSerieA
          ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.82rem;color:var(--text-primary);font-weight:600;">
              ${this._teamLogoHtml(p.squadraSerieA, 18)} ${this._esc(p.squadraSerieA)}
            </span>`
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const motivoDisplay = p.isStillOut
          ? this._esc(p.motivo)
          : '<span style="color:#22c55e;font-weight:600;">&#10004; Guarito / Nessun infortunio</span>';

        // Se da reintegrare: non scrivere "Subito" ma lasciare il valore vuoto; su mobile rimuovere la riga
        const hasRientro = Boolean(p.isStillOut && p.ind && p.ind.Rientro);
        const rientroContent = hasRientro
          ? `<span title="Previsione rientro">&#9201; ${this._esc(p.ind.Rientro)}</span>`
          : '<span class="ind-status-placeholder">&mdash;</span>';

        const rientroClass = hasRientro ? 'ind-col-rientro' : 'ind-col-rientro ind-rientro-empty';

        html += `
          <div class="ind-player-row">
            <!-- 1. Calciatore -->
            <div class="ind-col-player">
              ${this._playerPhotoHtml(codice)}
              ${ruolo ? `<span class="ind-role-badge ind-role-${ruolo}">${this._roleName(ruolo)}</span>` : ''}
              <div class="ind-player-info">
                <span class="ind-player-name in-lista">${this._esc(p.playerName)}</span>
                <div class="ind-team-mobile">${serieABadge}</div>
              </div>
            </div>

            <!-- 2. Squadra Serie A -->
            <div class="ind-col-team ind-team-desktop">${serieABadge}</div>

            <!-- 3. Motivo Indisponibilità -->
            <div class="ind-col-motivo">
              <span>${motivoDisplay}</span>
            </div>

            <!-- 4. Da Reintegrare -->
            <div class="ind-col-status">${reintegraBadge}</div>

            <!-- 5. Previsione Rientro -->
            <div class="${rientroClass}">${rientroContent}</div>
          </div>
        `;
      }
    }
    return html;
  }
};

if (typeof window !== 'undefined') {
  window.indisponibiliView = indisponibiliView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = indisponibiliView;
}
