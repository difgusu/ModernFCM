/**
 * ModernFCM - Theme Admin Manager (fcmThemeAdmin.js)
 * Gestisce l'interfaccia di personalizzazione del tema, palette preimpostate,
 * sincronizzazione dei controlli colore nativi e live preview con verifica del contrasto WCAG.
 */

const fcmThemeAdmin = {
  initialConfig: null,
  workingConfig: null,
  previewMode: 'dark',
  isDirty: false,
  activePresetId: 'classic',

  // 1. Catalogo metadati per i campi
  metadata: {
    accents: [
      { key: '--accent-primary', label: 'Colore Primario (Pulsanti & Brand)' },
      { key: '--accent-primary-hover', label: 'Hover Colore Primario' },
      { key: '--accent-cyan', label: 'Accento Ciano / Link' },
      { key: '--accent-gold', label: 'Accento Oro / Classifiche' },
      { key: '--accent-emerald', label: 'Accento Smeraldo / Vittorie' },
      { key: '--accent-rose', label: 'Accento Rosa / Live' },
      { key: '--accent-crimson', label: 'Accento Cremisi / Errori' },
      { key: '--accent-purple', label: 'Accento Viola / Coppe' }
    ],
    roles: [
      { key: '--role-p', label: 'Portiere (P)' },
      { key: '--role-d', label: 'Difensore (D)' },
      { key: '--role-c', label: 'Centrocampista (C)' },
      { key: '--role-a', label: 'Attaccante (A)' }
    ],
    surface: [
      { key: '--bg-main', label: 'Sfondo Pagina' },
      { key: '--bg-surface', label: 'Sfondo Card & Contenitori' },
      { key: '--bg-surface-elevated', label: 'Superfici Elevate / Header' },
      { key: '--bg-surface-hover', label: 'Hover Superfici' },
      { key: '--border-subtle', label: 'Bordi & Divisori' },
      { key: '--border-focus', label: 'Bordo Focus' },
      { key: '--text-primary', label: 'Testo Principale' },
      { key: '--text-secondary', label: 'Testo Secondario' },
      { key: '--text-muted', label: 'Testo Attenuato' }
    ]
  },

  // 2. Palette Tematiche Preimpostate (1-click)
  presets: [
    {
      id: 'classic',
      name: 'Modern Classic',
      desc: 'Deep Blue & Slate originale di ModernFCM',
      swatches: ['#0b1120', '#131d35', '#2563eb', '#38bdf8'],
      tokens: {
        dark: {
          '--bg-main': '#0b1120',
          '--bg-surface': '#131d35',
          '--bg-surface-elevated': '#1a2747',
          '--bg-surface-hover': '#223259',
          '--border-subtle': '#1e293b',
          '--border-focus': '#38bdf8',
          '--text-primary': '#f8fafc',
          '--text-secondary': '#94a3b8',
          '--text-muted': '#64748b'
        },
        light: {
          '--bg-main': '#f1f5f9',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#f8fafc',
          '--bg-surface-hover': '#eef2f6',
          '--border-subtle': '#cbd5e1',
          '--border-focus': '#38bdf8',
          '--text-primary': '#0f172a',
          '--text-secondary': '#334155',
          '--text-muted': '#64748b'
        },
        accents: {
          '--accent-primary': '#2563eb',
          '--accent-primary-hover': '#1d4ed8',
          '--accent-cyan': '#06b6d4',
          '--accent-gold': '#f59e0b',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#f43f5e',
          '--accent-crimson': '#ef4444',
          '--accent-purple': '#8b5cf6'
        },
        roles: {
          '--role-p': '#f59e0b',
          '--role-d': '#10b981',
          '--role-c': '#06b6d4',
          '--role-a': '#f43f5e'
        }
      }
    },
    {
      id: 'emerald',
      name: 'Emerald Stadium',
      desc: 'Verde campo da calcio, menta e accenti vibranti',
      swatches: ['#061a14', '#0b2920', '#059669', '#10b981'],
      tokens: {
        dark: {
          '--bg-main': '#061a14',
          '--bg-surface': '#0b2920',
          '--bg-surface-elevated': '#11382c',
          '--bg-surface-hover': '#184d3d',
          '--border-subtle': '#134e3a',
          '--border-focus': '#10b981',
          '--text-primary': '#f0fdf4',
          '--text-secondary': '#86efac',
          '--text-muted': '#4ade80'
        },
        light: {
          '--bg-main': '#f0fdf4',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#dcfce7',
          '--bg-surface-hover': '#bbf7d0',
          '--border-subtle': '#86efac',
          '--border-focus': '#059669',
          '--text-primary': '#064e3b',
          '--text-secondary': '#047857',
          '--text-muted': '#059669'
        },
        accents: {
          '--accent-primary': '#059669',
          '--accent-primary-hover': '#047857',
          '--accent-cyan': '#14b8a6',
          '--accent-gold': '#eab308',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#f43f5e',
          '--accent-crimson': '#e11d48',
          '--accent-purple': '#9333ea'
        },
        roles: {
          '--role-p': '#eab308',
          '--role-d': '#10b981',
          '--role-c': '#14b8a6',
          '--role-a': '#f43f5e'
        }
      }
    },
    {
      id: 'violet',
      name: 'Midnight Violet',
      desc: 'Toni notturni profondi, indaco e neon viola',
      swatches: ['#0f0728', '#1a0f3d', '#7c3aed', '#c084fc'],
      tokens: {
        dark: {
          '--bg-main': '#0f0728',
          '--bg-surface': '#1a0f3d',
          '--bg-surface-elevated': '#261657',
          '--bg-surface-hover': '#351f78',
          '--border-subtle': '#2d1863',
          '--border-focus': '#c084fc',
          '--text-primary': '#faf5ff',
          '--text-secondary': '#d8b4fe',
          '--text-muted': '#a855f7'
        },
        light: {
          '--bg-main': '#faf5ff',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#f3e8ff',
          '--bg-surface-hover': '#e9d5ff',
          '--border-subtle': '#d8b4fe',
          '--border-focus': '#9333ea',
          '--text-primary': '#3b0764',
          '--text-secondary': '#6b21a8',
          '--text-muted': '#7e22ce'
        },
        accents: {
          '--accent-primary': '#7c3aed',
          '--accent-primary-hover': '#6d28d9',
          '--accent-cyan': '#38bdf8',
          '--accent-gold': '#f59e0b',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#ec4899',
          '--accent-crimson': '#f43f5e',
          '--accent-purple': '#a855f7'
        },
        roles: {
          '--role-p': '#f59e0b',
          '--role-d': '#10b981',
          '--role-c': '#38bdf8',
          '--role-a': '#ec4899'
        }
      }
    },
    {
      id: 'crimson',
      name: 'Crimson Sport',
      desc: 'Rosso corsa / bordeaux sportivo e grafite',
      swatches: ['#18090b', '#291014', '#e11d48', '#fda4af'],
      tokens: {
        dark: {
          '--bg-main': '#18090b',
          '--bg-surface': '#291014',
          '--bg-surface-elevated': '#3b171c',
          '--bg-surface-hover': '#522027',
          '--border-subtle': '#4c1920',
          '--border-focus': '#fb7185',
          '--text-primary': '#fff1f2',
          '--text-secondary': '#fda4af',
          '--text-muted': '#f43f5e'
        },
        light: {
          '--bg-main': '#fff1f2',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#ffe4e6',
          '--bg-surface-hover': '#fecdd3',
          '--border-subtle': '#fda4af',
          '--border-focus': '#e11d48',
          '--text-primary': '#4c0519',
          '--text-secondary': '#881337',
          '--text-muted': '#9f1239'
        },
        accents: {
          '--accent-primary': '#e11d48',
          '--accent-primary-hover': '#be123c',
          '--accent-cyan': '#06b6d4',
          '--accent-gold': '#f59e0b',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#f43f5e',
          '--accent-crimson': '#ef4444',
          '--accent-purple': '#8b5cf6'
        },
        roles: {
          '--role-p': '#f59e0b',
          '--role-d': '#10b981',
          '--role-c': '#06b6d4',
          '--role-a': '#e11d48'
        }
      }
    },
    {
      id: 'slate',
      name: 'Slate Minimal',
      desc: 'Design pulito e neutro in tonalità grafite e titanio',
      swatches: ['#09090b', '#18181b', '#3b82f6', '#a1a1aa'],
      tokens: {
        dark: {
          '--bg-main': '#09090b',
          '--bg-surface': '#18181b',
          '--bg-surface-elevated': '#27272a',
          '--bg-surface-hover': '#3f3f46',
          '--border-subtle': '#2e2e33',
          '--border-focus': '#a1a1aa',
          '--text-primary': '#fafafa',
          '--text-secondary': '#a1a1aa',
          '--text-muted': '#71717a'
        },
        light: {
          '--bg-main': '#f4f4f5',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#e4e4e7',
          '--bg-surface-hover': '#d4d4d8',
          '--border-subtle': '#d4d4d8',
          '--border-focus': '#52525b',
          '--text-primary': '#09090b',
          '--text-secondary': '#27272a',
          '--text-muted': '#52525b'
        },
        accents: {
          '--accent-primary': '#3b82f6',
          '--accent-primary-hover': '#2563eb',
          '--accent-cyan': '#06b6d4',
          '--accent-gold': '#f59e0b',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#f43f5e',
          '--accent-crimson': '#ef4444',
          '--accent-purple': '#8b5cf6'
        },
        roles: {
          '--role-p': '#f59e0b',
          '--role-d': '#10b981',
          '--role-c': '#06b6d4',
          '--role-a': '#ef4444'
        }
      }
    },
    {
      id: 'gold',
      name: 'Golden Trophy',
      desc: 'Nero lusso, ambra e oro brillante per leghe prestigiose',
      swatches: ['#14120a', '#241f12', '#d97706', '#fbbf24'],
      tokens: {
        dark: {
          '--bg-main': '#14120a',
          '--bg-surface': '#241f12',
          '--bg-surface-elevated': '#362e1a',
          '--bg-surface-hover': '#4a3f24',
          '--border-subtle': '#3d341d',
          '--border-focus': '#fbbf24',
          '--text-primary': '#fefce8',
          '--text-secondary': '#fde047',
          '--text-muted': '#ca8a04'
        },
        light: {
          '--bg-main': '#fefce8',
          '--bg-surface': '#ffffff',
          '--bg-surface-elevated': '#fef9c3',
          '--bg-surface-hover': '#fef08a',
          '--border-subtle': '#fde047',
          '--border-focus': '#d97706',
          '--text-primary': '#451a03',
          '--text-secondary': '#78350f',
          '--text-muted': '#854d0e'
        },
        accents: {
          '--accent-primary': '#d97706',
          '--accent-primary-hover': '#b45309',
          '--accent-cyan': '#0284c7',
          '--accent-gold': '#f59e0b',
          '--accent-emerald': '#10b981',
          '--accent-rose': '#f43f5e',
          '--accent-crimson': '#dc2626',
          '--accent-purple': '#7c3aed'
        },
        roles: {
          '--role-p': '#f59e0b',
          '--role-d': '#10b981',
          '--role-c': '#0284c7',
          '--role-a': '#dc2626'
        }
      }
    }
  ],

  csrfToken: '',

  getCsrfToken() {
    if (this.csrfToken) return this.csrfToken;
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]') : null;
    return meta ? (meta.getAttribute('content') || '') : '';
  },

  // 3. Inizializzazione
  async init() {
    try {
      const res = await fetch(`theme_admin_save.php?action=get_theme_config&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.csrfToken) {
          this.csrfToken = data.csrfToken;
        }
        if (data && data.config) {
          this.initialConfig = JSON.parse(JSON.stringify(data.config));
          this.workingConfig = JSON.parse(JSON.stringify(data.config));
          this.renderPresets();
          this.renderAllFields();
          this.updatePreview();
          this.setDirty(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Impossibile caricare configurazione tema dal server, uso default:', e);
    }

    // Fallback: carica preset classic
    const classicPreset = this.presets[0];
    this.initialConfig = {
      version: 1,
      defaultTheme: 'system',
      tokens: JSON.parse(JSON.stringify(classicPreset.tokens))
    };
    this.initialConfig.tokens.ui = {
      '--font-family': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      '--font-size-base': '15px',
      '--radius-sm': '6px',
      '--radius-md': '10px',
      '--radius-lg': '16px'
    };
    this.workingConfig = JSON.parse(JSON.stringify(this.initialConfig));
    this.renderPresets();
    this.renderAllFields();
    this.updatePreview();
    this.setDirty(false);
  },

  // 4. Render Palette Preset Cards
  renderPresets() {
    const container = document.getElementById('themePresetsContainer');
    if (!container) return;

    container.innerHTML = this.presets.map(p => `
      <div class="theme-preset-card ${this.activePresetId === p.id ? 'active' : ''}" onclick="fcmThemeAdmin.applyPreset('${p.id}')">
        <div class="theme-preset-swatches">
          ${p.swatches.map(c => `<span class="theme-preset-dot" style="background:${c}"></span>`).join('')}
        </div>
        <span class="theme-preset-name">${p.name}</span>
      </div>
    `).join('');
  },

  // Applica una palette al draft
  applyPreset(presetId) {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) return;

    this.activePresetId = presetId;
    this.renderPresets();

    // Copia i tokens della palette
    for (const group of ['dark', 'light', 'accents', 'roles']) {
      if (preset.tokens[group]) {
        if (!this.workingConfig.tokens[group]) this.workingConfig.tokens[group] = {};
        for (const [k, v] of Object.entries(preset.tokens[group])) {
          this.workingConfig.tokens[group][k] = v;
        }
      }
    }

    this.renderAllFields();
    this.updatePreview();
    this.setDirty(true);
  },

  // 5. Render di tutti i campi input colore
  renderAllFields() {
    this.renderFieldGroup('themeAccentsFieldsContainer', 'accents', this.metadata.accents);
    this.renderFieldGroup('themeRolesFieldsContainer', 'roles', this.metadata.roles);
    this.renderFieldGroup('themeDarkFieldsContainer', 'dark', this.metadata.surface);
    this.renderFieldGroup('themeLightFieldsContainer', 'light', this.metadata.surface);

    // Default theme preference select
    const defaultSelect = document.getElementById('themeDefaultPref');
    if (defaultSelect && this.workingConfig.defaultTheme) {
      defaultSelect.value = this.workingConfig.defaultTheme;
    }

    // Font select & custom input
    const fontSelect = document.getElementById('themeFontSelect');
    const customFontInput = document.getElementById('themeFontCustomInput');
    const currentFont = (this.workingConfig.tokens.ui && this.workingConfig.tokens.ui['--font-family']) || '';

    if (fontSelect) {
      let matched = false;
      for (const opt of fontSelect.options) {
        if (opt.value === currentFont) {
          fontSelect.value = currentFont;
          matched = true;
          break;
        }
      }
      if (!matched && currentFont) {
        fontSelect.value = 'custom';
        if (customFontInput) {
          customFontInput.style.display = 'block';
          customFontInput.value = currentFont;
        }
      } else if (customFontInput) {
        customFontInput.style.display = 'none';
      }
    }

    // Radius preset select
    const radiusSelect = document.getElementById('themeRadiusPreset');
    const currentSm = (this.workingConfig.tokens.ui && this.workingConfig.tokens.ui['--radius-sm']) || '6px';
    if (radiusSelect) {
      if (currentSm === '2px') radiusSelect.value = 'sharp';
      else if (currentSm === '10px') radiusSelect.value = 'soft';
      else radiusSelect.value = 'modern';
    }

    // Font size preset select
    const fontSizeSelect = document.getElementById('themeFontSizeSelect');
    const currentSize = (this.workingConfig.tokens.ui && this.workingConfig.tokens.ui['--font-size-base']) || '15px';
    if (fontSizeSelect) {
      fontSizeSelect.value = currentSize;
    }
  },

  renderFieldGroup(containerId, groupName, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const groupTokens = (this.workingConfig.tokens && this.workingConfig.tokens[groupName]) || {};

    container.innerHTML = items.map(item => {
      const val = groupTokens[item.key] || '#000000';
      const hexColor = this.normalizeHexColor(val);
      const inputId = `color_${groupName}_${item.key.replace('--', '')}`;

      return `
        <div class="theme-field-item">
          <div class="theme-field-label-wrap">
            <span class="theme-field-label">${item.label}</span>
            <span class="theme-field-var">${item.key}</span>
          </div>
          <div class="theme-color-input-row">
            <input type="color" 
                   id="${inputId}_picker" 
                   class="theme-color-picker" 
                   value="${hexColor}" 
                   oninput="fcmThemeAdmin.onPickerInput('${groupName}', '${item.key}', this.value, '${inputId}_text')">
            <input type="text" 
                   id="${inputId}_text" 
                   class="theme-color-text" 
                   value="${val}" 
                   oninput="fcmThemeAdmin.onTextInput('${groupName}', '${item.key}', this.value, '${inputId}_picker')">
          </div>
        </div>
      `;
    }).join('');
  },

  // Sincronizzazione Color Picker -> Text
  onPickerInput(group, key, colorHex, textInputId) {
    if (!this.workingConfig.tokens[group]) this.workingConfig.tokens[group] = {};
    this.workingConfig.tokens[group][key] = colorHex;

    const textInput = document.getElementById(textInputId);
    if (textInput) textInput.value = colorHex;

    this.activePresetId = null;
    this.renderPresets();
    this.updatePreview();
    this.setDirty(true);
  },

  // Sincronizzazione Text -> Color Picker
  onTextInput(group, key, rawVal, pickerInputId) {
    if (!this.workingConfig.tokens[group]) this.workingConfig.tokens[group] = {};
    this.workingConfig.tokens[group][key] = rawVal.trim();

    const picker = document.getElementById(pickerInputId);
    if (picker && this.isValidHex(rawVal.trim())) {
      picker.value = this.normalizeHexColor(rawVal.trim());
    }

    this.activePresetId = null;
    this.renderPresets();
    this.updatePreview();
    this.setDirty(true);
  },

  // Modifica preferenza default (system / dark / light)
  onDefaultPrefChange(val) {
    this.workingConfig.defaultTheme = val;
    this.setDirty(true);
  },

  // Modifica Preset Font
  onFontPresetChange(val) {
    const customInput = document.getElementById('themeFontCustomInput');
    if (!this.workingConfig.tokens.ui) this.workingConfig.tokens.ui = {};

    if (val === 'custom') {
      if (customInput) customInput.style.display = 'block';
      this.workingConfig.tokens.ui['--font-family'] = customInput ? customInput.value : 'system-ui, sans-serif';
    } else {
      if (customInput) customInput.style.display = 'none';
      this.workingConfig.tokens.ui['--font-family'] = val;
    }
    this.updatePreview();
    this.setDirty(true);
  },

  onCustomFontInput(val) {
    if (!this.workingConfig.tokens.ui) this.workingConfig.tokens.ui = {};
    this.workingConfig.tokens.ui['--font-family'] = val.trim();
    this.updatePreview();
    this.setDirty(true);
  },

  // Modifica Dimensione Font Globale
  onFontSizeChange(val) {
    if (!this.workingConfig.tokens.ui) this.workingConfig.tokens.ui = {};
    this.workingConfig.tokens.ui['--font-size-base'] = val;
    this.updatePreview();
    this.setDirty(true);
  },

  // Modifica Preset Raggi
  onRadiusPresetChange(preset) {
    if (!this.workingConfig.tokens.ui) this.workingConfig.tokens.ui = {};

    if (preset === 'sharp') {
      this.workingConfig.tokens.ui['--radius-sm'] = '2px';
      this.workingConfig.tokens.ui['--radius-md'] = '4px';
      this.workingConfig.tokens.ui['--radius-lg'] = '8px';
    } else if (preset === 'soft') {
      this.workingConfig.tokens.ui['--radius-sm'] = '10px';
      this.workingConfig.tokens.ui['--radius-md'] = '16px';
      this.workingConfig.tokens.ui['--radius-lg'] = '24px';
    } else {
      // Moderno (default)
      this.workingConfig.tokens.ui['--radius-sm'] = '6px';
      this.workingConfig.tokens.ui['--radius-md'] = '10px';
      this.workingConfig.tokens.ui['--radius-lg'] = '16px';
    }
    this.updatePreview();
    this.setDirty(true);
  },

  // 6. Switch modalità Anteprima (Scuro / Chiaro)
  setPreviewMode(mode) {
    this.previewMode = mode;
    const btnDark = document.getElementById('btnPreviewDark');
    const btnLight = document.getElementById('btnPreviewLight');
    if (btnDark) btnDark.classList.toggle('active', mode === 'dark');
    if (btnLight) btnLight.classList.toggle('active', mode === 'light');
    this.updatePreview();
  },

  ensureGoogleFontLoaded(fontStr, targetDoc = document) {
    const doc = targetDoc || document;
    const f = (fontStr || '').toLowerCase();
    let familyQuery = '';
    if (f.includes('poppins')) familyQuery = 'Poppins:wght@400;600;700;800';
    else if (f.includes('montserrat')) familyQuery = 'Montserrat:wght@500;700;800';
    else if (f.includes('inter')) familyQuery = 'Inter:wght@400;600;700;800';
    else if (f.includes('roboto')) familyQuery = 'Roboto:wght@400;500;700';
    if (!familyQuery || !doc.head) return;

    const id = 'fcm-gfont-' + familyQuery.split(':')[0].toLowerCase();
    if (!doc.getElementById(id)) {
      const link = doc.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + familyQuery + '&display=swap';
      doc.head.appendChild(link);
    }
  },

  // 7. Aggiorna Live Preview Mockup
  updatePreview() {
    const mockup = document.getElementById('themePreviewMockup');
    if (!mockup) return;

    const tokens = this.workingConfig.tokens || {};
    const surfaceTokens = (this.previewMode === 'dark' ? tokens.dark : tokens.light) || {};
    const accents = tokens.accents || {};
    const roles = tokens.roles || {};
    const ui = tokens.ui || {};

    // Applica proprietà CSS scoped al mockup
    mockup.style.setProperty('--prev-bg-surface', surfaceTokens['--bg-surface'] || (this.previewMode === 'dark' ? '#131d35' : '#ffffff'));
    mockup.style.setProperty('--prev-bg-surface-elevated', surfaceTokens['--bg-surface-elevated'] || (this.previewMode === 'dark' ? '#1a2747' : '#f8fafc'));
    mockup.style.setProperty('--prev-border-subtle', surfaceTokens['--border-subtle'] || (this.previewMode === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1'));
    mockup.style.setProperty('--prev-text-primary', surfaceTokens['--text-primary'] || (this.previewMode === 'dark' ? '#f8fafc' : '#0f172a'));
    mockup.style.setProperty('--prev-text-secondary', surfaceTokens['--text-secondary'] || (this.previewMode === 'dark' ? '#94a3b8' : '#334155'));
    mockup.style.setProperty('--prev-text-muted', surfaceTokens['--text-muted'] || '#64748b');

    mockup.style.setProperty('--prev-accent-primary', accents['--accent-primary'] || '#2563eb');
    mockup.style.setProperty('--prev-accent-primary-hover', accents['--accent-primary-hover'] || '#1d4ed8');

    mockup.style.setProperty('--prev-radius-sm', ui['--radius-sm'] || '6px');
    mockup.style.setProperty('--prev-radius-md', ui['--radius-md'] || '10px');
    mockup.style.setProperty('--prev-radius-lg', ui['--radius-lg'] || '16px');

    const activeFont = ui['--font-family'] || 'inherit';
    this.ensureGoogleFontLoaded(activeFont, document);
    mockup.style.setProperty('--prev-font-family', activeFont);
    mockup.style.fontFamily = activeFont;

    const activeFontSize = ui['--font-size-base'] || '15px';
    mockup.style.setProperty('--prev-font-size-base', activeFontSize);
    mockup.style.fontSize = activeFontSize;

    // Etichetta Font Attivo nel mockup
    const fontLabel = document.getElementById('prevFontLabel');
    if (fontLabel) {
      if (activeFont.includes('Poppins')) fontLabel.textContent = 'Poppins (Geometric)';
      else if (activeFont.includes('Montserrat')) fontLabel.textContent = 'Montserrat (Bold)';
      else if (activeFont.includes('Inter')) fontLabel.textContent = 'Inter (Modern Tech)';
      else if (activeFont.includes('Roboto')) fontLabel.textContent = 'Roboto (Sport Clean)';
      else if (activeFont.includes('system-ui')) fontLabel.textContent = 'System UI (Nativo)';
      else fontLabel.textContent = activeFont.split(',')[0].replace(/['"]/g, '');
    }

    const fontSizeLabel = document.getElementById('prevFontSizeLabel');
    if (fontSizeLabel) {
      fontSizeLabel.textContent = `(${activeFontSize})`;
    }

    // Elementi Azione & Link con Accenti
    const prevBtnPrimary = document.getElementById('prevBtnPrimary');
    if (prevBtnPrimary) {
      prevBtnPrimary.style.background = accents['--accent-primary'] || '#2563eb';
    }

    const prevBadgeGold = document.getElementById('prevBadgeGold');
    if (prevBadgeGold) {
      const goldColor = accents['--accent-gold'] || '#f59e0b';
      prevBadgeGold.style.background = goldColor;
      prevBadgeGold.style.color = this.getContrastingTextColor(goldColor);
    }

    const prevLinkCyan = document.getElementById('prevLinkCyan');
    if (prevLinkCyan) {
      prevLinkCyan.style.color = accents['--accent-cyan'] || '#06b6d4';
    }

    const prevBadgeRose = document.getElementById('prevBadgeRose');
    if (prevBadgeRose) {
      prevBadgeRose.style.background = accents['--accent-rose'] || '#f43f5e';
    }

    // Chip Tavolozza Accenti
    const chipCyan = document.getElementById('prevChipCyan');
    if (chipCyan) {
      const c = accents['--accent-cyan'] || '#06b6d4';
      chipCyan.style.background = c;
      chipCyan.style.color = this.getContrastingTextColor(c);
    }
    const chipGold = document.getElementById('prevChipGold');
    if (chipGold) {
      const c = accents['--accent-gold'] || '#f59e0b';
      chipGold.style.background = c;
      chipGold.style.color = this.getContrastingTextColor(c);
    }
    const chipEmerald = document.getElementById('prevChipEmerald');
    if (chipEmerald) {
      const c = accents['--accent-emerald'] || '#10b981';
      chipEmerald.style.background = c;
      chipEmerald.style.color = this.getContrastingTextColor(c);
    }
    const chipRose = document.getElementById('prevChipRose');
    if (chipRose) {
      const c = accents['--accent-rose'] || '#f43f5e';
      chipRose.style.background = c;
      chipRose.style.color = this.getContrastingTextColor(c);
    }
    const chipCrimson = document.getElementById('prevChipCrimson');
    if (chipCrimson) {
      const c = accents['--accent-crimson'] || '#ef4444';
      chipCrimson.style.background = c;
      chipCrimson.style.color = this.getContrastingTextColor(c);
    }
    const chipPurple = document.getElementById('prevChipPurple');
    if (chipPurple) {
      const c = accents['--accent-purple'] || '#8b5cf6';
      chipPurple.style.background = c;
      chipPurple.style.color = this.getContrastingTextColor(c);
    }

    // Badge Ruoli
    const rP = document.getElementById('prevRoleP');
    const rD = document.getElementById('prevRoleD');
    const rC = document.getElementById('prevRoleC');
    const rA = document.getElementById('prevRoleA');
    if (rP) rP.style.background = roles['--role-p'] || '#f59e0b';
    if (rD) rD.style.background = roles['--role-d'] || '#10b981';
    if (rC) rC.style.background = roles['--role-c'] || '#06b6d4';
    if (rA) rA.style.background = roles['--role-a'] || '#f43f5e';

    // Calcolo Contrasto WCAG tra testo primario e sfondo card
    const textHex = this.normalizeHexColor(surfaceTokens['--text-primary'] || (this.previewMode === 'dark' ? '#f8fafc' : '#0f172a'));
    const bgHex = this.normalizeHexColor(surfaceTokens['--bg-surface'] || (this.previewMode === 'dark' ? '#131d35' : '#ffffff'));
    const ratio = this.calculateContrastRatio(textHex, bgHex);

    const indicator = document.getElementById('themeContrastIndicator');
    const indicatorText = document.getElementById('themeContrastText');
    if (indicator && indicatorText) {
      if (ratio >= 4.5) {
        indicator.className = 'theme-contrast-indicator theme-contrast-pass';
        indicatorText.innerHTML = `🛡️ Contrasto WCAG: Ottimo (${ratio.toFixed(1)}:1 - Conforme)`;
      } else if (ratio >= 3.0) {
        indicator.className = 'theme-contrast-indicator theme-contrast-warn';
        indicatorText.innerHTML = `⚠️ Contrasto WCAG: Accettabile (${ratio.toFixed(1)}:1 - Minimo)`;
      } else {
        indicator.className = 'theme-contrast-indicator theme-contrast-warn';
        indicatorText.style.color = '#ef4444';
        indicatorText.innerHTML = `⛔ Contrasto WCAG: Basso (${ratio.toFixed(1)}:1 - Rischio scarsa leggibilità)`;
      }
    }
  },

  // 8. Stato Modifiche (Dirty Checking)
  setDirty(isDirty) {
    this.isDirty = isDirty;
    const badgeTop = document.getElementById('badgeThemeChanges');
    const badgeSticky = document.getElementById('badgeThemeChangesSticky');
    const saveBtns = [
      document.getElementById('btnSaveThemeConfig'),
      document.getElementById('btnSaveThemeConfigSticky')
    ];
    const cancelBtns = [
      document.getElementById('btnCancelThemeChanges'),
      document.getElementById('btnCancelThemeChangesSticky')
    ];

    const badgeHtml = isDirty 
      ? '<span>🟡</span> Modifiche non salvate'
      : '<span>⚪</span> Nessuna modifica non salvata';

    if (badgeTop) {
      badgeTop.className = `badge-status-changes ${isDirty ? 'has-changes' : 'no-changes'}`;
      badgeTop.innerHTML = badgeHtml;
    }
    if (badgeSticky) {
      badgeSticky.className = `badge-status-changes ${isDirty ? 'has-changes' : 'no-changes'}`;
      badgeSticky.innerHTML = badgeHtml;
    }

    saveBtns.forEach(btn => {
      if (btn) {
        if (isDirty) btn.removeAttribute('disabled');
        else btn.setAttribute('disabled', 'disabled');
      }
    });

    cancelBtns.forEach(btn => {
      if (btn) {
        if (isDirty) btn.removeAttribute('disabled');
        else btn.setAttribute('disabled', 'disabled');
      }
    });
  },

  // Annulla Modifiche
  cancelChanges() {
    if (!this.isDirty) return;
    this.workingConfig = JSON.parse(JSON.stringify(this.initialConfig));
    this.renderPresets();
    this.renderAllFields();
    this.updatePreview();
    this.setDirty(false);
  },

  // Ripristina Default di Fabbrica
  async resetDefaults() {
    if (!confirm('Vuoi ripristinare il tema ai valori originali di fabbrica (ModernFCM Classic)? Le eventuali personalizzazioni verranno archiviate in backup.')) {
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('theme_admin_save.php?action=reset_theme_defaults', {
        method: 'POST',
        headers: headers
      });
      const data = await res.json();
      if (data && data.success) {
        alert('Tema ripristinato con successo ai valori originali di fabbrica!');
        this.initialConfig = data.defaultConfig;
        this.workingConfig = JSON.parse(JSON.stringify(data.defaultConfig));
        this.activePresetId = 'classic';
        this.renderPresets();
        this.renderAllFields();
        this.updatePreview();
        this.setDirty(false);

        // Rimuovi lo stile custom dalla pagina corrente e dal frame padre SPA
        this.applyThemeLiveToDocument(null);
      } else {
        alert('Errore durante il ripristino: ' + (data.error || 'Errore sconosciuto'));
      }
    } catch (e) {
      alert('Errore di comunicazione con il server: ' + e.message);
    }
  },

  // Applica dinamicamente i token salvati sia al documento corrente sia alla SPA padre (senza bisogno di F5)
  applyThemeLiveToDocument(cfg) {
    const docs = [document];
    try {
      if (window.top && window.top !== window && window.top.document) {
        docs.push(window.top.document);
      }
    } catch (e) {}

    docs.forEach(doc => {
      const existing = doc.getElementById('fcm-custom-theme');
      if (!cfg || !cfg.tokens) {
        if (existing) existing.remove();
        return;
      }
      const t = cfg.tokens;
      const rootRules = [];
      const lightRules = [];
      ['dark', 'accents', 'roles', 'ui'].forEach(group => {
        if (t[group]) {
          Object.entries(t[group]).forEach(([k, v]) => {
            if (k.startsWith('--') && v) rootRules.push(`  ${k}: ${v};`);
          });
        }
      });
      if (t.light) {
        Object.entries(t.light).forEach(([k, v]) => {
          if (k.startsWith('--') && v) lightRules.push(`  ${k}: ${v};`);
        });
      }
      let cssText = '';
      if (rootRules.length) {
        cssText += `:root,\n[data-theme="dark"] {\n${rootRules.join('\n')}\n}\n`;
      }
      if (lightRules.length) {
        cssText += `[data-theme="light"] {\n${lightRules.join('\n')}\n}\n`;
      }
      if (t.ui && t.ui['--font-family']) {
        cssText += `html, body {\n  font-family: var(--font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;\n}\n`;
        this.ensureGoogleFontLoaded((t.ui['--font-family'] || '').toLowerCase(), doc);
      }
      if (t.ui && t.ui['--font-size-base']) {
        cssText += `html {\n  font-size: var(--font-size-base, ${t.ui['--font-size-base']}) !important;\n}\n`;
      }
      let styleEl = existing;
      if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = 'fcm-custom-theme';
        doc.head.appendChild(styleEl);
      }
      styleEl.textContent = cssText;
    });
  },

  // Salva Configurazione
  async saveConfig() {
    const saveBtns = [
      document.getElementById('btnSaveThemeConfig'),
      document.getElementById('btnSaveThemeConfigSticky')
    ];
    saveBtns.forEach(btn => {
      if (btn) {
        btn.setAttribute('disabled', 'disabled');
        btn.innerHTML = '<span>⏳ Salvataggio...</span>';
      }
    });

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch('theme_admin_save.php?action=save_theme_config', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(this.workingConfig)
      });
      const data = await res.json();
      if (data && data.success) {
        this.applyThemeLiveToDocument(this.workingConfig);
        alert('Tema salvato con successo! Le nuove impostazioni grafiche sono ora attive su tutto il sito.');
        this.initialConfig = JSON.parse(JSON.stringify(this.workingConfig));
        this.setDirty(false);
      } else {
        alert('Errore durante il salvataggio: ' + (data.error || 'Errore sconosciuto'));
        this.setDirty(true);
      }
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
      this.setDirty(true);
    } finally {
      saveBtns.forEach(btn => {
        if (btn) {
          btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Salva Tema</span>
          `;
          if (this.isDirty) btn.removeAttribute('disabled');
        }
      });
    }
  },

  // Helper calcolo contrasto WCAG (Luminance)
  calculateContrastRatio(hex1, hex2) {
    const lum1 = this.getLuminance(hex1);
    const lum2 = this.getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },

  getLuminance(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;
    const a = [rgb.r, rgb.g, rgb.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length !== 6) return null;
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  },

  normalizeHexColor(val) {
    val = (val || '').trim();
    if (val.startsWith('#')) {
      if (val.length === 4) {
        return '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
      }
      if (val.length === 7) return val;
    }
    if (val.startsWith('rgba') || val.startsWith('rgb')) {
      const parts = val.match(/\d+/g);
      if (parts && parts.length >= 3) {
        const r = parseInt(parts[0], 10).toString(16).padStart(2, '0');
        const g = parseInt(parts[1], 10).toString(16).padStart(2, '0');
        const b = parseInt(parts[2], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '#2563eb';
  },

  isValidHex(hex) {
    return /^#([A-Fa-f0-9]{3}){1,2}$/.test(hex);
  },

  getContrastingTextColor(hex) {
    try {
      const lum = this.getLuminance(this.normalizeHexColor(hex));
      return lum > 0.4 ? '#0f172a' : '#ffffff';
    } catch (e) {
      return '#ffffff';
    }
  }
};

