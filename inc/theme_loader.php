<?php
/**
 * ModernFCM - Theme Loader & CSS Generator
 * File: inc/theme_loader.php
 * Gestisce il caricamento del tema personalizzato salvato dall'amministratore in inc/data/theme_config.json
 * ed effettua l'iniezione CSS server-side per azzerare qualsiasi effetto FOUC.
 */

if (!defined('FCM_THEME_LOADER_INCLUDED')) {
    define('FCM_THEME_LOADER_INCLUDED', true);

    /**
     * Restituisce la configurazione predefinita di fabbrica (ModernFCM Classic)
     */
    function fcm_get_default_theme_config() {
        return [
            'version' => 1,
            'lastUpdated' => 0,
            'defaultTheme' => 'system', // 'system' | 'dark' | 'light'
            'tokens' => [
                'dark' => [
                    '--bg-main' => '#0b1120',
                    '--bg-surface' => '#131d35',
                    '--bg-surface-elevated' => '#1a2747',
                    '--bg-surface-hover' => '#223259',
                    '--border-subtle' => 'rgba(255, 255, 255, 0.08)',
                    '--border-focus' => '#38bdf8',
                    '--text-primary' => '#f8fafc',
                    '--text-secondary' => '#94a3b8',
                    '--text-muted' => '#64748b'
                ],
                'light' => [
                    '--bg-main' => '#f1f5f9',
                    '--bg-surface' => '#ffffff',
                    '--bg-surface-elevated' => '#f8fafc',
                    '--bg-surface-hover' => '#eef2f6',
                    '--border-subtle' => '#cbd5e1',
                    '--border-focus' => '#38bdf8',
                    '--text-primary' => '#0f172a',
                    '--text-secondary' => '#334155',
                    '--text-muted' => '#64748b'
                ],
                'accents' => [
                    '--accent-primary' => '#2563eb',
                    '--accent-primary-hover' => '#1d4ed8',
                    '--accent-cyan' => '#06b6d4',
                    '--accent-gold' => '#f59e0b',
                    '--accent-emerald' => '#10b981',
                    '--accent-rose' => '#f43f5e',
                    '--accent-crimson' => '#ef4444',
                    '--accent-purple' => '#8b5cf6'
                ],
                'roles' => [
                    '--role-p' => '#f59e0b',
                    '--role-d' => '#10b981',
                    '--role-c' => '#06b6d4',
                    '--role-a' => '#f43f5e'
                ],
                'ui' => [
                    '--font-family' => "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    '--font-size-base' => '15px',
                    '--radius-sm' => '6px',
                    '--radius-md' => '10px',
                    '--radius-lg' => '16px'
                ]
            ]
        ];
    }

    /**
     * Carica il file JSON di configurazione del tema se presente
     */
    function fcm_get_active_theme_config() {
        static $cachedConfig = null;
        if ($cachedConfig !== null) {
            return $cachedConfig;
        }

        $filePath = __DIR__ . '/data/theme_config.json';
        if (file_exists($filePath)) {
            $raw = @file_get_contents($filePath);
            if ($raw) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['tokens']) && is_array($decoded['tokens'])) {
                    // Il file può arrivare da versioni precedenti o da modifiche a mano: i token
                    // finiscono in un blocco <style>, quindi restano solo variabili e valori validi
                    $decoded['tokens'] = fcm_filter_theme_tokens($decoded['tokens']);
                    if (empty($decoded['tokens']['ui']['--font-size-base'])) {
                        $decoded['tokens']['ui']['--font-size-base'] = '15px';
                    }
                    $cachedConfig = $decoded;
                    return $cachedConfig;
                }
            }
        }

        $cachedConfig = fcm_get_default_theme_config();
        return $cachedConfig;
    }

    /**
     * Sanitizza un valore CSS per prevenire CSS injection.
     * Restituisce una stringa vuota se il valore non può stare in sicurezza in una dichiarazione.
     */
    function fcm_sanitize_css_val($val) {
        if (!is_scalar($val)) {
            return '';
        }
        // Rimuove caratteri pericolosi per iniezioni di blocchi CSS
        $val = trim(str_replace(['{', '}', ';', '<', '>'], '', (string)$val));
        if ($val === '' || strlen($val) > 300) {
            return '';
        }
        // Solo i caratteri che servono a colori, misure e famiglie di font, con gli apici sempre
        // chiusi e le parentesi solo fuori dagli apici: restano fuori backslash (escape CSS), "@"
        // (at-rule), ":" (schemi URL), "*" (commenti) e caratteri di controllo
        $chars = 'A-Za-z0-9 #%.,\/+_-';
        if (!preg_match('/^(?:[()' . $chars . ']|\'[' . $chars . ']*\'|"[' . $chars . ']*")+\z/', $val)) {
            return '';
        }
        // Solo funzioni di colore e di calcolo: url(), image-set(), expression() e simili
        // caricherebbero risorse esterne o codice
        $allowedFunctions = [
            'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark',
            'var', 'calc', 'min', 'max', 'clamp',
            'linear-gradient', 'radial-gradient', 'conic-gradient',
            'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient'
        ];
        preg_match_all('/([a-z0-9_-]*)\(/i', $val, $functions);
        foreach ($functions[1] as $fn) {
            if ($fn !== '' && !in_array(strtolower($fn), $allowedFunctions, true)) {
                return '';
            }
        }
        // Parentesi bilanciate: una parentesi rimasta aperta inghiottirebbe le regole successive
        $depth = 0;
        $len = strlen($val);
        for ($i = 0; $i < $len; $i++) {
            if ($val[$i] === '(') {
                $depth++;
            } elseif ($val[$i] === ')' && --$depth < 0) {
                return '';
            }
        }
        return $depth === 0 ? $val : '';
    }

    /**
     * TRUE se $prop è una variabile CSS del tema prevista per quel gruppo: deve avere la forma di
     * una custom property ed essere tra i default. I nomi finiscono in un blocco <style>.
     */
    function fcm_is_theme_token($group, $prop) {
        if (!is_string($prop) || !preg_match('/^--[a-z0-9-]{1,40}\z/', $prop)) {
            return false;
        }
        $defaults = fcm_get_default_theme_config();
        return isset($defaults['tokens'][$group][$prop]);
    }

    /**
     * Tiene dei token di un tema solo le variabili previste con un valore CSS valido
     */
    function fcm_filter_theme_tokens($tokens) {
        $clean = [];
        foreach (['dark', 'light', 'accents', 'roles', 'ui'] as $group) {
            if (!isset($tokens[$group]) || !is_array($tokens[$group])) {
                continue;
            }
            foreach ($tokens[$group] as $prop => $val) {
                $val = fcm_sanitize_css_val($val);
                if ($val !== '' && fcm_is_theme_token($group, $prop)) {
                    $clean[$group][$prop] = $val;
                }
            }
        }
        return $clean;
    }

    /**
     * Genera il blocco <style id="fcm-custom-theme"> se la configurazione personalizzata esiste
     */
    function fcm_render_custom_theme_css() {
        $filePath = __DIR__ . '/data/theme_config.json';
        if (!file_exists($filePath)) {
            return '';
        }

        $config = fcm_get_active_theme_config();
        if (!$config || empty($config['tokens']) || !is_array($config['tokens'])) {
            return '';
        }

        // Token già filtrati da fcm_get_active_theme_config(): solo variabili previste e valori validi
        $tokens = $config['tokens'];
        $rootRules = [];
        $lightRules = [];

        // Dark tokens -> :root
        if (!empty($tokens['dark']) && is_array($tokens['dark'])) {
            foreach ($tokens['dark'] as $prop => $val) {
                if (strpos($prop, '--') === 0 && !empty($val)) {
                    $rootRules[] = '  ' . $prop . ': ' . fcm_sanitize_css_val($val) . ';';
                }
            }
        }

        // Accents -> :root
        if (!empty($tokens['accents']) && is_array($tokens['accents'])) {
            foreach ($tokens['accents'] as $prop => $val) {
                if (strpos($prop, '--') === 0 && !empty($val)) {
                    $rootRules[] = '  ' . $prop . ': ' . fcm_sanitize_css_val($val) . ';';
                }
            }
        }

        // Roles -> :root
        if (!empty($tokens['roles']) && is_array($tokens['roles'])) {
            foreach ($tokens['roles'] as $prop => $val) {
                if (strpos($prop, '--') === 0 && !empty($val)) {
                    $rootRules[] = '  ' . $prop . ': ' . fcm_sanitize_css_val($val) . ';';
                }
            }
        }

        // UI / Fonts / Radii -> :root
        if (!empty($tokens['ui']) && is_array($tokens['ui'])) {
            foreach ($tokens['ui'] as $prop => $val) {
                if (strpos($prop, '--') === 0 && !empty($val)) {
                    $rootRules[] = '  ' . $prop . ': ' . fcm_sanitize_css_val($val) . ';';
                }
            }
        }

        // Light tokens -> [data-theme="light"]
        if (!empty($tokens['light']) && is_array($tokens['light'])) {
            foreach ($tokens['light'] as $prop => $val) {
                if (strpos($prop, '--') === 0 && !empty($val)) {
                    $lightRules[] = '  ' . $prop . ': ' . fcm_sanitize_css_val($val) . ';';
                }
            }
        }

        if (empty($rootRules) && empty($lightRules)) {
            return '';
        }

        $fontLink = '';
        if (!empty($tokens['ui']['--font-family'])) {
            $fontVal = (string)$tokens['ui']['--font-family'];
            if (stripos($fontVal, 'Poppins') !== false) {
                $fontLink = "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap\">\n";
            } elseif (stripos($fontVal, 'Montserrat') !== false) {
                $fontLink = "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&display=swap\">\n";
            } elseif (stripos($fontVal, 'Inter') !== false) {
                $fontLink = "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap\">\n";
            } elseif (stripos($fontVal, 'Roboto') !== false) {
                $fontLink = "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap\">\n";
            }
        }

        $css = $fontLink . "<!-- ModernFCM Custom Theme Injection (Anti-FOUC) -->\n";
        $css .= "<style id=\"fcm-custom-theme\">\n";
        if (!empty($rootRules)) {
            $css .= ":root,\n[data-theme=\"dark\"] {\n" . implode("\n", $rootRules) . "\n}\n";
        }
        if (!empty($lightRules)) {
            $css .= "[data-theme=\"light\"] {\n" . implode("\n", $lightRules) . "\n}\n";
        }
        if (!empty($tokens['ui']['--font-family'])) {
            $css .= "html, body {\n  font-family: var(--font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;\n}\n";
        }
        if (!empty($tokens['ui']['--font-size-base'])) {
            $css .= "html {\n  font-size: var(--font-size-base, " . fcm_sanitize_css_val($tokens['ui']['--font-size-base']) . ") !important;\n}\n";
        }
        $css .= "</style>\n";

        return $css;
    }
}

