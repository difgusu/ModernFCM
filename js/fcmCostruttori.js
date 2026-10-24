// Oggetto Competizione Albo dOro
function AdOC(IDc, idAttuale, nome, iniziataNel) {
	this.IDc = IDc
	this.idAttuale = idAttuale
	this.nome = nome
	this.iniziataNel = iniziataNel
}

// Oggetto Fantasquadra Albo d'Oro
function AdOF(IDf, idAttuale, nome, iniziataNel) {
	this.IDf = IDf
	this.idAttuale = idAttuale
	this.nome = nome
	this.iniziataNel = iniziataNel
}

// Oggetto Posizione Albo dOro
function AdOP(idCompetizione, idSquadra, anno, stagione, posizione, presidente, punti, note) {
	this.idCompetizione = idCompetizione
	this.idSquadra = idSquadra
	this.anno = anno
	this.stagione = stagione
	this.posizione = posizione
	this.presidente = presidente
	this.punti = punti
	this.note = note
}

// Oggetto Vittorie Albo d'Oro
function adoV(idSquadra, nome, idAttuale) {
	var c;
	this.idSquadra = idSquadra;
	this.nome = nome;
	this.idAttuale = idAttuale;
	this.vittorie = new Array();
	if (typeof arrAdOCompetizioni !== 'undefined') {
		for (c = 1; c < arrAdOCompetizioni.length; c++) {
			this.vittorie[arrAdOCompetizioni[c].IDc] = 0;
		}
	}
}

// Costruttore dell'oggetto Incontro (abbreviato in I)
function I(ID, IncAcc, IDTipo, Giocato, IDFantagiornata, Fantagiornata, IDCompetizione, Competizione, IDGirone, Girone, GiornataDiA, IDCasa, IDFuori, IDLegaCasa, IDLegaFuori, NomeCasa, NomeFuori, GolCasa, GolFuori, ParzialeCasa, ParzialeFuori, TotaleCasa, TotaleFuori, M1Casa, M1Fuori, M2Casa, M2Fuori, M3Casa, M3Fuori) {
	this.ID = ID
	this.IncAcc = IncAcc
	this.IDTipo = IDTipo
	this.IDFantagiornata = IDFantagiornata
	this.Fantagiornata = Fantagiornata
	this.IDCompetizione = IDCompetizione
	this.IDGirone = IDGirone
	this.Competizione = Competizione
	this.Girone = Girone
	this.IDSquadre = new Coppia(IDCasa, IDFuori)
	this.IDLegaSquadre = new Coppia(IDLegaCasa, IDLegaFuori)
	this.Nomi = new Coppia(NomeCasa, NomeFuori)
	this.Gol = new Coppia(GolCasa, GolFuori)
	this.Parziali = new Coppia(ParzialeCasa, ParzialeFuori)
	this.Totali = new Coppia(TotaleCasa, TotaleFuori)
	this.M1 = new Coppia(M1Casa, M1Fuori)
	this.M2 = new Coppia(M2Casa, M2Fuori)
	this.M3 = new Coppia(M3Casa, M3Fuori)
	this.Giocato = Giocato
	this.GiornataDiA = GiornataDiA
}

// Oggetto Classifica (abbreviato C)
function C(ID, IDGirone, IDCompetizione, Pos, Nome, Presidente, Punti, PCV, PCN, PCP, PFV, PFN, PFP, RCF, RCS, RFF, RFS, MI, PMed, PMin, PMax, PDevSt, PAvv, PTot, TMed, TMin, TMax, TDevSt, TAvv, TTot, bm) {
	this.ID = ID
	this.IDGirone = IDGirone
	this.IDCompetizione = IDCompetizione
	this.Pos = Pos
	this.Nome = Nome
	this.Presidente = Presidente
	this.Punti = Punti
	this.PartiteVinte = new Coppia(PCV, PFV)
	this.PartiteNulle = new Coppia(PCN, PFN)
	this.PartitePerse = new Coppia(PCP, PFP)
	this.RetiFatte = new Coppia(RCF, RFF)
	this.RetiSubite = new Coppia(RCS, RFS)
	this.MI = MI
	this.PMed = PMed
	this.PMin = PMin
	this.PMax = PMax
	this.PDevSt = PDevSt
	this.PAvv = PAvv
	this.PTot = PTot
	this.TMed = TMed
	this.TMin = TMin
	this.TMax = TMax
	this.TDevSt = TDevSt
	this.TAvv = TAvv
	this.TTot = TTot
	this.bm = bm
}

