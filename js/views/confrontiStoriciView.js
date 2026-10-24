/**
 * CONFRONTI STORICI VIEW
 * Palmarès, Bilancio complessivo vs tutte le fantasquadre, Statistiche (Bestia Nera, etc.) e Archivio testa a testa
 * ModernFCM
 */

const confrontiStoriciView = {
  currentTeamId: null,   // Dinamico: prima squadra attiva per idAttuale (o da query param)
  currentOpponentId: null, // Dinamico: avversaria attiva con idAttuale successivo (o da query param)
  currentCompId: 0,    // 0 = Tutte
  currentSubSection: 'bilancio', // 'bilancio', 'statistiche', 'incontri'
  activeStatCatIndex: 'all', // Default: 'all' = visualizza tutte le categorie a video senza scorrimento

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('Fsq')) {
        const fId = parseInt(params.get('fsq') || params.get('Fsq'), 10);
        if (!isNaN(fId)) this.currentTeamId = fId;
      } else {
        this.currentTeamId = null;
      }
      if (params.has('fsq2') || params.has('Fsq2')) {
        const fId2 = parseInt(params.get('fsq2') || params.get('Fsq2'), 10);
        if (!isNaN(fId2)) this.currentOpponentId = fId2;
      } else {
        this.currentOpponentId = null;
      }
      if (params.has('tab') || params.has('sec')) {
        const sec = params.get('tab') || params.get('sec');
        if (['bilancio', 'statistiche', 'incontri'].includes(sec)) {
          this.currentSubSection = sec;
        }
      }
    } else {
      this.currentTeamId = null;
      this.currentOpponentId = null;
    }

    container.innerHTML = `
      <style>
        /* Regole responsive per bilancio, statistiche e dettaglio incontri su mobile */
        @media (max-width: 768px) {
          .bilancio-desktop-view { display: none !important; }
          .bilancio-mobile-view { display: flex !important; flex-direction: column; gap: 10px; }
          .stats-desktop-view { display: none !important; }
          .stats-mobile-view { display: block !important; }
          .incontri-desktop-view { display: none !important; }
          .incontri-mobile-view { display: flex !important; flex-direction: column; gap: 8px; }
        }
        @media (min-width: 769px) {
          .bilancio-desktop-view { display: block !important; }
          .bilancio-mobile-view { display: none !important; }
          .stats-desktop-view { display: block !important; }
          .stats-mobile-view { display: none !important; }
          .incontri-desktop-view { display: block !important; }
          .incontri-mobile-view { display: none !important; }
        }
      </style>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"></path>
                <path d="M7 21v-6"></path>
                <path d="M12 21v-10"></path>
                <path d="M17 21v-4"></path>
                <circle cx="17" cy="7" r="4"></circle>
                <path d="M17 5.5V7l1 1"></path>
              </svg>
              Confronti Storici
            </div>
            <div class="card-subtitle">Palmarès, bilanci perpetui, statistiche di rendimento e archivio testa a testa</div>
          </div>
        </div>

        <div id="confrontiStoriciContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento archivio confronti storici...
          </div>
        </div>
      </div>
    `;

    const subContainer = container.querySelector('#confrontiStoriciContent');
    await this.renderView(subContainer);
  },

  async renderView(subContainer) {
    const confData = await fcmDataLoader.loadConfronti();
    if (!confData || !confData.teams || confData.teams.length === 0) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati confronti storici non disponibili.</div>`;
      return;
    }

    const currentTeam = fcmDataLoader.getDefaultHistoricalTeam(confData.teams, this.currentTeamId);
    if (!currentTeam) {
      subContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati confronti storici non disponibili.</div>`;
      return;
    }
    this.currentTeamId = currentTeam.id;

    const oppTeam = fcmDataLoader.getDefaultHistoricalOpponent(confData.teams, this.currentTeamId, this.currentOpponentId);
    if (oppTeam) {
      this.currentOpponentId = oppTeam.id;
    }

    const trophies = confData.getPalmares(this.currentTeamId);
    const bilancioList = confData.getBilancioAll(this.currentTeamId, this.currentCompId, this.currentStadio);
    const statsList = confData.getStatisticheBNVP(this.currentTeamId, this.currentCompId, this.currentStadio);
    const h2h = confData.getHeadToHead(this.currentTeamId, this.currentOpponentId, this.currentCompId);
    await fcmDataLoader.resolveMatchesLinks(h2h.matches);

    subContainer.innerHTML = `
      <!-- Palmarès della Fantasquadra -->
      <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:18px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="img/sq/${encodeURI(currentTeam.name)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(currentTeam.name)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:32px;width:auto;vertical-align:middle;" alt="" />
            <span style="font-weight:800;font-size:1.15rem;color:var(--text-primary);">Palmarès ${currentTeam.name}</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <label for="confTeamSelect" style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
              Fantasquadra:
            </label>
            <select id="confTeamSelect" class="form-select" style="font-weight:700;min-width:200px;">
              ${confData.teams.map(t => `
                <option value="${t.id}" ${t.id === this.currentTeamId ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Trofei Badges Grid -->
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
          ${trophies.length > 0 ? trophies.map(tr => `
            <div style="display:inline-flex;align-items:center;gap:10px;background:var(--bg-surface);border:1px solid var(--border-subtle);padding:8px 16px;border-radius:var(--radius-md);box-shadow:var(--shadow-sm);">
              <img src="img/${tr.icon}" onerror="this.onerror=null;this.src='img/ico-scudetto.gif';" style="height:28px;width:auto;" alt="${tr.label}" />
              <div>
                <div style="font-weight:800;font-size:0.92rem;color:var(--text-primary);">${tr.count}x ${tr.label}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);">${tr.years.join(', ')}</div>
              </div>
            </div>
          `).join('') : `
            <div style="font-size:0.82rem;color:var(--text-muted);font-style:italic;">
              Nessun titolo ufficiale in bacheca al momento.
            </div>
          `}
        </div>
      </div>

      <!-- Filtri Competizione & Campo -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;background:var(--bg-surface-elevated);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.78rem;font-weight:700;color:var(--text-muted);">Competizione:</label>
            <select id="confCompSelect" class="form-select" style="font-size:0.82rem;font-weight:700;">
              <option value="0" ${this.currentCompId === 0 ? 'selected' : ''}>Tutte le Competizioni</option>
              ${(confData.competitions || []).map(c => `
                <option value="${c.id}" ${this.currentCompId === c.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.78rem;font-weight:700;color:var(--text-muted);">Campo:</label>
            <select id="confStadioSelect" class="form-select" style="font-size:0.82rem;font-weight:700;">
              <option value="T" ${this.currentStadio === 'T' ? 'selected' : ''}>Tutti i Campi</option>
              <option value="C" ${this.currentStadio === 'C' ? 'selected' : ''}>Solo in Casa</option>
              <option value="F" ${this.currentStadio === 'F' ? 'selected' : ''}>Solo in Trasferta</option>
            </select>
          </div>
        </div>

        <!-- Pill Tabs Sezione Interna -->
        <div class="pill-tabs" id="confSectionTabs" style="margin:0;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="pill-btn ${this.currentSubSection === 'bilancio' ? 'active' : ''}" data-sec="bilancio">
            📊 Bilancio vs Tutte
          </button>
          <button class="pill-btn ${this.currentSubSection === 'statistiche' ? 'active' : ''}" data-sec="statistiche">
            📈 Statistiche
          </button>
          <button class="pill-btn ${this.currentSubSection === 'incontri' ? 'active' : ''}" data-sec="incontri">
            ⚔️ Dettaglio Incontri
          </button>
        </div>
      </div>

      <!-- Contenuto Sezione Selezionata -->
      <div id="confSubSectionContent">
        ${this.currentSubSection === 'bilancio'
        ? this.renderBilancioTable(currentTeam.name, bilancioList)
        : (this.currentSubSection === 'statistiche'
          ? this.renderStatisticheTable(currentTeam.name, statsList)
          : this.renderIncontriSection(confData.teams, currentTeam, h2h)
        )
      }
      </div>
    `;

    // Event listeners
    subContainer.querySelector('#confTeamSelect').addEventListener('change', (e) => {
      this.currentTeamId = parseInt(e.target.value, 10);
      this.renderView(subContainer);
    });

    subContainer.querySelector('#confCompSelect').addEventListener('change', (e) => {
      this.currentCompId = parseInt(e.target.value, 10);
      this.renderView(subContainer);
    });

    subContainer.querySelector('#confStadioSelect').addEventListener('change', (e) => {
      this.currentStadio = e.target.value;
      this.renderView(subContainer);
    });

    subContainer.querySelectorAll('#confSectionTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentSubSection = btn.getAttribute('data-sec');
        this.renderView(subContainer);
      });
    });

    // Incontri opponent select listener if present
    const oppSel = subContainer.querySelector('#confOpponentSelect');
    if (oppSel) {
      oppSel.addEventListener('change', (e) => {
        this.currentOpponentId = parseInt(e.target.value, 10);
        this.renderView(subContainer);
      });
    }

    // Opponent quick-action click listener (for bilancio & statistiche rows)
    subContainer.querySelectorAll('.btn-opp-action').forEach(el => {
      el.addEventListener('click', () => {
        const oppId = parseInt(el.getAttribute('data-opp'), 10);
        if (!isNaN(oppId)) {
          this.currentOpponentId = oppId;
          this.currentSubSection = 'incontri';
          this.renderView(subContainer);
        }
      });
    });

    // Mobile category buttons for statistiche section
    subContainer.querySelectorAll('.stat-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const catIdx = btn.getAttribute('data-cat-idx');
        if (catIdx === 'all') {
          this.activeStatCatIndex = 'all';
        } else {
          const parsed = parseInt(catIdx, 10);
          if (!isNaN(parsed)) this.activeStatCatIndex = parsed;
        }
        this.renderView(subContainer);
      });
    });
  },

  renderBilancioTable(teamName, list) {
    if (!list || list.length === 0) {
      return `<div class="text-center" style="padding:24px;color:var(--text-muted);">Nessun confronto storico disponibile per i filtri selezionati.</div>`;
    }

    // Calcolo totali complessivi
    let totG = 0, totV = 0, totN = 0, totP = 0, totGF = 0, totGS = 0, totPtF = 0, totPtS = 0;
    for (const o of list) {
      totG += o.giocate;
      totV += o.vinte;
      totN += o.nulle;
      totP += o.perse;
      totGF += o.gf;
      totGS += o.gs;
      totPtF += (o.ptFatti || 0);
      totPtS += (o.ptSubiti || 0);
    }
    const totPtFAvg = totG > 0 ? (totPtF / totG).toFixed(3) : '0.0';
    const totPtSAvg = totG > 0 ? (totPtS / totG).toFixed(3) : '0.0';

    return `
      <div class="card" style="margin:0;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;gap:8px;">
          <strong style="color:var(--text-primary);font-size:1.05rem;">Bilancio Storico di ${teamName} contro tutte le avversarie</strong>
          <span style="font-size:0.75rem;color:var(--text-muted);">Clicca sul nome squadra per aprire il dettaglio incontri</span>
        </div>

        <!-- Visualizzazione Desktop: Tabella Classica -->
        <div class="bilancio-desktop-view table-responsive" style="margin:0;">
          <table class="modern-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th style="text-align:left;min-width:180px;">Fantasquadra Avversaria</th>
                <th class="text-center" style="width:45px;">G</th>
                <th class="text-center" style="width:45px;color:var(--accent-emerald);">V</th>
                <th class="text-center" style="width:45px;">N</th>
                <th class="text-center" style="width:45px;color:var(--accent-rose);">P</th>
                <th class="text-center" style="width:50px;">GF</th>
                <th class="text-center" style="width:50px;">GS</th>
                <th class="text-center font-bold" style="width:65px;color:var(--accent-cyan);">P.tiF</th>
                <th class="text-center font-bold" style="width:65px;color:var(--text-secondary);">P.tiS</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(o => {
      // Colore del nome della squadra in base al bilancio scontri diretti:
      // Verde se in vantaggio (V > P), Rosso se in svantaggio (V < P), Giallo se pari (V == P)
      let nameColor = 'var(--accent-gold, #f59e0b)';
      if (o.vinte > o.perse) {
        nameColor = 'var(--accent-emerald, #10b981)';
      } else if (o.vinte < o.perse) {
        nameColor = 'var(--accent-rose, #ef4444)';
      }

      // Tipografia: Grassetto per attuali, normale per storiche
      const nameWeight = o.isCurrent ? '800' : '400';

      return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <img src="img/sq/${encodeURI(o.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(o.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;vertical-align:middle;flex-shrink:0;" alt="" />
                        <span class="btn-opp-action" data-opp="${o.teamId}" style="cursor:pointer;font-weight:${nameWeight};color:${nameColor};display:inline-flex;align-items:center;gap:6px;" title="Vedi dettaglio incontri con ${o.teamName}">
                          ${o.teamName}
                          <span style="font-size:0.75rem;opacity:0.6;">&rarr;</span>
                        </span>
                      </div>
                    </td>
                    <td class="text-center font-bold">${o.giocate}</td>
                    <td class="text-center font-bold" style="color:var(--accent-emerald);">${o.vinte}</td>
                    <td class="text-center">${o.nulle}</td>
                    <td class="text-center font-bold" style="color:var(--accent-rose);">${o.perse}</td>
                    <td class="text-center font-bold">${o.gf}</td>
                    <td class="text-center">${o.gs}</td>
                    <td class="text-center font-bold" style="color:var(--accent-cyan);">${o.ptFattiAvg}</td>
                    <td class="text-center font-bold" style="color:var(--text-secondary);">${o.ptSubitiAvg}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:800;background:var(--bg-surface-elevated);border-top:2px solid var(--border-subtle);">
                <td>
                  <div style="display:flex;align-items:center;gap:10px;padding-left:4px;">
                    <span style="letter-spacing:0.04em;color:var(--text-primary);font-weight:800;">* TOTALE *</span>
                  </div>
                </td>
                <td class="text-center font-bold" style="color:var(--text-primary);">${totG}</td>
                <td class="text-center font-bold" style="color:var(--accent-emerald);">${totV}</td>
                <td class="text-center font-bold">${totN}</td>
                <td class="text-center font-bold" style="color:var(--accent-rose);">${totP}</td>
                <td class="text-center font-bold">${totGF}</td>
                <td class="text-center font-bold">${totGS}</td>
                <td class="text-center font-bold" style="color:var(--accent-cyan);">${totPtFAvg}</td>
                <td class="text-center font-bold" style="color:var(--text-secondary);">${totPtSAvg}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Visualizzazione Mobile: Card Responsive con Statistiche Chiare Senza Scorrimento -->
        <div class="bilancio-mobile-view">
          <!-- Card Totale Complessivo -->
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px;box-shadow:var(--shadow-sm);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border-subtle);">
              <span style="font-weight:800;font-size:0.85rem;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;">* TOTALE COMPLESSIVO *</span>
              <span class="badge" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);font-size:0.75rem;font-weight:700;">${totG} Gare</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;text-align:center;margin-bottom:8px;">
              <div style="background:var(--bg-surface-elevated);padding:6px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Vinte</div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--accent-emerald);">${totV}</div>
              </div>
              <div style="background:var(--bg-surface-elevated);padding:6px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Nulle</div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary);">${totN}</div>
              </div>
              <div style="background:var(--bg-surface-elevated);padding:6px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Perse</div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--accent-rose);">${totP}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;padding:6px 8px;background:var(--bg-surface-elevated);border-radius:var(--radius-sm);color:var(--text-secondary);">
              <div>Gol: <strong style="color:var(--text-primary);">${totGF}</strong> F / <strong style="color:var(--text-primary);">${totGS}</strong> S</div>
              <div>Media: <strong style="color:var(--accent-cyan);">${totPtFAvg}</strong> F / <strong style="color:var(--text-secondary);">${totPtSAvg}</strong> S</div>
            </div>
          </div>

          <!-- Cards delle singole avversarie -->
          ${list.map(o => {
      let nameColor = 'var(--accent-gold, #f59e0b)';
      let badgeBg = 'rgba(245, 158, 11, 0.12)';
      let badgeBorder = 'rgba(245, 158, 11, 0.35)';
      let statusText = 'Pari';
      if (o.vinte > o.perse) {
        nameColor = 'var(--accent-emerald, #10b981)';
        badgeBg = 'rgba(16, 185, 129, 0.12)';
        badgeBorder = 'rgba(16, 185, 129, 0.35)';
        statusText = 'In vantaggio';
      } else if (o.vinte < o.perse) {
        nameColor = 'var(--accent-rose, #ef4444)';
        badgeBg = 'rgba(239, 68, 68, 0.12)';
        badgeBorder = 'rgba(239, 68, 68, 0.35)';
        statusText = 'In svantaggio';
      }
      const nameWeight = o.isCurrent ? '800' : '500';

      return `
              <div class="match-card" style="padding:10px 12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
                <!-- Header Squadra Avversaria -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
                  <div class="btn-opp-action" data-opp="${o.teamId}" style="display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0;" title="Vedi dettaglio incontri con ${o.teamName}">
                    <img src="img/sq/${encodeURI(o.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(o.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:26px;width:auto;vertical-align:middle;flex-shrink:0;" alt="" />
                    <span style="font-weight:${nameWeight};color:${nameColor};font-size:0.92rem;display:inline-flex;align-items:center;gap:4px;">
                      ${o.teamName}
                      <span style="font-size:0.75rem;opacity:0.6;">↗</span>
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:999px;background:${badgeBg};border:1px solid ${badgeBorder};color:${nameColor};">
                      ${statusText}
                    </span>
                    <span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.72rem;font-weight:700;">
                      ${o.giocate} G
                    </span>
                  </div>
                </div>

                <!-- 3 Colonne Esiti V / N / P -->
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;text-align:center;margin-bottom:8px;">
                  <div style="background:var(--bg-surface);padding:4px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                    <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">V</span>
                    <div style="font-size:0.95rem;font-weight:800;color:var(--accent-emerald);">${o.vinte}</div>
                  </div>
                  <div style="background:var(--bg-surface);padding:4px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                    <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">N</span>
                    <div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);">${o.nulle}</div>
                  </div>
                  <div style="background:var(--bg-surface);padding:4px 2px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                    <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">P</span>
                    <div style="font-size:0.95rem;font-weight:800;color:var(--accent-rose);">${o.perse}</div>
                  </div>
                </div>

                <!-- Gol e Medie Punti -->
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;padding:5px 8px;background:var(--bg-surface);border-radius:var(--radius-sm);color:var(--text-secondary);border:1px solid var(--border-subtle);">
                  <div>Gol: <strong style="color:var(--text-primary);">${o.gf}</strong> - <strong style="color:var(--text-primary);">${o.gs}</strong></div>
                  <div>P.ti: <strong style="color:var(--accent-cyan);">${o.ptFattiAvg}</strong> - <strong style="color:var(--text-secondary);">${o.ptSubitiAvg}</strong></div>
                </div>
              </div>
            `;
    }).join('')}
        </div>

        <!-- Legenda Colori e Tipografia -->
        <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:0.75rem;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-subtle);color:var(--text-muted);align-items:center;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="width:9px;height:9px;border-radius:50%;background:var(--accent-emerald,#10b981);display:inline-block;"></span>
            <span style="color:var(--accent-emerald,#10b981);font-weight:600;">Bilancio in vantaggio</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="width:9px;height:9px;border-radius:50%;background:var(--accent-gold,#f59e0b);display:inline-block;"></span>
            <span style="color:var(--accent-gold,#f59e0b);font-weight:600;">Bilancio in parit&agrave;</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="width:9px;height:9px;border-radius:50%;background:var(--accent-rose,#ef4444);display:inline-block;"></span>
            <span style="color:var(--accent-rose,#ef4444);font-weight:600;">Bilancio in svantaggio</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
            <strong style="color:var(--text-primary);font-weight:800;">Grassetto:</strong> Squadre attuali &bull; <span style="font-weight:400;color:var(--text-secondary);">Normale:</span> Squadre storiche
          </div>
        </div>
      </div>
    `;
  },

  renderStatisticheTable(teamName, statsList) {
    if (!statsList || statsList.length === 0) {
      return `<div class="text-center" style="padding:24px;color:var(--text-muted);">Nessuna statistica disponibile per i filtri selezionati.</div>`;
    }

    const renderCell = (data) => {
      if (!data) {
        return `<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">N/D</span>`;
      }
      return `
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="img/sq/${encodeURI(data.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(data.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;vertical-align:middle;flex-shrink:0;" alt="" />
          <div>
            <span class="btn-opp-action" data-opp="${data.teamId}" style="cursor:pointer;font-weight:700;color:var(--text-primary);font-size:0.82rem;" title="Vedi dettaglio incontri con ${data.teamName}">
              ${data.teamName}
            </span>
            <div style="font-size:0.72rem;color:var(--text-muted);">
              Media: <strong style="color:var(--accent-gold);">${data.val}</strong> &bull; ${data.matches} partite
            </div>
          </div>
        </div>
      `;
    };

    const renderMobileCol = (data) => {
      if (!data) {
        return `<div style="color:var(--text-muted);font-style:italic;font-size:0.75rem;margin:auto 0;padding:8px 0;">N/D</div>`;
      }
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin:auto 0;">
          <img src="img/sq/${encodeURI(data.teamName)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(data.teamName)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:26px;width:auto;object-fit:contain;" alt="" />
          <div class="btn-opp-action" data-opp="${data.teamId}" style="font-size:0.75rem;font-weight:800;color:var(--text-primary);cursor:pointer;line-height:1.2;word-break:break-word;max-width:100%;" title="Vedi dettaglio incontri con ${data.teamName}">
            ${data.teamName}
          </div>
        </div>
        <div style="margin-top:6px;border-top:1px dashed var(--border-subtle);padding-top:4px;">
          <div style="font-size:0.88rem;font-weight:800;color:var(--accent-gold);">${data.val}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">${data.matches} gare</div>
        </div>
      `;
    };

    const categoriesToRender = (this.activeStatCatIndex === 'all')
      ? statsList
      : [statsList[this.activeStatCatIndex] || statsList[0]];

    return `
      <div class="card" style="margin:0;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;gap:8px;">
          <strong style="color:var(--text-primary);font-size:1.05rem;">Statistiche Storiche di ${teamName}</strong>
          <span style="font-size:0.75rem;color:var(--text-muted);">Bestia Nera, Vittima Preferita, Attacco e Difesa</span>
        </div>

        <div style="margin-bottom:14px;font-size:0.78rem;color:var(--text-secondary);background:var(--bg-surface);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
          ℹ️ Le statistiche sono calcolate su tre colonne: <strong>Assoluta</strong> (tutte le avversarie storiche), <strong>Pesata</strong> (squadre affrontate in almeno il 4% delle gare totali) e <strong>Attuale</strong> (squadre attualmente iscritte alla Lega).
        </div>

        <!-- Visualizzazione Desktop: Tabella completa con 4 colonne -->
        <div class="stats-desktop-view table-responsive" style="margin:0;">
          <table class="modern-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th style="text-align:left;min-width:200px;">Statistica</th>
                <th style="text-align:left;min-width:180px;" title="Dato assoluto: fra tutte le squadre e con qualsiasi numero di partite giocate">
                  Assoluta
                </th>
                <th style="text-align:left;min-width:180px;" title="Dato pesato: fra le squadre con un numero di partite almeno pari al 4% del totale">
                  Pesata (&ge; 4%)
                </th>
                <th style="text-align:left;min-width:180px;" title="Dato attuale: fra le sole squadre attualmente iscritte">
                  Attuale
                </th>
              </tr>
            </thead>
            <tbody>
              ${statsList.map(st => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-size:1.2rem;">${st.icon}</span>
                      <div>
                        <div style="font-weight:800;color:var(--text-primary);">${st.label}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted);">${st.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td>${renderCell(st.assoluta)}</td>
                  <td>${renderCell(st.pesata)}</td>
                  <td>${renderCell(st.attuale)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Visualizzazione Mobile: Tutte le categorie visualizzate, senza scorrimento orizzontale -->
        <div class="stats-mobile-view">
          <!-- Pulsanti Filtro Categorie (Wrap multi-riga, nessuno scorrimento orizzontale) -->
          <div style="font-size:0.74rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">
            Filtra Categoria:
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
            <button class="pill-btn stat-cat-pill ${this.activeStatCatIndex === 'all' ? 'active' : ''}" data-cat-idx="all" style="font-size:0.74rem;padding:6px 10px;border-radius:var(--radius-sm);background:${this.activeStatCatIndex === 'all' ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)'};color:${this.activeStatCatIndex === 'all' ? '#ffffff' : 'var(--text-secondary)'};border:1px solid ${this.activeStatCatIndex === 'all' ? 'var(--accent-primary)' : 'var(--border-subtle)'};cursor:pointer;font-weight:700;">
              📊 Tutte (${statsList.length})
            </button>
            ${statsList.map((st, idx) => `
              <button class="pill-btn stat-cat-pill ${this.activeStatCatIndex === idx ? 'active' : ''}" data-cat-idx="${idx}" style="font-size:0.74rem;padding:6px 10px;border-radius:var(--radius-sm);background:${this.activeStatCatIndex === idx ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)'};color:${this.activeStatCatIndex === idx ? '#ffffff' : 'var(--text-secondary)'};border:1px solid ${this.activeStatCatIndex === idx ? 'var(--accent-primary)' : 'var(--border-subtle)'};cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                <span>${st.icon}</span>
                <span>${st.label}</span>
              </button>
            `).join('')}
          </div>

          <!-- Tutte le categorie visualizzate con le 3 colonne affiancate a video -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${categoriesToRender.map(st => `
              <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px;">
                <!-- Header Categoria -->
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span style="font-size:1.2rem;">${st.icon}</span>
                  <span style="font-weight:800;font-size:0.92rem;color:var(--text-primary);">${st.label}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">${st.desc}</div>

                <!-- 3 Colonne a Video (Assoluta, Pesata, Attuale) senza scorrimento -->
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;width:100%;">
                  <!-- Assoluta -->
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 4px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:125px;">
                    <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border-subtle);padding-bottom:3px;margin-bottom:4px;">
                      Assoluta
                    </div>
                    ${renderMobileCol(st.assoluta)}
                  </div>

                  <!-- Pesata -->
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 4px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:125px;">
                    <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border-subtle);padding-bottom:3px;margin-bottom:4px;">
                      Pesata (&ge;4%)
                    </div>
                    ${renderMobileCol(st.pesata)}
                  </div>

                  <!-- Attuale -->
                  <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 4px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:125px;">
                    <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border-subtle);padding-bottom:3px;margin-bottom:4px;">
                      Attuale
                    </div>
                    ${renderMobileCol(st.attuale)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  formatDate(dStr) {
    if (!dStr) return '-';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const DOW = ['', 'Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const MOY = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const dow = DOW[d.getDay() + 1] || '';
    const moy = MOY[d.getMonth() + 1] || '';
    return `${dow} ${d.getDate()} ${moy} ${d.getFullYear()}`;
  },

  renderIncontriSection(teams, currentTeam, h2h) {
    const oppTeam = teams.find(t => t.id === this.currentOpponentId) || fcmDataLoader.getDefaultHistoricalOpponent(teams, currentTeam.id);

    return `
      <div class="card" style="margin:0;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex;align-items:center;gap:10px;">
            <label for="confOpponentSelect" style="font-size:0.8rem;font-weight:800;color:var(--accent-primary);text-transform:uppercase;">
              Avversaria:
            </label>
            <select id="confOpponentSelect" class="form-select" style="font-weight:700;min-width:220px;">
              ${teams.filter(t => t.id !== currentTeam.id).map(t => `
                <option value="${t.id}" ${t.id === this.currentOpponentId ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>

          <!-- Riepilogo Rapido Testa a Testa -->
          <div style="display:flex;align-items:center;gap:14px;font-size:0.85rem;background:var(--bg-surface);padding:6px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);flex-wrap:wrap;">
            <span>Giocate: <strong>${h2h.matchesCount}</strong></span>
            <span style="color:var(--accent-emerald);">Vinte ${currentTeam.name}: <strong>${h2h.winsA}</strong></span>
            <span>Nulle: <strong>${h2h.draws}</strong></span>
            <span style="color:var(--accent-rose);">Vinte ${oppTeam ? oppTeam.name : 'Avversaria'}: <strong>${h2h.winsB}</strong></span>
          </div>
        </div>

        <!-- Lista Partite Disputate -->
        ${h2h.matches.length > 0 ? `
          <!-- Visualizzazione Desktop: Tabella Classica -->
          <div class="incontri-desktop-view table-responsive" style="margin:0;">
            <table class="modern-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Stagione</th>
                  <th>Competizione</th>
                  <th>Giornata</th>
                  <th>Data</th>
                  <th style="text-align:right;">Casa</th>
                  <th class="text-center" style="width:60px;">Ris.</th>
                  <th style="text-align:left;">Trasferta</th>
                  <th class="text-center font-bold">Punti Totali</th>
                </tr>
              </thead>
              <tbody>
                ${h2h.matches.map(m => {
      const myWin = (m.isACasa && m.homeScore > m.awayScore) || (!m.isACasa && m.awayScore > m.homeScore);
      const oppWin = (m.isACasa && m.homeScore < m.awayScore) || (!m.isACasa && m.awayScore < m.homeScore);
      let resClass = myWin ? 'color:var(--accent-emerald);font-weight:800;' : (oppWin ? 'color:var(--accent-rose);font-weight:800;' : 'font-weight:700;');

      return `
                    <tr>
                      <td class="font-bold">${m.season}ª</td>
                      <td><span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.72rem;">${m.compLabel}</span></td>
                      <td class="text-center font-bold">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" title="Vedi risultati ${m.matchday}ª giornata">
                          ${m.matchday}ª
                        </a>
                      </td>
                      <td style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;">${this.formatDate(m.date || m.rawDate)}</td>
                      <td style="text-align:right;${m.isACasa ? 'font-weight:800;color:var(--text-primary);' : 'color:var(--text-secondary);'}">
                        <span style="display:inline-flex;align-items:center;gap:6px;">
                          ${m.homeTeam}
                          <img src="img/sq/${encodeURI(m.homeTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.homeTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:18px;width:auto;vertical-align:middle;" alt="" />
                        </span>
                      </td>
                      <td class="text-center" style="${resClass}">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link result-link" style="text-decoration:none;color:inherit;display:inline-block;" title="Vedi tabellino incontro">
                          ${m.homeScore} - ${m.awayScore}
                        </a>
                      </td>
                      <td style="text-align:left;${!m.isACasa ? 'font-weight:800;color:var(--text-primary);' : 'color:var(--text-secondary);'}">
                        <span style="display:inline-flex;align-items:center;gap:6px;">
                          <img src="img/sq/${encodeURI(m.awayTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.awayTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:18px;width:auto;vertical-align:middle;" alt="" />
                          ${m.awayTeam}
                        </span>
                      </td>
                      <td class="text-center font-bold" style="color:var(--text-muted);">
                        (${m.homePoints} - ${m.awayPoints})
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Visualizzazione Mobile: Card Responsive Senza Scorrimento Orizzontale -->
          <div class="incontri-mobile-view">
            ${h2h.matches.map(m => {
      const myWin = (m.isACasa && m.homeScore > m.awayScore) || (!m.isACasa && m.awayScore > m.homeScore);
      const oppWin = (m.isACasa && m.homeScore < m.awayScore) || (!m.isACasa && m.awayScore < m.homeScore);
      let resColor = myWin ? 'var(--accent-emerald, #10b981)' : (oppWin ? 'var(--accent-rose, #ef4444)' : 'var(--accent-gold, #f59e0b)');

      return `
                <div class="match-card" style="padding:10px 12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
                  <!-- Riga Intestazione Partita -->
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;gap:6px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-subtle);font-size:0.68rem;padding:2px 6px;">${m.compLabel}</span>
                      <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" style="text-decoration:none;color:inherit;font-weight:700;display:inline-flex;align-items:center;gap:3px;" title="Vedi risultati ${m.matchday}ª giornata">
                        <span>${m.season}ª &bull; ${m.matchday}ª Giornata</span>
                        <span style="font-size:0.68rem;opacity:0.7;">↗</span>
                      </a>
                    </div>
                    <span style="font-size:0.7rem;color:var(--text-muted);">${this.formatDate(m.date || m.rawDate)}</span>
                  </div>

                  <!-- Riga Squadre e Risultato -->
                  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;">
                    <!-- Casa -->
                    <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                      <img src="img/sq/${encodeURI(m.homeTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.homeTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;flex-shrink:0;" alt="" />
                      <span style="font-size:0.82rem;font-weight:${m.isACasa ? '800' : '500'};color:${m.isACasa ? 'var(--text-primary)' : 'var(--text-secondary)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.homeTeam}">
                        ${m.homeTeam}
                      </span>
                    </div>

                    <!-- Pillola Risultato Centrata con Link -->
                    <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} style="text-decoration:none;color:inherit;display:block;" title="Vedi tabellino incontro">
                      <div style="text-align:center;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:4px 8px;min-width:70px;cursor:pointer;transition:border-color 0.15s, background 0.15s;">
                        <div style="font-size:1.05rem;font-weight:800;color:${resColor};line-height:1.1;">
                          ${m.homeScore} - ${m.awayScore}
                        </div>
                        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">
                          (${m.homePoints} - ${m.awayPoints})
                        </div>
                      </div>
                    </a>

                    <!-- Trasferta -->
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;text-align:right;">
                      <span style="font-size:0.82rem;font-weight:${!m.isACasa ? '800' : '500'};color:${!m.isACasa ? 'var(--text-primary)' : 'var(--text-secondary)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.awayTeam}">
                        ${m.awayTeam}
                      </span>
                      <img src="img/sq/${encodeURI(m.awayTeam)}.png" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURI(m.awayTeam)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}" style="height:22px;width:auto;flex-shrink:0;" alt="" />
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        ` : `
          <div class="text-center" style="padding:24px;color:var(--text-muted);">
            Nessun incontro disputato tra queste due fantasquadre con i filtri selezionati.
          </div>
        `}
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.confrontiStoriciView = confrontiStoriciView;
}
