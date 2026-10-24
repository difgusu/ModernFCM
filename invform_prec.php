<?php
// ModernFCM - Reindirizzamento permanente 301 verso invform.php in modalita amministratore
$qs = !empty($_SERVER['QUERY_STRING']) ? '&' . $_SERVER['QUERY_STRING'] : '';
header('Location: invform.php?admin=1' . $qs, true, 301);
exit;
