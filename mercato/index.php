<?php
require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/db.php';
require_once __DIR__ . '/inc/auth.php';
require_once __DIR__ . '/inc/fcm_parser.php';
require_once __DIR__ . '/inc/rules.php';

$teamId = mercato_get_logged_team_id();
$sessione = mercato_get_current_session();
$settings = get_mercato_settings();
$financials = $teamId ? mercato_get_team_financials($teamId, $sessione['id'] ?? null) : null;
$chiamateAltri = ($sessione && !empty($settings['mostra_chiamate_altri']))
    ? mercato_get_session_public_bids($sessione['id'], $teamId, $_SESSION['mercato_divisione'] ?? null)
    : [];
$fcmData = fcm_parse_all_data();
$squadre = $fcmData['fantasquadre'];

$ruoliNomi = [1 => 'P', 2 => 'D', 3 => 'C', 4 => 'A'];
$ruoliDesc = [1 => 'Portiere', 2 => 'Difensore', 3 => 'Centrocampista', 4 => 'Attaccante'];

function get_shirt_img_html($club, $size = 20) {
    if (empty($club)) return '';
    $clean = trim($club);
    $enc = htmlspecialchars(rawurlencode($clean));
    $src = "../img/sq/{$enc}.png";
    return '<img src="' . $src . '" style="width:' . $size . 'px; height:' . $size . 'px; object-fit:contain; vertical-align:middle; margin-right:6px; flex-shrink:0; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));" onerror="if(!this.dataset.fallback){this.dataset.fallback=\'1\';this.src=\'../img/sq/' . $enc . '.png\';}else{this.src=\'../img/sq/undefined.svg\';}" alt="' . htmlspecialchars($clean) . '">';
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars(fcm_csrf_token()) ?>">
  <title>Mercato Libero - ModernFCM</title>
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

  <?php if (!$teamId): ?>
  <!-- Box di Accesso Squadra -->
  <div style="max-width: 420px; margin: 40px auto; background: var(--m-card-bg); padding: 30px; border-radius: var(--m-radius); box-shadow: var(--m-shadow); border: 1px solid var(--m-border);">
    <h2 style="margin-top:0; text-align:center;">⚽ Accedi al Mercato</h2>
    <p style="color:var(--m-text-muted); font-size:0.9rem; text-align:center;">Usa la stessa password con cui invii la formazione</p>
    
    <div id="loginAlert" style="display:none; padding:10px; border-radius:8px; margin-bottom:14px; font-size:0.85rem;"></div>

    <form id="teamLoginForm">
      <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:6px;">Seleziona Fantasquadra</label>
      <select id="loginSquadraSelect" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); margin-bottom:14px;">
        <option value="">-- Scegli la tua squadra --</option>
        <?php foreach ($squadre as $sq): ?>
        <option value="<?= $sq['id'] ?>"><?= htmlspecialchars($sq['nome']) ?> (<?= htmlspecialchars($sq['presidente']) ?>)</option>
        <?php endforeach; ?>
      </select>

      <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:6px;">Password</label>
      <input type="password" id="loginPasswordInput" required placeholder="Password invio formazione" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--m-border); background:var(--m-body-bg); color:var(--m-text); margin-bottom:18px; box-sizing:border-box;">

      <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; font-size:1rem;">Entra nel Mercato</button>
    </form>
    
    <script>
    function applyFavoriteTeamSelection() {
      const select = document.getElementById('loginSquadraSelect');
      if (!select) return;

      let favId = null;
      try {
        const parentMgr = (window.parent && window.parent !== window && window.parent.fcmHomeConfigManager)
          ? window.parent.fcmHomeConfigManager
          : ((window.top && window.top.fcmHomeConfigManager) ? window.top.fcmHomeConfigManager : null);
        if (parentMgr && typeof parentMgr.getFavoriteTeamId === 'function') {
          const id = parentMgr.getFavoriteTeamId();
          if (id !== null && id !== undefined && id !== '') {
            favId = id;
          }
        }
      } catch (e) {}

      if (!favId) {
        try {
          const rawCfg = localStorage.getItem('pn_home_layout');
          if (rawCfg) {
            const parsed = JSON.parse(rawCfg);
            if (parsed) {
              if (parsed.favoriteTeamId !== undefined && parsed.favoriteTeamId !== null && parsed.favoriteTeamId !== '') {
                favId = parsed.favoriteTeamId;
              } else if (parsed.defaultSettings && parsed.defaultSettings.favoriteTeamId !== undefined && parsed.defaultSettings.favoriteTeamId !== null) {
                favId = parsed.defaultSettings.favoriteTeamId;
              }
            }
          }
        } catch (e) {}
      }

      if (!favId) {
        try {
          const rawFav = localStorage.getItem('pn_favorite_team') || localStorage.getItem('fcm_favorite_team');
          if (rawFav) favId = rawFav;
        } catch (e) {}
      }

      if (!favId) return;

      const targetOpt = Array.from(select.options).find(opt => {
        if (!opt.value) return false;
        if (String(opt.value) === String(favId)) return true;
        if (isNaN(Number(favId)) && opt.textContent.toLowerCase().includes(String(favId).toLowerCase())) return true;
        return false;
      });

      if (targetOpt) {
        if (!targetOpt.textContent.startsWith('⭐')) {
          targetOpt.textContent = '⭐ ' + targetOpt.textContent;
        }
        targetOpt.selected = true;
        select.value = targetOpt.value;
      }
    }
    applyFavoriteTeamSelection();
    window.addEventListener('DOMContentLoaded', applyFavoriteTeamSelection);
    window.addEventListener('load', applyFavoriteTeamSelection);
    </script>
    
    <div style="margin-top:16px; text-align:center;">
      <a href="admin.php" style="color:var(--m-text-muted); font-size:0.8rem; text-decoration:none;">Sei un amministratore? Accedi al pannello</a>
    </div>
  </div>

  <?php else: ?>
  <!-- Session Hero Card -->
  <div class="session-hero">
    <div class="session-info">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
        <span class="session-status-badge">
          <?= ($sessione && $sessione['is_open']) ? '🟢 Sessione Aperta' : '⚪ Mercato Chiuso' ?>
        </span>
        <span style="font-size:0.85rem; opacity:0.9;">Squadra: <strong><?= htmlspecialchars($_SESSION['mercato_team_name']) ?></strong></span>
      </div>
      <h1><?= $sessione ? htmlspecialchars($sessione['nome']) : 'Nessuna sessione attiva' ?></h1>
      <small style="opacity:0.85;">
        <?php if ($sessione): ?>
          Chiusura: <?= date('d/m/Y H:i', strtotime($sessione['data_chiusura'])) ?>
        <?php else: ?>
          In attesa che l'amministratore apra una nuova finestra di mercato
        <?php endif; ?>
      </small>
    </div>

    <?php if ($sessione && $sessione['is_open']): ?>
    <div class="countdown-box">
      <div class="countdown-val" id="countdownTimer">--:--:--</div>
      <div class="countdown-lbl">Tempo Rimasto</div>
    </div>
    <?php endif; ?>

    <div>
      <button onclick="handleLogout()" class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:#fff; border:none;">Esci</button>
    </div>
  </div>

  <!-- Statistiche Finanziarie Squadra -->
  <?php if ($financials): ?>
  <div class="stats-grid">
    <div class="stat-card">
      <small>Budget Totale</small>
      <div class="val"><?= $financials['budget_totale'] ?> <span style="font-size:0.9rem; font-weight:normal;">cr</span></div>
      <?php if (!empty($financials['crediti_extra'])): ?>
      <small style="color:var(--m-text-muted); font-size:0.75rem; display:block; margin-top:2px;">
        (FCM: <?= $financials['crediti_base'] ?> | Extra: <?= $financials['crediti_extra'] > 0 ? '+'.$financials['crediti_extra'] : $financials['crediti_extra'] ?>)
      </small>
      <?php endif; ?>
    </div>
    <div class="stat-card">
      <small>Impegnati in Buste</small>
      <div class="val" style="color:var(--m-warning);"><?= $financials['crediti_impegnati'] ?> <span style="font-size:0.9rem; font-weight:normal;">cr</span></div>
    </div>
    <div class="stat-card">
      <small>Disponibili Subito</small>
      <div class="val" style="color:var(--m-success);"><?= $financials['budget_disponibile'] ?> <span style="font-size:0.9rem; font-weight:normal;">cr</span></div>
    </div>
    <div class="stat-card">
      <small>Slot Mancanti Rosa</small>
      <div class="val" style="color:var(--m-primary);"><?= $financials['mancanti_totale'] ?> <span style="font-size:0.9rem; font-weight:normal;">gioc.</span></div>
    </div>
  </div>
  <?php endif; ?>

  <!-- Buste Attive Inviate -->
  <?php if ($financials && count($financials['buste_attive']) > 0): ?>
  <div class="buste-box">
    <h3 style="margin-top:0;">📨 Le Tue Buste Segrete Inviate (<?= count($financials['buste_attive']) ?>)</h3>
    <table class="table-custom buste-table">
      <thead>
        <tr>
          <th>Ruolo</th>
          <th>Calciatore</th>
          <th>Offerta</th>
          <th>Eventuale Taglio</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($financials['buste_attive'] as $b): ?>
        <tr>
          <td data-label="Ruolo"><span class="badge-role badge-<?= $ruoliNomi[$b['ruolo']] ?>"><?= $ruoliNomi[$b['ruolo']] ?></span></td>
          <td data-label="Calciatore">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <?= get_shirt_img_html($b['club'] ?? '', 22) ?>
              <strong><?= htmlspecialchars($b['nome_giocatore']) ?></strong>
            </div>
          </td>
          <td data-label="Offerta"><span style="font-weight:700; color:var(--m-success);"><?= $b['crediti_in_chiaro'] ?> crediti</span></td>
          <td data-label="Eventuale Taglio">
            <?php if (!empty($b['nome_giocatore_taglio'])): ?>
              <div style="display:inline-flex; align-items:center; gap:6px;">
                <?= get_shirt_img_html($b['club_taglio'] ?? '', 18) ?>
                <span><?= htmlspecialchars($b['nome_giocatore_taglio']) ?></span>
              </div>
            <?php else: ?>
              <span style="color:var(--m-text-muted);">Nessun taglio</span>
            <?php endif; ?>
          </td>
          <td data-label="Azioni">
            <?php if ($sessione && $sessione['is_open']): ?>
            <button onclick="handleDeleteBid(<?= $b['id'] ?>)" class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;">Annulla</button>
            <?php else: ?>
            <span style="font-size:0.8rem; color:var(--m-text-muted);">Bloccata</span>
            <?php endif; ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>

  <!-- Chiamate e Tagli delle Altre Squadre (se abilitato dall'Amministratore) -->
  <?php if (!empty($settings['mostra_chiamate_altri']) && $sessione): ?>
  <div class="buste-box" style="margin-bottom:30px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
      <h3 style="margin:0;">👥 Chiamate e Tagli delle Altre Squadre (<?= count($chiamateAltri) ?>)</h3>
      <span style="font-size:0.8rem; color:var(--m-text-muted); display:inline-flex; align-items:center; gap:4px;">
        🔒 Importi offerti rigorosamente segreti
      </span>
    </div>

    <?php if (empty($chiamateAltri)): ?>
      <p style="color:var(--m-text-muted); font-size:0.9rem; margin:0; padding:10px 0;">
        Nessun'altra squadra ha ancora effettuato chiamate o tagli in questa sessione.
      </p>
    <?php else: ?>
      <table class="table-custom buste-table">
        <thead>
          <tr>
            <th>Squadra</th>
            <th>Ruolo</th>
            <th>Calciatore Chiamato</th>
            <th>Eventuale Taglio</th>
            <th>Data Chiamata</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($chiamateAltri as $c): ?>
          <tr>
            <td data-label="Squadra"><strong><?= htmlspecialchars($c['nome_squadra']) ?></strong></td>
            <td data-label="Ruolo"><span class="badge-role badge-<?= $c['ruolo_label'] ?>"><?= $c['ruolo_label'] ?></span></td>
            <td data-label="Calciatore">
              <div style="display:inline-flex; align-items:center; gap:6px;">
                <?= get_shirt_img_html($c['club'] ?? '', 22) ?>
                <strong><?= htmlspecialchars($c['nome_giocatore']) ?></strong>
              </div>
            </td>
            <td data-label="Eventuale Taglio">
              <?php if (!empty($c['nome_giocatore_taglio'])): ?>
                <div style="display:inline-flex; align-items:center; gap:6px;">
                  <?= get_shirt_img_html($c['club_taglio'] ?? '', 18) ?>
                  <span><?= htmlspecialchars($c['nome_giocatore_taglio']) ?></span>
                </div>
              <?php else: ?>
                <span style="color:var(--m-text-muted);">Nessun taglio</span>
              <?php endif; ?>
            </td>
            <td data-label="Data Chiamata" style="color:var(--m-text-muted); font-size:0.85rem;">
              <?= date('d/m H:i', strtotime($c['timest'])) ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
  <?php endif; ?>

  <?php if ($sessione && $sessione['is_open']): ?>
  <!-- Controlli Filtro e Ricerca Calciatori Svincolati -->
  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
    <h3 style="margin:0;">📋 Calciatori Svincolati Disponibili <span id="playersCountBadge" style="font-size:0.85rem; color:var(--m-text-muted); font-weight:normal;"></span></h3>
    <div class="roles-nav">
      <button type="button" class="role-btn role-btn-all active" onclick="filterRole('all')">
        <span class="role-text-full">Tutti</span>
        <span class="role-text-short">TUTTI</span>
      </button>
      <button type="button" class="role-btn role-btn-P" onclick="filterRole(1)">
        <span class="role-text-full">Portieri</span>
        <span class="role-text-short">P</span>
      </button>
      <button type="button" class="role-btn role-btn-D" onclick="filterRole(2)">
        <span class="role-text-full">Difensori</span>
        <span class="role-text-short">D</span>
      </button>
      <button type="button" class="role-btn role-btn-C" onclick="filterRole(3)">
        <span class="role-text-full">Centrocampisti</span>
        <span class="role-text-short">C</span>
      </button>
      <button type="button" class="role-btn role-btn-A" onclick="filterRole(4)">
        <span class="role-text-full">Attaccanti</span>
        <span class="role-text-short">A</span>
      </button>
    </div>
  </div>

  <div class="search-bar-wrap">
    <input type="text" id="playerSearchInput" class="search-input" placeholder="🔍 Cerca calciatore per nome o squadra di Serie A..." oninput="handleSearch()">
  </div>

  <!-- Paginazione Giocatori Disponibili - SUPERIORE -->
  <div id="playersPaginationTop" class="pagination-bar pagination-top" style="display:none;">
    <div class="pagination-info" id="paginationInfoTop"></div>
    <div class="pagination-buttons">
      <button type="button" class="btn btn-secondary btn-page" id="btnPageFirstTop" onclick="goToPage(1)" title="Prima pagina">
        <span class="page-symbol">⏮</span><span class="page-btn-text"> Inizio</span>
      </button>
      <button type="button" class="btn btn-secondary btn-page" id="btnPagePrevTop" onclick="goToPage(CURRENT_PAGE - 1)" title="Pagina precedente">
        <span class="page-symbol">◀</span><span class="page-btn-text"> Indietro</span>
      </button>
      <span class="pagination-current" id="paginationCurrentTop"></span>
      <button type="button" class="btn btn-secondary btn-page" id="btnPageNextTop" onclick="goToPage(CURRENT_PAGE + 1)" title="Pagina successiva">
        <span class="page-btn-text">Avanti </span><span class="page-symbol">▶</span>
      </button>
      <button type="button" class="btn btn-secondary btn-page" id="btnPageLastTop" onclick="goToPage('last')" title="Ultima pagina">
        <span class="page-btn-text">Fine </span><span class="page-symbol">⏭</span>
      </button>
    </div>
  </div>

  <!-- Griglia Calciatori Liberi -->
  <div class="players-list" id="playersContainer">
    <!-- Popolato dinamicamente via JS -->
  </div>

  <!-- Paginazione Giocatori Disponibili - INFERIORE -->
  <div id="playersPaginationBottom" class="pagination-bar pagination-bottom" style="display:none;">
    <div class="pagination-info" id="paginationInfoBottom"></div>
    <div class="pagination-buttons">
      <button type="button" class="btn btn-secondary btn-page" id="btnPageFirstBottom" onclick="goToPage(1)" title="Prima pagina">
        <span class="page-symbol">⏮</span><span class="page-btn-text"> Inizio</span>
      </button>
      <button type="button" class="btn btn-secondary btn-page" id="btnPagePrevBottom" onclick="goToPage(CURRENT_PAGE - 1)" title="Pagina precedente">
        <span class="page-symbol">◀</span><span class="page-btn-text"> Indietro</span>
      </button>
      <span class="pagination-current" id="paginationCurrentBottom"></span>
      <button type="button" class="btn btn-secondary btn-page" id="btnPageNextBottom" onclick="goToPage(CURRENT_PAGE + 1)" title="Pagina successiva">
        <span class="page-btn-text">Avanti </span><span class="page-symbol">▶</span>
      </button>
      <button type="button" class="btn btn-secondary btn-page" id="btnPageLastBottom" onclick="goToPage('last')" title="Ultima pagina">
        <span class="page-btn-text">Fine </span><span class="page-symbol">⏭</span>
      </button>
    </div>
  </div>
  <?php endif; ?>

  <?php endif; ?>

</div>

<!-- Native Dialog Modal per Offerta (Modern Web Guidance compliant) -->
<dialog id="bidModal" closedby="any" aria-labelledby="bidModalTitle">
  <div class="dialog-header">
    <h2 id="bidModalTitle">Invia Busta Segreta</h2>
    <button type="button" onclick="document.getElementById('bidModal').close()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--m-text-muted);">&times;</button>
  </div>

  <form id="bidForm" class="dialog-form" onsubmit="handleBidSubmit(event)">
    <input type="hidden" id="modalCodiceG">
    <input type="hidden" id="modalRuoloG">

    <div style="background:var(--m-body-bg); padding:12px 14px; border-radius:10px; margin-bottom:14px; display:flex; align-items:center; gap:12px;">
      <img id="modalShirtImg" src="" alt="" style="width:36px; height:36px; object-fit:contain; flex-shrink:0; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));" onerror="handleShirtError(this)">
      <div style="min-width:0; flex:1;">
        <div style="font-weight:700; font-size:1.05rem;" id="modalNomeG"></div>
        <div style="color:var(--m-text-muted); font-size:0.85rem;" id="modalMetaG"></div>
      </div>
    </div>

    <!-- Avviso Calciatore già chiamato da altri (se visibile) -->
    <div id="modalChiamateInfo" class="alert-mercato alert-warning" style="display:none; font-size:0.82rem; padding:8px 12px; margin-bottom:12px;"></div>

    <label for="modalOffertaInput">La Tua Offerta Segreta (in crediti)</label>
    <input type="number" id="modalOffertaInput" min="1" required placeholder="Inserisci crediti...">

    <div class="quick-steppers">
      <button type="button" onclick="stepBid(1)">+1</button>
      <button type="button" onclick="stepBid(5)">+5</button>
      <button type="button" onclick="stepBid(10)">+10</button>
      <button type="button" onclick="stepBid('max')">MAX</button>
    </div>

    <div id="modalMaxHelp" style="font-size:0.8rem; color:var(--m-text-muted); margin-bottom:14px;"></div>

    <!-- Blocco Taglio Obbligatorio o Facoltativo -->
    <div id="taglioBlock" style="margin-bottom:14px;">
      <label for="modalTaglioSelect" id="taglioLabel">Giocatore da Tagliare</label>
      <select id="modalTaglioSelect" onchange="updateMaxOfferLabel()">
        <option value="">-- Nessun taglio (occupa slot vuoto) --</option>
      </select>
      <small id="taglioHelp" style="display:block; font-size:0.75rem; color:var(--m-text-muted); margin-top:2px;"></small>
    </div>

    <div style="display:flex; gap:10px; margin-top:16px;">
      <button type="submit" class="btn btn-primary" style="flex:2; padding:12px;">Invia Busta Cifrata</button>
      <button type="button" onclick="document.getElementById('bidModal').close()" class="btn btn-secondary" style="flex:1;">Chiudi</button>
    </div>
  </form>
</dialog>

<script>
// Dati passati dal server
const SESSION_DATA = <?= json_encode($sessione) ?>;
const FINANCIALS = <?= json_encode($financials) ?>;
const SETTINGS = <?= json_encode($settings) ?>;
let CHIAMATE_ALTRI = <?= json_encode($chiamateAltri) ?>;
let CURRENT_PLAYERS = [];
let ACTIVE_ROLE_FILTER = 'all';
const PAGE_SIZE = 30;
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1;
let MERCATO_CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

function getCsrfHeaders() {
  return MERCATO_CSRF_TOKEN ? { 'X-CSRF-Token': MERCATO_CSRF_TOKEN } : {};
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getShirtImgUrl(club) {
  if (!club) return '../img/sq/undefined.svg';
  const cleanTeam = club.trim();
  return `../img/sq/${encodeURIComponent(cleanTeam)}.png`;
}

function handleShirtError(img) {
  if (!img) return;
  const team = img.dataset.team || '';
  if (!img.dataset.fallback && team) {
    img.dataset.fallback = '1';
    img.src = `../img/sq/${encodeURIComponent(team)}.png`;
  } else {
    img.src = '../img/sq/undefined.svg';
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

    const modalH = modal.offsetHeight || 380;
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

// Fallback light-dismiss per browser senza supporto nativo closedby (da modern-web-guidance)
const bidModal = document.getElementById('bidModal');
if (bidModal) {
  bidModal.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    bidModal.style.position = '';
    bidModal.style.top = '';
    bidModal.style.left = '';
    bidModal.style.transform = '';
    bidModal.style.margin = '';
    bidModal.style.maxHeight = '';
    notifyParentResize();
  });
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    bidModal.addEventListener('click', (event) => {
      if (event.target !== bidModal) return;
      const rect = bidModal.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width
      );
      if (!isInside) bidModal.close();
    });
  }
}

