# ⚽ ModernFCM

**ModernFCM** è una skin moderna, reattiva e modulare per **Fantacalcio Manager (FCM)** progettata con architettura **Single Page Application (SPA)**, approccio mobile-first e supporto completo alle **Progressive Web App (PWA)**.

Sviluppata per rinnovare l'interfaccia classica dei siti generati da FCM, ModernFCM offre un'esperienza utente ricca e fluida sia su smartphone che su desktop: tema Chiaro/Scuro (Light/Dark mode), tabellini con campo grafico interattivo, voti ufficiosi e calcolo live in tempo reale, statistiche avanzate, grafici prestazionali, pannello amministratore integrato e piena compatibilità con l'ecosistema dei plugin storici per FCM.

---

## 🌟 Caratteristiche Principali

- 🌓 **Tema Chiaro / Scuro / Sistema (Dark Mode)**: selettore rapido a 3 stati (Chiaro, Scuro, Sistema) posizionato in testa al drawer laterale con auto-rilevamento della modalità del dispositivo, salvataggio preferenze in `localStorage` e valore predefinito configurabile da ini.
- ⚡ **Architettura SPA Ultra-Rapida**: caricamento istantaneo delle viste senza ricaricamento dell'intera pagina (`#home`, `#classifica`, `#calendario`, `#rose`, `#formazioni`, `#risultati`, `#calcolo`, `#probabili`, `#statistiche`, `#storico`, ecc.).
- 🏟️ **Campo Grafico Formazioni**: visualizzazione grafica con maglie, schieramento a tutto campo (4-3-3, 3-5-2, ecc.), panchina e riserve.
- 🔴 **Live Fantapazz & Voti Ufficiosi**:
  - Voti in tempo reale (Fantapazz Live) con gol, bonus, malus ed eventi di giornata.
  - Voti Ufficiosi (PianetaFanta / fonti multiple: Gazzetta, Corriere, Tuttosport, Medie ponderate).
  - Ricalcolo automatico del punteggio delle partite di Lega minuto per minuto.
- 🧮 **Calcolo Risultati Manuale & Live (`#calcolo`)**:
  - Motore di calcolo in-page fedele al 100% al regolamento ufficiale di Fantacalcio Manager.
  - Simulazione e applicazione di: modificatori di difesa, centrocampo, attacco, fair play, capitano, fattore campo, intorni e fasce gol personalizzabili.
  - Gestione automatica e manuale di formazioni, sostituzioni regolamentari (cambio modulo e ruolo per ruolo) e riserva d'ufficio.
- ⚙️ **Pannello Amministratore & Variabili di Calcolo**:
  - Finestra modale popup integrata nella vista `#calcolo` con pulsante per espansione a tutto schermo sulla pagina standalone `inc/impostazioni_calcolo.php`.
  - Autenticazione protetta da password amministratore unificata con il modulo formazioni (`invform/admin_config.inc.php`).
  - Modifica visuale in tempo reale di tutte le variabili di calcolo (`js/fcmCalcoloRisultatiVariabili.js`) con backup automatico.
- 🔗 **Gestione Associazioni Calciatori con Matching Univoco (1-a-1)**:
  - Modulo dedicato per allineare i calciatori di Serie A di FCM con i listoni esterni di **PianetaFanta.it**, **Fantacalcio.it** ed il listone CSV di **Fantapazz**.
  - Algoritmo di matching multi-criterio per cognomi composti, nomi davanti (es. *Gonçalo Ramos*, *Pio Esposito*), ruoli e iniziali.
  - Risoluzione assistita dei casi dubbi e possibilità di selezionare direttamente i calciatori non ancora assegnati (organizzati per squadra di Serie A).
  - Garanzia di **univocità stretta (1-a-1)**: nessun calciatore esterno può essere assegnato più volte, con blocco preventivo dei duplicati e risoluzione automatica delle collisioni.
- 🚑 **Probabili Formazioni, Indisponibili & Squalificati (`#probabili`)**:
  - Estrazione automatica e visualizzazione delle probabili formazioni Sky Sport, percentuali di titolarità, ballottaggi, infortunati e tempi di rientro con cache intelligente (`inc/probform_extract.php` -> `js/ProbFGDati.js`).
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

