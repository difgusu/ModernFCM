<?php
require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/db.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/rules.php';
require_once __DIR__ . '/inc/resolver.php';

if (!fcm_module_enabled('ModMercatoLibero')) {
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestione Mercato Disabilitata - ModernFCM</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="mercato.css">
</head>
<body style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-body, #0b1120); color: var(--text-primary, #f8fafc); font-family: system-ui, -apple-system, sans-serif; padding: 20px; margin: 0; box-sizing: border-box;">
  <div style="max-width: 500px; text-align: center; background: var(--bg-surface, #131d35); padding: 40px 24px; border-radius: var(--radius-lg, 16px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
    <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
    <h2 style="margin: 0 0 12px 0; font-size: 1.5rem; font-weight: 700; color: var(--text-primary, #f8fafc);">Modulo Mercato Libero Non Attivo</h2>
    <p style="color: var(--text-muted, #94a3b8); font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">Il pannello di Gestione Mercato non è accessibile perché il modulo è disabilitato dall'amministratore di lega nelle impostazioni del sito.</p>
    <a href="../index.php#home" style="display: inline-flex; align-items: center; gap: 8px; background: var(--accent-primary, #2563eb); color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Torna al Sito</a>
  </div>
</body>
</html>
<?php
    exit;
}

$isAdmin = mercato_is_admin();
$msg = $_GET['msg'] ?? '';
$error = $_GET['error'] ?? '';
$settings = get_mercato_settings();

// Esecuzione simulazione o assegnazione finale se richiesta
$risultatiAsta = null;
if ($isAdmin && isset($_POST['esegui_risoluzione'])) {
    if (!fcm_verify_csrf()) {
        $error = "Token CSRF non valido o sessione scaduta. Ricarica la pagina.";
    } else {
        $idSess = (int)$_POST['id_sessione'];
        $tipo = $_POST['tipo_risoluzione'] ?? 'simulazione';
        $isFinal = ($tipo === 'finale');
        if (!$isFinal && empty($settings['abilita_simulazione'])) {
            $error = "La simulazione dell'asta è disabilitata nelle impostazioni di lega per garantire la segretezza delle offerte fino alla fine dell'asta.";
        } else {
            try {
                $risultatiAsta = mercato_resolve_session($idSess, $isFinal);
                if ($isFinal) {
                    $msg = "Assegnazione finale completata con successo! Saldi aggiornati e report archiviato.";
                }
            } catch (Exception $e) {
                $error = $e->getMessage();
            }
        }
    }
}

// Lista sessioni
$sessioni = mercato_db_get_sessions();
// Finché una sessione non ancora assegnata contiene buste l'opzione sulla simulazione resta bloccata
$sessioneConBuste = $isAdmin ? mercato_db_find_pending_session() : null;
$registro = $isAdmin ? mercato_registro_leggi() : [];
$registroMostrato = mercato_registro_da_mostrare($registro);
$registroRiepilogo = mercato_registro_riepilogo($registro);
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars(fcm_csrf_token()) ?>">
  <title>Pannello Admin Mercato - ModernFCM</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="mercato.css?v=<?= time() ?>">
  <?php
  if (file_exists(__DIR__ . '/../inc/theme_loader.php')) {
      require_once __DIR__ . '/../inc/theme_loader.php';
      echo fcm_render_custom_theme_css();
  }
  $fcmDefaultThemePref = isset($GLOBALS['fcmThemeConfig']['default_mode']) ? $GLOBALS['fcmThemeConfig']['default_mode'] : 'system';
  ?>
  <script>
  (function() {
      var defaultPref = <?= json_encode($fcmDefaultThemePref) ?>;
      var saved = null;
      try { saved = localStorage.getItem('pn_theme'); } catch(e) {}
      var pref = saved || defaultPref || 'system';
      var resolved = pref;
      if (window.self !== window.top) {
          document.documentElement.classList.add('in-iframe');
          try {
              var topTheme = window.top.document.documentElement.getAttribute('data-theme');
              if (topTheme === 'light' || topTheme === 'dark') resolved = topTheme;
          } catch(e) {}
      }
      if (resolved !== 'light' && resolved !== 'dark') {
          resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', resolved);
      window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'pn_theme_change' && (e.data.theme === 'light' || e.data.theme === 'dark')) {
              document.documentElement.setAttribute('data-theme', e.data.theme);
          }
      });
  })();
  </script>
</head>
<body>

