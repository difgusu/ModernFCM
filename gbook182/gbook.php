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

error_reporting(0);
ini_set('display_errors', 0);

define('IN_SCRIPT',true);

// Modular guard: verifica se il modulo Guestbook e attivo
$fcmVarFile = __DIR__ . '/../js/fcmVariabili.js';
if (file_exists($fcmVarFile)) {
    $raw = @file_get_contents($fcmVarFile);
    if (preg_match('/var\s+ModGuestbook\s*=\s*["\']?(.*?)["\']?\s*;?$/m', $raw, $m)) {
        $val = strtolower(trim($m[1]));
        if ($val === 'no' || $val === '0' || $val === 'false') {
            die("<!DOCTYPE html><html lang='it'><body style='font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;'><div style='text-align:center;padding:30px;background:#1e293b;border-radius:12px;border:1px solid rgba(255,255,255,0.1);max-width:480px;'><h2>🔒 Guestbook Non Attivo</h2><p style='color:#94a3b8;'>Il modulo Guestbook di Lega e stato disabilitato nelle impostazioni del sito.</p><a href='../index.php#home' style='display:inline-block;padding:8px 16px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;'>Torna al Sito</a></div></body></html>");
        }
    }
}

// Set correct Content-Type header
if (!defined('NO_HTTP_HEADER')) {
    header('Content-Type: text/html; charset=utf-8');
}

// Ensure $_GET and $_POST are populated even in CLI/embedded server environments
if (empty($_GET) && !empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $_GET);
    $_REQUEST = array_merge($_REQUEST, $_GET);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && empty($_POST)) {
    $rawInput = @file_get_contents('php://stdin');
    if (empty($rawInput)) {
        $rawInput = @file_get_contents('php://input');
    }
    if (!empty($rawInput)) {
        parse_str($rawInput, $_POST);
        $_REQUEST = array_merge($_REQUEST, $_POST);
    }
}

// Define some constants for backward-compatibility
if (!defined('ENT_SUBSTITUTE')) {
    define('ENT_SUBSTITUTE', 0);
}
if (!defined('ENT_XHTML')) {
    define('ENT_XHTML', 0);
}

require('settings.php');
require($settings['language']);

/**
 * Verifica sicura della password amministratore gbook
 */
function gbook_check_admin_pass($inputPass)
{
    global $settings;
    if (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') {
        return false;
    }
    return hash_equals((string)$settings['apass'], (string)$inputPass);
}

/* Set some variables that will be used later */
$settings['version'] = '1.8.2';
$settings['number_of_entries'] = '';
$settings['number_of_pages'] = '';
$settings['pages_top'] = '';

/* Template path to use */
$settings['tpl_path'] = './templates/'.$settings['template'].'/';

/* Set target window for URLs */
$settings['target'] = !empty($settings['url_blank']) ? ' target="_blank"' : '';

/* Function required by SPAM and licensing - PHP 8.0 compatible */
$settings['pj_license'] = function($e = '') {
    global $settings, $lang;
    $link = true;
    if (file_exists('gbook_license.php')) {
        include('gbook_license.php');
        if (isset($settings['gbook_license']) && is_array($settings['gbook_license'])) {
            $link = false;
        }
    }
    if ($link) {
        echo '<div class="clear"></div><div style="text-align:center">Powered by <a href="http://www.phpjunkyard.com/php-guestbook-script.php" '.$settings['target'].' title="Guestbook">PHP Guestbook</a> - brought to you by <a href="http://www.phpjunkyard.com/" '.$settings['target'].' title="Free PHP Scripts">PHP Scripts</a></div>';
    }
    
    $footer_path = $settings['tpl_path'].'overall_footer.php';
    if (file_exists($footer_path)) {
        require_once($footer_path);
    }
};

/* First thing to do is make sure the IP accessing GBook hasn't been banned */
gbook_CheckIP();

/* Get the action parameter */
$a = isset($_REQUEST['a']) ? gbook_input($_REQUEST['a']) : '';

