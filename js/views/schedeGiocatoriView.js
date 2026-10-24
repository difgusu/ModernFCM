/**
 * SCHEDE GIOCATORI SERIE A VIEW
 * Schede tecniche, statistiche dettagliate, fantamedia e contratti di lega
 * ModernFCM
 */

const schedeGiocatoriView = {
  currentTeamFilter: 0,
  currentRoleFilter: 0,
  currentSearchText: '',
  currentTessFilter: 'ALL',
  currentSelectedPlayerId: null,
  currentFilteredPlayerIds: [],
  queryDataMap: {},
  contractMap: {},

  async render(container) {
    // Ensure detail data, Serie A teams, Fantasquadre and query statistics are loaded
    if (typeof arrGiocatoriA === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js');
    }
    if (typeof xa1 === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmSerieADati.js');
    }
    if (typeof arrRose === 'undefined' || typeof arrFantasquadre === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js');
    }
    if (typeof arrQuery === 'undefined') {
      await fcmDataLoader.loadScript('js/fcmQueryDati.js');
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
    await fcmDataLoader.loadScript(`js/fcmQueryQ${qId}.js`);

    // Build query data map (Q45) indexed by player code (Codice) and clean name
    this.queryDataMap = {};
    if (typeof arrRisQuery !== 'undefined') {
      for (let i = 2; i < arrRisQuery.length; i++) {
        if (arrRisQuery[i] && arrRisQuery[i].ListaValori) {
          const vals = arrRisQuery[i].ListaValori.split('%');
          if (vals && vals[0]) {
            const cleanName = vals[0].replace(/&nbsp;/g, ' ').trim();
            this.queryDataMap[cleanName] = vals;
            if (vals[3]) {
              this.queryDataMap[vals[3].trim()] = vals;
            }
          }
        }
      }
    }

    // Build contract map from arrRose
    this.contractMap = {};
    if (typeof arrRose !== 'undefined' && typeof arrFantasquadre !== 'undefined') {
      const fMap = {};
      for (let f = 1; f < arrFantasquadre.length; f++) {
        if (arrFantasquadre[f]) fMap[arrFantasquadre[f].ID] = arrFantasquadre[f].Nome;
      }
      for (let r = 1; r < arrRose.length; r++) {
        const item = arrRose[r];
        if (!item) continue;
        const isPrestito = (item.Contratto === -1 || item.Contratto === -2);
        const isInfortunato = (item.Stato === 2);
        const isActive = (item.Stato === 0 || item.Stato === 2 || isPrestito);

        const existing = this.contractMap[item.Nome];
        if (existing && existing.isActive && !isActive) {
          continue;
        }

        let stato = 'In Rosa';
        if (item.Stato === 1) stato = isPrestito ? 'Prestito' : 'Svincolato';
        else if (item.Stato === 2) stato = 'Infortunato';
        else if (isPrestito) stato = 'Prestito';

        this.contractMap[item.Nome] = {
          teamId: item.IDSquadra,
          teamNome: fMap[item.IDSquadra] || `Squadra ${item.IDSquadra}`,
          stato,
          contratto: item.Contratto,
          costoAcq: item.Acq,
          isPrestito,
          isInfortunato,
          isActive
        };
      }
    }

    // Parse URL params
    let hasDirectParam = false;
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('id')) {
        const pid = parseInt(params.get('id'), 10);
        if (!isNaN(pid)) {
          this.currentSelectedPlayerId = pid;
          hasDirectParam = true;
        }
      } else if (params.has('cod') && typeof arrGiocatoriA !== 'undefined') {
        const cod = params.get('cod');
        for (let i = 1; i < arrGiocatoriA.length; i++) {
          if (arrGiocatoriA[i].Codice === cod) {
            this.currentSelectedPlayerId = arrGiocatoriA[i].ID;
            hasDirectParam = true;
            break;
          }
        }
      } else if ((params.has('name') || params.has('player')) && typeof arrGiocatoriA !== 'undefined') {
        const rawName = (params.get('name') || params.get('player')).trim().toLowerCase();
        for (let i = 1; i < arrGiocatoriA.length; i++) {
          const g = arrGiocatoriA[i];
          if (!g) continue;
          let pName = '';
          try { pName = (typeof window !== 'undefined' && window[`xg${g.ID}`]) ? window[`xg${g.ID}`] : (g.Nome || ''); } catch (e) { pName = g.Nome || ''; }
          if (pName && (pName.toLowerCase() === rawName || (g.Nome && g.Nome.toLowerCase() === rawName))) {
            this.currentSelectedPlayerId = g.ID;
            hasDirectParam = true;
            break;
          }
        }
      }
    }

    if (hasDirectParam) {
      this.currentTeamFilter = 0;
      this.currentRoleFilter = 0;
      this.currentSearchText = '';
      this.currentTessFilter = 'ALL';
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Schede Giocatori Serie A
            </div>
            <div class="card-subtitle">Database statistico completo, medie voto, fantamedia e stato contratti</div>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="schede-filters-bar" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:16px;">
          <!-- Squadra Serie A -->
          <div style="flex:1;min-width:180px;">
            <label for="selSquadraA" style="font-size:0.75rem;font-weight:800;color:var(--accent-cyan);display:block;margin-bottom:4px;text-transform:uppercase;">
              Squadra Serie A:
            </label>
            <select id="selSquadraA" class="form-select" style="width:100%;font-weight:700;">
              <option value="0">Tutte le Squadre (20)</option>
            </select>
          </div>

          <!-- Ruolo -->
          <div style="flex:2;min-width:240px;">
            <label style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Ruolo:
            </label>
            <div class="pill-tabs" id="roleFilterGroup" style="margin:0;display:flex;gap:4px;flex-wrap:wrap;">
              <button type="button" class="pill-btn ${this.currentRoleFilter === 0 ? 'active' : ''}" data-role="0">Tutti</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 1 ? 'active' : ''}" data-role="1" style="color:#d97706;">P</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 2 ? 'active' : ''}" data-role="2" style="color:#16a34a;">D</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 3 ? 'active' : ''}" data-role="3" style="color:#2563eb;">C</button>
              <button type="button" class="pill-btn ${this.currentRoleFilter === 4 ? 'active' : ''}" data-role="4" style="color:#dc2626;">A</button>
            </div>
          </div>

          <!-- Cerca per Nome -->
          <div style="flex:2;min-width:220px;">
            <label for="inputSearch" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Cerca Calciatore:
            </label>
            <div style="position:relative;">
              <input type="text" id="inputSearch" class="form-control" placeholder="Digita nome o cognome..." value="${this.currentSearchText}" style="width:100%;padding:8px 30px 8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;" />
              <button type="button" id="btnClearSearch" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);font-weight:800;cursor:pointer;display:${this.currentSearchText ? 'block' : 'none'};">✕</button>
            </div>
          </div>

          <!-- Tesseramento / Rosa -->
          <div style="flex:1;min-width:180px;">
            <label for="selTesserati" style="font-size:0.75rem;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;">
              Filtro Rosa:
            </label>
            <select id="selTesserati" class="form-select" style="width:100%;font-size:0.8rem;">
              <option value="ALL">Tutti i calciatori</option>
              <option value="OWNED">Solo Tesserati in Lega</option>
              <option value="FREE">Solo Liberi da contratto</option>
            </select>
          </div>
        </div>

        <!-- Mobile Tabs (List vs Profile) -->
        <div class="schede-mobile-tabs" id="schedeMobileTabs" style="display:none;margin-bottom:12px;gap:8px;">
          <button type="button" class="pill-btn ${hasDirectParam ? '' : 'active'}" id="tabBtnList" style="flex:1;padding:10px;font-weight:800;">
            📋 Elenco (<span id="mobileTabCount">0</span>)
          </button>
          <button type="button" class="pill-btn ${hasDirectParam ? 'active' : ''}" id="tabBtnProfile" style="flex:1;padding:10px;font-weight:800;">
            👤 Scheda Calciatore
          </button>
        </div>

        <!-- Main Master/Detail Layout -->
        <div class="schede-layout" id="schedeLayout" data-active-tab="${hasDirectParam ? 'profile' : 'list'}" style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start;">
          <!-- Left: Scrollable Player List -->
          <div id="playerListPane" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;display:flex;flex-direction:column;max-height:720px;">
            <div style="padding:10px 14px;background:var(--bg-surface);border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.78rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">Calciatori Serie A</span>
              <span id="playerCountBadge" class="badge" style="background:var(--accent-primary);color:#fff;font-weight:800;">0</span>
            </div>
            <div id="playersListContainer" style="overflow-y:auto;flex:1;padding:6px;"></div>
          </div>

          <!-- Right: Player Profile Detail -->
          <div id="playerDetailPane" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:20px;">
            <div class="text-center text-muted" style="padding:40px;">Seleziona un calciatore dalla lista per visualizzarne la scheda.</div>
          </div>
        </div>
      </div>
    `;

    // Populate Serie A teams in dropdown (1 to 20 only)
    const selSquadra = container.querySelector('#selSquadraA');
    for (let s = 1; s <= 20; s++) {
      const opt = document.createElement('option');
      opt.value = s;
      try {
        opt.textContent = eval(`xa${s}`);
      } catch (e) {
        opt.textContent = `Squadra ${s}`;
      }
      selSquadra.appendChild(opt);
    }

    // Populate Fantasquadre in selTesserati
    const selTess = container.querySelector('#selTesserati');
    if (typeof arrFantasquadre !== 'undefined') {
      const optGroup = document.createElement('optgroup');
      optGroup.label = 'Fantasquadre di Lega';
      for (let f = 1; f < arrFantasquadre.length; f++) {
        if (arrFantasquadre[f]) {
          const optF = document.createElement('option');
          optF.value = `TEAM_${arrFantasquadre[f].ID}`;
          optF.textContent = `Rosa: ${arrFantasquadre[f].Nome}`;
          optGroup.appendChild(optF);
        }
      }
      selTess.appendChild(optGroup);
    }

    // Attach filter listeners
    selSquadra.addEventListener('change', (e) => {
      this.currentTeamFilter = parseInt(e.target.value, 10) || 0;
      this.updatePlayersList(container);
    });

    container.querySelectorAll('#roleFilterGroup button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#roleFilterGroup button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRoleFilter = parseInt(btn.getAttribute('data-role'), 10) || 0;
        this.updatePlayersList(container);
      });
    });

    const searchInput = container.querySelector('#inputSearch');
    const clearBtn = container.querySelector('#btnClearSearch');
    searchInput.addEventListener('input', (e) => {
      this.currentSearchText = e.target.value.trim();
      clearBtn.style.display = this.currentSearchText.length > 0 ? 'block' : 'none';
      this.updatePlayersList(container);
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.currentSearchText = '';
      clearBtn.style.display = 'none';
      this.updatePlayersList(container);
      searchInput.focus();
    });

    selTess.addEventListener('change', (e) => {
      this.currentTessFilter = e.target.value;
      this.updatePlayersList(container);
    });

    // Mobile tabs
    const tabListBtn = container.querySelector('#tabBtnList');
    const tabProfileBtn = container.querySelector('#tabBtnProfile');
    const listPane = container.querySelector('#playerListPane') || container.querySelector('#playersListContainer').parentElement;
    const detailPane = container.querySelector('#playerDetailPane');

    let activeMobileTab = hasDirectParam ? 'profile' : 'list';

    const switchMobileTab = (tab, scroll = true) => {
      activeMobileTab = tab;
      const layout = container.querySelector('#schedeLayout');
      if (layout) layout.setAttribute('data-active-tab', tab);

      if (window.innerWidth > 860) {
        listPane.style.display = 'flex';
        detailPane.style.display = 'block';
        return;
      }
      if (tab === 'list') {
        tabListBtn.classList.add('active');
        tabProfileBtn.classList.remove('active');
        listPane.style.display = 'flex';
        detailPane.style.display = 'none';
      } else {
        tabProfileBtn.classList.add('active');
        tabListBtn.classList.remove('active');
        listPane.style.display = 'none';
        detailPane.style.display = 'block';
      }
      if (scroll && window.innerWidth <= 860) {
        const mTabs = container.querySelector('#schedeMobileTabs');
        if (mTabs) mTabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const checkMobileLayout = () => {
      const isMobile = window.innerWidth <= 860;
      const mTabs = container.querySelector('#schedeMobileTabs');
      const layout = container.querySelector('#schedeLayout');
      if (mTabs && layout) {
        if (isMobile) {
          mTabs.style.display = 'flex';
          layout.style.gridTemplateColumns = '1fr';
          switchMobileTab(activeMobileTab, false);
        } else {
          mTabs.style.display = 'none';
          layout.style.gridTemplateColumns = '300px 1fr';
          listPane.style.display = 'flex';
          detailPane.style.display = 'block';
        }
      }
    };

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = checkMobileLayout;
    window.addEventListener('resize', checkMobileLayout);

    tabListBtn.addEventListener('click', () => switchMobileTab('list'));
    tabProfileBtn.addEventListener('click', () => switchMobileTab('profile'));

    this.switchMobileTabFn = switchMobileTab;

    // Apply layout state immediately
    checkMobileLayout();

    // Initial populate
    this.updatePlayersList(container);
  },

  updatePlayersList(container) {
    const listContainer = container.querySelector('#playersListContainer');
    const countBadge = container.querySelector('#playerCountBadge');
    const mobileCount = container.querySelector('#mobileTabCount');
    if (!listContainer || typeof arrGiocatoriA === 'undefined') return;

    const matchedPlayers = [];

    for (let p = 1; p < arrGiocatoriA.length; p++) {
      const pl = arrGiocatoriA[p];
      if (!pl) continue;
      let pName = '';
      try { pName = eval(`xg${pl.ID}`); } catch (e) { pName = `Giocatore ${pl.ID}`; }
      let pTeam = '';
      try { pTeam = eval(`xa${pl.IDSquadra}`); } catch (e) { pTeam = ''; }

      // Exclude non-Serie A players ({ELIMINATA}, {SERIE ESTERA}, {SERIE MINORE} or IDSquadra > 20)
      if (pl.IDSquadra > 20 || !pTeam || pTeam.startsWith('{') || pTeam.includes('{ELIMINATA}') || pTeam.includes('{SERIE ESTERA}') || pTeam.includes('{SERIE MINORE}')) {
        continue;
      }

      // Filters
      if (this.currentTeamFilter > 0 && pl.IDSquadra !== this.currentTeamFilter) continue;
      if (this.currentRoleFilter > 0 && pl.Ruolo !== this.currentRoleFilter) continue;
      if (this.currentSearchText.length > 0) {
        const sLower = this.currentSearchText.toLowerCase();
        if (!pName.toLowerCase().includes(sLower) && !pTeam.toLowerCase().includes(sLower)) continue;
      }

      const cInfo = this.contractMap[pName];
      const isOwned = (cInfo && cInfo.teamNome && cInfo.stato !== 'Svincolato' && cInfo.stato !== 'Libero');
      if (this.currentTessFilter === 'OWNED' && !isOwned) continue;
      if (this.currentTessFilter === 'FREE' && isOwned) continue;
      if (this.currentTessFilter.startsWith('TEAM_')) {
        const fId = parseInt(this.currentTessFilter.substring(5), 10);
        if (!isOwned || cInfo.teamId !== fId) continue;
      }

      matchedPlayers.push({
        pl,
        pName,
        pTeam,
        isOwned,
        cInfo: cInfo || { stato: 'Libero da Contratto', teamNome: '', contratto: 0, costoAcq: 0, isPrestito: false, isInfortunato: false }
      });
    }

    // Sort: 1) Role (P:1, D:2, C:3, A:4), 2) Alphabetical by pName
    matchedPlayers.sort((a, b) => {
      if (a.pl.Ruolo !== b.pl.Ruolo) {
        return a.pl.Ruolo - b.pl.Ruolo;
      }
      return a.pName.localeCompare(b.pName, 'it', { sensitivity: 'base' });
    });

    const matchCount = matchedPlayers.length;
    this.currentFilteredPlayerIds = matchedPlayers.map(m => m.pl.ID);
    const firstMatchId = this.currentFilteredPlayerIds[0] || null;

    const htmlRows = matchedPlayers.map(m => {
      const rLetter = m.pl.Ruolo === 1 ? 'P' : m.pl.Ruolo === 2 ? 'D' : m.pl.Ruolo === 3 ? 'C' : 'A';
      const isSelected = (this.currentSelectedPlayerId === m.pl.ID);

      return `
        <div class="schede-player-row ${isSelected ? 'active' : ''}" data-player-id="${m.pl.ID}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s;background:${isSelected ? 'var(--bg-surface)' : 'transparent'};border:1px solid ${isSelected ? 'var(--accent-primary)' : 'transparent'};margin-bottom:2px;">
          <span class="role-badge role-${rLetter.toLowerCase()}">${rLetter}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${m.pName}
            </div>
            <div style="display:flex;align-items:center;gap:5px;font-size:0.74rem;color:var(--text-secondary);flex-wrap:wrap;">
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <img src="img/live/sq/${encodeURI(m.pTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/sq/${encodeURI(m.pTeam)}.jpg';}else{this.style.display='none';}" style="width:13px;height:13px;object-fit:contain;vertical-align:middle;" alt="" />
                <span>${m.pTeam}</span>
              </span>
              ${m.isOwned ? `
                <span style="display:inline-flex;align-items:center;gap:4px;color:var(--accent-cyan);font-weight:700;">
                  &bull;
                  <img src="img/sq/${encodeURI(m.cInfo.teamNome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.cInfo.teamNome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;" alt="" />
                  <span>${m.cInfo.teamNome}</span>
                  ${m.cInfo.isPrestito ? `<span style="font-size:0.68rem;color:var(--text-muted);" title="${m.cInfo.contratto === -1 ? 'Prestito da lista svincolati (sostituzione infortunato)' : 'Prestito secco'}">(Prestito)</span>` : ''}
                  ${m.cInfo.isInfortunato ? '<span title="Calciatore inserito in lista infortunati">🚑</span>' : ''}
                </span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    if (countBadge) countBadge.textContent = matchCount;
    if (mobileCount) mobileCount.textContent = matchCount;

    if (matchCount === 0) {
      listContainer.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Nessun calciatore trovato.</div>`;
    } else {
      listContainer.innerHTML = htmlRows.join('');
    }

    // Attach click events to rows
    listContainer.querySelectorAll('.schede-player-row').forEach(row => {
      row.addEventListener('click', () => {
        const pId = parseInt(row.getAttribute('data-player-id'), 10);
        this.selectPlayer(container, pId, true);
      });
    });

    // If current selected player is not in matches or none selected, pick the first
    if ((!this.currentSelectedPlayerId || !this.currentFilteredPlayerIds.includes(this.currentSelectedPlayerId)) && firstMatchId) {
      this.selectPlayer(container, firstMatchId, false);
    } else if (this.currentSelectedPlayerId) {
      this.renderPlayerDetail(container, this.currentSelectedPlayerId);
      const activeRow = listContainer.querySelector(`.schede-player-row[data-player-id="${this.currentSelectedPlayerId}"]`);
      if (activeRow) {
        activeRow.scrollIntoView({ block: 'nearest' });
      }
    }
  },

  selectPlayer(container, playerId, switchToMobileProfile = false) {
    this.currentSelectedPlayerId = playerId;

    try {
      history.replaceState(null, '', '#schede_giocatori?id=' + playerId);
    } catch (e) { }

    // Update active class in list
    const listContainer = container.querySelector('#playersListContainer');
    if (listContainer) {
      listContainer.querySelectorAll('.schede-player-row').forEach(row => {
        const id = parseInt(row.getAttribute('data-player-id'), 10);
        if (id === playerId) {
          row.classList.add('active');
          row.style.background = 'var(--bg-surface)';
          row.style.borderColor = 'var(--accent-primary)';
          row.scrollIntoView({ block: 'nearest' });
        } else {
          row.classList.remove('active');
          row.style.background = 'transparent';
          row.style.borderColor = 'transparent';
        }
      });
    }

    this.renderPlayerDetail(container, playerId);

    if (switchToMobileProfile && typeof this.switchMobileTabFn === 'function' && window.innerWidth <= 860) {
      this.switchMobileTabFn('profile');
    }
  },

  renderPlayerDetail(container, playerId) {
    const detailPane = container.querySelector('#playerDetailPane');
    if (!detailPane || typeof arrGiocatoriA === 'undefined') return;

    const pl = arrGiocatoriA.find(g => g && g.ID === playerId);
    if (!pl) return;

    let pName = '';
    try { pName = eval(`xg${pl.ID}`); } catch (e) { pName = `Giocatore ${pl.ID}`; }
    let pTeam = '';
    try { pTeam = eval(`xa${pl.IDSquadra}`); } catch (e) { pTeam = ''; }

    // Update mobile profile tab title with player name
    const tabProfileBtn = container.querySelector('#tabBtnProfile');
    if (tabProfileBtn) {
      tabProfileBtn.textContent = `👤 ${pName}`;
    }

    const cInfo = this.contractMap[pName] || { stato: 'Libero da Contratto', teamNome: '', contratto: 0, costoAcq: 0, isPrestito: false, isInfortunato: false };
    const hasTeam = !!cInfo.teamNome;
    const isOwned = hasTeam && cInfo.stato !== 'Svincolato' && cInfo.stato !== 'Libero';
    const rLetter = pl.Ruolo === 1 ? 'P' : pl.Ruolo === 2 ? 'D' : pl.Ruolo === 3 ? 'C' : 'A';
    const rFull = pl.Ruolo === 1 ? 'Portiere' : pl.Ruolo === 2 ? 'Difensore' : pl.Ruolo === 3 ? 'Centrocampista' : 'Attaccante';

    // Query stats from Q45 (by player code or clean name)
    const q = (pl.Codice && this.queryDataMap[pl.Codice.toString().trim()]) || this.queryDataMap[pName] || [];

    // Helper tile
    const tile = (desc, sigla, val) => `
      <div class="schede-stat-tile" title="${desc} (${sigla})">
        <div class="schede-stat-sigla">${sigla}</div>
        <div class="schede-stat-val">${val !== undefined && val !== null && val !== '' ? val : '-'}</div>
      </div>
    `;

    // Navigation index among filtered players
    const curIdx = this.currentFilteredPlayerIds.indexOf(playerId);
    const hasPrev = curIdx > 0;
    const hasNext = curIdx >= 0 && curIdx < this.currentFilteredPlayerIds.length - 1;

    detailPane.innerHTML = `
      <!-- Top Bar with Back, Counter and Next / Prev buttons -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" id="btnBackToListMobile" class="pill-btn" style="display:${window.innerWidth <= 860 ? 'inline-flex' : 'none'};align-items:center;gap:4px;padding:6px 12px;font-size:0.8rem;font-weight:800;background:var(--bg-surface);border:1px solid var(--border-subtle);cursor:pointer;">
            ← Torna all'Elenco
          </button>
          <span style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">
            Scheda ${curIdx + 1} di ${this.currentFilteredPlayerIds.length}
          </span>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" id="btnPrevPlayer" class="pill-btn" ${!hasPrev ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            ◀ Precedente
          </button>
          <button type="button" id="btnNextPlayer" class="pill-btn" ${!hasNext ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            Successivo ▶
          </button>
        </div>
      </div>

      <!-- Player Hero Card -->
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;background:var(--bg-surface);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:20px;">
        <div style="width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid var(--border-subtle);flex-shrink:0;background:var(--bg-surface-elevated);">
          <img src="img/schede/${pl.Codice}.jpg" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${pName}" style="width:100%;height:100%;object-fit:cover;" />
        </div>

        <div style="flex:1;min-width:200px;">
          <h2 style="margin:0 0 6px 0;font-size:1.35rem;font-weight:800;color:var(--text-primary);">${pName}</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.8rem;align-items:center;">
            <span class="role-badge role-${rLetter.toLowerCase()}">${rFull}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;">
              <img src="img/live/sq/${encodeURI(pTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/live/sq/${encodeURI(pTeam)}.jpg';}else{this.style.display='none';}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" alt="${pTeam}" />
              <span>${pTeam}</span>
            </span>
            <span style="background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);color:var(--accent-gold);font-weight:700;">💰 ${pl.Crediti} FMld</span>
            <span style="display:inline-flex;align-items:center;gap:5px;background:${hasTeam ? 'rgba(6,182,212,0.12)' : 'var(--bg-surface-elevated)'};color:${hasTeam ? 'var(--accent-cyan)' : 'var(--text-muted)'};padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;">
              ${hasTeam ? `
                <img src="img/sq/${encodeURI(cInfo.teamNome)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(cInfo.teamNome)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;" alt="" />
                <span>${cInfo.teamNome}</span>
              ` : '🆓 Libero da Contratto'}
            </span>
            ${hasTeam && isOwned ? `
              <span style="background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-weight:700;color:${cInfo.isPrestito ? 'var(--accent-cyan)' : 'var(--accent-gold)'};" ${cInfo.isPrestito ? `title="${cInfo.contratto === -1 ? 'Prestito da lista svincolati (sostituzione infortunato)' : 'Prestito secco'}"` : ''}>
                📝 ${cInfo.isPrestito ? 'Prestito' : (cInfo.costoAcq + ' Fml')}
              </span>
            ` : (hasTeam ? `
              <span style="background:var(--bg-surface-elevated);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);color:var(--text-muted);">
                📝 ${cInfo.stato}
              </span>
            ` : '')}
            ${hasTeam && cInfo.isInfortunato ? `
              <span style="background:rgba(239,68,68,0.15);color:var(--accent-crimson);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.3);font-weight:700;" title="Calciatore inserito in lista infortunati">
                🚑 Infortunato
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Section 1: Statistiche sul Campo -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-cyan);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>⚽</span> Statistiche sul Campo
        </div>
        <div class="schede-stats-grid-8">
          ${tile("Presenze", "Pres", q[6])}
          ${pl.Ruolo === 1 ? `
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

      <!-- Section 2: Medie Voto & Fantamedia -->
      <div style="margin-bottom:20px;">
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-emerald);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📊</span> Medie Voto &amp; Fantamedia
        </div>
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

      <!-- Section 3: Indici di Rendimento & Varie -->
      <div>
        <div style="font-size:0.9rem;font-weight:800;color:var(--accent-gold);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span>📈</span> Indici di Rendimento &amp; Varie
        </div>
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

    // Prev / Next and Back button listeners
    const btnBack = detailPane.querySelector('#btnBackToListMobile');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (typeof this.switchMobileTabFn === 'function') {
          this.switchMobileTabFn('list');
        }
      });
    }

    if (hasPrev) {
      detailPane.querySelector('#btnPrevPlayer').addEventListener('click', () => {
        this.selectPlayer(container, this.currentFilteredPlayerIds[curIdx - 1], false);
      });
    }
    if (hasNext) {
      detailPane.querySelector('#btnNextPlayer').addEventListener('click', () => {
        this.selectPlayer(container, this.currentFilteredPlayerIds[curIdx + 1], false);
      });
    }
  }
};

if (typeof window !== 'undefined') {
  window.schedeGiocatoriView = schedeGiocatoriView;
}
