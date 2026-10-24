/**
 * CALCOLO RISULTATI MANUALE VIEW
 * Controller SPA nativo per simulazione, inserimento voti manuali,
 * calcolo modificatori e gestione amministrativa regole di lega.
 * ModernFCM
 */

const calcoloView = {
  container: null,
  currentComp: 1,
  currentDiv: 0,
  currentDay: null,
  currentMatchId: null, // ID univoco da arrIncontri
  hasImportedVU: false,
  isDirty: false, // Traccia se l'utente ha modificato voti o bonus/malus

  // Dati formazioni attuali dell'incontro
  matchObj: null,
  casaStarters: [],
  casaBench: [],
  fuoriStarters: [],
  fuoriBench: [],
  importedSnapshot: null, // Snapshot originale dei voti importati per "Reimposta"
  modXCasa: 0,
  modXFuori: 0,

  // Stato modale impostazioni admin
  settingsModalState: {
    isOpen: false,
    isAdmin: false,
    isConfigured: true,
    adminMainTab: 'calc', // 'calc', 'assoc' (liveVU), o 'assoc-fp' (liveFP)
    activeTab: 'base',
    definitions: null,
    currentValues: null,
    initialValues: null,
    isSaving: false,
    assocItems: [],
    assocFilter: 'all',
    assocSearch: '',
    fpAssocItems: [],
    fpAssocFilter: 'all',
    fpAssocSearch: ''
  },

  async render(container) {
    this.container = container;

    // Assicura il caricamento delle variabili di calcolo
    await this.ensureCalcoloVars();

    // Inizializza parametri da URL se presenti (#calcolo?Comp=1&Gio=5&Div=0&Match=12)
    this.initParamsFromUrl();

    // Renderizza layout principale
    this.renderMainLayout();

    // Se richiesto esplicitamente nell'hash (#impostazioni_calcolo), apri subito il modale admin
    if (window.location.hash.startsWith('#impostazioni_calcolo') || window.location.hash.startsWith('#impostazioni-calcolo')) {
      this.openSettingsModal();
    }
  },

  /**
   * Assicura che le variabili di lega siano caricate in memoria
   */
  async ensureCalcoloVars() {
    if (typeof fattorecampo === 'undefined' || typeof modD === 'undefined' || typeof fgol1 === 'undefined' || typeof autoGol === 'undefined') {
      try {
        if (typeof fcmDataLoader !== 'undefined') {
          await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js');
        }
      } catch (e) {
        console.warn('[calcoloView] Errore caricamento fcmCalcolorisultatiVariabili.js:', e);
      }
    }
  },

  /**
   * Parsing dei parametri URL per sincronizzazione filtri
   */
  initParamsFromUrl() {
    const calendar = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getCalendarData() : null;
    const hash = window.location.hash || '';
    let urlComp = null, urlGio = null, urlDiv = null, urlMatch = null;

    if (hash.includes('?')) {
      const qStr = hash.substring(hash.indexOf('?'));
      const params = new URLSearchParams(qStr);
      if (params.has('Comp') || params.has('comp')) {
        urlComp = parseInt(params.get('Comp') || params.get('comp'), 10);
      }
      if (params.has('Gio') || params.has('day') || params.has('gio')) {
        urlGio = parseInt(params.get('Gio') || params.get('day') || params.get('gio'), 10);
      }
      if (params.has('Div') || params.has('div')) {
        urlDiv = parseInt(params.get('Div') || params.get('div'), 10);
      }
      if (params.has('Match') || params.has('match') || params.has('id')) {
        urlMatch = parseInt(params.get('Match') || params.get('match') || params.get('id'), 10);
      }
      if (params.has('importaU')) {
        this.hasImportedVU = true;
      }
    }

    if (urlComp && !isNaN(urlComp)) this.currentComp = urlComp;
    if (urlDiv !== null && !isNaN(urlDiv)) this.currentDiv = urlDiv;

    if (urlGio && !isNaN(urlGio)) {
      this.currentDay = urlGio;
    } else if (this.currentDay === null) {
      this.currentDay = (calendar && calendar.nextMatchday > 0)
        ? calendar.nextMatchday
        : ((calendar && calendar.lastPlayed > 0) ? calendar.lastPlayed : 1);
    }

    if (urlMatch && !isNaN(urlMatch)) {
      this.currentMatchId = urlMatch;
    }
  },

  /**
   * Sincronizza i parametri correnti nell'URL senza ricaricare la pagina
   */
  syncUrl() {
    try {
      const p = new URLSearchParams();
      if (this.currentDiv) p.set('Div', this.currentDiv);
      if (this.currentComp) p.set('Comp', this.currentComp);
      if (this.currentDay) p.set('Gio', this.currentDay);
      if (this.currentMatchId) p.set('Match', this.currentMatchId);
      if (this.hasImportedVU) p.set('importaU', '1');

      const newHash = `#calcolo?${p.toString()}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    } catch (e) { }
  },

  /**
   * Aggiorna i link rapidi dell'header (Live FP e Voti Ufficiosi) con competizione e giornata correnti
   */
  updateHeaderQuickLinks() {
    const linkFP = this.container.querySelector('#linkQuickLiveFP');
    const linkFM = this.container.querySelector('#linkQuickLiveFM');
    const linkVU = this.container.querySelector('#linkQuickLiveVU');
    const divPart = this.currentDiv ? `&Div=${this.currentDiv}` : '';
    const matchPart = this.currentMatchId ? `&Match=${this.currentMatchId}` : '';

    if (linkFP) {
      linkFP.href = `#liveFP?Comp=${this.currentComp}&Gio=${this.currentDay}${divPart}${matchPart}`;
    }
    if (linkFM) {
      linkFM.href = `#liveFM?Comp=${this.currentComp}&Gio=${this.currentDay}${divPart}${matchPart}`;
    }
    if (linkVU) {
      linkVU.href = `#liveVU?Comp=${this.currentComp}&Gio=${this.currentDay}${divPart}${matchPart}`;
    }
  },

  /**
   * Renderizza la struttura base della pagina con Card Header, Filtri e Contenitore Tabellone
   */
  renderMainLayout() {
    this.container.innerHTML = `
      <div class="card calcolo-main-card">
        <!-- HEADER DELLA CARD -->
        <div class="card-header calcolo-header-flex">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="16" y1="14" x2="16" y2="18"></line>
                <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
              </svg>
              <span>Calcolo Risultati Manuale</span>
            </div>
            <div class="card-subtitle">Simulazione, calcolo modificatori e gestione voti personalizzati</div>
          </div>

          <!-- AZIONI RAPIDE HEADER (Link dinamici con stessa comp e giornata) -->
          <div class="calcolo-quick-actions">
            <a href="#liveFP" id="linkQuickLiveFP" class="calcolo-quick-btn" title="Vai a Live Fantapazz (stessa giornata e competizione)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Live Fantapazz</span>
            </a>
            <a href="#liveFM" id="linkQuickLiveFM" class="calcolo-quick-btn" title="Vai a Live FantaMaster (stessa giornata e competizione)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="12 6 15 12 12 18 9 12 12 6"></polygon>
              </svg>
              <span>Live FantaMaster</span>
            </a>
            <a href="#liveVU" id="linkQuickLiveVU" class="calcolo-quick-btn" title="Vai a Voti Ufficiosi (stessa giornata e competizione)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Voti Ufficiosi</span>
            </a>
            <button type="button" class="calcolo-quick-btn" id="btnOpenSettingsModal" title="Configura Regole di Calcolo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Impostazioni Regole</span>
            </button>
          </div>
        </div>

        <!-- BARRA FILTRI SUPERIORI (Ordine logico: Divisione -> Competizione -> Giornata -> Incontro) -->
        <div id="calcoloFiltersBarContainer"></div>

        <!-- BARRA IMPORTAZIONE VOTI UFFICIOSI -->
        <div class="calcolo-import-bar" id="calcoloImportBar">
          <div style="display:flex;align-items:center;justify-content:center;width:100%;">
            <button type="button" class="btn-import-vu" id="btnImportaVotiVU">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Importa Voti Ufficiosi (PianetaFanta.it)</span>
            </button>
          </div>

          <!-- BANNER STATO CACHE / NOTIFICA (visibile solo se voti caricati da cache < 15 min) -->
          <div id="vuCacheStatus" style="max-width:760px;margin:12px auto 0 auto;"></div>

          <!-- Contenitore progress bar asincrona per FcmVotiLiveManager -->
          <div id="liveProgressContainerCalcolo" style="display:none;margin-top:14px;max-width:760px;margin-left:auto;margin-right:auto;"></div>
        </div>

        <!-- AREA CONTENUTO PARTITA (Tabellone interattivo) -->
        <div id="calcoloContentArea" class="calcolo-content-area">
          <div style="text-align:center;padding:40px;color:var(--text-muted);">
            Caricamento dati incontro...
          </div>
        </div>
      </div>

      <!-- MODALE RISULTATO CALCOLO IN-PAGE (Stile identico a #liveVU) -->
      <div id="calcModalInPage" class="calc-modal-backdrop" style="display:none;" role="dialog"></div>

      <!-- MODALE / DRAWER IMPOSTAZIONI REGOLE CALCOLO -->
      <div id="calcSettingsModal" class="calc-modal-backdrop" style="display:none;" role="dialog"></div>
    `;

    // Bind eventi header
    const btnOpenSettings = this.container.querySelector('#btnOpenSettingsModal');
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
    }

    const btnImport = this.container.querySelector('#btnImportaVotiVU');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.importaVotiUfficiosi());
    }

    this.updateHeaderQuickLinks();
    this.renderFiltersBar();
    this.caricaIncontroCorrente();
  },

  /**
   * Genera e renderizza la barra filtri con ordine rigoroso:
   * 1. Divisione (se applicabile)
   * 2. Competizione
   * 3. Giornata (senza frecce, mantiene la giornata selezionata)
   * 4. Incontro da Visualizzare (basato su ID univoco)
   */
  renderFiltersBar() {
    const barContainer = this.container.querySelector('#calcoloFiltersBarContainer');
    if (!barContainer) return;

    const comps = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getCompetitions() : [];

    let numDiv = 0;
    if (typeof arrDivisioni !== 'undefined' && Array.isArray(arrDivisioni)) {
      for (let d = 1; d < arrDivisioni.length; d++) {
        if (arrDivisioni[d]) numDiv++;
      }
    }
    const hasDivisions = numDiv > 1;

    // Incontri disponibili per la combinazione giornata / competizione / divisione
    const dayMatches = this.getIncontriGiornata(this.currentDay, this.currentComp, this.currentDiv);

    // Valida o seleziona incontro se presente (supporta sia ID univoco sia indice numerico 1-based)
    if (dayMatches.length > 0) {
      let found = dayMatches.find(m => String(m.id) === String(this.currentMatchId));
      if (!found && this.currentMatchId && this.currentMatchId >= 1 && this.currentMatchId <= dayMatches.length) {
        found = dayMatches[this.currentMatchId - 1];
        if (found) this.currentMatchId = found.id;
      }
      if (!found) {
        this.currentMatchId = dayMatches[0].id;
        found = dayMatches[0];
      }
      this.matchObj = found;
    } else {
      this.currentMatchId = null;
      this.matchObj = null;
    }

    let html = `<div class="calcolo-controls-bar">`;

    // 1. SELECT DIVISIONE (se presente)
    if (hasDivisions) {
      html += `
        <div class="calcolo-control-group">
          <label class="calcolo-control-label" for="selCalcoloDivisione">Divisione</label>
          <select id="selCalcoloDivisione" class="form-select" style="font-weight:700;">
            <option value="0" ${this.currentDiv === 0 ? 'selected' : ''}>Tutte le Divisioni</option>
            ${arrDivisioni.slice(1).map(div => div ? `
              <option value="${div.ID}" ${this.currentDiv === div.ID ? 'selected' : ''}>${div.Nome}</option>
            ` : '').join('')}
          </select>
        </div>
      `;
    }

    // 2. SELECT COMPETIZIONE
    html += `
      <div class="calcolo-control-group">
        <label class="calcolo-control-label" for="selCalcoloComp">Competizione</label>
        <select id="selCalcoloComp" class="form-select" style="font-weight:700;">
          ${comps.map(c => `
            <option value="${c.id}" ${this.currentComp === c.id ? 'selected' : ''}>${c.name}</option>
          `).join('')}
        </select>
      </div>
    `;

    // 3. SELECT GIORNATA (Nessun pulsante freccia rapida, select pulito con classe form-select)
    html += `
      <div class="calcolo-control-group">
        <label class="calcolo-control-label" for="selCalcoloGiornata">Giornata di Serie A</label>
        <select id="selCalcoloGiornata" class="form-select" style="font-weight:700;">
          ${Array.from({ length: 38 }, (_, i) => i + 1).map(g => `
            <option value="${g}" ${this.currentDay === g ? 'selected' : ''}>
              ${g}&ordf; Giornata
            </option>
          `).join('')}
        </select>
      </div>
    `;

    // 4. SELECT INCONTRO
    html += `
      <div class="calcolo-control-group group-match">
        <label class="calcolo-control-label" for="selCalcoloMatch">Incontro da Visualizzare</label>
        <select id="selCalcoloMatch" class="form-select" style="font-weight:700;" ${dayMatches.length === 0 ? 'disabled' : ''}>
          ${dayMatches.length === 0 ? `
            <option value="">Nessun incontro in programma</option>
          ` : dayMatches.map(m => `
            <option value="${m.id}" ${this.currentMatchId === m.id ? 'selected' : ''}>
              ${m.homeTeamName} vs ${m.awayTeamName}
            </option>
          `).join('')}
        </select>
      </div>
    `;

    html += `</div>`;
    barContainer.innerHTML = html;
    this.updateHeaderQuickLinks();

    // BINDING CHANGE LISTENERS
    const selDiv = barContainer.querySelector('#selCalcoloDivisione');
    if (selDiv) {
      selDiv.addEventListener('change', async (e) => {
        this.currentDiv = parseInt(e.target.value, 10) || 0;
        this.currentMatchId = null;
        this.syncUrl();
        this.updateHeaderQuickLinks();
        this.renderFiltersBar();
        await this.caricaIncontroCorrente();
      });
    }

    const selComp = barContainer.querySelector('#selCalcoloComp');
    if (selComp) {
      selComp.addEventListener('change', async (e) => {
        this.currentComp = parseInt(e.target.value, 10) || 1;
        this.currentMatchId = null;
        // Non modifica la giornata: mantiene sempre quella selezionata
        this.syncUrl();
        this.updateHeaderQuickLinks();
        this.renderFiltersBar();
        await this.caricaIncontroCorrente();
      });
    }

    const selGio = barContainer.querySelector('#selCalcoloGiornata');
    if (selGio) {
      selGio.addEventListener('change', async (e) => {
        this.currentDay = parseInt(e.target.value, 10) || 1;
        this.currentMatchId = null;
        const vuNotice = document.getElementById('vuCacheStatus');
        if (vuNotice) vuNotice.innerHTML = '';
        this.syncUrl();
        this.updateHeaderQuickLinks();
        this.renderFiltersBar();
        await this.caricaIncontroCorrente();
      });
    }

    const selMatch = barContainer.querySelector('#selCalcoloMatch');
    if (selMatch) {
      selMatch.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        if (val) {
          this.currentMatchId = val;
          const curMatches = this.getIncontriGiornata(this.currentDay, this.currentComp, this.currentDiv);
          this.matchObj = curMatches.find(m => m.id === this.currentMatchId) || null;
          this.syncUrl();
          this.updateHeaderQuickLinks();
          await this.caricaIncontroCorrente();
        }
      });
    }
  },

  /**
   * Recupera gli incontri per la giornata e la competizione selezionate
   */
  getIncontriGiornata(day, compId, divId) {
    const calendar = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getCalendarData() : null;
    if (!calendar || !calendar.matches) return [];

    let list = calendar.matches.filter(m => m.serieADay === day && (compId === 0 || m.compId === compId) && !m.isRiposo);

    // Filtra per divisione se richiesto
    if (divId && divId > 0 && typeof arrFantasquadre !== 'undefined') {
      list = list.filter(m => {
        const sqCasa = arrFantasquadre[m.homeTeamId];
        const sqFuori = arrFantasquadre[m.awayTeamId];
        const inDiv = (sqCasa && parseInt(sqCasa.IDDivisione, 10) === parseInt(divId, 10)) ||
          (sqFuori && parseInt(sqFuori.IDDivisione, 10) === parseInt(divId, 10));
        return inDiv || m.type === 4;
      });
    }

    return list;
  },

  /**
   * Carica la formazione delle due squadre per l'incontro selezionato
   */
  async caricaIncontroCorrente() {
    const contentArea = this.container.querySelector('#calcoloContentArea');
    if (!contentArea) return;

    if (!this.matchObj) {
      this.casaStarters = [];
      this.casaBench = [];
      this.fuoriStarters = [];
      this.fuoriBench = [];
      contentArea.innerHTML = `
        <div class="calcolo-empty-card" style="text-align:center;padding:48px 20px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <div style="font-weight:700;font-size:1.1rem;margin:12px 0 6px;color:var(--text-primary);">Nessun incontro disponibile</div>
          <div style="color:var(--text-secondary);font-size:0.86rem;">Nessuna partita in programma per la ${this.currentDay}&ordf; Giornata nella competizione selezionata.</div>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div style="text-align:center;padding:50px 20px;">
        <div class="calcolo-loading-spinner"></div>
        <div style="color:var(--accent-primary, #3b82f6);font-weight:700;margin-top:12px;">Caricamento Formazioni Incontro...</div>
        <div style="color:var(--text-muted);font-size:0.82rem;margin-top:4px;">${this.matchObj.homeTeamName} vs ${this.matchObj.awayTeamName}</div>
      </div>
    `;

    // Carica SEMPRE ed esegue il file formazioni js/fcmFormazioniDatiX.js della giornata selezionata
    await this.caricaScriptFormazioniGiornata(this.currentDay);

    // Se è attiva l'importazione voti ufficiosi, assicura che il file voti e associazioni siano caricati
    if (this.hasImportedVU) {
      await this.caricaDatiVotiVU();
    }

    this.estraiFormazioniSquadre();
    this.renderTabellonePartita();
  },

  /**
   * Carica ed esegue dinamicamente js/fcmFormazioniDatiX.js garantendo che arrFormazioni
   * globale sia aggiornato alla giornata selezionata
   */
  async caricaScriptFormazioniGiornata(day) {
    const d = parseInt(day, 10);
    if (!d || d < 1 || d > 38) return;

    // Assicura che le anagrafiche Serie A (nomi giocatori xg... e squadre xa...) siano disponibili
    if (typeof arrGiocatoriA === 'undefined') {
      try {
        if (typeof fcmDataLoader !== 'undefined') {
          await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
        }
      } catch (e) { }
    }
    if (typeof arrSquadreA === 'undefined') {
      try {
        if (typeof fcmDataLoader !== 'undefined') {
          await fcmDataLoader.loadScript('js/fcmSerieADati.js');
        }
      } catch (e) { }
    }

    return new Promise((resolve) => {
      // Rimuove eventuale vecchio tag script per forzare l'esecuzione
      const oldScript = document.getElementById('scriptFormazioniCalcolo');
      if (oldScript) {
        oldScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'scriptFormazioniCalcolo';
      script.charset = 'ISO-8859-1';
      script.src = `js/fcmFormazioniDati${d}.js?_t=${Date.now()}`;
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        console.warn(`[calcoloView] Impossibile caricare js/fcmFormazioniDati${d}.js`);
        resolve();
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Estrae i giocatori per Casa e Trasferta rispettando IDIncontro e ordinamento FCM
   */
  estraiFormazioniSquadre() {
    if (!this.matchObj) {
      this.casaStarters = [];
      this.casaBench = [];
      this.fuoriStarters = [];
      this.fuoriBench = [];
      return;
    }

    const pId = this.matchObj.id;
    const homeTeamId = this.matchObj.homeTeamId;
    const awayTeamId = this.matchObj.awayTeamId;

    let rawCasa = [];
    let rawFuori = [];

    if (typeof arrFormazioni !== 'undefined' && Array.isArray(arrFormazioni)) {
      // 1. Prima cerca per IDIncontro esatto
      for (let i = 1; i < arrFormazioni.length; i++) {
        const row = arrFormazioni[i];
        if (!row) continue;
        if (row.IDIncontro === pId) {
          if (row.IDSquadra === homeTeamId) rawCasa.push(row);
          if (row.IDSquadra === awayTeamId) rawFuori.push(row);
        }
      }

      // 2. Fallback per sola IDSquadra se IDIncontro non ha fatto match (es. IDIncontro=0 o formazioni generiche)
      if (rawCasa.length === 0) {
        rawCasa = arrFormazioni.slice(1).filter(r => r && r.IDSquadra === homeTeamId);
      }
      if (rawFuori.length === 0) {
        rawFuori = arrFormazioni.slice(1).filter(r => r && r.IDSquadra === awayTeamId);
      }
    }

    // Ordina titolari (Pos === 0 per ruolo) e panchina (Pos > 0 per Pos e ruolo, escludendo tribuna Pos === -1)
    const titCasa = rawCasa.filter(r => r.Pos === 0).sort((a, b) => a.Ruolo - b.Ruolo);
    const panCasa = rawCasa.filter(r => r.Pos > 0).sort((a, b) => {
      if (a.Pos !== b.Pos) return a.Pos - b.Pos;
      return a.Ruolo - b.Ruolo;
    });

    const titFuori = rawFuori.filter(r => r.Pos === 0).sort((a, b) => a.Ruolo - b.Ruolo);
    const panFuori = rawFuori.filter(r => r.Pos > 0).sort((a, b) => {
      if (a.Pos !== b.Pos) return a.Pos - b.Pos;
      return a.Ruolo - b.Ruolo;
    });

    this.casaStarters = this.creaStrutturaGiocatori(titCasa, true);
    this.casaBench = this.creaStrutturaGiocatori(panCasa, false);

    this.fuoriStarters = this.creaStrutturaGiocatori(titFuori, true);
    this.fuoriBench = this.creaStrutturaGiocatori(panFuori, false);

    // Salva snapshot per pulsante "Reimposta" se sono stati importati i voti
    if (this.hasImportedVU) {
      this.importedSnapshot = JSON.parse(JSON.stringify({
        casaStarters: this.casaStarters,
        casaBench: this.casaBench,
        fuoriStarters: this.fuoriStarters,
        fuoriBench: this.fuoriBench,
        modXCasa: this.modXCasa,
        modXFuori: this.modXFuori
      }));
    } else {
      this.importedSnapshot = null;
    }

    this.isDirty = false;
  },

  /**
   * Cerca il voto corrispondente in arrVoti secondo l'algoritmo ufficiale PianetaFanta / #liveVU
   */
  findPlayerVoteInArrVoti(pl) {
    if (typeof arrVoti === 'undefined' || !Array.isArray(arrVoti) || arrVoti.length === 0) {
      return null;
    }

    const pNome = (pl.Nome || '').trim();
    const pNomeUpper = pNome.toUpperCase();
    const pSquadra = pl.SquadraDiA === 'Verona' ? 'Hellas Verona' : (pl.SquadraDiA || '');
    const cognomeFCM = this.formatCognome(pNome).toUpperCase();

    // 1. Associazione esplicita da arrAssociazioni
    if (typeof arrAssociazioni !== 'undefined' && arrAssociazioni) {
      for (let i = 0; i < arrVoti.length; i++) {
        const v = arrVoti[i];
        if (!v) continue;
        const vSquadra = v.Squadra === 'Verona' ? 'Hellas Verona' : (v.Squadra || '');
        if (arrAssociazioni[v.Nome] === pNome && (vSquadra === pSquadra || !pSquadra)) {
          return v;
        }
      }
    }

    // 2. Corrispondenza esatta Nome + Squadra
    for (let i = 0; i < arrVoti.length; i++) {
      const v = arrVoti[i];
      if (!v) continue;
      const vSquadra = v.Squadra === 'Verona' ? 'Hellas Verona' : (v.Squadra || '');
      if (v.Nome && v.Nome.trim().toUpperCase() === pNomeUpper && vSquadra === pSquadra) {
        return v;
      }
    }

    // 3. Corrispondenza esatta Nome (senza squadra)
    for (let i = 0; i < arrVoti.length; i++) {
      const v = arrVoti[i];
      if (!v) continue;
      if (v.Nome && v.Nome.trim().toUpperCase() === pNomeUpper) {
        return v;
      }
    }

    // 4. Corrispondenza Cognome FCM presente in Nome PianetaFanta + Squadra
    if (cognomeFCM) {
      for (let i = 0; i < arrVoti.length; i++) {
        const v = arrVoti[i];
        if (!v) continue;
        const vSquadra = v.Squadra === 'Verona' ? 'Hellas Verona' : (v.Squadra || '');
        if (v.Nome && v.Nome.toUpperCase().includes(cognomeFCM) && vSquadra === pSquadra) {
          return v;
        }
      }
    }

    // 5. Inverso: Nome PianetaFanta presente in Nome FCM + Squadra
    for (let i = 0; i < arrVoti.length; i++) {
      const v = arrVoti[i];
      if (!v) continue;
      const vSquadra = v.Squadra === 'Verona' ? 'Hellas Verona' : (v.Squadra || '');
      if (v.Nome && pNomeUpper.includes(v.Nome.trim().toUpperCase()) && vSquadra === pSquadra) {
        return v;
      }
    }

    return null;
  },

  /**
   * Crea l'oggetto reattivo per ogni giocatore con tutti i bonus/malus
   */
  creaStrutturaGiocatori(rawList, isStarter) {
    return rawList.map((p, idx) => {
      const normName = this.normalizeName(p.Nome);

      let baseVoto = 6.00;
      let golF = 0;
      let golS = 0;
      let golV = false;
      let golP = false;
      let rigF = 0;
      let rigP = 0;
      let rigS = 0;
      let autoG = 0;
      let assist = 0;
      let amm = false;
      let esp = false;

      if (this.hasImportedVU) {
        const matched = this.findPlayerVoteInArrVoti(p);
        if (matched) {
          const rawV = matched.Voto !== undefined ? matched.Voto : (matched.V ? matched.V : 'S.V.');
          if (typeof rawV === 'string' && (rawV.toUpperCase() === 'SV' || rawV.toUpperCase() === 'S.V.' || rawV.trim() === '')) {
            baseVoto = 'S.V.';
          } else {
            const parsed = parseFloat(String(rawV).replace(',', '.'));
            baseVoto = isNaN(parsed) ? 'S.V.' : parsed;
          }

          const rawGolF = Number(matched.GolFatto || 0);
          const rawRigF = Number(matched.Rigore || 0);

          // In PianetaFanta / ufficiosi, GolFatto include già i rigori segnati:
          // scorporiamo i gol su azione (golF = rawGolF - rawRigF) dai rigori segnati (rigF = rawRigF)
          if (rawGolF > 0) {
            if (rawRigF > 0) {
              golF = Math.max(0, rawGolF - rawRigF);
              rigF = rawRigF;
            } else {
              golF = rawGolF;
              rigF = 0;
            }
          } else {
            golF = 0;
            rigF = rawRigF;
          }

          golS = Number(matched.GolSubito || 0);
          golV = Number(matched.GolVittoria || 0) > 0;
          golP = Number(matched.GolPareggio || 0) > 0;
          rigP = Number(matched.RigoreParato || 0);
          rigS = Number(matched.RigoreSbagliato || 0);
          autoG = Number(matched.AutoGol || 0);
          assist = Number(matched.Assist || 0);
          amm = Number(matched.Ammonizione || 0) > 0;
          esp = Number(matched.Espulsione || 0) > 0;
        } else {
          // Non sceso in campo a referto: S.V.
          baseVoto = 'S.V.';
        }
      }

      const item = {
        uid: `${p.IDSquadra}_${p.Pos}_${idx}_${normName.replace(/[^a-z0-9]/gi, '')}`,
        nome: p.Nome,
        normalizedName: normName,
        ruolo: p.Ruolo, // 1 (P), 2 (D), 3 (C), 4 (A)
        squadraDiA: p.SquadraDiA || '',
        pos: p.Pos,
        isStarter: isStarter,
        voto: baseVoto,
        golF: golF,
        golS: golS,
        golV: golV,
        golP: golP,
        rigF: rigF,
        rigP: rigP,
        rigS: rigS,
        autoG: autoG,
        assist: assist,
        amm: amm,
        esp: esp,
        votoFinale: baseVoto
      };

      item.votoFinale = this.calcolaVotoFinaleGiocatore(item);
      return item;
    });
  },

  /**
   * Calcola il voto finale (Fantavoto) di un singolo calciatore
   */
  calcolaVotoFinaleGiocatore(p) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaFantavoto(p, p.ruolo);
    }
    return Number(p.voto) || 0;
  },

  /**
   * Renderizza il tabellone completo della partita (Squadra Casa vs Squadra Fuori)
   */
  renderTabellonePartita() {
    const contentArea = this.container.querySelector('#calcoloContentArea');
    if (!contentArea || !this.matchObj) return;

    const match = this.matchObj;
    const logoCasa = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getTeamLogo(match.homeTeamName || match.homeTeamId) : 'img/sq/0.gif';
    const logoFuori = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getTeamLogo(match.awayTeamName || match.awayTeamId) : 'img/sq/0.gif';

    const moduloCasa = this.calcolaModuloTattico(this.casaStarters);
    const moduloFuori = this.calcolaModuloTattico(this.fuoriStarters);

    const hasGolVP = typeof golVP !== 'undefined' && (golVP === 1 || golVP === '1');
    const hasModX = typeof modX !== 'undefined' && (modX === 1 || modX === '1');

    const html = `
      <!-- PULSANTI AZIONE SUPERIORI -->
      <div class="calcolo-actions-row">
        <button type="button" class="btn-calcola-hero" id="btnCalcolaTop" title="Calcola il risultato finale dell'incontro con le regole ufficiali FCM">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Calcola Risultato</span>
        </button>

        <button type="button" class="btn-reimposta" id="btnReimpostaTop" ${this.hasImportedVU ? '' : 'style="display:none;"'} ${this.isDirty ? '' : 'disabled'} title="Reimposta: Ripristina i voti ufficiosi importati da PianetaFanta annullando le modifiche manuali">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <polyline points="3 3 3 8 8 8"></polyline>
          </svg>
          <span>Reimposta</span>
        </button>

        <button type="button" class="btn-reset-voti" id="btnResetVotiTop" title="Reset: Reimposta tutti i voti a 6.00 e azzera tutti i bonus/malus">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Reset</span>
        </button>
      </div>

      <!-- TABELLE SQUADRE SEPARATE (UNA DOPO L'ALTRA) -->
      <div class="calcolo-teams-container">
        <!-- SEZIONE SQUADRA CASA -->
        <div class="calcolo-team-section calcolo-team-casa">
          <div class="calcolo-team-header">
            <div class="calcolo-team-title-wrap">
              <img src="${logoCasa}" class="calcolo-team-badge" alt="${match.homeTeamName}" onerror="this.src='img/sq/undefined.svg';">
              <div>
                <span class="calcolo-team-name">${match.homeTeamName}</span>
                <span class="calcolo-team-role-count">Modulo Tattico: <b>${moduloCasa}</b></span>
              </div>
            </div>
            <span class="badge" style="background:var(--accent-primary, #3b82f6);color:#fff;font-weight:700;">CASA</span>
          </div>

          <div class="calcolo-table-wrap">
            ${this.renderSquadraTable(this.casaStarters, this.casaBench, 'casa', hasGolVP, hasModX)}
          </div>
        </div>

        <!-- SEZIONE SQUADRA FUORI -->
        <div class="calcolo-team-section calcolo-team-fuori">
          <div class="calcolo-team-header">
            <div class="calcolo-team-title-wrap">
              <img src="${logoFuori}" class="calcolo-team-badge" alt="${match.awayTeamName}" onerror="this.src='img/sq/undefined.svg';">
              <div>
                <span class="calcolo-team-name">${match.awayTeamName}</span>
                <span class="calcolo-team-role-count">Modulo Tattico: <b>${moduloFuori}</b></span>
              </div>
            </div>
            <span class="badge" style="background:#64748b;color:#fff;font-weight:700;">TRASFERTA</span>
          </div>

          <div class="calcolo-table-wrap">
            ${this.renderSquadraTable(this.fuoriStarters, this.fuoriBench, 'fuori', hasGolVP, hasModX)}
          </div>
        </div>
      </div>

      <!-- PULSANTI AZIONE INFERIORI -->
      <div class="calcolo-actions-row" style="margin-top:24px;">
        <button type="button" class="btn-calcola-hero" id="btnCalcolaBottom" title="Calcola il risultato finale dell'incontro con le regole ufficiali FCM">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Calcola Risultato</span>
        </button>

        <button type="button" class="btn-reimposta" id="btnReimpostaBottom" ${this.hasImportedVU ? '' : 'style="display:none;"'} ${this.isDirty ? '' : 'disabled'} title="Reimposta: Ripristina i voti ufficiosi importati da PianetaFanta annullando le modifiche manuali">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <polyline points="3 3 3 8 8 8"></polyline>
          </svg>
          <span>Reimposta</span>
        </button>

        <button type="button" class="btn-reset-voti" id="btnResetVotiBottom" title="Reset: Reimposta tutti i voti a 6.00 e azzera tutti i bonus/malus">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Reset</span>
        </button>
      </div>
    `;

    contentArea.innerHTML = html;

    // BINDING EVENTI CALCOLO, REIMPOSTA E RESET
    const btnCalc1 = contentArea.querySelector('#btnCalcolaTop');
    const btnCalc2 = contentArea.querySelector('#btnCalcolaBottom');
    if (btnCalc1) btnCalc1.addEventListener('click', () => this.eseguiCalcoloRisultato());
    if (btnCalc2) btnCalc2.addEventListener('click', () => this.eseguiCalcoloRisultato());

    const btnReset1 = contentArea.querySelector('#btnReimpostaTop');
    const btnReset2 = contentArea.querySelector('#btnReimpostaBottom');
    if (btnReset1) btnReset1.addEventListener('click', () => this.ripristinaVotiUfficiosi());
    if (btnReset2) btnReset2.addEventListener('click', () => this.ripristinaVotiUfficiosi());

    const btnResAll1 = contentArea.querySelector('#btnResetVotiTop');
    const btnResAll2 = contentArea.querySelector('#btnResetVotiBottom');
    if (btnResAll1) btnResAll1.addEventListener('click', () => this.resetVotiBase());
    if (btnResAll2) btnResAll2.addEventListener('click', () => this.resetVotiBase());

    // BINDING INPUT CHANGE LISTENERS
    this.bindTableInputsListeners(contentArea);
  },

  /**
   * Genera le opzioni per il select del voto rispettando intervallovoti da fcmCalcolorisultatiVariabili.js
   */
  getSelectVotoOptionsHtml(selectedVal) {
    const step = typeof intervallovoti !== 'undefined' ? Number(intervallovoti) : 0.25;
    let html = '';
    const selNum = (selectedVal !== 'S.V.' && selectedVal !== 'sv' && selectedVal !== '' && selectedVal !== null && selectedVal !== undefined)
      ? Number(String(selectedVal).replace(',', '.'))
      : null;

    for (let v = 1; v <= 10; v = Number((v + step).toFixed(2))) {
      const isSel = (selNum !== null && !isNaN(selNum) && Number(v.toFixed(2)) === Number(selNum.toFixed(2)));
      html += `<option value="${v}" ${isSel ? 'selected' : ''}>${v}</option>`;
    }

    const isSv = selectedVal === 'S.V.' || selectedVal === 'sv' || selNum === null || isNaN(selNum);
    html += `<option value="S.V." ${isSv ? 'selected' : ''}>S.V.</option>`;
    return html;
  },

  /**
   * Restituisce la classe colore per FVoto (<6 rosso, ==6 nero, >6 verde, SV grigio)
   */
  getFVotoClass(votoVal) {
    if (votoVal === 'S.V.' || votoVal === 'sv' || votoVal === '' || votoVal === null || votoVal === undefined) {
      return 'fvoto-sv';
    }
    const num = parseFloat(String(votoVal).replace(',', '.'));
    if (isNaN(num)) return 'fvoto-sv';
    if (num < 6.00) return 'fvoto-red';
    if (num > 6.00) return 'fvoto-green';
    return 'fvoto-black';
  },

  /**
   * Helper per ottenere la foto giocatore tramite fcmDataLoader
   */
  getPlayerPhoto(nome) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function') {
      return fcmDataLoader.getPlayerPhoto(nome);
    }
    return 'img/foto/misterx.gif';
  },

  /**
   * Genera la tabella HTML dei giocatori per una squadra
   */
  renderSquadraTable(starters, bench, side, hasGolVP, hasModX) {
    if (!starters || starters.length === 0) {
      return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Formazione non inserita.</div>`;
    }

    const renderRow = (p, isPanchina) => {
      const roleLetter = this.getRoleLetter(p.ruolo);
      const magliaSrc = p.squadraDiA ? `img/live/sq/${p.squadraDiA}.png` : 'img/live/sq/0.png';
      const photoSrc = this.getPlayerPhoto(p.nome);
      const cognome = this.formatCognome(p.nome);

      return `
        <tr class="${isPanchina ? 'calcolo-row-bench' : ''}" data-uid="${p.uid}" data-side="${side}">
          <td class="col-player">
            <div class="calcolo-player-cell">
              <span class="calcolo-role-badge role-${roleLetter}">${roleLetter}</span>
              <img src="${magliaSrc}" class="calcolo-seriea-shirt" alt="${p.squadraDiA}" title="${p.squadraDiA}" onerror="this.src='img/live/sq/0.png';">
              <img src="${photoSrc}" class="calcolo-player-photo" alt="${p.nome}" title="${p.nome} (${roleLetter})" loading="lazy" onerror="this.src='img/foto/misterx.gif';">
              <span class="calcolo-player-name calcolo-name-full" title="${p.nome}">${p.nome}</span>
              <span class="calcolo-player-name calcolo-name-short" title="${p.nome}">${cognome}</span>
            </div>
          </td>
          <td class="col-input">
            <select class="input-voto input-field-table" data-prop="voto">
              ${this.getSelectVotoOptionsHtml(p.voto)}
            </select>
          </td>
          <td class="col-input">
            <input type="number" min="0" max="15" class="input-field-table input-number" data-prop="golF" value="${p.golF || 0}">
          </td>
          <td class="col-input">
            <input type="number" min="0" max="15" class="input-field-table input-number" data-prop="golS" value="${p.golS || 0}">
          </td>
          ${hasGolVP ? `
            <td class="col-input col-checkbox-dual">
              <label title="Gol Vittoria"><input type="checkbox" data-prop="golV" ${p.golV ? 'checked' : ''}> V</label>
              <label title="Gol Pareggio"><input type="checkbox" data-prop="golP" ${p.golP ? 'checked' : ''}> P</label>
            </td>
          ` : ''}
          <td class="col-input">
            <input type="number" min="0" max="10" class="input-field-table input-number" data-prop="rigF" value="${p.rigF || 0}">
          </td>
          <td class="col-input">
            <input type="number" min="0" max="10" class="input-field-table input-number" data-prop="rigP" value="${p.rigP || 0}">
          </td>
          <td class="col-input">
            <input type="number" min="0" max="10" class="input-field-table input-number" data-prop="rigS" value="${p.rigS || 0}">
          </td>
          <td class="col-input">
            <input type="number" min="0" max="10" class="input-field-table input-number" data-prop="autoG" value="${p.autoG || 0}">
          </td>
          <td class="col-input">
            <input type="number" min="0" max="10" class="input-field-table input-number" data-prop="assist" value="${p.assist || 0}">
          </td>
          <td class="col-input text-center">
            <input type="checkbox" class="input-checkbox-custom" data-prop="amm" ${p.amm ? 'checked' : ''}>
          </td>
          <td class="col-input text-center">
            <input type="checkbox" class="input-checkbox-custom" data-prop="esp" ${p.esp ? 'checked' : ''}>
          </td>
          <td class="col-finale">
            <span class="voto-finale-val ${this.getFVotoClass(p.votoFinale)}">${p.votoFinale}</span>
          </td>
        </tr>
      `;
    };

    let totalCols = 12 + (hasGolVP ? 1 : 0);

    return `
      <table class="calcolo-table">
        <thead>
          <tr>
            <th style="text-align:left;padding-left:14px;min-width:180px;">Giocatore</th>
            <th title="Voto Base">Voto</th>
            <th title="Gol Fatti"><img src="img/calc/golBlack.png" class="bm-header-icon" alt="Gol"></th>
            <th title="Gol Subiti"><img src="img/calc/golRed.png" class="bm-header-icon" alt="Gol Subito"></th>
            ${hasGolVP ? `<th title="Gol Vittoria / Pareggio">V/P</th>` : ''}
            <th title="Rigore Segnato">Rig</th>
            <th title="Rigore Parato">R.Par</th>
            <th title="Rigore Sbagliato">R.Sba</th>
            <th title="Autogol">Aut</th>
            <th title="Assist"><img src="img/calc/assist.png" class="bm-header-icon" alt="Assist"></th>
            <th title="Ammonizione"><img src="img/calc/album_amm.gif" class="bm-header-icon" alt="Giallo"></th>
            <th title="Espulsione"><img src="img/calc/album_esp.gif" class="bm-header-icon" alt="Rosso"></th>
            <th title="Fantavoto">FVoto</th>
          </tr>
        </thead>
        <tbody>
          <!-- TITOLARI -->
          ${starters.map(p => renderRow(p, false)).join('')}

          <!-- SEZIONE PANCHINA -->
          ${bench.length > 0 ? `
            <tr class="calcolo-bench-divider">
              <td colspan="${totalCols}">
                <div class="calcolo-bench-header">PANCHINA</div>
              </td>
            </tr>
            ${bench.map(p => renderRow(p, true)).join('')}
          ` : ''}

          <!-- MODIFICATORE PERSONALIZZATO (se abilitato) -->
          ${hasModX ? `
            <tr class="calcolo-modx-row">
              <td colspan="${totalCols - 2}" style="text-align:right;font-weight:700;">Modificatore Personalizzato:</td>
              <td colspan="2">
                <input type="number" step="0.5" class="input-field-table input-modx" data-side="${side}" value="${side === 'casa' ? this.modXCasa : this.modXFuori}">
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;
  },

  /**
   * Binding listener per input e select della tabella per ricalcolo istantaneo
   */
  bindTableInputsListeners(container) {
    const rows = container.querySelectorAll('tbody tr[data-uid]');
    rows.forEach(tr => {
      const uid = tr.dataset.uid;
      const side = tr.dataset.side;
      const playerList = side === 'casa'
        ? [...this.casaStarters, ...this.casaBench]
        : [...this.fuoriStarters, ...this.fuoriBench];

      const player = playerList.find(p => p.uid === uid);
      if (!player) return;

      const finaleEl = tr.querySelector('.voto-finale-val');

      const onInputChange = () => {
        this.isDirty = true;
        this.updateActionButtonsState();

        // Ricalcola voto finale
        player.votoFinale = this.calcolaVotoFinaleGiocatore(player);

        if (finaleEl) {
          finaleEl.textContent = player.votoFinale;
          finaleEl.className = `voto-finale-val ${this.getFVotoClass(player.votoFinale)}`;
        }
      };

      // Select Voto
      const selVoto = tr.querySelector('select[data-prop="voto"]');
      if (selVoto) {
        selVoto.addEventListener('change', (e) => {
          player.voto = e.target.value === 'S.V.' ? 'S.V.' : Number(e.target.value);
          onInputChange();
        });
      }

      // Input numerici
      tr.querySelectorAll('input[type="number"][data-prop]').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const prop = inp.dataset.prop;
          player[prop] = Math.max(0, parseInt(e.target.value, 10) || 0);
          onInputChange();
        });
      });

      // Checkbox
      tr.querySelectorAll('input[type="checkbox"][data-prop]').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const prop = chk.dataset.prop;
          player[prop] = e.target.checked;

          // Se seleziona golV, deseleziona golP e viceversa
          if (prop === 'golV' && e.target.checked) {
            player.golP = false;
            const pChk = tr.querySelector('input[data-prop="golP"]');
            if (pChk) pChk.checked = false;
          } else if (prop === 'golP' && e.target.checked) {
            player.golV = false;
            const vChk = tr.querySelector('input[data-prop="golV"]');
            if (vChk) vChk.checked = false;
          }

          onInputChange();
        });
      });
    });

    // Modificatori personalizzati
    container.querySelectorAll('.input-modx').forEach(inp => {
      inp.addEventListener('input', () => {
        this.isDirty = true;
        this.updateActionButtonsState();
        const s = inp.dataset.side;
        if (s === 'casa') this.modXCasa = Number(inp.value) || 0;
        else this.modXFuori = Number(inp.value) || 0;
      });
    });
  },

  /**
   * Aggiorna lo stato abilitato/disabilitato e visibilità dei pulsanti azione
   */
  updateActionButtonsState() {
    const btnsReimposta = this.container.querySelectorAll('.btn-reimposta');
    btnsReimposta.forEach(b => {
      if (this.hasImportedVU) {
        b.style.display = 'inline-flex';
        b.disabled = !this.isDirty;
      } else {
        b.style.display = 'none';
        b.disabled = true;
      }
    });
  },

  /**
   * Ripristina i voti ufficiosi importati annullando le modifiche manuali effettuate
   */
  ripristinaVotiUfficiosi() {
    if (!this.hasImportedVU) return;

    if (!this.importedSnapshot) {
      this.estraiFormazioniSquadre();
    } else {
      this.casaStarters = JSON.parse(JSON.stringify(this.importedSnapshot.casaStarters));
      this.casaBench = JSON.parse(JSON.stringify(this.importedSnapshot.casaBench));
      this.fuoriStarters = JSON.parse(JSON.stringify(this.importedSnapshot.fuoriStarters));
      this.fuoriBench = JSON.parse(JSON.stringify(this.importedSnapshot.fuoriBench));
      this.modXCasa = this.importedSnapshot.modXCasa || 0;
      this.modXFuori = this.importedSnapshot.modXFuori || 0;
    }

    this.isDirty = false;
    this.renderTabellonePartita();
    this.showToast("Voti ufficiosi ripristinati. Modifiche manuali annullate.");
  },

  /**
   * Resetta tutti i voti a 6.00 e azzera tutti i bonus/malus, facendo sparire "Reimposta"
   */
  resetVotiBase() {
    const resetPlayer = (p) => {
      p.voto = 6.00;
      p.golF = 0;
      p.golS = 0;
      p.golV = false;
      p.golP = false;
      p.rigF = 0;
      p.rigP = 0;
      p.rigS = 0;
      p.autoG = 0;
      p.assist = 0;
      p.amm = false;
      p.esp = false;
      p.votoFinale = 6.00;
    };

    this.casaStarters.forEach(resetPlayer);
    this.casaBench.forEach(resetPlayer);
    this.fuoriStarters.forEach(resetPlayer);
    this.fuoriBench.forEach(resetPlayer);
    this.modXCasa = 0;
    this.modXFuori = 0;

    this.hasImportedVU = false;
    this.importedSnapshot = null;
    this.isDirty = false;

    this.syncUrl();
    this.renderTabellonePartita();
    this.showToast("Tutti i voti resettati a 6.00 e bonus/malus azzerati.");
  },

  /**
   * Importa voti ufficiosi asincronamente tramite FcmVotiLiveManager
   * @param {boolean} force - Se true, ignora la cache locale di 15 min e riscarica da PianetaFanta
   */
  importaVotiUfficiosi(force = false) {
    if (typeof FcmVotiLiveManager === 'undefined') {
      alert("Manager voti live non disponibile.");
      return;
    }

    const progContainer = this.container.querySelector('#liveProgressContainerCalcolo');
    if (progContainer) {
      progContainer.style.display = 'block';
      progContainer.style.opacity = '1';
    }

    FcmVotiLiveManager.init({
      source: 'pianetafanta',
      endpoint: 'inc/live_extractVU.php',
      sourceName: 'PianetaFanta.it',
      sourceTypeDesc: 'Voti Ufficiosi',
      giornata: this.currentDay,
      containerId: 'liveProgressContainerCalcolo',
      autoStart: true,
      force: !!force,
      onSuccess: async () => {
        this.hasImportedVU = true;
        await this.caricaDatiVotiVU();
        this.estraiFormazioniSquadre();
        this.renderTabellonePartita();
        this.syncUrl();
        this.showToast(force ? "Voti Ufficiosi aggiornati con successo!" : "Voti Ufficiosi importati con successo!");
      }
    });
  },

  /**
   * Carica i voti ufficiosi da js/fcmVotiDatiVU.js e associazioni in memoria
   */
  async caricaDatiVotiVU() {
    try {
      if (typeof fcmDataLoader !== 'undefined') {
        await fcmDataLoader.loadScript('js/fcmVotiDatiVU.js', true);
        try {
          await fcmDataLoader.loadScript('js/fcmVotiAssociazioni.js', true);
        } catch (eAssoc) { }
      }
    } catch (e) {
      console.warn('[calcoloView] Impossibile caricare fcmVotiDatiVU.js:', e);
    }
  },

  /**
   * MOTORE DI CALCOLO RISULTATO UFFICIALE FCM
   * Esegue le sostituzioni ruolo-su-ruolo, applica modificatori,
   * fattore campo condizionato e apre il modale risultato.
   */
  eseguiCalcoloRisultato() {
    const match = this.matchObj;
    if (!match) return;

    // 1. Sostituzioni ruolo-su-ruolo per Casa e Fuori
    const resCasa = this.applicaSostituzioni(this.casaStarters, this.casaBench);
    const resFuori = this.applicaSostituzioni(this.fuoriStarters, this.fuoriBench);

    // 2. Somme parziali dei voti
    let sommaCasa = 0;
    let sommaFuori = 0;
    resCasa.titolariFinali.forEach(p => { sommaCasa += Number(p.votoFinale) || 0; });
    resFuori.titolariFinali.forEach(p => { sommaFuori += Number(p.votoFinale) || 0; });

    // 3. Fattore campo condizionato dal tipo incontro (conforme a #liveVU)
    const fCampo = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaFattoreCampo(match.IDTipo || match.idTipo || 0)
      : (typeof fattorecampo !== 'undefined' ? Number(fattorecampo) : 2);

    // 4. Modificatori ufficiali FCM (Difesa, Centrocampo, Portiere, Attacco)
    const mods = this.calcolaTuttiModificatori(resCasa.titolariFinali, resFuori.titolariFinali);

    // 5. Totale complessivo squadra (regola FCM: modDifesaFuori sommato a Casa e viceversa)
    const totali = (typeof FCMCalcoloMotore !== 'undefined')
      ? FCMCalcoloMotore.calcolaTotaliSquadre(sommaCasa + this.modXCasa, sommaFuori + this.modXFuori, mods, fCampo)
      : {
        totaleCasa: Number((sommaCasa + fCampo + mods.modPortiereCasa + mods.modDifesaFuori + mods.modCentroCasa + mods.modAttaccoCasa + this.modXCasa).toFixed(2)),
        totaleFuori: Number((sommaFuori + mods.modPortiereFuori + mods.modDifesaCasa + mods.modCentroFuori + mods.modAttaccoFuori + this.modXFuori).toFixed(2))
      };
    const totaleCasa = totali.totaleCasa;
    const totaleFuori = totali.totaleFuori;

    // 6. Calcolo Gol (scaglioni fgol1..15, diffT pareggio forzato e autogol squadra)
    const gol = this.calcolaGolSquadre(totaleCasa, totaleFuori);

    // 7. Apertura modale risultato (Stile identico a #liveVU)
    this.apriModalRisultato({
      match,
      resCasa,
      resFuori,
      sommaCasa,
      sommaFuori,
      fCampo,
      mods,
      totaleCasa,
      totaleFuori,
      gol
    });
  },

  /**
   * Sostituzioni rigide FCM: delega al motore unificato FCMCalcoloMotore
   */
  applicaSostituzioni(starters, bench) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.eseguiSostituzioni(starters, bench);
    }
    return { titolariFinali: starters, sostituzioniEffettuate: [], numSost: 0, numRiserveUfficio: 0 };
  },

  /**
   * Calcolo di tutti i modificatori FCM ufficiali: delega a FCMCalcoloMotore
   */
  calcolaTuttiModificatori(attiviCasa, attiviFuori) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaModificatori(attiviCasa, attiviFuori);
    }
    return {
      modDifesaCasa: 0, modDifesaFuori: 0, modCentroCasa: 0, modCentroFuori: 0,
      modPortiereCasa: 0, modPortiereFuori: 0, modAttaccoCasa: 0, modAttaccoFuori: 0,
      isModD: false, isModC: false, isModP: false, isModA: false
    };
  },

  /**
   * Calcolo scaglioni gol (fgol1..15) e pareggio forzato diffT: delega a FCMCalcoloMotore
   */
  calcolaGolSquadre(totCasa, totFuori) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaGolSquadre(totCasa, totFuori);
    }
    return [0, 0];
  },

  /**
   * Mostra il modale con il riepilogo dettagliato del risultato calcolato.
   * Utilizza la stessa struttura e gli stessi stili CSS di #liveVU.
   */
  apriModalRisultato(d) {
    const modal = this.container.querySelector('#calcModalInPage');
    if (!modal) return;

    const formatSign = (val) => (val > 0 ? `+${val}` : `${val}`);
    const hasModX = typeof modX !== 'undefined' && (modX === 1 || modX === '1');
    const isAutoGolActive = typeof autoGol !== 'undefined' && (autoGol === 1 || autoGol === '1' || autoGol === true);
    const pAutogol_val = typeof pAutogol !== 'undefined' ? Number(pAutogol) : 59;
    const pScarAutogol_val = typeof pScarAutogol !== 'undefined' ? Number(pScarAutogol) : 3;

    modal.innerHTML = `
      <div class="calc-modal-card" style="max-width: 600px;">
        <div class="calc-modal-header">
          <h3 class="calc-modal-title">Simulazione Risultato</h3>
          <button type="button" class="calc-modal-close-btn" id="btnCloseCalcModal" aria-label="Chiudi">&times;</button>
        </div>

        <div class="calc-score-box">
          <div class="calc-score-team">
            <div style="font-size:1.05rem; font-weight:800;">${d.match.homeTeamName}</div>
            <div class="calc-score-total">Totale: <b>${d.totaleCasa} pt</b></div>
          </div>
          <div class="calc-score-goals">
            ${d.gol[0]} - ${d.gol[1]}
          </div>
          <div class="calc-score-team">
            <div style="font-size:1.05rem; font-weight:800;">${d.match.awayTeamName}</div>
            <div class="calc-score-total">Totale: <b>${d.totaleFuori} pt</b></div>
          </div>
        </div>

        ${(d.gol.autogolCasa || d.gol.autogolFuori) ? `
          <div style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.35); border-radius:8px; padding:6px 12px; margin: 0 0 12px 0; font-size:0.8rem; color:var(--text-primary); text-align:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:4px;color:var(--accent-green, #10b981);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <b>Gol Omaggio (Autogol):</b> Assegnato +1 gol a <b>${d.gol.autogolCasa ? d.match.homeTeamName : d.match.awayTeamName}</b> (avversario &lt; ${pAutogol_val} pt con scarto &ge; ${pScarAutogol_val} pt)
          </div>
        ` : ''}

        <table class="calc-detail-table">
          <thead>
            <tr>
              <th style="width:50%; text-align:center;">${d.match.homeTeamName}</th>
              <th style="width:50%; text-align:center;">${d.match.awayTeamName}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Parziale squadra:</span>
                  <span class="calc-row-val">${d.sommaCasa.toFixed(2)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Parziale squadra:</span>
                  <span class="calc-row-val">${d.sommaFuori.toFixed(2)} pt</span>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Fattore campo:</span>
                  <span class="calc-row-val">+${d.fCampo} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Fattore campo:</span>
                  <span class="calc-row-val">0 pt</span>
                </div>
              </td>
            </tr>
            ${d.mods.isModP ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Portiere:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modPortiereCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Portiere:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modPortiereFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${d.mods.isModD ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Difesa:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modDifesaFuori)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Difesa:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modDifesaCasa)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${d.mods.isModC ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Centrocampo:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modCentroCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Centrocampo:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modCentroFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${d.mods.isModA ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Attacco:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modAttaccoCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Attacco:</span>
                  <span class="calc-row-val">${formatSign(d.mods.modAttaccoFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${hasModX ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Personalizzato:</span>
                  <span class="calc-row-val">${formatSign(this.modXCasa)} pt</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Mod. Personalizzato:</span>
                  <span class="calc-row-val">${formatSign(this.modXFuori)} pt</span>
                </div>
              </td>
            </tr>` : ''}
            ${isAutoGolActive ? `<tr>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Gol Omaggio (Autogol):</span>
                  <span class="calc-row-val" style="${d.gol.autogolCasa ? 'color:var(--accent-green, #10b981);font-weight:800;' : ''}">${d.gol.autogolCasa ? '+1 gol' : '0'}</span>
                </div>
              </td>
              <td>
                <div class="calc-row-item">
                  <span class="calc-row-label">Gol Omaggio (Autogol):</span>
                  <span class="calc-row-val" style="${d.gol.autogolFuori ? 'color:var(--accent-green, #10b981);font-weight:800;' : ''}">${d.gol.autogolFuori ? '+1 gol' : '0'}</span>
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
            <b style="color:var(--text-primary);">${d.match.homeTeamName}:</b><br>
            ${this._formatSostituzioniHtml(d.resCasa.sostituzioniEffettuate)}
          </div>
          <div style="flex:1; text-align:center;">
            <b style="color:var(--text-primary);">${d.match.awayTeamName}:</b><br>
            ${this._formatSostituzioniHtml(d.resFuori.sostituzioniEffettuate)}
          </div>
        </div>

        <div style="text-align: center; margin-top: 18px;">
          <button type="button" class="btn-modern-action" id="btnModalCloseOk" style="width:100%; max-width:200px;">
            Chiudi Risultato
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const close = () => { modal.style.display = 'none'; };
    const closeBtn = modal.querySelector('#btnCloseCalcModal');
    const closeOk = modal.querySelector('#btnModalCloseOk');
    if (closeBtn) closeBtn.onclick = close;
    if (closeOk) closeOk.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  },

  _formatSostituzioniHtml(sostArr) {
    if (!sostArr || sostArr.length === 0) {
      return '<span style="color:var(--text-muted); font-size:0.8rem;">Nessuna</span>';
    }

    const effettuate = sostArr.filter(s => s.tipo !== 'nessuna');
    const nonSost = sostArr.filter(s => s.tipo === 'nessuna');

    let html = '';

    if (effettuate.length === 0) {
      html += '<div style="color:var(--text-muted); font-size:0.8rem;">Nessuna</div>';
    } else {
      html += effettuate.map(s => {
        const isUfficio = s.tipo === 'ufficio' || (s.entrato && s.entrato.toLowerCase().includes("riserva d'ufficio"));
        const entratoColor = isUfficio ? '#f59e0b' : '#10b981';
        return `
          <div style="font-size:0.78rem; margin:2px 0; color:var(--text-secondary);">
            <span style="color:#ef4444;">${this.formatCognome(s.uscito)}</span> &rarr; <span style="color:${entratoColor}; font-weight:600;">${this.formatCognome(s.entrato)}</span>
          </div>
        `;
      }).join('');
    }

    if (nonSost.length > 0) {
      const nomi = nonSost.map(s => this.formatCognome(s.uscito)).join(', ');
      html += `
        <div style="margin-top:6px; font-size:0.72rem; color:var(--text-muted);">
          <b>Non sostituiti (0 pt):</b> ${nomi}
        </div>
      `;
    }

    return html;
  },

  /**
   * MODALE / DRAWER ADMIN IMPOSTAZIONI REGOLE CALCOLO
   * Stile e logica perfettamente conformi all'apertura standalone di impostazioni_calcolo.php
   */
  async openSettingsModal() {
    const modal = this.container.querySelector('#calcSettingsModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="calc-modal-card calc-settings-modal-card">
        <div class="calc-modal-header calc-settings-modal-header">
          <div class="calc-settings-modal-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="2.2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <h3 class="calc-modal-title">Parametri di Calcolo Risultati</h3>
          </div>
          <div class="calc-settings-modal-header-right">
            <div id="modalAdminLogoutWrap" style="display: none;">
              <button type="button" class="invform-back-btn btnLogoutAdminCalcolo" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-weight: 700; padding: 6px 12px; font-size: 0.82rem; cursor: pointer; border-radius: 8px; background: transparent;" title="Esci dalla sessione amministratore">
                <span>🚪 Esci</span>
              </button>
            </div>
            <a href="inc/impostazioni_calcolo.php" id="btnModalExpandScreen" target="_blank" class="calc-modal-expand-btn" title="Espandi a tutto schermo e apri direttamente impostazioni_calcolo.php">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h6v6"></path>
                <path d="M9 21H3v-6"></path>
                <path d="M21 3l-7 7"></path>
                <path d="M3 21l7-7"></path>
              </svg>
            </a>
            <button type="button" class="calc-modal-close-btn" id="btnCloseSettingsModal" aria-label="Chiudi">&times;</button>
          </div>
        </div>

        <div id="calcSettingsModalContent" class="calc-settings-modal-content">
          <div style="text-align: center; padding: 40px;">
            <div class="calcolo-loading-spinner"></div>
            <div style="margin-top: 12px; color: var(--text-muted);">Verifica autenticazione amministratore...</div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector('#btnCloseSettingsModal');
    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    // Fetch stato e definizioni da impostazioni_calcolo.php
    try {
      const res = await fetch(`inc/impostazioni_calcolo.php?action=get_calcolo_vars&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Errore chiamata API impostazioni");
      const data = await res.json();

      this.settingsModalState.isAdmin = !!data.isAdmin;
      this.settingsModalState.isConfigured = !!data.isConfigured;
      this.settingsModalState.lastUpdated = data.lastUpdated || '';
      this.settingsModalState.definitions = data.definitions || {};
      this.settingsModalState.currentValues = { ...(data.currentValues || {}) };
      this.settingsModalState.initialValues = { ...(data.currentValues || {}) };

      this.renderSettingsModalBody();
    } catch (e) {
      const c = modal.querySelector('#calcSettingsModalContent');
      if (c) {
        c.innerHTML = `
          <div style="text-align: center; color: #ef4444; padding: 30px;">
            <div style="font-weight: 700;">Impossibile comunicare con il server</div>
            <div style="font-size: 0.84rem; margin-top: 6px; color: var(--text-muted);">${e.message}</div>
          </div>
        `;
      }
    }
  },

  /**
   * Renderizza il contenuto del modale impostazioni (Login o Schede variabili con stile standalone)
   */
  renderSettingsModalBody() {
    const modal = this.container.querySelector('#calcSettingsModal');
    const content = modal ? modal.querySelector('#calcSettingsModalContent') : null;
    const logoutWrap = modal ? modal.querySelector('#modalAdminLogoutWrap') : null;
    if (!content) return;

    const eseguiLogout = async () => {
      try {
        await fetch('inc/impostazioni_calcolo.php?action=admin_logout');
      } catch (e) { }
      this.settingsModalState.isAdmin = false;
      this.renderSettingsModalBody();
    };

    if (logoutWrap) {
      logoutWrap.style.display = this.settingsModalState.isAdmin ? 'block' : 'none';
      const btnLogout = logoutWrap.querySelector('.btnLogoutAdminCalcolo');
      if (btnLogout) {
        btnLogout.onclick = eseguiLogout;
      }
    }

    if (!this.settingsModalState.isAdmin) {
      // SCHERMATA LOGIN ADMIN (Identica a impostazioni_calcolo.php)
      content.innerHTML = `
        <div class="calc-admin-login-card">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); color: var(--accent-primary, #3b82f6); margin-bottom: 12px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Accesso Riservato Amministratore</h2>
            <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
              Inserisci la password di amministrazione (configurata in <code>admin_config.inc.php</code>) per gestire e modificare i parametri del calcolo risultati.
            </p>
          </div>

          <form id="formAdminLoginCalcolo">
            <div style="margin-bottom: 20px;">
              <label for="inputAdminPwdCalcolo" style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Password Amministrazione:</label>
              <input type="password" id="inputAdminPwdCalcolo" class="inv-password-input" placeholder="Inserisci password admin..." required autofocus style="width: 100%; box-sizing: border-box; padding: 10px 14px; font-size: 0.95rem; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated, #1e293b); color: var(--text-primary);">
            </div>
            <button type="submit" class="inv-btn-submit btn-primary" style="width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; border-radius: 8px; margin-bottom: 12px; border: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="M21 2l-9.6 9.6"></path><path d="M15.5 7.5l3 3L22 7l-3-3"></path></svg>
              <span>Sblocca Pannello Configurazione</span>
            </button>
            <div id="loginAdminError" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; font-weight: 600; margin-top: 14px; text-align: center; display: none;"></div>
          </form>
        </div>
      `;

      const form = content.querySelector('#formAdminLoginCalcolo');
      const errEl = content.querySelector('#loginAdminError');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const pwd = form.querySelector('#inputAdminPwdCalcolo').value;
          try {
            const formData = new FormData();
            formData.append('action', 'admin_login');
            formData.append('pwd', pwd);

            const r = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: formData });
            const resp = await r.json();
            if (resp.success) {
              this.settingsModalState.isAdmin = true;
              this.renderSettingsModalBody();
            } else {
              if (errEl) { errEl.textContent = resp.error || 'Password errata.'; errEl.style.display = 'block'; }
            }
          } catch (err) {
            if (errEl) { errEl.textContent = 'Errore di connessione.'; errEl.style.display = 'block'; }
          }
        });
      }
      return;
    }

    // PANNELLO AMMINISTRATORE STANDALONE STYLE
    const defs = this.settingsModalState.definitions;
    const cur = this.settingsModalState.currentValues;
    const initVals = this.settingsModalState.initialValues || cur;

    const renderActionBar = (isStickyBottom = false) => `
      <div class="calc-actions-bar ${isStickyBottom ? 'is-sticky-bottom' : ''}">
        <div class="badge-wrap">
          <span class="badge-status-changes no-changes badgeChanges">
            <span class="calc-badge-dot no-changes"></span> Nessuna modifica non salvata
          </span>
        </div>
        <div class="calc-actions-buttons">
          <button type="button" class="calc-btn-action calc-btn-cancel btnCancelChanges" disabled title="Annulla le modifiche e ripristina i valori originali">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            <span>Annulla modifiche</span>
          </button>
          <button type="button" class="calc-btn-action calc-btn-save btnSaveModifiche" disabled title="Salva le modifiche su fcmCalcolorisultatiVariabili.js">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Salva modifiche</span>
          </button>
        </div>
      </div>
    `;

    // Mappatura icone SVG per le sezioni
    const getSectionIconSvg = (secKey) => {
      switch (secKey) {
        case 'base':
          return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        case 'gioco':
          return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald, #10b981)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="12 6 15 10 13 14 11 14 9 10 12 6"></polygon></svg>`;
        case 'calcolo':
          return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber, #f59e0b)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>`;
        case 'fasce':
          return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan, #06b6d4)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
        default:
          return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
      }
    };

    let sectionsHtml = '';
    for (const [secKey, section] of Object.entries(defs)) {
      // Pulisce l'eventuale emoji dal titolo per usare solo icone SVG conformi
      const cleanTitle = (section.title || '').replace(/^[^\w\s(]+/u, '').trim();
      const iconSvg = getSectionIconSvg(secKey);

      sectionsHtml += `
        <section class="calc-card-section">
          <div class="calc-section-header">
            <div>
              <h3 class="calc-section-title">
                ${iconSvg}
                <span>${cleanTitle}</span>
              </h3>
              <p class="calc-section-desc">${section.desc || ''}</p>
            </div>
          </div>
          <div class="calc-settings-grid">
            ${Object.entries(section.fields).map(([key, field]) => {
        const currentVal = cur[key] !== undefined ? cur[key] : (field.type === 'boolean' ? 0 : 0);
        const initialVal = initVals[key] !== undefined ? initVals[key] : currentVal;
        return `
                <div class="calc-field-row" id="row_modal_${key}" data-var="${key}">
                  <div class="calc-field-label-wrap">
                    <span class="calc-field-label">${field.label}</span>
                    <code class="calc-field-varname">${key}</code>
                  </div>
                  <div class="calc-field-desc">${field.desc || ''}</div>
                  <div class="calc-control-wrap">
                    ${field.type === 'boolean' ? `
                      <div class="toggle-switch" data-var="${key}" role="group" aria-label="${field.label}">
                        <button type="button" class="toggle-btn-opt opt-si ${currentVal == 1 ? 'active' : ''}" data-value="1">Sì</button>
                        <button type="button" class="toggle-btn-opt opt-no ${currentVal == 0 ? 'active' : ''}" data-value="0">No</button>
                      </div>
                      <input type="hidden" id="input_modal_${key}" name="${key}" value="${currentVal == 1 ? '1' : '0'}" data-initial="${initialVal == 1 ? '1' : '0'}">
                    ` : `
                      <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Valore:</div>
                      <input type="number" step="${field.step || 'any'}" id="input_modal_${key}" name="${key}" class="calc-input-number" value="${currentVal}" data-initial="${initialVal}">
                    `}
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </section>
      `;
    }

    content.innerHTML = `
      <!-- BANNER SESSIONE AMMINISTRATORE ATTIVA (Conforme a standalone) -->
      <div class="calc-admin-session-banner">
        <div class="calc-admin-session-banner-info">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <div>
            <strong class="calc-admin-session-title">Sessione Amministratore Attiva</strong>
            <span class="calc-admin-session-desc">
              File target: <code>js/fcmCalcolorisultatiVariabili.js</code>. I parametri salvati vengono aggiornati istantaneamente per il calcolo dei risultati online.
            </span>
          </div>
        </div>
        <div class="calc-admin-session-banner-actions">
          <div id="modalLastSavedNotice" class="calc-admin-last-sync">
            ${this.settingsModalState.lastUpdated ? `Ultima sincronizzazione file: ${this.settingsModalState.lastUpdated}` : ''}
          </div>
          <button type="button" class="invform-back-btn btnModalBannerLogout" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); padding: 6px 10px; font-size: 0.76rem; font-weight: 700; cursor: pointer; border-radius: 6px; background: transparent; display: inline-flex; align-items: center; gap: 5px;" title="Esci dalla sessione amministratore">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Esci</span>
          </button>
        </div>
      </div>

      <!-- BARRA TAB AMMINISTRATORE -->
      <div class="admin-tab-bar" style="margin-bottom: 18px;">
        <button type="button" class="admin-tab-btn ${this.settingsModalState.adminMainTab === 'calc' ? 'active' : ''}" id="modalTabBtnCalc">
          <span style="font-size: 1.05rem;">⚙️</span>
          <span>Parametri Calcolo</span>
        </button>
        <button type="button" class="admin-tab-btn ${this.settingsModalState.adminMainTab === 'assoc' ? 'active' : ''}" id="modalTabBtnAssoc">
          <span style="font-size: 1.05rem;">🌐</span>
          <span>Associazioni Voti Ufficiosi (liveVU)</span>
        </button>
        <button type="button" class="admin-tab-btn ${this.settingsModalState.adminMainTab === 'assoc-fp' ? 'active' : ''}" id="modalTabBtnAssocFp">
          <span style="font-size: 1.05rem;">⚡</span>
          <span>Associazioni Fantapazz (liveFP)</span>
        </button>
      </div>

      <!-- TAB 1: PARAMETRI CALCOLO -->
      <div id="modalTabContentCalc" style="${this.settingsModalState.adminMainTab === 'calc' ? 'display: block;' : 'display: none;'}">
        <form id="formSettingsCalcolo" class="calc-settings-form-container" onsubmit="return false;">
          <!-- ACTION BAR SUPERIORE -->
          ${renderActionBar(false)}

          <!-- SEZIONI CARD STANDALONE -->
          ${sectionsHtml}

          <!-- ACTION BAR INFERIORE (Sticky Bottom) -->
          ${renderActionBar(true)}
        </form>
      </div>

      <!-- TAB 2: GESTIONE ASSOCIAZIONI VOTI UFFICIOSI (liveVU) -->
      <div id="modalTabContentAssoc" style="${this.settingsModalState.adminMainTab === 'assoc' ? 'display: block;' : 'display: none;'}">
        ${this.renderAssocModalTabHtml()}
      </div>

      <!-- TAB 3: GESTIONE ASSOCIAZIONI FANTAPAZZ (liveFP) -->
      <div id="modalTabContentAssocFp" style="${this.settingsModalState.adminMainTab === 'assoc-fp' ? 'display: block;' : 'display: none;'}">
        ${this.renderFpAssocModalTabHtml()}
      </div>
    `;

    // Logout da banner
    const btnBannerLogout = content.querySelector('.btnModalBannerLogout');
    if (btnBannerLogout) {
      btnBannerLogout.onclick = eseguiLogout;
    }

    // Gestione Switch Tab (3 Schede Indipendenti)
    const btnTabCalc = content.querySelector('#modalTabBtnCalc');
    const btnTabAssoc = content.querySelector('#modalTabBtnAssoc');
    const btnTabAssocFp = content.querySelector('#modalTabBtnAssocFp');
    const tabContentCalc = content.querySelector('#modalTabContentCalc');
    const tabContentAssoc = content.querySelector('#modalTabContentAssoc');
    const tabContentAssocFp = content.querySelector('#modalTabContentAssocFp');
    const btnExpand = modal.querySelector('#btnModalExpandScreen');
    const modalTitle = modal.querySelector('.calc-modal-title');

    const switchModalTab = (tab) => {
      this.settingsModalState.adminMainTab = tab;
      if (btnTabCalc) btnTabCalc.classList.toggle('active', tab === 'calc');
      if (btnTabAssoc) btnTabAssoc.classList.toggle('active', tab === 'assoc');
      if (btnTabAssocFp) btnTabAssocFp.classList.toggle('active', tab === 'assoc-fp');

      if (tabContentCalc) tabContentCalc.style.display = (tab === 'calc') ? 'block' : 'none';
      if (tabContentAssoc) tabContentAssoc.style.display = (tab === 'assoc') ? 'block' : 'none';
      if (tabContentAssocFp) tabContentAssocFp.style.display = (tab === 'assoc-fp') ? 'block' : 'none';

      if (btnExpand) {
        if (tab === 'assoc') btnExpand.href = 'inc/impostazioni_calcolo.php#assoc';
        else if (tab === 'assoc-fp') btnExpand.href = 'inc/impostazioni_calcolo.php#assoc-fp';
        else btnExpand.href = 'inc/impostazioni_calcolo.php#calc';
      }

      if (modalTitle) {
        if (tab === 'assoc') modalTitle.textContent = 'Associazioni Voti Ufficiosi (liveVU)';
        else if (tab === 'assoc-fp') modalTitle.textContent = 'Associazioni Live Fantapazz (liveFP)';
        else modalTitle.textContent = 'Parametri di Calcolo Risultati';
      }

      if (tab === 'assoc' && (!this.settingsModalState.assocItems || this.settingsModalState.assocItems.length === 0)) {
        this.loadCurrentAssocInModal(content);
      } else if (tab === 'assoc-fp' && (!this.settingsModalState.fpAssocItems || this.settingsModalState.fpAssocItems.length === 0)) {
        this.loadCurrentFpAssocInModal(content);
      }
    };

    if (btnTabCalc) btnTabCalc.onclick = () => switchModalTab('calc');
    if (btnTabAssoc) btnTabAssoc.onclick = () => switchModalTab('assoc');
    if (btnTabAssocFp) btnTabAssocFp.onclick = () => switchModalTab('assoc-fp');

    // Sincronizza stato iniziale
    switchModalTab(this.settingsModalState.adminMainTab || 'calc');

    // Reset dello scroll all'inizio per mostrare banner e action bar
    content.scrollTop = 0;

    // Attivazione logica modifiche, toggle e salvataggio per Tab 1
    this.initSettingsModalFormLogic(content);

    // Attivazione logica per Tab 2 (liveVU)
    this.initAssocModalTabLogic(content);

    // Attivazione logica per Tab 3 (liveFP Fantapazz)
    this.initFpAssocModalTabLogic(content);
  },

  /**
   * Logica interattiva di evidenziazione modifiche, toggle e salvataggio conforme allo standalone
   */
  initSettingsModalFormLogic(content) {
    const modifiedKeys = new Set();
    const allInputs = content.querySelectorAll('input[data-initial]');
    const btnSaveList = content.querySelectorAll('.btnSaveModifiche');
    const btnCancelList = content.querySelectorAll('.btnCancelChanges');
    const badgeList = content.querySelectorAll('.badgeChanges');

    const checkFormChanges = () => {
      modifiedKeys.clear();
      allInputs.forEach(input => {
        const initial = input.getAttribute('data-initial');
        const current = input.value;
        const varKey = input.name;
        const row = content.querySelector(`#row_modal_${varKey}`);

        let isDiff = false;
        if (!isNaN(parseFloat(initial)) && !isNaN(parseFloat(current))) {
          isDiff = (parseFloat(initial) !== parseFloat(current));
        } else {
          isDiff = (initial !== current);
        }

        if (isDiff) {
          modifiedKeys.add(varKey);
          if (row) row.classList.add('is-modified');
        } else {
          if (row) row.classList.remove('is-modified');
        }
      });

      const hasModifications = (modifiedKeys.size > 0);

      btnSaveList.forEach(btn => { btn.disabled = !hasModifications; });
      btnCancelList.forEach(btn => { btn.disabled = !hasModifications; });

      badgeList.forEach(badge => {
        if (hasModifications) {
          badge.className = 'badge-status-changes has-changes badgeChanges';
          badge.innerHTML = `<span class="calc-badge-dot has-changes"></span> ${modifiedKeys.size} ${modifiedKeys.size === 1 ? 'modifica non salvata' : 'modifiche non salvate'}`;
        } else {
          badge.className = 'badge-status-changes no-changes badgeChanges';
          badge.innerHTML = `<span class="calc-badge-dot no-changes"></span> Nessuna modifica non salvata`;
        }
      });
    };

    const setBoolVal = (key, val) => {
      const hiddenInput = content.querySelector(`#input_modal_${key}`);
      if (!hiddenInput) return;
      hiddenInput.value = val.toString();

      const row = content.querySelector(`#row_modal_${key}`);
      if (row) {
        const toggleContainer = row.querySelector('.toggle-switch');
        if (toggleContainer) {
          const btns = toggleContainer.querySelectorAll('.toggle-btn-opt');
          btns.forEach(b => {
            const bVal = b.getAttribute('data-value');
            if (bVal === val.toString()) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        }
      }
      checkFormChanges();
    };

    // Bind eventi toggle switch
    content.querySelectorAll('.toggle-switch').forEach(sw => {
      const varKey = sw.getAttribute('data-var');
      sw.querySelectorAll('.toggle-btn-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.getAttribute('data-value'), 10);
          setBoolVal(varKey, val);
        });
      });
    });

    // Bind eventi input numerici
    content.querySelectorAll('.calc-input-number').forEach(inp => {
      inp.addEventListener('input', checkFormChanges);
      inp.addEventListener('change', checkFormChanges);
    });

    // Annulla modifiche (conforme a standalone)
    btnCancelList.forEach(btn => {
      btn.addEventListener('click', () => {
        allInputs.forEach(input => {
          const initial = input.getAttribute('data-initial');
          input.value = initial;
          const varKey = input.name;

          if (input.type === 'hidden') {
            setBoolVal(varKey, parseInt(initial, 10));
          }
        });
        checkFormChanges();
        this.showToast("Modifiche ripristinate ai valori attuali.");
      });
    });

    // Salva modifiche (conforme a standalone)
    btnSaveList.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled || modifiedKeys.size === 0) return;

        btnSaveList.forEach(b => {
          b.disabled = true;
          b.innerHTML = '<span>⏳ Salvataggio...</span>';
        });
        btnCancelList.forEach(b => { b.disabled = true; });

        const formData = new FormData();
        formData.append('action', 'save_calcolo_vars');
        allInputs.forEach(input => {
          formData.append(`vars[${input.name}]`, input.value);
          this.settingsModalState.currentValues[input.name] = input.value;
        });

        try {
          const res = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: formData });
          const resp = await res.json();

          if (resp.success) {
            allInputs.forEach(input => {
              input.setAttribute('data-initial', input.value);
            });
            this.settingsModalState.initialValues = { ...this.settingsModalState.currentValues };
            if (resp.updated) {
              this.settingsModalState.lastUpdated = resp.updated;
              const notice = content.querySelector('#modalLastSavedNotice');
              if (notice) notice.textContent = 'Ultima sincronizzazione file: ' + resp.updated;
            }
            checkFormChanges();

            // Ricarica a caldo lo script in memoria
            if (typeof fcmDataLoader !== 'undefined') {
              await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js', true);
            }

            // Ricalcola i voti nella schermata se aperta
            if (this.matchObj) {
              this.estraiFormazioniSquadre();
              this.renderTabellonePartita();
            }

            this.showToast("✅ Parametri salvati con successo su fcmCalcoloRisultatiVariabili.js!");
          } else {
            alert("Errore salvataggio: " + (resp.error || "Errore sconosciuto"));
            checkFormChanges();
          }
        } catch (e) {
          alert("Errore durante il salvataggio: " + e.message);
          checkFormChanges();
        } finally {
          btnSaveList.forEach(b => {
            b.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Salva modifiche</span>
            `;
          });
        }
      });
    });

    // Controllo iniziale
    checkFormChanges();
  },

  /**
   * Renderizza l'interfaccia HTML del Tab Associazioni Live nel modale
   */
  renderAssocModalTabHtml() {
    return `
      <!-- BANNER INTESTAZIONE MODULO ASSOCIAZIONI -->
      <div class="assoc-header-banner">
        <div>
          <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>🔗</span>
            <span>Gestione e Aggiornamento Associazioni Live</span>
          </h4>
          <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            Associa i giocatori attivi in <strong>Serie A</strong> con le quotazioni di <strong>Pianetafanta.it</strong> e <strong>Fantacalcio.it</strong> per aggiornare <code>liveVU_associazioni.php</code>.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="calc-btn-action" id="modalBtnLoadCurrent" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px; cursor: pointer;">
            <span>👁️ Ispeziona Stato Attuale</span>
          </button>
        </div>
      </div>

      <!-- SEZIONE UPLOAD FILE EXCEL -->
      <div class="assoc-upload-grid">
        <div class="assoc-upload-box" id="modalBoxUploadPF">
          <div class="assoc-upload-icon">🌐</div>
          <div class="assoc-upload-title">1. Quotazioni Pianetafanta.it</div>
          <div class="assoc-upload-subtitle">Template: <code>quotazioni-giornataX.xlsx</code></div>
          <label class="assoc-file-label">
            <input type="file" id="modalFileExcelPF" accept=".xlsx">
            <span>📁 Seleziona File (.xlsx)</span>
          </label>
          <div class="assoc-file-selected-name" id="modalFileNamePF">Nessun file selezionato</div>
        </div>

        <div class="assoc-upload-box" id="modalBoxUploadFC">
          <div class="assoc-upload-icon">⚽</div>
          <div class="assoc-upload-title">2. Quotazioni Fantacalcio.it</div>
          <div class="assoc-upload-subtitle">Template: <code>Quotazioni_Fantacalcio_...xlsx</code></div>
          <label class="assoc-file-label">
            <input type="file" id="modalFileExcelFC" accept=".xlsx">
            <span>📁 Seleziona File (.xlsx)</span>
          </label>
          <div class="assoc-file-selected-name" id="modalFileNameFC">Nessun file selezionato</div>
        </div>
      </div>

      <!-- PULSANTE ANALISI -->
      <div style="text-align: center; margin: 16px 0 22px 0;">
        <button type="button" id="modalBtnAnalyzeAssoc" class="calc-btn-action calc-btn-save" style="padding: 12px 28px; font-size: 0.95rem; border-radius: 12px; cursor: pointer;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Analizza ed Elabora Associazioni</span>
        </button>
      </div>

      <!-- WORKSPACE RISULTATI -->
      <div id="modalAssocWorkspace" style="display: none;">
        <!-- STATS CARDS -->
        <div class="assoc-stats-grid">
          <div class="assoc-stat-card">
            <div class="assoc-stat-val" id="modalStatTotalFcm">0</div>
            <div class="assoc-stat-lbl">Giocatori Serie A FCM</div>
          </div>
          <div class="assoc-stat-card stat-card-confirmed">
            <div class="assoc-stat-val" id="modalStatConfirmed">0</div>
            <div class="assoc-stat-lbl">✅ Convalidati / Sicuri</div>
          </div>
          <div class="assoc-stat-card stat-card-doubtful">
            <div class="assoc-stat-val" id="modalStatDoubtful">0</div>
            <div class="assoc-stat-lbl">⚠️ Da Risolvere</div>
          </div>
          <div class="assoc-stat-card stat-card-notfound">
            <div class="assoc-stat-val" id="modalStatNotFound">0</div>
            <div class="assoc-stat-lbl">⚪ Non Trovati / Vuoti</div>
          </div>
        </div>

        <!-- TOOLBAR FILTRI -->
        <div class="assoc-toolbar">
          <div class="assoc-filter-pills" id="modalAssocPills">
            <button type="button" class="assoc-pill-btn active" data-filter="all">Tutti (<span id="modalCountPillAll">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-doubtful" data-filter="dubbio">⚠️ Da Risolvere (<span id="modalCountPillDoubtful">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-confirmed" data-filter="confermato">✅ Convalidati (<span id="modalCountPillConfirmed">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-notfound" data-filter="non_trovato">⚪ Non Trovati (<span id="modalCountPillNotFound">0</span>)</button>
          </div>
          <div class="assoc-search-wrap">
            <input type="text" id="modalAssocSearchInput" class="assoc-search-input" placeholder="🔍 Filtra nome o squadra...">
          </div>
        </div>

        <!-- TABELLA INTERATTIVA -->
        <div class="assoc-table-wrap">
          <table class="assoc-table">
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;">R</th>
                <th>Giocatore FCM</th>
                <th>Squadra Serie A</th>
                <th style="width: 130px; text-align: center;">Stato</th>
                <th style="min-width: 240px;">Pianetafanta.it</th>
                <th style="min-width: 240px;">Fantacalcio.it</th>
                <th style="width: 80px; text-align: center;">Azione</th>
              </tr>
            </thead>
            <tbody id="modalAssocTableBody">
            </tbody>
          </table>
        </div>

        <!-- ACTION BAR STICKY BOTTOM SALVATAGGIO -->
        <div class="calc-actions-bar is-sticky-bottom" style="margin-top: 18px;">
          <div class="badge-wrap">
            <span class="badge-status-changes" id="modalAssocSaveStatusBadge">
              <span>⚪</span> In attesa di revisione
            </span>
          </div>
          <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-save" id="modalBtnSaveAssoc">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Salva liveVU_associazioni.php</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Inizializzazione eventi e logica del tab associazioni nel modale
   */
  initAssocModalTabLogic(content) {
    const filePF = content.querySelector('#modalFileExcelPF');
    const fileFC = content.querySelector('#modalFileExcelFC');
    const namePF = content.querySelector('#modalFileNamePF');
    const nameFC = content.querySelector('#modalFileNameFC');
    const boxPF = content.querySelector('#modalBoxUploadPF');
    const boxFC = content.querySelector('#modalBoxUploadFC');

    if (filePF) {
      filePF.onchange = () => {
        const f = filePF.files && filePF.files[0];
        if (f) {
          namePF.textContent = `📄 ${f.name} (${Math.round(f.size / 1024)} KB)`;
          boxPF.classList.add('has-file');
        } else {
          namePF.textContent = 'Nessun file selezionato';
          boxPF.classList.remove('has-file');
        }
      };
    }

    if (fileFC) {
      fileFC.onchange = () => {
        const f = fileFC.files && fileFC.files[0];
        if (f) {
          nameFC.textContent = `📄 ${f.name} (${Math.round(f.size / 1024)} KB)`;
          boxFC.classList.add('has-file');
        } else {
          nameFC.textContent = 'Nessun file selezionato';
          boxFC.classList.remove('has-file');
        }
      };
    }

    const btnAnalyze = content.querySelector('#modalBtnAnalyzeAssoc');
    if (btnAnalyze) {
      btnAnalyze.onclick = () => this.analyzeAssocFilesInModal(content);
    }

    const btnLoadCurrent = content.querySelector('#modalBtnLoadCurrent');
    if (btnLoadCurrent) {
      btnLoadCurrent.onclick = () => this.loadCurrentAssocInModal(content);
    }

    const pillBtns = content.querySelectorAll('#modalAssocPills .assoc-pill-btn');
    pillBtns.forEach(btn => {
      btn.onclick = () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settingsModalState.assocFilter = btn.getAttribute('data-filter') || 'all';
        this.renderAssocModalTable(content);
      };
    });

    const searchInput = content.querySelector('#modalAssocSearchInput');
    if (searchInput) {
      searchInput.oninput = () => {
        this.settingsModalState.assocSearch = searchInput.value.toLowerCase().trim();
        this.renderAssocModalTable(content);
      };
    }

    const btnSave = content.querySelector('#modalBtnSaveAssoc');
    if (btnSave) {
      btnSave.onclick = () => this.saveAssocInModal(content);
    }
  },

  /**
   * Ispezione dello stato attuale da liveVU_associazioni.php nel modale
   */
  async loadCurrentAssocInModal(content) {
    try {
      this.showToast("Caricamento stato attuale da liveVU_associazioni.php...");
      const res = await fetch(`inc/impostazioni_calcolo.php?assoc_action=get_current_state&_t=${Date.now()}`);
      const data = await res.json();
      if (!data.success) {
        alert("Errore: " + (data.error || "Impossibile caricare i dati"));
        return;
      }

      this.settingsModalState.unassignedPF = data.unassigned_pf || [];
      this.settingsModalState.unassignedFC = data.unassigned_fc || [];

      this.settingsModalState.assocItems = (data.items || []).map((item, idx) => {
        const hasPf = (item.codPF !== '' && item.codPF !== 0);
        const hasFc = (item.codFC !== '' && item.codFC !== 0);
        return {
          id: idx,
          codiceFCM: item.player.codice,
          idFCM: item.player.id,
          nomeFCM: item.player.nome,
          squadraFCM: item.player.squadra,
          ruoloFCM: item.player.ruolo,
          status: (hasPf || hasFc) ? 'confermato' : 'non_trovato',
          isDoubtful: false,
          conflict: false,
          pfSelected: hasPf ? { cod: item.codPF, nome: item.nomePF } : null,
          pfCandidates: [],
          fcSelected: hasFc ? { id: item.codFC, nome: item.nomeFC } : null,
          fcCandidates: [],
          isManualEdit: false
        };
      });

      const ws = content.querySelector('#modalAssocWorkspace');
      if (ws) ws.style.display = 'block';

      this.updateAssocModalStats(content);
      this.renderAssocModalTable(content);
      this.showToast(`Stato attuale caricato: ${data.total_fcm} giocatori Serie A rilevati.`);
    } catch (e) {
      alert("Errore di caricamento: " + e.message);
    }
  },

  /**
   * Analisi dei file Excel caricati nel modale
   */
  async analyzeAssocFilesInModal(content) {
    const filePF = content.querySelector('#modalFileExcelPF').files[0];
    const fileFC = content.querySelector('#modalFileExcelFC').files[0];

    if (!filePF || !fileFC) {
      alert("Seleziona entrambi i file Excel (Pianetafanta e Fantacalcio.it) per procedere.");
      return;
    }

    const btn = content.querySelector('#modalBtnAnalyzeAssoc');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Elaborazione e matching in corso...</span>';

    try {
      const fd = new FormData();
      fd.append('assoc_action', 'analyze_files');
      fd.append('excel_pf', filePF);
      fd.append('excel_fc', fileFC);

      const res = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: fd });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = oldText;

      if (!data.success) {
        alert("Errore analisi: " + (data.error || "Errore sconosciuto"));
        return;
      }

      this.settingsModalState.unassignedPF = data.unassigned_pf || [];
      this.settingsModalState.unassignedFC = data.unassigned_fc || [];

      this.settingsModalState.assocItems = (data.all || []).map((item, idx) => ({
        id: idx,
        codiceFCM: item.player.codice,
        idFCM: item.player.id,
        nomeFCM: item.player.nome,
        squadraFCM: item.player.squadra,
        ruoloFCM: item.player.ruolo,
        status: item.status,
        isDoubtful: item.is_doubtful,
        conflict: !!(item.pf_conflict || item.fc_conflict),
        pfSelected: item.pf_selected ? { cod: item.pf_selected.cod, nome: item.pf_selected.nome } : null,
        pfCandidates: item.pf_candidates || [],
        fcSelected: item.fc_selected ? { id: item.fc_selected.id, nome: item.fc_selected.nome } : null,
        fcCandidates: item.fc_candidates || [],
        isManualEdit: false
      }));

      const ws = content.querySelector('#modalAssocWorkspace');
      if (ws) ws.style.display = 'block';

      this.updateAssocModalStats(content);

      const doubtfulCount = this.settingsModalState.assocItems.filter(i => i.status === 'dubbio').length;
      const pills = content.querySelectorAll('#modalAssocPills .assoc-pill-btn');
      pills.forEach(b => b.classList.remove('active'));

      if (doubtfulCount > 0) {
        this.settingsModalState.assocFilter = 'dubbio';
        const pDubbio = content.querySelector('#modalAssocPills .pill-doubtful');
        if (pDubbio) pDubbio.classList.add('active');
        this.showToast(`Analisi completata: trovati ${doubtfulCount} casi da verificare o conflitti.`);
      } else {
        this.settingsModalState.assocFilter = 'all';
        const pAll = content.querySelector('#modalAssocPills [data-filter="all"]');
        if (pAll) pAll.classList.add('active');
        this.showToast("Analisi completata con successo! Tutte le corrispondenze sono univoche.");
      }

      this.renderAssocModalTable(content);
      if (ws) ws.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = oldText;
      alert("Errore durante l'elaborazione: " + e.message);
    }
  },

  /**
   * Aggiornamento contatori e badge stato del modale
   */
  updateAssocModalStats(content) {
    const items = this.settingsModalState.assocItems || [];
    let confirmed = 0;
    let doubtful = 0;
    let notFound = 0;

    items.forEach(i => {
      if (i.status === 'dubbio') doubtful++;
      else if (i.status === 'confermato') confirmed++;
      else notFound++;
    });

    const setT = (id, val) => {
      const el = content.querySelector('#' + id);
      if (el) el.textContent = val;
    };

    setT('modalStatTotalFcm', items.length);
    setT('modalStatConfirmed', confirmed);
    setT('modalStatDoubtful', doubtful);
    setT('modalStatNotFound', notFound);

    setT('modalCountPillAll', items.length);
    setT('modalCountPillDoubtful', doubtful);
    setT('modalCountPillConfirmed', confirmed);
    setT('modalCountPillNotFound', notFound);

    const statusBadge = content.querySelector('#modalAssocSaveStatusBadge');
    if (statusBadge) {
      if (doubtful > 0) {
        statusBadge.className = 'badge-status-changes has-changes';
        statusBadge.innerHTML = `<span>⚠️</span> ${doubtful} casi da risolvere rimanenti`;
      } else {
        statusBadge.className = 'badge-status-changes';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadge.style.color = 'var(--accent-emerald, #10b981)';
        statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusBadge.innerHTML = '<span>✅</span> Pronto al salvataggio univoco';
      }
    }
  },

  /**
   * Rendering della tabella interattiva nel modale
   */
  renderAssocModalTable(content) {
    const tbody = content.querySelector('#modalAssocTableBody');
    if (!tbody) return;

    const filter = this.settingsModalState.assocFilter || 'all';
    const term = this.settingsModalState.assocSearch || '';
    const items = this.settingsModalState.assocItems || [];

    const visible = items.filter(item => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (term !== '') {
        const matchNome = item.nomeFCM.toLowerCase().indexOf(term) > -1;
        const matchSq = item.squadraFCM.toLowerCase().indexOf(term) > -1;
        const matchCod = item.codiceFCM.toString().indexOf(term) > -1;
        if (!matchNome && !matchSq && !matchCod) return false;
      }
      return true;
    });

    if (visible.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 26px; color: var(--text-muted); font-size: 0.88rem;">Nessun giocatore corrisponde ai filtri selezionati.</td></tr>';
      return;
    }

    const esc = (s) => (s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');
    const normTeam = (t) => {
      if (!t) return '';
      t = String(t).toUpperCase().trim();
      if (t.indexOf('VERONA') > -1) return 'VERONA';
      if (t.indexOf('INTER') > -1) return 'INTER';
      if (t.indexOf('JUVE') > -1) return 'JUVENTUS';
      return t;
    };

    // Calcolo unassigned correnti per PF e FC
    const assignedPf = {};
    const assignedFc = {};
    items.forEach(it => {
      if (it.pfSelected && it.pfSelected.cod) assignedPf[it.pfSelected.cod] = true;
      if (it.fcSelected && it.fcSelected.id) assignedFc[it.fcSelected.id] = true;
    });
    const unassignedPfAll = (this.settingsModalState.unassignedPF || []).filter(p => !assignedPf[p.cod]);
    const unassignedFcAll = (this.settingsModalState.unassignedFC || []).filter(p => !assignedFc[p.id]);

    let html = '';
    visible.forEach(item => {
      const rowClass = (item.status === 'dubbio') ? 'row-doubtful' : '';

      let statusBadge = '';
      if (item.status === 'dubbio') {
        const badgeText = item.conflict ? '⚠️ Conflitto Univocità' : '⚠️ Da Risolvere';
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);">${badgeText}</span>`;
      } else if (item.status === 'confermato') {
        statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Confermato</span>';
      } else {
        statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: rgba(148, 163, 184, 0.1); color: #94a3b8;">⚪ Non Trovato</span>';
      }

      const isEditable = (item.status === 'dubbio' || item.status === 'non_trovato' || item.isManualEdit);

      // Colonna Pianetafanta
      let colPF = '';
      if (isEditable) {
        colPF = `<select class="assoc-cand-select sel-pf" data-id="${item.id}">`;
        colPF += '<option value="">-- Seleziona Pianetafanta --</option>';
        colPF += `<option value="EMPTY" ${!item.pfSelected ? 'selected' : ''}>[Nessuna corrispondenza / Lascia vuoto]</option>`;

        const candPfMap = {};
        if (item.pfCandidates && item.pfCandidates.length > 0) {
          colPF += `<optgroup label="Candidati Suggeriti (${item.pfCandidates.length})">`;
          item.pfCandidates.forEach(c => {
            candPfMap[c.cod] = true;
            const isSel = (item.pfSelected && item.pfSelected.cod == c.cod) ? 'selected' : '';
            colPF += `<option value="${c.cod}" ${isSel}>${esc(c.nome)} (${esc(c.squadra)} - ${c.ruolo || ''}) [Cod: ${c.cod}]</option>`;
          });
          colPF += '</optgroup>';
        }

        const sameTeamPf = unassignedPfAll.filter(p => !candPfMap[p.cod] && normTeam(p.squadra) === normTeam(item.squadraFCM));
        if (sameTeamPf.length > 0) {
          colPF += `<optgroup label="Non Assegnati - ${esc(item.squadraFCM)} (${sameTeamPf.length})">`;
          sameTeamPf.forEach(p => {
            candPfMap[p.cod] = true;
            const isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
            colPF += `<option value="${p.cod}" ${isSel}>${esc(p.nome)} (${esc(p.squadra)} - ${p.ruolo || ''}) [Cod: ${p.cod}]</option>`;
          });
          colPF += '</optgroup>';
        }

        const otherPf = unassignedPfAll.filter(p => !candPfMap[p.cod]);
        if (otherPf.length > 0) {
          colPF += `<optgroup label="Altri Non Assegnati (${otherPf.length})">`;
          otherPf.forEach(p => {
            const isSel = (item.pfSelected && item.pfSelected.cod == p.cod) ? 'selected' : '';
            colPF += `<option value="${p.cod}" ${isSel}>${esc(p.nome)} (${esc(p.squadra)} - ${p.ruolo || ''}) [Cod: ${p.cod}]</option>`;
          });
          colPF += '</optgroup>';
        }

        if (item.pfSelected && item.pfSelected.cod && !candPfMap[item.pfSelected.cod]) {
          colPF += '<optgroup label="Attualmente Selezionato">';
          colPF += `<option value="${item.pfSelected.cod}" selected>${esc(item.pfSelected.nome)} [Cod: ${item.pfSelected.cod}]</option>`;
          colPF += '</optgroup>';
        }

        colPF += '</select>';
      } else {
        if (item.pfSelected && item.pfSelected.cod) {
          colPF = `<span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">${esc(item.pfSelected.nome)}</span> <code style="font-size: 0.74rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 4px;">Cod: ${item.pfSelected.cod}</code>`;
        } else {
          colPF = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
        }
      }

      // Colonna Fantacalcio.it
      let colFC = '';
      if (isEditable) {
        colFC = `<select class="assoc-cand-select sel-fc" data-id="${item.id}">`;
        colFC += '<option value="">-- Seleziona Fantacalcio.it --</option>';
        colFC += `<option value="EMPTY" ${!item.fcSelected ? 'selected' : ''}>[Nessuna corrispondenza / Lascia vuoto]</option>`;

        const candFcMap = {};
        if (item.fcCandidates && item.fcCandidates.length > 0) {
          colFC += `<optgroup label="Candidati Suggeriti (${item.fcCandidates.length})">`;
          item.fcCandidates.forEach(c => {
            candFcMap[c.id] = true;
            const isSel = (item.fcSelected && item.fcSelected.id == c.id) ? 'selected' : '';
            colFC += `<option value="${c.id}" ${isSel}>${esc(c.nome)} (${esc(c.squadra)} - ${c.ruolo || ''}) [Id: ${c.id}]</option>`;
          });
          colFC += '</optgroup>';
        }

        const sameTeamFc = unassignedFcAll.filter(p => !candFcMap[p.id] && normTeam(p.squadra) === normTeam(item.squadraFCM));
        if (sameTeamFc.length > 0) {
          colFC += `<optgroup label="Non Assegnati - ${esc(item.squadraFCM)} (${sameTeamFc.length})">`;
          sameTeamFc.forEach(p => {
            candFcMap[p.id] = true;
            const isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
            colFC += `<option value="${p.id}" ${isSel}>${esc(p.nome)} (${esc(p.squadra)} - ${p.ruolo || ''}) [Id: ${p.id}]</option>`;
          });
          colFC += '</optgroup>';
        }

        const otherFc = unassignedFcAll.filter(p => !candFcMap[p.id]);
        if (otherFc.length > 0) {
          colFC += `<optgroup label="Altri Non Assegnati (${otherFc.length})">`;
          otherFc.forEach(p => {
            const isSel = (item.fcSelected && item.fcSelected.id == p.id) ? 'selected' : '';
            colFC += `<option value="${p.id}" ${isSel}>${esc(p.nome)} (${esc(p.squadra)} - ${p.ruolo || ''}) [Id: ${p.id}]</option>`;
          });
          colFC += '</optgroup>';
        }

        if (item.fcSelected && item.fcSelected.id && !candFcMap[item.fcSelected.id]) {
          colFC += '<optgroup label="Attualmente Selezionato">';
          colFC += `<option value="${item.fcSelected.id}" selected>${esc(item.fcSelected.nome)} [Id: ${item.fcSelected.id}]</option>`;
          colFC += '</optgroup>';
        }

        colFC += '</select>';
      } else {
        if (item.fcSelected && item.fcSelected.id) {
          colFC = `<span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">${esc(item.fcSelected.nome)}</span> <code style="font-size: 0.74rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 2px 5px; border-radius: 4px;">Id: ${item.fcSelected.id}</code>`;
        } else {
          colFC = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
        }
      }

      let colAction = '';
      if (isEditable) {
        colAction = `<button type="button" class="calc-btn-action calc-btn-save btn-row-save" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.76rem;"><span>Salva</span></button>`;
      } else {
        colAction = `<button type="button" class="calc-btn-action calc-btn-cancel btn-row-edit" data-id="${item.id}" style="padding: 5px 8px; font-size: 0.74rem;" title="Modifica associazione"><span>✏️</span></button>`;
      }

      html += `
        <tr class="${rowClass}">
          <td style="text-align: center;"><span class="badge-role badge-role-${item.ruoloFCM}">${item.ruoloFCM}</span></td>
          <td><strong style="font-size: 0.88rem; color: var(--text-primary); display: block;">${esc(item.nomeFCM)}</strong><span style="font-size: 0.74rem; color: var(--text-muted); font-family: ui-monospace, monospace;">Cod: ${item.codiceFCM} • ID: ${item.idFCM}</span></td>
          <td><span style="font-weight: 600; color: var(--text-secondary);">${esc(item.squadraFCM)}</span></td>
          <td style="text-align: center;">${statusBadge}</td>
          <td>${colPF}</td>
          <td>${colFC}</td>
          <td style="text-align: center;">${colAction}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Attacca listener sui dropdown
    tbody.querySelectorAll('.sel-pf').forEach(sel => {
      sel.onchange = (e) => {
        const id = parseInt(sel.getAttribute('data-id'), 10);
        const item = this.settingsModalState.assocItems[id];
        if (!item) return;
        const val = e.target.value;
        if (val === 'EMPTY' || val === '') {
          item.pfSelected = null;
        } else {
          let cand = (item.pfCandidates || []).find(c => c.cod == val);
          if (!cand) cand = (this.settingsModalState.unassignedPF || []).find(c => c.cod == val);
          if (cand) item.pfSelected = { cod: cand.cod, nome: cand.nome };
          else item.pfSelected = { cod: parseInt(val, 10), nome: '' };
        }
      };
    });

    tbody.querySelectorAll('.sel-fc').forEach(sel => {
      sel.onchange = (e) => {
        const id = parseInt(sel.getAttribute('data-id'), 10);
        const item = this.settingsModalState.assocItems[id];
        if (!item) return;
        const val = e.target.value;
        if (val === 'EMPTY' || val === '') {
          item.fcSelected = null;
        } else {
          let cand = (item.fcCandidates || []).find(c => c.id == val);
          if (!cand) cand = (this.settingsModalState.unassignedFC || []).find(c => c.id == val);
          if (cand) item.fcSelected = { id: cand.id, nome: cand.nome };
          else item.fcSelected = { id: parseInt(val, 10), nome: '' };
        }
      };
    });

    tbody.querySelectorAll('.btn-row-save').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = this.settingsModalState.assocItems[id];
        if (!item) return;
        item.isManualEdit = false;
        item.conflict = false;

        // Controllo unicità
        if (item.pfSelected && item.pfSelected.cod) {
          const pfCod = item.pfSelected.cod;
          this.settingsModalState.assocItems.forEach(other => {
            if (other.id !== item.id && other.pfSelected && other.pfSelected.cod == pfCod) {
              other.status = 'dubbio';
              other.isDoubtful = true;
              other.conflict = true;
              this.showToast(`⚠️ Il codice PF ${pfCod} era associato a ${other.nomeFCM}. Aggiornato!`);
            }
          });
        }
        if (item.fcSelected && item.fcSelected.id) {
          const fcId = item.fcSelected.id;
          this.settingsModalState.assocItems.forEach(other => {
            if (other.id !== item.id && other.fcSelected && other.fcSelected.id == fcId) {
              other.status = 'dubbio';
              other.isDoubtful = true;
              other.conflict = true;
              this.showToast(`⚠️ L'ID FC ${fcId} era associato a ${other.nomeFCM}. Aggiornato!`);
            }
          });
        }

        item.status = (item.pfSelected || item.fcSelected) ? 'confermato' : 'non_trovato';
        item.isDoubtful = false;

        this.updateAssocModalStats(content);
        this.renderAssocModalTable(content);
        this.showToast(`Associazione per ${item.nomeFCM} aggiornata!`);
      };
    });

    tbody.querySelectorAll('.btn-row-edit').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = this.settingsModalState.assocItems[id];
        if (!item) return;
        item.isManualEdit = !item.isManualEdit;
        this.renderAssocModalTable(content);
      };
    });
  },

  /**
   * Salvataggio delle associazioni su liveVU_associazioni.php dal modale
   */
  async saveAssocInModal(content) {
    const items = this.settingsModalState.assocItems || [];

    // Validazione preventiva unicità
    const seenPf = {};
    const seenFc = {};
    const dups = [];
    items.forEach(item => {
      if (item.pfSelected && item.pfSelected.cod) {
        const c = item.pfSelected.cod;
        if (seenPf[c]) dups.push(`PF Cod ${c} (${seenPf[c]} e ${item.nomeFCM})`);
        seenPf[c] = item.nomeFCM;
      }
      if (item.fcSelected && item.fcSelected.id) {
        const c = item.fcSelected.id;
        if (seenFc[c]) dups.push(`FC ID ${c} (${seenFc[c]} e ${item.nomeFCM})`);
        seenFc[c] = item.nomeFCM;
      }
    });

    if (dups.length > 0) {
      alert("Errore: rilevate assegnazioni duplicate:\n- " + dups.join("\n- ") + "\n\nIl match dev'essere univoco 1-a-1. Risolvi i conflitti prima di salvare.");
      this.settingsModalState.assocFilter = 'dubbio';
      this.renderAssocModalTable(content);
      return;
    }

    const doubtfulCount = items.filter(i => i.status === 'dubbio').length;
    if (doubtfulCount > 0) {
      if (!confirm(`Attenzione: sono ancora presenti ${doubtfulCount} casi da risolvere non confermati. Vuoi procedere comunque con il salvataggio?`)) {
        this.settingsModalState.assocFilter = 'dubbio';
        const pDubbio = content.querySelector('#modalAssocPills .pill-doubtful');
        const pills = content.querySelectorAll('#modalAssocPills .assoc-pill-btn');
        pills.forEach(b => b.classList.remove('active'));
        if (pDubbio) pDubbio.classList.add('active');
        this.renderAssocModalTable(content);
        return;
      }
    }

    const btn = content.querySelector('#modalBtnSaveAssoc');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    try {
      const payload = items.map(item => ({
        codPF: item.pfSelected ? item.pfSelected.cod : '',
        nomePF: item.pfSelected ? item.pfSelected.nome : '',
        codFC: item.fcSelected ? item.fcSelected.id : '',
        nomeFC: item.fcSelected ? item.fcSelected.nome : '',
        codFCM: item.codiceFCM,
        nomeFCM: item.nomeFCM,
        idFCM: item.idFCM
      }));

      const fd = new FormData();
      fd.append('assoc_action', 'save_associations');
      fd.append('associations_json', JSON.stringify(payload));

      const res = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: fd });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = oldText;

      if (!data.success) {
        alert("Errore salvataggio: " + (data.error || "Errore sconosciuto"));
        return;
      }

      this.showToast(`✅ ${data.message} (${data.count} giocatori)`);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = oldText;
      alert("Errore di comunicazione: " + e.message);
    }
  },

  /**
   * Renderizza l'interfaccia HTML del Tab Associazioni Fantapazz (liveFP) nel modale
   */
  renderFpAssocModalTabHtml() {
    return `
      <!-- BANNER INTESTAZIONE MODULO ASSOCIAZIONI FANTAPAZZ -->
      <div class="assoc-header-banner">
        <div>
          <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span style="color: #f59e0b;">⚡</span>
            <span>Gestione Associazioni Live Fantapazz</span>
          </h4>
          <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            Associa i nomi dei giocatori del listone <strong>Fantapazz</strong> (<code>Listone_Fantapazz.csv</code>) con i giocatori attivi in <strong>Serie A</strong> per aggiornare <code>js/fcmVotiAssociazioni.js</code>.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="calc-btn-action" id="modalBtnLoadCurrentFP" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; padding: 8px 14px; cursor: pointer;">
            <span>👁️ Ispeziona Stato Attuale</span>
          </button>
        </div>
      </div>

      <!-- SEZIONE UPLOAD FILE CSV FANTAPAZZ -->
      <div style="max-width: 600px; margin: 0 auto 20px auto;">
        <div class="assoc-upload-box" id="modalBoxUploadFP" style="padding: 24px 20px;">
          <div class="assoc-upload-icon" style="color: #f59e0b;">📄</div>
          <div class="assoc-upload-title">Listone Calciatori Fantapazz (.csv)</div>
          <div class="assoc-upload-subtitle">Template: <code>Listone_Fantapazz.csv</code> (delimitatore <code>;</code>)</div>
          <label class="assoc-file-label" style="margin-top: 10px;">
            <input type="file" id="modalFileCsvFP" accept=".csv">
            <span>📁 Seleziona File (.csv)</span>
          </label>
          <div class="assoc-file-selected-name" id="modalFileNameFP">Nessun file selezionato</div>
        </div>
      </div>

      <!-- PULSANTE ANALISI -->
      <div style="text-align: center; margin: 16px 0 22px 0;">
        <button type="button" id="modalBtnAnalyzeFP" class="calc-btn-action calc-btn-save" style="padding: 12px 28px; font-size: 0.95rem; border-radius: 12px; cursor: pointer;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Analizza ed Elabora Associazioni Fantapazz</span>
        </button>
      </div>

      <!-- WORKSPACE RISULTATI -->
      <div id="modalFpAssocWorkspace" style="display: none;">
        <!-- STATS CARDS -->
        <div class="assoc-stats-grid">
          <div class="assoc-stat-card">
            <div class="assoc-stat-val" id="modalFpStatTotalFcm">0</div>
            <div class="assoc-stat-lbl">Giocatori Serie A FCM</div>
          </div>
          <div class="assoc-stat-card stat-card-confirmed">
            <div class="assoc-stat-val" id="modalFpStatConfirmed">0</div>
            <div class="assoc-stat-lbl">✅ Convalidati / Mappati</div>
          </div>
          <div class="assoc-stat-card stat-card-doubtful">
            <div class="assoc-stat-val" id="modalFpStatDoubtful">0</div>
            <div class="assoc-stat-lbl">⚠️ Da Risolvere</div>
          </div>
          <div class="assoc-stat-card stat-card-notfound">
            <div class="assoc-stat-val" id="modalFpStatNotFound">0</div>
            <div class="assoc-stat-lbl">⚪ Non Trovati / Vuoti</div>
          </div>
        </div>

        <!-- TOOLBAR FILTRI -->
        <div class="assoc-toolbar">
          <div class="assoc-filter-pills" id="modalFpAssocPills">
            <button type="button" class="assoc-pill-btn active" data-filter="all">Tutti (<span id="modalFpCountPillAll">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-doubtful" data-filter="dubbio">⚠️ Da Risolvere (<span id="modalFpCountPillDoubtful">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-confirmed" data-filter="confermato">✅ Convalidati (<span id="modalFpCountPillConfirmed">0</span>)</button>
            <button type="button" class="assoc-pill-btn pill-notfound" data-filter="non_trovato">⚪ Non Trovati (<span id="modalFpCountPillNotFound">0</span>)</button>
          </div>
          <div class="assoc-search-wrap">
            <input type="text" id="modalFpAssocSearchInput" class="assoc-search-input" placeholder="🔍 Filtra nome o squadra...">
          </div>
        </div>

        <!-- TABELLA INTERATTIVA -->
        <div class="assoc-table-wrap">
          <table class="assoc-table">
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;">R</th>
                <th>Giocatore FCM</th>
                <th>Squadra Serie A</th>
                <th style="width: 140px; text-align: center;">Stato</th>
                <th style="min-width: 280px;">Fantapazz (Nome Assegnato)</th>
                <th style="width: 80px; text-align: center;">Azione</th>
              </tr>
            </thead>
            <tbody id="modalFpAssocTableBody">
            </tbody>
          </table>
        </div>

        <!-- ACTION BAR STICKY BOTTOM SALVATAGGIO -->
        <div class="calc-actions-bar is-sticky-bottom" style="margin-top: 18px;">
          <div class="badge-wrap">
            <span class="badge-status-changes" id="modalFpAssocSaveStatusBadge">
              <span>⚪</span> In attesa di revisione
            </span>
          </div>
          <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-save" id="modalBtnSaveFpAssoc">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Salva js/fcmVotiAssociazioni.js</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Inizializzazione eventi e logica del tab Associazioni Fantapazz nel modale
   */
  initFpAssocModalTabLogic(content) {
    const fileFP = content.querySelector('#modalFileCsvFP');
    const nameFP = content.querySelector('#modalFileNameFP');
    const boxFP = content.querySelector('#modalBoxUploadFP');

    if (fileFP) {
      fileFP.onchange = () => {
        const f = fileFP.files && fileFP.files[0];
        if (f) {
          nameFP.textContent = `📄 ${f.name} (${Math.round(f.size / 1024)} KB)`;
          if (boxFP) boxFP.classList.add('has-file');
        } else {
          nameFP.textContent = 'Nessun file selezionato';
          if (boxFP) boxFP.classList.remove('has-file');
        }
      };
    }

    const btnAnalyze = content.querySelector('#modalBtnAnalyzeFP');
    if (btnAnalyze) {
      btnAnalyze.onclick = () => this.analyzeFpAssocFilesInModal(content);
    }

    const btnLoadCurrent = content.querySelector('#modalBtnLoadCurrentFP');
    if (btnLoadCurrent) {
      btnLoadCurrent.onclick = () => this.loadCurrentFpAssocInModal(content);
    }

    const pillBtns = content.querySelectorAll('#modalFpAssocPills .assoc-pill-btn');
    pillBtns.forEach(btn => {
      btn.onclick = () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settingsModalState.fpAssocFilter = btn.getAttribute('data-filter') || 'all';
        this.renderFpAssocModalTable(content);
      };
    });

    const searchInput = content.querySelector('#modalFpAssocSearchInput');
    if (searchInput) {
      searchInput.oninput = () => {
        this.settingsModalState.fpAssocSearch = searchInput.value.toLowerCase().trim();
        this.renderFpAssocModalTable(content);
      };
    }

    const btnSave = content.querySelector('#modalBtnSaveFpAssoc');
    if (btnSave) {
      btnSave.onclick = () => this.saveFpAssocInModal(content);
    }
  },

  /**
   * Ispezione dello stato attuale da js/fcmVotiAssociazioni.js nel modale
   */
  /**
   * Ispezione dello stato attuale da js/fcmVotiAssociazioni.js nel modale
   */
  async loadCurrentFpAssocInModal(content) {
    try {
      this.showToast("Caricamento stato attuale da js/fcmVotiAssociazioni.js...");
      const res = await fetch(`inc/impostazioni_calcolo.php?fp_assoc_action=get_current_state&_t=${Date.now()}`);
      const data = await res.json();
      if (!data.success) {
        alert("Errore: " + (data.error || "Impossibile caricare i dati"));
        return;
      }

      this.settingsModalState.unassignedFP = data.unassigned_fp || [];
      this.settingsModalState.fpAssocItems = (data.items || []).map((item, idx) => {
        const hasFp = (item.fp_name && item.fp_name !== '');
        return {
          id: idx,
          codiceFCM: item.player.codice,
          idFCM: item.player.id,
          nomeFCM: item.player.nome,
          squadraFCM: item.player.squadra,
          ruoloFCM: item.player.ruolo,
          status: hasFp ? 'confermato' : 'non_trovato',
          isDoubtful: false,
          conflict: false,
          fpSelected: hasFp ? { calciatore: item.fp_name, squadra: item.player.squadra } : null,
          fpCandidates: [],
          isManualEdit: false
        };
      });

      const ws = content.querySelector('#modalFpAssocWorkspace');
      if (ws) ws.style.display = 'block';

      this.updateFpAssocModalStats(content);
      this.renderFpAssocModalTable(content);
      this.showToast(`Stato attuale caricato: ${data.total_fcm} giocatori Serie A rilevati.`);
    } catch (e) {
      alert("Errore di caricamento: " + e.message);
    }
  },

  /**
   * Analisi del file CSV Fantapazz nel modale
   */
  async analyzeFpAssocFilesInModal(content) {
    const fileFP = content.querySelector('#modalFileCsvFP').files[0];
    if (!fileFP) {
      alert("Seleziona il file CSV Listone Fantapazz per procedere.");
      return;
    }

    const btn = content.querySelector('#modalBtnAnalyzeFP');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Elaborazione in corso...</span>';

    try {
      const fd = new FormData();
      fd.append('fp_assoc_action', 'analyze_file');
      fd.append('csv_fp', fileFP);

      const res = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: fd });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = oldText;

      if (!data.success) {
        alert("Errore analisi: " + (data.error || "Errore sconosciuto"));
        return;
      }

      this.settingsModalState.unassignedFP = data.unassigned_fp || [];
      this.settingsModalState.fpAssocItems = (data.all || []).map((item, idx) => ({
        id: idx,
        codiceFCM: item.player.codice,
        idFCM: item.player.id,
        nomeFCM: item.player.nome,
        squadraFCM: item.player.squadra,
        ruoloFCM: item.player.ruolo,
        status: item.status,
        isDoubtful: item.is_doubtful,
        conflict: !!item.conflict,
        fpSelected: item.fp_selected ? { calciatore: item.fp_selected.calciatore, squadra: item.fp_selected.squadra } : null,
        fpCandidates: item.fp_candidates || [],
        isManualEdit: false
      }));

      const ws = content.querySelector('#modalFpAssocWorkspace');
      if (ws) ws.style.display = 'block';

      this.updateFpAssocModalStats(content);

      const doubtfulCount = this.settingsModalState.fpAssocItems.filter(i => i.status === 'dubbio').length;
      const pills = content.querySelectorAll('#modalFpAssocPills .assoc-pill-btn');
      pills.forEach(b => b.classList.remove('active'));

      if (doubtfulCount > 0) {
        this.settingsModalState.fpAssocFilter = 'dubbio';
        const pDubbio = content.querySelector('#modalFpAssocPills .pill-doubtful');
        if (pDubbio) pDubbio.classList.add('active');
        this.showToast(`Analisi completata: trovati ${doubtfulCount} casi da verificare (risolvi prima del salvataggio).`);
      } else {
        this.settingsModalState.fpAssocFilter = 'all';
        const pAll = content.querySelector('#modalFpAssocPills [data-filter="all"]');
        if (pAll) pAll.classList.add('active');
        this.showToast("Analisi completata con successo! Nessun conflitto rilevato.");
      }

      this.renderFpAssocModalTable(content);
      if (ws) ws.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = oldText;
      alert("Errore durante l'elaborazione: " + e.message);
    }
  },

  /**
   * Aggiornamento contatori e badge per Fantapazz
   */
  updateFpAssocModalStats(content) {
    const items = this.settingsModalState.fpAssocItems || [];
    let confirmed = 0;
    let doubtful = 0;
    let notFound = 0;

    items.forEach(i => {
      if (i.status === 'dubbio') doubtful++;
      else if (i.status === 'confermato') confirmed++;
      else notFound++;
    });

    const setT = (id, val) => {
      const el = content.querySelector('#' + id);
      if (el) el.textContent = val;
    };

    setT('modalFpStatTotalFcm', items.length);
    setT('modalFpStatConfirmed', confirmed);
    setT('modalFpStatDoubtful', doubtful);
    setT('modalFpStatNotFound', notFound);

    setT('modalFpCountPillAll', items.length);
    setT('modalFpCountPillDoubtful', doubtful);
    setT('modalFpCountPillConfirmed', confirmed);
    setT('modalFpCountPillNotFound', notFound);

    const statusBadge = content.querySelector('#modalFpAssocSaveStatusBadge');
    if (statusBadge) {
      if (doubtful > 0) {
        statusBadge.className = 'badge-status-changes has-changes';
        statusBadge.innerHTML = `<span>⚠️</span> ${doubtful} casi dubbi o conflitti rimanenti`;
      } else {
        statusBadge.className = 'badge-status-changes';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadge.style.color = 'var(--accent-emerald, #10b981)';
        statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusBadge.innerHTML = '<span>✅</span> Pronto al salvataggio univoco';
      }
    }
  },

  /**
   * Rendering della tabella interattiva Fantapazz nel modale
   */
  renderFpAssocModalTable(content) {
    const tbody = content.querySelector('#modalFpAssocTableBody');
    if (!tbody) return;

    const filter = this.settingsModalState.fpAssocFilter || 'all';
    const term = this.settingsModalState.fpAssocSearch || '';
    const items = this.settingsModalState.fpAssocItems || [];

    const visible = items.filter(item => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (term !== '') {
        const matchNome = item.nomeFCM.toLowerCase().indexOf(term) > -1;
        const matchSq = item.squadraFCM.toLowerCase().indexOf(term) > -1;
        const matchCod = item.codiceFCM.toString().indexOf(term) > -1;
        if (!matchNome && !matchSq && !matchCod) return false;
      }
      return true;
    });

    if (visible.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 26px; color: var(--text-muted); font-size: 0.88rem;">Nessun giocatore corrisponde ai filtri selezionati.</td></tr>';
      return;
    }

    const esc = (s) => (s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');

    const normFpTeam = (t) => {
      if (!t) return '';
      t = String(t).toUpperCase().trim();
      if (t.indexOf('VERONA') > -1) return 'VERONA';
      if (t.indexOf('INTER') > -1) return 'INTER';
      if (t.indexOf('JUVE') > -1) return 'JUVENTUS';
      return t;
    };

    // Calcolo unassigned escludendo già assegnati
    const assigned = {};
    items.forEach(item => {
      if (item.fpSelected && item.fpSelected.calciatore) {
        assigned[item.fpSelected.calciatore.toLowerCase().trim()] = true;
      }
    });
    const unassignedAll = (this.settingsModalState.unassignedFP || []).filter(p => !assigned[p.calciatore.toLowerCase().trim()]);

    let html = '';
    visible.forEach(item => {
      const rowClass = (item.status === 'dubbio') ? 'row-doubtful' : '';

      let statusBadge = '';
      if (item.status === 'dubbio') {
        const badgeText = item.conflict ? '⚠️ Conflitto Univocità' : '⚠️ Da Risolvere';
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);">${badgeText}</span>`;
      } else if (item.status === 'confermato') {
        statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Confermato</span>';
      } else {
        statusBadge = '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: rgba(148, 163, 184, 0.1); color: #94a3b8;">⚪ Non Trovato</span>';
      }

      const isEditable = (item.status === 'dubbio' || item.status === 'non_trovato' || item.isManualEdit);

      let colFP = '';
      if (isEditable) {
        colFP = `<select class="assoc-cand-select sel-fp" data-id="${item.id}">`;
        colFP += '<option value="">-- Seleziona Calciatore Fantapazz --</option>';
        colFP += `<option value="EMPTY" ${!item.fpSelected ? 'selected' : ''}>[Nessuna corrispondenza / Lascia vuoto]</option>`;

        const candNames = {};
        // 1. Candidati suggeriti dall'algoritmo
        if (item.fpCandidates && item.fpCandidates.length > 0) {
          colFP += `<optgroup label="Candidati Suggeriti (${item.fpCandidates.length})">`;
          item.fpCandidates.forEach(c => {
            candNames[c.calciatore.toLowerCase().trim()] = true;
            const isSel = (item.fpSelected && item.fpSelected.calciatore === c.calciatore) ? 'selected' : '';
            colFP += `<option value="${esc(c.calciatore)}" ${isSel}>${esc(c.calciatore)} (${esc(c.squadra)} - ${c.ruolo || ''})</option>`;
          });
          colFP += '</optgroup>';
        }

        // 2. Calciatori non ancora assegnati della stessa squadra
        const sameTeamUnassigned = unassignedAll.filter(p => {
          if (candNames[p.calciatore.toLowerCase().trim()]) return false;
          return normFpTeam(p.squadra) === normFpTeam(item.squadraFCM);
        });
        if (sameTeamUnassigned.length > 0) {
          colFP += `<optgroup label="Non Assegnati - ${esc(item.squadraFCM)} (${sameTeamUnassigned.length})">`;
          sameTeamUnassigned.forEach(p => {
            candNames[p.calciatore.toLowerCase().trim()] = true;
            const isSel = (item.fpSelected && item.fpSelected.calciatore === p.calciatore) ? 'selected' : '';
            colFP += `<option value="${esc(p.calciatore)}" ${isSel}>${esc(p.calciatore)} (${esc(p.squadra)} - ${p.ruolo || ''})</option>`;
          });
          colFP += '</optgroup>';
        }

        // 3. Tutti gli altri calciatori non assegnati
        const otherUnassigned = unassignedAll.filter(p => !candNames[p.calciatore.toLowerCase().trim()]);
        if (otherUnassigned.length > 0) {
          colFP += `<optgroup label="Altri Giocatori Non Assegnati (${otherUnassigned.length})">`;
          otherUnassigned.forEach(p => {
            const isSel = (item.fpSelected && item.fpSelected.calciatore === p.calciatore) ? 'selected' : '';
            colFP += `<option value="${esc(p.calciatore)}" ${isSel}>${esc(p.calciatore)} (${esc(p.squadra)} - ${p.ruolo || ''})</option>`;
          });
          colFP += '</optgroup>';
        }

        // 4. Attualmente selezionato se non nei gruppi precedenti
        if (item.fpSelected && item.fpSelected.calciatore && !candNames[item.fpSelected.calciatore.toLowerCase().trim()]) {
          colFP += '<optgroup label="Attualmente Selezionato">';
          colFP += `<option value="${esc(item.fpSelected.calciatore)}" selected>${esc(item.fpSelected.calciatore)} (${esc(item.fpSelected.squadra || '')})</option>`;
          colFP += '</optgroup>';
        }

        colFP += '</select>';
      } else {
        if (item.fpSelected && item.fpSelected.calciatore) {
          colFP = `<span style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${esc(item.fpSelected.calciatore)}</span>`;
          if (item.fpSelected.squadra) {
            colFP += ` <span style="font-size: 0.75rem; color: var(--text-muted);">(${esc(item.fpSelected.squadra)})</span>`;
          }
        } else {
          colFP = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Nessuna associazione</span>';
        }
      }

      let colAction = '';
      if (isEditable) {
        colAction = `<button type="button" class="calc-btn-action calc-btn-save btn-fp-row-save" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.76rem;"><span>Salva</span></button>`;
      } else {
        colAction = `<button type="button" class="calc-btn-action calc-btn-cancel btn-fp-row-edit" data-id="${item.id}" style="padding: 5px 8px; font-size: 0.74rem;" title="Modifica associazione"><span>✏️</span></button>`;
      }

      html += `
        <tr class="${rowClass}">
          <td style="text-align: center;"><span class="badge-role badge-role-${item.ruoloFCM}">${item.ruoloFCM}</span></td>
          <td><strong style="font-size: 0.88rem; color: var(--text-primary); display: block;">${esc(item.nomeFCM)}</strong><span style="font-size: 0.74rem; color: var(--text-muted); font-family: ui-monospace, monospace;">Cod: ${item.codiceFCM} • ID: ${item.idFCM}</span></td>
          <td><span style="font-weight: 600; color: var(--text-secondary);">${esc(item.squadraFCM)}</span></td>
          <td style="text-align: center;">${statusBadge}</td>
          <td>${colFP}</td>
          <td style="text-align: center;">${colAction}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Listener dropdown candidati Fantapazz
    tbody.querySelectorAll('.sel-fp').forEach(sel => {
      sel.onchange = (e) => {
        const id = parseInt(sel.getAttribute('data-id'), 10);
        const item = this.settingsModalState.fpAssocItems[id];
        if (!item) return;
        const val = e.target.value;
        if (val === 'EMPTY' || val === '') {
          item.fpSelected = null;
        } else {
          let cand = (item.fpCandidates || []).find(c => c.calciatore === val);
          if (!cand) {
            cand = (this.settingsModalState.unassignedFP || []).find(c => c.calciatore === val);
          }
          if (cand) {
            item.fpSelected = { calciatore: cand.calciatore, squadra: cand.squadra, ruolo: cand.ruolo };
          } else {
            item.fpSelected = { calciatore: val, squadra: '' };
          }
        }
      };
    });

    tbody.querySelectorAll('.btn-fp-row-save').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = this.settingsModalState.fpAssocItems[id];
        if (!item) return;
        item.isManualEdit = false;
        item.conflict = false;

        if (item.fpSelected && item.fpSelected.calciatore) {
          item.status = 'confermato';
          item.isDoubtful = false;

          // VERIFICA UNICITÀ RIGOROSA: se questo calciatore era assegnato altrove
          const selNorm = item.fpSelected.calciatore.toLowerCase().trim();
          this.settingsModalState.fpAssocItems.forEach(other => {
            if (other.id !== item.id && other.fpSelected && other.fpSelected.calciatore && other.fpSelected.calciatore.toLowerCase().trim() === selNorm) {
              other.status = 'dubbio';
              other.isDoubtful = true;
              other.conflict = true;
              this.showToast(`⚠️ Attenzione: '${item.fpSelected.calciatore}' era assegnato a ${other.nomeFCM}. Assegnazione spostata su ${item.nomeFCM}!`);
            }
          });
        } else {
          item.status = 'non_trovato';
          item.isDoubtful = false;
        }

        this.updateFpAssocModalStats(content);
        this.renderFpAssocModalTable(content);
        this.showToast(`Associazione Fantapazz per ${item.nomeFCM} aggiornata!`);
      };
    });

    tbody.querySelectorAll('.btn-fp-row-edit').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = this.settingsModalState.fpAssocItems[id];
        if (!item) return;
        item.isManualEdit = !item.isManualEdit;
        this.renderFpAssocModalTable(content);
      };
    });
  },

  /**
   * Salvataggio delle associazioni su js/fcmVotiAssociazioni.js dal modale
   */
  async saveFpAssocInModal(content) {
    const items = this.settingsModalState.fpAssocItems || [];

    // Controllo unicità prima del salvataggio
    const seen = {};
    let hasDuplicates = false;
    const dupDetails = [];
    items.forEach(item => {
      if (item.fpSelected && item.fpSelected.calciatore) {
        const k = item.fpSelected.calciatore.toLowerCase().trim();
        if (seen[k]) {
          hasDuplicates = true;
          dupDetails.push(`${item.fpSelected.calciatore} (assegnato sia a ${seen[k]} sia a ${item.nomeFCM})`);
        }
        seen[k] = item.nomeFCM;
      }
    });

    if (hasDuplicates) {
      alert("Errore salvataggio: rilevate assegnazioni duplicate del medesimo calciatore Fantapazz:\n- " + dupDetails.join("\n- ") + "\n\nIl match dev'essere univoco 1-a-1. Risolvi i conflitti prima di salvare.");
      this.settingsModalState.fpAssocFilter = 'dubbio';
      const pDubbio = content.querySelector('#modalFpAssocPills .pill-doubtful');
      const pills = content.querySelectorAll('#modalFpAssocPills .assoc-pill-btn');
      pills.forEach(b => b.classList.remove('active'));
      if (pDubbio) pDubbio.classList.add('active');
      this.renderFpAssocModalTable(content);
      return;
    }

    const doubtfulCount = items.filter(i => i.status === 'dubbio').length;
    if (doubtfulCount > 0) {
      if (!confirm(`Attenzione: sono ancora presenti ${doubtfulCount} casi da verificare non risolti. Vuoi procedere comunque con il salvataggio su js/fcmVotiAssociazioni.js?`)) {
        this.settingsModalState.fpAssocFilter = 'dubbio';
        const pDubbio = content.querySelector('#modalFpAssocPills .pill-doubtful');
        const pills = content.querySelectorAll('#modalFpAssocPills .assoc-pill-btn');
        pills.forEach(b => b.classList.remove('active'));
        if (pDubbio) pDubbio.classList.add('active');
        this.renderFpAssocModalTable(content);
        return;
      }
    }

    const btn = content.querySelector('#modalBtnSaveFpAssoc');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    try {
      const payload = [];
      items.forEach(item => {
        if (item.fpSelected && item.fpSelected.calciatore) {
          payload.push({
            fpNome: item.fpSelected.calciatore,
            fcmNome: item.nomeFCM
          });
        }
      });

      const fd = new FormData();
      fd.append('fp_assoc_action', 'save_associations');
      fd.append('associations_json', JSON.stringify(payload));

      const res = await fetch('inc/impostazioni_calcolo.php', { method: 'POST', body: fd });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = oldText;

      if (!data.success) {
        alert("Errore salvataggio: " + (data.error || "Errore sconosciuto"));
        return;
      }

      // Ricarica a caldo il file associazioni in memoria
      if (typeof fcmDataLoader !== 'undefined') {
        try {
          await fcmDataLoader.loadScript('js/fcmVotiAssociazioni.js', true);
        } catch (err) { }
      }

      this.showToast(`✅ ${data.message} (${data.count} associazioni salvate)`);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = oldText;
      alert("Errore di comunicazione: " + e.message);
    }
  },

  /**
   * Helpers ausiliari
   */
  getRoleLetter(r) {
    switch (Number(r)) {
      case 1: return 'P';
      case 2: return 'D';
      case 3: return 'C';
      case 4: return 'A';
      default: return '-';
    }
  },

  formatCognome(nome) {
    if (!nome) return '';
    const lower = nome.toLowerCase();
    if (lower.includes("riserva d'ufficio") || lower.includes("no sostituzione") || lower.includes("nessuna riserva")) {
      return nome;
    }
    const parts = nome.trim().split(/\s+/);
    const upperParts = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === parts[i].toUpperCase() && (parts[i].length > 1 || parts.length === 1)) {
        upperParts.push(parts[i]);
      } else {
        break;
      }
    }
    return upperParts.length > 0 ? upperParts.join(' ') : parts[0];
  },

  normalizeName(name) {
    if (!name) return "";
    let s = String(name).trim().toUpperCase();
    s = s.replace(/[\u2018\u2019\u201B\u2032`]/g, "'");
    s = s.replace(/[ÀÁÂÃÄÅ]/g, "A'")
      .replace(/[ÈÉÊË]/g, "E'")
      .replace(/[ÌÍÎÏ]/g, "I'")
      .replace(/[ÒÓÔÕÖ]/g, "O'")
      .replace(/[ÙÚÛÜ]/g, "U'")
      .replace(/[Ý]/g, "Y")
      .replace(/[Ç]/g, "C")
      .replace(/[Ñ]/g, "N");
    return s.replace(/\s+/g, " ").trim();
  },

  calcolaModuloTattico(starters) {
    if (typeof FCMCalcoloMotore !== 'undefined') {
      return FCMCalcoloMotore.calcolaModulo(starters);
    }
    if (!starters || starters.length === 0) return '0-0-0';
    let d = 0, c = 0, a = 0;
    starters.forEach(p => {
      if (p.ruolo === 2) d++;
      else if (p.ruolo === 3) c++;
      else if (p.ruolo === 4) a++;
    });
    return `${d}-${c}-${a}`;
  },

  showToast(msg) {
    let t = document.getElementById('calcoloToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'calcoloToast';
      t.className = 'calcolo-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => { t.classList.remove('visible'); }, 3000);
  },

  /**
   * Cleanup all'uscita dalla rotta
   */
  destroy() {
    if (typeof FcmVotiLiveManager !== 'undefined' && typeof FcmVotiLiveManager.destroy === 'function') {
      FcmVotiLiveManager.destroy();
    }
    const t = document.getElementById('calcoloToast');
    if (t) t.remove();
  }
};

window.calcoloView = calcoloView;
window.importaVotiUfficiosiCalcolo = function (force) {
  if (calcoloView && typeof calcoloView.importaVotiUfficiosi === 'function') {
    calcoloView.importaVotiUfficiosi(force);
  }
};