ModernFCM integra nativamente i dati prodotti dai plugin storici più diffusi della community FCM.  
Di seguito l'elenco dei plugin collegati ai rispettivi moduli, come configurati in `ModernFCM.ini`:

| Modulo / Funzionalità | Variabile in `ModernFCM.ini` | Plugin Richiesto | Momento Esecuzione in FCM | File Generato / Cartella |
| :--- | :--- | :--- | :--- | :--- |
| **Età Rose** | `ModEtaRose` | `archivioA.exe` (by frbiag) | Prima della generazione | `js/fcmGiocatoriDati.js`, `js/fcmGiocatoriDati.php` |
| **Tabellini e Dati Partite** | `ModFantamister` | `FM_TabMatic.exe` | Prima della generazione | Creazione dei file `fantam/risultatiX.tab` |
| **FantaMister & Top 11** | `ModFantamister` | `Fantamister` (by The Prez) | Generazione / Plugin | `js/fcmTop11.js`, cartella `fantam/` |
| **FantaMassimi & FantaClassifica** | `ModFantaMassimi` | `Fantamister` (by The Prez) | Generazione / Plugin | Tabelle record fantapunti in `fantam/` |
| **Invio Formazione Online** | `ModInvioFormazione` | `jdPI4FCMv2.exe` (by johndoe) | Dopo la generazione | Cartella `invform/`, `invform.php` |
| **Archivio Storico Avanzato** | `ModStoricoAvanzato` | `Confronti Storici v3.1` (by Lukesky) | Dopo la generazione | `persjs/fcmConfrontiDati.js` |
| **Records di Lega** | `ModRecords` | `records.exe` (by Puffin) | Dopo la generazione | Cartella `records/` |
| **Se Avessi Avuto... (Incroci)**| `ModIncroci` | `invertical.bat` *Se avessi avuto...* (by Arghami) | Script / Generazione | `js/incrociacalendari.js`, cartella `incrodet/` |
| **Guestbook di Lega** | `ModGuestbook` | Script integrato `gbook182` | Server PHP | Cartella `gbook182/` |
| **Contatore Visite** | `ModCounter` | Script integrato `fkounter5` | Server PHP | Cartella `fkounter5/` |
| **Live Fantapazz** | `ModLiveFantapazz` | *Modulo integrato* (API Fantapazz) | Runtime PHP | `inc/live_extractFP.php`, `js/fcmVotiAssociazioni.js` |
| **Voti Ufficiosi PianetaFanta**| `ModLiveVU` | *Modulo integrato* (API PianetaFanta) | Runtime PHP | `inc/live_extractVU.php`, `inc/liveVU_associazioni.php` |
| **Indisponibili & Squalificati**| `ModIndisponibili` | *Modulo integrato* (Fantacalcio.it) | Runtime PHP | API / Cache locale |
| **Probabili Formazioni** | `ModProbabiliSky` | *Modulo integrato* (Sky Sport) | Runtime PHP | `inc/probform_extract.php`, `probform/` |
| **Impostazioni Calcolo & Associazioni** | `ModCalcolo` | *Pannello Amministratore Integrato* | Runtime PHP | `inc/impostazioni_calcolo.php`, cartella `inc/` |

