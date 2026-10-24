/**
 * STATISTICHE VIEW
 * FCM Queries Explorer
 * ModernFCM
 */

const statisticheView = {
  currentQueryId: null,
  searchFilter: '',

  tabDefinitions: [
    {
      matchNames: ['classifica cannonieri', 'cannonieri', 'marcatori'],
      label: 'Cannonieri',
      shortLabel: 'Cannonieri',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>'
    },
    {
      matchNames: ['giocatori liberi da contratto - per ruolo', 'liberi da contratto - per ruolo', 'liberi - per ruolo'],
      label: 'Giocatori liberi - per ruolo',
      shortLabel: 'Liberi (ruolo)',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    },
    {
      matchNames: ['migliori fantamedia liberi da contratto', 'migliori fantamedia liberi', 'fantamedia liberi'],
      label: 'Migliori Fantamedia liberi',
      shortLabel: 'Liberi (FMedia)',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
    },
    {
      matchNames: ['migliori media voto liberi da contratto', 'migliori media voto liberi', 'media voto liberi'],
      label: 'Migliori Media Voto liberi',
      shortLabel: 'Liberi (MVoto)',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
    },
    {
      matchNames: ['tutti i dati', 'tutti dati'],
      label: 'Tutti i dati',
      shortLabel: 'Tutti i dati',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>'
    }
  ],

  getResolvedQuickTabs(queryList) {
    if (!queryList || queryList.length === 0) return [];
    const resolved = [];
    const roleWords = ['attaccanti', 'centrocampisti', 'difensori', 'portieri'];

    for (const def of this.tabDefinitions) {
      // 1. Try exact match first
      let foundQuery = queryList.find(q => {
        const qNameLower = (q.name || '').toLowerCase().trim();
        return def.matchNames.some(m => qNameLower === m.toLowerCase().trim());
      });

      // 2. Fallback to substring match, excluding role-specific queries unless tab is role-specific
      if (!foundQuery) {
        const tabIsRoleSpecific = def.matchNames.some(m =>
          roleWords.some(r => m.toLowerCase().includes(r)) || m.toLowerCase().includes('ruolo')
        );

        foundQuery = queryList.find(q => {
          const qNameLower = (q.name || '').toLowerCase().trim();
          const matchesPattern = def.matchNames.some(m => qNameLower.includes(m.toLowerCase().trim()));
          if (!matchesPattern) return false;

          if (!tabIsRoleSpecific) {
            const hasRoleWord = roleWords.some(r => qNameLower.includes(r));
            if (hasRoleWord) return false;
          }
          return true;
        });
      }

      if (foundQuery) {
        resolved.push({
          id: foundQuery.id,
          name: foundQuery.name,
          label: def.label,
          shortLabel: def.shortLabel,
          icon: def.icon
        });
      }
    }

    return resolved;
  },

  formatPlayerNameMobile(fullName) {
    if (!fullName) return '';
    const str = String(fullName).replace(/&nbsp;/g, ' ').trim();
    const parts = str.split(/\s+/);
    if (parts.length <= 1) return str;

    const surnameParts = [];
    const firstNameParts = [];

    for (const part of parts) {
      const cleanAlpha = part.replace(/[^a-zA-Z]/g, '');
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
        const clean = name.replace(/[^a-zA-Z]/g, '');
        return clean.length > 0 ? clean[0].toUpperCase() + '.' : '';
      })
      .filter(Boolean)
      .join(' ');

    return initials ? `${surnameStr} ${initials}` : surnameStr;
  },

  async render(container) {
    const queryList = fcmDataLoader.getQueryList();
    const quickTabs = this.getResolvedQuickTabs(queryList);

    // Resolve current query dynamically if not set or invalid
    let currentQuery = queryList.find(q => q.id === this.currentQueryId);
    if (!currentQuery) {
      const defaultTab = quickTabs.find(t => t.shortLabel === 'Cannonieri') || quickTabs[0];
      if (defaultTab) {
        this.currentQueryId = defaultTab.id;
        currentQuery = queryList.find(q => q.id === this.currentQueryId);
      }
      if (!currentQuery && queryList.length > 0) {
        currentQuery = queryList[0];
        this.currentQueryId = currentQuery.id;
      }
    }

    container.innerHTML = `
      <div class="card text-center" style="padding:40px;">
        <div style="font-size:1.1rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Caricamento Statistiche...</div>
        <div style="color:var(--text-muted);font-size:0.85rem;">${currentQuery ? currentQuery.name : ''}</div>
      </div>
    `;

    // Load query data
    const queryData = await fcmDataLoader.loadQueryStat(this.currentQueryId);

    // Apply search filter
    let filteredRows = queryData.rows;
    if (this.searchFilter.trim().length > 0) {
      const q = this.searchFilter.trim().toLowerCase();
      filteredRows = filteredRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(q)));
    }

    // Detect special columns
    const cleanHeaders = queryData.headers.map(h => String(h).replace(/&nbsp;/g, ' ').trim());

    // 1. Serie A Team Column (e.g., "Squadra", "Sq.", "Sq", "Squadra di A")
    const serieAColIdx = cleanHeaders.findIndex(h => {
      const lower = h.toLowerCase();
      return (lower === 'squadra' || lower === 'sq.' || lower === 'sq' || lower === 'squadra di a') && !lower.includes('tesserato');
    });

    // 2. Fantasquadra Column ("Tesserato in", "Fantasquadra")
    const fsqColIdx = cleanHeaders.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('tesserato') || lower.includes('fantasquadra');
    });

    // 3. Role Column ("Ruolo", "R")
    const roleColIdx = cleanHeaders.findIndex(h => {
      const lower = h.toLowerCase();
      return lower === 'ruolo' || lower === 'r';
    });

    // Determine visible column indices (Serie A team column is merged into player column)
    const visibleHeaderIndices = cleanHeaders
      .map((h, i) => i)
      .filter(i => i !== serieAColIdx);

    let html = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Statistiche di Lega
            </div>
            <div class="card-subtitle">${currentQuery ? currentQuery.name : ''}</div>
          </div>
        </div>

        ${quickTabs.length > 0 ? `
          <!-- Quick Stats Tabs -->
          <div style="margin-bottom: 16px;">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
              Scelte Rapide
            </div>
            <div class="pill-tabs stats-quick-tabs" style="margin-bottom:0;">
              ${quickTabs.map(tab => `
                <button 
                  type="button" 
                  class="pill-btn ${tab.id === this.currentQueryId ? 'active' : ''}" 
                  data-query-id="${tab.id}"
                  style="display:inline-flex;align-items:center;gap:6px;"
                >
                  ${tab.icon}
                  <span class="desktop-only">${tab.label}</span>
                  <span class="mobile-only">${tab.shortLabel || tab.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Query Selector Dropdown & Search -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Seleziona Statistica (${queryList.length} disponibili)
            </label>
            <select id="selectQueryId" class="form-select" style="width:100%;">
              ${queryList.map(q => `
                <option value="${q.id}" ${q.id === this.currentQueryId ? 'selected' : ''}>
                  ${q.id}. ${q.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Filtra Tabella
            </label>
            <div style="position:relative;display:flex;align-items:center;">
              <input 
                type="text" 
                id="inputQueryFilter" 
                class="form-input search-input" 
                style="width:100%;padding-right:32px;" 
                placeholder="Cerca nome calciatore o squadra..." 
                value="${this.searchFilter}"
              />
              <button 
                type="button" 
                id="btnClearQueryFilter" 
                title="Svuota ricerca"
                style="position:absolute;right:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:${this.searchFilter.trim() ? 'flex' : 'none'};align-items:center;justify-content:center;border-radius:50%;"
                onmouseover="this.style.color='var(--text-primary)'" 
                onmouseout="this.style.color='var(--text-muted)'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Statistics Table -->
        <div class="table-responsive">
          <table class="modern-table stats-table">
            <thead>
              <tr>
                <th class="text-center col-index-header" style="width:32px;">#</th>
                ${visibleHeaderIndices.map(i => {
      const hText = cleanHeaders[i];
      const isRole = i === roleColIdx;
      return `<th class="${isRole ? 'text-center col-role-header' : ''}">${hText}</th>`;
    }).join('')}
              </tr>
            </thead>
            <tbody id="statsTableBody">
              ${queryData.rows.length > 0 ? queryData.rows.map((row, idx) => {
      const searchStr = row.map(c => String(c).replace(/&nbsp;/g, ' ')).join(' ').toLowerCase();
      const isMatch = !this.searchFilter.trim() || searchStr.includes(this.searchFilter.trim().toLowerCase());

      const serieATeamName = (serieAColIdx !== -1 && row[serieAColIdx]) ? String(row[serieAColIdx]).replace(/&nbsp;/g, ' ').trim() : '';

      return `
                  <tr class="stats-data-row" data-searchable="${searchStr.replace(/"/g, '&quot;')}" style="${isMatch ? '' : 'display:none;'}">
                    <td class="text-center font-bold row-index col-index-cell" style="color:var(--text-muted);">${idx + 1}</td>
                    ${visibleHeaderIndices.map(cellIdx => {
        const val = row[cellIdx] !== undefined ? row[cellIdx] : '';
        const cleanVal = String(val).replace(/&nbsp;/g, ' ').trim();

        // Column 0: Player Name (or primary entity)
        if (cellIdx === 0) {
          const mobileName = this.formatPlayerNameMobile(cleanVal);
          return `
                          <td class="col-player-cell">
                            <div>
                              <span class="font-bold desktop-only" style="color:var(--text-primary);">${cleanVal}</span>
                              <span class="font-bold mobile-only" style="color:var(--text-primary);">${mobileName}</span>
                              ${serieATeamName ? `
                                <div class="stats-seriea-subtext" style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px;">
                                  <img src="img/live/sq/${encodeURIComponent(serieATeamName)}.png" style="height:14px;width:auto;vertical-align:middle;" onerror="this.style.display='none'" />
                                  <span>${serieATeamName}</span>
                                </div>
                              ` : ''}
                            </div>
                          </td>
                        `;
        }

        // Fantasquadra Column ("Tesserato in")
        if (cellIdx === fsqColIdx && cleanVal) {
          const fsqLogo = fcmDataLoader.getTeamLogo(cleanVal);
          return `
                          <td class="col-fsq-cell">
                            <div style="display:inline-flex;align-items:center;gap:6px;">
                              <img src="${fsqLogo}" style="height:18px;width:auto;object-fit:contain;vertical-align:middle;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                              <span class="font-semibold" style="color:var(--text-primary);">${cleanVal}</span>
                            </div>
                          </td>
                        `;
        }

        // Role Column Badge ("P", "D", "C", "A")
        if (cellIdx === roleColIdx || cleanVal === 'P' || cleanVal === 'D' || cleanVal === 'C' || cleanVal === 'A') {
          if (cleanVal === 'P' || cleanVal === 'D' || cleanVal === 'C' || cleanVal === 'A') {
            const rNum = cleanVal === 'P' ? 1 : cleanVal === 'D' ? 2 : cleanVal === 'C' ? 3 : 4;
            return `<td class="text-center col-role-cell"><span class="role-badge ${fcmDataLoader.getRoleClass(rNum)}">${cleanVal}</span></td>`;
          }
        }

        return `<td>${cleanVal}</td>`;
      }).join('')}
                  </tr>
                `;
    }).join('') : ''}
              <tr id="statsNoResultsRow" style="${filteredRows.length === 0 ? '' : 'display:none;'}">
                <td colspan="${visibleHeaderIndices.length + 1}" class="text-center" style="padding:24px;color:var(--text-muted);">
                  Nessun dato trovato per il filtro o la statistica selezionata.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Attach quick tabs listener
    const tabBtns = container.querySelectorAll('.stats-quick-tabs .pill-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qId = parseInt(e.currentTarget.getAttribute('data-query-id'));
        if (qId && qId !== this.currentQueryId) {
          this.currentQueryId = qId;
          this.searchFilter = '';
          this.render(container);
        }
      });
    });

    // Attach select listener
    const selectEl = container.querySelector('#selectQueryId');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        this.currentQueryId = parseInt(e.target.value);
        this.searchFilter = '';
        this.render(container);
      });
    }

    // Attach instant filter listener (filters DOM rows directly without reloading or losing focus)
    const filterInput = container.querySelector('#inputQueryFilter');
    const clearBtn = container.querySelector('#btnClearQueryFilter');

    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        this.searchFilter = e.target.value;

        if (clearBtn) {
          clearBtn.style.display = e.target.value.trim().length > 0 ? 'flex' : 'none';
        }

        const tbody = container.querySelector('#statsTableBody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('.stats-data-row');
        let visibleCount = 0;

        rows.forEach(tr => {
          const text = tr.getAttribute('data-searchable') || '';
          const match = !query || text.includes(query);
          if (match) {
            tr.style.display = '';
            visibleCount++;
            const idxCell = tr.querySelector('.row-index');
            if (idxCell) idxCell.textContent = visibleCount;
          } else {
            tr.style.display = 'none';
          }
        });

        const noDataRow = tbody.querySelector('#statsNoResultsRow');
        if (noDataRow) {
          noDataRow.style.display = visibleCount === 0 ? '' : 'none';
        }
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          filterInput.value = '';
          filterInput.dispatchEvent(new Event('input'));
          filterInput.focus();
        });
      }
    }
  }
};