// Oggetto ColonneClassifica
function CC(IDGirone, Colonne) {
	//stringa di bit: dove c'e' 1 la colonna   visibile
	/*  0: Squadra
	1: Presidente
	2: Punti
	3: Bonus/Malus
	4: PcV
	5: PcN
	6: PcP
	7: PfV
	8: PfN
	9: PfP
	10: PtV
	11: PtN
	12: PtP
	13: MI
	14: RcF
	15: RcS
	16: RfF
	17: RfS
	18: RtF
	19: RtS
	20: PMed
	21: PMin
	22: PMax
	23: PDst
	24: PAvv
	25: PSomma
	26: TMed
	27: TMin
	28: TMax
	29: TDSt
	30: TAvv
	31: TSomma
*/
	this.IDGirone = IDGirone
	this.Colonne = Colonne
}

// Costruttore dell'oggetto Competizione
function Competizione(ID, Nome, GironeUnico, IDGironeSeUnico, Predefinita) {
	this.ID = ID
	this.Nome = Nome
	this.GironeUnico = GironeUnico
	this.IDGironeSeUnico = IDGironeSeUnico
	this.Predefinita = Predefinita
}

// Costruttore dell'oggetto Divisione
function Divisione(ID, Nome) {
	this.ID = ID
	this.Nome = Nome
}

// Costruttore dell'oggetto DivComp
function DivComp(IDComp, IDDiv) {
	this.IDComp = IDComp
	this.IDDiv = IDDiv
}

// Costruttore dell'oggetto Girone
function Girone(ID, IDComp, IDGruppo, Nome) {
	this.ID = ID
	this.IDComp = IDComp
	this.IDGruppo = IDGruppo
	this.Nome = Nome
}

// Costruttore dell'oggetto Gruppo 
function Gruppo(ID, Nome) {
	this.ID = ID
	this.Nome = Nome
}

// Oggetti Javascript per Documenti
function Documento(ID, Categoria, Descrizione, Dimensione, Nomefile, Ordine, UltimoAggiornamento, Squadra_ID, Squadra_Nome, Squadra_Ordine) {
	this.ID = ID
	this.Categoria = Categoria
	this.Descrizione = Descrizione
	this.Dimensione = Dimensione // in kb
	this.Nomefile = Nomefile
	this.Ordine = Ordine
	this.UltimoAggiornamento = UltimoAggiornamento
	this.Squadra_ID = Squadra_ID
	this.Squadra_Nome = Squadra_Nome
	this.Squadra_Ordine = Squadra_Ordine
}

// Oggetto Fantasquadra
function F(ID, Nome, Presidente, Telef1, Telef2, Telef3, Email, IDDivisione, CreditiResidui) {
	this.ID = ID
	this.Nome = Nome
	this.Presidente = Presidente
	this.Telef1 = Telef1
	this.Telef2 = Telef2
	this.Telef3 = Telef3
	this.Email = Email
	this.IDDivisione = IDDivisione
	this.CreditiResidui = CreditiResidui
}

// Fantasquadra Extra lega
function FE(ID, IDLega, Nome) {
	this.ID = ID
	this.IDLega = IDLega
	this.Nome = Nome
}

