/**
 * FCM DATA LOADER & MODULAR CONTROLLER
 * Access layer and helper utilities for Fantacalcio Manager data structures.
 * ModernFCM
 */

/**
 * Global Modular Features Controller
 * Controls feature activation based on ModernFCM.ini (injected via fcmVariabili.js)
 */
const fcmModules = {
  isEnabled(key) {
    const scope = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
    if (typeof scope[key] === 'undefined') return true; // Default enabled
    const v = String(scope[key]).trim().toLowerCase();
    return v === 'si' || v === '1' || v === 'true';
  },
  hasEtaRose() {
    return this.isEnabled('ModEtaRose');
  },
  hasFantamister() {
    return this.isEnabled('ModFantamister');
  },
  hasFantaMassimi() {
    return this.isEnabled('ModFantaMassimi');
  },
  hasIncroci() {
    return this.isEnabled('ModIncroci');
  },
  hasInvioFormazione() {
    return this.isEnabled('ModInvioFormazione');
  },
  hasStoricoAvanzato() {
    return this.isEnabled('ModStoricoAvanzato');
  },
  hasRecords() {
    return this.isEnabled('ModRecords');
  },
  hasliveFP() {
    return this.isEnabled('ModLiveFantapazz');
  },
  hasLiveFM() {
    return this.isEnabled('ModLiveFantaMaster');
  },
  hasLiveFC() {
    return this.isEnabled('ModLiveFantacalcio');
  },
  hasLiveVU() {
    return this.isEnabled('ModLiveVU');
  },
  hasIndisponibili() {
    return this.isEnabled('ModIndisponibili');
  },
  hasProbabiliSky() {
    return this.isEnabled('ModProbabiliSky');
  },
  hasGuestbook() {
    return this.isEnabled('ModGuestbook');
  },
  hasCounter() {
    return this.isEnabled('ModCounter');
  },
  hasMercatoLibero() {
    return this.isEnabled('ModMercatoLibero');
  },
  hasMercato() {
    return this.hasMercatoLibero();
  },
  isRouteEnabled(route) {
    const cleanRoute = (route || '').replace(/^#/, '').toLowerCase().split('?')[0].split('/')[0];
    switch (cleanRoute) {
      case 'mercato':
      case 'mercato_admin':
        return this.hasMercatoLibero();
      case 'gbook':
        return this.hasGuestbook();
      case 'counter':
      case 'stats':
        return this.hasCounter();
      case 'etarose':
        return this.hasEtaRose();
      case 'fantam':
      case 'top11':
        return this.hasFantamister();
      case 'fantamstorico':
      case 'fantamisterstorico':
      case 'fantam_storico':
        return this.hasFantamister() && this.hasStoricoAvanzato();
      case 'fantamassimi':
      case 'fantaclassifica':
        return this.hasFantaMassimi();
      case 'seavessiavuto':
      case 'inverticalendario':
      case 'incroci':
        return this.hasIncroci();
      case 'invform':
      case 'invform_prec':
        return this.hasInvioFormazione();
      case 'records':
        return this.hasRecords();
      case 'live':
        return this.hasliveFP() || this.hasLiveFM() || this.hasLiveFC() || this.hasLiveVU();
      case 'livefp':
      case 'livefg':
        return this.hasliveFP();
      case 'livefm':
        return this.hasLiveFM();
      case 'livefc':
        return this.hasLiveFC();
      case 'livevu':
        return this.hasLiveVU();
      case 'indisponibili':
      case 'indisponibili_covid':
      case 'indisponibili_check':
        return this.hasIndisponibili();
      case 'storico':
      case 'album':
      case 'confrontistorici':
      case 'confronti':
      case 'confrontidiretti':
      case 'recordstorici':
      case 'topcosti':
      case 'topcostistagione':
      case 'schedegiocatori':
      case 'schede_giocatori':
      case 'schedagiocatori':
      case 'statistiche_storiche':
      case 'statistichestoriche':
      case 'ranking':
      case 'rankingdivisioni':
      case 'archivio':
      case 'almanacco':
      case 'rating':
      case 'topflop':
        return this.hasStoricoAvanzato();
      default:
        return true;
    }
  }
};

if (typeof window !== 'undefined') {
  window.fcmModules = fcmModules;
}
if (typeof globalThis !== 'undefined') {
  globalThis.fcmModules = fcmModules;
}

const fcmDataLoader = {
  // Cache for dynamically loaded files
  _loadedScripts: new Set(),
  _inFlightScripts: new Map(),
  _fetchPromises: new Map(),
  _fetchCache: new Map(),
  _cachedConfronti: null,
  _confrontiPromise: null,
  _risultatiCache: {},
  _formazioniCache: {},
  _registriCache: {},
  _colIdxCache: {},
  _queryCache: {},
  _scheduleCache: null,
  _defendingWinnersCache: null,
  _topFlop11Cache: null,
  _tabelliniStore: {},
  _tabelliniLoadedDays: new Set(),
  _incrociCache: {},

  /**
   * Load voting register data for a team into _registriCache
   */
  async loadRegisterDataForTeam(teamId) {
    const tId = parseInt(teamId, 10);
    if (!tId || tId <= 0) return null;
    if (this._registriCache[tId]) {
      return this._registriCache[tId];
    }
    await this.loadScript(`js/fcmRegistriDati${tId}.js`, true);
    if (typeof arrRegistri !== 'undefined' && arrRegistri.length > 0) {
      this._registriCache[tId] = arrRegistri.slice();
      return this._registriCache[tId];
    }
    return null;
  },

  /**
   * Parse FCM vote rating string into bonus/malus icons HTML
   */
  parseBonusMalusIcons(voto) {
    if (!voto || typeof voto !== 'string') return '';
    let html = '';

    // 1. Gol fatti & Rigori segnati (+)
    const golMatch = voto.match(/\+(\d)(?:\((\d)\))?/);
    if (golMatch) {
      const gol = parseInt(golMatch[1], 10) || 0;
      const rigori = parseInt(golMatch[2] || '0', 10) || 0;
      const golSuAzione = Math.max(0, gol - rigori);
      for (let i = 0; i < golSuAzione; i++) {
        html += '<img src="img/live/golfatto_s.png" title="Gol Fatto" class="bm-icon" />';
      }
      for (let i = 0; i < rigori; i++) {
        html += '<img src="img/live/rigoresegnato_s.png" title="Rigore Segnato" class="bm-icon" />';
      }
    }

    // 2. Rigori sbagliati (#)
    const rigSbagliatiMatch = voto.match(/#(\d)/);
    if (rigSbagliatiMatch) {
      const count = parseInt(rigSbagliatiMatch[1], 10) || 0;
      for (let i = 0; i < count; i++) {
        html += '<img src="img/live/rigoresbagliato_s.png" title="Rigore Sbagliato" class="bm-icon" />';
      }
    }

    // 3. Gol subiti (-) o Clean Sheet (--)
    if (voto.includes('--')) {
      html += '<img src="img/live/portiereimbattuto_s.png" title="Portiere Imbattuto" class="bm-icon" />';
    } else {
      const golSubitiMatch = voto.match(/-(\d)/);
      if (golSubitiMatch) {
        const count = parseInt(golSubitiMatch[1], 10) || 0;
        for (let i = 0; i < count; i++) {
          html += '<img src="img/live/golsubito_s.png" title="Gol Subito" class="bm-icon" />';
        }
      }
    }

    // 4. Rigori parati (!)
    const rigParatiMatch = voto.match(/!(\d)/);
    if (rigParatiMatch) {
      const count = parseInt(rigParatiMatch[1], 10) || 0;
      for (let i = 0; i < count; i++) {
        html += '<img src="img/live/rigoreparato_s.png" title="Rigore Parato" class="bm-icon" />';
      }
    }

    // 5. Autogol (_)
    const autogolMatch = voto.match(/_(\d)/);
    if (autogolMatch) {
      const count = parseInt(autogolMatch[1], 10) || 0;
      for (let i = 0; i < count; i++) {
        html += '<img src="img/live/autogol_s.png" title="Autogol" class="bm-icon" />';
      }
    }

    // 6. Assist (>)
    const assistMatch = voto.match(/>(\d)/);
    if (assistMatch) {
      const count = parseInt(assistMatch[1], 10) || 0;
      for (let i = 0; i < count; i++) {
        html += '<img src="img/live/assist_s.png" title="Assist" class="bm-icon" />';
      }
    }

    // 7. Gol Vittoria (V)
    if (voto.includes('V')) {
      html += '<img src="img/live/golvittoria_s.png" title="Gol Vittoria" class="bm-icon" />';
    }

    // 8. Gol Pareggio (P)
    if (voto.includes('P')) {
      html += '<img src="img/live/golpareggio_s.png" title="Gol Pareggio" class="bm-icon" />';
    }

    // 9. Ammonizione (A)
    if (voto.includes('A')) {
      html += '<img src="img/live/amm_s.png" title="Ammonizione" class="bm-icon" />';
    }

    // 10. Espulsione (E)
    if (voto.includes('E')) {
      html += '<img src="img/live/esp_s.png" title="Espulsione" class="bm-icon" />';
    }

    return html;
  },

  _getRegisterColIndexForSerieADay(teamRegistri, serieADay, teamId) {
    const tId = parseInt(teamId, 10);
    const targetDay = parseInt(serieADay, 10);
    const cacheKey = `${tId}_${targetDay}`;
    if (this._colIdxCache[cacheKey] !== undefined) {
      return this._colIdxCache[cacheKey];
    }

    if (!teamRegistri || teamRegistri.length === 0) return -1;
    const headerRow = teamRegistri.find(r => r && r.IDGiocatore === 0) || teamRegistri[1];
    if (!headerRow || !headerRow.ListaGio) return -1;

    const matchdayCols = headerRow.ListaGio.split('%');
    if (!this._calendarRoundsMap && typeof arrIncontri !== 'undefined') {
      const rounds = [];
      const seen = new Set();
      for (let i = 1; i < arrIncontri.length; i++) {
        const inc = arrIncontri[i];
        if (!inc || !inc.Fantagiornata) continue;
        const key = `${inc.GiornataDiA}___${inc.Fantagiornata}`;
        if (!seen.has(key)) {
          seen.add(key);
          rounds.push({
            serieADay: inc.GiornataDiA,
            fantagiornata: inc.Fantagiornata
          });
        }
      }
      rounds.sort((a, b) => a.serieADay - b.serieADay);
      this._calendarRoundsMap = rounds;
    }

    const calendarRounds = this._calendarRoundsMap || [];
    let calIdx = 0;
    let foundIdx = -1;

    for (let k = 0; k < matchdayCols.length; k++) {
      const raw = (matchdayCols[k] || '').trim();
      let matchedRound = null;
      for (let j = calIdx; j < calendarRounds.length; j++) {
        if (calendarRounds[j].fantagiornata.startsWith(raw)) {
          matchedRound = calendarRounds[j];
          calIdx = j + 1;
          break;
        }
      }
      if (!matchedRound) {
        matchedRound = calendarRounds.find(r => r.fantagiornata.startsWith(raw));
      }
      if (matchedRound && matchedRound.serieADay === targetDay) {
        foundIdx = k;
        break;
      }
    }

    if (foundIdx < 0) {
      const targetStr = `${targetDay}a`;
      for (let k = 0; k < matchdayCols.length; k++) {
        if ((matchdayCols[k] || '').trim().startsWith(targetStr)) {
          foundIdx = k;
          break;
        }
      }
    }

    this._colIdxCache[cacheKey] = foundIdx;
    return foundIdx;
  },

  getBonusMalusIcons(teamId, playerId, serieADay) {
    const tId = parseInt(teamId, 10);
    const pId = parseInt(playerId, 10);
    if (!tId || !pId || pId <= 0) return '';

    const teamRegistri = this._registriCache[tId];
    if (!teamRegistri) return '';

    const colIdx = this._getRegisterColIndexForSerieADay(teamRegistri, serieADay, tId);
    if (colIdx < 0) return '';

    const playerRow = teamRegistri.find(r => r && r.IDGiocatore === pId);
    if (!playerRow || !playerRow.ListaGio) return '';

    const listaGio = playerRow.ListaGio.split('%');
    const votoStr = listaGio[colIdx];
    return this.parseBonusMalusIcons(votoStr);
  },

  _resolvePath(url) {
    if (!url || typeof url !== 'string') return url || '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url.startsWith('../') || url.startsWith('data:')) {
      return url;
    }
    const isInc = (typeof window !== 'undefined' && window.location && window.location.pathname && (window.location.pathname.includes('/inc/') || window.location.pathname.endsWith('/inc') || window.location.pathname.includes('\\inc\\')));
    if (isInc && url.startsWith('inc/')) {
      return url.substring(4);
    }
    return isInc ? '../' + url : url;
  },

  _initLoadedScripts() {
    if (typeof document === 'undefined') return;
    if (!this._loadedScripts) this._loadedScripts = new Set();
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(s => {
      const raw = s.getAttribute('src');
      if (raw) {
        this._loadedScripts.add(raw);
        const clean = raw.split('?')[0].replace(/^\.\.\//, '');
        this._loadedScripts.add(clean);
        if (!clean.startsWith('js/')) this._loadedScripts.add('js/' + clean);
        if (clean.startsWith('js/')) this._loadedScripts.add(clean.substring(3));
      }
    });
  },

  /**
   * Helper to dynamically inject a script and wait for load
   */
  loadScript(src, forceReload = false, charset = 'ISO-8859-1') {
    if (!this._scriptsInitialized) {
      this._initLoadedScripts();
      this._scriptsInitialized = true;
    }
    const cleanSrc = src.split('?')[0].replace(/^\.\.\//, '');
    if (!forceReload && (this._loadedScripts.has(src) || this._loadedScripts.has(cleanSrc))) {
      return Promise.resolve();
    }
    if (!forceReload && this._inFlightScripts && (this._inFlightScripts.has(src) || this._inFlightScripts.has(cleanSrc))) {
      return this._inFlightScripts.get(src) || this._inFlightScripts.get(cleanSrc);
    }
    const p = new Promise((resolve) => {
      const script = document.createElement('script');
      if (charset) {
        script.charset = charset;
      }
      let finalSrc = this._resolvePath(src);
      if (forceReload === true) {
        finalSrc = `${finalSrc.split('?')[0]}?t=${Date.now()}`;
      } else if (typeof window !== 'undefined' && window.FCM_VERSION) {
        const sep = finalSrc.includes('?') ? '&' : '?';
        finalSrc = `${finalSrc}${sep}v=${encodeURIComponent(window.FCM_VERSION)}`;
      }
      script.src = finalSrc;
      script.onload = () => {
        this._loadedScripts.add(src);
        this._loadedScripts.add(cleanSrc);
        if (!cleanSrc.startsWith('js/')) this._loadedScripts.add('js/' + cleanSrc);
        if (cleanSrc.startsWith('js/')) this._loadedScripts.add(cleanSrc.substring(3));
        if (this._inFlightScripts) {
          this._inFlightScripts.delete(src);
          this._inFlightScripts.delete(cleanSrc);
        }
        script.onload = null;
        script.onerror = null;
        resolve();
      };
      script.onerror = () => {
        console.warn(`Impossibile caricare script ${finalSrc}`);
        if (this._inFlightScripts) {
          this._inFlightScripts.delete(src);
          this._inFlightScripts.delete(cleanSrc);
        }
        script.onload = null;
        script.onerror = null;
        resolve(); // resolve anyway to avoid hanging UI
      };
      document.head.appendChild(script);
    });
    if (!forceReload) {
      if (!this._inFlightScripts) this._inFlightScripts = new Map();
      this._inFlightScripts.set(src, p);
      this._inFlightScripts.set(cleanSrc, p);
    }
    return p;
  },

  /**
   * Return current season number dynamically
   */
  getCurrentSeason() {
    if (typeof window !== 'undefined' && window.FCM_CURRENT_SEASON) {
      const cs = parseInt(window.FCM_CURRENT_SEASON, 10);
      if (!isNaN(cs) && cs > 0) return cs;
    }
    if (typeof arrDirectory !== 'undefined' && Array.isArray(arrDirectory)) {
      const dotEntry = arrDirectory.find(d => d && (d.Directory === '.' || d.Directory === './'));
      if (dotEntry && dotEntry.Stagione) return Number(dotEntry.Stagione);
    }
    if (typeof stagione !== 'undefined') {
      const s = parseInt(stagione, 10);
      if (!isNaN(s) && s > 0) return s;
    }
    if (typeof arrDirectory !== 'undefined' && Array.isArray(arrDirectory)) {
      let maxS = 0;
      for (let i = 1; i < arrDirectory.length; i++) {
        if (arrDirectory[i] && arrDirectory[i].Stagione > maxS) {
          maxS = arrDirectory[i].Stagione;
        }
      }
      if (maxS > 0) return maxS;
    }
    return 1;
  },

  /**
   * Check if a season (past or current) uses ModernFCM skin
   */
  isModernSeason(seasonNum) {
    const s = Number(seasonNum);
    if (isNaN(s) || s <= 0) return false;
    const cur = this.getCurrentSeason();
    if (s === cur) return true;
    if (typeof window !== 'undefined' && window.FCM_MODERN_SEASONS) {
      if (Array.isArray(window.FCM_MODERN_SEASONS)) {
        return window.FCM_MODERN_SEASONS.map(Number).includes(s);
      }
      if (typeof window.FCM_MODERN_SEASONS === 'object') {
        return !!window.FCM_MODERN_SEASONS[s];
      }
    }
    return false;
  },

  /**
   * Return directory path for a season (e.g. "Stagione_1", "Stagione_13")
   */
  getSeasonDirectory(seasonNum) {
    const s = Number(seasonNum);
    const cur = this.getCurrentSeason();
    if (s === cur) return '';
    if (typeof arrDirectory !== 'undefined' && Array.isArray(arrDirectory)) {
      const dObj = arrDirectory.find(d => d && Number(d.Stagione) === s);
      if (dObj && dObj.Directory && dObj.Directory !== '.') {
        return String(dObj.Directory).replace(/^\.\//, '').replace(/\/$/, '');
      }
    }
    return `Stagione_${s}`;
  },

  /**
   * Get basic league metadata dynamically
   */
  getLeagueInfo() {
    return {
      name: typeof nomelega !== 'undefined' ? nomelega : "ModernFCM",
      season: this.getCurrentSeason(),
      year: typeof anno !== 'undefined' ? anno : "",
      updated: typeof aggiornamento !== 'undefined' ? aggiornamento : "",
      webmaster: typeof WebmasterNome !== 'undefined' ? WebmasterNome : "",
      email: typeof WebmasterEmail !== 'undefined' ? WebmasterEmail : "",
      sponsors: (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.getSponsors === 'function')
        ? fcmHomeConfigManager.getSponsors()
        : [],
      defaultTheme: typeof DefaultTheme !== 'undefined' ? DefaultTheme : 'light',
      news: []
    };
  },

  /**
   * Map role ID to string name & badge
   */
  getRoleShort(roleId) {
    switch (parseInt(roleId)) {
      case 1: return 'P';
      case 2: return 'D';
      case 3: return 'C';
      case 4: return 'A';
      default: return '-';
    }
  },

  getRoleName(roleId) {
    switch (parseInt(roleId)) {
      case 1: return 'Portiere';
      case 2: return 'Difensore';
      case 3: return 'Centrocampista';
      case 4: return 'Attaccante';
      default: return 'Giocatore';
    }
  },

  getRoleClass(roleId) {
    switch (parseInt(roleId)) {
      case 1: return 'role-p';
      case 2: return 'role-d';
      case 3: return 'role-c';
      case 4: return 'role-a';
      default: return '';
    }
  },

  /**
   * Return SVG vector lines for tactical pitch with exact regulatory proportions
   * Pitch: 110m x 70m | Area Rigore: 40m x 16.5m | Area Piccola: 11m x 5.5m
   * Dischetto: 11m | Cerchio & Lunetta R: 9.15m | Porte fuori campo: 7.32m x 2.44m | Angoli R: 1m
   */
  getPitchSvgLines() {
    return `<svg class="pitch-svg-lines" viewBox="0 0 770 1210" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Rettangolo di gioco (110m x 70m) -->
      <rect x="35" y="55" width="700" height="1100" fill="none" stroke="currentColor" stroke-width="2.5" />

      <!-- Linea di metà campo e cerchio di centrocampo (R = 9.15m) -->
      <line x1="35" y1="605" x2="735" y2="605" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="605" r="91.5" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="605" r="4" fill="currentColor" />

      <!-- Area di rigore superiore (40m x 16.5m) e area piccola (11m x 5.5m) -->
      <rect x="185" y="55" width="400" height="165" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="330" y="55" width="110" height="55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="165" r="4" fill="currentColor" />
      <path d="M 311.88,220 A 91.5,91.5 0 0,0 458.12,220" fill="none" stroke="currentColor" stroke-width="2.5" />

      <!-- Area di rigore inferiore (40m x 16.5m) e area piccola (11m x 5.5m) -->
      <rect x="185" y="990" width="400" height="165" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="330" y="1100" width="110" height="55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="385" cy="1045" r="4" fill="currentColor" />
      <path d="M 311.88,990 A 91.5,91.5 0 0,1 458.12,990" fill="none" stroke="currentColor" stroke-width="2.5" />

      <!-- Porte esterne al campo (7.32m x 2.44m) -->
      <rect x="348.4" y="30.6" width="73.2" height="24.4" fill="rgba(255,255,255,0.08)" stroke="currentColor" stroke-width="2.5" />
      <line x1="366.7" y1="30.6" x2="366.7" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="385" y1="30.6" x2="385" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="403.3" y1="30.6" x2="403.3" y2="55" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="348.4" y1="42.8" x2="421.6" y2="42.8" stroke="currentColor" stroke-width="1" opacity="0.35" />

      <rect x="348.4" y="1155" width="73.2" height="24.4" fill="rgba(255,255,255,0.08)" stroke="currentColor" stroke-width="2.5" />
      <line x1="366.7" y1="1155" x2="366.7" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="385" y1="1155" x2="385" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="403.3" y1="1155" x2="403.3" y2="1179.4" stroke="currentColor" stroke-width="1" opacity="0.35" />
      <line x1="348.4" y1="1167.2" x2="421.6" y2="1167.2" stroke="currentColor" stroke-width="1" opacity="0.35" />

      <!-- Quarti di cerchio bandierine d'angolo (R = 1m) -->
      <path d="M 35,65 A 10,10 0 0,0 45,55" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 725,55 A 10,10 0 0,0 735,65" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 45,1155 A 10,10 0 0,0 35,1145" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M 735,1145 A 10,10 0 0,0 725,1155" fill="none" stroke="currentColor" stroke-width="2.5" />
    </svg>`;
  },

  /**
   * Helper to check if a team (by ID or Name) is a real fantasy team in arrFantasquadre / arrClassifica / arrAdOFantasquadre
   */
  isRealTeam(teamIdOrName) {
    if (!teamIdOrName && teamIdOrName !== 0) return false;

    // Check if teamIdOrName is numeric ID
    if (typeof teamIdOrName === 'number' || (typeof teamIdOrName === 'string' && !isNaN(Number(teamIdOrName)) && teamIdOrName.trim() !== '')) {
      const tId = parseInt(teamIdOrName, 10);
      if (tId <= 0) return false;
      const teams = this.getTeams();
      if (teams && teams.length > 0 && teams.some(t => t && t.ID === tId)) {
        return true;
      }
      if (typeof arrClassifica !== 'undefined') {
        for (let i = 1; i < arrClassifica.length; i++) {
          if (arrClassifica[i] && arrClassifica[i].ID === tId) return true;
        }
      }
      if (typeof arrAdOFantasquadre !== 'undefined') {
        for (let i = 1; i < arrAdOFantasquadre.length; i++) {
          if (arrAdOFantasquadre[i] && (arrAdOFantasquadre[i].IDf === tId || arrAdOFantasquadre[i].idAttuale === tId)) return true;
        }
      }
      return false;
    }

    // Check if teamIdOrName is a string name
    if (typeof teamIdOrName === 'string') {
      const trimmed = teamIdOrName.trim().toLowerCase();
      if (!trimmed) return false;

      const teams = this.getTeams();
      if (teams && teams.length > 0) {
        if (teams.some(t => t && (t.Nome || t.name) && (t.Nome || t.name).trim().toLowerCase() === trimmed)) {
          return true;
        }
      }

      if (typeof arrClassifica !== 'undefined') {
        for (let i = 1; i < arrClassifica.length; i++) {
          if (arrClassifica[i] && arrClassifica[i].Nome && arrClassifica[i].Nome.trim().toLowerCase() === trimmed) return true;
        }
      }

      if (typeof arrAdOFantasquadre !== 'undefined') {
        for (let i = 1; i < arrAdOFantasquadre.length; i++) {
          const adName = arrAdOFantasquadre[i] ? (arrAdOFantasquadre[i].nome || arrAdOFantasquadre[i].Nome) : '';
          if (adName && adName.trim().toLowerCase() === trimmed) return true;
        }
      }
    }

    return false;
  },

  /**
   * Returns path to fantasquadra jersey / logo from img/sq/
   * Supports team ID (number/string) or direct team Name string
   */
  getTeamLogo(teamIdOrName) {
    if (!teamIdOrName) return 'img/sq/undefined.svg';

    let teamName = '';

    if (typeof teamIdOrName === 'string' && isNaN(Number(teamIdOrName))) {
      teamName = teamIdOrName.trim();
    } else {
      const tId = parseInt(teamIdOrName, 10);
      if (typeof arrFantasquadre !== 'undefined') {
        for (let i = 1; i < arrFantasquadre.length; i++) {
          if (arrFantasquadre[i] && arrFantasquadre[i].ID === tId) {
            teamName = arrFantasquadre[i].Nome;
            break;
          }
        }
      }
      if (!teamName && typeof arrClassifica !== 'undefined') {
        for (let i = 1; i < arrClassifica.length; i++) {
          if (arrClassifica[i] && arrClassifica[i].ID === tId) {
            teamName = arrClassifica[i].Nome;
            break;
          }
        }
      }
      if (!teamName && typeof arrAdOFantasquadre !== 'undefined') {
        for (let i = 1; i < arrAdOFantasquadre.length; i++) {
          if (arrAdOFantasquadre[i] && (arrAdOFantasquadre[i].IDf === tId || arrAdOFantasquadre[i].idAttuale === tId)) {
            teamName = arrAdOFantasquadre[i].nome || arrAdOFantasquadre[i].Nome;
            break;
          }
        }
      }
    }

    if (!teamName || !this.isRealTeam(teamName)) {
      return this._resolvePath('img/sq/undefined.svg');
    }

    return this._resolvePath(`img/sq/${encodeURIComponent(teamName)}.png`);
  },

  /**
   * Returns path to Serie A team jersey
   */
  getSerieAShirt(teamName) {
    if (!teamName) return '';
    const cleanTeam = String(teamName).trim();
    if (cleanTeam.includes(',') || cleanTeam.includes('/')) {
      const first = cleanTeam.split(/[,/]/)[0].trim();
      return this.getSerieAShirt(first);
    }
    if (
      cleanTeam === '{ELIMINATA}' ||
      cleanTeam.toUpperCase() === '{ELIMINATA}' ||
      cleanTeam === 'ELIMINATA'
    ) {
      return this._resolvePath('img/sq/{ELIMINATA}.png');
    }
    if (
      cleanTeam === '{SERIE ESTERA}' ||
      cleanTeam.toUpperCase() === '{SERIE ESTERA}' ||
      cleanTeam === 'SERIE ESTERA'
    ) {
      return this._resolvePath('img/sq/{SERIE ESTERA}.png');
    }
    if (
      cleanTeam === '{SERIE MINORE}' ||
      cleanTeam.toUpperCase() === '{SERIE MINORE}' ||
      cleanTeam === 'SERIE MINORE'
    ) {
      return this._resolvePath('img/sq/{SERIE MINORE}.png');
    }
    return this._resolvePath(`img/sq/${encodeURIComponent(cleanTeam)}.png`);
  },

  /**
   * Returns path to Serie A team crest / logo from img/sq/logo
   */
  getSerieALogo(teamName) {
    if (!teamName) return this._resolvePath('img/sq/undefined.svg');
    const cleanTeam = String(teamName).trim();
    if (cleanTeam.includes(',') || cleanTeam.includes('/')) {
      const first = cleanTeam.split(/[,/]/)[0].trim();
      return this.getSerieALogo(first);
    }
    if (
      cleanTeam === '{ELIMINATA}' ||
      cleanTeam.toUpperCase() === '{ELIMINATA}' ||
      cleanTeam === 'ELIMINATA'
    ) {
      return this._resolvePath('img/sq/logo/{ELIMINATA}.png');
    }
    if (
      cleanTeam === '{SERIE ESTERA}' ||
      cleanTeam.toUpperCase() === '{SERIE ESTERA}' ||
      cleanTeam === 'SERIE ESTERA'
    ) {
      return this._resolvePath('img/sq/logo/{SERIE ESTERA}.png');
    }
    if (
      cleanTeam === '{SERIE MINORE}' ||
      cleanTeam.toUpperCase() === '{SERIE MINORE}' ||
      cleanTeam === 'SERIE MINORE'
    ) {
      return this._resolvePath('img/sq/logo/{SERIE MINORE}.png');
    }
    return this._resolvePath(`img/sq/logo/${encodeURIComponent(cleanTeam)}.png`);
  },

  /**
   * Alias for getSerieALogo to return Serie A club crest / badge
   */
  getClubBadge(teamName) {
    return this.getSerieALogo(teamName);
  },


  /**
   * Helper: Find defending winner for a competition (from LukeskyScudo.js)
   * Resolves the winning team of the previous season (or latest completed season)
   */
  cercaVincitore(competizione) {
    if (typeof arrAdOPosizioni === 'undefined') return null;
    const curStag = this.getCurrentSeason();
    const targetStag = curStag > 1 ? curStag - 1 : 1;
    const cId = Number(competizione);

    // 1. Cercare prima nella stagione precedente (stagione - 1) come in LukeskyScudo
    for (let p = 1; p < arrAdOPosizioni.length; p++) {
      const pos = arrAdOPosizioni[p];
      if (pos) {
        const s = pos.stagione !== undefined ? pos.stagione : pos.Stagione;
        const c = pos.idCompetizione !== undefined ? pos.idCompetizione : pos.IDCompetizione;
        const pNum = pos.posizione !== undefined ? pos.posizione : pos.Posizione;
        const sqId = pos.idSquadra !== undefined ? pos.idSquadra : pos.IDFantasquadra;
        if (s === targetStag && Number(c) === cId && pNum === 1) {
          return this.cercaSquadraAlboAttuale(sqId);
        }
      }
    }

    // 2. Se non presente in targetStag, cercare nell'ultima stagione completata per questa competizione
    const allWinners = [];
    for (let p = 1; p < arrAdOPosizioni.length; p++) {
      const pos = arrAdOPosizioni[p];
      if (pos) {
        const c = pos.idCompetizione !== undefined ? pos.idCompetizione : pos.IDCompetizione;
        const pNum = pos.posizione !== undefined ? pos.posizione : pos.Posizione;
        if (Number(c) === cId && pNum === 1) {
          allWinners.push(pos);
        }
      }
    }
    if (allWinners.length > 0) {
      allWinners.sort((a, b) => {
        const sA = a.stagione !== undefined ? a.stagione : (a.Stagione !== undefined ? a.Stagione : (a.anno || a.Anno || 0));
        const sB = b.stagione !== undefined ? b.stagione : (b.Stagione !== undefined ? b.Stagione : (b.anno || b.Anno || 0));
        return sB - sA;
      });
      const topWinner = allWinners[0];
      const sqId = topWinner.idSquadra !== undefined ? topWinner.idSquadra : topWinner.IDFantasquadra;
      return this.cercaSquadraAlboAttuale(sqId);
    }

    return null;
  },

  /**
   * Helper: Resolve actual current team name from Albo team code (from LukeskyScudo.js)
   */
  cercaSquadraAlboAttuale(codice) {
    if (typeof arrAdOFantasquadre === 'undefined') return null;
    const cNum = Number(codice);
    for (let s = 1; s < arrAdOFantasquadre.length; s++) {
      const alboTeam = arrAdOFantasquadre[s];
      if (alboTeam) {
        const tId = alboTeam.IDf !== undefined ? alboTeam.IDf : (alboTeam.id !== undefined ? alboTeam.id : alboTeam.ID);
        if (Number(tId) === cNum) {
          let name = alboTeam.nome || alboTeam.name || alboTeam.Nome;
          let idAttuale = alboTeam.idAttuale !== undefined ? alboTeam.idAttuale : (alboTeam.IDAttuale !== undefined ? alboTeam.IDAttuale : (alboTeam.currentId || 0));
          if (idAttuale !== 0) {
            const actualName = this.cercaSquadra(idAttuale);
            if (actualName) name = actualName;
          }
          return { name, idAttuale };
        }
      }
    }
    return null;
  },

  /**
   * Helper: Resolve fantasy team name from current ID (from LukeskyScudo.js)
   */
  cercaSquadra(codiceAt) {
    const teams = this.getTeams();
    const t = teams.find(team => team.ID === parseInt(codiceAt, 10));
    return t ? t.Nome : null;
  },

  /**
   * Return array of trophy HTML badges for team.
   * Dynamically evaluates all competitions defined in arrPalmares (persjs/fcmConfrontiDati.js),
   * matching defending winners from arrAdOPosizioni without any hardcoding (LukeskyScudo logic).
   */
  getTeamTrophiesHtml(teamIdentifier, teamId = null) {
    if (!teamIdentifier && !teamId) return '';

    if (!this._defendingWinnersCache) {
      if (typeof arrPalmares === 'undefined' || typeof arrAdOPosizioni === 'undefined') {
        if (typeof arrPalmares === 'undefined' && !this._loadingConfrontiForTrophies) {
          this._loadingConfrontiForTrophies = true;
          this.loadConfronti().then(() => {
            this._defendingWinnersCache = null;
          }).catch(() => { }).finally(() => {
            this._loadingConfrontiForTrophies = false;
          });
        }
        if (typeof arrAdOPosizioni === 'undefined' && !this._loadingAlboForTrophies) {
          this._loadingAlboForTrophies = true;
          this.loadScript('js/fcmAlboDOroDati.js').then(() => {
            this._defendingWinnersCache = null;
          }).catch(() => { }).finally(() => {
            this._loadingAlboForTrophies = false;
          });
        }
        return '';
      }

      this._defendingWinnersCache = [];
      for (let i = 1; i < arrPalmares.length; i++) {
        const pal = arrPalmares[i];
        if (!pal) continue;
        const cId = pal.Competizione || pal.compId || pal.id;
        if (!cId || cId === 0) continue;
        const res = this.cercaVincitore(cId);
        if (res && res.name) {
          this._defendingWinnersCache.push({
            compId: cId,
            label: pal.Label || pal.label || pal.name || `Comp ${cId}`,
            icon: pal.Icona || pal.icon || 'ico-scudetto.gif',
            winnerName: res.name,
            idAttuale: res.idAttuale
          });
        }
      }
    }

    const norm = (s) => (s || '').toString().trim().toLowerCase();
    const targetNorm = norm(teamIdentifier);
    const parsedId = parseInt(teamId || teamIdentifier, 10);

    let html = '';
    for (const w of this._defendingWinnersCache) {
      const matchByName = (targetNorm && norm(w.winnerName) === targetNorm);
      const matchById = (!isNaN(parsedId) && parsedId > 0 && w.idAttuale === parsedId);
      if (matchByName || matchById) {
        const smallIcon = this._resolvePath(`img/small-${w.icon}`);
        const mainIcon = this._resolvePath(`img/${w.icon}`);
        html += `<img src="${smallIcon}" onerror="this.onerror=null;this.src='${mainIcon}';" alt="${w.label}" title="Detentore ${w.label}" style="height:16px;width:auto;vertical-align:middle;margin-left:4px;" />`;
      }
    }

    return html;
  },

  /**
   * Return all fantasy teams in league
   */
  getTeams() {
    if (typeof arrFantasquadre === 'undefined') return [];
    const teams = [];
    for (let i = 1; i < arrFantasquadre.length; i++) {
      if (arrFantasquadre[i]) {
        teams.push(arrFantasquadre[i]);
      }
    }
    return teams;
  },

  getTeamById(id) {
    const teams = this.getTeams();
    return teams.find(t => t.ID === parseInt(id));
  },

  /**
   * Verifica se un ID o Nome squadra corrisponde alla Squadra del Cuore
   */
  isFavoriteTeam(teamIdOrName) {
    if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.isFavoriteTeam === 'function') {
      return fcmHomeConfigManager.isFavoriteTeam(teamIdOrName);
    }
    return false;
  },

  /**
   * Return newspaper vote sources from arrQuotidiani (fcmSerieADati.js)
   */
  async getQuotidiani() {
    if (typeof arrQuotidiani === 'undefined') {
      await this.loadScript('js/fcmSerieADati.js');
    }
    if (typeof arrQuotidiani === 'undefined') return [];
    const list = [];
    for (let i = 1; i < arrQuotidiani.length; i++) {
      if (arrQuotidiani[i]) {
        list.push({
          id: arrQuotidiani[i].ID,
          name: arrQuotidiani[i].Nome
        });
      }
    }
    return list;
  },

  /**
   * Return roster players for a team, separated by active squad, svincolati, infortunati
   */
  getTeamRoster(teamId) {
    if (typeof arrRose === 'undefined') return { attuali: [], svincolati: [], infortunati: [], all: [] };
    const tId = parseInt(teamId);
    const attuali = [];
    const svincolati = [];
    const infortunati = [];
    const all = [];

    for (let i = 1; i < arrRose.length; i++) {
      const r = arrRose[i];
      if (r && r.IDSquadra === tId) {
        const pName = typeof r.Nome === 'string' ? r.Nome : (r.Nome ? String(r.Nome) : 'Calciatore');
        const serieATeam = typeof r.Squadra === 'string' ? r.Squadra : '';
        const isSerieA = this.isSerieATeam(serieATeam);
        const serieAPlayer = isSerieA ? this.getSerieAPlayer(pName) : null;
        const p = {
          teamId: r.IDSquadra,
          role: r.Ruolo,
          name: pName,
          serieATeam: serieATeam,
          isSerieA: isSerieA && !!serieAPlayer,
          playerId: serieAPlayer ? serieAPlayer.ID : null,
          state: r.Stato, // 0 = rosa, 1 = svincolato, 2 = infortunato
          contract: (r.Contratto === -1) ? 'Inf' : ((r.Contratto === -2) ? 'Pres' : r.Contratto),
          cost: r.Acq,
          sellValue: r.Svinc,
          gioInf: r.GioInf || 0
        };
        all.push(p);

        if (r.Stato === 0) {
          attuali.push(p);
        } else if (r.Stato === 1) {
          svincolati.push(p);
        } else if (r.Stato === 2) {
          infortunati.push(p);
        }
      }
    }

    // Sort active by role (1,2,3,4) then by cost desc
    const sortByRoleAndCost = (a, b) => {
      if (a.role !== b.role) return a.role - b.role;
      return b.cost - a.cost;
    };

    attuali.sort(sortByRoleAndCost);
    svincolati.sort(sortByRoleAndCost);
    infortunati.sort(sortByRoleAndCost);
    all.sort(sortByRoleAndCost);

    return { attuali, svincolati, infortunati, all };
  },

  /**
   * Return budget and financial ledger for a team
   */
  getTeamBudget(teamId) {
    const tId = parseInt(teamId);
    const transactions = [];
    if (typeof arrBilanci !== 'undefined') {
      for (let i = 1; i < arrBilanci.length; i++) {
        const b = arrBilanci[i];
        if (b && b.IDSquadra === tId) {
          transactions.push({
            teamId: b.IDSquadra,
            date: b.Data || '-',
            description: b.Descrizione || '-',
            value: b.Valore || 0,
            isIncome: (b.Valore || 0) >= 0
          });
        }
      }
    }
    const team = this.getTeamById(tId);
    const remainingCredits = (team && typeof team.CreditiResidui !== 'undefined') ? team.CreditiResidui : 0;
    return { transactions, remainingCredits };
  },

  /**
   * Search all players across all teams
   */
  searchPlayers(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const results = [];
    const teams = this.getTeams();
    const teamMap = new Map(teams.map(t => [t.ID, t]));

    for (let i = 1; i < arrRose.length; i++) {
      const r = arrRose[i];
      if (r) {
        const playerName = String(r.Nome || '').toLowerCase();
        if (playerName.includes(q)) {
          const pName = r.Nome;
          const serieATeam = r.Squadra || '';
          const isSerieA = this.isSerieATeam(serieATeam);
          const serieAPlayer = isSerieA ? this.getSerieAPlayer(pName) : null;
          results.push({
            name: pName,
            role: r.Ruolo,
            serieATeam: serieATeam,
            isSerieA: isSerieA && !!serieAPlayer,
            playerId: serieAPlayer ? serieAPlayer.ID : null,
            cost: r.Acq,
            team: teamMap.get(r.IDSquadra) || { ID: r.IDSquadra, Nome: 'Fantasquadra' }
          });
        }
      }
    }
    return results;
  },

  /**
   * Return all competitions & groups
   */
  getCompetitions() {
    if (typeof arrCompetizioni === 'undefined') return [];
    const comps = [];
    for (let i = 1; i < arrCompetizioni.length; i++) {
      const c = arrCompetizioni[i];
      if (c) {
        const gironi = [];
        if (typeof arrGironi !== 'undefined') {
          for (let j = 1; j < arrGironi.length; j++) {
            const g = arrGironi[j];
            if (g && g.IDComp === c.ID) {
              gironi.push(g);
            }
          }
        }
        comps.push({
          id: c.ID,
          name: c.Nome,
          isSingleGroup: c.GironeUnico,
          defaultGroupId: c.IDGironeSeUnico,
          isDefault: c.Predefinita,
          groups: gironi
        });
      }
    }
    return comps;
  },

  /**
   * Return Standings for a competition and/or group
   */
  getStandings(groupId) {
    if (typeof arrClassifica === 'undefined') return [];
    let gId = parseInt(groupId, 10);
    if (isNaN(gId)) {
      const comps = this.getCompetitions();
      const defComp = comps.find(c => c.isDefault) || comps[0];
      if (defComp && defComp.groups && defComp.groups.length > 0) {
        const firstGroup = defComp.groups[0];
        gId = (firstGroup && firstGroup.ID !== undefined) ? parseInt(firstGroup.ID, 10) : (firstGroup ? parseInt(firstGroup.id, 10) : NaN);
      }
      if (isNaN(gId)) {
        if (arrClassifica.length > 1 && arrClassifica[1]) {
          gId = parseInt(arrClassifica[1].IDGirone, 10);
        }
      }
    }
    const standings = [];

    for (let i = 1; i < arrClassifica.length; i++) {
      const c = arrClassifica[i];
      if (c && c.IDGirone === gId) {
        standings.push({
          teamId: c.ID,
          groupId: c.IDGirone,
          compId: c.IDCompetizione,
          pos: c.Pos,
          name: c.Nome,
          coach: c.Presidente,
          points: c.Punti,
          winsHome: c.PartiteVinte ? c.PartiteVinte.Casa : 0,
          winsAway: c.PartiteVinte ? c.PartiteVinte.Fuori : 0,
          winsTot: (c.PartiteVinte ? c.PartiteVinte.Casa + c.PartiteVinte.Fuori : 0),
          drawsHome: c.PartiteNulle ? c.PartiteNulle.Casa : 0,
          drawsAway: c.PartiteNulle ? c.PartiteNulle.Fuori : 0,
          drawsTot: (c.PartiteNulle ? c.PartiteNulle.Casa + c.PartiteNulle.Fuori : 0),
          lossesHome: c.PartitePerse ? c.PartitePerse.Casa : 0,
          lossesAway: c.PartitePerse ? c.PartitePerse.Fuori : 0,
          lossesTot: (c.PartitePerse ? c.PartitePerse.Casa + c.PartitePerse.Fuori : 0),
          played: (c.PartiteVinte ? c.PartiteVinte.Casa + c.PartiteVinte.Fuori : 0) +
            (c.PartiteNulle ? c.PartiteNulle.Casa + c.PartiteNulle.Fuori : 0) +
            (c.PartitePerse ? c.PartitePerse.Casa + c.PartitePerse.Fuori : 0),
          goalsFor: (c.RetiFatte ? c.RetiFatte.Casa + c.RetiFatte.Fuori : 0),
          goalsAgainst: (c.RetiSubite ? c.RetiSubite.Casa + c.RetiSubite.Fuori : 0),
          goalDiff: (c.RetiFatte ? c.RetiFatte.Casa + c.RetiFatte.Fuori : 0) -
            (c.RetiSubite ? c.RetiSubite.Casa + c.RetiSubite.Fuori : 0),
          goalsForHome: c.RetiFatte ? c.RetiFatte.Casa : 0,
          goalsAgainstHome: c.RetiSubite ? c.RetiSubite.Casa : 0,
          goalsForAway: c.RetiFatte ? c.RetiFatte.Fuori : 0,
          goalsAgainstAway: c.RetiSubite ? c.RetiSubite.Fuori : 0,
          mediaInglese: c.MI,
          mediaTotali: c.TMed || 0,
          minTotali: c.TMin || 0,
          maxTotali: c.TMax || 0,
          devStd: c.TDevSt || 0,
          devStdTotali: c.TDevSt || 0,
          mediaAvversari: c.TAvv || 0,
          mediaAvversariTotali: c.TAvv || 0,
          sommaTotali: c.TTot || 0,
          mediaParziali: c.PMed || 0,
          minParziali: c.PMin || 0,
          maxParziali: c.PMax || 0,
          devStdParziali: c.PDevSt || 0,
          mediaAvversariParziali: c.PAvv || 0,
          sommaParziali: c.PTot || 0,
          bonusMalus: c.bm
        });
      }
    }

    // Sort by official FCM position (tie-breakers: somma totali, then goal diff)
    standings.sort((a, b) => {
      if (a.pos && b.pos && a.pos !== b.pos) return a.pos - b.pos;
      if (b.points !== a.points) return b.points - a.points;
      if ((b.sommaTotali || 0) !== (a.sommaTotali || 0)) return (b.sommaTotali || 0) - (a.sommaTotali || 0);
      return (b.goalDiff || 0) - (a.goalDiff || 0);
    });

    return standings;
  },

  /**
   * Calcola la classifica di un girone aggiornata fino a una specifica giornata di Serie A (inclusa).
   * Utile per ricostruire la classifica di un turno passato o del turno precedente per calcolare i sorpassi.
   */
  getStandingsAtMatchday(groupId, maxSerieADay) {
    const baseStandings = this.getStandings(groupId);
    if (!baseStandings || baseStandings.length === 0) return [];
    const gId = baseStandings[0].groupId;
    const maxDay = parseInt(maxSerieADay, 10);
    if (isNaN(maxDay) || typeof arrIncontri === 'undefined' || !Array.isArray(arrIncontri)) {
      return baseStandings;
    }

    const INC_RIPOSO_VAL = (typeof INC_RIPOSO !== 'undefined') ? INC_RIPOSO : 2;

    let maxPlayedDayInGroup = 0;
    let playedUpToTarget = 0;
    for (let i = 1; i < arrIncontri.length; i++) {
      const inc = arrIncontri[i];
      if (!inc || inc.IDGirone !== gId || inc.Giocato !== 1 || inc.IDTipo === INC_RIPOSO_VAL) continue;
      if (inc.GiornataDiA > maxPlayedDayInGroup) maxPlayedDayInGroup = inc.GiornataDiA;
      if (inc.GiornataDiA <= maxDay) playedUpToTarget++;
    }

    if (playedUpToTarget === 0) return [];

    if (maxDay >= maxPlayedDayInGroup) {
      return baseStandings;
    }

    const teamsMap = {};
    baseStandings.forEach(t => {
      teamsMap[t.teamId] = {
        teamId: t.teamId,
        groupId: t.groupId,
        compId: t.compId,
        pos: 0,
        name: t.name,
        coach: t.coach || '',
        points: parseFloat(t.bonusMalus) || 0,
        winsHome: 0, winsAway: 0, winsTot: 0,
        drawsHome: 0, drawsAway: 0, drawsTot: 0,
        lossesHome: 0, lossesAway: 0, lossesTot: 0,
        played: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
        sommaTotali: 0,
        sommaParziali: 0,
        bonusMalus: t.bonusMalus || 0
      };
    });

    for (let i = 1; i < arrIncontri.length; i++) {
      const inc = arrIncontri[i];
      if (!inc || inc.IDGirone !== gId || inc.Giocato !== 1 || inc.IDTipo === INC_RIPOSO_VAL) continue;
      if (inc.GiornataDiA > maxDay) continue;

      const hId = inc.IDSquadre ? inc.IDSquadre.Casa : 0;
      const aId = inc.IDSquadre ? inc.IDSquadre.Fuori : 0;
      const hG = (inc.Gol && typeof inc.Gol.Casa === 'number') ? inc.Gol.Casa : (parseInt(inc.Gol && inc.Gol.Casa, 10) || 0);
      const aG = (inc.Gol && typeof inc.Gol.Fuori === 'number') ? inc.Gol.Fuori : (parseInt(inc.Gol && inc.Gol.Fuori, 10) || 0);
      const hT = (inc.Totali && typeof inc.Totali.Casa === 'number') ? inc.Totali.Casa : (parseFloat(inc.Totali && inc.Totali.Casa) || 0);
      const aT = (inc.Totali && typeof inc.Totali.Fuori === 'number') ? inc.Totali.Fuori : (parseFloat(inc.Totali && inc.Totali.Fuori) || 0);
      const hP = (inc.Parziali && typeof inc.Parziali.Casa === 'number') ? inc.Parziali.Casa : (parseFloat(inc.Parziali && inc.Parziali.Casa) || 0);
      const aP = (inc.Parziali && typeof inc.Parziali.Fuori === 'number') ? inc.Parziali.Fuori : (parseFloat(inc.Parziali && inc.Parziali.Fuori) || 0);

      if (teamsMap[hId]) {
        const h = teamsMap[hId];
        h.played++;
        h.goalsFor += hG;
        h.goalsAgainst += aG;
        h.goalDiff = h.goalsFor - h.goalsAgainst;
        h.sommaTotali = Math.round((h.sommaTotali + hT) * 100) / 100;
        h.sommaParziali = Math.round((h.sommaParziali + hP) * 100) / 100;
        if (hG > aG) { h.winsHome++; h.winsTot++; h.points += 3; }
        else if (hG === aG) { h.drawsHome++; h.drawsTot++; h.points += 1; }
        else { h.lossesHome++; h.lossesTot++; }
      }

      if (teamsMap[aId]) {
        const a = teamsMap[aId];
        a.played++;
        a.goalsFor += aG;
        a.goalsAgainst += hG;
        a.goalDiff = a.goalsFor - a.goalsAgainst;
        a.sommaTotali = Math.round((a.sommaTotali + aT) * 100) / 100;
        a.sommaParziali = Math.round((a.sommaParziali + aP) * 100) / 100;
        if (aG > hG) { a.winsAway++; a.winsTot++; a.points += 3; }
        else if (aG === hG) { a.drawsAway++; a.drawsTot++; a.points += 1; }
        else { a.lossesAway++; a.lossesTot++; }
      }
    }

    const list = Object.values(teamsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if ((b.sommaTotali || 0) !== (a.sommaTotali || 0)) return (b.sommaTotali || 0) - (a.sommaTotali || 0);
      if ((b.goalDiff || 0) !== (a.goalDiff || 0)) return (b.goalDiff || 0) - (a.goalDiff || 0);
      if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
      return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
    });

    list.forEach((t, idx) => { t.pos = idx + 1; });
    return list;
  },

  /**
   * Return Grand Prix Standings (Classifica GP - Somma Totali)
   * Ordered by sommaTotali descending
   */
  getGPStandings(groupId = 1) {
    const standings = this.getStandings(groupId);
    const gp = [...standings].sort((a, b) => (b.sommaTotali || 0) - (a.sommaTotali || 0));
    return gp.map((s, idx) => ({
      ...s,
      gpPos: idx + 1
    }));
  },

  /**
   * Return standardized standings data structure (teams list with rank, teamName, points, totalScore, etc.)
   */
  getStandingsData(groupId) {
    const standings = this.getStandings(groupId);
    return {
      teams: (standings || []).map(s => ({
        rank: s.pos,
        teamId: s.teamId,
        teamName: s.name,
        coach: s.coach,
        points: s.points,
        totalScore: s.totPunti || s.sommaTotali || 0,
        played: s.played,
        wins: s.winsTot,
        draws: s.drawsTot,
        losses: s.lossesTot,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDiff: s.goalDiff
      }))
    };
  },

  /**
   * Calendar analysis:
   * Returns list of matchdays, matches, and detects current / next matchday.
   */
  getCalendarData() {
    if (typeof arrIncontri === 'undefined') return { matchdays: [], matches: [], lastPlayed: 1, nextMatchday: 1 };

    const matches = [];
    const matchdaysMap = new Map();
    let maxPlayedDay = 0;
    let minUnplayedDay = 999;

    for (let i = 1; i < arrIncontri.length; i++) {
      const inc = arrIncontri[i];
      if (inc) {
        const isRealPlayed = (inc.Giocato === 1 && inc.IDTipo !== INC_RIPOSO);

        const item = {
          id: inc.ID,
          type: inc.IDTipo,
          isRiposo: inc.IDTipo === INC_RIPOSO,
          played: isRealPlayed,
          fantagiornataId: inc.IDFantagiornata,
          fantagiornataNome: inc.Fantagiornata,
          compId: inc.IDCompetizione,
          compName: inc.Competizione,
          groupId: inc.IDGirone,
          groupName: inc.Girone,
          serieADay: inc.GiornataDiA,
          homeTeamId: inc.IDSquadre ? inc.IDSquadre.Casa : 0,
          awayTeamId: inc.IDSquadre ? inc.IDSquadre.Fuori : 0,
          homeTeamName: inc.Nomi ? inc.Nomi.Casa : '',
          awayTeamName: inc.Nomi ? inc.Nomi.Fuori : '',
          homeGoals: inc.Gol ? inc.Gol.Casa : 0,
          awayGoals: inc.Gol ? inc.Gol.Fuori : 0,
          homePartial: inc.Parziali ? inc.Parziali.Casa : 0,
          awayPartial: inc.Parziali ? inc.Parziali.Fuori : 0,
          homeTotal: inc.Totali ? inc.Totali.Casa : 0,
          awayTotal: inc.Totali ? inc.Totali.Fuori : 0
        };
        matches.push(item);

        // Group by matchday
        const key = item.serieADay;
        if (!matchdaysMap.has(key)) {
          matchdaysMap.set(key, {
            serieADay: item.serieADay,
            name: item.fantagiornataNome,
            played: isRealPlayed,
            matches: []
          });
        }
        matchdaysMap.get(key).matches.push(item);
        if (isRealPlayed) {
          matchdaysMap.get(key).played = true;
        }

        if (isRealPlayed && item.serieADay > maxPlayedDay) {
          maxPlayedDay = item.serieADay;
        }
        if (!isRealPlayed && !item.isRiposo && item.serieADay < minUnplayedDay) {
          minUnplayedDay = item.serieADay;
        }
      }
    }

    const matchdays = Array.from(matchdaysMap.values()).sort((a, b) => a.serieADay - b.serieADay);
    const maxA = typeof MaxA !== 'undefined' ? MaxA : 38;
    const lastPlayed = maxPlayedDay > 0 ? Math.min(maxA, maxPlayedDay) : 0;
    let nextMatchday = Math.min(
      maxA,
      minUnplayedDay < 999
        ? minUnplayedDay
        : (lastPlayed > 0 ? (lastPlayed >= maxA ? maxA : lastPlayed + 1) : (matchdays[0] ? matchdays[0].serieADay : 1))
    );

    // Se tutti i match risultano giocati (es. archivio o calendario non ancora azzerato per la nuova stagione),
    // verifica se sono disponibili default server o termineInvio
    if (minUnplayedDay >= 999 || nextMatchday >= maxA) {
      if (typeof defaultProxGio !== 'undefined' && defaultProxGio >= 1 && defaultProxGio <= maxA) {
        nextMatchday = defaultProxGio;
      } else if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.giornataDiA) {
        nextMatchday = parseInt(termineInvio.giornataDiA, 10);
      }
    }

    return {
      matchdays,
      matches,
      lastPlayed,
      nextMatchday
    };
  },

  /**
   * Restituisce l'ultima giornata disputata basandosi su arrIncontri / calendario
   */
  getLastPlayedMatchday() {
    const maxA = typeof MaxA !== 'undefined' ? MaxA : 38;
    if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri) && arrIncontri.length > 1) {
      for (let i = arrIncontri.length - 1; i >= 1; i--) {
        if (arrIncontri[i] && arrIncontri[i].Giocato && arrIncontri[i].IDTipo !== INC_RIPOSO) {
          return Math.min(maxA, parseInt(arrIncontri[i].GiornataDiA, 10));
        }
      }
    }
    const cal = this.getCalendarData();
    if (cal && cal.lastPlayed > 0) return cal.lastPlayed;
    return 1;
  },

  /**
   * Restituisce la prossima giornata da giocare basandosi su default server, termine invio e calendario
   */
  getUpcomingMatchday() {
    const maxA = typeof MaxA !== 'undefined' ? MaxA : 38;
    if (typeof defaultProxGio !== 'undefined' && defaultProxGio >= 1 && defaultProxGio <= maxA) {
      return defaultProxGio;
    }
    if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.giornataDiA && termineInvio.giornataDiA >= 1 && termineInvio.giornataDiA <= maxA) {
      return parseInt(termineInvio.giornataDiA, 10);
    }
    const cal = this.getCalendarData();
    if (cal && cal.nextMatchday > 0) {
      return Math.min(maxA, cal.nextMatchday);
    }
    const last = this.getLastPlayedMatchday();
    return Math.min(maxA, last + 1);
  },

  /**
   * Return matchday matches and summary for a Serie A matchday
   */
  getResultsData(serieADay) {
    const day = parseInt(serieADay, 10);
    const cal = this.getCalendarData();
    const dayMatches = (cal && cal.matches) ? cal.matches.filter(m => m.serieADay === day) : [];

    // Tabellini se presenti in cache
    const tabellini = this._risultatiCache && this._risultatiCache[day] ? this._risultatiCache[day] : null;

    const matches = dayMatches.map(m => {
      const matchObj = {
        id: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        homeScore: m.homeGoals,
        awayScore: m.awayGoals,
        homeTotal: m.homeTotal,
        awayTotal: m.awayTotal,
        homePartial: m.homePartial,
        awayPartial: m.awayPartial,
        played: m.played,
        compName: m.compName,
        fantagiornataNome: m.fantagiornataNome,
        events: []
      };

      if (tabellini && tabellini.length > 0) {
        const homeTab = tabellini.find(t => t.matchId === m.id && t.teamId === m.homeTeamId);
        const awayTab = tabellini.find(t => t.matchId === m.id && t.teamId === m.awayTeamId);

        const extractEvents = (tab, teamName) => {
          if (!tab || !tab.players) return;
          tab.players.forEach(p => {
            const bm = p.bonusMalus !== undefined ? String(p.bonusMalus) : (p.modifiers !== undefined ? String(p.modifiers) : '');
            if (bm && (bm.includes('+3') || parseFloat(bm) >= 3)) {
              const count = bm.includes('+3') ? (bm.match(/\+3/g) || []).length : Math.max(1, Math.floor(parseFloat(bm) / 3));
              for (let c = 0; c < count; c++) {
                matchObj.events.push({ type: 'gol', playerName: p.name, teamName: teamName });
              }
            }
          });
        };

        extractEvents(homeTab, m.homeTeamName);
        extractEvents(awayTab, m.awayTeamName);
      }

      return matchObj;
    });

    return {
      day,
      matches,
      playedMatches: matches.filter(m => m.played)
    };
  },

  /**
   * Estrae e ordina la formazione (titolari per ruolo, panchina per posizione e ruolo, tribuna per ruolo)
   * Restituisce un array 1-indexed (indice 0 = null) compatibile al 100% con gli standard FCM
   */
  _extractLineupFromArray(sourceArray, matchId, teamId, leagueId) {
    if (!sourceArray || !Array.isArray(sourceArray) || sourceArray.length <= 1) {
      return [];
    }
    const mId = parseInt(matchId, 10);
    const tId = parseInt(teamId, 10);
    const lId = leagueId ? parseInt(leagueId, 10) : 0;

    const players = [];
    for (let i = 1; i < sourceArray.length; i++) {
      const z = sourceArray[i];
      if (!z) continue;
      if (parseInt(z.IDIncontro, 10) === mId && parseInt(z.IDSquadra, 10) === tId && (!lId || parseInt(z.IDLega, 10) === lId)) {
        players.push(z);
      }
    }

    if (players.length === 0) return [];

    // Titolari: Pos === 0, ordinati per Ruolo (1: P, 2: D, 3: C, 4: A)
    const titolari = players.filter(p => p.Pos === 0).sort((a, b) => a.Ruolo - b.Ruolo);

    // Riserve/Panchina: Pos > 0, ordinati per Pos e secondariamente per Ruolo
    const panchina = players.filter(p => p.Pos > 0).sort((a, b) => {
      if (a.Pos !== b.Pos) return a.Pos - b.Pos;
      return a.Ruolo - b.Ruolo;
    });

    // Tribuna: Pos === -1, ordinati per Ruolo
    const tribuna = players.filter(p => p.Pos === -1).sort((a, b) => a.Ruolo - b.Ruolo);

    const res = [null];
    for (const p of titolari) res.push(p);
    for (const p of panchina) res.push(p);
    for (const p of tribuna) res.push(p);
    return res;
  },

  /**
   * Estrae la formazione schierata per un incontro dall'array arrFormazioni
   */
  getFormazione(matchId, teamId, leagueId) {
    if (typeof arrFormazioni === 'undefined') return [];
    return this._extractLineupFromArray(arrFormazioni, matchId, teamId, leagueId);
  },

  /**
   * Estrae la formazione della giornata precedente dall'array arrFormazioniPrecedenti
   */
  getFormazionePrecedente(matchId, teamId, leagueId) {
    if (typeof arrFormazioniPrecedenti === 'undefined') return [];
    return this._extractLineupFromArray(arrFormazioniPrecedenti, matchId, teamId, leagueId);
  },

  /**
   * Restituisce la lista degli incontri di una determinata giornata e competizione (escluso riposo)
   */
  getRiempiListaIncontri(giornata, competizione) {
    if (typeof arrIncontri === 'undefined' || !Array.isArray(arrIncontri)) return [];
    const g = parseInt(giornata, 10);
    const c = competizione ? parseInt(competizione, 10) : 0;
    const res = [null];
    for (let i = 1; i < arrIncontri.length; i++) {
      const inc = arrIncontri[i];
      if (!inc) continue;
      if (parseInt(inc.GiornataDiA, 10) === g && (c === 0 || parseInt(inc.IDCompetizione, 10) === c)) {
        if (inc.IDTipo !== INC_RIPOSO) {
          res.push(inc);
        }
      }
    }
    return res;
  },



  /**
   * Determina lo stato operativo e la disponibilità delle funzioni per la giornata corrente/prossima:
   * - inProgress: true se la giornata è in corso (termine scaduto e match non archiviati)
   * - isLiveEnabled: true se il modulo Live è attivato (ModLiveFantapazz o ModLiveVU)
   * - liveRoute: rotta per il live (#live di default)
   * - isInvformEnabled: true se il modulo Invio Formazione è attivato
   * - isFutureLineupUnlocked: true se è sbloccato l'invio formazione per la giornata successiva (disabilitaGiornata == 0)
   * - nextSubmittableDay: numero della giornata schierabile
   */
  async getMatchdayStatus() {
    const calendar = this.getCalendarData();
    const hasInvform = (typeof fcmModules === 'undefined' || fcmModules.hasInvioFormazione());
    const hasLiveFP = (typeof fcmModules === 'undefined' || fcmModules.hasliveFP());
    const hasLiveFM = (typeof fcmModules === 'undefined' || (fcmModules.hasLiveFM ? fcmModules.hasLiveFM() : true));
    const hasLiveFC = (typeof fcmModules === 'undefined' || (fcmModules.hasLiveFC ? fcmModules.hasLiveFC() : true));
    const hasLiveVU = (typeof fcmModules === 'undefined' || fcmModules.hasLiveVU());
    const isLiveEnabled = hasLiveFP || hasLiveFM || hasLiveFC || hasLiveVU;
    const liveRoute = '#live';

    // Assicura il caricamento di fcmInvioFormazioneDati.js per disabilitaGiornata se necessario
    if (typeof disabilitaGiornata === 'undefined' && hasInvform) {
      try {
        await this.loadScript('js/fcmInvioFormazioneDati.js');
      } catch (e) { }
    }

    // Carica orari invio formazione
    let schedule = {};
    try {
      schedule = await this.loadMatchSchedule(calendar.nextMatchday);
    } catch (e) { }

    const nextMatchSchedule = schedule[calendar.nextMatchday] || this.getMatchScheduleForDay(calendar.nextMatchday);

    let isMatchdayInProgress = false;
    let targetDeadline = null;
    let matchStartTime = null;

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
    } else if (!targetDeadline) {
      if (calendar.lastPlayed >= calendar.nextMatchday && calendar.lastPlayed > 0) {
        isMatchdayInProgress = true;
      }
    }

    const maxLimit = (typeof MaxA !== 'undefined' && MaxA > 0) ? MaxA : 38;
    const allowFutureLineups = hasInvform && (typeof disabilitaGiornata !== 'undefined' && parseInt(disabilitaGiornata, 10) === 0);
    const hasNextMatchday = calendar.nextMatchday < maxLimit;
    const isFutureLineupUnlocked = allowFutureLineups && hasNextMatchday;

    let nextSubmittableDay = calendar.nextMatchday;
    if (isMatchdayInProgress && hasNextMatchday) {
      nextSubmittableDay = calendar.nextMatchday + 1;
    }

    return {
      calendar,
      inProgress: isMatchdayInProgress,
      targetDeadline,
      matchStartTime,
      isInvformEnabled: hasInvform,
      isLiveEnabled,
      liveRoute,
      isFutureLineupUnlocked,
      nextSubmittableDay
    };
  },

  /**
   * Loads match schedule & deadlines directly from invform/invform.inc.php
   * (via invform.php endpoint on server, and direct text parsing as fallback)
   */
  async loadMatchSchedule(targetDay) {
    const day = targetDay || (this.getCalendarData().nextMatchday);

    if (this._scheduleCache && Object.keys(this._scheduleCache).length > 0) {
      return this._scheduleCache;
    }
    if (this._schedulePromise) {
      return this._schedulePromise;
    }

    this._schedulePromise = (async () => {
      // 1. Try PHP endpoint invform/invform.php?azione=ottieneTermine
      try {
        await this.loadScript(`invform/invform.php?azione=ottieneTermine&giornataDiA=${day}`);
        if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.tuttiOrari && Object.keys(termineInvio.tuttiOrari).length > 0) {
          const anticipo = (termineInvio.anticipoInvio !== undefined && termineInvio.anticipoInvio !== null)
            ? parseInt(termineInvio.anticipoInvio, 10)
            : 30;
          this._anticipoInvio = anticipo;
          this._scheduleCache = this._parseOrariMap(termineInvio.tuttiOrari, anticipo);
          return this._scheduleCache;
        }
      } catch (e) { }

      // 2. Direct fetch and regex parse of invform/invform.inc.php (works in local dev, node/python server)
      try {
        const resp = await fetch('invform/invform.inc.php');
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.includes('orariInizio')) {
            this._scheduleCache = this._parseInvformIncText(text);
            return this._scheduleCache;
          }
        }
      } catch (e) { }

      // 3. Fallback if single termineInvio object exists
      if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.dataOraTermine) {
        const anticipo = (termineInvio.anticipoInvio !== undefined && termineInvio.anticipoInvio !== null)
          ? parseInt(termineInvio.anticipoInvio, 10)
          : 30;
        this._anticipoInvio = anticipo;
        this._scheduleCache = {};
        this._scheduleCache[day] = {
          serieADay: day,
          orarioInizio: termineInvio.orarioInizio || null,
          dataOraInizio: termineInvio.dataOraInizio ? new Date(termineInvio.dataOraInizio) : null,
          dataOraTermine: new Date(termineInvio.dataOraTermine),
          anticipoInvio: anticipo
        };
        return this._scheduleCache;
      }

      return this._scheduleCache || {};
    })().finally(() => {
      this._schedulePromise = null;
    });

    return this._schedulePromise;
  },

  /**
   * Loads matchday fixture dates from js/DataA.js
   * Used specifically for the match calendar and fixtures display.
   * Returns a map: { [serieADay]: formattedDateString }
   */
  async loadDataASchedule() {
    if (this._dataAScheduleCache && Object.keys(this._dataAScheduleCache).length > 0) {
      return this._dataAScheduleCache;
    }

    // Assicura che js/DataA.js sia caricato nell'ambiente
    if (typeof dataGiornata === 'undefined' || !dataGiornata || dataGiornata.length === 0) {
      try {
        await this.loadScript(`js/DataA.js`);
      } catch (e) {
        try {
          const res = await fetch(`js/DataA.js`);
          if (res.ok) {
            const code = await res.text();
            const fn = new Function(code);
            fn();
          }
        } catch (err) { }
      }
    }

    const schedule = {};
    if (typeof dataGiornata !== 'undefined' && dataGiornata && dataGiornata.length > 0) {
      for (let day = 1; day < dataGiornata.length; day++) {
        const val = dataGiornata[day];
        if (!val) continue;
        const formatted = this.formatDataAString(val);
        if (formatted) {
          schedule[day] = formatted;
        }
      }
    }

    this._dataAScheduleCache = schedule;
    return schedule;
  },

  formatDataAString(val) {
    if (!val || typeof val !== 'string') return '';
    let str = val.trim();

    // Se la stringa è già formattata in italiano dal loop di DataA.js
    // es. "Sab 22 Ago 2026 ore 18:30" oppure "Dom 29 Nov 2026 ore 00:00"
    if (/^(Dom|Lun|Mar|Mer|Gio|Ven|Sab)\s+\d{1,2}\s+(Gen|Feb|Mar|Apr|Mag|Giu|Lug|Ago|Set|Ott|Nov|Dic)/i.test(str)) {
      if (str.includes('NaN')) {
        return '';
      }
      if (str.endsWith('ore 00:00')) {
        return str.replace(/\s+ore\s+00:00$/, '');
      }
      return str;
    }

    // Se è ancora in formato raw inglese (es. "August 22 2026 18:30" o "November 29 2026")
    str = str.replace(/\b(\d{2})(\d{2})$/, '$1:$2');
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const dayOfWeek = days[d.getDay()];
      const dayOfMonth = d.getDate();
      const monthStr = months[d.getMonth()];
      const year = d.getFullYear();
      const hasTime = /(?:\d{1,2}:\d{2}|\b\d{4}$)/.test(val);
      if (hasTime) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${dayOfWeek} ${dayOfMonth} ${monthStr} ${year} ore ${hours}:${minutes}`;
      } else {
        return `${dayOfWeek} ${dayOfMonth} ${monthStr} ${year}`;
      }
    }

    return str;
  },

  _parseInvformIncText(phpText) {
    const schedule = {};
    let anticipo = 30;
    const antMatch = phpText.match(/\$anticipoInvio\s*=\s*['"]?(\d+)['"]?/);
    if (antMatch) anticipo = parseInt(antMatch[1], 10);
    this._anticipoInvio = anticipo;

    const regex = /(\d+)\s*=>\s*['"](\d{4}-\d{2}-\d{2})\s+(\d{1,2})[.:](\d{2})['"]/g;
    let m;
    while ((m = regex.exec(phpText)) !== null) {
      const day = parseInt(m[1], 10);
      const dateStr = m[2];
      const hour = m[3].padStart(2, '0');
      const min = m[4];
      const inicioDate = new Date(`${dateStr}T${hour}:${min}:00`);
      const termineDate = new Date(inicioDate.getTime() - anticipo * 60 * 1000);
      schedule[day] = {
        serieADay: day,
        orarioInizio: `${dateStr} ${hour}:${min}`,
        dataOraInizio: inicioDate,
        dataOraTermine: termineDate,
        anticipoInvio: anticipo
      };
    }
    return schedule;
  },

  _parseOrariMap(orariMap, anticipo) {
    const schedule = {};
    const ant = (anticipo !== undefined && anticipo !== null) ? parseInt(anticipo, 10) : 30;
    this._anticipoInvio = ant;
    for (const [dayStr, timeStr] of Object.entries(orariMap)) {
      const day = parseInt(dayStr, 10);
      if (!timeStr) continue;
      const parts = timeStr.trim().split(/\s+/);
      if (parts.length >= 2) {
        const timeParts = parts[1].replace('.', ':').split(':');
        const hour = timeParts[0].padStart(2, '0');
        const min = timeParts[1] || '00';
        const inicioDate = new Date(`${parts[0]}T${hour}:${min}:00`);
        const termineDate = new Date(inicioDate.getTime() - ant * 60 * 1000);
        schedule[day] = {
          serieADay: day,
          orarioInizio: `${parts[0]} ${hour}:${min}`,
          dataOraInizio: inicioDate,
          dataOraTermine: termineDate,
          anticipoInvio: ant
        };
      }
    }
    return schedule;
  },

  getMatchScheduleForDay(day) {
    if (this._scheduleCache && this._scheduleCache[day]) {
      return this._scheduleCache[day];
    }
    return null;
  },

  getAnticipoInvio(day) {
    if (day && this._scheduleCache && this._scheduleCache[day] && this._scheduleCache[day].anticipoInvio !== undefined) {
      return this._scheduleCache[day].anticipoInvio;
    }
    if (this._anticipoInvio !== undefined && this._anticipoInvio !== null) {
      return this._anticipoInvio;
    }
    if (typeof termineInvio !== 'undefined' && termineInvio && termineInvio.anticipoInvio !== undefined && termineInvio.anticipoInvio !== null) {
      return parseInt(termineInvio.anticipoInvio, 10);
    }
    return 30;
  },

  /**
   * Returns formatted date and time for a Serie A matchday from DataA.js
   * Format: giornosettimana gg mese aaaa [ore hh:mm] (es. venerdì 18 settembre 2026 ore 20:45)
   */
  getDataGiornataA(serieADay) {
    if (typeof dataGiornata === 'undefined' || !dataGiornata) {
      return '';
    }
    const day = parseInt(serieADay, 10);
    if (isNaN(day) || day <= 0) return '';
    const raw = dataGiornata[day];
    if (!raw || typeof raw !== 'string') return '';

    let str = raw.trim();
    // Normalize time without colon like "October 10 2026 1500" -> "October 10 2026 15:00"
    str = str.replace(/(\b\d{4})\s+(\d{1,2})(\d{2})$/, (match, y, h, min) => `${y} ${h}:${min}`);

    const hasTime = /\d{1,2}:\d{2}/.test(str);
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (hasTime) {
        const timeStr = d.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `${dateStr} ore ${timeStr}`;
      }
      return dateStr;
    }
    return raw;
  },

  /**
   * Returns lineup check status (similar to fcmControlloFormFunzioni)
   */
  getLineupCheckData(targetDay) {
    const teams = this.getTeams();
    const day = parseInt(targetDay) || this.getCalendarData().nextMatchday;
    const results = [];

    const dayMatches = typeof arrIncontri !== 'undefined'
      ? arrIncontri.filter(inc => inc && inc.GiornataDiA === day && inc.IDTipo !== INC_RIPOSO)
      : [];

    for (const team of teams) {
      const teamMatch = dayMatches.find(m => m.IDSquadre && (m.IDSquadre.Casa === team.ID || m.IDSquadre.Fuori === team.ID));

      let titolariCount = 0;
      if (typeof arrFormazioni !== 'undefined') {
        for (let j = 1; j < arrFormazioni.length; j++) {
          const f = arrFormazioni[j];
          if (f && f.IDSquadra === team.ID && f.Pos === 0) {
            titolariCount++;
          }
        }
      }

      const hasMatch = !!teamMatch;
      const isSubmitted = titolariCount >= 11;
      let status = 'NO';
      if (!hasMatch) {
        status = 'RIPOSO';
      } else if (isSubmitted) {
        status = 'OK';
      }

      results.push({
        teamId: team.ID,
        teamName: team.Nome,
        hasMatch,
        isSubmitted,
        status,
        matchday: day
      });
    }

    return {
      matchday: day,
      teams: results
    };
  },

  _normalizePlayerLookupKey(str) {
    return String(str || '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  },

  /**
   * Get player photo URL based on arrGiocatoriA or direct code
   */
  getPlayerPhoto(playerName, code = null) {
    if (!this._photoMapInitialized && typeof arrGiocatoriA !== 'undefined') {
      this._initPhotoMap();
    }

    if (code && !isNaN(Number(code)) && Number(code) > 0) {
      const codeStr = String(code).trim();
      if (this._photoMap && this._photoMap.has(codeStr)) {
        return this._resolvePath(`img/foto/${this._photoMap.get(codeStr)}.jpg`);
      }
      if (Number(code) >= 10000 || !playerName) {
        return this._resolvePath(`img/foto/${codeStr}.jpg`);
      }
    }
    if (!playerName) return this._resolvePath('img/foto/misterx.gif');

    const cleanTarget = this._normalizePlayerLookupKey(playerName);
    if (!cleanTarget) return this._resolvePath('img/foto/misterx.gif');

    if (this._photoMap) {
      const foundCode = this._photoMap.get(cleanTarget);
      if (foundCode) {
        return this._resolvePath(`img/foto/${foundCode}.jpg`);
      }
    }

    // Fallback search if map not ready or slightly different naming
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let p = 1; p < arrGiocatoriA.length; p++) {
        const g = arrGiocatoriA[p];
        if (!g || !g.Codice) continue;
        const mappedName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : g.Nome;
        if (mappedName && (this._normalizePlayerLookupKey(mappedName) === cleanTarget || (g.Nome && this._normalizePlayerLookupKey(g.Nome) === cleanTarget))) {
          if (this._photoMap) this._photoMap.set(cleanTarget, g.Codice);
          return this._resolvePath(`img/foto/${g.Codice}.jpg`);
        }
      }
    }

    return this._resolvePath('img/foto/misterx.gif');
  },

  _initPhotoMap() {
    this._photoMap = new Map();
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let p = 1; p < arrGiocatoriA.length; p++) {
        const g = arrGiocatoriA[p];
        if (!g || !g.Codice) continue;
        const mappedName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : g.Nome;
        if (mappedName) {
          this._photoMap.set(this._normalizePlayerLookupKey(mappedName), g.Codice);
        }
        if (g.Nome) {
          this._photoMap.set(this._normalizePlayerLookupKey(g.Nome), g.Codice);
        }
        if (g.ID) {
          this._photoMap.set(String(g.ID), g.Codice);
        }
      }
      this._photoMapInitialized = true;
    }
  },

  /**
   * Helper to check if a team name is an active Serie A club
   * (returns false for empty, {ELIMINATA}, {SERIE ESTERA}, {SERIE MINORE}, etc.)
   */
  isSerieATeam(teamName) {
    if (!teamName || typeof teamName !== 'string') return false;
    const t = teamName.trim();
    if (!t) return false;
    if (t.startsWith('{') || t.endsWith('}')) return false;
    const upper = t.toUpperCase();
    if (upper.includes('ELIMINAT') || upper.includes('ESTERA') || upper.includes('MINORE')) return false;
    return true;
  },

  /**
   * Return Serie A player object from arrGiocatoriA by name
   */
  getSerieAPlayer(playerName) {
    if (!playerName) return null;
    if (typeof arrGiocatoriA === 'undefined') return null;

    if (!this._serieAPlayerMap || this._serieAPlayerMap.size === 0) {
      this._initSerieAPlayerMap();
    }

    const cleanTarget = this._normalizePlayerLookupKey(playerName);
    const pl = this._serieAPlayerMap ? this._serieAPlayerMap.get(cleanTarget) || null : null;
    if (pl && pl.IDSquadra && pl.IDSquadra > 20) {
      return null;
    }
    return pl;
  },

  /**
   * Return Serie A player ID from arrGiocatoriA by name
   */
  getSerieAPlayerId(playerName) {
    const pl = this.getSerieAPlayer(playerName);
    return pl ? pl.ID : null;
  },

  /**
   * Return Serie A player Code from arrGiocatoriA by name or ID
   * Falls back to _photoMap so departed/external players still resolve their Codice
   */
  getPlayerCode(playerNameOrId) {
    if (!playerNameOrId) return null;
    const pl = this.getSerieAPlayer(playerNameOrId);
    if (pl && pl.Codice) return pl.Codice;
    if (!this._photoMapInitialized && typeof arrGiocatoriA !== 'undefined') {
      this._initPhotoMap();
    }
    if (this._photoMap) {
      const cleanTarget = this._normalizePlayerLookupKey(playerNameOrId);
      return this._photoMap.get(cleanTarget) || null;
    }
    return null;
  },

  /**
   * Helper unificato per generare link a #schede_giocatori.
   * Privilegia il codice calciatore univoco (?cod=), supporta ?id= e ?id=&season=
   */
  getPlayerProfileLink(options = {}) {
    if (typeof options === 'string') {
      const code = this.getPlayerCode(options);
      return code ? `#schede_giocatori?cod=${code}` : `#schede_giocatori?name=${encodeURIComponent(options)}`;
    }
    const code = options.code || options.codice || (options.name ? this.getPlayerCode(options.name) : null) || (options.id ? this.getPlayerCode(options.id) : null);
    if (code) {
      return `#schede_giocatori?cod=${code}`;
    }
    if (options.id && options.season) {
      return `#schede_giocatori?id=${options.id}&season=${options.season}`;
    }
    if (options.id) {
      return `#schede_giocatori?id=${options.id}`;
    }
    if (options.name) {
      return `#schede_giocatori?name=${encodeURIComponent(options.name)}`;
    }
    return '#schede_giocatori';
  },

  _initSerieAPlayerMap() {
    this._serieAPlayerMap = new Map();
    if (typeof arrGiocatoriA === 'undefined') return;

    for (let p = 1; p < arrGiocatoriA.length; p++) {
      const g = arrGiocatoriA[p];
      if (!g || g.IDSquadra > 20) continue;

      let pTeam = '';
      try { pTeam = (typeof window !== 'undefined' && window[`xa${g.IDSquadra}`]) ? window[`xa${g.IDSquadra}`] : ''; } catch (e) { }
      if (pTeam && !this.isSerieATeam(pTeam)) continue;

      const mappedName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : g.Nome;
      if (mappedName) {
        this._serieAPlayerMap.set(this._normalizePlayerLookupKey(mappedName), g);
      }
      if (g.Nome) {
        this._serieAPlayerMap.set(this._normalizePlayerLookupKey(g.Nome), g);
      }
      if (g.ID) {
        this._serieAPlayerMap.set(String(g.ID), g);
      }
    }
  },

  /**
   * Split player name into surname (all uppercase prefix) and first name (remaining parts).
   * E.g. "MARTINEZ Lautaro Javier" -> { surname: "MARTINEZ", firstName: "Lautaro Javier" }
   * "DE BRUYNE Kevin" -> { surname: "DE BRUYNE", firstName: "Kevin" }
   * "BREMER" -> { surname: "BREMER", firstName: "" }
   */
  splitPlayerName(fullName) {
    if (!fullName) return { surname: '', firstName: '' };
    const words = String(fullName).trim().split(/\s+/);
    const uppercaseWords = [];
    for (const word of words) {
      if (/^[A-ZÀ-ÖØ-ß'’\-]+$/.test(word)) {
        uppercaseWords.push(word);
      } else {
        break;
      }
    }
    if (uppercaseWords.length > 0) {
      return {
        surname: uppercaseWords.join(' '),
        firstName: words.slice(uppercaseWords.length).join(' ')
      };
    }
    return {
      surname: words[0] || '',
      firstName: words.slice(1).join(' ')
    };
  },

  /**
   * Extract surname (all leading UPPERCASE words, supporting multi-word surnames like 'DA CUNHA')
   */
  extractSurname(fullName) {
    return this.splitPlayerName(fullName).surname;
  },

  /**
   * Search and match a player from Fantamister name and role in arrGiocatoriA
   * e.g. "SVILAR Mil", "DE BRUYNE Kev", "DA CUNHA Luc"
   */
  findSerieAPlayerFromFantam(rawFantamName, roleLetter) {
    if (!rawFantamName || typeof arrGiocatoriA === 'undefined') return null;

    const words = String(rawFantamName).trim().split(/\s+/);
    const surnameWords = [];
    let i = 0;
    while (i < words.length) {
      const cleanWord = words[i].replace(/[^A-Za-zÀ-ÖØ-ß'’\-]/g, '');
      if (cleanWord && cleanWord === cleanWord.toUpperCase() && words.length > 1 && i < words.length - 1) {
        surnameWords.push(words[i]);
        i++;
      } else if (words.length === 1) {
        surnameWords.push(words[i]);
        i++;
      } else {
        break;
      }
    }
    const surname = surnameWords.length > 0 ? surnameWords.join(' ') : (words[0] || '');
    const prefix = words.slice(i).join(' ');

    const cleanNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const cleanSurname = cleanNorm(surname);
    const cleanPrefix = cleanNorm(prefix);
    const rNum = (roleLetter === 'P' ? 1 : roleLetter === 'D' ? 2 : roleLetter === 'C' ? 3 : 4);

    let bestMatch = null;
    let bestScore = -1;

    for (let p = 1; p < arrGiocatoriA.length; p++) {
      const g = arrGiocatoriA[p];
      if (!g) continue;

      const fullName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : (g.Nome || '');
      if (!fullName) continue;

      const { surname: gSurname, firstName: gFirstName } = this.splitPlayerName(fullName);
      const cleanGSurname = cleanNorm(gSurname);
      const cleanGFirst = cleanNorm(gFirstName);

      let score = 0;
      if (g.Ruolo === rNum) score += 100;
      if (g.IDSquadra && g.IDSquadra <= 20) score += 30;

      if (cleanGSurname === cleanSurname) {
        score += 120;
      } else if (cleanGSurname.includes(cleanSurname) || cleanSurname.includes(cleanGSurname)) {
        score += 60;
      } else {
        const cleanFull = cleanNorm(fullName);
        if (cleanFull.includes(cleanSurname)) {
          score += 40;
        } else {
          continue;
        }
      }

      if (cleanPrefix) {
        if (cleanGFirst.startsWith(cleanPrefix)) {
          score += 70;
        } else if (cleanGFirst.includes(cleanPrefix)) {
          score += 30;
        }
      } else {
        score += 40;
      }

      if (score > bestScore) {
        bestScore = score;
        let sTeam = '';
        try {
          sTeam = (typeof window !== 'undefined' && window[`xa${g.IDSquadra}`]) ? window[`xa${g.IDSquadra}`] : '';
        } catch (e) { }

        bestMatch = {
          id: g.ID,
          codice: g.Codice,
          name: fullName,
          surname: gSurname || surname,
          firstName: gFirstName || '',
          role: roleLetter,
          roleClass: `role-${roleLetter.toLowerCase()}`,
          serieATeam: sTeam,
          serieALogo: this.getSerieALogo(sTeam),
          photo: g.Codice ? this.getPlayerPhoto(fullName, g.Codice) : this._resolvePath('img/foto/misterx.gif'),
          link: g.Codice ? `#schede_giocatori?cod=${g.Codice}` : `#schede_giocatori?id=${g.ID}`
        };
      }
    }

    if (bestScore >= 120) {
      return bestMatch;
    }
    return null;
  },

  /**
   * Parse Top 11 / Flop 11 HTML table generated by Fantamister
   */
  parseTopFlopHtml(htmlContent, isFlop = false) {
    if (!htmlContent || typeof htmlContent !== 'string') return [];
    const list = [];
    const allTeams = this.getTeams ? this.getTeams() : [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const rows = doc.querySelectorAll('tr.topflop');

      rows.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 2) return;
        if (tds[0].getAttribute('colspan') || tds[0].classList.contains('tpTITOLO')) return;

        const roleText = tds[0].textContent.trim().toUpperCase();
        const rawContent = tds[1].textContent.trim();
        if (!rawContent) return;

        let playerRaw = rawContent;
        let vote = '';
        let fantasyTeam = '';

        // Extract vote in square brackets: [8.5]
        const voteMatch = playerRaw.match(/\[([0-9.,\-]+)\]\s*$/);
        if (voteMatch) {
          vote = voteMatch[1];
          playerRaw = playerRaw.substring(0, voteMatch.index).trim();
        }

        // Extract fantasy team in parentheses: (dinamo saimen)
        const teamMatch = playerRaw.match(/\(([^)]+)\)\s*$/);
        if (teamMatch) {
          fantasyTeam = teamMatch[1].trim();
          playerRaw = playerRaw.substring(0, teamMatch.index).trim();
        }

        // Match fantasy team properly with official team names
        let displayFantasyTeam = fantasyTeam;
        if (fantasyTeam && allTeams.length > 0) {
          const matchedFsq = allTeams.find(t => (t.Nome || t.name) && (t.Nome || t.name).toLowerCase() === fantasyTeam.toLowerCase());
          if (matchedFsq) {
            displayFantasyTeam = matchedFsq.Nome || matchedFsq.name;
          } else {
            displayFantasyTeam = fantasyTeam.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
        }

        // Match player in arrGiocatoriA
        const matched = this.findSerieAPlayerFromFantam(playerRaw, roleText);
        const splitted = matched ? { surname: matched.surname, firstName: matched.firstName } : this.splitPlayerName(playerRaw);

        list.push({
          role: roleText,
          roleClass: `role-${roleText.toLowerCase()}`,
          rawPlayer: playerRaw,
          player: matched ? matched.name : playerRaw,
          fullName: matched ? matched.name : playerRaw,
          surname: splitted.surname || this.extractSurname(playerRaw),
          firstName: splitted.firstName || '',
          id: matched ? matched.id : null,
          codice: matched ? matched.codice : null,
          serieATeam: matched ? matched.serieATeam : '',
          serieALogo: matched ? matched.serieALogo : '',
          photo: matched ? matched.photo : this._resolvePath('img/foto/misterx.gif'),
          link: matched ? matched.link : `#schede_giocatori?name=${encodeURIComponent(playerRaw)}`,
          fantasyTeam: displayFantasyTeam,
          vote: vote,
          isFlop: isFlop
        });
      });
    } catch (e) {
      console.error('Errore parsing HTML top/flop:', e);
    }

    return list;
  },

  /**
   * Load and parse top11 and flop11 using native fcmFantamisterMotore
   */
  async loadTopFlop11(forceReload = false) {
    if (!forceReload && this._topFlop11Cache) {
      return this._topFlop11Cache;
    }
    if (!forceReload && this._topFlop11Promise) {
      return this._topFlop11Promise;
    }

    this._topFlop11Promise = (async () => {
      // Ensure Serie A details and Serie A clubs are loaded
    if (typeof arrGiocatoriA === 'undefined') {
      try { await this.loadScript('js/fcmSerieADatiDettaglio.js'); } catch (e) { }
    }
    if (typeof xa1 === 'undefined') {
      try { await this.loadScript('js/fcmSerieADati.js'); } catch (e) { }
    }

    if (typeof fcmFantamisterMotore !== 'undefined') {
      try {
        const res = await fcmFantamisterMotore.getTopFlop11();
        if (res && (res.top11.length > 0 || res.flop11.length > 0)) {
          this._topFlop11Cache = res;
          return res;
        }
      } catch (err) {
        console.warn('Errore calcolo fcmFantamisterMotore.getTopFlop11():', err);
      }
    }

    let top11Html = '';
    let flop11Html = '';

    try {
      const r = await fetch(this._resolvePath('fantam/top11.htm'), { cache: 'no-store' });
      if (r.ok) top11Html = await r.text();
    } catch (e) {
      console.warn('Errore caricamento fantam/top11.htm:', e);
    }

    try {
      const r = await fetch(this._resolvePath('fantam/flop11.htm'), { cache: 'no-store' });
      if (r.ok) flop11Html = await r.text();
    } catch (e) {
      console.warn('Errore caricamento fantam/flop11.htm:', e);
    }

    const top11 = top11Html ? this.parseTopFlopHtml(top11Html, false) : [];
    const flop11 = flop11Html ? this.parseTopFlopHtml(flop11Html, true) : [];

    // Fallback if top11.htm fetch failed but arrTop11 exists
    if (top11.length === 0 && typeof arrTop11 !== 'undefined' && arrTop11.length > 1) {
      for (let i = 1; i < arrTop11.length; i++) {
        const p = arrTop11[i];
        if (p) {
          const matched = this.findSerieAPlayerFromFantam(p.Giocatore, p.Ruolo);
          const splitted = matched ? { surname: matched.surname, firstName: matched.firstName } : this.splitPlayerName(p.Giocatore);
          top11.push({
            role: p.Ruolo,
            roleClass: `role-${p.Ruolo.toLowerCase()}`,
            rawPlayer: p.Giocatore,
            player: matched ? matched.name : p.Giocatore,
            fullName: matched ? matched.name : p.Giocatore,
            surname: splitted.surname || this.extractSurname(p.Giocatore),
            firstName: splitted.firstName || '',
            id: matched ? matched.id : null,
            codice: matched ? matched.codice : null,
            serieATeam: matched ? matched.serieATeam : '',
            serieALogo: matched ? matched.serieALogo : '',
            photo: matched ? matched.photo : this._resolvePath('img/foto/misterx.gif'),
            link: (matched && matched.codice) ? `#schede_giocatori?cod=${matched.codice}` : (matched ? matched.link : `#schede_giocatori?name=${encodeURIComponent(p.Giocatore)}`),
            fantasyTeam: p.Squadra,
            vote: p.Voto,
            isFlop: false
          });
        }
      }
    }

    this._topFlop11Cache = { top11, flop11 };
    return this._topFlop11Cache;
    })().finally(() => {
      this._topFlop11Promise = null;
    });

    return this._topFlop11Promise;
  },

  /**
   * Top 11 of the matchday
   */
  getTop11() {
    if (this._topFlop11Cache && this._topFlop11Cache.top11 && this._topFlop11Cache.top11.length > 0) {
      return this._topFlop11Cache.top11;
    }
    if (typeof arrTop11 === 'undefined') return [];
    const list = [];
    for (let i = 1; i < arrTop11.length; i++) {
      const p = arrTop11[i];
      if (p) {
        list.push({
          role: p.Ruolo,
          player: p.Giocatore,
          surname: this.extractSurname(p.Giocatore),
          fantasyTeam: p.Squadra,
          vote: p.Voto
        });
      }
    }
    return list;
  },

  /**
   * Flop 11 of the matchday
   */
  getFlop11() {
    if (this._topFlop11Cache && this._topFlop11Cache.flop11) {
      return this._topFlop11Cache.flop11;
    }
    return [];
  },

  /**
   * Carica e analizza i dati FantaMister (scarto, voti, moduli, parziali, massimi) per una determinata giornata (o l'ultima giocata)
   * Restituisce { day, list, bestMister, worstMister, topScore, lowestScore }
   */
  async loadFantamisterDay(targetDay = null) {
    const calendar = this.getCalendarData();
    const day = targetDay || (calendar.lastPlayed > 0 ? calendar.lastPlayed : 1);

    if (this._fantamisterDayCache && this._fantamisterDayCache[day]) {
      return this._fantamisterDayCache[day];
    }
    if (!this._fantamisterDayCache) this._fantamisterDayCache = {};
    if (!this._fantamisterDayPromises) this._fantamisterDayPromises = new Map();
    if (this._fantamisterDayPromises.has(day)) {
      return this._fantamisterDayPromises.get(day);
    }

    const loadPromise = (async () => {
    if (typeof fcmFantamisterMotore !== 'undefined') {
      try {
        const engineData = await fcmFantamisterMotore.getFantamisterDay(day);
        if (engineData && engineData.list && engineData.list.length > 0) {
          const teams = this.getTeams ? this.getTeams() : [];
          const enrichTeamItem = (item) => {
            if (!item) return;
            if (!item.logo) item.logo = this.getTeamLogo(item.teamId || item.Nome);
            if (!item.coach) {
              const tObj = teams.find(t => (t.Nome || t.name || '').trim().toLowerCase() === (item.Nome || '').toLowerCase());
              item.coach = tObj ? (tObj.Presidente || tObj.coach || '') : '';
            }
            if (item.total === undefined) {
              item.total = typeof item.totalScore === 'number' ? item.totalScore : (parseFloat(item.totalScore) || item.Parz || 0);
            }
            if (item.partial === undefined) {
              item.partial = typeof item.Parz === 'number' ? item.Parz : (parseFloat(item.Parz) || item.total || 0);
            }
          };

          engineData.list.forEach(enrichTeamItem);
          ['topScore', 'lowestScore', 'bestMister', 'worstMister'].forEach(k => {
            if (engineData[k]) enrichTeamItem(engineData[k]);
          });

          this._fantamisterDayCache[day] = engineData;
          return engineData;
        }
      } catch (err) {
        console.warn('Errore calcolo fcmFantamisterMotore.getFantamisterDay():', err);
      }
    }

    let text = '';
    try {
      const resp = await fetch(this._resolvePath(`js/fcmFantamisterDati${day}.js`), { cache: 'no-store' });
      if (resp.ok) text = await resp.text();
    } catch (e) { }

    if (!text) {
      try {
        const resp2 = await fetch(this._resolvePath(`fantam/fcmFantamisterDati${day}.js`), { cache: 'no-store' });
        if (resp2.ok) text = await resp2.text();
      } catch (e) { }
    }

    if (!text) return null;

    try {
      function Fm(Nome, Scarto, Voti, ScSuVoti, Parz, ModParz, Max, ModMax) {
        return {
          Nome: (Nome || '').trim(),
          Scarto: typeof Scarto === 'number' ? Scarto : (parseFloat(Scarto) || 0),
          Voti: typeof Voti === 'number' ? Voti : (parseInt(Voti, 10) || 0),
          ScSuVoti: typeof ScSuVoti === 'number' ? ScSuVoti : (parseFloat(ScSuVoti) || 0),
          Parz: typeof Parz === 'number' ? Parz : (parseFloat(Parz) || 0),
          ModParz: (ModParz || '').trim(),
          Max: typeof Max === 'number' ? Max : (parseFloat(Max) || 0),
          ModMax: (ModMax || '').trim()
        };
      }

      const fn = new Function('Fm', `
        var arrFantamister = [];
        var a = arrFantamister;
        ${text}
        return arrFantamister;
      `);

      const raw = fn(Fm);
      if (!Array.isArray(raw) || raw.length === 0) return null;

      const teams = this.getTeams ? this.getTeams() : [];

      const list = raw.filter(item => item && item.Nome).map(item => {
        const teamObj = teams.find(t => (t.Nome || t.name || '').trim().toLowerCase() === item.Nome.toLowerCase());
        const teamId = teamObj ? (teamObj.ID || teamObj.id) : null;
        const coach = teamObj ? (teamObj.Presidente || teamObj.coach || '') : '';
        const logo = this.getTeamLogo(teamId || item.Nome);
        return {
          ...item,
          teamId,
          coach,
          logo
        };
      });

      if (list.length === 0) return null;

      // Ordina per Scarto crescente: primo = Miglior Mister (minor scarto), ultimo = Peggior Mister (maggior scarto)
      const sortedByScarto = [...list].sort((a, b) => a.Scarto - b.Scarto);
      const bestMister = sortedByScarto[0];
      const worstMister = sortedByScarto[sortedByScarto.length - 1];

      // Recupera i punteggi totali effettivi avuti dalle squadre nelle partite del turno (con modificatori e fattore campo)
      const dayMatches = (calendar && calendar.matches)
        ? calendar.matches.filter(m => m.serieADay === day && m.played && !m.isRiposo && m.homeTeamId > 0 && m.awayTeamId > 0)
        : [];

      const teamTotalScores = [];
      dayMatches.forEach(m => {
        const isLega = (m.compName && m.compName.toLowerCase().includes('lega')) || m.compId === 1;

        teamTotalScores.push({
          teamId: m.homeTeamId,
          Nome: m.homeTeamName,
          total: typeof m.homeTotal === 'number' ? m.homeTotal : (parseFloat(m.homeTotal) || 0),
          partial: typeof m.homePartial === 'number' ? m.homePartial : (parseFloat(m.homePartial) || 0),
          goals: m.homeGoals || 0,
          opponentName: m.awayTeamName,
          opponentGoals: m.awayGoals || 0,
          opponentTotal: typeof m.awayTotal === 'number' ? m.awayTotal : (parseFloat(m.awayTotal) || 0),
          isHome: true,
          compName: m.compName,
          isLega
        });

        teamTotalScores.push({
          teamId: m.awayTeamId,
          Nome: m.awayTeamName,
          total: typeof m.awayTotal === 'number' ? m.awayTotal : (parseFloat(m.awayTotal) || 0),
          partial: typeof m.awayPartial === 'number' ? m.awayPartial : (parseFloat(m.awayPartial) || 0),
          goals: m.awayGoals || 0,
          opponentName: m.homeTeamName,
          opponentGoals: m.homeGoals || 0,
          opponentTotal: typeof m.homeTotal === 'number' ? m.homeTotal : (parseFloat(m.homeTotal) || 0),
          isHome: false,
          compName: m.compName,
          isLega
        });
      });

      // Deduplica per squadra dando priorità al Campionato (Lega) se gioca più competizioni nello stesso turno
      const uniqueScoresMap = new Map();
      teamTotalScores.forEach(entry => {
        const key = (entry.Nome || '').toLowerCase().trim();
        if (!uniqueScoresMap.has(key)) {
          uniqueScoresMap.set(key, entry);
        } else {
          const existing = uniqueScoresMap.get(key);
          if (!existing.isLega && entry.isLega) {
            uniqueScoresMap.set(key, entry);
          }
        }
      });
      const uniqueTotalScores = Array.from(uniqueScoresMap.values());

      uniqueTotalScores.forEach(entry => {
        const fmItem = list.find(l => (l.Nome || '').toLowerCase() === (entry.Nome || '').toLowerCase());
        if (fmItem) {
          entry.coach = fmItem.coach;
          entry.logo = fmItem.logo;
          entry.ModParz = fmItem.ModParz;
          entry.ModMax = fmItem.ModMax;
          entry.Max = fmItem.Max;
          entry.Scarto = fmItem.Scarto;
          entry.ScSuVoti = fmItem.ScSuVoti;
          entry.Voti = fmItem.Voti;
          if (!entry.partial && fmItem.Parz) {
            entry.partial = fmItem.Parz;
          }
        } else {
          entry.logo = this.getTeamLogo(entry.teamId || entry.Nome);
          const tObj = teams.find(t => (t.Nome || t.name || '').trim().toLowerCase() === entry.Nome.toLowerCase());
          entry.coach = tObj ? (tObj.Presidente || tObj.coach || '') : '';
        }
        entry.bonusMalus = +(entry.total - entry.partial).toFixed(2);
      });

      let topScore = null;
      let lowestScore = null;
      if (uniqueTotalScores.length > 0) {
        uniqueTotalScores.sort((a, b) => b.total - a.total);
        topScore = uniqueTotalScores[0];
        lowestScore = uniqueTotalScores[uniqueTotalScores.length - 1];
      } else {
        const sortedByParz = [...list].sort((a, b) => b.Parz - a.Parz);
        topScore = sortedByParz[0] ? { ...sortedByParz[0], total: sortedByParz[0].Parz, partial: sortedByParz[0].Parz, goals: 0, bonusMalus: 0 } : null;
        lowestScore = sortedByParz[sortedByParz.length - 1] ? { ...sortedByParz[sortedByParz.length - 1], total: sortedByParz[sortedByParz.length - 1].Parz, partial: sortedByParz[sortedByParz.length - 1].Parz, goals: 0, bonusMalus: 0 } : null;
      }

      const res = {
        day,
        list,
        ranking: sortedByScarto,
        bestMister,
        worstMister,
        topScore,
        lowestScore
      };

      this._fantamisterDayCache[day] = res;
      return res;
    } catch (err) {
      console.warn('Errore parsing dati FantaMister per giornata', day, err);
      return null;
    }
    })();

    this._fantamisterDayPromises.set(day, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this._fantamisterDayPromises.delete(day);
    }
  },

  /**
   * Load detailed results (tabellini) for a specific matchday (giornata di serie A)
   */
  async loadMatchdayResults(serieADay) {
    const day = parseInt(serieADay);
    if (this._risultatiCache[day]) {
      return this._risultatiCache[day];
    }

    if (typeof xa1 === 'undefined' && typeof window !== 'undefined' && typeof window.xa1 === 'undefined') {
      try {
        await this.loadScript('js/fcmSerieADati.js');
      } catch (e) {
        console.warn('Impossibile caricare fcmSerieADati.js', e);
      }
    }

    // Load js/fcmRisultatiDati{day}.js
    await this.loadScript(`js/fcmRisultatiDati${day}.js`);

    if (typeof arrTabellini === 'undefined') {
      return [];
    }

    // Parse tabellini
    const tabellini = [];
    for (let i = 1; i < arrTabellini.length; i++) {
      const t = arrTabellini[i];
      if (t) {
        const playerIds = String(t.Lista || '').split('%');
        const serieATeams = String(t.ListaSqA || '').split('%');
        const roles = String(t.Ruolo || '').split('%');
        const rawVotes = String(t.Voto || '').split('%');
        const modifiers = String(t.Modif || '').split('%');
        const totalVotes = String(t.Tot || '').split('%');

        const players = [];
        for (let j = 0; j < playerIds.length; j++) {
          const id = playerIds[j];
          // Skip empty trailing slots in bench/tribuna
          if (j > 10 && (!id || id === '0')) continue;

          const pRole = parseInt(roles[j]) || 0;
          // In FCM: First 11 players (j <= 10) are the active starters of the match
          const isStarter = j <= 10;
          // Reserves that entered from bench have roles 5..8 in starters list (PR, DR, CR, AR)
          const isSubbedIn = j <= 10 && (pRole >= 5 && pRole <= 8);
          // Starters who were subbed out appear in bench list (j > 10) with negative starter roles -1..-4 (Ps, Ds, Cs, As)
          const isSubbedOut = j > 10 && (pRole >= -4 && pRole <= -1);
          // Bench players who did NOT enter appear in bench list (j > 10) with roles 5..8 (P, D, C, A)
          const isBench = j > 10 && (pRole >= 5 && pRole <= 8);
          // Tribuna players appear in bench list (j > 10) with roles -5..-8
          const isTribuna = j > 10 && (pRole >= -8 && pRole <= -5);
          const isOfficeReserve = (id === '-1');
          const isAbsent = (id === '0');

          // Base role: 1=P, 2=D, 3=C, 4=A
          let baseRole = 0;
          if (pRole >= 1 && pRole <= 4) baseRole = pRole;
          else if (pRole >= 5 && pRole <= 8) baseRole = pRole - 4;
          else if (pRole >= -4 && pRole <= -1) baseRole = Math.abs(pRole);
          else if (pRole >= -8 && pRole <= -5) baseRole = Math.abs(pRole) - 4;

          // Role label (FCM standard)
          let roleLabel = '-';
          if (isStarter) {
            if (isSubbedIn) {
              roleLabel = pRole === 5 ? 'PR' : (pRole === 6 ? 'DR' : (pRole === 7 ? 'CR' : 'AR'));
            } else if (isOfficeReserve) {
              roleLabel = baseRole === 1 ? 'PU' : (baseRole === 2 ? 'DU' : (baseRole === 3 ? 'CU' : 'AU'));
            } else {
              roleLabel = this.getRoleShort(baseRole);
            }
          } else if (isSubbedOut) {
            roleLabel = pRole === -1 ? 'Ps' : (pRole === -2 ? 'Ds' : (pRole === -3 ? 'Cs' : 'As'));
          } else {
            roleLabel = this.getRoleShort(baseRole);
          }

          // Player name
          let pName = '';
          if (isAbsent) {
            pName = 'Assente';
          } else if (isOfficeReserve) {
            pName = "Riserva d'ufficio";
          } else {
            pName = window[`xg${id}`] || `Giocatore #${id}`;
          }

          const pClubId = serieATeams[j];
          const pClubName = window[`xa${pClubId}`] || '';

          players.push({
            id: id,
            name: pName,
            surname: this.extractSurname(pName),
            club: pClubName,
            role: baseRole,
            roleRaw: pRole,
            roleLabel: roleLabel,
            rawVote: rawVotes[j] || '-',
            bonusMalus: modifiers[j] || '0',
            totVote: totalVotes[j] || '-',
            isStarter,
            isSubbedIn,
            isSubbedOut,
            isBench,
            isTribuna,
            isOfficeReserve,
            isAbsent
          });
        }

        const extraTimePlayers = [];
        const hasExtraTime = (t.Supplementari === 1 && t.ParzialeSquadraSupplementari !== 'x');
        if (hasExtraTime && t.ListaSupplementari) {
          const arrLS = String(t.ListaSupplementari || '').split('%');
          const arrVS = String(t.VotoSupplementari || '').split('%');
          const rolesS = [2, 3, 4];
          const rolesLabelS = ['D', 'C', 'A'];
          for (let s = 0; s < Math.min(3, arrLS.length); s++) {
            const idS = parseInt(arrLS[s]) || 0;
            const isOfficeReserve = (idS === -1);
            const isAbsent = (idS === 0);
            let nameS = '';
            if (isAbsent) nameS = '-----------------';
            else if (isOfficeReserve) nameS = "Riserva d'ufficio";
            else nameS = window[`xg${idS}`] || `Giocatore #${idS}`;

            const vS = arrVS[s] !== undefined ? arrVS[s] : '-';
            const voteNum = parseFloat(vS);
            const isSuccess = !isNaN(voteNum) && voteNum >= 6.0;

            extraTimePlayers.push({
              id: idS,
              name: nameS,
              role: rolesS[s],
              roleLabel: isOfficeReserve ? rolesLabelS[s] + 'U' : rolesLabelS[s],
              rawVote: vS,
              isSuccess,
              isOfficeReserve,
              isAbsent
            });
          }
        }

        const penaltyPlayers = [];
        const hasPenalties = (t.Rigori === 1 && t.GolRigori !== 'x');
        if (hasPenalties && t.ListaRigori) {
          const arrLR = String(t.ListaRigori || '').split('%');
          const arrVR = String(t.VotoRigori || '').split('%');
          for (let r = 0; r < arrLR.length; r++) {
            const valLR = arrLR[r];
            if (!valLR && valLR !== '0') continue;
            const idR = parseInt(valLR) || 0;
            const isOfficeReserve = (idR === -1);
            const isAbsent = (idR === 0);
            let nameR = '';
            if (isAbsent) nameR = '-----------------';
            else if (isOfficeReserve) nameR = "Riserva d'ufficio";
            else nameR = window[`xg${idR}`] || `Giocatore #${idR}`;

            const vR = arrVR[r] !== undefined ? arrVR[r] : '-';
            const voteNum = parseFloat(vR);
            const isScored = !isNaN(voteNum) && voteNum >= 6.0;

            penaltyPlayers.push({
              id: idR,
              name: nameR,
              rawVote: vR,
              isScored,
              isOfficeReserve,
              isAbsent
            });
          }
        }

        tabellini.push({
          matchId: t.IDIncontro,
          teamId: t.IDSquadra,
          leagueId: t.IDLega,
          players,
          partialScore: t.ParzialeSquadra !== 'x' ? parseFloat(t.ParzialeSquadra) : 0,
          homeFieldAdvantage: t.FattoreCampo !== 'x' ? parseFloat(t.FattoreCampo) : 0,
          modGoalkeeper: t.ModPortiere !== 'x' ? parseFloat(t.ModPortiere) : 0,
          modDefense: t.ModDifesa !== 'x' ? parseFloat(t.ModDifesa) : 0,
          modMidfield: t.ModCentrocampo !== 'x' ? parseFloat(t.ModCentrocampo) : 0,
          modAttack: t.ModAttacco !== 'x' ? parseFloat(t.ModAttacco) : 0,
          modModule: t.ModModulo !== 'x' ? parseFloat(t.ModModulo) : 0,
          modM1: t.ModM1Pers !== 'x' ? parseFloat(t.ModM1Pers) : 0,
          modM2: t.ModM2Pers !== 'x' ? parseFloat(t.ModM2Pers) : 0,
          modM3: t.ModM3Pers !== 'x' ? parseFloat(t.ModM3Pers) : 0,
          totalScore: t.TotaleSquadra !== 'x' ? parseFloat(t.TotaleSquadra) : 0,
          goals: t.Gol !== 'x' ? parseInt(t.Gol) : 0,
          hasExtraTime,
          extraTimePlayers,
          extraTimePartial: t.ParzialeSquadraSupplementari !== 'x' ? parseFloat(t.ParzialeSquadraSupplementari) : 0,
          extraTimeHomeAdvantage: t.FattoreCampoSupplementari !== 'x' ? parseFloat(t.FattoreCampoSupplementari) : 0,
          extraTimeGoals: t.GolSupplementari !== 'x' ? parseInt(t.GolSupplementari) : 0,
          hasPenalties,
          penaltyPlayers,
          penaltyGoals: t.GolRigori !== 'x' ? parseInt(t.GolRigori) : 0
        });
      }
    }

    this._risultatiCache[day] = tabellini;
    return tabellini;
  },

  /**
   * Load lineups for a matchday
   */
  async loadMatchdayLineups(serieADay, forceReload = false) {
    const day = parseInt(serieADay);
    if (!forceReload && this._formazioniCache[day]) {
      return this._formazioniCache[day];
    }

    // Ensure Serie A detailed data (arrGiocatoriA) is available for player photos and codes
    if (typeof arrGiocatoriA === 'undefined') {
      await this.loadScript('js/fcmSerieADatiDettaglio.js');
    }
    if (typeof xa1 === 'undefined') {
      await this.loadScript('js/fcmSerieADati.js');
    }

    await this.loadScript(`js/fcmFormazioniDati${day}.js`, forceReload);

    if (typeof arrFormazioni === 'undefined') {
      return [];
    }

    const formations = [];
    for (let i = 1; i < arrFormazioni.length; i++) {
      const z = arrFormazioni[i];
      if (z) {
        formations.push({
          matchId: z.IDIncontro,
          teamId: z.IDSquadra,
          name: z.Nome,
          serieATeam: z.SquadraDiA,
          role: z.Ruolo,
          position: z.Pos, // 0 = titolare, >0 = panchina, -1 = tribuna
          isStarter: z.Pos === 0,
          penaltyTaker: z.Rig,
          playerId: this.getSerieAPlayerId(z.Nome)
        });
      }
    }

    this._formazioniCache[day] = formations;
    return formations;
  },

  cleanText(str) {
    if (!str) return '';
    let cleaned = String(str);
    cleaned = cleaned
      .replace(/pi[\?\uFFFD]/gi, 'più')
      .replace(/pu[\?\uFFFD]/gi, 'può')
      .replace(/gi[\?\uFFFD]/gi, 'già');
    return cleaned;
  },

  /**
   * Load query statistic by ID (1 to 45) safely avoiding global arrRisQuery collisions
   */
  async loadQueryStat(queryId) {
    const qId = parseInt(queryId, 10);
    if (isNaN(qId)) return { headers: [], rows: [] };
    if (this._queryCache[qId]) {
      return this._queryCache[qId];
    }
    if (this._queryPromises && this._queryPromises[qId]) {
      return this._queryPromises[qId];
    }

    if (!this._queryPromises) this._queryPromises = {};
    const prevLock = this._queryLoadQueue || Promise.resolve();

    const taskPromise = prevLock.then(async () => {
      if (this._queryCache[qId]) {
        return this._queryCache[qId];
      }

      if (this._lastLoadedQueryId && this._lastLoadedQueryId !== qId && typeof window !== 'undefined') {
        window.arrRisQuery = [];
      }

      await this.loadScript(`js/fcmQueryQ${qId}.js`, 'reexec', 'ISO-8859-1');
      this._lastLoadedQueryId = qId;

      if (typeof arrRisQuery === 'undefined' || !arrRisQuery || arrRisQuery.length < 2 || !arrRisQuery[1]) {
        return { headers: [], rows: [] };
      }

      const headers = String(arrRisQuery[1].ListaValori || '').split('%').map(h => this.cleanText(h));
      const rows = [];

      for (let i = 2; i < arrRisQuery.length; i++) {
        if (arrRisQuery[i] && arrRisQuery[i].ListaValori) {
          const values = arrRisQuery[i].ListaValori.split('%').map(v => this.cleanText(v));
          rows.push(values);
        }
      }

      const result = { headers, rows };
      this._queryCache[qId] = result;
      return result;
    }).finally(() => {
      if (this._queryPromises) delete this._queryPromises[qId];
    });

    this._queryPromises[qId] = taskPromise;
    this._queryLoadQueue = taskPromise.catch(() => {});
    return taskPromise;
  },

  /**
   * Get all query names
   */
  getQueryList() {
    if (typeof arrQuery === 'undefined') return [];
    const list = [];
    for (let i = 1; i < arrQuery.length; i++) {
      if (arrQuery[i]) {
        list.push({ id: arrQuery[i].ID, name: this.cleanText(arrQuery[i].Nome) });
      }
    }
    return list;
  },

  /**
   * Albo d'oro
   */
  getAlboDOro() {
    if (typeof arrAdOCompetizioni === 'undefined') {
      return { comps: [], teams: [], positions: [] };
    }

    const comps = [];
    for (let i = 1; i < arrAdOCompetizioni.length; i++) {
      if (arrAdOCompetizioni[i]) comps.push(arrAdOCompetizioni[i]);
    }

    const teams = [];
    for (let i = 1; i < arrAdOFantasquadre.length; i++) {
      if (arrAdOFantasquadre[i]) teams.push(arrAdOFantasquadre[i]);
    }

    const positions = [];
    for (let i = 1; i < arrAdOPosizioni.length; i++) {
      if (arrAdOPosizioni[i]) positions.push(arrAdOPosizioni[i]);
    }

    // Sort positions by year desc, then position asc
    positions.sort((a, b) => {
      if (b.anno !== a.anno) return b.anno - a.anno;
      return a.posizione - b.posizione;
    });

    return { comps, teams, positions };
  },

  /**
   * Restituisce l'elenco dei soli gironi con formula "all'italiana" (almeno 3 squadre),
   * escludendo tassativamente gli scontri diretti / coppe a eliminazione (2 squadre).
   */
  getGironiAllItaliana() {
    const counts = {};
    if (typeof arrClassifica !== 'undefined' && Array.isArray(arrClassifica)) {
      arrClassifica.forEach(c => {
        if (c && c.IDGirone) {
          counts[c.IDGirone] = (counts[c.IDGirone] || 0) + 1;
        }
      });
    }
    const list = [];
    if (typeof arrGironi !== 'undefined' && Array.isArray(arrGironi)) {
      arrGironi.forEach(g => {
        if (g && counts[g.ID] >= 3) {
          const compId = g.IDComp || g.IDCompetizione;
          const comp = (typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni))
            ? arrCompetizioni.find(c => c && c.ID === compId)
            : null;
          const compName = comp ? comp.Nome : 'Lega';
          list.push({
            id: g.ID,
            idCompetizione: compId,
            nomeGirone: g.Nome,
            nomeCompetizione: compName,
            squadreCount: counts[g.ID],
            label: `${compName} - ${g.Nome} (${counts[g.ID]} squadre)`
          });
        }
      });
    }
    return list;
  },

  /**
   * Carica in parallelo tutti i tabellini delle giornate di Serie A richieste,
   * parsando i dati in memoria in _tabelliniStore senza sovrascrivere o inquinare window.arrTabellini.
   */
  async loadAllMatchdaysResults(serieADays = []) {
    if (!this._tabelliniStore) this._tabelliniStore = {};
    if (!this._tabelliniLoadedDays) this._tabelliniLoadedDays = new Set();
    const missing = (serieADays || []).filter(d => !this._tabelliniLoadedDays.has(d));
    if (missing.length === 0) return this._tabelliniStore;

    const TConstructor = (typeof T !== 'undefined') ? T : (typeof window !== 'undefined' ? window.T : null);

    const promises = missing.map(async (day) => {
      try {
        const url = this._resolvePath(`js/fcmRisultatiDati${day}.js`);
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        const parseFn = new Function('T', `${text}; return (typeof arrTabellini !== "undefined") ? arrTabellini : [];`);
        const tabs = parseFn(TConstructor);
        if (Array.isArray(tabs)) {
          tabs.forEach(t => {
            if (t && t.IDIncontro && t.IDSquadra) {
              if (!this._tabelliniStore[t.IDIncontro]) this._tabelliniStore[t.IDIncontro] = {};
              this._tabelliniStore[t.IDIncontro][t.IDSquadra] = t;
            }
          });
        }
        this._tabelliniLoadedDays.add(day);
      } catch (err) {
        console.warn(`[fcmDataLoader] Impossibile caricare risultati per giornata ${day}:`, err);
      }
    });

    await Promise.all(promises);
    return this._tabelliniStore;
  },

  /**
   * Motore di calcolo nativo "Se avessi avuto..." (InvertiCalendario)
   * Calcola la matrice comparativa dei punti per ogni squadra con il calendario di ciascun avversario.
   * Utilizza fedelmente FCMCalcoloMotore e fcmCalcolorisultatiVariabili.js applicando tutti i modificatori:
   * Difesa (su avversario), Centrocampo (differenza), Attacco, Portiere, Fattore Campo, diffT, autogol.
   */
  async computeIncrociData(targetGironeId = null, forceReload = false) {
    // 1. Assicura dipendenze standard FCM
    try {
      if (typeof arrCompetizioni === 'undefined' || typeof arrGironi === 'undefined') {
        await this.loadScript('js/fcmCompetizioniDati.js');
      }
      if (typeof arrClassifica === 'undefined') {
        await this.loadScript('js/fcmClassificaDati.js');
      }
      if (typeof arrIncontri === 'undefined') {
        await this.loadScript('js/fcmCalendarioDati.js');
      }
      if (typeof fattorecampo === 'undefined' || typeof diffT === 'undefined') {
        await this.loadScript('js/fcmCalcolorisultatiVariabili.js');
      }
      if (typeof FCMCalcoloMotore === 'undefined') {
        await this.loadScript('js/fcmCalcoloMotore.js');
      }
      if (typeof T === 'undefined') {
        await this.loadScript('js/fcmCostruttori.js');
      }
    } catch (e) {
      console.warn('[fcmDataLoader] Errore caricamento script per incroci:', e);
    }

    const allItaliana = this.getGironiAllItaliana();
    const activeGironeId = (targetGironeId !== null && targetGironeId !== undefined)
      ? parseInt(targetGironeId, 10)
      : (allItaliana.length > 0 ? allItaliana[0].id : 1);

    const cacheKey = `girone_${activeGironeId}`;
    if (!forceReload && this._incrociCache && this._incrociCache[cacheKey]) {
      return this._incrociCache[cacheKey];
    }

    // 2. Info girone e competizione
    const gironeObj = (typeof arrGironi !== 'undefined' && Array.isArray(arrGironi))
      ? arrGironi.find(g => g && g.ID === activeGironeId)
      : null;
    const compId = gironeObj ? (gironeObj.IDComp || gironeObj.IDCompetizione) : 1;
    const compObj = (gironeObj && typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni))
      ? arrCompetizioni.find(c => c && c.ID === compId)
      : null;
    const gironeName = gironeObj ? gironeObj.Nome : `Girone ${activeGironeId}`;
    const compName = compObj ? compObj.Nome : 'Lega';

    // 3. Squadre partecipanti ordinate per ID squadra in ordine crescente (come in arrFantasquadre / tableIncroci)
    const gironeClassifica = (typeof arrClassifica !== 'undefined' && Array.isArray(arrClassifica))
      ? arrClassifica.filter(c => c && c.IDGirone === activeGironeId)
      : [];
    const teams = gironeClassifica
      .map(c => ({ id: c.ID, name: c.Nome, realPts: c.Punti }))
      .sort((a, b) => a.id - b.id);
    const N = teams.length;

    if (N < 2) {
      return {
        gironeId: activeGironeId,
        gironeName,
        competitionName: compName,
        teams: [],
        teamNames: [],
        matrix: [],
        playedMatchdays: 0,
        allItalianaGironi: allItaliana,
        highlights: null
      };
    }

    // 4. Incontri disputati validi (esclusi turni fittizi di riposo)
    const matches = (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri))
      ? arrIncontri.filter(m => m && m.IDGirone === activeGironeId && m.Giocato === 1 && m.IDSquadre.Casa > 0 && m.IDSquadre.Fuori > 0)
      : [];

    const matchdayMap = {};
    matches.forEach(m => {
      if (!matchdayMap[m.IDFantagiornata]) matchdayMap[m.IDFantagiornata] = [];
      matchdayMap[m.IDFantagiornata].push(m);
    });

    // 5. Carica tabellini per tutte le giornate disputate
    const uniqueDaysOfA = [...new Set(matches.map(m => m.GiornataDiA).filter(d => d > 0))];
    await this.loadAllMatchdaysResults(uniqueDaysOfA);

    // Helper per somma voti centrocampo con riserve d'ufficio
    const getMidfieldTotal = (t) => {
      if (!t) return 25;
      const ruoli = (t.Ruolo || '').split('%');
      const voti = (t.Voto || '').split('%');
      let tot = 0, count = 0;
      for (let x = 0; x < 11; x++) {
        const r = ruoli[x];
        if (r === '3' || r === '7') {
          const v = parseFloat((voti[x] || '0').replace(',', '.'));
          if (v > 0) { tot += v; count++; }
        }
      }
      const vuCen = (typeof pModCRisU !== 'undefined') ? Number(pModCRisU) : 5;
      tot += (5 - count) * vuCen;
      return tot;
    };

    // Helper per modificatore centrocampo FCM
    const getMidfieldMod = (diff) => {
      const absDiff = Math.abs(diff);
      if (absDiff < 1) return 0;
      if (absDiff < 2) return 0.5;
      if (absDiff < 3) return 1.0;
      if (absDiff < 4) return 1.5;
      if (absDiff < 5) return 2.0;
      if (absDiff < 6) return 2.5;
      if (absDiff < 7) return 3.0;
      if (absDiff < 8) return 3.5;
      return 4.0;
    };

    // 6. Calcolo matrice incrociata N x N
    const matrix = Array.from({ length: N }, () => Array(N).fill(0));
    const defaultFCampo = (typeof fattorecampo !== 'undefined') ? Number(fattorecampo) : 2;

    for (const [dayId, dMatches] of Object.entries(matchdayMap)) {
      const avversari = {};
      const teamInfo = {};

      for (const m of dMatches) {
        const hId = m.IDSquadre.Casa;
        const aId = m.IDSquadre.Fuori;
        const hasHomeAdv = (m.IDTipo === 1);

        avversari[hId] = { oppId: aId, isHome: true, hasHomeAdv };
        avversari[aId] = { oppId: hId, isHome: false, hasHomeAdv };

        const tabH = this._tabelliniStore[m.ID] ? this._tabelliniStore[m.ID][hId] : null;
        const tabA = this._tabelliniStore[m.ID] ? this._tabelliniStore[m.ID][aId] : null;

        const parzH = tabH ? tabH.ParzialeSquadra : (m.Parziali ? m.Parziali.Casa : 0);
        const parzA = tabA ? tabA.ParzialeSquadra : (m.Parziali ? m.Parziali.Fuori : 0);

        const modAttH = tabH && tabH.ModAttacco !== 'x' ? Number(tabH.ModAttacco) : 0;
        const modAttA = tabA && tabA.ModAttacco !== 'x' ? Number(tabA.ModAttacco) : 0;

        const modPorH = tabH && tabH.ModPortiere !== 'x' ? Number(tabH.ModPortiere) : 0;
        const modPorA = tabA && tabA.ModPortiere !== 'x' ? Number(tabA.ModPortiere) : 0;

        // Modificatore difesa generato: tabA subisce la difesa di H, tabH subisce la difesa di A
        const genDefH = tabA && tabA.ModDifesa !== 'x' ? Number(tabA.ModDifesa) : 0;
        const genDefA = tabH && tabH.ModDifesa !== 'x' ? Number(tabH.ModDifesa) : 0;

        teamInfo[hId] = {
          baseScore: parzH + modAttH + modPorH,
          genDef: genDefH,
          midfieldTot: getMidfieldTotal(tabH)
        };

        teamInfo[aId] = {
          baseScore: parzA + modAttA + modPorA,
          genDef: genDefA,
          midfieldTot: getMidfieldTotal(tabA)
        };
      }

      for (let j = 0; j < N; j++) {
        const idJ = teams[j].id;

        for (let k = 0; k < N; k++) {
          const idK = teams[k].id;
          const avvK = avversari[idK];
          if (!avvK) continue; // turno di riposo per K

          let currAvvId = avvK.oppId;
          let home = avvK.isHome;
          const fattoreCampoBol = avvK.hasHomeAdv;

          // Gestione scontro diretto InvertiCal: J contro K a campo invertito
          if (currAvvId === idJ) {
            currAvvId = idK;
            home = !home;
          }

          const jData = teamInfo[idJ];
          const oppData = teamInfo[currAvvId];
          if (!jData || !oppData) continue; // turno di riposo per J

          const fCampo = fattoreCampoBol ? defaultFCampo : 0;

          // Punteggi base: la squadra che gioca in casa riceve il fattore campo
          let homeScore = home ? (jData.baseScore + fCampo) : (oppData.baseScore + fCampo);
          let awayScore = home ? oppData.baseScore : jData.baseScore;

          // Modificatore difesa: applicato alla squadra avversaria
          if (home) {
            awayScore += jData.genDef;
            homeScore += oppData.genDef;
          } else {
            homeScore += jData.genDef;
            awayScore += oppData.genDef;
          }

          // Modificatore centrocampo a differenza
          const diffCent = jData.midfieldTot - oppData.midfieldTot;
          const modC = getMidfieldMod(diffCent);

          if ((!(diffCent > 0) || !home) && (!(diffCent < 0) || home)) {
            homeScore -= modC;
            awayScore += modC;
          } else {
            homeScore += modC;
            awayScore -= modC;
          }

          // Calcolo gol con FCMCalcoloMotore ufficiale
          const resGol = window.FCMCalcoloMotore
            ? window.FCMCalcoloMotore.calcolaGolSquadre(homeScore, awayScore)
            : (typeof FCMCalcoloMotore !== 'undefined' ? FCMCalcoloMotore.calcolaGolSquadre(homeScore, awayScore) : { golCasa: 0, golFuori: 0 });

          const homeGol = resGol.golCasa;
          const awayGol = resGol.golFuori;

          let pt = 0;
          if (homeGol > awayGol) pt = 3;
          else if (homeGol < awayGol) pt = 0;
          else pt = 1;

          if (!home) {
            if (pt === 3) pt = 0;
            else if (pt === 0) pt = 3;
          }

          matrix[j][k] += pt;
        }
      }
    }

    // 7. Statistiche aggregate per squadra
    const enrichedTeams = teams.map((t, i) => {
      const realPts = t.realPts;
      const row = matrix[i];
      const avgPts = Number((row.reduce((a, b) => a + b, 0) / N).toFixed(1));
      const luckPts = Number((realPts - avgPts).toFixed(1));
      const maxPts = Math.max(...row);
      const minPts = Math.min(...row);

      const bestCalIndices = row.map((val, idx) => val === maxPts ? idx : -1).filter(idx => idx !== -1);
      const worstCalIndices = row.map((val, idx) => val === minPts ? idx : -1).filter(idx => idx !== -1);

      return {
        ...t,
        index: i,
        realPts,
        avgPts,
        luckPts,
        maxPts,
        minPts,
        bestCalendars: bestCalIndices.map(idx => teams[idx].name),
        worstCalendars: worstCalIndices.map(idx => teams[idx].name),
        rowPoints: row
      };
    });

    // 8. Highlights di lega
    let mostLucky = enrichedTeams[0];
    let mostUnlucky = enrichedTeams[0];
    enrichedTeams.forEach(t => {
      if (t.luckPts > mostLucky.luckPts) mostLucky = t;
      if (t.luckPts < mostUnlucky.luckPts) mostUnlucky = t;
    });

    // Punti medi concessi da ciascun calendario (colonna k)
    const calAvgs = [];
    for (let k = 0; k < N; k++) {
      let colSum = 0;
      for (let j = 0; j < N; j++) {
        colSum += matrix[j][k];
      }
      const avg = Number((colSum / N).toFixed(1));
      calAvgs.push({ teamName: teams[k].name, avg });
    }
    calAvgs.sort((a, b) => b.avg - a.avg);
    const easiestCalendar = calAvgs[0];
    const hardestCalendar = calAvgs[calAvgs.length - 1];

    const result = {
      gironeId: activeGironeId,
      gironeName,
      competitionName: compName,
      teams: enrichedTeams,
      teamNames: teams.map(t => t.name),
      matrix,
      playedMatchdays: Object.keys(matchdayMap).length,
      allItalianaGironi: allItaliana,
      highlights: {
        mostLucky,
        mostUnlucky,
        easiestCalendar,
        hardestCalendar
      }
    };

    if (!this._incrociCache) this._incrociCache = {};
    this._incrociCache[cacheKey] = result;
    return result;
  },

  /**
   * Wrapper di compatibilità
   */
  async getIncrociData(targetGironeId = null) {
    return await this.computeIncrociData(targetGironeId);
  },

  /**
   * League documents
   */
  getDocuments() {
    if (typeof arrDocumenti === 'undefined') return [];
    const docs = [];
    for (let i = 1; i < arrDocumenti.length; i++) {
      if (arrDocumenti[i]) docs.push(arrDocumenti[i]);
    }
    return docs;
  },

  /**
   * Helper: Parse birth date from either MM/DD/YYYY [HH:mm:ss] (FCM Extract JSON)
   * or DD/MM/YYYY or YYYY-MM-DD
   */
  parseBirthDateObj(dataStr) {
    if (!dataStr) return null;
    const str = String(dataStr).trim();
    if (str.length < 8 || str === '-' || str.toLowerCase() === 'n.d.') return null;

    const datePart = str.split(' ')[0];
    if (datePart.includes('/')) {
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let month, day, year;
          if (p0 > 12) {
            day = p0; month = p1; year = p2;
          } else if (p1 > 12) {
            month = p0; day = p1; year = p2;
          } else {
            // ambiguo: gli archivi SQLite di FCM usano GG/MM/AAAA
            day = p0; month = p1; year = p2;
          }
          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  },

  /**
   * Helper: Calculate age at reference date (defaults to current date)
   */
  calcAge(dataStr, refDate = new Date()) {
    const birth = this.parseBirthDateObj(dataStr);
    if (!birth) return null;
    const today = (refDate instanceof Date) ? refDate : new Date(refDate);
    let age = today.getFullYear() - birth.getFullYear();
    const mDiff = today.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  },

  /**
   * Helper: Calculate exact age in years and days at reference date
   */
  calcExactAge(dataStr, refDate = new Date()) {
    const birth = this.parseBirthDateObj(dataStr);
    if (!birth) return null;
    const today = (refDate instanceof Date) ? refDate : new Date(refDate);
    const y = birth.getFullYear();
    const m = birth.getMonth() + 1;
    const d = birth.getDate();

    let years = today.getFullYear() - y;
    let birthdayThisYear = new Date(today.getFullYear(), m - 1, d);
    if (today < birthdayThisYear) {
      years--;
      birthdayThisYear = new Date(today.getFullYear() - 1, m - 1, d);
    }

    const oneDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((today.getTime() - birthdayThisYear.getTime()) / oneDay);
    const label = `${years} ${years === 1 ? 'anno' : 'anni'} e ${days} ${days === 1 ? 'giorno' : 'giorni'}`;

    return {
      years,
      days,
      label,
      birthDateObj: birth,
      year: y
    };
  },

  /**
   * Helper: Format birth date in Italian DD/MM/YYYY
   */
  formatBirthDate(dataStr) {
    const d = this.parseBirthDateObj(dataStr);
    if (!d) return dataStr || 'N.D.';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },

  /**
   * Helper to fetch and parse JSON safely, stripping UTF-8 BOM if present
   */
  async fetchJson(url, forceReload = false) {
    if (!url) return null;
    const resolvedUrl = this._resolvePath(url);
    if (!forceReload && this._fetchCache && this._fetchCache.has(resolvedUrl)) {
      return this._fetchCache.get(resolvedUrl);
    }
    if (!forceReload && this._fetchPromises && this._fetchPromises.has(resolvedUrl)) {
      return this._fetchPromises.get(resolvedUrl);
    }
    const p = (async () => {
      try {
        const resp = await fetch(resolvedUrl);
        if (!resp.ok) return null;
        const text = await resp.text();
        const clean = (text && text.charCodeAt(0) === 0xFEFF) ? text.slice(1) : text;
        const parsed = JSON.parse(clean);
        if (!this._fetchCache) this._fetchCache = new Map();
        this._fetchCache.set(resolvedUrl, parsed);
        return parsed;
      } catch (e) {
        console.warn(`Impossibile caricare o analizzare JSON da ${resolvedUrl}:`, e);
        return null;
      } finally {
        if (this._fetchPromises) this._fetchPromises.delete(resolvedUrl);
      }
    })();
    if (!this._fetchPromises) this._fetchPromises = new Map();
    this._fetchPromises.set(resolvedUrl, p);
    return p;
  },

  /**
   * Helper: Load list of all available seasons from SQLite via inc/api_storico.php (or sqlite/stagioni.json)
   */
  async loadStagioni() {
    if (this._cachedStagioni) return this._cachedStagioni;
    let list = await this.fetchJson('sqlite/stagioni.json');
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = await this.fetchJson('inc/api_storico.php?action=stagioni');
    }
    if (list && Array.isArray(list)) {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
      this._cachedStagioni = list;
      return list;
    }
    return [];
  },

  /**
   * Helper: Carica la configurazione dei siti legacy da inc/data/storico_config.json (o API fallback)
   */
  async loadStoricoConfig() {
    if (this._cachedStoricoConfig) return this._cachedStoricoConfig;
    let cfg = await this.fetchJson('inc/data/storico_config.json');
    if (!cfg) {
      const apiRes = await this.fetchJson('inc/storico_admin_save.php?action=get_config');
      if (apiRes && apiRes.config) {
        cfg = apiRes.config;
      }
    }
    if (!cfg) {
      cfg = { showLegacySites: true, seasons: {} };
    }
    this._cachedStoricoConfig = cfg;
    return cfg;
  },

  /**
   * Carica e aggrega l'archivio completo delle sole stagioni concluse (season < currentSeason).
   * Autorità primaria: archivi storici SQLite.
   * Include podi e competizioni dinamiche da arrAdOPosizioni (divisioni solo se presenti)
   * e collegamento legacy opzionale SOLO se la relativa cartella è configurata.
   */
  async loadArchivioStagioni() {
    if (this._cachedArchivioStagioni) return this._cachedArchivioStagioni;

    // 1. Verifica disponibilità modulo storico
    if (typeof fcmModules !== 'undefined' && !fcmModules.hasStoricoAvanzato()) {
      return { seasons: [], stats: null, hasData: false };
    }

    // 2. Carica stagioni SQLite (fonte autorevole)
    const allSeasons = await this.loadStagioni();
    if (!allSeasons || !Array.isArray(allSeasons) || allSeasons.length === 0) {
      return { seasons: [], stats: null, hasData: false };
    }

    const currentSeason = this.getCurrentSeason();
    // Filtra ESCLUSIVAMENTE stagioni concluse: season < currentSeason
    const pastSeasons = allSeasons.filter(s => s && Number(s.id) < currentSeason);
    if (pastSeasons.length === 0) {
      return { seasons: [], stats: null, hasData: false };
    }

    // 3. Assicura caricamento dati albo nativo per podi e competizioni
    if (typeof arrAdOPosizioni === 'undefined' || typeof arrAdOCompetizioni === 'undefined') {
      try { await this.loadScript('js/fcmAlboDOroDati.js'); } catch (e) {}
    }

    if (typeof arrPalmares === 'undefined') {
      try { await this.loadConfronti(); } catch (e) {}
    }

    // 4. Carica in parallelo dati opzionali da SQLite / configurazioni
    const [topCostiData, fmData, confrontiData, storicoConfig] = await Promise.all([
      (this.fetchJson('sqlite/top_costi.json').then(d => d || this.fetchJson('inc/api_storico.php?action=top_costi'))).catch(() => null),
      this.loadFantamisterStorico().catch(() => null),
      (this.fetchJson('sqlite/confronti.json').then(d => d || this.fetchJson('inc/api_storico.php?action=confronti'))).catch(() => null),
      this.loadStoricoConfig().catch(() => ({ showLegacySites: true, seasons: {} }))
    ]);

    // Mappe per nomi competizioni e fantasquadre
    const compMap = new Map();
    if (typeof arrAdOCompetizioni !== 'undefined' && Array.isArray(arrAdOCompetizioni)) {
      for (let i = 1; i < arrAdOCompetizioni.length; i++) {
        const c = arrAdOCompetizioni[i];
        if (c && c.IDc) compMap.set(c.IDc, c);
      }
    }

    const teamMap = new Map();
    if (typeof arrAdOFantasquadre !== 'undefined' && Array.isArray(arrAdOFantasquadre)) {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f && f.IDf) teamMap.set(f.IDf, f);
      }
    }

    // Matches per conteggi gol e partite
    const allMatches = (confrontiData && Array.isArray(confrontiData.matches)) ? confrontiData.matches : [];

    // FantaMister comp0
    const fmComp0 = (fmData && fmData.byComp && fmData.byComp[0]) ? fmData.byComp[0] : null;

    // Top Costi players
    const tcPlayers = (topCostiData && Array.isArray(topCostiData.players)) ? topCostiData.players : [];

    const seasonsAggregated = [];
    const uniqueChampions = new Set();
    let totalAllTimeMatches = 0;
    let totalAllTimeGoals = 0;

    for (const seasonObj of pastSeasons) {
      const sId = Number(seasonObj.id);
      const sYear = seasonObj.anno || (2012 + sId);
      const sYearsLabel = seasonObj.anni_stagione || `${sYear}/${sYear + 1}`;
      const sLeagueName = seasonObj.nome_lega || `Stagione ${sId}`;

      // Posizioni albo per questa stagione
      const sPositions = [];
      if (typeof arrAdOPosizioni !== 'undefined' && Array.isArray(arrAdOPosizioni)) {
        for (let i = 1; i < arrAdOPosizioni.length; i++) {
          const p = arrAdOPosizioni[i];
          if (p && (Number(p.stagione) === sId || Number(p.anno) === sYear)) {
            sPositions.push(p);
          }
        }
      }

      // Squadre partecipanti alla stagione
      const sTeamIds = Array.from(new Set(sPositions.map(p => p.idSquadra)));
      const teamsCount = sTeamIds.length > 0 ? sTeamIds.length : (seasonObj.teamsCount || 0);

      // Raggruppamento competizioni dinamico (le divisioni sono solo eventuali)
      const compIds = Array.from(new Set(sPositions.map(p => p.idCompetizione)));
      const competitions = [];

      for (const cId of compIds) {
        const cMeta = compMap.get(cId) || { IDc: cId, nome: `Competizione #${cId}` };
        const cRows = sPositions.filter(p => p.idCompetizione === cId).sort((a, b) => (a.posizione || 0) - (b.posizione || 0));
        
        // Verifica se questa competizione rappresenta una divisione specifica
        // Solo ed esclusivamente se presente nella configurazione o denominazione
        const isDivision = Boolean(cMeta.isDivision || /divisione|serie\s*[a-z]/i.test(cMeta.nome || ''));
        const divisionName = isDivision ? cMeta.nome : null;

        const podium = cRows.map(r => {
          const tObj = teamMap.get(r.idSquadra);
          const tName = tObj ? tObj.nome : (r.nomeSquadra || `Squadra #${r.idSquadra}`);
          if (r.posizione === 1 && (cId === 5 || !isDivision)) {
            uniqueChampions.add(tName);
          }
          return {
            pos: r.posizione,
            teamId: r.idSquadra,
            teamName: tName,
            president: r.presidente || '',
            points: r.punti || 0,
            note: r.note || ''
          };
        });

        competitions.push({
          id: cId,
          name: cMeta.nome,
          isDivision: isDivision,
          divisionName: divisionName,
          podium: podium
        });
      }

      // Partite e gol della stagione da confronti.json
      const sMatches = allMatches.filter(m => Number(m.season) === sId);
      const matchesCount = sMatches.length;
      let goalsCount = 0;
      let minMatchday = 1;
      if (matchesCount > 0) {
        const validDays = sMatches.map(m => Number(m.matchday || m.GiornataA)).filter(d => !isNaN(d) && d > 0);
        if (validDays.length > 0) minMatchday = Math.min(...validDays);
      }
      sMatches.forEach(m => {
        goalsCount += (Number(m.golCasa) || 0) + (Number(m.golFuori) || 0);
      });
      totalAllTimeMatches += matchesCount;
      totalAllTimeGoals += goalsCount;

      // Highlights da SQLite
      // 1. Top player d'asta
      const sTcPlayers = tcPlayers.filter(p => Number(p.seasonNum) === sId);
      const topCostPlayer = sTcPlayers.length > 0 ? [...sTcPlayers].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0] : null;

      // 2. Capocannoniere
      const topGoalPlayer = sTcPlayers.length > 0 ? [...sTcPlayers].filter(p => (p.goals || 0) > 0).sort((a, b) => (b.goals || 0) - (a.goals || 0))[0] : null;

      // 3. FantaMister
      let bestManager = null;
      if (fmComp0 && fmComp0.stagioni && fmComp0.stagioni[String(sId)] && fmComp0.stagioni[String(sId)].ranking) {
        const rank = fmComp0.stagioni[String(sId)].ranking;
        if (rank && rank.length > 0) {
          bestManager = rank[0];
        }
      }

      // 4. Risoluzione cartella legacy: il pulsante compare SOLO se la cartella è esplicitamente configurata
      let legacyPath = null;
      const sKey = String(sId);
      const isShowLegacyEnabled = storicoConfig && storicoConfig.showLegacySites !== false;

      if (isShowLegacyEnabled) {
        // Verifica se configurata esplicitamente in inc/data/storico_config.json
        if (storicoConfig && storicoConfig.seasons && storicoConfig.seasons[sKey] && storicoConfig.seasons[sKey].folder) {
          const cleanF = String(storicoConfig.seasons[sKey].folder).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
          const idxFile = storicoConfig.seasons[sKey].index || 'index.php';
          legacyPath = `${cleanF}/${idxFile}`;
        } else if (typeof arrDirectory !== 'undefined' && Array.isArray(arrDirectory)) {
          // Verifica se presente in arrDirectory da Confronti Storici
          const dObj = arrDirectory.find(d => d && Number(d.Stagione) === sId);
          if (dObj && dObj.Directory && dObj.Directory !== '.' && dObj.Directory !== './') {
            const cleanDir = String(dObj.Directory).replace(/^\.\//, '').replace(/\/$/, '');
            legacyPath = `${cleanDir}/index.php`;
          }
        }
      }

      seasonsAggregated.push({
        id: sId,
        anno: sYear,
        anni_stagione: sYearsLabel,
        nome_lega: sLeagueName,
        teamsCount: teamsCount,
        firstMatchday: minMatchday,
        competitions: competitions,
        hasDivisions: competitions.some(c => c.isDivision),
        matchesCount: matchesCount,
        goalsCount: goalsCount,
        avgGoals: matchesCount > 0 ? (goalsCount / matchesCount).toFixed(2) : '0.00',
        highlights: {
          topCost: topCostPlayer ? {
            id: topCostPlayer.id,
            code: topCostPlayer.id || topCostPlayer.code,
            name: topCostPlayer.name,
            cost: topCostPlayer.cost,
            teamName: topCostPlayer.teamName,
            role: topCostPlayer.role || topCostPlayer.roleShort || ''
          } : null,
          topScorer: topGoalPlayer ? {
            id: topGoalPlayer.id,
            code: topGoalPlayer.id || topGoalPlayer.code,
            name: topGoalPlayer.name,
            goals: topGoalPlayer.goals,
            teamName: topGoalPlayer.teamName,
            role: topGoalPlayer.role || topGoalPlayer.roleShort || ''
          } : null,
          bestManager: bestManager ? {
            teamName: bestManager.teamName,
            scartoMedio: bestManager.scartoMedio
          } : null
        },
        hasLegacy: Boolean(legacyPath),
        legacyPath: legacyPath
      });
    }

    // Ordina decrescente (dalla più recente alla prima)
    seasonsAggregated.sort((a, b) => b.id - a.id);

    const minYear = seasonsAggregated.length > 0 ? Math.min(...seasonsAggregated.map(s => s.anno)) : 2013;

    const result = {
      seasons: seasonsAggregated,
      palmares: (confrontiData && Array.isArray(confrontiData.palmares)) ? confrontiData.palmares : [],
      stats: {
        totalSeasons: seasonsAggregated.length,
        uniqueChampionsCount: uniqueChampions.size,
        foundingYear: minYear,
        totalMatches: totalAllTimeMatches,
        totalGoals: totalAllTimeGoals
      },
      hasData: seasonsAggregated.length > 0
    };

    this._cachedArchivioStagioni = result;
    return result;
  },

  /**
   * Load and compute Ranking Storico
   */
  async loadRanking() {
    let data = await this.fetchJson('sqlite/ranking.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=ranking');
    }
    if (!data) return [];

    this._cachedRankingData = data;
    if (data.palmares && (!window.arrPalmares || window.arrPalmares.length <= 1)) {
      window.arrPalmares = [null, ...data.palmares];
    }
    return Array.isArray(data) ? data : (data.ranking || []);
  },

  /**
   * Check if Ranking Divisioni data exists and is populated
   */
  async hasRankingDivisioni() {
    if (!this._cachedRankingData) {
      await this.loadRanking();
    }
    const divs = this._cachedRankingData && this._cachedRankingData.divisions;
    if (!divs) return false;
    if (Array.isArray(divs)) return divs.length > 0;
    return Object.keys(divs).length > 0;
  },

  /**
   * Load and compute Ranking Divisioni
   */
  async loadRankingDivisioni() {
    if (!this._cachedRankingData) {
      await this.loadRanking();
    }
    return (this._cachedRankingData && this._cachedRankingData.divisions) ? this._cachedRankingData.divisions : {};
  },

  /**
   * Helper per determinare dinamicamente la squadra predefinita nelle sezioni storiche.
   * Evita di selezionare una squadra storica (idAttuale === 0)
   * e seleziona la prima squadra con idAttuale numerico > 0 più basso.
   * @param {Array} teams Lista delle squadre ({ id, name, idAttuale, ... })
   * @param {number|null} preferredId ID preferito (es. da URL o stato corrente)
   * @returns {Object|null} Squadra selezionata
   */
  getDefaultHistoricalTeam(teams, preferredId = null) {
    if (!Array.isArray(teams) || teams.length === 0) return null;

    if (preferredId !== null && preferredId !== undefined && !isNaN(preferredId)) {
      const pNum = Number(preferredId);
      const found = teams.find(t => (t.id !== undefined ? t.id : t.ID) === pNum || (t.idAttuale !== undefined ? t.idAttuale : t.IDAttuale) === pNum || t.currentId === pNum);
      if (found) return found;
    }

    const getIdAttuale = (t) => {
      if (t.idAttuale !== undefined && t.idAttuale !== null) return Number(t.idAttuale);
      if (t.IDAttuale !== undefined && t.IDAttuale !== null) return Number(t.IDAttuale);
      if (t.currentId !== undefined && t.currentId !== null) return Number(t.currentId);
      const tId = t.id !== undefined ? t.id : t.ID;
      if (typeof arrAdOFantasquadre !== 'undefined') {
        const ado = arrAdOFantasquadre.find(x => x && (x.IDf === tId || x.id === tId));
        if (ado && (ado.idAttuale !== undefined || ado.IDAttuale !== undefined)) return Number(ado.idAttuale !== undefined ? ado.idAttuale : ado.IDAttuale);
      }
      return 0;
    };

    // Risoluzione Squadra del Cuore come fallback automatico se non è passato un ID esplicito
    if ((preferredId === null || preferredId === undefined) && typeof fcmHomeConfigManager !== 'undefined') {
      const favId = fcmHomeConfigManager.getFavoriteTeamId();
      if (favId) {
        const favNum = Number(favId);
        const favFound = teams.find(t => {
          const idAtt = getIdAttuale(t);
          const tId = t.id !== undefined ? t.id : t.ID;
          if (idAtt === favNum || tId === favNum) return true;
          if (typeof fcmHomeConfigManager.isFavoriteTeam === 'function' && fcmHomeConfigManager.isFavoriteTeam(t.name || t.Nome)) return true;
          return false;
        });
        if (favFound) return favFound;
      }
    }

    const activeTeams = teams
      .map(t => ({ team: t, idAtt: getIdAttuale(t) }))
      .filter(item => item.idAtt > 0)
      .sort((a, b) => a.idAtt - b.idAtt);

    if (activeTeams.length > 0) {
      return activeTeams[0].team;
    }

    return teams[0];
  },

  /**
   * Helper per determinare dinamicamente la squadra avversaria predefinita per i confronti.
   * Evita la squadra principale (excludeTeamId) e le squadre storiche (idAttuale === 0),
   * selezionando la successiva con idAttuale numerico > 0 più basso.
   * @param {Array} teams Lista delle squadre
   * @param {number} excludeTeamId ID della prima squadra da escludere
   * @param {number|null} preferredId ID preferito per l'avversaria, se valido
   * @returns {Object|null} Squadra avversaria selezionata
   */
  getDefaultHistoricalOpponent(teams, excludeTeamId, preferredId = null) {
    if (!Array.isArray(teams) || teams.length === 0) return null;

    const exclId = Number(excludeTeamId);

    if (preferredId !== null && preferredId !== undefined && !isNaN(preferredId)) {
      const pId = Number(preferredId);
      const found = teams.find(t => (t.id !== undefined ? t.id : t.ID) === pId || (t.idAttuale !== undefined ? t.idAttuale : t.IDAttuale) === pId || t.currentId === pId);
      if (found && (found.id !== exclId)) return found;
    }

    const getIdAttuale = (t) => {
      if (t.idAttuale !== undefined && t.idAttuale !== null) return Number(t.idAttuale);
      if (t.IDAttuale !== undefined && t.IDAttuale !== null) return Number(t.IDAttuale);
      if (t.currentId !== undefined && t.currentId !== null) return Number(t.currentId);
      const tId = t.id !== undefined ? t.id : t.ID;
      if (typeof arrAdOFantasquadre !== 'undefined') {
        const ado = arrAdOFantasquadre.find(x => x && (x.IDf === tId || x.id === tId));
        if (ado && (ado.idAttuale !== undefined || ado.IDAttuale !== undefined)) return Number(ado.idAttuale !== undefined ? ado.idAttuale : ado.IDAttuale);
      }
      return 0;
    };

    const activeOpponents = teams
      .filter(t => (t.id !== undefined ? t.id : t.ID) !== exclId)
      .map(t => ({ team: t, idAtt: getIdAttuale(t) }))
      .filter(item => item.idAtt > 0)
      .sort((a, b) => a.idAtt - b.idAtt);

    if (activeOpponents.length > 0) {
      return activeOpponents[0].team;
    }

    return teams.find(t => (t.id !== undefined ? t.id : t.ID) !== exclId) || teams[0];
  },

  /**
   * Load and query Almanacco Storico
   */
  async loadAlmanacco() {
    let data = await this.fetchJson('sqlite/almanacco.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=almanacco');
    }
    if (!data) return null;

    const teams = (data.teams || []).map(t => {
      const id = t.id !== undefined ? t.id : t.ID;
      const name = t.name || t.Nome;
      const idAtt = t.idAttuale !== undefined ? t.idAttuale : (t.IDAttuale !== undefined ? t.IDAttuale : (t.currentId || 0));
      return { id: Number(id), ID: Number(id), name, Nome: name, idAttuale: Number(idAtt), IDAttuale: Number(idAtt), currentId: Number(idAtt) };
    }).filter(t => t.id && t.name);

    const normalizePlayer = (p) => {
      if (!p) return p;
      const r = p.roleShort || p.role || 'C';
      p.roleShort = r;
      p.role = p.role || r;
      if (!(Number(p.code) > 0) && p.player) {
        const syncedCode = this.getPlayerCode(p.player);
        if (syncedCode) p.code = syncedCode;
      }
      return p;
    };

    const fedelissimi = (data.fedelissimi || []).map(normalizePlayer);
    const cannonieri = (data.cannonieri || []).map(normalizePlayer);
    const cattivi = (data.cattivi || []).map(normalizePlayer);
    const bestieNere = (data.bestieNere || []).map(normalizePlayer);
    const top11 = (data.top11 || []).map(normalizePlayer);
    const flop11 = (data.flop11 || []).map(normalizePlayer);
    const topRating = (data.topRating || []).map(normalizePlayer);
    const flopRating = (data.flopRating || []).map(normalizePlayer);
    const ratingsFull = Array.isArray(data.ratings) ? data.ratings.map(normalizePlayer) : null;

    // Fallback graceful lookup from sqlite/album.json only if an older almanacco.json lacks `code`
    const allGroups = [fedelissimi, cannonieri, cattivi, bestieNere, top11, flop11, topRating, flopRating, ratingsFull || []];
    const hasCodeProp = allGroups.some(arr => arr.some(p => p && Object.prototype.hasOwnProperty.call(p, 'code')));
    if (!hasCodeProp) {
      try {
        const albData = await this.fetchJson('sqlite/album.json');
        if (albData && Array.isArray(albData.album)) {
          const albCodeMap = new Map();
          for (const a of albData.album) {
            if (!a) continue;
            const pid = Number(a.playerId || 0);
            const pname = (a.playerName || '').trim().toUpperCase();
            if (pname && pid > 0 && !albCodeMap.has(pname)) {
              albCodeMap.set(pname, pid);
            }
          }
          if (albCodeMap.size > 0) {
            for (const arr of allGroups) {
              for (const p of arr) {
                if (p && !(Number(p.code) > 0) && p.player) {
                  const foundCode = albCodeMap.get(String(p.player).trim().toUpperCase());
                  if (foundCode) p.code = foundCode;
                }
              }
            }
          }
        }
      } catch (e) { /* Ignore optional fallback error */ }
    }

    let ratingPool;
    if (ratingsFull && ratingsFull.length > 0) {
      ratingPool = ratingsFull;
    } else {
      const mergedMap = new Map();
      for (const p of [...topRating, ...flopRating]) {
        if (!p || !p.player) continue;
        const key = `${p.teamId || 0}:${String(p.player).trim().toUpperCase()}`;
        if (!mergedMap.has(key)) mergedMap.set(key, p);
      }
      ratingPool = Array.from(mergedMap.values());
    }

    const resolveTeamId = (teamId) => {
      const num = parseInt(teamId, 10);
      if (isNaN(num) || num <= 0) return 0;
      const match = teams.find(t => t.id === num || t.idAttuale === num || t.currentId === num);
      return match ? match.id : num;
    };

    return {
      teams,
      getFedelissimi: (teamId) => {
        const id = resolveTeamId(teamId);
        const list = fedelissimi.filter(p => id === 0 || p.teamId === id);
        return list.sort((a, b) => b.appearances - a.appearances);
      },
      getCannonieri: (teamId) => {
        const id = resolveTeamId(teamId);
        const list = cannonieri.filter(p => id === 0 || p.teamId === id);
        return list.sort((a, b) => b.goals - a.goals);
      },
      getCattivi: (teamId) => {
        const id = resolveTeamId(teamId);
        const list = cattivi.filter(p => id === 0 || p.teamId === id);
        return list.sort((a, b) => (b.expulsions * 3 + b.cautions) - (a.expulsions * 3 + a.cautions));
      },
      getBestieNere: (teamId) => {
        const id = resolveTeamId(teamId);
        const list = bestieNere.filter(p => id === 0 || p.teamId === id);
        return list.sort((a, b) => b.goals - a.goals);
      },
      getTop11: (teamId, minPresenze = 20) => {
        const id = resolveTeamId(teamId);
        const minPres = parseInt(minPresenze, 10) || 0;
        const pool = top11.filter(p => id === 0 || p.teamId === id);
        let list = pool.filter(p => (p.appearances || 0) >= minPres);
        list.sort((a, b) => (b.fmv || 0) - (a.fmv || 0) || (b.appearances || 0) - (a.appearances || 0));
        if (list.length < 18) {
          const seen = new Set(list.map(p => p.player));
          const remaining = pool.filter(p => !seen.has(p.player));
          remaining.sort((a, b) => (b.appearances || 0) - (a.appearances || 0));
          list = list.concat(remaining);
        }
        return list;
      },
      getFlop11: (teamId, minPresenze = 20) => {
        const id = resolveTeamId(teamId);
        const minPres = parseInt(minPresenze, 10) || 0;
        const pool = flop11.filter(p => id === 0 || p.teamId === id);
        let list = pool.filter(p => (p.appearances || 0) >= minPres);
        list.sort((a, b) => (a.fmv || 0) - (b.fmv || 0) || (b.appearances || 0) - (a.appearances || 0));
        if (list.length < 18) {
          const seen = new Set(list.map(p => p.player));
          const remaining = pool.filter(p => !seen.has(p.player));
          remaining.sort((a, b) => (b.appearances || 0) - (a.appearances || 0));
          list = list.concat(remaining);
        }
        return list;
      },
      getTopRating: (teamId, minPresenze = 20, limit = 20) => {
        const id = resolveTeamId(teamId);
        const parsedMin = parseInt(minPresenze, 10);
        const minPres = (!isNaN(parsedMin) && parsedMin >= 0) ? parsedMin : 20;
        const list = ratingPool.filter(p => (id === 0 || p.teamId === id) && Number(p.appearances || 0) >= minPres);
        list.sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)) || (Number(b.appearances || 0) - Number(a.appearances || 0)));
        return limit > 0 ? list.slice(0, limit) : list;
      },
      getFlopRating: (teamId, minPresenze = 20, limit = 20) => {
        const id = resolveTeamId(teamId);
        const parsedMin = parseInt(minPresenze, 10);
        const minPres = (!isNaN(parsedMin) && parsedMin >= 0) ? parsedMin : 20;
        const list = ratingPool.filter(p => (id === 0 || p.teamId === id) && Number(p.appearances || 0) >= minPres);
        list.sort((a, b) => (Number(a.rating || 0) - Number(b.rating || 0)) || (Number(b.appearances || 0) - Number(a.appearances || 0)));
        return limit > 0 ? list.slice(0, limit) : list;
      }
    };
  },

  /**
   * Load and query Album Storico Calciatori
   */
  async loadAlbum() {
    if (typeof arrGiocatoriA === 'undefined') {
      try { await this.loadScript('js/fcmSerieADatiDettaglio.js'); } catch (e) { }
    }
    if (typeof xg10 === 'undefined') {
      try { await this.loadScript('js/fcmSerieADati.js'); } catch (e) { }
    }
    if (typeof arrFantasquadre === 'undefined') {
      try { await this.loadScript('js/fcmFantasquadreDati.js'); } catch (e) { }
    }

    let data = await this.fetchJson('sqlite/album.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=album');
    }
    if (!data) return null;

    // Build active teams list (from data.teams or arrFantasquadre)
    const teams = [];
    if (data.teams && Array.isArray(data.teams)) {
      for (const t of data.teams) {
        const idAtt = t.idAttuale !== undefined ? t.idAttuale : (t.IDAttuale !== undefined ? t.IDAttuale : t.currentId);
        const tId = t.id !== undefined ? t.id : t.ID;
        const tName = t.name || t.Nome;
        if (t && Number(idAtt) !== 0) {
          teams.push({ id: Number(tId), ID: Number(tId), name: tName, Nome: tName, currentId: Number(idAtt), idAttuale: Number(idAtt), IDAttuale: Number(idAtt) });
        }
      }
    } else if (typeof arrFantasquadre !== 'undefined') {
      for (let i = 1; i < arrFantasquadre.length; i++) {
        const f = arrFantasquadre[i];
        if (f) teams.push({ id: f.ID, ID: f.ID, name: f.Nome, Nome: f.Nome, currentId: f.ID, idAttuale: f.ID, IDAttuale: f.ID });
      }
    }
    teams.sort((a, b) => a.name.localeCompare(b.name));

    // Photo lookup map
    const photoMap = new Map();
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let i = 1; i < arrGiocatoriA.length; i++) {
        const g = arrGiocatoriA[i];
        if (g) {
          const pName = window['xg' + g.ID];
          if (pName) photoMap.set(pName.trim().toUpperCase(), g.Codice);
        }
      }
    }

    // Index album by player name and ID
    const albumByName = new Map();
    const albumById = new Map();
    const curSeason = this.getCurrentSeason();

    for (const alb of (data.album || [])) {
      const pNameNorm = (alb.playerName || '').trim().toUpperCase();
      if (!albumByName.has(pNameNorm)) albumByName.set(pNameNorm, []);
      albumByName.get(pNameNorm).push(alb);

      const pId = Number(alb.playerId || 0);
      if (pId > 0) {
        if (!albumById.has(pId)) albumById.set(pId, []);
        albumById.get(pId).push(alb);
      }
    }

    return {
      teams,
      getTeamPlayers: (teamId) => {
        const tObj = teams.find(t => t.id === parseInt(teamId, 10)) || teams[0];
        if (!tObj) return [];

        const currentId = tObj.currentId;
        const players = [];

        if (typeof arrRose !== 'undefined') {
          for (let y = 1; y < arrRose.length; y++) {
            const r = arrRose[y];
            if (r && r.IDSquadra === currentId && (r.Stato === 0 || r.Stato === 1 || r.Stato === 2)) {
              const rNameNorm = (r.Nome || '').trim().toUpperCase();
              let photoCode = photoMap.get(rNameNorm) || '0';
              const pCodeNum = Number(photoCode);

              // Find career entries
              let rawCareer = albumByName.get(rNameNorm) || [];
              if (rawCareer.length === 0 && pCodeNum > 0) {
                rawCareer = albumById.get(pCodeNum) || [];
              }
              if ((!photoCode || photoCode === '0') && rawCareer.length > 0) {
                const histWithId = rawCareer.find(a => Number(a.playerId || 0) > 0);
                if (histWithId) photoCode = String(histWithId.playerId);
              }

              const career = rawCareer.map(alb => {
                const stgNum = parseInt(alb.seasonNum || alb.Stagione || (typeof alb.season === 'number' ? alb.season : (parseInt(alb.season, 10) || 0)), 10) || 0;
                const yearLabel = alb.seasonYear || alb.AnnoStagione || (typeof alb.season === 'string' && alb.season.includes('/') ? alb.season : (stgNum > 0 ? `${2012+stgNum}/${2013+stgNum}` : '-'));
                const isCurrent = stgNum === curSeason;
                const rosterLink = this.getSeasonRosterLink(stgNum, alb.teamId || alb.IDSquadra);

                return {
                  season: yearLabel,
                  seasonNum: stgNum,
                  teamId: alb.teamId || alb.IDSquadra,
                  historicalTeamId: alb.historicalTeamId || alb.IDSquadraStorica,
                  teamName: alb.teamName || alb.NomeSquadra,
                  isCurrent,
                  dirPath: this.getSeasonDirectory(stgNum),
                  rosterLink,
                  serieA: alb.serieA || (alb.SquadraA1 + (alb.SquadraA2 ? ` / ${alb.SquadraA2}` : '')),
                  serieATeamPrimary: alb.serieA ? alb.serieA.split('/')[0].trim() : (alb.SquadraA1 || ''),
                  appearances: alb.appearances !== undefined ? alb.appearances : alb.Presenze,
                  totVoti: alb.totVoti !== undefined ? alb.totVoti : alb.TotVoti,
                  totFV: alb.totFV !== undefined ? alb.totFV : alb.TotFantaVoti,
                  mv: (alb.appearances > 0 ? (alb.totVoti / alb.appearances).toFixed(2) : (alb.Presenze > 0 ? (alb.TotVoti / alb.Presenze).toFixed(2) : '-')),
                  fmv: (alb.appearances > 0 ? (alb.totFV / alb.appearances).toFixed(2) : (alb.Presenze > 0 ? (alb.TotFantaVoti / alb.Presenze).toFixed(2) : '-')),
                  goals: alb.goals !== undefined ? alb.goals : alb.Goal,
                  expulsions: alb.expulsions !== undefined ? alb.expulsions : alb.Espulsioni,
                  cautions: alb.cautions !== undefined ? alb.cautions : alb.Ammonizioni,
                  cost: alb.cost !== undefined ? alb.cost : alb.Costo
                };
              });

              career.sort((a, b) => b.seasonNum - a.seasonNum);

              let contractText = `${r.Contratto} ${r.Contratto === 1 ? 'anno' : 'anni'}`;
              if (r.Stato === 1) contractText = 'Svincolato';
              else if (r.Stato === 2) contractText = 'Infortunato';
              else if (r.Contratto === -2) contractText = 'Prestito';

              players.push({
                name: r.Nome,
                role: r.Ruolo, // 1=P, 2=D, 3=C, 4=A
                roleLabel: r.Ruolo === 1 ? 'Portiere' : r.Ruolo === 2 ? 'Difensore' : r.Ruolo === 3 ? 'Centrocampista' : 'Attaccante',
                roleShort: r.Ruolo === 1 ? 'P' : r.Ruolo === 2 ? 'D' : r.Ruolo === 3 ? 'C' : 'A',
                serieATeam: r.Squadra,
                status: r.Stato, // 0=in rosa, 1=svincolato, 2=infortunato
                contractText,
                costAcq: r.Acq,
                photoCode,
                career
              });
            }
          }
        }

        // Sort players by role (P -> D -> C -> A), then name
        return players.sort((a, b) => {
          if (a.status !== b.status) return a.status - b.status;
          if (a.role !== b.role) return a.role - b.role;
          return a.name.localeCompare(b.name);
        });
      }
    };
  },

  /**
   * Load and query Top Costi d'Asta (Storico e Stagione)
   */
  async loadTopCosti() {
    let data = await this.fetchJson('sqlite/top_costi.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=top_costi');
    }
    if (!data) return null;

    const hasExplicitCodes = Array.isArray(data.players) && data.players.some(p => p && Object.prototype.hasOwnProperty.call(p, 'code'));
    if (!hasExplicitCodes && typeof arrGiocatoriA === 'undefined') {
      try { await this.loadScript('js/fcmSerieADatiDettaglio.js'); } catch (e) { }
      try { await this.loadScript('js/fcmSerieADati.js'); } catch (e) { }
    }

    const teamsList = (data.teams || []).map(t => {
      const id = t.id !== undefined ? t.id : t.ID;
      const name = t.name || t.Nome;
      const idAtt = t.idAttuale !== undefined ? t.idAttuale : (t.IDAttuale !== undefined ? t.IDAttuale : (t.currentId || 0));
      return { id: Number(id), ID: Number(id), name, Nome: name, idAttuale: Number(idAtt), IDAttuale: Number(idAtt), currentId: Number(idAtt) };
    }).filter(t => t.id && t.name);
    const currentTeamNames = new Map();
    teamsList.forEach(t => {
      currentTeamNames.set(t.id, t.name);
      currentTeamNames.set(t.ID, t.name);
    });
    const maxSeason = data.maxSeason || this.getCurrentSeason();
    const players = (data.players || []).map(p => {
      p.roleShort = p.roleShort || p.role || 'C';
      p.role = p.role || p.roleShort || 'C';
      p.seasonNum = Number(p.seasonNum || 0);
      p.teamId = Number(p.teamId || 0);
      p.localTeamId = Number(p.localTeamId || 0);
      if (!(Number(p.code) > 0)) {
        const syncedCode = p.name ? this.getPlayerCode(p.name) : null;
        if (syncedCode) {
          p.code = Number(syncedCode);
        } else if (Number(p.id) > 0) {
          p.code = Number(p.id);
        }
      } else {
        p.code = Number(p.code);
      }
      return p;
    });

    const resolveTeamId = (teamId) => {
      const num = parseInt(teamId, 10);
      if (isNaN(num) || num <= 0) return 0;
      const found = teamsList.find(t => t.id === num || t.idAttuale === num || t.currentId === num);
      return found ? found.id : num;
    };

    return {
      teams: teamsList,
      maxSeason,
      getCurrentTeamName: (id) => currentTeamNames.get(id) || '',
      getTopCosti: (teamId = 0, role = 'ALL', isCurrentSeason = false, limit = 20) => {
        const id = resolveTeamId(teamId);
        let list = players.filter(g => {
          if (id !== 0 && g.teamId !== id) return false;
          if (isCurrentSeason && Number(g.seasonNum) !== Number(maxSeason)) return false;
          if (role !== 'ALL' && (g.role || g.roleShort || '').toUpperCase() !== role.toUpperCase()) return false;
          return true;
        });

        const seen = new Set();
        const deduped = [];
        list.sort((a, b) => b.cost - a.cost);

        for (const item of list) {
          const key = `${item.id}-${item.teamId}-${item.season}-${item.cost}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
          if (deduped.length >= limit) break;
        }

        return deduped;
      }
    };
  },

  /**
   * Carica i dati statistici storici e record di FantaMister
   */
  async loadFantamisterStorico() {
    if (this._cachedFantamisterStorico) {
      return this._cachedFantamisterStorico;
    }
    let data = await this.fetchJson('sqlite/fantamister_storico.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=fantamister_storico');
    }
    if (data) {
      this._cachedFantamisterStorico = data;
    }
    return data;
  },

  /**
   * Load and query Confronti Storici (Head-to-head & Palmares)
   */
  async loadConfronti() {
    if (this._cachedConfronti && window.arrConfronti && window.arrPalmares) {
      return this._cachedConfronti;
    }
    if (this._confrontiPromise) {
      return this._confrontiPromise;
    }

    this._confrontiPromise = (async () => {
      if (typeof arrCompetizioni === 'undefined') {
        try { await this.loadScript('js/fcmCompetizioniDati.js'); } catch (e) { }
      }
      if (typeof arrAdOFantasquadre === 'undefined') {
        try { await this.loadScript('js/fcmAlboDOroDati.js'); } catch (e) { }
      }

      let data = await this.fetchJson('sqlite/confronti.json');
      if (!data) {
        data = await this.fetchJson('inc/api_storico.php?action=confronti');
      }
      if (!data) return null;

    const matches = (data.matches || []).map(m => {
      m.Stagione = m.season;
      m.Competizione = m.comp;
      m.GiornataA = m.matchday;
      m.Data = m.date;
      m.IDASquadraCasa = m.homeId;
      m.SquadraCasa = m.homeTeam;
      m.IDASquadraFuori = m.awayId;
      m.SquadraFuori = m.awayTeam;
      m.GolCasa = m.golCasa;
      m.GolFuori = m.golFuori;
      m.TipoRis = m.tipoRis ?? 0;
      m.GolRegoCasa = m.golRegoCasa !== undefined ? m.golRegoCasa : m.golCasa;
      m.GolRegoFuori = m.golRegoFuori !== undefined ? m.golRegoFuori : m.golFuori;
      m.GolSupplCasa = m.golSupplCasa ?? 0;
      m.GolSupplFuori = m.golSupplFuori ?? 0;
      m.GolRigoriCasa = m.golRigoriCasa ?? 0;
      m.GolRigoriFuori = m.golRigoriFuori ?? 0;
      m.PuntiCasa = m.ptCasa;
      m.PuntiFuori = m.ptFuori;
      m.Neutro = m.isNeutro ? 'N' : ' ';
      return m;
    });

    window.arrConfronti = [null, ...matches];
    const arrConfronti = window.arrConfronti;
    if (data.palmares) {
      window.arrPalmares = [null, ...data.palmares];
    }
    if (data.posizioni && (!window.arrAdOPosizioni || window.arrAdOPosizioni.length <= 1)) {
      window.arrAdOPosizioni = [null, ...data.posizioni];
    }
    this._defendingWinnersCache = null;

    // Build teams map from data.teams or arrAdOFantasquadre or matches
    const teamsMap = new Map();
    if (data.teams && Array.isArray(data.teams)) {
      for (const t of data.teams) {
        const tId = t.id !== undefined ? t.id : t.ID;
        const tName = t.name || t.Nome;
        const tAtt = t.idAttuale !== undefined ? t.idAttuale : (t.IDAttuale !== undefined ? t.IDAttuale : (t.currentId || 0));
        if (tId && tName) {
          teamsMap.set(Number(tId), { id: Number(tId), ID: Number(tId), name: tName, Nome: tName, currentId: Number(tAtt), idAttuale: Number(tAtt), IDAttuale: Number(tAtt) });
        }
      }
    } else if (typeof arrAdOFantasquadre !== 'undefined') {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f && f.IDf && f.nome) {
          teamsMap.set(Number(f.IDf), { id: Number(f.IDf), ID: Number(f.IDf), name: f.nome, Nome: f.nome, currentId: Number(f.idAttuale || 0), idAttuale: Number(f.idAttuale || 0), IDAttuale: Number(f.idAttuale || 0) });
        }
      }
    }

    // Also parse from matches if any team is missing
    for (const m of matches) {
      const cId = Number(m.IDASquadraCasa);
      const fId = Number(m.IDASquadraFuori);
      if (cId > 0 && !teamsMap.has(cId) && m.SquadraCasa) {
        teamsMap.set(cId, { id: cId, ID: cId, name: m.SquadraCasa, Nome: m.SquadraCasa, currentId: 0, idAttuale: 0, IDAttuale: 0 });
      }
      if (fId > 0 && !teamsMap.has(fId) && m.SquadraFuori) {
        teamsMap.set(fId, { id: fId, ID: fId, name: m.SquadraFuori, Nome: m.SquadraFuori, currentId: 0, idAttuale: 0, IDAttuale: 0 });
      }
    }

    const teams = Array.from(teamsMap.values())
      .filter(t => t && t.id > 0 && t.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (typeof arrAdOFantasquadre === 'undefined' || arrAdOFantasquadre.length <= 1) {
      window.arrAdOFantasquadre = [null, ...teams.map(t => ({
        IDf: t.id,
        id: t.id,
        nome: t.name,
        name: t.name,
        idAttuale: t.idAttuale || 0,
        currentId: t.idAttuale || 0
      }))];
    }

    // Current competitions map from arrCompetizioni
    const currentCompById = new Map();
    if (typeof arrCompetizioni !== 'undefined') {
      for (let i = 1; i < arrCompetizioni.length; i++) {
        const c = arrCompetizioni[i];
        if (c) currentCompById.set(c.ID, c.Nome);
      }
    }

    // Competitions map: resolves dynamic name from arrCompetizioni via IDComp,
    // fallback to arrAdOCompetizioni name or arrPalmares
    const compMap = new Map();
    if (typeof arrAdOCompetizioni !== 'undefined') {
      for (let i = 1; i < arrAdOCompetizioni.length; i++) {
        const c = arrAdOCompetizioni[i];
        if (!c) continue;
        let compName = '';
        if (c.IDComp && currentCompById.has(c.IDComp)) {
          compName = currentCompById.get(c.IDComp);
        } else if (c.nome) {
          compName = c.nome;
        }
        if (compName) compMap.set(c.IDc, compName);
      }
    }
    if (typeof arrPalmares !== 'undefined') {
      for (let p = 1; p < arrPalmares.length; p++) {
        const pal = arrPalmares[p];
        if (pal && !compMap.has(pal.Competizione)) {
          compMap.set(pal.Competizione, pal.Label);
        }
      }
    }
    for (const [id, name] of currentCompById.entries()) {
      if (!compMap.has(id)) {
        compMap.set(id, name);
      }
    }

    // Dynamic competitions list for filters/dropdowns
    const usedCompIds = new Set();
    for (let i = 1; i < arrConfronti.length; i++) {
      const m = arrConfronti[i];
      if (m && m.Competizione) usedCompIds.add(m.Competizione);
    }
    const compOrder = [];
    if (typeof arrPalmares !== 'undefined') {
      for (let p = 1; p < arrPalmares.length; p++) {
        if (arrPalmares[p] && arrPalmares[p].Competizione && !compOrder.includes(arrPalmares[p].Competizione)) {
          compOrder.push(arrPalmares[p].Competizione);
        }
      }
    }
    const competitions = Array.from(usedCompIds).map(id => ({
      id,
      name: compMap.get(id) || `Competizione ${id}`
    })).sort((a, b) => {
      const idxA = compOrder.indexOf(a.id);
      const idxB = compOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id - b.id;
    });

    const DOWArray = ["", "Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const MOYArray = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    function formatDate(dStr) {
      if (!dStr) return '-';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const yr = d.getFullYear();
      const dow = DOWArray[d.getDay() + 1] || '';
      const moy = MOYArray[d.getMonth() + 1] || '';
      return `${dow} ${d.getDate()} ${moy} ${yr}`;
    }

    const retObj = {
      teams,
      competitions,
      compMap,
      getPalmares: (teamId) => {
        const id = parseInt(teamId, 10);
        const trophies = [];
        const trophyIcons = {};
        if (typeof arrPalmares !== 'undefined') {
          for (let p = 1; p < arrPalmares.length; p++) {
            const pal = arrPalmares[p];
            if (!pal) continue;
            const cId = pal.Competizione || pal.compId || pal.id;
            const cIcon = pal.Icona || pal.icon;
            if (cId && cIcon) {
              trophyIcons[cId] = cIcon;
            }
          }
        }
        if (typeof arrAdOPosizioni !== 'undefined' && typeof arrPalmares !== 'undefined') {
          for (let p = 1; p < arrPalmares.length; p++) {
            const pal = arrPalmares[p];
            if (!pal) continue;
            const cId = pal.Competizione || pal.compId || pal.id;
            const cLabel = pal.Label || pal.label || (compMap ? compMap.get(cId) : null) || pal.name || `Comp ${cId}`;
            const cIcon = pal.Icona || pal.icon || trophyIcons[cId] || 'ico-coppa.gif';
            let count = 0;
            const years = [];
            for (let i = 1; i < arrAdOPosizioni.length; i++) {
              const pos = arrAdOPosizioni[i];
              if (pos) {
                const sqId = pos.idSquadra !== undefined ? pos.idSquadra : pos.IDFantasquadra;
                const pPos = pos.posizione !== undefined ? pos.posizione : pos.Posizione;
                const pComp = pos.idCompetizione !== undefined ? pos.idCompetizione : pos.IDCompetizione;
                const pAnno = pos.anno !== undefined ? pos.anno : pos.Anno;
                if (Number(sqId) === id && Number(pPos) === 1 && Number(pComp) === Number(cId)) {
                  count++;
                  years.push(pAnno);
                }
              }
            }
            if (count > 0) {
              const compName = pal.Label || pal.label || (compMap ? compMap.get(cId) : null) || cLabel;
              trophies.push({
                compId: cId,
                name: compName,
                label: compName,
                icon: cIcon,
                count,
                years
              });
            }
          }
        }
        return trophies;
      },

      getBilancioAll: (teamId, compId = 0, stadio = 'T') => {
        const id = parseInt(teamId, 10);
        const comp = parseInt(compId, 10);
        const oppMap = new Map();

        for (const t of teams) {
          if (t.id !== id) {
            oppMap.set(t.id, {
              teamId: t.id,
              teamName: t.name,
              isCurrent: Boolean(t.currentId && t.currentId > 0),
              giocate: 0,
              vinte: 0,
              nulle: 0,
              perse: 0,
              gf: 0,
              gs: 0,
              ptFatti: 0,
              ptSubiti: 0
            });
          }
        }

        for (let i = 1; i < arrConfronti.length; i++) {
          const m = arrConfronti[i];
          if (!m) continue;
          if (comp !== 0 && m.Competizione !== comp) continue;

          const isHome = m.IDASquadraCasa === id;
          const isAway = m.IDASquadraFuori === id;
          if (!isHome && !isAway) continue;

          if (stadio === 'C' && !isHome) continue;
          if (stadio === 'F' && !isAway) continue;

          const oppId = isHome ? m.IDASquadraFuori : m.IDASquadraCasa;
          const oppName = isHome ? m.SquadraFuori : m.SquadraCasa;

          if (!oppMap.has(oppId)) {
            const tFound = teams.find(t => t.id === oppId);
            oppMap.set(oppId, {
              teamId: oppId,
              teamName: oppName,
              isCurrent: Boolean(tFound && tFound.currentId > 0),
              giocate: 0,
              vinte: 0,
              nulle: 0,
              perse: 0,
              gf: 0,
              gs: 0,
              ptFatti: 0,
              ptSubiti: 0
            });
          }

          const st = oppMap.get(oppId);
          st.giocate++;

          const myGoals = isHome ? m.GolCasa : m.GolFuori;
          const oppGoals = isHome ? m.GolFuori : m.GolCasa;
          const myPts = isHome ? m.PuntiCasa : m.PuntiFuori;
          const oppPts = isHome ? m.PuntiFuori : m.PuntiCasa;

          st.gf += myGoals;
          st.gs += oppGoals;
          st.ptFatti += myPts;
          st.ptSubiti += oppPts;

          if (myGoals > oppGoals) st.vinte++;
          else if (myGoals < oppGoals) st.perse++;
          else st.nulle++;
        }

        const list = Array.from(oppMap.values()).filter(o => o.giocate > 0);
        return list.map(o => ({
          ...o,
          dr: o.gf - o.gs,
          puntiClassifica: (o.vinte * 3) + o.nulle,
          ptFattiAvg: (o.ptFatti / o.giocate).toFixed(3),
          ptSubitiAvg: (o.ptSubiti / o.giocate).toFixed(3)
        })).sort((a, b) => b.puntiClassifica - a.puntiClassifica || b.dr - a.dr);
      },

      /**
       * Calcola la tabella Statistiche (Bestia Nera, Vittima Preferita, etc.)
       * seguendo la logica originaria di persjs/fcmConfrontiFunzioni.js (confrontiStat)
       */
      getStatisticheBNVP: (teamId, compId = 0, stadio = 'T') => {
        const bilancioList = retObj.getBilancioAll(teamId, compId, stadio);
        const totGiocate = bilancioList.reduce((acc, o) => acc + o.giocate, 0);

        const currentTeamsSet = new Set();
        if (typeof arrAdOFantasquadre !== 'undefined') {
          for (let i = 1; i < arrAdOFantasquadre.length; i++) {
            const f = arrAdOFantasquadre[i];
            if (f && f.idAttuale !== 0) currentTeamsSet.add(f.IDf);
          }
        }

        const categories = [
          { id: 1, label: 'BESTIA NERA', desc: 'Minor media punti conquistati contro l\'avversaria', icon: '👿', isMin: true, metric: o => ((o.vinte * 3) + o.nulle) / o.giocate },
          { id: 2, label: 'VITTIMA PREFERITA', desc: 'Maggior media punti conquistati contro l\'avversaria', icon: '🎯', isMin: false, metric: o => ((o.vinte * 3) + o.nulle) / o.giocate },
          { id: 3, label: 'SFIDA EQUILIBRATA', desc: 'Sfida con punteggi e bilancio più vicini alla parità', icon: '⚖️', isMin: true, metric: o => Math.abs(((o.vinte * 2) - (o.perse * 2) + (o.gf * 0.5) - (o.gs * 0.5)) / o.giocate) },
          { id: 4, label: 'ATTACCO IMMARCABILE', desc: 'Maggior media gol subiti a partita contro l\'avversaria', icon: '⚡', isMin: false, metric: o => o.gs / o.giocate },
          { id: 5, label: 'DIFESA IMPENETRABILE', desc: 'Minor media gol segnati a partita contro l\'avversaria', icon: '🛡️', isMin: true, metric: o => o.gf / o.giocate },
          { id: 6, label: 'ATTACCO ANNULLATO', desc: 'Minor media gol subiti a partita contro l\'avversaria', icon: '🔒', isMin: true, metric: o => o.gs / o.giocate },
          { id: 7, label: 'DIFESA COLABRODO', desc: 'Maggior media gol segnati a partita contro l\'avversaria', icon: '🌊', isMin: false, metric: o => o.gf / o.giocate },
        ];

        function pickBest(candidates, cat) {
          if (!candidates || candidates.length === 0) return null;
          let best = null;
          let bestVal = 0;
          for (const o of candidates) {
            const val = cat.metric(o);
            if (best === null) {
              best = o;
              bestVal = val;
            } else if (cat.isMin) {
              if (val < bestVal || (val === bestVal && o.giocate > best.giocate)) {
                best = o;
                bestVal = val;
              }
            } else {
              if (val > bestVal || (val === bestVal && o.giocate > best.giocate)) {
                best = o;
                bestVal = val;
              }
            }
          }
          if (!best) return null;
          return {
            teamId: best.teamId,
            teamName: best.teamName,
            val: Math.round(bestVal * 100) / 100,
            matches: best.giocate
          };
        }

        return categories.map(cat => ({
          id: cat.id,
          label: cat.label,
          desc: cat.desc,
          icon: cat.icon,
          assoluta: pickBest(bilancioList, cat),
          pesata: pickBest(bilancioList.filter(o => totGiocate > 0 && (o.giocate / totGiocate * 100) >= 4), cat),
          attuale: pickBest(bilancioList.filter(o => currentTeamsSet.has(o.teamId)), cat)
        }));
      },

      /**
       * Calcola i 14 tipi di record storici (partite con più gol, scarto, serie e punteggi massimi/minimi)
       */
      getRecordStorici: (tipo = '001', fsqId = 0, compId = 0, stadio = 'T', limit = 10, continuaSePari = 'S') => {
        const idFsq = parseInt(fsqId, 10);
        const idComp = parseInt(compId, 10);
        const arr = arrConfronti;

        function matchFilter(m) {
          if (!m) return false;
          if (idComp !== 0 && m.Competizione !== idComp) return false;
          if (idFsq !== 0 && m.IDASquadraCasa !== idFsq && m.IDASquadraFuori !== idFsq) return false;

          // Escludi partite con tempi supplementari o rigori per i record dei tempi regolamentari (001 e 002)
          if (['001', '002'].includes(tipo)) {
            const hasExtraOrPenalties = (m.TipoRis && m.TipoRis !== 0) ||
              (m.GolSupplCasa && m.GolSupplCasa > 0) ||
              (m.GolSupplFuori && m.GolSupplFuori > 0) ||
              (m.GolRigoriCasa && m.GolRigoriCasa > 0) ||
              (m.GolRigoriFuori && m.GolRigoriFuori > 0);
            if (hasExtraOrPenalties) return false;
          }

          if (stadio === 'N' && m.Neutro !== 'N') return false;
          if (stadio === 'C') {
            if (idFsq === 0) {
              if (m.GolRegoCasa < m.GolRegoFuori) return false;
            } else {
              if (m.IDASquadraCasa !== idFsq) return false;
            }
          }
          if (stadio === 'F') {
            if (idFsq === 0) {
              if (m.GolRegoFuori < m.GolRegoCasa) return false;
            } else {
              if (m.IDASquadraFuori !== idFsq) return false;
            }
          }
          return true;
        }

        // Partite per punteggio (001, 002, 013, 014)
        if (['001', '002', '013', '014'].includes(tipo)) {
          const list = [];
          for (let i = 1; i < arr.length; i++) {
            const m = arr[i];
            if (!matchFilter(m)) continue;

            let scoreVal = 0;
            let displayScore = '';

            if (tipo === '001') {
              scoreVal = m.GolRegoCasa + m.GolRegoFuori;
              displayScore = `${m.GolRegoCasa} - ${m.GolRegoFuori}`;
            } else if (tipo === '002') {
              scoreVal = Math.abs(m.GolRegoCasa - m.GolRegoFuori);
              displayScore = `${m.GolRegoCasa} - ${m.GolRegoFuori}`;
            } else if (tipo === '013') {
              if (idFsq !== 0) {
                scoreVal = m.IDASquadraCasa === idFsq ? m.PuntiCasa : m.PuntiFuori;
              } else {
                scoreVal = Math.max(m.PuntiCasa, m.PuntiFuori);
              }
              displayScore = `${m.PuntiCasa} - ${m.PuntiFuori}`;
            } else if (tipo === '014') {
              if (idFsq !== 0) {
                scoreVal = m.IDASquadraCasa === idFsq ? m.PuntiCasa : m.PuntiFuori;
              } else {
                scoreVal = Math.min(m.PuntiCasa, m.PuntiFuori);
              }
              displayScore = `${m.PuntiCasa} - ${m.PuntiFuori}`;
            }

            list.push({
              homeTeam: m.SquadraCasa,
              homeId: m.IDASquadraCasa,
              awayTeam: m.SquadraFuori,
              awayId: m.IDASquadraFuori,
              scoreVal,
              displayScore,
              season: m.Stagione,
              compId: m.Competizione,
              compName: compMap.get(m.Competizione) || `Comp ${m.Competizione}`,
              matchday: m.GiornataA,
              date: formatDate(m.Data),
              rawDate: m.Data
            });
          }

          if (tipo === '014') {
            list.sort((a, b) => a.scoreVal - b.scoreVal);
          } else {
            list.sort((a, b) => b.scoreVal - a.scoreVal);
          }

          const out = [];
          for (let i = 0; i < list.length; i++) {
            out.push(list[i]);
            if (out.length >= limit) {
              if (continuaSePari === 'N') break;
              if (i < list.length - 1 && list[i].scoreVal !== list[i + 1].scoreVal) break;
            }
          }
          return { isStreak: false, results: out };
        }

        // Serie storiche (003 - 012)
        const isSeasonal = ['004', '006', '008', '010', '012'].includes(tipo);
        const activeSeries = new Map();
        const completedSeries = [];
        let lastSeason = null;

        function closeSeries(tId) {
          if (activeSeries.has(tId)) {
            const s = activeSeries.get(tId);
            s.chiusa = true;
            if (s.totale > 0) completedSeries.push(s);
            activeSeries.delete(tId);
          }
        }

        for (let i = 1; i < arr.length; i++) {
          const m = arr[i];
          if (!m) continue;
          if (idComp !== 0 && m.Competizione !== idComp) continue;
          if (stadio === 'N' && m.Neutro !== 'N') continue;

          const canHome = (stadio === 'T' || stadio === 'C') && (idFsq === 0 || idFsq === m.IDASquadraCasa);
          const canAway = (stadio === 'T' || stadio === 'F') && (idFsq === 0 || idFsq === m.IDASquadraFuori);
          if (!canHome && !canAway) continue;

          if (isSeasonal && lastSeason !== null && lastSeason !== m.Stagione) {
            for (const tId of Array.from(activeSeries.keys())) {
              closeSeries(tId);
            }
          }
          lastSeason = m.Stagione;

          const res = m.GolCasa > m.GolFuori ? 'H' : (m.GolCasa < m.GolFuori ? 'A' : 'D');

          // Squadra casa
          if (canHome) {
            const hId = m.IDASquadraCasa;
            const hName = teamsMap.get(hId)?.name || m.SquadraCasa;
            let inc = false;
            let parz = 0;

            if (['003', '004'].includes(tipo)) {
              if (res === 'H') { inc = true; parz = 1; }
              else if (res === 'D') { inc = true; parz = 2; }
            } else if (['005', '006'].includes(tipo)) {
              if (res === 'A') { inc = true; parz = 1; }
              else if (res === 'D') { inc = true; parz = 2; }
            } else if (['007', '008'].includes(tipo)) {
              if (res === 'H') { inc = true; parz = 1; }
            } else if (['009', '010'].includes(tipo)) {
              if (res === 'D') { inc = true; parz = 2; }
            } else if (['011', '012'].includes(tipo)) {
              if (res === 'A') { inc = true; parz = 1; }
            }

            if (inc) {
              if (!activeSeries.has(hId)) {
                activeSeries.set(hId, {
                  teamId: hId,
                  teamName: hName,
                  totale: 0,
                  parziale1: 0,
                  parziale2: 0,
                  stagioneI: m.Stagione,
                  giornataI: m.GiornataA,
                  dataI: formatDate(m.Data),
                  stagioneF: m.Stagione,
                  giornataF: m.GiornataA,
                  dataF: formatDate(m.Data),
                  chiusa: false
                });
              }
              const s = activeSeries.get(hId);
              s.totale++;
              if (parz === 1) s.parziale1++;
              if (parz === 2) s.parziale2++;
              s.stagioneF = m.Stagione;
              s.giornataF = m.GiornataA;
              s.dataF = formatDate(m.Data);
            } else {
              closeSeries(hId);
            }
          }

          // Squadra trasferta
          if (canAway) {
            const aId = m.IDASquadraFuori;
            const aName = teamsMap.get(aId)?.name || m.SquadraFuori;
            let inc = false;
            let parz = 0;

            if (['003', '004'].includes(tipo)) {
              if (res === 'A') { inc = true; parz = 1; }
              else if (res === 'D') { inc = true; parz = 2; }
            } else if (['005', '006'].includes(tipo)) {
              if (res === 'H') { inc = true; parz = 1; }
              else if (res === 'D') { inc = true; parz = 2; }
            } else if (['007', '008'].includes(tipo)) {
              if (res === 'A') { inc = true; parz = 1; }
            } else if (['009', '010'].includes(tipo)) {
              if (res === 'D') { inc = true; parz = 2; }
            } else if (['011', '012'].includes(tipo)) {
              if (res === 'H') { inc = true; parz = 1; }
            }

            if (inc) {
              if (!activeSeries.has(aId)) {
                activeSeries.set(aId, {
                  teamId: aId,
                  teamName: aName,
                  totale: 0,
                  parziale1: 0,
                  parziale2: 0,
                  stagioneI: m.Stagione,
                  giornataI: m.GiornataA,
                  dataI: formatDate(m.Data),
                  stagioneF: m.Stagione,
                  giornataF: m.GiornataA,
                  dataF: formatDate(m.Data),
                  chiusa: false
                });
              }
              const s = activeSeries.get(aId);
              s.totale++;
              if (parz === 1) s.parziale1++;
              if (parz === 2) s.parziale2++;
              s.stagioneF = m.Stagione;
              s.giornataF = m.GiornataA;
              s.dataF = formatDate(m.Data);
            } else {
              closeSeries(aId);
            }
          }
        }

        for (const s of activeSeries.values()) {
          if (s.totale > 0) completedSeries.push(s);
        }

        completedSeries.sort((a, b) => (b.totale - a.totale) || (b.parziale1 - a.parziale1) || (b.stagioneF - a.stagioneF));

        const out = [];
        for (let i = 0; i < completedSeries.length; i++) {
          out.push(completedSeries[i]);
          if (out.length >= limit) {
            if (continuaSePari === 'N') break;
            if (i < completedSeries.length - 1 && completedSeries[i].totale !== completedSeries[i + 1].totale) break;
          }
        }
        return { isStreak: true, results: out };
      },

      getHeadToHead: (teamIdA, teamIdB, compId = 0) => {
        const idA = parseInt(teamIdA, 10);
        const idB = parseInt(teamIdB, 10);
        const comp = parseInt(compId, 10);

        const matches = [];
        let winsA = 0, draws = 0, winsB = 0;
        let goalsA = 0, goalsB = 0;
        let pointsA = 0, pointsB = 0;

        for (let i = 1; i < arrConfronti.length; i++) {
          const m = arrConfronti[i];
          if (!m) continue;

          const isMatch = (m.IDASquadraCasa === idA && m.IDASquadraFuori === idB) ||
            (m.IDASquadraCasa === idB && m.IDASquadraFuori === idA);
          if (!isMatch) continue;

          if (comp !== 0 && m.Competizione !== comp) continue;

          const isACasa = m.IDASquadraCasa === idA;
          const gA = isACasa ? m.GolCasa : m.GolFuori;
          const gB = isACasa ? m.GolFuori : m.GolCasa;
          const pA = isACasa ? m.PuntiCasa : m.PuntiFuori;
          const pB = isACasa ? m.PuntiFuori : m.PuntiCasa;

          goalsA += gA;
          goalsB += gB;
          pointsA += pA;
          pointsB += pB;

          if (gA > gB) winsA++;
          else if (gA < gB) winsB++;
          else draws++;

          // Competizione label (dinamica da compMap / arrCompetizioni)
          const compLabel = compMap.get(m.Competizione) || `Competizione ${m.Competizione}`;

          matches.push({
            season: m.Stagione,
            competition: m.Competizione,
            compLabel,
            matchday: m.GiornataA,
            date: formatDate(m.Data),
            rawDate: m.Data,
            homeTeam: m.SquadraCasa,
            awayTeam: m.SquadraFuori,
            homeId: m.IDASquadraCasa,
            awayId: m.IDASquadraFuori,
            homeScore: m.GolCasa,
            awayScore: m.GolFuori,
            homePoints: m.PuntiCasa,
            awayPoints: m.PuntiFuori,
            isACasa
          });
        }

        // Sort matches descending by season, then matchday
        matches.sort((a, b) => {
          if (b.season !== a.season) return b.season - a.season;
          return b.matchday - a.matchday;
        });

        return {
          matchesCount: matches.length,
          winsA,
          draws,
          winsB,
          goalsA,
          goalsB,
          pointsA: parseFloat(pointsA.toFixed(1)),
          pointsB: parseFloat(pointsB.toFixed(1)),
          matches
        };
      }
    };

    this._cachedConfronti = retObj;
    return retObj;
    })().finally(() => {
      this._confrontiPromise = null;
    });

    return this._confrontiPromise;
  },

  /**
   * Load and calculate Squadre Età & Anagrafica
   * Queries SQLite database via inc/api_storico.php (squadre_rose action).
   * Supports both active season and historical archive with zero redundant JSON.
   */
  async loadSquadreEta(seasonId = null) {
    if (typeof stagione === 'undefined') {
      try {
        await this.loadScript('js/fcmLegaDati.js');
      } catch (e) { }
    }
    const currentSeasonNum = (typeof stagione !== 'undefined') ? parseInt(stagione, 10) : 14;
    const targetSeasonId = (seasonId !== null && seasonId !== undefined) ? parseInt(seasonId, 10) : currentSeasonNum;
    const isCurrentSeason = (targetSeasonId === currentSeasonNum);

    let refDate = new Date();
    let seasonLabel = '';
    let squadsSource = [];
    let rosterPlayers = [];

    try {
      let apiData = await this.fetchJson(`sqlite/stagione_${targetSeasonId}/rose.json`);
      if (!apiData) {
        apiData = await this.fetchJson(`inc/api_storico.php?action=squadre_rose&stagione=${targetSeasonId}`);
      }
      if (apiData && apiData.squadre && Array.isArray(apiData.calciatori)) {
        squadsSource = apiData.squadre;
        rosterPlayers = apiData.calciatori;
        const year = (apiData.info && apiData.info.anno) ? parseInt(apiData.info.anno, 10) : (2012 + targetSeasonId);
        refDate = isCurrentSeason ? new Date() : new Date(year, 11, 31);
        seasonLabel = (apiData.info && apiData.info.anni_stagione) ? apiData.info.anni_stagione : `${year}/${year + 1}`;
      }
    } catch (err) {
      console.error(`Errore caricamento dati SQLite stagione ${targetSeasonId}`, err);
    }

    if (squadsSource.length === 0) return [];

    const squads = [];
    for (const sq of squadsSource) {
      // rose.json contiene anche i ceduti (venduto=1): l'età rose considera solo la rosa attiva.
      // Number(): i rose.json generati con PHP < 8.1 hanno i numeri come stringhe ("1")
      const teamPlayers = rosterPlayers.filter(p => Number(p.teamId) === Number(sq.id) && !Number(p.venduto));
      const players = [];

      for (const raw of teamPlayers) {
        const item = { ...raw, role: Number(raw.role), height: Number(raw.height), weight: Number(raw.weight) };
        const birthDateRaw = item.birthDateRaw || null;
        const age = birthDateRaw ? this.calcAge(birthDateRaw, refDate) : null;
        const ageExact = birthDateRaw ? this.calcExactAge(birthDateRaw, refDate) : null;
        const code = item.code || null;
        const photoUrl = this.getPlayerPhoto(item.name, code);
        // serieATeam può elencare tutti i club della stagione ("Milan, Genoa"): si mostra l'ultimo
        const serieATeam = String(item.serieATeam || '').split(',').pop().trim();
        const serieALogo = this.getSerieALogo(serieATeam);
        const linkHref = code ? `#schede_giocatori?cod=${code}` : `#schede_giocatori?name=${encodeURIComponent(item.name)}`;

        players.push({
          name: item.name,
          code,
          photoUrl,
          serieALogo,
          linkHref,
          role: item.role,
          roleShort: this.getRoleShort(item.role),
          roleName: this.getRoleName(item.role),
          roleClass: this.getRoleClass(item.role),
          serieATeam,
          birthPlace: (item.birthPlace && item.birthPlace !== '-') ? item.birthPlace : 'N.D.',
          birthDate: birthDateRaw ? this.formatBirthDate(birthDateRaw) : 'N.D.',
          age,
          ageExact,
          height: (item.height && item.height > 0) ? item.height : null,
          weight: (item.weight && item.weight > 0) ? item.weight : null
        });
      }

      // Sort players by role (P -> D -> C -> A), then name
      players.sort((a, b) => {
        if (a.role !== b.role) return a.role - b.role;
        return a.name.localeCompare(b.name);
      });

      const validAges = players.map(p => p.age).filter(a => a !== null);
      const avgAge = validAges.length ? (validAges.reduce((sum, val) => sum + val, 0) / validAges.length).toFixed(1) : '-';

      const validHeights = players.filter(p => typeof p.height === 'number' && p.height > 0);
      const avgHeight = validHeights.length ? Math.round(validHeights.reduce((sum, p) => sum + p.height, 0) / validHeights.length) : '-';

      const validWeights = players.filter(p => typeof p.weight === 'number' && p.weight > 0);
      const avgWeight = validWeights.length ? Math.round(validWeights.reduce((sum, p) => sum + p.weight, 0) / validWeights.length) : '-';

      // Youngest & Oldest (exact by birth date timestamp)
      let youngest = null, oldest = null;
      for (const p of players) {
        if (!p.ageExact || !p.ageExact.birthDateObj) continue;
        const time = p.ageExact.birthDateObj.getTime();
        if (!youngest || time > youngest.ageExact.birthDateObj.getTime()) {
          youngest = p;
        }
        if (!oldest || time < oldest.ageExact.birthDateObj.getTime()) {
          oldest = p;
        }
      }

      // Tallest & Shortest
      let tallest = null, shortest = null;
      let tallestList = [], shortestList = [];
      let maxHeight = null, minHeight = null;
      let tallestText = '-', shortestText = '-';

      if (validHeights.length > 0) {
        maxHeight = Math.max(...validHeights.map(p => p.height));
        minHeight = Math.min(...validHeights.map(p => p.height));
        tallestList = validHeights.filter(p => p.height === maxHeight);
        shortestList = validHeights.filter(p => p.height === minHeight);
        tallest = tallestList[0];
        shortest = shortestList[0];
        tallestText = `${tallestList.map(p => p.name).join(', ')} (${maxHeight} cm)`;
        shortestText = `${shortestList.map(p => p.name).join(', ')} (${minHeight} cm)`;
      }

      // Birth Year Distribution
      const yearMap = new Map();
      for (const p of players) {
        if (p.ageExact && p.ageExact.year) {
          const y = p.ageExact.year;
          if (!yearMap.has(y)) yearMap.set(y, []);
          yearMap.get(y).push(p);
        }
      }
      const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
      const birthYearDistribution = sortedYears.map(year => ({
        year,
        count: yearMap.get(year).length,
        players: yearMap.get(year)
      }));

      squads.push({
        teamId: sq.id,
        teamName: sq.nome,
        coach: sq.presidente,
        avgAge,
        avgHeight,
        avgWeight,
        youngest,
        oldest,
        tallest,
        shortest,
        tallestList,
        shortestList,
        tallestText,
        shortestText,
        maxHeight,
        minHeight,
        birthYearDistribution,
        playersCount: players.length,
        players,
        isCurrentSeason,
        seasonId: targetSeasonId,
        refDate,
        seasonLabel
      });
    }

    return squads;
  },

  // Cache for resolved season result page (e.g. 1 => "Stagione_1/ris.php") and roster page
  _seasonResultPageCache: new Map(),
  _seasonRosterPageCache: new Map(),

  /**
   * Return match link info: { url, isSpa }
   * All matches now route internally to ModernFCM SPA #risultati
   */
  getMatchLink(m) {
    const currentSeason = this.getCurrentSeason();
    const matchSeason = Number(m.season || m.Stagione || currentSeason);
    const mDay = Number(m.matchday || m.GiornataA || 1);
    const mId = m.matchId || m.id || '';

    if (matchSeason === currentSeason) {
      return {
        url: `#risultati?day=${mDay}${mId ? '&match=' + mId : ''}`,
        isSpa: true
      };
    }
    return {
      url: `#risultati?season=${matchSeason}&day=${mDay}${mId ? '&match=' + mId : ''}`,
      isSpa: true
    };
  },

  /**
   * Return roster link info: { url, isSpa }
   * All rosters now route internally to ModernFCM SPA #rose
   */
  getSeasonRosterLink(seasonNum, teamId) {
    const s = Number(seasonNum);
    const currentSeason = this.getCurrentSeason();

    if (s === currentSeason) {
      return {
        url: `#rose?team=${teamId}`,
        isSpa: true
      };
    }
    return {
      url: `#rose?season=${s}&team=${teamId}`,
      isSpa: true
    };
  },

  /**
   * Resolves links for an array of matches (populates m.matchUrl and m.isSpa)
   */
  async resolveMatchesLinks(matches) {
    if (!matches || !Array.isArray(matches) || matches.length === 0) return matches;
    for (const m of matches) {
      const linkInfo = this.getMatchLink(m);
      m.matchUrl = linkInfo.url;
      m.isSpa = linkInfo.isSpa;
    }
    return matches;
  },

  /**
   * Carica risultati e tabellini di una giornata di una stagione passata da SQLite
   */
  async loadHistoricalMatchdayResults(season, day) {
    const s = Number(season);
    const d = Number(day);
    let data = await this.fetchJson(`sqlite/stagione_${s}/risultati_${d}.json`);
    if (!data) {
      data = await this.fetchJson(`inc/api_storico.php?action=risultati_giornata&stagione=${s}&giornata=${d}`);
    }
    return data;
  },

  /**
   * Carica la rosa storica completa di una stagione passata da SQLite
   */
  async loadHistoricalRoster(season, teamId = null) {
    const s = Number(season);
    let data = await this.fetchJson(`sqlite/stagione_${s}/rose.json`);
    if (!data) {
      data = await this.fetchJson(`inc/api_storico.php?action=squadre_rose&stagione=${s}`);
    }
    return data;
  },

  /**
   * Carica la classifica storica completa di una stagione passata da SQLite
   */
  async loadHistoricalStandings(season) {
    const s = Number(season);
    let data = await this.fetchJson(`sqlite/stagione_${s}/classifica.json`);
    if (!data) {
      data = await this.fetchJson(`inc/api_storico.php?action=classifica_stagione&season=${s}`);
    }
    if (data && Array.isArray(data.competitions)) {
      data.competitions.forEach(c => {
        if (Array.isArray(c.groups)) {
          c.groups.forEach(g => {
            if (Array.isArray(g.standings)) {
              g.standings.forEach(st => {
                // Calcolo matematico rigoroso Media Inglese (Casa: V 0, N -2, P -3 | Trasferta: V +2, N 0, P -1)
                if (st.winsAway !== undefined && st.winsHome !== undefined) {
                  const wa = Number(st.winsAway) || 0;
                  const la = Number(st.lossesAway) || 0;
                  const dh = Number(st.drawsHome) || 0;
                  const lh = Number(st.lossesHome) || 0;
                  st.mediaInglese = (wa * 2) - la - (dh * 2) - (lh * 3);
                }
                // Allineamento alias per statistiche avanzate
                if (st.devStdTotali !== undefined && st.devStd === undefined) st.devStd = st.devStdTotali;
                if (st.devStd !== undefined && st.devStdTotali === undefined) st.devStdTotali = st.devStd;
                if (st.mediaAvversariTotali !== undefined && st.mediaAvversari === undefined) st.mediaAvversari = st.mediaAvversariTotali;
                if (st.mediaAvversari !== undefined && st.mediaAvversariTotali === undefined) st.mediaAvversariTotali = st.mediaAvversari;
                if (st.devStdTotali === undefined) st.devStdTotali = 0;
                if (st.devStdParziali === undefined) st.devStdParziali = 0;
                if (st.mediaAvversariTotali === undefined) st.mediaAvversariTotali = 0;
                if (st.mediaAvversariParziali === undefined) st.mediaAvversariParziali = 0;
              });
            }
          });
        }
      });
    }
    return data;
  },

  /**
   * Carica il calendario storico completo di una stagione passata da SQLite
   */
  async loadHistoricalCalendar(season) {
    const s = Number(season);
    if (!s || isNaN(s) || s <= 0) return null;
    let data = await this.fetchJson(`sqlite/stagione_${s}/calendario.json`);
    if (!data) {
      data = await this.fetchJson(`inc/api_storico.php?action=calendario_stagione&season=${s}`);
    }
    return data;
  },

  /**
   * Carica la classifica perpetua all-time della lega da SQLite
   */
  async loadClassificaPerpetua() {
    let data = await this.fetchJson('sqlite/classifica_perpetua.json');
    if (!data) {
      data = await this.fetchJson('inc/api_storico.php?action=classifica_perpetua');
    }
    return data;
  },

  /**
   * Generates the head-to-head balance for the upcoming round (Bilancio Prossimo Turno),
   * based on the exact logic of legacy GeneraBilancioPT().
   * @param {number} targetDay - Serie A matchday to analyze
   * @returns {Promise<Array>} Array of match balance objects
   */
  async loadBilancioProssimoTurno(targetDay) {
    if (typeof arrCompetizioni === 'undefined') {
      try { await this.loadScript('js/fcmCompetizioniDati.js'); } catch (e) { }
    }
    if (typeof arrAdOFantasquadre === 'undefined') {
      try { await this.loadScript('js/fcmAlboDOroDati.js'); } catch (e) { }
    }
    if (typeof arrConfronti === 'undefined') {
      try { await this.loadConfronti(); } catch (e) { }
    }
    if (typeof arrIncontri === 'undefined') {
      try { await this.loadScript('js/fcmCalendarioDati.js'); } catch (e) { }
    }

    if (typeof arrConfronti === 'undefined' || typeof arrAdOFantasquadre === 'undefined') {
      return [];
    }

    const calendar = this.getCalendarData();
    const day = parseInt(targetDay, 10) || calendar.nextMatchday || 1;

    let dayMatches = [];
    if (typeof arrIncontri !== 'undefined') {
      for (let i = 1; i < arrIncontri.length; i++) {
        const inc = arrIncontri[i];
        if (inc && parseInt(inc.GiornataDiA, 10) === day && inc.IDTipo !== INC_RIPOSO && inc.IDSquadre && inc.IDSquadre.Casa > 0 && inc.IDSquadre.Fuori > 0) {
          dayMatches.push(inc);
        }
      }
    }

    if (dayMatches.length === 0 && calendar.matches) {
      dayMatches = calendar.matches.filter(m => m.serieADay === day && !m.isRiposo && m.homeTeamId > 0 && m.awayTeamId > 0);
    }

    const arrF = typeof arrAdOFantasquadre !== 'undefined' ? arrAdOFantasquadre : [];
    const arrC = typeof arrAdOCompetizioni !== 'undefined' ? arrAdOCompetizioni : [];

    const bilancio = [];

    for (let i = 0; i < dayMatches.length; i++) {
      const match = dayMatches[i];
      const matchCompId = match.IDCompetizione !== undefined ? match.IDCompetizione : match.compId;
      const matchHomeId = match.IDSquadre ? match.IDSquadre.Casa : match.homeTeamId;
      const matchAwayId = match.IDSquadre ? match.IDSquadre.Fuori : match.awayTeamId;
      const matchHomeName = match.Nomi ? match.Nomi.Casa : match.homeTeamName;
      const matchAwayName = match.Nomi ? match.Nomi.Fuori : match.awayTeamName;
      const matchCompName = match.Competizione !== undefined ? match.Competizione : match.compName;
      const matchType = match.IDTipo !== undefined ? match.IDTipo : match.type;
      const matchGroupId = match.IDGirone !== undefined ? match.IDGirone : (match.groupId || 0);
      const matchGroupName = match.Girone !== undefined ? match.Girone : (match.groupName || '');
      const matchFantaNome = match.Fantagiornata !== undefined ? match.Fantagiornata : (match.fantagiornataNome || '');

      let competizione = 0;
      let TipoIncontro = " ";
      let IDSqA = 0;
      let IDSqB = 0;

      if (matchType == 7 || matchType == 4) {
        TipoIncontro = "N";
      }

      for (let x = 1; x < arrC.length; x++) {
        if (arrC[x] && arrC[x].idAttuale == matchCompId) {
          competizione = arrC[x].IDc;
          break;
        }
      }

      for (let x = 1; x < arrF.length; x++) {
        if (arrF[x] && arrF[x].idAttuale == matchHomeId) {
          IDSqA = arrF[x].IDf;
        }
        if (arrF[x] && arrF[x].idAttuale == matchAwayId) {
          IDSqB = arrF[x].IDf;
        }
      }

      bilancio.push({
        matchId: match.ID || match.id || (i + 1),
        compId: matchCompId,
        competizione,
        nomeCompetizione: matchCompName || '',
        groupId: matchGroupId,
        groupName: matchGroupName,
        fantagiornataNome: matchFantaNome,
        tipoIncontro: TipoIncontro,
        idSquadraA: IDSqA,
        nomeSquadraA: matchHomeName || '',
        currentIdA: matchHomeId,
        idSquadraB: IDSqB,
        nomeSquadraB: matchAwayName || '',
        currentIdB: matchAwayId,
        giocate: 0,
        vinteA: 0,
        nulle: 0,
        vinteB: 0,
        ga: 0,
        gb: 0,
        puntiA: 0,
        puntiB: 0,
        ultimaVittoriaA: " ",
        ultimoPareggio: " ",
        ultimaVittoriaB: " ",
        panchineCompetizioneA: 0,
        panchineCompetizioneB: 0,
        panchineTotaliA: 0,
        panchineTotaliB: 0
      });
    }

    if (typeof arrConfronti !== 'undefined') {
      for (let i = 1; i < arrConfronti.length; i++) {
        const conf = arrConfronti[i];
        if (!conf) continue;
        const z = conf.Competizione;

        for (let x = 0; x < bilancio.length; x++) {
          const b = bilancio[x];

          if (b.idSquadraA === conf.IDASquadraCasa || b.idSquadraA === conf.IDASquadraFuori) {
            b.panchineTotaliA++;
            if (b.competizione === z) {
              b.panchineCompetizioneA++;
            }
          }

          if (b.idSquadraB === conf.IDASquadraCasa || b.idSquadraB === conf.IDASquadraFuori) {
            b.panchineTotaliB++;
            if (b.competizione === z) {
              b.panchineCompetizioneB++;
            }
          }

          if ((b.competizione === z) && (b.tipoIncontro === conf.Neutro)) {
            if (b.idSquadraA === conf.IDASquadraCasa && b.idSquadraB === conf.IDASquadraFuori) {
              if (conf.GolCasa > conf.GolFuori) {
                b.vinteA++;
                b.ultimaVittoriaA = conf.Data;
              } else if (conf.GolCasa < conf.GolFuori) {
                b.vinteB++;
                b.ultimaVittoriaB = conf.Data;
              } else {
                b.nulle++;
                b.ultimoPareggio = conf.Data;
              }
              b.giocate++;
              b.ga += conf.GolCasa;
              b.gb += conf.GolFuori;
              b.puntiA += conf.PuntiCasa;
              b.puntiB += conf.PuntiFuori;
            } else if ((b.tipoIncontro === "N") && (b.idSquadraA === conf.IDASquadraFuori && b.idSquadraB === conf.IDASquadraCasa)) {
              if (conf.GolCasa > conf.GolFuori) {
                b.vinteB++;
                b.ultimaVittoriaB = conf.Data;
              } else if (conf.GolCasa < conf.GolFuori) {
                b.vinteA++;
                b.ultimaVittoriaA = conf.Data;
              } else {
                b.nulle++;
                b.ultimoPareggio = conf.Data;
              }
              b.giocate++;
              b.ga += conf.GolFuori;
              b.gb += conf.GolCasa;
              b.puntiA += conf.PuntiFuori;
              b.puntiB += conf.PuntiCasa;
            }
          }
        }
      }
    }

    return bilancio.map(b => {
      const mediaA = b.giocate > 0 ? (Math.round((b.puntiA / b.giocate) * 1000) / 1000) : 0;
      const mediaB = b.giocate > 0 ? (Math.round((b.puntiB / b.giocate) * 1000) / 1000) : 0;
      return {
        ...b,
        mediaPuntiA: mediaA,
        mediaPuntiB: mediaB,
        formattedUltimaVittoriaA: (b.ultimaVittoriaA && b.ultimaVittoriaA.trim() !== "") ? this.formatItalianDate(b.ultimaVittoriaA) : null,
        formattedUltimoPareggio: (b.ultimoPareggio && b.ultimoPareggio.trim() !== "") ? this.formatItalianDate(b.ultimoPareggio) : null,
        formattedUltimaVittoriaB: (b.ultimaVittoriaB && b.ultimaVittoriaB.trim() !== "") ? this.formatItalianDate(b.ultimaVittoriaB) : null
      };
    });
  },

  /**
   * Standard Italian date formatter: Dom 20 Set 2026
   */
  formatItalianDate(dStr) {
    if (!dStr) return '-';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const DOWArray = ["", "Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const MOYArray = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const dow = DOWArray[d.getDay() + 1] || '';
    const moy = MOYArray[d.getMonth() + 1] || '';
    return `${dow} ${d.getDate()} ${moy} ${d.getFullYear()}`;
  }
};

