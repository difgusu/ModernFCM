/**
 * FCM FANTAMISTER MOTORE
 * Motore nativo di calcolo per formazioni ideali, analisi tecnica, fantamarcatori,
 * Top/Flop 11, incompresi, uomini partita e statistiche di rendimento.
 * Sostituisce integralmente FantaMister.exe e FM_TabMatic.exe in puro JavaScript.
 * ModernFCM
 */

const fcmFantamisterMotore = {
  // Configurazione moduli tattici predefiniti (fallback standard FCM)
  defaultAllowedModules: [
    [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1]
  ],

  /**
   * Restituisce i moduli tattici ammessi sincronizzati con moduliAmmessi in fcmInvioFormazioneDati.js,
   * con fallback automatico ai moduli predefiniti.
   */
  get allowedModules() {
    if (typeof moduliAmmessi !== 'undefined' && Array.isArray(moduliAmmessi) && moduliAmmessi.length > 0) {
      const parsed = [];
      for (let i = 0; i < moduliAmmessi.length; i++) {
        const m = moduliAmmessi[i];
        if (!Array.isArray(m)) continue;
        let d = NaN, c = NaN, a = NaN;
        if (m.length >= 5) {
          d = parseInt(m[2], 10);
          c = parseInt(m[3], 10);
          a = parseInt(m[4], 10);
        } else if (m.length === 4) {
          d = parseInt(m[1], 10);
          c = parseInt(m[2], 10);
          a = parseInt(m[3], 10);
        } else if (m.length === 3) {
          d = parseInt(m[0], 10);
          c = parseInt(m[1], 10);
          a = parseInt(m[2], 10);
        }
        if (!isNaN(d) && !isNaN(c) && !isNaN(a) && (d + c + a === 10)) {
          parsed.push([d, c, a]);
        }
      }
      if (parsed.length > 0) return parsed;
    }
    return this.defaultAllowedModules;
  },

  /**
   * Restituisce i moduli ammessi come array di stringhe (es. ['3-4-3', '3-5-2', ..., '6-3-1'])
   */
  getAllowedModuleStrings() {
    return this.allowedModules.map(([d, c, a]) => `${d}-${c}-${a}`);
  },

  /**
   * Assicura che fcmInvioFormazioneDati.js sia stato caricato per leggere moduliAmmessi
   */
  async ensureModuliAmmessiLoaded() {
    if (typeof moduliAmmessi === 'undefined' && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
      try {
        await fcmDataLoader.loadScript('js/fcmInvioFormazioneDati.js');
      } catch (e) {
        // Fallback silenzioso a defaultAllowedModules
      }
    }
  },

  // Priorità tie-breaker per assegnazione fantamarcatori e migliore in campo
  scorerPriorities: ['VA', 'DF', 'CE', 'AT', 'MG', 'SQ'],

  // Cache in-memory
  _matchdayCache: {},
  _seasonCache: {},
  _loadingDays: {},

  /**
   * Reset della cache
   */
  clearCache() {
    this._matchdayCache = {};
    this._seasonCache = {};
    this._loadingDays = {};
  },

  /**
   * Recupera l'oggetto squadra da arrFantasquadre o fcmDataLoader
   */
  getTeam(teamId) {
    const id = parseInt(teamId, 10);
    if (!id || isNaN(id)) return null;
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      const found = arrFantasquadre.find(t => t && t.ID === id);
      if (found) return found;
    }
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamById === 'function') {
      const found = fcmDataLoader.getTeamById(id);
      if (found) return found;
    }
    return null;
  },

  /**
   * Restituisce il nome corretto della squadra
   */
  getTeamName(teamId) {
    const t = this.getTeam(teamId);
    return t ? (t.Nome || t.nome || t.name) : `Squadra ${teamId}`;
  },

  /**
   * Restituisce l'allenatore/presidente della squadra
   */
  getTeamCoach(teamId) {
    const t = this.getTeam(teamId);
    return t ? (t.Presidente || t.presidente || t.coach || '') : '';
  },

  /**
   * Restituisce l'ID della competizione attuale di un calciatore (in rosa con Stato 0 = attivo o 2 = infortunato, escludendo Stato 1 = svincolato)
   */
  getCurrentPlayerTeamId(playerName, fallbackTeamId = 0) {
    if (playerName && typeof arrRose !== 'undefined' && Array.isArray(arrRose)) {
      const target = String(playerName).trim().toUpperCase();
      for (let i = 1; i < arrRose.length; i++) {
        const r = arrRose[i];
        if (r && (r.Stato === 0 || r.Stato === 2) && String(r.Nome || '').trim().toUpperCase() === target) {
          return parseInt(r.IDSquadra, 10) || fallbackTeamId;
        }
      }
    }
    return fallbackTeamId;
  },

  /**
   * Restituisce l'ID della competizione predefinita (0 = Tutte le competizioni)
   */
  getDefaultCompId() {
    return 0;
  },

  /**
   * Verifica se un voto è valido (numerico e non sv/ng)
   */
  isValidVote(vote) {
    if (vote === undefined || vote === null) return false;
    const s = String(vote).trim();
    if (!s || s === 'sv/ng' || s === '-' || s === 'x') return false;
    const num = parseFloat(s.replace(',', '.'));
    return !isNaN(num);
  },

  /**
   * Converte un voto stringa/numero in float
   */
  parseVoteNum(vote, defaultVal = 0) {
    if (vote === undefined || vote === null) return defaultVal;
    if (typeof vote === 'number') return isNaN(vote) ? defaultVal : vote;
    const s = String(vote).trim().replace(',', '.');
    const num = parseFloat(s);
    return isNaN(num) ? defaultVal : num;
  },

  /**
   * Carica i tabellini di una giornata tramite fcmDataLoader o fetch
   */
  async loadMatchdayTabellini(day) {
    const d = parseInt(day, 10);
    if (!d || d <= 0) return [];

    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadMatchdayResults) {
      const results = await fcmDataLoader.loadMatchdayResults(d);
      if (Array.isArray(results) && results.length > 0) return results;
    }

    // Fallback: se fcmDataLoader non è disponibile o vuoto
    if (typeof arrTabellini !== 'undefined' && Array.isArray(arrTabellini) && arrTabellini.length > 1) {
      return this._parseRawTabelliniArray(arrTabellini);
    }

    return [];
  },

  /**
   * Helper per parsare l'array globale arrTabellini se usato offline/standalone
   */
  _parseRawTabelliniArray(rawArr) {
    const list = [];
    for (let i = 1; i < rawArr.length; i++) {
      const t = rawArr[i];
      if (!t) continue;
      const ids = String(t.Lista || '').split('%');
      const teams = String(t.ListaSqA || '').split('%');
      const roles = String(t.Ruolo || '').split('%');
      const votes = String(t.Voto || '').split('%');
      const mods = String(t.Modif || '').split('%');
      const tots = String(t.Tot || '').split('%');

      const players = [];
      for (let j = 0; j < ids.length; j++) {
        const id = ids[j];
        if (j > 10 && (!id || id === '0')) continue;
        const pRole = parseInt(roles[j], 10) || 0;
        const isStarter = j <= 10;
        const isSubbedIn = j <= 10 && (pRole >= 5 && pRole <= 8);
        const isSubbedOut = j > 10 && (pRole >= -4 && pRole <= -1);
        const isBench = j > 10 && (pRole >= 5 && pRole <= 8);
        const isTribuna = j > 10 && (pRole >= -8 && pRole <= -5);
        const isOfficeReserve = (id === '-1');
        const isAbsent = (id === '0');

        let baseRole = 0;
        if (pRole >= 1 && pRole <= 4) baseRole = pRole;
        else if (pRole >= 5 && pRole <= 8) baseRole = pRole - 4;
        else if (pRole >= -4 && pRole <= -1) baseRole = Math.abs(pRole);
        else if (pRole >= -8 && pRole <= -5) baseRole = Math.abs(pRole) - 4;

        let pName = '';
        if (isAbsent) pName = 'Assente';
        else if (isOfficeReserve) pName = "Riserva d'ufficio";
        else if (typeof window !== 'undefined' && window[`xg${id}`]) pName = window[`xg${id}`];
        else pName = `Giocatore #${id}`;

        const clubId = teams[j];
        const pClub = (typeof window !== 'undefined' && window[`xa${clubId}`]) ? window[`xa${clubId}`] : '';

        players.push({
          id,
          name: pName,
          club: pClub,
          role: baseRole,
          roleRaw: pRole,
          rawVote: votes[j] || '-',
          bonusMalus: mods[j] || '0',
          totVote: tots[j] || '-',
          isStarter,
          isSubbedIn,
          isSubbedOut,
          isBench,
          isTribuna,
          isOfficeReserve,
          isAbsent
        });
      }

      list.push({
        matchId: t.IDIncontro,
        teamId: t.IDSquadra,
        leagueId: t.IDLega,
        players,
        partialScore: t.ParzialeSquadra !== 'x' ? parseFloat(t.ParzialeSquadra) : 0,
        totalScore: t.TotaleSquadra !== 'x' ? parseFloat(t.TotaleSquadra) : 0,
        goals: t.Gol !== 'x' ? parseInt(t.Gol, 10) : 0
      });
    }
    return list;
  },

  /**
   * Calcola la formazione ideale, il Best Parziale e il modulo ottimale per un singolo tabellino squadra
   */
  calculateTeamIdealLineup(tabellino) {
    if (!tabellino || !Array.isArray(tabellino.players)) {
      return null;
    }

    const players = tabellino.players;
    const realStarters = players.filter(p => p.isStarter);

    // Modulo reale schierato (conteggio D, C, A tra i titolari effettivi)
    let realD = 0, realC = 0, realA = 0;
    realStarters.forEach(p => {
      if (p.role === 2) realD++;
      else if (p.role === 3) realC++;
      else if (p.role === 4) realA++;
    });
    const realModule = (realD > 0 || realC > 0 || realA > 0) ? `${realD}-${realC}-${realA}` : '0-0-0';
    const realPartial = typeof tabellino.partialScore === 'number' ? tabellino.partialScore : parseFloat(tabellino.partialScore) || 0;

    // Giocatori con voto valido tra tutta la rosa a referto (titolari, panchina e tribuna)
    const validPlayers = [];
    players.forEach(p => {
      if (!p.isAbsent && this.isValidVote(p.totVote)) {
        validPlayers.push({
          ...p,
          totNum: this.parseVoteNum(p.totVote),
          rawNum: this.parseVoteNum(p.rawVote)
        });
      }
    });

    const votiCount = validPlayers.length;

    // Raggruppa per ruolo e ordina per totale decrescente (per Max) e crescente (per Min)
    const pByRole = {
      1: validPlayers.filter(p => p.role === 1).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      2: validPlayers.filter(p => p.role === 2).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      3: validPlayers.filter(p => p.role === 3).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      4: validPlayers.filter(p => p.role === 4).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum)
    };

    const pByRoleAsc = {
      1: validPlayers.filter(p => p.role === 1).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      2: validPlayers.filter(p => p.role === 2).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      3: validPlayers.filter(p => p.role === 3).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      4: validPlayers.filter(p => p.role === 4).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum)
    };

    let bestMax = -1;
    let bestModules = [];
    let bestLineup = [];
    let bestLineupsByModule = {};

    let worstMin = 999;
    let worstModules = [];

    // Testa tutti i moduli ammessi
    for (const mod of this.allowedModules) {
      const [reqD, reqC, reqA] = mod;

      // Un portiere, reqD difensori, reqC centrocampisti, reqA attaccanti
      if (pByRole[1].length < 1 ||
        pByRole[2].length < reqD ||
        pByRole[3].length < reqC ||
        pByRole[4].length < reqA) {
        // Se non ci sono abbastanza giocatori con voto valido per completare il modulo senza RU,
        // verifica se il totale parziale reale è comunque raggiungibile
        continue;
      }

      const selectedP = pByRole[1].slice(0, 1);
      const selectedD = pByRole[2].slice(0, reqD);
      const selectedC = pByRole[3].slice(0, reqC);
      const selectedA = pByRole[4].slice(0, reqA);

      const currentLineup = [...selectedP, ...selectedD, ...selectedC, ...selectedA];
      let currentSum = 0;
      currentLineup.forEach(p => { currentSum += p.totNum; });
      currentSum = Math.round(currentSum * 100) / 100;

      const modStr = `${reqD}-${reqC}-${reqA}`;
      if (currentSum > bestMax) {
        bestMax = currentSum;
        bestModules = [modStr];
        bestLineup = currentLineup;
        bestLineupsByModule = { [modStr]: currentLineup };
      } else if (currentSum === bestMax && bestMax > -1) {
        bestModules.push(modStr);
        bestLineupsByModule[modStr] = currentLineup;
      }

      // Calcola peggior modulo teorico (Min)
      const minLineup = [
        ...pByRoleAsc[1].slice(0, 1),
        ...pByRoleAsc[2].slice(0, reqD),
        ...pByRoleAsc[3].slice(0, reqC),
        ...pByRoleAsc[4].slice(0, reqA)
      ];
      let minSum = 0;
      minLineup.forEach(p => { minSum += p.totNum; });
      minSum = Math.round(minSum * 100) / 100;
      if (minSum < worstMin) {
        worstMin = minSum;
        worstModules = [modStr];
      } else if (minSum === worstMin) {
        worstModules.push(modStr);
      }
    }

    // Se nessun modulo è stato completato interamente (es. troppe assenze), il Max coincide con il parziale reale
    if (bestMax < realPartial || bestMax < 0) {
      bestMax = realPartial;
      bestModules = [realModule];
      bestLineup = realStarters;
      bestLineupsByModule = { [realModule]: realStarters };
    }

    if (worstMin === 999 || worstMin > realPartial) {
      worstMin = realPartial;
      worstModules = [realModule];
    }

    const scarto = Math.max(0, Math.round((bestMax - realPartial) * 100) / 100);

    // Scarto su voti pesato: Scarto / (Voti - 11) se Voti > 11, altrimenti 999
    let scSuVoti = 999;
    if (votiCount > 11) {
      scSuVoti = Math.round((scarto / (votiCount - 11)) * 100) / 100;
    }

    // % Best della singola partita (formula ufficiale FantaMister)
    const matchBestPct = (bestMax === worstMin)
      ? 100
      : Math.max(0, Math.min(100, Math.round(((realPartial - worstMin) / (bestMax - worstMin)) * 10000) / 100));

    return {
      teamId: tabellino.teamId,
      matchId: tabellino.matchId,
      realPartial,
      realModule,
      bestMax,
      worstMin,
      matchBestPct,
      bestModule: bestModules.join(' '),
      bestModules,
      worstModule: worstModules.join(' '),
      scarto,
      votiCount,
      scSuVoti,
      starters: realStarters,
      idealLineup: bestLineup,
      optimalLineupsByModule: bestLineupsByModule
    };
  },

  /**
   * Assegna i fantamarcatori per una squadra che ha segnato N gol nell'incontro
   * secondo l'algoritmo ufficiale FantaMister (-3 pt a ogni gol + tie-breakers).
   * I portieri (ruolo 1 / 'P') sono categoricamente esclusi dai fantamarcatori.
   */
  assignTeamScorers(starters, goalsToAssign, teamCumulativeScorers = {}) {
    const goalsCount = parseInt(goalsToAssign, 10) || 0;
    if (goalsCount <= 0 || !Array.isArray(starters) || starters.length === 0) {
      return [];
    }

    // In FantaMister / Fantabomber i gol vengono attribuiti esclusivamente ai calciatori di movimento (D, C, A)
    const outfieldStarters = starters.filter(p => {
      const r = p.role !== undefined ? p.role : (p.ruolo !== undefined ? p.ruolo : p.roleNum);
      const rStr = String(r !== undefined && r !== null ? r : '').trim().toUpperCase();
      const rRaw = String(p.roleRaw || p.roleLabel || '').trim().toUpperCase();
      return rStr !== '1' && rStr !== 'P' && rStr !== 'PO' && rRaw !== 'P' && rRaw !== 'PORTIERE' && rRaw !== 'PO';
    });

    const candidatePool = outfieldStarters.length > 0 ? outfieldStarters : starters;

    // Prepara i candidati
    const candidates = candidatePool.map((p, idx) => ({
      id: p.id,
      name: p.name,
      club: p.club || '',
      role: p.role !== undefined ? p.role : (p.ruolo !== undefined ? p.ruolo : p.roleNum),
      roleRaw: p.roleRaw || p.roleLabel || '',
      rawVote: this.parseVoteNum(p.rawVote !== undefined ? p.rawVote : p.voto, 0),
      currentTot: this.parseVoteNum(p.totVote !== undefined ? p.totVote : (p.totNum !== undefined ? p.totNum : p.fantavoto), 0),
      originalIndex: idx,
      goalsAssigned: 0,
      previousGoals: teamCumulativeScorers[p.id] || 0
    }));

    const assigned = [];

    for (let g = 0; g < goalsCount; g++) {
      // Ordina per:
      // 1. currentTot decrescente
      // 2. VA (rawVote) decrescente
      // 3. Ruolo: D (2) > C (3) > A (4)
      // 4. MG: minor numero di gol segnati in precedenza
      // 5. Ordine di inserimento in formazione (originalIndex)
      candidates.sort((a, b) => {
        if (b.currentTot !== a.currentTot) return b.currentTot - a.currentTot;
        if (b.rawVote !== a.rawVote) return b.rawVote - a.rawVote;

        // Ruolo: prioritario D (2) poi C (3) poi A (4)
        const roleOrder = { 2: 1, 'D': 1, 3: 2, 'C': 2, 4: 3, 'A': 3 };
        const rA = roleOrder[a.role] || 4;
        const rB = roleOrder[b.role] || 4;
        if (rA !== rB) return rA - rB;

        // MG: chi ha meno gol prima
        if (a.previousGoals !== b.previousGoals) return a.previousGoals - b.previousGoals;

        // Ordine di formazione
        return a.originalIndex - b.originalIndex;
      });

      const scorer = candidates[0];
      if (!scorer) break;
      assigned.push({
        id: scorer.id,
        name: scorer.name,
        role: scorer.role,
        club: scorer.club
      });

      scorer.goalsAssigned++;
      scorer.previousGoals++;
      // Sottrai 3.0 punti per il prossimo gol
      scorer.currentTot -= 3.0;
    }

    return assigned;
  },

  /**
   * Determina il Migliore in Campo (Uomo Partita) dell'incontro tra i 22 titolari
   */
  determineManOfTheMatch(homeStarters, awayStarters, homeScore, awayScore) {
    const all = [];

    (homeStarters || []).forEach(p => {
      all.push({
        ...p,
        isHome: true,
        isWinningTeam: homeScore > awayScore,
        totNum: this.parseVoteNum(p.totVote, 0),
        rawNum: this.parseVoteNum(p.rawVote, 0)
      });
    });

    (awayStarters || []).forEach(p => {
      all.push({
        ...p,
        isHome: false,
        isWinningTeam: awayScore > homeScore,
        totNum: this.parseVoteNum(p.totVote, 0),
        rawNum: this.parseVoteNum(p.rawVote, 0)
      });
    });

    if (all.length === 0) return null;

    all.sort((a, b) => {
      // 1. Totale più alto
      if (b.totNum !== a.totNum) return b.totNum - a.totNum;
      // 2. Calciatore della squadra vincente
      if (a.isWinningTeam !== b.isWinningTeam) return a.isWinningTeam ? -1 : 1;
      // 3. Voto assoluto (VA)
      if (b.rawNum !== a.rawNum) return b.rawNum - a.rawNum;
      // 4. Ruolo: D > C > A > P
      const roleOrder = { 2: 1, 3: 2, 4: 3, 1: 4 };
      const rA = roleOrder[a.role] || 5;
      const rB = roleOrder[b.role] || 5;
      if (rA !== rB) return rA - rB;
      // 5. Squadra di casa
      return a.isHome ? -1 : 1;
    });

    return all[0];
  },

  /**
   * Verifica se un record calciatore è un giocatore reale (escludendo Riserva d'ufficio e Assenze)
   */
  isRealPlayer(p) {
    if (!p || p.isAbsent || p.isOfficeReserve) return false;
    const pid = String(p.id || '').trim();
    if (!pid || pid === '0' || pid === '-1' || parseInt(pid, 10) <= 0) return false;
    const pName = String(p.name || p.player || p.rawPlayer || '').trim().toLowerCase();
    if (!pName || pName.includes("riserva d'ufficio") || pName.includes('riserva d`ufficio') || pName.includes('assente') || pName.includes('---')) {
      return false;
    }
    return true;
  },

  /**
   * Calcola la Top 11 e la Flop 11 tra tutti i titolari effettivi scesi in campo nella giornata
   * (escludendo rigorosamente Riserve d'ufficio e Assenze)
   */
  calculateTopFlop11ForMatchday(matchdayTabellini) {
    const fieldedPlayers = [];
    const seenPlayerIds = new Set();

    (matchdayTabellini || []).forEach(tab => {
      const starters = (tab.players || []).filter(p => p.isStarter && this.isRealPlayer(p) && this.isValidVote(p.totVote));
      starters.forEach(p => {
        const dedupKey = String(p.id);
        if (seenPlayerIds.has(dedupKey)) return;
        seenPlayerIds.add(dedupKey);
        fieldedPlayers.push({
          ...p,
          teamId: this.getCurrentPlayerTeamId(p.name, tab.teamId),
          totNum: this.parseVoteNum(p.totVote, 0),
          rawNum: this.parseVoteNum(p.rawVote, 0)
        });
      });
    });

    if (fieldedPlayers.length === 0) {
      return { top11: [], flop11: [], topByModule: {}, flopByModule: {} };
    }

    // TOP 11
    let bestTopSum = -999;
    let bestTopPlayers = [];
    let bestTopModule = '3-4-3';
    const topByModule = {};

    // Raggruppa per ruolo ordinando decrescente per top
    const pByRoleDesc = {
      1: fieldedPlayers.filter(p => p.role === 1).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      2: fieldedPlayers.filter(p => p.role === 2).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      3: fieldedPlayers.filter(p => p.role === 3).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum),
      4: fieldedPlayers.filter(p => p.role === 4).sort((a, b) => b.totNum - a.totNum || b.rawNum - a.rawNum)
    };

    for (const mod of this.allowedModules) {
      const [reqD, reqC, reqA] = mod;
      if (pByRoleDesc[1].length < 1 || pByRoleDesc[2].length < reqD || pByRoleDesc[3].length < reqC || pByRoleDesc[4].length < reqA) {
        continue;
      }
      const p1 = pByRoleDesc[1].slice(0, 1);
      const pD = pByRoleDesc[2].slice(0, reqD);
      const pC = pByRoleDesc[3].slice(0, reqC);
      const pA = pByRoleDesc[4].slice(0, reqA);
      const lineup = [...p1, ...pD, ...pC, ...pA];
      let sum = 0;
      lineup.forEach(p => { sum += p.totNum; });
      const modStr = `${reqD}-${reqC}-${reqA}`;
      topByModule[modStr] = {
        players: lineup,
        module: modStr,
        sum: Math.round(sum * 100) / 100
      };
      if (sum > bestTopSum) {
        bestTopSum = sum;
        bestTopPlayers = lineup;
        bestTopModule = modStr;
      }
    }

    // FLOP 11
    let worstFlopSum = 9999;
    let worstFlopPlayers = [];
    let worstFlopModule = '3-4-3';
    const flopByModule = {};

    // Raggruppa per ruolo ordinando crescente per flop
    const pByRoleAsc = {
      1: fieldedPlayers.filter(p => p.role === 1).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      2: fieldedPlayers.filter(p => p.role === 2).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      3: fieldedPlayers.filter(p => p.role === 3).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum),
      4: fieldedPlayers.filter(p => p.role === 4).sort((a, b) => a.totNum - b.totNum || a.rawNum - b.rawNum)
    };

    for (const mod of this.allowedModules) {
      const [reqD, reqC, reqA] = mod;
      if (pByRoleAsc[1].length < 1 || pByRoleAsc[2].length < reqD || pByRoleAsc[3].length < reqC || pByRoleAsc[4].length < reqA) {
        continue;
      }
      const p1 = pByRoleAsc[1].slice(0, 1);
      const pD = pByRoleAsc[2].slice(0, reqD);
      const pC = pByRoleAsc[3].slice(0, reqC);
      const pA = pByRoleAsc[4].slice(0, reqA);
      const lineup = [...p1, ...pD, ...pC, ...pA];
      let sum = 0;
      lineup.forEach(p => { sum += p.totNum; });
      const modStr = `${reqD}-${reqC}-${reqA}`;
      flopByModule[modStr] = {
        players: lineup,
        module: modStr,
        sum: Math.round(sum * 100) / 100
      };
      if (sum < worstFlopSum) {
        worstFlopSum = sum;
        worstFlopPlayers = lineup;
        worstFlopModule = modStr;
      }
    }

    return {
      top11: bestTopPlayers,
      topModule: bestTopModule,
      topSum: Math.round(bestTopSum * 100) / 100,
      topByModule,
      flop11: worstFlopPlayers,
      flopModule: worstFlopModule,
      flopSum: Math.round(worstFlopSum * 100) / 100,
      flopByModule
    };
  },

  /**
   * Calcola l'analisi completa di una singola giornata di campionato o coppa
   */
  async getMatchdayData(day, options = {}) {
    const d = parseInt(day, 10);
    if (!d || d <= 0) return null;

    let targetCompId = 0;
    let cumulativeScorers = {};
    if (typeof options === 'object' && options !== null) {
      if (options.compId !== undefined) targetCompId = parseInt(options.compId, 10);
      if (options.cumulativeScorers) cumulativeScorers = options.cumulativeScorers;
      else if (!options.compId) cumulativeScorers = options;
    }

    const cacheKey = `${d}_${targetCompId}`;
    if (this._matchdayCache[cacheKey]) {
      return this._matchdayCache[cacheKey];
    }

    await this.ensureModuliAmmessiLoaded();

    const allTabellini = await this.loadMatchdayTabellini(d);
    if (!Array.isArray(allTabellini) || allTabellini.length === 0) {
      return null;
    }

    // Filtra tabellini per competizione se targetCompId è specificato
    let tabellini = allTabellini;
    if (targetCompId > 0) {
      tabellini = allTabellini.filter(tab => {
        if (tab.leagueId && parseInt(tab.leagueId, 10) === targetCompId) return true;
        if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
          const match = arrIncontri.find(inc => inc && inc.ID === tab.matchId);
          if (match && parseInt(match.IDCompetizione, 10) === targetCompId) return true;
        }
        return false;
      });
      // Se nessun tabellino ha matchId esplicito per questa comp, non restringere a vuoto
      if (tabellini.length === 0 && allTabellini.length > 0) {
        tabellini = allTabellini;
      }
    }

    const teamsMap = {};
    const teamsByMatchKey = {};
    const teamsList = [];

    // 1. Analisi formazioni ideali per ogni tabellino
    tabellini.forEach(tab => {
      const ideal = this.calculateTeamIdealLineup(tab);
      if (ideal) {
        const teamName = this.getTeamName(tab.teamId);
        const coach = this.getTeamCoach(tab.teamId);

        let tabCompId = parseInt(tab.leagueId, 10) || 0;
        let tabCompName = '';
        let tabGroupId = 0;
        let tabGroupName = '';
        if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
          const match = arrIncontri.find(inc => inc && inc.ID === tab.matchId);
          if (match) {
            if (match.IDCompetizione) tabCompId = parseInt(match.IDCompetizione, 10);
            if (match.Competizione) tabCompName = String(match.Competizione);
            if (match.IDGirone) tabGroupId = parseInt(match.IDGirone, 10);
            if (match.Girone) tabGroupName = String(match.Girone);
          }
        }
        if (!tabCompName && tabCompId > 0) {
          if (typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni)) {
            const c = arrCompetizioni.find(item => item && item.ID === tabCompId);
            if (c && c.Nome) tabCompName = String(c.Nome);
          } else if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function') {
            const comps = fcmDataLoader.getCompetitions();
            const found = comps.find(c => c.id === tabCompId || c.ID === tabCompId);
            if (found) tabCompName = String(found.name || found.Nome || '');
          }
        }

        const benchPlayers = (tab.players || []).filter(p => !p.isStarter && !p.isAbsent && !p.isOfficeReserve);

        const teamLogo = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function')
          ? fcmDataLoader.getTeamLogo(tab.teamId || teamName)
          : `img/sq/${encodeURI(teamName)}.png`;

        const entry = {
          Nome: teamName,
          teamId: tab.teamId,
          coach,
          logo: teamLogo,
          compId: tabCompId,
          compName: tabCompName || (tabCompId > 0 ? `Comp. ${tabCompId}` : ''),
          groupId: tabGroupId,
          groupName: tabGroupName,
          Scarto: ideal.scarto,
          Voti: ideal.votiCount,
          ScSuVoti: ideal.scSuVoti,
          Parz: ideal.realPartial,
          ModParz: ideal.realModule,
          Max: ideal.bestMax,
          Min: ideal.worstMin,
          matchBestPct: ideal.matchBestPct,
          ModMax: ideal.bestModule,
          bestModules: ideal.bestModules,
          worstModule: ideal.worstModule,
          optimalLineupsByModule: ideal.optimalLineupsByModule,
          starters: ideal.starters,
          bench: benchPlayers,
          idealLineup: ideal.idealLineup,
          matchId: tab.matchId,
          totalScore: (typeof tab.totalScore === 'number' ? tab.totalScore : (parseFloat(tab.totalScore) || ideal.realPartial)),
          total: (typeof tab.totalScore === 'number' ? tab.totalScore : (parseFloat(tab.totalScore) || ideal.realPartial)),
          partial: ideal.realPartial,
          goals: (typeof tab.goals === 'number' ? tab.goals : (parseInt(tab.goals, 10) || 0))
        };

        teamsByMatchKey[`${tab.matchId}_${tab.teamId}`] = entry;
        // Se la squadra gioca più partite nella stessa giornata, in teamsMap diamo priorità al campionato principale (compId === 1)
        if (!teamsMap[tab.teamId] || tabCompId === 1) {
          teamsMap[tab.teamId] = entry;
        }
        teamsList.push(entry);
      }
    });

    // 2. Analisi incontri (marcatori, MoM) basata su arrIncontri ufficiale
    const matchesAnalysis = [];
    const INC_RIPOSO = (typeof window !== 'undefined' && window.INC_RIPOSO !== undefined) ? window.INC_RIPOSO : 2;

    if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
      const calendarMatches = arrIncontri.filter(inc => {
        if (!inc || inc.GiornataDiA !== d) return false;
        if (inc.IDTipo === INC_RIPOSO) return false;
        if (targetCompId > 0 && inc.IDCompetizione !== targetCompId) return false;
        const hasTab = tabellini.some(t => t.matchId === inc.ID);
        if (inc.Giocato !== 1 && !hasTab) return false;
        return true;
      });

      calendarMatches.forEach(inc => {
        const hId = inc.IDSquadre ? inc.IDSquadre.Casa : 0;
        const aId = inc.IDSquadre ? inc.IDSquadre.Fuori : 0;
        const hTab = tabellini.find(t => t.matchId === inc.ID && t.teamId === hId) || tabellini.find(t => t.teamId === hId);
        const aTab = tabellini.find(t => t.matchId === inc.ID && t.teamId === aId) || tabellini.find(t => t.teamId === aId);

        const hStarters = hTab ? (hTab.players || []).filter(p => p.isStarter) : [];
        const aStarters = aTab ? (aTab.players || []).filter(p => p.isStarter) : [];

        const hGoals = inc.Gol ? inc.Gol.Casa : (hTab ? hTab.goals : 0);
        const aGoals = inc.Gol ? inc.Gol.Fuori : (aTab ? aTab.goals : 0);

        const hTot = inc.Totali ? inc.Totali.Casa : (hTab ? hTab.totalScore : 0);
        const aTot = inc.Totali ? inc.Totali.Fuori : (aTab ? aTab.totalScore : 0);

        const hParz = inc.Parziali ? inc.Parziali.Casa : (hTab ? hTab.partialScore : 0);
        const aParz = inc.Parziali ? inc.Parziali.Fuori : (aTab ? aTab.partialScore : 0);

        const homeScorers = this.assignTeamScorers(hStarters, hGoals, cumulativeScorers[hId] || {});
        const awayScorers = this.assignTeamScorers(aStarters, aGoals, cumulativeScorers[aId] || {});

        const mom = this.determineManOfTheMatch(hStarters, aStarters, hTot, aTot);

        let compName = inc.Competizione ? String(inc.Competizione) : '';
        if (!compName && inc.IDCompetizione && typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni)) {
          const cObj = arrCompetizioni.find(c => c && c.ID === inc.IDCompetizione);
          if (cObj && cObj.Nome) compName = String(cObj.Nome);
        }
        let groupName = inc.Girone ? String(inc.Girone) : '';
        if (!groupName && inc.IDGirone && typeof arrGironi !== 'undefined' && Array.isArray(arrGironi)) {
          const gObj = arrGironi.find(g => g && g.ID === inc.IDGirone);
          if (gObj && gObj.Nome) groupName = String(gObj.Nome);
        }

        matchesAnalysis.push({
          matchId: inc.ID,
          compId: inc.IDCompetizione,
          compName: compName,
          groupId: inc.IDGirone,
          groupName: groupName,
          fantagiornataName: inc.Fantagiornata ? String(inc.Fantagiornata) : '',
          matchType: inc.IDTipo,
          homeTeamId: hId,
          awayTeamId: aId,
          homeTeamName: this.getTeamName(hId) || (inc.Nomi && inc.Nomi.Casa) || `Squadra ${hId}`,
          awayTeamName: this.getTeamName(aId) || (inc.Nomi && inc.Nomi.Fuori) || `Squadra ${aId}`,
          homeGoals: hGoals,
          awayGoals: aGoals,
          homeTotal: hTot,
          awayTotal: aTot,
          homePartial: hParz,
          awayPartial: aParz,
          homeScorers,
          awayScorers,
          manOfTheMatch: mom
        });
      });
    }

    // Fallback se nessun match da arrIncontri
    if (matchesAnalysis.length === 0) {
      const matchesMap = {};
      tabellini.forEach(tab => {
        if (!matchesMap[tab.matchId]) matchesMap[tab.matchId] = [];
        matchesMap[tab.matchId].push(tab);
      });

      Object.keys(matchesMap).forEach(mId => {
        const pair = matchesMap[mId];
        if (pair.length >= 2) {
          const home = pair[0];
          const away = pair[1];

          const homeScorers = this.assignTeamScorers(
            home.players ? home.players.filter(p => p.isStarter) : [],
            home.goals,
            cumulativeScorers[home.teamId] || {}
          );

          const awayScorers = this.assignTeamScorers(
            away.players ? away.players.filter(p => p.isStarter) : [],
            away.goals,
            cumulativeScorers[away.teamId] || {}
          );

          const mom = this.determineManOfTheMatch(
            home.players ? home.players.filter(p => p.isStarter) : [],
            away.players ? away.players.filter(p => p.isStarter) : [],
            home.totalScore,
            away.totalScore
          );

          matchesAnalysis.push({
            matchId: mId,
            homeTeamId: home.teamId,
            awayTeamId: away.teamId,
            homeTeamName: this.getTeamName(home.teamId),
            awayTeamName: this.getTeamName(away.teamId),
            homeGoals: home.goals,
            awayGoals: away.goals,
            homeTotal: home.totalScore,
            awayTotal: away.totalScore,
            homePartial: home.partialScore,
            awayPartial: away.partialScore,
            homeScorers,
            awayScorers,
            manOfTheMatch: mom
          });
        }
      });
    }

    // Associa i dati dell'incontro (avversario, gol, totale match) alle singole squadre in teamsMap/teamsList
    if (Array.isArray(matchesAnalysis)) {
      matchesAnalysis.forEach(m => {
        const isLega = (m.compName && m.compName.toLowerCase().includes('lega')) || m.compId === 1;
        if (teamsMap[m.homeTeamId]) {
          const t = teamsMap[m.homeTeamId];
          if (!t.opponentName || (!t.isLega && isLega)) {
            t.opponentTeamId = m.awayTeamId;
            t.opponentName = m.awayTeamName;
            t.opponentGoals = m.awayGoals;
            t.opponentTotal = m.awayTotal;
            t.isHome = true;
            t.isLega = isLega;
            if (m.homeTotal !== undefined && m.homeTotal !== null && !isNaN(m.homeTotal) && m.homeTotal > 0) {
              t.total = typeof m.homeTotal === 'number' ? m.homeTotal : parseFloat(m.homeTotal);
              t.totalScore = t.total;
            }
            if (m.homeGoals !== undefined && m.homeGoals !== null && !isNaN(m.homeGoals)) {
              t.goals = typeof m.homeGoals === 'number' ? m.homeGoals : parseInt(m.homeGoals, 10);
            }
          }
        }
        if (teamsMap[m.awayTeamId]) {
          const t = teamsMap[m.awayTeamId];
          if (!t.opponentName || (!t.isLega && isLega)) {
            t.opponentTeamId = m.homeTeamId;
            t.opponentName = m.homeTeamName;
            t.opponentGoals = m.homeGoals;
            t.opponentTotal = m.homeTotal;
            t.isHome = false;
            t.isLega = isLega;
            if (m.awayTotal !== undefined && m.awayTotal !== null && !isNaN(m.awayTotal) && m.awayTotal > 0) {
              t.total = typeof m.awayTotal === 'number' ? m.awayTotal : parseFloat(m.awayTotal);
              t.totalScore = t.total;
            }
            if (m.awayGoals !== undefined && m.awayGoals !== null && !isNaN(m.awayGoals)) {
              t.goals = typeof m.awayGoals === 'number' ? m.awayGoals : parseInt(m.awayGoals, 10);
            }
          }
        }
      });
    }

    // 3. Top / Flop 11 di giornata
    const { top11, topModule, topSum, topByModule, flop11, flopModule, flopSum, flopByModule } = this.calculateTopFlop11ForMatchday(tabellini);

    // 4. Miglior e Peggior FantaMister di giornata (ordinati per Scarto crescente)
    const sortedByScarto = [...teamsList].sort((a, b) => a.Scarto - b.Scarto);
    const bestMister = sortedByScarto[0] || null;
    const worstMister = sortedByScarto[sortedByScarto.length - 1] || null;

    // Punteggi top e flop reali di giornata (calcolati sul Punteggio Totale effettivo ottenuto; a parità, per parziale puro)
    const sortedByTotal = [...teamsList].sort((a, b) => {
      const totA = (a.total !== undefined ? a.total : (a.totalScore !== undefined ? a.totalScore : a.Parz));
      const totB = (b.total !== undefined ? b.total : (b.totalScore !== undefined ? b.totalScore : b.Parz));
      if (totB !== totA) return totB - totA;
      return b.Parz - a.Parz;
    });
    const topScore = sortedByTotal[0] || null;
    const lowestScore = sortedByTotal[sortedByTotal.length - 1] || null;

    const res = {
      day: d,
      compId: targetCompId,
      teamsMap,
      teamsByMatchKey,
      teamsList,
      list: teamsList,
      ranking: sortedByScarto,
      bestMister,
      worstMister,
      topScore,
      lowestScore,
      matches: matchesAnalysis,
      top11,
      topModule,
      topSum,
      topByModule,
      flop11,
      flopModule,
      flopSum,
      flopByModule
    };

    this._matchdayCache[cacheKey] = res;
    return res;
  },

  /**
   * Calcola l'analisi complessiva della stagione o di una specifica competizione
   */
  async getSeasonData(options = {}) {
    const compId = options.compId !== undefined ? parseInt(options.compId, 10) : this.getDefaultCompId();

    if (this._seasonCache[compId] && !options.forceReload) {
      return this._seasonCache[compId];
    }

    await this.ensureModuliAmmessiLoaded();

    // Determina l'intervallo delle giornate e gli incontri disputati
    const INC_RIPOSO = (typeof window !== 'undefined' && window.INC_RIPOSO !== undefined) ? window.INC_RIPOSO : 2;
    let startDay = 1;
    let endDay = 38;
    let validDays = [];

    if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri) && arrIncontri.length > 1) {
      const compMatches = arrIncontri.filter(inc => {
        if (!inc || inc.Giocato !== 1 || inc.IDTipo === INC_RIPOSO) return false;
        if (compId > 0 && inc.IDCompetizione !== compId) return false;
        return true;
      });

      if (compMatches.length > 0) {
        validDays = [...new Set(compMatches.map(m => m.GiornataDiA).filter(d => d > 0))].sort((a, b) => a - b);
        startDay = validDays[0] || 1;
        endDay = validDays[validDays.length - 1] || 1;
      } else {
        let maxPlayed = 0;
        let minDay = 999;
        for (let i = 1; i < arrIncontri.length; i++) {
          const inc = arrIncontri[i];
          if (inc && inc.GiornataDiA && inc.Giocato === 1) {
            if (inc.GiornataDiA < minDay) minDay = inc.GiornataDiA;
            if (inc.GiornataDiA > maxPlayed) maxPlayed = inc.GiornataDiA;
          }
        }
        if (minDay < 999) startDay = minDay;
        if (maxPlayed > 0) endDay = maxPlayed;
        for (let d = startDay; d <= endDay; d++) validDays.push(d);
      }
    } else if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) {
      const cal = fcmDataLoader.getCalendarData();
      if (cal.lastPlayed > 0) endDay = cal.lastPlayed;
      for (let d = 1; d <= endDay; d++) validDays.push(d);
    } else {
      for (let d = 1; d <= 38; d++) validDays.push(d);
    }

    // Accumulatori stagionali
    const teamStats = {};
    const allScorers = {};
    const cumulativeTeamScorers = {};
    const momCount = {};
    const unstartedStats = {};
    const allFieldedStats = {};
    const matchHistory = [];
    const matchdaysDetails = {}; // Mappa day -> dayData per il tab Dettaglio Giornate

    // Statistiche globali moduli
    const globalModuleCount = {};
    let totalGlobalOptimalModCount = 0;
    const globalModuleSingleCount = {};
    let totalGlobalSingleModCount = 0;

    // Inizializza statistiche per ciascuna fantasquadra attiva
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      for (let i = 1; i < arrFantasquadre.length; i++) {
        const sq = arrFantasquadre[i];
        if (sq) {
          const tId = sq.ID || i;
          teamStats[tId] = {
            teamId: tId,
            name: sq.Nome || sq.nome || `Squadra ${tId}`,
            coach: sq.Presidente || sq.presidente || '',
            matchesCount: 0,
            matchBestSum: 0,
            realPartialSum: 0,
            bestMaxSum: 0,
            scartoSum: 0,
            scSuVotiSum: 0,
            votiSum: 0,
            scartoMax: { value: -1, day: 0 },
            scartoMin: { value: 999, day: 0 },
            modulesUsed: {},
            modulesOptimal: {},
            modulesOptimalSingle: {},
            bonusPositiviTitolari: 0,
            bonusPositiviRosa: 0,
            appearances: {},
            scorers: {},
            pointsConcededSum: 0,
            opponentsAvgExpectedSum: 0
          };
          cumulativeTeamScorers[tId] = {};
        }
      }
    }

    // Calcola sequenzialmente per ogni giornata valida
    for (const day of validDays) {
      const dayData = await this.getMatchdayData(day, { compId, cumulativeScorers: cumulativeTeamScorers });
      if (!dayData) continue;

      matchdaysDetails[day] = dayData;

      // Aggrega i dati di ciascuna squadra
      dayData.teamsList.forEach(item => {
        let ts = teamStats[item.teamId];
        if (!ts) {
          ts = {
            teamId: item.teamId,
            name: item.Nome,
            coach: item.coach,
            matchesCount: 0,
            realPartialSum: 0,
            bestMaxSum: 0,
            scartoSum: 0,
            scSuVotiSum: 0,
            votiSum: 0,
            scartoMax: { value: -1, day: 0 },
            scartoMin: { value: 999, day: 0 },
            modulesUsed: {},
            modulesOptimal: {},
            modulesOptimalSingle: {},
            bonusPositiviTitolari: 0,
            bonusPositiviRosa: 0,
            appearances: {},
            scorers: {},
            pointsConcededSum: 0,
            opponentsAvgExpectedSum: 0
          };
          teamStats[item.teamId] = ts;
          cumulativeTeamScorers[item.teamId] = {};
        }

        ts.matchesCount++;
        ts.matchBestSum += (item.matchBestPct !== undefined ? item.matchBestPct : 100);
        ts.realPartialSum += item.Parz;
        ts.bestMaxSum += item.Max;
        ts.scartoSum += item.Scarto;
        ts.votiSum += item.Voti;
        if (item.ScSuVoti !== 999) {
          ts.scSuVotiSum += item.ScSuVoti;
        }

        if (item.Scarto > ts.scartoMax.value) {
          ts.scartoMax = { value: item.Scarto, day };
        }
        if (item.Scarto < ts.scartoMin.value) {
          ts.scartoMin = { value: item.Scarto, day };
        }

        // Moduli reali utilizzati
        const mReal = item.ModParz;
        ts.modulesUsed[mReal] = (ts.modulesUsed[mReal] || 0) + 1;

        // Moduli ottimali
        const optList = (item.ModMax || '').trim().split(/\s+/).filter(Boolean);
        optList.forEach(mOpt => {
          ts.modulesOptimal[mOpt] = (ts.modulesOptimal[mOpt] || 0) + 1;
          globalModuleCount[mOpt] = (globalModuleCount[mOpt] || 0) + 1;
          totalGlobalOptimalModCount++;
        });

        // Modulo ottimale assoluto (giornata con UN SOLO miglior modulo univoco)
        if (optList.length === 1) {
          const sMod = optList[0];
          ts.modulesOptimalSingle[sMod] = (ts.modulesOptimalSingle[sMod] || 0) + 1;
          globalModuleSingleCount[sMod] = (globalModuleSingleCount[sMod] || 0) + 1;
          totalGlobalSingleModCount++;
        }
      });

      // Aggrega presenze, subentri, bonus positivi e incompresi dai tabellini
      const tabellini = await this.loadMatchdayTabellini(day);
      (tabellini || []).forEach(tab => {
        // Se targetCompId > 0, consideriamo solo tabellini pertinenti
        if (compId > 0) {
          if (tab.leagueId && parseInt(tab.leagueId, 10) !== compId) return;
          if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
            const match = arrIncontri.find(inc => inc && inc.ID === tab.matchId);
            if (match && parseInt(match.IDCompetizione, 10) !== compId) return;
          }
        }

        const ts = teamStats[tab.teamId];
        (tab.players || []).forEach(p => {
          if (!this.isRealPlayer(p)) return;

          const pTot = this.parseVoteNum(p.totVote, 0);
          const hasValidVote = !p.isAbsent && this.isValidVote(p.totVote);

          // Calcolo bonus positivi individuali del calciatore (> 0)
          // Si considerano esclusivamente i bonus individuali dei calciatori (es. gol +3, assist +1, rigore parato +3),
          // escludendo rigorosamente fattori di squadra (fattore campo, modificatore difesa, etc.)
          const mVal = this.parseVoteNum(p.bonusMalus, 0);
          if (ts && mVal > 0 && hasValidVote) {
            ts.bonusPositiviRosa += mVal;
            if (p.isStarter) {
              ts.bonusPositiviTitolari += mVal;
            }
          }

          // Statistiche presenze per la squadra
          if (ts) {
            if (!ts.appearances[p.id]) {
              ts.appearances[p.id] = {
                id: p.id,
                name: p.name,
                role: p.role,
                club: p.club || '',
                titolare: 0,
                subentrato: 0,
                sostituito: 0
              };
            }
            if (p.isStarter && !p.isSubbedIn) ts.appearances[p.id].titolare++;
            else if (p.isStarter && p.isSubbedIn) ts.appearances[p.id].subentrato++;
            else if (p.isSubbedOut) {
              ts.appearances[p.id].titolare++;
              ts.appearances[p.id].sostituito++;
            }
          }

          // Top/Flop stagionale (calciatori titolari effettivi scesi in campo)
          if (p.isStarter && hasValidVote) {
            const curTeamId = this.getCurrentPlayerTeamId(p.name, tab.teamId);
            if (!allFieldedStats[p.id]) {
              allFieldedStats[p.id] = {
                id: p.id,
                name: p.name,
                role: p.role,
                club: p.club || '',
                teamId: curTeamId,
                appearances: 0,
                sumTot: 0
              };
            } else {
              allFieldedStats[p.id].teamId = curTeamId;
              if (p.club) allFieldedStats[p.id].club = p.club;
            }
            allFieldedStats[p.id].appearances++;
            allFieldedStats[p.id].sumTot += pTot;
          }

          // Incompresi (giocatori a riposo: panchina non entrata o tribuna con voto valido)
          if ((p.isBench || p.isTribuna) && !p.isStarter && hasValidVote) {
            const curTeamId = this.getCurrentPlayerTeamId(p.name, tab.teamId);
            if (!unstartedStats[p.id]) {
              unstartedStats[p.id] = {
                id: p.id,
                name: p.name,
                role: p.role,
                club: p.club || '',
                teamId: curTeamId,
                teamName: this.getTeamName(curTeamId),
                count: 0,
                sum: 0
              };
            } else {
              unstartedStats[p.id].teamId = curTeamId;
              unstartedStats[p.id].teamName = this.getTeamName(curTeamId);
              if (p.club) unstartedStats[p.id].club = p.club;
            }
            unstartedStats[p.id].count++;
            unstartedStats[p.id].sum += pTot;
          }
        });
      });

      // Aggrega marcatori e uomini partita dagli incontri ufficiali
      (dayData.matches || []).forEach(m => {
        matchHistory.push({ ...m, day });

        // Marcatori casa
        (m.homeScorers || []).forEach(sc => {
          const curTeamId = this.getCurrentPlayerTeamId(sc.name, m.homeTeamId);
          if (!allScorers[sc.id]) {
            allScorers[sc.id] = { id: sc.id, name: sc.name, role: sc.role, club: sc.club, teamId: curTeamId, goals: 0 };
          } else {
            allScorers[sc.id].teamId = curTeamId;
          }
          allScorers[sc.id].goals++;
          if (teamStats[m.homeTeamId]) {
            teamStats[m.homeTeamId].scorers[sc.id] = (teamStats[m.homeTeamId].scorers[sc.id] || 0) + 1;
            cumulativeTeamScorers[m.homeTeamId][sc.id] = (cumulativeTeamScorers[m.homeTeamId][sc.id] || 0) + 1;
          }
        });

        // Marcatori trasferta
        (m.awayScorers || []).forEach(sc => {
          const curTeamId = this.getCurrentPlayerTeamId(sc.name, m.awayTeamId);
          if (!allScorers[sc.id]) {
            allScorers[sc.id] = { id: sc.id, name: sc.name, role: sc.role, club: sc.club, teamId: curTeamId, goals: 0 };
          } else {
            allScorers[sc.id].teamId = curTeamId;
          }
          allScorers[sc.id].goals++;
          if (teamStats[m.awayTeamId]) {
            teamStats[m.awayTeamId].scorers[sc.id] = (teamStats[m.awayTeamId].scorers[sc.id] || 0) + 1;
            cumulativeTeamScorers[m.awayTeamId][sc.id] = (cumulativeTeamScorers[m.awayTeamId][sc.id] || 0) + 1;
          }
        });

        // Man of the Match
        if (m.manOfTheMatch) {
          const mom = m.manOfTheMatch;
          const momTeamId = mom.isHome ? m.homeTeamId : m.awayTeamId;
          const curTeamId = this.getCurrentPlayerTeamId(mom.name, momTeamId);
          if (!momCount[mom.id]) {
            momCount[mom.id] = { id: mom.id, name: mom.name, role: mom.role, club: mom.club, teamId: curTeamId, count: 0 };
          } else {
            momCount[mom.id].teamId = curTeamId;
          }
          momCount[mom.id].count++;
        }
      });
    }

    // 1. Calcola Fantasfiga basata rigorosamente sul parziale puro delle fantasquadre avversarie (senza modificatori)
    const teamsAvgPartial = {};
    Object.keys(teamStats).forEach(tId => {
      const ts = teamStats[tId];
      let totalPartial = 0;
      let count = 0;
      matchHistory.forEach(m => {
        if (m.homeTeamId === ts.teamId) { totalPartial += (m.homePartial || 0); count++; }
        else if (m.awayTeamId === ts.teamId) { totalPartial += (m.awayPartial || 0); count++; }
      });
      teamsAvgPartial[tId] = count > 0 ? (totalPartial / count) : 0;
    });

    const fantasfigaAccumulator = {};
    Object.keys(teamStats).forEach(tId => { fantasfigaAccumulator[tId] = { sumDelta: 0, count: 0 }; });

    matchHistory.forEach(m => {
      if (fantasfigaAccumulator[m.homeTeamId]) {
        const expected = teamsAvgPartial[m.awayTeamId] || 0;
        const actual = m.awayPartial || 0;
        fantasfigaAccumulator[m.homeTeamId].sumDelta += (actual - expected);
        fantasfigaAccumulator[m.homeTeamId].count++;
      }
      if (fantasfigaAccumulator[m.awayTeamId]) {
        const expected = teamsAvgPartial[m.homeTeamId] || 0;
        const actual = m.homePartial || 0;
        fantasfigaAccumulator[m.awayTeamId].sumDelta += (actual - expected);
        fantasfigaAccumulator[m.awayTeamId].count++;
      }
    });

    const fantasfigaRanking = Object.keys(teamStats).map(tId => {
      const ts = teamStats[tId];
      const acc = fantasfigaAccumulator[tId] || { sumDelta: 0, count: 1 };
      const diff = acc.count > 0 ? (acc.sumDelta / acc.count) : 0;
      return {
        teamId: ts.teamId,
        Nome: ts.name,
        coach: ts.coach,
        diff: Math.round(diff * 100) / 100
      };
    }).sort((a, b) => b.diff - a.diff);

    // 2. Classifica FantaMister Unificata e Calcolo Index %
    const rankingFm = Object.keys(teamStats).map(tId => {
      const ts = teamStats[tId];
      const n = ts.matchesCount > 0 ? ts.matchesCount : 1;
      const scartoMedio = Math.round((ts.scartoSum / n) * 100) / 100;
      // Formula ufficiale Scarto Medio Pesato FantaMister (Scarto complessivo / Voti validi eccedenti gli 11)
      const excessVotes = ts.votiSum - 11 * n;
      const scartoMedioPesato = excessVotes > 0
        ? Math.round((ts.scartoSum / excessVotes) * 1000) / 1000
        : (ts.scSuVotiSum > 0 ? Math.round((ts.scSuVotiSum / n) * 1000) / 1000 : 0);
      const mediaVoti = Math.round((ts.votiSum / n) * 10) / 10;
      // Formula ufficiale % Best (media aritmetica del rendimento di ciascuna gara disputata)
      const percentBest = n > 0 ? Math.round((ts.matchBestSum / n) * 100) / 100 : 0;
      const bestRoseMedio = Math.round((ts.bestMaxSum / n) * 100) / 100;

      // Ranking Combinato Rendimento (Index % ufficiale FantaMister)
      // Combina la media % Best con l'indice di rendimento pesato
      const rendimentoPesatoPct = Math.max(0, 108 - (scartoMedioPesato * 27.6));
      const rankingCombinato = Math.round(((percentBest + rendimentoPesatoPct) / 2) * 100) / 100;

      // % Bonus Positivi Titolari e Media Bonus/Partite
      const percentBonusTitolari = ts.bonusPositiviRosa > 0
        ? Math.round((ts.bonusPositiviTitolari / ts.bonusPositiviRosa) * 1000) / 10
        : 100;
      const mediaBonusPartita = ts.matchesCount > 0
        ? Math.round((ts.bonusPositiviTitolari / ts.matchesCount) * 100) / 100
        : 0;

      return {
        teamId: ts.teamId,
        Nome: ts.name,
        coach: ts.coach,
        partite: ts.matchesCount,
        scartoMedio,
        scartoMedioPesato,
        mediaVoti,
        percentBest,
        bestRoseMedio,
        rankingCombinato,
        percentBonusTitolari,
        mediaBonusPartita,
        bonusPositiviTitolari: Math.round(ts.bonusPositiviTitolari * 100) / 100,
        bonusPositiviRosa: Math.round(ts.bonusPositiviRosa * 100) / 100,
        scartoMax: ts.scartoMax,
        scartoMin: ts.scartoMin,
        modulesUsed: ts.modulesUsed,
        modulesOptimal: ts.modulesOptimal,
        modulesOptimalSingle: ts.modulesOptimalSingle
      };
    });

    // Medie di lega per i bonus
    let sumPctBonus = 0, sumMediaBonus = 0;
    rankingFm.forEach(r => {
      sumPctBonus += r.percentBonusTitolari;
      sumMediaBonus += r.mediaBonusPartita;
    });
    const mediaLegaPercentBonus = rankingFm.length > 0 ? Math.round((sumPctBonus / rankingFm.length) * 10) / 10 : 0;
    const mediaLegaBonusPartita = rankingFm.length > 0 ? Math.round((sumMediaBonus / rankingFm.length) * 100) / 100 : 0;

    // Statistiche globali migliori moduli
    const globaleMiglioriModuli = Object.keys(globalModuleCount).map(mod => ({
      modulo: mod,
      count: globalModuleCount[mod],
      percent: totalGlobalOptimalModCount > 0 ? Math.round((globalModuleCount[mod] / totalGlobalOptimalModCount) * 1000) / 10 : 0
    })).sort((a, b) => b.count - a.count || b.percent - a.percent);

    const globaleMiglioriModuliAssoluto = Object.keys(globalModuleSingleCount).map(mod => ({
      modulo: mod,
      count: globalModuleSingleCount[mod],
      percent: totalGlobalSingleModCount > 0 ? Math.round((globalModuleSingleCount[mod] / totalGlobalSingleModCount) * 1000) / 10 : 0
    })).sort((a, b) => b.count - a.count || b.percent - a.percent);

    // Graduatorie specifiche
    const bestRoseRanking = [...rankingFm].sort((a, b) => b.bestRoseMedio - a.bestRoseMedio);
    const rendimentoPesatoRanking = [...rankingFm].sort((a, b) => a.scartoMedioPesato - b.scartoMedioPesato);
    const rendimentoBestRanking = [...rankingFm].sort((a, b) => b.percentBest - a.percentBest);
    const rankingCombinatoRanking = [...rankingFm].sort((a, b) => b.rankingCombinato - a.rankingCombinato);
    const bonusTitolariRanking = [...rankingFm].sort((a, b) => b.percentBonusTitolari - a.percentBonusTitolari);
    const mediaBonusRanking = [...rankingFm].sort((a, b) => b.mediaBonusPartita - a.mediaBonusPartita);

    // 6. Classifica Cannonieri
    const cannonieriRanking = Object.values(allScorers).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

    // 7. Classifica Uomini Partita
    const momRanking = Object.values(momCount).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    // 8. Incompresi per Media e per Totale
    const incompresiList = Object.values(unstartedStats).map(p => ({
      ...p,
      avg: Math.round((p.sum / p.count) * 100) / 100
    }));

    let totalUnstartedVotes = 0;
    incompresiList.forEach(p => { totalUnstartedVotes += p.count; });
    const avgUnstartedCount = incompresiList.length > 0 ? (totalUnstartedVotes / incompresiList.length) : 0;
    // Calcolo dinamico della soglia minima di assenze basato sulla media reale (senza limiti fissi a 8 che bloccano le stagioni brevi/nuove)
    const minAssenze = Math.max(1, Math.floor(avgUnstartedCount));

    // Per Media: media >= 6.00 e numero di presenze da escluso >= alla media di tutti i calciatori (o almeno 1)
    const incompresiMedia = incompresiList
      .filter(p => p.avg >= 6.00 && p.count >= minAssenze)
      .sort((a, b) => b.avg - a.avg || b.count - a.count);

    // Per Totale: ordinati per fantavoti accumulati e sprecati fuori dalla formazione titolare con media >= 6.00
    const incompresiTotale = incompresiList
      .filter(p => p.avg >= 6.00 && p.count >= 1)
      .sort((a, b) => b.sum - a.sum || b.avg - a.avg);

    // 9. Top 11 e Flop 11 Stagione (almeno 50% delle partite disputate come da regolamento ufficiale)
    const minSeasonAppearances = Math.max(1, Math.floor(validDays.length * 0.50));
    const fieldedList = Object.values(allFieldedStats);

    const seasonEligible = fieldedList
      .filter(p => p.appearances >= minSeasonAppearances)
      .map(p => ({
        ...p,
        avgTot: Math.round((p.sumTot / p.appearances) * 100) / 100
      }));

    const topByRoleSeason = {
      1: seasonEligible.filter(p => p.role === 1).sort((a, b) => b.avgTot - a.avgTot),
      2: seasonEligible.filter(p => p.role === 2).sort((a, b) => b.avgTot - a.avgTot),
      3: seasonEligible.filter(p => p.role === 3).sort((a, b) => b.avgTot - a.avgTot),
      4: seasonEligible.filter(p => p.role === 4).sort((a, b) => b.avgTot - a.avgTot)
    };

    let bestSeasonTopSum = -999;
    let bestSeasonTopPlayers = [];
    let bestSeasonTopMod = '3-4-3';
    const topSeasonByModule = {};

    for (const mod of this.allowedModules) {
      const [reqD, reqC, reqA] = mod;
      if (topByRoleSeason[1].length < 1 || topByRoleSeason[2].length < reqD || topByRoleSeason[3].length < reqC || topByRoleSeason[4].length < reqA) continue;
      const p1 = topByRoleSeason[1].slice(0, 1);
      const pD = topByRoleSeason[2].slice(0, reqD);
      const pC = topByRoleSeason[3].slice(0, reqC);
      const pA = topByRoleSeason[4].slice(0, reqA);
      const lineup = [...p1, ...pD, ...pC, ...pA];
      let sum = 0;
      lineup.forEach(p => { sum += p.avgTot; });
      const modStr = `${reqD}-${reqC}-${reqA}`;
      topSeasonByModule[modStr] = {
        players: lineup,
        module: modStr,
        sum: Math.round(sum * 100) / 100
      };
      if (sum > bestSeasonTopSum) {
        bestSeasonTopSum = sum;
        bestSeasonTopPlayers = lineup;
        bestSeasonTopMod = modStr;
      }
    }

    const flopByRoleSeason = {
      1: seasonEligible.filter(p => p.role === 1).sort((a, b) => a.avgTot - b.avgTot),
      2: seasonEligible.filter(p => p.role === 2).sort((a, b) => a.avgTot - b.avgTot),
      3: seasonEligible.filter(p => p.role === 3).sort((a, b) => a.avgTot - b.avgTot),
      4: seasonEligible.filter(p => p.role === 4).sort((a, b) => a.avgTot - b.avgTot)
    };

    let worstSeasonFlopSum = 9999;
    let worstSeasonFlopPlayers = [];
    let worstSeasonFlopMod = '3-4-3';
    const flopSeasonByModule = {};

    for (const mod of this.allowedModules) {
      const [reqD, reqC, reqA] = mod;
      if (flopByRoleSeason[1].length < 1 || flopByRoleSeason[2].length < reqD || flopByRoleSeason[3].length < reqC || flopByRoleSeason[4].length < reqA) continue;
      const p1 = flopByRoleSeason[1].slice(0, 1);
      const pD = flopByRoleSeason[2].slice(0, reqD);
      const pC = flopByRoleSeason[3].slice(0, reqC);
      const pA = flopByRoleSeason[4].slice(0, reqA);
      const lineup = [...p1, ...pD, ...pC, ...pA];
      let sum = 0;
      lineup.forEach(p => { sum += p.avgTot; });
      const modStr = `${reqD}-${reqC}-${reqA}`;
      flopSeasonByModule[modStr] = {
        players: lineup,
        module: modStr,
        sum: Math.round(sum * 100) / 100
      };
      if (sum < worstSeasonFlopSum) {
        worstSeasonFlopSum = sum;
        worstSeasonFlopPlayers = lineup;
        worstSeasonFlopMod = modStr;
      }
    }

    const res = {
      compId,
      startDay,
      endDay,
      validDays,
      teamStats,
      rankingFm,
      bestRoseRanking,
      rendimentoPesatoRanking,
      rendimentoBestRanking,
      rankingCombinatoRanking,
      bonusTitolariRanking,
      mediaBonusRanking,
      mediaLegaPercentBonus,
      mediaLegaBonusPartita,
      globaleMiglioriModuli,
      globaleMiglioriModuliAssoluto,
      matchdaysDetails,
      cannonieriRanking,
      momRanking,
      incompresiMedia,
      incompresiTotale,
      fantasfigaRanking,
      matchHistory,
      minSeasonAppearances,
      top11Season: {
        players: bestSeasonTopPlayers,
        module: bestSeasonTopMod,
        sum: Math.round(bestSeasonTopSum * 100) / 100,
        byModule: topSeasonByModule
      },
      flop11Season: {
        players: worstSeasonFlopPlayers,
        module: worstSeasonFlopMod,
        sum: Math.round(worstSeasonFlopSum * 100) / 100,
        byModule: flopSeasonByModule
      }
    };

    this._seasonCache[compId] = res;
    return res;
  },

  /**
   * Helper per ottenere le statistiche complete di una singola fantasquadra
   */
  async getTeamStats(teamId, compId = 0) {
    const season = await this.getSeasonData({ compId });
    if (!season || !season.teamStats) return null;
    const tId = parseInt(teamId, 10);
    return season.teamStats[tId] || null;
  },

  /**
   * Bridge compatibile con fcmDataLoader.loadFantamisterDay(day)
   */
  async getFantamisterDay(day = null, compId = 0) {
    let targetDay = day;
    if (!targetDay) {
      if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) {
        const cal = fcmDataLoader.getCalendarData();
        targetDay = cal.lastPlayed > 0 ? cal.lastPlayed : 1;
      } else {
        targetDay = 1;
      }
    }
    const data = await this.getMatchdayData(targetDay, { compId });
    if (!data) return null;

    return {
      day: data.day,
      list: data.teamsList,
      teamsList: data.teamsList,
      ranking: data.ranking,
      bestMister: data.bestMister,
      worstMister: data.worstMister,
      topScore: data.topScore,
      lowestScore: data.lowestScore,
      matches: data.matches
    };
  },

  /**
   * Bridge compatibile con fcmDataLoader.loadTopFlop11() e fantamView
   */
  async getTopFlop11(targetDay = null, compId = 0) {
    // Trasforma i calciatori nel formato arricchito atteso da homeView e fantamView
    const formatPlayer = (p, isFlop = false) => {
      let roleLetter = 'P';
      if (p.role === 2) roleLetter = 'D';
      else if (p.role === 3) roleLetter = 'C';
      else if (p.role === 4) roleLetter = 'A';

      const fantasyTeam = this.getTeamName(p.teamId);

      let serieALogo = '';
      if (p.club && typeof fcmDataLoader !== 'undefined') {
        if (typeof fcmDataLoader.getSerieALogo === 'function') {
          serieALogo = fcmDataLoader.getSerieALogo(p.club);
        } else if (typeof fcmDataLoader.getClubBadge === 'function') {
          serieALogo = fcmDataLoader.getClubBadge(p.club);
        }
      }

      let photo = 'img/foto/misterx.gif';
      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function') {
        photo = fcmDataLoader.getPlayerPhoto(p.name);
      }

      const voteVal = p.totNum !== undefined ? p.totNum : (p.avgTot !== undefined ? p.avgTot : (p.totVote || '-'));

      return {
        role: roleLetter,
        roleClass: `role-${roleLetter.toLowerCase()}`,
        rawPlayer: p.name,
        player: p.name,
        fullName: p.name,
        surname: typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.extractSurname(p.name) : p.name,
        firstName: '',
        id: p.id,
        teamId: p.teamId,
        club: p.club || '',
        serieATeam: p.club || '',
        serieALogo: serieALogo || (p.club ? `img/sq/${p.club}.png` : ''),
        photo,
        link: (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) ? fcmDataLoader.getPlayerProfileLink({ name: p.name, id: p.id }) : `#schede_giocatori?name=${encodeURIComponent(p.name)}`,
        fantasyTeam,
        vote: typeof voteVal === 'number' ? voteVal.toFixed(2) : String(voteVal),
        appearances: p.appearances || 0,
        isFlop
      };
    };

    const formatByModuleMap = (rawMap, isFlop = false) => {
      const out = {};
      if (!rawMap || typeof rawMap !== 'object') return out;
      Object.keys(rawMap).forEach(modKey => {
        const entry = rawMap[modKey];
        if (entry && Array.isArray(entry.players)) {
          out[modKey] = {
            module: entry.module || modKey,
            sum: entry.sum || 0,
            players: entry.players.map(p => formatPlayer(p, isFlop))
          };
        }
      });
      return out;
    };

    if (targetDay === 'season' || targetDay === 'stagione') {
      const seasonData = await this.getSeasonData({ compId });
      if (!seasonData) {
        return { top11: [], flop11: [], topModule: '3-4-3', flopModule: '3-4-3', topSum: 0, flopSum: 0, topByModule: {}, flopByModule: {} };
      }
      return {
        top11: (seasonData.top11Season.players || []).map(p => formatPlayer(p, false)),
        flop11: (seasonData.flop11Season.players || []).map(p => formatPlayer(p, true)),
        topModule: seasonData.top11Season.module,
        flopModule: seasonData.flop11Season.module,
        topSum: seasonData.top11Season.sum,
        flopSum: seasonData.flop11Season.sum,
        topByModule: formatByModuleMap(seasonData.top11Season.byModule, false),
        flopByModule: formatByModuleMap(seasonData.flop11Season.byModule, true),
        minAppearances: seasonData.minSeasonAppearances
      };
    }

    let day = targetDay;
    if (!day) {
      if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCalendarData) {
        const cal = fcmDataLoader.getCalendarData();
        day = cal.lastPlayed > 0 ? cal.lastPlayed : 1;
      } else {
        day = 1;
      }
    }
    const dayData = await this.getMatchdayData(day, { compId });
    if (!dayData) {
      return { top11: [], flop11: [], topModule: '3-4-3', flopModule: '3-4-3', topSum: 0, flopSum: 0, topByModule: {}, flopByModule: {} };
    }

    return {
      top11: (dayData.top11 || []).map(p => formatPlayer(p, false)),
      flop11: (dayData.flop11 || []).map(p => formatPlayer(p, true)),
      topModule: dayData.topModule,
      flopModule: dayData.flopModule,
      topSum: dayData.topSum,
      flopSum: dayData.flopSum,
      topByModule: formatByModuleMap(dayData.topByModule, false),
      flopByModule: formatByModuleMap(dayData.flopByModule, true)
    };
  }
};

// Esportazione universale per browser e Node.js
if (typeof window !== 'undefined') {
  window.fcmFantamisterMotore = fcmFantamisterMotore;
  window.fcmFantamisterEngine = fcmFantamisterMotore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fcmFantamisterMotore;
}

