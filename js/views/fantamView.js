/**
 * FANTAMISTER VIEW (SPA Native)
 * Analisi tecnica, scelte dei fantallenatori, formazioni ideali, fantamarcatori,
 * Top/Flop 11 con campetto tattico, incompresi, uomini partita e statistiche per fantasquadra.
 * Riscritta nativamente da fcmFantamisterMotore senza dipendenze esterne.
 * ModernFCM
 */

const fantamView = {
  currentTab: 'fantamister', // 'fantamister', 'moduli_bonus', 'giornate', 'bestrose', 'cannonieri', 'calenbomber', 'incompresi', 'uomopartita', 'topflop', 'fantasfiga', 'teams', 'legenda'
  selectedCompId: 0,
  sortColumn: 'scartoMedio',      // Default: scartoMedio ascendente (salvato in localStorage)
  sortDirection: 'asc',           // 'asc' | 'desc'
  _sortLoaded: false,
  showFullFmTableMobile: false,   // Toggle per mostrare la classifica FantaMister completa su mobile (Punto 3)
  selectedTopFlopModule: 'auto',  // Modulo tattico selezionato per Top/Flop 11 ('auto' o '3-4-3', ecc. - Punto 2)
  subTab: {
    moduli_bonus: 'moduli_dettaglio', // 'moduli_dettaglio', 'bonus_percent', 'bonus_media', 'moduli_globale', 'moduli_assoluto'
    incompresi: 'media',              // 'media', 'totale'
    topflop: 'giornata',              // 'giornata', 'stagione'
    topflopType: 'top'                // 'top', 'flop'
  },
  selectedTeamId: null,
  selectedCalenDay: null,
  selectedGiornateDay: null,
  selectedTopFlopDay: null,
  selectedIdealMod: {},               // Mappa `${day}_${teamId}` -> modulo ideale attivo
  selectedRealComp: {},               // Mappa `${day}_${teamId}` -> variante formazione reale attiva per competizione
  expandedRows: {},
  searchFilter: '',

  /**
   * Carica e salva preferenze di ordinamento Classifica FantaMister in localStorage
   */
  loadSortPreferences() {
    if (this._sortLoaded) return;
    this._sortLoaded = true;
    try {
      const savedCol = localStorage.getItem('fcm_fantam_sort_col');
      const savedDir = localStorage.getItem('fcm_fantam_sort_dir');
      if (savedCol) this.sortColumn = savedCol;
      if (savedDir === 'asc' || savedDir === 'desc') this.sortDirection = savedDir;
    } catch (e) {
      // ignore localStorage errors
    }
  },

  saveSortPreferences() {
    try {
      localStorage.setItem('fcm_fantam_sort_col', this.sortColumn);
      localStorage.setItem('fcm_fantam_sort_dir', this.sortDirection);
    } catch (e) {
      // ignore localStorage errors
    }
  },

  /**
   * Helper per verificare se una squadra è la preferita del cuore
   */
  isFavTeam(teamIdOrName) {
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.isFavoriteTeam === 'function') {
      return fcmDataLoader.isFavoriteTeam(teamIdOrName);
    }
    if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.isFavoriteTeam === 'function') {
      return fcmHomeConfigManager.isFavoriteTeam(teamIdOrName);
    }
    return false;
  },

  /**
   * Risolve la fantasquadra attuale di un calciatore (Stato 0 o 2 in arrRose)
   */
  resolveCurrentTeamId(playerOrName, fallbackTeamId = 0) {
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer));
    if (rawName && typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getCurrentPlayerTeamId === 'function') {
      return fcmFantamisterMotore.getCurrentPlayerTeamId(rawName, fallbackTeamId);
    }
    return fallbackTeamId;
  },

  /**
   * Helper per ottenere il link a #schede_giocatori per un calciatore
   */
  getPlayerLink(playerOrName) {
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer));
    if (!rawName) return null;
    const clean = String(rawName).toLowerCase();
    if (clean.includes("riserva d'ufficio") || clean.includes("assente") || clean.includes("---")) return null;
    const objId = (typeof playerOrName === 'object' && playerOrName && playerOrName.id && parseInt(playerOrName.id, 10) > 0)
      ? parseInt(playerOrName.id, 10)
      : null;
    if (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPlayerProfileLink) {
      const code = (typeof playerOrName === 'object' && playerOrName) ? (playerOrName.code || playerOrName.codice) : null;
      return fcmDataLoader.getPlayerProfileLink({ name: rawName, id: objId, code });
    }
    const pId = objId || (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieAPlayerId === 'function'
      ? fcmDataLoader.getSerieAPlayerId(rawName)
      : null);
    return pId ? `#schede_giocatori?id=${pId}` : `#schede_giocatori?name=${encodeURIComponent(rawName)}`;
  },

  /**
   * Formatta lo scarto pesato (.877 se < 1, 1.042 se >= 1)
   */
  formatScartoPesato(val) {
    if (val === undefined || val === null || isNaN(val)) return '-';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '-';
    if (num >= 1) return num.toFixed(3);
    return `.${String(Math.round(num * 1000)).padStart(3, '0')}`;
  },

  /**
   * Renderizza il nome del calciatore con link a #schede_giocatori
   */
  renderPlayerName(playerOrName, customStyle = '') {
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer || ''));
    const href = this.getPlayerLink(playerOrName);
    if (!href) {
      return `<span class="fantam-player-name-span" style="${customStyle}">${rawName}</span>`;
    }
    return `<a href="${href}" class="fantam-player-link" style="${customStyle}">${rawName}</a>`;
  },

  /**
   * Risolve il club di Serie A di un calciatore (da oggetto o cercando in arrRose)
   */
  resolvePlayerSerieAClub(playerOrName) {
    if (typeof playerOrName === 'object' && playerOrName) {
      if (playerOrName.club) return playerOrName.club;
      if (playerOrName.serieATeam) return playerOrName.serieATeam;
    }
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer || ''));
    if (rawName && typeof arrRose !== 'undefined' && Array.isArray(arrRose)) {
      const target = String(rawName).trim().toUpperCase();
      for (let i = 1; i < arrRose.length; i++) {
        const r = arrRose[i];
        if (r && (r.Stato === 0 || r.Stato === 2) && String(r.Nome || '').trim().toUpperCase() === target && r.Squadra) {
          return r.Squadra;
        }
      }
      for (let i = 1; i < arrRose.length; i++) {
        const r = arrRose[i];
        if (r && String(r.Nome || '').trim().toUpperCase() === target && r.Squadra) {
          return r.Squadra;
        }
      }
    }
    return '';
  },

  /**
   * Restituisce l'URL della miniatura foto del calciatore
   */
  getPlayerThumbUrl(playerOrName) {
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer || ''));
    if (rawName && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function') {
      return fcmDataLoader.getPlayerPhoto(rawName);
    }
    return 'img/foto/misterx.gif';
  },

  /**
   * Renderizza la miniatura circolare del calciatore con link a #schede_giocatori,
   * effetto hover zoom e minilogo della squadra di Serie A in basso a destra
   */
  renderPlayerThumb(playerOrName, size = 30) {
    const rawName = (typeof playerOrName === 'string')
      ? playerOrName
      : (playerOrName && (playerOrName.name || playerOrName.player || playerOrName.rawPlayer || ''));
    const url = this.getPlayerThumbUrl(playerOrName);
    const href = this.getPlayerLink(playerOrName);
    const club = this.resolvePlayerSerieAClub(playerOrName);
    const clubLogo = (club && typeof fcmDataLoader !== 'undefined')
      ? (typeof fcmDataLoader.getSerieALogo === 'function'
        ? fcmDataLoader.getSerieALogo(club)
        : (typeof fcmDataLoader.getClubBadge === 'function' ? fcmDataLoader.getClubBadge(club) : ''))
      : '';
    const inner = `
      <img src="${url}" class="fantam-player-thumb" style="width:${size}px;height:${size}px;" alt="${rawName}" loading="lazy" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
      ${clubLogo ? `<img src="${clubLogo}" class="fantam-club-badge" title="${club}" alt="${club}" onerror="this.style.display='none';" />` : ''}
    `;
    if (href) {
      return `<a href="${href}" class="fantam-player-avatar" title="Apri scheda di ${rawName}">${inner}</a>`;
    }
    return `<span class="fantam-player-avatar" title="${rawName}">${inner}</span>`;
  },

  /**
   * Helper per ottenere il link alla pagina #rose della fantasquadra
   */
  getTeamRoseLink(teamId, teamName = null) {
    let tId = parseInt(teamId, 10);
    if ((!tId || isNaN(tId)) && teamName) {
      const cleanName = String(teamName).trim().toLowerCase();
      if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
        const found = arrFantasquadre.find(t => t && String(t.Nome || t.nome || t.name || '').trim().toLowerCase() === cleanName);
        if (found) tId = found.ID || found.id;
      }
      if ((!tId || isNaN(tId)) && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeams === 'function') {
        const found = fcmDataLoader.getTeams().find(t => t && String(t.Nome || t.nome || t.name || '').trim().toLowerCase() === cleanName);
        if (found) tId = found.ID || found.id;
      }
    }
    return tId && !isNaN(tId) ? `#rose?team=${tId}` : '#rose';
  },

  /**
   * Renderizza inline la maglia e il nome di una fantasquadra con link a #rose e hover zoom sulla maglia
   */
  renderTeamInline(teamId, teamName = null, imgSize = 20, textStyle = 'font-weight:700;color:var(--text-primary);font-size:0.84rem;') {
    const name = teamName || this.getTeamName(teamId);
    const isFav = this.isFavTeam(teamId) || this.isFavTeam(name);
    const logo = this.getTeamLogo(teamId, name);
    const href = this.getTeamRoseLink(teamId, name);
    return `
      <a href="${href}" class="fantam-team-link" title="Vai alla rosa di ${name}" style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;">
        <img src="${logo}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(name)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:${imgSize}px;height:${imgSize}px;object-fit:contain;flex-shrink:0;" alt="" />
        <span style="${textStyle}">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${name}</span></span>
      </a>
    `;
  },

  /**
   * Helper per ottenere il nome squadra corretto
   */
  getTeamName(teamId) {
    const tId = parseInt(teamId, 10);
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      const found = arrFantasquadre.find(t => t && t.ID === tId);
      if (found) return found.Nome || found.nome || found.name;
    }
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamById === 'function') {
      const found = fcmDataLoader.getTeamById(tId);
      if (found) return found.Nome || found.nome || found.name;
    }
    return `Squadra ${tId}`;
  },

  /**
   * Helper per ottenere il logo della squadra
   */
  getTeamLogo(teamId, teamName = null) {
    const name = teamName || this.getTeamName(teamId);
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function') {
      return fcmDataLoader.getTeamLogo(teamId || name);
    }
    return `img/sq/${encodeURI(name)}.png`;
  },

  /**
   * Helper badge ruolo
   */
  getRoleBadge(role) {
    const r = parseInt(role, 10);
    if (r === 1) return '<span class="role-badge role-p">P</span>';
    if (r === 2) return '<span class="role-badge role-d">D</span>';
    if (r === 3) return '<span class="role-badge role-c">C</span>';
    return '<span class="role-badge role-a">A</span>';
  },

  /**
   * Helper nome competizione
   */
  getCompName(compId) {
    const cId = parseInt(compId, 10);
    if (cId === 0) return 'Tutte le competizioni';
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function') {
      const comps = fcmDataLoader.getCompetitions();
      const found = comps.find(c => c.id === cId || c.ID === cId);
      if (found) return found.name || found.Nome || '';
    }
    if (typeof arrCompetizioni !== 'undefined') {
      const c = arrCompetizioni.find(item => item && item.ID === cId);
      if (c) return c.Nome || '';
    }
    return cId ? `Competizione ${cId}` : '';
  },

  /**
   * Render principale della vista
   */
  async render(container) {
    this.loadSortPreferences();

    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.fantamStorico()
      : `
      <div style="display:flex;justify-content:center;align-items:center;padding:60px 20px;">
        <div class="spinner"></div>
        <div style="margin-left:12px;color:var(--text-muted);font-weight:600;">Caricamento analisi FantaMister...</div>
      </div>
    `;

    // Determina la competizione selezionata di default (0 = Tutte le competizioni)
    if (this.selectedCompId === null || this.selectedCompId === undefined) {
      this.selectedCompId = 0;
    }

    // Carica dati stagione per la competizione selezionata
    const seasonData = await fcmFantamisterMotore.getSeasonData({ compId: this.selectedCompId });
    const calendar = typeof fcmDataLoader !== 'undefined' ? fcmDataLoader.getCalendarData() : { lastPlayed: 38 };
    const lastDay = calendar.lastPlayed > 0 ? calendar.lastPlayed : (seasonData ? seasonData.endDay : 38);

    if (!this.selectedCalenDay) {
      this.selectedCalenDay = lastDay;
    }
    if (!this.selectedGiornateDay) {
      this.selectedGiornateDay = lastDay;
    }
    if (!this.selectedTopFlopDay) {
      this.selectedTopFlopDay = lastDay;
    }

    // Gestione squadra selezionata (pre-selezione squadra del cuore se attiva)
    if (!this.selectedTeamId) {
      const favId = (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.getFavoriteTeamId)
        ? fcmHomeConfigManager.getFavoriteTeamId()
        : null;
      if (favId) {
        this.selectedTeamId = parseInt(favId, 10);
      } else if (typeof arrFantasquadre !== 'undefined' && arrFantasquadre[1]) {
        this.selectedTeamId = arrFantasquadre[1].ID || 1;
      } else {
        this.selectedTeamId = 1;
      }
    }

    // Parse parametri query URL (es. #fantam?tab=moduli o #fantam?sq=3)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      const targetTab = params.get('tab') || params.get('page') || params.get('id');
      const targetSq = params.get('sq') || params.get('team');
      const targetComp = params.get('comp') || params.get('competizione');

      if (targetComp !== null && targetComp !== undefined) {
        if (targetComp.toLowerCase() === 'all' || targetComp === '0') {
          this.selectedCompId = 0;
        } else {
          const cNum = parseInt(targetComp, 10);
          if (!isNaN(cNum) && cNum >= 0) this.selectedCompId = cNum;
        }
      }

      if (targetTab) {
        const t = targetTab.toLowerCase();
        if (t === 'moduli' || t === 'bonus' || t === 'moduli_bonus') this.currentTab = 'moduli_bonus';
        else if (t === 'giornate' || t === 'dettaglio_giornate' || t === 'giornata') this.currentTab = 'giornate';
        else if (t === 'bestrose') this.currentTab = 'bestrose';
        else if (t === 'cannonieri') this.currentTab = 'cannonieri';
        else if (t === 'calenbomber') this.currentTab = 'calenbomber';
        else if (t === 'incomedia' || t === 'incomtot' || t === 'incompresi') {
          this.currentTab = 'incompresi';
          if (t === 'incomtot') this.subTab.incompresi = 'totale';
        }
        else if (t === 'uomopartita') this.currentTab = 'uomopartita';
        else if (t === 'top11' || t === 'flop11' || t === 'top11s' || t === 'flop11s' || t === 'topflop') {
          this.currentTab = 'topflop';
          if (t.includes('s')) this.subTab.topflop = 'stagione';
          if (t.startsWith('flop')) this.subTab.topflopType = 'flop';
        }
        else if (t === 'fantasfiga') this.currentTab = 'fantasfiga';
        else if (t === 'squadre' || t === 'teams') this.currentTab = 'teams';
        else if (t === 'legenda' || t === 'lege' || t === 'guida') this.currentTab = 'legenda';
        else this.currentTab = 'fantamister';
      }

      if (targetSq) {
        const sqNum = parseInt(targetSq, 10);
        if (!isNaN(sqNum) && sqNum > 0) {
          this.selectedTeamId = sqNum;
          this.currentTab = 'teams';
        }
      }
    }

    this.renderView(container, seasonData, lastDay);
  },

  /**
   * Render dei contenuti con navigazione a schede ottimizzata per mobile
   */
  renderView(container, seasonData, lastDay) {
    // Lista delle competizioni disponibili per il selettore (con opzione 'Tutte le competizioni')
    const rawCompetitions = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getCompetitions === 'function')
      ? fcmDataLoader.getCompetitions()
      : (typeof arrCompetizioni !== 'undefined' ? arrCompetizioni.slice(1).map(c => ({ id: c.ID, name: c.Nome })) : [{ id: 1, name: 'Campionato' }]);

    const competitions = [
      { id: 0, name: 'Tutte le competizioni' },
      ...rawCompetitions
    ];

    const activeCompName = this.selectedCompId === 0
      ? 'Tutte le competizioni'
      : ((competitions.find(c => c.id === this.selectedCompId) || competitions[1] || {}).name || 'Campionato');
    this.currentCompName = activeCompName;

    const tabs = [
      { id: 'fantamister', icon: '🏆', label: 'Classifica FantaMister' },
      { id: 'moduli_bonus', icon: '📊', label: 'Moduli & Bonus' },
      { id: 'giornate', icon: '📅', label: 'Dettaglio Giornate' },
      { id: 'bestrose', icon: '🌹', label: 'Migliori Rose' },
      { id: 'cannonieri', icon: '⚽', label: 'Fantacannonieri' },
      { id: 'calenbomber', icon: '🗓️', label: 'Calenbomber' },
      { id: 'incompresi', icon: '🤦', label: 'Gli Incompresi' },
      { id: 'uomopartita', icon: '🌟', label: 'Migliore in Campo' },
      { id: 'topflop', icon: '🔝', label: 'Top & Flop 11' },
      { id: 'fantasfiga', icon: '🍀', label: 'Fantasfiga' },
      { id: 'teams', icon: '🛡️', label: 'Per Squadra' },
      { id: 'legenda', icon: '📖', label: 'Legenda' }
    ];

    container.innerHTML = `
      <div class="fantam-native-page" style="display:flex;flex-direction:column;gap:18px;">
        <!-- Header con selettore competizione -->
        <div class="card" style="padding:18px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
            <div>
              <div class="card-title" style="display:flex;align-items:center;gap:8px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#a855f7;stroke:#a855f7;flex-shrink:0;">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                  <path d="M2 2l7.5 6"></path>
                  <path d="M22 2l-7.5 6"></path>
                  <path d="M10.5 7h3l.5 2-2 1-2-1 .5-2z"></path>
                  <path d="M11 10l-1.5 7 2.5 3.5 2.5-3.5-1.5-7"></path>
                </svg>
                <span>FantaMister &amp; Analisi Tecnica</span>
              </div>
              <div class="card-subtitle">
                Scelte dei mister, formazioni ideali, rendimento combinato, moduli tattici e primati di efficienza
              </div>
            </div>

            <!-- Selettore Competizione Dedicato -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:6px;">
                <label for="selFantamComp" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Competizione:</label>
                <select id="selFantamComp" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:180px;font-size:0.88rem;">
                  ${competitions.map(c => `<option value="${c.id}" ${c.id === this.selectedCompId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
              </div>

              ${seasonData ? `
                <span class="badge" style="background:rgba(59,130,246,0.15);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.3);font-weight:700;font-size:0.75rem;">
                  ${seasonData.startDay}ª - ${seasonData.endDay}ª Giornata
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Navigazione Pill-Tabs Principale (Griglia responsiva 6x2 / 3x4 / 2x6 a dimensione fissa) -->
          <div id="fantamMainTabs">
            ${tabs.map(t => `
              <button type="button" class="pill-btn ${this.currentTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                <span>${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Contenitore Tab Attivo -->
        <div id="fantamTabContent">
          ${this.renderActiveTabContent(seasonData, lastDay, activeCompName)}
        </div>
      </div>
    `;

    this.bindEvents(container, seasonData, lastDay);
  },

  /**
   * Render dei contenuti della scheda attiva
   */
  renderActiveTabContent(seasonData, lastDay, compName = null) {
    const cName = compName || this.currentCompName || 'Competizione';
    if (!seasonData || !seasonData.rankingFm || seasonData.rankingFm.length === 0) {
      return `
        <div class="empty-state card" style="padding:40px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:10px;">👔</div>
          <div style="font-weight:800;font-size:1.1rem;color:var(--text-primary);margin-bottom:6px;">Nessun dato registrato per ${cName}</div>
          <div style="color:var(--text-muted);font-size:0.85rem;">Non sono presenti risultati registrati per calcolare le statistiche per questa competizione.</div>
        </div>
      `;
    }

    switch (this.currentTab) {
      case 'fantamister':
        return this.renderTabFantamister(seasonData);
      case 'moduli_bonus':
        return this.renderTabModuliBonus(seasonData);
      case 'giornate':
        return this.renderTabGiornate(seasonData);
      case 'bestrose':
        return this.renderTabBestRose(seasonData);
      case 'cannonieri':
        return this.renderTabCannonieri(seasonData);
      case 'calenbomber':
        return this.renderTabCalenbomber(seasonData);
      case 'incompresi':
        return this.renderTabIncompresi(seasonData);
      case 'uomopartita':
        return this.renderTabUomoPartita(seasonData);
      case 'topflop':
        return this.renderTabTopFlop(seasonData, lastDay);
      case 'fantasfiga':
        return this.renderTabFantasfiga(seasonData);
      case 'teams':
        return this.renderTabTeams(seasonData);
      case 'legenda':
        return this.renderTabLegenda();
      default:
        return this.renderTabFantamister(seasonData);
    }
  },

  /**
   * 1. TAB: Classifica FantaMister Unificata con Colonne Ordinabili
   */
  renderTabFantamister(seasonData) {
    let list = [...(seasonData.rankingFm || [])];

    // Ordinamento interattivo
    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      let valA, valB;
      switch (col) {
        case 'rankingCombinato':
          valA = a.rankingCombinato; valB = b.rankingCombinato;
          break;
        case 'percentBest':
          valA = a.percentBest; valB = b.percentBest;
          break;
        case 'scartoMedioPesato':
          valA = a.scartoMedioPesato; valB = b.scartoMedioPesato;
          break;
        case 'scartoMedio':
          valA = a.scartoMedio; valB = b.scartoMedio;
          break;
        case 'mediaVoti':
          valA = a.mediaVoti; valB = b.mediaVoti;
          break;
        case 'partite':
          valA = a.partite; valB = b.partite;
          break;
        case 'name':
          return dir * a.Nome.localeCompare(b.Nome);
        case 'scartoMax':
          valA = a.scartoMax.value; valB = b.scartoMax.value;
          break;
        case 'scartoMin':
          valA = a.scartoMin.value; valB = b.scartoMin.value;
          break;
        default:
          valA = a.rankingCombinato; valB = b.rankingCombinato;
      }
      return dir * (valA - valB);
    });

    const getSortIcon = (targetCol) => {
      if (this.sortColumn !== targetCol) return '<span style="opacity:0.35;font-size:0.75rem;">↕</span>';
      return this.sortDirection === 'asc' ? '▲' : '▼';
    };

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🏆</span>
              <span>Classifica FantaMister &amp; Rendimento Combinato</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Clicca sulle intestazioni delle colonne per ordinare la tabella in ordine crescente o decrescente.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" id="btnToggleFullFmTable" class="fantam-show-mobile-inline pill-btn ${this.showFullFmTableMobile ? 'active' : ''}" style="font-size:0.76rem;padding:5px 10px;border-radius:14px;font-weight:700;">
              ${this.showFullFmTableMobile ? '📱 Vista Compatta' : '📊 Classifica Completa'}
            </button>
            <div style="font-size:0.8rem;color:var(--text-muted);background:var(--bg-surface);padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              Ordinamento attivo: <strong style="color:var(--accent-primary);">${this.sortColumn} (${this.sortDirection.toUpperCase()})</strong>
            </div>
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table ${this.showFullFmTableMobile ? 'fantam-table-full-mobile' : ''}">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:34px;">#</th>
                <th style="padding:10px 8px;cursor:pointer;" data-sort="name">
                  Fantasquadra ${getSortIcon('name')}
                </th>
                <th style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="rankingCombinato" title="Indice combinato tra % Best ed efficienza dello scarto pesato">
                  Index % ${getSortIcon('rankingCombinato')}
                </th>
                <th style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="percentBest" title="Media percentuale del parziale reale rispetto al max teorico">
                  % Best ${getSortIcon('percentBest')}
                </th>
                <th style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="scartoMedioPesato" title="Scarto medio pesato su voti validi disponibili (Scarto / Voti-11)">
                  Scarto Pesato ${getSortIcon('scartoMedioPesato')}
                </th>
                <th style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="scartoMedio" title="Differenza media tra parziale massimo ottenibile e parziale effettivo">
                  Scarto Medio ${getSortIcon('scartoMedio')}
                </th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="partite">
                  Gare ${getSortIcon('partite')}
                </th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="mediaVoti">
                  Media Voti ${getSortIcon('mediaVoti')}
                </th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="scartoMax">
                  Scarto Max ${getSortIcon('scartoMax')}
                </th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;cursor:pointer;" data-sort="scartoMin">
                  Scarto Min ${getSortIcon('scartoMin')}
                </th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
      const isFav = this.isFavTeam(item.teamId || item.Nome);
      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:flex;align-items:center;gap:8px;">
                        <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" alt="" />
                        <div style="min-width:0;">
                          <div style="font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                            ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                            <span class="fantam-team-name-text">${item.Nome}</span>
                          </div>
                          ${item.coach ? `<div class="fantam-hide-mobile" style="font-size:0.75rem;color:var(--text-muted);">${item.coach}</div>` : ''}
                          <div class="fantam-show-mobile" style="font-size:0.68rem;color:var(--text-muted);">${item.partite}g • MV ${item.mediaVoti.toFixed(1)}</div>
                        </div>
                      </a>
                    </td>
                    <td style="padding:10px 8px;text-align:center;">
                      <span class="badge" style="background:rgba(59,130,246,0.15);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.3);font-weight:900;font-size:0.92rem;padding:4px 10px;border-radius:12px;">
                        ${item.rankingCombinato.toFixed(2)}
                      </span>
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-emerald);">
                      ${item.percentBest.toFixed(2)}%
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--accent-gold);">
                      ${this.formatScartoPesato(item.scartoMedioPesato)}
                    </td>
                    <td style="padding:10px 8px;text-align:center;color:var(--text-muted);font-weight:600;">
                      ${item.scartoMedio.toFixed(2)}
                    </td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;color:var(--text-muted);">${item.partite}</td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-weight:600;color:var(--text-primary);">${item.mediaVoti.toFixed(2)}</td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-size:0.82rem;color:var(--accent-crimson);">
                      ${item.scartoMax.value >= 0 ? `${item.scartoMax.value.toFixed(2)} <span style="color:var(--text-muted);"> (g. ${item.scartoMax.day})</span>` : '-'}
                    </td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-size:0.82rem;color:var(--accent-emerald);">
                      ${item.scartoMin.value < 900 ? `${item.scartoMin.value.toFixed(2)} <span style="color:var(--text-muted);"> (g. ${item.scartoMin.day})</span>` : '-'}
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
   * 2. TAB: Moduli & Bonus
   */
  renderTabModuliBonus(seasonData) {
    const sub = this.subTab.moduli_bonus;

    const subTabs = [
      { id: 'moduli_dettaglio', label: 'Dettaglio Moduli Migliori' },
      { id: 'bonus_percent', label: '% Bonus Positivi Titolari' },
      { id: 'bonus_media', label: 'Media Bonus Positivi/Partite' },
      { id: 'moduli_globale', label: 'Globale Migliori Moduli' },
      { id: 'moduli_assoluto', label: 'Miglior Modulo Assoluto' }
    ];

    return `
      <div class="card" style="padding:18px 20px;">
        <!-- Navigazione Sotto-Tab (Ottimizzata per mobile con wrap) -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
          ${subTabs.map(st => `
            <button type="button" class="pill-btn ${sub === st.id ? 'active' : ''}" data-modulitab="${st.id}" style="font-size:0.82rem;padding:6px 12px;border-radius:16px;white-space:nowrap;">
              ${st.label}
            </button>
          `).join('')}
        </div>

        <!-- Contenuto Sotto-Tab -->
        <div>
          ${this.renderSubTabModuliBonusContent(sub, seasonData)}
        </div>
      </div>
    `;
  },

  /**
   * Helper render sotto-tab Moduli & Bonus
   */
  renderSubTabModuliBonusContent(sub, seasonData) {
    const teams = seasonData.rankingFm || [];
    const allowedMods = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];

    // 1. DETTAGLIO MODULI MIGLIORI
    if (sub === 'moduli_dettaglio') {
      return `
        <div>
          <div style="margin-bottom:14px;">
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>📐</span>
              <span>Dettaglio Moduli Migliori</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Numero di volte in cui ciascun modulo tattico consentito ha prodotto il massimo punteggio teorico per la fantasquadra.
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;">
            ${teams.map(team => {
        const isFav = this.isFavTeam(team.teamId || team.Nome);
        const optMap = team.modulesOptimal || {};

        let maxFreq = 0;
        let topMod = '';
        allowedMods.forEach(m => {
          const count = optMap[m] || 0;
          if (count > maxFreq) { maxFreq = count; topMod = m; }
        });

        return `
                <div style="background:${isFav ? 'rgba(59,130,246,0.08)' : 'var(--bg-surface)'};border:1px solid ${isFav ? 'var(--accent-primary)' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:14px 16px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
                    <a href="${this.getTeamRoseLink(team.teamId, team.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${team.Nome}" style="display:inline-flex;align-items:center;gap:8px;">
                      <img src="${this.getTeamLogo(team.teamId, team.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(team.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                      <span style="font-weight:900;color:var(--text-primary);font-size:0.95rem;">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${team.Nome}</span></span>
                    </a>
                    ${topMod ? `<span class="badge" style="background:rgba(245,158,11,0.15);color:var(--accent-gold);border:1px solid rgba(245,158,11,0.3);font-size:0.75rem;font-weight:800;">Top: ${topMod} (${maxFreq})</span>` : ''}
                  </div>

                  <div style="display:flex;flex-direction:column;gap:6px;">
                    ${allowedMods.map(mod => {
          const count = optMap[mod] || 0;
          const pct = maxFreq > 0 ? Math.round((count / maxFreq) * 100) : 0;
          const isTop = count === maxFreq && maxFreq > 0;
          return `
                        <div style="display:flex;align-items:center;gap:10px;font-size:0.83rem;">
                          <span style="width:48px;font-weight:800;color:${isTop ? 'var(--accent-primary)' : 'var(--text-primary)'};">${mod}</span>
                          <div style="flex:1;height:7px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${isTop ? 'var(--accent-primary)' : 'var(--accent-cyan)'};border-radius:4px;"></div>
                          </div>
                          <span style="width:28px;text-align:right;font-weight:700;color:${isTop ? 'var(--accent-primary)' : 'var(--text-muted)'};">${count}</span>
                        </div>
                      `;
        }).join('')}
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }

    // 2. % BONUS POSITIVI TITOLARI
    if (sub === 'bonus_percent') {
      const list = [...(seasonData.bonusTitolariRanking || [])];
      return `
        <div>
          <div style="margin-bottom:14px;">
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🎯</span>
              <span>% Bonus Positivi Titolari</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Percentuale di bonus positivi schierati in campo rispetto al totale dei bonus positivi ottenuti dall'intera rosa.
            </div>
          </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Bonus Titolari</th>
                <th style="padding:10px 8px;text-align:center;">Bonus Rosa Totali</th>
                <th style="padding:10px 8px;text-align:center;">% Bonus Positivi Titolari</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
        const isFav = this.isFavTeam(item.teamId || item.Nome);
        return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:inline-flex;align-items:center;gap:10px;">
                        <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                        <span style="font-weight:800;color:var(--text-primary);">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${item.Nome}</span></span>
                      </a>
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-primary);">+${item.bonusPositiviTitolari} pt</td>
                    <td style="padding:10px 8px;text-align:center;color:var(--text-muted);">+${item.bonusPositiviRosa} pt</td>
                    <td style="padding:10px 8px;text-align:center;">
                      <span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald);border:1px solid rgba(16,185,129,0.3);font-weight:900;font-size:0.92rem;padding:4px 10px;border-radius:12px;">
                        ${item.percentBonusTitolari.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                `;
      }).join('')}
              <!-- Riga Media Lega -->
              <tr style="background:var(--bg-surface);font-weight:900;border-top:2px solid var(--border-subtle);">
                <td style="padding:12px 8px;text-align:center;color:var(--accent-gold);">★</td>
                <td style="padding:12px 8px;color:var(--text-primary);text-transform:uppercase;">Media Lega_</td>
                <td style="padding:12px 8px;text-align:center;">-</td>
                <td style="padding:12px 8px;text-align:center;">-</td>
                <td style="padding:12px 8px;text-align:center;color:var(--accent-gold);font-size:1.0rem;">
                  ${seasonData.mediaLegaPercentBonus.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      `;
    }

    // 3. MEDIA BONUS POSITIVI/PARTITE
    if (sub === 'bonus_media') {
      const list = [...(seasonData.mediaBonusRanking || [])];
      return `
        <div>
          <div style="margin-bottom:14px;">
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>⚡</span>
              <span>Media Bonus Positivi / Partite</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Media dei bonus positivi individuali dei calciatori titolari per singola gara disputata.
            </div>
          </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Partite</th>
                <th style="padding:10px 8px;text-align:center;">Bonus Positivi Titolari</th>
                <th style="padding:10px 8px;text-align:center;">Media Bonus / Partita</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
        const isFav = this.isFavTeam(item.teamId || item.Nome);
        return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:inline-flex;align-items:center;gap:10px;">
                        <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                        <span style="font-weight:800;color:var(--text-primary);">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${item.Nome}</span></span>
                      </a>
                    </td>
                    <td style="padding:10px 8px;text-align:center;color:var(--text-muted);">${item.partite}</td>
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-primary);">+${item.bonusPositiviTitolari} pt</td>
                    <td style="padding:10px 8px;text-align:center;">
                      <span class="badge" style="background:rgba(59,130,246,0.15);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.3);font-weight:900;font-size:0.95rem;padding:4px 10px;border-radius:12px;">
                        ${item.mediaBonusPartita.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                `;
      }).join('')}
              <!-- Riga Media Lega -->
              <tr style="background:var(--bg-surface);font-weight:900;border-top:2px solid var(--border-subtle);">
                <td style="padding:12px 8px;text-align:center;color:var(--accent-gold);">★</td>
                <td style="padding:12px 8px;color:var(--text-primary);text-transform:uppercase;">Media Lega_</td>
                <td style="padding:12px 8px;text-align:center;">-</td>
                <td style="padding:12px 8px;text-align:center;">-</td>
                <td style="padding:12px 8px;text-align:center;color:var(--accent-gold);font-size:1.0rem;">
                  ${seasonData.mediaLegaBonusPartita.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      `;
    }

    // 4. GLOBALE MIGLIORE MODULI
    if (sub === 'moduli_globale') {
      const list = seasonData.globaleMiglioriModuli || [];
      return `
        <div>
          <div style="margin-bottom:14px;">
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>📊</span>
              <span>Globale Migliori Moduli</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Frequenza percentuale dei moduli tattici ottimali su tutte le formazioni schierate.
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${list.map(m => `
              <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px 16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-weight:900;font-size:1.1rem;color:var(--accent-primary);">${m.modulo}</span>
                  <div style="font-size:1.05rem;font-weight:900;color:var(--text-primary);">
                    ${m.percent.toFixed(2)}% <span style="font-size:0.78rem;font-weight:normal;color:var(--text-muted);">(${m.count} occorrenze)</span>
                  </div>
                </div>
                <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${m.percent}%;background:linear-gradient(90deg, var(--accent-primary), var(--accent-cyan));border-radius:4px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 5. GLOBALE MIGLIORE MODULI ASSOLUTO
    const list = seasonData.globaleMiglioriModuliAssoluto || [];
    return `
      <div>
        <div style="margin-bottom:14px;">
          <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span>👑</span>
            <span>Globale Migliore Moduli Assoluto</span>
          </h3>
          <div style="font-size:0.83rem;color:var(--text-muted);">
            Frequenza dei moduli nelle giornate in cui un solo modulo garantiva univocamente il miglior punteggio.
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${list.map(m => `
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px 16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:900;font-size:1.1rem;color:var(--accent-gold);">${m.modulo}</span>
                <div style="font-size:1.05rem;font-weight:900;color:var(--text-primary);">
                  ${m.percent.toFixed(2)}% <span style="font-size:0.78rem;font-weight:normal;color:var(--text-muted);">(${m.count} volte unico)</span>
                </div>
              </div>
              <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${m.percent}%;background:linear-gradient(90deg, var(--accent-gold), var(--accent-crimson));border-radius:4px;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * 3. TAB: Dettaglio Giornate con Formazione Ideale e Multi-Moduli selezionabili (Punto 4 & 5)
   */
  renderTabGiornate(seasonData) {
    const detailsMap = seasonData.matchdaysDetails || {};
    const validDays = [...(seasonData.validDays || [])].sort((a, b) => b - a);
    const currentDay = this.selectedGiornateDay || (validDays[0] || 1);
    const currentDayData = detailsMap[currentDay] || null;

    // Assicura che la giornata selezionata compaia nel menù a tendina anche se non ha partite nella competizione corrente,
    // permettendo sempre di selezionare una giornata valida
    const dropdownDays = validDays.includes(currentDay)
      ? validDays
      : [currentDay, ...validDays].sort((a, b) => b - a);

    const rawList = currentDayData ? (currentDayData.teamsList || []) : [];

    // Raggruppa per fantasquadra per non ripetere più volte la stessa squadra quando sono selezionate tutte le competizioni
    const groupedByTeam = new Map();
    rawList.forEach(entry => {
      const tId = entry.teamId;
      if (!groupedByTeam.has(tId)) {
        groupedByTeam.set(tId, []);
      }
      groupedByTeam.get(tId).push(entry);
    });

    const list = Array.from(groupedByTeam.values()).map(entries => {
      const primary = entries[0];
      const allCompNames = [];
      const distinctMap = new Map();

      entries.forEach((e, idx) => {
        const cName = e.compName || this.getCompName(e.compId) || `Gara ${idx + 1}`;
        if (cName && !allCompNames.includes(cName)) {
          allCompNames.push(cName);
        }
        const startersSig = (e.starters || [])
          .map(p => `${p.id}_${p.role}_${p.totVote}`)
          .join('%') + `__${e.ModParz}__${Number(e.Parz || 0).toFixed(2)}__${Number(e.Scarto || 0).toFixed(2)}`;

        if (!distinctMap.has(startersSig)) {
          distinctMap.set(startersSig, {
            varKey: `v${distinctMap.size}`,
            compNames: cName ? [cName] : [],
            Parz: e.Parz,
            ModParz: e.ModParz,
            Scarto: e.Scarto,
            ScSuVoti: e.ScSuVoti,
            Voti: e.Voti,
            Min: e.Min,
            Max: e.Max,
            ModMax: e.ModMax,
            bestModules: e.bestModules,
            optimalLineupsByModule: e.optimalLineupsByModule,
            idealLineup: e.idealLineup,
            starters: e.starters || []
          });
        } else {
          const existing = distinctMap.get(startersSig);
          if (cName && !existing.compNames.includes(cName)) {
            existing.compNames.push(cName);
          }
        }
      });

      const distinctFormations = Array.from(distinctMap.values()).map((df, i) => ({
        ...df,
        compLabel: df.compNames.length > 0 ? df.compNames.join(' / ') : `Form. ${i + 1}`
      }));

      const minScarto = Math.min(...distinctFormations.map(df => df.Scarto));
      const maxParz = Math.max(...distinctFormations.map(df => df.Parz));

      return {
        ...primary,
        entriesCount: entries.length,
        allCompNames,
        distinctFormations,
        hasMultipleComps: entries.length > 1,
        hasDifferentFormations: distinctFormations.length > 1,
        hasSameFormationMultiComp: entries.length > 1 && distinctFormations.length === 1,
        minScarto,
        maxParz
      };
    }).sort((a, b) => a.minScarto - b.minScarto || b.maxParz - a.maxParz);

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>📅</span>
              <span>Dettaglio Singole Giornate</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Riepilogo turno per turno: scarto tra punteggio reale e massimo teorico con formazione ideale calcolata.
            </div>
          </div>

          <!-- Selettore Giornata (sempre visibile) -->
          <div style="display:flex;align-items:center;gap:8px;">
            <label for="selGiornateDay" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Giornata:</label>
            <select id="selGiornateDay" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:140px;">
              ${dropdownDays.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}ª Giornata${!validDays.includes(d) ? ' (n/d)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>

        ${!currentDayData || list.length === 0 ? `
          <div style="padding:32px 16px;text-align:center;color:var(--text-muted);background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:0.9rem;">
            Dati giornata non disponibili per questa competizione nella <strong>${currentDay}ª Giornata</strong>. Seleziona un'altra giornata dal menù a tendina in alto a destra.
          </div>
        ` : `
          <!-- Mini pillole di sintesi della giornata -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:16px;">
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Miglior FantaMister (Min Scarto)</div>
              <div style="font-weight:900;color:var(--accent-emerald);font-size:0.95rem;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${currentDayData.bestMister
        ? `${this.renderTeamInline(currentDayData.bestMister.teamId, currentDayData.bestMister.Nome, 18, 'font-weight:900;color:var(--accent-emerald);font-size:0.92rem;')} <span>(${currentDayData.bestMister.Scarto.toFixed(2)} pt)</span>`
        : '-'}
              </div>
            </div>
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Peggior FantaMister (Max Scarto)</div>
              <div style="font-weight:900;color:var(--accent-crimson);font-size:0.95rem;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${currentDayData.worstMister
        ? `${this.renderTeamInline(currentDayData.worstMister.teamId, currentDayData.worstMister.Nome, 18, 'font-weight:900;color:var(--accent-crimson);font-size:0.92rem;')} <span>(${currentDayData.worstMister.Scarto.toFixed(2)} pt)</span>`
        : '-'}
              </div>
            </div>
            <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Top Punteggio Reale</div>
              <div style="font-weight:900;color:var(--accent-primary);font-size:0.95rem;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${currentDayData.topScore
        ? `${this.renderTeamInline(currentDayData.topScore.teamId, currentDayData.topScore.Nome, 18, 'font-weight:900;color:var(--accent-primary);font-size:0.92rem;')} <span>(${(currentDayData.topScore.Parz !== undefined ? currentDayData.topScore.Parz : currentDayData.topScore.totalScore).toFixed(2)} pt)</span>`
        : '-'}
              </div>
            </div>
          </div>

          <!-- Tabella classica del Dettaglio Giornata -->
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
            <table class="fantam-table">
              <thead>
                <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                  <th style="padding:10px 8px;text-align:center;width:34px;">#</th>
                  <th style="padding:10px 8px;">Squadra (${currentDay}ª G.)</th>
                  <th style="padding:10px 8px;text-align:center;">Scarto</th>
                  <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;">Voti</th>
                  <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;">Sc. Voti</th>
                  <th style="padding:10px 8px;text-align:center;">Parziale Reale</th>
                  <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;">Min - Max Teorico</th>
                  <th class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;">Modulo/i Ottimale</th>
                  <th style="padding:10px 8px;text-align:center;">Formazione</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((item, idx) => {
          const isFav = this.isFavTeam(item.teamId || item.Nome);
          const rowKey = `${currentDay}_${item.teamId}`;
          const isExpanded = !!this.expandedRows[rowKey];
          const distinctForms = item.distinctFormations || [item];
          const hasDiff = !!item.hasDifferentFormations;
          const hasSameMulti = !!item.hasSameFormationMultiComp;
          const scVotiLabel = (item.ScSuVoti !== 999 && item.ScSuVoti !== undefined) ? item.ScSuVoti.toFixed(2) : 'n/a';
          const bestMods = item.bestModules || [(item.ModMax || '3-4-3')];
          const activeMod = this.selectedIdealMod[rowKey] || bestMods[0];
          const activeIdealLineup = (item.optimalLineupsByModule && item.optimalLineupsByModule[activeMod]) || item.idealLineup || [];
          const activeRealKey = this.selectedRealComp[rowKey] || (distinctForms[0] && distinctForms[0].varKey) || 'v0';
          const activeRealForm = distinctForms.find(df => df.varKey === activeRealKey) || distinctForms[0] || item;

          const renderScartoBadge = (scVal) => {
            const bg = scVal <= 3.0 ? 'rgba(16,185,129,0.15)' : (scVal <= 8.0 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)');
            const col = scVal <= 3.0 ? 'var(--accent-emerald)' : (scVal <= 8.0 ? 'var(--accent-gold)' : 'var(--accent-crimson)');
            return `<span class="badge" style="background:${bg};color:${col};font-weight:900;padding:3px 8px;border-radius:10px;">${scVal.toFixed(2)}</span>`;
          };

          return `
                    <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                      <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                      <td style="padding:10px 8px;">
                        <div class="fantam-team-row" style="display:flex;align-items:center;gap:8px;">
                          <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:inline-flex;align-items:center;flex-shrink:0;">
                            <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:20px;height:20px;object-fit:contain;flex-shrink:0;" alt="" />
                          </a>
                          <div style="min-width:0;">
                            <div style="font-weight:800;color:var(--text-primary);">
                              <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}">
                                ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${item.Nome}</span>
                              </a>
                            </div>
                            ${hasSameMulti ? `
                              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:1px;" title="Formazioni uguali in ${item.allCompNames.join(', ')}: calcolo unico">
                                Formazioni uguali (${item.allCompNames.join(' • ')}) — calcolo unico
                              </div>
                            ` : ''}
                            ${hasDiff ? `
                              <div style="font-size:0.68rem;color:var(--accent-gold);font-weight:700;margin-top:1px;">
                                ⚡ Formazioni diverse tra competizioni (${distinctForms.length})
                              </div>
                            ` : ''}
                            <div class="fantam-show-mobile" style="font-size:0.68rem;color:var(--text-muted);">Max: ${item.Max.toFixed(1)} (${item.ModMax})</div>
                          </div>
                        </div>
                      </td>
                      <td style="padding:10px 8px;text-align:center;">
                        ${hasDiff ? `
                          <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                            ${distinctForms.map(df => `
                              <div style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">
                                <span style="font-size:0.68rem;font-weight:700;color:var(--text-muted);">${df.compLabel}:</span>
                                ${renderScartoBadge(df.Scarto)}
                              </div>
                            `).join('')}
                          </div>
                        ` : renderScartoBadge(item.Scarto)}
                      </td>
                      <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-weight:600;color:var(--text-muted);">${item.Voti}</td>
                      <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-cyan);">
                        ${hasDiff ? `
                          <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                            ${distinctForms.map(df => {
            const lbl = (df.ScSuVoti !== 999 && df.ScSuVoti !== undefined) ? df.ScSuVoti.toFixed(2) : 'n/a';
            return `<div style="white-space:nowrap;font-size:0.8rem;"><span style="font-size:0.67rem;color:var(--text-muted);margin-right:4px;">${df.compLabel}:</span>${lbl}</div>`;
          }).join('')}
                          </div>
                        ` : scVotiLabel}
                      </td>
                      <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--text-primary);">
                        ${hasDiff ? `
                          <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                            ${distinctForms.map(df => `
                              <div style="white-space:nowrap;">
                                <span style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-right:4px;">${df.compLabel}:</span>
                                <span style="font-weight:700;color:var(--text-primary);">${df.Parz.toFixed(2)}</span>
                                <span style="font-size:0.73rem;color:var(--text-muted);">&gt; ${df.ModParz}</span>
                              </div>
                            `).join('')}
                          </div>
                        ` : `
                          ${item.Parz.toFixed(2)} <span style="font-size:0.73rem;color:var(--text-muted);">&gt; ${item.ModParz}</span>
                        `}
                      </td>
                      <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-size:0.83rem;color:var(--text-muted);">
                        ${item.Min.toFixed(2)} - ${item.Max.toFixed(2)}
                      </td>
                      <td class="fantam-hide-mobile" style="padding:10px 8px;text-align:center;font-weight:800;color:var(--accent-primary);">
                        ${item.ModMax}
                      </td>
                      <td style="padding:10px 8px;text-align:center;">
                        <button type="button" class="pill-btn ${isExpanded ? 'active' : ''}" data-toggledetail="${rowKey}" style="padding:4px 10px;font-size:0.75rem;border-radius:14px;border:1px solid ${isExpanded ? 'var(--accent-primary)' : 'var(--border-subtle)'};background:${isExpanded ? 'var(--accent-primary)' : 'var(--bg-surface)'};color:${isExpanded ? '#fff' : 'var(--text-primary)'};font-weight:700;">
                          ${isExpanded ? 'Chiudi ▲' : 'Vedi 👁️'}
                        </button>
                      </td>
                    </tr>

                    ${isExpanded ? `
                      <tr>
                        <td colspan="9" class="fantam-expanded-lineup-cell" style="padding:12px 10px;background:var(--bg-card);border-bottom:1px solid var(--border-subtle);">
                          ${hasSameMulti ? `
                            <div style="margin-bottom:10px;padding:7px 12px;border-radius:var(--radius-sm);background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);font-size:0.78rem;color:var(--text-primary);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                              <span>ℹ️</span>
                              <span><strong>Formazioni uguali tra le competizioni</strong> (${item.allCompNames.join(', ')}): la formazione effettiva schierata è identica e pertanto il calcolo di parziale (${item.Parz.toFixed(2)} pt) e scarto (${item.Scarto.toFixed(2)} pt) è unico.</span>
                            </div>
                          ` : ''}
                          ${hasDiff ? `
                            <div style="margin-bottom:10px;padding:7px 12px;border-radius:var(--radius-sm);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);font-size:0.78rem;color:var(--text-primary);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                              <span>⚡</span>
                              <span><strong>Formazioni effettive diverse tra le competizioni:</strong> ${distinctForms.map(df => `<strong>${df.compLabel}</strong> (${df.Parz.toFixed(2)} pt, mod. ${df.ModParz}, scarto ${df.Scarto.toFixed(2)})`).join(' • ')}</span>
                            </div>
                          ` : ''}

                          <div class="fantam-lineup-detail-grid">
                            <!-- Titolari Schierati (Campetto Tattico compatto con eventuale multi-competizione se formazioni diverse) -->
                            <div class="fantam-lineup-detail-card" data-realcard="${rowKey}">
                              <div class="fantam-lineup-card-header">
                                <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow:hidden;">
                                  <span style="font-weight:800;color:var(--text-primary);white-space:nowrap;flex-shrink:0;">
                                    Titolari Schierati${!hasDiff ? ` (${item.ModParz})` : ':'}
                                  </span>
                                  ${hasDiff ? `
                                    <div class="fantam-mod-tabs-scroll">
                                      ${distinctForms.map(df => {
            const isCompActive = df.varKey === activeRealForm.varKey;
            return `
                                          <button type="button" class="pill-btn ${isCompActive ? 'active' : ''}" data-realcomp="${df.varKey}" data-realptsval="${df.Parz.toFixed(2)} pt" data-realkey="${rowKey}" style="padding:2px 8px;font-size:0.72rem;border-radius:12px;white-space:nowrap;flex-shrink:0;border:1px solid ${isCompActive ? 'var(--accent-primary)' : 'var(--border-subtle)'};background:${isCompActive ? 'var(--accent-primary)' : 'var(--bg-card)'};color:${isCompActive ? '#fff' : 'var(--text-primary)'};font-weight:700;">
                                            ${df.compLabel} (${df.ModParz})
                                          </button>
                                        `;
          }).join('')}
                                    </div>
                                  ` : ''}
                                </div>
                                <span data-realpts="${rowKey}" style="color:var(--accent-primary);font-weight:900;white-space:nowrap;flex-shrink:0;">${activeRealForm.Parz.toFixed(2)} pt</span>
                              </div>
                              ${hasDiff ? `
                                <div class="fantam-ideal-pitches-carousel" data-realcarousel="${rowKey}">
                                  ${distinctForms.map((df, cIdx) => `
                                    <div class="fantam-ideal-pitch-slide" data-realslide="${df.varKey}" data-realptsval="${df.Parz.toFixed(2)} pt">
                                      ${this.renderLineupPitch(df.starters || [], false, `${df.compLabel} • ${df.ModParz} (${cIdx + 1}/${distinctForms.length})`)}
                                    </div>
                                  `).join('')}
                                </div>
                              ` : this.renderLineupPitch(item.starters || [], false)}
                            </div>

                            <!-- Formazione Ideale Calcolata con Campetti affiancati e Card Multi-Modulo scorrevoli senza scrollbar (Punto 1) -->
                            <div class="fantam-lineup-detail-card" data-idealcard="${rowKey}">
                              <div class="fantam-lineup-card-header">
                                <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow:hidden;">
                                  <span data-idealtitle="${rowKey}" style="font-weight:800;color:var(--text-primary);white-space:nowrap;flex-shrink:0;">
                                    Formazione Ideale${bestMods.length <= 1 ? ` (${activeMod})` : ':'}
                                  </span>
                                  ${bestMods.length > 1 ? `
                                    <div class="fantam-mod-tabs-scroll">
                                      ${bestMods.map(m => {
            const isModActive = m === activeMod;
            return `
                                          <button type="button" class="pill-btn ${isModActive ? 'active' : ''}" data-idealmod="${m}" data-modkey="${rowKey}" style="padding:2px 8px;font-size:0.72rem;border-radius:12px;white-space:nowrap;flex-shrink:0;border:1px solid ${isModActive ? 'var(--accent-primary)' : 'var(--border-subtle)'};background:${isModActive ? 'var(--accent-primary)' : 'var(--bg-card)'};color:${isModActive ? '#fff' : 'var(--text-primary)'};font-weight:700;">
                                            ${m}
                                          </button>
                                        `;
          }).join('')}
                                    </div>
                                  ` : ''}
                                </div>
                                <span style="color:var(--accent-gold);font-weight:900;white-space:nowrap;flex-shrink:0;">${item.Max.toFixed(2)} pt</span>
                              </div>

                              ${bestMods.length > 1 ? `
                                <div class="fantam-ideal-pitches-carousel" data-idealcarousel="${rowKey}">
                                  ${bestMods.map((m, mIdx) => {
            const modLineup = (item.optimalLineupsByModule && item.optimalLineupsByModule[m]) || item.idealLineup || [];
            return `
                                      <div class="fantam-ideal-pitch-slide" data-modslide="${m}">
                                        ${this.renderLineupPitch(modLineup, true, `${m} (${mIdx + 1}/${bestMods.length})`)}
                                      </div>
                                    `;
          }).join('')}
                                </div>
                              ` : this.renderLineupPitch(activeIdealLineup, true)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ` : ''}
                  `;
        }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  /**
   * 4. TAB: Migliori Rose (Best Rose - Punto 2: rimossa colonna grafico e stile punteggi neutro)
   */
  renderTabBestRose(seasonData) {
    const list = [...(seasonData.bestRoseRanking || [])];

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="margin-bottom:16px;">
          <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);">
            🌹 Classifica Migliori Rose (Best Rose)
          </h3>
          <div style="font-size:0.83rem;color:var(--text-muted);">
            Valore medio del miglior punteggio parziale teoricamente ottenibile schierando la formazione ideale perfetta.
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Gare</th>
                <th style="padding:10px 8px;text-align:center;">Best Rose Medio</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
      const isFav = this.isFavTeam(item.teamId || item.Nome);
      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:flex;align-items:center;gap:10px;">
                        <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                        <div>
                          <div style="font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:4px;">
                            ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                            <span class="fantam-team-name-text">${item.Nome}</span>
                          </div>
                          ${item.coach ? `<div style="font-size:0.75rem;color:var(--text-muted);">${item.coach}</div>` : ''}
                        </div>
                      </a>
                    </td>
                    <td style="padding:10px 8px;text-align:center;color:var(--text-muted);">${item.partite}</td>
                    <td style="padding:10px 8px;text-align:center;">
                      <span class="badge" style="background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-weight:800;font-size:0.92rem;padding:4px 12px;border-radius:10px;">
                        ${item.bestRoseMedio.toFixed(2)} pt
                      </span>
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
   * 5. TAB: Fantacannonieri (Separato da Calenbomber - Punto 5, 9, 10, 11)
   */
  renderTabCannonieri(seasonData) {
    let list = [...(seasonData.cannonieriRanking || [])];
    if (this.searchFilter) {
      const q = this.searchFilter.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q)));
    }

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>⚽</span>
              <span>Classifica Fantacannonieri</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Gol assegnati secondo l'algoritmo ufficiale FantaMister (-3 pt a ogni gol) nei fantatabellini reali.
            </div>
          </div>

          <!-- Barra di ricerca rapida -->
          <div style="width:100%;max-width:280px;">
            <input type="text" id="fantamScorerSearch" class="form-control" placeholder="Cerca calciatore o squadra..." value="${this.searchFilter}" style="width:100%;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.85rem;" />
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Calciatore</th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Gol Assegnati</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
      const curTeamId = this.resolveCurrentTeamId(item, item.teamId);
      const sqName = this.getTeamName(curTeamId);
      const isFav = this.isFavTeam(curTeamId) || this.isFavTeam(sqName);
      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;">
                        ${this.getRoleBadge(item.role)}
                        ${this.renderPlayerThumb(item, 30)}
                        <div style="min-width:0;">
                          <div>
                            ${this.renderPlayerName(item, 'font-weight:800;color:var(--text-primary);')}
                          </div>
                          <div class="fantam-show-mobile" style="margin-top:2px;">
                            ${this.renderTeamInline(curTeamId, sqName, 14, 'font-weight:600;color:var(--text-muted);font-size:0.72rem;')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;">
                      ${this.renderTeamInline(curTeamId, sqName, 18, 'font-weight:600;color:var(--text-primary);font-size:0.84rem;')}
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:900;color:var(--accent-gold);font-size:1.0rem;">
                      ⚽ ${item.goals}
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
   * 6. TAB: Calenbomber con divisori corretti (Punto 5, 6, 9, 10)
   */
  renderTabCalenbomber(seasonData) {
    const validDays = [...(seasonData.validDays || [])].sort((a, b) => b - a);
    const currentDay = this.selectedCalenDay || (validDays[0] || 1);
    const days = validDays.includes(currentDay)
      ? validDays
      : [currentDay, ...validDays].sort((a, b) => b - a);
    const dayData = seasonData.matchdaysDetails ? seasonData.matchdaysDetails[currentDay] : null;
    const currentDayMatches = dayData ? (dayData.matches || []) : [];

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🗓️</span>
              <span>Calenbomber: Incontri &amp; Marcatori di Giornata</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Tabellini partita per partita con marcatori delle squadre e miglior calciatore in campo.
            </div>
          </div>

          <!-- Selettore Giornata -->
          <div style="display:flex;align-items:center;gap:8px;">
            <label for="selCalenbomberDay" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Giornata:</label>
            <select id="selCalenbomberDay" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:140px;">
              ${days.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}ª Giornata${!validDays.includes(d) ? ' (n/d)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Incontri della giornata (Punto 6: divisore verticale tra le due squadre e orizzontale per il MoM) -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${currentDayMatches.length > 0 ? currentDayMatches.map(m => {
      const homeName = m.homeTeamName || this.getTeamName(m.homeTeamId);
      const awayName = m.awayTeamName || this.getTeamName(m.awayTeamId);
      const isFavHome = this.isFavTeam(m.homeTeamId) || this.isFavTeam(homeName);
      const isFavAway = this.isFavTeam(m.awayTeamId) || this.isFavTeam(awayName);
      const isFavMatch = isFavHome || isFavAway;
      const momTeamId = m.manOfTheMatch ? (m.manOfTheMatch.isHome ? m.homeTeamId : m.awayTeamId) : null;
      const momTeamName = momTeamId ? this.getTeamName(momTeamId) : '';

      return `
              <div style="background:${isFavMatch ? 'rgba(59,130,246,0.06)' : 'var(--bg-surface)'};border:1px solid ${isFavMatch ? 'rgba(59,130,246,0.35)' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:14px 16px;">
                <!-- Intestazione Incontro: Squadre e Risultato -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);">
                  <!-- Squadra Casa -->
                  <div style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end;">
                    <a href="${this.getTeamRoseLink(m.homeTeamId, homeName)}" class="fantam-team-link" title="Vai alla rosa di ${homeName}" style="display:inline-flex;align-items:center;gap:8px;justify-content:flex-end;">
                      <span style="font-weight:800;color:var(--text-primary);text-align:right;font-size:0.95rem;">
                        ${isFavHome ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${homeName}</span>
                      </span>
                      <img src="${this.getTeamLogo(m.homeTeamId, homeName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(homeName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:24px;height:24px;object-fit:contain;" alt="" />
                    </a>
                  </div>

                  <!-- Risultato & Totali -->
                  <div style="margin:0 16px;text-align:center;min-width:85px;">
                    <div style="font-size:1.4rem;font-weight:900;color:var(--accent-primary);line-height:1.1;">
                      ${m.homeGoals} - ${m.awayGoals}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
                      (${m.homeTotal.toFixed(2)} - ${m.awayTotal.toFixed(2)})
                    </div>
                    ${this.selectedCompId === 0 && m.compId ? `
                      <div style="margin-top:4px;">
                        <span style="font-size:0.68rem;padding:1px 6px;border-radius:4px;background:rgba(59,130,246,0.12);color:var(--accent-primary);font-weight:700;">
                          ${this.getCompName(m.compId)}
                        </span>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Squadra Trasferta -->
                  <div style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-start;">
                    <a href="${this.getTeamRoseLink(m.awayTeamId, awayName)}" class="fantam-team-link" title="Vai alla rosa di ${awayName}" style="display:inline-flex;align-items:center;gap:8px;justify-content:flex-start;">
                      <img src="${this.getTeamLogo(m.awayTeamId, awayName)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(awayName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:24px;height:24px;object-fit:contain;" alt="" />
                      <span style="font-weight:800;color:var(--text-primary);font-size:0.95rem;">
                        ${isFavAway ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${awayName}</span>
                      </span>
                    </a>
                  </div>
                </div>

                <!-- Griglia Marcatori con Riga Verticale Divisoria e Simmetria (Punto 1: GIOCATORE1 ⚽ | ⚽ GIOCATORE2 + miniature simmetriche) -->
                <div style="display:grid;grid-template-columns:1fr 1fr;position:relative;">
                  <!-- Marcatori Casa (Colonna Sinistra, allineata a destra verso il centro: [Miniatura] [Nome] ⚽ |) -->
                  <div style="padding-right:12px;border-right:1px solid var(--border-subtle);text-align:right;display:flex;flex-direction:column;gap:6px;">
                    ${(m.homeScorers && m.homeScorers.length > 0)
          ? m.homeScorers.map(s => `
                          <div class="fantam-player-item" style="display:flex;align-items:center;justify-content:flex-end;gap:6px;font-size:0.83rem;color:var(--accent-gold);font-weight:700;">
                            ${this.renderPlayerThumb(s, 26)}
                            <span style="min-width:0;word-break:break-word;line-height:1.2;">${this.renderPlayerName(s, 'color:var(--accent-gold);font-weight:700;')}</span>
                            <span style="flex-shrink:0;">⚽</span>
                          </div>
                        `).join('')
          : '<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;">Nessun gol</div>'}
                  </div>

                  <!-- Marcatori Trasferta (Colonna Destra, allineata a sinistra dal centro: | ⚽ [Nome] [Miniatura]) -->
                  <div style="padding-left:12px;text-align:left;display:flex;flex-direction:column;gap:6px;">
                    ${(m.awayScorers && m.awayScorers.length > 0)
          ? m.awayScorers.map(s => `
                          <div class="fantam-player-item" style="display:flex;align-items:center;justify-content:flex-start;gap:6px;font-size:0.83rem;color:var(--accent-gold);font-weight:700;">
                            <span style="flex-shrink:0;">⚽</span>
                            <span style="min-width:0;word-break:break-word;line-height:1.2;">${this.renderPlayerName(s, 'color:var(--accent-gold);font-weight:700;')}</span>
                            ${this.renderPlayerThumb(s, 26)}
                          </div>
                        `).join('')
          : '<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;">Nessun gol</div>'}
                  </div>
                </div>

                <!-- Migliore in Campo con Riga Orizzontale Divisoria e Miniatura -->
                ${m.manOfTheMatch ? `
                  <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;font-size:0.83rem;">
                    <span style="font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-size:0.75rem;">Migliore in campo:</span>
                    <span class="fantam-player-item" style="display:inline-flex;align-items:center;gap:6px;font-weight:800;color:var(--accent-primary);">
                      <span>🌟</span>
                      ${this.renderPlayerThumb(m.manOfTheMatch, 26)}
                      ${this.renderPlayerName(m.manOfTheMatch, 'font-weight:800;color:var(--accent-primary);')}
                    </span>
                    <span style="color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">
                      (${this.renderTeamInline(momTeamId, momTeamName, 16, 'color:var(--text-muted);font-weight:600;font-size:0.8rem;')}) - Voto: <strong style="color:var(--text-primary);">${m.manOfTheMatch.totNum ? m.manOfTheMatch.totNum.toFixed(2) : m.manOfTheMatch.totVote}</strong>
                    </span>
                  </div>
                ` : ''}
              </div>
            `;
    }).join('') : `
            <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.88rem;">Nessun incontro disputato in questa giornata per la competizione selezionata.</div>
          `}
        </div>
      </div>
    `;
  },

  /**
   * 7. TAB: Gli Incompresi (Media di tutte le gare da escluso >= 6.00 - Punto 7, 9, 10, 11)
   */
  renderTabIncompresi(seasonData) {
    const sub = this.subTab.incompresi;
    const list = sub === 'media' ? (seasonData.incompresiMedia || []) : (seasonData.incompresiTotale || []);

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🤦</span>
              <span>Gli Incompresi (Lasciati in Panchina o Tribuna)</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              ${sub === 'media'
        ? 'Calciatori con media totale &ge; 6.00 e numero di assenze &ge; alla media di lega per le gare da esclusi.'
        : 'Calciatori con i maggiori fantavoti accumulati e sprecati fuori dalla formazione titolare con media totale &ge; 6.00.'}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="pill-btn ${sub === 'media' ? 'active' : ''}" data-subtab="media">Per Media Voto (&ge; 6.00)</button>
            <button type="button" class="pill-btn ${sub === 'totale' ? 'active' : ''}" data-subtab="totale">Per Totale Punti</button>
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Calciatore</th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Gare</th>
                <th style="padding:10px 8px;text-align:center;">Media Voto</th>
                <th style="padding:10px 8px;text-align:center;">Punti Sprecati</th>
              </tr>
            </thead>
            <tbody>
              ${list.length > 0 ? list.map((item, idx) => {
          const curTeamId = this.resolveCurrentTeamId(item, item.teamId);
          const sqName = this.getTeamName(curTeamId);
          const isFav = this.isFavTeam(curTeamId) || this.isFavTeam(sqName);
          return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;">
                        ${this.getRoleBadge(item.role)}
                        ${this.renderPlayerThumb(item, 30)}
                        <div style="min-width:0;">
                          <div>
                            ${this.renderPlayerName(item, 'font-weight:800;color:var(--text-primary);')}
                          </div>
                          <div class="fantam-show-mobile" style="margin-top:2px;">
                            ${this.renderTeamInline(curTeamId, sqName, 14, 'font-weight:600;color:var(--text-muted);font-size:0.72rem;')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;">
                      ${this.renderTeamInline(curTeamId, sqName, 18, 'font-weight:600;color:var(--text-primary);font-size:0.84rem;')}
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-crimson);">${item.count}</td>
                    <td style="padding:10px 8px;text-align:center;font-weight:900;color:var(--accent-primary);font-size:0.95rem;">
                      ${item.avg.toFixed(2)}
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:var(--accent-gold);">
                      ${item.sum.toFixed(2)}
                    </td>
                  </tr>
                `;
        }).join('') : `
                <tr>
                  <td colspan="6" style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:0.9rem;">
                    Nessun calciatore con media &ge; 6.00 rimasto escluso finora per questa selezione.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * 8. TAB: Migliore in Campo (Uomini Partita - Punto 9 & 10)
   */
  renderTabUomoPartita(seasonData) {
    const list = [...(seasonData.momRanking || [])];

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="margin-bottom:16px;">
          <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span>🌟</span>
            <span>Classifica Migliore in Campo (Uomini Partita)</span>
          </h3>
          <div style="font-size:0.83rem;color:var(--text-muted);">
            Numero di volte in cui il calciatore è stato decretato Uomo Partita con il miglior voto dell'incontro.
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:36px;">#</th>
                <th style="padding:10px 8px;">Calciatore</th>
                <th class="fantam-hide-mobile" style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Volte Migliore in Campo</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
      const curTeamId = this.resolveCurrentTeamId(item, item.teamId);
      const sqName = this.getTeamName(curTeamId);
      const isFav = this.isFavTeam(curTeamId) || this.isFavTeam(sqName);
      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <div class="fantam-player-item" style="display:flex;align-items:center;gap:8px;">
                        ${this.getRoleBadge(item.role)}
                        ${this.renderPlayerThumb(item, 30)}
                        <div style="min-width:0;">
                          <div>
                            ${this.renderPlayerName(item, 'font-weight:800;color:var(--text-primary);')}
                          </div>
                          <div class="fantam-show-mobile" style="margin-top:2px;">
                            ${this.renderTeamInline(curTeamId, sqName, 14, 'font-weight:600;color:var(--text-muted);font-size:0.72rem;')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="fantam-hide-mobile" style="padding:10px 8px;">
                      ${this.renderTeamInline(curTeamId, sqName, 18, 'font-weight:600;color:var(--text-primary);font-size:0.84rem;')}
                    </td>
                    <td style="padding:10px 8px;text-align:center;font-weight:900;color:var(--accent-gold);font-size:1.0rem;">
                      🌟 ${item.count}
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
   * 9. TAB: Top & Flop 11 con Campetto Tattico Ufficiale (Punto 6, 8, 9, 10)
   */
  renderTabTopFlop(seasonData, lastDay) {
    const isSeason = this.subTab.topflop === 'stagione';
    const isTop = this.subTab.topflopType === 'top';

    const validDays = [...(seasonData.validDays || [])].sort((a, b) => b - a);
    const currentDay = this.selectedTopFlopDay || (validDays[0] || lastDay || 1);
    const dropdownDays = validDays.includes(currentDay)
      ? validDays
      : [currentDay, ...validDays].sort((a, b) => b - a);
    const dayData = seasonData.matchdaysDetails ? seasonData.matchdaysDetails[currentDay] : null;

    let players = [];
    let moduleStr = '3-4-3';
    let bestModStr = '3-4-3';
    let totalScore = 0;
    let byModule = {};

    if (isSeason) {
      const dataset = isTop ? seasonData.top11Season : seasonData.flop11Season;
      if (dataset) {
        players = dataset.players || [];
        bestModStr = dataset.module || '3-4-3';
        moduleStr = bestModStr;
        totalScore = dataset.sum || 0;
        byModule = dataset.byModule || {};
      }
    } else {
      if (dayData) {
        players = isTop ? (dayData.top11 || []) : (dayData.flop11 || []);
        bestModStr = isTop ? (dayData.topModule || '3-4-3') : (dayData.flopModule || '3-4-3');
        moduleStr = bestModStr;
        totalScore = isTop ? (dayData.topSum || 0) : (dayData.flopSum || 0);
        byModule = isTop ? (dayData.topByModule || {}) : (dayData.flopByModule || {});
      }
    }

    const activeModChoice = this.selectedTopFlopModule || 'auto';
    if (activeModChoice !== 'auto' && byModule && byModule[activeModChoice]) {
      players = byModule[activeModChoice].players || [];
      moduleStr = byModule[activeModChoice].module || activeModChoice;
      totalScore = byModule[activeModChoice].sum || 0;
    }

    return `
      <div class="card" style="padding:18px 20px;">
        <!-- Riga 1: Titolo e Selettore Giornata allineato (solo se ambito Giornata - Punto 6a) -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🔝</span>
              <span>Top &amp; Flop 11 (${isSeason ? 'Stagione Completa' : `${currentDay}ª Giornata`})</span>
            </h3>
            <div style="font-size:0.83rem;color:var(--text-muted);">
              Formazioni ideali dei migliori e peggiori 11 calciatori schierati sul terreno di gioco.
            </div>
          </div>

          ${!isSeason && dropdownDays.length > 0 ? `
            <div style="display:inline-flex;align-items:center;gap:8px;">
              <label for="selTopFlopDay" style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Giornata:</label>
              <select id="selTopFlopDay" class="form-control" style="font-weight:700;padding:6px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);min-width:140px;font-size:0.85rem;">
                ${dropdownDays.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}ª Giornata${!validDays.includes(d) ? ' (n/d)' : ''}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Riga 2: Pulsantiere Top/Flop e Giornata/Stagione a capo e centrate (Punto 6a) -->
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;align-items:center;margin-bottom:20px;">
          <!-- Gruppo 1: Top 11 / Flop 11 -->
          <div style="display:inline-flex;align-items:center;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:4px;border-radius:24px;border:1px solid var(--border-subtle);gap:4px;">
            <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding-left:8px;padding-right:4px;text-transform:uppercase;letter-spacing:0.5px;">Tipo:</span>
            <button type="button" class="pill-btn ${isTop ? 'active' : ''}" data-topfloptype="top" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🔝 Top 11</button>
            <button type="button" class="pill-btn ${!isTop ? 'active' : ''}" data-topfloptype="flop" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🔻 Flop 11</button>
          </div>

          <!-- Gruppo 2: Giornata / Stagione -->
          <div style="display:inline-flex;align-items:center;background:var(--bg-canvas, rgba(0,0,0,0.12));padding:4px;border-radius:24px;border:1px solid var(--border-subtle);gap:4px;">
            <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding-left:8px;padding-right:4px;text-transform:uppercase;letter-spacing:0.5px;">Ambito:</span>
            <button type="button" class="pill-btn ${!isSeason ? 'active' : ''}" data-subtab="giornata" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">📅 Giornata</button>
            <button type="button" class="pill-btn ${isSeason ? 'active' : ''}" data-subtab="stagione" style="border-radius:20px;padding:4px 12px;font-size:0.82rem;font-weight:700;">🏆 Stagione</button>
          </div>
        </div>

        ${players.length > 0 ? `
          <!-- Campetto Tattico Vettoriale (Punto 2 & 3: cambio modulo tattico con ricalcolo istantaneo) -->
          <div>
            ${this.renderTacticalPitch(players, !isTop, moduleStr, totalScore, isSeason, byModule, bestModStr)}
          </div>
        ` : `
          <div style="padding:32px;text-align:center;color:var(--text-muted);">
            Dati Top/Flop non disponibili per la selezione corrente.
          </div>
        `}
      </div>
    `;
  },

  /**
   * Helper Campetto Tattico per Top & Flop 11 (Punto 2: selettore modulo tattico con ricalcolo)
   */
  renderTacticalPitch(players, isFlop = false, moduleStr = '', totalScore = 0, isSeason = false, byModule = {}, bestModStr = '') {
    const allowedMods = (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getAllowedModuleStrings === 'function')
      ? fcmFantamisterMotore.getAllowedModuleStrings()
      : ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
    const activeModChoice = this.selectedTopFlopModule || 'auto';
    const pList = players.filter(p => p.role === 1 || p.role === 'P');
    const dList = players.filter(p => p.role === 2 || p.role === 'D');
    const cList = players.filter(p => p.role === 3 || p.role === 'C');
    const aList = players.filter(p => p.role === 4 || p.role === 'A');

    const renderRoleLine = (rolePlayers, roleLetter) => {
      const count = rolePlayers.length;
      const isStaggered = count >= 5;
      const roleClass = `role-${roleLetter.toLowerCase()}`;
      return `
        <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}">
          ${rolePlayers.map((pl, idx) => {
        const isWing = isStaggered && (idx === 0 || idx === count - 1);
        const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
        const pName = pl.name || pl.player || pl.rawPlayer || '';
        const pSurname = pl.surname || (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.extractSurname === 'function' ? fcmDataLoader.extractSurname(pName) : pName);
        const photoUrl = pl.photo || (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function' ? fcmDataLoader.getPlayerPhoto(pName) : 'img/foto/misterx.gif');
        const clubName = this.resolvePlayerSerieAClub(pl);
        const clubLogo = pl.serieALogo || (clubName && typeof fcmDataLoader !== 'undefined' ? (typeof fcmDataLoader.getSerieALogo === 'function' ? fcmDataLoader.getSerieALogo(clubName) : (typeof fcmDataLoader.getClubBadge === 'function' ? fcmDataLoader.getClubBadge(clubName) : '')) : '');
        const curTeamId = this.resolveCurrentTeamId(pl, pl.teamId);
        const sqName = this.getTeamName(curTeamId);
        const sqLogo = this.getTeamLogo(curTeamId, sqName);
        const isFav = this.isFavTeam(curTeamId) || this.isFavTeam(sqName);
        const voteVal = pl.totNum !== undefined ? pl.totNum.toFixed(2) : (pl.avgTot !== undefined ? pl.avgTot.toFixed(2) : (pl.totVote || pl.vote || '-'));
        const href = this.getPlayerLink(pl);
        const tagOpen = href
          ? `<a href="${href}" class="pitch-player ${wingClass}" style="text-decoration:none;color:inherit;" title="${pName} (${sqName}) - Voto: ${voteVal}">`
          : `<div class="pitch-player ${wingClass}" title="${pName} (${sqName}) - Voto: ${voteVal}">`;
        const tagClose = href ? `</a>` : `</div>`;

        return `
              ${tagOpen}
                <div class="pitch-player-avatar">
                  <img src="${photoUrl}" class="pitch-player-photo" alt="${pName}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
                  <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  ${clubLogo ? `<img src="${clubLogo}" class="rose-top11-club-logo" alt="" onerror="this.style.display='none';" />` : ''}
                </div>
                <div class="pitch-player-name">
                  <span class="pitch-player-surname">${pSurname}</span>
                </div>
                <div class="pitch-player-club" style="font-size:0.68rem;color:rgba(255,255,255,0.88);text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:3px;">
                  <img src="${sqLogo}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(sqName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:12px;height:12px;object-fit:contain;" alt="" />
                  <span>${isFav ? '⭐ ' : ''}${sqName}</span>
                </div>
                <div style="margin-top:2px;">
                  <span class="topflop-vote-badge ${isFlop ? 'flop' : 'top'}" style="background:${isFlop ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)'};color:#fff;font-weight:900;font-size:0.75rem;padding:2px 7px;border-radius:10px;">
                    ${voteVal}
                  </span>
                </div>
              ${tagClose}
            `;
      }).join('')}
        </div>
      `;
    };

    const svgLines = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPitchSvgLines)
      ? fcmDataLoader.getPitchSvgLines()
      : '';

    return `
      <div class="topflop-widget-card" style="margin: 0 auto; max-width: 530px;">
        <!-- Banner Sintesi con Selettore Modulo Tattico (Punto 2) -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="selTopFlopModule" style="font-weight:700;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;">Modulo Tattico:</label>
            <select id="selTopFlopModule" class="form-control" style="font-weight:800;padding:4px 10px;border-radius:10px;background:rgba(59,130,246,0.14);color:var(--accent-primary);border:1px solid rgba(59,130,246,0.35);font-size:0.84rem;cursor:pointer;">
              <option value="auto" ${activeModChoice === 'auto' ? 'selected' : ''}>${bestModStr || moduleStr} (${totalScore.toFixed(2)} pt) ${isFlop ? '👎' : '🌟'}</option>
              ${allowedMods.map(m => {
      if (m !== bestModStr) {
        const mEntry = byModule && byModule[m];
        const ptLabel = mEntry && typeof mEntry.sum === 'number' ? ` (${mEntry.sum.toFixed(2)} pt)` : '';
        return `<option value="${m}" ${activeModChoice === m ? 'selected' : ''} ${!mEntry ? 'disabled' : ''}>${m}${ptLabel}</option>`;
      }
    }).join('')}
            </select>
          </div>
          <div>
            <span style="font-weight:700;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;">${isSeason ? 'Media Voto Undici:' : 'Punteggio Totale:'}</span>
            <span style="font-weight:900;color:${isFlop ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};margin-left:6px;font-size:1.0rem;">
              ${typeof totalScore === 'number' ? totalScore.toFixed(2) : totalScore} pt
            </span>
          </div>
        </div>

        <!-- Campetto con erba e linee SVG -->
        <div class="pitch-container" style="position:relative;">
          ${svgLines}
          ${renderRoleLine(pList, 'P')}
          ${renderRoleLine(dList, 'D')}
          ${renderRoleLine(cList, 'C')}
          ${renderRoleLine(aList, 'A')}
        </div>
      </div>
    `;
  },

  /**
   * Helper Campetto Tattico per Dettaglio Giornate (Titolari Schierati & Formazione Ideale - Punto 1)
   */
  renderLineupPitch(players, isIdeal = false, cornerBadgeText = '') {
    const list = Array.isArray(players) ? players : [];
    const pList = list.filter(p => p.role === 1 || p.role === 'P');
    const dList = list.filter(p => p.role === 2 || p.role === 'D');
    const cList = list.filter(p => p.role === 3 || p.role === 'C');
    const aList = list.filter(p => p.role === 4 || p.role === 'A');

    // Eventuali riserve d'ufficio o assenti con ruolo 0
    const unknownRole = list.filter(p => !p.role || (p.role !== 1 && p.role !== 2 && p.role !== 3 && p.role !== 4 && p.role !== 'P' && p.role !== 'D' && p.role !== 'C' && p.role !== 'A'));
    unknownRole.forEach(u => {
      if (pList.length === 0) pList.push(u);
      else aList.push(u);
    });

    const renderRoleLine = (rolePlayers, roleLetter) => {
      const count = rolePlayers.length;
      const isStaggered = count >= 5;
      const roleClass = `role-${roleLetter.toLowerCase()}`;
      return `
        <div class="pitch-line ${isStaggered ? `pitch-line-staggered pitch-line-${count}` : ''}">
          ${rolePlayers.map((pl, idx) => {
        const isWing = isStaggered && (idx === 0 || idx === count - 1);
        const wingClass = isWing ? (idx === 0 ? 'pitch-player-wing-left' : 'pitch-player-wing-right') : (isStaggered ? 'pitch-player-center' : '');
        const pName = pl.name || pl.player || pl.rawPlayer || '';
        const pSurname = pl.surname || (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.extractSurname === 'function' ? fcmDataLoader.extractSurname(pName) : pName);
        const photoUrl = pl.photo || (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function' ? fcmDataLoader.getPlayerPhoto(pName) : 'img/foto/misterx.gif');
        const clubName = this.resolvePlayerSerieAClub(pl);
        const clubLogo = pl.serieALogo || (clubName && typeof fcmDataLoader !== 'undefined' ? (typeof fcmDataLoader.getSerieALogo === 'function' ? fcmDataLoader.getSerieALogo(clubName) : (typeof fcmDataLoader.getClubBadge === 'function' ? fcmDataLoader.getClubBadge(clubName) : '')) : '');
        const voteNum = pl.totNum !== undefined ? pl.totNum : parseFloat(String(pl.totVote || pl.vote || '').replace(',', '.'));
        const voteVal = !isNaN(voteNum) ? voteNum.toFixed(2) : (pl.totVote || pl.vote || '-');
        const isPos = !isNaN(voteNum) && voteNum >= 6;
        const badgeBg = isIdeal ? 'rgba(245,158,11,0.92)' : (isPos ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)');
        const href = this.getPlayerLink(pl);
        const tagOpen = href
          ? `<a href="${href}" class="pitch-player ${wingClass}" style="text-decoration:none;color:inherit;" title="${pName} - Voto: ${voteVal}">`
          : `<div class="pitch-player ${wingClass}" title="${pName} - Voto: ${voteVal}">`;
        const tagClose = href ? `</a>` : `</div>`;

        return `
              ${tagOpen}
                <div class="pitch-player-avatar">
                  <img src="${photoUrl}" class="pitch-player-photo" alt="${pName}" loading="lazy" onerror="this.onerror=null; this.src='img/foto/misterx.gif';" />
                  <span class="pitch-player-badge-role ${roleClass}">${roleLetter}</span>
                  ${clubLogo ? `<img src="${clubLogo}" class="rose-top11-club-logo" alt="" onerror="this.style.display='none';" />` : ''}
                </div>
                <div class="pitch-player-name">
                  <span class="pitch-player-surname">${pSurname}</span>
                </div>
                <div style="margin-top:2px;">
                  <span class="topflop-vote-badge" style="background:${badgeBg};color:#fff;font-weight:900;font-size:0.74rem;padding:2px 7px;border-radius:10px;">
                    ${voteVal}
                  </span>
                </div>
              ${tagClose}
            `;
      }).join('')}
        </div>
      `;
    };

    const svgLines = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getPitchSvgLines)
      ? fcmDataLoader.getPitchSvgLines()
      : '';

    return `
      <div class="topflop-widget-card fantam-detail-pitch-card" style="margin:0 auto;width:100%;">
        <div class="pitch-container" style="position:relative;">
          ${cornerBadgeText ? `
            <div class="fantam-pitch-corner-badge">${cornerBadgeText}</div>
          ` : ''}
          ${svgLines}
          ${renderRoleLine(pList, 'P')}
          ${renderRoleLine(dList, 'D')}
          ${renderRoleLine(cList, 'C')}
          ${renderRoleLine(aList, 'A')}
        </div>
      </div>
    `;
  },

  /**
   * 10. TAB: Fantasfiga (Basata rigorosamente su parziali puri avversari - Punto 9)
   */
  renderTabFantasfiga(seasonData) {
    const list = [...(seasonData.fantasfigaRanking || [])];

    return `
      <div class="card" style="padding:18px 20px;">
        <div style="margin-bottom:16px;">
          <h3 style="margin:0 0 4px 0;font-size:1.15rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span>🍀</span>
            <span>Classifica Fantasfiga</span>
          </h3>
          <div style="font-size:0.83rem;color:var(--text-muted);line-height:1.4;">
            Questa classifica si basa sul rendimento dei propri avversari rispetto alla loro media. Il valore indicato è traducibile in "quanti punti fanno in media i miei avversari giocando contro di me rispetto alla loro media". Il calcolo esclude rigorosamente modificatori di reparto e fattore campo, confrontando unicamente i parziali puri delle formazioni.
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="fantam-table">
            <thead>
              <tr style="border-bottom:2px solid var(--border-subtle);color:var(--text-muted);text-align:left;white-space:nowrap;">
                <th style="padding:10px 8px;text-align:center;width:40px;">#</th>
                <th style="padding:10px 8px;">Fantasquadra</th>
                <th style="padding:10px 8px;text-align:center;">Delta Punti / Gara</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, idx) => {
      const isFav = this.isFavTeam(item.teamId || item.Nome);
      const isUnlucky = item.diff > 0;
      return `
                  <tr style="border-bottom:1px solid var(--border-subtle);background:${isFav ? 'rgba(59,130,246,0.08)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)')};">
                    <td style="padding:10px 8px;text-align:center;font-weight:800;color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <a href="${this.getTeamRoseLink(item.teamId, item.Nome)}" class="fantam-team-link" title="Vai alla rosa di ${item.Nome}" style="display:flex;align-items:center;gap:10px;">
                        <img src="${this.getTeamLogo(item.teamId, item.Nome)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(item.Nome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:22px;height:22px;object-fit:contain;" alt="" />
                        <div>
                          <div style="font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:4px;">
                            ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}
                            <span class="fantam-team-name-text">${item.Nome}</span>
                          </div>
                          ${item.coach ? `<div style="font-size:0.75rem;color:var(--text-muted);">${item.coach}</div>` : ''}
                        </div>
                      </a>
                    </td>
                    <td style="padding:10px 8px;text-align:center;">
                      <span class="badge" style="background:${isUnlucky ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'};color:${isUnlucky ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};font-weight:900;font-size:0.95rem;padding:4px 10px;border-radius:12px;">
                        ${item.diff > 0 ? `+${item.diff.toFixed(2)}` : item.diff.toFixed(2)} pt
                      </span>
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
   * 11. TAB: Statistiche di Squadra
   */
  renderTabTeams(seasonData) {
    const teams = Object.values(seasonData.teamStats || {}).sort((a, b) => a.name.localeCompare(b.name));
    const currentTeam = seasonData.teamStats[this.selectedTeamId] || teams[0];

    if (!currentTeam) {
      return `<div class="card" style="padding:24px;text-align:center;">Nessuna squadra disponibile</div>`;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- Selettore Fantasquadra (Punto 7: squadra selezionata a sinistra, menù a tendina a destra) -->
        <div class="card" style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <a href="${this.getTeamRoseLink(currentTeam.teamId, currentTeam.name)}" class="fantam-team-link" title="Vai alla rosa di ${currentTeam.name}" style="display:inline-flex;align-items:center;gap:10px;">
            <img src="${this.getTeamLogo(currentTeam.teamId, currentTeam.name)}" class="fantam-team-shirt" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(currentTeam.name)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:28px;height:28px;object-fit:contain;" alt="" />
            <span style="font-weight:900;font-size:1.1rem;color:var(--text-primary);">
              ${this.isFavTeam(currentTeam.teamId || currentTeam.name) ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span class="fantam-team-name-text">${currentTeam.name}</span>
            </span>
          </a>
          <div style="display:flex;align-items:center;gap:10px;">
            <label for="selFantamTeam" style="font-weight:700;font-size:0.88rem;color:var(--text-muted);">Scegli Fantasquadra:</label>
            <select id="selFantamTeam" class="form-control" style="padding:8px 12px;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-subtle);font-size:0.95rem;font-weight:700;">
              ${teams.map(t => `
                <option value="${t.teamId}" ${t.teamId === currentTeam.teamId ? 'selected' : ''}>
                  ${this.isFavTeam(t.teamId || t.name) ? '⭐ ' : ''}${t.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        ${this.renderTeamStatsContent(currentTeam)}
      </div>
    `;
  },

  /**
   * Contenuto condiviso Statistiche di Squadra (usato sia in #fantam che nella sub-scheda Statistiche di #rose)
   */
  renderTeamStatsContent(currentTeam) {
    if (!currentTeam) return '';
    const totalMatches = currentTeam.matchesCount || 1;

    // Moduli
    const modulesList = Object.keys(currentTeam.modulesUsed || {})
      .map(m => ({ module: m, count: currentTeam.modulesUsed[m], pct: Math.round((currentTeam.modulesUsed[m] / totalMatches) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);

    // Marcatori
    const scorersList = [];
    if (currentTeam.scorers) {
      Object.keys(currentTeam.scorers).forEach(pId => {
        const goals = currentTeam.scorers[pId];
        const pInfo = currentTeam.appearances && currentTeam.appearances[pId] ? currentTeam.appearances[pId] : null;
        let name = pInfo ? pInfo.name : (window[`xg${pId}`] || `Giocatore #${pId}`);
        let role = pInfo ? pInfo.role : 4;
        let club = pInfo ? pInfo.club : '';
        scorersList.push({ id: pId, name, role, club, goals });
      });
    }
    scorersList.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

    // Presenze
    const appList = Object.values(currentTeam.appearances || {}).map(p => ({
      ...p,
      totalApp: (p.titolare || 0) + (p.subentrato || 0),
      goals: currentTeam.scorers && currentTeam.scorers[p.id] ? currentTeam.scorers[p.id] : 0
    })).sort((a, b) => b.totalApp - a.totalApp || b.titolare - a.titolare || a.name.localeCompare(b.name));

    return `
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

        <!-- 2. Fantamarcatori di Squadra (Punto 1 & 2: ruolo -> miniatura con badge Serie A -> nome con a capo) -->
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
                    ${this.getRoleBadge(s.role)}
                    ${this.renderPlayerThumb(s, 30)}
                    <div style="font-weight:800;color:var(--text-primary);font-size:0.86rem;white-space:normal;word-break:break-word;overflow-wrap:break-word;line-height:1.25;">
                      ${this.renderPlayerName(s, 'font-weight:800;color:var(--text-primary);')}
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

        <!-- 3. Presenze e Utilizzo Rosa (Punto 1 & 5: ruolo -> miniatura con badge Serie A -> nome, tabella ottimizzata mobile) -->
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
                        ${this.getRoleBadge(p.role)}
                        ${this.renderPlayerThumb(p, 28)}
                        <div style="min-width:0;">
                          ${this.renderPlayerName(p, 'font-weight:700;color:var(--text-primary);')}
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
  },

  /**
   * 12. TAB: Legenda e Spiegazione Completa delle Regole e dei Calcoli
   */
  renderTabLegenda() {
    return `
      <div class="card" style="padding:22px 24px;line-height:1.65;">
        <!-- Header Legenda -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:2px solid var(--border-subtle);padding-bottom:14px;margin-bottom:20px;">
          <div>
            <h3 style="margin:0 0 6px 0;font-size:1.3rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:10px;">
              <span>📖</span>
              <span>Guida Metodologica, Voci di Calcolo &amp; Legenda FantaMister</span>
            </h3>
            <p style="margin:0;font-size:0.88rem;color:var(--text-muted);">
              FantaMister analizza scientificamente le decisioni dei fantallenatori confrontando, per ogni singola partita, la formazione schierata in campo con l'undici ideale teorico realizzabile a posteriori con tutti i moduli ammessi.
            </p>
          </div>
        </div>

        <!-- Principi di Neutralità del Calcolo -->
        <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:24px;">
          <div style="font-size:0.8rem;font-weight:800;color:var(--accent-primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>⚙️</span> Principi Fondamentali di Calcolo &amp; Neutralità
          </div>
          <ul style="margin:0;padding-left:20px;font-size:0.86rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px;">
            <li><strong>Fantavoti Puri (Totale Calciatore)</strong>: i calcoli tengono conto unicamente della somma dei fantavoti individuali (voto base + bonus/malus). Non vengono considerati modificatori di reparto (es. modificatore della difesa), fattore campo o altri bonus di squadra che non appartengono al voto individuale puro del singolo giocatore.</li>
            <li><strong>Verifica di Tutti i Moduli Ammessi</strong>: per ogni gara e per ciascuna rosa, FantaMister testa in automatico tutti i moduli regolamentari (3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1) individuando l'assetto che massimizza il totale parziale della squadra.</li>
            <li><strong>Confronto Oggettivo</strong>: lo scarto (rimpianto) misura quanti punti l'allenatore ha lasciato sul campo per scelte errate o sfortunate rispetto all'undici teoricamente perfetto.</li>
          </ul>
        </div>

        <!-- Sezione 1: Voci e Colonne della Classifica FantaMister -->
        <div style="margin-bottom:28px;">
          <h4 style="margin:0 0 14px 0;color:var(--accent-cyan);font-size:1.1rem;font-weight:900;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
            <span>🏆</span> Voci e Metriche della Classifica Principale
          </h4>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
            
            <!-- Card Index % -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--accent-primary);font-size:0.95rem;">Index % (Ranking Combinato)</span>
                <span class="badge badge-info" style="font-size:0.7rem;">Indice Globale</span>
              </div>
              <p style="margin:0 0 6px 0;font-size:0.85rem;color:var(--text-secondary);">
                È l'indice sintetico di FantaMister che premia il fantallenatore più efficiente e costante. Fonde la percentuale media del potenziale colto (<strong>% Best</strong>) con la precisione rapportata alla difficoltà decisionale (<strong>Scarto Pesato</strong>):
              </p>
              <div style="background:var(--bg-surface-elevated);padding:6px 10px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:var(--text-primary);border-left:3px solid var(--accent-primary);">
                Index % = [% Best + max(0, 108 - (Scarto Pesato × 27.6))] / 2
              </div>
            </div>

            <!-- Card % Best -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--accent-emerald);font-size:0.95rem;">% Best (Rendimento %)</span>
                <span class="badge badge-success" style="font-size:0.7rem;">Percentuale</span>
              </div>
              <p style="margin:0 0 6px 0;font-size:0.85rem;color:var(--text-secondary);">
                Rapporto percentuale medio tra il Parziale Reale ottenuto e il Parziale Massimo teorico raggiungibile. Indica quanta parte del potenziale massimo della rosa è stata effettivamente trasformata in punti (<strong>100%</strong> = formazione sempre perfetta):
              </p>
              <div style="background:var(--bg-surface-elevated);padding:6px 10px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:var(--text-primary);border-left:3px solid var(--accent-emerald);">
                % Best = (Parziale Reale / Parziale Max) × 100
              </div>
            </div>

            <!-- Card Scarto Pesato -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--accent-gold);font-size:0.95rem;">Scarto Medio Pesato</span>
                <span class="badge badge-warning" style="font-size:0.7rem;">Ponderato</span>
              </div>
              <p style="margin:0 0 6px 0;font-size:0.85rem;color:var(--text-secondary);">
                Rapporto tra la somma totale degli scarti e i voti validi disponibili oltre gli 11 titolari. Pesa la reale difficoltà delle scelte: chi ha molti titolari a disposizione ha rose più lunghe e maggiori dubbi settimanali, mentre chi ha pochi titolari ha scelte quasi obbligate:
              </p>
              <div style="background:var(--bg-surface-elevated);padding:6px 10px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:var(--text-primary);border-left:3px solid var(--accent-gold);">
                Scarto Pesato = ∑ Scarto / (∑ Voti Validi - 11 × Partite)
              </div>
            </div>

            <!-- Card Scarto Medio -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--text-primary);font-size:0.95rem;">Scarto Medio (Punti/Gara)</span>
                <span class="badge" style="font-size:0.7rem;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--text-muted);">Lineare</span>
              </div>
              <p style="margin:0 0 6px 0;font-size:0.85rem;color:var(--text-secondary);">
                Media aritmetica semplice dei punti persi a partita: differenza media tra il Parziale Massimo ottenibile e il Parziale Reale. Più il valore è basso, più l'allenatore è stato abile a evitare rimpianti:
              </p>
              <div style="background:var(--bg-surface-elevated);padding:6px 10px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:var(--text-primary);border-left:3px solid var(--text-muted);">
                Scarto Medio = ∑ (Parziale Max - Parziale Reale) / Partite
              </div>
            </div>

            <!-- Card Scarto Max & Min -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--accent-crimson);font-size:0.95rem;">Scarto Max &amp; Scarto Min</span>
                <span class="badge" style="font-size:0.7rem;background:rgba(239,68,68,0.12);color:var(--accent-crimson);">Estremi</span>
              </div>
              <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">
                <strong>Scarto Max</strong>: la peggior giornata della stagione, ovvero la partita in cui l'allenatore ha lasciato più fantavoti in panchina (con indicazione della giornata FCM in cui è avvenuto).<br>
                <strong>Scarto Min</strong>: la giornata perfetta o quasi perfetta, in cui l'allenatore ha azzeccato in pieno o quasi la formazione ideale.
              </p>
            </div>

            <!-- Card Gare & Media Voti -->
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;color:var(--text-primary);font-size:0.95rem;">Gare &amp; Media Voti</span>
                <span class="badge" style="font-size:0.7rem;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);color:var(--text-muted);">Statistica</span>
              </div>
              <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">
                <strong>Gare</strong>: totale degli incontri disputati dalla fantasquadra nel filtro/competizione selezionata.<br>
                <strong>Media Voti</strong>: numero medio di calciatori della rosa che hanno ricevuto un voto valido a partita (esclusi gli S.V./N.G. e non scesi in campo).
              </p>
            </div>

          </div>
        </div>

        <!-- Sezione 2: Contenuto dei Tab -->
        <div>
          <h4 style="margin:0 0 14px 0;color:var(--accent-gold);font-size:1.1rem;font-weight:900;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
            <span>📑</span> Contenuto &amp; Funzionalità di Ciascun Tab
          </h4>

          <div style="display:flex;flex-direction:column;gap:14px;font-size:0.88rem;">
            
            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🏆</span> Tab "Classifica FantaMister"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                La panoramica generale di rendimento per tutte le fantasquadre. Ogni colonna è ordinabile in senso crescente o decrescente con un clic sull'intestazione. Su dispositivi mobili è presente un pulsante per alternare tra la <em>Vista Compatta</em> (ottimizzata touch per schermi stretti) e la <em>Classifica Completa</em> con tutte le statistiche estese.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>📊</span> Tab "Moduli &amp; Bonus"
              </h5>
              <p style="margin:0 0 8px 0;color:var(--text-secondary);">
                Analizza l'efficacia tattica e la capacità di catturare i bonus dell'intera rosa attraverso 5 sotto-sezioni dedicate:
              </p>
              <ul style="margin:0;padding-left:20px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
                <li><strong>Dettaglio Moduli Migliori</strong>: confronta per ciascuna squadra quante volte è stato schierato un dato modulo rispetto a quante volte quel modulo sarebbe stato la scelta teoricamente ottimale (Modulo Best).</li>
                <li><strong>% Bonus Positivi Titolari</strong>: classifica basata sul rapporto tra la somma dei bonus favorevoli (+3 gol, +1 assist, rigori parati) incassati dall'undici titolare rispetto al totale dei bonus realizzati dall'intera rosa (titolari + panchina/tribuna): <code>(Bonus Titolari / Bonus Totali Rosa) × 100</code>.</li>
                <li><strong>Media Bonus Positivi/Partite</strong>: classifica ordinata per media di punti bonus conquistati dai titolari a ogni singola partita giocata.</li>
                <li><strong>Globale Migliori Moduli</strong>: frequenza aggregata a livello di intera lega dei moduli ideali, per capire quali assetti tattici hanno reso di più nella stagione.</li>
                <li><strong>Miglior Modulo Assoluto</strong>: evidenzia il modulo tattico che in assoluto è risultato più volte la scelta vincente.</li>
              </ul>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>📅</span> Tab "Dettaglio Giornate"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Analisi turno per turno di tutte le partite della competizione. Per ogni gara vengono messi a confronto: la formazione reale (modulo, voti e parziale effettivo), l'undici ideale calcolato da FantaMister (modulo Best e parziale massimo) e lo scarto di giornata, con l'elenco esatto dei singoli cambi suggeriti (chi avrebbe dovuto giocare al posto di chi per massimizzare il punteggio).
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🌹</span> Tab "Migliori Rose"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Graduatoria del potenziale puro degli organici: calcola la media del Parziale Massimo teorico ottenibile da ciascuna rosa nell'ipotesi in cui l'allenatore avesse azzeccato sempre la formazione ideale in ogni giornata. Consente di distinguere chiaramente se una squadra fatica in classifica per colpa delle decisioni tecniche del mister o per una debolezza oggettiva della rosa.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>⚽</span> Tab "Fantacannonieri"
              </h5>
              <p style="margin:0 0 6px 0;color:var(--text-secondary);">
                Classifica dei marcatori virtuali assegnati a ciascun gol realizzato dalla propria fantasquadra nei tabellini delle partite (fantamarcatori). L'algoritmo di FantaMister opera così:
              </p>
              <ul style="margin:0;padding-left:20px;color:var(--text-muted);display:flex;flex-direction:column;gap:3px;">
                <li>Il primo gol della squadra viene attribuito al calciatore con il miglior Totale Calciatore (FantaVoto);</li>
                <li>A quel calciatore vengono sottratti virtualmente 3 punti e, in caso di ulteriori gol segnati nel match, si riassegna la marcatura al nuovo miglior totale;</li>
                <li>In caso di parità perfetta di FantaVoto tra due o più compagni di squadra, si applicano i seguenti criteri di priorità: 1) miglior voto puro di redazione (senza bonus/malus); 2) calciatore con meno fantagol già segnati in stagione; 3) ruolo più arretrato (prima Difensori, poi Centrocampisti, infine Attaccanti).</li>
              </ul>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🗓️</span> Tab "Calenbomber"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Calendario integrale della stagione con i tabellini di tutte le sfide disputate e i relativi fantamarcatori assegnati a ogni marcatura secondo la logica ufficiale dei fantagol.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🤦</span> Tab "Gli Incompresi"
              </h5>
              <p style="margin:0 0 8px 0;color:var(--text-secondary);">
                I campioni dimenticati in panchina o in tribuna dal proprio fantallenatore: evidenzia i calciatori con un rendimento da top player che vengono costantemente esclusi dalla formazione titolare. Include due viste:
              </p>
              <ul style="margin:0;padding-left:20px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
                <li><strong>Per Media Voto</strong>: calciatori con FantaMedia &ge; 6.00 ottenuta unicamente nelle gare in cui NON sono scesi in campo da titolari, con un numero di panchine/tribune almeno pari alla media di lega.</li>
                <li><strong>Per Totale Punti</strong>: calciatori che hanno accumulato il maggior quantitativo complessivo di fantavoti sprecati fuori dai titolari (con FantaMedia &ge; 6.00).</li>
              </ul>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🌟</span> Tab "Migliore in Campo (Uomo Partita)"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Per ogni incontro disputato viene proclamato l'MVP della gara, cioè il calciatore con il Totale Calciatore (FantaVoto) più alto della partita. In caso di parità, la precedenza va al calciatore della fantasquadra vincente e poi ai criteri di spareggio dei marcatori. La classifica ordina i giocatori in base al numero di titoli di MVP vinti in stagione.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🔝</span> Tab "Top &amp; Flop 11"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Schieramento tattico su campo grafico e tabelle riassuntive per l'undici migliore (Top 11) e peggiore (Flop 11), consultabili sia per singola giornata di campionato sia aggregate sull'intera stagione. Per la Top/Flop stagionale viene applicato un filtro di presenze minime pari ad almeno il <strong>50% delle partite disputate</strong>, garantendo l'affidabilità statistica dei dati.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🍀</span> Tab "Fantasfiga"
              </h5>
              <p style="margin:0 0 6px 0;color:var(--text-secondary);">
                Misura obiettiva dell'incidenza della sfortuna legata al calendario: calcola quanti punti realizzano in media gli avversari diretti quando affrontano una determinata fantasquadra rispetto alla loro consueta media punti stagionale.
              </p>
              <div style="background:var(--bg-surface-elevated);padding:6px 10px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:var(--text-primary);border-left:3px solid var(--accent-primary);margin-bottom:6px;">
                Delta Punti / Gara = Media Punti Subiti - Media Generale Avversari
              </div>
              <p style="margin:0;font-size:0.83rem;color:var(--text-muted);">
                Un valore positivo alto significa che gli avversari giocano spesso la "partita della vita" proprio quando affrontano quella specifica squadra. Il calcolo confronta unicamente i parziali puri delle formazioni, escludendo modificatori e fattore campo.
              </p>
            </div>

            <div style="background:var(--bg-surface);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <h5 style="margin:0 0 6px 0;font-size:0.95rem;font-weight:800;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
                <span>🛡️</span> Tab "Per Squadra"
              </h5>
              <p style="margin:0;color:var(--text-secondary);">
                Dossier monografico completo per ciascuna fantasquadra della lega: distribuzione percentuale dei moduli utilizzati dall'allenatore, organico della rosa con il dettaglio delle presenze (titolare, subentro da panchina, sostituzione), gol/fantamedia, fantamarcatori interni e riassunto dell'efficienza delle decisioni tecniche.
              </p>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  /**
   * Binding eventi utente
   */
  bindEvents(container, seasonData, lastDay) {
    const updateContent = () => {
      const contentBox = container.querySelector('#fantamTabContent');
      if (contentBox) {
        contentBox.innerHTML = this.renderActiveTabContent(seasonData, lastDay);
        this.bindContentEvents(container, seasonData, lastDay, updateContent);
      }
    };

    // 1. Cambio competizione
    const selComp = container.querySelector('#selFantamComp');
    if (selComp) {
      selComp.addEventListener('change', async (e) => {
        this.selectedCompId = parseInt(e.target.value, 10);
        await this.render(container);
      });
    }

    // 2. Tab principale
    const mainTabs = container.querySelectorAll('#fantamMainTabs .pill-btn');
    mainTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab && targetTab !== this.currentTab) {
          this.currentTab = targetTab;
          mainTabs.forEach(b => b.classList.toggle('active', b === btn));
          updateContent();
        }
      });
    });

    this.bindContentEvents(container, seasonData, lastDay, updateContent);
  },

  /**
   * Eventi specifici del contenuto attivo
   */
  bindContentEvents(container, seasonData, lastDay, updateContent) {
    // Toggle classifica completa su mobile (Punto 3)
    const btnToggleFullFm = container.querySelector('#btnToggleFullFmTable');
    if (btnToggleFullFm) {
      btnToggleFullFm.addEventListener('click', () => {
        this.showFullFmTableMobile = !this.showFullFmTableMobile;
        updateContent();
      });
    }

    // Ordinamento colonne classifica FantaMister
    const sortHeaders = container.querySelectorAll('th[data-sort]');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (this.sortColumn === col) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = col;
          if (col === 'scartoMedio' || col === 'scartoMedioPesato' || col === 'scartoMin') {
            this.sortDirection = 'asc';
          } else {
            this.sortDirection = 'desc';
          }
        }
        this.saveSortPreferences();
        updateContent();
      });
    });

    // Sotto-tab generali (data-subtab)
    const subBtns = container.querySelectorAll('[data-subtab]');
    subBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-subtab');
        if (val) {
          this.subTab[this.currentTab] = val;
          updateContent();
        }
      });
    });

    // Sotto-tab Moduli & Bonus
    const moduliBtns = container.querySelectorAll('[data-modulitab]');
    moduliBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-modulitab');
        if (val) {
          this.subTab.moduli_bonus = val;
          updateContent();
        }
      });
    });

    // Selettore giornata Dettaglio Giornate
    const selGiornate = container.querySelector('#selGiornateDay');
    if (selGiornate) {
      selGiornate.addEventListener('change', (e) => {
        this.selectedGiornateDay = parseInt(e.target.value, 10);
        updateContent();
      });
    }

    // Toggle accordion formazione in Dettaglio Giornata
    const toggleBtns = container.querySelectorAll('[data-toggledetail]');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-toggledetail');
        this.expandedRows[key] = !this.expandedRows[key];
        updateContent();
      });
    });

    // Cambio modulo ideale selezionato all'interno dell'accordion e sincronizzazione scroll orizzontale (Punto 1)
    const setIdealModVisual = (key, mod) => {
      this.selectedIdealMod[key] = mod;
      const card = container.querySelector(`[data-idealcard="${key}"]`);
      if (!card) return;
      card.querySelectorAll(`[data-idealmod]`).forEach(b => {
        const isAct = b.getAttribute('data-idealmod') === mod;
        b.classList.toggle('active', isAct);
        b.style.borderColor = isAct ? 'var(--accent-primary)' : 'var(--border-subtle)';
        b.style.background = isAct ? 'var(--accent-primary)' : 'var(--bg-card)';
        b.style.color = isAct ? '#fff' : 'var(--text-primary)';
      });
    };

    const idealModBtns = container.querySelectorAll('[data-idealmod]');
    idealModBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mod = btn.getAttribute('data-idealmod');
        const key = btn.getAttribute('data-modkey');
        if (mod && key) {
          setIdealModVisual(key, mod);
          const carousel = container.querySelector(`[data-idealcarousel="${key}"]`);
          const slide = carousel ? carousel.querySelector(`[data-modslide="${mod}"]`) : null;
          if (carousel && slide) {
            carousel.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
          } else {
            updateContent();
          }
        }
      });
    });

    const idealCarousels = container.querySelectorAll('[data-idealcarousel]');
    idealCarousels.forEach(carousel => {
      const key = carousel.getAttribute('data-idealcarousel');
      carousel.addEventListener('scroll', () => {
        const slides = Array.from(carousel.querySelectorAll('[data-modslide]'));
        if (!slides.length) return;
        const scrollCenter = carousel.scrollLeft + carousel.clientWidth / 2;
        let closestMod = null;
        let minDist = Infinity;
        slides.forEach(sl => {
          const slCenter = sl.offsetLeft + sl.offsetWidth / 2;
          const dist = Math.abs(slCenter - scrollCenter);
          if (dist < minDist) {
            minDist = dist;
            closestMod = sl.getAttribute('data-modslide');
          }
        });
        if (closestMod && this.selectedIdealMod[key] !== closestMod) {
          setIdealModVisual(key, closestMod);
        }
      }, { passive: true });
    });

    // Cambio formazione reale per competizione (quando diverse tra competizioni) e sincronizzazione scroll
    const setRealCompVisual = (key, varKey, ptsText) => {
      this.selectedRealComp[key] = varKey;
      const card = container.querySelector(`[data-realcard="${key}"]`);
      if (!card) return;
      card.querySelectorAll(`[data-realcomp]`).forEach(b => {
        const isAct = b.getAttribute('data-realcomp') === varKey;
        b.classList.toggle('active', isAct);
        b.style.borderColor = isAct ? 'var(--accent-primary)' : 'var(--border-subtle)';
        b.style.background = isAct ? 'var(--accent-primary)' : 'var(--bg-card)';
        b.style.color = isAct ? '#fff' : 'var(--text-primary)';
      });
      const ptsSpan = card.querySelector(`[data-realpts="${key}"]`);
      if (ptsSpan && ptsText) {
        ptsSpan.textContent = ptsText;
      }
    };

    const realCompBtns = container.querySelectorAll('[data-realcomp]');
    realCompBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const varKey = btn.getAttribute('data-realcomp');
        const key = btn.getAttribute('data-realkey');
        const ptsText = btn.getAttribute('data-realptsval');
        if (varKey && key) {
          setRealCompVisual(key, varKey, ptsText);
          const carousel = container.querySelector(`[data-realcarousel="${key}"]`);
          const slide = carousel ? carousel.querySelector(`[data-realslide="${varKey}"]`) : null;
          if (carousel && slide) {
            carousel.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
          } else {
            updateContent();
          }
        }
      });
    });

    const realCarousels = container.querySelectorAll('[data-realcarousel]');
    realCarousels.forEach(carousel => {
      const key = carousel.getAttribute('data-realcarousel');
      carousel.addEventListener('scroll', () => {
        const slides = Array.from(carousel.querySelectorAll('[data-realslide]'));
        if (!slides.length) return;
        const scrollCenter = carousel.scrollLeft + carousel.clientWidth / 2;
        let closestVar = null;
        let closestPts = null;
        let minDist = Infinity;
        slides.forEach(sl => {
          const slCenter = sl.offsetLeft + sl.offsetWidth / 2;
          const dist = Math.abs(slCenter - scrollCenter);
          if (dist < minDist) {
            minDist = dist;
            closestVar = sl.getAttribute('data-realslide');
            closestPts = sl.getAttribute('data-realptsval');
          }
        });
        if (closestVar && this.selectedRealComp[key] !== closestVar) {
          setRealCompVisual(key, closestVar, closestPts);
        }
      }, { passive: true });
    });

    // Switch Top 11 / Flop 11
    const topFlopBtns = container.querySelectorAll('[data-topfloptype]');
    topFlopBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-topfloptype');
        if (val) {
          this.subTab.topflopType = val;
          updateContent();
        }
      });
    });

    // Selettore giornata Top & Flop 11
    const selTopFlopDay = container.querySelector('#selTopFlopDay');
    if (selTopFlopDay) {
      selTopFlopDay.addEventListener('change', (e) => {
        this.selectedTopFlopDay = parseInt(e.target.value, 10);
        updateContent();
      });
    }

    // Selettore modulo tattico Top & Flop 11 (Punto 2)
    const selTopFlopMod = container.querySelector('#selTopFlopModule');
    if (selTopFlopMod) {
      selTopFlopMod.addEventListener('change', (e) => {
        this.selectedTopFlopModule = e.target.value || 'auto';
        updateContent();
      });
    }

    // Selettore giornata Calenbomber
    const selCalen = container.querySelector('#selCalenbomberDay');
    if (selCalen) {
      selCalen.addEventListener('change', (e) => {
        this.selectedCalenDay = parseInt(e.target.value, 10);
        updateContent();
      });
    }

    // Ricerca marcatori
    const searchInput = container.querySelector('#fantamScorerSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value;
        updateContent();
      });
    }

    // Selettore squadra per tab 'Per Squadra'
    const selTeam = container.querySelector('#selFantamTeam');
    if (selTeam) {
      selTeam.addEventListener('change', (e) => {
        this.selectedTeamId = parseInt(e.target.value, 10);
        updateContent();
      });
    }
  }
};

if (typeof window !== 'undefined') {
  window.fantamView = fantamView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fantamView;
}
