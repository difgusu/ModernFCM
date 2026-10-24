async function getprobform(squadra) {
	const url = 'https://sport.sky.it/calcio/serie-a/probabili-formazioni';

	$('.sqbutton ul li a').removeClass('active');
	$('.sqbutton ul li a').each(function () {
		var href = $(this).attr('href') || '';
		if (href.toLowerCase().indexOf("'" + squadra.toLowerCase() + "'") !== -1) {
			$(this).addClass('active');
		}
	});

	$(".prossima-giornata").html("");
	$(".prossima-partita").html("");
	$('.campo').html('<div style="text-align:center;padding:40px;"><img src="probimg/load.gif" alt="Caricamento..." /></div>');
	$(".panchina").html("");
	$(".indisponibili").html("");
	$(".squalificati").html("");
	$(".diffidati").html("");
	$(".altri").html("");
	$(".ballottaggi").html("");
	$(".notizie").html("");

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error("Risposta HTTP " + response.status);
		const text = await response.text();
		const documentSky = new DOMParser().parseFromString(text, "text/html");
		const widget = documentSky.querySelector("ld-football-competition-predicted-lineups");
		if (!widget) throw new Error("Widget delle formazioni non trovato");

		const normalizza = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
		const nomeCercato = normalizza(squadra);
		const partita = [...widget.querySelectorAll(".ftbl__predicted-lineups-hp")].find(section =>
			[...section.querySelectorAll(".ftbl__team__name")].some(team => normalizza(team.textContent.trim()) === nomeCercato)
		);
		if (!partita) {
			$(".campo").html("<div style='text-align:center;padding:30px;color:var(--text-muted);'>Formazione non trovata per la squadra selezionata</div>");
			return;
		}

		const nomiSquadre = [...partita.querySelectorAll(".ftbl__team__name")].map(el => el.textContent.trim());
		const moduli = [...partita.querySelectorAll(".ftbl__formation-home, .ftbl__formation-away")].map(el => el.textContent.trim());
		const data = partita.querySelector(".ftbl__predicted-lineups-hp__date-long")?.textContent.trim() || "";
		const ora = [...partita.querySelectorAll("span")].find(el => /^ore\s+\d{2}:\d{2}$/i.test(el.textContent.trim()))?.textContent.trim() || "";
		const giornataMatch = widget.textContent.match(/Giornata\s+\d+/i);
		const giornata = giornataMatch ? giornataMatch[0] : "";
		const colonne = [...partita.querySelectorAll(".ftbl__match-formation-player")];
		const titolari = colonne.slice(0, 22);
		const indiceSquadra = normalizza(nomiSquadre[0]) === nomeCercato ? 0 : 1;
		const giocatori = titolari.slice(indiceSquadra * 11, indiceSquadra * 11 + 11);
		const moduloRaw = moduli[indiceSquadra] || "";
		const moduloArray = [1, ...moduloRaw.split("-").map(Number)];
		const righe = [...partita.querySelectorAll("tr")];
		const estraiSezione = titolo => {
			const intestazione = righe.find(el => el.classList.contains("ftbl__report-tabs-panel__header") && el.textContent.trim() === titolo);
			if (!intestazione) return "";
			const attributo = indiceSquadra === 0 ? "data-panel-left" : "data-panel-right";
			let riga = intestazione.nextElementSibling;
			while (riga && !riga.classList.contains("ftbl__report-tabs-panel__header")) {
				if (riga.getAttribute(attributo) === "true") {
					return riga.querySelector(".ftbl__report-tabs-panel__td")?.textContent.trim() || "";
				}
				riga = riga.nextElementSibling;
			}
			return "";
		};
		const panchina = estraiSezione("Riserve");
		const indisponibili = estraiSezione("Indisponibili");
		const squalificati = estraiSezione("Squalificati");
		const dubbio = estraiSezione("In dubbio");
		const allenatore = estraiSezione("Allenatore");

		const campettoHtml = generaCampetto(moduloArray, giocatori, squadra);
		const htmlContenuto = `
			<div class="campo-header">
				<div class="modulo">${moduloRaw}</div>
			</div>
			${campettoHtml}
			<div class='allenatore'>All. ${allenatore}</div>
		`;

		$(".prossima-giornata").html(`Serie A, ${giornata}, ${data}, ${ora}`);
		$(".prossima-partita").html(nomiSquadre.join(" - "));
		$(".campo").html(htmlContenuto);
		$(".panchina").html(panchina || "-");
		$(".indisponibili").html(indisponibili || "-");
		$(".squalificati").html(squalificati || "-");
		$(".dubbio").html(dubbio || "-");
		if (typeof window.sendProbHeight === "function") {
			setTimeout(window.sendProbHeight, 50);
		}
	} catch (error) {
		console.error(error);
		$(".campo").html("<div style='text-align:center;padding:30px;color:var(--text-muted);'>Errore nel caricamento delle formazioni Sky</div>");
		if (typeof window.sendProbHeight === "function") {
			setTimeout(window.sendProbHeight, 50);
		}
	}
}

