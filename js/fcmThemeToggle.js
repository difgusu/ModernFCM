/**
 * ModernFCM - Gestore Unificato Tema Grafico per Pagine Esterne e Standalone
 * Gestisce la rotazione a 3 stati: Sistema (auto) -> Chiaro -> Scuro -> Sistema
 * e sincronizza lo stato tra schede, iframe (postMessage) e preferenze di sistema (prefers-color-scheme).
 */
(function() {
  'use strict';

  var fcmThemeToggle = {
    getSystemScheme: function() {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    },

    getPreference: function() {
      try {
        var pref = localStorage.getItem('pn_theme');
        if (pref === 'light' || pref === 'dark' || pref === 'system') return pref;
      } catch (e) {}
      return 'system';
    },

    getEffectiveTheme: function(preference) {
      if (preference === 'light' || preference === 'dark') {
        return preference;
      }
      return this.getSystemScheme();
    },

    getNextPreference: function(currentPref) {
      var isDark = this.getSystemScheme() === 'dark';
      // Ciclo a 3 stati: garantisce cambio visivo immediato al primo click da 'system'
      if (isDark) {
        if (currentPref === 'system') return 'light';
        if (currentPref === 'light') return 'dark';
        return 'system';
      } else {
        if (currentPref === 'system') return 'dark';
        if (currentPref === 'dark') return 'light';
        return 'system';
      }
    },

    applyTheme: function(preference, save) {
      if (preference !== 'light' && preference !== 'dark' && preference !== 'system') {
        preference = 'system';
      }

      if (save) {
        try {
          localStorage.setItem('pn_theme', preference);
        } catch (e) {}
      }

      var resolved = this.getEffectiveTheme(preference);
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.setAttribute('data-theme-preference', preference);

      try {
        document.cookie = 'pn_theme=' + resolved + ';path=/;max-age=31536000;SameSite=Lax';
      } catch (e) {}

      // Aggiorna UI del pulsante e dell'icona
      var themeBtn = document.getElementById('btnToggleTheme');
      var themeIcon = document.getElementById('themeIcon');

      if (themeIcon) {
        if (preference === 'system') {
          themeIcon.textContent = '🌓';
        } else if (preference === 'dark') {
          themeIcon.textContent = '🌙';
        } else {
          themeIcon.textContent = '☀️';
        }
      }

      if (themeBtn) {
        if (preference === 'system') {
          themeBtn.title = 'Tema: Sistema (auto - ' + (resolved === 'dark' ? 'scuro' : 'chiaro') + ')';
          themeBtn.setAttribute('aria-label', 'Tema: Sistema (automatico)');
        } else if (preference === 'dark') {
          themeBtn.title = 'Tema: Scuro';
          themeBtn.setAttribute('aria-label', 'Tema: Scuro');
        } else {
          themeBtn.title = 'Tema: Chiaro';
          themeBtn.setAttribute('aria-label', 'Tema: Chiaro');
        }
      }

      // Se in iframe all'interno della SPA, notifica il parent
      try {
        if (window.parent && window.parent !== window && save) {
          window.parent.postMessage({ type: 'pn_theme_change', theme: resolved, preference: preference }, '*');
        }
      } catch (e) {}
    },

    init: function() {
      var self = this;
      var initialPref = this.getPreference();
      this.applyTheme(initialPref, false);

      var themeBtn = document.getElementById('btnToggleTheme');
      if (themeBtn && !themeBtn.dataset.themeBound) {
        themeBtn.dataset.themeBound = '1';
        themeBtn.addEventListener('click', function(e) {
          e.preventDefault();
          var curr = self.getPreference();
          var next = self.getNextPreference(curr);
          self.applyTheme(next, true);
        });
      }

      // Reattivo ai cambiamenti delle preferenze OS di sistema
      if (window.matchMedia) {
        var mql = window.matchMedia('(prefers-color-scheme: dark)');
        var handleMediaChange = function() {
          if (self.getPreference() === 'system') {
            self.applyTheme('system', false);
          }
        };
        if (mql.addEventListener) {
          mql.addEventListener('change', handleMediaChange);
        } else if (mql.addListener) {
          mql.addListener(handleMediaChange);
        }
      }

      // Sincronizzazione automatica tra diverse schede del browser
      window.addEventListener('storage', function(e) {
        if (e.key === 'pn_theme') {
          self.applyTheme(e.newValue || 'system', false);
        }
      });

      // Sincronizzazione automatica tramite messaggi postMessage (es. da SPA principale)
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'pn_theme_change') {
          var pref = e.data.preference || e.data.theme || 'system';
          self.applyTheme(pref, false);
        }
      });

      // Observer per eventuali modifiche programmatiche di data-theme o data-theme-preference
      if (window.MutationObserver) {
        var observer = new MutationObserver(function(mutations) {
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            if (m.attributeName === 'data-theme' || m.attributeName === 'data-theme-preference') {
              var p = document.documentElement.getAttribute('data-theme-preference') || self.getPreference();
              var tIcon = document.getElementById('themeIcon');
              var tBtn = document.getElementById('btnToggleTheme');
              var res = document.documentElement.getAttribute('data-theme') || self.getEffectiveTheme(p);
              if (tIcon) {
                tIcon.textContent = (p === 'system') ? '🌓' : ((p === 'dark') ? '🌙' : '☀️');
              }
              if (tBtn) {
                if (p === 'system') {
                  tBtn.title = 'Tema: Sistema (auto - ' + (res === 'dark' ? 'scuro' : 'chiaro') + ')';
                } else {
                  tBtn.title = (p === 'dark') ? 'Tema: Scuro' : 'Tema: Chiaro';
                }
              }
              break;
            }
          }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-preference'] });
      }
    }
  };

  window.fcmThemeToggle = fcmThemeToggle;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      fcmThemeToggle.init();
    });
  } else {
    fcmThemeToggle.init();
  }
})();