// Rosa
function R(IDSquadra, Ruolo, Nome, Squadra, Extracom, Stato, Contratto, Acq, Svinc, GioInf) {
	this.IDSquadra = IDSquadra
	this.Ruolo = Ruolo
	this.Nome = Nome
	this.Squadra = Squadra
	this.Extracom = Extracom
	this.Stato = Stato // vale 0 per rosa, 1 per svincolati, 2 per infortunati
	this.Contratto = Contratto // vale -1 per i infortunati, -2 per prestito
	this.Acq = Acq
	this.Svinc = Svinc
	this.GioInf = GioInf
}

// Bilancio
function B(IDSquadra, Descrizione, Valore, Data) {
	this.IDSquadra = IDSquadra
	this.Descrizione = Descrizione
	this.Valore = Valore
	this.Data = Data
}

// Campi Personali
function CP(IDSquadra, Tipo, Nome, Valore, IDDocumento) {
	this.IDSquadra = IDSquadra
	this.Tipo = Tipo
	this.Nome = Nome
	this.Valore = Valore
	this.IDDocumento = IDDocumento
}

// Oggetto Formazione (abbreviato Z)
function Z(IDIncontro, IDSquadra, IDLega, Nome, SquadraDiA, Ruolo, Pos, Rig) {
	this.IDIncontro = IDIncontro
	this.IDSquadra = IDSquadra
	this.IDLega = IDLega
	this.Nome = Nome
	this.SquadraDiA = SquadraDiA
	this.Ruolo = Ruolo
	this.Pos = Pos
	this.Rig = Rig
}

// Costanti di incontro
if (typeof INC_NORMALE === 'undefined') var INC_NORMALE = 1 // Normale con fattore campo
if (typeof INC_RIPOSO === 'undefined') var INC_RIPOSO = 2 // La squadra in casa riposa
if (typeof INC_GRANPREMIO === 'undefined') var INC_GRANPREMIO = 3 // La squadra in casa è in gran premio
if (typeof INC_NORMALE_NEUTRO === 'undefined') var INC_NORMALE_NEUTRO = 4 // Normale in campo neutro
if (typeof INC_ELIMDIRETTA_AND === 'undefined') var INC_ELIMDIRETTA_AND = 5 // Eliminazione diretta, andata
if (typeof INC_ELIMDIRETTA_RIT === 'undefined') var INC_ELIMDIRETTA_RIT = 6 // Eliminazione diretta, ritorno
if (typeof INC_ELIMDIRETTA_DIR === 'undefined') var INC_ELIMDIRETTA_DIR = 7 // Eliminazione diretta, partita secca
if (typeof INC_ELIMDIRETTA_DIR_FC === 'undefined') var INC_ELIMDIRETTA_DIR_FC = 8 // Come precedente, ma con fattore campo

// Costruttore dell'oggetto Coppia
function Coppia(casa, fuori) {
	this.Casa = casa
	this.Fuori = fuori
}

/**
 * Oggetto Giocatore per Invio formazione
 *
 * @param {Number} IDSquadra Id fantasquadra
 * @param {Number} ID Id giocatore
 * @param {Number} Ruolo Ruolo (1=P, 2=D, 3=C, 4=A)
 * @param {Number} IDSquadraDiA Id squadra di A
 * @param {String} Dati Dati statistici ("<aff>%<prim>%<mv>%<col>%<fm>%<col>%<mv>%<col>%<fv>%<col>")
 */
function ifG(IDSquadra, ID, Ruolo, IDSquadraDiA, Dati) {
	this.IDSquadra = IDSquadra;
	this.ID = ID;
	this.Nome = "xg" + ID;
	this.Ruolo = Ruolo;
	this.IDSquadraDiA = IDSquadraDiA;
	this.SquadraDiA = "xa" + IDSquadraDiA;
	this.Dati = Dati;

	this.Formazione = 0;
	this.Rigorista = 0;

	this.NomeCode = ID;

}

// Oggetti Query
function Query(ID, Nome) {
	this.ID = ID
	this.Nome = Nome
}
function RisQuery(ListaValori) {
	this.ListaValori = ListaValori
	/* Lista dei risultati della query separati da % */
}

