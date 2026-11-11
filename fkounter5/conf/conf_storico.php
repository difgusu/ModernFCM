<?php /* conf_storico.php
                                        __                      PHP Script    _    vs 5.0
                                       / _| __ _ _ __   /\ /\___  _   _ _ __ | |_ ___ _ __
                                      | |_ / _` | '_ \ / //_/ _ \| | | | '_ \| __/ _ \ '__|
                                      |  _| (_| | | | / __ \ (_) | |_| | | | | ||  __/ |
                                      |_|  \__,_|_| |_\/  \/\___/ \__,_|_| |_|\__\___|_|

                                              fanatiko <fankounter@libero.it>, ITALY
 Documentazione di riferimento
############################################################################################
 license.txt - le condizioni di utilizzo, modifica e redistribuzione per l'utente finale
  manual.txt - la guida alla configurazione, all'installazione e all'uso dello script
    faqs.txt - le risposte alle domande pi comuni, sui problemi e sulle funzionalit
 history.txt - la progressione delle versioni, i miglioramenti apportati e i bugs eliminati

 Descrizione del file
############################################################################################
 Configurazione per contatore 'storico'.
*/

############################################################################################
# IMPOSTAZIONI DEL CONTATORE
############################################################################################

$cnf__start_count         = 0;
$cnf__mtime_unique_accs   = 0;
$cnf__expire_on_midnight  = FALSE;
$cnf__count_per_pages     = FALSE;
$cnf__licit_domains_list  = array();
$cnf__IPmasks_ignore_list = array();
$cnf__htime_sync_server   = 0;
$cnf__last_entries        = 30;

############################################################################################
# IMPOSTAZIONI DEL VISUALIZZATORE
############################################################################################

$cnf__userpass       = md5("admin");
$cnf__passwd_protect = FALSE;
$cnf__limit_view     = 15;

############################################################################################

?>

