/**
 * ==========================================================================
 * MODERNFCM - PROBABILI FORMAZIONI SKY SPORT (MODULO NATIVO INTEGRATO)
 * ==========================================================================
 * Modulo nativo completamente integrato in invform.php (zero iframe, zero loop)
 * Dinamico: estrae automaticamente le 20 squadre di Serie A della stagione attuale
 * Ottimizzato: cache in memoria delle partite e statistiche calciatori, zero richieste duplicate
 * ==========================================================================
 */

(function () {
  'use strict';

  var SKY_URL = 'https://sport.sky.it/calcio/serie-a/probabili-formazioni';

  var SkyProbState = {
    matches: [],          // Tutte le 10 partite parsate dal widget Sky Sport
    teams: [],            // Squadre Serie A effettive estratte dinamicamente
    selectedTeam: '',     // Squadra attualmente selezionata
    matchdayInfo: '',     // es. "Serie A, Giornata 10"
    isLoading: false,     // Stato di caricamento
    lastFetched: 0,       // Timestamp ultimo fetch
    statCache: {},        // Cache HTML statistiche per giocatore: { [link]: html }
    error: null           // Eventuale errore
  };

  /**
   * Normalizza stringhe per confronti sicuri (rimuove accenti, caratteri speciali, spazi, lowercase)
   */
  function normalizza(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Genera lo slug standard per la cartella immagini probimg/
   */
  function ottieniSlugSquadra(teamName) {
    if (!teamName) return '';
    if (teamName == "Hellas Verona") return "Verona";
    return teamName;
  }

  /**
   * Estrae le squadre effettive di Serie A dal campionato FCM (fcmSerieADati.js)
   * o direttamente dalle partite del calendario, integrandole se necessario con Sky.
   */
  function OttieniSquadreSerieA() {
    var teams = [];
    var seen = {};

    // 1. Variabili globali xa1...xa20 generate da FCM (esattamente le 20 squadre di Serie A)
    for (var i = 1; i <= 20; i++) {
      var t = window['xa' + i];
      if (t && typeof t === 'string' && !t.startsWith('{') && !seen[normalizza(t)]) {
        seen[normalizza(t)] = true;
        teams.push(t);
      }
    }

    // 2. Fallback da arrIncontriA se le variabili xa non sono definite
    if (teams.length < 20 && typeof arrIncontriA !== 'undefined' && arrIncontriA && arrIncontriA.length > 0) {
      for (var j = 1; j < arrIncontriA.length; j++) {
        var inc = arrIncontriA[j];
        if (inc) {
          if (inc.SqCasa && !inc.SqCasa.startsWith('{') && !seen[normalizza(inc.SqCasa)]) {
            seen[normalizza(inc.SqCasa)] = true;
            teams.push(inc.SqCasa);
          }
          if (inc.SqFuori && !inc.SqFuori.startsWith('{') && !seen[normalizza(inc.SqFuori)]) {
            seen[normalizza(inc.SqFuori)] = true;
            teams.push(inc.SqFuori);
          }
        }
        if (teams.length >= 20) break;
      }
    }

    // 3. Fallback di sicurezza dalle partite Sky solo se non raggiungiamo 20 squadre
    if (teams.length < 20 && SkyProbState.matches && SkyProbState.matches.length > 0) {
      SkyProbState.matches.forEach(function (m) {
        if (teams.length >= 20) return;
        if (m.homeTeam && !seen[normalizza(m.homeTeam)]) {
          seen[normalizza(m.homeTeam)] = true;
          teams.push(m.homeTeam);
        }
        if (teams.length < 20 && m.awayTeam && !seen[normalizza(m.awayTeam)]) {
          seen[normalizza(m.awayTeam)] = true;
          teams.push(m.awayTeam);
        }
      });
    }

    // Limita esattamente alle 20 squadre di Serie A
    if (teams.length > 20) {
      teams = teams.slice(0, 20);
    }

    // Ordinamento alfabetico
    teams.sort(function (a, b) {
      return a.localeCompare(b, 'it', { sensitivity: 'base' });
    });

    return teams;
  }

  /**
   * Helper per estrarre il testo delle sezioni schede (Riserve, Indisponibili, Squalificati, In dubbio, Allenatore)
   */
  function estraiSezione(righe, titolo, isHome) {
    if (!righe || righe.length === 0) return '';
    var intestazione = righe.find(function (el) {
      return el.classList.contains('ftbl__report-tabs-panel__header') && el.textContent.trim() === titolo;
    });
    if (!intestazione) return '';
    var attr = isHome ? 'data-panel-left' : 'data-panel-right';
    var riga = intestazione.nextElementSibling;
    while (riga && !riga.classList.contains('ftbl__report-tabs-panel__header')) {
      if (riga.getAttribute(attr) === 'true') {
        var td = riga.querySelector('.ftbl__report-tabs-panel__td');
        return td ? td.textContent.trim() : '';
      }
      riga = riga.nextElementSibling;
    }
    return '';
  }

  /**
   * Effettua il fetch e parsing del documento Sky Sport
   */
  async function CaricaDatiSky(force) {
    var now = Date.now();
    // Cache di 15 minuti in memoria
    if (!force && SkyProbState.matches.length > 0 && (now - SkyProbState.lastFetched < 15 * 60 * 1000)) {
      return SkyProbState.matches;
    }

    SkyProbState.isLoading = true;
    SkyProbState.error = null;
    RenderStatoCaricamento();

    try {
      var res = await fetch(SKY_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Risposta HTTP da Sky Sport: ' + res.status);
      var text = await res.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(text, 'text/html');

      var widget = doc.querySelector('ld-football-competition-predicted-lineups');
      if (!widget) throw new Error('Widget formazioni Sky Sport non trovato.');

      var matchdayMatch = widget.textContent.match(/Giornata\s+\d+/i);
      SkyProbState.matchdayInfo = matchdayMatch ? matchdayMatch[0] : 'Serie A';

      var matchSections = [...widget.querySelectorAll('.ftbl__predicted-lineups-hp')];
      var parsedMatches = [];

      matchSections.forEach(function (section) {
        var nomiSquadre = [...section.querySelectorAll('.ftbl__team__name')].map(function (el) {
          return el.textContent.trim();
        });
        if (nomiSquadre.length < 2) return;

        var moduli = [...section.querySelectorAll('.ftbl__formation-home, .ftbl__formation-away')].map(function (el) {
          return el.textContent.trim();
        });
        var dataStr = section.querySelector('.ftbl__predicted-lineups-hp__date-long')?.textContent.trim() || '';
        var oraEl = [...section.querySelectorAll('span')].find(function (el) {
          return /^ore\s+\d{2}:\d{2}$/i.test(el.textContent.trim());
        });
        var oraStr = oraEl ? oraEl.textContent.trim() : '';

        var colonneGiocatori = [...section.querySelectorAll('.ftbl__match-formation-player')];
        var titolari = colonneGiocatori.slice(0, 22);

        var righe = [...section.querySelectorAll('tr')];

        // Dati squadra Casa (indice 0)
        var modCasaRaw = moduli[0] || '4-3-3';
        var modCasaArr = [1, ...modCasaRaw.split('-').map(Number)];
        var giocatoriCasa = titolari.slice(0, 11).map(estraiInfoGiocatore);

        var homeData = {
          name: nomiSquadre[0],
          moduloRaw: modCasaRaw,
          moduloArray: modCasaArr,
          giocatori: giocatoriCasa,
          panchina: estraiSezione(righe, 'Riserve', true),
          indisponibili: estraiSezione(righe, 'Indisponibili', true),
          squalificati: estraiSezione(righe, 'Squalificati', true),
          dubbio: estraiSezione(righe, 'In dubbio', true),
          allenatore: estraiSezione(righe, 'Allenatore', true)
        };

        // Dati squadra Trasferta (indice 1)
        var modTrasfRaw = moduli[1] || '4-3-3';
        var modTrasfArr = [1, ...modTrasfRaw.split('-').map(Number)];
        var giocatoriTrasf = titolari.slice(11, 22).map(estraiInfoGiocatore);

        var awayData = {
          name: nomiSquadre[1],
          moduloRaw: modTrasfRaw,
          moduloArray: modTrasfArr,
          giocatori: giocatoriTrasf,
          panchina: estraiSezione(righe, 'Riserve', false),
          indisponibili: estraiSezione(righe, 'Indisponibili', false),
          squalificati: estraiSezione(righe, 'Squalificati', false),
          dubbio: estraiSezione(righe, 'In dubbio', false),
          allenatore: estraiSezione(righe, 'Allenatore', false)
        };

        parsedMatches.push({
          homeTeam: nomiSquadre[0],
          awayTeam: nomiSquadre[1],
          dateStr: dataStr,
          timeStr: oraStr,
          home: homeData,
          away: awayData
        });
      });

      SkyProbState.matches = parsedMatches;
      SkyProbState.lastFetched = Date.now();
      SkyProbState.teams = OttieniSquadreSerieA();

      // Seleziona la prima squadra disponibile o mantiene la corrente
      if (!SkyProbState.selectedTeam && SkyProbState.teams.length > 0) {
        SkyProbState.selectedTeam = SkyProbState.teams[0];
      }

      return parsedMatches;
    } catch (err) {
      console.error('[fcmProbabiliSky] Errore caricamento:', err);
      SkyProbState.error = err.message || 'Errore di connessione a Sky Sport';
      throw err;
    } finally {
      SkyProbState.isLoading = false;
    }
  }

  /**
   * Estrae i dati del singolo giocatore dal nodo DOM di Sky
   */
  function estraiInfoGiocatore(el, idx) {
    if (!el) return null;
    var numEl = el.querySelector('.ftbl__match-formation-player--jerseyNum');
    var aEl = el.querySelector('a');
    var numero = numEl ? numEl.textContent.trim() : '';
    var link = aEl ? aEl.getAttribute('href') : '';
    var nome = aEl ? aEl.textContent.trim() : (el.textContent.trim() || 'Giocatore');
    var isPortiere = (idx === 0);

    return {
      numero: numero,
      nome: nome,
      link: link,
      isPortiere: isPortiere,
      ruolo: isPortiere ? 'Goalkeeper' : 'Player'
    };
  }

  /**
   * Cerca la partita corrispondente a una squadra (matching intelligente)
   */
  function TrovaPartitaPerSquadra(teamName) {
    if (!teamName || !SkyProbState.matches) return null;
    var tNorm = normalizza(teamName);

    // 1. Corrispondenza esatta normalizzata
    var match = SkyProbState.matches.find(function (m) {
      return normalizza(m.homeTeam) === tNorm || normalizza(m.awayTeam) === tNorm;
    });
    if (match) {
      var isHomeExact = (normalizza(match.homeTeam) === tNorm);
      return {
        match: match,
        isHome: isHomeExact,
        teamData: isHomeExact ? match.home : match.away
      };
    }

    // 2. Corrispondenza fuzzy / sottostringa (es. "Verona" con "Hellas Verona")
    match = SkyProbState.matches.find(function (m) {
      var hNorm = normalizza(m.homeTeam);
      var aNorm = normalizza(m.awayTeam);
      return hNorm.includes(tNorm) || tNorm.includes(hNorm) || aNorm.includes(tNorm) || tNorm.includes(aNorm);
    });
    if (match) {
      var isH = normalizza(match.homeTeam).includes(tNorm) || tNorm.includes(normalizza(match.homeTeam));
      return {
        match: match,
        isHome: isH,
        teamData: isH ? match.home : match.away
      };
    }

    return null;
  }

  /**
   * Genera il Campetto SVG Tattico con i titolari
   */
  function GeneraCampettoHTML(moduloArray, giocatori, squadra) {
    var is4Lines = (moduloArray.length === 5);
    var pitchClass = is4Lines ? 'pitch-lines-4' : 'pitch-lines-3';
    var slug = ottieniSlugSquadra(squadra);

    var pitchHtml = '<div class="campo-pitch ' + pitchClass + '">';

    // Segnature campo di calcio SVG vettoriale
    pitchHtml += `
      <svg class="pitch-markings" viewBox="0 0 300 420" preserveAspectRatio="none">
        <rect x="8" y="8" width="284" height="404" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <line x1="8" y1="210" x2="292" y2="210" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <circle cx="150" cy="210" r="42" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <circle cx="150" cy="210" r="3" fill="rgba(255,255,255,0.55)"/>
        <!-- Area rigore superiore (Portiere) -->
        <rect x="70" y="8" width="160" height="65" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <rect x="105" y="8" width="90" height="26" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <circle cx="150" cy="52" r="2.5" fill="rgba(255,255,255,0.55)"/>
        <path d="M 122 73 A 40 40 0 0 0 178 73" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <!-- Area rigore inferiore (Attacco) -->
        <rect x="70" y="347" width="160" height="65" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <rect x="105" y="386" width="90" height="26" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <circle cx="150" cy="368" r="2.5" fill="rgba(255,255,255,0.55)"/>
        <path d="M 122 347 A 40 40 0 0 1 178 347" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <!-- Lunette corner -->
        <path d="M 8 20 A 12 12 0 0 0 20 8" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 280 8 A 12 12 0 0 0 292 20" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 8 400 A 12 12 0 0 1 20 412" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 280 412 A 12 12 0 0 1 292 400" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      </svg>
    `;

    var playerIdx = 0;
    for (var rep = 0; rep < moduloArray.length; rep++) {
      var count = moduloArray[rep];
      var rowClass = count === 1 ? 'pitch-row-single' : (count === 2 ? 'pitch-row-duo' : 'pitch-row-wide');

      pitchHtml += '<div class="pitch-row pitch-row-' + rep + ' ' + rowClass + '">';
      // Il modulo arriva dalla pagina di Sky: il ciclo si ferma comunque quando i giocatori sono finiti
      for (var pos = 0; pos < count && playerIdx < giocatori.length; pos++) {
        var g = giocatori[playerIdx++];
        if (!g) continue;

        var portiere = (rep === 0 && pos === 0);
        var ruolo = portiere ? 'Goalkeeper' : 'Player';

        pitchHtml += `
          <div class="pitch-player" data-link="${escapeHtml(g.link)}" data-name="${escapeHtml(g.nome)}" data-role="${ruolo}" data-goalkeeper="${portiere}">
            <div class="pitch-player-avatar ${portiere ? 'avatar-gk' : ''}">
              <img src="img/sq/${escapeHtml(slug)}.png" class="pitch-jersey" onerror="this.style.display='none'">
              <span class="pitch-player-num">${escapeHtml(g.numero)}</span>
            </div>
            <div class="pitch-player-name" title="${escapeHtml(g.nome)}">${escapeHtml(g.nome)}</div>
          </div>
        `;
      }
      pitchHtml += '</div>';
    }

    pitchHtml += '</div>';
    return pitchHtml;
  }

  /**
   * Mostra lo stato di caricamento nel container
   */
  function RenderStatoCaricamento() {
    var container = document.getElementById('probSkyContainer');
    if (!container) return;
    container.innerHTML = (typeof fcmSkeleton !== 'undefined')
      ? fcmSkeleton.formation()
      : `
      <div class="prob-loading-state">
        <div class="prob-spinner"></div>
        <div class="prob-loading-text">Caricamento probabili formazioni da Sky Sport in corso...</div>
      </div>
    `;
  }

  /**
   * Renderizza l'intera vista nativa Probabili Sky
   */
  function RenderProbabiliSkyView() {
    var container = document.getElementById('probSkyContainer');
    if (!container) return;

    if (SkyProbState.error) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">⚠️</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            Impossibile caricare le probabili formazioni Sky Sport
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">
            ${escapeHtml(SkyProbState.error)}
          </div>
          <button type="button" class="standalone-btn" onclick="window.AggiornaProbabiliSky(true)">
            🔄 Riprova Caricamento
          </button>
        </div>
      `;
      return;
    }

    // Costruisce la barra dinamica delle squadre
    var teams = SkyProbState.teams;
    if (!teams || teams.length === 0) {
      teams = OttieniSquadreSerieA();
      SkyProbState.teams = teams;
    }

    var selected = SkyProbState.selectedTeam || (teams.length > 0 ? teams[0] : '');

    var buttonsHtml = '<div class="sqbutton"><ul id="probTeamButtonsList">';
    teams.forEach(function (team) {
      var slug = ottieniSlugSquadra(team);
      var isActive = (normalizza(team) === normalizza(selected));
      var initialFallback = team.substring(0, 3).toUpperCase();

      buttonsHtml += `
        <li>
          <a href="javascript:void(0)" 
             class="${isActive ? 'active' : ''}" 
             data-team="${escapeHtml(team)}" 
             title="${escapeHtml(team)}">
            <img src="img/sq/logo/${escapeHtml(slug)}.png"
                 alt="${escapeHtml(team)}" 
                 onerror="this.onerror=null; this.src='img/sq/0.gif';">
          </a>
        </li>
      `;
    });
    buttonsHtml += '</ul></div>';

    // Recupera la formazione della squadra selezionata
    var matchInfo = TrovaPartitaPerSquadra(selected);
    var contentHtml = '';

    if (!matchInfo) {
      contentHtml = `
        <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 10px;">📋</div>
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
            ${escapeHtml(selected)}
          </div>
          <p style="font-size: 0.88rem; margin: 0;">
            Formazione non ancora disponibile su Sky Sport per la prossima giornata di campionato.
          </p>
        </div>
      `;
    } else {
      var m = matchInfo.match;
      var td = matchInfo.teamData;
      var campettoHtml = GeneraCampettoHTML(td.moduloArray, td.giocatori, selected);

      contentHtml = `
        <div class="info-form">
          <!-- Colonna Sinistra: Match & Campetto -->
          <div class="col">
            <div class="prossima-giornata">
              ${escapeHtml(SkyProbState.matchdayInfo || 'Serie A')}${m.dateStr ? ' • ' + escapeHtml(m.dateStr) : ''}${m.timeStr ? ' • ' + escapeHtml(m.timeStr) : ''}
            </div>
            <div class="prossima-partita">
              <span class="${matchInfo.isHome ? 'match-team-highlight' : ''}">${escapeHtml(m.homeTeam)}</span>
              <span style="color: var(--text-muted); font-weight: 400; margin: 0 6px;">-</span>
              <span class="${!matchInfo.isHome ? 'match-team-highlight' : ''}">${escapeHtml(m.awayTeam)}</span>
            </div>
            <div class="campo">
              <div class="campo-header">
                <div class="modulo">${escapeHtml(td.moduloRaw || '4-3-3')}</div>
              </div>
              ${campettoHtml}
              <div class="allenatore">
                <strong>Allenatore:</strong> ${escapeHtml(td.allenatore || 'Non specificato')}
              </div>
            </div>
          </div>

          <!-- Colonna Destra: Panchina, Indisponibili, Squalificati, Dubbi -->
          <div class="col">
            <div class="text-titolo text-titolo-panchina">
              <span>🪑</span><span>Panchina:</span>
            </div>
            <div class="text-nocampo">${escapeHtml(td.panchina || '-')}</div>

            <div class="text-titolo text-titolo-indisponibili">
              <span>🚑</span><span>Indisponibili:</span>
            </div>
            <div class="text-nocampo">${escapeHtml(td.indisponibili || '-')}</div>

            <div class="text-titolo text-titolo-squalificati">
              <span>🟥</span><span>Squalificati:</span>
            </div>
            <div class="text-nocampo">${escapeHtml(td.squalificati || '-')}</div>

            <div class="text-titolo text-titolo-dubbio">
              <span>⚠️</span><span>In dubbio:</span>
            </div>
            <div class="text-nocampo">${escapeHtml(td.dubbio || '-')}</div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="formazioni">
        ${buttonsHtml}
        <div id="probSkyMainArea">
          ${contentHtml}
        </div>
      </div>
    `;

    // Il nome della squadra viene letto dall'attributo data-team: nessun valore esterno dentro codice JS inline
    container.querySelectorAll('#probTeamButtonsList a[data-team]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        MostraSquadraProbabili(btn.getAttribute('data-team'));
      });
    });

    // Attacca o aggiorna gli event listener per il tooltip statistiche
    AttaccaListenersTooltip();
  }

  /**
   * Seleziona e visualizza istantaneamente una squadra diversa dalla barra
   */
  function MostraSquadraProbabili(squadra) {
    if (!squadra) return;
    SkyProbState.selectedTeam = squadra;

    // Aggiorna classe active nei bottoni senza re-renderizzare l'intera lista
    var btns = document.querySelectorAll('#probTeamButtonsList li a');
    btns.forEach(function (btn) {
      var t = btn.getAttribute('data-team');
      if (t && normalizza(t) === normalizza(squadra)) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove('active');
      }
    });

    var mainArea = document.getElementById('probSkyMainArea');
    if (!mainArea) {
      RenderProbabiliSkyView();
      return;
    }

    var matchInfo = TrovaPartitaPerSquadra(squadra);
    if (!matchInfo) {
      mainArea.innerHTML = `
        <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 10px;">📋</div>
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
            ${escapeHtml(squadra)}
          </div>
          <p style="font-size: 0.88rem; margin: 0;">
            Formazione non ancora disponibile su Sky Sport per la prossima giornata di campionato.
          </p>
        </div>
      `;
      return;
    }

    var m = matchInfo.match;
    var td = matchInfo.teamData;
    var campettoHtml = GeneraCampettoHTML(td.moduloArray, td.giocatori, squadra);

    mainArea.innerHTML = `
      <div class="info-form">
        <div class="col">
          <div class="prossima-giornata">
            ${escapeHtml(SkyProbState.matchdayInfo || 'Serie A')}${m.dateStr ? ' • ' + escapeHtml(m.dateStr) : ''}${m.timeStr ? ' • ' + escapeHtml(m.timeStr) : ''}
          </div>
          <div class="prossima-partita">
            <span class="${matchInfo.isHome ? 'match-team-highlight' : ''}">${escapeHtml(m.homeTeam)}</span>
            <span style="color: var(--text-muted); font-weight: 400; margin: 0 6px;">-</span>
            <span class="${!matchInfo.isHome ? 'match-team-highlight' : ''}">${escapeHtml(m.awayTeam)}</span>
          </div>
          <div class="campo">
            <div class="campo-header">
              <div class="modulo">${escapeHtml(td.moduloRaw || '4-3-3')}</div>
            </div>
            ${campettoHtml}
            <div class="allenatore">
              <strong>Allenatore:</strong> ${escapeHtml(td.allenatore || 'Non specificato')}
            </div>
          </div>
        </div>
        <div class="col">
          <div class="text-titolo text-titolo-panchina">
            <span>🪑</span><span>Panchina:</span>
          </div>
          <div class="text-nocampo">${escapeHtml(td.panchina || '-')}</div>

          <div class="text-titolo text-titolo-indisponibili">
            <span>🚑</span><span>Indisponibili:</span>
          </div>
          <div class="text-nocampo">${escapeHtml(td.indisponibili || '-')}</div>

          <div class="text-titolo text-titolo-squalificati">
            <span>🟥</span><span>Squalificati:</span>
          </div>
          <div class="text-nocampo">${escapeHtml(td.squalificati || '-')}</div>

          <div class="text-titolo text-titolo-dubbio">
            <span>⚠️</span><span>In dubbio:</span>
          </div>
          <div class="text-nocampo">${escapeHtml(td.dubbio || '-')}</div>
        </div>
      </div>
    `;

    AttaccaListenersTooltip();
  }

  /**
   * ==========================================================================
   * TOOLTIP STATISTICHE GIOCATORE SKY (MODERNO VANILLA JS & ZERO JQUERY)
   * ==========================================================================
   */
  var tooltipEl = null;
  var tooltipHideTimeout = null;
  var currentTargetPlayer = null;

  function getOrCreateTooltip() {
    var tt = document.getElementById('probSkyTooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'probSkyTooltip';
      tt.className = 'prob-sky-tooltip';
      tt.setAttribute('role', 'tooltip');
      tt.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tt);
    }
    tooltipEl = tt;
    return tt;
  }

  function PosizionaTooltip(e, targetEl) {
    if (!tooltipEl) return;
    var tt = tooltipEl;
    var ttWidth = tt.offsetWidth || 290;
    var ttHeight = tt.offsetHeight || 220;

    var clientX, clientY;
    if (e && e.clientX !== undefined) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (targetEl) {
      var rect = targetEl.getBoundingClientRect();
      clientX = rect.left + rect.width / 2;
      clientY = rect.bottom;
    } else {
      return;
    }

    var winW = window.innerWidth || document.documentElement.clientWidth;
    var winH = window.innerHeight || document.documentElement.clientHeight;

    // Posizionamento orizzontale
    var left = clientX + 14;
    if (left + ttWidth > winW - 12) {
      left = clientX - ttWidth - 14;
    }
    if (left < 10) left = 10;

    // Posizionamento verticale
    var top = clientY + 14;
    if (top + ttHeight > winH - 12 && clientY - ttHeight - 14 > 10) {
      top = clientY - ttHeight - 14;
    }
    if (top < 10) top = 10;

    tt.style.left = Math.round(left) + 'px';
    tt.style.top = Math.round(top) + 'px';
  }

  async function MostraTooltipStatistiche(targetEl, e) {
    clearTimeout(tooltipHideTimeout);
    currentTargetPlayer = targetEl;

    var link = targetEl.getAttribute('data-link') || '';
    var name = targetEl.getAttribute('data-name') || '';
    var isGk = targetEl.getAttribute('data-goalkeeper') === 'true';
    var cacheKey = link + '|' + (isGk ? 'gk' : 'player');

    var tt = getOrCreateTooltip();
    tt.innerHTML = '<div style="text-align:center; padding:12px; font-weight:600; color:var(--text-secondary);">⏳ Caricamento statistiche...</div>';
    tt.style.display = 'block';
    PosizionaTooltip(e, targetEl);
    requestAnimationFrame(function () {
      tt.classList.add('show');
      tt.setAttribute('aria-hidden', 'false');
    });

    if (SkyProbState.statCache[cacheKey]) {
      tt.innerHTML = SkyProbState.statCache[cacheKey];
      PosizionaTooltip(e, targetEl);
      return;
    }

    try {
      if (!link) throw new Error('Link non disponibile');
      var res = await fetch(link);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var html = await res.text();
      var pDoc = new DOMParser().parseFromString(html, 'text/html');
      var widget = pDoc.querySelector('ld-football-pp-player-statistics');
      if (!widget) throw new Error('Widget non trovato');

      var photo = pDoc.querySelector('.ftbl__player-page-hero__photo')?.getAttribute('src') || '';
      var statCards = [...widget.querySelectorAll('.ftbl__statistic-card__wrapper')];
      var stats = statCards.map(function (card) {
        var t = card.querySelector('.ftbl__statistic-card__title')?.textContent.trim();
        var v = card.querySelector('.ftbl__statistic-card__value')?.textContent.trim();
        return (t && v) ? { titolo: t, valore: v } : null;
      }).filter(Boolean);

      var labels = {
        GamesPlayed: ['Partite'],
        TimePlayed: ['Minuti giocati', 'Minuti'],
        SavesMade: ['Parate'],
        Cleansheets: ['Clean Sheets'],
        GoalsConceded: ['Gol subiti'],
        PenaltiesSaved: ['Rigori Parati'],
        Goals: ['Gol'],
        PenaltyGoals: ['Gol su rigore', 'Gol su rigori'],
        Assists: ['Assist'],
        TotalShots: ['Tiri totali'],
        YellowCards: ['Ammonizioni'],
        TotalRedCards: ['Espulsioni']
      };

      var getVal = function (id) {
        var it = stats.find(function (s) {
          return labels[id] && labels[id].includes(s.titolo);
        });
        // Testo preso dalla pagina di Sky: va escapato prima di entrare nell'HTML del tooltip
        return it ? escapeHtml(it.valore) : '0';
      };

      var content = `
        <div class="prob-tt-header">${escapeHtml(name)}</div>
        <hr class="prob-tt-divider">
        <div class="prob-tt-body">
          ${photo ? `<img src="${escapeHtml(photo)}" class="prob-tt-photo" alt="${escapeHtml(name)}">` : ''}
          <table class="prob-tt-table">
      `;

      if (isGk) {
        content += `
          <tr><td class="label">🎽 Partite</td><td>${getVal('GamesPlayed')}</td></tr>
          <tr><td class="label">🕒 Minuti</td><td>${getVal('TimePlayed')}</td></tr>
          <tr><td class="label">🛡️ Rigori Parati</td><td>${getVal('PenaltiesSaved')}</td></tr>
          <tr><td class="label">🧼 Clean Sheets</td><td>${getVal('Cleansheets')}</td></tr>
          <tr><td class="label">🚫 Gol Subiti</td><td>${getVal('GoalsConceded')}</td></tr>
          <tr><td class="label">🟨 Ammonizioni</td><td>${getVal('YellowCards')}</td></tr>
          <tr><td class="label">🟥 Espulsioni</td><td>${getVal('TotalRedCards')}</td></tr>
        `;
      } else {
        content += `
          <tr><td class="label">🎽 Partite</td><td>${getVal('GamesPlayed')}</td></tr>
          <tr><td class="label">🕒 Minuti</td><td>${getVal('TimePlayed')}</td></tr>
          <tr><td class="label">⚽ Gol</td><td>${getVal('Goals')}</td></tr>
          <tr><td class="label">🥅 Gol su rigore</td><td>${getVal('PenaltyGoals')}</td></tr>
          <tr><td class="label">🎯 Assist</td><td>${getVal('Assists')}</td></tr>
          <tr><td class="label">🔥 Tiri totali</td><td>${getVal('TotalShots')}</td></tr>
          <tr><td class="label">🟨 Ammonizioni</td><td>${getVal('YellowCards')}</td></tr>
          <tr><td class="label">🟥 Espulsioni</td><td>${getVal('TotalRedCards')}</td></tr>
        `;
      }

      content += '</table></div>';

      SkyProbState.statCache[cacheKey] = content;
      tt.innerHTML = content;
      PosizionaTooltip(e, targetEl);
    } catch (err) {
      tt.innerHTML = '<div style="padding:10px 14px; color:var(--text-muted); text-align:center; font-size:12px;">Statistiche dettagliate non disponibili</div>';
      PosizionaTooltip(e, targetEl);
    }
  }

  function NascondiTooltip() {
    clearTimeout(tooltipHideTimeout);
    tooltipHideTimeout = setTimeout(function () {
      if (tooltipEl) {
        tooltipEl.classList.remove('show');
        tooltipEl.setAttribute('aria-hidden', 'true');
        setTimeout(function () {
          if (tooltipEl && !tooltipEl.classList.contains('show')) {
            tooltipEl.style.display = 'none';
          }
        }, 150);
      }
      currentTargetPlayer = null;
    }, 100);
  }

  var listenersAttached = false;
  function AttaccaListenersTooltip() {
    if (listenersAttached) return;
    var container = document.getElementById('probSkyContainer');
    if (!container) return;
    listenersAttached = true;

    container.addEventListener('mouseover', function (e) {
      var player = e.target.closest('.pitch-player');
      if (player && player !== currentTargetPlayer) {
        MostraTooltipStatistiche(player, e);
      }
    });

    container.addEventListener('mousemove', function (e) {
      var player = e.target.closest('.pitch-player');
      if (player && tooltipEl && tooltipEl.classList.contains('show')) {
        PosizionaTooltip(e, player);
      }
    });

    container.addEventListener('mouseout', function (e) {
      var player = e.target.closest('.pitch-player');
      if (player && (!e.relatedTarget || !player.contains(e.relatedTarget))) {
        NascondiTooltip();
      }
    });

    // Supporto dispositivi touch / mobile
    container.addEventListener('click', function (e) {
      var player = e.target.closest('.pitch-player');
      if (player) {
        e.stopPropagation();
        if (currentTargetPlayer === player && tooltipEl && tooltipEl.classList.contains('show')) {
          NascondiTooltip();
        } else {
          MostraTooltipStatistiche(player, e);
        }
      } else {
        NascondiTooltip();
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.pitch-player') && !e.target.closest('#probSkyTooltip')) {
        NascondiTooltip();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        NascondiTooltip();
      }
    });
  }

  /**
   * Helper utility per escaping HTML (testo e valori di attributo)
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Funzione pubblica di inizializzazione
   */
  async function InizializzaProbabiliSky(force) {
    var container = document.getElementById('probSkyContainer');
    if (!container) return;

    if (!force && SkyProbState.matches.length > 0) {
      RenderProbabiliSkyView();
      return;
    }

    try {
      await CaricaDatiSky(force);
      RenderProbabiliSkyView();
    } catch (e) {
      RenderProbabiliSkyView();
    }
  }

  // Esportazione funzioni globali
  window.InizializzaProbabiliSky = InizializzaProbabiliSky;
  window.AggiornaProbabiliSky = function (force) {
    InizializzaProbabiliSky(force !== false);
  };
  window.MostraSquadraProbabili = MostraSquadraProbabili;
  window.getprobform = MostraSquadraProbabili; // Compatibilità legacy

})();
