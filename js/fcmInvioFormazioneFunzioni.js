/* ==========================================================================
   fcmInvioFormazioneFunzioni.js - CONCEPT 1: TACTICAL PITCH & SMART DRAWER
	ModernFCM - Revisione Moderna con Invio FCM Nativo
   ========================================================================== */

// Utility fallbacks (formerly in fcmUtils.js, now modern in fcmDataLoader.js)
if (typeof window.JSQueryString !== 'function') {
	window.JSQueryString = function (par) {
		if (!par || typeof window === 'undefined' || !window.location) return '';
		try {
			if (window.location.search) {
				var searchParams = new URLSearchParams(window.location.search);
				if (searchParams.has(par)) return searchParams.get(par) || '';
			}
			if (window.location.hash && window.location.hash.indexOf('?') !== -1) {
				var hashParams = new URLSearchParams(window.location.hash.substring(window.location.hash.indexOf('?') + 1));
				if (hashParams.has(par)) return hashParams.get(par) || '';
			}
			var match = new RegExp('(?:[?&#]|\\b)' + String(par).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&#]*)', 'i').exec(window.location.href);
			return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
		} catch (e) {
			return '';
		}
	};
}
if (typeof window.Stato !== 'function') {
	window.Stato = function (msg) {
		try {
			window.status = msg || '';
		} catch (e) { }
	};
}

// Fallback di sicurezza configurazione (da fcmInvioFormazioneDati.js)
if (typeof window.disabilitaGiornata === 'undefined') window.disabilitaGiornata = 1;
if (typeof window.disabilitaIncontri === 'undefined') window.disabilitaIncontri = 0;
if (typeof window.nascondiComunicazioni === 'undefined') window.nascondiComunicazioni = 0;
if (typeof window.scriptServer === 'undefined') window.scriptServer = "invform/invform.php";
if (typeof window.panchinaOrdinata === 'undefined') window.panchinaOrdinata = 1;
if (typeof window.regolaRigoristi === 'undefined') window.regolaRigoristi = 1;
if (typeof window.regolaPanchina === 'undefined') window.regolaPanchina = 1;
if (typeof window.primavera === 'undefined') window.primavera = 0;
if (typeof window.totaleNumeroMassimoRiserve === 'undefined') window.totaleNumeroMassimoRiserve = 10;
if (typeof window.numeroMassimoRiserve === 'undefined') window.numeroMassimoRiserve = [0, -1, -1, -1, -1];

function ifG(IDSquadra, ID, Ruolo, IDSquadraDiA, Dati) {
	this.IDSquadra = IDSquadra; this.ID = ID; this.Nome = "xg" + ID; this.Ruolo = Ruolo;
	this.IDSquadraDiA = IDSquadraDiA; this.SquadraDiA = "xa" + IDSquadraDiA;
	this.Dati = Dati; this.Formazione = 0; this.Rigorista = 0; this.NomeCode = ID;
}

// Helper di risoluzione sicura variabili FCM senza eval
function OttieniNomeGiocatore(gg) {
	if (!gg) return "";
	if (typeof gg === "string") return (typeof window[gg] !== "undefined") ? window[gg] : gg;
	var raw = gg.Nome;
	if (typeof raw === "string") {
		if (typeof window[raw] !== "undefined") return window[raw];
		return raw;
	}
	return String(raw || "");
}

function OttieniSquadraSerieA(gg) {
	if (!gg) return "";
	if (typeof gg === "string") return (typeof window[gg] !== "undefined") ? window[gg] : gg;
	var raw = gg.SquadraDiA;
	if (typeof raw === "string") {
		if (typeof window[raw] !== "undefined") return window[raw];
		return raw;
	}
	return String(raw || "");
}

// Inserimento sicuro nel DOM
function InserisciContenutoDOM(html, preferredId) {
	if (preferredId) {
		var target = document.getElementById(preferredId);
		if (target) {
			target.innerHTML = html;
			return;
		}
	}
	if (document.currentScript && document.currentScript.parentNode) {
		var temp = document.createElement("div");
		temp.innerHTML = html;
		var parent = document.currentScript.parentNode;
		while (temp.firstChild) {
			parent.insertBefore(temp.firstChild, document.currentScript);
		}
		return;
	}
	var main = document.getElementById("MainContainer") || document.body;
	if (main) {
		main.insertAdjacentHTML("beforeend", html);
	}
}

var arrRosa = [], arrFormazione = [];
var coloreRuoli = ["", "G", "V", "R", "Blu"];
var coloreDati = ["Rv", "CellaRvRosso", "CellaRvCiano", "CellaRvVerde"];
var ruoli = ["", "P", "D", "C", "A"];
var moduloInserito = [0, 0, 0, 0, 0];
var titolariInseriti = 0;
var riserveInserite = [0, 0, 0, 0, 0];
var totaleRiserveInserite = 0;
var arrRigoristi = [];
var mostraRigoristi = false, controllaRigoristi = false;
var incontriDisponibili = [], incontriGiornataPrecedente = [];
var incontroReimposta, incontroRichiama;
var idxFsq;

/* --- VARIABILI CONCEPT 1 (Campetto, Moduli & Smart Drawer) --- */
var currentInvView = (function () {
	try {
		if (typeof JSQueryString === 'function') {
			var qv = JSQueryString("view");
			if (qv === "table" || qv === "pitch" || qv === "prob") {
				localStorage.setItem("pn_invform_view", qv);
				return qv;
			}
		}
		var saved = localStorage.getItem("pn_invform_view");
		if (saved === "table" || saved === "pitch" || saved === "prob") {
			return saved;
		}
	} catch (e) { }
	return "pitch";
})();
var targetModulo = (typeof moduliAmmessi !== 'undefined' && moduliAmmessi && moduliAmmessi.length > 0) ? [0, 1, moduliAmmessi[0][2], moduliAmmessi[0][3], moduliAmmessi[0][4]] : [0, 1, 4, 3, 3]; // Modulo target predefinito
var drawerRuoloFiltro = 0; // 0 = Tutti, 1 = P, 2 = D, 3 = C, 4 = A
var drawerSearchQuery = "";
var drawerSortBy = "nome"; // "nome", "pct", "mvt", "fmt"
var drawerMode = "starter"; // "starter" o "bench"
var drawerTargetSlotRole = 0;

// Helper: estrae solo il cognome (parte MAIUSCOLA all'inizio)
function EstraiCognome(nomeCompleto) {
	if (!nomeCompleto) return "";
	var parts = nomeCompleto.trim().split(" ");
	var upperParts = [];
	for (var i = 0; i < parts.length; i++) {
		if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
			upperParts.push(parts[i]);
		} else {
			break;
		}
	}
	return upperParts.length > 0 ? upperParts.join(" ") : parts[0];
}

// Helper: estrae il numero percentuale di titolarità
function OttieniPercentualeFGNumero(id) {
	if (typeof arrPercento !== 'undefined' && arrPercento[id]) {
		return parseInt(arrPercento[id].Percentuale) || 0;
	}
	return 0;
}

// Helper: recupera l'HTML dell'iconcina di titolarità (T, P o altre) da mostrare accanto alla percentuale
function OttieniIconaTitolaritaHTML(id) {
	if (typeof PerCentoFG === 'function') {
		var imgHtml = PerCentoFG(id, 0);
		if (imgHtml) return imgHtml;
	}
	var baseImg = (typeof window !== 'undefined' && window.location && window.location.pathname.indexOf('/invform/') !== -1) ? '../img/prob_form/' : 'img/prob_form/';
	var ind = (typeof arrIndisponibili !== 'undefined' && arrIndisponibili) ? arrIndisponibili[id] : undefined;
	var pcFG = (typeof arrPercento !== 'undefined' && arrPercento) ? arrPercento[id] : undefined;

	var statoimg = "x";
	var type = 1;
	var altText = "Non titolare";

	if (pcFG) {
		var pct = parseInt(pcFG.Percentuale) || 0;
		if (pcFG.Stato == 1) {
			statoimg = "t";
			altText = "Titolare";
			type = (pct > 75) ? 1 : 2;
		} else if (pcFG.Stato == 0) {
			statoimg = "p";
			altText = "Panchina";
			type = (pct > 40) ? 1 : 2;
		}
	}

	if (ind) {
		var mot = (ind.Motivo || "").trim();
		var isSqualif = (ind.Stato == 2 || mot.toLowerCase() === 'squalificato');
		var isDubbio = (ind.Stato == 4 || mot.toLowerCase().indexOf('dubbio') !== -1);
		if (isSqualif) {
			return "<img class='infortunio' data-id='" + id + "' data-rientro='' data-motivo='Squalificato' style='border:none;vertical-align:middle;cursor:pointer;' alt='Squalificato' src='" + baseImg + "status_s.gif' height='13' width='12'/>";
		}
		var dImg = (statoimg === 't' ? 'status_d_t.gif' : (statoimg === 'p' ? 'status_d_p.gif' : 'status_d.gif'));
		var imgFile = isDubbio ? dImg : "status_i.gif";
		var alt = isDubbio ? "In dubbio" : "Infortunato";
		var motClean = (mot || alt).replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		var rieClean = (ind.Rientro || "").replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		return "<img class='infortunio' data-id='" + id + "' data-rientro=\"" + rieClean + "\" data-motivo=\"" + motClean + "\" src=\"" + baseImg + imgFile + "\" alt=\"" + alt + "\" style='vertical-align:middle;cursor:pointer;' height='13' width='12'/>";
	}

	return "<img style='border:none;vertical-align:middle;' src='" + baseImg + "status_" + statoimg + type + ".gif' alt='" + altText + "' title='" + altText + "' height='13' width='12'/>";
}

// Helper: estrae l'HTML dell'icona infortunio / dubbio / squalifica
function OttieniIconaIndisponibileHTML(id) {
	if (typeof arrIndisponibili === 'undefined' || !arrIndisponibili || !arrIndisponibili[id]) {
		return "";
	}
	var ind = arrIndisponibili[id];
	var motivo = (ind.Motivo || "").trim();
	var rientro = (ind.Rientro || "").trim();
	var stato = ind.Stato;

	var probImgBasePath = (typeof window !== 'undefined' && window.location && window.location.pathname.indexOf('/invform/') !== -1) ? '../img/prob_form/' : 'img/prob_form/';

	var iconSrc = probImgBasePath + "status_i.gif";
	var altText = "Infortunato";

	if (stato == 2 || motivo.toLowerCase() === "squalificato") {
		iconSrc = probImgBasePath + "status_s.gif";
		altText = "Squalificato";
		if (!motivo) motivo = "Squalificato";
	} else if (stato == 4 || motivo.toLowerCase().indexOf("dubbio") !== -1) {
		altText = "In dubbio";
		if (!motivo) motivo = "In dubbio";
		var statoimg = "t";
		if (typeof arrPercento !== 'undefined' && arrPercento[id]) {
			if (arrPercento[id].Stato == 0) statoimg = "p";
		}
		iconSrc = probImgBasePath + (statoimg === 't' ? "status_d_t.gif" : (statoimg === 'p' ? "status_d_p.gif" : "status_d.gif"));
	} else {
		if (!motivo) motivo = "Infortunato";
	}

	var dataMotivo = (motivo || "").replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	var dataRientro = (rientro || "").replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');

	return "<img class='infortunio' data-id=\"" + id + "\" src=\"" + iconSrc + "\" data-motivo=\"" + dataMotivo + "\" data-rientro=\"" + dataRientro + "\" alt=\"" + altText + "\" onclick='event.stopPropagation();' style='vertical-align:middle;cursor:pointer;margin-left:4px;display:inline-block;' width='13' height='12' />";
}

// Helper: recupera il percorso della foto miniatura del calciatore (con cache lookup indicizzato O(1))
var _mapFotoGiocatori = null;
function OttieniFotoGiocatore(gg) {
	if (!gg) return "img/foto/misterx.gif";
	var idGio = gg.ID || gg.NomeCode;
	if (!idGio) return "img/foto/misterx.gif";
	if (typeof arrGiocatoriA !== 'undefined' && arrGiocatoriA) {
		if (!_mapFotoGiocatori) {
			_mapFotoGiocatori = Object.create(null);
			for (var p = 1; p < arrGiocatoriA.length; p++) {
				if (arrGiocatoriA[p]) {
					_mapFotoGiocatori[arrGiocatoriA[p].ID] = arrGiocatoriA[p].Codice;
				}
			}
		}
		var cod = _mapFotoGiocatori[idGio];
		if (cod) return "img/foto/" + cod + ".jpg";
	}
	return "img/foto/misterx.gif";
}

// Helper: avversario di Serie A per la giornata
function OttieniAvversarioSerieA(gg) {
	if (typeof incontraInA !== 'undefined' && gg.IDSquadraDiA < incontraInA.length) {
		var avv = incontraInA[gg.IDSquadraDiA][cGio];
		if (avv !== undefined) {
			var inT = avv >= 100;
			var avvName = window["xa" + (avv % 100)] || "";
			if (typeof avvName === 'string') {
				if (inT) {
					// Fuori casa: solo iniziale maiuscola (es. Inter)
					avvName = avvName.split(" ").map(function (w) {
						return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
					}).join(" ");
				} else {
					// In casa: tutto MAIUSCOLO (es. INTER)
					avvName = avvName.toUpperCase();
				}
			}
			return (inT ? "@ " : "vs ") + avvName;
		}
	}
	return "";
}

// Verifica se il termine per l'invio della formazione è scaduto
function IsTermineScaduto() {
	var currentPname = (typeof pname !== 'undefined') ? pname : (document.getElementById("fi_pname") ? document.getElementById("fi_pname").value : "invform");
	if (currentPname === "invform_prec") {
		return false;
	}

	if (typeof isTermineScadutoServer !== 'undefined' && isTermineScadutoServer === true) {
		return true;
	}

	if (typeof termineInvio === 'undefined' || !termineInvio || !termineInvio.dataOraTermine) {
		return false;
	}
	if (!(termineInvio.dataOraTermine instanceof Date)) {
		termineInvio.dataOraTermine = new Date(termineInvio.dataOraTermine);
	}
	var offset = (typeof termineInvio.offsetServer === 'number') ? termineInvio.offsetServer : 0;
	var s = Math.floor((termineInvio.dataOraTermine.getTime() - new Date().getTime() - offset) / 1000);

	if (termineInvio.secondiRimasti !== null && termineInvio.secondiRimasti !== undefined && termineInvio.secondiRimasti <= 0) {
		return true;
	}
	return (s <= 0);
}

// Gestione centralizzata della scomparsa/visualizzazione degli elementi di invio
function GestisciTermineScaduto(immediato) {
	var currentPname = (typeof pname !== 'undefined') ? pname : (document.getElementById("fi_pname") ? document.getElementById("fi_pname").value : "invform");
	if (currentPname === "invform_prec") {
		return;
	}

	if (typeof ChiudiRosterDrawer === 'function') {
		ChiudiRosterDrawer();
	}

	var banner = document.getElementById("invExpiredBanner");
	if (banner) {
		banner.style.display = "flex";
		if (!immediato) {
			banner.classList.add("fade-in");
		}
	}

	var containerAttivo = document.getElementById("invioAttivoArea");
	var toggleBar = document.querySelector(".inv-view-toggle-bar");
	var viewPitch = document.getElementById("viewPitch");
	var viewTable = document.getElementById("viewTable");
	var viewProb = document.getElementById("viewProb");
	var formInvio = document.getElementById("formInvio");
	var dockSubmit = document.querySelector(".pitch-submit-dock");

	if (immediato) {
		if (containerAttivo) containerAttivo.style.display = "none";
		if (toggleBar) toggleBar.style.display = "none";
		if (viewPitch) viewPitch.style.display = "none";
		if (viewTable) viewTable.style.display = "none";
		if (viewProb) viewProb.style.display = "none";
		if (formInvio) formInvio.style.display = "none";
		if (dockSubmit) dockSubmit.style.display = "none";
	} else {
		if (containerAttivo) {
			containerAttivo.classList.add("inv-fading-out");
			setTimeout(function () {
				containerAttivo.style.display = "none";
				if (toggleBar) toggleBar.style.display = "none";
				if (viewPitch) viewPitch.style.display = "none";
				if (viewTable) viewTable.style.display = "none";
				if (viewProb) viewProb.style.display = "none";
				if (formInvio) formInvio.style.display = "none";
				if (dockSubmit) dockSubmit.style.display = "none";
			}, 350);
		} else {
			var elementsToHide = [toggleBar, viewPitch, viewTable, viewProb, formInvio, dockSubmit];
			elementsToHide.forEach(function (el) {
				if (el) {
					el.classList.add("inv-fading-out");
					setTimeout(function () {
						el.style.display = "none";
					}, 350);
				}
			});
		}
	}
}

// INTESTAZIONE SELETTORE FANTASQUADRA & GIORNATA & INCONTRI (MODERNO UNIFICATO)
function GeneraIntestazioneInvioFormazione(cFsq, cGio, pname) {
	var arrF = arrFantasquadre;
	var isDisabGio = (typeof disabilitaGiornata !== 'undefined') ? disabilitaGiornata : 1;
	var attr = isDisabGio ? "disabled" : "";

	var fsqOptions = "";
	for (var i = 1; i < arrF.length; i++) {
		var sel = (arrF[i].ID === cFsq) ? " selected" : "";
		if (arrF[i].ID === cFsq) idxFsq = i;
		fsqOptions += `<option value='${arrF[i].ID}'${sel}>${arrF[i].Nome}</option>`;
	}

	var gioOptions = "";
	for (var j = 1; j <= MaxA; j++) {
		var selG = (j === cGio) ? " selected" : "";
		gioOptions += `<option value='${j}'${selG}>${j}ª Giornata</option>`;
	}

	var html = `
<form name='frmIF' id='frmIF' action='${pname}.php' method='get'>
<input type='hidden' name='view' id='fi_current_view' value='${currentInvView}'>
<div class='inv-controls-bar' style='display:flex;flex-direction:column;gap:0;margin-bottom:16px;background:var(--bg-surface-elevated);padding:14px 18px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);box-sizing:border-box;width:100%;'>
	<div class='inv-controls-row' style='display:flex;gap:16px;flex-wrap:wrap;align-items:center;width:100%;'>
		<div class='control-group' style='display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;box-sizing:border-box;'>
			<label class='inv-form-label' for='Fsq' style='font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;'>Fantasquadra:</label>
			<select name='Fsq' class='form-select' id='Fsq' style='font-weight:700;width:100%;box-sizing:border-box;' onchange='var fv=document.getElementById("fi_current_view"); if(fv) fv.value=currentInvView; this.form.submit();'>
				${fsqOptions}
			</select>
		</div>
		<div class='control-group' style='display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;box-sizing:border-box;'>
			<label class='inv-form-label' for='Gio' style='font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;'>Giornata di Serie A:</label>
			<select name='Gio' class='form-select' id='Gio' ${attr} style='font-weight:700;width:100%;box-sizing:border-box;' onchange='var fv=document.getElementById("fi_current_view"); if(fv) fv.value=currentInvView; this.form.submit();'>
				${gioOptions}
			</select>
		</div>
	</div>
	<div id='invIncontriSection' style='width:100%;'></div>
</div>
</form>`;

	InserisciContenutoDOM(html, "invFormHeaderContainer");
}

function GeneraSelezioneCompetizioni(cFsq, cGio, pname) {
	incontriDisponibili = [];
	for (var i = 1; i < arrIncontri.length; i++)
		if (arrIncontri[i].GiornataDiA === cGio &&
			(arrIncontri[i].IDSquadre.Casa === cFsq || arrIncontri[i].IDSquadre.Fuori === cFsq) &&
			arrIncontri[i].IDTipo !== INC_RIPOSO && (arrIncontri[i].Giocato === 0 || pname === "invform_prec") && arrIncontri[i].IncAcc === 1)
			incontriDisponibili.push(i);

	// Fallback di resilienza: se non è stato trovato alcun incontro con Giocato=0 (es. archivio o calendario non ancora azzerato)
	if (incontriDisponibili.length === 0 && pname === "invform") {
		for (var i = 1; i < arrIncontri.length; i++) {
			if (arrIncontri[i].GiornataDiA === cGio &&
				(arrIncontri[i].IDSquadre.Casa === cFsq || arrIncontri[i].IDSquadre.Fuori === cFsq) &&
				arrIncontri[i].IDTipo !== INC_RIPOSO && arrIncontri[i].IncAcc === 1) {
				incontriDisponibili.push(i);
			}
		}
	}

	var incSec = document.getElementById("invIncontriSection");
	if (incontriDisponibili.length === 0) {
		if (incSec) {
			incSec.innerHTML = `
				<div class='inv-controls-divider' style='border-top:1px solid var(--border-subtle);margin:14px 0 10px 0;width:100%;'></div>
				<div style='font-size:0.85rem;color:var(--text-muted);padding:4px 0;'>Nessun incontro programmato per questa giornata.</div>
			`;
		} else {
			InserisciContenutoDOM("<div style='padding:18px; margin-bottom:16px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); text-align:center; color:var(--text-muted);'>Nessun incontro programmato per questa giornata.</div>", "invCompArea");
		}
		return false;
	}

	var hasTermine = (typeof termineInvio !== 'undefined' && termineInvio !== false && termineInvio.dataOraTermine);
	var isScadutoIniziale = false;

	if (hasTermine) {
		if (!(termineInvio.dataOraTermine instanceof Date)) {
			termineInvio.dataOraTermine = new Date(termineInvio.dataOraTermine);
		}
		termineInvio.offsetServer = (typeof termineInvio.dataOraServer !== 'undefined')
			? (new Date(termineInvio.dataOraServer) - new Date())
			: 0;
		isScadutoIniziale = IsTermineScaduto();
	} else if (typeof isTermineScadutoServer !== 'undefined' && isTermineScadutoServer === true) {
		isScadutoIniziale = true;
	}

	incontroReimposta = arrIncontri[incontriDisponibili[0]];

	var matchItemsHtml = "";
	for (i = 0; i < incontriDisponibili.length; i++) {
		var ii = arrIncontri[incontriDisponibili[i]];
		ii.Descrizione = ii.Competizione + ": " + ii.Fantagiornata;
		if (ii.IDTipo !== INC_GRANPREMIO) ii.Descrizione += " (" + ii.Nomi.Casa + " - " + ii.Nomi.Fuori + ")";
		if (ii.IDTipo === INC_ELIMDIRETTA_DIR || ii.IDTipo === INC_ELIMDIRETTA_RIT || ii.IDTipo === INC_ELIMDIRETTA_DIR_FC) {
			ii.Rigoristi = true; mostraRigoristi = true; incontroReimposta = ii;
		}
		var isDisabInc = (typeof disabilitaIncontri !== 'undefined') ? disabilitaIncontri : 0;
		var attr = (incontriDisponibili.length === 1 || isDisabInc) ? "disabled" : "";
		matchItemsHtml += `
<div class='inv-match-item' style='display:flex;align-items:center;gap:10px;padding:4px 0;'>
	<input class='inv-match-checkbox' type='checkbox' value='${incontriDisponibili[i]}' id='incontro${i + 1}' checked ${attr} onchange='AggiornaStatoRigoristi()'>
	<label for='incontro${i + 1}' style='cursor:${attr ? "default" : "pointer"};font-size:0.9rem;font-weight:700;color:var(--text-primary);margin:0;'>
		${ii.Descrizione}
	</label>
</div>`;
	}

	var incontriContentHtml = `
		<div class='inv-controls-divider' style='border-top:1px solid var(--border-subtle);margin:14px 0 10px 0;width:100%;'></div>
		<div class='inv-match-section'>
			<div class='inv-form-label' style='font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;'>Incontri in programma:</div>
			<div class='inv-match-list' style='display:flex;flex-direction:column;gap:2px;'>
				${matchItemsHtml}
			</div>
		</div>
	`;

	if (incSec) {
		incSec.innerHTML = incontriContentHtml;
	}

	var deadlineBadgeHtml = "";
	if (hasTermine || isScadutoIniziale) {
		var badgeClass = isScadutoIniziale ? "inv-deadline-badge is-expired" : "inv-deadline-badge";
		var countValClass = isScadutoIniziale ? "inv-countdown-val is-scaduto" : "inv-countdown-val";
		var countValText = isScadutoIniziale ? "SCADUTO" : "";
		var strTermine = (typeof FormattaDataOraTermineInvio === 'function') ? FormattaDataOraTermineInvio() : "";

		deadlineBadgeHtml = `
<div class='${badgeClass}' id='invDeadlineBadge' style='margin-bottom:16px; margin-top:0;'>
	<span class='inv-deadline-title'>⏱ Scadenza: ${strTermine}</span>
	<span class='${countValClass}' id='tempoRimasto' style='color:#ffffff;'>${countValText}</span>
</div>`;
	}

	// Banner informativo per termine scaduto
	var bannerStyle = isScadutoIniziale ? "display:flex;" : "display:none;";
	var strTermineBanner = (typeof FormattaDataOraTermineInvio === 'function') ? FormattaDataOraTermineInvio() : "";

	var html = `
${(!incSec) ? `<div class='inv-match-card'>${incontriContentHtml}</div>` : ''}
${deadlineBadgeHtml}
<div class='inv-expired-banner' id='invExpiredBanner' style='${bannerStyle}'>
  <div class='inv-expired-icon-wrap'>
    <svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><polyline points='12 6 12 12 16 14'></polyline></svg>
  </div>
  <div class='inv-expired-content'>
    <div class='inv-expired-title'>Termine invio formazioni scaduto</div>
    <div class='inv-expired-desc'>Il tempo limite per inviare o modificare la formazione per questa giornata è terminato${strTermineBanner ? " (" + strTermineBanner + ")" : ""}.</div>
    <div class='inv-expired-sub'>Tutte le funzioni di schieramento e invio sono state disattivate.</div>
  </div>
</div>`;

	InserisciContenutoDOM(html, "invCompArea");

	if (hasTermine) {
		if (!isScadutoIniziale) {
			AggiornaTempoRimasto();
			termineInvio.funzione = setInterval(AggiornaTempoRimasto, 1000);
		}
	}
	return true;
}

