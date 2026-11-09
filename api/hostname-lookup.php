<?php
/**
 * 20260904 - v1 Initial release
 *
 * hostname-lookup.php
 * ---------------------------------------------------------------
 * Reverse-DNS endpoint: given one or more IPv4/IPv6 addresses,
 * returns the resolved hostname (PTR record), if published.
 *
 * Usage:
 *   GET /hostname-lookup.php?ip=8.8.8.8
 *   GET /hostname-lookup.php?ip=8.8.8.8,2001:4860:4860::8888
 *   (up to MAX_BATCH addresses)
 *
 * Response (single IP):
 *   {
 *     "ip": "8.8.8.8",
 *     "ip_version": 4,
 *     "ptr_query": "8.8.8.8.in-addr.arpa",
 *     "hostname": "dns.google",
 *     "resolved": true,
 *     "ttl": 300,
 *     "source": "doh:google"
 *   }
 *
 * Response (multiple IPs):
 *   {
 *     "results": [ {...}, {...} ]
 *   }
 *
 * Resolution strategy, in order:
 *   1. Google DNS-over-HTTPS  (dns.google/resolve)
 *   2. Cloudflare DNS-over-HTTPS (cloudflare-dns.com/dns-query)
 *
 * Both providers use cURL with an explicit, configurable timeout.
 *
 * The system resolver (gethostbyaddr) is intentionally not used:
 * it does not provide reliable control over the lookup timeout and
 * therefore could make this public endpoint hang unexpectedly.
 * ---------------------------------------------------------------
 */

declare(strict_types=1);


// ============================= CONFIGURATION =============================

// In production, replace '*' with your exact website origin,
// for example: 'https://example.com'.
const ALLOWED_ORIGIN = 'https://domain.tld';

const RATE_LIMIT_ENABLED = true;
const RATE_LIMIT_MAX     = 20;   // Maximum requests...
const RATE_LIMIT_WINDOW  = 60;   // ...within this many seconds.

const MAX_BATCH   = 2;           // Maximum IP addresses per request.
const DOH_TIMEOUT = 4;           // Timeout in seconds for each DoH query.


// ============================= NETWORK UTILITIES =============================

/**
 * Build the DNS reverse-lookup name for an IPv4 or IPv6 address.
 *
 * IPv4 uses:
 *   in-addr.arpa
 *
 * IPv6 uses:
 *   ip6.arpa
 *
 * inet_pton() is used for robust IPv6 parsing, including compressed
 * IPv6 notation.
 */
function ptr_name(string $ip): ?string
{
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $octets = explode('.', $ip);

        if (count($octets) !== 4) {
            return null;
        }

        return implode('.', array_reverse($octets)) . '.in-addr.arpa';
    }

    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $bin = @inet_pton($ip);

        if ($bin === false || strlen($bin) !== 16) {
            return null;
        }

        // Convert the IPv6 address to 32 hexadecimal characters.
        $hex = bin2hex($bin);

        // Reverse individual hexadecimal nibbles for ip6.arpa.
        $nibbles = array_reverse(str_split($hex));

        return implode('.', $nibbles) . '.ip6.arpa';
    }

    return null;
}


/**
 * Query a DNS-over-HTTPS provider for a PTR record.
 *
 * Returns:
 *   [
 *     'hostname' => string,
 *     'ttl'      => int|null
 *   ]
 *
 * Returns null if the query fails or no PTR record is found.
 */
function doh_lookup(
    string $endpoint,
    string $ptrName,
    int $timeoutSeconds
): ?array {
    if (!function_exists('curl_init')) {
        return null;
    }

    $url = $endpoint
        . '?name=' . rawurlencode($ptrName)
        . '&type=PTR';

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeoutSeconds,
        CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/dns-json'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => false,
    ]);

    $body   = curl_exec($ch);
    $errno  = curl_errno($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($errno !== 0 || $status !== 200 || $body === false) {
        return null;
    }

    $data = json_decode($body, true);

    if (
        !is_array($data) ||
        empty($data['Answer']) ||
        !is_array($data['Answer'])
    ) {
        return null;
    }

    foreach ($data['Answer'] as $answer) {
        // DNS type 12 = PTR.
        if (
            ($answer['type'] ?? null) === 12 &&
            !empty($answer['data'])
        ) {
            return [
                'hostname' => rtrim((string) $answer['data'], '.'),
                'ttl'      => isset($answer['TTL'])
                    ? (int) $answer['TTL']
                    : null,
            ];
        }
    }

    return null;
}


/**
 * Resolve a single IP address using the configured DoH providers.
 *
 * Google is tried first, followed by Cloudflare.
 *
 * No system resolver fallback is used, so every external lookup
 * remains subject to the configured timeout.
 */