<div class="mercato-wrapper">

  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
    <h1 style="margin:0; font-size:1.5rem;">⚙️ Gestione Mercato Libero</h1>
    <div style="display:flex; gap:8px; align-items:center;">
      <a href="index.php" class="btn btn-secondary">← Torna al Mercato</a>
      <?php if ($isAdmin): ?>
      <button type="button" onclick="openSettingsModal()" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px;">
        ⚙️ Impostazioni
      </button>
      <button onclick="handleAdminLogout()" class="btn btn-danger">Logout Admin</button>
      <?php endif; ?>
    </div>
  </div>

  <?php if ($msg): ?>
  <div class="alert-mercato alert-success"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>
  <?php if ($error): ?>
  <div class="alert-mercato alert-danger"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>

  <?php if (!$isAdmin): ?>
  <!-- Form Login Admin -->
  <div style="max-width: 400px; margin: 40px auto; background: var(--m-card-bg); padding: 30px; border-radius: var(--m-radius); border: 1px solid var(--m-border); box-shadow: var(--m-shadow);">
    <h2 style="margin-top:0; text-align:center;">Accesso Amministratore</h2>
    <p style="color:var(--m-text-muted); font-size:0.85rem; text-align:center;">Inserisci la password amministratore</p>
    
    <form id="adminLoginForm">
      <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:6px;">Password Admin</label>
      <input type="password" id="adminPwdInput" required placeholder="Password..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); margin-bottom:16px; box-sizing:border-box;">
      <button type="submit" class="btn btn-primary" style="width:100%; padding:10px;">Accedi</button>
    </form>
  </div>

  <?php else: ?>

  <!-- Sezione Creazione / Modifica Sessione -->
  <div class="stat-card" style="margin-bottom:24px;">
    <h3 style="margin-top:0;">📅 Crea / Modifica Sessione di Mercato</h3>
    <form id="sessionForm" onsubmit="handleSaveSession(event)" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
      <input type="hidden" id="sessId">
      <div style="flex:2; min-width:200px;">
        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Nome Sessione</label>
        <input type="text" id="sessNome" required placeholder="es. 1ª Sessione Riparazione - Settembre" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); box-sizing:border-box;">
      </div>
      <div style="flex:1; min-width:180px;">
        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Data Apertura</label>
        <input type="datetime-local" id="sessApertura" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); box-sizing:border-box;">
      </div>
      <div style="flex:1; min-width:180px;">
        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Data Chiusura</label>
        <input type="datetime-local" id="sessChiusura" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); box-sizing:border-box;">
      </div>
      <div>
        <button type="submit" class="btn btn-primary" style="padding:10px 18px;">Salva Sessione</button>
      </div>
    </form>
  </div>

  <!-- Modal Impostazioni Mercato & Tagli -->
  <dialog id="settingsModal" closedby="any" aria-labelledby="settingsModalTitle" style="max-width:640px; width:92%; max-height:90vh; overflow-y:auto; border-radius:16px;">
    <div class="dialog-header">
      <h2 id="settingsModalTitle" style="display:flex; align-items:center; gap:8px; font-size:1.25rem;">
        <span>⚙️</span> Impostazioni Mercato & Tagli
      </h2>
      <button type="button" onclick="closeSettingsModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--m-text-muted); line-height:1;">&times;</button>
    </div>

    <p style="color:var(--m-text-muted); font-size:0.85rem; margin-top:0; margin-bottom:16px;">
      Configura le percentuali di recupero crediti per i tagli della rosa e le opzioni di visualizzazione dei calciatori disponibili.
    </p>

    <form id="settingsForm" onsubmit="handleSaveSettings(event)">
      <datalist id="ticks_perc">
        <option value="0" label="0%"></option>
        <option value="25" label="25%"></option>
        <option value="50" label="50%"></option>
        <option value="75" label="75%"></option>
        <option value="100" label="100%"></option>
      </datalist>

      <div class="settings-grid">
        <!-- Categoria ESTERA -->
        <div class="setting-row">
          <div class="setting-meta">
            <strong>{ESTERA}</strong>
            <small>Calciatori ceduti all'estero (default: 100%)</small>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input type="range" id="range_estera" min="0" max="100" step="5" list="ticks_perc" value="<?= (int)($settings['perc_recupero_estera'] ?? 100) ?>" oninput="syncRange('range_estera', 'num_estera')">
              <datalist>
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </datalist>
            </div>
            <div class="num-wrap">
              <input type="number" id="num_estera" name="perc_recupero_estera" min="0" max="100" step="1" value="<?= (int)($settings['perc_recupero_estera'] ?? 100) ?>" oninput="syncNum('num_estera', 'range_estera')">
              <span>%</span>
            </div>
          </div>
        </div>

        <!-- Categoria MINORE -->
        <div class="setting-row">
          <div class="setting-meta">
            <strong>{MINORE}</strong>
            <small>Calciatori retrocessi o ceduti in Serie B / serie minori (default: 50%)</small>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input type="range" id="range_minore" min="0" max="100" step="5" list="ticks_perc" value="<?= (int)($settings['perc_recupero_minore'] ?? 50) ?>" oninput="syncRange('range_minore', 'num_minore')">
              <datalist>
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </datalist>
            </div>
            <div class="num-wrap">
              <input type="number" id="num_minore" name="perc_recupero_minore" min="0" max="100" step="1" value="<?= (int)($settings['perc_recupero_minore'] ?? 50) ?>" oninput="syncNum('num_minore', 'range_minore')">
              <span>%</span>
            </div>
          </div>
        </div>

        <!-- Categoria ELIMINATA -->
        <div class="setting-row">
          <div class="setting-meta">
            <strong>{ELIMINATA}</strong>
            <small>Calciatori ritirati o svincolati dalla lista (default: 0%)</small>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input type="range" id="range_eliminata" min="0" max="100" step="5" list="ticks_perc" value="<?= (int)($settings['perc_recupero_eliminata'] ?? 0) ?>" oninput="syncRange('range_eliminata', 'num_eliminata')">
              <datalist>
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </datalist>
            </div>
            <div class="num-wrap">
              <input type="number" id="num_eliminata" name="perc_recupero_eliminata" min="0" max="100" step="1" value="<?= (int)($settings['perc_recupero_eliminata'] ?? 0) ?>" oninput="syncNum('num_eliminata', 'range_eliminata')">
              <span>%</span>
            </div>
          </div>
        </div>

        <!-- Giocatore di A -->
        <div class="setting-row">
          <div class="setting-meta">
            <strong>Giocatore di A</strong>
            <small>Calciatori ancora militanti in Serie A (default: 0%)</small>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input type="range" id="range_serie_a" min="0" max="100" step="5" list="ticks_perc" value="<?= (int)($settings['perc_recupero_serie_a'] ?? 0) ?>" oninput="syncRange('range_serie_a', 'num_serie_a')">
              <datalist>
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </datalist>
            </div>
            <div class="num-wrap">
              <input type="number" id="num_serie_a" name="perc_recupero_serie_a" min="0" max="100" step="1" value="<?= (int)($settings['perc_recupero_serie_a'] ?? 0) ?>" oninput="syncNum('num_serie_a', 'range_serie_a')">
              <span>%</span>
            </div>
          </div>
        </div>

        <!-- Spunta Arrotondamento per eccesso -->
        <div class="setting-checkbox-row">
          <input type="checkbox" id="arrotonda_eccesso" name="arrotonda_eccesso" value="1" <?= !empty($settings['arrotonda_eccesso']) ? 'checked' : '' ?>>
          <label for="arrotonda_eccesso" class="checkbox-text" style="cursor:pointer;">
            <strong>Arrotonda recupero crediti per eccesso</strong>
          </label>
        </div>

        <!-- Spunta Mostra Giocatori {ESTERA}, {MINORE}, {ELIMINATA} -->
        <div class="setting-checkbox-row">
          <input type="checkbox" id="mostra_estera_minore_eliminata" name="mostra_estera_minore_eliminata" value="1" <?= !isset($settings['mostra_estera_minore_eliminata']) || !empty($settings['mostra_estera_minore_eliminata']) ? 'checked' : '' ?>>
          <label for="mostra_estera_minore_eliminata" class="checkbox-text" style="cursor:pointer;">
            <strong>Mostra tra i giocatori disponibili anche {ESTERA}, {MINORE}, {ELIMINATA}</strong>
            <small>Consente l'acquisto di calciatori non militanti in Serie A.</small>
          </label>
        </div>

        <!-- Spunta Mostra Chiamate e Tagli degli altri utenti -->
        <div class="setting-checkbox-row">
          <input type="checkbox" id="mostra_chiamate_altri" name="mostra_chiamate_altri" value="1" <?= !empty($settings['mostra_chiamate_altri']) ? 'checked' : '' ?>>
          <label for="mostra_chiamate_altri" class="checkbox-text" style="cursor:pointer;">
            <strong>Consenti agli utenti di vedere le chiamate e i tagli altrui</strong>
            <small>Mostra a tutte le fantasquadre quali calciatori sono stati chiamati e tagliati dagli avversari in questa sessione (l'importo offerto rimane rigorosamente segreto).</small>
          </label>
        </div>

        <!-- Spunta Consenti Simulazione Asta all'Admin -->
        <div class="setting-checkbox-row">
          <input type="checkbox" id="abilita_simulazione" name="abilita_simulazione" value="1" <?= !isset($settings['abilita_simulazione']) || !empty($settings['abilita_simulazione']) ? 'checked' : '' ?><?= $sessioneConBuste ? ' disabled' : '' ?>>
          <label for="abilita_simulazione" class="checkbox-text" style="cursor:pointer;">
            <strong>Consenti la simulazione dell'asta all'amministratore</strong>
            <small>Se disattivato, il pulsante "Simula" viene rimosso e gli importi offerti nelle buste non sono consultabili dal pannello fino all'assegnazione finale dell'asta; chi gestisce l'hosting può comunque leggere i file sul server. L'opzione non si può cambiare finché una sessione non ancora assegnata contiene buste. Simulazioni e modifiche vengono annotate nel registro visibile alle squadre.</small>
            <?php if ($sessioneConBuste): ?>
            <small style="color:var(--m-warning); margin-top:4px;">🔒 Opzione bloccata: la sessione <?= htmlspecialchars(mercato_registro_sessione($sessioneConBuste)) ?> contiene buste non ancora assegnate.</small>
            <?php endif; ?>
          </label>
        </div>
      </div>

      <div id="settingsAlert" class="alert-mercato" style="display:none; margin-top:14px;"></div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" onclick="closeSettingsModal()" class="btn btn-secondary" style="padding:10px 18px;">Chiudi</button>
        <button type="submit" class="btn btn-primary" style="padding:10px 22px;">💾 Salva Impostazioni</button>
      </div>
    </form>
  </dialog>

  <!-- Elenco Sessioni -->
  <div class="buste-box" style="margin-bottom:24px;">
    <h3 style="margin-top:0;">Elenco Sessioni Registrate</h3>
    <table class="table-custom">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nome</th>
          <th>Apertura</th>
          <th>Chiusura</th>
          <th>Stato</th>
          <th>Buste Ricevute</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        <?php if (empty($sessioni)): ?>
        <tr><td colspan="7" style="text-align:center; color:var(--m-text-muted);">Nessuna sessione registrata. Creane una dal modulo sopra.</td></tr>
        <?php else: ?>
        <?php foreach ($sessioni as $s): ?>
        <?php $numBuste = mercato_db_count_bids($s['id']); ?>
        <tr>
          <td>#<?= $s['id'] ?></td>
          <td><strong><?= htmlspecialchars($s['nome']) ?></strong></td>
          <td><?= date('d/m/Y H:i', strtotime($s['data_apertura'])) ?></td>
          <td><?= date('d/m/Y H:i', strtotime($s['data_chiusura'])) ?></td>
          <td>
            <?php if (!empty($s['elaborata'])): ?>
              <span style="color:var(--m-text-muted); font-weight:700;">🔒 Elaborata</span>
            <?php elseif (!empty($s['attiva'])): ?>
              <span style="color:var(--m-success); font-weight:700;">🟢 Attiva</span>
            <?php else: ?>
              <span style="color:var(--m-danger); font-weight:700;">⚪ Chiusa</span>
            <?php endif; ?>
          </td>
          <td><span style="font-weight:700;"><?= $numBuste ?></span> offerte</td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <?php if (empty($s['elaborata'])): ?>
                <?php if (!empty($s['attiva'])): ?>
                <button onclick="toggleSession(<?= $s['id'] ?>, 0)" class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;">Chiudi</button>
                <?php else: ?>
                <button onclick="toggleSession(<?= $s['id'] ?>, 1)" class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;">Apri</button>
                <?php endif; ?>

                <?php if (!empty($settings['abilita_simulazione'])): ?>
                <form method="POST" style="display:inline;">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars(fcm_csrf_token()) ?>">
                  <input type="hidden" name="id_sessione" value="<?= $s['id'] ?>">
                  <input type="hidden" name="tipo_risoluzione" value="simulazione">
                  <button type="submit" name="esegui_risoluzione" class="btn btn-secondary btn-simula" style="padding:4px 8px; font-size:0.75rem;">Simula</button>
                </form>
                <?php else: ?>
                <span style="font-size:0.75rem; color:var(--m-text-muted); padding:3px 6px; border:1px dashed var(--m-border); border-radius:6px; user-select:none;" title="Simulazione disabilitata nelle impostazioni per garantire la segretezza delle offerte">🔒 Segrete</span>
                <?php endif; ?>

                <form method="POST" style="display:inline;" onsubmit="return confirm('Sei sicuro? L\'assegnazione finale applicherà definitivamente i crediti e chiuderà la sessione!');">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars(fcm_csrf_token()) ?>">
                  <input type="hidden" name="id_sessione" value="<?= $s['id'] ?>">
                  <input type="hidden" name="tipo_risoluzione" value="finale">
                  <button type="submit" name="esegui_risoluzione" class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;">Assegna Finale</button>
                </form>

                <button type="button" onclick="handleDeleteSession(<?= $s['id'] ?>, 0)" class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; color:var(--m-danger);" title="Elimina sessione">🗑️ Elimina</button>
              <?php else: ?>
                <button type="button" onclick="viewSessionReport(<?= (int)$s['id'] ?>, <?= htmlspecialchars(json_encode((string)$s['nome']), ENT_QUOTES, 'UTF-8') ?>)" class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;">📄 Vedi Report</button>
                <button type="button" onclick="handleDeleteSession(<?= $s['id'] ?>, 1)" class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" title="Elimina sessione elaborata">🗑️ Elimina</button>
              <?php endif; ?>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
        <?php endif; ?>
      </tbody>
    </table>
  </div>

  <!-- Box Risultati Risoluzione & Scheda Operazioni FCM -->
  <?php if ($risultatiAsta): ?>
  <div class="stat-card" style="border:2px solid var(--m-primary); margin-bottom:24px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
      <h2 style="margin:0;">
        <?= $risultatiAsta['is_finale'] ? '🏆 Report Assegnazione Finale' : '🔍 Risultati Simulazione Asta' ?>
      </h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" onclick="copyReportText()" id="btnCopyReport" class="btn btn-secondary btn-report-copy" style="padding:8px 14px; font-size:0.85rem;">📋 Copia Intero Report</button>
        <button type="button" onclick="copyFcmSchedule()" id="btnCopyFcm" class="btn btn-primary" style="padding:8px 14px; font-size:0.85rem;">📋 Copia Operazioni per FCM</button>
      </div>
    </div>
    <textarea id="currentReportText" style="display:none;"><?= htmlspecialchars($risultatiAsta['report_txt'] ?? '') ?></textarea>

    <!-- Scheda Guidata FCM per Squadra -->
    <div style="background:var(--m-body-bg); border:1px solid var(--m-border); border-radius:10px; padding:16px; margin-bottom:18px;" id="fcmScheduleBox">
      <h3 style="margin-top:0; font-size:1.05rem;">📋 Scheda Operazioni da applicare in FCM</h3>
      <?php if (empty($risultatiAsta['operazioni_per_squadra'])): ?>
        <p style="color:var(--m-text-muted); margin:0;">Nessun calciatore assegnato in questa sessione.</p>
      <?php else: ?>
        <?php foreach ($risultatiAsta['operazioni_per_squadra'] as $sqId => $op): ?>
        <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed var(--m-border);">
          <div style="font-weight:700; font-size:1rem; color:var(--m-primary);"><?= htmlspecialchars($op['nome_squadra']) ?> (Div. <?= $op['divisione'] ?>)</div>
          <ul style="margin:6px 0 6px 20px; padding:0; font-size:0.9rem;">
            <?php foreach ($op['tagli'] as $t): ?>
            <li style="color:var(--m-danger);">Taglio: <strong><?= htmlspecialchars($t['giocatore']) ?></strong> (+<?= $t['recupero'] ?> crediti recupero)</li>
            <?php endforeach; ?>
            <?php foreach ($op['acquisti'] as $a): ?>
            <li style="color:var(--m-success);">Acquisto: <strong><?= htmlspecialchars($a['giocatore']) ?></strong> a <strong><?= $a['costo'] ?> crediti</strong></li>
            <?php endforeach; ?>
          </ul>
          <small style="color:var(--m-text-muted);">Saldo crediti da registrare in FCM: <strong><?= $op['saldo_netto'] >= 0 ? "+{$op['saldo_netto']}" : $op['saldo_netto'] ?> crediti</strong></small>
        </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>

    <!-- Tabella Esiti Completi (Assegnati / Conflitti / Perse) -->
    <h3>Dettaglio Tutte le Buste Decifrate</h3>
    <table class="table-custom">
      <thead>
        <tr>
          <th>Calciatore</th>
          <th>Squadra</th>
          <th>Offerta</th>
          <th>Stato</th>
          <th>Taglio Previsto</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($risultatiAsta['esiti'] as $e): ?>
        <tr>
          <td><strong><?= htmlspecialchars($e['nome_giocatore']) ?></strong></td>
          <td><?= htmlspecialchars($e['nome_squadra']) ?></td>
          <td><span style="font-weight:700;"><?= $e['crediti'] ?> cr</span></td>
          <td>
            <?php if ($e['stato'] === 'ASSEGNATO'): ?>
              <span class="status-badge-assigned">ASSEGNATO</span>
            <?php elseif ($e['stato'] === 'CONFLITTO'): ?>
              <span class="status-badge-conflict">⚠️ BUSTA PARI (CONFLITTO)</span>
            <?php else: ?>
              <span style="color:var(--m-text-muted); font-size:0.8rem;">PERSA</span>
            <?php endif; ?>
          </td>
          <td><?= !empty($e['nome_tagliato']) ? htmlspecialchars($e['nome_tagliato']) . " (+{$e['crediti_recupero']} cr)" : "---" ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>

  <!-- Registro delle azioni sensibili dell'amministratore (sola lettura) -->
  <div class="buste-box" style="margin-bottom:24px;">
    <h3 style="margin-top:0;">📜 Registro Azioni dell'Amministratore</h3>
    <p class="registro-nota">Simulazioni, report consultati prima dell'assegnazione finale, assegnazioni finali e modifiche a impostazioni e sessioni vengono annotati qui. L'elenco non è modificabile dal pannello ed è visibile anche alle squadre che accedono al mercato.</p>
    <?php if ($registroRiepilogo !== ''): ?>
    <p class="registro-nota" style="color:var(--m-text);"><strong><?= htmlspecialchars($registroRiepilogo) ?></strong></p>
    <?php endif; ?>
    <?php if (empty($registro)): ?>
      <p class="registro-nota" style="margin-bottom:0;">Nessuna azione registrata.</p>
    <?php else: ?>
      <ul class="registro-list">
        <?php foreach ($registroMostrato as $voce): ?>
        <li><span class="registro-data"><?= htmlspecialchars(mercato_registro_data($voce['ts'])) ?></span><?= htmlspecialchars($voce['testo']) ?></li>
        <?php endforeach; ?>
      </ul>
      <?php if (count($registroMostrato) < count($registro)): ?>
      <p class="registro-nota" style="margin-bottom:0;">Sono mostrate <?= count($registroMostrato) ?> azioni su <?= count($registro) ?>. Restano sempre in elenco tutte le simulazioni e i report anticipati che hanno reso visibili degli importi, tutte le assegnazioni finali, tutte le modifiche a impostazioni e sessioni (date comprese) e tutte le eliminazioni di sessioni; delle altre azioni (aperture e chiusure manuali, creazione di sessioni, simulazioni e report che non hanno mostrato importi segreti) solo le 200 più recenti.</p>
      <?php endif; ?>
    <?php endif; ?>
  </div>

  <?php endif; ?>

  <!-- Modal Visualizzazione e Copia Report Sessione -->
  <dialog id="reportViewModal" closedby="any" aria-labelledby="reportModalTitle" style="max-width:850px; width:95%; max-height:90vh; overflow-y:auto; border-radius:16px; padding:24px;">
    <div class="dialog-header" style="align-items:flex-start; margin-bottom:12px;">
      <div>
        <h2 id="reportModalTitle" style="margin:0; font-size:1.25rem;">📄 Report Mercato</h2>
        <div id="reportModalSubtitle" style="font-size:0.85rem; color:var(--m-text-muted); margin-top:2px;"></div>
      </div>
      <button type="button" onclick="closeReportModal()" class="btn btn-secondary" style="padding:4px 10px; font-size:0.9rem;" title="Chiudi">✕</button>
    </div>

    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center;">
      <button type="button" id="btnCopyModalReport" onclick="copyModalReport()" class="btn btn-primary" style="padding:8px 16px; font-size:0.85rem; background:#0284c7;">
        📋 Copia Report negli Appunti
      </button>
      <button type="button" id="btnDownloadModalReport" onclick="downloadModalReport()" class="btn btn-secondary" style="padding:8px 14px; font-size:0.85rem;">
        ⬇️ Scarica File .txt
      </button>
      <span id="copyModalSuccessMsg" style="display:none; color:var(--m-success); font-weight:700; font-size:0.85rem;">✅ Copiato negli appunti!</span>
    </div>

    <div style="position:relative;">
      <pre id="reportModalContent" style="background:var(--m-body-bg); border:1px solid var(--m-border); border-radius:10px; padding:16px; font-family:Consolas, Monaco, 'Courier New', monospace; font-size:0.85rem; line-height:1.45; overflow-x:auto; white-space:pre; margin:0; max-height:60vh;"></pre>
    </div>

    <div style="display:flex; justify-content:flex-end; margin-top:16px;">
      <button type="button" onclick="closeReportModal()" class="btn btn-secondary" style="padding:8px 18px;">Chiudi</button>
    </div>
  </dialog>

</div>

<script>
function getAdminCsrfHeaders() {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  return token ? { 'X-CSRF-Token': token } : {};
}

// Login Admin
const adminForm = document.getElementById('adminLoginForm');
if (adminForm) {
  adminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = document.getElementById('adminPwdInput').value;
    const fd = new FormData();
    fd.append('action', 'login_admin');
    fd.append('password', pwd);

    fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd })
      .then(r => r.json())
      .then(res => {
        if (res.success) location.reload();
        else alert(res.error);
      });
  });
}

