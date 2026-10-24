<?php
if (!defined('IN_SCRIPT')) {
	die('Invalid attempt');
}
?>

<div id="gbook_guestbook" align="center">
	<span class="gbook_guestbook"><?php echo $lang['t13']; ?></span>
</div>

<form action="gbook.php" method="post">
<!--TASK FORM -->
<div id="gbook_entries">

	<?php
    if ($error)
    {
		echo '<div class="gbook_sign_error">'.$error.'</div>';
    }
    ?>

    <div class="gbook_sign_text"><?php echo $lang['t14']; ?></div>

	<div class="gbook_sign_text"><span class="gbook_entries"><b><?php echo $lang['t21']; ?></b></span><br class="clear" />
    <input type="password" name="pass" size="45" /></div>

	<div class="clear"></div>

	<div class="gbook_left"><span class="gbook_entries"><b><?php echo $lang['t16']; ?></b></span></div>

	<textarea name="comments" rows="12" cols="57" id="cmnt"><?php echo $comments; ?></textarea>

	<!--BOTTOM IMAGES -->
	<div id="gbook_bottom_images" class="gbook_bottom_images">

	<a href="#" onclick="insertSmileyTag(':D');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/bigsmile.gif"  alt=":D" title=":D" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':!cool:');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/cool.gif"  alt=":!cool:" title=":!cool:" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':!cry:');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/crying.gif"  alt=":!cry:" title=":!cry:" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':!devil:');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/devil.gif"  alt=":!devil:" title=":!devil:" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':)');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/smile.gif"  alt=":)" title=":)" width="19" height="19" /></a>&nbsp;
    <a href="#" onclick="insertSmileyTag(':!mad:');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/mad.gif"  alt=":!mad:" title=":!mad:" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':!thinking:');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/thinking.gif"  alt=":!thinking:" title=":!thinking:" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':p');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/tongueout.gif"  alt=":p" title=":p" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(';)');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/wink.gif"  alt=";)" title=";)" width="19" height="19" /></a>&nbsp;
	<a href="#" onclick="insertSmileyTag(':o');return false;"><img src="<?php echo $settings['tpl_path']; ?>images/emoticons/blush.gif"  alt=":o" title=":o" width="19" height="19" /></a>&nbsp;

	<a href="javascript:openSmiley()" class="gbook_submitted"><?php echo $lang['t26']; ?></a><br />

	<div id="gbook_more_smileys" style="display:none; margin:8px 0 10px 0; padding:10px; background:var(--gbook-card-bg, #131d35); border:1px solid var(--gbook-card-border, rgba(255,255,255,0.1)); border-radius:6px; box-shadow:var(--gbook-card-shadow, 0 2px 8px rgba(0,0,0,0.2)); max-height:160px; overflow-y:auto; text-align:left;">
		<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid var(--gbook-card-border, rgba(255,255,255,0.1)); padding-bottom:4px;">
			<strong style="font-size:11px; color:var(--gbook-link, #38bdf8);">Tutte le emoticons:</strong>
			<a href="#" onclick="document.getElementById('gbook_more_smileys').style.display='none';return false;" style="font-size:11px; color:#ef4444; text-decoration:none; font-weight:bold;">&times; Chiudi</a>
		</div>
		<div style="line-height:28px;">
		<?php
		if (file_exists($settings['tpl_path'].'emoticons.php')) {
			include_once($settings['tpl_path'].'emoticons.php');
			if (!empty($settings['emoticons']) && is_array($settings['emoticons'])) {
				foreach ($settings['emoticons'] as $code => $image) {
					echo '<a href="#" onclick="insertSmileyTag(\''.addslashes($code).'\');return false;" style="display:inline-block; margin:2px 4px; vertical-align:middle;" title="'.htmlspecialchars($code, ENT_QUOTES).'"><img src="'.$settings['tpl_path'].'images/emoticons/'.$image.'" alt="'.htmlspecialchars($code, ENT_QUOTES).'" class="gbook_emoticon" style="vertical-align:middle; border:none;" /></a> ';
				}
			}
		}
		?>
		</div>
	</div>

	<label><input type="checkbox" name="nosmileys" value="Y" class="gbook_checkbox" <?php echo $nosmileys; ?> /><span class="gbook_entries"><?php echo $lang['t28']; ?></span></label><br class="clear" />

	</div>
	<!--BOTTOM IMAGES END -->

	<div align="center">

	<div class="clear">&nbsp;</div>

    <input type="hidden" name="a" value="postreply" />
    <input type="hidden" name="num" value="<?php echo($num); ?>" />
	<input type="submit" value="<?php echo $lang['t29']; ?>" class="submit" />
	</div>

    <p>&nbsp;</p>

    <div class="gbook_sign_text"><a href="gbook.php"><?php echo $lang['t11']; ?></a></div>

    <p>&nbsp;</p>

</div>
<!--TASK FORM END -->
</form>

