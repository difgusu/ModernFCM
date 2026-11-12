<?php

/**
 * invform.php (ex sendmail.php)
 *
 * @author Marcello 'John Doe' Puri
 * @copyright Copyright (C) 2005-2023 Marcello 'John Doe' Puri
 * @license http://www.gnu.org/copyleft/gpl.html GNU General Public License
 * @version 2.4.0 (30/08/2023)
 */

require 'ApiMailer/ApiMailer.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';
require 'PHPMailer/Exception.php';
require 'TelegramBotPHP/Telegram.php';
require 'invform.inc.php';
if (file_exists(dirname(__DIR__) . '/inc/admin_config.inc.php')) {
	require_once dirname(__DIR__) . '/inc/admin_config.inc.php';
}
require_once dirname(__DIR__) . '/inc/admin_security.inc.php';

use PHPMailer\PHPMailer\PHPMailer;

/**
 * @global string FIRMA
 */
const FIRMA = '<p><b>invform.php versione 2.4.0</b><br /><span class="t-xs">Copyright &copy; 2005-2023 johndoe</span></p>';

/**
 * Limiti di un invio, larghi rispetto a ciò che la pagina spedisce davvero: una formazione per
 * ogni incontro della squadra nella giornata, una riga per ogni giocatore della rosa, al massimo
 * due e-mail per formazione (completa e ridotta) e un solo messaggio Telegram.
 * Le lunghezze dei testi sono in byte.
 */
const MAX_FORMAZIONI = 10;
const MAX_RIGHE_FORMAZIONE = 100;
const MAX_EMAIL_FORMAZIONE = 2;
const MAX_BYTE_OGGETTO = 500;
const MAX_BYTE_CORPO = 20000;
const MAX_BYTE_TELEGRAM = 4096;

/**
 * Secondi che devono passare tra due invii della stessa squadra
 */
const SECONDI_TRA_INVII = 10;

/**
 * Invii che una squadra può fare in un'ora: ben più delle correzioni che servono a ridosso di una
 * scadenza, ma una sola squadra non può consumare in pochi minuti la quota del servizio di posta
 */
const MAX_INVII_ORA = 12;

/**
 * Script principale
 */