> 💡 **Nota sulla Modularità:**  
> Se non disponi di uno o più plugin (ad esempio non usi i *Confronti Storici* o i *Records*), è sufficiente impostare la rispettiva voce su `No` in FCM (o lasciare che la skin rilevi l'assenza del file): i link e le schede non verranno mostrati nel menu, evitando pagine bianche o errori 404.

---

## 🧮 Calcolo Risultati & Pannello Amministratore

ModernFCM include un motore completo per il **Calcolo Manuale e Live dei Risultati** direttamente nella SPA (`#calcolo`), senza dover aprire il software FCM durante il turno di campionato.

### Funzionalità del Calcolo:
1. **Fonti Voti Flessibili**:
   - Voti in tempo reale da **Fantapazz Live**.
   - Voti Ufficiosi da **PianetaFanta.it** (con supporto a redazioni singole o medie).
   - Modalità offline con inserimento manuale o file voti generati.
2. **Motore Regolamentare FCM**:
   - Calcolo automatico dei totali squadra e dei gol secondo le soglie della propria lega.
   - Modificatori di difesa, centrocampo, attacco, fair play e capitano.
   - Gestione delle sostituzioni con ordine di panchina, rispetto dei moduli ammessi e riserva d'ufficio.
3. **Pannello Impostazioni Parametri Calcolo**:
   - Accessibile cliccando sull'icona delle impostazioni ⚙️ nella testata della vista `#calcolo`.
   - Si apre in un elegante modale interno con layout a schede, con possibilità di espansione a tutto schermo (`inc/impostazioni_calcolo.php`) tramite l'apposita icona ↗️.
   - Permette di modificare e salvare direttamente le variabili contenute in `js/fcmCalcoloRisultatiVariabili.js` (Fattore campo, Punti per gol, Modificatori, Fasce gol, ecc.).
   - Ogni salvataggio crea automaticamente una copia di backup di sicurezza (`.bak`).

---

## 🔗 Modulo Gestione Associazioni Giocatori (LiveVU & Fantapazz)

A causa delle differenti nomenclature dei calciatori tra Fantacalcio Manager, Fantacalcio.it, Pianetafanta e Fantapazz (es. abbreviazioni, cognomi composti come *De Bruyne*, *Di Lorenzo*, *Anguissa*, o nomi multipli come *Gonçalo Ramos*, *Pio Esposito*), ModernFCM integra uno strumento di associazione automatica e manuale all'avanguardia.

Il modulo è suddiviso in due sezioni indipendenti:

### 1. Associazioni PianetaFanta & Fantacalcio.it (File `inc/liveVU_associazioni.php`)
- **Caricamento File**: selezione dei file Excel ufficiali delle quotazioni:
  - File Excel Pianetafanta (es. `quotazioni-giornataX.xlsx`).
  - File Excel Fantacalcio.it (es. `Quotazioni_Fantacalcio_Stagione_XXXX.xlsx`).
- **Analisi e Matching**: il sistema analizza i calciatori attivi di Serie A (`arrGiocatoriA`) e associa codice e nome per ciascuna fonte.
- **Risoluzione Casi Dubbi**: tabella interattiva con filtri rapidi (*Tutti*, *Da Risolvere*, *Convalidati*, *Non Trovati*), badge di stato e ricerca testuale.

### 2. Associazioni Fantapazz (File `js/fcmVotiAssociazioni.js`)
- **Caricamento File**: selezione del file CSV del listone Fantapazz (template `Listone_Fantapazz.csv` con delimitatore `;`).
- **Analisi Dedicata**: matching rapido e mirato su ruolo e nome tra il listone Fantapazz e i giocatori FCM.

### 🛡️ Principi Chiave del Matching:
- **Univocità Stretta (1-a-1)**: nessun calciatore esterno può essere assegnato contemporaneamente a due giocatori FCM differenti. Qualora si verifichi una collisione (ad es. per omonimie o abbreviazioni identiche come *Martinez J.*), il sistema declassa automaticamente entrambi i record a stato **⚠️ Conflitto Univocità**, costringendo l'utente a confermare manualmente la scelta.
- **Selezione Calciatori Non Assegnati**: all'interno della riga di ciascun giocatore (sia per i casi dubbi, sia per i *Non Trovati*, sia in modalità modifica `✏️`), è presente un menu a tendina interattivo che raccoglie:
  1. *Candidati suggeriti dall'algoritmo*;
  2. *Calciatori non assegnati della stessa squadra di Serie A*;
  3. *Tutti gli altri calciatori non assegnati del listone*.
- **Controllo Preventivo Salvataggio**: il sistema impedisce il salvataggio se vengono rilevate assegnazioni duplicate, guidando l'utente alla risoluzione immediata dei conflitti.

---

## 🔒 Sicurezza & Password Amministratore

Per garantire la massima sicurezza su hosting condivisi:
1. **Password Amministratore Unificata**:
   - La password utilizzata sia per l'invio formazioni scadute (`invform.php?admin=1`) sia per il pannello parametri di calcolo e gestione associazioni (`inc/impostazioni_calcolo.php`) è definita nel file:
     ```php
     // File: invform/admin_config.inc.php
     $adminPassword = 'LaTuaPasswordSegreta';
     ```
   - Questo file è separato e **non viene sovrascritto** durante le esportazioni periodiche di Fantacalcio Manager.
2. **Protezione `.htaccess`**:
   - ModernFCM include una configurazione Apache preimpostata che blocca l'accesso HTTP diretto a file sensibili (`.ini`, `.bak`, `.log`, `.tmp`, `admin_config.inc.php`, `invform.inc.php`) e impedisce l'esplorazione non autorizzata delle cartelle (`Options -Indexes`).

---

## 🚀 Guida all'Installazione

### 1. Posizionamento della Skin in Fantacalcio Manager
1. Scarica la cartella `ModernFCM` o clona il repository.
2. Copia l'intera cartella `ModernFCM` (contenente il file `ModernFCM.ini` e tutte le sottocartelle `css`, `js`, `img`, `inc`, ecc.) all'interno della cartella delle skin di FCM:
   ```text
   C:\Programmi (x86)\FCM\skin\ModernFCM\
   ```
   *(oppure il percorso corrispondente alla tua installazione di FCM)*.

### 2. Configurazione dei Plugin in FCM
In Fantacalcio Manager, assicurati che i plugin siano configurati nella sezione appropriata:
- **Plugin Prima della Generazione**:
  1. `archivioA.exe`
  2. `FM_TabMatic.exe`
- **Plugin Dopo la Generazione**:
  1. `invertical.bat`
  2. `jdPI4FCMv2.exe`
  3. `confrontiStorici31.exe`
  4. `records.exe`

### 3. Selezione della Skin ed Esportazione
1. Apri **Fantacalcio Manager**.
2. Quando generi il **Sito Web**:
   - Seleziona **ModernFCM** come skin.
   - Nella scheda delle variabili della skin potrai configurare:
     - **WebmasterNome** e **WebmasterEmail**.
     - **DefaultTheme**: `system` (predefinito), `light` oppure `dark`.
     - **News1-6**: date e testi per i tre avvisi in bacheca.
     - **Sponsor1-3**: Titoli, Link e loghi pubblicitari (va indicato il percorso relativo o intero del file `.jpg` o `.png`).
     - **VotoSource**, **GolSource**, **AssistSource**: preferenze su quotidiani e medie per i voti ufficiosi.
     - **Abilitazione Moduli**: abilita (`Si`) o disabilita (`No`) i vari moduli opzionali (`ModEtaRose`, `ModFantamister`, `ModInvioFormazione`, `ModLiveVU`, ecc.).
3. Esegui la normale procedura di generazione del sito internet da FCM.

### 4. Upload sul Server Web
Carica l'intero contenuto generato via FTP (o tramite il modulo di upload di FCM) nella cartella root del tuo spazio web (es. `public_html/` o cartella della lega).

Assicurati che i permessi di scrittura siano attivi sulle cartelle che richiedono salvataggio dati:
- `invform/` (per la ricezione e il log delle formazioni inviate).
- `inc/` (per il salvataggio di `inc/liveVU_associazioni.php` e backup variabili).
- `js/` (per l'aggiornamento di `fcmCalcoloRisultatiVariabili.js`, `fcmVotiAssociazioni.js`, `ProbFGDati.js`, voti live).
- `gbook182/` e `fkounter5/` (se guestbook e contatore visite sono abilitati).

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
1. Accedi al modale ⚙️ o alla pagina `inc/impostazioni_calcolo.php`.
2. Nella scheda **Associazioni LiveVU**, carica i nuovi listoni Excel di Pianetafanta e Fantacalcio.it e salva le corrispondenze.
3. Nella scheda **Associazioni Fantapazz**, carica il listone CSV di Fantapazz e salva le associazioni su `js/fcmVotiAssociazioni.js`.

---

## 👨‍💻 Autore e Crediti

- **Skin ModernFCM**: ideata e creata da **difgusu** ([difgusu@yahoo.it](mailto:difgusu@yahoo.it))
- **Homepage Lega di Riferimento**: [Premier Nuoro Shibuya](https://premiernuoro.altervista.org)
- **Ringraziamenti Speciali**:
  - Alla community di Fantacalcio Manager e ai creatori degli indispensabili plugin: *frbiag*, *The Prez*, *Lukesky*, *johndoe*, *Arghami*, *Puffin*.
  - A Fantacalcio.it, Fantapazz, PianetaFanta, Sky Sport per i servizi live, i dati e i voti ufficiosi.
