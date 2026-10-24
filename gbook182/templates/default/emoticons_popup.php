<?php
if (!defined('IN_SCRIPT')) {
	die('Invalid attempt');
}
?>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title><?php echo $lang['t70']; ?></title>
<meta http-equiv="Content-Type" content="text/html;charset=<?php echo $lang['enc']; ?>" />
<script type="text/javascript"><!--
function insertSmiley(text)
{
	var space = " ";
	var openerWin = window.opener;
	if (!openerWin && window.parent && window.parent.opener) {
		openerWin = window.parent.opener;
	}
	if (openerWin) {
		try {
			var cmnt = openerWin.document.getElementById('cmnt');
			if (cmnt) {
				var val = cmnt.value;
				var start = cmnt.selectionStart;
				var end = cmnt.selectionEnd;
				if (typeof start === 'number' && typeof end === 'number') {
					cmnt.value = val.substring(0, start) + space + text + space + val.substring(end);
					cmnt.selectionStart = cmnt.selectionEnd = start + text.length + (space.length * 2);
				} else {
					cmnt.value += space + text + space;
				}
				cmnt.focus();
				return;
			}
		} catch(e) {}
	}
	alert("Impossibile raggiungere il campo commenti nella finestra del guestbook.");
}
//-->
</script>
<link href="<?php echo $settings['tpl_path']; ?>style.css" rel="stylesheet" type="text/css" />
</head>

<body class="gbook_emoticons">

<div class="gbook_emoticons">

<?php echo $lang['t71']; ?>
<br class="clear" />
<br class="clear" />

<?php echo $list_emoticons; ?>
<br class="clear" />
<br class="clear" />


<a href="javascript:void(0)" onclick="Javascript:self.close()"><?php echo $lang['t72']; ?></a>
<br class="clear" />
<br class="clear" />

</div>

</body>

</html>