function handleAdminLogout() {
  const fd = new FormData();
  fd.append('action', 'logout');
  fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd }).then(() => location.reload());
}

function handleSaveSession(e) {
  e.preventDefault();
  const id = document.getElementById('sessId').value;
  const nome = document.getElementById('sessNome').value;
  const apertura = document.getElementById('sessApertura').value;
  const chiusura = document.getElementById('sessChiusura').value;

  const fd = new FormData();
  fd.append('action', 'admin_save_session');
  if (id) fd.append('id', id);
  fd.append('nome', nome);
  fd.append('data_apertura', apertura);
  fd.append('data_chiusura', chiusura);

  fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(res => {
      if (res.success) location.reload();
      else alert(res.error);
    });
}

function toggleSession(id, attiva) {
  const fd = new FormData();
  fd.append('action', 'admin_toggle_session');
  fd.append('id', id);
  fd.append('attiva', attiva);

  fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(res => {
      if (res.success) location.reload();
      else alert(res.error);
    });
}

function handleDeleteSession(id, isElaborata) {
  const msg = isElaborata
    ? `ATTENZIONE: Stai per eliminare la sessione #${id}, che è GIÀ STATA ELABORATA!\nVerranno eliminate tutte le relative offerte, i report salvati e revocati/cancellati anche tutti i crediti extra assegnati alle squadre per questa sessione.\n\nVuoi procedere?`
    : `Sei sicuro di voler eliminare la sessione #${id} e tutte le offerte collegate?`;

  if (!confirm(msg)) return;

  const fd = new FormData();
  fd.append('action', 'admin_delete_session');
  fd.append('id_sessione', id);

  fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        location.reload();
      } else {
        alert(res.error || 'Errore durante l\'eliminazione della sessione.');
      }
    })
    .catch(() => alert('Errore di connessione durante l\'eliminazione.'));
}

