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
if (file_exists(__DIR__ . '/admin_config.inc.php')) {
	require_once __DIR__ . '/admin_config.inc.php';
}

use PHPMailer\PHPMailer\PHPMailer;

/**
 * @global string FIRMA
 */
const FIRMA = '<p><b>invform.php versione 2.4.0</b><br /><span class="t-xs">Copyright &copy; 2005-2023 johndoe</span></p>';

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

	$pnameVal = isset($jsonPayload['pname']) ? trim($jsonPayload['pname']) : (isset($_REQUEST['pname']) ? trim($_REQUEST['pname']) : 'invform');
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
	$password = isset($jsonPayload['password']) ? (string)$jsonPayload['password'] : (isset($_REQUEST['password']) ? (string)$_REQUEST['password'] : '');
	$adminPwdInput = isset($jsonPayload['admin_password']) ? (string)$jsonPayload['admin_password'] : (isset($_REQUEST['admin_password']) ? (string)$_REQUEST['admin_password'] : '');
	
	if (isset($jsonPayload['formazioni'])) {
		$formazioni = is_array($jsonPayload['formazioni']) ? $jsonPayload['formazioni'] : json_decode($jsonPayload['formazioni'], true);
	} else {
		$formazioni = isset($_REQUEST['formazioni']) ? json_decode($_REQUEST['formazioni'], TRUE) : NULL;
	}

	try {
		if ($isAdmin) {
			if (session_status() === PHP_SESSION_NONE) {
				session_start();
			}
			if (empty($adminPassword) || $adminPassword === '[PASSWORD]') {
				throw new Exception('Accesso amministratore disabilitato: password non configurata in admin_config.inc.php.');
			}
			$sessionAuth = !empty($_SESSION['pn_admin_logged']);
			$postAuth = ($adminPwdInput !== '' && hash_equals((string)$adminPassword, $adminPwdInput));

			if (!$sessionAuth && !$postAuth) {
				throw new Exception('Accesso amministratore non autorizzato: password amministratore mancante o errata.');
			}
		} else {
			$hashTarget = (isset($passwords[$idSquadra]) && is_string($passwords[$idSquadra])) ? $passwords[$idSquadra] : '';
			$crypted = ($hashTarget !== '') ? crypt($password, $hashTarget) : '';
			if ($idSquadra <= 0 || $hashTarget === '' || !hash_equals($hashTarget, $crypted)) {
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

		$mailer = NULL;
		foreach ($formazioni as $f) {
			print('<p><b>' . html($f['descrizione']) . "</b>\n");
			if ($inviaEMail && isset($f['datiEMail']) && !$isAdmin) {
				foreach ($f['datiEMail'] as $m) {
					$nomi = []; $indirizzi = [];
					foreach ($destinatariEMail as $id => $d) {
						if (!in_array($id, $m['destinatari'])) continue;
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
 * Restituisce come oggetto JavaScript i dati relativi al termine d'invio
 */
function restituisceTermine()
{
	global $controllaOrarioInvio, $orariInizio, $anticipoInvio;

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
		return "Errore durante durante l'invio della e-mail ({$e->getMessage()})";
	}
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

	$righeSanificate = [];
	foreach ($righeNuovaFormazione as $r) {
		$rTrim = trim((string)$r);
		// Valida strettamente il formato atteso: idIncontro,idSquadra,ruolo,giocatore,squadraA,ruolo,pos,rigorista
		if (!preg_match('/^\d+,\d+,\d+,[a-zA-Z0-9_]+,[a-zA-Z0-9_]+,\d+,-?\d+,\d+$/', $rTrim)) {
			return 'Formato dati riga formazione non valido';
		}
		$righeSanificate[] = $rTrim;
	}

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
		while (($r = fgets($fp)) !== false) {
			$rTrim = trim($r);
			if (empty($rTrim))
				continue;
			if (!preg_match('/^a\[\d+\]\s*=\s*new\s+Z\((\d+),(\d+),([^)]+)\)/i', $rTrim, $m)) {
				$righeStatiche[] = $rTrim;
			} else if ($m[1] != $idIncontro || $m[2] != $idSquadra) {
				$righeFormazioniEsistenti[] = "$m[1],$m[2],$m[3]";
			}
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
	if ($risp['ok'] === false)
		return isset($risp['description']) ? $risp['description'] : (isset($risp['curl_error']) ? $risp['curl_error'] : 'Errore sconosciuto Telegram');
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
