<?php
/**
 * ModernFCM - Endpoint Anteprima Guestbook
 * Restituisce gli ultimi messaggi pubblici in formato JSON.
 * Filtra e protegge indirizzi IP, email e messaggi privati.
 */

error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
header('Access-Control-Allow-Origin: *');

$logfile = __DIR__ . '/entries.txt';

if (!file_exists($logfile)) {
    echo json_encode([]);
    exit;
}

$lines = file($logfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
if (!$lines) {
    echo json_encode([]);
    exit;
}

$posts = [];
$limit = 10;
$guestbookTemplatePath = 'gbook182/templates/default/';

foreach ($lines as $line) {
    if (trim($line) === '') {
        continue;
    }
    $fields = explode("\t", $line);

    // Salta i messaggi privati (fields[6] == '1')
    $isPrivate = isset($fields[6]) ? trim($fields[6]) : '0';
    if ($isPrivate === '1') {
        continue;
    }

    $name = isset($fields[0]) && trim($fields[0]) !== '' ? trim($fields[0]) : 'Anonimo';
    $rawComment = isset($fields[4]) ? $fields[4] : '';
    $date = isset($fields[5]) ? trim($fields[5]) : '';

    // Risolvi il placeholder del template
    $comment = str_replace('##GBOOK_TEMPLATE##', $guestbookTemplatePath, $rawComment);

    $posts[] = [
        'name' => $name,
        'date' => $date,
        'comment' => $comment
    ];

    if (count($posts) >= $limit) {
        break;
    }
}

echo json_encode($posts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
