/**
 * RISULTATI VIEW
 * Detailed match scorecards, votes, modifiers and tabellini
 * ModernFCM
 */

const risultatiView = {
  currentSerieADay: null,
  currentMatchId: null,
  currentCompId: 0,
  isCompactView: null,
  lastLoadedHash: null,

  async render(container) {
    const calendar = fcmDataLoader.getCalendarData();
    const comps = fcmDataLoader.getCompetitions();

    if (this.isCompactView === null) {
      this.isCompactView = typeof window !== 'undefined' && window.innerWidth <= 768;
    }

    // Check URL parameters for day and match (e.g. #risultati?day=38&match=152)
    const hash = window.location.hash || '';
    if (hash !== this.lastLoadedHash) {
      this.lastLoadedHash = hash;
      if (hash.includes('?')) {
        const qStr = hash.substring(hash.indexOf('?'));
        const params = new URLSearchParams(qStr);
        if (params.has('day')) {
          const d = parseInt(params.get('day'), 10);
          if (!isNaN(d) && d > 0) {
            this.currentSerieADay = d;
          }
        }
        if (params.has('match')) {
          const mId = parseInt(params.get('match'), 10);
          if (!isNaN(mId) && mId >= 0) {
            this.currentMatchId = mId;
          }
        }
        if (params.has('comp')) {
          const cId = parseInt(params.get('comp'), 10);
          if (!isNaN(cId)) {
            this.currentCompId = cId;
          }
        }
      }
    }

    if (this.currentSerieADay === null) {
      // Di default dev'essere mostrata l'ultima giornata giocata se presente (altrimenti la prossima da giocare)
      this.currentSerieADay = calendar.lastPlayed > 0
        ? calendar.lastPlayed
        : (calendar.nextMatchday > 0 ? calendar.nextMatchday : (calendar.matchdays[0] ? calendar.matchdays[0].serieADay : 1));
    }

    if (calendar.matchdays.length > 0 && !calendar.matchdays.some(m => m.serieADay === this.currentSerieADay)) {
      this.currentSerieADay = calendar.lastPlayed > 0
        ? calendar.lastPlayed
        : (calendar.nextMatchday > 0 ? calendar.nextMatchday : calendar.matchdays[0].serieADay);
    }

    let dayMatches = calendar.matches.filter(m => m.serieADay === this.currentSerieADay);
    if (this.currentCompId > 0) {
      dayMatches = dayMatches.filter(m => m.compId === this.currentCompId);
    }
    // 1. Non visualizzare i turni di riposo tra gli incontri selezionabili
    dayMatches = dayMatches.filter(m => !m.isRiposo && m.type !== 2 && m.homeTeamId > 0 && m.awayTeamId > 0);

    // 3. Seleziona di default "0" (Tutti gli incontri) se non è specificato un match valido
    if (this.currentMatchId === null || (this.currentMatchId !== 0 && !dayMatches.some(m => m.id === this.currentMatchId))) {
      this.currentMatchId = 0;
    }

    if (window.location.hash.includes('?') && window.history && window.history.replaceState) {
      const matchParam = this.currentMatchId > 0 ? `&match=${this.currentMatchId}` : '';
      const compParam = this.currentCompId > 0 ? `&comp=${this.currentCompId}` : '';
      const synchedHash = `#risultati?day=${this.currentSerieADay}${matchParam}${compParam}`;
      if (window.location.hash !== synchedHash) {
        window.history.replaceState(null, '', synchedHash);
        this.lastLoadedHash = synchedHash;
      }
    }

    container.innerHTML = `
      <div class="card text-center" style="padding:40px;">
        <div style="font-size:1.1rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Caricamento Tabellini Risultati...</div>
        <div style="color:var(--text-muted);font-size:0.85rem;">Giornata ${this.currentSerieADay} di Serie A</div>
      </div>
    `;

    // Load detailed results
    const tabellini = await fcmDataLoader.loadMatchdayResults(this.currentSerieADay);

    // Precaricamento dei registri voti per tutte le squadre della giornata per recuperare i bonus/malus
    const activeTeamIds = Array.from(new Set(dayMatches.flatMap(m => [m.homeTeamId, m.awayTeamId]))).filter(id => id > 0);
    for (const tId of activeTeamIds) {
      await fcmDataLoader.loadRegisterDataForTeam(tId);
    }

    // Helper per estrarre solo il cognome (parte in MAIUSCOLO) del calciatore
    const getPlayerSurname = (fullName, isOfficeReserve = false) => {
      if (isOfficeReserve || (fullName && fullName.toLowerCase().includes("riserva d'ufficio"))) {
        return "RIS. D'UFF.";
      }
      if (!fullName) return '';
      const parts = fullName.trim().split(/\s+/);
      const upperParts = [];
      for (const part of parts) {
        if (part === part.toUpperCase() && part.toLowerCase() !== part.toUpperCase()) {
          upperParts.push(part);
        } else {
          break;
        }
      }
      if (upperParts.length > 0) {
        return upperParts.join(' ');
      }
      return parts[0] || fullName;
    };

    // Helper per link alla scheda giocatore
    const getPlayerLink = (playerOrName, isOfficeReserve = false) => {
      if (isOfficeReserve) return null;
      const rawName = (typeof playerOrName === 'string') ? playerOrName : (playerOrName && playerOrName.name);
      if (!rawName) return null;
      const clean = rawName.toLowerCase();
      if (clean.includes("riserva d'ufficio") || clean.includes("assente") || clean.includes("---")) {
        return null;
      }
      let pId = (typeof playerOrName === 'object' && playerOrName && playerOrName.id && parseInt(playerOrName.id, 10) > 0)
        ? parseInt(playerOrName.id, 10)
        : (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieAPlayerId === 'function' ? fcmDataLoader.getSerieAPlayerId(rawName) : null);
      return pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(rawName)}`;
    };

    // Helper per la maglietta di squadra in vista compatta
    const getPlayerShirtSrc = (p) => {
      if (p.isOfficeReserve || !p.club || p.name.toLowerCase().includes("riserva d'ufficio")) {
        return 'img/sq/undefined.svg';
      }
      return fcmDataLoader.getSerieAShirt(p.club);
    };

    const renderTeamScorecard = (tab, teamName, teamId, isAway = false) => {
      if (!tab) return '';

      const starters = tab.players.filter(p => p.isStarter);
      const bench = tab.players.filter(p => !p.isStarter && !p.isTribuna);
      const tribuna = tab.players.filter(p => p.isTribuna);
      const colSpan = this.isCompactView ? 2 : 5;

      const renderCompactPlayerRow = (p, rowClass = '') => {
        const shirtSrc = getPlayerShirtSrc(p);
        const bmIconsHtml = fcmDataLoader.getBonusMalusIcons(teamId, p.id, this.currentSerieADay);
        const pLink = getPlayerLink(p, p.isOfficeReserve);
        const pSurname = getPlayerSurname(p.name, p.isOfficeReserve);
        const nameContent = pLink
          ? `<a href="${pLink}" class="tabellino-player-link" title="Apri scheda di ${p.name}">${pSurname}</a>`
          : pSurname;

        if (isAway) {
          // Mirrored for Away Team: Voto Box on LEFT, Player info on RIGHT
          return `
            <tr class="${rowClass}">
              <td style="text-align:center;padding:2px 0;width:36px;min-width:36px;max-width:36px;box-sizing:border-box;vertical-align:middle;">
                <div class="voto-fv-vertical-box">
                  <div class="voto-val ${String(p.rawVote || '').length > 4 ? 'voto-long' : ''}" title="Voto">${p.rawVote}</div>
                  <div class="fv-val ${String(p.totVote || '').length > 4 ? 'voto-long' : ''}" title="FantaVoto">${p.totVote}</div>
                </div>
              </td>
              <td style="padding:2px 2px;vertical-align:middle;min-width:0;text-align:right;">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;min-width:0;">
                  <div style="min-width:0;overflow:hidden;flex:1;text-align:right;">
                    <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">
                      ${nameContent}
                    </div>
                    ${bmIconsHtml ? `
                      <div class="bm-icons-compact" style="margin-top:1px;display:flex;align-items:center;justify-content:flex-end;gap:2px;">
                        ${bmIconsHtml}
                      </div>
                    ` : (parseFloat(p.bonusMalus) !== 0 ? `
                      <div style="margin-top:1px;text-align:right;">
                        <span class="tabellino-bonus-pill ${parseFloat(p.bonusMalus) > 0 ? 'bonus-pos' : 'bonus-neg'}" style="font-size:0.58rem;padding:0 3px;line-height:1.1;display:inline-block;">
                          ${parseFloat(p.bonusMalus) > 0 ? '+' + p.bonusMalus : p.bonusMalus}
                        </span>
                      </div>
                    ` : '')}
                  </div>
                  <img src="${shirtSrc}" class="pr-maglia" style="width:12px;height:12px;vertical-align:middle;display:inline-block;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                  <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${p.roleLabel || fcmDataLoader.getRoleShort(p.role)}</span>
                </div>
              </td>
            </tr>
          `;
        } else {
          // Standard Home Team: Player info on LEFT, Voto Box on RIGHT
          return `
            <tr class="${rowClass}">
              <td style="padding:2px 2px;vertical-align:middle;min-width:0;">
                <div style="display:flex;align-items:center;gap:3px;min-width:0;">
                  <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${p.roleLabel || fcmDataLoader.getRoleShort(p.role)}</span>
                  <img src="${shirtSrc}" class="pr-maglia" style="width:12px;height:12px;vertical-align:middle;display:inline-block;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                  <div style="min-width:0;overflow:hidden;flex:1;">
                    <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${nameContent}
                    </div>
                    ${bmIconsHtml ? `
                      <div class="bm-icons-compact" style="margin-top:1px;display:flex;align-items:center;gap:2px;">
                        ${bmIconsHtml}
                      </div>
                    ` : (parseFloat(p.bonusMalus) !== 0 ? `
                      <div style="margin-top:1px;">
                        <span class="tabellino-bonus-pill ${parseFloat(p.bonusMalus) > 0 ? 'bonus-pos' : 'bonus-neg'}" style="font-size:0.58rem;padding:0 3px;line-height:1.1;display:inline-block;">
                          ${parseFloat(p.bonusMalus) > 0 ? '+' + p.bonusMalus : p.bonusMalus}
                        </span>
                      </div>
                    ` : '')}
                  </div>
                </div>
              </td>
              <td style="text-align:center;padding:2px 0;width:36px;min-width:36px;max-width:36px;box-sizing:border-box;vertical-align:middle;">
                <div class="voto-fv-vertical-box">
                  <div class="voto-val ${String(p.rawVote || '').length > 4 ? 'voto-long' : ''}" title="Voto">${p.rawVote}</div>
                  <div class="fv-val ${String(p.totVote || '').length > 4 ? 'voto-long' : ''}" title="FantaVoto">${p.totVote}</div>
                </div>
              </td>
            </tr>
          `;
        }
      };

      return `
        <div class="tabellino-team-box" style="flex:1;min-width:0;">
          <div class="tabellino-team-header" style="${this.isCompactView && isAway ? 'flex-direction:row-reverse;' : ''}">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;${this.isCompactView && isAway ? 'flex-direction:row-reverse;' : ''}">
              <img src="${fcmDataLoader.getTeamLogo(teamName || teamId)}" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <b style="font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;">${teamName}</b>
            </div>
            <span class="badge badge-primary tabellino-goals-badge">${tab.goals}</span>
          </div>

          <!-- Single Table for Titolari, Panchina & Tribuna -->
          <div class="table-responsive">
            <table class="tabellino-table ${this.isCompactView ? 'is-compact' : ''}">
              <thead>
                ${this.isCompactView ? (isAway ? `
                  <tr>
                    <th style="width:36px;min-width:36px;max-width:36px;text-align:center;padding:3px 0;box-sizing:border-box;">V/FV</th>
                    <th style="text-align:right;padding:3px 2px;min-width:0;">Calciatore</th>
                  </tr>
                ` : `
                  <tr>
                    <th style="text-align:left;padding:3px 2px;min-width:0;">Calciatore</th>
                    <th style="width:36px;min-width:36px;max-width:36px;text-align:center;padding:3px 0;box-sizing:border-box;">V/FV</th>
                  </tr>
                `) : `
                  <tr>
                    <th style="width:75px;text-align:center;">Ruolo</th>
                    <th style="text-align:left;">Calciatore</th>
                    <th style="width:46px;text-align:center;">Voto</th>
                    <th style="width:50px;text-align:center;">Mod</th>
                    <th style="width:48px;text-align:right;padding-right:8px;">FV</th>
                  </tr>
                `}
              </thead>
              <tbody>
                <!-- 1. Titolari -->
                ${starters.map(p => {
        const pLink = getPlayerLink(p, p.isOfficeReserve);
        return this.isCompactView ? renderCompactPlayerRow(p, p.isSubbedIn ? 'subbed-in' : '') : `
                  <tr class="${p.isSubbedIn ? 'subbed-in' : ''}">
                    <td style="text-align:center;">
                      <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                        <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${p.roleLabel || fcmDataLoader.getRoleShort(p.role)}</span>
                        <img src="${p.isOfficeReserve ? 'img/foto/misterx.gif' : fcmDataLoader.getPlayerPhoto(p.name)}" class="pr-foto-thumb" onerror="this.src='img/foto/misterx.gif'" alt="${p.name}" />
                      </div>
                    </td>
                    <td>
                      <div class="tabellino-player-name">
                        ${pLink ? `<a href="${pLink}" class="tabellino-player-link" title="Apri scheda di ${p.name}">${p.name}</a>` : `<span>${p.name}</span>`}
                      </div>
                      <div class="tabellino-player-club" style="display:flex;align-items:center;gap:4px;">
                        ${p.club ? `<img src="${fcmDataLoader.getSerieAShirt(p.club)}" class="pr-maglia" style="width:14px;height:14px;vertical-align:middle;display:inline-block;" onerror="this.style.display='none'" />` : ''}
                        <span>${p.club}</span>
                        ${(() => {
            const bmIconsHtml = fcmDataLoader.getBonusMalusIcons(teamId, p.id, this.currentSerieADay);
            return bmIconsHtml ? `<span class="bm-icons-inline" style="margin-left:4px;display:inline-flex;align-items:center;gap:2px;">${bmIconsHtml}</span>` : '';
          })()}
                      </div>
                    </td>
                    <td class="tabellino-vote">${p.rawVote}</td>
                    <td class="text-center">
                      ${parseFloat(p.bonusMalus) !== 0 ? `
                        <span class="tabellino-bonus-pill ${parseFloat(p.bonusMalus) > 0 ? 'bonus-pos' : 'bonus-neg'}">
                          ${parseFloat(p.bonusMalus) > 0 ? '+' + p.bonusMalus : p.bonusMalus}
                        </span>
                      ` : '<span style="color:var(--text-muted);">-</span>'}
                    </td>
                    <td class="tabellino-fv">${p.totVote}</td>
                  </tr>
                `;
      }).join('')}

                <!-- 2. Riepilogo Punteggio Card -->
                <tr class="tabellino-card-row">
                  <td colspan="${colSpan}" style="padding:6px 0;border-bottom:none;">
                    <div class="modifiers-card" style="margin:0;padding:6px;">
                      <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;${this.isCompactView && isAway ? 'text-align:right;' : ''}">
                        Riepilogo Punteggio
                      </div>
                      ${this.isCompactView ? (isAway ? `
                        <!-- In vista compatta a specchio per Trasferta -->
                        <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:6px;">
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.partialScore}</span>
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Parziale Squadra</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.homeFieldAdvantage > 0 ? '+' + tab.homeFieldAdvantage : tab.homeFieldAdvantage}</span>
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Fattore Campo</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modDefense > 0 ? '+' + tab.modDefense : tab.modDefense}</span>
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Difesa</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modMidfield > 0 ? '+' + tab.modMidfield : tab.modMidfield}</span>
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Centrocampo</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modAttack > 0 ? '+' + tab.modAttack : tab.modAttack}</span>
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Attacco</span>
                          </div>
                          ${tab.modGoalkeeper !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modGoalkeeper > 0 ? '+' + tab.modGoalkeeper : tab.modGoalkeeper}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Portiere</span>
                            </div>
                          ` : ''}
                          ${tab.modModule !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modModule > 0 ? '+' + tab.modModule : tab.modModule}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Modulo</span>
                            </div>
                          ` : ''}
                          ${tab.modM1 !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modM1 > 0 ? '+' + tab.modM1 : tab.modM1}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Punti Agg.</span>
                            </div>
                          ` : ''}
                          ${tab.modM2 !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modM2 > 0 ? '+' + tab.modM2 : tab.modM2}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Voto Uff.</span>
                            </div>
                          ` : ''}
                        </div>
                        <div class="modifier-total" style="padding:4px 6px;display:flex;justify-content:space-between;align-items:center;">
                          <div style="font-size:0.85rem;font-weight:900;color:var(--accent-cyan);">GOL: ${tab.goals}</div>
                          <div style="font-size:0.68rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">Totale: <b>${tab.totalScore}</b></div>
                        </div>
                      ` : `
                        <!-- In vista compatta normale per Casa -->
                        <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:6px;">
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Parziale Squadra</span>
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.partialScore}</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Fattore Campo</span>
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.homeFieldAdvantage > 0 ? '+' + tab.homeFieldAdvantage : tab.homeFieldAdvantage}</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Difesa</span>
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modDefense > 0 ? '+' + tab.modDefense : tab.modDefense}</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Centrocampo</span>
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modMidfield > 0 ? '+' + tab.modMidfield : tab.modMidfield}</span>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Attacco</span>
                            <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modAttack > 0 ? '+' + tab.modAttack : tab.modAttack}</span>
                          </div>
                          ${tab.modGoalkeeper !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Portiere</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modGoalkeeper > 0 ? '+' + tab.modGoalkeeper : tab.modGoalkeeper}</span>
                            </div>
                          ` : ''}
                          ${tab.modModule !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Mod. Modulo</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modModule > 0 ? '+' + tab.modModule : tab.modModule}</span>
                            </div>
                          ` : ''}
                          ${tab.modM1 !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Punti Agg.</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modM1 > 0 ? '+' + tab.modM1 : tab.modM1}</span>
                            </div>
                          ` : ''}
                          ${tab.modM2 !== 0 ? `
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-elevated);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Voto Uff.</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.modM2 > 0 ? '+' + tab.modM2 : tab.modM2}</span>
                            </div>
                          ` : ''}
                        </div>
                        <div class="modifier-total" style="padding:4px 6px;display:flex;justify-content:space-between;align-items:center;">
                          <div style="font-size:0.68rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">Totale: <b>${tab.totalScore}</b></div>
                          <div style="font-size:0.85rem;font-weight:900;color:var(--accent-cyan);">GOL: ${tab.goals}</div>
                        </div>
                      `) : `
                        <div class="modifiers-row-2">
                          <div class="modifier-item">
                            <div class="modifier-label">Parziale Squadra</div>
                            <div class="modifier-value">${tab.partialScore}</div>
                          </div>
                          <div class="modifier-item">
                            <div class="modifier-label">Fattore Campo</div>
                            <div class="modifier-value">${tab.homeFieldAdvantage > 0 ? '+' + tab.homeFieldAdvantage : tab.homeFieldAdvantage}</div>
                          </div>
                        </div>

                        <div class="modifiers-row-3">
                          <div class="modifier-item">
                            <div class="modifier-label">Mod. Difesa</div>
                            <div class="modifier-value">${tab.modDefense > 0 ? '+' + tab.modDefense : tab.modDefense}</div>
                          </div>
                          <div class="modifier-item">
                            <div class="modifier-label">Mod. Centrocampo</div>
                            <div class="modifier-value">${tab.modMidfield > 0 ? '+' + tab.modMidfield : tab.modMidfield}</div>
                          </div>
                          <div class="modifier-item">
                            <div class="modifier-label">Mod. Attacco</div>
                            <div class="modifier-value">${tab.modAttack > 0 ? '+' + tab.modAttack : tab.modAttack}</div>
                          </div>
                        </div>

                        ${(tab.modGoalkeeper !== 0 || tab.modModule !== 0 || tab.modM1 !== 0 || tab.modM2 !== 0) ? `
                          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(90px, 1fr));gap:8px;margin-bottom:8px;">
                            ${tab.modGoalkeeper !== 0 ? `<div class="modifier-item"><div class="modifier-label">Mod. Portiere</div><div class="modifier-value">${tab.modGoalkeeper > 0 ? '+' + tab.modGoalkeeper : tab.modGoalkeeper}</div></div>` : ''}
                            ${tab.modModule !== 0 ? `<div class="modifier-item"><div class="modifier-label">Mod. Modulo</div><div class="modifier-value">${tab.modModule > 0 ? '+' + tab.modModule : tab.modModule}</div></div>` : ''}
                            ${tab.modM1 !== 0 ? `<div class="modifier-item"><div class="modifier-label">Punti Agg.</div><div class="modifier-value">${tab.modM1 > 0 ? '+' + tab.modM1 : tab.modM1}</div></div>` : ''}
                            ${tab.modM2 !== 0 ? `<div class="modifier-item"><div class="modifier-label">Voto Uff.</div><div class="modifier-value">${tab.modM2 > 0 ? '+' + tab.modM2 : tab.modM2}</div></div>` : ''}
                          </div>
                        ` : ''}
                        <div class="modifier-total">
                          <div class="modifier-label-total">Totale Squadra: <b>${tab.totalScore}</b></div>
                          <div class="modifier-value-total" style="font-size:1.1rem;color:var(--accent-cyan);">GOL: ${tab.goals}</div>
                        </div>
                      `}
                    </div>
                  </td>
                </tr>

                <!-- 3. Tempi Supplementari (se valorizzati nel tabellino) -->
                ${tab.hasExtraTime ? `
                  <tr class="tabellino-card-row">
                    <td colspan="${colSpan}" style="padding:${this.isCompactView ? '4px 0' : '10px 0'};border-bottom:none;">
                      <div class="extra-time-card" style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:${this.isCompactView ? '6px' : '12px'};background:var(--bg-surface-elevated);">
                        <div style="font-size:${this.isCompactView ? '0.68rem' : '0.8rem'};font-weight:800;color:var(--accent-amber,#f59e0b);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px;${this.isCompactView && isAway ? 'justify-content:flex-end;' : ''}">
                          <span class="badge badge-warning" style="${this.isCompactView ? 'font-size:0.6rem;padding:2px 4px;' : ''}">⏱ Tempi Supplementari</span>
                        </div>
                        ${tab.extraTimePlayers && tab.extraTimePlayers.length > 0 ? `
                          <table class="tabellino-table ${this.isCompactView ? 'is-compact' : ''}" style="margin-bottom:6px;">
                            <thead>
                              ${this.isCompactView ? (isAway ? `
                                <tr>
                                  <th style="width:34px;min-width:34px;max-width:34px;text-align:center;padding:3px 0;box-sizing:border-box;">Voto</th>
                                  <th style="text-align:right;padding:3px 2px;min-width:0;">Calciatore</th>
                                </tr>
                              ` : `
                                <tr>
                                  <th style="text-align:left;padding:3px 2px;min-width:0;">Calciatore</th>
                                  <th style="width:34px;min-width:34px;max-width:34px;text-align:center;padding:3px 0;box-sizing:border-box;">Voto</th>
                                </tr>
                              `) : `
                                <tr>
                                  <th style="width:75px;text-align:center;">Ruolo</th>
                                  <th style="text-align:left;">Calciatore</th>
                                  <th style="width:60px;text-align:center;">Voto</th>
                                </tr>
                              `}
                            </thead>
                            <tbody>
                              ${tab.extraTimePlayers.map(sp => {
        const spLink = getPlayerLink(sp, sp.isOfficeReserve);
        const spSurname = getPlayerSurname(sp.name, sp.isOfficeReserve);
        const spContent = spLink
          ? `<a href="${spLink}" class="tabellino-player-link" title="Apri scheda di ${sp.name}">${spSurname}</a>`
          : spSurname;
        return this.isCompactView ? (isAway ? `
                                <tr>
                                  <td style="text-align:center;padding:2px 0;width:34px;min-width:34px;max-width:34px;box-sizing:border-box;vertical-align:middle;">
                                    <span style="font-weight:800;font-size:0.75rem;" class="${sp.isSuccess ? 'voto-V' : 'voto-R'}">${sp.rawVote}</span>
                                  </td>
                                  <td style="padding:2px 2px;vertical-align:middle;min-width:0;text-align:right;">
                                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;min-width:0;">
                                      <div style="min-width:0;overflow:hidden;flex:1;text-align:right;">
                                        <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">
                                          ${spContent}
                                        </div>
                                      </div>
                                      <img src="${getPlayerShirtSrc(sp)}" class="pr-maglia" style="width:12px;height:12px;display:block;align-self:center;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                                      <span class="role-badge ${fcmDataLoader.getRoleClass(sp.role)}">${sp.roleLabel || fcmDataLoader.getRoleShort(sp.role)}</span>
                                    </div>
                                  </td>
                                </tr>
                              ` : `
                                <tr>
                                  <td style="padding:2px 2px;vertical-align:middle;min-width:0;">
                                    <div style="display:flex;align-items:center;gap:3px;min-width:0;">
                                      <span class="role-badge ${fcmDataLoader.getRoleClass(sp.role)}">${sp.roleLabel || fcmDataLoader.getRoleShort(sp.role)}</span>
                                      <img src="${getPlayerShirtSrc(sp)}" class="pr-maglia" style="width:12px;height:12px;display:block;align-self:center;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                                      <div style="min-width:0;overflow:hidden;flex:1;">
                                        <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                          ${spContent}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style="text-align:center;padding:2px 0;width:34px;min-width:34px;max-width:34px;box-sizing:border-box;vertical-align:middle;">
                                    <span style="font-weight:800;font-size:0.75rem;" class="${sp.isSuccess ? 'voto-V' : 'voto-R'}">${sp.rawVote}</span>
                                  </td>
                                </tr>
                              `) : `
                                <tr>
                                  <td style="text-align:center;">
                                    <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                                      <span class="role-badge ${fcmDataLoader.getRoleClass(sp.role)}">${sp.roleLabel}</span>
                                      <img src="${sp.isOfficeReserve ? 'img/foto/misterx.gif' : fcmDataLoader.getPlayerPhoto(sp.name)}" class="pr-foto-thumb" onerror="this.src='img/foto/misterx.gif'" alt="${sp.name}" />
                                    </div>
                                  </td>
                                  <td style="font-weight:700;">
                                    ${spLink ? `<a href="${spLink}" class="tabellino-player-link" title="Apri scheda di ${sp.name}">${sp.name}</a>` : sp.name}
                                  </td>
                                  <td style="text-align:center;font-weight:800;" class="${sp.isSuccess ? 'voto-V' : 'voto-R'}">
                                    ${sp.rawVote}
                                  </td>
                                </tr>
                              `;
      }).join('')}
                            </tbody>
                          </table>
                        ` : ''}
                        ${this.isCompactView ? (isAway ? `
                          <!-- Vista compatta trasf. footer supplementari -->
                          <div style="display:flex;flex-direction:column;gap:3px;margin-top:6px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.extraTimePartial}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Parziale Supp.</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.extraTimeHomeAdvantage > 0 ? '+' + tab.extraTimeHomeAdvantage : tab.extraTimeHomeAdvantage}</span>
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Fattore Campo Supp.</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.85rem;font-weight:900;color:var(--accent-cyan);">${tab.extraTimeGoals}</span>
                              <span style="font-size:0.68rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">GOL SUPP.</span>
                            </div>
                          </div>
                        ` : `
                          <!-- Vista compatta casa footer supplementari -->
                          <div style="display:flex;flex-direction:column;gap:3px;margin-top:6px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Parziale Supp.</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.extraTimePartial}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Fattore Campo Supp.</span>
                              <span style="font-size:0.75rem;font-weight:800;color:var(--text-primary);">${tab.extraTimeHomeAdvantage > 0 ? '+' + tab.extraTimeHomeAdvantage : tab.extraTimeHomeAdvantage}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                              <span style="font-size:0.68rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">GOL SUPP.</span>
                              <span style="font-size:0.85rem;font-weight:900;color:var(--accent-cyan);">${tab.extraTimeGoals}</span>
                            </div>
                          </div>
                        `) : `
                          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.8rem;background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);">
                            <span>Parziale Supp: <b>${tab.extraTimePartial}</b></span>
                            <span>Fattore Campo Supp: <b>${tab.extraTimeHomeAdvantage}</b></span>
                            <span style="margin-left:auto;color:var(--accent-cyan);font-weight:800;">GOL SUPP: ${tab.extraTimeGoals}</span>
                          </div>
                        `}
                      </div>
                    </td>
                  </tr>
                ` : ''}

                <!-- 4. Calci di Rigore (se valorizzati nel tabellino) -->
                ${tab.hasPenalties ? `
                  <tr class="tabellino-card-row">
                    <td colspan="${colSpan}" style="padding:${this.isCompactView ? '4px 0' : '10px 0'};border-bottom:none;">
                      <div class="penalties-card" style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:${this.isCompactView ? '6px' : '12px'};background:var(--bg-surface-elevated);">
                        <div style="font-size:${this.isCompactView ? '0.68rem' : '0.8rem'};font-weight:800;color:var(--accent-amber,#f59e0b);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px;${this.isCompactView && isAway ? 'justify-content:flex-end;' : ''}">
                          <span class="badge badge-warning" style="${this.isCompactView ? 'font-size:0.6rem;padding:2px 4px;' : ''}">⚽ Calci di Rigore</span>
                        </div>
                        ${tab.penaltyPlayers && tab.penaltyPlayers.length > 0 ? `
                          <table class="tabellino-table ${this.isCompactView ? 'is-compact' : ''}" style="margin-bottom:6px;">
                            <thead>
                              ${this.isCompactView ? (isAway ? `
                                <tr>
                                  <th style="width:34px;min-width:34px;max-width:34px;text-align:center;padding:3px 0;box-sizing:border-box;">Voto</th>
                                  <th style="text-align:right;padding:3px 2px;min-width:0;">Rigorista</th>
                                </tr>
                              ` : `
                                <tr>
                                  <th style="text-align:left;padding:3px 2px;min-width:0;">Rigorista</th>
                                  <th style="width:34px;min-width:34px;max-width:34px;text-align:center;padding:3px 0;box-sizing:border-box;">Voto</th>
                                </tr>
                              `) : `
                                <tr>
                                  <th style="text-align:left;">Rigorista</th>
                                  <th style="width:70px;text-align:center;">Voto</th>
                                </tr>
                              `}
                            </thead>
                            <tbody>
                              ${tab.penaltyPlayers.map(rp => {
        const rpLink = getPlayerLink(rp, rp.isOfficeReserve);
        const rpSurname = getPlayerSurname(rp.name, rp.isOfficeReserve);
        const rpContent = rpLink
          ? `<a href="${rpLink}" class="tabellino-player-link" title="Apri scheda di ${rp.name}">${rpSurname}</a>`
          : rpSurname;
        return this.isCompactView ? (isAway ? `
                                <tr>
                                  <td style="text-align:center;padding:2px 0;width:34px;min-width:34px;max-width:34px;box-sizing:border-box;vertical-align:middle;">
                                    <span style="font-weight:800;font-size:0.75rem;" class="${rp.isScored ? 'voto-V' : 'voto-R'}">${rp.rawVote}</span>
                                  </td>
                                  <td style="padding:2px 2px;vertical-align:middle;min-width:0;text-align:right;">
                                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;min-width:0;">
                                      <div style="min-width:0;overflow:hidden;flex:1;text-align:right;">
                                        <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">
                                          ${rpContent}
                                        </div>
                                      </div>
                                      <img src="${getPlayerShirtSrc(rp)}" class="pr-maglia" style="width:12px;height:12px;display:block;align-self:center;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                                    </div>
                                  </td>
                                </tr>
                              ` : `
                                <tr>
                                  <td style="padding:2px 2px;vertical-align:middle;min-width:0;">
                                    <div style="display:flex;align-items:center;gap:3px;min-width:0;">
                                      <img src="${getPlayerShirtSrc(rp)}" class="pr-maglia" style="width:12px;height:12px;display:block;align-self:center;flex-shrink:0;" onerror="this.src='img/sq/undefined.svg'" />
                                      <div style="min-width:0;overflow:hidden;flex:1;">
                                        <div class="tabellino-player-name" style="font-weight:700;font-size:0.72rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                          ${rpContent}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style="text-align:center;padding:2px 0;width:34px;min-width:34px;max-width:34px;box-sizing:border-box;vertical-align:middle;">
                                    <span style="font-weight:800;font-size:0.75rem;" class="${rp.isScored ? 'voto-V' : 'voto-R'}">${rp.rawVote}</span>
                                  </td>
                                </tr>
                              `) : `
                                <tr>
                                  <td style="font-weight:700;">
                                    <div style="display:flex;align-items:center;gap:6px;">
                                      <img src="${rp.isOfficeReserve ? 'img/foto/misterx.gif' : fcmDataLoader.getPlayerPhoto(rp.name)}" class="pr-foto-thumb" onerror="this.src='img/foto/misterx.gif'" alt="${rp.name}" />
                                      ${rpLink ? `<a href="${rpLink}" class="tabellino-player-link" title="Apri scheda di ${rp.name}">${rp.name}</a>` : `<span>${rp.name}</span>`}
                                    </div>
                                  </td>
                                  <td style="text-align:center;font-weight:800;" class="${rp.isScored ? 'voto-V' : 'voto-R'}">
                                    ${rp.rawVote}
                                  </td>
                                </tr>
                              `;
      }).join('')}
                            </tbody>
                          </table>
                        ` : ''}
                        ${this.isCompactView ? (isAway ? `
                          <!-- Vista compatta trasf. footer rigori -->
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="color:var(--accent-cyan);font-size:0.85rem;font-weight:900;">${tab.penaltyGoals} GOL</span>
                            <span style="font-size:0.65rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">Totale Gol Rigori</span>
                          </div>
                        ` : `
                          <!-- Vista compatta casa footer rigori -->
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:3px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
                            <span style="font-size:0.65rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;">Totale Gol Rigori</span>
                            <span style="color:var(--accent-cyan);font-size:0.85rem;font-weight:900;">${tab.penaltyGoals} GOL</span>
                          </div>
                        `) : `
                          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);font-weight:800;">
                            <span>Totale Gol Rigori:</span>
                            <span style="color:var(--accent-cyan);font-size:1.05rem;">${tab.penaltyGoals} GOL</span>
                          </div>
                        `}
                      </div>
                    </td>
                  </tr>
                ` : ''}

                <!-- 5. Panchina & Sostituiti -->
                ${bench.length > 0 ? `
                  <tr class="tabellino-section-header">
                    <td colspan="${colSpan}" style="${this.isCompactView && isAway ? 'text-align:right;' : 'text-align:left;'}background:var(--bg-surface-elevated);color:var(--text-muted);font-weight:800;">
                      Panchina &amp; Sostituiti
                    </td>
                  </tr>
                  ${bench.map(p => {
        const pLink = getPlayerLink(p, p.isOfficeReserve);
        return this.isCompactView ? renderCompactPlayerRow(p, `bench ${p.isSubbedOut ? 'subbed-out' : ''}`) : `
                    <tr class="bench ${p.isSubbedOut ? 'subbed-out' : ''}">
                      <td style="text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                          <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${p.roleLabel || fcmDataLoader.getRoleShort(p.role)}</span>
                          <img src="${p.isOfficeReserve ? 'img/foto/misterx.gif' : fcmDataLoader.getPlayerPhoto(p.name)}" class="pr-foto-thumb" onerror="this.src='img/foto/misterx.gif'" alt="${p.name}" />
                        </div>
                      </td>
                      <td>
                        <div class="tabellino-player-name">
                          ${pLink ? `<a href="${pLink}" class="tabellino-player-link" title="Apri scheda di ${p.name}">${p.name}</a>` : `<span>${p.name}</span>`}
                        </div>
                        <div class="tabellino-player-club" style="display:flex;align-items:center;gap:4px;">
                          ${p.club ? `<img src="${fcmDataLoader.getSerieAShirt(p.club)}" class="pr-maglia" style="width:14px;height:14px;vertical-align:middle;display:inline-block;" onerror="this.style.display='none'" />` : ''}
                          <span>${p.club}</span>
                          ${(() => {
            const bmIconsHtml = fcmDataLoader.getBonusMalusIcons(teamId, p.id, this.currentSerieADay);
            return bmIconsHtml ? `<span class="bm-icons-inline" style="margin-left:4px;display:inline-flex;align-items:center;gap:2px;">${bmIconsHtml}</span>` : '';
          })()}
                        </div>
                      </td>
                      <td class="tabellino-vote" style="color:var(--text-muted);">${p.rawVote}</td>
                      <td class="text-center">
                        ${parseFloat(p.bonusMalus) !== 0 ? `
                          <span class="tabellino-bonus-pill ${parseFloat(p.bonusMalus) > 0 ? 'bonus-pos' : 'bonus-neg'}">
                            ${parseFloat(p.bonusMalus) > 0 ? '+' + p.bonusMalus : p.bonusMalus}
                          </span>
                        ` : '<span style="color:var(--text-muted);">-</span>'}
                      </td>
                      <td class="tabellino-fv" style="color:var(--text-muted);">${p.totVote}</td>
                    </tr>
                  `;
      }).join('')}
                ` : ''}

                <!-- 6. Tribuna -->
                ${tribuna.length > 0 ? `
                  <tr class="tabellino-section-header">
                    <td colspan="${colSpan}" style="${this.isCompactView && isAway ? 'text-align:right;' : 'text-align:left;'}background:var(--bg-surface-elevated);color:var(--text-muted);font-weight:800;">
                      Tribuna
                    </td>
                  </tr>
                  ${tribuna.map(p => {
        const pLink = getPlayerLink(p, p.isOfficeReserve);
        return this.isCompactView ? renderCompactPlayerRow(p, 'bench tribuna-row') : `
                    <tr class="bench tribuna-row">
                      <td style="text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                          <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${p.roleLabel || fcmDataLoader.getRoleShort(p.role)}</span>
                          <img src="${p.isOfficeReserve ? 'img/foto/misterx.gif' : fcmDataLoader.getPlayerPhoto(p.name)}" class="pr-foto-thumb" onerror="this.src='img/foto/misterx.gif'" alt="${p.name}" />
                        </div>
                      </td>
                      <td>
                        <div class="tabellino-player-name">
                          ${pLink ? `<a href="${pLink}" class="tabellino-player-link" title="Apri scheda di ${p.name}">${p.name}</a>` : `<span>${p.name}</span>`}
                        </div>
                        <div class="tabellino-player-club" style="display:flex;align-items:center;gap:4px;">
                          ${p.club ? `<img src="${fcmDataLoader.getSerieAShirt(p.club)}" class="pr-maglia" style="width:14px;height:14px;vertical-align:middle;display:inline-block;" onerror="this.style.display='none'" />` : ''}
                          <span>${p.club}</span>
                          ${(() => {
            const bmIconsHtml = fcmDataLoader.getBonusMalusIcons(teamId, p.id, this.currentSerieADay);
            return bmIconsHtml ? `<span class="bm-icons-inline" style="margin-left:4px;display:inline-flex;align-items:center;gap:2px;">${bmIconsHtml}</span>` : '';
          })()}
                        </div>
                      </td>
                      <td class="tabellino-vote" style="color:var(--text-muted);">${p.rawVote}</td>
                      <td class="text-center">
                        ${parseFloat(p.bonusMalus) !== 0 ? `
                          <span class="tabellino-bonus-pill ${parseFloat(p.bonusMalus) > 0 ? 'bonus-pos' : 'bonus-neg'}">
                            ${parseFloat(p.bonusMalus) > 0 ? '+' + p.bonusMalus : p.bonusMalus}
                          </span>
                        ` : '<span style="color:var(--text-muted);">-</span>'}
                      </td>
                      <td class="tabellino-fv" style="color:var(--text-muted);">${p.totVote}</td>
                    </tr>
                  `;
      }).join('')}
                ` : ''}
              </tbody>
            </table>
          </div>

        </div>
      `;
    };

    // Helper per la resa di un singolo blocco incontro (Scoreboard + Tabellini se disputato)
    const renderSingleMatchBlock = (match) => {
      const homeTab = tabellini.find(t => t.matchId === match.id && t.teamId === match.homeTeamId);
      const awayTab = tabellini.find(t => t.matchId === match.id && t.teamId === match.awayTeamId);
      const isPlayed = match.played && (homeTab || awayTab);

      return `
        <div class="match-block-item" style="margin-bottom:28px;">
          <!-- Match Big Scoreboard Header -->
          <div class="match-scoreboard-card" style="margin-bottom:${isPlayed ? '16px' : '0'};">
            <div class="scoreboard-team scoreboard-home">
              <img src="${fcmDataLoader.getTeamLogo(match.homeTeamName || match.homeTeamId)}" class="scoreboard-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div class="scoreboard-info">
                <div class="scoreboard-team-name">${match.homeTeamName}</div>
                <div class="scoreboard-team-points">${homeTab ? homeTab.totalScore + ' punti' : ''}</div>
              </div>
            </div>

            <div class="scoreboard-middle">
              <div class="scoreboard-score">
                ${match.played ? `${match.homeGoals} - ${match.awayGoals}` : 'vs'}
              </div>
              <span class="badge ${match.played ? 'badge-success' : 'badge-warning'}">
                ${match.played ? 'Risultato Finale' : 'Da Disputare'}
              </span>
            </div>

            <div class="scoreboard-team scoreboard-away">
              <div class="scoreboard-info">
                <div class="scoreboard-team-name">${match.awayTeamName}</div>
                <div class="scoreboard-team-points">${awayTab ? awayTab.totalScore + ' punti' : ''}</div>
              </div>
              <img src="${fcmDataLoader.getTeamLogo(match.awayTeamName || match.awayTeamId)}" class="scoreboard-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
            </div>
          </div>

          <!-- 2. Mostra le tabelle dei giocatori SOLO se l'incontro è disputato -->
          ${isPlayed ? `
            <div class="tabellino-container ${this.isCompactView ? 'is-compact-mode' : ''}">
              ${renderTeamScorecard(homeTab, match.homeTeamName, match.homeTeamId, false)}
              ${renderTeamScorecard(awayTab, match.awayTeamName, match.awayTeamId, true)}
            </div>
          ` : ''}
        </div>
      `;
    };

    // Determina quali incontri mostrare (singolo incontro o tutti gli incontri della giornata)
    const matchesToRender = this.currentMatchId === 0
      ? dayMatches
      : dayMatches.filter(m => m.id === this.currentMatchId);

    const firstMatch = dayMatches[0];

    let html = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 4h20v12H2z"></path>
                <path d="M7 4v6h10V4"></path>
                <path d="M9.5 4v3h5V4"></path>
                <circle cx="12" cy="13" r="0.8"></circle>
                <path d="M9 16a3 3 0 0 1 6 0"></path>
              </svg>
              Risultati &amp; Tabellini Partite
            </div>
            <div class="card-subtitle">
              ${firstMatch ? `${firstMatch.fantagiornataNome} • ${firstMatch.compName}` : ''}
            </div>
          </div>
        </div>

        <!-- Controls Bar: Competition, Matchday, Match Selectors & Compact Toggle Button -->
        <div class="risultati-controls-bar" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:24px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);box-sizing:border-box;max-width:100%;overflow:hidden;">
          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;max-width:100%;box-sizing:border-box;">
            <label for="selRisultatiComp" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Competizione:
            </label>
            <select id="selRisultatiComp" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
              <option value="0" ${this.currentCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
              ${comps.map(c => `
                <option value="${c.id}" ${c.id === this.currentCompId ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;max-width:100%;box-sizing:border-box;">
            <label for="selRisultatiDay" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Giornata di Serie A:
            </label>
            <select id="selRisultatiDay" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
              ${calendar.matchdays.map(m => `
                <option value="${m.serieADay}" ${m.serieADay === this.currentSerieADay ? 'selected' : ''}>
                  ${m.serieADay}ª di Serie A ${m.played ? '(✓ Disputata)' : '(Da Giocare)'}
                </option>
              `).join('')}
            </select>
          </div>

          ${dayMatches.length > 0 ? `
            <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1.5;min-width:240px;max-width:100%;box-sizing:border-box;">
              <label for="selRisultatiMatch" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                Incontro da Visualizzare:
              </label>
              <select id="selRisultatiMatch" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
                <option value="0" ${this.currentMatchId === 0 ? 'selected' : ''}>
                  Tutti gli incontri (${dayMatches.length})
                </option>
                ${dayMatches.map(m => `
                  <option value="${m.id}" ${m.id === this.currentMatchId ? 'selected' : ''}>
                    ${m.homeTeamName} ${m.played ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'} ${m.awayTeamName} (${m.compName})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <!-- Pulsante Vista Compatta / Vista Estesa (Stile Classifica) -->
          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;justify-content:flex-end;margin-left:auto;align-self:flex-end;padding-bottom:2px;max-width:100%;">
            <button type="button" class="classifica-toggle-btn ${this.isCompactView ? 'is-expanded' : ''}" id="btnToggleCompactResults" title="${this.isCompactView ? 'Passa alla vista estesa' : 'Passa alla vista compatta'}">
              <span class="classifica-toggle-text">${this.isCompactView ? 'Vista estesa' : 'Vista compatta'}</span>
              <svg class="classifica-toggle-chevron ${this.isCompactView ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- Render Match Blocks (Tutti gli incontri o singolo incontro) -->
        <div class="matches-list-container">
          ${matchesToRender.length > 0 ? `
            ${matchesToRender.map(m => renderSingleMatchBlock(m)).join('')}
          ` : `
            <div class="text-center w-full" style="padding:40px;color:var(--text-muted);">
              Nessun incontro disponibile per i filtri selezionati.
            </div>
          `}
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Attach compact view toggle
    const btnToggleCompact = container.querySelector('#btnToggleCompactResults');
    if (btnToggleCompact) {
      btnToggleCompact.addEventListener('click', () => {
        this.isCompactView = !this.isCompactView;
        this.render(container);
      });
    }

    // Attach competition select change
    const compSelect = container.querySelector('#selRisultatiComp');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value);
        this.currentMatchId = 0;
        const newHash = `#risultati?day=${this.currentSerieADay}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }

    // Attach day select change
    const daySelect = container.querySelector('#selRisultatiDay');
    if (daySelect) {
      daySelect.addEventListener('change', (e) => {
        this.currentSerieADay = parseInt(e.target.value);
        this.currentMatchId = 0;
        const newHash = `#risultati?day=${this.currentSerieADay}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }

    // Attach match select change
    const matchSelect = container.querySelector('#selRisultatiMatch');
    if (matchSelect) {
      matchSelect.addEventListener('change', (e) => {
        this.currentMatchId = parseInt(e.target.value);
        const matchParam = this.currentMatchId > 0 ? `&match=${this.currentMatchId}` : '';
        const compParam = this.currentCompId > 0 ? `&comp=${this.currentCompId}` : '';
        const newHash = `#risultati?day=${this.currentSerieADay}${matchParam}${compParam}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }
  }
};
