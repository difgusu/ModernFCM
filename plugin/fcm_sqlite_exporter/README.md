# FCM SQLite Exporter - Plugin per Fantacalcio Manager

Plugin portabile per **Fantacalcio Manager (FCM)** che estrae tutti i dati storici del database (Lega `.fcm` e Serie A `.fca`) convertendoli in database **SQLite standard (.sqlite)** completi e suddivisi per stagione (`stagione_X/lega_X.sqlite` e `stagione_X/seriea_X.sqlite`) all'interno della cartella `sqlite/` del tuo sito web.

Ideale per alimentare il modulo storico e le schede giocatore di **ModernFCM** con la massima velocità ed efficienza.

---

## ✨ Caratteristiche

* **Portabile**: Eseguibile in qualsiasi cartella (avviando `fcm_sqlite_exporter.bat`). Rileva automaticamente i percorsi di Fantacalcio Manager (Documenti, OneDrive, cartelle di installazione o parametri passati da FCM).
* **Compatibilità Windows 32/64 bit**: Gestione integrata e trasparente dei driver OLEDB Jet 4.0 / Access su qualsiasi versione di Windows (11, 10, 8, 7) senza richiedere software aggiuntivo.
* **Pulsanti di Selezione Rapida**:
  * **Tutte**: Seleziona tutti i file `.fcm` rilevati nella cartella di riferimento (anche appartenenti a leghe differenti).
  * **Tutte Lega**: Seleziona tutti i file della Lega attualmente attiva.
  * **Solo Attuale**: Seleziona unicamente la stagione corrente.
  * **Deseleziona**: Deseleziona tutti gli archivi.
* **Anti-Lock Shared Shadow Copy**: Esegue una copia shadow temporanea con condivisione `FileShare.ReadWrite` in `%TEMP%` prima dell'estrazione Jet. Questo risolve ed elimina alla radice i problemi di lock quando l'archivio è aperto nel programma FCM in esecuzione (anche come Administrator).
* **Registro Operazioni Persistente con Timestamp**: Tutti gli eventi e gli eventuali errori vengono registrati a video e salvati nel file `exporter_log.txt` con timestamp precisi `[yyyy-MM-dd HH:mm:ss]`. È possibile aprire il file direttamente dalla GUI con il pulsante **Apri File Log**.
* **Verifica Automatica Stagioni Consolidate**: Rileva rapidamente se le stagioni storiche precedenti sono già state generate in `sqlite/`, consentendo con un clic di aggiornare solo la stagione attuale senza dover rielaborare tutto l'archivio.

---

## 📦 Struttura dei File del Plugin

All'interno della cartella `plugin/fcm_sqlite_exporter/`:
* `fcm_sqlite_exporter.bat`: Comando per avviare l'esportatore da FCM o da standalone.
* `fcm_sqlite_exporter.ps1`: Script PowerShell principale.
* `config_sqlite.json`: Preferenze salvate (cartelle e stagioni selezionate).
* `exporter_log.txt`: File di registro persistente con timestamp dettagliati.
* `sqlite3.exe`: Eseguibile CLI di SQLite per la generazione ultra-veloce dei file `.sqlite`.

---

## 🚀 Guida all'Uso

### 1. Avvio dell'Interfaccia Grafica
Fai doppio clic su:
👉 **`fcm_sqlite_exporter.bat`** (oppure copia la cartella `fcm_sqlite_exporter/` con tutto il contenuto all'interno della cartella `plugin/` di FCM e aggiungi `fcm_sqlite_exporter.bat` ai plugin della skin utilizzata su FCM)

2. L'interfaccia rileverà automaticamente:
   * La **Cartella Dati FCM** contenente i tuoi archivi `.fcm` e i relativi archivi di Serie A `.fca` (es. `...Documenti\Fantacalcio Manager\data`).
   * La **Cartella Destinazione SQLite** (i file verranno salvati in `sqlite/stagione_X/`).
   * Tutti gli **archivi stagionali `.fcm`** presenti.

3. **Selezione degli Archivi**:
   * Clicca su **Tutte** per selezionare tutti i file `.fcm` trovati nella cartella.
   * Clicca su **Tutte Lega** per selezionare tutti gli archivi della Lega attuale (se viene utilizzato da dentro FCM).
   * Clicca su **Solo Attuale** per aggiornare solo l'ultima stagione.
   * Ordina o filtra gli archivi usando la casella **Filtro** o cliccando sulle intestazioni di colonna.

4. Clicca su **AVVIA CONVERSIONE SQLITE**:
   * La barra di avanzamento e il box di registro mostreranno l'avanzamento in tempo reale.
   * Tutte le tabelle di lega e di Serie A verranno convertite in file .sqlite (senza le colonne riservate: vedi *Dati Riservati*).
   * In qualsiasi momento puoi cliccare su **Apri File Log** per aprire il file `exporter_log.txt` con Notepad.

---

## 📁 Struttura dei Database SQLite Generati

I database vengono salvati nella cartella `sqlite/`:

```text
sqlite/
├── stagione_1/
│   ├── lega_1.sqlite          <-- Dati lega: squadre, rose, partite, calendari, classifiche
│   └── seriea_1.sqlite        <-- Dati Serie A: calciatori, quotazioni, pagelle, statistiche
└── stagione_XX/
    ├── lega_XX.sqlite
    └── seriea_XX.sqlite
```

---

## 🔒 Dati Riservati

* **Colonne non esportate**: recapiti e credenziali restano fuori dai database generati, sia dallo schema sia dai dati. Sono escluse, in tutte le tabelle, le colonne il cui nome inizia con `Telef` o contiene `Mail`, `Passw` o `Pwd` (in FCM il campo `Telef2` della fantasquadra può contenere la password usata per l'invio della formazione). Il registro elenca, tabella per tabella, le colonne lasciate fuori. ModernFCM non legge nessuna di queste colonne.
* **Database già generati**: i file creati con una versione precedente del plugin contengono ancora quelle colonne. Per ripulirli riesporta tutte le stagioni (pulsante **Tutte Lega** oppure **Tutte**) e ricarica sul sito la cartella `sqlite/`.
* **I file `.sqlite` non vanno resi pubblici**: restano una copia dei dati della lega. Sul sito non devono essere scaricabili (ci pensano le regole `.htaccess` di ModernFCM; su Nginx vanno aggiunte le regole indicate nel README principale).
* **Il plugin non va caricato sul sito**: serve solo sul PC con FCM. `config_sqlite.json` ed `exporter_log.txt` contengono percorsi locali del PC.
