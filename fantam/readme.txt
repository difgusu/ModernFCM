FantaMister 16.0 by Alex 'The Prez' Trovato

----------------------------------------------------------------------------------------
SI RICORDA CHE E' POSSIBILE FARE PICCOLE DONAZIONI AGLI AUTORI DEI VARI PLUG IN :-), 
PER PERMETERGLI DI RILASSARSI UN PO' NEI VARI MONDI VIRTUALI ;-)
ANCHE UN SOLO EURO PUO' SVELARE UNIVERSI SCONOSCIUTI !!

NEL MIO CASO INIDIRIZZO PAYPAL: alextrov@email.it

"Visto che da anni uso Fantamister (e adesso mi accingo a configurare Fantahisto)
mi sembra adeguato un minimo riconoscimento. Anche per la puntuale assistenza
 (e lo sbattimento nello spiegare decine di volte le stesse cose...) Complimenti"

"Grazie per l'aiuto!e perdonami, nonostante ritenga che il tuo "fantamister" valga molto di più non
posso offrirti più di xxx ! Grazie per il tuo lavoro!"

"...dai ora sto bene per un mese....anche due
però devi impegnarti a risolvere il mio problema...ti ho inviato la mail..."

"mi dispiace, sono uno studente squattrinato e al momento la mia carta postepay ha solo
questi due miseri euro =D ma almeno un caffè lo meriti per quel fenomenale
 fantamister! e anche per il logo di emergency sulla tua divisa!!
ciao e grazie per il tuo lavoro"  


------------------------------------------------------------------------------------- 

Questo programmino è nato per permette di avere settimana per settimana
la classifica del Fantallenatore dell'anno, cioè quell'allenatore
che meglio fa rendere la rosa messagli a disposizione dal suo Presidente.

Nelle versioni successive sono stati aggiunti due nuovi strumenti:
Fantacannonieri, Gli Incompresi, Gli Uomini Partita, TOP&FLOP

--------------------------------------------------------------------------
FANTAMISTER

Calcola per ogni partita il miglior Parziale Squadra possibile
provando tutti i moduli configurati nel file conf.txt (vedi sotto).
Non sono presi in considerazione i modificatori di reparto e in generale tutti
quei modificatori che non partecipano al Totale Giocatore.

Quindi mostra la classifica globale basata sulla minor differenza media tra il
totale che si è ottenuto con la squadra in campo e il migliore che si
poteva ottenere.

Inoltre FantaMister calcola una classifica basata sullo scarto medio per partita
pesato (cioè diviso) sul numero di voti validi oltre gli 11 che compongono la formazione
titolare, questo perchè si potrebbe ritenere più facile azzeccare la formazione
se si hanno meno giocatori disponibili ed in generale nel caso di rose con
pochi calciatori titolari. 
A voi decidere quale delle due classifiche sia più rappresentativa ma quella
pesata è a mio parere più significativa.

