/**
 * ALBUM STORICO CALCIATORI VIEW
 * Storico rose, carriere e schede calciatori per fantasquadra
 * ModernFCM
 */

const albumView = {
  currentTeamId: null, // Dinamico: prima squadra attiva per idAttuale (o da query param)
  currentRoleFilter: 'ALL', // 'ALL', '1', '2', '3', '4', 'SVINCOLATI'
  searchQuery: '',

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq') || params.has('team')) {
        const pId = parseInt(params.get('fsq') || params.get('Fsq') || params.get('team'), 10);
        if (!isNaN(pId)) this.currentTeamId = pId;
      } else {
        this.currentTeamId = null;
      }
    } else {
      this.currentTeamId = null;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Album Storico
            </div>
            <div class="card-subtitle">Collezione, presenze storiche e carriera di tutti i calciatori in rosa</div>
          </div>
        </div>

        <div id="albumContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento Album Storico...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#albumContent');
    await this.renderAlbum(subContainer);
  },

  async renderAlbum(subContainer) {
    const albumData = await fcmDataLoader.loadAlbum();
    if (!albumData || !albumData.teams || albumData.teams.length === 0) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Album non disponibili.</div>`;
      return;
    }

    const currentTeam = fcmDataLoader.getDefaultHistoricalTeam(albumData.teams, this.currentTeamId);
    if (!currentTeam) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Album non disponibili.</div>`;
      return;
    }
    this.currentTeamId = currentTeam.id;

    const allPlayers = albumData.getTeamPlayers(currentTeam.id);

    const countAll = allPlayers.length;
    const countP = allPlayers.filter(p => p.role === 1 && p.status === 0).length;
    const countD = allPlayers.filter(p => p.role === 2 && p.status === 0).length;
    const countC = allPlayers.filter(p => p.role === 3 && p.status === 0).length;
    const countA = allPlayers.filter(p => p.role === 4 && p.status === 0).length;
    const countS = allPlayers.filter(p => p.status !== 0).length;

    subContainer.innerHTML = `
      <!-- Controls Toolbar -->
      <div class="album-toolbar">
        <div class="album-team-select-group">
          <label for="albumTeamSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;letter-spacing:0.04em;">
            Fantasquadra:
          </label>
          <select id="albumTeamSelect" class="form-select" style="min-width:220px;font-weight:700;">
            ${albumData.teams.map(t => `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Search Input with Search Icon & Clear Button -->
        <div class="album-search-group" style="position:relative;display:flex;align-items:center;">
          <svg class="album-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="albumSearchInput" class="form-control album-search-input" placeholder="Cerca calciatore..." value="${this.searchQuery}" style="padding-right:28px;" />
          <button 
            type="button" 
            id="btnClearAlbumSearch" 
            title="Svuota ricerca"
            style="position:absolute;right:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:${this.searchQuery.trim() ? 'flex' : 'none'};align-items:center;justify-content:center;border-radius:50%;"
            onmouseover="this.style.color='var(--text-primary)'" 
            onmouseout="this.style.color='var(--text-muted)'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Role Filters Toolbar -->
      <div class="pill-tabs album-role-tabs" id="albumRoleTabs">
        <button class="pill-btn ${this.currentRoleFilter === 'ALL' ? 'active' : ''}" data-role="ALL">
          <span>Tutti</span> <span class="pill-count">(${countAll})</span>
        </button>
        <button class="pill-btn ${this.currentRoleFilter === '1' ? 'active' : ''}" data-role="1">
          <span>🧤 Portieri</span> <span class="pill-count">(${countP})</span>
        </button>
        <button class="pill-btn ${this.currentRoleFilter === '2' ? 'active' : ''}" data-role="2">
          <span>🛡️ Difensori</span> <span class="pill-count">(${countD})</span>
        </button>
        <button class="pill-btn ${this.currentRoleFilter === '3' ? 'active' : ''}" data-role="3">
          <span>⚙️ Centrocampisti</span> <span class="pill-count">(${countC})</span>
        </button>
        <button class="pill-btn ${this.currentRoleFilter === '4' ? 'active' : ''}" data-role="4">
          <span>⚡ Attaccanti</span> <span class="pill-count">(${countA})</span>
        </button>
        <button class="pill-btn ${this.currentRoleFilter === 'SVINCOLATI' ? 'active' : ''}" data-role="SVINCOLATI">
          <span>📋 <span class="desktop-only">Svincolati / Infort.</span><span class="mobile-only">Svincolati</span></span> <span class="pill-count">(${countS})</span>
        </button>
      </div>

      <!-- Players List Container -->
      <div id="albumPlayersGrid" style="display:flex;flex-direction:column;gap:16px;"></div>
    `;

    const gridContainer = subContainer.querySelector('#albumPlayersGrid');
    this.renderFilteredPlayers(gridContainer, allPlayers);

    // Event: Team selection changed
    subContainer.querySelector('#albumTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      try {
        window.history.replaceState(null, '', '#album?fsq=' + this.currentTeamId);
      } catch (err) {
        // Fallback
      }
      this.renderAlbum(subContainer);
    });

    // Event: Search input
    const searchInput = subContainer.querySelector('#albumSearchInput');
    const clearBtn = subContainer.querySelector('#btnClearAlbumSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = e.target.value.trim().length > 0 ? 'flex' : 'none';
        }
        this.renderFilteredPlayers(gridContainer, allPlayers);
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        });
      }
    }

    // Event: Role tabs
    subContainer.querySelectorAll('#albumRoleTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        subContainer.querySelectorAll('#albumRoleTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRoleFilter = btn.getAttribute('data-role');
        this.renderFilteredPlayers(gridContainer, allPlayers);
      });
    });
  },

  renderFilteredPlayers(container, allPlayers) {
    let filtered = allPlayers;

    // Apply role filter
    if (this.currentRoleFilter === 'SVINCOLATI') {
      filtered = filtered.filter(p => p.status !== 0);
    } else if (this.currentRoleFilter !== 'ALL') {
      const rNum = parseInt(this.currentRoleFilter, 10);
      filtered = filtered.filter(p => p.role === rNum && p.status === 0);
    }

    // Apply search filter
    if (this.searchQuery) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(this.searchQuery) || p.serieATeam.toLowerCase().includes(this.searchQuery));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center" style="padding:30px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessun calciatore trovato con i filtri correnti.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(player => {
      const roleBadgeClass = `role-${player.roleShort.toLowerCase()}`;

      return `
        <div class="album-player-card">
          <!-- Top info row -->
          <div class="album-player-header">
            <div class="album-player-avatar">
              <img src="img/foto/${player.photoCode}.jpg" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${player.name}" />
            </div>

            <div class="album-player-details">
              <div class="album-player-title-row">
                <span class="role-badge ${roleBadgeClass}">${player.roleShort}</span>
                <span class="album-player-name">${player.name}</span>
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;color:var(--text-primary);background:var(--bg-surface);padding:2px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                  <img src="img/live/sq/${player.serieATeam}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/sq/${player.serieATeam}.jpg';}else{this.style.display='none';}" style="height:18px;width:auto;vertical-align:middle;" alt="" />
                  ${player.serieATeam}
                </span>
                ${player.status === 1 ? `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;font-size:0.72rem;font-weight:700;padding:2px 6px;border-radius:4px;">SVINCOLATO</span>` : ''}
                ${player.status === 2 ? `<span class="badge" style="background:rgba(234,179,8,0.15);color:#eab308;font-size:0.72rem;font-weight:700;padding:2px 6px;border-radius:4px;">INFORTUNATO</span>` : ''}
              </div>
              <div class="album-player-meta-row">
                <span>Contratto: <strong style="color:var(--text-primary);">${player.contractText}</strong></span>
                <span style="color:var(--text-muted);">&bull;</span>
                <span>Valore Acq: <strong style="color:var(--accent-gold);">${player.costAcq}</strong></span>
              </div>
            </div>
          </div>

          <!-- Career / Seasons Display -->
          ${player.career.length > 0 ? `
            <!-- Desktop View: Standard Modern Table -->
            <div class="album-career-desktop table-responsive" style="margin:0;">
              <table class="modern-table" style="font-size:0.78rem;">
                <thead>
                  <tr>
                    <th>Stagione</th>
                    <th>Fantasquadra</th>
                    <th>Serie A</th>
                    <th class="text-center">Pres</th>
                    <th class="text-center">MV</th>
                    <th class="text-center">FMV</th>
                    <th class="text-center">Gol</th>
                    <th class="text-center">🟨/🟥</th>
                    <th class="text-center">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  ${player.career.map(c => `
                    <tr>
                      <td class="font-bold">${c.seasonNum} (${c.season})</td>
                      <td>
                        ${(() => {
          const link = c.rosterLink || (typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getSeasonRosterLink(c.seasonNum, c.teamId) : null);
          if (link && link.url) {
            return `<a href="${link.url}" ${link.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} style="color:var(--accent-primary);text-decoration:none;font-weight:700;" title="Apri rosa">${c.teamName}</a>`;
          }
          return c.teamName;
        })()}
                      </td>
                      <td style="white-space:nowrap;">
                        <img src="img/live/sq/${c.serieATeamPrimary}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/sq/${c.serieATeamPrimary}.jpg';}else{this.style.display='none';}" style="height:16px;width:auto;vertical-align:middle;margin-right:4px;" alt="" />
                        ${c.serieA}
                      </td>
                      <td class="text-center font-bold">${c.appearances}</td>
                      <td class="text-center">${c.mv}</td>
                      <td class="text-center font-bold" style="color:var(--accent-cyan);">${c.fmv}</td>
                      <td class="text-center font-bold" style="${c.goals > 0 ? 'color:var(--accent-emerald);' : ''}">${c.goals}</td>
                      <td class="text-center">${c.cautions}/${c.expulsions}</td>
                      <td class="text-center font-bold" style="color:var(--accent-gold);">${c.cost}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile View: Zero-scroll Responsive Season Cards -->
            <div class="album-career-mobile">
              ${player.career.map(c => `
                <div class="album-season-card">
                  <div class="album-season-header">
                    <div class="album-season-team">
                      <span style="color:var(--text-primary);">${c.seasonNum}ª (${c.season})</span>
                      <span style="color:var(--text-muted);">&bull;</span>
                      ${(() => {
            const link = c.rosterLink || (typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getSeasonRosterLink(c.seasonNum, c.teamId) : null);
            if (link && link.url) {
              return `<a href="${link.url}" ${link.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} style="color:var(--accent-primary);text-decoration:none;font-weight:700;" title="Apri rosa">${c.teamName}</a>`;
            }
            return `<span style="font-weight:700;color:var(--text-primary);">${c.teamName}</span>`;
          })()}
                    </div>
                    <div class="album-season-seriea">
                      <img src="img/live/sq/${c.serieATeamPrimary}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/sq/${c.serieATeamPrimary}.jpg';}else{this.style.display='none';}" style="height:14px;width:auto;vertical-align:middle;" alt="" />
                      <span>${c.serieA}</span>
                    </div>
                  </div>

                  <div class="album-season-grid">
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">Pres</div>
                      <div class="album-stat-chip-val">${c.appearances}</div>
                    </div>
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">MV</div>
                      <div class="album-stat-chip-val">${c.mv}</div>
                    </div>
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">FMV</div>
                      <div class="album-stat-chip-val" style="color:var(--accent-cyan);">${c.fmv}</div>
                    </div>
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">Gol</div>
                      <div class="album-stat-chip-val" style="${c.goals > 0 ? 'color:var(--accent-emerald)' : ''}">${c.goals}</div>
                    </div>
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">🟨/🟥</div>
                      <div class="album-stat-chip-val">${c.cautions}/${c.expulsions}</div>
                    </div>
                    <div class="album-stat-chip">
                      <div class="album-stat-chip-label">Costo</div>
                      <div class="album-stat-chip-val" style="color:var(--accent-gold);">${c.cost}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:0.78rem;color:var(--text-muted);font-style:italic;padding:6px 0;">
              Nessuno storico pregresso registrato nelle stagioni precedenti.
            </div>
          `}
        </div>
      `;
    }).join('');
  }
};

if (typeof window !== 'undefined') {
  window.albumView = albumView;
}
