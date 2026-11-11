/**
 * FCM HOME CONFIG MANAGER
 * Gestisce la configurazione dei widget della homepage (Default di Lega + Override Utente in localStorage)
 * ModernFCM
 */

const fcmHomeConfigManager = {
  STORAGE_KEY: 'pn_home_layout',
  serverConfig: null,
  activeConfig: null,

  // Catalogo metadati dei widget standard nativi
  standardWidgets: {
    news: {
      id: 'news',
      title: 'Editoriale di Giornata (AI)',
      column: 'main',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line></svg>',
      condition: () => true
    },
    liveMatchday: {
      id: 'liveMatchday',
      title: 'Live in Corso',
      column: 'main',
      isLiveOnly: true,
      requires: () => typeof fcmModules === 'undefined' || fcmModules.hasliveFP() || fcmModules.hasLiveFM() || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : true) || fcmModules.hasLiveVU(),
      condition: (ctx) => ctx && ctx.isMatchdayInProgress && (typeof fcmModules === 'undefined' || fcmModules.hasliveFP() || fcmModules.hasLiveFM() || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : true) || fcmModules.hasLiveVU()),
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>'
    },
    liveHero: {
      id: 'liveHero',
      title: 'Hub Live Matchday',
      column: 'main',
      isLiveOnly: true,
      hiddenInEditor: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>'
    },
    miniFormations: {
      id: 'miniFormations',
      title: 'Formazioni in Campo',
      column: 'main',
      isLiveOnly: true,
      hiddenInEditor: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"></rect><circle cx="12" cy="12" r="4"></circle></svg>',
      condition: (ctx) => ctx && ctx.isMatchdayInProgress && ctx.nextDayMatches && ctx.nextDayMatches.length > 0
    },
    countdown: {
      id: 'countdown',
      title: 'Countdown & Invio Formazione',
      column: 'main',
      isNonLiveOnly: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    },
    results: {
      id: 'results',
      title: 'Risultati Ultima Giornata',
      column: 'main',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>'
    },
    topFlop11: {
      id: 'topFlop11',
      title: 'Campetto Top / Flop 11',
      column: 'main',
      requires: () => typeof fcmModules === 'undefined' || fcmModules.hasFantamister(),
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
      condition: (ctx) => ctx && (ctx.hasTop || ctx.hasFlop)
    },
    bestWorstMister: {
      id: 'FantaMister / BestWorst',
      title: 'FantaMister: Migliori Punteggi & Miglior/Peggior Scelta',
      column: 'main',
      requires: () => typeof fcmModules === 'undefined' || fcmModules.hasFantamister(),
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      condition: (ctx) => ctx && ctx.fantamisterData && ctx.fantamisterData.list && ctx.fantamisterData.list.length > 0
    },
    nextDayPreview: {
      id: 'nextDayPreview',
      title: 'Anteprima Prossimo Turno',
      column: 'main',
      isNonLiveOnly: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      condition: (ctx) => ctx && ctx.nextDayMatches && ctx.nextDayMatches.length > 0
    },
    anticipo: {
      id: 'anticipo',
      title: 'Anticipo Formazione Prossima',
      column: 'main',
      isLiveOnly: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
      condition: (ctx) => ctx && ctx.isMatchdayInProgress && ctx.allowFutureLineups
    },
    bilancio: {
      id: 'bilancio',
      title: 'Bilancio Prossimo Turno',
      column: 'main',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path></svg>'
    },
    quotes: {
      id: 'quotes',
      title: 'Quote Scommesse 1X2 & U/O',
      column: 'main',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="M7 10l2 2 3-3 5 5"></path></svg>'
    },
    standings: {
      id: 'standings',
      title: 'Classifica Campionato',
      column: 'side',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>'
    },
    gpStandings: {
      id: 'gpStandings',
      title: 'Classifica Gran Prix',
      column: 'side',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"></rect><line x1="2" y1="7" x2="22" y2="7"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="17" x2="22" y2="17"></line><line x1="7" y1="2" x2="7" y2="22"></line><line x1="12" y1="2" x2="12" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line></svg>'
    },
    coppa: {
      id: 'coppa',
      title: 'Coppa di Lega',
      column: 'side',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>',
      condition: (ctx) => ctx && ctx.coppaComp
    },
    liveTools: {
      id: 'liveTools',
      title: 'Live & Strumenti Rapidi',
      column: 'side',
      isNonLiveOnly: true,
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>'
    },
    guestbook: {
      id: 'guestbook',
      title: 'Guestbook di Lega Preview',
      column: 'side',
      requires: () => typeof fcmModules === 'undefined' || fcmModules.hasGuestbook(),
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
    },
    sponsors: {
      id: 'sponsors',
      title: 'Sponsor e Preferiti',
      column: 'side',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"></rect><path d="M5 14l3-3"></path><path d="M19 10l-3 3"></path></svg>',
      condition: (ctx) => {
        if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.getSponsors === 'function') {
          const sp = fcmHomeConfigManager.getSponsors();
          if (Array.isArray(sp) && sp.length > 0) return true;
        }
        return Boolean(ctx && ctx.info && ctx.info.sponsors && ctx.info.sponsors.length > 0);
      }
    },
    counter: {
      id: 'counter',
      title: 'Contatore Visite',
      column: 'side',
      requires: () => typeof fcmModules === 'undefined' || fcmModules.hasCounter(),
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    }
  },

  /**
   * Configurazione standard di fabbrica (fallback di default)
   */
  getDefaultConfig() {
    return {
      version: 1,
      lastUpdated: Date.now(),
      defaultSettings: {
        favoriteTeamId: null,
        topFlopDefaultTab: 'top',
        quotesMode: 'all',
        gpAccordionOpen: true,
        coppaAccordionOpen: false,
        coppaDefaultTab: 'knockout',
        standingsCompId: 'auto',
        coppaCompId: 'auto'
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
      sponsors: [],
      customWidgets: []
    };
  },

  /**
   * Carica la configurazione del server (inc/data/homepage_config.json o API fallback) con cache-busting
   */
  async loadServerConfig() {
    try {
      const ver = (typeof window.FCM_VERSION !== 'undefined') ? window.FCM_VERSION : Date.now();
      const isInc = window.location.pathname.includes('/inc/') || window.location.pathname.includes('impostazioni.php') || window.location.pathname.includes('impostazioni_calcolo.php');
      const directPath = isInc ? 'data/homepage_config.json' : 'inc/data/homepage_config.json';
      const apiPath = isInc ? 'homepage_admin_save.php?action=get_config' : 'inc/homepage_admin_save.php?action=get_config';

      let res = await fetch(`${directPath}?v=${ver}&_t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) {
        res = await fetch(`${apiPath}&_t=${Date.now()}`, { cache: 'no-cache' });
      }
      if (res.ok) {
        const rawData = await res.json();
        const data = (rawData && rawData.config) ? rawData.config : rawData;
        if (data && data.columns && Array.isArray(data.columns.main)) {
          this.serverConfig = data;
          return data;
        }
      }
    } catch (e) {
      console.warn('Impossibile caricare inc/data/homepage_config.json, uso fallback default:', e);
    }
    this.serverConfig = this.getDefaultConfig();
    return this.serverConfig;
  },

  /**
   * Verifica se l'amministratore ha eseguito un ripristino di fabbrica/default
   * posteriore al salvataggio locale dell'utente. Se sì, sovrascrive e allinea il localStorage.
   */
  checkAndApplyServerReset() {
    if (!this.serverConfig) return;
    const serverResetAt = Number(this.serverConfig.layoutResetAt || 0);
    if (!serverResetAt) return;

    const userPrefs = this.getUserPreferences();
    if (!userPrefs) return;

    const userSavedAt = Number(userPrefs.updatedAt || userPrefs.savedAt || 0);

    // Se il reset dell'admin sul server è posteriore all'ultimo salvataggio locale dell'utente
    if (!userSavedAt || userSavedAt < serverResetAt) {
      try {
        // Se l'utente aveva impostato la squadra del cuore, preserviamola senza perdere la sua scelta
        if (userPrefs.favoriteTeamId !== undefined && userPrefs.favoriteTeamId !== null) {
          const cleanPrefs = {
            version: 1,
            updatedAt: serverResetAt,
            favoriteTeamId: userPrefs.favoriteTeamId,
            columnsOrder: null,
            disabledWidgets: [],
            userSettings: null
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleanPrefs));
        } else {
          localStorage.removeItem(this.STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Errore allineamento localStorage al reset del server:', e);
      }
    }
  },

  /**
   * Carica e fonde la configurazione attiva (Server Default + localStorage Utente)
   */
  async init() {
    await this.loadServerConfig();
    this.checkAndApplyServerReset();
    this.activeConfig = this.mergeWithUserPreferences(this.serverConfig);
    return this.activeConfig;
  },

  /**
   * Legge le preferenze utente salvate in localStorage
   */
  getUserPreferences() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Errore lettura localStorage layout home:', e);
    }
    return null;
  },

  /**
   * Fonde la configurazione server con le preferenze locali dell'utente
   */
  mergeWithUserPreferences(baseConfig) {
    const config = JSON.parse(JSON.stringify(baseConfig || this.getDefaultConfig()));
    const userPrefs = this.getUserPreferences();

    if (!userPrefs) {
      return config;
    }

    // Se il server ha registrato un ripristino di fabbrica/default posteriore alle preferenze locali,
    // l'override dell'ordine e dei widget viene superato dal reset del server
    const serverResetAt = Number(this.serverConfig && this.serverConfig.layoutResetAt ? this.serverConfig.layoutResetAt : 0);
    const userSavedAt = Number(userPrefs.updatedAt || userPrefs.savedAt || 0);
    const isResetOutdated = (serverResetAt > 0 && (!userSavedAt || userSavedAt < serverResetAt));

    // 1. Squadra del Cuore (sempre mantenuta se presente)
    if (userPrefs.favoriteTeamId !== undefined) {
      config.defaultSettings.favoriteTeamId = userPrefs.favoriteTeamId;
    }

    // Se le preferenze locali sono superate dal reset del server, adotta il layout pulito del server
    if (isResetOutdated) {
      return config;
    }

    // 2. Opzioni generiche widget (preservando le associazioni competizione scelte dall'admin)
    const adminStandingsCompId = config.defaultSettings ? config.defaultSettings.standingsCompId : 'auto';
    const adminCoppaCompId = config.defaultSettings ? config.defaultSettings.coppaCompId : 'auto';
    if (userPrefs.userSettings) {
      Object.assign(config.defaultSettings, userPrefs.userSettings);
    }
    if (adminStandingsCompId !== undefined) {
      config.defaultSettings.standingsCompId = adminStandingsCompId;
    }
    if (adminCoppaCompId !== undefined) {
      config.defaultSettings.coppaCompId = adminCoppaCompId;
    }

    // 3. Riordino e visibilità per colonna (supporta riordino e spostamento tra main e side)
    const userOrder = userPrefs.columnsOrder;
    const disabledList = new Set(userPrefs.disabledWidgets || []);

    // Retrocompatibilità: se entrambi i vecchi blocchi live erano disabilitati, disabilita liveMatchday
    if (disabledList.has('liveHero') && disabledList.has('miniFormations')) {
      disabledList.add('liveMatchday');
    }

    if (userOrder && (Array.isArray(userOrder.main) || Array.isArray(userOrder.side))) {
      // Raccoglie tutti i widget noti dal server
      const allServerItemsMap = new Map();
      ['main', 'side'].forEach(col => {
        (config.columns[col] || []).forEach(item => allServerItemsMap.set(item.id, item));
      });

      const newColumns = { main: [], side: [] };

      // Inserisce i widget nell'ordine scelto dall'utente per ciascuna colonna
      ['main', 'side'].forEach(colKey => {
        let orderList = Array.isArray(userOrder[colKey]) ? userOrder[colKey] : [];
        // Migrazione automatica: unifica vecchi widget liveHero / miniFormations in liveMatchday
        const migratedOrder = [];
        let addedLiveMatchday = false;
        orderList.forEach(id => {
          if (id === 'liveHero' || id === 'miniFormations') {
            if (!addedLiveMatchday) {
              migratedOrder.push('liveMatchday');
              addedLiveMatchday = true;
            }
          } else {
            migratedOrder.push(id);
          }
        });
        orderList = migratedOrder;

        orderList.forEach(id => {
          if (allServerItemsMap.has(id)) {
            const item = allServerItemsMap.get(id);
            item.enabled = !disabledList.has(id);
            newColumns[colKey].push(item);
            allServerItemsMap.delete(id);
          }
        });
      });

      // Eventuali widget presenti sul server ma non nell'array dell'utente rimangono nella loro colonna naturale
      allServerItemsMap.forEach(item => {
        item.enabled = !disabledList.has(item.id);
        const originalCol = (config.columns.side && config.columns.side.some(si => si.id === item.id)) ? 'side' : 'main';
        newColumns[originalCol].push(item);
      });

      config.columns = newColumns;
    } else {
      ['main', 'side'].forEach(colKey => {
        (config.columns[colKey] || []).forEach(item => {
          if (disabledList.has(item.id)) {
            item.enabled = false;
          }
        });
      });
    }

    return config;
  },

  /**
   * Salva le preferenze del fantallenatore in localStorage
   */
  saveUserPreferences(columnsOrder, disabledWidgets, userSettings, favoriteTeamId) {
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      favoriteTeamId: favoriteTeamId !== undefined ? favoriteTeamId : this.getFavoriteTeamId(),
      columnsOrder: columnsOrder || {
        main: this.activeConfig.columns.main.map(w => w.id),
        side: this.activeConfig.columns.side.map(w => w.id)
      },
      disabledWidgets: disabledWidgets || [],
      userSettings: userSettings || {
        topFlopDefaultTab: this.activeConfig.defaultSettings.topFlopDefaultTab || 'top',
        quotesMode: this.activeConfig.defaultSettings.quotesMode || 'all',
        gpAccordionOpen: this.activeConfig.defaultSettings.gpAccordionOpen ?? true,
        coppaAccordionOpen: this.activeConfig.defaultSettings.coppaAccordionOpen ?? false
      }
    };

    try {
      this._favIdentifiersCache = null;
      this._favIdentifiersCacheKey = null;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
      this.activeConfig = this.mergeWithUserPreferences(this.serverConfig);
      return true;
    } catch (e) {
      console.error('Impossibile salvare preferenze utente home:', e);
      return false;
    }
  },

  /**
   * Ripristina la configurazione di fabbrica / default di Lega
   */
  resetToDefault() {
    try {
      this._favIdentifiersCache = null;
      this._favIdentifiersCacheKey = null;
      localStorage.removeItem(this.STORAGE_KEY);
      this.activeConfig = JSON.parse(JSON.stringify(this.serverConfig || this.getDefaultConfig()));
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Verifica se è impostata una Squadra del Cuore valida
   */
  hasFavoriteTeam() {
    const favId = this.getFavoriteTeamId();
    return favId !== null && favId !== undefined && favId !== '' && Number(favId) > 0;
  },

  /**
   * Ritorna l'ID della Squadra del Cuore selezionata (o null)
   */
  getFavoriteTeamId() {
    if (this.activeConfig && this.activeConfig.defaultSettings && this.activeConfig.defaultSettings.favoriteTeamId !== undefined) {
      return this.activeConfig.defaultSettings.favoriteTeamId;
    }
    const userPrefs = this.getUserPreferences();
    if (userPrefs && userPrefs.favoriteTeamId !== undefined && userPrefs.favoriteTeamId !== null) {
      return userPrefs.favoriteTeamId;
    }
    return null;
  },

  /**
   * Ritorna il nome della Squadra del Cuore (o stringa vuota)
   */
  getFavoriteTeamName() {
    const favTeam = this.getFavoriteTeam();
    return favTeam ? (favTeam.Nome || favTeam.nome || '') : '';
  },

  /**
   * Ritorna l'oggetto squadra completo per la Squadra del Cuore (o null)
   */
  getFavoriteTeam() {
    const favId = this.getFavoriteTeamId();
    if (!favId) return null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamById === 'function') {
      const t = fcmDataLoader.getTeamById(favId);
      if (t) return t;
    }
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      return arrFantasquadre.find(t => t && t.ID === Number(favId)) || null;
    }
    return null;
  },

  /**
   * Ritorna l'elenco degli sponsor e collegamenti preferiti configurati dall'admin
   */
  getSponsors() {
    if (this.activeConfig && Array.isArray(this.activeConfig.sponsors)) {
      return this.activeConfig.sponsors;
    }
    if (this.serverConfig && Array.isArray(this.serverConfig.sponsors)) {
      return this.serverConfig.sponsors;
    }
    return [];
  },

  _favIdentifiersCache: null,
  _favIdentifiersCacheKey: null,

  /**
   * Raccoglie tutti gli identificatori (ID attuali, IDf storici, nomi attuali e qualsiasi denominazione storica)
   * associati alla Squadra del Cuore mediante matching incrociato dinamico tra arrAdOFantasquadre (fcmAlboDOroDati.js)
   * e gli array storici nella cartella persjs (arrConfronti in fcmConfrontiDati.js, arrAlbum in fcmAlbumDati.js e arrTuttiGiocatori in fcmTuttiGiocatoriDati.js).
   */
  getFavoriteTeamIdentifiers() {
    const favId = this.getFavoriteTeamId();
    if (!favId) return null;

    const arrConfrontiLen = (typeof arrConfronti !== 'undefined' && Array.isArray(arrConfronti)) ? arrConfronti.length : 0;
    const arrAlbumLen = (typeof arrAlbum !== 'undefined' && Array.isArray(arrAlbum)) ? arrAlbum.length : 0;
    const arrTuttiLen = (typeof arrTuttiGiocatori !== 'undefined' && Array.isArray(arrTuttiGiocatori)) ? arrTuttiGiocatori.length : 0;
    const cacheKey = `${favId}_${arrConfrontiLen}_${arrAlbumLen}_${arrTuttiLen}`;

    if (this._favIdentifiersCache && this._favIdentifiersCacheKey === cacheKey) {
      return this._favIdentifiersCache;
    }

    const currentIds = new Set([Number(favId)]);
    const historicalIds = new Set();
    const names = new Set();

    const favTeam = this.getFavoriteTeam();
    if (favTeam) {
      const tName = favTeam.Nome || favTeam.nome || favTeam.name || favTeam.teamName || favTeam.team;
      if (tName) names.add(String(tName).trim().toLowerCase());
      if (favTeam.ID) currentIds.add(Number(favTeam.ID));
      if (favTeam.id) currentIds.add(Number(favTeam.id));
      if (favTeam.currentId) currentIds.add(Number(favTeam.currentId));
      if (favTeam.idAttuale) currentIds.add(Number(favTeam.idAttuale));
      if (favTeam.IDf) historicalIds.add(Number(favTeam.IDf));
      if (favTeam.historicalTeamId) historicalIds.add(Number(favTeam.historicalTeamId));
    }

    // 1. Integrazione con arrAdOFantasquadre (fcmAlboDOroDati.js)
    // Correla IDf (ID storico franchigia) con idAttuale (ID stagione in corso) e denominazione
    let arrAdO = null;
    if (typeof arrAdOFantasquadre !== 'undefined' && Array.isArray(arrAdOFantasquadre)) {
      arrAdO = arrAdOFantasquadre;
    } else if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getAlboDOro === 'function') {
      const albo = fcmDataLoader.getAlboDOro();
      if (albo && albo.teams) arrAdO = albo.teams;
    }

    if (arrAdO && Array.isArray(arrAdO)) {
      for (let i = 0; i < arrAdO.length; i++) {
        const item = arrAdO[i];
        if (!item) continue;
        const idAtt = item.idAttuale !== undefined ? Number(item.idAttuale) : (item.currentId !== undefined ? Number(item.currentId) : 0);
        const idF = item.IDf !== undefined ? Number(item.IDf) : (item.id !== undefined ? Number(item.id) : 0);
        const nm = item.nome || item.Nome || item.name || '';
        const cleanNm = String(nm).trim().toLowerCase();

        // Matching franchigia: corrisponde se combacia l'ID stagione attuale, l'ID storico già noto, oppure il nome attuale
        const matchByIdAtt = (idAtt > 0 && currentIds.has(idAtt));
        const matchByIdF = (idF > 0 && historicalIds.has(idF));
        const matchByName = (cleanNm && names.has(cleanNm));

        if (matchByIdAtt || matchByIdF || matchByName) {
          if (idAtt > 0) currentIds.add(idAtt);
          if (idF > 0) historicalIds.add(idF);
          if (cleanNm) names.add(cleanNm);
        }
      }
    }

    // 2. Matching incrociato dinamico con arrConfronti (persjs/fcmConfrontiDati.js)
    // IDASquadraCasa e IDASquadraFuori corrispondono all'IDf dell'Albo d'Oro
    if (typeof arrConfronti !== 'undefined' && Array.isArray(arrConfronti)) {
      for (let i = 1; i < arrConfronti.length; i++) {
        const c = arrConfronti[i];
        if (!c) continue;
        const idC = Number(c.IDASquadraCasa);
        const idF = Number(c.IDASquadraFuori);
        if (historicalIds.has(idC) && c.SquadraCasa) {
          names.add(String(c.SquadraCasa).trim().toLowerCase());
        }
        if (historicalIds.has(idF) && c.SquadraFuori) {
          names.add(String(c.SquadraFuori).trim().toLowerCase());
        }
      }
    }

    // 3. Matching incrociato dinamico con arrAlbum (persjs/fcmAlbumDati.js)
    // IDSquadraStorica corrisponde all'IDf dell'Albo d'Oro (NON usare IDSquadra locale di stagione!)
    if (typeof arrAlbum !== 'undefined' && Array.isArray(arrAlbum)) {
      for (let a = 1; a < arrAlbum.length; a++) {
        const alb = arrAlbum[a];
        if (!alb) continue;
        const idSqStorica = Number(alb.IDSquadraStorica);
        if (historicalIds.has(idSqStorica) && alb.NomeSquadra) {
          names.add(String(alb.NomeSquadra).trim().toLowerCase());
        }
      }
    }

    // 4. Matching incrociato dinamico con arrTuttiGiocatori (persjs/fcmTuttiGiocatoriDati.js)
    // IDSquadraStorica corrisponde all'IDf dell'Albo d'Oro (NON usare IDSquadra locale di stagione!)
    if (typeof arrTuttiGiocatori !== 'undefined' && Array.isArray(arrTuttiGiocatori)) {
      for (let g = 1; g < arrTuttiGiocatori.length; g++) {
        const tg = arrTuttiGiocatori[g];
        if (!tg) continue;
        const idSqStorica = Number(tg.IDSquadraStorica);
        if (historicalIds.has(idSqStorica) && tg.NomeSquadra) {
          names.add(String(tg.NomeSquadra).trim().toLowerCase());
        }
      }
    }

    const ids = new Set([...currentIds, ...historicalIds]);
    const result = { ids, currentIds, historicalIds, names };
    this._favIdentifiersCache = result;
    this._favIdentifiersCacheKey = cacheKey;
    return result;
  },

  /**
   * Verifica se un ID o Nome squadra corrisponde alla Squadra del Cuore
   * (supporta ID corrente, ID storico IDf, nome attuale e qualsiasi denominazione storica)
   */
  isFavoriteTeam(teamIdOrName) {
    if (teamIdOrName === null || teamIdOrName === undefined || teamIdOrName === '') return false;
    const idents = this.getFavoriteTeamIdentifiers();
    if (!idents) return false;

    // Se l'argomento è un oggetto con proprietà identificative
    if (typeof teamIdOrName === 'object') {
      // 1. Controlla prima ID storico se presente
      const histCandidate = teamIdOrName.historicalTeamId !== undefined ? teamIdOrName.historicalTeamId : teamIdOrName.IDf;
      if (histCandidate !== undefined && histCandidate !== null && histCandidate !== '') {
        const numH = Number(histCandidate);
        if (!isNaN(numH) && numH > 0 && idents.historicalIds.has(numH)) return true;
      }

      // 2. Controlla ID stagione attuale
      const currCandidate = teamIdOrName.idAttuale !== undefined ? teamIdOrName.idAttuale : teamIdOrName.currentId;
      if (currCandidate !== undefined && currCandidate !== null && currCandidate !== '') {
        const numC = Number(currCandidate);
        if (!isNaN(numC) && numC > 0 && idents.currentIds.has(numC)) return true;
      }

      // 3. Altri id candidati generici (id, ID, teamId)
      // Se l'oggetto specifica isCurrent === false, teamId/id appartiene a una stagione passata e non va confrontato con currentIds
      const isExplicitlyHistorical = teamIdOrName.isCurrent === false;
      const genericId = teamIdOrName.id !== undefined ? teamIdOrName.id : (teamIdOrName.ID !== undefined ? teamIdOrName.ID : teamIdOrName.teamId);
      if (genericId !== undefined && genericId !== null && genericId !== '') {
        const numG = Number(genericId);
        if (!isNaN(numG) && numG > 0) {
          if (idents.historicalIds.has(numG)) return true;
          if (!isExplicitlyHistorical && idents.currentIds.has(numG)) return true;
        }
      }

      // 4. Controlla per nome
      const candidateNames = [
        teamIdOrName.Nome,
        teamIdOrName.nome,
        teamIdOrName.name,
        teamIdOrName.teamName,
        teamIdOrName.team
      ];
      for (const cnm of candidateNames) {
        if (cnm && idents.names.has(String(cnm).trim().toLowerCase())) {
          return true;
        }
      }
      return false;
    }

    // Se è un valore numerico o stringa numerica
    const num = Number(teamIdOrName);
    if (!isNaN(num) && num > 0) {
      if (idents.currentIds.has(num) || idents.historicalIds.has(num)) {
        return true;
      }
    }

    // Se è una stringa (o nome squadra)
    const cleanStr = String(teamIdOrName).trim().toLowerCase();
    if (cleanStr && idents.names.has(cleanStr)) {
      return true;
    }

    return false;
  },

  /**
   * Imposta rapidamente la Squadra del Cuore
   */
  setFavoriteTeam(teamId) {
    this._favIdentifiersCache = null;
    this._favIdentifiersCacheKey = null;
    const userPrefs = this.getUserPreferences() || {};
    userPrefs.favoriteTeamId = teamId ? parseInt(teamId, 10) : null;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userPrefs));
      if (this.activeConfig && this.activeConfig.defaultSettings) {
        this.activeConfig.defaultSettings.favoriteTeamId = userPrefs.favoriteTeamId;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Recupera la definizione completa di un widget (standard o custom)
   */
  getWidgetInfo(id) {
    if (this.standardWidgets[id]) {
      return { ...this.standardWidgets[id], isCustom: false };
    }
    // Cerca nei custom widget caricati dal server
    if (this.serverConfig && Array.isArray(this.serverConfig.customWidgets)) {
      const custom = this.serverConfig.customWidgets.find(w => w.id === id);
      if (custom) {
        return {
          id: custom.id,
          title: custom.title || 'Widget Personalizzato',
          column: custom.column || 'main',
          isCustom: true,
          iconSvg: this.getCustomWidgetIcon(custom),
          data: custom
        };
      }
    }
    return null;
  },

  /**
   * Genera un'icona SVG coerente per un widget personalizzato
   */
  getCustomWidgetIcon(custom) {
    const type = custom.type || 'banner';
    switch (type) {
      case 'banner':
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
      case 'button_card':
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
      case 'countdown':
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      case 'image':
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple, #a855f7)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
      case 'table':
      case 'competition_standings':
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>';
      default:
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"></rect><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
    }
  },

  _customCountdownIntervals: [],

  clearCustomCountdowns() {
    if (Array.isArray(this._customCountdownIntervals)) {
      this._customCountdownIntervals.forEach(id => clearInterval(id));
      this._customCountdownIntervals = [];
    }
  },

  sanitizeUrl(url, allowHash = true) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const compact = raw.replace(/[\u0000-\u0020]+/g, '');
    if (/^(javascript|vbscript|data):/i.test(compact)) return '';
    if (/^[/\\]{2}/.test(compact)) return '';
    if (compact.startsWith('#')) return allowHash ? raw : '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(compact)) {
      return /^https?:/i.test(compact) ? raw : '';
    }
    return raw;
  },

  /**
   * Rendering HTML sicuro per un widget personalizzato creato dall'amministratore
   */
  renderCustomWidget(custom, context) {
    if (!custom || !custom.enabled) return '';

    // Controllo data di scadenza (auto-archiviazione)
    if (custom.expiresAt) {
      const expTime = new Date(custom.expiresAt).getTime();
      if (!isNaN(expTime) && Date.now() > expTime) {
        return '';
      }
    }

    // Controllo visibilità temporale (Sempre vs Pre-partita vs In corso)
    if (custom.visibility === 'in_progress' && context && !context.isMatchdayInProgress) return '';
    if (custom.visibility === 'not_in_progress' && context && context.isMatchdayInProgress) return '';

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const badgeColor = custom.badgeColor || 'primary';
    const badgeHtml = custom.badge ? `<span class="badge badge-${badgeColor}">${escapeHtml(custom.badge)}</span>` : '';
    const iconSvg = this.getCustomWidgetIcon(custom);
    const safeBtnLink = this.sanitizeUrl(custom.btnLink, true);
    const safeLink = this.sanitizeUrl(custom.link, true);
    const safeImageUrl = this.sanitizeUrl(custom.imageUrl, false);

    switch (custom.type) {
      case 'banner':
      default:
        return `
          <div class="card custom-widget-card custom-banner-card" id="${escapeHtml(custom.id)}">
            <div class="card-header">
              <div class="card-title">
                ${iconSvg}
                <span>${escapeHtml(custom.title)}</span>
              </div>
              ${badgeHtml}
            </div>
            <div class="custom-widget-body" style="font-size:0.92rem;line-height:1.5;color:var(--text-secondary);margin-top:6px;">
              ${custom.contentHtml || escapeHtml(custom.content || '')}
            </div>
            ${custom.btnText && safeBtnLink ? `
              <div style="margin-top:14px;">
                <a href="${escapeHtml(safeBtnLink)}" target="${escapeHtml(custom.btnTarget || '_self')}" class="btn-primary" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:0.85rem;text-decoration:none;font-weight:600;">
                  ${escapeHtml(custom.btnText)}
                </a>
              </div>
            ` : ''}
          </div>
        `;

      case 'button_card':
        return `
          <div class="card custom-widget-card custom-button-card" id="${escapeHtml(custom.id)}">
            <div class="card-header">
              <div class="card-title">
                ${iconSvg}
                <span>${escapeHtml(custom.title)}</span>
              </div>
              ${badgeHtml}
            </div>
            ${custom.description ? `<p style="font-size:0.85rem;color:var(--text-secondary);margin:8px 0 14px 0;line-height:1.4;">${escapeHtml(custom.description)}</p>` : ''}
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
              <a href="${escapeHtml(safeBtnLink || '#')}" target="${escapeHtml(custom.btnTarget || '_blank')}" rel="noopener noreferrer" class="btn-primary" style="width:100%;justify-content:center;padding:10px 16px;border-radius:10px;font-weight:700;display:flex;align-items:center;gap:8px;text-decoration:none;">
                <span>${escapeHtml(custom.btnText || 'Apri Collegamento')}</span>
                &rarr;
              </a>
            </div>
          </div>
        `;

      case 'countdown':
        return `
          <div class="card custom-widget-card custom-countdown-card" id="${escapeHtml(custom.id)}">
            <div class="card-header">
              <div class="card-title">
                ${iconSvg}
                <span>${escapeHtml(custom.title)}</span>
              </div>
              ${badgeHtml}
            </div>
            ${custom.subtitle ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">${escapeHtml(custom.subtitle)}</div>` : ''}
            <div class="countdown-box custom-cd-box" data-target-date="${escapeHtml(custom.targetDate)}" style="margin-top:4px;padding:12px;background:var(--bg-surface-elevated);border-radius:10px;">
              <div class="cd-timer" style="margin-bottom:6px;">
                <div class="cd-unit"><div class="cd-digit cd-custom-d">--</div><span class="cd-label">Giorni</span></div>
                <div class="cd-separator">:</div>
                <div class="cd-unit"><div class="cd-digit cd-custom-h">--</div><span class="cd-label">Ore</span></div>
                <div class="cd-separator">:</div>
                <div class="cd-unit"><div class="cd-digit cd-custom-m">--</div><span class="cd-label">Min</span></div>
                <div class="cd-separator">:</div>
                <div class="cd-unit"><div class="cd-digit cd-custom-s">--</div><span class="cd-label">Sec</span></div>
              </div>
              <div class="cd-deadline-text" style="font-size:0.78rem;color:var(--text-muted);text-align:center;">
                Scadenza: <strong>${custom.targetDate ? new Date(custom.targetDate).toLocaleString('it-IT') : '--'}</strong>
              </div>
            </div>
            ${custom.btnText && safeBtnLink ? `
              <div style="margin-top:12px;text-align:center;">
                <a href="${escapeHtml(safeBtnLink)}" class="badge badge-primary" style="padding:6px 14px;font-size:0.82rem;">${escapeHtml(custom.btnText)} &rarr;</a>
              </div>
            ` : ''}
          </div>
        `;

      case 'image':
        return `
          <div class="card custom-widget-card custom-image-card" id="${escapeHtml(custom.id)}">
            <div class="card-header">
              <div class="card-title">
                ${iconSvg}
                <span>${escapeHtml(custom.title)}</span>
              </div>
              ${badgeHtml}
            </div>
            <div style="margin-top:10px;border-radius:8px;overflow:hidden;border:1px solid var(--border-subtle);">
              ${safeLink ? `<a href="${escapeHtml(safeLink)}" target="${escapeHtml(custom.target || '_blank')}" rel="noopener noreferrer">` : ''}
                ${safeImageUrl ? `<img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(custom.title)}" style="width:100%;height:auto;display:block;object-fit:cover;max-height:360px;" onerror="this.style.display='none'" />` : ''}
              ${safeLink ? `</a>` : ''}
            </div>
            ${custom.caption ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;text-align:center;">${escapeHtml(custom.caption)}</div>` : ''}
          </div>
        `;

      case 'embed':
        return `
          <div class="card custom-widget-card custom-embed-card" id="${escapeHtml(custom.id)}">
            <div class="card-header">
              <div class="card-title">
                ${iconSvg}
                <span>${escapeHtml(custom.title)}</span>
              </div>
              ${badgeHtml}
            </div>
            <div class="custom-embed-wrap" style="margin-top:10px;border-radius:8px;overflow:hidden;">
              ${custom.embedHtml || ''}
            </div>
          </div>
        `;

      case 'competition_standings':
        return this.renderCompetitionStandingsWidget(custom, context);
    }
  },

  /**
   * Analizza la struttura di una competizione (gironi e partite) per rilevarne la formula
   */
  detectCompetitionFormat(compIdOrObj) {
    if (typeof fcmDataLoader === 'undefined') {
      return { format: 'round_robin', label: 'Girone all\'italiana', roundRobinGroups: [], knockoutMatches: [], allGroups: [], allMatches: [] };
    }
    const comps = fcmDataLoader.getCompetitions ? fcmDataLoader.getCompetitions() : [];
    const comp = (compIdOrObj && typeof compIdOrObj === 'object')
      ? compIdOrObj
      : comps.find(c => String(c.id) === String(compIdOrObj));
    if (!comp) {
      return { format: 'round_robin', label: 'Non trovata', roundRobinGroups: [], knockoutMatches: [], allGroups: [], allMatches: [] };
    }
    const calendar = fcmDataLoader.getCalendarData ? fcmDataLoader.getCalendarData() : { matches: [] };
    const allGroups = Array.isArray(comp.groups) ? comp.groups : [];
    const allMatches = (calendar && Array.isArray(calendar.matches))
      ? calendar.matches.filter(m => String(m.compId) === String(comp.id) && !m.isRiposo)
      : [];

    let roundRobinGroups = allGroups.filter(g => {
      const gName = String(g.Nome || '').toLowerCase();
      const st = fcmDataLoader.getStandings ? fcmDataLoader.getStandings(g.ID) : [];
      return gName.includes('girone') || st.length > 2;
    });

    // Se c'è un solo girone con 2 squadre ma giocano più di 2 partite (mini-campionato), è comunque round_robin
    if (roundRobinGroups.length === 0 && allGroups.length === 1) {
      const st = fcmDataLoader.getStandings ? fcmDataLoader.getStandings(allGroups[0].ID) : [];
      if (st.length > 0 && allMatches.length > 2) {
        roundRobinGroups = [allGroups[0]];
      }
    }

    const knockoutMatches = allMatches.filter(m => !roundRobinGroups.some(g => g.ID === m.groupId));
    let format = 'round_robin';
    let label = 'Girone all\'italiana';

    if (roundRobinGroups.length > 0 && knockoutMatches.length > 0) {
      format = 'hybrid';
      label = `Ibrida (${roundRobinGroups.length} giron${roundRobinGroups.length === 1 ? 'e' : 'i'} + Scontri diretti)`;
    } else if (roundRobinGroups.length === 0 && (knockoutMatches.length > 0 || allMatches.length > 0)) {
      format = 'knockout';
      label = `Scontri diretti (${(knockoutMatches.length || allMatches.length)} incontr${(knockoutMatches.length || allMatches.length) === 1 ? 'o' : 'i'})`;
    } else {
      const gCount = roundRobinGroups.length || allGroups.length;
      label = `Girone all'italiana (${gCount} giron${gCount === 1 ? 'e' : 'i'})`;
    }

    return { comp, format, label, roundRobinGroups, knockoutMatches, allGroups, allMatches };
  },

  /**
   * Renderizza un widget di Classifica / Tabellone Competizione (supporta round_robin, knockout, hybrid, gp, auto)
   */
  renderCompetitionStandingsWidget(custom, context) {
    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    if (typeof fcmDataLoader === 'undefined') return '';

    const comps = fcmDataLoader.getCompetitions ? fcmDataLoader.getCompetitions() : [];
    const targetCompId = (custom.compId !== undefined && custom.compId !== null && custom.compId !== '') ? custom.compId : null;
    let comp = targetCompId ? comps.find(c => String(c.id) === String(targetCompId)) : null;
    if (!comp && custom.compName) {
      comp = comps.find(c => String(c.name || '').toLowerCase() === String(custom.compName || '').toLowerCase());
    }
    if (!comp && comps.length > 0) {
      comp = comps[0];
    }

    if (!comp) {
      return `
        <div class="card custom-widget-card" id="${escapeHtml(custom.id || '')}">
          <div class="card-header">
            <div class="card-title">${this.getCustomWidgetIcon({ type: 'competition_standings' })} <span>${escapeHtml(custom.title || 'Competizione')}</span></div>
          </div>
          <div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.82rem;">
            Competizione non trovata nei dati di lega.
          </div>
        </div>
      `;
    }

    const calendar = (context && context.calendar) || (fcmDataLoader.getCalendarData ? fcmDataLoader.getCalendarData() : { matches: [], nextMatchday: 1 });
    const favoriteTeamId = (context && context.favoriteTeamId !== undefined) ? context.favoriteTeamId : this.getFavoriteTeamId();
    const isEditMode = !!(context && context.isEditMode);
    const detected = this.detectCompetitionFormat(comp);
    const chosenFormat = (custom.compFormat && custom.compFormat !== 'auto') ? custom.compFormat : detected.format;
    const accordionMode = custom.accordionMode || 'static';
    const isAccordion = accordionMode === 'open' || accordionMode === 'closed';
    const isOpen = accordionMode !== 'closed';
    const widgetTitle = custom.title || comp.name || 'Competizione';
    const logoHtml = (typeof fcmDataLoader.getCompetitionLogoHtml === 'function')
      ? fcmDataLoader.getCompetitionLogoHtml(comp.name, comp.id, 20)
      : this.getCustomWidgetIcon({ type: 'competition_standings' });

    // Caso 1: Classifica GP (Somma Punti Totali)
    if (chosenFormat === 'gp') {
      const targetGroups = (detected.allGroups && detected.allGroups.length > 0)
        ? detected.allGroups
        : [{ ID: comp.defaultGroupId || 1, Nome: comp.name }];
      const gpGroupsData = targetGroups.map(g => ({
        group: g,
        standings: fcmDataLoader.getGPStandings ? fcmDataLoader.getGPStandings(g.ID) : []
      })).filter(d => d.standings && d.standings.length > 0);

      const gpBodyHtml = gpGroupsData.length > 0 ? gpGroupsData.map((d, gIdx) => `
        <div class="coppa-group-section" style="${gIdx > 0 ? 'margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);' : ''}">
          ${gpGroupsData.length > 1 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(d.group.Nome)}</span>
              <span style="font-size: 0.68rem; color: var(--text-muted);">${d.standings.length} squadre</span>
            </div>
          ` : ''}
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
                ${d.standings.map((s, idx) => {
                  const isFav = favoriteTeamId && (s.teamId == favoriteTeamId || s.name == favoriteTeamId);
                  return `
                    <tr class="${isFav ? 'favorite-team-row' : ''}">
                      <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${idx + 1}</td>
                      <td>
                        <div class="table-col-team">
                          <a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${escapeHtml(s.name)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                          ${isFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                          ${isEditMode ? `<button type="button" class="btn-tap-to-star ${isFav ? 'is-fav' : ''}" data-team-id="${s.teamId || ''}" data-team-name="${escapeHtml(s.name)}" title="Imposta come squadra del cuore">${isFav ? '⭐' : '☆'}</button>` : ''}
                          <span><a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(s.name)}</a></span>
                        </div>
                      </td>
                      <td class="text-right table-pts" style="color:var(--accent-cyan);font-weight:800;">${(s.sommaTotali || 0).toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('') : `<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.8rem;">Nessun dato GP disponibile per questa competizione.</div>`;

      return `
        <div class="card custom-widget-card custom-comp-card" id="${escapeHtml(custom.id || '')}">
          <div class="card-header ${isAccordion ? 'comp-widget-accordion-header' : ''}" style="${isAccordion ? 'cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;' : ''}">
            <div class="card-title" style="font-size: 0.95rem;">
              ${logoHtml}
              <span>${escapeHtml(widgetTitle)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <a href="#classifica?comp=${comp.id}" class="badge badge-primary" style="font-size: 0.68rem;" onclick="event.stopPropagation();">Completa &rarr;</a>
              ${isAccordion ? `<span class="badge badge-primary comp-widget-toggle-badge" style="font-size: 0.68rem;">${isOpen ? 'Chiudi ▲' : 'Apri ▼'}</span>` : ''}
            </div>
          </div>
          <div class="comp-widget-body" style="display: ${isOpen ? 'block' : 'none'}; ${isAccordion ? 'padding-top: 10px;' : ''}">
            ${gpBodyHtml}
          </div>
        </div>
      `;
    }

    // Caso 2: Gironi all'italiana, Scontri diretti o Ibrida
    const groupsSource = (chosenFormat === 'round_robin')
      ? (detected.allGroups.length > 0 ? detected.allGroups : [{ ID: comp.defaultGroupId || 1, Nome: comp.name }])
      : detected.roundRobinGroups;

    const groupsData = groupsSource.map(g => {
      const gMatches = detected.allMatches.filter(m => m.groupId === g.ID);
      const playedCount = gMatches.filter(m => m.played).length;
      const totalCount = gMatches.length;
      const minDay = gMatches.length ? Math.min(...gMatches.map(m => m.serieADay)) : 999;
      const maxDay = gMatches.length ? Math.max(...gMatches.map(m => m.serieADay)) : 0;
      const inProgress = (playedCount > 0 && playedCount < totalCount) ||
        (calendar.nextMatchday >= minDay && calendar.nextMatchday <= maxDay && playedCount < totalCount);
      return {
        group: g,
        standings: fcmDataLoader.getStandings ? fcmDataLoader.getStandings(g.ID) : [],
        inProgress
      };
    }).filter(d => d.standings && d.standings.length > 0);

    const activeGroups = groupsData.some(d => d.inProgress)
      ? groupsData.filter(d => d.inProgress)
      : groupsData;

    const koMatchesPool = (chosenFormat === 'knockout' && detected.knockoutMatches.length === 0)
      ? detected.allMatches
      : detected.knockoutMatches;

    let upcomingKnockoutMatches = [];
    if (koMatchesPool.length > 0) {
      const unplayedKo = koMatchesPool.filter(m => !m.played);
      if (unplayedKo.length > 0) {
        const nextTargetDay = Math.min(...unplayedKo.map(m => m.serieADay));
        upcomingKnockoutMatches = unplayedKo.filter(m => m.serieADay === nextTargetDay);
      } else {
        const lastTargetDay = Math.max(...koMatchesPool.map(m => m.serieADay));
        upcomingKnockoutMatches = koMatchesPool.filter(m => m.serieADay === lastTargetDay);
      }
    }

    const leagueTeams = fcmDataLoader.getTeams ? fcmDataLoader.getTeams() : [];
    const realTeamNames = new Set(
      leagueTeams.map(t => (t.Nome || t.name || '').trim().toLowerCase()).filter(Boolean)
    );
    const isPlaceholderTeam = (name) => {
      if (!name || typeof name !== 'string') return true;
      const trimmed = name.trim();
      if (!trimmed) return true;
      if (/^\d+[\^°aoe]?\s+(girone|classificat[ao]|quarto|semi|finale)/i.test(trimmed)) return true;
      if (/^(quarto|semifinale|finale|vincente|perdente)\b/i.test(trimmed)) return true;
      if (/\bgirone\s+[a-z0-9]/i.test(trimmed)) return true;
      if (realTeamNames.size > 0 && !realTeamNames.has(trimmed.toLowerCase())) return true;
      return false;
    };

    const groupMatches = detected.allMatches.filter(m => groupsSource.some(g => g.ID === m.groupId));
    const hasUnplayedGroupMatches = groupsData.length > 0 && groupMatches.some(m => !m.played);
    const hasKoPlayed = koMatchesPool.some(m => m.played);
    const areKoPopulated = upcomingKnockoutMatches.length > 0 &&
      upcomingKnockoutMatches.every(m => !isPlaceholderTeam(m.homeTeamName) && !isPlaceholderTeam(m.awayTeamName));

    let showKnockoutPanel = false;
    let showGroupsPanel = false;
    let defaultTab = 'groups';

    if (chosenFormat === 'round_robin') {
      showGroupsPanel = true;
      defaultTab = 'groups';
    } else if (chosenFormat === 'knockout') {
      showKnockoutPanel = true;
      defaultTab = 'knockout';
    } else if (chosenFormat === 'hybrid') {
      showGroupsPanel = activeGroups.length > 0;
      showKnockoutPanel = koMatchesPool.length > 0;
      if (!showGroupsPanel && !showKnockoutPanel) showGroupsPanel = true;
      const koReady = showKnockoutPanel && !hasUnplayedGroupMatches && (hasKoPlayed || areKoPopulated);
      defaultTab = koReady ? 'knockout' : (showGroupsPanel ? 'groups' : 'knockout');
    } else {
      // auto
      const koReady = koMatchesPool.length > 0 && !hasUnplayedGroupMatches && (hasKoPlayed || areKoPopulated);
      showGroupsPanel = activeGroups.length > 0;
      showKnockoutPanel = koReady || (!showGroupsPanel && koMatchesPool.length > 0);
      defaultTab = showKnockoutPanel ? 'knockout' : 'groups';
    }

    const knockoutHtml = upcomingKnockoutMatches.length > 0 ? `
      <div class="matches-list" style="margin-top: 4px;">
        ${upcomingKnockoutMatches.map(m => {
          const isHomeFav = favoriteTeamId && (m.homeTeamId == favoriteTeamId || m.homeTeamName == favoriteTeamId);
          const isAwayFav = favoriteTeamId && (m.awayTeamId == favoriteTeamId || m.awayTeamName == favoriteTeamId);
          const isMatchFav = isHomeFav || isAwayFav;
          const trophiesHome = fcmDataLoader.getTeamTrophiesHtml ? fcmDataLoader.getTeamTrophiesHtml(m.homeTeamName) : '';
          const trophiesAway = fcmDataLoader.getTeamTrophiesHtml ? fcmDataLoader.getTeamTrophiesHtml(m.awayTeamName) : '';
          return `
            <div class="coppa-knockout-match ${isMatchFav ? 'is-favorite-match favorite-team-row' : ''}">
              <div class="coppa-match-header">
                <span>${escapeHtml(m.groupName || comp.name)}</span>
                <span class="coppa-match-day-badge">${escapeHtml(m.fantagiornataNome || `${m.serieADay}ª Serie A`)}</span>
              </div>
              <div class="match-teams-row" style="gap: 4px;">
                <div class="match-team home">
                  <a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(m.homeTeamName || m.homeTeamId)}" class="team-badge-img" style="width: 22px; height: 22px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div class="team-info-wrap">
                    <div class="team-name-row">
                      ${isHomeFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                      <span class="team-name-text" style="font-size: 0.78rem;" title="${escapeHtml(m.homeTeamName)}"><a href="#rose?team=${encodeURIComponent(m.homeTeamId || m.homeTeamName)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(m.homeTeamName)}</a></span>
                    </div>
                    ${trophiesHome ? `<span class="team-trophies-badge">${trophiesHome}</span>` : ''}
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
                      <span class="team-name-text" style="font-size: 0.78rem;" title="${escapeHtml(m.awayTeamName)}"><a href="#rose?team=${encodeURIComponent(m.awayTeamId || m.awayTeamName)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(m.awayTeamName)}</a></span>
                    </div>
                    ${trophiesAway ? `<span class="team-trophies-badge">${trophiesAway}</span>` : ''}
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

    const groupsHtml = activeGroups.length > 0 ? `
      <div class="coppa-groups-list">
        ${activeGroups.map((d, gIdx) => `
          <div class="coppa-group-section" style="${gIdx > 0 ? 'margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);' : ''}">
            ${(activeGroups.length > 1 || showKnockoutPanel) ? `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-purple, #a855f7); text-transform: uppercase; letter-spacing: 0.5px;">
                  ${escapeHtml(d.group.Nome)}
                </span>
                <span style="font-size: 0.68rem; color: var(--text-muted);">
                  ${d.standings.length} squadre
                </span>
              </div>
            ` : ''}
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
                    const trophies = fcmDataLoader.getTeamTrophiesHtml ? fcmDataLoader.getTeamTrophiesHtml(s.name) : '';
                    return `
                      <tr class="${isFav ? 'favorite-team-row' : ''}">
                        <td class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${s.pos || (idx + 1)}</td>
                        <td>
                          <div class="table-col-team">
                            <a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${escapeHtml(s.name)}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                            ${isFav ? '<span class="favorite-team-badge" title="La tua Squadra del Cuore">⭐</span>' : ''}
                            ${isEditMode ? `<button type="button" class="btn-tap-to-star ${isFav ? 'is-fav' : ''}" data-team-id="${s.teamId || ''}" data-team-name="${escapeHtml(s.name)}" title="Imposta come squadra del cuore">${isFav ? '⭐' : '☆'}</button>` : ''}
                            <span><a href="#rose?team=${encodeURIComponent(s.teamId || s.name)}" class="team-rose-link" title="Vai alla rosa">${escapeHtml(s.name)}</a></span>
                            ${trophies}
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
        Nessuna classifica a gironi disponibile per questa competizione.
      </div>
    `;

    return `
      <div class="card custom-widget-card custom-comp-card" id="${escapeHtml(custom.id || '')}">
        <div class="card-header ${isAccordion ? 'comp-widget-accordion-header' : ''}" style="${isAccordion ? 'cursor: pointer; user-select: none; margin-bottom: 0; padding-bottom: 4px;' : ''}">
          <div class="card-title" style="font-size: 0.95rem;">
            ${logoHtml}
            <span>${escapeHtml(widgetTitle)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <a href="#classifica?comp=${comp.id}" class="badge badge-primary" style="font-size: 0.68rem;" onclick="event.stopPropagation();">Completa &rarr;</a>
            ${isAccordion ? `<span class="badge badge-primary comp-widget-toggle-badge" style="font-size: 0.68rem;">${isOpen ? 'Chiudi ▲' : 'Apri ▼'}</span>` : ''}
          </div>
        </div>
        <div class="comp-widget-body" style="display: ${isOpen ? 'block' : 'none'}; ${isAccordion ? 'padding-top: 10px;' : ''}">
          ${(showKnockoutPanel && showGroupsPanel) ? `
            <div class="coppa-phase-tabs-container" style="display:flex;justify-content:center;margin-bottom:12px;">
              <div class="coppa-phase-tabs">
                <button type="button" class="coppa-phase-btn comp-phase-tab-btn ${defaultTab === 'knockout' ? 'active' : ''}" data-phase-target="knockout">
                  Scontri Diretti
                </button>
                <button type="button" class="coppa-phase-btn comp-phase-tab-btn ${defaultTab === 'groups' ? 'active' : ''}" data-phase-target="groups">
                  Classifica Gironi
                </button>
              </div>
            </div>
          ` : ''}
          ${showKnockoutPanel ? `
            <div class="comp-phase-panel" data-phase-panel="knockout" style="display: ${defaultTab === 'knockout' ? 'block' : 'none'};">
              ${knockoutHtml}
            </div>
          ` : ''}
          ${showGroupsPanel ? `
            <div class="comp-phase-panel" data-phase-panel="groups" style="display: ${defaultTab === 'groups' ? 'block' : 'none'};">
              ${groupsHtml}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Inizializza l'interattività (fisarmonica e switch tab gironi/scontri diretti) per i widget competizione
   */
  initCustomCompetitionWidgets(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return;

    container.querySelectorAll('.comp-widget-accordion-header').forEach(header => {
      if (header.dataset.boundCompAcc === '1') return;
      header.dataset.boundCompAcc = '1';
      header.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('a')) return;
        const card = header.closest('.card');
        if (!card) return;
        const body = card.querySelector('.comp-widget-body');
        const badge = header.querySelector('.comp-widget-toggle-badge');
        if (body) {
          const isHidden = body.style.display === 'none';
          body.style.display = isHidden ? 'block' : 'none';
          if (badge) {
            badge.textContent = isHidden ? 'Chiudi ▲' : 'Apri ▼';
          }
        }
      });
    });

    container.querySelectorAll('.comp-phase-tab-btn').forEach(btn => {
      if (btn.dataset.boundCompTab === '1') return;
      btn.dataset.boundCompTab = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-phase-target');
        const card = btn.closest('.card');
        if (!card || !target) return;
        card.querySelectorAll('.comp-phase-tab-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-phase-target') === target);
        });
        card.querySelectorAll('.comp-phase-panel').forEach(panel => {
          panel.style.display = (panel.getAttribute('data-phase-panel') === target) ? 'block' : 'none';
        });
      });
    });
  },

  /**
   * Inizializza i timer per i widget personalizzati di tipo countdown
   */
  initCustomCountdowns(container) {
    this.clearCustomCountdowns();
    if (!container || typeof container.querySelectorAll !== 'function') return;
    const cdBoxes = container.querySelectorAll('.custom-cd-box');
    cdBoxes.forEach(box => {
      const targetStr = box.getAttribute('data-target-date');
      if (!targetStr) return;
      const targetTime = new Date(targetStr).getTime();
      if (isNaN(targetTime)) return;

      const dEl = box.querySelector('.cd-custom-d');
      const hEl = box.querySelector('.cd-custom-h');
      const mEl = box.querySelector('.cd-custom-m');
      const sEl = box.querySelector('.cd-custom-s');
      if (!dEl || !hEl || !mEl || !sEl) return;

      const update = () => {
        const diff = targetTime - Date.now();
        if (diff <= 0) {
          dEl.textContent = '00';
          hEl.textContent = '00';
          mEl.textContent = '00';
          sEl.textContent = '00';
          return;
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        dEl.textContent = String(d).padStart(2, '0');
        hEl.textContent = String(h).padStart(2, '0');
        mEl.textContent = String(m).padStart(2, '0');
        sEl.textContent = String(s).padStart(2, '0');
      };
      update();
      const timerId = setInterval(update, 1000);
      this._customCountdownIntervals.push(timerId);
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = fcmHomeConfigManager;
}
