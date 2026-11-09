<?php
/**
 * whois.php - RDAP lookup for one public IP address (no domains, no generic WHOIS)
 * GET /api/whois.php?ip=8.8.8.8
 */
declare(strict_types=1);

const ALLOWED_ORIGIN    = 'https://sixdev.org';
const RATE_LIMIT_MAX    = 10;     // requests...
const RATE_LIMIT_WINDOW = 60;     // ...per this many seconds, per client
const CACHE_SECONDS     = 3600;
const USER_AGENT        = 'sixdev-probe/1.0 (+https://sixdev.org)';

$TMP = dirname(__DIR__, 2) . '/tmp';   // inside the site tree (open_basedir)

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

// Fetch an RDAP URL, following redirects by hand (HTTPS only, never to an IP literal)
function rdap_get(string $url, int $hops = 4): ?array {
    for ($i = 0; $i <= $hops; $i++) {
        $p    = parse_url($url);
        $host = $p['host'] ?? '';
        if (($p['scheme'] ?? '') !== 'https' || $host === '' || filter_var(trim($host, '[]'), FILTER_VALIDATE_IP)) return null;

        $loc = null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT      => USER_AGENT,
            CURLOPT_HTTPHEADER     => ['Accept: application/rdap+json, application/json'],
            CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$loc) {
                if (stripos($line, 'location:') === 0) $loc = trim(substr($line, 9));
                return strlen($line);
            },
        ]);
        $raw  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 300 && $code < 400 && $loc) {
            if ($loc[0] === '/') $loc = 'https://' . $host . $loc;   // relative redirect
            $url = $loc;
            continue;
        }
        if ($code !== 200 || !is_string($raw)) {
            error_log("whois.php: $url -> HTTP $code");
            return null;
        }
        $d = json_decode($raw, true);
        return is_array($d) ? $d : null;
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'GET')     { out(['error' => 'Method not allowed. Use GET.'], 405); }

$ip = $_GET['ip'] ?? '';
if (!is_string($ip) || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    out(['error' => 'Not a public IP address'], 400);
}

// Serve cached answers first, so they do not use up the rate limit
$cache = $TMP . '/whois_' . md5($ip) . '.json';
if (is_file($cache) && time() - filemtime($cache) < CACHE_SECONDS) {
    readfile($cache);
    exit;
}

if (!rate_ok($TMP . '/whois_ratelimit', $_SERVER['REMOTE_ADDR'] ?? 'unknown', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)) {
    out(['error' => 'Too many requests. Please try again in a few seconds.'], 429);
}

// 1) rdap.org points to the registry that owns the address
$d = rdap_get('https://rdap.org/ip/' . $ip);

// 2) If that fails, ask the five registries directly (each redirects or answers 404 for foreign space)
if ($d === null) {
    foreach ([
        'https://rdap.db.ripe.net/ip/',
        'https://rdap.arin.net/registry/ip/',
        'https://rdap.apnic.net/ip/',
        'https://rdap.lacnic.net/rdap/ip/',
        'https://rdap.afrinic.net/rdap/ip/',
    ] as $base) {
        $d = rdap_get($base . $ip);
        if ($d !== null) break;
    }
}
if ($d === null) {
    out(['error' => 'Registry lookup failed'], 502);
}

$events = [];
foreach ($d['events'] ?? [] as $e) {
    $events[$e['eventAction'] ?? ''] = substr((string) ($e['eventDate'] ?? ''), 0, 10);
}

$contacts = [];
foreach ($d['entities'] ?? [] as $en) {
    $c = ['roles' => $en['roles'] ?? []];
    foreach ($en['vcardArray'][1] ?? [] as $p) {
        if (in_array($p[0] ?? '', ['fn', 'org', 'email'], true)) {
            $c[$p[0]] = is_array($p[3] ?? null) ? implode(' ', $p[3]) : (string) ($p[3] ?? '');
        }
    }
    if (count($c) > 1) $contacts[] = $c;
}

$cidr = null;
$c0 = $d['cidr0_cidrs'][0] ?? null;
if (is_array($c0)) {
    $cidr = ($c0['v4prefix'] ?? $c0['v6prefix'] ?? '') . '/' . ($c0['length'] ?? '');
}

$res = json_encode([
    'name'     => $d['name'] ?? null,
    'handle'   => $d['handle'] ?? null,
    'type'     => $d['type'] ?? null,
    'country'  => $d['country'] ?? null,
    'range'    => isset($d['startAddress']) ? $d['startAddress'] . ' - ' . ($d['endAddress'] ?? '') : null,
    'cidr'     => $cidr,
    'events'   => $events,
    'contacts' => $contacts,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

@file_put_contents($cache, $res);
echo $res;
