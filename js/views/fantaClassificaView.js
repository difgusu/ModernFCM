/**
 * FANTACLASSIFICA VIEW
 * Classifica ipotetica, punti mancati, gol lasciati in panchina e rating FantaMister
 * ModernFCM
 */

const fantaClassificaView = {
  currentCompId: null,   // Dynamically initialized to default competition
  currentDivId: 0,       // 0 = Tutte le divisioni
  currentGroupId: 0,     // 0 = Tutti i gironi/fasi
  currentSort: 'ipotetici', // 'ipotetici' | 'effettivi' | 'mancati' | 'golMancati' | 'scarto' | 'fmTot' | 'rapporto'
  _cachedFmDati: null,   // Cache of loaded matchdays: { [giornata]: [Fm objects] }

  // FCM scoring thresholds
  gol0: 59,
  gol1: 66,
  gol2: 72,
  gol3: 77,
  gol4: 81,
  gol5: 85,
  gol6: 89,
  gol7: 93,
  gol8: 97,
  gol9: 101,
  gol10: 105,
  gol11: 109,
  gol12: 113,
  fattoreCampo: 1, // 1 in regolamento fantaclassifica
  valoreDifferenza3: 3,
  regolaDifferenza3: 'si',
  valoreDifferenza10: 10,
  regolaDifferenza10: 'no',
  primaSuNeutro: 37, // Giornata da cui non si assegna più il fattore campo

  initThresholds() {
    if (typeof fgol1 !== 'undefined') this.gol1 = fgol1;
    if (typeof fgol2 !== 'undefined') this.gol2 = fgol2;
    if (typeof fgol3 !== 'undefined') this.gol3 = fgol3;
    if (typeof fgol4 !== 'undefined') this.gol4 = fgol4;
    if (typeof fgol5 !== 'undefined') this.gol5 = fgol5;
    if (typeof fgol6 !== 'undefined') this.gol6 = fgol6;
    if (typeof fgol7 !== 'undefined') this.gol7 = fgol7;
    if (typeof fgol8 !== 'undefined') this.gol8 = fgol8;
    if (typeof fgol9 !== 'undefined') this.gol9 = fgol9;
    if (typeof fgol10 !== 'undefined') this.gol10 = fgol10;
    if (typeof fgol11 !== 'undefined') this.gol11 = fgol11;
    if (typeof fgol12 !== 'undefined') this.gol12 = fgol12;
    if (typeof diffT !== 'undefined') this.valoreDifferenza3 = diffT;
  },

  async render(container) {
    // 1. Ensure core data scripts are loaded
    if (typeof arrCompetizioni === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCompetizioniDati.js');
    }
    if (typeof arrFantasquadre === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }
    if (typeof arrClassifica === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmClassificaDati.js');
    }
    if (typeof arrIncontri === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCalendarioDati.js');
    }
    if (typeof arrFantamTot === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmFantamisterTot.js');
      } catch (e) {
        try {
          await fcmDataLoader.loadScript('fantam/fcmFantamisterTot.js');
        } catch (err) { }
      }
    }
    if (typeof fgol1 === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js');
      } catch (e) { }
    }

    this.initThresholds();

    if (this.currentCompId === null) {
      const comps = fcmDataLoader.getCompetitions();
      const defComp = comps.find(c => c.isDefault) || comps[0];
      this.currentCompId = defComp ? defComp.id : 1;
    }

    // 2. Load all available matchday fantamister files
    const calendar = fcmDataLoader.getCalendarData();
    const maxA = calendar.maxA || (typeof MaxA !== 'undefined' ? MaxA : 38);
    const lastDay = calendar.lastPlayed > 0 ? calendar.lastPlayed : maxA;
    let startDay = 1;
    if (calendar.matchdays && calendar.matchdays.length > 0) {
      startDay = calendar.matchdays[0].serieADay;
    } else if (typeof arrIncontri !== 'undefined' && arrIncontri[1] && arrIncontri[1].GiornataDiA) {
      startDay = arrIncontri[1].GiornataDiA;
    }

    await this.loadAllFantamisterData(startDay, lastDay);

    // 3. Parse URL params (e.g. #fantaclassifica?ordine=mancati&comp=1&div=1&girone=2)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('ordine')) {
        this.currentSort = params.get('ordine');
      }
      if (params.has('comp')) {
        const c = parseInt(params.get('comp'), 10);
        if (!isNaN(c)) this.currentCompId = c;
      }
      if (params.has('div')) {
        const d = parseInt(params.get('div'), 10);
        if (!isNaN(d)) this.currentDivId = d;
      }
      if (params.has('girone')) {
        const g = parseInt(params.get('girone'), 10);
        if (!isNaN(g)) this.currentGroupId = g;
      }
    }

    this.renderContainer(container);
  },

  /**
   * Load and cache all FantaMister matchday scripts in parallel
   */
  async loadAllFantamisterData(startDay, endDay) {
    if (!this._cachedFmDati) {
      this._cachedFmDati = {};
    }

    const daysToLoad = [];
    for (let g = startDay; g <= endDay; g++) {
      if (!this._cachedFmDati[g]) {
        daysToLoad.push(g);
      }
    }

    if (daysToLoad.length === 0) return;

    await Promise.all(daysToLoad.map(async (g) => {
      try {
        const resp = await fetch(`js/fcmFantamisterDati${g}.js`);
        if (!resp.ok) return;
        const text = await resp.text();
        function Fm(Nome, Scarto, Voti, ScSuVoti, Parz, ModParz, Max, ModMax) {
          return { Nome, Scarto, Voti, ScSuVoti, Parz, ModParz, Max, ModMax };
        }
        const fn = new Function('Fm', `
          var arrFantamister = [];
          var a = arrFantamister;
          ${text}
          return arrFantamister;
        `);
        const result = fn(Fm);
        if (Array.isArray(result) && result.length > 0) {
          this._cachedFmDati[g] = result;
        }
      } catch (err) {
        // Silently skip missing files
      }
    }));
  },

  getGol(maxCasa, maxFuori) {
    let golCasa = 0;
    let golFuori = 0;

    if (maxCasa >= this.gol1 && maxCasa < this.gol2) golCasa = 1;
    else if (maxCasa >= this.gol2 && maxCasa < this.gol3) golCasa = 2;
    else if (maxCasa >= this.gol3 && maxCasa < this.gol4) golCasa = 3;
    else if (maxCasa >= this.gol4 && maxCasa < this.gol5) golCasa = 4;
    else if (maxCasa >= this.gol5 && maxCasa < this.gol6) golCasa = 5;
    else if (maxCasa >= this.gol6 && maxCasa < this.gol7) golCasa = 6;
    else if (maxCasa >= this.gol7 && maxCasa < this.gol8) golCasa = 7;
    else if (maxCasa >= this.gol8 && maxCasa < this.gol9) golCasa = 8;
    else if (maxCasa >= this.gol9 && maxCasa < this.gol10) golCasa = 9;
    else if (maxCasa >= this.gol10 && maxCasa < this.gol11) golCasa = 10;
    else if (maxCasa >= this.gol11) golCasa = 11;

    if (maxFuori >= this.gol1 && maxFuori < this.gol2) golFuori = 1;
    else if (maxFuori >= this.gol2 && maxFuori < this.gol3) golFuori = 2;
    else if (maxFuori >= this.gol3 && maxFuori < this.gol4) golFuori = 3;
    else if (maxFuori >= this.gol4 && maxFuori < this.gol5) golFuori = 4;
    else if (maxFuori >= this.gol5 && maxFuori < this.gol6) golFuori = 5;
    else if (maxFuori >= this.gol6 && maxFuori < this.gol7) golFuori = 6;
    else if (maxFuori >= this.gol7 && maxFuori < this.gol8) golFuori = 7;
    else if (maxFuori >= this.gol8 && maxFuori < this.gol9) golFuori = 8;
    else if (maxFuori >= this.gol9 && maxFuori < this.gol10) golFuori = 9;
    else if (maxFuori >= this.gol10 && maxFuori < this.gol11) golFuori = 10;
    else if (maxFuori >= this.gol11) golFuori = 11;

    if (maxCasa < this.gol0 && maxFuori >= (maxCasa + 3)) golFuori++;
    if (maxFuori < this.gol0 && maxCasa >= (maxFuori + 3)) golCasa++;

    return { Casa: golCasa, Fuori: golFuori };
  },

  regolaDifferenza(totaliCasa, totaliFuori, golCasa, golFuori) {
    let diffCasa = totaliCasa - totaliFuori;
    let diffFuori = totaliFuori - totaliCasa;

    if (this.regolaDifferenza3 === 'si') {
      if (diffCasa < this.valoreDifferenza3 && diffCasa >= 0 && golCasa > golFuori) {
        golFuori++;
      } else if (diffFuori < this.valoreDifferenza3 && diffFuori >= 0 && golFuori > golCasa) {
        golCasa++;
      }
    }
    if (this.regolaDifferenza10 === 'si') {
      if (diffCasa >= this.valoreDifferenza10) golCasa++;
      if (diffFuori >= this.valoreDifferenza10) golFuori++;
    }
    return { Casa: golCasa, Fuori: golFuori };
  },

  getEsito(gol1, gol2) {
    if (gol1 > gol2) return "1";
    if (gol1 === gol2) return "X";
    return "2";
  },

  /**
   * Run the exact matchday-by-matchday simulation engine from SuperKaze/FantaMister
   */
  calculateFantaClassifica() {
    if (typeof arrClassifica === 'undefined' || !Array.isArray(arrClassifica)) {
      return [];
    }

    // 1. Build FmTot map from arrFantamTot (ScartoP)
    const fmTotMap = {};
    if (typeof arrFantamTot !== 'undefined' && Array.isArray(arrFantamTot)) {
      for (let i = 1; i < arrFantamTot.length; i++) {
        if (arrFantamTot[i] && arrFantamTot[i].Nome) {
          fmTotMap[arrFantamTot[i].Nome] = arrFantamTot[i].ScartoP || 0;
        }
      }
    }

    // 2. Accumulators for simulation results per team
    const teamSimStats = {};
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      for (let s = 1; s < arrFantasquadre.length; s++) {
        if (arrFantasquadre[s] && arrFantasquadre[s].Nome) {
          teamSimStats[arrFantasquadre[s].Nome] = {
            puntiMancati: 0,
            golMancati: 0,
            scarto: 0,
            scSuVoti: 0,
            giornateGiocate: 0
          };
        }
      }
    }

    // 3. Simulate all loaded matchdays for the current competition
    const compToSimulate = this.currentCompId > 0 ? this.currentCompId : 1;
    const calendar = fcmDataLoader.getCalendarData();
    const maxA = calendar.maxA || (typeof MaxA !== 'undefined' ? MaxA : 38);
    const lastDay = calendar.lastPlayed > 0 ? calendar.lastPlayed : maxA;
    let startDay = 1;
    if (calendar.matchdays && calendar.matchdays.length > 0) {
      startDay = calendar.matchdays[0].serieADay;
    } else if (typeof arrIncontri !== 'undefined' && arrIncontri[1] && arrIncontri[1].GiornataDiA) {
      startDay = arrIncontri[1].GiornataDiA;
    }

    if (this._cachedFmDati && typeof RiempiListaIncontri === 'function') {
      for (let g = startDay; g <= lastDay; g++) {
        const fmList = this._cachedFmDati[g];
        if (!fmList || !Array.isArray(fmList)) continue;

        // Build quick lookup map by team name for matchday g
        const fmDayMap = {};
        for (let k = 1; k < fmList.length; k++) {
          if (fmList[k] && fmList[k].Nome) {
            fmDayMap[fmList[k].Nome] = fmList[k];
          }
        }

        let incontri = [];
        try {
          incontri = RiempiListaIncontri(g, compToSimulate);
        } catch (err) {
          continue;
        }
        if (!incontri || !Array.isArray(incontri)) continue;

        const maxMatches = typeof arrFantasquadre !== 'undefined' ? arrFantasquadre.length : incontri.length;

        // --- SIMULAZIONE SQUADRA IN CASA ---
        for (let conta1 = 1; conta1 <= maxMatches; conta1++) {
          const match = incontri[conta1];
          if (!match || !match.Nomi || !match.Totali || !match.Gol) continue;

          const nomiCasa = match.Nomi.Casa;
          const fmCasa = fmDayMap[nomiCasa];
          if (!fmCasa) continue;

          let maxCasa = 0;
          if (g < this.primaSuNeutro) {
            maxCasa = this.fattoreCampo + (fmCasa.Max || 0);
          } else {
            maxCasa = fmCasa.Max || 0;
          }

          const totaliCasa = match.Totali.Casa || 0;
          const totaliFuori = match.Totali.Fuori || 0;

          let simGol = this.getGol(maxCasa, totaliFuori);
          simGol = this.regolaDifferenza(maxCasa, totaliFuori, simGol.Casa, simGol.Fuori);

          const golEffettiviNum = match.Gol.Casa || 0;
          let golEffettiviFuoriNum = match.Gol.Fuori || 0;

          const autogolEvitato = (totaliCasa < this.gol0 && maxCasa >= this.gol0);
          const golMangiatiNum = Math.max(0, simGol.Casa - golEffettiviNum);
          if (autogolEvitato) {
            golEffettiviFuoriNum = Math.max(0, golEffettiviFuoriNum - 1);
          }

          const esitoEffettivo = this.getEsito(golEffettiviNum, match.Gol.Fuori || 0);
          const esito = this.getEsito(simGol.Casa, golEffettiviFuoriNum);

          let puntiSprecatiNum = 0;
          if (esito !== esitoEffettivo) {
            if (esito === "1" && esitoEffettivo === "2") puntiSprecatiNum = 3;
            else if (esito === "1" && esitoEffettivo === "X") puntiSprecatiNum = 2;
            else if (esito === "X" && esitoEffettivo === "2") puntiSprecatiNum = 1;
          }

          if (!teamSimStats[nomiCasa]) {
            teamSimStats[nomiCasa] = { puntiMancati: 0, golMancati: 0, scarto: 0, scSuVoti: 0, giornateGiocate: 0 };
          }
          teamSimStats[nomiCasa].puntiMancati += puntiSprecatiNum;
          teamSimStats[nomiCasa].golMancati += Math.max(0, golMangiatiNum);
          teamSimStats[nomiCasa].scarto += (fmCasa.Scarto || 0);
          teamSimStats[nomiCasa].scSuVoti += (fmCasa.ScSuVoti === 999 ? 1 : (fmCasa.ScSuVoti || 0));
          teamSimStats[nomiCasa].giornateGiocate += 1;
        }

        // --- SIMULAZIONE SQUADRA FUORI CASA ---
        for (let conta3 = 1; conta3 <= maxMatches; conta3++) {
          const match = incontri[conta3];
          if (!match || !match.Nomi || !match.Totali || !match.Gol) continue;

          const nomiFuori = match.Nomi.Fuori;
          const fmFuori = fmDayMap[nomiFuori];
          if (!fmFuori) continue;

          const maxFuori = fmFuori.Max || 0;
          const totaliCasa = match.Totali.Casa || 0;
          const totaliFuori = match.Totali.Fuori || 0;

          let simGol = this.getGol(totaliCasa, maxFuori);
          simGol = this.regolaDifferenza(totaliCasa, maxFuori, simGol.Casa, simGol.Fuori);

          const golEffettiviNum = match.Gol.Fuori || 0;
          let golEffettiviCasaNum = match.Gol.Casa || 0;

          const autogolEvitato = (totaliFuori < this.gol0 && maxFuori >= this.gol0);
          const golMangiatiNum = Math.max(0, simGol.Fuori - golEffettiviNum);
          if (autogolEvitato) {
            golEffettiviCasaNum = Math.max(0, golEffettiviCasaNum - 1);
          }

          const esitoEffettivo = this.getEsito(match.Gol.Casa || 0, golEffettiviNum);
          const esito = this.getEsito(golEffettiviCasaNum, simGol.Fuori);

          let puntiSprecatiNum = 0;
          if (esito !== esitoEffettivo) {
            if (esito === "2" && esitoEffettivo === "1") puntiSprecatiNum = 3;
            else if (esito === "2" && esitoEffettivo === "X") puntiSprecatiNum = 2;
            else if (esito === "X" && esitoEffettivo === "1") puntiSprecatiNum = 1;
          }

          if (!teamSimStats[nomiFuori]) {
            teamSimStats[nomiFuori] = { puntiMancati: 0, golMancati: 0, scarto: 0, scSuVoti: 0, giornateGiocate: 0 };
          }
          teamSimStats[nomiFuori].puntiMancati += puntiSprecatiNum;
          teamSimStats[nomiFuori].golMancati += Math.max(0, golMangiatiNum);
          teamSimStats[nomiFuori].scarto += (fmFuori.Scarto || 0);
          teamSimStats[nomiFuori].scSuVoti += (fmFuori.ScSuVoti === 999 ? 1 : (fmFuori.ScSuVoti || 0));
          teamSimStats[nomiFuori].giornateGiocate += 1;
        }
      }
    }

    // 4. Assemble standings items from arrClassifica
    const items = [];
    for (let f = 1; f < arrClassifica.length; f++) {
      const c = arrClassifica[f];
      if (!c || !c.Nome) continue;

      // Filter by competition if set (> 0)
      if (this.currentCompId > 0 && c.IDCompetizione && c.IDCompetizione !== this.currentCompId) {
        continue;
      }
      // Filter by division if set (> 0)
      if (this.currentDivId > 0) {
        let divId = c.IDDivisione;
        if (!divId && typeof arrFantasquadre !== 'undefined') {
          const sq = arrFantasquadre.find(s => s && (s.ID === c.IDSquadra || s.Nome === c.Nome));
          if (sq) divId = sq.IDDivisione;
        }
        if (divId !== this.currentDivId) {
          continue;
        }
      }
      // Filter by group/girone if set (> 0)
      if (this.currentGroupId > 0 && c.IDGirone && c.IDGirone !== this.currentGroupId) {
        continue;
      }

      const sim = teamSimStats[c.Nome] || { puntiMancati: 0, golMancati: 0, scarto: 0, scSuVoti: 0, giornateGiocate: 1 };
      const fmTot = fmTotMap[c.Nome] || 0;
      const giornate = Math.max(1, sim.giornateGiocate);
      const scSuVoti = sim.scSuVoti / giornate;
      const scartoMedio = Number((sim.scarto / giornate).toFixed(2));

      items.push({
        id: c.ID,
        nome: c.Nome,
        presidente: c.Presidente || '',
        posReale: c.Pos,
        puntiReali: c.Punti,
        totali: c.TTot || 0,
        parziali: c.PTot || 0,
        scarto: Math.round(sim.scarto * 100) / 100,
        scartoMedio: scartoMedio,
        golMancati: sim.golMancati,
        puntiMancati: sim.puntiMancati,
        puntiIpotetici: c.Punti + sim.puntiMancati,
        fmTot: fmTot,
        scSuVoti: Math.round(scSuVoti * 100) / 100
      });
    }

    // 5. Compute real and hypothetical leaders for distacco
    const leaderRealPoints = items.length > 0 ? Math.max(...items.map(i => i.puntiReali)) : 0;
    const leaderIpoPoints = items.length > 0 ? Math.max(...items.map(i => i.puntiIpotetici)) : 0;

    items.forEach(item => {
      item.distaccoReale = item.puntiReali - leaderRealPoints;
      item.distaccoIpotetico = item.puntiIpotetici - leaderIpoPoints;
    });

    // 6. Sort according to currentSort
    const sortKey = this.currentSort;
    items.sort((a, b) => {
      if (sortKey === 'ipotetici') {
        if (b.puntiIpotetici !== a.puntiIpotetici) return b.puntiIpotetici - a.puntiIpotetici;
        return b.totali - a.totali;
      } else if (sortKey === 'effettivi') {
        if (a.posReale !== b.posReale) return a.posReale - b.posReale;
        return b.puntiReali - a.puntiReali;
      } else if (sortKey === 'mancati') {
        if (b.puntiMancati !== a.puntiMancati) return b.puntiMancati - a.puntiMancati;
        return b.puntiIpotetici - a.puntiIpotetici;
      } else if (sortKey === 'golMancati') {
        if (b.golMancati !== a.golMancati) return b.golMancati - a.golMancati;
        return b.puntiMancati - a.puntiMancati;
      } else if (sortKey === 'scarto') {
        return b.scarto - a.scarto;
      } else if (sortKey === 'fmTot') {
        // Minor scarto medio = miglior fantamister
        return a.scartoMedio - b.scartoMedio;
      } else if (sortKey === 'rapporto') {
        const rB = b.puntiMancati > 0 ? (b.puntiReali / b.puntiMancati) : b.puntiReali;
        const rA = a.puntiMancati > 0 ? (a.puntiReali / a.puntiMancati) : a.puntiReali;
        return rB - rA;
      }
      return 0;
    });

    return items;
  },

  renderContainer(container) {
    const comps = (typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni))
      ? arrCompetizioni.filter(c => c && c.ID > 0)
      : [];

    // Check available divisions from arrDivisioni
    let availableDivisions = [];
    if (typeof arrDivisioni !== 'undefined' && Array.isArray(arrDivisioni)) {
      availableDivisions = arrDivisioni.filter(d => d && d.ID > 0);
    }
    const hasMultipleDivisions = availableDivisions.length > 1;

    // Find groups/gironi for current competition
    let availableGroups = [];
    if (this.currentCompId > 0) {
      const selectedComp = comps.find(c => c.ID === this.currentCompId);
      if (selectedComp && typeof arrGironi !== 'undefined') {
        availableGroups = arrGironi.filter(g => g && g.IDComp === this.currentCompId);
      }
    } else if (typeof arrGironi !== 'undefined') {
      availableGroups = arrGironi.filter(g => g && g.ID > 0);
    }

    const hasMultipleGroups = availableGroups.length > 1;

    const items = this.calculateFantaClassifica();

    // Summary KPIs
    let bestMister = null;
    let mostWasteful = null;
    let mostGoalsMissed = null;
    let highestPotential = null;

    if (items.length > 0) {
      // Best mister: min scartoMedio (> 0)
      bestMister = [...items].filter(i => i.scartoMedio > 0).sort((a, b) => a.scartoMedio - b.scartoMedio)[0] || items[0];
      // Most wasteful: max puntiMancati
      mostWasteful = [...items].sort((a, b) => b.puntiMancati - a.puntiMancati)[0];
      // Most goals missed: max golMancati
      mostGoalsMissed = [...items].sort((a, b) => b.golMancati - a.golMancati)[0];
      // Highest potential: max puntiIpotetici
      highestPotential = [...items].sort((a, b) => b.puntiIpotetici - a.puntiIpotetici)[0];
    }

    const maxIpo = items.length > 0 ? Math.max(...items.map(i => i.puntiIpotetici)) : 1;
    const maxScarto = items.length > 0 ? Math.max(1, ...items.map(i => i.scarto)) : 1;

    container.innerHTML = `
      <div class="card">
        <!-- Header -->
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
              FantaClassifica Ipotetica
            </div>
            <div class="card-subtitle">Punti e posizioni che ciascuna squadra avrebbe ottenuto schierando sempre la miglior formazione</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <a href="#fantamassimi" class="pill-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
              ⚡ Vai a FantaMassimi →
            </a>
          </div>
        </div>

        <!-- Filter Bar: Competizione, Divisione e Girone -->
        <div class="schede-filters-bar" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:16px;">
          <!-- Competizione Selector -->
          <div style="flex:1;min-width:180px;">
            <label for="selFcComp" style="font-size:0.75rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;display:block;margin-bottom:4px;">
              Competizione:
            </label>
            <select id="selFcComp" class="form-select" style="width:100%;font-weight:700;">
              ${comps.map(c => `
                <option value="${c.ID}" ${c.ID === this.currentCompId ? 'selected' : ''}>${c.Nome}</option>
              `).join('')}
            </select>
          </div>

          <!-- Divisione Selector (se presente più di 1 divisione) -->
          ${hasMultipleDivisions ? `
            <div style="flex:1;min-width:180px;">
              <label for="selFcDiv" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
                Divisione:
              </label>
              <select id="selFcDiv" class="form-select" style="width:100%;font-weight:700;">
                <option value="0" ${this.currentDivId === 0 ? 'selected' : ''}>- Tutte le Divisioni -</option>
                ${availableDivisions.map(d => `
                  <option value="${d.ID}" ${d.ID === this.currentDivId ? 'selected' : ''}>${d.Nome}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <!-- Girone / Fase Selector (se la competizione ha più gironi) -->
          ${hasMultipleGroups ? `
            <div style="flex:1;min-width:180px;">
              <label for="selFcGirone" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
                Girone / Fase:
              </label>
              <select id="selFcGirone" class="form-select" style="width:100%;font-weight:700;">
                <option value="0" ${this.currentGroupId === 0 ? 'selected' : ''}>- Tutti i Gironi -</option>
                ${availableGroups.map(g => `
                  <option value="${g.ID}" ${g.ID === this.currentGroupId ? 'selected' : ''}>${g.Nome}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- KPI Summary Cards -->
        ${items.length > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:20px;">
            <!-- Miglior FantaMister -->
            <div style="background:var(--bg-surface);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-md);padding:12px 14px;display:flex;align-items:center;gap:10px;">
              <div style="font-size:1.6rem;">🏆</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--accent-emerald);text-transform:uppercase;">Miglior Fanta-Allenatore</div>
                <div style="font-weight:800;font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${bestMister ? bestMister.nome : '-'}
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">Scarto medio: <b>${bestMister ? bestMister.scartoMedio : 0} pt / partita</b></div>
              </div>
            </div>

            <!-- Squadra Più Sprecona -->
            <div style="background:var(--bg-surface);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:12px 14px;display:flex;align-items:center;gap:10px;">
              <div style="font-size:1.6rem;">📉</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--accent-crimson);text-transform:uppercase;">Squadra Più Sprecona</div>
                <div style="font-weight:800;font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${mostWasteful ? mostWasteful.nome : '-'}
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">Punti persi: <b style="color:var(--accent-crimson);">+${mostWasteful ? mostWasteful.puntiMancati : 0} pt</b></div>
              </div>
            </div>

            <!-- Maggior Gol Mancati -->
            <div style="background:var(--bg-surface);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:12px 14px;display:flex;align-items:center;gap:10px;">
              <div style="font-size:1.6rem;">⚽</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;">Più Gol in Panchina</div>
                <div style="font-weight:800;font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${mostGoalsMissed ? mostGoalsMissed.nome : '-'}
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">Gol mancati: <b>${mostGoalsMissed ? mostGoalsMissed.golMancati : 0}</b></div>
              </div>
            </div>

            <!-- Potenziale Ipotetico Massimo -->
            <div style="background:var(--bg-surface);border:1px solid rgba(6,182,212,0.3);border-radius:var(--radius-md);padding:12px 14px;display:flex;align-items:center;gap:10px;">
              <div style="font-size:1.6rem;">🚀</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;">Potenziale Massimo</div>
                <div style="font-weight:800;font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${highestPotential ? highestPotential.nome : '-'}
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">Punti Ipotetici: <b style="color:var(--accent-cyan);">${highestPotential ? highestPotential.puntiIpotetici : 0} pt</b></div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Sorting Pill Tabs (Reattivi senza reload!) -->
        <div style="margin-bottom:14px;">
          <label style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:6px;">
            Ordina Classifica per:
          </label>
          <div class="pill-tabs wrap-tabs" id="fantaClassificaSortGroup" style="margin:0;border-radius:var(--radius-md, 12px);padding:6px;">
            <button type="button" class="pill-btn ${this.currentSort === 'ipotetici' ? 'active' : ''}" data-sort="ipotetici">
              ⚡ Punti Effettivi + Mancati
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'effettivi' ? 'active' : ''}" data-sort="effettivi">
              📊 Punti Effettivi
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'mancati' ? 'active' : ''}" data-sort="mancati">
              💔 Punti Mancati
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'golMancati' ? 'active' : ''}" data-sort="golMancati">
              ⚽ Gol Mancati
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'scarto' ? 'active' : ''}" data-sort="scarto">
              📏 Scarto Punti
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'fmTot' ? 'active' : ''}" data-sort="fmTot">
              👑 Miglior Fantamister
            </button>
            <button type="button" class="pill-btn ${this.currentSort === 'rapporto' ? 'active' : ''}" data-sort="rapporto">
              🎯 Rapporto Effettivi/Mancati
            </button>
          </div>
        </div>

        <!-- Standings Table Container -->
        <div style="overflow-x:auto;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
          <table class="modern-table" style="width:100%;font-size:0.85rem;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--bg-surface-elevated);border-bottom:1px solid var(--border-subtle);">
                <th style="width:50px;text-align:center;" title="Posizione effettiva in Classifica">Pos</th>
                <th style="min-width:180px;">Squadra</th>
                <th style="width:85px;text-align:center;" title="Punti reali in classifica (e distacco dalla capolista reale)">Punti Reali</th>
                <th style="width:75px;text-align:center;" title="Totale Punti (Parziali)">Totali (Parz)</th>
                <th style="width:95px;text-align:center;" title="Scarto complessivo punti">Scarto</th>
                <th style="width:75px;text-align:center;" title="Gol in più ottenibili con formazione ideale">Gol Mancati</th>
                <th style="width:75px;text-align:center;" title="Punti persi per formazione">Punti Mancati</th>
                <th style="min-width:180px;text-align:left;" title="Punti Effettivi + Punti Mancati (e distacco dalla vetta ipotetica)">Punti Ipotetici</th>
                <th style="width:90px;text-align:center;" title="Scarto medio punti lasciati in panchina a partita">Scarto Medio</th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">
                    Nessun dato disponibile per i filtri selezionati.
                  </td>
                </tr>
              ` : items.map((row, index) => {
      const posEffettiva = row.posReale;
      const posBadge = posEffettiva === 1 ? '🥇' : posEffettiva === 2 ? '🥈' : posEffettiva === 3 ? '🥉' : posEffettiva;

      // Proportion for bars based on max hypothetical points
      const pctReal = maxIpo > 0 ? (row.puntiReali / maxIpo) * 100 : 0;
      const pctMiss = maxIpo > 0 ? (row.puntiMancati / maxIpo) * 100 : 0;

      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);transition:background 0.15s;">
                    <!-- Posizione Effettiva -->
                    <td style="text-align:center;font-weight:800;font-size:0.95rem;">
                      ${posBadge}
                    </td>

                    <!-- Team Name + Jersey -->
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <img src="img/sq/${encodeURI(row.nome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(row.nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                        <div>
                          <a href="#rose?fsq=${row.id}" style="text-decoration:none;font-weight:800;color:var(--text-primary);">
                            ${row.nome}
                          </a>
                          <div style="font-size:0.72rem;color:var(--text-muted);">${row.presidente}</div>
                        </div>
                      </div>
                    </td>

                    <!-- Punti Reali -->
                    <td style="text-align:center;font-weight:700;">
                      <span style="font-size:0.95rem;color:var(--text-primary);">${row.puntiReali}</span>
                      <div style="font-size:0.7rem;color:var(--text-muted);">(${row.distaccoReale >= 0 ? 'Leader' : row.distaccoReale})</div>
                    </td>

                    <!-- Totali / Parziali -->
                    <td style="text-align:center;font-size:0.8rem;">
                      <b>${row.totali}</b>
                      <div style="font-size:0.7rem;color:var(--text-muted);">${row.parziali}</div>
                    </td>

                    <!-- Scarto -->
                    <td style="text-align:center;font-size:0.85rem;">
                      <b>${row.scarto}</b>
                      <div style="background:var(--bg-surface-elevated);height:4px;border-radius:2px;overflow:hidden;margin-top:4px;">
                        <div style="background:var(--accent-cyan);height:100%;width:${Math.min(100, Math.round((row.scarto / maxScarto) * 100))}%;"></div>
                      </div>
                    </td>

                    <!-- Gol Mancati (con iconcina pallone rosso) -->
                    <td style="text-align:center;font-weight:700;color:${row.golMancati > 0 ? 'var(--accent-gold)' : 'var(--text-muted)'};">
                      ${row.golMancati > 0 ? `
                        <div style="display:inline-flex;align-items:center;gap:4px;">
                          <img src="img/golRed.png" width="14" height="14" alt="Gol mancati" style="vertical-align:middle;" />
                          <span>+${row.golMancati}</span>
                        </div>
                      ` : '-'}
                    </td>

                    <!-- Punti Mancati -->
                    <td style="text-align:center;font-weight:800;">
                      ${row.puntiMancati > 0 ? `
                        <span class="badge" style="background:rgba(239,68,68,0.15);color:var(--accent-crimson);font-size:0.85rem;padding:2px 8px;border-radius:4px;">
                          +${row.puntiMancati}
                        </span>
                      ` : `
                        <span style="color:var(--text-muted);">0</span>
                      `}
                    </td>

                    <!-- Punti Ipotetici (Progress Bar bicolore: Verde per effettivi, Rosso a destra per ipotetici/mancati) -->
                    <td style="vertical-align:middle;min-width:180px;">
                      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:0.8rem;margin-bottom:4px;">
                        <div>
                          <b style="color:var(--accent-cyan);font-size:0.95rem;">${row.puntiIpotetici} pt</b>
                          <span style="font-size:0.72rem;color:var(--text-muted);">
                            (${row.distaccoIpotetico >= 0 ? 'Leader' : row.distaccoIpotetico})
                          </span>
                        </div>
                        <div style="font-size:0.72rem;font-weight:700;">
                          <span style="color:#10b981;" title="Punti effettivi">${row.puntiReali}</span>
                          ${row.puntiMancati > 0 ? `<span style="color:#ef4444;" title="Punti ipotetici aggiuntivi (mancati)"> +${row.puntiMancati}</span>` : ''}
                        </div>
                      </div>
                      <div style="display:flex;height:12px;border-radius:4px;overflow:hidden;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);" title="Effettivi: ${row.puntiReali} pt (verde) | Ipotetici Aggiuntivi: +${row.puntiMancati} pt (rosso)">
                        <div style="background:#10b981;width:${pctReal.toFixed(2)}%;height:100%;flex-shrink:0;" title="Punti Effettivi: ${row.puntiReali}"></div>
                        <div style="background:#ef4444;width:${pctMiss.toFixed(2)}%;height:100%;flex-shrink:0;" title="Punti Ipotetici Aggiuntivi (Mancati): +${row.puntiMancati}"></div>
                      </div>
                    </td>

                    <!-- Miglior Fantamister (Scarto Medio) -->
                    <td style="text-align:center;font-size:0.85rem;font-weight:700;color:var(--accent-cyan);" title="Scarto medio punti lasciati in panchina a partita: ${row.scartoMedio} pt (FmTot storico: ${row.fmTot})">
                      ${row.scartoMedio} pt
                      <div style="font-size:0.7rem;color:var(--text-muted);font-weight:normal;">a partita</div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Legenda -->
        <div style="margin-top:20px;padding:16px;background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="font-size:0.85rem;font-weight:800;color:var(--accent-cyan);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>📖</span> Legenda Indicatori FantaClassifica
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:8px;font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
            <div>• <b>Pos:</b> posizione effettiva della fantasquadra in classifica di campionato.</div>
            <div>• <b>Punti Reali:</b> punti effettivamente conquistati in classifica (con distacco dalla vetta reale).</div>
            <div>• <b>Punti Ipotetici:</b> punti ottenibili con formazione ideale (barra verde = punti effettivi, barra rossa a fianco a destra = punti ipotetici/mancati).</div>
            <div>• <b>Punti Mancati:</b> punti in classifica persi per formazioni non ottimali.</div>
            <div>• <b>Gol Mancati:</b> gol complessivi lasciati in panchina che avrebbero incrementato il risultato.</div>
            <div>• <b>Scarto:</b> differenza complessiva tra i punteggi parziali reali e i massimi ottenibili.</div>
            <div>• <b>FmTot:</b> indice di rendimento FantaMister (minor scarto medio per partita diviso il numero di voti validi).</div>
          </div>
        </div>
      </div>
    `;

    // Listeners
    const selComp = container.querySelector('#selFcComp');
    if (selComp) {
      selComp.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value, 10);
        this.currentGroupId = 0;
        this.renderContainer(container);
      });
    }

    const selDiv = container.querySelector('#selFcDiv');
    if (selDiv) {
      selDiv.addEventListener('change', (e) => {
        this.currentDivId = parseInt(e.target.value, 10);
        this.renderContainer(container);
      });
    }

    const selGirone = container.querySelector('#selFcGirone');
    if (selGirone) {
      selGirone.addEventListener('change', (e) => {
        this.currentGroupId = parseInt(e.target.value, 10);
        this.renderContainer(container);
      });
    }

    container.querySelectorAll('#fantaClassificaSortGroup button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#fantaClassificaSortGroup button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentSort = btn.getAttribute('data-sort');
        this.renderContainer(container);
      });
    });
  }
};

if (typeof window !== 'undefined') {
  window.fantaClassificaView = fantaClassificaView;
}