// Oggetto Registro
function RV(IDSquadra, IDGiocatore, Ruolo, IDQuot, ListaGio, ListaFormatoGio, ListaStat, ListaFormatoStat) {
	this.IDSquadra = IDSquadra
	this.IDGiocatore = IDGiocatore
	// vale:
	// 0: titoli di colonna
	// >0: riga di giocatore
	// -1: riga dei tot/parz
	// -2: riga dell mv
	// -3: riga delle fm
	// -4: riga dell'avversario
	// -5: riga del risultato
	this.Ruolo = Ruolo
	this.IDQuot = IDQuot
	// nome del quotidiano
	this.ListaGio = ListaGio
	// contiene la lista, separata da % con i valori del giocatore
	this.ListaFormatoGio = ListaFormatoGio
	// e' composto da due cifre di cui la prima indica il colore e la seconda lo stile
	// prima cifra
	//  0 = bianco
	//  1 = rosso
	//  2 = ciano
	//  3 = verde
	//  4 = giallo
	//  x+5 = colore primo piano = grigio
	// seconda cifra (bit)
	//  0 = normale
	//  1 = neretto
	//  2 = corsivo
	//  4 = sottolineato
	// quindi le combinazioni sono: 0=-,1=B,2=I,3=BI,4=S,5=SB,6=SI,7=SBI
	this.ListaStat = ListaStat
	// valori separati da % con le statistiche (26 valori)
	this.ListaFormatoStat = ListaFormatoStat
}

// Costruttore dell'oggetto Tabellino (abbreviato T)
function T(IDIncontro, IDSquadra, IDLega, Lista, ListaSqA, Ruolo, Voto, Modif, Tot, Supplementari, ListaSupplementari, VotoSupplementari, ParzialeSquadraSupplementari, FattoreCampoSupplementari, GolSupplementari, Rigori, ListaRigori, VotoRigori, GolRigori, ParzialeSquadra, FattoreCampo, ModPortiere, ModDifesa, ModCentrocampo, ModAttacco, ModModulo, ModM1Pers, ModM2Pers, ModM3Pers, TotaleSquadra, Gol) {
	this.IDIncontro = IDIncontro
	this.IDSquadra = IDSquadra
	this.IDLega = IDLega
	this.Lista = Lista
	//lista dei giocatori indicati in ordine
	// come appaiono nel tabellino. I primi 11,
	// quindi, sono i titolari. I valori sono separati
	// dal carattere %
	// i valori possono essere:
	// IDGiocatore: se c'e' un giocatore, c'e' il suo ID
	// -1: se e' una RU
	// 0: se e' assente
	// dal 12esimo in poi proseguono con panchina e tribuna:
	//  in questi ultimi non ci sono 0 o -1 quindi sono solo
	//  IDGiocatore: se positivo allora e' panchina oppure giocatore
	//  sostituito, se negativo e' tribuna
	this.ListaSqA = ListaSqA
	this.Ruolo = Ruolo
	// come Lista, valori separati da % per i ruoli dei giocatori
	// 1,2,3,4: PORT, DIFE, CENT, ATTA "normali", oppure RU
	// 5,6,7,8: Riserve (p,d,c,a) {se nei primi 11, entrata, altrimenti riserva non entrata}
	// 0: assente
	// -1,-2,-3,-4: (solo "sostituiti"): giocatori che sono stati "sostituiti"
	// -5,-6,-7,-8: tribuna (p,d,c,a)
	this.Voto = Voto
	// valori separati da % contenenti i voti dei giocatori
	this.Modif = Modif
	// valori separati da % contenenti i modificatori dei giocatori
	this.Tot = Tot
	// valori separati da % contenenti i totali dei giocatori
	this.Supplementari = Supplementari
	this.ListaSupplementari = ListaSupplementari // separati da %, se -1 e' una ru, se 0 assente
	this.VotoSupplementari = VotoSupplementari // separati da %,
	this.ParzialeSquadraSupplementari = ParzialeSquadraSupplementari
	this.FattoreCampoSupplementari = FattoreCampoSupplementari
	this.GolSupplementari = GolSupplementari

	this.Rigori = Rigori
	this.ListaRigori = ListaRigori // separati da %,
	//vale -1 se RU, 0 se assente, altrimenti l'id del giocatore
	this.VotoRigori = VotoRigori // separati da %,
	this.GolRigori = GolRigori

	this.ParzialeSquadra = ParzialeSquadra // Se "non esiste" allora vale "x"
	this.FattoreCampo = FattoreCampo // Se "non esiste" allora vale "x"
	this.ModPortiere = ModPortiere // Se "non esiste" allora vale "x"
	this.ModDifesa = ModDifesa // Se "non esiste" allora vale "x"
	this.ModCentrocampo = ModCentrocampo // Se "non esiste" allora vale "x"
	this.ModAttacco = ModAttacco // Se "non esiste" allora vale "x"
	this.ModModulo = ModModulo // Se "non esiste" allora vale "x"
	this.ModM1Pers = ModM1Pers // Se "non esiste" allora vale "x"
	this.ModM2Pers = ModM2Pers // Se "non esiste" allora vale "x"
	this.ModM3Pers = ModM3Pers // Se "non esiste" allora vale "x"
	this.TotaleSquadra = TotaleSquadra // Se "non esiste" allora vale "x"
	this.Gol = Gol // Se "non esiste" allora vale "x"
}