// Inizializzazione Countdown
if (SESSION_DATA && SESSION_DATA.is_open && SESSION_DATA.seconds_to_close > 0) {
  let secondsLeft = SESSION_DATA.seconds_to_close;
  const timerEl = document.getElementById('countdownTimer');
  setInterval(() => {
    if (secondsLeft <= 0) {
      if (timerEl) timerEl.innerText = "SCADUTO";
      location.reload();
      return;
    }
    secondsLeft--;
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    if (timerEl) {
      timerEl.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// Caricamento calciatori liberi
if (FINANCIALS) {
  fetch('api.php?action=get_state')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        if (data.csrf_token) MERCATO_CSRF_TOKEN = data.csrf_token;
        if (data.liberi) CURRENT_PLAYERS = data.liberi;
        if (data.chiamate_altri) CHIAMATE_ALTRI = data.chiamate_altri;
        renderPlayers();
      }
    });
}

function renderPlayers() {
  const container = document.getElementById('playersContainer');
  const pagTop = document.getElementById('playersPaginationTop');
  const pagBottom = document.getElementById('playersPaginationBottom');
  if (!container) return;
  const q = (document.getElementById('playerSearchInput')?.value || '').toLowerCase().trim();
  const roleMap = {1: 'P', 2: 'D', 3: 'C', 4: 'A'};

  const filtered = CURRENT_PLAYERS.filter(p => {
    if (ACTIVE_ROLE_FILTER !== 'all' && p.ruolo != ACTIVE_ROLE_FILTER) return false;
    if (q) {
      return p.nome.toLowerCase().includes(q) || p.club.toLowerCase().includes(q);
    }
    return true;
  });

  const countBadge = document.getElementById('playersCountBadge');
  if (countBadge) countBadge.innerText = `(${filtered.length})`;

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--m-text-muted);">Nessun calciatore trovato.</div>`;
    if (pagTop) pagTop.style.display = 'none';
    if (pagBottom) pagBottom.style.display = 'none';
    notifyParentResize();
    return;
  }

  TOTAL_PAGES = Math.ceil(filtered.length / PAGE_SIZE);
  if (CURRENT_PAGE > TOTAL_PAGES) CURRENT_PAGE = TOTAL_PAGES;
  if (CURRENT_PAGE < 1) CURRENT_PAGE = 1;

  let pagePlayers = filtered;
  if (filtered.length > PAGE_SIZE) {
    const startIndex = (CURRENT_PAGE - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filtered.length);
    pagePlayers = filtered.slice(startIndex, endIndex);

    syncPaginationBar('Top', startIndex, endIndex, filtered.length);
    syncPaginationBar('Bottom', startIndex, endIndex, filtered.length);
  } else {
    if (pagTop) pagTop.style.display = 'none';
    if (pagBottom) pagBottom.style.display = 'none';
  }

  container.innerHTML = pagePlayers.map(p => {
    let chiamateBadge = '';
    if (SETTINGS && SETTINGS.mostra_chiamate_altri && Array.isArray(CHIAMATE_ALTRI)) {
      const calls = CHIAMATE_ALTRI.filter(c => c.codice_giocatore == p.id);
      if (calls.length > 0) {
        const teamNames = calls.map(c => c.nome_squadra).join(', ');
        chiamateBadge = `<span class="badge-chiamate" title="Chiamato da: ${escapeHtml(teamNames)}">🔥 ${calls.length} ${calls.length === 1 ? 'chiamata' : 'chiamate'}</span>`;
      }
    }
    const safeClub = escapeHtml(p.club);
    const safeNome = escapeHtml(p.nome);
    const safeRole = escapeHtml(roleMap[p.ruolo] || '?');
    const safeCosto = parseInt(p.costo, 10) || 0;
    const safeId = parseInt(p.id, 10) || 0;
    return `
    <div class="player-card">
      <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
        <img src="${escapeHtml(getShirtImgUrl(p.club))}" alt="${safeClub}" data-team="${safeClub}" class="player-shirt-img" onerror="handleShirtError(this)">
        <div class="player-meta">
          <h3><span class="badge-role badge-${safeRole}">${safeRole}</span> ${safeNome}${chiamateBadge}</h3>
          <small>${safeClub} &bull; Quotazione: <strong>${safeCosto} cr</strong></small>
        </div>
      </div>
      <button class="btn btn-primary" style="flex-shrink:0; margin-left:8px;" onclick="openOfferModal(${safeId})">Offri</button>
    </div>
  `;
  }).join('');

  notifyParentResize();
}

