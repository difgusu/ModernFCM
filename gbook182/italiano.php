<?php
/*
 * This file is part of GBook - PHP Guestbook.
 *
 * (c) Copyright 2016 by Klemen Stirn. All rights reserved.
 * http://www.phpjunkyard.com
 * http://www.phpjunkyard.com/php-guestbook-script.php
 *
 * For the full copyright and license agreement information, please view
 * the docs/index.html file that was distributed with this source code.
 */

/*
 * LANGUAGE: English (US)
 * Translated by: Klemen Stirn
 *
 * !!! This file must be saved in UTF-8 encoding without byte order mark (BOM) !!!
 * Test chars: àáâãäåæ
 */

// Encoding for HTML pages and emails
$lang['enc']='utf-8'; // DO NOT CHANGE, must be utf-8!
$lang['lng']='Italiano';

// Error messages
$lang['e02']='ID non valido';
$lang['e03']='Il tuo nome';
$lang['e04']='Scrivi un indirizzo e-mail valido o lascia vuoto';
$lang['e05']='Scrivi un indirizzo web valido o lascia vuoto';
$lang['e06']='Il tuo commento';
$lang['e07']='Numero di sicurezza';
$lang['e08']='Numero di sicurezza errato';
$lang['e09']='Password';
$lang['e10']='Messaggio di risposta';
$lang['e11']='Azione non valida!';
$lang['e12']='Password errata!';
$lang['e13']='Impossibile scrivere sul file entries. Settare CHMOD del file entries a 666 (rw-rw-rw-)!';
$lang['e14']='Il file delle parolacce non &egrave; stato trovato! Controlla il nome del file. In molti server &egrave; CaSe SeNsiTiVe!';
$lang['e15']='Password errata! Solo l\'admin del guestbook pu&ograve; leggere questo post!';
$lang['e16']='Password errata! Il post selezionato non &egrave; stato cancellato.';
$lang['e17']='Puoi postare su questo guestbook solo una volta per sessione';
$lang['e18']='Impossibile leggere il file entries. Settare CHMOD del file entries a 666 (rw-rw-rw-) e controlla che il tuo host permetta agli script PHP di leggere i file locali!';
$lang['e19']='Errore';
$lang['e20']='ERRORE: Indirizzo IP non valido, accesso bloccato!';

// Text used
$lang['t07']='Questo post &egrave; stato inviato da:';
$lang['t08']='Clicca qui per continuare';
$lang['t09']='Visualizza indirizzo IP';
$lang['t10']='Solo l\'amministratore del guestbook pu&ograve; vedere gli indirizzi IP delle persone che hanno scritto su questo guestbook. Per vedere l\'indirizzo IP del post selezionato, inserire la password dell\'amministratore e clicca il pulsante &quot;Visualizza IP&quot;.';
$lang['t12']='La tua risposta &egrave; stata inviata!';
$lang['t13']='Rispondi ad un post';
$lang['t14']='L\'amministratore del guestbook pu&ograve; usare questo form per rispondere ad un post. Per rispondere al post selezionato, inserire la password dell\'amministratore, il tuo messaggio e cliccare il pulsante &quot;Rispondi&quot;.';
$lang['t15']='Condiviso da';
$lang['t16']='Commenti:';
$lang['t17']='Nome:';
$lang['t18']='Da:';
$lang['t19']='Sito web:';
$lang['t20']='E-mail:';
$lang['t21']='Password amministratore:';
$lang['t22']='Opzioni aggiuntive:';
$lang['t23']='Banna questo indirizzo IP';
$lang['t24']='Visualizza IP';
$lang['t25']='La tua risposta:';
$lang['t26']='Altro';
$lang['t27']='Contatto';
$lang['t28']='Disabilita emoticons';
$lang['t29']='Rispondi';
$lang['t30']='Risposta amministratore:';
$lang['t31']='Aggiunto:';
$lang['t32']='Cancella questo post';
$lang['t33']='Rispondi a questo post';
$lang['t34']='Indietro al Guestbook';
$lang['t35']='Leggi post privato';
$lang['t36']='Questo &egrave; un post privato e pu&ograve; essere letto solo dall\'amministratore del guestbook. Per vedere il post privato selezionato, inserire la password dell\'amministratore e cliccare sul pulsante &quot;Leggi post privato&quot;.';
$lang['t37']='Il post selezionato &egrave; stato rimosso!';
$lang['t38']='Cancella post';
$lang['t39']='Solo l\'amministratore del guestbook pu&ograve; eliminare i post. Per cancellare il post selezionato, inserire la password dell\'amministratore e cliccare sul pulsante &quot;Cancella questo post&quot;.';
$lang['t40']='Cancella questo post';
$lang['t41']='Qualcuno ha appena scritto sul tuo guestbook'; // <-- This is e-mail subject
$lang['t42']='Ciao!';
$lang['t43']='Qualcuno ha appena scritto sul tuo guestbook!'; // <-- This is text inside e-mail
$lang['t44']='Messaggio (senza emoticons):';
$lang['t45']='Visita il link seguente per visualizzare il tuo guestbook:';
$lang['t46']='Fine del messaggio';
$lang['t48']='Scrivi post';
$lang['t49']='I campi obbligatori sono in <b>grassetto</b>.';
$lang['t50']='Il tuo nome:';
$lang['t51']='Da dove digiti?';
$lang['t52']='La tua e-mail:';
$lang['t54']='Non scrivere indirizzi di siti web';
$lang['t55']='Rendi privato questo post.';
$lang['t56']='Scrivi il numero visualizzato:';
$lang['t57']=' Aggiungi i miei commenti ';
$lang['t58']='Post privato. Clicca per visualizzare.';
$lang['t59']='Torna alla pagina precedente';
$lang['t60']='Visualizza';
$lang['t61']='Indietro a';
$lang['t62']='Immagine di sicurezza';
$lang['t63']='Visualizza indirizzo e-mail';
$lang['t64']='Solo l\'amministratore del guestbook pu&ograve; visualizzare gli indirizzi e-mail. Per visualizzare l\'indirizzo e-mail selezionato, inserire la password dell\'amministratore e cliccare sul pulsante &quot;Visualizza indirizzo e-mail&quot;.';
$lang['t66']='Gli indirizzi e-mail sono nascosti';

