/**
 * CALENDARIO VIEW
 * Comprehensive calendar & matchday fixtures
 * ModernFCM
 */

const calendarioView = {
  currentSerieADay: 0, // 0 = Tutte le giornate by default
  filterTeamId: 0,
  filterCompId: 0,
  lastHash: null,

  /**
   * Formats a date object or date string into Italian:
   * "Gio XX Mes AAAA ore hh:mm" (e.g. "Ven 4 Set 2026 ore 20:45")
   */
  formatItalianDate(dateInput) {
    if (!dateInput) return '';
    let d = null;
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      d = dateInput;
    } else if (typeof dateInput === 'string') {
      const cleaned = dateInput.trim();
      if (!cleaned) return '';
      // Parse "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm"
      const parts = cleaned.split(/[\sT]+/);
      if (parts.length >= 2) {
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].replace('.', ':').split(':');
        if (dateParts.length === 3) {
          d = new Date(
            parseInt(dateParts[0], 10),
            parseInt(dateParts[1], 10) - 1,
            parseInt(dateParts[2], 10),
            parseInt(timeParts[0] || '0', 10),
            parseInt(timeParts[1] || '0', 10)
          );
        }
      }
      if (!d || isNaN(d.getTime())) {
        d = new Date(cleaned);
      }
    }

    if (!d || isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';

    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const months = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    const dayOfWeek = days[d.getDay()];
    const dayOfMonth = d.getDate();
    const monthStr = months[d.getMonth() + 1];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${dayOfWeek} ${dayOfMonth} ${monthStr} ${year} ore ${hours}:${minutes}`;
  },

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
      const cId = m.compId || 0;
      const compObjFromData = comps ? comps.find(c => c.id === cId) : null;
      const cName = m.compName || (compObjFromData ? compObjFromData.name : 'Competizione');
      const fName = m.fantagiornataNome || '';

      if (!compMap.has(cId)) {
        compMap.set(cId, { id: cId, name: cName, fantaGiornata: fName, gironeMap: new Map() });
      }
      const compObj = compMap.get(cId);
      if (!compObj.fantaGiornata && fName) {
        compObj.fantaGiornata = fName;
      }

      const gId = m.groupId || 0;
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
    // Read parameters from hash if navigating directly via link e.g. #calendario?day=5&team=1&comp=2
    const currentHash = window.location.hash || '';
    if (this.lastHash !== currentHash && currentHash.includes('?')) {
      const params = new URLSearchParams(currentHash.substring(currentHash.indexOf('?')));
      if (params.has('day')) this.currentSerieADay = parseInt(params.get('day')) || 0;
      if (params.has('team')) this.filterTeamId = parseInt(params.get('team')) || 0;
      if (params.has('comp')) this.filterCompId = parseInt(params.get('comp')) || 0;
      this.lastHash = currentHash;
    }

    const calendar = fcmDataLoader.getCalendarData();
    const teams = fcmDataLoader.getTeams();
    const comps = fcmDataLoader.getCompetitions();
    const schedule = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadDataASchedule)
      ? await fcmDataLoader.loadDataASchedule()
      : (typeof dataGiornata !== 'undefined' ? dataGiornata : {});

    const realTeamNames = new Set(teams.map(t => (t.Nome || '').trim().toLowerCase()));

    // Filter matches
    let filteredMatches = calendar.matches;

    // 1. Filter by Competition if selected
    if (this.filterCompId > 0) {
      filteredMatches = filteredMatches.filter(m => m.compId === this.filterCompId);
    }

    // 2. Filter by Team if selected
    if (this.filterTeamId > 0) {
      const selectedTeam = teams.find(t => t.ID === this.filterTeamId);
      const targetTeamName = selectedTeam ? (selectedTeam.Nome || '').trim().toLowerCase() : '';

      filteredMatches = filteredMatches.filter(m => {
        const matchesTeam = (m.homeTeamId === this.filterTeamId || m.awayTeamId === this.filterTeamId ||
          (m.homeTeamName && m.homeTeamName.trim().toLowerCase() === targetTeamName) ||
          (m.awayTeamName && m.awayTeamName.trim().toLowerCase() === targetTeamName));
        if (!matchesTeam) return false;

        // Bug Fix: Only display DEFINED matches (both teams are real defined teams, or it's a rest day)
        if (m.isRiposo) return true;

        const homeReal = m.homeTeamName && realTeamNames.has(m.homeTeamName.trim().toLowerCase());
        const awayReal = m.awayTeamName && realTeamNames.has(m.awayTeamName.trim().toLowerCase());

        return homeReal && awayReal;
      });
    }

    // 3. Filter by Matchday if selected
    if (this.currentSerieADay > 0) {
      filteredMatches = filteredMatches.filter(m => m.serieADay === this.currentSerieADay);
    }

    // Group filtered matches by matchday
    const matchdaysMap = new Map();
    filteredMatches.forEach(m => {
      if (!matchdaysMap.has(m.serieADay)) {
        const mObj = calendar.matchdays.find(d => d.serieADay === m.serieADay);
        matchdaysMap.set(m.serieADay, {
          serieADay: m.serieADay,
          name: mObj ? mObj.name : `${m.serieADay}ª Giornata`,
          played: mObj ? mObj.played : false,
          matches: []
        });
      }
      matchdaysMap.get(m.serieADay).matches.push(m);
    });

    const matchdayGroups = Array.from(matchdaysMap.values()).sort((a, b) => a.serieADay - b.serieADay);

    const isFilterActive = this.filterCompId > 0 || this.filterTeamId > 0 || this.currentSerieADay > 0;
    const selectedTeamObj = teams.find(t => t.ID === this.filterTeamId);
    const selectedCompObj = comps.find(c => c.id === this.filterCompId);

    let subtitleText = 'Tutti gli incontri della stagione';
    if (this.filterTeamId > 0 && selectedTeamObj) {
      subtitleText = `Incontri di: ${selectedTeamObj.Nome}`;
      if (this.filterCompId > 0 && selectedCompObj) subtitleText += ` (${selectedCompObj.name})`;
      if (this.currentSerieADay > 0) subtitleText += ` • ${this.currentSerieADay}ª Giornata`;
    } else if (this.filterCompId > 0 && selectedCompObj) {
      subtitleText = `Competizione: ${selectedCompObj.name}`;
      if (this.currentSerieADay > 0) subtitleText += ` • ${this.currentSerieADay}ª Giornata`;
    } else if (this.currentSerieADay > 0) {
      subtitleText = `${this.currentSerieADay}ª Giornata di Serie A`;
    }

    const isSingleMatchdayView = matchdayGroups.length === 1 || this.currentSerieADay > 0;

    let html = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Calendario Incontri
            </div>
            <div class="card-subtitle">
              ${subtitleText}
            </div>
          </div>

          <!-- Controls Row: Competition & Team -->
          <div class="calendar-controls-group">
            <select id="selectCalendarComp" class="form-select">
              <option value="0" ${this.filterCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
              ${comps.map(c => `
                <option value="${c.id}" ${c.id === this.filterCompId ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>

            <select id="selectCalendarTeam" class="form-select">
              <option value="0" ${this.filterTeamId === 0 ? 'selected' : ''}>Tutte le Squadre</option>
              ${teams.map(t => `
                <option value="${t.ID}" ${t.ID === this.filterTeamId ? 'selected' : ''}>${t.Nome}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Matchday Selector Bar -->
        <div class="matchday-selector-bar">
          <div class="matchday-selector-wrap">
            <label for="selectCalendarDay" style="font-weight:700;font-size:0.82rem;color:var(--text-muted);text-transform:uppercase;white-space:nowrap;">
              Giornata:
            </label>
            <select id="selectCalendarDay" class="form-select" style="min-width:200px;font-weight:700;">
              <option value="0" ${this.currentSerieADay === 0 ? 'selected' : ''}>Tutte le Giornate</option>
              ${calendar.matchdays.map(m => {
      const s = schedule ? schedule[m.serieADay] : null;
      const timeStr = s && (s.dataOraInizio || s.orarioInizio) ? `(${this.formatItalianDate(s.dataOraInizio || s.orarioInizio)})` : '';
      return `
                  <option value="${m.serieADay}" ${m.serieADay === this.currentSerieADay ? 'selected' : ''}>
                    ${m.serieADay}ª Giornata ${timeStr} ${m.played ? '(✓)' : ''}
                  </option>
                `;
    }).join('')}
            </select>
          </div>

          ${isFilterActive ? `
            <button id="btnResetCalendarFilters" class="btn-reset-filter">
              ✕ Azzera Filtri
            </button>
          ` : ''}
        </div>

        <!-- Matchday Groups List (Z-Pattern Desktop Grid) -->
        <div class="calendar-matchday-groups-wrap ${isSingleMatchdayView ? 'single-matchday-centered' : ''}">
          ${matchdayGroups.length > 0 ? matchdayGroups.map(group => {
      let formattedDate = null;
      if (schedule && schedule[group.serieADay]) {
        const val = schedule[group.serieADay];
        formattedDate = (typeof val === 'string')
          ? val
          : this.formatItalianDate(val.dataOraInizio || val.orarioInizio);
      } else if (typeof dataGiornata !== 'undefined' && dataGiornata[group.serieADay]) {
        formattedDate = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.formatDataAString)
          ? fcmDataLoader.formatDataAString(dataGiornata[group.serieADay])
          : dataGiornata[group.serieADay];
      }

      const compHierarchy = this.buildMatchdayHierarchy(group.matches, comps);

      return `
              <div class="calendar-matchday-group">
                <div class="calendar-matchday-header">
                  <div class="calendar-matchday-title">
                    <span class="matchday-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.75;">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                      </svg>
                      ${group.serieADay}ª Giornata Serie A
                    </span>
                    ${formattedDate ? `<span class="matchday-date-tag">⏱ ${formattedDate}</span>` : ''}
                  </div>
                  <div class="matchday-quick-actions">
                    <a href="#formazioni?day=${group.serieADay}" class="matchday-link-action" title="Visualizza Formazioni">Formazioni</a>
                    <span class="action-sep">•</span>
                    <a href="#risultati?day=${group.serieADay}" class="matchday-link-action" title="Visualizza Risultati">Risultati</a>
                  </div>
                </div>

                <div class="matchday-content-vertical">
                  ${compHierarchy.map(comp => `
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
                            ${girone.matches.map(m => this.renderMatchCard(m)).join('')}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
    }).join('') : `
            <div class="card text-center" style="padding:40px;color:var(--text-muted);grid-column:1/-1;">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.6;">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <div style="font-weight:700;font-size:1.05rem;margin-bottom:4px;color:var(--text-primary);">Nessun incontro trovato</div>
              <div>Nessun incontro trovato con i filtri selezionati.</div>
            </div>
          `}
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Attach listeners
    const daySelect = container.querySelector('#selectCalendarDay');
    if (daySelect) {
      daySelect.addEventListener('change', (e) => {
        this.currentSerieADay = parseInt(e.target.value);
        this.render(container);
      });
    }

    const compSelect = container.querySelector('#selectCalendarComp');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        this.filterCompId = parseInt(e.target.value);
        this.render(container);
      });
    }

    const teamSelect = container.querySelector('#selectCalendarTeam');
    if (teamSelect) {
      teamSelect.addEventListener('change', (e) => {
        this.filterTeamId = parseInt(e.target.value);
        this.render(container);
      });
    }

    const resetBtn = container.querySelector('#btnResetCalendarFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentSerieADay = 0;
        this.filterCompId = 0;
        this.filterTeamId = 0;
        this.render(container);
      });
    }
  },

  renderMatchCard(m) {
    if (m.isRiposo) {
      return `
        <div class="match-card compact-match-card">
          <div class="match-teams-row">
            <div class="match-team home">
              <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${m.homeTeamName}" />
              <div class="team-info-wrap">
                <span class="team-name-text" title="${m.homeTeamName}">${m.homeTeamName}</span>
                ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="match-card-actions">
            <span class="badge badge-riposo">Riposo</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="match-card compact-match-card">
        <div class="match-teams-row">
          <!-- Home Team -->
          <div class="match-team home">
            <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${m.homeTeamName}" />
            <div class="team-info-wrap">
              <span class="team-name-text" title="${m.homeTeamName}">${m.homeTeamName}</span>
              ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
            </div>
          </div>

          <!-- Score Pill -->
          <div class="match-score-pill">
            ${m.played ? `
              <div class="score-digits">${m.homeGoals} - ${m.awayGoals}</div>
              <div class="score-totals">${m.homeTotal} - ${m.awayTotal}</div>
            ` : `
              <span class="score-unplayed">VS</span>
            `}
          </div>

          <!-- Away Team -->
          <div class="match-team away">
            <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${m.awayTeamName}" />
            <div class="team-info-wrap">
              <span class="team-name-text" title="${m.awayTeamName}">${m.awayTeamName}</span>
              ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="match-card-actions">
          <span class="badge ${m.played ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;padding:3px 8px;">
            ${m.played ? 'Disputata' : 'Da Giocare'}
          </span>

          <div class="match-card-btns">
            <a href="#formazioni?day=${m.serieADay}&match=${m.id}" class="btn-match-mini btn-match-formazioni" title="Visualizza Formazioni">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="2" y="2" width="20" height="20" rx="4"></rect>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
              </svg>
              <span>Formazioni</span>
            </a>
            <a href="#risultati?day=${m.serieADay}&match=${m.id}" class="btn-match-mini btn-match-risultati" title="Visualizza Risultati">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Risultati</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

};
