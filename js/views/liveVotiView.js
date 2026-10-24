/**
 * LIVE VOTI VIEW (SPA Native)
 * Match Center Live integrato per Diretta Fantapazz (#liveFP), FantaMaster (#liveFM) e Voti Ufficiosi (#liveVU)
 * ModernFCM
 */

const liveVotiView = {
  currentSource: 'fantapazz', // 'fantapazz' (#liveFP) | 'fantamaster' (#liveFM) | 'pianetafanta' (#liveVU)
  currentDay: null,
  currentComp: 1,
  currentDiv: 0,
  currentMatch: 'all',
  cachedVotiSource: null,
  cachedVotiDay: null,
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
    let pId = null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieAPlayerId === 'function') {
      pId = fcmDataLoader.getSerieAPlayerId(nome);
    }
    return pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(nome)}`;
  },

  /**
   * Calcolo automatico del Fantavoto in base a regole e parametri di lega: delega a FCMCalcoloMotore
   */
  calcolaFantavoto(v, ruolo) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaFantavoto(v, ruolo, { isFP: (this.currentSource === 'fantapazz' || this.currentSource === 'fantamaster') });
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
    if (isNaN(num)) return v;
    return num.toFixed(2);
  },

  /**
   * Confronto nomi Fantapazz / PianetaFanta con FCM
   */
  matchPlayer(votoObj, nomeFCM, squadraFCM, isLiveMode) {
    if (!votoObj || !nomeFCM) return false;
    const vNome = votoObj.Nome || '';
    const vSquadra = votoObj.Squadra === 'Verona' ? 'Hellas Verona' : (votoObj.Squadra || '');
    const cleanFCM = squadraFCM === 'Verona' ? 'Hellas Verona' : squadraFCM;

    // Se esiste associazione customizzata
    if (typeof arrAssociazioni !== 'undefined' && arrAssociazioni && arrAssociazioni[vNome] === nomeFCM) {
      return vSquadra === cleanFCM;
    }

    if (this.currentSource === 'fantamaster') {
      if (vSquadra !== cleanFCM) return false;
      const vUpper = vNome.toUpperCase().trim();
      const fcmUpper = nomeFCM.toUpperCase().trim();
      if (vUpper === fcmUpper) return true;

      const cognomeFCM = this.formatCognome(nomeFCM).toUpperCase().trim();
      // Disambiguazione iniziale (es. "MALDINI D" o "RODRIGUEZ JU")
      const parts = vUpper.split(' ');
      if (parts.length > 1) {
        const fmSurname = parts[0];
        const fmInitial = parts[1];
        if (cognomeFCM.indexOf(fmSurname) > -1 || fmSurname.indexOf(cognomeFCM) > -1) {
          const restFCM = fcmUpper.replace(cognomeFCM, '').trim();
          if (!fmInitial || (restFCM && restFCM.startsWith(fmInitial.charAt(0)))) {
            return true;
          }
        }
      }
      if (cognomeFCM && vUpper === cognomeFCM) return true;
      if (cognomeFCM && (vUpper.indexOf(cognomeFCM) > -1 || cognomeFCM.indexOf(vUpper) > -1)) return true;
      if (fcmUpper.indexOf(vUpper) > -1 || vUpper.indexOf(fcmUpper) > -1) return true;
    } else if (this.currentSource === 'fantapazz') {
      if (isLiveMode === 1) {
        if ((nomeFCM.indexOf(vNome) > -1 || vNome.indexOf(nomeFCM) > -1) && vSquadra === cleanFCM) {
          return true;
        }
      } else {
        if (vNome === nomeFCM && vSquadra === cleanFCM) {
          return true;
        }
      }
    } else {
      // PianetaFanta
      if (vNome === nomeFCM && vSquadra === cleanFCM) {
        return true;
      }
      const cognomeFCM = this.formatCognome(nomeFCM);
      if (cognomeFCM && vNome.indexOf(cognomeFCM) > -1 && vSquadra === cleanFCM) {
        return true;
      }
      if (nomeFCM.indexOf(vNome) > -1 && vSquadra === cleanFCM) {
        return true;
      }
    }

    return false;
  },

  /**
   * Determina sorgente e parametri URL dall'hash corrente
   */
  _parseRouteState() {
    const hash = window.location.hash || '#liveFP';
    const lowerHash = hash.toLowerCase();
    if (lowerHash.startsWith('#livefm')) {
      this.currentSource = 'fantamaster';
    } else if (lowerHash.startsWith('#livevu')) {
      this.currentSource = 'pianetafanta';
    } else {
      this.currentSource = 'fantapazz';
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

    // Default giornata: prossima giornata da giocare (helper fcmDataLoader)
    if (!day) {
      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getUpcomingMatchday === 'function') {
        day = fcmDataLoader.getUpcomingMatchday();
      } else if (typeof GetProssimaGiornataDaGiocare === 'function') {
        day = GetProssimaGiornataDaGiocare();
      } else if (typeof fcmDataLoader !== 'undefined') {
        const cal = fcmDataLoader.getCalendarData();
        day = cal.nextMatchday > 0 ? cal.nextMatchday : (cal.lastPlayed > 0 ? cal.lastPlayed : 1);
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

    if (match !== null && match !== undefined && match !== '') {
      this.currentMatch = match;
    } else if (!hash.includes('?')) {
      // Navigazione interna senza query string: mantiene incontro o 'all' già impostato
      this.currentMatch = this.currentMatch || 'all';
    } else {
      // Query string esplicita ma senza Match: tutti gli incontri
      this.currentMatch = 'all';
    }
  },

  /**
   * Inizializzazione e rendering principale della vista
   */
  async render(container) {
    this.container = container;
    this._parseRouteState();

    // Visualizza loader iniziale elegante
    container.innerHTML = `
      <div class="fantam-wrapper" style="padding: 60px 0; text-align: center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:${this.currentSource === 'fantamaster' ? 'rgba(16,185,129,0.12)' : (this.currentSource === 'fantapazz' ? 'rgba(239,68,68,0.12)' : 'rgba(6,182,212,0.12)')};color:${this.currentSource === 'fantamaster' ? '#10b981' : (this.currentSource === 'fantapazz' ? '#ef4444' : 'var(--accent-cyan,#06b6d4)')};margin-bottom:14px;">
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
          Caricamento ${this.currentSource === 'fantamaster' ? 'Live FantaMaster' : (this.currentSource === 'fantapazz' ? 'Live Fantapazz' : 'Voti Ufficiosi')}...
        </div>
      </div>
    `;

    // Carica gli script di supporto necessari
    await this._loadRequiredScripts();

    // Renderizza shell grafica e controlli
    this._renderShell();
    this._bindEvents();

    // Compila e inietta la tabella degli incontri
    this.renderOutput();

    // Inizializza FcmVotiLiveManager con callback onSuccess SPA in-page
    this._initLiveManager();
  },

  /**
   * Caricamento asincrono file formazioni, voti e associazioni
   */
  async _loadRequiredScripts() {
    if (typeof fcmDataLoader === 'undefined') return;

    // 1. Dati Formazioni della giornata selezionata e dettaglio giocatori Serie A
    try {
      if (typeof arrGiocatoriA === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
      }
      if (typeof fcmDataLoader.loadMatchdayLineups === 'function') {
        await fcmDataLoader.loadMatchdayLineups(this.currentDay, true);
      }
      // Forza sempre il ricaricamento del file formazioni della giornata per aggiornare arrFormazioni globale
      await fcmDataLoader.loadScript(`js/fcmFormazioniDati${this.currentDay}.js`, true);
    } catch (e) {
      console.warn(`[liveVotiView] Impossibile caricare formazioni giornata ${this.currentDay}:`, e);
    }

    // 2. Associazioni nomi giocatori
    try {
      await fcmDataLoader.loadScript('js/fcmVotiAssociazioni.js');
    } catch (e) { }

    // 3. Variabili Calcolo Risultati (per parametri punteggi e modificatori)
    try {
      await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js');
    } catch (e) { }

    // 4. File Dati Voti specifico (FP, FM o VU)
    let targetVotiFile = 'js/fcmVotiDatiVU.js';
    if (this.currentSource === 'fantamaster') {
      targetVotiFile = 'js/fcmVotiDatiFM.js';
    } else if (this.currentSource === 'fantapazz') {
      targetVotiFile = 'js/fcmVotiDatiFP.js';
    }

    try {
      await fcmDataLoader.loadScript(targetVotiFile, true);
    } catch (e) {
      try {
        await fcmDataLoader.loadScript('js/fcmVotiDati.js');
      } catch (err) { }
    }
  },

  /**
   * Renderizza la shell grafica (Header, Pill Switcher, Barra Filtri, Banner, Output Container)
   */
  _renderShell() {
    const isFP = this.currentSource === 'fantapazz';
    const isFM = this.currentSource === 'fantamaster';
    const isVU = !isFP && !isFM;

    let themeColor = '#06b6d4';
    let sourceTitle = 'Voti Ufficiosi PianetaFanta';
    let sourceDesc = 'Voti ufficiosi e bonus/malus per calcolo manuale.';

    if (isFM) {
      themeColor = '#10b981';
      sourceTitle = 'Live FantaMaster';
      sourceDesc = 'Voti in tempo reale, bonus/malus ed eventi live da FantaMaster.';
    } else if (isFP) {
      themeColor = '#ef4444';
      sourceTitle = 'Live Fantapazz';
      sourceDesc = 'Voti in tempo reale, bonus/malus e sostituzioni da Fantapazz.';
    }

    this.container.innerHTML = `
      <div class="fantam-wrapper live-voti-wrapper">

        <!-- CARD HEADER PRINCIPALE -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div class="card-title" style="display: flex; align-items: center; gap: 10px; font-size: 1.25rem;">
                <span class="live-title-icon" style="display:inline-flex;align-items:center;justify-content:center;color:${themeColor};">
                  ${isFM ? `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="12 6 15 12 12 18 9 12 12 6"></polygon>
                    </svg>
                  ` : (isFP ? `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  ` : `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  `)}
                </span>
                <span id="liveMainTitle">${sourceTitle}</span>
                <span class="badge" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; background: ${isFM ? 'rgba(16, 185, 129, 0.15)' : (isFP ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)')}; color: ${themeColor}; font-weight: 700;">
                  ${this.currentDay}&ordf; Giornata
                </span>
              </div>
              <div class="card-subtitle" style="margin-top: 4px;">
                ${sourceDesc}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="btnLiveLegenda" class="btn-live-action">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Legenda</span>
              </button>
              <button type="button" id="btnLiveRefresh" class="btn-live-action">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Aggiorna</span>
              </button>
              <a href="#calcolo?Comp=${this.currentComp}&Gio=${this.currentDay}${this.currentDiv ? '&Div=' + this.currentDiv : ''}${(this.currentMatch && this.currentMatch !== 'all') ? '&Match=' + this.currentMatch : ''}" id="btnLiveGoCalcolo" class="btn-live-action">
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

          <!-- TAB SWITCHER A PILLOLA (Fantapazz ↔ FantaMaster ↔ PianetaFanta - Stile Scelte Rapide) -->
          <div style="padding: 0 18px 16px;">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
              Sorgente Voti Live
            </div>
            <div class="pill-tabs" id="liveSourceTabGroup" style="display:inline-flex;align-items:center;gap:6px;max-width:100%;flex-wrap:wrap;margin-bottom:0;">
              <button 
                type="button" 
                class="pill-btn ${isFP ? 'active' : ''}" 
                data-source="fantapazz" 
                data-hash="#liveFP"
                style="display:inline-flex;align-items:center;gap:7px;${isFP ? 'border-color:#ef4444 !important;color:#ef4444 !important;' : ''}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Live Fantapazz</span>
              </button>
              <button 
                type="button" 
                class="pill-btn ${isFM ? 'active' : ''}" 
                data-source="fantamaster" 
                data-hash="#liveFM"
                style="display:inline-flex;align-items:center;gap:7px;${isFM ? 'border-color:#10b981 !important;color:#10b981 !important;' : ''}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="12 6 15 12 12 18 9 12 12 6"></polygon>
                </svg>
                <span>Live FantaMaster</span>
              </button>
              <button 
                type="button" 
                class="pill-btn ${isVU ? 'active' : ''}" 
                data-source="pianetafanta" 
                data-hash="#liveVU"
                style="display:inline-flex;align-items:center;gap:7px;${isVU ? 'border-color:#06b6d4 !important;color:#06b6d4 !important;' : ''}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>Voti Ufficiosi</span>
              </button>
            </div>
          </div>
        </div>

        <!-- CONTROLLI FILTRO (Stile identico alle pagine Formazioni e Risultati) -->
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

        <!-- PROGRESS BAR E MONITORAGGIO TIMEOUT API -->
        <div id="liveProgressContainer" style="display: none; margin-bottom: 16px;"></div>

        <!-- BANNER STATO CACHE / NOTIFICHE -->
        <div id="vuCacheNoticeContainer" style="margin-bottom: 16px;"></div>
        <div id="fpDayNoticeContainer" style="margin-bottom: 16px;"></div>

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
                <span>Legenda Eventi</span>
              </h3>
              <button type="button" id="btnCloseLegenda" class="calc-modal-close-btn" aria-label="Chiudi">&times;</button>
            </div>
            <div class="calc-modal-body">
              <div class="legenda-chips-container" style="margin-bottom: 0; gap: 8px;">
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
                <span class="legenda-chip" style="font-weight: 700;"><span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#ef4444; margin-right:4px;"></span><strong style="color:#ef4444;">Rosso:</strong> In Corso</span>
                <span class="legenda-chip" style="font-weight: 700;"><span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#94a3b8; margin-right:4px;"></span><strong style="color:var(--text-muted, #64748b);">Grigio:</strong> Terminata</span>
              </div>
            </div>
            <div style="margin-top: 18px; text-align: right; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.1)); padding-top: 12px;">
              <button type="button" id="btnCloseLegendaBtn" class="btn-live-action" style="cursor: pointer;">Chiudi</button>
            </div>
          </div>
        </div>

        <!-- MODAL CALCOLO RISULTATO VELOCE -->
        <div id="calcModal" class="calc-modal-backdrop" style="display: none;" role="dialog"></div>

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
    // 1. Switcher sorgente dati (Fantapazz ↔ PianetaFanta)
    const tabButtons = this.container.querySelectorAll('.pill-btn[data-source]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetSrc = btn.getAttribute('data-source');
        if (targetSrc === this.currentSource) return;
        const targetHash = btn.getAttribute('data-hash') || (targetSrc === 'fantapazz' ? '#liveFP' : (targetSrc === 'fantamaster' ? '#liveFM' : '#liveVU'));
        const matchParam = (this.currentMatch && this.currentMatch !== 'all') ? `&Match=${this.currentMatch}` : '';
        const divParam = this.currentDiv ? `&Div=${this.currentDiv}` : '';
        const newHash = `${targetHash}?Gio=${this.currentDay}&Comp=${this.currentComp}${divParam}${matchParam}`;
        window.location.hash = newHash;
      });
    });

    // 2. Selettore Competizione
    const selComp = this.container.querySelector('#liveSelComp');
    if (selComp) {
      selComp.addEventListener('change', () => {
        this.currentComp = parseInt(selComp.value, 10) || 1;
        this._updateHashAndRefresh();
      });
    }

    // 3. Selettore Divisione
    const selDiv = this.container.querySelector('#liveSelDiv');
    if (selDiv) {
      selDiv.addEventListener('change', () => {
        this.currentDiv = parseInt(selDiv.value, 10) || 0;
        this._updateHashAndRefresh();
      });
    }

    // 4. Selettore Giornata
    const selDay = this.container.querySelector('#liveSelDay');
    if (selDay) {
      selDay.addEventListener('change', async () => {
        this.currentDay = parseInt(selDay.value, 10) || 1;
        this._updateHashAndRefresh();
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
      });
    }

    // 6. Pulsante Refresh Live
    const btnRefresh = this.container.querySelector('#btnLiveRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        if (typeof FcmVotiLiveManager !== 'undefined') {
          FcmVotiLiveManager.startExtraction(true, true);
        }
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleLegenda(false);
        this.chiudiModalCalcolo();
      }
    });

    // 8. Modale Calcolo click backdrop
    const calcModal = this.container.querySelector('#calcModal');
    if (calcModal) {
      calcModal.addEventListener('click', (e) => {
        if (e.target === calcModal) this.chiudiModalCalcolo();
      });
    }
  },

  /**
   * Sincronizza l'URL hash con i parametri correnti (mantenendo Match se valorizzato)
   */
  _updateHashState() {
    const baseHash = this.currentSource === 'fantapazz' ? '#liveFP' : (this.currentSource === 'fantamaster' ? '#liveFM' : '#liveVU');
    const matchParam = (this.currentMatch && this.currentMatch !== 'all') ? `&Match=${this.currentMatch}` : '';
    const divParam = this.currentDiv ? `&Div=${this.currentDiv}` : '';
    const newHash = `${baseHash}?Gio=${this.currentDay}&Comp=${this.currentComp}${divParam}${matchParam}`;

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', newHash);
    } else {
      window.location.hash = newHash;
    }
  },

  /**
   * Aggiorna il link al Calcolo nell'header (passa l'incontro selezionato se presente)
   */
  _updateCalcoloLink() {
    const linkCalcolo = this.container ? this.container.querySelector('#btnLiveGoCalcolo') : null;
    if (!linkCalcolo) return;
    const divPart = this.currentDiv ? `&Div=${this.currentDiv}` : '';
    const matchPart = (this.currentMatch && this.currentMatch !== 'all') ? `&Match=${this.currentMatch}` : '';
    linkCalcolo.href = `#calcolo?Comp=${this.currentComp}&Gio=${this.currentDay}${divPart}${matchPart}`;
  },

  /**
   * Aggiorna hash URL e ricarica i dati della giornata
   */
  async _updateHashAndRefresh() {
    this._updateHashState();

    // Ricarica formazioni e voti per la giornata selezionata
    await this._loadRequiredScripts();

    // Aggiorna header info
    const mainTitle = this.container.querySelector('#liveMainTitle');
    if (mainTitle) {
      mainTitle.textContent = this.currentSource === 'fantapazz' ? 'Live Fantapazz' : (this.currentSource === 'fantamaster' ? 'Live FantaMaster' : 'Voti Ufficiosi');
    }

    // Ri-renderizza il tabellone
    this.renderOutput();

    // Aggiorna link calcolo nell'header
    this._updateCalcoloLink();

    // Re-inizializza il manager per la nuova giornata
    this._initLiveManager();
  },

  /**
   * Inizializzazione integrata di FcmVotiLiveManager per la SPA
   */
  _initLiveManager() {
    if (typeof FcmVotiLiveManager === 'undefined') return;

    const isFP = this.currentSource === 'fantapazz';
    const isFM = this.currentSource === 'fantamaster';
    const isLive = isFP || isFM;

    window.cGio = this.currentDay;
    window.cComp = this.currentComp;
    window.cDiv = this.currentDiv;
    window.cLive = isLive ? 1 : 0;

    FcmVotiLiveManager.init({
      source: this.currentSource,
      endpoint: isFM ? 'inc/live_extractFM.php' : (isFP ? 'inc/live_extractFP.php' : 'inc/live_extractVU.php'),
      sourceName: isFM ? 'FantaMaster' : (isFP ? 'Fantapazz.com' : 'PianetaFanta.it'),
      sourceTypeDesc: isFM ? 'Voti Live (FantaMaster)' : (isFP ? 'Voti Live (Fantapazz)' : 'Voti Ufficiosi'),
      giornata: this.currentDay,
      containerId: 'liveProgressContainer',
      outputId: 'outputContainer',
      themeClass: isFM ? 'theme-fantamaster' : (isFP ? '' : 'theme-ufficiosi'),
      onSuccess: () => {
        // Callback asincrona in-page: re-renderizza il tabellone istantaneamente
        this.renderOutput();
      }
    });
  },

  /**
   * Helper per estrazione incontri di giornata da fcmDataLoader (senza dipendere da fcmCalendarioFunzioni.js)
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
   * Helper per estrazione e ordinamento formazione senza dipendere da fcmFormazioniFunzioni.js
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

    // Separa e ordina: titolari (Pos === 0 per ruolo), panchina (Pos > 0 per Pos e ruolo), tribuna (Pos === -1 per ruolo)
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
   * Compilazione e iniezione del tabellone incontri
   */
  renderOutput() {
    const outContainer = this.container.querySelector('#outputContainer');
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

    // Gestione Gran Premio vs Partita Standard
    if (giornata[1].IDTipo === INC_GRANPREMIO) {
      outContainer.innerHTML = this._generateGrandPrixHtml(giornata);
    } else {
      outContainer.innerHTML = this._generateMatchesHtml(giornata);
    }

    // Applica eventuale filtro singolo incontro
    this._filterVisibleMatches();
  },

  /**
   * Aggiorna le voci della select Incontro
   */
  _updateMatchSelector(giornata) {
    const selMatch = this.container.querySelector('#liveSelMatch');
    if (!selMatch) return;

    const count = (giornata && giornata.length > 1) ? (giornata.length - 1) : 0;
    let html = `<option value="all">Tutti gli incontri (${count})</option>`;
    let matchedId = null;

    if (giornata && giornata.length > 1) {
      // 1. Controlla se this.currentMatch corrisponde all'ID univoco o all'indice 1-based di un incontro
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

      if (matchedId) {
        this.currentMatch = matchedId;
      } else if (this.currentMatch !== 'all') {
        this.currentMatch = 'all';
      }

      // 2. Popola le opzioni con l'ID incontro come valore
      for (let z = 1; z < giornata.length; z++) {
        const m = giornata[z];
        if (!m || !m.Nomi) continue;
        const val = String(m.ID);
        const isSel = (this.currentMatch === val) ? 'selected' : '';
        const compSuffix = m.Competizione ? ` (${m.Competizione})` : '';
        html += `<option value="${val}" ${isSel}>${m.Nomi.Casa} vs ${m.Nomi.Fuori}${compSuffix}</option>`;
      }
    } else {
      this.currentMatch = 'all';
    }

    selMatch.innerHTML = html;
    selMatch.value = this.currentMatch;

    // Sincronizza il link al Calcolo
    this._updateCalcoloLink();
  },

  /**
   * Filtra gli incontri visualizzati in base alla select
   */
  _filterVisibleMatches() {
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
   * Generatore HTML per incontri Standard (Testa a Testa)
   */
  _generateMatchesHtml(giornata) {
    let html = '';
    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;
    const isFP = this.currentSource === 'fantapazz';
    const isFM = this.currentSource === 'fantamaster';
    const isLive = isFP || isFM;
    const votiArr = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti : [];

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

      // Moduli tattici calcolati
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

      html += `
        <div class="match-block" id="match-block-${z}" data-match-idx="${z}" data-match-id="${pId}">
          <div class="match-container">

            <!-- INTESTAZIONE UNIFICATA SQUADRE E CALCOLATRICE CENTRALE -->
            <div class="match-teams-header">
              <div class="team-header-box home" id="sqc_${z}">
                <img src="${logoCasa}" class="team-header-shirt" alt="${match.Nomi.Casa}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                <div class="team-header-text">
                  <span class="team-header-name" title="${match.Nomi.Casa}">${match.Nomi.Casa}</span>
                  <span class="team-header-modulo">${moduloCasaStr}</span>
                </div>
              </div>

              ${!isLive ? `
                <div class="match-header-center">
                  <button type="button" class="btn-cross-calcolo" onclick="liveVotiView.apriModalCalcolo(${z})" title="Calcolo Veloce (${match.Nomi.Casa} - ${match.Nomi.Fuori})" aria-label="Calcolo Veloce">
                    <svg viewBox="0 0 48 48" width="100%" height="100%" style="display:block;">
                      <defs>
                        <linearGradient id="cbg${z}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
                        <linearGradient id="ccy${z}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
                        <linearGradient id="cgd${z}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>
                      </defs>
                      <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#cbg${z})" stroke="rgba(56, 189, 248, 0.5)" stroke-width="2"/>
                      <rect x="8" y="7" width="32" height="11" rx="4" fill="#082f49" stroke="#38bdf8" stroke-width="1.2"/>
                      <text x="36" y="16" fill="#38bdf8" font-family="sans-serif" font-size="8.5" font-weight="800" text-anchor="end">72.5</text>
                      <rect x="8" y="22" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="11.5" y="26.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">7</text>
                      <rect x="17" y="22" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="20.5" y="26.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">8</text>
                      <rect x="26" y="22" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="29.5" y="26.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">9</text>
                      <rect x="34" y="22" width="6" height="6" rx="2" fill="url(#ccy${z})"/><text x="37" y="26.8" fill="#0f172a" font-family="sans-serif" font-size="6" font-weight="800" text-anchor="middle">&divide;</text>
                      <rect x="8" y="30" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="11.5" y="34.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">4</text>
                      <rect x="17" y="30" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="20.5" y="34.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">5</text>
                      <rect x="26" y="30" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="29.5" y="34.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">6</text>
                      <rect x="34" y="30" width="6" height="6" rx="2" fill="url(#ccy${z})"/><text x="37" y="34.8" fill="#0f172a" font-family="sans-serif" font-size="6" font-weight="800" text-anchor="middle">&times;</text>
                      <rect x="8" y="38" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="11.5" y="42.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">1</text>
                      <rect x="17" y="38" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="20.5" y="42.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">2</text>
                      <rect x="26" y="38" width="7" height="6" rx="2" fill="#1e293b" stroke="rgba(255,255,255,0.2)"/><text x="29.5" y="42.8" fill="#e2e8f0" font-family="sans-serif" font-size="5" font-weight="700" text-anchor="middle">3</text>
                      <rect x="34" y="38" width="6" height="6" rx="2" fill="url(#cgd${z})"/><text x="37" y="42.8" fill="#0f172a" font-family="sans-serif" font-size="6" font-weight="800" text-anchor="middle">=</text>
                    </svg>
                  </button>
                </div>
              ` : `
                <div class="match-header-center">
                  <span class="match-vs-badge">VS</span>
                </div>
              `}

              <div class="team-header-box away" id="sqf_${z}">
                <img src="${logoFuori}" class="team-header-shirt" alt="${match.Nomi.Fuori}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                <div class="team-header-text">
                  <span class="team-header-name" title="${match.Nomi.Fuori}">${match.Nomi.Fuori}</span>
                  <span class="team-header-modulo">${moduloFuoriStr}</span>
                </div>
              </div>
            </div>

            <!-- GRIGLIA FORMAZIONI (CASA / FUORI) -->
            <div class="match-body-grid">
              <div class="col-casa">
                ${this._renderTeamPlayerRows(formCasa, maxRis, pId, votiArr, isLive, 'casa')}
              </div>
              <div class="col-fuori">
                ${this._renderTeamPlayerRows(formFuori, maxRis, pId, votiArr, isLive, 'fuori')}
              </div>
            </div>

          </div>

          ${!isLive ? `
            <!-- PULSANTE CALCOLO VELOCE IN CALCE AL MATCH (SOLO LIVE VU) -->
            <div class="match-calc-footer">
              <button type="button" class="btn-calcolo-veloce" onclick="liveVotiView.apriModalCalcolo(${z})" title="Calcolo Veloce (${match.Nomi.Casa} - ${match.Nomi.Fuori})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="18"></line>
                  <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
                </svg>
                <span>Calcolo Veloce (${match.Nomi.Casa} - ${match.Nomi.Fuori})</span>
              </button>
            </div>
          ` : ''}

        </div>
      `;
    }

    return html;
  },

  /**
   * Generatore HTML per righe titolari e riserve di una squadra
   */
  _renderTeamPlayerRows(formazione, maxRis, partitaId, votiArr, isFP, side) {
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

      const pNome = pl.Nome || '';
      const pSquadraDiA = pl.SquadraDiA || '';
      const pRuolo = this.formatRuolo(pl.Ruolo);
      const uniqueId = `${partitaId}_${pl.Pos}_${g}`;

      // Cerca voto corrispondente in arrVoti
      const matchedVote = this._findPlayerVote(votiArr, pNome, pSquadraDiA, isFP);

      rowsHtml += this._generatePlayerRowHtml(pl, pRuolo, matchedVote, uniqueId, isFP);
      g++;
    }

    return rowsHtml;
  },

  /**
   * Restituisce lo stato globale della partita per la squadra di Serie A:
   * '1' = Terminata, '0' = In corso, '' = Non ancora iniziata
   */
  getTeamMatchState(squadra) {
    if (!squadra) return '';
    const cleanSq = (squadra === 'Verona' ? 'Hellas Verona' : squadra).trim().toLowerCase();

    // 1. Cerca nella mappa globale esportata (arrStatoPartite o arrPartite)
    const statoMap = (typeof arrStatoPartite !== 'undefined' && arrStatoPartite)
      ? arrStatoPartite
      : ((typeof arrPartite !== 'undefined' && arrPartite) ? arrPartite : null);

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

    // 2. Fallback resiliente: controlla se in arrVoti ci sono voti di quella squadra con Finale valorizzato
    const votiArr = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti : [];
    for (let i = 0; i < votiArr.length; i++) {
      const v = votiArr[i];
      if (!v || !v.Squadra) continue;
      const vSq = (v.Squadra === 'Verona' ? 'Hellas Verona' : v.Squadra).trim().toLowerCase();
      if (vSq === cleanSq) {
        if (v.Finale === '1' || v.Finale === '0') {
          return String(v.Finale);
        }
      }
    }

    return '';
  },

  /**
   * Ricerca voto giocatore in arrVoti
   */
  _findPlayerVote(votiArr, nomeFCM, squadraFCM, isFP) {
    if (!votiArr || votiArr.length === 0 || !nomeFCM) return null;
    const isLive = isFP ? 1 : 0;

    for (let w = 0; w < votiArr.length; w++) {
      const v = votiArr[w];
      if (!v) continue;
      if (this.matchPlayer(v, nomeFCM, squadraFCM, isLive)) {
        return v;
      }
    }
    return null;
  },

  /**
   * Genera il singolo frammento HTML per la riga giocatore
   */
  _generatePlayerRowHtml(player, ruoloFormatted, matchedVote, uniqueId, isFP) {
    const nomeCompleto = player.Nome;
    const cognome = this.formatCognome(player.Nome);
    const photoSrc = this.getPlayerPhoto(player.Nome);
    const magliaSrc = `img/live/sq/${player.SquadraDiA}.png`;
    const playerLink = this.getPlayerLink(player.Nome);

    // Stato partita globale della squadra (1 = Terminata, 0 = In corso, '' = Non iniziata)
    const teamState = this.getTeamMatchState(player.SquadraDiA);
    const isTerminata = (teamState === '1') || (matchedVote && matchedVote.Finale === '1');
    const isInCorso = !isTerminata && ((teamState === '0') || (matchedVote && matchedVote.Finale === '0'));
    const isNonIniziata = !isTerminata && !isInCorso;

    let subBadge = '';
    let bonusBadges = '';
    let votoVal = 'SV';
    let fvVal = 'SV';
    let liveColorClass = '';
    let votiBoxClass = '';

    if (isNonIniziata) {
      // Partita non ancora iniziata: trattini (&ndash;) al posto di voto e fantavoto
      votoVal = '&ndash;';
      fvVal = '&ndash;';
      votiBoxClass = 'live-non-iniziata';
    } else if (isTerminata) {
      // Partita terminata: colora di grigio (.live-terminata) sia nome che voti (anche per assenti da arrVoti)
      liveColorClass = 'live-terminata';
      if (matchedVote) {
        if (matchedVote.Sostituzione === '1') {
          const isTit = matchedVote.Titolare === '1';
          const subIcon = isTit ? 'uscito_s.png' : 'entrato_s.png';
          const minStr = matchedVote.Minuto ? `${matchedVote.Minuto}` : '';
          const subTitle = isTit ? `Sostituzione: Uscito${minStr ? ` al ${minStr}` : ''}` : `Sostituzione: Entrato${minStr ? ` al ${minStr}` : ''}`;
          subBadge = `
            <div class="pr-sub">
              <img src="img/live/${subIcon}" alt="${subTitle}" title="${subTitle}">
              <span class="pr-sub-min">${minStr}</span>
            </div>`;
        }
        bonusBadges = this._generateBonusBadgesHtml(matchedVote, isFP, ruoloFormatted);
        votoVal = this.formatVoto(matchedVote.Voto);
        const calculatedFv = this.calcolaFantavoto(matchedVote, player.Ruolo);
        fvVal = this.formatVoto(calculatedFv);
      } else {
        votoVal = 'SV';
        fvVal = 'SV';
      }
    } else if (isInCorso) {
      // Partita in corso
      if (matchedVote) {
        liveColorClass = 'live-in-corso';
        if (matchedVote.Sostituzione === '1') {
          const isTit = matchedVote.Titolare === '1';
          const subIcon = isTit ? 'uscito_s.png' : 'entrato_s.png';
          const minStr = matchedVote.Minuto ? `${matchedVote.Minuto}` : '';
          const subTitle = isTit ? `Sostituzione: Uscito${minStr ? ` al ${minStr}` : ''}` : `Sostituzione: Entrato${minStr ? ` al ${minStr}` : ''}`;
          subBadge = `
            <div class="pr-sub">
              <img src="img/live/${subIcon}" alt="${subTitle}" title="${subTitle}">
              <span class="pr-sub-min">${minStr}</span>
            </div>`;
        }
        bonusBadges = this._generateBonusBadgesHtml(matchedVote, isFP, ruoloFormatted);
        votoVal = this.formatVoto(matchedVote.Voto);
        const calculatedFv = this.calcolaFantavoto(matchedVote, player.Ruolo);
        fvVal = this.formatVoto(calculatedFv);
      } else {
        votoVal = 'SV';
        fvVal = 'SV';
      }
    }

    return `
      <div class="player-row">
        <div class="pr-side">
          <div class="pr-avatar">
            <span class="pr-ruolo role-${ruoloFormatted}">${ruoloFormatted}</span>
            <img src="${magliaSrc}" class="pr-maglia" alt="${player.SquadraDiA}" title="${player.SquadraDiA}" onerror="this.src='img/sq/0.gif'">
          </div>
          <img src="${photoSrc}" class="pr-foto-live" alt="${player.Nome}" title="${player.Nome} (${ruoloFormatted})" loading="lazy" onerror="this.src='img/foto/misterx.gif'">
          <div class="pr-details">
            <div class="pr-name-row">
              ${playerLink ? `
                <a href="${playerLink}" class="pr-nome ${liveColorClass}" title="Apri scheda di ${nomeCompleto}">
                  <span class="pr-name-full">${nomeCompleto}</span>
                  <span class="pr-name-short">${cognome}</span>
                </a>
              ` : `
                <div class="pr-nome ${liveColorClass}" title="${nomeCompleto}">
                  <span class="pr-name-full">${nomeCompleto}</span>
                  <span class="pr-name-short">${cognome}</span>
                </div>
              `}
              ${subBadge}
            </div>
            <div class="pr-bonus" id="par${uniqueId}">
              ${bonusBadges}
            </div>
          </div>
        </div>

        <div class="pr-voti-box ${(isInCorso && matchedVote) ? 'live-in-corso' : ''}">
          <div class="pr-voto ${liveColorClass || votiBoxClass}">${votoVal}</div>
          <div class="pr-voto-divisore"></div>
          <div class="pr-fv ${liveColorClass || votiBoxClass}">${fvVal}</div>
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
    const gF = Number(v.GolFatto || 0);
    const gS = Number(v.GolSubito || 0);
    const rig = Number(v.Rigore || 0);
    const rPar = Number(v.RigoreParato || 0);
    const rSba = Number(v.RigoreSbagliato || 0);
    const autoG = Number(v.AutoGol || 0);
    const ass = Number(v.Assist || 0);

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
    const isLive = this.currentSource === 'fantapazz' || this.currentSource === 'fantamaster';
    const votiArr = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti : [];

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
                ${this._renderTeamPlayerRows(formCasa, maxRis, pId, votiArr, isLive, 'casa')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return html;
  },

  /**
   * Calcolo Veloce Risultato e Apertura Modale
   */
  async apriModalCalcolo(matchIdx) {
    const modal = this.container.querySelector('#calcModal');
    if (!modal) return;

    // Assicura che le variabili di lega siano caricate da fcmCalcolorisultatiVariabili.js
    if (typeof fattorecampo === 'undefined' || typeof modD === 'undefined' || typeof modC === 'undefined' || typeof modA === 'undefined' || typeof autoGol === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js');
      } catch (e) {
        console.warn('[liveVotiView] Errore caricamento fcmCalcolorisultatiVariabili.js:', e);
      }
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

    // Estrazione dati per calcolo
    const dataCasa = this._estraiDatiCalcolo(formCasa);
    const dataFuori = this._estraiDatiCalcolo(formFuori);

    // Esecuzione sostituzioni (pMaxS, pMaxRisU, pRisUP, pRisU)
    const sostCasa = this._eseguiSostituzioni(dataCasa);
    const sostFuori = this._eseguiSostituzioni(dataFuori);

    // Calcolo somme parziali
    let sommaCasa = 0;
    let sommaFuori = 0;
    sostCasa.attivi.forEach(p => { sommaCasa += p.fantavoto; });
    sostFuori.attivi.forEach(p => { sommaFuori += p.fantavoto; });

    // Fattore campo condizionato dal tipo incontro (delega a FCMCalcoloMotore)
    const fCampo = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaFattoreCampo(match.IDTipo)
      : (typeof fattorecampo !== 'undefined' ? Number(fattorecampo) : 2);

    // Modificatori (uguali all'algoritmo ufficiale FCM di calcolo.php / fcmCalcolorisultatiFunzioni.js)
    const mods = this._calcolaModificatori(sostCasa.attivi, sostFuori.attivi);

    // Totali: modDifesaFuori applicato a Casa, modDifesaCasa applicato a Fuori (come da regolamento FCM)
    const totali = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaTotaliSquadre(sommaCasa, sommaFuori, mods, fCampo)
      : {
        totaleCasa: Number((sommaCasa + fCampo + mods.modPortiereCasa + mods.modDifesaFuori + mods.modCentroCasa + mods.modAttaccoCasa).toFixed(2)),
        totaleFuori: Number((sommaFuori + mods.modPortiereFuori + mods.modDifesaCasa + mods.modCentroFuori + mods.modAttaccoFuori).toFixed(2))
      };
    const totaleCasa = totali.totaleCasa;
    const totaleFuori = totali.totaleFuori;

    const gol = this._calcolaGol(totaleCasa, totaleFuori);

    const formatSign = (val) => (val > 0 ? `+${val}` : `${val}`);
    const hasModX = typeof modX !== 'undefined' && (modX === 1 || modX === '1');
    const isAutoGolActive = typeof autoGol !== 'undefined' && (autoGol === 1 || autoGol === '1' || autoGol === true);
    const pAutogol_val = typeof pAutogol !== 'undefined' ? Number(pAutogol) : 59;
    const pScarAutogol_val = typeof pScarAutogol !== 'undefined' ? Number(pScarAutogol) : 3;

    modal.innerHTML = `
      <div class="calc-modal-card" style="max-width: 600px;">
        <div class="calc-modal-header">
          <h3 class="calc-modal-title">Simulazione Risultato</h3>
          <button type="button" class="calc-modal-close-btn" id="btnCloseCalcModalLive" aria-label="Chiudi">&times;</button>
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
            ${isAutoGolActive ? `<tr>
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
   * Estrae i dati calcolo da una formazione
   */
  _estraiDatiCalcolo(formArr) {
    const titolari = [];
    const panchina = [];
    if (!formArr || formArr.length <= 1) return { titolari, panchina };

    const votiArr = (typeof arrVoti !== 'undefined' && Array.isArray(arrVoti)) ? arrVoti : [];
    const maxRis = (typeof totaleNumeroMassimoRiserve !== 'undefined' && totaleNumeroMassimoRiserve >= 0)
      ? totaleNumeroMassimoRiserve + 11
      : 21;
    const isLive = this.currentSource === 'fantapazz' || this.currentSource === 'fantamaster';

    let g = 1;
    for (let h = 1; h < formArr.length; h++) {
      if (g <= maxRis && formArr[h].Pos !== -1) {
        const rawRuolo = formArr[h].Ruolo;
        const ruoloNum = Number(rawRuolo) || (rawRuolo === 'P' ? 1 : rawRuolo === 'D' ? 2 : rawRuolo === 'C' ? 3 : rawRuolo === 'A' ? 4 : 0);

        const pl = {
          ruolo: ruoloNum,
          nome: formArr[h].Nome,
          squadraDiA: formArr[h].SquadraDiA,
          hasVote: false,
          votoNum: 0,
          fantavoto: 0,
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
          isNoSost: false
        };

        const v = this._findPlayerVote(votiArr, pl.nome, pl.squadraDiA, isLive);
        if (v && v.Voto !== 'SV' && v.Voto !== 'S.V.' && v.Voto !== '' && v.Voto !== null && !isNaN(Number(v.Voto))) {
          pl.hasVote = true;
          pl.votoNum = Number(v.Voto);

          if (pl.ruolo === 1) {
            pl.golSubiti = Number(v.GolSubito || 0);
            pl.rigoriParati = Number(v.RigoreParato || 0);
          } else {
            const rawGolF = Number(v.GolFatto || 0);
            const rawRig = Number(v.Rigore || 0);
            const rawRSba = Number(v.RigoreSbagliato || 0);
            const rigoriSegnati = isLive ? rawRig : Math.max(0, rawRig - rawRSba);
            const netGoals = isLive ? rawGolF : Math.max(0, rawGolF - rigoriSegnati);

            pl.golFatti = netGoals;
            pl.rigoriSegnati = rigoriSegnati;
            pl.rigoriSbagliati = rawRSba;
          }
          pl.autogol = Number(v.AutoGol || 0);
          pl.assist = Number(v.Assist || 0);
          if (v.Ammonizione === '1' || Number(v.Ammonizione) > 0) pl.ammonizione = 1;
          if (v.Espulsione === '1' || Number(v.Espulsione) > 0) pl.espulsione = 1;

          const calcFv = this.calcolaFantavoto(v, pl.ruolo);
          pl.fantavoto = (calcFv !== 'SV' && !isNaN(Number(calcFv))) ? Number(calcFv) : pl.votoNum;
        }

        if (g <= 11) titolari.push(pl);
        else panchina.push(pl);

        g++;
      }
    }

    return { titolari, panchina };
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
   * Calcolo Gol da Punteggio (con soglie fgol1..fgol15 e regola pareggio forzato diffT): delega a FCMCalcoloMotore
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
   * Pulizia all'uscita dalla rotta SPA
   */
  destroy() {
    this.currentDay = null;
    this.currentMatch = 'all';
    if (typeof FcmVotiLiveManager !== 'undefined') {
      FcmVotiLiveManager.destroy();
    }
  }
};
