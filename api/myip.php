<?php
// Returns the caller's address as plain text (served on the IPv4-only and IPv6-only hostnames)
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: https://domain.tld');
header('Cache-Control: no-store');

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
// Treat IPv4-mapped IPv6 (::ffff:a.b.c.d) as plain IPv4
if (preg_match('/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i', $ip, $m)) {
    $ip = $m[1];
}
if (!filter_var($ip, FILTER_VALIDATE_IP)) {
    http_response_code(500);
    exit;
}
echo $ip;
