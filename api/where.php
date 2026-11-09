<?php
/**
 * where.php - country, city and ASN for one or two IP addresses (DB-IP Lite)
 * GET /api/geo.php?ip=1.2.3.4,2001:db8::1
 * Everything lives inside the site tree: web/ (this file), private/, tmp/
 */
declare(strict_types=1);

$SITE    = dirname(__DIR__, 2);        // site root, one level above web/
$PRIVATE = $SITE . '/private';
$TMP     = $SITE . '/tmp';

const ALLOWED_ORIGIN    = 'https://domain.tld';
const MAX_BATCH         = 2;
const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60;

// Pure-PHP reader, used only if the maxminddb extension is not loaded
spl_autoload_register(function (string $c) use ($PRIVATE): void {
    if (strncmp($c, 'MaxMind\\Db\\', 11) !== 0) return;
    $f = $PRIVATE . '/lib/' . str_replace('\\', '/', $c) . '.php';
    if (is_file($f)) require $f;
});

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: no-store');

function out(array $d, int $code = 200): void {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function rate_ok(string $dir, string $key, int $max, int $window): bool {
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $fp = @fopen($dir . '/' . preg_replace('/[^a-zA-Z0-9_.:-]/', '_', $key) . '.json', 'c+');
    if ($fp === false) return true;   // never block if tracking fails
    flock($fp, LOCK_EX);
    $d   = json_decode((string) stream_get_contents($fp), true);
    $now = time();
    $d   = array_values(array_filter(is_array($d) ? $d : [], fn ($t) => $t > $now - $window));
    $ok  = count($d) < $max;
    if ($ok) { $d[] = $now; ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($d)); }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'GET')     { out(['error' => 'Method not allowed. Use GET.'], 405); }
if (!rate_ok($TMP . '/geo_ratelimit', $_SERVER['REMOTE_ADDR'] ?? 'unknown', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)) {
    out(['error' => 'Too many requests. Please try again in a few seconds.'], 429);
}

$ips = array_values(array_filter(array_map('trim', explode(',', (string) ($_GET['ip'] ?? '')))));
if (!$ips || count($ips) > MAX_BATCH) out(['error' => 'Provide one or two addresses in "ip".'], 400);
foreach ($ips as $ip) {
    if (!filter_var($ip, FILTER_VALIDATE_IP)) out(['error' => 'Not a valid IP address: ' . $ip], 400);
}

try {
    $city = new MaxMind\Db\Reader($PRIVATE . '/geoip/dbip-city-lite.mmdb');
    $asnF = $PRIVATE . '/geoip/dbip-asn-lite.mmdb';
    $asn  = is_file($asnF) ? new MaxMind\Db\Reader($asnF) : null;
} catch (Throwable $e) {
    out(['error' => 'Geolocation database unavailable'], 503);
}

$results = [];
foreach ($ips as $ip) {
    $c = $city->get($ip) ?? [];
    $a = $asn ? ($asn->get($ip) ?? []) : [];
    $subs = array_filter(array_map(fn ($s) => $s['names']['en'] ?? null, $c['subdivisions'] ?? []));
    $results[$ip] = [
        'country_code' => $c['country']['iso_code'] ?? null,
        'country'      => $c['country']['names']['en'] ?? null,
        'city'         => $c['city']['names']['en'] ?? null,
        'region'       => $subs ? implode(', ', $subs) : null,
        'latitude'     => $c['location']['latitude'] ?? null,
        'longitude'    => $c['location']['longitude'] ?? null,
        'connection'   => [
            'asn' => $a['autonomous_system_number'] ?? null,
            'isp' => $a['autonomous_system_organization'] ?? null,
        ],
    ];
}
out(['results' => $results]);