Per ogni squadra vengono elencati i moduli che più spesso avrebbero permesso
di ottenere il massimo punteggio. Sono mostrati i moduli con una frequenza 
superiore alla media (#giornate/#moduli).

Sono poi elencati dati statistici sulla frequenza dei vari moduli
nel totale di tutte le squadre in due modalità: considerando ogni occorrenza
di massimo punteggio anche se condiviso con altri moduli e considerando
solo le occorrenze in cui un solo modulo è risultato il migliore. 

Il file prodotto (fantamister.htm) si chiude con il dettagli di ogni giornata.

--------------------------------------------------------------------------

FANTAMARCATORI

Per ogni giornata vengono trovati i fantamarcatori di ogni partita, la logica
utilizzata è la seguente: il gol è segnato dal calciatore con migliore totale 
calciatore, dopo di che gli vengono sottratti 3 punti e per altri gol si trova
il nuovo maggiore totale calciatore. In caso di parità possono essere applicate
alcune priorità configurabili:

VA - migliore voto assoluto
AT - prima attaccanti
DF - prima difensori
CE - prima centrocampisti
PG - il calciatore che fino a quel momento ha più fantagol già segnati
MG - il calciatore che fino a quel momento ha meno fantagol già segnati
SQ - ATTENZIONE - E' possibile inserire in qualunque punto della lista
     delle priorità il codice SQ, viene ignorato come priorità ma,
     se inserito, FantaMister considererà separatamente i gol segnati
     dallo stesso calciatore con squadre diverse per la classifica fantamarcatori

Queste priorità possono essere messe nel conf.txt come da file di esempio
allegato. PG e MG si escludono ovviamente a vicenda.
In caso di ulteriore parità si prende il calciatore prima in formazione.
Le priorità di default (se non si mettono nell'conf.txt) sono nell'ordine:

VA
MG
DF
CE
AT
SQ

Dopo le priorità è possibie inserire un nuovo parametro dopo una linea cona sterisco:

*
1.1


Questo valore, se presente, verrà usato per dare più peso alle rose con più voti tra cui scegliere.
Maggiori i voti tra cui scegliere nella rosa minore lo scarto pesato. 
Attenzione, questo valore da un andamento esponenziale alla formula.
Il suo valore di default, quello storico, è 1

Vengono generati tre file:

cannonieri.htm - classifica fantamarcatori
calenbomber.htm - calendario delle partite giocate con i fantamarcatori
ultima.htm - ultima giornata giocata con fantamarcatori

--------------------------------------------------------------------------

GLI INCOMPRESI

Ci sono fantallenatori che si ostinano a mandare in panchina, se non
addirittura in tribuna, fuoriclasse assoluti che sarebbero titolari 
in qualunque altra fantasquadra. Ma loro sanno perchè, storie di corna?
Incompatibilità Sacchiane? Antichi rancori o riti woodoo?
Non lo sapremo mai. Ma FantaMister vi aiuta a stanarli.

Il programma genera due classifiche:

incomedia.htm - classifica calciatori per media totale giocatore quando NON 
		schierati tra i titolari. Sono selezionati quelli con una media
		di almeno 6.00.

incomtot.htm - classifica calciatori per totale giocatore accumulato nelle partite
               NON schierati tra i titolari. Sono selezionati quelli con una media
	       di almeno 6.00 e che abbiano un numero di "assenze" superiore alla media
	       di tutti i calciatori.


--------------------------------------------------------------------------

UOMINI PARTITA

Ho aggiunto su richiesta questa classifica. Per ogni partita viene
"premiato" il calciatore con il miglior TOTALE
giocatore. La classifica tiene conto del numero di volte in cui
un calciatore è stato l'Uomo Partita.
La priorità di scelta in caso di parità è la seguente:

1) Calciatore della squadra vincente il Fantaincontro
2) Priorità configurate nel conf.txt e in comune con i marcatori


Il file prodotto è uomopartita.htm


--------------------------------------------------------------------------
TOP&FLOP

Vengono generati 4 file:

top11.htm - migliore formazione ultima giornata
top11s.htm - migliore formazione intera stagione
flop11.htm - peggiore formazione ultima giornata
flop11s.htm - peggiore formazione intera stagione

Vengono presi in considerazione solo i totali giocatore per le partite
in cui il calciatore ha effettivamente giocato e contribuito al totale 
della fantasquadra.
Per le classifiche di stagione si prendono solo i calciatori con un numero
di presenze almeno pari a un valore configurabile:

nella lista dei codici è possibile inserire un numero (es.50) che viene
preso come % del numero di presenze medio di tutti i calciatori

il default è 50% della media presenze di tutti i calciatori.
Inoltre, qualora fosse presente nello stesso folder l'utility topflop.exe
di eugenio.p questa viene eseguita

--------------------------------------------------------------------------
FANTASFIGA

Questa classifica si basa sul rendimento dei propri avversari rispetto alla
loro media. Il valore indicato è traducibile in "quanti punti fanno in media 
i miei avversari giocando contro di me rispetto alla loro media"

--------------------------------------------------------------------------
MIGLIORI ROSE

File Bestrose.htm. Classifica del miglior parziale totale medio che era ottenibile 
dalle varie rose se gli allenatori avessero azzeccato sempre la migliore formazione
possibile.

--------------------------------------------------------------------------
STATISTICHE DI SQUADRA

Nel file sq.htm sono presenti:

1) Distribuzione moduli utilizzati
2) (Solo Lega Amara) utilizzo Panchina fissa/flessibile e marcature a uomo
3) Fantamarcatori 
4) Rosa ordinata per numero Presenze in campo, più (eventuali subentri da panchina e numero sostituzioni)

Fantamister crea il file fanta.php per una migliore visualizzazione dei file sq.htm