/* ==========================================================================
   GENERAZIONE INTERFACCIA: CONCEPT 1 (PITCH), TABELLA CLASSICA & DRAWER
   ========================================================================== */
function GeneraTabelleGiocatori() {
	var isScaduto = IsTermineScaduto();
	if (isScaduto && (typeof pname === 'undefined' || pname !== 'invform_prec')) {
		return;
	}

	if (typeof arrInvioFormazione === 'undefined' || !arrInvioFormazione) {
		return;
	}

	if (totaleNumeroMassimoRiserve < 0) totaleNumeroMassimoRiserve = arrRosa.length - 11;
	for (var i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++) arrFormazione[i] = arrRigoristi[i] = -1;

	// Popola arrRosa per la fantasquadra selezionata cFsq
	arrRosa = [];
	for (var g = 0; g < arrInvioFormazione.length; g++) {
		if (arrInvioFormazione[g].IDSquadra === cFsq) {
			arrRosa.push(g);
		}
	}

	var isTable = (currentInvView === "table");
	var isProb = (currentInvView === "prob");
	var isPitch = (!isTable && !isProb);

	var areaStyle = isScaduto ? "display:none;" : "display:block;";

	var isSkyEnabled = (typeof fcmModules !== 'undefined' && typeof fcmModules.hasProbabiliSky === 'function')
		? fcmModules.hasProbabiliSky()
		: (typeof ModProbabiliSky === 'undefined' || ModProbabiliSky === "Si" || ModProbabiliSky === true || ModProbabiliSky === 1 || ModProbabiliSky === "1");

	var skyBtnHtml = isSkyEnabled
		? `<button type='button' class='inv-view-toggle-btn${isProb ? " active" : ""}' id='toggleBtnProb' onclick='SwitchInvView("prob")'>
    <span class='btn-text-full'>📰 Probabili Sky</span>
    <span class='btn-text-short'>📰 Prob.</span>
  </button>`
		: "";

	var skyViewHtml = isSkyEnabled
		? `<div id='viewProb' style='display:${isProb ? "block" : "none"};'>
  <div class='inv-prob-card'>
    <div class='inv-card-header'>
      <div class='inv-card-title'>📋 Probabili Formazioni &amp; Indisponibili Serie A</div>
      <span class='inv-source-badge'>Fonte: Sky</span>
    </div>
    <iframe class='prob-iframe' scrolling='no' frameborder='0' src='probform/probhtml.htm?v=20260908_7'></iframe>
  </div>
</div>`
		: "";

	var html = `
<div id='invioAttivoArea' style='${areaStyle}'>
  <div class='inv-view-toggle-bar'>
    <button type='button' class='inv-view-toggle-btn${isPitch ? " active" : ""}' id='toggleBtnPitch' onclick='SwitchInvView("pitch")'>
      <span class='btn-text-full'>🏟️ Campetto Tattico</span>
      <span class='btn-text-short'>🏟️ Campetto</span>
    </button>
    <button type='button' class='inv-view-toggle-btn${isTable ? " active" : ""}' id='toggleBtnTable' onclick='SwitchInvView("table")'>
      <span class='btn-text-full'>📋 Tabella Dettagliata</span>
      <span class='btn-text-short'>📋 Tabella</span>
    </button>
    ${skyBtnHtml}
  </div>
  <div id='viewPitch' style='display:${isPitch ? "block" : "none"};'>
    ${GeneraCampettoTattico()}
  </div>
  <div id='viewTable' style='display:${isTable ? "block" : "none"};'>
    ${GeneraVistaClassicaTabellare()}
  </div>
  ${skyViewHtml}
  ${GeneraModalModuliHTML()}
</div>`;

	InserisciContenutoDOM(html, "invTabelleArea");

	Stato("Invio formazione");

	// Teleporta preventivamente Drawer e Modal nel target DOM a riposo (chiusi e fuori schermo)
	AssicuraDrawerInTargetDOM();

	if (isTable && typeof InizializzaQTipInfortuni === 'function') {
		setTimeout(function () {
			InizializzaQTipInfortuni('#viewTable');
		}, 60);
	}
}

/* --- SWITCH MODALITA' DI VISTA --- */
function SwitchInvView(viewName) {
	currentInvView = viewName;
	try {
		localStorage.setItem("pn_invform_view", viewName);
	} catch (e) { }

	var fiView = document.getElementById("fi_current_view");
	if (fiView) fiView.value = viewName;

	var elPitch = document.getElementById("viewPitch");
	var elTable = document.getElementById("viewTable");
	var elProb = document.getElementById("viewProb");
	var btnPitch = document.getElementById("toggleBtnPitch");
	var btnTable = document.getElementById("toggleBtnTable");
	var btnProb = document.getElementById("toggleBtnProb");

	if (elPitch) elPitch.style.display = (viewName === "pitch") ? "block" : "none";
	if (elTable) elTable.style.display = (viewName === "table") ? "block" : "none";
	if (elProb) elProb.style.display = (viewName === "prob") ? "block" : "none";

	if (btnPitch) btnPitch.classList.toggle("active", viewName === "pitch");
	if (btnTable) btnTable.classList.toggle("active", viewName === "table");
	if (btnProb) btnProb.classList.toggle("active", viewName === "prob");

	if (viewName === "pitch") {
		AggiornaCampettoTattico();
	} else if (viewName === "table") {
		VisualizzaTabellaFormazione();
		if (typeof InizializzaQTipInfortuni === 'function') {
			InizializzaQTipInfortuni('#viewTable');
		}
	} else if (viewName === "prob") {
		var ifr = document.querySelector(".prob-iframe");
		if (ifr && ifr.contentWindow) {
			try {
				ifr.contentWindow.postMessage({ type: "request-height" }, "*");
			} catch (e) { }
		}
	}
}

// Sincronizzazione dinamica altezza iframe Probabili Sky (Zero Scrollbar & No Loop)
if (typeof window !== "undefined" && window.addEventListener) {
	window.addEventListener("message", function (e) {
		if (e.data && e.data.type === "probform-height") {
			var ifr = document.querySelector(".prob-iframe");
			if (ifr && e.data.height) {
				ifr.style.height = e.data.height + "px";
			}
		}
	});
}

/* --- TOOLBAR MODULI ED AZIONI VELOCI (CONDIVISA TRA CAMPETTO E TABELLA) --- */
function GeneraToolbarModuliEAzioni() {
	var listaModuli = (typeof moduliAmmessi !== 'undefined' && moduliAmmessi && moduliAmmessi.length > 0)
		? moduliAmmessi
		: [[0, 1, 3, 4, 3], [0, 1, 3, 5, 2], [0, 1, 4, 3, 3], [0, 1, 4, 4, 2], [0, 1, 4, 5, 1], [0, 1, 5, 3, 2], [0, 1, 5, 4, 1], [0, 1, 6, 3, 1]];

	// Verifica se targetModulo e' nei moduli ammessi, altrimenti imposta il primo ammesso
	var modValido = false;
	for (var m = 0; m < listaModuli.length; m++) {
		if (targetModulo[2] === listaModuli[m][2] && targetModulo[3] === listaModuli[m][3] && targetModulo[4] === listaModuli[m][4]) {
			modValido = true;
			break;
		}
	}
	if (!modValido && listaModuli.length > 0) {
		targetModulo = [0, 1, listaModuli[0][2], listaModuli[0][3], listaModuli[0][4]];
	}

	var currentModStr = (titolariInseriti === 11)
		? (moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4])
		: (targetModulo[2] + "-" + targetModulo[3] + "-" + targetModulo[4]);

	// Visualizza SOLO il modulo selezionato; al click apre il modal di selezione con tabella disponibilità
	return `
<div class='pitch-toolbar'>
  <div class='pitch-modules-wrap'>
    <span class='pitch-modules-label'>Modulo</span>
    <button type='button' class='module-selected-badge-btn' onclick='ApriModalModuli()' title='Clicca per scegliere il modulo e visualizzare le disponibilità dei giocatori'>
      <span class='current-module-display'>${currentModStr}</span>
      <span class='mod-badge-arrow'>▾</span>
    </button>
  </div>
  <div class='pitch-quick-actions'>
    <button type='button' class='pitch-quick-btn' onclick='AutoCompilaFormazione()' title='Compila o finisce di compilare la migliore formazione possibile'>🪄 <span class='btn-text-full'>Auto-Formazione</span><span class='btn-text-short'>Auto</span></button>
    <button type='button' class='pitch-quick-btn' onclick='ReimpostaFormazione()' title='Ricarica la formazione salvata in FCM'>🔄 <span class='btn-text-full'>Reimposta</span><span class='btn-text-short'>Reimp.</span></button>
    <button type='button' class='pitch-quick-btn' onclick='RichiamaFormazione()' title='Ricarica la formazione della giornata precedente'>⏪ <span class='btn-text-full'>Richiama Prec.</span><span class='btn-text-short'>Prec.</span></button>
    <button type='button' class='pitch-quick-btn' onclick='InizializzaFormazione()' title='Svuota la formazione'>🗑️ Svuota</button>
  </div>
</div>`;
}

/* --- CALCOLO DISPONIBILITA' DEI GIOCATORI DELLA ROSA PER RUOLO ---
   Ruoli: 1 = Portieri (P), 2 = Difensori (D), 3 = Centrocampisti (C), 4 = Attaccanti (A)
   Stati: Titolari, Panchinari, Indisponibili (infortunati / squalificati)
*/
function CalcolaDisponibilitaRosa() {
	var counts = {
		titolari: { 1: 0, 2: 0, 3: 0, 4: 0 },
		panchinari: { 1: 0, 2: 0, 3: 0, 4: 0 },
		indisponibili: { 1: 0, 2: 0, 3: 0, 4: 0 }
	};
	if (typeof arrRosa === 'undefined' || !arrRosa || !arrInvioFormazione) return counts;

	for (var i = 0; i < arrRosa.length; i++) {
		var idG = arrRosa[i];
		var gg = arrInvioFormazione[idG];
		if (!gg) continue;
		var r = gg.Ruolo; // 1 = P, 2 = D, 3 = C, 4 = A
		if (r < 1 || r > 4) continue;

		var idCode = gg.NomeCode || gg.ID;
		var ind = (typeof arrIndisponibili !== 'undefined' && arrIndisponibili)
			? (arrIndisponibili[idCode] || (gg.ID ? arrIndisponibili[gg.ID] : undefined))
			: undefined;
		var pcFG = (typeof arrPercento !== 'undefined' && arrPercento)
			? (arrPercento[idCode] || (gg.ID ? arrPercento[gg.ID] : undefined))
			: undefined;

		var isIndisp = false;
		if (ind) {
			var mot = (ind.Motivo || "").toLowerCase();
			var isDubbio = (ind.Stato == 4 || mot.indexOf("dubbio") !== -1);
			if (!isDubbio) {
				isIndisp = true;
			} else {
				var pct = pcFG ? (parseInt(pcFG.Percentuale) || 0) : 0;
				if (pct === 0) isIndisp = true;
			}
		}

		if (isIndisp) {
			counts.indisponibili[r]++;
		} else if (pcFG && pcFG.Stato == 1) {
			counts.titolari[r]++;
		} else {
			counts.panchinari[r]++;
		}
	}
	return counts;
}

/* --- HELPER ACCESSO ELEMENTI DRAWER & MODAL (STANDALONE VS IFRAME SPA) --- */
function $drawer(id) {
	if (typeof window !== "undefined" && window.top && window.top !== window.self) {
		try {
			if (window.top.document) {
				var el = window.top.document.getElementById(id);
				if (el) return el;
			}
		} catch (e) { }
	}
	return document.getElementById(id);
}

/* Sincronizza l'albero DOM e i gestori eventi se la pagina risiede in un iframe SPA */
function AssicuraDrawerInTargetDOM() {
	var isIframe = (typeof window !== "undefined" && window.top && window.top !== window.self);
	if (!isIframe) return;

	try {
		var targetDoc = window.top.document;
		if (!targetDoc || !targetDoc.body) return;

		// 1. Inietta style.css nel documento parent se non ancora presente
		if (!targetDoc.getElementById("modernfcm-injected-css") && !targetDoc.querySelector('link[href*="style.css"]')) {
			var link = targetDoc.createElement("link");
			link.id = "modernfcm-injected-css";
			link.rel = "stylesheet";
			link.href = "css/style.css";
			targetDoc.head.appendChild(link);
		}

		// 2. Esporta i metodi globali su window.top per delegare i click/change dal documento parent
		window.top.ChiudiRosterDrawer = ChiudiRosterDrawer;
		window.top.ImpostaFiltroRuoloDrawer = ImpostaFiltroRuoloDrawer;
		window.top.ImpostaRicercaDrawer = ImpostaRicercaDrawer;
		window.top.ImpostaOrdinamentoDrawer = ImpostaOrdinamentoDrawer;
		window.top.ClickGiocatoreDrawer = ClickGiocatoreDrawer;
		window.top.ChiudiModalModuli = ChiudiModalModuli;
		window.top.SelezionaModuloDaModal = SelezionaModuloDaModal;

		// 3. Sposta backdrop e sheet nel body del parent se non sono già lì
		var backdrop = targetDoc.getElementById("rosterDrawerBackdrop") || document.getElementById("rosterDrawerBackdrop");
		var sheet = targetDoc.getElementById("rosterDrawerSheet") || document.getElementById("rosterDrawerSheet");
		if (backdrop && backdrop.parentNode !== targetDoc.body) {
			var oldB = targetDoc.getElementById("rosterDrawerBackdrop");
			if (oldB && oldB.parentNode) oldB.parentNode.removeChild(oldB);
			backdrop.classList.remove("open");
			targetDoc.adoptNode(backdrop);
			targetDoc.body.appendChild(backdrop);
		} else if (!backdrop) {
			backdrop = targetDoc.createElement("div");
			backdrop.className = "roster-drawer-backdrop";
			backdrop.id = "rosterDrawerBackdrop";
			backdrop.onclick = function () { if (typeof ChiudiRosterDrawer === 'function') ChiudiRosterDrawer(); };
			targetDoc.body.appendChild(backdrop);
		}

		if (sheet && sheet.parentNode !== targetDoc.body) {
			sheet.classList.remove("open", "sheet-expanded");
			sheet.style.transform = "";
			var oldS = targetDoc.getElementById("rosterDrawerSheet");
			if (oldS && oldS.parentNode) oldS.parentNode.removeChild(oldS);
			targetDoc.adoptNode(sheet);
			targetDoc.body.appendChild(sheet);
			void sheet.offsetWidth; // Consolidates initial off-screen closed position in top window
		} else if (!sheet && typeof GeneraRosterDrawer === 'function') {
			var tempDiv = targetDoc.createElement("div");
			tempDiv.innerHTML = GeneraRosterDrawer();
			sheet = tempDiv.firstElementChild;
			if (sheet) {
				sheet.classList.remove("open", "sheet-expanded");
				targetDoc.body.appendChild(sheet);
				void sheet.offsetWidth;
			}
		}

		// 4. Sposta backdrop e dialog del modal moduli nel body del parent se non sono già lì
		var mBackdrop = targetDoc.getElementById("moduleModalBackdrop") || document.getElementById("moduleModalBackdrop");
		var mDialog = targetDoc.getElementById("moduleModalDialog") || document.getElementById("moduleModalDialog");
		if (mBackdrop && mBackdrop.parentNode !== targetDoc.body) {
			var oldMB = targetDoc.getElementById("moduleModalBackdrop");
			if (oldMB && oldMB.parentNode) oldMB.parentNode.removeChild(oldMB);
			mBackdrop.classList.remove("open");
			targetDoc.adoptNode(mBackdrop);
			targetDoc.body.appendChild(mBackdrop);
		} else if (!mBackdrop) {
			mBackdrop = targetDoc.createElement("div");
			mBackdrop.className = "module-modal-backdrop";
			mBackdrop.id = "moduleModalBackdrop";
			mBackdrop.onclick = function () { if (typeof ChiudiModalModuli === 'function') ChiudiModalModuli(); };
			targetDoc.body.appendChild(mBackdrop);
		}

		if (mDialog && mDialog.parentNode !== targetDoc.body) {
			mDialog.classList.remove("open");
			var oldMD = targetDoc.getElementById("moduleModalDialog");
			if (oldMD && oldMD.parentNode) oldMD.parentNode.removeChild(oldMD);
			targetDoc.adoptNode(mDialog);
			targetDoc.body.appendChild(mDialog);
			void mDialog.offsetWidth;
		} else if (!mDialog && typeof GeneraModalModuliHTML === 'function') {
			var tempM = targetDoc.createElement("div");
			tempM.innerHTML = GeneraModalModuliHTML();
			var foundDialog = tempM.querySelector("#moduleModalDialog");
			if (foundDialog) {
				foundDialog.classList.remove("open");
				targetDoc.body.appendChild(foundDialog);
				void foundDialog.offsetWidth;
			}
		}

		if (!targetDoc._invformEscAttached) {
			targetDoc._invformEscAttached = true;
			targetDoc.addEventListener("keydown", function (e) {
				if (e.key === "Escape" || e.keyCode === 27) {
					if (typeof ChiudiModalModuli === "function") ChiudiModalModuli();
					if (typeof ChiudiRosterDrawer === "function") ChiudiRosterDrawer();
				}
			});
		}
	} catch (e) { }
}

// Pulizia quando la pagina invform viene scaricata nella SPA (usa pagehide anziché unload per Permissions-Policy)
if (typeof window !== "undefined" && window.addEventListener) {
	var unloadEvt = ("onpagehide" in window) ? "pagehide" : "beforeunload";
	window.addEventListener(unloadEvt, function () {
		try {
			if (window.top && window.top !== window.self && window.top.document) {
				var ids = ["rosterDrawerBackdrop", "rosterDrawerSheet", "moduleModalBackdrop", "moduleModalDialog"];
				for (var i = 0; i < ids.length; i++) {
					var el = window.top.document.getElementById(ids[i]);
					if (el && el.parentNode) el.parentNode.removeChild(el);
				}
				window.top.document.body.classList.remove("drawer-open", "modal-open");
				window.top.document.documentElement.classList.remove("drawer-open", "modal-open");
				window.top.document.body.style.overflow = "";
				window.top.document.documentElement.style.overflow = "";
			}
		} catch (e) { }
	});
}

/* --- HTML STRUTTURA MODAL SELEZIONE MODULO & DISPONIBILITA' --- */
function GeneraModalModuliHTML() {
	return `
<div class='module-modal-backdrop' id='moduleModalBackdrop' onclick='ChiudiModalModuli()'></div>
<div class='module-modal-dialog' id='moduleModalDialog' role='dialog' aria-labelledby='moduleModalTitle' aria-modal='true'>
  <div class='module-modal-header'>
    <div class='module-modal-title' id='moduleModalTitle'>
      <span style='font-size:1.15rem;'>📐</span>
      <span>Modulo &amp; Disponibilità</span>
    </div>
    <button type='button' class='module-modal-close' onclick='ChiudiModalModuli()' aria-label='Chiudi'>&times;</button>
  </div>
  <div class='module-modal-body'>
    <div class='mod-section'>
      <div class='mod-section-header'>
        <span class='mod-section-title'>Seleziona Modulo di Gioco</span>
      </div>
      <div id='moduleModalPickerGrid' class='module-modal-picker-grid'></div>
    </div>
    <div class='mod-section' style='margin-top:16px;'>
      <div class='mod-section-header'>
        <span class='mod-section-title'>Disponibilità Giocatori in Rosa</span>
      </div>
      <div id='moduleAvailTableWrapper' class='module-avail-wrapper'></div>
    </div>
  </div>
</div>`;
}