// Oggetti SerieA
function Quotidiano(ID, Nome) {
	this.ID = ID
	this.Nome = Nome
}
function IncontroA(Giornata, SqCasa, SqFuori, GolCasa, GolFuori) {
	this.Giornata = Giornata
	this.SqCasa = SqCasa
	this.SqFuori = SqFuori
	this.GolCasa = GolCasa
	this.GolFuori = GolFuori
}
function GiocatoreA(ID, IDSquadra, Ruolo, Codice, Crediti, Extracom) {
	this.ID = ID
	this.IDSquadra = IDSquadra
	this.Ruolo = Ruolo
	this.Codice = Codice
	this.Crediti = Crediti
	this.Extracom = Extracom
}

// Costruttore Top 11 di giornata
function T11(Ruolo, Giocatore, Squadra, Voto) {
	this.Ruolo = Ruolo
	this.Giocatore = Giocatore
	this.Squadra = Squadra
	this.Voto = Voto
}

// Costruttore Ranking Storico
function Rank(IdAlbo, IdAttuale, Squadra, Punti, Stagioni, PuntiPrecedenti) {
	this.IdAlbo = IdAlbo;
	this.IdAttuale = IdAttuale;
	this.Squadra = Squadra;
	this.Punti = Punti;
	this.Stagioni = Stagioni;
	this.PuntiPrecedenti = PuntiPrecedenti;
}

// Costruttori Almanacco Storico
function AlPresenze(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Presenze) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Presenze = Presenze;
}
function AlCannonieri(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Gol, Presenze, MediaVoto, FantaMediaVoto) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Gol = Gol; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
}
function AlCattivi(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Espulsioni, Ammonizioni, Presenze, MediaVoto, FantaMediaVoto) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
}
function AlBestieNere(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Gol, Presenze, MediaVoto, FantaMediaVoto) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Gol = Gol; this.Presenze = Presenze; this.MediaVoto = MediaVoto; this.FantaMediaVoto = FantaMediaVoto;
}
function AlTop11(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, FantaMediaVoto, MediaVoto, Presenze, Gol) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.FantaMediaVoto = FantaMediaVoto; this.MediaVoto = MediaVoto; this.Presenze = Presenze; this.Gol = Gol;
}
function AlFlop11(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, FantaMediaVoto, MediaVoto, Presenze, Gol) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.FantaMediaVoto = FantaMediaVoto; this.MediaVoto = MediaVoto; this.Presenze = Presenze; this.Gol = Gol;
}
function AlTopRating(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Rating, FantaMediaVoto, Costo, Presenze) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Rating = Rating; this.FantaMediaVoto = FantaMediaVoto; this.Costo = Costo; this.Presenze = Presenze;
}
function AlFlopRating(IDSquadraStorica, NomeSquadra, NomeGiocatore, Ruolo, Rating, FantaMediaVoto, Costo, Presenze) {
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.NomeGiocatore = NomeGiocatore; this.Ruolo = Ruolo; this.Rating = Rating; this.FantaMediaVoto = FantaMediaVoto; this.Costo = Costo; this.Presenze = Presenze;
}
function AMOD(IDModulo, Descrizione) {
	this.IDModulo = IDModulo; this.Descrizione = Descrizione;
}