function copyReportText() {
  const el = document.getElementById('currentReportText');
  if (!el || !el.value) return;
  const btn = document.getElementById('btnCopyReport');
  navigator.clipboard.writeText(el.value).then(() => {
    if (btn) {
      const orig = btn.innerText;
      btn.innerText = '✅ Report Copiato!';
      setTimeout(() => { btn.innerText = orig; }, 2000);
    }
  }).catch(() => {
    alert("Impossibile copiare negli appunti automaticamente. Seleziona il testo del report manualmente.");
  });
}

let currentViewReportId = null;
let currentViewReportNome = '';

function viewSessionReport(id, nome) {
  currentViewReportId = id;
  currentViewReportNome = nome || ('Sessione #' + id);
  const modal = document.getElementById('reportViewModal');
  const titleEl = document.getElementById('reportModalSubtitle');
  const contentEl = document.getElementById('reportModalContent');
  const copyMsg = document.getElementById('copyModalSuccessMsg');

  if (titleEl) titleEl.innerText = `${currentViewReportNome} (ID #${id})`;
  if (contentEl) contentEl.innerText = 'Caricamento report in corso...';
  if (copyMsg) copyMsg.style.display = 'none';

  if (modal) {
    document.body.classList.add('modal-open');
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    centerModalInView(modal);
    requestAnimationFrame(() => centerModalInView(modal));
  }

  fetch(`api.php?action=admin_get_report&id_sessione=${id}`)
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        if (contentEl) contentEl.innerText = res.report_txt || 'Nessun report disponibile per questa sessione.';
      } else {
        if (contentEl) contentEl.innerText = 'Errore nel recupero del report: ' + (res.error || 'Sconosciuto');
      }
      centerModalInView(modal);
    })
    .catch(() => {
      if (contentEl) contentEl.innerText = 'Errore di rete durante il caricamento del report.';
    });
}

