<?php
/**
 * ModernFCM - Theme Admin View (UI Tab Amministrazione Tema)
 * File: inc/inc_theme_admin_view.php
 * Inclusa all'interno di inc/impostazioni.php
 */
if (!defined('PN_ADMIN_THEME_VIEW') && !isset($isAdminLogged)) {
    die('Accesso diretto non consentito.');
}
?>

<!-- Google Fonts per il supporto in anteprima e tipografia personalizzata -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@500;700;800&family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">

<style>
/* ==========================================================================
   STILI TAB PERSONALIZZAZIONE TEMA GRAFICO
   ========================================================================== */
.theme-admin-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 10px;
}

.theme-admin-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: stretch;
}

@media (min-width: 1024px) {
    .theme-admin-grid {
        grid-template-columns: 1.15fr 0.85fr;
        align-items: stretch;
    }
}

.theme-admin-preview-col {
    position: relative;
    height: 100%;
}

.theme-card-section {
    background: var(--bg-surface, #131d35);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    transition: border-color 0.2s ease;
}

.theme-card-section:hover {
    border-color: rgba(59, 130, 246, 0.3);
}

.theme-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: var(--bg-surface-elevated, #1a2747);
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    cursor: pointer;
    user-select: none;
}

.theme-section-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
}

.theme-section-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary, #f8fafc);
    margin: 0;
}

.theme-section-desc {
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    margin-top: 2px;
}

.theme-section-body {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* Palette Presets Grid */
.theme-presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
}

.theme-preset-card {
    background: var(--bg-surface-elevated, #1a2747);
    border: 2px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 10px);
    padding: 12px 10px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.theme-preset-card:hover {
    border-color: var(--accent-primary, #2563eb);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.theme-preset-card.active {
    border-color: var(--accent-primary, #2563eb);
    background: rgba(37, 99, 235, 0.12);
}

.theme-preset-swatches {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: center;
}

.theme-preset-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
}

.theme-preset-name {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-primary);
}

/* Form Controls & Color Pairs */
.theme-fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
}

.theme-field-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-surface-elevated, #1a2747);
    padding: 10px 12px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.theme-field-label-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.theme-field-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
}

.theme-field-var {
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.theme-color-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.theme-color-picker {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 38px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    background: transparent;
    flex-shrink: 0;
}

.theme-color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
}

.theme-color-picker::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
}

.theme-color-text {
    flex: 1;
    min-width: 0;
    font-family: monospace;
    font-size: 0.82rem;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle);
    background: var(--bg-surface, #131d35);
    color: var(--text-primary);
    text-transform: uppercase;
}

.theme-color-text:focus {
    border-color: var(--border-focus, #38bdf8);
    outline: none;
}

/* Sticky Preview Container: scorre e segue l'utente */
.theme-preview-sticky {
    position: -webkit-sticky;
    position: sticky;
    top: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    z-index: 40;
}

.theme-preview-card {
    background: var(--prev-bg-surface, #131d35);
    border: 1px solid var(--prev-border-subtle, rgba(255, 255, 255, 0.1));
    border-radius: var(--prev-radius-lg, 16px);
    padding: 18px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
    font-size: var(--prev-font-size-base, 15px) !important;
}

.theme-preview-card,
.theme-preview-card * {
    font-family: var(--prev-font-family, inherit) !important;
}

.theme-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--prev-border-subtle, rgba(255, 255, 255, 0.1));
    padding-bottom: 12px;
}

