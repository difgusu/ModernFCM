/**
 * TOP COSTI D'ASTA VIEW
 * Statistiche dei calciatori più pagati all'asta (Storico All-Time e Stagione Corrente)
 * ModernFCM
 */

const topCostiView = {
  currentTab: 'storico', // 'storico' or 'stagione'
  currentTeamId: 0,      // 0 = Totale Lega
  currentRole: 'ALL',    // 'ALL', 'P', 'D', 'C', 'A'

  async render(container) {
    const hash = window.location.hash || '';
    const baseHash = hash.split('?')[0];

    if (baseHash === '#topcostistagione') {
      this.currentTab = 'stagione';
    } else if (baseHash === '#topcosti') {
      this.currentTab = 'storico';
    }

    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq') || params.has('team')) {
        const pId = parseInt(params.get('fsq') || params.get('Fsq') || params.get('team'), 10);
        if (!isNaN(pId)) this.currentTeamId = pId;
      }
      if (params.has('tab')) {
        const t = params.get('tab');
        if (t === 'storico' || t === 'stagione') this.currentTab = t;
      }
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              Top Costi
            </div>
            <div class="card-subtitle">I calciatori più pagati alle aste di mercato all-time e nell'annata corrente</div>
          </div>
        </div>

        <!-- Subtab Switcher: Storico vs Stagione -->
        <div class="pill-tabs topcosti-subtabs" id="topCostiSubtabs" style="margin-bottom:20px;">
          <button class="pill-btn ${this.currentTab === 'storico' ? 'active' : ''}" data-tab="storico">
            💰 Storico All-Time
          </button>
          <button class="pill-btn ${this.currentTab === 'stagione' ? 'active' : ''}" data-tab="stagione">
            🏷️ Stagione Corrente
          </button>
        </div>

        <div id="topCostiContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento Top Costi...
          </div>
        </div>
      </div>
    `;

    // Subtab switch events
    const subContainer = container.querySelector('#topCostiContent');
    container.querySelectorAll('#topCostiSubtabs button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const newTab = btn.getAttribute('data-tab');
        if (this.currentTab === newTab) return;
        this.currentTab = newTab;
        container.querySelectorAll('#topCostiSubtabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newTab === 'stagione' ? '#topcostistagione' : '#topcosti');
        }
        this.renderTopCosti(subContainer);
      });
    });

    await this.renderTopCosti(subContainer);
  },

  async renderTopCosti(subContainer) {
    const costiData = await fcmDataLoader.loadTopCosti();
    if (!costiData || !costiData.teams) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Top Costi non disponibili.</div>`;
      return;
    }

    const isCurrent = this.currentTab === 'stagione';
    const limit = this.currentRole === 'ALL' ? 20 : 15;
    const records = costiData.getTopCosti(this.currentTeamId, this.currentRole, isCurrent, limit);

    subContainer.innerHTML = `
      <style>
        .topcosti-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
          background: var(--bg-surface-elevated);
          padding: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }
        .topcosti-team-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .topcosti-team-select {
          min-width: 240px;
          font-weight: 700;
        }
        .topcosti-subtabs {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
        }
        .topcosti-role-tabs {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .topcosti-desktop-view {
          display: block !important;
        }
        .topcosti-mobile-view {
          display: none !important;
        }

        @media (max-width: 768px) {
          .topcosti-desktop-view {
            display: none !important;
          }
          .topcosti-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }

          .topcosti-subtabs {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px !important;
            border-radius: var(--radius-lg, 12px) !important;
            padding: 6px !important;
            background: var(--bg-surface-elevated) !important;
          }
          .topcosti-subtabs .pill-btn {
            width: 100% !important;
            text-align: center !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 0.82rem !important;
            font-weight: 700 !important;
            border-radius: var(--radius-md, 8px) !important;
          }

          .topcosti-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
            gap: 12px !important;
          }
          .topcosti-team-group {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .topcosti-team-select {
            width: 100% !important;
            min-width: 0 !important;
          }

          /* Griglia a 6 colonne per disporre 3 tab nella 1ª riga e 2 nella 2ª riga */
          .topcosti-role-tabs {
            display: grid !important;
            grid-template-columns: repeat(6, 1fr) !important;
            gap: 6px !important;
            width: 100% !important;
            border-radius: var(--radius-lg, 12px) !important;
            padding: 6px !important;
            background: var(--bg-surface-elevated) !important;
            box-sizing: border-box !important;
          }
          .topcosti-role-tabs .pill-btn {
            width: 100% !important;
            min-width: 0 !important;
            text-align: center !important;
            justify-content: center !important;
            display: inline-flex !important;
            align-items: center !important;
            padding: 8px 4px !important;
            font-size: 0.74rem !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
            border-radius: var(--radius-md, 8px) !important;
            box-sizing: border-box !important;
          }
          .topcosti-role-tabs .pill-btn:nth-child(1),
          .topcosti-role-tabs .pill-btn:nth-child(2),
          .topcosti-role-tabs .pill-btn:nth-child(3) {
            grid-column: span 2 !important;
          }
          .topcosti-role-tabs .pill-btn:nth-child(4),
          .topcosti-role-tabs .pill-btn:nth-child(5) {
            grid-column: span 3 !important;
          }

          /* Mobile Cards for Top Costi */
          .topcosti-card-item {
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-sizing: border-box;
          }
          .topcosti-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .topcosti-card-player {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            flex: 1;
          }
          .topcosti-card-rank {
            font-weight: 800;
            color: var(--accent-gold);
            font-size: 0.8rem;
            min-width: 22px;
            text-align: center;
          }
          .topcosti-card-name {
            font-weight: 700;
            font-size: 0.9rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .topcosti-card-subinfo {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            color: var(--text-secondary);
            flex-wrap: wrap;
          }
          .topcosti-card-stats {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            padding-top: 6px;
            border-top: 1px solid var(--border-subtle);
            font-size: 0.78rem;
          }
          .topcosti-stat-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 3px 8px;
          }
          .topcosti-stat-label {
            font-size: 0.7rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
          }
          .topcosti-stat-val {
            font-weight: 800;
            font-size: 0.85rem;
          }
        }
      </style>

      <!-- Toolbar: Squadra Select + Role Tabs -->
      <div class="topcosti-toolbar">
        <div class="topcosti-team-group">
          <label for="costiTeamSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.04em;">
            Fantasquadra:
          </label>
          <select id="costiTeamSelect" class="form-select topcosti-team-select">
            <option value="0" ${this.currentTeamId === 0 ? 'selected' : ''}>** TOTALE LEGA (Tutte) **</option>
            ${costiData.teams.map(t => `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Role Filter Tabs (3 in riga 1, 2 in riga 2 su mobile) -->
        <div class="pill-tabs topcosti-role-tabs" id="costiRoleTabs">
          <button class="pill-btn ${this.currentRole === 'ALL' ? 'active' : ''}" data-role="ALL">
            🏆 Top Assoluti
          </button>
          <button class="pill-btn ${this.currentRole === 'P' ? 'active' : ''}" data-role="P">
            🧤 Portieri
          </button>
          <button class="pill-btn ${this.currentRole === 'D' ? 'active' : ''}" data-role="D">
            🛡️ Difensori
          </button>
          <button class="pill-btn ${this.currentRole === 'C' ? 'active' : ''}" data-role="C">
            ⚙️ Centrocampisti
          </button>
          <button class="pill-btn ${this.currentRole === 'A' ? 'active' : ''}" data-role="A">
            ⚡ Attaccanti
          </button>
        </div>
      </div>

      <!-- Table Results: Desktop View -->
      <div class="topcosti-desktop-view table-responsive">
        <table class="modern-table">
          <thead>
            <tr>
              <th style="width:50px;" class="text-center">#</th>
              <th>Giocatore</th>
              ${this.currentTeamId === 0 ? `<th>Fantasquadra</th>` : ''}
              <th class="text-center">Stagione</th>
              <th>Serie A</th>
              <th class="text-center" style="width:60px;">Ruolo</th>
              <th class="text-center" style="min-width:90px;">Costo Asta</th>
              <th class="text-center">Pres</th>
              <th class="text-center">Gol</th>
              <th class="text-center">MV</th>
              <th class="text-center">FMV</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr>
                <td colspan="${this.currentTeamId === 0 ? 11 : 10}" class="text-center text-muted" style="padding:24px;">
                  Nessun calciatore trovato per i parametri selezionati.
                </td>
              </tr>
            ` : ''}
            ${records.map((r, idx) => `
              <tr>
                <td class="text-center font-bold">
                  <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">
                    ${idx + 1}
                  </span>
                </td>
                <td class="font-bold">${r.name}</td>
                ${this.currentTeamId === 0 ? `<td style="color:var(--text-secondary);font-size:0.82rem;">${r.teamName}</td>` : ''}
                <td class="text-center font-bold" style="font-size:0.8rem;color:var(--text-muted);">${r.season}</td>
                <td>
                  <span style="font-size:0.8rem;background:var(--bg-surface);padding:2px 6px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                    ${r.serieA}
                  </span>
                </td>
                <td class="text-center">
                  <span class="role-badge role-${r.role.toLowerCase()}">${r.role}</span>
                </td>
                <td class="text-center font-bold" style="color:var(--accent-gold);font-size:1.1rem;">
                  💰 ${r.cost}
                </td>
                <td class="text-center">${r.appearances}</td>
                <td class="text-center font-bold" style="${r.goals > 0 ? 'color:var(--accent-emerald);' : ''}">
                  ${r.goals}
                </td>
                <td class="text-center">${r.mv}</td>
                <td class="text-center font-bold" style="color:var(--accent-cyan);">${r.fmv}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
      <div class="topcosti-mobile-view">
        ${records.length === 0 ? `
          <div class="text-center text-muted" style="padding:24px;background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
            Nessun calciatore trovato per i parametri selezionati.
          </div>
        ` : ''}
        ${records.map((r, idx) => `
          <div class="topcosti-card-item">
            <!-- Header: Posizione, Ruolo, Nome e Costo d'Asta -->
            <div class="topcosti-card-header">
              <div class="topcosti-card-player">
                <span class="topcosti-card-rank">#${idx + 1}</span>
                <span class="role-badge role-${r.role.toLowerCase()}">${r.role}</span>
                <span class="topcosti-card-name">${r.name}</span>
              </div>
              <div class="topcosti-stat-pill" style="border-color:rgba(245,158,11,0.4);">
                <span class="topcosti-stat-label">Asta</span>
                <span class="topcosti-stat-val" style="color:var(--accent-gold);font-size:0.95rem;">💰 ${r.cost}</span>
              </div>
            </div>

            <!-- Subinfo: Fantasquadra (se Totale Lega), Stagione e Club Serie A -->
            <div class="topcosti-card-subinfo">
              ${this.currentTeamId === 0 ? `
                <span style="font-weight:700;color:var(--text-primary);">${r.teamName}</span>
                <span>&bull;</span>
              ` : ''}
              <span style="font-weight:600;color:var(--text-muted);">${r.season}</span>
              <span>&bull;</span>
              <span style="background:var(--bg-surface);padding:1px 6px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.72rem;font-weight:600;">
                ${r.serieA}
              </span>
            </div>

            <!-- Stats Bar: Presenze, Gol, MV, FMV -->
            <div class="topcosti-card-stats">
              <div class="topcosti-stat-pill">
                <span class="topcosti-stat-label">Pres</span>
                <span class="topcosti-stat-val">${r.appearances}</span>
              </div>
              <div class="topcosti-stat-pill">
                <span class="topcosti-stat-label">Gol</span>
                <span class="topcosti-stat-val" style="${r.goals > 0 ? 'color:var(--accent-emerald);' : ''}">${r.goals}</span>
              </div>
              <div class="topcosti-stat-pill">
                <span class="topcosti-stat-label">MV</span>
                <span class="topcosti-stat-val">${r.mv}</span>
              </div>
              <div class="topcosti-stat-pill" style="border-color:rgba(6,182,212,0.3);">
                <span class="topcosti-stat-label">FMV</span>
                <span class="topcosti-stat-val" style="color:var(--accent-cyan);">${r.fmv}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Event: Team select
    subContainer.querySelector('#costiTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.renderTopCosti(subContainer);
    });

    // Event: Role tabs
    subContainer.querySelectorAll('#costiRoleTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentRole = btn.getAttribute('data-role');
        this.renderTopCosti(subContainer);
      });
    });
  }
};

if (typeof window !== 'undefined') {
  window.topCostiView = topCostiView;
}
