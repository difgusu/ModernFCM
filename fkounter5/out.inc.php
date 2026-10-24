<?php 
/* 
 * out.inc.php
 *                                       __                      PHP Script    _    vs 5.0
 *                                      / _| __ _ _ __   /\ /\___  _   _ _ __ | |_ ___ _ __
 *                                     | |_ / _` | '_ \ / //_/ _ \| | | | '_ \| __/ _ \ '__|
 *                                     |  _| (_| | | | / __ \ (_) | |_| | | | | ||  __/ |
 *                                     |_|  \__,_|_| |_\/  \/\___/ \__,_|_| |_|\__\___|_|
 *
 *                                             lucliscio <lucliscio@h0model.org>, ITALY
 *
 * -------------------------------------------------------------------------------------------
 * Documentazione di riferimento
 * -------------------------------------------------------------------------------------------
 * license.txt - le condizioni di utilizzo, modifica e redistribuzione per l'utente finale
 *  manual.txt - la guida alla configurazione, all'installazione e all'uso dello script
 *    faqs.txt - le risposte alle domande più comuni, sui problemi e sulle funzionalità
 * history.txt - la progressione delle versioni, i miglioramenti apportati e i bugs eliminati
 *
 * -------------------------------------------------------------------------------------------
 * Licence
 * -------------------------------------------------------------------------------------------
 * Copyright (C) 2017 Luca Liscio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/agpl-3.0.html>.
 */

/**
 * Modulo importato per la stampa del contatore.
 * 
 *  @author  lucliscio <lucliscio@h0model.org>
 *  @version v 5.0
 *  @copyright Copyright 2017 Luca Liscio
 *  @copyright Copyright 2003 Fanatiko 
 *  @license http://www.gnu.org/licenses/agpl-3.0.html GNU/AGPL3
 *   
 *  @package fanKounter
 *  @filesource
 */

############################################################################################
# BLOCCO ESECUZIONE STANDALONE
############################################################################################

if(!defined("STANDALONE"))
 exit();

############################################################################################
# CONTEGGIO DEGLI ACCESSI
############################################################################################

define("TOTAL_VAL",$dat__counter);
define("TODAY_VAL",$aux__calendar->_get_hits_($aux__now,"d"));

############################################################################################
# NESSUNA CACHE
############################################################################################

ini_set('display_errors', 0);

header("Expires: ".gmdate("D, d M Y H:i:s")." GMT");
header("Last-Modified: ".gmdate("D, d M Y H:i:s")." GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0",FALSE);
header("Pragma: no-cache");
header("Vary: Accept-Encoding, Cookie, Sec-CH-Prefers-Color-Scheme");

############################################################################################
# CONTATORE JSON (MODERNO PER SPA)
############################################################################################

if($par__mode==="json"){
 header("Content-type: application/json; charset=UTF-8");
 echo json_encode(array(
  "success" => true,
  "id" => $par__id,
  "today" => (int)TODAY_VAL,
  "total" => (int)TOTAL_VAL
 ));
 return;
}

############################################################################################
# CONTATORE GRAFICO
############################################################################################

