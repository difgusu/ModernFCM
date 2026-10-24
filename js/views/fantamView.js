/**
 * FANTAMISTER VIEW (SPA Native)
 * Analisi tecnica, scelte dei mister, top/flop, incompresi e statistiche di squadra
 * ModernFCM
 */

const fantamView = {
  currentTab: 'all', // 'all', 'recap', 'teams'
  expandedItems: {},  // Map of id -> boolean
  cache: {},          // Map of filename -> cleaned HTML content
  generatedSectionsLoaded: false,

  defaultRecapItems: [
    {
      id: 'fantamister',
      title: 'Classifica Fantamister',
      file: 'fantamister.htm',
      icon: '🏆',
      desc: 'Classifica basata sulla minor differenza media tra totale ottenuto e massimo teorico (assoluta e pesata).'
    },
    {
      id: 'bestrose',
      title: 'Migliori Rose',
      file: 'bestrose.htm',
      icon: '🌹',
      desc: 'Classifica del miglior parziale totale medio che era teoricamente ottenibile con la formazione ideale.'
    },
    {
      id: 'calenbomber',
      title: 'Calendario con marcatori',
      file: 'calenbomber.htm',
      icon: '⚽',
      desc: 'Calendario completo con i fantamarcatori attribuiti giornata per giornata in base al totale giocatore.'
    },
    {
      id: 'cannonieri',
      title: 'Classifica Cannonieri',
      file: 'cannonieri.htm',
      icon: '🎯',
      desc: 'Classifica cumulativa dei fantamarcatori calcolati tramite i fantatabellini di lega.'
    },
    {
      id: 'incomedia',
      title: 'Classifica incompresi (media)',
      file: 'incomedia.htm',
      icon: '🤦',
      desc: 'Calciatori con media totale di almeno 6.00 nelle giornate in cui NON sono stati schierati titolari.'
    },
    {
      id: 'incomtot',
      title: 'Classifica incompresi (totale)',
      file: 'incomtot.htm',
      icon: '📉',
      desc: 'Punti totali accumulati dai calciatori lasciati a riposo in panchina o in tribuna.'
    },
    {
      id: 'uomopartita',
      title: 'Migliore in Campo',
      file: 'uomopartita.htm',
      icon: '⭐',
      desc: 'Graduatoria dei calciatori premiati come Uomo Partita (miglior totale assoluto del match).'
    },
    {
      id: 'flop11',
      title: 'Flop11 - Giornata',
      file: 'flop11.htm',
      icon: '👎',
      desc: 'Peggior formazione titolare scesa in campo nell\'ultima giornata disputata.'
    },
    {
      id: 'flop11s',
      title: 'Flop11 - Stagione',
      file: 'flop11s.htm',
      icon: '🥶',
      desc: 'Peggiori 11 dell\'intera stagione (calcolati su chi ha giocato almeno il 50% delle partite).'
    },
    {
      id: 'top11',
      title: 'Top11 - Giornata',
      file: 'top11.htm',
      icon: '🔝',
      desc: 'Miglior formazione titolare scesa in campo nell\'ultimo turno di campionato.'
    },
    {
      id: 'top11s',
      title: 'Top11 - Stagione',
      file: 'top11s.htm',
      icon: '🌟',
      desc: 'Migliori 11 dell\'intera stagione (calcolati su chi ha giocato almeno il 50% delle partite).'
    },
    {
      id: 'fantasfiga',
      title: 'Fantasfiga',
      file: 'fantasfiga.htm',
      icon: '🍀',
      desc: 'Rendimento medio extra che gli avversari realizzano giocando contro una squadra rispetto alla loro media.'
    },
    {
      id: 'ultima',
      title: 'Ultima Giornata',
      file: 'ultima.htm',
      icon: '⏱️',
      desc: 'Dettaglio fantatabellini e marcatori dell\'ultima giornata giocata.'
    }
  ],

  recapItems: [],
  teamItems: [],

  async render(container) {
    await this._ensureGeneratedItems();
    this._ensureReportStyles();

    // Sincronizza squadre se presenti in arrFantasquadre
    if (typeof arrFantasquadre !== 'undefined' && Array.isArray(arrFantasquadre)) {
      for (let i = 1; i <= this.teamItems.length; i++) {
        const team = this.teamItems[i - 1];
        const source = arrFantasquadre[i] || arrFantasquadre[i - 1];
        const name = source && (source.nome || source.Nome || source.name);
        if (team && name) {
          team.title = name;
        }
      }
    }

    // Gestione query parameter nell'hash (es. #fantam?page=bestrose o #fantam?sq=NomeFantasquadra)
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
      const targetPage = params.get('page') || params.get('id');
      const targetSq = params.get('sq') || params.get('team');
      if (targetPage) {
        this.expandedItems[this._normalizeItemKey(targetPage)] = true;
        this.currentTab = 'recap';
      }
      if (targetSq) {
        const normalizedSq = this._normalizeItemKey(targetSq);
        const found = this.teamItems.find(t =>
          t.id === normalizedSq ||
          t.file === `${normalizedSq}.htm` ||
          t.title.toLowerCase() === String(targetSq).toLowerCase() ||
          (String(targetSq).match(/^\d+$/) && (t.num === Number(targetSq) || t.id === `sq${targetSq}`))
        );
        if (found) {
          this.expandedItems[found.id] = true;
          this.currentTab = 'teams';
        }
      }
    }

    this._renderShell(container);
    this._bindEvents(container);

    // Carica gli elementi attualmente aperti
    this._loadExpandedItems(container);
  },

  _ensureReportStyles() {
    if (document.getElementById('fantam-report-styles')) return;

    const stylesheet = document.createElement('link');
    stylesheet.id = 'fantam-report-styles';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'fantam/fantamister.css';
    document.head.appendChild(stylesheet);
  },

  _normalizeItemKey(value) {
    if (!value) return '';
    return String(value).trim().replace(/\.(htm|html)$/i, '').replace(/^lay/, '').replace(/^sq/, 'sq').toLowerCase();
  },

  async _ensureGeneratedItems() {
    if (this.generatedSectionsLoaded) return;

    this.recapItems = [...this.defaultRecapItems];
    this.teamItems = [];

    const sourceText = await this._loadGeneratedSource();
    if (sourceText) {
      const parsed = this._parseGeneratedSource(sourceText);
      this.recapItems = parsed.length ? parsed : [...this.defaultRecapItems];
    }

    this.teamItems = await this._discoverTeamItems();

    this.generatedSectionsLoaded = true;
  },

  async _discoverTeamItems() {
    const teams = [];
    const maxTeams = 100;

    for (let num = 1; num <= maxTeams; num++) {
      const file = `sq${num}.htm`;
      try {
        const response = await fetch(`fantam/${file}`, { cache: 'no-store' });
        if (!response.ok) break;

        teams.push({
          id: `sq${num}`,
          title: `Squadra ${num}`,
          file,
          num,
          icon: '🛡️'
        });
      } catch (err) {
        break;
      }
    }

    return teams;
  },

  async _loadGeneratedSource() {
    try {
      const response = await fetch('fantam/fanta.php', { cache: 'no-store' });
      if (!response.ok) return '';
      return await response.text();
    } catch (err) {
      return '';
    }
  },

  _parseGeneratedSource(sourceText) {
    const recap = [];

    if (!sourceText || !sourceText.includes('include')) {
      return recap;
    }

    const blocks = [...sourceText.matchAll(/<div\s+id=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/div>/gi)];
    const titleMap = {
      'fantamister.htm': {
        icon: '🏆',
        desc: 'Classifica basata sulla minor differenza media tra totale ottenuto e massimo teorico (assoluta e pesata).'
      },
      'bestrose.htm': {
        icon: '🌹',
        desc: 'Classifica del miglior parziale totale medio che era teoricamente ottenibile con la formazione ideale.'
      },
      'calenbomber.htm': {
        icon: '⚽',
        desc: 'Calendario completo con i fantamarcatori attribuiti giornata per giornata in base al totale giocatore.'
      },
      'cannonieri.htm': {
        icon: '🎯',
        desc: 'Classifica cumulativa dei fantamarcatori calcolati tramite i fantatabellini di lega.'
      },
      'incomedia.htm': {
        icon: '🤦',
        desc: 'Calciatori con media totale di almeno 6.00 nelle giornate in cui NON sono stati schierati titolari.'
      },
      'incomtot.htm': {
        icon: '📉',
        desc: 'Punti totali accumulati dai calciatori lasciati a riposo in panchina o in tribuna.'
      },
      'uomopartita.htm': {
        icon: '⭐',
        desc: 'Graduatoria dei calciatori premiati come Uomo Partita (miglior totale assoluto del match).'
      },
      'flop11.htm': {
        icon: '👎',
        desc: 'Peggior formazione titolare scesa in campo nell\'ultima giornata disputata.'
      },
      'flop11s.htm': {
        icon: '🥶',
        desc: 'Peggiori 11 dell\'intera stagione (calcolati su chi ha giocato almeno il 50% delle partite).'
      },
      'top11.htm': {
        icon: '🔝',
        desc: 'Miglior formazione titolare scesa in campo nell\'ultimo turno di campionato.'
      },
      'top11s.htm': {
        icon: '🌟',
        desc: 'Migliori 11 dell\'intera stagione (calcolati su chi ha giocato almeno il 50% delle partite).'
      },
      'fantasfiga.htm': {
        icon: '🍀',
        desc: 'Rendimento medio extra che gli avversari realizzano giocando contro una squadra rispetto alla loro media.'
      },
      'ultima.htm': {
        icon: '⏱️',
        desc: 'Dettaglio fantatabellini e marcatori dell\'ultima giornata giocata.'
      }
    };

    blocks.forEach((match) => {
      const blockHtml = match[2] || '';
      const includeMatch = blockHtml.match(/include\s*\(\s*['"]([^'"]+\.htm)['"]\s*\)/i);
      if (!includeMatch) return;

      const file = includeMatch[1];
      const titleMatch = blockHtml.match(/<font\s+class=['"]intest2['"]>(.*?)<\/font>/i) || blockHtml.match(/<font[^>]*>(.*?)<\/font>/i) || blockHtml.match(/>([^<>]{2,80})<\//);
      const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : file.replace(/\.htm$/i, '');
      const normalizedId = this._normalizeItemKey(file);

      const itemMeta = titleMap[file] || { icon: '📊', desc: rawTitle || normalizedId };
      recap.push({
        id: normalizedId,
        title: rawTitle || normalizedId,
        file,
        icon: itemMeta.icon,
        desc: itemMeta.desc
      });
    });

    recap.sort((a, b) => {
      const order = ['fantamister', 'bestrose', 'calenbomber', 'cannonieri', 'incomedia', 'incomtot', 'uomopartita', 'flop11', 'flop11s', 'top11', 'top11s', 'fantasfiga', 'ultima'];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });

    return recap;
  },

  _renderShell(container) {
    container.innerHTML = `
      <div class="fantam-wrapper">
        <!-- HEADER PRINCIPALE -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div class="card-title" style="display: flex; align-items: center; gap: 10px; font-size: 1.25rem;">
                <span>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #0284c7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                    <path d="M2 2l7.5 6"></path>
                    <path d="M22 2l-7.5 6"></path>
                    <path d="M10.5 7h3l.5 2-2 1-2-1 .5-2z"></path>
                    <path d="M11 10l-1.5 7 2.5 3.5 2.5-3.5-1.5-7"></path>
                  </svg>
                </span>
                <span>FantaMister</span>
              </div>
              <div class="card-subtitle" style="margin-top: 4px;">
                Analisi delle scelte tecniche, top/flop, incompresi e rendimento reale vs potenziale.
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button type="button" id="btnFantamLege" class="btn-invio-form" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 0.84rem; cursor: pointer; text-decoration: none;">
                <span>📖</span>
                <span>Guida</span>
              </button>
            </div>
          </div>

          <!-- TAB SWITCHER A PILLOLA -->
          <div style="padding: 0 18px 16px;">
            <div class="pill-tabs" id="fantamTabGroup" style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="pill-btn ${this.currentTab === 'all' ? 'active' : ''}" data-tab="all">
                Tutti i Report (${this.recapItems.length + this.teamItems.length})
              </button>
              <button type="button" class="pill-btn ${this.currentTab === 'recap' ? 'active' : ''}" data-tab="recap">
                📊 Generale (${this.recapItems.length})
              </button>
              <button type="button" class="pill-btn ${this.currentTab === 'teams' ? 'active' : ''}" data-tab="teams">
                🛡️ Squadre (${this.teamItems.length})
              </button>
            </div>
          </div>
        </div>

        <!-- SEZIONI ACCORDION -->
        <div id="fantamSectionsContainer">
          ${this._renderAccordionHtml()}
        </div>

        <!-- MODALE GUIDA FANTAMISTER -->
        <div id="fantamGuideModal" class="fantam-modal-backdrop" style="display:none;">
          <div class="fantam-modal-card">
            <div class="fantam-modal-header">
              <div class="fantam-modal-title">
                <span>📖</span>
                <span>Guida FantaMister</span>
              </div>
              <button type="button" id="btnCloseFantamGuide" class="fantam-modal-close" title="Chiudi">&times;</button>
            </div>
            <div class="fantam-modal-body">
              <!-- 1. Classifica Fantamister -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-gold, #eab308);">
                <div class="fantam-guide-title">🏆 Classifica Fantamister</div>
                <p>
                  Calcola per ogni partita il miglior Parziale Squadra possibile provando tutti i moduli.<br>
                  Non sono presi in considerazione i modificatori di reparto e in generale tutti quei modificatori che non partecipano al Totale Giocatore.<br>
                  Quindi mostra la classifica globale basata sulla minor differenza media tra il totale che si è ottenuto con la squadra in campo e il migliore che si poteva ottenere.
                </p>
                <p style="margin-top: 8px;">
                  Inoltre FantaMister calcola una classifica basata sullo scarto medio per partita pesato (cioè diviso) sul numero di voti validi oltre gli 11 che compongono la formazione titolare, questo perché si potrebbe ritenere più facile azzeccare la formazione se si hanno meno giocatori disponibili ed in generale nel caso di rose con pochi calciatori titolari.
                </p>
                <p style="margin-top: 8px; font-style: italic; color: var(--text-secondary);">
                  A voi decidere quale delle due classifiche sia più rappresentativa ma quella pesata è a mio parere più significativa.
                </p>
              </div>

              <!-- 2. Migliori Rose -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-rose, #f43f5e);">
                <div class="fantam-guide-title">🌹 Migliori Rose</div>
                <p>
                  Classifica del miglior parziale totale medio che era ottenibile dalle varie rose se gli allenatori avessero azzeccato sempre la migliore formazione possibile.
                </p>
              </div>

              <!-- 3. Calendario con Marcatori -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-emerald, #10b981);">
                <div class="fantam-guide-title">⚽ Calendario con Marcatori</div>
                <p>
                  Per ogni giornata vengono trovati i fantamarcatori di ogni partita, la logica utilizzata è la seguente: il gol è segnato dal calciatore con migliore totale calciatore, dopo di che gli vengono sottratti 3 punti e per altri gol si trova il nuovo maggiore totale calciatore. In caso di parità possono essere applicate alcune priorità configurabili:
                </p>
                <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 0.86rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                  <li>migliore voto assoluto</li>
                  <li>il calciatore che fino a quel momento ha meno fantagol già segnati</li>
                  <li>prima difensori</li>
                  <li>prima centrocampisti</li>
                  <li>prima attaccanti</li>
                </ul>
              </div>

              <!-- 4. Classifica Cannonieri -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-primary, #0284c7);">
                <div class="fantam-guide-title">🎯 Classifica Cannonieri</div>
                <p>
                  Classifica Fantacannonieri, vengono contati solo i gol realizzati nei fantatabellini calcolati in Calendario con Marcatori.
                </p>
              </div>

              <!-- 5. Gli Incompresi -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-amber, #f59e0b);">
                <div class="fantam-guide-title">🤦 Gli Incompresi</div>
                <p>
                  Ci sono fantallenatori che si ostinano a mandare in panchina, se non addirittura in tribuna, fuoriclasse assoluti che sarebbero titolari in qualunque altra fantasquadra. Ma loro sanno perché, storie di corna? Incompatibilità Sacchiane? Antichi rancori o riti voodoo? Non lo sapremo mai. Ma FantaMister vi aiuta a stanarli.
                </p>
                <p style="margin-top: 8px;">
                  Fantamister genera due classifiche:
                </p>
                <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 0.86rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
                  <li><b>Classifica calciatori per media totale giocatore quando NON schierati tra i titolari:</b> sono selezionati quelli con una media di almeno 6.00.</li>
                  <li><b>Classifica calciatori per totale giocatore accumulato nelle partite NON schierati tra i titolari:</b> sono selezionati quelli con una media di almeno 6.00 e che abbiano un numero di "assenze" superiore alla media di tutti i calciatori.</li>
                </ul>
              </div>

              <!-- 6. Migliore in Campo -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-cyan, #06b6d4);">
                <div class="fantam-guide-title">⭐ Migliore in Campo</div>
                <p>
                  Per ogni partita viene "premiato" il calciatore con il miglior TOTALE giocatore. La classifica tiene conto del numero di volte in cui un calciatore è stato l'Uomo Partita.
                </p>
                <p style="margin-top: 8px;">
                  La priorità di scelta in caso di parità è la seguente:
                </p>
                <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 0.86rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                  <li>Calciatore della squadra vincente il Fantaincontro</li>
                  <li>Le priorità usate per calcolare i marcatori</li>
                </ul>
              </div>

              <!-- 7. Top e Flop -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-indigo, #6366f1);">
                <div class="fantam-guide-title">🔝 Top e Flop</div>
                <p>
                  Vengono presi in considerazione solo i totali giocatore per le partite in cui il calciatore ha effettivamente giocato e contribuito al totale della fantasquadra.<br>
                  Per le classifiche di stagione si prendono solo i calciatori con un numero di presenze almeno pari al 50% delle partite giocate.
                </p>
              </div>

              <!-- 8. Fantasfiga -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-teal, #14b8a6);">
                <div class="fantam-guide-title">🍀 Fantasfiga</div>
                <p>
                  Questa classifica si basa sul rendimento dei propri avversari rispetto alla loro media. Il valore indicato è traducibile in "quanti punti fanno in media i miei avversari giocando contro di me rispetto alla loro media".
                </p>
              </div>

              <!-- 9. Statistiche di Squadra -->
              <div class="fantam-guide-box" style="border-left: 4px solid var(--accent-purple, #a855f7);">
                <div class="fantam-guide-title">🛡️ Statistiche di Squadra</div>
                <p>
                  Sono presenti per ogni squadra:
                </p>
                <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 0.86rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                  <li>Distribuzione moduli utilizzati</li>
                  <li>Fantamarcatori</li>
                  <li>Rosa ordinata per numero Presenze in campo, più (eventuali subentri da panchina e numero sostituzioni)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STILI MODERNI DEDICATI PER FANTAMISTER (No fantamister.css obsoleto) -->
      <style>
        .fantam-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }

        .fantam-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin: 28px 0 14px 4px;
        }

        .fantam-section-heading-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .fantam-section-count {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: none;
        }

        .fantam-section-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full, 9999px);
          color: var(--text-muted);
          padding: 4px 10px;
          font-size: 0.74rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: none;
          letter-spacing: normal;
          white-space: nowrap;
        }

        .fantam-section-toggle-btn:hover {
          background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.06));
          color: var(--text-primary);
          border-color: var(--border-medium, rgba(255, 255, 255, 0.2));
        }

        .fantam-toggle-chevron {
          width: 14px;
          height: 14px;
          color: inherit;
          transition: transform 0.25s ease;
          flex-shrink: 0;
        }

        .fantam-toggle-chevron.rotated {
          transform: rotate(180deg);
          color: var(--accent-primary, #0284c7);
        }

        .fantam-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg, 12px);
          margin-bottom: 12px;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .fantam-card:hover {
          border-color: var(--border-medium, rgba(255, 255, 255, 0.16));
        }

        .fantam-card.open {
          border-color: var(--accent-primary, #0284c7);
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.25);
        }

        .fantam-header-btn {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 18px;
          background: var(--bg-surface-elevated);
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 0.15s ease;
        }

        .fantam-header-btn:hover {
          background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
        }

        .fantam-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }

        .fantam-item-icon {
          font-size: 1.35rem;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md, 8px);
          flex-shrink: 0;
        }

        .fsq-shirt-img {
          width: 34px;
          height: 34px;
          object-fit: contain;
          flex-shrink: 0;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .fantam-item-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .fantam-item-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .fantam-item-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          white-space: normal;
          line-height: 1.35;
          margin-top: 2px;
        }

        /* Tabellini di giornata (calenbomber & ultima): risultato centrato compatto come prima e marcatori a capo */
        table.ris {
          table-layout: auto !important;
          width: 100% !important;
          max-width: 640px !important;
          margin: 0 auto 16px !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }

        table.ris tr.ris {
          width: 100%;
        }

        table.ris td.risSQUADRA:first-child,
        table.ris td.risMARCATORI:first-child {
          width: 50% !important;
          text-align: right !important;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          padding-right: 10px !important;
        }

        table.ris td.risSQUADRA:last-child,
        table.ris td.risMARCATORI:last-child {
          width: 50% !important;
          text-align: left !important;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          padding-left: 10px !important;
        }

        table.ris td.risSQUADRA div,
        table.ris td.risMARCATORI div,
        table.ris td.risMARCATORI {
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          line-height: 1.25 !important;
        }

        table.ris td.risMARCATORI {
          font-size: 0.76rem !important;
          color: var(--text-secondary, #475569) !important;
        }

        table.ris td.risRISULTATO {
          width: 30px !important;
          min-width: 28px !important;
          max-width: 34px !important;
          white-space: nowrap !important;
          text-align: center !important;
          font-size: 0.95rem !important;
          font-weight: 800 !important;
          color: var(--accent-primary, #1769aa) !important;
          background: var(--bg-surface-elevated, #eef6fb) !important;
          padding: 4px 6px !important;
          box-sizing: border-box !important;
          border-radius: 4px !important;
        }

        table.ris td.risRISULTATO div {
          text-align: center !important;
          white-space: nowrap !important;
        }

        table.ris td.risSPAZIO {
          width: 14px !important;
          min-width: 12px !important;
          max-width: 18px !important;
          white-space: nowrap !important;
          text-align: center !important;
          font-size: 0.95rem !important;
          font-weight: 700 !important;
          padding: 4px 1px !important;
          background: transparent !important;
          box-sizing: border-box !important;
        }

        table.ris td.risSPAZIO div {
          text-align: center !important;
          white-space: nowrap !important;
        }

        table.ris td.risMOM {
          width: 100% !important;
          color: var(--accent-secondary, #087f7a) !important;
          background: var(--bg-surface-elevated, #eef6fb) !important;
          font-weight: 700 !important;
          font-size: 0.80rem !important;
          text-align: center !important;
          white-space: normal !important;
          word-break: break-word !important;
          padding: 5px 8px !important;
        }

        table.ris td.risMOM div {
          text-align: center !important;
        }

        table.ris tr:not(.ris) td {
          padding: 4px 0 !important;
          height: 8px !important;
          background: transparent !important;
          border: 0 !important;
        }

        /* Centratura tabella Dettaglio Moduli Migliori e tabelle moduli */
        tr:has(> .moduliDATI),
        tr:has(> .sqmoduliDATI) {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        tr:has(> .moduliDATI) > td.moduliDATI:first-child,
        tr:has(> .sqmoduliDATI) > td.sqmoduliDATI:first-child {
          flex: 1 1 0 !important;
          display: flex !important;
          justify-content: flex-end !important;
          text-align: right !important;
          padding-right: 8px !important;
        }

        tr:has(> .moduliDATI) > td.moduliIMG,
        tr:has(> .sqmoduliDATI) > td.sqmoduliIMG {
          flex: 0 0 20px !important;
          width: 20px !important;
          min-width: 20px !important;
          max-width: 20px !important;
          padding: 0 !important;
          background-position: center center !important;
        }

        tr:has(> .moduliDATI) > td.moduliDATI:last-child,
        tr:has(> .sqmoduliDATI) > td.sqmoduliDATI:last-child {
          flex: 1 1 0 !important;
          display: flex !important;
          justify-content: flex-start !important;
          text-align: left !important;
          padding-left: 8px !important;
        }

        tr:has(> .moduliTITOLO) {
          display: block !important;
          width: 100% !important;
        }

        tr:has(> .moduliTITOLO) > td.moduliTITOLO {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
        }

        .fantam-chevron {
          width: 20px;
          height: 20px;
          color: var(--text-muted);
          transition: transform 0.25s ease, color 0.2s ease;
          flex-shrink: 0;
          margin-left: 12px;
        }

        .fantam-card.open .fantam-chevron {
          transform: rotate(180deg);
          color: var(--accent-primary, #0284c7);
        }

        .fantam-body {
          display: none;
          padding: 16px 20px 22px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
        }

        .fantam-card.open .fantam-body {
          display: block;
        }

        /* CONTENITORE TABELLARE RESPONSIVE */
        .fantam-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 0;
          padding: 2px 0 4px;
          scrollbar-width: thin;
        }

        .fantam-report-content {
          width: 100%;
          color: var(--text-primary);
        }

        .fantam-report-content > br {
          display: none;
        }

        .fantam-report-content > div {
          width: 100%;
        }

        /* MODALE GUIDA STYLES */
        .fantam-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 99999;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }

        .fantam-modal-card {
          background: var(--bg-surface, #131d35);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
          border-radius: var(--radius-lg, 16px);
          max-width: 780px;
          width: 100%;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          animation: fantamFadeIn 0.2s ease-out;
        }

        @keyframes fantamFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .fantam-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface-elevated, #1e293b);
        }

        .fantam-modal-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fantam-modal-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.6rem;
          line-height: 1;
          cursor: pointer;
          padding: 0 6px;
        }

        .fantam-modal-close:hover {
          color: var(--text-primary);
        }

        .fantam-modal-body {
          padding: 22px;
          overflow-y: auto;
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .fantam-guide-box {
          background: var(--bg-main, #0b1120);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md, 10px);
          padding: 14px 18px;
        }

        .fantam-guide-title {
          font-size: 0.98rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .fantam-guide-box p {
          margin: 0;
          color: var(--text-secondary);
        }

        @media (max-width: 640px) {
          .fantam-body {
            padding: 8px 4px 14px !important;
          }
          .fantam-card {
            border-radius: var(--radius-md, 8px);
            margin-bottom: 8px;
          }
          .fantam-header-btn {
            padding: 10px 12px;
          }
          .fantam-item-title {
            font-size: 0.88rem;
          }
          .fantam-item-desc {
            font-size: 0.72rem;
          }
          .fantam-section-heading-title {
            font-size: 0.92rem;
          }
          .fantam-section-toggle-btn {
            padding: 3px 8px;
            font-size: 0.68rem;
          }
          table.ris {
            width: 100% !important;
            max-width: 100% !important;
            font-size: 0.70rem !important;
          }
          table.ris td.risSQUADRA:first-child,
          table.ris td.risMARCATORI:first-child {
            width: 50% !important;
            padding: 3px 6px !important;
            font-size: 0.74rem !important;
          }
          table.ris td.risSQUADRA:last-child,
          table.ris td.risMARCATORI:last-child {
            width: 50% !important;
            padding: 3px 6px !important;
            font-size: 0.74rem !important;
          }
          table.ris td.risMARCATORI {
            font-size: 0.66rem !important;
            line-height: 1.15 !important;
            padding: 2px 6px 4px !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
          table.ris td.risRISULTATO {
            width: 26px !important;
            min-width: 24px !important;
            max-width: 30px !important;
            padding: 2px 4px !important;
            font-size: 0.84rem !important;
            white-space: nowrap !important;
          }
          table.ris td.risSPAZIO {
            width: 12px !important;
            min-width: 10px !important;
            max-width: 14px !important;
            padding: 2px 1px !important;
            font-size: 0.84rem !important;
            white-space: nowrap !important;
          }
          table.ris td.risMOM {
            font-size: 0.68rem !important;
            line-height: 1.2 !important;
            padding: 4px 3px !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
        }
      </style>
    `;
  },

  _renderAccordionHtml() {
    let html = '';

    // Sezione 1: Riepilogo Dati FantaMister (GENERALE)
    if (this.currentTab === 'all' || this.currentTab === 'recap') {
      html += `
        <div class="fantam-section-heading">
          <div class="fantam-section-heading-title">
            <span>📊</span>
            <span>GENERALE</span>
            <span class="fantam-section-count">(${this.recapItems.length} Report)</span>
          </div>
          <button type="button" class="fantam-section-toggle-btn" data-section="recap" title="Espandi o comprimi tutti i report della sezione Generale">
            <span class="fantam-toggle-text">${this._isSectionAllOpen('recap') ? 'Comprimi tutto' : 'Espandi tutto'}</span>
            <svg class="fantam-toggle-chevron ${this._isSectionAllOpen('recap') ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      `;

      if (!this.recapItems.length) {
        html += `
          <div class="fantam-card open" style="border-style: dashed; opacity: 0.9;">
            <div class="fantam-body" style="display: block; padding: 22px 18px;">
              <div style="padding: 8px 12px; text-align: center; color: var(--text-muted);">
                Nessun report FantaMister disponibile finché i file generati da FCM non sono presenti in <strong>fantam/</strong>.
              </div>
            </div>
          </div>
        `;
      } else {
        this.recapItems.forEach((item, index) => {
          const isOpen = !!this.expandedItems[item.id];
          html += `
            <div class="fantam-card ${isOpen ? 'open' : ''}" id="card_${item.id}" data-item-id="${item.id}" data-file="${item.file}">
              <button type="button" class="fantam-header-btn" data-toggle="${item.id}">
                <div class="fantam-header-left">
                  <span class="fantam-item-icon">${item.icon}</span>
                  <div class="fantam-item-title-wrap">
                    <div class="fantam-item-title">${index + 1}. ${item.title}</div>
                    <div class="fantam-item-desc">${item.desc}</div>
                  </div>
                </div>
                <svg class="fantam-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="fantam-body" id="body_${item.id}">
                <div class="fantam-loading" style="padding: 24px; text-align: center; color: var(--text-muted);">
                  Caricamento dati in corso...
                </div>
              </div>
            </div>
          `;
        });
      }
    }

    // Sezione 2: Statistiche di Squadra (SQUADRE)
    if (this.currentTab === 'all' || this.currentTab === 'teams') {
      html += `
        <div class="fantam-section-heading" style="margin-top: ${this.currentTab === 'all' ? '32px' : '14px'};">
          <div class="fantam-section-heading-title">
            <span>🛡️</span>
            <span>SQUADRE</span>
            <span class="fantam-section-count">(${this.teamItems.length} Squadre)</span>
          </div>
          <button type="button" class="fantam-section-toggle-btn" data-section="teams" title="Espandi o comprimi tutte le statistiche di squadra">
            <span class="fantam-toggle-text">${this._isSectionAllOpen('teams') ? 'Comprimi tutto' : 'Espandi tutto'}</span>
            <svg class="fantam-toggle-chevron ${this._isSectionAllOpen('teams') ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      `;

      if (!this.teamItems.length) {
        html += `
          <div class="fantam-card open" style="border-style: dashed; opacity: 0.9;">
            <div class="fantam-body" style="display: block; padding: 22px 18px;">
              <div style="padding: 8px 12px; text-align: center; color: var(--text-muted);">
                Nessuna statistica di squadra disponibile finché i file generati da FCM non sono presenti in <strong>fantam/</strong>.
              </div>
            </div>
          </div>
        `;
      } else {
        this.teamItems.forEach((team, index) => {
          const isOpen = !!this.expandedItems[team.id];
          const shirtSrc = `img/sq/${encodeURIComponent(team.title)}.png`;
          html += `
            <div class="fantam-card ${isOpen ? 'open' : ''}" id="card_${team.id}" data-item-id="${team.id}" data-file="${team.file}">
              <button type="button" class="fantam-header-btn" data-toggle="${team.id}">
                <div class="fantam-header-left">
                  <img src="${shirtSrc}" alt="${team.title}" class="fsq-shirt-img" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='img/sq/${encodeURIComponent(team.title)}.gif';}else{this.onerror=null;this.src='img/sq/undefined.svg';}">
                  <div class="fantam-item-title-wrap">
                    <div class="fantam-item-title">${index + 1}. ${team.title}</div>
                  </div>
                </div>
                <svg class="fantam-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="fantam-body" id="body_${team.id}">
                <div class="fantam-loading" style="padding: 24px; text-align: center; color: var(--text-muted);">
                  Caricamento statistiche per ${team.title}...
                </div>
              </div>
            </div>
          `;
        });
      }
    }

    return html;
  },

  _isSectionAllOpen(section) {
    const items = section === 'recap' ? this.recapItems : this.teamItems;
    if (!items || !items.length) return false;
    return items.every(item => !!this.expandedItems[item.id]);
  },

  _updateSectionToggleButtons(container) {
    const recapBtn = container.querySelector('.fantam-section-toggle-btn[data-section="recap"]');
    if (recapBtn) {
      const isAllOpen = this._isSectionAllOpen('recap');
      const textSpan = recapBtn.querySelector('.fantam-toggle-text');
      const chevron = recapBtn.querySelector('.fantam-toggle-chevron');
      if (textSpan) textSpan.textContent = isAllOpen ? 'Comprimi tutto' : 'Espandi tutto';
      if (chevron) chevron.classList.toggle('rotated', isAllOpen);
    }

    const teamsBtn = container.querySelector('.fantam-section-toggle-btn[data-section="teams"]');
    if (teamsBtn) {
      const isAllOpen = this._isSectionAllOpen('teams');
      const textSpan = teamsBtn.querySelector('.fantam-toggle-text');
      const chevron = teamsBtn.querySelector('.fantam-toggle-chevron');
      if (textSpan) textSpan.textContent = isAllOpen ? 'Comprimi tutto' : 'Espandi tutto';
      if (chevron) chevron.classList.toggle('rotated', isAllOpen);
    }
  },

  _bindSectionToggleButtons(container) {
    const sectionBtns = container.querySelectorAll('.fantam-section-toggle-btn');
    sectionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.getAttribute('data-section');
        const items = section === 'recap' ? this.recapItems : this.teamItems;
        if (!items || !items.length) return;

        const allOpen = this._isSectionAllOpen(section);
        const targetOpen = !allOpen;

        items.forEach(item => {
          this.expandedItems[item.id] = targetOpen;
          const card = container.querySelector(`#card_${item.id}`);
          if (card) {
            card.classList.toggle('open', targetOpen);
            if (targetOpen) {
              this._loadItemContent(card);
            }
          }
        });

        this._updateSectionToggleButtons(container);
      });
    });
  },

  _bindEvents(container) {
    // 1. Tab switching
    const tabButtons = container.querySelectorAll('.pill-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === this.currentTab) return;
        this.currentTab = tab;
        tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
        const sectionsContainer = container.querySelector('#fantamSectionsContainer');
        if (sectionsContainer) {
          sectionsContainer.innerHTML = this._renderAccordionHtml();
          this._bindAccordionButtons(container);
          this._bindSectionToggleButtons(container);
          this._loadExpandedItems(container);
        }
      });
    });

    // 2. Accordion buttons
    this._bindAccordionButtons(container);

    // 3. Section toggle buttons (GENERALE e SQUADRE)
    this._bindSectionToggleButtons(container);

    // 4. Modal Guida & Regolamento
    const btnLege = container.querySelector('#btnFantamLege');
    const modal = container.querySelector('#fantamGuideModal');
    const btnClose = container.querySelector('#btnCloseFantamGuide');

    if (btnLege && modal) {
      btnLege.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
      });
    }
    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          modal.style.display = 'none';
        }
      });
    }
  },

  _bindAccordionButtons(container) {
    const headerBtns = container.querySelectorAll('.fantam-header-btn');
    headerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle');
        const card = container.querySelector(`#card_${id}`);
        if (!card) return;

        const willOpen = !card.classList.contains('open');
        card.classList.toggle('open', willOpen);
        this.expandedItems[id] = willOpen;

        if (willOpen) {
          this._loadItemContent(card);
        }

        this._updateSectionToggleButtons(container);
      });
    });
  },

  _loadExpandedItems(container) {
    const openCards = container.querySelectorAll('.fantam-card.open');
    openCards.forEach(card => {
      this._loadItemContent(card);
    });
  },

  async _loadItemContent(card) {
    const id = card.getAttribute('data-item-id');
    const file = card.getAttribute('data-file');
    const bodyEl = card.querySelector(`#body_${id}`);
    if (!bodyEl) return;

    // Se già presente in cache
    if (this.cache[file]) {
      bodyEl.innerHTML = this.cache[file];
      return;
    }

    try {
      const resp = await fetch(`fantam/${file}`, { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const rawText = await resp.text();
      const cleaned = this._cleanFcmReportHtml(rawText);
      this.cache[file] = cleaned;
      bodyEl.innerHTML = cleaned;
    } catch (err) {
      // File non trovato o plugin non ancora eseguito
      bodyEl.innerHTML = `
        <div style="padding: 24px 16px; text-align: center;">
          <div style="font-size: 1.6rem; margin-bottom: 8px;">ℹ️</div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">
            Dati non ancora disponibili per questo report
          </div>
          <div style="color: var(--text-muted); font-size: 0.82rem; max-width: 520px; margin: 0 auto;">
            Il file <code>fantam/${file}</code> non &egrave; presente su disco o non &egrave; stato ancora generato.
            I dati appariranno automaticamente non appena il plugin FantaMister di FCM verr&agrave; eseguito ed esportato.
          </div>
        </div>
      `;
    }
  },

  /**
   * Pulisce l'HTML grezzo generato dal plugin FCM e lo incapsula in un wrapper responsive
   */
  _cleanFcmReportHtml(html) {
    if (!html || !html.trim()) {
      return `
        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
          Nessun dato registrato in questo report.
        </div>
      `;
    }

    // Estrae il body se presente per rimuovere doctype/html/head
    let clean = html;
    if (clean.includes('<body') || clean.includes('<BODY')) {
      const doc = new DOMParser().parseFromString(clean, 'text/html');
      clean = doc.body ? doc.body.innerHTML : clean;
    }

    // Rimuove eventuali script interni o link a vecchi css
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
    clean = clean.replace(/<link[\s\S]*?>/gi, '');
    clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Rimuove tag center obsoleti o br ridondanti all'inizio/fine
    clean = clean.replace(/<center>/gi, '<div style="text-align:center;">').replace(/<\/center>/gi, '</div>');

    // Incapsula in contenitore con scroll sicuro anti-overflow
    clean = clean.replace(/<br\s*\/?>/gi, '');

    return `<div class="fantam-table-wrap"><div class="fantam-report-content">${clean}</div></div>`;
  }
};
