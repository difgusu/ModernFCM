/**
 * ALMANACCO STORICO VIEW
 * Fedelissimi, Cannonieri, Cattivi, Bestie Nere, Top/Flop 11 e Fanta Rating
 * ModernFCM
 */

const almanaccoView = {
  currentTeamId: null, // Dinamico: prima squadra attiva per idAttuale (o da query param)
  currentCategory: 'fedelissimi', // 'fedelissimi', 'cannonieri', 'cattivi', 'bestienere', 'top11', 'rating'

  async render(container) {
    // Parse query params if any (e.g. ?fsq=22&cat=cannonieri)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq') || params.has('team')) {
        const pId = parseInt(params.get('fsq') || params.get('Fsq') || params.get('team'), 10);
        if (!isNaN(pId)) this.currentTeamId = pId;
      } else {
        this.currentTeamId = null;
      }
      if (params.has('cat') || params.has('category')) {
        const c = params.get('cat') || params.get('category');
        if (['fedelissimi', 'cannonieri', 'cattivi', 'bestienere', 'top11', 'rating'].includes(c)) {
          this.currentCategory = c;
        }
      }
    } else {
      this.currentTeamId = null;
    }

    container.innerHTML = `
      <style>
        .almanacco-tabs-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .almanacco-desktop-view {
          display: block !important;
        }
        .almanacco-mobile-view {
          display: none !important;
        }

        @media (max-width: 768px) {
          .almanacco-desktop-view {
            display: none !important;
          }
          .almanacco-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }

          .almanacco-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
            gap: 12px !important;
          }
          .almanacco-team-group {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .almanacco-team-group select {
            width: 100% !important;
            min-width: 0 !important;
          }
          .pill-tabs.almanacco-tabs-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px !important;
            overflow: visible !important;
            border-radius: var(--radius-lg, 12px) !important;
            padding: 6px !important;
            background: var(--bg-surface-elevated) !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .pill-tabs.almanacco-tabs-grid .pill-btn {
            width: 100% !important;
            min-width: 0 !important;
            text-align: center !important;
            justify-content: center !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 8px 6px !important;
            font-size: 0.8rem !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
            border-radius: var(--radius-md, 8px) !important;
            box-sizing: border-box !important;
          }

          /* Mobile Cards for Almanacco */
          .almanacco-card-item {
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-sizing: border-box;
          }
          .almanacco-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .almanacco-card-player {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            flex: 1;
          }
          .almanacco-card-rank {
            font-weight: 800;
            color: var(--accent-cyan);
            font-size: 0.8rem;
            min-width: 22px;
            text-align: center;
          }
          .almanacco-card-name {
            font-weight: 700;
            font-size: 0.9rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .almanacco-card-stats {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            padding-top: 6px;
            border-top: 1px solid var(--border-subtle);
            font-size: 0.78rem;
          }
          .almanacco-stat-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 3px 8px;
          }
          .almanacco-stat-label {
            font-size: 0.7rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
          }
          .almanacco-stat-val {
            font-weight: 800;
            font-size: 0.85rem;
          }
        }
      </style>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              Fanta Almanacco Storico
            </div>
            <div class="card-subtitle">Statistiche all-time, cannonieri, primati, top/flop 11 e rendimento storico</div>
          </div>
        </div>

        <div id="almanaccoContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento Almanacco Storico...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#almanaccoContent');
    await this.renderAlmanacco(subContainer);
  },

  async renderAlmanacco(subContainer) {
    const alm = await fcmDataLoader.loadAlmanacco();
    if (!alm || !alm.teams || alm.teams.length === 0) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Almanacco non disponibili.</div>`;
      return;
    }

    const currentTeam = fcmDataLoader.getDefaultHistoricalTeam(alm.teams, this.currentTeamId);
    if (!currentTeam) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Almanacco non disponibili.</div>`;
      return;
    }
    this.currentTeamId = currentTeam.id;

    const fedelissimi = alm.getFedelissimi(currentTeam.id);
    const cannonieri = alm.getCannonieri(currentTeam.id);
    const cattivi = alm.getCattivi(currentTeam.id);
    const bestieNere = alm.getBestieNere(currentTeam.id);

    subContainer.innerHTML = `
      <!-- Toolbar: Selettore Fantasquadra + Category Tabs -->
      <div class="almanacco-toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div class="almanacco-team-group" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label for="almanaccoTeamSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;letter-spacing:0.04em;">
            Fantasquadra:
          </label>
          <select id="almanaccoTeamSelect" class="form-select" style="min-width:220px;font-weight:700;">
            ${alm.teams.map(t => `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Pill Tabs per Categoria (disposti a 2 a 2 su mobile) -->
        <div class="pill-tabs almanacco-tabs-grid" id="almCategoryTabs" style="margin:0;">
          <button class="pill-btn ${this.currentCategory === 'fedelissimi' ? 'active' : ''}" data-cat="fedelissimi">
            👑 Fedelissimi
          </button>
          <button class="pill-btn ${this.currentCategory === 'cannonieri' ? 'active' : ''}" data-cat="cannonieri">
            ⚽ Cannonieri
          </button>
          <button class="pill-btn ${this.currentCategory === 'cattivi' ? 'active' : ''}" data-cat="cattivi">
            🟨 Cattivi
          </button>
          <button class="pill-btn ${this.currentCategory === 'bestienere' ? 'active' : ''}" data-cat="bestienere">
            🎯 Bestie Nere
          </button>
        </div>
      </div>

      <!-- Detail Container -->
      <div id="almDetailContainer"></div>
    `;

    const detailContainer = subContainer.querySelector('#almDetailContainer');
    this.renderCategoryDetail(detailContainer, {
      teamName: currentTeam.name,
      fedelissimi,
      cannonieri,
      cattivi,
      bestieNere
    });

    // Event: Team selection changed
    subContainer.querySelector('#almanaccoTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.renderAlmanacco(subContainer);
    });

    // Event: Category tab clicked
    subContainer.querySelectorAll('#almCategoryTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.getAttribute('data-cat');
        this.renderAlmanacco(subContainer);
      });
    });
  },

  renderCategoryDetail(detailContainer, data) {
    let content = '';

    if (this.currentCategory === 'fedelissimi') {
      content = `
        <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
          I calciatori con il maggior numero di presenze ufficiali nella storia di <strong>${data.teamName}</strong>.
        </div>

        <!-- Desktop View: Tabella Classica -->
        <div class="almanacco-desktop-view table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th>Giocatore</th>
                <th class="text-center" style="width:60px;">Ruolo</th>
                <th class="text-center">Presenze All-Time</th>
              </tr>
            </thead>
            <tbody>
              ${data.fedelissimi.length === 0 ? `<tr><td colspan="4" class="text-center text-muted">Nessun dato disponibile</td></tr>` : ''}
              ${data.fedelissimi.slice(0, 20).map((p, idx) => `
                <tr>
                  <td class="text-center font-bold text-muted">${idx + 1}</td>
                  <td class="font-bold">${p.player}</td>
                  <td class="text-center">
                    <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-cyan);font-size:1.05rem;">
                    ${p.appearances}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
        <div class="almanacco-mobile-view">
          ${data.fedelissimi.length === 0 ? `<div class="text-center text-muted" style="padding:20px;">Nessun dato disponibile</div>` : ''}
          ${data.fedelissimi.slice(0, 20).map((p, idx) => `
            <div class="almanacco-card-item">
              <div class="almanacco-card-header">
                <div class="almanacco-card-player">
                  <span class="almanacco-card-rank">#${idx + 1}</span>
                  <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  <span class="almanacco-card-name">${p.player}</span>
                </div>
                <div class="almanacco-stat-pill" style="border-color:rgba(6,182,212,0.3);">
                  <span class="almanacco-stat-label">Presenze</span>
                  <span class="almanacco-stat-val" style="color:var(--accent-cyan);font-size:0.95rem;">${p.appearances}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.currentCategory === 'cannonieri') {
      content = `
        <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
          I migliori marcatori di sempre per <strong>${data.teamName}</strong> con relative medie voto.
        </div>

        <!-- Desktop View: Tabella Classica -->
        <div class="almanacco-desktop-view table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th>Giocatore</th>
                <th class="text-center" style="width:60px;">Ruolo</th>
                <th class="text-center">Gol Fatti</th>
                <th class="text-center">Presenze</th>
                <th class="text-center">Media Voto</th>
                <th class="text-center">FantaMedia</th>
              </tr>
            </thead>
            <tbody>
              ${data.cannonieri.length === 0 ? `<tr><td colspan="7" class="text-center text-muted">Nessun dato disponibile</td></tr>` : ''}
              ${data.cannonieri.slice(0, 20).map((p, idx) => `
                <tr>
                  <td class="text-center font-bold text-muted">${idx + 1}</td>
                  <td class="font-bold">${p.player}</td>
                  <td class="text-center">
                    <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-emerald);font-size:1.1rem;">
                    ⚽ ${p.goals}
                  </td>
                  <td class="text-center">${p.appearances}</td>
                  <td class="text-center">${parseFloat(p.mv).toFixed(2)}</td>
                  <td class="text-center font-bold" style="color:var(--accent-cyan);">${parseFloat(p.fmv).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
        <div class="almanacco-mobile-view">
          ${data.cannonieri.length === 0 ? `<div class="text-center text-muted" style="padding:20px;">Nessun dato disponibile</div>` : ''}
          ${data.cannonieri.slice(0, 20).map((p, idx) => `
            <div class="almanacco-card-item">
              <div class="almanacco-card-header">
                <div class="almanacco-card-player">
                  <span class="almanacco-card-rank">#${idx + 1}</span>
                  <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  <span class="almanacco-card-name">${p.player}</span>
                </div>
                <div class="almanacco-stat-pill" style="border-color:rgba(16,185,129,0.3);">
                  <span class="almanacco-stat-label">Gol</span>
                  <span class="almanacco-stat-val" style="color:var(--accent-emerald);font-size:0.95rem;">⚽ ${p.goals}</span>
                </div>
              </div>
              <div class="almanacco-card-stats">
                <div class="almanacco-stat-pill">
                  <span class="almanacco-stat-label">Presenze</span>
                  <span class="almanacco-stat-val">${p.appearances}</span>
                </div>
                <div class="almanacco-stat-pill">
                  <span class="almanacco-stat-label">MV</span>
                  <span class="almanacco-stat-val">${parseFloat(p.mv).toFixed(2)}</span>
                </div>
                <div class="almanacco-stat-pill" style="border-color:rgba(6,182,212,0.3);">
                  <span class="almanacco-stat-label">FM</span>
                  <span class="almanacco-stat-val" style="color:var(--accent-cyan);">${parseFloat(p.fmv).toFixed(2)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.currentCategory === 'cattivi') {
      content = `
        <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
          I calciatori con il maggior numero di cartellini rossi e gialli rimediati con la maglia di <strong>${data.teamName}</strong>.
        </div>

        <!-- Desktop View: Tabella Classica -->
        <div class="almanacco-desktop-view table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th>Giocatore</th>
                <th class="text-center" style="width:60px;">Ruolo</th>
                <th class="text-center">🟥 Espulsioni</th>
                <th class="text-center">🟨 Ammonizioni</th>
                <th class="text-center">Presenze</th>
                <th class="text-center">Media Voto</th>
              </tr>
            </thead>
            <tbody>
              ${data.cattivi.length === 0 ? `<tr><td colspan="7" class="text-center text-muted">Nessun dato disponibile</td></tr>` : ''}
              ${data.cattivi.slice(0, 20).map((p, idx) => `
                <tr>
                  <td class="text-center font-bold text-muted">${idx + 1}</td>
                  <td class="font-bold">${p.player}</td>
                  <td class="text-center">
                    <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-rose);">
                    ${p.expulsions}
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-gold);">
                    ${p.cautions}
                  </td>
                  <td class="text-center">${p.appearances}</td>
                  <td class="text-center">${parseFloat(p.mv).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
        <div class="almanacco-mobile-view">
          ${data.cattivi.length === 0 ? `<div class="text-center text-muted" style="padding:20px;">Nessun dato disponibile</div>` : ''}
          ${data.cattivi.slice(0, 20).map((p, idx) => `
            <div class="almanacco-card-item">
              <div class="almanacco-card-header">
                <div class="almanacco-card-player">
                  <span class="almanacco-card-rank">#${idx + 1}</span>
                  <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  <span class="almanacco-card-name">${p.player}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <div class="almanacco-stat-pill" style="border-color:rgba(239,68,68,0.3);">
                    <span class="almanacco-stat-label">🟥</span>
                    <span class="almanacco-stat-val" style="color:var(--accent-rose);">${p.expulsions}</span>
                  </div>
                  <div class="almanacco-stat-pill" style="border-color:rgba(245,158,11,0.3);">
                    <span class="almanacco-stat-label">🟨</span>
                    <span class="almanacco-stat-val" style="color:var(--accent-gold);">${p.cautions}</span>
                  </div>
                </div>
              </div>
              <div class="almanacco-card-stats">
                <div class="almanacco-stat-pill">
                  <span class="almanacco-stat-label">Presenze</span>
                  <span class="almanacco-stat-val">${p.appearances}</span>
                </div>
                <div class="almanacco-stat-pill">
                  <span class="almanacco-stat-label">Media Voto</span>
                  <span class="almanacco-stat-val">${parseFloat(p.mv).toFixed(2)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.currentCategory === 'bestienere') {
      content = `
        <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary);">
          I calciatori avversari che hanno segnato il maggior numero di reti contro <strong>${data.teamName}</strong>.
        </div>

        <!-- Desktop View: Tabella Classica -->
        <div class="almanacco-desktop-view table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="width:50px;" class="text-center">#</th>
                <th>Giocatore Avversario</th>
                <th class="text-center" style="width:60px;">Ruolo</th>
                <th class="text-center">Gol Segnati Contro</th>
                <th class="text-center">Presenze Contro</th>
                <th class="text-center">FantaMedia</th>
              </tr>
            </thead>
            <tbody>
              ${data.bestieNere.length === 0 ? `<tr><td colspan="6" class="text-center text-muted">Nessun dato disponibile</td></tr>` : ''}
              ${data.bestieNere.slice(0, 20).map((p, idx) => `
                <tr>
                  <td class="text-center font-bold text-muted">${idx + 1}</td>
                  <td class="font-bold" style="color:var(--text-primary);">${p.player}</td>
                  <td class="text-center">
                    <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-rose);font-size:1.1rem;">
                    🎯 ${p.goals}
                  </td>
                  <td class="text-center">${p.appearances}</td>
                  <td class="text-center font-bold">${parseFloat(p.fmv).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
        <div class="almanacco-mobile-view">
          ${data.bestieNere.length === 0 ? `<div class="text-center text-muted" style="padding:20px;">Nessun dato disponibile</div>` : ''}
          ${data.bestieNere.slice(0, 20).map((p, idx) => `
            <div class="almanacco-card-item">
              <div class="almanacco-card-header">
                <div class="almanacco-card-player">
                  <span class="almanacco-card-rank">#${idx + 1}</span>
                  <span class="role-badge role-${p.roleShort.toLowerCase()}">${p.roleShort}</span>
                  <span class="almanacco-card-name">${p.player}</span>
                </div>
                <div class="almanacco-stat-pill" style="border-color:rgba(239,68,68,0.3);">
                  <span class="almanacco-stat-label">Gol Subiti</span>
                  <span class="almanacco-stat-val" style="color:var(--accent-rose);font-size:0.95rem;">🎯 ${p.goals}</span>
                </div>
              </div>
              <div class="almanacco-card-stats">
                <div class="almanacco-stat-pill">
                  <span class="almanacco-stat-label">Presenze Contro</span>
                  <span class="almanacco-stat-val">${p.appearances}</span>
                </div>
                <div class="almanacco-stat-pill" style="border-color:rgba(6,182,212,0.3);">
                  <span class="almanacco-stat-label">FM Contro</span>
                  <span class="almanacco-stat-val" style="color:var(--accent-cyan);">${parseFloat(p.fmv).toFixed(2)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    detailContainer.innerHTML = content;
  }
};

if (typeof window !== 'undefined') {
  window.almanaccoView = almanaccoView;
}