----------------------------------------------------------------------
INSTALLAZIONE 
----------------------------------------------------------------------

Creare un folder a piacere ed estrarvi i file in FantaMister.zip

Il programm usa i tabellini di ogni giornata esportati seguendo
questa procedura:

1) Aprire il calendario
2) Aprire la finestra "Calcolo Risultati" cliccando sul tasto "Tabe" di una giornata
già giocata
3) Aprire la finestra "Stampa/Esporta" cliccando sull'icona floppy
4) Selezionare "Destinazione" --> "Esporta come testo separato da tabulazione"
5) Selezionare "Modello" --> "In campo, in panchina e in tribuna"
6) Cliccare OK
7) Selezionare il folder dove si messo il file FantaMister.exe
8) Cliccare OK
9) Uscire dalla finestra "Calcolo Risultati"

I file di ogni giornata devono rimanere nel folder del file FantaMister.exe

-------------------------------------------------------------------------


Il file Conf.txt deve essere preparato prima di lanciare FantaMister.exe,
prendendo ad esempio il file già presente inserire il nome delle squadre
così come visualizzate nel calendario di FCM, aggiungere linee se necessario.
Aggiungere inoltre i moduli utilizzati nella vostra lega nelle righe
dopo quella con l'asterisco. Alla fine del riga di ogni modulo è possibile
inserire un modificatore che verrà applicato nel calcolo del miglior Parziale
Squadra ottenibile da quel ruolo (es. -1, 0.5).
Il file conf.txt e i modificatori present nello ZIP sono solo un esempio,
i modificatori sono opzionali, io ne sconsiglio l'utilizzo.

I NOMI DELLE SQUADRE DEVONO ESSERE ESATTAMENTE COME QUELLI CONFIGURATI
IN FCM, COMPRESI CARATTERI STRANI TIP $ o & ECC.
EVITATE DI AGGIUNGERE SPAZI E RIGHE RISPETTO AL FILE DI ESEMPIO.
NON AGGIUNGETE SPAZI ALLA FINE DEL NOME DELLE SQUADRE.
IL 99% DEI PROBLEMI SEGNALATI SONO DI QUESTO TIPO!!
GLI ALTRI SONO CONFIGURAZIONE DI LEGHE PARTICOLARI.


Prima dei moduli è possibile inserire una o più delle istruzioni
SRC, DJS e DIR, vedi esempio:

*
SRC D:\documenti\Alex\fc\FantaMister
DIR D:\Documenti\Alex\fc\Web\sito\fantamister
3 4 3
3 5 2
3 6 1

SRC indica il folder dove si trovano i file esportati
DIR indica dove Fantamister andrà a copiare i file prodotti
DJS indica dove Fantamister andrà a copiare i file JS prodotti (script Puffin)

Attenzione: non lasciare linee vuote tra l'ultimo di questi parametri e il
primo modulo della lista.

Dopo la lista dei moduli è possibile inserire le priorità
per risolvere i pareggi nel calcolo dei fantacannonieri, dopo un asterisco
è possibile inserire un numero a piacere dei codici disponibili sopra descritti.


ATTENZIONE: il file img1.png deve rimanere nel folder dove si trova il .css
-----------------------------------------------------------------------------
ESECUZIONE
-----------------------------------------------------------------------------

Semplicemente lanciare il file FantaMister.exe nel folder dove si trovano
i file esportati delle varie giornate.
Verranno creati i seguenti file:

FantaMister.htm
Cannonieri.htm
Calenbomber.htm
Ultima.htm
Incomedia.htm
Incomtot.htm
top11.htm 
top11s.htm 
flop11.htm 
flop11s.htm
uomopartita.htm
fantasfiga.htm
sq*.htm
squadre.php

-------------------------------------------------------------

Se sul forum non riuscite a risolvere eventuali problemi
mandatemi i file esportati e il conf.txt a alex@theprez.it

Ciao,

tp

******************************************
		CREDITS
******************************************

Puffin
PIX83
	
******************************************
	     AGGIORNAMENTI
******************************************

versione 16.1  14/09/09
- Risolto caso rarissimo nella assegnazione marcatore gol

versione 16.0  14/06/09
- Ridotta lunghezza nomi su classifiche per giocatori

versione 15.6  25/10/08
- Corrette maiuscole su nome file
- Modificata visualizzazione Sc.Voti