// Ensure global accessibility across browser and Node
if (typeof window !== 'undefined') {
  window.fcmDataLoader = fcmDataLoader;

  // Modern and backward-compatible global helpers replacing legacy files
  window.GetUltimaGiornataGiocata = function () {
    return fcmDataLoader.getLastPlayedMatchday();
  };
  window.GetProssimaGiornataDaGiocare = function () {
    return fcmDataLoader.getUpcomingMatchday();
  };
  window.GetFormazione = function (mId, tId, lId) {
    return fcmDataLoader.getFormazione(mId, tId, lId);
  };
  window.GetFormazionePrecedente = function (mId, tId, lId) {
    return fcmDataLoader.getFormazionePrecedente(mId, tId, lId);
  };
  window.RiempiListaIncontri = function (g, c) {
    return fcmDataLoader.getRiempiListaIncontri(g, c);
  };
  // Modern and backward-compatible global helpers replacing legacy fcmUtils.js
  window.JSQueryString = function (par) {
    if (!par || typeof window === 'undefined' || !window.location) return '';
    try {
      if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has(par)) {
          return searchParams.get(par) || '';
        }
      }
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.substring(window.location.hash.indexOf('?') + 1);
        const hashParams = new URLSearchParams(hashQuery);
        if (hashParams.has(par)) {
          return hashParams.get(par) || '';
        }
      }
      const match = new RegExp('(?:[?&#]|\\b)' + String(par).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&#]*)', 'i').exec(window.location.href);
      return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
    } catch (e) {
      return '';
    }
  };

  window.Stato = function (msg) {
    try {
      window.status = msg || '';
    } catch (e) { }
  };

  window.invertiDisplayLayer = function (liv) {
    const el = typeof liv === 'string' ? document.getElementById(liv) : liv;
    if (el && el.style) {
      el.style.display = (el.style.display === 'none') ? '' : 'none';
    }
  };
}
if (typeof globalThis !== 'undefined') {
  globalThis.fcmDataLoader = fcmDataLoader;
}



