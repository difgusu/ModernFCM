<?php
if (!function_exists('getprossima')) {
function getprossima() {
	// 1. Analizza gli incontri giocati in js/fcmCalendarioDati.js
	$baseDir = dirname(__DIR__);
	$file = $baseDir . "/js/fcmCalendarioDati.js";
	if (!file_exists($file)) {
		$file = __DIR__ . "/../js/fcmCalendarioDati.js";
	}
	if (!file_exists($file)) {
		$file = "js/fcmCalendarioDati.js";
	}
	if (file_exists($file)) {
		$gioc = explode("\n", file_get_contents($file));
		$giocata = array();
		$c = 0;
		for ($i = count($gioc) - 1; $i >= 0; $i--) {
			if (isset($gioc[$i]) && strpos($gioc[$i], "new I") !== false) {
				$giocata[$c] = explode(",", $gioc[$i]);
				if (isset($giocata[$c][3]) && $giocata[$c][3] == 1 && isset($giocata[$c][2]) && $giocata[$c][2] != 2) {
					$Gio = intval($giocata[$c][10]) + 1;
					return min(38, $Gio);
				}
				$c++;
			}
		}
	}

	return 1;
}
}
?>