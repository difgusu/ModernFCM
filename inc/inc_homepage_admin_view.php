<?php
/**
 * View & UI per il tab Personalizzazione Home (Gestione Widget di Lega)
 * File: inc_homepage_admin_view.php
 * Inclusa all'interno di impostazioni.php
 */
if (!defined('PN_ADMIN_HOME_VIEW') && !isset($isAdminLogged)) {
    die('Accesso diretto non consentito.');
}
?>

<style>
/* ==========================================================================
   STILI DEDICATI PER IL TAB PERSONALIZZAZIONE HOMEPAGE & WIDGET
   ========================================================================== */
.admin-home-item {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    padding: 0 !important;
    background: var(--bg-surface, #131d35) !important;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08)) !important;
    border-radius: var(--radius-lg, 12px) !important;
    margin-bottom: 16px !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    overflow: hidden;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.admin-home-item:hover {
    border-color: rgba(59, 130, 246, 0.35) !important;
}

.admin-home-item.is-disabled {
    opacity: 0.65;
}

.admin-home-item.is-disabled .admin-home-item-header {
    background: rgba(15, 23, 42, 0.6);
}

.admin-home-item.is-disabled .admin-home-item-preview {
    opacity: 0.55;
    filter: grayscale(0.5);
}

.admin-home-item.is-dragging {
    opacity: 0.45;
    transform: scale(0.98);
}

.admin-home-item.drag-over {
    border: 2px dashed var(--accent-primary, #3b82f6) !important;
}

.admin-home-item-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-surface-elevated, #1e293b);
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    user-select: none;
}

.admin-home-item.is-collapsed .admin-home-item-header {
    border-bottom: none;
}

.admin-preview-toggle-btn {
    background: transparent;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
    color: var(--text-secondary, #94a3b8);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
}

.admin-preview-toggle-btn:hover {
    background: var(--bg-surface-elevated);
    color: var(--text-primary);
    border-color: var(--accent-primary, #3b82f6);
}

.admin-home-item-preview {
    padding: 12px;
    background: var(--bg-surface, #131d35);
    position: relative;
}

.admin-home-item-preview .card {
    margin-bottom: 0 !important;
    box-shadow: none !important;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08)) !important;
}

.admin-home-item-preview a {
    cursor: default !important;
}

.admin-home-item.is-collapsed .admin-home-item-preview {
    display: none !important;
}

/* Light Theme Overrides per Admin Home */
[data-theme="light"] .admin-home-item {
    background: #ffffff !important;
    border-color: #cbd5e1 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

[data-theme="light"] .admin-home-item-header {
    background: #f8fafc;
    border-bottom-color: #e2e8f0;
}

[data-theme="light"] .admin-home-item-preview {
    background: #ffffff;
}

[data-theme="light"] .admin-home-item-preview .card {
    background: #ffffff !important;
    border-color: #e2e8f0 !important;
}

[data-theme="light"] .admin-preview-toggle-btn {
    border-color: #cbd5e1;
    color: #475569;
}

[data-theme="light"] .admin-preview-toggle-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
}

[data-theme="light"] .admin-summary-card {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

[data-theme="light"] .admin-live-preview-box {
    background: #f8fafc !important;
    border-color: #cbd5e1 !important;
}

/* Modale Anteprima Widget */
.admin-preview-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    animation: fadeInModal 0.2s ease-out;
}

.admin-preview-modal-sheet {
    background: var(--bg-surface, #131d35);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-lg, 16px);
    max-width: 540px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
}

.admin-preview-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
}

.admin-preview-modal-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary, #f8fafc);
    display: flex;
    align-items: center;
    gap: 8px;
}

.admin-preview-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #94a3b8);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
}
.admin-preview-close-btn:hover {
    color: var(--text-primary, #f8fafc);
}

.admin-preview-modal-body {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
}

.admin-preview-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
    background: var(--bg-surface-elevated, #1e293b);
}

@keyframes fadeInModal {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
}

/* Card Sponsor e Preferiti Admin */
.admin-sponsor-card {
    background: var(--bg-surface, #131d35);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 10px);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.admin-sponsor-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    padding-bottom: 8px;
}
[data-theme="light"] .admin-sponsor-card {
    background: #ffffff;
    border-color: #cbd5e1;
}
[data-theme="light"] .admin-sponsor-card-header {
    border-bottom-color: #e2e8f0;
}
</style>

<!-- ACTION BAR SUPERIORE -->
<div class="calc-actions-bar" style="margin-bottom: 22px;">
    <div class="badge-wrap">
        <span class="badge-status-changes no-changes badgeHomeChanges" id="adminHomeBadgeChanges">
            <span>⚪</span> Nessuna modifica non salvata
        </span>
    </div>
    <div class="calc-actions-buttons">
        <button type="button" class="calc-btn-action calc-btn-reset btnRestoreDefaultHome" id="btnRestoreDefaultHome" onclick="fcmHomepageAdmin.restoreDefaultConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            <span>Ripristina Default</span>
        </button>
        <button type="button" class="calc-btn-action calc-btn-cancel btnCancelHomeChanges" id="btnCancelHomeChanges" disabled onclick="fcmHomepageAdmin.cancelChanges()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Annulla modifiche</span>
        </button>
        <button type="button" class="calc-btn-action calc-btn-save btnSaveHomeGlobalConfig" id="btnSaveHomeGlobalConfig" disabled onclick="fcmHomepageAdmin.saveGlobalConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Salva Configurazione Globale</span>
        </button>
    </div>
</div>

<!-- SEZIONE 1: IMPOSTAZIONI PREDEFINITE DI LEGA -->
<section class="calc-card-section">
    <div class="calc-section-header">
        <div>
            <h3 class="calc-section-title"><span>⚙️</span> Impostazioni Predefinite di Lega (Nuovi Visitatori)</h3>
            <p class="calc-section-desc">Valori di fabbrica mostrati a tutti i visitatori prima di un'eventuale personalizzazione personale sul proprio dispositivo.</p>
        </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Competizione Classifica Lega &amp; GP:</label>
            <select id="adminSettingStandingsComp" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('standingsCompId', this.value)">
                <option value="auto">🤖 Automatica (Competizione Predefinita FCM)</option>
            </select>
            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Usata per i widget Classifica Lega e Classifica GP.</span>
        </div>
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Competizione Widget Coppa di Lega:</label>
            <select id="adminSettingCoppaComp" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('coppaCompId', this.value)">
                <option value="auto">🤖 Automatica (Rileva Coppa da nome/ID)</option>
            </select>
            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Usata per il widget Coppa di Lega nella sidebar.</span>
        </div>
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Campetto Top/Flop 11 Iniziale:</label>
            <select id="adminSettingTopFlop" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('topFlopDefaultTab', this.value)">
                <option value="top">⭐ Top 11 (Migliori fantavoti)</option>
                <option value="flop">👎 Flop 11 (Peggiori fantavoti)</option>
            </select>
        </div>
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Colonne Quote Scommesse:</label>
            <select id="adminSettingQuotesMode" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('quotesMode', this.value)">
                <option value="all">Tutte (1X2 + Under/Over)</option>
                <option value="1x2">Solo 1X2</option>
                <option value="uo">Solo Under/Over</option>
            </select>
        </div>
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Classifica GP (Accordion):</label>
            <select id="adminSettingGpAccordion" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('gpAccordionOpen', this.value === 'true')">
                <option value="true">Aperta di default</option>
                <option value="false">Chiusa di default</option>
            </select>
        </div>
        <div>
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Coppa di Lega (Accordion):</label>
            <select id="adminSettingCoppaAccordion" class="calc-input-select" style="width: 100%; box-sizing: border-box;" onchange="fcmHomepageAdmin.onDefaultSettingChange('coppaAccordionOpen', this.value === 'true')">
                <option value="false">Chiusa di default</option>
                <option value="true">Aperta di default</option>
            </select>
        </div>
    </div>
</section>

<!-- SEZIONE 2: LAYOUT E ORDINAMENTO WIDGET -->
<section class="calc-card-section">
    <div class="calc-section-header">
        <div>
            <h3 class="calc-section-title"><span>📐</span> Layout e Ordinamento Widget di Lega</h3>
            <p class="calc-section-desc">Definisci l'ordine predefinito e la visibilità globale. Le modifiche salvate diventano il default del sito.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="calc-btn-action" style="background: var(--accent-primary, #3b82f6); color: #fff; padding: 7px 14px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;" onclick="fcmHomepageAdmin.openBuilder()">
                <span>➕ Crea Nuovo Widget Personalizzato</span>
            </button>
            <button type="button" id="btnToggleAllPreviews" class="invform-back-btn" onclick="fcmHomepageAdmin.toggleAllPreviews()" style="font-size: 0.78rem; padding: 6px 12px; font-weight: 700; cursor: pointer;">
                <span>▲ Comprimi Tutte le Anteprime</span>
            </button>
        </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px;">
        <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--accent-primary, #3b82f6); display: flex; align-items: center; gap: 8px;">
                    <span>📰 Colonna Principale (Main)</span>
                </h4>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Ordina con ▲ ▼ e attiva/disattiva</span>
            </div>
            <div id="adminColMainList"></div>
        </div>
        <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--accent-primary, #3b82f6); display: flex; align-items: center; gap: 8px;">
                    <span>📋 Sidebar Laterale (Side)</span>
                </h4>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Ordina con ▲ ▼ e attiva/disattiva</span>
            </div>
            <div id="adminColSideList"></div>
        </div>
    </div>
    <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--border-subtle, rgba(255,255,255,0.1)); text-align: center;">
        <button type="button" class="btn-open-inline-builder" style="max-width: 480px; width: 100%; margin: 0 auto; padding: 12px 20px; font-size: 0.92rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 8px;" onclick="fcmHomepageAdmin.openBuilder()">
            <span>➕ Crea Nuovo Widget Personalizzato</span>
        </button>
    </div>
</section>

<!-- SEZIONE 3: WIDGET PERSONALIZZATI ESISTENTI -->
<section class="calc-card-section">
    <div class="calc-section-header">
        <div>
            <h3 class="calc-section-title"><span>🧩</span> Widget Personalizzati della Lega</h3>
            <p class="calc-section-desc">Riepilogo dei widget promozionali, comunicazioni e countdown creati per la homepage.</p>
        </div>
    </div>
    <div id="adminCustomWidgetsSummary"></div>
</section>

<!-- SEZIONE 3b: GESTIONE SPONSOR E PREFERITI -->
<section class="calc-card-section" id="sezione-sponsors">
    <div class="calc-section-header">
        <div>
            <h3 class="calc-section-title"><span>🤝</span> Sponsor e Preferiti</h3>
            <p class="calc-section-desc">Personalizza gli sponsor ufficiali, partner e collegamenti preferiti visualizzati nella card della homepage. Puoi indicare titolo, link e selezionare un logo da <code>img/sponsor</code> oppure caricarne uno nuovo.</p>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; align-items: start;">
        <!-- LISTA SPONSOR CONFIGURATI -->
        <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <span>📋 Elenco Sponsor e Preferiti</span>
                </h4>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Ordina con ▲ ▼ e modifica i campi</span>
            </div>
            <div id="adminSponsorsContainer" style="display: flex; flex-direction: column; gap: 12px;"></div>
            <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn-open-inline-builder" style="flex: 1; min-width: 180px; padding: 10px 16px; font-size: 0.88rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onclick="fcmHomepageAdmin.addSponsor()">
                    <span>➕ Aggiungi Sponsor</span>
                </button>
                <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveSponsorsBottom" style="flex: 1; min-width: 180px; padding: 10px 16px; font-size: 0.88rem; font-weight: 700; justify-content: center; display: inline-flex; align-items: center; gap: 6px;" onclick="fcmHomepageAdmin.saveSponsors()">
                    <span>💾 Salva Sponsor e Preferiti</span>
                </button>
            </div>
        </div>

        <!-- ANTEPRIMA CARD LIVE -->
        <div style="position: sticky; top: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <span>👁️ Anteprima Card Homepage (Sponsor e Preferiti)</span>
                </h4>
                <span class="badge badge-primary" style="font-size: 0.7rem;">Live Preview</span>
            </div>
            <div class="admin-live-preview-box" style="background: var(--bg-surface-elevated, #0f172a); border: 1px dashed var(--border-subtle, rgba(255,255,255,0.2)); border-radius: 14px; padding: 16px;">
                <div id="adminSponsorsLiveCardPreview"></div>
            </div>
        </div>
    </div>
</section>

<!-- SEZIONE 4: CREATORE / MODIFICA WIDGET PERSONALIZZATO UNIFICATO -->
<section class="calc-card-section" id="adminUnifiedBuilderSection" style="display: none; scroll-margin-top: 24px;">
    <div class="calc-section-header">
        <div>
            <h3 class="calc-section-title"><span id="builderSectionIcon">✨</span> <span id="builderSectionTitle">Crea Nuovo Widget Personalizzato</span></h3>
            <p class="calc-section-desc" id="builderSectionDesc">Scegli il modello, compila le informazioni e controlla l'anteprima in tempo reale prima di pubblicarlo.</p>
        </div>
        <button type="button" class="calc-btn-action calc-btn-cancel" onclick="fcmHomepageAdmin.closeBuilder()" style="padding: 6px 12px; font-size: 0.8rem;">
            ✕ Chiudi
        </button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
        <!-- FORM DI CONFIGURAZIONE -->
        <form id="adminCustomWidgetForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" id="customWidgetEditingId" value="">

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Tipo di Widget:</label>
                    <select id="customWidgetType" class="calc-input-select" style="width: 100%; max-width: 100%; box-sizing: border-box;">
                        <option value="competition_standings">🏆 Classifica / Tabellone Competizione</option>
                        <option value="banner">📢 Avviso / Banner con Link</option>
                        <option value="button_card">🔘 Scheda con Bottone / Social</option>
                        <option value="countdown">⏳ Conto alla Rovescia (Countdown)</option>
                        <option value="image">🖼️ Immagine / Locandina Promo</option>
                        <option value="embed">💻 Codice HTML / Embed Libero</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Colonna Homepage:</label>
                    <select id="customWidgetColumn" class="calc-input-select" style="width: 100%; max-width: 100%; box-sizing: border-box;">
                        <option value="main">📰 Principale (Main)</option>
                        <option value="side">📋 Laterale (Side)</option>
                    </select>
                </div>
            </div>

            <!-- Gruppo Competizione (Classifica / Scontri Diretti / Ibrida) -->
            <div id="groupWidgetCompetition" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Competizione FCM:</label>
                        <select id="customWidgetCompId" class="calc-input-select" style="width: 100%; max-width: 100%; box-sizing: border-box;">
                            <option value="">-- Seleziona Competizione --</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Formula / Formato:</label>
                        <select id="customWidgetCompFormat" class="calc-input-select" style="width: 100%; max-width: 100%; box-sizing: border-box;">
                            <option value="auto">🤖 Automatica (Rileva da FCM)</option>
                            <option value="round_robin">📊 Girone all'italiana (Classifica a punti)</option>
                            <option value="knockout">⚔️ Scontri diretti (Eliminazione diretta)</option>
                            <option value="hybrid">🔄 Ibrida (Gironi + Scontri diretti)</option>
                            <option value="gp">🏎️ Classifica Gran Prix (Somma Punti GP)</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Comportamento Card (Fisarmonica):</label>
                    <select id="customWidgetAccordionMode" class="calc-input-select" style="width: 100%; max-width: 100%; box-sizing: border-box;">
                        <option value="static">📌 Sempre aperta (Fissa senza fisarmonica)</option>
                        <option value="open">🔼 Fisarmonica (Aperta di default)</option>
                        <option value="closed">🔽 Fisarmonica (Chiusa di default)</option>
                    </select>
                </div>
                <div id="customWidgetCompDetectedHint" style="margin-top: 8px; font-size: 0.74rem; color: var(--text-muted); padding: 7px 10px; background: rgba(59, 130, 246, 0.08); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2);">
                    💡 Seleziona una competizione per mostrare in homepage la classifica a gironi, il tabellone a scontri diretti o entrambi.
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Titolo del Widget:</label>
                    <input type="text" id="customWidgetTitle" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: Mercato di Riparazione Invernale" value="Avviso Importante">
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Testo Badge (opzionale):</label>
                    <input type="text" id="customWidgetBadge" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: Ufficiale, Info, Live">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Colore Badge:</label>
                    <select id="customWidgetBadgeColor" class="calc-input-select" style="max-width: 100%;">
                        <option value="primary">Blu (Primario)</option>
                        <option value="success">Verde (Success)</option>
                        <option value="warning">Giallo / Ambra (Warning)</option>
                        <option value="danger">Rosso (Importante)</option>
                        <option value="info">Azzurro (Info)</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Visibilità Condizionale:</label>
                    <select id="customWidgetVisibility" class="calc-input-select" style="max-width: 100%;">
                        <option value="always">Mostra Sempre</option>
                        <option value="matchday_in_progress">Solo durante giornata in corso</option>
                        <option value="matchday_idle">Solo tra una giornata e l'altra</option>
                    </select>
                </div>
            </div>

            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Scadenza Automatica (opzionale):</label>
                <input type="datetime-local" id="customWidgetExpires" class="assoc-search-input" style="width: 100%; box-sizing: border-box;">
                <span style="font-size: 0.72rem; color: var(--text-muted);">Dopo questa data e ora il widget non apparirà più in homepage.</span>
            </div>

            <!-- Gruppo Testo e Descrizione (Banner e Scheda) -->
            <div id="groupWidgetContent">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Testo o Messaggio:</label>
                <textarea id="customWidgetContentText" rows="3" class="assoc-search-input" style="width: 100%; box-sizing: border-box; resize: vertical;" placeholder="Inserisci il testo dell'avviso o della comunicazione per la Lega...">Si comunica che la sessione straordinaria del mercato aprirà mercoledì alle ore 20:00.</textarea>
            </div>

            <!-- Gruppo Pulsante / Link -->
            <div id="groupWidgetLink">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Testo Pulsante (opzionale):</label>
                        <input type="text" id="customWidgetBtnText" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: Apri Mercato, Unisciti a Telegram">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Link Pulsante:</label>
                        <input type="text" id="customWidgetBtnLink" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: #mercato, https://t.me/tuogruppo">
                    </div>
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Apertura Link:</label>
                    <select id="customWidgetBtnTarget" class="calc-input-select" style="max-width: 100%;">
                        <option value="_self">Stessa scheda (_self)</option>
                        <option value="_blank">Nuova scheda (_blank)</option>
                    </select>
                </div>
            </div>

            <!-- Gruppo Countdown -->
            <div id="groupWidgetCountdown" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Data e Ora Target:</label>
                        <input type="datetime-local" id="customWidgetTargetDate" class="assoc-search-input" style="width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Sottotitolo Contatore:</label>
                        <input type="text" id="customWidgetSubtitle" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: Scadenza Consegna Buste">
                    </div>
                </div>
            </div>

            <!-- Gruppo Immagine -->
            <div id="groupWidgetImage" style="display: none;">
                <div style="margin-bottom: 8px;">
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">URL Immagine:</label>
                    <input type="text" id="customWidgetImageUrl" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: img/banner_coppa.png o https://...">
                </div>
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Didascalia / Alt text:</label>
                    <input type="text" id="customWidgetCaption" class="assoc-search-input" style="width: 100%; box-sizing: border-box;" placeholder="Es: Locandina Torneo di Primavera">
                </div>
            </div>

            <!-- Gruppo Embed HTML -->
            <div id="groupWidgetEmbed" style="display: none;">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Codice HTML / Iframe:</label>
                <textarea id="customWidgetEmbedHtml" rows="4" class="assoc-search-input" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 0.8rem; resize: vertical;" placeholder="<iframe src='...' width='100%' height='250'></iframe>"></textarea>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                <button type="button" class="calc-btn-action calc-btn-cancel" onclick="fcmHomepageAdmin.closeBuilder()" style="padding: 12px 18px; font-size: 0.92rem;">
                    Annulla
                </button>
                <button type="button" id="btnSubmitCustomWidget" class="calc-btn-action calc-btn-save" onclick="fcmHomepageAdmin.submitCustomWidget()" style="flex: 1; padding: 12px; font-size: 0.92rem; justify-content: center;">
                    <span>➕ Pubblica Widget Personalizzato</span>
                </button>
            </div>
        </form>

        <!-- ANTEPRIMA LIVE -->
        <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <span>👁️ Anteprima in Tempo Reale</span>
                </h4>
                <span class="badge badge-primary" style="font-size: 0.7rem;">Live Preview</span>
            </div>
            <div class="admin-live-preview-box" style="background: var(--bg-surface-elevated, #0f172a); border: 1px dashed var(--border-subtle, rgba(255,255,255,0.2)); border-radius: 14px; padding: 18px; min-height: 240px;">
                <div id="adminWidgetLivePreview"></div>
            </div>
        </div>
    </div>
</section>

<!-- SEZIONE 5: GESTIONE EDITORIALE DI GIORNATA CON INTELLIGENZA ARTIFICIALE (GOOGLE GEMINI AI) -->
<section class="calc-card-section" id="sezione-ai-news" style="border: 1px solid rgba(99, 102, 241, 0.35); background: linear-gradient(180deg, var(--bg-surface) 0%, rgba(99, 102, 241, 0.03) 100%);">
    <div class="calc-section-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
        <div>
            <h3 class="calc-section-title"><span style="color: var(--accent-primary);">✨</span> Editoriale di Giornata con AI (Google Gemini)</h3>
            <p class="calc-section-desc">Genera cronache e commenti giornalistici per ogni turno di campionato con l'AI gratuita di Google. Prompt modificabile con preset di stile e anteprima con editing completo prima della pubblicazione.</p>
        </div>
        <div class="badge-wrap">
            <span class="badge-status-changes" id="aiConfigStatusBadge">
                <span>⚪</span> Verifica stato API...
            </span>
        </div>
    </div>

    <!-- BLOCCO 1: CONFIGURAZIONE CREDENZIALI & MODELLO -->
    <div style="background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
        <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
            <span>🔑</span> Configurazione API Key & Modello
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 12px;">
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">
                    Google Gemini API Key:
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: underline; margin-left: 6px; font-weight: 400;">Ottieni chiave gratis (Google AI Studio)</a>
                </label>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="password" id="aiApiKeyInput" class="calc-input-text" placeholder="Incolla qui la chiave API (AIzaSy...)" style="flex: 1; min-width: 0; box-sizing: border-box;" autocomplete="new-password">
                    <button type="button" class="calc-btn-action" id="btnEditAiApiKey" onclick="fcmAiNewsAdmin.unlockApiKeyInput()" style="display: none; padding: 7px 12px; font-size: 0.78rem; white-space: nowrap;" title="Sblocca il campo per inserire una nuova chiave">
                        <span>✏️ Modifica</span>
                    </button>
                    <button type="button" class="calc-btn-action calc-btn-reset" id="btnClearAiApiKey" onclick="fcmAiNewsAdmin.clearApiKey()" style="display: none; padding: 7px 12px; font-size: 0.78rem; border-color: rgba(239, 68, 68, 0.4); color: var(--accent-rose); white-space: nowrap;" title="Elimina la chiave salvata">
                        <span>🗑️ Svuota</span>
                    </button>
                </div>
                <span id="aiApiKeyHelpText" style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 4px;">La chiave viene memorizzata in <code>inc/data/ai_config.json</code> protetto da <code>.htaccess</code> e non è mai visibile al pubblico.</span>
            </div>
            <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-wrap: wrap; gap: 4px;">
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin: 0;">Modello AI:</label>
                    <button type="button" class="calc-btn-action" id="btnToggleCustomModel" onclick="fcmAiNewsAdmin.toggleCustomModel()" style="padding: 2px 8px; font-size: 0.72rem; border-radius: var(--radius-sm); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;" title="Digita un modello custom non presente in elenco">
                        <span id="btnToggleCustomModelText">✏️ Personalizza</span>
                    </button>
                </div>
                <div id="aiModelSelectContainer">
                    <select id="aiModelSelect" class="calc-input-select" style="width: 100%; box-sizing: border-box;">
                        <option value="gemini-3.8-flash" selected>Gemini 3.8 Flash (Consigliato, velocissimo e brillante)</option>
                        <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Super economico e scattante)</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Ultra leggero)</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                    </select>
                </div>
                <div id="aiCustomModelContainer" style="display: none; margin-top: 6px;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <input type="text" id="aiCustomModelInput" class="calc-input-text" placeholder="Es: gemini-3.8-flash, gemini-3.8-pro, ecc." style="flex: 1; min-width: 0; box-sizing: border-box;" />
                        <button type="button" class="calc-btn-action" onclick="fcmAiNewsAdmin.cancelCustomModel()" style="padding: 7px 10px; font-size: 0.75rem; white-space: nowrap;" title="Torna all'elenco a tendina">
                            <span>Annulla</span>
                        </button>
                    </div>
                    <span style="font-size: 0.70rem; color: var(--text-muted); display: block; margin-top: 3px;">Digita il codice esatto del modello Google Gemini (es. <code>gemini-3.8-flash</code> o <code>gemini-3.8-pro</code>).</span>
                </div>
            </div>
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Stile / Tono Predefinito:</label>
                <select id="aiToneSelect" class="calc-input-select" style="width: 100%; box-sizing: border-box;">
                    <option value="ironico">😄 Ironico & Satirico (Beffe, battute, goliardia)</option>
                    <option value="gazzetta">📰 La Gazzetta di Lega (Formale, analisi tecnica)</option>
                    <option value="epico">⚔️ Epico & Drammatico (Battaglie campali, eroismi)</option>
                </select>
            </div>
        </div>
        <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveAiConfig" onclick="fcmAiNewsAdmin.saveConfig()" style="padding: 8px 16px;">
                <span>💾 Salva Configurazione AI</span>
            </button>
        </div>
    </div>

    <!-- BLOCCO 2: GENERATORE & PROMPT CUSTOM -->
    <div style="background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
        <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>⚡ Generatore di Cronaca per la Giornata</span>
            <div id="aiMatchdayPublishedStatus" style="font-size: 0.8rem; font-weight: 400;"></div>
        </h4>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">Seleziona Giornata:</label>
                <select id="aiMatchdaySelect" class="calc-input-select" style="width: 100%; box-sizing: border-box;"></select>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 10px;">
                <button type="button" class="calc-btn-action calc-btn-reset" id="btnAiDeletePublished" style="display: none; padding: 8px 14px; border-color: rgba(239, 68, 68, 0.4); color: var(--accent-rose);" onclick="fcmAiNewsAdmin.deletePublished()">
                    <span>🗑️ Elimina dalla Cache</span>
                </button>
            </div>
        </div>

        <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 5px;">
                Istruzioni per l'AI (Prompt modificabile liberamente):
            </label>
            <textarea id="aiPromptCustomText" class="calc-input-textarea" rows="5" style="width: 100%; box-sizing: border-box; font-family: inherit; font-size: 0.82rem; line-height: 1.4; resize: vertical;" placeholder="Inserisci o modifica le istruzioni stilistiche per il giornalista AI..."></textarea>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 4px;">I dati della giornata (risultati, formazioni, marcatori, distacchi e top/flop) vengono aggiunti automaticamente da ModernFCM.</span>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="calc-btn-action calc-btn-save" id="btnAiGenerateDraft" onclick="fcmAiNewsAdmin.generateDraft()" style="padding: 10px 20px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border: none; font-weight: 700;">
                <span>⚡ Genera Bozza con Gemini</span>
            </button>
        </div>
    </div>

    <!-- BLOCCO 3: EDITOR DELLA BOZZA & ANTEPRIMA LIVE -->
    <div id="aiDraftEditorSection" style="display: none; background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px;">
        <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>✏️ Revisione Bozza & Pubblicazione</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">Modifica i campi per perfezionare il testo prima di renderlo visibile nella Homepage</span>
        </h4>

        <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 14px;">
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Titolo dell'Editoriale:</label>
                <input type="text" id="aiDraftTitle" class="calc-input-text" style="width: 100%; box-sizing: border-box; font-weight: 700;" oninput="fcmAiNewsAdmin.updatePreviewBox()">
            </div>
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Sottotitolo / Sommario:</label>
                <input type="text" id="aiDraftSubtitle" class="calc-input-text" style="width: 100%; box-sizing: border-box;" oninput="fcmAiNewsAdmin.updatePreviewBox()">
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 4px;">⚡ Match Clou:</label>
                    <input type="text" id="aiDraftHighlightClou" class="calc-input-text" style="width: 100%; box-sizing: border-box;" oninput="fcmAiNewsAdmin.updatePreviewBox()">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--accent-emerald); margin-bottom: 4px;">🌟 Top Player:</label>
                    <input type="text" id="aiDraftHighlightTop" class="calc-input-text" style="width: 100%; box-sizing: border-box;" oninput="fcmAiNewsAdmin.updatePreviewBox()">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--accent-rose); margin-bottom: 4px;">💔 La Beffa:</label>
                    <input type="text" id="aiDraftHighlightBeffa" class="calc-input-text" style="width: 100%; box-sizing: border-box;" oninput="fcmAiNewsAdmin.updatePreviewBox()">
                </div>
            </div>
            <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Testo dell'Articolo (Paragrafi separati da doppio a capo):</label>
                <textarea id="aiDraftContent" class="calc-input-textarea" rows="8" style="width: 100%; box-sizing: border-box; font-family: inherit; font-size: 0.85rem; line-height: 1.5; resize: vertical;" oninput="fcmAiNewsAdmin.updatePreviewBox()"></textarea>
            </div>
        </div>

        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">Anteprima Finale (Come apparirà nella Home):</label>
            <div id="aiDraftLivePreview"></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="calc-btn-action calc-btn-save" id="btnAiPublishArticle" onclick="fcmAiNewsAdmin.publishArticle()" style="padding: 10px 24px; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); border: none;">
                <span>💾 Salva e Pubblica nella Homepage</span>
            </button>
        </div>
    </div>

    <!-- BLOCCO 4: ARCHIVIO & GESTIONE NOTIZIE / EDITORIALI GIÀ PUBBLICATI -->
    <div style="background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-top: 20px;">
        <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span style="display: flex; align-items: center; gap: 6px;">
                <span>📚</span> Archivio Editoriali Pubblicati
            </span>
            <span id="aiPublishedCountBadge" class="badge" style="background: rgba(99,102,241,0.15); color: var(--accent-primary); border: 1px solid rgba(99,102,241,0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: var(--radius-full);">
                0 Pubblicati
            </span>
        </h4>
        <div id="aiPublishedListContainer">
            <div style="font-size: 0.82rem; color: var(--text-muted); font-style: italic; padding: 10px 0;">
                Caricamento elenco editoriali pubblicati...
            </div>
        </div>
    </div>
