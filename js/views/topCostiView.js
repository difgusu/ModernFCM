/**
 * TOP COSTI D'ASTA VIEW
 * Statistiche dei calciatori più pagati all'asta (Storico All-Time e Stagione Corrente)
 * ModernFCM
 */

const topCostiView = {
  currentTab: 'storico', // 'storico' or 'stagione'
  currentTeamId: 0,      // 0 = Totale Lega
  currentRole: 'ALL',    // 'ALL', 'P', 'D', 'C', 'A'

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

  renderTeamShirtMarkup(teamName, teamId = 0, historicalTeamId = 0, seasonTeamName = '', extraClass = '') {
    const cleanName = String(teamName || '').trim();
    const cleanSeasonName = String(seasonTeamName || '').trim();
    const resolve = (p) => (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader._resolvePath === 'function')
      ? fcmDataLoader._resolvePath(p)
      : p;
    const encodeTeam = (n) => n ? encodeURIComponent(n).replace(/'/g, '%27') : '';
    const encoded = encodeTeam(cleanName);
    const primarySrc = encoded ? resolve(`img/sq/${encoded}.png`) : resolve('img/sq/undefined.svg');
    const gifSrc = encoded ? resolve(`img/sq/${encoded}.gif`) : '';

    let altPng = '';
    if (cleanSeasonName && cleanSeasonName !== cleanName) {
      altPng = resolve(`img/sq/${encodeTeam(cleanSeasonName)}.png`);
    } else if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getTeamLogo === 'function') {
      const fallbackLogo = fcmDataLoader.getTeamLogo(historicalTeamId || teamId || cleanName);
      if (fallbackLogo && !fallbackLogo.endsWith('undefined.svg') && fallbackLogo !== primarySrc) {
        altPng = fallbackLogo;
      }
    }
    const altGif = altPng ? altPng.replace(/\.png$/i, '.gif') : (cleanSeasonName && cleanSeasonName !== cleanName ? resolve(`img/sq/${encodeTeam(cleanSeasonName)}.gif`) : '');
    const cls = extraClass ? `hist-team-shirt ${extraClass}` : 'hist-team-shirt';

    return `<img src="${this._escAttr(primarySrc)}" class="${cls}" alt="" loading="lazy" data-gif="${this._escAttr(gifSrc)}" data-alt-png="${this._escAttr(altPng)}" data-alt-gif="${this._escAttr(altGif)}" onerror="topCostiView.handleTeamLogoError(this)" />`;
  },

  getRowRosterUrl(r, teamById, isCurrent) {
    const masterId = Number(r.teamId || 0);
    const tObj = teamById.get(masterId) || null;
    const currentId = Number(tObj ? (tObj.currentId || tObj.idAttuale || 0) : 0);
    const localId = Number(r.localTeamId || 0);
    const seasonNum = Number(r.seasonNum || 0);

    if (isCurrent) {
      const targetId = currentId > 0 ? currentId : localId;
      if (targetId > 0) return `#rose?team=${targetId}`;
      if (masterId > 0) return `#rose?albo=${masterId}`;
      return r.teamName ? `#rose?teamName=${encodeURIComponent(r.teamName)}` : '#rose';
    }

    if (seasonNum > 0 && localId > 0) {
      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSeasonRosterLink === 'function') {
        const link = fcmDataLoader.getSeasonRosterLink(seasonNum, localId);
        if (link && link.url) return link.url;
      }
      return `#rose?season=${seasonNum}&team=${localId}`;
    }

    if (seasonNum > 0 && masterId > 0) {
      return `#rose?season=${seasonNum}&albo=${masterId}`;
    }
    if (masterId > 0) return `#rose?albo=${masterId}`;
    return currentId > 0 ? `#rose?team=${currentId}` : '#rose';
  },

  renderTeamLink(r, rosterUrl, isFav, extraClass = '', isCurrent = false) {
    const shirtHtml = this.renderTeamShirtMarkup(
      r.teamName,
      r.localTeamId || r.teamId,
      r.teamId,
      r.seasonTeamName || '',
      ''
    );
    const favStar = isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : '';
    const teamLabel = this._escAttr(r.teamName || '-');
    const seasonSuffix = (!isCurrent && r.season) ? ` (${this._escAttr(r.season)})` : '';
    const titlePrefix = isCurrent ? 'Apri rosa attuale di' : 'Apri rosa di';
    const cls = extraClass ? `hist-team-link ${extraClass}` : 'hist-team-link';
    if (!rosterUrl) {
      return `<span class="${cls} is-static">${shirtHtml}${favStar}<span class="hist-team-name-text">${teamLabel}</span></span>`;
    }
    return `<a href="${this._escAttr(rosterUrl)}" class="${cls}" title="${titlePrefix} ${teamLabel}${seasonSuffix}">${shirtHtml}${favStar}<span class="hist-team-name-text">${teamLabel}</span></a>`;
  },

  renderPlayerCell(r, isMobile = false) {
    const name = r && r.name ? String(r.name) : '';
    const safeName = this._escAttr(name);
    const rawCode = Number((r && r.code) || 0);
    const fallbackCode = (r && Number(r.id) > 0) ? Number(r.id) : 0;
    const pCode = (rawCode > 0 ? rawCode : fallbackCode) > 0 ? String(rawCode > 0 ? rawCode : fallbackCode) : null;

    const profileLink = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerProfileLink === 'function')
      ? fcmDataLoader.getPlayerProfileLink({ name, code: pCode, id: (r && (r.playerId || r.id)) || null, season: r && r.seasonNum })
      : (pCode ? `#schede_giocatori?cod=${encodeURIComponent(pCode)}` : `#schede_giocatori?name=${encodeURIComponent(name)}`);

    const photoSrc = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPlayerPhoto === 'function')
      ? fcmDataLoader.getPlayerPhoto(name, pCode)
      : (pCode ? `img/foto/${pCode}.jpg` : 'img/foto/misterx.gif');

    const serieARaw = String((r && r.serieA) || '').trim();
    const serieALogo = (serieARaw && typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getSerieALogo === 'function')
      ? fcmDataLoader.getSerieALogo(serieARaw)
      : '';
    const showClubBadge = Boolean(serieALogo && !serieALogo.endsWith('undefined.svg'));
    const safeClub = this._escAttr(serieARaw);
    const titleAttr = `Apri scheda di ${safeName}${serieARaw ? ` (${safeClub})` : ''}`;

    const cellCls = isMobile ? 'hist-player-cell topcosti-card-player' : 'hist-player-cell';
    const avatarCls = showClubBadge ? 'hist-player-avatar-link has-club-badge' : 'hist-player-avatar-link';
    const nameCls = isMobile ? 'hist-player-name-link topcosti-card-name' : 'hist-player-name-link';

    return `
      <div class="${cellCls}">
        <a href="${this._escAttr(profileLink)}" class="${avatarCls}" aria-label="Apri scheda di ${safeName}" title="${titleAttr}">
          <img src="${this._escAttr(photoSrc)}" class="hist-player-thumb" alt="" loading="lazy" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" />
          ${showClubBadge ? `<img src="${this._escAttr(serieALogo)}" class="hist-player-club-badge" alt="" aria-hidden="true" title="${safeClub}" loading="lazy" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/i,'.jpg');}else{this.style.display='none';}" />` : ''}
        </a>
        <a href="${this._escAttr(profileLink)}" class="${nameCls}" title="${titleAttr}">${safeName}</a>
      </div>
    `;
  },

  async render(container) {
    const hash = window.location.hash || '';
    const baseHash = hash.split('?')[0];

    if (baseHash === '#topcostistagione') {
      this.currentTab = 'stagione';
    } else if (baseHash === '#topcosti') {
      this.currentTab = 'storico';
    }

    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq') || params.has('team')) {
        const pId = parseInt(params.get('fsq') || params.get('Fsq') || params.get('team'), 10);
        if (!isNaN(pId)) this.currentTeamId = pId;
      } else {
        this.currentTeamId = 0;
      }
      if (params.has('tab')) {
        const t = params.get('tab');
        if (t === 'storico' || t === 'stagione') this.currentTab = t;
      }
    } else {
      this.currentTeamId = 0;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              Top Costi
            </div>
            <div class="card-subtitle">I calciatori più pagati alle aste di mercato all-time e nell'annata corrente</div>
          </div>
        </div>

        <!-- Subtab Switcher: Storico vs Stagione -->
        <div class="pill-tabs topcosti-subtabs" id="topCostiSubtabs" style="margin-bottom:20px;">
          <button class="pill-btn ${this.currentTab === 'storico' ? 'active' : ''}" data-tab="storico">
            💰 Storico All-Time
          </button>
          <button class="pill-btn ${this.currentTab === 'stagione' ? 'active' : ''}" data-tab="stagione">
            🏷️ Stagione Corrente
          </button>
        </div>

        <div id="topCostiContent">
          ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.table({ cols: 4, rows: 8, withToolbar: true, toolbarPills: 4 }) : `
            <div class="text-center" style="padding:30px;color:var(--text-muted);">
              Caricamento Top Costi...
            </div>
          `}
        </div>
      </div>
    `;

    // Subtab switch events
    const subContainer = container.querySelector('#topCostiContent');
    container.querySelectorAll('#topCostiSubtabs button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const newTab = btn.getAttribute('data-tab');
        if (this.currentTab === newTab) return;
        this.currentTab = newTab;
        container.querySelectorAll('#topCostiSubtabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.history && window.history.replaceState) {
          const base = newTab === 'stagione' ? '#topcostistagione' : '#topcosti';
          window.history.replaceState(null, '', this.currentTeamId > 0 ? `${base}?fsq=${this.currentTeamId}` : base);
        }
        this.renderTopCosti(subContainer);
      });
    });

    await this.renderTopCosti(subContainer);
  },

  async renderTopCosti(subContainer) {
    const costiData = await fcmDataLoader.loadTopCosti();
    if (!costiData || !costiData.teams) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati Top Costi non disponibili.</div>`;
      return;
    }

    const teamById = new Map(costiData.teams.map(t => [Number(t.id), t]));

    if (this.currentTeamId > 0) {
      const match = costiData.teams.find(t => t.id === this.currentTeamId || t.idAttuale === this.currentTeamId || t.currentId === this.currentTeamId);
      if (match) {
        this.currentTeamId = match.id;
      }
    }

    const isCurrent = this.currentTab === 'stagione';
    const limit = this.currentRole === 'ALL' ? 20 : 15;
    const records = costiData.getTopCosti(this.currentTeamId, this.currentRole, isCurrent, limit);
    const selectedTeamObj = this.currentTeamId > 0 ? (teamById.get(Number(this.currentTeamId)) || null) : null;
    const selectedTeamCurrentId = Number(selectedTeamObj ? (selectedTeamObj.currentId || selectedTeamObj.idAttuale || 0) : 0);
    const selectedTeamUrl = selectedTeamObj
      ? (selectedTeamCurrentId > 0
        ? `#rose?team=${selectedTeamCurrentId}`
        : (records.length > 0 ? this.getRowRosterUrl(records[0], teamById, isCurrent) : `#rose?albo=${selectedTeamObj.id}`))
      : '';
    const emptyColspan = 7 + (this.currentTeamId === 0 ? 1 : 0) + (!isCurrent ? 1 : 0);

    subContainer.innerHTML = `
      <style>
        .topcosti-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
          background: var(--bg-surface-elevated);
          padding: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }
        .topcosti-team-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .topcosti-team-select {
          min-width: 240px;
          font-weight: 700;
        }
        .topcosti-subtabs {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
        }
        .topcosti-role-tabs {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .topcosti-desktop-view {
          display: block !important;
        }
        .topcosti-mobile-view {
          display: none !important;
        }

        @media (max-width: 768px) {
          .topcosti-desktop-view {
            display: none !important;
          }
          .topcosti-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }

          .topcosti-subtabs {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px !important;
            border-radius: var(--radius-lg, 12px) !important;
            padding: 6px !important;
            background: var(--bg-surface-elevated) !important;
          }
          .topcosti-subtabs .pill-btn {
            width: 100% !important;
            text-align: center !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 0.82rem !important;
            font-weight: 700 !important;
            border-radius: var(--radius-md, 8px) !important;
          }

          .topcosti-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
            gap: 12px !important;
          }
          .topcosti-team-group {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .topcosti-team-select {
            width: 100% !important;
            min-width: 0 !important;
          }

          /* Griglia a 6 colonne per disporre 3 tab nella 1ª riga e 2 nella 2ª riga */
          .topcosti-role-tabs {
            display: grid !important;
            grid-template-columns: repeat(6, 1fr) !important;
            gap: 6px !important;
            width: 100% !important;
            border-radius: var(--radius-lg, 12px) !important;
            padding: 6px !important;
            background: var(--bg-surface-elevated) !important;
            box-sizing: border-box !important;
          }
          .topcosti-role-tabs .pill-btn {
            width: 100% !important;
            min-width: 0 !important;
            text-align: center !important;
            justify-content: center !important;
            display: inline-flex !important;
            align-items: center !important;
            padding: 8px 4px !important;
            font-size: 0.74rem !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
            border-radius: var(--radius-md, 8px) !important;
            box-sizing: border-box !important;
          }
          .topcosti-role-tabs .pill-btn:nth-child(1),
          .topcosti-role-tabs .pill-btn:nth-child(2),
          .topcosti-role-tabs .pill-btn:nth-child(3) {
            grid-column: span 2 !important;
          }
          .topcosti-role-tabs .pill-btn:nth-child(4),
          .topcosti-role-tabs .pill-btn:nth-child(5) {
            grid-column: span 3 !important;
          }

          /* Mobile Cards for Top Costi */
          .topcosti-card-item {
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-sizing: border-box;
          }
          .topcosti-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .topcosti-card-left {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            flex: 1;
          }
          .topcosti-card-player {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            flex: 1;
          }
          .topcosti-card-rank {
            font-weight: 800;
            color: var(--accent-gold);
            font-size: 0.8rem;
            min-width: 22px;
            text-align: center;
            flex-shrink: 0;
          }
          .topcosti-card-name {
            font-weight: 700;
            font-size: 0.88rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .topcosti-card-subinfo {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            color: var(--text-secondary);
            flex-wrap: wrap;
          }
          .topcosti-card-stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            padding-block-start: 6px;
            border-top: 1px solid var(--border-subtle);
            font-size: 0.78rem;
          }
          .topcosti-stat-pill {
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            min-inline-size: 0;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding-block: 4px;
            padding-inline: 7px;
            box-sizing: border-box;
          }
          .topcosti-cost-pill {
            flex-shrink: 0;
          }
          .topcosti-stat-label {
            font-size: 0.7rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
          }
          .topcosti-stat-val {
            font-weight: 800;
            font-size: 0.85rem;
            white-space: nowrap;
          }
        }
      </style>

      <!-- Toolbar: Squadra Select + Role Tabs -->
      <div class="topcosti-toolbar">
        <div class="topcosti-team-group">
          <label for="costiTeamSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.04em;">
            Fantasquadra:
          </label>
          <select id="costiTeamSelect" class="form-select topcosti-team-select">
            <option value="0" ${this.currentTeamId === 0 ? 'selected' : ''}>** TOTALE LEGA (Tutte) **</option>
            ${costiData.teams.map(t => {
      const isFav = typeof fcmHomeConfigManager !== 'undefined' && (fcmHomeConfigManager.isFavoriteTeam(t.id) || fcmHomeConfigManager.isFavoriteTeam(t.name));
      return `
              <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>
                ${isFav ? '⭐ ' : ''}${t.name}
              </option>
            `;
    }).join('')}
          </select>
          ${selectedTeamObj ? `
            <a href="${this._escAttr(selectedTeamUrl)}" class="hist-team-link topcosti-toolbar-team-link" title="Apri rosa di ${this._escAttr(selectedTeamObj.name)}">
              ${this.renderTeamShirtMarkup(selectedTeamObj.name, selectedTeamObj.currentId || selectedTeamObj.id, selectedTeamObj.id, '', 'topcosti-toolbar-team-shirt')}
              <span class="hist-team-name-text">${this._escAttr(selectedTeamObj.name)}</span>
            </a>
          ` : ''}
        </div>

        <!-- Role Filter Tabs (3 in riga 1, 2 in riga 2 su mobile) -->
        <div class="pill-tabs topcosti-role-tabs" id="costiRoleTabs">
          <button class="pill-btn ${this.currentRole === 'ALL' ? 'active' : ''}" data-role="ALL">
            🏆 Top Assoluti
          </button>
          <button class="pill-btn ${this.currentRole === 'P' ? 'active' : ''}" data-role="P">
            🧤 Portieri
          </button>
          <button class="pill-btn ${this.currentRole === 'D' ? 'active' : ''}" data-role="D">
            🛡️ Difensori
          </button>
          <button class="pill-btn ${this.currentRole === 'C' ? 'active' : ''}" data-role="C">
            ⚙️ Centrocampisti
          </button>
          <button class="pill-btn ${this.currentRole === 'A' ? 'active' : ''}" data-role="A">
            ⚡ Attaccanti
          </button>
        </div>
      </div>

      <!-- Table Results: Desktop View -->
      <div class="topcosti-desktop-view table-responsive" tabindex="0" role="region" aria-label="Classifica Top Costi d'Asta — ${isCurrent ? 'Stagione Corrente' : 'Storico All-Time'}">
        <table class="modern-table topcosti-table">
          <thead>
            <tr>
              <th style="width:50px;" class="text-center">#</th>
              <th class="text-center" style="width:60px;">Ruolo</th>
              <th>Giocatore</th>
              ${this.currentTeamId === 0 ? `<th>Fantasquadra</th>` : ''}
              ${!isCurrent ? `<th class="text-center">Stagione</th>` : ''}
              <th class="text-center" style="min-width:90px;">Costo Asta</th>
              <th class="text-center">PRES</th>
              <th class="text-center">MV</th>
              <th class="text-center">FM</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr>
                <td colspan="${emptyColspan}" class="text-center text-muted" style="padding:24px;">
                  Nessun calciatore trovato per i parametri selezionati.
                </td>
              </tr>
            ` : ''}
            ${records.map((r, idx) => {
      const isFav = typeof fcmHomeConfigManager !== 'undefined' && (fcmHomeConfigManager.isFavoriteTeam(r.teamId) || fcmHomeConfigManager.isFavoriteTeam(r.teamName));
      const roleVal = r.role || r.roleShort || 'C';
      const rosterUrl = this.currentTeamId === 0 ? this.getRowRosterUrl(r, teamById, isCurrent) : '';
      const presVal = (r.appearances !== undefined && r.appearances !== null && r.appearances !== '') ? r.appearances : '-';
      return `
              <tr class="${isFav ? 'table-row-favorite' : ''}">
                <td class="text-center font-bold">
                  <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">
                    ${idx + 1}
                  </span>
                </td>
                <td class="text-center">
                  <span class="role-badge role-${roleVal.toLowerCase()}">${roleVal}</span>
                </td>
                <td class="col-player">${this.renderPlayerCell(r, false)}</td>
                ${this.currentTeamId === 0 ? `<td>${this.renderTeamLink(r, rosterUrl, isFav, '', isCurrent)}</td>` : ''}
                ${!isCurrent ? `<td class="text-center font-bold" style="font-size:0.8rem;color:var(--text-muted);">${this._escAttr(r.season)}</td>` : ''}
                <td class="text-center font-bold" style="color:var(--accent-gold);font-size:1.1rem;">
                  💰 ${r.cost}
                </td>
                <td class="text-center">${presVal}</td>
                <td class="text-center">${r.mv}</td>
                <td class="text-center font-bold" style="color:var(--accent-cyan);">${r.fmv}</td>
              </tr>
            `;
    }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile View: Card Responsive Senza Scroll Orizzontale -->
      <div class="topcosti-mobile-view">
        ${records.length === 0 ? `
          <div class="text-center text-muted" style="padding:24px;background:var(--bg-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
            Nessun calciatore trovato per i parametri selezionati.
          </div>
        ` : ''}
        ${records.map((r, idx) => {
      const isFav = typeof fcmHomeConfigManager !== 'undefined' && (fcmHomeConfigManager.isFavoriteTeam(r.teamId) || fcmHomeConfigManager.isFavoriteTeam(r.teamName));
      const roleVal = r.role || r.roleShort || 'C';
      const rosterUrl = this.currentTeamId === 0 ? this.getRowRosterUrl(r, teamById, isCurrent) : '';
      const showSubinfo = (this.currentTeamId === 0) || !isCurrent;
      const presVal = (r.appearances !== undefined && r.appearances !== null && r.appearances !== '') ? r.appearances : '-';
      return `
          <div class="topcosti-card-item ${isFav ? 'match-card-favorite' : ''}">
            <!-- Header: Posizione, Ruolo, Minifoto+Club, Nome Linkato e Costo d'Asta -->
            <div class="topcosti-card-header">
              <div class="topcosti-card-left">
                <span class="topcosti-card-rank">#${idx + 1}</span>
                <span class="role-badge role-${roleVal.toLowerCase()}">${roleVal}</span>
                ${this.renderPlayerCell(r, true)}
              </div>
              <div class="topcosti-stat-pill topcosti-cost-pill" style="border-color:rgba(245,158,11,0.4);">
                <span class="topcosti-stat-label">Asta</span>
                <span class="topcosti-stat-val" style="color:var(--accent-gold);font-size:0.95rem;">💰 ${r.cost}</span>
              </div>
            </div>

            ${showSubinfo ? `
            <!-- Subinfo: Fantasquadra con maglia/link (se Totale Lega) e Stagione (solo su Storico) -->
            <div class="topcosti-card-subinfo">
              ${this.currentTeamId === 0 ? this.renderTeamLink(r, rosterUrl, isFav, 'topcosti-card-team-link', isCurrent) : ''}
              ${(this.currentTeamId === 0 && !isCurrent) ? '<span>&bull;</span>' : ''}
              ${!isCurrent ? `<span style="font-weight:600;color:var(--text-muted);">${this._escAttr(r.season)}</span>` : ''}
            </div>
            ` : ''}

            <!-- Stats Bar: PRES, MV, FM -->
            <div class="topcosti-card-stats">
              <div class="topcosti-stat-pill">
                <span class="topcosti-stat-label">PRES</span>
                <span class="topcosti-stat-val">${presVal}</span>
              </div>
              <div class="topcosti-stat-pill">
                <span class="topcosti-stat-label">MV</span>
                <span class="topcosti-stat-val">${r.mv}</span>
              </div>
              <div class="topcosti-stat-pill" style="border-color:rgba(6,182,212,0.3);">
                <span class="topcosti-stat-label">FM</span>
                <span class="topcosti-stat-val" style="color:var(--accent-cyan);">${r.fmv}</span>
              </div>
            </div>
          </div>
        `;
    }).join('')}
      </div>
    `;

    // Event: Team select
    subContainer.querySelector('#costiTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      if (window.history && window.history.replaceState) {
        const base = isCurrent ? '#topcostistagione' : '#topcosti';
        window.history.replaceState(null, '', this.currentTeamId > 0 ? `${base}?fsq=${this.currentTeamId}` : base);
      }
      this.renderTopCosti(subContainer);
    });

    // Event: Role tabs
    subContainer.querySelectorAll('#costiRoleTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentRole = btn.getAttribute('data-role');
        this.renderTopCosti(subContainer);
      });
    });
  }
};

if (typeof window !== 'undefined') {
  window.topCostiView = topCostiView;
}
