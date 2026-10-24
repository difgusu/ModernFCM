/**
 * VISTA REGISTRI VOTI
 * Registro voti, medie e statistiche per fantasquadra attraverso tutte le giornate
 * ModernFCM
 */

const registriView = {
  currentTeamId: null,
  currentQuotId: null,
  searchQuery: '',
  roleFilter: 0, // 0 = Tutti, 1 = P, 2 = D, 3 = C, 4 = A
  showLegend: false,
  _registriCache: {}, // Cache dei dati dei registri per squadra: { [teamId]: arrRegistri }
  _calendarRoundsCache: null, // Cache dei turni di calendario da arrIncontri (fcmCalendarioDati.js)
  _scrollHandler: null,

  quotList: [],

  // Metadati per le righe di riepilogo a fondo tabella (ID negativi standard FCM)
  summaryRowMeta: {
    "-1": { label: "TOTALE SQUADRA", rowClass: "rv-row-total" },
    "-2": { label: "MEDIA VOTO", rowClass: "rv-row-media-voto" },
    "-3": { label: "FANTAMEDIA", rowClass: "rv-row-fantamedia" },
    "-4": { label: "AVVERSARIO", rowClass: "rv-row-avversario" },
    "-5": { label: "RISULTATO", rowClass: "rv-row-result" }
  },

  // Definizioni e tooltip per le 26 colonne statistiche standard FCM
  statMeta: [
    { key: 'MVC', label: 'MVC', title: 'Media Voto Casa', group: 'mv' },
    { key: 'MVF', label: 'MVF', title: 'Media Voto Fuori', group: 'mv' },
    { key: 'MVT', label: 'MVT', title: 'Media Voto Totale', group: 'mv' },
    { key: 'DevSt_MV', label: 'DSt', title: 'Deviazione Standard Media Voto', group: 'mv' },
    { key: 'Andam_MV', label: 'And', title: 'Andamento Media Voto', group: 'mv' },
    { key: 'Min_MV', label: 'Min', title: 'Voto Minimo', group: 'mv' },
    { key: 'Max_MV', label: 'Max', title: 'Voto Massimo', group: 'mv' },
    { key: 'FMC', label: 'FMC', title: 'FantaMedia Casa', group: 'fm' },
    { key: 'FMF', label: 'FMF', title: 'FantaMedia Fuori', group: 'fm' },
    { key: 'FMT', label: 'FMT', title: 'FantaMedia Totale', group: 'fm' },
    { key: 'DevSt_FM', label: 'DSt', title: 'Deviazione Standard FantaMedia', group: 'fm' },
    { key: 'Andam_FM', label: 'And', title: 'Andamento FantaMedia', group: 'fm' },
    { key: 'Min_FM', label: 'Min', title: 'FantaMedia Minima', group: 'fm' },
    { key: 'Max_FM', label: 'Max', title: 'FantaMedia Massima', group: 'fm' },
    { key: 'PR', label: 'PR', title: 'Presenze Giocatore', group: 'stats' },
    { key: 'AF', label: 'AF', title: 'Indice di Affidabilità', group: 'stats' },
    { key: 'GF', label: 'GF', title: 'Gol Fatti', group: 'stats' },
    { key: 'GFR', label: 'GFR', title: 'Gol Fatti su Rigore', group: 'stats' },
    { key: 'GS', label: 'GS', title: 'Gol Subiti (Portiere)', group: 'stats' },
    { key: 'GSR', label: 'GSR', title: 'Gol Subiti su Rigore', group: 'stats' },
    { key: 'AS', label: 'AS', title: 'Assist', group: 'stats' },
    { key: 'AG', label: 'AG', title: 'Autogol', group: 'stats' },
    { key: 'RS', label: 'RS', title: 'Rigori Sbagliati', group: 'stats' },
    { key: 'RP', label: 'RP', title: 'Rigori Parati', group: 'stats' },
    { key: 'A', label: 'A', title: 'Ammonizioni', group: 'stats' },
    { key: 'E', label: 'E', title: 'Espulsioni', group: 'stats' }
  ],

  /**
   * Converte il codice numerico di stile FCM nelle classi CSS corrispondenti.
   * Rispecchia la logica originale di fcmRegistriFunzioni.js:
   *  >= 50: testo grigio, f = f - 50
   *  10..19: sfondo rosso
   *  20..29: sfondo azzurro
   *  30..39: sfondo verde
   *  40..49: sfondo giallo
   *  maschera di bit delle unità: 1 = grassetto, 2 = corsivo, 4 = sottolineato
   */
  getFCMStyle(f) {
    f = parseInt(f, 10);
    if (isNaN(f)) return '';
    let cssClass = '';
    let greyClass = '';
    if (f >= 50) {
      greyClass = ' txt-grey';
      f = f - 50;
    }
    if (f >= 10 && f < 20) cssClass += ' bg-red';
    else if (f >= 20 && f < 30) cssClass += ' bg-cyan';
    else if (f >= 30 && f < 40) cssClass += ' bg-green';
    else if (f >= 40 && f < 50) cssClass += ' bg-yellow';

    const styleBits = (f >= 10) ? parseInt((f + '').charAt(1), 10) : f;
    if (styleBits & 1) cssClass += ' t-bold';
    if (styleBits & 2) cssClass += ' t-italic';
    if (styleBits & 4) cssClass += ' t-underline';
    return (cssClass + greyClass).trim();
  },

  /**
   * Estrae e memorizza in cache l'elenco cronologico dei turni di calendario da arrIncontri (fcmCalendarioDati.js).
   * Ogni turno contiene il nome esteso della Fantagiornata, la Competizione e la Giornata di Serie A corrispondente.
   */
  getCalendarRounds() {
    if (this._calendarRoundsCache && this._calendarRoundsCache.length > 0) {
      return this._calendarRoundsCache;
    }
    if (typeof arrIncontri === 'undefined') return [];

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
          fantagiornata: inc.Fantagiornata,
          competizione: inc.Competizione || '',
          prefix5: inc.Fantagiornata.substring(0, 5)
        });
      }
    }
    rounds.sort((a, b) => a.serieADay - b.serieADay);
    this._calendarRoundsCache = rounds;
    return rounds;
  },

  /**
   * Risolve dinamicamente ogni colonna delle giornate presenti nell'header del registro.
   * I primi 5 caratteri della colonna (es. "1a Ca", "10a C", "1a Co", "Andat", "Ritor", "Final")
   * corrispondono ai primi 5 caratteri di arrIncontri[x].Fantagiornata.
   * La ricerca sequenziale in avanti garantisce la perfetta corrispondenza cronologica (es. Quarti vs Semifinali).
   */
  resolveMatchdayColumns(matchdayCols) {
    const calendarRounds = this.getCalendarRounds();
    let calIdx = 0;

    return matchdayCols.map((colStr) => {
      const raw = (colStr || '').trim();
      let matchedRound = null;

      // Cerca in avanti a partire da calIdx per rispettare la sequenza temporale dei turni
      for (let j = calIdx; j < calendarRounds.length; j++) {
        if (calendarRounds[j].fantagiornata.startsWith(raw)) {
          matchedRound = calendarRounds[j];
          calIdx = j + 1;
          break;
        }
      }

      // Se non trovato in avanti, esegue una ricerca globale di fallback
      if (!matchedRound) {
        matchedRound = calendarRounds.find(r => r.fantagiornata.startsWith(raw));
      }

      // Determina la sigla breve per la visualizzazione nella cella dell'intestazione (es. "1ª C", "10ª C", "1ª Co", "And.", "Rit.", "Fin.")
      let short = raw;
      if (raw.toLowerCase().includes('co')) {
        const num = raw.replace(/\D/g, '');
        short = num ? `${num}ª Co` : raw;
      } else if (raw.toLowerCase().includes('c')) {
        const num = raw.replace(/\D/g, '');
        short = num ? `${num}ª C` : raw;
      } else if (raw.toLowerCase().startsWith('andat')) {
        short = 'And.';
      } else if (raw.toLowerCase().startsWith('ritor')) {
        short = 'Rit.';
      } else if (raw.toLowerCase().startsWith('final')) {
        short = 'Fin.';
      }

      // Costruisce il tooltip dinamico completo da arrIncontri (Fantagiornata, Competizione e Giornata Serie A)
      let full = raw;
      if (matchedRound) {
        full = matchedRound.fantagiornata;
        if (matchedRound.competizione) {
          full += ` (${matchedRound.competizione})`;
        }
        if (matchedRound.serieADay) {
          full += ` • Serie A: ${matchedRound.serieADay}ª`;
        }
      }

      return {
        raw,
        short,
        full
      };
    });
  },

  /**
   * Formatta il nome del calciatore: COGNOME (in MAIUSCOLO) + iniziali puntate dei nomi
   * Esempio: "MARTINEZ Lautaro Javier" -> "MARTINEZ L. J."
   */
  formatPlayerShortName(str) {
    if (!str) return '';
    const parts = str.trim().split(/\s+/);
    const surnameParts = [];
    const firstNameParts = [];

    for (const part of parts) {
      const cleanAlpha = part.replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙáéíóúÁÉÍÓÚ]/g, '');
      if (cleanAlpha.length > 0 && cleanAlpha === cleanAlpha.toUpperCase()) {
        surnameParts.push(part);
      } else {
        firstNameParts.push(part);
      }
    }

    if (surnameParts.length === 0) return str;

    const surnameStr = surnameParts.join(' ');
    const initials = firstNameParts
      .map(name => {
        const clean = name.replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙáéíóúÁÉÍÓÚ]/g, '');
        return clean.length > 0 ? clean[0].toUpperCase() + '.' : '';
      })
      .filter(Boolean)
      .join(' ');

    return initials ? `${surnameStr} ${initials}` : surnameStr;
  },

  /**
   * Rendering principale della vista del Registro Voti.
   * Carica dinamicamente i dati di squadre, fonti, calendario e voti, e costruisce la tabella con i relativi controlli.
   */
  async render(container) {
    // Caricamento dinamico di fcmSerieADati.js per arrQuotidiani e nomi calciatori (xg...) se necessario
    if (typeof arrQuotidiani === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADati.js');
    }
    const dynamicQuotList = await fcmDataLoader.getQuotidiani();
    if (dynamicQuotList && dynamicQuotList.length > 0) {
      this.quotList = dynamicQuotList;
    }

    // Caricamento dinamico di fcmFantasquadreDati.js per arrFantasquadre se necessario
    if (typeof arrFantasquadre === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }
    const teams = fcmDataLoader.getTeams();

    // Caricamento dinamico di fcmCalendarioDati.js per arrIncontri (metadati e tooltip dinamici delle giornate) se necessario
    if (typeof arrIncontri === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCalendarioDati.js');
    }

    // Risoluzione dinamica della fantasquadra selezionata (default: prima squadra disponibile)
    const currentTeam = (this.currentTeamId && fcmDataLoader.getTeamById(this.currentTeamId)) || teams[0] || { ID: 0, Nome: 'Fantasquadra' };
    this.currentTeamId = currentTeam.ID;

    // Risoluzione dinamica della fonte voti selezionata (default: primo quotidiano disponibile)
    const currentQuot = (this.currentQuotId && this.quotList.find(q => q.id === this.currentQuotId)) || this.quotList[0] || { id: 0, name: 'Quotidiano' };
    this.currentQuotId = currentQuot.id;

    // Verifica se i dati della squadra sono già in cache
    let teamRegistri = this._registriCache[this.currentTeamId];

    if (!teamRegistri) {
      container.innerHTML = `
        <div class="card text-center" style="padding:40px;">
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Caricamento Registro Voti...</div>
          <div style="color:var(--text-muted);font-size:0.85rem;">${currentTeam.Nome} • ${currentQuot.name}</div>
        </div>
      `;

      // Ricarica lo script del registro della fantasquadra per garantire dati sempre aggiornati
      await fcmDataLoader.loadScript(`js/fcmRegistriDati${this.currentTeamId}.js`, true);

      if (typeof arrRegistri !== 'undefined' && arrRegistri.length > 0) {
        this._registriCache[this.currentTeamId] = arrRegistri.slice();
        teamRegistri = this._registriCache[this.currentTeamId];
      }
    }

    if (!teamRegistri || teamRegistri.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding:40px;color:var(--text-muted);">
          Registro non disponibile per questa squadra.
        </div>
      `;
      return;
    }

    // Recupera la riga di intestazione per il quotidiano selezionato (IDGiocatore === 0 && IDQuot === currentQuotId)
    const headerRow = teamRegistri.find(r => r && r.IDGiocatore === 0 && r.IDQuot === this.currentQuotId)
      || teamRegistri.find(r => r && r.IDGiocatore === 0)
      || teamRegistri[1];

    const matchdayCols = headerRow && headerRow.ListaGio ? headerRow.ListaGio.split('%') : [];
    const statCols = headerRow && headerRow.ListaStat ? headerRow.ListaStat.split('%') : [];

    // Risoluzione dinamica dei tooltip e delle etichette delle giornate basata su arrIncontri
    const resolvedMatchdays = this.resolveMatchdayColumns(matchdayCols);

    // Calcolo dinamico delle partizioni di colonna per l'intestazione superiore
    const matchdayCount = matchdayCols.length;
    const mvColsCount = Math.min(7, statCols.length);
    const fmColsCount = Math.min(7, Math.max(0, statCols.length - mvColsCount));
    const statsColsCount = Math.max(0, statCols.length - mvColsCount - fmColsCount);

    // Filtra le righe dei calciatori e le righe riepilogative per il quotidiano selezionato
    const rawPlayers = [];
    const summaryRows = [];

    for (let i = 1; i < teamRegistri.length; i++) {
      const r = teamRegistri[i];
      if (!r || r.IDQuot !== this.currentQuotId) continue;

      if (r.IDGiocatore > 0) {
        let pName = window[`xg${r.IDGiocatore}`];
        if (!pName) {
          pName = `Calciatore #${r.IDGiocatore}`;
        }
        const votes = r.ListaGio ? r.ListaGio.split('%') : [];
        const voteFormats = r.ListaFormatoGio ? r.ListaFormatoGio.split('%') : [];
        const stats = r.ListaStat ? r.ListaStat.split('%') : [];
        const statFormats = r.ListaFormatoStat ? r.ListaFormatoStat.split('%') : [];

        rawPlayers.push({
          id: r.IDGiocatore,
          name: pName,
          role: r.Ruolo,
          votes,
          voteFormats,
          stats,
          statFormats
        });
      } else if (r.IDGiocatore < 0) {
        const meta = this.summaryRowMeta[r.IDGiocatore] || { label: `INFO (${r.IDGiocatore})`, rowClass: '' };

        summaryRows.push({
          id: r.IDGiocatore,
          label: meta.label,
          rowClass: meta.rowClass,
          votes: r.ListaGio ? r.ListaGio.split('%') : [],
          voteFormats: r.ListaFormatoGio ? r.ListaFormatoGio.split('%') : [],
          stats: r.ListaStat ? r.ListaStat.split('%') : [],
          statFormats: r.ListaFormatoStat ? r.ListaFormatoStat.split('%') : []
        });
      }
    }

    // Conteggio dei calciatori per ruolo per i pulsanti di filtro
    const roleCounts = {
      0: rawPlayers.length,
      1: rawPlayers.filter(p => p.role === 1).length,
      2: rawPlayers.filter(p => p.role === 2).length,
      3: rawPlayers.filter(p => p.role === 3).length,
      4: rawPlayers.filter(p => p.role === 4).length
    };

    // Ordina i calciatori prima per ruolo e poi alfabeticamente per nome
    rawPlayers.sort((a, b) => {
      if (a.role !== b.role) return a.role - b.role;
      return a.name.localeCompare(b.name);
    });

    // Generazione dell'interfaccia HTML
    let html = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              Registri Voti
            </div>
            <div class="card-subtitle">${currentTeam.Nome} • Presidente: ${currentTeam.Presidente || '-'} • Fonte: <b>${currentQuot.name}</b></div>
          </div>

          <!-- Pulsante Legenda in stile pill-tab -->
          <div class="pill-tabs" style="margin-bottom:0;display:inline-flex;">
            <button type="button" id="btnToggleLegend" class="pill-btn ${this.showLegend ? 'active' : ''}" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span id="btnToggleLegendText">${this.showLegend ? 'Nascondi Legenda' : 'Legenda'}</span>
            </button>
          </div>
        </div>

        <!-- Controlli: Selezione Fantasquadra e Quotidiano -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Seleziona Fantasquadra
            </label>
            <select id="selRegistriTeam" class="form-select" style="width:100%;">
              ${teams.map(t => `
                <option value="${t.ID}" ${t.ID === this.currentTeamId ? 'selected' : ''}>
                  ${t.Nome}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Fonte Voti / Quotidiano
            </label>
            <select id="selRegistriQuot" class="form-select" style="width:100%;">
              ${this.quotList.map(q => `
                <option value="${q.id}" ${q.id === this.currentQuotId ? 'selected' : ''}>
                  📰 ${q.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Riga filtri: Pulsanti selezione ruolo e campo di ricerca -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="rv-filter-pill ${this.roleFilter === 0 ? 'active' : ''}" data-role="0">Tutti (${roleCounts[0]})</button>
            <button type="button" class="rv-filter-pill ${this.roleFilter === 1 ? 'active' : ''}" data-role="1">P (${roleCounts[1]})</button>
            <button type="button" class="rv-filter-pill ${this.roleFilter === 2 ? 'active' : ''}" data-role="2">D (${roleCounts[2]})</button>
            <button type="button" class="rv-filter-pill ${this.roleFilter === 3 ? 'active' : ''}" data-role="3">C (${roleCounts[3]})</button>
            <button type="button" class="rv-filter-pill ${this.roleFilter === 4 ? 'active' : ''}" data-role="4">A (${roleCounts[4]})</button>
          </div>

          <div style="min-width:200px;flex:1;max-width:300px;position:relative;">
            <input type="text" id="inputFilterRegistri" class="form-control" placeholder="Cerca calciatore..." value="${this.searchQuery}" style="font-size:0.8rem;padding:5px 28px 5px 10px;width:100%;">
            <button type="button" id="btnClearSearchRegistri" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px;display:${this.searchQuery.trim().length > 0 ? 'inline-flex' : 'none'};align-items:center;justify-content:center;border-radius:50%;" title="Cancella ricerca">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Card Legenda collassabile con soglie FCM e regole -->
        <div id="rvLegendCard" class="rv-legend-card" style="display:${this.showLegend ? 'block' : 'none'};margin-bottom:16px;">
          <div style="font-weight:800;font-size:0.85rem;text-transform:uppercase;color:var(--accent-primary);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
            <span>📖 Legenda Registro Voti &amp; Soglie FCM</span>
          </div>

          <!-- 1. GRIGLIA SOGLIE VOTI (FANTATOTALE, MEDIA VOTO, FANTAMEDIA) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:14px;">
            
            <!-- Card 1: Fantatotale di Giornata -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                ⚽ Fantatotale di Giornata
              </div>
              <table style="width:100%;font-size:0.75rem;border-collapse:collapse;text-align:center;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-subtle);color:var(--text-muted);">
                    <th style="text-align:left;padding:3px;">Colore</th>
                    <th style="padding:3px;">Port</th>
                    <th style="padding:3px;">Dife</th>
                    <th style="padding:3px;">Cent</th>
                    <th style="padding:3px;">Atta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-green">Verde &ge;</span></td>
                    <td style="padding:3px;">7,00</td>
                    <td style="padding:3px;">7,50</td>
                    <td style="padding:3px;">7,50</td>
                    <td style="padding:3px;">9,00</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-cyan">Azzurro &ge;</span></td>
                    <td style="padding:3px;">6,50</td>
                    <td style="padding:3px;">7,00</td>
                    <td style="padding:3px;">7,00</td>
                    <td style="padding:3px;">8,00</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-red">Rosso &le;</span></td>
                    <td style="padding:3px;">3,00</td>
                    <td style="padding:3px;">5,00</td>
                    <td style="padding:3px;">5,00</td>
                    <td style="padding:3px;">5,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Card 2: Media Voto -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                📊 Media Voto (MV)
              </div>
              <table style="width:100%;font-size:0.75rem;border-collapse:collapse;text-align:center;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-subtle);color:var(--text-muted);">
                    <th style="text-align:left;padding:3px;">Colore</th>
                    <th style="padding:3px;">Port</th>
                    <th style="padding:3px;">Dife</th>
                    <th style="padding:3px;">Cent</th>
                    <th style="padding:3px;">Atta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-green">Verde &ge;</span></td>
                    <td style="padding:3px;">6,40</td>
                    <td style="padding:3px;">6,20</td>
                    <td style="padding:3px;">6,25</td>
                    <td style="padding:3px;">6,20</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-cyan">Azzurro &ge;</span></td>
                    <td style="padding:3px;">6,25</td>
                    <td style="padding:3px;">6,05</td>
                    <td style="padding:3px;">6,10</td>
                    <td style="padding:3px;">6,05</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-red">Rosso &le;</span></td>
                    <td style="padding:3px;">6,15</td>
                    <td style="padding:3px;">5,95</td>
                    <td style="padding:3px;">6,00</td>
                    <td style="padding:3px;">5,90</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Card 3: Fantamedia -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                ⭐ Fantamedia (FM)
              </div>
              <table style="width:100%;font-size:0.75rem;border-collapse:collapse;text-align:center;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-subtle);color:var(--text-muted);">
                    <th style="text-align:left;padding:3px;">Colore</th>
                    <th style="padding:3px;">Port</th>
                    <th style="padding:3px;">Dife</th>
                    <th style="padding:3px;">Cent</th>
                    <th style="padding:3px;">Atta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-green">Verde &ge;</span></td>
                    <td style="padding:3px;">5,90</td>
                    <td style="padding:3px;">6,30</td>
                    <td style="padding:3px;">6,70</td>
                    <td style="padding:3px;">7,50</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-cyan">Azzurro &ge;</span></td>
                    <td style="padding:3px;">5,70</td>
                    <td style="padding:3px;">6,05</td>
                    <td style="padding:3px;">6,40</td>
                    <td style="padding:3px;">7,15</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;padding:3px;"><span class="rv-legend-box bg-red">Rosso &le;</span></td>
                    <td style="padding:3px;">5,65</td>
                    <td style="padding:3px;">5,85</td>
                    <td style="padding:3px;">6,00</td>
                    <td style="padding:3px;">6,60</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          <!-- 2. GRIGLIA RISULTATI, STILI CARATTERE E EVENTI (3 CARD AFFIANCATE SU DESKTOP) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
            
            <!-- Card 4: Risultati Partite -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                🏆 Risultati Partite (Riga Risultato)
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
                <span class="rv-legend-item"><span class="rv-legend-box bg-green">V</span> <b>Verde</b>: Vittoria</span>
                <span class="rv-legend-item"><span class="rv-legend-box bg-yellow">P</span> <b>Giallo</b>: Pareggio</span>
                <span class="rv-legend-item"><span class="rv-legend-box bg-red">S</span> <b>Rosso</b>: Sconfitta</span>
              </div>
            </div>

            <!-- Card 5: Stile del Carattere -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                ✏️ Stile Carattere (Impiego)
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;font-size:0.74rem;">
                <div><b>Grassetto</b>: Schierato titolare</div>
                <div><u>Sottolineato</u>: Ha giocato (titolare / subentrato)</div>
                <div><i>Corsivo</i>: In panchina</div>
                <div>Normale: In tribuna / non a referto</div>
                <div style="color:var(--text-muted);margin-top:2px;">
                  <span class="txt-grey" style="font-weight:bold;">Testo Grigio</span>: Non in rosa
                </div>
              </div>
            </div>

            <!-- Card 6: Eventi (Bonus / Malus) -->
            <div style="background:var(--bg-surface-elevated);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
              <div style="font-size:0.78rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                ⚡ Eventi (Bonus / Malus)
              </div>
              <table style="width:100%;font-size:0.74rem;border-collapse:collapse;text-align:left;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-subtle);color:var(--text-muted);">
                    <th style="padding:2px 4px;">Simbolo</th>
                    <th style="padding:2px 4px;">Evento</th>
                  </tr>
                </thead>
                <tbody style="line-height:1.35;">
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">+1</code></td>
                    <td style="padding:2px 4px;">Gol Fatto</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">+(1)</code></td>
                    <td style="padding:2px 4px;">Rigore Segnato</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">#1</code></td>
                    <td style="padding:2px 4px;">Rigore Sbagliato</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">-1</code></td>
                    <td style="padding:2px 4px;">Gol Subito</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">[1]</code></td>
                    <td style="padding:2px 4px;">Gol Subito su Rigore</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">!1</code></td>
                    <td style="padding:2px 4px;">Rigore Parato</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">_1</code></td>
                    <td style="padding:2px 4px;">Autogol</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">&gt;1</code></td>
                    <td style="padding:2px 4px;">Assist</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">V</code></td>
                    <td style="padding:2px 4px;">Gol Vittoria</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">P</code></td>
                    <td style="padding:2px 4px;">Gol Pareggio</td>
                  </tr>
                  <tr style="border-bottom:1px dashed var(--border-subtle);">
                    <td style="padding:2px 4px;"><code class="rv-code-badge">A</code></td>
                    <td style="padding:2px 4px;">Ammonizione</td>
                  </tr>
                  <tr>
                    <td style="padding:2px 4px;"><code class="rv-code-badge">E</code></td>
                    <td style="padding:2px 4px;">Espulsione</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- Contenitore principale della tabella del registro voti -->
        <div class="rv-table-outer-container">
          <!-- Barra di scorrimento orizzontale fluttuante traslucida -->
          <div class="rv-floating-scroll-bar" title="Controlli di scorrimento orizzontale">
            <button type="button" class="rv-floating-btn" id="rvBtnScrollStart" title="Vai a inizio tabella (Prima Giornata)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
            </button>
            <button type="button" class="rv-floating-btn" id="rvBtnScrollLeft" title="Scorri a sinistra">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button type="button" class="rv-floating-btn" id="rvBtnScrollRight" title="Scorri a destra">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button type="button" class="rv-floating-btn" id="rvBtnScrollEnd" title="Vai a fine tabella (Statistiche &amp; Totali)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
            </button>
          </div>

          <div class="rv-scroll-wrapper">
            <table class="rv-table">
              <thead>
                <!-- PRIMA RIGA DI INTESTAZIONE SUPERIORE -->
                <tr class="rv-header-super">
                  <th rowspan="2" class="rv-sticky-corner font-bold">CALCIATORE</th>
                  ${matchdayCount > 0 ? `
                    <th colspan="${matchdayCount}" class="rv-group-matchdays" style="text-align:left;padding-left:12px;" title="Voti di tutte le partite di campionato e coppa">
                      📅 GIORNATE &amp; COPPE (${matchdayCount})
                    </th>
                  ` : ''}
                  ${mvColsCount > 0 ? `
                    <th colspan="${mvColsCount}" class="rv-group-mv" title="Medie Voto, Deviazione Standard e Valori Estremi">
                      📊 MEDIE VOTO (MV)
                    </th>
                  ` : ''}
                  ${fmColsCount > 0 ? `
                    <th colspan="${fmColsCount}" class="rv-group-fm" title="FantaMedie comprensive di Bonus/Malus">
                      ⭐ FANTAMEDIE (FM)
                    </th>
                  ` : ''}
                  ${statsColsCount > 0 ? `
                    <th colspan="${statsColsCount}" class="rv-group-stats" title="Presenze, Bonus (Gol/Assist/Rigori) e Malus (Gol Subiti/Ammonizioni/Espulsioni)">
                      🎯 TOTALI &amp; BONUS/MALUS
                    </th>
                  ` : ''}
                </tr>

                <!-- SECONDA RIGA DI INTESTAZIONE: GIORNATE E 26 STATISTICHE -->
                <tr class="rv-header-cols">
                  <!-- Colonne delle giornate con tooltip dinamico da arrIncontri -->
                  ${resolvedMatchdays.map((m) => `
                    <th class="text-center" title="${m.full}">${m.short}</th>
                  `).join('')}

                  <!-- 26 Colonne statistiche -->
                  ${statCols.map((col, idx) => {
      const meta = this.statMeta[idx] || { label: col, title: col };
      return `<th class="text-center" title="${meta.title}" style="min-width:38px;">${meta.label}</th>`;
    }).join('')}
                </tr>
              </thead>

              <!-- CORPO DELLA TABELLA: CALCIATORI -->
              <tbody>
                ${rawPlayers.map(p => `
                  <tr class="rv-player-row" data-role="${p.role}" data-name="${p.name.toLowerCase()}">
                    <!-- Colonna calciatore fissa a sinistra (sticky) -->
                    <td class="rv-sticky-col" title="${p.name}">
                      <span class="role-badge ${fcmDataLoader.getRoleClass(p.role)}">${fcmDataLoader.getRoleShort(p.role)}</span>
                      <span style="margin-left:4px;">${this.formatPlayerShortName(p.name)}</span>
                    </td>

                    <!-- Voti di giornata con stili FCM -->
                    ${matchdayCols.map((_, colIdx) => {
      const val = p.votes[colIdx];
      const fmt = p.voteFormats[colIdx];
      const cssClass = this.getFCMStyle(fmt);
      const cleanVal = (!val || val === '?') ? '-' : val;
      return `<td class="${cssClass}">${cleanVal}</td>`;
    }).join('')}

                    <!-- 26 Statistiche con stili FCM -->
                    ${statCols.map((_, colIdx) => {
      const sVal = p.stats[colIdx];
      const sFmt = p.statFormats[colIdx];
      const cssClass = this.getFCMStyle(sFmt);
      const cleanStat = (!sVal || sVal === '' || sVal === '%') ? '-' : sVal;
      return `<td class="${cssClass}">${cleanStat}</td>`;
    }).join('')}
                  </tr>
                `).join('')}

                <tr id="rvNoPlayersRow" style="display:none;">
                  <td colspan="${1 + matchdayCols.length + statCols.length}" class="text-center" style="padding:24px;color:var(--text-muted);">
                    Nessun calciatore trovato con i filtri selezionati.
                  </td>
                </tr>
              </tbody>

              <!-- PIÈ DI PAGINA: RIGHE DI RIEPILOGO -->
              ${summaryRows.length > 0 ? `
                <tfoot>
                  ${summaryRows.map(s => `
                    <tr class="${s.rowClass}">
                      <!-- Etichetta fissa della riga di riepilogo -->
                      <td class="rv-sticky-col" style="letter-spacing:0.04em;">
                        ${s.label}
                      </td>

                      <!-- Valori di giornata riepilogo con stili FCM -->
                      ${matchdayCols.map((_, colIdx) => {
      const val = s.votes[colIdx];
      const fmt = s.voteFormats[colIdx];
      const cssClass = this.getFCMStyle(fmt);
      const cleanVal = (!val || val === '?') ? '-' : val;
      return `<td class="${cssClass}">${cleanVal}</td>`;
    }).join('')}

                      <!-- 26 Statistiche per righe di riepilogo con stili FCM -->
                      ${statCols.map((_, colIdx) => {
      const sVal = s.stats[colIdx];
      const sFmt = s.statFormats[colIdx];
      const cssClass = this.getFCMStyle(sFmt);
      const cleanStat = (!sVal || sVal === '' || sVal === '%') ? '-' : sVal;
      return `<td class="${cssClass}">${cleanStat}</td>`;
    }).join('')}
                    </tr>
                  `).join('')}
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Associa gli eventi ai controlli interattivi
    this.attachEvents(container);
  },

  /**
   * Associa tutti gli ascoltatori di eventi per filtri, selezioni, scorrimento e legenda.
   */
  attachEvents(container) {
    // Funzione di filtro in tempo reale: mostra o nasconde le righe senza ricaricare la vista
    const applyFilters = () => {
      const q = this.searchQuery.toLowerCase().trim();
      const rows = container.querySelectorAll('.rv-player-row');
      let visibleCount = 0;

      rows.forEach(row => {
        const r = parseInt(row.getAttribute('data-role'), 10);
        const n = row.getAttribute('data-name') || '';
        const matchesRole = (this.roleFilter === 0 || r === this.roleFilter);
        const matchesSearch = (!q || n.includes(q));

        if (matchesRole && matchesSearch) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      const noRow = container.querySelector('#rvNoPlayersRow');
      if (noRow) {
        noRow.style.display = (visibleCount === 0) ? '' : 'none';
      }

      // Aggiorna l'indicatore attivo sui pulsanti dei ruoli
      const pills = container.querySelectorAll('.rv-filter-pill');
      pills.forEach(pill => {
        const roleVal = parseInt(pill.getAttribute('data-role'), 10);
        pill.classList.toggle('active', roleVal === this.roleFilter);
      });
    };

    // Gestione filtro di ricerca calciatore: preserva il focus e la stabilità dell'input
    const searchInput = container.querySelector('#inputFilterRegistri');
    const btnClearSearch = container.querySelector('#btnClearSearchRegistri');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (btnClearSearch) {
          btnClearSearch.style.display = this.searchQuery.trim().length > 0 ? 'inline-flex' : 'none';
        }
        applyFilters();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        btnClearSearch.style.display = 'none';
        applyFilters();
      });
    }

    // Gestione click sui pulsanti filtro per ruolo
    const pills = container.querySelectorAll('.rv-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        this.roleFilter = parseInt(e.currentTarget.getAttribute('data-role'), 10);
        applyFilters();
      });
    });

    // Selezione fantasquadra: carica il nuovo dataset del registro voti
    const teamSelect = container.querySelector('#selRegistriTeam');
    if (teamSelect) {
      teamSelect.addEventListener('change', (e) => {
        this.currentTeamId = parseInt(e.target.value, 10);
        this.render(container);
      });
    }

    // Selezione quotidiano/fonte voti: cambia la fonte dati delle colonne
    const quotSelect = container.querySelector('#selRegistriQuot');
    if (quotSelect) {
      quotSelect.addEventListener('change', (e) => {
        this.currentQuotId = parseInt(e.target.value, 10);
        this.render(container);
      });
    }

    // Controlli di scorrimento orizzontale (Inizio, <-, ->, Fine)
    const scrollWrapper = container.querySelector('.rv-scroll-wrapper');
    if (scrollWrapper) {
      const btnStart = container.querySelector('#rvBtnScrollStart');
      const btnLeft = container.querySelector('#rvBtnScrollLeft');
      const btnRight = container.querySelector('#rvBtnScrollRight');
      const btnEnd = container.querySelector('#rvBtnScrollEnd');

      if (btnStart) {
        btnStart.addEventListener('click', () => {
          scrollWrapper.scrollTo({ left: 0, behavior: 'smooth' });
        });
      }
      if (btnLeft) {
        btnLeft.addEventListener('click', () => {
          scrollWrapper.scrollBy({ left: -350, behavior: 'smooth' });
        });
      }
      if (btnRight) {
        btnRight.addEventListener('click', () => {
          scrollWrapper.scrollBy({ left: 350, behavior: 'smooth' });
        });
      }
      if (btnEnd) {
        btnEnd.addEventListener('click', () => {
          scrollWrapper.scrollTo({ left: scrollWrapper.scrollWidth, behavior: 'smooth' });
        });
      }
    }

    // Apertura/chiusura legenda con aggiornamento testo e stato attivo
    const btnLegend = container.querySelector('#btnToggleLegend');
    const legendCard = container.querySelector('#rvLegendCard');
    const btnLegendText = container.querySelector('#btnToggleLegendText');
    if (btnLegend && legendCard) {
      btnLegend.addEventListener('click', () => {
        this.showLegend = !this.showLegend;
        legendCard.style.display = this.showLegend ? 'block' : 'none';
        btnLegend.classList.toggle('active', this.showLegend);
        if (btnLegendText) {
          btnLegendText.textContent = this.showLegend ? 'Nascondi Legenda' : 'Legenda';
        }
      });
    }

    // Gestione dinamica del tab di scorrimento su mobile: scorre a metà schermo vincolato alla tabella
    const outerContainer = container.querySelector('.rv-table-outer-container');
    const floatingBar = container.querySelector('.rv-floating-scroll-bar');

    if (outerContainer && floatingBar) {
      if (this._scrollHandler) {
        window.removeEventListener('scroll', this._scrollHandler);
        window.removeEventListener('resize', this._scrollHandler);
      }

      this._scrollHandler = () => {
        if (window.innerWidth > 768) {
          floatingBar.style.position = '';
          floatingBar.style.top = '';
          floatingBar.style.bottom = '';
          floatingBar.style.right = '';
          floatingBar.style.transform = '';
          return;
        }

        const rect = outerContainer.getBoundingClientRect();
        const barHeight = floatingBar.offsetHeight || 110;
        const midScreen = window.innerHeight / 2;

        // Tabella sotto la metà dello schermo: ancora in cima alla tabella
        if (rect.top >= midScreen - barHeight / 2) {
          floatingBar.style.position = 'absolute';
          floatingBar.style.top = '4px';
          floatingBar.style.bottom = '';
          floatingBar.style.right = '2px';
          floatingBar.style.transform = 'none';
        }
        // Tabella sopra la metà dello schermo (fondo tabella superato): ancora in fondo alla tabella
        else if (rect.bottom <= midScreen + barHeight / 2) {
          floatingBar.style.position = 'absolute';
          floatingBar.style.top = 'auto';
          floatingBar.style.bottom = '18px';
          floatingBar.style.right = '2px';
          floatingBar.style.transform = 'none';
        }
        // Tabella a cavallo della metà schermo: fluttua a metà schermo (50vh)
        else {
          floatingBar.style.position = 'fixed';
          floatingBar.style.top = '50%';
          floatingBar.style.bottom = '';
          const rightOffset = Math.max(2, window.innerWidth - rect.right + 2);
          floatingBar.style.right = `${rightOffset}px`;
          floatingBar.style.transform = 'translateY(-50%)';
        }
      };

      window.addEventListener('scroll', this._scrollHandler, { passive: true });
      window.addEventListener('resize', this._scrollHandler, { passive: true });
      this._scrollHandler();
    }

    // Applica i filtri iniziali all'avvio
    applyFilters();
  }
};

// Espone GetFCMStyle a livello globale come in fcmRegistriFunzioni.js per retrocompatibilità
window.GetFCMStyle = function (f) {
  return registriView.getFCMStyle(f);
};