function impostaFormazione(json) {
	var categoria = json.categoria;
	var giornata = "Giornata " + json.giornata;
	var data = json.data;
	var ora = json.ora;
	var partita = json.partita;
	var modulo = "<div class='modulo'>" + json.modulo + "</div>";
	var panchina = json.panchina.calciatore;
	var panchinari = "";
	var indisponibili = json.indisponibili.calciatore;
	var indisponibiliString = "";
	var squalificati = json.squalificati.calciatore;
	var squalificatiString = "";
	var diffidati = json.diffidati.calciatore;
	var diffidatiString = "";
	var altri = json.altri.calciatore;
	var altriString = "";
	var ballottaggi = json.ballottaggi.calciatore;
	var ballottaggiString = "";
	var titolari = json.titolari.calciatore;
	var squadra = json.squadra;
	var formazione = "";
	var allenatore = "";
	var reparti = json.modulo.split("-");
	var notizie = json.testo;

	formazione = "<div class='titolari portiere separatore'>" + ((titolari[0].number).length == 1 ? titolari[0].number + "&nbsp;&nbsp;" : titolari[0].number) + "<img src='probimg/" + squadra.toLowerCase() + ".png'> " + titolari[0] + "</div>";
	idxTitolari = 1;
	for (var j = 0; j < reparti.length; j++) {
		for (var i = 0; i < parseInt(reparti[j]); i++) {
			if (i == parseInt(reparti[j]) - 1) {
				formazione += "<div class='titolari separatore'>" + ((titolari[i + idxTitolari].number).length == 1 ? titolari[i + idxTitolari].number + "&nbsp;&nbsp;" : titolari[i + idxTitolari].number) + "<img src='probimg/" + squadra.toLowerCase() + ".png'> " + titolari[i + idxTitolari] + "</div>";
			} else {
				formazione += "<div class='titolari'>" + ((titolari[i + idxTitolari].number).length == 1 ? titolari[i + idxTitolari].number + "&nbsp;&nbsp;" : titolari[i + idxTitolari].number) + "<img src='probimg/" + squadra.toLowerCase() + ".png'> " + titolari[i + idxTitolari] + "</div>";
			}
		}
		idxTitolari += parseInt(reparti[j]);
	}

	allenatore = "<div class='allenatore'>All. " + json.allenatore + "</div>";

	if (json.panchina != "") {
		if (typeof panchina != "string") {
			for (var i = 0; i < panchina.length; i++) {
				panchinari += panchina[i] + ", ";
			}
		} else {
			panchinari = panchina;
		}
	}

	if (json.indisponibili != "") {
		if (typeof indisponibili != "string") {
			for (var i = 0; i < indisponibili.length; i++) {
				indisponibiliString += indisponibili[i] + ", ";
			}
		} else {
			indisponibiliString = indisponibili;
		}
	}

	if (json.squalificati != "") {
		if (typeof squalificati != "string") {
			for (var i = 0; i < squalificati.length; i++) {
				squalificatiString += squalificati[i] + ", ";
			}
		} else {
			squalificatiString = squalificati;
		}
	}

	if (json.diffidati != "") {
		if (typeof diffidati != "string") {
			for (var i = 0; i < diffidati.length; i++) {
				diffidatiString += diffidati[i] + ", ";
			}
		} else {
			diffidatiString = diffidati;
		}
	}

	if (json.altri != "") {
		if (typeof altri != "string") {
			for (var i = 0; i < altri.length; i++) {
				altriString += altri[i] + ", ";
			}
		} else {
			altriString = altri;
		}
	}

	if (json.ballottaggi != "") {
		if (typeof ballottaggi != "string") {
			for (var i = 0; i < ballottaggi.length; i++) {
				ballottaggiString += ballottaggi[i] + ", ";
			}
		} else {
			ballottaggiString = ballottaggi;
		}
	}

	if (json.testo != "") {
		if (typeof notizie != "string") {
			for (var i = 0; i < notizie.length; i++) {
				notizieString += notizie[i] + ", ";
			}
		} else {
			notizieString = notizie;
		}
	}

	$(".campo").html("<img src='probimg/" + squadra.toLowerCase() + "_scudetto.png' border='0' style='float:right'>" + modulo + formazione + allenatore);
	$(".panchina").html(panchinari);
	$(".indisponibili").html(indisponibiliString);
	$(".squalificati").html(squalificatiString);
	$(".diffidati").html(diffidatiString);
	$(".altri").html(altriString);
	$(".ballottaggi").html(ballottaggiString);
	$(".notizie").html(notizieString);
	$(".prossima-giornata").html(categoria + ", " + giornata + ", " + data + ", " + ora);
	$(".prossima-partita").html(partita);
}

