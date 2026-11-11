/**
 * EXTRA & UTILITY VIEW
 * Scontri Diretti, Documenti, Archivio, Pagine Storiche & Records
 * ModernFCM
 */

const extraView = {
  currentTab: 'confronti', // 'confronti', 'documenti', 'archivio', 'storico'
  confrontiTeamA: null,   // Dinamico: prima squadra attiva per idAttuale (o da query param)
  confrontiTeamB: null,   // Dinamico: avversaria attiva con idAttuale successivo (o da query param)
  confrontiCompId: 0,    // 0 = Tutte

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
      confronti: '#confronti',
      documenti: '#documenti',
      archivio: '#archivio',
      storico: '#storico'
    };
    if (typeof fcmModules !== 'undefined') {
      const currentRoute = tabRouteMap[this.currentTab] || '#' + this.currentTab;
      if (!fcmModules.isRouteEnabled(currentRoute)) {
        const candidateTabs = ['documenti', 'archivio', 'storico', 'confronti'];
        const firstValid = candidateTabs.find(t => fcmModules.isRouteEnabled(tabRouteMap[t])) || 'documenti';
        this.currentTab = firstValid;
      }
    }

    const pageTitles = {
      confronti: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M8 4l-4 4 4 4"></path><path d="M4 8h11a5 5 0 0 1 5 5v1"></path><path d="M16 20l4-4-4-4"></path><path d="M20 16H9a5 5 0 0 1-5-5v-1"></path></svg> Scontri Diretti', 'Bilancio testa a testa tra le fantasquadre'],
      documenti: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line></svg> Documenti', 'Regolamenti, documenti ufficiali e modulistica'],
      archivio: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2"><path d="M3 6h18"></path><path d="M5 6v14h14V6"></path><path d="M9 10h6M9 14h6"></path><path d="M8 3h8l1 3H7l1-3z"></path></svg> Archivio Stagioni', 'Classifica, rose e risultati delle stagioni passate'],
      storico: ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> Storico &amp; Records', 'Archivio storico, records e statistiche speciali']
    };
    const [pageTitle, pageSubtitle] = pageTitles[this.currentTab] || pageTitles.confronti;

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
          ${(typeof fcmSkeleton !== 'undefined') ? fcmSkeleton.table({ cols: 4, rows: 6, withToolbar: true }) : `
          <div class="text-center" style="padding:30px;color:var(--text-muted);">
            Caricamento contenuti extra...
          </div>
          `}
        </div>
      </div>
    `;

    const tabContainer = container.querySelector('#extraPageContent');

    if (this.currentTab === 'confronti') {
      await this.renderConfronti(tabContainer);
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
        href: '#seavessiavuto',
        icon: '🔀',
        badge: 'SIMULATORE CALENDARI',
        badgeBg: 'rgba(2, 132, 199, 0.15)',
        badgeColor: '#38bdf8',
        title: 'Se Avessi Avuto...',
        desc: 'Matrice di simulazione incrociata: classifica e punti ipotetici se ogni squadra avesse affrontato il calendario degli avversari.',
        btnText: 'Apri Simulatore →'
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
              ${conf.teams.map(t => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(t) || fcmHomeConfigManager.isFavoriteTeam(t.id) || fcmHomeConfigManager.isFavoriteTeam(t.name));
      return `<option value="${t.id}" ${t.id === teamA.id ? 'selected' : ''}>${isFav ? '⭐ ' : ''}${t.name}</option>`;
    }).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
              Squadra B:
            </label>
            <select id="selConfB" class="form-select" style="width:100%;font-weight:700;">
              ${conf.teams.map(t => {
      const isFav = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(t) || fcmHomeConfigManager.isFavoriteTeam(t.id) || fcmHomeConfigManager.isFavoriteTeam(t.name));
      return `<option value="${t.id}" ${t.id === teamB.id ? 'selected' : ''}>${isFav ? '⭐ ' : ''}${t.name}</option>`;
    }).join('')}
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
        ${(() => {
        const isFavA = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(teamA.id) || fcmHomeConfigManager.isFavoriteTeam(teamA.currentId) || fcmHomeConfigManager.isFavoriteTeam(teamA.name) || fcmHomeConfigManager.isFavoriteTeam(teamA));
        const isFavB = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(teamB.id) || fcmHomeConfigManager.isFavoriteTeam(teamB.currentId) || fcmHomeConfigManager.isFavoriteTeam(teamB.name) || fcmHomeConfigManager.isFavoriteTeam(teamB));
        return `
            <div class="h2h-summary-card">
              <div class="h2h-teams-header">
                <div class="h2h-team-col">
                  <img src="${fcmDataLoader.getTeamLogo(teamA.name || teamA.currentId)}" class="h2h-team-logo" style="object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div class="h2h-team-name">${isFavA ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${teamA.name}</div>
                </div>

                <div>
                  <span class="h2h-vs-badge">VS</span>
                  <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">
                    ${h2h.matchesCount} Precedenti
                  </div>
                </div>

                <div class="h2h-team-col">
                  <img src="${fcmDataLoader.getTeamLogo(teamB.name || teamB.currentId)}" class="h2h-team-logo" style="object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" />
                  <div class="h2h-team-name">${isFavB ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${teamB.name}</div>
                </div>
              </div>
          `;
      })()}

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
              <div class="h2h-stat-label">Somma Totali</div>
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
                    <th class="text-center">Totali</th>
                    <th class="text-center">Data</th>
                  </tr>
                </thead>
                <tbody>
                  ${h2h.matches.map(m => {
        const isFavHome = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(m.homeId) || fcmHomeConfigManager.isFavoriteTeam(m.homeTeam));
        const isFavAway = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(m.awayId) || fcmHomeConfigManager.isFavoriteTeam(m.awayTeam));
        const isFavMatch = isFavHome || isFavAway;
        return `
                    <tr class="${isFavMatch ? 'table-row-favorite' : ''}">
                      <td class="text-center font-bold">${m.season}ª</td>
                      <td class="text-center"><span class="badge badge-primary" style="font-size:0.65rem;">${m.compLabel}</span></td>
                      <td class="text-center font-bold">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link" title="Vedi risultati ${m.matchday}ª giornata">
                          ${m.matchday}ª
                        </a>
                      </td>
                      <td style="text-align:right;font-weight:700;color:${m.homeTeam === teamA.name ? 'var(--accent-primary)' : m.homeTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};">
                        ${isFavHome ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${m.homeTeam}
                      </td>
                      <td class="text-center font-bold" style="font-size:1.05rem;background:rgba(255,255,255,0.03);">
                        <a href="${m.matchUrl || '#'}" ${m.isSpa ? '' : 'target="_blank" rel="noopener noreferrer"'} class="match-link result-link" style="text-decoration:none;color:inherit;display:block;" title="Vedi tabellino incontro">
                          ${m.homeScore} - ${m.awayScore}
                        </a>
                      </td>
                      <td style="font-weight:700;color:${m.awayTeam === teamA.name ? 'var(--accent-primary)' : m.awayTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};">
                        ${isFavAway ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${m.awayTeam}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.8rem;">
                        ${m.homePoints} - ${m.awayPoints}
                      </td>
                      <td class="text-center" style="color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">
                        ${this.formatDate(m.date || m.rawDate)}
                      </td>
                    </tr>
                  `;
      }).join('')}
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
        const isFavHome = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(m.homeId) || fcmHomeConfigManager.isFavoriteTeam(m.homeTeam));
        const isFavAway = (typeof fcmHomeConfigManager !== 'undefined') && (fcmHomeConfigManager.isFavoriteTeam(m.awayId) || fcmHomeConfigManager.isFavoriteTeam(m.awayTeam));
        const isFavMatch = isFavHome || isFavAway;

        return `
                  <div class="match-card ${isFavMatch ? 'match-card-favorite' : ''}" style="padding:10px 12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
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
                        <img src="${fcmDataLoader.getTeamLogo(m.homeTeam)}" style="height:22px;width:auto;flex-shrink:0;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
                        <span style="font-size:0.82rem;font-weight:700;color:${m.homeTeam === teamA.name ? 'var(--accent-primary)' : m.homeTeam === teamB.name ? 'var(--accent-rose)' : 'inherit'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.homeTeam}">
                          ${isFavHome ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${m.homeTeam}
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
                          ${isFavAway ? '<span class="fav-team-star" title="Squadra del Cuore">⭐</span> ' : ''}${m.awayTeam}
                        </span>
                        <img src="${fcmDataLoader.getTeamLogo(m.awayTeam)}" style="height:22px;width:auto;flex-shrink:0;object-fit:contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.src.replace(/\\.png$/, '.gif');}else{this.onerror=null;this.src='img/sq/undefined.svg';}" alt="" />
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
   * 3. Documenti
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
   * 5. Archivio (Reindirizzamento alla vista standalone #archivio)
   */
  async renderArchivio(tabContainer) {
    if (typeof window !== 'undefined') {
      window.location.hash = '#archivio';
    }
  }
};

if (typeof window !== 'undefined') {
  window.extraView = extraView;
}