/* --- APERTURA E CHIUSURA MODAL SELEZIONE MODULO --- */
function ApriModalModuli() {
	AssicuraDrawerInTargetDOM();

	var dialog = $drawer("moduleModalDialog");
	var backdrop = $drawer("moduleModalBackdrop");
	if (!dialog || !backdrop) return;

	// 1. Popola pulsanti dei moduli ammessi
	var pickerGrid = $drawer("moduleModalPickerGrid");
	if (pickerGrid) {
		var listaModuli = (typeof moduliAmmessi !== 'undefined' && moduliAmmessi && moduliAmmessi.length > 0)
			? moduliAmmessi
			: [[0, 1, 3, 4, 3], [0, 1, 3, 5, 2], [0, 1, 4, 3, 3], [0, 1, 4, 4, 2], [0, 1, 4, 5, 1], [0, 1, 5, 3, 2], [0, 1, 5, 4, 1], [0, 1, 6, 3, 1]];
		var currentModStr = (titolariInseriti === 11)
			? (moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4])
			: (targetModulo[2] + "-" + targetModulo[3] + "-" + targetModulo[4]);
		var gHtml = "";
		for (var m = 0; m < listaModuli.length; m++) {
			var modObj = listaModuli[m];
			var modStr = modObj[2] + "-" + modObj[3] + "-" + modObj[4];
			var isActive = (modStr === currentModStr) ? " active" : "";
			gHtml += "<button type='button' class='module-chip" + isActive + "' data-mod='" + modStr + "' onclick='SelezionaModuloDaModal(" + modObj[2] + "," + modObj[3] + "," + modObj[4] + ")'>" + modStr + "</button>";
		}
		pickerGrid.innerHTML = gHtml;
	}

	// 2. Calcola disponibilità e genera tabella con ruoli P D C A
	var counts = CalcolaDisponibilitaRosa();
	var tableWrapper = $drawer("moduleAvailTableWrapper");
	if (tableWrapper) {
		tableWrapper.innerHTML = `
			<table class='mod-avail-table'>
				<thead>
					<tr>
						<th class='mod-th-blank'></th>
						<th class='mod-th-col'><span class='mod-role-badge role-badge-p' title='Portieri'>P</span></th>
						<th class='mod-th-col'><span class='mod-role-badge role-badge-d' title='Difensori'>D</span></th>
						<th class='mod-th-col'><span class='mod-role-badge role-badge-c' title='Centrocampisti'>C</span></th>
						<th class='mod-th-col'><span class='mod-role-badge role-badge-a' title='Attaccanti'>A</span></th>
					</tr>
				</thead>
				<tbody>
					<tr>
				    	<td class='mod-row-label mod-row-tit'><span class='mod-status-dot dot-tit'></span><span>Titolari</span></td>
				    	<td class='mod-num-cell'>${counts.titolari[1]}</td>
				    	<td class='mod-num-cell'>${counts.titolari[2]}</td>
				    	<td class='mod-num-cell'>${counts.titolari[3]}</td>
				    	<td class='mod-num-cell'>${counts.titolari[4]}</td>
					</tr>
					<tr>
					    <td class='mod-row-label mod-row-panc'><span class='mod-status-dot dot-panc'></span><span>Panchinari</span></td>
				    	<td class='mod-num-cell'>${counts.panchinari[1]}</td>
				    	<td class='mod-num-cell'>${counts.panchinari[2]}</td>
				    	<td class='mod-num-cell'>${counts.panchinari[3]}</td>
				    	<td class='mod-num-cell'>${counts.panchinari[4]}</td>
					</tr>
					<tr>
					    <td class='mod-row-label mod-row-ind'><span class='mod-status-dot dot-ind'></span><span>Indisponibili</span></td>
				    	<td class='mod-num-cell cell-indisp'>${counts.indisponibili[1]}</td>
				    	<td class='mod-num-cell cell-indisp'>${counts.indisponibili[2]}</td>
				    	<td class='mod-num-cell cell-indisp'>${counts.indisponibili[3]}</td>
				    	<td class='mod-num-cell cell-indisp'>${counts.indisponibili[4]}</td>
					</tr>
				</tbody>
			</table>
		`;
	}

	dialog.style.top = "";
	dialog.style.left = "";
	backdrop.classList.add("open");
	dialog.classList.add("open");

	if (document.body) {
		document.body.classList.add("modal-open");
		document.body.style.overflow = "hidden";
	}
	try {
		if (window.top && window.top !== window.self && window.top.document && window.top.document.body) {
			window.top.document.body.classList.add("modal-open");
			window.top.document.body.style.overflow = "hidden";
		}
	} catch (e) { }
}

function ChiudiModalModuli() {
	var dialog = $drawer("moduleModalDialog");
	var backdrop = $drawer("moduleModalBackdrop");
	if (dialog) {
		dialog.classList.remove("open");
		dialog.style.top = "";
		dialog.style.left = "";
	}
	if (backdrop) backdrop.classList.remove("open");

	if (document.body) {
		document.body.classList.remove("modal-open");
		document.body.style.overflow = "";
	}
	try {
		if (window.top && window.top !== window.self && window.top.document && window.top.document.body) {
			window.top.document.body.classList.remove("modal-open");
			window.top.document.body.style.overflow = "";
		}
	} catch (e) { }
}

function SelezionaModuloDaModal(d, c, a) {
	ImpostaModuloTattico(d, c, a);
	var modStr = d + "-" + c + "-" + a;
	var displays = document.querySelectorAll(".current-module-display");
	displays.forEach(function (el) { el.textContent = modStr; });
	ChiudiModalModuli();
}

/* --- GENERAZIONE VISTA CAMPETTO TATTICO (CONCEPT 1) --- */
function GeneraCampettoTattico() {
	var svgLines = (typeof fcmDataLoader !== 'undefined' && typeof fcmDataLoader.getPitchSvgLines === 'function')
		? fcmDataLoader.getPitchSvgLines()
		: `<svg class='pitch-svg-lines' viewBox='0 0 770 1210' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
        <rect x='35' y='55' width='700' height='1100' fill='none' stroke='currentColor' stroke-width='2.5' />
        <line x1='35' y1='605' x2='735' y2='605' stroke='currentColor' stroke-width='2.5' />
        <circle cx='385' cy='605' r='91.5' fill='none' stroke='currentColor' stroke-width='2.5' />
        <circle cx='385' cy='605' r='4' fill='currentColor' />
        <rect x='185' y='55' width='400' height='165' fill='none' stroke='currentColor' stroke-width='2.5' />
        <rect x='330' y='55' width='110' height='55' fill='none' stroke='currentColor' stroke-width='2.5' />
        <circle cx='385' cy='165' r='4' fill='currentColor' />
        <path d='M 311.88,220 A 91.5,91.5 0 0,0 458.12,220' fill='none' stroke='currentColor' stroke-width='2.5' />
        <rect x='185' y='990' width='400' height='165' fill='none' stroke='currentColor' stroke-width='2.5' />
        <rect x='330' y='1100' width='110' height='55' fill='none' stroke='currentColor' stroke-width='2.5' />
        <circle cx='385' cy='1045' r='4' fill='currentColor' />
        <path d='M 311.88,990 A 91.5,91.5 0 0,1 458.12,990' fill='none' stroke='currentColor' stroke-width='2.5' />
        <rect x='348.4' y='30.6' width='73.2' height='24.4' fill='rgba(255,255,255,0.08)' stroke='currentColor' stroke-width='2.5' />
        <line x1='366.7' y1='30.6' x2='366.7' y2='55' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='385' y1='30.6' x2='385' y2='55' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='403.3' y1='30.6' x2='403.3' y2='55' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='348.4' y1='42.8' x2='421.6' y2='42.8' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <rect x='348.4' y='1155' width='73.2' height='24.4' fill='rgba(255,255,255,0.08)' stroke='currentColor' stroke-width='2.5' />
        <line x1='366.7' y1='1155' x2='366.7' y2='1179.4' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='385' y1='1155' x2='385' y2='1179.4' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='403.3' y1='1155' x2='403.3' y2='1179.4' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <line x1='348.4' y1='1167.2' x2='421.6' y2='1167.2' stroke='currentColor' stroke-width='1' opacity='0.35' />
        <path d='M 35,65 A 10,10 0 0,0 45,55' fill='none' stroke='currentColor' stroke-width='2.5' />
        <path d='M 725,55 A 10,10 0 0,0 735,65' fill='none' stroke='currentColor' stroke-width='2.5' />
        <path d='M 45,1155 A 10,10 0 0,0 35,1145' fill='none' stroke='currentColor' stroke-width='2.5' />
        <path d='M 735,1145 A 10,10 0 0,0 725,1155' fill='none' stroke='currentColor' stroke-width='2.5' />
      </svg>`;

	var isGkRuleActive = (typeof regolaRigoristi !== 'undefined' && Number(regolaRigoristi) === 1);
	var gkSubDesc = isGkRuleActive ? "Portiere dall'11° posto in poi (regola attiva)" : "Portiere libero di tirare nei primi 10 (regola disattivata)";

	return `
		<div class='tactical-pitch-card'>
			${GeneraToolbarModuliEAzioni()}
			<div class='roster-drawer-backdrop' id='rosterDrawerBackdrop' onclick='ChiudiRosterDrawer()'></div>
			<div class='tactical-stage-wrapper' id='tacticalStageWrapper'>
				<div class='pitch-container' id='pitchContainer'>
					<div class='pitch-field' id='pitchField'>
						${svgLines}
						<div class='pitch-row pitch-row-p' id='pitchRowP'></div>
						<div class='pitch-row pitch-row-d' id='pitchRowD'></div>
						<div class='pitch-row pitch-row-c' id='pitchRowC'></div>
						<div class='pitch-row pitch-row-a' id='pitchRowA'></div>
					</div>
				</div>
				<div class='dugout-card' id='dugoutCard'>
					<div class='dugout-header'>
						<div class='dugout-title'>
							<span>🪑 Panchina &amp; Riserve</span>
							<span class='badge badge-secondary' id='dugoutCountBadge' style='font-size:0.75rem;padding:2px 8px;'>0/10</span>
						</div>
						<div class='dugout-header-actions'>
					        <button type='button' class='pitch-quick-btn' onclick='AutoCompilaPanchina()' style='padding:5px 12px;font-size:0.75rem;' title='Compila automaticamente le riserve mancanti'>🪄 <span class='btn-text-full'>Auto-Panchina</span><span class='btn-text-short'>Auto</span></button>
						<button type='button' class='pitch-quick-btn' onclick='SvuotaPanchina()' style='padding:5px 12px;font-size:0.75rem;' title='Svuota tutte le riserve dalla panchina'>🗑️ <span class='btn-text-full'>Svuota panchina</span><span class='btn-text-short'>Svuota</span></button>
					</div>
    			</div>
				<div class='dugout-grid' id='dugoutGrid'></div>
			</div>
		</div>
			<div class='penalty-takers-card' id='penaltyTakersCard' style='display:${mostraRigoristi ? "block" : "none"};'>
				<div class='penalty-card-header'>
					<div class='penalty-card-title-group'>
						<div class='penalty-card-title'>🎯 Sequenza Rigoristi &bull; Match a Eliminazione Diretta</div>
      					<div class='penalty-card-subtitle' id='penaltyCardSubtitle'>Titolari (1-11, primi 5 decisivi ⭐) &bull; Riserve (12+) &bull; ${gkSubDesc}</div>
    				</div>
    				<div class='penalty-card-actions'>
      					<button type='button' class='inv-action-btn' onclick='RipristinaRigoristiPredefiniti()' style='padding:5px 12px;font-size:0.75rem;' title='Ripristina sequenza predefinita (Attaccanti &rarr; Portiere all&apos;11°)'>🔄 Reset Sequenza</button>
    				</div>
  				</div>
  				<div id='penaltyGkWarning' class='penalty-gk-warning' style='display:none;'>
    					⚠️ <b>Attenzione:</b> Il portiere non può essere compreso tra i primi 10 rigoristi (regola ufficiale FCM attiva). Spostalo all'11° posto o successivo.
  				</div>
  				<div class='penalty-takers-grid' id='penaltyTakersGrid'></div>
			</div>
			${GeneraRosterDrawer()}
		</div>`;
}

/* --- SELEZIONE MODULO TATTICO --- */
function ImpostaModuloTattico(d, c, a) {
	if (Array.isArray(d)) {
		if (d.length === 5) {
			a = d[4]; c = d[3]; d = d[2];
		} else if (d.length === 3) {
			a = d[2]; c = d[1]; d = d[0];
		}
	}
	d = Number(d);
	c = Number(c);
	a = Number(a);

	var targetRoles = { 2: d, 3: c, 4: a };

	// Se ci sono giocatori in eccesso in qualunque reparto rispetto al nuovo modulo,
	// rimuovi i giocatori in eccesso partendo dall'ultimo titolare inserito nel reparto
	for (var r = 4; r >= 2; r--) {
		var maxAllowed = targetRoles[r];
		while (moduloInserito[r] > maxAllowed) {
			var removed = false;
			for (var i = 11; i >= 1; i--) {
				var idG = arrFormazione[i];
				if (idG >= 0 && arrInvioFormazione[idG] && arrInvioFormazione[idG].Ruolo === r) {
					var gg = arrInvioFormazione[idG];
					RimuoviTitolare(gg);
					CambiaAttributiGiocatoreRosa(idG, false);
					removed = true;
					break;
				}
			}
			if (!removed) break;
		}
	}

	targetModulo = [0, 1, d, c, a];
	var chips = document.querySelectorAll(".module-chip");
	if (chips && chips.forEach) {
		chips.forEach(function (ch) {
			var isCurrent = ch.getAttribute("data-mod") === (d + "-" + c + "-" + a);
			if (ch.classList && ch.classList.toggle) ch.classList.toggle("active", isCurrent);
		});
	}
	AggiornaCampettoTattico();
	VisualizzaTabellaFormazione();
}

/* --- SINCRONIZZAZIONE ED AGGIORNAMENTO GRAFICO DEL CAMPETTO --- */
function AggiornaCampettoTattico() {
	var rowA = document.getElementById("pitchRowA");
	var rowC = document.getElementById("pitchRowC");
	var rowD = document.getElementById("pitchRowD");
	var rowP = document.getElementById("pitchRowP");
	if (!rowA || !rowC || !rowD || !rowP) return;

	var titolari = { 1: [], 2: [], 3: [], 4: [] };
	for (var i = 1; i <= 11; i++) {
		var idG = arrFormazione[i];
		if (idG >= 0 && arrInvioFormazione[idG]) {
			var gg = arrInvioFormazione[idG];
			titolari[gg.Ruolo].push({ idG: idG, gg: gg, pos: i });
		}
	}

	var numP = 1;
	var numD, numC, numA;

	if (titolariInseriti === 11) {
		// Formazione completa (11 titolari inseriti): sincronizza tassativamente il targetModulo con gli 11 in campo (zero slot vuoti aggiuntivi)
		targetModulo = [0, 1, titolari[2].length, titolari[3].length, titolari[4].length];
		numD = titolari[2].length;
		numC = titolari[3].length;
		numA = titolari[4].length;
	} else {
		// Formazione incompleta (< 11 titolari): calcola slot vuoti per raggiungere targetModulo senza MAI superare 11 slot totali
		var emptyP = Math.max(0, 1 - titolari[1].length);
		var emptyD = Math.max(0, targetModulo[2] - titolari[2].length);
		var emptyC = Math.max(0, targetModulo[3] - titolari[3].length);
		var emptyA = Math.max(0, targetModulo[4] - titolari[4].length);
		var totInCampo = titolari[1].length + titolari[2].length + titolari[3].length + titolari[4].length;
		var maxEmptyPermessi = Math.max(0, 11 - totInCampo);

		while ((emptyP + emptyD + emptyC + emptyA) > maxEmptyPermessi && (emptyD > 0 || emptyC > 0 || emptyA > 0)) {
			if (emptyD > 0 && (titolari[2].length + emptyD) > targetModulo[2]) { emptyD--; }
			else if (emptyC > 0 && (titolari[3].length + emptyC) > targetModulo[3]) { emptyC--; }
			else if (emptyA > 0 && (titolari[4].length + emptyA) > targetModulo[4]) { emptyA--; }
			else if (emptyA > 0) { emptyA--; }
			else if (emptyC > 0) { emptyC--; }
			else if (emptyD > 0) { emptyD--; }
		}

		numD = titolari[2].length + emptyD;
		numC = titolari[3].length + emptyC;
		numA = titolari[4].length + emptyA;
	}

	rowP.innerHTML = GeneraSlotRigaCampo(1, numP, titolari[1]);
	rowD.innerHTML = GeneraSlotRigaCampo(2, numD, titolari[2]);
	rowC.innerHTML = GeneraSlotRigaCampo(3, numC, titolari[3]);
	rowA.innerHTML = GeneraSlotRigaCampo(4, numA, titolari[4]);

	AggiornaDugout();
	AggiornaRigoristiCampetto();

	var currentModStr = (titolariInseriti === 11) ? (moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4]) : (targetModulo[2] + "-" + targetModulo[3] + "-" + targetModulo[4]);
	var chips = document.querySelectorAll(".module-chip");
	chips.forEach(function (ch) {
		ch.classList.toggle("active", ch.getAttribute("data-mod") === currentModStr);
	});
	var modDisplays = document.querySelectorAll(".current-module-display");
	modDisplays.forEach(function (el) {
		el.textContent = currentModStr;
	});

	if (typeof InizializzaQTipInfortuni === 'function') {
		InizializzaQTipInfortuni('.tactical-pitch-card');
	}
}

function GeneraSlotRigaCampo(ruolo, numSlots, titolariArray) {
	var html = "";
	var rLabel = ruoli[ruolo];
	for (var i = 0; i < numSlots; i++) {
		if (i < titolariArray.length) {
			var item = titolariArray[i];
			var gg = item.gg;
			var cognome = EstraiCognome(OttieniNomeGiocatore(gg));
			var sq = OttieniSquadraSerieA(gg);
			var pct = OttieniPercentualeFGNumero(gg.NomeCode);
			var pctClass = pct >= 70 ? "pct-high" : (pct >= 45 ? "pct-mid" : "pct-low");
			var photoUrl = OttieniFotoGiocatore(gg);
			var iconaIndisp = OttieniIconaIndisponibileHTML(gg.NomeCode);
			var iconaTit = OttieniIconaTitolaritaHTML(gg.NomeCode);

			var rigHtml = "";
			if (mostraRigoristi) {
				var rig = (typeof arrRigoristi[item.pos] !== 'undefined' && arrRigoristi[item.pos] > 0) ? arrRigoristi[item.pos] : (11 - item.pos + 1);
				var isTop5 = (rig <= 5);
				var isGkRuleActive = (typeof regolaRigoristi !== 'undefined' && Number(regolaRigoristi) === 1);
				var isGkWarn = (isGkRuleActive && gg.Ruolo === 1 && rig < 11);
				var badgeCls = "slot-player-rig" + (isTop5 ? " is-decisive" : "") + (isGkWarn ? " is-gk-warn" : "");
				var opts = "";
				for (var k = 1; k <= 11; k++) {
					opts += `<option value='${k}'${k === rig ? " selected" : ""}>#${k}${k <= 5 ? " ⭐" : ""}</option>`;
				}
				rigHtml = `
    <div class='${badgeCls}' onclick='event.stopPropagation();' title='Rigorista #${rig}${isTop5 ? " (Tiratore Decisivo ⭐)" : ""}${isGkWarn ? " ⚠️ Portiere deve tirare dall&apos;11° in poi" : ""}'>
      <span class='rig-badge-label'>🎯 #${rig}${isTop5 ? " ⭐" : ""}</span>
      <select class='slot-rig-select' title='Cambia ordine rigorista' onchange='event.stopPropagation(); CambiaRigorista(${item.pos}, this.value);'>${opts}</select>
    </div>`;
			}

			html += `
<div class='pitch-slot' data-idg='${item.idG}' onclick='ApriRosterDrawer(${ruolo}, "starter")'>
  <div class='pitch-slot-filled' data-idg='${item.idG}'>
    <button type='button' class='slot-remove-btn' title='Rimuovi ${cognome}' onclick='event.stopPropagation(); ClickGiocatoreFormazione(${item.pos});'>✕</button>
    <div class='slot-header-top'>
      <img class='slot-player-jersey' src='img/live/sq/${sq}.png' width='16' height='16' onerror='this.src="img/sq/undefined.svg"'>
      <span class='slot-role-badge role-${rLabel}'>${rLabel}</span>
    </div>
    <div class='slot-photo-wrap' data-idg='${item.idG}'>
      <img class='slot-player-photo' src='${photoUrl}' onerror='this.src="img/foto/misterx.gif"' alt='${cognome}'>
    </div>
    <div class='slot-player-name'><span>${cognome}</span></div>
    <div class='slot-player-team'>${sq}</div>
    <div class='slot-player-pct ${pctClass}'>${iconaTit}<span>${pct}%</span></div>
    ${rigHtml}
  </div>
</div>`;
		} else {
			html += `
<div class='pitch-slot' onclick='ApriRosterDrawer(${ruolo}, "starter")'>
  <div class='pitch-slot-empty'>
    <span class='pitch-slot-empty-role role-${rLabel}'>${rLabel}</span>
    <span class='pitch-slot-empty-plus' title='Schiera'>+</span>
  </div>
</div>`;
		}
	}
	return html;
}

function AggiornaDugout() {
	var dugoutGrid = document.getElementById("dugoutGrid");
	var countBadge = document.getElementById("dugoutCountBadge");
	if (!dugoutGrid) return;

	var html = "";
	var count = 0;
	for (var pos = 12; pos <= 11 + totaleNumeroMassimoRiserve; pos++) {
		var num = pos - 11;
		var idG = arrFormazione[pos];
		if (idG >= 0 && arrInvioFormazione[idG]) {
			count++;
			var gg = arrInvioFormazione[idG];
			var cognome = EstraiCognome(OttieniNomeGiocatore(gg));
			var sq = OttieniSquadraSerieA(gg);
			var rLabel = ruoli[gg.Ruolo];
			var pct = OttieniPercentualeFGNumero(gg.NomeCode);
			var pctClass = pct >= 70 ? "pct-high" : (pct >= 45 ? "pct-mid" : "pct-low");
			var photoUrl = OttieniFotoGiocatore(gg);
			var iconaIndisp = OttieniIconaIndisponibileHTML(gg.NomeCode);
			var iconaTit = OttieniIconaTitolaritaHTML(gg.NomeCode);

			var rigHtml = "";
			if (mostraRigoristi) {
				var rig = (typeof arrRigoristi[pos] !== 'undefined' && arrRigoristi[pos] > 0) ? arrRigoristi[pos] : pos;
				var isTop5 = (rig <= 5);
				var isGkRuleActive = (typeof regolaRigoristi !== 'undefined' && Number(regolaRigoristi) === 1);
				var isGkWarn = (isGkRuleActive && gg.Ruolo === 1 && rig < 11);
				var badgeCls = "slot-player-rig" + (isTop5 ? " is-decisive" : "") + (isGkWarn ? " is-gk-warn" : "");
				var opts = "";
				for (var k = 12; k <= 11 + totaleNumeroMassimoRiserve; k++) {
					opts += `<option value='${k}'${k === rig ? " selected" : ""}>#${k}</option>`;
				}
				rigHtml = `
    <div class='${badgeCls}' onclick='event.stopPropagation();' title='Rigorista #${rig}'>
      <span class='rig-badge-label'>🎯 #${rig}</span>
      <select class='slot-rig-select' title='Cambia ordine rigorista' onchange='event.stopPropagation(); CambiaRigorista(${pos}, this.value);'>${opts}</select>
    </div>`;
			}

			html += `
<div class='pitch-slot dugout-slot' data-idg='${idG}' onclick='ApriRosterDrawer(${gg.Ruolo}, "bench")'>
  <div class='pitch-slot-filled dugout-slot-filled' data-idg='${idG}'>
    <span class='dugout-order-badge' title='Ordine riserva #${num}'>#${num}</span>
    <button type='button' class='slot-remove-btn' title='Rimuovi ${cognome} dalla panchina' onclick='event.stopPropagation(); ClickGiocatoreFormazione(${pos});'>✕</button>
    <div class='slot-header-top'>
      <img class='slot-player-jersey' src='img/live/sq/${sq}.png' width='16' height='16' onerror='this.src="img/sq/undefined.svg"'>
      <span class='slot-role-badge role-${rLabel}'>${rLabel}</span>
    </div>
    <div class='slot-photo-wrap' data-idg='${idG}'>
      <img class='slot-player-photo' src='${photoUrl}' onerror='this.src="img/foto/misterx.gif"' alt='${cognome}'>
    </div>
    <div class='slot-player-name'><span>${cognome}</span></div>
    <div class='slot-player-team'>${sq}</div>
    <div class='slot-player-pct ${pctClass}'>${iconaTit}<span>${pct}%</span></div>
    ${rigHtml}
  </div>
</div>`;
		} else {
			html += `
<div class='pitch-slot dugout-slot' onclick='ApriRosterDrawer(0, "bench")' title='Aggiungi Riserva #${num}'>
  <div class='pitch-slot-empty dugout-slot-empty'>
    <span class='dugout-order-badge'>#${num}</span>
    <span class='pitch-slot-empty-plus' title='Aggiungi'>+</span>
    <span class='dugout-empty-text'>Riserva</span>
  </div>
</div>`;
		}
	}
	dugoutGrid.innerHTML = html;
	if (countBadge) countBadge.textContent = count + "/10";
}

