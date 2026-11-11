/**
 * ETA' ROSE VIEW
 * Statistiche anagrafiche, età media, altezza e peso delle fantasquadre.
 * Supporta la stagione corrente (integrata con arrRose / arrFantasquadre)
 * e l'archivio storico di tutte le stagioni disponibili (sqlite/).
 * ModernFCM
 */

const etaRoseView = {
  currentSeasonId: null,   // null = stagione corrente determinata da fcmLegaDati.js
  etaTeamId: null,         // ID fantasquadra selezionata
  etaSortKey: 'avgAge',    // 'teamName', 'avgAge', 'avgHeight', 'avgWeight'
  etaSortAsc: true,        // true = crescente, false = decrescente
  container: null,

  /**
   * Render principale della vista #etaRose
   */
  async render(container) {
    this.container = container;

    // Lettura parametri da URL hash se presenti (es. #etaRose?season=14&team=3)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('season') || params.has('stagione')) {
        const sId = parseInt(params.get('season') || params.get('stagione'), 10);
        if (!isNaN(sId) && sId > 0) this.currentSeasonId = sId;
      }
      if (params.has('team') || params.has('fsq') || params.has('teamId')) {
        const tId = parseInt(params.get('team') || params.get('fsq') || params.get('teamId'), 10);
        if (!isNaN(tId) && tId > 0) this.etaTeamId = tId;
      }
    }

    // Mostra stato di caricamento iniziale se necessario
    if (!container.querySelector('#etaRoseContent')) {
      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="card-title" style="display:flex;align-items:center;gap:10px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 7v5l3 2"></path>
                  <path d="M8 3l-2-2M16 3l2-2"></path>
                </svg>
                Età &amp; Dati Rose
              </div>
              <div class="card-subtitle">Dati anagrafici, altezza, peso e statistiche delle rose</div>
            </div>
          </div>
          <div id="etaRoseContent">
            ${(typeof fcmSkeleton !== 'undefined') ? `
              <div style="display:flex;flex-direction:column;gap:16px;padding:14px;">
                <div class="skeleton-toolbar">
                  <div class="skeleton skeleton-btn" style="width:180px;"></div>
                  <div class="skeleton skeleton-btn" style="width:200px;"></div>
                </div>
                ${fcmSkeleton.heroKpi(3)}
                <div class="skeleton-table-wrap">
                  <div class="skeleton-table-head">
                    <div class="skeleton skeleton-text w-25" style="margin-bottom:0;"></div>
                    <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
                    <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
                    <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
                  </div>
                  ${Array(6).fill(0).map(() => `
                    <div class="skeleton-table-row">
                      <div class="skeleton skeleton-text w-25" style="margin-bottom:0;"></div>
                      <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
                      <div class="skeleton skeleton-text w-20" style="margin-bottom:0;"></div>
                      <div class="skeleton skeleton-text w-15" style="margin-bottom:0;"></div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : `
              <div style="padding:30px;" class="text-center">
                <div style="color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:10px;">
                  <span class="spinner" style="display:inline-block;width:20px;height:20px;border:2px solid var(--border-subtle);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 0.8s linear infinite;"></span>
                  Caricamento dati anagrafici e statistiche rose...
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    }

    const contentEl = container.querySelector('#etaRoseContent') || container;

    // Caricamento parallelo di stagioni disponibili e squadre per la stagione richiesta
    const [seasons, squads] = await Promise.all([
      fcmDataLoader.loadStagioni(),
      fcmDataLoader.loadSquadreEta(this.currentSeasonId)
    ]);

    if (!squads || squads.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state" style="padding:40px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:10px;">📉</div>
          <div style="font-weight:700;font-size:1.1rem;color:var(--text-primary);margin-bottom:6px;">Dati anagrafici non disponibili</div>
          <p style="color:var(--text-muted);font-size:0.85rem;max-width:400px;margin:0 auto 16px;">
            Nessun calciatore o fantasquadra trovata per la stagione selezionata.
          </p>
          ${seasons && seasons.length > 0 ? `
            <button class="btn btn-secondary" onclick="etaRoseView.changeSeason(${seasons[0].id})">
              Torna alla stagione ${seasons[0].id} (${seasons[0].anni_stagione || seasons[0].anno})
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    // Informazioni stagione attiva e riferimento temporale
    const activeSquad0 = squads[0];
    const isCurrentSeason = !!activeSquad0.isCurrentSeason;
    const activeSeasonId = activeSquad0.seasonId || this.currentSeasonId || (seasons[0] ? seasons[0].id : 14);
    const refDate = activeSquad0.refDate || new Date();

    let refBadgeHtml = '';
    if (isCurrentSeason) {
      const todayFormatted = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      refBadgeHtml = `
        <span class="badge" style="background:rgba(16, 185, 129, 0.12);color:var(--accent-emerald);border:1px solid rgba(16, 185, 129, 0.28);font-size:0.75rem;padding:5px 10px;border-radius:var(--radius-sm);display:inline-flex;align-items:center;gap:5px;font-weight:600;" title="Età calcolata in tempo reale alla data odierna">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Età calcolata ad oggi (${todayFormatted})
        </span>
      `;
    } else {
      const refYear = refDate.getFullYear();
      refBadgeHtml = `
        <span class="badge" style="background:rgba(245, 158, 11, 0.12);color:var(--accent-gold);border:1px solid rgba(245, 158, 11, 0.28);font-size:0.75rem;padding:5px 10px;border-radius:var(--radius-sm);display:inline-flex;align-items:center;gap:5px;font-weight:600;" title="Età ancorata storicamente al 31 dicembre ${refYear}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Età calcolata al 31/12/${refYear} (${activeSquad0.seasonLabel})
        </span>
      `;
    }

    // Risoluzione della fantasquadra attualmente visualizzata
    const favTeamId = (typeof fcmHomeConfigManager !== 'undefined') ? fcmHomeConfigManager.getFavoriteTeamId() : null;
    const currentSquad = (this.etaTeamId && squads.find(s => s.teamId === this.etaTeamId))
      || (favTeamId && squads.find(s => s.teamId === favTeamId))
      || squads[0];
    this.etaTeamId = currentSquad.teamId;

    if (!this.etaSortKey) this.etaSortKey = 'avgAge';
    if (this.etaSortAsc === undefined) this.etaSortAsc = true;

    // Ordinamento classifica età media
    const sortedSquads = [...squads].sort((a, b) => {
      let valA, valB;
      if (this.etaSortKey === 'teamName') {
        valA = a.teamName.toLowerCase();
        valB = b.teamName.toLowerCase();
        return this.etaSortAsc ? valA.localeCompare(valB) : valB.localeCompare(a.teamName.toLowerCase());
      } else if (this.etaSortKey === 'avgAge') {
        valA = parseFloat(a.avgAge) || 999;
        valB = parseFloat(b.avgAge) || 999;
      } else if (this.etaSortKey === 'avgHeight') {
        valA = (a.avgHeight && a.avgHeight !== '-') ? a.avgHeight : 0;
        valB = (b.avgHeight && b.avgHeight !== '-') ? b.avgHeight : 0;
      } else if (this.etaSortKey === 'avgWeight') {
        valA = (a.avgWeight && a.avgWeight !== '-') ? a.avgWeight : 0;
        valB = (b.avgWeight && b.avgWeight !== '-') ? b.avgWeight : 0;
      } else {
        valA = parseFloat(a.avgAge) || 999;
        valB = parseFloat(b.avgAge) || 999;
      }
      if (valA === valB) {
        return a.teamName.localeCompare(b.teamName);
      }
      return this.etaSortAsc ? valA - valB : valB - valA;
    });

    // Costruzione HTML
    container.innerHTML = `
      <div class="card">
        <!-- Testata Card con Titolo e Selettore Stagione -->
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border-subtle);">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:10px;font-size:1.25rem;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v5l3 2"></path>
                <path d="M8 3l-2-2M16 3l2-2"></path>
              </svg>
              Età &amp; Dati Rose
            </div>
            <div class="card-subtitle">Dati anagrafici, statistiche, altezza e peso delle fantasquadre</div>
          </div>

          <!-- Controlli Testata: Selettore Stagione e Badge Riferimento -->
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
            ${refBadgeHtml}
            ${seasons && seasons.length > 0 ? `
              <div style="display:flex;align-items:center;gap:6px;">
                <label for="selSeasonEta" style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">Stagione:</label>
                <select id="selSeasonEta" class="form-select" style="font-weight:700;min-width:190px;font-size:0.85rem;padding:6px 12px;border-radius:var(--radius-sm);">
                  ${seasons.map(s => {
                    const isSelected = s.id === activeSeasonId;
                    const isLatest = seasons[0] && s.id === seasons[0].id;
                    const label = `Stagione ${s.id} (${s.anni_stagione || s.anno})${isLatest ? ' • In corso' : ''}`;
                    return `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
                  }).join('')}
                </select>
              </div>
            ` : ''}
          </div>
        </div>

        <div id="etaRoseContent" style="padding:18px 20px;">
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">
            Statistiche anagrafiche ufficiali calcolate su tutti i calciatori tesserati in rosa per la <b>${activeSquad0.seasonLabel || 'Stagione ' + activeSeasonId}</b>.
          </p>

          <!-- 1. Classifica Età Media Fantasquadre -->
          <div class="card" style="margin-bottom:24px;border:1px solid var(--border-subtle);background:var(--bg-surface-elevated);border-radius:var(--radius-lg);overflow:hidden;">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border-subtle);">
              <div style="font-size:0.9rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;display:flex;align-items:center;gap:8px;letter-spacing:0.5px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 7v5l3 2"></path>
                </svg>
                Classifica Età Media Fantasquadre
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                <span>💡 Clicca su una riga per visualizzare il dettaglio squadra</span>
              </div>
            </div>
            <div class="table-responsive" style="margin:0;">
              <table class="modern-table eta-ranking-table">
                <thead>
                  <tr>
                    <th class="text-center" style="width:48px;" title="Posizione">#</th>
                    <th style="cursor:pointer;" onclick="etaRoseView.sortEtaTable('teamName')">
                      Fantasquadra ${this.etaSortKey === 'teamName' ? (this.etaSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="text-center" style="cursor:pointer;" onclick="etaRoseView.sortEtaTable('avgAge')">
                      Età Media ${this.etaSortKey === 'avgAge' ? (this.etaSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="desktop-only text-start">Più Giovane</th>
                    <th class="desktop-only text-start">Più Anziano</th>
                    <th class="desktop-only text-center" style="cursor:pointer;" onclick="etaRoseView.sortEtaTable('avgHeight')">
                      Alt. Media ${this.etaSortKey === 'avgHeight' ? (this.etaSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="desktop-only text-center" style="cursor:pointer;" onclick="etaRoseView.sortEtaTable('avgWeight')">
                      Peso Medio ${this.etaSortKey === 'avgWeight' ? (this.etaSortAsc ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedSquads.map((s, idx) => {
                    const isSelected = s.teamId === currentSquad.teamId;
                    const isFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(s.teamId || s.teamName);
                    let rankBadge = `<span class="eta-rank-badge">${idx + 1}</span>`;
                    if (idx === 0) rankBadge = `<span class="eta-rank-badge rank-1" title="1° Posto">🥇 1</span>`;
                    else if (idx === 1) rankBadge = `<span class="eta-rank-badge rank-2" title="2° Posto">🥈 2</span>`;
                    else if (idx === 2) rankBadge = `<span class="eta-rank-badge rank-3" title="3° Posto">🥉 3</span>`;

                    return `
                      <tr class="${isSelected ? 'row-selected' : ''}" onclick="etaRoseView.selectSquadEta(${s.teamId}, true)" title="Visualizza dettagli di ${s.teamName}">
                        <td class="text-center">${rankBadge}</td>
                        <td>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <img src="${fcmDataLoader.getTeamLogo(s.teamName || s.teamId)}" style="width:28px;height:28px;border-radius:4px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                            <div>
                              <span style="font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:4px;">
                                ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${s.teamName}
                              </span>
                              <span style="font-size:0.72rem;color:var(--text-muted);display:block;">${s.coach} • ${s.playersCount} Giocatori</span>
                            </div>
                          </div>
                        </td>
                        <td class="text-center font-bold" style="color:var(--accent-cyan);font-size:0.95rem;">
                          ${s.avgAge} <span style="font-size:0.75rem;font-weight:normal;color:var(--text-muted);">anni</span>
                        </td>
                        <td class="desktop-only text-start" style="font-size:0.8rem;" onclick="event.stopPropagation()">
                          ${s.youngest ? `
                            <div style="display:flex;align-items:center;gap:8px;">
                              <a href="${s.youngest.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${s.youngest.name}">
                                <img src="${s.youngest.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${s.youngest.name}" />
                                <img src="${s.youngest.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${s.youngest.serieATeam}" />
                              </a>
                              <div>
                                <a href="${s.youngest.linkHref}" class="eta-player-link" style="font-size:0.82rem;" title="Apri scheda di ${s.youngest.name}">${s.youngest.name}</a>
                                <a href="${s.youngest.linkHref}" style="text-decoration:none;display:block;" title="Apri scheda di ${s.youngest.name}">
                                  <span style="color:var(--accent-emerald);font-weight:600;display:block;font-size:0.72rem;">${s.youngest.ageExact ? s.youngest.ageExact.label : s.youngest.age + ' anni'}</span>
                                </a>
                              </div>
                            </div>
                          ` : '-'}
                        </td>
                        <td class="desktop-only text-start" style="font-size:0.8rem;" onclick="event.stopPropagation()">
                          ${s.oldest ? `
                            <div style="display:flex;align-items:center;gap:8px;">
                              <a href="${s.oldest.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${s.oldest.name}">
                                <img src="${s.oldest.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${s.oldest.name}" />
                                <img src="${s.oldest.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${s.oldest.serieATeam}" />
                              </a>
                              <div>
                                <a href="${s.oldest.linkHref}" class="eta-player-link" style="font-size:0.82rem;" title="Apri scheda di ${s.oldest.name}">${s.oldest.name}</a>
                                <a href="${s.oldest.linkHref}" style="text-decoration:none;display:block;" title="Apri scheda di ${s.oldest.name}">
                                  <span style="color:var(--accent-gold);font-weight:600;display:block;font-size:0.72rem;">${s.oldest.ageExact ? s.oldest.ageExact.label : s.oldest.age + ' anni'}</span>
                                </a>
                              </div>
                            </div>
                          ` : '-'}
                        </td>
                        <td class="desktop-only text-center" style="font-size:0.8rem;color:var(--text-muted);">
                          ${s.avgHeight !== '-' ? s.avgHeight + ' cm' : '-'}
                        </td>
                        <td class="desktop-only text-center" style="font-size:0.8rem;color:var(--text-muted);">
                          ${s.avgWeight !== '-' ? s.avgWeight + ' kg' : '-'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. Dettaglio Fantasquadra Selezionata -->
          <div id="squadEtaDetail" style="scroll-margin-top:80px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${fcmDataLoader.getTeamLogo(currentSquad.teamName || currentSquad.teamId)}" style="width:38px;height:38px;border-radius:6px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                <div>
                  <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                    <span>${(typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.isFavoriteTeam(currentSquad.teamId || currentSquad.teamName)) ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${currentSquad.teamName}</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">Presidente: <b>${currentSquad.coach}</b> • ${currentSquad.playersCount} Giocatori in rosa</div>
                </div>
              </div>

              <!-- Selettore Fantasquadra -->
              <div>
                <select id="selSquadEta" class="form-select" style="font-weight:700;min-width:180px;">
                  ${squads.map(s => {
                    const isFav = (typeof fcmHomeConfigManager !== 'undefined') && fcmHomeConfigManager.isFavoriteTeam(s.teamId || s.teamName);
                    return `
                      <option value="${s.teamId}" ${s.teamId === currentSquad.teamId ? 'selected' : ''}>${isFav ? '⭐ ' : ''}${s.teamName}</option>
                    `;
                  }).join('')}
                </select>
              </div>
            </div>

            <!-- Griglia Highlights (Età, Giovane, Anziano, Più Alto, Più Basso, Medie) -->
            <div class="squad-highlights-grid" style="display:grid;gap:12px;margin-bottom:20px;">
              <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">📊 Età Media Rosa</div>
                <div style="font-size:1.35rem;font-weight:800;color:var(--accent-cyan);">${currentSquad.avgAge} anni</div>
              </div>

              ${currentSquad.youngest ? `
                <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                  <div>
                    <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;">👶 Più Giovane</div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <a href="${currentSquad.youngest.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${currentSquad.youngest.name}">
                        <img src="${currentSquad.youngest.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${currentSquad.youngest.name}" />
                        <img src="${currentSquad.youngest.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${currentSquad.youngest.serieATeam}" />
                      </a>
                      <a href="${currentSquad.youngest.linkHref}" class="eta-player-link eta-highlight-name" title="Apri scheda di ${currentSquad.youngest.name}">${currentSquad.youngest.name}</a>
                    </div>
                  </div>
                  <div>
                    <a href="${currentSquad.youngest.linkHref}" style="text-decoration:none;" title="Apri scheda di ${currentSquad.youngest.name}">
                      <div style="font-size:0.78rem;color:var(--accent-emerald);font-weight:700;">${currentSquad.youngest.ageExact ? currentSquad.youngest.ageExact.label : currentSquad.youngest.age + ' anni'}</div>
                    </a>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${currentSquad.youngest.birthDate}</div>
                  </div>
                </div>
              ` : ''}

              ${currentSquad.oldest ? `
                <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                  <div>
                    <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;">👴 Più Anziano</div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <a href="${currentSquad.oldest.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${currentSquad.oldest.name}">
                        <img src="${currentSquad.oldest.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${currentSquad.oldest.name}" />
                        <img src="${currentSquad.oldest.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${currentSquad.oldest.serieATeam}" />
                      </a>
                      <a href="${currentSquad.oldest.linkHref}" class="eta-player-link eta-highlight-name" title="Apri scheda di ${currentSquad.oldest.name}">${currentSquad.oldest.name}</a>
                    </div>
                  </div>
                  <div>
                    <a href="${currentSquad.oldest.linkHref}" style="text-decoration:none;" title="Apri scheda di ${currentSquad.oldest.name}">
                      <div style="font-size:0.78rem;color:var(--accent-gold);font-weight:700;">${currentSquad.oldest.ageExact ? currentSquad.oldest.ageExact.label : currentSquad.oldest.age + ' anni'}</div>
                    </a>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${currentSquad.oldest.birthDate}</div>
                  </div>
                </div>
              ` : ''}

              <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                <div>
                  <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;">📏 Più Alto</div>
                  ${currentSquad.tallestList && currentSquad.tallestList.length ? currentSquad.tallestList.map(p => `
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                      <a href="${p.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${p.name}">
                        <img src="${p.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${p.name}" />
                        <img src="${p.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${p.serieATeam}" />
                      </a>
                      <a href="${p.linkHref}" class="eta-player-link eta-highlight-name" title="Apri scheda di ${p.name}">${p.name}</a>
                    </div>
                  `).join('') : '<div style="font-size:0.85rem;color:var(--text-muted);">-</div>'}
                </div>
                <div>
                  <div style="font-size:0.85rem;color:var(--accent-cyan);font-weight:800;margin-top:2px;">${currentSquad.maxHeight ? currentSquad.maxHeight + ' cm' : 'N.D.'}</div>
                </div>
              </div>

              <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                <div>
                  <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;">📐 Più Basso</div>
                  ${currentSquad.shortestList && currentSquad.shortestList.length ? currentSquad.shortestList.map(p => `
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                      <a href="${p.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${p.name}">
                        <img src="${p.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${p.name}" />
                        <img src="${p.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${p.serieATeam}" />
                      </a>
                      <a href="${p.linkHref}" class="eta-player-link eta-highlight-name" title="Apri scheda di ${p.name}">${p.name}</a>
                    </div>
                  `).join('') : '<div style="font-size:0.85rem;color:var(--text-muted);">-</div>'}
                </div>
                <div>
                  <div style="font-size:0.85rem;color:var(--accent-cyan);font-weight:800;margin-top:2px;">${currentSquad.minHeight ? currentSquad.minHeight + ' cm' : 'N.D.'}</div>
                </div>
              </div>

              <div style="background:var(--bg-main);padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:space-between;">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">⚖️ Altezza / Peso Medi</div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary);margin-top:2px;">
                  ${currentSquad.avgHeight !== '-' ? currentSquad.avgHeight + ' cm' : '-'} • ${currentSquad.avgWeight !== '-' ? currentSquad.avgWeight + ' kg' : '-'}
                </div>
              </div>
            </div>

            <!-- 3. Distribuzione Anni di Nascita -->
            <div style="margin-bottom:20px;padding:14px 16px;background:var(--bg-main);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <div style="font-size:0.8rem;font-weight:800;color:var(--accent-cyan);text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;letter-spacing:0.5px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                DISTRIBUZIONE ANNI DI NASCITA
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;">
                ${(currentSquad.birthYearDistribution && currentSquad.birthYearDistribution.length > 0) ? currentSquad.birthYearDistribution.map(item => `
                  <span class="birth-year-chip" title="${item.year} (${item.count}): ${item.players.map(p => p.name).join(', ')}" style="display:inline-flex;align-items:baseline;gap:5px;font-size:0.88rem;cursor:default;">
                    <strong style="color:var(--accent-cyan);font-family:var(--font-mono, monospace);">${item.year}:</strong>
                    <span style="font-weight:700;color:var(--text-primary);">${item.count}</span>
                  </span>
                `).join('') : '<span style="font-size:0.8rem;color:var(--text-muted);">Dati non disponibili</span>'}
              </div>
            </div>

            <!-- 4. Rosa Calciatori (Tabella Desktop & Schede Mobile) -->
            <!-- 4a. Tabella Desktop -->
            <div class="table-responsive eta-roster-desktop">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th class="text-center" style="width:40px;">R</th>
                    <th>Calciatore</th>
                    <th class="text-start">Club Serie A</th>
                    <th>Luogo di Nascita</th>
                    <th class="text-center">Data di Nascita</th>
                    <th class="text-center">Età</th>
                    <th class="text-center">Altezza</th>
                    <th class="text-center">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentSquad.players.map(p => `
                    <tr>
                      <td class="text-center">
                        <span class="role-badge ${p.roleClass}">${p.roleShort}</span>
                      </td>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <a href="${p.linkHref}" style="display:inline-flex;flex-shrink:0;" title="Apri scheda di ${p.name}">
                            <img src="${p.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${p.name}" />
                          </a>
                          <a href="${p.linkHref}" class="eta-player-link" title="Apri scheda di ${p.name}">
                            ${p.name}
                          </a>
                        </div>
                      </td>
                      <td class="text-start">
                        <a href="${p.linkHref}" style="display:inline-flex;align-items:center;gap:7px;text-decoration:none;" title="Apri scheda di ${p.name}">
                          <img src="${p.serieALogo}" class="eta-club-logo" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${p.serieATeam}" />
                          <span style="font-size:0.82rem;color:var(--text-secondary);font-weight:600;">${p.serieATeam}</span>
                        </a>
                      </td>
                      <td style="font-size:0.8rem;color:var(--text-muted);">
                        ${p.birthPlace}
                      </td>
                      <td class="text-center" style="font-size:0.8rem;">
                        ${p.birthDate}
                      </td>
                      <td class="text-center font-bold" style="color:var(--accent-cyan);" title="${p.ageExact ? p.ageExact.label : ''}">
                        ${p.age !== null ? p.age : '-'}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.8rem;">
                        ${p.height ? p.height + ' cm' : '-'}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.8rem;">
                        ${p.weight ? p.weight + ' kg' : '-'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- 4b. Schede Mobile (visibili su schermi <= 768px) -->
            <div class="eta-roster-mobile">
              ${currentSquad.players.map(p => `
                <div class="eta-mobile-player-card">
                  <div class="eta-mpc-top">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                      <span class="role-badge ${p.roleClass}" style="flex-shrink:0;">${p.roleShort}</span>
                      <a href="${p.linkHref}" class="eta-player-avatar-badge" title="Apri scheda di ${p.name}">
                        <img src="${p.photoUrl}" class="eta-player-thumb" onerror="this.onerror=null;this.src='img/foto/misterx.gif';" alt="${p.name}" />
                        <img src="${p.serieALogo}" class="eta-club-badge" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${p.serieATeam}" />
                      </a>
                      <div style="min-width:0;flex:1;">
                        <a href="${p.linkHref}" class="eta-player-link eta-mpc-name" title="Apri scheda di ${p.name}">${p.name}</a>
                        <div class="eta-mpc-club">
                          <img src="${p.serieALogo}" class="eta-club-logo" style="width:14px;height:14px;" onerror="this.onerror=null;this.src='img/sq/undefined.svg';" alt="${p.serieATeam}" />
                          <span>${p.serieATeam}</span>
                        </div>
                      </div>
                    </div>
                    <div class="eta-mpc-age-box" title="${p.ageExact ? p.ageExact.label : ''}">
                      <div class="eta-mpc-age-num">${p.age !== null ? p.age : '-'}</div>
                      <div class="eta-mpc-age-label">anni</div>
                    </div>
                  </div>
                  <div class="eta-mpc-details">
                    <div class="eta-mpc-detail-item">
                      <span class="eta-mpc-detail-lbl">Nascita</span>
                      <span class="eta-mpc-detail-val">${p.birthDate !== 'N.D.' ? p.birthDate : '-'}</span>
                    </div>
                    <div class="eta-mpc-detail-item">
                      <span class="eta-mpc-detail-lbl">Luogo</span>
                      <span class="eta-mpc-detail-val">${p.birthPlace !== 'N.D.' ? p.birthPlace : '-'}</span>
                    </div>
                    <div class="eta-mpc-detail-item">
                      <span class="eta-mpc-detail-lbl">Altezza</span>
                      <span class="eta-mpc-detail-val">${p.height ? p.height + ' cm' : '-'}</span>
                    </div>
                    <div class="eta-mpc-detail-item">
                      <span class="eta-mpc-detail-lbl">Peso</span>
                      <span class="eta-mpc-detail-val">${p.weight ? p.weight + ' kg' : '-'}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;

    // Binding eventi: selettore stagione
    container.querySelector('#selSeasonEta')?.addEventListener('change', (e) => {
      this.changeSeason(e.target.value);
    });

    // Binding eventi: selettore squadra
    container.querySelector('#selSquadEta')?.addEventListener('change', (e) => {
      this.selectSquadEta(parseInt(e.target.value, 10), false);
    });
  },

  /**
   * Cambio stagione attiva
   */
  changeSeason(seasonId) {
    this.currentSeasonId = parseInt(seasonId, 10);
    this.etaTeamId = null; // Resetta la squadra per riallinearsi alla prima o preferita della nuova stagione
    if (this.container) {
      this.render(this.container);
    }
  },

  /**
   * Ordinamento dinamico colonne classifica
   */
  sortEtaTable(key) {
    if (this.etaSortKey === key) {
      this.etaSortAsc = !this.etaSortAsc;
    } else {
      this.etaSortKey = key;
      this.etaSortAsc = (key === 'teamName') ? true : true;
    }
    if (this.container) {
      this.render(this.container);
    }
  },

  /**
   * Selezione della squadra da visualizzare in dettaglio
   */
  selectSquadEta(teamId, shouldScroll = false) {
    this.etaTeamId = parseInt(teamId, 10);
    if (this.container) {
      this.render(this.container).then(() => {
        if (shouldScroll) {
          const detailEl = document.getElementById('squadEtaDetail');
          if (detailEl) {
            detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }
  }
};

// Esportazione per browser e moduli CommonJS
if (typeof window !== 'undefined') {
  window.etaRoseView = etaRoseView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = etaRoseView;
}