/* And this will start session which will help prevent multiple submissions and spam */
if ($a=='sign' || $a=='add')
{
    session_name('GBOOK');
    session_start();

    $filter_sum = isset($settings['filter_sum']) ? $settings['filter_sum'] : 'default';
    $myfield['name']=sha1('name' . $filter_sum);
    $myfield['cmnt']=sha1('comments' . $filter_sum);
    $myfield['bait']=sha1('bait' . $filter_sum);
    $myfield['answ']=sha1('answer' . $filter_sum);
}

/* Don't cache any of the pages */
printNoCache();

/* Check actions */
if ($a)
{
    /* Session is blocked, show an error */
    if (!empty($_SESSION['block']))
    {
        problem($lang['e01'] ?? 'Access denied', 0);
    }

    /* Make sure it's a valid action and run the required functions */
    switch ($a)
    {
        case 'sign': printSign(); break;
        case 'delete': confirmDelete(); break;
        case 'viewprivate': confirmViewPrivate(); break;
        case 'add': addEntry(); break;
        case 'confirmdelete': doDelete(); break;
        case 'showprivate': showPrivate(); break;
        case 'reply': writeReply(); break;
        case 'postreply': postReply(); break;
        case 'viewIP': confirmViewIP(); break;
        case 'showIP': showIP(); break;
        case 'viewEmail': confirmViewEmail(); break;
        case 'showEmail': showEmail(); break;
        case 'approve': approveEntry(); break;
        default: problem($lang['e11'] ?? 'Invalid action');
    }
}

/* Prepare and show the GBook entries */
$settings['notice'] = defined('NOTICE') ? NOTICE : '';

$page = (isset($_REQUEST['page'])) ? intval($_REQUEST['page']) : 0;
if ($page > 0)
{
    $start = ($page*10)-9;
    $end   = $start+9;
}
else
{
    $page  = 1;
    $start = 1;
    $end   = 10;
}

if (file_exists($settings['logfile'])) {
    $lines = file($settings['logfile']);
} else {
    $lines = array();
}

$total = count($lines);

if ($total > 0)
{
    if ($end > $total) { $end = $total; }
    $pages = ceil($total/10);

    $settings['number_of_entries'] = sprintf($lang['t01'],$total,$pages);
    $settings['number_of_pages'] = ($pages > 1) ? sprintf($lang['t75'],$pages) : '';

    if ($pages > 1)
    {
        $prev_page = ($page-1 <= 0) ? 0 : $page-1;
        $next_page = ($page+1 > $pages) ? 0 : $page+1;

        if ($prev_page)
        {
            $settings['pages_top'] .= '<a href="gbook.php?page=1">'.$lang['t02'].'</a> ';
            if ($prev_page != 1)
            {
                $settings['pages_top'] .= '<a href="gbook.php?page='.$prev_page.'">'.$lang['t03'].'</a> ';
            }
        }

        for ($i=1; $i<=$pages; $i++)
        {
            if ($i <= ($page+5) && $i >= ($page-5))
            {
               if ($i == $page) { $settings['pages_top'] .= ' <b>'.$i.'</b> '; }
               else { $settings['pages_top'] .= ' <a href="gbook.php?page='.$i.'">'.$i.'</a> '; }
            }
        }

        if ($next_page)
        {
            if ($next_page != $pages)
            {
                $settings['pages_top'] .= ' <a href="gbook.php?page='.$next_page.'">'.$lang['t04'].'</a>';
            }
            $settings['pages_top'] .= ' <a href="gbook.php?page='.$pages.'">'.$lang['t05'].'</a>';
        }
    }
}

printTopHTML();

if ($total == 0)
{
    include($settings['tpl_path'].'no_comments.php');
}
else
{
    printEntries($lines,$start,$end);
}

printDownHTML();
exit();


/***** START FUNCTIONS ******/

function approveEntry()
{
    global $settings, $lang;
    $approve = isset($_GET['do']) ? intval($_GET['do']) : 0;
    $hash = isset($_GET['id']) ? gbook_input($_GET['id'],$lang['e24']) : '';
    $hash = preg_replace('/[^a-z0-9]/','',$hash);
    $file = 'apptmp/'.$hash.'.txt';

    if (!file_exists($file)) { problem($lang['e25']); }

    if (!$approve) { define('NOTICE',$lang['t87']); }
    else
    {
        $addline = file_get_contents($file);
        $links = file_exists($settings['logfile']) ? file_get_contents($settings['logfile']) : '';
        if ($links === false) { problem($lang['e18']); }

        $addline .= $links;
        gbook_write_log($settings['logfile'], $addline) or problem($lang['e13']);
        define('NOTICE',$lang['t86']);
    }
    @unlink($file);
}

