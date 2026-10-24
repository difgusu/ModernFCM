/**
 * FANTAMASSIMI VIEW
 * Massimi ipotetici di giornata e confronto formazioni reali vs ideali
 * ModernFCM
 */

const fantaMassimiView = {
  currentDay: null,
  currentCompId: 0,   // 0 = Tutte
  currentDivId: 0,    // 0 = Tutte le divisioni
  currentTab: 'both', // 'both' | 'home' | 'away' | 'criteria'
  cachedFmData: {},   // Cache matchday -> arrFantamister

  // Scoring thresholds from FCM league rules (initialized dynamically)
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
  fattoreCampo: 2,
  valoreDifferenza3: 3,
  regolaDifferenza3: 'si',
  valoreDifferenza10: 10,
  regolaDifferenza10: 'no',
  primaSuNeutro: 37,

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
    if (typeof fattorecampo !== 'undefined') this.fattoreCampo = fattorecampo;
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
    if (typeof arrIncontri === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmCalendarioDati.js');
    }
    if (typeof xa1 === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADati.js');
    }
    if (typeof fgol1 === 'undefined') {
      try {
        await fcmDataLoader.loadScript('js/fcmCalcolorisultatiVariabili.js');
      } catch (e) { }
    }

    this.initThresholds();

    // Determine default matchday
    const calendar = fcmDataLoader.getCalendarData();
    const maxDay = calendar.maxA || (typeof MaxA !== 'undefined' ? MaxA : 38);
    if (this.currentDay === null) {
      this.currentDay = calendar.lastPlayed > 0 ? calendar.lastPlayed : maxDay;
    }

    // Parse URL params (e.g. #fantamassimi?gio=38&comp=1&div=1)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('gio')) {
        const g = parseInt(params.get('gio'), 10);
        if (!isNaN(g) && g >= 1 && g <= maxDay) this.currentDay = g;
      }
      if (params.has('comp')) {
        const c = parseInt(params.get('comp'), 10);
        if (!isNaN(c)) this.currentCompId = c;
      }
      if (params.has('div')) {
        const d = parseInt(params.get('div'), 10);
        if (!isNaN(d)) this.currentDivId = d;
      }
    }

    // Load fantamister data for current matchday
    await this.loadFantamDati(this.currentDay);

    this.renderContainer(container);
  },

  async loadFantamDati(day) {
    if (this.cachedFmData[day] !== undefined) return;

    // Define dummy constructor in window if not present
    if (typeof window.Fm === 'undefined') {
      window.Fm = function (Nome, Scarto, Voti, ScSuVoti, Parz, ModParz, Max, ModMax) {
        this.Nome = Nome;
        this.Scarto = Scarto;
        this.Voti = Voti;
        this.ScSuVoti = ScSuVoti;
        this.Parz = Parz;
        this.ModParz = ModParz;
        this.Max = Max;
        this.ModMax = ModMax;
      };
    }

    // Save existing arrFantamister reference
    window.arrFantamister = undefined;

    try {
      await fcmDataLoader.loadScript(`js/fcmFantamisterDati${day}.js`);
    } catch (e) {
      try {
        await fcmDataLoader.loadScript(`fantam/fcmFantamisterDati${day}.js`);
      } catch (err) {
        // File not available for this matchday
      }
    }

    if (typeof arrFantamister !== 'undefined' && Array.isArray(arrFantamister) && arrFantamister.length > 1) {
      this.cachedFmData[day] = [...arrFantamister];
    } else {
      this.cachedFmData[day] = null;
    }
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

    // Controllo autogol (< 59 e l'avversario ha >= punteggio + 3)
    if (maxCasa < this.gol0 && maxFuori >= (maxCasa + 3)) golFuori++;
    if (maxFuori < this.gol0 && maxCasa >= (maxFuori + 3)) golCasa++;

    return { Casa: golCasa, Fuori: golFuori };
  },

  regolaDifferenza(totaliCasa, totaliFuori, golCasa, golFuori) {
    let diffCasa = totaliCasa - totaliFuori;
    let diffFuori = totaliFuori - totaliCasa;

    if (this.regolaDifferenza3 === 'si' && diffCasa >= this.valoreDifferenza3 && golCasa === golFuori) {
      golCasa++;
    } else if (this.regolaDifferenza3 === 'si' && diffFuori >= this.valoreDifferenza3 && golCasa === golFuori) {
      golFuori++;
    }
    return { Casa: golCasa, Fuori: golFuori };
  },

  getEsito(golCasa, golFuori) {
    if (golCasa > golFuori) return '1';
    if (golCasa === golFuori) return 'X';
    return '2';
  },

  renderContainer(container) {
    const calendar = fcmDataLoader.getCalendarData();
    const maxDay = calendar.maxA || (typeof MaxA !== 'undefined' ? MaxA : 38);
    const comps = (typeof arrCompetizioni !== 'undefined' && Array.isArray(arrCompetizioni))
      ? arrCompetizioni.filter(c => c && c.ID > 0)
      : [];

    // Check available divisions from arrDivisioni
    let availableDivisions = [];
    if (typeof arrDivisioni !== 'undefined' && Array.isArray(arrDivisioni)) {
      availableDivisions = arrDivisioni.filter(d => d && d.ID > 0);
    }
    const hasMultipleDivisions = availableDivisions.length > 1;

    // Retrieve matches for current matchday and filters
    let rawMatches = [];
    if (typeof RiempiListaIncontri === 'function') {
      const list = RiempiListaIncontri(this.currentDay, this.currentCompId);
      if (list && list.length > 1) {
        for (let i = 1; i < list.length; i++) {
          if (list[i]) rawMatches.push(list[i]);
        }
      }
    }

    // Filter by division if selected
    if (this.currentDivId > 0 && typeof arrFantasquadre !== 'undefined') {
      const getTeamDiv = (id) => {
        const team = arrFantasquadre.find(t => t && t.ID === id);
        return team ? team.IDDivisione : 0;
      };
      rawMatches = rawMatches.filter(m => {
        const idCasa = (m.IDSquadre && m.IDSquadre.Casa) ? m.IDSquadre.Casa : m.IDCasa;
        const idFuori = (m.IDSquadre && m.IDSquadre.Fuori) ? m.IDSquadre.Fuori : m.IDFuori;
        return getTeamDiv(idCasa) === this.currentDivId || getTeamDiv(idFuori) === this.currentDivId;
      });
    }

    const fmList = this.cachedFmData[this.currentDay];
    const hasFmDati = Array.isArray(fmList) && fmList.length > 1;

    // Filter fmList for match teams when competition or division filter is active
    let filteredFmList = fmList;
    if (hasFmDati && (this.currentCompId > 0 || this.currentDivId > 0)) {
      const matchTeamNames = new Set();
      rawMatches.forEach(m => {
        if (m.Nomi) {
          if (m.Nomi.Casa) matchTeamNames.add(m.Nomi.Casa);
          if (m.Nomi.Fuori) matchTeamNames.add(m.Nomi.Fuori);
        } else {
          if (m.NomeCasa) matchTeamNames.add(m.NomeCasa);
          if (m.NomeFuori) matchTeamNames.add(m.NomeFuori);
        }
      });
      if (matchTeamNames.size > 0) {
        filteredFmList = fmList.filter(f => f && matchTeamNames.has(f.Nome));
      }
    }

    // Best and Worst FantaMister of the matchday
    let bestFm = null;
    let worstFm = null;
    if (Array.isArray(filteredFmList) && filteredFmList.length > 1) {
      const validFm = filteredFmList.filter(f => f && f.Nome);
      if (validFm.length > 0) {
        const sortedFm = [...validFm].sort((a, b) => (a.Scarto || 0) - (b.Scarto || 0));
        bestFm = sortedFm[0];
        worstFm = sortedFm[sortedFm.length - 1];
      }
    }

    container.innerHTML = `
      <style>
        .fm-desktop-view {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
        }
        .fm-mobile-view {
          display: none !important;
          flex-direction: column;
          gap: 5px;
          padding: 5px 6px;
        }
        .fm-ball-icons {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          flex-wrap: nowrap !important;
          gap: 2px !important;
          vertical-align: middle !important;
        }
        .fm-ball-icons img {
          display: inline-block !important;
          width: 15px !important;
          height: 15px !important;
          max-width: 15px !important;
          object-fit: contain !important;
          margin: 0 !important;
          flex-shrink: 0 !important;
        }
        @media screen and (max-width: 768px) {
          .fm-desktop-view {
            display: none !important;
          }
          .fm-mobile-view {
            display: flex !important;
          }
        }
      </style>
      <div class="card">
        <!-- Header -->
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
                <path d="M3 21h5v-6H3z"></path>
                <path d="M16 21h5v-9h-5z"></path>
                <path d="M9.5 15h5V9h-5z"></path>
                <path d="m12 2 1.2 2.4 2.6.4-1.9 1.9.4 2.6L12 8.1l-2.3 1.2.4-2.6L8.2 4.8l2.6-.4z"></path>
              </svg>
              FantaMassimi di Giornata
            </div>
            <div class="card-subtitle">Analisi e simulazione formazioni reali vs formazioni ottimali ideali</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <a href="#fantaclassifica" class="pill-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
              📈 Vai a FantaClassifica →
            </a>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="schede-filters-bar" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:16px;">
          <!-- Giornata Selector with Prev / Next -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:0.75rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;">
              Giornata:
            </label>
            <div style="display:flex;align-items:center;gap:4px;">
              <button type="button" id="btnPrevDay" class="pill-btn" style="padding:6px 10px;" ${this.currentDay <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>◀</button>
              <select id="selFmGiornata" class="form-select" style="font-weight:700;min-width:130px;">
                ${Array.from({ length: maxDay }, (_, i) => i + 1).map(d => `
                  <option value="${d}" ${d === this.currentDay ? 'selected' : ''}>Giornata ${d}</option>
                `).join('')}
              </select>
              <button type="button" id="btnNextDay" class="pill-btn" style="padding:6px 10px;" ${this.currentDay >= maxDay ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>▶</button>
            </div>
          </div>

          <!-- Competizione Selector -->
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;">
            <label for="selFmComp" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">
              Competizione:
            </label>
            <select id="selFmComp" class="form-select" style="width:100%;">
              <option value="0" ${this.currentCompId === 0 ? 'selected' : ''}>- Tutte le Competizioni -</option>
              ${comps.map(c => `
                <option value="${c.ID}" ${c.ID === this.currentCompId ? 'selected' : ''}>${c.Nome}</option>
              `).join('')}
            </select>
          </div>

          <!-- Divisione Selector (se presente più di 1 divisione) -->
          ${hasMultipleDivisions ? `
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px;">
              <label for="selFmDiv" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">
                Divisione:
              </label>
              <select id="selFmDiv" class="form-select" style="width:100%;">
                <option value="0" ${this.currentDivId === 0 ? 'selected' : ''}>- Tutte le Divisioni -</option>
                ${availableDivisions.map(d => `
                  <option value="${d.ID}" ${d.ID === this.currentDivId ? 'selected' : ''}>${d.Nome}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- KPI / Best & Worst of Matchday Banner -->
        ${hasFmDati && bestFm ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:18px;">
            <div style="background:var(--bg-surface-elevated);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;">👑</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.72rem;font-weight:800;color:var(--accent-emerald);text-transform:uppercase;">Miglior FantaMister</div>
                <div style="font-weight:800;font-size:1rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                  <img src="img/sq/${encodeURI(bestFm.Nome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(bestFm.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:18px;height:18px;object-fit:contain;" alt="" />
                  <span>${bestFm.Nome}</span>
                </div>
                <div style="font-size:0.76rem;color:var(--text-secondary);margin-top:2px;">
                  Scarto: <b style="color:var(--accent-emerald);">${bestFm.Scarto} pt</b> • Reale: <b>${bestFm.Parz}</b> (${bestFm.ModParz}) • Max: <b>${bestFm.Max}</b> (${bestFm.ModMax})
                </div>
              </div>
            </div>

            <div style="background:var(--bg-surface-elevated);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;">🌧️</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.72rem;font-weight:800;color:var(--accent-crimson);text-transform:uppercase;">Peggior FantaMister</div>
                <div style="font-weight:800;font-size:1rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                  <img src="img/sq/${encodeURI(worstFm.Nome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(worstFm.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:18px;height:18px;object-fit:contain;" alt="" />
                  <span>${worstFm.Nome}</span>
                </div>
                <div style="font-size:0.76rem;color:var(--text-secondary);margin-top:2px;">
                  Scarto: <b style="color:var(--accent-crimson);">${worstFm.Scarto} pt</b> • Reale: <b>${worstFm.Parz}</b> (${worstFm.ModParz}) • Max: <b>${worstFm.Max}</b> (${worstFm.ModMax})
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        ${!hasFmDati ? `
          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:12px 16px;border-radius:var(--radius-md);margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--accent-gold);">
            <span style="font-size:1.2rem;">ℹ️</span>
            <span>I dati di calcolo delle formazioni ideali FantaMister non sono presenti su disco per la <b>Giornata ${this.currentDay}</b>. Vengono mostrati i risultati effettivi registrati.</span>
          </div>
        ` : ''}

        <!-- Tab Bar -->
        <div class="pill-tabs wrap-tabs" id="fantaMassimiTabs" style="margin-bottom:18px;border-radius:var(--radius-md, 12px);padding:6px;">
          <button type="button" class="pill-btn ${this.currentTab === 'both' ? 'active' : ''}" data-tab="both">
            ⚡ Massimi Entrambe le Squadre
          </button>
          <button type="button" class="pill-btn ${this.currentTab === 'home' ? 'active' : ''}" data-tab="home">
            🏠 Massimi Solo Squadra Casa
          </button>
          <button type="button" class="pill-btn ${this.currentTab === 'away' ? 'active' : ''}" data-tab="away">
            ✈️ Massimi Solo Squadra Fuori
          </button>
          <button type="button" class="pill-btn ${this.currentTab === 'criteria' ? 'active' : ''}" data-tab="criteria">
            📐 Fasce Gol &amp; Regolamento
          </button>
        </div>

        <!-- Tab Content -->
        <div id="fantaMassimiTabContent">
          ${this.getTabHtml(rawMatches, fmList, hasFmDati)}
        </div>
      </div>
    `;

    // Attach listeners
    const selGio = container.querySelector('#selFmGiornata');
    if (selGio) {
      selGio.addEventListener('change', async (e) => {
        this.currentDay = parseInt(e.target.value, 10);
        await this.loadFantamDati(this.currentDay);
        this.renderContainer(container);
      });
    }

    const btnPrev = container.querySelector('#btnPrevDay');
    if (btnPrev && this.currentDay > 1) {
      btnPrev.addEventListener('click', async () => {
        this.currentDay--;
        await this.loadFantamDati(this.currentDay);
        this.renderContainer(container);
      });
    }

    const btnNext = container.querySelector('#btnNextDay');
    if (btnNext && this.currentDay < maxDay) {
      btnNext.addEventListener('click', async () => {
        this.currentDay++;
        await this.loadFantamDati(this.currentDay);
        this.renderContainer(container);
      });
    }

    const selComp = container.querySelector('#selFmComp');
    if (selComp) {
      selComp.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value, 10);
        this.renderContainer(container);
      });
    }

    const selDiv = container.querySelector('#selFmDiv');
    if (selDiv) {
      selDiv.addEventListener('change', (e) => {
        this.currentDivId = parseInt(e.target.value, 10);
        this.renderContainer(container);
      });
    }

    container.querySelectorAll('#fantaMassimiTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#fantaMassimiTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab');
        const tabContent = container.querySelector('#fantaMassimiTabContent');
        if (tabContent) {
          tabContent.innerHTML = this.getTabHtml(rawMatches, fmList, hasFmDati);
        }
      });
    });
  },

  renderBallIcons(numBlack, hasYellow, numRed, isRightAligned) {
    let html = '';
    const style = 'width:15px;height:15px;object-fit:contain;vertical-align:middle;display:inline-block !important;margin:0 1px;flex-shrink:0;';
    for (let i = 0; i < numBlack; i++) {
      html += `<img src="img/golBlack.png" style="${style}" title="Gol effettivo" alt="⚽" />`;
    }
    if (hasYellow) {
      html += `<img src="img/golYellow.png" style="${style}" title="Autogol evitabile" alt="⚠️" />`;
    }
    for (let i = 0; i < numRed; i++) {
      html += `<img src="img/golRed.png" style="${style}" title="Gol mancato" alt="🔴" />`;
    }
    const justify = isRightAligned ? 'justify-content:flex-end;' : 'justify-content:flex-start;';
    return `<div class="fm-ball-icons" style="display:inline-flex;flex-direction:row;align-items:center;gap:2px;flex-wrap:nowrap;${justify}">${html}</div>`;
  },

  getTabHtml(rawMatches, fmList, hasFmDati) {
    if (this.currentTab === 'criteria') {
      return this.getCriteriaHtml();
    }

    if (!rawMatches || rawMatches.length === 0) {
      return `
        <div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-surface);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          Nessun incontro trovato per la giornata e i filtri selezionati.
        </div>
      `;
    }

    // Group matches strictly by competition
    const groups = {};
    rawMatches.forEach(inc => {
      const compId = inc.IDCompetizione || 0;
      const compName = inc.Competizione || 'Campionato';
      if (!groups[compId]) {
        groups[compId] = {
          compId: compId,
          compName: compName,
          matches: []
        };
      }
      groups[compId].matches.push(inc);
    });

    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${Object.values(groups).map(grp => `
          <div class="fantamassimi-comp-block">
            <div style="display:flex;align-items:center;gap:8px;background:var(--bg-surface-elevated);border-left:4px solid var(--accent-primary);padding:6px 12px;border-radius:var(--radius-sm);margin-bottom:8px;border:1px solid var(--border-subtle);border-left-width:4px;">
              <span style="font-size:1.05rem;">🏆</span>
              <span style="font-weight:800;font-size:0.9rem;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.5px;">${grp.compName}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${grp.matches.map(inc => this.renderMatchCard(inc, fmList, hasFmDati)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderMatchCard(inc, fmList, hasFmDati) {
    const nomiCasa = (inc.Nomi && inc.Nomi.Casa) ? inc.Nomi.Casa : (inc.NomeCasa || '');
    const nomiFuori = (inc.Nomi && inc.Nomi.Fuori) ? inc.Nomi.Fuori : (inc.NomeFuori || '');
    const totaliCasa = (inc.Totali && inc.Totali.Casa !== undefined) ? inc.Totali.Casa : (inc.TotaleCasa || 0);
    const totaliFuori = (inc.Totali && inc.Totali.Fuori !== undefined) ? inc.Totali.Fuori : (inc.TotaleFuori || 0);
    const parzCasa = (inc.Parziali && inc.Parziali.Casa !== undefined) ? inc.Parziali.Casa : 0;
    const parzFuori = (inc.Parziali && inc.Parziali.Fuori !== undefined) ? inc.Parziali.Fuori : 0;
    const golRealiCasa = (inc.Gol && inc.Gol.Casa !== undefined) ? inc.Gol.Casa : (inc.GolCasa || 0);
    const golRealiFuori = (inc.Gol && inc.Gol.Fuori !== undefined) ? inc.Gol.Fuori : (inc.GolFuori || 0);

    // Look up fantamister
    let fmCasa = null;
    let fmFuori = null;
    if (hasFmDati && Array.isArray(fmList)) {
      fmCasa = fmList.find(f => f && f.Nome === nomiCasa);
      fmFuori = fmList.find(f => f && f.Nome === nomiFuori);
    }

    const rawMaxCasa = fmCasa ? fmCasa.Max : parzCasa;
    const rawMaxFuori = fmFuori ? fmFuori.Max : parzFuori;
    const isNeutro = (this.currentDay >= this.primaSuNeutro);
    const maxCasa = isNeutro ? rawMaxCasa : (rawMaxCasa + this.fattoreCampo);
    const maxFuori = rawMaxFuori;

    const scartoCasa = fmCasa ? fmCasa.Scarto : Math.max(0, Number((maxCasa - totaliCasa).toFixed(2)));
    const scartoFuori = fmFuori ? fmFuori.Scarto : Math.max(0, Number((maxFuori - totaliFuori).toFixed(2)));

    // Autogol evitabile check (quando il punteggio reale è < 59 ma con il max ideale raggiunge o supera 59)
    const autogolCasa = (totaliCasa < this.gol0 && maxCasa >= this.gol0);
    const autogolFuori = (totaliFuori < this.gol0 && maxFuori >= this.gol0);

    let simCasaTot = totaliCasa;
    let simFuoriTot = totaliFuori;
    let titleBadge = '';
    let centerScoreDetail = '';

    if (this.currentTab === 'both') {
      simCasaTot = maxCasa;
      simFuoriTot = maxFuori;
      titleBadge = 'Massimi Entrambe le Squadre';
      centerScoreDetail = `<b>${maxCasa}</b> - <b>${maxFuori}</b>`;
    } else if (this.currentTab === 'home') {
      simCasaTot = maxCasa;
      simFuoriTot = totaliFuori;
      titleBadge = 'Massimi Solo Squadra Casa';
      centerScoreDetail = `<b>${maxCasa}</b> - ${totaliFuori}`;
    } else if (this.currentTab === 'away') {
      simCasaTot = totaliCasa;
      simFuoriTot = maxFuori;
      titleBadge = 'Massimi Solo Squadra Fuori';
      centerScoreDetail = `${totaliCasa} - <b>${maxFuori}</b>`;
    }

    // Simulated goals
    const baseG = this.getGol(simCasaTot, simFuoriTot);
    const diffG = this.regolaDifferenza(simCasaTot, simFuoriTot, baseG.Casa, baseG.Fuori);
    const golSimCasa = diffG.Casa;
    const golSimFuori = diffG.Fuori;

    const realEsito = this.getEsito(golRealiCasa, golRealiFuori);
    const simEsito = this.getEsito(golSimCasa, golSimFuori);
    const esitoCambiato = realEsito !== simEsito;

    // Goals missed calculation (actual missed goals scored in ideal lineup minus real lineup)
    let golMancatiCasa = 0;
    if (this.currentTab === 'both' || this.currentTab === 'home') {
      golMancatiCasa = Math.max(0, golSimCasa - golRealiCasa);
    }
    let golMancatiFuori = 0;
    if (this.currentTab === 'both' || this.currentTab === 'away') {
      golMancatiFuori = Math.max(0, golSimFuori - golRealiFuori);
    }

    // Helper text for missed / autogol
    const getGolMancatiTxt = (isAutogol, missed) => {
      if (isAutogol && missed === 0) return 'Autogol evitabile';
      if (isAutogol && missed === 1) return 'Autogol evitabile e 1 Gol Mancato';
      if (isAutogol && missed >= 2) return `Autogol evitabile e ${missed} Gol Mancati`;
      if (missed === 1) return '1 Gol Mancato';
      if (missed >= 2) return `${missed} Gol Mancati`;
      return '';
    };

    const txtCasa = getGolMancatiTxt(autogolCasa, golMancatiCasa);
    const txtFuori = getGolMancatiTxt(autogolFuori, golMancatiFuori);

    // Ball icons: black = reali, yellow = autogol evitabile, red = gol mancati
    const ballIconsCasa = (this.currentTab === 'away')
      ? this.renderBallIcons(golRealiCasa, false, 0, true)
      : this.renderBallIcons(golRealiCasa, autogolCasa, golMancatiCasa, true);

    const ballIconsFuori = (this.currentTab === 'home')
      ? this.renderBallIcons(golRealiFuori, false, 0, false)
      : this.renderBallIcons(golRealiFuori, autogolFuori, golMancatiFuori, false);

    // Scarto bar widths (proportional to scarto points)
    const scartoBarW_Casa = Math.min(120, Math.max(6, Math.round(scartoCasa * 6)));
    const scartoBarW_Fuori = Math.min(120, Math.max(6, Math.round(scartoFuori * 6)));

    return `
      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:8px;">
        <!-- ================= DESKTOP LAYOUT (Widescreen >= 768px) ================= -->
        <div class="fm-desktop-view">
          <!-- Home Team -->
          <div style="min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;">
            <div style="display:flex;align-items:center;gap:8px;max-width:100%;">
              <img src="img/sq/${encodeURI(nomiCasa)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(nomiCasa)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" alt="" />
              <span style="font-weight:800;font-size:1rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nomiCasa}</span>
            </div>

            <!-- Scores details (show max only in 'both' and 'home' tabs) -->
            <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span>Reale: <b>${totaliCasa}</b> ${fmCasa ? `(${fmCasa.ModParz})` : ''}</span>
              ${(this.currentTab === 'both' || this.currentTab === 'home') && fmCasa ? `
                <span style="color:var(--accent-emerald);font-weight:700;">• Max: <b>${maxCasa}</b> (${fmCasa.ModMax})</span>
              ` : ''}
            </div>

            <!-- Ball icons & missed goals text -->
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;margin-top:1px;">
              ${ballIconsCasa}
              ${(this.currentTab === 'both' || this.currentTab === 'home') && txtCasa ? `
                <span style="font-size:0.7rem;background:${autogolCasa ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)'};color:${autogolCasa ? 'var(--accent-gold)' : 'var(--accent-crimson)'};padding:1px 5px;border-radius:var(--radius-sm);font-weight:700;white-space:nowrap;">
                  ${txtCasa}
                </span>
              ` : ''}
            </div>

            <!-- Scarto bar (shown when max is active) -->
            ${(this.currentTab === 'both' || this.currentTab === 'home') && scartoCasa > 0 ? `
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                <span style="font-size:0.7rem;color:var(--text-muted);">Scarto: <b>${scartoCasa} pt</b></span>
                <div style="background:linear-gradient(90deg, #ef4444, #f97316);height:6px;width:${scartoBarW_Casa}px;max-width:130px;border-radius:2px;" title="Scarto: ${scartoCasa} pt"></div>
              </div>
            ` : ''}
          </div>

          <!-- Middle Scores: Real vs Simulated -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 6px;flex-shrink:0;">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;">
              <!-- Real Score: label sopra, risultato a capo -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Reale</span>
                <span style="font-size:1.15rem;font-weight:800;color:var(--text-secondary);background:var(--bg-surface-elevated);padding:1px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);line-height:1.2;">
                  ${golRealiCasa} - ${golRealiFuori}
                </span>
              </div>

              <!-- Simulated Score: label sopra, risultato a capo -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:0.65rem;color:var(--accent-cyan);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Ideale</span>
                <span style="font-size:1.3rem;font-weight:900;color:var(--accent-cyan);background:rgba(6,182,212,0.1);padding:1px 10px;border-radius:var(--radius-sm);border:1px solid rgba(6,182,212,0.3);line-height:1.2;">
                  ${golSimCasa} - ${golSimFuori}
                </span>
              </div>
            </div>

            <!-- Center Score Details (e.g. 78.5 - 72) -->
            <div style="font-size:0.72rem;color:var(--text-secondary);font-family:monospace;margin-top:1px;">
              ${centerScoreDetail}
            </div>

            <!-- Outcome Variation Badge -->
            ${esitoCambiato ? `
              <span style="font-size:0.65rem;font-weight:800;background:rgba(239,68,68,0.12);color:var(--accent-crimson);padding:1px 6px;border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.25);text-align:center;">
                Esito Cambiato (${realEsito} → ${simEsito})
              </span>
            ` : `
              <span style="font-size:0.65rem;color:var(--text-muted);">Esito Invariato (${realEsito})</span>
            `}
          </div>

          <!-- Away Team -->
          <div style="min-width:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right;">
            <div style="display:flex;align-items:center;gap:8px;flex-direction:row-reverse;max-width:100%;">
              <img src="img/sq/${encodeURI(nomiFuori)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(nomiFuori)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" alt="" />
              <span style="font-weight:800;font-size:1rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nomiFuori}</span>
            </div>

            <!-- Scores details (show max only in 'both' and 'away' tabs) -->
            <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;">
              <span>Reale: <b>${totaliFuori}</b> ${fmFuori ? `(${fmFuori.ModParz})` : ''}</span>
              ${(this.currentTab === 'both' || this.currentTab === 'away') && fmFuori ? `
                <span style="color:var(--accent-emerald);font-weight:700;">• Max: <b>${maxFuori}</b> (${fmFuori.ModMax})</span>
              ` : ''}
            </div>

            <!-- Ball icons & missed goals text -->
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;justify-content:flex-end;margin-top:1px;">
              ${(this.currentTab === 'both' || this.currentTab === 'away') && txtFuori ? `
                <span style="font-size:0.7rem;background:${autogolFuori ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)'};color:${autogolFuori ? 'var(--accent-gold)' : 'var(--accent-crimson)'};padding:1px 5px;border-radius:var(--radius-sm);font-weight:700;white-space:nowrap;">
                  ${txtFuori}
                </span>
              ` : ''}
              ${ballIconsFuori}
            </div>
            
            <!-- Scarto bar (shown when max is active) -->
            ${(this.currentTab === 'both' || this.currentTab === 'away') && scartoFuori > 0 ? `
              <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:2px;">
                <div style="background:linear-gradient(90deg, #f97316, #ef4444);height:6px;width:${scartoBarW_Fuori}px;max-width:130px;border-radius:2px;" title="Scarto: ${scartoFuori} pt"></div>
                <span style="font-size:0.7rem;color:var(--text-muted);">Scarto: <b>${scartoFuori} pt</b></span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ================= MOBILE LAYOUT (Stacked & Optimized for <= 768px) ================= -->
        <div class="fm-mobile-view">
          <!-- Top Scoreboard Banner -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:5px 8px;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;justify-content:space-around;align-items:flex-end;gap:8px;">
              <!-- Reale (label sopra, risultato a capo) -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:0.65rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Reale</span>
                <span style="font-size:1.05rem;font-weight:800;color:var(--text-secondary);background:var(--bg-surface);padding:1px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);line-height:1.2;">
                  ${golRealiCasa} - ${golRealiFuori}
                </span>
              </div>

              <!-- Ideale (label sopra, risultato a capo) -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-size:0.65rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;letter-spacing:0.5px;">Ideale</span>
                <span style="font-size:1.15rem;font-weight:900;color:var(--accent-cyan);background:rgba(6,182,212,0.12);padding:1px 10px;border-radius:var(--radius-sm);border:1px solid rgba(6,182,212,0.3);line-height:1.2;">
                  ${golSimCasa} - ${golSimFuori}
                </span>
              </div>
            </div>

            <!-- Score Details & Outcome Badge -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:3px;border-top:1px dashed var(--border-subtle);margin-top:1px;">
              <span style="font-size:0.7rem;color:var(--text-secondary);font-family:monospace;">${centerScoreDetail}</span>
              ${esitoCambiato ? `
                <span style="font-size:0.65rem;font-weight:800;background:rgba(239,68,68,0.12);color:var(--accent-crimson);padding:1px 5px;border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.25);">
                  Esito Cambiato (${realEsito} → ${simEsito})
                </span>
              ` : `
                <span style="font-size:0.65rem;color:var(--text-muted);">Esito Invariato (${realEsito})</span>
              `}
            </div>
          </div>

          <!-- Casa Team Box -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:5px 8px;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;align-items:center;gap:6px;">
                <img src="img/sq/${encodeURI(nomiCasa)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(nomiCasa)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                <span style="font-weight:800;font-size:0.88rem;color:var(--text-primary);">${nomiCasa}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">(Casa)</span>
              </div>
              ${ballIconsCasa}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;font-size:0.72rem;color:var(--text-secondary);">
              <div>
                <span>Reale: <b>${totaliCasa}</b> ${fmCasa ? `(${fmCasa.ModParz})` : ''}</span>
                ${(this.currentTab === 'both' || this.currentTab === 'home') && fmCasa ? `
                  <span style="color:var(--accent-emerald);font-weight:700;"> • Max: <b>${maxCasa}</b> (${fmCasa.ModMax})</span>
                ` : ''}
              </div>
              ${(this.currentTab === 'both' || this.currentTab === 'home') && txtCasa ? `
                <span style="font-size:0.65rem;background:${autogolCasa ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)'};color:${autogolCasa ? 'var(--accent-gold)' : 'var(--accent-crimson)'};padding:1px 5px;border-radius:var(--radius-sm);font-weight:700;">
                  ${txtCasa}
                </span>
              ` : ''}
            </div>

            ${(this.currentTab === 'both' || this.currentTab === 'home') && scartoCasa > 0 ? `
              <div style="display:flex;align-items:center;gap:6px;padding-top:3px;border-top:1px dashed var(--border-subtle);margin-top:1px;">
                <span style="font-size:0.68rem;color:var(--text-muted);">Scarto: <b>${scartoCasa} pt</b></span>
                <div style="background:linear-gradient(90deg, #ef4444, #f97316);height:5px;width:${scartoBarW_Casa}px;max-width:110px;border-radius:2px;"></div>
              </div>
            ` : ''}
          </div>

          <!-- Fuori Team Box -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:5px 8px;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;align-items:center;gap:6px;">
                <img src="img/sq/${encodeURI(nomiFuori)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(nomiFuori)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;" alt="" />
                <span style="font-weight:800;font-size:0.88rem;color:var(--text-primary);">${nomiFuori}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">(Fuori)</span>
              </div>
              ${ballIconsFuori}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;font-size:0.72rem;color:var(--text-secondary);">
              <div>
                <span>Reale: <b>${totaliFuori}</b> ${fmFuori ? `(${fmFuori.ModParz})` : ''}</span>
                ${(this.currentTab === 'both' || this.currentTab === 'away') && fmFuori ? `
                  <span style="color:var(--accent-emerald);font-weight:700;"> • Max: <b>${maxFuori}</b> (${fmFuori.ModMax})</span>
                ` : ''}
              </div>
              ${(this.currentTab === 'both' || this.currentTab === 'away') && txtFuori ? `
                <span style="font-size:0.65rem;background:${autogolFuori ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)'};color:${autogolFuori ? 'var(--accent-gold)' : 'var(--accent-crimson)'};padding:1px 5px;border-radius:var(--radius-sm);font-weight:700;">
                  ${txtFuori}
                </span>
              ` : ''}
            </div>

            ${(this.currentTab === 'both' || this.currentTab === 'away') && scartoFuori > 0 ? `
              <div style="display:flex;align-items:center;gap:6px;padding-top:3px;border-top:1px dashed var(--border-subtle);margin-top:1px;">
                <span style="font-size:0.68rem;color:var(--text-muted);">Scarto: <b>${scartoFuori} pt</b></span>
                <div style="background:linear-gradient(90deg, #f97316, #ef4444);height:5px;width:${scartoBarW_Fuori}px;max-width:110px;border-radius:2px;"></div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  getCriteriaHtml() {
    return `
      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:20px;">
        <h3 style="margin:0 0 12px 0;font-size:1.1rem;color:var(--accent-cyan);display:flex;align-items:center;gap:6px;">
          <span>📐</span> Fasce Gol e Regolamento di Calcolo
        </h3>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
          I punteggi massimi calcolano il totale teorico ottenibile schierando la miglior combinazione tattica consentita tra i calciatori a disposizione, escludendo voti d'ufficio e penalità straordinarie.
        </p>

        <div style="overflow-x:auto;margin-bottom:20px;">
          <table class="modern-table" style="width:100%;font-size:0.85rem;">
            <thead>
              <tr>
                <th style="text-align:center;">Fascia Gol</th>
                <th>Soglia Minima Punti</th>
                <th>Soglia Massima Punti</th>
                <th>Gol Assegnati</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="text-align:center;color:var(--accent-crimson);font-weight:800;">Autogol</td><td>Punteggio &lt; 59</td><td>Avversario &ge; Punti + 3</td><td>-1 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 0</td><td>0</td><td>65.5</td><td>0 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 1</td><td>66.0</td><td>71.5</td><td>1 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 2</td><td>72.0</td><td>76.5</td><td>2 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 3</td><td>77.0</td><td>80.5</td><td>3 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 4</td><td>81.0</td><td>84.5</td><td>4 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 5</td><td>85.0</td><td>88.5</td><td>5 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 6</td><td>89.0</td><td>92.5</td><td>6 Gol</td></tr>
              <tr><td style="text-align:center;font-weight:700;">Fascia 7+</td><td>93.0</td><td>+4 pt a scatto</td><td>7+ Gol</td></tr>
            </tbody>
          </table>
        </div>

        <div style="background:var(--bg-surface-elevated);border-left:4px solid var(--accent-primary);padding:12px 14px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">
          <b>Regole Particolari:</b>
          <br>• <b>Fattore Campo:</b> +2 punti aggiunti alla squadra di casa per le partite disputate prima della giornata 37.
          <br>• <b>Regola Differenza 3 Punti:</b> a parità di gol assegnati con scarto pari o superiore a 3 punti viene assegnato un gol supplementare alla squadra con punteggio superiore.
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.fantaMassimiView = fantaMassimiView;
}
