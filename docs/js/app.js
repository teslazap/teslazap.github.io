/* app.js — popola la pagina index.html con i dati della connessione corrente */

function setField(name, value, isError = false) {
  const el = document.querySelector(`[data-field="${name}"]`);
  if (!el) return;
  el.textContent = value;
  el.classList.remove('pending');
  if (isError) el.classList.add('err');
}

function setBadge(name, state, label) {
  // state: 'ok' (assente/negativo, buono), 'bad' (rilevato), 'unknown'
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
    setField('country', `${flag ? flag + ' ' : ''}${data.country || '—'} (${data.country_code || '—'})`);
    setField('city', [data.region, data.city].filter(Boolean).join(', ') || '—');
    setField('tz', data.timezone && data.timezone.id ? `${data.timezone.id} (UTC${data.timezone.utc || ''})` : '—');

    const conn = data.connection || {};
    setField('isp', conn.isp || conn.org || '—');
    setField('asn', conn.asn ? `AS${conn.asn}${conn.org ? ' — ' + conn.org : ''}` : '—');

    const sec = data.security || {};
    setBadge('proxy', sec.proxy ? 'bad' : 'ok', sec.proxy ? 'proxy: rilevato' : 'proxy: non rilevato');
    setBadge('vpn', sec.vpn ? 'bad' : 'ok', sec.vpn ? 'vpn: rilevata' : 'vpn: non rilevata');
    setBadge('tor', sec.tor ? 'bad' : 'ok', sec.tor ? 'tor: rilevato' : 'tor: non rilevato');
    setBadge('hosting', sec.hosting ? 'bad' : 'ok', sec.hosting ? 'hosting/datacenter: sì' : 'hosting/datacenter: no');

    return data.ip || null;
  } catch (e) {
    setField('country', 'non disponibile', true);
    setField('city', 'non disponibile', true);
    setField('tz', 'non disponibile', true);
    setField('isp', 'non disponibile', true);
    setField('asn', 'non disponibile', true);
    setBadge('proxy', 'unknown', 'proxy: sconosciuto');
    setBadge('vpn', 'unknown', 'vpn: sconosciuto');
    setBadge('tor', 'unknown', 'tor: sconosciuto');
    setBadge('hosting', 'unknown', 'hosting/datacenter: sconosciuto');
    return null;
  }
}

async function loadHostname(ip) {
  if (!ip) {
    setField('hostname', 'non disponibile (nessun IP da risolvere)', true);
    return;
  }
  const host = await reverseDns(ip);
  setField('hostname', host || 'nessun record PTR pubblicato per questo indirizzo');
}

(async function init() {
  const [ipv4] = await Promise.all([loadIPv4(), loadIPv6()]);
  const geoIp = await loadGeoAndSecurity();
  await loadHostname(geoIp || ipv4);
})();
