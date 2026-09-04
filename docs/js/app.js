/* app.js — popola la pagina index.html con i dati della connessione corrente */

function setTile(name, html, { sub = null, error = false } = {}) {
  const tile = document.querySelector(`[data-tile="${name}"]`);
  if (!tile) return;
  const valueEl = tile.querySelector('.tile-value');
  valueEl.classList.remove('skeleton');
  valueEl.innerHTML = html;
  tile.classList.remove('is-error');
  tile.classList.add(error ? 'is-error' : 'is-ready');
  if (error) tile.classList.remove('is-ready');
  if (sub !== null) {
    const subEl = tile.querySelector('[data-role="sub"]');
    if (subEl) subEl.textContent = sub;
  }
}

function setBadge(name, state, label) {
  const el = document.querySelector(`[data-badge="${name}"]`);
  if (!el) return;
  el.classList.remove('ok', 'bad', 'unknown');
  el.classList.add(state);
  el.innerHTML = `<span class="led"></span>${label}`;
}

async function loadIPv4() {
  const heroEl = document.getElementById('ipv4-hero');
  try {
    const res = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 7000);
    if (!res.ok) throw new Error('risposta non valida');
    const { ip } = await res.json();
    heroEl.innerHTML = `${escapeHtml(ip)}<span class="cursor" aria-hidden="true"></span>`;
    return ip;
  } catch {
    heroEl.innerHTML = `non disponibile<span class="cursor" aria-hidden="true"></span>`;
    return null;
  }
}

async function loadIPv6() {
  const el = document.getElementById('ipv6-line');
  try {
    const res = await fetchWithTimeout('https://api6.ipify.org?format=json', {}, 5000);
    if (!res.ok) throw new Error('no v6');
    const { ip } = await res.json();
    if (ip && isIPv6(ip)) {
      el.innerHTML = `IPv6: <strong>${escapeHtml(ip)}</strong>`;
      return ip;
    }
    throw new Error('valore inatteso');
  } catch {
    el.innerHTML = `IPv6: <span class="warn">non rilevabile — la tua rete non instrada IPv6, o il browser sta usando solo IPv4</span>`;
    return null;
  }
}

async function loadGeoAndSecurity() {
  try {
    const res = await fetchWithTimeout('https://ipwho.is/', {}, 8000);
    if (!res.ok) throw new Error('risposta non valida');
    const data = await res.json();
    if (data.success === false) throw new Error(data.message || 'lookup fallito');

    const flag = countryFlagEmoji(data.country_code);
    setTile('country', `${flag ? `<span class="tile-flag">${flag}</span>` : ''}${escapeHtml(data.country || '—')}`, { sub: data.country_code || '' });
    setTile('city', escapeHtml([data.region, data.city].filter(Boolean).join(', ') || '—'));
    setTile('tz', escapeHtml(data.timezone?.id || '—'), { sub: data.timezone ? `UTC${data.timezone.utc || ''}` : '' });

    const conn = data.connection || {};
    setTile('isp', escapeHtml(conn.isp || conn.org || '—'), { sub: conn.org && conn.org !== conn.isp ? conn.org : '' });
    setTile('asn', conn.asn ? `AS${conn.asn}` : '—', { sub: conn.org || '' });

    const sec = data.security || {};
    setBadge('proxy', sec.proxy ? 'bad' : 'ok', sec.proxy ? 'proxy: rilevato' : 'proxy: non rilevato');
    setBadge('vpn', sec.vpn ? 'bad' : 'ok', sec.vpn ? 'vpn: rilevata' : 'vpn: non rilevata');
    setBadge('tor', sec.tor ? 'bad' : 'ok', sec.tor ? 'tor: rilevato' : 'tor: non rilevato');
    setBadge('hosting', sec.hosting ? 'bad' : 'ok', sec.hosting ? 'hosting/datacenter: sì' : 'hosting/datacenter: no');

    return data.ip || null;
  } catch {
    ['country', 'city', 'tz', 'isp', 'asn'].forEach(n => setTile(n, 'non disponibile', { error: true }));
    setBadge('proxy', 'unknown', 'proxy: sconosciuto');
    setBadge('vpn', 'unknown', 'vpn: sconosciuto');
    setBadge('tor', 'unknown', 'tor: sconosciuto');
    setBadge('hosting', 'unknown', 'hosting/datacenter: sconosciuto');
    return null;
  }
}

async function loadHostname(ip) {
  if (!ip) {
    setTile('hostname', 'non disponibile', { error: true });
    return;
  }
  const host = await reverseDns(ip);
  setTile('hostname', escapeHtml(host || 'nessun record PTR pubblicato'));
}

(async function init() {
  const [ipv4] = await Promise.all([loadIPv4(), loadIPv6()]);
  const geoIp = await loadGeoAndSecurity();
  await loadHostname(geoIp || ipv4);
})();
