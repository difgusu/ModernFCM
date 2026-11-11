/**
 * ROSE VIEW
 * Team rosters, player search, contracts, valuations, top 11 & financial balance
 * ModernFCM
 */

const roseView = {
  currentTeamId: null, // Dinamico: prima squadra attiva da arrFantasquadre (o da query param)
  selectedSeason: null, // Dinamico: stagione selezionata (null = stagione attuale)
  selectedFranchiseId: null, // Dinamico: ID franchigia Albo d'oro
  _paramTeamName: null,
  currentTab: 'attuali', // 'attuali' | 'valore' | 'top11' | 'affari' | 'statistiche' | 'svincolati' | 'bilancio'
  searchQuery: '',
  selectedModulo: '3-4-3',
  selectedTopModulo: '3-4-3',
  selectedFlopModulo: '3-4-3',
  attualiSortKey: 'default', // 'default' (ruolo + alfabetico) | 'role' | 'name' | 'serieATeam' | 'mv' | 'fm' | 'contract' | 'cost'
  attualiSortOrder: 'asc',
  valoreSortKey: 'default', // 'default' (ruolo + alfabetico) | 'role' | 'name' | 'serieATeam' | 'cost' | 'val' | 'delta'
  valoreSortOrder: 'asc',
  valoreRepSortKey: 'default', // 'default' (P D C A) | 'reparto' | 'cost' | 'val' | 'delta'
  valoreRepSortOrder: 'asc',
  _statsMap: null,
  _teamStatsCache: {},
  _dataLoaded: false,
  _fantamHtmlCache: {},
  _historicalDataCache: {},

  /**
   * Load required external scripts and build fast player stats map
   * Reads player stats directly from fcmRegistriDatiX.js for active team
   */
  async ensureDataLoaded(teamId = null) {
    if (!this._dataLoaded) {
      if (typeof arrSerieA === 'undefined' || typeof xa1 === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmSerieADati.js');
      }
      if (typeof arrGiocatoriA === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
      }
      if (typeof arrQuery === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmQueryDati.js');
      }
      if (typeof moduliAmmessi === 'undefined') {
        await fcmDataLoader.loadScript('js/fcmInvioFormazioneDati.js').catch(() => { });
      }

      // Resolves Query 45 ('Tutti i dati')
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
          if (qRes && Array.isArray(qRes.rows) && qRes.rows.length > 0 && (!qRes.headers || qRes.headers.length >= 18)) {
            qRows = qRes.rows;
          }
        } catch (e) { }
      }
      if (!qRows) {
        await fcmDataLoader.loadScript(`js/fcmQueryQ${qId}.js`, 'reexec', 'ISO-8859-1').catch(() => { });
        if (typeof arrRisQuery !== 'undefined' && arrRisQuery.length > 1 && (!arrRisQuery[1] || String(arrRisQuery[1].ListaValori || '').split('%').length >= 18)) {
          qRows = [];
          for (let q = 2; q < arrRisQuery.length; q++) {
            const row = arrRisQuery[q];
            if (row && row.ListaValori) qRows.push(row.ListaValori.split('%'));
          }
        }
      }

      // Build fallback stats map
      this._statsMap = new Map();
      const normalizeKey = (s) => (s || '').toLowerCase().replace(/&nbsp;/g, ' ').replace(/[^a-z0-9]/g, '');

      // 1. Populate from query rows
      if (Array.isArray(qRows)) {
        for (let q = 0; q < qRows.length; q++) {
          const parts = qRows[q];
          if (parts && parts.length >= 18) {
            const pName = (parts[0] || '').replace(/&nbsp;/g, ' ').trim();
            const pCode = (parts[3] || '').trim();
            const val = parseFloat(parts[4]) || 0;
            const mv = parseFloat((parts[10] || '').replace(',', '.')) || 0;
            const fm = parseFloat((parts[17] || '').replace(',', '.')) || 0;
            const sTeam = (parts[1] || '').trim();

            const info = { name: pName, code: pCode, val, mv, fm, sTeam };
            if (pName) this._statsMap.set(normalizeKey(pName), info);
            if (pCode) this._statsMap.set(`code_${pCode}`, info);
          }
        }
      }

      // 2. Supplement from arrGiocatoriA (valore / crediti)
      if (typeof arrGiocatoriA !== 'undefined') {
        for (let g = 1; g < arrGiocatoriA.length; g++) {
          const ga = arrGiocatoriA[g];
          if (!ga) continue;
          let pName = '';
          try {
            pName = (typeof window !== 'undefined' && window[`xg${ga.ID}`]) ? window[`xg${ga.ID}`] : ga.Nome;
          } catch (e) { }

          const normK = normalizeKey(pName);
          const codeK = ga.Codice ? `code_${ga.Codice}` : null;
          const existing = (normK && this._statsMap.get(normK)) || (codeK && this._statsMap.get(codeK));

          if (existing) {
            if (!existing.val && ga.Crediti) existing.val = ga.Crediti;
            if (!existing.code && ga.Codice) existing.code = ga.Codice;
          } else if (normK) {
            const info = { name: pName, code: ga.Codice, val: ga.Crediti || 0, mv: 0, fm: 0, sTeam: '' };
            this._statsMap.set(normK, info);
            if (codeK) this._statsMap.set(codeK, info);
          }
        }
      }

      this._dataLoaded = true;
    }

    // Load team-specific register statistics directly from fcmRegistriDatiX.js
    if (teamId && !this._teamStatsCache[teamId]) {
      const regList = await fcmDataLoader.loadRegisterDataForTeam(teamId);
      const teamMap = new Map();
      const normalizeKey = (s) => (s || '').toLowerCase().replace(/&nbsp;/g, ' ').replace(/[^a-z0-9]/g, '');

      if (regList && regList.length > 0) {
        for (let i = 1; i < regList.length; i++) {
          const r = regList[i];
          if (!r || r.IDGiocatore <= 0 || r.IDQuot !== 1) continue;

          const stats = r.ListaStat ? r.ListaStat.split('%') : [];
          const mv = stats[2] ? (parseFloat(stats[2].replace(',', '.')) || 0) : 0;
          const fm = stats[9] ? (parseFloat(stats[9].replace(',', '.')) || 0) : 0;
          const pr = stats[14] ? (parseInt(stats[14], 10) || 0) : 0;

          let pName = '';
          try {
            pName = (typeof window !== 'undefined' && window[`xg${r.IDGiocatore}`]) ? window[`xg${r.IDGiocatore}`] : '';
          } catch (e) { }

          let val = 0;
          let code = '';
          let sTeam = '';
          if (typeof arrGiocatoriA !== 'undefined') {
            const ga = arrGiocatoriA.find(g => g && g.ID === r.IDGiocatore);
            if (ga) {
              val = ga.Crediti || 0;
              code = ga.Codice || '';
              if (ga.IDSquadra && typeof window !== 'undefined' && window[`xa${ga.IDSquadra}`]) {
                sTeam = window[`xa${ga.IDSquadra}`];
              }
            }
          }

          if (!val && this._statsMap) {
            const fallback = this._statsMap.get(normalizeKey(pName));
            if (fallback && fallback.val) val = fallback.val;
            if (!sTeam && fallback && fallback.sTeam) sTeam = fallback.sTeam;
          }

          const info = { name: pName, id: r.IDGiocatore, code, val, mv, fm, pr, sTeam };
          teamMap.set(String(r.IDGiocatore), info);
          if (pName) teamMap.set(normalizeKey(pName), info);
          if (code) teamMap.set(`code_${code}`, info);
        }
      }
      this._teamStatsCache[teamId] = teamMap;
    }
  },

  isHistoricalSeason() {
    const currentSeasonId = fcmDataLoader.getCurrentSeason();
    return Boolean(this.selectedSeason && Number(this.selectedSeason) !== Number(currentSeasonId));
  },

  /**
   * Helper to retrieve player valuation and stats from map (prioritizes fcmRegistriDatiX.js or direct playerObj in historical)
   */
  getPlayerStats(playerName, playerCode = null, playerObj = null) {
    if (playerObj && (this.isHistoricalSeason() || playerObj.val !== undefined || playerObj.fm !== undefined)) {
      return {
        val: parseFloat(playerObj.val) || 0,
        mv: parseFloat(playerObj.mv) || 0,
        fm: parseFloat(playerObj.fm) || 0,
        pr: parseInt(playerObj.pr, 10) || 0,
        sTeam: playerObj.serieATeam || ''
      };
    }
    if (playerObj) {
      if (playerObj.fm !== undefined && playerObj.fm !== null && Number(playerObj.fm) > 0) {
        return {
          val: parseFloat(playerObj.val) || 0,
          mv: parseFloat(playerObj.mv) || 0,
          fm: parseFloat(playerObj.fm) || 0,
          pr: parseInt(playerObj.pr, 10) || 0,
          sTeam: playerObj.serieATeam || ''
        };
      }
      if (playerObj.val !== undefined && playerObj.val !== null && Number(playerObj.val) > 0) {
        return {
          val: parseFloat(playerObj.val) || 0,
          mv: parseFloat(playerObj.mv) || 0,
          fm: parseFloat(playerObj.fm) || 0,
          pr: parseInt(playerObj.pr, 10) || 0,
          sTeam: playerObj.serieATeam || ''
        };
      }
    }

    const normalizeKey = (s) => (s || '').toLowerCase().replace(/&nbsp;/g, ' ').replace(/[^a-z0-9]/g, '');
    const currentTeamMap = (this.currentTeamId && this._teamStatsCache) ? this._teamStatsCache[this.currentTeamId] : null;

    if (currentTeamMap) {
      if (playerCode) {
        const byId = currentTeamMap.get(String(playerCode));
        if (byId) return byId;
        const byCode = currentTeamMap.get(`code_${playerCode}`);
        if (byCode) return byCode;
      }
      if (playerName) {
        const byName = currentTeamMap.get(normalizeKey(playerName));
        if (byName) return byName;
      }
    }

    if (!this._statsMap) {
      if (playerObj) {
        return {
          val: parseFloat(playerObj.val) || 0,
          mv: parseFloat(playerObj.mv) || 0,
          fm: parseFloat(playerObj.fm) || 0,
          pr: parseInt(playerObj.pr, 10) || 0,
          sTeam: playerObj.serieATeam || ''
        };
      }
      return { val: 0, mv: 0, fm: 0, sTeam: '' };
    }
    if (playerCode) {
      const byCode = this._statsMap.get(`code_${playerCode}`);
      if (byCode) return byCode;
    }
    const norm = normalizeKey(playerName);
    return this._statsMap.get(norm) || { val: 0, mv: 0, fm: 0, sTeam: '' };
  },

  /**
   * Helper to get list of allowed modules
   */
  getAllowedModules() {
    if (typeof moduliAmmessi !== 'undefined' && Array.isArray(moduliAmmessi) && moduliAmmessi.length > 0) {
      return moduliAmmessi.map(m => `${m[2]}-${m[3]}-${m[4]}`);
    }
    return ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1', '6-3-1'];
  },

  isColSorted(key, currentSortKey) {
    if (currentSortKey === key) return true;
    if (key === 'role' && currentSortKey === 'default') return true;
    if (key === 'reparto' && currentSortKey === 'default') return true;
    return false;
  },

  renderSortIcon(key, currentKey, currentOrder) {
    const isSorted = (currentKey === key) || ((key === 'role' || key === 'reparto') && currentKey === 'default');
    if (isSorted) {
      const order = (currentKey === 'default' && (key === 'role' || key === 'reparto')) ? 'asc' : currentOrder;
      return `<span class="sort-icon sort-active">${order === 'asc' ? '▲' : '▼'}</span>`;
    }
    return `<span class="sort-icon sort-neutral">↕</span>`;
  },

  sortPlayers(players, sortKey, sortOrder) {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...players].sort((a, b) => {
      if (sortKey === 'default') {
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'role') {
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff * order;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'name') {
        const cmp = (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * order;
        return (a.role || 0) - (b.role || 0);
      }

      if (sortKey === 'serieATeam') {
        const cmp = (a.serieATeam || '').localeCompare(b.serieATeam || '', 'it', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'mv') {
        const diff = (a.mv || 0) - (b.mv || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'fm') {
        const diff = (a.fm || 0) - (b.fm || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'contract') {
        const cA = String(a.contract || '');
        const cB = String(b.contract || '');
        const cmp = cA.localeCompare(cB, 'it', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'cost') {
        const diff = (a.cost || 0) - (b.cost || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      return 0;
    });
  },

  sortValorePlayers(players, sortKey, sortOrder) {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...players].sort((a, b) => {
      if (sortKey === 'default') {
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'role') {
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff * order;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'name') {
        const cmp = (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (b.cost || 0) - (a.cost || 0);
      }

      if (sortKey === 'serieATeam') {
        const cmp = (a.serieATeam || '').localeCompare(b.serieATeam || '', 'it', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'cost') {
        const diff = (a.cost || 0) - (b.cost || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'val') {
        const diff = (a.val || 0) - (b.val || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      if (sortKey === 'delta') {
        const diff = (a.delta || 0) - (b.delta || 0);
        if (diff !== 0) return diff * order;
        const roleDiff = (a.role || 0) - (b.role || 0);
        if (roleDiff !== 0) return roleDiff;
        return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
      }

      return 0;
    });
  },

  sortReparti(repList, sortKey, sortOrder) {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...repList].sort((a, b) => {
      if (sortKey === 'default' || sortKey === 'reparto') {
        return ((a.id || 0) - (b.id || 0)) * order;
      }
      if (sortKey === 'cost') {
        return ((a.cost || 0) - (b.cost || 0)) * order;
      }
      if (sortKey === 'val') {
        return ((a.val || 0) - (b.val || 0)) * order;
      }
      if (sortKey === 'delta') {
        const deltaA = (a.val || 0) - (a.cost || 0);
        const deltaB = (b.val || 0) - (b.cost || 0);
        return (deltaA - deltaB) * order;
      }
      return 0;
    });
  },

  handleSortAttuali(key, container) {
    if (this.attualiSortKey === key || (this.attualiSortKey === 'default' && key === 'role')) {
      this.attualiSortOrder = this.attualiSortOrder === 'asc' ? 'desc' : 'asc';
      this.attualiSortKey = 'role';
    } else {
      this.attualiSortKey = key;
      this.attualiSortOrder = (key === 'cost' || key === 'mv' || key === 'fm') ? 'desc' : 'asc';
    }
    this.render(container);
  },

  handleSortValore(key, container) {
    if (this.valoreSortKey === key || (this.valoreSortKey === 'default' && key === 'role')) {
      this.valoreSortOrder = this.valoreSortOrder === 'asc' ? 'desc' : 'asc';
      this.valoreSortKey = 'role';
    } else {
      this.valoreSortKey = key;
      this.valoreSortOrder = (key === 'cost' || key === 'val' || key === 'delta') ? 'desc' : 'asc';
    }
    this.render(container);
  },

  handleSortValoreRep(key, container) {
    if (this.valoreRepSortKey === key || (this.valoreRepSortKey === 'default' && key === 'reparto')) {
      this.valoreRepSortOrder = this.valoreRepSortOrder === 'asc' ? 'desc' : 'asc';
      this.valoreRepSortKey = 'reparto';
    } else {
      this.valoreRepSortKey = key;
      this.valoreRepSortOrder = (key === 'cost' || key === 'val' || key === 'delta') ? 'desc' : 'asc';
    }
    this.render(container);
  },

  async render(container) {
    const hasStorico = typeof fcmModules === 'undefined' || fcmModules.hasStoricoAvanzato();
    let stagioni = [];
    if (hasStorico) {
      stagioni = await fcmDataLoader.loadStagioni().catch(() => []);
    }
    const currentSeasonId = fcmDataLoader.getCurrentSeason();

    // Parse query params if present in URL (e.g. #rose?team=2, #rose?season=10&albo=21)
    const hash = window.location.hash || '';
    let paramTeamRequested = false;

    if (hash.includes('?')) {
      const qStr = hash.substring(hash.indexOf('?'));
      const params = new URLSearchParams(qStr);

      if (hasStorico && params.has('season')) {
        const s = parseInt(params.get('season'), 10);
        if (!isNaN(s) && s > 0) {
          this.selectedSeason = s;
        }
      } else if (!params.has('season')) {
        // Se non specificata la stagione, il default è sempre la stagione attuale
        this.selectedSeason = currentSeasonId;
      }

      if (params.has('albo')) {
        const alboId = parseInt(params.get('albo'), 10);
        if (!isNaN(alboId) && alboId > 0) {
          this.selectedFranchiseId = alboId;
        }
      } else {
        // Se non c'è albo esplicito in query string, resetta selectedFranchiseId
        this.selectedFranchiseId = null;
      }

      if (params.has('team') || params.has('fsq')) {
        const rawTeam = params.get('team') || params.get('fsq');
        const t = parseInt(rawTeam, 10);
        if (!isNaN(t) && t > 0) {
          this.currentTeamId = t;
          this._paramTeamName = null;
          paramTeamRequested = true;
        } else if (rawTeam && rawTeam.trim()) {
          this._paramTeamName = rawTeam.trim().toLowerCase();
          this.currentTeamId = null;
          paramTeamRequested = true;
        }
      }

      if (params.has('teamName')) {
        this._paramTeamName = params.get('teamName').trim().toLowerCase();
        this.currentTeamId = null;
        paramTeamRequested = true;
      }

      if (params.has('tab')) {
        const tab = params.get('tab');
        const validTabs = ['attuali', 'valore', 'top11', 'affari', 'statistiche', 'svincolati', 'bilancio'];
        if (validTabs.includes(tab)) this.currentTab = tab;
      }
    } else {
      this.selectedSeason = currentSeasonId;
    }

    // Default season resolution
    if (!hasStorico) {
      this.selectedSeason = currentSeasonId;
    } else if (!this.selectedSeason || isNaN(this.selectedSeason)) {
      this.selectedSeason = currentSeasonId;
    }

    const isHistorical = hasStorico && (this.selectedSeason !== currentSeasonId);

    // Load confrontations & franchise data
    const confData = await fcmDataLoader.loadConfronti().catch(() => null);
    if (typeof arrAdOFantasquadre === 'undefined') {
      try { await fcmDataLoader.loadScript('js/fcmAlboDOroDati.js'); } catch (e) { }
    }

    // Risoluzione Squadra del Cuore
    const favTeamId = (typeof fcmHomeConfigManager !== 'undefined') ? fcmHomeConfigManager.getFavoriteTeamId() : null;
    let favFranchiseId = null;
    if (favTeamId && confData && confData.teams) {
      const fTeam = confData.teams.find(t => (t.idAttuale === favTeamId || t.currentId === favTeamId));
      if (fTeam) favFranchiseId = fTeam.id;
    }
    if (!paramTeamRequested && !this.selectedFranchiseId && favFranchiseId) {
      this.selectedFranchiseId = favFranchiseId;
    }

    let teamsList = [];
    let currentTeam = null;
    let attuali = [];
    let svincolati = [];
    let infortunati = [];
    let allPlayers = [];
    let budgetData = { remainingCredits: 0, transactions: [] };
    let trophies = [];
    let histData = null;

    if (!isHistorical) {
      // --- STAGIONE ATTUALE (FCM nativo) ---
      const liveTeams = fcmDataLoader.getTeams();
      teamsList = liveTeams.map(t => {
        let fId = t.ID;
        let fName = t.Nome;
        if (confData && confData.teams) {
          const found = confData.teams.find(ft => ft.idAttuale === t.ID || ft.currentId === t.ID || (ft.name && ft.name.toLowerCase() === (t.Nome || '').toLowerCase()));
          if (found) {
            fId = found.id;
            fName = found.name || t.Nome;
          }
        }
        return {
          id: t.ID,
          nome: t.Nome,
          presidente: t.Presidente,
          creditiResidui: t.CreditiResidui,
          franchiseId: fId,
          franchiseName: fName,
          isFav: favTeamId ? (t.ID == favTeamId) : false
        };
      });

      // Risoluzione squadra: priorità al team esplicitamente richiesto
      if (paramTeamRequested) {
        if (this.currentTeamId) {
          currentTeam = teamsList.find(t => t.id === this.currentTeamId);
        }
        if (!currentTeam && this._paramTeamName) {
          currentTeam = teamsList.find(t => (t.nome || '').toLowerCase() === this._paramTeamName || (t.franchiseName || '').toLowerCase() === this._paramTeamName);
        }
      }
      if (!currentTeam && this.selectedFranchiseId) {
        currentTeam = teamsList.find(t => t.franchiseId === this.selectedFranchiseId);
      }
      if (!currentTeam && this._paramTeamName) {
        currentTeam = teamsList.find(t => (t.nome || '').toLowerCase() === this._paramTeamName || (t.franchiseName || '').toLowerCase() === this._paramTeamName);
      }
      if (!currentTeam && this.currentTeamId) {
        currentTeam = teamsList.find(t => t.id === this.currentTeamId);
      }
      if (!currentTeam && favTeamId) {
        currentTeam = teamsList.find(t => t.id === favTeamId);
      }
      if (!currentTeam) {
        currentTeam = teamsList[0] || { id: 1, nome: 'Fantasquadra', presidente: '', creditiResidui: 0, franchiseId: null, franchiseName: '', isFav: false };
      }

      this.currentTeamId = currentTeam.id;
      this.selectedFranchiseId = currentTeam.franchiseId;

      await this.ensureDataLoaded(this.currentTeamId);
      const rosterData = fcmDataLoader.getTeamRoster(this.currentTeamId);
      budgetData = fcmDataLoader.getTeamBudget(this.currentTeamId);

      attuali = rosterData.attuali || [];
      svincolati = rosterData.svincolati || [];
      infortunati = rosterData.infortunati || [];
      allPlayers = rosterData.all || [];

      if (confData && typeof confData.getPalmares === 'function') {
        trophies = confData.getPalmares(this.selectedFranchiseId || this.currentTeamId) || [];
      }
    } else {
      // --- STAGIONE STORICA (da archivio SQLite) ---
      if (!this._historicalDataCache[this.selectedSeason] && typeof fcmSkeleton !== 'undefined') {
        container.innerHTML = fcmSkeleton.table({ cols: 6, rows: 10, withToolbar: true });
      }
      histData = this._historicalDataCache[this.selectedSeason] || await fcmDataLoader.loadHistoricalRoster(this.selectedSeason);
      this._historicalDataCache[this.selectedSeason] = histData;

      if (!histData || !histData.squadre || histData.squadre.length === 0) {
        container.innerHTML = `
          <div class="card text-center" style="padding:40px;">
            <h3 style="margin-bottom:12px;">Archivio Storico • Stagione ${this.selectedSeason}</h3>
            <p style="color:var(--text-muted);">Nessuna rosa trovata per la Stagione ${this.selectedSeason}.</p>
            <div style="margin-top:16px;">
              <button class="btn btn-primary" onclick="roseView.selectedSeason=${currentSeasonId};roseView.render(document.getElementById('appMain'));">
                Torna alla stagione attuale
              </button>
            </div>
          </div>
        `;
        return;
      }

      const rawSquadre = histData.squadre || [];
      teamsList = rawSquadre.map(sq => {
        const isFav = favFranchiseId ? (sq.franchiseId === favFranchiseId) : (favTeamId && sq.id == favTeamId);
        return {
          id: sq.id,
          nome: sq.nome,
          presidente: sq.presidente,
          creditiResidui: sq.creditiResidui || 0,
          franchiseId: sq.franchiseId,
          franchiseName: sq.franchiseName || sq.nome,
          isFav
        };
      });

      if (paramTeamRequested) {
        if (this.currentTeamId) {
          currentTeam = teamsList.find(t => t.id === this.currentTeamId);
        }
        if (!currentTeam && this._paramTeamName) {
          currentTeam = teamsList.find(t => (t.nome || '').toLowerCase() === this._paramTeamName || (t.franchiseName || '').toLowerCase() === this._paramTeamName);
        }
      }
      if (!currentTeam && this.selectedFranchiseId) {
        currentTeam = teamsList.find(t => t.franchiseId === this.selectedFranchiseId);
      }
      if (!currentTeam && this._paramTeamName) {
        currentTeam = teamsList.find(t => (t.nome || '').toLowerCase() === this._paramTeamName || (t.franchiseName || '').toLowerCase() === this._paramTeamName);
      }
      if (!currentTeam && this.currentTeamId) {
        currentTeam = teamsList.find(t => t.id === this.currentTeamId);
      }
      if (!currentTeam && favFranchiseId) {
        currentTeam = teamsList.find(t => t.franchiseId === favFranchiseId);
      }
      if (!currentTeam) {
        currentTeam = teamsList[0];
      }

      this.currentTeamId = currentTeam.id;
      this.selectedFranchiseId = currentTeam.franchiseId;

      const teamCalciatori = (histData.calciatori || []).filter(p => Number(p.teamId) === Number(this.currentTeamId)).map(p => {
        const isSold = (p.venduto === 1 || p.venduto === '1' || p.state === 1);
        const gioInf = parseInt(p.gioInf, 10) || 0;
        const isInf = !isSold && (gioInf > 0 || p.state === 2);
        const state = isSold ? 1 : (isInf ? 2 : 0);

        let contractStr = p.contract;
        if (contractStr === -1 || contractStr === '-1' || contractStr === 'Inf') {
          contractStr = 'Inf';
        } else if (contractStr === -2 || contractStr === '-2' || contractStr === 'Pres') {
          contractStr = 'Pres';
        } else if (contractStr !== undefined && contractStr !== null && contractStr !== '') {
          contractStr = String(contractStr);
        } else {
          contractStr = '-';
        }

        // i rose.json generati con PHP < 8.1 hanno i numeri come stringhe ("1")
        const num = {};
        ['role', 'cost', 'costoCess', 'playerId', 'code', 'height', 'weight', 'val', 'pr', 'goals', 'assist', 'amm', 'esp', 'mv', 'fm']
          .forEach(k => { if (p[k] !== undefined && p[k] !== null && p[k] !== '') num[k] = Number(p[k]); });

        return {
          ...p,
          ...num,
          state,
          contract: contractStr,
          gioInf
        };
      });

      attuali = teamCalciatori.filter(p => p.state === 0);
      svincolati = teamCalciatori.filter(p => p.state === 1);
      infortunati = teamCalciatori.filter(p => p.state === 2);
      allPlayers = teamCalciatori;

      const rawTransactions = (histData.bilancio && histData.bilancio[this.currentTeamId]) || [];
      budgetData = {
        remainingCredits: currentTeam.creditiResidui || 0,
        transactions: rawTransactions
      };

      if (confData && typeof confData.getPalmares === 'function') {
        trophies = confData.getPalmares(this.selectedFranchiseId) || [];
      }
    }

    // Filter roster if global search query is present
    let searchResults = null;
    const qSearch = this.searchQuery.trim().toLowerCase();
    if (qSearch.length >= 2) {
      if (isHistorical && histData) {
        searchResults = (histData.calciatori || []).filter(p => (p.name || '').toLowerCase().includes(qSearch)).map(p => ({
          role: Number(p.role),
          name: p.name,
          playerId: Number(p.playerId),
          serieATeam: p.serieATeam,
          cost: Number(p.cost),
          team: { ID: Number(p.teamId), Nome: p.teamName }
        }));
      } else {
        searchResults = fcmDataLoader.searchPlayers(this.searchQuery);
      }
    }

    // Check if Fantamister module is enabled
    const hasFantamister = typeof fcmModules !== 'undefined' ? fcmModules.hasFantamister() : true;

    // Default modulo validation
    const allowedMods = this.getAllowedModules();
    if (!allowedMods.includes(this.selectedModulo)) {
      this.selectedModulo = allowedMods.includes('3-4-3') ? '3-4-3' : allowedMods[0];
    }

    let html = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Rose Fantasquadre ${isHistorical ? `<span style="font-size:0.82rem;font-weight:700;color:var(--accent-gold);margin-left:8px;">• Stagione ${this.selectedSeason}</span>` : ''}
          </div>
        </div>

        <!-- Global Search Bar -->
        <div class="search-bar-wrapper">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            id="inputSearchPlayers" 
            class="search-input" 
            placeholder="Cerca calciatore in tutte le rose..." 
            value="${this.searchQuery}"
            style="padding-right: 38px;"
          />
          <button 
            type="button" 
            id="btnClearSearchInput" 
            class="search-clear-btn" 
            title="Svuota ricerca"
            aria-label="Svuota ricerca"
            style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:${this.searchQuery.trim().length > 0 ? 'inline-flex' : 'none'};align-items:center;justify-content:center;border-radius:50%;"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Team & Season Selectors Card (hidden if searching) -->
        ${!searchResults ? `
          <div class="rose-selectors-card">
            <!-- Left Side: Fantasquadra selector -->
            <div class="rose-selector-team-wrap">
              <label for="selRoseTeam" class="rose-selector-label">
                Fantasquadra:
              </label>
              <select id="selRoseTeam" class="form-select" style="min-width:200px;font-weight:700;font-size:0.95rem;">
                ${teamsList.map(t => {
      const isSelected = (t.id === this.currentTeamId);
      const isFav = t.isFav;
      let label = `${isFav ? '⭐ ' : ''}${t.nome} (${t.presidente})`;
      if (isHistorical && t.nome !== t.franchiseName) {
        label = `${isFav ? '⭐ ' : ''}${t.franchiseName} [${t.nome}] (${t.presidente})`;
      }
      return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
    }).join('')}
              </select>
            </div>

            <!-- Right Side: Season selector (shown only if hasStorico is true) -->
            ${hasStorico ? `
              <div class="rose-selector-season-wrap">
                <label for="selRoseSeason" class="rose-selector-label">
                  Stagione:
                </label>
                <select id="selRoseSeason" class="form-select" style="min-width:215px;font-weight:700;font-size:0.95rem;">
                  ${stagioni.map(s => `
                    <option value="${s.id}" ${s.id === this.selectedSeason ? 'selected' : ''}>
                      Stagione ${s.id} (${s.anni_stagione}) ${s.id === currentSeasonId ? '(Attuale)' : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <!-- Team Header Summary Card (Crediti sotto il nome & Palmares a destra) -->
          <div class="rose-header-card">
            <!-- Left Side: Logo, Nome Squadra, Presidente & Card Crediti Residui -->
            <div class="rose-header-left">
              <img src="${fcmDataLoader.getTeamLogo(currentTeam.nome || currentTeam.franchiseName || currentTeam.id)}" class="rose-header-team-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${currentTeam.nome}" />
              <div class="rose-header-team-meta">
                <h3 class="rose-header-team-title">
                  ${currentTeam.isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${currentTeam.nome} ${fcmDataLoader.getTeamTrophiesHtml(currentTeam.franchiseName || currentTeam.nome)}
                </h3>
                ${(isHistorical && currentTeam.nome !== currentTeam.franchiseName) ? `
                  <div style="font-size:0.80rem;font-weight:700;color:var(--accent-cyan);margin-top:1px;">
                    🏛️ Franchigia Storica: <strong>${currentTeam.franchiseName}</strong>
                  </div>
                ` : ''}
                <div class="rose-header-team-pres">Presidente: <b>${currentTeam.presidente}</b></div>
                
                <!-- Card dei crediti residui SOTTO il nome della squadra -->
                <div class="rose-credits-card">
                  <span class="rose-credits-label">Crediti Residui:</span>
                  <span class="rose-credits-val">${currentTeam.creditiResidui}</span>
                </div>
              </div>
            </div>

            <!-- Right Side: Palmares con i trofei vinti (stile #confronti) -->
            <div class="rose-header-palmares">
              <div class="rose-palmares-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2.2">
                  <circle cx="12" cy="8" r="7"></circle>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
                <span>Palmarès Ufficiale</span>
              </div>
              <div class="rose-palmares-badges">
                ${trophies.length > 0 ? trophies.map(tr => `
                  <div class="rose-trophy-badge" title="${tr.count}x ${tr.label} (${tr.years.join(', ')})">
                    <img src="img/${tr.icon}" onerror="this.onerror=null;this.src='img/ico-scudetto.gif';" alt="${tr.label}" class="rose-trophy-icon" />
                    <div class="rose-trophy-info">
                      <div>
                        <span class="rose-trophy-count">${tr.count}x</span>
                        <span class="rose-trophy-label">${tr.label}</span>
                      </div>
                      <span class="rose-trophy-years">${tr.years.join(', ')}</span>
                    </div>
                  </div>
                `).join('') : `
                  <div class="rose-palmares-empty">Nessun titolo ufficiale in bacheca al momento.</div>
                `}
              </div>
            </div>
          </div>

          <!-- Section Sub-Tabs (A tutta larghezza, 4 sopra e 3 sotto, tutti stessa dimensione) -->
          <div class="pill-tabs rose-sub-tabs" id="roseSubTabs">
            <button class="pill-btn ${this.currentTab === 'attuali' ? 'active' : ''}" data-tab="attuali" title="Rosa">
              <span class="tab-icon">⚽</span>
              <span class="desktop-only">Rosa</span>
              <span class="mobile-only">Rosa</span>
              <span class="tab-count">(${attuali.length})</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'valore' ? 'active' : ''}" data-tab="valore" title="Valore Rosa & Rendimento Investimenti">
              <span class="tab-icon">📈</span>
              <span class="desktop-only">Valore Rosa</span>
              <span class="mobile-only">Valore</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'top11' ? 'active' : ''}" data-tab="top11" title="Top / Flop 11 per Fantamedia">
              <span class="tab-icon">⭐</span>
              <span class="desktop-only">Top/Flop 11</span>
              <span class="mobile-only">Top/Flop</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'affari' ? 'active' : ''}" data-tab="affari" title="Migliore / Peggiore Affare">
              <span class="tab-icon">💎</span>
              <span class="desktop-only">Miglior/Peggior Affare</span>
              <span class="mobile-only">Affari</span>
            </button>
            ${hasFantamister ? `
              <button class="pill-btn ${this.currentTab === 'statistiche' ? 'active' : ''}" data-tab="statistiche" title="Statistiche FantaMister">
                <span class="tab-icon">📊</span>
                <span class="desktop-only">Statistiche</span>
                <span class="mobile-only">Stats</span>
              </button>
            ` : ''}
            <button class="pill-btn ${this.currentTab === 'svincolati' ? 'active' : ''}" data-tab="svincolati" title="Svincolati & Infortunati">
              <span class="tab-icon">📋</span>
              <span class="desktop-only">Svincolati &amp; Infortunati</span>
              <span class="mobile-only">Svincolati</span>
              <span class="tab-count">(${svincolati.length + infortunati.length})</span>
            </button>
            <button class="pill-btn ${this.currentTab === 'bilancio' ? 'active' : ''}" data-tab="bilancio" title="Bilancio & Movimenti">
              <span class="tab-icon">💰</span>
              <span class="desktop-only">Bilancio &amp; Movimenti</span>
              <span class="mobile-only">Bilancio</span>
              <span class="tab-count">(${budgetData.transactions.length})</span>
            </button>
          </div>
        ` : ''}

        <!-- Content: Search Results OR Selected Tab -->
        ${searchResults ? `
          <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;color:var(--accent-cyan);">Risultati ricerca: ${searchResults.length} giocatori trovati</span>
            <button id="btnClearSearch" class="pill-btn active" style="padding:4px 12px;font-size:0.75rem;">Azzera ricerca</button>
          </div>
          <div class="table-responsive rose-table-responsive">
            <table class="modern-table rose-table">
              <thead>
                <tr>
                  <th class="rose-col-role">R</th>
                  <th class="rose-col-player">Calciatore</th>
                  <th class="rose-col-club desktop-only">Squadra A</th>
                  <th>Fantasquadra</th>
                  <th class="text-right rose-col-cost">Costo Acq.</th>
                </tr>
              </thead>
              <tbody>
                ${searchResults.map(p => `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p)}
                    ${this.renderClubCell(p)}
                    <td class="rose-search-team-cell">
                      <a href="#rose?team=${p.team.ID}" class="rose-search-team-link" data-team-id="${p.team.ID}" title="Vai alla rosa di ${p.team.Nome}">
                        <img src="${fcmDataLoader.getTeamLogo(p.team.Nome || p.team.ID)}" class="rose-search-team-shirt" alt="${p.team.Nome}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                        ${(favTeamId && p.team.ID == favTeamId) ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span>' : ''}
                        <span class="rose-search-team-name">${p.team.Nome}</span>
                      </a>
                    </td>
                    <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : this.currentTab === 'attuali' ? (() => {
        const enrichedAttuali = (attuali || []).map(p => {
          const st = this.getPlayerStats(p.name, p.playerId, p);
          return {
            ...p,
            mv: st.mv || 0,
            fm: st.fm || 0,
            val: st.val || 0,
            serieATeam: p.serieATeam || st.sTeam || ''
          };
        });
        const sortedAttuali = this.sortPlayers(enrichedAttuali, this.attualiSortKey, this.attualiSortOrder);
        return `
          <!-- TAB 1: Rosa -->
          <div class="table-responsive rose-table-responsive">
            <table class="modern-table rose-table">
              <thead>
                <tr>
                  <th class="rose-col-role sortable ${this.isColSorted('role', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="role" title="Ordina per Ruolo (P D C A)">
                    R ${this.renderSortIcon('role', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="rose-col-player sortable ${this.isColSorted('name', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="name" title="Ordina per Calciatore (Alfabetico)">
                    Calciatore ${this.renderSortIcon('name', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="rose-col-club desktop-only sortable ${this.isColSorted('serieATeam', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="serieATeam" title="Ordina per Squadra di Serie A">
                    Squadra A ${this.renderSortIcon('serieATeam', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="text-center rose-col-stat sortable ${this.isColSorted('mv', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="mv" title="Ordina per Media Voto">
                    <span class="desktop-only">Media Voto</span>
                    <span class="mobile-only">MV</span>
                    ${this.renderSortIcon('mv', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="text-center rose-col-stat sortable ${this.isColSorted('fm', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="fm" title="Ordina per FantaMedia">
                    <span class="desktop-only">FantaMedia</span>
                    <span class="mobile-only">FM</span>
                    ${this.renderSortIcon('fm', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="text-center rose-col-contract desktop-only sortable ${this.isColSorted('contract', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="contract" title="Ordina per Durata Contratto">
                    Contratto ${this.renderSortIcon('contract', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                  <th class="text-right rose-col-cost sortable ${this.isColSorted('cost', this.attualiSortKey) ? 'is-sorted' : ''}" data-sort="cost" title="Ordina per Costo di Acquisto">
                    <span class="desktop-only">Costo Acq.</span>
                    <span class="mobile-only">💰 (A.)</span>
                    ${this.renderSortIcon('cost', this.attualiSortKey, this.attualiSortOrder)}
                  </th>
                </tr>
              </thead>
              <tbody>
                ${sortedAttuali.length > 0 ? sortedAttuali.map(p => {
          const mvStr = p.mv > 0 ? p.mv.toFixed(2) : '-';
          const fmStr = p.fm > 0 ? p.fm.toFixed(2) : '-';
          const pContract = p.contract || '-';
          return `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p)}
                    ${this.renderClubCell(p)}
                    <td class="text-center font-bold rose-cell-stat">${mvStr}</td>
                    <td class="text-center font-bold rose-cell-stat" style="color:var(--accent-cyan);">${fmStr}</td>
                    <td class="text-center rose-cell-contract desktop-only">${pContract}</td>
                    <td class="text-right font-bold rose-cell-cost">${p.cost}<span class="mobile-only rose-cost-contract-inline"> (${pContract})</span></td>
                  </tr>
                  `;
        }).join('') : `
                  <tr><td colspan="7" class="text-center" style="padding:24px;color:var(--text-muted);">Nessun giocatore in rosa</td></tr>
                `}
              </tbody>
            </table>
          </div>
          `;
      })() : this.currentTab === 'valore' ? `
          <!-- TAB: Valore Rosa (Calciatori effettivi in rosa, inclusi infortunati ed esclusi sostituti lista infortunati) -->
          ${this.renderValoreRosa(attuali, infortunati)}
        ` : this.currentTab === 'top11' ? `
          <!-- TAB: Top 11 -->
          ${this.renderTop11(attuali)}
        ` : this.currentTab === 'affari' ? `
          <!-- TAB: Miglior / Peggior Affare -->
          ${this.renderAffari(allPlayers)}
        ` : this.currentTab === 'statistiche' ? `
          <!-- TAB: Statistiche FantaMister (sq x.htm) -->
          <div id="roseStatsContainer" style="padding:4px 0;">
            ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.table({ cols: 4, rows: 6, withToolbar: false }) : '<div style="text-align:center;padding:32px;color:var(--text-muted);">Caricamento statistiche di squadra...</div>'}
          </div>
        ` : this.currentTab === 'svincolati' ? `
          <!-- TAB: Svincolati & Infortunati -->
          <div style="display:flex;flex-direction:column;gap:24px;">
            <!-- Svincolati Section -->
            <div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span class="badge badge-warning">Svincolati</span>
                <span>Calciatori Ceduti / Svincolati (${svincolati.length})</span>
              </div>
              <div class="table-responsive rose-table-responsive">
                <table class="modern-table rose-table">
                  <thead>
                    <tr>
                      <th class="rose-col-role">R</th>
                      <th class="rose-col-player">Calciatore</th>
                      <th class="rose-col-club desktop-only">Squadra A</th>
                      <th class="text-right rose-col-cost">
                        <span class="desktop-only">Costo Acq.</span>
                        <span class="mobile-only">Costo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${svincolati.length > 0 ? svincolati.map(p => `
                      <tr>
                        <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                        ${this.renderPlayerCell(p)}
                        ${this.renderClubCell(p)}
                        <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                      </tr>
                    `).join('') : `
                      <tr><td colspan="4" class="text-center" style="padding:16px;color:var(--text-muted);">Nessun calciatore svincolato</td></tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Infortunati Section -->
            <div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span class="badge badge-danger">Infortunati</span>
                <span>Tagli Temporanei per Infortunio (${infortunati.length})</span>
              </div>
              <div class="table-responsive rose-table-responsive">
                <table class="modern-table rose-table">
                  <thead>
                    <tr>
                      <th class="rose-col-role">R</th>
                      <th class="rose-col-player">Calciatore</th>
                      <th class="rose-col-club desktop-only">Squadra A</th>
                      <th class="text-center rose-col-inf">
                        <span class="desktop-only">Dalla Giornata</span>
                        <span class="mobile-only">Dalla G.</span>
                      </th>
                      <th class="text-right rose-col-cost">
                        <span class="desktop-only">Costo Acq.</span>
                        <span class="mobile-only">Costo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${infortunati.length > 0 ? infortunati.map(p => `
                      <tr>
                        <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                        ${this.renderPlayerCell(p)}
                        ${this.renderClubCell(p)}
                        <td class="text-center font-bold rose-cell-inf" style="color:var(--accent-rose);">${p.gioInf > 0 ? (p.gioInf < 100 ? 'G ' + p.gioInf : p.gioInf) : '-'}</td>
                        <td class="text-right font-bold rose-cell-cost">${p.cost}</td>
                      </tr>
                    `).join('') : `
                      <tr><td colspan="5" class="text-center" style="padding:16px;color:var(--text-muted);">Nessun calciatore in lista infortunati</td></tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : `
          <!-- TAB: Bilancio Squadra -->
          <div>
            <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
              <span style="font-size:0.9rem;color:var(--text-secondary);">Registro storico movimenti finanziari e crediti residui.</span>
              <div style="font-size:0.95rem;font-weight:800;">
                Saldo Attuale: <span style="color:var(--accent-gold);">${budgetData.remainingCredits} Crediti</span>
              </div>
            </div>

            <div class="table-responsive rose-table-responsive">
              <table class="modern-table rose-bilancio-table">
                <thead>
                  <tr>
                    <th class="rose-bilancio-col-date">Data</th>
                    <th class="rose-bilancio-col-desc">Descrizione Operazione</th>
                    <th class="rose-bilancio-col-val text-right">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  ${budgetData.transactions.length > 0 ? budgetData.transactions.map(b => {
        const dateParts = (b.date || '').split(' ');
        const dateStr = dateParts[0] || b.date;
        const timeStr = dateParts[1] ? dateParts[1].substring(0, 5) : '';
        return `
                      <tr>
                        <td class="rose-bilancio-cell-date">
                          <div>${dateStr}</div>
                          ${timeStr ? `<div style="font-size:0.68rem;opacity:0.75;">${timeStr}</div>` : ''}
                        </td>
                        <td class="rose-bilancio-cell-desc">${b.description}</td>
                        <td class="rose-bilancio-cell-val text-right" style="color:${b.isIncome ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
                          ${b.isIncome ? '+' : ''}${b.value}
                        </td>
                      </tr>
                    `;
      }).join('') : `
                    <tr><td colspan="3" class="text-center" style="padding:24px;color:var(--text-muted);">Nessun movimento registrato a bilancio</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `}

      </div>
    `;

    container.innerHTML = html;

    // Post-render asynchronous loader for Statistiche tab
    if (!searchResults && this.currentTab === 'statistiche') {
      this.loadFantamisterReport(currentTeam.id, container, isHistorical, this.selectedSeason, currentTeam, allPlayers);
    }

    // Attach team selector dropdown change
    const teamSelect = container.querySelector('#selRoseTeam');
    if (teamSelect) {
      teamSelect.addEventListener('change', (e) => {
        const newTeamId = parseInt(e.target.value, 10);
        this.currentTeamId = newTeamId;
        const matched = teamsList.find(t => t.id === newTeamId);
        if (matched) this.selectedFranchiseId = matched.franchiseId;
        this.searchQuery = '';
        const urlHash = isHistorical
          ? `#rose?season=${this.selectedSeason}&albo=${this.selectedFranchiseId}`
          : `#rose?team=${this.currentTeamId}&albo=${this.selectedFranchiseId}`;
        try { history.replaceState(null, '', urlHash); } catch (err) { }
        this.render(container);
      });
    }

    // Attach season selector dropdown change (if present)
    const seasonSelect = container.querySelector('#selRoseSeason');
    if (seasonSelect) {
      seasonSelect.addEventListener('change', (e) => {
        const newSeason = parseInt(e.target.value, 10);
        this.selectedSeason = newSeason;
        this.searchQuery = '';
        const urlHash = (this.selectedSeason === currentSeasonId)
          ? `#rose?albo=${this.selectedFranchiseId}`
          : `#rose?season=${this.selectedSeason}&albo=${this.selectedFranchiseId}`;
        try { history.replaceState(null, '', urlHash); } catch (err) { }
        this.render(container);
      });
    }

    // Attach sub-tab buttons
    const subTabBtns = container.querySelectorAll('#roseSubTabs button');
    subTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.getAttribute('data-tab');
        this.render(container);
      });
    });

    // Attach sortable headers for Tab 1 (Attuali)
    const attualiSortHeaders = container.querySelectorAll('.rose-table th.sortable[data-sort]');
    attualiSortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (key) {
          this.handleSortAttuali(key, container);
        }
      });
    });

    // Attach sortable headers for Tab 2 (Valore - Calciatori)
    const valoreSortHeaders = container.querySelectorAll('.rose-table th.sortable[data-sort-valore]');
    valoreSortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-valore');
        if (key) {
          this.handleSortValore(key, container);
        }
      });
    });

    // Attach sortable headers for Tab 2 (Valore - Reparto)
    const valoreRepSortHeaders = container.querySelectorAll('th.sortable[data-sort-rep]');
    valoreRepSortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-rep');
        if (key) {
          this.handleSortValoreRep(key, container);
        }
      });
    });

    // Attach Top 11 modulo dropdown change
    const top11ModSelect = container.querySelector('#selRoseTop11Modulo');
    if (top11ModSelect) {
      top11ModSelect.addEventListener('change', (e) => {
        this.selectedTopModulo = e.target.value;
        this.selectedModulo = e.target.value;
        this.render(container);
      });
    }

    // Attach Flop 11 modulo dropdown change
    const flop11ModSelect = container.querySelector('#selRoseFlop11Modulo');
    if (flop11ModSelect) {
      flop11ModSelect.addEventListener('change', (e) => {
        this.selectedFlopModulo = e.target.value;
        this.render(container);
      });
    }

    // Attach live search
    const searchInput = container.querySelector('#inputSearchPlayers');
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        const cursorPos = e.target.selectionStart;
        this.searchQuery = e.target.value;
        await this.render(container);
        const refocused = container.querySelector('#inputSearchPlayers') || document.getElementById('inputSearchPlayers');
        if (refocused) {
          refocused.focus();
          const pos = typeof cursorPos === 'number' ? cursorPos : refocused.value.length;
          refocused.setSelectionRange(pos, pos);
        }
      });
    }

    // Attach clear search buttons
    const clearBtn = container.querySelector('#btnClearSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.render(container);
      });
    }

    const clearInputBtn = container.querySelector('#btnClearSearchInput');
    if (clearInputBtn) {
      clearInputBtn.addEventListener('click', async () => {
        this.searchQuery = '';
        await this.render(container);
        const refocused = container.querySelector('#inputSearchPlayers') || document.getElementById('inputSearchPlayers');
        if (refocused) refocused.focus();
      });
    }

    // Attach search result fantasy team links (clear search & open selected team)
    const searchTeamLinks = container.querySelectorAll('.rose-search-team-link');
    searchTeamLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tId = parseInt(link.getAttribute('data-team-id'), 10);
        if (!isNaN(tId) && tId > 0) {
          this.currentTeamId = tId;
          const matched = teamsList.find(t => t.id === tId);
          if (matched) this.selectedFranchiseId = matched.franchiseId;
        }
        this.searchQuery = '';
        const urlHash = isHistorical
          ? `#rose?season=${this.selectedSeason}&albo=${this.selectedFranchiseId}`
          : `#rose?team=${this.currentTeamId}&albo=${this.selectedFranchiseId}`;
        try { history.replaceState(null, '', urlHash); } catch (err) { }
        this.render(container);
      });
    });
  },

  /**
   * Render player cell with:
   * - Photo enlarged
   * - Name enlarged
   * - Maglia della squadra di Serie A a fianco al nome (desktop & mobile)
   * - Logo Serie A (da img/sq/logo) al posto della maglietta su mobile sotto il nome
   */
  renderPlayerCell(p, extraSubHtml = '') {
    const isSerieA = fcmDataLoader.isSerieATeam(p.serieATeam);
    const playerId = isSerieA ? (p.playerId || fcmDataLoader.getSerieAPlayerId(p.name)) : null;
    const pCode = p.code || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerCode ? fcmDataLoader.getPlayerCode(p.name) : null);
    const hasLink = (isSerieA && !!playerId) || !!pCode;
    const linkHref = pCode ? `#schede_giocatori?cod=${pCode}` : (playerId ? `#schede_giocatori?id=${playerId}` : null);

    const photoSrc = p.code ? `img/foto/${p.code}.jpg` : fcmDataLoader.getPlayerPhoto(p.name);
    const photoHtml = `<img src="${photoSrc}" class="roster-player-photo" alt="${p.name}" width="38" height="38" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />`;
    const photoBlock = hasLink
      ? `<a href="${linkHref}" class="rose-player-photo-link" title="Apri scheda di ${p.name}">${photoHtml}</a>`
      : photoHtml;

    const { surname } = fcmDataLoader.splitPlayerName(p.name);
    const nameText = hasLink
      ? `<a href="${linkHref}" class="rose-player-link" title="Apri scheda di ${p.name}">
          <span class="desktop-only">${p.name}</span>
          <span class="mobile-only">${surname}</span>
        </a>`
      : `<span>
          <span class="desktop-only">${p.name}</span>
          <span class="mobile-only">${surname}</span>
        </span>`;

    // Su mobile: Logo societario da img/sq/logo al posto della maglietta sotto il nome
    const mobileClubRow = p.serieATeam ? `
      <div class="rose-player-club mobile-only">
        <span>${p.serieATeam}</span>
      </div>
    ` : '';

    const firstClub = p.serieATeam ? String(p.serieATeam).split(/[,/]/)[0].trim() : '';
    const mobileLogoInline = firstClub
      ? `<img src="${fcmDataLoader.getSerieALogo(firstClub)}" class="rose-logo-inline" onerror="this.style.display='none';" alt="" />`
      : '';

    // Maglia a fianco al nome
    const shirtInline = firstClub
      ? `<img src="${fcmDataLoader.getSerieAShirt(firstClub)}" class="rose-shirt-inline" onerror="this.style.display='none';" alt="" />`
      : '';

    return `
      <td class="rose-player-cell">
        <div class="rose-player-flex">
          ${photoBlock}
          ${shirtInline}
          ${mobileLogoInline}
          <div class="rose-player-info">
            <div class="rose-player-name">
              ${nameText}
            </div>
            ${mobileClubRow}
            ${extraSubHtml}
          </div>
        </div>
      </td>
    `;
  },

  /**
   * Render dedicated Serie A column for Desktop:
   * Logo societario in .png da img/sq/logo + nome squadra di Serie A
   */
  renderClubCell(p) {
    if (!p.serieATeam) {
      return `<td class="rose-cell-club desktop-only"><span style="color:var(--text-muted);">-</span></td>`;
    }
    const teams = String(p.serieATeam).split(/[,/]/).map(s => s.trim()).filter(Boolean);
    if (teams.length <= 1) {
      const t = teams[0] || p.serieATeam;
      return `
        <td class="rose-cell-club desktop-only">
          <div class="rose-club-badge">
            <img src="${fcmDataLoader.getSerieALogo(t)}" class="rose-club-logo-desktop" onerror="this.onerror=null; this.src='img/sq/undefined.svg';" alt="${t}" />
            <span>${t}</span>
          </div>
        </td>
      `;
    }
    return `
      <td class="rose-cell-club desktop-only">
        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
          ${teams.map(t => `
            <span style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.06);border:1px solid var(--border-subtle);padding:2px 6px;border-radius:4px;font-size:0.75rem;">
              <img src="${fcmDataLoader.getSerieALogo(t)}" style="width:13px;height:13px;object-fit:contain;" onerror="this.onerror=null; this.src='img/sq/undefined.svg';" alt="${t}" />
              <span>${t}</span>
            </span>
          `).join('')}
        </div>
      </td>
    `;
  },

  /**
   * TAB 2: Valore Rosa
   * Confronto tra Spesa Totale e Valore Attuale (Quotazioni) per ciascun reparto
   * Mostra investimenti azzeccati (valore attuale > spesa) vs sproporzionati (spesa sproporzionata)
   * Include i giocatori effettivi della rosa (inclusi quelli in lista infortunati, esclusi i sostituti temporanei presi con la lista infortunati).
   */
  renderValoreRosa(players, infortunati = []) {
    const repartiDef = [
      { id: 1, name: 'P', longName: 'Portieri', class: 'role-p' },
      { id: 2, name: 'D', longName: 'Difensori', class: 'role-d' },
      { id: 3, name: 'C', longName: 'Centrocampisti', class: 'role-c' },
      { id: 4, name: 'A', longName: 'Attaccanti', class: 'role-a' }
    ];

    const repStats = {
      1: { id: 1, name: 'P', longName: 'Portieri', class: 'role-p', count: 0, cost: 0, val: 0, players: [] },
      2: { id: 2, name: 'D', longName: 'Difensori', class: 'role-d', count: 0, cost: 0, val: 0, players: [] },
      3: { id: 3, name: 'C', longName: 'Centrocampisti', class: 'role-c', count: 0, cost: 0, val: 0, players: [] },
      4: { id: 4, name: 'A', longName: 'Attaccanti', class: 'role-a', count: 0, cost: 0, val: 0, players: [] }
    };

    const isInfSubstitute = (p) => p && (p.contract === 'Inf' || p.contract === -1 || p.contract === '-1');
    const sostitutiInf = (players || []).filter(p => p && p.state === 0 && isInfSubstitute(p));
    const regularAttuali = (players || []).filter(p => p && p.state === 0 && !isInfSubstitute(p));
    const infortunatiRosa = (infortunati || []).filter(p => p && p.state === 2);

    const activePlayers = [...regularAttuali, ...infortunatiRosa];

    activePlayers.forEach(p => {
      const st = this.getPlayerStats(p.name, p.playerId, p);
      const val = st.val || 0;
      const r = p.role || 1;
      if (!repStats[r]) repStats[r] = { id: r, name: '?', longName: '?', class: 'role-p', count: 0, cost: 0, val: 0, players: [] };

      repStats[r].count++;
      repStats[r].cost += (p.cost || 0);
      repStats[r].val += val;
      repStats[r].players.push({
        ...p,
        currentVal: val,
        delta: val - (p.cost || 0)
      });
    });

    let totCount = 0;
    let totCost = 0;
    let totVal = 0;
    for (let r = 1; r <= 4; r++) {
      totCount += repStats[r].count;
      totCost += repStats[r].cost;
      totVal += repStats[r].val;
    }
    const totDelta = totVal - totCost;
    const totPct = totCost > 0 ? ((totVal - totCost) / totCost * 100).toFixed(1) : (totVal > 0 ? '+100' : '0');

    const hasInfNote = infortunatiRosa.length > 0 || sostitutiInf.length > 0;
    const infNames = infortunatiRosa.map(p => fcmDataLoader.splitPlayerName(p.name).surname).join(', ');
    const sostNames = sostitutiInf.map(p => fcmDataLoader.splitPlayerName(p.name).surname).join(', ');

    // Sort Reparti
    const repList = [repStats[1], repStats[2], repStats[3], repStats[4]];
    const sortedReparti = this.sortReparti(repList, this.valoreRepSortKey, this.valoreRepSortOrder);

    // Enrich and Sort activePlayers (Default: per ruolo P D C A e alfabetico)
    const enrichedValore = activePlayers.map(p => {
      const st = this.getPlayerStats(p.name, p.playerId, p);
      const val = st.val || 0;
      const cost = p.cost || 0;
      const delta = val - cost;
      return {
        ...p,
        currentVal: val,
        val,
        cost,
        delta,
        serieATeam: p.serieATeam || st.sTeam || ''
      };
    });
    const sortedValore = this.sortValorePlayers(enrichedValore, this.valoreSortKey, this.valoreSortOrder);

    return `
      <div>
        <!-- KPI Summary Cards -->
        <div class="rose-valore-kpis">
          <div class="rose-valore-kpi-card">
            <div class="rose-valore-kpi-label">
              <span class="desktop-only">Spesa Totale Rosa Effettiva</span>
              <span class="mobile-only">Spesa Rosa</span>
            </div>
            <div class="rose-valore-kpi-val" style="color:var(--text-primary);">${totCost} <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">crediti</span></div>
          </div>
          <div class="rose-valore-kpi-card">
            <div class="rose-valore-kpi-label">
              <span class="desktop-only">Valore Attuale Rosa</span>
              <span class="mobile-only">Valore Rosa</span>
            </div>
            <div class="rose-valore-kpi-val" style="color:var(--accent-gold);">${totVal} <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">crediti</span></div>
          </div>
          <div class="rose-valore-kpi-card">
            <div class="rose-valore-kpi-label">
              <span class="desktop-only">Bilancio Plus/Minusvalenze</span>
              <span class="mobile-only">Bilancio (+/-)</span>
            </div>
            <div class="rose-valore-kpi-val" style="color:${totDelta >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
              ${totDelta >= 0 ? '+' : ''}${totDelta} <span style="font-size:0.85rem;font-weight:700;">(${totDelta >= 0 ? '+' : ''}${totPct}%)</span>
            </div>
          </div>
          <div class="rose-valore-kpi-card">
            <div class="rose-valore-kpi-label">
              <span class="desktop-only">Verdetto Investimenti</span>
              <span class="mobile-only">Verdetto</span>
            </div>
            <div class="rose-valore-kpi-val" style="font-size:1.10rem;color:${totDelta >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
              ${totDelta > 0 ? '🌟 Rosa Rivalutata' : (totDelta < 0 ? '⚠️ Spesa Sproporzionata' : '⚖️ In Perfetta Parità')}
            </div>
          </div>
        </div>

        ${hasInfNote ? `
          <div class="rose-valore-inf-note">
            <span>ℹ️ Il calcolo considera la <b>rosa effettiva</b>: ${infortunatiRosa.length > 0 ? `include i titolari in Lista Infortunati (<b>${infNames}</b>)` : ''}${infortunatiRosa.length > 0 && sostitutiInf.length > 0 ? ' ed ' : ''}${sostitutiInf.length > 0 ? `esclude i sostituti in prestito per infortunio (<b>${sostNames}</b>)` : ''}.</span>
          </div>
        ` : ''}

        <!-- Tabella Sintetica per Reparto -->
        <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span class="desktop-only">Rendimento Finanziario per Reparto</span>
          <span class="mobile-only">Rendimento Reparti</span>
          <span style="font-size:0.75rem;font-weight:600;color:var(--text-muted);">(${totCount} calciatori effettivi)</span>
        </div>

        <div class="table-responsive rose-table-responsive" style="margin-bottom:24px;">
          <table class="modern-table">
            <thead>
              <tr>
                <th class="sortable ${this.isColSorted('reparto', this.valoreRepSortKey) ? 'is-sorted' : ''}" data-sort-rep="reparto" title="Ordina per Reparto (P D C A)">
                  <span class="desktop-only">Reparto</span>
                  <span class="mobile-only">Rep.</span>
                  ${this.renderSortIcon('reparto', this.valoreRepSortKey, this.valoreRepSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('cost', this.valoreRepSortKey) ? 'is-sorted' : ''}" data-sort-rep="cost" title="Ordina per Spesa Asta">
                  <span class="desktop-only">Spesa Asta</span>
                  <span class="mobile-only">Spesa</span>
                  ${this.renderSortIcon('cost', this.valoreRepSortKey, this.valoreRepSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('val', this.valoreRepSortKey) ? 'is-sorted' : ''}" data-sort-rep="val" title="Ordina per Valore Attuale">
                  <span class="desktop-only">Valore Attuale</span>
                  <span class="mobile-only">Valore</span>
                  ${this.renderSortIcon('val', this.valoreRepSortKey, this.valoreRepSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('delta', this.valoreRepSortKey) ? 'is-sorted' : ''}" data-sort-rep="delta" title="Ordina per Differenza">
                  <span class="desktop-only">Differenza</span>
                  <span class="mobile-only">Diff.</span>
                  ${this.renderSortIcon('delta', this.valoreRepSortKey, this.valoreRepSortOrder)}
                </th>
              </tr>
            </thead>
            <tbody>
              ${sortedReparti.map(rep => {
      const delta = rep.val - rep.cost;
      const isPositive = delta > 0;
      const isZero = delta === 0;
      const pct = rep.cost > 0 ? ((rep.val - rep.cost) / rep.cost * 100).toFixed(1) : (rep.val > 0 ? '+100' : '0');
      return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;font-weight:700;">
                        <span class="role-badge ${rep.class}">${rep.name}</span>
                        <span class="desktop-only">${rep.longName}</span>
                      </div>
                    </td>
                    <td class="text-right font-bold">${rep.cost}</td>
                    <td class="text-right font-bold" style="color:var(--accent-gold);">${rep.val}</td>
                    <td class="text-right font-bold" style="color:${isPositive ? 'var(--accent-emerald)' : (isZero ? 'var(--text-secondary)' : 'var(--accent-rose)')};">
                      ${delta >= 0 ? '+' : ''}${delta} <span style="font-size:0.75rem;opacity:0.85;">(${delta >= 0 ? '+' : ''}${pct}%)</span>
                    </td>
                  </tr>
                `;
    }).join('')}
              <tr style="background:var(--bg-surface-elevated);font-weight:800;border-top:2px solid var(--border-subtle);">
                <td>TOTALE</td>
                <td class="text-right">${totCost}</td>
                <td class="text-right" style="color:var(--accent-gold);">${totVal}</td>
                <td class="text-right" style="color:${totDelta >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
                  ${totDelta >= 0 ? '+' : ''}${totDelta} (${totDelta >= 0 ? '+' : ''}${totPct}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Dettaglio Singoli Calciatori in Rosa -->
        <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span class="desktop-only">Dettaglio Calciatori Rosa Effettiva</span>
          <span class="mobile-only">Dettaglio Calciatori</span>
        </div>

        <div class="table-responsive rose-table-responsive">
          <table class="modern-table rose-table">
            <thead>
              <tr>
                <th class="rose-col-role sortable ${this.isColSorted('role', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="role" title="Ordina per Ruolo (P D C A)">
                  R ${this.renderSortIcon('role', this.valoreSortKey, this.valoreSortOrder)}
                </th>
                <th class="rose-col-player sortable ${this.isColSorted('name', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="name" title="Ordina per Calciatore (Alfabetico)">
                  <span class="desktop-only">Calciatore</span>
                  <span class="mobile-only">Calc.</span>
                  ${this.renderSortIcon('name', this.valoreSortKey, this.valoreSortOrder)}
                </th>
                <th class="rose-col-club desktop-only sortable ${this.isColSorted('serieATeam', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="serieATeam" title="Ordina per Squadra di Serie A">
                  Squadra A ${this.renderSortIcon('serieATeam', this.valoreSortKey, this.valoreSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('cost', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="cost" title="Ordina per Costo di Acquisto">
                  <span class="desktop-only">Acquisto</span>
                  <span class="mobile-only">Acq.</span>
                  ${this.renderSortIcon('cost', this.valoreSortKey, this.valoreSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('val', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="val" title="Ordina per Quotazione Attuale">
                  <span class="desktop-only">Quotazione</span>
                  <span class="mobile-only">Quot.</span>
                  ${this.renderSortIcon('val', this.valoreSortKey, this.valoreSortOrder)}
                </th>
                <th class="text-right sortable ${this.isColSorted('delta', this.valoreSortKey) ? 'is-sorted' : ''}" data-sort-valore="delta" title="Ordina per Bilancio (Plus/Minusvalenza)">
                  <span class="desktop-only">Bilancio</span>
                  <span class="mobile-only">Bil.</span>
                  ${this.renderSortIcon('delta', this.valoreSortKey, this.valoreSortOrder)}
                </th>
              </tr>
            </thead>
            <tbody>
              ${sortedValore.map(p => {
      const cost = p.cost || 0;
      const val = p.val || 0;
      const delta = p.delta || 0;
      const infSubHtml = p.state === 2
        ? `<div class="rose-player-subnote">In Lista Infortunati</div>`
        : '';
      return `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p, infSubHtml)}
                    ${this.renderClubCell(p)}
                    <td class="text-right font-bold">${cost}</td>
                    <td class="text-right font-bold" style="color:var(--accent-gold);">${val}</td>
                    <td class="text-right font-bold" style="color:${delta > 0 ? 'var(--accent-emerald)' : (delta === 0 ? 'var(--text-secondary)' : 'var(--accent-rose)')};">
                      ${delta >= 0 ? '+' : ''}${delta}
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * TAB 3: Top / Flop 11
   * Campetti tattici con i migliori 11 (TOP) e i peggiori 11 (FLOP) per fantamedia
   * Due campetti affiancati su desktop, uno dopo l'altro su mobile
   * Entrambi con modulo tattico selezionabile indipendentemente
   */
  renderTop11(attuali) {
    const allowedMods = this.getAllowedModules();
    const currentTopMod = this.selectedTopModulo || this.selectedModulo || '3-4-3';
    const currentFlopMod = this.selectedFlopModulo || '3-4-3';

    const topModParts = currentTopMod.split('-').map(n => parseInt(n, 10));
    const [topNumD, topNumC, topNumA] = topModParts.length === 3 ? topModParts : [3, 4, 3];

    const flopModParts = currentFlopMod.split('-').map(n => parseInt(n, 10));
    const [flopNumD, flopNumC, flopNumA] = flopModParts.length === 3 ? flopModParts : [3, 4, 3];

    // Enrich active players with fantamedia and media voto
    const enriched = attuali.map(p => {
      const st = this.getPlayerStats(p.name, p.playerId, p);
      return {
        ...p,
        mv: st.mv || 0,
        fm: st.fm || 0,
        pr: st.pr || 0,
        serieATeam: p.serieATeam || st.sTeam
      };
    });

    // Best selection (highest FM)
    const getBestForRole = (role, count) => {
      return enriched
        .filter(p => p.role === role)
        .sort((a, b) => (b.fm - a.fm) || (b.mv - a.mv))
        .slice(0, count);
    };

    // Worst selection (lowest FM among who played, then unvoted)
    const getWorstForRole = (role, count) => {
      const rolePlayers = enriched.filter(p => p.role === role);
      const played = rolePlayers.filter(p => p.fm > 0 || p.mv > 0).sort((a, b) => (a.fm - b.fm) || (a.mv - b.mv));
      const notPlayed = rolePlayers.filter(p => !p.fm && !p.mv);
      return [...played, ...notPlayed].slice(0, count);
    };

    // TOP 11
    const topP = getBestForRole(1, 1);
    const topD = getBestForRole(2, topNumD);
    const topC = getBestForRole(3, topNumC);
    const topA = getBestForRole(4, topNumA);
    const topStarters = [...topP, ...topD, ...topC, ...topA];
    const topStarterNames = new Set(topStarters.map(s => s.name));
    const topAvgMv = topStarters.length > 0 ? (topStarters.reduce((acc, p) => acc + p.mv, 0) / topStarters.length).toFixed(2) : '0.00';
    const topAvgFm = topStarters.length > 0 ? (topStarters.reduce((acc, p) => acc + p.fm, 0) / topStarters.length).toFixed(2) : '0.00';

    // FLOP 11
    const flopP = getWorstForRole(1, 1);
    const flopD = getWorstForRole(2, flopNumD);
    const flopC = getWorstForRole(3, flopNumC);
    const flopA = getWorstForRole(4, flopNumA);
    const flopStarters = [...flopP, ...flopD, ...flopC, ...flopA];
    const flopStarterNames = new Set(flopStarters.map(s => s.name));
    const flopAvgMv = flopStarters.length > 0 ? (flopStarters.reduce((acc, p) => acc + p.mv, 0) / flopStarters.length).toFixed(2) : '0.00';
    const flopAvgFm = flopStarters.length > 0 ? (flopStarters.reduce((acc, p) => acc + p.fm, 0) / flopStarters.length).toFixed(2) : '0.00';

    const renderPitchLine = (players, roleClass, roleLetter, isLast = false, isFlop = false) => {
      const count = players.length;
      const isStaggered = count >= 5;
      return `
        <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}" ${isLast ? 'style="margin-bottom:0;"' : ''}>
          ${players.map((pl, idx) => {
        const isWing = isStaggered && (idx === 0 || idx === count - 1);
        const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
        const { surname } = fcmDataLoader.splitPlayerName(pl.name);
        const pId = pl.playerId || fcmDataLoader.getSerieAPlayerId(pl.name);
        const pCode = pl.code || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerCode ? fcmDataLoader.getPlayerCode(pl.name) : null);
        const linkHref = pCode ? `#schede_giocatori?cod=${pCode}` : (pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(pl.name)}`);
        const photoSrc = pl.code ? `img/foto/${pl.code}.jpg` : fcmDataLoader.getPlayerPhoto(pl.name);
        const mvStr = pl.mv > 0 ? pl.mv.toFixed(2) : '-';
        const fmStr = pl.fm > 0 ? pl.fm.toFixed(2) : '-';

        return `
              <a href="${linkHref}" class="pitch-player ${wingClass}" data-player="${pl.name}" title="${pl.name} - MV: ${mvStr} | FM: ${fmStr}">
                <div class="pitch-player-avatar">
                  <img src="${photoSrc}" class="pitch-player-photo" alt="${pl.name}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
                  
                  <!-- Badge piccolo del ruolo in basso a sinistra -->
                  <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  
                  <!-- Logo Serie A (img/sq/logo) in basso a destra -->
                  ${pl.serieATeam ? `
                    <img src="${fcmDataLoader.getSerieALogo(pl.serieATeam)}" class="rose-top11-club-logo" onerror="this.style.display='none'" alt="" />
                  ` : ''}
                </div>
                
                <!-- Nome del giocatore (solo cognome) -->
                <div class="pitch-player-name">
                  <span class="pitch-player-surname">${surname}</span>
                </div>
                
                <!-- Sotto il nome: media voto / media fantavoto -->
                <div class="rose-top11-stats-sub ${isFlop ? 'rose-flop11-stats-sub' : ''}">
                  <span class="rose-top11-mv">${mvStr}</span>
                  <span class="rose-top11-divider">/</span>
                  <span class="${isFlop ? 'rose-flop11-fm' : 'rose-top11-fm'}">${fmStr}</span>
                </div>
              </a>
            `;
      }).join('')}
        </div>
      `;
    };

    const renderCampettoCard = (title, badgeClass, icon, subTitle, selectId, currentMod, avgMv, avgFm, avgFmColor, pLines, isFlop) => `
      <div class="rose-topflop-section ${isFlop ? 'rose-flop11-section' : 'rose-top11-section'}">
        <div class="rose-topflop-header">
          <div class="rose-topflop-title">
            <span class="badge ${badgeClass}" style="font-size:0.88rem;padding:4px 9px;font-weight:800;letter-spacing:0.5px;">
              ${icon} ${title}
            </span>
            <span class="desktop-only" style="font-size:0.78rem;color:var(--text-muted);font-weight:600;">
              ${subTitle}
            </span>
          </div>

          <div class="rose-topflop-controls">
            <div class="rose-topflop-select-wrap">
              <label for="${selectId}">Modulo:</label>
              <select id="${selectId}" class="form-select rose-topflop-select">
                ${allowedMods.map(m => `
                  <option value="${m}" ${m === currentMod ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>

            <div class="rose-topflop-averages">
              <span title="Media Voto">MV: <b style="color:var(--text-primary);">${avgMv}</b></span>
              <span title="FantaMedia">FM: <b style="color:${avgFmColor};">${avgFm}</b></span>
            </div>
          </div>
        </div>

        <!-- Tactical Pitch -->
        <div class="pitch-container rose-pitch-container ${isFlop ? 'rose-pitch-flop' : ''}">
          ${fcmDataLoader.getPitchSvgLines()}
          ${pLines}
        </div>
      </div>
    `;

    const topLines = `
      ${renderPitchLine(topP, 'role-p', 'P', false, false)}
      ${renderPitchLine(topD, 'role-d', 'D', false, false)}
      ${renderPitchLine(topC, 'role-c', 'C', false, false)}
      ${renderPitchLine(topA, 'role-a', 'A', true, false)}
    `;

    const flopLines = `
      ${renderPitchLine(flopP, 'role-p', 'P', false, true)}
      ${renderPitchLine(flopD, 'role-d', 'D', false, true)}
      ${renderPitchLine(flopC, 'role-c', 'C', false, true)}
      ${renderPitchLine(flopA, 'role-a', 'A', true, true)}
    `;

    const allRanked = [...enriched].sort((a, b) => (b.fm - a.fm) || (b.mv - a.mv));

    return `
      <div>
        <!-- Due Campetti: Affiancati su Desktop, Uno dopo l'altro su Mobile -->
        <div class="rose-topflop-wrapper">
          ${renderCampettoCard('TOP 11', 'badge-success', '⭐', 'Migliore per fantamedia', 'selRoseTop11Modulo', currentTopMod, topAvgMv, topAvgFm, 'var(--accent-cyan)', topLines, false)}
          ${renderCampettoCard('FLOP 11', 'badge-danger', '📉', 'Peggiore per fantamedia', 'selRoseFlop11Modulo', currentFlopMod, flopAvgMv, flopAvgFm, 'var(--accent-rose)', flopLines, true)}
        </div>

        <!-- Classifica Rendimento Rosa per Fantamedia -->
        <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span class="desktop-only">Classifica Rosa per Fantamedia</span>
          <span class="mobile-only">Classifica Fantamedia</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">(${allRanked.length} calciatori)</span>
        </div>

        <div class="table-responsive rose-table-responsive">
          <table class="modern-table rose-table">
            <thead>
              <tr>
                <th class="rose-col-role">R</th>
                <th class="rose-col-player">
                  <span class="desktop-only">Calciatore</span>
                  <span class="mobile-only">Calc.</span>
                </th>
                <th class="rose-col-club desktop-only">Squadra A</th>
                <th class="text-center">
                  <span class="desktop-only">Media Voto</span>
                  <span class="mobile-only">MV</span>
                </th>
                <th class="text-right">
                  <span class="desktop-only">FantaMedia</span>
                  <span class="mobile-only">FM</span>
                </th>
                <th class="text-center desktop-only">Formazione</th>
              </tr>
            </thead>
            <tbody>
              ${allRanked.map(p => {
      const inTop = topStarterNames.has(p.name);
      const inFlop = flopStarterNames.has(p.name);
      const tag = inTop
        ? '<span class="badge badge-success" style="font-size:0.75rem;font-weight:700;">⭐ TOP 11</span>'
        : (inFlop
          ? '<span class="badge badge-danger" style="font-size:0.75rem;font-weight:700;">📉 FLOP 11</span>'
          : '<span style="color:var(--text-muted);font-size:0.75rem;">-</span>');
      return `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    ${this.renderPlayerCell(p)}
                    ${this.renderClubCell(p)}
                    <td class="text-center font-bold">${p.mv > 0 ? p.mv.toFixed(2) : '-'}</td>
                    <td class="text-right font-bold" style="color:var(--accent-gold);">${p.fm > 0 ? p.fm.toFixed(2) : '-'}</td>
                    <td class="text-center desktop-only">${tag}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * TAB 4: Miglior / Peggior Affare
   * Simile alla foto allegata:
   * - A sinistra: MIGLIOR AFFARE (rapporto più alto tra quotazione e costo acquisto)
   * - A destra: PEGGIOR AFFARE (rapporto più basso tra quotazione e costo acquisto)
   * Mostra: Nome calciatore, foto, icona thumbs up/down, Valore, Acquisto e (Rapporto).
   */
  renderAffari(allPlayers) {
    // Valuta calciatori con costo acquisto > 0 e quotazione valida (> 0)
    const eligible = [];
    allPlayers.forEach(p => {
      const st = this.getPlayerStats(p.name, p.playerId, p);
      const val = st.val || 0;
      const cost = p.cost || 0;
      if (cost > 0 && val > 0) {
        const ratio = val / cost;
        eligible.push({
          ...p,
          val,
          cost,
          ratio,
          ratioFormatted: Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1)
        });
      }
    });

    if (eligible.length === 0) {
      return `
        <div style="padding:32px;text-align:center;color:var(--text-muted);">
          Dati finanziari non sufficienti per calcolare il miglior e peggior affare.
        </div>
      `;
    }

    // Sort by ratio descending
    eligible.sort((a, b) => b.ratio - a.ratio);

    const bestDeal = eligible[0];
    const worstDeal = eligible[eligible.length - 1];

    const renderAffareCard = (deal, isBest) => {
      const pId = deal.playerId || fcmDataLoader.getSerieAPlayerId(deal.name);
      const dCode = deal.code || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerCode ? fcmDataLoader.getPlayerCode(deal.name) : null);
      const linkHref = dCode ? `#schede_giocatori?cod=${dCode}` : (pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(deal.name)}`);
      const photoSrc = deal.code ? `img/foto/${deal.code}.jpg` : fcmDataLoader.getPlayerPhoto(deal.name);

      return `
        <div class="rose-affare-card ${isBest ? 'best' : 'worst'}">
          <!-- Title Bar -->
          <div class="rose-affare-title">
            ${isBest ? 'MIGLIOR AFFARE' : 'PEGGIOR AFFARE'}
          </div>

          <!-- Player Name Header -->
          <div class="rose-affare-player-bar">
            <a href="${linkHref}" class="rose-player-link" style="font-weight:800;font-size:1.0rem;">
              ${deal.name}
            </a>
            <span class="role-badge ${fcmDataLoader.getRoleClass(deal.role)}">
              ${fcmDataLoader.getRoleShort(deal.role)}
            </span>
          </div>

          <!-- Body with Photo & Metrics -->
          <div class="rose-affare-body">
            <!-- Left: Photo with Serie A crest -->
            <div class="rose-affare-photo-wrap">
              <a href="${linkHref}" title="Apri scheda di ${deal.name}">
                <img src="${photoSrc}" class="rose-affare-photo" alt="${deal.name}" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
              </a>
              ${deal.serieATeam ? `
                <img src="${fcmDataLoader.getSerieALogo(deal.serieATeam)}" class="rose-affare-photo-club" title="${deal.serieATeam}" onerror="this.style.display='none';" alt="${deal.serieATeam}" />
              ` : ''}
            </div>

            <!-- Right: Thumbs Icon, Valore, Acquisto, Ratio -->
            <div class="rose-affare-stats">
              <div class="rose-thumb-icon ${isBest ? 'thumb-up' : 'thumb-down'}">
                ${isBest ? `
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                ` : `
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                  </svg>
                `}
              </div>
              <div class="rose-affare-cost">Acquisto: <b>${deal.cost}</b></div>
              <div class="rose-affare-val">Valore: <b>${deal.val}</b> <span style="font-weight:700;opacity:0.9;font-size:0.88rem;">(${deal.ratioFormatted}x)</span></div>
            </div>
          </div>
        </div>
      `;
    };

    return `
      <div>
        <!-- Side-by-side Highlights Cards -->
        <div class="rose-affari-grid">
          ${renderAffareCard(bestDeal, true)}
          ${renderAffareCard(worstDeal, false)}
        </div>

        <!-- Graduatoria Completa Rendimento Investimenti -->
        <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span>Classifica Rendimento Rapporto Valore / Acquisto</span>
        </div>

        <div class="table-responsive rose-table-responsive">
          <table class="modern-table rose-table">
            <thead>
              <tr>
                <th class="rose-col-role">R</th>
                <th class="rose-col-player">
                  <span class="desktop-only">Calciatore</span>
                  <span class="mobile-only">Calc.</span>
                </th>
                <th class="rose-col-club desktop-only">Squadra A</th>
                <th class="text-right">
                  <span class="desktop-only">Acquisto</span>
                  <span class="mobile-only">Acq.</span>
                </th>
                <th class="text-right">
                  <span class="desktop-only">Valore (Rapporto)</span>
                  <span class="mobile-only">Val. (Rapp.)</span>
                </th>
                <th class="text-center desktop-only">Trend</th>
              </tr>
            </thead>
            <tbody>
              ${eligible.map(p => {
      const isGain = p.ratio >= 1.0;
      const { surname } = fcmDataLoader.splitPlayerName(p.name);
      const pId = p.playerId || fcmDataLoader.getSerieAPlayerId(p.name);
      const pCode = p.code || (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerCode ? fcmDataLoader.getPlayerCode(p.name) : null);
      const linkHref = pCode ? `#schede_giocatori?cod=${pCode}` : (pId ? `#schede_giocatori?id=${pId}` : null);
      const photoSrc = p.code ? `img/foto/${p.code}.jpg` : fcmDataLoader.getPlayerPhoto(p.name);
      const photoHtml = `<img src="${photoSrc}" class="roster-player-photo" alt="${p.name}" width="38" height="38" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />`;
      const photoBlock = linkHref ? `<a href="${linkHref}" class="rose-player-photo-link" title="Apri scheda di ${p.name}">${photoHtml}</a>` : photoHtml;
      const shirtInline = p.serieATeam ? `<img src="${fcmDataLoader.getSerieAShirt(p.serieATeam)}" class="rose-shirt-inline" onerror="this.style.display='none';" alt="" />` : '';

      const badgeHtml = p.ratio >= 1.5
        ? '<span class="badge badge-success">TOP</span>'
        : (p.ratio >= 1.0
          ? '<span class="badge badge-success">BUONO</span>'
          : (p.ratio >= 0.5
            ? '<span class="badge badge-warning">MEDIO</span>'
            : '<span class="badge badge-danger">FLOP</span>'));

      return `
                  <tr>
                    <td class="rose-cell-role"><span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span></td>
                    <td class="rose-player-cell">
                      <div class="rose-player-flex">
                        ${photoBlock}
                        ${shirtInline}
                        ${p.serieATeam ? `<img src="${fcmDataLoader.getSerieALogo(p.serieATeam)}" class="rose-logo-inline" onerror="this.style.display='none';" alt="" />` : ''}
                        <div class="rose-player-info">
                          <div class="rose-player-name">
                            ${linkHref ? `
                              <a href="${linkHref}" class="rose-player-link" title="Apri scheda di ${p.name}">
                                <span class="desktop-only">${p.name}</span>
                                <span class="mobile-only">${surname}</span>
                              </a>
                            ` : `
                              <span class="desktop-only">${p.name}</span>
                              <span class="mobile-only">${surname}</span>
                            `}
                          </div>
                          ${p.serieATeam ? `
                            <div class="rose-player-club mobile-only">
                              <span>${p.serieATeam}</span>
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </td>
                    ${this.renderClubCell(p)}
                    <td class="text-right font-bold">${p.cost}</td>
                    <td class="text-right font-bold">
                      <span style="color:var(--accent-gold);">${p.val}</span>
                      <span style="font-size:0.84rem;font-weight:700;color:${isGain ? 'var(--accent-emerald)' : 'var(--accent-rose)'};margin-left:3px;">(${p.ratioFormatted}x)</span>
                    </td>
                    <td class="text-center font-bold desktop-only">
                      ${badgeHtml}
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * Helper per ricavare il nome del file FantaMister (sq1.htm ... sqN.htm)
   * In FantaMister i file non seguono direttamente l'ID FCM della squadra,
   * bensì l'indice sequenziale da 1 a N basato sull'ordine puro di ID delle squadre attive
   * (gestendo correttamente eventuali ID mancanti/saltati nella lega, es. ID 3 mancante).
   */
  getFantamisterFileForTeam(teamId) {
    const tId = parseInt(teamId, 10);
    if (!tId) return 'sq1.htm';

    // 1. Cerca da arrFantasquadre ordinato per ID crescente
    let sortedTeams = [];
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      for (let i = 1; i < arrFantasquadre.length; i++) {
        if (arrFantasquadre[i]) sortedTeams.push(arrFantasquadre[i]);
      }
      sortedTeams.sort((a, b) => (a.ID || 0) - (b.ID || 0));
    } else if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getTeams) {
      sortedTeams = fcmDataLoader.getTeams().slice().sort((a, b) => (a.ID || 0) - (b.ID || 0));
    }

    if (sortedTeams.length > 0) {
      const idx = sortedTeams.findIndex(t => (t.ID || t.id) === tId);
      if (idx >= 0) {
        return `sq${idx + 1}.htm`;
      }
    }

    return `sq${tId}.htm`;
  },

  /**
   * TAB 5: Statistiche FantaMister (Native SPA)
   * Calcola nativamente da fcmFantamisterMotore o da sqlite/fantamister_storico.json:
   * Moduli Utilizzati, Fantacannonieri, Presenze & Rendimento
   */
  async loadFantamisterReport(teamId, container, isHistorical = false, season = null, currentTeam = null, allPlayers = []) {
    const reportBox = container.querySelector('#roseStatsContainer');
    if (!reportBox) return;

    const tId = parseInt(teamId, 10);
    if (!tId) return;

    // Se stagione storica, carica dal file storico consolidato di FantaMister & rose storiche
    if (isHistorical && season) {
      try {
        const fmData = await fcmDataLoader.loadFantamisterStorico().catch(() => null);
        const comp0 = (fmData && fmData.byComp && fmData.byComp[0]) ? fmData.byComp[0] : null;

        // 1. Seasonal Ranking stats for this team
        let sRanking = null;
        if (comp0 && comp0.stagioni && comp0.stagioni[String(season)] && comp0.stagioni[String(season)].ranking) {
          sRanking = comp0.stagioni[String(season)].ranking.find(r =>
            (currentTeam && r.teamId === currentTeam.franchiseId) ||
            (r.idAttuale && r.idAttuale == tId) ||
            (currentTeam && r.teamName && r.teamName.toLowerCase() === (currentTeam.nome || '').toLowerCase())
          );
        }

        // 2. Moduli ottimali utilizzati
        let modulesList = [];
        if (comp0 && comp0.moduli && comp0.moduli.bySeason && comp0.moduli.bySeason[String(season)] && comp0.moduli.bySeason[String(season)].teams) {
          const modTeam = Object.values(comp0.moduli.bySeason[String(season)].teams).find(mt =>
            (currentTeam && mt.teamId === currentTeam.franchiseId) ||
            (mt.idAttuale && mt.idAttuale == tId) ||
            (currentTeam && mt.teamName && mt.teamName.toLowerCase() === (currentTeam.nome || '').toLowerCase())
          );
          if (modTeam && modTeam.modulesOptimal) {
            const totModMatches = modTeam.matches || (sRanking ? sRanking.matches : 1);
            modulesList = Object.keys(modTeam.modulesOptimal)
              .filter(m => modTeam.modulesOptimal[m] > 0)
              .map(m => ({
                module: m,
                count: modTeam.modulesOptimal[m],
                pct: Math.round((modTeam.modulesOptimal[m] / totModMatches) * 1000) / 10
              }))
              .sort((a, b) => b.count - a.count);
          }
        }

        // 3. Marcatori di squadra dalla rosa storica
        const scorersList = (allPlayers || [])
          .filter(p => (parseInt(p.goals, 10) || 0) > 0)
          .map(p => ({
            id: p.playerId || p.code,
            code: p.code,
            name: p.name,
            role: p.role,
            club: p.serieATeam || '',
            goals: parseInt(p.goals, 10) || 0,
            pr: parseInt(p.pr, 10) || 0,
            mv: parseFloat(p.mv) || 0,
            fm: parseFloat(p.fm) || 0
          }))
          .sort((a, b) => b.goals - a.goals || b.fm - a.fm || a.name.localeCompare(b.name));

        // 4. Tabella presenze & rendimento dalla rosa storica
        const appList = (allPlayers || [])
          .filter(p => (parseInt(p.pr, 10) || 0) > 0 || (p.cost || 0) > 0)
          .map(p => ({
            id: p.playerId || p.code,
            code: p.code,
            name: p.name,
            role: p.role,
            club: p.serieATeam || '',
            pr: parseInt(p.pr, 10) || 0,
            goals: parseInt(p.goals, 10) || 0,
            assist: parseInt(p.assist, 10) || 0,
            amm: parseInt(p.amm, 10) || 0,
            esp: parseInt(p.esp, 10) || 0,
            mv: parseFloat(p.mv) || 0,
            fm: parseFloat(p.fm) || 0
          }))
          .sort((a, b) => b.pr - a.pr || b.goals - a.goals || b.fm - a.fm || a.name.localeCompare(b.name));

        const getRoleBadge = (role) => {
          const r = parseInt(role, 10);
          if (r === 1) return '<span class="role-badge role-p">P</span>';
          if (r === 2) return '<span class="role-badge role-d">D</span>';
          if (r === 3) return '<span class="role-badge role-c">C</span>';
          return '<span class="role-badge role-a">A</span>';
        };

        const renderPlayerThumb = (p, size = 30) => {
          const rawName = p && p.name ? p.name : '';
          const url = p.code ? `img/foto/${p.code}.jpg` : ((rawName && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerPhoto) ? fcmDataLoader.getPlayerPhoto(rawName) : 'img/foto/misterx.gif');
          const href = p.code ? `#schede_giocatori?cod=${p.code}` : (p.id ? `#schede_giocatori?id=${p.id}` : null);
          const club = p && p.club ? p.club : '';
          const clubLogo = (club && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getSerieALogo) ? fcmDataLoader.getSerieALogo(club) : '';
          const inner = `
            <img src="${url}" class="fantam-player-thumb" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;" alt="${rawName}" loading="lazy" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
            ${clubLogo ? `<img src="${clubLogo}" class="fantam-club-badge" title="${club}" alt="${club}" onerror="this.style.display='none';" />` : ''}
          `;
          return href ? `<a href="${href}" class="fantam-player-avatar" title="Apri scheda di ${rawName}">${inner}</a>` : `<span class="fantam-player-avatar" title="${rawName}">${inner}</span>`;
        };

        const renderPlayerName = (p, customStyle = '') => {
          const rawName = p && p.name ? p.name : '';
          const href = p.code ? `#schede_giocatori?cod=${p.code}` : (p.id ? `#schede_giocatori?id=${p.id}` : null);
          return href ? `<a href="${href}" class="fantam-player-link" style="${customStyle}">${rawName}</a>` : `<span style="${customStyle}">${rawName}</span>`;
        };

        const html = `
          <div style="display:flex;flex-direction:column;gap:18px;">
            ${sRanking ? `
              <!-- KPI Card Stagionale FantaMister -->
              <div class="card" style="padding:18px 20px;">
                <div style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                  <span>👔</span>
                  <span>Rendimento FantaMister • Stagione ${season}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;">
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Gare Giocate</div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary);">${sRanking.matches}</div>
                  </div>
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Media Reale</div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--accent-primary);">${Number(sRanking.mediaReale).toFixed(2)}</div>
                  </div>
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Top 11 Ideale</div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--accent-cyan);">${Number(sRanking.mediaIdeale).toFixed(2)}</div>
                  </div>
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Scarto Medio</div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--accent-gold);">${Number(sRanking.scartoMedio).toFixed(2)}</div>
                  </div>
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Punti Persi</div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--accent-rose);">${Number(sRanking.puntiPersi).toFixed(1)}</div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- 1. Distribuzione Moduli Ottimali -->
            ${modulesList.length > 0 ? `
              <div class="card" style="padding:18px 20px;">
                <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <span>📐</span>
                  <span>Moduli Ottimali Utilizzati</span>
                </h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:12px;">
                  ${modulesList.map(m => `
                    <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-weight:800;font-size:1.05rem;color:var(--accent-primary);">${m.module}</span>
                        <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">${m.pct}% <span style="font-size:0.75rem;font-weight:normal;color:var(--text-muted);">(${m.count} gare)</span></span>
                      </div>
                      <div style="height:6px;background:var(--border-subtle);border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${m.pct}%;background:var(--accent-primary);border-radius:3px;"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- 2. Fantamarcatori della Squadra -->
            <div class="card" style="padding:18px 20px;">
              <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                <span>⚽</span>
                <span>Fantamarcatori della Squadra (${scorersList.length})</span>
              </h4>
              ${scorersList.length > 0 ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;">
                  ${scorersList.map(s => `
                    <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                      <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                        ${getRoleBadge(s.role)}
                        ${renderPlayerThumb(s, 30)}
                        <div style="font-weight:800;color:var(--text-primary);font-size:0.86rem;white-space:normal;word-break:break-word;overflow-wrap:break-word;line-height:1.25;">
                          ${renderPlayerName(s, 'font-weight:800;color:var(--text-primary);')}
                        </div>
                      </div>
                      <span style="background:rgba(245,158,11,0.15);color:var(--accent-gold);border:1px solid rgba(245,158,11,0.3);padding:3px 9px;border-radius:12px;font-weight:800;font-size:0.82rem;flex-shrink:0;white-space:nowrap;">
                        ⚽ ${s.goals}
                      </span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">Nessun gol segnato in questa stagione.</div>
              `}
            </div>

            <!-- 3. Presenze, Reti & Rendimento -->
            <div class="card" style="padding:18px 20px;">
              <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                <span>📋</span>
                <span>Presenze, Reti &amp; Rendimento (${appList.length})</span>
              </h4>
              <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                <table class="fantam-table">
                  <thead>
                    <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                      <th style="padding:8px 6px;">Calciatore</th>
                      <th style="padding:8px 6px;text-align:center;"><span class="desktop-only">Squadra A</span><span class="mobile-only">Club</span></th>
                      <th style="padding:8px 6px;text-align:center;"><span class="desktop-only">Presenze</span><span class="mobile-only">Pres.</span></th>
                      <th style="padding:8px 6px;text-align:center;"><span class="desktop-only">Fantagol</span><span class="mobile-only">Gol</span></th>
                      <th style="padding:8px 6px;text-align:center;"><span class="desktop-only">Media Voto</span><span class="mobile-only">MV</span></th>
                      <th style="padding:8px 6px;text-align:center;"><span class="desktop-only">FantaMedia</span><span class="mobile-only">FM</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${appList.map((p, idx) => `
                      <tr style="border-bottom:1px solid var(--border-subtle);background:${idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)'};">
                        <td style="padding:8px 6px;">
                          <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;">
                            ${getRoleBadge(p.role)}
                            ${renderPlayerThumb(p, 28)}
                            <div style="min-width:0;">
                              ${renderPlayerName(p, 'font-weight:700;color:var(--text-primary);')}
                            </div>
                          </div>
                        </td>
                        <td style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-size:0.82rem;">${p.club || '-'}</td>
                        <td style="padding:8px 6px;text-align:center;font-weight:800;color:var(--accent-primary);">${p.pr}</td>
                        <td style="padding:8px 6px;text-align:center;font-weight:700;color:var(--accent-gold);">${p.goals > 0 ? p.goals : '-'}</td>
                        <td style="padding:8px 6px;text-align:center;font-weight:700;color:var(--text-primary);">${p.mv > 0 ? p.mv.toFixed(2) : '-'}</td>
                        <td style="padding:8px 6px;text-align:center;font-weight:800;color:var(--accent-cyan);">${p.fm > 0 ? p.fm.toFixed(2) : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        reportBox.innerHTML = html;
        return;
      } catch (err) {
        console.warn('Errore rendering statistiche FantaMister storiche:', err);
      }
    }

    // Prova il rendering nativo da fcmFantamisterMotore (identico a #fantam -> Per Squadra)
    if (typeof fcmFantamisterMotore !== 'undefined') {
      try {
        const stats = await fcmFantamisterMotore.getTeamStats(tId);
        if (stats && stats.matchesCount > 0) {
          if (typeof fantamView !== 'undefined' && typeof fantamView.renderTeamStatsContent === 'function') {
            reportBox.innerHTML = fantamView.renderTeamStatsContent(stats);
            return;
          }

          const totalMatches = stats.matchesCount;

          // 1. Moduli utilizzati ordinati per frequenza
          const modulesList = Object.keys(stats.modulesUsed || {})
            .map(m => ({ module: m, count: stats.modulesUsed[m], pct: Math.round((stats.modulesUsed[m] / totalMatches) * 1000) / 10 }))
            .sort((a, b) => b.count - a.count);

          // 2. Fantamarcatori di squadra ordinati per gol
          const scorersList = [];
          if (stats.scorers) {
            Object.keys(stats.scorers).forEach(pId => {
              const goals = stats.scorers[pId];
              const pInfo = stats.appearances && stats.appearances[pId] ? stats.appearances[pId] : null;
              let name = pInfo ? pInfo.name : (window[`xg${pId}`] || `Giocatore #${pId}`);
              let role = pInfo ? pInfo.role : 4;
              let club = pInfo ? pInfo.club : '';
              scorersList.push({ id: pId, name, role, club, goals });
            });
          }
          scorersList.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

          // 3. Tabella presenze ordinata per presenze totali
          const appList = Object.values(stats.appearances || {}).map(p => ({
            ...p,
            totalApp: (p.titolare || 0) + (p.subentrato || 0),
            goals: stats.scorers && stats.scorers[p.id] ? stats.scorers[p.id] : 0
          })).sort((a, b) => b.totalApp - a.totalApp || b.titolare - a.titolare || a.name.localeCompare(b.name));

          const getRoleBadge = (role) => {
            const r = parseInt(role, 10);
            if (r === 1) return '<span class="role-badge role-p">P</span>';
            if (r === 2) return '<span class="role-badge role-d">D</span>';
            if (r === 3) return '<span class="role-badge role-c">C</span>';
            return '<span class="role-badge role-a">A</span>';
          };

          const getPlayerLink = (p) => {
            const rawName = p && p.name ? p.name : '';
            if (!rawName) return null;
            if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) {
              return fcmDataLoader.getPlayerProfileLink({ name: rawName, id: p.id, code: p.code });
            }
            const pId = (p.id && parseInt(p.id, 10) > 0) ? parseInt(p.id, 10) : (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getSerieAPlayerId ? fcmDataLoader.getSerieAPlayerId(rawName) : null);
            return pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(rawName)}`;
          };

          const renderPlayerThumb = (p, size = 30) => {
            const rawName = p && p.name ? p.name : '';
            const url = (rawName && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerPhoto) ? fcmDataLoader.getPlayerPhoto(rawName) : 'img/foto/misterx.gif';
            const href = getPlayerLink(p);
            const club = p && p.club ? p.club : '';
            const clubLogo = (club && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getSerieALogo) ? fcmDataLoader.getSerieALogo(club) : '';
            const inner = `
              <img src="${url}" class="fantam-player-thumb" style="width:${size}px;height:${size}px;" alt="${rawName}" loading="lazy" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
              ${clubLogo ? `<img src="${clubLogo}" class="fantam-club-badge" title="${club}" alt="${club}" onerror="this.style.display='none';" />` : ''}
            `;
            return href ? `<a href="${href}" class="fantam-player-avatar" title="Apri scheda di ${rawName}">${inner}</a>` : `<span class="fantam-player-avatar" title="${rawName}">${inner}</span>`;
          };

          const renderPlayerName = (p, customStyle = '') => {
            const rawName = p && p.name ? p.name : '';
            const href = getPlayerLink(p);
            return href ? `<a href="${href}" class="fantam-player-link" style="${customStyle}">${rawName}</a>` : `<span style="${customStyle}">${rawName}</span>`;
          };

          const html = `
            <div style="display:flex;flex-direction:column;gap:18px;">
              <!-- 1. Distribuzione Moduli -->
              <div class="card" style="padding:18px 20px;">
                <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <span>📐</span>
                  <span>Moduli Reali Utilizzati</span>
                </h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:12px;">
                  ${modulesList.map(m => `
                    <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-weight:800;font-size:1.05rem;color:var(--accent-primary);">${m.module}</span>
                        <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">${m.pct}% <span style="font-size:0.75rem;font-weight:normal;color:var(--text-muted);">(${m.count} gare)</span></span>
                      </div>
                      <div style="height:6px;background:var(--border-subtle);border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${m.pct}%;background:var(--accent-primary);border-radius:3px;"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- 2. Fantamarcatori della Squadra -->
              <div class="card" style="padding:18px 20px;">
                <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <span>⚽</span>
                  <span>Fantamarcatori della Squadra</span>
                </h4>
                ${scorersList.length > 0 ? `
                  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;">
                    ${scorersList.map(s => `
                      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                          ${getRoleBadge(s.role)}
                          ${renderPlayerThumb(s, 30)}
                          <div style="font-weight:800;color:var(--text-primary);font-size:0.86rem;white-space:normal;word-break:break-word;overflow-wrap:break-word;line-height:1.25;">
                            ${renderPlayerName(s, 'font-weight:800;color:var(--text-primary);')}
                          </div>
                        </div>
                        <span style="background:rgba(245,158,11,0.15);color:var(--accent-gold);border:1px solid rgba(245,158,11,0.3);padding:3px 9px;border-radius:12px;font-weight:800;font-size:0.82rem;flex-shrink:0;white-space:nowrap;">
                          ⚽ ${s.goals}
                        </span>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">Nessun gol segnato finora.</div>
                `}
              </div>

              <!-- 3. Presenze, Subentri & Sostituzioni -->
              <div class="card" style="padding:18px 20px;">
                <h4 style="margin:0 0 14px 0;font-size:1.02rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <span>📋</span>
                  <span>Presenze, Subentri &amp; Sostituzioni</span>
                </h4>
                <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                  <table class="fantam-table">
                    <thead>
                      <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                        <th style="padding:8px 6px;">Calciatore</th>
                        <th style="padding:8px 6px;text-align:center;"><span class="fantam-hide-mobile">Presenze</span><span class="fantam-show-mobile">Pres.</span></th>
                        <th style="padding:8px 6px;text-align:center;"><span class="fantam-hide-mobile">Titolare</span><span class="fantam-show-mobile">Tit.</span></th>
                        <th style="padding:8px 6px;text-align:center;"><span class="fantam-hide-mobile">Subentrato</span><span class="fantam-show-mobile">Sub.</span></th>
                        <th style="padding:8px 6px;text-align:center;"><span class="fantam-hide-mobile">Sostituito</span><span class="fantam-show-mobile">Sost.</span></th>
                        <th style="padding:8px 6px;text-align:center;"><span class="fantam-hide-mobile">Fantagol</span><span class="fantam-show-mobile">Gol</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${appList.map((p, idx) => `
                        <tr style="border-bottom:1px solid var(--border-subtle);background:${idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)'};">
                          <td style="padding:8px 6px;">
                            <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;">
                              ${getRoleBadge(p.role)}
                              ${renderPlayerThumb(p, 28)}
                              <div style="min-width:0;">
                                ${renderPlayerName(p, 'font-weight:700;color:var(--text-primary);')}
                              </div>
                            </div>
                          </td>
                          <td style="padding:8px 6px;text-align:center;font-weight:800;color:var(--accent-primary);">${p.totalApp}</td>
                          <td style="padding:8px 6px;text-align:center;color:var(--text-primary);">${p.titolare}</td>
                          <td style="padding:8px 6px;text-align:center;color:var(--accent-emerald);">${p.subentrato > 0 ? `+${p.subentrato}` : '0'}</td>
                          <td style="padding:8px 6px;text-align:center;color:var(--accent-crimson);">${p.sostituito > 0 ? `-${p.sostituito}` : '0'}</td>
                          <td style="padding:8px 6px;text-align:center;font-weight:700;color:var(--accent-gold);">${p.goals > 0 ? p.goals : '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `;

          reportBox.innerHTML = html;
          return;
        }
      } catch (e) {
        console.warn('Errore calcolo statistiche FantaMister rosa:', e);
      }
    }

    // Fallback: visualizzazione legacy se file fantam/sq*.htm presente
    const file = this.getFantamisterFileForTeam(teamId);
    if (this._fantamHtmlCache[file]) {
      reportBox.innerHTML = this._fantamHtmlCache[file];
      return;
    }

    try {
      const resp = await fetch(`fantam/${file}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rawText = await resp.text();

      let clean = rawText;
      if (clean.includes('<body') || clean.includes('<BODY')) {
        const doc = new DOMParser().parseFromString(clean, 'text/html');
        clean = doc.body ? doc.body.innerHTML : clean;
      }
      clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
      clean = clean.replace(/<link[\s\S]*?>/gi, '');
      clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
      clean = clean.replace(/<center>/gi, '<div style="text-align:center;">').replace(/<\/center>/gi, '</div>');
      clean = clean.replace(/<br\s*\/?>/gi, '');

      const wrapped = `
        <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:18px;">
          <div class="fantam-table-wrap">
            <div class="fantam-report-content">${clean}</div>
          </div>
        </div>
      `;

      this._fantamHtmlCache[file] = wrapped;
      reportBox.innerHTML = wrapped;
    } catch (err) {
      reportBox.innerHTML = `
        <div style="background:var(--bg-surface-elevated);border:1px dashed var(--border-subtle);border-radius:var(--radius-md);padding:32px 18px;text-align:center;">
          <div style="font-size:1.8rem;margin-bottom:8px;">ℹ️</div>
          <div style="font-weight:800;font-size:1.0rem;color:var(--text-primary);margin-bottom:6px;">
            Statistiche FantaMister non disponibili
          </div>
        </div>
      `;
    }
  },

  async renderHistorical(container, season) {
    this.selectedSeason = parseInt(season, 10) || fcmDataLoader.getCurrentSeason();
    return this.render(container);
  }
};

if (typeof window !== 'undefined') {
  window.roseView = roseView;
}
