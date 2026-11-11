/**
 * INVERTICALENDARIO VIEW ("Se avessi avuto...")
 * Modulo standalone per l'analisi incrociata dei calendari (InvertiCalendario).
 * Calcola e visualizza i punti che ciascuna squadra avrebbe ottenuto adottando il calendario di ogni avversaria.
 * Motore nativo integrato basato su FCMCalcoloMotore e regolamento di lega FCM.
 *
 * ModernFCM
 */

const inverticalendarioView = {
  currentGironeId: null,
  incrociMode: null, // 'squadra' (mobile-first), 'classifica' (panoramica), 'matrice' (tabella completa)
  incrociSelectedTeam: 0,
  incrociSort: 'default', // 'default', 'pts_desc'
  incrociExpandedTeam: null,

  /**
   * Verifica se la squadra fornita è la squadra del cuore impostata
   */
  isFavoriteTeam(teamIdentifier) {
    if (!teamIdentifier || typeof fcmHomeConfigManager === 'undefined') return false;
    if (typeof teamIdentifier === 'object') {
      return fcmHomeConfigManager.isFavoriteTeam(teamIdentifier.id) ||
             fcmHomeConfigManager.isFavoriteTeam(teamIdentifier.team) ||
             fcmHomeConfigManager.isFavoriteTeam(teamIdentifier.name) ||
             fcmHomeConfigManager.isFavoriteTeam(teamIdentifier);
    }
    return fcmHomeConfigManager.isFavoriteTeam(teamIdentifier);
  },

  /**
   * Restituisce l'indice della squadra del cuore tra le squadre del girone (se impostata)
   */
  getFavoriteTeamIndex(teamsData) {
    if (typeof fcmHomeConfigManager !== 'undefined' && fcmHomeConfigManager.hasFavoriteTeam()) {
      const favIdx = teamsData.findIndex(t => this.isFavoriteTeam(t));
      if (favIdx >= 0) return favIdx;
    }
    return 0;
  },

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('girone') || params.has('g')) {
        const gId = parseInt(params.get('girone') || params.get('g'), 10);
        if (!isNaN(gId) && gId > 0) this.currentGironeId = gId;
      }
      if (params.has('mode') || params.has('tab') || params.has('vista')) {
        const m = (params.get('mode') || params.get('tab') || params.get('vista')).toLowerCase();
        if (['squadra', 'classifica', 'matrice'].includes(m)) this.incrociMode = m;
      }
    }

    // Mostra indicatore di caricamento nel layout card standard
    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>Se avessi avuto...</span>
            </div>
            <div class="card-subtitle">Simulazione dei calendari e della fortuna di lega</div>
          </div>
        </div>
        <div id="extraPageContent">
          ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.table({ cols: 6, rows: 8, withToolbar: true, toolbarPills: 3 }) : `
          <div class="text-center" style="padding:40px 20px;color:var(--text-muted);">
            <div class="spinner-border text-primary" role="status" style="width:2rem;height:2rem;margin-bottom:12px;"></div>
            <div style="font-weight:700;color:var(--text-primary);font-size:1rem;">Calcolo simulazione calendari in corso...</div>
            <div style="font-size:0.8rem;margin-top:4px;">Elaborazione tabellini ufficiali con FCMCalcoloMotore</div>
          </div>
          `}
        </div>
      </div>
    `;

    // Calcolo dati nativo
    let incrociData = null;
    try {
      incrociData = await fcmDataLoader.computeIncrociData(this.currentGironeId);
    } catch (e) {
      console.error('[inverticalendarioView] Errore calcolo incroci:', e);
    }

    if (!incrociData || !incrociData.teams || incrociData.teams.length === 0) {
      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="display:flex;align-items:center;gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>Se avessi avuto...</span>
            </div>
            <div class="card-subtitle">Simulazione dei calendari e della fortuna di lega</div>
          </div>
          <div id="extraPageContent">
            <div class="text-center" style="padding:30px;color:var(--text-muted);">
              Dati incrocio calendari non disponibili per la competizione selezionata.
            </div>
          </div>
        </div>
      `;
      return;
    }

    this.currentGironeId = incrociData.gironeId;

    const N = incrociData.teams.length;
    const teamsData = [];
    const scheduleStats = [];

    // Calcolo statistiche per ciascuna squadra (in ordine crescente di ID come da arrFantasquadre)
    for (let i = 0; i < N; i++) {
      const teamObj = incrociData.teams[i];
      const teamName = teamObj.name;
      const realPts = (incrociData.matrix[i] && incrociData.matrix[i][i] !== undefined)
        ? incrociData.matrix[i][i]
        : teamObj.realPts;
      let sumRow = 0;
      let sumCol = 0;
      const scenarios = [];

      for (let j = 0; j < N; j++) {
        const oppTeam = incrociData.teams[j].name;
        const pts = (incrociData.matrix[i] && incrociData.matrix[i][j] !== undefined)
          ? incrociData.matrix[i][j]
          : 0;
        const diff = pts - realPts;
        const oppColPts = (incrociData.matrix[j] && incrociData.matrix[j][i] !== undefined)
          ? incrociData.matrix[j][i]
          : 0;
        sumRow += pts;
        sumCol += oppColPts;

        scenarios.push({
          oppIndex: j,
          oppTeam: oppTeam,
          pts: pts,
          diff: diff,
          isOwn: (i === j)
        });
      }

      const avgPts = sumRow / N;
      const luckDiff = realPts - avgPts;

      let best = scenarios[0];
      let worst = scenarios[0];
      for (const sc of scenarios) {
        if (sc.pts > best.pts) best = sc;
        if (sc.pts < worst.pts) worst = sc;
      }

      teamsData.push({
        index: i,
        id: teamObj.id,
        team: teamName,
        realPts: realPts,
        avgPts: avgPts,
        luckDiff: luckDiff,
        best: best,
        worst: worst,
        scenarios: scenarios
      });

      scheduleStats.push({
        index: i,
        team: teamName,
        killerAvg: sumCol / N
      });
    }

    // Ordinamento fortuna (decrescente: chi ha guadagnato più punti in cima)
    const sortedLuck = [...teamsData].sort((a, b) => b.luckDiff - a.luckDiff);
    // Ordinamento difficoltà calendario (decrescente: chi ha regalato più punti è il calendario più facile)
    const sortedSchedule = [...scheduleStats].sort((a, b) => b.killerAvg - a.killerAvg);

    const luckiest = sortedLuck.filter(s => Math.abs(s.luckDiff - sortedLuck[0].luckDiff) < 0.05);
    const unluckiest = sortedLuck.filter(s => Math.abs(s.luckDiff - sortedLuck[sortedLuck.length - 1].luckDiff) < 0.05);
    const easiest = sortedSchedule.filter(s => Math.abs(s.killerAvg - sortedSchedule[0].killerAvg) < 0.05);
    const hardest = sortedSchedule.filter(s => Math.abs(s.killerAvg - sortedSchedule[sortedSchedule.length - 1].killerAvg) < 0.05);

    // Auto-detect modalità: mobile (< 768px) default 'squadra', desktop default 'matrice'
    if (!this.incrociMode) {
      this.incrociMode = (window.innerWidth < 768) ? 'squadra' : 'matrice';
    }

    // Se la modalità attiva è 'squadra' ed è impostata la squadra del cuore, mostriamo quella
    if (this.incrociMode === 'squadra') {
      this.incrociSelectedTeam = this.getFavoriteTeamIndex(teamsData);
    } else if (this.incrociSelectedTeam < 0 || this.incrociSelectedTeam >= N) {
      this.incrociSelectedTeam = this.getFavoriteTeamIndex(teamsData);
    }

    const self = this;

    const renderContent = () => {
      const mode = self.incrociMode;
      const curr = teamsData[self.incrociSelectedTeam] || teamsData[0];

      // Helper per i badge differenziali punti
      const getDiffTag = (diff, isOwn) => {
        if (isOwn) {
          return `<span class="cell-matrix cell-own incroci-diff-tag">★ Reale</span>`;
        } else if (diff > 0) {
          return `<span class="cell-matrix cell-better incroci-diff-tag">+${diff} pt ▲</span>`;
        } else if (diff < 0) {
          return `<span class="cell-matrix cell-worse incroci-diff-tag">${diff} pt ▼</span>`;
        } else {
          return `<span class="cell-matrix cell-equal incroci-diff-tag">= 0 pt</span>`;
        }
      };

      // 1. Vista "Per Squadra" (zero scrolling orizzontale, mobile-first)
      const renderSquadraView = () => {
        let listScenarios = [...curr.scenarios];
        if (self.incrociSort === 'pts_desc') {
          listScenarios.sort((a, b) => b.pts - a.pts);
        }

        const isFavCurr = self.isFavoriteTeam(curr);

        const luckStatus = curr.luckDiff > 0.05
          ? `<span style="color:var(--accent-emerald);">+${curr.luckDiff.toFixed(1)} pt</span><span style="font-size:0.7rem;color:var(--accent-emerald);font-weight:600;">🍀 Fortunata</span>`
          : (curr.luckDiff < -0.05
            ? `<span style="color:var(--accent-rose);">${curr.luckDiff.toFixed(1)} pt</span><span style="font-size:0.7rem;color:var(--accent-rose);font-weight:600;">🌧️ Sfortunata</span>`
            : `<span>= 0.0 pt</span><span style="font-size:0.7rem;color:var(--text-muted);font-weight:600;">⚖️ Neutra</span>`);

        return `
          <!-- Team Selector -->
          <div class="incroci-team-picker">
            <div style="font-size:0.85rem;font-weight:700;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <span>Fantasquadra in esame:</span>
            </div>
            <div class="incroci-nav-arrows">
              <button type="button" class="incroci-nav-btn incroci-prev-btn" title="Squadra precedente" aria-label="Squadra precedente">‹</button>
              <select id="incrociTeamSelect" class="form-select" style="font-weight:700;font-size:0.95rem;padding:7px 12px;border-radius:var(--radius-md);min-width:180px;">
                ${teamsData.map(t => {
                  const isFavOpt = self.isFavoriteTeam(t);
                  return `<option value="${t.index}" ${t.index === curr.index ? 'selected' : ''}>${isFavOpt ? '⭐ ' : ''}${t.team} (${t.realPts} pt)</option>`;
                }).join('')}
              </select>
              <button type="button" class="incroci-nav-btn incroci-next-btn" title="Squadra successiva" aria-label="Squadra successiva">›</button>
            </div>
          </div>

          <!-- Hero Summary Card -->
          <div class="incroci-hero-card">
            <div class="incroci-hero-header">
              <div class="incroci-team-profile">
                <img src="${fcmDataLoader.getTeamLogo(curr.team)}" class="incroci-team-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${curr.team}" />
                <div>
                  <h3 style="margin:0;font-size:1.25rem;font-weight:800;color:var(--text-primary);line-height:1.2;display:flex;align-items:center;gap:6px;">
                    ${isFavCurr ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span>${curr.team}</span>
                  </h3>
                  <div style="font-size:0.78rem;color:var(--text-muted);">Simulazione punti con tutti i calendari</div>
                </div>
              </div>
              <span class="cell-matrix cell-own" style="font-size:0.92rem;padding:6px 14px;border-radius:var(--radius-full);">
                ${curr.realPts} pt Reali
              </span>
            </div>

            <!-- Stats Grid -->
            <div class="incroci-stats-grid">
              <div class="incroci-stat-box">
                <div class="incroci-stat-label">Punti Reali</div>
                <div class="incroci-stat-value" style="color:var(--accent-primary);">${curr.realPts}</div>
              </div>
              <div class="incroci-stat-box">
                <div class="incroci-stat-label">Media Simulazioni</div>
                <div class="incroci-stat-value">${curr.avgPts.toFixed(1)}</div>
              </div>
              <div class="incroci-stat-box">
                <div class="incroci-stat-label">Bilancio Fortuna</div>
                <div class="incroci-stat-value" style="display:flex;flex-direction:column;align-items:center;line-height:1.1;">
                  ${luckStatus}
                </div>
              </div>
            </div>

            <!-- Best & Worst Scenarios -->
            <div class="incroci-scenarios-row">
              <div style="flex:1;min-width:180px;">
                <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">🏆 Miglior Calendario:</span>
                <div style="font-weight:700;color:var(--text-primary);margin-top:2px;">
                  ${self.isFavoriteTeam(curr.best.oppTeam) ? '⭐ ' : ''}${curr.best.oppTeam} &rarr; <span style="color:var(--accent-emerald);font-weight:800;">${curr.best.pts} pt</span>
                  <span style="font-size:0.75rem;color:var(--accent-emerald);">(+${curr.best.diff} pt)</span>
                </div>
              </div>
              <div style="flex:1;min-width:180px;">
                <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">⚠️ Peggior Calendario:</span>
                <div style="font-weight:700;color:var(--text-primary);margin-top:2px;">
                  ${self.isFavoriteTeam(curr.worst.oppTeam) ? '⭐ ' : ''}${curr.worst.oppTeam} &rarr; <span style="color:var(--accent-rose);font-weight:800;">${curr.worst.pts} pt</span>
                  <span style="font-size:0.75rem;color:var(--accent-rose);">(${curr.worst.diff} pt)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Schedule List -->
          <div class="incroci-list-container">
            <div class="incroci-list-toolbar">
              <span style="font-weight:600;">Risultati con i ${N} calendari:</span>
              <div class="incroci-sort-btns">
                <button type="button" class="incroci-sort-btn ${self.incrociSort === 'default' ? 'active' : ''}" data-incroci-sort="default">
                  Calendario
                </button>
                <button type="button" class="incroci-sort-btn ${self.incrociSort === 'pts_desc' ? 'active' : ''}" data-incroci-sort="pts_desc">
                  Più Punti
                </button>
              </div>
            </div>

            ${listScenarios.map(sc => {
              const isFavSc = self.isFavoriteTeam(sc.oppTeam);
              return `
                <div class="incroci-schedule-item ${sc.isOwn ? 'is-own' : ''}">
                  <div class="incroci-opponent-info">
                    <img src="${fcmDataLoader.getTeamLogo(sc.oppTeam)}" class="incroci-opponent-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${sc.oppTeam}" />
                    <div style="min-width:0;">
                      <div class="incroci-opponent-name" style="display:flex;align-items:center;gap:4px;">
                        ${isFavSc ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}<span>${sc.oppTeam}</span>
                      </div>
                      <div class="incroci-opponent-sub">${sc.isOwn ? '★ Il tuo calendario effettivo' : 'Calendario di ' + sc.oppTeam}</div>
                    </div>
                  </div>
                  <div class="incroci-schedule-score">
                    <div class="incroci-pts-badge">${sc.pts} <span style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">pt</span></div>
                    ${getDiffTag(sc.diff, sc.isOwn)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      };

      // 2. Vista "Classifica Fortuna" (accordion su richiesta)
      const renderClassificaView = () => {
        return `
          <div style="margin-bottom:12px;font-size:0.82rem;color:var(--text-secondary);">
            Classifica della <strong>fortuna di lega</strong> (punti reali conquistati vs media ottenibile con tutti i calendari). Tocca una riga per espandere il dettaglio o aprire la scheda.
          </div>
          <div class="incroci-ranking-wrapper">
            <div class="incroci-ranking-header">
              <span>#</span>
              <span>Squadra</span>
              <span style="text-align:center;">Reali</span>
              <span style="text-align:center;">Media</span>
              <span style="text-align:center;">Fortuna</span>
              <span></span>
            </div>
            ${sortedLuck.map((t, rank) => {
              const isExpanded = self.incrociExpandedTeam === t.index;
              const isFav = self.isFavoriteTeam(t);
              const luckBadge = t.luckDiff > 0.05
                ? `<span class="cell-matrix cell-better" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">+${t.luckDiff.toFixed(1)}</span>`
                : (t.luckDiff < -0.05
                  ? `<span class="cell-matrix cell-worse" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">${t.luckDiff.toFixed(1)}</span>`
                  : `<span class="cell-matrix cell-equal" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">0.0</span>`);

              return `
                <div class="incroci-ranking-row ${isExpanded ? 'is-active' : ''} ${isFav ? 'table-row-favorite' : ''}" data-incroci-toggle="${t.index}" title="Tocca per espandere il dettaglio">
                  <span style="font-weight:700;color:var(--text-muted);">${rank + 1}</span>
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <img src="${fcmDataLoader.getTeamLogo(t.team)}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                    <span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${t.team}
                    </span>
                  </div>
                  <span style="text-align:center;font-weight:800;">${t.realPts}</span>
                  <span style="text-align:center;color:var(--text-secondary);font-size:0.82rem;">${t.avgPts.toFixed(1)}</span>
                  <div style="text-align:center;">${luckBadge}</div>
                  <span style="text-align:center;color:var(--text-muted);font-size:0.75rem;">${isExpanded ? '▲' : '▼'}</span>
                </div>
                ${isExpanded ? `
                  <div class="incroci-accordion-panel">
                    <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;">
                      <div style="font-size:0.8rem;color:var(--text-secondary);">
                        🍀 <strong>Migliore:</strong> ${self.isFavoriteTeam(t.best.oppTeam) ? '⭐ ' : ''}${t.best.oppTeam} (<strong>${t.best.pts} pt</strong>, +${t.best.diff}) &nbsp;|&nbsp;
                        🌧️ <strong>Peggiore:</strong> ${self.isFavoriteTeam(t.worst.oppTeam) ? '⭐ ' : ''}${t.worst.oppTeam} (<strong>${t.worst.pts} pt</strong>, ${t.worst.diff})
                      </div>
                      <button type="button" class="incroci-jump-btn" data-team-index="${t.index}">
                        👤 Scheda Completa ${t.team} →
                      </button>
                    </div>
                    <div class="incroci-chips-grid">
                      ${t.scenarios.map(sc => {
                        let cls = 'cell-equal';
                        let sign = '=';
                        if (sc.isOwn) { cls = 'cell-own'; sign = '★'; }
                        else if (sc.diff > 0) { cls = 'cell-better'; sign = `+${sc.diff}`; }
                        else if (sc.diff < 0) { cls = 'cell-worse'; sign = `${sc.diff}`; }
                        const isFavChip = self.isFavoriteTeam(sc.oppTeam);
                        return `
                          <div class="cell-matrix ${cls} incroci-mini-chip" title="Con calendario di ${sc.oppTeam}: ${sc.pts} pt">
                            <span>${isFavChip ? '⭐ ' : ''}${sc.oppTeam.length > 6 ? sc.oppTeam.slice(0, 5) + '.' : sc.oppTeam}:</span>
                            <span>${sc.pts} pt (${sign})</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
              `;
            }).join('')}
          </div>
        `;
      };

      // 3. Vista "Matrice Completa" (tabella incrociata con prima colonna bloccata)
      const renderMatriceView = () => {
        return `
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
              💡 <i>Suggerimento: puoi scorrere la tabella orizzontalmente. La colonna con le squadre a sinistra resta sempre bloccata.</i>
            </div>
            <div class="table-responsive" style="margin-bottom:24px;">
              <table class="modern-table incroci-matrix-table">
                <thead>
                  <tr>
                    <th style="min-width:140px;">La tua Fantasquadra ↓</th>
                    ${teamsData.map(t => {
                      const isFavCol = self.isFavoriteTeam(t);
                      return `
                        <th class="text-center" style="font-size:0.72rem;padding:8px 4px;min-width:56px;${isFavCol ? 'color:var(--accent-gold);' : ''}" title="Calendario di ${t.team}">
                          ${isFavCol ? '⭐ ' : ''}${t.team.length > 8 ? t.team.slice(0, 7) + '.' : t.team}
                        </th>
                      `;
                    }).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${teamsData.map((t, idx) => {
                    const isFav = self.isFavoriteTeam(t);
                    const own = incrociData.matrix[idx] ? incrociData.matrix[idx][idx] : 0;
                    return `
                      <tr class="${isFav ? 'table-row-favorite' : ''}">
                        <td class="font-bold incroci-clickable-team" data-team-index="${idx}" title="Clicca per aprire la scheda di ${t.team}" style="white-space:nowrap;">
                          <span style="display:inline-flex;align-items:center;gap:6px;">
                            <img src="${fcmDataLoader.getTeamLogo(t.team)}" style="width:18px;height:18px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                            ${isFav ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${t.team}
                          </span>
                        </td>
                        ${incrociData.matrix[idx] ? incrociData.matrix[idx].map((pts, cIdx) => {
                          let cellCls = 'cell-matrix ';
                          if (cIdx === idx) {
                            cellCls += 'cell-own';
                          } else if (pts > own) {
                            cellCls += 'cell-better';
                          } else if (pts < own) {
                            cellCls += 'cell-worse';
                          } else {
                            cellCls += 'cell-equal';
                          }
                          return `
                            <td class="${cellCls}" title="${t.team} con calendario di ${teamsData[cIdx].team}: ${pts} pt (reali: ${own} pt)">
                              ${pts}
                            </td>
                          `;
                        }).join('') : ''}
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      };

      // Template Principale Esterno
      container.innerHTML = `
        <div class="card">
          <!-- Header con Titolo, Sottotitolo e Selettore Girone -->
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="card-title" style="display:flex;align-items:center;gap:8px;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Se avessi avuto...</span>
              </div>
              <div class="card-subtitle">Simulazione dei calendari e della fortuna di lega</div>
            </div>

            ${(incrociData.allItalianaGironi && incrociData.allItalianaGironi.length > 1) ? `
              <div>
                <select id="inverticalGironeSelect" class="form-select" style="font-weight:700;font-size:0.85rem;padding:6px 12px;border-radius:var(--radius-md);min-width:200px;">
                  ${incrociData.allItalianaGironi.map(g => `
                    <option value="${g.id}" ${g.id === incrociData.gironeId ? 'selected' : ''}>${g.label}</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <div id="extraPageContent">
            <div class="incroci-container">
              <!-- Description & Mode Switcher Toolbar -->
              <div class="incroci-nav-bar">
                <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;max-width:560px;">
                  La simulazione <i>"Se avessi avuto il calendario di..."</i> calcola quanti punti avrebbe conquistato ciascuna squadra affrontando il calendario di ogni avversaria.
                </p>
                <div class="pill-tabs incroci-mode-tabs" role="tablist">
                  <button type="button" class="pill-btn ${mode === 'squadra' ? 'active' : ''}" data-incroci-mode="squadra">
                    👤 Per Squadra
                  </button>
                  <button type="button" class="pill-btn ${mode === 'classifica' ? 'active' : ''}" data-incroci-mode="classifica">
                    📊 Classifica Fortuna
                  </button>
                  <button type="button" class="pill-btn ${mode === 'matrice' ? 'active' : ''}" data-incroci-mode="matrice">
                    ▦ Matrice Completa
                  </button>
                </div>
              </div>

              <!-- Legend Bar (always visible) -->
              <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.75rem;font-weight:700;margin-bottom:8px;">
                <span class="cell-matrix cell-better" style="padding:4px 8px;border-radius:var(--radius-xs);">▲ Più Punti</span>
                <span class="cell-matrix cell-equal" style="padding:4px 8px;border-radius:var(--radius-xs);">= Stessi Punti</span>
                <span class="cell-matrix cell-worse" style="padding:4px 8px;border-radius:var(--radius-xs);">▼ Meno Punti</span>
                <span class="cell-matrix cell-own" style="padding:4px 8px;border-radius:var(--radius-xs);">★ Punti Reali</span>
              </div>

              <!-- Dynamic Active View -->
              <div id="incrociDynamicView">
                ${mode === 'squadra' ? renderSquadraView() : (mode === 'classifica' ? renderClassificaView() : renderMatriceView())}
              </div>

              <!-- 4 Highlights Cards (Luck & Schedule Difficulty) -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:12px;">
                <!-- 1. Luckiest -->
                <div class="card" style="padding:16px;border-left:4px solid var(--accent-emerald);margin-bottom:0;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.2rem;">🍀</span>
                    <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Squadra Più Fortunata</span>
                  </div>
                  ${luckiest.map(l => {
                    const isFavL = self.isFavoriteTeam(l);
                    return `
                      <div class="font-bold incroci-clickable-team" data-team-index="${l.index}" title="Clicca per aprire la scheda di ${l.team}" style="font-size:1.1rem;color:var(--accent-emerald);margin-bottom:4px;">
                        ${isFavL ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${l.team}
                      </div>
                      <div style="font-size:0.78rem;color:var(--text-secondary);">
                        <strong>${l.realPts} pt</strong> reali (<strong>+${l.luckDiff.toFixed(1)} pt</strong> rispetto alla media di ${l.avgPts.toFixed(1)})
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- 2. Unluckiest -->
                <div class="card" style="padding:16px;border-left:4px solid var(--accent-rose);margin-bottom:0;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.2rem;">🌧️</span>
                    <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Squadra Più Sfortunata</span>
                  </div>
                  ${unluckiest.map(u => {
                    const isFavU = self.isFavoriteTeam(u);
                    return `
                      <div class="font-bold incroci-clickable-team" data-team-index="${u.index}" title="Clicca per aprire la scheda di ${u.team}" style="font-size:1.1rem;color:var(--accent-rose);margin-bottom:4px;">
                        ${isFavU ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${u.team}
                      </div>
                      <div style="font-size:0.78rem;color:var(--text-secondary);">
                        <strong>${u.realPts} pt</strong> reali (<strong>${u.luckDiff.toFixed(1)} pt</strong> rispetto alla media di ${u.avgPts.toFixed(1)})
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- 3. Easiest Schedule -->
                <div class="card" style="padding:16px;border-left:4px solid var(--accent-cyan);margin-bottom:0;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.2rem;">🎯</span>
                    <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Calendario Più Facile</span>
                  </div>
                  ${easiest.map(e => {
                    const isFavE = self.isFavoriteTeam(e);
                    return `
                      <div class="font-bold incroci-clickable-team" data-team-index="${e.index}" title="Clicca per aprire la scheda di ${e.team}" style="font-size:1.1rem;color:var(--accent-cyan);margin-bottom:4px;">
                        ${isFavE ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${e.team}
                      </div>
                      <div style="font-size:0.78rem;color:var(--text-secondary);">
                        Le fantasquadre avrebbero totalizzato <strong>${e.killerAvg.toFixed(1)} pt</strong> di media
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- 4. Hardest Schedule -->
                <div class="card" style="padding:16px;border-left:4px solid var(--accent-gold);margin-bottom:0;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.2rem;">🔥</span>
                    <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Calendario Più Ostico</span>
                  </div>
                  ${hardest.map(h => {
                    const isFavH = self.isFavoriteTeam(h);
                    return `
                      <div class="font-bold incroci-clickable-team" data-team-index="${h.index}" title="Clicca per aprire la scheda di ${h.team}" style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:4px;">
                        ${isFavH ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${h.team}
                      </div>
                      <div style="font-size:0.78rem;color:var(--text-secondary);">
                        Le fantasquadre avrebbero totalizzato solo <strong>${h.killerAvg.toFixed(1)} pt</strong> di media
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      attachEvents();
    };

    const attachEvents = () => {
      // 1. Cambio Girone nel Selettore
      const gironeSelect = container.querySelector('#inverticalGironeSelect');
      if (gironeSelect) {
        gironeSelect.addEventListener('change', async (e) => {
          const newGId = parseInt(e.target.value, 10);
          if (!isNaN(newGId)) {
            self.currentGironeId = newGId;
            self.incrociSelectedTeam = 0;
            self.incrociExpandedTeam = null;
            await self.render(container);
          }
        });
      }

      // 2. Switch Modalità Tabs
      container.querySelectorAll('[data-incroci-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const newMode = btn.getAttribute('data-incroci-mode');
          if (newMode && newMode !== self.incrociMode) {
            self.incrociMode = newMode;
            // Quando viene selezionato il tab "Per Squadra" ed è impostata una squadra del cuore, viene mostrata quella
            if (newMode === 'squadra') {
              self.incrociSelectedTeam = self.getFavoriteTeamIndex(teamsData);
            }
            renderContent();
          }
        });
      });

      // 3. Selezione Squadra in Vista "Per Squadra"
      const teamSelect = container.querySelector('#incrociTeamSelect');
      if (teamSelect) {
        teamSelect.addEventListener('change', (e) => {
          self.incrociSelectedTeam = parseInt(e.target.value, 10) || 0;
          renderContent();
        });
      }

      // Frecce precedente/successivo squadra
      const prevBtn = container.querySelector('.incroci-prev-btn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          self.incrociSelectedTeam = (self.incrociSelectedTeam - 1 + N) % N;
          renderContent();
        });
      }

      const nextBtn = container.querySelector('.incroci-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          self.incrociSelectedTeam = (self.incrociSelectedTeam + 1) % N;
          renderContent();
        });
      }

      // 4. Pulsanti Ordinamento (Calendario / Più Punti)
      container.querySelectorAll('[data-incroci-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
          self.incrociSort = btn.getAttribute('data-incroci-sort');
          renderContent();
        });
      });

      // 5. Accordion Toggle in Classifica Fortuna
      container.querySelectorAll('[data-incroci-toggle]').forEach(row => {
        row.addEventListener('click', () => {
          const idx = parseInt(row.getAttribute('data-incroci-toggle'), 10);
          self.incrociExpandedTeam = (self.incrociExpandedTeam === idx) ? null : idx;
          renderContent();
        });
      });

      // 6. Click Squadra per passare a Vista "Per Squadra"
      container.querySelectorAll('[data-team-index], .incroci-jump-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(el.getAttribute('data-team-index'), 10);
          if (!isNaN(idx)) {
            self.incrociSelectedTeam = idx;
            self.incrociMode = 'squadra';
            renderContent();
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    };

    renderContent();
  }
};

window.inverticalendarioView = inverticalendarioView;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = inverticalendarioView;
}
