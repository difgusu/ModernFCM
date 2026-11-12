# ⚽ ModernFCM

**ModernFCM** è una skin moderna, reattiva e modulare per **Fantacalcio Manager (FCM)** progettata con architettura **Single Page Application (SPA)**, approccio mobile-first e supporto completo alle **Progressive Web App (PWA)**.

Sviluppata per rinnovare l'interfaccia classica dei siti generati da FCM, ModernFCM offre un'esperienza utente ricca e fluida sia su smartphone che su desktop: tema Chiaro/Scuro (Light/Dark mode), invio formazioni con campo grafico interattivo, voti live e calcolo in tempo reale, statistiche avanzate, grafici prestazionali, pannello amministratore integrato, personalizzazione della home page sia lato utente sia lato admin per la creazione di nuovi widget, e piena compatibilità con FCM.

---

## 🌟 Caratteristiche Principali

- 🌓 **Tema Chiaro / Scuro / Sistema**: selettore rapido a 3 stati (Chiaro, Scuro, Sistema) posizionato in testa al drawer laterale con auto-rilevamento della modalità del dispositivo, salvataggio preferenze in `localStorage` e valore predefinito configurabile da ini.
- ⚡ **Architettura SPA Ultra-Rapida**: caricamento istantaneo delle viste senza ricaricamento dell'intera pagina (`#home`, `#classifica`, `#calendario`, `#rose`, `#formazioni`, `#risultati`, `#calcolo`, `#probabili`, `#statistiche`, `#storico`, ecc.).
- 🏟️ **Campo Grafico Formazioni**: visualizzazione grafica con maglie, schieramento a tutto campo, panchina e riserve.
- 🔴 **Diretta Live (Fantacalcio.it, Fantapazz, FantaMaster) & Voti Ufficiosi**:
  - Voti in tempo reale (Fantacalcio.it, Fantapazz e Fantamaster) con gol, bonus, malus ed eventi di giornata.
  - Voti Ufficiosi (PianetaFanta / fonti multiple: Gazzetta, Corriere, Tuttosport, Medie ponderate).
  - Ricalcolo automatico del punteggio delle partite di Lega minuto per minuto.
- 🧮 **Calcolo Risultati Manuale & Live (`#calcolo`)**:
  - Motore di calcolo in-page fedele al 100% al regolamento ufficiale di Fantacalcio Manager.
  - Simulazione e applicazione di: modificatori portiere, difesa, centrocampo, attacco, bonus e malus, fattori campo, intorni e fasce gol personalizzabili.
  - Gestione automatica e manuale di formazioni e sostituzioni regolamentari.
- ⚙️ **Pannello Amministratore & Variabili di Calcolo**:
  - Finestra modale popup integrata nella vista `#calcolo` con pulsante per espansione a tutto schermo sulla pagina standalone `inc/impostazioni.php`.
  - Autenticazione protetta da password amministratore unificata con il modulo formazioni (`inc/admin_config.inc.php`).
  - Modifica visuale in tempo reale di tutte le variabili di calcolo (`js/fcmCalcoloRisultatiVariabili.js`) con backup automatico.
- 🔗 **Gestione Associazioni Calciatori con Matching Univoco (1-a-1)**:
  - Modulo dedicato per allineare i calciatori di Serie A di FCM con i listoni esterni di **PianetaFanta.it**, **Fantacalcio.it**, **Fantapazz** e **FantaMaster** in un unico archivio (`inc/data/liveVU_associazioni.php`).
  - Algoritmo di matching multi-criterio per cognomi composti, nomi davanti (es. *Gonçalo Ramos*, *Pio Esposito*), ruoli e iniziali.
  - Risoluzione assistita dei casi dubbi e possibilità di selezionare direttamente i calciatori non ancora assegnati (organizzati per squadra di Serie A).
  - Garanzia di **univocità stretta (1-a-1)**: nessun calciatore esterno può essere assegnato più volte, con blocco preventivo dei duplicati e risoluzione automatica delle collisioni.
- 🚑 **Probabili Formazioni, Indisponibili & Squalificati (`#probabili`)**:
  - Estrazione automatica e visualizzazione delle probabili formazioni Fantacalcio.it e Sky Sport, percentuali di titolarità, ballottaggi, infortunati e tempi di rientro con cache intelligente (`inc/probform_extract.php` -> `js/ProbFGDati.js`).
- 🗓️ **Sincronizzazione Automatica Calendario e Orari Serie A**:
  - Aggiornamento automatico di date e orari dei match di Serie A (`inc/aggiorna_dataA.php` -> `js/DataA.js`) a partire dai dati locali di FCM (`fcmSerieADati.js`) con fallback remoto automatico.
