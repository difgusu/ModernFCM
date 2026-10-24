function PerCentoFG(ID, tabella) {
	var ind = (typeof arrIndisponibili !== 'undefined') ? arrIndisponibili[ID] : undefined;
	var pcFG = (typeof arrPercento !== 'undefined') ? arrPercento[ID] : undefined;

	var percentuale = "&nbsp;&nbsp;0";
	var statoimg = "x";
	var type = 1;

	if (typeof (pcFG) !== 'undefined') {
		percentuale = pcFG.Percentuale;
		var stato = pcFG.Stato;
		if (stato == 1) {
			statoimg = "t";
			type = (percentuale > 75) ? 1 : 2;
		} else if (stato == 0) {
			statoimg = "p";
			type = (percentuale > 40) ? 1 : 2;
		}
		if (percentuale < 10) percentuale = "&nbsp;&nbsp;" + percentuale;
	}

	var baseImg = (typeof window !== 'undefined' && window.location && window.location.pathname.indexOf('/invform/') !== -1) ? '../img/prob_form/' : 'img/prob_form/';

	var imgHtml = '';
	if (typeof (ind) !== 'undefined') {
		var motClean = (ind.Motivo || "").replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		var rieClean = (ind.Rientro || "").replace(/\\'/g, "'").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		var isDubbio = (ind.Stato == 4 || (ind.Motivo && ind.Motivo.toLowerCase().indexOf('dubbio') !== -1));

		if (ind.Stato == 2 || (ind.Motivo && ind.Motivo.toLowerCase() === 'squalificato')) {
			imgHtml = "<img class='infortunio' data-id='" + ID + "' data-rientro='' data-motivo='Squalificato' style='border:none;vertical-align:middle;cursor:pointer;' alt='Squalificato' src='" + baseImg + "status_s.gif' height='13' width='12'/>";
		} else {
			var dImg = (statoimg === 't' ? 'status_d_t.gif' : (statoimg === 'p' ? 'status_d_p.gif' : 'status_d.gif'));
			var imgFile = isDubbio ? dImg : "status_i.gif";
			var altText = isDubbio ? "In dubbio" : "Infortunato";
			imgHtml = "<img class='infortunio' data-id='" + ID + "' data-rientro=\"" + rieClean + "\" data-motivo=\"" + (motClean || altText) + "\" src=\"" + baseImg + imgFile + "\" alt=\"" + altText + "\" style='vertical-align:middle;cursor:pointer;' height='13' width='12' />";
		}
	} else {
		imgHtml = "<img style='border:none;vertical-align:middle;' src='" + baseImg + "status_" + statoimg + type + ".gif' height='13' width='12'/>";
	}

	return (tabella == 1) ? (percentuale + "% " + imgHtml) : imgHtml;
}