// Costruttori Confronti Storici
function X(Stagione, Salve, Directory) {
	this.Stagione = Stagione; this.Salve = Salve; this.Directory = Directory;
}
function ZP(Competizione, Label, Icona) {
	this.Competizione = Competizione; this.Label = Label; this.Icona = Icona;
}
function Y(Stagione, Competizione, GiornataA, Data, IDASquadraCasa, SquadraCasa, IDASquadraFuori, SquadraFuori, Neutro, GolCasa, GolFuori, TipoRis, GolRegoCasa, GolRegoFuori, GolSupplCasa, GolSupplFuori, GolRigoriCasa, GolRigoriFuori, PuntiCasa, PuntiFuori) {
	this.Stagione = Stagione; this.Competizione = Competizione; this.GiornataA = GiornataA; this.Data = Data;
	this.IDASquadraCasa = IDASquadraCasa; this.SquadraCasa = SquadraCasa;
	this.IDASquadraFuori = IDASquadraFuori; this.SquadraFuori = SquadraFuori;
	this.Neutro = Neutro; this.GolCasa = GolCasa; this.GolFuori = GolFuori; this.TipoRis = TipoRis;
	this.GolRegoCasa = GolRegoCasa; this.GolRegoFuori = GolRegoFuori;
	this.GolSupplCasa = GolSupplCasa; this.GolSupplFuori = GolSupplFuori;
	this.GolRigoriCasa = GolRigoriCasa; this.GolRigoriFuori = GolRigoriFuori;
	this.PuntiCasa = PuntiCasa; this.PuntiFuori = PuntiFuori;
}
function AdOConf(IDASquadra, Squadra, Giocate, GiocateConPunti, Vinte, Nulle, Perse, GF, GS, PuntiFatti, PuntiSubiti) {
	this.IDASquadra = IDASquadra; this.Squadra = Squadra; this.Giocate = Giocate; this.GiocateConPunti = GiocateConPunti;
	this.Vinte = Vinte; this.Nulle = Nulle; this.Perse = Perse;
	this.GF = GF; this.GS = GS; this.PuntiFatti = PuntiFatti; this.PuntiSubiti = PuntiSubiti;
}

// Costruttore Anagrafica Giocatore
function ArG(IDSquadra, CodiceFCM, Ruolo, CostoFCM, Extracom, Nome, Foto, MarkTesserato, LuogoDiNascita, DataDiNascita, Altezza, Peso) {
	this.IDSquadra = IDSquadra; this.CodiceFCM = CodiceFCM; this.Ruolo = Ruolo; this.CostoFCM = CostoFCM;
	this.Extracom = Extracom; this.Nome = Nome; this.Foto = Foto; this.MarkTesserato = MarkTesserato;
	this.LuogoDiNascita = LuogoDiNascita; this.DataDiNascita = DataDiNascita; this.Altezza = Altezza; this.Peso = Peso;
}

// Costruttori FantaMister
function Fm(Nome, Scarto, Voti, ScSuVoti, Parz, ModParz, Max, ModMax) {
	this.Nome = Nome; this.Scarto = Scarto; this.Voti = Voti; this.ScSuVoti = ScSuVoti;
	this.Parz = Parz; this.ModParz = ModParz; this.Max = Max; this.ModMax = ModMax;
}
function FmTot(Nome, ScartoP, Partite) {
	this.Nome = Nome; this.ScartoP = ScartoP; this.Partite = Partite;
}

