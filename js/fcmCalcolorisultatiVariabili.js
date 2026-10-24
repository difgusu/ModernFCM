// Variabili base
fattorecampo = 2; // Numero di punti previsto per il fattore campo
diffT = 3; // Differenza massima tra i totali per forzare il pareggio tra due punteggi in due fasce diverse (Esempi: 72-70 non finisce 2-1 ma 2-2; 67-65 non finisce 1-0 ma 0-0)
modP = 0; // Modificatore portiere: 1 - attivo; 0 - non attivo
modD = 1; // Modificatore difesa: 1 - attivo; 0 - non attivo
modC = 1; // Modificatore centrocampo: 1 - attivo; 0 - non attivo
modA = 1; // Modificatore attacco: 1 - attivo; 0 - non attivo
modX = 0; // Modificatore personalizzato: 1 - attivo; 0 - non attivo
golVP = 0; // Calcola il Gol Decisivo per Vittoria/Pareggio: 1 - attivo; 0 - non attivo
autoGol = 1; // Regola autogol squadra: 1 - attivo; 0 - non attivo
pAutogol = 59; // Punteggio minore di X per regalare un gol all'avversario
pMinAutogol = 59; // Punteggio maggiore o uguale a X per la squadra che beneficia dell'autogol
pScarAutogol = 3; // Scarto minimo tra le squadre per assegnare l'autogol

// Variabili di gioco
pGolF = 3; // Punti per Gol fatto
pGolS = 1; // Punti per Gol Subito
pAutoG = 2; // Punti per Autogol (senza il segno meno davanti)
pRigF = 3; // Punti per Rigore segnato
pRigS = 3; // Punti per Rigore sbagliato (senza il segno meno davanti)
pRigP = 3; // Punti per Rigore parato
pAss = 1; // Punti per Assist
pAmm = 0.5; // Punti per l'Ammonizione (senza il segno meno davanti)
pEsp = 1; // Punti per l'Espulsione (senza il segno meno davanti)
pPorI = 1; // Punti per il Portiere imbattuto
pGolV = 1; // Punti per Gol Decisivo per la Vittoria
pGolP = 0.5; // Punti per Gol Decisivo per il Pareggio

// Variabili di Calcolo
pMaxS = 4; // Numero massimo di sostituzioni
intervallovoti = 0.25; // Intervallo dei voti da calcolare
totaleNumeroMassimoRiserve = 10; // Numero di riserve della panchina (settare -1 se tutta la rosa va in panchina)
pMaxRisU = 1; // Numero massimo di Riserve d'ufficio
pRisUP = 3; // Punti Riserva d'ufficio Portiere
pRisU = 4; // Punti Riserva d'ufficio Altro giocatore
pModDRisU = 5; // Punti Riserva d'ufficio per il calcolo del modificatore difesa
pModCRisU = 5; // Punti Riserva d'ufficio per il calcolo del modificatore centrocampo
pModAArr = 0; // Arrotondamento per difetto al mezzo voto nel calcolo del modificatore attacco: 1 - attivo; 0 - non attivo

// Variabili delle fasce gol
fgol1 = 66;
fgol2 = 72;
fgol3 = 77;
fgol4 = 81;
fgol5 = 85;
fgol6 = 89;
fgol7 = 93;
fgol8 = 97;
fgol9 = 101;
fgol10 = 105;
fgol11 = 109;
fgol12 = 113;
fgol13 = 117;
fgol14 = 121;
fgol15 = 125;