- 📊 **Statistiche Avanzate & Grafici**: andamento posizioni in classifica, media punti, Top & Flop di giornata e stagionali, schede dettagliate calciatore con quotazioni e andamento voti.
- 🛡️ **Modularità Intelligente**: ogni modulo o pagina avanzata può essere attivato o disattivato a piacere dal file di configurazione `ModernFCM.ini` o via `js/fcmVariabili.js`. Se i file o i dati del plugin non sono presenti, la voce di menu scompare automaticamente senza errori.
- 📂 **Architettura Backend Ordinata (`inc/`)**: tutti i file e gli script di servizio per il calcolo, le estrazioni live, i cron e le associazioni risiedono in modo pulito e sicuro nella cartella `inc/`.
- 📚 **Archivio Storico Multi-Stagione**: navigazione retroattiva delle stagioni precedenti direttamente dal menu, con compatibilità sia per stagioni ModernFCM che per vecchie skin HTML statiche.

---

## 📋 Requisiti di Sistema

### Requisiti Server Web
- **Server Web**: Apache, Nginx o LiteSpeed (compatibile con hosting tradizionali come AlterVista, Aruba, ecc.).
- **PHP**: versione **8.0** o superiore (PHP 8.x con estensioni `cURL`, `JSON` e `mbstring` abilitate per il calcolo, le chiamate live e le probabili formazioni).
- **SSL / HTTPS**: fortemente consigliato (necessario per installazione PWA e notifiche/service worker).

### Requisiti FCM
- **Fantacalcio Manager**: versione **8.50** o successiva.
- Sistema operativo Windows per l'esecuzione di FCM e dei plugin correlati (`.exe` / `.bat`).

---

## 🔌 Plugin e Moduli Richiesti

ModernFCM integra i dati prodotti da FCM e dai plugin `fcm_sqlite_exporter` (incluso in `plugin/`) e `jdPI4FCMv2.exe`.  
Di seguito l'elenco dei plugin collegati ai rispettivi moduli, come configurati in `ModernFCM.ini` (sezione `[variabili]` e `[plugin]`):

| Modulo / Funzionalità | Variabile in `ModernFCM.ini` | Plugin Richiesto | Momento Esecuzione in FCM | File Generato / Cartella |
| :--- | :--- | :--- | :--- | :--- |
| **Età Rose** | `ModEtaRose` | `FCM SQLite Exporter` (`fcm_sqlite_exporter.ps1` / `.bat`) | Dopo la generazione | Cartella `sqlite/` (`stagione_X/lega_X.sqlite`, `stagione_X/seriea_X.sqlite`) |
| **FantaMister & Top 11** | *Sempre attivo (nativo)* | *Modulo integrato nativo* (`fcmFantamisterMotore.js`) | Runtime JS / Client | File standard `fcmRisultatiDati*.js`, `fcmCalendarioDati.js` |
| **FantaMassimi & FantaClassifica** | *Sempre attivo (nativo)* | *Modulo integrato nativo* (`fcmFantamisterMotore.js`) | Runtime JS / Client | File standard `fcmRisultatiDati*.js`, `fcmCalendarioDati.js` |
| **Invio Formazione Online** | `ModInvioFormazione` | `jdPI4FCMv2.exe` (by johndoe) | Dopo la generazione | Cartella `invform/`, `invform.php` |
| **Archivio Storico Avanzato** (Album, Almanacco, Ranking, Top Costi, Confronti, `#archivio`) | `ModStoricoAvanzato` | `FCM SQLite Exporter` (storico da `sqlite/`); opzionale `Confronti Storici v3.1` (by Lukesky) per i dati legacy | Dopo la generazione | Cartella `sqlite/`, API `inc/api_storico.php`, eventuale `persjs/fcmConfrontiDati.js` |
| **Records di Lega** | *Sempre attivo (nativo)* | *Modulo integrato nativo* | Runtime JS / Client | File standard `fcmCalendarioDati.js`, `fcmCompetizioniDati.js` |
| **Se Avessi Avuto... (Incroci)**| *Sempre attivo (nativo)* | *Modulo integrato nativo* (calcolo istantaneo) | Runtime JS / Client | File standard `fcmCalendarioDati.js`, `fcmRisultatiDati*.js` |
| **Guestbook di Lega** | `ModGuestbook` | Script integrato `gbook182` | Server PHP | Cartella `gbook182/` |
| **Contatore Visite** | `ModCounter` | Script integrato `fkounter5` | Server PHP | Cartella `fkounter5/` |
| **Live Fantacalcio.it** | `ModLiveFantacalcio` | *Modulo integrato* (API Fantacalcio.it) | Runtime PHP | `inc/live_extractFC.php`, `inc/data/liveVU_associazioni.php` |
| **Live Fantapazz** | `ModLiveFantapazz` | *Modulo integrato* (API Fantapazz) | Runtime PHP | `inc/live_extractFP.php`, `inc/data/liveVU_associazioni.php` |
| **Live FantaMaster** | `ModLiveFantaMaster` | *Modulo integrato* (API FantaMaster) | Runtime PHP | `inc/live_extractFM.php`, `inc/data/liveVU_associazioni.php` |
| **Voti Ufficiosi PianetaFanta**| `ModLiveVU` | *Modulo integrato* (API PianetaFanta) | Runtime PHP | `inc/live_extractVU.php`, `inc/data/liveVU_associazioni.php` |
| **Indisponibili & Squalificati**| `ModIndisponibili` | *Modulo integrato* (Fantacalcio.it) | Runtime PHP | API / Cache locale |
| **Probabili Formazioni** | `ModProbabiliSky` | *Modulo integrato* (Sky Sport) | Runtime PHP | `inc/probform_extract.php`, `js/ProbFGDati.js` |
| **Mercato Libero a Buste Chiuse** | `ModMercatoLibero` | *Modulo integrato* (`mercato/`) | Runtime PHP | `mercato/` (`index.php`, `admin.php`, `api.php`), dati in `mercato/data/` |
| **Homepage, Tema ed Editoriale AI** | *Sempre attivi (nativi)* | *Pannello Amministratore Integrato* (+ chiave API Google Gemini opzionale) | Runtime PHP | `inc/homepage_admin_save.php`, `inc/theme_admin_save.php`, `inc/api_ai_news.php` |