/**
 * SKELETON LOADING HELPER MODULE (fcmSkeleton)
 * Generates semantic, layout-accurate placeholder markup with CSS shimmer
 * to eliminate visual freezes and layout shift across all SPA views.
 */
const fcmSkeleton = {
  /** Basic text line */
  text(widthClass = "w-100", customClass = "") {
    return `<div class="skeleton skeleton-text ${widthClass} ${customClass}"></div>`;
  },

  /** Basic card placeholder */
  card(lines = 3, options = {}) {
    const title = options.title !== false ? `<div class="skeleton skeleton-title ${options.titleWidth || "w-40"}"></div>` : "";
    let rows = "";
    const widths = ["w-100", "w-80", "w-90", "w-60", "w-75"];
    for (let i = 0; i < lines; i++) {
      rows += `<div class="skeleton skeleton-text ${widths[i % widths.length]}"></div>`;
    }
    return `
      <div class="card skeleton-card ${options.className || ""}" style="${options.style || ""}">
        ${title}
        <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
      </div>
    `;
  },

  /** Hero KPI Stats Box (Archivio, Rating, Età Rose) */
  heroKpi(count = 4) {
    let boxes = "";
    for (let i = 0; i < count; i++) {
      boxes += `
        <div class="skeleton-stat-box">
          <div class="skeleton skeleton-title w-40" style="margin-bottom:4px;height:24px;"></div>
          <div class="skeleton skeleton-text w-70" style="margin-bottom:0;height:12px;"></div>
        </div>
      `;
    }
    return `
      <div class="archivio-hero" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:14px;">
        ${boxes}
      </div>
    `;
  },

  /** Standard table skeleton with header and rows */
  table({ cols = 5, rows = 8, withToolbar = true, toolbarPills = 3, title = "" } = {}) {
    let pills = "";
    if (withToolbar) {
      for (let p = 0; p < toolbarPills; p++) {
        pills += `<div class="skeleton skeleton-pill" style="width:${80 + (p * 15)}px;"></div>`;
      }
    }

    let rowItems = "";
    for (let r = 0; r < rows; r++) {
      rowItems += `
        <div class="skeleton-table-row">
          <div style="display:flex;align-items:center;gap:10px;flex:1.5;">
            <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
            <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
          </div>
          <div class="skeleton skeleton-text w-20" style="margin-bottom:0;flex:1;"></div>
          <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
          <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
        </div>
      `;
    }

    return `
      <div class="card" style="padding:18px;">
        ${title ? `<div class="skeleton skeleton-title w-33" style="margin-bottom:16px;"></div>` : ""}
        ${withToolbar ? `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${pills}</div>
            <div class="skeleton skeleton-pill w-25" style="min-width:140px;"></div>
          </div>
        ` : ""}
        <div class="skeleton-table-wrap">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-25" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${rowItems}
        </div>
      </div>
    `;
  },

  /** Grid of cards skeleton (Archivio stagioni, album figurine) */
  grid({ count = 6, cardHeight = "160px" } = {}) {
    let cards = "";
    for (let i = 0; i < count; i++) {
      cards += `
        <div class="skeleton-stat-box" style="min-height:${cardHeight};display:flex;flex-direction:column;justify-content:space-between;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div class="skeleton skeleton-title w-50" style="margin-bottom:0;height:20px;"></div>
            <div class="skeleton skeleton-badge" style="width:40px;"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">
            <div class="skeleton skeleton-text w-80"></div>
            <div class="skeleton skeleton-text w-60"></div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border-subtle);">
            <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
            <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
          </div>
        </div>
      `;
    }
    return `<div class="skeleton-grid-cards">${cards}</div>`;
  },

  /** Schede Giocatori: Lista principale */
  playerList() {
    return `
      <div class="card" style="padding:18px;">
        <!-- Toolbar di Ricerca & Filtri Ruolo -->
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div class="skeleton skeleton-title" style="width:220px;height:24px;margin-bottom:6px;"></div>
              <div class="skeleton skeleton-text" style="width:320px;height:12px;margin-bottom:0;"></div>
            </div>
            <div class="skeleton skeleton-pill" style="width:160px;"></div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;">
            <div class="skeleton skeleton-btn w-100"></div>
            <div class="skeleton skeleton-btn w-100"></div>
            <div class="skeleton skeleton-btn w-100"></div>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <div class="skeleton skeleton-pill" style="width:70px;"></div>
            <div class="skeleton skeleton-pill" style="width:50px;"></div>
            <div class="skeleton skeleton-pill" style="width:50px;"></div>
            <div class="skeleton skeleton-pill" style="width:50px;"></div>
            <div class="skeleton skeleton-pill" style="width:50px;"></div>
          </div>
        </div>

        <!-- Tabella Calciatori Shimmer -->
        <div class="skeleton-table-wrap">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${Array(9).fill(0).map(() => `
            <div class="skeleton-table-row">
              <div style="display:flex;align-items:center;gap:10px;flex:1.5;">
                <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                <div class="skeleton skeleton-badge"></div>
                <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
              </div>
              <div class="skeleton skeleton-text w-20" style="margin-bottom:0;flex:1;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Schede Giocatori: Scheda Dettaglio Profilo Calciatore */
  playerDetail() {
    return `
      <div class="card" style="padding:20px;margin-bottom:20px;">
        <!-- Header Profilo con Foto Circolare -->
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:20px;">
          <div class="skeleton skeleton-circle skeleton-circle-xl"></div>
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div class="skeleton skeleton-badge"></div>
              <div class="skeleton skeleton-title" style="width:260px;height:26px;margin-bottom:0;"></div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div class="skeleton skeleton-pill" style="width:110px;height:26px;"></div>
              <div class="skeleton skeleton-pill" style="width:140px;height:26px;"></div>
              <div class="skeleton skeleton-badge" style="width:60px;"></div>
            </div>
          </div>
          <div class="skeleton skeleton-pill" style="width:120px;height:36px;"></div>
        </div>

        <!-- Subtabs Dettaglio Calciatore -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;">
          <div class="skeleton skeleton-pill" style="width:120px;"></div>
          <div class="skeleton skeleton-pill" style="width:110px;"></div>
          <div class="skeleton skeleton-pill" style="width:130px;"></div>
          <div class="skeleton skeleton-pill" style="width:100px;"></div>
        </div>

        <!-- KPI Statistiche Medie -->
        ${this.heroKpi(4)}

        <!-- Tabella Presenze & Storico -->
        <div class="skeleton-table-wrap" style="margin-top:14px;">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${Array(5).fill(0).map(() => `
            <div class="skeleton-table-row">
              <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Archivio Stagioni: Hero KPI + Toolbar + Grid Cards */
  archivioStagioni() {
    return `
      <div class="archivio-wrap" style="display:flex;flex-direction:column;gap:18px;">
        ${this.heroKpi(4)}
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px;">
          <div class="skeleton skeleton-pill" style="width:140px;"></div>
          <div class="skeleton skeleton-pill" style="width:180px;"></div>
        </div>
        ${this.grid({ count: 6, cardHeight: "180px" })}
      </div>
    `;
  },

  /** Confronti Storici: Selettori contrapposti + Palmares + Bilancio */
  confronti() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Toolbar di Selezione Squadre Contrapposte -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px;">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px;">
            <div class="skeleton skeleton-circle skeleton-circle-md"></div>
            <div class="skeleton skeleton-btn w-75"></div>
          </div>
          <div class="skeleton skeleton-badge" style="width:36px;height:24px;"></div>
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px;justify-content:flex-end;">
            <div class="skeleton skeleton-btn w-75"></div>
            <div class="skeleton skeleton-circle skeleton-circle-md"></div>
          </div>
        </div>

        <!-- Subtabs & Bilancio -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <div class="skeleton skeleton-pill" style="width:130px;"></div>
          <div class="skeleton skeleton-pill" style="width:110px;"></div>
          <div class="skeleton skeleton-pill" style="width:120px;"></div>
        </div>

        ${this.heroKpi(3)}

        <div class="skeleton-table-wrap">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-25" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${Array(6).fill(0).map(() => `
            <div class="skeleton-table-row">
              <div class="skeleton skeleton-text w-25" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Record Storici */
  recordStorici() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="skeleton-toolbar">
          <div class="skeleton skeleton-btn" style="min-width:220px;flex:1;"></div>
          <div class="skeleton skeleton-btn" style="min-width:160px;flex:1;"></div>
          <div class="skeleton skeleton-btn" style="min-width:140px;flex:0.8;"></div>
        </div>
        ${Array(5).fill(0).map(() => `
          <div class="skeleton-stat-box" style="padding:14px 18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div class="skeleton skeleton-title w-40" style="margin-bottom:0;height:18px;"></div>
              <div class="skeleton skeleton-badge" style="width:48px;"></div>
            </div>
            <div class="skeleton skeleton-text w-70" style="margin-bottom:0;"></div>
          </div>
        `).join("")}
      </div>
    `;
  },

  /** FantaMister Storico */
  fantamStorico() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div class="skeleton skeleton-pill" style="width:160px;"></div>
          <div class="skeleton skeleton-pill" style="width:120px;"></div>
        </div>
        <div class="skeleton-table-wrap">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${Array(7).fill(0).map(() => `
            <div class="skeleton-table-row">
              <div style="display:flex;align-items:center;gap:10px;flex:1.5;">
                <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
              </div>
              <div class="skeleton skeleton-text w-20" style="margin-bottom:0;flex:1;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Album Storico */
  album() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="skeleton-toolbar">
          <div class="skeleton skeleton-btn" style="width:200px;"></div>
          <div class="skeleton skeleton-btn" style="width:180px;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:12px;">
          ${Array(12).fill(0).map(() => `
            <div class="skeleton-stat-box" style="align-items:center;text-align:center;padding:14px 10px;">
              <div class="skeleton skeleton-circle skeleton-circle-lg" style="margin-bottom:10px;"></div>
              <div class="skeleton skeleton-text w-80" style="margin-bottom:6px;"></div>
              <div class="skeleton skeleton-text-sm w-50"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Matchday Incontri Storici / Risultati */
  matchday() {
    return `
      <div class="card" style="padding:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
          <div class="skeleton skeleton-title w-33" style="margin-bottom:0;"></div>
          <div class="skeleton skeleton-pill" style="width:140px;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:14px;">
          ${Array(4).fill(0).map(() => `
            <div class="skeleton-stat-box" style="padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;">
                  <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                  <div class="skeleton skeleton-text w-70" style="margin-bottom:0;"></div>
                </div>
                <div class="skeleton skeleton-badge" style="width:30px;"></div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;">
                  <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                  <div class="skeleton skeleton-text w-70" style="margin-bottom:0;"></div>
                </div>
                <div class="skeleton skeleton-badge" style="width:30px;"></div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Dashboard Home */
  dashboard() {
    return `
      <div class="home-dashboard-skeleton" style="display:flex;flex-direction:column;gap:18px;">
        <!-- Hero / Countdown Shimmer -->
        <div class="skeleton-stat-box" style="padding:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
          <div style="flex:1;min-width:220px;">
            <div class="skeleton skeleton-title w-50" style="margin-bottom:8px;"></div>
            <div class="skeleton skeleton-text w-75" style="margin-bottom:0;"></div>
          </div>
          <div style="display:flex;gap:8px;">
            <div class="skeleton skeleton-pill" style="width:110px;"></div>
            <div class="skeleton skeleton-pill" style="width:90px;"></div>
          </div>
        </div>

        <!-- 2-Column Dashboard Cards Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;">
          ${Array(4).fill(0).map(() => `
            <div class="skeleton-card" style="padding:18px;display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div class="skeleton skeleton-title w-40" style="margin-bottom:0;height:20px;"></div>
                <div class="skeleton skeleton-badge" style="width:36px;"></div>
              </div>
              <div class="skeleton skeleton-text w-100"></div>
              <div class="skeleton skeleton-text w-85"></div>
              <div class="skeleton skeleton-text w-60"></div>
              <div style="margin-top:auto;padding-top:12px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
                <div class="skeleton skeleton-pill" style="width:90px;height:26px;"></div>
                <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Formazioni Matchday */
  formation() {
    return `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- Matchday Selector Shimmer -->
        <div class="skeleton-toolbar">
          <div class="skeleton skeleton-pill" style="width:180px;"></div>
          <div class="skeleton skeleton-pill" style="width:140px;"></div>
        </div>

        <!-- 2 Field / Lineup Cards Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:16px;">
          ${Array(2).fill(0).map(() => `
            <div class="skeleton-card" style="padding:18px;display:flex;flex-direction:column;gap:14px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="skeleton skeleton-circle skeleton-circle-md"></div>
                <div style="flex:1;">
                  <div class="skeleton skeleton-title w-60" style="margin-bottom:6px;height:20px;"></div>
                  <div class="skeleton skeleton-text w-35" style="margin-bottom:0;"></div>
                </div>
              </div>
              <div class="skeleton-stat-box" style="height:260px;display:flex;align-items:center;justify-content:center;position:relative;">
                <div class="skeleton skeleton-circle skeleton-circle-lg"></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${Array(5).fill(0).map(() => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <div class="skeleton skeleton-badge"></div>
                    <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
                    <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /** Live Voti / Match Center */
  liveMatchcenter() {
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Live Toolbar & Subtabs -->
        <div class="skeleton-toolbar">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div class="skeleton skeleton-pill" style="width:130px;"></div>
            <div class="skeleton skeleton-pill" style="width:130px;"></div>
            <div class="skeleton skeleton-pill" style="width:120px;"></div>
          </div>
          <div class="skeleton skeleton-badge" style="width:60px;height:28px;"></div>
        </div>

        <!-- Live Scorecards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
          ${Array(2).fill(0).map(() => `
            <div class="skeleton-stat-box" style="padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;">
                  <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                  <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
                </div>
                <div class="skeleton skeleton-badge" style="width:36px;height:24px;"></div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;">
                  <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                  <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
                </div>
                <div class="skeleton skeleton-badge" style="width:36px;height:24px;"></div>
              </div>
            </div>
          `).join("")}
        </div>

        <!-- Live Tables -->
        <div class="skeleton-table-wrap">
          <div class="skeleton-table-head">
            <div class="skeleton skeleton-text w-30" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
            <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
          </div>
          ${Array(8).fill(0).map(() => `
            <div class="skeleton-table-row">
              <div style="display:flex;align-items:center;gap:8px;flex:1.5;">
                <div class="skeleton skeleton-circle skeleton-circle-sm"></div>
                <div class="skeleton skeleton-badge"></div>
                <div class="skeleton skeleton-text w-60" style="margin-bottom:0;"></div>
              </div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
              <div class="skeleton skeleton-text w-15" style="margin-bottom:0;flex:0.8;"></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
};

// Register fcmSkeleton globally on window, globalThis and fcmDataLoader
if (typeof window !== "undefined") {
  window.fcmSkeleton = fcmSkeleton;
}
if (typeof globalThis !== "undefined") {
  globalThis.fcmSkeleton = fcmSkeleton;
}
if (typeof fcmDataLoader !== "undefined") {
  fcmDataLoader.skeleton = fcmSkeleton;
}