</section>

<!-- ACTION BAR INFERIORE (Floating Sticky Bottom) -->
<div class="calc-actions-bar is-sticky-bottom" style="margin-top: 24px; margin-bottom: 24px;">
    <div class="badge-wrap">
        <span class="badge-status-changes no-changes badgeHomeChanges" id="adminHomeBadgeChangesSticky">
            <span>⚪</span> Nessuna modifica non salvata
        </span>
    </div>
    <div class="calc-actions-buttons">
        <button type="button" class="calc-btn-action calc-btn-reset btnRestoreDefaultHome" id="btnRestoreDefaultHomeSticky" onclick="fcmHomepageAdmin.restoreDefaultConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            <span>Ripristina Default</span>
        </button>
        <button type="button" class="calc-btn-action calc-btn-cancel btnCancelHomeChanges" id="btnCancelHomeChangesSticky" disabled onclick="fcmHomepageAdmin.cancelChanges()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Annulla modifiche</span>
        </button>
        <button type="button" class="calc-btn-action calc-btn-save btnSaveHomeGlobalConfig" id="btnSaveHomeGlobalConfigSticky" disabled onclick="fcmHomepageAdmin.saveGlobalConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Salva Configurazione Globale</span>
        </button>
    </div>
</div>

<!-- MODALE ANTEPRIMA WIDGET PERSONALIZZATO -->
<div id="adminWidgetPreviewModalBackdrop" class="admin-preview-modal-backdrop" style="display:none;" onclick="if(event.target === this) fcmHomepageAdmin.closePreviewModal()">
    <div class="admin-preview-modal-sheet">
        <div class="admin-preview-modal-header">
            <h3 class="admin-preview-modal-title" id="adminPreviewModalTitle">
                <span>👁️</span> Anteprima Widget Personalizzato
            </h3>
            <button type="button" class="admin-preview-close-btn" onclick="fcmHomepageAdmin.closePreviewModal()" aria-label="Chiudi">&times;</button>
        </div>
        <div class="admin-preview-modal-body" id="adminWidgetPreviewModalBody"></div>
        <div class="admin-preview-modal-footer">
            <button type="button" class="calc-btn-action calc-btn-cancel" onclick="fcmHomepageAdmin.closePreviewModal()">Chiudi</button>
            <button type="button" class="calc-btn-action btn-edit-custom-widget" id="adminPreviewModalBtnEdit" style="padding: 9px 16px;">
                <span>✏️ Modifica Widget</span>
            </button>
        </div>
    </div>