function resolve_hostname(string $ip): array
{
    $version = filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_IPV4
    ) ? 4 : 6;

    $name = ptr_name($ip);

    if ($name === null) {
        return [
            'ip'         => $ip,
            'ip_version' => $version,
            'ptr_query'  => null,
            'hostname'   => null,
            'resolved'   => false,
            'ttl'        => null,
            'source'     => null,
            'note'       => 'Unable to construct a reverse-DNS query for this address.',
        ];
    }

    // ---------------------------------------------------------------------
    // 1. Google DNS-over-HTTPS
    // ---------------------------------------------------------------------

    $lookup = doh_lookup(
        'https://dns.google/resolve',
        $name,
        DOH_TIMEOUT
    );

    $source = $lookup !== null ? 'doh:google' : null;

    // ---------------------------------------------------------------------
    // 2. Cloudflare DNS-over-HTTPS
    // ---------------------------------------------------------------------

    if ($lookup === null) {
        $lookup = doh_lookup(
            'https://cloudflare-dns.com/dns-query',
            $name,
            DOH_TIMEOUT
        );

        if ($lookup !== null) {
            $source = 'doh:cloudflare';
        }
    }

    $hostname = $lookup['hostname'] ?? null;
    $ttl      = $lookup['ttl'] ?? null;

    $result = [
        'ip'         => $ip,
        'ip_version' => $version,
        'ptr_query'  => $name,
        'hostname'   => $hostname,
        'resolved'   => $hostname !== null,
        'ttl'        => $ttl,
        'source'     => $source,
    ];

    if ($hostname === null) {
        $result['note'] =
            'No PTR record was published for this address, or the configured DNS providers were unavailable.';
    }

    return $result;
}


// ============================= RATE LIMITING =============================

/**
 * Simple file-based rate limiter.
 *
 * This is intended to prevent the endpoint from being abused as
 * a public/free DNS lookup proxy.
 *
 * For high-traffic deployments, consider using Redis/Memcached
 * or enforcing rate limiting at the web-server level.
 */
function rate_limit_check(
    string $clientKey,
    int $maxRequests,
    int $windowSeconds
): bool {
    $dir = dirname(__DIR__, 2) . '/tmp/hostname_lookup_ratelimit';

    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }

    $safeKey = preg_replace(
        '/[^a-zA-Z0-9_.:-]/',
        '_',
        $clientKey
    );

    $file = $dir . '/' . $safeKey . '.json';

    $fp = @fopen($file, 'c+');

    if ($fp === false) {
        // If rate-limit tracking fails, do not block the request.
        return true;
    }

    flock($fp, LOCK_EX);

    $raw = stream_get_contents($fp);

    $data = json_decode((string) $raw, true);

    if (!is_array($data)) {
        $data = [];
    }

    $now = time();

    // Keep only timestamps inside the active rate-limit window.
    $data = array_values(
        array_filter(
            $data,
            static fn ($timestamp) =>
                $timestamp > $now - $windowSeconds
        )
    );

    $allowed = count($data) < $maxRequests;

    if ($allowed) {
        $data[] = $now;

        ftruncate($fp, 0);
        rewind($fp);

        fwrite(
            $fp,
            json_encode($data)
        );
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    return $allowed;
}


// ============================= REQUEST HANDLING =============================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';


// -----------------------------------------------------------------------------
// Handle CORS preflight requests.
// -----------------------------------------------------------------------------

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}


// -----------------------------------------------------------------------------
// Only GET requests are supported.
// -----------------------------------------------------------------------------

if ($method !== 'GET') {
    http_response_code(405);

    echo json_encode([
        'error' => 'Method not allowed. Use GET.'
    ]);

    exit;
}


// -----------------------------------------------------------------------------
// Rate limiting.
// -----------------------------------------------------------------------------

if (RATE_LIMIT_ENABLED) {
    $clientKey = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    if (!rate_limit_check(
        $clientKey,
        RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW
    )) {
        http_response_code(429);

        echo json_encode([
            'error' =>
                'Too many requests. Please try again in a few seconds.'
        ]);

        exit;
    }
}


// -----------------------------------------------------------------------------
// Read and validate the "ip" parameter.
// -----------------------------------------------------------------------------

$rawParam = trim(
    (string) ($_GET['ip'] ?? '')
);

if ($rawParam === '') {
    http_response_code(400);

    echo json_encode([
        'error' =>
            'Missing "ip" parameter. Example: ?ip=8.8.8.8'
    ]);

    exit;
}


// -----------------------------------------------------------------------------
// Split comma-separated IP addresses.
// -----------------------------------------------------------------------------

$ips = array_values(
    array_filter(
        array_map(
            'trim',
            explode(',', $rawParam)
        ),
        static fn ($value) => $value !== ''
    )
);

if (count($ips) === 0) {
    http_response_code(400);

    echo json_encode([
        'error' =>
            'No addresses were provided in the "ip" parameter.'
    ]);

    exit;
}


// -----------------------------------------------------------------------------
// Enforce maximum batch size.
// -----------------------------------------------------------------------------

if (count($ips) > MAX_BATCH) {
    http_response_code(400);

    echo json_encode([
        'error' =>
            'Too many addresses in a single request (maximum ' .
            MAX_BATCH .
            ').'
    ]);

    exit;
}


// -----------------------------------------------------------------------------
// Resolve all requested IP addresses.
// -----------------------------------------------------------------------------

$results = [];

foreach ($ips as $ip) {
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $results[] = [
            'ip'    => $ip,
            'error' => 'Not a valid IPv4 or IPv6 address.',
        ];

        continue;
    }

    $results[] = resolve_hostname($ip);
}


// -----------------------------------------------------------------------------
// Return JSON.
// -----------------------------------------------------------------------------

$jsonFlags =
    JSON_UNESCAPED_SLASHES |
    JSON_UNESCAPED_UNICODE;

if (count($results) === 1) {
    echo json_encode(
        $results[0],
        $jsonFlags
    );
} else {
    echo json_encode(
        ['results' => $results],
        $jsonFlags
    );
}
