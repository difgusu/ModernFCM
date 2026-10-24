const sectionsView = {
  storicoItems: [
    ['#albo', '🏆', "Albo d'Oro", 'Palmares e titoli vinti dalle fantasquadre.'],
    ['#ranking', '📈', 'Ranking', 'Classifica perpetua e coefficienti storici delle fantasquadre.'],
    ['#album', '🖼', 'Album Storico', 'Lo storico dei calciatori transitati nella lega.'],
    ['#topflop', '🌟', 'Top & Flop 11', 'Le migliori e peggiori formazioni storiche.'],
    ['#confrontidiretti', '⚔️', 'Scontri Diretti', 'Bilancio testa a testa tra due fantasquadre.'],
    ['#confronti', '📚', 'Confronti Storici', 'Archivio completo degli incontri e dei palmares.'],
    ['#recordstorici', '🎖️', 'Record Storici', 'I primati di gol, scarto, serie positive e punteggi.'],
    ['#almanacco', '📜', 'Almanacco', 'Statistiche, cannonieri e primati di lega.'],
    ['#rating', '⭐', 'Fanta Rating', 'Indice storico di rendimento delle fantasquadre.'],
    ['#topcosti', '💰', 'Top Costi Storico', 'I calciatori più pagati nella storia delle aste.'],
    ['#topcostistagione', '🏷️', 'Top Costi Stagione', 'I colpi più onerosi della stagione corrente.'],
    ['#archivio', '🗂️', 'Archivio Stagioni', 'Classifica, rose e risultati delle stagioni passate.']
  ],
  extraItems: [
    ['#seavessiavuto', '📅', 'Se avessi avuto...', 'Simulazione dei calendari e della fortuna di lega.'],
    ['#fantaMassimi', '⚡', 'FantaMassimi', 'Formazioni ideali e risultati ipotetici di giornata.'],
    ['#fantaClassifica', '📈', 'FantaClassifica', 'La classifica alternativa con punti persi e gol mancati.'],
    ['#records', '🎖️', 'Records', 'I record della stagione e della lega.'],
    ['#fantam', '👔', 'FantaMister', 'Analisi delle scelte e del rendimento dei mister.'],
    ['#indisponibili', '🏥', 'Indisponibili', 'Infortunati, squalificati e report infermeria.'],
    ['#etaRose', '🎂', 'Età Rose', 'Eta media, anagrafica e dettagli delle rose.'],
    ['#documenti', '📄', 'Documenti', 'Regolamenti, documenti ufficiali e modulistica.'],
    ['#gbook', '💬', 'Guestbook', 'Bacheca messaggi e commenti tra i fantallenatori di lega.'],
    ['#stats', '📊', 'Statistiche Visite', 'Contatore visite, accessi e statistiche di traffico della lega.']
  ],

  render(container, title, subtitle, items) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${title}</div>
            <div class="card-subtitle">${subtitle}</div>
          </div>
        </div>
        <div class="quick-links-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;">
          ${items.map(([href, icon, label, description]) => `
            <a href="${href}" style="display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);text-decoration:none;transition:border-color .15s,transform .15s;">
              <span style="font-size:1.6rem;line-height:1;">${icon}</span>
              <strong style="color:var(--text-primary);font-size:1rem;">${label}</strong>
              <span style="color:var(--text-secondary);font-size:.82rem;line-height:1.4;">${description}</span>
              <span style="color:var(--accent-primary);font-size:.8rem;font-weight:700;margin-top:auto;">Apri &rarr;</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  },

  async renderStorico(container) {
    let items = [...this.storicoItems];
    try {
      if (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.hasRankingDivisioni === 'function') {
        const hasDiv = await fcmDataLoader.hasRankingDivisioni();
        if (hasDiv) {
          // Inserisce Ranking Divisioni subito dopo Ranking (indice 2)
          items.splice(2, 0, ['#rankingdivisioni', '📊', 'Ranking Divisioni', 'Classifica perpetua e coefficienti storici suddivisi per divisione.']);
        }
      }
    } catch (e) { }

    if (typeof fcmModules !== 'undefined') {
      items = items.filter(([href]) => fcmModules.isRouteEnabled(href));
    }

    this.render(container, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l4 2"></path></svg> Storico', 'Albo d\'oro, statistiche e archivio storico della lega.', items);
  },

  renderExtra(container) {
    let items = [...this.extraItems];
    if (typeof fcmModules !== 'undefined') {
      items = items.filter(([href]) => fcmModules.isRouteEnabled(href));
    }
    this.render(container, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2"><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"></path></svg> Extra', 'Strumenti, simulazioni, servizi e documenti della lega.', items);
  }
};

if (typeof window !== 'undefined') {
  window.sectionsView = sectionsView;
}