function syncPaginationBar(suffix, startIndex, endIndex, totalCount) {
  const bar = document.getElementById('playersPagination' + suffix);
  if (!bar) return;
  bar.style.display = 'flex';

  const infoEl = document.getElementById('paginationInfo' + suffix);
  const curEl = document.getElementById('paginationCurrent' + suffix);
  const btnFirst = document.getElementById('btnPageFirst' + suffix);
  const btnPrev = document.getElementById('btnPagePrev' + suffix);
  const btnNext = document.getElementById('btnPageNext' + suffix);
  const btnLast = document.getElementById('btnPageLast' + suffix);

  if (infoEl) {
    infoEl.innerText = `Mostrati ${startIndex + 1}-${endIndex} di ${totalCount} calciatori`;
  }
  if (curEl) {
    curEl.innerText = `Pag. ${CURRENT_PAGE} di ${TOTAL_PAGES}`;
  }

  if (btnFirst) btnFirst.disabled = (CURRENT_PAGE <= 1);
  if (btnPrev) btnPrev.disabled = (CURRENT_PAGE <= 1);
  if (btnNext) btnNext.disabled = (CURRENT_PAGE >= TOTAL_PAGES);
  if (btnLast) btnLast.disabled = (CURRENT_PAGE >= TOTAL_PAGES);
}

