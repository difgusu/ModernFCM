/**
 * FORMAZIONI VIEW
 * Team lineups per matchday with tactical field and bench list
 * ModernFCM
 */

const formazioniView = {
  currentSerieADay: null,
  currentMatchId: null,
  currentCompId: 0,
  lastLoadedHash: null,

  async render(container) {
    const calendar = fcmDataLoader.getCalendarData();
    const teams = fcmDataLoader.getTeams();
    const comps = fcmDataLoader.getCompetitions();

    // Check URL parameters for day and match (e.g. #formazioni?day=38&match=152)
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
          if (!isNaN(mId) && mId > 0) {
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
      // Di default dev'essere mostrata la prossima giornata da giocare
      this.currentSerieADay = calendar.nextMatchday > 0 
        ? calendar.nextMatchday 
        : (calendar.lastPlayed > 0 ? calendar.lastPlayed : (calendar.matchdays[0] ? calendar.matchdays[0].serieADay : 1));
    }

    if (calendar.matchdays.length > 0 && !calendar.matchdays.some(m => m.serieADay === this.currentSerieADay)) {
      this.currentSerieADay = calendar.nextMatchday > 0 
        ? calendar.nextMatchday 
        : calendar.matchdays[0].serieADay;
    }

    // Find matches for the selected matchday & optional competition
    let dayMatches = calendar.matches.filter(m => m.serieADay === this.currentSerieADay);
    if (this.currentCompId > 0) {
      dayMatches = dayMatches.filter(m => m.compId === this.currentCompId);
    }
    if ((!this.currentMatchId || !dayMatches.some(m => m.id === this.currentMatchId)) && dayMatches.length > 0) {
      this.currentMatchId = dayMatches[0].id;
    }

    const selectedMatch = dayMatches.find(m => m.id === this.currentMatchId) || dayMatches[0];
    if (selectedMatch && this.currentMatchId !== selectedMatch.id) {
      this.currentMatchId = selectedMatch.id;
    }

    if (window.location.hash.includes('?') && window.history && window.history.replaceState && selectedMatch) {
      const synchedHash = `#formazioni?day=${this.currentSerieADay}&match=${this.currentMatchId}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
      if (window.location.hash !== synchedHash) {
        window.history.replaceState(null, '', synchedHash);
        this.lastLoadedHash = synchedHash;
      }
    }

    // Show loading state while fetching lineup data
    container.innerHTML = `
      <div class="card text-center" style="padding:40px;">
        <div style="font-size:1.1rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Caricamento Formazioni...</div>
        <div style="color:var(--text-muted);font-size:0.85rem;">Giornata ${this.currentSerieADay} di Serie A</div>
      </div>
    `;

    // Load lineups dynamically
    const allLineups = await fcmDataLoader.loadMatchdayLineups(this.currentSerieADay);

    // Filter lineups for the selected match
    const matchLineups = allLineups.filter(z => z.matchId === selectedMatch?.id);

    // Group by team
    const homeLineup = matchLineups.filter(z => z.teamId === selectedMatch?.homeTeamId);
    const awayLineup = matchLineups.filter(z => z.teamId === selectedMatch?.awayTeamId);

    const renderTeamLineup = (lineup, teamName, teamId) => {
      const starters = (lineup || []).filter(z => z.position === 0);
      const bench = (lineup || []).filter(z => z.position > 0).sort((a, b) => a.position - b.position);
      const tribuna = (lineup || []).filter(z => z.position === -1);
      const penaltyTakers = (lineup || []).filter(z => z.penaltyTaker > 0).sort((a, b) => a.penaltyTaker - b.penaltyTaker);

      // Check if lineup is submitted / has starters
      const hasLineup = starters.length > 0;

      if (!hasLineup) {
        return `
          <div class="card" style="flex:1;min-width:280px;display:flex;flex-direction:column;">
            <div class="card-header">
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${fcmDataLoader.getTeamLogo(teamName || teamId)}" style="width:32px;height:32px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                <div>
                  <div style="font-size:1rem;font-weight:800;color:var(--text-primary);">${teamName}</div>
                  <div style="font-size:0.75rem;color:var(--accent-gold);font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>
                    In attesa di inserimento
                  </div>
                </div>
              </div>
            </div>

            <div class="formazione-missing-card">
              <div class="formazione-missing-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div class="formazione-missing-title">Formazione non ancora inserita</div>
              <div class="formazione-missing-desc">
                La formazione di <strong style="color:var(--text-primary);">${teamName}</strong> non è stata ancora comunicata o inserita per questo incontro.
              </div>
              <div class="formazione-missing-badge">
                <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>
                Non inserita
              </div>
            </div>
          </div>
        `;
      }

      // Starters grouped by role
      const p = starters.filter(z => z.role === 1);
      const d = starters.filter(z => z.role === 2);
      const c = starters.filter(z => z.role === 3);
      const a = starters.filter(z => z.role === 4);
      const modulo = `${d.length}-${c.length}-${a.length}`;

      const renderPitchRoleLine = (players, roleClass, roleLetter, isLast = false) => {
        const count = players.length;
        const isStaggered = count >= 5;
        return `
          <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}" ${isLast ? 'style="margin-bottom:0;"' : ''}>
            ${players.map((pl, idx) => {
              const isWing = isStaggered && (idx === 0 || idx === count - 1);
              const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
              const { surname, firstName } = fcmDataLoader.splitPlayerName(pl.name);
              const isLongSurname = surname.length >= 10 || surname.includes('-') || (surname.includes(' ') && surname.length >= 8);
              const pId = pl.playerId || fcmDataLoader.getSerieAPlayerId(pl.name);
              const playerLink = pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(pl.name)}`;
              return `
                <a href="${playerLink}" class="pitch-player ${wingClass} ${isLongSurname ? 'has-long-surname' : ''}" data-player="${pl.name}" tabindex="0" title="Apri scheda di ${pl.name}">
                  <div class="pitch-player-avatar">
                    <img src="${fcmDataLoader.getPlayerPhoto(pl.name)}" class="pitch-player-photo" alt="${pl.name}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif'" />
                    <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  </div>
                  <div class="pitch-player-name ${isLongSurname ? 'is-long-surname' : ''}">
                    <span class="pitch-player-surname">${surname}</span>
                    ${firstName ? `<span class="pitch-player-firstname">${firstName}</span>` : ''}
                  </div>
                  <div class="pitch-player-club">
                    ${pl.serieATeam ? `<img src="${fcmDataLoader.getSerieAShirt(pl.serieATeam)}" class="pr-maglia" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;display:inline-block;" onerror="this.style.display='none'" />` : ''}
                    <span>${pl.serieATeam || ''}</span>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        `;
      };

      return `
        <div class="card" style="flex:1;min-width:280px;display:flex;flex-direction:column;">
          <div class="card-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${fcmDataLoader.getTeamLogo(teamName || teamId)}" style="width:32px;height:32px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div>
                <div style="font-size:1rem;font-weight:800;color:var(--text-primary);">${teamName}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">Modulo: <b style="color:var(--accent-cyan);">${modulo}</b></div>
              </div>
            </div>
          </div>

          <!-- Pitch Visualization -->
          <div class="pitch-container">
            ${fcmDataLoader.getPitchSvgLines()}
            ${renderPitchRoleLine(p, 'role-p', 'P')}
            ${renderPitchRoleLine(d, 'role-d', 'D')}
            ${renderPitchRoleLine(c, 'role-c', 'C')}
            ${renderPitchRoleLine(a, 'role-a', 'A', true)}
          </div>

          <!-- Panchina List -->
          ${bench.length > 0 ? `
            <div style="margin-bottom:16px;">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Panchina (${bench.length})</div>
              <div class="table-responsive">
                <table class="modern-table bench-table">
                  <tbody>
                    ${bench.map(pl => {
                      const pId = pl.playerId || fcmDataLoader.getSerieAPlayerId(pl.name);
                      const playerLink = pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(pl.name)}`;
                      return `
                      <tr style="opacity:0.9;">
                        <td style="width:24px;color:var(--text-muted);font-weight:bold;text-align:center;">${pl.position}</td>
                        <td style="width:30px;"><span class="role-badge ${fcmDataLoader.getRoleClass(pl.role)}">${fcmDataLoader.getRoleShort(pl.role)}</span></td>
                        <td style="width:28px;padding-right:4px;">
                          <a href="${playerLink}" class="bench-player-photo-link" title="Apri scheda di ${pl.name}">
                            <img src="${fcmDataLoader.getPlayerPhoto(pl.name)}" class="bench-player-photo" alt="${pl.name}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif'" />
                          </a>
                        </td>
                        <td class="bench-player-cell">
                          <div class="bench-player-name">
                            <a href="${playerLink}" class="bench-player-link" title="Apri scheda di ${pl.name}">${pl.name}</a>
                          </div>
                          <div class="bench-player-club">
                            ${pl.serieATeam ? `<img src="${fcmDataLoader.getSerieAShirt(pl.serieATeam)}" class="pr-maglia bench-shirt-img" onerror="this.style.display='none'" />` : ''}
                            <span>${pl.serieATeam || ''}</span>
                          </div>
                        </td>
                      </tr>
                    `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Rigoristi -->
          ${penaltyTakers.length > 0 ? `
            <div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);font-size:0.75rem;">
              <b style="color:var(--accent-gold);">Rigoristi:</b> ${penaltyTakers.map(r => `${r.penaltyTaker}° ${r.name}`).join(' • ')}
            </div>
          ` : ''}

        </div>
      `;
    };

    let html = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="4"></rect>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
              </svg>
              Formazioni
            </div>
            <div class="card-subtitle">
              ${selectedMatch ? `${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName} • ${selectedMatch.fantagiornataNome}` : ''}
            </div>
          </div>
        </div>

        <!-- Controls Bar: Competition & Matchday Selectors -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;">
            <label for="selFormazioniComp" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Competizione:
            </label>
            <select id="selFormazioniComp" class="form-select" style="font-weight:700;">
              <option value="0" ${this.currentCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
              ${comps.map(c => `
                <option value="${c.id}" ${c.id === this.currentCompId ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;">
            <label for="selFormazioniDay" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Giornata di Serie A:
            </label>
            <select id="selFormazioniDay" class="form-select" style="font-weight:700;">
              ${calendar.matchdays.map(m => `
                <option value="${m.serieADay}" ${m.serieADay === this.currentSerieADay ? 'selected' : ''}>
                  ${m.serieADay}ª di Serie A ${m.played ? '(✓ Disputata)' : '(Da Giocare)'}
                </option>
              `).join('')}
            </select>
          </div>

          ${dayMatches.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:4px;flex:1.5;min-width:240px;">
              <label for="selFormazioniMatch" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                Incontro:
              </label>
              <select id="selFormazioniMatch" class="form-select" style="font-weight:700;">
                ${dayMatches.map(m => `
                  <option value="${m.id}" ${m.id === this.currentMatchId ? 'selected' : ''}>
                    ${m.homeTeamName} vs ${m.awayTeamName} (${m.compName})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Dual Team Lineups Display -->
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          ${selectedMatch && matchLineups.length > 0 ? `
            ${renderTeamLineup(homeLineup, selectedMatch.homeTeamName, selectedMatch.homeTeamId)}
            ${renderTeamLineup(awayLineup, selectedMatch.awayTeamName, selectedMatch.awayTeamId)}
          ` : `
            <div class="card text-center w-full" style="padding:40px;color:var(--text-muted);width:100%;">
              Nessuna formazione comunicata o disponibile per questo incontro.
            </div>
          `}
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Attach competition select change
    const compSelect = container.querySelector('#selFormazioniComp');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value);
        this.currentMatchId = null;
        const newHash = `#formazioni?day=${this.currentSerieADay}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }

    // Attach matchday select change
    const daySelect = container.querySelector('#selFormazioniDay');
    if (daySelect) {
      daySelect.addEventListener('change', (e) => {
        this.currentSerieADay = parseInt(e.target.value);
        this.currentMatchId = null;
        const newHash = `#formazioni?day=${this.currentSerieADay}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }

    // Attach match select change
    const matchSelect = container.querySelector('#selFormazioniMatch');
    if (matchSelect) {
      matchSelect.addEventListener('change', (e) => {
        this.currentMatchId = parseInt(e.target.value);
        const newHash = `#formazioni?day=${this.currentSerieADay}&match=${this.currentMatchId}${this.currentCompId ? `&comp=${this.currentCompId}` : ''}`;
        this.lastLoadedHash = newHash;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', newHash);
        }
        this.render(container);
      });
    }

  }
};
