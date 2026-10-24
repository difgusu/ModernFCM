/**
 * FANTA RATING FANTASQUADRE VIEW
 * Indice di rendimento complessivo, Top e Flop Rating per fantasquadra
 * ModernFCM
 */

const ratingView = {
  currentTeamId: null, // Dinamico: prima squadra attiva per idAttuale (o da query param)
  activeMobileTab: 'top', // 'top' o 'flop'

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq')) {
        const fId = parseInt(params.get('fsq') || params.get('Fsq'), 10);
        if (!isNaN(fId)) this.currentTeamId = fId;
      } else {
        this.currentTeamId = null;
      }
      if (params.has('tab')) {
        this.activeMobileTab = params.get('tab') === 'flop' ? 'flop' : 'top';
      }
    } else {
      this.currentTeamId = null;
    }

    container.innerHTML = `
      <style>
        .rating-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 24px;
          background: var(--bg-surface-elevated);
          padding: 14px 18px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }
        .rating-team-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .rating-team-select {
          min-width: 240px;
          font-weight: 700;
        }
        .rating-mobile-tabs {
          display: none;
        }
        .rating-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          align-items: start;
        }
        .rating-card {
          margin: 0;
          padding: 18px;
          border-radius: var(--radius-md);
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          box-shadow: var(--shadow-sm);
        }
        .rating-card-top {
          border-top: 4px solid var(--accent-emerald) !important;
        }
        .rating-card-flop {
          border-top: 4px solid var(--accent-rose) !important;
        }
        .rating-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .rating-table th,
        .rating-table td {
          padding: 8px 6px;
          vertical-align: middle;
        }
        .rating-table .col-role {
          width: 32px;
          text-align: center;
          padding: 8px 2px;
        }
        .rating-table .col-player {
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rating-table .col-stat {
          width: 44px;
          text-align: center;
          white-space: nowrap;
        }
        .rating-table .col-rating {
          width: 54px;
          text-align: center;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .rating-toolbar {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
            gap: 12px;
            margin-bottom: 16px;
          }
          .rating-team-group {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }
          .rating-team-select {
            width: 100% !important;
            min-width: 0 !important;
          }
          .rating-mobile-tabs {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px !important;
            background: var(--bg-surface);
            padding: 4px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
          }
          .rating-mobile-tabs .pill-btn {
            width: 100% !important;
            text-align: center !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 0.8rem !important;
            font-weight: 700 !important;
          }
          .rating-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .rating-card {
            padding: 12px !important;
          }
          .rating-card.mobile-hidden {
            display: none !important;
          }
          .rating-table th,
          .rating-table td {
            padding: 6px 3px !important;
            font-size: 0.74rem !important;
          }
          .rating-table .col-role {
            width: 26px !important;
            padding: 6px 1px !important;
          }
          .rating-table .col-stat {
            width: 36px !important;
          }
          .rating-table .col-rating {
            width: 50px !important;
          }
        }
      </style>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 18a8 8 0 1 1 16 0"></path>
                <path d="M12 18l4-6"></path>
                <circle cx="12" cy="18" r="1"></circle>
                <path d="M6 18h1"></path>
                <path d="M17 18h1"></path>
                <path d="m18.5 4.5.5 1 1.1.2-.8.8.2 1.1-1-.5-1 .5.2-1.1-.8-.8 1.1-.2z"></path>
              </svg>
              Fanta Rating
            </div>
            <div class="card-subtitle">Indice di rendimento storico, regolarità ed efficienza di acquisto per ciascuna fantasquadra</div>
          </div>
        </div>

        <div id="ratingContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento Fanta Rating...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#ratingContent');
    await this.renderRating(subContainer);
  },

  updateHistoryUrl() {
    try {
      window.history.replaceState(
        null,
        '',
        `#rating?fsq=${this.currentTeamId}&tab=${this.activeMobileTab}`
      );
    } catch (err) {
      // Fallback
    }
  },

  async renderRating(subContainer) {
    const almData = await fcmDataLoader.loadAlmanacco();
    if (!almData || !almData.teams || almData.teams.length === 0) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Fanta Rating non disponibili.</div>`;
      return;
    }

    const currentTeam = fcmDataLoader.getDefaultHistoricalTeam(almData.teams, this.currentTeamId);
    if (!currentTeam) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Fanta Rating non disponibili.</div>`;
      return;
    }
    this.currentTeamId = currentTeam.id;

    const topList = almData.getTopRating(this.currentTeamId);
    const flopList = almData.getFlopRating(this.currentTeamId);

    subContainer.innerHTML = `
      <!-- Toolbar Fantasquadra + Mobile Tabs -->
      <div class="rating-toolbar">
        <div class="rating-team-group">
          <label for="ratingTeamSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;letter-spacing:0.04em;">
            Fantasquadra:
          </label>
          <select id="ratingTeamSelect" class="form-select rating-team-select">
            ${almData.teams.map(t => `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Mobile View Switcher (Top Rating vs Flop Rating) -->
        <div class="pill-tabs rating-mobile-tabs" id="ratingMobileTabs">
          <button class="pill-btn ${this.activeMobileTab === 'top' ? 'active' : ''}" data-tab="top">
            ⭐ Top Rating
          </button>
          <button class="pill-btn ${this.activeMobileTab === 'flop' ? 'active' : ''}" data-tab="flop">
            🌧️ Flop Rating
          </button>
        </div>

        <div style="font-size:0.8rem;color:var(--text-muted);">
          Indice calcolato su presenze, fantamedia e costo storico
        </div>
      </div>

      <!-- 2 Columns Grid: Top Rating (left) & Flop Rating (right) -->
      <div class="rating-grid">
        <!-- Left: TOP RATING -->
        <div id="topRatingBox" class="card rating-card rating-card-top ${this.activeMobileTab === 'flop' ? 'mobile-hidden' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);">
            <strong style="color:var(--accent-emerald);font-size:1.05rem;">⭐ TOP RATING</strong>
            <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:700;font-size:0.75rem;">I Migliori Affari</span>
          </div>

          ${this.renderRatingTable(topList, true)}
        </div>

        <!-- Right: FLOP RATING -->
        <div id="flopRatingBox" class="card rating-card rating-card-flop ${this.activeMobileTab === 'top' ? 'mobile-hidden' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);">
            <strong style="color:var(--accent-rose);font-size:1.05rem;">🌧️ FLOP RATING</strong>
            <span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;font-weight:700;font-size:0.75rem;">I Colpi Meno Redditizi</span>
          </div>

          ${this.renderRatingTable(flopList, false)}
        </div>
      </div>
    `;

    // Event listener: Squadra change
    subContainer.querySelector('#ratingTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.updateHistoryUrl();
      this.renderRating(subContainer);
    });

    // Event listeners: Mobile tabs switch
    const tabBtns = subContainer.querySelectorAll('#ratingMobileTabs button');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeMobileTab = btn.getAttribute('data-tab');
        this.updateHistoryUrl();

        const topBox = subContainer.querySelector('#topRatingBox');
        const flopBox = subContainer.querySelector('#flopRatingBox');
        if (topBox && flopBox) {
          if (this.activeMobileTab === 'top') {
            topBox.classList.remove('mobile-hidden');
            flopBox.classList.add('mobile-hidden');
          } else {
            topBox.classList.add('mobile-hidden');
            flopBox.classList.remove('mobile-hidden');
          }
        }
      });
    });
  },

  renderRatingTable(list, isTop) {
    if (!list || list.length === 0) {
      return `
        <div class="text-center" style="padding:24px;color:var(--text-muted);font-size:0.85rem;">
          Nessun record di rating disponibile per questa fantasquadra.
        </div>
      `;
    }

    const ratingColor = isTop ? 'var(--accent-emerald)' : 'var(--accent-rose)';

    return `
      <div class="table-responsive" style="margin:0;">
        <table class="modern-table rating-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th class="col-role">R</th>
              <th class="col-player">Giocatore</th>
              <th class="col-rating">Rating</th>
              <th class="col-stat">FM</th>
              <th class="col-stat">Costo</th>
              <th class="col-stat">Pres</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => {
      const roleBadgeClass = `role-${p.roleShort.toLowerCase()}`;
      return `
                <tr>
                  <td class="col-role"><span class="role-badge ${roleBadgeClass}">${p.roleShort}</span></td>
                  <td class="col-player font-bold" style="color:var(--text-primary);" title="${p.player}">${p.player}</td>
                  <td class="col-rating font-bold" style="color:${ratingColor};">${p.rating.toFixed(2)}</td>
                  <td class="col-stat">${p.fmv > 0 ? p.fmv.toFixed(2) : '-'}</td>
                  <td class="col-stat font-bold" style="color:var(--accent-gold);">${p.costo}</td>
                  <td class="col-stat font-bold">${p.appearances}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.ratingView = ratingView;
}
