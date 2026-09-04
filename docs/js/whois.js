/* whois.js — interroga RDAP per IP o domini e mostra il risultato come bento grid */

const form = document.getElementById('whois-form');
const input = document.getElementById('query');
const submitBtn = document.getElementById('submit-btn');
const resultBlock = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultSource = document.getElementById('result-source');
const statusLine = document.getElementById('status-line');
const bento = document.getElementById('result-bento');
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
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(q)) {
    return { type: 'domain', value: q.toLowerCase() };
  }
  return null;
}

function tile({ label, value, sub = '', span = 4, cat = 'identity', mono = false }) {
  const el = document.createElement('div');
  el.className = `tile tile--span-${span} is-ready`;
  el.dataset.cat = cat;
  el.innerHTML = `
    <p class="tile-label">${escapeHtml(label)}</p>
    <p class="tile-value${mono ? ' mono' : ''}">${value || '—'}</p>
    ${sub ? `<p class="tile-sub">${escapeHtml(sub)}</p>` : ''}
  `;
  bento.appendChild(el);
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
  bento.innerHTML = '';

  const status = Array.isArray(data.status) && data.status.length ? data.status.join(', ') : '—';
  tile({ label: 'Stato', value: escapeHtml(status), span: 4, cat: 'security', mono: true });

  const registrar = findEntityByRole(data.entities, 'registrar');
  tile({ label: 'Registrar', value: escapeHtml(registrar || '—'), span: 4, cat: 'identity' });

  const registrant = findEntityByRole(data.entities, 'registrant');
  tile({ label: 'Intestatario', value: escapeHtml(registrant || 'non pubblico (privacy/whois protetto)'), span: 4, cat: 'identity' });

  tile({ label: 'Registrato il', value: escapeHtml(findEvent(data.events, 'registration') || '—'), span: 4, cat: 'place', mono: true });
  tile({ label: 'Ultima modifica', value: escapeHtml(findEvent(data.events, 'last changed') || '—'), span: 4, cat: 'place', mono: true });
  tile({ label: 'Scadenza', value: escapeHtml(findEvent(data.events, 'expiration') || '—'), span: 4, cat: 'place', mono: true });

  const ns = Array.isArray(data.nameservers) ? data.nameservers.map(n => n.ldhName).filter(Boolean) : [];
  tile({ label: 'Name server', value: ns.length ? escapeHtml(ns.join(', ')) : '—', span: 8, cat: 'network', mono: true });

  tile({
    label: 'DNSSEC',
    value: data.secureDNS && data.secureDNS.delegationSigned ? 'attivo' : 'non attivo',
    span: 4, cat: 'network'
  });
}

function renderIp(data, query) {
  resultTitle.textContent = query;
  bento.innerHTML = '';

  tile({ label: 'Rete', value: escapeHtml(data.name || '—'), span: 4, cat: 'identity' });
  tile({
    label: 'Intervallo',
    value: data.startAddress && data.endAddress ? escapeHtml(`${data.startAddress} – ${data.endAddress}`) : '—',
    span: 8, cat: 'network', mono: true
  });
  tile({ label: 'Tipo di assegnazione', value: escapeHtml(data.type || '—'), span: 4, cat: 'network' });
  tile({ label: 'Paese', value: escapeHtml(data.country || '—'), span: 4, cat: 'place' });

  const org = findEntityByRole(data.entities, 'registrant') || findEntityByRole(data.entities, 'administrative');
  tile({ label: 'Organizzazione', value: escapeHtml(org || '—'), span: 4, cat: 'identity' });

  const status = Array.isArray(data.status) && data.status.length ? data.status.join(', ') : '—';
  tile({ label: 'Stato', value: escapeHtml(status), span: 6, cat: 'security', mono: true });

  let abuseEmail = null;
  if (Array.isArray(data.entities)) {
    const abuse = data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('abuse'));
    if (abuse && Array.isArray(abuse.vcardArray?.[1])) {
      const email = abuse.vcardArray[1].find(v => v[0] === 'email');
      if (email && email[3]) abuseEmail = email[3];
    }
  }
  tile({ label: 'Contatto abuse', value: escapeHtml(abuseEmail || '—'), span: 6, cat: 'security', mono: true });
}

async function runLookup(raw) {
  const parsed = classifyQuery(raw);
  resultBlock.hidden = false;
  bento.innerHTML = '';
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
    bento.innerHTML = '';
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