// Costruttore Album Storico
function Album(IDGiocatore, NomeGiocatore, Stagione, AnnoStagione, IDGiocatoreStagione, PrimaGiornataInSquadra, IDSquadra, IDSquadraStorica, NomeSquadra, Ruolo, SquadraA1, SquadraA2, SquadraA3, Presenze, TotVoti, TotFantaVoti, Goal, Espulsioni, Ammonizioni, IDDivisione, NomeDivisione, Costo, AnniContratto) {
	this.IDGiocatore = IDGiocatore; this.NomeGiocatore = NomeGiocatore; this.Stagione = Stagione; this.AnnoStagione = AnnoStagione;
	this.IDGiocatoreStagione = IDGiocatoreStagione; this.PrimaGiornataInSquadra = PrimaGiornataInSquadra; this.IDSquadra = IDSquadra;
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.Ruolo = Ruolo; this.SquadraA1 = SquadraA1;
	this.SquadraA2 = SquadraA2; this.SquadraA3 = SquadraA3; this.Presenze = Presenze; this.TotVoti = TotVoti;
	this.TotFantaVoti = TotFantaVoti; this.Goal = Goal; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni;
	this.IDDivisione = IDDivisione; this.NomeDivisione = NomeDivisione; this.Costo = Costo; this.AnniContratto = AnniContratto;
}

// Costruttore VotoGiocatore (Live & Voti Dati)
function VotoGiocatore(Nome, Voto, Fantavoto, GolFatto, GolSubito, AutoGol, Ammonizione, Espulsione, Rigore, RigoreParato, RigoreSbagliato, Assist, GolVittoria, GolPareggio, Squadra, Titolare, Sostituzione, Minuto, Finale) {
	this.Nome = Nome;
	this.Voto = Voto;
	this.Fantavoto = Fantavoto;
	this.GolFatto = GolFatto;
	this.GolSubito = GolSubito;
	this.AutoGol = AutoGol;
	this.Ammonizione = Ammonizione;
	this.Espulsione = Espulsione;
	this.Rigore = Rigore;
	this.RigoreParato = RigoreParato;
	this.RigoreSbagliato = RigoreSbagliato;
	this.Assist = Assist;
	this.GolVittoria = GolVittoria;
	this.GolPareggio = GolPareggio;
	this.Squadra = Squadra;
	this.Titolare = Titolare;
	this.Sostituzione = Sostituzione;
	this.Minuto = Minuto;
	this.Finale = Finale;
}

// Costruttore TuttiGiocatori (TopCosti)
function TuttiGiocatori(IDGiocatore, NomeGiocatore, Stagione, AnnoStagione, IDGiocatoreStagione, PrimaGiornataInSquadra, IDSquadra, IDSquadraStorica, NomeSquadra, Ruolo, SquadraA1, SquadraA2, SquadraA3, Presenze, TotVoti, TotFantaVoti, Goal, Espulsioni, Ammonizioni, IDDivisione, NomeDivisione, Costo, AnniContratto) {
	this.IDGiocatore = IDGiocatore; this.NomeGiocatore = NomeGiocatore; this.Stagione = Stagione; this.AnnoStagione = AnnoStagione;
	this.IDGiocatoreStagione = IDGiocatoreStagione; this.PrimaGiornataInSquadra = PrimaGiornataInSquadra; this.IDSquadra = IDSquadra;
	this.IDSquadraStorica = IDSquadraStorica; this.NomeSquadra = NomeSquadra; this.Ruolo = Ruolo; this.SquadraA1 = SquadraA1;
	this.SquadraA2 = SquadraA2; this.SquadraA3 = SquadraA3; this.Presenze = Presenze; this.TotVoti = TotVoti;
	this.TotFantaVoti = TotFantaVoti; this.Goal = Goal; this.Espulsioni = Espulsioni; this.Ammonizioni = Ammonizioni;
	this.IDDivisione = IDDivisione; this.NomeDivisione = NomeDivisione; this.Costo = Costo; this.AnniContratto = AnniContratto;
}

