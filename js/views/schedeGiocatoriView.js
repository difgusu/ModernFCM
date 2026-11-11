/**
 * SCHEDE GIOCATORI SERIE A - STORICHE & ATTUALI VIEW
 * Database statistico completo All-Time e Stagione per Stagione da archivi SQLite
 * con fallback trasparente sui registri FCM per la stagione attuale.
 * ModernFCM
 */

const schedeGiocatoriView = {
  container: null,
  isHistoricalAvailable: false,
  historicalSubtitle: '',
  seasonsCount: 14,

  // Dati
  players: [],
  playersByCode: new Map(),
  playersByName: new Map(),
  playersByIdSeason: new Map(),
  allSerieATeams: [],
  contractMap: {},
  queryDataMap: {},

  // Filtri e Stato
  currentTeamFilter: 0,
  currentRoleFilter: 0,
  currentSearchText: '',
  currentTessFilter: 'ALL',
  currentSeasonFilter: 'ALL',
  currentSelectedPlayer: null,
  currentDetailTab: 'live', // Default: ✨ Stagione Attuale
  currentChartSubTab: 'votifv', // 'votifv' | 'bonusmalus' | 'quotazioni'
  selectedDetailSeason: null,
  currentFilteredPlayerCodes: [],
  _matchdaysCache: new Map(),

  // Event handlers
  _resizeHandler: null,
  _hashChangeHandler: null,
  _searchDebounceTimer: null,
  _docClickHandler: null,

  async render(container) {
    this.container = container;
    const renderToken = (this._renderToken = (this._renderToken || 0) + 1);

    const hash = window.location.hash || '';
    const hasPlayerParam = hash.includes('?') && (/[\?&](cod|codice|id|name|player)=/i.test(hash));

    // 0. Skeleton immediato durante il caricamento dei dati e archivi SQLite
    if (typeof fcmSkeleton !== 'undefined' && (!container.querySelector('#schedeMainContent') || !this.players || this.players.length === 0)) {
      container.innerHTML = hasPlayerParam ? fcmSkeleton.playerDetail() : fcmSkeleton.playerList();
    }

    // 1. Carica i dati (current season files + storico SQLite)
    await this.loadData();
    if (renderToken !== this._renderToken) return;

    // 2. Parse URL parameters per verificare se c'è un calciatore selezionato direttamente
    this.parseUrlParams();

    // 3. Renderizza lo scheletro dell'interfaccia
    this.renderLayout();

    // 4. Se c'è un calciatore selezionato, visualizza la sua scheda, altrimenti lo stato di ricerca/filtro
    if (this.currentSelectedPlayer) {
      this.renderPlayerDetail(this.currentSelectedPlayer);
    } else {
      this.renderMainContent();
    }

    // 5. Ascolto variazioni hash della finestra per sincronizzazione link interni
    if (!this._hashChangeHandler) {
      this._hashChangeHandler = () => {
        if (!window.location.hash.startsWith('#schede_giocatori') && !window.location.hash.startsWith('#schedagiocatori')) return;
        this.parseUrlParams();
        if (this.currentSelectedPlayer) {
          this.renderPlayerDetail(this.currentSelectedPlayer);
        } else {
          this.renderMainContent();
        }
      };
      window.addEventListener('hashchange', this._hashChangeHandler);
    }
  },

  /**
   * Carica i file della stagione corrente e gli archivi storici SQLite
   */
  async loadData() {
    // 1. File della stagione corrente (necessari per contratti attuali, Q45 e fallback)
    if (typeof arrGiocatoriA === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js'); } catch (e) { }
    }
    if (typeof xa1 === 'undefined' || typeof arrIncontriA === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmSerieADati.js'); } catch (e) { }
    }
    if (typeof arrRose === 'undefined' || typeof arrFantasquadre === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js'); } catch (e) { }
    }
    if (typeof arrIncontri === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmCalendarioDati.js'); } catch (e) { }
    }
    if (typeof arrQuery === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmQueryDati.js'); } catch (e) { }
    }
    let qId = 45;
    if (typeof arrQuery !== 'undefined') {
      for (let i = 1; i < arrQuery.length; i++) {
        if (arrQuery[i] && arrQuery[i].Nome === 'Tutti i dati') {
          qId = arrQuery[i].ID;
          break;
        }
      }
    }
    let qRows = null;
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadQueryStat === 'function') {
      try {
        const qRes = await fcmDataLoader.loadQueryStat(qId);
        if (qRes && Array.isArray(qRes.rows) && qRes.rows.length > 0 && (!qRes.headers || qRes.headers.length >= 25)) {
          qRows = qRes.rows;
        }
      } catch (e) { }
    }
    if (!qRows) {
      try {
        if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
          await fcmDataLoader.loadScript(`js/fcmQueryQ${qId}.js`, 'reexec', 'ISO-8859-1');
        }
      } catch (e) { }
      if (typeof arrRisQuery !== 'undefined' && arrRisQuery.length > 1 && (!arrRisQuery[1] || String(arrRisQuery[1].ListaValori || '').split('%').length >= 25)) {
        qRows = [];
        for (let i = 2; i < arrRisQuery.length; i++) {
          if (arrRisQuery[i] && arrRisQuery[i].ListaValori) {
            qRows.push(arrRisQuery[i].ListaValori.split('%'));
          }
        }
      }
    }

    // Mappa Q45 per statistiche correnti (valida che abbia la struttura completa a >=25 colonne)
    this.queryDataMap = {};
    if (Array.isArray(qRows)) {
      for (let i = 0; i < qRows.length; i++) {
        const vals = qRows[i];
        if (vals && vals.length >= 25 && vals[0]) {
          const cleanName = vals[0].replace(/&nbsp;/g, ' ').trim();
          this.queryDataMap[cleanName] = vals;
          this.queryDataMap[cleanName.toUpperCase()] = vals;
          if (vals[3]) {
            this.queryDataMap[vals[3].trim()] = vals;
          }
        }
      }
    }

    // Mappa contratti fantasquadre da arrRose
    this.contractMap = {};
    if (typeof arrRose !== 'undefined' && typeof arrFantasquadre !== 'undefined') {
      const fMap = {};
      for (let f = 1; f < arrFantasquadre.length; f++) {
        if (arrFantasquadre[f]) fMap[arrFantasquadre[f].ID] = arrFantasquadre[f].Nome;
      }
      for (let r = 1; r < arrRose.length; r++) {
        const item = arrRose[r];
        if (!item) continue;
        const isRimpiazzoInfortunio = (item.Contratto === -1);
        const isPrestito = (item.Contratto === -1 || item.Contratto === -2);
        const isInfortunato = (item.Stato === 2);
        const isSvincolato = (item.Stato === 1);
        const isActive = (item.Stato === 0 || item.Stato === 2 || isPrestito) && !isSvincolato;

        const existing = this.contractMap[item.Nome];
        if (existing && existing.isActive && !isActive) continue;

        let stato = 'In Rosa';
        if (isSvincolato) stato = 'Svincolato';
        else if (isInfortunato) stato = 'Infortunato (Lista Infortuni)';
        else if (isRimpiazzoInfortunio) stato = 'Sostituto Infortunato';
        else if (isPrestito) stato = 'In Prestito';

        const teamName = fMap[item.IDSquadra] || `Squadra ${item.IDSquadra}`;

        this.contractMap[item.Nome] = {
          teamId: isActive ? item.IDSquadra : null,
          teamNome: isActive ? teamName : null,
          exTeamId: item.IDSquadra,
          exTeamNome: teamName,
          stato,
          contratto: isActive ? item.Contratto : null,
          costoAcq: item.Acq,
          isPrestito,
          isRimpiazzoInfortunio,
          isInfortunato,
          isSvincolato,
          isActive
        };
      }
    }

    // 2. Carica i dati storici SQLite (opzionali se non ancora in memoria)
    if (this.players && this.players.length > 0 && this.isHistoricalAvailable) {
      this.buildPlayerIndexes();
      return;
    }
    let histData = null;
    try {
      const resp = await fetch('inc/api_storico.php?action=statistiche_storiche');
      if (resp.ok) histData = await resp.json();
    } catch (e) { }

    if (!histData || !histData.players) {
      if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.fetchJson) {
        try {
          histData = await fcmDataLoader.fetchJson('sqlite/statistiche_storiche.json');
        } catch (e) { }
      }
    }

    if (histData && Array.isArray(histData.players) && histData.players.length > 0) {
      this.isHistoricalAvailable = true;
      this.players = histData.players;
      this.seasonsCount = histData.stagioni_count || 14;
      this.historicalSubtitle = histData.subtitle || `${this.players.length} calciatori in ${this.seasonsCount} stagioni`;
    } else {
      this.isHistoricalAvailable = false;
      this.players = this.buildFallbackCurrentSeasonPlayers();
      this.seasonsCount = 1;
      this.historicalSubtitle = 'Stagione attuale (archivi storici opzionali non presenti)';
    }

    // Costruisci gli indici rapidi di ricerca e sincronizza contratti attuali
    this.buildPlayerIndexes();
  },

  /**
   * Genera i calciatori per la sola stagione corrente se gli archivi SQLite storici non sono presenti
   */
  buildFallbackCurrentSeasonPlayers() {
    const list = [];
    if (typeof arrGiocatoriA === 'undefined') return list;

    for (let p = 1; p < arrGiocatoriA.length; p++) {
      const pl = arrGiocatoriA[p];
      if (!pl) continue;

      let pName = '';
      try { pName = (typeof window !== 'undefined' && window[`xg${pl.ID}`]) ? window[`xg${pl.ID}`] : pl.Nome; } catch (e) { pName = pl.Nome || `Giocatore ${pl.ID}`; }
      let pTeam = '';
      try { pTeam = (typeof window !== 'undefined' && window[`xa${pl.IDSquadra}`]) ? window[`xa${pl.IDSquadra}`] : ''; } catch (e) { }

      if (pl.IDSquadra > 20 || !pTeam || pTeam.startsWith('{')) continue;

      const rLetter = pl.Ruolo === 1 ? 'P' : pl.Ruolo === 2 ? 'D' : pl.Ruolo === 3 ? 'C' : 'A';
      const cInfo = this.contractMap[pName] || null;
      const q = (pl.Codice && this.queryDataMap[pl.Codice.toString().trim()]) || this.queryDataMap[pName] || [];

      const pres = parseInt(q[6], 10) || 0;
      const mv = q[10] ? parseFloat(q[10].replace(',', '.')) : 0;
      const fm = q[17] ? parseFloat(q[17].replace(',', '.')) : 0;
      const gol = pl.Ruolo === 1 ? 0 : (parseInt(q[22], 10) || 0);
      const gs = pl.Ruolo === 1 ? (parseInt(q[24], 10) || 0) : 0;
      const ass = parseInt(q[27], 10) || 0;
      const amm = parseInt(q[30], 10) || 0;
      const esp = parseInt(q[31], 10) || 0;

      const isOwned = Boolean(cInfo && cInfo.isActive && cInfo.teamNome);

      const playerObj = {
        idx: list.length,
        nome: pName,
        ruolo: rLetter,
        squadra: pTeam,
        fantasquadra: isOwned ? cInfo.teamNome : null,
        codice: pl.Codice || null,
        codici: pl.Codice ? [pl.Codice] : [],
        quotazione: pl.Crediti || 0,
        nascita: '',
        luogo: '',
        altezza: 0,
        peso: 0,
        extracom: pl.Extracom || 0,
        stagioni: 1,
        pres: pres,
        gol: gol,
        golRig: pl.Ruolo === 1 ? 0 : (parseInt(q[23], 10) || 0),
        ass: ass,
        gs: gs,
        gsRig: pl.Ruolo === 1 ? (parseInt(q[25], 10) || 0) : 0,
        rp: pl.Ruolo === 1 ? (parseInt(q[28], 10) || 0) : 0,
        rs: pl.Ruolo === 1 ? 0 : (parseInt(q[29], 10) || 0),
        ag: parseInt(q[26], 10) || 0,
        amm: amm,
        esp: esp,
        mv: mv,
        mvc: q[8] ? parseFloat(q[8].replace(',', '.')) : 0,
        mvf: q[9] ? parseFloat(q[9].replace(',', '.')) : 0,
        fm: fm,
        fmc: q[15] ? parseFloat(q[15].replace(',', '.')) : 0,
        fmf: q[16] ? parseFloat(q[16].replace(',', '.')) : 0,
        dettaglio: [{
          stagione: 1,
          anni: 'Attuale',
          id: pl.ID,
          codice: pl.Codice,
          squadra: pTeam,
          fantasquadra: isOwned ? cInfo.teamNome : (cInfo && cInfo.isSvincolato ? `${cInfo.exTeamNome} (svinc.)` : '-'),
          costo: cInfo ? cInfo.costoAcq : null,
          contratto: isOwned ? cInfo.contratto : null,
          quotazione: pl.Crediti || 0,
          ruolo: rLetter,
          pres: pres,
          mv: mv,
          mvc: q[8] ? parseFloat(q[8].replace(',', '.')) : 0,
          mvf: q[9] ? parseFloat(q[9].replace(',', '.')) : 0,
          devMv: q[11] ? parseFloat(q[11].replace(',', '.')) : 0,
          rendimMv: q[14] ? parseFloat(q[14].replace(',', '.')) : 0,
          deltaMv: q[12] ? parseFloat(q[12].replace(',', '.')) : 0,
          mvAnd: q[13] ? parseFloat(q[13].replace(',', '.')) : 0,
          fm: fm,
          fmc: q[15] ? parseFloat(q[15].replace(',', '.')) : 0,
          fmf: q[16] ? parseFloat(q[16].replace(',', '.')) : 0,
          devFm: q[18] ? parseFloat(q[18].replace(',', '.')) : 0,
          rendimFm: q[21] ? parseFloat(q[21].replace(',', '.')) : 0,
          deltaFm: q[19] ? parseFloat(q[19].replace(',', '.')) : 0,
          fmAnd: q[20] ? parseFloat(q[20].replace(',', '.')) : 0,
          aff: parseInt(q[7], 10) || 0,
          gol: gol,
          golRig: pl.Ruolo === 1 ? 0 : (parseInt(q[23], 10) || 0),
          ass: ass,
          gs: gs,
          gsRig: pl.Ruolo === 1 ? (parseInt(q[25], 10) || 0) : 0,
          rp: pl.Ruolo === 1 ? (parseInt(q[28], 10) || 0) : 0,
          rs: pl.Ruolo === 1 ? 0 : (parseInt(q[29], 10) || 0),
          ag: parseInt(q[26], 10) || 0,
          amm: amm,
          esp: esp
        }]
      };

      list.push(playerObj);
    }
    return list;
  },

  /**
   * Costruisce indici per lookup immediato O(1)
   */
  buildPlayerIndexes() {
    this.playersByCode = new Map();
    this.playersByName = new Map();
    this.playersByIdSeason = new Map();
    const teamSet = new Set();

    this.players.forEach(p => {
      // Indicizzazione per codice e codici storici
      if (p.codice) {
        this.playersByCode.set(Number(p.codice), p);
      }
      if (Array.isArray(p.codici)) {
        p.codici.forEach(c => {
          if (c) this.playersByCode.set(Number(c), p);
        });
      }

      // Indicizzazione per nome normalizzato
      if (p.nome) {
        const norm = p.nome.trim().toUpperCase();
        this.playersByName.set(norm, p);
      }

      // Indicizzazione per stagione:ID
      if (Array.isArray(p.dettaglio)) {
        p.dettaglio.forEach(d => {
          if (d.stagione && d.id) {
            this.playersByIdSeason.set(`${d.stagione}:${d.id}`, p);
          }
          if (d.squadra) teamSet.add(d.squadra);
        });
      }

      if (p.squadra) teamSet.add(p.squadra);

      // Sincronizza lo stato contrattuale attuale se presente in contractMap
      const cInfo = this.contractMap[p.nome];
      if (cInfo) {
        if (cInfo.isActive && cInfo.teamNome) {
          p.fantasquadraAttuale = cInfo.teamNome;
          p.costoAttuale = cInfo.costoAcq;
          p.contrattoAttuale = cInfo.contratto;
          p.statoAttuale = cInfo.stato;
          p.isPrestito = cInfo.isPrestito;
          p.isRimpiazzoInfortunio = cInfo.isRimpiazzoInfortunio;
          p.isInfortunato = cInfo.isInfortunato;
          p.isActive = true;
          p.isSvincolato = false;
        } else if (cInfo.isSvincolato) {
          p.fantasquadraAttuale = null;
          p.costoAttuale = cInfo.costoAcq;
          p.contrattoAttuale = null;
          p.statoAttuale = 'Svincolato';
          p.exFantasquadra = cInfo.exTeamNome;
          p.isPrestito = false;
          p.isRimpiazzoInfortunio = false;
          p.isInfortunato = false;
          p.isActive = false;
          p.isSvincolato = true;
        }
      } else {
        p.isActive = false;
        p.isSvincolato = false;
        p.statoAttuale = 'Libero';
      }
    });

    // Se ci sono giocatori della stagione attuale in arrGiocatoriA non presenti nello storico, aggiungili
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let i = 1; i < arrGiocatoriA.length; i++) {
        const g = arrGiocatoriA[i];
        if (!g || g.IDSquadra > 20) continue;
        let pName = '';
        try { pName = window[`xg${g.ID}`] || g.Nome; } catch (e) { pName = g.Nome || ''; }
        let pTeam = '';
        try { pTeam = window[`xa${g.IDSquadra}`] || ''; } catch (e) { }
        if (!pName || !pTeam || pTeam.startsWith('{')) continue;

        const norm = pName.trim().toUpperCase();
        let existing = null;
        if (g.Codice && this.playersByCode.has(Number(g.Codice))) {
          existing = this.playersByCode.get(Number(g.Codice));
        } else if (this.playersByName.has(norm)) {
          existing = this.playersByName.get(norm);
        }

        if (existing) {
          // Mappa ID della stagione attuale per lookup diretto senza season
          this.playersByIdSeason.set(`current:${g.ID}`, existing);
          if (g.Crediti && !existing.quotazione) existing.quotazione = g.Crediti;
        }
      }
    }

    this.allSerieATeams = Array.from(teamSet).filter(t => t && !t.startsWith('{')).sort((a, b) => a.localeCompare(b, 'it'));
  },

  /**
   * Restituisce l'array Q45 ("Tutti i dati") validato per il calciatore
   */
  getPlayerQueryData(player) {
    if (!player || !this.queryDataMap) return null;
    if (player.codice) {
      const byCode = this.queryDataMap[player.codice.toString().trim()];
      if (byCode && byCode.length >= 25) return byCode;
    }
    if (Array.isArray(player.codici)) {
      for (let i = 0; i < player.codici.length; i++) {
        const c = player.codici[i];
        if (!c) continue;
        const byHistCode = this.queryDataMap[c.toString().trim()];
        if (byHistCode && byHistCode.length >= 25) return byHistCode;
      }
    }
    if (player.nome) {
      const cleanName = player.nome.replace(/&nbsp;/g, ' ').trim();
      const byName = this.queryDataMap[cleanName] || this.queryDataMap[cleanName.toUpperCase()];
      if (byName && byName.length >= 25) return byName;
    }
    return null;
  },

  /**
   * Legge i parametri dall'URL (#schede_giocatori?cod=... / ?id=... / ?name=...)
   */
  parseUrlParams() {
    const hash = window.location.hash || '';
    if (!hash.includes('?')) {
      this.currentSelectedPlayer = null;
      return;
    }

    const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
    let found = null;

    // 1. Per codice giocatore univoco (?cod= o ?codice=)
    if (params.has('cod') || params.has('codice')) {
      const c = parseInt(params.get('cod') || params.get('codice'), 10);
      if (!isNaN(c) && this.playersByCode.has(c)) {
        found = this.playersByCode.get(c);
      }
    }

    // 2. Per ID + stagione specifica (?id=...&season=... o &stagione=...)
    if (!found && params.has('id') && (params.has('season') || params.has('stagione'))) {
      const pid = parseInt(params.get('id'), 10);
      const s = parseInt(params.get('season') || params.get('stagione'), 10);
      const key = `${s}:${pid}`;
      if (this.playersByIdSeason.has(key)) {
        found = this.playersByIdSeason.get(key);
        this.selectedDetailSeason = s;
        this.currentDetailTab = 'season_detail';
      }
    }

    // 3. Per ID da solo (?id=...) -> Riferito alla stagione attuale o lookup rapido
    if (!found && params.has('id')) {
      const pid = parseInt(params.get('id'), 10);
      // Controlla ID stagione corrente
      if (this.playersByIdSeason.has(`current:${pid}`)) {
        found = this.playersByIdSeason.get(`current:${pid}`);
      } else if (this.playersByIdSeason.has(`${this.seasonsCount}:${pid}`)) {
        found = this.playersByIdSeason.get(`${this.seasonsCount}:${pid}`);
      } else if (typeof arrGiocatoriA !== 'undefined') {
        const g = arrGiocatoriA.find(x => x && x.ID === pid);
        if (g) {
          if (g.Codice && this.playersByCode.has(Number(g.Codice))) {
            found = this.playersByCode.get(Number(g.Codice));
          } else {
            let pName = '';
            try { pName = window[`xg${g.ID}`] || g.Nome; } catch (e) { }
            if (pName && this.playersByName.has(pName.trim().toUpperCase())) {
              found = this.playersByName.get(pName.trim().toUpperCase());
            }
          }
        }
      }
      if (!found) {
        // Cerca retroattivamente in qualsiasi stagione
        for (let s = this.seasonsCount; s >= 1; s--) {
          if (this.playersByIdSeason.has(`${s}:${pid}`)) {
            found = this.playersByIdSeason.get(`${s}:${pid}`);
            break;
          }
        }
      }
    }

    // 4. Per nome (?name= o ?player=)
    if (!found && (params.has('name') || params.has('player'))) {
      const rawName = (params.get('name') || params.get('player')).trim().toUpperCase();
      if (this.playersByName.has(rawName)) {
        found = this.playersByName.get(rawName);
      } else {
        for (const [norm, p] of this.playersByName.entries()) {
          if (norm.includes(rawName) || rawName.includes(norm)) {
            found = p;
            break;
          }
        }
      }
    }

    if (found) {
      this.currentSelectedPlayer = found;
      if (params.has('season') || params.has('stagione')) {
        this.selectedDetailSeason = parseInt(params.get('season') || params.get('stagione'), 10);
        this.currentDetailTab = 'season_detail';
      } else {
        const q = this.getPlayerQueryData(found);
        this.currentDetailTab = (q && q.length > 0) ? 'live' : 'last_season';
      }
    } else {
      this.currentSelectedPlayer = null;
    }
  },

  /**
   * Renderizza la toolbar di filtri e il container principale (Senza maxi lista pre-caricata)
   */
  renderLayout() {
    this.container.innerHTML = `
      <div class="card">
        <!-- Header -->
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Schede Giocatori Serie A
            </div>
            <div class="card-subtitle">${this.historicalSubtitle}</div>
          </div>
          ${this.currentSelectedPlayer ? `
            <button type="button" id="btnBackToSearch" class="pill-btn schede-top-action-btn" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--radius-full);background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--accent-cyan);font-weight:700;font-size:0.82rem;cursor:pointer;transition:all 0.2s ease;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>Nuova Ricerca</span>
            </button>
          ` : ''}
        </div>

        <!-- Filter & Search Toolbar (Compatta su desktop per non nascondere i ruoli) -->
        <div class="schede-filters-bar" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:16px;">
          
          <!-- Ricerca Attiva per Nome o Cognome con Typeahead Live (Larghezza contenuta) -->
          <div class="schede-search-col" style="flex:1 1 240px;max-width:270px;position:relative;">
            <label for="inputSearch" style="font-size:0.75rem;font-weight:800;color:var(--accent-cyan);display:block;margin-bottom:4px;text-transform:uppercase;">
              🔍 Cerca Calciatore:
            </label>
            <div style="position:relative;">
              <input type="text" id="inputSearch" class="form-control" placeholder="Digita nome o cognome..." value="${this.currentSearchText}" autocomplete="off" style="width:100%;padding:9px 32px 9px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;font-size:0.9rem;" />
              <button type="button" id="btnClearSearch" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);font-weight:800;cursor:pointer;display:${this.currentSearchText ? 'block' : 'none'};padding:4px;" title="Cancella ricerca">✕</button>
            </div>
            <!-- Live Typeahead Dropdown -->
            <div id="schedeSearchDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--bg-surface-elevated);border:1px solid var(--border-focus, var(--accent-primary));border-radius:var(--radius-sm);box-shadow:0 12px 28px rgba(0,0,0,0.45);max-height:360px;overflow-y:auto;margin-top:4px;"></div>
          </div>

          <!-- Filtro Squadra Serie A -->
          <div style="flex:1;min-width:160px;">
            <label for="selSquadraA" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Squadra Serie A:
            </label>
            <select id="selSquadraA" class="form-select" style="width:100%;font-weight:700;">
              <option value="0">Tutte le Squadre</option>
            </select>
          </div>

          <!-- Filtro Ruolo -->
          <div style="flex:1;min-width:180px;">
            <label style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Ruolo:
            </label>
            <div class="pill-tabs" id="roleFilterGroup" style="margin:0;display:flex;gap:4px;">
              <button type="button" class="pill-btn ${this.currentRoleFilter === 0 ? 'active' : ''}" data-role="0">Tutti</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 1 ? 'active' : ''}" data-role="1" style="color:#d97706;font-weight:800;">P</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 2 ? 'active' : ''}" data-role="2" style="color:#16a34a;font-weight:800;">D</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 3 ? 'active' : ''}" data-role="3" style="color:#2563eb;font-weight:800;">C</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 4 ? 'active' : ''}" data-role="4" style="color:#dc2626;font-weight:800;">A</button>
            </div>
          </div>

          <!-- Filtro Fantalega / Rosa -->
          <div style="flex:1;min-width:160px;">
            <label for="selTesserati" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Fanta-Lega:
            </label>
            <select id="selTesserati" class="form-select" style="width:100%;font-size:0.82rem;">
              <option value="ALL">Tutti i calciatori</option>
              <option value="OWNED">Solo Tesserati</option>
              <option value="FREE">Solo Liberi / Svincolati</option>
            </select>
          </div>
        </div>

        <!-- Dynamic Main Content Pane -->
        <div id="schedeMainContent"></div>
      </div>
    `;

    // Popola select squadre Serie A
    const selSquadra = this.container.querySelector('#selSquadraA');
    if (selSquadra) {
      // 20 squadre attuali
      const optGroupAttuali = document.createElement('optgroup');
      optGroupAttuali.label = 'Serie A Attuale';
      for (let s = 1; s <= 20; s++) {
        let sName = '';
        try { sName = window[`xa${s}`]; } catch (e) { }
        if (sName && !sName.startsWith('{')) {
          const opt = document.createElement('option');
          opt.value = sName;
          opt.textContent = sName;
          optGroupAttuali.appendChild(opt);
        }
      }
      selSquadra.appendChild(optGroupAttuali);

      // Altre squadre storiche
      const optGroupStoriche = document.createElement('optgroup');
      optGroupStoriche.label = 'Altre Squadre Storiche';
      this.allSerieATeams.forEach(tName => {
        let isCurrent = false;
        for (let s = 1; s <= 20; s++) {
          try { if (window[`xa${s}`] === tName) isCurrent = true; } catch (e) { }
        }
        if (!isCurrent) {
          const opt = document.createElement('option');
          opt.value = tName;
          opt.textContent = tName;
          optGroupStoriche.appendChild(opt);
        }
      });
      if (optGroupStoriche.children.length > 0) {
        selSquadra.appendChild(optGroupStoriche);
      }
      if (this.currentTeamFilter) {
        selSquadra.value = this.currentTeamFilter;
      }
    }

    // Popola select fantasquadre
    const selTess = this.container.querySelector('#selTesserati');
    if (selTess && typeof arrFantasquadre !== 'undefined') {
      const optGroup = document.createElement('optgroup');
      optGroup.label = 'Fantasquadre di Lega';
      for (let f = 1; f < arrFantasquadre.length; f++) {
        if (arrFantasquadre[f]) {
          const isFav = typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.isFavoriteTeam(arrFantasquadre[f].ID);
          const optF = document.createElement('option');
          optF.value = `TEAM_${arrFantasquadre[f].ID}`;
          optF.textContent = `${isFav ? '⭐ ' : ''}Rosa: ${arrFantasquadre[f].Nome}`;
          optGroup.appendChild(optF);
        }
      }
      selTess.appendChild(optGroup);
      selTess.value = this.currentTessFilter;
    }

    // Attacca gli Event Listeners
    this.attachEventListeners();
  },

  /**
   * Gestione interattiva filtri e ricerca attiva
   */
  attachEventListeners() {
    const selSquadra = this.container.querySelector('#selSquadraA');
    if (selSquadra) {
      selSquadra.addEventListener('change', (e) => {
        this.currentTeamFilter = e.target.value === '0' ? 0 : e.target.value;
        this.currentSelectedPlayer = null;
        this.renderMainContent();
      });
    }

    this.container.querySelectorAll('#roleFilterGroup button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('#roleFilterGroup button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRoleFilter = parseInt(btn.getAttribute('data-role'), 10) || 0;
        this.currentSelectedPlayer = null;
        this.renderMainContent();
      });
    });

    const selTess = this.container.querySelector('#selTesserati');
    if (selTess) {
      selTess.addEventListener('change', (e) => {
        this.currentTessFilter = e.target.value;
        this.currentSelectedPlayer = null;
        this.renderMainContent();
      });
    }

    const searchInput = this.container.querySelector('#inputSearch');
    const clearBtn = this.container.querySelector('#btnClearSearch');
    const dropdown = this.container.querySelector('#schedeSearchDropdown');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentSearchText = e.target.value.trim();
        clearBtn.style.display = this.currentSearchText.length > 0 ? 'block' : 'none';

        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
          this.handleActiveSearchTypeahead(this.currentSearchText, dropdown);
        }, 120);
      });

      searchInput.addEventListener('focus', () => {
        if (this.currentSearchText.length >= 2) {
          this.handleActiveSearchTypeahead(this.currentSearchText, dropdown);
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstItem = dropdown.querySelector('.schede-typeahead-item');
          if (firstItem) {
            const pCode = firstItem.getAttribute('data-code');
            this.selectPlayerByCode(pCode);
            dropdown.style.display = 'none';
          } else if (this.currentSearchText.length > 0) {
            dropdown.style.display = 'none';
            this.currentSelectedPlayer = null;
            this.renderMainContent();
          }
        } else if (e.key === 'Escape') {
          dropdown.style.display = 'none';
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.currentSearchText = '';
        clearBtn.style.display = 'none';
        dropdown.style.display = 'none';
        this.renderMainContent();
        searchInput.focus();
      });
    }

    // Chiudi dropdown al clic esterno (evita leak su render multipli)
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
    }
    this._docClickHandler = (e) => {
      const dd = this.container ? this.container.querySelector('#schedeSearchDropdown') : null;
      const inp = this.container ? this.container.querySelector('#inputSearch') : null;
      if (dd && !dd.contains(e.target) && e.target !== inp) {
        dd.style.display = 'none';
      }
    };
    document.addEventListener('click', this._docClickHandler);

    const btnBack = this.container.querySelector('#btnBackToSearch');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.currentSelectedPlayer = null;
        try { history.replaceState(null, '', '#schede_giocatori'); } catch (e) { }
        this.renderLayout();
        this.renderMainContent();
      });
    }
  },

  /**
   * Typeahead attivo con dropdown flottante ultra-rapido
   */
  handleActiveSearchTypeahead(text, dropdownEl) {
    if (!dropdownEl) return;
    if (!text || text.length < 2) {
      dropdownEl.style.display = 'none';
      return;
    }

    const q = text.toLowerCase();
    const matches = [];

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p || !p.nome) continue;
      const nameLower = p.nome.toLowerCase();
      const codeStr = p.codice ? String(p.codice) : '';

      if (nameLower.includes(q) || (codeStr && codeStr.includes(q))) {
        matches.push(p);
        if (matches.length >= 12) break;
      }
    }

    if (matches.length === 0) {
      dropdownEl.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center;">Nessun calciatore trovato per "${text}".</div>`;
      dropdownEl.style.display = 'block';
      return;
    }

    dropdownEl.innerHTML = matches.map(m => {
      const rClass = `role-${(m.ruolo || 'c').toLowerCase()}`;
      const photo = m.codice ? `img/foto/${m.codice}.jpg` : 'img/foto/misterx.gif';
      return `
        <div class="schede-typeahead-item" data-code="${m.codice || m.idx}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-subtle);transition:background 0.15s;">
          <img src="${photo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;background:var(--bg-surface);border:1px solid var(--border-subtle);" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="" />
          <span class="role-badge ${rClass}">${m.ruolo || '-'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.nome}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;">
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <img src="${fcmDataLoader.getSerieALogo(m.squadra)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:13px;height:13px;object-fit:contain;" alt="" />
                <span>${m.squadra || 'Serie A'}</span>
              </span>
              <span>&bull;</span>
              <span>${m.stagioni} stag (${m.pres} pres)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    dropdownEl.style.display = 'block';

    // Click sui singoli suggerimenti
    dropdownEl.querySelectorAll('.schede-typeahead-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--bg-surface)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code');
        this.selectPlayerByCode(code);
        dropdownEl.style.display = 'none';
      });
    });
  },

  /**
   * Seleziona un calciatore tramite codice o index
   */
  selectPlayerByCode(codeOrIdx) {
    const codNum = parseInt(codeOrIdx, 10);
    let target = null;
    if (this.playersByCode.has(codNum)) {
      target = this.playersByCode.get(codNum);
    } else {
      target = this.players.find(p => p.codice == codeOrIdx || p.idx == codeOrIdx);
    }

    if (target) {
      this.currentSelectedPlayer = target;
      const q = this.getPlayerQueryData(target);
      this.currentDetailTab = (q && q.length > 0) ? 'live' : 'last_season';
      try {
        history.replaceState(null, '', '#schede_giocatori?cod=' + (target.codice || target.idx));
      } catch (e) { }
      this.renderLayout();
      this.renderPlayerDetail(target);
      this.scrollToPlayerDetail();
    }
  },

  /**
   * Renderizza il contenuto principale quando non c'è una scheda aperta:
   * Nessuna maxi lista pre-caricata; mostra stato ricerca/scoperta oppure i risultati filtrati
   */
  renderMainContent() {
    const mainPane = this.container.querySelector('#schedeMainContent');
    if (!mainPane) return;

    // Se non ci sono filtri e non c'è testo cercato -> Mostra Hero State di Scoperta
    const hasActiveFilter = (this.currentSearchText.length > 0 || this.currentTeamFilter !== 0 || this.currentRoleFilter !== 0 || this.currentTessFilter !== 'ALL');

    if (!hasActiveFilter) {
      this.renderDiscoveryHero(mainPane);
      return;
    }

    // Altrimenti esegui il filtro attivo e mostra la griglia pulita dei risultati (card deck)
    this.renderFilteredCards(mainPane);
  },

  /**
   * Pannello Discovery/Hero iniziale con i primi 10 calciatori per quotazione nella stagione attuale
   */
  renderDiscoveryHero(mainPane) {
    // Calcola dinamicamente i primi 10 calciatori per quotazione nella stagione attuale
    const activeList = [];
    if (typeof arrGiocatoriA !== 'undefined') {
      for (let i = 1; i < arrGiocatoriA.length; i++) {
        const g = arrGiocatoriA[i];
        if (!g || g.IDSquadra > 20) continue;
        activeList.push(g);
      }
    }
    activeList.sort((a, b) => (b.Crediti || 0) - (a.Crediti || 0));

    const top10 = [];
    const seen = new Set();
    for (const g of activeList) {
      let p = null;
      if (g.Codice && this.playersByCode.has(Number(g.Codice))) {
        p = this.playersByCode.get(Number(g.Codice));
      } else {
        const name = (typeof window !== 'undefined') ? window[`xg${g.ID}`] : null;
        if (name) p = this.playersByName.get(name.trim().toUpperCase());
      }
      if (p && !seen.has(p.codice || p.nome)) {
        seen.add(p.codice || p.nome);
        top10.push({ player: p, crediti: g.Crediti });
        if (top10.length >= 10) break;
      }
    }

    mainPane.innerHTML = `
      <div style="text-align:center;padding:36px 20px;background:var(--bg-surface);border-radius:var(--radius-md);border:1px dashed var(--border-subtle);margin-top:10px;">
        <div style="width:58px;height:58px;border-radius:50%;background:rgba(6, 182, 212, 0.1);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;border:1px solid rgba(6, 182, 212, 0.25);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-primary);margin:0 0 8px 0;">
          Cerca un Calciatore di Serie A
        </h3>
        <p style="font-size:0.86rem;color:var(--text-muted);max-width:560px;margin:0 auto 24px auto;line-height:1.5;">
          Usa la barra di ricerca o seleziona una squadra e un ruolo per visualizzare la scheda tecnica completa, la carriera all-time, le statistiche della stagione attuale e il dettaglio cronologico.
        </p>

        <!-- Calciatori in Evidenza (Top 10 Quotazione Attuale) -->
        <div style="margin-top:20px;">
          <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;">
            ⭐ Calciatori in Evidenza (Top 10 Quotazione Attuale)
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:920px;margin:0 auto;">
            ${top10.map(item => {
      const p = item.player;
      const rClass = `role-${(p.ruolo || 'c').toLowerCase()}`;
      return `
                <button type="button" class="pill-btn schede-quick-pill" data-code="${p.codice || p.idx}" style="display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:var(--radius-full);background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:0.82rem;font-weight:700;cursor:pointer;transition:all 0.2s ease;">
                  <span class="role-badge ${rClass}" style="font-size:0.7rem;padding:1px 6px;">${p.ruolo}</span>
                  <span>${p.nome}</span>
                  <span style="color:var(--accent-gold);font-size:0.75rem;font-weight:800;background:rgba(234,179,8,0.12);padding:1px 6px;border-radius:var(--radius-sm);border:1px solid rgba(234,179,8,0.25);">Q: ${item.crediti} FMld</span>
                </button>
              `;
    }).join('')}
          </div>
        </div>
      </div>
    `;

    mainPane.querySelectorAll('.schede-quick-pill').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--accent-primary)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent-primary)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--bg-surface-elevated)';
        btn.style.color = 'var(--text-primary)';
        btn.style.borderColor = 'var(--border-subtle)';
      });
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        this.selectPlayerByCode(code);
      });
    });
  },

  /**
   * Visualizza i risultati dei filtri sotto forma di Card Deck (senza maxi lista infinita)
   */
  renderFilteredCards(mainPane) {
    const q = this.currentSearchText.toLowerCase();
    const matched = [];

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p) continue;

      // Filtro Ruolo
      if (this.currentRoleFilter > 0) {
        const rMap = { 1: 'P', 2: 'D', 3: 'C', 4: 'A' };
        if (p.ruolo !== rMap[this.currentRoleFilter]) continue;
      }

      // Filtro Squadra Serie A
      if (this.currentTeamFilter !== 0) {
        const hasTeam = (p.squadra === this.currentTeamFilter) || (Array.isArray(p.dettaglio) && p.dettaglio.some(d => d.squadra === this.currentTeamFilter));
        if (!hasTeam) continue;
      }

      // Filtro Ricerca
      if (q.length > 0) {
        const matchName = p.nome && p.nome.toLowerCase().includes(q);
        const matchTeam = p.squadra && p.squadra.toLowerCase().includes(q);
        const matchCode = p.codice && String(p.codice).includes(q);
        if (!matchName && !matchTeam && !matchCode) continue;
      }

      // Filtro Fantalega / Rosa
      const isOwned = Boolean(p.isActive && p.fantasquadraAttuale && p.fantasquadraAttuale !== '-' && p.fantasquadraAttuale !== 'Svincolato');
      if (this.currentTessFilter === 'OWNED' && !isOwned) continue;
      if (this.currentTessFilter === 'FREE' && isOwned) continue;
      if (this.currentTessFilter.startsWith('TEAM_')) {
        const fId = parseInt(this.currentTessFilter.substring(5), 10);
        const cInfo = this.contractMap[p.nome];
        if (!cInfo || !cInfo.isActive || cInfo.teamId !== fId) continue;
      }

      matched.push(p);
    }

    // Ordina: prima per ruolo, poi presenze decrescenti, poi alfabetico
    matched.sort((a, b) => {
      const rOrder = { 'P': 1, 'D': 2, 'C': 3, 'A': 4 };
      const diff = (rOrder[a.ruolo] || 99) - (rOrder[b.ruolo] || 99);
      if (diff !== 0) return diff;
      return (b.pres - a.pres) || a.nome.localeCompare(b.nome, 'it');
    });

    this.currentFilteredPlayerCodes = matched.map(m => m.codice || m.idx);

    if (matched.length === 0) {
      mainPane.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Nessun calciatore corrisponde ai filtri selezionati.</div>
          <p style="font-size:0.85rem;margin:0;">Prova a modificare il testo di ricerca o allargare i filtri di squadra e ruolo.</p>
        </div>
      `;
      return;
    }

    // Card grid con paginazione soft (mostra i primi 60 calciatori se sono troppi)
    const MAX_SHOWN = 60;
    const shown = matched.slice(0, MAX_SHOWN);

    mainPane.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding:4px 2px;">
        <div style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">
          Trovati <b style="color:var(--accent-primary);">${matched.length}</b> calciatori:
        </div>
        ${matched.length > MAX_SHOWN ? `<span style="font-size:0.75rem;color:var(--text-muted);">Visualizzati primi ${MAX_SHOWN} risultati</span>` : ''}
      </div>

      <div class="schede-results-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;">
        ${shown.map(p => {
      const rClass = `role-${(p.ruolo || 'c').toLowerCase()}`;
      const photo = p.codice ? `img/foto/${p.codice}.jpg` : 'img/foto/misterx.gif';
      const mvStr = p.mv > 0 ? p.mv.toFixed(2) : '-';
      const fmStr = p.fm > 0 ? p.fm.toFixed(2) : '-';

      return `
            <div class="card schede-player-card" data-code="${p.codice || p.idx}" style="cursor:pointer;padding:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--bg-surface);transition:transform 0.15s, border-color 0.15s, box-shadow 0.15s;display:flex;gap:12px;align-items:center;">
              <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--border-subtle);background:var(--bg-surface-elevated);">
                <img src="${photo}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="" />
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                  <span class="role-badge ${rClass}">${p.ruolo || '-'}</span>
                  <div style="font-weight:800;font-size:0.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${p.nome}
                  </div>
                </div>
                <div style="font-size:0.74rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="display:inline-flex;align-items:center;gap:4px;">
                    <img src="${fcmDataLoader.getSerieALogo(p.squadra)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:14px;height:14px;object-fit:contain;" alt="" />
                    <span>${p.squadra || 'Serie A'}</span>
                  </span>
                </div>
                <div style="margin-top:6px;display:flex;gap:8px;font-size:0.72rem;font-weight:700;color:var(--text-secondary);">
                  <span title="Presenze totali">${p.pres} pres</span>
                  <span>&bull;</span>
                  <span title="Media Voto carriera" style="color:var(--accent-emerald);">MV: ${mvStr}</span>
                  <span>&bull;</span>
                  <span title="FantaMedia carriera" style="color:var(--accent-gold);">FM: ${fmStr}</span>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;

    mainPane.querySelectorAll('.schede-player-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.borderColor = 'var(--accent-primary)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.borderColor = 'var(--border-subtle)';
      });
      card.addEventListener('click', () => {
        const code = card.getAttribute('data-code');
        this.selectPlayerByCode(code);
      });
    });
  },

  /**
   * Renderizza la scheda dettagliata del singolo calciatore (Hero + Tabs)
   */
  renderPlayerDetail(player) {
    const mainPane = this.container.querySelector('#schedeMainContent');
    if (!mainPane || !player) return;

    const rLetter = player.ruolo || 'C';
    const rFull = rLetter === 'P' ? 'Portiere' : rLetter === 'D' ? 'Difensore' : rLetter === 'C' ? 'Centrocampista' : 'Attaccante';
    const rClass = `role-${rLetter.toLowerCase()}`;
    const photo = player.codice ? `img/foto/${player.codice}.jpg` : 'img/foto/misterx.gif';

    // Rileva se il calciatore è ancora attivo nella stagione attuale (da Q45 o arrGiocatoriA)
    const q = this.getPlayerQueryData(player);
    const isCurrentActive = !!(q && q.length > 0);

    const cInfo = this.contractMap[player.nome] || null;
    const isOwned = Boolean(isCurrentActive && cInfo && cInfo.isActive && cInfo.teamNome);
    const fTeam = isOwned ? cInfo.teamNome : '-';

    // Dati per il recap iniziale: se attivo indica le statistiche della stagione attuale, altrimenti All-Time
    let presRecap = player.pres;
    let mvRecap = player.mv > 0 ? player.mv.toFixed(2) : '-';
    let fmRecap = player.fm > 0 ? player.fm.toFixed(2) : '-';
    let golRecap = rLetter === 'P' ? player.gs : player.gol;
    let golLabel = rLetter === 'P' ? 'Gol Subiti' : 'Gol Fatti';
    let recapPeriodLabel = 'Carriera';

    if (isCurrentActive) {
      recapPeriodLabel = 'Stag. Attuale';
      presRecap = parseInt(q[6], 10) || 0;
      mvRecap = q[10] ? parseFloat(q[10].replace(',', '.')).toFixed(2) : '-';
      fmRecap = q[17] ? parseFloat(q[17].replace(',', '.')).toFixed(2) : '-';
      golRecap = rLetter === 'P' ? (parseInt(q[24], 10) || 0) : (parseInt(q[22], 10) || 0);
      golLabel = rLetter === 'P' ? 'Gol Subiti' : 'Gol Fatti';
    }

    // Età calcolata
    let etaStr = '';
    if (player.nascita) {
      const parts = player.nascita.split(/[\/\s:]/);
      if (parts.length >= 3) {
        const bDay = parseInt(parts[0], 10);
        const bMonth = parseInt(parts[1], 10) - 1;
        const bYear = parseInt(parts[2], 10);
        if (!isNaN(bYear) && bYear > 1950) {
          const birth = new Date(bYear, bMonth, bDay);
          const ageDifMs = Date.now() - birth.getTime();
          const ageDate = new Date(ageDifMs);
          const years = Math.abs(ageDate.getUTCFullYear() - 1970);
          if (years > 14 && years < 60) etaStr = `${years} anni`;
        }
      }
    }

    // Se il giocatore è attivo nella stagione attuale, il tab di default è "live" (✨ Stagione Attuale), altrimenti "last_season"
    if (isCurrentActive) {
      if (!this.currentDetailTab || this.currentDetailTab === 'alltime' || this.currentDetailTab === 'last_season') {
        this.currentDetailTab = 'live';
      }
    } else {
      if (!this.currentDetailTab || this.currentDetailTab === 'live' || this.currentDetailTab === 'alltime') {
        this.currentDetailTab = 'last_season';
      }
    }

    mainPane.innerHTML = `
      <div id="playerDetailRoot">
        <!-- Player Hero Card -->
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;background:var(--bg-surface);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:20px;">
          <div style="width:84px;height:84px;border-radius:50%;overflow:hidden;border:2px solid var(--border-subtle);flex-shrink:0;background:var(--bg-surface-elevated);box-shadow:0 4px 12px rgba(0,0,0,0.25);">
            <img src="${photo}" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${player.nome}" style="width:100%;height:100%;object-fit:cover;" />
          </div>

          <div style="flex:1;min-width:240px;">
            <h2 style="margin:0 0 8px 0;font-size:1.45rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.02em;">
              ${player.nome}
            </h2>

            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.82rem;align-items:center;">
              <span class="role-badge ${rClass}">${rFull}</span>
              
              <!-- Squadra Serie A (con logo) -->
              <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-surface-elevated);padding:3px 9px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;">
                <img src="${fcmDataLoader.getSerieALogo(player.squadra)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;" alt="${player.squadra}" />
                <span>${player.squadra}</span>
              </span>

              ${isCurrentActive ? `
                <!-- Fantasquadra (Stagione Attuale) -->
                ${isOwned ? `
                  <span style="display:inline-flex;align-items:center;gap:5px;background:rgba(6,182,212,0.12);color:var(--accent-cyan);padding:3px 9px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;">
                    <img src="img/sq/${encodeURI(fTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(fTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" alt="" />
                    <span>${fTeam}</span>
                  </span>
                  ${cInfo && cInfo.isInfortunato ? `
                    <span class="badge badge-warning" style="font-weight:800;display:inline-flex;align-items:center;gap:4px;" title="Calciatore inserito in Lista Infortunati">
                      🏥 In Lista Infortunati
                    </span>
                  ` : (cInfo && cInfo.isRimpiazzoInfortunio) ? `
                    <span class="badge badge-info" style="font-weight:800;background:rgba(14,165,233,0.18);color:var(--accent-cyan);border:1px solid rgba(14,165,233,0.3);display:inline-flex;align-items:center;gap:4px;" title="Calciatore preso in prestito per sostituire un infortunato">
                      🔄 Sostituto Infortunato (Prestito)
                    </span>
                  ` : (cInfo && cInfo.isPrestito) ? `
                    <span class="badge badge-info" style="font-weight:800;display:inline-flex;align-items:center;gap:4px;" title="Calciatore in prestito">
                      🔄 In Prestito
                    </span>
                  ` : ''}
                ` : `
                  <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg-surface-elevated);color:var(--text-muted);padding:3px 9px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;">
                    ${cInfo && cInfo.isSvincolato && cInfo.exTeamNome ? `🆓 Svincolato (ex ${cInfo.exTeamNome})` : '🆓 Libero / Svincolato'}
                  </span>
                `}

                ${cInfo && isOwned && cInfo.costoAcq ? `
                  <span style="background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);color:var(--accent-gold);font-weight:700;" title="Costo asta fantacalcio">
                    📝 ${cInfo.costoAcq} Fml (${cInfo.contratto === -1 ? 'Sostituto Inf.' : (cInfo.contratto < 0 ? 'Prestito' : `${cInfo.contratto || 1}a`)}${cInfo.isInfortunato ? ' - Lista Inf.' : ''})
                  </span>
                ` : ''}

                ${player.quotazione ? `
                  <span style="background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);color:var(--accent-gold);font-weight:700;" title="Quotazione attuale">
                    💰 ${player.quotazione} FMld
                  </span>
                ` : ''}
              ` : ''}
            </div>

            <!-- Dati Anagrafici (Data di nascita, Altezza, Peso) -->
            <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:12px;font-size:0.75rem;color:var(--text-muted);">
              ${player.nascita ? `<span>🎂 <b>${player.nascita.split(' ')[0]}</b> ${etaStr ? `(${etaStr})` : ''}</span>` : ''}
              ${player.luogo && player.luogo !== '-' ? `<span>📍 <b>${player.luogo}</b></span>` : ''}
              ${player.altezza > 0 ? `<span>📏 <b>${player.altezza} cm</b></span>` : ''}
              ${player.peso > 0 ? `<span>⚖️ <b>${player.peso} kg</b></span>` : ''}
              ${player.codice ? `<span>🏷️ Cod: <b>${player.codice}</b></span>` : ''}
            </div>
          </div>

          <!-- Quick Recap Highlights Pills (Stagione Attuale per giocatori attivi, All-Time per storici) -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);text-align:center;">
              <div style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">Presenze</div>
              <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);">${presRecap}</div>
            </div>
            <div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);text-align:center;">
              <div style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">Media Voto</div>
              <div style="font-size:1.15rem;font-weight:800;color:var(--accent-emerald);">${mvRecap}</div>
            </div>
            <div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);text-align:center;">
              <div style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">FantaMedia</div>
              <div style="font-size:1.15rem;font-weight:800;color:var(--accent-gold);">${fmRecap}</div>
            </div>
            <div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);text-align:center;">
              <div style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">${golLabel}</div>
              <div style="font-size:1.15rem;font-weight:800;color:${rLetter === 'P' ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};">${golRecap}</div>
            </div>
            ${isCurrentActive ? '' : `<div style="background:var(--bg-surface-elevated);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);text-align:center;">
              <div style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">Stagioni</div>
              <div style="font-size:1.15rem;font-weight:800;color:var(--accent-cyan);">${player.stagioni}</div>
            </div>`}
          </div>
        </div>

        <!-- Navigation Tabs: ✨ Stagione Attuale (Default per attivi) / 🗓️ Ultima Stagione (Default per storici) -->
        <div class="pill-tabs" id="schedeDetailTabs" style="margin-bottom:18px;display:flex;gap:6px;flex-wrap:wrap;">
          ${isCurrentActive ? `
            <button type="button" class="pill-btn ${this.currentDetailTab === 'live' ? 'active' : ''}" data-tab="live">
              ✨ Stagione Attuale
            </button>
            <button type="button" class="pill-btn ${this.currentDetailTab === 'season_summary' ? 'active' : ''}" data-tab="season_summary">
              🗓️ Riepilogo Stagionale
            </button>
            <button type="button" class="pill-btn ${this.currentDetailTab === 'charts' ? 'active' : ''}" data-tab="charts">
              📊 Grafici Rendimento
            </button>
          ` : `
            <button type="button" class="pill-btn ${this.currentDetailTab === 'last_season' ? 'active' : ''}" data-tab="last_season">
              🗓️ Ultima Stagione (${player.dettaglio && player.dettaglio[0] ? player.dettaglio[0].anni : ''})
            </button>
          `}
          <button type="button" class="pill-btn ${this.currentDetailTab === 'alltime' ? 'active' : ''}" data-tab="alltime">
            🌟 Carriera All-Time
          </button>
          <button type="button" class="pill-btn ${this.currentDetailTab === 'seasons' ? 'active' : ''}" data-tab="seasons">
            📅 Storico Stagione per Stagione (${player.dettaglio.length})
          </button>
          <button type="button" class="pill-btn ${this.currentDetailTab === 'season_detail' ? 'active' : ''}" data-tab="season_detail">
            🔎 Singola Stagione
          </button>
        </div>

        <!-- Content Area per il Tab Attivo -->
        <div id="schedeTabBody"></div>
      </div>
    `;

    // Renderizza il tab selezionato
    this.renderDetailTabContent(player);

    // Tab buttons event listeners
    mainPane.querySelectorAll('#schedeDetailTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        mainPane.querySelectorAll('#schedeDetailTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentDetailTab = btn.getAttribute('data-tab');
        this.renderDetailTabContent(player);
      });
    });
  },

  /**
   * Renderizza il contenuto del tab attivo per il calciatore selezionato
   */
  renderDetailTabContent(player) {
    const tabBody = this.container.querySelector('#schedeTabBody');
    if (!tabBody) return;

    if (this.currentDetailTab === 'live') {
      this.renderLiveRegistriTab(tabBody, player);
    } else if (this.currentDetailTab === 'last_season') {
      this.renderLastSeasonTab(tabBody, player);
    } else if (this.currentDetailTab === 'season_summary') {
      this.renderSeasonSummaryTab(tabBody, player);
    } else if (this.currentDetailTab === 'charts') {
      this.renderPerformanceChartsTab(tabBody, player);
    } else if (this.currentDetailTab === 'alltime') {
      this.renderAllTimeTab(tabBody, player);
    } else if (this.currentDetailTab === 'seasons') {
      this.renderSeasonsHistoryTable(tabBody, player);
    } else if (this.currentDetailTab === 'season_detail') {
      this.renderSingleSeasonDetail(tabBody, player);
    }
  },

  /**
   * Helper per decodificare il voto e calcolare il fantavoto da stringa FCM (es. "7,5+2V>1", "5-4")
   */
  parseFCMVote(str) {
    if (!str || str === '?' || str === 'sv/ng' || str === 'sv' || str === 'ng') {
      return {
        raw: str || '-',
        baseVote: null,
        bonusMalus: 0,
        fantavoto: null,
        isSV: str === 'sv/ng' || str === 'sv' || str === 'ng',
        isUnplayed: !str || str === '?'
      };
    }
    const clean = str.replace(',', '.');
    const m = clean.match(/^(\d+(?:\.\d+)?)/);
    if (!m) {
      return {
        raw: str,
        baseVote: null,
        bonusMalus: 0,
        fantavoto: null,
        isSV: true,
        isUnplayed: false
      };
    }
    const baseVote = parseFloat(m[1]);
    let bm = 0;
    // Gol fatti (+N)
    const gM = clean.match(/\+(\d+)/);
    if (gM) bm += parseInt(gM[1], 10) * 3;
    // Rigori parati (!N)
    const rpM = clean.match(/!(\d+)/);
    if (rpM) bm += parseInt(rpM[1], 10) * 3;
    // Assist (>N)
    const aM = clean.match(/>(\d+)/);
    if (aM) bm += parseInt(aM[1], 10) * 1;
    // Gol subiti (-N)
    if (!clean.includes('--')) {
      const gsM = clean.match(/-(\d+)/);
      if (gsM) bm -= parseInt(gsM[1], 10) * 1;
    }
    // Rigori sbagliati (#N)
    const rsM = clean.match(/#(\d+)/);
    if (rsM) bm -= parseInt(rsM[1], 10) * 3;
    // Autogol (_N)
    const agM = clean.match(/_(\d+)/);
    if (agM) bm -= parseInt(agM[1], 10) * 2;
    // Ammonizione (A)
    if (clean.includes('A')) bm -= 0.5;
    // Espulsione (E)
    if (clean.includes('E')) bm -= 1.0;

    return {
      raw: str,
      baseVote,
      bonusMalus: bm,
      fantavoto: Number((baseVote + bm).toFixed(2)),
      isSV: false,
      isUnplayed: false
    };
  },

  /**
   * Estrae la sequenza cronologica di tutte le giornate di Serie A per il giocatore nella stagione attuale
   * combinando calendario Serie A (fcmSerieADati.js), calendario fantalega e registri (.js)
   */
  async getPlayerCurrentSeasonMatchdays(player) {
    if (!player) return [];
    const cacheKey = player.codice || player.nome;
    if (this._matchdaysCache.has(cacheKey)) {
      return this._matchdaysCache.get(cacheKey);
    }

    // 1. Trova ID giocatore in arrGiocatoriA
    let pId = null;
    let serieATeamId = 0;
    let serieATeamName = player.squadra || '';

    if (typeof arrGiocatoriA !== 'undefined') {
      let gA = null;
      if (player.codice) {
        gA = arrGiocatoriA.find(x => x && x.Codice === player.codice);
      }
      if (!gA && player.nome) {
        const norm = player.nome.trim().toUpperCase();
        gA = arrGiocatoriA.find(x => {
          if (!x) return false;
          let xName = '';
          try { xName = window[`xg${x.ID}`] || x.Nome; } catch (e) { }
          return xName && xName.trim().toUpperCase() === norm;
        });
      }
      if (gA) {
        pId = gA.ID;
        serieATeamId = gA.IDSquadra;
        if ((!serieATeamName || serieATeamName.startsWith('{')) && typeof window !== 'undefined' && window[`xa${serieATeamId}`]) {
          serieATeamName = window[`xa${serieATeamId}`];
        }
      }
    }

    // 2. Determina fantasquadra di appartenenza
    const cInfo = this.contractMap[player.nome];
    let teamId = cInfo ? cInfo.teamId : null;

    if (!teamId && typeof arrRose !== 'undefined') {
      for (let r = 1; r < arrRose.length; r++) {
        const item = arrRose[r];
        if (item && (item.Nome === player.nome || (pId && item.Nome === `xg${pId}`))) {
          teamId = item.IDSquadra;
          break;
        }
      }
    }

    // 3. Risolvi turni di calendario fantacalcio da arrIncontri
    const rounds = [];
    const seenRounds = new Set();
    if (typeof arrIncontri !== 'undefined') {
      for (let i = 1; i < arrIncontri.length; i++) {
        const inc = arrIncontri[i];
        if (!inc || !inc.Fantagiornata) continue;
        const key = `${inc.GiornataDiA}___${inc.Fantagiornata}`;
        if (!seenRounds.has(key)) {
          seenRounds.add(key);
          rounds.push({ serieADay: inc.GiornataDiA, fantagiornata: inc.Fantagiornata });
        }
      }
      rounds.sort((a, b) => a.serieADay - b.serieADay);
    }

    // 4. Carica registro per teamId
    let teamRegistri = null;
    if (teamId && typeof fcmDataLoader !== 'undefined') {
      try {
        teamRegistri = await fcmDataLoader.loadRegisterDataForTeam(teamId);
      } catch (e) { }
    }

    // Se non trovato per teamId, cerca se il giocatore compare in qualche altro registro già presente
    let playerRow = null;
    let headerRow = null;
    if (teamRegistri) {
      headerRow = teamRegistri.find(r => r && r.IDGiocatore === 0);
      playerRow = teamRegistri.find(r => r && (r.IDGiocatore === pId || (pId && r.IDGiocatore === Number(pId))));
    }

    // Se ancora non trovato, prova a cercare in altri registri caricati in cache
    if (!playerRow && typeof fcmDataLoader !== 'undefined' && fcmDataLoader._registriCache) {
      for (const tKey in fcmDataLoader._registriCache) {
        const reg = fcmDataLoader._registriCache[tKey];
        if (Array.isArray(reg)) {
          const matchP = reg.find(r => r && (r.IDGiocatore === pId || (pId && r.IDGiocatore === Number(pId))));
          if (matchP) {
            playerRow = matchP;
            headerRow = reg.find(r => r && r.IDGiocatore === 0);
            break;
          }
        }
      }
    }

    // Risolvi colonne matchday dall'header del registro
    let resolvedCols = [];
    if (headerRow && headerRow.ListaGio) {
      const cols = headerRow.ListaGio.split('%');
      let calIdx = 0;
      resolvedCols = cols.map(c => {
        const raw = (c || '').trim();
        let matched = null;
        for (let j = calIdx; j < rounds.length; j++) {
          if (rounds[j].fantagiornata.startsWith(raw)) {
            matched = rounds[j];
            calIdx = j + 1;
            break;
          }
        }
        if (!matched) {
          matched = rounds.find(r => r.fantagiornata.startsWith(raw));
        }
        return { colName: raw, round: matched };
      });
    }

    const rawVotes = (playerRow && playerRow.ListaGio) ? playerRow.ListaGio.split('%') : [];

    // 5. Costruisci il calendario completo delle giornate di Serie A (1 .. MaxA)
    const maxSerieA = (typeof MaxA !== 'undefined' && MaxA) ? MaxA : 38;
    const matchdaysList = [];

    for (let day = 1; day <= maxSerieA; day++) {
      // Cerca incontro di Serie A per la squadra del calciatore
      let match = null;
      if (typeof arrIncontriA !== 'undefined') {
        match = arrIncontriA.find(m => m && m.Giornata === day && (m.SqCasa === serieATeamName || m.SqFuori === serieATeamName));
      }

      const isPlayed = !!(match && match.GolCasa !== '' && match.GolCasa !== undefined);
      const isHome = match ? (match.SqCasa === serieATeamName) : false;
      const opponent = match ? (isHome ? match.SqFuori : match.SqCasa) : '-';
      const resultStr = isPlayed ? `${match.GolCasa} - ${match.GolFuori}` : 'da disputare';

      // Cerca se questa giornata di A corrisponde a un turno fantacalcio nel registro
      const colIdx = resolvedCols.findIndex(c => c.round && c.round.serieADay === day);
      const hasFantaRound = (colIdx >= 0);
      const fantaCol = hasFantaRound ? resolvedCols[colIdx] : null;
      const fantaRoundLabel = fantaCol && fantaCol.round ? fantaCol.round.fantagiornata : (hasFantaRound ? fantaCol.colName : '-');

      let rawVoteStr = '';
      if (hasFantaRound && rawVotes.length > colIdx) {
        rawVoteStr = rawVotes[colIdx] || '';
      }

      const parsed = this.parseFCMVote(rawVoteStr);
      const iconsHtml = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.parseBonusMalusIcons) ? fcmDataLoader.parseBonusMalusIcons(rawVoteStr) : '';

      matchdaysList.push({
        serieADay: day,
        hasFantaRound,
        fantaRoundLabel,
        isPlayed,
        match,
        serieATeam: serieATeamName,
        isHome,
        opponent,
        resultStr,
        rawVote: rawVoteStr,
        baseVote: parsed.baseVote,
        bonusMalus: parsed.bonusMalus,
        fantavoto: parsed.fantavoto,
        isSV: parsed.isSV,
        iconsHtml
      });
    }

    this._matchdaysCache.set(cacheKey, matchdaysList);
    return matchdaysList;
  },

  /**
   * TAB: Riepilogo Stagionale (Partite Serie A, Risultato, Voto, Fantavoto, Icone Bonus/Malus)
   */
  async renderSeasonSummaryTab(container, player) {
    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.table({ cols: 6, rows: 6, withToolbar: false })
      : `
      <div style="padding:28px;text-align:center;color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto 12px auto;width:28px;height:28px;border:3px solid var(--border-subtle);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div>Caricamento riepilogo gare Serie A e voti...</div>
      </div>
    `;

    const matchdays = await this.getPlayerCurrentSeasonMatchdays(player);

    if (!matchdays || matchdays.length === 0) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="font-size:1.05rem;font-weight:700;margin-bottom:6px;">Nessun dato registrato per la stagione attuale.</div>
          <p style="font-size:0.85rem;margin:0;">Il calciatore potrebbe essere svincolato o non ancora sceso in campo.</p>
        </div>
      `;
      return;
    }

    const playedList = matchdays.filter(m => m.isPlayed);
    const futureList = matchdays.filter(m => !m.isPlayed).slice(0, 3);
    const displayList = [...playedList, ...futureList];

    container.innerHTML = `
      <div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="font-size:0.92rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          <span>🗓️</span> Riepilogo Gare Serie A &amp; Rendimento (${playedList.length} disputate)
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);">
          Dati estratti direttamente dai file (.js) di Serie A e Registri FCM
        </div>
      </div>

      <div class="table-responsive" style="max-height:650px;overflow-y:auto;border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
        <table class="modern-table" style="width:100%;font-size:0.83rem;text-align:center;">
          <thead>
            <tr style="position:sticky;top:0;background:var(--bg-surface-elevated);z-index:2;">
              <th style="width:50px;" title="Giornata di Serie A">G. A</th>
              <th style="text-align:left;" title="Partita di Serie A e campo Casa/Fuori">Partita Serie A</th>
              <th style="width:80px;" title="Risultato finale Serie A">Ris. A</th>
              <th style="text-align:left;" title="Turno del Fantacalcio">Turno Fantalega</th>
              <th style="width:65px;" title="Voto base redazione">Voto</th>
              <th style="width:80px;" title="Fantavoto totale (Voto + Bonus/Malus)">Fantavoto</th>
              <th style="text-align:left;" title="Bonus e Malus di giornata">Bonus / Malus</th>
            </tr>
          </thead>
          <tbody>
            ${displayList.map(item => {
      const rowStyle = item.isPlayed ? '' : 'style="opacity:0.6;"';
      const fvColor = (item.fantavoto !== null)
        ? (item.fantavoto >= 10 ? 'var(--accent-gold)' : item.fantavoto >= 6 ? 'var(--accent-emerald)' : 'var(--accent-crimson)')
        : 'inherit';

      let fvBadge = '-';
      if (item.fantavoto !== null) {
        fvBadge = `<b style="color:${fvColor};font-size:0.9rem;">${item.fantavoto.toFixed(1)}</b>`;
      } else if (item.isSV) {
        fvBadge = `<span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">sv/ng</span>`;
      } else if (!item.hasFantaRound) {
        fvBadge = `<span style="font-size:0.75rem;color:var(--text-muted);">-</span>`;
      }

      let votoBadge = '-';
      if (item.baseVote !== null) {
        votoBadge = `<span style="font-weight:700;">${item.baseVote.toFixed(1)}</span>`;
      } else if (item.isSV) {
        votoBadge = `<span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">sv/ng</span>`;
      }

      const homeAwayPill = item.isHome ? `<span style="font-size:0.7rem;font-weight:800;color:var(--accent-cyan);background:rgba(6,182,212,0.1);padding:1px 5px;border-radius:3px;">C</span>` : `<span style="font-size:0.7rem;font-weight:800;color:var(--text-muted);background:var(--bg-surface-elevated);padding:1px 5px;border-radius:3px;">F</span>`;

      return `
                <tr ${rowStyle}>
                  <td><b>${item.serieADay}ª</b></td>
                  <td style="text-align:left;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      ${homeAwayPill}
                      <span style="font-weight:700;">${item.match ? `${item.match.SqCasa} - ${item.match.SqFuori}` : '-'}</span>
                    </div>
                  </td>
                  <td>
                    <span style="font-weight:800;background:var(--bg-surface-elevated);padding:2px 7px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.78rem;">
                      ${item.resultStr}
                    </span>
                  </td>
                  <td style="text-align:left;font-size:0.78rem;">
                    ${item.hasFantaRound ? `<span style="color:var(--text-primary);font-weight:600;">${item.fantaRoundLabel}</span>` : `<span style="color:var(--text-muted);font-style:italic;">Non disputata nel fantacalcio</span>`}
                  </td>
                  <td>${votoBadge}</td>
                  <td>${fvBadge}</td>
                  <td style="text-align:left;">
                    ${item.iconsHtml ? `
                      <div style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
                        ${item.iconsHtml}
                      </div>
                    ` : (item.hasFantaRound && item.baseVote !== null ? `<span style="color:var(--text-muted);font-size:0.75rem;">Nessuno</span>` : `<span style="color:var(--text-muted);">-</span>`)}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * TAB: Grafici di Rendimento (Istogrammi: Voto/Fantavoto, Bonus/Malus, Quotazioni)
   */
  async renderPerformanceChartsTab(container, player) {
    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.table({ cols: 4, rows: 5, withToolbar: true, toolbarPills: 3 })
      : `
      <div style="padding:28px;text-align:center;color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto 12px auto;width:28px;height:28px;border:3px solid var(--border-subtle);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div>Generazione istogrammi di rendimento...</div>
      </div>
    `;

    const matchdays = await this.getPlayerCurrentSeasonMatchdays(player);
    const played = matchdays.filter(m => m.isPlayed && m.hasFantaRound);

    if (!this.currentChartSubTab) this.currentChartSubTab = 'votifv';

    container.innerHTML = `
      <!-- Sub-tabs Switcher -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
        <div class="pill-tabs" id="schedeChartSubTabs" style="margin:0;display:flex;gap:4px;">
          <button type="button" class="pill-btn ${this.currentChartSubTab === 'votifv' ? 'active' : ''}" data-subtab="votifv">
            📈 Voto &amp; Fantavoto
          </button>
          <button type="button" class="pill-btn ${this.currentChartSubTab === 'bonusmalus' ? 'active' : ''}" data-subtab="bonusmalus">
            ⚡ Bonus &amp; Malus
          </button>
          <button type="button" class="pill-btn ${this.currentChartSubTab === 'quotazioni' ? 'active' : ''}" data-subtab="quotazioni">
            💰 Quotazioni &amp; Benchmark
          </button>
        </div>
        <div style="font-size:0.76rem;color:var(--text-muted);">
          Dati estratti dai registri (.js) della stagione corrente
        </div>
      </div>

      <!-- Canvas Area per l'istogramma attivo -->
      <div id="schedeChartCanvasArea"></div>
    `;

    // Listeners per sub-tabs
    container.querySelectorAll('#schedeChartSubTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#schedeChartSubTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentChartSubTab = btn.getAttribute('data-subtab');
        this.renderCurrentChartCanvas(container.querySelector('#schedeChartCanvasArea'), player, played);
      });
    });

    this.renderCurrentChartCanvas(container.querySelector('#schedeChartCanvasArea'), player, played);
  },

  /**
   * Router per renderizzare l'istogramma selezionato
   */
  renderCurrentChartCanvas(canvasArea, player, played) {
    if (!canvasArea) return;

    if (this.currentChartSubTab === 'votifv') {
      this.renderVotiFvChart(canvasArea, player, played);
    } else if (this.currentChartSubTab === 'bonusmalus') {
      this.renderBonusMalusChart(canvasArea, player, played);
    } else if (this.currentChartSubTab === 'quotazioni') {
      this.renderQuotazioniChart(canvasArea, player);
    }
  },

  /**
   * Istogramma 1: Voto e Fantavoto per giornata con linea di sufficienza 6.0
   */
  renderVotiFvChart(container, player, played) {
    if (!played || played.length === 0) {
      container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessuna giornata con voti disponibile per l'istogramma.
        </div>
      `;
      return;
    }

    // Calcola massimi per scala verticale
    const maxVal = Math.max(10, ...played.map(m => m.fantavoto || m.baseVote || 0));
    const chartHeight = 220;

    container.innerHTML = `
      <div style="background:var(--bg-surface);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div style="font-size:0.88rem;font-weight:800;color:var(--text-primary);">
            Andamento Voto e Fantavoto (${played.length} giornate con turno fantacalcio)
          </div>
          <div style="display:flex;gap:14px;font-size:0.75rem;font-weight:700;">
            <span style="display:inline-flex;align-items:center;gap:5px;">
              <span style="width:12px;height:12px;background:#38bdf8;border-radius:2px;display:inline-block;"></span> Voto Base
            </span>
            <span style="display:inline-flex;align-items:center;gap:5px;">
              <span style="width:12px;height:12px;background:#eab308;border-radius:2px;display:inline-block;"></span> Fantavoto
            </span>
            <span style="display:inline-flex;align-items:center;gap:5px;color:var(--text-muted);">
              <span style="width:12px;height:2px;background:#ef4444;border-top:2px dashed #ef4444;display:inline-block;"></span> Sufficienza (6.0)
            </span>
          </div>
        </div>

        <!-- Istogramma a barre responsive -->
        <div style="position:relative;height:${chartHeight}px;display:flex;align-items:flex-end;gap:12px;padding:24px 10px 30px 40px;border-bottom:1px solid var(--border-subtle);border-left:1px solid var(--border-subtle);">
          
          <!-- Linea di riferimento Sufficienza (6.0) -->
          <div style="position:absolute;left:40px;right:10px;bottom:${Math.round((6 / maxVal) * (chartHeight - 54)) + 30}px;border-top:1px dashed rgba(239, 68, 68, 0.6);z-index:1;pointer-events:none;">
            <span style="position:absolute;left:-35px;top:-8px;font-size:0.7rem;font-weight:800;color:#ef4444;">6.0</span>
          </div>

          <!-- Barre per giornata -->
          ${played.map(item => {
      const vHeight = item.baseVote !== null ? Math.max(8, Math.round((item.baseVote / maxVal) * (chartHeight - 54))) : 0;
      const fvHeight = item.fantavoto !== null ? Math.max(8, Math.round((item.fantavoto / maxVal) * (chartHeight - 54))) : 0;
      const dayLabel = `${item.serieADay}ª`;

      return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;position:relative;z-index:2;" title="${item.fantaRoundLabel} (Serie A: ${item.match ? `${item.match.SqCasa}-${item.match.SqFuori}` : ''})\nVoto: ${item.baseVote !== null ? item.baseVote : 'SV'}\nFantavoto: ${item.fantavoto !== null ? item.fantavoto : 'SV'}">
                
                <div style="display:flex;align-items:flex-end;gap:3px;width:100%;justify-content:center;">
                  <!-- Barra Voto -->
                  ${item.baseVote !== null ? `
                    <div style="width:40%;max-width:24px;height:${vHeight}px;background:linear-gradient(180deg, #38bdf8, #0284c7);border-radius:3px 3px 0 0;position:relative;transition:transform 0.15s;">
                      <span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:0.68rem;font-weight:800;color:#38bdf8;white-space:nowrap;">
                        ${item.baseVote.toFixed(1)}
                      </span>
                    </div>
                  ` : `
                    <div style="width:40%;max-width:24px;height:14px;border:1px dashed var(--text-muted);border-radius:3px 3px 0 0;display:flex;align-items:center;justify-content:center;">
                      <span style="font-size:0.6rem;color:var(--text-muted);">sv</span>
                    </div>
                  `}

                  <!-- Barra Fantavoto -->
                  ${item.fantavoto !== null ? `
                    <div style="width:40%;max-width:24px;height:${fvHeight}px;background:linear-gradient(180deg, #facc15, #ca8a04);border-radius:3px 3px 0 0;position:relative;transition:transform 0.15s;">
                      <span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:0.68rem;font-weight:800;color:#facc15;white-space:nowrap;">
                        ${item.fantavoto.toFixed(1)}
                      </span>
                    </div>
                  ` : `
                    <div style="width:40%;max-width:24px;height:14px;border:1px dashed var(--text-muted);border-radius:3px 3px 0 0;display:flex;align-items:center;justify-content:center;">
                      <span style="font-size:0.6rem;color:var(--text-muted);">sv</span>
                    </div>
                  `}
                </div>

                <!-- Label Giornata sotto l'asse -->
                <div style="position:absolute;bottom:-24px;font-size:0.72rem;font-weight:700;color:var(--text-muted);">
                  ${dayLabel}
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Istogramma 2: Bonus & Malus netti per giornata con icone descrittive
   */
  renderBonusMalusChart(container, player, played) {
    if (!played || played.length === 0) {
      container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessuna giornata registrata per l'istogramma Bonus / Malus.
        </div>
      `;
      return;
    }

    const halfH = 90;
    const totalPlotH = halfH * 2;
    const maxBm = Math.max(4, ...played.map(m => Math.abs(parseFloat(m.bonusMalus) || 0)));
    const maxBarH = halfH - 24;

    container.innerHTML = `
      <div style="background:var(--bg-surface);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div style="font-size:0.88rem;font-weight:800;color:var(--text-primary);">
            Istogramma Bonus &amp; Malus Netto di Giornata
          </div>
          <div style="display:flex;gap:14px;font-size:0.75rem;font-weight:700;">
            <span style="color:var(--accent-emerald);">▲ Bonus (+)</span>
            <span style="color:var(--accent-crimson);">▼ Malus (-)</span>
          </div>
        </div>

        <div class="table-responsive" style="margin:0;padding-bottom:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <div style="position:relative;height:${totalPlotH}px;margin:28px 10px 32px 42px;border-left:1px solid var(--border-subtle);min-width:${Math.max(340, played.length * 40)}px;box-sizing:border-box;">
            
            <!-- Asse Zero centrale perfettamente allineato a halfH -->
            <div style="position:absolute;left:0;right:0;top:${halfH}px;height:0;border-top:1px solid var(--border-subtle);z-index:1;pointer-events:none;">
              <span style="position:absolute;left:-38px;top:-8px;font-size:0.7rem;font-weight:800;color:var(--text-muted);width:32px;text-align:right;">0.0</span>
            </div>

            <!-- Colonne giornate con allineamento millimetrico alla linea mezzana -->
            <div style="position:relative;z-index:2;height:100%;display:flex;align-items:stretch;gap:8px;padding:0 4px;">
              ${played.map(item => {
      const rawBm = parseFloat(item.bonusMalus);
      const bm = !isNaN(rawBm) ? rawBm : 0;
      const barH = Math.max(4, Math.round((Math.abs(bm) / maxBm) * maxBarH));
      const isPos = bm > 0;
      const isNeg = bm < 0;
      const bmSign = isPos ? `+${bm}` : (isNeg ? `${bm}` : '0');
      const tooltipTitle = `${item.fantaRoundLabel || `${item.serieADay}ª Giornata`}${item.match ? ` (${item.match.SqCasa}-${item.match.SqFuori})` : ''}\nBonus/Malus: ${bmSign}\nVoto: ${item.baseVote !== null ? item.baseVote : 'SV'} | Fantavoto: ${item.fantavoto !== null ? item.fantavoto : 'SV'}`;

      return `
                  <div style="flex:1;min-width:24px;max-width:44px;display:flex;flex-direction:column;align-items:center;position:relative;" title="${tooltipTitle}">
                    
                    <!-- Barra Positiva (poggia esattamente sull'asse zero) -->
                    <div style="height:${halfH}px;display:flex;align-items:flex-end;justify-content:center;width:100%;">
                      ${isPos ? `
                        <div style="width:60%;max-width:26px;height:${barH}px;background:linear-gradient(180deg, #10b981, #059669);border-radius:3px 3px 0 0;position:relative;">
                          <span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:0.68rem;font-weight:800;color:#10b981;white-space:nowrap;">
                            +${bm}
                          </span>
                        </div>
                      ` : ''}
                    </div>

                    <!-- Barra Negativa (pende esattamente dall'asse zero) -->
                    <div style="height:${halfH}px;display:flex;align-items:flex-start;justify-content:center;width:100%;">
                      ${isNeg ? `
                        <div style="width:60%;max-width:26px;height:${barH}px;background:linear-gradient(180deg, #ef4444, #b91c1c);border-radius:0 0 3px 3px;position:relative;">
                          <span style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:0.68rem;font-weight:800;color:#ef4444;white-space:nowrap;">
                            ${bm}
                          </span>
                        </div>
                      ` : (!isPos && item.baseVote !== null ? `<span style="font-size:0.68rem;font-weight:700;color:var(--text-muted);line-height:1;margin-top:3px;">0</span>` : '')}
                    </div>

                    <!-- Etichetta Giornata posizionata sotto il grafico -->
                    <div style="position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);font-size:0.72rem;font-weight:700;color:var(--text-muted);white-space:nowrap;">
                      ${item.serieADay}ª
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Istogramma 3: Quotazione e Benchmark di Ruolo & Squadra
   */
  renderQuotazioniChart(container, player) {
    const rLetter = player.ruolo || 'C';
    const rOrder = { 'P': 1, 'D': 2, 'C': 3, 'A': 4 };
    const rNum = rOrder[rLetter] || 3;

    let roleAvg = 15;
    let roleMax = 50;
    let teamAvg = 18;

    if (typeof arrGiocatoriA !== 'undefined') {
      const roleList = arrGiocatoriA.filter(g => g && g.Ruolo === rNum && g.IDSquadra <= 20);
      if (roleList.length > 0) {
        const sumR = roleList.reduce((acc, x) => acc + (x.Crediti || 0), 0);
        roleAvg = parseFloat((sumR / roleList.length).toFixed(1));
        roleMax = Math.max(...roleList.map(x => x.Crediti || 0));
      }

      let tId = 0;
      const gMatch = arrGiocatoriA.find(x => x && (x.Codice === player.codice || (window[`xg${x.ID}`] && window[`xg${x.ID}`].trim().toUpperCase() === player.nome.trim().toUpperCase())));
      if (gMatch) tId = gMatch.IDSquadra;

      if (tId > 0) {
        const teamList = arrGiocatoriA.filter(g => g && g.IDSquadra === tId);
        if (teamList.length > 0) {
          const sumT = teamList.reduce((acc, x) => acc + (x.Crediti || 0), 0);
          teamAvg = parseFloat((sumT / teamList.length).toFixed(1));
        }
      }
    }

    const cInfo = this.contractMap[player.nome];
    const playerQuot = player.quotazione || 0;
    const astaPrice = cInfo && cInfo.costoAcq ? cInfo.costoAcq : null;

    const bars = [
      { label: `Quotazione ${player.nome}`, val: playerQuot, color: 'linear-gradient(90deg, #facc15, #ca8a04)', unit: 'FMld' },
      ...(astaPrice ? [{ label: `Costo Acquisto Asta (${cInfo.teamNome})`, val: astaPrice, color: 'linear-gradient(90deg, #38bdf8, #0284c7)', unit: 'Fml' }] : []),
      { label: `Media Ruolo (${rLetter}) in Serie A`, val: roleAvg, color: 'linear-gradient(90deg, #10b981, #059669)', unit: 'FMld' },
      { label: `Top Quotazione Ruolo (${rLetter})`, val: roleMax, color: 'linear-gradient(90deg, #f97316, #ea580c)', unit: 'FMld' },
      { label: `Media Squadra (${player.squadra})`, val: teamAvg, color: 'linear-gradient(90deg, #a855f7, #7e22ce)', unit: 'FMld' }
    ];

    const maxChartVal = Math.max(...bars.map(b => b.val), 1);

    // Storico quotazioni stagione per stagione (se presente)
    const histSeasons = (Array.isArray(player.dettaglio) ? player.dettaglio.slice() : []).filter(d => d.quotazione > 0);
    histSeasons.sort((a, b) => a.stagione - b.stagione);
    const maxHistQuot = histSeasons.length > 0 ? Math.max(...histSeasons.map(h => h.quotazione)) : 1;
    const histHeight = 160;

    container.innerHTML = `
      <div style="background:var(--bg-surface);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:20px;">
        <div style="font-size:0.88rem;font-weight:800;color:var(--text-primary);margin-bottom:14px;">
          📊 Benchmark Finanziario e Confronto Quotazioni (Stagione Attuale)
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          ${bars.map(b => {
      const pct = Math.min(100, Math.max(6, Math.round((b.val / maxChartVal) * 100)));
      return `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:0.8rem;font-weight:700;">
                  <span style="color:var(--text-primary);">${b.label}</span>
                  <span style="color:var(--accent-gold);">${b.val} ${b.unit}</span>
                </div>
                <div style="width:100%;height:16px;background:var(--bg-surface-elevated);border-radius:var(--radius-full);overflow:hidden;border:1px solid var(--border-subtle);">
                  <div style="width:${pct}%;height:100%;background:${b.color};border-radius:var(--radius-full);transition:width 0.4s ease;"></div>
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>

      ${histSeasons.length > 1 ? `
        <div style="background:var(--bg-surface);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <div style="font-size:0.88rem;font-weight:800;color:var(--text-primary);">
              📈 Evoluzione Storica Quotazione (${histSeasons.length} campionati)
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              Valore in Crediti / FMld all'inizio di ciascuna stagione
            </div>
          </div>

          <div style="position:relative;height:${histHeight}px;display:flex;align-items:flex-end;gap:10px;padding:20px 10px 30px 40px;border-bottom:1px solid var(--border-subtle);border-left:1px solid var(--border-subtle);">
            ${histSeasons.map(h => {
      const bH = Math.max(10, Math.round((h.quotazione / maxHistQuot) * (histHeight - 50)));
      const yearShort = h.anni ? (h.anni.length > 7 ? h.anni.substring(2, 4) + '/' + h.anni.substring(7, 9) : h.anni) : `S${h.stagione}`;
      return `
                <div style="flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;" title="Stagione ${h.anni} (${h.squadra})\nQuotazione: ${h.quotazione} FMld">
                  <div style="width:65%;max-width:24px;height:${bH}px;background:linear-gradient(180deg, #facc15, #ca8a04);border-radius:3px 3px 0 0;position:relative;">
                    <span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:0.68rem;font-weight:800;color:#facc15;white-space:nowrap;">
                      ${h.quotazione}
                    </span>
                  </div>
                  <div style="position:absolute;bottom:-24px;font-size:0.68rem;font-weight:700;color:var(--text-muted);white-space:nowrap;">
                    ${yearShort}
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    `;
  },


  /**
   * TAB: Ultima Stagione Disputata (per calciatori storici non attivi nella stagione corrente)
   */
  renderLastSeasonTab(container, player) {
    const lastSeason = player.dettaglio && player.dettaglio.length > 0 ? player.dettaglio[0] : null;

    if (!lastSeason) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Nessun dato registrato per le stagioni archiviate.</div>
        </div>
      `;
      return;
    }

    const tile = (desc, sigla, val) => `
      <div class="schede-stat-tile" title="${desc} (${sigla})">
        <div class="schede-stat-sigla">${sigla}</div>
        <div class="schede-stat-val">${val !== undefined && val !== null && val !== '' ? val : '-'}</div>
      </div>
    `;

    const fmt = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : '-';

    // Formattazione fantasquadre dell'ultima stagione
    let fantaHtml = '';
    if (Array.isArray(lastSeason.fantasquadreDettaglio) && lastSeason.fantasquadreDettaglio.length > 0) {
      fantaHtml = lastSeason.fantasquadreDettaglio.map(f => {
        const isSvinc = (f.venduto === 1 || lastSeason.svincolatoFineStagione);
        return `
          <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-surface-elevated);padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.82rem;font-weight:700;">
            <img src="img/sq/${encodeURI(f.nome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(f.nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:16px;height:16px;object-fit:contain;" alt="" />
            <span style="color:var(--accent-cyan);">${f.nome}</span>
            ${isSvinc ? `<span class="badge badge-warning" style="font-size:0.68rem;padding:1px 5px;border-radius:3px;background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-weight:800;">Svincolato</span>` : ''}
            ${(f.costo !== null && f.costo !== undefined) ? `<span style="color:var(--accent-gold);font-weight:700;font-size:0.75rem;">(${f.costo} Fml${f.contratto !== null && f.contratto !== undefined ? (f.contratto < 0 ? ', prest.' : `, ${f.contratto}a`) : ''})</span>` : ''}
          </span>
        `;
      }).join(' ');
    } else if (lastSeason.fantasquadra && lastSeason.fantasquadra !== '-') {
      fantaHtml = `
        <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-surface-elevated);padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.82rem;font-weight:700;">
          <img src="img/sq/${encodeURI(lastSeason.fantasquadra)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(lastSeason.fantasquadra)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:16px;height:16px;object-fit:contain;" alt="" />
          <span style="color:var(--accent-cyan);">${lastSeason.fantasquadra}</span>
          ${lastSeason.svincolatoFineStagione ? `<span class="badge badge-warning" style="font-size:0.68rem;padding:1px 5px;border-radius:3px;background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-weight:800;">Svincolato</span>` : ''}
        </span>
      `;
    } else {
      fantaHtml = `<span style="font-size:0.82rem;color:var(--text-muted);font-weight:600;">🆓 Non tesserato / Svincolato</span>`;
    }

    container.innerHTML = `
      <!-- Banner Riepilogo Ultima Stagione -->
      <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="font-size:1.05rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
            <span>🗓️</span> Ultima Stagione in Serie A (${lastSeason.anni})
          </div>
          <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-surface-elevated);padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.85rem;font-weight:700;">
            <img src="${fcmDataLoader.getSerieALogo(lastSeason.squadra)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;" alt="${lastSeason.squadra}" />
            <span>${lastSeason.squadra}</span>
          </span>
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${fantaHtml}
          ${lastSeason.quotazione > 0 ? `
            <span style="background:var(--bg-surface-elevated);padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.8rem;font-weight:700;color:var(--accent-gold);" title="Quotazione finale raggiunta in Serie A">
              Quot: ${lastSeason.quotazione} FMld
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Statistiche Ultima Stagione -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-cyan);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>⚽</span> Statistiche (${lastSeason.anni})
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Presenze", "Pres", lastSeason.pres)}
          ${player.ruolo === 'P' ? `
            ${tile("Gol Subiti", "GS", lastSeason.gs)}
            ${tile("Gol Subiti Rigore", "GSR", lastSeason.gsRig)}
            ${tile("Rigori Parati", "RP", lastSeason.rp)}
            ${tile("Autogol", "AG", lastSeason.ag)}
            ${tile("Assist", "Ass", lastSeason.ass)}
            ${tile("Ammonizioni", "Amm", lastSeason.amm)}
            ${tile("Espulsioni", "Esp", lastSeason.esp)}
          ` : `
            ${tile("Gol Fatti", "GF", lastSeason.gol)}
            ${tile("Gol Fatti Rigore", "GFR", lastSeason.golRig)}
            ${tile("Rigori Sbagliati", "RS", lastSeason.rs)}
            ${tile("Autogol", "AG", lastSeason.ag)}
            ${tile("Assist", "Ass", lastSeason.ass)}
            ${tile("Ammonizioni", "Amm", lastSeason.amm)}
            ${tile("Espulsioni", "Esp", lastSeason.esp)}
          `}
        </div>
      </div>

      <!-- Medie Voto & Fantamedia Ultima Stagione -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-emerald);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📊</span> Medie Voto &amp; Fantamedia (${lastSeason.anni})
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Media Voto Casa", "MV C", fmt(lastSeason.mvc))}
          ${tile("Media Voto Fuori", "MV F", fmt(lastSeason.mvf))}
          ${tile("Media Voto Totale", "MV T", fmt(lastSeason.mv))}
          ${tile("Deviazione Std MV", "MV Dst", fmt(lastSeason.devMv))}
          ${tile("FantaMedia Casa", "FM C", fmt(lastSeason.fmc))}
          ${tile("FantaMedia Fuori", "FM F", fmt(lastSeason.fmf))}
          ${tile("FantaMedia Totale", "FM T", fmt(lastSeason.fm))}
          ${tile("Deviazione Std FM", "FM Dst", fmt(lastSeason.devFm))}
        </div>
      </div>

      <!-- Indici di Rendimento Ultima Stagione -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-gold);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📈</span> Indici di Rendimento &amp; Varie (${lastSeason.anni})
        </div>
        <div class="schede-stats-grid-7">
          ${tile("Indice Affidabilità", "Aff", lastSeason.aff > 0 ? `${lastSeason.aff}%` : '-')}
          ${tile("Delta Media Voto", "MV Dlt", fmt(lastSeason.deltaMv))}
          ${tile("Andamento Media Voto", "MV And", fmt(lastSeason.mvAnd))}
          ${tile("Rendimento Media Voto", "MV Rnd", fmt(lastSeason.rendimMv))}
          ${tile("Delta FantaMedia", "FM Dlt", fmt(lastSeason.deltaFm))}
          ${tile("Andamento FantaMedia", "FM And", fmt(lastSeason.fmAnd))}
          ${tile("Rendimento FantaMedia", "FM Rnd", fmt(lastSeason.rendimFm))}
        </div>
      </div>

      <!-- Link rapido allo storico completo -->
      <div style="text-align:center;padding:12px;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
        <button type="button" class="pill-btn schede-goto-seasons-btn" style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;font-size:0.85rem;font-weight:700;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--accent-primary);border-radius:var(--radius-full);cursor:pointer;transition:all 0.2s;">
          <span>📅 Consulta tutto lo storico carriera (${player.dettaglio.length} campionati)</span>
          <span style="font-size:0.8rem;">➔</span>
        </button>
      </div>
    `;

    const gotoBtn = (container && typeof container.querySelector === 'function')
      ? container.querySelector('.schede-goto-seasons-btn')
      : null;
    if (gotoBtn && typeof gotoBtn.addEventListener === 'function') {
      gotoBtn.addEventListener('click', () => {
        this.currentDetailTab = 'seasons';
        if (this.container && typeof this.container.querySelectorAll === 'function') {
          this.container.querySelectorAll('#schedeDetailTabs button').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-tab') === 'seasons');
          });
        }
        this.renderDetailTabContent(player);
      });
    }
  },

  /**
   * TAB 1: Carriera All-Time (Aggregata su tutte le stagioni SQLite)
   */
  renderAllTimeTab(container, player) {
    const tile = (desc, sigla, val) => `
      <div class="schede-stat-tile" title="${desc} (${sigla})">
        <div class="schede-stat-sigla">${sigla}</div>
        <div class="schede-stat-val">${val !== undefined && val !== null && val !== '' ? val : '-'}</div>
      </div>
    `;

    const fmt = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : '-';

    // Squadre Serie A in cui ha giocato
    const allTeams = Array.from(new Set(player.dettaglio.map(d => d.squadra).filter(Boolean)));
    // Fantasquadre in cui ha giocato (includendo tutte le tesserature storiche)
    const fantaSet = new Set();
    player.dettaglio.forEach(d => {
      if (Array.isArray(d.fantasquadreDettaglio)) {
        d.fantasquadreDettaglio.forEach(f => { if (f.nome && f.nome !== '-') fantaSet.add(f.nome); });
      } else if (Array.isArray(d.fantasquadre)) {
        d.fantasquadre.forEach(f => { if (f && f !== '-') fantaSet.add(f); });
      } else if (d.fantasquadra && d.fantasquadra !== '-') {
        fantaSet.add(d.fantasquadra);
      }
    });
    const allFanta = Array.from(fantaSet);

    container.innerHTML = `
      <!-- Sezione 1: Statistiche Carriera -->
      <div style="margin-bottom:24px;">
        <div style="font-size:0.95rem;font-weight:800;color:var(--accent-cyan);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>⚽</span> Statistiche (Carriera All-Time)
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Presenze Totali", "Pres", player.pres)}
          ${player.ruolo === 'P' ? `
            ${tile("Gol Subiti", "GS", player.gs)}
            ${tile("Gol Subiti Rigore", "GSR", player.gsRig)}
            ${tile("Rigori Parati", "RP", player.rp)}
            ${tile("Autogol", "AG", player.ag)}
            ${tile("Assist", "Ass", player.ass)}
            ${tile("Ammonizioni", "Amm", player.amm)}
            ${tile("Espulsioni", "Esp", player.esp)}
          ` : `
            ${tile("Gol Fatti", "GF", player.gol)}
            ${tile("Gol Fatti Rigore", "GFR", player.golRig)}
            ${tile("Rigori Sbagliati", "RS", player.rs)}
            ${tile("Autogol", "AG", player.ag)}
            ${tile("Assist", "Ass", player.ass)}
            ${tile("Ammonizioni", "Amm", player.amm)}
            ${tile("Espulsioni", "Esp", player.esp)}
          `}
        </div>
      </div>

      <!-- Sezione 2: Medie Voto & Fantamedia Ponderate Carriera -->
      <div style="margin-bottom:24px;">
        <div style="font-size:0.95rem;font-weight:800;color:var(--accent-emerald);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>📊</span> Medie Voto &amp; Fantamedia Ponderate (Carriera)
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Media Voto Totale Carriera", "MV T", fmt(player.mv))}
          ${tile("Media Voto Casa", "MV C", fmt(player.mvc))}
          ${tile("Media Voto Fuori", "MV F", fmt(player.mvf))}
          ${tile("FantaMedia Totale Carriera", "FM T", fmt(player.fm))}
          ${tile("FantaMedia Casa", "FM C", fmt(player.fmc))}
          ${tile("FantaMedia Fuori", "FM F", fmt(player.fmf))}
          ${tile("Punti Generati (FM x Pres)", "FPunti", player.pres > 0 ? (player.fm * player.pres).toFixed(1) : '-')}
          ${tile("Rendimento Partita", "Pti/G", player.pres > 0 ? ((player.fm * player.pres) / player.pres).toFixed(2) : '-')}
        </div>
      </div>

      <!-- Sezione 3: Militanza Club e Fantalega -->
      <div>
        <div style="font-size:0.95rem;font-weight:800;color:var(--accent-gold);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>🛡️</span> Maglie &amp; Militanza in Carriera
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
          
          <!-- Club Serie A -->
          <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
              Squadre Serie A (${allTeams.length})
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${allTeams.map(t => `
                <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-surface-elevated);padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.8rem;font-weight:700;">
                  <img src="${fcmDataLoader.getSerieALogo(t)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" alt="" />
                  <span>${t}</span>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Fantasquadre di Lega -->
          <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
              Fantasquadre di Lega (${allFanta.length})
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${allFanta.length > 0 ? allFanta.map(f => `
                <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg-surface-elevated);padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.8rem;font-weight:700;color:var(--accent-cyan);">
                  <img src="img/sq/${encodeURI(f)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(f)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:14px;height:14px;object-fit:contain;" alt="" />
                  <span>${f}</span>
                </span>
              `).join('') : '<span style="font-size:0.8rem;color:var(--text-muted);">Nessun tesseramento storico rilevato</span>'}
            </div>
          </div>

        </div>
      </div>
    `;
  },

  /**
   * TAB 2: Tabella Cronologica Completa Stagione per Stagione
   */
  renderSeasonsHistoryTable(container, player) {
    const fmt = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : '-';

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--text-primary);">
          Carriera Cronologica (${player.dettaglio.length} campionati)
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);">
          Clicca su "Apri" o sulla riga per consultare il dettaglio analitico della stagione
        </div>
      </div>

      <div class="table-responsive" style="max-height:600px;overflow-y:auto;border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
        <table class="modern-table" style="width:100%;font-size:0.82rem;text-align:center;">
          <thead>
            <tr style="position:sticky;top:0;background:var(--bg-surface-elevated);z-index:2;">
              <th style="text-align:left;">Stagione</th>
              <th>Squadra</th>
              <th>Fantasquadra</th>
              <th title="Costo Asta">€ Asta</th>
              <th title="Anni Contratto">Contr.</th>
              <th title="Presenze">Pres</th>
              <th title="Media Voto Totale">MV</th>
              <th title="FantaMedia Totale">FM</th>
              <th title="${player.ruolo === 'P' ? 'Gol Subiti' : 'Gol Fatti'}">${player.ruolo === 'P' ? 'GS' : 'GF'}</th>
              <th title="Assist">Ass</th>
              <th title="Ammonizioni">Amm</th>
              <th title="Espulsioni">Esp</th>
              <th title="Dettaglio analitico">Dettagli</th>
            </tr>
          </thead>
          <tbody>
            ${player.dettaglio.map(d => {
      const sqLogo = fcmDataLoader.getSerieALogo(d.squadra);

      let fList = [];
      if (Array.isArray(d.fantasquadreDettaglio) && d.fantasquadreDettaglio.length > 0) {
        fList = d.fantasquadreDettaglio;
      } else if (d.fantasquadra && d.fantasquadra !== '-') {
        fList = [{
          nome: d.fantasquadra,
          costo: d.costo,
          contratto: d.contratto,
          venduto: d.svincolatoFineStagione ? 1 : 0
        }];
      }

      let fantaColHtml = '';
      let costoColHtml = '';
      let contrColHtml = '';

      if (fList.length === 0) {
        fantaColHtml = `<span style="color:var(--text-muted);">-</span>`;
        costoColHtml = `<span style="color:var(--text-muted);">-</span>`;
        contrColHtml = `<span style="color:var(--text-muted);">-</span>`;
      } else {
        fantaColHtml = `<div style="display:flex;flex-direction:column;gap:3px;align-items:center;">` +
          fList.map(f => {
            const isSvinc = (f.venduto === 1 || (fList.length === 1 && d.svincolatoFineStagione));
            return `
                      <span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
                        <span style="color:var(--accent-cyan);font-weight:700;">${f.nome}</span>
                        ${isSvinc ? `<span style="font-size:0.65rem;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-weight:800;" title="Svincolato / Ceduto">svinc.</span>` : ''}
                      </span>
                    `;
          }).join('') + `</div>`;

        costoColHtml = `<div style="display:flex;flex-direction:column;gap:3px;align-items:center;">` +
          fList.map(f => {
            return `<span style="color:var(--accent-gold);font-weight:700;white-space:nowrap;">${(f.costo !== null && f.costo !== undefined) ? `${f.costo} Fml` : '-'}</span>`;
          }).join('') + `</div>`;

        contrColHtml = `<div style="display:flex;flex-direction:column;gap:3px;align-items:center;">` +
          fList.map(f => {
            return `<span style="white-space:nowrap;">${(f.contratto !== null && f.contratto !== undefined) ? (f.contratto < 0 ? 'Prest' : `${f.contratto}a`) : '-'}</span>`;
          }).join('') + `</div>`;
      }

      return `
                <tr class="schede-season-row" data-season="${d.stagione}" style="cursor:pointer;transition:background 0.15s;">
                  <td style="text-align:left;font-weight:700;">
                    <span style="color:var(--accent-primary);">${d.anni}</span>
                  </td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
                      <img src="${sqLogo}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" alt="" />
                      <span>${d.squadra}</span>
                    </span>
                  </td>
                  <td>${fantaColHtml}</td>
                  <td>${costoColHtml}</td>
                  <td>${contrColHtml}</td>
                  <td><b>${d.pres}</b></td>
                  <td style="color:var(--accent-emerald);font-weight:700;">${fmt(d.mv)}</td>
                  <td style="color:var(--accent-gold);font-weight:700;">${fmt(d.fm)}</td>
                  <td><b>${player.ruolo === 'P' ? d.gs : d.gol}</b></td>
                  <td>${d.ass}</td>
                  <td>${d.amm}</td>
                  <td>${d.esp}</td>
                  <td>
                    <button type="button" class="pill-btn schede-open-season-btn" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;font-size:0.75rem;font-weight:700;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--accent-cyan);border-radius:var(--radius-full);cursor:pointer;transition:all 0.2s;">
                      <span>Apri</span>
                      <span style="font-size:0.7rem;">▶</span>
                    </button>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.schede-season-row').forEach(row => {
      row.addEventListener('click', () => {
        const s = parseInt(row.getAttribute('data-season'), 10);
        this.selectedDetailSeason = s;
        this.currentDetailTab = 'season_detail';
        this.container.querySelectorAll('#schedeDetailTabs button').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tab') === 'season_detail');
        });
        this.renderDetailTabContent(player);
      });
    });
  },

  /**
   * TAB 3: Dettaglio Analitico della Singola Stagione
   */
  renderSingleSeasonDetail(container, player) {
    if (!this.selectedDetailSeason && player.dettaglio.length > 0) {
      this.selectedDetailSeason = player.dettaglio[0].stagione;
    }

    let seasonData = player.dettaglio.find(d => d.stagione === this.selectedDetailSeason);
    if (!seasonData && player.dettaglio.length > 0) {
      seasonData = player.dettaglio[0];
      this.selectedDetailSeason = seasonData.stagione;
    }

    if (!seasonData) {
      container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);">Nessun dettaglio per questa stagione.</div>`;
      return;
    }

    const tile = (desc, sigla, val) => `
      <div class="schede-stat-tile" title="${desc} (${sigla})">
        <div class="schede-stat-sigla">${sigla}</div>
        <div class="schede-stat-val">${val !== undefined && val !== null && val !== '' ? val : '-'}</div>
      </div>
    `;

    const fmt = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : '-';

    // Formattazione fantasquadre
    let fantaSummaryHtml = '<span style="color:var(--text-muted);">Non tesserato</span>';
    if (Array.isArray(seasonData.fantasquadreDettaglio) && seasonData.fantasquadreDettaglio.length > 0) {
      fantaSummaryHtml = seasonData.fantasquadreDettaglio.map(f => {
        const isSvinc = (f.venduto === 1 || seasonData.svincolatoFineStagione);
        const costStr = (f.costo !== null && f.costo !== undefined) ? ` (${f.costo} Fml)` : '';
        return `<span style="color:var(--accent-cyan);">Fanta: ${f.nome}</span>${isSvinc ? ` <span style="font-size:0.68rem;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-weight:700;">svinc.</span>` : ''}${costStr}`;
      }).join(' <span style="color:var(--text-muted);">&bull;</span> ');
    } else if (seasonData.fantasquadra && seasonData.fantasquadra !== '-') {
      const isSvinc = seasonData.svincolatoFineStagione;
      const costStr = (seasonData.costo !== null && seasonData.costo !== undefined) ? ` (${seasonData.costo} Fml)` : '';
      fantaSummaryHtml = `<span style="color:var(--accent-cyan);">Fanta: ${seasonData.fantasquadra}</span>${isSvinc ? ` <span style="font-size:0.68rem;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-weight:700;">svinc.</span>` : ''}${costStr}`;
    }

    container.innerHTML = `
      <!-- Selettore della Stagione da Esaminare -->
      <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <label for="selSeasonDetailPicker" style="font-size:0.8rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">
            Seleziona Campionato:
          </label>
          <select id="selSeasonDetailPicker" class="form-select" style="font-weight:700;padding:5px 12px;font-size:0.85rem;">
            ${player.dettaglio.map(d => `
              <option value="${d.stagione}" ${d.stagione === this.selectedDetailSeason ? 'selected' : ''}>
                Stagione ${d.anni} - ${d.squadra}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Riepilogo compatto della stagione scelta -->
        <div style="display:flex;align-items:center;gap:12px;font-size:0.82rem;font-weight:700;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <img src="${fcmDataLoader.getSerieALogo(seasonData.squadra)}" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;" alt="" />
            <span>${seasonData.squadra}</span>
          </span>
          <span>&bull;</span>
          ${fantaSummaryHtml}
          ${seasonData.quotazione ? `<span>&bull;</span><span style="color:var(--accent-gold);">Quot: ${seasonData.quotazione} FMld</span>` : ''}
        </div>
      </div>

      <!-- Section 1: Statistiche della Singola Stagione -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-cyan);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>⚽</span> Statistiche (${seasonData.anni})
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Presenze", "Pres", seasonData.pres)}
          ${player.ruolo === 'P' ? `
            ${tile("Gol Subiti", "GS", seasonData.gs)}
            ${tile("Gol Subiti Rigore", "GSR", seasonData.gsRig)}
            ${tile("Rigori Parati", "RP", seasonData.rp)}
            ${tile("Autogol", "AG", seasonData.ag)}
            ${tile("Assist", "Ass", seasonData.ass)}
            ${tile("Ammonizioni", "Amm", seasonData.amm)}
            ${tile("Espulsioni", "Esp", seasonData.esp)}
          ` : `
            ${tile("Gol Fatti", "GF", seasonData.gol)}
            ${tile("Gol Fatti Rigore", "GFR", seasonData.golRig)}
            ${tile("Rigori Sbagliati", "RS", seasonData.rs)}
            ${tile("Autogol", "AG", seasonData.ag)}
            ${tile("Assist", "Ass", seasonData.ass)}
            ${tile("Ammonizioni", "Amm", seasonData.amm)}
            ${tile("Espulsioni", "Esp", seasonData.esp)}
          `}
        </div>
      </div>

      <!-- Section 2: Medie Voto & Fantamedia della Singola Stagione -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-emerald);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📊</span> Medie Voto &amp; Fantamedia (${seasonData.anni})
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Media Voto Casa", "MV C", fmt(seasonData.mvc))}
          ${tile("Media Voto Fuori", "MV F", fmt(seasonData.mvf))}
          ${tile("Media Voto Totale", "MV T", fmt(seasonData.mv))}
          ${tile("Deviazione Std MV", "MV Dst", fmt(seasonData.devMv))}
          ${tile("FantaMedia Casa", "FM C", fmt(seasonData.fmc))}
          ${tile("FantaMedia Fuori", "FM F", fmt(seasonData.fmf))}
          ${tile("FantaMedia Totale", "FM T", fmt(seasonData.fm))}
          ${tile("Deviazione Std FM", "FM Dst", fmt(seasonData.devFm))}
        </div>
      </div>

      <!-- Section 3: Indici di Rendimento & Trend della Singola Stagione -->
      <div>
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-gold);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📈</span> Indici di Rendimento &amp; Varie (${seasonData.anni})
        </div>
        <div class="schede-stats-grid-7">
          ${tile("Indice Affidabilità", "Aff", seasonData.aff > 0 ? `${seasonData.aff}%` : '-')}
          ${tile("Delta Media Voto", "MV Dlt", fmt(seasonData.deltaMv))}
          ${tile("Andamento Media Voto", "MV And", fmt(seasonData.mvAnd))}
          ${tile("Rendimento Media Voto", "MV Rnd", fmt(seasonData.rendimMv))}
          ${tile("Delta FantaMedia", "FM Dlt", fmt(seasonData.deltaFm))}
          ${tile("Andamento FantaMedia", "FM And", fmt(seasonData.fmAnd))}
          ${tile("Rendimento FantaMedia", "FM Rnd", fmt(seasonData.rendimFm))}
        </div>
      </div>
    `;

    const picker = container.querySelector('#selSeasonDetailPicker');
    if (picker) {
      picker.addEventListener('change', (e) => {
        this.selectedDetailSeason = parseInt(e.target.value, 10);
        this.renderSingleSeasonDetail(container, player);
      });
    }
  },

  /**
   * TAB 4: ✨ Stagione Attuale (Dati Registri FCM della stagione corrente)
   */
  renderLiveRegistriTab(container, player) {
    const q = this.getPlayerQueryData(player) || [];

    if (!q || q.length === 0) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Calciatore non presente nei registri della stagione attuale.</div>
          <p style="font-size:0.85rem;margin:0;">Il calciatore potrebbe essere svincolato, trasferito all'estero o ritirato rispetto al campionato corrente di Serie A.</p>
        </div>
      `;
      return;
    }

    const tile = (desc, sigla, val) => `
      <div class="schede-stat-tile" title="${desc} (${sigla})">
        <div class="schede-stat-sigla">${sigla}</div>
        <div class="schede-stat-val">${val !== undefined && val !== null && val !== '' ? val : '-'}</div>
      </div>
    `;

    container.innerHTML = `
      <!-- Statistiche Live -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-cyan);margin-bottom:10px;">⚽ Statistiche (Stagione Attuale)</div>
        <div class="schede-stats-grid-8">
          ${tile("Presenze", "Pres", q[6])}
          ${player.ruolo === 'P' ? `
            ${tile("Gol Subiti", "GS", q[24])}
            ${tile("Gol Subiti Rigore", "GSR", q[25])}
            ${tile("Rigori Parati", "RP", q[28])}
            ${tile("Autogol", "AG", q[26])}
            ${tile("Assist", "Ass", q[27])}
            ${tile("Ammonizioni", "Amm", q[30])}
            ${tile("Espulsioni", "Esp", q[31])}
          ` : `
            ${tile("Gol Fatti", "GF", q[22])}
            ${tile("Gol Fatti Rigore", "GFR", q[23])}
            ${tile("Rigori Sbagliati", "RS", q[29])}
            ${tile("Autogol", "AG", q[26])}
            ${tile("Assist", "Ass", q[27])}
            ${tile("Ammonizioni", "Amm", q[30])}
            ${tile("Espulsioni", "Esp", q[31])}
          `}
        </div>
      </div>

      <!-- Medie Voto & Fantamedia Live -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-emerald);margin-bottom:10px;">📊 Medie Voto &amp; Fantamedia (Stagione Attuale)</div>
        <div class="schede-stats-grid-8">
          ${tile("Media Voto Casa", "MV C", q[8])}
          ${tile("Media Voto Fuori", "MV F", q[9])}
          ${tile("Media Voto Totale", "MV T", q[10])}
          ${tile("Deviazione Std MV", "MV Dst", q[11])}
          ${tile("FantaMedia Casa", "FM C", q[15])}
          ${tile("FantaMedia Fuori", "FM F", q[16])}
          ${tile("FantaMedia Totale", "FM T", q[17])}
          ${tile("Deviazione Std FM", "FM Dst", q[18])}
        </div>
      </div>

      <!-- Indici di Rendimento Live -->
      <div>
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-gold);margin-bottom:10px;">📈 Indici di Rendimento &amp; Varie (Stagione Attuale)</div>
        <div class="schede-stats-grid-7">
          ${tile("Indice Affidabilità", "Aff", q[7])}
          ${tile("Delta Media Voto", "MV Dlt", q[12])}
          ${tile("Andamento Media Voto", "MV And", q[13])}
          ${tile("Rendimento Media Voto", "MV Rnd", q[14])}
          ${tile("Delta FantaMedia", "FM Dlt", q[19])}
          ${tile("Andamento FantaMedia", "FM And", q[20])}
          ${tile("Rendimento FantaMedia", "FM Rnd", q[21])}
        </div>
      </div>
    `;
  },

  /**
   * Helper per scorrere dolcemente alla scheda calciatore
   */
  scrollToPlayerDetail(smooth = true) {
    requestAnimationFrame(() => {
      const rootContainer = this.container || document;
      const target = rootContainer.querySelector('#playerDetailRoot') || rootContainer.querySelector('.card');
      if (!target) return;

      const header = document.querySelector('.app-header');
      const headerHeight = header ? header.getBoundingClientRect().height : 60;
      const rect = target.getBoundingClientRect();
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      const targetY = Math.max(0, currentScrollY + rect.top - headerHeight - 14);

      window.scrollTo({
        top: targetY,
        behavior: smooth ? 'smooth' : 'instant'
      });
    });
  },

  destroy() {
    this._renderToken = (this._renderToken || 0) + 1;
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    if (this._hashChangeHandler) {
      window.removeEventListener('hashchange', this._hashChangeHandler);
      this._hashChangeHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  }
};

if (typeof window !== 'undefined') {
  window.schedeGiocatoriView = schedeGiocatoriView;
}
