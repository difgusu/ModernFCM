/**
 * CLASSIFICA VIEW
 * Full responsive standings for all competitions and groups
 * Supporting official tie-breaking rules, advanced/base stats views, and interactive column sorting
 * ModernFCM
 */

const classificaView = {
  currentCompId: 0,
  currentGroupId: 1, // Default: 1 = ModernFCM
  showAdvanced: false,
  isExpandedBase: null, // null = auto-detect based on screen width
  sortKey: 'pos',
  sortOrder: 'asc',
  _hasResizeHandler: false,
  _userExplicitToggle: false,

  // Valid keys for compact base view (mobile & desktop compact)
  compactBaseKeys: [
    'pos', 'name', 'points', 'played',
    'winsTot', 'drawsTot', 'lossesTot',
    'goalsFor', 'goalsAgainst',
    'sommaTotali'
  ],

  // Valid keys for expanded base view (without DR, aligned with arrColonneClassifica)
  baseKeys: [
    'pos', 'name', 'points', 'played', 'bonusMalus',
    'winsTot', 'drawsTot', 'lossesTot',
    'goalsFor', 'goalsAgainst', 'mediaInglese',
    'winsHome', 'drawsHome', 'lossesHome',
    'winsAway', 'drawsAway', 'lossesAway',
    'goalsForHome', 'goalsAgainstHome',
    'goalsForAway', 'goalsAgainstAway',
    'sommaTotali'
  ],

  // Valid keys for advanced stats view
  advancedKeys: [
    'pos', 'name', 'points', 'played',
    'mediaTotali', 'minTotali', 'maxTotali', 'devStdTotali', 'mediaAvversariTotali', 'sommaTotali',
    'mediaParziali', 'minParziali', 'maxParziali', 'devStdParziali', 'mediaAvversariParziali', 'sommaParziali'
  ],

  initExpandState() {
    if (!this._userExplicitToggle) {
      this.isExpandedBase = typeof window !== 'undefined' && window.innerWidth > 768;
    }
  },

  isMobileView() {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  },

  getGironeBitmask(groupId) {
    if (typeof arrColonneClassifica !== 'undefined' && Array.isArray(arrColonneClassifica)) {
      for (let k = 1; k < arrColonneClassifica.length; k++) {
        if (arrColonneClassifica[k] && arrColonneClassifica[k].IDGirone == groupId) {
          return arrColonneClassifica[k].Colonne;
        }
      }
    }
    // Fallback: bitmask standard 32 bit (DR non presente)
    return "11101111111111111111111111111111";
  },

  renderSortIcon(key) {
    if (this.sortKey === key) {
      return `<span class="sort-icon sort-active">${this.sortOrder === 'asc' ? '▲' : '▼'}</span>`;
    }
    return `<span class="sort-icon sort-neutral">↕</span>`;
  },

  getSortedStandings(list) {
    const key = this.sortKey;
    const order = this.sortOrder;

    return [...list].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, 'it', { sensitivity: 'base' });
        if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
      } else {
        valA = (valA !== undefined && valA !== null && !isNaN(valA)) ? Number(valA) : 0;
        valB = (valB !== undefined && valB !== null && !isNaN(valB)) ? Number(valB) : 0;
        if (valA !== valB) {
          return order === 'asc' ? valA - valB : valB - valA;
        }
      }

      // Tie-breakers when primary sort values are equal:
      // 1. If sorting by points, higher sommaTotali wins
      if (key === 'points') {
        if ((b.sommaTotali || 0) !== (a.sommaTotali || 0)) {
          return (b.sommaTotali || 0) - (a.sommaTotali || 0);
        }
      }
      // 2. Points
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }
      // 3. Somma Totali (TTot)
      if ((b.sommaTotali || 0) !== (a.sommaTotali || 0)) {
        return (b.sommaTotali || 0) - (a.sommaTotali || 0);
      }
      // 4. Official FCM Position (Pos)
      return (a.pos || 0) - (b.pos || 0);
    });
  },

  handleSort(key, container) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = (key === 'name' || key === 'pos') ? 'asc' : 'desc';
    }
    this.renderTable(container);
  },

  renderTable(container) {
    const tableWrapper = container.querySelector('#classificaTableWrapper');
    if (!tableWrapper) return;

    const rawStandings = fcmDataLoader.getStandings(this.currentGroupId);
    const standings = this.getSortedStandings(rawStandings);

    tableWrapper.innerHTML = this.getTableHtml(standings);
    this.bindTableEvents(container);

    // Update scroll hint visibility: only visible when expanded or advanced
    const scrollHint = container.querySelector('.classifica-scroll-hint');
    if (scrollHint) {
      if (this.showAdvanced || this.isExpandedBase) {
        scrollHint.classList.add('is-visible');
      } else {
        scrollHint.classList.remove('is-visible');
      }
    }
  },

  bindTableEvents(container) {
    const sortHeaders = container.querySelectorAll('#classificaTableWrapper th.sortable');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (key) {
          this.handleSort(key, container);
        }
      });
    });
  },

  bindResizeHandler(container) {
    if (this._hasResizeHandler) return;
    this._hasResizeHandler = true;
    let resizeTimer = null;
    let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const crossedBreakpoint = (lastWidth > 768 && currentWidth <= 768) || (lastWidth <= 768 && currentWidth > 768);
        lastWidth = currentWidth;
        if (crossedBreakpoint && !this._userExplicitToggle) {
          this.isExpandedBase = currentWidth > 768;
          this.render(container);
          return;
        }
        const tableWrapper = container.querySelector('#classificaTableWrapper');
        if (tableWrapper) {
          this.renderTable(container);
        }
      }, 150);
    });
  },

  getTableHtml(standings) {
    if (this.showAdvanced) {
      return this.getAdvancedTableHtml(standings);
    }
    if (this.isExpandedBase) {
      return this.getExpandedBaseTableHtml(standings);
    }
    if (this.isMobileView()) {
      return this.getMobileCompactBaseTableHtml(standings);
    }
    return this.getCompactBaseTableHtml(standings);
  },

  /**
   * Vista Base Compatta per Mobile (disposizione su 2 righe per squadra)
   * Riga 1: # | Squadra (logo + nome + trofei + coach)
   * Riga 2: PT | G | V | N | P | GF | GS | Totali (perfettamente allineate e dimensionate)
   * Zero scorrimento orizzontale su qualsiasi smartphone.
   */
  getMobileCompactBaseTableHtml(standings) {
    const bitmask = this.getGironeBitmask(this.currentGroupId);
    const showCoach = bitmask.charAt(1) === '1';

    return `
      <table class="modern-table standings-table-mobile-compact">
        <thead>
          <tr class="row-team-header">
            <th rowspan="2" class="sortable text-center col-pos ${this.sortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" style="vertical-align:middle;" title="Posizione Ufficiale">
              # ${this.renderSortIcon('pos')}
            </th>
            <th colspan="8" class="sortable col-team ${this.sortKey === 'name' ? 'is-sorted' : ''}" data-sort="name" title="Nome Squadra">
              Squadra ${this.renderSortIcon('name')}
            </th>
          </tr>
          <tr class="row-stats-header">
            <th class="sortable text-center col-pts ${this.sortKey === 'points' ? 'is-sorted' : ''}" data-sort="points" title="Punti in Classifica">
              PT ${this.renderSortIcon('points')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'played' ? 'is-sorted' : ''}" data-sort="played" title="Partite Giocate">
              G ${this.renderSortIcon('played')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'winsTot' ? 'is-sorted' : ''}" data-sort="winsTot" title="Vinte Totali">
              V ${this.renderSortIcon('winsTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'drawsTot' ? 'is-sorted' : ''}" data-sort="drawsTot" title="Nulle Totali">
              N ${this.renderSortIcon('drawsTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'lossesTot' ? 'is-sorted' : ''}" data-sort="lossesTot" title="Perse Totali">
              P ${this.renderSortIcon('lossesTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'goalsFor' ? 'is-sorted' : ''}" data-sort="goalsFor" title="Gol Fatti Totali">
              GF ${this.renderSortIcon('goalsFor')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'goalsAgainst' ? 'is-sorted' : ''}" data-sort="goalsAgainst" title="Gol Subiti Totali">
              GS ${this.renderSortIcon('goalsAgainst')}
            </th>
            <th class="sortable text-center col-totali ${this.sortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali" title="Somma Totali Squadra">
              Totali ${this.renderSortIcon('sommaTotali')}
            </th>
          </tr>
        </thead>
        <tbody>
          ${standings.length > 0 ? standings.map(s => `
            <tr class="team-row-top">
              <td rowspan="2" class="table-pos col-pos text-center ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}" style="vertical-align:middle;border-bottom:1px solid var(--border-subtle);font-size:0.95rem;font-weight:800;">
                ${s.pos}
              </td>
              <td colspan="8" class="col-team">
                <div class="table-col-team">
                  <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;font-size:0.88rem;">${s.name} ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
                    ${showCoach && s.coach ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.coach}</div>` : ''}
                  </div>
                </div>
              </td>
            </tr>
            <tr class="team-row-bottom">
              <td class="text-center table-pts font-bold col-pts" style="${this.sortKey === 'points' ? 'background:rgba(59,130,246,0.08);' : ''}">
                ${s.points}
              </td>
              <td class="text-center font-bold col-stat">
                ${s.played}
              </td>
              <td class="text-center col-stat" style="color:var(--accent-emerald);font-weight:700;">
                ${s.winsTot}
              </td>
              <td class="text-center col-stat" style="color:var(--text-muted);">
                ${s.drawsTot}
              </td>
              <td class="text-center col-stat" style="color:var(--accent-rose);">
                ${s.lossesTot}
              </td>
              <td class="text-center col-stat">
                ${s.goalsFor}
              </td>
              <td class="text-center col-stat">
                ${s.goalsAgainst}
              </td>
              <td class="text-center font-bold col-totali" style="color:var(--accent-cyan);${this.sortKey === 'sommaTotali' ? 'background:rgba(59,130,246,0.08);' : ''}">
                ${Number(s.sommaTotali || 0).toFixed(2)}
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="9" class="text-center" style="padding: 24px;">
                Nessuna squadra o incontro disputato per questo girone.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  },

  /**
   * Vista Base Compatta per Desktop (singola riga standard, molto pulita)
   * Include solo le colonne principali: Giocate, Punti, Vinte, Nulle, Perse, GolFatti, GolSubiti, Totali
   */
  getCompactBaseTableHtml(standings) {
    const bitmask = this.getGironeBitmask(this.currentGroupId);
    const showCoach = bitmask.charAt(1) === '1';

    return `
      <table class="modern-table standings-table">
        <thead>
          <tr>
            <th class="sortable text-center col-pos ${this.sortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" title="Posizione Ufficiale">
              # ${this.renderSortIcon('pos')}
            </th>
            <th class="sortable col-team ${this.sortKey === 'name' ? 'is-sorted' : ''}" data-sort="name" title="Nome Squadra">
              Squadra ${this.renderSortIcon('name')}
            </th>
            <th class="sortable text-center col-pts ${this.sortKey === 'points' ? 'is-sorted' : ''}" data-sort="points" title="Punti in Classifica">
              PT ${this.renderSortIcon('points')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'played' ? 'is-sorted' : ''}" data-sort="played" title="Partite Giocate">
              G ${this.renderSortIcon('played')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'winsTot' ? 'is-sorted' : ''}" data-sort="winsTot" title="Vinte Totali">
              V ${this.renderSortIcon('winsTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'drawsTot' ? 'is-sorted' : ''}" data-sort="drawsTot" title="Nulle Totali">
              N ${this.renderSortIcon('drawsTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'lossesTot' ? 'is-sorted' : ''}" data-sort="lossesTot" title="Perse Totali">
              P ${this.renderSortIcon('lossesTot')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'goalsFor' ? 'is-sorted' : ''}" data-sort="goalsFor" title="Gol Fatti Totali">
              GF ${this.renderSortIcon('goalsFor')}
            </th>
            <th class="sortable text-center col-stat ${this.sortKey === 'goalsAgainst' ? 'is-sorted' : ''}" data-sort="goalsAgainst" title="Gol Subiti Totali">
              GS ${this.renderSortIcon('goalsAgainst')}
            </th>
            <th class="sortable text-center col-totali ${this.sortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali" title="Somma Totali Squadra">
              Totali ${this.renderSortIcon('sommaTotali')}
            </th>
          </tr>
        </thead>
        <tbody>
          ${standings.length > 0 ? standings.map(s => `
            <tr>
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${s.name} ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
                    ${showCoach && s.coach ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.coach}</div>` : ''}
                  </div>
                </div>
              </td>
              <td class="text-center table-pts font-bold col-pts" style="${this.sortKey === 'points' ? 'background:rgba(59,130,246,0.08);' : ''}">${s.points}</td>
              <td class="text-center font-bold col-stat">${s.played}</td>
              <td class="text-center col-stat" style="color:var(--accent-emerald);font-weight:700;">${s.winsTot}</td>
              <td class="text-center col-stat" style="color:var(--text-muted);">${s.drawsTot}</td>
              <td class="text-center col-stat" style="color:var(--accent-rose);">${s.lossesTot}</td>
              <td class="text-center col-stat">${s.goalsFor}</td>
              <td class="text-center col-stat">${s.goalsAgainst}</td>
              <td class="text-center font-bold col-totali" style="color:var(--accent-cyan); ${this.sortKey === 'sommaTotali' ? 'background:rgba(59,130,246,0.08);' : ''}">
                ${Number(s.sommaTotali || 0).toFixed(2)}
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="10" class="text-center" style="padding: 24px;">
                Nessuna squadra o incontro disputato per questo girone.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  },

  /**
   * Vista Base Espansa
   * Colonne regolate dinamicamente da arrColonneClassifica (senza DR)
   */
  getExpandedBaseTableHtml(standings) {
    const bitmask = this.getGironeBitmask(this.currentGroupId);
    const showCoach = bitmask.charAt(1) === '1';
    const showBM = bitmask.charAt(3) === '1';
    const showCV = bitmask.charAt(4) === '1';
    const showCN = bitmask.charAt(5) === '1';
    const showCP = bitmask.charAt(6) === '1';
    const showFV = bitmask.charAt(7) === '1';
    const showFN = bitmask.charAt(8) === '1';
    const showFP = bitmask.charAt(9) === '1';
    const showV = bitmask.charAt(10) === '1';
    const showN = bitmask.charAt(11) === '1';
    const showP = bitmask.charAt(12) === '1';
    const showMI = bitmask.charAt(13) === '1';
    const showCF = bitmask.charAt(14) === '1';
    const showCS = bitmask.charAt(15) === '1';
    const showFF = bitmask.charAt(16) === '1';
    const showFS = bitmask.charAt(17) === '1';
    const showGF = bitmask.charAt(18) === '1';
    const showGS = bitmask.charAt(19) === '1';
    const showTot = bitmask.charAt(31) === '1';

    // Conteggi colspan per le sezioni
    const cntTotale = (showBM ? 1 : 0) + (showV ? 1 : 0) + (showN ? 1 : 0) + (showP ? 1 : 0) + (showGF ? 1 : 0) + (showGS ? 1 : 0) + (showMI ? 1 : 0);
    const cntCasa = (showCV ? 1 : 0) + (showCN ? 1 : 0) + (showCP ? 1 : 0);
    const cntFuori = (showFV ? 1 : 0) + (showFN ? 1 : 0) + (showFP ? 1 : 0);
    const cntRetiCasa = (showCF ? 1 : 0) + (showCS ? 1 : 0);
    const cntRetiFuori = (showFF ? 1 : 0) + (showFS ? 1 : 0);

    const totalCols = 4 + cntTotale + cntCasa + cntFuori + cntRetiCasa + cntRetiFuori + (showTot ? 1 : 0);

    return `
      <table class="modern-table standings-table">
        <thead>
          <tr>
            <th rowspan="2" class="sortable text-center col-pos ${this.sortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" title="Posizione Ufficiale">
              # ${this.renderSortIcon('pos')}
            </th>
            <th rowspan="2" class="sortable col-team ${this.sortKey === 'name' ? 'is-sorted' : ''}" data-sort="name" title="Nome Squadra">
              Squadra ${this.renderSortIcon('name')}
            </th>
            <th rowspan="2" class="sortable text-center col-pts ${this.sortKey === 'points' ? 'is-sorted' : ''}" data-sort="points" title="Punti in Classifica">
              PT ${this.renderSortIcon('points')}
            </th>
            <th rowspan="2" class="sortable text-center col-stat ${this.sortKey === 'played' ? 'is-sorted' : ''}" data-sort="played" title="Partite Giocate">
              G ${this.renderSortIcon('played')}
            </th>
            ${cntTotale > 0 ? `<th colspan="${cntTotale}" class="text-center group-header-base">Bilancio Totale</th>` : ''}
            ${cntCasa > 0 ? `<th colspan="${cntCasa}" class="text-center group-header-casa">Casa</th>` : ''}
            ${cntFuori > 0 ? `<th colspan="${cntFuori}" class="text-center group-header-fuori">Trasferta</th>` : ''}
            ${cntRetiCasa > 0 ? `<th colspan="${cntRetiCasa}" class="text-center group-header-casa">Reti Casa</th>` : ''}
            ${cntRetiFuori > 0 ? `<th colspan="${cntRetiFuori}" class="text-center group-header-fuori">Reti Trasferta</th>` : ''}
            ${showTot ? `
              <th rowspan="2" class="sortable text-center col-totali ${this.sortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali" title="Somma Totali Squadra">
                Totali ${this.renderSortIcon('sommaTotali')}
              </th>
            ` : ''}
          </tr>
          <tr>
            <!-- Bilancio Totale -->
            ${showBM ? `<th class="sortable text-center col-stat ${this.sortKey === 'bonusMalus' ? 'is-sorted' : ''}" data-sort="bonusMalus" title="Bonus/Malus">B/M ${this.renderSortIcon('bonusMalus')}</th>` : ''}
            ${showV ? `<th class="sortable text-center col-stat ${this.sortKey === 'winsTot' ? 'is-sorted' : ''}" data-sort="winsTot" title="Vinte Totali">V ${this.renderSortIcon('winsTot')}</th>` : ''}
            ${showN ? `<th class="sortable text-center col-stat ${this.sortKey === 'drawsTot' ? 'is-sorted' : ''}" data-sort="drawsTot" title="Nulle Totali">N ${this.renderSortIcon('drawsTot')}</th>` : ''}
            ${showP ? `<th class="sortable text-center col-stat ${this.sortKey === 'lossesTot' ? 'is-sorted' : ''}" data-sort="lossesTot" title="Perse Totali">P ${this.renderSortIcon('lossesTot')}</th>` : ''}
            ${showGF ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsFor' ? 'is-sorted' : ''}" data-sort="goalsFor" title="Gol Fatti Totali">GF ${this.renderSortIcon('goalsFor')}</th>` : ''}
            ${showGS ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsAgainst' ? 'is-sorted' : ''}" data-sort="goalsAgainst" title="Gol Subiti Totali">GS ${this.renderSortIcon('goalsAgainst')}</th>` : ''}
            ${showMI ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'mediaInglese' ? 'is-sorted' : ''}" data-sort="mediaInglese" title="Media Inglese">MI ${this.renderSortIcon('mediaInglese')}</th>` : ''}
            
            <!-- Casa -->
            ${showCV ? `<th class="sortable text-center col-stat ${this.sortKey === 'winsHome' ? 'is-sorted' : ''}" data-sort="winsHome" title="Casa Vinte">CV ${this.renderSortIcon('winsHome')}</th>` : ''}
            ${showCN ? `<th class="sortable text-center col-stat ${this.sortKey === 'drawsHome' ? 'is-sorted' : ''}" data-sort="drawsHome" title="Casa Nulle">CN ${this.renderSortIcon('drawsHome')}</th>` : ''}
            ${showCP ? `<th class="sortable text-center col-stat ${this.sortKey === 'lossesHome' ? 'is-sorted' : ''}" data-sort="lossesHome" title="Casa Perse">CP ${this.renderSortIcon('lossesHome')}</th>` : ''}
            
            <!-- Fuori -->
            ${showFV ? `<th class="sortable text-center col-stat ${this.sortKey === 'winsAway' ? 'is-sorted' : ''}" data-sort="winsAway" title="Fuori Vinte">FV ${this.renderSortIcon('winsAway')}</th>` : ''}
            ${showFN ? `<th class="sortable text-center col-stat ${this.sortKey === 'drawsAway' ? 'is-sorted' : ''}" data-sort="drawsAway" title="Fuori Nulle">FN ${this.renderSortIcon('drawsAway')}</th>` : ''}
            ${showFP ? `<th class="sortable text-center col-stat ${this.sortKey === 'lossesAway' ? 'is-sorted' : ''}" data-sort="lossesAway" title="Fuori Perse">FP ${this.renderSortIcon('lossesAway')}</th>` : ''}
            
            <!-- Reti Casa -->
            ${showCF ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsForHome' ? 'is-sorted' : ''}" data-sort="goalsForHome" title="Casa Gol Fatti">CF ${this.renderSortIcon('goalsForHome')}</th>` : ''}
            ${showCS ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsAgainstHome' ? 'is-sorted' : ''}" data-sort="goalsAgainstHome" title="Casa Gol Subiti">CS ${this.renderSortIcon('goalsAgainstHome')}</th>` : ''}
            
            <!-- Reti Fuori -->
            ${showFF ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsForAway' ? 'is-sorted' : ''}" data-sort="goalsForAway" title="Fuori Gol Fatti">FF ${this.renderSortIcon('goalsForAway')}</th>` : ''}
            ${showFS ? `<th class="sortable text-center col-stat ${this.sortKey === 'goalsAgainstAway' ? 'is-sorted' : ''}" data-sort="goalsAgainstAway" title="Fuori Gol Subiti">FS ${this.renderSortIcon('goalsAgainstAway')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${standings.length > 0 ? standings.map(s => `
            <tr>
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${s.name} ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
                    ${showCoach && s.coach ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.coach}</div>` : ''}
                  </div>
                </div>
              </td>
              <td class="text-center table-pts font-bold col-pts" style="${this.sortKey === 'points' ? 'background:rgba(59,130,246,0.08);' : ''}">${s.points}</td>
              <td class="text-center font-bold col-stat">${s.played}</td>
              
              <!-- Bilancio Totale -->
              ${showBM ? `<td class="text-center col-stat">${s.bonusMalus || 0}</td>` : ''}
              ${showV ? `<td class="text-center col-stat" style="color:var(--accent-emerald);font-weight:700;">${s.winsTot}</td>` : ''}
              ${showN ? `<td class="text-center col-stat" style="color:var(--text-muted);">${s.drawsTot}</td>` : ''}
              ${showP ? `<td class="text-center col-stat" style="color:var(--accent-rose);">${s.lossesTot}</td>` : ''}
              ${showGF ? `<td class="text-center col-stat">${s.goalsFor}</td>` : ''}
              ${showGS ? `<td class="text-center col-stat">${s.goalsAgainst}</td>` : ''}
              ${showMI ? `
                <td class="text-center col-stat-wide font-bold" style="color:${s.mediaInglese > 0 ? 'var(--accent-emerald)' : s.mediaInglese < 0 ? 'var(--accent-rose)' : 'inherit'};">
                  ${s.mediaInglese > 0 ? '+' + s.mediaInglese : s.mediaInglese}
                </td>
              ` : ''}
              
              <!-- Casa -->
              ${showCV ? `<td class="text-center col-stat" style="color:var(--accent-emerald);">${s.winsHome}</td>` : ''}
              ${showCN ? `<td class="text-center col-stat" style="color:var(--text-muted);">${s.drawsHome}</td>` : ''}
              ${showCP ? `<td class="text-center col-stat" style="color:var(--accent-rose);">${s.lossesHome}</td>` : ''}
              
              <!-- Fuori -->
              ${showFV ? `<td class="text-center col-stat" style="color:var(--accent-emerald);">${s.winsAway}</td>` : ''}
              ${showFN ? `<td class="text-center col-stat" style="color:var(--text-muted);">${s.drawsAway}</td>` : ''}
              ${showFP ? `<td class="text-center col-stat" style="color:var(--accent-rose);">${s.lossesAway}</td>` : ''}
              
              <!-- Reti Casa -->
              ${showCF ? `<td class="text-center col-stat">${s.goalsForHome}</td>` : ''}
              ${showCS ? `<td class="text-center col-stat">${s.goalsAgainstHome}</td>` : ''}
              
              <!-- Reti Fuori -->
              ${showFF ? `<td class="text-center col-stat">${s.goalsForAway}</td>` : ''}
              ${showFS ? `<td class="text-center col-stat">${s.goalsAgainstAway}</td>` : ''}
              
              <!-- Totali -->
              ${showTot ? `
                <td class="text-center font-bold col-totali" style="color:var(--accent-cyan); ${this.sortKey === 'sommaTotali' ? 'background:rgba(59,130,246,0.08);' : ''}">
                  ${Number(s.sommaTotali || 0).toFixed(2)}
                </td>
              ` : ''}
            </tr>
          `).join('') : `
            <tr>
              <td colspan="${totalCols}" class="text-center" style="padding: 24px;">
                Nessuna squadra o incontro disputato per questo girone.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  },

  /**
   * Vista Stats Avanzate (Totali con modificatori / Parziali senza modificatori)
   */
  getAdvancedTableHtml(standings) {
    const bitmask = this.getGironeBitmask(this.currentGroupId);
    const showCoach = bitmask.charAt(1) === '1';

    // Totali: bit da 26 a 31
    const showTMed = bitmask.charAt(26) === '1';
    const showTMin = bitmask.charAt(27) === '1';
    const showTMax = bitmask.charAt(28) === '1';
    const showTDSt = bitmask.charAt(29) === '1';
    const showTAvv = bitmask.charAt(30) === '1';
    const showTTot = bitmask.charAt(31) === '1';
    const cntTotali = (showTMed ? 1 : 0) + (showTMin ? 1 : 0) + (showTMax ? 1 : 0) + (showTDSt ? 1 : 0) + (showTAvv ? 1 : 0) + (showTTot ? 1 : 0);

    // Parziali: bit da 20 a 25
    const showPMed = bitmask.charAt(20) === '1';
    const showPMin = bitmask.charAt(21) === '1';
    const showPMax = bitmask.charAt(22) === '1';
    const showPDSt = bitmask.charAt(23) === '1';
    const showPAvv = bitmask.charAt(24) === '1';
    const showPTot = bitmask.charAt(25) === '1';
    const cntParziali = (showPMed ? 1 : 0) + (showPMin ? 1 : 0) + (showPMax ? 1 : 0) + (showPDSt ? 1 : 0) + (showPAvv ? 1 : 0) + (showPTot ? 1 : 0);

    const totalCols = 4 + cntTotali + cntParziali;

    return `
      <table class="modern-table standings-table">
        <thead>
          <tr>
            <th rowspan="2" class="sortable text-center col-pos ${this.sortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" title="Posizione Ufficiale">
              # ${this.renderSortIcon('pos')}
            </th>
            <th rowspan="2" class="sortable col-team ${this.sortKey === 'name' ? 'is-sorted' : ''}" data-sort="name" title="Nome Squadra">
              Squadra ${this.renderSortIcon('name')}
            </th>
            <th rowspan="2" class="sortable text-center col-pts ${this.sortKey === 'points' ? 'is-sorted' : ''}" data-sort="points" title="Punti in Classifica">
              PT ${this.renderSortIcon('points')}
            </th>
            <th rowspan="2" class="sortable text-center col-stat ${this.sortKey === 'played' ? 'is-sorted' : ''}" data-sort="played" title="Partite Giocate">
              G ${this.renderSortIcon('played')}
            </th>
            ${cntTotali > 0 ? `<th colspan="${cntTotali}" class="text-center group-header-totali">Totali (con modificatori)</th>` : ''}
            ${cntParziali > 0 ? `<th colspan="${cntParziali}" class="text-center group-header-parziali">Parziali (senza modificatori)</th>` : ''}
          </tr>
          <tr>
            <!-- Totali -->
            ${showTMed ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'mediaTotali' ? 'is-sorted' : ''}" data-sort="mediaTotali" title="Media Punteggi Totali">Med ${this.renderSortIcon('mediaTotali')}</th>` : ''}
            ${showTMin ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'minTotali' ? 'is-sorted' : ''}" data-sort="minTotali" title="Punteggio Minimo Totale">Min ${this.renderSortIcon('minTotali')}</th>` : ''}
            ${showTMax ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'maxTotali' ? 'is-sorted' : ''}" data-sort="maxTotali" title="Punteggio Massimo Totale">Max ${this.renderSortIcon('maxTotali')}</th>` : ''}
            ${showTDSt ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'devStdTotali' ? 'is-sorted' : ''}" data-sort="devStdTotali" title="Deviazione Standard Totale">DSt ${this.renderSortIcon('devStdTotali')}</th>` : ''}
            ${showTAvv ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'mediaAvversariTotali' ? 'is-sorted' : ''}" data-sort="mediaAvversariTotali" title="Media Punteggi Avversari">Avv ${this.renderSortIcon('mediaAvversariTotali')}</th>` : ''}
            ${showTTot ? `<th class="sortable text-center col-totali font-bold ${this.sortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali" title="Somma Totali">Somma ${this.renderSortIcon('sommaTotali')}</th>` : ''}
            
            <!-- Parziali -->
            ${showPMed ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'mediaParziali' ? 'is-sorted' : ''}" data-sort="mediaParziali" title="Media Voti Puri Parziali">Med ${this.renderSortIcon('mediaParziali')}</th>` : ''}
            ${showPMin ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'minParziali' ? 'is-sorted' : ''}" data-sort="minParziali" title="Punteggio Minimo Parziale">Min ${this.renderSortIcon('minParziali')}</th>` : ''}
            ${showPMax ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'maxParziali' ? 'is-sorted' : ''}" data-sort="maxParziali" title="Punteggio Massimo Parziale">Max ${this.renderSortIcon('maxParziali')}</th>` : ''}
            ${showPDSt ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'devStdParziali' ? 'is-sorted' : ''}" data-sort="devStdParziali" title="Deviazione Standard Parziale">DSt ${this.renderSortIcon('devStdParziali')}</th>` : ''}
            ${showPAvv ? `<th class="sortable text-center col-stat-wide ${this.sortKey === 'mediaAvversariParziali' ? 'is-sorted' : ''}" data-sort="mediaAvversariParziali" title="Media Avversari Parziale">Avv ${this.renderSortIcon('mediaAvversariParziali')}</th>` : ''}
            ${showPTot ? `<th class="sortable text-center col-totali font-bold ${this.sortKey === 'sommaParziali' ? 'is-sorted' : ''}" data-sort="sommaParziali" title="Somma Parziali">Somma ${this.renderSortIcon('sommaParziali')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${standings.length > 0 ? standings.map(s => `
            <tr>
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${s.name} ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
                    ${showCoach && s.coach ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.coach}</div>` : ''}
                  </div>
                </div>
              </td>
              <td class="text-center table-pts font-bold col-pts" style="${this.sortKey === 'points' ? 'background:rgba(59,130,246,0.08);' : ''}">${s.points}</td>
              <td class="text-center font-bold col-stat">${s.played}</td>
              
              <!-- Totali -->
              ${showTMed ? `<td class="text-center col-stat-wide font-bold">${Number(s.mediaTotali || 0).toFixed(3)}</td>` : ''}
              ${showTMin ? `<td class="text-center col-stat-wide">${Number(s.minTotali || 0).toFixed(3)}</td>` : ''}
              ${showTMax ? `<td class="text-center col-stat-wide">${Number(s.maxTotali || 0).toFixed(3)}</td>` : ''}
              ${showTDSt ? `<td class="text-center col-stat-wide">${Number(s.devStdTotali || 0).toFixed(3)}</td>` : ''}
              ${showTAvv ? `<td class="text-center col-stat-wide">${Number(s.mediaAvversariTotali || 0).toFixed(3)}</td>` : ''}
              ${showTTot ? `<td class="text-center font-bold col-totali" style="color:var(--accent-cyan); ${this.sortKey === 'sommaTotali' ? 'background:rgba(59,130,246,0.08);' : ''}">${Number(s.sommaTotali || 0).toFixed(3)}</td>` : ''}
              
              <!-- Parziali -->
              ${showPMed ? `<td class="text-center col-stat-wide font-bold">${Number(s.mediaParziali || 0).toFixed(3)}</td>` : ''}
              ${showPMin ? `<td class="text-center col-stat-wide">${Number(s.minParziali || 0).toFixed(3)}</td>` : ''}
              ${showPMax ? `<td class="text-center col-stat-wide">${Number(s.maxParziali || 0).toFixed(3)}</td>` : ''}
              ${showPDSt ? `<td class="text-center col-stat-wide">${Number(s.devStdParziali || 0).toFixed(3)}</td>` : ''}
              ${showPAvv ? `<td class="text-center col-stat-wide">${Number(s.mediaAvversariParziali || 0).toFixed(3)}</td>` : ''}
              ${showPTot ? `<td class="text-center font-bold col-totali" style="color:var(--accent-purple, #a855f7); ${this.sortKey === 'sommaParziali' ? 'background:rgba(168,85,247,0.08);' : ''}">${Number(s.sommaParziali || 0).toFixed(3)}</td>` : ''}
            </tr>
          `).join('') : `
            <tr>
              <td colspan="${totalCols}" class="text-center" style="padding: 24px;">
                Nessuna squadra o incontro disputato per questo girone.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  },

  render(container) {
    this.initExpandState();
    this.bindResizeHandler(container);
    const comps = fcmDataLoader.getCompetitions();

    // Parse URL hash parameters (e.g. #classifica?comp=2)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('comp')) {
        const cId = parseInt(params.get('comp'), 10);
        if (!isNaN(cId) && comps.some(c => c.id === cId)) {
          this.currentCompId = cId;
        }
      }
      if (params.has('girone')) {
        const gId = parseInt(params.get('girone'), 10);
        if (!isNaN(gId)) {
          this.currentGroupId = gId;
        }
      }
    }

    // Determine active competition
    let selectedComp = comps.find(c => c.id === this.currentCompId);
    if (!selectedComp) {
      // Find comp that contains currentGroupId
      selectedComp = comps.find(c => c.groups && c.groups.some(g => g.ID === this.currentGroupId)) || comps[0];
      if (selectedComp) {
        this.currentCompId = selectedComp.id;
      }
    }

    // Available groups for selected competition
    let availableGroups = [];
    if (selectedComp && selectedComp.groups && selectedComp.groups.length > 0) {
      availableGroups = selectedComp.groups.map(g => ({
        id: g.ID,
        compId: selectedComp.id,
        name: g.Nome,
        label: `${selectedComp.name} - ${g.Nome}`
      }));
    } else if (selectedComp) {
      availableGroups = [{
        id: selectedComp.defaultGroupId || selectedComp.id,
        compId: selectedComp.id,
        name: selectedComp.name,
        label: selectedComp.name
      }];
    }

    // Ensure valid currentGroupId for this competition
    if (!availableGroups.some(g => g.id === this.currentGroupId)) {
      this.currentGroupId = availableGroups[0] ? availableGroups[0].id : 1;
    }

    const currentGroup = availableGroups.find(g => g.id === this.currentGroupId) || availableGroups[0];
    const rawStandings = fcmDataLoader.getStandings(this.currentGroupId);
    const standings = this.getSortedStandings(rawStandings);

    let html = `
      <div class="card">
        <div class="card-header" style="flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
              </svg>
              Classifica
            </div>
            <div class="card-subtitle">${currentGroup ? currentGroup.label : 'ModernFCM'}</div>
          </div>
          
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <!-- Switcher Base / Avanzate -->
            <div class="pill-tabs" style="margin-bottom:0;">
              <button class="pill-btn ${!this.showAdvanced ? 'active' : ''}" id="btnViewBase">
                Stats Base
              </button>
              <button class="pill-btn ${this.showAdvanced ? 'active' : ''}" id="btnViewAdvanced">
                Stats Avanzate
              </button>
            </div>

            <!-- Pulsante Espandi / Compatta per Stats Base (Stile Fantamister) -->
            ${!this.showAdvanced ? `
              <button type="button" class="classifica-toggle-btn ${this.isExpandedBase ? 'is-expanded' : ''}" id="btnToggleExpandBase" title="${this.isExpandedBase ? 'Mostra solo le colonne principali' : 'Espandi tutte le colonne (Casa, Fuori, Reti, MI)'}">
                <span class="classifica-toggle-text">${this.isExpandedBase ? 'Vista compatta' : 'Espandi colonne'}</span>
                <svg class="classifica-toggle-chevron ${this.isExpandedBase ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Controls: Dropdowns for Competizione and Girone -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;">
            <label for="selClassificaComp" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Competizione:
            </label>
            <select id="selClassificaComp" class="form-select" style="font-weight:700;">
              ${comps.map(c => `
                <option value="${c.id}" ${c.id === this.currentCompId ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;">
            <label for="selClassificaGroup" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Girone / Classifica:
            </label>
            <select id="selClassificaGroup" class="form-select" style="font-weight:700;">
              ${availableGroups.map(g => `
                <option value="${g.id}" ${g.id === this.currentGroupId ? 'selected' : ''}>${g.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Micro-hint per lo scorrimento orizzontale su mobile quando la tabella è estesa -->
        <div class="classifica-scroll-hint ${this.showAdvanced || this.isExpandedBase ? 'is-visible' : ''}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Scorri orizzontalmente per visualizzare tutte le statistiche</span>
        </div>

        <!-- Standings Table Container -->
        <div class="table-responsive" id="classificaTableWrapper">
          ${this.getTableHtml(standings)}
        </div>
      </div>

      <!-- Legenda Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Guida e Legenda Colonne
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;font-size:0.8rem;color:var(--text-secondary);">
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-gold);">
            <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Criteri Classifica & Ordinamento</b>
            In caso di parità di punti in classifica (<b>PT</b>), il criterio ufficiale FCM posiziona davanti la squadra con la <b>Somma Totali</b> maggiore.<br>
            <span style="color:var(--accent-cyan);margin-top:4px;display:inline-block;">💡 Clicca sull'intestazione di qualsiasi colonna per ordinarla (crescente/decrescente).</span>
          </div>
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-primary);">
            <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Stats Base: Rendimento Squadra</b>
            <b>G</b>: Partite Giocate.<br>
            <b>V / N / P</b>: Vinte, Nulle, Perse totali.<br>
            <b>GF / GS</b>: Gol Fatti e Gol Subiti totali.<br>
            <b>CV / CN / CP</b>: Casa Vinte, Nulle, Perse.<br>
            <b>FV / FN / FP</b>: Fuori Vinte, Nulle, Perse.<br>
            <b>CF / CS</b>: Casa Gol Fatti e Gol Subiti.<br>
            <b>FF / FS</b>: Fuori Gol Fatti e Gol Subiti.<br>
            <b>Totali</b>: Somma dei punteggi complessivi realizzati.
          </div>
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-cyan);">
            <b style="color:var(--text-primary);display:block;margin-bottom:4px;">MI (Media Inglese)</b>
            Indice di rendimento ponderato rispetto alla media inglese:<br>
            • In casa: Vittoria 0, Pareggio -2, Sconfitta -3.<br>
            • In trasferta: Vittoria +2, Pareggio 0, Sconfitta -1.
          </div>
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-purple, #a855f7);">
            <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Stats Avanzate: Totali vs Parziali</b>
            • <b>Totali</b>: Med, Min, Max, DSt, Avv, Somma calcolati sui punteggi complessivi (con modificatori).<br>
            • <b>Parziali</b>: Statistiche calcolate sui soli voti puri dei calciatori (senza modificatori).<br>
            • <b>DSt (Deviazione Standard)</b>: Misura la regolarità (più è bassa, più il rendimento è costante).
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach table sorting listeners
    this.bindTableEvents(container);

    // Competition dropdown change
    const selComp = container.querySelector('#selClassificaComp');
    if (selComp) {
      selComp.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value, 10);
        const comp = comps.find(c => c.id === this.currentCompId);
        if (comp && comp.groups && comp.groups.length > 0) {
          this.currentGroupId = comp.groups[0].ID;
        } else if (comp) {
          this.currentGroupId = comp.defaultGroupId || comp.id;
        }
        this.sortKey = 'pos';
        this.sortOrder = 'asc';
        this.render(container);
      });
    }

    // Group dropdown change
    const selGroup = container.querySelector('#selClassificaGroup');
    if (selGroup) {
      selGroup.addEventListener('change', (e) => {
        this.currentGroupId = parseInt(e.target.value, 10);
        this.sortKey = 'pos';
        this.sortOrder = 'asc';
        this.render(container);
      });
    }

    // Switch to Stats Base
    const btnBase = container.querySelector('#btnViewBase');
    if (btnBase) {
      btnBase.addEventListener('click', () => {
        if (this.showAdvanced) {
          this.showAdvanced = false;
          if (!this._userExplicitToggle) {
            this.isExpandedBase = typeof window !== 'undefined' && window.innerWidth > 768;
          }
          const validKeys = this.isExpandedBase ? this.baseKeys : this.compactBaseKeys;
          if (!validKeys.includes(this.sortKey)) {
            this.sortKey = 'pos';
            this.sortOrder = 'asc';
          }
          this.render(container);
        }
      });
    }

    // Switch to Stats Avanzate
    const btnAdv = container.querySelector('#btnViewAdvanced');
    if (btnAdv) {
      btnAdv.addEventListener('click', () => {
        if (!this.showAdvanced) {
          this.showAdvanced = true;
          if (!this.advancedKeys.includes(this.sortKey)) {
            this.sortKey = 'pos';
            this.sortOrder = 'asc';
          }
          this.render(container);
        }
      });
    }

    // Toggle expand/compact for Stats Base
    const btnExpand = container.querySelector('#btnToggleExpandBase');
    if (btnExpand) {
      btnExpand.addEventListener('click', () => {
        this._userExplicitToggle = true;
        this.isExpandedBase = !this.isExpandedBase;
        const validKeys = this.isExpandedBase ? this.baseKeys : this.compactBaseKeys;
        if (!validKeys.includes(this.sortKey)) {
          this.sortKey = 'pos';
          this.sortOrder = 'asc';
        }
        this.render(container);
      });
    }
  }
};
