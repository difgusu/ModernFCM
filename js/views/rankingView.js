/**
 * RANKING STORICO VIEW
 * Perpetual ranking and historical coefficients
 * ModernFCM
 */

const rankingView = {
  filterCurrentOnly: false,
  filterMinPoints: false,
  showLegend: false,

  /**
   * Helper: Build trophy badges dynamically from arrPalmares in persjs/fcmConfrontiDati.js
   */
  buildTrophies(item) {
    const trophies = [];
    if (typeof arrPalmares !== 'undefined') {
      for (let i = 1; i < arrPalmares.length; i++) {
        const pal = arrPalmares[i];
        if (!pal || !pal.Competizione) continue;
        const count = item.trophies ? item.trophies[pal.Competizione] : 0;
        if (count && count > 0) {
          const iconFile = (typeof fcmDataLoader !== 'undefined' && fcmDataLoader._compLogosMap && fcmDataLoader._compLogosMap[pal.Competizione]) || pal.Icona || pal.icon || 'ico-coppa.gif';
          const iconSrc = `img/${iconFile}`;
          const smallSrc = /^ico-(scudetto|coppa|supercoppa|gp)\.gif$/i.test(iconFile) ? `img/small-${iconFile}` : 'img/ico-coppa.gif';
          trophies.push(`<span class="trophy-badge" title="${count} ${pal.Label}"><img src="${iconSrc}" onerror="this.onerror=null;this.src='${smallSrc}';" alt="${pal.Label}" /> ${count}</span>`);
        }
      }
    }
    return trophies;
  },

  async render(container) {
    this.rootContainer = container;

    if (typeof arrPalmares === 'undefined') {
      try {
        await fcmDataLoader.loadConfronti();
      } catch (e) {
        console.warn('Could not load confronti historical data', e);
      }
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Ranking Storico
            </div>
            <div class="card-subtitle">Classifica perpetua per coefficienti storici, trofei e rendimento</div>
          </div>

          <!-- Pulsanti Header: Impostazioni Storico & Legenda -->
          <div class="pill-tabs" style="margin-bottom:0;display:inline-flex;align-items:center;">
            <a href="inc/impostazioni.php#ranking" class="pill-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;" title="Impostazioni Ranking &amp; Storico">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Impostazioni</span>
            </a>
            <button type="button" id="btnToggleLegend" class="pill-btn ${this.showLegend ? 'active' : ''}" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span id="btnToggleLegendText">${this.showLegend ? 'Nascondi Legenda' : 'Legenda'}</span>
            </button>
          </div>
        </div>

        <div id="rankingContent">
          ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.table({ cols: 6, rows: 8, withToolbar: false }) : `
            <div class="text-center" style="padding:30px;color:var(--text-muted);">
              Caricamento dati ranking...
            </div>
          `}
        </div>
      </div>
    `;

    this.bindLegendToggle();

    const rankingContent = container.querySelector('#rankingContent');
    await this.renderRankingTable(rankingContent);
  },

  bindLegendToggle() {
    const root = this.rootContainer || document;
    const btnLegends = root.querySelectorAll('.btnToggleLegend, #btnToggleLegend');
    const btnLegendTexts = root.querySelectorAll('.btnToggleLegendText, #btnToggleLegendText');

    btnLegends.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        this.showLegend = !this.showLegend;
        const currentLegendCard = root.querySelector('#rankingLegendCard');
        if (currentLegendCard) {
          currentLegendCard.style.display = this.showLegend ? 'block' : 'none';
        }
        btnLegends.forEach(b => b.classList.toggle('active', this.showLegend));
        btnLegendTexts.forEach(txt => {
          txt.textContent = this.showLegend ? 'Nascondi Legenda' : 'Legenda';
        });
      };
    });
  },

  async renderRankingTable(container) {
    if (typeof arrPalmares === 'undefined') {
      try {
        await fcmDataLoader.loadConfronti();
      } catch (e) { }
    }

    const rankingData = await fcmDataLoader.loadRanking();

    // Generazione dinamica leggenda criteri ranking
    const cachedRaw = fcmDataLoader._cachedRankingData || {};
    const palmaresList = (cachedRaw.palmares && cachedRaw.palmares.length) ? cachedRaw.palmares : (window.arrPalmares ? window.arrPalmares.filter(Boolean) : []);
    const rankCfg = cachedRaw.config || {};

    let placementLegendHtml = '';
    let matchesLegendHtml = '';

    const formatGoal = (g) => {
      const num = parseFloat(g) || 0;
      return num > 0 ? `+${num}` : `${num}`;
    };

    if (palmaresList && palmaresList.length > 0) {
      palmaresList.forEach(pal => {
        const cId = pal.id || pal.Competizione || pal.compId;
        const cName = pal.Label || pal.label || pal.Nome || pal.name || `Competizione ${cId}`;
        const pConf = (rankCfg.placement && rankCfg.placement[cId]) || {};
        const pParts = [];
        if (pConf[1]) pParts.push(`1°: <b>${pConf[1]} pt</b>`);
        if (pConf[2]) pParts.push(`2°: <b>${pConf[2]} pt</b>`);
        if (pConf[3]) pParts.push(`3°: <b>${pConf[3]} pt</b>`);
        if (pConf[4]) pParts.push(`4°: <b>${pConf[4]} pt</b>`);

        if (pParts.length > 0) {
          placementLegendHtml += `
            <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
              <b style="color:var(--text-primary);">${cName}:</b>
              <div style="color:var(--text-secondary);margin-top:2px;">${pParts.join(' • ')}</div>
            </div>
          `;
        }

        const mConf = (rankCfg.matches && rankCfg.matches[cId]);
        if (mConf) {
          const getVenue = (vKey) => {
            const vObj = mConf[vKey] || mConf;
            return {
              win: vObj.win !== undefined ? parseFloat(vObj.win) : 2.0,
              draw: vObj.draw !== undefined ? parseFloat(vObj.draw) : 1.2,
              loss: vObj.loss !== undefined ? parseFloat(vObj.loss) : 0.0,
              gf: vObj.gf !== undefined ? parseFloat(vObj.gf) : parseFloat(rankCfg.goals?.gf ?? 1.3),
              gs: vObj.gs !== undefined ? parseFloat(vObj.gs) : parseFloat(rankCfg.goals?.gs ?? -1.3)
            };
          };

          const vH = getVenue('home');
          const vA = getVenue('away');
          const vN = getVenue('neutral');

          if (vH.win > 0 || vH.draw > 0 || vA.win > 0 || vA.draw > 0 || vN.win > 0 || vN.draw > 0) {
            const areEqual = (
              vH.win === vA.win && vH.win === vN.win &&
              vH.draw === vA.draw && vH.draw === vN.draw &&
              vH.loss === vA.loss && vH.loss === vN.loss &&
              vH.gf === vA.gf && vH.gf === vN.gf &&
              vH.gs === vA.gs && vH.gs === vN.gs
            );

            if (areEqual) {
              matchesLegendHtml += `
                <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <b style="color:var(--text-primary);font-size:0.8rem;">${cName}:</b>
                    <span style="font-size:0.68rem;color:var(--text-muted);font-style:italic;">Casa / Trasf / Neutro identici</span>
                  </div>
                  <div style="color:var(--text-secondary);margin-top:4px;font-size:0.75rem;">
                    V <b>${vH.win}</b> • P <b>${vH.draw}</b> • S <b>${vH.loss}</b> pt | Reti: <span style="color:var(--accent-emerald);font-weight:600;">${formatGoal(vH.gf)}</span> / <span style="color:var(--accent-crimson);font-weight:600;">${formatGoal(vH.gs)}</span> pt
                  </div>
                </div>
              `;
            } else {
              matchesLegendHtml += `
                <div style="background:var(--bg-main);padding:8px 10px;border-radius:var(--radius-sm);border-left:3px solid var(--accent-emerald);border-top:1px solid var(--border-subtle);border-right:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    <b style="color:var(--text-primary);font-size:0.8rem;">${cName}:</b>
                    <span style="font-size:0.68rem;color:var(--accent-emerald);background:rgba(16,185,129,0.12);padding:2px 8px;border-radius:var(--radius-full);font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                      ⚡ Punteggi differenziati per sede
                    </span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:6px;font-size:0.75rem;">
                    <div style="background:var(--bg-surface);padding:6px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                      <div style="font-weight:700;color:var(--text-primary);margin-bottom:2px;display:flex;align-items:center;gap:4px;">
                        <span>🏠 In Casa</span>
                      </div>
                      <div style="color:var(--text-secondary);">
                        V <b>${vH.win}</b> • P <b>${vH.draw}</b> • S <b>${vH.loss}</b> pt
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
                        Reti: <span style="color:var(--accent-emerald);font-weight:600;">${formatGoal(vH.gf)}</span> / <span style="color:var(--accent-crimson);font-weight:600;">${formatGoal(vH.gs)}</span> pt
                      </div>
                    </div>
                    <div style="background:var(--bg-surface);padding:6px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                      <div style="font-weight:700;color:var(--text-primary);margin-bottom:2px;display:flex;align-items:center;gap:4px;">
                        <span>✈️ In Trasferta</span>
                      </div>
                      <div style="color:var(--text-secondary);">
                        V <b>${vA.win}</b> • P <b>${vA.draw}</b> • S <b>${vA.loss}</b> pt
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
                        Reti: <span style="color:var(--accent-emerald);font-weight:600;">${formatGoal(vA.gf)}</span> / <span style="color:var(--accent-crimson);font-weight:600;">${formatGoal(vA.gs)}</span> pt
                      </div>
                    </div>
                    <div style="background:var(--bg-surface);padding:6px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                      <div style="font-weight:700;color:var(--text-primary);margin-bottom:2px;display:flex;align-items:center;gap:4px;">
                        <span>⚖️ Campo Neutro</span>
                      </div>
                      <div style="color:var(--text-secondary);">
                        V <b>${vN.win}</b> • P <b>${vN.draw}</b> • S <b>${vN.loss}</b> pt
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
                        Reti: <span style="color:var(--accent-emerald);font-weight:600;">${formatGoal(vN.gf)}</span> / <span style="color:var(--accent-crimson);font-weight:600;">${formatGoal(vN.gs)}</span> pt
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }
          }
        }
      });
    }

    if (!placementLegendHtml) {
      placementLegendHtml = `
        <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
          <div style="color:var(--text-secondary);">Punti assegnati in base ai trofei e podi ottenuti nell'Albo d'Oro.</div>
        </div>
      `;
    }

    const decay0 = rankCfg.decay?.[0] !== undefined ? Math.round(rankCfg.decay[0] * 100) : 100;
    const decay2 = rankCfg.decay?.[2] !== undefined ? Math.round(rankCfg.decay[2] * 100) : 75;
    const decay3 = rankCfg.decay?.[3] !== undefined ? Math.round(rankCfg.decay[3] * 100) : 50;
    const decay4 = rankCfg.decay?.[4] !== undefined ? Math.round(rankCfg.decay[4] * 100) : 25;
    const decayOld = rankCfg.older_decay !== undefined ? Math.round(rankCfg.older_decay * 100) : 0;

    let filtered = rankingData;
    if (this.filterCurrentOnly) {
      filtered = filtered.filter(r => r.isCurrent);
    }
    if (this.filterMinPoints) {
      filtered = filtered.filter(r => r.points > 0);
    }

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">
          Classifica perpetua per coefficienti calcolata in base a piazzamenti, trofei e stagioni disputate.
        </p>

        <!-- Filtri Squadre -->
        <div class="pill-tabs" style="margin-bottom:0;display:inline-flex;gap:4px;">
          <button type="button" class="pill-btn ${this.filterCurrentOnly ? 'active' : ''}" id="btnRankCurrent">
            ${this.filterCurrentOnly ? '✓ Solo Attuali' : 'Tutte le Squadre'}
          </button>
          <button type="button" class="pill-btn ${this.filterMinPoints ? 'active' : ''}" id="btnRankMinPts">
            ${this.filterMinPoints ? '✓ Punti > 0' : 'Includi Punti ≤ 0'}
          </button>
        </div>
      </div>

      <!-- Card Legenda collassabile con criteri ranking e soglie (stesso stile usato per la legenda nella pagina registri) -->
      <div id="rankingLegendCard" class="rv-legend-card" style="display:${this.showLegend ? 'block' : 'none'};margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;font-size:0.85rem;text-transform:uppercase;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">
            <span>📖 Modalità di Calcolo &amp; Legenda Ranking</span>
          </div>
          <button type="button" class="btnToggleLegend pill-btn" style="padding:2px 8px;font-size:0.7rem;line-height:1;" title="Chiudi Legenda">
            ✕ Chiudi
          </button>
        </div>

        <div style="background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(59,130,246,0.05));border:1px solid rgba(6,182,212,0.3);border-radius:var(--radius-md);padding:10px 14px;font-size:0.8rem;color:var(--text-primary);margin-bottom:14px;line-height:1.4;">
          ℹ️ I punti del <b>Ranking Storico</b> sono determinati da: <b>Piazzamenti nelle competizioni</b>, <b>Esiti partite (V/N/P)</b>, <b>Reti (Fatte/Subite)</b> e anzianità della stagione.
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin-bottom:14px;">
          <!-- 1) Piazzamento -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
            <div style="font-size:0.82rem;font-weight:800;color:var(--accent-cyan);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              🏆 1) Punti per Piazzamento
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
              ${placementLegendHtml}
            </div>
          </div>

          <!-- 2) Punti Partita & Differenza Reti -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
            <div style="font-size:0.82rem;font-weight:800;color:var(--accent-emerald);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              ⚽ 2) Partite &amp; Differenza Reti
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;line-height:1.35;">
              Valori assegnati per vittoria, pareggio, sconfitta e reti, differenziabili per sede (Casa, Trasferta, Neutro):
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
              ${matchesLegendHtml || '<div style="color:var(--text-secondary);">Nessuna regola partite configurata.</div>'}
            </div>
          </div>

          <!-- 3) Bonus / Malus e Storico -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
            <div style="font-size:0.82rem;font-weight:800;color:var(--accent-gold);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ⚖️ 3) Validità Storica
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);line-height:1.4;">
                <b style="color:var(--text-primary);">Decadimento Temporale:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  I punti accumulati mantengono un peso decrescente nel tempo:<br>
                  • Stagione Corrente / Passata: <b>${decay0}%</b><br>
                  • 2 Stagioni fa: <b>${decay2}%</b> • 3 Stagioni fa: <b>${decay3}%</b><br>
                  • 4 Stagioni fa: <b>${decay4}%</b> • <i>Oltre 5: ${decayOld}%</i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Indicatori Tabella & Card -->
        <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:10px 12px;font-size:0.75rem;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:14px;align-items:center;">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="rank-delta rank-up">▲ +N</span> <span style="color:var(--text-primary);">Posizioni guadagnate rispetto alla giornata precedente</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="rank-delta rank-down">▼ -N</span> <span style="color:var(--text-primary);">Posizioni perse rispetto alla giornata precedente</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="rank-delta rank-same">=</span> <span style="color:var(--text-primary);">Posizione invariata</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span style="font-style:italic;color:var(--text-muted);">(storica)</span> <span style="color:var(--text-primary);">Squadra non più attiva</span>
          </div>
        </div>
      </div>

      <!-- VISTA DESKTOP: Tabella Completa Moderna -->
      <div class="table-responsive ranking-desktop-only">
        <table class="modern-table">
          <thead>
            <tr>
              <th class="text-center" style="width:50px;">Pos</th>
              <th style="min-width:180px;">Squadra &amp; Palmares</th>
              <th class="text-center">Punti</th>
              <th class="text-center" style="width:70px;" title="Variazione di posizione rispetto alla giornata precedente">Variaz.</th>
              <th class="text-center" title="Posizione nella giornata precedente">Pos Prec</th>
              <th class="text-center" title="Punti accumulati fino alla giornata precedente">Punti Prec</th>
              <th class="text-center">Stagioni</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => {
      const trophies = this.buildTrophies(item);
      const isFavTeam = typeof fcmHomeConfigManager !== 'undefined' && (fcmHomeConfigManager.isFavoriteTeam(item.idAttuale) || fcmHomeConfigManager.isFavoriteTeam(item.teamName));

      let deltaHtml = `<span class="rank-delta rank-same">=</span>`;
      if (item.delta > 0) {
        deltaHtml = `<span class="rank-delta rank-up">▲ +${item.delta}</span>`;
      } else if (item.delta < 0) {
        deltaHtml = `<span class="rank-delta rank-down">▼ ${item.delta}</span>`;
      }

      return `
                <tr class="${isFavTeam ? 'table-row-favorite' : ''}">
                  <td class="text-center font-bold">
                    <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''}">
                      ${idx + 1}°
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.idAlbo || item.teamName)}" style="width:28px;height:28px;border-radius:4px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${item.teamName}" />
                      <div>
                        <div style="font-weight:700;color:${item.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${item.isCurrent ? 'normal' : 'italic'};">
                          ${isFavTeam ? '<span class="fav-team-star">⭐</span> ' : ''}${item.teamName} ${item.isCurrent ? fcmDataLoader.getTeamTrophiesHtml(item.teamName, item.idAttuale) : ''} ${!item.isCurrent ? '<span style="font-size:0.65rem;color:var(--text-muted);">(storica)</span>' : ''}
                        </div>
                        ${trophies.length > 0 ? `<div class="team-trophies">${trophies.join('')}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-center font-bold" style="color:var(--accent-cyan);font-size:1.05rem;">
                    ${item.points.toFixed(1)}
                  </td>
                  <td class="text-center">
                    ${deltaHtml}
                  </td>
                  <td class="text-center" style="color:var(--text-muted);">
                    ${item.prevPosition}°
                  </td>
                  <td class="text-center" style="color:var(--text-muted);">
                    ${item.prevPoints.toFixed(1)}
                  </td>
                  <td class="text-center font-bold">
                    ${item.seasons}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>

      <!-- VISTA MOBILE: Schede Compatte Ottimizzate Senza Scrolling Orizzontale -->
      <div class="ranking-mobile-only">
        <div class="ranking-mobile-list">
          ${filtered.map((item, idx) => {
      const trophies = this.buildTrophies(item);
      const isFavTeam = typeof fcmHomeConfigManager !== 'undefined' && (fcmHomeConfigManager.isFavoriteTeam(item.idAttuale) || fcmHomeConfigManager.isFavoriteTeam(item.teamName));

      let deltaHtml = `<span class="rank-delta rank-same">=</span>`;
      if (item.delta > 0) {
        deltaHtml = `<span class="rank-delta rank-up">▲ +${item.delta}</span>`;
      } else if (item.delta < 0) {
        deltaHtml = `<span class="rank-delta rank-down">▼ ${item.delta}</span>`;
      }

      return `
              <div class="ranking-mobile-card ${idx < 3 ? 'top-podium top-' + (idx + 1) : ''} ${isFavTeam ? 'match-card-favorite' : ''}">
                <div class="ranking-mobile-card-main">
                  <div class="ranking-mobile-team-info">
                    <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''} ranking-mobile-pos">
                      ${idx + 1}°
                    </span>
                    <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.idAlbo || item.teamName)}" class="ranking-mobile-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${item.teamName}" />
                    <div class="ranking-mobile-name-wrap">
                      <div class="ranking-mobile-team-name" style="color:${item.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${item.isCurrent ? 'normal' : 'italic'};">
                        ${isFavTeam ? '<span class="fav-team-star">⭐</span> ' : ''}${item.teamName} ${item.isCurrent ? fcmDataLoader.getTeamTrophiesHtml(item.teamName, item.idAttuale) : ''}
                        ${!item.isCurrent ? '<span class="ranking-historical-badge">(storica)</span>' : ''}
                      </div>
                      <div class="ranking-mobile-sub">
                        <span>Stagioni: <b>${item.seasons}</b></span>
                        <span class="sep">•</span>
                        <span>Prec: <b>${item.prevPosition}°</b> (${item.prevPoints.toFixed(1)} pt)</span>
                      </div>
                    </div>
                  </div>

                  <div class="ranking-mobile-score-box">
                    <div class="ranking-mobile-pts">${item.points.toFixed(1)} <small>pt</small></div>
                    <div class="ranking-mobile-delta">${deltaHtml}</div>
                  </div>
                </div>

                ${trophies.length > 0 ? `
                  <div class="ranking-mobile-trophies">
                    ${trophies.join('')}
                  </div>
                ` : ''}
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Filtri
    container.querySelector('#btnRankCurrent')?.addEventListener('click', () => {
      this.filterCurrentOnly = !this.filterCurrentOnly;
      this.renderRankingTable(container);
    });

    container.querySelector('#btnRankMinPts')?.addEventListener('click', () => {
      this.filterMinPoints = !this.filterMinPoints;
      this.renderRankingTable(container);
    });

    // Re-bind listeners della legenda
    this.bindLegendToggle();
  }
};

if (typeof window !== 'undefined') {
  window.rankingView = rankingView;
}