/* ==========================================================================
   TOOLTIP STATISTICHE GIOCATORE CAMPETTO TATTICO DESKTOP (STILE PROBHTML SKY)
   ========================================================================== */
var _tacticalTooltipEl = null;
var _tacticalTooltipTimeout = null;

function AssicuraTooltipTattico() {
	if (!_tacticalTooltipEl) {
		_tacticalTooltipEl = document.getElementById("tacticalPlayerTooltip");
		if (!_tacticalTooltipEl) {
			_tacticalTooltipEl = document.createElement("div");
			_tacticalTooltipEl.id = "tacticalPlayerTooltip";
			document.body.appendChild(_tacticalTooltipEl);
		}
	}
	return _tacticalTooltipEl;
}

function CostruisciContenutoTooltipGiocatore(idG) {
	if (typeof arrInvioFormazione === 'undefined' || !arrInvioFormazione[idG]) return "";
	var gg = arrInvioFormazione[idG];

	var nomeCompleto = OttieniNomeGiocatore(gg);
	var sq = OttieniSquadraSerieA(gg);
	var rCode = ruoli[gg.Ruolo];
	var ruoloEsteso = (gg.Ruolo === 1 ? "Portiere" : (gg.Ruolo === 2 ? "Difensore" : (gg.Ruolo === 3 ? "Centrocampista" : "Attaccante")));

	var dati = (gg.Dati || "").split("%");
	var affVal = (dati[0] && dati[0] !== "---" && dati[0] !== "sv/ng") ? dati[0] : (gg.Affidabilita || "---");
	var aff = (affVal !== "---" && String(affVal).indexOf("%") === -1) ? (affVal + "%") : affVal;

	var mv = (dati[2] && dati[2] !== "sv/ng" && dati[2] !== "---") ? dati[2] : "sv/ng";
	var fm = (dati[4] && dati[4] !== "sv/ng" && dati[4] !== "---") ? dati[4] : "sv/ng";
	var mu = (dati[6] && dati[6] !== "sv/ng" && dati[6] !== "---") ? dati[6] : "sv/ng";
	var fu = (dati[8] && dati[8] !== "sv/ng" && dati[8] !== "---") ? dati[8] : "sv/ng";

	var avvStr = OttieniAvversarioSerieA(gg) || "---";
	var pct = OttieniPercentualeFGNumero(gg.NomeCode);
	var iconaTit = OttieniIconaTitolaritaHTML(gg.NomeCode);
	var photoUrl = OttieniFotoGiocatore(gg);
	var crestUrl = "img/live/sq/" + sq + ".png";

	var indInfo = "";
	if (typeof arrIndisponibili !== 'undefined' && arrIndisponibili && arrIndisponibili[gg.NomeCode]) {
		var ind = arrIndisponibili[gg.NomeCode];
		var mot = ind.Motivo || "";
		var rie = ind.Rientro || "";
		var indLabel = (ind.Stato == 2 || mot.toLowerCase().indexOf("squalif") !== -1) ? "Squalificato" : (mot || "Indisponibile");
		if (rie) indLabel += " (" + rie + ")";
		indInfo = `<div class='tooltip-ind-alert'>⚠️ ${indLabel}</div>`;
	}

	var photoBoxHtml = (photoUrl && photoUrl !== "img/foto/misterx.gif")
		? `<div class='tooltip-photo-box' title='Foto ${nomeCompleto}'>
      <img class='tooltip-photo-img' src='${photoUrl}' onerror='this.src="img/foto/misterx.gif"' alt='${nomeCompleto}' />
    </div>`
		: "";

	return `
<div class='tooltip-header'>
  <div class='tooltip-player-name'>${nomeCompleto}</div>
</div>
<hr class='tooltip-divider'>
<div class='tooltip-body'>
  <div class='tooltip-visuals'>
    ${photoBoxHtml}
  </div>
  <div class='tooltip-content'>
    <table class='tooltip-table'>
      <tr><td class='label'>🎽 Ruolo:</td><td class='val-strong'><span class='slot-role-badge role-${rCode}'>${rCode}</span></td></tr>
      <tr><td class='label'>🛡️ Squadra:</td><td class='val-strong'><img class='tooltip-crest-mini' src='${crestUrl}' onerror='this.style.display="none"' /> ${sq}</td></tr>
      <tr><td class='label'>⚔️ Avversario:</td><td class='val-strong'>${avvStr}</td></tr>
      <tr><td class='label'>📊 Percentuale:</td><td><span class='tooltip-pct-badge'>${iconaTit} ${pct}%</span></td></tr>
      <tr><td class='label'>🎯 Affidabilità (Aff):</td><td><b>${aff}</b></td></tr>
      <tr><td class='label'>⭐ Media Voto (MV):</td><td class='val-mv'><b>${mv}</b></td></tr>
      <tr><td class='label'>⚡ FantaMedia (FM):</td><td class='val-fm'><b>${fm}</b></td></tr>
      <tr><td class='label'>📈 Media Ultima (MU):</td><td><b>${mu}</b></td></tr>
      <tr><td class='label'>🔥 FantaM. Ultima (FU):</td><td><b>${fu}</b></td></tr>
    </table>
  </div>
</div>
${indInfo}`;
}

function PosizionaTooltipTattico(e) {
	var tip = AssicuraTooltipTattico();
	if (!tip || !e) return;

	var tipWidth = tip.offsetWidth || 320;
	var tipHeight = tip.offsetHeight || 260;

	var clientX = (e.clientX !== undefined) ? e.clientX : (e.pageX - (window.pageXOffset || 0));
	var clientY = (e.clientY !== undefined) ? e.clientY : (e.pageY - (window.pageYOffset || 0));

	var padding = 12;
	var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
	var viewportHeight = window.innerHeight || document.documentElement.clientHeight;

	var maxRight = viewportWidth - padding;
	var minLeft = padding;

	var left = clientX + 14;
	if (left + tipWidth > maxRight) {
		left = clientX - tipWidth - 14;
		if (left < minLeft) {
			left = minLeft;
		}
	}

	var top = clientY + 12;
	if (top + tipHeight + 16 > viewportHeight) {
		top = clientY - tipHeight - 12;
		if (top < 12) {
			top = 12;
		}
	}

	tip.style.left = Math.round(left) + "px";
	tip.style.top = Math.round(top) + "px";
}

function MostraTooltipTattico(e, idG) {
	if (window.innerWidth <= 768) return;
	if (typeof arrInvioFormazione === 'undefined' || !arrInvioFormazione[idG]) return;

	if (_tacticalTooltipTimeout) {
		clearTimeout(_tacticalTooltipTimeout);
		_tacticalTooltipTimeout = null;
	}

	var tip = AssicuraTooltipTattico();
	tip.innerHTML = CostruisciContenutoTooltipGiocatore(idG);
	tip.style.display = "block";
	tip.classList.add("show");
	PosizionaTooltipTattico(e);
}

function NascondiTooltipTattico() {
	var tip = AssicuraTooltipTattico();
	if (!tip) return;
	if (_tacticalTooltipTimeout) clearTimeout(_tacticalTooltipTimeout);
	_tacticalTooltipTimeout = setTimeout(function () {
		tip.classList.remove("show");
		setTimeout(function () {
			if (!tip.classList.contains("show")) {
				tip.style.display = "none";
			}
		}, 180);
	}, 60);
}

// Inizializzazione Listener Tooltip Campetto Tattico
(function () {
	if (typeof window === 'undefined') return;

	var currentHoveredPhoto = null;

	document.addEventListener("mouseover", function (e) {
		if (window.innerWidth <= 768) return;
		var photoWrap = e.target.closest ? e.target.closest(".slot-photo-wrap") : null;
		if (photoWrap && photoWrap !== currentHoveredPhoto) {
			currentHoveredPhoto = photoWrap;
			var idG = photoWrap.getAttribute("data-idg");
			if (!idG) {
				var parentSlot = photoWrap.closest ? photoWrap.closest("[data-idg]") : null;
				if (parentSlot) idG = parentSlot.getAttribute("data-idg");
			}
			if (idG !== null && idG !== undefined && idG !== "") {
				var idNum = parseInt(idG, 10);
				if (!isNaN(idNum) && idNum >= 0) {
					MostraTooltipTattico(e, idNum);
				}
			}
		}
	});

	document.addEventListener("mousemove", function (e) {
		if (window.innerWidth <= 768) return;
		if (currentHoveredPhoto) {
			PosizionaTooltipTattico(e);
		}
	});

	document.addEventListener("mouseout", function (e) {
		if (window.innerWidth <= 768) return;
		if (currentHoveredPhoto) {
			var related = e.relatedTarget;
			if (!related || !currentHoveredPhoto.contains(related)) {
				currentHoveredPhoto = null;
				NascondiTooltipTattico();
			}
		}
	});

	window.addEventListener("scroll", function () {
		currentHoveredPhoto = null;
		NascondiTooltipTattico();
	}, { passive: true });

	window.addEventListener("resize", function () {
		currentHoveredPhoto = null;
		NascondiTooltipTattico();
	}, { passive: true });
})();

/* --- CALCOLO PUNTEGGIO QUALITA' TOP GIOCATORE ---
   Ordine di priorità:
   1. Percentuale disponibilità / titolarità (se il modulo ModIndisponibili è attivo)
   2. Fantamedia (FMT)
   3. Media voto (MVT)
   4. Affidabilità (Aff)
*/
function CalcolaPunteggioTopGiocatore(gg) {
	if (!gg) return -999999;

	// Verifica se il modulo disponibilità è attivo
	var isModIndispAttivo = false;
	if (typeof arrPercento !== 'undefined' && arrPercento && Object.keys(arrPercento).length > 0) {
		isModIndispAttivo = true;
	}
	if (typeof ModIndisponibili !== 'undefined' && (ModIndisponibili === "No" || ModIndisponibili === false || ModIndisponibili === 0 || ModIndisponibili === "0")) {
		isModIndispAttivo = false;
	}

	// Estrazione dati FCM dal campo Dati (formato: "Aff%flag%MVT%flag%FMT%flag%MVU%flag%FMU")
	var dati = (gg.Dati || "").split("%");
	var aff = parseFloat(dati[0]) || 0;
	if (isNaN(aff) && gg.Affidabilita) aff = parseFloat(gg.Affidabilita) || 0;

	var mvt = (dati[2] && dati[2] !== "sv/ng" && dati[2] !== "---") ? parseFloat(dati[2]) : 0;
	if (isNaN(mvt)) mvt = 0;

	var fmt = (dati[4] && dati[4] !== "sv/ng" && dati[4] !== "---") ? parseFloat(dati[4]) : 0;
	if (isNaN(fmt)) fmt = 0;

	if (isModIndispAttivo) {
		var pct = OttieniPercentualeFGNumero(gg.NomeCode);
		var ind = (typeof arrIndisponibili !== 'undefined' && arrIndisponibili) ? arrIndisponibili[gg.NomeCode] : undefined;

		var isSqualificato = false;
		var isInfortunatoGrave = false;
		if (ind) {
			var mot = (ind.Motivo || "").toLowerCase();
			if (ind.Stato == 2 || mot === "squalificato" || mot.indexOf("squalif") !== -1) {
				isSqualificato = true;
			} else if (ind.Stato == 3) {
				isInfortunatoGrave = true;
			}
		}

		if (isSqualificato || isInfortunatoGrave || pct === 0) {
			// Giocatore non schierabile: punteggio negativo estremo
			return -100000 + (fmt * 10) + (mvt * 2) + (aff * 0.05);
		}

		// Fasce di titolarità
		var tierBonus = 0;
		if (pct >= 60) {
			tierBonus = 20000; // Titolare quasi certo / elevata probabilità
		} else if (pct >= 40) {
			tierBonus = 10000; // Ballottaggio aperto
		} else {
			tierBonus = 1000;  // Panchinaro
		}

		return tierBonus + (pct * 10) + (fmt * 100) + (mvt * 25) + (aff * 0.5);
	}

	// Se il modulo disponibilità non è attivo: Fantamedia > Media Voto > Affidabilità
	return (fmt * 100) + (mvt * 25) + (aff * 0.5);
}

/* --- COMPILAZIONE PANCHINA BILANCIATA ---
   Garantisce almeno:
   - 1 Portiere
   - 2 Difensori
   - 2 Centrocampisti
   - 2 Attaccanti
   Poi riempie i restanti posti (fino a 10) con i migliori rimasti in rosa
*/
function CompilaPanchinaBilanciata() {
	if (totaleRiserveInserite >= totaleNumeroMassimoRiserve) return;

	// Fase 1: Quote minime di bilanciamento (1 P, 2 D, 2 C, 2 A)
	var quoteMinime = [0, 1, 2, 2, 2];

	for (var r = 1; r <= 4; r++) {
		var needed = quoteMinime[r] - riserveInserite[r];
		if (needed > 0 && totaleRiserveInserite < totaleNumeroMassimoRiserve) {
			var candidati = [];
			for (var i = 0; i < arrRosa.length; i++) {
				var idG = arrRosa[i];
				var gg = arrInvioFormazione[idG];
				if (gg && gg.Ruolo === r && gg.Formazione === 0) {
					candidati.push({ idG: idG, gg: gg, score: CalcolaPunteggioTopGiocatore(gg) });
				}
			}
			candidati.sort(function (a, b) {
				return b.score - a.score;
			});

			for (var k = 0; k < candidati.length; k++) {
				if (needed <= 0 || totaleRiserveInserite >= totaleNumeroMassimoRiserve) break;
				var cand = candidati[k];
				if (numeroMassimoRiserve[r] >= 0 && riserveInserite[r] >= numeroMassimoRiserve[r]) break;
				if (InserisciRiserva(cand.gg, cand.idG)) {
					CambiaAttributiGiocatoreRosa(cand.idG, true);
					needed--;
				}
			}
		}
	}

	// Fase 2: Completa i posti restanti della panchina (fino al massimo) con i migliori assoluti
	if (totaleRiserveInserite < totaleNumeroMassimoRiserve) {
		var rimanenti = [];
		for (var j = 0; j < arrRosa.length; j++) {
			var idGr = arrRosa[j];
			var ggr = arrInvioFormazione[idGr];
			if (ggr && ggr.Formazione === 0) {
				rimanenti.push({ idG: idGr, gg: ggr, score: CalcolaPunteggioTopGiocatore(ggr) });
			}
		}
		rimanenti.sort(function (a, b) {
			return b.score - a.score;
		});

		for (var m = 0; m < rimanenti.length; m++) {
			if (totaleRiserveInserite >= totaleNumeroMassimoRiserve) break;
			var item = rimanenti[m];
			if (item.gg.Formazione === 0) {
				if (numeroMassimoRiserve[item.gg.Ruolo] >= 0 && riserveInserite[item.gg.Ruolo] >= numeroMassimoRiserve[item.gg.Ruolo]) continue;
				if (InserisciRiserva(item.gg, item.idG)) {
					CambiaAttributiGiocatoreRosa(item.idG, true);
				}
			}
		}
	}
}

/* --- FUNZIONE AUTO-COMPILA PANCHINA --- */
function AutoCompilaPanchina() {
	if (titolariInseriti < 11) {
		alert("Prima di completare la panchina, schiera gli 11 titolari sul campo (" + titolariInseriti + "/11 attualmente inseriti).");
		return;
	}

	CompilaPanchinaBilanciata();

	if (mostraRigoristi) {
		RipristinaRigoristiPredefiniti();
	} else {
		VisualizzaTabellaFormazione();
		AggiornaCampettoTattico();
	}

	if (typeof AggiornaListaDrawer === 'function') {
		var drawerSheet = document.getElementById("rosterDrawerSheet");
		if (drawerSheet && drawerSheet.classList.contains("open")) {
			AggiornaListaDrawer();
		}
	}
}

/* --- FUNZIONE AUTO-COMPILA FORMAZIONE (TOP FORMAZIONE) ---
   Compila (o finisce di compilare se già inserito qualche giocatore)
   i titolari per il modulo selezionato (senza alterarlo)
   e la panchina bilanciata (almeno 1 P, 2 D, 2 C, 2 A + restanti migliori).
*/
function AutoCompilaFormazione() {
	var modTarget = targetModulo;
	if (!modTarget || modTarget.length < 5) {
		modTarget = [0, 1, 3, 4, 3];
	}

	// 1. Completa i titolari mancanti per il modulo selezionato (senza alterarlo)
	for (var r = 1; r <= 4; r++) {
		var needed = modTarget[r] - moduloInserito[r];
		if (needed > 0) {
			var candidati = [];
			for (var i = 0; i < arrRosa.length; i++) {
				var idG = arrRosa[i];
				var gg = arrInvioFormazione[idG];
				if (gg && gg.Ruolo === r && gg.Formazione === 0) {
					candidati.push({ idG: idG, gg: gg, score: CalcolaPunteggioTopGiocatore(gg) });
				}
			}
			candidati.sort(function (a, b) {
				return b.score - a.score;
			});

			for (var k = 0; k < candidati.length; k++) {
				if (needed <= 0 || titolariInseriti >= 11) break;
				var cand = candidati[k];
				if (InserisciTitolare(cand.gg, cand.idG)) {
					CambiaAttributiGiocatoreRosa(cand.idG, true);
					needed--;
				}
			}
		}
	}

	// 2. Compila la panchina bilanciata
	CompilaPanchinaBilanciata();

	// 3. Sincronizzazione rigoristi e viste
	if (mostraRigoristi) {
		RipristinaRigoristiPredefiniti();
	} else {
		VisualizzaTabellaFormazione();
		AggiornaCampettoTattico();
	}

	if (typeof AggiornaListaDrawer === 'function') {
		var drawerSheet = document.getElementById("rosterDrawerSheet");
		if (drawerSheet && drawerSheet.classList.contains("open")) {
			AggiornaListaDrawer();
		}
	}
}

/* --- FUNZIONE SVUOTA PANCHINA --- */
function SvuotaPanchina() {
	for (var i = 12; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		var idG = arrFormazione[i];
		arrFormazione[i] = -1;
		if (idG >= 0 && arrInvioFormazione[idG]) {
			arrInvioFormazione[idG].Formazione = 0;
			arrInvioFormazione[idG].Rigorista = 0;
			CambiaAttributiGiocatoreRosa(idG, false);
		}
		if (mostraRigoristi) {
			var el = document.getElementById("f_rigorista" + i);
			if (el) {
				arrRigoristi[i] = i;
				el.value = arrRigoristi[i];
			}
		}
	}
	riserveInserite = [0, 0, 0, 0, 0];
	totaleRiserveInserite = 0;
	VisualizzaTabellaFormazione();
	if (typeof AggiornaCampettoTattico === 'function') {
		AggiornaCampettoTattico();
	}
	if (typeof AggiornaListaDrawer === 'function') {
		var drawerSheet = $drawer("rosterDrawerSheet");
		if (drawerSheet && drawerSheet.classList.contains("open")) {
			AggiornaListaDrawer();
		}
	}
}

/* --- ROSTER DRAWER (DESKTOP: MENU LATERALE A SINISTRA / MOBILE: BOTTOM SHEET) --- */
function GeneraRosterDrawer() {
	return `
	<div class='roster-drawer-sheet' id='rosterDrawerSheet' role='dialog' aria-modal='true' aria-labelledby='rosterDrawerTitle'>
		<!-- Drag handle mobile (per trascinare e richiudere verso il basso o espandere a tutta altezza) -->
		<div class='roster-drag-handle-bar' id='rosterDragHandleBar'>
			<div class='roster-drag-handle'></div>
		</div>
		<div class='roster-drawer-header' id='rosterDrawerHeader'>
			<div class='roster-drawer-title-row'>
				<div class='roster-drawer-title' id='rosterDrawerTitle'>⚽ Scegli Calciatore</div>
				<button type='button' class='roster-drawer-close' onclick='ChiudiRosterDrawer()' aria-label='Chiudi'>&times;</button>
			</div>
			<div class='roster-filter-row' id='rosterFilterRow'>
				<button type='button' class='roster-filter-pill active' id='rfp0' onclick='ImpostaFiltroRuoloDrawer(0)'>Tutti</button>
				<button type='button' class='roster-filter-pill pill-role-p' id='rfp1' onclick='ImpostaFiltroRuoloDrawer(1)'><span class='pill-lbl-full'>Portieri</span><span class='pill-lbl-short'>Por</span></button>
				<button type='button' class='roster-filter-pill pill-role-d' id='rfp2' onclick='ImpostaFiltroRuoloDrawer(2)'><span class='pill-lbl-full'>Difensori</span><span class='pill-lbl-short'>Dif</span></button>
				<button type='button' class='roster-filter-pill pill-role-c' id='rfp3' onclick='ImpostaFiltroRuoloDrawer(3)'><span class='pill-lbl-full'>Centrocampisti</span><span class='pill-lbl-short'>Cen</span></button>
				<button type='button' class='roster-filter-pill pill-role-a' id='rfp4' onclick='ImpostaFiltroRuoloDrawer(4)'><span class='pill-lbl-full'>Attaccanti</span><span class='pill-lbl-short'>Att</span></button>
			</div>
			<div class='roster-search-sort-row' style='display:flex;gap:8px;align-items:center;'>
				<input type='text' id='rosterSearchInput' class='roster-search-input' placeholder='🔍 Cerca calciatore o squadra...' oninput='ImpostaRicercaDrawer(this.value)'>
				<select id='rosterSortSelect' class='inv-select' style='max-width:130px;padding:8px 8px;font-size:0.75rem;' onchange='ImpostaOrdinamentoDrawer(this.value)'>
					<option value='nome' selected>Nome A-Z</option>
					<option value='pct'>% Titolarità</option>
					<option value='aff'>% Affidabilità (Aff)</option>
					<option value='mvt'>MVoto</option>
					<option value='fmt'>FMedia</option>
					<option value='mu'>MVoto Ultima (MU)</option>
					<option value='fu'>FMedia Ultima (FU)</option>
				</select>
			</div>
		</div>
		<div class='roster-player-list' id='rosterPlayerList'></div>
		<div class='roster-drawer-footer' id='rosterDrawerFooter'>
			<button type='button' class='inv-action-btn' onclick='ChiudiRosterDrawer()'>Chiudi</button>
		</div>
	</div>
	`;
}