versione 15.4  25/10/08
- Esteso supporto alla versione 5 di FantaHisto

versione 15.3  04/10/08
- Corretto caso parità Fantacannonieri

versione 15.2  30/09/08
- Correzione per fcmTop11.js in caso di folder locale

versione 15.1  27/09/08
- Fantamister ora genera anche il file fcmTop11.js per la pagina Top11.php di Efix

versione 15.0  27/09/08
- Se FantaHisto.exe è nel folder Source, viene eseguito e i file .js creati vengono copiati nel folder di destinazione
- Aggiornato il Fantamister.css per formatare anche la tabella di fantahisto.htm

versione 14.3  01/03/07
- errore visualizzazione nelle statistiche di squadra
- Esegue Quotazioni.exe se presente
- Senza codice SQ mostra l'ultima squadra del calciatore

versione 14.2  27/12/07
- Più di 50 quadre gestibile (da verificare) 
- Correzione alcuni errori di visualizzazione (modifica persa)

versione 14.1  10/10/07
- Errore Muslera flop11 di giornata
- Configurabile nuovo folder di destinazione per i file JS dello script di Puffin: usare DJS come DIR e SRC

versione 14.0  03/10/07
- correzioni htm
- inseriti alcuni messaggi che dovrebbero chiarire meglio eventuali errori
- generati due file .js da utilizzare con un plug-in di puffin in preparazione	

versione 13.4  22/09/07
- fine restyling di PIX83 su tutti i file

versione 13.3  7/09/07
- Correzioni formati htm
- corretto errore subentrato/sostituito
- Genera messaggio in caso di file risultati non presenti

versione 13.2  7/09/07
- corretta visualizzazione MAX punti nel dettaglio giornata
- correzioni format htm

versione 13.1  4/09/07
- corretta la generazione del fanta.php
- inclusa una piccola immagine(freccia) nel package da posizionare insieme al .css
- le indicazioni sugli spettatori e incassi compaiono solo se presenti i file di Fantaspet

versione 13.0  1/09/07
- revisione formattazione output. Ora tutto basato su fantamister.css
quindi configurabile
- possibile inserire nel conf.txt folders con spazi

versione 12.8  16/04/07
- migliorata indicazione in caso di TS e RIG

versione 12.7  3/02/07
- problema in caso di prima giornata senza tutte le squadre in campo

versione 12.6  27/11/06
- I file sq.htm sono ora prodotti seguendo l'ordine delle squadre del conf.txt
- il fanta.php cerca i file nel suo stesso folder. Questo per rendere più flessibile il posizionamento dei file nel sito

versione 12.5  19/11/06
- Risolto blocco nel calcolo MoM in caso di fantatotali uguali, una particolare ordine di priorità e ruolo calciatori

versione 12.4  19/11/06
- Errore nel top/flop in caso di totale calciatore esattamente a zero


versione 12.3  16/11/06
- Errore se nel conf.txt non era presente il parametro SRC

versione 12.2  14/11/06
- corretto calcolo giocatori entrati da panchina
- Nelle Presenze per squadra sono ora indicati anche i calciatori con zero presenze e le volte in cui un calciatore, da titolare, è stato sostituito
- creato un fanta.php che include i dati fantamister, stat per squadra, records di puffin
- folder Source nel conf.txt, prima del primo modulo, è ora possibile inserire una stringa tipo:
		
	SRC D:\fc\sito\fantamister

  se presente, Fantamister cercherà in quel folder i file di input e vi creerà quelli output. Guardate il conf.txt di esempio	


versione 12.1  12/11/06
- Le statistiche di Squadra sono ora esportate in vari file separati (sq1.htm, sq2.htm ecc)
- Fantamister crea il file squadre.php per creare una pagina simile a fanta.php per le statistiche di squadra
- Vengono letti i nomi dei file esportati anche se contengono il nome della Lega (da FCM 8.1.2 in poi). Attenzione a non avere
nello stesso folder file che, leggendone il nome da destra, non siano confondibili con quelli esportati (es: "Copia di risultati10.tab")
- Folder Destination nel conf.txt, prima del primo modulo, è ora possibile inserire una stringa tipo:
		
	DIR D:\fc\sito\fantamister

  se presente, Fantamister copierà tutti i file prodotti (htm e php) nel folder di destinazione, normalmente il
  folder Fantamister del sito da uploadare con FCM. Guardate il conf.txt di esempio	

