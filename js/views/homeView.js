/**
 * HOME VIEW (DASHBOARD)
 * ModernFCM
 */

const homeView = {
  countdownInterval: null,
  anticipoInterval: null,
  isEditMode: false,
  tempConfig: null,
  container: null,
  _liveDataStore: {
    vu: { voti: [], partite: {}, loaded: false },
    fp: { voti: [], partite: {}, loaded: false },
    fm: { voti: [], partite: {}, loaded: false },
    fc: { voti: [], partite: {}, loaded: false },
    fantapazz: { voti: [], partite: {}, loaded: false },
    fantamaster: { voti: [], partite: {}, loaded: false },
    fantacalcio: { voti: [], partite: {}, loaded: false }
  },
  _activeSecondaryLive: 'fantacalcio',
  _liveAutoRefreshInterval: null,
  _visibilityHandler: null,
  _isExtractingLive: false,
  _lastLiveRefreshTime: 0,

  _getSecondaryData(source) {
    if (!source || !this._liveDataStore) return { voti: [], partite: {}, loaded: false };
    const s = String(source).toLowerCase();
    if (s === 'fantapazz' || s === 'fp') {
      return this._liveDataStore.fantapazz || this._liveDataStore.fp || { voti: [], partite: {}, loaded: false };
    }
    if (s === 'fantamaster' || s === 'fm') {
      return this._liveDataStore.fantamaster || this._liveDataStore.fm || { voti: [], partite: {}, loaded: false };
    }
    if (s === 'fantacalcio' || s === 'fc') {
      return this._liveDataStore.fantacalcio || this._liveDataStore.fc || { voti: [], partite: {}, loaded: false };
    }
    return this._liveDataStore[s] || { voti: [], partite: {}, loaded: false };
  },

  _setSecondaryData(source, data) {
    if (!source || !this._liveDataStore) return;
    const s = String(source).toLowerCase();
    if (s === 'fantapazz' || s === 'fp') {
      this._liveDataStore.fantapazz = data;
      this._liveDataStore.fp = data;
    } else if (s === 'fantamaster' || s === 'fm') {
      this._liveDataStore.fantamaster = data;
      this._liveDataStore.fm = data;
    } else if (s === 'fantacalcio' || s === 'fc') {
      this._liveDataStore.fantacalcio = data;
      this._liveDataStore.fc = data;
    } else {
      this._liveDataStore[s] = data;
    }
  },

  /**
   * I file dei voti live sono condivisi tra tutti i visitatori e possono contenere una giornata diversa da quella
   * mostrata in home. FALSE se i metadati della fonte ('vu', 'fantacalcio', 'fantapazz', 'fantamaster') indicano
   * un'altra giornata: in quel caso il file non va caricato, o i voti finirebbero sulle formazioni sbagliate.
   */
  async _isLiveFeedOfDay(source, day) {
    const metaBySource = {
      vu: ['js/fcmVotiDatiVUMeta.json', 'giornata'],
      fantacalcio: ['js/fcmVotiDatiFCMeta.json', 'giornataFC'],
      fantapazz: ['js/fcmVotiDatiFPMeta.json', 'giornataFP'],
      fantamaster: ['js/fcmVotiDatiFMMeta.json', 'giornataFM']
    };
    const meta = Object.prototype.hasOwnProperty.call(metaBySource, source) ? metaBySource[source] : null;
    if (!meta || typeof fetch === 'undefined') return true;
    try {
      const res = await fetch(`${meta[0]}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return true;
      const data = await res.json();
      const feedDay = data ? Number(data[meta[1]]) : 0;
      return !feedDay || feedDay === Number(day);
    } catch (e) {
      return true;
    }
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
    this.container = container;
    this._hasAutoRefreshedLiveVU = false;

    // Attiva subito il rilevamento dello scorrimento per l'header
    this.initHeaderAutoHide();
    if (this.isEditMode) {
      document.body.classList.add('is-home-editing');
    } else {
      document.body.classList.remove('is-home-editing');
      if (typeof fcmSkeleton !== 'undefined') {
        container.innerHTML = fcmSkeleton.dashboard();
      }
    }

    // Inizializza o recupera la configurazione attiva (Default di Lega + Override Utente)
    let homeConfig = null;
    if (typeof fcmHomeConfigManager !== 'undefined') {
      homeConfig = await fcmHomeConfigManager.init();
    }

    if (this.isEditMode && !this.tempConfig) {
      this.tempConfig = JSON.parse(JSON.stringify(homeConfig || (typeof fcmHomeConfigManager !== 'undefined' ? fcmHomeConfigManager.getDefaultConfig() : {})));
    }

    const activeConfig = this.isEditMode ? this.tempConfig : homeConfig;
    const favoriteTeamId = (activeConfig && activeConfig.defaultSettings && activeConfig.defaultSettings.favoriteTeamId !== undefined)
      ? activeConfig.defaultSettings.favoriteTeamId
      : ((typeof fcmHomeConfigManager !== 'undefined') ? fcmHomeConfigManager.getFavoriteTeamId() : null);
    const userSettings = (activeConfig && activeConfig.defaultSettings) ? activeConfig.defaultSettings : {};

    const info = fcmDataLoader.getLeagueInfo();
    const calendar = fcmDataLoader.getCalendarData();
    const lastDayMatches = calendar.matches.filter(m => m.serieADay === calendar.lastPlayed);
    const lastDaySerieADay = lastDayMatches.length > 0 ? (lastDayMatches[0].serieADay || calendar.lastPlayed) : calendar.lastPlayed;

    const [topFlopData] = await Promise.all([
      fcmDataLoader.loadTopFlop11(),
      fcmDataLoader.loadConfronti().catch(() => null)
    ]);
    const { top11, flop11, topModule, flopModule, topSum, flopSum, topByModule, flopByModule } = topFlopData || {};
    this._topFlopData = topFlopData || {};
    const isFantamisterEnabled = typeof fcmModules !== 'undefined' ? fcmModules.hasFantamister() : true;
    let fantamisterDayData = null;
    const targetDay = lastDaySerieADay > 0 ? lastDaySerieADay : (calendar.lastPlayed > 0 ? calendar.lastPlayed : 1);
    if (isFantamisterEnabled && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadFantamisterDay) {
      try {
        fantamisterDayData = await fcmDataLoader.loadFantamisterDay(targetDay);
      } catch (e) {
        console.warn('Errore fcmDataLoader.loadFantamisterDay in homeView:', e);
      }
    }
    if ((!fantamisterDayData || !fantamisterDayData.matches) && typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getMatchdayData === 'function') {
      try {
        const mdData = await fcmFantamisterMotore.getMatchdayData(targetDay);
        if (mdData) {
          if (!fantamisterDayData) {
            fantamisterDayData = mdData;
          } else {
            fantamisterDayData.matches = mdData.matches;
          }
        }
      } catch (e) {
        console.warn('Errore fcmFantamisterMotore.getMatchdayData in homeView:', e);
      }
    }
    const comps = fcmDataLoader.getCompetitions();
    const configuredStandingsCompId = (userSettings && userSettings.standingsCompId && userSettings.standingsCompId !== 'auto')
      ? userSettings.standingsCompId
      : null;
    const mainComp = (configuredStandingsCompId ? comps.find(c => String(c.id) === String(configuredStandingsCompId)) : null)
      || comps.find(c => c.isDefault)
      || comps.find(c => c.id === 1)
      || comps[0];
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

    // Dati per il calcolo Live Ibrido (PianetaFanta prioritario + Fantapazz/FantaMaster/Fantacalcio)
    const hasliveFP = typeof fcmModules !== 'undefined' ? fcmModules.hasliveFP() : true;
    const hasLiveFM = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveFM() : true;
    const hasLiveFC = typeof fcmModules !== 'undefined' ? (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : true) : true;
    const hasLiveVU = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveVU() : true;

    // Inizializza lo store isolato per evitare conflitti di sovrascrittura su arrVoti
    this._liveDataStore = {
      vu: { voti: [], partite: {}, loaded: false },
      fp: { voti: [], partite: {}, loaded: false },
      fm: { voti: [], partite: {}, loaded: false },
      fc: { voti: [], partite: {}, loaded: false },
      fantapazz: { voti: [], partite: {}, loaded: false },
      fantamaster: { voti: [], partite: {}, loaded: false },
      fantacalcio: { voti: [], partite: {}, loaded: false }
    };

    // Determina la sorgente live secondaria attiva: preferenza salvata in sessione, oppure Fantacalcio di default, Fantapazz o FantaMaster
    let savedSec = null;
    try {
      savedSec = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('modernfcm_home_live_secondary') : null;
    } catch (e) { }

    if (savedSec === 'fantacalcio' && hasLiveFC) {
      this._activeSecondaryLive = 'fantacalcio';
    } else if (savedSec === 'fantapazz' && hasliveFP) {
      this._activeSecondaryLive = 'fantapazz';
    } else if (savedSec === 'fantamaster' && hasLiveFM) {
      this._activeSecondaryLive = 'fantamaster';
    } else if (hasLiveFC) {
      this._activeSecondaryLive = 'fantacalcio';
    } else if (hasliveFP) {
      this._activeSecondaryLive = 'fantapazz';
    } else if (hasLiveFM) {
      this._activeSecondaryLive = 'fantamaster';
    } else {
      this._activeSecondaryLive = null;
    }

    if (isMatchdayInProgress) {
      try { await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js', true); } catch (e) { }

      // 1. Caricamento PianetaFanta (base permanente e prioritaria)
      if (hasLiveVU && await this._isLiveFeedOfDay('vu', calendar.nextMatchday)) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
          this._liveDataStore.vu = {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          };
        } catch (e) {
          console.warn('Voti ufficiosi PianetaFanta non disponibili:', e);
        }
      }

      // 2. Pre-caricamento immediato delle fonti live secondarie (Fantacalcio, Fantapazz e FantaMaster)
      if (hasLiveFC && await this._isLiveFeedOfDay('fantacalcio', calendar.nextMatchday)) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFC.js', true);
          const dataFC = {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          };
          this._setSecondaryData('fantacalcio', dataFC);
        } catch (e) {
          console.warn('Voti live Fantacalcio non disponibili:', e);
        }
      }
      if (hasliveFP && await this._isLiveFeedOfDay('fantapazz', calendar.nextMatchday)) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFP.js', true);
          const dataFP = {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          };
          this._setSecondaryData('fantapazz', dataFP);
        } catch (e) {
          console.warn('Voti live Fantapazz non disponibili:', e);
        }
      }
      if (hasLiveFM && await this._isLiveFeedOfDay('fantamaster', calendar.nextMatchday)) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFM.js', true);
          const dataFM = {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          };
          this._setSecondaryData('fantamaster', dataFM);
        } catch (e) {
          console.warn('Voti live FantaMaster non disponibili:', e);
        }
      }

      // 3. Ripristina l'array globale arrVoti e arrPartite con PianetaFanta per isolamento e coerenza verso le altre viste
      if (this._liveDataStore.vu && this._liveDataStore.vu.loaded) {
        if (typeof arrVoti !== 'undefined') window.arrVoti = this._liveDataStore.vu.voti.slice();
        if (typeof arrPartite !== 'undefined') window.arrPartite = { ...this._liveDataStore.vu.partite };
      }
    }

    let vuVoti = this._liveDataStore.vu.voti;
    let vuPartite = this._liveDataStore.vu.partite;

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

    // Categorize top11 & flop11 by role for tactical pitch
    const topP = top11 ? top11.filter(p => p.role === 'P') : [];
    const topD = top11 ? top11.filter(p => p.role === 'D') : [];
    const topC = top11 ? top11.filter(p => p.role === 'C') : [];
    const topA = top11 ? top11.filter(p => p.role === 'A') : [];
    const topMod = `${topD.length}-${topC.length}-${topA.length}`;

    const flopP = flop11 ? flop11.filter(p => p.role === 'P') : [];
    const flopD = flop11 ? flop11.filter(p => p.role === 'D') : [];
    const flopC = flop11 ? flop11.filter(p => p.role === 'C') : [];
    const flopA = flop11 ? flop11.filter(p => p.role === 'A') : [];
    const flopMod = `${flopD.length}-${flopC.length}-${flopA.length}`;

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
    const sanitizeSponsorUrl = (url, allowHash = true) => {
      if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.sanitizeUrl === 'function') {
        return fcmHomeConfigManager.sanitizeUrl(url, allowHash);
      }
      const raw = String(url || '').trim();
      if (!raw) return '';
      const compact = raw.replace(/[\u0000-\u0020]+/g, '');
      if (/^(javascript|vbscript|data):/i.test(compact)) return '';
      if (compact.startsWith('#')) return allowHash ? raw : '';
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(compact)) {
        return /^https?:/i.test(compact) ? raw : '';
      }
      return raw;
    };
    const sponsorsWithLogos = (info.sponsors || []).filter(sponsor => sponsor && sanitizeSponsorUrl(sponsor.logo, false));
    const sponsorsWithoutLogos = (info.sponsors || []).filter(sponsor => sponsor && !sanitizeSponsorUrl(sponsor.logo, false) && (sponsor.title || sanitizeSponsorUrl(sponsor.link, true)));
    const sponsorsBlock = (sponsorsWithLogos.length || sponsorsWithoutLogos.length) ? `
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
                Sponsor e Preferiti
              </div>
            </div>
            ${sponsorsWithLogos.length ? `
              <div class="sponsors-strip">
                ${sponsorsWithLogos.map(sponsor => {
      const safeLogo = sanitizeSponsorUrl(sponsor.logo, false);
      const safeLink = sanitizeSponsorUrl(sponsor.link, true);
      return `
                  ${safeLink ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">` : '<span>'}
                    <img src="${escapeHtml(safeLogo)}" class="sponsor-logo" alt="${escapeHtml(sponsor.title || 'Sponsor')}" title="${escapeHtml(sponsor.title || '')}" />
                  ${safeLink ? '</a>' : '</span>'}
                `;
    }).join('')}
              </div>
            ` : ''}
            ${sponsorsWithoutLogos.length ? `
              <div class="sponsor-links">
                ${sponsorsWithoutLogos.map(sponsor => {
      const safeLink = sanitizeSponsorUrl(sponsor.link, true);
      return safeLink
        ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="sponsor-link">${escapeHtml(sponsor.title || safeLink)}</a>`
        : `<span class="sponsor-link">${escapeHtml(sponsor.title)}</span>`;
    }).join('')}
              </div>
            ` : ''}
          </div>
        ` : '';

    const currentTheme = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme')) || (typeof localStorage !== 'undefined' && localStorage.getItem('pn_theme')) || 'light';

    const isCounterEnabled = typeof fcmModules !== 'undefined' ? fcmModules.hasCounter() : true;
    const counterBlock = isCounterEnabled ? `
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
    ` : '';

    // -------------------------------------------------------------
    // BLOCCHI HTML RIUTILIZZABILI PER LA COLONNA PRINCIPALE
    // -------------------------------------------------------------

    // 1. Risultati dell'ultima giornata
    const lastDayDateStr = fcmDataLoader.getDataGiornataA(lastDaySerieADay);
    const lastDayFantaNome = lastDayMatches.length > 0 ? lastDayMatches[0].fantagiornataNome : 'Ultimo Turno';

    const lastDayCompHierarchy = this.buildMatchdayHierarchy(lastDayMatches, comps);

    // Garantisce che fantamisterDayData contenga i match per Calenbomber (marcatori e migliore in campo)
    if ((!fantamisterDayData || !fantamisterDayData.matches || fantamisterDayData.matches.length === 0) && typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getMatchdayData === 'function') {
      try {
        const mdData = await fcmFantamisterMotore.getMatchdayData(lastDaySerieADay);
        if (mdData) {
          if (!fantamisterDayData) {
            fantamisterDayData = mdData;
          } else {
            fantamisterDayData.matches = mdData.matches;
          }
        }
      } catch (e) {
        console.warn('Errore fallback getMatchdayData:', e);
      }
    }

    // Helpers per visualizzazione Calenbomber minimale in Home (Fantabomber e Migliori in campo)
    const groupCalenScorers = (scorers) => {
      if (!scorers || !Array.isArray(scorers) || scorers.length === 0) return [];
      const map = new Map();
      scorers.forEach(s => {
        if (!s) return;
        const key = (s.id !== undefined && s.id !== null) ? String(s.id) : (s.name || '');
        if (!map.has(key)) {
          map.set(key, { ...s, count: 1 });
        } else {
          map.get(key).count++;
        }
      });
      return Array.from(map.values());
    };

    const renderCalenScorersList = (scorers, side) => {
      if (!scorers || scorers.length === 0) {
        return '<div class="home-calen-empty">Nessun gol</div>';
      }
      return scorers.map((s, idx) => {
        const isLast = (idx === scorers.length - 1);
        const surname = fcmDataLoader.extractSurname ? fcmDataLoader.extractSurname(s.name) : s.name;
        const photo = (fcmDataLoader.getPlayerPhoto ? fcmDataLoader.getPlayerPhoto(s.name, s.code) : null) || 'img/foto/misterx.gif';
        const pLink = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink)
          ? fcmDataLoader.getPlayerProfileLink({ name: s.name })
          : `#schede_giocatori?name=${encodeURIComponent(s.name)}`;
        const balls = '⚽'.repeat(Math.max(1, s.count || 1));

        return `
          <span class="home-calen-scorer-item ${side}">
            <span class="home-calen-scorer-block">
              <a href="${pLink}" class="home-calen-player-link" title="Visualizza scheda di ${escapeHtml(s.name)}">
                <img src="${photo}" class="home-calen-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeHtml(s.name)}" />
                <span class="home-calen-player-name">${escapeHtml(surname)}</span>
              </a>
              <span class="home-calen-ball" title="${s.count > 1 ? s.count + ' gol' : 'Gol'}">${balls}</span>
            </span>${!isLast ? '<span class="home-calen-comma">,</span>' : ''}
          </span>
        `;
      }).join('');
    };

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
                    ${girone.matches.map(m => {
      const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
      const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
      const isMatchFav = isHomeFav || isAwayFav;

      const fmMatch = (fantamisterDayData && Array.isArray(fantamisterDayData.matches))
        ? fantamisterDayData.matches.find(fm =>
            (fm.matchId && m.id && fm.matchId == m.id) ||
            (fm.homeTeamId && m.homeTeamId && fm.homeTeamId == m.homeTeamId && fm.awayTeamId == m.awayTeamId) ||
            (fm.homeTeamName && m.homeTeamName && fm.homeTeamName === m.homeTeamName && fm.awayTeamName === m.awayTeamName)
          )
        : null;

      const rawHomeScorers = fmMatch ? (fmMatch.homeScorers || []) : [];
      const rawAwayScorers = fmMatch ? (fmMatch.awayScorers || []) : [];
      const groupedHome = groupCalenScorers(rawHomeScorers);
      const groupedAway = groupCalenScorers(rawAwayScorers);
      const hasAnyGoals = (groupedHome.length > 0 || groupedAway.length > 0 || (m.homeGoals > 0) || (m.awayGoals > 0));

      const mom = fmMatch ? fmMatch.manOfTheMatch : null;
      let momHtml = '';
      if (mom && mom.name) {
        const momSurname = fcmDataLoader.extractSurname ? fcmDataLoader.extractSurname(mom.name) : mom.name;
        const momPhoto = (fcmDataLoader.getPlayerPhoto ? fcmDataLoader.getPlayerPhoto(mom.name, mom.code) : null) || 'img/foto/misterx.gif';
        const momLink = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink)
          ? fcmDataLoader.getPlayerProfileLink({ name: mom.name })
          : `#schede_giocatori?name=${encodeURIComponent(mom.name)}`;
        const momTeamName = mom.teamName || (mom.isHome ? m.homeTeamName : m.awayTeamName) || (fcmDataLoader.getTeamName ? fcmDataLoader.getTeamName(mom.teamId) : '');
        const momVoteVal = (mom.totNum !== undefined && mom.totNum !== null)
          ? (typeof mom.totNum === 'number' ? mom.totNum.toFixed(1) : mom.totNum)
          : (mom.totVote || '');
        momHtml = `
          <div class="home-calen-mom-row">
            <span class="home-calen-mom-badge"><span>🌟</span> Migliore in campo:</span>
            <a href="${momLink}" class="home-calen-player-link" title="Visualizza scheda di ${escapeHtml(mom.name)}">
              <img src="${momPhoto}" class="home-calen-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeHtml(mom.name)}" />
              <span class="home-calen-player-name">${escapeHtml(momSurname)}</span>
            </a>
            ${momTeamName ? `<span class="home-calen-mom-team">(${escapeHtml(momTeamName)})</span>` : ''}
            ${momVoteVal ? `<span class="home-calen-mom-vote">Voto: <strong>${momVoteVal}</strong></span>` : ''}
          </div>
        `;
      }

      const calenbomberHtml = hasAnyGoals ? `
        <div class="home-calen-grid">
          <div class="home-calen-col home">
            ${renderCalenScorersList(groupedHome, 'home')}
          </div>
          <div class="home-calen-col away">
            ${renderCalenScorersList(groupedAway, 'away')}
          </div>
        </div>
      ` : `
        <div class="home-calen-grid is-empty-grid">
          <div class="home-calen-empty" style="grid-column: 1 / -1; text-align: center;">Nessun gol segnato</div>
        </div>
      `;

      return `
        <div class="match-card compact-match-card home-calen-card ${isMatchFav ? 'is-favorite-match favorite-team-row' : ''}" data-match-href="#risultati?day=${m.serieADay}&match=${m.id}" role="button" tabindex="0" title="Apri tabellino incontro">
          <div class="match-teams-row">
            <div class="match-team home">
              <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div class="team-info-wrap">
                <div class="team-name-row">
                  ${isHomeFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isHomeFav ? 'is-fav' : ''}" data-team-id="${m.homeTeamId || ''}" data-team-name="${escapeHtml(m.homeTeamName)}" title="Imposta come squadra del cuore">${isHomeFav ? '⭐' : '☆'}</button>` : ''}
                  <span class="team-name-text" title="${escapeHtml(m.homeTeamName)}">${escapeHtml(m.homeTeamName)}</span>
                </div>
                ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
              </div>
            </div>
            <a href="#risultati?day=${m.serieADay}&match=${m.id}" class="match-score-pill" title="Visualizza tabellino completo" style="text-decoration:none;color:inherit;cursor:pointer;">
              <div class="score-digits">${m.homeGoals} - ${m.awayGoals}</div>
              <div class="score-totals">${typeof m.homeTotal === 'number' ? m.homeTotal.toFixed(2) : m.homeTotal} - ${typeof m.awayTotal === 'number' ? m.awayTotal.toFixed(2) : m.awayTotal}</div>
            </a>
            <div class="match-team away">
              <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div class="team-info-wrap">
                <div class="team-name-row">
                  ${isAwayFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isAwayFav ? 'is-fav' : ''}" data-team-id="${m.awayTeamId || ''}" data-team-name="${escapeHtml(m.awayTeamName)}" title="Imposta come squadra del cuore">${isAwayFav ? '⭐' : '☆'}</button>` : ''}
                  <span class="team-name-text" title="${escapeHtml(m.awayTeamName)}">${escapeHtml(m.awayTeamName)}</span>
                </div>
                ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
              </div>
            </div>
          </div>
          ${calenbomberHtml}
          ${momHtml}
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
    `;

    const targetAntLabel = `(-${targetAnticipo}m)`;
    const nextDayDateStr = fcmDataLoader.getDataGiornataA(calendar.nextMatchday);
    const initialDeadlineText = (matchStartTime && targetDeadline)
      ? `⚽ Inizio Partite: <strong>${matchStartTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ore ${matchStartTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> &bull; Scadenza Invio: <strong>${targetDeadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> ${targetAntLabel}`
      : (nextDayDateStr
        ? `⚽ Inizio Partite: <strong>${nextDayDateStr}</strong>`
        : '<span class="skeleton skeleton-text" style="display:inline-block;width:140px;height:12px;vertical-align:middle;margin:0 4px;"></span>');

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

    // 3. Top / Flop 11 dell'ultima giornata (uguale a #fantam con selettore modulo tattico)
    const hasTop = top11 && top11.length > 0;
    const hasFlop = flop11 && flop11.length > 0;
    const hasBoth = hasTop && hasFlop;
    const allowedTopFlopMods = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getAllowedModuleStrings === 'function')
      ? fcmFantamisterMotore.getAllowedModuleStrings()
      : ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];

    const renderPitchRoleLine = (players, roleLetter, isFlop = false) => {
      const count = players.length;
      const isStaggered = count >= 5;
      const roleClass = `role-${roleLetter.toLowerCase()}`;
      return `
        <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}">
          ${players.map((pl, idx) => {
        const isWing = isStaggered && (idx === 0 || idx === count - 1);
        const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
        const pName = pl.name || pl.player || pl.rawPlayer || '';
        const pSurname = pl.surname || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.extractSurname ? fcmDataLoader.extractSurname(pName) : pName);
        const linkHref = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) ? fcmDataLoader.getPlayerProfileLink({ name: pName, id: pl.id, code: pl.code || pl.codice }) : (pl.id ? `#schede_giocatori?id=${pl.id}` : `#schede_giocatori?name=${encodeURIComponent(pName)}`);
        const photoUrl = pl.photo || fcmDataLoader.getPlayerPhoto(pName);
        const clubName = pl.serieATeam || pl.club || '';
        const clubLogo = pl.serieALogo || (clubName && fcmDataLoader.getSerieALogo ? fcmDataLoader.getSerieALogo(clubName) : '');
        const sqName = pl.fantasyTeam || (pl.teamId && fcmDataLoader.getTeamById ? ((fcmDataLoader.getTeamById(pl.teamId) || {}).Nome || '') : '');
        const sqLogo = fcmDataLoader.getTeamLogo ? fcmDataLoader.getTeamLogo(pl.teamId || sqName) : `img/sq/${encodeURI(sqName)}.png`;
        const isFavSq = (typeof fcmDataLoader.isFavoriteTeam === 'function' && (fcmDataLoader.isFavoriteTeam(pl.teamId) || fcmDataLoader.isFavoriteTeam(sqName)));
        const voteVal = pl.vote || (pl.totNum !== undefined ? pl.totNum.toFixed(2) : '-');
        return `
              <a href="${linkHref}" class="pitch-player ${wingClass}" data-player="${pName}" tabindex="0" title="Apri scheda di ${pName} (${sqName}) - Voto: ${voteVal}">
                <div class="pitch-player-avatar">
                  <img src="${photoUrl}" class="pitch-player-photo" alt="${pName}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
                  <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  ${clubLogo ? `
                    <img src="${clubLogo}" class="rose-top11-club-logo" alt="${clubName}" title="${clubName}" onerror="this.style.display='none';" />
                  ` : ''}
                </div>
                <div class="pitch-player-name">
                  <span class="pitch-player-surname">${pSurname}</span>
                </div>
                <div class="pitch-player-club" style="font-size:0.68rem;color:rgba(255,255,255,0.88);text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:3px;">
                  <img src="${sqLogo}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(sqName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:12px;height:12px;object-fit:contain;" alt="" />
                  <span>${isFavSq ? '⭐ ' : ''}${sqName}</span>
                </div>
                <div style="margin-top:2px;">
                  <span class="topflop-vote-badge ${isFlop ? 'topflop-vote-flop' : 'topflop-vote-top'}" style="background:${isFlop ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)'};color:#fff;font-weight:900;font-size:0.75rem;padding:2px 7px;border-radius:10px;">
                    ${voteVal}
                  </span>
                </div>
              </a>
            `;
      }).join('')}
        </div>
      `;
    };

    this._renderHomeTopFlopPitchInner = (playersList, isFlop = false) => {
      const pL = (playersList || []).filter(p => p.role === 'P' || p.role === 1);
      const dL = (playersList || []).filter(p => p.role === 'D' || p.role === 2);
      const cL = (playersList || []).filter(p => p.role === 'C' || p.role === 3);
      const aL = (playersList || []).filter(p => p.role === 'A' || p.role === 4);
      return `
        ${fcmDataLoader.getPitchSvgLines()}
        ${renderPitchRoleLine(pL, 'P', isFlop)}
        ${renderPitchRoleLine(dL, 'D', isFlop)}
        ${renderPitchRoleLine(cL, 'C', isFlop)}
        ${renderPitchRoleLine(aL, 'A', isFlop)}
      `;
    };

    const calcLineupSum = (list, fallbackSum) => {
      if (typeof fallbackSum === 'number' && fallbackSum > 0) return fallbackSum;
      let s = 0;
      (list || []).forEach(p => {
        const v = parseFloat(String(p.vote || p.totNum || '0').replace(',', '.'));
        if (!isNaN(v)) s += v;
      });
      return s;
    };

    const topBestMod = topModule || topMod;
    const flopBestMod = flopModule || flopMod;
    const topBestSum = calcLineupSum(top11, topSum);
    const flopBestSum = calcLineupSum(flop11, flopSum);

    const topPitchHtml = hasTop ? `
      <div class="topflop-slide" id="slideTop11" data-slide="top" data-index="0">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="selHomeTopMod" style="font-weight:700;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;">Modulo:</label>
            <select id="selHomeTopMod" class="form-control home-topflop-mod-select" data-type="top" style="font-weight:800;padding:3px 8px;border-radius:8px;background:rgba(59,130,246,0.14);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.35);font-size:0.8rem;cursor:pointer;">
              <option value="auto" selected>${topBestMod} (${topBestSum.toFixed(2)} pt) 🌟</option>
              ${allowedTopFlopMods.map(m => {
      if (m !== topBestMod) {
        const mEntry = topByModule && topByModule[m];
        const ptLabel = mEntry && typeof mEntry.sum === 'number' ? ` (${mEntry.sum.toFixed(2)} pt)` : '';
        return `<option value="${m}" ${!mEntry ? 'disabled' : ''}>${m}${ptLabel}</option>`;
      }
    }).join('')}
            </select>
          </div>
          <div>
            <span style="font-weight:700;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;">Totale:</span>
            <span id="homeTopTotalScore" style="font-weight:900;color:var(--accent-emerald);margin-left:4px;font-size:0.95rem;">
              ${topBestSum.toFixed(2)} pt
            </span>
          </div>
        </div>
        <div class="pitch-container" id="homeTopPitchContainer" style="margin-bottom:0;position:relative;">
          ${this._renderHomeTopFlopPitchInner(top11, false)}
        </div>
      </div>
    ` : '';

    const flopPitchHtml = hasFlop ? `
      <div class="topflop-slide" id="slideFlop11" data-slide="flop" data-index="${hasTop ? 1 : 0}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="selHomeFlopMod" style="font-weight:700;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;">Modulo:</label>
            <select id="selHomeFlopMod" class="form-control home-topflop-mod-select" data-type="flop" style="font-weight:800;padding:3px 8px;border-radius:8px;background:rgba(59,130,246,0.14);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.35);font-size:0.8rem;cursor:pointer;">
              <option value="auto" selected>${flopBestMod} (${flopBestSum.toFixed(2)} pt) 👎</option>
              ${allowedTopFlopMods.map(m => {
      if (m !== flopBestMod) {
        const mEntry = flopByModule && flopByModule[m];
        const ptLabel = mEntry && typeof mEntry.sum === 'number' ? ` (${mEntry.sum.toFixed(2)} pt)` : '';
        return `<option value="${m}" ${!mEntry ? 'disabled' : ''}>${m}${ptLabel}</option>`;
      }
    }).join('')}
            </select>
          </div>
          <div>
            <span style="font-weight:700;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;">Totale:</span>
            <span id="homeFlopTotalScore" style="font-weight:900;color:var(--accent-crimson);margin-left:4px;font-size:0.95rem;">
              ${flopBestSum.toFixed(2)} pt
            </span>
          </div>
        </div>
        <div class="pitch-container rose-pitch-flop" id="homeFlopPitchContainer" style="margin-bottom:0;position:relative;">
          ${this._renderHomeTopFlopPitchInner(flop11, true)}
        </div>
      </div>
    ` : '';

    const topFlop11Block = (isFantamisterEnabled && (hasTop || hasFlop)) ? `
      <div class="card topflop-widget-card" id="topFlopWidget">
        <div class="card-header topflop-card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="topflop-title-text">${hasBoth ? 'Top / Flop 11' : hasTop ? 'Top 11' : 'Flop 11'} • ${calendar.lastPlayed}ª Serie A</span>
          </div>

          <a href="#fantam" class="badge badge-primary topflop-fantam-link">Fantamister &rarr;</a>
        </div>

        ${hasBoth ? `
          <div style="display:flex;justify-content:center;align-items:center;margin:10px 0 12px 0;">
            <div class="topflop-controls" aria-label="Navigazione Top e Flop 11">
              <button type="button" class="icon-btn topflop-arrow topflop-arrow-prev" id="topFlopPrev" aria-label="Campetto precedente" title="Passa a Top 11" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <div class="topflop-switch-pills">
                <button type="button" class="topflop-pill active" id="pillTop11" data-slide="top">
                  <span>🌟</span> Top 11
                </button>
                <button type="button" class="topflop-pill" id="pillFlop11" data-slide="flop">
                  <span>👎</span> Flop 11
                </button>
              </div>
              <button type="button" class="icon-btn topflop-arrow topflop-arrow-next" id="topFlopNext" aria-label="Campetto successivo" title="Passa a Flop 11">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>
        ` : ''}

        <div class="topflop-slider-viewport" id="topFlopViewport">
          ${hasBoth ? `
            <button type="button" class="topflop-viewport-arrow topflop-viewport-prev desktop-only" id="topFlopSidePrev" aria-label="Campetto precedente" title="Top 11" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button type="button" class="topflop-viewport-arrow topflop-viewport-next desktop-only" id="topFlopSideNext" aria-label="Campetto successivo" title="Flop 11">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ` : ''}

          <div class="topflop-slider-track" id="topFlopTrack">
            ${topPitchHtml}
            ${flopPitchHtml}
          </div>
        </div>

        ${hasBoth ? `
          <div class="topflop-dots-indicator" id="topFlopDots">
            <span class="topflop-dot active" data-index="0" title="Top 11"></span>
            <span class="topflop-dot" data-index="1" title="Flop 11"></span>
          </div>
        ` : ''}
      </div>
    ` : '';

    // 3b. Widget FantaMister: Punteggi & Scelte di Giornata
    let bestWorstMisterBlock = '';
    if (isFantamisterEnabled && fantamisterDayData && fantamisterDayData.bestMister && fantamisterDayData.worstMister) {
      const { bestMister, worstMister, topScore, lowestScore, day, ranking } = fantamisterDayData;
      const isFavFn = (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.isFavoriteTeam)
        ? (idOrName) => fcmHomeConfigManager.isFavoriteTeam(idOrName)
        : () => false;

      const isTopFav = topScore ? isFavFn(topScore.teamId || topScore.Nome) : false;
      const isLowestFav = lowestScore ? isFavFn(lowestScore.teamId || lowestScore.Nome) : false;
      const isBestFav = isFavFn(bestMister.teamId || bestMister.Nome);
      const isWorstFav = isFavFn(worstMister.teamId || worstMister.Nome);

      const topTotal = topScore ? (topScore.total !== undefined ? topScore.total : (topScore.totalScore !== undefined ? topScore.totalScore : (topScore.Parz || 0))) : 0;
      const topPartial = topScore ? (topScore.partial !== undefined ? topScore.partial : (topScore.Parz !== undefined ? topScore.Parz : (topScore.totalScore || 0))) : 0;

      const lowestTotal = lowestScore ? (lowestScore.total !== undefined ? lowestScore.total : (lowestScore.totalScore !== undefined ? lowestScore.totalScore : (lowestScore.Parz || 0))) : 0;
      const lowestPartial = lowestScore ? (lowestScore.partial !== undefined ? lowestScore.partial : (lowestScore.Parz !== undefined ? lowestScore.Parz : (lowestScore.totalScore || 0))) : 0;

      // Posizione squadra del cuore se non è tra le 4 in evidenza
      const coachRanking = ranking || fantamisterDayData.list || [];
      const favTeamIndex = (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.hasFavoriteTeam && fcmHomeConfigManager.hasFavoriteTeam())
        ? coachRanking.findIndex(x => isFavFn(x.teamId || x.Nome))
        : -1;
      const isAnyFeaturedFav = isTopFav || isLowestFav || isBestFav || isWorstFav;
      const favTeamEntry = (favTeamIndex >= 0 && !isAnyFeaturedFav) ? coachRanking[favTeamIndex] : null;

      const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])));

      bestWorstMisterBlock = `
        <div class="card home-fantamister-card" id="homeFantamisterCard">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;">
            <div class="card-title" style="display:flex;align-items:center;gap:8px;font-size:1.02rem;color:var(--text-primary);font-weight:700;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>FantaMister • Giornata ${day}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <a href="#fantam" class="badge badge-primary" style="font-size:0.75rem;">FantaMister &rarr;</a>
            </div>
          </div>

          <!-- Filtri rapidi per scorrimento (visibili solo su mobile) -->
          <div class="fantamister-mobile-pills mobile-only" id="fantamisterMobilePills">
            <div class="fantamister-tabs-wrap">
              <button type="button" class="fantamister-pill active" data-index="0">Top</button>
              <button type="button" class="fantamister-pill" data-index="1">Flop</button>
              <button type="button" class="fantamister-pill" data-index="2">Best</button>
              <button type="button" class="fantamister-pill" data-index="3">Worst</button>
            </div>
          </div>

          <div class="fantamister-slider-viewport">
            <div class="fantamister-coaches-grid" id="fantamisterTrack">

              <!-- 1. 🚀 PUNTEGGIO TOP -->
              ${topScore ? `
              <div class="fantamister-coach-box coach-box-topscore ${isTopFav ? 'coach-box-fav' : ''}" data-card-index="0">
                <div class="coach-badge-row">
                  <span class="coach-ribbon-badge badge-emerald">🚀 Punteggio Top • Giornata ${day}</span>
                </div>
                <div class="coach-team-profile">
                  <img src="${topScore.logo || fcmDataLoader.getTeamLogo(topScore.teamId || topScore.Nome) || 'img/sq/undefined.svg'}" alt="${escapeFn(topScore.Nome)}" class="coach-team-logo" onerror="this.src='img/sq/undefined.svg'" />
                  <div class="coach-team-info">
                    <div class="coach-team-name">
                      ${isTopFav ? '<span class="fav-team-star">⭐</span> ' : ''}
                      <a href="#rose?team=${encodeURIComponent(topScore.teamId || topScore.Nome)}">${escapeFn(topScore.Nome)}</a>
                    </div>
                    ${topScore.coach ? `<div class="coach-manager-name">Mister: <strong>${escapeFn(topScore.coach)}</strong></div>` : ''}
                  </div>
                </div>
                <div class="coach-stats-metrics" style="grid-template-columns: repeat(2, 1fr);">
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Punteggio Totale</span>
                    <span class="coach-metric-val val-topscore">${topTotal.toFixed(2)}</span>
                    <span class="coach-metric-sub">${topScore.goals !== undefined ? `${topScore.goals} ${topScore.goals === 1 ? 'gol fatto' : 'gol fatti'}` : `Modulo ${topScore.ModParz || '-'}`}</span>
                  </div>
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Parziale Puro</span>
                    <span class="coach-metric-val">${topPartial.toFixed(2)}</span>
                    <span class="coach-metric-sub">${topScore.ModParz ? `Modulo ${topScore.ModParz}` : 'Voti campo'}</span>
                  </div>
                </div>
                <div class="coach-verdict verdict-topscore">
                  🔥 Miglior prestazione assoluta del turno con <strong>${topTotal.toFixed(2)} punti totali</strong>${topScore.opponentName ? ` (${topScore.goals}-${topScore.opponentGoals} contro ${escapeFn(topScore.opponentName)})` : ''}.
                </div>
              </div>` : ''}

              <!-- 2. 📉 PUNTEGGIO FLOP -->
              ${lowestScore ? `
              <div class="fantamister-coach-box coach-box-flopscore ${isLowestFav ? 'coach-box-fav' : ''}" data-card-index="1">
                <div class="coach-badge-row">
                  <span class="coach-ribbon-badge badge-slate">📉 Punteggio Flop • Giornata ${day}</span>
                </div>
                <div class="coach-team-profile">
                  <img src="${lowestScore.logo || fcmDataLoader.getTeamLogo(lowestScore.teamId || lowestScore.Nome) || 'img/sq/undefined.svg'}" alt="${escapeFn(lowestScore.Nome)}" class="coach-team-logo" onerror="this.src='img/sq/undefined.svg'" />
                  <div class="coach-team-info">
                    <div class="coach-team-name">
                      ${isLowestFav ? '<span class="fav-team-star">⭐</span> ' : ''}
                      <a href="#rose?team=${encodeURIComponent(lowestScore.teamId || lowestScore.Nome)}">${escapeFn(lowestScore.Nome)}</a>
                    </div>
                    ${lowestScore.coach ? `<div class="coach-manager-name">Mister: <strong>${escapeFn(lowestScore.coach)}</strong></div>` : ''}
                  </div>
                </div>
                <div class="coach-stats-metrics" style="grid-template-columns: repeat(2, 1fr);">
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Punteggio Totale</span>
                    <span class="coach-metric-val val-flopscore">${lowestTotal.toFixed(2)}</span>
                    <span class="coach-metric-sub">${lowestScore.goals !== undefined ? `${lowestScore.goals} ${lowestScore.goals === 1 ? 'gol fatto' : 'gol fatti'}` : `Modulo ${lowestScore.ModParz || '-'}`}</span>
                  </div>
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Parziale Puro</span>
                    <span class="coach-metric-val">${lowestPartial.toFixed(2)}</span>
                    <span class="coach-metric-sub">${lowestScore.ModParz ? `Modulo ${lowestScore.ModParz}` : 'Voti campo'}</span>
                  </div>
                </div>
                <div class="coach-verdict verdict-flopscore">
                  ❄️ Punteggio totale più basso della giornata con <strong>${lowestTotal.toFixed(2)} punti totali</strong>${lowestScore.opponentName ? ` (${lowestScore.goals}-${lowestScore.opponentGoals} contro ${escapeFn(lowestScore.opponentName)})` : ''}.
                </div>
              </div>` : ''}

              <!-- 3. 🥇 MIGLIOR MISTER (SCELTA PERFETTA) -->
              <div class="fantamister-coach-box coach-box-best ${isBestFav ? 'coach-box-fav' : ''}" data-card-index="2">
                <div class="coach-badge-row">
                  <span class="coach-ribbon-badge badge-gold">🥇 Scelta Perfetta • Miglior Mister</span>
                </div>
                <div class="coach-team-profile">
                  <img src="${bestMister.logo || fcmDataLoader.getTeamLogo(bestMister.teamId || bestMister.Nome) || 'img/sq/undefined.svg'}" alt="${escapeFn(bestMister.Nome)}" class="coach-team-logo" onerror="this.src='img/sq/undefined.svg'" />
                  <div class="coach-team-info">
                    <div class="coach-team-name">
                      ${isBestFav ? '<span class="fav-team-star">⭐</span> ' : ''}
                      <a href="#rose?team=${encodeURIComponent(bestMister.teamId || bestMister.Nome)}">${escapeFn(bestMister.Nome)}</a>
                    </div>
                    ${bestMister.coach ? `<div class="coach-manager-name">Mister: <strong>${escapeFn(bestMister.coach)}</strong></div>` : ''}
                  </div>
                </div>
                <div class="coach-stats-metrics">
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Totali Reali</span>
                    <span class="coach-metric-val val-score">${bestMister.Parz.toFixed(2)}</span>
                    <span class="coach-metric-sub">Modulo ${bestMister.ModParz || '-'}</span>
                  </div>
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Punti Max Potenziali</span>
                    <span class="coach-metric-val">${bestMister.Max.toFixed(2)}</span>
                    <span class="coach-metric-sub">Modulo ${bestMister.ModMax || '-'}</span>
                  </div>
                  <div class="coach-metric-item highlight-diff">
                    <span class="coach-metric-lbl">Punti in Panchina</span>
                    <span class="coach-metric-diff val-diff-best">-${bestMister.Scarto.toFixed(2)} pt</span>
                    <span class="coach-metric-sub">Pesato: <strong>${bestMister.ScSuVoti !== undefined ? bestMister.ScSuVoti.toFixed(2) : '-'}</strong> / voto (${bestMister.Voti || 0} voti)</span>
                  </div>
                </div>
                <div class="coach-verdict verdict-best">
                  ✨ Formazione impeccabile: ha lasciato solo <strong>${bestMister.Scarto.toFixed(2)} pt</strong> tra le riserve (scarto pesato: <strong>${bestMister.ScSuVoti !== undefined ? bestMister.ScSuVoti.toFixed(2) : '-'}</strong> su ${bestMister.Voti || 0} voti validi).
                </div>
              </div>

              <!-- 4. 🤦‍♂️ PEGGIOR MISTER (RIMORSO PANCHINA) -->
              <div class="fantamister-coach-box coach-box-worst ${isWorstFav ? 'coach-box-fav' : ''}" data-card-index="3">
                <div class="coach-badge-row">
                  <span class="coach-ribbon-badge badge-rose">🤦‍♂️ Rimorso Panchina • Peggior Mister</span>
                </div>
                <div class="coach-team-profile">
                  <img src="${worstMister.logo || fcmDataLoader.getTeamLogo(worstMister.teamId || worstMister.Nome) || 'img/sq/undefined.svg'}" alt="${escapeFn(worstMister.Nome)}" class="coach-team-logo" onerror="this.src='img/sq/undefined.svg'" />
                  <div class="coach-team-info">
                    <div class="coach-team-name">
                      ${isWorstFav ? '<span class="fav-team-star">⭐</span> ' : ''}
                      <a href="#rose?team=${encodeURIComponent(worstMister.teamId || worstMister.Nome)}">${escapeFn(worstMister.Nome)}</a>
                    </div>
                    ${worstMister.coach ? `<div class="coach-manager-name">Mister: <strong>${escapeFn(worstMister.coach)}</strong></div>` : ''}
                  </div>
                </div>
                <div class="coach-stats-metrics">
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Totali Reali</span>
                    <span class="coach-metric-val val-score">${worstMister.Parz.toFixed(2)}</span>
                    <span class="coach-metric-sub">Modulo ${worstMister.ModParz || '-'}</span>
                  </div>
                  <div class="coach-metric-item">
                    <span class="coach-metric-lbl">Punti Max Potenziali</span>
                    <span class="coach-metric-val">${worstMister.Max.toFixed(2)}</span>
                    <span class="coach-metric-sub">Modulo ${worstMister.ModMax || '-'}</span>
                  </div>
                  <div class="coach-metric-item highlight-diff">
                    <span class="coach-metric-lbl">Punti in Panchina</span>
                    <span class="coach-metric-diff val-diff-worst">-${worstMister.Scarto.toFixed(2)} pt</span>
                    <span class="coach-metric-sub">Pesato: <strong>${worstMister.ScSuVoti !== undefined ? worstMister.ScSuVoti.toFixed(2) : '-'}</strong> / voto (${worstMister.Voti || 0} voti)</span>
                  </div>
                </div>
                <div class="coach-verdict verdict-worst">
                  ⚠️ Con la panchina avrebbe fatto <strong>${worstMister.Max.toFixed(2)} pt</strong> (+${worstMister.Scarto.toFixed(2)} pt sprecati, scarto pesato: <strong>${worstMister.ScSuVoti !== undefined ? worstMister.ScSuVoti.toFixed(2) : '-'}</strong> su ${worstMister.Voti || 0} voti validi).
                </div>
              </div>

            </div>
          </div>

          <!-- Indicatori pallini (visibili solo su mobile) -->
          <div class="fantamister-mobile-dots mobile-only" id="fantamisterDots">
            <span class="fantamister-dot active" data-index="0" title="Top"></span>
            <span class="fantamister-dot" data-index="1" title="Flop"></span>
            <span class="fantamister-dot" data-index="2" title="Best"></span>
            <span class="fantamister-dot" data-index="3" title="Worst"></span>
          </div>

          ${favTeamEntry ? `
            <div class="coach-fav-team-strip">
              <span class="fav-team-star">⭐</span>
              <span style="color:var(--text-secondary);font-size:0.83rem;">
                La tua Squadra del Cuore (<strong>${escapeFn(favTeamEntry.Nome)}</strong>) si è classificata al <strong>${favTeamIndex + 1}° posto</strong> tra i mister con <strong>${favTeamEntry.Parz.toFixed(2)} pt</strong> reali e <strong>${favTeamEntry.Scarto.toFixed(2)} pt</strong> rimasti tra le riserve (scarto pesato: <strong>${favTeamEntry.ScSuVoti !== undefined ? favTeamEntry.ScSuVoti.toFixed(2) : '-'}</strong>).
              </span>
              <a href="#fantam" style="font-size:0.8rem;text-decoration:none;font-weight:600;margin-left:auto;white-space:nowrap;color:var(--accent-primary);">Vedi Report &rarr;</a>
            </div>
          ` : ''}
        </div>
      `;
    }

    // 4. Widget Unificato "Live in Corso" (quando matchday IN CORSO)
    let liveMatchdayBlock = '';
    const isAnyLiveActive = hasliveFP || hasLiveFM || hasLiveFC || hasLiveVU;

    if (isMatchdayInProgress && nextDayMatches.length > 0 && isAnyLiveActive) {
      // Raggruppamento Gerarchico: Competizione -> Girone
      const compGironeGroups = {};
      for (const m of nextDayMatches) {
        const comp = m.compName || 'Campionato';
        const girone = m.groupName || m.girone || comp;
        if (!compGironeGroups[comp]) compGironeGroups[comp] = {};
        if (!compGironeGroups[comp][girone]) compGironeGroups[comp][girone] = [];
        compGironeGroups[comp][girone].push(m);
      }
      const compNames = Object.keys(compGironeGroups);

      this._liveWidgetContext = {
        calendar,
        nextDayMatches,
        inProgressFormations,
        favoriteTeamId,
        compGironeGroups,
        compNames,
        comps
      };

      const activeSec = this._activeSecondaryLive;
      const secData = this._getSecondaryData(activeSec);
      liveMatchdayBlock = this._renderLiveMatchdayWidget(this._liveWidgetContext, this._liveDataStore.vu, secData, { isUpdated: true, isUpdating: false });
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
            ${submittableStartTime ? `⚽ Inizio Partite: <strong>${submittableStartTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ore ${submittableStartTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</strong> &bull; Scadenza Invio: <strong>${submittableDeadline ? submittableDeadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</strong> (-${submittableAnticipo}m)` : '<span class="skeleton skeleton-text" style="display:inline-block;width:140px;height:12px;vertical-align:middle;margin:0 4px;"></span>'}
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
      <div class="card next-turn-card">
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
      const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
      const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
      const isMatchFav = isHomeFav || isAwayFav;
      return `
                        <div class="match-card compact-match-card next-turn-match-card ${isMatchFav ? 'is-favorite-match favorite-team-row' : ''}">
                          <div class="match-teams-row">
                            <div class="match-team home">
                              <img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <div class="team-info-wrap">
                                <div class="team-name-row">
                                  ${isHomeFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isHomeFav ? 'is-fav' : ''}" data-team-id="${m.homeTeamId || ''}" data-team-name="${escapeHtml(m.homeTeamName)}" title="Imposta come squadra del cuore">${isHomeFav ? '⭐' : '☆'}</button>` : ''}
                                  <span class="team-name-text" title="${m.homeTeamName}">${m.homeTeamName}</span>
                                </div>
                                ${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName)}</span>` : ''}
                                <a href="${homeInfo.link}" class="match-lineup-box ${homeInfo.isOk ? 'is-ok' : (homeInfo.isRiposo ? 'is-riposo' : 'is-no')}" title="${homeInfo.title}">
                                  <span class="lineup-icon">${homeInfo.isOk ? '✓' : (homeInfo.isRiposo ? '-' : '✕')}</span>
                                  <span class="lineup-text">Formazione <strong>${homeInfo.status}</strong></span>
                                </a>
                              </div>
                            </div>
                            <div class="match-score-pill unplayed-score-pill">
                              <span class="score-unplayed">VS</span>
                            </div>
                            <div class="match-team away">
                              <img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <div class="team-info-wrap">
                                <div class="team-name-row">
                                  ${isAwayFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isAwayFav ? 'is-fav' : ''}" data-team-id="${m.awayTeamId || ''}" data-team-name="${escapeHtml(m.awayTeamName)}" title="Imposta come squadra del cuore">${isAwayFav ? '⭐' : '☆'}</button>` : ''}
                                  <span class="team-name-text" title="${m.awayTeamName}">${m.awayTeamName}</span>
                                </div>
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

      // Calcolo Under/Over (Soglia 138)
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

      const quotesMode = (userSettings && userSettings.quotesMode) ? userSettings.quotesMode : 'all';
      const show1x2 = quotesMode === 'all' || quotesMode === '1x2';
      const showUo = quotesMode === 'all' || quotesMode === 'uo';

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
                          ${show1x2 ? `
                            <th class="text-center quote-th-odd">1</th>
                            <th class="text-center quote-th-odd">X</th>
                            <th class="text-center quote-th-odd">2</th>
                          ` : ''}
                          ${showUo ? `
                            <th class="text-center quote-th-odd" title="Under 138 punti (somma medie &le; 138)">U</th>
                            <th class="text-center quote-th-odd" title="Over 138 punti (somma medie &gt; 138)">O</th>
                          ` : ''}
                        </tr>
                      </thead>
                      <tbody>
                        ${girone.matches.map(m => {
        const odds = calculateMatchOdds(m);
        const homeLogo = fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId);
        const awayLogo = fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId);
        const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
        const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
        const isQuoteFav = isHomeFav || isAwayFav;
        return `
                            <tr class="quote-row ${isQuoteFav ? 'favorite-team-row' : ''}">
                              <td class="quote-col-match">
                                <div class="quote-match-teams">
                                  <div class="quote-team home">
                                    <a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa"><img src="${homeLogo}" class="quote-team-logo" alt="${escapeHtml(m.homeTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                                    ${isHomeFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                    <span class="quote-team-name" title="${escapeHtml(m.homeTeamName)}"><a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(m.homeTeamName)}</a></span>
                                  </div>
                                  <span class="quote-vs">vs</span>
                                  <div class="quote-team away">
                                    <a href="#rose?team=${encodeURIComponent(m.awayTeamId || m.awayTeamName)}" class="team-rose-link" title="Vai alla rosa"><img src="${awayLogo}" class="quote-team-logo" alt="${escapeHtml(m.awayTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                                    ${isAwayFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                    <span class="quote-team-name" title="${escapeHtml(m.awayTeamName)}"><a href="#rose?team=${encodeURIComponent(m.awayTeamId || m.awayTeamName)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(m.awayTeamName)}</a></span>
                                  </div>
                                </div>
                              </td>
                              ${show1x2 ? `
                                <td class="text-center"><span class="quote-val-pill ${odds.c1}">${odds.q1}</span></td>
                                <td class="text-center"><span class="quote-val-pill ${odds.cX}">${odds.qX}</span></td>
                                <td class="text-center"><span class="quote-val-pill ${odds.c2}">${odds.q2}</span></td>
                              ` : ''}
                              ${showUo ? `
                                <td class="text-center"><span class="quote-val-pill ${odds.cU}">${odds.qU}</span></td>
                                <td class="text-center"><span class="quote-val-pill ${odds.cO}">${odds.qO}</span></td>
                              ` : ''}
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
                          <th class="text-center bilancio-th-stat bilancio-th-pts" title="Fantamedia negli scontri diretti">
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
        const isFavA = favoriteTeamId && (b.currentIdA == favoriteTeamId || b.idSquadraA == favoriteTeamId || b.nomeSquadraA == favoriteTeamId);
        const isFavB = favoriteTeamId && (b.currentIdB == favoriteTeamId || b.idSquadraB == favoriteTeamId || b.nomeSquadraB == favoriteTeamId);

        const vTitleA = b.formattedUltimaVittoriaA ? `title="Ultima: ${escapeHtml(b.formattedUltimaVittoriaA)}"` : '';
        const vTitleB = b.formattedUltimaVittoriaB ? `title="Ultima: ${escapeHtml(b.formattedUltimaVittoriaB)}"` : '';
        const pTitle = b.formattedUltimoPareggio ? `title="Ultimo: ${escapeHtml(b.formattedUltimoPareggio)}"` : '';

        return `
                            <!-- Card Incontro: ${escapeHtml(b.nomeSquadraA)} vs ${escapeHtml(b.nomeSquadraB)} -->
                            <tr class="bilancio-row bilancio-row-home ${isFavA ? 'favorite-team-row' : ''}">
                              <td class="bilancio-team-cell">
                                <div class="bilancio-team-info">
                                  <a href="#rose?team=${encodeURIComponent(b.currentIdA || b.idSquadraA || b.nomeSquadraA)}" class="team-rose-link" title="Vai alla rosa"><img src="${homeLogo}" class="bilancio-team-logo" alt="${escapeHtml(b.nomeSquadraA)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                                  ${isFavA ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isFavA ? 'is-fav' : ''}" data-team-id="${b.currentIdA || b.idSquadraA || ''}" data-team-name="${escapeHtml(b.nomeSquadraA)}" title="Imposta come squadra del cuore">${isFavA ? '⭐' : '☆'}</button>` : ''}
                                  <span class="bilancio-team-name" title="${escapeHtml(b.nomeSquadraA)}"><a href="#rose?team=${encodeURIComponent(b.currentIdA || b.idSquadraA || b.nomeSquadraA)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(b.nomeSquadraA)}</a></span>
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
                            <tr class="bilancio-row bilancio-row-away ${isFavB ? 'favorite-team-row' : ''}">
                              <td class="bilancio-team-cell">
                                <div class="bilancio-team-info">
                                  <a href="#rose?team=${encodeURIComponent(b.currentIdB || b.idSquadraB || b.nomeSquadraB)}" class="team-rose-link" title="Vai alla rosa"><img src="${awayLogo}" class="bilancio-team-logo" alt="${escapeHtml(b.nomeSquadraB)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                                  ${isFavB ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                                  ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isFavB ? 'is-fav' : ''}" data-team-id="${b.currentIdB || b.idSquadraB || ''}" data-team-name="${escapeHtml(b.nomeSquadraB)}" title="Imposta come squadra del cuore">${isFavB ? '⭐' : '☆'}</button>` : ''}
                                  <span class="bilancio-team-name" title="${escapeHtml(b.nomeSquadraB)}"><a href="#rose?team=${encodeURIComponent(b.currentIdB || b.idSquadraB || b.nomeSquadraB)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(b.nomeSquadraB)}</a></span>
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
          <div class="bilancio-tabs-container">
            <div class="bilancio-tabs-wrap">
              <button type="button" class="bilancio-tab-btn active" data-bilancio-target="current">
                <span class="bilancio-tab-live-dot"></span> In Corso (${calendar.nextMatchday}ª Serie A)
              </button>
              <button type="button" class="bilancio-tab-btn" data-bilancio-target="future">
                📅 Prossimo Turno (${nextSubmittableDay}ª Serie A)
              </button>
            </div>
          </div>
          <div class="bilancio-slider-viewport" id="bilancioViewport">
            <div class="bilancio-slider-track" id="bilancioTrack">
              <div class="bilancio-panel" id="bilancioPanelCurrent" data-index="0">
                ${renderBilancioTable(bilancioMatchesCurrent, calendar.nextMatchday)}
              </div>
              <div class="bilancio-panel" id="bilancioPanelFuture" data-index="1">
                ${renderBilancioTable(bilancioMatchesFuture, nextSubmittableDay)}
              </div>
            </div>
          </div>
        ` : `
          <div class="bilancio-panel">
            ${renderBilancioTable(bilancioMatchesCurrent, calendar.nextMatchday)}
          </div>
        `}
        <div class="bilancio-footer-legend">
          <span class="bilancio-legend-desktop">&bull; <strong>Panc.Com.</strong>: Panchine competizione</span>
          <span class="bilancio-legend-desktop">&bull; <strong>Panc.Tot.</strong>: Panchine totali</span>
          <span class="bilancio-legend-desktop">&bull; <strong>Punti</strong>: Fantamedia</span>
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
            <span class="badge badge-success" style="font-size:0.7rem;letter-spacing:0.3px;">${((userSettings && userSettings.quotesMode === '1x2') ? 'Solo 1X2' : ((userSettings && userSettings.quotesMode === 'uo') ? 'Solo Under/Over' : '1X2 &amp; U/O'))}</span>
          </div>
        </div>

        ${hasMultiTabs ? `
          <div class="quote-tabs-container">
            <div class="quote-tabs-wrap">
              <button type="button" class="quote-tab-btn active" data-quote-target="current">
                <span class="quote-tab-live-dot"></span> In Corso (${calendar.nextMatchday}ª Serie A)
              </button>
              <button type="button" class="quote-tab-btn" data-quote-target="future">
                📅 Prossimo Turno (${nextSubmittableDay}ª Serie A)
              </button>
            </div>
          </div>
          <div class="quote-slider-viewport" id="quoteViewport">
            <div class="quote-slider-track" id="quoteTrack">
              <div class="quote-panel" id="quotePanelCurrent" data-index="0">
                ${renderQuoteTable(currentDayQuoteMatches, calendar.nextMatchday)}
              </div>
              <div class="quote-panel" id="quotePanelFuture" data-index="1">
                ${renderQuoteTable(futureDayQuoteMatches, nextSubmittableDay)}
              </div>
            </div>
          </div>
        ` : `
          <div class="quote-panel">
            ${renderQuoteTable(currentDayQuoteMatches, calendar.nextMatchday)}
          </div>
        `}
        <div class="quote-footer-legend">
          <span class="legend-dot fav"></span> Verde = Favorito algoritmico &bull; Under/Over calcolato su soglia 138 pt totali (72+66) &bull; Aggio banco 15%
        </div>
      </div>
    `;

    // 9. Coppa di Lega (Dinamico: Classifica Gironi vs Incontri Eliminazione Diretta)
    const configuredCoppaCompId = (userSettings && userSettings.coppaCompId && userSettings.coppaCompId !== 'auto')
      ? userSettings.coppaCompId
      : null;
    const coppaComp = (configuredCoppaCompId ? comps.find(c => String(c.id) === String(configuredCoppaCompId)) : null)
      || comps.find(c => c.name.toLowerCase().includes('coppa') || c.id === 2);
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
    // e le squadre degli scontri diretti sono effettivamente valorizzate con nomi reali (oppure non c'è fase a gironi)
    const canShowKnockout = knockoutMatches.length > 0 &&
      !hasUnplayedGroupMatches &&
      (hasKnockoutMatchesPlayed || areKnockoutTeamsPopulated || !hasGroupStage);

    let coppaBlock = '';
    if (coppaComp) {
      const hasKnockoutOption = canShowKnockout;
      const hasGroupsOption = activeCoppaGroups.length > 0;
      const defaultCoppaMode = hasKnockoutOption ? 'knockout' : 'groups';

      const knockoutHtml = upcomingKnockoutMatches.length > 0 ? `
        <div class="matches-list" style="margin-top: 4px;">
          ${upcomingKnockoutMatches.map(m => {
        const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
        const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
        const isMatchFav = isHomeFav || isAwayFav;
        return `
            <div class="coppa-knockout-match ${isMatchFav ? 'is-favorite-match favorite-team-row' : ''}">
              <div class="coppa-match-header">
                <span>${escapeHtml(m.groupName)}</span>
                <span class="coppa-match-day-badge">${escapeHtml(m.fantagiornataNome || `${m.serieADay}ª Serie A`)}</span>
              </div>
              <div class="match-teams-row" style="gap: 4px;">
                <div class="match-team home">
                  <a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" style="width: 22px; height: 22px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div class="team-info-wrap">
                    <div class="team-name-row">
                      ${isHomeFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                      <span class="team-name-text" style="font-size: 0.78rem;" title="${m.homeTeamName}"><a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa">${m.homeTeamName}</a></span>
                    </div>
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
                  <a href="#rose?team=${encodeURIComponent(m.awayTeamId || m.awayTeamName)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId)}" class="team-badge-img" style="width: 22px; height: 22px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div class="team-info-wrap">
                    <div class="team-name-row">
                      ${isAwayFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                      <span class="team-name-text" style="font-size: 0.78rem;" title="${m.awayTeamName}"><a href="#rose?team=${encodeURIComponent(m.awayTeamId || m.awayTeamName)}" class="team-rose-link" title="Vai alla rosa">${m.awayTeamName}</a></span>
                    </div>
                    ${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) ? `<span class="team-trophies-badge">${fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName)}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
      }).join('')}
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
                    ${d.standings.map((s, idx) => {
        const isFav = favoriteTeamId && (s.teamId == favoriteTeamId || s.name == favoriteTeamId);
        return `
                      <tr class="${isFav ? 'favorite-team-row' : ''}">
                        <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${s.pos || (idx + 1)}</td>
                        <td>
                          <div class="table-col-team">
                            <a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                            ${isFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                            ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isFav ? 'is-fav' : ''}" data-team-id="${s.teamId || ''}" data-team-name="${escapeHtml(s.name)}" title="Imposta come squadra del cuore">${isFav ? '⭐' : '☆'}</button>` : ''}
                            <span><a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa">${s.name}</a></span>
                            ${fcmDataLoader.getTeamTrophiesHtml(s.name)}
                          </div>
                        </td>
                        <td class="text-right table-pts font-bold">${s.points}</td>
                      </tr>
                    `;
      }).join('')}
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

      const isCoppaOpen = (userSettings && userSettings.coppaAccordionOpen !== undefined) ? !!userSettings.coppaAccordionOpen : true;

      const coppaLogoHtml = (typeof fcmDataLoader.getCompetitionLogoHtml === 'function')
        ? fcmDataLoader.getCompetitionLogoHtml(coppaCompName, coppaComp.id, 18)
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
              </svg>`;

      coppaBlock = `
        <div class="card" style="margin-top: -6px;">
          <div class="card-header" id="headerCoppaStandings" style="cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;">
            <div class="card-title" style="font-size: 0.95rem;">
              ${coppaLogoHtml}
              ${escapeHtml(coppaCompName)}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <a href="#classifica?comp=${coppaComp.id}" class="badge badge-primary" style="font-size: 0.68rem;" onclick="event.stopPropagation();">Completa &rarr;</a>
              <span class="badge badge-primary" id="badgeCoppaToggle" style="font-size: 0.68rem;">${isCoppaOpen ? 'Chiudi ▲' : 'Apri ▼'}</span>
            </div>
          </div>
          <div id="contentCoppaStandings" style="display: ${isCoppaOpen ? 'block' : 'none'}; padding-top: 10px;">
            ${(hasKnockoutOption && hasGroupsOption) ? `
              <div class="coppa-phase-tabs-container" style="display:flex;justify-content:center;margin-bottom:12px;">
                <div class="coppa-phase-tabs">
                  <button type="button" class="coppa-phase-btn ${defaultCoppaMode === 'knockout' ? 'active' : ''}" id="btnCoppaTabKnockout">
                    Scontri Diretti
                  </button>
                  <button type="button" class="coppa-phase-btn ${defaultCoppaMode === 'groups' ? 'active' : ''}" id="btnCoppaTabGroups">
                    Classifica Gironi
                  </button>
                </div>
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

    // Mini Standings Card
    const mainCompLogoHtml = (typeof fcmDataLoader.getCompetitionLogoHtml === 'function')
      ? fcmDataLoader.getCompetitionLogoHtml(mainCompName, mainComp ? mainComp.id : null, 20)
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
              <path d="M4 22h16"></path>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
            </svg>`;
    const standingsBlock = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${mainCompLogoHtml}
            Classifica ${escapeHtml(mainCompName)}
          </div>
          <a href="#classifica${mainComp ? `?comp=${mainComp.id}` : ''}" class="badge badge-primary">Completa &rarr;</a>
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
              ${standings.map((s, idx) => {
      const isFav = favoriteTeamId && (s.teamId == favoriteTeamId || s.name == favoriteTeamId);
      return `
                  <tr class="${isFav ? 'favorite-team-row' : ''}">
                    <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${s.pos}</td>
                    <td>
                      <div class="table-col-team">
                        <a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                        ${isFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                        ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isFav ? 'is-fav' : ''}" data-team-id="${s.teamId || ''}" data-team-name="${escapeHtml(s.name)}" title="Imposta come squadra del cuore">${isFav ? '⭐' : '☆'}</button>` : ''}
                        <span><a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa">${s.name}</a></span>
                        ${fcmDataLoader.getTeamTrophiesHtml(s.name)}
                      </div>
                    </td>
                    <td class="text-right table-pts">${s.points}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Classifica GP (Punti Totali)
    const isGpOpen = (userSettings && userSettings.gpAccordionOpen !== undefined) ? userSettings.gpAccordionOpen : true;
    const gpStandingsBlock = `
      <div class="card" style="margin-top: -6px;">
        <div class="card-header" id="headerGpStandings" style="cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;">
          <div class="card-title" style="font-size: 0.95rem;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2"></rect>
              <line x1="2" y1="7" x2="22" y2="7"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="17" x2="22" y2="17"></line>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
            </svg>
            Classifica GP
          </div>
          <span class="badge badge-primary" id="badgeGpToggle" style="font-size: 0.68rem;">${isGpOpen ? 'Chiudi ▲' : 'Apri ▼'}</span>
        </div>
        <div id="contentGpStandings" style="display: ${isGpOpen ? 'block' : 'none'}; padding-top: 10px;">
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
                ${gpStandings.map((s, idx) => {
      const isFav = favoriteTeamId && (s.teamId == favoriteTeamId || s.name == favoriteTeamId);
      return `
                    <tr class="${isFav ? 'favorite-team-row' : ''}">
                      <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${idx + 1}</td>
                      <td>
                        <div class="table-col-team">
                          <a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                          ${isFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                          ${this.isEditMode ? `<button type="button" class="btn-tap-to-star ${isFav ? 'is-fav' : ''}" data-team-id="${s.teamId || ''}" data-team-name="${escapeHtml(s.name)}" title="Imposta come squadra del cuore">${isFav ? '⭐' : '☆'}</button>` : ''}
                          <span><a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa">${s.name}</a></span>
                        </div>
                      </td>
                      <td class="text-right table-pts" style="color:var(--accent-cyan);font-weight:800;">
                        ${(s.sommaTotali || 0).toFixed(2)}
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Live Tools (sidebar)
    const liveToolsBlock = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            Live &amp; Strumenti
          </div>
        </div>
        <div class="live-links-grid">
          ${isAnyLiveActive ? `
          <a href="#live" class="live-link-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span class="live-link-name">Match Center Live</span>
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
      </div>
    `;

    // Dizionario mapping dei blocchi widget standard
    const widgetBlocksMap = {
      news: '<div id="homeAiNewsContainer" class="ai-news-slot"></div>',
      liveMatchday: isMatchdayInProgress ? liveMatchdayBlock : '',
      liveHero: '',
      miniFormations: '',
      countdown: (!isMatchdayInProgress) ? countdownBlock : '',
      results: resultsBlock,
      topFlop11: topFlop11Block,
      bestWorstMister: bestWorstMisterBlock,
      nextDayPreview: (!isMatchdayInProgress) ? nextDayPreviewBlock : '',
      anticipo: (isMatchdayInProgress && allowFutureLineups) ? anticipoBlock : '',
      bilancio: bilancioBlock,
      quotes: quotesBlock,
      standings: standingsBlock,
      gpStandings: gpStandingsBlock,
      coppa: coppaBlock,
      liveTools: (!isMatchdayInProgress) ? liveToolsBlock : '',
      guestbook: guestbookBlock,
      sponsors: sponsorsBlock,
      counter: isCounterEnabled ? counterBlock : ''
    };

    // Rendering dinamico di ciascuna colonna secondo l'ordine e visibilità configurati
    const renderColumnContent = (colKey) => {
      const items = (activeConfig && activeConfig.columns && Array.isArray(activeConfig.columns[colKey]))
        ? activeConfig.columns[colKey]
        : null;

      if (!items || items.length === 0) {
        if (this.isEditMode) {
          const colLabel = colKey === 'main' ? 'principale' : 'laterale';
          return `
            <div class="widget-dropzone-edge widget-drop-slot zone-top slot-top slot-edge is-empty-column" data-col="${colKey}" data-index="0" data-pos="top" title="Colonna vuota: rilascia qui un widget">
              <span class="widget-dropzone-icon">＋</span>
              <span class="widget-dropzone-label">Colonna ${colLabel} vuota: rilascia un widget qui</span>
              <div class="widget-drop-line"></div>
            </div>
          `;
        }
        if (colKey === 'main') {
          return isMatchdayInProgress
            ? `${widgetBlocksMap.liveMatchday}${widgetBlocksMap.news}${widgetBlocksMap.results}${widgetBlocksMap.topFlop11}${widgetBlocksMap.bestWorstMister}${widgetBlocksMap.anticipo}${widgetBlocksMap.bilancio}${widgetBlocksMap.quotes}`
            : `${widgetBlocksMap.news}${widgetBlocksMap.results}${widgetBlocksMap.countdown}${widgetBlocksMap.topFlop11}${widgetBlocksMap.bestWorstMister}${widgetBlocksMap.nextDayPreview}${widgetBlocksMap.bilancio}${widgetBlocksMap.quotes}`;
        } else {
          return `${widgetBlocksMap.standings}${widgetBlocksMap.gpStandings}${widgetBlocksMap.coppa}${widgetBlocksMap.liveTools}${widgetBlocksMap.guestbook}${widgetBlocksMap.sponsors}${widgetBlocksMap.counter}`;
        }
      }

      let colHtml = '';
      items.forEach((item, idx) => {
        if (this.isEditMode && idx > 0) {
          colHtml += `
            <div class="widget-drop-slot slot-between" data-col="${colKey}" data-index="${idx}" title="Rilascia per inserire tra questi due widget">
              <div class="widget-drop-line"></div>
            </div>
          `;
        }
        const info = (typeof fcmHomeConfigManager !== 'undefined') ? fcmHomeConfigManager.getWidgetInfo(item.id) : null;
        const title = info ? info.title : item.id;

        // Se in modalità modifica e il widget è disabilitato: render Ghost Slot compatto
        if (this.isEditMode && !item.enabled) {
          colHtml += `
            <div class="widget-block-editable is-disabled" data-col="${colKey}" data-id="${item.id}" draggable="true">
              <div class="widget-ghost-slot">
                <div class="widget-ghost-info">
                  <span class="widget-ghost-icon">🚫</span>
                  <span class="widget-ghost-name">${escapeHtml(title)} <small class="text-muted" style="font-weight: normal;">(Nascosto)</small></span>
                </div>
                <div class="widget-ghost-actions">
                  <button type="button" class="widget-move-btn btn-up" data-col="${colKey}" data-id="${item.id}" ${idx === 0 ? 'disabled' : ''} title="Sposta in alto">▲</button>
                  <button type="button" class="widget-move-btn btn-down" data-col="${colKey}" data-id="${item.id}" ${idx === items.length - 1 ? 'disabled' : ''} title="Sposta in basso">▼</button>
                  <button type="button" class="widget-vis-btn btn-show" data-col="${colKey}" data-id="${item.id}" title="Mostra nella Home">👁️ Mostra</button>
                </div>
              </div>
            </div>
          `;
          return;
        }

        // In modalità normale, se disabilitato, non mostrare
        if (!item.enabled) return;

        // Recupera contenuto reale del blocco
        let blockContent = '';
        if (item.id === 'liveHero' || item.id === 'miniFormations') {
          // Retrocompatibilità: confluiti nel widget unificato liveMatchday
          blockContent = '';
        } else if (item.isCustom || (item.id && item.id.startsWith('custom_'))) {
          if (activeConfig.customWidgets && Array.isArray(activeConfig.customWidgets)) {
            const customObj = activeConfig.customWidgets.find(c => c.id === item.id);
            if (customObj && typeof fcmHomeConfigManager !== 'undefined') {
              blockContent = fcmHomeConfigManager.renderCustomWidget(customObj, { isMatchdayInProgress, info, nextDayMatches, favoriteTeamId, isEditMode: this.isEditMode, calendar });
            }
          }
        } else if (widgetBlocksMap[item.id]) {
          blockContent = widgetBlocksMap[item.id];
        }

        // Se siamo in edit mode ma il blocco condizionale al momento è vuoto (es. liveHero non in live)
        if (this.isEditMode && !blockContent) {
          blockContent = `
            <div class="card" style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem;">
              <div style="font-weight:700;margin-bottom:4px;color:var(--text-primary);">${escapeHtml(title)}</div>
              Questo blocco viene mostrato automaticamente all'occorrenza (es. durante le partite o in base alla competizione).
            </div>
          `;
        }

        if (!blockContent) return;

        // Se in edit mode: avvolgi con la toolbar e le preferenze contestuali
        if (this.isEditMode) {
          let inlinePrefHtml = '';
          if (item.id === 'topFlop11') {
            inlinePrefHtml = `
              <div class="widget-inline-pref">
                <span class="widget-inline-pref-label">⚙️ Vista iniziale:</span>
                <div class="inline-pref-pills">
                  <button type="button" class="inline-pref-pill ${userSettings.topFlopDefaultTab !== 'flop' ? 'active' : ''}" data-pref="topFlopDefaultTab" data-val="top">🌟 Top 11</button>
                  <button type="button" class="inline-pref-pill ${userSettings.topFlopDefaultTab === 'flop' ? 'active' : ''}" data-pref="topFlopDefaultTab" data-val="flop">👎 Flop 11</button>
                </div>
              </div>
            `;
          } else if (item.id === 'quotes') {
            inlinePrefHtml = `
              <div class="widget-inline-pref">
                <span class="widget-inline-pref-label">⚙️ Quote predefinite:</span>
                <div class="inline-pref-pills">
                  <button type="button" class="inline-pref-pill ${(!userSettings.quotesMode || userSettings.quotesMode === 'all') ? 'active' : ''}" data-pref="quotesMode" data-val="all">Tutte (1X2 + U/O)</button>
                  <button type="button" class="inline-pref-pill ${userSettings.quotesMode === '1x2' ? 'active' : ''}" data-pref="quotesMode" data-val="1x2">Solo 1X2</button>
                  <button type="button" class="inline-pref-pill ${userSettings.quotesMode === 'uo' ? 'active' : ''}" data-pref="quotesMode" data-val="uo">Solo Under/Over</button>
                </div>
              </div>
            `;
          }

          colHtml += `
            <div class="widget-block-editable is-enabled" data-col="${colKey}" data-id="${item.id}" draggable="true">
              <div class="widget-edit-toolbar">
                <div class="widget-edit-drag-grip" title="Trascina per riordinare nella colonna">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>
                  <span class="widget-edit-title">${escapeHtml(title)}</span>
                </div>
                <div class="widget-edit-btns">
                  <button type="button" class="widget-move-btn btn-up" data-col="${colKey}" data-id="${item.id}" ${idx === 0 ? 'disabled' : ''} title="Sposta in alto">▲</button>
                  <button type="button" class="widget-move-btn btn-down" data-col="${colKey}" data-id="${item.id}" ${idx === items.length - 1 ? 'disabled' : ''} title="Sposta in basso">▼</button>
                  <button type="button" class="widget-vis-btn btn-hide" data-col="${colKey}" data-id="${item.id}" title="Nascondi questo widget">👁️</button>
                </div>
              </div>
              ${inlinePrefHtml}
              <div class="widget-editable-content">
                ${blockContent}
              </div>
            </div>
          `;
        } else {
          colHtml += blockContent;
        }
      });
      if (this.isEditMode) {
        const colLabel = colKey === 'main' ? 'principale' : 'laterale';
        const topEdge = `
          <div class="widget-dropzone-edge widget-drop-slot zone-top slot-top slot-edge" data-col="${colKey}" data-index="0" data-pos="top" title="Rilascia qui per spostare in cima alla colonna ${colLabel}">
            <span class="widget-dropzone-icon">⬆️</span>
            <span class="widget-dropzone-label">In cima alla colonna ${colLabel}</span>
            <div class="widget-drop-line"></div>
          </div>
        `;
        const bottomEdge = `
          <div class="widget-dropzone-edge widget-drop-slot zone-bottom slot-bottom slot-edge" data-col="${colKey}" data-index="${items.length}" data-pos="bottom" title="Rilascia qui per spostare in calce alla colonna ${colLabel}">
            <span class="widget-dropzone-icon">⬇️</span>
            <span class="widget-dropzone-label">In calce alla colonna ${colLabel}</span>
            <div class="widget-drop-line"></div>
          </div>
        `;
        return topEdge + colHtml + bottomEdge;
      }
      return colHtml;
    };

    const mainColHtml = renderColumnContent('main');
    const sideColHtml = renderColumnContent('side');
    const teams = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getTeams) ? fcmDataLoader.getTeams() : [];

    let html = `
      ${this.isEditMode ? `
        <div class="home-edit-topbar">
          <div class="home-edit-topbar-content">
            <div class="home-edit-badge">
              <span>✏️</span> <strong>Personalizzazione Homepage Attiva</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div class="home-edit-fav-team">
                <label for="editSelectFavTeam">⭐ Squadra del Cuore:</label>
                <select id="editSelectFavTeam" class="home-edit-select">
                  <option value="">-- Nessuna --</option>
                  ${teams.map(t => {
      const tId = t.ID || t.id;
      const tName = t.Nome || t.name;
      const isSel = (favoriteTeamId && (favoriteTeamId == tId || favoriteTeamId == tName));
      return `<option value="${tId}" ${isSel ? 'selected' : ''}>${escapeHtml(tName)}</option>`;
    }).join('')}
                </select>
              </div>
              <a href="inc/homepage_admin.php" class="home-edit-admin-btn" title="Vai al pannello Amministratore Lega per creare nuovi widget o modificare il layout di fabbrica">
                <span>🛡️ Gestione Home (Admin)</span>
              </a>
            </div>
          </div>
          <div class="home-edit-tip">
            💡 <strong>Trascina i blocchi</strong> per riordinarli tra due widget (apparirà una riga indicatore) oppure rilasciali in cima o in calce a qualsiasi colonna. Puoi anche usare le frecce <strong>▲ ▼</strong> o cliccare su <strong>👁️</strong> per nascondere o riattivare un widget.
          </div>
        </div>
      ` : ''}

      <div class="dashboard-grid">
        <!-- Main Column -->
        <div class="dashboard-main-col">
          ${mainColHtml}
        </div>

        <!-- Sidebar / Secondary Column -->
        <div class="dashboard-side-col">
          ${sideColHtml}
        </div>
      </div>

      ${this.isEditMode ? `
        <div class="home-floating-dock">
          <div class="dock-status">
            <span class="dock-icon">✏️</span>
            <span class="dock-text">Personalizzazione</span>
          </div>
          <div class="dock-actions">
            <button type="button" class="dock-btn dock-btn-reset" id="btnDockReset" title="Ripristina layout originale di Lega">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              <span class="dock-btn-label-desktop">Ripristina</span>
              <span class="dock-btn-label-mobile">Reset</span>
            </button>
            <button type="button" class="dock-btn dock-btn-cancel" id="btnDockCancel" title="Annulla modifiche ed esci">
              <span class="dock-btn-label-desktop">✕ Annulla</span>
              <span class="dock-btn-label-mobile">✕</span>
            </button>
            <button type="button" class="dock-btn dock-btn-save" id="btnDockSave" title="Salva personalizzazioni sul tuo dispositivo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span class="dock-btn-label-desktop">Salva Modifiche</span>
              <span class="dock-btn-label-mobile">Salva</span>
            </button>
          </div>
        </div>
      ` : ''}

      ${isMatchdayInProgress ? this._renderLiveInfoModalHtml() : ''}
    `;

    container.innerHTML = html;

    // Delegated click per match cards Calenbomber dei risultati
    container.querySelectorAll('.home-calen-card[data-match-href]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('a') && !e.target.closest('button')) {
          const href = card.getAttribute('data-match-href');
          if (href) window.location.hash = href;
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!e.target.closest('a') && !e.target.closest('button')) {
            e.preventDefault();
            const href = card.getAttribute('data-match-href');
            if (href) window.location.hash = href;
          }
        }
      });
    });

    if (this.isEditMode) {
      this.bindEditModeEvents(container);
    }
    this.initAiNewsWidget(container);
    this.initGuestbookPreview(container);
    this.initVisitorCounter(container);
    this.initBilancioTabs(container);
    this.initQuoteTabs(container);
    this.initTopFlop11Slider(container);
    this.initFantamisterSlider(container);
    this.initFormationsSlider(container);

    // Inizializza timer dei custom countdown widgets e widget competizione custom
    if (typeof fcmHomeConfigManager !== 'undefined') {
      if (fcmHomeConfigManager.initCustomCountdowns) {
        fcmHomeConfigManager.initCustomCountdowns(container);
      }
      if (fcmHomeConfigManager.initCustomCompetitionWidgets) {
        fcmHomeConfigManager.initCustomCompetitionWidgets(container);
      }
    }

    // Se l'utente ha impostato Flop 11 come vista predefinita
    if (userSettings && userSettings.topFlopDefaultTab === 'flop') {
      const flopPill = container.querySelector('#pillFlop11');
      if (flopPill) {
        flopPill.click();
      }
    }

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

    // Auto-hide header on scroll down / show on scroll up (#home)
    this.initHeaderAutoHide();
  },

  /**
   * Attaches tab switching logic and horizontal swipe slider for the Bilancio Prossimo Turno widget when matchday is in progress.
   */
  initBilancioTabs(container) {
    const track = container.querySelector('#bilancioTrack');
    const tabBtns = container.querySelectorAll('.bilancio-tab-btn');
    if (!tabBtns || tabBtns.length === 0) return;

    const pCurrent = container.querySelector('#bilancioPanelCurrent');
    const pFuture = container.querySelector('#bilancioPanelFuture');

    const updateActiveTab = (target) => {
      tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-bilancio-target') === target);
      });
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-bilancio-target');
        updateActiveTab(target);
        if (track) {
          const targetEl = target === 'current' ? pCurrent : pFuture;
          if (targetEl) {
            track.scrollTo({ left: targetEl.offsetLeft, behavior: 'smooth' });
          }
        }
      });
    });

    if (track) {
      let scrollTimer;
      track.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const scrollLeft = track.scrollLeft;
          const futureLeft = pFuture ? pFuture.offsetLeft : Infinity;
          const isCloserToFuture = Math.abs(scrollLeft - futureLeft) < Math.abs(scrollLeft - 0);
          updateActiveTab(isCloserToFuture ? 'future' : 'current');
        }, 50);
      }, { passive: true });
    }
  },

  /**
   * Attaches tab switching logic and horizontal swipe slider for the Quotes widget when matchday is in progress.
   */
  initQuoteTabs(container) {
    const track = container.querySelector('#quoteTrack');
    const tabBtns = container.querySelectorAll('.quote-tab-btn');
    if (!tabBtns || tabBtns.length === 0) return;

    const pCurrent = container.querySelector('#quotePanelCurrent');
    const pFuture = container.querySelector('#quotePanelFuture');

    const updateActiveTab = (target) => {
      tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-quote-target') === target);
      });
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-quote-target');
        updateActiveTab(target);
        if (track) {
          const targetEl = target === 'current' ? pCurrent : pFuture;
          if (targetEl) {
            track.scrollTo({ left: targetEl.offsetLeft, behavior: 'smooth' });
          }
        }
      });
    });

    if (track) {
      let scrollTimer;
      track.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const scrollLeft = track.scrollLeft;
          const futureLeft = pFuture ? pFuture.offsetLeft : Infinity;
          const isCloserToFuture = Math.abs(scrollLeft - futureLeft) < Math.abs(scrollLeft - 0);
          updateActiveTab(isCloserToFuture ? 'future' : 'current');
        }, 50);
      }, { passive: true });
    }
  },

  /**
   * Initializes compact horizontal carousel and match dropdown navigation for live Formations widget.
   */
  initFormationsSlider(container) {
    const card = container.querySelector('#formationsWidgetCard');
    if (!card) return;

    // Auto-refresh voti ufficiosi all'apertura del live in home
    if (!this._hasAutoRefreshedLiveVU) {
      this._hasAutoRefreshedLiveVU = true;
      const cal = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) ? fcmDataLoader.getCalendarData() : null;
      const g = (cal && cal.nextMatchday) ? cal.nextMatchday : 1;
      this._autoRefreshLiveVUHome(container, g);
    }

    this._bindLiveWidgetInteractions(card);

    // Fadeout automatico del badge se non in corso di aggiornamento
    const initialBadge = card.querySelector('#liveHomeRefreshStatus');
    if (initialBadge && !initialBadge.querySelector('.spin')) {
      setTimeout(() => {
        initialBadge.classList.add('live-refresh-fadeout');
        setTimeout(() => {
          if (initialBadge) initialBadge.style.display = 'none';
        }, 850);
      }, 1500);
    }

    // Controllo e avvio automatico timer se ci sono partite in corso
    this._checkAndSetupAutoRefresh();
  },

  /**
   * Collega interazioni (tab competizioni, toggle formazioni, pill switch sorgente) alla card live
   */
  _bindLiveWidgetInteractions(card) {
    if (!card) return;

    // Gestione tab competizione (se presenti)
    const panes = card.querySelectorAll('.formations-comp-pane');
    const compTabs = card.querySelectorAll('.formations-comp-tab-btn');
    if (compTabs.length > 0 && panes.length > 0) {
      compTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          compTabs.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const targetComp = btn.dataset.comp;
          panes.forEach(pane => {
            pane.style.display = (pane.dataset.compPane === targetComp) ? 'block' : 'none';
          });
        });
      });
    }

    // Toggle mostra/nascondi dettaglio formazioni per ciascun incontro
    const toggleBtns = card.querySelectorAll('.btn-toggle-formations');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const targetEl = card.querySelector('#' + targetId);
        if (!targetEl) return;
        const isHidden = (targetEl.style.display === 'none' || getComputedStyle(targetEl).display === 'none');
        if (isHidden) {
          targetEl.style.display = 'block';
          btn.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          const txt = btn.querySelector('.toggle-text');
          if (txt) txt.textContent = 'Nascondi Formazioni';
        } else {
          targetEl.style.display = 'none';
          btn.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          const txt = btn.querySelector('.toggle-text');
          if (txt) txt.textContent = 'Dettaglio Formazioni';
        }
      });
    });

    // Switch rapido sorgente live secondaria (Fantacalcio / Fantapazz / FantaMaster)
    const sourcePills = card.querySelectorAll('.live-source-pill');
    sourcePills.forEach(pill => {
      pill.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetSource = pill.dataset.source;
        if (!targetSource || targetSource === this._activeSecondaryLive) return;
        sourcePills.forEach(p => {
          p.classList.remove('active');
          if (typeof p.setAttribute === 'function') p.setAttribute('aria-pressed', 'false');
        });
        pill.classList.add('active');
        if (typeof pill.setAttribute === 'function') pill.setAttribute('aria-pressed', 'true');
        await this._switchSecondaryLiveSource(targetSource);
      });
    });

    // Bottone Info su simulazione e calcolo integrato (apre native <dialog> con showModal)
    const btnLiveInfo = card.querySelector('#btnHomeLiveInfo');
    if (btnLiveInfo) {
      btnLiveInfo.addEventListener('click', (e) => {
        e.preventDefault();
        const scopeRoot = this.container || (typeof document !== 'undefined' ? document : null);
        let infoDialog = scopeRoot && typeof scopeRoot.querySelector === 'function'
          ? scopeRoot.querySelector('#homeLiveInfoModal')
          : null;
        if (!infoDialog && typeof document !== 'undefined' && typeof document.getElementById === 'function') {
          infoDialog = document.getElementById('homeLiveInfoModal');
        }
        if (!infoDialog && typeof document !== 'undefined' && typeof this._renderLiveInfoModalHtml === 'function') {
          const host = this.container || card.parentNode;
          if (host && typeof host.insertAdjacentHTML === 'function') {
            host.insertAdjacentHTML('beforeend', this._renderLiveInfoModalHtml());
            infoDialog = (typeof host.querySelector === 'function' ? host.querySelector('#homeLiveInfoModal') : null) || document.getElementById('homeLiveInfoModal');
          }
        }
        if (infoDialog) {
          this._bindLiveInfoDialog(infoDialog);
          if (typeof infoDialog.showModal === 'function' && !infoDialog.open) {
            infoDialog.showModal();
          }
        }
      });
    }
  },

  /**
   * Restituisce il markup HTML del <dialog> nativo informativo su simulazione e calcolo integrato in Home
   */
  _renderLiveInfoModalHtml() {
    return `
      <dialog id="homeLiveInfoModal" class="home-live-info-dialog" closedby="any" aria-labelledby="homeLiveInfoTitle">
        <div class="home-live-info-header">
          <h3 id="homeLiveInfoTitle" class="calc-modal-title" style="display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-cyan, #06b6d4);flex-shrink:0;" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Simulazione e Calcolo Integrato</span>
          </h3>
          <form method="dialog" style="margin:0;">
            <button type="submit" class="calc-modal-close-btn" id="btnCloseHomeLiveInfo" aria-label="Chiudi">&times;</button>
          </form>
        </div>
        <div class="home-live-info-body">
          <p class="home-live-info-intro">
            Il riquadro <strong>Live in Corso</strong> calcola in tempo reale il punteggio stimato di ogni incontro applicando regolamento, modificatori e fasce gol configurati per la competizione.
          </p>
          <div class="home-live-info-steps">
            <div class="home-live-info-step">
              <div class="home-live-info-step-badge is-vu">1. Priorità Voti Ufficiosi (PianetaFanta)</div>
              <p>Non appena i voti ufficiosi (<strong>VU</strong>) della squadra di Serie A risultano caricati su PianetaFanta, hanno sempre la precedenza assoluta. Eventuali calciatori <strong>S.V.</strong> con bonus o malus determinante (es. gol, rigore, espulsione, autogol o gol subito portiere) ricevono base <strong>6.0</strong> + bonus (evidenziati in arancione).</p>
            </div>
            <div class="home-live-info-step">
              <div class="home-live-info-step-badge is-live">2. Integrazione Live (Fantacalcio / Fantapazz / FantaMaster)</div>
              <p>Per le squadre senza ancora voti ufficiosi su PianetaFanta (gare in corso o appena concluse in attesa di pagelle), il widget integra i voti live della fonte selezionata (<strong>Fantacalcio</strong>, <strong>Fantapazz</strong> o <strong>FantaMaster</strong>, riconoscibile dalla micro-icona sul box voto). Chi è in campo ma ancora senza voto riceve provvisoriamente <strong>6.0</strong>.</p>
            </div>
            <div class="home-live-info-step">
              <div class="home-live-info-step-badge is-virtual">3. Gare da Disputare, Sostituzioni e Marcatori</div>
              <p>I calciatori di partite non ancora iniziate ricevono un <strong>6.0 virtuale</strong> di stima (indicato con <strong>&ndash;</strong> fino all'inizio gara). Chi è definitivamente <strong>S.V.</strong> viene sostituito dalla panchina (badge <strong>Out</strong> / <strong>In</strong>) o dalla riserva d'ufficio, e i gol proiettati attivano la stima dei marcatori Calenbomber.</p>
            </div>
          </div>
        </div>
        <div class="home-live-info-footer">
          <form method="dialog" style="margin:0;">
            <button type="submit" id="btnCloseHomeLiveInfoBtn" class="btn-live-action" autofocus>Chiudi</button>
          </form>
        </div>
      </dialog>
    `;
  },

  /**
   * Configura reset di returnValue alla chiusura e fallback light-dismiss per browser senza closedby (es. Safari)
   */
  _bindLiveInfoDialog(dialog) {
    if (!dialog || (dialog.dataset && dialog.dataset.liveInfoBound === '1')) return;
    if (dialog.dataset) dialog.dataset.liveInfoBound = '1';

    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });

    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dlg) => {
        const r = dlg.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog) && typeof dialog.close === 'function') {
          dialog.close();
        }
        pressedOutside = false;
      });
    }
  },

  /**
   * Carica e visualizza l'editoriale di giornata generato con AI dalla cache,
   * permettendo la selezione con menù a tendina di giornate diverse (default: ultima giornata)
   */
  async initAiNewsWidget(container) {
    const slot = container.querySelector('#homeAiNewsContainer');
    if (!slot) return;

    let targetDay = 0;
    if (typeof fcmDataLoader !== 'undefined') {
      const cal = fcmDataLoader.getCalendarData();
      if (cal && cal.lastCompletedMatchday) {
        targetDay = cal.lastCompletedMatchday;
      }
    }

    try {
      let articles = [];
      const resList = await fetch('inc/api_ai_news.php?action=list');
      if (resList.ok) {
        const listData = await resList.json();
        if (listData && listData.success && Array.isArray(listData.list)) {
          articles = listData.list;
        }
      }

      // Fallback a get se action=list vuoto o non disponibile
      if (articles.length === 0) {
        const resGet = await fetch(`inc/api_ai_news.php?action=get&giornata=${targetDay}`);
        if (resGet.ok) {
          const getData = await resGet.json();
          if (getData && getData.success && getData.available && getData.article) {
            articles = [getData.article];
          }
        }
      }

      if (articles.length === 0) {
        if (this.isEditMode) {
          slot.innerHTML = `
            <div class="card ai-editorial-card" style="border: 1px dashed var(--border-subtle); padding: 14px; text-align: center;">
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                ✨ Nessun editoriale pubblicato per la ${targetDay ? targetDay + 'ª ' : ''}Giornata.
              </div>
              <a href="inc/impostazioni.php?tab=home&section=ai#sezione-ai-news" class="pill-btn pill-btn-sm" style="display: inline-flex; margin: 0 auto; text-decoration: none;">
                ⚙️ Genera con Gemini AI nel Pannello Admin
              </a>
            </div>
          `;
          slot.style.display = 'block';
        } else {
          slot.style.display = 'none';
        }
        return;
      }

      // Ordina gli editoriali per giornata decrescente (la più recente in cima)
      articles.sort((a, b) => (parseInt(b.giornata, 10) || 0) - (parseInt(a.giornata, 10) || 0));

      const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

      // Default: visualizza l'editoriale dell'ultima giornata disponibile
      let currentDay = parseInt(articles[0].giornata, 10) || targetDay || 1;

      const renderArticle = (day) => {
        const art = articles.find(a => (parseInt(a.giornata, 10) || 0) === day) || articles[0];
        if (!art) return;
        currentDay = parseInt(art.giornata, 10) || day;

        const paragraphs = String(art.content || '').split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const paragraphsHtml = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

        const hl = art.highlights || {};
        const hasHighlights = (hl.clou || hl.top || hl.beffa);

        const highlightsHtml = hasHighlights ? `
          <div class="ai-editorial-highlights">
            ${hl.clou ? `<div class="ai-highlight-pill clou"><strong>⚡ Match Clou</strong>${escapeHtml(hl.clou)}</div>` : ''}
            ${hl.top ? `<div class="ai-highlight-pill top"><strong>🌟 Top Player</strong>${escapeHtml(hl.top)}</div>` : ''}
            ${hl.beffa ? `<div class="ai-highlight-pill beffa"><strong>💔 La Beffa</strong>${escapeHtml(hl.beffa)}</div>` : ''}
          </div>
        ` : '';

        slot.innerHTML = `
          <article class="card ai-editorial-card" aria-label="Editoriale di Giornata">
            <div class="ai-editorial-header">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="ai-editorial-badge">✨ L'Editoriale di Giornata</span>
                <select id="selAiEditorialDay" class="ai-editorial-select" aria-label="Seleziona giornata editoriale">
                  ${articles.map(a => `
                    <option value="${a.giornata}" ${parseInt(a.giornata, 10) === currentDay ? 'selected' : ''}>
                      ${a.giornata}ª Giornata
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="ai-editorial-meta">
                ${art.publishedFormatted ? `<span>${escapeHtml(art.publishedFormatted)}</span>` : ''}
                ${this.isEditMode ? `<a href="inc/impostazioni.php?tab=home&section=ai#sezione-ai-news" style="color:var(--accent-primary); font-weight:700; text-decoration:underline; margin-left:6px;">Modifica</a>` : ''}
              </div>
            </div>

            <h3 class="ai-editorial-title">${escapeHtml(art.title)}</h3>
            ${art.subtitle ? `<div class="ai-editorial-subtitle">${escapeHtml(art.subtitle)}</div>` : ''}

            ${highlightsHtml}

            <div class="ai-editorial-content-wrapper">
              <div class="ai-editorial-content is-collapsed" id="homeAiEditorialContent">
                ${paragraphsHtml}
              </div>
              <button type="button" class="ai-editorial-toggle-btn" id="btnToggleAiEditorial" aria-expanded="false">
                <span>Leggi tutto l'editoriale</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>

            <div class="ai-editorial-footer">
              <span>Generato con ${escapeHtml(art.model || 'Google Gemini AI')}</span>
              <span>ModernFCM</span>
            </div>
          </article>
        `;

        slot.style.display = 'block';

        // Bind cambio giornata dal menù a tendina
        const selDay = slot.querySelector('#selAiEditorialDay');
        if (selDay) {
          selDay.addEventListener('change', (e) => {
            const nextDay = parseInt(e.target.value, 10);
            renderArticle(nextDay);
          });
        }

        // Bind toggle per espansione mobile
        const toggleBtn = slot.querySelector('#btnToggleAiEditorial');
        const contentEl = slot.querySelector('#homeAiEditorialContent');
        if (toggleBtn && contentEl) {
          toggleBtn.addEventListener('click', () => {
            const isCollapsed = contentEl.classList.contains('is-collapsed');
            if (isCollapsed) {
              contentEl.classList.remove('is-collapsed');
              toggleBtn.setAttribute('aria-expanded', 'true');
              toggleBtn.innerHTML = '<span>Mostra meno</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>';
            } else {
              contentEl.classList.add('is-collapsed');
              toggleBtn.setAttribute('aria-expanded', 'false');
              toggleBtn.innerHTML = '<span>Leggi tutto l\'editoriale</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';
              slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
      };

      // Visualizzazione iniziale dell'ultima giornata
      renderArticle(currentDay);

    } catch (e) {
      console.warn('[homeView] Errore caricamento editoriale AI:', e);
      slot.style.display = 'none';
    }
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

    // Il commento non viene mai interpretato come HTML: restano attivi solo gli a-capo e le emoticon
    // inserite dal guestbook (immagini della sua cartella emoticon), tutto il resto è mostrato come testo
    const emoticonPath = `${guestbookTemplatePath}images/emoticons/`;
    const escapeTags = text => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const readAttribute = (tag, name) => {
      const found = new RegExp(`\\s${name}="([^"<>]*)"`, 'i').exec(tag);
      return found ? found[1] : '';
    };
    const cleanComment = rawHtml => String(rawHtml || '')
      .replaceAll('##GBOOK_TEMPLATE##', guestbookTemplatePath)
      .split(/(<br\s*\/?>|<img\s[^<>]*>)/i)
      .map(part => {
        if (/^<br\s*\/?>$/i.test(part)) return '<br>';
        if (/^<img\s[^<>]*>$/i.test(part)) {
          const src = readAttribute(part, 'src');
          if (src.startsWith(emoticonPath) && /^[a-z0-9_-]+\.(gif|png|jpe?g|webp)$/i.test(src.slice(emoticonPath.length))) {
            return `<img src="${src}" alt="${readAttribute(part, 'alt')}" title="${readAttribute(part, 'title')}">`;
          }
        }
        return escapeTags(part);
      })
      .join('');

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

  /**
   * Initializes slider / carousel between Top 11 and Flop 11 pitches
   */
  initTopFlop11Slider(container) {
    const track = container.querySelector('#topFlopTrack');
    if (!track) return;

    const prevBtn = container.querySelector('#topFlopPrev');
    const nextBtn = container.querySelector('#topFlopNext');
    const sidePrevBtn = container.querySelector('#topFlopSidePrev');
    const sideNextBtn = container.querySelector('#topFlopSideNext');
    const pillTop = container.querySelector('#pillTop11');
    const pillFlop = container.querySelector('#pillFlop11');
    const dots = container.querySelectorAll('.topflop-dot');

    let currentIndex = 0;

    const updateControls = (idx) => {
      currentIndex = idx;
      if (pillTop) pillTop.classList.toggle('active', idx === 0);
      if (pillFlop) pillFlop.classList.toggle('active', idx === 1);
      if (prevBtn) prevBtn.disabled = (idx === 0);
      if (nextBtn) nextBtn.disabled = (idx === 1);
      if (sidePrevBtn) sidePrevBtn.disabled = (idx === 0);
      if (sideNextBtn) sideNextBtn.disabled = (idx === 1);
      dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
    };

    const scrollToSlide = (idx) => {
      const slideWidth = track.clientWidth || 1;
      track.scrollTo({ left: idx * slideWidth, behavior: 'smooth' });
      updateControls(idx);
    };

    if (prevBtn) prevBtn.addEventListener('click', () => scrollToSlide(0));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollToSlide(1));
    if (sidePrevBtn) sidePrevBtn.addEventListener('click', () => scrollToSlide(0));
    if (sideNextBtn) sideNextBtn.addEventListener('click', () => scrollToSlide(1));
    if (pillTop) pillTop.addEventListener('click', () => scrollToSlide(0));
    if (pillFlop) pillFlop.addEventListener('click', () => scrollToSlide(1));

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.index, 10) || 0;
        scrollToSlide(idx);
      });
    });

    let scrollDebounce;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        const slideWidth = track.clientWidth || 1;
        const newIndex = Math.round(track.scrollLeft / slideWidth);
        if (newIndex !== currentIndex && (newIndex === 0 || newIndex === 1)) {
          updateControls(newIndex);
        }
      }, 40);
    }, { passive: true });

    // Handle window resize so slide position remains snapped
    if (this._carouselResizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._carouselResizeHandler);
    }
    this._carouselResizeHandler = () => {
      const slideWidth = track.clientWidth || 1;
      track.scrollLeft = currentIndex * slideWidth;
    };
    window.addEventListener('resize', this._carouselResizeHandler, { passive: true });

    // Selettore modulo tattico Top/Flop 11 nella Home
    const modSelects = container.querySelectorAll('.home-topflop-mod-select');
    modSelects.forEach(sel => {
      sel.addEventListener('change', (e) => {
        const isFlop = sel.getAttribute('data-type') === 'flop';
        const modVal = e.target.value || 'auto';
        const tfData = this._topFlopData || {};
        const byMod = isFlop ? (tfData.flopByModule || {}) : (tfData.topByModule || {});
        const defaultPlayers = isFlop ? (tfData.flop11 || []) : (tfData.top11 || []);
        const defaultSum = isFlop ? (tfData.flopSum || 0) : (tfData.topSum || 0);

        let players = defaultPlayers;
        let sum = defaultSum;
        if (modVal !== 'auto' && byMod[modVal]) {
          players = byMod[modVal].players || [];
          sum = byMod[modVal].sum || 0;
        }

        const pitchEl = container.querySelector(isFlop ? '#homeFlopPitchContainer' : '#homeTopPitchContainer');
        const scoreEl = container.querySelector(isFlop ? '#homeFlopTotalScore' : '#homeTopTotalScore');
        if (pitchEl && typeof this._renderHomeTopFlopPitchInner === 'function') {
          pitchEl.innerHTML = this._renderHomeTopFlopPitchInner(players, isFlop);
        }
        if (scoreEl && typeof sum === 'number') {
          scoreEl.textContent = `${sum.toFixed(2)} pt`;
        }
      });
    });
  },

  /**
   * Initializes mobile horizontal slider for FantaMister cards
   */
  initFantamisterSlider(container) {
    const track = container.querySelector('#fantamisterTrack');
    if (!track) return;

    const pills = container.querySelectorAll('.fantamister-pill');
    const dots = container.querySelectorAll('.fantamister-dot');
    let currentIndex = 0;

    const updateControls = (idx) => {
      currentIndex = idx;
      pills.forEach((p, i) => p.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    };

    const scrollToCard = (idx) => {
      const card = track.querySelector(`.fantamister-coach-box[data-card-index="${idx}"]`);
      if (card) {
        track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
        updateControls(idx);
      }
    };

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(pill.dataset.index, 10) || 0;
        scrollToCard(idx);
      });
    });

    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(dot.dataset.index, 10) || 0;
        scrollToCard(idx);
      });
    });

    let scrollDebounce;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        const cards = track.querySelectorAll('.fantamister-coach-box');
        if (!cards.length) return;
        const scrollLeft = track.scrollLeft;
        let closestIdx = 0;
        let minDiff = Infinity;
        cards.forEach((c) => {
          const idx = parseInt(c.dataset.cardIndex, 10) || 0;
          const diff = Math.abs(c.offsetLeft - scrollLeft);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });
        if (closestIdx !== currentIndex) {
          updateControls(closestIdx);
        }
      }, 50);
    }, { passive: true });
  },

  bindEditModeEvents(container) {
    if (!this.isEditMode || !this.tempConfig) return;

    // 1. Sposta Su (▲)
    container.querySelectorAll('.widget-move-btn.btn-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const colKey = btn.dataset.col;
        const id = btn.dataset.id;
        const list = this.tempConfig.columns[colKey];
        const idx = list.findIndex(w => w.id === id);
        if (idx > 0) {
          const [moved] = list.splice(idx, 1);
          list.splice(idx - 1, 0, moved);
          this.render(this.container);
        }
      });
    });

    // 2. Sposta Giù (▼)
    container.querySelectorAll('.widget-move-btn.btn-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const colKey = btn.dataset.col;
        const id = btn.dataset.id;
        const list = this.tempConfig.columns[colKey];
        const idx = list.findIndex(w => w.id === id);
        if (idx >= 0 && idx < list.length - 1) {
          const [moved] = list.splice(idx, 1);
          list.splice(idx + 1, 0, moved);
          this.render(this.container);
        }
      });
    });

    // 3. Toggle Visibilità (👁️)
    container.querySelectorAll('.widget-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const colKey = btn.dataset.col;
        const id = btn.dataset.id;
        const list = this.tempConfig.columns[colKey];
        const item = list.find(w => w.id === id);
        if (item) {
          item.enabled = !item.enabled;
          this.render(this.container);
        }
      });
    });

    // 4. Drag & Drop HTML5 nativo (tra due widget, in cima, in calce e tra colonne)
    const clearAllDropIndicators = () => {
      container.querySelectorAll('.widget-drop-slot.is-drag-over, .widget-dropzone-edge.is-drag-over, .widget-block-editable.drop-indicator-top, .widget-block-editable.drop-indicator-bottom, .is-drop-target').forEach(el => {
        el.classList.remove('is-drag-over', 'drop-indicator-top', 'drop-indicator-bottom', 'is-drop-target');
      });
    };

    const getClosestSlot = (colKey, clientY) => {
      const slots = container.querySelectorAll(`.widget-drop-slot[data-col="${colKey}"]`);
      let closest = null;
      let minDiff = Infinity;
      slots.forEach(slot => {
        const rect = slot.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const diff = Math.abs(clientY - midY);
        if (diff < minDiff) {
          minDiff = diff;
          closest = slot;
        }
      });
      return closest;
    };

    const executeWidgetMove = (sourceCol, sourceId, targetCol, targetIndex) => {
      if (!sourceCol || !targetCol || !sourceId || targetIndex === undefined || targetIndex === null) return;
      const sourceList = this.tempConfig.columns[sourceCol];
      const targetList = this.tempConfig.columns[targetCol];
      if (!sourceList || !targetList) return;

      const sourceIdx = sourceList.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return;

      const [movedItem] = sourceList.splice(sourceIdx, 1);

      let insertIdx;
      if (sourceCol === targetCol) {
        insertIdx = (sourceIdx < targetIndex) ? (targetIndex - 1) : targetIndex;
      } else {
        insertIdx = targetIndex;
      }
      insertIdx = Math.max(0, Math.min(insertIdx, targetList.length));

      targetList.splice(insertIdx, 0, movedItem);
      this.render(this.container);
    };

    // 4a. Listener sui blocchi widget trascinabili
    const dragBlocks = container.querySelectorAll('.widget-block-editable[draggable="true"]');
    dragBlocks.forEach(block => {
      block.addEventListener('dragstart', (e) => {
        const colKey = block.dataset.col;
        const id = block.dataset.id;
        this._draggedItem = { col: colKey, id: id };
        e.dataTransfer.setData('text/plain', JSON.stringify({ col: colKey, id: id }));
        e.dataTransfer.effectAllowed = 'move';
        block.classList.add('is-dragging');
        document.body.classList.add('home-is-dragging-widget');
      });

      block.addEventListener('dragend', () => {
        this._draggedItem = null;
        block.classList.remove('is-dragging');
        document.body.classList.remove('home-is-dragging-widget');
        clearAllDropIndicators();
      });

      block.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        const colKey = block.dataset.col;
        const rect = block.getBoundingClientRect();
        const isTop = (e.clientY - rect.top) < (rect.height / 2);
        const list = this.tempConfig.columns[colKey] || [];
        const itemIdx = list.findIndex(w => w.id === block.dataset.id);
        if (itemIdx === -1) return;

        const targetIndex = isTop ? itemIdx : (itemIdx + 1);
        const targetSlot = container.querySelector(`.widget-drop-slot[data-col="${colKey}"][data-index="${targetIndex}"]`);

        if (targetSlot && !targetSlot.classList.contains('is-drag-over')) {
          clearAllDropIndicators();
          targetSlot.classList.add('is-drag-over');
        }
      });

      block.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearAllDropIndicators();
        document.body.classList.remove('home-is-dragging-widget');

        const dragged = this._draggedItem || (() => {
          try {
            const raw = e.dataTransfer.getData('text/plain');
            return raw ? JSON.parse(raw) : null;
          } catch (_) { return null; }
        })();

        if (!dragged) return;
        const colKey = block.dataset.col;
        const rect = block.getBoundingClientRect();
        const isTop = (e.clientY - rect.top) < (rect.height / 2);
        const list = this.tempConfig.columns[colKey] || [];
        const itemIdx = list.findIndex(w => w.id === block.dataset.id);
        if (itemIdx === -1) return;

        const targetIndex = isTop ? itemIdx : (itemIdx + 1);
        executeWidgetMove(dragged.col, dragged.id, colKey, targetIndex);
      });
    });

    // 4b. Listener sugli slot di drop (tra due widget, in cima e in calce)
    const dropSlots = container.querySelectorAll('.widget-drop-slot');
    dropSlots.forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!slot.classList.contains('is-drag-over')) {
          clearAllDropIndicators();
          slot.classList.add('is-drag-over');
        }
      });

      slot.addEventListener('dragleave', (e) => {
        if (!slot.contains(e.relatedTarget)) {
          slot.classList.remove('is-drag-over');
        }
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearAllDropIndicators();
        document.body.classList.remove('home-is-dragging-widget');

        const dragged = this._draggedItem || (() => {
          try {
            const raw = e.dataTransfer.getData('text/plain');
            return raw ? JSON.parse(raw) : null;
          } catch (_) { return null; }
        })();

        if (!dragged) return;
        const targetCol = slot.dataset.col;
        const targetIndex = parseInt(slot.dataset.index, 10);
        executeWidgetMove(dragged.col, dragged.id, targetCol, targetIndex);
      });
    });

    // 4c. Listener sulle colonne per evitare il cursore non consentito 🚫 negli spazi vuoti
    ['main', 'side'].forEach(colKey => {
      const colEl = container.querySelector(colKey === 'main' ? '.dashboard-main-col' : '.dashboard-side-col');
      if (!colEl) return;

      colEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const closest = getClosestSlot(colKey, e.clientY);
        if (closest && !closest.classList.contains('is-drag-over')) {
          clearAllDropIndicators();
          closest.classList.add('is-drag-over');
        }
      });

      colEl.addEventListener('dragleave', (e) => {
        if (!colEl.contains(e.relatedTarget)) {
          clearAllDropIndicators();
        }
      });

      colEl.addEventListener('drop', (e) => {
        e.preventDefault();
        clearAllDropIndicators();
        document.body.classList.remove('home-is-dragging-widget');

        const dragged = this._draggedItem || (() => {
          try {
            const raw = e.dataTransfer.getData('text/plain');
            return raw ? JSON.parse(raw) : null;
          } catch (_) { return null; }
        })();

        if (!dragged) return;
        const closest = getClosestSlot(colKey, e.clientY);
        if (closest) {
          const targetIndex = parseInt(closest.dataset.index, 10);
          executeWidgetMove(dragged.col, dragged.id, colKey, targetIndex);
        }
      });
    });

    // 5. Preferenze contestuali (Top/Flop e Quote)
    container.querySelectorAll('.inline-pref-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const pref = pill.dataset.pref;
        const val = pill.dataset.val;
        if (pref && this.tempConfig.defaultSettings) {
          this.tempConfig.defaultSettings[pref] = val;
          const parent = pill.closest('.inline-pref-pills');
          if (parent) {
            parent.querySelectorAll('.inline-pref-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
          }
        }
      });
    });

    // 6. Squadra del Cuore: Select Dropdown in Topbar
    const selectFav = container.querySelector('#editSelectFavTeam');
    if (selectFav) {
      selectFav.addEventListener('change', (e) => {
        const val = e.target.value ? parseInt(e.target.value, 10) : null;
        this.tempConfig.defaultSettings.favoriteTeamId = val;
        this.render(this.container);
      });
    }

    // 7. Squadra del Cuore: Tap-to-Star (☆ / ⭐)
    container.querySelectorAll('.btn-tap-to-star').forEach(starBtn => {
      starBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const teamId = starBtn.dataset.teamId ? parseInt(starBtn.dataset.teamId, 10) : (starBtn.dataset.teamName || null);
        const currentFav = this.tempConfig.defaultSettings.favoriteTeamId;

        if (currentFav && (currentFav == teamId || currentFav == starBtn.dataset.teamName)) {
          this.tempConfig.defaultSettings.favoriteTeamId = null;
        } else {
          this.tempConfig.defaultSettings.favoriteTeamId = teamId;
        }
        this.render(this.container);
      });
    });

    // 8. Floating Action Dock Buttons
    // Reset
    const btnReset = container.querySelector('#btnDockReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Vuoi ripristinare la disposizione di default della Lega e azzerare le personalizzazioni?')) {
          if (typeof fcmHomeConfigManager !== 'undefined') {
            fcmHomeConfigManager.resetToDefault();
          }
          this.tempConfig = null;
          this.toggleEditMode(false);
          this.showToast('Layout ripristinato ai valori predefiniti di Lega!');
        }
      });
    }

    // Cancel
    const btnCancel = container.querySelector('#btnDockCancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.tempConfig = null;
        this.toggleEditMode(false);
      });
    }

    // Save
    const btnSave = container.querySelector('#btnDockSave');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        // Auto-memorizzazione stato accordion
        const coppaContent = container.querySelector('#contentCoppaStandings');
        if (coppaContent) {
          this.tempConfig.defaultSettings.coppaAccordionOpen = (coppaContent.style.display !== 'none');
        }
        const gpContent = container.querySelector('#contentGpStandings');
        if (gpContent) {
          this.tempConfig.defaultSettings.gpAccordionOpen = (gpContent.style.display !== 'none');
        }

        const columnsOrder = {
          main: this.tempConfig.columns.main.map(w => w.id),
          side: this.tempConfig.columns.side.map(w => w.id)
        };
        const disabledWidgets = [
          ...this.tempConfig.columns.main.filter(w => !w.enabled).map(w => w.id),
          ...this.tempConfig.columns.side.filter(w => !w.enabled).map(w => w.id)
        ];
        const userSettings = this.tempConfig.defaultSettings;
        const favTeamId = this.tempConfig.defaultSettings.favoriteTeamId;

        if (typeof fcmHomeConfigManager !== 'undefined') {
          fcmHomeConfigManager.saveUserPreferences(columnsOrder, disabledWidgets, userSettings, favTeamId);
        }

        this.tempConfig = null;
        this.toggleEditMode(false);
        this.showToast('Homepage personalizzata con successo! ⭐');
      });
    }
  },

  showToast(msg) {
    let t = document.getElementById('homeToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'homeToast';
      t.className = 'calcolo-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => { t.classList.remove('visible'); }, 3000);
  },

  toggleEditMode(enabled) {
    this.isEditMode = (enabled !== undefined) ? !!enabled : !this.isEditMode;
    if (this.isEditMode) {
      if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.activeConfig) {
        this.tempConfig = JSON.parse(JSON.stringify(fcmHomeConfigManager.activeConfig));
      }
      const header = document.querySelector('.app-header');
      if (header) header.classList.remove('header-hidden');
    } else {
      this.tempConfig = null;
      this._draggedItem = null;
      document.body.classList.remove('home-is-dragging-widget');
    }
    const container = document.getElementById('mainContent') || document.querySelector('.main-content') || this.container;
    if (container) {
      this.render(container);
    }
  },

  /**
   * Auto-hide header on scroll down, show on scroll up (specific to #home)
   */
  initHeaderAutoHide() {
    this.cleanupHeaderAutoHide();
    const header = document.querySelector('.app-header');
    if (!header) return;

    let lastScrollY = Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
    let ticking = false;
    const threshold = 5; // Massima reattività allo scorrimento verticale

    this._headerScrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Se in modalità personalizzazione home o con drawer aperto, mantieni l'header sempre visibile
          if (this.isEditMode || document.body.classList.contains('drawer-open')) {
            header.classList.remove('header-hidden');
            lastScrollY = Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
            ticking = false;
            return;
          }

          const currentScrollY = Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);

          // In cima alla pagina (<= 60px) l'header deve sempre comparire
          if (currentScrollY <= 60) {
            header.classList.remove('header-hidden');
            lastScrollY = currentScrollY;
            ticking = false;
            return;
          }

          const delta = currentScrollY - lastScrollY;

          // Se il delta supera la soglia, applica la transizione
          if (Math.abs(delta) >= threshold) {
            if (delta > 0) {
              // Scorrimento verso il basso -> scompare
              header.classList.add('header-hidden');
            } else {
              // Scorrimento verso l'alto -> ricompare immediatamente
              header.classList.remove('header-hidden');
            }
            lastScrollY = currentScrollY;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', this._headerScrollHandler, { passive: true });
  },

  cleanupHeaderAutoHide() {
    if (this._headerScrollHandler && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._headerScrollHandler);
      this._headerScrollHandler = null;
    }
    if (typeof document !== 'undefined') {
      const header = document.querySelector('.app-header');
      if (header) {
        header.classList.remove('header-hidden');
      }
    }
  },

  /**
   * Helper stato partita Serie A (1 = terminata, 0 = in corso, '' = non ancora iniziata)
   */
  _getTeamMatchState(squadra, partiteMap) {
    if (!squadra || !partiteMap) return '';
    const cleanSq = (squadra === 'Verona' ? 'Hellas Verona' : squadra).trim().toLowerCase();
    if (partiteMap[squadra] !== undefined) return String(partiteMap[squadra]);
    if (partiteMap[squadra.toUpperCase()] !== undefined) return String(partiteMap[squadra.toUpperCase()]);
    for (const [k, v] of Object.entries(partiteMap)) {
      const cleanK = (k === 'Verona' ? 'Hellas Verona' : k).trim().toLowerCase();
      if (cleanK === cleanSq) return String(v !== undefined && v !== null ? v : '');
    }
    return '';
  },

  /**
   * Helper verifica se una squadra di Serie A ha già voti inseriti a referto in vuVoti
   */
  _hasTeamVotes(squadra, vuVoti) {
    if (!squadra || !vuVoti || !vuVoti.length) return false;
    const cleanSq = (squadra === 'Verona' ? 'Hellas Verona' : squadra).trim().toLowerCase();
    for (let i = 0; i < vuVoti.length; i++) {
      const v = vuVoti[i];
      if (!v) continue;
      const rawSq = v.Squadra || v.squadra || (Array.isArray(v) ? v[14] : '');
      const vSq = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();
      if (vSq === cleanSq) {
        const rawV = v.Voto !== undefined ? v.Voto : (v.voto !== undefined ? v.voto : (Array.isArray(v) ? v[1] : ''));
        if (rawV !== null && rawV !== undefined && rawV !== '' && rawV !== 'SV' && rawV !== 'S.V.') {
          const numV = Number(typeof rawV === 'string' ? rawV.replace(',', '.') : rawV);
          if (!isNaN(numV) && numV > 0) {
            return true;
          }
        }
      }
    }
    return false;
  },

  /**
   * Helper pulizia cognome per matching voti
   */
  _formatCognome(nome) {
    if (!nome) return '';
    const lower = nome.toLowerCase();
    if (lower.includes("riserva d'ufficio") || lower.includes("no sostituzione")) return nome;
    const parts = nome.split(' ');
    const caps = parts.filter(p => p && p === p.toUpperCase());
    return caps.length > 0 ? caps.join(' ') : nome;
  },

  /**
   * Helper ricerca voto calciatore in array voti:
   * 1. Pescaggio diretto primario da arrVoti (corrispondenza esatta nome FCM)
   * 2. Pescaggio diretto case-insensitive
   * 3. Fallback con metodi euristici avanzati
   */
  _findPlayerVote(votiArr, nomeFCM, squadraFCM, isLive, source = 'pianetafanta') {
    if (!votiArr || votiArr.length === 0 || !nomeFCM) return null;
    const cleanFCM = (squadraFCM === 'Verona' ? 'Hellas Verona' : (squadraFCM || '')).trim().toLowerCase();

    // 1. PESCAGGIO DIRETTO PRIMARIO: Corrispondenza esatta nome FCM in arrVoti
    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      const vNome = v.Nome || (Array.isArray(v) ? v[0] : '') || '';
      if (vNome === nomeFCM) {
        const rawSq = v.Squadra || v.squadra || (Array.isArray(v) ? v[14] : '');
        const vSquadra = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();
        if (!cleanFCM || !vSquadra || cleanFCM === vSquadra) {
          return v;
        }
      }
    }

    // 2. PESCAGGIO DIRETTO CASE-INSENSITIVE
    const fcmUpper = nomeFCM.toUpperCase().trim();
    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      const vNome = v.Nome || (Array.isArray(v) ? v[0] : '') || '';
      if (vNome && vNome.toUpperCase().trim() === fcmUpper) {
        const rawSq = v.Squadra || v.squadra || (Array.isArray(v) ? v[14] : '');
        const vSquadra = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();
        if (!cleanFCM || !vSquadra || cleanFCM === vSquadra) {
          return v;
        }
      }
    }

    // 3. FALLBACK: Metodi euristici di matching
    const cognomeFCM = this._formatCognome(nomeFCM).toUpperCase().trim();
    const fcmClean = fcmUpper.replace(/['’]/g, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    const fcmTokens = fcmClean.split(' ');

    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      const vNome = v.Nome || (Array.isArray(v) ? v[0] : '') || '';
      if (!vNome) continue;
      const rawSq = v.Squadra || v.squadra || (Array.isArray(v) ? v[14] : '');
      const vSquadra = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();

      // Controllo squadra: se la squadra non coincide (ed entrambe sono valorizzate), salta
      if (cleanFCM && vSquadra && cleanFCM !== vSquadra) continue;

      // 3.1. Associazione esplicita personalizzata (case-insensitive)
      if (typeof arrAssociazioni !== 'undefined' && arrAssociazioni) {
        const mapped = arrAssociazioni[vNome] || arrAssociazioni[vNome.trim()];
        if (mapped && (mapped.toUpperCase().trim() === fcmUpper || mapped.toUpperCase().trim() === fcmClean)) {
          return v;
        }
      }

      const vUpper = vNome.toUpperCase().trim();
      const vClean = vUpper.replace(/['’]/g, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
      if (vClean === fcmClean) return v;

      const vTokens = vClean.split(' ');

      // 3. Caso Cognome + Iniziale puntata o non puntata (es. 'STANKOVIC F.', 'MORENO M.', 'STANKOVIC F', 'ESPOSITO SE.')
      if (vTokens.length > 1 && vTokens[vTokens.length - 1].length <= 2) {
        const vInit = vTokens[vTokens.length - 1];
        const vSurname = vTokens.slice(0, -1).join(' ');

        if (fcmClean.startsWith(vSurname)) {
          const restFCM = fcmClean.slice(vSurname.length).trim();
          if (!vInit || restFCM.startsWith(vInit)) {
            return v;
          }
        }

        const surnameTokens = vTokens.slice(0, -1);
        const hasAllSurnameTokens = surnameTokens.every(st => fcmTokens.includes(st));
        if (hasAllSurnameTokens) {
          const remainingFCMTokens = fcmTokens.filter(t => !surnameTokens.includes(t));
          if (remainingFCMTokens.some(rt => rt.startsWith(vInit))) {
            return v;
          }
        }
      }

      // 4. Se v ha solo cognome (es. 'BASIC', 'SOHM', 'HALHAL', 'YEBOAH')
      if (vTokens.length === 1) {
        const singleToken = vTokens[0];
        if (singleToken.length >= 3) {
          if (fcmTokens[0] === singleToken || cognomeFCM === singleToken) {
            return v;
          }
        }
      }

      // 5. Matching sorgente specifico
      if (source === 'pianetafanta') {
        if (cognomeFCM && cognomeFCM.length >= 3) {
          const cognomeTokens = cognomeFCM.split(' ');
          const allMatch = cognomeTokens.every(ct => vTokens.includes(ct));
          if (allMatch) {
            const restFCM = fcmTokens.filter(t => !cognomeTokens.includes(t));
            const restV = vTokens.filter(t => !cognomeTokens.includes(t));
            if (restFCM.length === 0 || restV.length === 0 || (restFCM[0] && restV[0] && (restFCM[0].startsWith(restV[0]) || restV[0].startsWith(restFCM[0])))) {
              return v;
            }
          }
        }
      } else {
        // FP o FM
        if (cognomeFCM && (vClean === cognomeFCM || (cognomeFCM.startsWith(vClean) && vClean.length >= 4))) {
          return v;
        }
        if (vClean.length >= 4 && fcmClean.startsWith(vClean + ' ')) {
          return v;
        }
        // Cognome composto inverso (es. 'CHE ADAMS' vs 'ADAMS Che\' Zach')
        if (vTokens.length > 1 && vTokens.every(vt => fcmTokens.includes(vt))) {
          return v;
        }
        // Tolleranza per substring tokens quando la squadra coincide
        if (fcmClean.includes(vClean) || vClean.includes(fcmClean)) {
          return v;
        }
      }
    }
    return null;
  },

  /**
   * Genera le icone badge per i bonus/malus del calciatore (PNG stile #liveVU)
   */
  _generateBonusBadgesHtml(v, roleLetter, isSeparatePen = false) {
    if (!v) return '';
    let badges = '';
    const addImg = (src, title) => {
      badges += `<img src="img/live/${src}" title="${title}" alt="${title}">`;
    };

    const isPortiere = (roleLetter === 'P' || roleLetter === 1);
    // I conteggi arrivano dai feed esterni: il tetto evita cicli enormi o infiniti nella generazione delle icone
    const capCount = (n) => Math.min(20, Number(n || 0));
    const gF = capCount(v.GolFatto);
    const gS = capCount(v.GolSubito);
    const rig = capCount(v.Rigore);
    const rPar = capCount(v.RigoreParato);
    const rSba = capCount(v.RigoreSbagliato);
    const autoG = capCount(v.AutoGol);
    const ass = capCount(v.Assist);

    // Gol Fatti & Rigori
    const netGol = isSeparatePen ? Math.max(0, gF) : Math.max(0, gF - rig);
    for (let i = 0; i < netGol; i++) addImg('golfatto_s.png', 'Gol Fatto');
    const netRig = Math.max(0, rig);
    for (let i = 0; i < netRig; i++) addImg('rigoresegnato_s.png', 'Rigore Segnato');

    // Gol Subiti (Portiere) o Portiere Imbattuto
    if (isPortiere) {
      const hasPlayed = (v.Titolare === '1') || (v.Titolare === '0' && v.Sostituzione === '1') || (v.Voto !== 'SV' && v.Voto !== 'S.V.' && v.Voto !== '' && v.Voto !== null && !isNaN(Number(v.Voto)));
      if (gS > 0) {
        for (let i = 0; i < gS; i++) addImg('golsubito_s.png', 'Gol Subito');
      } else if (hasPlayed) {
        addImg('portiereimbattuto_s.png', 'Portiere Imbattuto');
      }
    } else {
      for (let i = 0; i < gS; i++) addImg('golsubito_s.png', 'Gol Subito');
    }

    // Autogol
    for (let i = 0; i < autoG; i++) addImg('autogol_s.png', 'Autogol');

    // Ammonizione & Espulsione
    if (v.Ammonizione === '1' || Number(v.Ammonizione) > 0) addImg('amm_s.png', 'Ammonizione');
    if (v.Espulsione === '1' || Number(v.Espulsione) > 0) addImg('esp_s.png', 'Espulsione');

    // Rigori Parati e Sbagliati
    for (let i = 0; i < rPar; i++) addImg('rigoreparato_s.png', 'Rigore Parato');
    for (let i = 0; i < rSba; i++) addImg('rigoresbagliato_s.png', 'Rigore Sbagliato');

    // Assist
    for (let i = 0; i < ass; i++) addImg('assist_s.png', 'Assist');

    // Gol Vittoria & Pareggio
    if (v.GolVittoria === '1' || Number(v.GolVittoria) > 0) addImg('golvittoria_s.png', 'Gol Vittoria');
    if (v.GolPareggio === '1' || Number(v.GolPareggio) > 0) addImg('golpareggio_s.png', 'Gol Pareggio');

    return badges;
  },

  _generateBonusIcons(vObj, roleLetter) {
    return this._generateBonusBadgesHtml(vObj, roleLetter);
  },

  /**
   * Simula il calcolo completo di un incontro live basandosi sul Motore Ibrido:
   * 1. Priorità assoluta ai Voti Ufficiosi di PianetaFanta (fcmVotiDatiVU.js)
   * 2. Integrazione dei voti live in corso da Fantacalcio, Fantapazz o FantaMaster (secSource)
   * 3. Voto 6.0 virtuale d'ufficio per gare non ancora iniziate
   */
  _simulateLiveMatch(m, homePlayers, awayPlayers, vuParam, secParam, secSourceParam) {
    let vuData = { voti: [], partite: {} };
    let secSource = (typeof secSourceParam === 'string' && secSourceParam) ? secSourceParam : (this._activeSecondaryLive || 'fantacalcio');
    let secData = (secParam && secParam.voti && secParam.voti.length > 0) ? secParam : this._getSecondaryData(secSource);

    if (Array.isArray(vuParam)) {
      vuData = { voti: vuParam, partite: (typeof secParam === 'object' && !Array.isArray(secParam) && !secParam.voti) ? secParam : {} };
      if (secSourceParam && typeof secSourceParam === 'object' && secSourceParam.voti) {
        secData = secSourceParam;
      } else if (Array.isArray(secSourceParam)) {
        secData = { voti: secSourceParam, partite: {} };
      }
    } else if (vuParam && vuParam.voti) {
      vuData = vuParam;
      if (secParam && secParam.voti && secParam.voti.length > 0) {
        secData = secParam;
      }
    } else if (this._liveDataStore) {
      vuData = this._liveDataStore.vu || { voti: [], partite: {} };
    }

    const getRoleNum = (r) => {
      if (typeof FCMCalcoloMotore !== 'undefined') return FCMCalcoloMotore.getRoleNum(r);
      if (r === 'P' || r === 1) return 1;
      if (r === 'D' || r === 2) return 2;
      if (r === 'C' || r === 3) return 3;
      if (r === 'A' || r === 4) return 4;
      return Number(r) || 0;
    };

    const vuVoti = vuData.voti || [];
    const vuPartite = vuData.partite || {};
    const secVoti = (secData && secData.voti) ? secData.voti : [];
    const secPartite = (secData && secData.partite) ? secData.partite : {};

    const getPlayerCalcData = (p) => {
      const pRoleNum = getRoleNum(p.role);
      const sqA = p.serieATeam || p.SquadraDiA || '';
      const teamStateVU = this._getTeamMatchState(sqA, vuPartite);
      const teamStateSec = this._getTeamMatchState(sqA, secPartite);

      let calcData = {
        ...p,
        nome: p.name || p.Nome || p.nome || '',
        Nome: p.name || p.Nome || p.nome || '',
        role: pRoleNum,
        ruolo: pRoleNum,
        Ruolo: pRoleNum,
        voto: 'SV',
        votoNum: 0,
        rawVote: 0,
        fantavoto: 0,
        votoFinale: 0,
        hasVote: false,
        isVirtual6: false,
        isSvWithBonus: false,
        isSV: false,
        sourceUsed: 'none',
        vObj: null,
        hasPlayed: false,
        inCourse: false
      };

      let resolved = false;

      const hasTeamVotesVU = this._hasTeamVotes(sqA, vuVoti);
      const hasTeamVotesSec = this._hasTeamVotes(sqA, secVoti);

      // 1. PRIORITÀ 1 (ASSOLUTA): PIANETAFANTA (VU)
      // Se la squadra ha voti su PianetaFanta (hasTeamVotesVU === true), la partita è refertata da PianetaFanta:
      // - chi ha voto numerico prende il voto VU
      // - chi ha SV con bonus determinante prende base 6.0 in arancione + bonus
      // - chi ha voto nullo o SV senza bonus è S.V. definitivo (non ha giocato). NON si cerca su FP/FM!
      if (hasTeamVotesVU) {
        const vObjVU = this._findPlayerVote(vuVoti, p.name, sqA, false, 'pianetafanta');
        if (vObjVU) {
          const rawVoto = vObjVU.Voto;
          const isExplicitSV = (rawVoto === 'SV' || rawVoto === 'S.V.');
          const isVuoto = (rawVoto === '' || rawVoto === null || rawVoto === undefined);
          const numVoto = (!isExplicitSV && !isVuoto && !isNaN(Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)))
            ? Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)
            : null;

          const golF = Number(vObjVU.GolFatto) || 0;
          const golS = Number(vObjVU.GolSubito) || 0;
          const rPar = Number(vObjVU.RigoreParato) || 0;
          const rSba = Number(vObjVU.RigoreSbagliato) || 0;
          const esp = Number(vObjVU.Espulsione) || 0;
          const autoG = Number(vObjVU.AutoGol) || 0;
          const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (pRoleNum === 1 && golS > 0));

          if (numVoto !== null && numVoto > 0) {
            // Voto numerico valido consolidato dai quotidiani
            const fv = (typeof FCMCalcoloMotore !== 'undefined') ? FCMCalcoloMotore.calcolaFantavoto(vObjVU, pRoleNum) : numVoto;
            calcData.voto = numVoto;
            calcData.votoNum = numVoto;
            calcData.rawVote = numVoto;
            calcData.fantavoto = fv;
            calcData.votoFinale = fv;
            calcData.hasVote = true;
            calcData.sourceUsed = 'pianetafanta';
            calcData.vObj = vObjVU;
            calcData.hasPlayed = true;
            calcData.golSubiti = (pRoleNum === 1) ? golS : 0;
            calcData.rigoriParati = (pRoleNum === 1) ? rPar : 0;
            calcData.rigP = calcData.rigoriParati;
            calcData.golS = calcData.golSubiti;
            const rawRig = Number(vObjVU.Rigore || 0);
            const rigoriSegnati = Math.max(0, rawRig - rSba);
            const netGoals = (pRoleNum === 1) ? 0 : Math.max(0, golF - rigoriSegnati);
            calcData.golFatti = netGoals;
            calcData.golF = netGoals;
            calcData.rigoriSegnati = (pRoleNum === 1) ? 0 : rigoriSegnati;
            calcData.rigF = calcData.rigoriSegnati;
            calcData.rigoriSbagliati = rSba;
            calcData.autogol = autoG;
            calcData.assist = Number(vObjVU.Assist || 0);
            calcData.ammonizione = (vObjVU.Ammonizione === '1' || Number(vObjVU.Ammonizione) > 0) ? 1 : 0;
            calcData.espulsione = esp > 0 ? 1 : 0;
            resolved = true;
          } else if (hasDecisiveBonus) {
            // SV con bonus/malus determinante su PianetaFanta: base 6.0 in arancione (--accent-gold)
            const fakeObj = { ...vObjVU, Voto: '6' };
            const fv = (typeof FCMCalcoloMotore !== 'undefined') ? FCMCalcoloMotore.calcolaFantavoto(fakeObj, pRoleNum) : 6;
            calcData.voto = 6;
            calcData.votoNum = 6;
            calcData.rawVote = 6;
            calcData.fantavoto = fv;
            calcData.votoFinale = fv;
            calcData.hasVote = true;
            calcData.isSvWithBonus = true;
            calcData.sourceUsed = 'pianetafanta';
            calcData.vObj = vObjVU;
            calcData.hasPlayed = true;
            calcData.golSubiti = (pRoleNum === 1) ? golS : 0;
            calcData.rigoriParati = (pRoleNum === 1) ? rPar : 0;
            calcData.rigP = calcData.rigoriParati;
            calcData.golS = calcData.golSubiti;
            const rawRig = Number(vObjVU.Rigore || 0);
            const rigoriSegnati = Math.max(0, rawRig - rSba);
            const netGoals = (pRoleNum === 1) ? 0 : Math.max(0, golF - rigoriSegnati);
            calcData.golFatti = netGoals;
            calcData.golF = netGoals;
            calcData.rigoriSegnati = (pRoleNum === 1) ? 0 : rigoriSegnati;
            calcData.rigF = calcData.rigoriSegnati;
            calcData.rigoriSbagliati = rSba;
            calcData.autogol = autoG;
            calcData.assist = Number(vObjVU.Assist || 0);
            calcData.ammonizione = (vObjVU.Ammonizione === '1' || Number(vObjVU.Ammonizione) > 0) ? 1 : 0;
            calcData.espulsione = esp > 0 ? 1 : 0;
            resolved = true;
          } else {
            // I compagni hanno il voto, ma il giocatore ha voto nullo o SV senza bonus -> SV definitivo (non ha giocato)
            calcData.isSV = true;
            calcData.hasVote = false;
            calcData.voto = 'SV';
            calcData.fantavoto = 'SV';
            calcData.sourceUsed = 'pianetafanta';
            calcData.vObj = vObjVU;
            calcData.hasPlayed = true;
            resolved = true;
          }
        } else {
          // Calciatore non presente nel tabellino ma squadra ha voti su PianetaFanta -> non ha giocato
          calcData.isSV = true;
          calcData.hasVote = false;
          calcData.voto = 'SV';
          calcData.fantavoto = 'SV';
          calcData.sourceUsed = 'pianetafanta';
          calcData.hasPlayed = true;
          resolved = true;
        }
      }

      // 2. PRIORITÀ 2 (INTEGRAZIONE LIVE FP / FM / FC):
      // Si entra qui SOLO nel caso in cui il giocatore (e i suoi compagni di squadra) ha voto nullo su PianetaFanta (!hasTeamVotesVU)!
      // Questo avviene tipicamente quando la partita è in corso oppure è appena terminata e PianetaFanta
      // non ha ancora caricato le pagelle dei quotidiani cartacei.
      if (!resolved && secVoti && secVoti.length > 0 && secSource) {
        const isLiveSepPen = (secSource === 'fantapazz' || secSource === 'fantacalcio');
        const vObjSec = this._findPlayerVote(secVoti, p.name, sqA, isLiveSepPen, secSource);
        if (vObjSec) {
          const rawVoto = vObjSec.Voto;
          const isExplicitSV = (rawVoto === 'SV' || rawVoto === 'S.V.');
          const isVuoto = (rawVoto === '' || rawVoto === null || rawVoto === undefined);
          const numVoto = (!isExplicitSV && !isVuoto && !isNaN(Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)))
            ? Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)
            : null;

          const golF = Number(vObjSec.GolFatto) || 0;
          const golS = Number(vObjSec.GolSubito) || 0;
          const rPar = Number(vObjSec.RigoreParato) || 0;
          const rSba = Number(vObjSec.RigoreSbagliato) || 0;
          const esp = Number(vObjSec.Espulsione) || 0;
          const autoG = Number(vObjSec.AutoGol) || 0;
          const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (pRoleNum === 1 && golS > 0));

          const isMatchFinished = (teamStateSec === '1' || teamStateVU === '1');
          const isMatchInCourse = (teamStateSec === '0' || teamStateVU === '0');

          if (numVoto !== null && numVoto > 0) {
            // Voto live numerico presente da FP, FM o FC
            const fv = (typeof FCMCalcoloMotore !== 'undefined') ? FCMCalcoloMotore.calcolaFantavoto(vObjSec, pRoleNum, { isFP: isLiveSepPen }) : numVoto;
            calcData.voto = numVoto;
            calcData.votoNum = numVoto;
            calcData.rawVote = numVoto;
            calcData.fantavoto = fv;
            calcData.votoFinale = fv;
            calcData.hasVote = true;
            calcData.sourceUsed = secSource;
            calcData.vObj = vObjSec;
            calcData.hasPlayed = isMatchFinished;
            calcData.inCourse = isMatchInCourse;
            calcData.golSubiti = (pRoleNum === 1) ? golS : 0;
            calcData.rigoriParati = (pRoleNum === 1) ? rPar : 0;
            calcData.rigP = calcData.rigoriParati;
            calcData.golS = calcData.golSubiti;
            const rawRig = Number(vObjSec.Rigore || 0);
            const rigoriSegnati = isLiveSepPen ? rawRig : Math.max(0, rawRig - rSba);
            const netGoals = (pRoleNum === 1) ? 0 : (isLiveSepPen ? golF : Math.max(0, golF - rigoriSegnati));
            calcData.golFatti = netGoals;
            calcData.golF = netGoals;
            calcData.rigoriSegnati = (pRoleNum === 1) ? 0 : rigoriSegnati;
            calcData.rigF = calcData.rigoriSegnati;
            calcData.rigoriSbagliati = rSba;
            calcData.autogol = autoG;
            calcData.assist = Number(vObjSec.Assist || 0);
            calcData.ammonizione = (vObjSec.Ammonizione === '1' || Number(vObjSec.Ammonizione) > 0) ? 1 : 0;
            calcData.espulsione = esp > 0 ? 1 : 0;
            resolved = true;
          } else if (hasDecisiveBonus) {
            // SV con bonus/malus determinante nella fonte live: base 6.0 + bonus
            const fakeObj = { ...vObjSec, Voto: '6' };
            const fv = (typeof FCMCalcoloMotore !== 'undefined') ? FCMCalcoloMotore.calcolaFantavoto(fakeObj, pRoleNum, { isFP: isLiveSepPen }) : 6;
            calcData.voto = 6;
            calcData.votoNum = 6;
            calcData.rawVote = 6;
            calcData.fantavoto = fv;
            calcData.votoFinale = fv;
            calcData.hasVote = true;
            calcData.isSvWithBonus = true;
            calcData.sourceUsed = secSource;
            calcData.vObj = vObjSec;
            calcData.hasPlayed = isMatchFinished;
            calcData.inCourse = isMatchInCourse;
            calcData.golSubiti = (pRoleNum === 1) ? golS : 0;
            calcData.rigoriParati = (pRoleNum === 1) ? rPar : 0;
            calcData.rigP = calcData.rigoriParati;
            calcData.golS = calcData.golSubiti;
            const rawRig = Number(vObjSec.Rigore || 0);
            const rigoriSegnati = isLiveSepPen ? rawRig : Math.max(0, rawRig - rSba);
            const netGoals = (pRoleNum === 1) ? 0 : (isLiveSepPen ? golF : Math.max(0, golF - rigoriSegnati));
            calcData.golFatti = netGoals;
            calcData.golF = netGoals;
            calcData.rigoriSegnati = (pRoleNum === 1) ? 0 : rigoriSegnati;
            calcData.rigF = calcData.rigoriSegnati;
            calcData.rigoriSbagliati = rSba;
            calcData.autogol = autoG;
            calcData.assist = Number(vObjSec.Assist || 0);
            calcData.ammonizione = (vObjSec.Ammonizione === '1' || Number(vObjSec.Ammonizione) > 0) ? 1 : 0;
            calcData.espulsione = esp > 0 ? 1 : 0;
            resolved = true;
          } else if (isMatchFinished && hasTeamVotesSec) {
            // Partita conclusa in FP/FM e squadra ha voti ma giocatore è SV senza bonus -> non ha giocato
            calcData.isSV = true;
            calcData.hasVote = false;
            calcData.voto = 'SV';
            calcData.fantavoto = 'SV';
            calcData.sourceUsed = secSource;
            calcData.vObj = vObjSec;
            calcData.hasPlayed = true;
            resolved = true;
          } else if (isMatchInCourse) {
            // Partita in corso su live: se è titolare o subentrato senza voto prende 6.0 virtuale in attesa
            const hasEntered = (vObjSec.Titolare === '1' || vObjSec.Sostituzione === '1');
            if (hasEntered) {
              calcData.voto = 6;
              calcData.votoNum = 6;
              calcData.rawVote = 6;
              calcData.fantavoto = 6;
              calcData.votoFinale = 6;
              calcData.hasVote = true;
              calcData.isVirtual6 = true;
              calcData.inCourse = true;
              calcData.sourceUsed = secSource;
              calcData.vObj = vObjSec;
              resolved = true;
            }
          }
        } else if ((teamStateSec === '1' || teamStateVU === '1') && hasTeamVotesSec) {
          // Partita conclusa e squadra refertata in FP/FM, ma calciatore assente dalla lista -> non ha giocato
          calcData.isSV = true;
          calcData.hasVote = false;
          calcData.voto = 'SV';
          calcData.fantavoto = 'SV';
          calcData.sourceUsed = secSource;
          calcData.hasPlayed = true;
          resolved = true;
        }
      }

      // 3. PRIORITÀ 3: GARA NON ANCORA INIZIATA O IN CORSO SENZA VOTI IN NESSUNA FONTE
      if (!resolved) {
        const isTeamInCourse = (teamStateVU === '0' || teamStateSec === '0');
        const isTeamFinished = (teamStateVU === '1' || teamStateSec === '1');

        if (isTeamInCourse || (isTeamFinished && !hasTeamVotesVU && !hasTeamVotesSec)) {
          // In corso o conclusa senza voti in nessuna fonte: 6 d'ufficio per simulazione
          calcData.voto = 6;
          calcData.votoNum = 6;
          calcData.rawVote = 6;
          calcData.fantavoto = 6;
          calcData.votoFinale = 6;
          calcData.hasVote = true;
          calcData.isVirtual6 = true;
          calcData.inCourse = isTeamInCourse;
          calcData.hasPlayed = isTeamFinished;
          calcData.sourceUsed = 'none';
        } else if (!isTeamInCourse && !isTeamFinished) {
          // Partita non ancora iniziata: 6 d'ufficio per simulazione, trattino visivo
          calcData.voto = 6;
          calcData.votoNum = 6;
          calcData.rawVote = 6;
          calcData.fantavoto = 6;
          calcData.votoFinale = 6;
          calcData.hasVote = true;
          calcData.isVirtual6 = true;
          calcData.sourceUsed = 'none';
        } else {
          calcData.isSV = true;
          calcData.hasVote = false;
          calcData.voto = 'SV';
          calcData.fantavoto = 'SV';
          calcData.hasPlayed = true;
        }
      }

      return calcData;
    };

    const homeStarters = (homePlayers || []).filter(p => p.isStarter || p.position === 0).map(getPlayerCalcData);
    const homeBench = (homePlayers || []).filter(p => !p.isStarter && p.position > 0).sort((a, b) => a.position - b.position).map(getPlayerCalcData);

    const awayStarters = (awayPlayers || []).filter(p => p.isStarter || p.position === 0).map(getPlayerCalcData);
    const awayBench = (awayPlayers || []).filter(p => !p.isStarter && p.position > 0).sort((a, b) => a.position - b.position).map(getPlayerCalcData);

    if (homeStarters.length < 11 || awayStarters.length < 11) {
      return {
        isMissing: true,
        homeStarters, homeBench, awayStarters, awayBench,
        homeGoals: 0, awayGoals: 0, homeTotal: 0, awayTotal: 0,
        homeScorers: [], awayScorers: [],
        homeSubMap: { out: {}, in: {} }, awaySubMap: { out: {}, in: {} }
      };
    }

    // Sostituzioni simulate tramite motore fcmCalcoloMotore
    const subHome = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.eseguiSostituzioni(homeStarters, homeBench)
      : { titolariFinali: homeStarters, sostituzioniEffettuate: [] };

    const subAway = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.eseguiSostituzioni(awayStarters, awayBench)
      : { titolariFinali: awayStarters, sostituzioniEffettuate: [] };

    const homeSubMap = { out: {}, in: {} };
    (subHome.sostituzioniEffettuate || []).forEach(s => {
      if (s.tipo === 'panchina' || s.tipo === 'ufficio') {
        homeSubMap.out[s.uscito] = s;
        if (s.tipo === 'panchina' && s.entrato) {
          homeSubMap.in[s.entrato] = s;
        }
      }
    });

    const awaySubMap = { out: {}, in: {} };
    (subAway.sostituzioniEffettuate || []).forEach(s => {
      if (s.tipo === 'panchina' || s.tipo === 'ufficio') {
        awaySubMap.out[s.uscito] = s;
        if (s.tipo === 'panchina' && s.entrato) {
          awaySubMap.in[s.entrato] = s;
        }
      }
    });

    const sommaCasa = (subHome.titolariFinali || []).reduce((acc, p) => acc + (typeof p.fantavoto === 'number' ? p.fantavoto : 0), 0);
    const sommaFuori = (subAway.titolariFinali || []).reduce((acc, p) => acc + (typeof p.fantavoto === 'number' ? p.fantavoto : 0), 0);

    const mods = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaModificatori(subHome.titolariFinali, subAway.titolariFinali)
      : {};
    const fCampo = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaFattoreCampo(m.idTipo)
      : 2;
    const totali = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaTotaliSquadre(sommaCasa, sommaFuori, mods, fCampo)
      : { totaleCasa: sommaCasa, totaleFuori: sommaFuori };
    const golRes = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaGolSquadre(totali.totaleCasa, totali.totaleFuori)
      : [0, 0];

    const homeGoals = golRes.golCasa !== undefined ? golRes.golCasa : golRes[0];
    const awayGoals = golRes.golFuori !== undefined ? golRes.golFuori : golRes[1];

    const isOutfield = p => {
      const r = p.ruolo !== undefined ? p.ruolo : (p.role !== undefined ? p.role : p.roleNum);
      const rStr = String(r || '').trim().toUpperCase();
      return rStr !== '1' && rStr !== 'P' && rStr !== 'PO';
    };
    const outfieldHome = (subHome.titolariFinali || []).filter(isOutfield);
    const outfieldAway = (subAway.titolariFinali || []).filter(isOutfield);

    // Marcatori Calenbomber con fcmFantamisterMotore (esclusi categoricamente i portieri)
    const homeScorers = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.assignTeamScorers === 'function')
      ? fcmFantamisterMotore.assignTeamScorers(outfieldHome, homeGoals)
      : [];
    const awayScorers = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.assignTeamScorers === 'function')
      ? fcmFantamisterMotore.assignTeamScorers(outfieldAway, awayGoals)
      : [];

    return {
      isMissing: false,
      homeGoals,
      awayGoals,
      homeTotal: totali.totaleCasa,
      awayTotal: totali.totaleFuori,
      homeScorers,
      awayScorers,
      homeStarters,
      homeBench,
      awayStarters,
      awayBench,
      homeSubMap,
      awaySubMap
    };
  },

  /**
   * Genera l'HTML del widget unificato "Live in Corso"
   */
  _renderLiveMatchdayWidget(ctx, vuParam, secParam, options = {}) {
    if (!ctx) return '';
    const { calendar, nextDayMatches, inProgressFormations, favoriteTeamId, compGironeGroups, compNames } = ctx;

    const hasliveFP = typeof fcmModules !== 'undefined' ? fcmModules.hasliveFP() : true;
    const hasLiveFM = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveFM() : true;
    const hasLiveFC = typeof fcmModules !== 'undefined' ? (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : true) : true;
    const hasLiveVU = typeof fcmModules !== 'undefined' ? fcmModules.hasLiveVU() : true;
    const hasCalcolo = typeof fcmModules === 'undefined' || fcmModules.isRouteEnabled('#calcolo');
    const isAnyLiveActive = hasliveFP || hasLiveFM || hasLiveFC || hasLiveVU;

    if (!isAnyLiveActive || !nextDayMatches || nextDayMatches.length === 0) {
      return '';
    }

    let opts = (typeof options === 'object' && options !== null) ? options : {};
    if (typeof vuParam === 'object' && !Array.isArray(vuParam) && !vuParam.voti) {
      opts = vuParam;
    }

    const activeSecSource = this._activeSecondaryLive || (hasLiveFC ? 'fantacalcio' : (hasliveFP ? 'fantapazz' : (hasLiveFM ? 'fantamaster' : null)));

    let vuData = { voti: [], partite: {} };
    if (vuParam && vuParam.voti) {
      vuData = vuParam;
    } else if (Array.isArray(vuParam)) {
      vuData = { voti: vuParam, partite: (typeof secParam === 'object' && !Array.isArray(secParam) && !secParam.voti) ? secParam : {} };
    } else if (this._liveDataStore && this._liveDataStore.vu) {
      vuData = this._liveDataStore.vu;
    }

    let secData = (secParam && secParam.voti && secParam.voti.length > 0)
      ? secParam
      : this._getSecondaryData(activeSecSource);

    const comps = ctx.comps || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCompetitions ? fcmDataLoader.getCompetitions() : []);
    const compHierarchy = (typeof this.buildMatchdayHierarchy === 'function' && nextDayMatches.length > 0)
      ? this.buildMatchdayHierarchy(nextDayMatches, comps)
      : [];

    if (compHierarchy.length === 0 && nextDayMatches.length > 0) {
      compHierarchy.push({
        id: 'comp_0',
        name: 'Campionato',
        fantaGiornata: `${calendar.nextMatchday}ª Giornata`,
        gironi: [{
          id: 'girone_0',
          name: '',
          matches: nextDayMatches
        }]
      });
    }

    const roleClass = (r) => {
      if (r === 1 || r === 'P') return 'badge-p role-P';
      if (r === 2 || r === 'D') return 'badge-d role-D';
      if (r === 3 || r === 'C') return 'badge-c role-C';
      if (r === 4 || r === 'A') return 'badge-a role-A';
      return '';
    };

    const roleLetter = (r) => {
      if (r === 1 || r === 'P') return 'P';
      if (r === 2 || r === 'D') return 'D';
      if (r === 3 || r === 'C') return 'C';
      if (r === 4 || r === 'A') return 'A';
      return String(r || '');
    };

    const formatLiveVoto = (v) => {
      if (v === 'SV' || v === 'S.V.' || v === null || v === undefined || v === '') return 'SV';
      const num = Number(v);
      // Il risultato finisce in innerHTML: un valore non numerico non va mai restituito così com'è
      if (isNaN(num)) return 'SV';
      return (Math.round(num * 100) / 100).toString();
    };

    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])));

    const renderPlayerRow = (p, roleCls, roleLet, isStarter, subInfo, side = 'home') => {
      const sName = fcmDataLoader.extractSurname(p.name);
      const pLink = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink)
        ? fcmDataLoader.getPlayerProfileLink({ name: p.name })
        : `#schede_giocatori?name=${encodeURIComponent(p.name)}`;
      const pPhoto = (typeof fcmDataLoader !== 'undefined') ? fcmDataLoader.getPlayerPhoto(p.name) : 'img/foto/misterx.gif';

      const isAway = (side === 'away');
      const sideClass = isAway ? 'away' : 'home';

      let rowClass = 'live-player-entry';
      let subTagHtml = '';
      let votoVal = '&ndash;';
      let fvVal = '&ndash;';
      let votiBoxClass = '';
      let liveColorClass = '';
      let voteColorClass = '';
      let sourceLogoHtml = '';

      if (p.sourceUsed === 'fantapazz') {
        rowClass += ' live-source-fp';
        sourceLogoHtml = '<img src="img/live/logo-fp.png" class="live-player-source-logo" alt="FP" title="Voto Live Fantapazz">';
      } else if (p.sourceUsed === 'fantamaster') {
        rowClass += ' live-source-fm';
        sourceLogoHtml = '<img src="img/live/logo-fm.png" class="live-player-source-logo" alt="FM" title="Voto Live FantaMaster">';
      } else if (p.sourceUsed === 'fantacalcio') {
        rowClass += ' live-source-fc';
        sourceLogoHtml = '<img src="img/live/logo-fc.png" class="live-player-source-logo" alt="FC" title="Voto Live Fantacalcio.it">';
      }
      // Per pianetafanta nessun badge/logo (pulito come da specifiche)

      if (p.isSvWithBonus) {
        voteColorClass = 'live-gold';
      }

      if (subInfo && subInfo.subOut) {
        rowClass += ' has-sub-out';
        subTagHtml = `<span class="live-sub-tag out" title="Sostituito da ${escapeFn(subInfo.entrato)}">Out</span>`;
        votoVal = 'SV';
        fvVal = 'SV';
      } else if (subInfo && subInfo.subIn) {
        rowClass += ' has-sub-in';
        subTagHtml = `<span class="live-sub-tag in" title="Subentrato da panchina">In</span>`;
        if (p.inCourse) {
          votiBoxClass = 'live-in-corso';
          liveColorClass = 'live-in-corso';
          if (!p.isSvWithBonus) voteColorClass = 'live-in-corso';
          votoVal = p.hasVote ? formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto) : '6';
          fvVal = p.hasVote ? formatLiveVoto(p.fantavoto) : '6';
        } else if (p.hasPlayed) {
          liveColorClass = 'live-terminata';
          votoVal = p.hasVote ? formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto) : (p.isVirtual6 ? '6' : 'SV');
          fvVal = p.hasVote ? formatLiveVoto(p.fantavoto) : (p.isVirtual6 ? '6' : 'SV');
          if (!p.isSvWithBonus) voteColorClass = p.isVirtual6 ? 'live-virtual' : 'live-terminata';
        } else if (p.isVirtual6 || (!p.hasPlayed && !p.inCourse)) {
          votoVal = '&ndash;';
          fvVal = '&ndash;';
          votiBoxClass = 'live-non-iniziata';
          if (!p.isSvWithBonus) voteColorClass = '';
        } else if (p.hasVote && p.fantavoto !== null && p.fantavoto !== undefined) {
          votoVal = formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto);
          fvVal = formatLiveVoto(p.fantavoto);
          if (!p.isSvWithBonus) voteColorClass = 'live-terminata';
        }
      } else if (p.inCourse) {
        // Partita in corso: rosso per giocatore e voti/fantavoti
        votiBoxClass = 'live-in-corso';
        liveColorClass = 'live-in-corso';
        if (!p.isSvWithBonus) voteColorClass = 'live-in-corso';
        rowClass += ' has-vote';
        votoVal = formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto);
        fvVal = formatLiveVoto(p.fantavoto);
      } else if (p.hasPlayed && p.isVirtual6) {
        // Partita conclusa ma in attesa di voti inseriti: 6 d'ufficio
        rowClass += ' has-vote';
        votoVal = formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto);
        fvVal = formatLiveVoto(p.fantavoto);
        liveColorClass = 'live-terminata';
        if (!p.isSvWithBonus) voteColorClass = 'live-virtual';
      } else if (p.isVirtual6 || (!p.hasPlayed && !p.inCourse)) {
        // Partita non ancora iniziata: trattino come su #liveVU (valutato a 6 d'ufficio nel calcolo simulato)
        votoVal = '&ndash;';
        fvVal = '&ndash;';
        votiBoxClass = 'live-non-iniziata';
        if (!p.isSvWithBonus) voteColorClass = '';
      } else if (p.hasVote && p.fantavoto !== null && p.fantavoto !== undefined) {
        rowClass += ' has-vote';
        votoVal = formatLiveVoto(p.rawVote !== undefined && p.rawVote !== null ? p.rawVote : p.fantavoto);
        fvVal = formatLiveVoto(p.fantavoto);
        liveColorClass = 'live-terminata';
        if (!p.isSvWithBonus) voteColorClass = 'live-terminata';
      } else if (p.isSV) {
        votoVal = 'SV';
        fvVal = 'SV';
        liveColorClass = 'live-terminata';
        voteColorClass = 'live-terminata';
      }

      // Bonus / malus badges del calciatore (dal vObj effettivo)
      const isSepPen = (p.sourceUsed === 'fantapazz' || p.sourceUsed === 'fantacalcio');
      const bonusBadges = p.vObj ? this._generateBonusBadgesHtml(p.vObj, roleLet, isSepPen) : '';

      return `
        <div class="${rowClass} ${sideClass}">
          <div class="live-player-left">
            <span class="badge ${roleCls}" style="font-size:0.62rem;padding:1px 4px;line-height:1;border-radius:3px;flex-shrink:0;">${roleLet}</span>
            <a href="${pLink}" class="live-player-photo-link desktop-only" title="${escapeFn(p.name)}">
              <img src="${pPhoto}" class="live-player-photo" alt="${escapeFn(p.name)}" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" loading="lazy" />
            </a>
            <div class="live-player-details">
              <div class="live-player-name-row">
                <a href="${pLink}" class="live-player-entry-link ${liveColorClass}" title="${escapeFn(p.name)}">
                  <span class="live-player-name-link ${liveColorClass}">${escapeFn(sName)}</span>
                </a>
              </div>
              <div class="pr-bonus">${bonusBadges}${subTagHtml}</div>
            </div>
          </div>
          <div class="live-player-right">
            <div class="pr-voti-box ${votiBoxClass}">
              ${sourceLogoHtml}
              <div class="pr-voto ${voteColorClass || liveColorClass}">${votoVal}</div>
              <div class="pr-voto-divisore"></div>
              <div class="pr-fv ${voteColorClass || liveColorClass}">${fvVal}</div>
            </div>
          </div>
        </div>
      `;
    };

    const renderCalenbomberScorers = (homeScorers, awayScorers) => {
      const hList = (homeScorers && homeScorers.length > 0)
        ? homeScorers.map(s => {
          const photo = fcmDataLoader.getPlayerPhoto(s.name);
          const pLink = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink)
            ? fcmDataLoader.getPlayerProfileLink({ name: s.name })
            : `#schede_giocatori?name=${encodeURIComponent(s.name)}`;
          return `
            <div class="live-calen-scorer-row home">
              <a href="${pLink}" class="live-scorer-link home" title="Apri scheda di ${escapeFn(s.name)}">
                <img src="${photo}" class="live-scorer-photo" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeFn(s.name)}" />
                <span class="live-scorer-name">${escapeFn(fcmDataLoader.extractSurname(s.name))}</span>
              </a>
              <span>⚽</span>
            </div>
          `;
        }).join('')
        : `<div class="live-calen-empty">Nessun gol</div>`;

      const aList = (awayScorers && awayScorers.length > 0)
        ? awayScorers.map(s => {
          const photo = fcmDataLoader.getPlayerPhoto(s.name);
          const pLink = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink)
            ? fcmDataLoader.getPlayerProfileLink({ name: s.name })
            : `#schede_giocatori?name=${encodeURIComponent(s.name)}`;
          return `
            <div class="live-calen-scorer-row away">
              <span>⚽</span>
              <a href="${pLink}" class="live-scorer-link away" title="Apri scheda di ${escapeFn(s.name)}">
                <span class="live-scorer-name">${escapeFn(fcmDataLoader.extractSurname(s.name))}</span>
                <img src="${photo}" class="live-scorer-photo" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeFn(s.name)}" />
              </a>
            </div>
          `;
        }).join('')
        : `<div class="live-calen-empty">Nessun gol</div>`;

      return `
        <div class="live-calen-grid">
          <div class="live-calen-col home">
            ${hList}
          </div>
          <div class="live-calen-col away">
            ${aList}
          </div>
        </div>
      `;
    };

    const renderLiveTeamCol = (teamName, teamId, starters, bench, subMap, isFav, side = 'home') => {
      const logo = fcmDataLoader.getTeamLogo(teamName || teamId);
      const roseLink = `#rose?team=${encodeURIComponent(teamId || '')}`;
      const isAway = (side === 'away');
      const colSideClass = isAway ? 'away' : 'home';
      if (!starters || starters.length < 11) {
        return `
          <div class="live-team-col ${colSideClass} ${isFav ? 'fav-team' : ''}">
            <div class="live-team-col-header">
              <div class="live-team-col-title">
                <a href="${roseLink}" class="live-team-link" title="Visualizza rosa di ${escapeFn(teamName)}">
                  <img src="${logo}" class="live-team-col-logo" alt="" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <span class="live-team-name-score">${escapeFn(teamName)}</span>
                </a>
              </div>
            </div>
            <div class="mini-for-missing" style="font-size:0.75rem;padding:12px;text-align:center;color:var(--text-muted);">
              ⚠️ Formazione non inserita
            </div>
          </div>
        `;
      }

      const dCount = starters.filter(p => p.role === 2).length;
      const cCount = starters.filter(p => p.role === 3).length;
      const aCount = starters.filter(p => p.role === 4).length;
      const moduleStr = `${dCount}-${cCount}-${aCount}`;

      const startersHtml = starters.map(p => {
        const subInfo = subMap && subMap.out && subMap.out[p.name] ? { subOut: true, entrato: subMap.out[p.name].entrato } : null;
        return renderPlayerRow(p, roleClass(p.role), roleLetter(p.role), true, subInfo, side);
      }).join('');

      const benchHtml = (bench || []).map(p => {
        const subInfo = subMap && subMap.in && subMap.in[p.name] ? { subIn: true } : null;
        return renderPlayerRow(p, roleClass(p.role), roleLetter(p.role), false, subInfo, side);
      }).join('');

      return `
        <div class="live-team-col ${colSideClass} ${isFav ? 'fav-team' : ''}">
          <div class="live-team-col-header">
            <div class="live-team-col-title">
              <a href="${roseLink}" class="live-team-link" title="Visualizza rosa di ${escapeFn(teamName)}">
                <img src="${logo}" class="live-team-col-logo" alt="" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                <span class="live-team-name-score">${isFav ? '⭐ ' : ''}${escapeFn(teamName)}</span>
              </a>
            </div>
            <span class="formations-module-badge" style="font-size:0.68rem;padding:2px 5px;">${moduleStr}</span>
          </div>
          <div class="live-section-title">Titolari</div>
          <div class="live-player-list">
            ${startersHtml}
          </div>
          ${bench.length > 0 ? `
            <div class="live-section-title" style="margin-top:8px;">Panchina</div>
            <div class="live-player-list">
              ${benchHtml}
            </div>
          ` : ''}
        </div>
      `;
    };

    return `
      <div class="card formations-widget-card live-matchday-card" id="formationsWidgetCard">
        <!-- Header Widget con Live Dot, Titolo e Badge Risultati Simulati a Destra -->
        <div class="live-matchday-header">
          <div class="live-matchday-title">
            <span class="card-live-dot"></span>
            <span>Live in Corso • ${calendar.nextMatchday}ª Serie A</span>
          </div>
          <div class="live-matchday-header-right">
            <span class="badge-live-simulati">Risultati simulati</span>
          </div>
        </div>

        <!-- Toolbar con Pulsanti Minimal a Sinistra e Mini Badge Aggiornamento a Destra -->
        <div class="live-sub-toolbar">
          <div class="live-header-links">
            ${isAnyLiveActive ? `
              <a href="#live" class="live-mini-btn" title="Vai al Match Center Live">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>Match Center Live</span>
              </a>
            ` : ''}
            ${hasCalcolo ? `
              <a href="#calcolo" class="live-mini-btn" title="Simulatore di Calcolo">
                <img src="img/live/calc_icon.png" alt="" class="live-mini-btn-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/calc_icon.png';}else{this.style.display='none';}" />
                <span>Calcolo</span>
              </a>
            ` : ''}
            <button type="button" id="btnHomeLiveInfo" class="live-mini-btn live-info-btn" title="Come funziona la simulazione e il calcolo integrato" aria-label="Informazioni su simulazione e calcolo integrato">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>Info</span>
            </button>
          </div>
          ${hasLiveVU ? `
            <div class="live-toolbar-right">
              <span class="live-refresh-status ${opts.isUpdating ? '' : 'live-refresh-done'}" id="liveHomeRefreshStatus" title="${opts.isUpdating ? 'Aggiornamento voti ufficiosi in corso...' : 'Voti ufficiosi aggiornati con successo'}">
                ${opts.isUpdating ? `
                  <svg class="spin live-refresh-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                  <span class="live-refresh-label">Aggiornamento...</span>
                ` : `
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span class="live-refresh-label">Aggiornato</span>
                `}
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Barra Switcher Fonte Live Dedicata (Subito sopra le card dei match) -->
        ${(hasliveFP || hasLiveFM || hasLiveFC) ? `
          <div class="live-source-bar">
            <div class="live-source-bar-left">
              <span class="live-source-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Integrazione Live:
              </span>
              <div class="live-source-pills">
                ${hasLiveFC ? `
                  <button type="button" class="live-source-pill ${activeSecSource === 'fantacalcio' ? 'active' : ''}" data-source="fantacalcio" aria-pressed="${activeSecSource === 'fantacalcio' ? 'true' : 'false'}" title="Integra le partite in corso con i voti live di Fantacalcio.it">
                    <img src="img/live/logo-fc.png" class="live-source-pill-icon" alt="" onerror="this.style.display='none'">
                    <span>Fantacalcio</span>
                  </button>
                ` : ''}
                ${hasliveFP ? `
                  <button type="button" class="live-source-pill ${activeSecSource === 'fantapazz' ? 'active' : ''}" data-source="fantapazz" aria-pressed="${activeSecSource === 'fantapazz' ? 'true' : 'false'}" title="Integra le partite in corso con i voti live di Fantapazz">
                    <img src="img/live/logo-fp.png" class="live-source-pill-icon" alt="" onerror="this.style.display='none'">
                    <span>Fantapazz</span>
                  </button>
                ` : ''}
                ${hasLiveFM ? `
                  <button type="button" class="live-source-pill ${activeSecSource === 'fantamaster' ? 'active' : ''}" data-source="fantamaster" aria-pressed="${activeSecSource === 'fantamaster' ? 'true' : 'false'}" title="Integra le partite in corso con i voti live di FantaMaster">
                    <img src="img/live/logo-fm.png" class="live-source-pill-icon" alt="" onerror="this.style.display='none'">
                    <span>FantaMaster</span>
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="live-source-bar-right">
              <span class="live-base-tag" title="I voti ufficiosi di PianetaFanta hanno sempre priorità assoluta su tutte le partite">
                Base: <img src="img/live/live_pianeta.png" class="live-source-pill-icon" alt="" onerror="this.style.display='none'"><strong>PianetaFanta</strong>
              </span>
            </div>
          </div>
        ` : ''}

        <div class="matchday-content-vertical" style="padding:0;">
          ${compHierarchy.map((comp, cIdx) => `
            <div class="comp-group-block">
              <div class="comp-group-header">
                <div class="comp-header-title">
                  <span>${escapeFn(comp.name)}</span>
                </div>
                ${comp.fantaGiornata ? `<span class="comp-fanta-giornata">${escapeFn(comp.fantaGiornata)}</span>` : `<span class="comp-fanta-giornata">${calendar.nextMatchday}ª Giornata</span>`}
              </div>
              ${comp.gironi.map((girone, gIdx) => `
                <div class="girone-group-block">
                  ${girone.name && girone.name !== comp.name ? `
                    <div class="girone-group-header">${escapeFn(this.formatGironeName(girone.name))}</div>
                  ` : ''}
                  <div class="live-matches-list">
                    ${girone.matches.map((m, mIdx) => {
      const homePlayers = inProgressFormations.filter(f => (f.matchId === m.id || !f.matchId) && f.teamId === m.homeTeamId);
      const awayPlayers = inProgressFormations.filter(f => (f.matchId === m.id || !f.matchId) && f.teamId === m.awayTeamId);
      const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
      const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
      const isMatchFav = isHomeFav || isAwayFav;

      // Simulazione incontro basata sul Motore Ibrido: PianetaFanta prioritario + Fantapazz/FantaMaster live
      const sim = this._simulateLiveMatch(m, homePlayers, awayPlayers, vuData, secData, activeSecSource);

      const homeLogo = fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId);
      const awayLogo = fcmDataLoader.getTeamLogo(m.awayTeamName || m.awayTeamId);
      const targetId = `live-match-details-${cIdx}-${gIdx}-${mIdx}`;

      const liveScoreUrl = isAnyLiveActive
        ? `#live?Comp=${m.compId || 1}&Gio=${calendar.nextMatchday}${m.divId ? '&Div=' + m.divId : ''}&Match=${m.id}`
        : (hasCalcolo ? '#calcolo' : '#');

      return `
                        <div class="live-match-item ${isMatchFav ? 'favorite-match' : ''}">
                          <!-- Tabellino Risultato Live Simulato & Marcatori Calenbomber -->
                          <div class="live-scoreboard-box" style="margin-bottom:0;">
                            <div class="live-scoreboard-head">
                              <div class="live-team-side home">
                                <a href="#rose?team=${encodeURIComponent(m.homeTeamId || '')}" class="live-team-link home" title="Visualizza rosa di ${escapeFn(m.homeTeamName)}">
                                  <span class="live-team-name-score" title="${escapeFn(m.homeTeamName)}">
                                    ${isHomeFav ? '⭐ ' : ''}${escapeFn(m.homeTeamName)}
                                  </span>
                                  <img src="${homeLogo}" class="live-team-col-logo" alt="${escapeFn(m.homeTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                </a>
                              </div>
                              <div class="live-score-center">
                                <a href="${liveScoreUrl}" class="live-score-link" title="Apri partita su Live Voti">
                                  <div class="live-score-digits">
                                    ${sim.isMissing ? '- -' : `${sim.homeGoals} - ${sim.awayGoals}`}
                                  </div>
                                  <div class="live-score-totals">
                                    ${sim.isMissing ? 'Formazioni incomplete' : `(${sim.homeTotal.toFixed(2)} - ${sim.awayTotal.toFixed(2)})`}
                                  </div>
                                  <div class="live-score-sim-tag">Dettagli</div>
                                </a>
                              </div>
                              <div class="live-team-side away">
                                <a href="#rose?team=${encodeURIComponent(m.awayTeamId || '')}" class="live-team-link away" title="Visualizza rosa di ${escapeFn(m.awayTeamName)}">
                                  <img src="${awayLogo}" class="live-team-col-logo" alt="${escapeFn(m.awayTeamName)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                                  <span class="live-team-name-score" title="${escapeFn(m.awayTeamName)}">
                                    ${isAwayFav ? '⭐ ' : ''}${escapeFn(m.awayTeamName)}
                                  </span>
                                </a>
                              </div>
                            </div>
                            ${sim.isMissing ? '' : renderCalenbomberScorers(sim.homeScorers, sim.awayScorers)}

                            <!-- Pulsante per vedere il dettaglio formazioni (nascosto di default) -->
                            <div class="live-match-toggle-wrap">
                              <button type="button" class="btn-toggle-formations" data-target="${targetId}" aria-expanded="false">
                                <span class="toggle-text">Dettaglio Formazioni</span>
                                <svg class="toggle-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                              </button>
                            </div>
                          </div>

                          <!-- Formazioni in Campo (Affiancate anche su Mobile, nascoste di default) -->
                          <div id="${targetId}" class="live-formations-collapse" style="display: none;">
                            <div class="live-formations-grid">
                              ${renderLiveTeamCol(m.homeTeamName, m.homeTeamId, sim.homeStarters, sim.homeBench, sim.homeSubMap, isHomeFav, 'home')}
                              ${renderLiveTeamCol(m.awayTeamName, m.awayTeamId, sim.awayStarters, sim.awayBench, sim.awaySubMap, isAwayFav, 'away')}
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

        <!-- Link in Calce per visualizzare tutte le formazioni -->
        <div class="live-card-footer">
          <a href="#formazioni" class="live-footer-link" title="Vai alla pagina con tutte le formazioni">
            <span>Tutte le Formazioni in campo &rarr;</span>
          </a>
        </div>
      </div>
    `;
  },

  /**
   * Commuta la sorgente live secondaria (Fantacalcio / Fantapazz / FantaMaster) per il calcolo ibrido
   */
  async _switchSecondaryLiveSource(targetSource) {
    if (!targetSource || (targetSource !== 'fantapazz' && targetSource !== 'fantamaster' && targetSource !== 'fantacalcio')) return;
    this._activeSecondaryLive = targetSource;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('modernfcm_home_live_secondary', targetSource);
      }
    } catch (e) { }

    // Aggiorna subito lo stato attivo dei pulsanti nello switcher per feedback immediato
    const currentCard = (this.container || document).querySelector('#formationsWidgetCard');
    if (currentCard) {
      currentCard.querySelectorAll('.live-source-pill').forEach(btn => {
        const isMatch = btn.dataset.source === targetSource;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    }

    // Carica i dati della sorgente live selezionata se non ancora in memoria
    const secStore = this._getSecondaryData(targetSource);
    const liveCal = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) ? fcmDataLoader.getCalendarData() : null;
    const liveDay = (liveCal && liveCal.nextMatchday) ? liveCal.nextMatchday : 1;
    if ((!secStore.loaded || !secStore.voti || secStore.voti.length === 0) && await this._isLiveFeedOfDay(targetSource, liveDay)) {
      try {
        if (targetSource === 'fantapazz') {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFP.js', true);
        } else if (targetSource === 'fantamaster') {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFM.js', true);
        } else if (targetSource === 'fantacalcio') {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFC.js', true);
        }
        const data = {
          voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
          partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
          loaded: true
        };
        this._setSecondaryData(targetSource, data);

        // Ripristina l'array globale arrVoti con i dati di PianetaFanta per isolamento
        if (this._liveDataStore.vu && this._liveDataStore.vu.loaded) {
          if (typeof arrVoti !== 'undefined') window.arrVoti = this._liveDataStore.vu.voti.slice();
          if (typeof arrPartite !== 'undefined') window.arrPartite = { ...this._liveDataStore.vu.partite };
        }
      } catch (err) {
        console.warn(`[homeView] Errore caricamento sorgente live ${targetSource}:`, err);
      }
    }

    this._reRenderLiveWidgetInPlace({ isUpdated: true, isUpdating: false });
    this._checkAndSetupAutoRefresh();
  },

  /**
   * Re-renderizza in-place il widget "Live in Corso" conservando lo stato della tab attiva e dei toggle aperti
   */
  _reRenderLiveWidgetInPlace(options = {}) {
    const currentCard = (this.container || document).querySelector('#formationsWidgetCard');
    if (!currentCard || !this._liveWidgetContext) return;

    const activeTabBtn = currentCard.querySelector('.formations-comp-tab-btn.active');
    const activeCompName = activeTabBtn ? activeTabBtn.dataset.comp : null;

    const openTargets = new Set();
    currentCard.querySelectorAll('.btn-toggle-formations.is-open').forEach(b => {
      if (b.dataset.target) openTargets.add(b.dataset.target);
    });

    const activeSec = this._activeSecondaryLive;
    const secData = this._getSecondaryData(activeSec);
    const newHtml = this._renderLiveMatchdayWidget(this._liveWidgetContext, this._liveDataStore.vu, secData, options);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHtml;
    const newCard = tempDiv.firstElementChild;
    if (newCard && currentCard.parentNode) {
      const prevBadge = currentCard.querySelector('#liveHomeRefreshStatus');
      const wasBadgeHidden = prevBadge && (prevBadge.classList.contains('live-refresh-fadeout') || prevBadge.style.display === 'none');

      currentCard.parentNode.replaceChild(newCard, currentCard);

      if (activeCompName) {
        const tabToActivate = newCard.querySelector(`.formations-comp-tab-btn[data-comp="${CSS.escape ? CSS.escape(activeCompName) : activeCompName}"]`);
        if (tabToActivate) {
          newCard.querySelectorAll('.formations-comp-tab-btn').forEach(b => b.classList.remove('active'));
          tabToActivate.classList.add('active');
          newCard.querySelectorAll('.formations-comp-pane').forEach(p => {
            p.style.display = (p.dataset.compPane === activeCompName) ? 'block' : 'none';
          });
        }
      }

      openTargets.forEach(targetId => {
        const targetEl = newCard.querySelector('#' + targetId);
        const btn = newCard.querySelector(`.btn-toggle-formations[data-target="${targetId}"]`);
        if (targetEl && btn) {
          targetEl.style.display = 'block';
          btn.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          const txt = btn.querySelector('.toggle-text');
          if (txt) txt.textContent = 'Nascondi Formazioni';
        }
      });

      this._bindLiveWidgetInteractions(newCard);

      const updatedBadge = newCard.querySelector('#liveHomeRefreshStatus');
      if (updatedBadge) {
        if (wasBadgeHidden && !options.forceShowBadge) {
          updatedBadge.classList.add('live-refresh-fadeout');
          updatedBadge.style.display = 'none';
        } else if (!options.isUpdating) {
          setTimeout(() => {
            updatedBadge.classList.add('live-refresh-fadeout');
            setTimeout(() => {
              if (updatedBadge) updatedBadge.style.display = 'none';
            }, 850);
          }, 1500);
        }
      }
    }
  },

  /**
   * Controlla se almeno una partita di Serie A risulta attualmente in corso ('0')
   */
  _hasAnyMatchLive() {
    const checkObj = (obj) => {
      if (!obj) return false;
      return Object.values(obj).some(val => String(val) === '0');
    };
    const vuLive = this._liveDataStore && this._liveDataStore.vu && checkObj(this._liveDataStore.vu.partite);
    const activeSec = this._activeSecondaryLive;
    const secStore = this._getSecondaryData(activeSec);
    const secLive = secStore && checkObj(secStore.partite);
    return Boolean(vuLive || secLive);
  },

  /**
   * Avvia o ferma il timer di aggiornamento automatico (60s) in base allo stato delle partite
   */
  _checkAndSetupAutoRefresh() {
    const hasMatchLive = this._hasAnyMatchLive();
    if (hasMatchLive) {
      if (!this._liveAutoRefreshInterval) {
        this._liveAutoRefreshInterval = setInterval(() => {
          this._triggerLiveAutoRefresh();
        }, 60000);
      }
      if (!this._visibilityHandler && typeof document !== 'undefined') {
        this._visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            const curHash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash.toLowerCase() : '';
            if (curHash === '' || curHash === '#' || curHash.startsWith('#home')) {
              const now = Date.now();
              if (now - (this._lastLiveRefreshTime || 0) >= 60000) {
                this._triggerLiveAutoRefresh();
              }
            }
          }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
      }
    } else {
      if (this._liveAutoRefreshInterval) {
        clearInterval(this._liveAutoRefreshInterval);
        this._liveAutoRefreshInterval = null;
      }
    }
  },

  /**
   * Esegue l'aggiornamento silenzioso dei voti live in background quando il timer scatta
   */
  async _triggerLiveAutoRefresh() {
    if (this._isExtractingLive) return;
    const card = (this.container || document).querySelector('#formationsWidgetCard');
    if (!card) return;

    this._isExtractingLive = true;
    this._lastLiveRefreshTime = Date.now();

    try {
      const cal = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) ? fcmDataLoader.getCalendarData() : null;
      const g = (cal && cal.nextMatchday) ? cal.nextMatchday : 1;

      // 1. Aggiorna la sorgente live secondaria attiva in background
      const activeSec = this._activeSecondaryLive;
      if (activeSec === 'fantapazz') {
        try {
          await fetch(`inc/live_extractFP.php?ajax=1&Gio=${encodeURIComponent(g)}&force=1&t=${Date.now()}`, { cache: 'no-store' });
          if (!(await this._isLiveFeedOfDay('fantapazz', g))) throw new Error('voti salvati di un\'altra giornata');
          await fcmDataLoader.loadScript('js/fcmVotiDatiFP.js', true);
          this._setSecondaryData('fantapazz', {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          });
        } catch (e) {
          console.warn('[homeView] Live refresh FP:', e);
        }
      } else if (activeSec === 'fantamaster') {
        try {
          await fetch(`inc/live_extractFM.php?ajax=1&Gio=${encodeURIComponent(g)}&force=1&t=${Date.now()}`, { cache: 'no-store' });
          if (!(await this._isLiveFeedOfDay('fantamaster', g))) throw new Error('voti salvati di un\'altra giornata');
          await fcmDataLoader.loadScript('js/fcmVotiDatiFM.js', true);
          this._setSecondaryData('fantamaster', {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          });
        } catch (e) {
          console.warn('[homeView] Live refresh FM:', e);
        }
      } else if (activeSec === 'fantacalcio') {
        try {
          await fetch(`inc/live_extractFC.php?ajax=1&Gio=${encodeURIComponent(g)}&force=1&t=${Date.now()}`, { cache: 'no-store' });
          if (!(await this._isLiveFeedOfDay('fantacalcio', g))) throw new Error('voti salvati di un\'altra giornata');
          await fcmDataLoader.loadScript('js/fcmVotiDatiFC.js', true);
          this._setSecondaryData('fantacalcio', {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          });
        } catch (e) {
          console.warn('[homeView] Live refresh FC:', e);
        }
      }

      // 2. Se PianetaFanta è attivo e sono trascorsi almeno 15 minuti dal precedente refresh, aggiorna PianetaFanta in background
      const hasVU = typeof fcmModules === 'undefined' || fcmModules.hasLiveVU();
      const now = Date.now();
      const VU_TTL_MS = 15 * 60 * 1000; // Scadenza rigida di 15 minuti (900s)
      if (hasVU && (!this._lastVURefreshTime || (now - this._lastVURefreshTime >= VU_TTL_MS))) {
        try {
          const vuRes = await fetch(`inc/live_extractVU.php?ajax=1&Gio=${encodeURIComponent(g)}&t=${now}`, { cache: 'no-store' });
          if (vuRes.ok) {
            const vuData = await vuRes.json();
            this._lastVURefreshTime = (vuData && vuData.timestamp) ? vuData.timestamp * 1000 : now;
          }
          if (!(await this._isLiveFeedOfDay('vu', g))) throw new Error('voti salvati di un\'altra giornata');
          await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
          this._liveDataStore.vu = {
            voti: (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [],
            partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {},
            loaded: true
          };
        } catch (e) {
          console.warn('[homeView] Live refresh VU:', e);
        }
      }

      // 3. Ripristina globali con VU
      if (this._liveDataStore.vu && this._liveDataStore.vu.loaded) {
        if (typeof arrVoti !== 'undefined') window.arrVoti = this._liveDataStore.vu.voti.slice();
        if (typeof arrPartite !== 'undefined') window.arrPartite = { ...this._liveDataStore.vu.partite };
      }

      // 4. Ricalcolo e re-render in-place
      this._reRenderLiveWidgetInPlace({ isUpdated: true });

    } catch (err) {
      console.warn('[homeView] Errore triggerLiveAutoRefresh:', err);
    } finally {
      this._isExtractingLive = false;
    }
  },

  /**
   * Aggiornamento automatico asincrono dei voti ufficiosi all'apertura della Home (rispetta la scadenza dei 15 minuti)
   */
  async _autoRefreshLiveVUHome(container, matchday) {
    if (this._isRefreshingLiveVU) return;
    const card = (container || this.container || document).querySelector('#formationsWidgetCard');
    if (!card) return;
    const statusEl = card.querySelector('#liveHomeRefreshStatus');

    const hasVU = typeof fcmModules === 'undefined' || fcmModules.hasLiveVU();
    if (!hasVU) {
      if (statusEl) statusEl.style.display = 'none';
      return;
    }

    const now = Date.now();
    const VU_TTL_MS = 15 * 60 * 1000; // Scadenza 15 minuti (900 secondi)

    // Se abbiamo già aggiornato meno di 15 minuti fa in sessione, non ricaricare
    if (this._lastVURefreshTime && (now - this._lastVURefreshTime < VU_TTL_MS)) {
      if (statusEl) statusEl.classList.add('live-refresh-fadeout');
      return;
    }

    this._isRefreshingLiveVU = true;
    try {
      const g = matchday || (fcmDataLoader && fcmDataLoader.getCalendarData ? fcmDataLoader.getCalendarData().nextMatchday : 1);

      // Controllo metadati locali (giornata corrispondente e TTL) prima di invocare live_extractVU.php
      try {
        const metaRes = await fetch(`js/fcmVotiDatiVUMeta.json?t=${now}`, { cache: 'no-store' });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (meta && Number(meta.schema) === 2 && Number(meta.giornata) === Number(g) && meta.timestamp && (now - meta.timestamp * 1000 < VU_TTL_MS)) {
            this._lastVURefreshTime = meta.timestamp * 1000;
            if (statusEl) statusEl.classList.add('live-refresh-fadeout');
            this._isRefreshingLiveVU = false;
            return;
          }
        }
      } catch (e) { }

      const fetchUrl = `inc/live_extractVU.php?ajax=1&Gio=${encodeURIComponent(g)}&t=${Date.now()}`;

      const res = await fetch(fetchUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this._lastVURefreshTime = (data && data.timestamp) ? data.timestamp * 1000 : Date.now();

      if (data && data.success && await this._isLiveFeedOfDay('vu', g)) {
        if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadScript) {
          await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
        }

        const freshVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
        const freshPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {};

        this._liveDataStore.vu = {
          voti: freshVoti,
          partite: freshPartite,
          loaded: true
        };

        if (typeof arrVoti !== 'undefined') window.arrVoti = freshVoti.slice();
        if (typeof arrPartite !== 'undefined') window.arrPartite = { ...freshPartite };

        this._reRenderLiveWidgetInPlace({ isUpdated: true });
        this._checkAndSetupAutoRefresh();
      } else {
        if (statusEl) statusEl.classList.add('live-refresh-fadeout');
      }
    } catch (err) {
      console.warn('[homeView] Auto-refresh voti ufficiosi:', err);
      const curStatus = (this.container || document).querySelector('#liveHomeRefreshStatus');
      if (curStatus) {
        curStatus.classList.add('live-refresh-fadeout');
        setTimeout(() => { if (curStatus) curStatus.style.display = 'none'; }, 850);
      }
    } finally {
      this._isRefreshingLiveVU = false;
    }
  },

  destroy() {
    this.cleanupHeaderAutoHide();
    this.isEditMode = false;
    this.tempConfig = null;
    this._draggedItem = null;
    this._hasAutoRefreshedLiveVU = false;
    this._isRefreshingLiveVU = false;
    this._isExtractingLive = false;
    if (this._liveAutoRefreshInterval) {
      clearInterval(this._liveAutoRefreshInterval);
      this._liveAutoRefreshInterval = null;
    }
    if (this._visibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._visibilityHandler);
      }
      this._visibilityHandler = null;
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('is-home-editing');
      document.body.classList.remove('home-is-dragging-widget');
    }
    if (this._carouselResizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._carouselResizeHandler);
      this._carouselResizeHandler = null;
    }
    if (this.anticipoInterval) {
      clearInterval(this.anticipoInterval);
      this.anticipoInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.clearCustomCountdowns === 'function') {
      fcmHomeConfigManager.clearCustomCountdowns();
    }
    const infoDlgScope = this.container || (typeof document !== 'undefined' ? document : null);
    if (infoDlgScope && typeof infoDlgScope.querySelector === 'function') {
      const openInfoDlg = infoDlgScope.querySelector('#homeLiveInfoModal');
      if (openInfoDlg && openInfoDlg.open && typeof openInfoDlg.close === 'function') {
        openInfoDlg.close();
      }
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = homeView;
}

