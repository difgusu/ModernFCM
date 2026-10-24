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
          const iconSrc = `img/${pal.Icona}`;
          const smallSrc = `img/small-${pal.Icona}`;
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
        await fcmDataLoader.loadScript('persjs/fcmConfrontiDati.js');
      } catch (e) {
        console.warn('Could not load persjs/fcmConfrontiDati.js', e);
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

          <!-- Pulsante Legenda in stile pill-tab (stesso stile usato per la legenda nella pagina registri) -->
          <div class="pill-tabs" style="margin-bottom:0;display:inline-flex;">
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
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento dati ranking...
          </div>
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
        await fcmDataLoader.loadScript('persjs/fcmConfrontiDati.js');
      } catch (e) { }
    }

    const rankingData = await fcmDataLoader.loadRanking();

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
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Campionato:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>100 pt</b> • 2°: <b>70 pt</b> • 3°: <b>50 pt</b> • 4°: <b>30 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Coppa di Lega:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>50 pt</b> • 2°: <b>30 pt</b> • 3°: <b>15 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Classifica GP:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>30 pt</b> • 2°: <b>15 pt</b> • 3°: <b>5 pt</b></div>
              </div>
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Supercoppa:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">1°: <b>10 pt</b></div>
              </div>
            </div>
          </div>

          <!-- 2) Punti Partita -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
            <div style="font-size:0.82rem;font-weight:800;color:var(--accent-emerald);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ⚽ 2) Punti Partita
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--accent-emerald);">Vittorie:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • Campionato: <b>2 punti</b><br>
                  • Coppe: <b>1.8 punti</b><br>
                  • Supercoppa/Spareggi: <b>1.3 punti</b>
                </div>
              </div>
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--accent-gold);">Pareggi:</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • Campionato: <b>1.2 punti</b><br>
                  • Coppe: <b>1.1 punti</b><br>
                  • Supercoppa/Spareggi: <b>1 punto</b>
                </div>
              </div>
            </div>
          </div>

          <!-- 3) Bonus / Malus e Storico -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
            <div style="font-size:0.82rem;font-weight:800;color:var(--accent-gold);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ⚖️ 3) Reti e Validità Storica
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Reti (Gol):</b>
                <div style="color:var(--text-secondary);margin-top:2px;">
                  • <b style="color:var(--accent-emerald);">+1.3 pt</b> per ogni gol fatto<br>
                  • <b style="color:var(--accent-crimson);">-1.3 pt</b> per ogni gol subito
                </div>
              </div>
              <div style="background:var(--bg-main);padding:6px 8px;border-radius:var(--radius-sm);">
                <b style="color:var(--text-primary);">Validità Storica (Ultime 4 stagioni):</b>
                <div style="color:var(--text-secondary);margin-top:2px;line-height:1.4;">
                  • Stagione Corrente / Passata: <b>100%</b><br>
                  • 2 Stagioni fa: <b>75%</b> • 3 Stagioni fa: <b>50%</b><br>
                  • 4 Stagioni fa: <b>25%</b> • <i>Oltre 5: 0%</i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Indicatori Tabella & Card -->
        <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:10px 12px;font-size:0.75rem;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:14px;align-items:center;">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="rank-delta rank-up">▲ +N</span> <span style="color:var(--text-primary);">Posizioni guadagnate</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="rank-delta rank-down">▼ -N</span> <span style="color:var(--text-primary);">Posizioni perse</span>
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
              <th class="text-center" style="width:70px;">Variaz.</th>
              <th class="text-center">Pos Prec</th>
              <th class="text-center">Punti Prec</th>
              <th class="text-center">Stagioni</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => {
      const trophies = this.buildTrophies(item);

      let deltaHtml = `<span class="rank-delta rank-same">=</span>`;
      if (item.delta > 0) {
        deltaHtml = `<span class="rank-delta rank-up">▲ +${item.delta}</span>`;
      } else if (item.delta < 0) {
        deltaHtml = `<span class="rank-delta rank-down">▼ ${item.delta}</span>`;
      }

      return `
                <tr>
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
                          ${item.teamName} ${item.isCurrent ? fcmDataLoader.getTeamTrophiesHtml(item.teamName, item.idAttuale) : ''} ${!item.isCurrent ? '<span style="font-size:0.65rem;color:var(--text-muted);">(storica)</span>' : ''}
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

      let deltaHtml = `<span class="rank-delta rank-same">=</span>`;
      if (item.delta > 0) {
        deltaHtml = `<span class="rank-delta rank-up">▲ +${item.delta}</span>`;
      } else if (item.delta < 0) {
        deltaHtml = `<span class="rank-delta rank-down">▼ ${item.delta}</span>`;
      }

      return `
              <div class="ranking-mobile-card ${idx < 3 ? 'top-podium top-' + (idx + 1) : ''}">
                <div class="ranking-mobile-card-main">
                  <div class="ranking-mobile-team-info">
                    <span class="table-pos ${idx === 0 ? 'table-pos-1' : idx === 1 ? 'table-pos-2' : idx === 2 ? 'table-pos-3' : ''} ranking-mobile-pos">
                      ${idx + 1}°
                    </span>
                    <img src="${fcmDataLoader.getTeamLogo(item.idAttuale || item.idAlbo || item.teamName)}" class="ranking-mobile-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${item.teamName}" />
                    <div class="ranking-mobile-name-wrap">
                      <div class="ranking-mobile-team-name" style="color:${item.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'};font-style:${item.isCurrent ? 'normal' : 'italic'};">
                        ${item.teamName} ${item.isCurrent ? fcmDataLoader.getTeamTrophiesHtml(item.teamName, item.idAttuale) : ''}
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