function goToPage(target) {
  if (target === 'last') {
    CURRENT_PAGE = TOTAL_PAGES;
  } else {
    const p = parseInt(target, 10);
    if (!isNaN(p)) {
      CURRENT_PAGE = Math.max(1, Math.min(p, TOTAL_PAGES));
    }
  }
  renderPlayers();

  const anchor = document.getElementById('playersPaginationTop') || document.querySelector('.search-bar-wrap');
  if (anchor) {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function filterRole(role) {
  ACTIVE_ROLE_FILTER = role;
  CURRENT_PAGE = 1;
  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
  const selector = role === 'all' ? '.role-btn-all' : (role == 1 ? '.role-btn-P' : (role == 2 ? '.role-btn-D' : (role == 3 ? '.role-btn-C' : '.role-btn-A')));
  const targetBtn = document.querySelector(selector);
  if (targetBtn) targetBtn.classList.add('active');
  renderPlayers();
}

function handleSearch() {
  CURRENT_PAGE = 1;
  renderPlayers();
}

// Gestione Modal Offerta
function openOfferModal(id) {
  const p = CURRENT_PLAYERS.find(x => x.id === id);
  if (!p) return;
  const nome = p.nome;
  const ruolo = p.ruolo;
  const club = p.club;

  document.body.classList.add('modal-open');
  document.getElementById('modalCodiceG').value = id;
  document.getElementById('modalRuoloG').value = ruolo;
  document.getElementById('modalNomeG').innerText = nome;
  document.getElementById('modalMetaG').innerText = `${club} - Ruolo: ${ruolo == 1 ? 'Portiere' : ruolo == 2 ? 'Difensore' : ruolo == 3 ? 'Centrocampista' : 'Attaccante'}`;

  const shirtImg = document.getElementById('modalShirtImg');
  if (shirtImg) {
    shirtImg.dataset.team = club;
    shirtImg.dataset.fallback = '';
    shirtImg.src = getShirtImgUrl(club);
    shirtImg.alt = club;
  }

  const selectTaglio = document.getElementById('modalTaglioSelect');
  selectTaglio.innerHTML = '<option value="">-- Nessun taglio (occupa slot vuoto) --</option>';

  const attualiRuolo = FINANCIALS.conteggi_ruolo[ruolo] || 0;
  const limiteRuolo = FINANCIALS.limiti_ruolo[ruolo] || 8;
  const isRepartoPieno = attualiRuolo >= limiteRuolo;

  // Popola calciatori tagliabili dello stesso ruolo
  FINANCIALS.rosa_attiva.filter(g => g.ruolo == ruolo).forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.innerText = `${g.nome} (${g.club}) - Costo: ${g.costo_acq} cr`;
    selectTaglio.appendChild(opt);
  });

  const taglioBlock = document.getElementById('taglioBlock');
  const taglioHelp = document.getElementById('taglioHelp');
  selectTaglio.onchange = () => {
    updateTaglioPreview();
    updateMaxOfferLabel();
  };

  updateTaglioPreview();
  updateMaxOfferLabel();

  // Informazione chiamate concorrenti senza svelare importo
  const infoCallsEl = document.getElementById('modalChiamateInfo');
  if (infoCallsEl) {
    if (SETTINGS && SETTINGS.mostra_chiamate_altri && Array.isArray(CHIAMATE_ALTRI)) {
      const calls = CHIAMATE_ALTRI.filter(c => c.codice_giocatore == id);
      if (calls.length > 0) {
        const teamNames = calls.map(c => c.nome_squadra).join(', ');
        infoCallsEl.style.display = 'block';
        infoCallsEl.innerHTML = `⚠️ <strong>Attenzione:</strong> Questo calciatore è già stato chiamato da: <em>${escapeHtml(teamNames)}</em> (importi segreti).`;
      } else {
        infoCallsEl.style.display = 'none';
        infoCallsEl.innerHTML = '';
      }
    } else {
      infoCallsEl.style.display = 'none';
      infoCallsEl.innerHTML = '';
    }
  }

  document.getElementById('modalOffertaInput').value = '';
  const modal = document.getElementById('bidModal');
  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
  centerModalInView(modal);
  requestAnimationFrame(() => centerModalInView(modal));
}

