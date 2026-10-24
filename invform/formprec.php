<?php
header('Content-Type: application/javascript; charset=utf-8');

$giornata = isset($_REQUEST['giornata']) ? intval($_REQUEST['giornata']) : 0;
$fsq = isset($_REQUEST['fsq']) ? intval($_REQUEST['fsq']) : 0;

// Cache statica per evitare letture e parsing duplicati degli stessi file su disco
if (!function_exists('getFileLines')) {
	function getFileLines($filePath) {
		static $cache = [];
		if (!isset($cache[$filePath])) {
			if (!file_exists($filePath)) {
				$cache[$filePath] = false;
			} else {
				$cache[$filePath] = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
			}
		}
		return $cache[$filePath];
	}
}

// Funzione per verificare se un file di formazioni contiene giocatori schierati per la fantasquadra specificata
if (!function_exists('haFormazioneSquadra')) {
	function haFormazioneSquadra($filePath, $fsq) {
		$lines = getFileLines($filePath);
		if ($lines === false) return false;
		foreach ($lines as $line) {
			if (preg_match('/^a\[\d+\]\s*=\s*new\s+Z\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,/i', $line, $m)) {
				$teamId = intval($m[2]);
				$pos = intval($m[5]);
				if ($teamId === $fsq && $pos >= 0) {
					return true;
				}
			}
		}
		return false;
	}
}

if (!function_exists('fileHaFormazioni')) {
	function fileHaFormazioni($filePath) {
		$lines = getFileLines($filePath);
		if ($lines === false) return false;
		foreach ($lines as $line) {
			if (stripos($line, 'new Z(') !== false) return true;
		}
		return false;
	}
}

$days = [];

// 1. Aggiunge sempre la giornata precedente a quella selezionata (se il file esiste)
if ($giornata > 0) {
	$primaryFile = "../js/fcmFormazioniDati" . $giornata . ".js";
	if (file_exists($primaryFile)) {
		$days[] = $giornata;
	}
}

// 2. Controlla se la squadra ha già una formazione registrata nella giornata precedente
$hasLineup = false;
if ($giornata > 0 && $fsq > 0) {
	$primaryFile = "../js/fcmFormazioniDati" . $giornata . ".js";
	$hasLineup = haFormazioneSquadra($primaryFile, $fsq);
}

// 3. Se la squadra non ha una formazione nella giornata precedente, cerca a ritroso l'ultima formazione inserita
// Bounded backward search: controlla al massimo le ultime 5 giornate precedenti
if (!$hasLineup) {
	$startDay = ($giornata > 1) ? ($giornata - 1) : 38;
	$minDay = ($giornata > 0) ? max(1, $startDay - 4) : 1;
	for ($g = $startDay; $g >= $minDay; $g--) {
		$fileCheck = "../js/fcmFormazioniDati" . $g . ".js";
		if (!file_exists($fileCheck)) continue;
		if ($fsq > 0) {
			if (haFormazioneSquadra($fileCheck, $fsq)) {
				if (!in_array($g, $days)) {
					$days[] = $g;
				}
				break; // Trovata l'ultima formazione inserita per la squadra
			}
		} else {
			if (fileHaFormazioni($fileCheck)) {
				if (!in_array($g, $days)) {
					$days[] = $g;
				}
				break; // Trovata l'ultima giornata con formazioni
			}
		}
	}
}

// Supporto per fallback o giornate multiple esplicite (se specificate)
if (isset($_REQUEST['fallback']) && $_REQUEST['fallback'] !== '') {
	$fbInt = intval(trim($_REQUEST['fallback']));
	if ($fbInt > 0 && !in_array($fbInt, $days) && file_exists("../js/fcmFormazioniDati" . $fbInt . ".js")) {
		$days[] = $fbInt;
	}
}

print("var arrFormazioniPrecedenti=new Array();\r\na=arrFormazioniPrecedenti;\r\n");

$rowCount = 0;
foreach ($days as $d) {
	$filePath = "../js/fcmFormazioniDati" . $d . ".js";
	$lines = getFileLines($filePath);
	if ($lines !== false) {
		foreach ($lines as $line) {
			$line = trim($line);
			if (preg_match('/^a\[\d+\]\s*=\s*(new\s+Z\(.+\));?$/i', $line, $matches)) {
				$rowCount++;
				print("a[" . $rowCount . "]=" . $matches[1] . ";\r\n");
			}
		}
	}
}
?>