function showEmail()
{
    global $settings, $lang;
    $error_buffer = '';
    $num = isset($_POST['num']) ? intval($_POST['num']) : false;
    if ($num === false) { problem($lang['e02']); }

    if (empty($_POST['pass'])) { $error_buffer .= $lang['e09']; }
    elseif ( !gbook_check_admin_pass(gbook_input($_POST['pass'])) ) { $error_buffer .= (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') ? 'Accesso disabilitato: password amministratore non configurata in settings.php' : $lang['e12']; }

    if ($error_buffer) { confirmViewEmail($error_buffer); }

    $lines = file($settings['logfile']);
    $myline = explode("\t",$lines[$num]);
    define('NOTICE', $lang['t65'].' <a href="mailto:'.$myline[2].'">'.$myline[2].'</a>');
}

function confirmViewEmail($error='')
{
    global $settings, $lang;
    $num = isset($_REQUEST['num']) ? intval($_REQUEST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    $task = $lang['t63']; $task_description = $lang['t64']; $action = 'showEmail'; $button = $lang['t63'];
    printTopHTML();
    require($settings['tpl_path'].'admin_tasks.php');
    printDownHTML();
}

function showIP()
{
    global $settings, $lang;
    $error_buffer = '';
    $num = isset($_POST['num']) ? intval($_POST['num']) : false;
    if ($num === false) { problem($lang['e02']); }

    if (empty($_POST['pass'])) { $error_buffer .= $lang['e09']; }
    elseif ( !gbook_check_admin_pass(gbook_input($_POST['pass'])) ) { $error_buffer .= (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') ? 'Accesso disabilitato: password amministratore non configurata in settings.php' : $lang['e12']; }

    if ($error_buffer) { confirmViewIP($error_buffer); }

    $lines = file($settings['logfile']);
    $myline = explode("\t",$lines[$num]);
    if (empty($myline[8])) { $ip='IP NOT AVAILABLE'; }
    else
    {
        $ip=rtrim($myline[8]);
        if (isset($_POST['addban']) && $_POST['addban']=='YES') { gbook_banIP($ip); }
        $host=@gethostbyaddr($ip);
        if ($host && $host!=$ip) { $ip.=' ('.$host.')'; }
    }
    define('NOTICE', $lang['t69'] . '<br class="clear" />' . $ip);
}

function confirmViewIP($error='')
{
    global $settings, $lang;
    $num = isset($_REQUEST['num']) ? intval($_REQUEST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    $task = $lang['t09']; $task_description = $lang['t10']; $action = 'showIP'; $button = $lang['t24'];
    $options = '<label><input type="checkbox" name="addban" value="YES" class="gbook_checkbox" /> '.$lang['t23'].'</label>';
    printTopHTML();
    require($settings['tpl_path'].'admin_tasks.php');
    printDownHTML();
}

function postReply()
{
    global $settings, $lang;
    $error_buffer = '';
    $num = isset($_POST['num']) ? intval($_POST['num']) : false;
    if ($num === false) { problem($lang['e02']); }

    if (empty($_POST['pass'])) { $error_buffer .= $lang['e09'] . '<br />'; }
    elseif ( !gbook_check_admin_pass(gbook_input($_POST['pass'])) ) { $error_buffer .= (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') ? 'Accesso disabilitato: password amministratore non configurata in settings.php' : $lang['e12']; }

    $comments = (isset($_POST['comments'])) ? gbook_input($_POST['comments']) : false;
    if (!$comments) { $error_buffer .= $lang['e10']; $comments = ''; }

    if ($error_buffer) { writeReply($error_buffer, $comments); }

    $comments = wordwrap($comments,$settings['max_word'] ?? 75,' ',true);
    $comments = preg_replace('/(\r\n|\n|\r)/','<br />',$comments);
    $comments = preg_replace('/(<br\s\/>\s*){2,}/','<br /><br />',$comments);
    if ($settings['smileys'] == 1 && !isset($_REQUEST['nosmileys']) ) { $comments = processsmileys($comments); }

    $lines  = file($settings['logfile']);
    $myline = explode("\t",$lines[$num]);
    $myline = array_map('rtrim', $myline);
    $myline[7] = $comments;
    $lines[$num] = implode("\t",$myline)."\n";
    gbook_write_log($settings['logfile'], implode('', $lines)) or problem($lang['e13']);

    if ($settings['notify_visitor'] && !empty($myline[2]))
    {
        $name = unhtmlentities($myline[0]);
        $email = str_replace(['&#46;','&#64;'], ['.','@'], $myline[2]);
        $message = sprintf($lang['t76'],$name)."\n\n";
        $message.= sprintf($lang['t77'],$settings['gbook_title'])."\n\n";
        $message.= "$lang[t78]\n$settings[gbook_url]\n\n";
        mail($email,$lang['t80'],$message,"From: $settings[admin_email]\r\nReply-to: $settings[admin_email]\r\nContent-type: text/plain; charset=".$lang['enc']);
    }
    define('NOTICE', $lang['t12']);
}

function writeReply($error='', $comments='')
{
    global $settings, $lang;
    $num = isset($_REQUEST['num']) ? intval($_REQUEST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    $nosmileys = isset($_REQUEST['nosmileys']) ? 'checked="checked"' : '';
    printTopHTML();
    require($settings['tpl_path'].'admin_reply.php');
    printDownHTML();
}

function filter_bad_words($text)
{
    global $settings, $lang;
    $file = 'badwords/'.$settings['filter_lang'].'.php';
    if (file_exists($file)) { include_once($file); }
    else { problem($lang['e14']); }
    if (isset($settings['badwords']) && is_array($settings['badwords'])) {
        foreach ($settings['badwords'] as $k => $v) { $text = preg_replace("/\b".preg_quote($k, '/')."\b/i",$v,$text); }
    }
    return $text;
}

function showPrivate()
{
    global $settings, $lang;
    $error_buffer = '';
    $num = isset($_POST['num']) ? intval($_POST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    if (empty($_POST['pass'])) { $error_buffer .= $lang['e09']; }
    elseif ( !gbook_check_admin_pass(gbook_input($_POST['pass'])) ) { $error_buffer .= (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') ? 'Accesso disabilitato: password amministratore non configurata in settings.php' : $lang['e15']; }

    if ($error_buffer) { confirmViewPrivate($error_buffer); }
    define('SHOW_PRIVATE',1);
    $lines=file($settings['logfile']);
    printTopHTML();
    printEntries($lines,$num+1,$num+1);
    printDownHTML();
}

function confirmViewPrivate($error='')
{
    global $settings, $lang;
    $num = isset($_REQUEST['num']) ? intval($_REQUEST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    $task = $lang['t35']; $task_description = $lang['t36']; $action = 'showprivate'; $button = $lang['t35'];
    printTopHTML();
    require($settings['tpl_path'].'admin_tasks.php');
    printDownHTML();
}

function processsmileys($text)
{
    global $settings;
    require_once($settings['tpl_path'].'emoticons.php');
    
    $text = preg_replace_callback("/([\:\;])\-([\)op])/i", function($m) {
        return str_replace(';p',':p', $m[1].strtolower($m[2]));
    }, $text);
    $text = preg_replace_callback("/([\:\;])\-d/i", function($m) {
        return str_replace(';D',':D', $m[1].'D');
    }, $text);
    
    foreach ($settings['emoticons'] as $code => $image) {
        $text = str_replace($code, '<img src="##GBOOK_TEMPLATE##images/emoticons/'.$image.'" border="0" alt="'.$code.'" title="'.$code.'" class="gbook_emoticons" />', $text);
    }
    return $text;
}

function doDelete()
{
    global $settings, $lang;
    $error_buffer = '';
    $num = isset($_POST['num']) ? intval($_POST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    if (empty($_POST['pass'])) { $error_buffer .= $lang['e09']; }
    elseif ( !gbook_check_admin_pass(gbook_input($_POST['pass'])) ) { $error_buffer .= (empty($settings['apass']) || $settings['apass'] === '[PASSWORD]') ? 'Accesso disabilitato: password amministratore non configurata in settings.php' : $lang['e16']; }

    if ($error_buffer) { confirmDelete($error_buffer); }

    $lines=file($settings['logfile']);
    if (isset($_POST['addban']) && $_POST['addban']=='YES') {
        $line = explode("\t",$lines[$num]);
        gbook_banIP(trim(end($line)));
    }
    unset($lines[$num]);
    gbook_write_log($settings['logfile'], implode('',$lines)) or problem($lang['e13']);
    define('NOTICE', $lang['t37']);
}

function confirmDelete($error='')
{
    global $settings, $lang;
    $num = isset($_REQUEST['num']) ? intval($_REQUEST['num']) : false;
    if ($num === false) { problem($lang['e02']); }
    $task = $lang['t38']; $task_description = $lang['t39']; $action = 'confirmdelete'; $button = $lang['t40'];
    $options = '<label><input type="checkbox" name="addban" value="YES" class="gbook_checkbox" /> '.$lang['t23'].'</label>';
    printTopHTML();
    require($settings['tpl_path'].'admin_tasks.php');
    printDownHTML();
}

function check_mail_url()
{
    global $settings, $lang;
    $v = array('email' => '','url' => '');
    $char = array('.','@'); $repl = array('&#46;','&#64;');

    $v['email'] = isset($_POST['email']) ? htmlspecialchars($_POST['email']) : '';
    if (strlen($v['email']) > 0 && !(preg_match("/([\w\-]+\@[\w\-]+\.[\w\-]+)/",$v['email']))) { $v['email']='INVALID'; }
    $v['email'] = str_replace($char,$repl,$v['email']);

    if ($settings['use_url']) {
        $v['url'] = isset($_POST['url']) ? htmlspecialchars($_POST['url']) : '';
        if ($v['url'] == 'http://' || $v['url'] == 'https://') {$v['url'] = '';}
        elseif (strlen($v['url']) > 0 && !(preg_match("/(http(s)?:\/\/+[\w\-]+\.[\w\-]+)/i",$v['url']))) { $v['url'] = 'INVALID'; }
    }
    return $v;
}

function addEntry()
{
    global $settings, $lang, $myfield;
    if ($settings['one_per_session'] && !empty($_SESSION['add'])) { problem($lang['e17'],0); }

    $name = gbook_input($_POST[$myfield['name']] ?? '');
    $from = gbook_input($_POST['from'] ?? '');
    $a = check_mail_url(); $email = $a['email']; $url = $a['url'];
    $comments = gbook_input($_POST[$myfield['cmnt']] ?? '');
    $isprivate = (isset($_POST['private']) && $settings['use_private']) ? 1 : 0;

    $error_buffer = '';
    if (empty($name)) { $error_buffer .= $lang['e03'].'<br class="clear" />'; }
    if ($email=='INVALID') { $error_buffer .= $lang['e04'].'<br class="clear" />'; $email = ''; }
    if (empty($comments)) { $error_buffer .= $lang['e06'].'<br class="clear" />'; }

    if ($error_buffer) { printSign($name,$from,$email,$url,$comments,'','',$error_buffer); }

    /* Everthing seems fine, let's add the message */
    $delimiter="\t";
    $added = date("j F Y, H:i:s");

    if ($settings['filter']) {
        $comments = filter_bad_words($comments);
        $name = filter_bad_words($name);
    }

    $comments = preg_replace('/(\r\n|\n|\r)/','<br />',$comments);
    $comments = preg_replace('/(<br\s\/>\s*){2,}/','<br /><br />',$comments);

    /* Process emoticons */
    if ($settings['smileys'] == 1 && !isset($_POST['nosmileys'])) {
        $comments = processsmileys($comments);
    }

    $addline = $name.$delimiter.$from.$delimiter.$email.$delimiter.$url.$delimiter.$comments.$delimiter.$added.$delimiter.$isprivate.$delimiter.'0'.$delimiter.$_SERVER['REMOTE_ADDR']."\n";

    $links = file_exists($settings['logfile']) ? file_get_contents($settings['logfile']) : '';
    gbook_write_log($settings['logfile'], $addline . $links) or problem($lang['e13']);

    $_SESSION['add']=1;
    define('NOTICE',$lang['t47']);
}

function printSign($name='',$from='',$email='',$url='',$comments='',$nosmileys='',$isprivate='',$error='',$spamanswer='')
{
    global $settings, $myfield, $lang;
    printTopHTML();
    require($settings['tpl_path'].'sign_form.php');
    printDownHTML();
}

function problem($myproblem,$backlink=1)
{
    global $settings, $lang;
    printTopHTML();
    require($settings['tpl_path'].'error.php');
    printDownHTML();
}

function printNoCache()
{
    header("Cache-Control: no-store, no-cache, must-revalidate");
    header("Pragma: no-cache");
}

function printTopHTML()
{
    global $settings, $lang; // Fondamentale!
    require_once($settings['tpl_path'].'overall_header.php');
}

function printDownHTML()
{
    global $settings, $lang; // Fondamentale!
    $settings['pj_license']();
    exit();
}

function printEntries($lines,$start,$end)
{
    global $settings, $lang; // Fondamentale!
    $start = $start-1;
    $end = $end-1;
    $delimiter = "\t";
    $template_file = $settings['tpl_path'].'comments.php';
    
    if (!file_exists($template_file)) return;
    $template = file_get_contents($template_file);

    for ($i=$start;$i<=$end;$i++)
    {
        if (!isset($lines[$i])) continue;
        $line = rtrim($lines[$i]);
        $parts = explode($delimiter, $line);
        if (count($parts) < 7) continue;
        
        list($name,$from,$email,$url,$comment,$added,$isprivate) = $parts;
        $reply = $parts[7] ?? '';

        if (!empty($isprivate) && !empty($settings['use_private']) && !defined('SHOW_PRIVATE')) {
            $comment = '<br /><i><a href="gbook.php?a=viewprivate&amp;num='.$i.'">'.$lang['t58'].'</a></i><br />';
        } else {
            $comment = str_replace('##GBOOK_TEMPLATE##', $settings['tpl_path'], $comment);
        }
        
        if (!empty($reply)) {
            $comment .= '<br /><br /><i><b>'.$lang['t30'].'</b> '.str_replace('##GBOOK_TEMPLATE##', $settings['tpl_path'], $reply).'</i>';
        }

        // eval() in PHP 8 eredita lo scope della funzione, 
        // quindi ora vedrà $lang e $settings grazie al global sopra.
        ob_start();
        eval('?>' . $template . '<?php');
        ob_end_flush();
    }
}

function gbook_input($in, $error=0)
{
    $in = is_string($in) ? trim($in) : '';
    if (strlen($in)) {
        $in = htmlspecialchars($in, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
        $in = preg_replace('/\t+/',' ',$in);
    } elseif ($error) {
        problem($error);
    }
    return stripslashes($in);
}

function gbook_IP() { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }

function gbook_CheckIP()
{
    global $settings, $lang;
    $ip = gbook_IP();
    if (file_exists('banned_ip.txt')) {
        $myBanned = file_get_contents('banned_ip.txt');
        if (strpos($myBanned,$ip) !== false) { die($lang['e21'] ?? 'Banned'); }
    }
    return true;
}

function gbook_write_log($file, $content)
{
    $tmp = $file . '.' . uniqid('tmp', true);
    if (@file_put_contents($tmp, $content, LOCK_EX) !== false) {
        return @rename($tmp, $file);
    }
    return (@file_put_contents($file, $content, LOCK_EX) !== false);
}

function gbook_banIP($ip,$doDie=0)
{
    @file_put_contents('banned_ip.txt', $ip.'%', FILE_APPEND | LOCK_EX);
    if ($doDie) { die('Banned'); }
    return true;
}

function unhtmlentities($in) { return html_entity_decode($in, ENT_QUOTES | ENT_HTML5, 'UTF-8'); }