versione 12.0  08/11/06
- Creazione file statistiche di Squadra (squadre.htm)

versione 11.1  30/10/06
- debug per coesistenza modifiche 11.0 con alcuni casi Gran Premio

versione 11.0  23/10/06
- Rivisto algoritmo gestione per caso squadra senza formazione (tot 60 d'ufficio ma 3 come parziale da FCM)
- Creato file Bestrose.htm. Classifica del miglior parziale medio che era ottenibile 
dalle varie rose.

Versione 10.11  04/10/06
- errore formattazione tabella moduli
- inseriti migliori controlli e messaggi per errori nel conf.txt

Versione 10.10  21/09/06
- errore formattazione fantasfig

Versione 10.9  19/09/06
- Errore su tabella Globale Moduli Assoluto
- Debug vari
- Alcune rifiniture su formattazioni

Versione 10.8  17/09/06
- corretto problema con gestione opzione SQ
- modificata priorità per Uomo Partita. Vedi sezione dedicata
- modificate alcune sezioni perla creazione dei file html e del .css
- Fantamister ora lancia automaticamente Fantaspet se presente insieme al file 
spet.txt e formazioni.tab. Poi usa il cred.txt per la visualizzazione degli spettatori
e incassi in Ultima.htm

Versione 10.7  16/09/06
- corretto caso GP con squadre dispari
- corretto caso particolare con tutte partite senza migliori moduli unici 
- se il file cred.txt (generato da Fantaspet) è presente inserisce nella tabella
 Ultima giornata anche gli spettatori e i crediti per squadra

Versione 10.6  11/05/06
- estesa la copertura alle 42 giornate della serie B

Versione 10.5  24/04/06
- Caso particolare errato Flop di giornata

Versione 10.4  07/03/06
- Caso particolare portiere marcatore

Versione 10.3  13/02/06
- Considerati un minimo di 2 attaccanti nel Flop di Stagione
- Corretti portieri marcatori

Versione 10.2  07/02/06
- risolti doppioni su top/flop in caso di + competizioni 
nella stessa giornata

Versione 10.1  13/11/05
- gestite rose di 80 giocatori !!

Versione 10.0  13/11/05
- inserita classifica Fantasfiga

Versione 9.6  08/11/05
- corretta gestione portiere RU fuori casa

Versione 9.5  28/10/05
- corretta gestione della media presenze sui top/flop

Versione 9.4  23/10/05
- File complesso con rose >50 calciatori
- Coesistenza partite GP e normali per marcatori, calendario ecc

Versione 9.3  17/10/05
- caso di GranPremio con squadre dispari

Versione 9.2  07/10/05
- piccolo errore formattazione flop11s
- aggiornamento fantamister.css

Versione 9.1  06/10/05
- corretto problema con riserve entrate in campo alla loro prima partita
- corretto problema sul filtro di partite minimo giocate
- inserito codice NN per decidere la % di partite minimo giocate rispetto la media

Versione 9.0  05/10/05
- Se la utility topflop.exe è presente nel folder di FantaMister, la esegue
- Top11 e Flop11 di giornata


Versione 8.1  01/10/05
- Incompresi per Leghe GP

Versione 8.0  27/9/05
- riviste alcune logiche di visualizzazione per la gestione dei casi con meno di 12 voti
- incluso un altro formato dei file esportati a GP
- aggiunta la classifica degli Uomini Partita

Versione 7.3  25/9/05
- Introdotta l'opzione SQ nella lista dei codici
	* ATTENZIONE - E' possibile inserire in qualunque punto della lista
	* delle priorità il codice SQ, viene ignorato come priorità ma,
	* se inserito, FantaMister considererà separatamente i gol segnati
	* dallo stesso calciatore con squadre diverse per la classifica fantamarcatori

Versione 7.2  24/9/05
- si sporcava la classifica fantamarcatori 

Versione 7.1  24/9/05
- piccole modifiche formattazioni html

Versione 7.0  24/9/05
- aumentate a 50 le squadre gestibili
- inserito il calcolo delle classifiche Incompresi per media e totale giocatore
- il programma calcola ora tutte le tabelle senza chiedere nulla

Versione 6.4  23/9/05
- risolto problema con priorità PG e MG

Versione 6.3  23/9/05
- ancora modifiche estetiche
- corretti alcuni casi priorità


Versione 6.2  21/9/05
- ancora modifiche estetiche
- inserita la fantasquadra nella classifica
- ignorati spazi dopo il nome della squadra nel conf.txt
- corretti alcuni casi priorità

Versione 6.1  20/9/05
- corrette alcune formattazioni
- corretto bug casi particolari

Versione 6.0  19/9/05
- Aggiunta la classifica cannonieri e il calendario con i fantamarcatori
- il file conf.txt può ora contenere le priorità in caso di parità totale calciatore per il calcolo dei marcatori
- Rimossa l'opzione output su testo

Versione 5.1 17/9/05
- Introdotti percorsi app.path per plug-in
- inserito warning per errori sul file conf.txt 

Versione 5.0 17/9/05
- Introdotta Gestione Tornei GP (da testare con più export)

Versione 4.2 12/9/05
- Ritoccata la formattazione delle tabelle


Versione 4.1 9/9/05
- Corretto problema con uso modifictori (9999)
- Rivista formattazione tabelle e CSS

Versione 4.0 8/9/05
- Corretti bug sulla 3.8
- Iniziato aggiornamento nuovo formato tabelle, il css è in test
- Modificato nome programma in FantaMister

Versione 3.8 26/6/05
- la distribuzione % dei moduli è ora mostrata ordinata
- Solo per formato htm - 
  Separata la distribuzione dei migliori moduli in due parti, una come la precedente
  che tiene conto di tutti i moduli che hanno dato il massimo totale possibile, la 
  secobda basata tenendo in considerzione solo i casi in cui un solo modulo fornisce 
  il miglior totale di una giornata

Versione 3.7 22/6/05

- dovrebbe essere ora in grado di gestire giornate con più partite giocate
dalla stessa squadra. L'assunto è che la formazione, e quindi i valori qui
interessanti, sia la stessa per tutte le partite della stessa squadra. Per i calcoli
vengono considerati i valori nella la prima partita di quella squadra. 

Versione 3.6 20/4/05

- corretto errore in caso di rose diverse tra loro in termini di numero di calciatori

Versione 3.5 24/3/05

- in caso di squadra radiata nel corso della stagione e senza formazione comunicata
viene assegnato uno scarto fisso tale da estrometterla dalla classifica

Versione 3.4 11/12/04

- Il dettaglio delle giornate è ora stampato in ordine inverso
  per rendere più facile la visualizzazione dell'ultima giornata 
  giocata. 

Versione 3.2 06/11/04

- è ora possibile configurare un modificatore per ogni modulo

Versione 3.1 21/10/04

- corretto caso in cui ci sono più di 8 formazioni equivalenti in una giornata
- modificato il calcolo della media scarto pesata, ora tiene in considerazione
 il numero di voti validi oltre gli 11 della formazione titolare. Questo sembra
 essere un indice migliore della capacità di scelta dando meno peso a quelle rose
 che hanno i titolari contati

Versione 3.0 19/10/04

- evidenziatle parità tra migliori moduli nella singola giornata e
  adeguate le relative statistiche

Versione 2.7 9/10/04

- parificati contenuti tra file txt e htm
- corretti alcuni problemi di formattazione

Versione 2.6 7/10/04

- nel file testo sono indicati per ogni giornata il modulo schierato e il modulo migliore 
(in caso di inf.numerica il modulo schierato non è disponibile)

Versione 2.5 6/10/04

- gestite rose più ampie, più moduli
- nel file txt c'è ora anche la statistica globale del "rendimento" dei vari moduli
- portate a 30 il numero di squadre massimo 

Versione 2.4 4/10/04

- Introdotto dettaglio migliori moduli

Versione 2.3 24/9/04

- Il programma ora può generare il file in formato .htm
- Portate a 20 il numero di squadre massimo

Versione 2.2 22/9/04

- Corrette altre visualizzazioni decimali

Versione 2.1 21/9/04

- Aggiunti Totali Parziali e Massimi nel dettaglio delle giornate
- Corrette altre visualizzazioni decimali

Versione 2.0 21/9/04

- Aggiunta classifica pesata sul numero di voti validi
- Aggiunti risultati di ogni giornata

Versione 1.1 20/9/04

- Corretto errore visualizzazione valori totali < 1 
- Corretto errore con voti a 3 cifre decimali