function AggiornaTitoloDrawer() {
	var titleEl = $drawer("rosterDrawerTitle");
	if (!titleEl) return;
	var rNum = Number(drawerRuoloFiltro) || 0;

	if (drawerMode === "starter") {
		if (rNum === 1) titleEl.textContent = "🧤 Scegli Portiere";
		else if (rNum === 2) titleEl.textContent = "🛡️ Scegli Difensore";
		else if (rNum === 3) titleEl.textContent = "⚙️ Scegli Centrocampista";
		else if (rNum === 4) titleEl.textContent = "⚽ Scegli Attaccante";
		else titleEl.textContent = "⚽ Scegli Calciatore Titolare";
	} else {
		if (rNum === 1) titleEl.textContent = "🧤 Scegli Riserva: Portiere";
		else if (rNum === 2) titleEl.textContent = "🛡️ Scegli Riserva: Difensore";
		else if (rNum === 3) titleEl.textContent = "⚙️ Scegli Riserva: Centrocampista";
		else if (rNum === 4) titleEl.textContent = "⚽ Scegli Riserva: Attaccante";
		else titleEl.textContent = "🪑 Scegli Giocatore per la Panchina";
	}
}

function ApriRosterDrawer(ruolo, mode) {
	if (typeof NascondiTooltipTattico === 'function') NascondiTooltipTattico();
	if (mode === "bench" || mode === "starter") {
		drawerMode = mode;
	} else {
		drawerMode = (ruolo !== undefined && ruolo !== null && ruolo > 0 && titolariInseriti < 11) ? "starter" : "bench";
	}

	if (drawerMode === "starter") {
		drawerRuoloFiltro = (ruolo !== undefined && ruolo !== null && ruolo > 0) ? ruolo : 1;
	} else {
		drawerRuoloFiltro = (ruolo !== undefined && ruolo !== null) ? ruolo : 0;
	}
	drawerTargetSlotRole = ruolo || 0;

	// Teleporta gli elementi nel body parent (se in iframe) prima di interagire
	AssicuraDrawerInTargetDOM();

	// Reset ordinamento su 'Nome A-Z' e svuota ricerca per apertura pulita
	drawerSortBy = "nome";
	var sortSelect = $drawer("rosterSortSelect");
	if (sortSelect) sortSelect.value = "nome";

	drawerSearchQuery = "";
	var searchInput = $drawer("rosterSearchInput");
	if (searchInput) searchInput.value = "";

	var filterRow = $drawer("rosterFilterRow");
	if (filterRow) {
		filterRow.style.display = (drawerMode === "starter") ? "none" : "flex";
	}

	AggiornaTitoloDrawer();

	for (var r = 0; r <= 4; r++) {
		var btn = $drawer("rfp" + r);
		if (btn) btn.classList.toggle("active", r === drawerRuoloFiltro);
	}

	AggiornaListaDrawer();

	var backdrop = $drawer("rosterDrawerBackdrop");
	var sheet = $drawer("rosterDrawerSheet");
	if (!sheet) {
		console.warn("Roster drawer sheet non trovato");
		return;
	}

	var pitchContainer = document.querySelector(".pitch-container") || document.getElementById("pitchContainer");
	var listEl = $drawer("rosterPlayerList");

	if (listEl) listEl.scrollTop = 0;
	if (pitchContainer) pitchContainer.classList.add("drawer-open");
	if (backdrop) {
		backdrop.classList.add("open");
		backdrop.style.position = "";
		backdrop.style.top = "";
		backdrop.style.bottom = "";
		backdrop.style.left = "";
		backdrop.style.right = "";
		backdrop.style.width = "";
		backdrop.style.height = "";
		backdrop.onwheel = function (e) { e.preventDefault(); };
		backdrop.ontouchmove = function (e) { e.preventDefault(); };
	}

	if (document.body) {
		document.body.classList.add("drawer-open", "modal-open");
		document.body.style.overflow = "hidden";
	}
	if (document.documentElement) {
		document.documentElement.classList.add("drawer-open", "modal-open");
		document.documentElement.style.overflow = "hidden";
	}
	try {
		if (window.top && window.top.document && window.top.document.body) {
			window.top.document.body.classList.add("drawer-open", "modal-open");
			window.top.document.documentElement.classList.add("drawer-open", "modal-open");
			window.top.document.body.style.overflow = "hidden";
			window.top.document.documentElement.style.overflow = "hidden";
			window.top.document.body.style.touchAction = "none";
		}
	} catch (e) { }

	sheet.classList.remove("sheet-expanded");
	sheet.style.position = "";
	sheet.style.top = "";
	sheet.style.bottom = "";
	sheet.style.left = "";
	sheet.style.right = "";
	sheet.style.width = "";
	sheet.style.height = "";
	sheet.style.transform = "";
	void sheet.offsetWidth; // Consolidates off-screen position before opening
	sheet.classList.add("open");
	InizializzaGestiMobileDrawer();
}

/* Sincronizzazione dinamica posizione del Drawer: con CSS fixed su window.top il browser gestisce tutto nativamente */
function SincronizzaPosizioneViewportDrawer() {
	var sheet = $drawer("rosterDrawerSheet");
	var backdrop = $drawer("rosterDrawerBackdrop");
	if (!sheet) return;
	sheet.style.position = "";
	sheet.style.top = "";
	sheet.style.bottom = "";
	sheet.style.left = "";
	sheet.style.right = "";
	sheet.style.width = "";
	if (!sheet.classList.contains("sheet-expanded")) {
		sheet.style.height = "";
	}
	if (backdrop) {
		backdrop.style.position = "";
		backdrop.style.top = "";
		backdrop.style.bottom = "";
		backdrop.style.left = "";
		backdrop.style.right = "";
		backdrop.style.width = "";
		backdrop.style.height = "";
	}
}

/* Gestione dei gesti touch mobile: trascinamento verso il basso per chiudere, scroll per espandere */
function InizializzaGestiMobileDrawer() {
	var sheet = $drawer("rosterDrawerSheet");
	var handleBar = $drawer("rosterDragHandleBar");
	var header = $drawer("rosterDrawerHeader");
	var list = $drawer("rosterPlayerList");
	if (!sheet || sheet._touchInitialized) return;
	sheet._touchInitialized = true;

	var startY = 0;
	var currentDeltaY = 0;
	var isDragging = false;
	var isHandleDrag = false;

	function onTouchStart(e) {
		var isMob = (typeof window !== "undefined" && (window.innerWidth <= 768 || (window.top && window.top.innerWidth <= 768)));
		if (!isMob) return;
		var touch = e.touches[0];
		startY = touch.clientY;
		currentDeltaY = 0;
		isDragging = false;
		isHandleDrag = (handleBar && handleBar.contains(e.target)) || (header && header.contains(e.target));
	}

	function onTouchMove(e) {
		var isMob = (typeof window !== "undefined" && (window.innerWidth <= 768 || (window.top && window.top.innerWidth <= 768)));
		if (!isMob) return;
		var touch = e.touches[0];
		var deltaY = touch.clientY - startY;

		// 1. Se stiamo trascinando dall'handle o dall'header
		if (isHandleDrag) {
			if (deltaY > 0) {
				// Trascinamento verso il basso (per richiudere)
				isDragging = true;
				currentDeltaY = deltaY;
				sheet.style.transition = "none";
				sheet.style.transform = "translateY(" + deltaY + "px)";
				if (e.cancelable) e.preventDefault();
			} else if (deltaY < -20 && !sheet.classList.contains("sheet-expanded")) {
				// Trascinamento verso l'alto: espandi a tutta altezza
				sheet.classList.add("sheet-expanded");
			}
			return;
		}

		// 2. Se l'utente scorre la lista verso l'alto o verso il basso
		if (list && list.contains(e.target)) {
			if (deltaY < -15 && !sheet.classList.contains("sheet-expanded")) {
				sheet.classList.add("sheet-expanded");
			} else if (list.scrollTop <= 0 && deltaY > 15) {
				isDragging = true;
				currentDeltaY = deltaY;
				sheet.style.transition = "none";
				sheet.style.transform = "translateY(" + deltaY + "px)";
				if (e.cancelable) e.preventDefault();
			}
		}
	}

	function onTouchEnd(e) {
		var isMob = (typeof window !== "undefined" && (window.innerWidth <= 768 || (window.top && window.top.innerWidth <= 768)));
		if (!isMob) return;
		sheet.style.transition = "";
		if (isDragging) {
			if (currentDeltaY > 75) {
				// Richiudi completamente portando verso il basso
				sheet.style.transform = "translateY(100%)";
				setTimeout(ChiudiRosterDrawer, 220);
			} else {
				// Ritorna in posizione aperta normale
				sheet.style.transform = "translateY(0)";
			}
			isDragging = false;
			currentDeltaY = 0;
		}
	}

	sheet.addEventListener("touchstart", onTouchStart, { passive: true });
	sheet.addEventListener("touchmove", onTouchMove, { passive: false });
	sheet.addEventListener("touchend", onTouchEnd, { passive: true });

	// Espandi a tutta altezza non appena si scorre la lista
	if (list) {
		list.addEventListener("scroll", function () {
			var isMob = (typeof window !== "undefined" && (window.innerWidth <= 768 || (window.top && window.top.innerWidth <= 768)));
			if (isMob && list.scrollTop > 8 && !sheet.classList.contains("sheet-expanded")) {
				sheet.classList.add("sheet-expanded");
			}
		}, { passive: true });
	}
}

function CalcolaDimensioniDrawer() {
	SincronizzaPosizioneViewportDrawer();
}

function ChiudiRosterDrawer() {
	var backdrop = $drawer("rosterDrawerBackdrop");
	var sheet = $drawer("rosterDrawerSheet");
	var pitchContainer = document.querySelector(".pitch-container") || document.getElementById("pitchContainer");
	var tacticalCard = document.querySelector(".tactical-pitch-card");

	if (pitchContainer) pitchContainer.classList.remove("drawer-open");
	if (backdrop) backdrop.classList.remove("open");
	if (tacticalCard) tacticalCard.style.minHeight = "";
	if (sheet) {
		sheet.classList.remove("open");
		sheet.classList.remove("sheet-expanded");
		sheet.style.transform = "";
		sheet.style.height = "";
		sheet.style.top = "";
		sheet.style.bottom = "";
		sheet.style.left = "";
		sheet.style.right = "";
		sheet.style.width = "";
		sheet.style.position = "";
	}

	if (document.body) {
		document.body.classList.remove("drawer-open", "modal-open");
		document.body.style.overflow = "";
		document.body.style.minHeight = "";
	}
	if (document.documentElement) {
		document.documentElement.classList.remove("drawer-open", "modal-open");
		document.documentElement.style.overflow = "";
	}
	try {
		if (window.top && window.top.document && window.top.document.body) {
			window.top.document.body.classList.remove("drawer-open", "modal-open");
			window.top.document.documentElement.classList.remove("drawer-open", "modal-open");
			window.top.document.body.style.overflow = "";
			window.top.document.documentElement.style.overflow = "";
			window.top.document.body.style.touchAction = "";
		}
	} catch (e) { }
}

function ImpostaFiltroRuoloDrawer(r) {
	drawerRuoloFiltro = r;
	for (var i = 0; i <= 4; i++) {
		var btn = $drawer("rfp" + i);
		if (btn) btn.classList.toggle("active", i === r);
	}
	AggiornaTitoloDrawer();
	AggiornaListaDrawer();
}

function ImpostaRicercaDrawer(q) {
	drawerSearchQuery = q;
	AggiornaListaDrawer();
}

function ImpostaOrdinamentoDrawer(s) {
	drawerSortBy = s;
	AggiornaListaDrawer();
}

// Listener globale per il resize della finestra e tasto ESC
window.addEventListener("resize", function () {
	var sheet = $drawer("rosterDrawerSheet");
	if (sheet && sheet.classList.contains("open")) {
		SincronizzaPosizioneViewportDrawer();
	}
});

document.addEventListener("keydown", function (e) {
	if (e.key === "Escape" || e.keyCode === 27) {
		if (typeof ChiudiModalModuli === "function") ChiudiModalModuli();
		if (typeof ChiudiRosterDrawer === "function") ChiudiRosterDrawer();
	}
});

function FormattaStatValore(numVal, rawVal) {
	if (rawVal === "sv/ng") return "sv/ng";
	if (typeof numVal === 'number' && !isNaN(numVal) && numVal > 0) {
		return numVal.toFixed(2);
	}
	if (rawVal && rawVal !== "0" && rawVal !== "") {
		var p = parseFloat(rawVal);
		if (!isNaN(p) && p > 0) return p.toFixed(2);
		return rawVal;
	}
	return "-";
}

function AggiornaListaDrawer() {
	var listEl = $drawer("rosterPlayerList");
	if (!listEl) return;

	var query = (drawerSearchQuery || "").toLowerCase().trim();
	var items = [];

	for (var i = 0; i < arrRosa.length; i++) {
		var idG = arrRosa[i];
		var gg = arrInvioFormazione[idG];
		if (!gg) continue;

		if (drawerRuoloFiltro > 0 && gg.Ruolo !== drawerRuoloFiltro) continue;

		var nome = OttieniNomeGiocatore(gg);
		var sq = OttieniSquadraSerieA(gg);

		if (query && !nome.toLowerCase().includes(query) && !sq.toLowerCase().includes(query)) {
			continue;
		}

		var pct = OttieniPercentualeFGNumero(gg.NomeCode);
		var dati = (gg.Dati || "").split("%");
		var rawAff = dati[0] || "";
		var aff = parseInt(rawAff) || 0;
		var affVal = (rawAff !== "" && rawAff !== undefined) ? (rawAff + "%") : "-";
		var mvt = parseFloat(dati[2]) || 0;
		var fmt = parseFloat(dati[4]) || 0;
		var mu = parseFloat(dati[6]) || 0;
		var fu = parseFloat(dati[8]) || 0;
		var clMvt = parseInt(dati[3]) || 0;
		var clFmt = parseInt(dati[5]) || 0;
		var clMu = parseInt(dati[7]) || 0;
		var clFu = parseInt(dati[9]) || 0;

		items.push({
			idG: idG,
			gg: gg,
			nome: nome,
			cognome: EstraiCognome(nome),
			sq: sq,
			pct: pct,
			aff: aff,
			rawAff: rawAff,
			affVal: affVal,
			mvt: mvt,
			fmt: fmt,
			mu: mu,
			fu: fu,
			clMvt: clMvt,
			clFmt: clFmt,
			clMu: clMu,
			clFu: clFu,
			rawMvt: dati[2],
			rawFmt: dati[4],
			rawMu: dati[6],
			rawFu: dati[8]
		});
	}

	var sortFn = function (a, b) {
		if (drawerSortBy === "pct") return b.pct - a.pct || b.fmt - a.fmt || a.nome.localeCompare(b.nome);
		if (drawerSortBy === "aff") return b.aff - a.aff || b.pct - a.pct || a.nome.localeCompare(b.nome);
		if (drawerSortBy === "mvt") return b.mvt - a.mvt || a.nome.localeCompare(b.nome);
		if (drawerSortBy === "fmt") return b.fmt - a.fmt || a.nome.localeCompare(b.nome);
		if (drawerSortBy === "mu") return b.mu - a.mu || a.nome.localeCompare(b.nome);
		if (drawerSortBy === "fu") return b.fu - a.fu || a.nome.localeCompare(b.nome);
		return a.nome.localeCompare(b.nome);
	};

	if (drawerMode === "bench") {
		// Sposta in calce i giocatori già scelti come titolari
		items.sort(function (a, b) {
			var aStarter = (a.gg.Formazione >= 1 && a.gg.Formazione <= 11) ? 1 : 0;
			var bStarter = (b.gg.Formazione >= 1 && b.gg.Formazione <= 11) ? 1 : 0;
			if (aStarter !== bStarter) {
				return aStarter - bStarter; // Non titolari (0) prima, titolari (1) in calce
			}
			// Nel tab "Tutti" (drawerRuoloFiltro === 0): ordina prima per ruolo (P, D, C, A)
			if (drawerRuoloFiltro === 0) {
				var rA = a.gg.Ruolo || 99;
				var rB = b.gg.Ruolo || 99;
				if (rA !== rB) return rA - rB;
			}
			// Poi per il filtro selezionato dall'utente (di default nome A-Z)
			return sortFn(a, b);
		});
	} else {
		items.sort(function (a, b) {
			// Nel tab "Tutti" (drawerRuoloFiltro === 0): ordina prima per ruolo (P, D, C, A)
			if (drawerRuoloFiltro === 0) {
				var rA = a.gg.Ruolo || 99;
				var rB = b.gg.Ruolo || 99;
				if (rA !== rB) return rA - rB;
			}
			return sortFn(a, b);
		});
	}

	if (items.length === 0) {
		listEl.innerHTML = "<div style='text-align:center;padding:24px;color:var(--text-muted);font-weight:600;'>Nessun calciatore trovato con questi filtri.</div>";
		return;
	}

	var html = "";
	var dividerShown = false;
	for (var k = 0; k < items.length; k++) {
		var item = items[k];
		var gg = item.gg;
		var rLabel = ruoli[gg.Ruolo];
		var isStarter = (gg.Formazione >= 1 && gg.Formazione <= 11);
		var isBench = (gg.Formazione > 11);

		if (drawerMode === "bench" && isStarter && !dividerShown) {
			html += "<div class='roster-section-divider'>Calciatori già scelti come titolari</div>";
			dividerShown = true;
		}

		var pctClass = item.pct >= 70 ? "pct-high" : (item.pct >= 45 ? "pct-mid" : "pct-low");
		var avv = OttieniAvversarioSerieA(gg);
		var iconaIndisp = OttieniIconaIndisponibileHTML(gg.NomeCode);
		var iconaTitolarita = (typeof PerCentoFG === 'function') ? PerCentoFG(gg.NomeCode, 0) : "";

		var stMvtClass = (item.clMvt > 0 && coloreDati[item.clMvt]) ? coloreDati[item.clMvt] : "";
		var stFmtClass = (item.clFmt > 0 && coloreDati[item.clFmt]) ? coloreDati[item.clFmt] : "";
		var stMuClass = (item.clMu > 0 && coloreDati[item.clMu]) ? coloreDati[item.clMu] : "";
		var stFuClass = (item.clFu > 0 && coloreDati[item.clFu]) ? coloreDati[item.clFu] : "";

		var mvVal = FormattaStatValore(item.mvt, item.rawMvt);
		var fvVal = FormattaStatValore(item.fmt, item.rawFmt);
		var muVal = FormattaStatValore(item.mu, item.rawMu);
		var fuVal = FormattaStatValore(item.fu, item.rawFu);

		var mvBadge = `<b class='rpc-stat-badge${stMvtClass ? " " + stMvtClass : " no-color"}'>${mvVal}</b>`;
		var fvBadge = `<b class='rpc-stat-badge${stFmtClass ? " " + stFmtClass : " no-color"}'>${fvVal}</b>`;
		var muBadge = `<b class='rpc-stat-badge${stMuClass ? " " + stMuClass : " no-color"}'>${muVal}</b>`;
		var fuBadge = `<b class='rpc-stat-badge${stFuClass ? " " + stFuClass : " no-color"}'>${fuVal}</b>`;

		var cardClass = "roster-player-card" + (isStarter ? " is-starter" : (isBench ? " is-bench" : ""));

		var actionBtn = (isStarter || isBench)
			? `<button type='button' class='rpc-mini-btn btn-remove' title='Rimuovi' onclick='event.stopPropagation(); ClickGiocatoreDrawer(${item.idG});'>✕</button>`
			: `<button type='button' class='rpc-mini-btn btn-add' title='Schiera' onclick='event.stopPropagation(); ClickGiocatoreDrawer(${item.idG});'>+</button>`;

		var starterBenchBadge = isStarter
			? " <span class='badge badge-success' style='font-size:0.65rem;padding:1px 5px;'>TITOLARE</span>"
			: (isBench ? " <span class='badge badge-warning' style='font-size:0.65rem;padding:1px 5px;'>PANCHINA</span>" : "");

		html += `
<div class='${cardClass}' onclick='ClickGiocatoreDrawer(${item.idG})'>
  <div class='rpc-left'>
    <span class='slot-role-badge role-${rLabel}'>${rLabel}</span>
    <img src='img/live/sq/${item.sq}.png' width='20' height='20' onerror='this.style.display="none"'>
    <div class='rpc-name-wrap'>
      <div class='rpc-name'>${item.nome}</div>
      <div class='rpc-sub'>
        <div class='rpc-sub-meta'>
          <span>${item.sq}${avv ? " (" + avv + ")" : ""}</span>${starterBenchBadge}
        </div>
        <div class='rpc-stats-grid'>
          <div class='rpc-stat-box' title='Percentuale di Affidabilità (Aff)'><span class='rpc-stat-lbl'>Aff</span> <b class='rpc-stat-badge no-color'>${item.affVal}</b></div>
          <div class='rpc-stat-box' title='Media Voto'><span class='rpc-stat-lbl'>MV</span> ${mvBadge}</div>
          <div class='rpc-stat-box' title='FantaMedia'><span class='rpc-stat-lbl'>FM</span> ${fvBadge}</div>
          <div class='rpc-stat-box' title='Media Voto Ultima'><span class='rpc-stat-lbl'>MU</span> ${muBadge}</div>
          <div class='rpc-stat-box' title='FantaMedia Ultima'><span class='rpc-stat-lbl'>FU</span> ${fuBadge}</div>
        </div>
      </div>
    </div>
  </div>
  <div class='rpc-right'>
    <span class='slot-player-pct ${pctClass}'>${iconaTitolarita ? iconaTitolarita + " " : ""}${item.pct}%</span>
    ${actionBtn}
  </div>
</div>`;
	}

	listEl.innerHTML = html;
	if (typeof InizializzaQTipInfortuni === 'function') {
		InizializzaQTipInfortuni('#rosterPlayerList');
	}
	if (typeof CalcolaDimensioniDrawer === 'function') {
		var drawerSheet = $drawer("rosterDrawerSheet");
		if (drawerSheet && drawerSheet.classList.contains("open")) {
			CalcolaDimensioniDrawer();
		}
	}
}

function ClickGiocatoreDrawer(idG) {
	var gg = arrInvioFormazione[idG];
	if (!gg) return;

	if (gg.Formazione > 0) {
		if (gg.Formazione <= 11) {
			RimuoviTitolare(gg);
		} else {
			RimuoviRiserva(gg);
		}
		CambiaAttributiGiocatoreRosa(idG, false);
		VisualizzaTabellaFormazione();
		AggiornaListaDrawer();
		return;
	}

	// Regola: se i titolari del reparto del modulo utilizzato sono già al completo, il giocatore in eccedenza va in panchina
	var repartoPieno = (targetModulo && moduloInserito[gg.Ruolo] >= targetModulo[gg.Ruolo]);

	if (titolariInseriti < 11 && !repartoPieno && drawerMode !== "bench") {
		var resT = InserisciTitolare(gg, idG);
		if (resT) {
			CambiaAttributiGiocatoreRosa(idG, true);
		} else {
			var resR = InserisciRiserva(gg, idG);
			if (resR) CambiaAttributiGiocatoreRosa(idG, true);
		}
	} else {
		// Reparto al completo, modalità panchina o 11 titolari inseriti: va in panchina
		var resR = InserisciRiserva(gg, idG);
		if (resR) CambiaAttributiGiocatoreRosa(idG, true);
	}

	VisualizzaTabellaFormazione();
	AggiornaListaDrawer();
}

