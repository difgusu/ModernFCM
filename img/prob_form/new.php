<?php
ob_start();
if ($_GET['sq']!=''){
$sq=$_GET['sq'];
} else {
$sq='atalanta';
}
$link="location:../campetto_oriz.swf?xmlPath=prob_form/formazione_".$sq.".xml";
header("Cache-Control: no-cache");
header("$link");
ob_end_flush();
function getmicrotime( ){
list( $usec, $sec) = explode( " ", microtime( ));
return ( ( float)$usec + ( float)$sec);
}
$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/atalanta/formazione/formazione.xml');   
$FileProxt = 'formazione_atalanta.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/cagliari/formazione/formazione.xml');   
$FileProxt = 'formazione_cagliari.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/cesena/formazione/formazione.xml');   
$FileProxt = 'formazione_cesena.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/chievo/formazione/formazione.xml');   
$FileProxt = 'formazione_chievo.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/empoli/formazione/formazione.xml');   
$FileProxt = 'formazione_empoli.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/fiorentina/formazione/formazione.xml');   
$FileProxt = 'formazione_fiorentina.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/genoa/formazione/formazione.xml');   
$FileProxt = 'formazione_genoa.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/inter/formazione/formazione.xml');   
$FileProxt = 'formazione_inter.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/juventus/formazione/formazione.xml');   
$FileProxt = 'formazione_juventus.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/lazio/formazione/formazione.xml');   
$FileProxt = 'formazione_lazio.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/milan/formazione/formazione.xml');   
$FileProxt = 'formazione_milan.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/napoli/formazione/formazione.xml');   
$FileProxt = 'formazione_napoli.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/palermo/formazione/formazione.xml');   
$FileProxt = 'formazione_palermo.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/parma/formazione/formazione.xml');   
$FileProxt = 'formazione_parma.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/roma/formazione/formazione.xml');   
$FileProxt = 'formazione_roma.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/sampdoria/formazione/formazione.xml');   
$FileProxt = 'formazione_sampdoria.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/sassuolo/formazione/formazione.xml');   
$FileProxt = 'formazione_sassuolo.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/torino/formazione/formazione.xml');   
$FileProxt = 'formazione_torino.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/udinese/formazione/formazione.xml');   
$FileProxt = 'formazione_udinese.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

$content = file_get_contents_curl ('http://www.gazzetta.it/ssi/2011/boxes/calcio/squadre/verona/formazione/formazione.xml');   
$FileProxt = 'formazione_verona.xml';
$scrivi_file=fopen($FileProxt,"w");
fwrite($scrivi_file, $content);

fclose($scrivi_file);   
$end_time = getmicrotime( );


function file_get_contents_curl($url) {
      $ch = curl_init();
      curl_setopt($ch, CURLOPT_HEADER, 0);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
      curl_setopt($ch, CURLOPT_URL, $url);
      $data = curl_exec($ch);
      curl_close($ch);
      return $data;
}
?>