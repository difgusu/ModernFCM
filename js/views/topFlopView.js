/**
 * TOP 11 & FLOP 11 STORICI VIEW
 * Formazioni storiche ideali e peggiori per ciascuna fantasquadra con moduli selezionabili
 * ModernFCM
 */

const topFlopView = {
  currentTeamId: null, // Dinamico: prima squadra attiva per idAttuale (o da query param)
  modTop11: "0",   // "0" = 4-4-2
  modFlop11: "0",  // "0" = 4-4-2
  activeMobileTab: "top", // "top" o "flop"

  getModuliList() {
    if (typeof aModuli !== 'undefined' && Array.isArray(aModuli) && aModuli.length > 1) {
      const list = [];
      for (let i = 1; i < aModuli.length; i++) {
        if (aModuli[i]) {
          list.push({ id: String(aModuli[i].IDModulo), label: aModuli[i].Descrizione });
        }
      }
      if (list.length > 0) return list;
    }
    return [
      { id: "0", label: "4-4-2" },
      { id: "1", label: "3-4-3" },
      { id: "2", label: "3-5-2" },
      { id: "3", label: "4-3-3" },
      { id: "4", label: "4-5-1" },
      { id: "5", label: "5-4-1" },
      { id: "6", label: "5-3-2" },
      { id: "7", label: "6-3-1" }
    ];
  },

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
      if (params.has('modTop11')) this.modTop11 = params.get('modTop11');
      if (params.has('modFlop11')) this.modFlop11 = params.get('modFlop11');
      if (params.has('tab')) this.activeMobileTab = params.get('tab') === 'flop' ? 'flop' : 'top';
    } else {
      this.currentTeamId = null;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              Top &amp; Flop Storico
            </div>
            <div class="card-subtitle">Le migliori e le peggiori formazioni della storia per ciascuna fantasquadra</div>
          </div>
        </div>

        <div id="topFlopContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento formazioni storiche...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#topFlopContent');
    await this.renderTopFlop(subContainer);
  },

  async renderTopFlop(subContainer) {
    const almData = await fcmDataLoader.loadAlmanacco();
    if (!almData || !almData.teams || almData.teams.length === 0) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati formazioni storiche non disponibili.</div>`;
      return;
    }

    const currentTeam = fcmDataLoader.getDefaultHistoricalTeam(almData.teams, this.currentTeamId);
    if (!currentTeam) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati formazioni storiche non disponibili.</div>`;
      return;
    }
    this.currentTeamId = currentTeam.id;

    const moduli = this.getModuliList();

    subContainer.innerHTML = `
      <!-- Toolbar Filtri Formazione -->
      <div class="topflop-toolbar">
        <div class="topflop-team-select-group">
          <label for="topFlopTeamSelect">
            Fantasquadra:
          </label>
          <select id="topFlopTeamSelect" class="form-select topflop-team-select">
            ${almData.teams.map(t => `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Mobile View Switcher (Top 11 vs Flop 11) -->
        <div class="pill-tabs topflop-mobile-tabs mobile-only" id="topFlopMobileTabs">
          <button class="pill-btn ${this.activeMobileTab === 'top' ? 'active' : ''}" data-tab="top">
            ⭐ Top 11
          </button>
          <button class="pill-btn ${this.activeMobileTab === 'flop' ? 'active' : ''}" data-tab="flop">
            🌧️ Flop 11
          </button>
        </div>
      </div>

      <!-- 2 Columns Grid: Top 11 (left) & Flop 11 (right) -->
      <div class="topflop-grid">
        <!-- Left: TOP 11 -->
        <div id="top11Box" class="card topflop-card topflop-card-top ${this.activeMobileTab === 'flop' ? 'mobile-hidden' : ''}">
          ${this.renderFormationContent(almData.getTop11(this.currentTeamId), this.modTop11, true, moduli)}
        </div>

        <!-- Right: FLOP 11 -->
        <div id="flop11Box" class="card topflop-card topflop-card-flop ${this.activeMobileTab === 'top' ? 'mobile-hidden' : ''}">
          ${this.renderFormationContent(almData.getFlop11(this.currentTeamId), this.modFlop11, false, moduli)}
        </div>
      </div>
    `;

    // Event listeners: Fantasquadra change
    subContainer.querySelector('#topFlopTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.updateHistoryUrl();
      this.renderTopFlop(subContainer);
    });

    // Event listeners: Mobile tabs switch
    const tabBtns = subContainer.querySelectorAll('#topFlopMobileTabs button');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeMobileTab = btn.getAttribute('data-tab');
        this.updateHistoryUrl();

        const topBox = subContainer.querySelector('#top11Box');
        const flopBox = subContainer.querySelector('#flop11Box');
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

    // Event listeners: Modulo Top 11 change
    const selTop11 = subContainer.querySelector('#selModTop11');
    if (selTop11) {
      selTop11.addEventListener('change', (e) => {
        this.modTop11 = e.target.value;
        this.updateHistoryUrl();
        const topBox = subContainer.querySelector('#top11Box');
        if (topBox) {
          topBox.innerHTML = this.renderFormationContent(almData.getTop11(this.currentTeamId), this.modTop11, true, moduli);
          this.attachTopModListener(subContainer, almData, moduli);
        }
      });
    }

    // Event listeners: Modulo Flop 11 change
    const selFlop11 = subContainer.querySelector('#selModFlop11');
    if (selFlop11) {
      selFlop11.addEventListener('change', (e) => {
        this.modFlop11 = e.target.value;
        this.updateHistoryUrl();
        const flopBox = subContainer.querySelector('#flop11Box');
        if (flopBox) {
          flopBox.innerHTML = this.renderFormationContent(almData.getFlop11(this.currentTeamId), this.modFlop11, false, moduli);
          this.attachFlopModListener(subContainer, almData, moduli);
        }
      });
    }
  },

  attachTopModListener(subContainer, almData, moduli) {
    const sel = subContainer.querySelector('#selModTop11');
    if (sel) {
      sel.addEventListener('change', (e) => {
        this.modTop11 = e.target.value;
        this.updateHistoryUrl();
        const topBox = subContainer.querySelector('#top11Box');
        if (topBox) {
          topBox.innerHTML = this.renderFormationContent(almData.getTop11(this.currentTeamId), this.modTop11, true, moduli);
          this.attachTopModListener(subContainer, almData, moduli);
        }
      });
    }
  },

  attachFlopModListener(subContainer, almData, moduli) {
    const sel = subContainer.querySelector('#selModFlop11');
    if (sel) {
      sel.addEventListener('change', (e) => {
        this.modFlop11 = e.target.value;
        this.updateHistoryUrl();
        const flopBox = subContainer.querySelector('#flop11Box');
        if (flopBox) {
          flopBox.innerHTML = this.renderFormationContent(almData.getFlop11(this.currentTeamId), this.modFlop11, false, moduli);
          this.attachFlopModListener(subContainer, almData, moduli);
        }
      });
    }
  },

  updateHistoryUrl() {
    try {
      window.history.replaceState(
        null,
        '',
        `#topflop?fsq=${this.currentTeamId}&modTop11=${this.modTop11}&modFlop11=${this.modFlop11}&tab=${this.activeMobileTab}`
      );
    } catch (err) {
      // Fallback
    }
  },

  getModuleLimits(mod) {
    let maxD = 4, maxC = 4, maxA = 2;
    if (mod === "1" || mod === "2") maxD = 3;
    else if (mod === "5" || mod === "6") maxD = 5;
    else if (mod === "7") maxD = 6;

    if (mod === "3" || mod === "6" || mod === "7") maxC = 3;
    else if (mod === "2" || mod === "4") maxC = 5;

    if (mod === "4" || mod === "5" || mod === "7") maxA = 1;
    else if (mod === "1" || mod === "3") maxA = 3;

    return { maxP: 1, maxD, maxC, maxA };
  },

  renderFormationContent(players, mod, isTop, moduliList) {
    const limits = this.getModuleLimits(mod);
    const selectId = isTop ? 'selModTop11' : 'selModFlop11';
    const titleColor = isTop ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    const titleText = isTop ? '⭐ TOP 11 STORICA' : '🌧️ FLOP 11 STORICA';
    const fmvColor = isTop ? 'var(--accent-emerald)' : 'var(--accent-rose)';

    let cP = 0, cD = 0, cC = 0, cA = 0;
    const starters = [];
    const benchPool = [];

    // Filter starters
    for (const p of players) {
      const r = (p.role || '').charAt(0).toUpperCase();
      if (r === 'P' && cP < limits.maxP) {
        starters.push(p);
        cP++;
      } else if (r === 'D' && cD < limits.maxD) {
        starters.push(p);
        cD++;
      } else if (r === 'C' && cC < limits.maxC) {
        starters.push(p);
        cC++;
      } else if (r === 'A' && cA < limits.maxA) {
        starters.push(p);
        cA++;
      } else {
        benchPool.push(p);
      }
    }

    // Sort starters by role P -> D -> C -> A
    starters.sort((a, b) => {
      const roleOrder = { P: 1, D: 2, C: 3, A: 4 };
      const rA = roleOrder[(a.role || '').charAt(0).toUpperCase()] || 99;
      const rB = roleOrder[(b.role || '').charAt(0).toUpperCase()] || 99;
      return rA - rB;
    });

    // Pick bench: 1 P, 2 D, 2 C, 2 A
    let bP = 0, bD = 0, bC = 0, bA = 0;
    const bench = [];
    for (const p of benchPool) {
      const r = (p.role || '').charAt(0).toUpperCase();
      if (r === 'P' && bP < 1) { bench.push(p); bP++; }
      else if (r === 'D' && bD < 2) { bench.push(p); bD++; }
      else if (r === 'C' && bC < 2) { bench.push(p); bC++; }
      else if (r === 'A' && bA < 2) { bench.push(p); bA++; }
    }

    bench.sort((a, b) => {
      const roleOrder = { P: 1, D: 2, C: 3, A: 4 };
      const rA = roleOrder[(a.role || '').charAt(0).toUpperCase()] || 99;
      const rB = roleOrder[(b.role || '').charAt(0).toUpperCase()] || 99;
      return rA - rB;
    });

    return `
      <div class="topflop-card-header">
        <div class="topflop-card-title-group">
          <strong class="topflop-card-title" style="color:${titleColor};">${titleText}</strong>
          <span class="badge topflop-badge">11 Tit. + 7 Pan.</span>
        </div>

        <div class="topflop-mod-group">
          <label for="${selectId}">Modulo:</label>
          <select id="${selectId}" class="form-select form-select-sm topflop-mod-select">
            ${moduliList.map(m => `
              <option value="${m.id}" ${m.id === mod ? 'selected' : ''}>${m.label}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="table-responsive" style="margin:0;overflow-x:auto;">
        <table class="modern-table topflop-table">
          <thead>
            <tr>
              <th class="col-role">R</th>
              <th class="col-player">Giocatore</th>
              <th class="col-stat col-stat-fm">FM</th>
              <th class="col-stat">MV</th>
              <th class="col-stat col-stat-pres">Pres</th>
              <th class="col-stat col-stat-gol">Gol</th>
            </tr>
          </thead>
          <tbody>
            ${starters.map(p => {
      const r = (p.role || '').charAt(0).toUpperCase();
      const roleBadgeClass = `role-${r.toLowerCase()}`;
      return `
                <tr>
                  <td class="col-role"><span class="role-badge ${roleBadgeClass}">${r}</span></td>
                  <td class="col-player font-bold" style="color:var(--text-primary);" title="${p.player}">${p.player}</td>
                  <td class="col-stat col-stat-fm font-bold" style="color:${fmvColor};">${p.fmv}</td>
                  <td class="col-stat">${p.mv}</td>
                  <td class="col-stat col-stat-pres font-bold">${p.appearances}</td>
                  <td class="col-stat col-stat-gol font-bold" style="${p.goals > 0 ? 'color:var(--accent-emerald);' : ''}">${p.goals}</td>
                </tr>
              `;
    }).join('')}

            <tr style="background:var(--bg-surface);border-top:2px solid var(--border-subtle);border-bottom:2px solid var(--border-subtle);">
              <td colspan="6" style="padding:6px 10px;font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);">
                🪑 Panchina
              </td>
            </tr>

            ${bench.map(p => {
      const r = (p.role || '').charAt(0).toUpperCase();
      const roleBadgeClass = `role-${r.toLowerCase()}`;
      return `
                <tr style="opacity:0.9;">
                  <td class="col-role"><span class="role-badge ${roleBadgeClass}">${r}</span></td>
                  <td class="col-player" style="color:var(--text-secondary);" title="${p.player}">${p.player}</td>
                  <td class="col-stat col-stat-fm font-bold" style="color:${fmvColor};">${p.fmv}</td>
                  <td class="col-stat">${p.mv}</td>
                  <td class="col-stat col-stat-pres font-bold">${p.appearances}</td>
                  <td class="col-stat col-stat-gol font-bold" style="${p.goals > 0 ? 'color:var(--accent-emerald);' : ''}">${p.goals}</td>
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
  window.topFlopView = topFlopView;
}