/* --- VISTA CLASSICA TABELLARE --- */
function GeneraVistaClassicaTabellare() {
	var rosaRowsHtml = "";
	var cnt = 2;
	for (var g = 0; g < arrInvioFormazione.length; g++) {
		var gg = arrInvioFormazione[g];
		if (gg.IDSquadra !== cFsq) continue;
		var pd = (cnt % 2) ? "D" : "P";
		var dati = gg.Dati.split("%");
		var col = coloreRuoli[gg.Ruolo];
		var nomeGiocatore = OttieniNomeGiocatore(gg);
		var sqA = OttieniSquadraSerieA(gg);
		var pctHtml = (typeof PerCentoFG === 'function') ? PerCentoFG(gg.NomeCode, 1) : (OttieniPercentualeFGNumero(gg.NomeCode) + "%");

		var avvName = "---";
		if (gg.IDSquadraDiA < incontraInA.length) {
			var avv = incontraInA[gg.IDSquadraDiA][cGio];
			var inT = (avv >= 100);
			var rawAvv = window["xa" + (avv % 100)] || ("xa" + (avv % 100));
			avvName = inT ? rawAvv : rawAvv.toUpperCase();
		}

		var statsCols = "";
		for (var d = 1; d < 5; d++) {
			var cl = Number(dati[d * 2 + 1]);
			var st = (cl === 0) ? (coloreDati[0] + pd) : coloreDati[cl];
			statsCols += `<td class='${st}Centro'>${dati[d * 2] || ""}</td>`;
		}

		rosaRowsHtml += `
<tr class='t-xxs'>
  <td class='Form${pd}Centro'><b class='t-xxs${col}B' id='r_ruolo${g}' style='cursor:pointer;' onclick='ClickGiocatoreRosa(${g})'>${ruoli[gg.Ruolo]}</b></td>
  <td class='Form${pd}'><div style='display:flex;align-items:center;gap:6px;text-align:left;cursor:pointer;width:100%;' onclick='ClickGiocatoreRosa(${g})'><img src='img/live/sq/${sqA}.png' width='16' height='16' onerror='this.style.display="none"' /><span class='player-name-label' id='r_nome${g}'>${nomeGiocatore} <span style='font-weight:normal;opacity:0.8;'>(${sqA})</span></span></div></td>
  <td class='Form${pd}Centro'><div style='display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; gap:2px; font-weight:bold;'>${pctHtml}</div></td>
  <td class='Form${pd}Centro'>${dati[0] || ""}</td>
  ${statsCols}
  <td class='Form${pd}'>${avvName}</td>
</tr>`;
		cnt++;
	}

	var colspan = mostraRigoristi ? 5 : 4;
	var formRowsHtml = "";
	var n = 1;
	for (var cntF = 1; cntF <= 11 + totaleNumeroMassimoRiserve; cntF++) {
		if (cntF === 12) {
			formRowsHtml += `
<tr><th colspan='${colspan}' class='tb-row-tit'>
  <div style='display:flex;align-items:center;justify-content:space-between;padding:2px 4px;'>
    <span>Riserve &bull; Panchina</span>
    <div style='display:flex;gap:6px;'>
      <button type='button' class='inv-action-btn' onclick='AutoCompilaPanchina()' style='padding:3px 8px;font-size:0.72rem;' title='Compila automaticamente le riserve mancanti'>🪄 <span class='btn-text-full'>Auto-Panchina</span><span class='btn-text-short'>Auto</span></button>
      <button type='button' class='inv-action-btn' onclick='SvuotaPanchina()' style='padding:3px 8px;font-size:0.72rem;' title='Svuota tutte le riserve dalla panchina'>🗑️ <span class='btn-text-full'>Svuota panchina</span><span class='btn-text-short'>Svuota</span></button>
    </div>
  </div>
</th></tr>`;
		}

		var rigTdHtml = "";
		if (mostraRigoristi) {
			var r = n <= 11 ? (11 - n + 1) : n;
			if (typeof arrRigoristi[n] !== 'undefined' && arrRigoristi[n] > 0) {
				r = arrRigoristi[n];
			} else {
				arrRigoristi[n] = r;
			}
			var startK = (n <= 11) ? 1 : 12;
			var endK = (n <= 11) ? 11 : (11 + totaleNumeroMassimoRiserve);
			var opts = "";
			for (var k = startK; k <= endK; k++) {
				opts += `<option ${r === k ? "selected " : ""}value='${k}'>${k}</option>`;
			}
			rigTdHtml = `<td style='width:60px; text-align:center;'><select class='table-rig-select' name='f_rigorista${n}' id='f_rigorista${n}' onchange='CambiaRigorista(${n})'>${opts}</select></td>`;
		}

		formRowsHtml += `
<tr>
  <td style='width:24px;'><span class='form-num-badge'>${n}</span></td>
  <td style='width:32px; text-align:center;'><img class='form-player-jersey' src='img/sq/undefined.svg' width='24' height='24' id='f_maglia${n}' style='display:none;'></td>
  <td style='width:28px;'><span id='f_ruolo${n}'></span></td>
  <td style='text-align:left; padding-left:6px;'><span class='form-player-name form-empty' id='f_nome${n}' onclick='ClickGiocatoreFormazione(${n})'><span class='form-empty-slot'>-- Schiera giocatore --</span></span></td>
  ${rigTdHtml}
</tr>`;
		n++;
	}

	return `
<div class='tactical-pitch-card table-view-card'>
  ${GeneraToolbarModuliEAzioni()}
  <div class='inv-grid-layout'>
    <!-- COLONNA ROSA -->
    <div class='inv-rosa-card' id='cardRosa'>
      <div class='inv-card-header'>
        <div class='inv-card-title'>⚽ Rosa Calciatori</div>
        <span class='inv-source-badge'>Fonte % Titolarità: Fantacalcio.it</span>
      </div>
      <div class='inv-table-wrapper'>
        <table class='ClassEl' id='Rosa' style='width:100%; border-collapse:collapse;'>
          <thead>
            <tr class='IntRosso Blu'>
              <th style='width:30px; text-align:center;'>R</th>
              <th style='text-align:left;'>Nome</th>
              <th style='width:45px; text-align:center;'>%</th>
              <th style='width:40px; text-align:center;'>Aff</th>
              <th style='width:40px; text-align:center;'>MVt</th>
              <th style='width:40px; text-align:center;'>FMt</th>
              <th style='width:40px; text-align:center;'>Mu</th>
              <th style='width:40px; text-align:center;'>Fu</th>
              <th style='width:50px; text-align:left;'>Avv</th>
            </tr>
          </thead>
          <tbody>
            ${rosaRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- COLONNA FORMAZIONE CLASSICA -->
    <div class='inv-form-card' id='cardForm'>
      <div class='module-status-header'>
        <div class='module-title'><span id='f_titolari'>Titolari (0-0-0)</span></div>
        <span class='module-pill'>Schieramento</span>
      </div>
      <div class='inv-table-wrapper'>
        <table class='tb-form'>
          ${formRowsHtml}
        </table>
      </div>
    </div>
  </div>
</div>`;
}

/* ==========================================================================
   FUNZIONI LOGICHE FORMAZIONE (INVARIATE & REATTIVE)
   ========================================================================== */
function InizializzaFormazione() {
	for (var i = 1; i < arrFormazione.length; i++) {
		var idG = arrFormazione[i]; arrFormazione[i] = -1;
		if (idG >= 0) { arrInvioFormazione[idG].Formazione = 0; arrInvioFormazione[idG].Rigorista = 0; CambiaAttributiGiocatoreRosa(idG, false); }
		if (mostraRigoristi) { var el = document.getElementById("f_rigorista" + i); if (el) { arrRigoristi[i] = i <= 11 ? (11 - i + 1) : i; el.value = arrRigoristi[i]; } }
	}
	moduloInserito = [0, 0, 0, 0, 0]; titolariInseriti = 0; riserveInserite = [0, 0, 0, 0, 0]; totaleRiserveInserite = 0;
	VisualizzaTabellaFormazione();
}

function ReimpostaFormazione() {
	InizializzaFormazione(false);
	if (!incontroReimposta || !incontroReimposta.IDSquadre) return;
	var idLega = incontroReimposta.IDSquadre.Casa === cFsq ? incontroReimposta.IDLegaSquadre.Casa : incontroReimposta.IDLegaSquadre.Fuori;
	var arrFE = GetFormazione(incontroReimposta.ID, cFsq, idLega);
	for (var i = 1; i < arrFE.length; i++) {
		var g = arrFE[i]; if (g.Pos < 0) continue;
		for (var idG = 0; idG < arrInvioFormazione.length; idG++) {
			var gg = arrInvioFormazione[idG];
			if (gg.IDSquadra === g.IDSquadra && OttieniNomeGiocatore(gg) === g.Nome) {
				var res = (g.Pos === 0) ? InserisciTitolare(gg, idG) : InserisciRiserva(gg, idG);
				if (res) { CambiaAttributiGiocatoreRosa(idG, true); if (mostraRigoristi) gg.Rigorista = g.Rig; } break;
			}
		}
	}
	for (i = 1; i <= 11 + totaleNumeroMassimoRiserve; ++i) {
		g = arrInvioFormazione[arrFormazione[i]];
		if (g !== undefined && g.Rigorista !== 0 && document.getElementById("f_rigorista" + g.Formazione)) {
			document.getElementById("f_rigorista" + g.Formazione).value = g.Rigorista; CambiaRigorista(g.Formazione);
		}
	}
	if (titolariInseriti === 11) {
		targetModulo = [0, 1, moduloInserito[2], moduloInserito[3], moduloInserito[4]];
		VisualizzaTabellaFormazione();
	}
}

function RichiamaFormazione() {
	InizializzaFormazione(false);
	incontriGiornataPrecedente = [];

	var ultGio = (typeof GetUltimaGiornataGiocata === 'function') ? GetUltimaGiornataGiocata() : 0;
	var gioImmediatamentePrec = (cGio > 1) ? (cGio - 1) : 1;

	function TrovaIncontroSquadra(giornata) {
		for (var i = 1; i < arrIncontri.length; i++) {
			var inc = arrIncontri[i];
			if (inc.GiornataDiA === giornata &&
				(inc.IDSquadre.Casa === cFsq || inc.IDSquadre.Fuori === cFsq) &&
				inc.IDTipo !== INC_RIPOSO &&
				inc.IncAcc === 1) {
				return inc;
			}
		}
		return null;
	}

	function EseguiPopolamento(incontroObj) {
		if (!incontroObj || !incontroObj.IDSquadre) return 0;
		var idLega = incontroObj.IDSquadre.Casa === cFsq ? incontroObj.IDLegaSquadre.Casa : incontroObj.IDLegaSquadre.Fuori;
		var arrFP = GetFormazionePrecedente(incontroObj.ID, cFsq, idLega);
		var inseriti = 0;
		if (arrFP && arrFP.length > 1) {
			for (var i = 1; i < arrFP.length; i++) {
				var g = arrFP[i]; if (g.Pos < 0) continue;
				for (var idG = 0; idG < arrInvioFormazione.length; idG++) {
					var gg = arrInvioFormazione[idG];
					if (gg.IDSquadra === g.IDSquadra && OttieniNomeGiocatore(gg) === g.Nome) {
						var res = (g.Pos === 0) ? InserisciTitolare(gg, idG) : InserisciRiserva(gg, idG);
						if (res) {
							CambiaAttributiGiocatoreRosa(idG, true);
							if (mostraRigoristi) gg.Rigorista = g.Rig;
							inseriti++;
						}
						break;
					}
				}
			}
			for (var k = 1; k <= 11 + totaleNumeroMassimoRiserve; ++k) {
				var gItem = arrInvioFormazione[arrFormazione[k]];
				if (gItem !== undefined && gItem.Rigorista !== 0 && document.getElementById("f_rigorista" + gItem.Formazione)) {
					document.getElementById("f_rigorista" + gItem.Formazione).value = gItem.Rigorista;
					CambiaRigorista(gItem.Formazione);
				}
			}
			if (titolariInseriti === 11) {
				targetModulo = [0, 1, moduloInserito[2], moduloInserito[3], moduloInserito[4]];
				VisualizzaTabellaFormazione();
			}
		}
		return inseriti;
	}

	var numInseriti = 0;

	// 1. Prova prima con la giornata immediatamente precedente a quella selezionata (cGio - 1)
	if (cGio > 1) {
		var incPrec = TrovaIncontroSquadra(gioImmediatamentePrec);
		if (incPrec) {
			incontroRichiama = incPrec;
			numInseriti = EseguiPopolamento(incPrec);
		}
	}

	// 2. Se non presente nella giornata precedente, cerca a ritroso l'ultima formazione inserita
	if (numInseriti === 0) {
		for (var g = gioImmediatamentePrec - 1; g >= 1; g--) {
			var incBack = TrovaIncontroSquadra(g);
			if (incBack) {
				var ins = EseguiPopolamento(incBack);
				if (ins > 0) {
					numInseriti = ins;
					incontroRichiama = incBack;
					break;
				}
			}
		}
	}

	// 3. Se ancora non trovata e c'è una giornata ultima giocata valida
	if (numInseriti === 0 && ultGio > 0 && ultGio !== gioImmediatamentePrec) {
		var incUlt = TrovaIncontroSquadra(ultGio);
		if (incUlt) {
			var ins2 = EseguiPopolamento(incUlt);
			if (ins2 > 0) {
				numInseriti = ins2;
				incontroRichiama = incUlt;
			}
		}
	}

	if (numInseriti === 0) {
		alert("Nessuna formazione precedente trovata per la squadra selezionata.");
	}
}

function ClickGiocatoreRosa(idG) {
	var gg = arrInvioFormazione[idG];
	if (gg.Formazione === 0) {
		var repartoPieno = (targetModulo && moduloInserito[gg.Ruolo] >= targetModulo[gg.Ruolo]);
		var res = (titolariInseriti < 11 && !repartoPieno) ? InserisciTitolare(gg, idG) : InserisciRiserva(gg, idG);
		if (res) CambiaAttributiGiocatoreRosa(idG, true);
	} else {
		if (gg.Formazione <= 11) RimuoviTitolare(gg);
		else RimuoviRiserva(gg);
		CambiaAttributiGiocatoreRosa(idG, false);
	}
}

function ClickGiocatoreFormazione(pos) {
	if (typeof NascondiTooltipTattico === 'function') NascondiTooltipTattico();
	var idG = arrFormazione[pos]; if (idG < 0) return; var gg = arrInvioFormazione[idG];
	if (pos <= 11) RimuoviTitolare(gg); else RimuoviRiserva(gg); CambiaAttributiGiocatoreRosa(idG, false);
}

function InserisciTitolare(gg, idG) {
	moduloInserito[gg.Ruolo]++; var ok = false;
	for (var m = 0; m < moduliAmmessi.length; m++) if (moduloInserito[1] <= moduliAmmessi[m][1] && moduloInserito[2] <= moduliAmmessi[m][2] && moduloInserito[3] <= moduliAmmessi[m][3] && moduloInserito[4] <= moduliAmmessi[m][4]) { ok = true; break; }
	if (!ok) { moduloInserito[gg.Ruolo]--; alert("Modulo non ammesso con questo inserimento."); return false; }
	for (var p = 1; p <= 11; p++) if (arrFormazione[p] < 0 || arrInvioFormazione[arrFormazione[p]].Ruolo > gg.Ruolo) break;
	for (var i = titolariInseriti; i >= p; i--) { arrFormazione[i + 1] = arrFormazione[i]; arrInvioFormazione[arrFormazione[i]].Formazione = i + 1; }
	arrFormazione[p] = idG; gg.Formazione = p; titolariInseriti++; VisualizzaTabellaFormazione(); return true;
}

function RimuoviTitolare(gg) {
	for (var i = gg.Formazione; i <= 11; i++) { if (i < titolariInseriti) { arrFormazione[i] = arrFormazione[i + 1]; arrInvioFormazione[arrFormazione[i]].Formazione = i; } else arrFormazione[i] = -1; }
	gg.Formazione = 0; titolariInseriti--; moduloInserito[gg.Ruolo]--; VisualizzaTabellaFormazione(); return true;
}

function InserisciRiserva(gg, idG) {
	if (totaleRiserveInserite >= totaleNumeroMassimoRiserve) { alert("Numero massimo di riserve raggiunto (10)"); return false; }
	if (numeroMassimoRiserve[gg.Ruolo] >= 0 && riserveInserite[gg.Ruolo] >= numeroMassimoRiserve[gg.Ruolo]) { alert("Numero massimo riserve per questo ruolo raggiunto"); return false; }
	for (var p = 12; p <= 11 + totaleNumeroMassimoRiserve; p++) if (arrFormazione[p] < 0 || (panchinaOrdinata && arrInvioFormazione[arrFormazione[p]].Ruolo > gg.Ruolo)) break;
	for (var i = 11 + totaleRiserveInserite; i >= p; i--) { arrFormazione[i + 1] = arrFormazione[i]; arrInvioFormazione[arrFormazione[i]].Formazione = i + 1; }
	arrFormazione[p] = idG; gg.Formazione = p; totaleRiserveInserite++; riserveInserite[gg.Ruolo]++; VisualizzaTabellaFormazione(); return true;
}

function RimuoviRiserva(gg) {
	for (var i = gg.Formazione; i <= 11 + totaleNumeroMassimoRiserve; i++) { if (i < 11 + totaleRiserveInserite) { arrFormazione[i] = arrFormazione[i + 1]; arrInvioFormazione[arrFormazione[i]].Formazione = i; } else arrFormazione[i] = -1; }
	gg.Formazione = 0; totaleRiserveInserite--; riserveInserite[gg.Ruolo]--; VisualizzaTabellaFormazione(); return true;
}

function CambiaAttributiGiocatoreRosa(idG, sel) {
	var elR = document.getElementById("r_ruolo" + idG); var elN = document.getElementById("r_nome" + idG); if (!elR) return;
	var row = elR.closest("tr");
	if (sel) {
		elR.className = "t-xxsI";
		elN.className = "t-xxsI";
		if (row) row.classList.add("player-selected");
	} else {
		var c = coloreRuoli[arrInvioFormazione[idG].Ruolo];
		elR.className = "t-xxs" + c + "B";
		if (elN) elN.className = "player-name-label";
		if (row) row.classList.remove("player-selected");
	}
}

/* --- SINCRONIZZAZIONE GLOBALE DELLA FORMAZIONE --- */
function VisualizzaTabellaFormazione() {
	var elT = document.getElementById("f_titolari");
	if (elT) elT.innerHTML = "Titolari (" + moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4] + ")";
	for (var i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		var elMaglia = document.getElementById("f_maglia" + i);
		var elRuolo = document.getElementById("f_ruolo" + i);
		var elNome = document.getElementById("f_nome" + i);
		if (!elNome) continue;
		if (typeof arrFormazione[i] === "undefined" || arrFormazione[i] < 0 || !arrInvioFormazione[arrFormazione[i]]) {
			if (elMaglia) { elMaglia.src = "img/sq/undefined.svg"; elMaglia.style.display = "none"; }
			if (elRuolo) { elRuolo.innerHTML = ""; elRuolo.className = ""; }
			elNome.innerHTML = "<span class='form-empty-slot'>-- Schiera giocatore --</span>";
			elNome.className = "form-player-name form-empty";
		} else {
			var gg = arrInvioFormazione[arrFormazione[i]];
			if (elMaglia) {
				elMaglia.src = "img/live/sq/" + OttieniSquadraSerieA(gg) + ".png";
				elMaglia.style.display = "inline-block";
			}
			var c = coloreRuoli[gg.Ruolo];
			if (elRuolo) { elRuolo.innerHTML = ruoli[gg.Ruolo]; elRuolo.className = "t-xxs" + c + "B"; }
			elNome.innerHTML = OttieniNomeGiocatore(gg) + " <span style='font-size:0.75rem;color:var(--text-muted);'>(" + OttieniSquadraSerieA(gg) + ")</span>";
			elNome.className = "form-player-name";
		}
	}

	// 1. Aggiorna Campetto Tattico
	AggiornaCampettoTattico();

	// 2. Aggiorna Dock di Invio
	AggiornaDockInvio();

	// 2b. Aggiorna Drawer se aperto
	var sheetDrawer = document.getElementById("rosterDrawerSheet");
	if (sheetDrawer && sheetDrawer.classList.contains("open") && typeof AggiornaListaDrawer === 'function') {
		AggiornaListaDrawer();
	}
}

function AggiornaDockInvio() {
	var strModulo = moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4];
	var elM = document.getElementById("dockModuloVal");
	if (elM) elM.textContent = strModulo;
	var elT = document.getElementById("dockTitVal");
	if (elT) elT.textContent = titolariInseriti + "/11";
	var elR = document.getElementById("dockRisVal");
	if (elR) elR.textContent = totaleRiserveInserite + "/10";

	var notice = document.getElementById("dockStatusNotice");
	if (notice) {
		if (titolariInseriti < 11) {
			notice.innerHTML = "<span style='color:var(--accent-amber);'>⚠️ Schiera ancora " + (11 - titolariInseriti) + " titolari</span>";
		} else if (totaleRiserveInserite < 10) {
			notice.innerHTML = "<span style='color:var(--accent-cyan);'>ℹ️ Puoi ancora aggiungere " + (10 - totaleRiserveInserite) + " riserve</span>";
		} else {
			notice.innerHTML = "<span style='color:var(--accent-emerald);'>✅ Formazione completa (11 + 10)</span>";
		}
	}

	var btnWA = document.getElementById("btnCondividiWA");
	if (btnWA) {
		btnWA.classList.toggle("ready", titolariInseriti === 11);
	}
}

function ToggleShowPassword() {
	var el = document.getElementById("fi_password");
	if (el) {
		el.type = (el.type === "password") ? "text" : "password";
	}
}

function AssicuraInizializzazioneRigoristi() {
	var maxSlots = 11 + totaleNumeroMassimoRiserve;
	// Titolari: rigoristi da 1 a 11
	var usedTit = {};
	for (var n = 1; n <= 11; n++) {
		if (typeof arrRigoristi[n] === 'undefined' || arrRigoristi[n] < 1 || arrRigoristi[n] > 11) {
			arrRigoristi[n] = (11 - n + 1);
		}
	}
	for (var n = 1; n <= 11; n++) {
		var val = arrRigoristi[n];
		if (usedTit[val]) {
			for (var k = 1; k <= 11; k++) {
				if (!usedTit[k]) {
					arrRigoristi[n] = k;
					val = k;
					break;
				}
			}
		}
		usedTit[val] = true;
	}

	// Riserve / Panchina: rigoristi da 12 in poi
	var usedBench = {};
	for (var n = 12; n <= maxSlots; n++) {
		if (typeof arrRigoristi[n] === 'undefined' || arrRigoristi[n] < 12 || arrRigoristi[n] > maxSlots) {
			arrRigoristi[n] = n;
		}
	}
	for (var n = 12; n <= maxSlots; n++) {
		var valB = arrRigoristi[n];
		if (usedBench[valB]) {
			for (var k = 12; k <= maxSlots; k++) {
				if (!usedBench[k]) {
					arrRigoristi[n] = k;
					valB = k;
					break;
				}
			}
		}
		usedBench[valB] = true;
	}
}

