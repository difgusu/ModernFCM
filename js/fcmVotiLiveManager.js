/**
 * ModernFCM - Voti Live Manager
 * Gestione asincrona con Progress Bar, Timeout configurabile (30/60s) e Fallback
 * per Diretta Live Fantapazz, Voti Ufficiosi PianetaFanta e Calcolo Manuale.
 */
var FcmVotiLiveManager = (function () {
    var config = {
        source: 'fantapazz', // 'fantapazz' | 'pianetafanta'
        endpoint: 'inc/live_extractFP.php',
        sourceName: 'Fantapazz.com',
        sourceTypeDesc: 'Voti Live',
        giornata: '',
        containerId: 'liveProgressContainer',
        outputId: 'outputContainer',
        themeClass: '',
        defaultTimeout: 45, // secondi predefiniti
        autoStart: null, // null = auto basato su fresh, true/false forzato
        onSuccess: null  // callback opzionale function(data) per rendering in-page (es. calcolo.php)
    };

    var state = {
        timeoutSec: 45,
        elapsedSec: 0,
        timerInterval: null,
        progressInterval: null,
        currentProgress: 0,
        abortController: null,
        silentRefreshTimer: null,
        lastFetchTime: Date.now(),
        visibilityListenerAttached: false,
        visibilityHandler: null,
        focusHandler: null,
        isStopped: false,
        isExtracting: false
    };

    function checkAndShowGiornataLiveNotice(giornataLive) {
        if (!giornataLive || !config.giornata) return;
        var noticeContainer = document.getElementById('fpDayNoticeContainer');
        if (!noticeContainer) {
            var outputContainer = document.getElementById(config.outputId);
            if (outputContainer && outputContainer.parentNode) {
                noticeContainer = document.createElement('div');
                noticeContainer.id = 'fpDayNoticeContainer';
                outputContainer.parentNode.insertBefore(noticeContainer, outputContainer);
            }
        }
        if (!noticeContainer) return;

        if (parseInt(giornataLive, 10) !== parseInt(config.giornata, 10)) {
            var compParam = '';
            try {
                var search = window.location.hash.includes('?') ? window.location.hash.substring(window.location.hash.indexOf('?')) : window.location.search;
                var params = new URLSearchParams(search);
                if (params.get('Comp')) compParam += '&Comp=' + encodeURIComponent(params.get('Comp'));
                if (params.get('Div')) compParam += '&Div=' + encodeURIComponent(params.get('Div'));
            } catch (e) { }

            var routePrefix = (config.source === 'fantamaster') ? '#liveFM' : '#liveFP';
            var targetUrl = routePrefix + '?Gio=' + encodeURIComponent(giornataLive) + compParam;

            noticeContainer.innerHTML =
                '<div id="fpDayNotice" class="vu-cache-notice" style="margin-bottom: 16px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #d97706; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">' +
                '<span>&#9888;&#65039; <strong>Nota sul Live:</strong> Stai visualizzando la <strong>' + config.giornata + '&ordf; giornata</strong>, ma il Live ' + config.sourceName + ' &egrave; attualmente attivo per la <strong>' + giornataLive + '&ordf; giornata</strong> di Serie A.</span>' +
                '<a href="' + targetUrl + '" class="btn-force-inline" style="background:#d97706; color:#ffffff; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.85rem;">Passa alla ' + giornataLive + '&ordf; giornata Live &rarr;</a>' +
                '</div>';
        } else {
            noticeContainer.innerHTML = '';
        }
    }
    // Alias retrocompatibilità
    var checkAndShowGiornataFpNotice = checkAndShowGiornataLiveNotice;

    function setupLiveAutoRefresh(hasMatchLive) {
        if (config.source !== 'fantapazz' && config.source !== 'fantamaster') return;

        var liveKey = 'pn_has_match_live_' + config.source;
        if (!hasMatchLive) {
            sessionStorage.setItem(liveKey, '0');
            if (state.silentRefreshTimer) {
                clearInterval(state.silentRefreshTimer);
                state.silentRefreshTimer = null;
            }
            return;
        }

        sessionStorage.setItem(liveKey, '1');

        if (state.silentRefreshTimer) {
            clearInterval(state.silentRefreshTimer);
        }

        // Auto-refresh periodico silenzioso a 60 secondi (nessun badge o countdown visivo)
        state.silentRefreshTimer = setInterval(function () {
            triggerSilentRefresh();
        }, 60000);

        // Page Visibility API e rientro da background / cambio scheda
        if (!state.visibilityListenerAttached) {
            state.visibilityListenerAttached = true;

            function handleVisibilityOrFocus() {
                if (state.isStopped) return;
                var isLiveActive = sessionStorage.getItem(liveKey) === '1';
                if (!isLiveActive) return;
                var curHash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash.toLowerCase() : '';
                if (curHash.indexOf('#live') === -1) return;
                var now = Date.now();
                if (now - state.lastFetchTime >= 60000) {
                    triggerSilentRefresh();
                }
            }

            state.visibilityHandler = function () {
                if (document.visibilityState === 'visible') {
                    handleVisibilityOrFocus();
                }
            };
            state.focusHandler = function () {
                handleVisibilityOrFocus();
            };

            document.addEventListener('visibilitychange', state.visibilityHandler);
            window.addEventListener('focus', state.focusHandler);
        }
    }

    function triggerSilentRefresh() {
        if (state.isStopped || state.isExtracting) return;
        var curHash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash.toLowerCase() : '';
        if (curHash.indexOf('#live') === -1) return;

        state.isExtracting = true;
        state.lastFetchTime = Date.now();

        var fetchUrl = config.endpoint + '?ajax=1';
        if (config.giornata) {
            fetchUrl += '&Gio=' + encodeURIComponent(config.giornata);
        }
        fetchUrl += '&force=1&t=' + Date.now();

        fetch(fetchUrl, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                state.isExtracting = false;
                if (data && data.success) {
                    var isLive = data.hasMatchLive === true;
                    setupLiveAutoRefresh(isLive);

                    var gLive = data.giornataFM || data.giornataFP;
                    if (gLive) {
                        sessionStorage.setItem('pn_giornata_' + config.source, gLive);
                        checkAndShowGiornataLiveNotice(gLive);
                    }

                    if (typeof config.onSuccess === 'function') {
                        reloadScriptVoti(function () {
                            try { config.onSuccess(data); } catch (e) { }
                        });
                    } else {
                        // Ricarica pulita senza mostrare la barra di progresso
                        try {
                            sessionStorage.setItem('pn_just_extracted_' + config.source, JSON.stringify({
                                time: Date.now(),
                                count: data.count || 0,
                                timeStr: data.lastUpdated || data.updated || '',
                                source: config.source,
                                message: data.message
                            }));
                        } catch (e) { }
                        var cleanUrl = new URL(window.location.href);
                        cleanUrl.searchParams.delete('fresh');
                        cleanUrl.searchParams.delete('ajax');
                        cleanUrl.searchParams.delete('force');
                        window.location.replace(cleanUrl.toString());
                    }
                }
            })
            .catch(function (err) {
                state.isExtracting = false;
                console.warn('[FcmVotiLiveManager] Silent refresh non riuscito:', err);
            });
    }

    function reloadScriptVoti(callback) {
        var oldScript = document.getElementById('scriptFcmVotiDatiLive');
        if (oldScript && oldScript.parentNode) {
            oldScript.parentNode.removeChild(oldScript);
        }
        var s = document.createElement('script');
        s.id = 'scriptFcmVotiDatiLive';
        var targetFile = 'js/fcmVotiDatiVU.js';
        if (config.source === 'fantamaster') {
            targetFile = 'js/fcmVotiDatiFM.js';
        } else if (config.source === 'fantapazz') {
            targetFile = 'js/fcmVotiDatiFP.js';
        }
        s.src = targetFile + '?v=' + new Date().getTime();
        s.onload = function () {
            if (typeof callback === 'function') callback();
        };
        s.onerror = function () {
            // Fallback a fcmVotiDati.js generico se il file specifico non è ancora presente
            var fallbackScript = document.createElement('script');
            fallbackScript.id = 'scriptFcmVotiDatiLive';
            fallbackScript.src = 'js/fcmVotiDati.js?v=' + new Date().getTime();
            fallbackScript.onload = function () {
                if (typeof callback === 'function') callback();
            };
            fallbackScript.onerror = function () {
                if (typeof callback === 'function') callback();
            };
            document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(s);
    }

    function handleSuccess(data) {
        state.isExtracting = false;
        state.lastFetchTime = Date.now();
        setImportButtonLoading(false);

        var isCached = (data && data.cached === true);
        var msg = isCached
            ? ((data && data.message) || 'Voti caricati dalla cache locale')
            : ('Voti e bonus/malus scaricati con successo da ' + config.sourceName + '! (' + ((data && data.count) || 0) + ' giocatori)');
        var icon = isCached ? '&#9889;' : '&#9989;';

        updateProgress(100, msg, icon);

        var bar = document.getElementById('liveProgressBar');
        if (bar) {
            bar.classList.add('is-complete');
            if (isCached) {
                bar.style.backgroundColor = '#06b6d4';
            } else {
                bar.style.backgroundColor = '';
            }
        }

        var dot = document.getElementById('liveProgressDot');
        if (dot) {
            dot.style.background = isCached ? '#06b6d4' : '#10b981';
            dot.style.animation = 'none';
        }

        var timeStr = (data && (data.lastUpdated || data.updated)) ? (data.lastUpdated || data.updated) : '';

        // Gestione banner discrepanza giornata Fantapazz
        if (config.source === 'fantapazz') {
            if (data && data.giornataFP) {
                sessionStorage.setItem('pn_giornata_fp', data.giornataFP);
                checkAndShowGiornataFpNotice(data.giornataFP);
            }
            if (data && typeof data.hasMatchLive === 'boolean') {
                setupLiveAutoRefresh(data.hasMatchLive);
            }
        }

        // Aggiorna notifica in calcolo (#vuCacheStatus) se presente (solo avviso cache < 15 min)
        var cacheStatusEl = document.getElementById('vuCacheStatus');
        if (cacheStatusEl && data) {
            if (isCached) {
                cacheStatusEl.innerHTML = '<div class="vu-cache-notice">' +
                    '<span style="display:inline-flex;align-items:center;gap:6px;">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
                    'Voti caricati dalla cache locale (aggiornati alle ' + timeStr + ')</span> ' +
                    '<button type="button" class="btn-force-inline" onclick="if(window.importaVotiUfficiosiCalcolo){window.importaVotiUfficiosiCalcolo(true);}else if(window.FcmVotiLiveManager){window.FcmVotiLiveManager.startExtraction(true, true);}">Forza Aggiornamento</button>' +
                    '</div>';
            } else {
                cacheStatusEl.innerHTML = '';
            }
        }

        // Aggiorna notifica nella vista Live (#liveVU / #liveFP - #vuCacheNoticeContainer) se presente (solo avviso cache < 15 min)
        var vuNoticeContainer = document.getElementById('vuCacheNoticeContainer');
        if (vuNoticeContainer && data) {
            if (isCached) {
                vuNoticeContainer.innerHTML = '<div id="vuCacheNotice" class="vu-cache-notice">' +
                    '<span style="display:inline-flex;align-items:center;gap:6px;">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
                    'Voti caricati dalla cache locale (aggiornati alle ' + timeStr + ')</span> ' +
                    '<button type="button" class="btn-force-inline" onclick="if(window.FcmVotiLiveManager)FcmVotiLiveManager.startExtraction(true, true);">Forza Aggiornamento</button>' +
                    '</div>';
            } else {
                vuNoticeContainer.innerHTML = '';
            }
        }

        // Funzione helper per dissolvere la card di progresso
        function dismissCard(delay) {
            setTimeout(function () {
                var container = document.getElementById(config.containerId);
                if (container) {
                    container.style.transition = 'opacity 0.4s ease';
                    container.style.opacity = '0';
                    setTimeout(function () {
                        container.style.display = 'none';
                        container.style.opacity = '1';
                    }, 400);
                }
            }, delay || 2400);
        }

        // Se è specificata una callback di successo in-page (es. calcolo manuale o vista SPA)
        if (typeof config.onSuccess === 'function') {
            var needReloadScript = !isCached || (typeof arrVoti === 'undefined' || !arrVoti || arrVoti.length === 0);
            if (needReloadScript) {
                reloadScriptVoti(function () {
                    try {
                        config.onSuccess(data);
                    } catch (e) {
                        console.error("Errore callback onSuccess:", e);
                    }
                    dismissCard(isCached ? 1200 : 2500);
                });
            } else {
                try {
                    config.onSuccess(data);
                } catch (e) {
                    console.error("Errore callback onSuccess:", e);
                }
                dismissCard(isCached ? 1200 : 2500);
            }
            return;
        }

        // Per il Live Match Center:
        if (isCached) {
            dismissCard(1200);
            var outputContainer = document.getElementById(config.outputId);
            if (outputContainer) outputContainer.style.display = '';
            return;
        }

        // Altrimenti se scaricati nuovi voti, aggiorna la pagina dopo aver mostrato la barra
        setTimeout(function () {
            try {
                sessionStorage.setItem('pn_just_extracted_' + config.source, JSON.stringify({
                    time: Date.now(),
                    count: data.count || 0,
                    timeStr: timeStr,
                    source: config.source,
                    message: data.message
                }));
            } catch (e) { }
            var cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('fresh');
            cleanUrl.searchParams.delete('ajax');
            cleanUrl.searchParams.delete('force');
            window.location.replace(cleanUrl.toString());
        }, 550);
    }

    function init(userOptions) {
        if (userOptions) {
            for (var key in userOptions) {
                if (userOptions.hasOwnProperty(key)) {
                    config[key] = userOptions[key];
                }
            }
        }

        state.isStopped = false;

        // Recupera eventuale preferenza di timeout salvata in localStorage
        var savedTimeout = parseInt(localStorage.getItem('pn_live_timeout_sec'), 10);
        if (savedTimeout && [30, 45, 60].indexOf(savedTimeout) !== -1) {
            state.timeoutSec = savedTimeout;
        } else if (config.defaultTimeout) {
            state.timeoutSec = config.defaultTimeout;
        }

        // Pulisci subito qualsiasi residuo 'fresh' o 'ajax' da URL e parent hash
        try {
            var curUrl = new URL(window.location.href);
            if (curUrl.searchParams.has('fresh') || curUrl.searchParams.has('ajax')) {
                curUrl.searchParams.delete('fresh');
                curUrl.searchParams.delete('ajax');
                window.history.replaceState(null, '', curUrl.toString());
                if (window.parent && window.parent !== window) {
                    var pHash = (window.parent.location.hash || '').split('?')[0];
                    if (pHash) {
                        var pParams = new URLSearchParams(curUrl.search);
                        var pSearch = pParams.toString();
                        window.parent.history.replaceState(null, '', pHash + (pSearch ? '?' + pSearch : ''));
                    }
                }
            }
        } catch (e) { }

        // Rileva se questo caricamento è l'immediato reload post-estrazione (usato per renderizzare i dati appena salvati)
        state.justExtractedKey = 'pn_just_extracted_' + config.source;
        state.justExtractedData = null;
        try {
            var rawItem = sessionStorage.getItem(state.justExtractedKey);
            if (rawItem) {
                if (rawItem.charAt(0) === '{') {
                    state.justExtractedData = JSON.parse(rawItem);
                } else {
                    state.justExtractedData = { time: parseInt(rawItem, 10) || 0 };
                }
            }
        } catch (e) { }

        state.isPostExtractionReload = false;
        if (state.justExtractedData && state.justExtractedData.time && (Date.now() - state.justExtractedData.time < 15000)) {
            state.isPostExtractionReload = true;
            try {
                sessionStorage.removeItem(state.justExtractedKey);
            } catch (e) { }
        }

        // Rileva se l'utente ha premuto Ricarica / F5 dal browser (o da pulsante ricarica iframe)
        var navEntries = (window.performance && typeof window.performance.getEntriesByType === 'function')
            ? window.performance.getEntriesByType('navigation') : null;
        var isBrowserReload = (navEntries && navEntries[0] && navEntries[0].type === 'reload') ||
            (window.performance && window.performance.navigation && window.performance.navigation.type === 1);

        // Se l'utente ha fatto refresh da browser o ricarica esplicita, forziamo sempre l'aggiornamento
        if (isBrowserReload) {
            state.isPostExtractionReload = false;
            state.justExtractedData = null;
        }

        var shouldAuto;
        if (typeof config.autoStart === 'boolean') {
            shouldAuto = config.autoStart;
        } else {
            shouldAuto = !state.isPostExtractionReload;
        }

        if (shouldAuto) {
            // Avvia immediatamente l'estrazione asincrona con barra di progresso
            startExtraction(false, !!config.force);
        } else {
            // I voti sono già presenti o l'estrazione è on-demand: mostra view caricata
            setupLoadedView();
        }

        // Collega l'eventuale pulsante di aggiornamento manuale nella toolbar
        var btnRefresh = document.getElementById('btnRefreshLive');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', function (e) {
                e.preventDefault();
                startExtraction(true, true);
            });
        }
    }

    function renderProgressBarCard(isManualRefresh) {
        var container = document.getElementById(config.containerId);
        if (!container) return;

        var titlePrefix = isManualRefresh ? 'Aggiornamento Voti in Corso' : 'Caricamento Voti in Corso';
        var themeClass = config.themeClass || (config.source === 'pianetafanta' ? 'theme-ufficiosi' : '');

        container.innerHTML =
            '<div class="live-progress-card" id="liveProgressCard">' +
            '<div class="live-progress-header">' +
            '<div class="live-progress-title-wrap">' +
            '<span class="live-pulse-dot" id="liveProgressDot"></span>' +
            '<h3 class="live-progress-title" id="liveProgressTitle">' +
            '<span>' + (config.source === 'fantapazz' ? '&#9889;' : '&#128203;') + '</span> ' +
            titlePrefix + ' &bull; ' + config.sourceTypeDesc +
            '</h3>' +
            '</div>' +
            '<span class="live-progress-badge">Fonte: ' + config.sourceName + '</span>' +
            '</div>' +
            '<div class="live-progress-track">' +
            '<div class="live-progress-bar ' + themeClass + '" id="liveProgressBar" style="width: 5%;"></div>' +
            '</div>' +
            '<div class="live-progress-meta">' +
            '<div class="live-progress-status" id="liveProgressStatus">' +
            '<span>&#128225;</span> Connessione ai server di ' + config.sourceName + '...' +
            '</div>' +
            '<div class="live-progress-timer" id="liveProgressTimer">' +
            '<span id="liveProgressPercent">5%</span> &bull; ' +
            '<span>&#9201; <span id="liveProgressElapsed">0</span>s / max <span id="liveProgressMax">' + state.timeoutSec + '</span>s</span>' +
            '</div>' +
            '</div>' +
            '<div id="liveTimeoutPanelSlot"></div>' +
            '</div>';

        container.style.opacity = '1';
        container.style.display = 'block';

        // Nascondi temporaneamente il contenitore dei tabellini se è un aggiornamento e non c'è callback in-page
        if (!config.onSuccess) {
            var outputContainer = document.getElementById(config.outputId);
            if (outputContainer && !isManualRefresh) {
                outputContainer.style.display = 'none';
            }
        }
    }

    function updateProgress(percent, statusText, statusIcon) {
        state.currentProgress = percent;
        var bar = document.getElementById('liveProgressBar');
        var percentEl = document.getElementById('liveProgressPercent');
        var statusEl = document.getElementById('liveProgressStatus');

        if (bar) bar.style.width = percent + '%';
        if (percentEl) percentEl.textContent = Math.round(percent) + '%';
        if (statusEl && statusText) {
            statusEl.innerHTML = (statusIcon ? '<span>' + statusIcon + '</span> ' : '') + statusText;
        }
    }

    function setImportButtonLoading(isLoading) {
        var btnImport = document.getElementById('btnImportaVU');
        if (btnImport) {
            if (isLoading) {
                btnImport.disabled = true;
                btnImport.style.opacity = '0.7';
                btnImport.style.cursor = 'not-allowed';
                btnImport.innerHTML = '&#9203; Caricamento Voti in Corso...';
            } else {
                btnImport.disabled = false;
                btnImport.style.opacity = '';
                btnImport.style.cursor = '';
                btnImport.innerHTML = '&#128229; Importa Voti Ufficiosi (Pianetafanta.it)';
            }
        }
    }

    function startExtraction(isManualRefresh, force) {
        if (state.isExtracting) return;
        state.isStopped = false;
        state.isExtracting = true;
        state.elapsedSec = 0;
        state.currentProgress = 5;
        setImportButtonLoading(true);

        // Annulla eventuali timer precedenti
        clearInterval(state.timerInterval);
        clearInterval(state.progressInterval);

        renderProgressBarCard(isManualRefresh || force);

        // Timer di incremento secondi ed avanzamento simulato
        state.timerInterval = setInterval(function () {
            state.elapsedSec++;
            var elapsedEl = document.getElementById('liveProgressElapsed');
            if (elapsedEl) elapsedEl.textContent = state.elapsedSec;

            // Se supera il timeout configurato
            if (state.elapsedSec >= state.timeoutSec) {
                handleTimeout();
            }
        }, 1000);

        // Simulazione fluida dei passaggi intermedi della progress bar
        state.progressInterval = setInterval(function () {
            if (state.currentProgress < 85) {
                // Avanzamento asintotico realistico fino all'85%
                var increment = Math.max(0.5, (85 - state.currentProgress) * 0.12);
                var nextVal = Math.min(85, state.currentProgress + increment);
                var msg = "Connessione alla fonte dati...";
                var icon = "&#128225;";

                if (nextVal > 25 && nextVal <= 55) {
                    msg = "Scaricamento dati e voti in corso...";
                    icon = "&#11015;&#65039;";
                } else if (nextVal > 55 && nextVal <= 75) {
                    msg = "Elaborazione formazioni e bonus/malus...";
                    icon = "&#9881;&#65039;";
                } else if (nextVal > 75) {
                    msg = "Finalizzazione tabellino e voti...";
                    icon = "&#128202;";
                }

                updateProgress(nextVal, msg, icon);
            }
        }, 250);

        // Esegui la richiesta di estrazione asincrona
        var fetchUrl = config.endpoint + '?ajax=1';
        if (config.giornata) {
            fetchUrl += '&Gio=' + encodeURIComponent(config.giornata);
        }
        if (force || isManualRefresh) {
            fetchUrl += '&force=1';
        }
        fetchUrl += '&t=' + new Date().getTime();

        if (window.AbortController) {
            state.abortController = new AbortController();
        }

        var fetchOptions = {
            cache: 'no-store'
        };
        if (state.abortController) {
            fetchOptions.signal = state.abortController.signal;
        }

        fetch(fetchUrl, fetchOptions)
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('Risposta HTTP non valida: ' + res.status);
                }
                return res.json();
            })
            .then(function (data) {
                clearInterval(state.timerInterval);
                clearInterval(state.progressInterval);

                if (data && data.success) {
                    handleSuccess(data);
                } else {
                    var errMsg = (data && data.error) ? data.error : "Errore sconosciuto durante l'estrazione dei dati";
                    handleError(errMsg);
                }
            })
            .catch(function (err) {
                clearInterval(state.timerInterval);
                clearInterval(state.progressInterval);

                if (err.name === 'AbortError') {
                    // Gestito già da handleTimeout()
                } else {
                    handleError(err.message || "Errore di connessione con il server");
                }
            });
    }

    function handleTimeout() {
        state.isExtracting = false;
        setImportButtonLoading(false);
        clearInterval(state.timerInterval);
        clearInterval(state.progressInterval);

        if (state.abortController) {
            try { state.abortController.abort(); } catch (e) { }
        }

        var bar = document.getElementById('liveProgressBar');
        if (bar) {
            bar.classList.add('is-error');
        }

        var dot = document.getElementById('liveProgressDot');
        if (dot) {
            dot.className = 'live-pulse-dot dot-warning';
        }

        updateProgress(state.currentProgress, 'Tempo scaduto (Timeout di ' + state.timeoutSec + ' secondi)', '&#9201;');

        showTimeoutPanel(
            'Timeout: La fonte dati non risponde',
            'I server di <strong>' + config.sourceName + '</strong> non hanno risposto entro il tempo limite di ' + state.timeoutSec + ' secondi. La connessione potrebbe essere temporaneamente lenta o la fonte esterna non raggiungibile.'
        );
    }

    function handleError(msg) {
        state.isExtracting = false;
        setImportButtonLoading(false);
        clearInterval(state.timerInterval);
        clearInterval(state.progressInterval);

        var bar = document.getElementById('liveProgressBar');
        if (bar) {
            bar.classList.add('is-error');
        }

        var dot = document.getElementById('liveProgressDot');
        if (dot) {
            dot.className = 'live-pulse-dot dot-error';
        }

        updateProgress(state.currentProgress, 'Errore di caricamento', '&#10060;');

        showTimeoutPanel(
            'Impossibile caricare i dati',
            'Si &egrave; verificato un errore durante la comunicazione con <strong>' + config.sourceName + '</strong>: ' + msg
        );
    }

    function showTimeoutPanel(title, descHtml) {
        var slot = document.getElementById('liveTimeoutPanelSlot');
        if (!slot) return;

        slot.innerHTML =
            '<div class="live-timeout-panel">' +
            '<div class="live-timeout-title">' +
            '<span>&#9201;</span> ' + title +
            '</div>' +
            '<p class="live-timeout-desc">' + descHtml + '</p>' +
            '<div class="live-timeout-actions">' +
            '<button type="button" id="btnLiveRetry" class="btn-live-action primary" style="cursor:pointer;">' +
            '<span>&#128260;</span> <span>Riprova Caricamento</span>' +
            '</button>' +
            '<button type="button" id="btnLiveUseCached" class="btn-live-action" style="cursor:pointer;">' +
            '<span>&#128194;</span> <span>Mostra Ultimi Dati Salvati</span>' +
            '</button>' +
            '<div class="live-timeout-selector">' +
            '<span>Timeout:</span>' +
            '<button type="button" class="live-timeout-pill ' + (state.timeoutSec === 30 ? 'active' : '') + '" data-timeout="30">30s</button>' +
            '<button type="button" class="live-timeout-pill ' + (state.timeoutSec === 45 ? 'active' : '') + '" data-timeout="45">45s</button>' +
            '<button type="button" class="live-timeout-pill ' + (state.timeoutSec === 60 ? 'active' : '') + '" data-timeout="60">60s</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        // Event listener per il pulsante Riprova
        var btnRetry = document.getElementById('btnLiveRetry');
        if (btnRetry) {
            btnRetry.addEventListener('click', function () {
                startExtraction(false);
            });
        }

        // Event listener per "Mostra ultimi dati salvati"
        var btnCached = document.getElementById('btnLiveUseCached');
        if (btnCached) {
            btnCached.addEventListener('click', function () {
                if (typeof config.onSuccess === 'function') {
                    reloadScriptVoti(function () {
                        try {
                            config.onSuccess({ count: (typeof arrVoti !== 'undefined' && arrVoti) ? arrVoti.length : 0 });
                        } catch (e) { }
                        var container = document.getElementById(config.containerId);
                        if (container) container.style.display = 'none';
                    });
                } else {
                    setupLoadedView();
                    var container = document.getElementById(config.containerId);
                    if (container) container.style.display = 'none';
                }
            });
        }

        // Selettore rapido timeout (30s, 45s, 60s)
        var pills = slot.querySelectorAll('.live-timeout-pill');
        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                var sec = parseInt(this.getAttribute('data-timeout'), 10);
                if (sec) {
                    state.timeoutSec = sec;
                    localStorage.setItem('pn_live_timeout_sec', sec);
                    pills.forEach(function (p) { p.classList.remove('active'); });
                    this.classList.add('active');
                    var maxEl = document.getElementById('liveProgressMax');
                    if (maxEl) maxEl.textContent = sec;
                }
            });
        });
    }

    function setupLoadedView() {
        // Mostra il contenitore delle partite
        var outputContainer = document.getElementById(config.outputId);
        if (outputContainer) {
            outputContainer.style.display = '';
        }

        // Pulizia notifica temporanea (la barra di caricamento fornisce già l'esito visivo completo)
        if (state.isPostExtractionReload) {
            var vuNoticeContainer = document.getElementById('vuCacheNoticeContainer');
            if (vuNoticeContainer) vuNoticeContainer.innerHTML = '';
        }

        // Rendi visibile il pulsante di aggiornamento nella barra in alto
        var btnRefresh = document.getElementById('btnRefreshLive');
        if (btnRefresh) {
            btnRefresh.style.display = 'inline-flex';
        }

        // Ripristina banner discrepanza giornata ed eventuale auto-refresh per Fantapazz / FantaMaster
        if (config.source === 'fantapazz' || config.source === 'fantamaster') {
            var gKey = 'pn_giornata_' + config.source;
            var savedGiornata = sessionStorage.getItem(gKey) || (config.source === 'fantapazz' ? sessionStorage.getItem('pn_giornata_fp') : null);
            if (savedGiornata) {
                checkAndShowGiornataLiveNotice(savedGiornata);
            }
            var liveKey = 'pn_has_match_live_' + config.source;
            var savedLive = sessionStorage.getItem(liveKey) || (config.source === 'fantapazz' ? sessionStorage.getItem('pn_has_match_live_fantapazz') : null);
            if (savedLive === '1') {
                setupLiveAutoRefresh(true);
            } else {
                // Controllo asincrono leggero da metadati per rilevare se ci sono partite in corso
                var metaFile = (config.source === 'fantamaster') ? 'js/fcmVotiDatiFMMeta.json' : 'js/fcmVotiDatiFPMeta.json';
                fetch(metaFile + '?v=' + Date.now(), { cache: 'no-store' })
                    .then(function (res) { return res.ok ? res.json() : null; })
                    .then(function (meta) {
                        if (meta) {
                            var gMeta = meta.giornataFM || meta.giornataFP;
                            if (gMeta) {
                                sessionStorage.setItem(gKey, gMeta);
                                checkAndShowGiornataLiveNotice(gMeta);
                            }
                            if (meta.hasMatchLive === true) {
                                setupLiveAutoRefresh(true);
                            }
                        }
                    })
                    .catch(function () { });
            }
        }
    }

    function stopAutoRefresh() {
        state.isStopped = true;
        state.isExtracting = false;
        if (state.silentRefreshTimer) {
            clearInterval(state.silentRefreshTimer);
            state.silentRefreshTimer = null;
        }
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
        if (state.abortController) {
            try { state.abortController.abort(); } catch (e) { }
            state.abortController = null;
        }
        if (state.visibilityListenerAttached) {
            if (state.visibilityHandler) {
                document.removeEventListener('visibilitychange', state.visibilityHandler);
                state.visibilityHandler = null;
            }
            if (state.focusHandler) {
                window.removeEventListener('focus', state.focusHandler);
                state.focusHandler = null;
            }
            state.visibilityListenerAttached = false;
        }
    }

    return {
        init: init,
        startExtraction: startExtraction,
        stopAutoRefresh: stopAutoRefresh,
        destroy: stopAutoRefresh
    };
})();
