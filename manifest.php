<?php
/**
 * PWA Web App Manifest Dinamico
 * Genera il manifest basandosi sul nome della lega presente in js/fcmLegaDati.js
 */

header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$fcmNomeLega = 'ModernFCM';
if (file_exists('js/fcmLegaDati.js')) {
    $legaContent = file_get_contents('js/fcmLegaDati.js');
    if (preg_match('/var\s+nomelega\s*=\s*["\'](.*?)["\']/i', $legaContent, $matches)) {
        $parsed = trim($matches[1]);
        if ($parsed !== '') {
            $fcmNomeLega = $parsed;
        }
    }
}

$manifest = [
    'name' => $fcmNomeLega . ' - ModernFCM',
    'short_name' => $fcmNomeLega,
    'description' => 'Skin ModernFCM per Fantacalcio Manager: classifica, calendario, formazioni, risultati e statistiche FCM.',
    'start_url' => 'index.php',
    'scope' => './',
    'display' => 'standalone',
    'orientation' => 'portrait-primary',
    'background_color' => '#0b1120',
    'theme_color' => '#0284c7',
    'icons' => [
        [
            'src' => 'img/icon-192.png',
            'sizes' => '192x192',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => 'img/icon-512.png',
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => 'img/logo.png',
            'sizes' => '1024x1024',
            'type' => 'image/png',
            'purpose' => 'any'
        ]
    ]
];

// Sincronizza manifest.json statico sul disco solo se non esiste o se il contenuto è cambiato
$jsonOutput = json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if (!file_exists('manifest.json') || @file_get_contents('manifest.json') !== $jsonOutput) {
    @file_put_contents('manifest.json', $jsonOutput);
}

echo $jsonOutput;