function CambiaRigorista(pos, nuovoValore) {
	AssicuraInizializzazioneRigoristi();
	pos = Number(pos);
	var el = document.getElementById('f_rigorista' + pos);
	var r = (typeof nuovoValore !== 'undefined') ? Number(nuovoValore) : (el ? Number(el.value) : arrRigoristi[pos]);
	if (isNaN(r) || r <= 0) return;

	var maxSlots = 11 + totaleNumeroMassimoRiserve;
	var isStarter = (pos <= 11);
	var minRank = isStarter ? 1 : 12;
	var maxRank = isStarter ? 11 : maxSlots;
	var minSlot = isStarter ? 1 : 12;
	var maxSlot = isStarter ? 11 : maxSlots;

	if (r < minRank || r > maxRank) return;

	var rPrec = arrRigoristi[pos];
	for (var i = minSlot; i <= maxSlot; i++) {
		if (i !== pos && arrRigoristi[i] === r) {
			arrRigoristi[i] = rPrec;
			var elI = document.getElementById('f_rigorista' + i);
			if (elI) elI.value = rPrec;
			if (arrFormazione[i] >= 0 && arrInvioFormazione[arrFormazione[i]]) {
				arrInvioFormazione[arrFormazione[i]].Rigorista = rPrec;
			}
		}
	}
	arrRigoristi[pos] = r;
	if (el) el.value = r;
	if (arrFormazione[pos] >= 0 && arrInvioFormazione[arrFormazione[pos]]) {
		arrInvioFormazione[arrFormazione[pos]].Rigorista = r;
	}
	if (typeof AggiornaCampettoTattico === 'function') {
		AggiornaCampettoTattico();
	}
}

function SpostaRigorista(curRank, dir) {
	var maxSlots = 11 + totaleNumeroMassimoRiserve;
	var isStarter = (curRank <= 11);
	var minRank = isStarter ? 1 : 12;
	var maxRank = isStarter ? 11 : maxSlots;
	var minSlot = isStarter ? 1 : 12;
	var maxSlot = isStarter ? 11 : maxSlots;

	var targetRank = curRank + dir;
	if (targetRank < minRank || targetRank > maxRank) return;

	var slotPosA = -1;
	for (var p = minSlot; p <= maxSlot; p++) {
		if (arrRigoristi[p] === curRank) {
			slotPosA = p;
			break;
		}
	}
	if (slotPosA < 1) return;

	CambiaRigorista(slotPosA, targetRank);
}

function RipristinaRigoristiPredefiniti() {
	var maxSlots = 11 + totaleNumeroMassimoRiserve;
	for (var i = 1; i <= 11; i++) {
		var defR = 11 - i + 1;
		arrRigoristi[i] = defR;
		var el = document.getElementById("f_rigorista" + i);
		if (el) el.value = defR;
		if (arrFormazione[i] >= 0 && arrInvioFormazione[arrFormazione[i]]) {
			arrInvioFormazione[arrFormazione[i]].Rigorista = defR;
		}
	}
	for (var i = 12; i <= maxSlots; i++) {
		var defR = i;
		arrRigoristi[i] = defR;
		var el = document.getElementById("f_rigorista" + i);
		if (el) el.value = defR;
		if (arrFormazione[i] >= 0 && arrInvioFormazione[arrFormazione[i]]) {
			arrInvioFormazione[arrFormazione[i]].Rigorista = defR;
		}
	}
	AggiornaCampettoTattico();
}

function AggiornaStatoRigoristi() {
	var anyRigoristi = false;
	for (var i = 1; i <= incontriDisponibili.length; i++) {
		var chk = document.getElementById("incontro" + i);
		if (chk && chk.checked) {
			var ii = arrIncontri[chk.value];
			if (ii && (ii.Rigoristi || ii.IDTipo === INC_ELIMDIRETTA_DIR || ii.IDTipo === INC_ELIMDIRETTA_RIT || ii.IDTipo === INC_ELIMDIRETTA_DIR_FC)) {
				anyRigoristi = true;
				break;
			}
		}
	}
	mostraRigoristi = anyRigoristi;
	var penCard = document.getElementById("penaltyTakersCard");
	if (penCard) {
		penCard.style.display = mostraRigoristi ? "block" : "none";
	}
	AggiornaCampettoTattico();
}

function AggiornaRigoristiCampetto() {
	var card = document.getElementById("penaltyTakersCard");
	var grid = document.getElementById("penaltyTakersGrid");
	if (!card) return;

	if (!mostraRigoristi) {
		card.style.display = "none";
		return;
	}
	card.style.display = "block";
	if (!grid) return;

	AssicuraInizializzazioneRigoristi();

	var isGkRuleActive = (typeof regolaRigoristi !== 'undefined' && Number(regolaRigoristi) === 1);
	var subEl = document.getElementById("penaltyCardSubtitle");
	if (subEl) {
		var gkSubDesc = isGkRuleActive ? "Portiere dall'11° posto in poi (regola attiva)" : "Portiere libero (regola disattivata)";
		subEl.innerHTML = "Titolari (1-11, primi 5 decisivi ⭐) &bull; Riserve (12+) &bull; " + gkSubDesc;
	}

	var maxSlots = 11 + totaleNumeroMassimoRiserve;
	var gkInTop10 = false;

	// Sezione 1: Titolari (1-11)
	var titolariRigoristiHtml = "";
	for (var r = 1; r <= 11; r++) {
		var slotPos = -1;
		for (var p = 1; p <= 11; p++) {
			if (arrRigoristi[p] === r) {
				slotPos = p;
				break;
			}
		}

		var isDecisive = (r <= 5);
		var idG = (slotPos > 0) ? arrFormazione[slotPos] : -1;
		var gg = (idG >= 0 && arrInvioFormazione[idG]) ? arrInvioFormazione[idG] : null;

		var isGk = (gg && gg.Ruolo === 1);
		var isGkWarn = (isGkRuleActive && isGk && r < 11);
		if (isGkWarn) gkInTop10 = true;

		var rowCls = "penalty-row" + (isDecisive ? " is-decisive" : "") + (isGkWarn ? " is-gk-warning" : "");

		var playerInfoHtml = "";
		if (gg) {
			var cognome = EstraiCognome(OttieniNomeGiocatore(gg));
			var sq = OttieniSquadraSerieA(gg);
			var rLabel = ruoli[gg.Ruolo];
			playerInfoHtml = `
    <span class='slot-role-badge role-${rLabel}'>${rLabel}</span>
    <img src='img/live/sq/${sq}.png' width='16' height='16' onerror='this.src="img/sq/undefined.svg"'>
    <div class='penalty-player-info'>
      <span class='penalty-player-name'>${cognome}${isGkWarn ? " <span class='badge-gk-warn'>⚠️ Portiere &lt; 11</span>" : ""}</span>
      <span class='penalty-player-meta'>${sq} &bull; Titolare #${slotPos}</span>
    </div>`;
		} else {
			playerInfoHtml = `
    <div class='penalty-player-info is-empty'>
      <span class='penalty-player-name empty'>-- Nessun calciatore inserito --</span>
      <span class='penalty-player-meta'>Slot Titolare #${slotPos > 0 ? slotPos : r}</span>
    </div>`;
		}

		var controlsHtml = "";
		if (slotPos > 0) {
			var disUp = (r === 1) ? " disabled" : "";
			var disDown = (r === 11) ? " disabled" : "";
			var opts = "";
			for (var optR = 1; optR <= 11; optR++) {
				opts += `<option value='${optR}'${optR === r ? " selected" : ""}>#${optR}</option>`;
			}
			controlsHtml = `
    <button type='button' class='penalty-move-btn' onclick='SpostaRigorista(${r}, -1)'${disUp} title='Sposta più in alto nei titolari'>▲</button>
    <button type='button' class='penalty-move-btn' onclick='SpostaRigorista(${r}, 1)'${disDown} title='Sposta più in basso nei titolari'>▼</button>
    <select class='penalty-quick-select' onchange='CambiaRigorista(${slotPos}, this.value)' title='Assegna posizione nei titolari'>${opts}</select>`;
		}

		titolariRigoristiHtml += `
<div class='${rowCls}' id='penaltyRow${r}'>
  <div class='penalty-row-left'>
    <div class='penalty-rank-badge${isDecisive ? " is-decisive" : ""}'>
      <span>#${r}</span>${isDecisive ? "<span class='rank-star'>⭐</span>" : ""}
    </div>
    ${playerInfoHtml}
  </div>
  <div class='penalty-row-controls'>
    ${controlsHtml}
  </div>
</div>`;
	}

	// Sezione 2: Panchina / Riserve (12..maxSlots)
	var riserveRigoristiHtml = "";
	for (var r = 12; r <= maxSlots; r++) {
		var slotPos = -1;
		for (var p = 12; p <= maxSlots; p++) {
			if (arrRigoristi[p] === r) {
				slotPos = p;
				break;
			}
		}

		var idG = (slotPos > 0) ? arrFormazione[slotPos] : -1;
		var gg = (idG >= 0 && arrInvioFormazione[idG]) ? arrInvioFormazione[idG] : null;

		var playerInfoHtml = "";
		if (gg) {
			var cognome = EstraiCognome(OttieniNomeGiocatore(gg));
			var sq = OttieniSquadraSerieA(gg);
			var rLabel = ruoli[gg.Ruolo];
			playerInfoHtml = `
    <span class='slot-role-badge role-${rLabel}'>${rLabel}</span>
    <img src='img/live/sq/${sq}.png' width='16' height='16' onerror='this.src="img/sq/undefined.svg"'>
    <div class='penalty-player-info'>
      <span class='penalty-player-name'>${cognome}</span>
      <span class='penalty-player-meta'>${sq} &bull; Riserva #${slotPos - 11}</span>
    </div>`;
		} else {
			playerInfoHtml = `
    <div class='penalty-player-info is-empty'>
      <span class='penalty-player-name empty'>-- Nessun calciatore inserito --</span>
      <span class='penalty-player-meta'>Slot Riserva #${slotPos > 0 ? (slotPos - 11) : (r - 11)}</span>
    </div>`;
		}

		var controlsHtml = "";
		if (slotPos > 0) {
			var disUp = (r === 12) ? " disabled" : "";
			var disDown = (r === maxSlots) ? " disabled" : "";
			var opts = "";
			for (var optR = 12; optR <= maxSlots; optR++) {
				opts += `<option value='${optR}'${optR === r ? " selected" : ""}>#${optR}</option>`;
			}
			controlsHtml = `
    <button type='button' class='penalty-move-btn' onclick='SpostaRigorista(${r}, -1)'${disUp} title='Sposta più in alto nelle riserve'>▲</button>
    <button type='button' class='penalty-move-btn' onclick='SpostaRigorista(${r}, 1)'${disDown} title='Sposta più in basso nelle riserve'>▼</button>
    <select class='penalty-quick-select' onchange='CambiaRigorista(${slotPos}, this.value)' title='Assegna posizione nelle riserve'>${opts}</select>`;
		}

		riserveRigoristiHtml += `
<div class='penalty-row' id='penaltyRow${r}'>
  <div class='penalty-row-left'>
    <div class='penalty-rank-badge'>
      <span>#${r}</span>
    </div>
    ${playerInfoHtml}
  </div>
  <div class='penalty-row-controls'>
    ${controlsHtml}
  </div>
</div>`;
	}

	grid.innerHTML = `
<div class='penalty-section-title'><span>⭐ Titolari (Rigoristi 1 - 11 &bull; Primi 5 Decisivi)</span></div>
${titolariRigoristiHtml}
<div class='penalty-section-title' style='margin-top:8px;'><span>🪑 Panchina &bull; Riserve (Rigoristi dal 12 in poi)</span></div>
${riserveRigoristiHtml}`;

	var warnEl = document.getElementById("penaltyGkWarning");
	if (warnEl) {
		warnEl.style.display = (isGkRuleActive && gkInTop10) ? "flex" : "none";
	}
}

/* ==========================================================================
   FORM CONTROLLI & TRASMISSIONE DATI VERSO invform/invform.php (100% INVARIATI)
   ========================================================================== */
function GeneraControlliPerInvio(pname) {
	var savedPwKey = "pn_fsq_pw_" + cFsq;
	var savedPw = "";
	try { savedPw = localStorage.getItem(savedPwKey) || ""; } catch (e) { }

	var noteLegaHtml = (!nascondiComunicazioni)
		? `<div style='margin-bottom:14px;'>
    <label class='inv-form-label'>Comunicazioni per la Lega (facoltativo):</label>
    <textarea id='fi_comunicazioni' class='inv-textarea' rows='2' placeholder='Scrivi eventuali note o comunicazioni per il presidente o la lega...'></textarea>
  </div>`
		: "";

	var submitBarContent = (pname === "invform_prec")
		? `<div style='display:flex;align-items:center;gap:10px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:8px 14px;border-radius:8px;'>
      <span style='font-size:1.15rem;'>🛡️</span>
      <div><span style='font-size:0.82rem;font-weight:700;color:var(--accent-emerald,#10b981);display:block;'>Modalità Amministratore Attiva</span><span style='font-size:0.72rem;color:var(--text-muted);'>Salvataggio diretto su file &bull; Nessuna e-mail o notifica Telegram</span></div>
      <input type='hidden' id='fi_password' name='password' value='admin'>
    </div>
    <div style='display:flex;gap:10px;align-items:center;flex-wrap:wrap;'>
      <input type='submit' class='inv-btn-submit' value='💾 SALVA SUL SITO (ADMIN)' style='min-width:240px;font-weight:900;letter-spacing:0.04em;background:var(--accent-emerald,#10b981);border-color:var(--accent-emerald,#10b981);'>
    </div>`
		: `<div style='display:flex;flex-direction:column;gap:4px;'>
      <div class='inv-password-wrap' style='display:flex;align-items:center;gap:8px;'>
        <span style='font-size:0.82rem;font-weight:700;'>Password Squadra:</span>
        <div style='position:relative;display:inline-flex;align-items:center;'>
          <input type='password' id='fi_password' name='password' class='inv-password-input' placeholder='••••••' value='${savedPw}' style='padding-right:32px;'>
          <button type='button' onclick='ToggleShowPassword()' style='position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted);' title='Mostra/Nascondi password'>👁️</button>
        </div>
      </div>
      <label style='font-size:0.72rem;color:var(--text-muted);display:inline-flex;align-items:center;gap:5px;cursor:pointer;'>
        <input type='checkbox' id='chkRememberPw' checked style='cursor:pointer;'> Ricorda password su questo dispositivo
      </label>
    </div>
    <div style='display:flex;gap:10px;align-items:center;flex-wrap:wrap;'>
      <input type='submit' class='inv-btn-submit' value='🚀 INVIA FORMAZIONE' style='min-width:200px;font-weight:900;letter-spacing:0.04em;'>
    </div>`;

	var html = `
<form id='formInvio' action='${scriptServer}' method='post' accept-charset='utf-8' onsubmit='return InviaFormazione();'>
<div class='pitch-submit-dock'>
  <div class='dock-status-row'>
    <div style='display:flex;align-items:center;gap:8px;flex-wrap:wrap;'>
      <div class='dock-badge-item'>
        <span>Modulo:</span>
        <b id='dockModuloVal' style='color:var(--accent-cyan);'>0-0-0</b>
      </div>
      <div class='dock-badge-item'>
        <span>Titolari:</span>
        <b id='dockTitVal' style='color:var(--accent-emerald);'>0/11</b>
      </div>
      <div class='dock-badge-item'>
        <span>Panchina:</span>
        <b id='dockRisVal' style='color:var(--accent-amber);'>0/10</b>
      </div>
    </div>
    <div id='dockStatusNotice' style='font-size:0.8rem;font-weight:700;'></div>
  </div>

  ${noteLegaHtml}

  <div class='inv-submit-bar' style='display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;'>
    ${submitBarContent}
  </div>

  <!-- CAMPI NASCOSTI STANDARD FCM (MANTENUTI AL 100%) -->
  <input type='hidden' name='azione' value='inviaFormazione'>
  <input type='hidden' id='fi_idSquadra' name='idSquadra'>
  <input type='hidden' id='fi_giornataDiA' name='giornataDiA'>
  <input type='hidden' id='fi_formazioni' name='formazioni'>
  <input type='hidden' id='fi_pname' name='pname' value='${pname}'>
</div>
</form>

<!-- MODAL CONFERMA ESITO INVIO / SALVATAGGIO -->
<div id='modalInvioEsito' class='inv-modal-overlay' aria-hidden='true'>
  <div class='inv-modal-card' role='dialog' aria-modal='true' aria-labelledby='invModalHeaderTitle'>
    <div class='inv-modal-header'>
      <div class='inv-modal-header-info'>
        <span id='invModalStatusIcon' class='inv-modal-status-icon'>⏳</span>
        <h3 id='invModalHeaderTitle' class='inv-modal-title'>Invio Formazione</h3>
      </div>
      <button type='button' class='inv-modal-close' onclick='ChiudiModalEsitoInvio()' aria-label='Chiudi'>&times;</button>
    </div>
    <div class='inv-modal-body'>
      <div id='invModalLoading' class='inv-modal-loading-box'>
        <div class='inv-modal-spinner'></div>
        <p class='inv-modal-loading-text'>Elaborazione dell'invio in corso...</p>
        <p class='inv-modal-loading-subtext'>Salvataggio dati, notifica e-mail e Telegram...</p>
      </div>
      <div id='invModalResults' style='display:none;'>
        <div id='invModalBodyContent' class='inv-modal-result-content'></div>
      </div>
    </div>
    <div class='inv-modal-footer'>
      <button type='button' id='invModalBtnWA' class='inv-btn-whatsapp' onclick='CondividiSuWhatsApp()' style='display:none;' title='Condividi formazione su WhatsApp'>
        <span class='wa-icon'>💬</span> <span>Invia su WhatsApp</span>
      </button>
      <button type='button' class='inv-modal-btn-close' onclick='ChiudiModalEsitoInvio()'>OK, Chiudi</button>
    </div>
  </div>
</div>`;

	InserisciContenutoDOM(html, "invControlliArea");

	setTimeout(function () {
		VisualizzaTabellaFormazione();
	}, 60);
}

function InviaFormazione() {
	var currentPname = (typeof pname !== 'undefined') ? pname : (document.getElementById("fi_pname") ? document.getElementById("fi_pname").value : "invform");
	if (currentPname !== "invform_prec" && IsTermineScaduto()) {
		alert("Termine per l'invio della formazione scaduto!");
		return false;
	}
	var nSel = 0;
	for (var i = 1; i <= incontriDisponibili.length; ++i) {
		if (document.getElementById("incontro" + i).checked) nSel++;
	}
	if (nSel === 0) { alert("Nessun incontro selezionato"); return false; }
	if (!ControllaFormazione()) return false;

	// Salva password se la spunta è attiva
	try {
		var chk = document.getElementById("chkRememberPw");
		var pwVal = document.getElementById("fi_password").value;
		if (chk && chk.checked && pwVal) {
			localStorage.setItem("pn_fsq_pw_" + cFsq, pwVal);
		}
	} catch (e) { }

	var formazioni = [];
	var datiTelegram = "";
	for (i = 1; i <= incontriDisponibili.length; ++i) {
		if (!document.getElementById("incontro" + i).checked) continue;
		var ii = arrIncontri[document.getElementById("incontro" + i).value];
		var formazione = { "idIncontro": ii.ID, "descrizione": ii.Descrizione };

		if (inviaEMail) {
			formazione.datiEMail = []; var dest = OttieneDestinatari(ii);
			if (dest.completa.length !== 0) { var m = GeneraEMailCompleta(ii); m.destinatari = dest.completa; formazione.datiEMail.push(m); }
			if (dest.ridotta.length !== 0) { var m = GeneraEMailRidotta(ii); m.destinatari = dest.ridotta; formazione.datiEMail.push(m); }
		}
		if (salvaSuSito) formazione.datiSalvataggio = GeneraDatiSalvataggioSuSito(ii);
		if (inoltraATelegram) datiTelegram = GeneraDatiTelegram(ii, datiTelegram);
		formazioni.push(formazione);
	}

	if (datiTelegram !== "") formazioni[0].datiTelegram = datiTelegram;

	// Popola i campi nascosti per il POST
	document.getElementById("fi_formazioni").value = JSON.stringify(formazioni);
	document.getElementById("fi_idSquadra").value = cFsq;
	document.getElementById("fi_giornataDiA").value = cGio;

	if (typeof pname !== 'undefined') {
		document.getElementById("fi_pname").value = pname;
	}

	// Invia la formazione in modo asincrono visualizzando il modal nativo in-page
	InviaFormazioneAsync();

	return false;
}

/* ==========================================================================
   GESTIONE MODAL ESITO INVIO FORMAZIONE (MODERN IN-PAGE MODAL)
   ========================================================================== */
function ApriModalEsitoInvio() {
	var modal = document.getElementById("modalInvioEsito");
	if (!modal) return;

	var modalLoading = document.getElementById("invModalLoading");
	var modalResults = document.getElementById("invModalResults");
	var modalStatusIcon = document.getElementById("invModalStatusIcon");
	var modalHeaderTitle = document.getElementById("invModalHeaderTitle");
	var modalBody = document.getElementById("invModalBodyContent");
	var waBtn = document.getElementById("invModalBtnWA");

	if (modalLoading) modalLoading.style.display = "flex";
	if (modalResults) modalResults.style.display = "none";
	if (modalStatusIcon) modalStatusIcon.innerHTML = "⏳";
	if (modalHeaderTitle) modalHeaderTitle.textContent = "Invio Formazione in corso...";
	if (modalBody) modalBody.innerHTML = "";
	if (waBtn) waBtn.style.display = "none";

	// Centratura verticale dinamica rispetto alla visuale corrente dello schermo
	var card = modal.querySelector(".inv-modal-card");
	var isIframe = (window.self !== window.top);

	if (isIframe) {
		modal.style.position = "absolute";
		modal.style.height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + "px";
		modal.style.alignItems = "flex-start";
		modal.style.justifyContent = "center";

		var screenCenterInIframe = 0;
		try {
			if (window.top && window.top.document) {
				var iframe = window.frameElement || window.top.document.getElementById("spaEmbeddedFrame");
				if (iframe) {
					var iframeRect = iframe.getBoundingClientRect();
					var vh = window.top.innerHeight || 800;
					screenCenterInIframe = Math.max(20, -iframeRect.top + (vh / 2) - 180);
				}
			}
		} catch (e) { }

		if (!screenCenterInIframe) {
			var activeBtn = document.activeElement;
			var btnTop = (activeBtn && activeBtn.offsetTop) ? activeBtn.offsetTop : (window.pageYOffset || document.documentElement.scrollTop || 0);
			screenCenterInIframe = Math.max(20, btnTop - 180);
		}

		if (card) {
			card.style.marginTop = screenCenterInIframe + "px";
		}

		try {
			window.parent.postMessage({
				type: "pn_scroll_to_modal",
				offset: screenCenterInIframe,
				targetTop: screenCenterInIframe
			}, "*");
		} catch (e) { }
	} else {
		modal.style.position = "fixed";
		modal.style.alignItems = "center";
		modal.style.justifyContent = "center";
		if (card) card.style.marginTop = "";
	}

	modal.classList.add("visible");
	modal.setAttribute("aria-hidden", "false");
	document.body.style.overflow = "hidden";
}

function ChiudiModalEsitoInvio() {
	var modal = document.getElementById("modalInvioEsito");
	if (!modal) return;

	var card = modal.querySelector(".inv-modal-card");
	if (card) card.style.marginTop = "";
	modal.style.height = "";

	modal.classList.remove("visible");
	modal.setAttribute("aria-hidden", "true");
	document.body.style.overflow = "";
}