function closeReportModal() {
  const modal = document.getElementById('reportViewModal');
  if (modal) {
    document.body.classList.remove('modal-open');
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
    modal.style.position = '';
    modal.style.top = '';
    modal.style.left = '';
    modal.style.transform = '';
    modal.style.margin = '';
    modal.style.maxHeight = '';
    notifyParentResize();
    setTimeout(notifyParentResize, 60);
  }
}

function copyModalReport() {
  const contentEl = document.getElementById('reportModalContent');
  if (!contentEl) return;
  const text = contentEl.innerText;
  const btn = document.getElementById('btnCopyModalReport');
  const copyMsg = document.getElementById('copyModalSuccessMsg');

  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const orig = btn.innerText;
      btn.innerText = '✅ Copiato!';
      setTimeout(() => { btn.innerText = orig; }, 2000);
    }
    if (copyMsg) {
      copyMsg.style.display = 'inline';
      setTimeout(() => { copyMsg.style.display = 'none'; }, 2500);
    }
  }).catch(() => {
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    alert('Testo selezionato! Premi CTRL+C per copiarlo.');
  });
}

function downloadModalReport() {
  const contentEl = document.getElementById('reportModalContent');
  if (!contentEl) return;
  const text = contentEl.innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (currentViewReportNome || 'Sessione').replace(/[^a-zA-Z0-9_\-]/g, '_');
  a.download = `Report-${safeName}-Sess-${currentViewReportId || 0}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Light-dismiss click outside per il report modal
const reportModalEl = document.getElementById('reportViewModal');
if (reportModalEl && !('closedBy' in HTMLDialogElement.prototype)) {
  reportModalEl.addEventListener('click', (event) => {
    if (event.target !== reportModalEl) return;
    const rect = reportModalEl.getBoundingClientRect();
    const isInside = (
      rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width
    );
    if (!isInside) closeReportModal();
  });
}

function copyFcmSchedule() {
  const box = document.getElementById('fcmScheduleBox');
  if (!box) return;
  navigator.clipboard.writeText(box.innerText).then(() => {
    alert("Operazioni copiate negli appunti! Ora puoi incollarle su WhatsApp o usarle per FCM.");
  });
}

// Sincronizzazione dinamica Slider <-> Campo Numerico
function syncRange(rangeId, numId) {
  const rangeEl = document.getElementById(rangeId);
  const numEl = document.getElementById(numId);
  if (rangeEl && numEl) {
    numEl.value = rangeEl.value;
  }
}

function syncNum(numId, rangeId) {
  const rangeEl = document.getElementById(rangeId);
  const numEl = document.getElementById(numId);
  if (rangeEl && numEl) {
    let val = parseInt(numEl.value, 10);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;
    numEl.value = val;
    rangeEl.value = val;
  }
}

// Centratura dinamica del Modal sia in viewport standalone sia dentro l'iframe seamless di ModernFCM
function centerModalInView(modal) {
  if (!modal) return;

  const isIframe = (window.self !== window.top);
  if (isIframe) {
    let screenCenterInIframe = 0;
    let vh = 800;

    try {
      if (window.top && window.top.document) {
        const iframe = window.frameElement || window.top.document.getElementById('spaEmbeddedFrame');
        if (iframe) {
          const iframeRect = iframe.getBoundingClientRect();
          vh = window.top.innerHeight || 800;
          screenCenterInIframe = -iframeRect.top + (vh / 2);
        }
      }
    } catch (e) {}

    if (!screenCenterInIframe) {
      const activeEl = document.activeElement;
      const elRect = (activeEl && typeof activeEl.getBoundingClientRect === 'function') ? activeEl.getBoundingClientRect() : null;
      if (elRect) {
        screenCenterInIframe = (window.pageYOffset || document.documentElement.scrollTop || 0) + elRect.top;
      } else {
        screenCenterInIframe = 250;
      }
    }

    const modalH = modal.offsetHeight || 420;
    const halfH = modalH / 2;
    const safeTop = Math.max(halfH + 20, screenCenterInIframe);

    modal.style.position = 'absolute';
    modal.style.top = safeTop + 'px';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.margin = '0';
    modal.style.maxHeight = Math.max(300, vh - 40) + 'px';
    modal.style.overflowY = 'auto';

    notifyParentResize(Math.ceil(safeTop + halfH + 60));
  } else {
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.margin = '0';
    modal.style.maxHeight = '88vh';
    modal.style.overflowY = 'auto';
  }
}

// Controllo apertura e chiusura Modal Impostazioni
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    document.body.classList.add('modal-open');
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    centerModalInView(modal);
    requestAnimationFrame(() => centerModalInView(modal));
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    document.body.classList.remove('modal-open');
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
    modal.style.position = '';
    modal.style.top = '';
    modal.style.left = '';
    modal.style.transform = '';
    modal.style.margin = '';
    modal.style.maxHeight = '';
    notifyParentResize();
    setTimeout(notifyParentResize, 60);
  }
}

// Light-dismiss click outside per browser che non supportano ancora closedby nativo
const settingsModalEl = document.getElementById('settingsModal');
if (settingsModalEl && !('closedBy' in HTMLDialogElement.prototype)) {
  settingsModalEl.addEventListener('click', (event) => {
    if (event.target !== settingsModalEl) return;
    const rect = settingsModalEl.getBoundingClientRect();
    const isInside = (
      rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width
    );
    if (!isInside) closeSettingsModal();
  });
}

// Salvataggio AJAX Impostazioni e Percentuali
function handleSaveSettings(e) {
  e.preventDefault();
  const alertEl = document.getElementById('settingsAlert');
  const fd = new FormData(document.getElementById('settingsForm'));
  fd.append('action', 'admin_save_settings');
  fd.set('arrotonda_eccesso', document.getElementById('arrotonda_eccesso').checked ? '1' : '0');
  fd.set('mostra_estera_minore_eliminata', document.getElementById('mostra_estera_minore_eliminata').checked ? '1' : '0');
  fd.set('mostra_chiamate_altri', document.getElementById('mostra_chiamate_altri').checked ? '1' : '0');
  fd.set('abilita_simulazione', document.getElementById('abilita_simulazione').checked ? '1' : '0');

  fetch('api.php', { method: 'POST', headers: getAdminCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(res => {
      alertEl.style.display = 'block';
      if (res.success) {
        alertEl.className = 'alert-mercato alert-success';
        alertEl.innerText = res.msg || 'Impostazioni salvate con successo!';
        setTimeout(() => {
          closeSettingsModal();
          location.reload();
        }, 1200);
      } else {
        alertEl.className = 'alert-mercato alert-danger';
        alertEl.innerText = res.error || 'Errore nel salvataggio.';
      }
      notifyParentResize(1050);
    })
    .catch(() => {
      alertEl.style.display = 'block';
      alertEl.className = 'alert-mercato alert-danger';
      alertEl.innerText = 'Errore di connessione.';
    });
}

function notifyParentResize(minH) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'pn_iframe_resize', minHeight: minH || 0 }, '*');
    }
  } catch (err) { }
}

window.addEventListener('DOMContentLoaded', notifyParentResize);
window.addEventListener('load', notifyParentResize);
</script>

</body>
</html>
