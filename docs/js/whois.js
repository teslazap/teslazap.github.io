/* whois.js — interroga RDAP per IP o domini e mostra il risultato */

const form = document.getElementById('whois-form');
const input = document.getElementById('query');
const submitBtn = document.getElementById('submit-btn');
const resultBlock = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultSource = document.getElementById('result-source');
const statusLine = document.getElementById('status-line');
const manifest = document.getElementById('result-manifest');
const rawDetails = document.getElementById('raw-details');
const rawJson = document.getElementById('raw-json');

document.querySelectorAll('[data-example]').forEach(btn => {
  btn.addEventListener('click', () => {
    input.value = btn.dataset.example;
    form.requestSubmit();
  });
});

function classifyQuery(raw) {
  const q = raw.trim();
  if (isIPv4(q) || isIPv6(q)) return { type: 'ip', value: q };
  // dominio: lettere/numeri/trattini separati da punti, con un TLD alla fine
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(q)) {
    return { type: 'domain', value: q.toLowerCase() };
  }
  return null;
}

function row(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (value instanceof Node) dd.appendChild(value);
  else dd.textContent = value || '—';
  wrap.append(dt, dd);
  manifest.appendChild(wrap);
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function findEvent(events, action) {
  if (!Array.isArray(events)) return null;
  const ev = events.find(e => e.eventAction === action);
  return ev ? fmtDate(ev.eventDate) : null;
}

/** estrae un nome leggibile da un'entità RDAP (vcardArray o fn/handle come fallback) */
function entityName(entity) {
  if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
    const fn = entity.vcardArray[1].find(v => v[0] === 'fn');
    if (fn && fn[3]) return fn[3];
  }
  return entity.handle || null;
}

function findEntityByRole(entities, role) {
  if (!Array.isArray(entities)) return null;
  const e = entities.find(ent => Array.isArray(ent.roles) && ent.roles.includes(role));
  return e ? entityName(e) : null;
}

function renderDomain(data, query) {
  resultTitle.textContent = query;
  manifest.innerHTML = '';

  row('Stato', Array.isArray(data.status) && data.status.length ? data.status.join(', ') : '—');

  const registrar = findEntityByRole(data.entities, 'registrar');
  row('Registrar', registrar || '—');

  const registrant = findEntityByRole(data.entities, 'registrant');
  row('Intestatario', registrant || 'non pubblico (privacy/whois protetto)');

  row('Registrato il', findEvent(data.events, 'registration') || '—');
  row('Ultima modifica', findEvent(data.events, 'last changed') || '—');
  row('Scadenza', findEvent(data.events, 'expiration') || '—');

  if (Array.isArray(data.nameservers) && data.nameservers.length) {
    const list = document.createElement('span');
    list.textContent = data.nameservers.map(ns => ns.ldhName).filter(Boolean).join(', ');
    row('Name server', list);
  } else {
    row('Name server', '—');
  }

  row('DNSSEC', data.secureDNS && data.secureDNS.delegationSigned ? 'attivo' : 'non attivo / non indicato');
}

function renderIp(data, query) {
  resultTitle.textContent = query;
  manifest.innerHTML = '';

  row('Rete', data.name || '—');
  row('Intervallo', data.startAddress && data.endAddress ? `${data.startAddress} – ${data.endAddress}` : '—');
  row('Tipo di assegnazione', data.type || '—');
  row('Paese', data.country || '—');

  const org = findEntityByRole(data.entities, 'registrant') || findEntityByRole(data.entities, 'administrative');
  row('Organizzazione', org || '—');

  row('Stato', Array.isArray(data.status) && data.status.length ? data.status.join(', ') : '—');

  if (Array.isArray(data.entities)) {
    const abuse = data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('abuse'));
    if (abuse && Array.isArray(abuse.vcardArray?.[1])) {
      const email = abuse.vcardArray[1].find(v => v[0] === 'email');
      if (email && email[3]) row('Contatto abuse', email[3]);
    }
  }
}

async function runLookup(raw) {
  const parsed = classifyQuery(raw);
  resultBlock.hidden = false;
  manifest.innerHTML = '';
  rawDetails.hidden = true;
  resultSource.textContent = '';
  statusLine.className = 'status-line';

  if (!parsed) {
    resultTitle.textContent = raw || 'Interrogazione';
    statusLine.textContent = 'Non riconosco questo valore come indirizzo IP o come dominio. Controlla il formato e riprova.';
    statusLine.classList.add('err');
    return;
  }

  statusLine.textContent = `Interrogazione RDAP in corso per ${parsed.value}…`;
  submitBtn.disabled = true;
  submitBtn.textContent = 'attendere…';

  const rdapUrl = parsed.type === 'ip'
    ? `https://rdap.org/ip/${encodeURIComponent(parsed.value)}`
    : `https://rdap.org/domain/${encodeURIComponent(parsed.value)}`;

  try {
    const res = await fetchWithTimeout(rdapUrl, { headers: { Accept: 'application/rdap+json' } }, 10000);
    if (res.status === 404) {
      statusLine.textContent = parsed.type === 'domain'
        ? 'Nessuna registrazione trovata: il dominio potrebbe essere libero, oppure il suo registro non pubblica dati RDAP.'
        : 'Nessun record trovato per questo indirizzo IP.';
      statusLine.classList.add('err');
      return;
    }
    if (!res.ok) throw new Error(`risposta HTTP ${res.status}`);

    const data = await res.json();
    statusLine.textContent = '';
    resultSource.textContent = `via rdap.org · ${parsed.type === 'ip' ? 'lookup IP' : 'lookup dominio'}`;

    if (parsed.type === 'domain') renderDomain(data, parsed.value);
    else renderIp(data, parsed.value);

    rawJson.textContent = JSON.stringify(data, null, 2);
    rawDetails.hidden = false;
  } catch (err) {
    manifest.innerHTML = '';
    resultTitle.textContent = parsed.value;
    statusLine.classList.add('err');
    statusLine.innerHTML = `Impossibile completare la richiesta (${escapeHtml(err.message || 'errore di rete')}). ` +
      `Il registro competente potrebbe non consentire richieste dirette dal browser. ` +
      `Puoi provare ad aprire la stessa interrogazione su <a href="https://www.whois.com/whois/${encodeURIComponent(parsed.value)}" target="_blank" rel="noopener">whois.com</a>.`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Interroga';
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const val = input.value.trim();
  if (val) runLookup(val);
});
