/* Funzioni condivise tra index.html e whois.html */

/** fetch con timeout, per non restare bloccati se un servizio non risponde */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** converte un codice paese ISO (es. "IT") in emoji bandiera */
function countryFlagEmoji(cc) {
  if (!cc || cc.length !== 2) return '';
  const base = 127397; // offset per lettere regionali unicode
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => c.charCodeAt(0) + base));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** riconosce se una stringa è un indirizzo IPv4 valido */
function isIPv4(str) {
  const m = str.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every(o => Number(o) >= 0 && Number(o) <= 255);
}

/** riconosce se una stringa è un indirizzo IPv6 valido (controllo semplice, non esaustivo) */
function isIPv6(str) {
  if (!str.includes(':')) return false;
  return /^[0-9a-fA-F:]+$/.test(str) && str.split(':').length >= 3;
}

/** espande un indirizzo IPv6 compresso (con ::) alla forma completa a 8 gruppi */
function expandIPv6(addr) {
  addr = addr.split('%')[0]; // rimuove eventuale zone id
  let [head, tail] = addr.includes('::') ? addr.split('::') : [addr, null];
  let headParts = head ? head.split(':').filter(Boolean) : [];
  let tailParts = tail ? tail.split(':').filter(Boolean) : [];
  if (tail !== null) {
    const missing = 8 - headParts.length - tailParts.length;
    headParts = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  }
  return headParts.map(g => g.padStart(4, '0'));
}

/** costruisce il nome PTR (in-addr.arpa / ip6.arpa) per una query DNS reverse */
function buildPtrName(ip) {
  if (isIPv4(ip)) {
    return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  }
  if (isIPv6(ip)) {
    const groups = expandIPv6(ip);
    const nibbles = groups.join('').split('').reverse().join('.');
    return nibbles + '.ip6.arpa';
  }
  return null;
}

/** risolve l'hostname (rDNS) di un IP tramite DNS-over-HTTPS di Google, CORS-friendly */
async function reverseDns(ip) {
  const name = buildPtrName(ip);
  if (!name) return null;
  try {
    const res = await fetchWithTimeout(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=PTR`,
      {}, 6000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Answer && data.Answer.length) {
      return data.Answer[0].data.replace(/\.$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/** marca la voce di navigazione corrente */
function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.pages a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.setAttribute('aria-current', 'page');
    }
  });
}
document.addEventListener('DOMContentLoaded', markActiveNav);
