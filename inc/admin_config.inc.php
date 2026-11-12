<?php
/**
 * Configurazione Amministratore
 * Questo file è indipendente e NON viene sovrascritto dal plugin/esportazione FCM.
 */

// Password per accedere alle pagine di servizio admin.
// Può essere la password in chiaro oppure, meglio, il suo hash generato con password_hash():
//   php -r "echo password_hash('LaTuaPassword', PASSWORD_DEFAULT), PHP_EOL;"
// In quel caso incolla qui sotto l'hash (inizia con $2y$ o $argon2) lasciando gli apici singoli:
// per accedere si continua a digitare la password, non l'hash.
// Scegli una password lunga e unica, non usata altrove: il pannello è raggiungibile da Internet.
$adminPassword = '[PASSWORD]';

?>