function generaCampetto(moduloArray, giocatori, squadra) {
	const is4Lines = moduloArray.length === 5;
	let pitchHtml = `<div class='campo-pitch ${is4Lines ? "pitch-lines-4" : "pitch-lines-3"}'>`;

	// SVG Field Markings
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
        <!-- Lunette calci d'angolo -->
        <path d="M 8 20 A 12 12 0 0 0 20 8" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 280 8 A 12 12 0 0 0 292 20" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 8 400 A 12 12 0 0 1 20 412" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <path d="M 280 412 A 12 12 0 0 1 292 400" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      </svg>
    `;

	let playerIdx = 0;
	for (let reparto = 0; reparto < moduloArray.length; reparto++) {
		const count = moduloArray[reparto];
		const rowClass = count === 1 ? "pitch-row-single" : (count === 2 ? "pitch-row-duo" : "pitch-row-wide");

		let rowHtml = `<div class='pitch-row pitch-row-${reparto} ${rowClass}'>`;
		for (let pos = 0; pos < count; pos++) {
			const el = giocatori[playerIdx++];
			if (!el) continue;
			const numero = el.querySelector(".ftbl__match-formation-player--jerseyNum")?.textContent.trim() || "";
			const link = el.querySelector("a")?.getAttribute("href") || "";
			const nome = el.querySelector("a")?.textContent.trim() || "";
			const portiere = (reparto === 0 && pos === 0);
			const ruolo = portiere ? "Goalkeeper" : "Player";

			rowHtml += `
              <div class="pitch-player" data-link="${link}" data-name="${nome}" data-surname="" data-role="${ruolo}" data-goalkeeper="${portiere}">
                <div class="pitch-player-avatar ${portiere ? 'avatar-gk' : ''}">
                  <img src="probimg/${squadra.toLowerCase()}.png" class="pitch-jersey" onerror="this.style.display='none'">
                  <span class="pitch-player-num">${numero}</span>
                </div>
                <div class="pitch-player-name" title="${nome}">${nome}</div>
              </div>
            `;
		}
		rowHtml += `</div>`;
		pitchHtml += rowHtml;
	}
	pitchHtml += `</div>`;
	return pitchHtml;
}

function setProbView(view) {
	if (view === 'campetto') {
		$('#btnViewLista').removeClass('active');
		$('#btnViewCampetto').addClass('active');
		$('#probViewLista').hide();
		$('#probViewCampetto').show();
	} else {
		$('#btnViewCampetto').removeClass('active');
		$('#btnViewLista').addClass('active');
		$('#probViewCampetto').hide();
		$('#probViewLista').show();
	}
	if (typeof window.sendProbHeight === 'function') {
		setTimeout(window.sendProbHeight, 50);
	}
}
if (typeof window !== 'undefined') {
	window.setProbView = setProbView;
}

