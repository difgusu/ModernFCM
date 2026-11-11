/**
 * CLASSIFICA VIEW
 * Full responsive standings for all competitions and groups
 * Supporting official tie-breaking rules, advanced/base stats views, and interactive column sorting
 * ModernFCM
 */

const classificaView = {
  currentCompId: 0,
  currentGroupId: 1, // Default: 1 = ModernFCM
  selectedSeason: null, // null = stagione attuale
  activeTab: 'stagione', // 'stagione' | 'perpetua'
  perpetuaSortKey: 'points',
  perpetuaSortOrder: 'desc',
  perpetuaFilterCurrentOnly: false,
  _historicalCache: {},
  _perpetuaCache: null,
  showAdvanced: false,
  isExpandedBase: null, // null = auto-detect based on screen width
  sortKey: 'pos',
  sortOrder: 'asc',
  _hasResizeHandler: false,
  _resizeHandler: null,
  _resizeTimer: null,
  _container: null,
  _userExplicitToggle: false,

  isHistoricalSeason() {
    const currentSeasonId = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCurrentSeason)
      ? fcmDataLoader.getCurrentSeason()
      : null;
    return Boolean(this.selectedSeason && currentSeasonId && Number(this.selectedSeason) !== Number(currentSeasonId));
  },

  getHistoricalGroupStandings(groupId) {
    if (!this.selectedSeason || !this._historicalCache[this.selectedSeason]) return [];
    const hist = this._historicalCache[this.selectedSeason];
    if (!hist.competitions) return [];
    for (const c of hist.competitions) {
      if (c.groups) {
        const g = c.groups.find(grp => (grp.id === groupId || grp.ID === groupId));
        if (g && g.standings) {
          return g.standings.map(s => {
            const winsAway = Number(s.winsAway) || 0;
            const lossesAway = Number(s.lossesAway) || 0;
            const drawsHome = Number(s.drawsHome) || 0;
            const lossesHome = Number(s.lossesHome) || 0;
            const computedMI = (winsAway * 2) - lossesAway - (drawsHome * 2) - (lossesHome * 3);

            return {
              ...s,
              mediaInglese: (s.winsAway !== undefined && s.winsHome !== undefined) ? computedMI : (s.mediaInglese || 0),
              devStdTotali: (s.devStdTotali !== undefined) ? s.devStdTotali : (s.devStd || 0),
              devStd: (s.devStd !== undefined) ? s.devStd : (s.devStdTotali || 0),
              mediaAvversariTotali: (s.mediaAvversariTotali !== undefined) ? s.mediaAvversariTotali : (s.mediaAvversari || 0),
              mediaAvversari: (s.mediaAvversari !== undefined) ? s.mediaAvversari : (s.mediaAvversariTotali || 0),
              devStdParziali: (s.devStdParziali !== undefined) ? s.devStdParziali : 0,
              mediaAvversariParziali: (s.mediaAvversariParziali !== undefined) ? s.mediaAvversariParziali : 0
            };
          });
        }
      }
    }
    return [];
  },

  renderPerpetuaSortIcon(key) {
    if (this.perpetuaSortKey === key) {
      return `<span class="sort-icon sort-active">${this.perpetuaSortOrder === 'asc' ? '▲' : '▼'}</span>`;
    }
    return `<span class="sort-icon sort-neutral">↕</span>`;
  },

  handlePerpetuaSort(key, container) {
    if (this.perpetuaSortKey === key) {
      this.perpetuaSortOrder = this.perpetuaSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.perpetuaSortKey = key;
      this.perpetuaSortOrder = (key === 'name' || key === 'pos') ? 'asc' : 'desc';
    }
    this.renderTable(container);
  },

  getSortedPerpetua(list) {
    const key = this.perpetuaSortKey;
    const order = this.perpetuaSortOrder;
    return [...list].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, 'it', { sensitivity: 'base' });
        if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
      } else {
        valA = (valA !== undefined && valA !== null && !isNaN(valA)) ? Number(valA) : 0;
        valB = (valB !== undefined && valB !== null && !isNaN(valB)) ? Number(valB) : 0;
        if (valA !== valB) return order === 'asc' ? valA - valB : valB - valA;
      }
      if (key === 'points' && (b.sommaTotali || 0) !== (a.sommaTotali || 0)) {
        return (b.sommaTotali || 0) - (a.sommaTotali || 0);
      }
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      return (a.pos || 0) - (b.pos || 0);
    });
  },

  buildPerpetuaTrophies(trophiesObj, palmaresList) {
    if (!trophiesObj || !palmaresList || typeof trophiesObj !== 'object') return '';
    const badges = [];
    palmaresList.forEach(p => {
      const pId = p.id || p.ID;
      const count = trophiesObj[pId] || trophiesObj[String(pId)];
      if (count && count > 0) {
        const icon = p.Icona || p.icon || 'ico-coppa.gif';
        const name = p.name || p.Nome || p.Label || 'Trofeo';
        badges.push(`<span class="trophy-badge" title="${count}x ${name}"><img src="img/${icon}" onerror="this.onerror=null;this.src='img/small-${icon}';" alt="${name}" /> ${count}</span>`);
      }
    });
    return badges.join(' ');
  },

  // Range / Serie di giornate state
  isRangeActive: false,
  fromRound: 1,
  toRound: null,

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

    if (this.activeTab === 'perpetua') {
      this.renderPerpetuaTable(container);
      return;
    }

    let rawStandings = [];
    if (this.isHistoricalSeason()) {
      rawStandings = this.getHistoricalGroupStandings(this.currentGroupId);
    } else {
      rawStandings = this.isRangeActive
        ? this.getRangeStandings(this.currentGroupId, this.fromRound, this.toRound)
        : fcmDataLoader.getStandings(this.currentGroupId);
    }
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

  renderPerpetuaTable(container) {
    const tableWrapper = container.querySelector('#classificaTableWrapper');
    if (!tableWrapper) return;

    const data = this._perpetuaCache;
    if (!data || !Array.isArray(data.ranking)) {
      tableWrapper.innerHTML = '<div class="text-center" style="padding:30px;color:var(--text-muted);">Nessun dato disponibile per la classifica perpetua.</div>';
      return;
    }

    let list = data.ranking;
    if (this.perpetuaFilterCurrentOnly) {
      list = list.filter(item => item.isCurrent);
    }
    const sorted = this.getSortedPerpetua(list);
    const palmares = data.palmares || [];

    tableWrapper.innerHTML = this.isMobileView()
      ? this.getMobilePerpetuaTableHtml(sorted, palmares)
      : this.getDesktopPerpetuaTableHtml(sorted, palmares);

    this.bindPerpetuaTableEvents(container);

    const scrollHint = container.querySelector('.classifica-scroll-hint');
    if (scrollHint) scrollHint.classList.remove('is-visible');
  },

  getDesktopPerpetuaTableHtml(list, palmares) {
    return `
      <div class="table-responsive">
        <table class="modern-table standings-table-desktop">
          <thead>
            <tr>
              <th class="sortable text-center ${this.perpetuaSortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" style="width:48px;" title="Posizione"># ${this.renderPerpetuaSortIcon('pos')}</th>
              <th class="sortable ${this.perpetuaSortKey === 'name' ? 'is-sorted' : ''}" data-sort="name" style="min-width:190px;" title="Franchigia &amp; Trofei">Franchigia &amp; Trofei ${this.renderPerpetuaSortIcon('name')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'seasons' ? 'is-sorted' : ''}" data-sort="seasons" title="Stagioni disputate">Stag ${this.renderPerpetuaSortIcon('seasons')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'played' ? 'is-sorted' : ''}" data-sort="played" title="Partite giocate">G ${this.renderPerpetuaSortIcon('played')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'winsTot' ? 'is-sorted' : ''}" data-sort="winsTot" title="Vinte totali">V ${this.renderPerpetuaSortIcon('winsTot')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'drawsTot' ? 'is-sorted' : ''}" data-sort="drawsTot" title="Nulle totali">N ${this.renderPerpetuaSortIcon('drawsTot')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'lossesTot' ? 'is-sorted' : ''}" data-sort="lossesTot" title="Perse totali">P ${this.renderPerpetuaSortIcon('lossesTot')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'goalsFor' ? 'is-sorted' : ''}" data-sort="goalsFor" title="Gol fatti">GF ${this.renderPerpetuaSortIcon('goalsFor')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'goalsAgainst' ? 'is-sorted' : ''}" data-sort="goalsAgainst" title="Gol subiti">GS ${this.renderPerpetuaSortIcon('goalsAgainst')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'goalDiff' ? 'is-sorted' : ''}" data-sort="goalDiff" title="Differenza reti">DR ${this.renderPerpetuaSortIcon('goalDiff')}</th>
              <th class="sortable text-center font-bold col-pts ${this.perpetuaSortKey === 'points' ? 'is-sorted' : ''}" data-sort="points" title="Punti totali">PT ${this.renderPerpetuaSortIcon('points')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'mediaPunti' ? 'is-sorted' : ''}" data-sort="mediaPunti" title="Media punti per gara">Med PT ${this.renderPerpetuaSortIcon('mediaPunti')}</th>
              <th class="sortable text-center font-bold col-totali ${this.perpetuaSortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali" title="Somma totali all-time">Totali ${this.renderPerpetuaSortIcon('sommaTotali')}</th>
              <th class="sortable text-center ${this.perpetuaSortKey === 'mediaTotali' ? 'is-sorted' : ''}" data-sort="mediaTotali" title="Fantamedia per gara">FM ${this.renderPerpetuaSortIcon('mediaTotali')}</th>
            </tr>
          </thead>
          <tbody>
            ${list.length > 0 ? list.map((item, idx) => {
      const trophiesHtml = this.buildPerpetuaTrophies(item.trophies, palmares);
      const linkUrl = item.idAttuale ? `#rose?team=${item.idAttuale}` : `#rose?albo=${item.idAlbo}`;
      return `
              <tr class="${item.isCurrent ? '' : 'text-muted'}" style="${!item.isCurrent ? 'opacity:0.85;' : ''}">
                <td class="text-center font-bold table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">${idx + 1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <a href="${linkUrl}" class="team-rose-link" title="Vai alla rosa">
                      <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.name)}" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;" alt="${item.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                    </a>
                    <div style="min-width:0;">
                      <a href="${linkUrl}" class="team-rose-link" style="font-weight:700;font-size:0.92rem;text-decoration:none;color:inherit;">${item.name}</a>
                      ${item.isCurrent ? '<span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.62rem;margin-left:6px;padding:2px 5px;border-radius:4px;font-weight:700;">Attiva</span>' : '<span class="badge" style="background:rgba(148,163,184,0.15);color:var(--text-muted);font-size:0.62rem;margin-left:6px;padding:2px 5px;border-radius:4px;">Storica</span>'}
                      ${trophiesHtml ? `<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;">${trophiesHtml}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td class="text-center font-bold">${item.seasons}</td>
                <td class="text-center font-bold">${item.played}</td>
                <td class="text-center" style="color:var(--accent-emerald);font-weight:700;">${item.winsTot}</td>
                <td class="text-center" style="color:var(--text-muted);">${item.drawsTot}</td>
                <td class="text-center" style="color:var(--accent-rose);">${item.lossesTot}</td>
                <td class="text-center">${item.goalsFor}</td>
                <td class="text-center">${item.goalsAgainst}</td>
                <td class="text-center font-bold" style="color:${item.goalDiff > 0 ? 'var(--accent-emerald)' : item.goalDiff < 0 ? 'var(--accent-rose)' : 'inherit'};">${item.goalDiff > 0 ? '+' + item.goalDiff : item.goalDiff}</td>
                <td class="text-center font-bold col-pts" style="font-size:1.05rem;color:var(--accent-cyan);">${item.points}</td>
                <td class="text-center font-bold">${Number(item.mediaPunti || 0).toFixed(2)}</td>
                <td class="text-center font-bold col-totali">${Number(item.sommaTotali || 0).toFixed(1)}</td>
                <td class="text-center">${Number(item.mediaTotali || 0).toFixed(2)}</td>
              </tr>
            `;
    }).join('') : `<tr><td colspan="14" class="text-center" style="padding:30px;color:var(--text-muted);">Nessuna franchigia trovata.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  },

  getMobilePerpetuaTableHtml(list, palmares) {
    return `
      <table class="modern-table standings-table-mobile-compact">
        <thead>
          <tr class="row-team-header">
            <th rowspan="2" class="sortable text-center col-pos ${this.perpetuaSortKey === 'pos' ? 'is-sorted' : ''}" data-sort="pos" style="vertical-align:middle;"># ${this.renderPerpetuaSortIcon('pos')}</th>
            <th colspan="7" class="sortable col-team ${this.perpetuaSortKey === 'name' ? 'is-sorted' : ''}" data-sort="name">Franchigia &amp; Trofei ${this.renderPerpetuaSortIcon('name')}</th>
          </tr>
          <tr class="row-stats-header">
            <th class="sortable text-center col-pts ${this.perpetuaSortKey === 'points' ? 'is-sorted' : ''}" data-sort="points">PT ${this.renderPerpetuaSortIcon('points')}</th>
            <th class="sortable text-center col-stat ${this.perpetuaSortKey === 'played' ? 'is-sorted' : ''}" data-sort="played">G ${this.renderPerpetuaSortIcon('played')}</th>
            <th class="sortable text-center col-stat ${this.perpetuaSortKey === 'winsTot' ? 'is-sorted' : ''}" data-sort="winsTot">V ${this.renderPerpetuaSortIcon('winsTot')}</th>
            <th class="sortable text-center col-stat ${this.perpetuaSortKey === 'drawsTot' ? 'is-sorted' : ''}" data-sort="drawsTot">N ${this.renderPerpetuaSortIcon('drawsTot')}</th>
            <th class="sortable text-center col-stat ${this.perpetuaSortKey === 'lossesTot' ? 'is-sorted' : ''}" data-sort="lossesTot">P ${this.renderPerpetuaSortIcon('lossesTot')}</th>
            <th class="sortable text-center col-stat ${this.perpetuaSortKey === 'goalDiff' ? 'is-sorted' : ''}" data-sort="goalDiff">DR ${this.renderPerpetuaSortIcon('goalDiff')}</th>
            <th class="sortable text-center col-totali ${this.perpetuaSortKey === 'sommaTotali' ? 'is-sorted' : ''}" data-sort="sommaTotali">FP ${this.renderPerpetuaSortIcon('sommaTotali')}</th>
          </tr>
        </thead>
        <tbody>
          ${list.length > 0 ? list.map((item, idx) => {
      const trophiesHtml = this.buildPerpetuaTrophies(item.trophies, palmares);
      const linkUrl = item.idAttuale ? `#rose?team=${item.idAttuale}` : `#rose?albo=${item.idAlbo}`;
      return `
            <tr class="team-row-top ${item.isCurrent ? '' : 'text-muted'}">
              <td rowspan="2" class="table-pos col-pos text-center ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}" style="vertical-align:middle;font-weight:800;">${idx + 1}</td>
              <td colspan="7" class="col-team">
                <div class="table-col-team">
                  <a href="${linkUrl}" class="team-rose-link" title="Vai alla rosa">
                    <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.name)}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" alt="${item.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  </a>
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <a href="${linkUrl}" class="team-rose-link" style="font-weight:700;font-size:0.88rem;color:inherit;text-decoration:none;">${item.name}</a>
                    ${item.isCurrent ? '<span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.62rem;margin-left:4px;padding:1px 4px;border-radius:4px;">Attiva</span>' : ''}
                    ${trophiesHtml ? `<div style="font-size:0.75rem;margin-top:2px;">${trophiesHtml}</div>` : ''}
                  </div>
                </div>
              </td>
            </tr>
            <tr class="team-row-bottom">
              <td class="text-center table-pts font-bold col-pts" style="color:var(--accent-cyan);">${item.points}</td>
              <td class="text-center font-bold col-stat">${item.played}</td>
              <td class="text-center col-stat" style="color:var(--accent-emerald);font-weight:700;">${item.winsTot}</td>
              <td class="text-center col-stat" style="color:var(--text-muted);">${item.drawsTot}</td>
              <td class="text-center col-stat" style="color:var(--accent-rose);">${item.lossesTot}</td>
              <td class="text-center font-bold col-stat" style="color:${item.goalDiff > 0 ? 'var(--accent-emerald)' : item.goalDiff < 0 ? 'var(--accent-rose)' : 'inherit'};">${item.goalDiff > 0 ? '+' + item.goalDiff : item.goalDiff}</td>
              <td class="text-center font-bold col-totali">${Number(item.sommaTotali || 0).toFixed(1)}</td>
            </tr>
          `;
    }).join('') : `<tr><td colspan="8" class="text-center" style="padding:20px;color:var(--text-muted);">Nessuna franchigia.</td></tr>`}
        </tbody>
      </table>
    `;
  },

  bindPerpetuaTableEvents(container) {
    const sortHeaders = container.querySelectorAll('#classificaTableWrapper th.sortable');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (key) {
          this.handlePerpetuaSort(key, container);
        }
      });
    });
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
    this._container = container;
    if (this._resizeHandler) return;
    this._hasResizeHandler = true;
    let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    this._resizeHandler = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        const hash = (typeof window !== 'undefined' && window.location.hash) || '';
        const baseHash = hash.split('?')[0];
        const targetContainer = this._container;

        // Se non siamo più sulla rotta classifica o il container non è valido/connesso al DOM, non fare nulla
        if (baseHash !== '#classifica' || !targetContainer || (targetContainer.isConnected !== undefined && !targetContainer.isConnected) || !targetContainer.querySelector('#classificaTableWrapper')) {
          return;
        }

        const currentWidth = window.innerWidth;
        const crossedBreakpoint = (lastWidth > 768 && currentWidth <= 768) || (lastWidth <= 768 && currentWidth > 768);
        lastWidth = currentWidth;
        if (crossedBreakpoint && !this._userExplicitToggle) {
          this.isExpandedBase = currentWidth > 768;
          this.render(targetContainer);
          return;
        }
        const tableWrapper = targetContainer.querySelector('#classificaTableWrapper');
        if (tableWrapper) {
          this.renderTable(targetContainer);
        }
      }, 150);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resizeHandler);
    }
  },

  destroy() {
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }
    if (this._resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    this._hasResizeHandler = false;
    this._container = null;
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
          ${standings.length > 0 ? standings.map(s => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(s.teamId) || fcmHomeConfigManager.isFavoriteTeam(s.name));
      const roseLink = this.isHistoricalSeason()
        ? `#rose?season=${this.selectedSeason}&team=${encodeURIComponent(s.teamId || s.name)}`
        : `#rose?team=${encodeURIComponent(s.teamId || s.name)}`;
      return `
            <tr class="team-row-top ${isFav ? 'table-row-favorite' : ''}">
              <td rowspan="2" class="table-pos col-pos text-center ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}" style="vertical-align:middle;border-bottom:1px solid var(--border-subtle);font-size:0.95rem;font-weight:800;">
                ${s.pos}
              </td>
              <td colspan="8" class="col-team">
                <div class="table-col-team">
                  <a href="${roseLink}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;font-size:0.88rem;">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<a href="${roseLink}" class="team-rose-link" title="Vai alla rosa">${s.name}</a> ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
                    ${showCoach && s.coach ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.coach}</div>` : ''}
                  </div>
                </div>
              </td>
            </tr>
            <tr class="team-row-bottom ${isFav ? 'table-row-favorite' : ''}">
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
          `;
    }).join('') : `
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
          ${standings.length > 0 ? standings.map(s => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(s.teamId) || fcmHomeConfigManager.isFavoriteTeam(s.name));
      const roseLink = this.isHistoricalSeason()
        ? `#rose?season=${this.selectedSeason}&team=${encodeURIComponent(s.teamId || s.name)}`
        : `#rose?team=${encodeURIComponent(s.teamId || s.name)}`;
      return `
            <tr class="${isFav ? 'table-row-favorite' : ''}">
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <a href="${roseLink}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<a href="${roseLink}" class="team-rose-link" title="Vai alla rosa">${s.name}</a> ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
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
          `;
    }).join('') : `
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
          ${standings.length > 0 ? standings.map(s => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(s.teamId) || fcmHomeConfigManager.isFavoriteTeam(s.name));
      const roseLink = this.isHistoricalSeason()
        ? `#rose?season=${this.selectedSeason}&team=${encodeURIComponent(s.teamId || s.name)}`
        : `#rose?team=${encodeURIComponent(s.teamId || s.name)}`;
      return `
            <tr class="${isFav ? 'table-row-favorite' : ''}">
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <a href="${roseLink}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<a href="${roseLink}" class="team-rose-link" title="Vai alla rosa">${s.name}</a> ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
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
          `;
    }).join('') : `
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
          ${standings.length > 0 ? standings.map(s => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(s.teamId) || fcmHomeConfigManager.isFavoriteTeam(s.name));
      const roseLink = this.isHistoricalSeason()
        ? `#rose?season=${this.selectedSeason}&team=${encodeURIComponent(s.teamId || s.name)}`
        : `#rose?team=${encodeURIComponent(s.teamId || s.name)}`;
      return `
            <tr class="${isFav ? 'table-row-favorite' : ''}">
              <td class="table-pos col-pos ${s.pos === 1 ? 'table-pos-1' : s.pos === 2 ? 'table-pos-2' : s.pos === 3 ? 'table-pos-3' : ''}">${s.pos}</td>
              <td class="col-team">
                <div class="table-col-team">
                  <a href="${roseLink}" class="team-rose-link" title="Vai alla rosa"><img src="${fcmDataLoader.getTeamLogo(s.name || s.teamId)}" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;flex-shrink:0;" alt="${s.name}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" /></a>
                  <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<a href="${roseLink}" class="team-rose-link" title="Vai alla rosa">${s.name}</a> ${fcmDataLoader.getTeamTrophiesHtml(s.name)}</div>
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
          `;
    }).join('') : `
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
   * Restituisce tutti i turni (giornate) cronologici per il girone specificato da arrIncontri
   */
  getGroupRounds(groupId) {
    if (typeof arrIncontri === 'undefined' || !Array.isArray(arrIncontri)) return [];
    const gId = parseInt(groupId, 10);
    const roundMap = new Map();

    for (let i = 1; i < arrIncontri.length; i++) {
      const inc = arrIncontri[i];
      if (!inc || inc.IDGirone !== gId || inc.IDTipo === INC_RIPOSO) continue;

      const fId = inc.IDFantagiornata;
      if (!roundMap.has(fId)) {
        roundMap.set(fId, {
          roundId: fId,
          fantaNome: inc.Fantagiornata || '',
          serieADay: parseInt(inc.GiornataDiA, 10) || 0,
          played: false,
          matchesCount: 0,
          playedCount: 0
        });
      }
      const r = roundMap.get(fId);
      r.matchesCount++;
      if (inc.Giocato === 1) {
        r.playedCount++;
        r.played = true;
      }
    }

    const rounds = Array.from(roundMap.values());
    rounds.sort((a, b) => (a.serieADay - b.serieADay) || (a.roundId - b.roundId));
    rounds.forEach((r, idx) => {
      r.roundNumber = idx + 1;
    });

    return rounds;
  },

  /**
   * Restituisce il numero dell'ultimo turno disputato in questo girone
   */
  getLastPlayedRoundNumber(groupRounds) {
    if (!groupRounds || groupRounds.length === 0) return 1;
    const played = groupRounds.filter(r => r.played);
    if (played.length > 0) {
      return played[played.length - 1].roundNumber;
    }
    return groupRounds.length;
  },

  /**
   * Verifica se un preset di giornate è correntemente attivo
   */
  isPresetActive(type, groupRounds) {
    if (!this.isRangeActive || !groupRounds || groupRounds.length === 0) return false;
    const lastP = this.getLastPlayedRoundNumber(groupRounds);
    if (type === 'last5') {
      return this.toRound === lastP && this.fromRound === Math.max(1, lastP - 4);
    }
    if (type === 'andata' && groupRounds.length >= 4) {
      return this.fromRound === 1 && this.toRound === Math.floor(groupRounds.length / 2);
    }
    if (type === 'ritorno' && groupRounds.length >= 4) {
      return this.fromRound === (Math.floor(groupRounds.length / 2) + 1) && this.toRound === groupRounds.length;
    }
    if (type === 'all') {
      return this.fromRound === 1 && this.toRound === groupRounds.length;
    }
    return false;
  },

  /**
   * Calcola la classifica completa per una serie di giornate (da fromRound a toRound)
   */
  getRangeStandings(groupId, fromRound, toRound) {
    const rounds = this.getGroupRounds(groupId);
    if (rounds.length === 0) return [];

    const fRound = Math.max(1, Math.min(parseInt(fromRound, 10) || 1, rounds.length));
    const tRound = Math.max(fRound, Math.min(parseInt(toRound, 10) || rounds.length, rounds.length));

    const selectedRounds = rounds.filter(r => r.roundNumber >= fRound && r.roundNumber <= tRound);
    const selectedRoundIds = new Set(selectedRounds.map(r => r.roundId));

    const teamsMap = {};
    const baseStandings = fcmDataLoader.getStandings(groupId);

    if (baseStandings && baseStandings.length > 0) {
      baseStandings.forEach(t => {
        teamsMap[t.teamId] = {
          teamId: t.teamId,
          groupId: groupId,
          compId: t.compId || this.currentCompId,
          name: t.name,
          coach: t.coach,
          points: 0,
          played: 0,
          winsHome: 0, winsAway: 0, winsTot: 0,
          drawsHome: 0, drawsAway: 0, drawsTot: 0,
          lossesHome: 0, lossesAway: 0, lossesTot: 0,
          goalsForHome: 0, goalsForAway: 0, goalsFor: 0,
          goalsAgainstHome: 0, goalsAgainstAway: 0, goalsAgainst: 0,
          goalDiff: 0,
          mediaInglese: 0,
          sommaTotali: 0,
          sommaParziali: 0,
          totaliList: [],
          parzialiList: [],
          avvTotaliList: [],
          avvParzialiList: [],
          bonusMalus: 0
        };
      });
    }

    if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
      for (let i = 1; i < arrIncontri.length; i++) {
        const inc = arrIncontri[i];
        if (!inc || inc.IDGirone !== groupId || inc.IDTipo === INC_RIPOSO) continue;
        if (!selectedRoundIds.has(inc.IDFantagiornata)) continue;

        const homeId = inc.IDSquadre ? inc.IDSquadre.Casa : 0;
        const awayId = inc.IDSquadre ? inc.IDSquadre.Fuori : 0;
        if (!homeId || !awayId) continue;

        if (!teamsMap[homeId]) {
          teamsMap[homeId] = {
            teamId: homeId,
            groupId: groupId,
            compId: inc.IDCompetizione || this.currentCompId,
            name: (inc.Nomi && inc.Nomi.Casa) ? inc.Nomi.Casa : `Squadra ${homeId}`,
            coach: '',
            points: 0, played: 0,
            winsHome: 0, winsAway: 0, winsTot: 0,
            drawsHome: 0, drawsAway: 0, drawsTot: 0,
            lossesHome: 0, lossesAway: 0, lossesTot: 0,
            goalsForHome: 0, goalsForAway: 0, goalsFor: 0,
            goalsAgainstHome: 0, goalsAgainstAway: 0, goalsAgainst: 0,
            goalDiff: 0, mediaInglese: 0, sommaTotali: 0, sommaParziali: 0,
            totaliList: [], parzialiList: [], avvTotaliList: [], avvParzialiList: [],
            bonusMalus: 0
          };
        }
        if (!teamsMap[awayId]) {
          teamsMap[awayId] = {
            teamId: awayId,
            groupId: groupId,
            compId: inc.IDCompetizione || this.currentCompId,
            name: (inc.Nomi && inc.Nomi.Fuori) ? inc.Nomi.Fuori : `Squadra ${awayId}`,
            coach: '',
            points: 0, played: 0,
            winsHome: 0, winsAway: 0, winsTot: 0,
            drawsHome: 0, drawsAway: 0, drawsTot: 0,
            lossesHome: 0, lossesAway: 0, lossesTot: 0,
            goalsForHome: 0, goalsForAway: 0, goalsFor: 0,
            goalsAgainstHome: 0, goalsAgainstAway: 0, goalsAgainst: 0,
            goalDiff: 0, mediaInglese: 0, sommaTotali: 0, sommaParziali: 0,
            totaliList: [], parzialiList: [], avvTotaliList: [], avvParzialiList: [],
            bonusMalus: 0
          };
        }

        if (inc.Giocato !== 1) continue;

        const home = teamsMap[homeId];
        const away = teamsMap[awayId];

        const golCasa = (inc.Gol && typeof inc.Gol.Casa === 'number') ? inc.Gol.Casa : 0;
        const golFuori = (inc.Gol && typeof inc.Gol.Fuori === 'number') ? inc.Gol.Fuori : 0;
        const totCasa = (inc.Totali && typeof inc.Totali.Casa === 'number') ? inc.Totali.Casa : 0;
        const totFuori = (inc.Totali && typeof inc.Totali.Fuori === 'number') ? inc.Totali.Fuori : 0;
        const parzCasa = (inc.Parziali && typeof inc.Parziali.Casa === 'number') ? inc.Parziali.Casa : 0;
        const parzFuori = (inc.Parziali && typeof inc.Parziali.Fuori === 'number') ? inc.Parziali.Fuori : 0;

        home.played++;
        away.played++;

        home.goalsForHome += golCasa;
        home.goalsAgainstHome += golFuori;
        home.goalsFor += golCasa;
        home.goalsAgainst += golFuori;

        away.goalsForAway += golFuori;
        away.goalsAgainstAway += golCasa;
        away.goalsFor += golFuori;
        away.goalsAgainst += golCasa;

        home.sommaTotali += totCasa;
        home.sommaParziali += parzCasa;
        home.totaliList.push(totCasa);
        home.parzialiList.push(parzCasa);
        home.avvTotaliList.push(totFuori);
        home.avvParzialiList.push(parzFuori);

        away.sommaTotali += totFuori;
        away.sommaParziali += parzFuori;
        away.totaliList.push(totFuori);
        away.parzialiList.push(parzFuori);
        away.avvTotaliList.push(totCasa);
        away.avvParzialiList.push(parzCasa);

        if (golCasa > golFuori) {
          home.points += 3;
          home.winsHome++;
          home.winsTot++;
          away.lossesAway++;
          away.lossesTot++;
          away.mediaInglese += -1;
        } else if (golCasa < golFuori) {
          away.points += 3;
          away.winsAway++;
          away.winsTot++;
          home.lossesHome++;
          home.lossesTot++;
          away.mediaInglese += 2;
          home.mediaInglese += -3;
        } else {
          home.points += 1;
          away.points += 1;
          home.drawsHome++;
          home.drawsTot++;
          away.drawsAway++;
          away.drawsTot++;
          home.mediaInglese += -2;
        }
      }
    }

    const list = Object.values(teamsMap).map(t => {
      t.goalDiff = t.goalsFor - t.goalsAgainst;

      t.mediaTotali = t.played > 0 ? (t.sommaTotali / t.played) : 0;
      t.minTotali = t.totaliList.length > 0 ? Math.min(...t.totaliList) : 0;
      t.maxTotali = t.totaliList.length > 0 ? Math.max(...t.totaliList) : 0;
      t.mediaAvversariTotali = t.played > 0 ? (t.avvTotaliList.reduce((acc, v) => acc + v, 0) / t.played) : 0;

      if (t.played > 0) {
        const meanT = t.mediaTotali;
        const varT = t.totaliList.reduce((acc, v) => acc + Math.pow(v - meanT, 2), 0) / t.played;
        t.devStdTotali = Math.sqrt(varT);
      } else {
        t.devStdTotali = 0;
      }
      t.devStd = t.devStdTotali;
      t.mediaAvversari = t.mediaAvversariTotali;

      t.mediaParziali = t.played > 0 ? (t.sommaParziali / t.played) : 0;
      t.minParziali = t.parzialiList.length > 0 ? Math.min(...t.parzialiList) : 0;
      t.maxParziali = t.parzialiList.length > 0 ? Math.max(...t.parzialiList) : 0;
      t.mediaAvversariParziali = t.played > 0 ? (t.avvParzialiList.reduce((acc, v) => acc + v, 0) / t.played) : 0;

      if (t.played > 0) {
        const meanP = t.mediaParziali;
        const varP = t.parzialiList.reduce((acc, v) => acc + Math.pow(v - meanP, 2), 0) / t.played;
        t.devStdParziali = Math.sqrt(varP);
      } else {
        t.devStdParziali = 0;
      }

      return t;
    });

    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if ((b.sommaTotali || 0) !== (a.sommaTotali || 0)) return (b.sommaTotali || 0) - (a.sommaTotali || 0);
      if ((b.goalDiff || 0) !== (a.goalDiff || 0)) return (b.goalDiff || 0) - (a.goalDiff || 0);
      if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
      return (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
    });

    list.forEach((t, idx) => {
      t.pos = idx + 1;
    });

    return list;
  },

  async render(container) {
    if (typeof fcmSkeleton !== 'undefined' && !container.querySelector('#classificaTableWrapper')) {
      container.innerHTML = fcmSkeleton.table({ cols: 7, rows: 10, withToolbar: true, toolbarPills: 3 });
    }
    this.initExpandState();
    this.bindResizeHandler(container);

    const hasStorico = typeof fcmModules === 'undefined' || fcmModules.hasStoricoAvanzato();
    const currentSeasonId = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader.getCurrentSeason)
      ? fcmDataLoader.getCurrentSeason()
      : null;

    let stagioni = [];
    if (hasStorico && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadStagioni) {
      try {
        stagioni = await fcmDataLoader.loadStagioni().catch(() => []);
      } catch (e) {
        stagioni = [];
      }
    }

    // Parse URL hash parameters (e.g. #classifica?comp=2&girone=1&season=13, #classifica?tab=perpetua)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('tab')) {
        const t = params.get('tab');
        if (['stagione', 'perpetua'].includes(t)) {
          this.activeTab = t;
        }
      }
      if (hasStorico && params.has('season')) {
        const s = parseInt(params.get('season'), 10);
        if (!isNaN(s) && s > 0) {
          this.selectedSeason = s;
          this.activeTab = 'stagione';
        }
      } else if (!params.has('season') && !params.has('tab')) {
        this.selectedSeason = currentSeasonId;
      }
      if (params.has('comp')) {
        const cId = parseInt(params.get('comp'), 10);
        if (!isNaN(cId)) {
          this.currentCompId = cId;
        }
      }
      if (params.has('girone')) {
        const gId = parseInt(params.get('girone'), 10);
        if (!isNaN(gId)) {
          this.currentGroupId = gId;
        }
      }
      if (params.has('da') || params.has('from')) {
        const d = parseInt(params.get('da') || params.get('from'), 10);
        if (!isNaN(d) && d >= 1) {
          this.fromRound = d;
          this.isRangeActive = true;
        }
      }
      if (params.has('a') || params.has('to')) {
        const a = parseInt(params.get('a') || params.get('to'), 10);
        if (!isNaN(a) && a >= 1) {
          this.toRound = a;
          this.isRangeActive = true;
        }
      }
    } else {
      if (!this.selectedSeason || !hasStorico) {
        this.selectedSeason = currentSeasonId;
      }
    }

    // Default season resolution
    if (!hasStorico || !this.selectedSeason) {
      this.selectedSeason = currentSeasonId;
    }

    // ============================================================
    // VISTA CLASSIFICA PERPETUA
    // ============================================================
    if (this.activeTab === 'perpetua') {
      if (!this._perpetuaCache && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadClassificaPerpetua) {
        this._perpetuaCache = await fcmDataLoader.loadClassificaPerpetua().catch(() => null);
      }
      const data = this._perpetuaCache;
      let list = (data && data.ranking) ? data.ranking : [];
      if (this.perpetuaFilterCurrentOnly) {
        list = list.filter(item => item.isCurrent);
      }
      const sorted = this.getSortedPerpetua(list);
      const palmares = (data && data.palmares) ? data.palmares : [];

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
                Classifica Perpetua All-Time
              </div>
              <div class="card-subtitle">Classifica maratona complessiva di tutti i campionati disputati (${data ? data.totalSeasons : 0} edizioni)</div>
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <div class="pill-tabs" style="margin-bottom:0;">
                <button type="button" class="pill-btn ${this.activeTab === 'stagione' ? 'active' : ''}" id="btnTabStagione">
                  🏆 Stagione
                </button>
                <button type="button" class="pill-btn ${this.activeTab === 'perpetua' ? 'active' : ''}" id="btnTabPerpetua">
                  ♾️ Perpetua
                </button>
              </div>

              <button type="button" class="pill-btn ${this.perpetuaFilterCurrentOnly ? 'active' : ''}" id="btnTogglePerpetuaFilter">
                ${this.perpetuaFilterCurrentOnly ? '✓ Solo Attive' : 'Tutte le Franchigie'}
              </button>
            </div>
          </div>

          <!-- Standings Table Container -->
          <div id="classificaTableWrapper">
            ${this.isMobileView() ? this.getMobilePerpetuaTableHtml(sorted, palmares) : this.getDesktopPerpetuaTableHtml(sorted, palmares)}
          </div>
        </div>

        <!-- Legenda Card Perpetua -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Guida e Criteri Classifica Perpetua
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;font-size:0.8rem;color:var(--text-secondary);">
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-gold);">
              <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Criteri Classifica Maratona</b>
              Somma complessiva di tutte le partite di campionato disputate nella storia della lega.<br>
              Ordinamento primario: <b>Punti</b> (3 pt vittoria, 1 pareggio), tie-breaker per <b>Somma Totali</b> e <b>Differenza Reti</b>.
            </div>
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-cyan);">
              <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Ordinamento Cliccabile</b>
              Puoi cliccare su qualsiasi colonna (Vinte, Gol Fatti, Fantavoti, Medie) per riordinare la classifica in tempo reale.
            </div>
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-emerald);">
              <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Franchigie Storiche e Palmarès</b>
              Ogni franchigia raggruppa le varie denominazioni storiche della squadra e visualizza i trofei ufficiali conquistati.
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;
      this.bindPerpetuaTableEvents(container);

      const btnTabStagione = container.querySelector('#btnTabStagione');
      if (btnTabStagione) {
        btnTabStagione.addEventListener('click', () => {
          this.activeTab = 'stagione';
          if (this.selectedSeason && this.selectedSeason !== currentSeasonId) {
            window.location.hash = `#classifica?season=${this.selectedSeason}`;
          } else {
            window.location.hash = '#classifica';
          }
        });
      }

      const btnTogglePerpetuaFilter = container.querySelector('#btnTogglePerpetuaFilter');
      if (btnTogglePerpetuaFilter) {
        btnTogglePerpetuaFilter.addEventListener('click', () => {
          this.perpetuaFilterCurrentOnly = !this.perpetuaFilterCurrentOnly;
          btnTogglePerpetuaFilter.classList.toggle('active', this.perpetuaFilterCurrentOnly);
          btnTogglePerpetuaFilter.textContent = this.perpetuaFilterCurrentOnly ? '✓ Solo Attive' : 'Tutte le Franchigie';
          this.renderTable(container);
        });
      }

      return;
    }

    // ============================================================
    // VISTA CLASSIFICA PER STAGIONE (ATTUALE O STORICA)
    // ============================================================
    const isHistorical = this.isHistoricalSeason();
    let comps = [];
    let histData = null;

    if (isHistorical) {
      if (!this._historicalCache[this.selectedSeason] && typeof fcmDataLoader !== 'undefined' && fcmDataLoader.loadHistoricalStandings) {
        histData = await fcmDataLoader.loadHistoricalStandings(this.selectedSeason).catch(() => null);
        this._historicalCache[this.selectedSeason] = histData;
      } else {
        histData = this._historicalCache[this.selectedSeason];
      }
      comps = (histData && histData.competitions) ? histData.competitions : [];
    } else {
      comps = fcmDataLoader.getCompetitions();
    }

    // Determine active competition
    let selectedComp = comps.find(c => c.id === this.currentCompId);
    if (!selectedComp && comps.length > 0) {
      selectedComp = comps.find(c => c.groups && c.groups.some(g => (g.ID === this.currentGroupId || g.id === this.currentGroupId))) || comps[0];
      if (selectedComp) {
        this.currentCompId = selectedComp.id;
      }
    }

    // Available groups for selected competition
    let availableGroups = [];
    if (selectedComp && selectedComp.groups && selectedComp.groups.length > 0) {
      availableGroups = selectedComp.groups.map(g => ({
        id: (g.ID !== undefined) ? g.ID : g.id,
        compId: selectedComp.id,
        name: g.Nome || g.name,
        label: `${selectedComp.name} - ${g.Nome || g.name}`
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

    // Rounds del girone attivo (solo stagione attuale)
    const groupRounds = !isHistorical ? this.getGroupRounds(this.currentGroupId) : [];
    const hasMultipleRounds = !isHistorical && groupRounds.length > 1;

    if (!hasMultipleRounds) {
      this.isRangeActive = false;
      this.fromRound = 1;
      this.toRound = 1;
    } else {
      const lastPlayedRound = this.getLastPlayedRoundNumber(groupRounds);
      if (this.fromRound == null || this.fromRound < 1 || this.fromRound > groupRounds.length) {
        this.fromRound = 1;
      }
      if (this.toRound == null || this.toRound < 1 || this.toRound > groupRounds.length) {
        this.toRound = lastPlayedRound;
      }
      if (this.toRound < this.fromRound) {
        this.toRound = this.fromRound;
      }
    }

    // Conteggio partite giocate nel range selezionato
    let selectedPlayedCount = 0;
    if (this.isRangeActive && hasMultipleRounds) {
      const selectedRounds = groupRounds.filter(r => r.roundNumber >= this.fromRound && r.roundNumber <= this.toRound);
      const selectedRoundIds = new Set(selectedRounds.map(r => r.roundId));
      if (typeof arrIncontri !== 'undefined' && Array.isArray(arrIncontri)) {
        for (let i = 1; i < arrIncontri.length; i++) {
          const inc = arrIncontri[i];
          if (inc && inc.IDGirone === this.currentGroupId && selectedRoundIds.has(inc.IDFantagiornata) && inc.Giocato === 1 && inc.IDTipo !== INC_RIPOSO) {
            selectedPlayedCount++;
          }
        }
      }
    }

    let rawStandings = [];
    if (isHistorical) {
      rawStandings = this.getHistoricalGroupStandings(this.currentGroupId);
    } else {
      rawStandings = this.isRangeActive
        ? this.getRangeStandings(this.currentGroupId, this.fromRound, this.toRound)
        : fcmDataLoader.getStandings(this.currentGroupId);
    }
    const standings = this.getSortedStandings(rawStandings);

    let subtitleText = '';
    if (isHistorical) {
      subtitleText = `${currentGroup ? currentGroup.label : 'ModernFCM'} • Stagione ${this.selectedSeason} (${histData ? histData.anni_stagione : ''})`;
    } else if (this.isRangeActive && hasMultipleRounds) {
      subtitleText = `${currentGroup ? currentGroup.label : 'ModernFCM'} • Dalla ${this.fromRound}ª alla ${this.toRound}ª giornata`;
    } else {
      subtitleText = currentGroup ? currentGroup.label : 'ModernFCM';
    }

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
            <div class="card-subtitle">${subtitleText}</div>
          </div>
          
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <!-- Tabs: Stagione vs Perpetua -->
            ${hasStorico ? `
              <div class="pill-tabs" style="margin-bottom:0;">
                <button type="button" class="pill-btn ${this.activeTab === 'stagione' ? 'active' : ''}" id="btnTabStagione">
                  🏆 Stagione
                </button>
                <button type="button" class="pill-btn ${this.activeTab === 'perpetua' ? 'active' : ''}" id="btnTabPerpetua">
                  ♾️ Perpetua
                </button>
              </div>
            ` : ''}

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

        <!-- Historical Season Notice Banner -->
        ${isHistorical ? `
          <div class="alert alert-info" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.3rem;">🏛️</span>
              <div>
                <strong>Archivio Storico • Stagione ${this.selectedSeason} (${histData ? histData.anni_stagione : ''})</strong>
                <div style="font-size:0.8rem;opacity:0.85;">${histData ? histData.nome_lega : ''}</div>
              </div>
            </div>
            <button type="button" class="pill-btn" id="btnReturnCurrentSeason" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
              <span>↩</span> Torna alla Stagione Attuale
            </button>
          </div>
        ` : ''}

        <!-- Controls: Dropdowns for Stagione, Competizione and Girone -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          ${(hasStorico && stagioni.length > 0) ? `
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;">
              <label for="selClassificaSeason" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                Stagione:
              </label>
              <select id="selClassificaSeason" class="form-select" style="font-weight:700;">
                ${stagioni.map(s => `
                  <option value="${s.id}" ${s.id === this.selectedSeason ? 'selected' : ''}>
                    Stagione ${s.id} (${s.anni_stagione}) ${s.id === currentSeasonId ? '(Attuale)' : ''}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

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

        <!-- Sezione Filtro Serie di Giornate (solo per stagione attuale con almeno 2 turni) -->
        ${hasMultipleRounds ? `
          <div class="classifica-range-card">
            <div class="classifica-range-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">
                  Periodo / Giornate:
                </span>
              </div>

              <!-- Pill-tabs per alternare Classifica Generale e Serie di Giornate -->
              <div class="pill-tabs" style="margin-bottom:0;">
                <button type="button" class="pill-btn ${!this.isRangeActive ? 'active' : ''}" id="btnModeAllRounds">
                  Tutte le Giornate
                </button>
                <button type="button" class="pill-btn ${this.isRangeActive ? 'active' : ''}" id="btnModeCustomRange">
                  Serie di Giornate
                </button>
              </div>
            </div>

            <!-- Controlli Intervallo Giornate (visibili quando isRangeActive è attivo) -->
            ${this.isRangeActive ? `
              <div class="classifica-range-body">
                <div class="classifica-range-row">
                  <!-- Dalla giornata -->
                  <div class="classifica-range-field">
                    <label for="selClassificaFromRound" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                      Dalla Giornata:
                    </label>
                    <select id="selClassificaFromRound" class="form-select" style="font-weight:700;">
                      ${groupRounds.map(r => `
                        <option value="${r.roundNumber}" ${r.roundNumber === this.fromRound ? 'selected' : ''}>
                          ${r.roundNumber}ª (${r.fantaNome ? r.fantaNome.split('(')[0].trim() : `${r.roundNumber}ª`}${r.serieADay ? ` • ${r.serieADay}ª Serie A` : ''}${!r.played ? ' • Da giocare' : ''})
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- Alla giornata -->
                  <div class="classifica-range-field">
                    <label for="selClassificaToRound" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
                      Alla Giornata:
                    </label>
                    <select id="selClassificaToRound" class="form-select" style="font-weight:700;">
                      ${groupRounds.map(r => `
                        <option value="${r.roundNumber}" ${r.roundNumber === this.toRound ? 'selected' : ''}>
                          ${r.roundNumber}ª (${r.fantaNome ? r.fantaNome.split('(')[0].trim() : `${r.roundNumber}ª`}${r.serieADay ? ` • ${r.serieADay}ª Serie A` : ''}${!r.played ? ' • Da giocare' : ''})
                        </option>
                      `).join('')}
                    </select>
                  </div>
                </div>

                <!-- Quick Presets -->
                <div class="classifica-range-presets">
                  <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-right:2px;">
                    Preimpostazioni rapide:
                  </span>
                  <button type="button" class="range-preset-btn ${this.isPresetActive('last5', groupRounds) ? 'active' : ''}" id="btnPresetLast5">
                    Ultime 5 Giornate
                  </button>
                  ${groupRounds.length >= 4 ? `
                    <button type="button" class="range-preset-btn ${this.isPresetActive('andata', groupRounds) ? 'active' : ''}" id="btnPresetAndata">
                      Girone Andata (1-${Math.floor(groupRounds.length / 2)})
                    </button>
                    <button type="button" class="range-preset-btn ${this.isPresetActive('ritorno', groupRounds) ? 'active' : ''}" id="btnPresetRitorno">
                      Girone Ritorno (${Math.floor(groupRounds.length / 2) + 1}-${groupRounds.length})
                    </button>
                  ` : ''}
                  <button type="button" class="range-preset-btn ${this.isPresetActive('all', groupRounds) ? 'active' : ''}" id="btnPresetAll">
                    Tutte (1-${groupRounds.length})
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Micro-hint per lo scorrimento orizzontale su mobile quando la tabella è estesa -->
        <div class="classifica-scroll-hint ${this.showAdvanced || this.isExpandedBase ? 'is-visible' : ''}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Scorri orizzontalmente per visualizzare tutte le statistiche</span>
        </div>

        <!-- Range Alert Banner se il filtro Serie di Giornate è attivo -->
        ${(this.isRangeActive && hasMultipleRounds) ? `
          <div class="classifica-range-banner">
            <div class="classifica-range-banner-info">
              <span class="classifica-range-banner-badge">Serie di Giornate</span>
              <span>
                Classifica parziale: dalla <strong>${this.fromRound}ª</strong> alla <strong>${this.toRound}ª giornata</strong>
                <span style="color:var(--text-secondary);font-size:0.78rem;margin-left:4px;">
                  (${selectedPlayedCount} partite disputate su ${this.toRound - this.fromRound + 1} giornate)
                </span>
              </span>
            </div>
            <button type="button" class="btn-range-reset" id="btnResetRangeBanner" title="Torna alla classifica generale completa">
              ✕ Ripristina Generale
            </button>
          </div>
        ` : ''}

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
            <b>MI</b>: Media Inglese<br>
            <b>CV / CN / CP</b>: Casa Vinte, Nulle, Perse.<br>
            <b>FV / FN / FP</b>: Fuori Vinte, Nulle, Perse.<br>
            <b>CF / CS</b>: Casa Gol Fatti e Gol Subiti.<br>
            <b>FF / FS</b>: Fuori Gol Fatti e Gol Subiti.<br>
            <b>Totali</b>: Somma dei punteggi complessivi realizzati.
          </div>
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-emerald);">
            <b style="color:var(--text-primary);display:block;margin-bottom:4px;">Serie di Giornate (Classifica Parziale)</b>
            Consente di isolare le prestazioni delle squadre in un intervallo personalizzato di giornate (es. ultime 5, girone d'andata o ritorno).<br>
            Tutti i punteggi, vittorie, gol, medie e deviazioni standard vengono ricalcolati esattamente per il periodo selezionato.
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

    // Tab buttons
    const btnTabPerpetua = container.querySelector('#btnTabPerpetua');
    if (btnTabPerpetua) {
      btnTabPerpetua.addEventListener('click', () => {
        this.activeTab = 'perpetua';
        window.location.hash = '#classifica?tab=perpetua';
      });
    }

    // Return to current season button
    const btnReturnCurrentSeason = container.querySelector('#btnReturnCurrentSeason');
    if (btnReturnCurrentSeason) {
      btnReturnCurrentSeason.addEventListener('click', () => {
        this.selectedSeason = currentSeasonId;
        this.currentCompId = 0;
        this.currentGroupId = 1;
        window.location.hash = '#classifica';
      });
    }

    // Season selector change
    const selSeason = container.querySelector('#selClassificaSeason');
    if (selSeason) {
      selSeason.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.selectedSeason = val;
          this.currentCompId = 0;
          this.currentGroupId = 1;
          this.fromRound = 1;
          this.toRound = null;
          this.sortKey = 'pos';
          this.sortOrder = 'asc';
          if (val === currentSeasonId) {
            window.location.hash = '#classifica';
          } else {
            window.location.hash = `#classifica?season=${val}`;
          }
        }
      });
    }

    // Competition dropdown change
    const selComp = container.querySelector('#selClassificaComp');
    if (selComp) {
      selComp.addEventListener('change', (e) => {
        this.currentCompId = parseInt(e.target.value, 10);
        const comp = comps.find(c => c.id === this.currentCompId);
        if (comp && comp.groups && comp.groups.length > 0) {
          const firstGrp = comp.groups[0];
          this.currentGroupId = (firstGrp.ID !== undefined) ? firstGrp.ID : firstGrp.id;
        } else if (comp) {
          this.currentGroupId = comp.defaultGroupId || comp.id;
        }
        this.fromRound = 1;
        this.toRound = null;
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
        this.fromRound = 1;
        this.toRound = null;
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

    // Mode: Tutte le Giornate
    const btnModeAll = container.querySelector('#btnModeAllRounds');
    if (btnModeAll) {
      btnModeAll.addEventListener('click', () => {
        if (this.isRangeActive) {
          this.isRangeActive = false;
          this.render(container);
        }
      });
    }

    // Mode: Serie di Giornate
    const btnModeRange = container.querySelector('#btnModeCustomRange');
    if (btnModeRange) {
      btnModeRange.addEventListener('click', () => {
        if (!this.isRangeActive) {
          this.isRangeActive = true;
          this.render(container);
        }
      });
    }

    // Dalla giornata selector
    const selFrom = container.querySelector('#selClassificaFromRound');
    if (selFrom) {
      selFrom.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.fromRound = val;
          if (this.toRound < this.fromRound) {
            this.toRound = this.fromRound;
          }
          this.render(container);
        }
      });
    }

    // Alla giornata selector
    const selTo = container.querySelector('#selClassificaToRound');
    if (selTo) {
      selTo.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.toRound = val;
          if (this.fromRound > this.toRound) {
            this.fromRound = this.toRound;
          }
          this.render(container);
        }
      });
    }

    // Preset: Ultime 5 Giornate
    const btnPresetLast5 = container.querySelector('#btnPresetLast5');
    if (btnPresetLast5) {
      btnPresetLast5.addEventListener('click', () => {
        const lastP = this.getLastPlayedRoundNumber(groupRounds);
        this.fromRound = Math.max(1, lastP - 4);
        this.toRound = lastP;
        this.render(container);
      });
    }

    // Preset: Girone Andata
    const btnPresetAndata = container.querySelector('#btnPresetAndata');
    if (btnPresetAndata) {
      btnPresetAndata.addEventListener('click', () => {
        this.fromRound = 1;
        this.toRound = Math.floor(groupRounds.length / 2);
        this.render(container);
      });
    }

    // Preset: Girone Ritorno
    const btnPresetRitorno = container.querySelector('#btnPresetRitorno');
    if (btnPresetRitorno) {
      btnPresetRitorno.addEventListener('click', () => {
        this.fromRound = Math.floor(groupRounds.length / 2) + 1;
        this.toRound = groupRounds.length;
        this.render(container);
      });
    }

    // Preset: Tutte
    const btnPresetAll = container.querySelector('#btnPresetAll');
    if (btnPresetAll) {
      btnPresetAll.addEventListener('click', () => {
        this.fromRound = 1;
        this.toRound = groupRounds.length;
        this.render(container);
      });
    }

    // Reset banner button
    const btnResetBanner = container.querySelector('#btnResetRangeBanner');
    if (btnResetBanner) {
      btnResetBanner.addEventListener('click', () => {
        this.isRangeActive = false;
        this.render(container);
      });
    }
  }
};