function updateTaglioPreview() {
  const selectTaglio = document.getElementById('modalTaglioSelect');
  const taglioHelp = document.getElementById('taglioHelp');
  if (!selectTaglio || !taglioHelp) return;

  const val = selectTaglio.value;
  const ruolo = document.getElementById('modalRuoloG').value;
  const attualiRuolo = FINANCIALS.conteggi_ruolo[ruolo] || 0;
  const limiteRuolo = FINANCIALS.limiti_ruolo[ruolo] || 8;
  const isRepartoPieno = attualiRuolo >= limiteRuolo;

  if (!val) {
    if (isRepartoPieno) {
      selectTaglio.required = true;
      taglioHelp.innerText = `⚠️ Reparto saturo (${attualiRuolo}/${limiteRuolo}). Devi obbligatoriamente selezionare chi tagliare.`;
      taglioHelp.style.color = "var(--m-danger)";
    } else {
      selectTaglio.required = false;
      taglioHelp.innerText = `Facoltativo: puoi tagliare un calciatore o acquistare a slot vuoto.`;
      taglioHelp.style.color = "var(--m-text-muted)";
    }
    return;
  }

  fetch(`api.php?action=calcola_taglio&id_taglio=${val}`)
    .then(r => r.json())
    .then(res => {
      if (res.success && res.data) {
        const d = res.data;
        taglioHelp.innerHTML = `♻️ Categoria: <strong>${escapeHtml(d.label)}</strong> (Recupero ${parseInt(d.percentuale, 10) || 0}%): recuperi <strong style="color:var(--m-success);">+${parseInt(d.recupero, 10) || 0} crediti</strong>`;
        taglioHelp.style.color = "var(--m-text)";
      }
    })
    .catch(() => { });
}

