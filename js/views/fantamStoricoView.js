/**
 * FANTAMISTER STORICO VIEW
 * Archivio storico e record all-time delle scelte dei fantallenatori su tutte le 14 stagioni
 * ModernFCM - SPA Native
 */

const fantamStoricoView = {
  currentTab: 'fantamister', // 'fantamister', 'moduli', 'records', 'bestrose', 'fantabomber', 'incompresi', 'uomopartita', 'topflop', 'fantasfiga', 'stagioni'
  selectedCompId: 0,
  selectedSeason: 14,
  sortCol: 'scartoMedioPesato',
  sortAsc: true,
  searchScorer: '',
  searchMom: '',
  searchIncompresi: '',
  topFlopType: 'top',        // 'top' | 'flop'
  topFlopScope: 'alltime',   // 'alltime' | 'season'
  topFlopSeason: 14,
  topFlopModule: 'auto',
  bomberScope: 'alltime',    // 'alltime' | 'season'
  bomberSeason: 14,
  momScope: 'alltime',       // 'alltime' | 'season'
  momSeason: 14,
  moduliScope: 'alltime',    // 'alltime' | 'season'
  moduliSeason: 14,
  moduliSubTab: 'dettaglio', // 'dettaglio' | 'globale'
  fantasfigaScope: 'alltime',// 'alltime' | 'season'
  fantasfigaSeason: 14,
  bestRoseScope: 'alltime',  // 'alltime' | 'season'
  bestRoseSeason: 14,
  data: null,

  /**
   * Formatta lo scarto pesato (.877 se < 1, 1.042 se >= 1)
   */
  formatScartoPesato(val) {
    if (val === undefined || val === null || isNaN(val)) return '-';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '-';
    if (num >= 1) return num.toFixed(3);
    return `.${String(Math.round(num * 1000)).padStart(3, '0')}`;
  },

  isFavTeam(teamIdOrName) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.isFavoriteTeam === 'function') {
      return fcmDataLoader.isFavoriteTeam(teamIdOrName);
    }
    return false;
  },

  getPlayerLink(name, code = null, season = null, id = null) {
    if (!name) return null;
    const clean = String(name).toLowerCase();
    if (clean.includes("riserva d'ufficio") || clean.includes("assente") || clean.includes("---")) return null;
    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) {
      return fcmDataLoader.getPlayerProfileLink({ name, code, season, id });
    }
    return `#schede_giocatori?name=${encodeURIComponent(name)}`;
  },

  getTeamLogo(teamId, teamName) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function') {
      return fcmDataLoader.getTeamLogo(teamId || teamName);
    }
    return `img/sq/${encodeURI(teamName || 'undefined')}.gif`;
  },

  /**
   * Genera il link corretto alla pagina #rose passando il parametro albo={alboId}
   * e come fallback opzionale teamName={name}
   */
  getTeamRoseLink(teamId, teamName = null) {
    const alboId = parseInt(teamId, 10);
    if (alboId && !isNaN(alboId) && alboId > 0) {
      return `#rose?albo=${alboId}${teamName ? `&teamName=${encodeURIComponent(teamName)}` : ''}`;
    }
    return teamName ? `#rose?teamName=${encodeURIComponent(teamName)}` : '#rose';
  },

  getPlayerPhoto(name) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function') {
      return fcmDataLoader.getPlayerPhoto(name);
    }
    return 'img/foto/misterx.gif';
  },

  getPlayerPhotoByCode(code, name) {
    if (code) {
      return `img/foto/${code}.jpg`;
    }
    return this.getPlayerPhoto(name);
  },

  getSerieALogo(club) {
    if (club && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieALogo === 'function') {
      return fcmDataLoader.getSerieALogo(club);
    }
    return '';
  },

  getRoleBadge(role) {
    const r = String(role || '').toUpperCase();
    let cls = 'P';
    if (r === 'D' || r === '2') cls = 'D';
    else if (r === 'C' || r === '3') cls = 'C';
    else if (r === 'A' || r === '4') cls = 'A';
    return `<span class="fm-role-badge fm-role-${cls}">${cls}</span>`;
  },

  getSeasonYears(s) {
    if (this.data && this.data.seasonYears && this.data.seasonYears[s]) {
      return this.data.seasonYears[s];
    }
    const start = 2012 + parseInt(s, 10);
    return `${start}/${start + 1}`;
  },

  getSeasonLabel(s) {
    return `Stagione ${s} (${this.getSeasonYears(s)})`;
  },

  getAvailableSeasons() {
    if (this.data && this.data.seasonYears) {
      return Object.keys(this.data.seasonYears).map(n => parseInt(n, 10)).sort((a, b) => b - a);
    }
    return [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  },

  getActiveCompData() {
    if (this.data && this.data.byComp) {
      if (this.data.byComp[this.selectedCompId]) {
        return this.data.byComp[this.selectedCompId];
      }
      return this.data.byComp[0] || this.data;
    }
    return this.data;
  },

  renderClubsList(clubs) {
    if (!Array.isArray(clubs) || clubs.length === 0) return '<span style="color:var(--text-muted);">-</span>';
    return `
      <div style="display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;">
        ${clubs.map(c => {
          const logo = this.getSerieALogo(c);
          return `
            <span class="fm-club-tag" style="text-transform:none;display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.06);border:1px solid var(--border-subtle);padding:2px 6px;border-radius:6px;font-size:0.75rem;">
              ${logo ? `<img src="${logo}" alt="" style="width:12px;height:12px;object-fit:contain;" onerror="this.style.display='none';" />` : ''}
              <span style="text-transform:none;">${c}</span>
            </span>
          `;
        }).join('')}
      </div>
    `;
  },

  renderFantasquadreList(fantasquadre) {
    if (!Array.isArray(fantasquadre) || fantasquadre.length === 0) return '<span style="color:var(--text-muted);">-</span>';
    return `
      <div style="display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;">
        ${fantasquadre.map(sq => {
          const isFav = this.isFavTeam(sq);
          const logo = this.getTeamLogo(null, sq);
          return `
            <span class="fm-team-tag" style="text-transform:none;display:inline-flex;align-items:center;gap:4px;background:${isFav ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.06)'};border:1px solid ${isFav ? 'var(--accent-primary)' : 'var(--border-subtle)'};padding:2px 6px;border-radius:6px;font-size:0.75rem;">
              <img src="${logo}" alt="" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(sq)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:12px;height:12px;object-fit:contain;" />
              ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span>' : ''}
              <span style="font-weight:600;color:var(--text-primary);text-transform:none;">${sq}</span>
            </span>
          `;
        }).join('')}
      </div>
    `;
  },

  async render(container) {
    // Parsing parametri URL opzionali (es. #fantamstorico?tab=moduli&comp=5)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('tab')) {
        const t = params.get('tab');
        const validTabs = ['fantamister', 'alltime', 'moduli', 'records', 'bestrose', 'fantabomber', 'incompresi', 'uomopartita', 'topflop', 'fantasfiga', 'stagioni'];
        if (validTabs.includes(t)) {
          this.currentTab = (t === 'alltime') ? 'fantamister' : t;
        }
      }
      if (params.has('comp')) {
        const c = parseInt(params.get('comp'), 10);
        if (!isNaN(c)) this.selectedCompId = c;
      }
      if (params.has('stg') || params.has('stagione') || params.has('season')) {
        const s = parseInt(params.get('stg') || params.get('stagione') || params.get('season'), 10);
        if (!isNaN(s)) {
          this.selectedSeason = s;
          this.topFlopSeason = s;
          this.bomberSeason = s;
          this.momSeason = s;
          this.moduliSeason = s;
          this.fantasfigaSeason = s;
          this.bestRoseSeason = s;
        }
      }
    }

    const tabs = [
      { id: 'fantamister', icon: '🏆', label: 'Classifica FantaMister' },
      { id: 'moduli', icon: '📊', label: 'Dettaglio Modulo' },
      { id: 'records', icon: '⚡', label: 'Primati & Record' },
      { id: 'bestrose', icon: '🌹', label: 'Migliori Rose' },
      { id: 'fantabomber', icon: '⚽', label: 'Fantabomber' },
      { id: 'incompresi', icon: '🤦', label: 'Gli Incompresi' },
      { id: 'uomopartita', icon: '🌟', label: 'Migliore in Campo' },
      { id: 'topflop', icon: '🔝', label: 'Top & Flop 11' },
      { id: 'fantasfiga', icon: '🍀', label: 'Fantasfiga' },
      { id: 'stagioni', icon: '📅', label: 'Archivio Stagioni' }
    ];

    container.innerHTML = `
      <style>
        .fm-storico-wrap { max-inline-size: 100%; display: flex; flex-direction: column; gap: 18px; }
        
        /* Griglia Tab 5x2 su Desktop e 2x5 su Mobile (pill-btn come #fantam) */
        #fmStoricoMainTabs {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        #fmStoricoMainTabs .pill-btn {
          width: 100% !important;
          min-width: 0 !important;
          height: 100% !important;
          min-height: 40px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          font-size: 0.84rem !important;
          font-weight: 700 !important;
          border-radius: var(--radius-md, 8px) !important;
          padding: 8px 6px !important;
          box-sizing: border-box !important;
          background: var(--bg-surface) !important;
          border: 1px solid var(--border-subtle) !important;
          color: var(--text-secondary) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          text-align: center !important;
          white-space: normal !important;
          word-break: break-word !important;
          cursor: pointer !important;
        }
        #fmStoricoMainTabs .pill-btn:hover {
          background: var(--bg-surface-elevated) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-focus) !important;
        }
        #fmStoricoMainTabs .pill-btn.active {
          background: var(--accent-primary) !important;
          color: #fff !important;
          border-color: var(--accent-primary) !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
        }
        #fmStoricoMainTabs .pill-btn:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }

        @media (max-width: 768px) {
          #fmStoricoMainTabs {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          #fmStoricoMainTabs .pill-btn {
            font-size: 0.78rem !important;
            padding: 7px 4px !important;
          }
        }

        /* Non forzare maiuscole su squadre e club */
        .fantam-team-name-text,
        .fm-team-tag,
        .fm-club-tag,
        .pitch-player-club,
        .pitch-player-club * {
          text-transform: none !important;
        }

        /* Tabelle e layout */
        .fm-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.88rem;
          text-align: right;
        }
        .fm-table caption {
          text-align: left;
          padding: 10px 14px;
          font-weight: 700;
          font-size: 0.95rem;
          background: var(--bg-surface-elevated, #222);
          color: var(--text-primary, #fff);
          border-bottom: 1px solid var(--border-subtle, #333);
        }
        .fm-table thead th {
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
          background: var(--bg-surface-elevated, #27272a);
          color: var(--text-secondary, #bbb);
          font-weight: 700;
          padding: 10px 12px;
          white-space: nowrap;
          border-bottom: 2px solid var(--border-subtle, #444);
          user-select: none;
        }
        .fm-table thead th button {
          all: unset;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: inherit;
          font-weight: inherit;
        }
        .fm-table thead th button:focus-visible { outline: 2px solid var(--accent-primary, #0284c7); }
        .fm-table tbody th {
          position: sticky;
          inset-inline-start: 0;
          z-index: 1;
          background: var(--bg-surface, #18181b);
          text-align: left;
          font-weight: 700;
          color: var(--text-primary, #fff);
          padding: 10px 14px;
          white-space: nowrap;
          border-bottom: 1px solid var(--border-subtle, #27272a);
        }
        .fm-table thead th:first-child {
          inset-inline-start: 0;
          z-index: 3;
          text-align: left;
        }
        .fm-table tbody td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--border-subtle, #27272a);
          white-space: nowrap;
          color: var(--text-primary, #eee);
        }
        .fm-table tbody tr:hover td {
          background: rgba(255, 255, 255, 0.04);
        }
        .fm-table tbody tr:hover th {
          background: var(--bg-surface-elevated, #242427);
        }

        /* Record Duo Cards: 50% Desktop, Horizontal Snap Swipe su Mobile */
        .fm-duo-cards {
          display: flex;
          gap: 16px;
          width: 100%;
        }
        .fm-duo-card {
          flex: 1 1 calc(50% - 8px);
          min-width: 0;
        }
        @media (max-width: 768px) {
          .fm-duo-cards {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 12px;
            padding-bottom: 8px;
          }
          .fm-duo-card {
            flex: 0 0 88%;
            min-width: 88%;
            scroll-snap-align: start;
          }
        }

        .fm-record-card {
          background: var(--bg-surface, #1e1e24);
          border: 1px solid var(--border-subtle, #333);
          border-radius: var(--radius-md, 8px);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .fm-record-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-subtle, #333);
          padding-bottom: 8px;
        }
        .fm-record-card-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary, #fff);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .fm-record-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .fm-record-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          background: var(--bg-surface-elevated, #25252b);
          border-radius: 6px;
          font-size: 0.85rem;
          transition: background 0.15s;
        }
        .fm-record-item:hover { background: rgba(255, 255, 255, 0.05); }
        .fm-record-item.is-fav {
          border-left: 3px solid var(--accent-primary, #0284c7);
          background: rgba(2, 132, 199, 0.08);
        }

        .fm-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .fm-badge-gold { background: rgba(234, 179, 8, 0.15); color: var(--accent-gold, #eab308); }
        .fm-badge-emerald { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald, #10b981); }
        .fm-badge-rose { background: rgba(244, 63, 94, 0.15); color: var(--accent-rose, #f43f5e); }
        .fm-badge-cyan { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan, #06b6d4); }

        .fm-role-badge {
          display: inline-block;
          inline-size: 18px;
          block-size: 18px;
          line-height: 18px;
          text-align: center;
          font-size: 0.7rem;
          font-weight: 800;
          border-radius: 50%;
          color: #fff;
        }
        .fm-role-P { background: #eab308; }
        .fm-role-D { background: #10b981; }
        .fm-role-C { background: #06b6d4; }
        .fm-role-A { background: #ef4444; }

        .fm-player-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fm-player-thumb {
          inline-size: 30px;
          block-size: 30px;
          border-radius: 50%;
          object-fit: cover;
          background: var(--bg-surface-elevated, #333);
          border: 1px solid var(--border-subtle, #444);
          flex-shrink: 0;
        }

        .fav-team-star {
          color: var(--accent-gold, #f59e0b);
          font-size: 0.95rem;
          display: inline-block;
        }
      </style>

      <div class="fantam-native-page fm-storico-wrap">
        <!-- Header con stile identico a #fantam: titolo, sottotitolo, competizione e pill-tabs dentro la card -->
        <div class="card" style="padding:18px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
            <div>
              <div class="card-title" style="display:flex;align-items:center;gap:8px;">
                <!-- SVG FantaMister in blu (var(--accent-primary)) -->
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-primary, #0284c7);stroke:var(--accent-primary, #0284c7);flex-shrink:0;">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                  <path d="M2 2l7.5 6"></path>
                  <path d="M22 2l-7.5 6"></path>
                  <path d="M10.5 7h3l.5 2-2 1-2-1 .5-2z"></path>
                  <path d="M11 10l-1.5 7 2.5 3.5 2.5-3.5-1.5-7"></path>
                </svg>
                <span>FantaMister Storico</span>
              </div>
              <div class="card-subtitle" id="fmStoricoSubtitle">Analisi tattica all-time, record, moduli, fantabomber e classifiche storiche su 14 stagioni</div>
            </div>

            <!-- Selettore Competizione Dedicato (come #fantam) -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:6px;">
                <label for="selFantamStoricoComp" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Competizione:</label>
                <select id="selFantamStoricoComp" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:180px;font-size:0.88rem;">
                  <option value="0">Tutte le competizioni</option>
                </select>
              </div>

              <span class="badge" style="background:rgba(59,130,246,0.15);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.3);font-weight:700;font-size:0.75rem;">
                1ª - 14ª Stagione
              </span>
            </div>
          </div>

          <!-- Navigazione Pill-Tabs Principale dentro la card di testa (5x2 desktop / 2x5 mobile) -->
          <div id="fmStoricoMainTabs" role="tablist" aria-label="Sezioni FantaMister Storico">
            ${tabs.map(t => `
              <button type="button" class="pill-btn ${(this.currentTab === t.id || (t.id === 'fantamister' && this.currentTab === 'alltime')) ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${this.currentTab === t.id || (t.id === 'fantamister' && this.currentTab === 'alltime')}">
                <span>${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Contenitore Tab Attivo -->
        <div id="fmStoricoContent">
          ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.fantamStorico() : `
            <div class="text-center" style="padding:40px;color:var(--text-muted);">
              Caricamento dati FantaMister Storico...
            </div>
          `}
        </div>
      </div>
    `;

    // Carica dati da fcmDataLoader
    if (!this.data) {
      try {
        this.data = await fcmDataLoader.loadFantamisterStorico();
      } catch (err) {
        console.error('Errore caricamento dati FantaMister Storico:', err);
      }
    }

    if (!this.data || !this.data.byComp) {
      const content = container.querySelector('#fmStoricoContent');
      if (content) {
        content.innerHTML = `
          <div class="text-center" style="padding:40px;color:var(--accent-rose, #ef4444);">
            Impossibile caricare i dati storici del FantaMister. Assicurati che l'archivio SQLite sia generato.
          </div>
        `;
      }
      return;
    }

    // Popola select competizioni
    const compSelect = container.querySelector('#selFantamStoricoComp');
    if (compSelect && this.data.competitions) {
      compSelect.innerHTML = this.data.competitions
        .map(c => `<option value="${c.id}" ${c.id === this.selectedCompId ? 'selected' : ''}>${c.name}</option>`)
        .join('');
    }

    this.bindEvents(container);
    this.renderActiveTab(container);
  },

  bindEvents(container) {
    // 1. Cambio competizione
    const compSelect = container.querySelector('#selFantamStoricoComp');
    if (compSelect) {
      compSelect.onchange = (e) => {
        this.selectedCompId = parseInt(e.target.value, 10);
        this.renderActiveTab(container);
      };
    }

    // 2. Tab switcher
    const tabBtns = container.querySelectorAll('#fmStoricoMainTabs .pill-btn');
    tabBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this.currentTab) {
          this.currentTab = tab;
          tabBtns.forEach(b => {
            const isAct = b.getAttribute('data-tab') === tab;
            b.classList.toggle('active', isAct);
            b.setAttribute('aria-selected', isAct ? 'true' : 'false');
          });
          this.renderActiveTab(container);
        }
      };
    });
  },

  renderActiveTab(container) {
    const content = container.querySelector('#fmStoricoContent');
    if (!content) return;

    const compData = this.getActiveCompData();
    if (!compData) {
      content.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);">Nessun dato per questa competizione.</div>`;
      return;
    }

    switch (this.currentTab) {
      case 'fantamister':
      case 'alltime':
        this.renderAllTimeTab(content, compData);
        break;
      case 'moduli':
        this.renderModuliTab(content, compData);
        break;
      case 'records':
        this.renderRecordsTab(content, compData);
        break;
      case 'bestrose':
        this.renderBestRoseTab(content, compData);
        break;
      case 'fantabomber':
        this.renderFantabomberTab(content, compData);
        break;
      case 'incompresi':
        this.renderIncompresiTab(content, compData);
        break;
      case 'uomopartita':
        this.renderUomoPartitaTab(content, compData);
        break;
      case 'topflop':
        this.renderTopFlopTab(content, compData);
        break;
      case 'fantasfiga':
        this.renderFantasfigaTab(content, compData);
        break;
      case 'stagioni':
        this.renderStagioniTab(content, compData);
        break;
      default:
        this.renderAllTimeTab(content, compData);
        break;
    }
  },

  /**
   * 1. TAB: Classifica FantaMister (Generale All-Time, senza colonna Titoli)
   */
  renderAllTimeTab(container, compData) {
    const list = [...(compData.allTime || [])];

    // Ordinamento
    list.sort((a, b) => {
      let va = a[this.sortCol];
      let vb = b[this.sortCol];
      if (typeof va === 'string') {
        return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return this.sortAsc ? (va - vb) : (vb - va);
    });

    const sortIndicator = (col) => {
      if (this.sortCol !== col) return '';
      return this.sortAsc ? '▲' : '▼';
    };

    container.innerHTML = `
      <div id="panel-fm-alltime" role="tabpanel" aria-labelledby="tab-btn-fantamister" class="card" style="padding:16px;">
        <div style="margin-bottom:12px;">
          <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span>🏆</span>
            <span>Classifica FantaMister All-Time (${compData.name})</span>
          </h3>
          <div style="font-size:0.83rem;color:var(--text-muted);">
            Graduatoria storica basata sullo Scarto Medio Pesato tra formazione reale schierata e formazione ideale calcolabile su tutte le gare disputate.
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <caption class="sr-only">Classifica FantaMister All-Time</caption>
            <thead>
              <tr>
                <th scope="col" style="inline-size:40px;text-align:center;">#</th>
                <th scope="col" style="min-inline-size:180px;text-align:left;">
                  <button type="button" data-sort="teamName">Fantasquadra ${sortIndicator('teamName')}</button>
                </th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="seasons">Stagioni ${sortIndicator('seasons')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="matches">Partite ${sortIndicator('matches')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="scartoMedio">Scarto Medio ${sortIndicator('scartoMedio')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="scartoMedioPesato">Scarto Pesato ${sortIndicator('scartoMedioPesato')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="scartoZeroPct">% Scarto 0 ${sortIndicator('scartoZeroPct')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="mediaReale">Media Reale ${sortIndicator('mediaReale')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="mediaIdeale">Media Ideale ${sortIndicator('mediaIdeale')}</button></th>
                <th scope="col" style="text-align:center;"><button type="button" data-sort="puntiPersi">Punti Persi ${sortIndicator('puntiPersi')}</button></th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
                const isFav = this.isFavTeam(item.teamId) || this.isFavTeam(item.teamName);
                const pesatoStr = this.formatScartoPesato(item.scartoMedioPesato);
                return `
                  <tr style="${isFav ? 'background:rgba(2, 132, 199, 0.08);' : ''}">
                    <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
                    <th scope="row" style="text-align:left;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.teamName)}" class="fantam-team-link" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                        <img src="${this.getTeamLogo(item.teamId, item.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="font-weight:700;color:var(--text-primary);text-transform:none;">${item.teamName}</span>
                      </a>
                    </th>
                    <td style="text-align:center;color:var(--text-secondary);">${item.seasons}</td>
                    <td style="text-align:center;color:var(--text-secondary);">${item.matches}</td>
                    <td style="text-align:center;font-weight:700;color:var(--accent-rose, #f43f5e);">${item.scartoMedio.toFixed(3)}</td>
                    <td style="text-align:center;">
                      <span class="fm-badge fm-badge-gold" style="font-size:0.88rem;padding:3px 10px;">${pesatoStr}</span>
                    </td>
                    <td style="text-align:center;color:var(--text-secondary);">${item.scartoZeroPct.toFixed(1)}% (${item.scartoZero})</td>
                    <td style="text-align:center;color:var(--accent-primary, #0284c7);">${item.mediaReale.toFixed(2)}</td>
                    <td style="text-align:center;font-weight:700;color:var(--accent-emerald, #10b981);">${item.mediaIdeale.toFixed(2)}</td>
                    <td style="text-align:center;color:var(--text-muted);">${item.puntiPersi.toFixed(1)} pt</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind bottoni ordinamento colonne
    const sortButtons = container.querySelectorAll('.fm-table thead button');
    sortButtons.forEach(btn => {
      btn.onclick = () => {
        const col = btn.getAttribute('data-sort');
        if (this.sortCol === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortCol = col;
          this.sortAsc = (col === 'scartoMedio' || col === 'scartoMedioPesato' || col === 'teamName');
        }
        this.renderAllTimeTab(container, compData);
      };
    });
  },

  /**
   * 2. TAB: Dettaglio Modulo (Come #fantam: Dettaglio per Fantasquadra e Globale Migliori Moduli)
   */
  renderModuliTab(container, compData) {
    const isSeason = this.moduliScope === 'season';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.moduliSeason || seasonKeys[0] || 14;

    const allowedMods = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];

    // Estrai dati modulo all-time o per stagione
    let moduliData = { teams: [], global: {} };
    if (isSeason) {
      if (compData.moduli && compData.moduli.bySeason && compData.moduli.bySeason[activeSeason]) {
        moduliData = compData.moduli.bySeason[activeSeason];
      }
    } else {
      if (compData.moduli && compData.moduli.allTime) {
        moduliData = compData.moduli.allTime;
      }
    }

    const teams = moduliData.teams || [];
    const globalMap = moduliData.global || {};

    let totalOccurrences = 0;
    allowedMods.forEach(m => { totalOccurrences += (globalMap[m] || 0); });
    const globalList = allowedMods.map(m => {
      const count = globalMap[m] || 0;
      const pct = totalOccurrences > 0 ? ((count / totalOccurrences) * 100) : 0;
      return { modulo: m, count, percent: pct };
    }).sort((a, b) => b.count - a.count);

    container.innerHTML = `
      <div id="panel-fm-moduli" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>📊</span>
              <span>Dettaglio Moduli Tattici Ottimali (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Distribuzione dei moduli tattici che hanno garantito il punteggio teorico massimo alle formazioni.
            </div>
          </div>

          <!-- Pulsantiera Ambito: All-Time vs Stagione -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:3px;border-radius:20px;border:1px solid var(--border-subtle);gap:4px;">
              <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-moduli-scope="alltime" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
              <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-moduli-scope="season" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">📅 Per Stagione</button>
            </div>

            ${isSeason ? `
              <select id="selModuliSeason" class="form-control" style="font-weight:700;padding:4px 10px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.84rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <!-- Sotto-Tab Switcher: Per Squadra vs Globale -->
        <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--border-subtle);padding-bottom:10px;">
          <button type="button" class="pill-btn ${this.moduliSubTab === 'dettaglio' ? 'active' : ''}" data-moduli-sub="dettaglio" style="font-size:0.82rem;padding:6px 14px;border-radius:16px;">
            📐 Dettaglio per Fantasquadra
          </button>
          <button type="button" class="pill-btn ${this.moduliSubTab === 'globale' ? 'active' : ''}" data-moduli-sub="globale" style="font-size:0.82rem;padding:6px 14px;border-radius:16px;">
            📊 Globale Migliori Moduli
          </button>
        </div>

        ${this.moduliSubTab === 'dettaglio' ? `
          <!-- 1. DETTAGLIO PER FANTASQUADRA -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
            ${teams.map(team => {
              const isFav = this.isFavTeam(team.teamId) || this.isFavTeam(team.teamName);
              const optMap = team.modulesOptimal || {};

              let maxFreq = 0;
              let topMod = '';
              allowedMods.forEach(m => {
                const count = optMap[m] || 0;
                if (count > maxFreq) { maxFreq = count; topMod = m; }
              });

              return `
                <div style="background:${isFav ? 'rgba(59,130,246,0.08)' : 'var(--bg-surface)'};border:1px solid ${isFav ? 'var(--accent-primary)' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:14px 16px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
                    <a href="${this.getTeamRoseLink(team.teamId, team.teamName)}" class="fantam-team-link" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                      <img src="${this.getTeamLogo(team.teamId, team.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(team.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                      ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                      <span class="fantam-team-name-text" style="font-weight:900;color:var(--text-primary);font-size:0.95rem;text-transform:none;">${team.teamName}</span>
                    </a>
                    ${topMod ? `<span class="badge" style="background:rgba(245,158,11,0.15);color:var(--accent-gold, #f59e0b);border:1px solid rgba(245,158,11,0.3);font-size:0.75rem;font-weight:800;">Top: ${topMod} (${maxFreq})</span>` : ''}
                  </div>

                  <div style="display:flex;flex-direction:column;gap:6px;">
                    ${allowedMods.map(mod => {
                      const count = optMap[mod] || 0;
                      const pct = maxFreq > 0 ? Math.round((count / maxFreq) * 100) : 0;
                      const isTop = count === maxFreq && maxFreq > 0;
                      return `
                        <div style="display:flex;align-items:center;gap:10px;font-size:0.83rem;">
                          <span style="width:48px;font-weight:800;color:${isTop ? 'var(--accent-primary)' : 'var(--text-primary)'};">${mod}</span>
                          <div style="flex:1;height:7px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${isTop ? 'var(--accent-primary)' : 'var(--accent-cyan)'};border-radius:4px;"></div>
                          </div>
                          <span style="width:28px;text-align:right;font-weight:700;color:${isTop ? 'var(--accent-primary)' : 'var(--text-muted)'};">${count}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- 2. GLOBALE MIGLIORI MODULI -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${globalList.map(m => `
              <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px 16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-weight:900;font-size:1.1rem;color:var(--accent-primary);">${m.modulo}</span>
                  <div style="font-size:1.05rem;font-weight:900;color:var(--text-primary);">
                    ${m.percent.toFixed(2)}% <span style="font-size:0.78rem;font-weight:normal;color:var(--text-muted);">(${m.count} occorrenze)</span>
                  </div>
                </div>
                <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${m.percent}%;background:linear-gradient(90deg, var(--accent-primary), var(--accent-cyan));border-radius:4px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Eventi switch ambito, stagione e sotto-tab
    const scopeBtns = container.querySelectorAll('[data-moduli-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.moduliScope = btn.getAttribute('data-moduli-scope');
        this.renderModuliTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selModuliSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.moduliSeason = parseInt(e.target.value, 10);
        this.renderModuliTab(container, compData);
      };
    }

    const subBtns = container.querySelectorAll('[data-moduli-sub]');
    subBtns.forEach(btn => {
      btn.onclick = () => {
        this.moduliSubTab = btn.getAttribute('data-moduli-sub');
        this.renderModuliTab(container, compData);
      };
    });
  },

  /**
   * 3. TAB: Primati & Record (Miglior 11 Ideale & I Rimpianti Storici 50% Desktop / Swipe Mobile)
   */
  renderRecordsTab(container, compData) {
    const { topIdeali = [], worstScarti = [] } = (compData.records || {});

    container.innerHTML = `
      <div id="panel-fm-records" role="tabpanel" aria-labelledby="tab-btn-records" style="display:flex;flex-direction:column;gap:16px;">
        
        <!-- Riga: Miglior 11 Ideale e I Rimpianti (50% su Desktop, Swipe Card su Mobile) -->
        <div class="fm-duo-cards">
          <!-- CARD 1: Miglior 11 Ideale di Sempre -->
          <div class="fm-record-card fm-duo-card">
            <div class="fm-record-card-head">
              <div class="fm-record-card-title">
                <span>🚀</span> Miglior 11 Ideale Assoluto
              </div>
              <span class="fm-badge fm-badge-emerald">Top Max Punti</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">
              Il punteggio teorico massimo mai raggiungibile in una singola giornata.
            </div>
            <ul class="fm-record-list">
              ${topIdeali.slice(0, 10).map((r, i) => {
                const isFav = this.isFavTeam(r.teamId) || this.isFavTeam(r.teamName);
                const yearsStr = r.seasonYears || this.getSeasonYears(r.season);
                return `
                  <li class="fm-record-item ${isFav ? 'is-fav' : ''}">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                      <span style="font-weight:700;color:var(--text-primary);display:inline-flex;align-items:center;gap:6px;">
                        <img src="${this.getTeamLogo(r.teamId, r.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(r.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:16px;height:16px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="text-transform:none;">${i + 1}. ${r.teamName}</span>
                      </span>
                      <span style="font-size:0.75rem;color:var(--text-muted);">Stagione ${r.season} (${yearsStr}) - Giornata ${r.matchday} &bull; Modulo ${r.module}</span>
                    </div>
                    <div style="text-align:right;">
                      <span style="font-size:1.05rem;font-weight:800;color:var(--accent-emerald, #10b981);">${r.idealScore} pt</span>
                      <div style="font-size:0.72rem;color:var(--text-muted);">Reale: ${r.realScore}</div>
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>

          <!-- CARD 2: I Rimpianti Storici (Peggiori Scarti) -->
          <div class="fm-record-card fm-duo-card">
            <div class="fm-record-card-head">
              <div class="fm-record-card-title">
                <span>💔</span> I Rimpianti Storici
              </div>
              <span class="fm-badge fm-badge-rose">Max Scarto Singola Gara</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">
              Le scelte più disastrose di sempre: il maggior numero di punti lasciati in panchina.
            </div>
            <ul class="fm-record-list">
              ${worstScarti.slice(0, 10).map((r, i) => {
                const isFav = this.isFavTeam(r.teamId) || this.isFavTeam(r.teamName);
                const yearsStr = r.seasonYears || this.getSeasonYears(r.season);
                return `
                  <li class="fm-record-item ${isFav ? 'is-fav' : ''}">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                      <span style="font-weight:700;color:var(--text-primary);display:inline-flex;align-items:center;gap:6px;">
                        <img src="${this.getTeamLogo(r.teamId, r.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(r.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:16px;height:16px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="text-transform:none;">${i + 1}. ${r.teamName}</span>
                      </span>
                      <span style="font-size:0.75rem;color:var(--text-muted);">Stagione ${r.season} (${yearsStr}) - Giornata ${r.matchday}</span>
                    </div>
                    <div style="text-align:right;">
                      <span style="font-size:1.05rem;font-weight:800;color:var(--accent-rose, #f43f5e);">-${r.scarto} pt</span>
                      <div style="font-size:0.72rem;color:var(--text-muted);">Reale ${r.realScore} (Ideale ${r.idealScore})</div>
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 4. TAB: Migliori Rose (All-Time e Per Stagione)
   */
  renderBestRoseTab(container, compData) {
    const isSeason = this.bestRoseScope === 'season';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.bestRoseSeason || seasonKeys[0] || 14;

    const list = isSeason
      ? ((compData.bestRose && compData.bestRose.bySeason && compData.bestRose.bySeason[activeSeason]) || [])
      : ((compData.bestRose && compData.bestRose.allTime) || []);

    container.innerHTML = `
      <div id="panel-fm-bestrose" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🌹</span>
              <span>Classifica Migliori Rose (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Rendimento potenziale medio dell'intera rosa dei calciatori schierabile in campo.
            </div>
          </div>

          <!-- Pulsantiera Ambito -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:3px;border-radius:20px;border:1px solid var(--border-subtle);gap:4px;">
              <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-rose-scope="alltime" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
              <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-rose-scope="season" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">📅 Per Stagione</button>
            </div>

            ${isSeason ? `
              <select id="selBestRoseSeason" class="form-control" style="font-weight:700;padding:4px 10px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.84rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Fantasquadra</th>
                <th style="text-align:center;">Partite</th>
                <th style="text-align:center;">Media Potenziale Rosa</th>
              </tr>
            </thead>
            <tbody>
              ${list.length > 0 ? list.map((item, idx) => {
                const isFav = this.isFavTeam(item.teamId) || this.isFavTeam(item.teamName);
                return `
                  <tr style="${isFav ? 'background:rgba(2, 132, 199, 0.08);' : ''}">
                    <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
                    <th style="font-weight:700;text-align:left;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.teamName)}" class="fantam-team-link" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                        <img src="${this.getTeamLogo(item.teamId, item.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="color:var(--text-primary);text-transform:none;">${item.teamName}</span>
                      </a>
                    </th>
                    <td style="text-align:center;color:var(--text-secondary);">${item.matches}</td>
                    <td style="text-align:center;">
                      <span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald, #10b981);font-weight:900;font-size:0.95rem;padding:4px 12px;border-radius:12px;">
                        ${item.bestRoseMedio.toFixed(2)} pt
                      </span>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Nessun dato disponibile.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventi pulsantiera ambito e stagione
    const scopeBtns = container.querySelectorAll('[data-rose-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.bestRoseScope = btn.getAttribute('data-rose-scope');
        this.renderBestRoseTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selBestRoseSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.bestRoseSeason = parseInt(e.target.value, 10);
        this.renderBestRoseTab(container, compData);
      };
    }
  },

  /**
   * Helper per righe Fantabomber (utilizzato per non perdere il focus durante la ricerca)
   */
  renderBomberRows(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nessun fantabomber trovato.</td></tr>`;
    }
    return list.slice(0, 150).map((p, idx) => {
      const href = this.getPlayerLink(p.name);
      const photoUrl = this.getPlayerPhotoByCode(p.code, p.name);
      const clubsList = (p.clubs && p.clubs.length > 0) ? p.clubs : (p.club ? [p.club] : []);
      const sqList = (p.fantasquadre && p.fantasquadre.length > 0) ? p.fantasquadre : (p.teamName ? [p.teamName] : []);
      return `
        <tr>
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
          <th style="font-weight:700;">
            <div class="fm-player-cell">
              <img src="${photoUrl}" class="fm-player-thumb" alt="" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
              ${href ? `<a href="${href}" style="color:inherit;text-decoration:none;" title="Apri scheda giocatore">${p.name}</a>` : `<span>${p.name}</span>`}
            </div>
          </th>
          <td style="text-align:center;">${this.getRoleBadge(p.role)}</td>
          <td style="text-align:left;">${this.renderClubsList(clubsList)}</td>
          <td style="text-align:left;">${this.renderFantasquadreList(sqList)}</td>
          <td style="text-align:center;">
            <span class="badge" style="background:rgba(239,68,68,0.15);color:var(--accent-crimson, #ef4444);font-weight:900;font-size:0.95rem;padding:3px 10px;border-radius:12px;">
              ⚽ ${p.goals}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 5. TAB: Fantabomber (Niente scroller interno, input con focus stabile, nessuna forzatura maiuscola)
   */
  renderFantabomberTab(container, compData) {
    const isSeason = this.bomberScope === 'season';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.bomberSeason || seasonKeys[0] || 14;

    const getFilteredList = () => {
      let list = isSeason
        ? ((compData.fantabomber && compData.fantabomber.bySeason && compData.fantabomber.bySeason[activeSeason]) || [])
        : ((compData.fantabomber && compData.fantabomber.allTime) || []);

      if (this.searchScorer && this.searchScorer.trim()) {
        const q = this.searchScorer.trim().toLowerCase();
        list = list.filter(p => {
          const pName = String(p.name || '').toLowerCase();
          const clubsStr = Array.isArray(p.clubs) ? p.clubs.join(' ').toLowerCase() : String(p.club || '').toLowerCase();
          const sqStr = Array.isArray(p.fantasquadre) ? p.fantasquadre.join(' ').toLowerCase() : String(p.teamName || '').toLowerCase();
          return pName.includes(q) || clubsStr.includes(q) || sqStr.includes(q);
        });
      }
      return list;
    };

    container.innerHTML = `
      <div id="panel-fm-fantabomber" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>⚽</span>
              <span>Classifica Fantabomber (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Gol assegnati secondo l'algoritmo ufficiale FantaMister (-3 pt a ogni gol) nei tabellini delle gare.
            </div>
          </div>

          <!-- Pulsantiera Ambito: All-Time vs Stagione -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:3px;border-radius:20px;border:1px solid var(--border-subtle);gap:4px;">
              <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-bomber-scope="alltime" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
              <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-bomber-scope="season" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">📅 Per Stagione</button>
            </div>

            ${isSeason ? `
              <select id="selBomberSeason" class="form-control" style="font-weight:700;padding:4px 10px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.84rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <!-- Barra di ricerca rapida -->
        <div style="max-width:340px;margin-bottom:12px;">
          <input type="text" id="fmBomberSearch" class="form-control" placeholder="Cerca calciatore, club o fantasquadra..." value="${this.searchScorer}" style="width:100%;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.85rem;" />
        </div>

        <!-- Tabella a tutta altezza senza scroller interno forzato -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Calciatore</th>
                <th style="text-align:center;">Ruolo</th>
                <th style="text-align:left;">Squadre Serie A</th>
                <th style="text-align:left;">Fantasquadre</th>
                <th style="text-align:center;">Gol Assegnati</th>
              </tr>
            </thead>
            <tbody id="fmBomberTbody">
              ${this.renderBomberRows(getFilteredList())}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventi pulsantiera ambito
    const scopeBtns = container.querySelectorAll('[data-bomber-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.bomberScope = btn.getAttribute('data-bomber-scope');
        this.renderFantabomberTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selBomberSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.bomberSeason = parseInt(e.target.value, 10);
        this.renderFantabomberTab(container, compData);
      };
    }

    // Input di ricerca con aggiornamento mirato del solo tbody (il campo di testo NON perde il focus!)
    const searchInput = container.querySelector('#fmBomberSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchScorer = e.target.value;
        const tbody = container.querySelector('#fmBomberTbody');
        if (tbody) {
          tbody.innerHTML = this.renderBomberRows(getFilteredList());
        }
      };
    }
  },

  /**
   * Helper per righe Gli Incompresi (utilizzato per non perdere il focus durante la ricerca)
   */
  renderIncompresiRows(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">Nessun calciatore incompreso trovato con la soglia richiesta (&ge; 20 panchine).</td></tr>`;
    }
    return list.map((p, idx) => {
      const href = this.getPlayerLink(p.name);
      const photoUrl = this.getPlayerPhotoByCode(p.code, p.name);
      const clubsList = (p.clubs && p.clubs.length > 0) ? p.clubs : (p.club ? [p.club] : []);
      const sqList = p.fantasquadre || [];
      const netBonus = p.totBonusMalus || 0;
      return `
        <tr>
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
          <th style="font-weight:700;">
            <div class="fm-player-cell">
              <img src="${photoUrl}" class="fm-player-thumb" alt="" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
              ${href ? `<a href="${href}" style="color:inherit;text-decoration:none;" title="Apri scheda">${p.name}</a>` : `<span>${p.name}</span>`}
            </div>
          </th>
          <td style="text-align:center;">${this.getRoleBadge(p.role)}</td>
          <td style="text-align:left;">${this.renderClubsList(clubsList)}</td>
          <td style="text-align:left;">${this.renderFantasquadreList(sqList)}</td>
          <td style="text-align:center;font-weight:700;color:var(--text-primary);">${p.times}</td>
          <td style="text-align:center;">
            <span class="badge" style="background:rgba(234,179,8,0.15);color:var(--accent-gold, #eab308);font-weight:900;font-size:0.95rem;padding:3px 10px;border-radius:12px;">
              ${p.mediaFantavoto ? p.mediaFantavoto.toFixed(2) : '-'}
            </span>
          </td>
          <td style="text-align:center;font-weight:700;color:${netBonus > 0 ? 'var(--accent-emerald, #10b981)' : (netBonus < 0 ? 'var(--accent-crimson, #ef4444)' : 'var(--text-muted)')};">
            ${netBonus > 0 ? `+${netBonus}` : netBonus} pt
          </td>
          <td style="text-align:center;color:var(--text-muted);">${p.totPoints ? p.totPoints.toFixed(1) : '-'} pt</td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 6. TAB: Gli Incompresi (Nuovo Tab Separato, Tutta Altezza, Focus stabile alla digitazione)
   */
  renderIncompresiTab(container, compData) {
    const getFilteredList = () => {
      let list = [...((compData.records && compData.records.incompresi) || [])];
      if (this.searchIncompresi && this.searchIncompresi.trim()) {
        const q = this.searchIncompresi.trim().toLowerCase();
        list = list.filter(p => {
          const pName = String(p.name || '').toLowerCase();
          const clubsStr = Array.isArray(p.clubs) ? p.clubs.join(' ').toLowerCase() : String(p.club || '').toLowerCase();
          const sqStr = Array.isArray(p.fantasquadre) ? p.fantasquadre.join(' ').toLowerCase() : '';
          return pName.includes(q) || clubsStr.includes(q) || sqStr.includes(q);
        });
      }
      return list;
    };

    container.innerHTML = `
      <div id="panel-fm-incompresi" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🤦</span>
              <span>Classifica Gli Incompresi (Panchinari d'Oro)</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Calciatori con la più alta media fantavoto lasciati in panchina dai propri fantallenatori (soglia minima &ge; 20 panchine analizzate). Nel conteggio vengono inclusi tutti i bonus e malus netti.
            </div>
          </div>
        </div>

        <!-- Barra di ricerca rapida -->
        <div style="max-width:340px;margin-bottom:12px;">
          <input type="text" id="fmIncompresiSearch" class="form-control" placeholder="Cerca calciatore, club o fantasquadra..." value="${this.searchIncompresi}" style="width:100%;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.85rem;" />
        </div>

        <!-- Tabella a tutta altezza della pagina (senza altezza fissa né scroller interno) -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Calciatore</th>
                <th style="text-align:center;">Ruolo</th>
                <th style="text-align:left;">Squadre Serie A</th>
                <th style="text-align:left;">Fantasquadre</th>
                <th style="text-align:center;">Panchine</th>
                <th style="text-align:center;">Media FV Panchina</th>
                <th style="text-align:center;">Bonus/Malus Netti</th>
                <th style="text-align:center;">Totale Punti Panchina</th>
              </tr>
            </thead>
            <tbody id="fmIncompresiTbody">
              ${this.renderIncompresiRows(getFilteredList())}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Input di ricerca con aggiornamento mirato del solo tbody (nessuna perdita di focus)
    const searchInput = container.querySelector('#fmIncompresiSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchIncompresi = e.target.value;
        const tbody = container.querySelector('#fmIncompresiTbody');
        if (tbody) {
          tbody.innerHTML = this.renderIncompresiRows(getFilteredList());
        }
      };
    }
  },

  /**
   * Helper per righe Uomo Partita (utilizzato per non perdere il focus durante la ricerca)
   */
  renderMomRows(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nessun calciatore trovato.</td></tr>`;
    }
    return list.slice(0, 150).map((p, idx) => {
      const href = this.getPlayerLink(p.name);
      const photoUrl = this.getPlayerPhotoByCode(p.code, p.name);
      const clubsList = (p.clubs && p.clubs.length > 0) ? p.clubs : (p.club ? [p.club] : []);
      const sqList = (p.fantasquadre && p.fantasquadre.length > 0) ? p.fantasquadre : (p.teamName ? [p.teamName] : []);
      return `
        <tr>
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
          <th style="font-weight:700;">
            <div class="fm-player-cell">
              <img src="${photoUrl}" class="fm-player-thumb" alt="" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
              ${href ? `<a href="${href}" style="color:inherit;text-decoration:none;" title="Apri scheda">${p.name}</a>` : `<span>${p.name}</span>`}
            </div>
          </th>
          <td style="text-align:center;">${this.getRoleBadge(p.role)}</td>
          <td style="text-align:left;">${this.renderClubsList(clubsList)}</td>
          <td style="text-align:left;">${this.renderFantasquadreList(sqList)}</td>
          <td style="text-align:center;">
            <span class="badge" style="background:rgba(234,179,8,0.15);color:var(--accent-gold, #eab308);font-weight:900;font-size:0.95rem;padding:3px 10px;border-radius:12px;">
              🌟 ${p.count}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 7. TAB: Migliori in Campo / Uomo Partita (All-Time e Per Stagione)
   */
  renderUomoPartitaTab(container, compData) {
    const isSeason = this.momScope === 'season';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.momSeason || seasonKeys[0] || 14;

    const getFilteredList = () => {
      let list = isSeason
        ? ((compData.mom && compData.mom.bySeason && compData.mom.bySeason[activeSeason]) || [])
        : ((compData.mom && compData.mom.allTime) || []);

      if (this.searchMom && this.searchMom.trim()) {
        const q = this.searchMom.trim().toLowerCase();
        list = list.filter(p => {
          const pName = String(p.name || '').toLowerCase();
          const clubsStr = Array.isArray(p.clubs) ? p.clubs.join(' ').toLowerCase() : String(p.club || '').toLowerCase();
          const sqStr = Array.isArray(p.fantasquadre) ? p.fantasquadre.join(' ').toLowerCase() : String(p.teamName || '').toLowerCase();
          return pName.includes(q) || clubsStr.includes(q) || sqStr.includes(q);
        });
      }
      return list;
    };

    container.innerHTML = `
      <div id="panel-fm-uomopartita" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🌟</span>
              <span>Migliori in Campo / Uomo Partita (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Calciatori premiati come "Uomo Partita" secondo i voti e le regole ufficiali FantaMister.
            </div>
          </div>

          <!-- Pulsantiera Ambito -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:3px;border-radius:20px;border:1px solid var(--border-subtle);gap:4px;">
              <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-mom-scope="alltime" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
              <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-mom-scope="season" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">📅 Per Stagione</button>
            </div>

            ${isSeason ? `
              <select id="selMomSeason" class="form-control" style="font-weight:700;padding:4px 10px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.84rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <!-- Barra di ricerca rapida -->
        <div style="max-width:340px;margin-bottom:12px;">
          <input type="text" id="fmMomSearch" class="form-control" placeholder="Cerca calciatore, club o fantasquadra..." value="${this.searchMom}" style="width:100%;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.85rem;" />
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Calciatore</th>
                <th style="text-align:center;">Ruolo</th>
                <th style="text-align:left;">Squadre Serie A</th>
                <th style="text-align:left;">Fantasquadre</th>
                <th style="text-align:center;">Titoli Uomo Partita</th>
              </tr>
            </thead>
            <tbody id="fmMomTbody">
              ${this.renderMomRows(getFilteredList())}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventi pulsantiera ambito e stagione
    const scopeBtns = container.querySelectorAll('[data-mom-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.momScope = btn.getAttribute('data-mom-scope');
        this.renderUomoPartitaTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selMomSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.momSeason = parseInt(e.target.value, 10);
        this.renderUomoPartitaTab(container, compData);
      };
    }

    // Input di ricerca con aggiornamento del solo tbody (il focus non viene perso!)
    const searchInput = container.querySelector('#fmMomSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchMom = e.target.value;
        const tbody = container.querySelector('#fmMomTbody');
        if (tbody) {
          tbody.innerHTML = this.renderMomRows(getFilteredList());
        }
      };
    }
  },

  /**
   * 8. TAB: Top & Flop 11 (Campetto Tattico con grafica identica a #fantam)
   */
  renderTopFlopTab(container, compData) {
    const isSeason = this.topFlopScope === 'season';
    const isTop = this.topFlopType === 'top';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.topFlopSeason || seasonKeys[0] || 14;

    const dataObj = isSeason
      ? ((compData.topFlop && compData.topFlop.bySeason && compData.topFlop.bySeason[activeSeason]) || { top: {}, flop: {} })
      : ((compData.topFlop && compData.topFlop.allTime) || { top: {}, flop: {} });

    const dataset = isTop ? (dataObj.top || {}) : (dataObj.flop || {});
    const bestModStr = dataset.module || '3-4-3';
    const byModule = dataset.byModule || {};

    let players = dataset.players || [];
    let moduleStr = bestModStr;
    let totalScore = dataset.sum || 0;

    const activeModChoice = this.topFlopModule || 'auto';
    if (activeModChoice !== 'auto' && byModule && byModule[activeModChoice]) {
      players = byModule[activeModChoice].players || [];
      moduleStr = byModule[activeModChoice].module || activeModChoice;
      totalScore = byModule[activeModChoice].sum || 0;
    }

    container.innerHTML = `
      <div id="panel-fm-topflop" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>${isTop ? '🔝' : '🔻'}</span>
              <span>${isTop ? 'Top 11' : 'Flop 11'} (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Formazioni ideali dei migliori e peggiori 11 calciatori titolari schierati sul terreno di gioco.
            </div>
          </div>

          ${isSeason ? `
            <div style="display:inline-flex;align-items:center;gap:8px;">
              <label for="selTopFlopSeason" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Stagione:</label>
              <select id="selTopFlopSeason" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.85rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Pulsantiere Top/Flop e All-Time/Stagione -->
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;align-items:center;margin-bottom:20px;">
          <!-- Tipo -->
          <div style="display:inline-flex;align-items:center;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:4px;border-radius:24px;border:1px solid var(--border-subtle);gap:4px;">
            <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding-left:8px;padding-right:4px;text-transform:uppercase;">Tipo:</span>
            <button type="button" class="pill-btn ${isTop ? 'active' : ''}" data-topflop-type="top" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🔝 Top 11</button>
            <button type="button" class="pill-btn ${!isTop ? 'active' : ''}" data-topflop-type="flop" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🔻 Flop 11</button>
          </div>

          <!-- Ambito -->
          <div style="display:inline-flex;align-items:center;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:4px;border-radius:24px;border:1px solid var(--border-subtle);gap:4px;">
            <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding-left:8px;padding-right:4px;text-transform:uppercase;">Ambito:</span>
            <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-topflop-scope="alltime" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
            <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-topflop-scope="season" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">📅 Singola Stagione</button>
          </div>
        </div>

        ${players.length > 0 ? `
          <!-- Campetto Tattico Vettoriale identico a #fantam -->
          <div>
            ${this.renderTacticalPitch(players, !isTop, moduleStr, totalScore, byModule, bestModStr)}
          </div>
        ` : `
          <div style="padding:32px;text-align:center;color:var(--text-muted);">
            Dati Top/Flop non disponibili per la selezione corrente.
          </div>
        `}
      </div>
    `;

    // Eventi tipo, ambito e stagione
    const typeBtns = container.querySelectorAll('[data-topflop-type]');
    typeBtns.forEach(btn => {
      btn.onclick = () => {
        this.topFlopType = btn.getAttribute('data-topflop-type');
        this.topFlopModule = 'auto';
        this.renderTopFlopTab(container, compData);
      };
    });

    const scopeBtns = container.querySelectorAll('[data-topflop-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.topFlopScope = btn.getAttribute('data-topflop-scope');
        this.topFlopModule = 'auto';
        this.renderTopFlopTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selTopFlopSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.topFlopSeason = parseInt(e.target.value, 10);
        this.topFlopModule = 'auto';
        this.renderTopFlopTab(container, compData);
      };
    }

    const selModule = container.querySelector('#selTopFlopModule');
    if (selModule) {
      selModule.onchange = (e) => {
        this.topFlopModule = e.target.value;
        this.renderTopFlopTab(container, compData);
      };
    }
  },

  /**
   * Helper Campetto Tattico per Top & Flop 11 (Grafica identica a #fantam)
   * La stellina della squadra favorita non va MAI a capo rispetto al nome (maglia stella nome)
   */
  renderTacticalPitch(players, isFlop = false, moduleStr = '', totalScore = 0, byModule = {}, bestModStr = '') {
    const allowedMods = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
    const activeModChoice = this.topFlopModule || 'auto';
    const pList = players.filter(p => p.roleNum === 1 || p.role === 'P' || p.role === 1);
    const dList = players.filter(p => p.roleNum === 2 || p.role === 'D' || p.role === 2);
    const cList = players.filter(p => p.roleNum === 3 || p.role === 'C' || p.role === 3);
    const aList = players.filter(p => p.roleNum === 4 || p.role === 'A' || p.role === 4);

    const renderRoleLine = (rolePlayers, roleLetter) => {
      const count = rolePlayers.length;
      const isStaggered = count >= 5;
      const roleClass = `role-${roleLetter.toLowerCase()}`;
      return `
        <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}">
          ${rolePlayers.map((pl, idx) => {
            const isWing = isStaggered && (idx === 0 || idx === count - 1);
            const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
            const pName = pl.name || '';
            const pSurname = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.extractSurname === 'function')
              ? fcmDataLoader.extractSurname(pName)
              : pName.split(' ')[0];
            const photoUrl = this.getPlayerPhotoByCode(pl.code, pName);
            const clubName = pl.club || '';
            const clubLogo = this.getSerieALogo(clubName);
            const sqName = pl.teamName || '';
            const sqLogo = sqName ? this.getTeamLogo(null, sqName) : '';
            const isFav = this.isFavTeam(sqName);
            const voteVal = pl.avgTot !== undefined ? pl.avgTot.toFixed(2) : (pl.totNum || '-');
            const href = this.getPlayerLink(pName);

            const tagOpen = href
              ? `<a href="${href}" class="pitch-player ${wingClass}" style="text-decoration:none;color:inherit;" title="${pName} (${sqName}) - Media: ${voteVal}">`
              : `<div class="pitch-player ${wingClass}" title="${pName} (${sqName}) - Media: ${voteVal}">`;
            const tagClose = href ? `</a>` : `</div>`;

            return `
              ${tagOpen}
                <div class="pitch-player-avatar">
                  <img src="${photoUrl}" class="pitch-player-photo" alt="${pName}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
                  <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  ${clubLogo ? `<img src="${clubLogo}" class="rose-top11-club-logo" alt="" onerror="this.style.display='none';" />` : ''}
                </div>
                <div class="pitch-player-name">
                  <span class="pitch-player-surname">${pSurname}</span>
                </div>
                ${sqName ? `
                  <div class="pitch-player-club" style="font-size:0.68rem;color:rgba(255,255,255,0.88);text-align:center;display:flex;align-items:center;justify-content:center;gap:3px;margin-top:1px;white-space:nowrap;max-width:115px;text-transform:none;">
                    ${sqLogo ? `<img src="${sqLogo}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(sqName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:12px;height:12px;object-fit:contain;flex-shrink:0;" alt="" />` : ''}
                    ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore" style="flex-shrink:0;font-size:0.75rem;line-height:1;display:inline-block;">⭐</span>' : ''}
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:none;">${sqName}</span>
                  </div>
                ` : ''}
                <div style="margin-top:2px;">
                  <span class="topflop-vote-badge ${isFlop ? 'flop' : 'top'}" style="background:${isFlop ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)'};color:#fff;font-weight:900;font-size:0.75rem;padding:2px 7px;border-radius:10px;">
                    ${voteVal}
                  </span>
                </div>
              ${tagClose}
            `;
          }).join('')}
        </div>
      `;
    };

    const svgLines = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPitchSvgLines === 'function')
      ? fcmDataLoader.getPitchSvgLines()
      : '';

    return `
      <div class="topflop-widget-card" style="margin: 0 auto; max-width: 530px;">
        <!-- Banner Sintesi con Selettore Modulo Tattico -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="selTopFlopModule" style="font-weight:700;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;">Modulo Tattico:</label>
            <select id="selTopFlopModule" class="form-control" style="font-weight:800;padding:4px 10px;border-radius:10px;background:rgba(59,130,246,0.14);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.35);font-size:0.84rem;cursor:pointer;">
              <option value="auto" ${activeModChoice === 'auto' ? 'selected' : ''}>${bestModStr || moduleStr} (${totalScore.toFixed(2)} pt) ${isFlop ? '👎' : '🌟'}</option>
              ${allowedMods.map(m => {
                if (m !== bestModStr) {
                  const mEntry = byModule && byModule[m];
                  const ptLabel = mEntry && typeof mEntry.sum === 'number' ? ` (${mEntry.sum.toFixed(2)} pt)` : '';
                  return `<option value="${m}" ${activeModChoice === m ? 'selected' : ''} ${!mEntry ? 'disabled' : ''}>${m}${ptLabel}</option>`;
                }
                return '';
              }).join('')}
            </select>
          </div>
          <div>
            <span style="font-weight:700;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;">Media Totale Voti:</span>
            <span style="font-weight:900;color:${isFlop ? 'var(--accent-crimson, #ef4444)' : 'var(--accent-emerald, #10b981)'};margin-left:6px;font-size:1.0rem;">
              ${typeof totalScore === 'number' ? totalScore.toFixed(2) : totalScore} pt
            </span>
          </div>
        </div>

        <!-- Campetto con erba e linee SVG (senza contenitore intermedio pitch-field) -->
        <div class="pitch-container" style="position:relative;">
          ${svgLines}
          ${renderRoleLine(pList, 'P')}
          ${renderRoleLine(dList, 'D')}
          ${renderRoleLine(cList, 'C')}
          ${renderRoleLine(aList, 'A')}
        </div>
      </div>
    `;
  },

  /**
   * 9. TAB: Fantasfiga (All-Time e Per Stagione)
   */
  renderFantasfigaTab(container, compData) {
    const isSeason = this.fantasfigaScope === 'season';
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.fantasfigaSeason || seasonKeys[0] || 14;

    const list = isSeason
      ? ((compData.fantasfiga && compData.fantasfiga.bySeason && compData.fantasfiga.bySeason[activeSeason]) || [])
      : ((compData.fantasfiga && compData.fantasfiga.allTime) || []);

    container.innerHTML = `
      <div id="panel-fm-fantasfiga" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🍀</span>
              <span>Classifica Fantasfiga (${isSeason ? `Stagione ${activeSeason}` : 'All-Time'})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Rendimento puro degli avversari rispetto alla loro media partita. Un valore positivo indica che gli avversari giocano mediamente meglio del solito quando ti affrontano.
            </div>
          </div>

          <!-- Pulsantiera Ambito -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:3px;border-radius:20px;border:1px solid var(--border-subtle);gap:4px;">
              <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-fantasfiga-scope="alltime" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">🏆 All-Time</button>
              <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-fantasfiga-scope="season" style="border-radius:18px;padding:3px 12px;font-size:0.82rem;font-weight:700;">📅 Per Stagione</button>
            </div>

            ${isSeason ? `
              <select id="selFantasfigaSeason" class="form-control" style="font-weight:700;padding:4px 10px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.84rem;">
                ${seasonKeys.map(s => `<option value="${s}" ${s === activeSeason ? 'selected' : ''}>${this.getSeasonLabel(s)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Fantasquadra</th>
                <th style="text-align:center;">Partite</th>
                <th style="text-align:center;">Delta Punti / Gara</th>
              </tr>
            </thead>
            <tbody>
              ${list.length > 0 ? list.map((item, idx) => {
                const isFav = this.isFavTeam(item.teamId) || this.isFavTeam(item.teamName);
                const isUnlucky = item.diff > 0;
                return `
                  <tr style="${isFav ? 'background:rgba(2, 132, 199, 0.08);' : ''}">
                    <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
                    <th style="font-weight:700;text-align:left;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.teamName)}" class="fantam-team-link" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                        <img src="${this.getTeamLogo(item.teamId, item.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="color:var(--text-primary);text-transform:none;">${item.teamName}</span>
                      </a>
                    </th>
                    <td style="text-align:center;color:var(--text-secondary);">${item.matches}</td>
                    <td style="text-align:center;">
                      <span class="badge" style="background:${isUnlucky ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'};color:${isUnlucky ? 'var(--accent-crimson, #ef4444)' : 'var(--accent-emerald, #10b981)'};font-weight:900;font-size:0.95rem;padding:4px 10px;border-radius:12px;">
                        ${item.diff > 0 ? `+${item.diff.toFixed(2)}` : item.diff.toFixed(2)} pt
                      </span>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Nessun dato disponibile.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventi pulsantiera ambito e stagione
    const scopeBtns = container.querySelectorAll('[data-fantasfiga-scope]');
    scopeBtns.forEach(btn => {
      btn.onclick = () => {
        this.fantasfigaScope = btn.getAttribute('data-fantasfiga-scope');
        this.renderFantasfigaTab(container, compData);
      };
    });

    const selSeason = container.querySelector('#selFantasfigaSeason');
    if (selSeason) {
      selSeason.onchange = (e) => {
        this.fantasfigaSeason = parseInt(e.target.value, 10);
        this.renderFantasfigaTab(container, compData);
      };
    }
  },

  /**
   * 10. TAB: Archivio per Stagione
   */
  renderStagioniTab(container, compData) {
    const stagioniMap = compData.stagioni || {};
    const seasonKeys = this.getAvailableSeasons();
    const activeSeason = this.selectedSeason || seasonKeys[0] || 14;
    const stg = stagioniMap[activeSeason] || { ranking: [] };
    const ranking = stg.ranking || [];

    container.innerHTML = `
      <div id="panel-fm-stagioni" role="tabpanel" class="fm-record-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>📅</span>
              <span>Archivio FantaMister per Stagione (${this.getSeasonLabel(activeSeason)})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Classifica e rendimento calcolati per la singola annata sportiva.
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <label for="selStagioneArchivio" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Stagione:</label>
            <select id="selStagioneArchivio" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:180px;font-size:0.88rem;">
              ${seasonKeys.map(s => `
                <option value="${s}" ${s === activeSeason ? 'selected' : ''}>
                  ${this.getSeasonLabel(s)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        ${stg.winner ? `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(234, 179, 8, 0.04));border:1px solid rgba(234, 179, 8, 0.35);border-radius:8px;padding:12px 16px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.6rem;">🥇</span>
              <div>
                <div style="font-size:0.75rem;text-transform:uppercase;color:var(--accent-gold, #eab308);font-weight:800;letter-spacing:0.04em;">Miglior FantaMister Stagione ${activeSeason}</div>
                <div style="font-size:1.1rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                  <img src="${this.getTeamLogo(stg.winner.id, stg.winner.name)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(stg.winner.name)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                  ${this.isFavTeam(stg.winner.id || stg.winner.name) ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                  <span style="text-transform:none;">${stg.winner.name}</span>
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.75rem;color:var(--text-muted);">Scarto Medio Pesato</div>
              <div style="font-size:1.15rem;font-weight:900;color:var(--accent-gold, #eab308);">${this.formatScartoPesato(stg.winner.scartoMedioPesato)}</div>
            </div>
          </div>
        ` : ''}

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
          <table class="fm-table">
            <thead>
              <tr>
                <th style="inline-size:40px;text-align:center;">#</th>
                <th style="min-inline-size:180px;text-align:left;">Fantasquadra</th>
                <th style="text-align:center;">Partite</th>
                <th style="text-align:center;">Scarto Medio</th>
                <th style="text-align:center;">Scarto Pesato</th>
                <th style="text-align:center;">% Scarto 0</th>
                <th style="text-align:center;">Media Reale</th>
                <th style="text-align:center;">Media Ideale</th>
                <th style="text-align:center;">Punti Persi</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((item, idx) => {
                const isFav = this.isFavTeam(item.teamId) || this.isFavTeam(item.teamName);
                const pesatoStr = this.formatScartoPesato(item.scartoMedioPesato);
                return `
                  <tr style="${isFav ? 'background:rgba(2, 132, 199, 0.08);' : ''}">
                    <td style="text-align:center;font-weight:700;color:var(--text-muted);">${idx + 1}</td>
                    <th style="font-weight:700;text-align:left;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.teamName)}" class="fantam-team-link" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                        <img src="${this.getTeamLogo(item.teamId, item.teamName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                        ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                        <span class="fantam-team-name-text" style="color:var(--text-primary);text-transform:none;">${item.teamName}</span>
                      </a>
                    </th>
                    <td style="text-align:center;color:var(--text-secondary);">${item.matches}</td>
                    <td style="text-align:center;font-weight:700;color:var(--accent-rose, #f43f5e);">${item.scartoMedio.toFixed(3)}</td>
                    <td style="text-align:center;">
                      <span class="fm-badge fm-badge-gold" style="font-size:0.88rem;padding:3px 10px;">${pesatoStr}</span>
                    </td>
                    <td style="text-align:center;color:var(--text-secondary);">${item.scartoZeroPct.toFixed(1)}% (${item.scartoZero})</td>
                    <td style="text-align:center;color:var(--accent-primary, #0284c7);">${item.mediaReale.toFixed(2)}</td>
                    <td style="text-align:center;font-weight:700;color:var(--accent-emerald, #10b981);">${item.mediaIdeale.toFixed(2)}</td>
                    <td style="text-align:center;color:var(--text-muted);">${item.puntiPersi.toFixed(1)} pt</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const selStagione = container.querySelector('#selStagioneArchivio');
    if (selStagione) {
      selStagione.onchange = (e) => {
        this.selectedSeason = parseInt(e.target.value, 10);
        this.renderStagioniTab(container, compData);
      };
    }
  }
};
