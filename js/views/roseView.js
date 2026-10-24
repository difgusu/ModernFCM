/**
 * ROSE VIEW
 * Team rosters, player search, contracts & prices
 * ModernFCM
 */

const roseView = {
  currentTeamId: null, // Dinamico: prima squadra attiva da arrFantasquadre (o da query param)
  currentTab: 'attuali', // 'attuali' | 'svincolati' | 'bilancio'
  searchQuery: '',

  render(container) {
    const teams = fcmDataLoader.getTeams();

    // Parse query params if present in URL (e.g. #rose?team=2 or #rose?tab=svincolati)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const qStr = hash.substring(hash.indexOf('?'));
      const params = new URLSearchParams(qStr);
      if (params.has('team') || params.has('fsq')) {
        const t = parseInt(params.get('team') || params.get('fsq'), 10);
        if (!isNaN(t) && t > 0) this.currentTeamId = t;
      }
      if (params.has('tab')) {
        const tab = params.get('tab');
        if (['attuali', 'svincolati', 'bilancio'].includes(tab)) this.currentTab = tab;
      }
    }

    // Risoluzione dinamica della fantasquadra (prima squadra di arrFantasquadre se non specificata)
    const currentTeam = (this.currentTeamId && fcmDataLoader.getTeamById(this.currentTeamId)) || teams[0] || { ID: 1, Nome: 'Fantasquadra' };
    this.currentTeamId = currentTeam.ID;

    const rosterData = fcmDataLoader.getTeamRoster(this.currentTeamId);
    const budgetData = fcmDataLoader.getTeamBudget(this.currentTeamId);

    const attuali = rosterData.attuali || [];
    const svincolati = rosterData.svincolati || [];
    const infortunati = rosterData.infortunati || [];

    // Filter roster if global search query is present
    const searchResults = this.searchQuery.trim().length >= 2
      ? fcmDataLoader.searchPlayers(this.searchQuery)
      : null;

    let html = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Rose Fantasquadre
          </div>
        </div>

        <!-- Global Search Bar -->
        <div class="search-bar-wrapper">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            id="inputSearchPlayers" 
            class="search-input" 
            placeholder="Cerca calciatore in tutte le rose..." 
            value="${this.searchQuery}"
            style="padding-right: 38px;"
          />
          <button 
            type="button" 
            id="btnClearSearchInput" 
            class="search-clear-btn" 
            title="Svuota ricerca"
            aria-label="Svuota ricerca"
            style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:${this.searchQuery.trim().length > 0 ? 'inline-flex' : 'none'};align-items:center;justify-content:center;border-radius:50%;"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Team Selector Dropdown (hidden if searching) -->
        ${!searchResults ? `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);flex-wrap:wrap;">
            <label for="selRoseTeam" style="font-weight:700;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;">
              Seleziona Squadra:
            </label>
            <select id="selRoseTeam" class="form-select" style="min-width:240px;font-weight:700;font-size:0.95rem;">
              ${teams.map(t => `
                <option value="${t.ID}" ${t.ID === this.currentTeamId ? 'selected' : ''}>
                  ${t.Nome} (${t.Presidente})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Team Header Summary Card -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${fcmDataLoader.getTeamLogo(currentTeam.Nome || currentTeam.ID)}" style="width:48px;height:48px;border-radius:var(--radius-sm);object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div>
                <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                  ${currentTeam.Nome} ${fcmDataLoader.getTeamTrophiesHtml(currentTeam.Nome)}
                </h3>
                <div style="font-size:0.8rem;color:var(--text-muted);">Presidente: <b>${currentTeam.Presidente}</b></div>
              </div>
            </div>

            <!-- Team Stats Chips -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div style="background:var(--bg-main);padding:8px 18px;border-radius:var(--radius-sm);text-align:center;border:1px solid var(--border-subtle);">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Crediti Residui</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--accent-gold);">${currentTeam.CreditiResidui}</div>
              </div>
            </div>
          </div>

          <!-- Section Sub-Tabs (Rosa Attuale, Svincolati/Infortunati, Bilancio) -->
          <div class="pill-tabs rose-sub-tabs" id="roseSubTabs">
            <button class="pill-btn ${this.currentTab === 'attuali' ? 'active' : ''}" data-tab="attuali">
              <span class="tab-icon">⚽</span>
              <span class="tab-label-text">Rosa Attuale</span>
              <span class="tab-count">(${attuali.length})</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'svincolati' ? 'active' : ''}" data-tab="svincolati">
              <span class="tab-icon">📋</span>
              <span class="tab-label-text">Svincolati<span class="tab-label-extra"> &amp; Infortunati</span></span>
              <span class="tab-count">(${svincolati.length + infortunati.length})</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'bilancio' ? 'active' : ''}" data-tab="bilancio">
              <span class="tab-icon">💰</span>
              <span class="tab-label-text">Bilancio<span class="tab-label-extra"> &amp; Movimenti</span></span>
              <span class="tab-count">(${budgetData.transactions.length})</span>
            </button>
          </div>
        ` : ''}

        <!-- Content: Search Results OR Selected Tab -->
        ${searchResults ? `
          <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;color:var(--accent-cyan);">Risultati ricerca: ${searchResults.length} giocatori trovati</span>
            <button id="btnClearSearch" class="pill-btn active" style="padding:4px 12px;font-size:0.75rem;">Azzera ricerca</button>
          </div>
          <div class="table-responsive rose-table-responsive">
            <table class="modern-table rose-table">
              <thead>
                <tr>
                  <th class="rose-col-role">R</th>
                  <th class="rose-col-player">Calciatore</th>
                  <th>Fantasquadra</th>
                  <th class="text-right rose-col-cost">Costo Acq.</th>
                </tr>
              </thead>
              <tbody>
                ${searchResults.map(p => `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p)}
                    <td>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <img src="${fcmDataLoader.getTeamLogo(p.team.Nome || p.team.ID)}" style="width:20px;height:20px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                        <span style="font-weight:600;font-size:0.85rem;">${p.team.Nome}</span>
                      </div>
                    </td>
                    <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : this.currentTab === 'attuali' ? `
          <!-- TAB 1: Rosa Attuale -->
          <div class="table-responsive rose-table-responsive">
            <table class="modern-table rose-table">
              <thead>
                <tr>
                  <th class="rose-col-role">R</th>
                  <th class="rose-col-player">Calciatore</th>
                  <th class="text-center rose-col-contract">
                    <span class="desktop-only">Contratto</span>
                    <span class="mobile-only">Contr.</span>
                  </th>
                  <th class="text-right rose-col-cost">
                    <span class="desktop-only">Costo Acq.</span>
                    <span class="mobile-only">Costo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${attuali.length > 0 ? attuali.map(p => `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p)}
                    <td class="text-center rose-cell-contract">${p.contract}</td>
                    <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="4" class="text-center" style="padding:24px;color:var(--text-muted);">Nessun giocatore in rosa</td></tr>
                `}
              </tbody>
            </table>
          </div>
        ` : this.currentTab === 'svincolati' ? `
          <!-- TAB 2: Svincolati & Infortunati -->
          <div style="display:flex;flex-direction:column;gap:24px;">
            <!-- Svincolati Section -->
            <div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span class="badge badge-warning">Svincolati</span>
                <span>Calciatori Ceduti / Svincolati (${svincolati.length})</span>
              </div>
              <div class="table-responsive rose-table-responsive">
                <table class="modern-table rose-table">
                  <thead>
                    <tr>
                      <th class="rose-col-role">R</th>
                      <th class="rose-col-player">Calciatore</th>
                      <th class="text-right rose-col-cost">
                        <span class="desktop-only">Costo Acq.</span>
                        <span class="mobile-only">Costo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${svincolati.length > 0 ? svincolati.map(p => `
                      <tr>
                        <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                        ${this.renderPlayerCell(p)}
                        <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                      </tr>
                    `).join('') : `
                      <tr><td colspan="3" class="text-center" style="padding:16px;color:var(--text-muted);">Nessun calciatore svincolato</td></tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Infortunati Section -->
            <div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span class="badge badge-danger">Infortunati</span>
                <span>Tagli Temporanei per Infortunio (${infortunati.length})</span>
              </div>
              <div class="table-responsive rose-table-responsive">
                <table class="modern-table rose-table">
                  <thead>
                    <tr>
                      <th class="rose-col-role">R</th>
                      <th class="rose-col-player">Calciatore</th>
                      <th class="text-center rose-col-inf">
                        <span class="desktop-only">Dalla Giornata</span>
                        <span class="mobile-only">Dalla G.</span>
                      </th>
                      <th class="text-right rose-col-cost">
                        <span class="desktop-only">Costo Acq.</span>
                        <span class="mobile-only">Costo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${infortunati.length > 0 ? infortunati.map(p => `
                      <tr>
                        <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                        ${this.renderPlayerCell(p)}
                        <td class="text-center font-bold rose-cell-inf" style="color:var(--accent-rose);">${p.gioInf > 0 ? (p.gioInf < 100 ? 'G ' + p.gioInf : p.gioInf) : '-'}</td>
                        <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                      </tr>
                    `).join('') : `
                      <tr><td colspan="4" class="text-center" style="padding:16px;color:var(--text-muted);">Nessun calciatore in lista infortunati</td></tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : `
          <!-- TAB 3: Bilancio Squadra -->
          <div>
            <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
              <span style="font-size:0.9rem;color:var(--text-secondary);">Registro storico movimenti finanziari e crediti residui.</span>
              <div style="font-size:0.95rem;font-weight:800;">
                Saldo Attuale: <span style="color:var(--accent-gold);">${budgetData.remainingCredits} Crediti</span>
              </div>
            </div>

            <div class="table-responsive rose-table-responsive">
              <table class="modern-table rose-bilancio-table">
                <thead>
                  <tr>
                    <th class="rose-bilancio-col-date">Data</th>
                    <th class="rose-bilancio-col-desc">Descrizione Operazione</th>
                    <th class="rose-bilancio-col-val text-right">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  ${budgetData.transactions.length > 0 ? budgetData.transactions.map(b => {
      const dateParts = (b.date || '').split(' ');
      const dateStr = dateParts[0] || b.date;
      const timeStr = dateParts[1] ? dateParts[1].substring(0, 5) : '';
      return `
                      <tr>
                        <td class="rose-bilancio-cell-date">
                          <div>${dateStr}</div>
                          ${timeStr ? `<div style="font-size:0.68rem;opacity:0.75;">${timeStr}</div>` : ''}
                        </td>
                        <td class="rose-bilancio-cell-desc">${b.description}</td>
                        <td class="rose-bilancio-cell-val text-right" style="color:${b.isIncome ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
                          ${b.isIncome ? '+' : ''}${b.value}
                        </td>
                      </tr>
                    `;
    }).join('') : `
                    <tr><td colspan="3" class="text-center" style="padding:24px;color:var(--text-muted);">Nessun movimento registrato a bilancio</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `}

      </div>
    `;

    container.innerHTML = html;

    // Attach team selector dropdown change
    const teamSelect = container.querySelector('#selRoseTeam');
    if (teamSelect) {
      teamSelect.addEventListener('change', (e) => {
        this.currentTeamId = parseInt(e.target.value);
        this.searchQuery = '';
        this.render(container);
      });
    }

    // Attach sub-tab buttons
    const subTabBtns = container.querySelectorAll('#roseSubTabs button');
    subTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.getAttribute('data-tab');
        this.render(container);
      });
    });

    // Attach live search
    const searchInput = container.querySelector('#inputSearchPlayers');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
        const refocused = document.getElementById('inputSearchPlayers');
        if (refocused) {
          refocused.focus();
          refocused.setSelectionRange(refocused.value.length, refocused.value.length);
        }
      });
    }

    // Attach clear search buttons
    const clearBtn = container.querySelector('#btnClearSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.render(container);
      });
    }

    const clearInputBtn = container.querySelector('#btnClearSearchInput');
    if (clearInputBtn) {
      clearInputBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.render(container);
        const refocused = document.getElementById('inputSearchPlayers');
        if (refocused) refocused.focus();
      });
    }
  },

  /**
   * Render player cell with optional link to #schede_giocatori?id=...
   * Only players belonging to Serie A teams have links.
   * Non-Serie A players ({ELIMINATA}, {SERIE ESTERA}, {SERIE MINORE}) remain plain text.
   */
  renderPlayerCell(p) {
    const isSerieA = fcmDataLoader.isSerieATeam(p.serieATeam);
    const playerId = isSerieA ? (p.playerId || fcmDataLoader.getSerieAPlayerId(p.name)) : null;
    const hasLink = isSerieA && !!playerId;
    const linkHref = hasLink ? `#schede_giocatori?id=${playerId}` : null;

    const photoHtml = `<img src="${fcmDataLoader.getPlayerPhoto(p.name)}" class="roster-player-photo" alt="${p.name}" width="28" height="28" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif'" />`;
    const photoBlock = hasLink
      ? `<a href="${linkHref}" class="rose-player-photo-link" title="Apri scheda di ${p.name}">${photoHtml}</a>`
      : photoHtml;

    const nameBlock = hasLink
      ? `<a href="${linkHref}" class="rose-player-link" title="Apri scheda di ${p.name}">${p.name}</a>`
      : p.name;

    return `
      <td class="rose-player-cell">
        <div class="rose-player-flex">
          ${photoBlock}
          <div class="rose-player-info">
            <div class="rose-player-name">${nameBlock}</div>
            <div class="rose-player-club">
              ${p.serieATeam ? `<img src="${fcmDataLoader.getSerieAShirt(p.serieATeam)}" class="pr-maglia rose-shirt-img" onerror="this.onerror=null; this.src='img/sq/undefined.svg';" />` : ''}
              <span>${p.serieATeam || ''}</span>
            </div>
          </div>
        </div>
      </td>
    `;
  }
};
