/**
 * ARCHIVIO STAGIONI VIEW
 * Pagina standalone per la consultazione cronologica di tutte le stagioni concluse,
 * palmarès dinamico, loghi competizioni, maglie fantasquadre interattive,
 * foto miniature calciatori e deep-linking verso le viste storiche.
 * ModernFCM
 */

const archivioView = {
  sortOrder: 'desc',      // 'desc' (dalla più recente) | 'asc' (dalla 1ª edizione)
  searchQuery: '',        // Filtro testuale per fantasquadra, presidente o anno
  selectedSeason: null,   // Stagione target da query string (?season=X)
  data: null,
  container: null,
  _searchDebounceTimer: null,

  /**
   * Helper: recupera l'icona del trofeo della competizione
   */
  getCompTrophyIcon(comp, isSmall = true) {
    const palmaresList = (this.data && Array.isArray(this.data.palmares))
      ? this.data.palmares
      : ((typeof arrPalmares !== 'undefined' && Array.isArray(arrPalmares)) ? arrPalmares.slice(1) : []);

    const id = typeof comp === 'object' && comp !== null
      ? (comp.idCompetizione || comp.id || comp.IDc || comp.ID)
      : comp;

    for (const p of palmaresList) {
      if (p && (p.Competizione == id || p.compId == id || p.id == id)) {
        const iconFile = p.Icona || p.icon;
        if (iconFile) return isSmall ? `img/small-${iconFile}` : `img/${iconFile}`;
      }
    }

    const name = typeof comp === 'object' && comp !== null
      ? (comp.name || comp.nome || comp.Label || '')
      : (typeof comp === 'string' ? comp : '');

    if (name) {
      const norm = name.toLowerCase().trim();
      for (const p of palmaresList) {
        if (!p) continue;
        const pLabel = (p.Label || p.label || p.name || '').toLowerCase().trim();
        if (pLabel && (pLabel === norm || norm.includes(pLabel) || pLabel.includes(norm))) {
          const iconFile = p.Icona || p.icon;
          if (iconFile) return isSmall ? `img/small-${iconFile}` : `img/${iconFile}`;
        }
      }
    }

    return isSmall ? 'img/small-ico-coppa.gif' : 'img/ico-coppa.gif';
  },

  /**
   * Render principale della vista #archivio
   */
  async render(container) {
    this.container = container;

    // 1. Guard Modularità: verifica se il modulo storico è attivo
    if (typeof fcmModules !== 'undefined' && !fcmModules.isRouteEnabled('#archivio')) {
      this.renderDisabledNotice(container);
      return;
    }

    // 2. Lettura parametri query string (es. #archivio?season=12&sort=asc)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('season') || params.has('stagione')) {
        const s = parseInt(params.get('season') || params.get('stagione'), 10);
        this.selectedSeason = (!isNaN(s) && s > 0) ? s : null;
      } else {
        this.selectedSeason = null;
      }
      if (params.has('sort')) {
        const srt = params.get('sort');
        if (srt === 'asc' || srt === 'desc') this.sortOrder = srt;
      }
    } else {
      this.selectedSeason = null;
    }

    // 3. Mostra scheletro di caricamento shimmer
    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.archivioStagioni()
      : `
        <div class="card" style="padding:40px 20px;text-align:center;">
          <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Caricamento Archivio Storico...</div>
          <div style="font-size:0.85rem;color:var(--text-muted);">Recupero edizioni concluse, palmarès e statistiche da SQLite...</div>
        </div>
      `;

    // 4. Carica dati aggregati (solo stagioni concluse: season < currentSeason)
    try {
      this.data = await fcmDataLoader.loadArchivioStagioni();
    } catch (err) {
      console.error('Errore durante il caricamento dell\'archivio stagioni:', err);
      this.data = null;
    }

    // Se non ci sono dati storici SQLite o il modulo è privo di stagioni
    if (!this.data || !this.data.hasData || !this.data.seasons || this.data.seasons.length === 0) {
      this.renderDisabledNotice(container);
      return;
    }

    // 5. Render interfaccia completa
    this.renderView(container);
  },

  /**
   * Rendering della vista completa (Header Hero, Controlli, Griglia di Schede)
   */
  renderView(container) {
    const stats = this.data.stats || {};
    const filteredSeasons = this.getFilteredSeasons();
    const availableSeasons = [...(this.data.seasons || [])].sort((a, b) => b.id - a.id);

    container.innerHTML = `
      <style>
        .archivio-wrap { display: flex; flex-direction: column; gap: 20px; max-width: 100%; }
        .archivio-hero {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 4px;
        }
        .archivio-hero-box {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .archivio-hero-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .archivio-hero-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .archivio-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 12px 16px;
        }
        .archivio-search-box {
          position: relative;
          flex: 1;
          min-width: 220px;
          max-width: 400px;
        }
        .archivio-search-input {
          width: 100%;
          padding: 8px 12px 8px 34px;
          border-radius: var(--radius-full, 9999px);
          border: 1px solid var(--border-subtle);
          background: var(--bg-body);
          color: var(--text-primary);
          font-size: 0.85rem;
          box-sizing: border-box;
          outline: none;
        }
        .archivio-search-input:focus {
          border-color: var(--accent-primary);
        }
        .archivio-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .archivio-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 16px;
        }
        @media (max-width: 640px) {
          .archivio-grid { grid-template-columns: 1fr; }
        }
        .season-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .season-card:hover {
          border-color: rgba(56, 189, 248, 0.4);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .season-card-header {
          padding: 14px 18px;
          background: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .season-card-title {
          font-weight: 800;
          font-size: 1.05rem;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .season-card-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .season-card-body {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }
        .season-comp-group {
          background: var(--bg-body);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .season-comp-title {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--accent-cyan, #0284c7);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .season-comp-trophy {
          height: 18px;
          width: auto;
          vertical-align: middle;
          object-fit: contain;
          flex-shrink: 0;
        }
        .season-podium-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.82rem;
          gap: 8px;
        }
        .season-team-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          min-width: 0;
          transition: opacity 0.2s ease;
        }
        .season-team-link:hover {
          text-decoration: none;
          opacity: 0.9;
        }
        .season-team-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .season-team-link:hover .season-team-logo {
          transform: scale(1.35);
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
          z-index: 2;
        }
        .season-team-name {
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .season-team-name.champion {
          font-weight: 800;
          color: var(--text-primary);
        }
        .season-team-link:hover .season-team-name {
          color: var(--accent-primary);
        }
        .season-highlights-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .season-highlight-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .highlight-clickable {
          text-decoration: none !important;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }
        .highlight-clickable:hover {
          transform: translateY(-2px);
          border-color: var(--accent-cyan);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }
        .season-player-thumb {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface-elevated);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          will-change: transform;
        }
        .highlight-clickable:hover .season-player-thumb {
          transform: scale(1.22);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
          border-color: var(--accent-cyan);
        }
        .highlight-clickable:hover .season-team-logo {
          transform: scale(1.28);
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.35));
        }
        .season-actions-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
          margin-top: auto;
        }
        @media (max-width: 480px) {
          .season-actions-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .season-actions-row .pill-btn {
          font-size: 0.78rem !important;
          font-weight: 700 !important;
          padding: 8px 10px !important;
          min-height: 36px !important;
          height: 36px !important;
          box-sizing: border-box !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          gap: 6px !important;
          white-space: nowrap !important;
          border-radius: var(--radius-sm, 6px) !important;
          background: var(--bg-body) !important;
          border: 1px solid var(--border-subtle) !important;
          color: var(--text-secondary) !important;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease !important;
          will-change: transform;
        }
        .season-actions-row .pill-btn:hover {
          color: var(--accent-primary, #0284c7) !important;
          border-color: var(--accent-primary, #0284c7) !important;
          background: var(--bg-surface-elevated) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.18) !important;
        }
        .season-actions-row .pill-btn:active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 4px rgba(2, 132, 199, 0.1) !important;
        }
        .legacy-btn {
          border-color: rgba(168, 85, 247, 0.35) !important;
          color: var(--accent-purple, #a855f7) !important;
        }
        .legacy-btn:hover {
          color: var(--accent-purple, #a855f7) !important;
          border-color: var(--accent-purple, #a855f7) !important;
          background: var(--bg-surface-elevated) !important;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.22) !important;
        }
      </style>

      <div class="archivio-wrap">
        <!-- 1. Card Principale con Testata Istituzionale -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="card-title" style="display:flex;align-items:center;gap:10px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Archivio Storico Stagioni
              </div>
              <div class="card-subtitle">Consultazione cronologica ufficiale di tutte le edizioni passate concluse</div>
            </div>
          </div>

          <div style="padding:16px 20px;">
            <!-- 2. Hero Summary All-Time -->
            <div class="archivio-hero">
              <div class="archivio-hero-box">
                <div class="archivio-hero-val" style="color:var(--accent-cyan);">${stats.totalSeasons || 0}</div>
                <div class="archivio-hero-label">Edizioni Concluse</div>
              </div>
              <div class="archivio-hero-box">
                <div class="archivio-hero-val" style="color:var(--accent-gold);">${stats.uniqueChampionsCount || 0}</div>
                <div class="archivio-hero-label">Campioni Unici</div>
              </div>
              <div class="archivio-hero-box">
                <div class="archivio-hero-val" style="color:var(--accent-emerald);">${stats.foundingYear || '-'}</div>
                <div class="archivio-hero-label">Anno di Fondazione</div>
              </div>
              <div class="archivio-hero-box">
                <div class="archivio-hero-val" style="color:var(--accent-primary);">${(stats.totalGoals || 0).toLocaleString('it-IT')}</div>
                <div class="archivio-hero-label">Gol Storici Segnati</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Toolbar di Controllo (Ricerca, Selezione Stagione e Ordinamento) -->
        <div class="archivio-toolbar">
          <div class="archivio-search-box">
            <svg class="archivio-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="archivioSearchInput" class="archivio-search-input" placeholder="Cerca squadra, presidente o anno..." value="${this.escapeHtml(this.searchQuery)}" />
          </div>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <label for="archivioSeasonSelect" style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                Stagione:
              </label>
              <select id="archivioSeasonSelect" class="form-select" style="font-weight:700;font-size:0.85rem;padding:6px 12px;border-radius:var(--radius-sm);min-width:170px;">
                <option value="all" ${(!this.selectedSeason || this.selectedSeason === 'all') ? 'selected' : ''}>Tutte le stagioni (${availableSeasons.length})</option>
                ${availableSeasons.map(s => `
                  <option value="${s.id}" ${Number(this.selectedSeason) === Number(s.id) ? 'selected' : ''}>
                    ${s.id}ª Edizione (${s.anni_stagione})
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <label for="archivioSortSelect" style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                Ordine:
              </label>
              <select id="archivioSortSelect" class="form-select" style="font-weight:700;font-size:0.85rem;padding:6px 12px;border-radius:var(--radius-sm);min-width:170px;">
                <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>Dalla più recente ▾</option>
                <option value="asc" ${this.sortOrder === 'asc' ? 'selected' : ''}>Dalla 1ª edizione ▴</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 4. Contenitore Dati (Griglia di Schede) -->
        <div id="archivioDataContainer">
          ${filteredSeasons.length === 0 ? `
            <div class="card text-center" style="padding:40px 20px;color:var(--text-muted);">
              Nessuna stagione conclusa corrisponde ai criteri di ricerca impostati.
            </div>
          ` : this.renderCardsHtml(filteredSeasons)}
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  /**
   * Render Griglia Schede Stagioni
   */
  renderCardsHtml(seasons) {
    return `
      <div class="archivio-grid">
        ${seasons.map(s => {
          return `
            <div class="season-card" id="seasonCard_${s.id}">
              <!-- Intestazione Card Stagione -->
              <div class="season-card-header">
                <div>
                  <div class="season-card-title">
                    <span style="color:var(--accent-gold);">${s.id}ª Edizione</span>
                    <span style="font-weight:600;font-size:0.95rem;color:var(--text-primary);">(${s.anni_stagione})</span>
                  </div>
                  <div class="season-card-subtitle">
                    ${this.escapeHtml(s.nome_lega)}
                  </div>
                </div>

                <div style="text-align:right;">
                  <span class="badge" style="background:rgba(56,189,248,0.12);color:var(--accent-cyan);font-weight:700;font-size:0.75rem;">
                    ${s.teamsCount} Squadre
                  </span>
                  ${s.matchesCount > 0 ? `
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">
                      ${s.matchesCount} gare • ${s.goalsCount} gol (${s.avgGoals}/g)
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Corpo Card Stagione -->
              <div class="season-card-body">
                <!-- Palmarès & Competizioni Dinamiche (Divisioni SOLO se presenti) -->
                ${s.competitions.length > 0 ? `
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    ${s.competitions.map(c => `
                      <div class="season-comp-group">
                        <div class="season-comp-title">
                          <img src="${this.getCompTrophyIcon(c, true)}" class="season-comp-trophy" onerror="this.style.display='none';" alt="" />
                          <span>${this.escapeHtml(c.name)}</span>
                          ${c.isDivision && c.divisionName ? `
                            <span class="badge" style="font-size:0.65rem;background:rgba(16,185,129,0.12);color:var(--accent-emerald);padding:2px 6px;">
                              ${this.escapeHtml(c.divisionName)}
                            </span>
                          ` : ''}
                        </div>

                        ${c.podium && c.podium.length > 0 ? `
                          <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px;">
                            ${c.podium.slice(0, 3).map(p => {
                              const medal = p.pos === 1 ? '🥇' : (p.pos === 2 ? '🥈' : '🥉');
                              return `
                                <div class="season-podium-row">
                                  <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                                    <span style="font-size:0.95rem;flex-shrink:0;">${medal}</span>
                                    <a href="#rose?season=${s.id}&albo=${p.teamId}&teamName=${encodeURIComponent(p.teamName)}"
                                       class="season-team-link"
                                       title="Visualizza rosa della stagione ${s.id} per ${this.escapeHtml(p.teamName)}">
                                      <img src="${fcmDataLoader.getTeamLogo(p.teamName || p.teamId)}"
                                           class="season-team-logo"
                                           alt="${this.escapeHtml(p.teamName)}"
                                           onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                      <span class="season-team-name ${p.pos === 1 ? 'champion' : ''}">
                                        ${this.escapeHtml(p.teamName)}
                                      </span>
                                    </a>
                                    ${p.president ? `
                                      <span style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                        (${this.escapeHtml(p.president)})
                                      </span>
                                    ` : ''}
                                  </div>
                                  <div style="font-weight:700;font-size:0.8rem;color:var(--text-muted);flex-shrink:0;">
                                    ${p.points ? `${p.points} pt` : ''}
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        ` : `
                          <div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">Dati podio non registrati</div>
                        `}
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;">Nessuna competizione d'albo registrata per questa stagione.</div>
                `}

                <!-- Highlights Individuali da SQLite (Capocannoniere, Top Asta, FantaMister) -->
                ${(s.highlights.topCost || s.highlights.topScorer || s.highlights.bestManager) ? `
                  <div class="season-highlights-grid">
                    ${s.highlights.topScorer ? `
                      <a href="#schede_giocatori?cod=${s.highlights.topScorer.code || ''}&season=${s.id}&name=${encodeURIComponent(s.highlights.topScorer.name)}"
                         class="season-highlight-item highlight-clickable"
                         title="Apri scheda calciatore di ${this.escapeHtml(s.highlights.topScorer.name)} nella stagione ${s.id}">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                          <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:flex;align-items:center;gap:4px;">
                            <span>⚽</span> Bomber
                          </div>
                          <span class="badge" style="background:rgba(16,185,129,0.12);color:var(--accent-emerald);font-weight:800;font-size:0.72rem;padding:2px 7px;">
                            ${s.highlights.topScorer.goals} Gol
                          </span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
                          <img src="${fcmDataLoader.getPlayerPhoto(s.highlights.topScorer.name, s.highlights.topScorer.code)}"
                               class="season-player-thumb"
                               alt="${this.escapeHtml(s.highlights.topScorer.name)}"
                               onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
                          <div style="min-width:0;flex:1;">
                            <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              ${this.escapeHtml(s.highlights.topScorer.name)}
                            </div>
                            <div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              ${this.escapeHtml(s.highlights.topScorer.teamName)}
                            </div>
                          </div>
                        </div>
                      </a>
                    ` : ''}

                    ${s.highlights.topCost ? `
                      <a href="#schede_giocatori?cod=${s.highlights.topCost.code || ''}&season=${s.id}&name=${encodeURIComponent(s.highlights.topCost.name)}"
                         class="season-highlight-item highlight-clickable"
                         title="Apri scheda calciatore di ${this.escapeHtml(s.highlights.topCost.name)} nella stagione ${s.id}">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                          <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:flex;align-items:center;gap:4px;">
                            <span>💰</span> Top Asta
                          </div>
                          <span class="badge" style="background:rgba(245,158,11,0.12);color:var(--accent-gold);font-weight:800;font-size:0.72rem;padding:2px 7px;">
                            ${s.highlights.topCost.cost} FM
                          </span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
                          <img src="${fcmDataLoader.getPlayerPhoto(s.highlights.topCost.name, s.highlights.topCost.code)}"
                               class="season-player-thumb"
                               alt="${this.escapeHtml(s.highlights.topCost.name)}"
                               onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
                          <div style="min-width:0;flex:1;">
                            <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              ${this.escapeHtml(s.highlights.topCost.name)}
                            </div>
                            <div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              ${this.escapeHtml(s.highlights.topCost.teamName)}
                            </div>
                          </div>
                        </div>
                      </a>
                    ` : ''}

                    ${s.highlights.bestManager ? `
                      <a href="#fantamisterstorico?tab=stagioni&stg=${s.id}&season=${s.id}"
                         class="season-highlight-item highlight-clickable"
                         title="Visualizza statistiche FantaMister della stagione ${s.id}">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                          <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:flex;align-items:center;gap:4px;">
                            <span>👔</span> FantaMister
                          </div>
                          <span class="badge" style="background:rgba(168,85,247,0.12);color:var(--accent-purple, #a855f7);font-weight:800;font-size:0.72rem;padding:2px 7px;">
                            Scarto: ${s.highlights.bestManager.scartoMedio}
                          </span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
                          <img src="${fcmDataLoader.getTeamLogo(s.highlights.bestManager.teamName)}"
                               class="season-team-logo"
                               style="width:28px;height:28px;"
                               alt="${this.escapeHtml(s.highlights.bestManager.teamName)}"
                               onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                          <div style="min-width:0;flex:1;">
                            <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              ${this.escapeHtml(s.highlights.bestManager.teamName)}
                            </div>
                            <div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              Miglior rendimento formazioni
                            </div>
                          </div>
                        </div>
                      </a>
                    ` : ''}
                  </div>
                ` : ''}

                <!-- Pulsantiera di Navigazione Rapida (Deep-Linking ModernFCM) -->
                <div class="season-actions-row">
                  <a href="#classifica?season=${s.id}" class="pill-btn" title="Classifica completa e risultati per la stagione ${s.id}">
                    🏆 Classifica
                  </a>
                  <a href="#rose?season=${s.id}" class="pill-btn" title="Consulta le rose dei calciatori per la stagione ${s.id}">
                    📋 Rose
                  </a>
                  <a href="#risultati?season=${s.id}&day=${s.firstMatchday || 1}" class="pill-btn" title="Calendario, partite e tabellini della stagione ${s.id}">
                    ⚽ Risultati
                  </a>
                  <a href="#fantamisterstorico?tab=stagioni&stg=${s.id}&season=${s.id}" class="pill-btn" title="Statistiche FantaMister e moduli per la stagione ${s.id}">
                    👔 FantaMister
                  </a>
                  <a href="#etarose?season=${s.id}" class="pill-btn" title="Età media e anagrafica rose per la stagione ${s.id}">
                    🎂 Età Rose
                  </a>
                  <a href="#albo?subtab=dettaglio&year=${s.anno}" class="pill-btn" title="Dettaglio completo albo d'oro per l'anno ${s.anno}">
                    📜 Albo
                  </a>

                  <!-- Pulsante legacy (Compare SOLO se la cartella è configurata) -->
                  ${(s.hasLegacy && s.legacyPath) ? `
                    <a href="${s.legacyPath}" target="_blank" rel="noopener noreferrer" class="pill-btn legacy-btn" title="Apri il sito archivio originale FCM in una nuova scheda">
                      🌐 Sito Originale
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Filtra e ordina le stagioni concluse secondo lo stato utente
   */
  getFilteredSeasons() {
    if (!this.data || !this.data.seasons) return [];

    let list = [...this.data.seasons];

    // 0. Filtro per singola stagione selezionata (se diversa da 'all')
    if (this.selectedSeason !== null && this.selectedSeason !== undefined && this.selectedSeason !== 'all' && this.selectedSeason !== '') {
      const targetSeason = parseInt(this.selectedSeason, 10);
      if (!isNaN(targetSeason) && targetSeason > 0) {
        list = list.filter(s => Number(s.id) === targetSeason);
      }
    }

    // 1. Filtro testuale
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(s => {
        // Cerca in anno, anni_stagione, nome_lega
        if (String(s.id).includes(q) || String(s.anno).includes(q) || s.anni_stagione.toLowerCase().includes(q) || s.nome_lega.toLowerCase().includes(q)) {
          return true;
        }
        // Cerca nei podi delle competizioni (squadre o presidenti)
        const inPodium = s.competitions.some(c => {
          return c.podium && c.podium.some(p => {
            return (p.teamName && p.teamName.toLowerCase().includes(q)) ||
                   (p.president && p.president.toLowerCase().includes(q)) ||
                   (c.name && c.name.toLowerCase().includes(q));
          });
        });
        if (inPodium) return true;

        // Cerca nei bomber o top asta
        if (s.highlights.topCost && s.highlights.topCost.name.toLowerCase().includes(q)) return true;
        if (s.highlights.topScorer && s.highlights.topScorer.name.toLowerCase().includes(q)) return true;

        return false;
      });
    }

    // 2. Ordinamento
    if (this.sortOrder === 'asc') {
      list.sort((a, b) => a.id - b.id);
    } else {
      list.sort((a, b) => b.id - a.id);
    }

    return list;
  },

  /**
   * Associazione eventi interattivi (ricerca, selezione stagione e ordinamento)
   */
  bindEvents(container) {
    // 0. Selettore singola stagione
    const seasonSelect = container.querySelector('#archivioSeasonSelect');
    if (seasonSelect) {
      seasonSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.selectedSeason = (val === 'all' || !val) ? null : parseInt(val, 10);
        const urlHash = this.selectedSeason ? `#archivio?season=${this.selectedSeason}` : '#archivio';
        try { history.replaceState(null, '', urlHash); } catch (err) {}
        this.renderView(container);
      });
    }

    // 1. Selettore ordinamento
    const sortSelect = container.querySelector('#archivioSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortOrder = e.target.value;
        this.renderView(container);
      });
    }

    // 2. Input di ricerca con debounce
    const searchInput = container.querySelector('#archivioSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value;
          const dataBox = container.querySelector('#archivioDataContainer');
          if (dataBox) {
            const filtered = this.getFilteredSeasons();
            dataBox.innerHTML = filtered.length === 0 ? `
              <div class="card text-center" style="padding:40px 20px;color:var(--text-muted);">
                Nessuna stagione conclusa corrisponde alla ricerca "${this.escapeHtml(this.searchQuery)}".
              </div>
            ` : this.renderCardsHtml(filtered);
          }
        }, 180);
      });
    }
  },

  /**
   * Render dell'avviso di modulo disattivato o dati non disponibili
   */
  renderDisabledNotice(container) {
    container.innerHTML = `
      <div class="card text-center" style="padding:50px 20px;max-width:650px;margin:20px auto;">
        <div style="font-size:3rem;margin-bottom:14px;">🔒</div>
        <div style="font-size:1.25rem;font-weight:800;color:var(--text-primary);margin-bottom:8px;">
          Modulo Storico Disattivato o Dati Assenti
        </div>
        <p style="font-size:0.9rem;color:var(--text-muted);line-height:1.5;margin-bottom:20px;">
          L'archivio delle stagioni concluse è disattivato dall'amministratore della lega o non sono presenti dati storici SQLite validi da consultare.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <a href="#classifica" class="btn btn-primary" style="padding:8px 18px;text-decoration:none;font-weight:700;">
            Torna alla Classifica
          </a>
          <a href="#home" class="btn btn-outline-primary" style="padding:8px 18px;text-decoration:none;font-weight:700;">
            Vai alla Homepage
          </a>
        </div>
      </div>
    `;
  },

  /**
   * Helper per escape HTML sicuro
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Cleanup al cambio rotta
   */
  destroy() {
    clearTimeout(this._searchDebounceTimer);
    this.container = null;
  }
};

if (typeof window !== 'undefined') {
  window.archivioView = archivioView;
}
