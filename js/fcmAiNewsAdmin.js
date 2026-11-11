/**
 * ModernFCM - AI News / Matchday Editorial Admin Controller
 * Gestisce la configurazione della chiave API Google Gemini, i prompt dinamici personalizzabili,
 * l'estrazione dati dai file FCM, l'archivio delle cronache pubblicate con modifica/eliminazione
 * e la pubblicazione dell'editoriale di giornata.
 */

const fcmAiNewsAdmin = {
  config: {
    configured: false,
    model: 'gemini-3.8-flash',
    defaultTone: 'ironico',
    isAdmin: false
  },

  publishedArticles: [],

  promptTemplates: {
    ironico: "Sei un brillante, ironico e pungente giornalista sportivo esperto di Fantacalcio.\n"
      + "Scrivi una cronaca della giornata calcistica appena conclusa basandoti RIGOROSAMENTE sui DATI REALI forniti (risultati di tutte le competizioni/divisioni, veri marcatori, fantavoti reali, fantamister e variazioni di classifica).\n"
      + "STILE: Brillante, sarcastico e goliardico. Prendi bonariamente in giro le beffe da mezzo punto, i gol lasciati in panchina e le scelte tattiche suicide dei fantallenatori.\n"
      + "STRUTTURA:\n"
      + "1. Introduzione con titolo roboante ed effetto sorpresa della giornata.\n"
      + "2. Cronaca del match clou con veri marcatori e fantavoti reali.\n"
      + "3. Recap completo dei risultati di tutti gli altri match della giornata (includendo eventuali altre divisioni, gironi o gare di Coppa disputate), citando marcatori e punteggi effettivi.\n"
      + "4. L'angolo FantaMister: celebra il miglior mister per scelte ed efficienza e prendi in giro il peggior mister per i punti e bonus lasciati marcire in panchina! Nel far questo, però, tieni conto anche degli effettivi risultati ottenuti dai FantaMister migliore e peggiore.\n"
      + "5. Top player assoluto con il suo fantavoto e frecciata al flop player.\n"
      + "6. Situazione reale della classifica aggiornata, evidenziando eventuali sorpassi o scivoloni rispetto al turno precedente, e battuta finale.",

    gazzetta: "Sei un autorevole caporedattore di una prestigiosa testata giornalistica sportiva.\n"
      + "Scrivi un editoriale formale, accurato e approfondito sui risultati dell'ultimo turno di Fantacalcio basandoti RIGOROSAMENTE sui DATI REALI forniti.\n"
      + "STILE: Professionale, lucido e tattico. Analisi rigorosa dei punteggi, dei marcatori, dell'impatto dei bonus/malus e dell'evoluzione della classifica.\n"
      + "STRUTTURA:\n"
      + "1. Quadro generale del turno e analisi delle forze in campo.\n"
      + "2. Il big match della giornata: disamina delle prestazioni decisive, marcatori e man of the match.\n"
      + "3. Risultati completi di tutte le gare del turno (includendo tutte le competizioni e divisioni/gironi disputati) con marcatori e fantavoti reali.\n"
      + "4. Rubrica FantaMister: analisi tattica sull'efficienza delle formazioni schierate dai mister e i punti persi nelle scelte dei titolari.\n"
      + "5. Protagonisti individuali: Top e Flop di giornata con i relativi fantavoti.\n"
      + "6. Conseguenze sulla classifica aggiornata, segnalando i sorpassi e le variazioni di posizione rispetto al turno precedente.",

    epico: "Sei un cantore epico che narra le gesta del Fantacalcio come se fossero leggendarie battaglie campali.\n"
      + "Scrivi una cronaca drammatica ed eroica dell'ultima giornata basandoti RIGOROSAMENTE sui DATI REALI forniti.\n"
      + "STILE: Enfatico, solenne, teatrale e drammatico. Metafore guerresche, rimonte leggendarie e la tragedia sportiva della sconfitta all'ultimo secondo.\n"
      + "STRUTTURA:\n"
      + "1. Prologo solenne sull'inizio della battaglia e il destino dei contendenti.\n"
      + "2. Il duello più feroce: sangue, sudore e gloria sul campo da gioco, con i condottieri e i guerrieri andati a segno.\n"
      + "3. Tutti i risultati dei campi di battaglia (di ogni competizione e divisione disputata nel turno) con punteggi e marcatori reali.\n"
      + "4. Il responso del FantaMister: il generale sapiente (miglior mister) e lo stratega sciagurato che ha condannato i suoi eroi alla panchina.\n"
      + "5. L'eroe supremo (top player) e il caduto disonorato (flop player).\n"
      + "6. Il nuovo ordine stabilito nella classifica del regno, narrando le ascese, i sorpassi e le cadute rispetto al turno precedente."
  },

  /**
   * Inizializzazione modulo nel pannello admin
   */
  async init() {
    await this.fetchStatus();
    this.populateMatchdaysDropdown();
    this.bindEvents();
    this.onMatchdayChange();
    await this.loadPublishedList();
  },

  getCsrfToken() {
    if (this.config && this.config.csrfToken) {
      return this.config.csrfToken;
    }
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]') : null;
    return meta ? (meta.getAttribute('content') || '') : '';
  },

  /**
   * Recupera lo stato attuale dal backend
   */
  async fetchStatus() {
    try {
      const res = await fetch('../inc/api_ai_news.php?action=status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.config = data;
          this.renderConfigState();
        }
      }
    } catch (e) {
      console.warn('[fcmAiNewsAdmin] Impossibile recuperare lo stato AI:', e);
    }
  },

  /**
   * Aggiorna gli elementi UI di configurazione
   */
  renderConfigState() {
    const statusBadge = document.getElementById('aiConfigStatusBadge');
    const modelSelect = document.getElementById('aiModelSelect');
    const toneSelect = document.getElementById('aiToneSelect');
    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const btnEdit = document.getElementById('btnEditAiApiKey');
    const btnClear = document.getElementById('btnClearAiApiKey');
    const helpText = document.getElementById('aiApiKeyHelpText');

    if (statusBadge) {
      if (this.config.configured) {
        statusBadge.className = 'badge-status-changes';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadge.style.color = 'var(--accent-emerald)';
        statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusBadge.innerHTML = '<span>🟢</span> API Key Configurata';
      } else {
        statusBadge.className = 'badge-status-changes';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBadge.style.color = 'var(--accent-rose)';
        statusBadge.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusBadge.innerHTML = '<span>🔴</span> API Key Mancante';
      }
    }

    if (apiKeyInput) {
      if (this.config.configured) {
        apiKeyInput.value = '••••••••••••••••••••••••••••••••';
        apiKeyInput.disabled = true;
        apiKeyInput.readOnly = true;
        apiKeyInput.style.backgroundColor = 'var(--bg-surface-elevated)';
        apiKeyInput.style.color = 'var(--text-muted)';
        apiKeyInput.style.cursor = 'not-allowed';
        apiKeyInput.style.opacity = '0.7';

        if (btnEdit) {
          btnEdit.style.display = 'inline-flex';
          btnEdit.innerHTML = '<span>✏️ Modifica</span>';
          btnEdit.onclick = () => this.unlockApiKeyInput();
        }
        if (btnClear) {
          btnClear.style.display = 'inline-flex';
          btnClear.innerHTML = '<span>🗑️ Svuota</span>';
          btnClear.onclick = () => this.clearApiKey();
        }
        if (helpText) {
          helpText.innerHTML = '<span>🔒 Chiave API memorizzata e attiva in <code>inc/data/ai_config.json</code>. Usa <strong>✏️ Modifica</strong> per sostituirla o <strong>🗑️ Svuota</strong> per rimuoverla.</span>';
        }
      } else {
        apiKeyInput.value = '';
        apiKeyInput.disabled = false;
        apiKeyInput.readOnly = false;
        apiKeyInput.placeholder = 'Incolla qui la chiave API (AIzaSy...)';
        apiKeyInput.style.backgroundColor = 'var(--bg-body)';
        apiKeyInput.style.color = 'var(--text-primary)';
        apiKeyInput.style.cursor = 'text';
        apiKeyInput.style.opacity = '1';

        if (btnEdit) btnEdit.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
        if (helpText) {
          helpText.innerHTML = 'La chiave viene memorizzata in <code>inc/data/ai_config.json</code> protetto da <code>.htaccess</code> e non è mai visibile al pubblico.';
        }
      }
    }

    if (modelSelect && this.config.model) {
      let isPreset = false;
      for (let i = 0; i < modelSelect.options.length; i++) {
        if (modelSelect.options[i].value === this.config.model) {
          isPreset = true;
          break;
        }
      }

      const customContainer = document.getElementById('aiCustomModelContainer');
      const customInput = document.getElementById('aiCustomModelInput');
      const btnToggleText = document.getElementById('btnToggleCustomModelText');

      if (isPreset) {
        modelSelect.value = this.config.model;
        if (customContainer) customContainer.style.display = 'none';
        if (customInput) customInput.value = '';
        if (btnToggleText) btnToggleText.textContent = '✏️ Personalizza';
      } else {
        if (customContainer) customContainer.style.display = 'block';
        if (customInput) customInput.value = this.config.model;
        if (btnToggleText) btnToggleText.textContent = '📋 Elenco Predefiniti';
      }
    }
    if (toneSelect && this.config.defaultTone) {
      toneSelect.value = this.config.defaultTone;
    }
  },

  /**
   * Mostra o nasconde il campo input per modello custom
   */
  toggleCustomModel() {
    const customContainer = document.getElementById('aiCustomModelContainer');
    const customInput = document.getElementById('aiCustomModelInput');
    const modelSelect = document.getElementById('aiModelSelect');
    const btnToggleText = document.getElementById('btnToggleCustomModelText');

    if (!customContainer) return;

    const isCurrentlyVisible = customContainer.style.display !== 'none';
    if (isCurrentlyVisible) {
      customContainer.style.display = 'none';
      if (btnToggleText) btnToggleText.textContent = '✏️ Personalizza';
    } else {
      customContainer.style.display = 'block';
      if (btnToggleText) btnToggleText.textContent = '📋 Elenco Predefiniti';
      if (customInput) {
        if (!customInput.value.trim() && modelSelect) {
          customInput.value = modelSelect.value;
        }
        customInput.focus();
      }
    }
  },

  /**
   * Annulla l'inserimento del modello personalizzato e torna alla lista
   */
  cancelCustomModel() {
    const customContainer = document.getElementById('aiCustomModelContainer');
    const customInput = document.getElementById('aiCustomModelInput');
    const btnToggleText = document.getElementById('btnToggleCustomModelText');

    if (customContainer) customContainer.style.display = 'none';
    if (customInput) customInput.value = '';
    if (btnToggleText) btnToggleText.textContent = '✏️ Personalizza';
  },

  /**
   * Restituisce il modello selezionato (custom se attivo e compilato, altrimenti select)
   */
  getSelectedModel() {
    const customContainer = document.getElementById('aiCustomModelContainer');
    const customInput = document.getElementById('aiCustomModelInput');
    const modelSelect = document.getElementById('aiModelSelect');

    if (customContainer && customContainer.style.display !== 'none' && customInput && customInput.value.trim()) {
      return customInput.value.trim();
    }
    return modelSelect ? modelSelect.value : 'gemini-3.8-flash';
  },

  /**
   * Sblocca il campo API Key per inserire una nuova chiave
   */
  unlockApiKeyInput() {
    const input = document.getElementById('aiApiKeyInput');
    const btnEdit = document.getElementById('btnEditAiApiKey');
    const btnClear = document.getElementById('btnClearAiApiKey');
    const helpText = document.getElementById('aiApiKeyHelpText');

    if (input) {
      input.disabled = false;
      input.readOnly = false;
      input.value = '';
      input.placeholder = 'Incolla la nuova chiave API (AIzaSy...)...';
      input.style.backgroundColor = 'var(--bg-body)';
      input.style.color = 'var(--text-primary)';
      input.style.cursor = 'text';
      input.style.opacity = '1';
      input.focus();
    }

    if (btnEdit) {
      btnEdit.innerHTML = '<span>❌ Annulla</span>';
      btnEdit.onclick = () => this.renderConfigState();
    }
    if (btnClear) {
      btnClear.style.display = 'inline-flex';
      btnClear.innerHTML = '<span>🧹 Pulisci</span>';
      btnClear.onclick = () => {
        if (input) {
          input.value = '';
          input.focus();
        }
      };
    }
    if (helpText) {
      helpText.innerHTML = '<span>✏️ Inserisci la nuova chiave e premi <strong>💾 Salva Configurazione AI</strong> in basso a destra per confermare.</span>';
    }
  },

  /**
   * Svuota e rimuove la chiave API
   */
  async clearApiKey() {
    const input = document.getElementById('aiApiKeyInput');

    if (!this.config.configured) {
      if (input) {
        input.value = '';
        input.focus();
      }
      return;
    }

    if (!confirm('Sei sicuro di voler rimuovere la chiave API salvata? Le funzionalità AI saranno disabilitate finché non ne configuri una nuova.')) {
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('../inc/api_ai_news.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: 'save_config',
          apiKey: ''
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Chiave API rimossa con successo!');
        await this.fetchStatus();
      } else {
        alert('Errore nella rimozione: ' + (data.error || 'Errore sconosciuto'));
      }
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
    }
  },

  /**
   * Popola il selettore con TUTTE le giornate già disputate con risultati inseriti
   */
  populateMatchdaysDropdown() {
    const select = document.getElementById('aiMatchdaySelect');
    if (!select) return;

    let playedDays = [];

    if (typeof fcmDataLoader !== 'undefined') {
      const cal = fcmDataLoader.getCalendarData();
      if (cal && cal.matchdays && cal.matchdays.length > 0) {
        // Estrae tutte le giornate con partite effettivamente giocate
        playedDays = cal.matchdays
          .filter(m => m.played && m.serieADay > 0)
          .map(m => ({
            day: m.serieADay,
            label: m.name ? `${m.serieADay}ª Giornata (${m.name})` : `${m.serieADay}ª Giornata`
          }));
      }

      // Fallback: se matchdays non ha flag giocato ma lastPlayed > 0
      if (playedDays.length === 0 && cal && cal.lastPlayed > 0) {
        for (let d = cal.lastPlayed; d >= 1; d--) {
          playedDays.push({ day: d, label: `${d}ª Giornata` });
        }
      }
    }

    if (playedDays.length === 0) {
      playedDays.push({ day: 1, label: '1ª Giornata' });
    }

    // Ordina dalla più recente alla meno recente
    playedDays.sort((a, b) => b.day - a.day);

    let html = '';
    playedDays.forEach((item, index) => {
      html += `<option value="${item.day}" ${index === 0 ? 'selected' : ''}>${item.label}</option>`;
    });
    select.innerHTML = html;
  },

  /**
   * Associa gli eventi della UI admin
   */
  bindEvents() {
    const toneSelect = document.getElementById('aiToneSelect');
    if (toneSelect) {
      toneSelect.addEventListener('change', () => {
        this.applyPromptPreset(toneSelect.value);
      });
    }

    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    if (matchdaySelect) {
      matchdaySelect.addEventListener('change', () => {
        this.onMatchdayChange();
      });
    }
  },

  /**
   * Applica il preset di prompt nella textarea modificabile
   */
  applyPromptPreset(tone) {
    const textarea = document.getElementById('aiPromptCustomText');
    if (!textarea) return;
    const selectedTone = tone || document.getElementById('aiToneSelect')?.value || 'ironico';
    if (this.promptTemplates[selectedTone]) {
      textarea.value = this.promptTemplates[selectedTone];
    }
  },

  /**
   * Gestisce il cambio di giornata selezionata
   */
  async onMatchdayChange() {
    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    if (!matchdaySelect) return;
    const day = parseInt(matchdaySelect.value, 10);
    this.applyPromptPreset();
    await this.checkMatchdayCache(day);
  },

  /**
   * Controlla se per la giornata esiste già un editoriale in cache
   */
  async checkMatchdayCache(day) {
    const statusEl = document.getElementById('aiMatchdayPublishedStatus');
    const deleteBtn = document.getElementById('btnAiDeletePublished');
    const editorSec = document.getElementById('aiDraftEditorSection');
    const publishBtn = document.getElementById('btnAiPublishArticle');

    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--text-muted);">Verifica cache in corso...</span>';
    }

    try {
      const res = await fetch(`../inc/api_ai_news.php?action=get&giornata=${day}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.available && data.article) {
          const art = data.article;
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:var(--accent-emerald); font-weight:700;">✅ Editoriale Pubblicato</span> <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${art.publishedFormatted || 'Disponibile'})</span>`;
          }
          if (deleteBtn) deleteBtn.style.display = 'inline-flex';
          this.fillDraftFields(art);
          if (editorSec) editorSec.style.display = 'block';
          if (publishBtn) publishBtn.innerHTML = `<span>💾 Aggiorna e Salva Modifiche (${day}ª Giornata)</span>`;
          return;
        }
      }
    } catch (e) {
      console.warn('[fcmAiNewsAdmin] Errore verifica cache:', e);
    }

    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--text-secondary);">⚪ Nessun editoriale pubblicato per questa giornata</span>';
    }
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (publishBtn) publishBtn.innerHTML = `<span>💾 Salva e Pubblica nella Homepage</span>`;
  },

  /**
   * Carica e visualizza l'elenco di tutte le notizie/editoriali già pubblicati
   */
  async loadPublishedList() {
    const container = document.getElementById('aiPublishedListContainer');
    const countBadge = document.getElementById('aiPublishedCountBadge');
    if (!container) return;

    try {
      const res = await fetch('../inc/api_ai_news.php?action=list');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.list)) {
          this.publishedArticles = data.list;
          if (countBadge) {
            countBadge.textContent = `${this.publishedArticles.length} Pubblicati`;
          }
          this.renderPublishedList();
          return;
        }
      }
    } catch (e) {
      console.warn('[fcmAiNewsAdmin] Errore caricamento lista pubblicati:', e);
    }

    container.innerHTML = '<div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; padding:10px 0;">Nessun editoriale presente in archivio.</div>';
  },

  /**
   * Renderizza la tabella/schede delle notizie già pubblicate con pulsanti di modifica ed eliminazione
   */
  renderPublishedList() {
    const container = document.getElementById('aiPublishedListContainer');
    if (!container) return;

    if (!this.publishedArticles || this.publishedArticles.length === 0) {
      container.innerHTML = `
        <div style="background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:var(--radius-sm); padding:16px; text-align:center; color:var(--text-muted); font-size:0.85rem;">
          ⚪ Nessun editoriale ancora pubblicato. Seleziona una giornata qui sopra e genera la prima cronaca con Gemini!
        </div>
      `;
      return;
    }

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    let html = `
      <div style="display:flex; flex-direction:column; gap:10px;">
    `;

    this.publishedArticles.forEach(art => {
      const day = art.giornata || 0;
      const title = escapeHtml(art.title || `Editoriale ${day}ª Giornata`);
      const subtitle = escapeHtml(art.subtitle || '');
      const pubDate = escapeHtml(art.publishedFormatted || '');
      const model = escapeHtml(art.model || 'Gemini AI');

      html += `
        <div class="card" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="flex:1; min-width:240px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="badge" style="background:rgba(99,102,241,0.15); color:var(--accent-primary); border:1px solid rgba(99,102,241,0.3); font-weight:700; font-size:0.75rem; padding:2px 8px; border-radius:var(--radius-full);">
                ${day}ª Giornata
              </span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${pubDate ? 'Pubblicato il ' + pubDate : ''}</span>
              <span style="font-size:0.72rem; color:var(--text-muted); opacity:0.8;">• ${model}</span>
            </div>
            <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary); margin-bottom:2px;">${title}</div>
            ${subtitle ? `<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">${subtitle}</div>` : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="calc-btn-action" onclick="fcmAiNewsAdmin.editPublishedArticle(${day})" style="padding:7px 12px; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;" title="Carica nell'editor per modificare">
              <span>✏️ Modifica</span>
            </button>
            <button type="button" class="calc-btn-action calc-btn-reset" onclick="fcmAiNewsAdmin.deletePublished(${day})" style="padding:7px 12px; font-size:0.78rem; border-color:rgba(239,68,68,0.4); color:var(--accent-rose); display:inline-flex; align-items:center; gap:4px;" title="Elimina dalla cache">
              <span>🗑️ Elimina</span>
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  /**
   * Carica un articolo già pubblicato direttamente nell'editor per ritoccarlo
   */
  async editPublishedArticle(day) {
    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    if (matchdaySelect) {
      matchdaySelect.value = day;
    }

    await this.checkMatchdayCache(day);

    const editorSec = document.getElementById('aiDraftEditorSection');
    if (editorSec) {
      editorSec.style.display = 'block';
      editorSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editorSec.style.transition = 'box-shadow 0.4s ease';
      editorSec.style.boxShadow = '0 0 0 3px var(--accent-primary)';
      setTimeout(() => { editorSec.style.boxShadow = ''; }, 2000);
    }
  },

  /**
   * Costruisce il payload completo e dettagliato dei dati di giornata
   * Include risultati completi, tabellini, voti base, bonus/malus, FantaMister e classifica integrale
   */
  async buildMatchdayPayload(day) {
    const payload = {
      giornata: day,
      lega: 'Fantacalcio',
      partite: [],
      riepilogoPerCompetizione: [],
      fantamister: null,
      topEFlopGiocatori: null,
      classificaAttuale: [],
      classificaTurnoPrecedente: null,
      sorpassiInClassifica: [],
      classifichePerCompetizione: [],
      // Campi di compatibilità
      topPlayer: null,
      flopPlayer: null,
      topMister: null,
      flopMister: null,
      classifica: []
    };

    if (typeof fcmDataLoader === 'undefined') return payload;

    const league = (typeof fcmDataLoader.getLeagueInfo === 'function') ? fcmDataLoader.getLeagueInfo() : null;
    if (league && league.name) payload.lega = league.name;

    // Assicura il caricamento delle anagrafiche calciatori Serie A se non presenti
    try {
      if (typeof xa1 === 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
        await fcmDataLoader.loadScript('js/fcmSerieADati.js');
      }
    } catch (e) { }

    // Assicura che il motore FantaMister sia caricato
    if (typeof fcmFantamisterMotore === 'undefined' && typeof fcmDataLoader.loadScript === 'function') {
      try {
        await fcmDataLoader.loadScript('js/fcmFantamisterMotore.js');
      } catch (e) { }
    }

    // Carica i tabellini dettagliati della giornata se non presenti
    try {
      if (typeof fcmDataLoader.loadMatchdayResults === 'function') {
        await fcmDataLoader.loadMatchdayResults(day);
      }
    } catch (e) {
      console.warn('Tabellini non disponibili o non caricabili per giornata ' + day, e);
    }

    // Elabora i dati tramite fcmFantamisterMotore se disponibile
    let fmData = null;
    if (typeof fcmFantamisterMotore !== 'undefined' && typeof fcmFantamisterMotore.getMatchdayData === 'function') {
      try {
        fmData = await fcmFantamisterMotore.getMatchdayData(day);
      } catch (e) {
        console.warn('Errore calcolo getMatchdayData:', e);
      }
    }

    // 1. Partite della giornata (tutte le competizioni e divisioni/gironi disputati nel turno)
    if (fmData && fmData.matches && fmData.matches.length > 0) {
      payload.partite = fmData.matches.map(m => {
        const homeTeam = (typeof fcmDataLoader.getTeamById === 'function') ? fcmDataLoader.getTeamById(m.homeTeamId) : null;
        const awayTeam = (typeof fcmDataLoader.getTeamById === 'function') ? fcmDataLoader.getTeamById(m.awayTeamId) : null;
        const homeCoach = homeTeam ? (homeTeam.Presidente || homeTeam.coach || '') : '';
        const awayCoach = awayTeam ? (awayTeam.Presidente || awayTeam.coach || '') : '';

        const formatScorers = (scorers) => {
          if (!scorers || scorers.length === 0) return [];
          const counts = {};
          scorers.forEach(s => {
            const clubStr = s.club ? ` (${s.club})` : '';
            const key = `${s.name}${clubStr}`;
            counts[key] = (counts[key] || 0) + 1;
          });
          return Object.entries(counts).map(([name, num]) => num > 1 ? `${name} [${num} gol]` : `${name} [1 gol]`);
        };

        const getMatchTeamEntry = (teamId) => {
          if (fmData.teamsByMatchKey && fmData.teamsByMatchKey[`${m.matchId}_${teamId}`]) {
            return fmData.teamsByMatchKey[`${m.matchId}_${teamId}`];
          }
          return fmData.teamsMap ? fmData.teamsMap[teamId] : null;
        };

        const formatStarters = (teamId) => {
          const teamObj = getMatchTeamEntry(teamId);
          if (!teamObj || !teamObj.starters) return [];
          return teamObj.starters.map(p => ({
            nome: p.name,
            ruolo: p.roleLabel || (p.role === 1 ? 'P' : (p.role === 2 ? 'D' : (p.role === 3 ? 'C' : 'A'))),
            club: p.club || '',
            votoBase: p.rawVote || '-',
            bonusMalus: p.bonusMalus || '0',
            fantavoto: p.totVote || '-'
          }));
        };

        const formatRegrets = (teamId) => {
          const teamObj = getMatchTeamEntry(teamId);
          if (!teamObj || !teamObj.bench) return [];
          return teamObj.bench
            .filter(p => parseFloat(p.totVote) >= 7.0 || parseFloat(p.bonusMalus) > 0)
            .map(p => `${p.name} (${p.club || ''}, FV: ${p.totVote})`);
        };

        const homeScorersList = formatScorers(m.homeScorers);
        const awayScorersList = formatScorers(m.awayScorers);

        return {
          competizione: m.compName || payload.lega || 'Campionato',
          divisioneGirone: m.groupName || '',
          turno: m.fantagiornataName || `${day}ª Giornata`,
          casa: m.homeTeamName,
          allenatoreCasa: homeCoach,
          fuori: m.awayTeamName,
          allenatoreFuori: awayCoach,
          golCasa: m.homeGoals,
          golFuori: m.awayGoals,
          totalePuntiCasa: m.homeTotal,
          totalePuntiFuori: m.awayTotal,
          risultatoFinale: `${m.homeGoals} - ${m.awayGoals} (${m.homeTotal} - ${m.awayTotal})`,
          marcatoriCasa: homeScorersList,
          marcatoriFuori: awayScorersList,
          marcatori: [...homeScorersList.map(s => `${s} [${m.homeTeamName}]`), ...awayScorersList.map(s => `${s} [${m.awayTeamName}]`)],
          manOfTheMatch: m.manOfTheMatch ? {
            nome: m.manOfTheMatch.name,
            ruolo: m.manOfTheMatch.roleLabel || '',
            club: m.manOfTheMatch.club || '',
            fantavoto: m.manOfTheMatch.totVote,
            votoBase: m.manOfTheMatch.rawVote,
            squadra: m.manOfTheMatch.isHome ? m.homeTeamName : m.awayTeamName
          } : null,
          rimpiantiPanchinaCasa: formatRegrets(m.homeTeamId),
          rimpiantiPanchinaFuori: formatRegrets(m.awayTeamId),
          titolariCasa: formatStarters(m.homeTeamId),
          titolariFuori: formatStarters(m.awayTeamId)
        };
      });
    } else {
      // Fallback classico se fcmFantamisterMotore non ha prodotto incontri
      let res = null;
      if (typeof fcmDataLoader.getResultsData === 'function') {
        res = fcmDataLoader.getResultsData(day);
      } else if (typeof fcmDataLoader.getCalendarData === 'function') {
        const cal = fcmDataLoader.getCalendarData();
        const dayMatches = (cal && cal.matches) ? cal.matches.filter(m => m.serieADay === day) : [];
        res = { day, matches: dayMatches, playedMatches: dayMatches.filter(m => m.played) };
      }
      if (res && res.matches && res.matches.length > 0) {
        payload.partite = res.matches.map(m => {
          const homeName = m.homeTeamName || (m.homeTeam && m.homeTeam.name) || 'Casa';
          const awayName = m.awayTeamName || (m.awayTeam && m.awayTeam.name) || 'Fuori';
          const homeScore = (m.homeScore !== undefined) ? m.homeScore : (m.homeGoals !== undefined ? m.homeGoals : 0);
          const awayScore = (m.awayScore !== undefined) ? m.awayScore : (m.awayGoals !== undefined ? m.awayGoals : 0);
          const homeTotal = (m.homeTotal !== undefined) ? m.homeTotal : 0;
          const awayTotal = (m.awayTotal !== undefined) ? m.awayTotal : 0;
          const marcatori = (m.events || []).filter(e => e.type === 'gol').map(e => `${e.playerName} (${e.teamName})`);

          return {
            competizione: m.compName || payload.lega || 'Campionato',
            divisioneGirone: m.groupName || '',
            turno: m.fantagiornataNome || `${day}ª Giornata`,
            casa: homeName,
            fuori: awayName,
            golCasa: homeScore,
            golFuori: awayScore,
            totCasa: homeTotal,
            totFuori: awayTotal,
            risultatoFinale: `${homeScore} - ${awayScore} (${homeTotal} - ${awayTotal})`,
            marcatori: marcatori
          };
        });
      }
    }

    // Raggruppa le partite per competizione e divisione/girone in riepilogoPerCompetizione
    if (payload.partite.length > 0) {
      const compGroupsMap = new Map();
      payload.partite.forEach(p => {
        const key = `${p.competizione || ''}||${p.divisioneGirone || ''}`;
        if (!compGroupsMap.has(key)) {
          compGroupsMap.set(key, {
            competizione: p.competizione || payload.lega,
            divisioneGirone: p.divisioneGirone || '',
            turno: p.turno || '',
            partite: []
          });
        }
        compGroupsMap.get(key).partite.push({
          casa: p.casa,
          fuori: p.fuori,
          risultatoFinale: p.risultatoFinale,
          marcatoriCasa: p.marcatoriCasa || [],
          marcatoriFuori: p.marcatoriFuori || [],
          manOfTheMatch: p.manOfTheMatch ? `${p.manOfTheMatch.nome} (${p.manOfTheMatch.squadra}, FV: ${p.manOfTheMatch.fantavoto})` : null
        });
      });
      payload.riepilogoPerCompetizione = Array.from(compGroupsMap.values());
    }

    // 2. FantaMister
    if (fmData) {
      payload.fantamister = {
        migliorMister: fmData.bestMister ? {
          squadra: fmData.bestMister.Nome,
          allenatore: fmData.bestMister.coach,
          puntiReali: fmData.bestMister.Parz,
          puntiMassimiIdeali: fmData.bestMister.Max,
          scartoMinimo: fmData.bestMister.Scarto,
          moduloSchierato: fmData.bestMister.ModParz,
          moduloIdeale: fmData.bestMister.ModMax
        } : null,
        peggiorMister: fmData.worstMister ? {
          squadra: fmData.worstMister.Nome,
          allenatore: fmData.worstMister.coach,
          puntiReali: fmData.worstMister.Parz,
          puntiMassimiIdeali: fmData.worstMister.Max,
          puntiLasciatiInPanchina: fmData.worstMister.Scarto,
          moduloSchierato: fmData.worstMister.ModParz,
          moduloIdeale: fmData.worstMister.ModMax
        } : null,
        topScoreDiGiornata: fmData.topScore ? {
          squadra: fmData.topScore.Nome,
          allenatore: fmData.topScore.coach,
          punteggio: fmData.topScore.totalScore || fmData.topScore.total
        } : null,
        lowestScoreDiGiornata: fmData.lowestScore ? {
          squadra: fmData.lowestScore.Nome,
          allenatore: fmData.lowestScore.coach,
          punteggio: fmData.lowestScore.totalScore || fmData.lowestScore.total
        } : null,
        classificaEfficienzaMister: (fmData.ranking || []).map((r, idx) => ({
          posizione: idx + 1,
          squadra: r.Nome,
          allenatore: r.coach,
          puntiReali: r.Parz,
          puntiIdealiMax: r.Max,
          scarto: r.Scarto
        }))
      };

      if (payload.fantamister.migliorMister) {
        payload.topMister = {
          squadra: payload.fantamister.migliorMister.squadra,
          allenatore: payload.fantamister.migliorMister.allenatore,
          scarto: payload.fantamister.migliorMister.scartoMinimo,
          totale: payload.fantamister.migliorMister.puntiReali
        };
      }
      if (payload.fantamister.peggiorMister) {
        payload.flopMister = {
          squadra: payload.fantamister.peggiorMister.squadra,
          allenatore: payload.fantamister.peggiorMister.allenatore,
          scarto: payload.fantamister.peggiorMister.puntiLasciatiInPanchina,
          totale: payload.fantamister.peggiorMister.puntiReali
        };
      }
    }

    // 3. Top / Flop Giocatori
    if (fmData) {
      const allFielded = [];
      (fmData.teamsList || []).forEach(t => {
        const fantaTeamName = t.Nome || t.name || '';
        (t.starters || []).forEach(p => {
          const fv = parseFloat(p.totVote);
          const vb = parseFloat(p.rawVote);
          if (!isNaN(fv) && fv > 0) {
            allFielded.push({
              nome: p.name,
              ruolo: p.roleLabel || (p.role === 1 ? 'P' : (p.role === 2 ? 'D' : (p.role === 3 ? 'C' : 'A'))),
              baseRole: p.role,
              club: p.club || '',
              fantasquadra: fantaTeamName,
              fantavoto: p.totVote,
              votoBase: p.rawVote,
              bonusMalus: p.bonusMalus,
              fvNum: fv,
              vbNum: !isNaN(vb) ? vb : 0
            });
          }
        });
      });

      // Se allFielded è vuoto, usa come fallback i calciatori della Top 11
      if (allFielded.length === 0 && fmData.top11 && fmData.top11.length > 0) {
        fmData.top11.forEach(p => {
          const fv = parseFloat(p.totVote);
          if (!isNaN(fv) && fv > 0) {
            allFielded.push({
              nome: p.name,
              ruolo: p.roleLabel || '',
              baseRole: p.role,
              club: p.club || '',
              fantasquadra: '',
              fantavoto: p.totVote,
              votoBase: p.rawVote,
              bonusMalus: p.bonusMalus,
              fvNum: fv,
              vbNum: parseFloat(p.rawVote) || 0
            });
          }
        });
      }

      // Ordina decrescente per fantavoto effettivo (a parità per voto base)
      allFielded.sort((a, b) => b.fvNum - a.fvNum || b.vbNum - a.vbNum);

      const topAbsolute = allFielded.length > 0 ? allFielded[0] : null;
      const topOutfield = allFielded.find(p => p.baseRole !== 1) || null;
      const topKeeper = allFielded.find(p => p.baseRole === 1) || null;

      // Ordina crescente per i peggiori
      const sortedAsc = [...allFielded].sort((a, b) => a.fvNum - b.fvNum || a.vbNum - b.vbNum);
      const worstAbsolute = sortedAsc.length > 0 ? sortedAsc[0] : null;
      const worstOutfield = sortedAsc.find(p => p.baseRole !== 1) || null;
      const worstKeeper = sortedAsc.find(p => p.baseRole === 1) || null;

      payload.topEFlopGiocatori = {
        miglioreAssoluto: topAbsolute ? {
          nome: topAbsolute.nome,
          ruolo: topAbsolute.ruolo,
          club: topAbsolute.club,
          fantasquadra: topAbsolute.fantasquadra,
          fantavoto: topAbsolute.fantavoto,
          votoBase: topAbsolute.votoBase
        } : null,
        migliorGiocatoreMovimento: topOutfield ? {
          nome: topOutfield.nome,
          ruolo: topOutfield.ruolo,
          club: topOutfield.club,
          fantasquadra: topOutfield.fantasquadra,
          fantavoto: topOutfield.fantavoto,
          votoBase: topOutfield.votoBase
        } : null,
        migliorPortiere: topKeeper ? {
          nome: topKeeper.nome,
          ruolo: topKeeper.ruolo,
          club: topKeeper.club,
          fantasquadra: topKeeper.fantasquadra,
          fantavoto: topKeeper.fantavoto,
          votoBase: topKeeper.votoBase
        } : null,
        peggioreAssoluto: worstAbsolute ? {
          nome: worstAbsolute.nome,
          ruolo: worstAbsolute.ruolo,
          club: worstAbsolute.club,
          fantasquadra: worstAbsolute.fantasquadra,
          fantavoto: worstAbsolute.fantavoto,
          votoBase: worstAbsolute.votoBase
        } : null,
        peggiorGiocatoreMovimento: worstOutfield ? {
          nome: worstOutfield.nome,
          ruolo: worstOutfield.ruolo,
          club: worstOutfield.club,
          fantasquadra: worstOutfield.fantasquadra,
          fantavoto: worstOutfield.fantavoto,
          votoBase: worstOutfield.votoBase
        } : null,
        peggiorPortiere: worstKeeper ? {
          nome: worstKeeper.nome,
          ruolo: worstKeeper.ruolo,
          club: worstKeeper.club,
          fantasquadra: worstKeeper.fantasquadra,
          fantavoto: worstKeeper.fantavoto,
          votoBase: worstKeeper.votoBase
        } : null,
        top11: (fmData.top11 || []).map(p => ({
          nome: p.name,
          ruolo: p.roleLabel || '',
          club: p.club || '',
          fantavoto: p.totVote
        })),
        flop11: (fmData.flop11 || []).map(p => ({
          nome: p.name,
          ruolo: p.roleLabel || '',
          club: p.club || '',
          fantavoto: p.totVote
        }))
      };

      if (payload.topEFlopGiocatori.miglioreAssoluto) {
        payload.topPlayer = payload.topEFlopGiocatori.miglioreAssoluto;
      }
      if (payload.topEFlopGiocatori.peggioreAssoluto) {
        payload.flopPlayer = payload.topEFlopGiocatori.peggioreAssoluto;
      }
    }

    // 4. Classifiche (Attuale al turno selezionato, Turno Precedente e Sorpassi) per tutte le divisioni/gironi attivi
    const buildGroupStandingsAnalysis = (groupId, compNameLabel, groupNameLabel) => {
      let currRaw = null;
      if (typeof fcmDataLoader.getStandingsAtMatchday === 'function') {
        currRaw = fcmDataLoader.getStandingsAtMatchday(groupId, day);
      }
      if ((!currRaw || currRaw.length === 0) && typeof fcmDataLoader.getStandings === 'function') {
        const fallback = fcmDataLoader.getStandings(groupId);
        if (fallback && fallback.length > 0 && fallback.some(t => t.played > 0)) {
          currRaw = fallback;
        }
      }
      if (!Array.isArray(currRaw) || currRaw.length === 0) return null;

      let prevRaw = [];
      if (day > 1 && typeof fcmDataLoader.getStandingsAtMatchday === 'function') {
        prevRaw = fcmDataLoader.getStandingsAtMatchday(groupId, day - 1) || [];
      }
      const hasPrev = Array.isArray(prevRaw) && prevRaw.length > 0 && prevRaw.some(t => t.played > 0);
      const prevMap = {};
      if (hasPrev) {
        prevRaw.forEach(p => {
          prevMap[p.teamId] = p;
        });
      }

      const sorpassi = [];
      const formattedCurr = currRaw.map(s => {
        const prev = hasPrev ? prevMap[s.teamId] : null;
        const diffPos = prev ? (prev.pos - s.pos) : 0;
        let varStr = '=';
        if (prev) {
          if (diffPos > 0) varStr = `+${diffPos}`;
          else if (diffPos < 0) varStr = `${diffPos}`;
        } else {
          varStr = null;
        }

        if (prev && diffPos > 0) {
          const sorpassate = currRaw
            .filter(other => {
              const otherPrev = prevMap[other.teamId];
              return otherPrev && otherPrev.pos < prev.pos && other.pos > s.pos;
            })
            .map(other => other.name);

          const sorpassoTxt = sorpassate.length > 0 ? `, sorpassando ${sorpassate.join(' e ')}` : '';
          sorpassi.push(`${s.name} sale dal ${prev.pos}° al ${s.pos}° posto (da ${prev.points} a ${s.points} pt)${sorpassoTxt}`);
        } else if (prev && diffPos < 0) {
          sorpassi.push(`${s.name} scende dal ${prev.pos}° al ${s.pos}° posto (${s.points} pt)`);
        }

        return {
          posizione: s.pos,
          posizionePrecedente: prev ? prev.pos : null,
          variazionePosizione: varStr,
          squadra: s.name,
          allenatore: s.coach || '',
          puntiInClassifica: s.points,
          puntiPrecedenti: prev ? prev.points : null,
          partiteGiocate: s.played,
          vinte: s.winsTot,
          pareggiate: s.drawsTot,
          perse: s.lossesTot,
          golFatti: s.goalsFor,
          golSubiti: s.goalsAgainst,
          differenzaReti: s.goalDiff,
          totalePuntiFanta: s.sommaTotali || 0
        };
      });

      const formattedPrev = hasPrev ? prevRaw.map(p => ({
        posizione: p.pos,
        squadra: p.name,
        allenatore: p.coach || '',
        puntiInClassifica: p.points,
        partiteGiocate: p.played,
        differenzaReti: p.goalDiff,
        totalePuntiFanta: p.sommaTotali || 0
      })) : null;

      return {
        groupId,
        competizione: compNameLabel || payload.lega || 'Campionato',
        divisioneGirone: groupNameLabel || '',
        classificaAttuale: formattedCurr,
        classificaTurnoPrecedente: formattedPrev,
        sorpassiInClassifica: sorpassi
      };
    };

    const groupsToAnalyze = [];
    const seenGroups = new Set();
    if (typeof fcmDataLoader.getCompetitions === 'function') {
      const comps = fcmDataLoader.getCompetitions() || [];
      comps.forEach(c => {
        (c.groups || []).forEach(g => {
          const gId = (g.ID !== undefined) ? parseInt(g.ID, 10) : parseInt(g.id, 10);
          if (!isNaN(gId) && !seenGroups.has(gId)) {
            seenGroups.add(gId);
            groupsToAnalyze.push({
              groupId: gId,
              compName: c.name || c.Nome || '',
              groupName: g.Nome || g.name || ''
            });
          }
        });
      });
    }
    if (groupsToAnalyze.length === 0) {
      groupsToAnalyze.push({ groupId: undefined, compName: payload.lega, groupName: '' });
    }

    groupsToAnalyze.forEach(gInfo => {
      const analysis = buildGroupStandingsAnalysis(gInfo.groupId, gInfo.compName, gInfo.groupName);
      if (analysis && analysis.classificaAttuale.length > 0 && analysis.classificaAttuale.some(t => t.partiteGiocate > 0)) {
        payload.classifichePerCompetizione.push(analysis);
      }
    });

    if (payload.classifichePerCompetizione.length === 0 && typeof fcmDataLoader.getStandings === 'function') {
      const rawStandings = fcmDataLoader.getStandings();
      if (Array.isArray(rawStandings) && rawStandings.length > 0) {
        payload.classifichePerCompetizione.push({
          groupId: rawStandings[0].groupId || 1,
          competizione: payload.lega,
          divisioneGirone: '',
          classificaAttuale: rawStandings.map(s => ({
            posizione: s.pos,
            posizionePrecedente: null,
            variazionePosizione: null,
            squadra: s.name,
            allenatore: s.coach || '',
            puntiInClassifica: s.points,
            puntiPrecedenti: null,
            partiteGiocate: s.played,
            vinte: s.winsTot,
            pareggiate: s.drawsTot,
            perse: s.lossesTot,
            golFatti: s.goalsFor,
            golSubiti: s.goalsAgainst,
            differenzaReti: s.goalDiff,
            totalePuntiFanta: s.sommaTotali || 0
          })),
          classificaTurnoPrecedente: null,
          sorpassiInClassifica: []
        });
      }
    }

    if (payload.classifichePerCompetizione.length > 0) {
      const mainSt = payload.classifichePerCompetizione[0];
      payload.classificaAttuale = mainSt.classificaAttuale;
      payload.classificaTurnoPrecedente = mainSt.classificaTurnoPrecedente;
      payload.sorpassiInClassifica = mainSt.sorpassiInClassifica;
      payload.classifica = mainSt.classificaAttuale.map(t => ({
        posizione: t.posizione,
        squadra: t.squadra,
        punti: t.puntiInClassifica,
        totalePuntiFanta: t.totalePuntiFanta
      }));
    }

    return payload;
  },

  /**
   * Salva le credenziali e preferenze API
   */
  async saveConfig() {
    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const modelSelect = document.getElementById('aiModelSelect');
    const toneSelect = document.getElementById('aiToneSelect');
    const btn = document.getElementById('btnSaveAiConfig');

    // Se l'input è disabilitato/bloccato (con gli asterischi), non sovrascrivere la chiave esistente (invia null)
    let apiKeyToSend = null;
    if (apiKeyInput && !apiKeyInput.disabled) {
      const val = apiKeyInput.value.trim();
      if (!val.includes('•••') && !val.includes('***')) {
        apiKeyToSend = val;
      }
    }

    const payload = {
      action: 'save_config',
      apiKey: apiKeyToSend,
      model: this.getSelectedModel(),
      defaultTone: toneSelect ? toneSelect.value : 'ironico'
    };

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvataggio...';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('../inc/api_ai_news.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Configurazione AI salvata con successo!');
        await this.fetchStatus();
      } else {
        alert('Errore nel salvataggio: ' + (data.error || 'Errore sconosciuto'));
      }
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salva Configurazione AI';
      }
    }
  },

  /**
   * Genera la bozza con Gemini
   */
  async generateDraft() {
    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    const promptTextarea = document.getElementById('aiPromptCustomText');
    const modelSelect = document.getElementById('aiModelSelect');
    const btn = document.getElementById('btnAiGenerateDraft');
    const editorSec = document.getElementById('aiDraftEditorSection');

    const day = matchdaySelect ? parseInt(matchdaySelect.value, 10) : 1;
    const prompt = promptTextarea ? promptTextarea.value.trim() : '';
    const model = this.getSelectedModel();

    if (!prompt) {
      alert('Inserisci le istruzioni o seleziona un preset di stile per il prompt.');
      return;
    }

    const dataSummary = await this.buildMatchdayPayload(day);

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="display:inline-block; animation:spin 1s linear infinite; margin-right:6px;">⚡</span> Generazione in corso con Gemini...';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('../inc/api_ai_news.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: 'generate',
          giornata: day,
          systemPrompt: prompt,
          dataSummary: dataSummary,
          model: model
        })
      });

      const data = await res.json();
      if (data.success && data.draft) {
        this.fillDraftFields(data.draft);
        if (editorSec) {
          editorSec.style.display = 'block';
          editorSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        alert('Bozza generata con successo! Ora puoi ritoccare il testo prima di pubblicarlo.');
      } else {
        alert('Errore generazione AI: ' + (data.error || 'Risposta vuota'));
      }
    } catch (e) {
      alert('Errore di rete durante la generazione: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡ Genera Bozza con Gemini</span>';
      }
    }
  },

  /**
   * Compila i campi della sezione di editing della bozza
   */
  fillDraftFields(article) {
    const titleInput = document.getElementById('aiDraftTitle');
    const subInput = document.getElementById('aiDraftSubtitle');
    const clouInput = document.getElementById('aiDraftHighlightClou');
    const topInput = document.getElementById('aiDraftHighlightTop');
    const beffaInput = document.getElementById('aiDraftHighlightBeffa');
    const contentTextarea = document.getElementById('aiDraftContent');

    if (titleInput) titleInput.value = article.title || '';
    if (subInput) subInput.value = article.subtitle || '';
    if (clouInput) clouInput.value = (article.highlights && article.highlights.clou) ? article.highlights.clou : '';
    if (topInput) topInput.value = (article.highlights && article.highlights.top) ? article.highlights.top : '';
    if (beffaInput) beffaInput.value = (article.highlights && article.highlights.beffa) ? article.highlights.beffa : '';
    if (contentTextarea) contentTextarea.value = article.content || '';

    this.updatePreviewBox();
  },

  /**
   * Aggiorna il riquadro di anteprima istantanea
   */
  updatePreviewBox() {
    const previewContainer = document.getElementById('aiDraftLivePreview');
    if (!previewContainer) return;

    const title = document.getElementById('aiDraftTitle')?.value || 'Titolo Editoriale';
    const subtitle = document.getElementById('aiDraftSubtitle')?.value || '';
    const clou = document.getElementById('aiDraftHighlightClou')?.value || '';
    const top = document.getElementById('aiDraftHighlightTop')?.value || '';
    const beffa = document.getElementById('aiDraftHighlightBeffa')?.value || '';
    const content = document.getElementById('aiDraftContent')?.value || '';
    const day = document.getElementById('aiMatchdaySelect')?.value || '1';

    const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const contentHtml = paragraphs.map(p => `<p style="margin-bottom:10px; line-height:1.5;">${escapeHtml(p)}</p>`).join('');

    previewContainer.innerHTML = `
      <div class="card ai-editorial-card preview-mode" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span class="badge" style="background:linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2)); color:var(--accent-primary); border:1px solid rgba(99,102,241,0.3); font-weight:700; font-size:0.75rem; padding:4px 10px; border-radius:var(--radius-full);">✨ L'Editoriale di Giornata</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">${day}ª Giornata • Anteprima</span>
        </div>
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin:0 0 6px 0;">${escapeHtml(title)}</h3>
        ${subtitle ? `<p style="font-size:0.86rem; color:var(--text-secondary); font-style:italic; margin:0 0 14px 0;">${escapeHtml(subtitle)}</p>` : ''}
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:14px;">
          ${clou ? `<div style="background:var(--bg-body); border:1px solid var(--border-subtle); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.78rem;"><strong style="color:var(--accent-gold);">⚡ Match Clou:</strong> ${escapeHtml(clou)}</div>` : ''}
          ${top ? `<div style="background:var(--bg-body); border:1px solid var(--border-subtle); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.78rem;"><strong style="color:var(--accent-emerald);">🌟 Top Player:</strong> ${escapeHtml(top)}</div>` : ''}
          ${beffa ? `<div style="background:var(--bg-body); border:1px solid var(--border-subtle); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.78rem;"><strong style="color:var(--accent-rose);">💔 La Beffa:</strong> ${escapeHtml(beffa)}</div>` : ''}
        </div>

        <div style="font-size:0.88rem; color:var(--text-primary);">${contentHtml}</div>
      </div>
    `;
  },

  /**
   * Salva e pubblica l'articolo definitivo
   */
  async publishArticle() {
    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    const btn = document.getElementById('btnAiPublishArticle');

    const day = matchdaySelect ? parseInt(matchdaySelect.value, 10) : 1;
    const title = document.getElementById('aiDraftTitle')?.value.trim();
    const subtitle = document.getElementById('aiDraftSubtitle')?.value.trim();
    const clou = document.getElementById('aiDraftHighlightClou')?.value.trim();
    const top = document.getElementById('aiDraftHighlightTop')?.value.trim();
    const beffa = document.getElementById('aiDraftHighlightBeffa')?.value.trim();
    const content = document.getElementById('aiDraftContent')?.value.trim();

    if (!title || !content) {
      alert('Titolo e Contenuto sono obbligatori per pubblicare.');
      return;
    }

    const article = {
      title,
      subtitle,
      content,
      highlights: { clou, top, beffa }
    };

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Pubblicazione in corso...';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('../inc/api_ai_news.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: 'publish',
          giornata: day,
          article: article
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Editoriale della ${day}ª Giornata salvato e pubblicato con successo!`);
        await this.checkMatchdayCache(day);
        await this.loadPublishedList();
      } else {
        alert('Errore durante la pubblicazione: ' + (data.error || 'Errore sconosciuto'));
      }
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>💾 Aggiorna e Salva Modifiche (${day}ª Giornata)</span>`;
      }
    }
  },

  /**
   * Elimina l'editoriale pubblicato per la giornata
   */
  async deletePublished(targetDay) {
    const matchdaySelect = document.getElementById('aiMatchdaySelect');
    const day = (typeof targetDay === 'number' && targetDay > 0)
      ? targetDay
      : (matchdaySelect ? parseInt(matchdaySelect.value, 10) : 1);

    if (!confirm(`Sei sicuro di voler eliminare l'editoriale pubblicato per la ${day}ª Giornata?`)) {
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('../inc/api_ai_news.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action: 'delete', giornata: day })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Editoriale della ${day}ª Giornata eliminato dalla cache.`);
        const currentSelectedDay = matchdaySelect ? parseInt(matchdaySelect.value, 10) : 1;
        await this.checkMatchdayCache(currentSelectedDay);
        await this.loadPublishedList();
      } else {
        alert('Errore: ' + data.error);
      }
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
    }
  }
};

window.fcmAiNewsAdmin = fcmAiNewsAdmin;
