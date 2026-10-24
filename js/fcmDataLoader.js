/**
 * FCM DATA LOADER & MODULAR CONTROLLER
 * Access layer and helper utilities for Fantacalcio Manager data structures.
 * ModernFCM
 */

/**
 * Global Modular Features Controller
 * Controls feature activation based on ModernFCM.ini (injected via fcmVariabili.js)
 */
window.fcmModules = {
  isEnabled(key) {
    if (typeof window[key] === 'undefined') return true; // Default enabled
    const v = String(window[key]).trim().toLowerCase();
    return v === 'si' || v === '1' || v === 'true';
  },
  hasEtaRose() {
    return this.isEnabled('ModEtaRose');
  },
  hasFantamister() {
    return this.isEnabled('ModFantamister');
  },
  hasFantaMassimi() {
    return this.isEnabled('ModFantaMassimi') && this.hasFantamister();
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
    return this.isEnabled('ModLiveFantaMaster') !== false;
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
  isRouteEnabled(route) {
    const cleanRoute = (route || '').replace(/^#/, '').toLowerCase().split('?')[0].split('/')[0];
    switch (cleanRoute) {
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
      case 'fantamassimi':
      case 'fantaclassifica':
        return this.hasFantaMassimi();
      case 'seavessiavuto':
        return this.hasIncroci();
      case 'invform':
      case 'invform_prec':
        return this.hasInvioFormazione();
      case 'records':
        return this.hasRecords();
      case 'live':
        return this.hasliveFP() || this.hasLiveFM() || this.hasLiveVU();
      case 'livefp':
      case 'livefg':
        return this.hasliveFP();
      case 'livefm':
        return this.hasLiveFM();
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
      case 'recordstorici':
      case 'topcosti':
      case 'topcostistagione':
      case 'schedegiocatori':
      case 'schede_giocatori':
      case 'ranking':
      case 'rankingdivisioni':
        return this.hasStoricoAvanzato();
      default:
        return true;
    }
  }
};

const fcmDataLoader = {
  // Cache for dynamically loaded files
  _loadedScripts: new Set(),
  _risultatiCache: {},
  _formazioniCache: {},
  _registriCache: {},
  _colIdxCache: {},
  _queryCache: {},
  _scheduleCache: null,
  _defendingWinnersCache: null,

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

  /**
   * Helper to dynamically inject a script and wait for load
   */
  loadScript(src, forceReload = false, charset = 'ISO-8859-1') {
    if (!forceReload && this._loadedScripts.has(src)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      if (charset) {
        script.charset = charset;
      }
      let finalSrc = src;
      if (forceReload) {
        finalSrc = `${src.split('?')[0]}?t=${Date.now()}`;
      } else if (typeof window !== 'undefined' && window.FCM_VERSION) {
        const sep = src.includes('?') ? '&' : '?';
        finalSrc = `${src}${sep}v=${encodeURIComponent(window.FCM_VERSION)}`;
      }
      script.src = finalSrc;
      script.onload = () => {
        this._loadedScripts.add(src);
        script.onload = null;
        script.onerror = null;
        resolve();
      };
      script.onerror = () => {
        console.warn(`Impossibile caricare script ${finalSrc}`);
        script.onload = null;
        script.onerror = null;
        resolve(); // resolve anyway to avoid hanging UI
      };
      document.head.appendChild(script);
    });
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
      sponsors: [1, 2, 3].map(index => ({
        title: typeof window[`Sponsor${index}Titolo`] !== 'undefined' ? window[`Sponsor${index}Titolo`] : "",
        link: typeof window[`Sponsor${index}Link`] !== 'undefined' ? window[`Sponsor${index}Link`] : "",
        logo: typeof window[`Sponsor${index}Logo`] !== 'undefined' ? window[`Sponsor${index}Logo`] : ""
      })).filter(sponsor => sponsor.title || sponsor.link || sponsor.logo),
      defaultTheme: typeof DefaultTheme !== 'undefined' ? DefaultTheme : 'light',
      news: [
        { date: typeof News1 !== 'undefined' ? News1 : "", text: typeof News2 !== 'undefined' ? News2 : "" },
        { date: typeof News3 !== 'undefined' ? News3 : "", text: typeof News4 !== 'undefined' ? News4 : "" },
        { date: typeof News5 !== 'undefined' ? News5 : "", text: typeof News6 !== 'undefined' ? News6 : "" }
      ].filter(n => n.text)
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
          if (arrAdOFantasquadre[i] && arrAdOFantasquadre[i].Nome && arrAdOFantasquadre[i].Nome.trim().toLowerCase() === trimmed) return true;
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
            teamName = arrAdOFantasquadre[i].Nome;
            break;
          }
        }
      }
    }

    if (!teamName || !this.isRealTeam(teamName)) {
      return 'img/sq/undefined.svg';
    }

    return `img/sq/${encodeURI(teamName)}.png`;
  },

  /**
   * Returns path to Serie A team jersey
   */
  getSerieAShirt(teamName) {
    if (!teamName) return '';
    const cleanTeam = String(teamName).trim();
    if (
      cleanTeam === '{ELIMINATA}' ||
      cleanTeam === '{SERIE ESTERA}' ||
      cleanTeam === '{SERIE MINORE}' ||
      cleanTeam.toUpperCase() === '{ELIMINATA}' ||
      cleanTeam.toUpperCase() === '{SERIE ESTERA}' ||
      cleanTeam.toUpperCase() === '{SERIE MINORE}' ||
      cleanTeam === 'ELIMINATA' ||
      cleanTeam === 'SERIE ESTERA' ||
      cleanTeam === 'SERIE MINORE'
    ) {
      return 'img/sq/undefined.svg';
    }
    return `img/live/sq/${encodeURIComponent(cleanTeam)}.png`;
  },


  /**
   * Helper: Find defending winner for a competition (from LukeskyScudo.js)
   * Resolves the winning team of the previous season (or latest completed season)
   */
  cercaVincitore(competizione) {
    if (typeof arrAdOPosizioni === 'undefined') return null;
    const curStag = this.getCurrentSeason();
    const targetStag = curStag > 1 ? curStag - 1 : 1;

    // 1. Cercare prima nella stagione precedente (stagione - 1) come in LukeskyScudo
    for (let p = 1; p < arrAdOPosizioni.length; p++) {
      const pos = arrAdOPosizioni[p];
      if (pos && pos.stagione === targetStag && pos.idCompetizione == competizione && pos.posizione === 1) {
        return this.cercaSquadraAlboAttuale(pos.idSquadra);
      }
    }

    // 2. Se non presente in targetStag, cercare nell'ultima stagione completata per questa competizione
    const allWinners = [];
    for (let p = 1; p < arrAdOPosizioni.length; p++) {
      const pos = arrAdOPosizioni[p];
      if (pos && pos.idCompetizione == competizione && pos.posizione === 1) {
        allWinners.push(pos);
      }
    }
    if (allWinners.length > 0) {
      allWinners.sort((a, b) => b.stagione - a.stagione);
      return this.cercaSquadraAlboAttuale(allWinners[0].idSquadra);
    }

    return null;
  },

  /**
   * Helper: Resolve actual current team name from Albo team code (from LukeskyScudo.js)
   */
  cercaSquadraAlboAttuale(codice) {
    if (typeof arrAdOFantasquadre === 'undefined') return null;
    for (let s = 1; s < arrAdOFantasquadre.length; s++) {
      const alboTeam = arrAdOFantasquadre[s];
      if (alboTeam && alboTeam.IDf == codice) {
        let name = alboTeam.nome;
        let idAttuale = alboTeam.idAttuale || 0;
        if (idAttuale !== 0) {
          const actualName = this.cercaSquadra(idAttuale);
          if (actualName) name = actualName;
        }
        return { name, idAttuale };
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
        if (typeof arrPalmares === 'undefined') {
          if (typeof window.ZP === 'undefined') {
            window.ZP = function (Competizione, Label, Icona) {
              this.Competizione = Competizione;
              this.Label = Label;
              this.Icona = Icona;
            };
          }
          this.loadScript('persjs/fcmConfrontiDati.js').then(() => {
            this._defendingWinnersCache = null;
          }).catch(() => { });
        }
        if (typeof arrAdOPosizioni === 'undefined') {
          this.loadScript('js/fcmAlboDOroDati.js').then(() => {
            this._defendingWinnersCache = null;
          }).catch(() => { });
        }
        return '';
      }

      this._defendingWinnersCache = [];
      for (let i = 1; i < arrPalmares.length; i++) {
        const pal = arrPalmares[i];
        if (!pal || !pal.Competizione || pal.Competizione === 0) continue;
        const res = this.cercaVincitore(pal.Competizione);
        if (res && res.name) {
          this._defendingWinnersCache.push({
            compId: pal.Competizione,
            label: pal.Label,
            icon: pal.Icona,
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
        const smallIcon = `img/small-${w.icon}`;
        const mainIcon = `img/${w.icon}`;
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
        gId = defComp.groups[0].id;
      } else if (arrClassifica.length > 1 && arrClassifica[1]) {
        gId = arrClassifica[1].IDGirone;
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
   * - liveRoute: rotta per il live (#liveFP se disponibile, altrimenti #liveVU)
   * - isInvformEnabled: true se il modulo Invio Formazione è attivato
   * - isFutureLineupUnlocked: true se è sbloccato l'invio formazione per la giornata successiva (disabilitaGiornata == 0)
   * - nextSubmittableDay: numero della giornata schierabile
   */
  async getMatchdayStatus() {
    const calendar = this.getCalendarData();
    const hasInvform = (typeof fcmModules === 'undefined' || fcmModules.hasInvioFormazione());
    const hasLiveFP = (typeof fcmModules === 'undefined' || fcmModules.hasliveFP());
    const hasLiveFM = (typeof fcmModules === 'undefined' || (fcmModules.hasLiveFM ? fcmModules.hasLiveFM() : true));
    const hasLiveVU = (typeof fcmModules === 'undefined' || fcmModules.hasLiveVU());
    const isLiveEnabled = hasLiveFP || hasLiveFM || hasLiveVU;
    const liveRoute = hasLiveFP ? '#liveFP' : (hasLiveFM ? '#liveFM' : '#liveVU');

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

    // 1. Try PHP endpoint invform/invform.php?azione=ottieneTermine
    try {
      await this.loadScript(`invform/invform.php?azione=ottieneTermine&giornataDiA=${day}&_t=${Date.now()}`);
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
        await this.loadScript(`js/DataA.js?_t=${Date.now()}`);
      } catch (e) {
        try {
          const res = await fetch(`js/DataA.js?_t=${Date.now()}`);
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

  /**
   * Get player photo URL based on arrGiocatoriA
   */
  getPlayerPhoto(playerName) {
    if (!playerName) return 'img/foto/misterx.gif';

    if (!this._photoMapInitialized && typeof arrGiocatoriA !== 'undefined') {
      this._initPhotoMap();
    }

    if (this._photoMap) {
      const cleanTarget = String(playerName).trim().toLowerCase();
      const code = this._photoMap.get(cleanTarget);
      if (code) {
        return `img/foto/${code}.jpg`;
      }
    }

    // Fallback search if map not ready or slightly different naming
    if (typeof arrGiocatoriA !== 'undefined') {
      const cleanTarget = String(playerName).trim().toLowerCase();
      for (let p = 1; p < arrGiocatoriA.length; p++) {
        const g = arrGiocatoriA[p];
        if (!g || !g.Codice) continue;
        const mappedName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : g.Nome;
        if (mappedName && (mappedName.toLowerCase() === cleanTarget || (g.Nome && g.Nome.toLowerCase() === cleanTarget))) {
          if (this._photoMap) this._photoMap.set(cleanTarget, g.Codice);
          return `img/foto/${g.Codice}.jpg`;
        }
      }
    }

    return 'img/foto/misterx.gif';
  },

  _initPhotoMap() {
    this._photoMap = new Map();
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let p = 1; p < arrGiocatoriA.length; p++) {
        const g = arrGiocatoriA[p];
        if (!g || !g.Codice) continue;
        const mappedName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : g.Nome;
        if (mappedName) {
          this._photoMap.set(String(mappedName).trim().toLowerCase(), g.Codice);
        }
        if (g.Nome) {
          this._photoMap.set(String(g.Nome).trim().toLowerCase(), g.Codice);
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

    const cleanTarget = String(playerName).trim().toLowerCase();
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
        this._serieAPlayerMap.set(String(mappedName).trim().toLowerCase(), g);
      }
      if (g.Nome) {
        this._serieAPlayerMap.set(String(g.Nome).trim().toLowerCase(), g);
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
   * Top 11 of the matchday
   */
  getTop11() {
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
   * Load detailed results (tabellini) for a specific matchday (giornata di serie A)
   */
  async loadMatchdayResults(serieADay) {
    const day = parseInt(serieADay);
    if (this._risultatiCache[day]) {
      return this._risultatiCache[day];
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
   * Load query statistic by ID (1 to 45)
   */
  async loadQueryStat(queryId) {
    const qId = parseInt(queryId);
    if (this._queryCache[qId]) {
      return this._queryCache[qId];
    }

    await this.loadScript(`js/fcmQueryQ${qId}.js`, false, 'ISO-8859-1');

    if (typeof arrRisQuery === 'undefined' || arrRisQuery.length === 0) {
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
   * Incrocio calendari
   */
  getIncrociData() {
    if (typeof tableIncroci === 'undefined' || typeof tableIncrociTeams === 'undefined') {
      return { teams: [], matrix: [] };
    }
    const teams = [];
    for (let i = 1; i < tableIncrociTeams.length; i++) {
      if (tableIncrociTeams[i]) teams.push(tableIncrociTeams[i]);
    }

    const matrix = [];
    for (let i = 1; i < tableIncroci.length; i++) {
      if (tableIncroci[i]) {
        const row = [];
        for (let j = 1; j < tableIncroci[i].length; j++) {
          row.push(tableIncroci[i][j]);
        }
        matrix.push(row);
      }
    }
    return { teams, matrix };
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
   * Helper: Calculate age from DD/MM/YYYY
   */
  calcAge(dataStr) {
    if (!dataStr || dataStr.length < 10) return null;
    const parts = dataStr.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    const birth = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const mDiff = now.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  },

  /**
   * Load and compute Ranking Storico
   */
  async loadRanking() {
    await this.loadScript('persjs/fcmRankingDati.js');
    if (typeof arrRanking === 'undefined' || arrRanking.length === 0) {
      return [];
    }

    // Build palmares lookup from Albo d'Oro
    if (typeof arrAdOPosizioni === 'undefined') {
      await this.loadScript('js/fcmAlboDOroDati.js');
    }
    if (typeof arrPalmares === 'undefined') {
      try { await this.loadScript('persjs/fcmConfrontiDati.js'); } catch (e) { }
    }
    const trophiesMap = {};
    if (typeof arrAdOPosizioni !== 'undefined') {
      for (let i = 1; i < arrAdOPosizioni.length; i++) {
        const pos = arrAdOPosizioni[i];
        if (pos && pos.posizione === 1) {
          if (!trophiesMap[pos.idSquadra]) trophiesMap[pos.idSquadra] = {};
          trophiesMap[pos.idSquadra][pos.idCompetizione] = (trophiesMap[pos.idSquadra][pos.idCompetizione] || 0) + 1;
        }
      }
    }

    // Clone raw ranking data
    const rawList = [];
    for (let i = 1; i < arrRanking.length; i++) {
      if (arrRanking[i]) {
        rawList.push({
          idAlbo: arrRanking[i].IdAlbo,
          idAttuale: arrRanking[i].IdAttuale,
          teamName: arrRanking[i].Squadra,
          points: parseFloat(arrRanking[i].Punti) || 0,
          seasons: parseInt(arrRanking[i].Stagioni, 10) || 0,
          prevPoints: parseFloat(arrRanking[i].PuntiPrecedenti) || 0,
          isCurrent: arrRanking[i].IdAttuale !== 0,
          trophies: trophiesMap[arrRanking[i].IdAlbo] || {}
        });
      }
    }

    // Compute previous standings order
    const prevSorted = [...rawList].sort((a, b) => {
      const ptsA = a.isCurrent ? a.prevPoints : a.points;
      const ptsB = b.isCurrent ? b.prevPoints : b.points;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return b.seasons - a.seasons;
    });

    const prevRankMap = new Map();
    prevSorted.forEach((item, idx) => {
      prevRankMap.set(item.idAlbo, idx + 1);
    });

    // Sort current standings
    const sorted = [...rawList].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.seasons - a.seasons;
    });

    return sorted.map((item, idx) => {
      const curPos = idx + 1;
      const prevPos = prevRankMap.get(item.idAlbo) || curPos;
      const delta = prevPos - curPos; // > 0 = climbed (e.g. was 4th now 2nd: 4-2 = +2), < 0 = dropped
      return {
        ...item,
        position: curPos,
        prevPosition: prevPos,
        delta
      };
    });
  },

  /**
   * Check if Ranking Divisioni data exists and is populated
   */
  async hasRankingDivisioni() {
    if (typeof window.RankDivisioni === 'undefined') {
      window.RankDivisioni = function (NomeDivisione, IdAlbo, IdAttuale, Squadra, Punti, Stagioni, PuntiPrecedenti) {
        this.NomeDivisione = NomeDivisione;
        this.IdAlbo = IdAlbo;
        this.IdAttuale = IdAttuale;
        this.Squadra = Squadra;
        this.Punti = Punti;
        this.Stagioni = Stagioni;
        this.PuntiPrecedenti = PuntiPrecedenti;
      };
    }
    await this.loadScript('persjs/fcmRankingDivisioniDati.js');
    return typeof arrRankingDivisioni !== 'undefined' && Array.isArray(arrRankingDivisioni) && arrRankingDivisioni.filter(Boolean).length > 0;
  },

  /**
   * Load and compute Ranking Divisioni
   */
  async loadRankingDivisioni() {
    const hasData = await this.hasRankingDivisioni();
    if (!hasData) return [];

    // Build palmares lookup from Albo d'Oro
    if (typeof arrAdOPosizioni === 'undefined') {
      await this.loadScript('js/fcmAlboDOroDati.js');
    }
    if (typeof arrPalmares === 'undefined') {
      try { await this.loadScript('persjs/fcmConfrontiDati.js'); } catch (e) { }
    }
    const trophiesMap = {};
    if (typeof arrAdOPosizioni !== 'undefined') {
      for (let i = 1; i < arrAdOPosizioni.length; i++) {
        const pos = arrAdOPosizioni[i];
        if (pos && pos.posizione === 1) {
          if (!trophiesMap[pos.idSquadra]) trophiesMap[pos.idSquadra] = {};
          trophiesMap[pos.idSquadra][pos.idCompetizione] = (trophiesMap[pos.idSquadra][pos.idCompetizione] || 0) + 1;
        }
      }
    }

    // Clone and parse raw ranking divisioni data
    const validList = arrRankingDivisioni.filter(Boolean);
    const rawList = validList.map(item => ({
      divisionName: (item.NomeDivisione || 'Generale').replace(/\+/g, ' '),
      idAlbo: item.IdAlbo,
      idAttuale: item.IdAttuale,
      teamName: item.Squadra,
      points: parseFloat(item.Punti) || 0,
      seasons: parseInt(item.Stagioni, 10) || 0,
      prevPoints: parseFloat(item.PuntiPrecedenti) || 0,
      isCurrent: item.IdAttuale !== 0,
      trophies: trophiesMap[item.IdAlbo] || {}
    }));

    // Group items by divisionName
    const grouped = {};
    rawList.forEach(item => {
      if (!grouped[item.divisionName]) grouped[item.divisionName] = [];
      grouped[item.divisionName].push(item);
    });

    // Compute ranking per division
    const result = {};
    for (const [divName, items] of Object.entries(grouped)) {
      const prevSorted = [...items].sort((a, b) => {
        const ptsA = a.isCurrent ? a.prevPoints : a.points;
        const ptsB = b.isCurrent ? b.prevPoints : b.points;
        if (ptsB !== ptsA) return ptsB - ptsA;
        return b.seasons - a.seasons;
      });

      const prevRankMap = new Map();
      prevSorted.forEach((item, idx) => {
        prevRankMap.set(item.idAlbo, idx + 1);
      });

      const sorted = [...items].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.seasons - a.seasons;
      });

      result[divName] = sorted.map((item, idx) => {
        const curPos = idx + 1;
        const prevPos = prevRankMap.get(item.idAlbo) || curPos;
        const delta = prevPos - curPos;
        return {
          ...item,
          position: curPos,
          prevPosition: prevPos,
          delta
        };
      });
    }

    return result;
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
      const found = teams.find(t => t.id === Number(preferredId));
      if (found) return found;
    }

    const getIdAttuale = (t) => {
      if (t.idAttuale !== undefined && t.idAttuale !== null) return Number(t.idAttuale);
      if (t.currentId !== undefined && t.currentId !== null) return Number(t.currentId);
      if (typeof arrAdOFantasquadre !== 'undefined') {
        const ado = arrAdOFantasquadre.find(x => x && x.IDf === t.id);
        if (ado && ado.idAttuale !== undefined) return Number(ado.idAttuale);
      }
      return 0;
    };

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
      if (pId !== exclId) {
        const found = teams.find(t => t.id === pId);
        if (found) return found;
      }
    }

    const getIdAttuale = (t) => {
      if (t.idAttuale !== undefined && t.idAttuale !== null) return Number(t.idAttuale);
      if (t.currentId !== undefined && t.currentId !== null) return Number(t.currentId);
      if (typeof arrAdOFantasquadre !== 'undefined') {
        const ado = arrAdOFantasquadre.find(x => x && x.IDf === t.id);
        if (ado && ado.idAttuale !== undefined) return Number(ado.idAttuale);
      }
      return 0;
    };

    const activeOpponents = teams
      .filter(t => t.id !== exclId)
      .map(t => ({ team: t, idAtt: getIdAttuale(t) }))
      .filter(item => item.idAtt > 0)
      .sort((a, b) => a.idAtt - b.idAtt);

    if (activeOpponents.length > 0) {
      return activeOpponents[0].team;
    }

    return teams.find(t => t.id !== exclId) || teams[0];
  },

  /**
   * Load and query Almanacco Storico
   */
  async loadAlmanacco() {
    if (typeof window.AlPresenze === 'undefined') {
      window.AlPresenze = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Presenze) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Presenze = Presenze;
      };
    }
    if (typeof window.AlCannonieri === 'undefined') {
      window.AlCannonieri = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Gol, Presenze, MediaVoto, FantaMediaVoto) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Gol = Gol; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
      };
    }
    if (typeof window.AlCattivi === 'undefined') {
      window.AlCattivi = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Espulsioni, Ammonizioni, Presenze, MediaVoto, FantaMediaVoto) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
      };
    }
    if (typeof window.AlBestieNere === 'undefined') {
      window.AlBestieNere = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Gol, Presenze, MediaVoto, FantaMediaVoto) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Gol = Gol; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
      };
    }
    if (typeof window.AlTop11 === 'undefined') {
      window.AlTop11 = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, FantaMediaVoto, MediaVoto, Presenze, Gol) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.FantaMediaVoto = FantaMediaVoto; this.MediaVoto = MediaVoto; this.Presenze = Presenze; this.Gol = Gol;
      };
    }
    if (typeof window.AlFlop11 === 'undefined') {
      window.AlFlop11 = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, FantaMediaVoto, MediaVoto, Presenze, Gol) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.FantaMediaVoto = FantaMediaVoto; this.MediaVoto = MediaVoto; this.Presenze = Presenze; this.Gol = Gol;
      };
    }
    if (typeof window.AlTopRating === 'undefined') {
      window.AlTopRating = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Rating, FantaMediaVoto, Costo, Presenze) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Rating = Rating; this.FantaMediaVoto = FantaMediaVoto; this.Costo = Costo; this.Presenze = Presenze;
      };
    }
    if (typeof window.AlFlopRating === 'undefined') {
      window.AlFlopRating = function (IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Rating, FantaMediaVoto, Costo, Presenze) {
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Rating = Rating; this.FantaMediaVoto = FantaMediaVoto; this.Costo = Costo; this.Presenze = Presenze;
      };
    }

    if (typeof arrFantasquadre === 'undefined') {
      await this.loadScript('js/fcmFantasquadreDati.js');
    }
    if (typeof arrAdOFantasquadre === 'undefined') {
      await this.loadScript('js/fcmAlboDOroDati.js');
    }
    await this.loadScript('persjs/fcmAlmanaccoDati.js');
    if (typeof arrAlPresenze === 'undefined') {
      return null;
    }

    // Extract unique teams
    const teamsMap = new Map();
    if (typeof arrAdOFantasquadre !== 'undefined') {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f) {
          let activeName = f.nome;
          if (typeof arrFantasquadre !== 'undefined') {
            const curTeam = arrFantasquadre.find(x => x && x.ID === f.idAttuale);
            if (curTeam && curTeam.Nome) activeName = curTeam.Nome;
          }
          teamsMap.set(f.IDf, { id: f.IDf, name: activeName, idAttuale: f.idAttuale, currentId: f.idAttuale });
        }
      }
    }

    for (let i = 1; i < arrAlPresenze.length; i++) {
      const p = arrAlPresenze[i];
      if (p && !teamsMap.has(p.IDSquadraStorica)) {
        teamsMap.set(p.IDSquadraStorica, { id: p.IDSquadraStorica, name: p.NomeSquadra, idAttuale: 0, currentId: 0 });
      }
    }
    const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      teams,
      getFedelissimi: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        for (let i = 1; i < arrAlPresenze.length; i++) {
          const p = arrAlPresenze[i];
          if (p && (id === 0 || p.IDSquadraStorica === id)) {
            list.push({
              teamId: p.IDSquadraStorica,
              teamName: p.NomeSquadra,
              player: p.NomeGiocatore,
              role: p.Ruolo,
              roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
              appearances: p.Presenze
            });
          }
        }
        return list.sort((a, b) => b.appearances - a.appearances);
      },
      getCannonieri: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        if (typeof arrAlCannonieri !== 'undefined') {
          for (let i = 1; i < arrAlCannonieri.length; i++) {
            const p = arrAlCannonieri[i];
            if (p && (id === 0 || p.IDSquadraStorica === id)) {
              list.push({
                teamId: p.IDSquadraStorica,
                teamName: p.NomeSquadra,
                player: p.NomeGiocatore,
                role: p.Ruolo,
                roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
                goals: p.Gol,
                appearances: p.Presenze,
                mv: p.MediaVoto,
                fmv: p.FantaMediaVoto
              });
            }
          }
        }
        return list.sort((a, b) => b.goals - a.goals);
      },
      getCattivi: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        if (typeof arrAlCattivi !== 'undefined') {
          for (let i = 1; i < arrAlCattivi.length; i++) {
            const p = arrAlCattivi[i];
            if (p && (id === 0 || p.IDSquadraStorica === id)) {
              list.push({
                teamId: p.IDSquadraStorica,
                teamName: p.NomeSquadra,
                player: p.NomeGiocatore,
                role: p.Ruolo,
                roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
                expulsions: p.Espulsioni,
                cautions: p.Ammonizioni,
                appearances: p.Presenze,
                mv: p.MediaVoto,
                fmv: p.FantaMediaVoto
              });
            }
          }
        }
        return list.sort((a, b) => (b.expulsions * 3 + b.cautions) - (a.expulsions * 3 + a.cautions));
      },
      getBestieNere: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        if (typeof arrAlBestieNere !== 'undefined') {
          for (let i = 1; i < arrAlBestieNere.length; i++) {
            const p = arrAlBestieNere[i];
            if (p && (id === 0 || p.IDSquadraStorica === id)) {
              list.push({
                teamId: p.IDSquadraStorica,
                teamName: p.NomeSquadra,
                player: p.NomeGiocatore,
                role: p.Ruolo,
                roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
                goals: p.Gol,
                appearances: p.Presenze,
                mv: p.MediaVoto,
                fmv: p.FantaMediaVoto
              });
            }
          }
        }
        return list.sort((a, b) => b.goals - a.goals);
      },
      getTop11: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        if (typeof arrAlTop11 !== 'undefined') {
          for (let i = 1; i < arrAlTop11.length; i++) {
            const p = arrAlTop11[i];
            if (p && p.IDSquadraStorica === id) {
              list.push({
                player: p.NomeGiocatore,
                role: p.Ruolo,
                fmv: p.FantaMediaVoto,
                mv: p.MediaVoto,
                appearances: p.Presenze,
                goals: p.Gol
              });
            }
          }
        }
        return list;
      },
      getFlop11: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        if (typeof arrAlFlop11 !== 'undefined') {
          for (let i = 1; i < arrAlFlop11.length; i++) {
            const p = arrAlFlop11[i];
            if (p && p.IDSquadraStorica === id) {
              list.push({
                player: p.NomeGiocatore,
                role: p.Ruolo,
                fmv: p.FantaMediaVoto,
                mv: p.MediaVoto,
                appearances: p.Presenze,
                goals: p.Gol
              });
            }
          }
        }
        return list;
      },
      getTopRating: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        const source = (typeof arrAlTopRat !== 'undefined') ? arrAlTopRat : ((typeof arrAlTopRating !== 'undefined') ? arrAlTopRating : []);
        for (let i = 1; i < source.length; i++) {
          const p = source[i];
          if (p && (id === 0 || p.IDSquadraStorica === id)) {
            list.push({
              teamId: p.IDSquadraStorica,
              teamName: p.NomeSquadra,
              player: p.NomeGiocatore,
              role: p.Ruolo,
              roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
              rating: parseFloat(p.Rating) || 0,
              fmv: parseFloat(p.FantaMediaVoto) || 0,
              costo: parseFloat(p.Costo) || 0,
              appearances: parseInt(p.Presenze, 10) || 0
            });
          }
        }
        return list.sort((a, b) => b.rating - a.rating);
      },
      getFlopRating: (teamId) => {
        const id = parseInt(teamId, 10);
        const list = [];
        const source = (typeof arrAlFlopRat !== 'undefined') ? arrAlFlopRat : ((typeof arrAlFlopRating !== 'undefined') ? arrAlFlopRating : []);
        for (let i = 1; i < source.length; i++) {
          const p = source[i];
          if (p && (id === 0 || p.IDSquadraStorica === id)) {
            list.push({
              teamId: p.IDSquadraStorica,
              teamName: p.NomeSquadra,
              player: p.NomeGiocatore,
              role: p.Ruolo,
              roleShort: p.Ruolo ? p.Ruolo.charAt(0) : '-',
              rating: parseFloat(p.Rating) || 0,
              fmv: parseFloat(p.FantaMediaVoto) || 0,
              costo: parseFloat(p.Costo) || 0,
              appearances: parseInt(p.Presenze, 10) || 0
            });
          }
        }
        return list.sort((a, b) => a.rating - b.rating);
      }
    };
  },

  /**
   * Load and query Album Storico Calciatori
   */
  async loadAlbum() {
    if (typeof window.Album === 'undefined') {
      window.Album = function (IDGiocatore, NomeGiocatore, Stagione, AnnoStagione, IDGiocatoreStagione, PrimaGiornataInSquadra, IDSquadra, IDSquadraStorica, NomeSquadra, Ruolo, SquadraA1, SquadraA2, SquadraA3, Presenze, TotVoti, TotFantaVoti, Goal, Espulsioni, Ammonizioni, IDDivisione, NomeDivisione, Costo, AnniContratto) {
        this.IDGiocatore = IDGiocatore; this.NomeGiocatore = NomeGiocatore; this.Stagione = Stagione; this.AnnoStagione = AnnoStagione;
        this.IDGiocatoreStagione = IDGiocatoreStagione; this.PrimaGiornataInSquadra = PrimaGiornataInSquadra; this.IDSquadra = IDSquadra;
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.Ruolo = Ruolo; this.SquadraA1 = SquadraA1;
        this.SquadraA2 = SquadraA2; this.SquadraA3 = SquadraA3; this.Presenze = Presenze; this.TotVoti = TotVoti;
        this.TotFantaVoti = TotFantaVoti; this.Goal = Goal; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni;
        this.IDDivisione = IDDivisione; this.NomeDivisione = NomeDivisione; this.Costo = Costo; this.AnniContratto = AnniContratto;
      };
    }

    if (typeof arrGiocatoriA === 'undefined') {
      await this.loadScript('js/fcmSerieADatiDettaglio.js');
    }
    if (typeof xg10 === 'undefined') {
      await this.loadScript('js/fcmSerieADati.js');
    }
    if (typeof arrFantasquadre === 'undefined') {
      await this.loadScript('js/fcmFantasquadreDati.js');
    }
    if (typeof arrAdOFantasquadre === 'undefined') {
      await this.loadScript('js/fcmAlboDOroDati.js');
    }
    await this.loadScript('persjs/fcmConfrontiDati.js');
    await this.loadScript('persjs/fcmAlbumDati.js');

    // Build teams list from arrAdOFantasquadre or arrFantasquadre
    const teams = [];
    if (typeof arrAdOFantasquadre !== 'undefined') {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f && f.idAttuale !== 0) {
          let activeName = f.nome;
          if (typeof arrFantasquadre !== 'undefined') {
            const curTeam = arrFantasquadre.find(x => x && x.ID === f.idAttuale);
            if (curTeam && curTeam.Nome) activeName = curTeam.Nome;
          }
          teams.push({ id: f.IDf, name: activeName, currentId: f.idAttuale, idAttuale: f.idAttuale });
        }
      }
    } else if (typeof arrFantasquadre !== 'undefined') {
      for (let i = 1; i < arrFantasquadre.length; i++) {
        const f = arrFantasquadre[i];
        if (f) teams.push({ id: f.ID, name: f.Nome, currentId: f.ID, idAttuale: f.ID });
      }
    }
    teams.sort((a, b) => a.name.localeCompare(b.name));

    // Photo lookup map by player name using xg Serie A variables
    const photoMap = new Map();
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let i = 1; i < arrGiocatoriA.length; i++) {
        const g = arrGiocatoriA[i];
        if (g) {
          const pName = window['xg' + g.ID];
          if (pName) {
            photoMap.set(pName.trim().toUpperCase(), g.Codice);
          }
        }
      }
    }

    // Directory lookup from arrDirectory (fcmConfrontiDati.js)
    const curSeason = this.getCurrentSeason();
    const directoryMap = new Map();
    let maxSeasonNum = curSeason;
    if (typeof arrDirectory !== 'undefined') {
      for (let d = 1; d < arrDirectory.length; d++) {
        const dir = arrDirectory[d];
        if (dir) {
          directoryMap.set(dir.Stagione, dir.Directory);
          if (dir.Stagione > maxSeasonNum) maxSeasonNum = dir.Stagione;
        }
      }
    }
    // Pre-resolve roster pages for all past seasons in background
    const pastSeasons = Array.from(directoryMap.keys()).filter(s => s !== curSeason);
    await Promise.all(pastSeasons.map(s => this.resolveSeasonRosterPage(s)));

    return {
      teams,
      getTeamPlayers: (teamId) => {
        const tObj = teams.find(t => t.id === parseInt(teamId, 10)) || teams[0];
        if (!tObj) return [];

        const currentId = tObj.currentId;
        const players = [];

        // Scan current roster (arrRose)
        if (typeof arrRose !== 'undefined') {
          for (let y = 1; y < arrRose.length; y++) {
            const r = arrRose[y];
            if (r && r.IDSquadra === currentId && (r.Stato === 0 || r.Stato === 1 || r.Stato === 2)) {
              const photoCode = photoMap.get((r.Nome || '').trim().toUpperCase()) || '0';

              // Find career entries in arrAlbum
              const career = [];
              if (typeof arrAlbum !== 'undefined') {
                for (let a = 1; a < arrAlbum.length; a++) {
                  const alb = arrAlbum[a];
                  if (alb && (alb.NomeGiocatore === r.Nome || (photoCode !== '0' && (alb.IDGiocatore == photoCode || alb.IDGiocatore == Number(photoCode))))) {
                    const stgNum = parseInt(alb.Stagione, 10) || 0;
                    const isCurrent = stgNum === curSeason;
                    const dirPath = this.getSeasonDirectory(stgNum);
                    const rosterLink = this.getSeasonRosterLink(stgNum, alb.IDSquadra);

                    career.push({
                      season: alb.AnnoStagione,
                      seasonNum: stgNum,
                      teamId: alb.IDSquadra,
                      teamName: alb.NomeSquadra,
                      isCurrent,
                      dirPath,
                      rosterLink,
                      serieA: alb.SquadraA1 + (alb.SquadraA2 ? ` / ${alb.SquadraA2}` : ''),
                      serieATeamPrimary: alb.SquadraA1 || '',
                      appearances: alb.Presenze,
                      totVoti: alb.TotVoti,
                      totFV: alb.TotFantaVoti,
                      mv: alb.Presenze > 0 ? (alb.TotVoti / alb.Presenze).toFixed(2) : '-',
                      fmv: alb.Presenze > 0 ? (alb.TotFantaVoti / alb.Presenze).toFixed(2) : '-',
                      goals: alb.Goal,
                      expulsions: alb.Espulsioni,
                      cautions: alb.Ammonizioni,
                      cost: alb.Costo
                    });
                  }
                }
              }

              // Sort career descending (most recent season at top)
              career.sort((a, b) => b.seasonNum - a.seasonNum);

              // Contract label
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
    if (typeof window.TuttiGiocatori === 'undefined') {
      window.TuttiGiocatori = function (IDGiocatore, NomeGiocatore, Stagione, AnnoStagione, IDGiocatoreStagione, PrimaGiornataInSquadra, IDSquadra, IDSquadraStorica, NomeSquadra, Ruolo, SquadraA1, SquadraA2, SquadraA3, Presenze, TotVoti, TotFantaVoti, Goal, Espulsioni, Ammonizioni, IDDivisione, NomeDivisione, Costo, AnniContratto) {
        this.IDGiocatore = IDGiocatore; this.NomeGiocatore = NomeGiocatore; this.Stagione = Stagione; this.AnnoStagione = AnnoStagione;
        this.IDGiocatoreStagione = IDGiocatoreStagione; this.PrimaGiornataInSquadra = PrimaGiornataInSquadra; this.IDSquadra = IDSquadra;
        this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.Ruolo = Ruolo; this.SquadraA1 = SquadraA1;
        this.SquadraA2 = SquadraA2; this.SquadraA3 = SquadraA3; this.Presenze = Presenze; this.TotVoti = TotVoti; this.TotFantaVoti = TotFantaVoti;
        this.Goal = Goal; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni; this.IDDivisione = IDDivisione;
        this.NomeDivisione = NomeDivisione; this.Costo = Costo; this.AnniContratto = AnniContratto;
      };
    }

    await this.loadScript('persjs/fcmTuttiGiocatoriDati.js');
    if (typeof arrTuttiGiocatori === 'undefined') {
      return null;
    }

    // Current team names lookup from arrAdOFantasquadre
    const currentTeamNames = new Map();
    const teamsList = [];
    if (typeof arrAdOFantasquadre !== 'undefined') {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f) {
          currentTeamNames.set(f.IDf, f.nome);
          if (f.idAttuale !== 0) {
            teamsList.push({ id: f.IDf, name: f.nome, currentId: f.idAttuale, idAttuale: f.idAttuale });
          }
        }
      }
    }
    teamsList.sort((a, b) => a.name.localeCompare(b.name));

    let maxSeason = this.getCurrentSeason();
    for (let i = 1; i < arrTuttiGiocatori.length; i++) {
      const g = arrTuttiGiocatori[i];
      if (g && g.Stagione > maxSeason) maxSeason = g.Stagione;
    }

    return {
      teams: teamsList,
      maxSeason,
      getCurrentTeamName: (id) => currentTeamNames.get(id) || '',
      getTopCosti: (teamId = 0, role = 'ALL', isCurrentSeason = false, limit = 20) => {
        const id = parseInt(teamId, 10);
        let list = [];

        for (let i = 1; i < arrTuttiGiocatori.length; i++) {
          const g = arrTuttiGiocatori[i];
          if (!g) continue;
          if (id !== 0 && g.IDSquadraStorica !== id) continue;
          if (isCurrentSeason && g.Stagione !== maxSeason) continue;
          if (role !== 'ALL' && g.Ruolo !== role) continue;

          const currName = currentTeamNames.get(g.IDSquadraStorica) || g.NomeSquadra;

          list.push({
            id: g.IDGiocatore,
            name: g.NomeGiocatore,
            season: g.AnnoStagione,
            teamId: g.IDSquadraStorica,
            teamName: currName,
            role: g.Ruolo,
            serieA: g.SquadraA1 + (g.SquadraA2 ? ` / ${g.SquadraA2}` : ''),
            cost: parseFloat(g.Costo) || 0,
            appearances: g.Presenze,
            goals: g.Goal,
            mv: g.Presenze > 0 ? (g.TotVoti / g.Presenze).toFixed(2) : '-',
            fmv: g.Presenze > 0 ? (g.TotFantaVoti / g.Presenze).toFixed(2) : '-'
          });
        }

        // Deduplicate records with same player, team, season and cost
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
   * Load and query Confronti Storici (Head-to-head & Palmares)
   */
  async loadConfronti() {
    if (typeof arrCompetizioni === 'undefined') {
      await this.loadScript('js/fcmCompetizioniDati.js');
    }
    if (typeof arrAdOFantasquadre === 'undefined') {
      await this.loadScript('js/fcmAlboDOroDati.js');
    }
    await this.loadScript('persjs/fcmConfrontiDati.js');
    if (typeof arrConfronti === 'undefined') {
      return null;
    }

    // Build teams map from arrAdOFantasquadre or matches
    const teamsMap = new Map();
    if (typeof arrAdOFantasquadre !== 'undefined') {
      for (let i = 1; i < arrAdOFantasquadre.length; i++) {
        const f = arrAdOFantasquadre[i];
        if (f) teamsMap.set(f.IDf, { id: f.IDf, name: f.nome, currentId: f.idAttuale, idAttuale: f.idAttuale });
      }
    }

    // Also parse from arrConfronti if any team is missing
    for (let i = 1; i < arrConfronti.length; i++) {
      const m = arrConfronti[i];
      if (m && !teamsMap.has(m.IDASquadraCasa)) {
        teamsMap.set(m.IDASquadraCasa, { id: m.IDASquadraCasa, name: m.SquadraCasa, currentId: 0, idAttuale: 0 });
      }
      if (m && !teamsMap.has(m.IDASquadraFuori)) {
        teamsMap.set(m.IDASquadraFuori, { id: m.IDASquadraFuori, name: m.SquadraFuori, currentId: 0, idAttuale: 0 });
      }
    }

    const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

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
            if (pal && pal.Competizione && pal.Icona) {
              trophyIcons[pal.Competizione] = pal.Icona;
            }
          }
        }
        if (typeof arrAdOPosizioni !== 'undefined' && typeof arrPalmares !== 'undefined') {
          for (let p = 1; p < arrPalmares.length; p++) {
            const pal = arrPalmares[p];
            if (!pal) continue;
            let count = 0;
            const years = [];
            for (let i = 1; i < arrAdOPosizioni.length; i++) {
              const pos = arrAdOPosizioni[i];
              if (pos && pos.idSquadra === id && pos.posizione === 1 && pos.idCompetizione === pal.Competizione) {
                count++;
                years.push(pos.anno);
              }
            }
            if (count > 0) {
              const compName = compMap.get(pal.Competizione) || pal.Label;
              trophies.push({
                compId: pal.Competizione,
                label: compName,
                icon: pal.Icona || trophyIcons[pal.Competizione] || 'scudo.png',
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

          if (isSeasonal) {
            if (canHome && activeSeries.has(m.IDASquadraCasa)) {
              if (activeSeries.get(m.IDASquadraCasa).stagioneI !== m.Stagione) {
                closeSeries(m.IDASquadraCasa);
              }
            }
            if (canAway && activeSeries.has(m.IDASquadraFuori)) {
              if (activeSeries.get(m.IDASquadraFuori).stagioneI !== m.Stagione) {
                closeSeries(m.IDASquadraFuori);
              }
            }
          }

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

        completedSeries.sort((a, b) => b.totale - a.totale);

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

    return retObj;
  },

  /**
   * Load and calculate Squadre Età & Anagrafica
   */
  async loadSquadreEta() {
    await this.loadScript('js/fcmGiocatoriDati.js');
    if (typeof ArchivioA === 'undefined') {
      return [];
    }

    // Map players in ArchivioA by name
    const archMap = new Map();
    for (let i = 1; i < ArchivioA.length; i++) {
      if (ArchivioA[i]) archMap.set(ArchivioA[i].Nome, ArchivioA[i]);
    }

    const squads = [];
    for (let i = 1; i < arrFantasquadre.length; i++) {
      const sq = arrFantasquadre[i];
      if (!sq) continue;

      const players = [];
      for (let r = 1; r < arrRose.length; r++) {
        const item = arrRose[r];
        if (item && item.IDSquadra === sq.ID && item.Stato === 0) {
          const arch = archMap.get(item.Nome);
          const age = arch ? this.calcAge(arch.DataDiNascita) : null;
          players.push({
            name: item.Nome,
            role: item.Ruolo,
            roleShort: this.getRoleShort(item.Ruolo),
            roleName: this.getRoleName(item.Ruolo),
            roleClass: this.getRoleClass(item.Ruolo),
            serieATeam: item.Squadra,
            birthPlace: arch && arch.LuogoDiNascita !== '-' ? arch.LuogoDiNascita : 'N.D.',
            birthDate: arch ? arch.DataDiNascita : 'N.D.',
            age,
            height: arch && arch.Altezza > 0 ? arch.Altezza : null,
            weight: arch && arch.Peso > 0 ? arch.Peso : null
          });
        }
      }

      // Sort players by role (P -> D -> C -> A), then name
      players.sort((a, b) => {
        if (a.role !== b.role) return a.role - b.role;
        return a.name.localeCompare(b.name);
      });

      const validAges = players.map(p => p.age).filter(a => a !== null);
      const avgAge = validAges.length ? (validAges.reduce((sum, val) => sum + val, 0) / validAges.length).toFixed(1) : '-';

      const validHeights = players.map(p => p.height).filter(h => h !== null);
      const avgHeight = validHeights.length ? Math.round(validHeights.reduce((sum, val) => sum + val, 0) / validHeights.length) : '-';

      const validWeights = players.map(p => p.weight).filter(w => w !== null);
      const avgWeight = validWeights.length ? Math.round(validWeights.reduce((sum, val) => sum + val, 0) / validWeights.length) : '-';

      // Youngest & Oldest
      let youngest = null, oldest = null;
      validAges.forEach((_, idx) => {
        const p = players.filter(pl => pl.age !== null)[idx];
        if (!youngest || p.age < youngest.age) youngest = p;
        if (!oldest || p.age > oldest.age) oldest = p;
      });

      squads.push({
        teamId: sq.ID,
        teamName: sq.Nome,
        coach: sq.Presidente,
        avgAge,
        avgHeight,
        avgWeight,
        youngest,
        oldest,
        playersCount: players.length,
        players
      });
    }

    return squads;
  },

  // Cache for resolved season result page (e.g. 1 => "Stagione_1/ris.php") and roster page
  _seasonResultPageCache: new Map(),
  _seasonRosterPageCache: new Map(),

  /**
   * Check if past season directory has ModernFCM or legacy ris.php / ris.htm
   */
  async resolveSeasonResultPage(seasonNum) {
    const s = Number(seasonNum);
    if (this._seasonResultPageCache.has(s)) {
      return this._seasonResultPageCache.get(s);
    }

    const dir = this.getSeasonDirectory(s);
    if (this.isModernSeason(s)) {
      const page = `${dir}/index.php`;
      this._seasonResultPageCache.set(s, page);
      return page;
    }

    // 1. Check ris.php first
    try {
      const resPhp = await fetch(`${dir}/ris.php`, { method: 'HEAD', cache: 'no-store' });
      if (resPhp.ok) {
        const page = `${dir}/ris.php`;
        this._seasonResultPageCache.set(s, page);
        return page;
      }
    } catch (e) { }

    // 2. In subordine, check ris.htm
    try {
      const resHtm = await fetch(`${dir}/ris.htm`, { method: 'HEAD', cache: 'no-store' });
      if (resHtm.ok) {
        const page = `${dir}/ris.htm`;
        this._seasonResultPageCache.set(s, page);
        return page;
      }
    } catch (e) { }

    // 3. Fallback: default to ris.php
    const fallback = `${dir}/ris.php`;
    this._seasonResultPageCache.set(s, fallback);
    return fallback;
  },

  /**
   * Check if past season directory has ModernFCM or legacy rose.htm / rose.php
   */
  async resolveSeasonRosterPage(seasonNum) {
    const s = Number(seasonNum);
    if (this._seasonRosterPageCache.has(s)) {
      return this._seasonRosterPageCache.get(s);
    }

    const dir = this.getSeasonDirectory(s);
    if (this.isModernSeason(s)) {
      const page = `${dir}/index.php`;
      this._seasonRosterPageCache.set(s, page);
      return page;
    }

    // 1. Check rose.htm first (standard FCM archive file)
    try {
      const resHtm = await fetch(`${dir}/rose.htm`, { method: 'HEAD', cache: 'no-store' });
      if (resHtm.ok) {
        const page = `${dir}/rose.htm`;
        this._seasonRosterPageCache.set(s, page);
        return page;
      }
    } catch (e) { }

    // 2. In subordine, check rose.php
    try {
      const resPhp = await fetch(`${dir}/rose.php`, { method: 'HEAD', cache: 'no-store' });
      if (resPhp.ok) {
        const page = `${dir}/rose.php`;
        this._seasonRosterPageCache.set(s, page);
        return page;
      }
    } catch (e) { }

    // 3. Fallback: default to rose.htm
    const fallback = `${dir}/rose.htm`;
    this._seasonRosterPageCache.set(s, fallback);
    return fallback;
  },

  /**
   * Return match link info: { url, isSpa }
   * For current season: #risultati?day=...&match=...
   * For modern past season: Stagione_X/index.php#risultati?day=...
   * For legacy past seasons: Stagione_X/ris.php?Gio=... or Stagione_X/ris.htm?Gio=...
   */
  getMatchLink(m) {
    const currentSeason = this.getCurrentSeason();
    const matchSeason = Number(m.season);

    if (matchSeason === currentSeason) {
      const cal = this.getCalendarData();
      if (cal && cal.matches && cal.matches.length > 0) {
        const cleanName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const homeClean = cleanName(m.homeTeam);
        const awayClean = cleanName(m.awayTeam);
        const mDay = Number(m.matchday);

        const found = cal.matches.find(inc => {
          if (Number(inc.serieADay) !== mDay) return false;
          const iHome = cleanName(inc.homeTeamName);
          const iAway = cleanName(inc.awayTeamName);
          return (iHome === homeClean && iAway === awayClean) || (iHome === awayClean && iAway === homeClean);
        });

        if (found) {
          return {
            url: `#risultati?day=${found.serieADay}&match=${found.id}`,
            isSpa: true
          };
        }
      }
      return {
        url: `#risultati?day=${m.matchday}`,
        isSpa: true
      };
    }

    const dir = this.getSeasonDirectory(matchSeason);
    if (this.isModernSeason(matchSeason)) {
      return {
        url: `${dir}/index.php#risultati?day=${m.matchday}`,
        isSpa: false
      };
    }

    const page = this._seasonResultPageCache.get(matchSeason) || `${dir}/ris.php`;
    return {
      url: `${page}?Gio=${m.matchday}`,
      isSpa: false
    };
  },

  /**
   * Return roster link info: { url, isSpa }
   * For current season: #rose?team=...
   * For modern past season: Stagione_X/index.php#rose?team=...
   * For legacy past seasons: Stagione_X/rose.htm?Fsq=... or Stagione_X/rose.php?Fsq=...
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

    const dir = this.getSeasonDirectory(s);
    if (this.isModernSeason(s)) {
      return {
        url: `${dir}/index.php#rose?team=${teamId}`,
        isSpa: false
      };
    }

    const page = this._seasonRosterPageCache.get(s) || `${dir}/rose.htm`;
    return {
      url: `${page}?Fsq=${teamId}`,
      isSpa: false
    };
  },

  /**
   * Resolves links for an array of matches (populates m.matchUrl and m.isSpa)
   */
  async resolveMatchesLinks(matches) {
    if (!matches || !Array.isArray(matches) || matches.length === 0) return matches;
    const currentSeason = this.getCurrentSeason();
    const pastSeasons = [...new Set(matches.map(m => Number(m.season)).filter(s => s !== currentSeason))];

    await Promise.all(pastSeasons.map(s => this.resolveSeasonResultPage(s)));

    for (const m of matches) {
      const linkInfo = this.getMatchLink(m);
      m.matchUrl = linkInfo.url;
      m.isSpa = linkInfo.isSpa;
    }
    return matches;
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
      try { await this.loadScript('persjs/fcmConfrontiDati.js'); } catch (e) { }
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


