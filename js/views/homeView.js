/**
 * HOME VIEW (DASHBOARD)
 * ModernFCM
 */

const homeView = {
  countdownInterval: null,
  anticipoInterval: null,
  newsInterval: null,

  /**
   * Format girone name without forcing ALL-CAPS (e.g. "GIRONE A" -> "Girone A")
   */
  formatGironeName(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      return trimmed.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
    }
    return trimmed;
  },

  /**
   * Helper to build hierarchical grouping inside a matchday block:
   * Competition -> Girone -> Matches
   */
  buildMatchdayHierarchy(matches, comps) {
    const compMap = new Map();
    matches.forEach(m => {
      const cId = (m.compId !== undefined && m.compId !== null && m.compId !== 0)
        ? m.compId
        : (m.competizione || m.compName || m.nomeCompetizione || 'comp_0');
      const compObjFromData = comps ? comps.find(c => c.id === cId) : null;
      const cName = m.compName || m.nomeCompetizione || (compObjFromData ? compObjFromData.name : 'Competizione');
      const fName = m.fantagiornataNome || m.fantaGiornata || '';

      if (!compMap.has(cId)) {
        compMap.set(cId, { id: cId, name: cName, fantaGiornata: fName, gironeMap: new Map() });
      }
      const compObj = compMap.get(cId);
      if (!compObj.fantaGiornata && fName) {
        compObj.fantaGiornata = fName;
      }

      const gId = (m.groupId !== undefined && m.groupId !== null && m.groupId !== 0)
        ? m.groupId
        : (m.groupName || 'girone_0');
      const gName = this.formatGironeName(m.groupName || '');
      if (!compObj.gironeMap.has(gId)) {
        compObj.gironeMap.set(gId, { id: gId, name: gName, matches: [] });
      }
      compObj.gironeMap.get(gId).matches.push(m);
    });

    return Array.from(compMap.values()).map(c => ({
      id: c.id,
      name: c.name,
      fantaGiornata: c.fantaGiornata,
      gironi: Array.from(c.gironeMap.values())
    }));
  },

  async render(container) {
    const info = fcmDataLoader.getLeagueInfo();
    const calendar = fcmDataLoader.getCalendarData();
    const top11 = fcmDataLoader.getTop11();
    const comps = fcmDataLoader.getCompetitions();
    const mainComp = comps.find(c => c.isDefault) || comps.find(c => c.id === 1) || comps[0];
    const mainCompName = mainComp ? mainComp.name : 'Lega';
    const mainGroupId = mainComp ? (mainComp.defaultGroupId || (mainComp.groups && mainComp.groups[0] ? mainComp.groups[0].ID : 1) || 1) : 1;
    const standings = fcmDataLoader.getStandings(mainGroupId);
    const gpStandings = fcmDataLoader.getGPStandings(mainGroupId);

    // Load disabilitaGiornata from fcmInvioFormazioneDati.js if not yet defined
    if (typeof disabilitaGiornata === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmInvioFormazioneDati.js');
      } catch (e) { }
    }

    // Load DataA.js if not yet defined
    if (typeof dataGiornata === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/DataA.js');
      } catch (e) { }
    }

    // Load match schedule and deadlines directly from invform/invform.inc.php
    const schedule = await fcmDataLoader.loadMatchSchedule(calendar.nextMatchday);

    // Carica gli orari dello schedule per la giornata corrente di calendario
    const nextMatchSchedule = schedule[calendar.nextMatchday] || fcmDataLoader.getMatchScheduleForDay(calendar.nextMatchday);

    // Determine if matchday is in progress (deadline has expired)
    let isMatchdayInProgress = false;
    let targetDeadline = null;
    let matchStartTime = null;
    let targetAnticipo = nextMatchSchedule ? nextMatchSchedule.anticipoInvio : null;

    if (nextMatchSchedule) {
      targetDeadline = nextMatchSchedule.dataOraTermine;
      matchStartTime = nextMatchSchedule.dataOraInizio;
      if (targetDeadline && targetDeadline.getTime() <= Date.now()) {
        isMatchdayInProgress = true;
      }
    }

    if (!targetDeadline && typeof termineInvio !== 'undefined' && termineInvio && termineInvio !== false) {
      if (termineInvio.secondiRimasti !== undefined && termineInvio.secondiRimasti <= 0) {
        isMatchdayInProgress = true;
      }
      if (termineInvio.dataOraTermine) {
        targetDeadline = new Date(termineInvio.dataOraTermine);
        if (targetDeadline.getTime() <= Date.now()) {
          isMatchdayInProgress = true;
        }
      }
      if (termineInvio.dataOraInizio) {
        matchStartTime = new Date(termineInvio.dataOraInizio);
      }
      if (termineInvio.anticipoInvio !== undefined && termineInvio.anticipoInvio !== null) {
        targetAnticipo = parseInt(termineInvio.anticipoInvio, 10);
      }
    } else if (!targetDeadline) {
      if (calendar.lastPlayed >= calendar.nextMatchday && calendar.lastPlayed > 0) {
        isMatchdayInProgress = true;
      }
    }

    if (targetAnticipo === null || targetAnticipo === undefined) {
      targetAnticipo = fcmDataLoader.getAnticipoInvio(calendar.nextMatchday);
    }

    // Pre-load lineups for nextMatchday with cache-busting so lineupCheck & mini formations have accurate arrFormazioni data!
    let inProgressFormations = [];
    try {
      inProgressFormations = await fcmDataLoader.loadMatchdayLineups(calendar.nextMatchday, true);
    } catch (e) {
      console.warn('Errore nel caricamento formazioni giornata attiva:', e);
    }

    const lineupCheck = fcmDataLoader.getLineupCheckData(calendar.nextMatchday); // Check formazioni

    // When disabilitaGiornata is 0 in fcmInvioFormazioneDati.js, future lineup submission is allowed
    const allowFutureLineups = (typeof disabilitaGiornata !== 'undefined' && parseInt(disabilitaGiornata, 10) === 0);

    const maxLimit = (typeof MaxA !== 'undefined' && MaxA > 0) ? MaxA : 38;
    let nextSubmittableDay = calendar.nextMatchday;
    if (isMatchdayInProgress && nextSubmittableDay < maxLimit) {
      nextSubmittableDay = calendar.nextMatchday + 1;
    }
    const submittableSchedule = schedule[nextSubmittableDay] || fcmDataLoader.getMatchScheduleForDay(nextSubmittableDay);
    const submittableDeadline = submittableSchedule ? submittableSchedule.dataOraTermine : null;
    const submittableStartTime = submittableSchedule ? submittableSchedule.dataOraInizio : null;
    const submittableAnticipo = (submittableSchedule && submittableSchedule.anticipoInvio !== undefined && submittableSchedule.anticipoInvio !== null)
      ? submittableSchedule.anticipoInvio
      : fcmDataLoader.getAnticipoInvio(nextSubmittableDay);

    // Categorize top11 by role for tactical pitch
    const aPlayers = top11.filter(p => p.role === 'A');
    const cPlayers = top11.filter(p => p.role === 'C');
    const dPlayers = top11.filter(p => p.role === 'D');
    const pPlayers = top11.filter(p => p.role === 'P');

    // Find matches of the last played matchday
    const lastDayMatches = calendar.matches.filter(m => m.serieADay === calendar.lastPlayed);
    // Find matches of the next matchday (excluding rest matches)
    const nextDayMatches = calendar.matches.filter(m => m.serieADay === calendar.nextMatchday && !m.isRiposo && m.homeTeamId > 0);

    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
    const isGuestbookEnabled = typeof fcmModules !== 'undefined' ? fcmModules.hasGuestbook() : true;
    const guestbookBlock = isGuestbookEnabled ? `
      <div class="card guestbook-preview-card" id="guestbookPreview">
        <div class="card-header">
          <div class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Guestbook di Lega
          </div>
          <a href="#gbook" class="badge badge-success">Apri tutto &rarr;</a>
        </div>
        <div class="guestbook-preview-content">
          <div class="guestbook-preview-controls" aria-label="Scorri anteprima guestbook">
            <button type="button" class="icon-btn guestbook-arrow" id="guestbookPrev" aria-label="Post precedente" title="Post precedente">&#8592;</button>
            <span class="guestbook-counter" id="guestbookCounter">-- / --</span>
            <button type="button" class="icon-btn guestbook-arrow" id="guestbookNext" aria-label="Post successivo" title="Post successivo">&#8594;</button>
          </div>
          <div class="guestbook-post" id="guestbookPost">
            <div class="guestbook-post-author">Caricamento guestbook...</div>
          </div>
          <a href="#gbook" class="guestbook-open-link">Scrivi o visualizza tutti i post &rarr;</a>
        </div>
      </div>
    ` : '';
    const sponsorsBlock = info.sponsors.length ? `
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                  <path d="M5 14l3-3"></path>
                  <path d="M19 10l-3 3"></path>
                  <path d="M8 11l2-2a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-1.5 1.5"></path>
                  <path d="M16 13l-2 2a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8l1.5-1.5"></path>
                </svg>
                Sponsor Ufficiali
              </div>
            </div>
            ${info.sponsors.some(sponsor => sponsor.logo) ? `
              <div class="sponsors-strip">
                ${info.sponsors.map(sponsor => sponsor.logo ? `
                  ${sponsor.link ? `<a href="${escapeHtml(sponsor.link)}" target="_blank" rel="noopener noreferrer">` : '<span>'}
                    <img src="${escapeHtml(sponsor.logo)}" class="sponsor-logo" alt="${escapeHtml(sponsor.title || 'Sponsor')}" />
                  ${sponsor.link ? '</a>' : '</span>'}
                ` : '').join('')}
              </div>
            ` : ''}
            ${info.sponsors.some(sponsor => !sponsor.logo) ? `
              <div class="sponsor-links">
                ${info.sponsors.filter(sponsor => !sponsor.logo).map(sponsor => sponsor.link
      ? `<a href="${escapeHtml(sponsor.link)}" target="_blank" rel="noopener noreferrer" class="sponsor-link">${escapeHtml(sponsor.title || sponsor.link)}</a>`
      : `<span class="sponsor-link">${escapeHtml(sponsor.title)}</span>`
    ).join('')}
              </div>
            ` : ''}
          </div>
        ` : '';

    const currentTheme = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme')) || (typeof localStorage !== 'undefined' && localStorage.getItem('pn_theme')) || 'light';

    const counterBlock = `
      <div class="card visitor-counter-card">
        <div class="card-header">
          <div class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Visitatori del Sito
          </div>
          <a href="#stats" class="badge badge-primary" title="Apri statistiche dettagliate fanKounter">Statistiche &rarr;</a>
        </div>
        <div class="visitor-counter-badge-wrap">
          <a href="#stats" title="fanKounter: visualizza grafici e statistiche complete">
            <img id="visitorCounterImg" src="fkounter5/counter.php?id=index&mode=graphic&theme=${currentTheme}&_t=${Date.now()}" width="98" height="38" alt="fanKounter" class="visitor-counter-img" />
          </a>
        </div>
      </div>
    `;

    // -------------------------------------------------------------
    // BLOCCHI HTML RIUTILIZZABILI PER LA COLONNA PRINCIPALE
    // -------------------------------------------------------------

    // 1. Risultati dell'ultima giornata
    const lastDaySerieADay = lastDayMatches.length > 0 ? (lastDayMatches[0].serieADay || calendar.lastPlayed) : calendar.lastPlayed;
    const lastDayDateStr = fcmDataLoader.getDataGiornataA(lastDaySerieADay);
    const lastDayFantaNome = lastDayMatches.length > 0 ? lastDayMatches[0].fantagiornataNome : 'Ultimo Turno';

    const lastDayCompHierarchy = this.buildMatchdayHierarchy(lastDayMatches, comps);

    const resultsBlock = `
      <div class="card">
        <div class="card-header" style="align-items:flex-start;">
          <div>
            <div class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 14 14"></polyline>
              </svg>
              Risultati ${lastDaySerieADay > 0 ? ` • ${lastDaySerieADay}ª Serie A` : ''}
            </div>
            ${lastDayDateStr ? `
              <div class="card-subtitle-date" style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;margin-left:28px;display:flex;align-items:center;gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 14 14"></polyline>
                </svg>
                <span>${lastDayDateStr}</span>
              </div>
            ` : ''}
          </div>
          <a href="#risultati" class="badge badge-primary">Tabellini Completi &rarr;</a>
        </div>

        <div class="matchday-content-vertical">
          ${lastDayCompHierarchy.map(comp => `
            <div class="comp-group-block">
              <div class="comp-group-header">
                <div class="comp-header-title">
                  <span>${comp.name}</span>
                </div>
                ${comp.fantaGiornata ? `<span class="comp-fanta-giornata">${comp.fantaGiornata}</span>` : ''}
              </div>
              ${comp.gironi.map(girone => `
                <div class="girone-group-block">
                  ${girone.name && girone.name !== comp.name ? `
                    <div class="girone-group-header">${this.formatGironeName(girone.name)}</div>
                  ` : ''}
                  <div class="girone-matches-list">
                    ${girone.matches.map(m => `
                      <a href="#risultati?day=${m.serieADay}&match=${m.id}" class="match-card match-card-clickable compact-match-card" style="text-decoration:none;color:inherit;cursor:pointer;display:block;">
                        <div class="match-teams-row">
                          <div class="match-team home">
                            <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <div class="team-info-wrap">
                              <span class="team-name-text" title="${m.homeTeamName}">${m.homeTeamName}</span>
                              ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
                            </div>
                          </div>
                          <div class="match-score-pill">
                            <div class="score-digits">${m.homeGoals} - ${m.awayGoals}</div>
                            <div class="score-totals">${m.homeTotal} - ${m.awayTotal}</div>
                          </div>
                          <div class="match-team away">
                            <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <div class="team-info-wrap">
                              <span class="team-name-text" title="${m.awayTeamName}">${m.awayTeamName}</span>
                              ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
                            </div>
                          </div>
                        </div>
                      </a>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const targetAntLabel = `(-${targetAnticipo}m)`;
    const nextDayDateStr = fcmDataLoader.getDataGiornataA(calendar.nextMatchday);
    const initialDeadlineText = (matchStartTime && targetDeadline)
      ? `⚽ Inizio Partite: <strong>${matchStartTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ore ${matchStartTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> &bull; Scadenza Invio: <strong>${targetDeadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> ${targetAntLabel}`
      : (nextDayDateStr
        ? `⚽ Inizio Partite: <strong>${nextDayDateStr}</strong>`
        : 'Caricamento scadenze...');

    // 2. Countdown & Invio Formazione Standard (quando matchday NON in corso)
    const countdownBlock = `
      <div class="countdown-box" id="homeCountdownBox">
        <div class="countdown-header">⏱ Prossimo Turno • Giornata ${calendar.nextMatchday} di Serie A</div>
        <div class="cd-timer" id="cdTimerContainer">
          <div class="cd-unit">
            <div class="cd-digit" id="cdDays">--</div>
            <div class="cd-label">Giorni</div>
          </div>
          <div class="cd-separator">:</div>
          <div class="cd-unit">
            <div class="cd-digit" id="cdHours">--</div>
            <div class="cd-label">Ore</div>
          </div>
          <div class="cd-separator">:</div>
          <div class="cd-unit">
            <div class="cd-digit" id="cdMinutes">--</div>
            <div class="cd-label">Minuti</div>
          </div>
          <div class="cd-separator">:</div>
          <div class="cd-unit">
            <div class="cd-digit" id="cdSeconds">--</div>
            <div class="cd-label">Secondi</div>
          </div>
        </div>
        <div class="cd-deadline-text" id="cdDeadlineText">${initialDeadlineText}</div>
        
        ${(typeof fcmModules === 'undefined' || fcmModules.hasInvioFormazione()) ? `
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="#invform?Gio=${nextSubmittableDay}" class="btn-invio-form" style="margin-top:0;">
            📋 Invia Formazione &rarr;
          </a>
        </div>` : ''}
      </div>
    `;

    // 3. Top 11 dell'ultima giornata (se modulo Fantamister abilitato)
    const isFantamisterEnabled = typeof fcmModules !== 'undefined' ? fcmModules.hasFantamister() : true;
    const top11Block = (isFantamisterEnabled && top11.length > 0) ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Top 11 • ${calendar.lastPlayed}ª Serie A
          </div>
          <a href="#fantam" class="badge badge-primary">Fantamister &rarr;</a>
        </div>

        <!-- Tactical Pitch Layout (Invertito verticalmente: Portiere in alto, Attaccanti in basso) -->
        <div class="pitch-container" style="margin-bottom:0;">
          ${fcmDataLoader.getPitchSvgLines()}
          <!-- Portiere -->
          <div class="pitch-line">
            ${pPlayers.map(p => `
              <div class="pitch-player">
                <div class="pitch-player-shirt role-p">P</div>
                <div class="pitch-player-name" style="color:#ffffff;font-weight:700;font-size:0.75rem;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${p.surname || p.player}</div>
                <div class="pitch-player-club" style="color:rgba(255,255,255,0.85);font-size:0.65rem;">${p.fantasyTeam}</div>
                <div style="display:inline-block;background:var(--accent-gold);color:#000;font-weight:800;font-size:0.7rem;padding:1px 6px;border-radius:4px;margin-top:2px;box-shadow:0 1px 2px rgba(0,0,0,0.4);">${p.vote}</div>
              </div>
            `).join('')}
          </div>

          <!-- Difensori -->
          <div class="pitch-line">
            ${dPlayers.map(p => `
              <div class="pitch-player">
                <div class="pitch-player-shirt role-d">D</div>
                <div class="pitch-player-name" style="color:#ffffff;font-weight:700;font-size:0.75rem;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${p.surname || p.player}</div>
                <div class="pitch-player-club" style="color:rgba(255,255,255,0.85);font-size:0.65rem;">${p.fantasyTeam}</div>
                <div style="display:inline-block;background:var(--accent-gold);color:#000;font-weight:800;font-size:0.7rem;padding:1px 6px;border-radius:4px;margin-top:2px;box-shadow:0 1px 2px rgba(0,0,0,0.4);">${p.vote}</div>
              </div>
            `).join('')}
          </div>

          <!-- Centrocampisti -->
          <div class="pitch-line">
            ${cPlayers.map(p => `
              <div class="pitch-player">
                <div class="pitch-player-shirt role-c">C</div>
                <div class="pitch-player-name" style="color:#ffffff;font-weight:700;font-size:0.75rem;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${p.surname || p.player}</div>
                <div class="pitch-player-club" style="color:rgba(255,255,255,0.85);font-size:0.65rem;">${p.fantasyTeam}</div>
                <div style="display:inline-block;background:var(--accent-gold);color:#000;font-weight:800;font-size:0.7rem;padding:1px 6px;border-radius:4px;margin-top:2px;box-shadow:0 1px 2px rgba(0,0,0,0.4);">${p.vote}</div>
              </div>
            `).join('')}
          </div>

          <!-- Attaccanti -->
          <div class="pitch-line">
            ${aPlayers.map(p => `
              <div class="pitch-player">
                <div class="pitch-player-shirt role-a">A</div>
                <div class="pitch-player-name" style="color:#ffffff;font-weight:700;font-size:0.75rem;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${p.surname || p.player}</div>
                <div class="pitch-player-club" style="color:rgba(255,255,255,0.85);font-size:0.65rem;">${p.fantasyTeam}</div>
                <div style="display:inline-block;background:var(--accent-gold);color:#000;font-weight:800;font-size:0.7rem;padding:1px 6px;border-radius:4px;margin-top:2px;box-shadow:0 1px 2px rgba(0,0,0,0.4);">${p.vote}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : '';

    // 4. Widget Live Hero Card (quando matchday IN CORSO)
    const hasliveFP = typeof fcmModules !== 'undefined' ? fcmModules.hasliveFP() : true;
    const hasLiveFM = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveFM() : true;
    const hasLiveVU = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveVU() : true;

    let liveTitle = 'Live &amp; Voti della Giornata';
    const liveNames = [];
    if (hasliveFP) liveNames.push('Fantapazz');
    if (hasLiveFM) liveNames.push('FantaMaster');
    if (hasLiveVU) liveNames.push('Voti Ufficiosi');
    if (liveNames.length > 0) {
      liveTitle = 'Live ' + liveNames.join(' &amp; ');
    }

    const liveHeroBlock = `
      <div class="card live-hero-card" style="border:1px solid rgba(239,68,68,0.35);background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(37,99,235,0.08));margin-bottom:20px;padding:18px;">
        <div class="card-header" style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);">
          <div class="card-title" style="color:var(--accent-rose);font-size:1.05rem;display:flex;align-items:center;gap:8px;">
            <span class="card-live-dot"></span>
            Giornata in Corso • ${liveTitle}
          </div>
          <span class="badge badge-danger">Live Match</span>
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.5;">
          Il termine per l'invio delle formazioni è scaduto. Segui la giornata in tempo reale con i voti live, le pagelle e il calcolo manuale dei risultati:
        </p>
        <div class="live-links-grid live-hero-grid">
          ${hasliveFP ? `
          <a href="#liveFP" class="live-link-card">
            <img src="img/live/logo-fp.png" alt="Fantapazz" onerror="this.style.display='none'" />
            <span class="live-link-name">Live Fantapazz</span>
            <span class="live-link-sub">Voti live &amp; Bonus</span>
          </a>` : ''}
          ${hasLiveFM ? `
          <a href="#liveFM" class="live-link-card">
            <img src="img/live/logo-fm.png" alt="FantaMaster" onerror="this.style.display='none'" />
            <span class="live-link-name">Live FantaMaster</span>
            <span class="live-link-sub">Diretta API &amp; Voti</span>
          </a>` : ''}
          ${hasLiveVU ? `
          <a href="#liveVU" class="live-link-card">
            <img src="img/live/live_pianeta.png" alt="PianetaFC" onerror="this.style.display='none'" />
            <span class="live-link-name">Voti Ufficiosi</span>
            <span class="live-link-sub">PianetaFantacalcio</span>
          </a>` : ''}
          <a href="#calcolo" class="live-link-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <line x1="8" y1="6" x2="16" y2="6"/>
              <line x1="16" y1="14" x2="16" y2="14.01"/>
              <line x1="12" y1="14" x2="12" y2="14.01"/>
              <line x1="8" y1="14" x2="8" y2="14.01"/>
              <line x1="16" y1="18" x2="16" y2="18.01"/>
              <line x1="12" y1="18" x2="12" y2="18.01"/>
              <line x1="8" y1="18" x2="8" y2="18.01"/>
            </svg>
            <span class="live-link-name">Calcolo Manuale</span>
            <span class="live-link-sub">Simulatore partita</span>
          </a>
        </div>
      </div>
    `;

    // 5. Mini-Formazioni della Giornata in Corso (Ispirato a forpross.js)
    let miniFormationsBlock = '';
    if (isMatchdayInProgress && nextDayMatches.length > 0) {
      const compGroups = {};
      for (const m of nextDayMatches) {
        const comp = m.compName || 'Campionato';
        if (!compGroups[comp]) compGroups[comp] = [];
        compGroups[comp].push(m);
      }

      const roleClass = (r) => {
        if (r === 1 || r === 'P') return 'role-text-p';
        if (r === 2 || r === 'D') return 'role-text-d';
        if (r === 3 || r === 'C') return 'role-text-c';
        if (r === 4 || r === 'A') return 'role-text-a';
        return '';
      };

      const renderTeamCol = (teamName, teamId, pList) => {
        const logo = fcmDataLoader.getTeamLogo(teamName || teamId);
        if (!pList || pList.length < 11) {
          return `
            <div class="mini-for-col">
              <div class="mini-for-team-title">
                <img src="${logo}" class="mini-for-team-logo" alt="${teamName}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                <span>${teamName}</span>
              </div>
              <div class="mini-for-missing">Formazione non inserita</div>
            </div>
          `;
        }
        const starters = pList.filter(p => p.isStarter || p.position === 0);
        const bench = pList.filter(p => !p.isStarter && p.position > 0).sort((a, b) => a.position - b.position);

        const dCount = starters.filter(p => p.role === 2 || p.role === 'D').length;
        const cCount = starters.filter(p => p.role === 3 || p.role === 'C').length;
        const aCount = starters.filter(p => p.role === 4 || p.role === 'A').length;
        const moduleStr = `(${dCount}-${cCount}-${aCount})`;

        const startersHtml = starters.map(p => {
          const sName = fcmDataLoader.extractSurname(p.name);
          return `<span class="mini-for-player ${roleClass(p.role)}">${sName}</span>`;
        }).join(', ');

        const benchHtml = bench.map(p => {
          const sName = fcmDataLoader.extractSurname(p.name);
          return `<span class="mini-for-player ${roleClass(p.role)}">${sName}</span>`;
        }).join(', ');

        return `
          <div class="mini-for-col">
            <div class="mini-for-team-title">
              <img src="${logo}" class="mini-for-team-logo" alt="${teamName}" onerror="this.src='img/logo.png'" />
              <span>${teamName} <small class="mini-for-module">${moduleStr}</small></span>
            </div>
            <div class="mini-for-list starters">
              ${startersHtml}
            </div>
            ${bench.length > 0 ? `
              <div class="mini-for-bench-title">Panchina</div>
              <div class="mini-for-list bench">
                ${benchHtml}
              </div>
            ` : ''}
          </div>
        `;
      };

      miniFormationsBlock = `
        <div class="card mini-for-card" style="margin-bottom:20px;border:1px solid rgba(37,99,235,0.35);">
          <div class="card-header" style="border-bottom:1px solid var(--border-subtle);padding-bottom:10px;margin-bottom:12px;">
            <div class="card-title" style="font-size:1.02rem;color:var(--accent-primary);display:flex;align-items:center;gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="4"></rect>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
              Formazioni Ufficiali • ${calendar.nextMatchday}ª Serie A
            </div>
            <a href="#formazioni" class="badge badge-primary">Formazioni &rarr;</a>
          </div>
          <div class="mini-for-container">
            ${Object.keys(compGroups).map(compName => `
              <div class="mini-for-comp-strip">${compName}</div>
              ${compGroups[compName].map(m => {
        const homePlayers = inProgressFormations.filter(f => (f.matchId === m.id || !f.matchId) && f.teamId === m.homeTeamId);
        const awayPlayers = inProgressFormations.filter(f => (f.matchId === m.id || !f.matchId) && f.teamId === m.awayTeamId);
        return `
                  <div class="mini-for-match-row">
                    ${renderTeamCol(m.homeTeamName, m.homeTeamId, homePlayers)}
                    <div class="mini-for-vs-badge">VS</div>
                    ${renderTeamCol(m.awayTeamName, m.awayTeamId, awayPlayers)}
                  </div>
                `;
      }).join('')}
            `).join('')}
          </div>
        </div>
      `;
    }

    // 6. Anticipo Formazione Prossimo Turno (se abilitato quando giornata in corso)
    const anticipoBlock = `
      <div class="card" style="border:1px solid rgba(16,185,129,0.35);background:linear-gradient(135deg,rgba(16,185,129,0.06),rgba(6,182,212,0.06));margin-bottom:20px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:1rem;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Anticipo Formazione • Prossimo Turno: ${nextSubmittableDay}ª di Serie A
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">
              La ${calendar.nextMatchday}ª giornata è attualmente in corso, ma puoi già inviare in anticipo la formazione per la <strong>${nextSubmittableDay}ª giornata</strong>.
            </div>
          </div>
          ${(typeof fcmModules === 'undefined' || fcmModules.hasInvioFormazione()) ? `
          <a href="#invform?Gio=${nextSubmittableDay}" class="btn-invio-form" style="margin-top:0;">
            Schiera per la ${nextSubmittableDay}ª &rarr;
          </a>` : ''}
        </div>

        <!-- Mini Countdown Box per la giornata successiva -->
        <div class="countdown-box" id="anticipoCountdownBox" style="margin-top:10px;padding:12px 16px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);">
          <div class="cd-timer" style="margin-bottom:6px;">
            <div class="cd-unit">
              <div class="cd-digit" id="cdAntDays" style="font-size:1.2rem;min-width:32px;padding:4px 6px;">--</div>
              <span class="cd-label" style="font-size:0.65rem;">Giorni</span>
            </div>
            <div class="cd-separator" style="font-size:1.1rem;">:</div>
            <div class="cd-unit">
              <div class="cd-digit" id="cdAntHours" style="font-size:1.2rem;min-width:32px;padding:4px 6px;">--</div>
              <span class="cd-label" style="font-size:0.65rem;">Ore</span>
            </div>
            <div class="cd-separator" style="font-size:1.1rem;">:</div>
            <div class="cd-unit">
              <div class="cd-digit" id="cdAntMinutes" style="font-size:1.2rem;min-width:32px;padding:4px 6px;">--</div>
              <span class="cd-label" style="font-size:0.65rem;">Min</span>
            </div>
            <div class="cd-separator" style="font-size:1.1rem;">:</div>
            <div class="cd-unit">
              <div class="cd-digit" id="cdAntSeconds" style="font-size:1.2rem;min-width:32px;padding:4px 6px;">--</div>
              <span class="cd-label" style="font-size:0.65rem;">Sec</span>
            </div>
          </div>
          <div class="cd-deadline-text" id="cdAntDeadlineText" style="font-size:0.8rem;margin-top:4px;">
            ${submittableStartTime ? `⚽ Inizio Partite: <strong>${submittableStartTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ore ${submittableStartTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> &bull; Scadenza Invio: <strong>${submittableDeadline ? submittableDeadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</strong> (-${submittableAnticipo}m)` : 'Caricamento orari prossimo turno...'}
          </div>
        </div>
      </div>
    `;

    // Map status from lineupCheck for fast lookup
    const lineupStatusMap = new Map();
    if (lineupCheck && Array.isArray(lineupCheck.teams)) {
      for (const t of lineupCheck.teams) {
        lineupStatusMap.set(t.teamId, t);
        if (t.teamName) {
          lineupStatusMap.set(t.teamName.toLowerCase().trim(), t);
        }
      }
    }

    const getTeamLineupInfo = (teamId, teamName, match) => {
      let item = lineupStatusMap.get(teamId);
      if (!item && teamName) {
        item = lineupStatusMap.get(teamName.toLowerCase().trim());
      }
      const isRiposo = item ? item.status === 'RIPOSO' : false;
      const isOk = item ? item.status === 'OK' : false;
      if (isRiposo) {
        return {
          isOk: false,
          isRiposo: true,
          status: 'RIPOSO',
          label: 'A Riposo',
          link: '#',
          title: 'Squadra a riposo'
        };
      }
      const targetDay = match ? match.serieADay : calendar.nextMatchday;
      const matchParam = match ? `&match=${match.id}${match.compId ? `&comp=${match.compId}` : ''}` : '';
      return {
        isOk,
        isRiposo: false,
        status: isOk ? 'OK' : 'NO',
        label: isOk ? 'Formazione OK' : 'Formazione NO',
        link: isOk ? `#formazioni?day=${targetDay}${matchParam}` : `#invform?Fsq=${teamId}&Gio=${targetDay}`,
        title: isOk ? `Formazione inserita (Visualizza incontro in Formazioni)` : `Formazione mancante (Clicca per inviare per la ${targetDay}ª)`
      };
    };

    // 7. Anteprima Prossimo Turno
    const nextDayFantaNome = nextDayMatches.length > 0 ? nextDayMatches[0].fantagiornataNome : 'Prossimo Turno';
    const nextDayCompHierarchy = this.buildMatchdayHierarchy(nextDayMatches, comps);

    const nextDayPreviewBlock = (nextDayMatches.length > 0) ? `
      <div class="card">
        <div class="card-header" style="align-items:flex-start;">
          <div>
            <div class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Prossimo Turno • ${calendar.nextMatchday}ª Serie A
            </div>
            ${nextDayDateStr ? `
              <div class="card-subtitle-date" style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;margin-left:28px;display:flex;align-items:center;gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 14 14"></polyline>
                </svg>
                <span>${nextDayDateStr}</span>
              </div>
            ` : ''}
          </div>
          <a href="#calendario" class="badge badge-primary">Calendario &rarr;</a>
        </div>

        <div class="matchday-content-vertical">
          ${nextDayCompHierarchy.map(comp => `
            <div class="comp-group-block">
              <div class="comp-group-header">
                <div class="comp-header-title">
                  <span>${comp.name}</span>
                </div>
                ${comp.fantaGiornata ? `<span class="comp-fanta-giornata">${comp.fantaGiornata}</span>` : ''}
              </div>
              ${comp.gironi.map(girone => `
                <div class="girone-group-block">
                  ${girone.name && girone.name !== comp.name ? `
                    <div class="girone-group-header">${this.formatGironeName(girone.name)}</div>
                  ` : ''}
                  <div class="girone-matches-list">
                    ${girone.matches.map(m => {
      const homeInfo = getTeamLineupInfo(m.homeTeamId, m.homeTeamName, m);
      const awayInfo = getTeamLineupInfo(m.awayTeamId, m.awayTeamName, m);
      return `
                        <div class="match-card compact-match-card">
                          <div class="match-teams-row">
                            <div class="match-team home">
                              <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <div class="team-info-wrap">
                                <span class="team-name-text" title="${m.homeTeamName}">${m.homeTeamName}</span>
                                ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
                                <a href="${homeInfo.link}" class="match-lineup-box ${homeInfo.isOk ? 'is-ok' : (homeInfo.isRiposo ? 'is-riposo' : 'is-no')}" title="${homeInfo.title}">
                                  <span class="lineup-icon">${homeInfo.isOk ? '✓' : (homeInfo.isRiposo ? '-' : '✕')}</span>
                                  <span class="lineup-text">Formazione <strong>${homeInfo.status}</strong></span>
                                </a>
                              </div>
                            </div>
                            <div class="match-score-pill">
                              <span class="score-unplayed">VS</span>
                            </div>
                            <div class="match-team away">
                              <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <div class="team-info-wrap">
                                <span class="team-name-text" title="${m.awayTeamName}">${m.awayTeamName}</span>
                                ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
                                <a href="${awayInfo.link}" class="match-lineup-box ${awayInfo.isOk ? 'is-ok' : (awayInfo.isRiposo ? 'is-riposo' : 'is-no')}" title="${awayInfo.title}">
                                  <span class="lineup-icon">${awayInfo.isOk ? '✓' : (awayInfo.isRiposo ? '-' : '✕')}</span>
                                  <span class="lineup-text">Formazione <strong>${awayInfo.status}</strong></span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      `;
    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // 8. Quote Scommesse (Algoritmo fedele a old/vecchio_sito/Toto/quote.js)
    const roundTo = (n, digits = 0) => {
      const multiplicator = Math.pow(10, digits);
      n = parseFloat((n * multiplicator).toFixed(11));
      const test = Math.round(n) / multiplicator;
      return +(test.toFixed(digits));
    };

    const getTeamStats = (idSquadra) => {
      let stats = { med: 72, pti: 0, found: false };
      if (Array.isArray(standings)) {
        const s = standings.find(item => item.teamId == idSquadra);
        if (s) {
          let media = parseFloat(s.mediaTotali);
          if (isNaN(media) || media === 0) media = parseFloat(s.mediaParziali);
          if (isNaN(media) || media === 0) media = 72;
          return {
            med: media,
            pti: parseFloat(s.points) || 0,
            found: true
          };
        }
      }
      if (typeof arrClassifica !== 'undefined' && Array.isArray(arrClassifica)) {
        for (let k = 1; k < arrClassifica.length; k++) {
          const row = arrClassifica[k];
          if (row && row.ID == idSquadra) {
            let media = parseFloat(row.TMed);
            if (isNaN(media) || media === 0) media = parseFloat(row.PMed);
            if (isNaN(media) || media === 0) media = 72;
            stats = {
              med: media,
              pti: parseFloat(row.Punti) || 0,
              found: true
            };
            if (row.IDGirone === mainGroupId) break;
          }
        }
      }
      return stats;
    };

    const calculateMatchOdds = (m) => {
      const statsCasa = getTeamStats(m.homeTeamId);
      const statsFuori = getTeamStats(m.awayTeamId);

      const Ma = statsCasa.med;
      const Mb = statsFuori.med;
      const Pa = statsCasa.pti;
      const Pb = statsFuori.pti;

      const aggio = 0.15;
      const sogliaUnderOver = 69;

      // Differenziale forza
      const D = (Ma - Mb) + (Pa - Pb) / 10;

      let p1 = 37 + (D * 5);
      let p2 = 37 - (D * 5);
      const pX = 26;

      if (p1 < 5) p1 = 5;
      if (p2 < 5) p2 = 5;

      const totProb = p1 + p2 + pX;
      p1 = p1 / totProb;
      p2 = p2 / totProb;
      const pX_norm = pX / totProb;

      const q1 = roundTo(((1 / p1) * (1 - aggio)), 2);
      const q2 = roundTo(((1 / p2) * (1 - aggio)), 2);
      const qX = roundTo(((1 / pX_norm) * (1 - aggio)), 2);

      // Calcolo Under/Over (Soglia 69)
      const sommaMedie = Ma + Mb;
      const diffGol = sommaMedie - (2 * sogliaUnderOver);
      let pOver = 0.50 + (diffGol / 40);

      if (pOver > 0.85) pOver = 0.85;
      if (pOver < 0.15) pOver = 0.15;
      const pUnder = 1 - pOver;

      const qO = roundTo(((1 / pOver) * (1 - aggio)), 2);
      const qU = roundTo(((1 / pUnder) * (1 - aggio)), 2);

      // Stili colore favorito
      let c1 = 'q-sfav', cX = 'q-sfav', c2 = 'q-sfav';
      if (q1 <= q2 && q1 <= qX) c1 = 'q-fav';
      else if (q2 <= q1 && q2 <= qX) c2 = 'q-fav';
      else cX = 'q-fav';

      const cU = (qU <= qO) ? 'q-fav' : 'q-sfav';
      const cO = (qO < qU) ? 'q-fav' : 'q-sfav';

      return {
        q1: q1.toFixed(2),
        qX: qX.toFixed(2),
        q2: q2.toFixed(2),
        qU: qU.toFixed(2),
        qO: qO.toFixed(2),
        c1, cX, c2, cU, cO
      };
    };

    const renderQuoteTable = (matchesList, dayNum) => {
      if (!matchesList || matchesList.length === 0) {
        return `
          <div class="quote-empty-state">
            Nessun incontro programmato o dati non disponibili per la ${dayNum}ª giornata.
          </div>
        `;
      }

      const quoteCompHierarchy = this.buildMatchdayHierarchy(matchesList, comps);

      return `
        <div class="matchday-content-vertical">
          ${quoteCompHierarchy.map(comp => `
            <div class="comp-group-block">
              <div class="comp-group-header">
                <div class="comp-header-title">
                  <span>${comp.name}</span>
                </div>
                ${comp.fantaGiornata ? `<span class="comp-fanta-giornata">${comp.fantaGiornata}</span>` : ''}
              </div>
              ${comp.gironi.map(girone => `
                <div class="girone-group-block">
                  ${girone.name && girone.name !== comp.name ? `
                    <div class="girone-group-header">${this.formatGironeName(girone.name)}</div>
                  ` : ''}
                  <div class="table-responsive quote-table-responsive">
                    <table class="modern-table quote-table">
                      <thead>
                        <tr>
                          <th class="quote-th-match">Incontro</th>
                          <th class="text-center quote-th-odd">1</th>
                          <th class="text-center quote-th-odd">X</th>
                          <th class="text-center quote-th-odd">2</th>
                          <th class="text-center quote-th-odd" title="Under 69 (somma medie &le; 138)">U 69</th>
                          <th class="text-center quote-th-odd" title="Over 69 (somma medie &gt; 138)">O 69</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${girone.matches.map(m => {
        const odds = calculateMatchOdds(m);
        const homeLogo = fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId);
        const awayLogo = fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId);
        return `
                            <tr class="quote-row">
                              <td class="quote-col-match">
                                <div class="quote-match-teams">
                                  <div class="quote-team home">
                                    <img src="${homeLogo}" class="quote-team-logo" alt="${escapeHtml(m.homeTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                    <span class="quote-team-name" title="${escapeHtml(m.homeTeamName)}">${escapeHtml(m.homeTeamName)}</span>
                                  </div>
                                  <span class="quote-vs">vs</span>
                                  <div class="quote-team away">
                                    <img src="${awayLogo}" class="quote-team-logo" alt="${escapeHtml(m.awayTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                    <span class="quote-team-name" title="${escapeHtml(m.awayTeamName)}">${escapeHtml(m.awayTeamName)}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="text-center"><span class="quote-val-pill ${odds.c1}">${odds.q1}</span></td>
                              <td class="text-center"><span class="quote-val-pill ${odds.cX}">${odds.qX}</span></td>
                              <td class="text-center"><span class="quote-val-pill ${odds.c2}">${odds.q2}</span></td>
                              <td class="text-center"><span class="quote-val-pill ${odds.cU}">${odds.qU}</span></td>
                              <td class="text-center"><span class="quote-val-pill ${odds.cO}">${odds.qO}</span></td>
                            </tr>
                          `;
      }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `;
    };

    // 8. WIDGET BILANCIO PROSSIMO TURNO (Basato su GeneraBilancioPT & persjs/fcmConfrontiDati.js)
    let bilancioMatchesCurrent = [];
    let bilancioMatchesFuture = [];
    try {
      bilancioMatchesCurrent = await fcmDataLoader.loadBilancioProssimoTurno(calendar.nextMatchday);
      if (isMatchdayInProgress && (nextSubmittableDay !== calendar.nextMatchday)) {
        bilancioMatchesFuture = await fcmDataLoader.loadBilancioProssimoTurno(nextSubmittableDay);
      }
    } catch (e) {
      console.warn('Errore nel caricamento del Bilancio Prossimo Turno:', e);
    }

    const renderBilancioTable = (bilancioList, dayNum) => {
      if (!bilancioList || bilancioList.length === 0) {
        return `
          <div class="bilancio-empty-state">
            Nessun incontro in programma o dati non disponibili per la ${dayNum}ª giornata.
          </div>
        `;
      }

      const bilancioHierarchy = this.buildMatchdayHierarchy(bilancioList, comps);

      return `
        <div class="matchday-content-vertical bilancio-container">
          ${bilancioHierarchy.map(comp => `
            <div class="comp-group-block">
              <div class="comp-group-header">
                <div class="comp-header-title">
                  <span>${comp.name}</span>
                </div>
                ${comp.fantaGiornata ? `<span class="comp-fanta-giornata">${comp.fantaGiornata}</span>` : ''}
              </div>
              ${comp.gironi.map(girone => `
                <div class="girone-group-block">
                  ${girone.name && girone.name !== comp.name ? `
                    <div class="girone-group-header">${this.formatGironeName(girone.name)}</div>
                  ` : ''}
                  <div class="table-responsive bilancio-table-responsive">
                    <table class="bilancio-table">
                      <thead>
                        <tr>
                          <th class="bilancio-th-team">Squadra</th>
                          <th class="text-center bilancio-th-stat bilancio-th-g" title="Partite Giocate">
                            <span class="col-desktop">Giocate</span>
                            <span class="col-mobile">G</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-v" title="Vittorie negli scontri diretti">
                            <span class="col-desktop">Vittorie</span>
                            <span class="col-mobile">V</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-p" title="Pareggi negli scontri diretti">
                            <span class="col-desktop">Pareggi</span>
                            <span class="col-mobile">P</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-gol" title="Reti segnate negli scontri diretti">
                            <span class="col-desktop">Goal</span>
                            <span class="col-mobile">Gol</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-pts" title="Media fantapunti negli scontri diretti">
                            <span class="col-desktop">Punti</span>
                            <span class="col-mobile">Pti</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-pc" title="Panchine storiche nella competizione">
                            <span class="col-desktop">Panc.Com.</span>
                            <span class="col-mobile">P.C</span>
                          </th>
                          <th class="text-center bilancio-th-stat bilancio-th-pt" title="Panchine storiche totali all-time">
                            <span class="col-desktop">Panc.Tot.</span>
                            <span class="col-mobile">P.T</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="bilancio-card-spacer" aria-hidden="true"><td colspan="8"></td></tr>
                        ${girone.matches.map((b, mIdx) => {
        const homeLogo = fcmDataLoader.getTeamLogo(b.nomeSquadraA || b.currentIdA);
        const awayLogo = fcmDataLoader.getTeamLogo(b.nomeSquadraB || b.currentIdB);

        const vTitleA = b.formattedUltimaVittoriaA ? `title="Ultima: ${escapeHtml(b.formattedUltimaVittoriaA)}"` : '';
        const vTitleB = b.formattedUltimaVittoriaB ? `title="Ultima: ${escapeHtml(b.formattedUltimaVittoriaB)}"` : '';
        const pTitle = b.formattedUltimoPareggio ? `title="Ultimo: ${escapeHtml(b.formattedUltimoPareggio)}"` : '';

        return `
                            <!-- Card Incontro: ${escapeHtml(b.nomeSquadraA)} vs ${escapeHtml(b.nomeSquadraB)} -->
                            <tr class="bilancio-row bilancio-row-home">
                              <td class="bilancio-team-cell">
                                <div class="bilancio-team-info">
                                  <img src="${homeLogo}" class="bilancio-team-logo" alt="${escapeHtml(b.nomeSquadraA)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                  <span class="bilancio-team-name" title="${escapeHtml(b.nomeSquadraA)}">${escapeHtml(b.nomeSquadraA)}</span>
                                  ${b.tipoIncontro === 'N' ? '<span class="badge badge-warning bilancio-neutro-badge">Neutro</span>' : ''}
                                </div>
                              </td>
                              <td class="text-center font-bold">${b.giocate}</td>
                              <td class="text-center">
                                <span class="bilancio-pill pill-win ${b.vinteA > 0 ? 'has-data' : ''}" ${vTitleA}>${b.vinteA}</span>
                              </td>
                              <td class="text-center">
                                <span class="bilancio-pill pill-draw ${b.nulle > 0 ? 'has-data' : ''}" ${pTitle}>${b.nulle}</span>
                              </td>
                              <td class="text-center font-bold">${b.ga}</td>
                              <td class="text-center font-bold bilancio-pts-cell">
                                <span class="val-desktop">${b.mediaPuntiA > 0 ? b.mediaPuntiA.toFixed(3) : '0'}</span>
                                <span class="val-mobile">${b.mediaPuntiA > 0 ? b.mediaPuntiA.toFixed(1) : '0'}</span>
                              </td>
                              <td class="text-center bilancio-panc-cell font-bold">${b.panchineCompetizioneA}</td>
                              <td class="text-center bilancio-panc-cell font-bold">${b.panchineTotaliA}</td>
                            </tr>
                            <tr class="bilancio-row bilancio-row-away">
                              <td class="bilancio-team-cell">
                                <div class="bilancio-team-info">
                                  <img src="${awayLogo}" class="bilancio-team-logo" alt="${escapeHtml(b.nomeSquadraB)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                  <span class="bilancio-team-name" title="${escapeHtml(b.nomeSquadraB)}">${escapeHtml(b.nomeSquadraB)}</span>
                                </div>
                              </td>
                              <td class="text-center font-bold">${b.giocate}</td>
                              <td class="text-center">
                                <span class="bilancio-pill pill-win ${b.vinteB > 0 ? 'has-data' : ''}" ${vTitleB}>${b.vinteB}</span>
                              </td>
                              <td class="text-center">
                                <span class="bilancio-pill pill-draw ${b.nulle > 0 ? 'has-data' : ''}" ${pTitle}>${b.nulle}</span>
                              </td>
                              <td class="text-center font-bold">${b.gb}</td>
                              <td class="text-center font-bold bilancio-pts-cell">
                                <span class="val-desktop">${b.mediaPuntiB > 0 ? b.mediaPuntiB.toFixed(3) : '0'}</span>
                                <span class="val-mobile">${b.mediaPuntiB > 0 ? b.mediaPuntiB.toFixed(1) : '0'}</span>
                              </td>
                              <td class="text-center bilancio-panc-cell font-bold">${b.panchineCompetizioneB}</td>
                              <td class="text-center bilancio-panc-cell font-bold">${b.panchineTotaliB}</td>
                            </tr>
                            ${mIdx < girone.matches.length - 1 ? `
                              <tr class="bilancio-card-spacer" aria-hidden="true">
                                <td colspan="8"></td>
                              </tr>
                            ` : ''}
                          `;
      }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `;
    };

    const hasBilancioMultiTabs = isMatchdayInProgress && (nextSubmittableDay !== calendar.nextMatchday) && (bilancioMatchesFuture.length > 0 || bilancioMatchesCurrent.length > 0);

    const bilancioBlock = `
      <div class="card bilancio-card">
        <div class="card-header" style="flex-wrap:wrap;gap:8px;align-items:center;">
          <div class="card-title" style="display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
              <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path>
              <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path>
              <path d="M7 21h10"></path>
              <path d="M12 3v18"></path>
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>
            </svg>
            <span>Bilancio Prossimo Turno ${!hasBilancioMultiTabs ? `• ${calendar.nextMatchday}ª Serie A` : ''}</span>
          </div>
          <a href="#confrontidiretti" class="badge badge-primary">Confronti Diretti &rarr;</a>
        </div>

        ${hasBilancioMultiTabs ? `
          <div class="bilancio-tabs-container" style="margin-bottom:14px;">
            <div class="bilancio-tabs-wrap">
              <button type="button" class="bilancio-tab-btn active" data-bilancio-target="current">
                <span class="bilancio-tab-live-dot"></span> In Corso (${calendar.nextMatchday}ª Serie A)
              </button>
              <button type="button" class="bilancio-tab-btn" data-bilancio-target="future">
                📅 Prossimo Turno (${nextSubmittableDay}ª Serie A)
              </button>
            </div>
          </div>
          <div class="bilancio-panel" id="bilancioPanelCurrent">
            ${renderBilancioTable(bilancioMatchesCurrent, calendar.nextMatchday)}
          </div>
          <div class="bilancio-panel" id="bilancioPanelFuture" style="display:none;">
            ${renderBilancioTable(bilancioMatchesFuture, nextSubmittableDay)}
          </div>
        ` : `
          <div class="bilancio-panel">
            ${renderBilancioTable(bilancioMatchesCurrent, calendar.nextMatchday)}
          </div>
        `}
        <div class="bilancio-footer-legend">
          <span class="bilancio-legend-desktop">&bull; <strong>Panc.Com.</strong>: Panchine competizione</span>
          <span class="bilancio-legend-desktop">&bull; <strong>Panc.Tot.</strong>: Panchine totali</span>
          <span class="bilancio-legend-desktop">&bull; <strong>Punti</strong>: Media fantapunti</span>
          <span class="bilancio-legend-desktop">&bull; Passa il cursore su <strong>Vittorie</strong> e <strong>Pareggi</strong> per la data dell'ultimo scontro</span>
          <span class="bilancio-legend-mobile">&bull; <strong>G</strong>: Giocate &bull; <strong>V</strong>: Vinte &bull; <strong>P</strong>: Pareggi &bull; <strong>Gol</strong>: Reti &bull; <strong>Pti</strong>: Media &bull; <strong>P.C</strong>: Panchine comp. &bull; <strong>P.T</strong>: Panchine tot.</span>
        </div>
      </div>
    `;

    const currentDayQuoteMatches = calendar.matches.filter(m => m.serieADay === calendar.nextMatchday && !m.isRiposo && m.homeTeamId > 0 && m.awayTeamId > 0);
    const futureDayQuoteMatches = (nextSubmittableDay !== calendar.nextMatchday)
      ? calendar.matches.filter(m => m.serieADay === nextSubmittableDay && !m.isRiposo && m.homeTeamId > 0 && m.awayTeamId > 0)
      : [];

    const hasMultiTabs = isMatchdayInProgress && (nextSubmittableDay !== calendar.nextMatchday) && (futureDayQuoteMatches.length > 0 || currentDayQuoteMatches.length > 0);

    const quotesBlock = `
      <div class="card quote-card">
        <div class="card-header" style="flex-wrap:wrap;gap:8px;align-items:center;">
          <div class="card-title" style="display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
              <path d="M7 10l2 2 3-3 5 5"></path>
            </svg>
            <span>Quote Scommesse ${!hasMultiTabs ? `• ${calendar.nextMatchday}ª Serie A` : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
            <span class="badge badge-success" style="font-size:0.7rem;letter-spacing:0.3px;">1X2 &amp; U/O 69</span>
          </div>
        </div>

        ${hasMultiTabs ? `
          <div class="quote-tabs-container" style="margin-bottom:14px;">
            <div class="quote-tabs-wrap">
              <button type="button" class="quote-tab-btn active" data-quote-target="current">
                <span class="quote-tab-live-dot"></span> In Corso (${calendar.nextMatchday}ª Serie A)
              </button>
              <button type="button" class="quote-tab-btn" data-quote-target="future">
                📅 Prossimo Turno (${nextSubmittableDay}ª Serie A)
              </button>
            </div>
          </div>
          <div class="quote-panel" id="quotePanelCurrent">
            ${renderQuoteTable(currentDayQuoteMatches, calendar.nextMatchday)}
          </div>
          <div class="quote-panel" id="quotePanelFuture" style="display:none;">
            ${renderQuoteTable(futureDayQuoteMatches, nextSubmittableDay)}
          </div>
        ` : `
          <div class="quote-panel">
            ${renderQuoteTable(currentDayQuoteMatches, calendar.nextMatchday)}
          </div>
        `}
        <div class="quote-footer-legend">
          <span class="legend-dot fav"></span> Verde = Favorito algoritmico &bull; Under/Over calcolato su soglia 69 (138 pt tot) &bull; Aggio banco 15%
        </div>
      </div>
    `;

    // 9. Coppa di Lega (Dinamico: Classifica Gironi vs Incontri Eliminazione Diretta)
    const coppaComp = comps.find(c => c.name.toLowerCase().includes('coppa') || c.id === 2);
    const coppaCompName = coppaComp ? coppaComp.name : 'Coppa di Lega';
    const allCoppaGroups = coppaComp ? (coppaComp.groups || []) : [];

    const allCoppaMatches = coppaComp
      ? calendar.matches.filter(m => m.compId === coppaComp.id && !m.isRiposo)
      : [];

    const roundRobinGroups = allCoppaGroups.filter(g =>
      g.Nome.toLowerCase().includes('girone') || (fcmDataLoader.getStandings(g.ID).length > 2)
    );

    const groupMatches = allCoppaMatches.filter(m =>
      roundRobinGroups.some(g => g.ID === m.groupId)
    );
    const knockoutMatches = allCoppaMatches.filter(m =>
      !roundRobinGroups.some(g => g.ID === m.groupId)
    );

    const coppaGroupsData = roundRobinGroups.map(g => {
      const gMatches = groupMatches.filter(m => m.groupId === g.ID);
      const playedCount = gMatches.filter(m => m.played).length;
      const totalCount = gMatches.length;
      const minDay = gMatches.length ? Math.min(...gMatches.map(m => m.serieADay)) : 999;
      const maxDay = gMatches.length ? Math.max(...gMatches.map(m => m.serieADay)) : 0;
      const inProgress = (playedCount > 0 && playedCount < totalCount) ||
        (calendar.nextMatchday >= minDay && calendar.nextMatchday <= maxDay && playedCount < totalCount);

      return {
        group: g,
        standings: fcmDataLoader.getStandings(g.ID),
        inProgress,
        minDay,
        maxDay
      };
    }).filter(d => d.standings && d.standings.length > 0);

    const activeCoppaGroups = coppaGroupsData.some(d => d.inProgress)
      ? coppaGroupsData.filter(d => d.inProgress)
      : coppaGroupsData;

    let upcomingKnockoutMatches = [];
    let knockoutPhaseLabel = 'Eliminazione Diretta';

    if (knockoutMatches.length > 0) {
      const unplayedKnockout = knockoutMatches.filter(m => !m.played);
      if (unplayedKnockout.length > 0) {
        const nextTargetDay = Math.min(...unplayedKnockout.map(m => m.serieADay));
        upcomingKnockoutMatches = unplayedKnockout.filter(m => m.serieADay === nextTargetDay);
        if (upcomingKnockoutMatches[0]) {
          knockoutPhaseLabel = upcomingKnockoutMatches[0].fantagiornataNome || `${nextTargetDay}ª Giornata`;
        }
      } else {
        const lastTargetDay = Math.max(...knockoutMatches.map(m => m.serieADay));
        upcomingKnockoutMatches = knockoutMatches.filter(m => m.serieADay === lastTargetDay);
        if (upcomingKnockoutMatches[0]) {
          knockoutPhaseLabel = `${upcomingKnockoutMatches[0].fantagiornataNome || 'Finali'} (Conclusa)`;
        }
      }
    }

    // Verifica squadre reali per riconoscere formule o segnaposto (es. "1a Girone Girone A", "Quarto A", ecc.)
    const leagueTeams = fcmDataLoader.getTeams();
    const realTeamNames = new Set(
      leagueTeams.map(t => (t.Nome || t.name || '').trim().toLowerCase()).filter(Boolean)
    );

    const isPlaceholderTeam = (name) => {
      if (!name || typeof name !== 'string') return true;
      const trimmed = name.trim();
      if (!trimmed) return true;
      if (/^\d+[\^°aoe]?\s+girone/i.test(trimmed)) return true;
      if (/^\d+[\^°aoe]?\s+classificat[ao]/i.test(trimmed)) return true;
      if (/^\d+[\^°aoe]?\s+(quarto|semi|finale)/i.test(trimmed)) return true;
      if (/^(quarto|semifinale|finale)\s+[a-z0-9]/i.test(trimmed)) return true;
      if (/^(vincente|perdente)\b/i.test(trimmed)) return true;
      if (/\bgirone\s+[a-z0-9]/i.test(trimmed)) return true;
      if (realTeamNames.size > 0 && !realTeamNames.has(trimmed.toLowerCase())) {
        return true;
      }
      return false;
    };

    const hasGroupStage = roundRobinGroups.length > 0 && groupMatches.length > 0;
    const hasUnplayedGroupMatches = hasGroupStage && groupMatches.some(m => !m.played);
    const hasKnockoutMatchesPlayed = knockoutMatches.some(m => m.played);
    const areKnockoutTeamsPopulated = upcomingKnockoutMatches.length > 0 &&
      upcomingKnockoutMatches.every(m => !isPlaceholderTeam(m.homeTeamName) && !isPlaceholderTeam(m.awayTeamName));

    // Gli scontri diretti sono visualizzabili se esistono, non ci sono partite dei gironi ancora da giocare,
    // e le squadre degli scontri diretti sono effettivamente valorizzate con nomi reali
    const canShowKnockout = knockoutMatches.length > 0 &&
      !hasUnplayedGroupMatches &&
      (hasKnockoutMatchesPlayed || areKnockoutTeamsPopulated);

    let coppaBlock = '';
    if (coppaComp) {
      const hasKnockoutOption = canShowKnockout;
      const hasGroupsOption = activeCoppaGroups.length > 0;
      const defaultCoppaMode = hasKnockoutOption ? 'knockout' : 'groups';

      const knockoutHtml = upcomingKnockoutMatches.length > 0 ? `
        <div class="matches-list" style="margin-top: 4px;">
          ${upcomingKnockoutMatches.map(m => `
            <div class="coppa-knockout-match">
              <div class="coppa-match-header">
                <span>${escapeHtml(m.groupName)}</span>
                <span class="coppa-match-day-badge">${escapeHtml(m.fantagiornataNome || `${m.serieADay}ª Serie A`)}</span>
              </div>
              <div class="match-teams-row" style="gap: 4px;">
                <div class="match-team home">
                  <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" style="width: 22px; height: 22px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div class="team-info-wrap">
                    <span class="team-name-text" style="font-size: 0.78rem;" title="${m.homeTeamName}">${m.homeTeamName}</span>
                    ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
                  </div>
                </div>
                <div class="match-score-pill" style="padding: 3px 6px; min-width: 48px;">
                  ${m.played
          ? `<span class="score-digits" style="font-size: 0.88rem;">${m.homeGoals}-${m.awayGoals}</span>`
          : `<span class="score-unplayed" style="font-size: 0.72rem;">VS</span>`
        }
                </div>
                <div class="match-team away">
                  <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" style="width: 22px; height: 22px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div class="team-info-wrap">
                    <span class="team-name-text" style="font-size: 0.78rem;" title="${m.awayTeamName}">${m.awayTeamName}</span>
                    ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.8rem;">
          Nessun incontro a eliminazione diretta programmato al momento.
        </div>
      `;

      const groupsHtml = activeCoppaGroups.length > 0 ? `
        <div class="coppa-groups-list">
          ${activeCoppaGroups.map((d, gIdx) => `
            <div class="coppa-group-section" style="${gIdx > 0 ? 'margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-purple, #a855f7); text-transform: uppercase; letter-spacing: 0.5px;">
                  ${escapeHtml(d.group.Nome)}
                </span>
                <span style="font-size: 0.68rem; color: var(--text-muted);">
                  ${d.standings.length} squadre
                </span>
              </div>
              <div class="table-responsive">
                <table class="modern-table">
                  <thead>
                    <tr>
                      <th style="width:28px;">#</th>
                      <th>Squadra</th>
                      <th class="text-right">PT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${d.standings.map((s, idx) => `
                      <tr>
                        <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${s.pos || (idx + 1)}</td>
                        <td>
                          <div class="table-col-team">
                            <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <span>${s.name}</span>
                            ${fcmDataLoader.getTeamTrophiesHtml(s.name)}
                          </div>
                        </td>
                        <td class="text-right table-pts font-bold">${s.points}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.8rem;">
          Nessun girone di Coppa di Lega attualmente in corso.
        </div>
      `;

      coppaBlock = `
        <div class="card" style="margin-top: -6px;">
          <div class="card-header" id="headerCoppaStandings" style="cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;">
            <div class="card-title" style="font-size: 0.95rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
              </svg>
              ${escapeHtml(coppaCompName)}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <a href="#classifica?comp=${coppaComp.id}" class="badge badge-primary" style="font-size: 0.68rem;" onclick="event.stopPropagation();">Completa &rarr;</a>
              <span class="badge badge-primary" id="badgeCoppaToggle" style="font-size: 0.68rem;">Apri ▼</span>
            </div>
          </div>
          <div id="contentCoppaStandings" style="display: none; padding-top: 10px;">
            ${(hasKnockoutOption && hasGroupsOption) ? `
              <div class="coppa-phase-tabs">
                <button type="button" class="coppa-phase-btn ${defaultCoppaMode === 'knockout' ? 'active' : ''}" id="btnCoppaTabKnockout">
                  Scontri Diretti
                </button>
                <button type="button" class="coppa-phase-btn ${defaultCoppaMode === 'groups' ? 'active' : ''}" id="btnCoppaTabGroups">
                  Classifica Gironi
                </button>
              </div>
            ` : ''}
            ${hasKnockoutOption ? `
              <div id="coppaPanelKnockout" style="display: ${defaultCoppaMode === 'knockout' ? 'block' : 'none'};">
                ${knockoutHtml}
              </div>
            ` : ''}
            <div id="coppaPanelGroups" style="display: ${defaultCoppaMode === 'groups' ? 'block' : 'none'};">
              ${groupsHtml}
            </div>
          </div>
        </div>
      `;
    }

    let html = `
      <div class="dashboard-grid">
        <!-- Main Column -->
        <div class="dashboard-main-col">
          
          <!-- News Banner (if present) -->
          ${info.news.length > 0 ? `
            <div class="news-banner">
              <div class="news-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <div class="news-content">
                <div class="news-date" id="homeNewsDate">${info.news[0].date}</div>
                <div class="news-text" id="homeNewsText" aria-live="polite">${info.news[0].text}</div>
              </div>
            </div>
          ` : ''}

          ${isMatchdayInProgress ? `
            <!-- SE GIORNATA IN CORSO: -->
            <!-- 1. LIVE HERO CARD -->
            ${liveHeroBlock}

            <!-- 2. MINI-FORMAZIONI DELLA GIORNATA IN CORSO -->
            ${miniFormationsBlock}

            <!-- 3. RISULTATI DELL'ULTIMA GIORNATA -->
            ${resultsBlock}

            <!-- 4. TOP 11 DELL'ULTIMA GIORNATA -->
            ${top11Block}

            <!-- 5. ANTICIPO FORMAZIONE (SE ABILITATO) -->
            ${allowFutureLineups ? anticipoBlock : ''}

            <!-- 6. WIDGET BILANCIO PROSSIMO TURNO (SUBITO SOPRA LE QUOTE) -->
            ${bilancioBlock}

            <!-- 7. WIDGET QUOTE (GIORNATA IN CORSO: SUBITO SOTTO BILANCIO PROSSIMO TURNO) -->
            ${quotesBlock}
          ` : `
            <!-- ALTRIMENTI (GIORNATA NON IN CORSO): -->
            <!-- 1. RISULTATI DELL'ULTIMA GIORNATA -->
            ${resultsBlock}

            <!-- 2. COUNTDOWN & INVIO FORMAZIONE PROSSIMA GIORNATA -->
            ${countdownBlock}

            <!-- 3. TOP 11 DELL'ULTIMA GIORNATA -->
            ${top11Block}

            <!-- 4. ANTEPRIMA PROSSIMO TURNO -->
            ${nextDayPreviewBlock}

            <!-- 5. WIDGET BILANCIO PROSSIMO TURNO (SUBITO SOPRA LE QUOTE) -->
            ${bilancioBlock}

            <!-- 6. WIDGET QUOTE (GIORNATA NON IN CORSO: SUBITO SOTTO BILANCIO PROSSIMO TURNO) -->
            ${quotesBlock}
          `}

        </div>

        <!-- Sidebar / Secondary Column -->
        <div class="dashboard-side-col">
          
          <!-- Mini Standings Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                  <path d="M4 22h16"></path>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                </svg>
                Classifica ${escapeHtml(mainCompName)}
              </div>
              <a href="#classifica" class="badge badge-primary">Completa &rarr;</a>
            </div>

            <div class="table-responsive">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th style="width:28px;">#</th>
                    <th>Squadra</th>
                    <th class="text-right">PT</th>
                  </tr>
                </thead>
                <tbody>
                  ${standings.map((s, idx) => `
                    <tr>
                      <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${s.pos}</td>
                      <td>
                        <div class="table-col-team">
                          <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                          <span>${s.name}</span>
                          ${fcmDataLoader.getTeamTrophiesHtml(s.name)}
                        </div>
                      </td>
                      <td class="text-right table-pts">${s.points}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Classifica GP (Punti Totali) - Accordion Aperta di Default -->
          <div class="card" style="margin-top: -6px;">
            <div class="card-header" id="headerGpStandings" style="cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;">
              <div class="card-title" style="font-size: 0.95rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                  <line x1="2" y1="7" x2="22" y2="7"></line>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <line x1="2" y1="17" x2="22" y2="17"></line>
                  <line x1="7" y1="2" x2="7" y2="22"></line>
                  <line x1="12" y1="2" x2="12" y2="22"></line>
                  <line x1="17" y1="2" x2="17" y2="22"></line>
                </svg>
                Classifica GP
              </div>
              <span class="badge badge-primary" id="badgeGpToggle" style="font-size: 0.68rem;">Chiudi ▲</span>
            </div>
            <div id="contentGpStandings" style="display: block; padding-top: 10px;">
              <div class="table-responsive">
                <table class="modern-table">
                  <thead>
                    <tr>
                      <th style="width:28px;">#</th>
                      <th>Squadra</th>
                      <th class="text-right">PT GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${gpStandings.map((s, idx) => `
                      <tr>
                        <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${idx + 1}</td>
                        <td>
                          <div class="table-col-team">
                            <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <span>${s.name}</span>
                          </div>
                        </td>
                        <td class="text-right table-pts" style="color:var(--accent-cyan);font-weight:800;">
                          ${(s.sommaTotali || 0).toFixed(2)}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Widget Chiuso Coppa di Lega (Dinamico: Gironi vs Eliminazione Diretta) -->
          ${coppaBlock}

          <!-- Live Tools: mostrato nella sidebar solo a giornata non in corso -->
          ${!isMatchdayInProgress ? `<div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>
                Live &amp; Strumenti
              </div>
            </div>
            <div class="live-links-grid">
              ${hasliveFP ? `
              <a href="#liveFP" class="live-link-card">
                <img src="img/live/logo-fp.png" alt="Fantapazz" onerror="this.style.display='none'" />
                <span class="live-link-name">Live Fantapazz</span>
              </a>` : ''}
              ${hasLiveFM ? `
              <a href="#liveFM" class="live-link-card">
                <img src="img/live/logo-fm.png" alt="FantaMaster" onerror="this.style.display='none'" />
                <span class="live-link-name">Live FantaMaster</span>
              </a>` : ''}
              ${hasLiveVU ? `
              <a href="#liveVU" class="live-link-card">
                <img src="img/live/live_pianeta.png" alt="PianetaFC" onerror="this.style.display='none'" />
                <span class="live-link-name">Voti Ufficiosi</span>
              </a>` : ''}
              <a href="#calcolo" class="live-link-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <line x1="8" y1="6" x2="16" y2="6"/>
                  <line x1="16" y1="14" x2="16" y2="14.01"/>
                  <line x1="12" y1="14" x2="12" y2="14.01"/>
                  <line x1="8" y1="14" x2="8" y2="14.01"/>
                  <line x1="16" y1="18" x2="16" y2="18.01"/>
                  <line x1="12" y1="18" x2="12" y2="18.01"/>
                  <line x1="8" y1="18" x2="8" y2="18.01"/>
                </svg>
                <span class="live-link-name">Calcolo Manuale</span>
              </a>
            </div>
          </div>` : ''}

          ${guestbookBlock}

          ${sponsorsBlock}

          ${counterBlock}

        </div>
      </div>
    `;

    container.innerHTML = html;
    this.initNewsSlider(info.news, container);
    this.initGuestbookPreview(container);
    this.initVisitorCounter(container);
    this.initBilancioTabs(container);
    this.initQuoteTabs(container);

    // Sincronizza stato pulsante footer mobile (Invio Formazione / Live / Calendario)
    if (typeof App !== 'undefined' && typeof App.updateBottomNav === 'function') {
      App.updateBottomNav();
    }

    // Attach Classifica GP accordion toggle
    const gpHeader = container.querySelector('#headerGpStandings');
    const gpContent = container.querySelector('#contentGpStandings');
    const gpBadge = container.querySelector('#badgeGpToggle');
    if (gpHeader && gpContent) {
      gpHeader.addEventListener('click', () => {
        const isHidden = gpContent.style.display === 'none';
        gpContent.style.display = isHidden ? 'block' : 'none';
        if (gpBadge) {
          gpBadge.textContent = isHidden ? 'Chiudi ▲' : 'Apri ▼';
        }
      });
    }

    // Attach Classifica Coppa di Lega accordion toggle
    const coppaHeader = container.querySelector('#headerCoppaStandings');
    const coppaContent = container.querySelector('#contentCoppaStandings');
    const coppaBadge = container.querySelector('#badgeCoppaToggle');
    if (coppaHeader && coppaContent) {
      coppaHeader.addEventListener('click', () => {
        const isHidden = coppaContent.style.display === 'none';
        coppaContent.style.display = isHidden ? 'block' : 'none';
        if (coppaBadge) {
          coppaBadge.textContent = isHidden ? 'Chiudi ▲' : 'Apri ▼';
        }
      });
    }

    // Attach Coppa phase tabs switcher (Scontri Diretti vs Classifica Gironi)
    const btnCoppaKnockout = container.querySelector('#btnCoppaTabKnockout');
    const btnCoppaGroups = container.querySelector('#btnCoppaTabGroups');
    const panelCoppaKnockout = container.querySelector('#coppaPanelKnockout');
    const panelCoppaGroups = container.querySelector('#coppaPanelGroups');

    if (btnCoppaKnockout && btnCoppaGroups && panelCoppaKnockout && panelCoppaGroups) {
      btnCoppaKnockout.addEventListener('click', (e) => {
        e.stopPropagation();
        btnCoppaKnockout.classList.add('active');
        btnCoppaGroups.classList.remove('active');
        panelCoppaKnockout.style.display = 'block';
        panelCoppaGroups.style.display = 'none';
      });

      btnCoppaGroups.addEventListener('click', (e) => {
        e.stopPropagation();
        btnCoppaGroups.classList.add('active');
        btnCoppaKnockout.classList.remove('active');
        panelCoppaGroups.style.display = 'block';
        panelCoppaKnockout.style.display = 'none';
      });
    }

    if (isMatchdayInProgress && allowFutureLineups && submittableDeadline) {
      this.initAnticipoCountdown(nextSubmittableDay, container, submittableDeadline, submittableStartTime, submittableAnticipo);
    } else if (!isMatchdayInProgress) {
      this.initCountdown(calendar.nextMatchday, container, targetDeadline, matchStartTime, targetAnticipo);
    }
  },

  /**
   * Attaches tab switching logic for the Bilancio Prossimo Turno widget when matchday is in progress.
   */
  initBilancioTabs(container) {
    const tabBtns = container.querySelectorAll('.bilancio-tab-btn');
    if (!tabBtns || tabBtns.length === 0) return;

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-bilancio-target');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const pCurrent = container.querySelector('#bilancioPanelCurrent');
        const pFuture = container.querySelector('#bilancioPanelFuture');

        if (pCurrent && pFuture) {
          if (target === 'current') {
            pCurrent.style.display = 'block';
            pFuture.style.display = 'none';
          } else {
            pCurrent.style.display = 'none';
            pFuture.style.display = 'block';
          }
        }
      });
    });
  },

  /**
   * Attaches tab switching logic for the Quotes widget when matchday is in progress.
   */
  initQuoteTabs(container) {
    const tabBtns = container.querySelectorAll('.quote-tab-btn');
    if (!tabBtns || tabBtns.length === 0) return;

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-quote-target');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const pCurrent = container.querySelector('#quotePanelCurrent');
        const pFuture = container.querySelector('#quotePanelFuture');

        if (pCurrent && pFuture) {
          if (target === 'current') {
            pCurrent.style.display = 'block';
            pFuture.style.display = 'none';
          } else {
            pCurrent.style.display = 'none';
            pFuture.style.display = 'block';
          }
        }
      });
    });
  },

  /**
   * Rotates through the news configured in fcmVariabili.js.
   */
  initNewsSlider(news, container) {
    clearInterval(this.newsInterval);
    if (!news || news.length < 2) return;

    const dateEl = container.querySelector('#homeNewsDate');
    const textEl = container.querySelector('#homeNewsText');
    if (!dateEl || !textEl) return;

    let currentIndex = 0;
    const showNextNews = () => {
      textEl.classList.add('is-changing');
      dateEl.classList.add('is-changing');

      window.setTimeout(() => {
        currentIndex = (currentIndex + 1) % news.length;
        dateEl.textContent = news[currentIndex].date;
        textEl.textContent = news[currentIndex].text;
        dateEl.classList.remove('is-changing');
        textEl.classList.remove('is-changing');
      }, 220);
    };

    this.newsInterval = setInterval(showNextNews, 5000);
  },

  async initGuestbookPreview(container) {
    const postEl = container.querySelector('#guestbookPost');
    const counterEl = container.querySelector('#guestbookCounter');
    const prevButton = container.querySelector('#guestbookPrev');
    const nextButton = container.querySelector('#guestbookNext');
    if (!postEl || !counterEl || !prevButton || !nextButton) return;

    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
    const guestbookTemplatePath = 'gbook182/templates/default/';
    let posts = [];
    let currentIndex = 0;

    const cleanComment = rawHtml => {
      const comment = document.createElement('div');
      comment.innerHTML = String(rawHtml || '').replaceAll('##GBOOK_TEMPLATE##', guestbookTemplatePath);
      comment.querySelectorAll('script,style,iframe,object,embed,form').forEach(element => element.remove());
      comment.querySelectorAll('*').forEach(element => {
        if (element.tagName === 'IMG') {
          Array.from(element.attributes).forEach(attribute => {
            if (!['src', 'alt', 'title'].includes(attribute.name)) element.removeAttribute(attribute.name);
          });
        } else if (element.tagName !== 'BR') {
          Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
        }
      });
      return comment.innerHTML;
    };

    const renderPost = () => {
      const post = posts[currentIndex];
      if (!post) return;
      postEl.innerHTML = `
        <div class="guestbook-post-author">${escapeHtml(post.name || 'Anonimo')}</div>
        <div class="guestbook-post-date">${escapeHtml(post.date)}</div>
        <div class="guestbook-post-text">${post.comment}</div>
      `;
      counterEl.textContent = `${currentIndex + 1} / ${posts.length}`;
      prevButton.disabled = currentIndex === 0;
      nextButton.disabled = currentIndex === posts.length - 1;
    };

    try {
      // 1. Prova l'endpoint JSON dedicato preview.php (sicuro, senza IP/email e compatibile con .htaccess e PWA)
      const response = await fetch('gbook182/preview.php');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          posts = data.map(item => ({
            name: item.name || 'Anonimo',
            date: item.date || '',
            comment: cleanComment(item.comment || '')
          }));
        }
      }
    } catch (e) {
      // Endpoint PHP non disponibile o offline senza cache, tenta fallback
    }

    // 2. Fallback su entries.txt (per ambienti di test statici locali senza interprete PHP)
    if (!posts.length) {
      try {
        const response = await fetch('gbook182/entries.txt');
        if (response.ok) {
          const entries = (await response.text()).split(/\r?\n/).filter(Boolean).slice(0, 10);
          posts = entries.map(entry => {
            const fields = entry.split('\t');
            if (fields[6] === '1') return null; // Ignora messaggi privati
            return {
              name: fields[0] || 'Anonimo',
              date: fields[5] || '',
              comment: cleanComment(fields[4] || '')
            };
          }).filter(Boolean);
        }
      } catch (e) {
        // Nessuna risorsa disponibile
      }
    }

    if (!posts.length) {
      postEl.innerHTML = '<div class="guestbook-post-author">Nessun post disponibile.</div><div class="guestbook-post-text">Apri il guestbook per leggere tutti i post.</div>';
      counterEl.textContent = '0 / 0';
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }

    prevButton.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex -= 1;
        renderPost();
      }
    });
    nextButton.addEventListener('click', () => {
      if (currentIndex < posts.length - 1) {
        currentIndex += 1;
        renderPost();
      }
    });
    renderPost();
  },

  /**
   * Initializes and updates the visitor counter metrics (fanKounter)
   */
  async initVisitorCounter(container) {
    const totalEl = container.querySelector('#counterTotal');
    const todayEl = container.querySelector('#counterToday');
    if (!totalEl || !todayEl) return;

    try {
      const response = await fetch('fkounter5/counter.php?id=index&mode=json&no_count=1', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data && data.total !== undefined) {
          totalEl.textContent = Number(data.total).toLocaleString('it-IT');
        }
        if (data && data.today !== undefined) {
          todayEl.textContent = Number(data.today).toLocaleString('it-IT');
        }
      }
    } catch (e) {
      console.warn('Impossibile recuperare dati contatore visitatori:', e);
    }
  },

  /**
   * Initializes countdown for upcoming lineup submission in anticipation widget
   */
  initAnticipoCountdown(serieADay, container, targetDate, startDate, anticipoMinutes) {
    clearInterval(this.anticipoInterval);
    const daysEl = document.getElementById('cdAntDays');
    const hoursEl = document.getElementById('cdAntHours');
    const minsEl = document.getElementById('cdAntMinutes');
    const secsEl = document.getElementById('cdAntSeconds');
    const textEl = document.getElementById('cdAntDeadlineText');
    if (!daysEl || !targetDate) return;

    const ant = (anticipoMinutes !== undefined && anticipoMinutes !== null) ? anticipoMinutes : fcmDataLoader.getAnticipoInvio(serieADay);
    const antLabel = `(-${ant}m)`;

    if (textEl) {
      if (startDate) {
        const startDayName = startDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const startTimeStr = startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const deadlineTimeStr = targetDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        textEl.innerHTML = `⚽ Inizio Partite: <strong>${startDayName} ore ${startTimeStr}</strong> &bull; Scadenza Invio: <strong>${deadlineTimeStr}</strong> ${antLabel}`;
      } else {
        textEl.textContent = `Scadenza Invio: ${targetDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      }
    }

    const update = () => {
      const now = new Date().getTime();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) {
        daysEl.textContent = '00';
        hoursEl.textContent = '00';
        minsEl.textContent = '00';
        secsEl.textContent = '00';
        if (textEl) {
          textEl.textContent = 'Tempo scaduto per la consegna delle formazioni!';
        }
        clearInterval(this.anticipoInterval);
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      daysEl.textContent = String(d).padStart(2, '0');
      hoursEl.textContent = String(h).padStart(2, '0');
      minsEl.textContent = String(m).padStart(2, '0');
      secsEl.textContent = String(s).padStart(2, '0');
    };
    update();
    this.anticipoInterval = setInterval(update, 1000);
  },

  /**
   * Initializes countdown from invform/invform.inc.php matchday schedule
   */
  async initCountdown(serieADay, container, preloadedDeadline, preloadedStartTime, preloadedAnticipo) {
    clearInterval(this.countdownInterval);

    const daysEl = document.getElementById('cdDays');
    const hoursEl = document.getElementById('cdHours');
    const minsEl = document.getElementById('cdMinutes');
    const secsEl = document.getElementById('cdSeconds');
    const textEl = document.getElementById('cdDeadlineText') || document.getElementById('cdStatusMessage');

    if (!daysEl) return;

    let targetDeadline = preloadedDeadline;
    let matchStartTime = preloadedStartTime;
    let targetAnticipo = preloadedAnticipo;

    if (!targetDeadline) {
      const schedule = await fcmDataLoader.loadMatchSchedule(serieADay);
      const daySched = schedule[serieADay];
      if (daySched) {
        targetDeadline = daySched.dataOraTermine;
        matchStartTime = daySched.dataOraInizio;
        if (targetAnticipo === undefined || targetAnticipo === null) {
          targetAnticipo = daySched.anticipoInvio;
        }
      }
    }

    if (targetAnticipo === undefined || targetAnticipo === null) {
      targetAnticipo = fcmDataLoader.getAnticipoInvio(serieADay);
    }

    const startTimerWithDate = (targetDate, startDate, anticipoVal) => {
      const ant = (anticipoVal !== undefined && anticipoVal !== null) ? anticipoVal : targetAnticipo;
      const antLabel = `(-${ant}m)`;

      if (textEl) {
        if (startDate) {
          const startDayName = startDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const startTimeStr = startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          const deadlineTimeStr = targetDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          textEl.innerHTML = `⚽ Inizio Partite: <strong>${startDayName} ore ${startTimeStr}</strong> &bull; Scadenza Invio: <strong>${deadlineTimeStr}</strong> ${antLabel}`;
        } else {
          textEl.textContent = `Scadenza Invio: ${targetDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        }
      }

      const update = () => {
        const now = new Date().getTime();
        const diff = targetDate.getTime() - now;

        if (diff <= 0) {
          daysEl.textContent = '00';
          hoursEl.textContent = '00';
          minsEl.textContent = '00';
          secsEl.textContent = '00';
          if (textEl) {
            textEl.textContent = 'Tempo scaduto per la consegna delle formazioni!';
          }
          clearInterval(this.countdownInterval);
          if (typeof App !== 'undefined' && typeof App.updateBottomNav === 'function') {
            App.updateBottomNav();
          }
          if (container) {
            this.render(container);
          }
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        daysEl.textContent = String(d).padStart(2, '0');
        hoursEl.textContent = String(h).padStart(2, '0');
        minsEl.textContent = String(m).padStart(2, '0');
        secsEl.textContent = String(s).padStart(2, '0');
      };

      update();
      this.countdownInterval = setInterval(update, 1000);
    };

    if (targetDeadline) {
      startTimerWithDate(targetDeadline, matchStartTime, targetAnticipo);
      return;
    }

    if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.dataOraTermine) {
      const ant = (termineInvio.anticipoInvio !== undefined && termineInvio.anticipoInvio !== null)
        ? parseInt(termineInvio.anticipoInvio, 10)
        : targetAnticipo;
      startTimerWithDate(new Date(termineInvio.dataOraTermine), termineInvio.dataOraInizio ? new Date(termineInvio.dataOraInizio) : null, ant);
    }
  },

  destroy() {
    if (this.newsInterval) {
      clearInterval(this.newsInterval);
      this.newsInterval = null;
    }
    if (this.anticipoInterval) {
      clearInterval(this.anticipoInterval);
      this.anticipoInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
};

