# PROBE

A small, static page that shows how the Internet sees your **IPv4** and **IPv6** connections, side by side. Live at [sixdev.org](https://sixdev.org).

The page itself is plain HTML, CSS and JavaScript hosted on GitHub Pages. The lookups are done by a few small API endpoints on [ipng.za.net](https://www.ipng.za.net/), so visitors' addresses are not sent to public third-party lookup services.

## Features

- Detects the public **IPv4** and **IPv6** addresses independently, each on its own card.
- Shows country with flag, region, city, coordinates, ISP and ASN for each family.
- Warns when the IPv4 and IPv6 connections appear to come from different countries (IPv6 tunnel brokers, single-protocol VPNs, outdated databases).
- Shows the reverse DNS hostname (PTR record), when one is published.
- **WHOIS** button next to each address, using RDAP, the web-friendly successor of WHOIS. Lookups are limited to the visitor's own addresses.
- Light and dark theme following the system setting. No cookies, no accounts, no frameworks.

## How it works

The browser does not know its own public address, so the page asks the server.

| Endpoint | Purpose |
|---|---|
| `v4.ipng.za.net/api/myip.php` | Returns the caller's address. The hostname has only an `A` record, so it can only be reached over IPv4. |
| `v6.ipng.za.net/api/myip.php` | Same, but the hostname has only an `AAAA` record. |
| `www.ipng.za.net/api/where.php` | Country, region, city, ISP and ASN from a local DB-IP Lite database. |
| `www.ipng.za.net/api/hostname-lookup.php` | Reverse DNS (PTR) through DNS-over-HTTPS (Google, then Cloudflare). |
| `www.ipng.za.net/api/whois.php` | RDAP lookup of one public address (rdap.org, with the regional registries as fallback). |

All endpoints only accept requests from `https://sixdev.org`, and have per-client rate limits. The server-side code is not part of this repository.

If one address family is not available, its card says so instead of failing.

## Repository layout

```
index.html       page, styles and markup
js/app.js        scanning, rendering and the WHOIS dialog
favicon.svg      site icon
flags/           country flags (4x3 SVG) from flag-icons, with its LICENSE
CNAME            custom domain for GitHub Pages
```

## Deploy to GitHub Pages

1. Push the files above to the repository.
2. Open **Settings → Pages** and choose **Deploy from a branch**, then select your main branch and `/ (root)`.
3. Under **Custom domain** enter `sixdev.org` (this matches the `CNAME` file) and enable **Enforce HTTPS** once the certificate is ready.
4. In your DNS, create the `A` and `AAAA` records listed in GitHub's documentation for apex domains. Publish the `AAAA` records too, otherwise the site is reachable over IPv4 only.

Because the API only allows `https://sixdev.org`, a local preview or a `github.io` address will load the page but the lookups will be refused by the browser (CORS).

## Updating the flags

```
wget -O /tmp/flags.zip https://github.com/lipis/flag-icons/archive/refs/heads/main.zip
unzip -q /tmp/flags.zip 'flag-icons-main/flags/4x3/*' 'flag-icons-main/LICENSE' -d /tmp
cp /tmp/flag-icons-main/flags/4x3/*.svg flags/
cp /tmp/flag-icons-main/LICENSE flags/LICENSE
rm -rf /tmp/flags.zip /tmp/flag-icons-main
```

## Limitations

- **Geolocation is approximate.** The country is generally reliable, the city often is not, and the database may report a region where you would expect a province. Addresses of the same provider can land in different cities.
- **The database is refreshed manually**, so very recent address assignments may be missing or wrong.
- **IPv4 and IPv6 can disagree.** That is not necessarily a bug: it is a common result of tunnel brokers, VPNs and carrier-grade NAT.
- **Content blockers.** Some browser extensions block requests by file name. The geolocation endpoint is called `where.php` rather than something containing "geo" for this reason.
- **No proxy/VPN detection.** A browser cannot prove that a connection goes through a proxy, VPN or Tor, and the page does not claim to.

## Privacy

The page sets no cookies and has no analytics. When it runs, the visitor's IPv4 and IPv6 addresses are sent to the IPng.za.net API, which in turn asks public DNS resolvers (Google, Cloudflare) for the reverse hostname and the regional internet registries for WHOIS data. The usual web server access logs apply on that server.

## Credits

- IP geolocation by [DB-IP](https://db-ip.com) (DB-IP Lite database, attribution required).
- Flags from [flag-icons](https://github.com/lipis/flag-icons) (MIT).
- Reverse DNS and RDAP data come from the public DNS and the regional registries.

## Customization

Colors live in the `:root` block of the `<style>` section in `index.html` (with a dark variant under `prefers-color-scheme`). Endpoints are set at the top of `js/app.js` (`API`)
