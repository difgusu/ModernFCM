<?php
require_once __DIR__ . '/config.php';

function mercato_encrypt($valore, $chiave = MERCATO_KEY) {
    $ivLength = openssl_cipher_iv_length('aes-256-cbc');
    $iv = openssl_random_pseudo_bytes($ivLength);
    $encrypted = openssl_encrypt((string)$valore, 'aes-256-cbc', $chiave, 0, $iv);
    
    return [
        'cifrato' => base64_encode($encrypted),
        'iv'      => base64_encode($iv)
    ];
}

function mercato_decrypt($cifratoBase64, $ivBase64, $chiave = MERCATO_KEY) {
    if (empty($cifratoBase64) || empty($ivBase64)) return 0;
    
    $rawCipher = base64_decode($cifratoBase64);
    $rawIv = base64_decode($ivBase64);
    $decrypted = openssl_decrypt($rawCipher, 'aes-256-cbc', $chiave, 0, $rawIv);
    
    return ($decrypted !== false) ? (int)$decrypted : 0;
}