$isAjax = (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
	|| (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
	|| (isset($_REQUEST['format']) && $_REQUEST['format'] === 'json');

$rawInput = trim(file_get_contents('php://input'));
$GLOBALS['_PN_JSON_BODY'] = null;
if (!empty($rawInput) && ($rawInput[0] === '{' || $rawInput[0] === '[')) {
	$isAjax = true;
	$jsonTest = json_decode($rawInput, true);
	if (is_array($jsonTest)) {
		$GLOBALS['_PN_JSON_BODY'] = $jsonTest;
		if (isset($jsonTest['azione'])) {
			$_REQUEST['azione'] = $jsonTest['azione'];
		}
	}
}

$azione = isset($_REQUEST['azione']) ? $_REQUEST['azione'] : '';
if ($azione === 'inviaFormazione') {
	// L'invio salva dati e spedisce messaggi: solo POST, così non basta far aprire un link
	fcm_require_post();
}
if ($azione == 'ottieneTermine') {
	restituisceTermine();
} elseif ($isAjax) {
	if ($azione === 'inviaFormazione') {
		inviaFormazione(true);
	} else {
		header('Content-Type: application/json; charset=UTF-8');
		echo json_encode([
			'success' => false,
			'message' => 'Azione non valida'
		], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		exit;
	}
} else {
	// La pagina parte solo alla fine: i controlli d'accesso devono poter ancora impostare cookie
	ob_start();
	print <<<EOT
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Esito Invio Formazione</title>
<style>
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0b1120;
    color: #f8fafc;
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 90vh;
    box-sizing: border-box;
  }
  .result-card {
    background: #131d35;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 24px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }
  h2.result-title {
    margin: 0 0 16px 0;
    font-size: 1.15rem;
    font-weight: 800;
    color: #38bdf8;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding-bottom: 10px;
  }
  .result-content {
    font-size: 0.9rem;
    line-height: 1.6;
    color: #cbd5e1;
    margin-bottom: 20px;
  }
  .result-content b {
    color: #fff;
  }
  .btn-close {
    display: inline-block;
    background: #2563eb;
    color: #fff;
    text-decoration: none;
    padding: 8px 22px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-close:hover {
    background: #1d4ed8;
  }
</style>
<script type="text/javascript">
	window.addEventListener('load', function() {
		window.resizeTo(window.outerWidth, document.documentElement.scrollHeight + (window.outerHeight - window.innerHeight));
	});
</script>
</head>
<body>
<div class="result-card">
<h2 class="result-title">Esito Invio Formazione</h2>
<div class="result-content">
EOT;
	if ($azione === 'inviaFormazione')
		inviaFormazione(false);
	else
		print(FIRMA);

	print <<<EOT
</div>
<div style="text-align:center;">
  <a class="btn-close" href="#" onclick="window.close(); return false;">Chiudi Finestra</a>
</div>
</div>
</body>
</html>
EOT;
}

/**
 * Esegue tutte le operazioni configurate per la formazione:
 * - invio e-mail
 * - salvataggio su sito
 * - inoltro a Telegram
 *
 * @param bool $asJson se true, restituisce una risposta JSON strutturata
 */
function inviaFormazione($asJson = false)
{
	global $passwords, $controllaOrarioInvio, $inviaEMail, $destinatariEMail, $pname,
		   $salvaSuSito, $inoltraATelegram, $adminPassword;

	$isJsonOutput = $asJson;
	$esiti = [];
	$hasErrors = false;
	$errorMsg = '';

	ob_start();

	// Supporto per payload JSON diretto o classico application/x-www-form-urlencoded / multipart
	$jsonPayload = $GLOBALS['_PN_JSON_BODY'] ?? null;

	// Un parametro inviato come array (pname[]=...) non deve provocare un errore fatale
	$pnameRaw = isset($jsonPayload['pname']) ? $jsonPayload['pname'] : ($_REQUEST['pname'] ?? 'invform');
	$pnameVal = is_string($pnameRaw) ? trim($pnameRaw) : '';
	$isAdmin = ($pnameVal === "invform_prec");
	if (!$isAdmin && $pnameVal !== "invform") {
		$hasErrors = true;
		$errorMsg = 'Parametro pname non valido';
		print("<div style=\"color:#f43f5e; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); padding:12px; border-radius:8px; font-weight:bold; margin-bottom:12px;\">⚠️ Parametro pname non valido</div>");
		$htmlOutput = ob_get_clean();
		if ($isJsonOutput) {
			header('Content-Type: application/json; charset=UTF-8');
			echo json_encode([
				'success' => false,
				'message' => $errorMsg,
				'results' => [],
				'html' => $htmlOutput
			], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
			exit;
		} else {
			echo $htmlOutput;
			return;
		}
	}

	$idSquadra = isset($jsonPayload['idSquadra']) ? intval($jsonPayload['idSquadra']) : (isset($_REQUEST['idSquadra']) ? intval($_REQUEST['idSquadra']) : 0);
	$giornataDiA = isset($jsonPayload['giornataDiA']) ? intval($jsonPayload['giornataDiA']) : (isset($_REQUEST['giornataDiA']) ? intval($_REQUEST['giornataDiA']) : 0);
	// Le password si leggono solo dal corpo della richiesta: nella query string resterebbero nei log del server
	$password = (isset($jsonPayload['password']) && is_scalar($jsonPayload['password'])) ? (string)$jsonPayload['password'] : ((isset($_POST['password']) && is_scalar($_POST['password'])) ? (string)$_POST['password'] : '');
	$adminPwdInput = (isset($jsonPayload['admin_password']) && is_scalar($jsonPayload['admin_password'])) ? (string)$jsonPayload['admin_password'] : ((isset($_POST['admin_password']) && is_scalar($_POST['admin_password'])) ? (string)$_POST['admin_password'] : '');

	if (isset($jsonPayload['formazioni'])) {
		$formazioni = is_array($jsonPayload['formazioni']) ? $jsonPayload['formazioni'] : (is_string($jsonPayload['formazioni']) ? json_decode($jsonPayload['formazioni'], true) : NULL);
	} else {
		$formazioni = (isset($_REQUEST['formazioni']) && is_string($_REQUEST['formazioni'])) ? json_decode($_REQUEST['formazioni'], TRUE) : NULL;
	}

	try {
		if ($isAdmin) {
			if (!fcm_is_password_configured($adminPassword)) {
				throw new Exception('Accesso amministratore disabilitato: password non configurata in admin_config.inc.php.');
			}
			// Con la sola sessione serve il token CSRF: il cookie viaggia anche nelle richieste preparate da altri siti
			$autorizzato = fcm_admin_session_active() && fcm_verify_csrf(null, $jsonPayload);
			if (!$autorizzato && $adminPwdInput !== '') {
				$tentativo = fcm_admin_login_attempt($adminPwdInput, $adminPassword);
				if ($tentativo['locked'] || $tentativo['retry_after'] > 0) {
					http_response_code(429);
					throw new Exception(fcm_throttle_message($tentativo['retry_after']));
				}
				$autorizzato = $tentativo['ok'];
			}
			if (!$autorizzato) {
				throw new Exception('Accesso amministratore non autorizzato: sessione scaduta (ricarica la pagina) oppure password amministratore mancante o errata.');
			}
		} else {
			$hashTarget = (isset($passwords[$idSquadra]) && is_string($passwords[$idSquadra])) ? $passwords[$idSquadra] : '';
			$tentativo = fcm_team_login_attempt($idSquadra, $password, $hashTarget);
			if ($tentativo['locked'] || $tentativo['retry_after'] > 0) {
				http_response_code(429);
				throw new Exception(fcm_throttle_message($tentativo['retry_after']));
			}
			if (!$tentativo['ok']) {
				throw new Exception('Password non valida');
			}
		}

		if ($giornataDiA < 1 || $giornataDiA > 38 || empty($formazioni) || !is_array($formazioni))
			throw new Exception('Parametri formazione non validi');

		if ($controllaOrarioInvio && !$isAdmin) {
			$t = ottieneTermine($giornataDiA);
			if ($t === false)
				throw new Exception('Impossibile determinare termine invio');
			if ($t['secondiRimasti'] < 0) {
				$giorniIta = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
				$giornoNome = $giorniIta[(int)$t['dataOraTermine']->format('w')];
				$s = $giornoNome . ' ' . $t['dataOraTermine']->format('d/m/y, H:i');
				throw new Exception("Termine invio scaduto ($s)");
			}
		}

		// Tutto l'invio viene controllato prima di salvare o spedire qualcosa: se un dato non è valido non parte nulla
		$formazioni = controllaFormazioni($formazioni, $idSquadra, $giornataDiA, $isAdmin);

		if (!$isAdmin && !fcm_cooldown_acquire('invform_' . $idSquadra, SECONDI_TRA_INVII)) {
			http_response_code(429);
			throw new Exception('Hai appena inviato una formazione: attendi ' . SECONDI_TRA_INVII . ' secondi prima di inviarne un\'altra.');
		}
		if (!$isAdmin) {
			// Tetto sull'ora: ogni invio occupa per un'ora uno dei gettoni della squadra
			$gettone = 1;
			while ($gettone <= MAX_INVII_ORA && !fcm_cooldown_acquire('invform_ora_' . $idSquadra . '_' . $gettone, 3600))
				$gettone++;
			if ($gettone > MAX_INVII_ORA) {
				http_response_code(429);
				throw new Exception('Troppi invii nell\'ultima ora per questa squadra (al massimo ' . MAX_INVII_ORA . '): riprova più tardi.');
			}
		}

		// I testi di e-mail e Telegram li compone il browser: nel log resta chi ha fatto l'invio
		error_log(sprintf('[ModernFCM] invio formazione accettato: squadra=%d giornata=%d incontri=%s accesso=%s ip=%s',
			$idSquadra, $giornataDiA, implode(',', array_keys($formazioni)), $isAdmin ? 'amministratore' : 'squadra',
			isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '-'));

		$mailer = NULL;
		foreach ($formazioni as $f) {
			print('<p><b>' . html($f['descrizione']) . "</b>\n");
			if ($inviaEMail && isset($f['datiEMail']) && !$isAdmin) {
				foreach ($f['datiEMail'] as $m) {
					$nomi = []; $indirizzi = [];
					foreach ($destinatariEMail as $id => $d) {
						if (!in_array($id, $m['destinatari'], true)) continue;
						$i = PHPMailer::parseAddresses($d['indirizzo'], true, PHPMailer::CHARSET_UTF8);
						if (!empty($i)) {
							$indirizzi = array_merge($indirizzi, $i);
							$i = array_map(function($a) { return html($a['address']); }, $i);
							$nomi[] = '<i>' . html($d['nome']) . ' (' . join(', ', $i) . ')</i>';
						}
					}
					if (!empty($indirizzi)) {
						$errore = inviaEMail($mailer, $indirizzi, $m['oggetto'], $m['corpo']);
						visualizzaRisultato('invio e-mail a ' . join(', ', $nomi), $errore, $esiti, $hasErrors);
					}
				}
			}
			if ($salvaSuSito && isset($f['datiSalvataggio'])) {
				$errore = salvaSuSito($idSquadra, $giornataDiA, $f['idIncontro'], $f['datiSalvataggio']);
				if ($isAdmin && empty($errore)) {
					$esiti[] = [
						'operazione' => 'salvataggio sul sito',
						'success' => true,
						'errore' => ''
					];
					print("<div style=\"color:#10b981; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:10px 14px; border-radius:8px; font-weight:700; margin:8px 0; display:flex; align-items:center; gap:8px;\">🛡️ Salvataggio sul sito eseguito con successo (Modalità Amministratore - Nessun invio e-mail o Telegram)</div>");
				} else {
					visualizzaRisultato('salvataggio sul sito', $errore, $esiti, $hasErrors);
				}
			}
			if ($inoltraATelegram && isset($f['datiTelegram']) && !$isAdmin) {
				$errore = inoltraATelegram($f['datiTelegram']);
				visualizzaRisultato('inoltro a Telegram', $errore, $esiti, $hasErrors);
			}
			print('</p>');
		}
	}
	catch (Exception $e) {
		$hasErrors = true;
		$errorMsg = $e->getMessage();
		print("<div style=\"color:#f43f5e; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); padding:12px; border-radius:8px; font-weight:bold; margin-bottom:12px;\">⚠️ " . html($e->getMessage()) . "</div>");
	}

	$htmlOutput = ob_get_clean();

	if ($isJsonOutput) {
		header('Content-Type: application/json; charset=UTF-8');
		echo json_encode([
			'success' => !$hasErrors,
			'message' => $hasErrors ? ($errorMsg ?: 'Si sono verificati errori durante il salvataggio o l\'invio.') : 'Formazione salvata e inviata con successo!',
			'results' => $esiti,
			'html' => $htmlOutput
		], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		exit;
	} else {
		echo $htmlOutput;
	}
}

/**
 * Controlla per intero le formazioni ricevute, prima che qualcosa venga salvato o spedito:
 * se un dato non è valido viene rifiutato tutto l'invio.
 *
 * @param array $formazioni formazioni ricevute dal client
 * @param integer $idSquadra id della fantasquadra autenticata
 * @param integer $giornataDiA giornata di A
 * @param bool $isAdmin modalità amministratore (solo salvataggio sul sito)
 * @throws Exception se un dato non è valido
 * @return array formazioni controllate, con i destinatari delle e-mail decisi dal server
 */
function controllaFormazioni($formazioni, $idSquadra, $giornataDiA, $isAdmin)
{
	global $inviaEMail, $salvaSuSito, $inoltraATelegram;

	if (count($formazioni) > MAX_FORMAZIONI)
		throw new Exception('Troppe formazioni in un solo invio');

	// Senza le rose e le opzioni che jdPI pubblica per la pagina d'invio nemmeno la pagina può
	// comporre una formazione: in quello stato l'invio non avrebbe nulla su cui essere controllato
	if (preg_match('/\bnew\s+ifG\s*\(/', leggeDatiSito('fcmInvioFormazioneDati.js')) !== 1)
		throw new Exception('Rose e opzioni di invio non disponibili sul sito: riprova tra qualche minuto');

	$controllate = [];
	$messaggiTelegram = 0;
	foreach ($formazioni as $f) {
		$idIncontro = (is_array($f) && isset($f['idIncontro'])) ? $f['idIncontro'] : 0;
		if (is_string($idIncontro) && preg_match('/\A[1-9][0-9]{0,8}\z/', $idIncontro))
			$idIncontro = (int)$idIncontro;
		if (!is_int($idIncontro) || $idIncontro <= 0 || isset($controllate[$idIncontro]))
			throw new Exception('Incontro non valido');

		// L'incontro deve essere della squadra e della giornata dichiarata, quella su cui è stato
		// verificato il termine d'invio (NULL: riga del calendario in un formato non atteso,
		// controllo saltato)
		$incontro = ottieneIncontro($idIncontro);
		if ($incontro === false || ($incontro !== null && ($incontro['giornataDiA'] !== $giornataDiA
			|| ($incontro['casa'] !== $idSquadra && $incontro['fuori'] !== $idSquadra))))
			throw new Exception('Incontro non previsto per la squadra in questa giornata: ricarica la pagina e riprova');

		$descrizione = isset($f['descrizione']) ? $f['descrizione'] : '';
		if (!is_string($descrizione) || strlen($descrizione) > MAX_BYTE_OGGETTO)
			throw new Exception('Descrizione della formazione non valida');
		$c = ['idIncontro' => $idIncontro, 'descrizione' => $descrizione];

		if ($inviaEMail && isset($f['datiEMail']) && !$isAdmin) {
			if (!is_array($f['datiEMail']) || count($f['datiEMail']) > MAX_EMAIL_FORMAZIONE)
				throw new Exception('Messaggi e-mail non validi');
			$c['datiEMail'] = [];
			foreach ($f['datiEMail'] as $m) {
				if (!is_array($m) || !isset($m['oggetto'], $m['corpo']) || !is_string($m['oggetto']) || !is_string($m['corpo']))
					throw new Exception('Messaggi e-mail non validi');
				$completa = controllaTestoEMail($m['oggetto'], $m['corpo'], $idSquadra, $giornataDiA, $idIncontro);
				// Al massimo una e-mail completa e una ridotta per formazione
				if (isset($c['datiEMail'][(int)$completa]))
					throw new Exception('Messaggi e-mail non validi');
				$c['datiEMail'][(int)$completa] = [
					'oggetto' => $m['oggetto'],
					'corpo' => $m['corpo'],
					'destinatari' => ottieneDestinatari($completa, $idSquadra, $incontro, isset($m['destinatari']) ? $m['destinatari'] : [])
				];
			}
		}
		if ($salvaSuSito && isset($f['datiSalvataggio'])) {
			$errore = controllaRigheFormazione($f['datiSalvataggio'], $idSquadra, $idIncontro);
			if ($errore !== '')
				throw new Exception($errore);
			$c['datiSalvataggio'] = array_values($f['datiSalvataggio']);
		}
		if ($inoltraATelegram && isset($f['datiTelegram']) && !$isAdmin) {
			if (!is_string($f['datiTelegram']) || strlen($f['datiTelegram']) > MAX_BYTE_TELEGRAM || ++$messaggiTelegram > 1)
				throw new Exception('Messaggio Telegram non valido');
			$c['datiTelegram'] = $f['datiTelegram'];
		}
		$controllate[$idIncontro] = $c;
	}
	return $controllate;
}

/**
 * Controlla oggetto e corpo di una e-mail, che arrivano già composti dal client.
 * I codici con cui FCM importa la formazione ([MessaggioFrmFCM:N] nell'oggetto, [IDSQUADRA],
 * [GIORNATADIA] e [IDINCONTRO] nel corpo) devono comparire una sola volta, scritti esattamente
 * come li scrive la pagina e con i valori dell'invio autenticato, oppure mancare tutti (e-mail
 * ridotta): altrimenti una squadra potrebbe far importare una formazione a nome di un'altra o
 * per una giornata già chiusa.
 *
 * @param string $oggetto oggetto della e-mail
 * @param string $corpo corpo della e-mail
 * @param integer $idSquadra id della fantasquadra autenticata
 * @param integer $giornataDiA giornata di A
 * @param integer $idIncontro id dell'incontro
 * @throws Exception se il testo non è valido
 * @return bool TRUE per la e-mail completa (con i codici FCM), FALSE per quella ridotta
 */
function controllaTestoEMail($oggetto, $corpo, $idSquadra, $giornataDiA, $idIncontro)
{
	if (strlen($oggetto) > MAX_BYTE_OGGETTO || strlen($corpo) > MAX_BYTE_CORPO)
		throw new Exception('Testo della e-mail troppo lungo');

	// I codici si cercano ignorando maiuscole, spazi, a-capo e caratteri invisibili, perché chi
	// importa il messaggio potrebbe ignorarli a sua volta
	$compatta = function ($testo) {
		$testo = preg_replace('/[\s\p{Z}\p{C}\p{M}]+/u', '', $testo);
		return is_string($testo) ? strtoupper($testo) : null;
	};
	$o = $compatta($oggetto);
	$c = $compatta($corpo);
	if ($o === null || $c === null)
		throw new Exception('Testo della e-mail non valido');

	$codiceOggetto = '/MESSAGGIOFRMFCM/';
	$codiciCorpo = '/\[(?:IDSQUADRA|GIORNATADIA|IDINCONTRO)(?![A-Z])|(?:IDSQUADRA|GIORNATADIA|IDINCONTRO)[\]=]/';
	$trovati = [preg_match_all($codiceOggetto, $o), preg_match_all($codiciCorpo, $c)];
	if ($trovati === [0, 0] && preg_match($codiceOggetto, $c) === 0 && preg_match($codiciCorpo, $o) === 0)
		return false;

	// E-mail completa: un solo codice nell'oggetto e, nel corpo, i tre codici d'identità uno di
	// seguito all'altro come li scrive la pagina. Così ogni valore è chiuso subito dal terminatore
	// e dal codice successivo, e nessun lettore può interpretarlo in modo diverso
	$blocco = "[IDSQUADRA]=$idSquadra\\\n[GIORNATADIA]=$giornataDiA\\\n[IDINCONTRO]=$idIncontro\\\n[FRMCODE]=";
	if ($trovati === [1, 3] && preg_match($codiceOggetto, $c) === 0 && preg_match($codiciCorpo, $o) === 0
		&& substr_count($oggetto, "[MessaggioFrmFCM:$giornataDiA]") === 1
		&& substr_count(str_replace("\r\n", "\n", $corpo), $blocco) === 1)
		return true;

	throw new Exception('I codici FCM della e-mail non corrispondono alla squadra, alla giornata o all\'incontro dell\'invio (le comunicazioni non possono contenere quei codici)');
}

/**
 * Decide i destinatari di una e-mail con la stessa regola che la pagina d'invio applica nel
 * browser (opzioni scelte in jdPI), perché l'elenco inviato dal client non è affidabile.
 * Se le opzioni o la riga dell'incontro non sono nel formato atteso resta valido l'elenco
 * ricevuto, tolto il presidente di lega dalle e-mail ridotte.
 *
 * @param bool $completa TRUE per la e-mail completa, FALSE per quella ridotta
 * @param integer $idSquadra id della fantasquadra autenticata
 * @param array|null $incontro incontro restituito da ottieneIncontro()
 * @param mixed $richiesti id dei destinatari indicati dal client
 * @throws Exception se l'elenco ricevuto non è valido
 * @return integer[] id dei destinatari (chiavi di $destinatariEMail)
 */
function ottieneDestinatari($completa, $idSquadra, $incontro, $richiesti)
{
	global $destinatariEMail;

	$opzioni = ottieneOpzioniDestinatari();
	if ($opzioni === null || $incontro === null) {
		if (!is_array($richiesti))
			throw new Exception('Destinatari della e-mail non validi');
		// 0 è il presidente di lega, che in ogni configurazione riceve solo la e-mail completa
		return array_values(array_filter($richiesti, function ($id) use ($completa) {
			return is_int($id) && ($id !== 0 || $completa);
		}));
	}

	list($alPresidente, $allAvversario, $aTutte, $allaSquadra) = $opzioni['destinatari'];
	$idAvversario = ($incontro['casa'] === $idSquadra) ? $incontro['fuori'] : $incontro['casa'];
	$destinatari = [];
	foreach (array_keys(is_array($destinatariEMail) ? $destinatariEMail : []) as $id) {
		if ($id === 0) {
			// 0 è il presidente di lega, che riceve solo la e-mail completa
			$ammesso = $completa && $alPresidente;
		} else {
			$ammesso = ($completa !== $opzioni['ridotta'])
				&& ($aTutte || ($allAvversario && $id === $idAvversario) || ($allaSquadra && $id === $idSquadra))
				&& ($id !== $opzioni['idPresidente'] || !$alPresidente);
		}
		if ($ammesso)
			$destinatari[] = $id;
	}
	return $destinatari;
}

/**
 * Controlla le righe di una formazione destinate al file JavaScript delle formazioni.
 * Ogni riga deve avere esattamente la forma prodotta dalla pagina d'invio
 * (idIncontro,idSquadra,idLega,xg<id giocatore>,xa<id squadra di A>,ruolo,posizione,rigorista)
 * e riguardare la squadra e l'incontro dell'invio: nel file gli identificatori restano senza
 * virgolette, quindi un testo diverso verrebbe eseguito dal browser di chi consulta le formazioni
 * e una riga altrui finirebbe nella formazione di un'altra squadra.
 *
 * @param mixed $righe righe ricevute
 * @param integer $idSquadra id della fantasquadra per cui si salva
 * @param integer $idIncontro id dell'incontro
 * @return string messaggio d'errore ('' se le righe sono valide)
 */
function controllaRigheFormazione($righe, $idSquadra, $idIncontro)
{
	if (!is_array($righe) || empty($righe))
		return 'Dati formazione vuoti o non validi';
	if (count($righe) > MAX_RIGHE_FORMAZIONE)
		return 'Troppe righe nella formazione';

	// NULL: rose non leggibili, resta il solo controllo sulla forma
	$rosa = ottieneRosa($idSquadra);
	// Lega della squadra nell'incontro, scelta come la sceglie la pagina: chi mostra le formazioni
	// le distingue anche per lega (NULL: non leggibile dal calendario, controllo saltato)
	$idLega = null;
	$incontro = ottieneIncontro($idIncontro);
	if (is_array($incontro)) {
		$idLega = ($incontro['casa'] === $idSquadra) ? $incontro['legaCasa'] : $incontro['legaFuori'];
		if ($idLega === null)
			controlloSaltato('lega della squadra');
	}
	// Numeri come li scrive la pagina: sole cifre, senza segno, spazi o zeri iniziali
	$n = '(0|[1-9][0-9]{0,8})';
	foreach ($righe as $r) {
		if (!is_string($r) || !preg_match("/\\A$n,$n,$n,xg$n,xa$n,([1-4]),(?:-1|0|[1-9][0-9]?),(?:0|[1-9][0-9]?)\\z/", $r, $c))
			return 'Formato dati riga formazione non valido';
		if ((int)$c[1] !== $idIncontro || (int)$c[2] !== $idSquadra || ($idLega !== null && (int)$c[3] !== $idLega))
			return 'Riga di formazione riferita a un\'altra squadra o a un altro incontro';
		if ($rosa !== null && (!isset($rosa[(int)$c[4]]) || $rosa[(int)$c[4]] !== [(int)$c[6], (int)$c[5]]))
			return 'Riga di formazione con un giocatore che non risulta nella rosa della squadra: ricarica la pagina e riprova';
	}
	return '';
}

/**
 * Legge le opzioni sui destinatari delle e-mail che jdPI scrive per la pagina d'invio
 *
 * @return array|null ['destinatari' => bool[] (al presidente, all'avversario, a tutte le squadre,
 *	alla squadra stessa), 'ridotta' => bool, 'idPresidente' => int] oppure NULL se non sono leggibili
 */
function ottieneOpzioniDestinatari()
{
	$js = leggeDatiSito('fcmInvioFormazioneDati.js');
	// var destinatariEMail=[1,0,0,1]; var eMailRidotta=0; var idPresidente=3;
	$n = '\s*(-?[0-9]+)\s*';
	if (!preg_match('/\bvar\s+destinatariEMail\s*=\s*\[' . "$n,$n,$n,$n" . '\]/', $js, $d)
		|| !preg_match('/\bvar\s+eMailRidotta\s*=' . $n . ';/', $js, $r)
		|| !preg_match('/\bvar\s+idPresidente\s*=' . $n . ';/', $js, $p))
		return controlloSaltato('destinatari delle e-mail');
	return [
		'destinatari' => [(int)$d[1] !== 0, (int)$d[2] !== 0, (int)$d[3] !== 0, (int)$d[4] !== 0],
		'ridotta' => (int)$r[1] !== 0,
		'idPresidente' => (int)$p[1]
	];
}

/**
 * Rosa di una squadra secondo i dati che jdPI genera per la pagina d'invio, gli stessi da cui
 * la pagina costruisce le righe della formazione
 *
 * @param integer $idSquadra id della fantasquadra
 * @return array|null [id giocatore => [ruolo, id squadra di A]] oppure NULL se le rose non sono leggibili
 */
function ottieneRosa($idSquadra)
{
	// a[n]=new ifG(idSquadra, idGiocatore, ruolo, idSquadraDiA, "dati");
	if (!preg_match_all('/\bnew\s+ifG\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,/', leggeDatiSito('fcmInvioFormazioneDati.js'), $m, PREG_SET_ORDER))
		return controlloSaltato('rosa della squadra');
	$rosa = [];
	foreach ($m as $g) {
		if ((int)$g[1] === $idSquadra)
			$rosa[(int)$g[2]] = [(int)$g[3], (int)$g[4]];
	}
	return $rosa;
}

/**
 * Cerca un incontro nel calendario pubblicato da FCM
 *
 * @param integer $idIncontro id dell'incontro
 * @return array|false|null ['giornataDiA' => int, 'casa' => int, 'fuori' => int, 'legaCasa' =>
 *	int|null, 'legaFuori' => int|null] (id delle due squadre e delle loro leghe, queste ultime
 *	NULL se non sono leggibili); FALSE se l'incontro non è nel calendario, anche perché il
 *	calendario manca o è vuoto; NULL se la riga dell'incontro non è nel formato atteso
 */
function ottieneIncontro($idIncontro)
{
	$js = leggeDatiSito('fcmCalendarioDati.js');
	$inizio = '\bnew\s+I\s*\(\s*["\']?' . intval($idIncontro) . '["\']?\s*,';
	if (preg_match("/$inizio/", $js) === 0)
		return false;
	// new I(ID, IncAcc, IDTipo, Giocato, IDFantagiornata, Fantagiornata, IDCompetizione, Competizione,
	// IDGirone, Girone, GiornataDiA, IDCasa, IDFuori, IDLegaCasa, IDLegaFuori, ...): dopo l'ID si
	// saltano nove argomenti, numeri oppure stringhe tra virgolette; le due leghe si leggono solo
	// se sono numeri
	$argomento = '(?>\s*"(?:[^"\\\\\r\n]|\\\\.)*"\s*|\s*\'(?:[^\'\\\\\r\n]|\\\\.)*\'\s*|[^,()"\'\r\n]*)';
	$n = '\s*(-?[0-9]+)\s*';
	if (preg_match("/$inizio(?:$argomento,){9}$n,$n,$n(?:,$n,$n)?" . '[,)]/', $js, $m) !== 1)
		return controlloSaltato('incontro');
	return ['giornataDiA' => (int)$m[1], 'casa' => (int)$m[2], 'fuori' => (int)$m[3],
		'legaCasa' => isset($m[5]) ? (int)$m[4] : null, 'legaFuori' => isset($m[5]) ? (int)$m[5] : null];
}

/**
 * Legge uno dei file di dati che FCM e jdPI pubblicano nella cartella js del sito
 *
 * @param string $nome nome del file
 * @return string contenuto del file ('' se non è leggibile)
 */
function leggeDatiSito($nome)
{
	static $letti = [];
	if (!isset($letti[$nome])) {
		$contenuto = @file_get_contents(dirname(__DIR__) . '/js/' . $nome);
		$letti[$nome] = is_string($contenuto) ? $contenuto : '';
	}
	return $letti[$nome];
}

/**
 * Annota nel log, una volta per richiesta, che un controllo viene saltato perché i dati pubblicati
 * da FCM o jdPI su cui si basa non sono nel formato atteso: meglio un controllo in meno che l'invio
 * bloccato da un cambio di formato
 *
 * @param string $controllo che cosa non è stato possibile verificare
 * @return null
 */
function controlloSaltato($controllo)
{
	static $annotati = [];
	if (!isset($annotati[$controllo])) {
		$annotati[$controllo] = true;
		error_log("[ModernFCM] invio formazione: $controllo non verificabile, dati di FCM/jdPI in un formato non atteso");
	}
	return null;
}

/**
 * Restituisce come oggetto JavaScript i dati relativi al termine d'invio
 */
function restituisceTermine()
{
	global $controllaOrarioInvio, $orariInizio, $anticipoInvio;

	// La risposta è caricata come <script>: va dichiarata JavaScript anche quando è vuota, altrimenti
	// con l'header X-Content-Type-Options: nosniff il browser la scarta segnalando un errore
	header('Content-Type: application/javascript; charset=utf-8');

	if ($controllaOrarioInvio) {
		$giornataDiA = isset($_REQUEST['giornataDiA']) ? intval($_REQUEST['giornataDiA']) : 0;
		$t = $giornataDiA > 0 ? ottieneTermine($giornataDiA) : false;

		$orarioInizioStr = (isset($orariInizio) && isset($orariInizio[$giornataDiA])) ? $orariInizio[$giornataDiA] : null;
		$anticipoMin = isset($anticipoInvio) ? intval($anticipoInvio) : 30;
		$dataOraInizioIso = null;
		if ($orarioInizioStr) {
			try {
				$dtInizio = new DateTime($orarioInizioStr, new DateTimeZone('Europe/Rome'));
				$dataOraInizioIso = $dtInizio->format(DATE_ATOM);
			} catch (Exception $e) {}
		}

		$payload = array(
			'giornataDiA' => $giornataDiA,
			'orarioInizio' => $orarioInizioStr,
			'dataOraInizio' => $dataOraInizioIso,
			'anticipoInvio' => $anticipoMin,
			'dataOraTermine' => ($t !== false && isset($t['dataOraTermine'])) ? $t['dataOraTermine']->format(DATE_ATOM) : null,
			'dataOraServer' => ($t !== false && isset($t['dataOraServer'])) ? $t['dataOraServer']->format(DATE_ATOM) : (new DateTime('now', new DateTimeZone('Europe/Rome')))->format(DATE_ATOM),
			'secondiRimasti' => ($t !== false && isset($t['secondiRimasti'])) ? $t['secondiRimasti'] : null,
			'tuttiOrari' => isset($orariInizio) ? $orariInizio : array()
		);

		header('Content-Type: application/javascript; charset=utf-8');
		print("termineInvio=" . json_encode($payload) . ";\n");
	}
}

/**
 * Invia e-mail della formazione
 *
 * @param object|null $mailer oggetto PHPMailer da creare o da riutilizzare
 * @param array $destinatari destinatari
 * @param string $oggetto oggetto della e-mail
 * @param string $corpo corpo della e-mail
 * @return string messaggio d'errore
 */
function inviaEMail(&$mailer, $destinatari, $oggetto, $corpo)
{
	global $servizioEMail, $mittenteEMail, $hostSmtp, $usernameSmtp, $passwordSmtp, $keyApiMail;

	try {
		$m = PHPMailer::parseAddresses($mittenteEMail, true, PHPMailer::CHARSET_ISO88591);
		if (empty($m))
			throw new Exception('Indirizzo mittente non valido');
		if ($mailer == NULL) {
			switch ($servizioEMail) {
				case 'phpmail':
				case 'smtp':
					$mailer = new PHPMailer(true);
					// Niente intestazione X-Mailer: rivelerebbe libreria e versione a chi riceve
					$mailer->XMailer = ' ';
					if ($servizioEMail == 'smtp') {
						$mailer->IsSMTP();
						$mailer->SMTPKeepAlive = true;
						$mailer->Host = $hostSmtp;
						if (!empty($usernameSmtp)) {
							$mailer->SMTPAuth = true;
							$mailer->Username = $usernameSmtp;
							$mailer->Password = $passwordSmtp;
						}
					}
					break;

				case ApiMailer::SERVICE_BREVO:
				case ApiMailer::SERVICE_MAILJET:
				case ApiMailer::SERVICE_SENDGRID:
					$mailer = new ApiMailer($servizioEMail);
					$mailer->ApiKey = $keyApiMail;
					break;
			}
			$mailer->setFrom($m[0]['address'], $m[0]['name']);
		}
		$mailer->ClearAddresses();
		foreach ($destinatari as $d)
			$mailer->addAddress($d['address'], $d['name']);
		$mailer->Subject = $oggetto;
		$mailer->Body = $corpo;
		$mailer->Send();
		return '';
	}
	catch (Exception $e) {
		// I dettagli (risposte del server SMTP o del servizio di posta) vanno nel log del server
		error_log('[ModernFCM] invio e-mail fallito: ' . $e->getMessage());
		return "Errore durante l'invio della e-mail" . dettaglioErrore($e->getMessage());
	}
}

/**
 * Parte finale del messaggio per un errore di posta o di Telegram. Il dettaglio può contenere
 * indirizzi, nomi di server e risposte dei servizi esterni: lo legge solo chi ha già, nello stesso
 * browser, una sessione da amministratore, perché deve poter capire che cosa non funziona anche
 * dove il log del server non è consultabile; agli altri si indica il log
 *
 * @param string $dettaglio messaggio d'errore originale
 * @return string testo da accodare al messaggio per l'utente
 */
function dettaglioErrore($dettaglio)
{
	static $admin = null;
	if ($admin === null)
		$admin = fcm_admin_session_active(true);
	return ' (' . (($admin && $dettaglio !== '') ? $dettaglio : 'dettagli nel log degli errori del server') . ')';
}

/**
 * Salva formazione sul sito
 *
 * @param integer $idSquadra id della fantasquadra
 * @param integer $giornataDiA giornata di A
 * @param integer $idIncontro id dell'incontro
 * @param string[] $righeNuovaFormazione righe della formazione da inserire
 *	nel file JavaScript delle formazioni
 * @return string messaggio d'errore
 */
function salvaSuSito($idSquadra, $giornataDiA, $idIncontro, $righeNuovaFormazione)
{
	$giornataDiA = intval($giornataDiA);
	if ($giornataDiA < 1 || $giornataDiA > 38) {
		return 'Giornata di Serie A non valida';
	}
	$idSquadra = intval($idSquadra);
	$idIncontro = intval($idIncontro);
	if ($idSquadra <= 0 || $idIncontro <= 0) {
		return 'Parametri incontro o squadra non validi';
	}
	if (!is_array($righeNuovaFormazione) || empty($righeNuovaFormazione)) {
		return 'Dati formazione vuoti o non validi';
	}

	$errore = controllaRigheFormazione($righeNuovaFormazione, $idSquadra, $idIncontro);
	if ($errore !== '') {
		return $errore;
	}
	$righeSanificate = array_values($righeNuovaFormazione);

	$filePath = "../js/fcmFormazioniDati$giornataDiA.js";
	$backupPath = "../js/fcmFormazioniDati{$giornataDiA}.js.bak";

	// Se il file non esiste o è vuoto, lo inizializza con l'intestazione standard
	if (!file_exists($filePath) || filesize($filePath) === 0) {
		$initContent = "arrFormazioni = new Array();\r\na = arrFormazioni;\r\n";
		if (@file_put_contents($filePath, $initContent) === false) {
			return 'Impossibile creare il file delle formazioni';
		}
	} else {
		// Genera una copia di backup automatica prima di qualsiasi modifica
		@copy($filePath, $backupPath);
	}

	if (($fp = fopen($filePath, 'c+')) === false) {
		return 'Impossibile aprire il file delle formazioni';
	}

	try {
		if (!flock($fp, LOCK_EX)) {
			throw new Exception('Impossibile bloccare il file delle formazioni');
		}

		rewind($fp);
		$righeStatiche = array();
		$righeFormazioniEsistenti = array();
		$righeSquadra = count($righeSanificate);
		$righeScartate = 0;
		while (($r = fgets($fp)) !== false) {
			$rTrim = trim($r);
			if (empty($rTrim))
				continue;
			if (!preg_match('/^a\[\d+\]\s*=\s*new\s+Z\((\d+),(\d+),([^)]+)\)/i', $rTrim, $m)) {
				$righeStatiche[] = $rTrim;
			} else if ($m[1] != $idIncontro || $m[2] != $idSquadra) {
				// Il browser esegue queste righe come script: quelle già presenti si riscrivono solo se
				// fatte di numeri e di identificatori xg<ID>/xa<ID>, così un valore anomalo rimasto nel
				// file non continua a bloccare il caricamento delle righe successive
				if (!preg_match('/^\s*-?\d+\s*,\s*xg\d+\s*,\s*xa\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*$/', $m[3])) {
					$righeScartate++;
					continue;
				}
				$righeFormazioniEsistenti[] = "$m[1],$m[2],$m[3]";
				if ($m[2] == $idSquadra)
					$righeSquadra++;
			}
		}

		// Tetto alle righe che una squadra può tenere nel file: senza, invii ripetuti per incontri
		// diversi lo farebbero crescere senza limite
		if ($righeSquadra > MAX_FORMAZIONI * MAX_RIGHE_FORMAZIONE) {
			return 'Troppe righe di formazione già salvate per la squadra in questa giornata';
		}

		// Bufferizza prima tutto l'output per scrittura sicura e atomica
		$nuovoContenuto = "";
		foreach ($righeStatiche as $r) {
			$nuovoContenuto .= "$r\r\n";
		}
		foreach (array_merge($righeFormazioniEsistenti, $righeSanificate) as $i => $r) {
			$idx = $i + 1;
			$nuovoContenuto .= "a[$idx]=new Z($r)\r\n";
		}

		if (!ftruncate($fp, 0) || !rewind($fp)) {
			throw new Exception('Errore durante la preparazione del file delle formazioni');
		}

		if (fputs($fp, $nuovoContenuto) === false) {
			throw new Exception('Errore durante la scrittura del file delle formazioni');
		}
		fflush($fp);
		if ($righeScartate > 0)
			error_log("[ModernFCM] fcmFormazioniDati$giornataDiA.js: scartate $righeScartate righe non valide già presenti nel file");
		return '';
	}
	catch (Exception $e) {
		// In caso di errore durante la scrittura, ripristina la copia di backup
		if (file_exists($backupPath)) {
			@copy($backupPath, $filePath);
		}
		return $e->getMessage();
	}
	finally {
		flock($fp, LOCK_UN);
		fclose($fp);
	}
}

/**
 * Inoltra formazione alla chat Telegram con escaping sicuro e fallback
 *
 * @param string $messaggio messaggio da inoltrare
 * @return string messaggio di errore
 */
function inoltraATelegram($messaggio)
{
	global $chatIdTelegram, $tokenBotTelegram;

	if (empty($tokenBotTelegram) || empty($chatIdTelegram)) {
		return 'Configurazione Telegram incompleta';
	}

	$telegram = new Telegram($tokenBotTelegram, false);

	// Converti formattazione in HTML sicuro per evitare blocchi del parser Markdown
	$escaped = htmlspecialchars($messaggio, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
	$htmlMsg = preg_replace('/\*(.*?)\*/s', '<b>$1</b>', $escaped);
	$htmlMsg = preg_replace('/\_(.*?)\_/s', '<i>$1</i>', $htmlMsg);

	$data = [
		'chat_id' => $chatIdTelegram,
		'text' => $htmlMsg,
		'parse_mode' => 'HTML',
	];
	$risp = $telegram->sendMessage($data);

	// Se fallisce per errore entity o parsing, fallback immediato a testo puro senza parse_mode
	if (!isset($risp['ok']) || $risp['ok'] === false) {
		$dataPlain = [
			'chat_id' => $chatIdTelegram,
			'text' => $messaggio
		];
		$risp = $telegram->sendMessage($dataPlain);
	}

	if (!isset($risp['ok']))
		return 'Risposta Telegram non valida';
	if ($risp['ok'] === false) {
		// I dettagli (risposta di Telegram o errore di rete) vanno nel log del server
		$dettaglio = isset($risp['description']) ? $risp['description'] : (isset($risp['curl_error']) ? $risp['curl_error'] : '');
		$dettaglio = is_string($dettaglio) ? $dettaglio : '';
		error_log('[ModernFCM] inoltro a Telegram fallito: ' . $dettaglio);
		return 'Errore durante l\'inoltro a Telegram' . dettaglioErrore($dettaglio);
	}
	return '';
}

/**
 * Restituisce oggetto contenente i dati di termine invio relativi alla giornata di A specificata
 *
 * @param integer $giornataDiA giornata di A
 * @return array|false oggetto termine invio o FALSE in caso d'errore
 */
function ottieneTermine($giornataDiA)
{
	global $orariInizio, $anticipoInvio;

	try {
		if (!isset($orariInizio[$giornataDiA]))
			throw new Exception('Orario di termine non disponibile');
		$dataOraTermine = new DateTime($orariInizio[$giornataDiA], new DateTimeZone('Europe/Rome'));
		$antVal = isset($anticipoInvio) ? intval($anticipoInvio) : 30;
		$termine['dataOraTermine'] = $dataOraTermine->sub(new DateInterval("PT{$antVal}M"));
		$termine['dataOraServer'] = new DateTime('now', new DateTimeZone('Europe/Rome'));
		$termine['secondiRimasti'] = $dataOraTermine->getTimestamp() - $termine['dataOraServer']->getTimestamp();
		return $termine;
	}
	catch (Exception $e) {
		return false;
	}
}

/**
 * Visualizza risultato di un'operazione
 *
 * @param string $operazione descrizione dell'operazione
 * @param string $errore risultato dell'operazione ('' in caso di esito positivo)
 * @param array|null &$esiti array dei risultati per JSON
 * @param bool|null &$hasErrors flag errori complessivi
 */
function visualizzaRisultato($operazione, $errore, &$esiti = null, &$hasErrors = null)
{
	$success = empty($errore);
	if (!$success && $hasErrors !== null) {
		$hasErrors = true;
	}
	if ($esiti !== null) {
		$esiti[] = [
			'operazione' => $operazione,
			'success' => $success,
			'errore' => $errore
		];
	}
	$s = '<div style="margin: 6px 0; display:flex; align-items:center; gap:8px;">';
	$s .= !$success ? '<span style="color:#f43f5e; font-weight:bold;">&#x274c;</span>' : '<span style="color:#10b981; font-weight:bold;">&#x2714;</span>';
	$s .= ' <span>' . $operazione . '</span>';
	if (!$success) $s .= '<span style="color:#f43f5e; font-size:0.85rem; margin-left:6px;"> &#9654; ' . html($errore) . '</span>';
	$s .= '</div>';
	print("$s\n");
}

/**
 * Converte una stringa nella sua rappresentazione HTML
 *
 * @param string $s stringa da convertire
 * @return string stringa convertita
 */
function html($s)
{
	return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