> 💡 **Nota sulla modularità:**  
> Se non vuoi utilizzare uno dei moduli, è sufficiente impostare la rispettiva voce su `No` in FCM (o lasciare che la skin rilevi l'assenza del file): i link e le schede non verranno mostrati nel menu, evitando pagine bianche o errori 404.

---

## 🧮 Calcolo Risultati & Pannello Amministratore

ModernFCM include un motore completo per il **Calcolo Manuale e Live dei Risultati** direttamente nella SPA (`#calcolo`), senza dover aprire il software FCM durante il turno di campionato.

### Funzionalità del Calcolo:
1. **Fonti Voti Flessibili**:
   - Voti in tempo reale da **Fantacalcio.it**, **Fantapazz Live** e **FantaMaster**.
   - Voti Ufficiosi da **PianetaFanta.it** (con supporto a redazioni singole o medie).
   - Modalità offline con inserimento manuale o file voti generati.
2. **Motore Regolamentare FCM**:
   - Calcolo automatico dei totali squadra e dei gol secondo le soglie della propria lega.
   - Modificatori di difesa, centrocampo, attacco, fair play e capitano.
   - Gestione delle sostituzioni con ordine di panchina, rispetto dei moduli ammessi e riserva d'ufficio.
3. **Pannello Impostazioni Parametri Calcolo**:
   - Accessibile cliccando sull'icona delle impostazioni ⚙️ nella testata della vista `#calcolo`.
   - Si apre in un elegante modale interno con layout a schede, con possibilità di espansione a tutto schermo (`inc/impostazioni.php`) tramite l'apposita icona ↗️.
   - Permette di modificare e salvare direttamente le variabili contenute in `js/fcmCalcoloRisultatiVariabili.js` (Fattore campo, Punti per gol, Modificatori, Fasce gol, ecc.).
   - Ogni salvataggio crea automaticamente una copia di backup di sicurezza (`.bak`).

---

## 🧩 Pannello Amministratore a Schede (`inc/impostazioni.php`)

Il pannello (modale in `#calcolo` o pagina standalone, route `#impostazioni`) è protetto dalla password admin e raccoglie tutte le configurazioni di lega in schede:

| Scheda | Funzione |
| :--- | :--- |
| **Parametri Calcolo Risultati** | Variabili di `js/fcmCalcoloRisultatiVariabili.js` con backup automatico `.bak`. |
| **Associazioni Live** | Matching calciatori 1-a-1 con tutte le fonti esterne (`inc/data/liveVU_associazioni.php`). |
| **Ranking & Storico** | Regole personalizzate del ranking storico e configurazione dei siti storici legacy (`inc/inc_ranking_storico_view.php`, `inc/storico_admin_save.php`). |
| **Personalizzazione Home** | Layout, widget predefiniti e personalizzati, sponsor di lega ed editoriale AI (vedi sotto). |
| **Personalizzazione Tema** | Palette colori/token Chiaro e Scuro, font e dimensione testo, auto-hide header, propagazione tema alle pagine integrate e ripristino del tema di fabbrica *ModernFCM Classic* (`inc/theme_admin_save.php`, `inc/theme_loader.php`). |

---

## 🏠 Homepage Personalizzabile

- **Lato utente**: ogni visitatore può mostrare/nascondere e riordinare i widget (anche con drag & drop) e salvare le preferenze nel proprio browser.
- **Lato admin** (scheda *Homepage*, salvataggio in `inc/homepage_admin_save.php`):
  - **Impostazioni predefinite di lega** per i nuovi visitatori (campetto Top/Flop iniziale, colonne quote scommesse, accordion Classifica GP e Coppa di Lega).
  - **Layout e ordinamento** dei widget di lega: Editoriale AI, Hub Live Matchday, Formazioni in Campo, Countdown & Invio Formazione, Risultati, Top/Flop 11, FantaMister, Anteprima/Bilancio prossimo turno, Quote 1X2 e U/O, Classifiche, Coppa, Guestbook, Sponsor e Contatore.
  - **Widget personalizzati**: testo, pulsante con link, countdown a data/ora, immagine, HTML/iframe; con badge colorato, visibilità condizionale e scadenza automatica.
  - **Sponsor e Preferiti** con logo e link.

### ✨ Editoriale di Giornata con AI (Google Gemini)
- Generazione della cronaca di giornata (titolo, sommario, *Match Clou*, *Top Player*, ecc.) tramite **Google Gemini** (Free Tier da [aistudio.google.com](https://aistudio.google.com)), con tono selezionabile (default `ironico`).
- La chiave API **non è esposta al browser**: viene letta e salvata lato server in `inc/data/ai_config.json` (`apiKey`, `model`, `defaultTone`) tramite il proxy `inc/api_ai_news.php`.
- Possibilità di scegliere la giornata, rigenerare, modificare il testo e pubblicare; l'editoriale è salvato in cache locale (`inc/cache_ai/`). Senza chiave API il widget semplicemente non viene mostrato.

---

## 📚 Archivio Storico & Stagioni (`#archivio`)

- Pagina dedicata con tutte le stagioni precedenti, alimentata dagli archivi SQLite generati da `FCM SQLite Exporter` e servita da `inc/api_storico.php` (album, almanacco, ranking, ranking divisioni, top costi, rose, età rose, confronti).
- **Siti storici legacy**: la scheda admin gestisce le cartelle dei vecchi siti HTML (`inc/storico_admin_save.php`); i link compaiono solo se configurati.
- Se gli archivi SQLite non sono presenti il modulo si disattiva con messaggio di cortesia, senza errori.
- Il plugin `plugin/fcm_sqlite_exporter/` è portabile, con interfaccia grafica, selezione rapida delle stagioni, aggiornamento della sola stagione corrente, log persistente e gestione anti-lock dei file `.fcm` aperti (vedi il suo `README.md`).
- I database `.sqlite` vengono letti solo dal server e non devono essere scaricabili dal web (vedi *Sicurezza*). L'esportatore non vi copia le colonne con recapiti e credenziali delle squadre (telefoni, e-mail, password): se hai database generati con una versione precedente del plugin, riesporta tutte le stagioni per ripulirli.

---

## 🛒 Mercato Libero a Buste Chiuse (`#mercato`, `#mercato_admin`)

Modulo opzionale (`ModMercatoLibero`) per gestire il mercato a buste chiuse direttamente dal sito, senza database esterni (storage JSON flat-file con file lock in `mercato/data/`):
- **Squadre**: login, offerte per i calciatori liberi con controllo di crediti disponibili, crediti già impegnati, slot di ruolo saturi e calcolo del taglio/rimborso secondo le percentuali di lega.
- **Buste cifrate**: le offerte sono cifrate (`mercato/inc/crypto.php`) e visibili solo in fase di risoluzione.
- **Admin**: creazione/modifica sessioni, apertura/chiusura, impostazioni regolamentari, **simulazione** e **assegnazione finale** (idempotente) con crediti extra registrati per sessione, report testuale completo e *scheda operazioni da applicare in FCM* copiabile.
- **Registro delle azioni dell'amministratore**: simulazioni, report consultati prima dell'assegnazione finale, assegnazioni finali, creazione, modifica (date comprese), apertura/chiusura manuale ed eliminazione delle sessioni e modifiche alle impostazioni vengono annotate in `mercato/data/registro_admin.txt`, un file a cui il modulo aggiunge soltanto righe. Il registro è mostrato in sola lettura alle squadre che accedono al mercato e nel pannello admin. Se il file non è scrivibile l'azione viene rifiutata: nulla avviene senza lasciare traccia.
- **Simulazione e segretezza**: l'opzione «Consenti la simulazione dell'asta all'amministratore» non può essere cambiata finché una sessione non ancora assegnata in via definitiva contiene buste (prima va eseguita l'assegnazione finale oppure eliminata la sessione). Con la simulazione disattivata gli importi non sono consultabili dal pannello fino all'assegnazione finale; chi gestisce l'hosting può comunque leggere i file sul server.
- **Sessioni**: il nome può avere al massimo 100 caratteri e le date di apertura e chiusura devono essere date assolute (giorno e ora), come quelle inserite dal modulo del pannello.
- **File in `mercato/data/`**: oltre ai file già esistenti il modulo crea `registro_admin.txt` (il registro) e `assegnazione.lock` (lock usato durante l'assegnazione finale). L'intera cartella è negata via HTTP dal suo `.htaccess`, che il modulo ricrea se manca.
- Se il modulo è disattivato le pagine mostrano un avviso e la voce di menu scompare.

---

## 🔗 Modulo Gestione Associazioni Giocatori (Tutte le Fonti Live)

A causa delle differenti nomenclature dei calciatori tra Fantacalcio Manager, Fantacalcio.it, Pianetafanta, Fantapazz e FantaMaster (es. abbreviazioni, cognomi composti come *De Bruyne*, *Di Lorenzo*, *Anguissa*, o nomi multipli come *Gonçalo Ramos*, *Pio Esposito*), ModernFCM integra un modulo unificato per il salvataggio in `inc/data/liveVU_associazioni.php`:

### Associazioni PianetaFanta, Fantacalcio.it, Fantapazz & FantaMaster (`inc/data/liveVU_associazioni.php`)
- **Gestione Automatica**: il sistema scarica in automatico i listoni ufficiali di Pianetafanta, Fantacalcio.it, Fantapazz e FantaMaster e li associa ai calciatori del database FCM.
- **Caricamento File**: in alternativa è possibile caricare localmente i file ufficiali (Excel `.xlsx` per Pianetafanta e Fantacalcio.it, `.csv` per Fantapazz, `.json` per FantaMaster).
- **Analisi e Matching**: il sistema analizza i calciatori attivi di Serie A (`arrGiocatoriA`) e associa automaticamente codice e nome per ciascuna fonte.
- **Risoluzione Casi Dubbi**: tabella interattiva con filtri rapidi (*Tutti*, *Da Risolvere*, *Convalidati*, *Non Trovati*), badge di stato e ricerca testuale.

### 🛡️ Principi Chiave del Matching:
- **Univocità Stretta (1-a-1)**: nessun calciatore esterno può essere assegnato contemporaneamente a due giocatori FCM differenti. Qualora si verifichi una collisione (ad es. per omonimie o abbreviazioni identiche come *Martinez J.*), il sistema declassa automaticamente entrambi i record a stato **⚠️ Conflitto Univocità**, costringendo l'utente a confermare manualmente la scelta.
- **Selezione Calciatori Non Assegnati**: all'interno della riga di ciascun giocatore (sia per i casi dubbi, sia per i *Non Trovati*, sia in modalità modifica `✏️`), è presente un menu a tendina interattivo che raccoglie:
  1. *Candidati suggeriti dall'algoritmo*;
  2. *Calciatori non assegnati della stessa squadra di Serie A*;
  3. *Tutti gli altri calciatori non assegnati del listone*.
- **Controllo Preventivo Salvataggio**: il sistema impedisce il salvataggio se vengono rilevate assegnazioni duplicate, guidando l'utente alla risoluzione immediata dei conflitti.

---

## 🔒 Sicurezza & Password Amministratore

Per garantire la massima sicurezza su hosting condivisi e VPS:
1. **Password Amministratore Unificata**:
   - La password utilizzata sia per l'invio formazioni scadute (`invform.php?admin=1`) sia per il pannello parametri di calcolo e gestione associazioni (`inc/impostazioni.php`) è definita nel file:
     ```php
     // File: inc/admin_config.inc.php
     $adminPassword = 'LaTuaPasswordSegreta';
     ```
   - **Scegli una password lunga e unica**, non usata altrove: il pannello è raggiungibile da Internet. `LaTuaPasswordSegreta` è solo un segnaposto: come il valore iniziale `[PASSWORD]` **non viene accettato**, e finché resta nel file l'accesso amministratore è disabilitato.
   - **Hash al posto della password in chiaro (consigliato)**: `$adminPassword` può contenere l'hash della password generato con `password_hash()`. Per ottenerlo, da un terminale con PHP installato:
     ```bash
     php -r "echo password_hash('LaTuaPassword', PASSWORD_DEFAULT), PHP_EOL;"
     ```
     Incolla il risultato nel file lasciando gli **apici singoli** (l'hash contiene il carattere `$`); per accedere si continua a digitare la password, non l'hash:
     ```php
     $adminPassword = '$2y$10$...';
     ```
   - **Limite ai tentativi di accesso**: dopo 8 password sbagliate in 15 minuti, i dispositivi che non hanno mai fatto un accesso riuscito restano bloccati per 15 minuti (il browser da cui l'admin è già entrato ha un contatore separato, quindi chi sbaglia apposta non può tagliarlo fuori). Lo stesso limite protegge, ciascuna con un contatore proprio, le password delle squadre nell'invio formazione e nel mercato, la password amministratore del guestbook (`$settings['apass']` in `gbook182/settings.php`) e, se la protezione è attiva (`$cnf__passwd_protect`), quella delle statistiche del contatore visite. Lo stato è salvato in `inc/data/throttle/`: per sbloccare subito un accesso cancella i file di quella cartella **tranne `secret.php`**. Se `inc/data/` non è scrivibile il limite non è attivo.
   - La configurazione dell'Editoriale AI (`apiKey`, `model`, `defaultTone`) è salvata separatamente in `inc/data/ai_config.json` tramite l'apposita scheda admin (non va esposta pubblicamente).
   - Questa stessa password protegge anche il pannello a schede, la gestione del Mercato Libero e i salvataggi di homepage, tema e archivio storico.
   - Solo chi ha fatto l'accesso come amministratore vede, nel pannello *Ultimi accessi* delle statistiche del contatore visite (`fkounter5/stats.php`), gli indirizzi IP completi e gli hostname dei visitatori: per tutti gli altri l'IP è mascherato (es. `93.45.*.*`) e l'hostname non viene mostrato.
   - Questo file è separato e **non viene sovrascritto** durante le esportazioni periodiche di Fantacalcio Manager.
2. **Protezione Apache (`.htaccess`) ed equivalente Nginx**:
   - ModernFCM include una configurazione Apache (`.htaccess` in root, `inc/data/.htaccess`, `inc/cache_ai/.htaccess` e `mercato/data/.htaccess`) che disabilita il directory listing (`Options -Indexes`) e blocca l'accesso HTTP diretto a:
     - **file sensibili per estensione** (senza distinzione tra maiuscole e minuscole): `.ini`, `.env`, `.key`, `.sql`, `.sqlite`, `.db`, `.dat`, `.log`, copie di backup (`.bak`, `.old`, `.orig`, `.save`, `.swp`, `~`), temporanei (`.tmp`), script ed eseguibili (`.sh`, `.exe`, `.ps1`, `.bat`);
     - **file sensibili per nome**: tutti i file solo-include `*.inc.php` (compresi `inc/admin_config.inc.php`, `inc/admin_security.inc.php` e `invform/invform.inc.php`), `inc/data/ai_config.json`, i dati del guestbook (`entries.txt`, `banned_ip.txt`), il log `error_log` (anche ruotato o rinominato, es. `error_log.1`), la configurazione e il log dell'esportatore SQLite;
     - **cartelle**: `mercato/data/*`, `inc/cache_ai/*`, `gbook182/apptmp/`, `plugin/`, `fkounter5/tool/`, `fkounter5/docs/` e tutto ciò che inizia con un punto (`.git`, `.env`, ...) tranne `.well-known`;
     - script `.php` e file `.csv` in `inc/data/` (compresa `inc/data/throttle/`);
     - script PHP nelle cartelle di immagini e upload (`img/`) e, fuori dalla cartella dei documenti `doc/`, archivi compressi (`.zip`, `.tar`, `.gz`, `.tgz`, `.bz2`, `.xz`, `.7z`, `.rar`) e archivi di lega di FCM (`.fcm`, `.fca`, `.mdb`);
     - richieste con un percorso aggiunto dopo il nome di uno script (PATH_INFO, es. `/index.php/altro`).
   - Restano accessibili in lettura al frontend le configurazioni pubbliche (`inc/data/homepage_config.json`, `inc/data/theme_config.json`, `inc/data/storico_config.json`) e i file `sqlite/*.json`. I file `.json`, `.txt` e `.csv` **non** sono bloccati in generale.
   - Lo stesso `.htaccess` aggiunge a tutte le risposte gli header `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: frame-ancestors 'self'` (le pagine del sito non possono essere incorporate in un frame da altri siti) e `Strict-Transport-Security` (per 180 giorni il browser userà solo HTTPS).
   - Le regole su cartelle, file nascosti, `img/`, archivi e PATH_INFO richiedono `mod_rewrite`, gli header `mod_headers`. Su **OpenLiteSpeed**, che dagli `.htaccess` applica solo le regole di riscrittura, i blocchi per estensione e per nome vanno replicati nella configurazione del virtual host.
   - Se utilizzi **Nginx** i file `.htaccess` **non hanno alcun effetto**: senza le regole seguenti chiavi, password, buste del mercato e dati dei visitatori sono scaricabili da chiunque. Aggiungile al blocco `server {}` **prima** di ogni altra `location` con espressione regolare (Nginx applica la prima che corrisponde); non sono ancorate alla radice, quindi valgono anche se il sito è in una sottocartella:
     ```nginx
     autoindex off;

     # Header di sicurezza. Una location che dichiara altri add_header non eredita
     # questi: in quel caso vanno ripetuti al suo interno.
     add_header X-Content-Type-Options "nosniff" always;
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
     add_header Content-Security-Policy "frame-ancestors 'self'" always;
     add_header Strict-Transport-Security "max-age=15552000" always;

     # File e cartelle nascosti (.git, .env, ...), tranne .well-known
     location ~ /\.(?!well-known(/|$)) { deny all; }

     # Cartelle di dati, strumenti e documentazione che nessuna pagina richiede
     location ~* /(mercato/data|inc/cache_ai|gbook182/apptmp|plugin|fkounter5/(tool|docs))(/|$) { deny all; }

     # Script e listoni in inc/data (compresa inc/data/throttle/)
     location ~* /inc/data/.*\.(php|csv)$ { deny all; }

     # Nessuno script PHP nelle cartelle di immagini e upload
     location ~* /img/.*\.(php\d*|phtml|phar|pht)(\.|/|$) { deny all; }

     # File sensibili per estensione
     location ~* "(\.(ini|bak|dat|log|sql|sh|exe|key|sqlite|db|env|old|orig|save|swp|ps1|bat)|\.tmp[0-9a-f.]*|\.(sqlite|db)-(journal|wal|shm)|~)$" { deny all; }

     # File sensibili per nome
     location ~* "((\.inc\.php|(banned_ip|entries)\.txt|ai_config\.json)[^/]*|/error_log(?![a-z])[^/]*|/config_sqlite\.json|/exporter_log\.txt)$" { deny all; }

     # Archivi compressi e archivi di lega di FCM: scaricabili solo dalla cartella dei documenti di lega (doc/)
     location ~* "^(?!.*/doc/[^/]+$).*\.(zip|tar|gz|tgz|bz2|xz|7z|rar|fcm|fca|mdb)$" { deny all; }
     ```
     Nel blocco che passa gli script a PHP usa `location ~ \.php$` con `try_files $uri =404;` e non usare `fastcgi_split_path_info`: così vengono eseguiti solo file `.php` esistenti e le richieste con PATH_INFO ricevono un 404. Il reindirizzamento da HTTP a HTTPS va fatto nel `server` in ascolto sulla porta 80 (`return 301 https://$host$request_uri;`).

---

## 🚀 Guida all'Installazione

### 1. Posizionamento della Skin in Fantacalcio Manager
1. Scarica la cartella `ModernFCM`.
2. Copia la cartella `ModernFCM` all'interno della cartella delle skin di FCM e il file `ModernFCM.ini` direttamente all'iterno della stessa cartella:
   ```text
   C:\Programmi (x86)\FCM\skin\ModernFCM\
   ```
   *(oppure il percorso corrispondente alla tua installazione di FCM)*.

### 2. Configurazione dei Plugin in FCM
1. Copia i plugin `jdPI4FCMv2.exe` e la cartella `fcm_sqlite_exporter` all'interno della cartella plugin di FCM:
  ```text
  C:\Programmi (x86)\FCM\plugin\
  ```
  *(oppure il percorso corrispondente alla tua installazione di FCM)*

### 3. Selezione della Skin ed Esportazione
1. Apri **Fantacalcio Manager**.
2. Quando generi il **Sito Web**:
   - Seleziona **ModernFCM** come skin.
   - Nella scheda delle variabili della skin potrai configurare:
     - **WebmasterNome** e **WebmasterEmail**.
     - **DefaultTheme**: `system` (predefinito), `light` oppure `dark`.
     - **Abilitazione Moduli**: abilita (`Si`) o disabilita (`No`) i vari moduli opzionali (`ModEtaRose`, `ModStoricoAvanzato`, `ModInvioFormazione`, `ModLiveFantacalcio`, `ModLiveFantapazz`, `ModLiveFantaMaster`, `ModLiveVU`, `ModIndisponibili`, `ModProbabiliSky`, `ModGuestbook`, `ModCounter`, `ModMercatoLibero`).
3. Esegui la normale procedura di generazione del sito internet da FCM

### 4. Upload sul Server Web
Carica l'intero contenuto generato via FTP (o tramite il modulo di upload di FCM) nella cartella root del tuo spazio web (es. `public_html/` o cartella della lega).

**Non caricare sul server** ciò che serve solo sul PC o durante lo sviluppo:
- la cartella `plugin/` *(plugin ed eseguibili per FCM, con `config_sqlite.json` ed `exporter_log.txt` dell'esportatore: dopo aver copiato i plugin nella cartella di FCM puoi eliminarla dalla cartella della skin, così non finisce nel sito generato)*;
- `fkounter5/tool/` *(strumento di migrazione dei dati del vecchio contatore)*;
- copie di backup e archivi *(`*.bak`, `*.old`, `*.zip`, cartelle di backup, archivi di lega `.fcm`: contengono anche recapiti e password delle squadre)*;
- cartelle di test o di lavoro *(`tests/`, `scratch/`)*.

Le regole del paragrafo *Sicurezza* negano comunque l'accesso a `plugin/` e `fkounter5/tool/`, ma è più sicuro che sul server non ci siano affatto.

Assicurati che i permessi di scrittura siano attivi sulle cartelle che richiedono salvataggio dati:
- `inc/` *(necessaria solo se `inc/cache_ai/` deve essere auto-creata)*
- `inc/data/` *(associazioni live, cache listoni, listone Fantapazz e configurazioni JSON di AI, homepage, tema e storico con relativi `.bak`)*
- `inc/cache_ai/` *(cache editoriale AI)*
- `js/`
- `img/sponsor/` *(upload loghi sponsor dal pannello admin Homepage)*
- `gbook182/` e `fkounter5/` *(se guestbook e contatore visite sono abilitati)*
- `mercato/data/` *(sessioni, offerte, report e registro delle azioni dell'amministratore del Mercato Libero)*.

Per limitare lo spam il **guestbook** accetta un solo messaggio ogni 10 secondi (in tutto, non per visitatore; serve `inc/data/` scrivibile) e rifiuta i nuovi messaggi quando il file `gbook182/entries.txt` raggiunge la dimensione fissata dalla nuova impostazione `$settings['max_logsize']` di `gbook182/settings.php` (4096 KB se non la cambi, `0` = nessun limite): in quel caso alza la soglia oppure elimina i messaggi più vecchi.

---

## 🛠️ Personalizzazione e Risoluzione Problemi

### Loghi e Stemmi Squadre
- **Logo del Sito / Lega**: posiziona la tua immagine in formato PNG quadrata o rettangolare come `img/logo.png`.
- **Icone PWA**: puoi sostituire `img/icon-192.png` e `img/icon-512.png` con lo stemma ufficiale della tua lega.
- **Maglie Fantasquadre**: inserisci le maglie in `img/sq/` con `nomesquadra.png`.

### Gestione Cache
ModernFCM include un meccanismo automatico di **cache-busting** per file CSS e JS basato su `filemtime`. Quando aggiorni la lega e ricarichi il sito, i browser riceveranno automaticamente le nuove versioni dei file dati (`js/fcmLegaDati.js`, ecc.) senza necessità di cancellare la cronologia.

### Aggiornamento Periodico Associazioni
All'inizio di ogni stagione e dopo le sessioni di calciomercato:
1. Accedi al modale ⚙️ o alla pagina `inc/impostazioni.php`.
2. Nella scheda **Associazioni Live**, scarica automaticamente o carica i listoni delle varie fonti (Pianetafanta, Fantacalcio.it, Fantapazz, FantaMaster) e salva le corrispondenze in `inc/data/liveVU_associazioni.php`.

---

## 👨‍💻 Autore e Crediti

- **Skin ModernFCM**: ideata e creata da **difgusu** ([difgusu@yahoo.it](mailto:difgusu@yahoo.it))
- **Homepage Lega di Riferimento**: [Premier Nuoro Shibuya](https://premiernuoro.altervista.org)
- **Ringraziamenti Speciali**:
  - Alla community di Fantacalcio Manager e soprattutto ai creatori dei plugin a cui sono ispirate la maggior parte delle funzioni della skin: *frbiag*, *The Prez*, *Lukesky*, *johndoe*, *Arghami*, *Puffin*.
  - A Fantacalcio.it, Fantapazz, FantaMaster, PianetaFanta e Sky Sport per i servizi live, i dati e i voti ufficiosi.
  - Un ringraziamento speciale a *papia* per il supporto da beta tester e per avermi dato spunto per molte delle funzionalità qui presenti.