function VisualizzaEsitoNelModal(response) {
	var modalBody = document.getElementById("invModalBodyContent");
	var modalStatusIcon = document.getElementById("invModalStatusIcon");
	var modalHeaderTitle = document.getElementById("invModalHeaderTitle");
	var modalLoading = document.getElementById("invModalLoading");
	var modalResults = document.getElementById("invModalResults");
	var waBtn = document.getElementById("invModalBtnWA");

	if (modalLoading) modalLoading.style.display = "none";
	if (modalResults) modalResults.style.display = "block";

	// Se la risposta è già un oggetto JSON (o stringa serializzata JSON)
	var jsonData = null;
	if (typeof response === "object" && response !== null) {
		jsonData = response;
	} else if (typeof response === "string") {
		var trimmed = response.trim();
		if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
			try {
				jsonData = JSON.parse(trimmed);
			} catch (e) {
				jsonData = null;
			}
		}
	}

	if (jsonData) {
		var isSuccess = !!jsonData.success;
		if (modalStatusIcon) {
			modalStatusIcon.innerHTML = isSuccess ? "✅" : "⚠️";
		}
		if (modalHeaderTitle) {
			modalHeaderTitle.textContent = isSuccess ? "Operazione Completata con Successo" : "Esito Invio: Riscontrati Errori";
		}
		if (modalBody) {
			if (jsonData.html) {
				modalBody.innerHTML = jsonData.html;
			} else if (jsonData.message) {
				var cls = isSuccess ? "inv-modal-alert-success" : "inv-modal-alert-danger";
				modalBody.innerHTML = "<div class='" + cls + "'>" + (jsonData.message || "") + "</div>";
			}
		}
		if (waBtn) {
			waBtn.style.display = isSuccess ? "inline-flex" : "none";
		}
		return;
	}

	// Fallback di retrocompatibilità: parsing HTML legacy
	var parser = new DOMParser();
	var doc = parser.parseFromString(response, "text/html");
	var contentEl = doc.querySelector(".result-content") || doc.querySelector(".result-card") || doc.body;

	// Rimuovi eventuali bottoni legacy "Chiudi Finestra" del vecchio template PHP
	var legacyBtns = contentEl.querySelectorAll(".btn-close");
	legacyBtns.forEach(function (b) { b.remove(); });

	var contentHtml = contentEl.innerHTML;
	var isError = contentHtml.indexOf("color:#f43f5e") !== -1 || contentHtml.indexOf("⚠️") !== -1 || contentHtml.indexOf("&#x274c;") !== -1;

	if (modalStatusIcon) {
		modalStatusIcon.innerHTML = isError ? "⚠️" : "✅";
	}
	if (modalHeaderTitle) {
		modalHeaderTitle.textContent = isError ? "Esito Invio: Riscontrati Errori" : "Operazione Completata con Successo";
	}

	if (modalBody) {
		modalBody.innerHTML = contentHtml;
	}

	if (waBtn) {
		waBtn.style.display = isError ? "none" : "inline-flex";
	}
}

function VisualizzaErroreNelModal(messaggio) {
	var modalLoading = document.getElementById("invModalLoading");
	var modalResults = document.getElementById("invModalResults");
	var modalStatusIcon = document.getElementById("invModalStatusIcon");
	var modalHeaderTitle = document.getElementById("invModalHeaderTitle");
	var modalBody = document.getElementById("invModalBodyContent");
	var waBtn = document.getElementById("invModalBtnWA");

	if (modalLoading) modalLoading.style.display = "none";
	if (modalResults) modalResults.style.display = "block";

	if (modalStatusIcon) modalStatusIcon.innerHTML = "❌";
	if (modalHeaderTitle) modalHeaderTitle.textContent = "Errore durante l'Invio";

	if (modalBody) {
		modalBody.innerHTML = "<div class='inv-modal-alert-danger'><b>⚠️ Errore di comunicazione:</b><br>" + messaggio + "</div>";
	}
	if (waBtn) {
		waBtn.style.display = "none";
	}
}

function InviaFormazioneAsync() {
	ApriModalEsitoInvio();

	var formEl = document.getElementById("formInvio");
	var formData = new FormData(formEl);

	fetch(scriptServer, {
		method: "POST",
		headers: {
			"Accept": "application/json"
		},
		body: formData
	})
		.then(function (res) {
			if (!res.ok) {
				throw new Error("Il server ha risposto con codice HTTP " + res.status);
			}
			var contentType = res.headers.get("content-type") || "";
			if (contentType.indexOf("application/json") !== -1) {
				return res.json();
			}
			return res.text();
		})
		.then(function (data) {
			VisualizzaEsitoNelModal(data);
		})
		.catch(function (err) {
			VisualizzaErroreNelModal("Impossibile contattare il server: " + (err.message || "Errore sconosciuto") + ". Verifica la connessione e riprova.");
		});
}

// Chiusura del modal tramite tasto ESC o clic sull'overlay
document.addEventListener("keydown", function (e) {
	if (e.key === "Escape" || e.keyCode === 27) {
		var modal = document.getElementById("modalInvioEsito");
		if (modal && modal.classList.contains("visible")) {
			ChiudiModalEsitoInvio();
		}
		var drawerSheet = $drawer("rosterDrawerSheet");
		if (drawerSheet && drawerSheet.classList.contains("open")) {
			ChiudiRosterDrawer();
		}
	}
});

document.addEventListener("click", function (e) {
	var modal = document.getElementById("modalInvioEsito");
	if (modal && e.target === modal) {
		ChiudiModalEsitoInvio();
	}
});

// Funzioni accessorie standard FCM (Invariate)
function AssicuraIdxFsq() {
	if (typeof idxFsq === 'undefined' || !arrFantasquadre[idxFsq] || arrFantasquadre[idxFsq].ID !== cFsq) {
		for (var f = 1; f < arrFantasquadre.length; f++) {
			if (arrFantasquadre[f].ID === cFsq) { idxFsq = f; break; }
		}
	}
	return idxFsq;
}

function GeneraEMailCompleta(ii) {
	AssicuraIdxFsq();
	var fsq = arrFantasquadre[idxFsq].Nome;
	var cmp = ii.Competizione;
	var fsq_cmp = fsq + (incontriDisponibili.length > 1 ? " [" + cmp + "]" : "");
	var oggetto = "Formazione " + fsq_cmp + ", " + cmp + ", " + nomelega + " [MessaggioFrmFCM:" + cGio + "]";
	var corpo1 =
		"Lega: " +
		nomelega +
		"\nSquadra: " +
		fsq_cmp +
		"\nGiornata: " +
		ii.Fantagiornata +
		"\nData e ora: " +
		DataOraCorrente() +
		"\n";
	var corpo2 = "";
	for (var i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		if (i === 1) corpo2 = "--- Titolari ---\n";
		else if (i === 12) corpo2 += "--- Riserve ---\n";
		if (arrFormazione[i] >= 0 && arrFormazione[i] < arrInvioFormazione.length) {
			var gg = arrInvioFormazione[arrFormazione[i]];
			corpo2 += ruoli[gg.Ruolo] + " " + OttieniNomeGiocatore(gg) + " (" + OttieniSquadraSerieA(gg) + ")";
			corpo2 += ii.Rigoristi ? " [R: " + arrRigoristi[i] + "]\n" : "\n";
		}
	}
	var corpo3 =
		"CODICI IDENTIFICATIVI FCM [*NON MODIFICARE*]\n[LEGA]=" +
		CorreggeNomeLega(nomelega) +
		"-" +
		stagione +
		"-" +
		anno.substr(0, 4) +
		"\\\n";
	corpo3 += "[IDSQUADRA]=" + cFsq + "\\\n[GIORNATADIA]=" + cGio + "\\\n[IDINCONTRO]=" + ii.ID + "\\\n[FRMCODE]=";
	for (i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		if (arrFormazione[i] >= 0 && arrFormazione[i] < arrInvioFormazione.length) {
			gg = arrInvioFormazione[arrFormazione[i]];
			corpo3 += (i !== 1 ? "-" : "") + gg.ID;
			corpo3 += ii.Rigoristi ? "R" + arrRigoristi[i] : "";
		}
	}
	corpo3 +=
		"\\\n\nComunicazioni: " + (!nascondiComunicazioni ? document.getElementById("fi_comunicazioni").value : "");
	return { oggetto: oggetto, corpo: corpo1 + "\n" + corpo2 + "\n" + corpo3 };
}
function GeneraEMailRidotta(ii) {
	AssicuraIdxFsq();
	var fsq = arrFantasquadre[idxFsq].Nome;
	var cmp = ii.Competizione;
	var oggetto = "Formazione " + fsq + ", " + ii.Descrizione;
	var corpo1 =
		"Lega: " +
		nomelega +
		"\nSquadra: " +
		fsq +
		"\nCompetizione: " +
		cmp +
		"\nGiornata: " +
		ii.Fantagiornata +
		"\nIncontro: " +
		ii.Nomi.Casa +
		" - " +
		ii.Nomi.Fuori +
		"\n";
	var corpo2 = "";
	for (var i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		if (i === 1) corpo2 = "--- Titolari ---\n";
		else if (i === 12) corpo2 += "--- Riserve ---\n";
		if (arrFormazione[i] >= 0) {
			var gg = arrInvioFormazione[arrFormazione[i]];
			corpo2 += ruoli[gg.Ruolo] + " " + OttieniNomeGiocatore(gg) + " (" + OttieniSquadraSerieA(gg) + ")";
			corpo2 += ii.Rigoristi ? " [R: " + arrRigoristi[i] + "]\n" : "\n";
		}
	}
	var corpo3 = "";
	if (!nascondiComunicazioni) {
		var c = document.getElementById("fi_comunicazioni").value;
		if (c !== "") corpo3 = "\nComunicazioni: " + c;
	}
	return { oggetto: oggetto, corpo: corpo1 + "\n" + corpo2 + corpo3 };
}
function ControllaFormazione() {
	if (titolariInseriti !== 11) {
		alert("Inserire 11 titolari");
		return false;
	}
	if (regolaPanchina) {
		var ruoliSenzaRiserve = 0;
		for (var i = 1; i <= 4; ++i) if (riserveInserite[i] === 0) ruoliSenzaRiserve++;
		if (ruoliSenzaRiserve > totaleNumeroMassimoRiserve - totaleRiserveInserite) {
			alert("Inserire almeno una riserva per ruolo");
			return false;
		}
	}
	if (totaleRiserveInserite < totaleNumeroMassimoRiserve)
		if (!confirm("Formazione incompleta. Inviare comunque?")) return false;
	controllaRigoristi = false;
	if (mostraRigoristi) {
		for (var i = 1; i <= incontriDisponibili.length; i++) {
			if (document.getElementById("incontro" + i).checked) {
				var ii = arrIncontri[document.getElementById("incontro" + i).value];
				if (ii.Rigoristi) controllaRigoristi = true;
			}
		}
	}
	if (!controllaRigoristi) return true;
	for (i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++)
		if (arrFormazione[i] >= 0) arrInvioFormazione[arrFormazione[i]].Rigorista = arrRigoristi[i];

	// Controllo partizione titolari (1-11)
	for (i = 1; i <= 11; i++) {
		if (arrFormazione[i] >= 0 && (arrRigoristi[i] < 1 || arrRigoristi[i] > 11)) {
			alert("I titolari devono avere un ordine rigorista da 1 a 11");
			return false;
		}
	}
	// Controllo partizione panchina (12+)
	for (i = 12; i <= 11 + totaleNumeroMassimoRiserve; i++) {
		if (arrFormazione[i] >= 0 && (arrRigoristi[i] < 12 || arrRigoristi[i] > (11 + totaleNumeroMassimoRiserve))) {
			alert("I giocatori in panchina devono avere un ordine rigorista dal 12 in poi");
			return false;
		}
	}

	for (i = 1; i < 11 + totaleNumeroMassimoRiserve; i++)
		for (var j = i + 1; j <= 11 + totaleNumeroMassimoRiserve; j++)
			if (arrFormazione[i] >= 0 && arrFormazione[j] >= 0 && arrRigoristi[i] === arrRigoristi[j]) {
				alert("Rigoristi duplicati");
				return false;
			}
	var isGkRuleActive = (typeof regolaRigoristi !== 'undefined' && Number(regolaRigoristi) === 1);
	if (isGkRuleActive)
		for (i = 1; i <= 11 + totaleNumeroMassimoRiserve; i++)
			if (arrFormazione[i] >= 0 && arrRigoristi[i] < 11 && arrInvioFormazione[arrFormazione[i]].Ruolo === 1) {
				alert("Il portiere non può essere compreso tra i primi 10 rigoristi (regola attiva). Spostalo all'11° posto o successivo.");
				return false;
			}
	return true;
}
function OttieneDestinatari(ii) {
	var destCompleta = [],
		destRidotta = [];
	if (destinatariEMail[0]) destCompleta.push(0);
	var idAvv = ii.IDSquadre.Casa === cFsq ? ii.IDSquadre.Fuori : ii.IDSquadre.Casa;
	for (var f = 1; f < arrFantasquadre.length; ++f) {
		var id = arrFantasquadre[f].ID;
		if (destinatariEMail[2] || (destinatariEMail[1] && id === idAvv) || (destinatariEMail[3] && id === cFsq))
			if (id !== idPresidente || !destinatariEMail[0]) {
				if (eMailRidotta) destRidotta.push(id);
				else destCompleta.push(id);
			}
	}
	return { completa: destCompleta, ridotta: destRidotta };
}
function GeneraDatiSalvataggioSuSito(ii) {
	var formazione = [],
		altri = [];
	var idLega = ii.IDSquadre.Casa === cFsq ? ii.IDLegaSquadre.Casa : ii.IDLegaSquadre.Fuori;
	for (var i = 0; i < arrRosa.length; i++) {
		var gg = arrInvioFormazione[arrRosa[i]];
		if (gg.Formazione === 0)
			altri.push(
				ii.ID + "," + cFsq + "," + idLega + "," + gg.Nome + "," + gg.SquadraDiA + "," + gg.Ruolo + ",-1,0"
			);
		else {
			var pos = gg.Formazione <= 11 ? 0 : gg.Formazione - 11;
			formazione[gg.Formazione - 1] =
				ii.ID +
				"," +
				cFsq +
				"," +
				idLega +
				"," +
				gg.Nome +
				"," +
				gg.SquadraDiA +
				"," +
				gg.Ruolo +
				"," +
				pos +
				"," +
				(ii.Rigoristi ? gg.Rigorista : 0);
		}
	}
	return formazione.concat(altri);
}
function GeneraDatiTelegram(ii, messaggio) {
	AssicuraIdxFsq();
	var resMsg = messaggio || "";
	if (resMsg.length === 0) {
		var int =
			"*" +
			arrFantasquadre[idxFsq].Nome.toUpperCase() +
			"* (" +
			moduloInserito[2] +
			"-" +
			moduloInserito[3] +
			"-" +
			moduloInserito[4] +
			")\n";
		var tit = "";
		var ru = 0;
		for (var i = 1; i <= 11; i++) {
			var gg = arrInvioFormazione[arrFormazione[i]];
			if (gg.Ruolo !== ru) tit += "\n*" + ruoli[gg.Ruolo] + ")* ";
			else tit += ", ";
			tit += OttieneNomeGiocatoreRidotto(gg);
			if (controllaRigoristi) tit += " [R:" + gg.Rigorista + "]";
			ru = gg.Ruolo;
		}
		var ris = "";
		ru = 0;
		for (var i = 12; i <= 11 + totaleNumeroMassimoRiserve; i++)
			if (arrFormazione[i] >= 0) {
				var gg = arrInvioFormazione[arrFormazione[i]];
				if (ris.length === 0) ris = "\n\n*Panchina:* ";
				else {
					if (panchinaOrdinata && gg.Ruolo !== ru) ris += "; ";
					else ris += ", ";
				}
				ris += OttieneNomeGiocatoreRidotto(gg);
				if (controllaRigoristi) ris += " [R:" + gg.Rigorista + "]";
				ru = gg.Ruolo;
			}
		resMsg = int + tit + ris;
	}
	var comp = "\n\u2022 _" + ii.Competizione + ": " + ii.Fantagiornata + "_\n";
	if (ii.IDTipo !== INC_GRANPREMIO) comp += "   _" + ii.Nomi.Casa + " - " + ii.Nomi.Fuori + "_\n";
	var idx = resMsg.indexOf("\n\n");
	if (idx >= 0) resMsg = resMsg.substring(0, idx) + comp + resMsg.substr(idx + 1);
	return resMsg;
}

function GeneraMessaggioWhatsApp() {
	AssicuraIdxFsq();
	var nomeSquadra = (typeof arrFantasquadre !== 'undefined' && arrFantasquadre[idxFsq] && arrFantasquadre[idxFsq].Nome)
		? arrFantasquadre[idxFsq].Nome
		: "Squadra";
	var strModulo = moduloInserito[2] + "-" + moduloInserito[3] + "-" + moduloInserito[4];

	// Informazioni incontro/competizione
	var infoIncontro = "";
	if (typeof incontriDisponibili !== 'undefined' && typeof arrIncontri !== 'undefined') {
		for (var i = 1; i <= incontriDisponibili.length; ++i) {
			var chk = document.getElementById("incontro" + i);
			if (chk && chk.checked) {
				var ii = arrIncontri[chk.value];
				if (ii) {
					infoIncontro = ii.Competizione + " (" + ii.Fantagiornata + ")";
					if (typeof INC_GRANPREMIO !== 'undefined' && ii.IDTipo !== INC_GRANPREMIO && ii.Nomi) {
						infoIncontro += "\n🥅 " + ii.Nomi.Casa + " vs " + ii.Nomi.Fuori;
					}
					break;
				}
			}
		}
	}

	var msg = "👕 *" + nomeSquadra.toUpperCase() + "*\n";
	msg += "📋 Modulo: *" + strModulo + "*\n";
	if (infoIncontro) {
		msg += "🏆 " + infoIncontro + "\n";
	}

	msg += "\n*TITOLARI:*\n";
	for (var i = 1; i <= 11; i++) {
		if (arrFormazione[i] >= 0 && arrInvioFormazione[arrFormazione[i]]) {
			var gg = arrInvioFormazione[arrFormazione[i]];
			var nomeG = OttieniNomeGiocatore(gg);
			var sqA = OttieniSquadraSerieA(gg);
			var rig = (gg.Rigorista && gg.Rigorista > 0) ? " [R:" + gg.Rigorista + "]" : "";
			msg += ruoli[gg.Ruolo] + " • " + nomeG + " (" + sqA + ")" + rig + "\n";
		}
	}

	var riserve = [];
	for (var j = 12; j <= 11 + totaleNumeroMassimoRiserve; j++) {
		if (arrFormazione[j] >= 0 && arrInvioFormazione[arrFormazione[j]]) {
			var ggRis = arrInvioFormazione[arrFormazione[j]];
			var nomeGRis = OttieniNomeGiocatore(ggRis);
			var sqARis = OttieniSquadraSerieA(ggRis);
			var rigRis = (ggRis.Rigorista && ggRis.Rigorista > 0) ? " [R:" + ggRis.Rigorista + "]" : "";
			riserve.push(ruoli[ggRis.Ruolo] + " • " + nomeGRis + " (" + sqARis + ")" + rigRis);
		}
	}

	if (riserve.length > 0) {
		msg += "\n*PANCHINA:*\n" + riserve.join("\n") + "\n";
	}

	var elCom = document.getElementById("fi_comunicazioni");
	if (elCom && elCom.value && elCom.value.trim() !== "") {
		msg += "\n💬 *Note:* " + elCom.value.trim() + "\n";
	}

	return msg;
}

function CondividiSuWhatsApp() {
	if (titolariInseriti < 11) {
		alert("⚠️ Inserisci tutti gli 11 titolari prima di condividere la formazione su WhatsApp!");
		return;
	}
	var testo = GeneraMessaggioWhatsApp();
	var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(testo);
	window.open(url, "_blank");
}

function DataOraCorrente() {
	var d = new Date();
	var g = ("0" + d.getDate()).slice(-2);
	var m = ("0" + (d.getMonth() + 1)).slice(-2);
	var a = d.getFullYear();
	var hh = ("0" + d.getHours()).slice(-2);
	var mm = ("0" + d.getMinutes()).slice(-2);
	return g + "/" + m + "/" + a + " " + hh + "." + mm;
}
function CorreggeNomeLega(n) {
	return n.replace(/[*"'\\\/:|?]/g, "_");
}
function OttieneNomeGiocatoreRidotto(gg) {
	var nome = OttieniNomeGiocatore(gg);
	var cognome = EstraiCognome(nome);
	if (!cognome) return nome;
	return cognome.charAt(0).toUpperCase() + cognome.slice(1).toLowerCase();
}

function FormattaDataOraTermineInvio() {
	if (typeof termineInvio === 'undefined' || !termineInvio || !termineInvio.dataOraTermine) return "";
	if (!(termineInvio.dataOraTermine instanceof Date)) {
		termineInvio.dataOraTermine = new Date(termineInvio.dataOraTermine);
	}
	var options = { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
	try {
		return termineInvio.dataOraTermine.toLocaleString('it-IT', options);
	} catch (e) {
		return "";
	}
}

function AggiornaTempoRimasto() {
	if (typeof termineInvio === 'undefined' || !termineInvio || !termineInvio.dataOraTermine) return;

	if (!(termineInvio.dataOraTermine instanceof Date)) {
		termineInvio.dataOraTermine = new Date(termineInvio.dataOraTermine);
	}
	var offset = (typeof termineInvio.offsetServer === 'number') ? termineInvio.offsetServer : 0;
	var s = Math.floor((termineInvio.dataOraTermine.getTime() - new Date().getTime() - offset) / 1000);

	var el = document.getElementById('tempoRimasto');
	var badge = document.getElementById('invDeadlineBadge');

	if (s > 0) {
		var gg = (s / 86400) | 0;
		var hh = ((s % 86400) / 3600) | 0;
		var mm = ((s % 3600) / 60) | 0;
		var ss = (s % 60) | 0;

		var strH = hh < 10 ? "0" + hh : hh;
		var strM = mm < 10 ? "0" + mm : mm;
		var strS = ss < 10 ? "0" + ss : ss;
		var text = "- " + (gg > 0 ? gg + "g " : "") + strH + ":" + strM + ":" + strS;

		if (el) {
			el.innerText = text;
			el.style.color = "#ffffff";

			if (s < 300) {
				// Ultimi 5 minuti: stato urgente con animazione e sfondo rosso vivido, testo BIANCO purissimo
				el.classList.add('urgent');
				el.classList.remove('warning', 'is-scaduto');
				if (badge) {
					badge.classList.add('is-urgent');
					badge.classList.remove('is-expired');
				}
			} else if (s < 3600) {
				// Ultima ora: stato di attenzione
				el.classList.add('warning');
				el.classList.remove('urgent', 'is-scaduto');
				if (badge) {
					badge.classList.remove('is-urgent', 'is-expired');
				}
			} else {
				// Oltre un'ora: stato standard
				el.classList.remove('warning', 'urgent', 'is-scaduto');
				if (badge) {
					badge.classList.remove('is-urgent', 'is-expired');
				}
			}
		}
	} else {
		// Scaduto!
		if (termineInvio.funzione) {
			clearInterval(termineInvio.funzione);
			termineInvio.funzione = null;
		}

		if (el) {
			el.innerText = "SCADUTO";
			el.style.color = "#ffffff";
			el.classList.remove('warning', 'urgent');
			el.classList.add('is-scaduto');
		}
		if (badge) {
			badge.classList.remove('is-urgent');
			badge.classList.add('is-expired');
		}

		// Scomparsa dinamica degli elementi di invio
		GestisciTermineScaduto(false);
	}
}

// Pulizia timer interval alla disattivazione/chiusura/navigazione della pagina o frame
window.addEventListener("pagehide", function () {
	if (typeof termineInvio !== "undefined" && termineInvio && termineInvio.funzione) {
		clearInterval(termineInvio.funzione);
		termineInvio.funzione = null;
	}
});