</div>

<!-- FCM Core Data Scripts per dati dinamici di Lega e Gestione Homepage -->
<script src="../js/fcmCostruttori.js" charset="ISO-8859-1"></script>
<script src="../js/fcmVariabili.js" charset="ISO-8859-1"></script>
<?php if (file_exists($baseDir . '/js/fcmCalcolorisultatiVariabili.js')): ?>
<script src="../js/fcmCalcolorisultatiVariabili.js" charset="ISO-8859-1"></script>
<?php endif; ?>
<script src="../js/DataA.js" charset="ISO-8859-1"></script>
<script src="../js/fcmLegaDati.js" charset="ISO-8859-1"></script>
<script src="../js/fcmSerieADati.js" charset="ISO-8859-1"></script>
<?php if (file_exists($baseDir . '/js/fcmSerieADatiDettaglio.js')): ?>
<script src="../js/fcmSerieADatiDettaglio.js" charset="ISO-8859-1"></script>
<?php endif; ?>
<script src="../js/fcmCompetizioniDati.js" charset="ISO-8859-1"></script>
<script src="../js/fcmFantasquadreDati.js" charset="ISO-8859-1"></script>
<script src="../js/fcmClassificaDati.js" charset="ISO-8859-1"></script>
<script src="../js/fcmCalendarioDati.js" charset="ISO-8859-1"></script>
<?php if (file_exists($baseDir . '/js/fcmTop11.js')): ?>
<script src="../js/fcmTop11.js" charset="ISO-8859-1"></script>
<?php endif; ?>
<script src="../js/fcmDataLoader.js"></script>
<?php if (file_exists($baseDir . '/js/fcmFantamisterMotore.js')): ?>
<script src="../js/fcmFantamisterMotore.js"></script>
<?php endif; ?>
<?php
$fcmAdminJsVer = file_exists(__DIR__ . '/../js/fcmHomepageAdmin.js') ? filemtime(__DIR__ . '/../js/fcmHomepageAdmin.js') : time();
$fcmHomeCfgJsVer = file_exists(__DIR__ . '/../js/fcmHomeConfigManager.js') ? filemtime(__DIR__ . '/../js/fcmHomeConfigManager.js') : time();
?>
<script src="../js/fcmHomeConfigManager.js?v=<?php echo $fcmHomeCfgJsVer; ?>"></script>
<script src="../js/fcmHomepageAdmin.js?v=<?php echo $fcmAdminJsVer; ?>"></script>
<?php
$fcmAiNewsAdminJsVer = file_exists(__DIR__ . '/../js/fcmAiNewsAdmin.js') ? filemtime(__DIR__ . '/../js/fcmAiNewsAdmin.js') : time();
?>
<script src="../js/fcmAiNewsAdmin.js?v=<?php echo $fcmAiNewsAdminJsVer; ?>"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    if (typeof fcmAiNewsAdmin !== 'undefined' && typeof fcmAiNewsAdmin.init === 'function') {
        fcmAiNewsAdmin.init();
    }
});
</script>