if($par__mode==="graphic"){
 if(file_exists("lan.inc.php")){require_once("lan.inc.php");}
 if(!defined("LAN_TODAY"))define("LAN_TODAY","OGGI");
 if(!defined("LAN_TOTAL"))define("LAN_TOTAL","TOTALE");

 $today_txt = (defined("LAN_TODAY")) ? LAN_TODAY : "OGGI";
 $total_txt = (defined("LAN_TOTAL")) ? LAN_TOTAL : "TOTALE";
 $today_val = (int)TODAY_VAL;
 $total_val = (int)TOTAL_VAL;
 // Rilevazione del tema (Dark o Light) con massima tolleranza e compatibilità
 $theme_val = "";
 if (!empty($_GET["theme"]) && preg_match("/^(dark|light)$/i", $_GET["theme"])) {
     $theme_val = strtolower($_GET["theme"]);
 } elseif (!empty($_REQUEST["theme"]) && preg_match("/^(dark|light)$/i", $_REQUEST["theme"])) {
     $theme_val = strtolower($_REQUEST["theme"]);
 } elseif (!empty($par__theme) && preg_match("/^(dark|light)$/i", $par__theme)) {
     $theme_val = strtolower($par__theme);
 } elseif (!empty($_COOKIE["pn_theme"]) && preg_match("/^(dark|light)$/i", $_COOKIE["pn_theme"])) {
     $theme_val = strtolower($_COOKIE["pn_theme"]);
 } elseif (!empty($_COOKIE["theme"]) && preg_match("/^(dark|light)$/i", $_COOKIE["theme"])) {
     $theme_val = strtolower($_COOKIE["theme"]);
 } elseif (!empty($par__pn_theme) && preg_match("/^(dark|light)$/i", $par__pn_theme)) {
     $theme_val = strtolower($par__pn_theme);
 }

 $is_dark = ($theme_val === "dark");

 // Di default viene sempre reso il badge moderno e nitido in formato SVG (anche se GD è attivo sul server come su AlterVista).
 // La modalità raster GD PNG viene usata solo se esplicitamente richiesta con ?format=png o ?force_gd=1
 $use_gd = (isset($_GET["format"]) && strtolower($_GET["format"]) === "png") || (isset($_GET["force_gd"]) && $_GET["force_gd"] == "1");

 if($use_gd && extension_loaded("gd") && function_exists("imagecreatetruecolor")){
   $__img = imagecreatetruecolor(98, 38);
   if ($is_dark) {
     $bg = imagecolorallocate($__img, 15, 23, 42);          // #0f172a
     $border = imagecolorallocate($__img, 51, 65, 85);      // #334155
     $bar_fill = imagecolorallocate($__img, 30, 41, 59);    // #1e293b
     $bar_stroke = imagecolorallocate($__img, 56, 189, 248);// #38bdf8
     $line = imagecolorallocate($__img, 56, 189, 248);      // #38bdf8
     $logo_txt = imagecolorallocate($__img, 148, 163, 184); // #94a3b8
     $logo_k = imagecolorallocate($__img, 248, 113, 113);   // #fb9f9f
     $lbl = imagecolorallocate($__img, 148, 163, 184);      // #94a3b8
     $col_today = imagecolorallocate($__img, 56, 189, 248); // #38bdf8
     $col_tot = imagecolorallocate($__img, 74, 222, 128);   // #4ade80
   } else {
     $bg = imagecolorallocate($__img, 255, 255, 255);       // #ffffff
     $border = imagecolorallocate($__img, 203, 213, 225);   // #cbd5e1
     $bar_fill = imagecolorallocate($__img, 191, 219, 254); // #bfdbfe
     $bar_stroke = imagecolorallocate($__img, 2, 132, 199); // #0284c7
     $line = imagecolorallocate($__img, 2, 132, 199);       // #0284c7
     $logo_txt = imagecolorallocate($__img, 71, 85, 105);   // #475569
     $logo_k = imagecolorallocate($__img, 220, 38, 38);     // #fb9f9f
     $lbl = imagecolorallocate($__img, 100, 116, 139);      // #64748b
     $col_today = imagecolorallocate($__img, 2, 132, 199);  // #0284c7
     $col_tot = imagecolorallocate($__img, 22, 163, 74);    // #16a34a
   }

   imagefilledrectangle($__img, 0, 0, 97, 37, $bg);
   imagerectangle($__img, 0, 0, 97, 37, $border);

   // Istogramma a barre scalari
   imagefilledrectangle($__img, 4, 3, 10, 12, $bar_fill);
   imagerectangle($__img, 4, 3, 10, 12, $bar_stroke);
   imagefilledrectangle($__img, 11, 5, 17, 12, $bar_fill);
   imagerectangle($__img, 11, 5, 17, 12, $bar_stroke);
   imagefilledrectangle($__img, 18, 7, 24, 12, $bar_fill);
   imagerectangle($__img, 18, 7, 24, 12, $bar_stroke);

   // Linea separatrice della testata
   imageline($__img, 3, 13, 94, 13, $line);

   // Logo fanKounter
   imagestring($__img, 1, 28, 4, "fan", $logo_txt);
   imagestring($__img, 1, 44, 4, "K", $logo_k);
   imagestring($__img, 1, 50, 4, "ounter", $logo_txt);
   imagestring($__img, 1, 80, 4, "New", $logo_k);

   // Etichette Oggi e Totale
   imagestring($__img, 1, 5, 16, $today_txt, $lbl);
   imagestring($__img, 1, 5, 26, $total_txt, $lbl);

   // Valori allineati a destra
   $str_today = (string)$today_val;
   $str_tot = (string)$total_val;
   $x_today = 93 - (strlen($str_today) * imagefontwidth(2));
   $x_tot = 93 - (strlen($str_tot) * imagefontwidth(2));

   imagestring($__img, 2, max(42, $x_today), 15, $str_today, $col_today);
   imagestring($__img, 2, max(42, $x_tot), 25, $str_tot, $col_tot);

   header("Content-type: image/png");
   imagepng($__img);
   imagedestroy($__img);
   return;
 } else {
   // Badge SVG responsive per Light e Dark mode
   header("Content-type: image/svg+xml; charset=utf-8");

   // Valori per Light mode
   $l_bg = "#ffffff";
   $l_border = "#cbd5e1";
   $l_bar_fill = "#bfdbfe";
   $l_bar_stroke = "#0284c7";
   $l_line_stroke = "#0284c7";
   $l_logo_txt = "#475569";
   $l_logo_k = "#fb9f9f";
   $l_lbl = "#64748b";
   $l_col_today = "#0284c7";
   $l_line_dashed = "#f1f5f9";
   $l_col_tot = "#16a34a";

   // Valori per Dark mode
   $d_bg = "#0f172a";
   $d_border = "#334155";
   $d_bar_fill = "#1e293b";
   $d_bar_stroke = "#38bdf8";
   $d_line_stroke = "#38bdf8";
   $d_logo_txt = "#94a3b8";
   $d_logo_k = "#fb9f9f";
   $d_lbl = "#94a3b8";
   $d_col_today = "#38bdf8";
   $d_line_dashed = "#1e293b";
   $d_col_tot = "#4ade80";

   if ($theme_val === "dark") {
     $bg = $d_bg; $border = $d_border; $bar_fill = $d_bar_fill; $bar_stroke = $d_bar_stroke;
     $line_stroke = $d_line_stroke; $logo_txt = $d_logo_txt; $logo_k = $d_logo_k;
     $lbl = $d_lbl; $col_today = $d_col_today; $line_dashed = $d_line_dashed; $col_tot = $d_col_tot;
     $css_override = ".b-bg{fill:{$d_bg}!important;stroke:{$d_border}!important}.b-bar{fill:{$d_bar_fill}!important;stroke:{$d_bar_stroke}!important}.b-line{stroke:{$d_line_stroke}!important}.b-txt{fill:{$d_logo_txt}!important}.b-k{fill:{$d_logo_k}!important}.b-lbl{fill:{$d_lbl}!important}.b-today{fill:{$d_col_today}!important}.b-dash{stroke:{$d_line_dashed}!important}.b-tot{fill:{$d_col_tot}!important}";
   } elseif ($theme_val === "light") {
     $bg = $l_bg; $border = $l_border; $bar_fill = $l_bar_fill; $bar_stroke = $l_bar_stroke;
     $line_stroke = $l_line_stroke; $logo_txt = $l_logo_txt; $logo_k = $l_logo_k;
     $lbl = $l_lbl; $col_today = $l_col_today; $line_dashed = $l_line_dashed; $col_tot = $l_col_tot;
     $css_override = ".b-bg{fill:{$l_bg}!important;stroke:{$l_border}!important}.b-bar{fill:{$l_bar_fill}!important;stroke:{$l_bar_stroke}!important}.b-line{stroke:{$l_line_stroke}!important}.b-txt{fill:{$l_logo_txt}!important}.b-k{fill:{$l_logo_k}!important}.b-lbl{fill:{$l_lbl}!important}.b-today{fill:{$l_col_today}!important}.b-dash{stroke:{$l_line_dashed}!important}.b-tot{fill:{$l_col_tot}!important}";
   } else {
     // Nessun parametro esplicito: default light con auto-switch a dark tramite media query OS/browser
     $bg = $l_bg; $border = $l_border; $bar_fill = $l_bar_fill; $bar_stroke = $l_bar_stroke;
     $line_stroke = $l_line_stroke; $logo_txt = $l_logo_txt; $logo_k = $l_logo_k;
     $lbl = $l_lbl; $col_today = $l_col_today; $line_dashed = $l_line_dashed; $col_tot = $l_col_tot;
     $css_override = "@media(prefers-color-scheme:dark){.b-bg{fill:{$d_bg}!important;stroke:{$d_border}!important}.b-bar{fill:{$d_bar_fill}!important;stroke:{$d_bar_stroke}!important}.b-line{stroke:{$d_line_stroke}!important}.b-txt{fill:{$d_logo_txt}!important}.b-k{fill:{$d_logo_k}!important}.b-lbl{fill:{$d_lbl}!important}.b-today{fill:{$d_col_today}!important}.b-dash{stroke:{$d_line_dashed}!important}.b-tot{fill:{$d_col_tot}!important}}";
   }

   echo '<svg xmlns="http://www.w3.org/2000/svg" width="98" height="38" viewBox="0 0 98 38">' .
        '<style>' . $css_override . '</style>' .
        '<rect class="b-bg" x="0.5" y="0.5" width="97" height="37" rx="4" fill="' . $bg . '" stroke="' . $border . '" stroke-width="1"/>' .
        '<!-- Istogramma -->' .
        '<rect class="b-bar" x="4.5" y="3.5" width="7" height="9" fill="' . $bar_fill . '" stroke="' . $bar_stroke . '" stroke-width="1" rx="0.5"/>' .
        '<rect class="b-bar" x="11.5" y="5.5" width="7" height="7" fill="' . $bar_fill . '" stroke="' . $bar_stroke . '" stroke-width="1" rx="0.5"/>' .
        '<rect class="b-bar" x="18.5" y="7.5" width="7" height="5" fill="' . $bar_fill . '" stroke="' . $bar_stroke . '" stroke-width="1" rx="0.5"/>' .
        '<!-- Linea testata -->' .
        '<line class="b-line" x1="3" y1="13.5" x2="95" y2="13.5" stroke="' . $line_stroke . '" stroke-width="1"/>' .
        '<!-- Logo fanKounter -->' .
        '<text x="29" y="11.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif" font-size="8" font-weight="700" letter-spacing="0.3">' .
        '<tspan class="b-txt" fill="' . $logo_txt . '">fan</tspan>' .
        '<tspan class="b-k" fill="' . $logo_k . '" font-weight="800">K</tspan>' .
        '<tspan class="b-txt" fill="' . $logo_txt . '">ounter</tspan>' .
        '<tspan class="b-k" fill="' . $logo_k . '" font-weight="800">New</tspan>' .
        '</text>' .
        '<!-- Dati Oggi e Totale -->' .
        '<text class="b-lbl" x="5" y="23.5" fill="' . $lbl . '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif" font-size="7.5" font-weight="700" letter-spacing="0.3">' . $today_txt . '</text>' .
        '<text class="b-today" x="93" y="23.5" fill="' . $col_today . '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, monospace" font-size="9.5" font-weight="800" text-anchor="end">' . $today_val . '</text>' .
        '<line class="b-dash" x1="5" y1="26.5" x2="93" y2="26.5" stroke="' . $line_dashed . '" stroke-width="0.6" stroke-dasharray="2,2"/>' .
        '<text class="b-lbl" x="5" y="34" fill="' . $lbl . '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif" font-size="7.5" font-weight="700" letter-spacing="0.3">' . $total_txt . '</text>' .
        '<text class="b-tot" x="93" y="34" fill="' . $col_tot . '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, monospace" font-size="9.5" font-weight="800" text-anchor="end">' . $total_val . '</text>' .
        '</svg>';
   return;
 }
}

############################################################################################
# CONTATORE TESTUALE/NASCOSTO
############################################################################################

header("Content-type: text/javascript");
echo"/* This file was created by fanKounter */".EOL;

if($par__mode==="text")
 echo"document.write('".TOTAL_VAL."');".EOL;

return;

############################################################################################

?>