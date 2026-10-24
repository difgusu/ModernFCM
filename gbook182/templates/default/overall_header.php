<?php
if (!defined('IN_SCRIPT')) {
	die('Invalid attempt');
}
?>

<?php
$pnCookieTheme = isset($_COOKIE['pn_theme']) && in_array($_COOKIE['pn_theme'], ['light', 'dark']) ? $_COOKIE['pn_theme'] : 'dark';
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" data-theme="<?php echo $pnCookieTheme; ?>" style="background-color: <?php echo ($pnCookieTheme === 'light') ? '#f1f5f9' : '#0b1120'; ?> !important; color-scheme: <?php echo ($pnCookieTheme === 'light') ? 'light' : 'dark'; ?>;">
<head>
<title><?php echo $settings['gbook_title']; ?></title>
<meta http-equiv="Content-Type" content="text/html;charset=<?php echo $lang['enc']; ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
<style>
  html, body {
    background-color: <?php echo ($pnCookieTheme === 'light') ? '#f1f5f9' : '#0b1120'; ?> !important;
    background: <?php echo ($pnCookieTheme === 'light') ? '#f1f5f9' : '#0b1120'; ?> !important;
    color: <?php echo ($pnCookieTheme === 'light') ? '#1e293b' : '#f8fafc'; ?>;
  }
  html[data-theme="dark"], html[data-theme="dark"] body {
    background-color: #0b1120 !important;
    background: #0b1120 !important;
    color: #f8fafc;
  }
  html[data-theme="light"], html[data-theme="light"] body {
    background-color: #f1f5f9 !important;
    background: #f1f5f9 !important;
    color: #1e293b;
  }
</style>
<script type="text/javascript"><!--
function insertSmileyTag(code)
{
	var el = document.getElementById('cmnt');
	if (!el) return;
	var space = ' ';
	var val = el.value;
	var start = el.selectionStart;
	var end = el.selectionEnd;
	if (typeof start === 'number' && typeof end === 'number') {
		el.value = val.substring(0, start) + space + code + space + val.substring(end);
		el.selectionStart = el.selectionEnd = start + code.length + (space.length * 2);
	} else {
		el.value += space + code + space;
	}
	el.focus();
}

function openSmiley()
{
	var inlineBox = document.getElementById('gbook_more_smileys');
	if (inlineBox) {
		if (inlineBox.style.display === 'none' || !inlineBox.style.display) {
			inlineBox.style.display = 'block';
			try {
				inlineBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			} catch(e) {}
		} else {
			inlineBox.style.display = 'none';
		}
		return;
	}
	var w = window.open("smileys.php", "smileys", "fullscreen=no,toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=yes,directories=no,location=no,width=520,height=360");
	if (w && !w.opener)
	{
		try { w.opener = self; } catch(e) {}
	}
}
//-->
</script>
<script type="text/javascript">
(function() {
	function applyThemeToDoc(theme) {
		var resolved = (theme === 'light') ? 'light' : 'dark';
		var bg = (resolved === 'light') ? '#f1f5f9' : '#0b1120';
		document.documentElement.setAttribute('data-theme', resolved);
		document.documentElement.style.setProperty('background-color', bg, 'important');
		document.documentElement.style.setProperty('background', bg, 'important');
		if (document.body) {
			document.body.style.setProperty('background-color', bg, 'important');
			document.body.style.setProperty('background', bg, 'important');
		}
	}

	function detectTheme() {
		try {
			if (window.self !== window.top && window.top.document && window.top.document.documentElement) {
				var pt = window.top.document.documentElement.getAttribute('data-theme');
				if (pt === 'light' || pt === 'dark') return pt;
			}
		} catch(e) {}
		try {
			var saved = localStorage.getItem('pn_theme');
			if (saved === 'light' || saved === 'dark') return saved;
			if (saved === 'system') {
				return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
			}
		} catch(e) {}
		try {
			var m = document.cookie.match(/(?:^|;\s*)pn_theme=(dark|light)/);
			if (m) return m[1];
		} catch(e) {}
		return 'dark';
	}

	var curTheme = detectTheme();
	applyThemeToDoc(curTheme);

	if (window.self !== window.top) {
		document.documentElement.classList.add('in-iframe');
		try {
			var observer = new MutationObserver(function() {
				try {
					var pt = window.top.document.documentElement.getAttribute('data-theme');
					if (pt && (pt === 'light' || pt === 'dark')) {
						applyThemeToDoc(pt);
					}
				} catch(e) {}
			});
			observer.observe(window.top.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		} catch(e) {}
	}

	window.addEventListener('message', function(ev) {
		if (ev && ev.data && ev.data.type === 'pn_theme_change' && ev.data.theme) {
			applyThemeToDoc(ev.data.theme);
		}
	});

	document.addEventListener('DOMContentLoaded', function() {
		applyThemeToDoc(detectTheme());
	});
})();
</script>
<link href="<?php echo $settings['tpl_path']; ?>style.css?v=<?php echo @filemtime(__DIR__ . '/style.css'); ?>" rel="stylesheet" type="text/css" />
</head>

<body style="background-color: <?php echo ($pnCookieTheme === 'light') ? '#f1f5f9' : '#0b1120'; ?> !important;">

<!--CUSTOM HEADER -->
<?php
include_once 'header.txt';
?>
<!--CUSTOM HEADER END -->

<!--HEADER -->
<div id="gbook_header">
	<h1 align="center"><?php echo $settings['gbook_title']; ?></h1>
	<!--TOP LINKS -->
	<div id="gbook_top_links">
		<div class="gbook_nav_pills">
			<a href="<?php echo $settings['website_url']; ?>"><?php echo $settings['website_title']; ?></a>
			<a href="gbook.php"><?php echo $lang['t60']; ?></a>
			<a href="gbook.php?a=sign"><?php echo $lang['t48']; ?></a>
		</div>

		<span class="gbook_entries_top"><?php echo $settings['number_of_entries']; ?> <?php echo $settings['number_of_pages']; ?></span>
		
		<div class="gbook_pages_nav">
			<?php echo $settings['pages_top']; ?>
		</div>
	</div>
	<!--TOP LINKS END -->
</div>
<!--HEADER END -->

<!--NOTICE -->
<?php
if (isset($settings['notice']) && !empty($settings['notice']))
{
	echo '<div class="gbook_sign_notice">'.$settings['notice'].'</div>';
}
?>
<!--NOTICE END -->
