/**
 * LIVE VOTI VIEW (SPA Native) - ModernFCM
 * Match Center Live Unificato (#live)
 * Integrazione ibrida nativa: Voti PianetaFanta (VU) prioritari con integrazione
 * in tempo reale da Fantapazz (FP), FantaMaster (FM) e Fantacalcio.it (FC) a selezione dell'utente.
 * Tripla modalità di calcolo: Effettivo, Integrato e 6 Ufficio con mini-legenda.
 */

const liveVotiView = {
  currentSource: 'pianetafanta',
  currentDay: null,
  currentComp: 1,
  currentDiv: 0,
  currentMatch: 'all',
  currentSecondaryLive: 'fantacalcio', // 'fantacalcio' | 'fantapazz' | 'fantamaster'
  _liveDataStore: null, // { vu: { voti: [], partite: {} }, fp: { voti: [], partite: {} }, fm: { voti: [], partite: {} }, fc: { voti: [], partite: {} } }
  _liveAutoRefreshInterval: null,
  _secVisibilityHandler: null,
  _lastSecondaryFetchTime: 0,
  _escHandler: null,
  _isManualRefreshPending: false,
  _activeModalPlayer: null,
  _lazyModalSyncedKeys: {},
  container: null,

  /**
   * Helper per foto giocatore (delegato direttamente a fcmDataLoader)
   */
  getPlayerPhoto(nome) {
    if (!nome) return 'img/foto/misterx.gif';
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function') {
      return fcmDataLoader.getPlayerPhoto(nome);
    }
    return 'img/foto/misterx.gif';
  },

  /**
   * Helper per link alla scheda giocatore
   */
  getPlayerLink(nome) {
    if (!nome) return null;
    const clean = String(nome).trim().toLowerCase();
    if (clean.includes("riserva d'ufficio") || clean.includes("assente") || clean.includes("---")) {
      return null;
    }
    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) {
      return fcmDataLoader.getPlayerProfileLink({ name: nome });
    }
    let pId = null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieAPlayerId === 'function') {
      pId = fcmDataLoader.getSerieAPlayerId(nome);
    }
    return pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(nome)}`;
  },

  /**
   * Calcolo automatico del Fantavoto in base a regole e parametri di lega: delega a FCMCalcoloMotore
   */
  calcolaFantavoto(v, ruolo, isFP = false) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaFantavoto(v, ruolo, { isFP });
    }
    if (!v) return 'SV';
    const rawVoto = v.Voto;
    if (rawVoto === 'SV' || rawVoto === 'S.V.' || rawVoto === null || rawVoto === undefined || rawVoto === '' || isNaN(Number(rawVoto))) {
      return 'SV';
    }
    return Number(rawVoto);
  },

  /**
   * Ruolo formattato (P, D, C, A)
   */
  formatRuolo(ruolo) {
    switch (Number(ruolo)) {
      case 1: return 'P';
      case 2: return 'D';
      case 3: return 'C';
      case 4: return 'A';
      default: return ruolo || '';
    }
  },

  /**
   * Formattazione cognome pulito
   */
  formatCognome(nome) {
    if (!nome) return '';
    const lower = nome.toLowerCase();
    if (lower.includes("riserva d'ufficio") || lower.includes("no sostituzione")) {
      return nome;
    }
    const parts = nome.split(' ');
    const caps = parts.filter(p => p && p === p.toUpperCase());
    return caps.length > 0 ? caps.join(' ') : nome;
  },

  /**
   * Formattazione decimale voto (es. 6.5 -> 6.50)
   */
  formatVoto(v) {
    if (v === 'SV' || v === 'S.V.' || v === null || v === undefined || v === '') return 'SV';
    const num = Number(v);
    // Il risultato finisce in innerHTML: un valore non numerico non va mai restituito così com'è
    if (isNaN(num)) return 'SV';
    return num.toFixed(2);
  },

  /**
   * Confronto nomi giocatori FCM con feed voti:
   * 1. Pescaggio diretto primario da arrVoti (corrispondenza esatta nome FCM)
   * 2. Metodi euristici avanzati come fallback trasparente
   */
  matchPlayer(votoObj, nomeFCM, squadraFCM, source = 'pianetafanta') {
    if (!votoObj || !nomeFCM) return false;
    const vNome = votoObj.Nome || (Array.isArray(votoObj) ? votoObj[0] : '') || '';
    if (!vNome) return false;

    const rawSq = votoObj.Squadra || votoObj.squadra || (Array.isArray(votoObj) ? votoObj[14] : '');
    const vSquadra = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();
    const cleanFCM = (squadraFCM === 'Verona' ? 'Hellas Verona' : (squadraFCM || '')).trim().toLowerCase();

    // Controllo squadra: se entrambe specificate e diverse, non corrisponde
    if (cleanFCM && vSquadra && cleanFCM !== vSquadra) return false;

    // 1. PESCAGGIO DIRETTO ESATTO DA arrVoti (i file contengono direttamente i nomi FCM)
    if (vNome === nomeFCM) return true;

    // 2. Corrispondenza case-insensitive diretta
    const fcmUpper = nomeFCM.toUpperCase().trim();
    const vUpper = vNome.toUpperCase().trim();
    if (vUpper === fcmUpper) return true;

    // 3. FALLBACK: Metodi euristici di matching
    const fcmClean = fcmUpper.replace(/['’]/g, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    const fcmTokens = fcmClean.split(' ');
    const cognomeFCM = (this.formatCognome ? this.formatCognome(nomeFCM) : nomeFCM).toUpperCase().trim();

    // 3.1. Associazione personalizzata da arrAssociazioni (case-insensitive)
    if (typeof arrAssociazioni !== 'undefined' && arrAssociazioni) {
      const mapped = arrAssociazioni[vNome] || arrAssociazioni[vNome.trim()];
      if (mapped && (mapped.toUpperCase().trim() === fcmUpper || mapped.toUpperCase().trim() === fcmClean)) {
        return true;
      }
    }

    // Normalizziamo vUpper
    const vClean = vUpper.replace(/['’]/g, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    if (vClean === fcmClean) return true;

    const vTokens = vClean.split(' ');

    // 3. Caso Cognome + Iniziale puntata o non puntata (es. 'STANKOVIC F.', 'MORENO M.', 'STANKOVIC F', 'ESPOSITO SE.')
    if (vTokens.length > 1 && vTokens[vTokens.length - 1].length <= 2) {
      const vInit = vTokens[vTokens.length - 1];
      const vSurname = vTokens.slice(0, -1).join(' ');

      if (fcmClean.startsWith(vSurname)) {
        const restFCM = fcmClean.slice(vSurname.length).trim();
        if (!vInit || restFCM.startsWith(vInit)) return true;
      }

      const surnameTokens = vTokens.slice(0, -1);
      const hasAllSurnameTokens = surnameTokens.every(st => fcmTokens.includes(st));
      if (hasAllSurnameTokens) {
        const remainingFCMTokens = fcmTokens.filter(t => !surnameTokens.includes(t));
        if (remainingFCMTokens.some(rt => rt.startsWith(vInit))) return true;
      }
    }

    // 4. Se v ha solo cognome (es. 'BASIC', 'SOHM', 'HALHAL', 'YEBOAH')
    if (vTokens.length === 1) {
      const singleToken = vTokens[0];
      if (singleToken.length >= 3) {
        if (fcmTokens[0] === singleToken || cognomeFCM === singleToken) return true;
      }
    }

    // 5. Matching specifico per sorgente
    if (source === 'pianetafanta') {
      if (cognomeFCM && cognomeFCM.length >= 3) {
        const cognomeTokens = cognomeFCM.split(' ');
        const allMatch = cognomeTokens.every(ct => vTokens.includes(ct));
        if (allMatch) {
          const restFCM = fcmTokens.filter(t => !cognomeTokens.includes(t));
          const restV = vTokens.filter(t => !cognomeTokens.includes(t));
          if (restFCM.length === 0 || restV.length === 0 || (restFCM[0] && restV[0] && (restFCM[0].startsWith(restV[0]) || restV[0].startsWith(restFCM[0])))) {
            return true;
          }
        }
      }
    } else {
      // Fantapazz (FP), FantaMaster (FM) o Fantacalcio.it (FC)
      if (cognomeFCM && (vClean === cognomeFCM || (cognomeFCM.startsWith(vClean) && vClean.length >= 4))) {
        return true;
      }
      if (vClean.length >= 4 && fcmClean.startsWith(vClean + ' ')) {
        return true;
      }
      // Cognome composto inverso (es. 'CHE ADAMS' vs 'ADAMS Che\' Zach')
      if (vTokens.length > 1 && vTokens.every(vt => fcmTokens.includes(vt))) {
        return true;
      }
      // Tolleranza per substring tokens quando la squadra coincide
      if (fcmClean.includes(vClean) || vClean.includes(fcmClean)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Determina sorgente e parametri URL dall'hash corrente
   */
  _parseRouteState() {
    const hash = window.location.hash || '#live';
    const lowerHash = hash.toLowerCase();

    // Se l'utente arriva con un vecchio link specifico, imposta il provider secondario corrispondente
    if (lowerHash.startsWith('#livefm')) {
      this.currentSource = 'fantamaster';
      this.currentSecondaryLive = 'fantamaster';
    } else if (lowerHash.startsWith('#livefp')) {
      this.currentSource = 'fantapazz';
      this.currentSecondaryLive = 'fantapazz';
    } else if (lowerHash.startsWith('#livefc')) {
      this.currentSource = 'fantacalcio';
      this.currentSecondaryLive = 'fantacalcio';
    } else {
      this.currentSource = 'pianetafanta';
      // Sincronizzato su sessionStorage per coerenza assoluta con la Home
      const savedProvider = (typeof sessionStorage !== 'undefined')
        ? (sessionStorage.getItem('modernfcm_home_live_secondary') || sessionStorage.getItem('fcm_home_live_provider'))
        : null;
      if (savedProvider === 'fantamaster' || savedProvider === 'fantapazz' || savedProvider === 'fantacalcio') {
        this.currentSecondaryLive = savedProvider;
      } else {
        this.currentSecondaryLive = 'fantacalcio';
      }
    }

    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));

    if (this.currentSecondaryLive === 'fantacalcio' && !hasFC) {
      this.currentSecondaryLive = hasFP ? 'fantapazz' : (hasFM ? 'fantamaster' : 'fantacalcio');
    } else if (this.currentSecondaryLive === 'fantapazz' && !hasFP) {
      this.currentSecondaryLive = hasFC ? 'fantacalcio' : (hasFM ? 'fantamaster' : 'fantacalcio');
    } else if (this.currentSecondaryLive === 'fantamaster' && !hasFM) {
      this.currentSecondaryLive = hasFC ? 'fantacalcio' : (hasFP ? 'fantapazz' : 'fantacalcio');
    }

    let day = null, comp = null, div = null, match = null;

    if (hash.includes('?')) {
      const qs = hash.substring(hash.indexOf('?'));
      const params = new URLSearchParams(qs);
      day = params.get('Gio') || params.get('day') || params.get('gio');
      comp = params.get('Comp') || params.get('comp');
      div = params.get('Div') || params.get('div');
      match = params.get('Match') || params.get('match');
    }

    // Default giornata: prossima giornata da giocare
    if (!day) {
      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getUpcomingMatchday === 'function') {
        day = fcmDataLoader.getUpcomingMatchday();
      } else if (typeof GetProssimaGiornataDaGiocare === 'function') {
        day = GetProssimaGiornataDaGiocare();
      } else if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCalendarData === 'function') {
        const cal = fcmDataLoader.getCalendarData();
        day = (cal && cal.nextMatchday > 0) ? cal.nextMatchday : ((cal && cal.lastPlayed > 0) ? cal.lastPlayed : 1);
      } else {
        day = 1;
      }
    }
    this.currentDay = Math.min(38, Math.max(1, parseInt(day, 10) || 1));

    // Default competizione (la prima valida in arrCompetizioni)
    let defaultComp = this.currentComp || 1;
    if (typeof arrCompetizioni !== 'undefined' && arrCompetizioni) {
      for (let c = 1; c < arrCompetizioni.length; c++) {
        if (arrCompetizioni[c]) {
          defaultComp = arrCompetizioni[c].ID;
          break;
        }
      }
    }

    if (comp === null || comp === undefined || comp === '' || comp === 0 || comp === '0') {
      this.currentComp = this.currentComp || defaultComp;
    } else {
      this.currentComp = parseInt(comp, 10);
      if (isNaN(this.currentComp) || this.currentComp <= 0) {
        this.currentComp = defaultComp;
      }
    }

    // Default divisione
    const numDiv = (typeof arrDivisioni !== 'undefined' && arrDivisioni)
      ? arrDivisioni.filter(d => d).length
      : 0;
    if (div !== null && div !== undefined && div !== '') {
      this.currentDiv = parseInt(div, 10);
    } else if (this.currentDiv !== null && this.currentDiv !== undefined) {
      // Mantiene divisione attiva se già impostata
    } else {
      this.currentDiv = (numDiv > 1 && arrDivisioni[1]) ? arrDivisioni[1].ID : 0;
    }

    // Match arriva dall'URL e viene poi usato in link e selettori: solo un ID numerico oppure 'all'
    if (typeof match === 'string' && /^(?:\d+|all)$/.test(match)) {
      this.currentMatch = match;
    } else {
      this.currentMatch = null;
    }
  },

  /**
   * Inizializzazione e rendering principale della vista
   */
  async render(container) {
    this.container = container;
    this._stopSecondaryAutoRefresh();
    this._liveDataStore = null;
    this._isManualRefreshPending = false;
    this._activeModalPlayer = null;
    this._lazyModalSyncedKeys = {};
    this._parseRouteState();

    // Visualizza loader iniziale elegante
    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.liveMatchcenter()
      : `
      <div class="fantam-wrapper" style="padding: 60px 0; text-align: center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:rgba(6,182,212,0.12);color:var(--accent-cyan,#06b6d4);margin-bottom:14px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
        </div>
        <div style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">
          Caricamento Match Center Live...
        </div>
      </div>
    `;

    // Carica gli script di supporto (l'eventuale estrazione VU live avviene con barra di caricamento via _initLiveManager)
    await this._loadRequiredScripts({ skipVUExtract: true });

    // Renderizza shell grafica e controlli
    this._renderShell();
    this._bindEvents();

    // Compila e inietta la tabella degli incontri
    this.renderOutput();

    // Inizializza FcmVotiLiveManager (mostra #liveProgressContainer e gestisce VU + sync secondario)
    this._initLiveManager();

    // Allinea l'hash pulito su #live senza refresh
    this._updateHashState();
  },

  /**
   * Assicura che i voti ufficiosi di PianetaFanta appartengano alla giornata richiesta.
   * Se i metadati indicano una giornata diversa, mancano o è richiesto force refresh,
   * invoca inc/live_extractVU.php per scaricare la giornata corretta.
   */
  async _ensureVotiUfficiosi(giornata, force = false) {
    const targetDay = parseInt(giornata, 10);
    if (!targetDay || isNaN(targetDay)) return;

    let needFetch = force;
    if (!needFetch) {
      try {
        if (typeof fetch !== 'undefined') {
          const metaRes = await fetch(`js/fcmVotiDatiVUMeta.json?t=${Date.now()}`, { cache: 'no-store' });
          if (metaRes.ok) {
            const meta = await metaRes.json();
            needFetch = (!meta || Number(meta.schema) !== 2 || Number(meta.giornata) !== targetDay);
          } else {
            needFetch = true;
          }
        }
      } catch (e) {
        needFetch = true;
      }
    }

    if (needFetch && typeof fetch !== 'undefined') {
      try {
        const forceParam = force ? '&force=1' : '';
        const url = `inc/live_extractVU.php?ajax=1&Gio=${encodeURIComponent(targetDay)}${forceParam}&t=${Date.now()}`;
        await fetch(url, { cache: 'no-store' });
      } catch (e) {
        console.warn(`[liveVotiView] Errore estrazione voti ufficiosi giornata ${targetDay}:`, e);
      }
    }
  },

  /**
   * Caricamento asincrono file formazioni, voti e feed
   */
  async _loadRequiredScripts(options = {}) {
    if (typeof fcmDataLoader === 'undefined') return;
    const { skipVUExtract = false } = options;

    // 1. Assicura che i voti ufficiosi PianetaFanta appartengano alla giornata selezionata
    if (!skipVUExtract) {
      await this._ensureVotiUfficiosi(this.currentDay);
    }

    // 2. Dati Formazioni della giornata selezionata e dettaglio giocatori Serie A
    try {
      if (typeof arrGiocatoriA === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
      }
      if (typeof fcmDataLoader.loadMatchdayLineups === 'function') {
        await fcmDataLoader.loadMatchdayLineups(this.currentDay, true);
      }
      await fcmDataLoader.loadScript(`js/fcmFormazioniDati${this.currentDay}.js`, true);
    } catch (e) {
      console.warn(`[liveVotiView] Impossibile caricare formazioni giornata ${this.currentDay}:`, e);
    }

    // 3. Variabili Calcolo Risultati
    try {
      await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js', true);
    } catch (e) { }

    // 4. Precarica i feed voti nello store in memoria _liveDataStore:
    // a) PianetaFanta (VU) prioritario (se skipVUExtract, carica solo se già riferito a this.currentDay)
    let vuVoti = [], vuPartite = {};
    let isSameDayVU = true;
    if (skipVUExtract) {
      try {
        if (typeof fetch !== 'undefined') {
          const vuMetaRes = await fetch(`js/fcmVotiDatiVUMeta.json?t=${Date.now()}`, { cache: 'no-store' });
          if (vuMetaRes.ok) {
            const vuMeta = await vuMetaRes.json();
            if (!vuMeta || Number(vuMeta.schema) !== 2 || (vuMeta.giornata && Number(vuMeta.giornata) !== Number(this.currentDay))) {
              isSameDayVU = false;
            }
          } else {
            isSameDayVU = false;
          }
        }
      } catch (e) { }
    }

    if (isSameDayVU) {
      try {
        await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
        vuVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
        vuPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
      } catch (e) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDati.js');
          vuVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
          vuPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : {};
        } catch (err) { }
      }
    }

    // b) Fantacalcio.it (FC): carica solo se la giornata del feed corrisponde a this.currentDay
    let fcVoti = [], fcPartite = {};
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));
    if (hasFC) {
      let isSameDayFC = true;
      try {
        if (typeof fetch !== 'undefined') {
          const fcMetaRes = await fetch(`js/fcmVotiDatiFCMeta.json?t=${Date.now()}`, { cache: 'no-store' });
          if (fcMetaRes.ok) {
            const fcMeta = await fcMetaRes.json();
            if (fcMeta && fcMeta.giornataFC && Number(fcMeta.giornataFC) !== Number(this.currentDay)) {
              isSameDayFC = false;
            }
          }
        }
      } catch (e) { }

      if (isSameDayFC) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFC.js', true);
          fcVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
          fcPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
        } catch (e) { }
      }
    }

    // c) Fantapazz (FP): carica solo se la giornata del feed corrisponde a this.currentDay
    let fpVoti = [], fpPartite = {};
    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    if (hasFP) {
      let isSameDayFP = true;
      try {
        if (typeof fetch !== 'undefined') {
          const fpMetaRes = await fetch(`js/fcmVotiDatiFPMeta.json?t=${Date.now()}`, { cache: 'no-store' });
          if (fpMetaRes.ok) {
            const fpMeta = await fpMetaRes.json();
            if (fpMeta && fpMeta.giornataFP && Number(fpMeta.giornataFP) !== Number(this.currentDay)) {
              isSameDayFP = false;
            }
          }
        }
      } catch (e) { }

      if (isSameDayFP) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFP.js', true);
          fpVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
          fpPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
        } catch (e) { }
      }
    }

    // d) FantaMaster (FM): carica solo se la giornata del feed corrisponde a this.currentDay
    let fmVoti = [], fmPartite = {};
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    if (hasFM) {
      let isSameDayFM = true;
      try {
        if (typeof fetch !== 'undefined') {
          const fmMetaRes = await fetch(`js/fcmVotiDatiFMMeta.json?t=${Date.now()}`, { cache: 'no-store' });
          if (fmMetaRes.ok) {
            const fmMeta = await fmMetaRes.json();
            if (fmMeta && fmMeta.giornataFM && Number(fmMeta.giornataFM) !== Number(this.currentDay)) {
              isSameDayFM = false;
            }
          }
        }
      } catch (e) { }

      if (isSameDayFM) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDatiFM.js', true);
          fmVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
          fmPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
        } catch (e) { }
      }
    }

    // Memorizza lo store unificato
    this._liveDataStore = {
      vu: { voti: vuVoti, partite: vuPartite },
      fp: { voti: fpVoti, partite: fpPartite },
      fm: { voti: fmVoti, partite: fmPartite },
      fc: { voti: fcVoti, partite: fcPartite }
    };

    // Ripristina arrVoti globale su VU (o il live attivo se VU è vuoto, altrimenti svuota residui vecchi)
    if (vuVoti.length > 0) {
      window.arrVoti = vuVoti;
      window.arrPartite = vuPartite;
    } else if (this.currentSecondaryLive === 'fantacalcio' && fcVoti.length > 0) {
      window.arrVoti = fcVoti;
      window.arrPartite = fcPartite;
    } else if (this.currentSecondaryLive === 'fantapazz' && fpVoti.length > 0) {
      window.arrVoti = fpVoti;
      window.arrPartite = fpPartite;
    } else if (this.currentSecondaryLive === 'fantamaster' && fmVoti.length > 0) {
      window.arrVoti = fmVoti;
      window.arrPartite = fmPartite;
    } else if (fcVoti.length > 0) {
      window.arrVoti = fcVoti;
      window.arrPartite = fcPartite;
    } else if (fpVoti.length > 0) {
      window.arrVoti = fpVoti;
      window.arrPartite = fpPartite;
    } else if (fmVoti.length > 0) {
      window.arrVoti = fmVoti;
      window.arrPartite = fmPartite;
    } else {
      window.arrVoti = [];
      window.arrPartite = {};
    }
  },

  /**
   * Renderizza la shell grafica principale (Header, Barra Integrazione, Barra Filtri, Legenda, Tabellone)
   */
  _renderShell() {
    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));
    const showProviderSwitcher = [hasFP, hasFM, hasFC].filter(Boolean).length >= 2;

    this.container.innerHTML = `
      <div class="fantam-wrapper live-voti-wrapper">

        <!-- CARD HEADER PRINCIPALE -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div class="card-title" style="display: flex; align-items: center; gap: 10px; font-size: 1.25rem;">
                <span class="live-title-icon" style="display:inline-flex;align-items:center;justify-content:center;color:var(--accent-cyan,#06b6d4);">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </span>
                <span id="liveMainTitle">Match Center Live</span>
                <span class="badge" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan, #06b6d4); font-weight: 700;">
                  ${this.currentDay}&ordf; Giornata
                </span>
              </div>
              <div class="card-subtitle" style="margin-top: 4px;">
                Voti in tempo reale, integrazione con voti ufficiosi e simulazione calcoli con modificatori.
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="btnLiveLegenda" class="btn-live-action" title="Visualizza legenda simboli, eventi e modalità di calcolo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Legenda</span>
              </button>
              <button type="button" id="btnLiveRefresh" class="btn-live-action" title="Aggiorna i voti live ora">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Aggiorna</span>
              </button>
              <a href="#calcolo?Comp=${this.currentComp}&Gio=${this.currentDay}${this.currentDiv ? '&Div=' + this.currentDiv : ''}${(this.currentMatch && this.currentMatch !== 'all') ? '&Match=' + encodeURIComponent(this.currentMatch) : ''}" id="btnLiveGoCalcolo" class="btn-live-action" title="Vai alla pagina di calcolo manuale">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="18"></line>
                  <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
                </svg>
                <span>Calcolo &rarr;</span>
              </a>
            </div>
          </div>

          <!-- BARRA SWITCHER FONTE LIVE SECONDARIA (Identica a #home) -->
          ${showProviderSwitcher ? `
          <div class="live-source-bar" style="border-top: 1px solid var(--border-subtle); padding: 8px 18px;">
            <div class="live-source-bar-left">
              <span class="live-source-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span>Fonte Integrazione Live:</span>
              </span>
              <div class="live-source-pills" id="liveSecondarySwitcherGroup">
                ${hasFC ? `<button 
                  type="button" 
                  class="live-source-pill ${this.currentSecondaryLive === 'fantacalcio' ? 'active' : ''}" 
                  data-live-provider="fantacalcio"
                  aria-pressed="${this.currentSecondaryLive === 'fantacalcio' ? 'true' : 'false'}"
                  title="Integra gare in corso con Fantacalcio.it"
                >
                  <img src="img/live/logo-fc.png" alt="" class="live-source-pill-icon" onerror="this.style.display='none'">
                  <span>Fantacalcio</span>
                </button>` : ''}
                ${hasFP ? `<button 
                  type="button" 
                  class="live-source-pill ${this.currentSecondaryLive === 'fantapazz' ? 'active' : ''}" 
                  data-live-provider="fantapazz"
                  aria-pressed="${this.currentSecondaryLive === 'fantapazz' ? 'true' : 'false'}"
                  title="Integra gare in corso con Fantapazz"
                >
                  <img src="img/live/logo-fp.png" alt="" class="live-source-pill-icon" onerror="this.style.display='none'">
                  <span>Fantapazz</span>
                </button>` : ''}
                ${hasFM ? `<button 
                  type="button" 
                  class="live-source-pill ${this.currentSecondaryLive === 'fantamaster' ? 'active' : ''}" 
                  data-live-provider="fantamaster"
                  aria-pressed="${this.currentSecondaryLive === 'fantamaster' ? 'true' : 'false'}"
                  title="Integra gare in corso con FantaMaster"
                >
                  <img src="img/live/logo-fm.png" alt="" class="live-source-pill-icon" onerror="this.style.display='none'">
                  <span>FantaMaster</span>
                </button>` : ''}
              </div>
            </div>
            <div class="live-source-bar-right">
              <span class="live-base-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Base Voti Ufficiosi: <img src="img/live/live_pianeta.png" alt="" class="live-source-pill-icon" onerror="this.style.display='none'"><strong>PianetaFanta</strong>
              </span>
            </div>
          </div>
          ` : ''}
        </div>

        <!-- CONTROLLI FILTRO -->
        <div class="live-controls-bar" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);box-sizing:border-box;max-width:100%;">
          <!-- Selettore Competizione -->
          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;max-width:100%;box-sizing:border-box;">
            <label for="liveSelComp" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Competizione:
            </label>
            <select id="liveSelComp" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
              ${this._renderCompOptions()}
            </select>
          </div>

          <!-- Selettore Divisione (se presenti) -->
          ${this._renderDivSelectHtml()}

          <!-- Selettore Giornata -->
          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;max-width:100%;box-sizing:border-box;">
            <label for="liveSelDay" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Giornata di Serie A:
            </label>
            <select id="liveSelDay" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
              ${this._renderDayOptions()}
            </select>
          </div>

          <!-- Filtro Singolo Incontro -->
          <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1.5;min-width:240px;max-width:100%;box-sizing:border-box;">
            <label for="liveSelMatch" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Incontro da Visualizzare:
            </label>
            <select id="liveSelMatch" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
              <option value="all">Tutti gli incontri</option>
            </select>
          </div>
        </div>

        <!-- PROGRESS BAR E MONITORAGGIO AGGIORNAMENTO LIVE -->
        <div id="liveProgressContainer" style="display: none; margin-bottom: 16px;"></div>
        <div id="vuCacheNoticeContainer"></div>

        <!-- CONTENITORE TABELLONE PARTITE -->
        <div id="outputContainer"></div>

        <!-- MODAL LEGENDA EVENTI -->
        <div id="legendaModal" class="calc-modal-backdrop" style="display: none;" aria-hidden="true" role="dialog">
          <div class="calc-modal-card" style="max-width: 620px;">
            <div class="calc-modal-header">
              <h3 class="calc-modal-title" style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-cyan, #06b6d4);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Legenda Simboli, Eventi e Calcolo</span>
              </h3>
              <button type="button" id="btnCloseLegenda" class="calc-modal-close-btn" aria-label="Chiudi">&times;</button>
            </div>
            <div class="calc-modal-body">
              <div class="legenda-chips-container" style="margin-bottom: 14px; gap: 8px;">
                <span class="legenda-chip"><img src="img/live/golfatto_s.png" alt="" /> Gol Fatto</span>
                <span class="legenda-chip"><img src="img/live/golsubito_s.png" alt="" /> Gol Subito</span>
                <span class="legenda-chip"><img src="img/live/portiereimbattuto_s.png" alt="" /> Portiere Imbattuto</span>
                <span class="legenda-chip"><img src="img/live/amm_s.png" alt="" /> Ammonizione</span>
                <span class="legenda-chip"><img src="img/live/esp_s.png" alt="" /> Espulsione</span>
                <span class="legenda-chip"><img src="img/live/assist_s.png" alt="" /> Assist</span>
                <span class="legenda-chip"><img src="img/live/rigoresegnato_s.png" alt="" /> Rig. Segnato</span>
                <span class="legenda-chip"><img src="img/live/rigoresbagliato_s.png" alt="" /> Rig. Sbagliato</span>
                <span class="legenda-chip"><img src="img/live/rigoreparato_s.png" alt="" /> Rig. Parato</span>
                <span class="legenda-chip"><img src="img/live/autogol_s.png" alt="" /> Autogol</span>
                <span class="legenda-chip"><img src="img/live/golvittoria_s.png" alt="" /> Gol Vittoria</span>
                <span class="legenda-chip"><img src="img/live/golpareggio_s.png" alt="" /> Gol Pareggio</span>
                <span class="legenda-chip"><img src="img/live/uscito_s.png" alt="" /> Uscito</span>
                <span class="legenda-chip"><img src="img/live/entrato_s.png" alt="" /> Entrato</span>
              </div>
              <div style="font-size:0.75rem;border-top:1px solid var(--border-subtle);padding-top:10px;display:flex;flex-direction:column;gap:6px;">
                <div><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;margin-right:6px;"></span><strong style="color:#ef4444;">Rosso:</strong> Partita o calciatore in corso di svolgimento</div>
                <div><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#94a3b8;margin-right:6px;"></span><strong style="color:var(--text-muted, #64748b);">Grigio:</strong> Partita conclusa e refertata</div>
                <div><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent-gold, #f59e0b);margin-right:6px;"></span><strong style="color:var(--accent-gold, #f59e0b);">Arancione:</strong> S.V. con bonus/malus determinante (base 6.0 + bonus)</div>
                <div><img src="img/live/logo-fc.png" alt="" style="width:12px;height:12px;vertical-align:-1px;margin-right:6px; display: inline;" onerror="this.style.display='none'"><img src="img/live/logo-fp.png" alt="" style="width:12px;height:12px;vertical-align:-1px;margin-right:6px; display: inline;" onerror="this.style.display='none'"><img src="img/live/logo-fm.png" alt="" style="width:12px;height:12px;vertical-align:-1px;margin-right:6px; display: inline;" onerror="this.style.display='none'"><strong>Micro-logo FC / FP / FM:</strong> Voto integrato in tempo reale da Fantacalcio.it, Fantapazz o FantaMaster per gara in corso</div>
              </div>
              <div class="live-calc-legend-card" style="margin-top: 14px; padding: 12px 14px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:7px;font-size:0.82rem;font-weight:700;color:var(--text-primary);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan, #06b6d4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Modalità di Calcolo Match Center</span>
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted);">Tutti i calcoli rispettano regolamento e modificatori di lega</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:0.75rem;">
                  <div style="padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
                    <span class="badge" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan,#06b6d4);font-weight:700;margin-bottom:4px;display:inline-block;">Calcolo Effettivo</span>
                    <div style="color:var(--text-secondary);line-height:1.4;">Usa solo i voti PianetaFanta (VU). Calciatori S.V. o senza voto vengono sostituiti dalla panchina.</div>
                  </div>
                  <div style="padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
                    <span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald,#10b981);font-weight:700;margin-bottom:4px;display:inline-block;">Calcolo Integrato</span>
                    <div style="color:var(--text-secondary);line-height:1.4;">Voti PianetaFanta (VU) prioritari + integrazione Live da Fantacalcio/Fantapazz/FantaMaster + 6.0 virtuale su gare da disputare.</div>
                  </div>
                  <div style="padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
                    <span class="badge" style="background:rgba(245,158,11,0.15);color:var(--accent-gold,#f59e0b);font-weight:700;margin-bottom:4px;display:inline-block;">Calcolo 6 Ufficio</span>
                    <div style="color:var(--text-secondary);line-height:1.4;">Usa solo i voti PianetaFanta (VU) e assegna 6.0 d'ufficio a tutto ciò che non è ancora su VU (senza voti live FC/FP/FM).</div>
                  </div>
                </div>
              </div>
            </div>
            <div style="margin-top: 18px; text-align: right; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.1)); padding-top: 12px;">
              <button type="button" id="btnCloseLegendaBtn" class="btn-live-action" style="cursor: pointer;">Chiudi</button>
            </div>
          </div>
        </div>

        <!-- MODAL CALCOLO RISULTATO VELOCE -->
        <div id="calcModal" class="calc-modal-backdrop" style="display: none;" role="dialog"></div>

        <!-- MODAL NATIVO RIEPILOGO VOTI MULTI-TESTATA -->
        <dialog id="livePlayerModal" class="live-player-dialog" closedby="any" aria-labelledby="livePlayerModalTitle"></dialog>

      </div>
    `;
  },

  /**
   * Helper per opzioni competizioni
   */
  _renderCompOptions() {
    if (typeof arrCompetizioni === 'undefined' || !arrCompetizioni) return '';
    let html = '';
    let firstCompId = null;

    for (let c = 1; c < arrCompetizioni.length; c++) {
      const comp = arrCompetizioni[c];
      if (!comp) continue;
      if (firstCompId === null) firstCompId = comp.ID;
      const isSel = comp.ID === this.currentComp ? 'selected' : '';
      html += `<option value="${comp.ID}" ${isSel}>${comp.Nome}</option>`;
    }

    if ((!this.currentComp || this.currentComp === 0) && firstCompId !== null) {
      this.currentComp = firstCompId;
    }

    return html;
  },

  /**
   * Helper per selettore divisioni
   */
  _renderDivSelectHtml() {
    if (typeof arrDivisioni === 'undefined' || !arrDivisioni) return '';
    const validDivs = arrDivisioni.filter(d => d);
    if (validDivs.length <= 1) return '';

    let opts = '<option value="0">Tutte le Divisioni</option>';
    for (let d = 1; d < arrDivisioni.length; d++) {
      const div = arrDivisioni[d];
      if (!div) continue;
      const isSel = div.ID === this.currentDiv ? 'selected' : '';
      opts += `<option value="${div.ID}" ${isSel}>${div.Nome}</option>`;
    }

    return `
      <div class="control-group" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;max-width:100%;box-sizing:border-box;">
        <label for="liveSelDiv" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
          Divisione:
        </label>
        <select id="liveSelDiv" class="form-select" style="font-weight:700;width:100%;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;overflow:hidden;">
          ${opts}
        </select>
      </div>
    `;
  },

  /**
   * Helper per opzioni giornate
   */
  _renderDayOptions() {
    let html = '';
    for (let g = 1; g <= 38; g++) {
      const isSel = g === this.currentDay ? 'selected' : '';
      html += `<option value="${g}" ${isSel}>${g}&ordf; Giornata</option>`;
    }
    return html;
  },

  /**
   * Bind degli eventi e controlli interattivi
   */
  _bindEvents() {
    // 1. Switcher provider secondario (Fantacalcio ↔ Fantapazz ↔ FantaMaster)
    const providerBtns = this.container.querySelectorAll('#liveSecondarySwitcherGroup .live-source-pill');
    providerBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const prov = btn.getAttribute('data-live-provider');
        if (!prov || prov === this.currentSecondaryLive) return;

        this.currentSecondaryLive = prov;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('modernfcm_home_live_secondary', prov);
          sessionStorage.setItem('fcm_home_live_provider', prov);
        }

        providerBtns.forEach(b => {
          const isMatch = b.getAttribute('data-live-provider') === prov;
          b.classList.toggle('active', isMatch);
          if (typeof b.setAttribute === 'function') b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });

        // Se lo store in memoria per questo provider non è popolato, carichiamo lo script o sincronizziamo il feed
        const targetFeedKey = prov === 'fantamaster' ? 'fm' : (prov === 'fantacalcio' ? 'fc' : 'fp');
        const targetScript = prov === 'fantamaster' ? 'js/fcmVotiDatiFM.js' : (prov === 'fantacalcio' ? 'js/fcmVotiDatiFC.js' : 'js/fcmVotiDatiFP.js');
        const targetMeta = prov === 'fantamaster' ? 'js/fcmVotiDatiFMMeta.json' : (prov === 'fantacalcio' ? 'js/fcmVotiDatiFCMeta.json' : 'js/fcmVotiDatiFPMeta.json');
        if (!this._liveDataStore || !this._liveDataStore[targetFeedKey] || !this._liveDataStore[targetFeedKey].voti || this._liveDataStore[targetFeedKey].voti.length === 0) {
          try {
            let isSameDay = true;
            try {
              if (typeof fetch !== 'undefined') {
                const metaRes = await fetch(`${targetMeta}?t=${Date.now()}`, { cache: 'no-store' });
                if (metaRes.ok) {
                  const meta = await metaRes.json();
                  const feedDay = prov === 'fantamaster' ? meta.giornataFM : (prov === 'fantacalcio' ? meta.giornataFC : meta.giornataFP);
                  if (feedDay && Number(feedDay) !== Number(this.currentDay)) {
                    isSameDay = false;
                  }
                } else {
                  isSameDay = false;
                }
              }
            } catch (e) { }

            if (isSameDay && typeof fcmDataLoader !== 'undefined') {
              await fcmDataLoader.loadScript(targetScript, true);
              const gV = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
              const gP = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
              if (!this._liveDataStore) {
                this._liveDataStore = { vu: { voti: [], partite: {} }, fp: { voti: [], partite: {} }, fm: { voti: [], partite: {} }, fc: { voti: [], partite: {} } };
              }
              this._liveDataStore[targetFeedKey] = { voti: gV, partite: gP };
              if (this._liveDataStore.vu && this._liveDataStore.vu.voti.length > 0) {
                window.arrVoti = this._liveDataStore.vu.voti;
                window.arrPartite = this._liveDataStore.vu.partite;
              }
            }
          } catch (e) {
            console.warn('[liveVotiView] Errore caricamento feed secondario:', e);
          }

          if ((!this._liveDataStore || !this._liveDataStore[targetFeedKey] || this._liveDataStore[targetFeedKey].voti.length === 0) && this._hasMissingOfficialVotesForDay()) {
            await this._syncSecondaryLiveFeed(false, prov);
          }
        }

        const hasVU = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveVU !== 'function' || fcmModules.hasLiveVU());
        if (!hasVU) {
          this._initLiveManager();
        }

        // Ri-renderizza il tabellone con i nuovi dati integrati istantaneamente
        this.renderOutput();
      });
    });

    // 2. Selettore Competizione
    const selComp = this.container.querySelector('#liveSelComp');
    if (selComp) {
      selComp.addEventListener('change', async () => {
        this.currentComp = parseInt(selComp.value, 10) || 1;
        await this._updateHashAndRefresh();
      });
    }

    // 3. Selettore Divisione
    const selDiv = this.container.querySelector('#liveSelDiv');
    if (selDiv) {
      selDiv.addEventListener('change', async () => {
        this.currentDiv = parseInt(selDiv.value, 10) || 0;
        await this._updateHashAndRefresh();
      });
    }

    // 4. Selettore Giornata
    const selDay = this.container.querySelector('#liveSelDay');
    if (selDay) {
      selDay.addEventListener('change', async () => {
        this.currentDay = parseInt(selDay.value, 10) || 1;
        await this._updateHashAndRefresh();
      });
    }

    // 5. Filtro Incontro Singolo
    const selMatch = this.container.querySelector('#liveSelMatch');
    if (selMatch) {
      selMatch.addEventListener('change', () => {
        this.currentMatch = selMatch.value;
        this._filterVisibleMatches();
        this._updateCalcoloLink();
        this._updateHashState();
        this.scrollToMatch(true);
      });
    }

    // 6. Pulsante Refresh Live
    const btnRefresh = this.container.querySelector('#btnLiveRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        const refreshIcon = btnRefresh.querySelector('svg');
        if (refreshIcon) refreshIcon.classList.add('spin');

        if (typeof FcmVotiLiveManager !== 'undefined') {
          this._isManualRefreshPending = true;
          FcmVotiLiveManager.startExtraction(true, true);
        } else {
          await this._loadRequiredScripts();
          if (this._hasMissingOfficialVotesForDay()) {
            await this._syncSecondaryLiveFeed(true);
          }
          this.renderOutput();
        }
        setTimeout(() => {
          if (refreshIcon) refreshIcon.classList.remove('spin');
        }, 1200);
      });
    }

    // 7. Modale Legenda Eventi
    const btnLegenda = this.container.querySelector('#btnLiveLegenda');
    const modalLegenda = this.container.querySelector('#legendaModal');
    const btnCloseLegenda = this.container.querySelector('#btnCloseLegenda');
    const btnCloseLegendaBtn = this.container.querySelector('#btnCloseLegendaBtn');

    const toggleLegenda = (show) => {
      if (!modalLegenda) return;
      modalLegenda.style.display = show ? 'flex' : 'none';
      modalLegenda.setAttribute('aria-hidden', !show);
    };

    if (btnLegenda) btnLegenda.addEventListener('click', () => toggleLegenda(true));
    if (btnCloseLegenda) btnCloseLegenda.addEventListener('click', () => toggleLegenda(false));
    if (btnCloseLegendaBtn) btnCloseLegendaBtn.addEventListener('click', () => toggleLegenda(false));
    if (modalLegenda) {
      modalLegenda.addEventListener('click', (e) => {
        if (e.target === modalLegenda) toggleLegenda(false);
      });
    }

    // Chiudi modali con tasto ESC
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        toggleLegenda(false);
        this.chiudiModalCalcolo();
      }
    };
    document.addEventListener('keydown', this._escHandler);

    // 8. Modale Calcolo click backdrop
    const calcModal = this.container.querySelector('#calcModal');
    if (calcModal) {
      calcModal.addEventListener('click', (e) => {
        if (e.target === calcModal) this.chiudiModalCalcolo();
      });
    }

    // 9. Apertura Modale Riepilogo Voti Multi-Testata al click su card/nome giocatore
    const outContainer = this.container.querySelector('#outputContainer');
    if (outContainer && typeof outContainer.addEventListener === 'function') {
      outContainer.addEventListener('click', (e) => {
        const entry = e && e.target && typeof e.target.closest === 'function'
          ? e.target.closest('.live-player-entry[data-player-name]')
          : null;
        if (!entry) return;
        const nome = entry.getAttribute('data-player-name') || '';
        if (!nome) return;
        const squadraDiA = entry.getAttribute('data-player-team') || '';
        const ruolo = entry.getAttribute('data-player-role') || '';
        this.apriModalGiocatore({ Nome: nome, SquadraDiA: squadraDiA, Ruolo: ruolo });
      });
    }

    // 10. Eventi Modale Nativo Riepilogo Giocatore (#livePlayerModal)
    const playerModal = this.container.querySelector('#livePlayerModal');
    if (playerModal && typeof playerModal.addEventListener === 'function') {
      playerModal.addEventListener('close', () => {
        playerModal.returnValue = '';
        this._activeModalPlayer = null;
      });

      // Fallback pointerdown/pointerup per light-dismiss sui browser senza closedBy (es. Safari)
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
        const isOutsideDialog = (ev, dlg) => {
          const r = dlg.getBoundingClientRect();
          return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
        };
        let pressedOutside = false;
        playerModal.addEventListener('pointerdown', (ev) => {
          pressedOutside = isOutsideDialog(ev, playerModal);
        });
        playerModal.addEventListener('pointerup', (ev) => {
          if (pressedOutside && isOutsideDialog(ev, playerModal) && playerModal.open) {
            playerModal.close();
          }
        });
      }

      // Chiude cleanly il dialog al click sul link scheda giocatore nel footer
      playerModal.addEventListener('click', (ev) => {
        const link = ev && ev.target && typeof ev.target.closest === 'function'
          ? ev.target.closest('a[href^="#schede_giocatori"]')
          : null;
        if (link && playerModal.open && typeof playerModal.close === 'function') {
          playerModal.close();
        }
      });

      // Gestione errori caricamento immagini nel modal (loghi testate -> SVG fallback, logo squadra -> maglia/hide)
      playerModal.addEventListener('error', (ev) => {
        const img = ev && ev.target;
        if (!img || img.tagName !== 'IMG') return;
        if (img.classList && img.classList.contains('live-source-logo-img')) {
          img.hidden = true;
          const wrap = img.parentElement;
          const fallbackSvg = wrap && typeof wrap.querySelector === 'function' ? wrap.querySelector('.live-source-fallback-svg') : null;
          if (fallbackSvg) fallbackSvg.hidden = false;
          return;
        }
        const fallbackSrc = img.getAttribute('data-fallback-src');
        if (fallbackSrc && img.getAttribute('data-fallback-tried') !== '1') {
          img.setAttribute('data-fallback-tried', '1');
          img.src = fallbackSrc;
        } else if (img.classList && img.classList.contains('live-player-modal-teamlogo')) {
          img.hidden = true;
        }
      }, true);
    }
  },

  /**
   * Sincronizza l'URL hash principale su #live con i parametri correnti
   */
  _updateHashState() {
    const matchParam = (this.currentMatch && this.currentMatch !== 'all') ? `&Match=${encodeURIComponent(this.currentMatch)}` : '';
    const divParam = this.currentDiv ? `&Div=${this.currentDiv}` : '';
    const newHash = `#live?Gio=${this.currentDay}&Comp=${this.currentComp}${divParam}${matchParam}`;

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', newHash);
    } else {
      window.location.hash = newHash;
    }
  },

  /**
   * Aggiorna il link al Calcolo nell'header
   */
  _updateCalcoloLink() {
    const linkCalcolo = this.container ? this.container.querySelector('#btnLiveGoCalcolo') : null;
    if (!linkCalcolo) return;
    const divPart = this.currentDiv ? `&Div=${this.currentDiv}` : '';
    const matchPart = (this.currentMatch && this.currentMatch !== 'all') ? `&Match=${encodeURIComponent(this.currentMatch)}` : '';
    linkCalcolo.href = `#calcolo?Comp=${this.currentComp}&Gio=${this.currentDay}${divPart}${matchPart}`;
  },

  /**
   * Aggiorna hash URL e ricarica i dati della giornata
   */
  async _updateHashAndRefresh() {
    this._updateHashState();
    this._stopSecondaryAutoRefresh();
    this._liveDataStore = null;
    this._isManualRefreshPending = false;
    this._activeModalPlayer = null;
    this._lazyModalSyncedKeys = {};
    window.arrVoti = [];
    window.arrPartite = {};

    // Aggiorna badge giornata nell'header principale
    const badgeEl = this.container ? this.container.querySelector('.card-title .badge') : null;
    if (badgeEl) {
      badgeEl.innerHTML = `${this.currentDay}&ordf; Giornata`;
    }

    // Mostra feedback visivo di caricamento durante il passaggio a un'altra giornata
    const outContainer = this.container ? this.container.querySelector('#outputContainer') : null;
    if (outContainer) {
      outContainer.innerHTML = `
        <div class="fantam-wrapper" style="padding: 50px 0; text-align: center;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:rgba(6,182,212,0.12);color:var(--accent-cyan,#06b6d4);margin-bottom:12px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
          </div>
          <div style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">
            Caricamento ${this.currentDay}&ordf; Giornata...
          </div>
        </div>
      `;
    }

    await this._loadRequiredScripts({ skipVUExtract: true });
    this.renderOutput();
    this._updateCalcoloLink();
    this._initLiveManager();
  },

  /**
   * Inizializzazione integrata di FcmVotiLiveManager per la SPA
   * Quando PianetaFanta (VU) è attivo, mostra #liveProgressContainer per i voti ufficiosi
   * e sincronizza il feed secondario (FP/FM/FC) in background se mancano voti ufficiosi.
   */
  _initLiveManager() {
    if (typeof FcmVotiLiveManager === 'undefined') return;

    const hasVU = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveVU !== 'function' || fcmModules.hasLiveVU());
    const activeSec = this.currentSecondaryLive || 'fantacalcio';
    const isFM = activeSec === 'fantamaster';
    const isFC = activeSec === 'fantacalcio';
    const targetDay = this.currentDay;

    window.cGio = this.currentDay;
    window.cComp = this.currentComp;
    window.cDiv = this.currentDiv;
    window.cLive = hasVU ? 0 : 1;

    if (hasVU) {
      FcmVotiLiveManager.init({
        source: 'pianetafanta',
        endpoint: 'inc/live_extractVU.php',
        sourceName: 'PianetaFanta.it',
        sourceTypeDesc: 'Voti Ufficiosi',
        giornata: targetDay,
        containerId: 'liveProgressContainer',
        outputId: 'outputContainer',
        themeClass: 'theme-ufficiosi',
        autoStart: true,
        force: false,
        onSuccess: async (data) => {
          if (!this.container || this.currentDay !== targetDay) return;

          const isManual = !!this._isManualRefreshPending;
          this._isManualRefreshPending = false;

          await this._reloadVuIntoStore(data);
          this.renderOutput();

          if (this._hasMissingOfficialVotesForDay()) {
            await this._syncSecondaryLiveFeed(isManual);
          } else {
            this._stopSecondaryAutoRefresh();
          }

          if ((!data || !data.isSilent) && this.currentMatch && this.currentMatch !== 'all') {
            this.scrollToMatch(true);
          }
        }
      });
    } else {
      const secEndpoint = isFM ? 'inc/live_extractFM.php' : (isFC ? 'inc/live_extractFC.php' : 'inc/live_extractFP.php');
      const secSourceName = isFM ? 'FantaMaster' : (isFC ? 'Fantacalcio.it' : 'Fantapazz.com');
      const secTypeDesc = isFM ? 'Voti Live (FantaMaster)' : (isFC ? 'Voti Live (Fantacalcio)' : 'Voti Live (Fantapazz)');
      const secTheme = isFM ? 'theme-fantamaster' : (isFC ? 'theme-fantacalcio' : '');

      FcmVotiLiveManager.init({
        source: activeSec,
        endpoint: secEndpoint,
        sourceName: secSourceName,
        sourceTypeDesc: secTypeDesc,
        giornata: targetDay,
        containerId: 'liveProgressContainer',
        outputId: 'outputContainer',
        themeClass: secTheme,
        autoStart: true,
        force: false,
        onSuccess: async (data) => {
          if (!this.container || this.currentDay !== targetDay) return;
          this._isManualRefreshPending = false;
          await this._loadRequiredScripts({ skipVUExtract: true });
          this.renderOutput();
          if ((!data || !data.isSilent) && this.currentMatch && this.currentMatch !== 'all') {
            this.scrollToMatch(true);
          }
        }
      });
    }
  },

  /**
   * Aggiorna lo store VU in memoria da fcmVotiDatiVU.js o dai globali appena caricati
   */
  async _reloadVuIntoStore(data) {
    if (!this._liveDataStore) {
      this._liveDataStore = { vu: { voti: [], partite: {} }, fp: { voti: [], partite: {} }, fm: { voti: [], partite: {} }, fc: { voti: [], partite: {} } };
    }

    const shouldLoadFile = !data || !data.cached || !this._liveDataStore.vu || this._liveDataStore.vu.voti.length === 0;
    if (shouldLoadFile && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
      try {
        await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
      } catch (e) {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiDati.js');
        } catch (err) { }
      }
    }

    if (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti) && arrVoti.length > 0) {
      this._liveDataStore.vu = {
        voti: arrVoti.slice(),
        partite: (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {})
      };
    }

    if (this._liveDataStore.vu && this._liveDataStore.vu.voti.length > 0) {
      window.arrVoti = this._liveDataStore.vu.voti;
      window.arrPartite = this._liveDataStore.vu.partite;
    }
  },

  /**
   * Verifica se nella giornata visualizzata mancano ancora voti ufficiosi completi
   */
  _hasMissingOfficialVotesForDay() {
    const giornata = this._getIncontriGiornata(this.currentDay, this.currentComp, this.currentDiv);
    if (!giornata || giornata.length <= 1) return false;

    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;

    const vuData = this._getFeedData('vu');
    if (!vuData || !vuData.voti || vuData.voti.length === 0) return true;

    for (let z = 1; z < giornata.length; z++) {
      const match = giornata[z];
      if (!match) continue;
      if (match.IDTipo === (typeof INC_GRANPREMIO !== 'undefined' ? INC_GRANPREMIO : 2)) {
        return true;
      }
      const pId = match.ID;
      const formCasa = (typeof GetFormazione === 'function')
        ? GetFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa)
        : this._getFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa);
      const formFuori = (typeof GetFormazione === 'function')
        ? GetFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori)
        : this._getFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori);

      if (!this._hasAllOfficialVotesForMatch(formCasa, formFuori, maxRis)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Sincronizza silenziosamente il feed secondario (Fantapazz / FantaMaster / Fantacalcio) per la giornata corrente
   */
  async _syncSecondaryLiveFeed(force = false, providerOverride = null) {
    if (typeof fetch === 'undefined') return;
    const prov = providerOverride || this.currentSecondaryLive || 'fantacalcio';
    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));

    if (prov === 'fantamaster' && !hasFM) return;
    if (prov === 'fantapazz' && !hasFP) return;
    if (prov === 'fantacalcio' && !hasFC) return;

    const isFM = prov === 'fantamaster';
    const isFC = prov === 'fantacalcio';
    const requestDay = this.currentDay;
    const endpoint = isFM ? 'inc/live_extractFM.php' : (isFC ? 'inc/live_extractFC.php' : 'inc/live_extractFP.php');
    const targetScript = isFM ? 'js/fcmVotiDatiFM.js' : (isFC ? 'js/fcmVotiDatiFC.js' : 'js/fcmVotiDatiFP.js');
    const feedKey = isFM ? 'fm' : (isFC ? 'fc' : 'fp');

    let url = `${endpoint}?ajax=1&Gio=${encodeURIComponent(requestDay)}`;
    if (force) url += '&force=1';
    url += `&t=${Date.now()}`;

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      // Verifica che la vista non abbia cambiato giornata o distrutto il DOM durante la chiamata
      if (!this.container || this.currentDay !== requestDay) return;
      if (!data || !data.success) return;

      this._lastSecondaryFetchTime = Date.now();
      const feedDay = isFM ? data.giornataFM : (isFC ? data.giornataFC : data.giornataFP);
      if (feedDay && Number(feedDay) !== Number(requestDay)) {
        // Feed appartenente a un'altra giornata Serie A: non inquinare lo store corrente
        this._stopSecondaryAutoRefresh();
        return;
      }

      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
        await fcmDataLoader.loadScript(targetScript, true);
        if (!this.container || this.currentDay !== requestDay) return;

        const gV = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
        const gP = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
        if (!this._liveDataStore) {
          this._liveDataStore = { vu: { voti: [], partite: {} }, fp: { voti: [], partite: {} }, fm: { voti: [], partite: {} }, fc: { voti: [], partite: {} } };
        }
        this._liveDataStore[feedKey] = { voti: gV, partite: gP };

        if (this._liveDataStore.vu && this._liveDataStore.vu.voti.length > 0) {
          window.arrVoti = this._liveDataStore.vu.voti;
          window.arrPartite = this._liveDataStore.vu.partite;
        }
      }

      this.renderOutput();
      const openModal = this.container && typeof this.container.querySelector === 'function'
        ? this.container.querySelector('#livePlayerModal')
        : null;
      if (openModal && openModal.open && this._activeModalPlayer) {
        openModal.innerHTML = this._renderPlayerModalContent(this._activeModalPlayer);
      }
      this._setupSecondaryAutoRefresh(data.hasMatchLive === true);
    } catch (e) {
      console.warn(`[liveVotiView] Sync secondario (${prov}) non riuscito:`, e);
    }
  },

  /**
   * Auto-refresh silenzioso ogni 60s per gare in corso quando pianetafanta non ha ancora tutti i voti ufficiosi
   */
  _setupSecondaryAutoRefresh(hasMatchLive) {
    if (!hasMatchLive || !this._hasMissingOfficialVotesForDay()) {
      this._stopSecondaryAutoRefresh();
      return;
    }

    if (!this._liveAutoRefreshInterval) {
      this._liveAutoRefreshInterval = setInterval(() => {
        if (!this.container || !this.currentDay) {
          this._stopSecondaryAutoRefresh();
          return;
        }
        if (this._hasMissingOfficialVotesForDay()) {
          this._syncSecondaryLiveFeed(true);
        } else {
          this._stopSecondaryAutoRefresh();
        }
      }, 60000);
    }

    if (!this._secVisibilityHandler && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this._secVisibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.container && this.currentDay) {
          if (Date.now() - this._lastSecondaryFetchTime >= 60000 && this._hasMissingOfficialVotesForDay()) {
            this._syncSecondaryLiveFeed(true);
          }
        }
      };
      document.addEventListener('visibilitychange', this._secVisibilityHandler);
    }
  },

  /**
   * Pulisce timer e listener dell'auto-refresh secondario
   */
  _stopSecondaryAutoRefresh() {
    if (this._liveAutoRefreshInterval) {
      clearInterval(this._liveAutoRefreshInterval);
      this._liveAutoRefreshInterval = null;
    }
    if (this._secVisibilityHandler && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this._secVisibilityHandler);
      this._secVisibilityHandler = null;
    }
  },

  /**
   * Helper per estrazione incontri di giornata da fcmDataLoader
   */
  _getIncontriGiornata(day, compId, divId) {
    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) {
      const cal = fcmDataLoader.getCalendarData();
      if (cal && cal.matches && cal.matches.length > 0) {
        let matches = cal.matches.filter(m => m.serieADay === day && !m.isRiposo && m.type !== 2);
        if (compId && compId > 0) {
          matches = matches.filter(m => m.compId === compId);
        }
        if (divId && divId > 0) {
          const teams = fcmDataLoader.getTeams();
          const divTeams = new Set(teams.filter(t => parseInt(t.IDDivisione, 10) === parseInt(divId, 10)).map(t => t.ID));
          matches = matches.filter(m => m.type === 4 || divTeams.has(m.homeTeamId) || divTeams.has(m.awayTeamId));
        }

        const res = [null];
        for (const m of matches) {
          const raw = (typeof arrIncontri !== 'undefined') ? arrIncontri.find(inc => inc && inc.ID === m.id) : null;
          if (raw) {
            res.push(raw);
          } else {
            const sqCasa = (typeof arrFantasquadre !== 'undefined' && arrFantasquadre) ? arrFantasquadre[m.homeTeamId] : null;
            const sqFuori = (typeof arrFantasquadre !== 'undefined' && arrFantasquadre) ? arrFantasquadre[m.awayTeamId] : null;
            const legaCasa = (sqCasa && sqCasa.IDLega) ? sqCasa.IDLega : ((typeof arrLega !== 'undefined' && arrLega && arrLega.ID) ? arrLega.ID : 1);
            const legaFuori = (sqFuori && sqFuori.IDLega) ? sqFuori.IDLega : ((typeof arrLega !== 'undefined' && arrLega && arrLega.ID) ? arrLega.ID : 1);
            res.push({
              ID: m.id,
              IDTipo: m.type,
              IDCompetizione: m.compId,
              Competizione: m.compName,
              IDGirone: m.groupId,
              Girone: m.groupName,
              GiornataDiA: m.serieADay,
              Fantagiornata: m.fantagiornataNome,
              IDSquadre: { Casa: m.homeTeamId, Fuori: m.awayTeamId },
              IDLegaSquadre: { Casa: legaCasa, Fuori: legaFuori },
              Nomi: { Casa: m.homeTeamName, Fuori: m.awayTeamName },
              Gol: { Casa: m.homeGoals, Fuori: m.awayGoals },
              Parziali: { Casa: m.homePartial, Fuori: m.awayPartial },
              Totali: { Casa: m.homeTotal, Fuori: m.awayTotal }
            });
          }
        }
        return res;
      }
    }

    // Fallback diretto da arrIncontri (fcmCalendarioDati.js)
    if (typeof arrIncontri !== 'undefined') {
      const res = [null];
      for (let i = 1; i < arrIncontri.length; i++) {
        const inc = arrIncontri[i];
        if (!inc) continue;
        if (inc.GiornataDiA === day && (compId === 0 || inc.IDCompetizione === compId) && inc.IDTipo !== INC_RIPOSO) {
          if (divId > 0 && typeof arrFantasquadre !== 'undefined') {
            const sqCasa = arrFantasquadre[inc.IDSquadre.Casa];
            const sqFuori = arrFantasquadre[inc.IDSquadre.Fuori];
            const inDiv = (sqCasa && parseInt(sqCasa.IDDivisione, 10) === parseInt(divId, 10)) ||
              (sqFuori && parseInt(sqFuori.IDDivisione, 10) === parseInt(divId, 10));
            if (!inDiv && inc.IDTipo !== INC_NORMALE_NEUTRO) continue;
          }
          res.push(inc);
        }
      }
      return res;
    }

    return [];
  },

  /**
   * Helper per estrazione e ordinamento formazione
   */
  _getFormazione(pId, idSquadra, idLega) {
    if (typeof arrFormazioni === 'undefined' || !Array.isArray(arrFormazioni)) {
      return [];
    }

    const players = [];
    for (let i = 1; i < arrFormazioni.length; i++) {
      const z = arrFormazioni[i];
      if (!z) continue;
      if (z.IDIncontro === pId && z.IDSquadra === idSquadra && (!idLega || z.IDLega === idLega)) {
        players.push(z);
      }
    }

    if (players.length === 0) return [];

    const titolari = players.filter(p => p.Pos === 0).sort((a, b) => a.Ruolo - b.Ruolo);
    const panchina = players.filter(p => p.Pos > 0).sort((a, b) => {
      if (a.Pos !== b.Pos) return a.Pos - b.Pos;
      return a.Ruolo - b.Ruolo;
    });
    const tribuna = players.filter(p => p.Pos === -1).sort((a, b) => a.Ruolo - b.Ruolo);

    const res = [null];
    for (const p of titolari) res.push(p);
    for (const p of panchina) res.push(p);
    for (const p of tribuna) res.push(p);

    return res;
  },

  /**
   * Restituisce i feed archiviati in _liveDataStore con fallback trasparente sui dati globali
   */
  _getFeedData(feedKey) {
    if (this._liveDataStore && this._liveDataStore[feedKey]) {
      const fd = this._liveDataStore[feedKey];
      if ((fd.voti && fd.voti.length > 0) || (fd.partite && Object.keys(fd.partite).length > 0)) {
        return fd;
      }
    }
    if (feedKey === 'vu') {
      const gVoti = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti : [];
      const gPartite = (typeof arrPartite !== 'undefined' && arrPartite) ? arrPartite : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? arrStatoPartite : {});
      return { voti: gVoti, partite: gPartite };
    }
    return { voti: [], partite: {} };
  },

  /**
   * Compilazione e iniezione del tabellone incontri
   */
  renderOutput() {
    const outContainer = this.container ? this.container.querySelector('#outputContainer') : null;
    if (!outContainer) return;

    const giornata = this._getIncontriGiornata(this.currentDay, this.currentComp, this.currentDiv);

    if (!giornata || giornata.length <= 1 || !giornata[1]) {
      outContainer.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3 class="empty-state-title">Nessun incontro disponibile</h3>
          <p class="empty-state-desc">Non sono presenti partite in programma per la competizione e la giornata selezionate.</p>
          <div class="empty-state-badge">Seleziona un'altra competizione o giornata dal men&ugrave; in alto</div>
        </div>`;
      this._updateMatchSelector([]);
      return;
    }

    this._updateMatchSelector(giornata);

    if (giornata[1].IDTipo === INC_GRANPREMIO) {
      outContainer.innerHTML = this._generateGrandPrixHtml(giornata);
    } else {
      outContainer.innerHTML = this._generateMatchesHtml(giornata);
    }

    this._filterVisibleMatches();
  },

  /**
   * Aggiorna le voci della select Incontro
   */
  _updateMatchSelector(giornata) {
    const selMatch = this.container ? this.container.querySelector('#liveSelMatch') : null;
    if (!selMatch) return;

    const count = (giornata && giornata.length > 1) ? (giornata.length - 1) : 0;
    let html = `<option value="all">Tutti gli incontri (${count})</option>`;
    let matchedId = null;

    if (giornata && giornata.length > 1) {
      if (this.currentMatch && this.currentMatch !== 'all') {
        for (let z = 1; z < giornata.length; z++) {
          const m = giornata[z];
          if (!m) continue;
          if (String(m.ID) === String(this.currentMatch) || String(z) === String(this.currentMatch)) {
            matchedId = String(m.ID);
            break;
          }
        }
      }

      if (!matchedId && this.currentMatch !== 'all') {
        if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.hasFavoriteTeam()) {
          for (let z = 1; z < giornata.length; z++) {
            const m = giornata[z];
            if (!m || !m.Nomi) continue;
            const isHomeFav = fcmHomeConfigManager.isFavoriteTeam(m.IDSquadre && m.IDSquadre.Casa || m.Nomi.Casa);
            const isAwayFav = fcmHomeConfigManager.isFavoriteTeam(m.IDSquadre && m.IDSquadre.Fuori || m.Nomi.Fuori);
            if (isHomeFav || isAwayFav) {
              matchedId = String(m.ID);
              break;
            }
          }
        }
      }

      if (matchedId) {
        this.currentMatch = matchedId;
      } else {
        this.currentMatch = 'all';
      }

      for (let z = 1; z < giornata.length; z++) {
        const m = giornata[z];
        if (!m || !m.Nomi) continue;
        const val = String(m.ID);
        const isSel = (this.currentMatch === val) ? 'selected' : '';
        const compSuffix = m.Competizione ? ` (${m.Competizione})` : '';
        const isHomeFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(m.IDSquadre && m.IDSquadre.Casa || m.Nomi.Casa);
        const isAwayFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(m.IDSquadre && m.IDSquadre.Fuori || m.Nomi.Fuori);
        const favHomePrefix = (isHomeFav) ? '⭐ ' : '';
        const favAwayPrefix = (isAwayFav) ? '⭐ ' : '';
        html += `<option value="${val}" ${isSel}>${favHomePrefix}${m.Nomi.Casa} vs ${favAwayPrefix}${m.Nomi.Fuori}${compSuffix}</option>`;
      }
    } else {
      this.currentMatch = 'all';
    }

    selMatch.innerHTML = html;
    selMatch.value = this.currentMatch;
    this._updateCalcoloLink();
  },

  /**
   * Filtra gli incontri visualizzati in base alla select
   */
  _filterVisibleMatches() {
    if (!this.container) return;
    const blocks = this.container.querySelectorAll('.match-block');
    const selVal = String(this.currentMatch || 'all');

    blocks.forEach(block => {
      const idx = block.getAttribute('data-match-idx');
      const id = block.getAttribute('data-match-id');
      if (selVal === 'all' || selVal === '' || selVal === id || selVal === idx) {
        block.style.display = '';
      } else {
        block.style.display = 'none';
      }
    });
  },

  /**
   * Genera l'HTML per i marcatori Calenbomber del tabellino simulato
   */
  _renderCalenbomberScorers(homeScorers, awayScorers) {
    const escapeFn = (str) => {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const hList = (homeScorers && homeScorers.length > 0)
      ? homeScorers.map(s => {
        const photo = this.getPlayerPhoto(s.name);
        const pLink = this.getPlayerLink(s.name);
        const surname = this.formatCognome(s.name);
        const content = `
          <img src="${photo}" class="live-scorer-photo" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeFn(s.name)}" />
          <span>${escapeFn(surname)}</span>
        `;
        return `
          <div class="live-calen-scorer-row home">
            ${pLink ? `<a href="${pLink}" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">${content}</a>` : `<span style="display:inline-flex;align-items:center;gap:5px;">${content}</span>`}
            <span>⚽</span>
          </div>
        `;
      }).join('')
      : `<div class="live-calen-empty">Nessun gol</div>`;

    const aList = (awayScorers && awayScorers.length > 0)
      ? awayScorers.map(s => {
        const photo = this.getPlayerPhoto(s.name);
        const pLink = this.getPlayerLink(s.name);
        const surname = this.formatCognome(s.name);
        const content = `
          <span>${escapeFn(surname)}</span>
          <img src="${photo}" class="live-scorer-photo" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${escapeFn(s.name)}" />
        `;
        return `
          <div class="live-calen-scorer-row away">
            <span>⚽</span>
            ${pLink ? `<a href="${pLink}" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">${content}</a>` : `<span style="display:inline-flex;align-items:center;gap:5px;">${content}</span>`}
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
  },

  /**
   * Esegue la simulazione del risultato di un match
   * Supporta calcMode: 'integrato' (default) | 'effettivo' | 'ufficio'
   */
  _simulateLiveMatch(match, formCasa, formFuori, calcMode = 'integrato') {
    if (!formCasa || formCasa.length < 12 || !formFuori || formFuori.length < 12) {
      return {
        isMissing: true,
        homeGoals: 0,
        awayGoals: 0,
        homeTotal: 0,
        awayTotal: 0,
        homeScorers: [],
        awayScorers: []
      };
    }

    const dataCasa = this._estraiDatiCalcolo(formCasa, calcMode);
    const dataFuori = this._estraiDatiCalcolo(formFuori, calcMode);

    if (dataCasa.titolari.length < 11 || dataFuori.titolari.length < 11) {
      return {
        isMissing: true,
        homeGoals: 0,
        awayGoals: 0,
        homeTotal: 0,
        awayTotal: 0,
        homeScorers: [],
        awayScorers: []
      };
    }

    const sostCasa = this._eseguiSostituzioni(dataCasa);
    const sostFuori = this._eseguiSostituzioni(dataFuori);

    const attiviCasa = sostCasa.titolariFinali || sostCasa.attivi || [];
    const attiviFuori = sostFuori.titolariFinali || sostFuori.attivi || [];

    const sommaCasa = attiviCasa.reduce((acc, p) => acc + (typeof p.fantavoto === 'number' ? p.fantavoto : 0), 0);
    const sommaFuori = attiviFuori.reduce((acc, p) => acc + (typeof p.fantavoto === 'number' ? p.fantavoto : 0), 0);

    const fCampo = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaFattoreCampo(match.IDTipo || match.idTipo)
      : (typeof fattorecampo !== 'undefined' ? Number(fattorecampo) : 2);

    const mods = this._calcolaModificatori(attiviCasa, attiviFuori);

    const totali = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaTotaliSquadre(sommaCasa, sommaFuori, mods, fCampo)
      : {
        totaleCasa: Number((sommaCasa + fCampo + (mods.modPortiereCasa || 0) + (mods.modDifesaFuori || 0) + (mods.modCentroCasa || 0) + (mods.modAttaccoCasa || 0)).toFixed(2)),
        totaleFuori: Number((sommaFuori + (mods.modPortiereFuori || 0) + (mods.modDifesaCasa || 0) + (mods.modCentroFuori || 0) + (mods.modAttaccoFuori || 0)).toFixed(2))
      };

    const golRes = this._calcolaGol(totali.totaleCasa, totali.totaleFuori);
    const homeGoals = golRes.golCasa !== undefined ? golRes.golCasa : golRes[0];
    const awayGoals = golRes.golFuori !== undefined ? golRes.golFuori : golRes[1];

    const isOutfield = p => {
      const r = p.ruolo !== undefined ? p.ruolo : (p.role !== undefined ? p.role : p.roleNum);
      const rStr = String(r || '').trim().toUpperCase();
      return rStr !== '1' && rStr !== 'P' && rStr !== 'PO';
    };
    const outfieldCasa = attiviCasa.filter(isOutfield);
    const outfieldFuori = attiviFuori.filter(isOutfield);

    const homeScorers = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.assignTeamScorers === 'function')
      ? fcmFantamisterMotore.assignTeamScorers(outfieldCasa, homeGoals)
      : [];
    const awayScorers = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.assignTeamScorers === 'function')
      ? fcmFantamisterMotore.assignTeamScorers(outfieldFuori, awayGoals)
      : [];

    const homeSubMap = { out: {}, in: {} };
    (sostCasa.sostituzioniEffettuate || sostCasa.sostituzioni || []).forEach(s => {
      if (s.tipo === 'panchina' || s.tipo === 'ufficio') {
        homeSubMap.out[s.uscito] = s;
        if (s.tipo === 'panchina' && s.entrato) {
          homeSubMap.in[s.entrato] = s;
        }
      }
    });

    const awaySubMap = { out: {}, in: {} };
    (sostFuori.sostituzioniEffettuate || sostFuori.sostituzioni || []).forEach(s => {
      if (s.tipo === 'panchina' || s.tipo === 'ufficio') {
        awaySubMap.out[s.uscito] = s;
        if (s.tipo === 'panchina' && s.entrato) {
          awaySubMap.in[s.entrato] = s;
        }
      }
    });

    return {
      isMissing: false,
      homeGoals,
      awayGoals,
      homeTotal: totali.totaleCasa,
      awayTotal: totali.totaleFuori,
      homeScorers,
      awayScorers,
      homeSubMap,
      awaySubMap,
      sostCasa,
      sostFuori
    };
  },

  /**
   * Generatore HTML per incontri Standard (Testa a Testa)
   */
  _generateMatchesHtml(giornata) {
    let html = '';
    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;

    for (let z = 1; z < giornata.length; z++) {
      const match = giornata[z];
      if (!match) continue;

      const pId = match.ID;
      const formCasa = (typeof GetFormazione === 'function')
        ? GetFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa)
        : this._getFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa);
      const formFuori = (typeof GetFormazione === 'function')
        ? GetFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori)
        : this._getFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori);

      // Moduli tattici
      let dC = 0, cC = 0, aC = 0;
      let dF = 0, cF = 0, aF = 0;

      if (formCasa.length > 0) {
        for (let h = 1; h < Math.min(12, formCasa.length); h++) {
          if (formCasa[h].Pos !== -1) {
            if (formCasa[h].Ruolo === 2) dC++;
            else if (formCasa[h].Ruolo === 3) cC++;
            else if (formCasa[h].Ruolo === 4) aC++;
          }
        }
      }

      if (formFuori.length > 0) {
        for (let h = 1; h < Math.min(12, formFuori.length); h++) {
          if (formFuori[h].Pos !== -1) {
            if (formFuori[h].Ruolo === 2) dF++;
            else if (formFuori[h].Ruolo === 3) cF++;
            else if (formFuori[h].Ruolo === 4) aF++;
          }
        }
      }

      const moduloCasaStr = `(${dC}-${cC}-${aC})`;
      const moduloFuoriStr = `(${dF}-${cF}-${aF})`;
      const logoCasa = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getTeamLogo(match.Nomi.Casa || match.IDSquadre.Casa) : 'img/sq/undefined.svg';
      const logoFuori = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getTeamLogo(match.Nomi.Fuori || match.IDSquadre.Fuori) : 'img/sq/undefined.svg';

      const isHomeFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(match.IDSquadre && match.IDSquadre.Casa || match.Nomi.Casa);
      const isAwayFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(match.IDSquadre && match.IDSquadre.Fuori || match.Nomi.Fuori);

      // Simulazione tabellino basata sulla cascata integrata
      const sim = this._simulateLiveMatch(match, formCasa, formFuori, 'integrato');
      const hasAllOfficialVotes = !sim.isMissing && this._hasAllOfficialVotesForMatch(formCasa, formFuori, maxRis);

      const simActionsHtml = hasAllOfficialVotes ? `
        <button type="button" class="btn-calcolo-dettagliato-mini" onclick="liveVotiView.apriModalCalcolo(${z}, 'effettivo')" title="Dettaglio Calcolo (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="18"></line>
            <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
          </svg>
          <span>Dettaglio Calcolo</span>
        </button>
      ` : `
        <button type="button" class="btn-calcolo-dettagliato-mini" onclick="liveVotiView.apriModalCalcolo(${z}, 'effettivo')" title="Calcolo Effettivo: solo voti PianetaFanta (VU), S.V. sostituiti (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="18"></line>
            <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
          </svg>
          <span>Calcolo Effettivo</span>
        </button>
        <button type="button" class="btn-calcolo-dettagliato-mini" onclick="liveVotiView.apriModalCalcolo(${z}, 'integrato')" title="Calcolo Integrato: VU prioritario + live FP/FM/FC (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Calcolo Integrato</span>
        </button>
        <button type="button" class="btn-calcolo-dettagliato-mini" onclick="liveVotiView.apriModalCalcolo(${z}, 'ufficio')" title="Calcolo 6 Ufficio: solo voti VU + 6 d'ufficio per gare non ancora su VU (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Calcolo 6 Ufficio</span>
        </button>
      `;

      const footerActionsHtml = hasAllOfficialVotes ? `
        <button type="button" class="btn-calcolo-veloce" onclick="liveVotiView.apriModalCalcolo(${z}, 'effettivo')" title="Dettaglio Calcolo (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="18"></line>
            <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
          </svg>
          <span>Dettaglio Calcolo</span>
        </button>
      ` : `
        <button type="button" class="btn-calcolo-veloce" onclick="liveVotiView.apriModalCalcolo(${z}, 'effettivo')" title="Calcolo Effettivo: solo voti PianetaFanta (VU), S.V. sostituiti (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="18"></line>
            <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
          </svg>
          <span>Calcolo Effettivo</span>
        </button>
        <button type="button" class="btn-calcolo-veloce" onclick="liveVotiView.apriModalCalcolo(${z}, 'integrato')" title="Calcolo Integrato: VU prioritario + live FP/FM/FC (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Calcolo Integrato</span>
        </button>
        <button type="button" class="btn-calcolo-veloce" onclick="liveVotiView.apriModalCalcolo(${z}, 'ufficio')" title="Calcolo 6 Ufficio: solo voti VU + 6 d'ufficio per gare non ancora su VU (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Calcolo 6 Ufficio</span>
        </button>
      `;

      html += `
        <div class="match-block" id="match-block-${z}" data-match-idx="${z}" data-match-id="${pId}">
          <div class="match-container">

            <!-- INTESTAZIONE UNIFICATA SQUADRE E VS CENTRALE -->
            <div class="match-teams-header">
              <div class="team-header-box home ${isHomeFav ? 'team-header-box-favorite' : ''}" id="sqc_${z}">
                <img src="${logoCasa}" class="team-header-shirt" alt="${match.Nomi.Casa}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                <div class="team-header-text">
                  <span class="team-header-name" title="${match.Nomi.Casa}">${isHomeFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${match.Nomi.Casa}</span>
                  <span class="team-header-modulo">${moduloCasaStr}</span>
                </div>
              </div>

              <div class="match-header-center">
                <span class="match-vs-badge">VS</span>
              </div>

              <div class="team-header-box away ${isAwayFav ? 'team-header-box-favorite' : ''}" id="sqf_${z}">
                <img src="${logoFuori}" class="team-header-shirt" alt="${match.Nomi.Fuori}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                <div class="team-header-text">
                  <span class="team-header-name" title="${match.Nomi.Fuori}">${isAwayFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${match.Nomi.Fuori}</span>
                  <span class="team-header-modulo">${moduloFuoriStr}</span>
                </div>
              </div>
            </div>

            <!-- SIMULAZIONE CALCOLO CON MARCATORI E PULSANTI -->
            <div class="livevu-sim-box">
              <div class="livevu-sim-scoreboard">
                <div class="livevu-sim-score-center">
                  <div class="livevu-sim-digits">
                    ${sim.isMissing ? '- -' : `${sim.homeGoals} - ${sim.awayGoals}`}
                  </div>
                  <div class="livevu-sim-totals">
                    ${sim.isMissing ? 'Formazioni incomplete' : `(${sim.homeTotal.toFixed(2)} - ${sim.awayTotal.toFixed(2)})`}
                  </div>
                </div>
              </div>

              ${sim.isMissing ? '' : this._renderCalenbomberScorers(sim.homeScorers, sim.awayScorers)}

              <div class="livevu-sim-actions" style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:10px;">
                ${simActionsHtml}
              </div>
            </div>

            <!-- GRIGLIA FORMAZIONI (CASA / FUORI) -->
            <div class="match-body-grid">
              <div class="col-casa">
                ${this._renderTeamPlayerRows(formCasa, maxRis, pId, 'casa', sim.homeSubMap)}
              </div>
              <div class="col-fuori">
                ${this._renderTeamPlayerRows(formFuori, maxRis, pId, 'fuori', sim.awaySubMap)}
              </div>
            </div>

          </div>

          <!-- PULSANTI CALCOLO IN CALCE AL MATCH (FOOTER) -->
          <div class="match-calc-footer" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:12px 10px;border-top:1px solid var(--border-subtle);background:var(--bg-surface-elevated);border-radius:0 0 var(--radius-md) var(--radius-md);">
            ${footerActionsHtml}
          </div>

        </div>
      `;
    }

    return html;
  },

  /**
   * Generatore HTML per righe titolari e riserve di una squadra
   */
  _renderTeamPlayerRows(formazione, maxRis, partitaId, side, subMap = null) {
    if (!formazione || formazione.length <= 1) {
      return `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.84rem;">
          Formazione non ancora inserita
        </div>`;
    }

    let rowsHtml = '';
    let g = 1;

    for (let h = 1; h < formazione.length; h++) {
      const pl = formazione[h];
      if (!pl || pl.Pos === -1 || g > maxRis) continue;

      if (g === 1) {
        rowsHtml += `<div class="team-divider">TITOLARI</div>`;
      } else if (g === 12) {
        rowsHtml += `<div class="team-divider">RISERVE</div>`;
      }

      const pRuolo = this.formatRuolo(pl.Ruolo);
      const uniqueId = `${partitaId}_${pl.Pos}_${g}`;

      const subInfo = (subMap && subMap.out && subMap.out[pl.Nome])
        ? { subOut: true, entrato: subMap.out[pl.Nome].entrato, tipo: subMap.out[pl.Nome].tipo }
        : ((subMap && subMap.in && subMap.in[pl.Nome])
          ? { subIn: true, uscito: subMap.in[pl.Nome].uscito, tipo: subMap.in[pl.Nome].tipo }
          : null);

      rowsHtml += this._generatePlayerRowHtml(pl, pRuolo, uniqueId, side, subInfo);
      g++;
    }

    return rowsHtml;
  },

  /**
   * Restituisce lo stato globale della partita per la squadra di Serie A:
   * '1' = Terminata, '0' = In corso, '' = Non ancora iniziata
   */
  getTeamMatchState(squadra, feedPartite) {
    if (!squadra) return '';
    const cleanSq = (squadra === 'Verona' ? 'Hellas Verona' : squadra).trim().toLowerCase();

    let statoMap = (feedPartite && typeof feedPartite === 'object' && Object.keys(feedPartite).length > 0)
      ? feedPartite
      : ((typeof arrPartite !== 'undefined' && arrPartite) ? arrPartite : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? arrStatoPartite : null));

    if (statoMap) {
      if (statoMap[squadra] !== undefined) return String(statoMap[squadra]);
      if (statoMap[squadra.toUpperCase()] !== undefined) return String(statoMap[squadra.toUpperCase()]);

      for (const [k, v] of Object.entries(statoMap)) {
        const cleanK = (k === 'Verona' ? 'Hellas Verona' : k).trim().toLowerCase();
        if (cleanK === cleanSq) {
          return String(v !== undefined && v !== null ? v : '');
        }
      }
    }

    return '';
  },

  /**
   * Verifica se per una squadra di Serie A sono già stati inseriti voti validi nel feed specificato
   */
  hasTeamVotes(squadraDiA, votiArr) {
    if (!squadraDiA || !votiArr || !votiArr.length) return false;
    const cleanSq = (squadraDiA === 'Verona' ? 'Hellas Verona' : squadraDiA).trim().toLowerCase();

    for (let i = 0; i < votiArr.length; i++) {
      const v = votiArr[i];
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
   * Verifica se per entrambe le formazioni di un incontro sono presenti tutti i voti ufficiosi (PianetaFanta).
   * Restituisce true solo se vuVoti contiene voti per tutte le squadre di Serie A dei calciatori schierati (titolari + riserve).
   */
  _hasAllOfficialVotesForMatch(formCasa, formFuori, maxRis = 21) {
    const vuData = this._getFeedData('vu');
    const vuVoti = vuData.voti || [];
    if (!vuVoti || vuVoti.length === 0) return false;

    const forms = [formCasa, formFuori];
    let hasAtLeastOnePlayer = false;

    for (const form of forms) {
      if (!form || form.length <= 1) return false;
      let g = 1;
      for (let h = 1; h < form.length; h++) {
        const pl = form[h];
        if (!pl || pl.Pos === -1 || g > maxRis) continue;
        hasAtLeastOnePlayer = true;
        g++;

        const sqA = (pl.SquadraDiA || pl.squadraDiA || pl.club || pl.team || '').trim();
        if (!sqA || sqA.startsWith('{') || sqA === '---') continue;

        if (!this.hasTeamVotes(sqA, vuVoti)) {
          return false;
        }
      }
    }

    return hasAtLeastOnePlayer;
  },

  /**
   * Ricerca voto giocatore in una specifica lista voti:
   * 1. Pescaggio diretto primario da arrVoti (corrispondenza esatta nome FCM)
   * 2. Pescaggio diretto case-insensitive
   * 3. Fallback con metodi euristici avanzati (matchPlayer)
   */
  _findPlayerVote(votiArr, nomeFCM, squadraFCM, source = 'pianetafanta') {
    if (!votiArr || votiArr.length === 0 || !nomeFCM) return null;
    const cleanFCM = (squadraFCM === 'Verona' ? 'Hellas Verona' : (squadraFCM || '')).trim().toLowerCase();

    // 1. PESCAGGIO DIRETTO PRIMARIO: Corrispondenza esatta nome FCM in arrVoti
    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      const vNome = v.Nome || (Array.isArray(v) ? v[0] : '');
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
      const vNome = v.Nome || (Array.isArray(v) ? v[0] : '');
      if (vNome && vNome.toUpperCase().trim() === fcmUpper) {
        const rawSq = v.Squadra || v.squadra || (Array.isArray(v) ? v[14] : '');
        const vSquadra = (rawSq === 'Verona' ? 'Hellas Verona' : (rawSq || '')).trim().toLowerCase();
        if (!cleanFCM || !vSquadra || cleanFCM === vSquadra) {
          return v;
        }
      }
    }

    // 3. FALLBACK: Metodi euristici di matching
    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      if (this.matchPlayer(v, nomeFCM, squadraFCM, source)) {
        return v;
      }
    }
    return null;
  },

  /**
   * Risolve il voto e stato di un giocatore applicando la cascata ibrida identica a #home:
   * 1. Priorità PianetaFanta (se la squadra ha voti su VU)
   * 2. Integrazione con FP, FM o FC (se la squadra non ha voti su VU ed è in corso o terminata)
   * 3. Partita non ancora iniziata
   */
  _resolvePlayerVote(player, ruoloFormatted) {
    const nome = player.Nome || '';
    const sqA = player.SquadraDiA || '';
    const roleNum = Number(player.Ruolo) || (ruoloFormatted === 'P' ? 1 : ruoloFormatted === 'D' ? 2 : ruoloFormatted === 'C' ? 3 : ruoloFormatted === 'A' ? 4 : 0);

    const vuData = this._getFeedData('vu');
    const secKey = this.currentSecondaryLive || 'fantacalcio';
    const secData = this._getFeedData(secKey === 'fantamaster' ? 'fm' : (secKey === 'fantacalcio' ? 'fc' : 'fp'));

    const vuVoti = vuData.voti || [];
    const vuPartite = vuData.partite || {};
    const secVoti = secData.voti || [];
    const secPartite = secData.partite || {};

    const teamStateVU = this.getTeamMatchState(sqA, vuPartite);
    const teamStateSec = this.getTeamMatchState(sqA, secPartite);

    const hasTeamVotesVU = this.hasTeamVotes(sqA, vuVoti);
    const hasTeamVotesSec = this.hasTeamVotes(sqA, secVoti);

    let res = {
      votoVal: '&ndash;',
      fvVal: '&ndash;',
      rawVotoNum: null,
      rawFvNum: null,
      liveColorClass: '',
      votiBoxClass: '',
      isVirtualSix: false,
      isGold: false,
      sourceUsed: 'none', // 'pianetafanta' | 'fantapazz' | 'fantamaster' | 'fantacalcio' | 'none'
      votoObj: null,
      subBadge: '',
      bonusBadges: ''
    };

    // Helper per estrazione bonus e sostituzione da un vObj
    const buildBadges = (vObj, isFPFeed) => {
      if (!vObj) return;
      if (vObj.Sostituzione === '1') {
        const isTit = vObj.Titolare === '1';
        const subIcon = isTit ? 'uscito_s.png' : 'entrato_s.png';
        // Il minuto arriva dai feed esterni e finisce in attributi e testo HTML
        const minStr = vObj.Minuto ? this._escapeAttr(vObj.Minuto) : '';
        const subTitle = isTit ? `Sostituzione: Uscito${minStr ? ` al ${minStr}` : ''}` : `Sostituzione: Entrato${minStr ? ` al ${minStr}` : ''}`;
        res.subBadge = `
          <div class="pr-sub">
            <img src="img/live/${subIcon}" alt="${subTitle}" title="${subTitle}">
            <span class="pr-sub-min">${minStr}</span>
          </div>`;
      }
      res.bonusBadges = this._generateBonusBadgesHtml(vObj, isFPFeed, ruoloFormatted);
    };

    // 1. PRIORITÀ 1: PIANETAFANTA (VU)
    if (hasTeamVotesVU) {
      const vVU = this._findPlayerVote(vuVoti, nome, sqA, 'pianetafanta');
      if (vVU) {
        buildBadges(vVU, false);
        const rawVoto = vVU.Voto;
        const isExplicitSV = (rawVoto === 'SV' || rawVoto === 'S.V.');
        const isVuoto = (rawVoto === '' || rawVoto === null || rawVoto === undefined);
        const numVoto = (!isExplicitSV && !isVuoto && !isNaN(Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)))
          ? Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)
          : null;

        const golF = Number(vVU.GolFatto || 0);
        const golS = Number(vVU.GolSubito || 0);
        const rPar = Number(vVU.RigoreParato || 0);
        const rSba = Number(vVU.RigoreSbagliato || 0);
        const esp = (vVU.Espulsione === '1' || Number(vVU.Espulsione) > 0) ? 1 : 0;
        const autoG = Number(vVU.AutoGol || 0);
        const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (roleNum === 1 && golS > 0));

        if (numVoto !== null && numVoto > 0) {
          const rawFv = this.calcolaFantavoto(vVU, roleNum, false);
          res.rawVotoNum = numVoto;
          res.rawFvNum = (rawFv !== 'SV' && !isNaN(Number(rawFv))) ? Number(rawFv) : numVoto;
          res.votoVal = this.formatVoto(numVoto);
          res.fvVal = this.formatVoto(rawFv);
          res.liveColorClass = 'live-terminata';
          res.sourceUsed = 'pianetafanta';
          res.votoObj = vVU;
          return res;
        } else if (hasDecisiveBonus) {
          res.votoVal = this.formatVoto(6);
          const fakeObj = { ...vVU, Voto: '6' };
          const rawFv = this.calcolaFantavoto(fakeObj, roleNum, false);
          res.rawVotoNum = 6;
          res.rawFvNum = (rawFv !== 'SV' && !isNaN(Number(rawFv))) ? Number(rawFv) : 6;
          res.fvVal = this.formatVoto(rawFv);
          res.liveColorClass = 'live-gold';
          res.isGold = true;
          res.sourceUsed = 'pianetafanta';
          res.votoObj = vVU;
          return res;
        } else {
          // Compagni con voto ma giocatore SV senza bonus: S.V. definitivo
          res.votoVal = 'SV';
          res.fvVal = 'SV';
          res.liveColorClass = 'live-terminata';
          res.sourceUsed = 'pianetafanta';
          res.votoObj = vVU;
          return res;
        }
      } else {
        // Squadra refertata su PianetaFanta ma calciatore assente dalla lista
        res.votoVal = 'SV';
        res.fvVal = 'SV';
        res.liveColorClass = 'live-terminata';
        res.sourceUsed = 'pianetafanta';
        return res;
      }
    }

    // 2. PRIORITÀ 2: INTEGRAZIONE LIVE SECONDARIA (FP, FM o FC)
    if (!hasTeamVotesVU && secVoti && secVoti.length > 0) {
      const vSec = this._findPlayerVote(secVoti, nome, sqA, secKey);
      if (vSec) {
        const isSepPenSec = (secKey === 'fantapazz' || secKey === 'fantacalcio');
        buildBadges(vSec, isSepPenSec);
        const rawVoto = vSec.Voto;
        const isExplicitSV = (rawVoto === 'SV' || rawVoto === 'S.V.');
        const isVuoto = (rawVoto === '' || rawVoto === null || rawVoto === undefined);
        const numVoto = (!isExplicitSV && !isVuoto && !isNaN(Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)))
          ? Number(typeof rawVoto === 'string' ? rawVoto.replace(',', '.') : rawVoto)
          : null;

        const golF = Number(vSec.GolFatto || 0);
        const golS = Number(vSec.GolSubito || 0);
        const rPar = Number(vSec.RigoreParato || 0);
        const rSba = Number(vSec.RigoreSbagliato || 0);
        const esp = (vSec.Espulsione === '1' || Number(vSec.Espulsione) > 0) ? 1 : 0;
        const autoG = Number(vSec.AutoGol || 0);
        const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (roleNum === 1 && golS > 0));

        const isMatchFinished = (teamStateSec === '1' || teamStateVU === '1' || vSec.Finale === '1');
        const isMatchInCourse = (teamStateSec === '0' || teamStateVU === '0' || vSec.Finale === '0');

        if (numVoto !== null && numVoto > 0) {
          const rawFv = this.calcolaFantavoto(vSec, roleNum, isSepPenSec);
          res.rawVotoNum = numVoto;
          res.rawFvNum = (rawFv !== 'SV' && !isNaN(Number(rawFv))) ? Number(rawFv) : numVoto;
          res.votoVal = this.formatVoto(numVoto);
          res.fvVal = this.formatVoto(rawFv);
          res.liveColorClass = isMatchFinished ? 'live-terminata' : 'live-in-corso';
          res.votiBoxClass = isMatchInCourse ? 'live-in-corso' : '';
          res.sourceUsed = secKey;
          res.votoObj = vSec;
          return res;
        } else if (hasDecisiveBonus) {
          res.votoVal = this.formatVoto(6);
          const fakeObj = { ...vSec, Voto: '6' };
          const rawFv = this.calcolaFantavoto(fakeObj, roleNum, isSepPenSec);
          res.rawVotoNum = 6;
          res.rawFvNum = (rawFv !== 'SV' && !isNaN(Number(rawFv))) ? Number(rawFv) : 6;
          res.fvVal = this.formatVoto(rawFv);
          res.liveColorClass = 'live-gold';
          res.isGold = true;
          res.sourceUsed = secKey;
          res.votoObj = vSec;
          return res;
        } else if (isMatchFinished && hasTeamVotesSec) {
          res.votoVal = 'SV';
          res.fvVal = 'SV';
          res.liveColorClass = 'live-terminata';
          res.sourceUsed = secKey;
          res.votoObj = vSec;
          return res;
        } else if (isMatchInCourse) {
          const hasEntered = (vSec.Titolare === '1' || vSec.Sostituzione === '1');
          if (hasEntered) {
            res.rawVotoNum = 6;
            res.rawFvNum = 6;
            res.votoVal = this.formatVoto(6);
            res.fvVal = this.formatVoto(6);
            res.liveColorClass = 'live-in-corso';
            res.votiBoxClass = 'live-in-corso';
            res.isVirtualSix = true;
            res.sourceUsed = secKey;
            res.votoObj = vSec;
            return res;
          }
        }
      } else if ((teamStateSec === '1' || teamStateVU === '1') && hasTeamVotesSec) {
        res.votoVal = 'SV';
        res.fvVal = 'SV';
        res.liveColorClass = 'live-terminata';
        res.sourceUsed = secKey;
        return res;
      }
    }

    // 3. PRIORITÀ 3: GARA NON ANCORA INIZIATA O IN CORSO SENZA VOTI
    const isTeamInCourse = (teamStateVU === '0' || teamStateSec === '0');
    const isTeamFinished = (teamStateVU === '1' || teamStateSec === '1');

    if (isTeamInCourse) {
      res.rawVotoNum = 6;
      res.rawFvNum = 6;
      res.votoVal = this.formatVoto(6);
      res.fvVal = this.formatVoto(6);
      res.liveColorClass = 'live-in-corso';
      res.votiBoxClass = 'live-in-corso';
      res.votoColorClass = 'live-in-corso';
      res.isVirtualSix = true;
    } else if (isTeamFinished) {
      res.rawVotoNum = 6;
      res.rawFvNum = 6;
      res.votoVal = this.formatVoto(6);
      res.fvVal = this.formatVoto(6);
      res.liveColorClass = 'live-terminata';
      res.votiBoxClass = '';
      res.votoColorClass = 'live-virtual';
      res.isVirtualSix = true;
    } else {
      // Non ancora iniziata
      res.votoVal = '&ndash;';
      res.fvVal = '&ndash;';
      res.votiBoxClass = 'live-non-iniziata';
      res.votoColorClass = 'live-non-iniziata';
    }

    if (!res.votoColorClass) {
      if (res.isGold) res.votoColorClass = 'live-gold';
      else if (res.isVirtualSix) res.votoColorClass = 'live-virtual';
      else res.votoColorClass = res.liveColorClass || res.votiBoxClass;
    }

    return res;
  },

  /**
   * Genera il frammento HTML per la riga giocatore con micro-logo e stile armonizzato
   */
  _generatePlayerRowHtml(player, ruoloFormatted, arg3, arg4, arg5, arg6) {
    let uniqueId = arg3;
    let side = arg4 || 'casa';
    let subInfo = arg5 || null;
    if (typeof arg3 !== 'string' || arg3 === null) {
      uniqueId = arg4 || 'id';
      side = arg6 || arg5 || 'casa';
      subInfo = null;
    }

    const nomeCompleto = player.Nome;
    const cognome = this.formatCognome(player.Nome);
    const photoSrc = this.getPlayerPhoto(player.Nome);
    const magliaSrc = `img/sq/${player.SquadraDiA}.png`;
    const playerLink = this.getPlayerLink(player.Nome);

    // Risoluzione voto con cascata ibrida
    const voteState = this._resolvePlayerVote(player, ruoloFormatted);

    // Gestione sostituzione simulata per chi è sicuramente SV
    let rowSubClass = '';
    let simSubBadgeHtml = '';
    if (subInfo && subInfo.subOut) {
      rowSubClass = ' has-sub-out';
      const isUff = subInfo.tipo === 'ufficio' || (subInfo.entrato && subInfo.entrato.includes("d'Ufficio"));
      const entratoShort = isUff ? "Ris. Ufficio" : this.formatCognome(subInfo.entrato);
      simSubBadgeHtml = `<span class="live-sub-tag out" title="Sostituito per SV: subentra ${subInfo.entrato}"><span class="pr-name-full">Out &rarr; ${entratoShort}</span><span class="pr-name-short">Out</span></span>`;
      voteState.votoVal = 'SV';
      voteState.fvVal = 'SV';
      voteState.votoColorClass = 'live-terminata';
    } else if (subInfo && subInfo.subIn) {
      rowSubClass = ' has-sub-in';
      const uscitoShort = this.formatCognome(subInfo.uscito);
      simSubBadgeHtml = `<span class="live-sub-tag in" title="Subentrato da panchina al posto di ${subInfo.uscito}"><span class="pr-name-full">In (per ${uscitoShort})</span><span class="pr-name-short">In</span></span>`;
    }

    // Micro-logo sorgente live secondaria (FP, FM o FC)
    let microLogoHtml = '';
    if (voteState.sourceUsed === 'fantapazz') {
      microLogoHtml = `<img src="img/live/logo-fp.png" class="live-player-source-logo" alt="Fantapazz" title="Voto Live da Fantapazz" onerror="this.style.display='none'">`;
    } else if (voteState.sourceUsed === 'fantamaster') {
      microLogoHtml = `<img src="img/live/logo-fm.png" class="live-player-source-logo" alt="FantaMaster" title="Voto Live da FantaMaster" onerror="this.style.display='none'">`;
    } else if (voteState.sourceUsed === 'fantacalcio') {
      microLogoHtml = `<img src="img/live/logo-fc.png" class="live-player-source-logo" alt="Fantacalcio" title="Voto Live da Fantacalcio.it" onerror="this.style.display='none'">`;
    }

    const valueColorClass = voteState.votoColorClass || (voteState.isGold
      ? 'live-gold'
      : (voteState.isVirtualSix ? 'live-virtual' : (voteState.liveColorClass || voteState.votiBoxClass)));

    const isAway = (side === 'fuori' || side === 'away');
    const sideClass = isAway ? 'away fuori' : 'casa home';
    const dataAttrs = playerLink
      ? ` data-player-name="${this._escapeAttr(nomeCompleto)}" data-player-team="${this._escapeAttr(player.SquadraDiA || '')}" data-player-role="${this._escapeAttr(ruoloFormatted)}"`
      : '';
    const sourceRowCls = voteState.sourceUsed === 'fantapazz'
      ? 'live-source-fp'
      : (voteState.sourceUsed === 'fantamaster' ? 'live-source-fm' : (voteState.sourceUsed === 'fantacalcio' ? 'live-source-fc' : ''));

    return `
      <div class="player-row live-player-entry ${sideClass}${rowSubClass} ${sourceRowCls}"${dataAttrs}>
        <div class="pr-side">
          <div class="pr-avatar">
            <span class="pr-ruolo role-${ruoloFormatted}">${ruoloFormatted}</span>
            <img src="${magliaSrc}" class="pr-maglia" alt="${this._escapeAttr(player.SquadraDiA || '')}" title="${this._escapeAttr(player.SquadraDiA || '')}" onerror="this.src='img/sq/0.gif'">
          </div>
          <img src="${photoSrc}" class="pr-foto-live" alt="${this._escapeAttr(player.Nome || '')}" title="${this._escapeAttr(player.Nome || '')} (${this._escapeAttr(ruoloFormatted)})" loading="lazy" onerror="this.src='img/foto/misterx.gif'">
          <div class="pr-details">
            <div class="pr-name-row" style="display:flex;align-items:center;gap:4px;">
              ${playerLink ? `
                <button type="button" class="pr-nome live-player-modal-trigger ${voteState.liveColorClass}" title="Apri riepilogo voti per testata di ${this._escapeAttr(nomeCompleto)}">
                  <span class="pr-name-full">${this._escapeHtml(nomeCompleto)}</span>
                  <span class="pr-name-short">${this._escapeHtml(cognome)}</span>
                </button>
              ` : `
                <div class="pr-nome ${voteState.liveColorClass}" title="${this._escapeAttr(nomeCompleto)}">
                  <span class="pr-name-full">${this._escapeHtml(nomeCompleto)}</span>
                  <span class="pr-name-short">${this._escapeHtml(cognome)}</span>
                </div>
              `}
              ${voteState.subBadge}
            </div>
            <div class="pr-bonus" id="par${uniqueId}">
              ${voteState.bonusBadges}
              ${simSubBadgeHtml}
            </div>
          </div>
        </div>

        <div class="pr-voti-box ${voteState.votiBoxClass}">
          ${microLogoHtml}
          <div class="pr-voto ${valueColorClass}">${voteState.votoVal}</div>
          <div class="pr-voto-divisore"></div>
          <div class="pr-fv ${valueColorClass}">${voteState.fvVal}</div>
        </div>
      </div>
    `;
  },

  /**
   * Genera le icone badge per i bonus/malus del giocatore
   */
  _generateBonusBadgesHtml(v, isFP, ruoloFormatted) {
    let badges = '';
    const addImg = (src, title) => {
      badges += `<img src="img/live/${src}" title="${title}" alt="${title}">`;
    };

    const isPortiere = (ruoloFormatted === 'P');
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
    if (isFP) {
      for (let i = 0; i < gF; i++) addImg('golfatto_s.png', 'Gol Fatto');
      for (let i = 0; i < rig; i++) addImg('rigoresegnato_s.png', 'Rigore Segnato');
    } else {
      const netGol = Math.max(0, gF - rig);
      for (let i = 0; i < netGol; i++) addImg('golfatto_s.png', 'Gol Fatto');
      const netRig = Math.max(0, rig);
      for (let i = 0; i < netRig; i++) addImg('rigoresegnato_s.png', 'Rigore Segnato');
    }

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

  /**
   * Generatore HTML per competizioni Gran Premio
   */
  _generateGrandPrixHtml(giornata) {
    let html = '';
    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;

    for (let z = 1; z < giornata.length; z++) {
      const match = giornata[z];
      if (!match) continue;

      const pId = match.ID;
      const formCasa = (typeof GetFormazione === 'function')
        ? GetFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa)
        : this._getFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa);

      let dC = 0, cC = 0, aC = 0;
      if (formCasa && formCasa.length > 0) {
        for (let h = 1; h < Math.min(12, formCasa.length); h++) {
          if (formCasa[h].Pos !== -1) {
            if (formCasa[h].Ruolo === 2) dC++;
            else if (formCasa[h].Ruolo === 3) cC++;
            else if (formCasa[h].Ruolo === 4) aC++;
          }
        }
      }
      const moduloCasaStr = `(${dC}-${cC}-${aC})`;
      const logoCasa = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getTeamLogo(match.Nomi.Casa || match.IDSquadre.Casa) : 'img/sq/undefined.svg';

      html += `
        <div class="match-block" id="match-block-${z}" data-match-idx="${z}" data-match-id="${pId}">
          <div class="match-container">
            <div class="match-teams-header">
              <div class="team-header-box home" id="sqc_${z}" style="width: 100%;">
                <img src="${logoCasa}" class="team-header-shirt" alt="${match.Nomi.Casa}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                <div class="team-header-text">
                  <span class="team-header-name" title="${match.Nomi.Casa}">${match.Nomi.Casa}</span>
                  <span class="team-header-modulo">${moduloCasaStr}</span>
                </div>
              </div>
            </div>
            <div class="match-body-grid" style="justify-content: center;">
              <div class="col-casa" style="width: 100%; max-width: 680px; border: none; margin: 0 auto;">
                ${this._renderTeamPlayerRows(formCasa, maxRis, pId, 'casa')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return html;
  },

  /**
   * Calcolo Dettagliato Risultato e Apertura Modale con i 3 pulsanti:
   * 'effettivo' | 'integrato' | 'ufficio'
   */
  async apriModalCalcolo(matchIdx, calcMode = 'integrato') {
    const modal = this.container ? this.container.querySelector('#calcModal') : document.getElementById('calcModal');
    if (!modal) return;

    if (typeof fattorecampo === 'undefined' || typeof modD === 'undefined' || typeof modC === 'undefined' || typeof modA === 'undefined' || typeof autoGol === 'undefined' || typeof CalcoloPreciso === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js', true);
      } catch (e) { }
    }

    const giornata = this._getIncontriGiornata(this.currentDay, this.currentComp, this.currentDiv);
    const match = giornata[matchIdx];
    if (!match) return;

    const pId = match.ID;
    const formCasa = (typeof GetFormazione === 'function')
      ? GetFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa)
      : this._getFormazione(pId, match.IDSquadre.Casa, match.IDLegaSquadre.Casa);
    const formFuori = (typeof GetFormazione === 'function')
      ? GetFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori)
      : this._getFormazione(pId, match.IDSquadre.Fuori, match.IDLegaSquadre.Fuori);

    const dataCasa = this._estraiDatiCalcolo(formCasa, calcMode);
    const dataFuori = this._estraiDatiCalcolo(formFuori, calcMode);

    const sostCasa = this._eseguiSostituzioni(dataCasa);
    const sostFuori = this._eseguiSostituzioni(dataFuori);

    const attiviCasa = sostCasa.titolariFinali || sostCasa.attivi || [];
    const attiviFuori = sostFuori.titolariFinali || sostFuori.attivi || [];
    let sommaCasa = 0;
    let sommaFuori = 0;
    attiviCasa.forEach(p => { sommaCasa += (typeof p.fantavoto === 'number' ? p.fantavoto : 0); });
    attiviFuori.forEach(p => { sommaFuori += (typeof p.fantavoto === 'number' ? p.fantavoto : 0); });

    const fCampo = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaFattoreCampo(match.IDTipo || match.idTipo)
      : (typeof fattorecampo !== 'undefined' ? Number(fattorecampo) : 2);

    const mods = this._calcolaModificatori(attiviCasa, attiviFuori);

    const totali = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaTotaliSquadre(sommaCasa, sommaFuori, mods, fCampo)
      : {
        totaleCasa: Number((sommaCasa + fCampo + mods.modPortiereCasa + mods.modDifesaFuori + mods.modCentroCasa + mods.modAttaccoCasa).toFixed(2)),
        totaleFuori: Number((sommaFuori + mods.modPortiereFuori + mods.modDifesaCasa + mods.modCentroFuori + mods.modAttaccoFuori).toFixed(2))
      };
    const totaleCasa = totali.totaleCasa;
    const totaleFuori = totali.totaleFuori;

    const gol = this._calcolaGol(totaleCasa, totaleFuori);

    const formatSign = (val) => {
      const n = Math.round((Number(val) || 0) * 100) / 100;
      return n > 0 ? `+${n}` : `${n}`;
    };
    const hasModX = typeof modX !== 'undefined' && (modX === 1 || modX === '1');
    const isAutoGolActive = typeof autoGol !== 'undefined' && (autoGol === 1 || autoGol === '1' || autoGol === true);
    const pAutogol_val = typeof pAutogol !== 'undefined' ? Number(pAutogol) : 59;
    const pScarAutogol_val = typeof pScarAutogol !== 'undefined' ? Number(pScarAutogol) : 3;

    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;
    const hasAllOfficialVotes = this._hasAllOfficialVotesForMatch(formCasa, formFuori, maxRis);

    let modeTitle = 'Calcolo Integrato (Ibrido VU + Live)';
    let modeDesc = 'Voti PianetaFanta (VU) prioritari + integrazione Live in tempo reale da FP/FM/FC + 6.0 virtuale su gare da disputare.';
    if (hasAllOfficialVotes) {
      modeTitle = 'Dettaglio Calcolo (Voti Ufficiosi)';
      modeDesc = 'Tutti i voti ufficiosi PianetaFanta per questo incontro sono presenti.';
    } else if (calcMode === 'effettivo') {
      modeTitle = 'Calcolo Effettivo (Voti Reali)';
      modeDesc = 'Usa solo i voti PianetaFanta (VU): calciatori S.V. o senza voto vengono sostituiti dalla panchina.';
    } else if (calcMode === 'ufficio' || calcMode === 'simulato') {
      modeTitle = 'Simulazione Calcolo (con 6 d\'ufficio)';
      modeDesc = 'Usa solo i voti PianetaFanta (VU) e assegna 6.0 d\'ufficio a tutto ciò che non è ancora su VU (senza voti live FP/FM/FC).';
    }

    const modeTabsHtml = hasAllOfficialVotes ? '' : `
        <!-- Selettore Modalità a 3 Pulsanti: Effettivo ↔ Integrato ↔ 6 Ufficio -->
        <div class="calc-modal-mode-tabs" style="display:flex;justify-content:center;gap:6px;margin:12px 0 6px;flex-wrap:wrap;">
          <button type="button" class="pill-btn ${calcMode === 'effettivo' ? 'active' : ''}" onclick="liveVotiView.apriModalCalcolo(${matchIdx}, 'effettivo')" style="font-size:0.75rem;padding:5px 12px;border-radius:var(--radius-full);cursor:pointer;${calcMode === 'effettivo' ? 'background:var(--accent-cyan);color:#0f172a;font-weight:800;border-color:var(--accent-cyan);' : 'background:transparent;color:var(--text-secondary);border:1px solid var(--border-subtle);'}">
            Calcolo Effettivo
          </button>
          <button type="button" class="pill-btn ${calcMode === 'integrato' ? 'active' : ''}" onclick="liveVotiView.apriModalCalcolo(${matchIdx}, 'integrato')" style="font-size:0.75rem;padding:5px 12px;border-radius:var(--radius-full);cursor:pointer;${calcMode === 'integrato' ? 'background:var(--accent-emerald,#10b981);color:#0f172a;font-weight:800;border-color:var(--accent-emerald,#10b981);' : 'background:transparent;color:var(--text-secondary);border:1px solid var(--border-subtle);'}">
            Calcolo Integrato
          </button>
          <button type="button" class="pill-btn ${calcMode === 'ufficio' ? 'active' : ''}" onclick="liveVotiView.apriModalCalcolo(${matchIdx}, 'ufficio')" style="font-size:0.75rem;padding:5px 12px;border-radius:var(--radius-full);cursor:pointer;${calcMode === 'ufficio' ? 'background:var(--accent-gold,#f59e0b);color:#0f172a;font-weight:800;border-color:var(--accent-gold,#f59e0b);' : 'background:transparent;color:var(--text-secondary);border:1px solid var(--border-subtle);'}">
            Calcolo 6 Ufficio
          </button>
        </div>
    `;

    modal.innerHTML = `
      <div class="calc-modal-card" style="max-width: 620px;">
        <div class="calc-modal-header">
          <h3 class="calc-modal-title">${modeTitle}</h3>
          <button type="button" class="calc-modal-close-btn" id="btnCloseCalcModalLive" aria-label="Chiudi">&times;</button>
        </div>

        ${modeTabsHtml}

        <div style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin:10px 0 12px;line-height:1.35;padding:0 8px;">
          ℹ️ ${modeDesc}
        </div>

        <div class="calc-score-box">
          <div class="calc-score-team">
            <div style="font-size:1.05rem; font-weight:800;">${match.Nomi.Casa}</div>
            <div class="calc-score-total">Totale: <b>${totaleCasa} pt</b></div>
          </div>
          <div class="calc-score-goals">
            ${gol[0]} - ${gol[1]}
          </div>
          <div class="calc-score-team">
            <div style="font-size:1.05rem; font-weight:800;">${match.Nomi.Fuori}</div>
            <div class="calc-score-total">Totale: <b>${totaleFuori} pt</b></div>
          </div>
        </div>

        ${(gol.autogolCasa || gol.autogolFuori) ? `
          <div style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.35); border-radius:8px; padding:6px 12px; margin: 0 0 12px 0; font-size:0.8rem; color:var(--text-primary); text-align:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:4px;color:var(--accent-green, #10b981);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <b>Gol Omaggio (Autogol):</b> Assegnato +1 gol a <b>${gol.autogolCasa ? match.Nomi.Casa : match.Nomi.Fuori}</b> (avversario &lt; ${pAutogol_val} pt con scarto &ge; ${pScarAutogol_val} pt)
          </div>
        ` : ''}

        <table class="calc-detail-table">
          <thead>
            <tr>
              <th style="width:50%; text-align:center;">${match.Nomi.Casa}</th>
              <th style="width:50%; text-align:center;">${match.Nomi.Fuori}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Parziale squadra:</span>
                  <span class="calc-row-val">${sommaCasa.toFixed(2)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Parziale squadra:</span>
                  <span class="calc-row-val">${sommaFuori.toFixed(2)} pt</span>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Fattore campo:</span>
                  <span class="calc-row-val">+${fCampo} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Fattore campo:</span>
                  <span class="calc-row-val">0 pt</span>
                </div>
              </td>
            </tr>
            ${mods.isModP ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Portiere:</span>
                  <span class="calc-row-val">${formatSign(mods.modPortiereCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Portiere:</span>
                  <span class="calc-row-val">${formatSign(mods.modPortiereFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${mods.isModD ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Difesa:</span>
                  <span class="calc-row-val">${formatSign(mods.modDifesaFuori)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Difesa:</span>
                  <span class="calc-row-val">${formatSign(mods.modDifesaCasa)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${mods.isModC ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Centrocampo:</span>
                  <span class="calc-row-val">${formatSign(mods.modCentroCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Centrocampo:</span>
                  <span class="calc-row-val">${formatSign(mods.modCentroFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${mods.isModA ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Attacco:</span>
                  <span class="calc-row-val">${formatSign(mods.modAttaccoCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Attacco:</span>
                  <span class="calc-row-val">${formatSign(mods.modAttaccoFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${hasModX ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Personalizzato:</span>
                  <span class="calc-row-val">0 pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Personalizzato:</span>
                  <span class="calc-row-val">0 pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${isAutoGolActive && (gol.autogolCasa || gol.autogolFuori) ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Gol Omaggio (Autogol):</span>
                  <span class="calc-row-val" style="${gol.autogolCasa ? 'color:var(--accent-green, #10b981);font-weight:800;' : ''}">${gol.autogolCasa ? '+1 gol' : '0'}</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Gol Omaggio (Autogol):</span>
                  <span class="calc-row-val" style="${gol.autogolFuori ? 'color:var(--accent-green, #10b981);font-weight:800;' : ''}">${gol.autogolFuori ? '+1 gol' : '0'}</span>
                </div>
              </td>
            </tr>` : ''}
          </tbody>
        </table>

        <div style="font-weight:800; font-size:0.75rem; text-transform:uppercase; color:var(--accent-cyan, #06b6d4); margin: 12px 0 6px; letter-spacing:0.04em;">
          Sostituzioni Effettuate
        </div>
        <div class="calc-sost-section" style="display:flex; justify-content:space-between; gap:16px;">
          <div style="flex:1; text-align:center;">
            <b style="color:var(--text-primary);">${match.Nomi.Casa}:</b><br>
            ${this._formatSostituzioniHtml(sostCasa.sostituzioni)}
          </div>
          <div style="flex:1; text-align:center;">
            <b style="color:var(--text-primary);">${match.Nomi.Fuori}:</b><br>
            ${this._formatSostituzioniHtml(sostFuori.sostituzioni)}
          </div>
        </div>

        <div style="text-align: center; margin-top: 18px;">
          <button type="button" class="btn-modern-action" id="btnModalCloseOkLive" style="width:100%; max-width:200px;">
            Chiudi Risultato
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const close = () => { modal.style.display = 'none'; };
    const closeBtn = modal.querySelector('#btnCloseCalcModalLive');
    const closeOk = modal.querySelector('#btnModalCloseOkLive');
    if (closeBtn) closeBtn.onclick = close;
    if (closeOk) closeOk.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  },

  /**
   * Chiude la modale calcolo rapido
   */
  chiudiModalCalcolo() {
    const modal = this.container ? this.container.querySelector('#calcModal') : document.getElementById('calcModal');
    if (modal) modal.style.display = 'none';
  },

  /**
   * Estrae e normalizza i dati di titolari e panchina per il calcolo dei risultati
   * Supporta modalità con Pos esplicito (FCM nativo: 0 = titolare, >0 = panchina ordinata)
   * o fallback sequenziale (1..11 titolari, 12..max riserve)
   * @param {Array} formArr Array della formazione (es. da GetFormazione o fcmDataLoader)
   * @param {String|Boolean} calcMode 'effettivo' | 'integrato' | 'ufficio' (oppure false = effettivo, true = ufficio)
   */
  _estraiDatiCalcolo(formArr, calcMode = 'integrato') {
    if (calcMode === false) calcMode = 'effettivo';
    else if (calcMode === true || calcMode === 'simulato') calcMode = 'ufficio';

    const titolari = [];
    const panchina = [];
    if (!formArr || formArr.length <= 1) return { titolari, panchina };

    // Estrai tutti i giocatori validi escludendo la tribuna (Pos === -1)
    const validPlayers = [];
    const startIdx = (formArr[0] && (formArr[0].Nome || formArr[0].nome || formArr[0].name)) ? 0 : 1;
    for (let h = startIdx; h < formArr.length; h++) {
      const p = formArr[h];
      if (!p) continue;
      const pos = p.Pos !== undefined ? p.Pos : (p.position !== undefined ? p.position : undefined);
      if (pos === -1) continue; // Tribuna
      validPlayers.push(p);
    }

    // Se ci sono giocatori con Pos o isStarter espliciti
    const hasExplicitStarters = validPlayers.some(p => p.isStarter === true || p.Pos === 0 || p.position === 0);
    let startersRaw = [];
    let benchRaw = [];

    if (hasExplicitStarters) {
      startersRaw = validPlayers.filter(p => p.isStarter === true || p.Pos === 0 || p.position === 0);
      benchRaw = validPlayers.filter(p => (p.isStarter === false || (p.Pos !== undefined && p.Pos > 0) || (p.position !== undefined && p.position > 0)) && !startersRaw.includes(p));
      benchRaw.sort((a, b) => {
        const posA = a.Pos !== undefined ? a.Pos : (a.position !== undefined ? a.position : 99);
        const posB = b.Pos !== undefined ? b.Pos : (b.position !== undefined ? b.position : 99);
        return posA - posB;
      });
    } else {
      // Fallback sequenziale classico
      startersRaw = validPlayers.slice(0, 11);
      benchRaw = validPlayers.slice(11);
    }

    const maxRisCount = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve
      : 10;
    if (benchRaw.length > maxRisCount) {
      benchRaw = benchRaw.slice(0, maxRisCount);
    }

    for (const p of startersRaw) {
      titolari.push(this._estraiGiocatoreCalcolo(p, calcMode));
    }
    for (const p of benchRaw) {
      panchina.push(this._estraiGiocatoreCalcolo(p, calcMode));
    }

    return { titolari, panchina };
  },

  /**
   * Helper per calcolare i campi di calcolo di un singolo giocatore secondo calcMode
   */
  _estraiGiocatoreCalcolo(rawPlayer, calcMode) {
    const rawRuolo = rawPlayer.Ruolo !== undefined ? rawPlayer.Ruolo : rawPlayer.ruolo;
    const ruoloNum = Number(rawRuolo) || (rawRuolo === 'P' ? 1 : rawRuolo === 'D' ? 2 : rawRuolo === 'C' ? 3 : rawRuolo === 'A' ? 4 : 0);
    const ruoloFormatted = this.formatRuolo(ruoloNum);

    const pl = {
      id: rawPlayer.ID || rawPlayer.Id || rawPlayer.Pos || rawPlayer.position,
      ruolo: ruoloNum,
      Ruolo: ruoloNum,
      role: ruoloNum,
      nome: rawPlayer.Nome || rawPlayer.nome || rawPlayer.name,
      Nome: rawPlayer.Nome || rawPlayer.nome || rawPlayer.name,
      name: rawPlayer.Nome || rawPlayer.nome || rawPlayer.name,
      squadraDiA: rawPlayer.SquadraDiA || rawPlayer.squadraDiA || rawPlayer.club || rawPlayer.team,
      club: rawPlayer.SquadraDiA || rawPlayer.squadraDiA || rawPlayer.club || rawPlayer.team,
      hasVote: false,
      votoNum: 0,
      rawVote: 0,
      fantavoto: 0,
      totVote: 0,
      golFatti: 0,
      golSubiti: 0,
      rigoriSegnati: 0,
      rigoriParati: 0,
      rigoriSbagliati: 0,
      autogol: 0,
      assist: 0,
      ammonizione: 0,
      espulsione: 0,
      isSub: false,
      isRisUfficio: false,
      isNoSost: false,
      isVirtual6: false,
      isSV: false,
      isNonIniziata: false,
      hasPlayed: false,
      inCourse: false
    };

    if (calcMode === 'effettivo' || calcMode === 'ufficio') {
      // MODALITÀ SOLO PIANETAFANTA (VU):
      // - 'effettivo': solo voti reali PianetaFanta (chi è S.V. o ha voto mancante [null, "", "0", 0] viene sostituito)
      // - 'ufficio': solo voti PianetaFanta + 6.0 d'ufficio per tutto ciò che non è ancora su VU (esclude FP/FM)
      const vuData = this._getFeedData('vu');
      const vuVoti = vuData.voti || [];
      const vuPartite = vuData.partite || {};

      const vuState = this.getTeamMatchState(pl.squadraDiA, vuPartite);
      if (vuState === '0') pl.inCourse = true;
      else if (vuState === '1') pl.hasPlayed = true;
      else pl.isNonIniziata = true;

      const hasTeamVotesVU = this.hasTeamVotes(pl.squadraDiA, vuVoti);
      const vVU = vuVoti.length > 0 ? this._findPlayerVote(vuVoti, pl.nome, pl.squadraDiA, 'pianetafanta') : null;

      const assignVirtualSix = () => {
        pl.hasVote = true;
        pl.votoNum = 6;
        pl.voto = 6;
        pl.rawVote = 6;
        pl.fantavoto = 6;
        pl.votoFinale = 6;
        pl.totVote = 6;
        pl.isVirtual6 = true;
      };

      const assignMissingAsSV = () => {
        pl.isVirtual6 = false;
        pl.hasVote = false;
        pl.isSV = true;
      };

      if (vVU) {
        const rawV = vVU.Voto;
        const rawStr = (rawV === null || rawV === undefined) ? '' : String(rawV).trim();
        const rawUpper = rawStr.toUpperCase();
        const isExplicitSV = (rawUpper === 'SV' || rawUpper === 'S.V.');
        const isZeroOrNull = (rawStr === '' || rawV === '0' || rawV === 0 || Number(rawStr.replace(',', '.')) === 0);
        const parsedV = (!isExplicitSV && !isZeroOrNull) ? Number(rawStr.replace(',', '.')) : NaN;
        const numV = (!isNaN(parsedV) && parsedV > 0) ? parsedV : null;

        const golF = Number(vVU.GolFatto || 0);
        const golS = Number(vVU.GolSubito || 0);
        const rPar = Number(vVU.RigoreParato || 0);
        const rSba = Number(vVU.RigoreSbagliato || 0);
        const esp = (vVU.Espulsione === '1' || Number(vVU.Espulsione) > 0) ? 1 : 0;
        const autoG = Number(vVU.AutoGol || 0);
        const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (pl.ruolo === 1 && golS > 0));

        if (numV !== null) {
          pl.isVirtual6 = false;
          pl.hasVote = true;
          pl.votoNum = numV;
          pl.voto = numV;
          pl.rawVote = numV;
          this._popolaBonusGiocatore(pl, vVU, false);
          const calcFv = this.calcolaFantavoto(vVU, pl.ruolo, false);
          pl.fantavoto = (calcFv !== 'SV' && !isNaN(Number(calcFv))) ? Number(calcFv) : numV;
          pl.votoFinale = pl.fantavoto;
          pl.totVote = pl.fantavoto;
        } else if (hasDecisiveBonus) {
          pl.isVirtual6 = false;
          pl.hasVote = true;
          pl.votoNum = 6;
          pl.voto = 6;
          pl.rawVote = 6;
          pl.isSvWithBonus = true;
          this._popolaBonusGiocatore(pl, vVU, false);
          const fakeObj = { ...vVU, Voto: '6' };
          const calcFv = this.calcolaFantavoto(fakeObj, pl.ruolo, false);
          pl.fantavoto = (calcFv !== 'SV' && !isNaN(Number(calcFv))) ? Number(calcFv) : 6;
          pl.votoFinale = pl.fantavoto;
          pl.totVote = pl.fantavoto;
        } else if (isExplicitSV) {
          // SV definitivo su PianetaFanta: sostituito in entrambi i calcoli
          assignMissingAsSV();
        } else if (calcMode === 'ufficio') {
          // Voto non ancora presente su VU (null / "" / "0" / 0): 6 d'ufficio
          assignVirtualSix();
        } else {
          // 'effettivo': voto non ancora presente su VU -> sostituito
          assignMissingAsSV();
        }
      } else if (calcMode === 'ufficio' && !hasTeamVotesVU) {
        // Squadra non ancora su PianetaFanta (incluse eventuali squadre presenti solo su FP/FM): 6 d'ufficio
        assignVirtualSix();
      } else {
        // Squadra refertata su VU con giocatore assente (= SV definitivo) oppure 'effettivo' senza voto VU -> sostituito
        assignMissingAsSV();
      }
    } else {
      // CALCOLO INTEGRATO (Ibrido, logica tabellino): VU prioritario + live FP/FM/FC + 6.0 virtuale su gare non iniziate/in attesa
      const vState = this._resolvePlayerVote(rawPlayer, ruoloFormatted);
      const vObj = vState.votoObj;

      const teamSt = this.getTeamMatchState(pl.squadraDiA);
      if (teamSt === '0' || vState.liveColorClass === 'live-in-corso' || vState.votiBoxClass === 'live-in-corso') {
        pl.inCourse = true;
      } else if (teamSt === '1' || vState.liveColorClass === 'live-terminata') {
        pl.hasPlayed = true;
      } else if (teamSt === '' || vState.votiBoxClass === 'live-non-iniziata') {
        pl.isNonIniziata = true;
      }

      if (vState.isGold) {
        pl.isSvWithBonus = true;
      }
      if (vState.votoVal !== '&ndash;' && vState.votoVal !== 'SV') {
        const numV = (typeof vState.rawVotoNum === 'number' && !isNaN(vState.rawVotoNum)) ? vState.rawVotoNum : Number(vState.votoVal);
        const fvN = (typeof vState.rawFvNum === 'number' && !isNaN(vState.rawFvNum)) ? vState.rawFvNum : Number(vState.fvVal);
        if (!isNaN(numV) && numV > 0) {
          pl.hasVote = true;
          pl.votoNum = numV;
          pl.voto = numV;
          pl.rawVote = numV;
          pl.fantavoto = !isNaN(fvN) ? fvN : numV;
          pl.votoFinale = pl.fantavoto;
          pl.totVote = pl.fantavoto;
          pl.isVirtual6 = vState.isVirtualSix;
          if (vObj) this._popolaBonusGiocatore(pl, vObj, vState.sourceUsed === 'fantapazz' || vState.sourceUsed === 'fantacalcio');
        } else {
          pl.hasVote = false;
          pl.isSV = true;
        }
      } else if (vState.votoVal === '&ndash;') {
        // Gara non iniziata: in modalità integrata assegna 6.0 virtuale per simulare la partita
        pl.hasVote = true;
        pl.votoNum = 6;
        pl.voto = 6;
        pl.rawVote = 6;
        pl.fantavoto = 6;
        pl.votoFinale = 6;
        pl.totVote = 6;
        pl.isVirtual6 = true;
      } else {
        // S.V. definitivo
        pl.hasVote = false;
        pl.isSV = true;
      }
    }

    return pl;
  },

  /**
   * Helper per popolare i bonus giocatore per il calcolo
   */
  _popolaBonusGiocatore(pl, vObj, isLiveFP) {
    const golF = Number(vObj.GolFatto || 0);
    const golS = Number(vObj.GolSubito || 0);
    const rPar = Number(vObj.RigoreParato || 0);
    const rSba = Number(vObj.RigoreSbagliato || 0);
    const esp = (vObj.Espulsione === '1' || Number(vObj.Espulsione) > 0) ? 1 : 0;
    const autoG = Number(vObj.AutoGol || 0);
    const ass = Number(vObj.Assist || 0);

    if (pl.ruolo === 1) {
      pl.golSubiti = golS;
      pl.golS = golS;
      pl.rigoriParati = rPar;
      pl.rigP = rPar;
    } else {
      const rawRig = Number(vObj.Rigore || 0);
      const rigoriSegnati = isLiveFP ? rawRig : Math.max(0, rawRig - rSba);
      const netGoals = isLiveFP ? golF : Math.max(0, golF - rigoriSegnati);

      pl.golFatti = netGoals;
      pl.golF = netGoals;
      pl.rigoriSegnati = rigoriSegnati;
      pl.rigF = rigoriSegnati;
      pl.rigoriSbagliati = rSba;
    }

    pl.autogol = autoG;
    pl.assist = ass;
    if (vObj.Ammonizione === '1' || Number(vObj.Ammonizione) > 0) pl.ammonizione = 1;
    if (esp > 0) pl.espulsione = 1;
  },

  /**
   * Esegue le sostituzioni secondo i regolamenti FCM: delega a FCMCalcoloMotore
   */
  _eseguiSostituzioni(data) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.eseguiSostituzioni(data.titolari, data.panchina);
    }
    return { attivi: data.titolari || [], sostituzioni: [], numSost: 0, numRiserveUfficio: 0 };
  },

  /**
   * Calcolo Modificatori secondo fcmCalcolorisultatiFunzioni.js: delega a FCMCalcoloMotore
   */
  _calcolaModificatori(attiviCasa, attiviFuori) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaModificatori(attiviCasa, attiviFuori);
    }
    return {
      modDifesaCasa: 0, modDifesaFuori: 0, modCentroCasa: 0, modCentroFuori: 0,
      modPortiereCasa: 0, modPortiereFuori: 0, modAttaccoCasa: 0, modAttaccoFuori: 0,
      isModD: false, isModC: false, isModP: false, isModA: false,
      modPortiereAttivo: false, modDifesaAttivo: false, modCentroAttivo: false, modAttaccoAttivo: false
    };
  },

  /**
   * Calcolo Gol da Punteggio: delega a FCMCalcoloMotore
   */
  _calcolaGol(totCasa, totFuori) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaGolSquadre(totCasa, totFuori);
    }
    return [0, 0];
  },

  /**
   * Formatta le sostituzioni in HTML
   */
  _formatSostituzioniHtml(sostArr) {
    if (!sostArr || sostArr.length === 0) {
      return '<span style="color:var(--text-muted); font-size:0.8rem;">Nessuna</span>';
    }

    const effettuate = sostArr.filter(s => s.tipo !== 'nessuna' && s.tipo !== 'zero');
    const nonSost = sostArr.filter(s => s.tipo === 'nessuna' || s.tipo === 'zero');

    let html = '';

    if (effettuate.length === 0) {
      html += '<div style="color:var(--text-muted); font-size:0.8rem;">Nessuna</div>';
    } else {
      html += effettuate.map(s => {
        const isUfficio = s.tipo === 'ufficio' || (s.entrato && s.entrato.toLowerCase().includes("riserva d'ufficio"));
        const entratoColor = isUfficio ? '#f59e0b' : '#10b981';
        const linkUscito = this.getPlayerLink(s.uscito);
        const linkEntrato = isUfficio ? null : this.getPlayerLink(s.entrato);
        const uscitoHtml = linkUscito
          ? `<a href="${linkUscito}" style="color:#ef4444;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${this.formatCognome(s.uscito)}</a>`
          : `<span style="color:#ef4444;">${this.formatCognome(s.uscito)}</span>`;
        const entratoHtml = linkEntrato
          ? `<a href="${linkEntrato}" style="color:${entratoColor};font-weight:600;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${this.formatCognome(s.entrato)}</a>`
          : `<span style="color:${entratoColor};font-weight:600;">${this.formatCognome(s.entrato)}</span>`;
        return `
          <div style="font-size:0.78rem; margin:2px 0; color:var(--text-secondary);">
            ${uscitoHtml} &rarr; ${entratoHtml}
          </div>
        `;
      }).join('');
    }

    if (nonSost.length > 0) {
      const nomi = nonSost.map(s => {
        const l = this.getPlayerLink(s.uscito);
        const c = this.formatCognome(s.uscito);
        return l ? `<a href="${l}" style="color:inherit;text-decoration:underline;">${c}</a>` : c;
      }).join(', ');
      html += `
        <div style="margin-top:6px; font-size:0.72rem; color:var(--text-muted);">
          <b>Non sostituiti (0 pt):</b> ${nomi}
        </div>
      `;
    }

    return html;
  },

  /**
   * Helper per lo scroll fluido verso un elemento target
   */
  _scrollToElement(el, smooth = true) {
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!el || (this.container && !document.body.contains(this.container))) return;
        const header = document.querySelector('.app-header');
        const headerHeight = header ? header.getBoundingClientRect().height : 60;
        const rect = el.getBoundingClientRect();
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = Math.max(0, currentScrollY + rect.top - headerHeight - 14);

        window.scrollTo({
          top: targetY,
          behavior: smooth ? 'smooth' : 'instant'
        });
      });
    });
  },

  /**
   * Scorre fino alla partita visualizzata
   */
  scrollToMatch(smooth = true) {
    if (!this.container || !document.body.contains(this.container)) return;

    let targetMatch = null;

    if (this.currentMatch && this.currentMatch !== 'all') {
      // Confronto sugli attributi, così il valore non entra mai in un selettore CSS
      const wanted = String(this.currentMatch);
      const matchBlocks = Array.from(this.container.querySelectorAll('.match-block'));
      const specificBlock = matchBlocks.find(b => b.getAttribute('data-match-id') === wanted) ||
        matchBlocks.find(b => b.getAttribute('data-match-idx') === wanted);
      if (specificBlock) {
        targetMatch = specificBlock.querySelector('.match-container') || specificBlock;
      }
    }

    if (!targetMatch || targetMatch.style.display === 'none') {
      const blocks = this.container.querySelectorAll('.match-block');
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].style.display !== 'none' && blocks[i].offsetHeight > 0) {
          targetMatch = blocks[i].querySelector('.match-container') || blocks[i];
          break;
        }
      }
    }

    if (!targetMatch) {
      targetMatch = this.container.querySelector('.match-container') ||
        this.container.querySelector('#outputContainer') ||
        document.getElementById('outputContainer');
    }

    if (targetMatch) {
      this._scrollToElement(targetMatch, smooth);
    }
  },

  _escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _escapeAttr(str) {
    return this._escapeHtml(str).replace(/'/g, '&#39;');
  },

  _getVotoTipo(val) {
    if (typeof VotoGiocatoreVU !== 'undefined' && typeof VotoGiocatoreVU.votoTipo === 'function') {
      return VotoGiocatoreVU.votoTipo(val);
    }
    if (val === null || val === undefined || val === '') return 'NONE';
    if (typeof val === 'number') return val > 0 ? 'NUM' : 'NONE';
    const s = String(val).trim().toLowerCase();
    if (s === 's.v.' || s === 's.v' || s === 'sv' || s === 's/v') return 'SV';
    if (s === '0' || s === '0.0' || s === 'null' || s === '') return 'NONE';
    const n = Number(s.replace(',', '.'));
    return (!isNaN(n) && n > 0) ? 'NUM' : 'NONE';
  },

  _parseVotoNum(val) {
    if (typeof VotoGiocatoreVU !== 'undefined' && typeof VotoGiocatoreVU.parseNum === 'function') {
      return VotoGiocatoreVU.parseNum(val);
    }
    if (val === null || val === undefined || val === '') return null;
    const n = typeof val === 'number' ? val : Number(String(val).trim().replace(',', '.'));
    return (!isNaN(n) && n > 0) ? n : null;
  },

  _buildSourceLogoHtml(key) {
    const map = {
      gaz: {
        src: 'img/live/logo-gaz.png',
        bg: '#f472b6',
        fg: '#111827',
        txt: 'G'
      },
      cor: {
        src: 'img/live/logo-cor.png',
        bg: '#dc2626',
        fg: '#ffffff',
        txt: 'CdS'
      },
      tut: {
        src: 'img/live/logo-tut.png',
        bg: '#2563eb',
        fg: '#ffffff',
        txt: 'TS'
      },
      vu: {
        src: 'img/live/live_pianeta.png',
        bg: '#0891b2',
        fg: '#ffffff',
        txt: 'PF'
      },
      fp: {
        src: 'img/live/logo-fp.png',
        bg: '#10b981',
        fg: '#06281e',
        txt: 'FP'
      },
      fm: {
        src: 'img/live/logo-fm.png',
        bg: '#f59e0b',
        fg: '#1f1300',
        txt: 'FM'
      },
      fc: {
        src: 'img/live/logo-fc.png',
        bg: '#3b82f6',
        fg: '#ffffff',
        txt: 'FC'
      }
    };
    const cfg = map[key] || map.vu;
    const fs = cfg.txt.length >= 3 ? '8.5' : (cfg.txt.length === 2 ? '10' : '13');
    return `
      <span class="live-source-logo-wrap">
        <img src="${cfg.src}" alt="" class="live-source-logo-img">
        <svg class="live-source-fallback-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" hidden>
          <rect x="1" y="1" width="22" height="22" rx="6" fill="${cfg.bg}"></rect>
          <text x="12" y="15.5" text-anchor="middle" fill="${cfg.fg}" font-size="${fs}" font-weight="800" font-family="system-ui, sans-serif">${cfg.txt}</text>
        </svg>
      </span>
    `;
  },

  _formatModalVoteRow(vObj, roleNum, ruoloFormatted, opts = {}) {
    const { isFPFeed = false, allowVirtualWait = false, treatMissingAsSV = false } = opts;
    const muteDash = '<span class="live-modal-muted">&ndash;</span>';

    if (!vObj) {
      if (treatMissingAsSV) {
        return {
          votoHtml: '<span class="live-terminata">SV</span>',
          fvHtml: '<span class="live-terminata">SV</span>',
          bonusHtml: muteDash
        };
      }
      if (allowVirtualWait) {
        return {
          votoHtml: `<span class="live-in-corso">${this.formatVoto(6)}</span> <span class="live-modal-subnote">attesa</span>`,
          fvHtml: `<span class="live-in-corso">${this.formatVoto(6)}</span>`,
          bonusHtml: muteDash
        };
      }
      return { votoHtml: muteDash, fvHtml: muteDash, bonusHtml: muteDash };
    }

    const rawVoto = vObj.Voto;
    const tipo = this._getVotoTipo(rawVoto);
    const numVoto = tipo === 'NUM' ? this._parseVotoNum(rawVoto) : null;

    const golF = Number(vObj.GolFatto || 0);
    const golS = Number(vObj.GolSubito || 0);
    const rPar = Number(vObj.RigoreParato || 0);
    const rSba = Number(vObj.RigoreSbagliato || 0);
    const esp = (vObj.Espulsione === '1' || Number(vObj.Espulsione) > 0) ? 1 : 0;
    const autoG = Number(vObj.AutoGol || 0);
    const amm = (vObj.Ammonizione === '1' || Number(vObj.Ammonizione) > 0) ? 1 : 0;
    const ass = Number(vObj.Assist || 0);
    const rig = Number(vObj.Rigore || 0);
    const hasDecisiveBonus = (golF > 0 || rPar > 0 || rSba > 0 || esp > 0 || autoG > 0 || (roleNum === 1 && golS > 0));
    const hasAnyEvent = hasDecisiveBonus || amm > 0 || ass > 0 || rig > 0;

    if (numVoto !== null) {
      const fv = this.calcolaFantavoto(vObj, roleNum, isFPFeed);
      const badges = this._generateBonusBadgesHtml(vObj, isFPFeed, ruoloFormatted);
      return {
        votoHtml: `<span class="live-modal-num">${this.formatVoto(numVoto)}</span>`,
        fvHtml: `<span class="live-modal-fv">${this.formatVoto(fv)}</span>`,
        bonusHtml: badges || muteDash
      };
    }

    if (hasDecisiveBonus) {
      const fakeObj = { ...vObj, Voto: '6' };
      const fv = this.calcolaFantavoto(fakeObj, roleNum, isFPFeed);
      const badges = this._generateBonusBadgesHtml(fakeObj, isFPFeed, ruoloFormatted);
      return {
        votoHtml: `<span class="live-gold">${this.formatVoto(6)}</span> <span class="live-modal-subnote live-modal-subnote-gold">s.v. + bonus</span>`,
        fvHtml: `<span class="live-gold">${this.formatVoto(fv)}</span>`,
        bonusHtml: badges || muteDash
      };
    }

    if (tipo === 'SV' || (tipo === 'NONE' && treatMissingAsSV)) {
      const badges = (tipo === 'SV' || hasAnyEvent) ? this._generateBonusBadgesHtml(vObj, isFPFeed, ruoloFormatted) : '';
      return {
        votoHtml: '<span class="live-terminata">SV</span>',
        fvHtml: '<span class="live-terminata">SV</span>',
        bonusHtml: badges || muteDash
      };
    }

    if (allowVirtualWait) {
      const hasEntered = (vObj.Titolare === '1' || vObj.Sostituzione === '1');
      if (hasEntered) {
        const badges = hasAnyEvent ? this._generateBonusBadgesHtml(vObj, isFPFeed, ruoloFormatted) : '';
        return {
          votoHtml: `<span class="live-in-corso">${this.formatVoto(6)}</span> <span class="live-modal-subnote">attesa</span>`,
          fvHtml: `<span class="live-in-corso">${this.formatVoto(6)}</span>`,
          bonusHtml: badges || muteDash
        };
      }
    }

    if (hasAnyEvent) {
      const badges = this._generateBonusBadgesHtml(vObj, isFPFeed, ruoloFormatted);
      return {
        votoHtml: muteDash,
        fvHtml: muteDash,
        bonusHtml: badges || muteDash
      };
    }

    return { votoHtml: muteDash, fvHtml: muteDash, bonusHtml: muteDash };
  },

  _evaluateVuPaperRow(vVU, paperKey, hasTeamVotesVU, roleNum, ruoloFormatted) {
    if (!vVU) {
      return this._formatModalVoteRow(null, roleNum, ruoloFormatted, {
        isFPFeed: false,
        treatMissingAsSV: hasTeamVotesVU
      });
    }
    const suffix = paperKey === 'cor' ? 'Cor' : (paperKey === 'tut' ? 'Tut' : 'Gaz');
    const paperObj = {
      Voto: vVU[`Voto${suffix}`] !== undefined ? vVU[`Voto${suffix}`] : '',
      GolFatto: vVU[`GolFatto${suffix}`] !== undefined ? vVU[`GolFatto${suffix}`] : 0,
      GolSubito: vVU[`GolSubito${suffix}`] !== undefined ? vVU[`GolSubito${suffix}`] : 0,
      AutoGol: vVU[`AutoGol${suffix}`] !== undefined ? vVU[`AutoGol${suffix}`] : 0,
      Assist: vVU[`Assist${suffix}`] !== undefined ? vVU[`Assist${suffix}`] : 0,
      Ammonizione: vVU.Ammonizione || 0,
      Espulsione: vVU.Espulsione || 0,
      Rigore: vVU.Rigore || 0,
      RigoreParato: vVU.RigoreParato || 0,
      RigoreSbagliato: vVU.RigoreSbagliato || 0,
      GolVittoria: vVU.GolVittoria || 0,
      GolPareggio: vVU.GolPareggio || 0,
      Titolare: vVU.Titolare || '0',
      Sostituzione: vVU.Sostituzione || '0'
    };
    const tipo = this._getVotoTipo(paperObj.Voto);
    const hasPaperEvents = Number(paperObj.GolFatto || 0) > 0 || Number(paperObj.GolSubito || 0) > 0 || Number(paperObj.AutoGol || 0) > 0 || Number(paperObj.Assist || 0) > 0;
    if (tipo === 'NONE' && !hasPaperEvents) {
      return {
        votoHtml: '<span class="live-modal-muted">&ndash;</span>',
        fvHtml: '<span class="live-modal-muted">&ndash;</span>',
        bonusHtml: '<span class="live-modal-muted">&ndash;</span>'
      };
    }
    return this._formatModalVoteRow(paperObj, roleNum, ruoloFormatted, { isFPFeed: false });
  },

  _renderPlayerModalContent(player) {
    const nome = (player && player.Nome) ? String(player.Nome) : '';
    const sqA = (player && player.SquadraDiA) ? String(player.SquadraDiA) : '';
    const rawRole = (player && player.Ruolo !== undefined) ? player.Ruolo : '';
    const roleNum = Number(rawRole) || (rawRole === 'P' ? 1 : rawRole === 'D' ? 2 : rawRole === 'C' ? 3 : rawRole === 'A' ? 4 : 0);
    const ruoloFormatted = this.formatRuolo(roleNum || rawRole) || '--';

    const photoSrc = this.getPlayerPhoto(nome);
    const playerLink = this.getPlayerLink(nome);
    const teamLogoSrc = (sqA && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieALogo === 'function')
      ? fcmDataLoader.getSerieALogo(sqA)
      : (sqA ? `img/sq/logo/${encodeURIComponent(sqA)}.png` : '');
    const teamShirtSrc = (sqA && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieAShirt === 'function')
      ? fcmDataLoader.getSerieAShirt(sqA)
      : (sqA ? `img/sq/${encodeURIComponent(sqA)}.png` : '');

    const vuData = this._getFeedData('vu');
    const fpData = this._getFeedData('fp');
    const fmData = this._getFeedData('fm');
    const fcData = this._getFeedData('fc');
    const vuVoti = vuData.voti || [];
    const fpVoti = fpData.voti || [];
    const fmVoti = fmData.voti || [];
    const fcVoti = fcData.voti || [];

    const hasTeamVotesVU = this.hasTeamVotes(sqA, vuVoti);
    const hasTeamVotesFP = this.hasTeamVotes(sqA, fpVoti);
    const hasTeamVotesFM = this.hasTeamVotes(sqA, fmVoti);
    const hasTeamVotesFC = this.hasTeamVotes(sqA, fcVoti);
    const teamStateVU = this.getTeamMatchState(sqA, vuData.partite);
    const teamStateFP = this.getTeamMatchState(sqA, fpData.partite);
    const teamStateFM = this.getTeamMatchState(sqA, fmData.partite);
    const teamStateFC = this.getTeamMatchState(sqA, fcData.partite);

    const vVU = this._findPlayerVote(vuVoti, nome, sqA, 'pianetafanta');
    const vFP = fpVoti.length > 0 ? this._findPlayerVote(fpVoti, nome, sqA, 'fantapazz') : null;
    const vFM = fmVoti.length > 0 ? this._findPlayerVote(fmVoti, nome, sqA, 'fantamaster') : null;
    const vFC = fcVoti.length > 0 ? this._findPlayerVote(fcVoti, nome, sqA, 'fantacalcio') : null;

    const voteState = this._resolvePlayerVote({ Nome: nome, SquadraDiA: sqA, Ruolo: roleNum || rawRole }, ruoloFormatted);

    // Info stato partita/presenza nell'header
    const infoObj = vVU || vFC || vFP || vFM;
    let statusChip = '';
    if (infoObj && infoObj.Sostituzione === '1') {
      const minStr = infoObj.Minuto ? ` ${infoObj.Minuto}` : '';
      statusChip = infoObj.Titolare === '1' ? `Uscito${minStr}` : `Entrato${minStr}`;
    } else if (infoObj && infoObj.Titolare === '1') {
      statusChip = 'Titolare';
    } else if (teamStateVU === '0' || teamStateFP === '0' || teamStateFM === '0' || teamStateFC === '0') {
      statusChip = 'Gara in corso';
    } else if (teamStateVU === '1' || teamStateFP === '1' || teamStateFM === '1' || teamStateFC === '1') {
      statusChip = 'Terminata';
    }

    const vs = (typeof VotoSource !== 'undefined') ? Number(VotoSource) : 6;
    const rows = [];

    rows.push({
      key: 'gaz',
      name: 'Gazzetta dello Sport',
      isActive: hasTeamVotesVU && vs === 1,
      ...this._evaluateVuPaperRow(vVU, 'gaz', hasTeamVotesVU, roleNum, ruoloFormatted)
    });
    rows.push({
      key: 'cor',
      name: 'Corriere dello Sport',
      isActive: hasTeamVotesVU && vs === 2,
      ...this._evaluateVuPaperRow(vVU, 'cor', hasTeamVotesVU, roleNum, ruoloFormatted)
    });
    rows.push({
      key: 'tut',
      name: 'Tuttosport',
      isActive: hasTeamVotesVU && vs === 3,
      ...this._evaluateVuPaperRow(vVU, 'tut', hasTeamVotesVU, roleNum, ruoloFormatted)
    });

    if ([4, 5, 6].includes(vs)) {
      const mediaNames = {
        4: 'Media Gaz\u2013Cor',
        5: 'Media 3 Quotidiani',
        6: 'Media Gaz\u2013Cor (s.v. prevale)'
      };
      rows.push({
        key: 'vu',
        name: mediaNames[vs] || 'Media Quotidiani',
        isActive: hasTeamVotesVU,
        isSummary: true,
        ...this._formatModalVoteRow(vVU, roleNum, ruoloFormatted, {
          isFPFeed: false,
          treatMissingAsSV: hasTeamVotesVU
        })
      });
    }

    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));

    if (hasFC || vFC) {
      rows.push({
        key: 'fc',
        name: 'Fantacalcio.it',
        isActive: voteState.sourceUsed === 'fantacalcio',
        ...this._formatModalVoteRow(vFC, roleNum, ruoloFormatted, {
          isFPFeed: true,
          allowVirtualWait: teamStateFC === '0' && !vFC,
          treatMissingAsSV: hasTeamVotesFC && (teamStateFC === '1' || teamStateVU === '1')
        })
      });
    }

    if (hasFP || vFP) {
      rows.push({
        key: 'fp',
        name: 'Fantapazz',
        isActive: voteState.sourceUsed === 'fantapazz',
        ...this._formatModalVoteRow(vFP, roleNum, ruoloFormatted, {
          isFPFeed: true,
          allowVirtualWait: teamStateFP === '0' && !vFP,
          treatMissingAsSV: hasTeamVotesFP && (teamStateFP === '1' || teamStateVU === '1')
        })
      });
    }

    if (hasFM || vFM) {
      rows.push({
        key: 'fm',
        name: 'FantaMaster',
        isActive: voteState.sourceUsed === 'fantamaster',
        ...this._formatModalVoteRow(vFM, roleNum, ruoloFormatted, {
          isFPFeed: false,
          allowVirtualWait: teamStateFM === '0' && !vFM,
          treatMissingAsSV: hasTeamVotesFM && (teamStateFM === '1' || teamStateVU === '1')
        })
      });
    }

    const rowsHtml = rows.map(r => `
      <tr class="live-source-row${r.isActive ? ' is-active-source' : ''}${r.isSummary ? ' is-summary-source' : ''}">
        <th scope="row">
          <div class="live-source-cell">
            ${this._buildSourceLogoHtml(r.key)}
            <span class="live-source-name">${this._escapeHtml(r.name)}</span>
            ${r.isActive ? '<span class="live-source-active-pill">Attivo</span>' : ''}
          </div>
        </th>
        <td class="live-col-voto">${r.votoHtml}</td>
        <td class="live-col-fv">${r.fvHtml}</td>
        <td class="live-col-bm"><div class="live-modal-bonus-list">${r.bonusHtml}</div></td>
      </tr>
    `).join('');

    return `
      <div class="live-player-modal-card">
        <header class="live-player-modal-header">
          <div class="live-player-modal-identity">
            ${playerLink
              ? `<a href="${this._escapeAttr(playerLink)}" class="live-player-modal-photo-link" aria-label="Vai alla scheda di ${this._escapeAttr(nome)}" title="Vai alla scheda di ${this._escapeAttr(nome)}"><img src="${this._escapeAttr(photoSrc)}" data-fallback-src="img/foto/misterx.gif" class="live-player-modal-photo" alt=""></a>`
              : `<img src="${this._escapeAttr(photoSrc)}" data-fallback-src="img/foto/misterx.gif" class="live-player-modal-photo" alt="">`}
            <div class="live-player-modal-meta">
              <div class="live-player-modal-title-row">
                <span class="pr-ruolo role-${this._escapeAttr(ruoloFormatted)}">${this._escapeHtml(ruoloFormatted)}</span>
                <h2 id="livePlayerModalTitle" class="live-player-modal-name">${playerLink
                  ? `<a href="${this._escapeAttr(playerLink)}" class="live-player-modal-name-link" title="Vai alla scheda di ${this._escapeAttr(nome)}">${this._escapeHtml(nome)}</a>`
                  : this._escapeHtml(nome)}</h2>
              </div>
              <div class="live-player-modal-club-row">
                ${sqA ? `
                  <span class="live-player-modal-club">
                    ${teamLogoSrc ? `<img src="${this._escapeAttr(teamLogoSrc)}" data-fallback-src="${this._escapeAttr(teamShirtSrc)}" class="live-player-modal-teamlogo" alt="">` : ''}
                    <span>${this._escapeHtml(sqA)}</span>
                  </span>
                ` : ''}
                ${statusChip ? `<span class="live-player-modal-status">${this._escapeHtml(statusChip)}</span>` : ''}
              </div>
            </div>
          </div>
          <form method="dialog" class="live-player-modal-close-form">
            <button type="submit" value="close" class="calc-modal-close-btn" aria-label="Chiudi riepilogo voti">&times;</button>
          </form>
        </header>

        <div class="live-player-modal-body">
          <div tabindex="0" role="region" aria-labelledby="livePlayerModalTitle" class="live-player-table-wrap">
            <table class="live-player-sources-table">
              <thead>
                <tr>
                  <th scope="col">Testata</th>
                  <th scope="col">Voto</th>
                  <th scope="col">Fantavoto</th>
                  <th scope="col">Bonus / Malus</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <footer class="live-player-modal-footer">
          ${playerLink ? `<a href="${this._escapeAttr(playerLink)}" class="pill-btn live-player-modal-profile-link">Scheda Giocatore &rarr;</a>` : ''}
          <form method="dialog" class="live-player-modal-footer-form">
            <button type="submit" value="close" class="pill-btn active live-player-modal-close-btn">Chiudi</button>
          </form>
        </footer>
      </div>
    `;
  },

  async _triggerLazyModalFeedSync() {
    if (!this.currentDay) return;
    if (!this._lazyModalSyncedKeys) this._lazyModalSyncedKeys = {};

    const targets = [];
    const hasFP = (typeof fcmModules === 'undefined' || typeof fcmModules.hasliveFP !== 'function' || fcmModules.hasliveFP());
    const hasFM = (typeof fcmModules === 'undefined' || typeof fcmModules.hasLiveFM !== 'function' || fcmModules.hasLiveFM());
    const hasFC = (typeof fcmModules === 'undefined' || (typeof fcmModules.hasLiveFC === 'function' ? fcmModules.hasLiveFC() : (typeof ModLiveFantacalcio !== 'undefined' ? ModLiveFantacalcio === 'Si' : true)));
    const fpLoaded = this._liveDataStore && this._liveDataStore.fp && this._liveDataStore.fp.voti && this._liveDataStore.fp.voti.length > 0;
    const fmLoaded = this._liveDataStore && this._liveDataStore.fm && this._liveDataStore.fm.voti && this._liveDataStore.fm.voti.length > 0;
    const fcLoaded = this._liveDataStore && this._liveDataStore.fc && this._liveDataStore.fc.voti && this._liveDataStore.fc.voti.length > 0;

    if (hasFC && !fcLoaded) targets.push('fantacalcio');
    if (hasFP && !fpLoaded) targets.push('fantapazz');
    if (hasFM && !fmLoaded) targets.push('fantamaster');

    for (const prov of targets) {
      const key = `${this.currentDay}_${prov}`;
      if (this._lazyModalSyncedKeys[key]) continue;
      this._lazyModalSyncedKeys[key] = true;

      const isFM = prov === 'fantamaster';
      const isFC = prov === 'fantacalcio';
      const feedKey = isFM ? 'fm' : (isFC ? 'fc' : 'fp');
      const scriptUrl = isFM ? 'js/fcmVotiDatiFM.js' : (isFC ? 'js/fcmVotiDatiFC.js' : 'js/fcmVotiDatiFP.js');
      const metaUrl = isFM ? 'js/fcmVotiDatiFMMeta.json' : (isFC ? 'js/fcmVotiDatiFCMeta.json' : 'js/fcmVotiDatiFPMeta.json');

      let loadedFromFile = false;
      try {
        let isSameDay = true;
        if (typeof fetch !== 'undefined') {
          const metaRes = await fetch(`${metaUrl}?t=${Date.now()}`, { cache: 'no-store' });
          if (metaRes.ok) {
            const meta = await metaRes.json();
            const feedDay = isFM ? meta.giornataFM : (isFC ? meta.giornataFC : meta.giornataFP);
            if (feedDay && Number(feedDay) !== Number(this.currentDay)) {
              isSameDay = false;
            }
          } else {
            isSameDay = false;
          }
        }
        if (isSameDay && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
          await fcmDataLoader.loadScript(scriptUrl, true);
          const gV = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti.slice() : [];
          const gP = (typeof arrPartite !== 'undefined' && arrPartite) ? { ...arrPartite } : ((typeof arrStatoPartite !== 'undefined' && arrStatoPartite) ? { ...arrStatoPartite } : {});
          if (gV.length > 0) {
            if (!this._liveDataStore) {
              this._liveDataStore = { vu: { voti: [], partite: {} }, fp: { voti: [], partite: {} }, fm: { voti: [], partite: {} }, fc: { voti: [], partite: {} } };
            }
            this._liveDataStore[feedKey] = { voti: gV, partite: gP };
            if (this._liveDataStore.vu && this._liveDataStore.vu.voti.length > 0) {
              window.arrVoti = this._liveDataStore.vu.voti;
              window.arrPartite = this._liveDataStore.vu.partite;
            }
            loadedFromFile = true;
            const openModal = this.container && typeof this.container.querySelector === 'function'
              ? this.container.querySelector('#livePlayerModal')
              : null;
            if (openModal && openModal.open && this._activeModalPlayer) {
              openModal.innerHTML = this._renderPlayerModalContent(this._activeModalPlayer);
            }
          }
        }
      } catch (e) { }

      if (!loadedFromFile && this._hasMissingOfficialVotesForDay()) {
        await this._syncSecondaryLiveFeed(false, prov);
      }
    }
  },

  /**
   * Apre il modal nativo con il riepilogo multi-testata di un calciatore
   */
  apriModalGiocatore(player) {
    if (!player || !player.Nome) return;
    const modal = (this.container && typeof this.container.querySelector === 'function'
      ? this.container.querySelector('#livePlayerModal')
      : null) || (typeof document !== 'undefined' && typeof document.getElementById === 'function'
      ? document.getElementById('livePlayerModal')
      : null);
    if (!modal) return;

    this._activeModalPlayer = player;
    modal.innerHTML = this._renderPlayerModalContent(player);

    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal();
    } else if (typeof modal.setAttribute === 'function') {
      modal.setAttribute('open', '');
    }

    this._triggerLazyModalFeedSync();
  },

  /**
   * Pulizia all'uscita dalla rotta SPA
   */
  destroy() {
    this._stopSecondaryAutoRefresh();
    if (this._escHandler && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    const modalScope = this.container || (typeof document !== 'undefined' ? document : null);
    if (modalScope && typeof modalScope.querySelector === 'function') {
      const playerModal = modalScope.querySelector('#livePlayerModal');
      if (playerModal && playerModal.open && typeof playerModal.close === 'function') {
        playerModal.close();
      }
    }
    this._activeModalPlayer = null;
    this._lazyModalSyncedKeys = {};
    this.currentDay = null;
    this.currentMatch = 'all';
    this._liveDataStore = null;
    this._isManualRefreshPending = false;
    if (typeof FcmVotiLiveManager !== 'undefined') {
      FcmVotiLiveManager.destroy();
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = liveVotiView;
}