// Costruttore PalmaR (Palmares)
function PalmaR(idSquadra, nome, idAttuale) {
	var c;
	this.idSquadra = idSquadra;
	this.nome = nome;
	this.idAttuale = idAttuale;
	this.retrocessione = new Array();
	if (typeof arrAdOCompetizioni !== 'undefined') {
		for (c = 1; c < arrAdOCompetizioni.length; c++) {
			this.retrocessione[arrAdOCompetizioni[c].IDc] = 0;
		}
	}
}

// Costruttori Serie e Record (Confronti)
function AdOSqSerie(IDfSquadra, IDaSquadra, IDSerieAttiva) {
	this.IDfSquadra = IDfSquadra;
	this.IDaSquadra = IDaSquadra;
	this.IDSerieAttiva = IDSerieAttiva;
}

function AdOSerie(IDASquadra, Squadra, Totale, Parziale1, Parziale2, Parziale3, StagioneI, GiornataI, DataI, StagioneF, GiornataF, DataF, Chiusa) {
	this.IDASquadra = IDASquadra;
	this.Squadra = Squadra;
	this.Totale = Totale;
	this.Parziale1 = Parziale1;
	this.Parziale2 = Parziale2;
	this.Parziale3 = Parziale3;
	this.StagioneI = StagioneI;
	this.GiornataI = GiornataI;
	this.DataI = DataI;
	this.StagioneF = StagioneF;
	this.GiornataF = GiornataF;
	this.DataF = DataF;
	this.Chiusa = Chiusa;
}

function ATR(IDTR, Descrizione) {
	this.IDTR = IDTR;
	this.Descrizione = Descrizione;
}

function ABilancio(Competizione, NomeCompetizione, Incontro, IDSquadraA, NomeSquadraA, IDSquadraB, NomeSquadraB, Giocate, VinteA, Nulle, VinteB, GA, GB, PuntiA, PuntiB, UltimaVittoriaA, UltimoPareggio, UltimaVittoriaB, PanchineCompetizioneA, PanchineCompetizioneB, PanchineTotaliA, PanchineTotaliB) {
	this.Competizione = Competizione;
	this.NomeCompetizione = NomeCompetizione;
	this.Incontro = Incontro;
	this.IDSquadraA = IDSquadraA;
	this.NomeSquadraA = NomeSquadraA;
	this.IDSquadraB = IDSquadraB;
	this.NomeSquadraB = NomeSquadraB;
	this.Giocate = Giocate;
	this.VinteA = VinteA;
	this.Nulle = Nulle;
	this.VinteB = VinteB;
	this.GA = GA;
	this.GB = GB;
	this.PuntiA = PuntiA;
	this.PuntiB = PuntiB;
	this.UltimaVittoriaA = UltimaVittoriaA;
	this.UltimoPareggio = UltimoPareggio;
	this.UltimaVittoriaB = UltimaVittoriaB;
	this.PanchineCompetizioneA = PanchineCompetizioneA;
	this.PanchineCompetizioneB = PanchineCompetizioneB;
	this.PanchineTotaliA = PanchineTotaliA;
	this.PanchineTotaliB = PanchineTotaliB;
}

// Costruttore Ranking Divisioni
function RankDivisioni(NomeDivisione, IdAlbo, IdAttuale, Squadra, Punti, Stagioni, PuntiPrecedenti) {
	this.NomeDivisione = NomeDivisione;
	this.IdAlbo = IdAlbo;
	this.IdAttuale = IdAttuale;
	this.Squadra = Squadra;
	this.Punti = Punti;
	this.Stagioni = Stagioni;
	this.PuntiPrecedenti = PuntiPrecedenti;
}