// Added or modified in version 1.7
$lang['t01']='Numero di post: %d';
$lang['t75']='Numero di pagine: %d';
$lang['e01']='Non puoi scrivere su questo guestbook a quest\'ora!';
$lang['t53']='Il tuo sito web:';
$lang['t02']='&laquo; Primo';
$lang['t03']='&lsaquo; Prec';
$lang['t04']='Succ &rsaquo;';
$lang['t05']='Ultimo &raquo;';
$lang['t11']='&laquo; Homepage Guestbook';
$lang['t06']='Ancora nessun post! Sii il primo a commentare!';
$lang['t47']='Il tuo messaggio &egrave; stato aggiunto!';
$lang['t67']='Rispondi alla domanda anti-SPAM';
$lang['t68']='Risposta sbagliata alla domanda anti-SPAM';
$lang['t69']='Il messaggio &egrave; stato postato da:';
$lang['t65']='E-mail del post selezionato:';
$lang['e21']='ERRORE: Non ci piacciono gli spammers. Sei stato bannato permanentemente dal guestbook!';
$lang['t70']='Emoticons';
$lang['t71']='Clicca su un\'icona per inserirla nel messaggio.';
$lang['t72']='Chiudi Finestra';
$lang['t73']='Limita il commento a %d caratteri (adesso %d)';
$lang['t74']='Limita il numero di emoticons a %d (adesso %d)';
$lang['m01']='Gennaio';
$lang['m02']='Febbraio';
$lang['m03']='Marzo';
$lang['m04']='Aprile';
$lang['m05']='Maggio';
$lang['m06']='Giugno';
$lang['m07']='Luglio';
$lang['m08']='Agosto';
$lang['m09']='Settembre';
$lang['m10']='Ottobre';
$lang['m11']='Novembre';
$lang['m12']='Dicembre';
$lang['e22']='Impossibile accedere al file entries. Riprova pi&ugrave; tardi.';
$lang['t76']='Ciao %s!';
$lang['t77']='Il proprietario di %s ha appena risposto al tuo messaggio.';
$lang['t78']='Per leggere la risposta visita:';
$lang['t79']='Distinti saluti,';
$lang['t80']='Risposta al tuo messaggio nel guestbook'; // E-mail subject
$lang['t81']='Hai già un messaggio in attesa di approvazione!';
$lang['e23']='Impossibile aprire il file temporaneo in scrittura! Imposta il CHMOD della cartella apptmp a 777 (rwxrwxrwx)!';
$lang['t82']='Un nuovo messaggio del guestbook è in attesa di approvazione.';
$lang['t83']='Per APPROVARE il messaggio visita questo URL:';
$lang['t84']='Per RIFIUTARE il messaggio visita questo URL:';
$lang['t85']='Grazie. Il tuo messaggio è stato inviato per approvazione.';
$lang['e24']='Hash ID mancante. Assicurati di aver copiato l\'URL completo di approvazione/rifiuto!';
$lang['e25']='Hash ID del messaggio errato. Possibili cause:<br><br>- il messaggio è già stato approvato o rifiutato<br>- non hai copiato l\'URL completo di approvazione/rifiuto';
$lang['t86']='Il messaggio è stato approvato e pubblicato nel guestbook.';
$lang['t87']='Il messaggio è stato rifiutato ed eliminato.';

// Added 25th November 2009
$lang['t88']='Condividi il Post';
