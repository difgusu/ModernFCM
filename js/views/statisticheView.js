/**
 * STATISTICHE VIEW
 * FCM Queries Explorer
 * ModernFCM
 */

const statisticheView = {
  currentQueryId: null,
  searchFilter: '',

  _escAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  handleTeamLogoError(img) {
    if (!img || !img.dataset) return;
    const stage = parseInt(img.dataset.stage || '0', 10);
    const candidates = [img.dataset.gif, img.dataset.altPng, img.dataset.altGif];
    for (let i = stage; i < candidates.length; i++) {
      const nextSrc = candidates[i];
      if (nextSrc && nextSrc !== img.getAttribute('src')) {
        img.dataset.stage = String(i + 1);
        img.src = nextSrc;
        return;
      }
    }
    img.onerror = null;
    img.src = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader._resolvePath === 'function')
      ? fcmDataLoader._resolvePath('img/sq/undefined.svg')
      : 'img/sq/undefined.svg';
  },

  renderTeamShirtMarkup(teamName, teamId = 0) {
    const cleanName = String(teamName || '').trim();
    const resolve = (p) => (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader._resolvePath === 'function')
      ? fcmDataLoader._resolvePath(p)
      : p;
    const encodeTeam = (n) => n ? encodeURIComponent(n).replace(/'/g, '%27') : '';
    const encoded = encodeTeam(cleanName);
    const primarySrc = encoded ? resolve(`img/sq/${encoded}.png`) : resolve('img/sq/undefined.svg');
    const gifSrc = encoded ? resolve(`img/sq/${encoded}.gif`) : '';

    let altPng = '';
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function') {
      const fallbackLogo = fcmDataLoader.getTeamLogo(teamId || cleanName);
      if (fallbackLogo && !fallbackLogo.endsWith('undefined.svg') && fallbackLogo !== primarySrc) {
        altPng = fallbackLogo;
      }
    }
    const altGif = altPng ? altPng.replace(/\.png$/i, '.gif') : '';

    return `<img src="${this._escAttr(primarySrc)}" class="hist-team-shirt" alt="" loading="lazy" data-gif="${this._escAttr(gifSrc)}" data-alt-png="${this._escAttr(altPng)}" data-alt-gif="${this._escAttr(altGif)}" onerror="statisticheView.handleTeamLogoError(this)" />`;
  },

  renderTeamCell(teamName, teamId = 0, isFavByFsq = false) {
    const cleanName = String(teamName || '').trim();
    const safeName = this._escAttr(cleanName);
    const shirtHtml = this.renderTeamShirtMarkup(cleanName, teamId);
    const favStar = isFavByFsq ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : '';
    const rosterUrl = teamId > 0
      ? `#rose?team=${teamId}`
      : (cleanName ? `#rose?teamName=${encodeURIComponent(cleanName)}` : '');

    if (!rosterUrl) {
      return `<span class="hist-team-link stats-team-link is-static">${shirtHtml}${favStar}<span class="hist-team-name-text">${safeName}</span></span>`;
    }

    return `<a href="${this._escAttr(rosterUrl)}" class="hist-team-link stats-team-link" title="Apri rosa di ${safeName}">${shirtHtml}${favStar}<span class="hist-team-name-text">${safeName}</span></a>`;
  },

  renderPlayerCell(cleanName, mobileName, rowCode = null, serieATeamName = '') {
    const safeName = this._escAttr(cleanName);
    const safeMobile = this._escAttr(mobileName || cleanName);
    const resolve = (p) => (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader._resolvePath === 'function')
      ? fcmDataLoader._resolvePath(p)
      : p;

    const explicitCode = Number(rowCode) > 0 ? Number(rowCode) : null;
    const revCode = (!explicitCode && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerCode === 'function')
      ? fcmDataLoader.getPlayerCode(cleanName)
      : null;
    const pCode = explicitCode || revCode || null;

    const profileLink = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerProfileLink === 'function')
      ? fcmDataLoader.getPlayerProfileLink({ name: cleanName, code: pCode })
      : `#schede_giocatori?name=${encodeURIComponent(cleanName)}`;

    const photoSrc = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function')
      ? fcmDataLoader.getPlayerPhoto(cleanName, pCode)
      : (pCode ? resolve(`img/foto/${pCode}.jpg`) : resolve('img/foto/misterx.gif'));
    const misterxSrc = resolve('img/foto/misterx.gif');

    const cleanClub = String(serieATeamName || '').trim();
    const serieALogo = (cleanClub && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieALogo === 'function')
      ? fcmDataLoader.getSerieALogo(cleanClub)
      : (cleanClub ? resolve(`img/sq/logo/${encodeURIComponent(cleanClub)}.png`) : '');
    const showClubLogo = Boolean(serieALogo && !serieALogo.endsWith('undefined.svg'));
    const safeClub = this._escAttr(cleanClub);

    return `
      <div class="hist-player-cell stats-player-cell">
        <a href="${this._escAttr(profileLink)}" class="hist-player-avatar-link" aria-label="Apri scheda di ${safeName}" title="Apri scheda di ${safeName}">
          <img src="${this._escAttr(photoSrc)}" class="hist-player-thumb" alt="" loading="lazy" data-fallback="${this._escAttr(misterxSrc)}" onerror="this.onerror=null;this.src=this.dataset.fallback||'img/foto/misterx.gif';" />
        </a>
        <div class="stats-player-info">
          <a href="${this._escAttr(profileLink)}" class="hist-player-name-link stats-player-name-link" title="Apri scheda di ${safeName}">
            <span class="desktop-only">${safeName}</span>
            <span class="mobile-only">${safeMobile}</span>
          </a>
          ${cleanClub ? `
            <div class="stats-seriea-subtext">
              ${showClubLogo ? `<img src="${this._escAttr(serieALogo)}" class="stats-seriea-logo" alt="" loading="lazy" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/i,'.jpg');}else{this.style.display='none';}" />` : ''}
              <span>${safeClub}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

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

    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.table({ cols: 5, rows: 8, withToolbar: true, toolbarPills: 5, title: currentQuery ? currentQuery.name : '' })
      : `
        <div class="card text-center" style="padding:40px;">
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Caricamento Statistiche...</div>
          <div style="color:var(--text-muted);font-size:0.85rem;">${currentQuery ? this._escAttr(currentQuery.name) : ''}</div>
        </div>
      `;

    // Ensure Serie A & Fantasquadre metadata are available for reverse photo/team lookups
    if (typeof arrGiocatoriA === 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
      try { await fcmDataLoader.loadScript('js/fcmSerieADatiDettaglio.js'); } catch (e) { }
    }
    if (typeof arrFantasquadre === 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
      try { await fcmDataLoader.loadScript('js/fcmFantasquadreDati.js'); } catch (e) { }
    }

    // Load query data
    const queryData = await fcmDataLoader.loadQueryStat(this.currentQueryId);

    // Apply search filter
    const normalizedFilter = this.searchFilter.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    let filteredRows = queryData.rows;
    if (normalizedFilter.length > 0) {
      filteredRows = filteredRows.filter(row =>
        row.map(c => String(c).replace(/&nbsp;/gi, ' ')).join(' ').replace(/\s+/g, ' ').toLowerCase().includes(normalizedFilter)
      );
    }

    // Detect special columns
    const cleanHeaders = queryData.headers.map(h => String(h).replace(/&nbsp;/g, ' ').trim());

    // 1. Serie A Team Column (e.g., "Squadra", "Sq.", "Sq", "Squadra di A")
    const serieAColIdx = cleanHeaders.findIndex((h, idx) => {
      if (idx === 0) return false;
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

    // 4. Optional Player Code Column ("Cod", "Codice")
    const codColIdx = cleanHeaders.findIndex(h => {
      const lower = h.toLowerCase();
      return lower === 'cod' || lower === 'codice';
    });

    // Build lookup map from Fantasquadra name -> ID
    const teamIdByName = new Map();
    if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeams === 'function') {
      fcmDataLoader.getTeams().forEach(t => {
        if (t && t.Nome && t.ID) {
          teamIdByName.set(String(t.Nome).trim().toLowerCase(), Number(t.ID));
        }
      });
    }

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
            <div class="card-subtitle">${currentQuery ? this._escAttr(currentQuery.name) : ''}</div>
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
                  ${q.id}. ${this._escAttr(q.name)}
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
                value="${this._escAttr(this.searchFilter)}"
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
        <div class="table-responsive stats-table-wrap" tabindex="0" role="region" aria-label="Tabella Statistiche: ${this._escAttr(currentQuery ? currentQuery.name : 'Statistiche di Lega')}">
          <table class="modern-table stats-table">
            <thead>
              <tr>
                <th class="text-center col-index-header" style="width:32px;">#</th>
                ${visibleHeaderIndices.map(i => {
      const hText = cleanHeaders[i];
      const isRole = i === roleColIdx;
      return `<th class="${isRole ? 'text-center col-role-header' : ''}">${this._escAttr(hText)}</th>`;
    }).join('')}
              </tr>
            </thead>
            <tbody id="statsTableBody">
              ${(() => {
        const favPlayerNames = new Set();
        if (typeof fcmHomeConfigManager !== 'undefined' && typeof fcmHomeConfigManager.hasFavoriteTeam === 'function' && fcmHomeConfigManager.hasFavoriteTeam()) {
          const favId = fcmHomeConfigManager.getFavoriteTeamId();
          if (typeof arrRose !== 'undefined' && Array.isArray(arrRose)) {
            // 1. Traccia tutti i giocatori svincolati (Stato === 1) dalla squadra del cuore
            const svincolati = new Set();
            arrRose.forEach(r => {
              if (r && r.IDSquadra === favId && r.Stato === 1) {
                const clean = String(r.Nome || '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
                if (clean) svincolati.add(clean);
              }
            });

            // 2. Includi solo i giocatori attualmente in rosa (Stato === 0) o in lista infortunati (Stato === 2),
            // escludendo chiunque sia svincolato
            arrRose.forEach(r => {
              if (r && r.IDSquadra === favId && (r.Stato === 0 || r.Stato === 2)) {
                const clean = String(r.Nome || '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
                if (clean && !svincolati.has(clean)) {
                  favPlayerNames.add(clean);
                }
              }
            });
          }
        }

        let visibleRowIdx = 0;
        return queryData.rows.length > 0 ? queryData.rows.map((row, idx) => {
          const searchStr = row.map(c => String(c).replace(/&nbsp;/gi, ' ')).join(' ').replace(/\s+/g, ' ').toLowerCase();
          const isMatch = !normalizedFilter || searchStr.includes(normalizedFilter);
          const displayIdx = isMatch ? (++visibleRowIdx) : (idx + 1);

          const serieATeamName = (serieAColIdx !== -1 && row[serieAColIdx]) ? String(row[serieAColIdx]).replace(/&nbsp;/gi, ' ').trim() : '';
          const playerName = row[0] ? String(row[0]).replace(/&nbsp;/gi, ' ').trim() : '';
          const playerNameLower = playerName.replace(/\s+/g, ' ').toLowerCase();
          const rowCode = (codColIdx !== -1 && row[codColIdx]) ? String(row[codColIdx]).replace(/&nbsp;/gi, ' ').trim() : '';
          const fsqVal = (fsqColIdx !== -1 && row[fsqColIdx]) ? String(row[fsqColIdx]).replace(/&nbsp;/gi, ' ').trim() : '';

          // Solo i calciatori attualmente in rosa o infortunati della squadra del cuore vengono evidenziati
          const isFavPlayer = favPlayerNames.has(playerNameLower);
          const isFavByFsq = isFavPlayer && fsqVal && (typeof fcmHomeConfigManager !== 'undefined') && typeof fcmHomeConfigManager.isFavoriteTeam === 'function' && fcmHomeConfigManager.isFavoriteTeam(fsqVal);

          return `
                    <tr class="stats-data-row ${isFavPlayer ? 'table-row-favorite' : ''}" data-searchable="${this._escAttr(searchStr)}" style="${isMatch ? '' : 'display:none;'}">
                      <td class="text-center font-bold row-index col-index-cell" style="color:var(--text-muted);">${displayIdx}</td>
                      ${visibleHeaderIndices.map(cellIdx => {
            const val = row[cellIdx] !== undefined ? row[cellIdx] : '';
            const cleanVal = String(val).replace(/&nbsp;/g, ' ').trim();

            // Column 0: Player Name + Minifoto + Link (#schede_giocatori) + Serie A Logo
            if (cellIdx === 0) {
              const mobileName = this.formatPlayerNameMobile(cleanVal);
              return `<td class="col-player-cell">${this.renderPlayerCell(cleanVal, mobileName, rowCode, serieATeamName)}</td>`;
            }

            // Fantasquadra Column ("Tesserato in") -> Jersey + Hover Zoom + Link (#rose)
            if (cellIdx === fsqColIdx && cleanVal && cleanVal !== '-') {
              const resolvedTeamId = teamIdByName.get(cleanVal.toLowerCase()) || 0;
              return `<td class="col-fsq-cell">${this.renderTeamCell(cleanVal, resolvedTeamId, isFavByFsq)}</td>`;
            }

            // Role Column Badge ("P", "D", "C", "A")
            if (cellIdx === roleColIdx || cleanVal === 'P' || cleanVal === 'D' || cleanVal === 'C' || cleanVal === 'A') {
              if (cleanVal === 'P' || cleanVal === 'D' || cleanVal === 'C' || cleanVal === 'A') {
                const rNum = cleanVal === 'P' ? 1 : cleanVal === 'D' ? 2 : cleanVal === 'C' ? 3 : 4;
                return `<td class="text-center col-role-cell"><span class="role-badge ${fcmDataLoader.getRoleClass(rNum)}">${cleanVal}</span></td>`;
              }
            }

            return `<td>${this._escAttr(cleanVal)}</td>`;
          }).join('')}
                    </tr>
                  `;
        }).join('') : '';
      })()}
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
        const query = e.target.value.replace(/\s+/g, ' ').trim().toLowerCase();
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

if (typeof window !== 'undefined') {
  window.statisticheView = statisticheView;
}
