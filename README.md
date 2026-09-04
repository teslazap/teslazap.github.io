# IP Inspector

A modern, static IP/connection inspector designed for GitHub Pages.

## Features

- Detects public **IPv4** and **IPv6** independently.
- Shows country, city, ISP/ASN, organization and timezone.
- Shows reverse hostname when the public IP intelligence provider has one.
- Shows a **proxy/VPN indicator** when the provider reports one.
- Includes a browser/platform indicator.
- Includes an **IP/domain RDAP lookup** (the modern, HTTP-based replacement for traditional WHOIS).
- No backend, build system or database.
- Works as a plain GitHub Pages static site.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload:
   - `index.html`
   - `style.css`
   - `app.js`
3. In GitHub, open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select your main branch and `/ (root)`.
6. Open the generated Pages URL.

## Important limitations

This site is intentionally static, so it cannot determine everything about the network path.

### IPv4 + IPv6

The browser does not expose a generic "my public IP" API. The site therefore asks two independent public services:

- `api4.ipify.org` for IPv4
- `api6.ipify.org` for IPv6

If one family is unavailable, the corresponding card reports it as unavailable.

### Proxy/VPN detection

A browser cannot reliably prove that a connection is using a proxy, VPN, CGNAT, Tor or another intermediary. The site displays the proxy indicator returned by the IP intelligence service. Treat it as an indicator, not a security-grade determination.

### Hostname

The displayed hostname is whatever the IP intelligence service returns. A browser cannot perform unrestricted reverse DNS by itself.

### WHOIS

Traditional WHOIS is a TCP protocol and cannot be performed directly from a normal browser. The lookup tool therefore uses **RDAP**, which is the web-friendly successor to WHOIS.

## External services

The static site sends public IP addresses to:

- ipify — public IP detection
- ipwho.is — IP/geolocation/connection intelligence
- rdap.org — RDAP lookup routing

No information is sent to a server operated by this project.

## Privacy

Because this application calls external services, those services necessarily receive the IP address being looked up. If you need complete control over logs and privacy, use a small backend under your own domain instead of the public APIs.

## Customization

All UI is plain HTML/CSS/JavaScript. No framework is required.

The easiest things to customize are:

- branding in `index.html`
- colors in `style.css` (`:root`)
- data providers and lookup logic in `app.js`