function updateMaxOfferLabel() {
  const hasTaglio = !!document.getElementById('modalTaglioSelect').value;
  const mancanti = FINANCIALS.mancanti_totale;
  const slotRimasti = hasTaglio ? mancanti : Math.max(0, mancanti - 1);
  const currentCodiceG = parseInt(document.getElementById('modalCodiceG')?.value || '0', 10);
  let ownExistingBidCredits = 0;
  if (FINANCIALS && Array.isArray(FINANCIALS.buste_attive)) {
    const existing = FINANCIALS.buste_attive.find(b => parseInt(b.codice_giocatore, 10) === currentCodiceG);
    if (existing) ownExistingBidCredits = parseInt(existing.crediti_in_chiaro, 10) || 0;
  }
  const maxConsentito = Math.max(1, (FINANCIALS.budget_disponibile + ownExistingBidCredits) - slotRimasti);

  document.getElementById('modalOffertaInput').max = maxConsentito;
  document.getElementById('modalMaxHelp').innerText = `Tetto massimo consentito con riserva: ${maxConsentito} crediti (devi conservare 1 credito per ciascuno dei ${slotRimasti} slot vuoti rimasti).`;
}

function stepBid(amount) {
  const input = document.getElementById('modalOffertaInput');
  const max = parseInt(input.max, 10) || FINANCIALS.budget_disponibile;
  if (amount === 'max') {
    input.value = max;
  } else {
    input.value = Math.min(max, (parseInt(input.value, 10) || 0) + amount);
  }
}

