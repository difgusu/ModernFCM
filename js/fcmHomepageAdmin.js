/**
 * FCM HOMEPAGE ADMIN BUILDER
 * Gestione lato Amministratore dell'ordinamento dei widget di Lega e creazione di Custom Widgets.
 * ModernFCM
 */

const fcmHomepageAdmin = {
  currentConfig: null,
  initialConfig: null,
  isDirty: false,
  previewsCollapsed: false,
  collapsedItemsMap: {},
  sponsorImages: [],
  csrfToken: '',

  getCsrfToken() {
    if (this.csrfToken) return this.csrfToken;
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]') : null;
    return meta ? (meta.getAttribute('content') || '') : '';
  },

  sanitizeUrl(url, allowHash = true) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const compact = raw.replace(/[\u0000-\u0020]+/g, '');
    if (/^(javascript|vbscript|data):/i.test(compact)) return '';
    if (compact.startsWith('#')) return allowHash ? raw : '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(compact)) {
      return /^https?:/i.test(compact) ? raw : '';
    }
    return raw;
  },

  async init() {
    this.loadPreviewPreferences();
    await this.loadConfig();
    await this.loadLeagueData();
    await this.loadSponsorImages();
    this.populateCompetitionSelects();
    this.syncDefaultSettingsInputs();
    this.renderColumns();
    this.renderCustomWidgetsList();
    this.renderSponsorsList();
    this.updateSponsorsCardPreview();
    this.initBuilderForm();
    this.updatePreview();
  },

  loadPreviewPreferences() {
    try {
      const globalVal = localStorage.getItem('fcm_admin_previews_collapsed');
      if (globalVal !== null) {
        this.previewsCollapsed = (globalVal === 'true');
      }
      const itemMap = localStorage.getItem('fcm_admin_collapsed_items');
      this.collapsedItemsMap = itemMap ? JSON.parse(itemMap) : {};
    } catch (e) {
      this.collapsedItemsMap = {};
    }
    this.updateToggleAllBtn();
  },

  updateToggleAllBtn() {
    const allBtn = document.getElementById('btnToggleAllPreviews');
    if (allBtn) {
      allBtn.innerHTML = this.previewsCollapsed
        ? '<span>▼ Mostra Tutte le Anteprime</span>'
        : '<span>▲ Comprimi Tutte le Anteprime</span>';
    }
  },

  populateCompetitionSelects() {
    const comps = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function')
      ? fcmDataLoader.getCompetitions()
      : [];
    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    const standingsSel = document.getElementById('adminSettingStandingsComp');
    if (standingsSel) {
      standingsSel.innerHTML = `<option value="auto">🤖 Automatica (Competizione Predefinita FCM)</option>` +
        comps.map(c => `<option value="${escapeHtml(c.id)}">🏆 ${escapeHtml(c.name)} (ID: ${escapeHtml(c.id)})</option>`).join('');
    }

    const coppaSel = document.getElementById('adminSettingCoppaComp');
    if (coppaSel) {
      coppaSel.innerHTML = `<option value="auto">🤖 Automatica (Rileva Coppa da nome/ID)</option>` +
        comps.map(c => `<option value="${escapeHtml(c.id)}">🏆 ${escapeHtml(c.name)} (ID: ${escapeHtml(c.id)})</option>`).join('');
    }

    const customCompSel = document.getElementById('customWidgetCompId');
    if (customCompSel) {
      if (comps.length === 0) {
        customCompSel.innerHTML = `<option value="">-- Nessuna competizione trovata --</option>`;
      } else {
        customCompSel.innerHTML = comps.map(c => {
          const det = (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.detectCompetitionFormat)
            ? fcmHomeConfigManager.detectCompetitionFormat(c)
            : null;
          const suffix = det && det.label ? ` — ${det.label}` : '';
          return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${escapeHtml(suffix)}</option>`;
        }).join('');
      }
    }
  },

  syncDefaultSettingsInputs() {
    const settings = (this.currentConfig && this.currentConfig.defaultSettings) ? this.currentConfig.defaultSettings : {};
    const standingsCompSel = document.getElementById('adminSettingStandingsComp');
    if (standingsCompSel) {
      standingsCompSel.value = (settings.standingsCompId !== undefined && settings.standingsCompId !== null && settings.standingsCompId !== '')
        ? String(settings.standingsCompId)
        : 'auto';
    }
    const coppaCompSel = document.getElementById('adminSettingCoppaComp');
    if (coppaCompSel) {
      coppaCompSel.value = (settings.coppaCompId !== undefined && settings.coppaCompId !== null && settings.coppaCompId !== '')
        ? String(settings.coppaCompId)
        : 'auto';
    }
    const topFlopSel = document.getElementById('adminSettingTopFlop');
    if (topFlopSel && settings.topFlopDefaultTab) {
      topFlopSel.value = settings.topFlopDefaultTab;
    }
    const quotesSel = document.getElementById('adminSettingQuotesMode');
    if (quotesSel && settings.quotesMode) {
      quotesSel.value = settings.quotesMode;
    }
    const gpSel = document.getElementById('adminSettingGpAccordion');
    if (gpSel) {
      gpSel.value = (settings.gpAccordionOpen !== false) ? 'true' : 'false';
    }
    const coppaSel = document.getElementById('adminSettingCoppaAccordion');
    if (coppaSel) {
      coppaSel.value = settings.coppaAccordionOpen ? 'true' : 'false';
    }
  },

  onDefaultSettingChange(key, value) {
    if (!this.currentConfig) return;
    if (!this.currentConfig.defaultSettings) {
      this.currentConfig.defaultSettings = {};
    }
    this.currentConfig.defaultSettings[key] = value;
    this.setDirty(true);
    if (key === 'standingsCompId' || key === 'coppaCompId') {
      this.renderColumns();
    }
  },

  getApiUrl(action) {
    const isInc = window.location.pathname.includes('/inc/') || window.location.pathname.includes('impostazioni.php') || window.location.pathname.includes('impostazioni_calcolo.php');
    const base = isInc ? 'homepage_admin_save.php' : 'inc/homepage_admin_save.php';
    return `${base}?action=${action}`;
  },

  async loadConfig() {
    try {
      const res = await fetch(this.getApiUrl('get_config') + '&_t=' + Date.now());
      const data = await res.json();
      if (data && data.csrfToken) {
        this.csrfToken = data.csrfToken;
      }
      if (data && data.success && data.config) {
        this.currentConfig = data.config;
      }
    } catch (e) {
      console.warn('Errore recupero configurazione homepage:', e);
    }

    // Se non è stato possibile recuperarla dal server o se le colonne sono vuote
    if (!this.currentConfig || !this.currentConfig.columns || (!this.currentConfig.columns.main?.length && !this.currentConfig.columns.side?.length)) {
      if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.getDefaultConfig === 'function') {
        this.currentConfig = fcmHomeConfigManager.getDefaultConfig();
      } else {
        this.currentConfig = {
          version: 1,
          lastUpdated: Date.now(),
          layoutResetAt: Date.now(),
          defaultSettings: {
            topFlopDefaultTab: 'top',
            quotesMode: 'all',
            gpAccordionOpen: true,
            coppaAccordionOpen: false,
            coppaDefaultTab: 'knockout'
          },
          columns: {
            main: [
              { id: 'liveMatchday', enabled: true },
              { id: 'news', enabled: true },
              { id: 'results', enabled: true },
              { id: 'countdown', enabled: true },
              { id: 'topFlop11', enabled: true },
              { id: 'bestWorstMister', enabled: true },
              { id: 'anticipo', enabled: true },
              { id: 'nextDayPreview', enabled: true },
              { id: 'bilancio', enabled: true },
              { id: 'quotes', enabled: true }
            ],
            side: [
              { id: 'standings', enabled: true },
              { id: 'gpStandings', enabled: true },
              { id: 'coppa', enabled: true },
              { id: 'liveTools', enabled: true },
              { id: 'guestbook', enabled: true },
              { id: 'sponsors', enabled: true },
              { id: 'counter', enabled: true }
            ]
          },
          customWidgets: []
        };
      }

      // Tenta il salvataggio automatico sul server per creare inc/data/homepage_config.json
      try {
        const headers = { 'Content-Type': 'application/json' };
        const csrf = this.getCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;
        await fetch(this.getApiUrl('save_config'), {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(this.currentConfig)
        });
      } catch (err) {
        console.warn('Auto-creazione inc/data/homepage_config.json fallita:', err);
      }
    }

    if (!this.currentConfig.sponsors || !Array.isArray(this.currentConfig.sponsors)) {
      this.currentConfig.sponsors = [];
    }

    this.initialConfig = JSON.parse(JSON.stringify(this.currentConfig));
    this.setDirty(false);
  },

  renderColumns() {
    const mainList = document.getElementById('adminColMainList');
    const sideList = document.getElementById('adminColSideList');
    if (!mainList || !sideList) return;

    mainList.innerHTML = this.renderColumnItems('main');
    sideList.innerHTML = this.renderColumnItems('side');

    this.attachColumnEvents('main');
    this.attachColumnEvents('side');

    if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.initCustomCompetitionWidgets) {
      fcmHomeConfigManager.initCustomCompetitionWidgets(mainList);
      fcmHomeConfigManager.initCustomCompetitionWidgets(sideList);
    }

    this.setDirty(this.isDirty);
  },

  toggleAllPreviews() {
    this.previewsCollapsed = !this.previewsCollapsed;
    this.collapsedItemsMap = {};
    try {
      localStorage.setItem('fcm_admin_previews_collapsed', String(this.previewsCollapsed));
      localStorage.removeItem('fcm_admin_collapsed_items');
    } catch (e) { }

    const items = document.querySelectorAll('.admin-home-item');
    items.forEach(item => {
      item.classList.toggle('is-collapsed', this.previewsCollapsed);
      const icon = item.querySelector('.toggle-preview-icon');
      if (icon) {
        icon.textContent = this.previewsCollapsed ? '▼' : '▲';
      }
    });
    this.updateToggleAllBtn();
  },

  loadLeagueData() {
    if (typeof fcmDataLoader === 'undefined') return Promise.resolve();
    const promises = [];
    if (typeof fcmDataLoader.loadTopFlop11 === 'function') {
      promises.push(
        fcmDataLoader.loadTopFlop11()
          .then(res => { if (res) this.topFlopData = res; })
          .catch(e => console.warn('topFlopData admin load error:', e))
      );
    }
    const cal = (typeof fcmDataLoader.getCalendarData === 'function') ? fcmDataLoader.getCalendarData() : null;
    const lastDay = (cal && cal.lastPlayed > 0) ? cal.lastPlayed : 1;
    if (typeof fcmDataLoader.loadFantamisterDay === 'function') {
      promises.push(
        fcmDataLoader.loadFantamisterDay(lastDay)
          .then(res => { if (res) this.fantamisterData = res; })
          .catch(e => console.warn('fantamisterData admin load error:', e))
      );
    }
    return Promise.all(promises);
  },

  getTeamLogoUrl(teamIdOrName) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function') {
      return fcmDataLoader.getTeamLogo(teamIdOrName);
    }
    return '../img/sq/undefined.svg';
  },

  getTeamTrophiesHtml(teamName) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamTrophiesHtml === 'function') {
      return fcmDataLoader.getTeamTrophiesHtml(teamName);
    }
    return '';
  },

  getLeagueTeams() {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeams === 'function') {
      const teams = fcmDataLoader.getTeams();
      if (teams && teams.length > 0) return teams;
    }
    return [
      { ID: 1, Nome: 'Squadra 1', Presidente: 'Presidente 1' },
      { ID: 2, Nome: 'Squadra 2', Presidente: 'Presidente 2' },
      { ID: 3, Nome: 'Squadra 3', Presidente: 'Presidente 3' },
      { ID: 4, Nome: 'Squadra 4', Presidente: 'Presidente 4' }
    ];
  },

  getResolvedMainComp() {
    const comps = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function')
      ? fcmDataLoader.getCompetitions()
      : [];
    const cfgId = this.currentConfig && this.currentConfig.defaultSettings
      ? this.currentConfig.defaultSettings.standingsCompId
      : 'auto';
    if (cfgId && cfgId !== 'auto') {
      const found = comps.find(c => String(c.id) === String(cfgId));
      if (found) return found;
    }
    return comps.find(c => c.isDefault) || comps.find(c => c.id === 1) || comps[0] || null;
  },

  getLeagueStandings() {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getStandings === 'function') {
      const mainComp = this.getResolvedMainComp();
      const groupId = mainComp ? (mainComp.defaultGroupId || (mainComp.groups && mainComp.groups[0] ? mainComp.groups[0].ID : 1) || 1) : undefined;
      const standings = fcmDataLoader.getStandings(groupId);
      if (standings && standings.length > 0) return standings;
    }
    const teams = this.getLeagueTeams();
    return teams.map((t, idx) => ({
      pos: idx + 1,
      teamId: t.ID,
      name: t.Nome,
      points: Math.max(0, 50 - idx * 3),
      sommaTotali: (2500 - idx * 35).toFixed(2),
      played: 20
    }));
  },

  getLeagueGPStandings() {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getGPStandings === 'function') {
      const mainComp = this.getResolvedMainComp();
      const groupId = mainComp ? (mainComp.defaultGroupId || (mainComp.groups && mainComp.groups[0] ? mainComp.groups[0].ID : 1) || 1) : undefined;
      const gp = fcmDataLoader.getGPStandings(groupId);
      if (gp && gp.length > 0) return gp;
    }
    const standings = this.getLeagueStandings();
    return standings.map((s, idx) => ({
      ...s,
      gpPos: idx + 1,
      sommaTotali: s.sommaTotali || (2500 - idx * 35).toFixed(2)
    }));
  },

  getLastMatchdayData() {
    const teams = this.getLeagueTeams();
    let cal = null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCalendarData === 'function') {
      cal = fcmDataLoader.getCalendarData();
    }
    const lastDay = (cal && cal.lastPlayed > 0) ? cal.lastPlayed : 1;
    let foundMatches = [];
    let compName = 'Lega';
    let fantaDayName = `${lastDay}ª Giornata`;

    if (cal && cal.matches && cal.matches.length > 0) {
      foundMatches = cal.matches.filter(m => m.serieADay === lastDay && m.played);
      if (foundMatches.length === 0) {
        const anyPlayed = cal.matches.filter(m => m.played);
        if (anyPlayed.length > 0) {
          const maxDay = Math.max(...anyPlayed.map(m => m.serieADay));
          foundMatches = cal.matches.filter(m => m.serieADay === maxDay && m.played);
        }
      }
    }

    if (foundMatches.length > 0) {
      const first = foundMatches[0];
      compName = first.compName || 'Lega';
      fantaDayName = first.fantagiornataNome || `${lastDay}ª Giornata`;
    } else {
      for (let i = 0; i < teams.length - 1; i += 2) {
        foundMatches.push({
          id: i + 1,
          homeTeamId: teams[i].ID,
          homeTeamName: teams[i].Nome,
          awayTeamId: teams[i + 1].ID,
          awayTeamName: teams[i + 1].Nome,
          homeGoals: 2,
          awayGoals: 1,
          homeTotal: 73.5,
          awayTotal: 68.0,
          compName: 'Lega',
          fantagiornataNome: `${lastDay}ª Giornata`
        });
      }
    }

    let dateStr = '';
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getDataGiornataA === 'function') {
      dateStr = fcmDataLoader.getDataGiornataA(lastDay);
    }

    return {
      serieADay: lastDay,
      compName,
      fantaDayName,
      dateStr: dateStr || `Giornata ${lastDay}`,
      matches: foundMatches
    };
  },

  getNextMatchdayData() {
    const teams = this.getLeagueTeams();
    let cal = null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCalendarData === 'function') {
      cal = fcmDataLoader.getCalendarData();
    }
    const nextDay = (cal && cal.nextMatchday > 0) ? cal.nextMatchday : 1;
    let foundMatches = [];
    let compName = 'Lega';
    let fantaDayName = `${nextDay}ª Giornata`;

    if (cal && cal.matches && cal.matches.length > 0) {
      foundMatches = cal.matches.filter(m => m.serieADay === nextDay && !m.isRiposo);
      if (foundMatches.length === 0) {
        const unplayed = cal.matches.filter(m => !m.played && !m.isRiposo);
        if (unplayed.length > 0) {
          const minDay = Math.min(...unplayed.map(m => m.serieADay));
          foundMatches = cal.matches.filter(m => m.serieADay === minDay && !m.isRiposo);
        }
      }
    }

    if (foundMatches.length > 0) {
      const first = foundMatches[0];
      compName = first.compName || 'Lega';
      fantaDayName = first.fantagiornataNome || `${nextDay}ª Giornata`;
    } else {
      for (let i = 0; i < teams.length - 1; i += 2) {
        foundMatches.push({
          id: i + 100,
          homeTeamId: teams[i].ID,
          homeTeamName: teams[i].Nome,
          awayTeamId: teams[i + 1].ID,
          awayTeamName: teams[i + 1].Nome,
          compName: 'Lega',
          fantagiornataNome: `${nextDay}ª Giornata`
        });
      }
    }

    let dateStr = '';
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getDataGiornataA === 'function') {
      dateStr = fcmDataLoader.getDataGiornataA(nextDay);
    }

    return {
      serieADay: nextDay,
      compName,
      fantaDayName,
      dateStr: dateStr || `Giornata ${nextDay}`,
      matches: foundMatches
    };
  },

  getPitchSvgLines() {
    return `<svg class="pitch-svg-lines" viewBox="0 0 770 1210" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="35" y="55" width="700" height="1100" fill="none" stroke="currentColor" stroke-width="2.5" />
      <line x1="35" y1="605" x2="735" y2="605" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="605" r="91.5" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="605" r="4" fill="currentColor" />
      <rect x="185" y="55" width="400" height="165" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="330" y="55" width="110" height="55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="165" r="4" fill="currentColor" />
      <path d="M 311.88,220 A 91.5,91.5 0 0,0 458.12,220" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="185" y="990" width="400" height="165" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="330" y="1100" width="110" height="55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="1045" r="4" fill="currentColor" />
      <path d="M 311.88,990 A 91.5,91.5 0 0,1 458.12,990" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="348.4" y="30.6" width="73.2" height="24.4" fill="rgba(255,255,255,0.08)" stroke="currentColor" stroke-width="2.5" />
      <line x1="366.7" y1="30.6" x2="366.7" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="385" y1="30.6" x2="385" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="403.3" y1="30.6" x2="403.3" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <rect x="348.4" y="1155" width="73.2" height="24.4" fill="rgba(255,255,255,0.08)" stroke="currentColor" stroke-width="2.5" />
      <line x1="366.7" y1="1155" x2="366.7" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="385" y1="1155" x2="385" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="403.3" y1="1155" x2="403.3" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <path d="M 35,75 A 20,20 0 0,0 55,55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 715,55 A 20,20 0 0,0 735,75" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 35,1135 A 20,20 0 0,1 55,1155" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 715,1155 A 20,20 0 0,1 735,1135" fill="none" stroke="currentColor" stroke-width="2.5" />
    </svg>`;
  },

  renderStandardWidgetPreview(itemId, customObj) {
    return this.getWidgetPreviewSnippet(itemId, customObj);
  },

  getWidgetPreviewSnippet(itemId, customObj) {
    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    switch (itemId) {
      case 'news': {
        const info = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getLeagueInfo === 'function') ? fcmDataLoader.getLeagueInfo() : {};
        const leagueName = escapeHtml(info.name || 'Lega');
        return `
          <div class="card ai-news-card preview-card" style="margin-bottom:0; padding:14px; border:1px solid var(--border-subtle); background:var(--bg-surface); border-radius:var(--radius-md);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <span class="badge" style="background:linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2)); color:var(--accent-primary); border:1px solid rgba(99,102,241,0.3); font-weight:700; font-size:0.75rem; padding:3px 8px; border-radius:var(--radius-full);">✨ Editoriale di Giornata (AI)</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(info.updated || new Date().toLocaleDateString('it-IT'))}</span>
            </div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:6px;">L'Editoriale di Giornata della ${leagueName}</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">Cronaca e analisi giornalistica intelligente dell'ultimo turno generata con AI su risultati, marcatori e ribaltoni in classifica.</div>
          </div>
        `;
      }

      case 'results': {
        const resData = this.getLastMatchdayData();
        const matchesToShow = (resData.matches || []).slice(0, 5);
        const matchesHtml = matchesToShow.map(m => {
          const homeName = m.homeTeamName || `Squadra ${m.homeTeamId || 'A'}`;
          const awayName = m.awayTeamName || `Squadra ${m.awayTeamId || 'B'}`;
          const homeLogo = this.getTeamLogoUrl(homeName || m.homeTeamId);
          const awayLogo = this.getTeamLogoUrl(awayName || m.awayTeamId);
          const homeGoals = m.homeGoals !== undefined ? m.homeGoals : 0;
          const awayGoals = m.awayGoals !== undefined ? m.awayGoals : 0;
          const homeTotal = m.homeTotal !== undefined ? m.homeTotal : 0;
          const awayTotal = m.awayTotal !== undefined ? m.awayTotal : 0;
          const homeTrophies = this.getTeamTrophiesHtml(homeName);
          const awayTrophies = this.getTeamTrophiesHtml(awayName);

          return `
            <div class="match-card compact-match-card">
              <div class="match-teams-row">
                <div class="match-team home">
                  <img src="${homeLogo}" class="team-badge-img" onerror="this.src='../img/sq/undefined.svg'" />
                  <div class="team-info-wrap"><span class="team-name-text">${escapeHtml(homeName)}</span>${homeTrophies}</div>
                </div>
                <div class="match-score-pill"><div class="score-digits">${homeGoals} - ${awayGoals}</div><div class="score-totals">${homeTotal} - ${awayTotal}</div></div>
                <div class="match-team away">
                  <img src="${awayLogo}" class="team-badge-img" onerror="this.src='../img/sq/undefined.svg'" />
                  <div class="team-info-wrap"><span class="team-name-text">${escapeHtml(awayName)}</span>${awayTrophies}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header" style="align-items:flex-start;">
              <div>
                <div class="card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline>
                  </svg>
                  Risultati • ${resData.serieADay}ª Serie A
                </div>
                ${resData.dateStr ? `
                <div class="card-subtitle-date" style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;margin-left:28px;display:flex;align-items:center;gap:5px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline>
                  </svg>
                  <span>${escapeHtml(resData.dateStr)}</span>
                </div>` : ''}
              </div>
              <span class="badge badge-primary">Tabellini Completi &rarr;</span>
            </div>
            <div class="matchday-content-vertical">
              <div class="comp-group-block">
                <div class="comp-group-header">
                  <div class="comp-header-title"><span>${escapeHtml(resData.compName || 'Lega')}</span></div>
                  <span class="comp-fanta-giornata">${escapeHtml(resData.fantaDayName || '')}</span>
                </div>
                <div class="girone-matches-list">
                  ${matchesHtml || '<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.82rem;">Nessun risultato disponibile per questa giornata.</div>'}
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'countdown': {
        const nextData = this.getNextMatchdayData();
        return `
          <div class="countdown-box" style="margin-bottom:0;">
            <div class="countdown-header">⏱ Prossimo Turno • Giornata ${nextData.serieADay} di Serie A</div>
            <div class="cd-timer">
              <div class="cd-unit"><div class="cd-digit">02</div><div class="cd-label">Giorni</div></div>
              <div class="cd-separator">:</div>
              <div class="cd-unit"><div class="cd-digit">14</div><div class="cd-label">Ore</div></div>
              <div class="cd-separator">:</div>
              <div class="cd-unit"><div class="cd-digit">30</div><div class="cd-label">Minuti</div></div>
              <div class="cd-separator">:</div>
              <div class="cd-unit"><div class="cd-digit">00</div><div class="cd-label">Secondi</div></div>
            </div>
            <div class="cd-deadline-text">⚽ Inizio Partite: <strong>${escapeHtml(nextData.dateStr || 'Prossimamente')}</strong> &bull; Scadenza Invio: <strong>(-30m)</strong></div>
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
              <span class="btn-invio-form" style="margin-top:0;">📋 Invia Formazione &rarr;</span>
            </div>
          </div>
        `;
      }

      case 'bestWorstMister': {
        const lastData = this.getLastMatchdayData();
        const teams = this.getLeagueTeams();
        const fm = this.fantamisterData || {};

        const topScore = fm.topScore || (fm.topScoreCoach ? {
          Nome: fm.topScoreCoach.teamName,
          teamId: fm.topScoreCoach.teamId,
          coach: fm.topScoreCoach.coachName,
          total: fm.topScoreCoach.score,
          partial: fm.topScoreCoach.score - 4,
          goals: fm.topScoreCoach.goals || 3,
          isHome: true
        } : null) || {
          Nome: teams[0] ? teams[0].Nome : 'Squadra Top',
          teamId: teams[0] ? teams[0].ID : 1,
          coach: (teams[0] && teams[0].Presidente) ? teams[0].Presidente : 'Fantallenatore 1',
          total: 82.5,
          partial: 78.5,
          goals: 3,
          ModParz: '3-4-3',
          isHome: true,
          opponentName: teams[1] ? teams[1].Nome : 'Squadra 2',
          opponentGoals: 1
        };

        const lowestScore = fm.lowestScore || (fm.flopScoreCoach ? {
          Nome: fm.flopScoreCoach.teamName,
          teamId: fm.flopScoreCoach.teamId,
          coach: fm.flopScoreCoach.coachName,
          total: fm.flopScoreCoach.score,
          partial: fm.flopScoreCoach.score - 2,
          goals: 0,
          isHome: false
        } : null) || {
          Nome: teams[1] ? teams[1].Nome : 'Squadra Flop',
          teamId: teams[1] ? teams[1].ID : 2,
          coach: (teams[1] && teams[1].Presidente) ? teams[1].Presidente : 'Fantallenatore 2',
          total: 56.0,
          partial: 54.0,
          goals: 0,
          ModParz: '3-5-2',
          isHome: false,
          opponentName: teams[0] ? teams[0].Nome : 'Squadra 1',
          opponentGoals: 2
        };

        const bestMister = fm.bestMister || {
          Nome: teams[2] ? teams[2].Nome : 'Squadra Scelta Perfetta',
          teamId: teams[2] ? teams[2].ID : 3,
          coach: (teams[2] && teams[2].Presidente) ? teams[2].Presidente : 'Fantallenatore 3',
          Parz: 78.0,
          Max: 78.5,
          Scarto: 0.5,
          ModParz: '3-4-3',
          ModMax: '3-4-3',
          ScSuVoti: 0.25,
          Voti: 11
        };

        const worstMister = fm.worstMister || {
          Nome: teams[3] ? teams[3].Nome : 'Squadra Rimorso Panchina',
          teamId: teams[3] ? teams[3].ID : 4,
          coach: (teams[3] && teams[3].Presidente) ? teams[3].Presidente : 'Fantallenatore 4',
          Parz: 66.5,
          Max: 78.0,
          Scarto: 11.5,
          ModParz: '3-4-3',
          ModMax: '3-4-3',
          ScSuVoti: 1.45,
          Voti: 11
        };

        const topTotal = (topScore.total !== undefined ? topScore.total : (topScore.totalScore !== undefined ? topScore.totalScore : (topScore.Parz || 0)));
        const topPartial = (topScore.partial !== undefined ? topScore.partial : (topScore.Parz || 0));
        const topDiff = topTotal - topPartial;

        const flopTotal = (lowestScore.total !== undefined ? lowestScore.total : (lowestScore.totalScore !== undefined ? lowestScore.totalScore : (lowestScore.Parz || 0)));
        const flopPartial = (lowestScore.partial !== undefined ? lowestScore.partial : (lowestScore.Parz || 0));
        const flopDiff = flopTotal - flopPartial;

        return `
          <div class="card home-fantamister-card" style="margin-bottom:0;">
            <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;">
              <div class="card-title" style="display:flex;align-items:center;gap:8px;font-size:1.02rem;color:var(--text-primary);font-weight:700;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span>FantaMister • Giornata ${lastData.serieADay}</span>
              </div>
              <span class="badge badge-primary" style="font-size:0.75rem;">FantaMister &rarr;</span>
            </div>
            <div class="fantamister-coaches-grid">
              <div class="fantamister-coach-box coach-box-topscore">
                <div class="coach-badge-row"><span class="coach-ribbon-badge badge-emerald">🚀 Punteggio Top • Giornata ${lastData.serieADay}</span></div>
                <div class="coach-team-profile" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <img src="${this.getTeamLogoUrl(topScore.Nome || topScore.teamId)}" class="coach-team-logo" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <div>
                    <strong style="display:block;font-size:0.9rem;">${escapeHtml(topScore.Nome)}</strong>
                    <span style="font-size:0.75rem;color:var(--text-muted);">Mister: <strong>${escapeHtml(topScore.coach || 'Mister')}</strong></span>
                  </div>
                </div>
                <div class="coach-stats-metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;margin-bottom:8px;">
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTEGGIO TOTALE</span><strong class="val-topscore" style="font-size:1rem;color:#10b981;">${topTotal.toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">${topScore.goals !== undefined ? `${topScore.goals} gol` : 'Migliore'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PARZIALE PURO</span><strong style="font-size:1rem;">${topPartial.toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${topScore.ModParz || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">FATTORE &amp; MOD.</span><strong style="font-size:1rem;color:#10b981;">${topDiff >= 0 ? '+' : ''}${topDiff.toFixed(2)} pt</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">${topScore.isHome ? 'In casa (+2)' : 'Fuori casa'}</span></div>
                </div>
                <div class="coach-verdict verdict-topscore" style="font-size:0.75rem;color:var(--text-secondary);border-top:1px dashed var(--border-subtle);padding-top:6px;">
                  🔥 Miglior prestazione assoluta del turno con <strong>${topTotal.toFixed(2)} punti totali</strong>${topScore.opponentName ? ` (${topScore.goals || 0}-${topScore.opponentGoals || 0} contro ${escapeHtml(topScore.opponentName)})` : ''}.
                </div>
              </div>

              <div class="fantamister-coach-box coach-box-flopscore">
                <div class="coach-badge-row"><span class="coach-ribbon-badge badge-slate">📉 Punteggio Flop • Giornata ${lastData.serieADay}</span></div>
                <div class="coach-team-profile" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <img src="${this.getTeamLogoUrl(lowestScore.Nome || lowestScore.teamId)}" class="coach-team-logo" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <div>
                    <strong style="display:block;font-size:0.9rem;">${escapeHtml(lowestScore.Nome)}</strong>
                    <span style="font-size:0.75rem;color:var(--text-muted);">Mister: <strong>${escapeHtml(lowestScore.coach || 'Mister')}</strong></span>
                  </div>
                </div>
                <div class="coach-stats-metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;margin-bottom:8px;">
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTEGGIO TOTALE</span><strong class="val-flopscore" style="font-size:1rem;color:#f43f5e;">${flopTotal.toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">${lowestScore.goals !== undefined ? `${lowestScore.goals} gol` : 'Flop'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PARZIALE PURO</span><strong style="font-size:1rem;">${flopPartial.toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${lowestScore.ModParz || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">FATTORE &amp; MOD.</span><strong style="font-size:1rem;color:#f43f5e;">${flopDiff >= 0 ? '+' : ''}${flopDiff.toFixed(2)} pt</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">${lowestScore.isHome ? 'In casa (+2)' : 'Fuori casa'}</span></div>
                </div>
                <div class="coach-verdict verdict-flopscore" style="font-size:0.75rem;color:var(--text-secondary);border-top:1px dashed var(--border-subtle);padding-top:6px;">
                  ❄️ Punteggio totale più basso della giornata con <strong>${flopTotal.toFixed(2)} punti totali</strong>${lowestScore.opponentName ? ` (${lowestScore.goals || 0}-${lowestScore.opponentGoals || 0} contro ${escapeHtml(lowestScore.opponentName)})` : ''}.
                </div>
              </div>

              <div class="fantamister-coach-box coach-box-best">
                <div class="coach-badge-row"><span class="coach-ribbon-badge badge-gold">🥇 Scelta Perfetta • Miglior Mister</span></div>
                <div class="coach-team-profile" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <img src="${this.getTeamLogoUrl(bestMister.Nome || bestMister.teamId)}" class="coach-team-logo" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <div>
                    <strong style="display:block;font-size:0.9rem;">${escapeHtml(bestMister.Nome)}</strong>
                    <span style="font-size:0.75rem;color:var(--text-muted);">Mister: <strong>${escapeHtml(bestMister.coach || 'Mister')}</strong></span>
                  </div>
                </div>
                <div class="coach-stats-metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;margin-bottom:8px;">
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">TOTALE REALE</span><strong style="font-size:1rem;">${(bestMister.Parz || 0).toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${bestMister.ModParz || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTI MAX POTENZIALI</span><strong style="font-size:1rem;">${(bestMister.Max || 0).toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${bestMister.ModMax || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTI IN PANCHINA</span><strong style="font-size:1rem;color:#10b981;">-${(bestMister.Scarto || 0).toFixed(2)} pt</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Pesato: ${(bestMister.ScSuVoti !== undefined ? bestMister.ScSuVoti.toFixed(2) : '-')}</span></div>
                </div>
                <div class="coach-verdict verdict-best" style="font-size:0.75rem;color:var(--text-secondary);border-top:1px dashed var(--border-subtle);padding-top:6px;">
                  ✨ Formazione impeccabile: ha lasciato solo <strong>${(bestMister.Scarto || 0).toFixed(2)} pt</strong> tra le riserve.
                </div>
              </div>

              <div class="fantamister-coach-box coach-box-worst">
                <div class="coach-badge-row"><span class="coach-ribbon-badge badge-rose">🤦‍♂️ Rimorso Panchina • Peggior Mister</span></div>
                <div class="coach-team-profile" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <img src="${this.getTeamLogoUrl(worstMister.Nome || worstMister.teamId)}" class="coach-team-logo" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <div>
                    <strong style="display:block;font-size:0.9rem;">${escapeHtml(worstMister.Nome)}</strong>
                    <span style="font-size:0.75rem;color:var(--text-muted);">Mister: <strong>${escapeHtml(worstMister.coach || 'Mister')}</strong></span>
                  </div>
                </div>
                <div class="coach-stats-metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;margin-bottom:8px;">
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">TOTALE REALE</span><strong style="font-size:1rem;">${(worstMister.Parz || 0).toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${worstMister.ModParz || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTI MAX POTENZIALI</span><strong style="font-size:1rem;">${(worstMister.Max || 0).toFixed(2)}</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Modulo ${worstMister.ModMax || '-'}</span></div>
                  <div class="coach-metric-item"><span style="display:block;font-size:0.65rem;color:var(--text-muted);">PUNTI IN PANCHINA</span><strong style="font-size:1rem;color:#f43f5e;">-${(worstMister.Scarto || 0).toFixed(2)} pt</strong><span style="display:block;font-size:0.65rem;color:var(--text-muted);">Pesato: ${(worstMister.ScSuVoti !== undefined ? worstMister.ScSuVoti.toFixed(2) : '-')}</span></div>
                </div>
                <div class="coach-verdict verdict-worst" style="font-size:0.75rem;color:var(--text-secondary);border-top:1px dashed var(--border-subtle);padding-top:6px;">
                  ⚠️ Con la panchina avrebbe fatto <strong>${(worstMister.Max || 0).toFixed(2)} pt</strong> (+${(worstMister.Scarto || 0).toFixed(2)} pt sprecati).
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'topFlop11': {
        const teams = this.getLeagueTeams();
        const tf = this.topFlopData || {};
        const hasRealTop = tf.top11 && Array.isArray(tf.top11) && tf.top11.length >= 11;

        let pPlayers = [], dPlayers = [], cPlayers = [], aPlayers = [];
        let modStr = '3-4-3';

        if (hasRealTop) {
          pPlayers = tf.top11.filter(p => p.role === 1 || p.role === 'P');
          dPlayers = tf.top11.filter(p => p.role === 2 || p.role === 'D');
          cPlayers = tf.top11.filter(p => p.role === 3 || p.role === 'C');
          aPlayers = tf.top11.filter(p => p.role === 4 || p.role === 'A');
          modStr = `${dPlayers.length}-${cPlayers.length}-${aPlayers.length}`;
        } else {
          const getTeamName = (i) => (teams[i % teams.length] ? teams[i % teams.length].Nome : `Squadra ${(i % teams.length) + 1}`);
          pPlayers = [{ surname: 'PORTIERE', firstName: 'Titolare', roleLetter: 'P', club: getTeamName(0), vote: '8.5' }];
          dPlayers = [
            { surname: 'DIFENSORE', firstName: '1', roleLetter: 'D', club: getTeamName(1), vote: '10' },
            { surname: 'DIFENSORE', firstName: '2', roleLetter: 'D', club: getTeamName(2), vote: '7.0' },
            { surname: 'DIFENSORE', firstName: '3', roleLetter: 'D', club: getTeamName(3), vote: '6.75' }
          ];
          cPlayers = [
            { surname: 'CENTROCAMPISTA', firstName: '1', roleLetter: 'C', club: getTeamName(4), vote: '14' },
            { surname: 'CENTROCAMPISTA', firstName: '2', roleLetter: 'C', club: getTeamName(5), vote: '10.25' },
            { surname: 'CENTROCAMPISTA', firstName: '3', roleLetter: 'C', club: getTeamName(6), vote: '8.0' },
            { surname: 'CENTROCAMPISTA', firstName: '4', roleLetter: 'C', club: getTeamName(7), vote: '7.25' }
          ];
          aPlayers = [
            { surname: 'ATTACCANTE', firstName: '1', roleLetter: 'A', club: getTeamName(8), vote: '13.75' },
            { surname: 'ATTACCANTE', firstName: '2', roleLetter: 'A', club: getTeamName(9), vote: '10.75' },
            { surname: 'ATTACCANTE', firstName: '3', roleLetter: 'A', club: getTeamName(0), vote: '10.25' }
          ];
        }

        const renderRoleLine = (players, roleLetter) => {
          return `
            <div class="pitch-line">
              ${players.map(pl => {
            const sName = pl.surname || pl.player || pl.name || 'Giocatore';
            const fName = pl.firstName || '';
            const club = pl.fantasyTeam || pl.club || (teams[0] ? teams[0].Nome : 'Lega');
            const vote = pl.vote || '7.5';
            const photo = (pl.photo && !pl.photo.startsWith('../') && !pl.photo.startsWith('http') && !pl.photo.startsWith('/')) ? '../' + pl.photo : (pl.photo || '../img/foto/misterx.gif');
            return `
                  <div class="pitch-player">
                    <div class="pitch-player-avatar">
                      <img src="${photo}" class="pitch-player-photo" alt="${escapeHtml(sName)}" onerror="this.src='../img/foto/misterx.gif';" />
                      <span class="pitch-player-badge-role role-${roleLetter.toLowerCase()}">${roleLetter}</span>
                    </div>
                    <div class="pitch-player-name"><span class="pitch-player-surname">${escapeHtml(sName)}</span>${fName ? `<span class="pitch-player-firstname">${escapeHtml(fName)}</span>` : ''}</div>
                    <div class="pitch-player-club">${escapeHtml(club)}</div>
                    <div class="topflop-vote-badge topflop-vote-top">${vote}</div>
                  </div>
                `;
          }).join('')}
            </div>
          `;
        };

        const lastData = this.getLastMatchdayData();

        return `
          <div class="card topflop-widget-card" style="margin-bottom:0;">
            <div class="card-header topflop-card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span class="topflop-title-text">Top / Flop 11 • ${lastData.serieADay}ª Serie A</span>
              </div>
              <div class="topflop-controls">
                <div class="topflop-switch-pills">
                  <button type="button" class="topflop-pill active"><span>⭐</span> Top 11</button>
                  <button type="button" class="topflop-pill"><span>👎</span> Flop 11</button>
                </div>
              </div>
              <span class="badge badge-primary topflop-fantam-link">Fantamister &rarr;</span>
            </div>
            <div class="topflop-slide-header" style="padding:10px 16px 4px 16px;display:flex;align-items:center;justify-content:space-between;">
              <span class="badge badge-warning" style="background:rgba(234,179,8,0.18);color:#fbbf24;border:1px solid rgba(234,179,8,0.35);font-weight:800;font-size:0.75rem;padding:3px 8px;">⭐ TOP 11 • Modulo ${modStr}</span>
              <span class="topflop-slide-hint" style="font-size:0.75rem;color:var(--text-muted);">Migliori fantavoti di giornata</span>
            </div>
            <div class="pitch-container" style="margin:0 12px 12px 12px;min-height:360px;">
              ${this.getPitchSvgLines()}
              ${renderRoleLine(pPlayers, 'P')}
              ${renderRoleLine(dPlayers, 'D')}
              ${renderRoleLine(cPlayers, 'C')}
              ${renderRoleLine(aPlayers, 'A')}
            </div>
          </div>
        `;
      }

      case 'standings': {
        const mainComp = this.getResolvedMainComp();
        const mainCompName = mainComp ? mainComp.name : 'Lega';
        const standings = this.getLeagueStandings().slice(0, 10);
        const rowsHtml = standings.map((s, idx) => {
          const tName = s.name || `Squadra ${s.teamId || idx + 1}`;
          const logo = this.getTeamLogoUrl(tName || s.teamId);
          const trophies = this.getTeamTrophiesHtml(tName);
          const posClass = idx < 3 ? `table-pos-${idx + 1}` : '';
          return `
            <tr>
              <td class="table-pos ${posClass}">${idx + 1}</td>
              <td>
                <div class="table-col-team">
                  <img src="${logo}" style="width:22px;height:22px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <span>${escapeHtml(tName)}</span>
                  ${trophies}
                </div>
              </td>
              <td class="text-right table-pts font-bold">${s.points !== undefined ? s.points : 0}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                  <path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                </svg>
                Classifica ${escapeHtml(mainCompName)}
              </div>
              <span class="badge badge-primary">Completa &rarr;</span>
            </div>
            <div class="table-responsive">
              <table class="modern-table">
                <thead><tr><th style="width:28px;">#</th><th>Squadra</th><th class="text-right">PT</th></tr></thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      case 'gpStandings': {
        const gp = this.getLeagueGPStandings().slice(0, 10);
        const rowsHtml = gp.map((s, idx) => {
          const tName = s.name || `Squadra ${s.teamId || idx + 1}`;
          const logo = this.getTeamLogoUrl(tName || s.teamId);
          const trophies = this.getTeamTrophiesHtml(tName);
          const posClass = idx < 3 ? `table-pos-${idx + 1}` : '';
          const ptsVal = (typeof s.sommaTotali === 'number') ? s.sommaTotali.toFixed(2) : (s.sommaTotali || '0.00');
          return `
            <tr>
              <td class="table-pos ${posClass}">${idx + 1}</td>
              <td>
                <div class="table-col-team">
                  <img src="${logo}" style="width:22px;height:22px;object-fit:contain;" onerror="this.src='../img/sq/undefined.svg'" />
                  <span>${escapeHtml(tName)}</span>
                  ${trophies}
                </div>
              </td>
              <td class="text-right table-pts font-bold" style="color:var(--accent-cyan);">${ptsVal}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2"></rect><line x1="2" y1="7" x2="22" y2="7"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="17" x2="22" y2="17"></line>
                </svg>
                Classifica GP
              </div>
              <span class="badge badge-primary">Chiudi ▲</span>
            </div>
            <div class="table-responsive">
              <table class="modern-table">
                <thead><tr><th style="width:28px;">#</th><th>Squadra</th><th class="text-right">PT GP</th></tr></thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      case 'coppa': {
        const comps = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function') ? fcmDataLoader.getCompetitions() : [];
        const cfgCoppaId = this.currentConfig && this.currentConfig.defaultSettings
          ? this.currentConfig.defaultSettings.coppaCompId
          : 'auto';
        const coppaComp = (cfgCoppaId && cfgCoppaId !== 'auto' ? comps.find(c => String(c.id) === String(cfgCoppaId)) : null)
          || comps.find(c => c.id > 1 || (c.name && c.name.toLowerCase().includes('coppa')))
          || { name: 'Coppa di Lega' };
        if (coppaComp && coppaComp.id && typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.renderCompetitionStandingsWidget) {
          return fcmHomeConfigManager.renderCompetitionStandingsWidget({
            id: 'preview_coppa',
            title: coppaComp.name,
            compId: coppaComp.id,
            compFormat: 'auto',
            accordionMode: 'open',
            enabled: true
          }, { isMatchdayInProgress: false });
        }
        const teams = this.getLeagueTeams();
        const t1 = teams[0] || { Nome: 'Squadra 1', ID: 1 };
        const t2 = teams[1] || { Nome: 'Squadra 2', ID: 2 };
        const t3 = teams[2] || { Nome: 'Squadra 3', ID: 3 };
        const t4 = teams[3] || { Nome: 'Squadra 4', ID: 4 };

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title" style="font-size:0.95rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                ${escapeHtml(coppaComp.name || 'Coppa di Lega')}
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge badge-primary" style="font-size:0.68rem;">Completa &rarr;</span>
                <span class="badge badge-primary" style="font-size:0.68rem;">Chiudi ▲</span>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin:8px 0 12px 0;">
              <div class="coppa-phase-tabs">
                <button type="button" class="coppa-phase-btn active">Scontri Diretti</button>
                <button type="button" class="coppa-phase-btn">Classifica Gironi</button>
              </div>
            </div>
            <div class="matches-list">
              <div class="coppa-knockout-match">
                <div class="coppa-match-header"><span>FINALE</span><span class="coppa-match-day-badge">Finali Coppa</span></div>
                <div class="match-teams-row">
                  <div class="match-team home"><img src="${this.getTeamLogoUrl(t1.Nome || t1.ID)}" class="team-badge-img" style="width:22px;height:22px;" onerror="this.src='../img/sq/undefined.svg'" /><span class="team-name-text">${escapeHtml(t1.Nome)}</span></div>
                  <div class="match-score-pill"><span class="score-digits">2 - 1</span></div>
                  <div class="match-team away"><img src="${this.getTeamLogoUrl(t2.Nome || t2.ID)}" class="team-badge-img" style="width:22px;height:22px;" onerror="this.src='../img/sq/undefined.svg'" /><span class="team-name-text">${escapeHtml(t2.Nome)}</span></div>
                </div>
              </div>
              <div class="coppa-knockout-match">
                <div class="coppa-match-header"><span>FINALE 3/4 POSTO</span><span class="coppa-match-day-badge">Finali Coppa</span></div>
                <div class="match-teams-row">
                  <div class="match-team home"><img src="${this.getTeamLogoUrl(t3.Nome || t3.ID)}" class="team-badge-img" style="width:22px;height:22px;" onerror="this.src='../img/sq/undefined.svg'" /><span class="team-name-text">${escapeHtml(t3.Nome)}</span></div>
                  <div class="match-score-pill"><span class="score-digits">0 - 1</span></div>
                  <div class="match-team away"><img src="${this.getTeamLogoUrl(t4.Nome || t4.ID)}" class="team-badge-img" style="width:22px;height:22px;" onerror="this.src='../img/sq/undefined.svg'" /><span class="team-name-text">${escapeHtml(t4.Nome)}</span></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'liveTools':
        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>
                Live &amp; Strumenti
              </div>
            </div>
            <div class="live-links-grid">
              <div class="live-link-card">
                <img src="../img/live/logo-fc.png" alt="Fantacalcio" onerror="this.style.display='none'" />
                <span class="live-link-name">Live Fantacalcio</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/logo-fp.png" alt="Fantapazz" onerror="this.style.display='none'" />
                <span class="live-link-name">Live Fantapazz</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/logo-fm.png" alt="FantaMaster" onerror="this.style.display='none'" />
                <span class="live-link-name">Live FantaMaster</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/live_pianeta.png" alt="PianetaFC" onerror="this.style.display='none'" />
                <span class="live-link-name">Voti Ufficiosi</span>
              </div>
              <div class="live-link-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line>
                </svg>
                <span class="live-link-name">Calcolo Manuale</span>
              </div>
            </div>
          </div>
        `;

      case 'guestbook':
        return `
          <div class="card guestbook-preview-card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Guestbook di Lega
              </div>
              <span class="badge badge-success">Apri tutto &rarr;</span>
            </div>
            <div class="guestbook-preview-content">
              <div class="guestbook-preview-controls">
                <button type="button" class="icon-btn guestbook-arrow" disabled>&#8592;</button>
                <span class="guestbook-counter">1 / 1</span>
                <button type="button" class="icon-btn guestbook-arrow" disabled>&#8594;</button>
              </div>
              <div class="guestbook-post">
                <div class="guestbook-post-author" style="font-weight:700;color:var(--text-primary);margin-bottom:4px;">Fantallenatore</div>
                <div class="guestbook-post-date" style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">Oggi, 12:00</div>
                <div class="guestbook-post-text" style="font-size:0.84rem;color:var(--text-secondary);font-style:italic;">
                  "In bocca al lupo a tutte le squadre per il prossimo turno di campionato!"
                </div>
              </div>
              <span class="guestbook-open-link" style="display:block;margin-top:10px;font-size:0.78rem;color:var(--accent-primary);text-align:center;font-weight:600;">Scrivi o visualizza tutti i post &rarr;</span>
            </div>
          </div>
        `;

      case 'sponsors': {
        const sponsors = (this.currentConfig && Array.isArray(this.currentConfig.sponsors))
          ? this.currentConfig.sponsors
          : [];
        const withLogos = sponsors.filter(s => s && s.logo);
        const withoutLogos = sponsors.filter(s => s && !s.logo && (s.title || s.link));

        const logosHtml = withLogos.length > 0
          ? withLogos.map(s => {
            const safeLogo = this.sanitizeUrl(s.logo, false);
            if (!safeLogo) return '';
            const src = (safeLogo.startsWith('http') || safeLogo.startsWith('/') || safeLogo.startsWith('../')) ? safeLogo : `../${safeLogo}`;
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(s.title || 'Sponsor')}" title="${escapeHtml(s.title || '')}" style="max-height:36px;max-width:120px;object-fit:contain;" />`;
          }).join('')
          : '';

        const linksHtml = withoutLogos.length > 0
          ? withoutLogos.map(s => `<span class="sponsor-link" style="color:var(--accent-cyan);font-weight:600;font-size:0.85rem;">${escapeHtml(s.title || s.link)}</span>`).join('')
          : '';

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2"></rect><path d="M5 14l3-3"></path><path d="M19 10l-3 3"></path>
                </svg>
                Sponsor e Preferiti
              </div>
            </div>
            ${logosHtml ? `
              <div class="sponsors-strip" style="display:flex;align-items:center;justify-content:center;gap:20px;padding:12px;flex-wrap:wrap;">
                ${logosHtml}
              </div>
            ` : ''}
            ${linksHtml ? `
              <div class="sponsor-links" style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;padding:10px;">
                ${linksHtml}
              </div>
            ` : ''}
            ${!logosHtml && !linksHtml ? `
              <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem;">
                Nessuno sponsor inserito. Configurali nella sezione Sponsor e Preferiti sottostante.
              </div>
            ` : ''}
          </div>
        `;
      }

      case 'counter':
        return `
          <div class="card visitor-counter-card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                </svg>
                Visitatori del Sito
              </div>
              <span class="badge badge-primary">Statistiche &rarr;</span>
            </div>
            <div class="visitor-counter-badge-wrap" style="text-align:center;padding:12px;">
              <img src="../fkounter5/counter.php?id=index&mode=graphic&theme=light" width="98" height="38" alt="fanKounter" class="visitor-counter-img" onerror="this.outerHTML='<div style=\\'display:inline-block;padding:6px 12px;border-radius:6px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);font-weight:800;font-family:monospace;letter-spacing:2px;\\'>132601</div>';" />
            </div>
          </div>
        `;

      case 'nextDayPreview': {
        const nextData = this.getNextMatchdayData();
        const matchesToShow = (nextData.matches || []).slice(0, 5);
        const matchesHtml = matchesToShow.map(m => {
          const homeName = m.homeTeamName || `Squadra ${m.homeTeamId || 'A'}`;
          const awayName = m.awayTeamName || `Squadra ${m.awayTeamId || 'B'}`;
          const homeLogo = this.getTeamLogoUrl(homeName || m.homeTeamId);
          const awayLogo = this.getTeamLogoUrl(awayName || m.awayTeamId);
          const homeTrophies = this.getTeamTrophiesHtml(homeName);
          const awayTrophies = this.getTeamTrophiesHtml(awayName);

          return `
            <div class="match-card compact-match-card">
              <div class="match-teams-row">
                <div class="match-team home">
                  <img src="${homeLogo}" class="team-badge-img" onerror="this.src='../img/sq/undefined.svg'" />
                  <div class="team-info-wrap">
                    <span class="team-name-text">${escapeHtml(homeName)}</span>${homeTrophies}
                    <span class="match-lineup-box is-ok"><span class="lineup-icon">✓</span><span class="lineup-text">Formazione <strong>OK</strong></span></span>
                  </div>
                </div>
                <div class="match-score-pill"><span class="score-unplayed">VS</span></div>
                <div class="match-team away">
                  <img src="${awayLogo}" class="team-badge-img" onerror="this.src='../img/sq/undefined.svg'" />
                  <div class="team-info-wrap">
                    <span class="team-name-text">${escapeHtml(awayName)}</span>${awayTrophies}
                    <span class="match-lineup-box is-ok"><span class="lineup-icon">✓</span><span class="lineup-text">Formazione <strong>OK</strong></span></span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="card" style="margin-bottom:0;">
            <div class="card-header" style="align-items:flex-start;">
              <div>
                <div class="card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  Prossimo Turno • ${nextData.serieADay}ª Serie A
                </div>
                ${nextData.dateStr ? `
                <div class="card-subtitle-date" style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;margin-left:28px;display:flex;align-items:center;gap:5px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline>
                  </svg>
                  <span>${escapeHtml(nextData.dateStr)}</span>
                </div>` : ''}
              </div>
              <span class="badge badge-primary">Calendario &rarr;</span>
            </div>
            <div class="matchday-content-vertical">
              <div class="comp-group-block">
                <div class="comp-group-header">
                  <div class="comp-header-title"><span>${escapeHtml(nextData.compName || 'Lega')}</span></div>
                  <span class="comp-fanta-giornata">${escapeHtml(nextData.fantaDayName || '')}</span>
                </div>
                <div class="girone-matches-list">
                  ${matchesHtml || '<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.82rem;">Nessun incontro programmato per questo turno.</div>'}
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'bilancio': {
        const nextData = this.getNextMatchdayData();
        const matchesToShow = (nextData.matches || []).slice(0, 2);
        const rowsHtml = matchesToShow.map(m => {
          const homeName = m.homeTeamName || `Squadra ${m.homeTeamId || 'A'}`;
          const awayName = m.awayTeamName || `Squadra ${m.awayTeamId || 'B'}`;
          const homeLogo = this.getTeamLogoUrl(homeName || m.homeTeamId);
          const awayLogo = this.getTeamLogoUrl(awayName || m.awayTeamId);

          return `
            <tr class="bilancio-row bilancio-row-home">
              <td class="bilancio-team-cell"><div class="bilancio-team-info"><img src="${homeLogo}" class="bilancio-team-logo" onerror="this.src='../img/sq/undefined.svg'" /><span class="bilancio-team-name">${escapeHtml(homeName)}</span></div></td>
              <td class="text-center font-bold">12</td><td class="text-center"><span class="bilancio-pill pill-win has-data">5</span></td><td class="text-center"><span class="bilancio-pill pill-draw has-data">3</span></td><td class="text-center font-bold">18</td><td class="text-center font-bold">71.50</td><td class="text-center">210</td><td class="text-center">250</td>
            </tr>
            <tr class="bilancio-row bilancio-row-away">
              <td class="bilancio-team-cell"><div class="bilancio-team-info"><img src="${awayLogo}" class="bilancio-team-logo" onerror="this.src='../img/sq/undefined.svg'" /><span class="bilancio-team-name">${escapeHtml(awayName)}</span></div></td>
              <td class="text-center font-bold">12</td><td class="text-center"><span class="bilancio-pill pill-win has-data">4</span></td><td class="text-center"><span class="bilancio-pill pill-draw has-data">3</span></td><td class="text-center font-bold">16</td><td class="text-center font-bold">70.25</td><td class="text-center">195</td><td class="text-center">230</td>
            </tr>
            <tr class="bilancio-card-spacer"><td colspan="8"></td></tr>
          `;
        }).join('');

        return `
          <div class="card bilancio-card" style="margin-bottom:0;">
            <div class="card-header" style="flex-wrap:wrap;gap:8px;align-items:center;">
              <div class="card-title" style="display:flex;align-items:center;gap:8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path>
                </svg>
                <span>Bilancio Prossimo Turno • ${nextData.serieADay}ª Serie A</span>
              </div>
              <span class="badge badge-primary">Confronti Diretti &rarr;</span>
            </div>
            <div class="matchday-content-vertical bilancio-container">
              <div class="comp-group-block">
                <div class="comp-group-header">
                  <div class="comp-header-title"><span>${escapeHtml(nextData.compName || 'Lega')}</span></div>
                  <span class="comp-fanta-giornata">${escapeHtml(nextData.fantaDayName || '')}</span>
                </div>
                <div class="table-responsive bilancio-table-responsive">
                  <table class="bilancio-table">
                    <thead>
                      <tr>
                        <th class="bilancio-th-team">Squadra</th>
                        <th class="text-center bilancio-th-stat">Giocate</th>
                        <th class="text-center bilancio-th-stat">Vittorie</th>
                        <th class="text-center bilancio-th-stat">Pareggi</th>
                        <th class="text-center bilancio-th-stat">Goal</th>
                        <th class="text-center bilancio-th-stat">Punti</th>
                        <th class="text-center bilancio-th-stat">Panc.Com.</th>
                        <th class="text-center bilancio-th-stat">Panc.Tot.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rowsHtml}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'quotes': {
        const nextData = this.getNextMatchdayData();
        const matchesToShow = (nextData.matches || []).slice(0, 3);
        const rowsHtml = matchesToShow.map(m => {
          const homeName = m.homeTeamName || `Squadra ${m.homeTeamId || 'A'}`;
          const awayName = m.awayTeamName || `Squadra ${m.awayTeamId || 'B'}`;
          const homeLogo = this.getTeamLogoUrl(homeName || m.homeTeamId);
          const awayLogo = this.getTeamLogoUrl(awayName || m.awayTeamId);

          return `
            <tr class="quote-row">
              <td class="quote-col-match">
                <div class="quote-match-teams">
                  <div class="quote-team home"><img src="${homeLogo}" class="quote-team-logo" onerror="this.src='../img/sq/undefined.svg'" /><span class="quote-team-name">${escapeHtml(homeName)}</span></div>
                  <span class="quote-vs">vs</span>
                  <div class="quote-team away"><img src="${awayLogo}" class="quote-team-logo" onerror="this.src='../img/sq/undefined.svg'" /><span class="quote-team-name">${escapeHtml(awayName)}</span></div>
                </div>
              </td>
              <td class="text-center"><span class="quote-val-pill">2.40</span></td>
              <td class="text-center"><span class="quote-val-pill">3.10</span></td>
              <td class="text-center"><span class="quote-val-pill quote-val-pill-fav" style="background:#10b981;color:#fff;">2.10</span></td>
              <td class="text-center"><span class="quote-val-pill">1.85</span></td>
              <td class="text-center"><span class="quote-val-pill">1.85</span></td>
            </tr>
          `;
        }).join('');

        return `
          <div class="card quote-card" style="margin-bottom:0;">
            <div class="card-header" style="flex-wrap:wrap;gap:8px;align-items:center;">
              <div class="card-title" style="display:flex;align-items:center;gap:8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><path d="M7 10l2 2 3-3 5 5"></path>
                </svg>
                <span>Quote Scommesse • ${nextData.serieADay}ª Serie A</span>
              </div>
              <span class="badge badge-success" style="font-size:0.7rem;">1X2 &amp; U/O</span>
            </div>
            <div class="table-responsive quote-table-responsive">
              <table class="modern-table quote-table">
                <thead>
                  <tr>
                    <th class="quote-th-match">Incontro</th>
                    <th class="text-center quote-th-odd">1</th>
                    <th class="text-center quote-th-odd">X</th>
                    <th class="text-center quote-th-odd">2</th>
                    <th class="text-center quote-th-odd">U</th>
                    <th class="text-center quote-th-odd">O</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      case 'liveMatchday':
        return `
          <div class="card live-matchday-card" style="margin-bottom:0;border:1px solid rgba(239,68,68,0.35);">
            <div class="live-matchday-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border-subtle);">
              <div class="live-matchday-title" style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--accent-rose);">
                <span class="card-live-dot"></span>
                <span>Live in corso • Giornata Serie A</span>
              </div>
              <span class="badge badge-danger">Live Match</span>
            </div>
            <div style="padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg-surface-elevated);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-weight:700;">Squadra Casa</span>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:1.3rem;font-weight:800;color:var(--accent-rose);">2 - 1</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">(73.5 - 68.0)</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-weight:700;">Squadra Ospite</span>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.8rem;color:var(--text-secondary);">
                <div>⚽ Retegui 68'</div>
                <div style="text-align:right;">⚽ Lautaro 24'</div>
              </div>
            </div>
          </div>
        `;

      case 'liveHero':
        return `
          <div class="card live-hero-card" style="border:1px solid rgba(239,68,68,0.35);background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(37,99,235,0.08));margin-bottom:0;padding:16px;">
            <div class="card-header" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border-subtle);">
              <div class="card-title" style="color:var(--accent-rose);font-size:1.02rem;display:flex;align-items:center;gap:8px;">
                <span class="card-live-dot"></span>
                Giornata in Corso • Live Fantacalcio, Fantapazz, FantaMaster &amp; Voti Ufficiosi
              </div>
              <span class="badge badge-danger">Live Match</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.4;">
              Il termine per l'invio delle formazioni è scaduto. Segui la giornata in tempo reale con i voti live, le pagelle e il calcolo manuale dei risultati:
            </p>
            <div class="live-links-grid live-hero-grid">
              <div class="live-link-card">
                <img src="../img/live/logo-fc.png" alt="Fantacalcio" onerror="this.style.display='none'" />
                <span class="live-link-name">Live Fantacalcio</span>
                <span class="live-link-sub">Voti Live &amp; Pagelle</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/logo-fp.png" alt="Fantapazz" onerror="this.style.display='none'" />
                <span class="live-link-name">Live Fantapazz</span>
                <span class="live-link-sub">Voti live &amp; Bonus</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/logo-fm.png" alt="FantaMaster" onerror="this.style.display='none'" />
                <span class="live-link-name">Live FantaMaster</span>
                <span class="live-link-sub">Diretta Gol &amp; Voti</span>
              </div>
              <div class="live-link-card">
                <img src="../img/live/live_pianeta.png" alt="PianetaFC" onerror="this.style.display='none'" />
                <span class="live-link-name">Voti Ufficiosi</span>
                <span class="live-link-sub">PianetaFantacalcio</span>
              </div>
              <div class="live-link-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line>
                </svg>
                <span class="live-link-name">Calcolo Manuale</span>
                <span class="live-link-sub">Simulatore partita</span>
              </div>
            </div>
          </div>
        `;

      case 'miniFormations': {
        const lastData = this.getLastMatchdayData();
        const match = (lastData.matches && lastData.matches[0]) ? lastData.matches[0] : null;
        const teams = this.getLeagueTeams();
        const homeName = (match && match.homeTeamName) ? match.homeTeamName : (teams[0] ? teams[0].Nome : 'Squadra Casa');
        const awayName = (match && match.awayTeamName) ? match.awayTeamName : (teams[1] ? teams[1].Nome : 'Squadra Trasferta');
        const homeLogo = this.getTeamLogoUrl(homeName || (match ? match.homeTeamId : null));
        const awayLogo = this.getTeamLogoUrl(awayName || (match ? match.awayTeamId : null));
        const homeTrophies = this.getTeamTrophiesHtml(homeName);
        const awayTrophies = this.getTeamTrophiesHtml(awayName);

        let homeStarters = 'Falcone, Bellanova, Bremer, Buongiorno, Barella, Calhanoglu, Colpani, Koopmeiners, Lautaro, Lookman, Retegui';
        let awayStarters = 'Sommer, Bastoni, Dimarco, Pavard, Mkhitaryan, Pellegrini, Rabiot, Zaccagni, Chiesa, Giroud, Lukaku';

        if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamRoster === 'function') {
          if (match && match.homeTeamId) {
            const rHome = fcmDataLoader.getTeamRoster(match.homeTeamId);
            if (rHome && rHome.attuali && rHome.attuali.length >= 11) {
              homeStarters = rHome.attuali.slice(0, 11).map(p => p.name).join(', ');
            }
          }
          if (match && match.awayTeamId) {
            const rAway = fcmDataLoader.getTeamRoster(match.awayTeamId);
            if (rAway && rAway.attuali && rAway.attuali.length >= 11) {
              awayStarters = rAway.attuali.slice(0, 11).map(p => p.name).join(', ');
            }
          }
        }

        return `
          <div class="card formations-widget-card" style="margin-bottom:0;border:1px solid rgba(37,99,235,0.35);">
            <div class="card-header" style="border-bottom:1px solid var(--border-subtle);padding-bottom:8px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
              <div class="card-title" style="font-size:1rem;color:var(--accent-primary);display:flex;align-items:center;gap:8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"></rect><circle cx="12" cy="12" r="4"></circle></svg>
                <span>Formazioni • ${lastData.serieADay}ª Serie A</span>
              </div>
              <span class="badge badge-primary">Tutte le Formazioni &rarr;</span>
            </div>
            <div class="formations-slider-track">
              <div class="formations-match-slide">
                <div class="formations-slide-meta"><span class="formations-girone-tag">${escapeHtml(lastData.compName || 'Lega')} (${escapeHtml(lastData.fantaDayName || '')})</span></div>
                <div class="formations-slide-grid" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                  <div class="formations-team-col" style="flex:1;">
                    <div class="formations-team-header" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                      <img src="${homeLogo}" class="formations-team-logo" style="width:24px;height:24px;" onerror="this.src='../img/sq/undefined.svg'" />
                      <span class="formations-team-name" style="font-weight:700;font-size:0.85rem;">${escapeHtml(homeName)}</span>${homeTrophies}
                      <span class="formations-module-badge" style="font-size:0.7rem;padding:1px 6px;border-radius:4px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);">3-4-3</span>
                    </div>
                    <div class="formations-section-label" style="font-size:0.68rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Titolari</div>
                    <div class="mini-for-list starters" style="font-size:0.75rem;line-height:1.4;">
                      ${escapeHtml(homeStarters)}
                    </div>
                  </div>
                  <div class="formations-vs-pillar" style="font-weight:800;font-size:0.75rem;color:var(--text-muted);padding-top:10px;">VS</div>
                  <div class="formations-team-col" style="flex:1;">
                    <div class="formations-team-header" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                      <img src="${awayLogo}" class="formations-team-logo" style="width:24px;height:24px;" onerror="this.src='../img/sq/undefined.svg'" />
                      <span class="formations-team-name" style="font-weight:700;font-size:0.85rem;">${escapeHtml(awayName)}</span>${awayTrophies}
                      <span class="formations-module-badge" style="font-size:0.7rem;padding:1px 6px;border-radius:4px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);">3-4-3</span>
                    </div>
                    <div class="formations-section-label" style="font-size:0.68rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Titolari</div>
                    <div class="mini-for-list starters" style="font-size:0.75rem;line-height:1.4;">
                      ${escapeHtml(awayStarters)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      case 'anticipo': {
        const nextData = this.getNextMatchdayData();
        return `
          <div class="card" style="border:1px solid rgba(16,185,129,0.35);background:linear-gradient(135deg,rgba(16,185,129,0.06),rgba(6,182,212,0.06));margin-bottom:0;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div>
                <div style="font-weight:700;font-size:1rem;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line>
                  </svg>
                  Anticipo Formazione • Prossimo Turno: ${nextData.serieADay}ª di Serie A
                </div>
                <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">
                  Puoi già inviare in anticipo la formazione per la <strong>${nextData.serieADay}ª giornata</strong>.
                </div>
              </div>
              <span class="btn-invio-form" style="margin-top:0;">Schiera per la ${nextData.serieADay}ª &rarr;</span>
            </div>
          </div>
        `;
      }

      default:
        if (customObj && typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.renderCustomWidget === 'function') {
          try {
            const rendered = fcmHomeConfigManager.renderCustomWidget(customObj, { isMatchdayInProgress: false });
            if (rendered) return rendered;
          } catch (e) {
            console.warn('Errore rendering custom widget preview:', e);
          }
        }
        return `
          <div class="card" style="margin-bottom:0;border:1px solid rgba(6,182,212,0.35);">
            <div class="card-header">
              <div class="card-title" style="color:var(--accent-cyan);">${escapeHtml(customObj ? customObj.title : itemId)}</div>
              <span class="badge badge-primary">Personalizzato</span>
            </div>
            <div style="padding:8px 0;font-size:0.85rem;color:var(--text-secondary);">
              ${escapeHtml((customObj && customObj.content) || (customObj && customObj.desc) || 'Widget personalizzato ModernFCM')}
            </div>
          </div>
        `;
    }
  },

  renderColumnItems(colKey) {
    const list = this.currentConfig.columns[colKey] || [];
    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    if (list.length === 0) {
      return '<div style="padding:14px;color:#94a3b8;font-size:0.82rem;text-align:center;">Nessun widget in questa colonna.</div>';
    }

    return list.map((item, idx) => {
      const isCustom = item.isCustom || (item.id && item.id.startsWith('custom_'));
      let title = item.id;
      let badgeHtml = '';
      let customObj = null;

      if (isCustom) {
        customObj = (this.currentConfig.customWidgets || []).find(w => w.id === item.id);
        title = customObj ? customObj.title : item.id;
        badgeHtml = '<span class="badge badge-primary" style="font-size:0.68rem;padding:2px 6px;">Personalizzato</span>';
      } else if (typeof fcmHomeConfigManager !== 'undefined') {
        const def = fcmHomeConfigManager.standardWidgets[item.id];
        if (def) title = def.title;
      }

      const isFirst = idx === 0;
      const isLast = idx === list.length - 1;
      const isEnabled = item.enabled !== false;
      const isItemCollapsed = (this.collapsedItemsMap && this.collapsedItemsMap[item.id] !== undefined)
        ? !!this.collapsedItemsMap[item.id]
        : this.previewsCollapsed;
      const previewSnippet = this.getWidgetPreviewSnippet(item.id, customObj);

      return `
        <div class="admin-home-item ${isCustom ? 'admin-home-item-custom' : ''} ${!isEnabled ? 'is-disabled' : ''} ${isItemCollapsed ? 'is-collapsed' : ''}" data-col="${colKey}" data-index="${idx}" data-id="${escapeHtml(item.id)}" draggable="true">
          <div class="admin-home-item-header">
            <div class="widget-edit-drag-grip" style="cursor:grab;padding:0 4px;color:#94a3b8;" title="Trascina per ordinare">
              ⠿
            </div>
            <div class="admin-home-arrows">
              <button type="button" class="admin-arrow-btn btn-col-up" data-col="${colKey}" data-index="${idx}" ${isFirst ? 'disabled' : ''} title="Sposta su">▲</button>
              <button type="button" class="admin-arrow-btn btn-col-down" data-col="${colKey}" data-index="${idx}" ${isLast ? 'disabled' : ''} title="Sposta giù">▼</button>
            </div>
            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">${escapeHtml(title)}</span>
              ${badgeHtml}
              ${customObj && customObj.type ? `<span class="badge badge-secondary" style="font-size:0.65rem;padding:1px 5px;opacity:0.85;">${escapeHtml(customObj.type)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <label class="home-custom-switch" title="${isEnabled ? 'Visibile a tutti' : 'Nascosto a tutti'}">
                <input type="checkbox" class="admin-toggle-input" data-col="${colKey}" data-index="${idx}" ${isEnabled ? 'checked' : ''}>
                <span class="home-custom-slider"></span>
              </label>
              ${isCustom ? `
                <button type="button" class="btn-col-action btn-preview-custom-widget" data-id="${escapeHtml(item.id)}" title="Visualizza anteprima modale">
                  👁️
                </button>
                <button type="button" class="btn-col-action btn-edit-custom-widget" data-id="${escapeHtml(item.id)}" data-col="${colKey}" title="Modifica widget">
                  ✏️
                </button>
                <button type="button" class="btn-col-action btn-delete-custom-widget" data-id="${escapeHtml(item.id)}" title="Elimina widget personalizzato">
                  🗑️
                </button>
              ` : ''}
              <button type="button" class="admin-preview-toggle-btn btn-toggle-item-preview" data-col="${colKey}" data-index="${idx}" title="Espandi / Comprimi anteprima">
                <span class="toggle-preview-icon">${isItemCollapsed ? '▼' : '▲'}</span>
              </button>
            </div>
          </div>
          <div class="admin-home-item-preview">
            ${previewSnippet}
          </div>
        </div>
      `;
    }).join('');
  },

  attachColumnEvents(colKey) {
    const listEl = document.getElementById(colKey === 'main' ? 'adminColMainList' : 'adminColSideList');
    if (!listEl) return;

    listEl.querySelectorAll('.btn-col-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const list = this.currentConfig.columns[colKey];
          const [moved] = list.splice(idx, 1);
          list.splice(idx - 1, 0, moved);
          this.setDirty(true);
          this.renderColumns();
        }
      });
    });

    listEl.querySelectorAll('.btn-col-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const list = this.currentConfig.columns[colKey];
        if (idx < list.length - 1) {
          const [moved] = list.splice(idx, 1);
          list.splice(idx + 1, 0, moved);
          this.setDirty(true);
          this.renderColumns();
        }
      });
    });

    listEl.querySelectorAll('.admin-toggle-input').forEach(chk => {
      const handleToggle = (e) => {
        if (e) e.stopPropagation();
        const idx = parseInt(chk.dataset.index, 10);
        if (this.currentConfig && this.currentConfig.columns && this.currentConfig.columns[colKey]) {
          const item = this.currentConfig.columns[colKey][idx];
          if (item) {
            item.enabled = chk.checked;
            this.setDirty(true);
            const row = chk.closest('.admin-home-item');
            if (row) row.classList.toggle('is-disabled', !chk.checked);
          }
        }
      };
      chk.addEventListener('change', handleToggle);
      chk.addEventListener('click', (e) => e.stopPropagation());
    });

    listEl.querySelectorAll('.btn-preview-custom-widget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.previewCustomWidget(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-edit-custom-widget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editCustomWidget(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-delete-custom-widget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDeleteCustomWidget(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-toggle-item-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemEl = btn.closest('.admin-home-item');
        if (itemEl) {
          const isCollapsed = itemEl.classList.toggle('is-collapsed');
          const icon = btn.querySelector('.toggle-preview-icon');
          if (icon) {
            icon.textContent = isCollapsed ? '▼' : '▲';
          }
          const itemId = itemEl.dataset.id;
          if (itemId) {
            if (!this.collapsedItemsMap) this.collapsedItemsMap = {};
            this.collapsedItemsMap[itemId] = isCollapsed;
            try {
              localStorage.setItem('fcm_admin_collapsed_items', JSON.stringify(this.collapsedItemsMap));
            } catch (err) { }
          }
        }
      });
    });

    // Drag & Drop HTML5 per riordinare gli elementi
    const items = listEl.querySelectorAll('.admin-home-item');
    items.forEach(itemEl => {
      itemEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ col: colKey, index: parseInt(itemEl.dataset.index, 10) }));
        e.dataTransfer.effectAllowed = 'move';
        itemEl.classList.add('is-dragging');
      });

      itemEl.addEventListener('dragend', () => {
        itemEl.classList.remove('is-dragging');
        listEl.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
      });

      itemEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        itemEl.classList.add('is-drop-target');
      });

      itemEl.addEventListener('dragleave', () => {
        itemEl.classList.remove('is-drop-target');
      });

      itemEl.addEventListener('drop', (e) => {
        e.preventDefault();
        itemEl.classList.remove('is-drop-target');
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (!raw) return;
          const data = JSON.parse(raw);
          const targetIdx = parseInt(itemEl.dataset.index, 10);
          if (data.col === colKey) {
            if (data.index !== targetIdx) {
              const list = this.currentConfig.columns[colKey];
              const [moved] = list.splice(data.index, 1);
              list.splice(targetIdx, 0, moved);
              this.setDirty(true);
              this.renderColumns();
            }
          } else {
            const sourceList = this.currentConfig.columns[data.col];
            const targetList = this.currentConfig.columns[colKey];
            if (sourceList && targetList) {
              const [moved] = sourceList.splice(data.index, 1);
              targetList.splice(targetIdx, 0, moved);
              this.setDirty(true);
              this.renderColumns();
            }
          }
        } catch (err) {
          console.warn('Errore drop admin:', err);
        }
      });
    });
  },

  openBuilder(colKeyOrWidget, widgetToEdit) {
    const builderSection = document.getElementById('adminUnifiedBuilderSection');
    if (!builderSection) return;

    let targetWidget = widgetToEdit;
    let colKey = 'main';

    if (colKeyOrWidget && typeof colKeyOrWidget === 'object') {
      targetWidget = colKeyOrWidget;
      colKey = targetWidget.column || 'main';
    } else if (typeof colKeyOrWidget === 'string') {
      colKey = colKeyOrWidget;
    }

    const isEditing = !!targetWidget;
    const editingIdInput = document.getElementById('customWidgetEditingId');
    const titleEl = document.getElementById('builderSectionTitle');
    const iconEl = document.getElementById('builderSectionIcon');
    const descEl = document.getElementById('builderSectionDesc');
    const submitBtn = document.getElementById('btnSubmitCustomWidget');

    builderSection.style.display = 'block';

    if (isEditing) {
      if (editingIdInput) editingIdInput.value = targetWidget.id || '';
      if (iconEl) iconEl.textContent = '✏️';
      if (titleEl) titleEl.textContent = `Modifica Widget: ${targetWidget.title || ''}`;
      if (descEl) descEl.textContent = 'Modifica i dettagli e la configurazione del widget. Salva per aggiornare il widget in homepage.';
      if (submitBtn) submitBtn.innerHTML = '<span>💾 Salva Modifiche Widget</span>';

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };
      setVal('customWidgetType', targetWidget.type || 'banner');
      setVal('customWidgetColumn', targetWidget.column || colKey || 'main');
      setVal('customWidgetTitle', targetWidget.title || '');
      setVal('customWidgetBadge', targetWidget.badge || '');
      setVal('customWidgetBadgeColor', targetWidget.badgeColor || 'primary');
      setVal('customWidgetVisibility', targetWidget.visibility || 'always');
      setVal('customWidgetExpires', targetWidget.expiresAt ? targetWidget.expiresAt.substring(0, 16) : '');
      setVal('customWidgetContentText', targetWidget.content || targetWidget.description || '');
      setVal('customWidgetBtnText', targetWidget.btnText || '');
      setVal('customWidgetBtnLink', targetWidget.btnLink || '');
      setVal('customWidgetBtnTarget', targetWidget.btnTarget || '_self');
      setVal('customWidgetTargetDate', targetWidget.targetDate ? targetWidget.targetDate.substring(0, 16) : '');
      setVal('customWidgetSubtitle', targetWidget.subtitle || '');
      setVal('customWidgetImageUrl', targetWidget.imageUrl || '');
      setVal('customWidgetCaption', targetWidget.caption || '');
      setVal('customWidgetEmbedHtml', targetWidget.embedHtml || '');
      setVal('customWidgetCompId', targetWidget.compId !== undefined && targetWidget.compId !== null ? String(targetWidget.compId) : '');
      setVal('customWidgetCompFormat', targetWidget.compFormat || 'auto');
      setVal('customWidgetAccordionMode', targetWidget.accordionMode || 'static');
    } else {
      if (editingIdInput) editingIdInput.value = '';
      if (iconEl) iconEl.textContent = '✨';
      if (titleEl) titleEl.textContent = 'Crea Nuovo Widget Personalizzato';
      if (descEl) descEl.textContent = 'Scegli il modello, compila le informazioni e controlla l\'anteprima in tempo reale prima di pubblicarlo. Potrai poi spostarlo liberamente tra le colonne.';
      if (submitBtn) submitBtn.innerHTML = '<span>➕ Pubblica Widget Personalizzato</span>';

      const comps = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function') ? fcmDataLoader.getCompetitions() : [];
      const defaultComp = comps[0] || null;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };
      setVal('customWidgetType', 'banner');
      setVal('customWidgetColumn', colKey || 'main');
      setVal('customWidgetTitle', 'Nuovo Avviso');
      setVal('customWidgetBadge', 'Ufficiale');
      setVal('customWidgetBadgeColor', 'primary');
      setVal('customWidgetVisibility', 'always');
      setVal('customWidgetExpires', '');
      setVal('customWidgetContentText', 'Si comunica che...');
      setVal('customWidgetBtnText', '');
      setVal('customWidgetBtnLink', '');
      setVal('customWidgetBtnTarget', '_self');
      setVal('customWidgetTargetDate', '');
      setVal('customWidgetSubtitle', '');
      setVal('customWidgetImageUrl', '');
      setVal('customWidgetCaption', '');
      setVal('customWidgetEmbedHtml', '');
      setVal('customWidgetCompId', defaultComp ? String(defaultComp.id) : '');
      setVal('customWidgetCompFormat', 'auto');
      setVal('customWidgetAccordionMode', 'static');
    }

    this.updateFieldVisibility();
    this.updatePreview();

    try {
      builderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // fallback
    }
  },

  closeBuilder() {
    const builderSection = document.getElementById('adminUnifiedBuilderSection');
    if (builderSection) {
      builderSection.style.display = 'none';
    }
    const editingIdInput = document.getElementById('customWidgetEditingId');
    if (editingIdInput) editingIdInput.value = '';
  },

  editCustomWidget(id) {
    const customObj = (this.currentConfig.customWidgets || []).find(w => w.id === id);
    if (customObj) {
      this.openBuilder(customObj.column || 'main', customObj);
    } else {
      alert('Widget personalizzato non trovato.');
    }
  },

  previewCustomWidget(id) {
    const customObj = (this.currentConfig.customWidgets || []).find(w => w.id === id);
    if (!customObj) {
      alert('Widget non trovato per l\'anteprima.');
      return;
    }

    const modal = document.getElementById('adminWidgetPreviewModalBackdrop');
    const modalTitle = document.getElementById('adminPreviewModalTitle');
    const modalBody = document.getElementById('adminWidgetPreviewModalBody');
    const btnEdit = document.getElementById('adminPreviewModalBtnEdit');

    if (!modal || !modalBody) return;

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    if (modalTitle) {
      modalTitle.innerHTML = `<span>👁️</span> Anteprima: <em>${escapeHtml(customObj.title || 'Widget')}</em>`;
    }

    if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.renderCustomWidget) {
      modalBody.innerHTML = fcmHomeConfigManager.renderCustomWidget(customObj, { isMatchdayInProgress: false });
      if (fcmHomeConfigManager.initCustomCompetitionWidgets) {
        fcmHomeConfigManager.initCustomCompetitionWidgets(modalBody);
      }
    } else {
      modalBody.innerHTML = `<pre style="color:var(--text-primary);">${escapeHtml(JSON.stringify(customObj, null, 2))}</pre>`;
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        this.closePreviewModal();
        this.editCustomWidget(id);
      };
    }

    modal.style.display = 'flex';
  },

  closePreviewModal() {
    const modal = document.getElementById('adminWidgetPreviewModalBackdrop');
    if (modal) modal.style.display = 'none';
  },

  confirmDeleteCustomWidget(id) {
    if (confirm('Sei sicuro di voler eliminare definitivamente questo widget personalizzato?')) {
      this.deleteCustomWidget(id);
    }
  },

  renderCustomWidgetsList() {
    const container = document.getElementById('adminCustomWidgetsSummary');
    if (!container) return;

    const list = this.currentConfig.customWidgets || [];
    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    if (list.length === 0) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.85rem;text-align:center;">Nessun widget personalizzato creato finora. Clicca su "Crea Nuovo Widget Personalizzato" per crearne uno!</div>';
      return;
    }

    container.innerHTML = list.map(w => {
      let extraMeta = '';
      if (w.type === 'competition_standings') {
        const comps = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCompetitions) ? fcmDataLoader.getCompetitions() : [];
        const cObj = comps.find(c => String(c.id) === String(w.compId));
        const fmtLabels = {
          auto: 'Automatica',
          round_robin: 'Girone all\'italiana',
          knockout: 'Scontri diretti',
          hybrid: 'Ibrida (Gironi + Scontri diretti)',
          gp: 'Classifica GP'
        };
        extraMeta = ` &bull; Competizione: <strong>${escapeHtml(cObj ? cObj.name : (w.compId || '-'))}</strong> &bull; Formula: <strong>${escapeHtml(fmtLabels[w.compFormat || 'auto'] || w.compFormat)}</strong>`;
      }
      // L'id entra in un onclick: prima diventa una stringa JS, poi viene codificato per l'attributo HTML
      const idArg = escapeHtml(JSON.stringify(String(w.id || '')));
      return `
        <div class="admin-summary-card">
          <div style="flex:1;min-width:240px;">
            <div style="font-weight:700;color:var(--text-primary);font-size:0.92rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span>${escapeHtml(w.title)}</span>
              <span class="badge badge-primary" style="font-size:0.68rem;">${escapeHtml(w.type === 'competition_standings' ? '🏆 Classifica Competizione' : (w.type || 'banner'))}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">
              Visibilità: <strong>${escapeHtml(w.visibility || 'sempre')}</strong>${extraMeta} ${w.expiresAt ? `&bull; Scadenza: <strong>${new Date(w.expiresAt).toLocaleString('it-IT')}</strong>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-col-action btn-preview-custom-widget" onclick="fcmHomepageAdmin.previewCustomWidget(${idArg})" title="Visualizza anteprima">
              👁️ Anteprima
            </button>
            <button type="button" class="btn-col-action btn-edit-custom-widget" onclick="fcmHomepageAdmin.editCustomWidget(${idArg})" title="Modifica widget">
              ✏️ Modifica
            </button>
            <button type="button" class="btn-col-action btn-delete-custom-widget" onclick="fcmHomepageAdmin.confirmDeleteCustomWidget(${idArg})" title="Elimina widget">
              🗑️ Elimina
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  initBuilderForm() {
    const typeSelect = document.getElementById('customWidgetType');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const isEditing = !!(document.getElementById('customWidgetEditingId')?.value);
        if (typeSelect.value === 'competition_standings' && !isEditing) {
          const colSel = document.getElementById('customWidgetColumn');
          if (colSel) colSel.value = 'side';
          this.autoSyncCompetitionTitle(true);
        }
        this.updateFieldVisibility();
        this.updatePreview();
      });
    }

    const compSelect = document.getElementById('customWidgetCompId');
    if (compSelect) {
      compSelect.addEventListener('change', () => {
        this.autoSyncCompetitionTitle(false);
        this.updateCompetitionHint();
        this.updatePreview();
      });
    }

    // Monitora tutti gli input del form per l'anteprima live
    const form = document.getElementById('adminCustomWidgetForm');
    if (form) {
      form.addEventListener('input', () => this.updatePreview());
      form.addEventListener('change', () => this.updatePreview());
    }
    this.updateFieldVisibility();
  },

  autoSyncCompetitionTitle(forceIfDefault = false) {
    const type = document.getElementById('customWidgetType')?.value;
    if (type !== 'competition_standings') return;
    const compId = document.getElementById('customWidgetCompId')?.value;
    const titleInput = document.getElementById('customWidgetTitle');
    if (!compId || !titleInput) return;

    const comps = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCompetitions) ? fcmDataLoader.getCompetitions() : [];
    const comp = comps.find(c => String(c.id) === String(compId));
    if (!comp) return;

    const currentTitle = (titleInput.value || '').trim();
    const isGenericOrCompName = !currentTitle ||
      currentTitle === 'Nuovo Avviso' ||
      currentTitle === 'Avviso Importante' ||
      comps.some(c => c.name === currentTitle || `Classifica ${c.name}` === currentTitle);

    if (forceIfDefault || isGenericOrCompName) {
      titleInput.value = comp.name;
    }
  },

  updateCompetitionHint() {
    const hintEl = document.getElementById('customWidgetCompDetectedHint');
    const compId = document.getElementById('customWidgetCompId')?.value;
    if (!hintEl) return;
    if (!compId || typeof fcmHomeConfigManager === 'undefined' || !fcmHomeConfigManager.detectCompetitionFormat) {
      hintEl.innerHTML = '💡 Seleziona una competizione per mostrare in homepage la classifica a gironi, il tabellone a scontri diretti o entrambi.';
      return;
    }
    const det = fcmHomeConfigManager.detectCompetitionFormat(compId);
    if (det && det.comp) {
      const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
      hintEl.innerHTML = `🤖 Formula rilevata automaticamente per <strong>${escapeHtml(det.comp.name)}</strong>: <strong>${escapeHtml(det.label)}</strong>. Puoi lasciare "Automatica" o forzare un formato specifico.`;
    }
  },

  updateFieldVisibility() {
    const type = document.getElementById('customWidgetType')?.value || 'banner';
    const groupContent = document.getElementById('groupWidgetContent');
    const groupLink = document.getElementById('groupWidgetLink');
    const groupCountdown = document.getElementById('groupWidgetCountdown');
    const groupImage = document.getElementById('groupWidgetImage');
    const groupEmbed = document.getElementById('groupWidgetEmbed');
    const groupCompetition = document.getElementById('groupWidgetCompetition');

    if (groupContent) groupContent.style.display = (type === 'banner' || type === 'button_card') ? 'block' : 'none';
    if (groupLink) groupLink.style.display = (type === 'banner' || type === 'button_card' || type === 'image' || type === 'countdown') ? 'block' : 'none';
    if (groupCountdown) groupCountdown.style.display = (type === 'countdown') ? 'block' : 'none';
    if (groupImage) groupImage.style.display = (type === 'image') ? 'block' : 'none';
    if (groupEmbed) groupEmbed.style.display = (type === 'embed') ? 'block' : 'none';
    if (groupCompetition) {
      groupCompetition.style.display = (type === 'competition_standings') ? 'block' : 'none';
      if (type === 'competition_standings') {
        this.updateCompetitionHint();
      }
    }
  },

  getFormData() {
    const type = document.getElementById('customWidgetType')?.value || 'banner';
    const title = document.getElementById('customWidgetTitle')?.value || 'Titolo del Widget';
    const badge = document.getElementById('customWidgetBadge')?.value || '';
    const badgeColor = document.getElementById('customWidgetBadgeColor')?.value || 'primary';
    const column = document.getElementById('customWidgetColumn')?.value || 'main';
    const visibility = document.getElementById('customWidgetVisibility')?.value || 'always';
    const expiresAt = document.getElementById('customWidgetExpires')?.value || null;

    const content = document.getElementById('customWidgetContentText')?.value || '';
    const btnText = document.getElementById('customWidgetBtnText')?.value || '';
    const btnLink = document.getElementById('customWidgetBtnLink')?.value || '';
    const btnTarget = document.getElementById('customWidgetBtnTarget')?.value || '_self';

    const targetDate = document.getElementById('customWidgetTargetDate')?.value || '';
    const subtitle = document.getElementById('customWidgetSubtitle')?.value || '';

    const imageUrl = document.getElementById('customWidgetImageUrl')?.value || '';
    const caption = document.getElementById('customWidgetCaption')?.value || '';
    const embedHtml = document.getElementById('customWidgetEmbedHtml')?.value || '';

    const compId = document.getElementById('customWidgetCompId')?.value || '';
    const compFormat = document.getElementById('customWidgetCompFormat')?.value || 'auto';
    const accordionMode = document.getElementById('customWidgetAccordionMode')?.value || 'static';

    return {
      title,
      type,
      column,
      badge,
      badgeColor,
      visibility,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      content,
      description: content,
      btnText,
      btnLink,
      btnTarget,
      targetDate,
      subtitle,
      imageUrl,
      caption,
      embedHtml,
      compId,
      compFormat,
      accordionMode,
      enabled: true
    };
  },

  updatePreview() {
    const previewContainer = document.getElementById('adminWidgetLivePreview');
    if (!previewContainer) return;

    const widgetData = this.getFormData();
    widgetData.id = 'preview_widget';

    if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.renderCustomWidget) {
      previewContainer.innerHTML = fcmHomeConfigManager.renderCustomWidget(widgetData, { isMatchdayInProgress: false });
      if (fcmHomeConfigManager.initCustomCompetitionWidgets) {
        fcmHomeConfigManager.initCustomCompetitionWidgets(previewContainer);
      }
    }
  },

  async submitCustomWidget() {
    const data = this.getFormData();
    if (!data.title || data.title.trim() === '') {
      alert('Inserisci un titolo per il widget personalizzato.');
      return;
    }

    const editingIdInput = document.getElementById('customWidgetEditingId');
    const editingId = editingIdInput ? editingIdInput.value.trim() : '';
    if (editingId) {
      data.id = editingId;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch(this.getApiUrl('save_custom_widget'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result && result.success) {
        var msg = editingId ? '✅ Widget personalizzato modificato con successo!' : '✅ Widget creato con successo!';
        if (typeof showToast === 'function') {
          showToast(msg, 'success');
        } else {
          alert(msg);
        }
        this.closeBuilder();
        await this.loadConfig();
        this.renderColumns();
        this.renderCustomWidgetsList();
        this.updatePreview();
      } else {
        var errMsg = '❌ Errore salvataggio widget: ' + (result.error || 'Operazione fallita');
        if (typeof showToast === 'function') {
          showToast(errMsg, 'error');
        } else {
          alert(errMsg);
        }
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        showToast('❌ Errore di comunicazione col server: ' + e, 'error');
      } else {
        alert('Errore di comunicazione col server: ' + e);
      }
    }
  },

  async addCustomWidget() {
    return this.submitCustomWidget();
  },

  async deleteCustomWidget(id) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch(this.getApiUrl('delete_custom_widget'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (result && result.success) {
        if (typeof showToast === 'function') {
          showToast('🗑️ Widget eliminato con successo.', 'info');
        }
        await this.loadConfig();
        this.renderColumns();
        this.renderCustomWidgetsList();
        this.updatePreview();
      } else {
        var errMsg = '❌ Errore eliminazione: ' + (result.error || 'Operazione fallita');
        if (typeof showToast === 'function') {
          showToast(errMsg, 'error');
        } else {
          alert(errMsg);
        }
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        showToast('❌ Errore eliminazione: ' + e, 'error');
      } else {
        alert('Errore eliminazione: ' + e);
      }
    }
  },

  setDirty(dirty) {
    this.isDirty = !!dirty;
    const badges = document.querySelectorAll('.badgeHomeChanges, #adminHomeBadgeChanges, #adminHomeBadgeChangesSticky');
    badges.forEach(b => {
      b.className = dirty ? 'badge-status-changes has-changes badgeHomeChanges' : 'badge-status-changes no-changes badgeHomeChanges';
      b.innerHTML = dirty ? '<span>🟡</span> Modifiche alla homepage non salvate' : '<span>⚪</span> Nessuna modifica non salvata';
    });

    const saveBtns = document.querySelectorAll('.btnSaveHomeGlobalConfig, #btnSaveHomeGlobalConfig, #btnSaveHomeGlobalConfigSticky');
    saveBtns.forEach(btn => {
      btn.disabled = !dirty;
      if (dirty) {
        btn.removeAttribute('disabled');
      } else {
        btn.setAttribute('disabled', 'disabled');
      }
    });

    const cancelBtns = document.querySelectorAll('.btnCancelHomeChanges, #btnCancelHomeChanges, #btnCancelHomeChangesSticky');
    cancelBtns.forEach(btn => {
      btn.disabled = !dirty;
      if (dirty) {
        btn.removeAttribute('disabled');
      } else {
        btn.setAttribute('disabled', 'disabled');
      }
    });
  },

  cancelChanges() {
    if (!this.initialConfig || !this.isDirty) return;
    this.currentConfig = JSON.parse(JSON.stringify(this.initialConfig));
    this.syncDefaultSettingsInputs();
    this.renderColumns();
    this.renderCustomWidgetsList();
    this.renderSponsorsList();
    this.updateSponsorsCardPreview();
    this.setDirty(false);
    if (typeof showToast === 'function') {
      showToast('↩️ Modifiche annullate.', 'info');
    }
  },

  restoreDefaultConfig() {
    if (!confirm('Sei sicuro di voler ripristinare il layout standard della homepage?\nI widget personalizzati creati non verranno cancellati, ma saranno rimossi dalla visualizzazione delle colonne.')) {
      return;
    }

    let defaultConfig = null;
    if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.getDefaultConfig === 'function') {
      defaultConfig = fcmHomeConfigManager.getDefaultConfig();
    } else {
      defaultConfig = {
        defaultSettings: {
          favoriteTeamId: null,
          topFlopDefaultTab: 'top',
          quotesMode: 'all',
          gpAccordionOpen: true,
          coppaAccordionOpen: false,
          coppaDefaultTab: 'knockout'
        },
        columns: {
          main: [
            { id: 'liveMatchday', enabled: true },
            { id: 'news', enabled: true },
            { id: 'results', enabled: true },
            { id: 'countdown', enabled: true },
            { id: 'topFlop11', enabled: true },
            { id: 'bestWorstMister', enabled: true },
            { id: 'anticipo', enabled: true },
            { id: 'nextDayPreview', enabled: true },
            { id: 'bilancio', enabled: true },
            { id: 'quotes', enabled: true }
          ],
          side: [
            { id: 'standings', enabled: true },
            { id: 'gpStandings', enabled: true },
            { id: 'coppa', enabled: true },
            { id: 'liveTools', enabled: true },
            { id: 'guestbook', enabled: true },
            { id: 'sponsors', enabled: true },
            { id: 'counter', enabled: true }
          ]
        }
      };
    }

    if (!this.currentConfig) {
      this.currentConfig = {
        version: 1,
        columns: { main: [], side: [] },
        customWidgets: []
      };
    }

    // Ripristina ordine e abilitazione standard sulle colonne
    this.currentConfig.columns = JSON.parse(JSON.stringify(defaultConfig.columns));
    // Ripristina impostazioni default
    this.currentConfig.defaultSettings = JSON.parse(JSON.stringify(defaultConfig.defaultSettings));
    // Ripristina sponsor default
    this.currentConfig.sponsors = Array.isArray(defaultConfig.sponsors) ? JSON.parse(JSON.stringify(defaultConfig.sponsors)) : [];
    // Imposta timestamp di reset per sovrascrivere i localStorage obsoleti dei visitatori
    const now = Date.now();
    this.currentConfig.layoutResetAt = now;
    this.currentConfig.lastUpdated = now;
    // NOTA: this.currentConfig.customWidgets rimane intatto, non viene cancellato!

    // Reset immediato del localStorage locale del browser attuale dell'admin
    try {
      localStorage.removeItem('pn_home_layout');
      if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.resetToDefault === 'function') {
        fcmHomeConfigManager.resetToDefault();
      }
    } catch (e) { }

    this.syncDefaultSettingsInputs();
    this.renderColumns();
    this.renderCustomWidgetsList();
    this.renderSponsorsList();
    this.updateSponsorsCardPreview();
    this.setDirty(true);

    if (typeof showToast === 'function') {
      showToast('🔄 Layout di default ripristinato. Salva per confermare.', 'info');
    }
  },

  async saveGlobalConfig() {
    if (!this.currentConfig) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch(this.getApiUrl('save_config'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(this.currentConfig)
      });
      const result = await res.json();
      if (result && result.success) {
        if (!this.currentConfig.sponsors || !Array.isArray(this.currentConfig.sponsors)) {
          this.currentConfig.sponsors = [];
        }

        this.initialConfig = JSON.parse(JSON.stringify(this.currentConfig));
        this.setDirty(false);

        // Se era un ripristino di layout, ripulisce anche localmente
        if (this.currentConfig.layoutResetAt) {
          try {
            localStorage.removeItem('pn_home_layout');
            if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.resetToDefault === 'function') {
              fcmHomeConfigManager.resetToDefault();
            }
          } catch (e) { }
        }

        if (typeof showToast === 'function') {
          showToast('✅ Configurazione globale della Homepage salvata con successo!', 'success');
        } else {
          alert('Configurazione globale della Homepage salvata con successo!');
        }
      } else {
        var errMsg = '❌ Errore durante il salvataggio: ' + (result.error || 'Operazione fallita');
        if (typeof showToast === 'function') {
          showToast(errMsg, 'error');
        } else {
          alert(errMsg);
        }
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        showToast('❌ Errore durante il salvataggio: ' + e, 'error');
      } else {
        alert('Errore durante il salvataggio: ' + e);
      }
    }
  },

  /**
   * =========================================================================
   * GESTIONE SPONSOR E PREFERITI
   * =========================================================================
   */

  async loadSponsorImages() {
    try {
      const res = await fetch(this.getApiUrl('list_sponsor_images') + '&_t=' + Date.now());
      const data = await res.json();
      if (data && data.success && Array.isArray(data.images)) {
        this.sponsorImages = data.images;
      }
    } catch (e) {
      console.warn('Errore recupero lista immagini sponsor:', e);
      this.sponsorImages = [];
    }
  },

  renderSponsorsList() {
    const container = document.getElementById('adminSponsorsContainer');
    if (!container) return;

    if (!this.currentConfig) return;
    if (!Array.isArray(this.currentConfig.sponsors)) {
      this.currentConfig.sponsors = [];
    }

    const sponsors = this.currentConfig.sponsors;
    if (sponsors.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; background: var(--bg-surface-elevated, #1e293b); border: 1px dashed var(--border-subtle, rgba(255,255,255,0.15)); border-radius: 10px; color: var(--text-muted);">
          <div style="font-size: 1.8rem; margin-bottom: 6px;">🤝</div>
          <p style="margin: 0; font-size: 0.88rem; font-weight: 600; color: var(--text-secondary);">Nessuno sponsor o collegamento preferito presente.</p>
          <p style="margin: 4px 0 0 0; font-size: 0.78rem;">Clicca su <strong>Aggiungi Sponsor / Preferito</strong> per inserire il primo.</p>
        </div>
      `;
      return;
    }

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    container.innerHTML = sponsors.map((sp, idx) => {
      const spTitle = sp.title || `Sponsor #${idx + 1}`;
      const safeLogo = this.sanitizeUrl(sp.logo, false);
      const hasLogo = Boolean(safeLogo);
      const logoSrc = hasLogo
        ? ((safeLogo.startsWith('http') || safeLogo.startsWith('/') || safeLogo.startsWith('../')) ? safeLogo : '../' + safeLogo)
        : '';

      const isFirst = idx === 0;
      const isLast = idx === sponsors.length - 1;

      // Opzioni per select logo
      const optionsHtml = this.sponsorImages.map(img => {
        const isSel = (sp.logo === img.path || sp.logo === img.filename);
        return `<option value="${escapeHtml(img.path)}" ${isSel ? 'selected' : ''}>${escapeHtml(img.filename)}</option>`;
      }).join('');

      return `
        <div class="admin-sponsor-card" data-index="${idx}">
          <div class="admin-sponsor-card-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-primary" style="font-size:0.72rem;padding:2px 7px;">#${idx + 1}</span>
              <strong style="font-size:0.88rem;color:var(--text-primary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(spTitle)}</strong>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <button type="button" class="icon-btn" onclick="fcmHomepageAdmin.moveSponsor(${idx}, -1)" ${isFirst ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Sposta su">▲</button>
              <button type="button" class="icon-btn" onclick="fcmHomepageAdmin.moveSponsor(${idx}, 1)" ${isLast ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Sposta giù">▼</button>
              <button type="button" class="icon-btn" onclick="fcmHomepageAdmin.removeSponsor(${idx})" style="color:var(--accent-rose,#ef4444);margin-left:4px;" title="Elimina questo sponsor">🗑️</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">Titolo / Nome:</label>
              <input type="text" class="assoc-search-input" style="width:100%;box-sizing:border-box;" value="${escapeHtml(sp.title || '')}" placeholder="Es: Pizzeria Da Mario" oninput="fcmHomepageAdmin.onSponsorFieldChange(${idx}, 'title', this.value)" />
            </div>
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">Link URL (opzionale):</label>
              <input type="text" class="assoc-search-input" style="width:100%;box-sizing:border-box;" value="${escapeHtml(sp.link || '')}" placeholder="Es: https://... o #voti" oninput="fcmHomepageAdmin.onSponsorFieldChange(${idx}, 'link', this.value)" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">Logo Sponsor:</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <select class="calc-input-select" style="flex:1;min-width:180px;box-sizing:border-box;" onchange="fcmHomepageAdmin.onSponsorLogoSelect(${idx}, this.value)">
                <option value="">-- Nessun logo (Solo link testuale) --</option>
                ${optionsHtml}
              </select>
              <button type="button" class="calc-btn-action" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;" onclick="fcmHomepageAdmin.triggerSponsorLogoUpload(${idx})" title="Carica un'immagine dal tuo computer nella cartella img/sponsor">
                <span>📁 Carica</span>
              </button>
              <input type="file" id="sponsorLogoFile_${idx}" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" onchange="fcmHomepageAdmin.handleSponsorLogoUpload(${idx}, this)" />

              <div class="admin-sponsor-mini-logo" id="sponsorMiniLogo_${idx}" style="width:48px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--bg-surface-elevated,#1e293b);border:1px solid var(--border-subtle);border-radius:6px;overflow:hidden;flex-shrink:0;">
                ${hasLogo
          ? `<img src="${escapeHtml(logoSrc)}" alt="Logo" style="max-height:30px;max-width:44px;object-fit:contain;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.6rem;color:var(--text-muted);\\'>Err</span>'" />`
          : `<span style="font-size:0.62rem;color:var(--text-muted);">No logo</span>`
        }
              </div>
            </div>

            <div style="margin-top:6px;">
              <input type="text" class="assoc-search-input" style="width:100%;box-sizing:border-box;font-size:0.78rem;" value="${escapeHtml(sp.logo || '')}" placeholder="Percorso o URL logo (es: img/sponsor/logo.png)" oninput="fcmHomepageAdmin.onSponsorFieldChange(${idx}, 'logo', this.value)" />
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  updateSponsorsCardPreview() {
    const previewContainer = document.getElementById('adminSponsorsLiveCardPreview');
    if (!previewContainer) return;

    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) {
      previewContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;">Nessuna configurazione disponibile</div>';
      return;
    }

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const sponsors = this.currentConfig.sponsors;
    const withLogos = sponsors.filter(s => s && s.logo);
    const withoutLogos = sponsors.filter(s => s && !s.logo && (s.title || s.link));

    let bodyHtml = '';

    if (withLogos.length > 0) {
      bodyHtml += `
        <div class="sponsors-strip" style="display:flex;align-items:center;justify-content:center;gap:24px;padding:16px;flex-wrap:wrap;">
          ${withLogos.map(s => {
        const safeLogo = this.sanitizeUrl(s.logo, false);
        if (!safeLogo) return '';
        const safeLink = this.sanitizeUrl(s.link, true);
        const src = (safeLogo.startsWith('http') || safeLogo.startsWith('/') || safeLogo.startsWith('../')) ? safeLogo : `../${safeLogo}`;
        const imgHtml = `<img src="${escapeHtml(src)}" class="sponsor-logo" alt="${escapeHtml(s.title || 'Sponsor')}" title="${escapeHtml(s.title || '')}" style="max-height:48px;max-width:130px;object-fit:contain;" />`;
        return safeLink
          ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;">${imgHtml}</a>`
          : `<span>${imgHtml}</span>`;
      }).join('')}
        </div>
      `;
    }

    if (withoutLogos.length > 0) {
      bodyHtml += `
        <div class="sponsor-links" style="display:flex;justify-content:center;gap:16px 24px;flex-wrap:wrap;padding:12px 16px;">
          ${withoutLogos.map(s => {
        const safeLink = this.sanitizeUrl(s.link, true);
        return safeLink
          ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="sponsor-link" style="color:var(--accent-cyan);font-weight:600;text-decoration:none;">${escapeHtml(s.title || safeLink)}</a>`
          : `<span class="sponsor-link" style="font-weight:600;">${escapeHtml(s.title || s.link)}</span>`;
      }).join('')}
        </div>
      `;
    }

    if (withLogos.length === 0 && withoutLogos.length === 0) {
      bodyHtml = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          <span>Nessuno sponsor o preferito inserito al momento.<br><small>La card rimarrà nascosta ai visitatori finché non inserisci almeno una voce.</small></span>
        </div>
      `;
    }

    previewContainer.innerHTML = `
      <div class="card" style="margin-bottom:0;box-shadow:none;border:1px solid var(--border-subtle);">
        <div class="card-header">
          <div class="card-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2"></rect>
              <path d="M5 14l3-3"></path>
              <path d="M19 10l-3 3"></path>
              <path d="M8 11l2-2a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-1.5 1.5"></path>
              <path d="M16 13l-2 2a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8l1.5-1.5"></path>
            </svg>
            Sponsor e Preferiti
          </div>
        </div>
        ${bodyHtml}
      </div>
    `;

    // Aggiorna anche l'anteprima del widget nella colonna layout (se presente)
    const colPreview = document.querySelector('.admin-home-item[data-id="sponsors"] .admin-home-item-preview');
    if (colPreview) {
      colPreview.innerHTML = this.getWidgetPreviewSnippet('sponsors');
    }
  },

  addSponsor() {
    if (!this.currentConfig) return;
    if (!Array.isArray(this.currentConfig.sponsors)) {
      this.currentConfig.sponsors = [];
    }
    this.currentConfig.sponsors.push({
      id: 'sp_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title: '',
      link: '',
      logo: ''
    });
    this.renderSponsorsList();
    this.updateSponsorsCardPreview();
    this.setDirty(true);
  },

  removeSponsor(idx) {
    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) return;
    if (idx >= 0 && idx < this.currentConfig.sponsors.length) {
      this.currentConfig.sponsors.splice(idx, 1);
      this.renderSponsorsList();
      this.updateSponsorsCardPreview();
      this.setDirty(true);
    }
  },

  moveSponsor(idx, dir) {
    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) return;
    const targetIdx = idx + dir;
    if (targetIdx >= 0 && targetIdx < this.currentConfig.sponsors.length) {
      const [item] = this.currentConfig.sponsors.splice(idx, 1);
      this.currentConfig.sponsors.splice(targetIdx, 0, item);
      this.renderSponsorsList();
      this.updateSponsorsCardPreview();
      this.setDirty(true);
    }
  },

  onSponsorFieldChange(idx, field, value) {
    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) return;
    if (this.currentConfig.sponsors[idx]) {
      this.currentConfig.sponsors[idx][field] = value;

      if (field === 'logo') {
        const miniEl = document.getElementById(`sponsorMiniLogo_${idx}`);
        if (miniEl) {
          const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
          const safeLogo = this.sanitizeUrl(value, false);
          const hasLogo = Boolean(safeLogo);
          const logoSrc = hasLogo
            ? ((safeLogo.startsWith('http') || safeLogo.startsWith('/') || safeLogo.startsWith('../')) ? safeLogo : '../' + safeLogo)
            : '';
          miniEl.innerHTML = hasLogo
            ? `<img src="${escapeHtml(logoSrc)}" alt="Logo" style="max-height:30px;max-width:44px;object-fit:contain;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.6rem;color:var(--text-muted);\\'>Err</span>'" />`
            : `<span style="font-size:0.62rem;color:var(--text-muted);">No logo</span>`;
        }
      }

      this.updateSponsorsCardPreview();
      this.setDirty(true);
    }
  },

  onSponsorLogoSelect(idx, path) {
    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) return;
    if (this.currentConfig.sponsors[idx]) {
      this.currentConfig.sponsors[idx].logo = path;
      this.renderSponsorsList();
      this.updateSponsorsCardPreview();
      this.setDirty(true);
    }
  },

  triggerSponsorLogoUpload(idx) {
    const input = document.getElementById(`sponsorLogoFile_${idx}`);
    if (input) {
      input.click();
    }
  },

  async handleSponsorLogoUpload(idx, input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const formData = new FormData();
    formData.append('logo', file);

    try {
      if (typeof showToast === 'function') {
        showToast('⏳ Caricamento logo in corso...', 'info');
      }

      const csrf = this.getCsrfToken();
      const res = await fetch(this.getApiUrl('upload_sponsor_logo'), {
        method: 'POST',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        body: formData
      });
      const data = await res.json();

      if (data && data.success && data.path) {
        if (!this.sponsorImages.some(img => img.path === data.path)) {
          this.sponsorImages.push({
            filename: data.filename || file.name,
            path: data.path
          });
        }

        if (this.currentConfig && Array.isArray(this.currentConfig.sponsors) && this.currentConfig.sponsors[idx]) {
          this.currentConfig.sponsors[idx].logo = data.path;
        }

        this.renderSponsorsList();
        this.updateSponsorsCardPreview();
        this.setDirty(true);

        if (typeof showToast === 'function') {
          showToast('✅ Logo caricato con successo in img/sponsor!', 'success');
        }
      } else {
        alert(data.error || 'Errore durante il caricamento del file');
      }
    } catch (err) {
      console.error('Errore upload logo:', err);
      alert('Errore di comunicazione con il server durante il caricamento del logo.');
    }
  },

  async saveSponsors() {
    if (!this.currentConfig || !Array.isArray(this.currentConfig.sponsors)) return;

    const saveBtns = document.querySelectorAll('#btnSaveSponsorsHeader, #btnSaveSponsorsBottom');
    saveBtns.forEach(btn => {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Salvataggio...</span>';
    });

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch(this.getApiUrl('save_sponsors'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ sponsors: this.currentConfig.sponsors })
      });
      const data = await res.json();

      if (data && data.success) {
        if (Array.isArray(data.sponsors)) {
          this.currentConfig.sponsors = data.sponsors;
          if (this.initialConfig) {
            this.initialConfig.sponsors = JSON.parse(JSON.stringify(data.sponsors));
          }
        }
        this.renderSponsorsList();
        this.updateSponsorsCardPreview();
        this.setDirty(false);

        if (typeof showToast === 'function') {
          showToast('✅ Sponsor e Preferiti salvati con successo!', 'success');
        } else {
          alert('Sponsor e Preferiti salvati con successo!');
        }
      } else {
        const msg = '❌ Errore durante il salvataggio: ' + (data.error || 'Operazione fallita');
        if (typeof showToast === 'function') {
          showToast(msg, 'error');
        } else {
          alert(msg);
        }
      }
    } catch (err) {
      console.error('Errore salvataggio sponsor:', err);
      const msg = '❌ Errore durante il salvataggio: ' + (err.message || err);
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      } else {
        alert(msg);
      }
    } finally {
      saveBtns.forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = '<span>💾 Salva Sponsor e Preferiti</span>';
      });
    }
  }
};

// Inizializzazione automatica robusta se il tab Home è già presente o visibile
if (typeof document !== 'undefined') {
  const tryInitHomeAdmin = () => {
    const tabHome = document.getElementById('tabContentHome');
    if (tabHome && tabHome.style.display !== 'none' && !window.fcmHomeAdminInitialized) {
      window.fcmHomeAdminInitialized = true;
      fcmHomepageAdmin.init();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitHomeAdmin);
  } else {
    tryInitHomeAdmin();
  }
}
