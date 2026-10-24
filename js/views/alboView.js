/**
 * ALBO D'ORO & STORIA VIEW
 * Historical champions, palmares, ranking storico, and almanacco
 * ModernFCM
 */

const alboView = {
  activeSubtab: 'palmares', // 'palmares', 'piazzamenti', 'storico', 'dettaglio'
  currentCompId: null,      // Dynamically selected from arrAdOCompetizioni
  piazzamentiCompId: 0,    // 0 = Tutte le competizioni, o IDc
  storicoCompId: null,     // Dynamically selected from arrAdOCompetizioni
  storicoEra: null,        // Dynamically generated based on available years in arrAdOPosizioni
  dettaglioYear: null,     // Dynamically selected: latest year in arrAdOPosizioni
  dettaglioCompId: 0,      // 0 = Tutte le competizioni, o IDc
  rankingFilterCurrentOnly: false,
  rankingFilterMinPoints: false,

  /**
   * Helper: Get competitions and main competition from albo data
   */
  getLeagueCompetitions(albo) {
    const comps = (albo && albo.comps) ? albo.comps : [];
    const mainComp = comps.find(c => c.idAttuale === 1) || comps[0] || null;
    return { comps, mainComp };
  },

  /**
   * Helper: Safely resolve team name from albo.teams or fallback
   */
  getTeamName(albo, idSquadra, fallbackPresidente) {
    if (albo && albo.teams) {
      const t = albo.teams.find(team => team.IDf === idSquadra);
      if (t && t.nome) return t.nome;
    }
    if (fallbackPresidente) return `Squadra (${fallbackPresidente})`;
    return `Squadra #${idSquadra}`;
  },

  /**
   * Helper: Safely resolve team logo id
   */
  getTeamLogoId(albo, idSquadra) {
    if (albo && albo.teams) {
      const t = albo.teams.find(team => team.IDf === idSquadra);
      if (t) return t.idAttuale || t.IDf;
    }
    return idSquadra;
  },

  /**
   * Helper: Determine trophy icon dynamically from arrPalmares in persjs/fcmConfrontiDati.js
   */
  getCompTrophyIcon(comp, isSmall = false) {
    if (typeof arrPalmares !== 'undefined') {
      const id = typeof comp === 'object' && comp !== null
        ? (comp.IDc || comp.ID || comp.idCompetizione || comp.id)
        : comp;

      for (let i = 1; i < arrPalmares.length; i++) {
        const p = arrPalmares[i];
        if (p && p.Competizione == id) {
          return isSmall ? `img/small-${p.Icona}` : `img/${p.Icona}`;
        }
      }

      // If not matched by ID, try matching by name/label
      const name = typeof comp === 'object' && comp !== null ? (comp.nome || comp.Nome || '') : (typeof comp === 'string' ? comp : '');
      if (name) {
        const norm = name.toLowerCase().trim();
        for (let i = 1; i < arrPalmares.length; i++) {
          const p = arrPalmares[i];
          if (p && p.Label && (p.Label.toLowerCase() === norm || norm.includes(p.Label.toLowerCase()) || p.Label.toLowerCase().includes(norm))) {
            return isSmall ? `img/small-${p.Icona}` : `img/${p.Icona}`;
          }
        }
      }

      if (arrPalmares.length > 1 && arrPalmares[1] && arrPalmares[1].Icona) {
        return isSmall ? `img/small-${arrPalmares[1].Icona}` : `img/${arrPalmares[1].Icona}`;
      }
    }
    return isSmall ? 'img/small-ico-coppa.gif' : 'img/ico-coppa.gif';
  },

  async render(container) {
    if (typeof window.ZP === 'undefined') {
      window.ZP = function (Competizione, Label, Icona) {
        this.Competizione = Competizione;
        this.Label = Label;
        this.Icona = Icona;
      };
    }
    if (typeof arrPalmares === 'undefined') {
      try {
        await fcmDataLoader.loadScript('persjs/fcmConfrontiDati.js');
      } catch (e) {
        console.warn('Could not load persjs/fcmConfrontiDati.js', e);
      }
    }

    if (this.activeSubtab === 'ranking' || this.activeSubtab === 'almanacco') this.activeSubtab = 'palmares';

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <circle cx="12" cy="8" r="7"></circle>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
              </svg>
              Albo d'Oro &amp; Palmares
            </div>
            <div class="card-subtitle">Palmares, Piazzamenti, Storico Completo e Dettaglio Annuale</div>
          </div>
        </div>

        <!-- Subtab Switcher -->
        <div class="pill-tabs albo-subtabs-wrap" id="alboSubtabs">
          <button class="pill-btn ${this.activeSubtab === 'palmares' ? 'active' : ''}" data-subtab="palmares">
            🏆 <span>Palmares</span>
          </button>
          <button class="pill-btn ${this.activeSubtab === 'piazzamenti' ? 'active' : ''}" data-subtab="piazzamenti">
            🥈 <span>Piazzamenti</span>
          </button>
          <button class="pill-btn ${this.activeSubtab === 'storico' ? 'active' : ''}" data-subtab="storico">
            📊 <span>Storico</span>
          </button>
          <button class="pill-btn ${this.activeSubtab === 'dettaglio' ? 'active' : ''}" data-subtab="dettaglio">
            📅 <span class="desktop-only">Dettaglio Annuale</span><span class="mobile-only">Dettaglio</span>
          </button>
        </div>

        <!-- Subtab Container -->
        <div id="alboSubtabContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento dati storici...
          </div>
        </div>
      </div>
    `;

    // Attach subtab click events
    const subtabBtns = container.querySelectorAll('#alboSubtabs button');
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSubtab = btn.getAttribute('data-subtab');
        this.render(container);
      });
    });

    const subContainer = container.querySelector('#alboSubtabContent');

    if (this.activeSubtab === 'palmares') {
      this.renderPalmares(subContainer);
    } else if (this.activeSubtab === 'piazzamenti') {
      this.renderPiazzamenti(subContainer);
    } else if (this.activeSubtab === 'storico') {
      this.renderStorico(subContainer);
    } else if (this.activeSubtab === 'dettaglio') {
      this.renderDettaglio(subContainer);
    }
  },

  /**
   * 1. Palmares & Vittorie (GeneraVittorie & Podi)
   */
  renderPalmares(subContainer) {
    const albo = fcmDataLoader.getAlboDOro();
    const { comps, mainComp } = this.getLeagueCompetitions(albo);

    if (comps.length === 0) {
      subContainer.innerHTML = `
        <div class="card text-center" style="padding:40px;color:var(--text-muted);">
          Nessun dato di albo d'oro disponibile.
        </div>
      `;
      return;
    }

    if (!this.currentCompId || !comps.some(c => c.IDc === this.currentCompId)) {
      this.currentCompId = mainComp ? mainComp.IDc : comps[0].IDc;
    }
    const currentComp = comps.find(c => c.IDc === this.currentCompId) || comps[0];

    // Total titles per team across all competitions (GeneraVittorie)
    const teamTitlesMap = new Map();
    albo.teams.forEach(t => {
      teamTitlesMap.set(t.IDf, {
        id: t.IDf,
        idAttuale: t.idAttuale,
        name: t.nome,
        isCurrent: t.idAttuale > 0,
        byComp: {},
        total: 0
      });
    });

    albo.positions.filter(p => p.posizione === 1).forEach(p => {
      let tData = teamTitlesMap.get(p.idSquadra);
      if (!tData) {
        const teamObj = albo.teams.find(t => t.IDf === p.idSquadra);
        const name = teamObj ? teamObj.nome : (p.presidente ? `Squadra (${p.presidente})` : `Squadra #${p.idSquadra}`);
        tData = {
          id: p.idSquadra,
          idAttuale: teamObj ? teamObj.idAttuale : 0,
          name: name,
          isCurrent: teamObj ? teamObj.idAttuale > 0 : false,
          byComp: {},
          total: 0
        };
        teamTitlesMap.set(p.idSquadra, tData);
      }
      tData.byComp[p.idCompetizione] = (tData.byComp[p.idCompetizione] || 0) + 1;
      tData.total += 1;
    });

    const allTeamsTitles = Array.from(teamTitlesMap.values())
      .filter(t => t.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    // Podiums for selected competition
    const compPositions = albo.positions.filter(p => p.idCompetizione === this.currentCompId);

    const seasonsMap = new Map();
    compPositions.forEach(p => {
      const key = `${p.stagione || p.anno}-${p.anno}`;
      if (!seasonsMap.has(key)) {
        seasonsMap.set(key, {
          season: p.stagione,
          year: p.anno,
          podium: []
        });
      }
      seasonsMap.get(key).podium.push(p);
    });

    const seasons = Array.from(seasonsMap.values()).sort((a, b) => b.year - a.year);
    const compTrophy = this.getCompTrophyIcon(currentComp);

    let html = `
      <!-- Overall Titles Table (GeneraVittorie) -->
      <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px;margin-bottom:24px;">
        <div style="font-size:0.95rem;font-weight:800;color:var(--accent-gold);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          🏆 Albo d'Oro Generale - Titoli Vinti per Squadra
        </div>

        <!-- Desktop View (Table) -->
        <div class="table-responsive albo-desktop-only">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="text-align:left;min-width:180px;">Squadra</th>
                ${comps.map(c => `
                  <th class="text-center" style="min-width:110px;">
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:4px;">
                      <img src="${this.getCompTrophyIcon(c, true)}" style="height:15px;width:auto;vertical-align:middle;" onerror="this.style.display='none';" alt="" />
                      <span>${c.nome}</span>
                    </div>
                  </th>
                `).join('')}
                <th class="text-center" style="min-width:80px;background:rgba(245,158,11,0.15);color:var(--accent-gold);">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${allTeamsTitles.map(t => `
                <tr>
                  <td style="text-align:left;font-weight:700;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:24px;height:24px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                      <div>
                        <span style="color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${t.isCurrent ? 'normal' : 'italic'};">
                          ${t.name}
                        </span>
                        ${!t.isCurrent ? '<span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px;">(storica)</span>' : ''}
                      </div>
                    </div>
                  </td>
                  ${comps.map(c => {
      const count = t.byComp[c.IDc] || 0;
      return `<td class="text-center font-bold" style="${count > 0 ? 'color:var(--accent-gold);' : 'color:var(--text-muted);'}">${count > 0 ? count : '-'}</td>`;
    }).join('')}
                  <td class="text-center font-bold" style="background:rgba(245,158,11,0.1);color:var(--accent-gold);font-size:1.05rem;">
                    ${t.total}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View (Cards List - Zero Horizontal Scroll) -->
        <div class="albo-mobile-only">
          <div class="albo-palmares-mobile-list">
            ${allTeamsTitles.map(t => `
              <div class="albo-palmares-card">
                <div class="albo-palmares-team-row">
                  <div class="albo-palmares-team-info">
                    <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" class="albo-palmares-team-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                    <span class="albo-palmares-team-name">${t.name}</span>
                    ${!t.isCurrent ? '<span class="albo-team-historic-tag">(storica)</span>' : ''}
                  </div>
                  <div class="albo-palmares-total-badge">
                    <span class="albo-badge-trophy">🏆</span>
                    <span class="albo-badge-num">${t.total}</span>
                    <span class="albo-badge-lbl">${t.total === 1 ? 'titolo' : 'titoli'}</span>
                  </div>
                </div>
                <div class="albo-palmares-pills">
                  ${comps.map(c => {
      const count = t.byComp[c.IDc] || 0;
      if (count === 0) return '';
      return `
                      <span class="albo-trophy-pill">
                        <img src="${this.getCompTrophyIcon(c, true)}" style="height:14px;width:auto;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none';" alt="" />
                        <span class="pill-cname">${c.nome}</span>
                        <strong class="pill-ccount">${count}</strong>
                      </span>
                    `;
    }).filter(Boolean).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Competition Selector Tabs -->
      <div style="margin-bottom:14px;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
          Seleziona Competizione per i Podi Annuali:
        </div>
        <div class="pill-tabs albo-comp-tabs" id="alboCompTabs">
          ${comps.map(c => `
            <button class="pill-btn ${c.IDc === this.currentCompId ? 'active' : ''}" data-comp-id="${c.IDc}">
              <img src="${this.getCompTrophyIcon(c, true)}" style="height:15px;width:auto;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none';" alt="" />
              ${c.nome}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Seasons Roll of Honor -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${seasons.length === 0 ? `
          <div class="card text-center" style="padding:24px;color:var(--text-muted);">
            Nessun podio registrato per ${currentComp.nome}.
          </div>
        ` : seasons.map(s => {
      const winner = s.podium.find(p => p.posizione === 1);
      const second = s.podium.find(p => p.posizione === 2);
      const third = s.podium.find(p => p.posizione === 3);

      const winnerName = winner ? this.getTeamName(albo, winner.idSquadra, winner.presidente) : 'Squadra';
      const secondName = second ? this.getTeamName(albo, second.idSquadra, second.presidente) : 'Squadra';
      const thirdName = third ? this.getTeamName(albo, third.idSquadra, third.presidente) : 'Squadra';

      const winnerLogoId = winner ? this.getTeamLogoId(albo, winner.idSquadra) : 0;
      const secondLogoId = second ? this.getTeamLogoId(albo, second.idSquadra) : 0;
      const thirdLogoId = third ? this.getTeamLogoId(albo, third.idSquadra) : 0;

      const edTitle = s.season ? `${s.season}ª Edizione ` : '';

      return `
            <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
                <div>
                  <span style="font-size:1.05rem;font-weight:800;color:var(--text-primary);">${edTitle}(${s.year}/${parseInt(s.year, 10) + 1})</span>
                </div>
                <span class="badge badge-primary">${currentComp.nome}</span>
              </div>

              <!-- Winner Spotlight -->
              ${winner ? `
                <div style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(217,119,6,0.05));border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:12px;margin-bottom:10px;">
                  <img src="${compTrophy}" style="height:38px;width:38px;object-fit:contain;flex-shrink:0;" alt="Vincitore" onerror="this.src='img/ico-coppa.gif'" />
                  <div style="min-width:0;flex:1;">
                    <div style="font-size:0.7rem;color:var(--accent-gold);text-transform:uppercase;font-weight:700;">1° Classificato • Vincitore</div>
                    <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      <img src="${fcmDataLoader.getTeamLogo(winnerLogoId)}" style="width:20px;height:20px;border-radius:3px;vertical-align:middle;margin-right:6px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                      ${winnerName}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);word-break:break-word;">
                      ${winner.presidente ? `Presidente: <b>${winner.presidente}</b> • ` : ''}Punti: <b>${winner.punti !== null && winner.punti !== undefined ? winner.punti : '-'}</b> ${winner.note ? `(${winner.note})` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- 2nd & 3rd Place -->
              <div class="albo-podium-runners">
                ${second ? `
                  <div style="background:var(--bg-main);padding:8px 12px;border-radius:var(--radius-sm);display:flex;align-items:center;gap:8px;">
                    <span class="table-pos table-pos-2">2°</span>
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                        <img src="${fcmDataLoader.getTeamLogo(secondLogoId)}" style="width:18px;height:18px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                        <span>${secondName}</span>
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-muted);">${second.presidente ? `${second.presidente} ` : ''}(${second.punti !== null && second.punti !== undefined ? second.punti : '-'} pt)</div>
                    </div>
                  </div>
                ` : ''}

                ${third ? `
                  <div style="background:var(--bg-main);padding:8px 12px;border-radius:var(--radius-sm);display:flex;align-items:center;gap:8px;">
                    <span class="table-pos table-pos-3">3°</span>
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                        <img src="${fcmDataLoader.getTeamLogo(thirdLogoId)}" style="width:18px;height:18px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                        <span>${thirdName}</span>
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-muted);">${third.presidente ? `${third.presidente} ` : ''}(${third.punti !== null && third.punti !== undefined ? third.punti : '-'} pt)</div>
                    </div>
                  </div>
                ` : ''}
              </div>

            </div>
          `;
    }).join('')}
      </div>
    `;

    subContainer.innerHTML = html;

    const compTabs = subContainer.querySelectorAll('#alboCompTabs button');
    compTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentCompId = parseInt(tab.getAttribute('data-comp-id'), 10);
        this.renderPalmares(subContainer);
      });
    });
  },

  /**
   * 2. Piazzamenti (GeneraPiazzamenti)
   */
  renderPiazzamenti(subContainer) {
    const albo = fcmDataLoader.getAlboDOro();
    const comps = albo.comps;
    const teams = albo.teams;
    const positions = albo.positions;

    if (comps.length === 0) {
      subContainer.innerHTML = `<div class="card text-center" style="padding:40px;color:var(--text-muted);">Nessun dato di piazzamenti disponibile.</div>`;
      return;
    }

    if (this.piazzamentiCompId !== 0 && !comps.some(c => c.IDc === this.piazzamentiCompId)) {
      this.piazzamentiCompId = 0;
    }

    const teamPiazzamenti = new Map();
    teams.forEach(t => {
      teamPiazzamenti.set(t.IDf, {
        id: t.IDf,
        idAttuale: t.idAttuale,
        name: t.nome,
        isCurrent: t.idAttuale > 0,
        data: new Map()
      });
    });

    positions.forEach(p => {
      let tData = teamPiazzamenti.get(p.idSquadra);
      if (!tData) {
        const teamObj = teams.find(t => t.IDf === p.idSquadra);
        const name = teamObj ? teamObj.nome : (p.presidente ? `Squadra (${p.presidente})` : `Squadra #${p.idSquadra}`);
        tData = {
          id: p.idSquadra,
          idAttuale: teamObj ? teamObj.idAttuale : 0,
          name: name,
          isCurrent: teamObj ? teamObj.idAttuale > 0 : false,
          data: new Map()
        };
        teamPiazzamenti.set(p.idSquadra, tData);
      }
      if (!tData.data.has(p.idCompetizione)) {
        tData.data.set(p.idCompetizione, {});
      }
      const cData = tData.data.get(p.idCompetizione);
      cData[p.posizione] = (cData[p.posizione] || 0) + 1;
    });

    const sortedTeams = Array.from(teamPiazzamenti.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Dynamic placement formatter based on actual positions recorded in data
    const formatPlacements = (compData) => {
      if (!compData) return [];
      const posKeys = Object.keys(compData).map(Number).filter(p => p > 0).sort((a, b) => a - b);
      return posKeys.map(pos => {
        const count = compData[pos];
        const badgeClass = pos === 1 ? 'color:var(--accent-gold);font-weight:800;' : pos === 2 ? 'color:#94a3b8;font-weight:700;' : pos === 3 ? 'color:#d97706;font-weight:700;' : 'color:var(--text-primary);';
        return `<span style="${badgeClass}">${pos}°</span>${count > 1 ? ` <small style="color:var(--text-muted);">[${count}]</small>` : ''}`;
      });
    };

    let html = `
      <div style="margin-bottom:16px;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">
          Riepilogo completo di tutti i piazzamenti conseguiti dalle fantasquadre nelle competizioni ufficiali di Lega.
        </p>
      </div>

      <!-- Desktop View (Full Matrix Table) -->
      <div class="table-responsive albo-desktop-only">
        <table class="modern-table">
          <thead>
            <tr>
              <th style="min-width:180px;text-align:left;">Squadra</th>
              ${comps.map(c => `
                <th class="text-center" style="min-width:140px;">
                  <div style="display:inline-flex;align-items:center;justify-content:center;gap:4px;">
                    <img src="${this.getCompTrophyIcon(c, true)}" style="height:15px;width:auto;vertical-align:middle;" onerror="this.style.display='none';" alt="" />
                    <span>${c.nome}</span>
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedTeams.map(t => `
              <tr>
                <td style="text-align:left;font-weight:700;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:24px;height:24px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                    <div>
                      <span style="color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${t.isCurrent ? 'normal' : 'italic'};">
                        ${t.name}
                      </span>
                      ${!t.isCurrent ? '<div style="font-size:0.65rem;color:var(--text-muted);font-weight:normal;">(storica)</div>' : ''}
                    </div>
                  </div>
                </td>
                ${comps.map(c => {
      const parts = formatPlacements(t.data.get(c.IDc));
      return `<td class="text-center" style="font-size:0.8rem;white-space:normal;line-height:1.5;">${parts.length > 0 ? parts.join(', ') : '<span style="color:var(--text-muted);">-</span>'}</td>`;
    }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile View (Adaptive by Comp or Clean Cards - Zero Horizontal Scroll) -->
      <div class="albo-mobile-only">
        <div class="albo-piazzamenti-filter-bar">
          <label for="alboPiazzamentiCompSelect" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;width:100%;">Filtra Competizione:</label>
          <select id="alboPiazzamentiCompSelect" class="form-select" style="width:100%;font-weight:700;font-size:0.85rem;">
            <option value="0" ${this.piazzamentiCompId === 0 ? 'selected' : ''}>Tutte le Competizioni (Schede)</option>
            ${comps.map(c => `<option value="${c.IDc}" ${c.IDc === this.piazzamentiCompId ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>

        ${this.piazzamentiCompId === 0 ? `
          <!-- All Comps: Cards per team -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${sortedTeams.map(t => {
      const teamCompsWithData = comps.map(c => ({ comp: c, parts: formatPlacements(t.data.get(c.IDc)) })).filter(item => item.parts.length > 0);
      return `
                <div class="albo-piazzamenti-team-card">
                  <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-subtle);padding-bottom:6px;">
                    <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:24px;height:24px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                    <div style="font-weight:800;color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-size:0.92rem;">
                      ${t.name} ${!t.isCurrent ? '<span class="albo-team-historic-tag">(storica)</span>' : ''}
                    </div>
                  </div>
                  ${teamCompsWithData.length === 0 ? `
                    <div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">Nessun piazzamento registrato.</div>
                  ` : teamCompsWithData.map(item => `
                    <div class="albo-piazzamenti-comp-line">
                      <span class="albo-piazzamenti-comp-title">
                        <img src="${this.getCompTrophyIcon(item.comp, true)}" style="height:14px;width:auto;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none';" alt="" />
                        ${item.comp.nome}:
                      </span>
                      <div class="albo-piazzamenti-badges-wrap">${item.parts.join(', ')}</div>
                    </div>
                  `).join('')}
                </div>
              `;
    }).join('')}
          </div>
        ` : `
          <!-- Single Comp: 2-column Table fitting 100% of mobile width -->
          <div class="table-responsive">
            <table class="modern-table" style="table-layout:fixed;width:100%;">
              <thead>
                <tr>
                  <th style="width:40%;text-align:left;padding-left:10px;">Squadra</th>
                  <th style="width:60%;text-align:left;padding-left:10px;">Piazzamenti (${comps.find(c => c.IDc === this.piazzamentiCompId)?.nome || ''})</th>
                </tr>
              </thead>
              <tbody>
                ${sortedTeams.map(t => {
      const parts = formatPlacements(t.data.get(this.piazzamentiCompId));
      return `
                    <tr>
                      <td style="text-align:left;font-weight:700;padding:8px 6px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                          <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:20px;height:20px;border-radius:3px;flex-shrink:0;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                          <span style="font-size:0.82rem;color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${t.name}
                          </span>
                        </div>
                      </td>
                      <td style="font-size:0.78rem;padding:8px 6px;line-height:1.4;">
                        ${parts.length > 0 ? parts.join(', ') : '<span style="color:var(--text-muted);">-</span>'}
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    subContainer.innerHTML = html;

    subContainer.querySelector('#alboPiazzamentiCompSelect')?.addEventListener('change', (e) => {
      this.piazzamentiCompId = parseInt(e.target.value, 10);
      this.renderPiazzamenti(subContainer);
    });
  },

  /**
   * 3. Storico Completo (GeneraStorico)
   */
  renderStorico(subContainer) {
    const albo = fcmDataLoader.getAlboDOro();
    const comps = albo.comps;
    const teams = albo.teams;
    const positions = albo.positions;

    if (comps.length === 0) {
      subContainer.innerHTML = `<div class="card text-center" style="padding:40px;color:var(--text-muted);">Nessun dato storico disponibile.</div>`;
      return;
    }

    const { mainComp } = this.getLeagueCompetitions(albo);
    if (!this.storicoCompId || !comps.some(c => c.IDc === this.storicoCompId)) {
      this.storicoCompId = mainComp ? mainComp.IDc : comps[0].IDc;
    }
    const currentComp = comps.find(c => c.IDc === this.storicoCompId) || comps[0];
    const compPositions = positions.filter(p => p.idCompetizione === currentComp.IDc);

    // Get sorted unique years ascending from arrAdOPosizioni (for this competition or overall)
    const compYears = Array.from(new Set(compPositions.map(p => p.anno))).sort((a, b) => a - b);
    const allYears = compYears.length > 0
      ? compYears
      : Array.from(new Set(positions.map(p => p.anno))).sort((a, b) => a - b);

    // Build dynamic eras for mobile view based on allYears from arrAdOPosizioni
    // Chunks of 5 years, starting from the most recent
    const eraOptions = [];
    const CHUNK_SIZE = 5;

    if (allYears.length > 0) {
      if (allYears.length <= CHUNK_SIZE) {
        // Single chunk fits mobile without breaking
        const label = allYears.length === 1 ? `${allYears[0]}` : `${allYears[0]} - ${allYears[allYears.length - 1]}`;
        eraOptions.push({
          id: 'chunk_0',
          label: label,
          years: allYears
        });
      } else {
        // Multiple chunks of up to 5 years, from most recent to oldest
        let remaining = [...allYears];
        let chunkIndex = 0;
        while (remaining.length > 0) {
          const chunkYears = remaining.slice(-CHUNK_SIZE);
          remaining = remaining.slice(0, -CHUNK_SIZE);
          const isLatest = chunkIndex === 0;
          const startYear = chunkYears[0];
          const endYear = chunkYears[chunkYears.length - 1];
          const label = isLatest
            ? `Ultime ${chunkYears.length} Annate (${startYear} - ${endYear})`
            : (startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`);
          eraOptions.push({
            id: `chunk_${chunkIndex}`,
            label: label,
            years: chunkYears
          });
          chunkIndex++;
        }

        // Add "Tutte" option
        eraOptions.push({
          id: 'all',
          label: `Tutte (${allYears.length})`,
          years: allYears
        });
      }
    }

    // Determine active era
    if (!this.storicoEra || !eraOptions.some(e => e.id === this.storicoEra)) {
      this.storicoEra = eraOptions.length > 0 ? eraOptions[0].id : 'all';
    }

    const currentEraObj = eraOptions.find(e => e.id === this.storicoEra) || eraOptions[0] || { years: allYears };
    const mobileYears = currentEraObj.years;

    const matrix = new Map();
    teams.forEach(t => {
      matrix.set(t.IDf, {
        id: t.IDf,
        idAttuale: t.idAttuale,
        name: t.nome,
        isCurrent: t.idAttuale > 0,
        years: {}
      });
    });

    compPositions.forEach(p => {
      let row = matrix.get(p.idSquadra);
      if (!row) {
        const teamObj = teams.find(t => t.IDf === p.idSquadra);
        const name = teamObj ? teamObj.nome : (p.presidente ? `Squadra (${p.presidente})` : `Squadra #${p.idSquadra}`);
        row = {
          id: p.idSquadra,
          idAttuale: teamObj ? teamObj.idAttuale : 0,
          name: name,
          isCurrent: teamObj ? teamObj.idAttuale > 0 : false,
          years: {}
        };
        matrix.set(p.idSquadra, row);
      }
      row.years[p.anno] = p.posizione;
    });

    const sortedTeams = Array.from(matrix.values()).sort((a, b) => a.name.localeCompare(b.name));

    let html = `
      <!-- Competition Selector Tabs -->
      <div class="pill-tabs albo-comp-tabs" id="storicoCompTabs">
        ${comps.map(c => `
          <button class="pill-btn ${c.IDc === currentComp.IDc ? 'active' : ''}" data-comp-id="${c.IDc}">
            <img src="${this.getCompTrophyIcon(c, true)}" style="height:15px;width:auto;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none';" alt="" />
            ${c.nome}
          </button>
        `).join('')}
      </div>

      <div style="margin-bottom:16px;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">
          Posizione finale ottenuta per ciascun anno di attività nella competizione <b>${currentComp.nome}</b>.
        </p>
      </div>

      <!-- Desktop View (Full Matrix Table) -->
      <div class="table-responsive albo-desktop-only">
        <table class="modern-table">
          <thead>
            <tr>
              <th style="min-width:170px;text-align:left;">Squadra</th>
              ${allYears.map(y => `<th class="text-center" style="min-width:55px;">${y}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedTeams.map(t => `
              <tr>
                <td style="text-align:left;font-weight:700;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:22px;height:22px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                    <div>
                      <span style="color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${t.isCurrent ? 'normal' : 'italic'};">
                        ${t.name}
                      </span>
                    </div>
                  </div>
                </td>
                ${allYears.map(y => {
      const pos = t.years[y];
      if (!pos) return '<td class="text-center" style="color:var(--text-muted);">-</td>';
      let posClass = '';
      if (pos === 1) posClass = 'background:rgba(245,158,11,0.2);color:var(--accent-gold);font-weight:900;border-radius:4px;';
      else if (pos === 2) posClass = 'background:rgba(148,163,184,0.15);color:#94a3b8;font-weight:800;border-radius:4px;';
      else if (pos === 3) posClass = 'background:rgba(217,119,6,0.15);color:#d97706;font-weight:800;border-radius:4px;';
      return `<td class="text-center" style="${posClass}">${pos}°</td>`;
    }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile View (Dynamic Era Selector + Sticky Team Column) -->
      <div class="albo-mobile-only">
        <div class="albo-storico-filter-bar">
          <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Periodo / Annate:</span>
          <div class="pill-tabs albo-era-tabs" id="alboStoricoEraTabs">
            ${eraOptions.map(era => `
              <button class="pill-btn ${this.storicoEra === era.id ? 'active' : ''}" data-era="${era.id}">
                ${era.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th class="albo-sticky-col-header" style="min-width:130px;max-width:140px;text-align:left;padding-left:8px;">Squadra</th>
                ${mobileYears.map(y => `<th class="text-center" style="min-width:44px;padding:6px 2px;font-size:0.75rem;">${y}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedTeams.map(t => `
                <tr>
                  <td class="albo-sticky-col-cell" style="text-align:left;font-weight:700;padding:6px 8px;min-width:130px;max-width:140px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <img src="${fcmDataLoader.getTeamLogo(t.idAttuale || t.id)}" style="width:20px;height:20px;border-radius:3px;flex-shrink:0;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                      <span style="font-size:0.78rem;color:${t.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${t.name}
                      </span>
                    </div>
                  </td>
                  ${mobileYears.map(y => {
      const pos = t.years[y];
      if (!pos) return '<td class="text-center" style="color:var(--text-muted);font-size:0.75rem;padding:6px 2px;">-</td>';
      let posClass = '';
      if (pos === 1) posClass = 'background:rgba(245,158,11,0.2);color:var(--accent-gold);font-weight:900;border-radius:3px;';
      else if (pos === 2) posClass = 'background:rgba(148,163,184,0.15);color:#94a3b8;font-weight:800;border-radius:3px;';
      else if (pos === 3) posClass = 'background:rgba(217,119,6,0.15);color:#d97706;font-weight:800;border-radius:3px;';
      return `<td class="text-center" style="font-size:0.78rem;padding:6px 2px;${posClass}">${pos}°</td>`;
    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    subContainer.innerHTML = html;

    subContainer.querySelectorAll('#storicoCompTabs button').forEach(tab => {
      tab.addEventListener('click', () => {
        this.storicoCompId = parseInt(tab.getAttribute('data-comp-id'), 10);
        this.renderStorico(subContainer);
      });
    });

    subContainer.querySelectorAll('#alboStoricoEraTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.storicoEra = btn.getAttribute('data-era');
        this.renderStorico(subContainer);
      });
    });
  },

  /**
   * 4. Dettaglio Annuale (GeneraDettagliato)
   */
  renderDettaglio(subContainer) {
    const albo = fcmDataLoader.getAlboDOro();
    const comps = albo.comps;
    const teams = albo.teams;
    const positions = albo.positions;

    if (positions.length === 0) {
      subContainer.innerHTML = `<div class="card text-center" style="padding:40px;color:var(--text-muted);">Nessun dato di dettaglio annuale disponibile.</div>`;
      return;
    }

    const { mainComp } = this.getLeagueCompetitions(albo);
    const mainCompId = mainComp ? mainComp.IDc : (comps[0]?.IDc || 0);

    const allYears = Array.from(new Set(positions.map(p => p.anno))).sort((a, b) => b - a);

    if (!this.dettaglioYear || !allYears.includes(this.dettaglioYear)) {
      this.dettaglioYear = allYears[0];
    }

    if (this.dettaglioCompId > 0 && !comps.some(c => c.IDc === this.dettaglioCompId)) {
      this.dettaglioCompId = 0;
    }

    let yearPositions = positions.filter(p => p.anno === this.dettaglioYear);
    if (this.dettaglioCompId > 0) {
      yearPositions = yearPositions.filter(p => p.idCompetizione === this.dettaglioCompId);
    }

    const compMap = new Map();
    yearPositions.forEach(p => {
      if (!compMap.has(p.idCompetizione)) {
        const compObj = comps.find(c => c.IDc === p.idCompetizione) || { IDc: p.idCompetizione, nome: `Competizione #${p.idCompetizione}` };
        compMap.set(p.idCompetizione, { comp: compObj, rows: [] });
      }
      compMap.get(p.idCompetizione).rows.push(p);
    });

    compMap.forEach(group => {
      group.rows.sort((a, b) => a.posizione - b.posizione);
    });

    let html = `
      <!-- Filters: Year and Comp -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;">
          <label for="selDettaglioYear" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
            Stagione / Anno:
          </label>
          <select id="selDettaglioYear" class="form-select" style="font-weight:700;">
            ${allYears.map(y => {
      const posYear = (this.dettaglioCompId > 0)
        ? positions.find(p => p.anno === y && p.idCompetizione === this.dettaglioCompId)
        : (positions.find(p => p.anno === y && p.idCompetizione === mainCompId) || positions.find(p => p.anno === y));
      const stag = posYear && posYear.stagione ? `${posYear.stagione}ª Edizione` : '';
      return `<option value="${y}" ${y === this.dettaglioYear ? 'selected' : ''}>${y}/${parseInt(y, 10) + 1} ${stag ? `(${stag})` : ''}</option>`;
    }).join('')}
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;">
          <label for="selDettaglioComp" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
            Competizione:
          </label>
          <select id="selDettaglioComp" class="form-select" style="font-weight:700;">
            <option value="0" ${this.dettaglioCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
            ${comps.map(c => `<option value="${c.IDc}" ${c.IDc === this.dettaglioCompId ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Competitions Cards -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        ${Array.from(compMap.values()).map(group => {
      const compTrophy = this.getCompTrophyIcon(group.comp);
      return `
            <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
                <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <img src="${compTrophy}" style="width:20px;height:20px;object-fit:contain;" onerror="this.src='img/ico-coppa.gif'" />
                  ${group.comp.nome}
                </div>
                <span class="badge badge-primary">${this.dettaglioYear}/${parseInt(this.dettaglioYear, 10) + 1}</span>
              </div>

              <!-- Desktop View (5-Column Table) -->
              <div class="table-responsive albo-desktop-only">
                <table class="modern-table">
                  <thead>
                    <tr>
                      <th class="text-center" style="width:50px;">Pos</th>
                      <th style="min-width:180px;text-align:left;">Squadra</th>
                      <th class="text-center" style="width:70px;">Punti</th>
                      <th style="text-align:left;min-width:150px;">Presidente</th>
                      <th style="text-align:left;">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.rows.map(r => {
        const teamName = this.getTeamName(albo, r.idSquadra, r.presidente);
        const logoId = this.getTeamLogoId(albo, r.idSquadra);
        const isWinner = r.posizione === 1;
        return `
                        <tr style="${isWinner ? 'background:rgba(245,158,11,0.08);' : ''}">
                          <td class="text-center font-bold">
                            <span class="table-pos ${r.posizione === 1 ? 'table-pos-1' : r.posizione === 2 ? 'table-pos-2' : r.posizione === 3 ? 'table-pos-3' : ''}">
                              ${r.posizione}°
                            </span>
                          </td>
                          <td style="text-align:left;font-weight:700;">
                            <div style="display:flex;align-items:center;gap:8px;">
                              <img src="${fcmDataLoader.getTeamLogo(logoId)}" style="width:24px;height:24px;border-radius:3px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <span>${teamName}</span>
                              ${isWinner ? `<img src="${this.getCompTrophyIcon(group.comp, true)}" style="height:18px;vertical-align:middle;margin-left:4px;" onerror="this.style.display='none';" alt="Vincitore" />` : ''}
                            </div>
                          </td>
                          <td class="text-center font-bold" style="color:var(--accent-cyan);">${r.punti !== null && r.punti !== undefined ? r.punti : '-'}</td>
                          <td style="text-align:left;color:var(--text-secondary);">${r.presidente || '-'}</td>
                          <td style="text-align:left;font-size:0.8rem;color:var(--text-muted);">${r.note || '-'}</td>
                        </tr>
                      `;
      }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Mobile View (Sleek Compact Rows - Zero Horizontal Scroll) -->
              <div class="albo-mobile-only">
                <div class="albo-dettaglio-mobile-list">
                  ${group.rows.map(r => {
        const teamName = this.getTeamName(albo, r.idSquadra, r.presidente);
        const logoId = this.getTeamLogoId(albo, r.idSquadra);
        const isWinner = r.posizione === 1;
        return `
                      <div class="albo-dettaglio-row ${isWinner ? 'is-winner' : ''}">
                        <div class="albo-dettaglio-pos">
                          <span class="table-pos ${r.posizione === 1 ? 'table-pos-1' : r.posizione === 2 ? 'table-pos-2' : r.posizione === 3 ? 'table-pos-3' : ''}">
                            ${r.posizione}°
                          </span>
                        </div>
                        <div class="albo-dettaglio-team-info">
                          <div class="albo-dettaglio-team-header">
                            <img src="${fcmDataLoader.getTeamLogo(logoId)}" class="albo-dettaglio-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <span class="albo-dettaglio-team-name">${teamName}</span>
                            ${isWinner ? `<img src="${this.getCompTrophyIcon(group.comp, true)}" style="height:16px;vertical-align:middle;flex-shrink:0;" onerror="this.style.display='none';" alt="Vincitore" />` : ''}
                          </div>
                          <div class="albo-dettaglio-subtext">
                            ${r.presidente ? `<span>Pres: <strong>${r.presidente}</strong></span>` : ''}
                            ${r.note ? `<span class="albo-dettaglio-note" style="color:var(--text-muted);font-style:italic;">(${r.note})</span>` : ''}
                          </div>
                        </div>
                        <div class="albo-dettaglio-points">
                          <span class="points-val">${r.punti !== null && r.punti !== undefined ? r.punti : '-'}</span>
                          <span class="points-lbl">pt</span>
                        </div>
                      </div>
                    `;
      }).join('')}
                </div>
              </div>
            </div>
          `;
    }).join('')}

        ${compMap.size === 0 ? `
          <div class="card text-center" style="padding:40px;color:var(--text-muted);">
            Nessun dato disponibile per i filtri selezionati.
          </div>
        ` : ''}
      </div>
    `;

    subContainer.innerHTML = html;

    subContainer.querySelector('#selDettaglioYear')?.addEventListener('change', (e) => {
      this.dettaglioYear = parseInt(e.target.value, 10);
      this.renderDettaglio(subContainer);
    });

    subContainer.querySelector('#selDettaglioComp')?.addEventListener('change', (e) => {
      this.dettaglioCompId = parseInt(e.target.value, 10);
      this.renderDettaglio(subContainer);
    });
  },

  /**
   * 2. Ranking Storico
   */
  async renderRanking(subContainer) {
    const rankingData = await fcmDataLoader.loadRanking();
    const albo = fcmDataLoader.getAlboDOro();

    let filtered = rankingData;
    if (this.rankingFilterCurrentOnly) {
      filtered = filtered.filter(r => r.isCurrent);
    }
    if (this.rankingFilterMinPoints) {
      filtered = filtered.filter(r => r.points > 0);
    }

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">
          Classifica perpetua per coefficienti calcolata in base a piazzamenti, trofei e stagioni disputate.
        </p>

        <!-- Filters -->
        <div style="display:gap:8px;display:flex;flex-wrap:wrap;">
          <button class="filter-chip ${this.rankingFilterCurrentOnly ? 'active' : ''}" id="btnRankCurrent">
            ${this.rankingFilterCurrentOnly ? '✓ Solo Attuali' : 'Tutte le Squadre'}
          </button>
          <button class="filter-chip ${this.rankingFilterMinPoints ? 'active' : ''}" id="btnRankMinPts">
            ${this.rankingFilterMinPoints ? '✓ Punti > 0' : 'Includi Punti ≤ 0'}
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="modern-table">
          <thead>
            <tr>
              <th class="text-center" style="width:50px;">Pos</th>
              <th style="min-width:180px;">Squadra &amp; Palmares</th>
              <th class="text-center">Punti</th>
              <th class="text-center" style="width:70px;">Variaz.</th>
              <th class="text-center">Pos Prec</th>
              <th class="text-center">Punti Prec</th>
              <th class="text-center">Stagioni</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => {
      // Trophy icons dynamically populated from albo.comps
      const trophies = [];
      if (albo && albo.comps) {
        albo.comps.forEach(c => {
          const count = item.trophies[c.IDc];
          if (count && count > 0) {
            const icon = this.getCompTrophyIcon(c);
            const smallIcon = this.getCompTrophyIcon(c, true);
            trophies.push(`<span class="trophy-badge" title="${count} ${c.nome}"><img src="${icon}" onerror="this.onerror=null;this.src='${smallIcon}';" alt="${c.nome}" /> ${count}</span>`);
          }
        });
      }

      let deltaHtml = `<span class="rank-delta rank-same">=</span>`;
      if (item.delta > 0) {
        deltaHtml = `<span class="rank-delta rank-up">▲ +${item.delta}</span>`;
      } else if (item.delta < 0) {
        deltaHtml = `<span class="rank-delta rank-down">▼ ${item.delta}</span>`;
      }

      return `
                <tr>
                  <td class="text-center font-bold">
                    <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">
                      ${idx + 1}°
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.idAlbo || item.teamName)}" style="width:28px;height:28px;border-radius:4px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                      <div>
                        <div style="font-weight:700;color:${item.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${item.isCurrent ? 'normal' : 'italic'};">
                          ${item.teamName} ${item.isCurrent ? fcmDataLoader.getTeamTrophiesHtml(item.teamName) : ''} ${!item.isCurrent ? '<span style="font-size:0.65rem;color:var(--text-muted);">(storica)</span>' : ''}
                        </div>
                        ${trophies.length > 0 ? `<div class="team-trophies">${trophies.join('')}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-cyan);font-size:1.05rem;">
                    ${item.points.toFixed(1)}
                  </td>
                  <td class="text-center">
                    ${deltaHtml}
                  </td>
                  <td class="text-center" style="color:var(--text-muted);">
                    ${item.prevPosition}°
                  </td>
                  <td class="text-center" style="color:var(--text-muted);">
                    ${item.prevPoints.toFixed(1)}
                  </td>
                  <td class="text-center font-bold">
                    ${item.seasons}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>

      <!-- MODALITÀ DI CALCOLO & LEGENDA (From ranking.htm) -->
      <div style="margin-top:35px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0;">
            Modalità di Calcolo del Ranking
          </h3>
        </div>

        <div style="background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(59,130,246,0.05));border:1px solid rgba(6,182,212,0.3);border-radius:var(--radius-md);padding:14px;font-size:0.85rem;color:var(--text-primary);margin-bottom:20px;">
          ℹ️ I punti del <b>Ranking</b> sono determinati da: <b>Piazzamenti nelle competizioni</b>, <b>Esiti partite (V/N/P)</b>, <b>Reti (Fatte/Subite)</b> e anzianità della stagione.
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
          <!-- 1) Piazzamento -->
          <div class="card" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);padding:14px;">
            <div style="font-size:0.9rem;font-weight:800;color:var(--accent-cyan);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              🏆 1) Punti per Piazzamento
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:0.8rem;">
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Campionato:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>100 pt</b> • 2°: <b>70 pt</b> • 3°: <b>50 pt</b> • 4°: <b>30 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Coppa di Lega:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>50 pt</b> • 2°: <b>30 pt</b> • 3°: <b>15 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Classifica GP:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>30 pt</b> • 2°: <b>15 pt</b> • 3°: <b>5 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Supercoppa:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>10 pt</b></div>
              </div>
            </div>
          </div>

          <!-- 2) Punti Partita -->
          <div class="card" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);padding:14px;">
            <div style="font-size:0.9rem;font-weight:800;color:var(--accent-emerald);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              ⚽ 2) Punti Partita
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:0.8rem;">
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--accent-emerald);">Vittorie:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • Campionato: <b>2 punti</b><br>
                  • Coppe: <b>1.8 punti</b><br>
                  • Supercoppa/Spareggi: <b>1.3 punti</b>
                </div>
              </div>
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--accent-gold);">Pareggi:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • Campionato: <b>1.2 punti</b><br>
                  • Coppe: <b>1.1 punti</b><br>
                  • Supercoppa/Spareggi: <b>1 punto</b>
                </div>
              </div>
            </div>
          </div>

          <!-- 3) Bonus / Malus e Storico -->
          <div class="card" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);padding:14px;">
            <div style="font-size:0.9rem;font-weight:800;color:var(--accent-gold);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              ⚖️ 3) Reti e Validità Storica
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:0.8rem;">
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Reti (Gol):</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • <b style="color:var(--accent-emerald);">+1.3 pt</b> per ogni gol fatto<br>
                  • <b style="color:var(--accent-crimson);">-1.3 pt</b> per ogni gol subito
                </div>
              </div>
              <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Validità Storica (Ultime 4 stagioni):</b>
                <div style="color:var(--text-secondary);margin-top:2px;line-height:1.4;">
                  • Stagione Corrente / Passata: <b>100%</b> dei punti<br>
                  • 2 Stagioni fa: <b>75%</b> dei punti<br>
                  • 3 Stagioni fa: <b>50%</b> dei punti<br>
                  • 4 Stagioni fa: <b>25%</b> dei punti<br>
                  • <i>Oltre 5 stagioni: 0 punti</i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    subContainer.innerHTML = html;

    subContainer.querySelector('#btnRankCurrent')?.addEventListener('click', () => {
      this.rankingFilterCurrentOnly = !this.rankingFilterCurrentOnly;
      this.renderRanking(subContainer);
    });

    subContainer.querySelector('#btnRankMinPts')?.addEventListener('click', () => {
      this.rankingFilterMinPoints = !this.rankingFilterMinPoints;
      this.renderRanking(subContainer);
    });
  }
};

if (typeof window !== 'undefined') {
  window.alboView = alboView;
}