// Submit Offerta AJAX
function handleBidSubmit(e) {
  e.preventDefault();
  const codiceG = document.getElementById('modalCodiceG').value;
  const offerta = document.getElementById('modalOffertaInput').value;
  const idTaglio = document.getElementById('modalTaglioSelect').value;

  const fd = new FormData();
  fd.append('action', 'place_bid');
  fd.append('codice_giocatore', codiceG);
  fd.append('offerta', offerta);
  if (idTaglio) fd.append('id_taglio', idTaglio);

  fetch('api.php', { method: 'POST', headers: getCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        alert(data.msg);
        location.reload();
      } else {
        alert("Errore: " + data.error);
      }
    })
    .catch(() => alert("Errore di connessione"));
}

// Cancellazione Busta
function handleDeleteBid(id) {
  if (!confirm("Sei sicuro di voler annullare questa offerta?")) return;
  const fd = new FormData();
  fd.append('action', 'delete_bid');
  fd.append('id_offerta', id);

  fetch('api.php', { method: 'POST', headers: getCsrfHeaders(), body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.success) location.reload();
      else alert(data.error);
    });
}

// Login Squadra
const teamLoginForm = document.getElementById('teamLoginForm');
if (teamLoginForm) {
  teamLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const idSq = document.getElementById('loginSquadraSelect').value;
    const pwd = document.getElementById('loginPasswordInput').value;
    const alertBox = document.getElementById('loginAlert');

    const fd = new FormData();
    fd.append('action', 'login_team');
    fd.append('id_squadra', idSq);
    fd.append('password', pwd);

    fetch('api.php', { method: 'POST', headers: getCsrfHeaders(), body: fd })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          location.reload();
        } else {
          alertBox.style.display = 'block';
          alertBox.style.background = '#fee2e2';
          alertBox.style.color = '#b91c1c';
          alertBox.innerText = res.error;
        }
      });
  });
}

function handleLogout() {
  const fd = new FormData();
  fd.append('action', 'logout');
  fetch('api.php', { method: 'POST', headers: getCsrfHeaders(), body: fd }).then(() => location.reload());
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
