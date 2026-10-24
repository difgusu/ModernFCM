/**
 * EXTRA & UTILITY VIEW
 * Incrocio Calendari, Scontri Diretti, Età Rose, Documenti, Archivio
 * ModernFCM
 */

const extraView = {
  currentTab: 'incroci', // 'incroci', 'confronti', 'eta', 'documenti', 'archivio'
  confrontiTeamA: null,   // Dinamico: prima squadra attiva per idAttuale (o da query param)
  confrontiTeamB: null,   // Dinamico: avversaria attiva con idAttuale successivo (o da query param)
  confrontiCompId: 0,    // 0 = Tutte
  etaTeamId: null,          // Default first team in current season
  incrociMode: null,     // 'squadra' (mobile-first), 'classifica' (panoramica), 'matrice' (tabella completa)
  incrociSelectedTeam: 0,
  incrociSort: 'default', // 'default', 'pts_desc', 'diff_desc'
  incrociExpandedTeam: null,

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

  async render(container) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (params.has('fsq') || params.has('teamA') || params.has('fsq1')) {
        const pId = parseInt(params.get('fsq') || params.get('teamA') || params.get('fsq1'), 10);
        if (!isNaN(pId)) this.confrontiTeamA = pId;
      }
      if (params.has('fsq2') || params.has('teamB') || params.has('fsqB')) {
        const pId2 = parseInt(params.get('fsq2') || params.get('teamB') || params.get('fsqB'), 10);
        if (!isNaN(pId2)) this.confrontiTeamB = pId2;
      }
    }

    // Fallback automatico se il tab corrente appartiene a un modulo disabilitato
    const tabRouteMap = {
      incroci: '#seavessiavuto',
      confronti: '#confronti',
      eta: '#etaRose',
      documenti: '#documenti',
      archivio: '#archivio',
      storico: '#storico'
    };
    if (typeof fcmModules !== 'undefined') {
      const currentRoute = tabRouteMap[this.currentTab] || '#' + this.currentTab;
      if (!fcmModules.isRouteEnabled(currentRoute)) {
        const candidateTabs = ['documenti', 'archivio', 'storico', 'confronti', 'incroci', 'eta'];
        const firstValid = candidateTabs.find(t => fcmModules.isRouteEnabled(tabRouteMap[t])) || 'documenti';
        this.currentTab = firstValid;
      }
    }

    const pageTitles = {
      incroci: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Se avessi avuto...', 'Simulazione dei calendari e della fortuna di lega'],
      confronti: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M8 4l-4 4 4 4"></path><path d="M4 8h11a5 5 0 0 1 5 5v1"></path><path d="M16 20l4-4-4-4"></path><path d="M20 16H9a5 5 0 0 1-5-5v-1"></path></svg> Scontri Diretti', 'Bilancio testa a testa tra le fantasquadre'],
      eta: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path><path d="M8 3l-2-2M16 3l2-2"></path></svg> Età Rose', 'Dati anagrafici e statistiche delle rose'],
      documenti: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line></svg> Documenti', 'Regolamenti, documenti ufficiali e modulistica'],
      archivio: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2"><path d="M3 6h18"></path><path d="M5 6v14h14V6"></path><path d="M9 10h6M9 14h6"></path><path d="M8 3h8l1 3H7l1-3z"></path></svg> Archivio Stagioni', 'Classifica, rose e risultati delle stagioni passate'],
      storico: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> Storico &amp; Records', 'Archivio storico, records e statistiche speciali']
    };
    const [pageTitle, pageSubtitle] = pageTitles[this.currentTab] || pageTitles.incroci;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              ${pageTitle}
            </div>
            <div class="card-subtitle">${pageSubtitle}</div>
          </div>
        </div>
        <div id="extraPageContent">
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento contenuti extra...
          </div>
        </div>
      </div>
    `;

    const tabContainer = container.querySelector('#extraPageContent');

    if (this.currentTab === 'incroci') {
      this.renderIncroci(tabContainer);
    } else if (this.currentTab === 'confronti') {
      await this.renderConfronti(tabContainer);
    } else if (this.currentTab === 'eta') {
      await this.renderEta(tabContainer);
    } else if (this.currentTab === 'documenti') {
      this.renderDocumenti(tabContainer);
    } else if (this.currentTab === 'archivio') {
      await this.renderArchivio(tabContainer);
    } else if (this.currentTab === 'storico') {
      this.renderStorico(tabContainer);
    }
  },

  /**
   * 0. Pagine Storiche, Records & Moduli Speciali
   */
  renderStorico(tabContainer) {
    const allCards = [
      {
        href: '#album',
        icon: '🎴',
        badge: 'ALBUM',
        badgeBg: 'rgba(6, 182, 212, 0.15)',
        badgeColor: 'var(--accent-cyan)',
        title: 'Album Calciatori Storico',
        desc: 'Collezione fotografica e storico di tutti i calciatori transitati nelle rose delle squadre di ModernFCM nel corso degli anni.',
        btnText: 'Apri Album Storico →'
      },
      {
        href: '#topflop',
        icon: '🏆',
        badge: 'TOP/FLOP 11',
        badgeBg: 'rgba(234, 179, 8, 0.15)',
        badgeColor: '#eab308',
        title: 'Top 11 & Flop 11 Storico',
        desc: 'I migliori e peggiori 11 di sempre per ciascuna fantasquadra, con filtri per modulo tattico e medie voto assolute.',
        btnText: 'Apri Top/Flop Storico →'
      },
      {
        href: '#confronti',
        icon: '⚔️',
        badge: 'CONFRONTI',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeColor: '#f59e0b',
        title: 'Confronti Storici & Precedenti',
        desc: 'Bilancio testa a testa all-time, dettaglio incontri disputati, palmarès e record storici con filtri per competizione e stadio.',
        btnText: 'Apri Confronti Storici →'
      },
      {
        href: '#almanacco',
        icon: '📜',
        badge: 'ALMANACCO',
        badgeBg: 'rgba(168, 85, 247, 0.15)',
        badgeColor: '#c084fc',
        title: 'Fanta Almanacco Storico',
        desc: 'Fedelissimi, migliori cannonieri all-time, classifica cattivi e bestie nere per ciascuna fantasquadra.',
        btnText: 'Apri Almanacco Storico →'
      },
      {
        href: '#rating',
        icon: '📊',
        badge: 'RATING',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
        badgeColor: '#60a5fa',
        title: 'Fanta Rating Fantasquadre',
        desc: 'Indice di forza, regolarità e rendimento storico complessivo calcolato sulle prestazioni di tutti i campionati.',
        btnText: 'Apri Fanta Rating →'
      },
      {
        href: '#topcosti',
        icon: '💰',
        badge: 'TOP COSTI STORICO',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#10b981',
        title: 'Top Costi Fantasquadre',
        desc: 'I record di spesa alle aste: i calciatori più pagati nella storia di ciascun presidente e fantasquadra.',
        btnText: 'Apri Top Costi Storico →'
      },
      {
        href: '#topcostistagione',
        icon: '🏷️',
        badge: 'TOP COSTI STAGIONE',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#10b981',
        title: 'Top Costi Stagione',
        desc: "Classifica dei colpi più onerosi dell'ultima asta estiva e di riparazione della stagione in corso.",
        btnText: 'Apri Top Costi Stagione →'
      },
      {
        href: '#fantaMassimi',
        icon: '⚡',
        badge: 'SIMULATORE',
        badgeBg: 'rgba(168, 85, 247, 0.15)',
        badgeColor: '#c084fc',
        title: 'FantaMassimi di Giornata',
        desc: 'Risultati ipotetici ricalcolati ipotizzando che entrambe le formazioni avessero schierato la formazione ideale.',
        btnText: 'Apri FantaMassimi →'
      },
      {
        href: '#fantaClassifica',
        icon: '📈',
        badge: 'CLASSIFICA IPOTETICA',
        badgeBg: 'rgba(236, 72, 153, 0.15)',
        badgeColor: '#f472b6',
        title: 'FantaClassifica Ipotetica',
        desc: 'La graduatoria ordinabile per punti persi, gol mancati, scarto tecnico e miglior fantamister della lega.',
        btnText: 'Apri FantaClassifica →'
      },
      {
        href: '#records',
        icon: '🎖️',
        badge: 'RECORD STAGIONE',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#10b981',
        title: 'Records di Lega FCM',
        desc: 'Tutti i record della stagione in corso: maggior numero di punti fatti, strisce vincenti, minor numero di sconfitte e goleade.',
        btnText: 'Visualizza Records →'
      },
      {
        href: '#fantam',
        icon: '👔',
        badge: 'ANALISI TECNICA',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
        badgeColor: '#60a5fa',
        title: 'FantaMister Avanzato',
        desc: 'Valutazione delle scelte dei mister: incompresi in panchina, migliori rose, classifica marcatori e top/flop.',
        btnText: 'Apri FantaMister →'
      },
      {
        href: '#indisponibili',
        icon: '🏥',
        badge: 'INFERMERIA',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeColor: '#ef4444',
        title: 'Indisponibili & Infortunati',
        desc: 'Monitoraggio infortuni Serie A, report indisponibili per ciascuna fantasquadra e lista infortunati registrata.',
        btnText: 'Report Indisponibili →'
      },
      {
        href: '#schede_giocatori',
        icon: '👤',
        badge: 'STATISTICHE A',
        badgeBg: 'rgba(14, 165, 233, 0.15)',
        badgeColor: '#0284c7',
        title: 'Schede Giocatori Serie A',
        desc: 'Database completo con statistiche sul campo, medie voto casa/fuori, fantamedia, indici di affidabilità e contratti.',
        btnText: 'Apri Schede Giocatori →'
      },
      {
        href: '#gbook',
        icon: '💬',
        badge: 'COMMUNITY',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#10b981',
        title: 'Guestbook di Lega',
        desc: 'Bacheca messaggi, commenti e discussioni aperta a tutti i presidenti e fantallenatori della lega.',
        btnText: 'Apri Guestbook →'
      }
    ];

    const activeCards = (typeof fcmModules !== 'undefined')
      ? allCards.filter(c => fcmModules.isRouteEnabled(c.href))
      : allCards;

    tabContainer.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">
          Archivio Storico, Records &amp; Statistiche Speciali
        </h3>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
          Tutti i moduli storici, simulazioni, primati di lega e report aggiornati di ModernFCM.
        </p>
      </div>

      <div class="quick-links-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${activeCards.map(c => `
          <div class="card" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                <span style="font-size: 1.8rem;">${c.icon}</span>
                <span class="badge" style="background: ${c.badgeBg}; color: ${c.badgeColor}; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px; font-weight: 700;">${c.badge}</span>
              </div>
              <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${c.title}</h4>
              <p style="margin: 0 0 14px 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">${c.desc}</p>
            </div>
            <a href="${c.href}" class="btn-invio-form" style="text-align: center; text-decoration: none; padding: 8px 14px; font-size: 0.82rem;">${c.btnText}</a>
          </div>
        `).join('')}
      </div>
    `;
  },


  /**
   * 1. Incrocio Calendari ("Se avessi avuto...")
   */
  renderIncroci(tabContainer) {
    const incroci = fcmDataLoader.getIncrociData();
    if (!incroci || incroci.teams.length === 0) {
      tabContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati incrocio calendari non disponibili.</div>`;
      return;
    }

    const N = incroci.teams.length;
    const teamsData = [];
    const scheduleStats = [];

    // Calculate stats for all teams
    for (let i = 0; i < N; i++) {
      const team = incroci.teams[i];
      const realPts = (incroci.matrix[i] && incroci.matrix[i][i] !== undefined) ? incroci.matrix[i][i] : 0;
      let sumRow = 0;
      let sumCol = 0;
      const scenarios = [];

      for (let j = 0; j < N; j++) {
        const oppTeam = incroci.teams[j];
        const pts = (incroci.matrix[i] && incroci.matrix[i][j] !== undefined) ? incroci.matrix[i][j] : 0;
        const diff = pts - realPts;
        const oppColPts = (incroci.matrix[j] && incroci.matrix[j][i] !== undefined) ? incroci.matrix[j][i] : 0;
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

      // Identify best and worst scenario
      let best = scenarios[0];
      let worst = scenarios[0];
      for (const sc of scenarios) {
        if (sc.pts > best.pts) best = sc;
        if (sc.pts < worst.pts) worst = sc;
      }

      teamsData.push({
        index: i,
        team: team,
        realPts: realPts,
        avgPts: avgPts,
        luckDiff: luckDiff,
        best: best,
        worst: worst,
        scenarios: scenarios
      });

      scheduleStats.push({
        index: i,
        team: team,
        killerAvg: sumCol / N
      });
    }

    // Sort luck (descending: highest positive luckDiff is most lucky)
    const sortedLuck = [...teamsData].sort((a, b) => b.luckDiff - a.luckDiff);
    // Sort schedule (descending: highest points conceded is easiest schedule, lowest is hardest)
    const sortedSchedule = [...scheduleStats].sort((a, b) => b.killerAvg - a.killerAvg);

    const luckiest = sortedLuck.filter(s => Math.abs(s.luckDiff - sortedLuck[0].luckDiff) < 0.05);
    const unluckiest = sortedLuck.filter(s => Math.abs(s.luckDiff - sortedLuck[sortedLuck.length - 1].luckDiff) < 0.05);
    const easiest = sortedSchedule.filter(s => Math.abs(s.killerAvg - sortedSchedule[0].killerAvg) < 0.05);
    const hardest = sortedSchedule.filter(s => Math.abs(s.killerAvg - sortedSchedule[sortedSchedule.length - 1].killerAvg) < 0.05);

    // Auto-detect mode if not set: mobile screens (< 768px) default to 'squadra', desktop to 'matrice'
    if (!this.incrociMode) {
      this.incrociMode = (window.innerWidth < 768) ? 'squadra' : 'matrice';
    }
    if (this.incrociSelectedTeam < 0 || this.incrociSelectedTeam >= N) {
      this.incrociSelectedTeam = 0;
    }

    const self = this;

    const renderContent = () => {
      const mode = self.incrociMode;
      const curr = teamsData[self.incrociSelectedTeam] || teamsData[0];

      // Helper for difference tags
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

      // 1. HTML for Mode "squadra" (Zero scroll, mobile-first)
      const renderSquadraView = () => {
        let listScenarios = [...curr.scenarios];
        if (self.incrociSort === 'pts_desc') {
          listScenarios.sort((a, b) => b.pts - a.pts);
        }

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
                ${teamsData.map(t => `<option value="${t.index}" ${t.index === curr.index ? 'selected' : ''}>${t.team} (${t.realPts} pt)</option>`).join('')}
              </select>
              <button type="button" class="incroci-nav-btn incroci-next-btn" title="Squadra successiva" aria-label="Squadra successiva">›</button>
            </div>
          </div>

          <!-- Hero Summary Card -->
          <div class="incroci-hero-card">
            <div class="incroci-hero-header">
              <div class="incroci-team-profile">
                <img src="${fcmDataLoader.getTeamLogo(curr.team)}" class="incroci-team-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${curr.team}" />
                <div>
                  <h3 style="margin:0;font-size:1.25rem;font-weight:800;color:var(--text-primary);line-height:1.2;">${curr.team}</h3>
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
                  ${curr.best.oppTeam} &rarr; <span style="color:var(--accent-emerald);font-weight:800;">${curr.best.pts} pt</span>
                  <span style="font-size:0.75rem;color:var(--accent-emerald);">(+${curr.best.diff} pt)</span>
                </div>
              </div>
              <div style="flex:1;min-width:180px;">
                <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">⚠️ Peggior Calendario:</span>
                <div style="font-weight:700;color:var(--text-primary);margin-top:2px;">
                  ${curr.worst.oppTeam} &rarr; <span style="color:var(--accent-rose);font-weight:800;">${curr.worst.pts} pt</span>
                  <span style="font-size:0.75rem;color:var(--accent-rose);">(${curr.worst.diff} pt)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Schedule List (Zero Horizontal Scroll!) -->
          <div class="incroci-list-container">
            <div class="incroci-list-toolbar">
              <span style="font-weight:600;">Risultati con i 10 calendari:</span>
              <div class="incroci-sort-btns">
                <button type="button" class="incroci-sort-btn ${self.incrociSort === 'default' ? 'active' : ''}" data-incroci-sort="default">
                  Calendario
                </button>
                <button type="button" class="incroci-sort-btn ${self.incrociSort === 'pts_desc' ? 'active' : ''}" data-incroci-sort="pts_desc">
                  Più Punti
                </button>
              </div>
            </div>

            ${listScenarios.map(sc => `
              <div class="incroci-schedule-item ${sc.isOwn ? 'is-own' : ''}">
                <div class="incroci-opponent-info">
                  <img src="${fcmDataLoader.getTeamLogo(sc.oppTeam)}" class="incroci-opponent-logo" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="${sc.oppTeam}" />
                  <div style="min-width:0;">
                    <div class="incroci-opponent-name">${sc.oppTeam}</div>
                    <div class="incroci-opponent-sub">${sc.isOwn ? '★ Il tuo calendario effettivo' : 'Calendario di ' + sc.oppTeam}</div>
                  </div>
                </div>
                <div class="incroci-schedule-score">
                  <div class="incroci-pts-badge">${sc.pts} <span style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">pt</span></div>
                  ${getDiffTag(sc.diff, sc.isOwn)}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      };

      // 2. HTML for Mode "classifica" (Accordion on demand)
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
          const luckBadge = t.luckDiff > 0.05
            ? `<span class="cell-matrix cell-better" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">+${t.luckDiff.toFixed(1)}</span>`
            : (t.luckDiff < -0.05
              ? `<span class="cell-matrix cell-worse" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">${t.luckDiff.toFixed(1)}</span>`
              : `<span class="cell-matrix cell-equal" style="padding:3px 6px;font-size:0.72rem;display:inline-block;">0.0</span>`);

          return `
                <div class="incroci-ranking-row ${isExpanded ? 'is-active' : ''}" data-incroci-toggle="${t.index}" title="Tocca per espandere il dettaglio">
                  <span style="font-weight:700;color:var(--text-muted);">${rank + 1}</span>
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <img src="${fcmDataLoader.getTeamLogo(t.team)}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                    <span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.team}</span>
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
                        🍀 <strong>Migliore:</strong> ${t.best.oppTeam} (<strong>${t.best.pts} pt</strong>, +${t.best.diff}) &nbsp;|&nbsp;
                        🌧️ <strong>Peggiore:</strong> ${t.worst.oppTeam} (<strong>${t.worst.pts} pt</strong>, ${t.worst.diff})
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
            return `
                          <div class="cell-matrix ${cls} incroci-mini-chip" title="Con calendario di ${sc.oppTeam}: ${sc.pts} pt">
                            <span>${sc.oppTeam.length > 6 ? sc.oppTeam.slice(0, 5) + '.' : sc.oppTeam}:</span>
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

      // 3. HTML for Mode "matrice" (Complete cross-table with sticky first column)
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
                    ${incroci.teams.map(t => `
                      <th class="text-center" style="font-size:0.72rem;padding:8px 4px;min-width:56px;" title="Calendario di ${t}">
                        ${t.length > 8 ? t.slice(0, 7) + '.' : t}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${incroci.teams.map((t, idx) => {
          const own = incroci.matrix[idx] ? incroci.matrix[idx][idx] : 0;
          return `
                      <tr>
                        <td class="font-bold incroci-clickable-team" data-team-index="${idx}" title="Clicca per aprire la scheda di ${t}" style="white-space:nowrap;">
                          <span style="display:inline-flex;align-items:center;gap:6px;">
                            <img src="${fcmDataLoader.getTeamLogo(t)}" style="width:18px;height:18px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                            ${t}
                          </span>
                        </td>
                        ${incroci.matrix[idx] ? incroci.matrix[idx].map((pts, cIdx) => {
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
                            <td class="${cellCls}" title="${t} con calendario di ${incroci.teams[cIdx]}: ${pts} pt (reali: ${own} pt)">
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

      // Main Outer Template
      tabContainer.innerHTML = `
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
              ${luckiest.map(l => `
                <div class="font-bold incroci-clickable-team" data-team-index="${l.index}" title="Clicca per aprire la scheda di ${l.team}" style="font-size:1.1rem;color:var(--accent-emerald);margin-bottom:4px;">
                  ${l.team}
                </div>
                <div style="font-size:0.78rem;color:var(--text-secondary);">
                  <strong>${l.realPts} pt</strong> reali (<strong>+${l.luckDiff.toFixed(1)} pt</strong> rispetto alla media di ${l.avgPts.toFixed(1)})
                </div>
              `).join('')}
            </div>

            <!-- 2. Unluckiest -->
            <div class="card" style="padding:16px;border-left:4px solid var(--accent-rose);margin-bottom:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.2rem;">🌧️</span>
                <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Squadra Più Sfortunata</span>
              </div>
              ${unluckiest.map(u => `
                <div class="font-bold incroci-clickable-team" data-team-index="${u.index}" title="Clicca per aprire la scheda di ${u.team}" style="font-size:1.1rem;color:var(--accent-rose);margin-bottom:4px;">
                  ${u.team}
                </div>
                <div style="font-size:0.78rem;color:var(--text-secondary);">
                  <strong>${u.realPts} pt</strong> reali (<strong>${u.luckDiff.toFixed(1)} pt</strong> rispetto alla media di ${u.avgPts.toFixed(1)})
                </div>
              `).join('')}
            </div>

            <!-- 3. Easiest Schedule -->
            <div class="card" style="padding:16px;border-left:4px solid var(--accent-cyan);margin-bottom:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.2rem;">🎯</span>
                <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Calendario Più Facile</span>
              </div>
              ${easiest.map(e => `
                <div class="font-bold incroci-clickable-team" data-team-index="${e.index}" title="Clicca per aprire la scheda di ${e.team}" style="font-size:1.1rem;color:var(--accent-cyan);margin-bottom:4px;">
                  ${e.team}
                </div>
                <div style="font-size:0.78rem;color:var(--text-secondary);">
                  Le fantasquadre avrebbero totalizzato <strong>${e.killerAvg.toFixed(1)} pt</strong> di media
                </div>
              `).join('')}
            </div>

            <!-- 4. Hardest Schedule -->
            <div class="card" style="padding:16px;border-left:4px solid var(--accent-gold);margin-bottom:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.2rem;">🔥</span>
                <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Calendario Più Difficile</span>
              </div>
              ${hardest.map(h => `
                <div class="font-bold incroci-clickable-team" data-team-index="${h.index}" title="Clicca per aprire la scheda di ${h.team}" style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:4px;">
                  ${h.team}
                </div>
                <div style="font-size:0.78rem;color:var(--text-secondary);">
                  Le fantasquadre avrebbero totalizzato solo <strong>${h.killerAvg.toFixed(1)} pt</strong> di media
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      attachEvents();
    };

    const attachEvents = () => {
      // 1. Switch Mode Tabs
      tabContainer.querySelectorAll('[data-incroci-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const newMode = btn.getAttribute('data-incroci-mode');
          if (newMode && newMode !== self.incrociMode) {
            self.incrociMode = newMode;
            renderContent();
          }
        });
      });

      // 2. Team Select in Squadra View
      const teamSelect = tabContainer.querySelector('#incrociTeamSelect');
      if (teamSelect) {
        teamSelect.addEventListener('change', (e) => {
          self.incrociSelectedTeam = parseInt(e.target.value, 10) || 0;
          renderContent();
        });
      }

      // Prev / Next Team Buttons
      const prevBtn = tabContainer.querySelector('.incroci-prev-btn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          self.incrociSelectedTeam = (self.incrociSelectedTeam - 1 + N) % N;
          renderContent();
        });
      }

      const nextBtn = tabContainer.querySelector('.incroci-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          self.incrociSelectedTeam = (self.incrociSelectedTeam + 1) % N;
          renderContent();
        });
      }

      // Sort Buttons
      tabContainer.querySelectorAll('[data-incroci-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
          self.incrociSort = btn.getAttribute('data-incroci-sort');
          renderContent();
        });
      });

      // Accordion Toggle in Classifica View
      tabContainer.querySelectorAll('[data-incroci-toggle]').forEach(row => {
        row.addEventListener('click', () => {
          const idx = parseInt(row.getAttribute('data-incroci-toggle'), 10);
          self.incrociExpandedTeam = (self.incrociExpandedTeam === idx) ? null : idx;
          renderContent();
        });
      });

      // Jump to Team in Squadra View
      tabContainer.querySelectorAll('[data-team-index], .incroci-jump-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(el.getAttribute('data-team-index'), 10);
          if (!isNaN(idx)) {
            self.incrociSelectedTeam = idx;
            self.incrociMode = 'squadra';
            renderContent();
            tabContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    };

    renderContent();
  },

  /**
   * 2. Scontri Diretti (Head-to-head)
   */
  async renderConfronti(tabContainer) {
    const conf = await fcmDataLoader.loadConfronti();
    if (!conf || !conf.teams || conf.teams.length === 0) {
      tabContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati confronti non disponibili.</div>`;
      return;
    }

    const teamA = fcmDataLoader.getDefaultHistoricalTeam(conf.teams, this.confrontiTeamA) || conf.teams[0];
    this.confrontiTeamA = teamA.id;

    const teamB = fcmDataLoader.getDefaultHistoricalOpponent(conf.teams, teamA.id, this.confrontiTeamB) || conf.teams.find(t => t.id !== teamA.id) || conf.teams[0];
    this.confrontiTeamB = teamB.id;

    const h2h = conf.getHeadToHead(teamA.id, teamB.id, this.confrontiCompId);
    await fcmDataLoader.resolveMatchesLinks(h2h.matches);

    let html = `
      <div>
        <!-- Link to Full Historical Confrontations -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);padding:10px 14px;border-radius:var(--radius-md);">
          <div style="font-size:0.82rem;color:var(--text-secondary);">
            <strong style="color:#f59e0b;">⚔️ Archivio Storico Completo:</strong> Consulta il palmarès, tutti i precedenti e i primati storici.
          </div>
          <a href="#confronti" class="standalone-btn" style="padding:4px 12px;font-size:0.75rem;text-decoration:none;">Vai a Confronti Storici &rarr;</a>
        </div>

        <!-- Head-to-Head Controls -->
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:20px;background:var(--bg-surface-elevated);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Squadra A:
            </label>
            <select id="selConfA" class="form-select" style="width:100%;font-weight:700;">
              ${conf.teams.map(t => `
                <option value="${t.id}" ${t.id === teamA.id ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Squadra B:
            </label>
            <select id="selConfB" class="form-select" style="width:100%;font-weight:700;">
              ${conf.teams.map(t => `
                <option value="${t.id}" ${t.id === teamB.id ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:140px;">
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Competizione:
            </label>
            <select id="selConfComp" class="form-select" style="width:100%;font-weight:700;">
              <option value="0" ${this.confrontiCompId === 0 ? 'selected' : ''}>Tutte le Gare</option>
              ${(conf.competitions || []).map(c => `
                <option value="${c.id}" ${this.confrontiCompId === c.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Head-to-Head Big Match Card -->
        <div class="h2h-summary-card">
          <div class="h2h-teams-header">
            <div class="h2h-team-col">
              <img src="${fcmDataLoader.getTeamLogo(teamA.name || teamA.currentId)}" class="h2h-team-logo" style="object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div class="h2h-team-name">${teamA.name}</div>
            </div>

            <div>
              <span class="h2h-vs-badge">VS</span>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">
                ${h2h.matchesCount} Precedenti
              </div>
            </div>

            <div class="h2h-team-col">
              <img src="${fcmDataLoader.getTeamLogo(teamB.name || teamB.currentId)}" class="h2h-team-logo" style="object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div class="h2h-team-name">${teamB.name}</div>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="h2h-stats-grid">
            <div class="h2h-stat-box">
              <div class="h2h-stat-label">Vittorie</div>
              <div class="h2h-stat-values">
                <span class="h2h-stat-val-a">${h2h.winsA}</span>
                <span style="font-size:0.8rem;color:var(--text-muted);">-</span>
                <span class="h2h-stat-val-b">${h2h.winsB}</span>
              </div>
            </div>

            <div class="h2h-stat-box">
              <div class="h2h-stat-label">Pareggi</div>
              <div class="h2h-stat-values" style="color:var(--accent-gold);">
                ${h2h.draws}
              </div>
            </div>

            <div class="h2h-stat-box">
              <div class="h2h-stat-label">Gol Totali</div>
              <div class="h2h-stat-values">
                <span class="h2h-stat-val-a">${h2h.goalsA}</span>
                <span style="font-size:0.8rem;color:var(--text-muted);">-</span>
                <span class="h2h-stat-val-b">${h2h.goalsB}</span>
              </div>
            </div>

            <div class="h2h-stat-box">
              <div class="h2h-stat-label">Fantapunti Totali</div>
              <div class="h2h-stat-values">
                <span class="h2h-stat-val-a" style="font-size:0.95rem;">${h2h.pointsA}</span>
                <span style="font-size:0.8rem;color:var(--text-muted);">-</span>
                <span class="h2h-stat-val-b" style="font-size:0.95rem;">${h2h.pointsB}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Historical Matches List -->
        <div style="margin-top:20px;">
          <div style="font-weight:700;font-size:0.95rem;margin-bottom:10px;color:var(--text-primary);">
            Cronologia Incontri Disputati (${h2h.matches.length})
          </div>

          ${h2h.matches.length > 0 ? `
            <style>
              @media (max-width: 768px) {
                .extra-h2h-desktop-view { display: none !important; }
                .extra-h2h-mobile-view { display: flex !important; flex-direction: column; gap: 8px; }
              }
              @media (min-width: 769px) {
                .extra-h2h-desktop-view { display: block !important; }
                .extra-h2h-mobile-view { display: none !important; }
              }
            </style>

            <!-- Visualizzazione Desktop: Tabella Classica -->
            <div class="extra-h2h-desktop-view table-responsive">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th class="text-center">Stagione</th>
                    <th class="text-center">Comp.</th>
                    <th class="text-center">G. di A</th>
                    <th style="text-align:right;">Casa</th>
                    <th class="text-center" style="width:90px;">Risultato</th>
                    <th>Fuori</th>
                    <th class="text-center">Fantapunti</th>
                    <th class="text-center">Data</th>
                  </tr>
                </thead>
                <tbody>
                  ${h2h.matches.map(m => `
                    <tr>
                      <td class="text-center font-bold">${m.season}ª</td>
                      <td class="text-center"><span class="badge badge-primary" style="font-size:0.65rem;">${m.compLabel}</span></td>
                      <td class="text-center font-bold">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" title="Vedi risultati ${m.matchday}ª giornata">
                          ${m.matchday}ª
                        </a>
                      </td>
                      <td style="text-align:right;font-weight:700;color:${m.homeTeam === teamA.name ? 'var(--accent-primary)' : m.homeTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};">
                        ${m.homeTeam}
                      </td>
                      <td class="text-center font-bold" style="font-size:1.05rem;background:rgba(255,255,255,0.03);">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link result-link" style="text-decoration:none;color:inherit;display:block;" title="Vedi tabellino incontro">
                          ${m.homeScore} - ${m.awayScore}
                        </a>
                      </td>
                      <td style="font-weight:700;color:${m.awayTeam === teamA.name ? 'var(--accent-primary)' : m.awayTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};">
                        ${m.awayTeam}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.8rem;">
                        ${m.homePoints} - ${m.awayPoints}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">
                        ${this.formatDate(m.date || m.rawDate)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Visualizzazione Mobile: Card Responsive -->
            <div class="extra-h2h-mobile-view">
              ${h2h.matches.map(m => {
      const aIsHome = m.homeTeam === teamA.name;
      const myWin = (aIsHome && m.homeScore > m.awayScore) || (!aIsHome && m.awayScore > m.homeScore);
      const bWin = (aIsHome && m.homeScore < m.awayScore) || (!aIsHome && m.awayScore < m.homeScore);
      let resColor = myWin ? 'var(--accent-emerald, #10b981)' : (bWin ? 'var(--accent-rose, #ef4444)' : 'var(--accent-gold, #f59e0b)');

      return `
                  <div class="match-card" style="padding:10px 12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
                    <!-- Riga Intestazione Partita -->
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;gap:6px;flex-wrap:wrap;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span class="badge badge-primary" style="font-size:0.65rem;padding:2px 6px;">${m.compLabel}</span>
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
                        <img src="${fcmDataLoader.getTeamLogo(m.homeTeam)}" style="height:22px;width:auto;flex-shrink:0;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                        <span style="font-size:0.82rem;font-weight:700;color:${m.homeTeam === teamA.name ? 'var(--accent-primary)' : m.homeTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.homeTeam}">
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
                        <span style="font-size:0.82rem;font-weight:700;color:${m.awayTeam === teamA.name ? 'var(--accent-primary)' : m.awayTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.awayTeam}">
                          ${m.awayTeam}
                        </span>
                        <img src="${fcmDataLoader.getTeamLogo(m.awayTeam)}" style="height:22px;width:auto;flex-shrink:0;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                      </div>
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
          ` : `
            <div class="text-center" style="padding:24px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:var(--radius-md);">
              Nessun incontro disputato tra le due squadre nei parametri selezionati.
            </div>
          `}
        </div>

      </div>
    `;

    tabContainer.innerHTML = html;

    tabContainer.querySelector('#selConfA')?.addEventListener('change', (e) => {
      this.confrontiTeamA = parseInt(e.target.value, 10);
      this.renderConfronti(tabContainer);
    });

    tabContainer.querySelector('#selConfB')?.addEventListener('change', (e) => {
      this.confrontiTeamB = parseInt(e.target.value, 10);
      this.renderConfronti(tabContainer);
    });

    tabContainer.querySelector('#selConfComp')?.addEventListener('change', (e) => {
      this.confrontiCompId = parseInt(e.target.value, 10);
      this.renderConfronti(tabContainer);
    });
  },

  /**
   * 3. Età & Dati Rose
   */
  async renderEta(tabContainer) {
    const squads = await fcmDataLoader.loadSquadreEta();
    if (!squads || squads.length === 0) {
      tabContainer.innerHTML = `<div class="text-center" style="padding:20px;color:var(--text-muted);">Dati anagrafici giocatori non disponibili.</div>`;
      return;
    }

    // Risoluzione dinamica della fantasquadra (prima squadra di arrFantasquadre se non specificata)  
    const currentSquad = (this.etaTeamId && squads.find(s => s.teamId === this.etaTeamId)) || squads[0] || { ID: 1, Nome: 'Fantasquadra' };
    this.etaTeamId = currentSquad.ID;

    let html = `
      <div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">
          Statistiche anagrafiche ufficiali calcolate su tutti i 25 calciatori tesserati in rosa per la stagione in corso.
        </p>

        <!-- All Squads Overview Grid -->
        <div style="margin-bottom:24px;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            Classifica Età Media Fantasquadre
          </div>
          <div class="age-summary-grid">
            ${squads.map(s => `
              <div class="age-stat-card" style="border-left:3px solid ${s.teamId === currentSquad.teamId ? 'var(--accent-cyan)' : 'transparent'};cursor:pointer;" onclick="extraView.selectSquadEta(${s.teamId})">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <img src="${fcmDataLoader.getTeamLogo(s.teamId)}" style="width:24px;height:24px;border-radius:4px;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <span style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">${s.teamName}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span style="font-size:0.75rem;color:var(--text-muted);">Età Media:</span>
                  <span class="age-stat-num">${s.avgAge} <span style="font-size:0.75rem;font-weight:normal;color:var(--text-muted);">anni</span></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Selected Squad Details -->
        <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${fcmDataLoader.getTeamLogo(currentSquad.teamId)}" style="width:36px;height:36px;border-radius:6px;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
              <div>
                <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);">${currentSquad.teamName}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">Presidente: <b>${currentSquad.coach}</b> • ${currentSquad.playersCount} Giocatori</div>
              </div>
            </div>

            <!-- Team Selector -->
            <div>
              <select id="selSquadEta" class="form-select" style="font-weight:700;min-width:180px;">
                ${squads.map(s => `
                  <option value="${s.teamId}" ${s.teamId === currentSquad.teamId ? 'selected' : ''}>${s.teamName}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Squad Highlights -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
            <div style="background:var(--bg-main);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Età Media Rosa</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--accent-cyan);">${currentSquad.avgAge} anni</div>
            </div>

            ${currentSquad.youngest ? `
              <div style="background:var(--bg-main);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">👶 Più Giovane</div>
                <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">${currentSquad.youngest.name}</div>
                <div style="font-size:0.75rem;color:var(--accent-emerald);font-weight:700;">${currentSquad.youngest.age} anni (${currentSquad.youngest.birthDate})</div>
              </div>
            ` : ''}

            ${currentSquad.oldest ? `
              <div style="background:var(--bg-main);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">👴 Più Anziano</div>
                <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">${currentSquad.oldest.name}</div>
                <div style="font-size:0.75rem;color:var(--accent-gold);font-weight:700;">${currentSquad.oldest.age} anni (${currentSquad.oldest.birthDate})</div>
              </div>
            ` : ''}

            <div style="background:var(--bg-main);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Altezza / Peso Medi</div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">
                ${currentSquad.avgHeight !== '-' ? currentSquad.avgHeight + ' cm' : '-'} • ${currentSquad.avgWeight !== '-' ? currentSquad.avgWeight + ' kg' : '-'}
              </div>
            </div>
          </div>

          <!-- Roster Table -->
          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th class="text-center" style="width:40px;">R</th>
                  <th>Calciatore</th>
                  <th class="text-center">Club Serie A</th>
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
                    <td class="font-bold">
                      ${p.name}
                    </td>
                    <td class="text-center">
                      <span style="font-size:0.8rem;color:var(--text-muted);">${p.serieATeam}</span>
                    </td>
                    <td style="font-size:0.8rem;color:var(--text-muted);">
                      ${p.birthPlace}
                    </td>
                    <td class="text-center" style="font-size:0.8rem;">
                      ${p.birthDate}
                    </td>
                    <td class="text-center font-bold" style="color:var(--accent-cyan);">
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
        </div>

      </div>
    `;

    tabContainer.innerHTML = html;

    tabContainer.querySelector('#selSquadEta')?.addEventListener('change', (e) => {
      this.etaTeamId = parseInt(e.target.value, 10);
      this.renderEta(tabContainer);
    });
  },

  selectSquadEta(teamId) {
    this.etaTeamId = parseInt(teamId, 10);
    const tabContainer = document.querySelector('#extraPageContent');
    if (tabContainer) {
      this.renderEta(tabContainer);
    }
  },

  /**
   * 4. Documenti
   */
  renderDocumenti(tabContainer) {
    const docs = fcmDataLoader.getDocuments();
    const nomeLegaCorrente = (typeof nomelega !== 'undefined' && nomelega) ? nomelega : 'Lega';

    const getFileInfo = (filename) => {
      const ext = (filename && filename.includes('.')) ? filename.split('.').pop().toLowerCase() : '';
      switch (ext) {
        case 'pdf':
          return {
            extLabel: 'PDF',
            btnLabel: 'Scarica PDF',
            color: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line></svg>`
          };
        case 'xls':
        case 'xlsx':
        case 'csv':
        case 'ods':
          return {
            extLabel: ext.toUpperCase(),
            btnLabel: `Scarica ${ext.toUpperCase()}`,
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`
          };
        case 'doc':
        case 'docx':
        case 'odt':
        case 'rtf':
          return {
            extLabel: ext.toUpperCase(),
            btnLabel: `Scarica ${ext.toUpperCase()}`,
            color: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`
          };
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
          return {
            extLabel: ext.toUpperCase(),
            btnLabel: `Scarica ${ext.toUpperCase()}`,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`
          };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
        case 'gif':
          return {
            extLabel: ext.toUpperCase(),
            btnLabel: `Scarica Immagine`,
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
          };
        case 'txt':
          return {
            extLabel: 'TXT',
            btnLabel: 'Scarica Testo',
            color: '#6b7280',
            bg: 'rgba(107, 114, 128, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
          };
        default:
          return {
            extLabel: ext ? ext.toUpperCase() : 'FILE',
            btnLabel: ext ? `Scarica ${ext.toUpperCase()}` : 'Scarica File',
            color: 'var(--accent-primary, #3b82f6)',
            bg: 'rgba(59, 130, 246, 0.12)',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
          };
      }
    };

    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character] || character));

    tabContainer.innerHTML = `
      <div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;">
          Documenti ufficiali, regolamenti e modulistica di ${escapeHtml(nomeLegaCorrente)}.
        </p>
        ${docs.length > 0 ? docs.map(d => {
      const fileInfo = getFileInfo(d.Nomefile);
      const updateInfo = d.UltimoAggiornamento ? ` • Aggiornato: ${escapeHtml(d.UltimoAggiornamento)}` : '';
      return `
          <div class="doc-card">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:38px;height:38px;border-radius:var(--radius-sm);background:${fileInfo.bg};display:flex;align-items:center;justify-content:center;color:${fileInfo.color};flex-shrink:0;">
                ${fileInfo.icon}
              </div>
              <div class="doc-info">
                <div class="doc-title">${escapeHtml(d.Descrizione || d.Nomefile)}</div>
                <div class="doc-meta">Categoria: <b>${escapeHtml(d.Categoria || 'Generale')}</b> • Formato: <b>${fileInfo.extLabel}</b> • Dimensione: ${d.Dimensione} KB${updateInfo}</div>
              </div>
            </div>
            <a href="doc/${encodeURIComponent(d.Nomefile)}" target="_blank" download="${escapeHtml(d.Nomefile)}" class="doc-download-btn" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              ${fileInfo.btnLabel}
            </a>
          </div>
        `;
    }).join('') : `
          <div class="text-center" style="padding:24px;color:var(--text-muted);">
            Nessun documento caricato per la stagione corrente.
          </div>
        `}
      </div>
    `;
  },

  /**
   * 5. Archivio
   */
  async renderArchivio(tabContainer) {
    await fcmDataLoader.loadConfronti();

    const currentSeason = fcmDataLoader.getCurrentSeason();
    const currentYearStart = typeof anno !== 'undefined' ? Number(String(anno).split('/')[0]) : null;
    const historicalSeasons = (await Promise.all((typeof arrDirectory !== 'undefined' ? arrDirectory : [])
      .filter(directory => directory && Number(directory.Stagione) !== currentSeason)
      .map(async directory => {
        const seasonNumber = Number(directory.Stagione);
        const directoryPath = String(directory.Directory).replace(/^\.\//, '').replace(/\/$/, '');
        const seasonYearOffset = currentSeason !== null && currentYearStart !== null
          ? currentSeason - seasonNumber
          : null;
        const seasonYear = Number.isFinite(seasonYearOffset) && Number.isFinite(currentYearStart)
          ? `${currentYearStart - seasonYearOffset}/${currentYearStart - seasonYearOffset + 1}`
          : '';
        const indexFile = await ['index.php', 'index.htm', 'index.html']
          .reduce(async (foundFile, candidate) => {
            const selectedFile = await foundFile;
            if (selectedFile) {
              return selectedFile;
            }

            try {
              const response = await fetch(`${directoryPath}/${candidate}`, {
                method: 'HEAD',
                cache: 'no-store'
              });
              return response.ok ? candidate : null;
            } catch (error) {
              return null;
            }
          }, Promise.resolve(null));

        return indexFile ? {
          num: seasonNumber,
          year: seasonYear,
          path: `${directoryPath}/${indexFile}`
        } : null;
      })
    )).filter(Boolean)
      .sort((a, b) => b.num - a.num);

    tabContainer.innerHTML = `
      <div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;">
              Consulta l'archivio completo delle stagioni passate di ModernFCM con classifica, risultati, tabellini e rose originali:
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
          ${historicalSeasons.map(s => `
            <a href="${s.path}" target="_blank" style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px;text-decoration:none;display:flex;align-items:center;justify-content:space-between;transition:transform 0.15s,border-color 0.15s;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:34px;height:34px;border-radius:var(--radius-sm);background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;color:var(--accent-purple);flex-shrink:0;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M5 6v14h14V6"></path>
                    <path d="M9 10h6M9 14h6"></path>
                    <path d="M8 3h8l1 3H7l1-3z"></path>
                  </svg>
                </div>
                <div>
                  <div style="font-weight:700;color:var(--text-primary);">${s.num}ª Edizione - ${s.year}</div>
                </div>
              </div>
              <span style="color:var(--accent-primary);font-size:1.1rem;font-weight:bold;">&rarr;</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.extraView = extraView;
}

