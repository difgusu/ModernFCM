/**
 * APP CONTROLLER & SPA ROUTER
 * ModernFCM
 */

const App = {
  // Viste native SPA
  routes: {
    '#home': homeView,
    '#classifica': classificaView,
    '#calendario': calendarioView,
    '#rose': roseView,
    '#formazioni': formazioniView,
    '#risultati': risultatiView,
    '#statistiche': statisticheView,
    '#albo': alboView,
    '#almanacco': almanaccoView,
    '#topflop': topFlopView,
    '#rating': ratingView,
    '#album': albumView,
    '#topcosti': topCostiView,
    '#topcostistagione': topCostiView,
    '#confronti': confrontiStoriciView,
    '#recordstorici': recordStoriciView,
    '#schede_giocatori': schedeGiocatoriView,
    '#schedagiocatori': schedeGiocatoriView,
    '#ranking': rankingView,
    '#rankingdivisioni': rankingDivisioniView,
    '#registri': registriView,
    '#fantamassimi': fantaMassimiView,
    '#fantaMassimi': fantaMassimiView,
    '#fantaclassifica': fantaClassificaView,
    '#fantaClassifica': fantaClassificaView,
    '#indisponibili': indisponibiliView,
    '#indisponibili_covid': indisponibiliView,
    '#indisponibili_check': indisponibiliView,
    '#records': recordsView,
    '#fantam': fantamView,
    '#live': liveVotiView,
    '#liveFP': liveVotiView,
    '#liveFM': liveVotiView,
    '#liveVU': liveVotiView,
    '#liveFG': liveVotiView,
    '#calcolo': calcoloView,
    '#impostazioni_calcolo': calcoloView,
    '#impostazioni-calcolo': calcoloView,
    '#storico': sectionsView,
    '#extra': sectionsView
  },

  // Pagine esterne/standalone integrate nella SPA (mantengono header, menu e drawer)
  embeddedPages: {
    '#invform': { file: 'invform.php', title: 'Invio Formazione' },
    '#invform_prec': { file: 'invform_prec.php', title: 'Invio Formazione Admin' },
    '#mercato': { file: 'mercato/index.php', title: 'Mercato Libero' },
    '#mercato_admin': { file: 'mercato/admin.php', title: 'Gestione Mercato' },
    '#gbook': { file: 'gbook182/gbook.php', title: 'Guestbook di Lega' },
    '#stats': { file: 'fkounter5/stats.php?id=index', title: 'Statistiche Visite' },
    '#counter': { file: 'fkounter5/stats.php?id=index', title: 'Statistiche Visite' },
  },

  currentRoute: '#home',

  init() {
    this.appContainer = document.getElementById('appContent');
    this.drawer = document.getElementById('drawer-menu') || document.getElementById('drawerMenu');
    this.drawerBackdrop = document.getElementById('drawerBackdrop');

    // Init theme
    this.initTheme();

    // Init header info from FCM
    this.initHeaderInfo();

    // Aggiornamento dinamico pulsante footer mobile (Invio Formazione / Live / Calendario)
    this.updateBottomNav();

    // Listen to hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Init drawer listeners
    this.initDrawer();

    // Init quick menu dropdown listeners
    this.initQuickMenu();

    // Reset default matchdays on menu clicks
    this.initNavDefaultResetListeners();

    // Listen to messages from child frames (e.g. scroll to modal, auto-resize)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'pn_scroll_to_modal') {
        const iframe = document.getElementById('spaEmbeddedFrame');
        if (iframe) {
          const rect = iframe.getBoundingClientRect();
          const offset = (e.data.offset !== undefined) ? e.data.offset : (e.data.targetTop || 0);
          const targetY = window.pageYOffset + rect.top + offset;
          window.scrollTo({ top: Math.max(0, targetY - 40), behavior: 'smooth' });
        }
      } else if (e.data && (e.data.type === 'pn_iframe_resize' || e.data.type === 'resize')) {
        this.adjustCurrentFrameHeight(false, e.data.minHeight);
      }
    });

    // Riadatta l'iframe al ridimensionamento della finestra del browser
    window.addEventListener('resize', () => {
      if (document.getElementById('spaEmbeddedFrame')) {
        this.adjustCurrentFrameHeight();
      }
    });

    // Load initial route
    this.handleRoute();
  },

  currentThemePreference: 'system',

  getEffectiveTheme(preference) {
    if (preference === 'light' || preference === 'dark') {
      return preference;
    }
    // preference === 'system' o non impostato: rileva la modalità del dispositivo
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  setTheme(preference, save = true) {
    if (preference !== 'light' && preference !== 'dark' && preference !== 'system') {
      preference = 'system';
    }
    this.currentThemePreference = preference;

    if (save) {
      try {
        localStorage.setItem('pn_theme', preference);
      } catch (e) { }
    }

    const effectiveTheme = this.getEffectiveTheme(preference);
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-theme-preference', preference);
    document.cookie = `pn_theme=${effectiveTheme};path=/;max-age=31536000;SameSite=Lax`;

    // Aggiorna meta theme-color per browser mobili
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = effectiveTheme === 'dark' ? '#0b1120' : '#0284c7';
    }

    // Aggiorna pulsanti del selettore segmentato nel drawer
    const segButtons = document.querySelectorAll('.theme-seg-btn');
    segButtons.forEach(btn => {
      const val = btn.getAttribute('data-theme-val');
      const isActive = val === preference;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // Aggiorna istantaneamente il badge grafico del contatore fanKounter
    const counterImg = document.getElementById('visitorCounterImg');
    if (counterImg) {
      counterImg.src = `fkounter5/counter.php?id=index&mode=graphic&theme=${effectiveTheme}&_t=${Date.now()}`;
    }

    // Sincronizza istantaneamente anche l'eventuale iframe attivo
    const iframe = document.getElementById('spaEmbeddedFrame');
    if (iframe) {
      if (iframe.contentDocument && iframe.contentDocument.documentElement) {
        iframe.contentDocument.documentElement.setAttribute('data-theme', effectiveTheme);
      }
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: 'pn_theme_change', theme: effectiveTheme, preference: preference }, '*');
        } catch (err) { }
      }
    }
  },

  initTheme() {
    let savedPref = 'system';
    try {
      savedPref = localStorage.getItem('pn_theme') || (typeof DefaultTheme !== 'undefined' ? DefaultTheme : 'system');
    } catch (e) { }

    // Applica subito il tema memorizzato (o sistema)
    this.setTheme(savedPref, false);

    // Gestione click sui pulsanti di scelta tema nel drawer
    const segButtons = document.querySelectorAll('.theme-seg-btn');
    segButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const val = btn.getAttribute('data-theme-val');
        if (val) {
          this.setTheme(val, true);
        }
      });
    });

    // Listener reattivo al cambio tema del sistema operativo in tempo reale
    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        if (this.currentThemePreference === 'system') {
          this.setTheme('system', false);
        }
      };
      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
      }
    }

    // Sincronizzazione automatica tra schede diverse del browser
    window.addEventListener('storage', (e) => {
      if (e.key === 'pn_theme') {
        const newPref = e.newValue || 'system';
        this.setTheme(newPref, false);
      }
    });
  },

  initHeaderInfo() {
    const info = fcmDataLoader.getLeagueInfo();
    const leagueName = info.name || 'ModernFCM';
    const seasonText = `${info.season}ª edizione - Stagione ${info.year}`;

    document.title = `${leagueName} - ${seasonText}`;

    const brandEl = document.querySelector('.brand-name');
    if (brandEl) {
      brandEl.textContent = leagueName;
    }

    const drawerTitleEl = document.querySelector('.drawer-title');
    if (drawerTitleEl) {
      drawerTitleEl.textContent = leagueName;
    }

    const subEl = document.getElementById('headerLeagueSubtitle');
    if (subEl) {
      subEl.textContent = `${info.season}ª edizione • Stagione ${info.year}`;
    }

    const footDateEl = document.getElementById('footerLastUpdated');
    if (footDateEl && info.updated) {
      footDateEl.textContent = `Ultimo aggiornamento FCM: ${info.updated}`;
    }
  },

  initDrawer() {
    const openBtn = document.getElementById('btnOpenDrawer');
    const desktopOpenBtn = document.getElementById('btnOpenDrawerDesktop');
    const closeBtn = document.getElementById('btnCloseDrawer');
    const bnavMoreBtn = document.getElementById('btnBnavMore');

    // Assicura stato inerte iniziale a cassetto chiuso
    if (this.drawer && !this.drawer.classList.contains('open')) {
      this.drawer.setAttribute('inert', '');
      this.drawer.setAttribute('aria-hidden', 'true');
    }

    if (openBtn) {
      openBtn.addEventListener('click', () => this.openDrawer(openBtn));
    }
    if (desktopOpenBtn) {
      desktopOpenBtn.addEventListener('click', () => this.openDrawer(desktopOpenBtn));
    }
    if (bnavMoreBtn) {
      bnavMoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleDrawer(bnavMoreBtn);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }
    if (this.drawerBackdrop) {
      this.drawerBackdrop.addEventListener('click', () => this.closeDrawer());
      this.drawerBackdrop.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      this.drawerBackdrop.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    }

    // Previeni scroll del documento al di fuori del drawer quando è aperto
    window.addEventListener('wheel', (e) => {
      if (this.drawer && this.drawer.classList.contains('open')) {
        if (!this.drawer.contains(e.target)) {
          e.preventDefault();
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.drawer && this.drawer.classList.contains('open')) {
        if (!this.drawer.contains(e.target)) {
          e.preventDefault();
        }
      }
    }, { passive: false });

    // Accessibilità tastiera: chiudi drawer con ESC
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.keyCode === 27) && this.drawer && this.drawer.classList.contains('open')) {
        this.closeDrawer();
      }
    });

    // Chiusura automatica del drawer al clic su qualsiasi voce di navigazione interna
    if (this.drawer) {
      const links = this.drawer.querySelectorAll('a');
      links.forEach(l => l.addEventListener('click', () => this.closeDrawer()));
    }
  },

  openDrawer(triggerEl) {
    if (triggerEl) {
      this._lastFocusedElement = triggerEl;
    } else if (document.activeElement && document.activeElement !== document.body) {
      this._lastFocusedElement = document.activeElement;
    }

    if (this.drawer) {
      this.drawer.classList.add('open');
      this.drawer.removeAttribute('inert');
      this.drawer.setAttribute('aria-hidden', 'false');
    }
    if (this.drawerBackdrop) this.drawerBackdrop.classList.add('open');
    document.documentElement.classList.add('drawer-open');
    document.body.classList.add('drawer-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const bnavBtn = document.getElementById('btnBnavMore');
    if (bnavBtn) bnavBtn.setAttribute('aria-expanded', 'true');
    const openBtn = document.getElementById('btnOpenDrawer');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    const desktopOpenBtn = document.getElementById('btnOpenDrawerDesktop');
    if (desktopOpenBtn) desktopOpenBtn.setAttribute('aria-expanded', 'true');
  },

  closeDrawer() {
    // 1. Sposta o rimuovi il focus prima che il drawer diventi inerte/nascosto
    //    Evita il warning WCAG/Chrome: "Blocked aria-hidden on an element because its descendant retained focus"
    if (this.drawer && document.activeElement && this.drawer.contains(document.activeElement)) {
      if (this._lastFocusedElement && typeof this._lastFocusedElement.focus === 'function') {
        try {
          this._lastFocusedElement.focus({ preventScroll: true });
        } catch (e) {
          document.activeElement.blur();
        }
      } else {
        document.activeElement.blur();
      }
    }

    // 2. Nascondi e rendi inerte il drawer
    if (this.drawer) {
      this.drawer.classList.remove('open');
      this.drawer.setAttribute('inert', '');
      this.drawer.setAttribute('aria-hidden', 'true');
    }
    if (this.drawerBackdrop) this.drawerBackdrop.classList.remove('open');
    document.documentElement.classList.remove('drawer-open');
    document.body.classList.remove('drawer-open');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    const bnavBtn = document.getElementById('btnBnavMore');
    if (bnavBtn) bnavBtn.setAttribute('aria-expanded', 'false');
    const openBtn = document.getElementById('btnOpenDrawer');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    const desktopOpenBtn = document.getElementById('btnOpenDrawerDesktop');
    if (desktopOpenBtn) desktopOpenBtn.setAttribute('aria-expanded', 'false');
  },

  toggleDrawer(triggerEl) {
    if (this.drawer && this.drawer.classList.contains('open')) {
      this.closeDrawer();
    } else {
      this.openDrawer(triggerEl);
    }
  },

  sectionTitles: {
    '#home': 'Home Dashboard',
    '#classifica': 'Classifica',
    '#calendario': 'Calendario Incontri',
    '#rose': 'Rose Fantasquadre',
    '#formazioni': 'Formazioni',
    '#risultati': 'Risultati & Tabellini',
    '#statistiche': 'Statistiche',
    '#schede_giocatori': 'Schede Giocatori Serie A',
    '#schedagiocatori': 'Schede Giocatori Serie A',
    '#live': 'Match Center Live',
    '#liveFP': 'Live Fantapazz',
    '#liveFM': 'Live FantaMaster',
    '#liveVU': 'Voti Ufficiosi Pianeta',
    '#calcolo': 'Calcolo Risultati Manuale',
    '#impostazioni_calcolo': 'Impostazioni Calcolo Risultati',
    '#impostazioni-calcolo': 'Impostazioni Calcolo Risultati',
    '#registri': 'Registri Voti FCM',
    '#indisponibili': 'Indisponibili & Infortunati',
    '#indisponibili_covid': 'Indisponibili & Infortunati',
    '#indisponibili_check': 'Controllo Indisponibili',
    '#storico': 'Archivio Storico',
    '#albo': "Albo d'Oro & Palmares",
    '#ranking': 'Ranking Storico',
    '#rankingdivisioni': 'Ranking Divisioni',
    '#album': 'Album Storico',
    '#topflop': 'Top & Flop Storico',
    '#confrontidiretti': 'Scontri Diretti',
    '#confronti': 'Confronti Storici',
    '#recordstorici': 'Record Storici',
    '#almanacco': 'Almanacco Storico',
    '#rating': 'Fanta Rating',
    '#topcosti': 'Top Costi Storico',
    '#topcostistagione': 'Top Costi Stagione',
    '#archivio': 'Archivio Stagioni',
    '#extra': 'Extra & Utility',
    '#seavessiavuto': 'Se Avessi Avuto...',
    '#fantaMassimi': 'FantaMassimi di Giornata',
    '#fantamassimi': 'FantaMassimi di Giornata',
    '#fantaClassifica': 'FantaClassifica Ipotetica',
    '#fantaclassifica': 'FantaClassifica Ipotetica',
    '#records': 'Records di Lega',
    '#fantam': 'FantaMister',
    '#etaRose': 'Età Rose',
    '#documenti': 'Documenti',
    '#invform': 'Invio Formazione',
    '#mercato': 'Mercato Libero',
    '#mercato_admin': 'Gestione Mercato',
    '#gbook': 'Guestbook di Lega'
  },

  updatePageTitle(route) {
    const rawTitle = this.sectionTitles[route] || (this.embeddedPages[route] ? this.embeddedPages[route].title : null) || 'Home Dashboard';
    let leagueName = 'ModernFCM';
    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getLeagueInfo) {
      const info = fcmDataLoader.getLeagueInfo();
      if (info && info.name) leagueName = info.name;
    }
    if (leagueName === 'ModernFCM' && typeof nomelega !== 'undefined' && nomelega) {
      leagueName = nomelega;
    }
    document.title = `${rawTitle} | ${leagueName}`;
  },

  renderDisabledModuleNotice(container, route) {
    const rawTitle = this.sectionTitles[route] || (this.embeddedPages[route] ? this.embeddedPages[route].title : null) || 'Modulo';
    container.innerHTML = `
      <div class="empty-state card" style="max-width: 540px; margin: 40px auto; padding: 40px 24px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
        <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 12px; color: var(--text-main);">Sezione non attiva</h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">
          La sezione <strong>${rawTitle}</strong> è stata disabilitata nelle impostazioni del sito dall'amministratore di lega.
        </p>
        <a href="#home" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; margin: 0 auto; text-decoration: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Torna alla Home
        </a>
      </div>
    `;
  },

  handleRoute() {
    const fullHash = window.location.hash || '#home';
    const baseHash = fullHash.split('?')[0];
    const queryString = fullHash.includes('?') ? fullHash.substring(fullHash.indexOf('?')) : '';

    // Pulizia e distruzione eventuale vista attiva precedente (es. timer live manager)
    if (this._activeView && typeof this._activeView.destroy === 'function') {
      try { this._activeView.destroy(); } catch (e) { console.warn(e); }
      this._activeView = null;
    }

    // Chiusura automatica del drawer se aperto durante navigazione interna
    if (this.drawer && this.drawer.classList.contains('open')) {
      this.closeDrawer();
    }

    // Pulizia dei nodi teletrasportati da invform se ci si sposta su un'altra rotta
    if (baseHash !== '#invform' && baseHash !== '#invform_prec') {
      ['rosterDrawerBackdrop', 'rosterDrawerSheet', 'moduleModalBackdrop', 'moduleModalDialog'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode) {
          try { el.parentNode.removeChild(el); } catch (e) {}
        }
      });
      document.body.classList.remove('drawer-open', 'modal-open');
      document.documentElement.classList.remove('drawer-open', 'modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
    }

    // Aggiornamento dinamico del titolo pagina: [Nome Sezione] | [Nome Lega]
    this.updatePageTitle(baseHash);

    // Guard modularità: se la rotta richiesta fa parte di un modulo disabilitato
    if (typeof fcmModules !== 'undefined' && !fcmModules.isRouteEnabled(baseHash)) {
      this.cleanupFrameObservers();
      if (this.appContainer) this.appContainer.classList.remove('has-embedded-frame');
      this.renderDisabledModuleNotice(this.appContainer, baseHash);
      this.currentRoute = baseHash;
      this.updateNavStates(baseHash);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    const extraTabRoutes = {
      '#seavessiavuto': 'incroci',
      '#confrontidiretti': 'confronti',
      '#etaRose': 'eta',
      '#etarose': 'eta',
      '#documenti': 'documenti',
      '#archivio': 'archivio'
    };

    if (extraTabRoutes[baseHash]) {
      this.cleanupFrameObservers();
      if (this.appContainer) this.appContainer.classList.remove('has-embedded-frame');
      extraView.currentTab = extraTabRoutes[baseHash];
      this.currentRoute = baseHash;
      this.updateNavStates(baseHash);
      this._activeView = extraView;
      extraView.render(this.appContainer);
      window.scrollTo({ top: 0, behavior: 'instant' });
      this.trackCounterVisit(baseHash);
      return;
    }

    // 1. Pagina esterna registrata integrata nella SPA
    if (this.embeddedPages[baseHash]) {
      const pageInfo = this.embeddedPages[baseHash];
      let finalQuery = queryString;
      if (baseHash === '#invform' && !queryString.includes('Gio=')) {
        let targetDay = null;
        if (typeof fcmDataLoader !== 'undefined') {
          const cal = fcmDataLoader.getCalendarData();
          if (cal && cal.nextMatchday > 0 && cal.nextMatchday <= 38) {
            targetDay = cal.nextMatchday;
          }
        }
        if (!targetDay && typeof GetProssimaGiornataDaGiocare === 'function') {
          targetDay = GetProssimaGiornataDaGiocare();
        }
        if (targetDay) {
          finalQuery = (finalQuery ? finalQuery + '&' : '?') + 'Gio=' + targetDay;
        }
      }
      const targetSrc = pageInfo.file + finalQuery;
      this.currentRoute = baseHash;
      this.updateNavStates(baseHash);
      this.renderFrame(this.appContainer, targetSrc, pageInfo.title);
      window.scrollTo({ top: 0, behavior: 'instant' });
      this.trackCounterVisit(baseHash);
      return;
    }

    // 2. Pagina generica passata via #frame?src=...&title=...
    if (baseHash === '#frame') {
      const params = new URLSearchParams(queryString);
      let targetSrc = params.get('src') || 'album.htm';
      const targetTitle = params.get('title') || 'Pagina ModernFCM';

      // Validazione di sicurezza: consenti solo percorsi relativi sicuri (.htm, .html, .php)
      const isSafeRelativeUrl = /^[a-zA-Z0-9_\-\.\/]+\.(htm|html|php)(\?[a-zA-Z0-9_\-\.&=%]*)?$/i.test(targetSrc)
        && !targetSrc.includes('://')
        && !targetSrc.toLowerCase().includes('javascript:')
        && !/[<>"']/.test(targetSrc);

      if (!isSafeRelativeUrl) {
        targetSrc = 'album.htm';
      }

      this.currentRoute = '#frame';
      this.updateNavStates('#extra');
      this.renderFrame(this.appContainer, targetSrc, targetTitle);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // 3. Vista nativa SPA standard
    this.cleanupFrameObservers();
    if (this.appContainer) this.appContainer.classList.remove('has-embedded-frame');
    let activeRoute = baseHash;
    if (!this.routes[activeRoute]) {
      activeRoute = '#home';
    }

    // Se l'utente naviga a #formazioni o #risultati senza specificare ?day=,
    // resettiamo la selezione così da visualizzare la giornata predefinita
    const hasExplicitDay = fullHash.includes('?') && new URLSearchParams(fullHash.substring(fullHash.indexOf('?'))).has('day');
    if (!hasExplicitDay) {
      if (activeRoute === '#formazioni' && (this.currentRoute !== '#formazioni' || !formazioniView.currentSerieADay)) {
        formazioniView.currentSerieADay = null;
        formazioniView.currentMatchId = null;
        formazioniView.lastLoadedHash = null;
      }
      if (activeRoute === '#risultati' && (this.currentRoute !== '#risultati' || !risultatiView.currentSerieADay)) {
        risultatiView.currentSerieADay = null;
        risultatiView.currentMatchId = null;
        risultatiView.lastLoadedHash = null;
      }
    }

    this.currentRoute = activeRoute;
    this.updateNavStates(activeRoute);

    // Gestione tab dedicati per viste multi-funzione
    if (activeRoute === '#topcostistagione') {
      topCostiView.currentTab = 'stagione';
    } else if (activeRoute === '#topcosti') {
      topCostiView.currentTab = 'storico';
    }

    const view = this.routes[activeRoute];
    if (view && typeof view.render === 'function') {
      this._activeView = view;
      if (activeRoute === '#storico') {
        view.renderStorico(this.appContainer);
      } else if (activeRoute === '#extra') {
        view.renderExtra(this.appContainer);
      } else {
        view.render(this.appContainer);
      }
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Tracciamento visite silenzioso fanKounter (se abilitato)
    this.trackCounterVisit(baseHash);
  },

  /**
   * Registra silenziosamente la visita per il contatore fanKounter (se il modulo è abilitato)
   */
  trackCounterVisit(hash) {
    try {
      if (typeof fcmModules !== 'undefined' && fcmModules.hasCounter && fcmModules.hasCounter()) {
        const clean = (hash || '#home').replace(/^#/, '').toLowerCase().split('?')[0];
        const validIds = {
          'home': 'index',
          'index': 'index',
          'classifica': 'classifica',
          'calendario': 'cale',
          'cale': 'cale',
          'rose': 'rose',
          'formazioni': 'formazioni',
          'risultati': 'risultati',
          'statistiche': 'statistiche',
          'schede_giocatori': 'schedegiocatori',
          'schedegiocatori': 'schedegiocatori',
          'indisponibili': 'indisponibili',
          'indisponibili_covid': 'indisponibili',
          'indisponibili_check': 'indisponibili',
          'documenti': 'documenti',
          'confronti': 'confronti',
          'confrontidiretti': 'confronti',
          'incroci': 'incroci',
          'seavessiavuto': 'incroci',
          'eta': 'eta',
          'etarose': 'eta',
          'fantam': 'fantamister',
          'fantamister': 'fantamister',
          'fantamassimi': 'fantamister',
          'fantaclassifica': 'fantamister',
          'ranking': 'ranking',
          'rankingdivisioni': 'ranking',
          'albo': 'albo',
          'album': 'album',
          'almanacco': 'almanacco',
          'rating': 'rating',
          'registri': 'registri',
          'topcosti': 'topcosti',
          'topcostistagione': 'topcostistagione',
          'topflop': 'topflop',
          'calcolo': 'calcolo',
          'impostazioni_calcolo': 'calcolo',
          'impostazioni-calcolo': 'calcolo',
          'live': 'live',
          'livefp': 'live',
          'livefm': 'live',
          'livevu': 'live',
          'livefg': 'live',
          'invform': 'invform',
          'invform_prec': 'invform'
        };
        const counterId = validIds[clean];
        if (!counterId) return;
        const beacon = new Image();
        beacon.src = `fkounter5/counter.php?id=${counterId}&mode=hidden&_t=${Date.now()}`;
      }
    } catch (e) { }
  },

  initNavDefaultResetListeners() {
    document.querySelectorAll('a[href="#formazioni"]').forEach(el => {
      el.addEventListener('click', () => {
        formazioniView.currentSerieADay = null;
        formazioniView.currentMatchId = null;
        formazioniView.lastLoadedHash = null;
        if (window.location.hash === '#formazioni' && this.appContainer) {
          formazioniView.render(this.appContainer);
        }
      });
    });
    document.querySelectorAll('a[href="#risultati"]').forEach(el => {
      el.addEventListener('click', () => {
        risultatiView.currentSerieADay = null;
        risultatiView.currentMatchId = null;
        risultatiView.lastLoadedHash = null;
        if (window.location.hash === '#risultati' && this.appContainer) {
          risultatiView.render(this.appContainer);
        }
      });
    });
    document.querySelectorAll('a[href="#live"], a[href="#liveFP"], a[href="#liveFM"], a[href="#liveVU"], a[href="#liveFG"]').forEach(el => {
      el.addEventListener('click', () => {
        if (typeof liveVotiView !== 'undefined') {
          liveVotiView.currentDay = null;
          liveVotiView.currentMatch = 'all';
        }
      });
    });
  },

  initQuickMenu() {
    const dropdown = document.getElementById('quickMenuDropdown');
    const toggleBtn = document.getElementById('btnQuickMenuToggle');
    if (!dropdown || !toggleBtn) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.keyCode === 27) && dropdown.classList.contains('open')) {
        dropdown.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
      }
    });

    // Close when clicking any link inside panel
    const panelLinks = dropdown.querySelectorAll('.quick-menu-link');
    panelLinks.forEach(link => {
      link.addEventListener('click', () => {
        dropdown.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  },

  async updateBottomNav() {
    const item = document.getElementById('bnavDynamicItem');
    if (!item || typeof fcmDataLoader === 'undefined') return;

    try {
      const status = await fcmDataLoader.getMatchdayStatus();

      let targetHref = '#calendario';
      let targetLabel = 'Calendario';
      let targetType = 'calendario';
      let targetSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      `;

      if (!status.inProgress) {
        // 1. Quando la giornata non è in corso: inserisci il pulsante invio formazione al posto del pulsante calendario
        if (status.isInvformEnabled) {
          targetHref = '#invform';
          targetLabel = 'Invio Formazione';
          targetType = 'invform';
          targetSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          `;
        }
      } else {
        // 2. Quando la giornata è in corso:
        //    - inserisci il pulsante "Live" se il relativo modulo è attivato
        //    - altrimenti inserisci il pulsante "Invio formazione" se è sbloccato l'invio formazione della giornata successiva
        //    - altrimenti ancora inserisci il pulsante "Calendario"
        if (status.isLiveEnabled) {
          targetHref = status.liveRoute;
          targetLabel = 'Live';
          targetType = 'live';
          targetSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          `;
        } else if (status.isFutureLineupUnlocked) {
          targetHref = `#invform?Gio=${status.nextSubmittableDay}`;
          targetLabel = 'Invio Formazione';
          targetType = 'invform';
          targetSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          `;
        }
      }

      item.setAttribute('href', targetHref);
      item.dataset.bnavType = targetType;
      item.innerHTML = `${targetSvg}<span>${targetLabel}</span>`;

      // Sincronizza lo stato attivo
      this.updateNavStates(window.location.hash || '#home');
    } catch (e) {
      console.warn('Errore aggiornamento footer mobile:', e);
    }
  },

  updateNavStates(hash) {
    const cleanHash = (hash || '').split('?')[0].toLowerCase();

    // Bottom Nav (mobile)
    const bNavItems = document.querySelectorAll('.bnav-item');
    bNavItems.forEach(item => {
      const itemHref = item.getAttribute('href') || '';
      const itemHash = itemHref.split('?')[0].toLowerCase();
      const bnavType = item.dataset.bnavType;

      const isLiveHash = cleanHash === '#livefp' || cleanHash === '#livefm' || cleanHash === '#livevu' || cleanHash === '#livefg';
      const isInvformHash = cleanHash === '#invform';

      let isActive = false;
      if (itemHash && itemHash === cleanHash) {
        isActive = true;
      } else if (bnavType === 'live' && isLiveHash) {
        isActive = true;
      } else if (bnavType === 'invform' && isInvformHash) {
        isActive = true;
      }

      if (isActive) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Desktop Nav
    const dNavItems = document.querySelectorAll('.desktop-nav .nav-item');
    dNavItems.forEach(item => {
      const itemHash = (item.getAttribute('href') || '').split('?')[0].toLowerCase();
      if (itemHash && itemHash === cleanHash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Helper per determinare la corrispondenza con la route corrente
    const isLinkMatch = (rawHref) => {
      if (!rawHref) return false;
      const h = rawHref.split('?')[0].toLowerCase();
      if (h === cleanHash) return true;
      if (cleanHash === '#rankingdivisioni' && h === '#ranking') return true;
      if (cleanHash.startsWith('#indisponibili') && h === '#indisponibili') return true;
      return false;
    };

    // Drawer Links (menu a scomparsa)
    const drawerAccordions = document.querySelectorAll('.drawer-accordion');
    let matchedDrawerAccordion = null;

    const drawerLinks = document.querySelectorAll('.drawer-link');
    drawerLinks.forEach(item => {
      const href = item.getAttribute('href');
      if (isLinkMatch(href)) {
        item.classList.add('active');
        const parentAccordion = item.closest('.drawer-accordion');
        if (parentAccordion) {
          matchedDrawerAccordion = parentAccordion;
        }
      } else {
        item.classList.remove('active');
      }
    });

    // Apri solo l'accordion del drawer che contiene la pagina attiva (o il primo di default)
    if (drawerAccordions.length > 0) {
      const targetDrawerAcc = matchedDrawerAccordion || drawerAccordions[0];
      drawerAccordions.forEach(acc => {
        acc.open = (acc === targetDrawerAcc);
      });
    }

    // Quick Menu Links (dropdown desktop)
    const quickAccordions = document.querySelectorAll('.quick-menu-accordion');
    let matchedQuickAccordion = null;

    const quickLinks = document.querySelectorAll('.quick-menu-link');
    quickLinks.forEach(item => {
      const href = item.getAttribute('href');
      if (isLinkMatch(href)) {
        item.classList.add('active');
        const parentAccordion = item.closest('.quick-menu-accordion');
        if (parentAccordion) {
          matchedQuickAccordion = parentAccordion;
        }
      } else {
        item.classList.remove('active');
      }
    });

    // Apri solo l'accordion del menu rapido che contiene la pagina attiva (o il primo di default)
    if (quickAccordions.length > 0) {
      const targetQuickAcc = matchedQuickAccordion || quickAccordions[0];
      quickAccordions.forEach(acc => {
        acc.open = (acc === targetQuickAcc);
      });
    }
  },

  /**
   * Renderizza una pagina PHP o HTM dentro l'iframe seamless della SPA
   */
  renderFrame(container, src, title) {
    this.cleanupFrameObservers();

    if (this.appContainer) {
      this.appContainer.classList.add('has-embedded-frame');
    }
    const safeSrc = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    container.innerHTML = `
      <div class="embedded-frame-container">
        <!-- Frame incorporato -->
        <div class="embedded-frame-wrapper">
          <iframe id="spaEmbeddedFrame" src="${safeSrc}" frameborder="0" scrolling="no" allowtransparency="true" style="background-color: var(--bg-main, #0b1120);"></iframe>
        </div>
      </div>
    `;

    const iframe = document.getElementById('spaEmbeddedFrame');
    if (iframe) {
      iframe.addEventListener('load', () => {
        this.cleanupFrameObservers();
        this._lastFrameHeight = 0;
        try {
          if (iframe.contentDocument) {
            // Applica la classe in-iframe per nascondere navbar e footer interni ed eliminare scrollbar
            iframe.contentDocument.documentElement.classList.add('in-iframe');
            if (iframe.contentDocument.body) {
              iframe.contentDocument.body.classList.add('in-iframe');
            }

            // Inietta regola CSS per prevenire rigorosamente qualsiasi barra di scorrimento interna all'iframe
            try {
              if (!iframe.contentDocument.getElementById('spa-iframe-no-scroll')) {
                const styleEl = iframe.contentDocument.createElement('style');
                styleEl.id = 'spa-iframe-no-scroll';
                styleEl.textContent = `
                  html, body {
                    overflow: hidden !important;
                    overflow-y: hidden !important;
                    scrollbar-width: none !important;
                    background-color: var(--gbook-bg, var(--bg-main, #0b1120)) !important;
                  }
                  html[data-theme="light"], html[data-theme="light"] body {
                    background-color: var(--gbook-bg, var(--bg-main, #f1f5f9)) !important;
                  }
                  html::-webkit-scrollbar, body::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                  }
                `;
                iframe.contentDocument.head.appendChild(styleEl);
              }
            } catch (styleErr) { }

            // Sincronizza il tema (default dark coerente con ModernFCM)
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            iframe.contentDocument.documentElement.setAttribute('data-theme', theme);

            // Se l'iframe contiene <base target="_top">, impostalo a _self per non forzare la navigazione fuori dal frame
            try {
              const baseTag = iframe.contentDocument.querySelector('base[target="_top"]');
              if (baseTag) {
                baseTag.setAttribute('target', '_self');
              }
            } catch (e) { }

            // Sincronizzazione dinamica del titolo e del link "Nuova Scheda"
            try {
              if (iframe.contentWindow && iframe.contentWindow.location) {
                const curPath = iframe.contentWindow.location.pathname || '';
                const curFile = curPath.split('/').filter(Boolean).pop() || '';
                let matched = false;

                for (const [hash, info] of Object.entries(App.embeddedPages)) {
                  const targetFile = info.file.split('/').pop();
                  if (curFile.toLowerCase() === targetFile.toLowerCase()) {
                    matched = true;
                    const titleEl = container.querySelector('.embedded-frame-title');
                    if (titleEl) {
                      titleEl.textContent = info.title;
                    }
                    const newTabBtn = container.querySelector('.embedded-frame-newtab');
                    if (newTabBtn) {
                      newTabBtn.href = iframe.contentWindow.location.href || info.file;
                    }
                    const curSearch = (iframe.contentWindow && iframe.contentWindow.location) ? (iframe.contentWindow.location.search || '') : '';
                    const fullTargetHash = hash + curSearch;
                    const currentBaseHash = (window.location.hash || '').split('?')[0];

                    if (window.location.hash !== fullTargetHash) {
                      history.replaceState(null, '', fullTargetHash);
                    }
                    if (currentBaseHash !== hash) {
                      App.currentRoute = hash;
                      App.updateNavStates(hash);
                    }
                    if (curSearch) {
                      try {
                        sessionStorage.setItem('fcm_embedded_params_' + hash, curSearch);
                      } catch (e) { }
                    }
                    break;
                  }
                }

                if (!matched && iframe.contentDocument && iframe.contentDocument.title) {
                  const docTitle = iframe.contentDocument.title.split('-')[0].trim();
                  if (docTitle) {
                    const titleEl = container.querySelector('.embedded-frame-title');
                    if (titleEl) titleEl.textContent = docTitle;
                  }
                }
              }
            } catch (syncErr) {
              // Ignore cross-origin error if any
            }

            // Auto-adattamento bidirezionale dell'altezza del frame (aumento e diminuzione)
            this.adjustCurrentFrameHeight(true);
            setTimeout(() => this.adjustCurrentFrameHeight(), 200);
            setTimeout(() => this.adjustCurrentFrameHeight(), 600);
            setTimeout(() => this.adjustCurrentFrameHeight(), 1200);

            // Setup degli observers per intercettare qualsiasi variazione interna (filtraggi, toggle, fisarmoniche)
            try {
              const doc = iframe.contentDocument;
              if (doc && doc.body) {
                if (typeof ResizeObserver !== 'undefined') {
                  this._frameResizeObserver = new ResizeObserver(() => {
                    this.adjustCurrentFrameHeight();
                  });
                  this._frameResizeObserver.observe(doc.body);
                  const mainCont = doc.querySelector('.standalone-container, .invform-container, .confronti-wrapper, .page-frame, .mercato-wrapper');
                  if (mainCont) {
                    this._frameResizeObserver.observe(mainCont);
                  }
                }

                if (typeof MutationObserver !== 'undefined') {
                  this._frameMutationObserver = new MutationObserver(() => {
                    this.adjustCurrentFrameHeight();
                  });
                  this._frameMutationObserver.observe(doc.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class', 'hidden']
                  });
                }

                // Polling leggero periodico di sicurezza per pagine dinamiche
                this._framePollInterval = setInterval(() => {
                  this.adjustCurrentFrameHeight();
                }, 500);
              }
            } catch (obsErr) { }
          }
        } catch (e) {
          // Gestione sicura se restrizioni
        }
      });
    }
  },

  /**
   * Calcola l'altezza effettiva del contenuto all'interno dell'iframe,
   * supportando sia l'espansione (grow) che la riduzione (shrink).
   */
  getActualContentHeight(iframe) {
    try {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (!doc || !doc.body) return 0;

      const win = iframe.contentWindow;
      const body = doc.body;
      const docEl = doc.documentElement;

      // Assicura che la classe di supporto incorporamento sia sempre attiva
      if (!docEl.classList.contains('in-iframe')) {
        docEl.classList.add('in-iframe');
      }

      const bodyRect = body.getBoundingClientRect();

      // Se è presente la maschera di accesso / selezione di fanKounter (.mask), calcola direttamente la sua altezza reale
      const maskEl = doc.querySelector('.mask');
      if (maskEl) {
        const maskRect = maskEl.getBoundingClientRect();
        const maskBottom = Math.ceil(maskRect.bottom - bodyRect.top + 60);
        return Math.max(380, maskBottom);
      }

      let measuredH = 0;

      // 1. Cerca contenitori principali noti (.standalone-container, .invform-container, .mercato-wrapper, ecc.)
      const mainContainer = doc.querySelector(
        '.standalone-container, .invform-container, .confronti-wrapper, .page-frame, .mercato-wrapper, table.prima, table.principale, table.conteiner, #mainContent, #container'
      );
      if (mainContainer) {
        const cRect = mainContainer.getBoundingClientRect();
        if (cRect.height > 0) {
          const cBottom = Math.ceil(cRect.height + (mainContainer.offsetTop || 0));
          measuredH = Math.max(measuredH, cBottom);
        }
      }

      // 2. Scansiona i figli visibili in-flow del body per individuare l'effettivo punto più basso
      const children = body.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tag = child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript') continue;

        let style;
        try {
          style = win && win.getComputedStyle ? win.getComputedStyle(child) : child.style;
        } catch (e) {
          style = child.style;
        }
        if (!style) continue;
        if (style.display === 'none') continue;
        if (style.position === 'fixed') continue; // Ignora modali fisse come #legendaModal
        if (child.style && child.style.height && child.style.height.includes('100%')) continue;

        const r = child.getBoundingClientRect();
        if (r.height > 0) {
          let marginBottom = 0;
          if (style && style.marginBottom) {
            marginBottom = parseFloat(style.marginBottom) || 0;
          }
          const bottomInBody = Math.ceil(r.bottom - bodyRect.top + marginBottom);
          if (bottomInBody > measuredH) {
            measuredH = bottomInBody;
          }
        }
      }

      // 3. Se è presente un dialog / modal aperto all'interno dell'iframe, includi la sua altezza reale con padding
      const openDialog = doc.querySelector('dialog[open], .modal.show, .inv-modal.open, .roster-drawer-sheet.open');
      const isModalOpen = !!openDialog || (doc.body && doc.body.classList.contains('modal-open'));
      if (isModalOpen) {
        let dialogBottom = 0;
        if (openDialog) {
          const dRect = openDialog.getBoundingClientRect();
          dialogBottom = Math.ceil(dRect.bottom - bodyRect.top + 40);
          const dScrollH = Math.max(openDialog.scrollHeight || 0, openDialog.offsetHeight || 0);
          measuredH = Math.max(measuredH, dialogBottom, dScrollH + 180, 1050);
        } else {
          measuredH = Math.max(measuredH, 1050);
        }
      }

      // 4. Fallback se measuredH non ha trovato elementi
      if (measuredH === 0 && body.offsetHeight > 0) {
        measuredH = body.offsetHeight;
      }

      return measuredH;
    } catch (err) {
      return 0;
    }
  },

  /**
   * Regola l'altezza dell'iframe incorporato in modo bidirezionale (aumento e diminuzione)
   */
  adjustCurrentFrameHeight(force, minH) {
    const iframe = document.getElementById('spaEmbeddedFrame');
    if (!iframe) return;

    try {
      const measuredH = this.getActualContentHeight(iframe);
      if (measuredH <= 0 && (!minH || minH <= 0)) return;

      // Altezza target con limite di sicurezza e padding pulito
      let targetHeight = Math.min(10000, Math.max(380, measuredH + 50));
      if (minH && minH > targetHeight) {
        targetHeight = Math.min(10000, minH);
      }

      if (force || !this._lastFrameHeight || Math.abs(targetHeight - this._lastFrameHeight) >= 4) {
        iframe.style.height = targetHeight + 'px';
        iframe.style.overflow = 'hidden';
        iframe.setAttribute('scrolling', 'no');
        this._lastFrameHeight = targetHeight;
      }
    } catch (err) { }
  },

  /**
   * Pulisce gli observer e timer dell'iframe attivo per evitare memory leak
   */
  cleanupFrameObservers() {
    if (this._frameResizeObserver) {
      try { this._frameResizeObserver.disconnect(); } catch (e) { }
      this._frameResizeObserver = null;
    }
    if (this._frameMutationObserver) {
      try { this._frameMutationObserver.disconnect(); } catch (e) { }
      this._frameMutationObserver = null;
    }
    if (this._framePollInterval) {
      try { clearInterval(this._framePollInterval); } catch (e) { }
      this._framePollInterval = null;
    }
    this._lastFrameHeight = 0;
  }
};

// Start application after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