.theme-preview-title {
    font-size: 1.05em;
    font-weight: 800;
    color: var(--prev-text-primary, #f8fafc);
    margin: 0;
}

.theme-preview-body-text {
    font-size: 0.84em;
    color: var(--prev-text-secondary, #94a3b8);
    line-height: 1.45;
}

.theme-preview-muted-text {
    font-size: 0.74em;
    color: var(--prev-text-muted, #64748b);
}

.theme-preview-actions-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.theme-preview-btn-primary {
    background: var(--prev-accent-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 7px 14px;
    border-radius: var(--prev-radius-md, 10px);
    font-size: 0.82em;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
}

.theme-preview-btn-primary:hover {
    background: var(--prev-accent-primary-hover, #1d4ed8);
}

.theme-preview-link-cyan {
    color: var(--prev-accent-cyan, #06b6d4);
    font-size: 0.82em;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.theme-preview-link-cyan:hover {
    opacity: 0.8;
}

.theme-preview-badge-gold {
    background: var(--prev-accent-gold, #f59e0b);
    color: #1a1500;
    font-size: 0.72em;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: var(--prev-radius-sm, 6px);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.theme-preview-badge-live {
    background: var(--prev-accent-rose, #f43f5e);
    color: #ffffff;
    font-size: 0.72em;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: var(--prev-radius-sm, 6px);
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

/* Strip Tavolozza Accenti */
.theme-preview-accents-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--prev-bg-surface-elevated, #1a2747);
    border-radius: var(--prev-radius-sm, 6px);
    border: 1px solid var(--prev-border-subtle, rgba(255, 255, 255, 0.08));
}

.theme-preview-accents-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.theme-preview-accent-chip {
    padding: 3px 8px;
    border-radius: var(--prev-radius-sm, 6px);
    font-size: 0.72em;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.theme-preview-roles-row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    padding-top: 6px;
    border-top: 1px dashed var(--prev-border-subtle, rgba(255, 255, 255, 0.1));
}

.theme-preview-role-pill {
    padding: 3px 8px;
    border-radius: var(--prev-radius-sm, 6px);
    font-size: 0.72em;
    font-weight: 800;
    color: #ffffff;
}

.theme-preview-font-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.74em;
    color: var(--prev-text-muted, #64748b);
    padding-top: 6px;
    border-top: 1px dashed var(--prev-border-subtle, rgba(255, 255, 255, 0.1));
}

/* Contrast Checker Indicator */
.theme-contrast-indicator {
    padding: 8px 12px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.76rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

.theme-contrast-pass {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.theme-contrast-warn {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Mode Switcher inside Preview */
.theme-preview-toggle-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-surface-elevated, #1a2747);
    padding: 8px 12px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.theme-preview-mode-btn {
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    padding: 4px 10px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.theme-preview-mode-btn.active {
    background: var(--accent-primary, #2563eb);
    color: #ffffff;
    border-color: var(--accent-primary, #2563eb);
}
</style>

<div class="theme-admin-wrap">

    <!-- ACTION BAR SUPERIORE -->
    <div class="calc-actions-bar">
        <div class="badge-wrap">
            <span class="badge-status-changes no-changes" id="badgeThemeChanges">
                <span>⚪</span> Nessuna modifica non salvata
            </span>
        </div>
        <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-reset btnRestoreDefaultHome" style="color: var(--accent-crimson); border-color: rgba(239,68,68,0.3);" id="btnResetThemeDefaults" onclick="fcmThemeAdmin.resetDefaults()">
                <span>🔄 Ripristina Default</span>
            </button>
            <button type="button" class="calc-btn-action calc-btn-cancel" id="btnCancelThemeChanges" disabled onclick="fcmThemeAdmin.cancelChanges()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                <span>Annulla</span>
            </button>
            <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveThemeConfig" disabled onclick="fcmThemeAdmin.saveConfig()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Salva Tema</span>
            </button>
        </div>
    </div>

    <!-- MAIN TWO-COLUMN LAYOUT -->
    <div class="theme-admin-grid">

        <!-- COLONNA SINISTRA: SEZIONI CONFIGURAZIONE -->
        <div class="theme-admin-form-col">

            <!-- SEZIONE 1: PALETTE PRESET PRONTE -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">🎨</span>
                        <div>
                            <h3 class="theme-section-title">Palette Tematiche Preimpostate</h3>
                            <div class="theme-section-desc">Seleziona una base coordinata con 1 click, poi personalizza ogni singolo colore a tuo piacimento.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-presets-grid" id="themePresetsContainer">
                        <!-- Generato dinamicamente via JS -->
                    </div>
                </div>
            </section>

            <!-- SEZIONE 2: IMPOSTAZIONI GENERALI & TIPOGRAFIA -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">⚙️</span>
                        <div>
                            <h3 class="theme-section-title">Impostazioni Generali &amp; Tipografia</h3>
                            <div class="theme-section-desc">Tema iniziale per i nuovi visitatori, stile dei bordi e carattere tipografico globale.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-fields-grid">
                        <div class="theme-field-item">
                            <span class="theme-field-label">Tema Iniziale Visitatore</span>
                            <select id="themeDefaultPref" class="calc-input-select" onchange="fcmThemeAdmin.onDefaultPrefChange(this.value)">
                                <option value="system">Sistema (Segue preferenza del dispositivo utente)</option>
                                <option value="dark">Scuro (Predefinito Modalità Notte)</option>
                                <option value="light">Chiaro (Predefinito Modalità Giorno)</option>
                            </select>
                            <span class="theme-section-desc">Gli utenti possono comunque cambiare tema in ogni momento dal menu.</span>
                        </div>

                        <div class="theme-field-item">
                            <span class="theme-field-label">Carattere Tipografico (Font)</span>
                            <select id="themeFontSelect" class="calc-input-select" onchange="fcmThemeAdmin.onFontPresetChange(this.value)">
                                <option value="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">System UI (Nativo, massima fluidità)</option>
                                <option value="'Inter', system-ui, -apple-system, sans-serif">Inter (Modern Tech, ideale per tabelle)</option>
                                <option value="'Roboto', system-ui, -apple-system, sans-serif">Roboto (Sport Clean &amp; dinamico)</option>
                                <option value="'Poppins', system-ui, -apple-system, sans-serif">Poppins (Curve geometriche morbide)</option>
                                <option value="'Montserrat', system-ui, -apple-system, sans-serif">Montserrat (Bold Impact per titoli)</option>
                                <option value="custom">Personalizzato (Stack CSS manuale)...</option>
                            </select>
                            <input type="text" id="themeFontCustomInput" class="theme-color-text" style="display: none; margin-top: 6px; font-family: inherit;" placeholder="es. 'Ubuntu', sans-serif" oninput="fcmThemeAdmin.onCustomFontInput(this.value)">
                        </div>

                        <div class="theme-field-item">
                            <span class="theme-field-label">Dimensione Testo Base (Font Size)</span>
                            <select id="themeFontSizeSelect" class="calc-input-select" onchange="fcmThemeAdmin.onFontSizeChange(this.value)">
                                <option value="14px">Compatto (14px - Tabelle dense, più dati visibili)</option>
                                <option value="15px">Standard (15px - Predefinito bilanciato ModernFCM)</option>
                                <option value="16px">Medio (16px - Confortevole, standard web browser)</option>
                                <option value="17px">Grande (17px - Alta leggibilità su mobile e desktop)</option>
                                <option value="18px">Molto Grande (18px - Massima accessibilità)</option>
                            </select>
                            <span class="theme-section-desc">Scala proporzionalmente l'intera tipografia del sito (titoli, tabelle, card e badge).</span>
                        </div>

                        <div class="theme-field-item">
                            <span class="theme-field-label">Stile Raggi e Angoli (Border Radius)</span>
                            <select id="themeRadiusPreset" class="calc-input-select" onchange="fcmThemeAdmin.onRadiusPresetChange(this.value)">
                                <option value="modern">Moderno / Equilibrato (6px / 10px / 16px)</option>
                                <option value="sharp">Squadrato / Sharp (2px / 4px / 8px)</option>
                                <option value="soft">Morbido / Extra-Round (10px / 16px / 24px)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            <!-- SEZIONE 3: COLORI ACCENTO & BRAND -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">✨</span>
                        <div>
                            <h3 class="theme-section-title">Colori Accento &amp; Brand di Lega</h3>
                            <div class="theme-section-desc">Colori guida del sito: pulsanti primari, link, medaglie e indicatori di stato.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-fields-grid" id="themeAccentsFieldsContainer">
                        <!-- Popolato dinamicamente via JS -->
                    </div>
                </div>
            </section>

            <!-- SEZIONE 4: COLORI DEI RUOLI CALCIATORI -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">⚽</span>
                        <div>
                            <h3 class="theme-section-title">Colori dei Ruoli (P, D, C, A)</h3>
                            <div class="theme-section-desc">Personalizza i distintivi e i badge dei calciatori in tutte le formazioni, rose e tabellini.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-fields-grid" id="themeRolesFieldsContainer">
                        <!-- Popolato dinamicamente via JS -->
                    </div>
                </div>
            </section>

            <!-- SEZIONE 5: PALETTE TEMA SCURO (MODALITÀ NOTTE) -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">🌙</span>
                        <div>
                            <h3 class="theme-section-title">Palette Tema Scuro (Dark Mode)</h3>
                            <div class="theme-section-desc">Sfondi, superfici delle card, testi e bordi visibili quando il tema scuro è attivo.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-fields-grid" id="themeDarkFieldsContainer">
                        <!-- Popolato dinamicamente via JS -->
                    </div>
                </div>
            </section>

            <!-- SEZIONE 6: PALETTE TEMA CHIARO (MODALITÀ GIORNO) -->
            <section class="theme-card-section">
                <div class="theme-section-header">
                    <div class="theme-section-title-wrap">
                        <span style="font-size: 1.2rem;">☀️</span>
                        <div>
                            <h3 class="theme-section-title">Palette Tema Chiaro (Light Mode)</h3>
                            <div class="theme-section-desc">Sfondi, superfici delle card, testi e bordi visibili quando il tema chiaro è attivo.</div>
                        </div>
                    </div>
                </div>
                <div class="theme-section-body">
                    <div class="theme-fields-grid" id="themeLightFieldsContainer">
                        <!-- Popolato dinamicamente via JS -->
                    </div>
                </div>
            </section>

        </div>

        <!-- COLONNA DESTRA: LIVE PREVIEW STICKY (Scende allo scroll) -->
        <div class="theme-admin-preview-col">
            <div class="theme-preview-sticky">

                <!-- BARRA CONTROLLO ANTEPRIMA -->
                <div class="theme-preview-toggle-bar">
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">👁️ Anteprima in Tempo Reale</span>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="theme-preview-mode-btn active" id="btnPreviewDark" onclick="fcmThemeAdmin.setPreviewMode('dark')">
                            <span>🌙 Scuro</span>
                        </button>
                        <button type="button" class="theme-preview-mode-btn" id="btnPreviewLight" onclick="fcmThemeAdmin.setPreviewMode('light')">
                            <span>☀️ Chiaro</span>
                        </button>
                    </div>
                </div>

                <!-- CONTRAST HEALTH CHECK -->
                <div class="theme-contrast-indicator theme-contrast-pass" id="themeContrastIndicator">
                    <span id="themeContrastText">Contrasto WCAG: Ottimo (16.0:1)</span>
                </div>

                <!-- MOCKUP COMPONENTE REALE -->
                <div class="theme-preview-card" id="themePreviewMockup">
                    <div class="theme-preview-header">
                        <div>
                            <h4 class="theme-preview-title">ModernFCM Lega</h4>
                            <div class="theme-preview-muted-text">Stagione Fantacalcio 2026/27</div>
                        </div>
                        <span class="theme-preview-badge-gold" id="prevBadgeGold">🏆 1ª Classificata</span>
                    </div>

                    <div class="theme-preview-body-text">
                        Questo box simula l'aspetto grafico reale dei widget, dei testi e delle combinazioni cromatiche nel tema selezionato.
                    </div>

                    <!-- Azioni & Link con Accenti -->
                    <div class="theme-preview-actions-row">
                        <button type="button" class="theme-preview-btn-primary" id="prevBtnPrimary">Azione Primaria</button>
                        <a href="javascript:void(0)" class="theme-preview-link-cyan" id="prevLinkCyan">⚡ Link Ciano</a>
                        <span class="theme-preview-badge-live" id="prevBadgeRose">● Live Rosa</span>
                    </div>

                    <!-- Tavolozza Accenti di Lega -->
                    <div class="theme-preview-accents-section">
                        <div style="font-size: 0.72em; font-weight: 700; color: var(--prev-text-secondary); margin-bottom: 2px;">Tavolozza Accenti di Lega:</div>
                        <div class="theme-preview-accents-grid">
                            <span class="theme-preview-accent-chip" id="prevChipCyan">Ciano</span>
                            <span class="theme-preview-accent-chip" id="prevChipGold">Oro</span>
                            <span class="theme-preview-accent-chip" id="prevChipEmerald">Smeraldo</span>
                            <span class="theme-preview-accent-chip" id="prevChipRose">Rosa</span>
                            <span class="theme-preview-accent-chip" id="prevChipCrimson">Cremisi</span>
                            <span class="theme-preview-accent-chip" id="prevChipPurple">Viola</span>
                        </div>
                    </div>

                    <!-- Badge Ruoli Calciatori -->
                    <div class="theme-preview-roles-row">
                        <span class="theme-preview-role-pill" id="prevRoleP">P</span>
                        <span class="theme-preview-role-pill" id="prevRoleD">D</span>
                        <span class="theme-preview-role-pill" id="prevRoleC">C</span>
                        <span class="theme-preview-role-pill" id="prevRoleA">A</span>
                        <span style="font-size: 0.74em; color: var(--prev-text-muted); margin-left: auto;">Badge Ruoli</span>
                    </div>

                    <!-- Tipografia Attiva -->
                    <div class="theme-preview-font-info">
                        <span>Tipografia:</span>
                        <div>
                            <strong id="prevFontLabel" style="color: var(--prev-text-primary);">System UI</strong>
                            <span id="prevFontSizeLabel" style="margin-left: 4px; font-weight: 700; color: var(--prev-accent-primary);">(15px)</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>

    <!-- ACTION BAR INFERIORE (Sticky Bottom) -->
    <div class="calc-actions-bar is-sticky-bottom">
        <div class="badge-wrap">
            <span class="badge-status-changes no-changes" id="badgeThemeChangesSticky">
                <span>⚪</span> Nessuna modifica non salvata
            </span>
        </div>
        <div class="calc-actions-buttons">
            <button type="button" class="calc-btn-action calc-btn-reset btnRestoreDefaultHome" style="color: var(--accent-crimson); border-color: rgba(239,68,68,0.3);" onclick="fcmThemeAdmin.resetDefaults()">
                <span>🔄 Ripristina Default</span>
            </button>
            <button type="button" class="calc-btn-action calc-btn-cancel" id="btnCancelThemeChangesSticky" disabled onclick="fcmThemeAdmin.cancelChanges()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                <span>Annulla</span>
            </button>
            <button type="button" class="calc-btn-action calc-btn-save" id="btnSaveThemeConfigSticky" disabled onclick="fcmThemeAdmin.saveConfig()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Salva Tema</span>
            </button>
        </div>
    </div>

</div>

<!-- CARICAMENTO JS DEL MANAGER TEMA ADMIN -->
<script src="../js/fcmThemeAdmin.js?v=<?php echo time(); ?>"></script>
