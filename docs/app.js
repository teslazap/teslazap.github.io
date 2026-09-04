const $ = (s) => document.querySelector(s);

const services = {
  ipv4: "https://api4.ipify.org?format=json",
  ipv6: "https://api6.ipify.org?format=json",
  geo: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`
};

async function json(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function escapeHTML(value) {
  return String(value ?? "—").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function value(v) {
  return v === null || v === undefined || v === "" ? "—" : v;
}

async function inspectIP(version) {
  const endpoint = services[version];
  try {
    const { ip } = await json(endpoint);
    const geo = await json(services.geo(ip));
    return { version, ip, geo };
  } catch (error) {
    return { version, error: error.message };
  }
}

function ipCard(result) {
  const label = result.version === "ipv4" ? "IPv4" : "IPv6";
  if (result.error) {
    return `<article class="card ip-card">
      <div class="card-head"><span>${label}</span><span class="pill">unavailable</span></div>
      <div class="ip-address">Not available</div>
      <div class="ip-meta">Your network/browser may not have ${label} connectivity.</div>
    </article>`;
  }
  const g = result.geo;
  const proxy = g.proxy?.proxy ? "Detected" : "Not detected";
  return `<article class="card ip-card">
    <div class="card-head"><span>${label}</span><span class="pill">${escapeHTML(g.type || "public")}</span></div>
    <div class="ip-address">${escapeHTML(result.ip)}</div>
    <div class="ip-meta">${escapeHTML(value(g.connection?.isp))}</div>
    <div class="ip-info">
      <div class="kv"><small>Country</small><span>${escapeHTML(value(g.country))} ${g.flag?.emoji || ""}</span></div>
      <div class="kv"><small>City</small><span>${escapeHTML(value(g.city))}</span></div>
      <div class="kv"><small>Hostname</small><span>${escapeHTML(value(g.hostname))}</span></div>
      <div class="kv"><small>Proxy / VPN</small><span>${escapeHTML(proxy)}</span></div>
    </div>
  </article>`;
}

async function refresh() {
  $("#ipGrid").innerHTML = `
    <article class="card ip-card loading"><div class="card-head"><span>IPv4</span><span class="pill">checking</span></div><div class="skeleton big"></div><div class="skeleton"></div></article>
    <article class="card ip-card loading"><div class="card-head"><span>IPv6</span><span class="pill">checking</span></div><div class="skeleton big"></div><div class="skeleton"></div></article>`;

  const results = await Promise.all([inspectIP("ipv4"), inspectIP("ipv6")]);
  $("#ipGrid").innerHTML = results.map(ipCard).join("");

  const available = results.filter(x => !x.error);
  const proxied = available.filter(x => x.geo.proxy?.proxy);
  const first = available[0]?.geo;
  const connectionTitle = proxied.length
    ? "Proxy / VPN indicator detected"
    : "Direct public connection";
  $("#connectionTitle").textContent = connectionTitle;
  $("#connectionText").textContent = proxied.length
    ? "The public IP intelligence service reports proxy infrastructure for at least one address. This is an indicator, not proof."
    : "No proxy indicator was returned for the detected public IPs.";

  $("#connectionIcon").textContent = proxied.length ? "!" : "✓";

  const details = [
    ["Detected IPs", `${available.length} / 2`],
    ["ISP / ASN", value(first?.connection?.isp) + (first?.connection?.asn ? ` · AS${first.connection.asn}` : "")],
    ["Country", value(first?.country)],
    ["Organization", value(first?.connection?.org)],
    ["Timezone", value(first?.timezone?.id)],
    ["Latitude", value(first?.latitude)],
    ["Longitude", value(first?.longitude)],
    ["Browser", navigator.userAgentData?.platform || navigator.platform || "Unknown"]
  ];
  $("#connectionDetails").innerHTML = details.map(([k,v]) =>
    `<div class="detail"><small>${escapeHTML(k)}</small><span>${escapeHTML(v)}</span></div>`
  ).join("");
}

function isIP(s) {
  // IPv4 or a basic IPv6 presence test. RDAP itself validates the value.
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s) || s.includes(":");
}

function flattenEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 8).map(e => {
    const action = e.eventAction || "event";
    return [action, e.eventDate || "—"];
  });
}

async function rdapLookup(query) {
  const result = $("#lookupResult");
  result.classList.remove("hidden");
  result.innerHTML = `<p>Looking up <strong>${escapeHTML(query)}</strong>…</p>`;
  try {
    let data;
    if (isIP(query)) {
      const url = `https://rdap.org/ip/${encodeURIComponent(query)}`;
      data = await json(url);
    } else {
      const url = `https://rdap.org/domain/${encodeURIComponent(query.toLowerCase())}`;
      data = await json(url);
    }

    const rows = [];
    rows.push(["Type", isIP(query) ? "IP address" : "Domain"]);
    rows.push(["Handle / Name", data.handle || data.ldhName || data.name || "—"]);
    rows.push(["Status", Array.isArray(data.status) ? data.status.join(", ") : (data.status || "—")]);

    if (data.startAddress) rows.push(["Network", `${data.startAddress} → ${data.endAddress || "—"}`]);
    if (data.country) rows.push(["Country", data.country]);
    if (data.port43) rows.push(["WHOIS server", data.port43]);
    if (data.entities?.length) {
      const roles = data.entities.flatMap(e => e.roles || []);
      if (roles.length) rows.push(["Roles", [...new Set(roles)].join(", ")]);
    }
    if (data.events?.length) {
      flattenEvents(data.events).forEach(([k,v]) => rows.push([k, v]));
    }
    if (data.nameservers?.length) {
      rows.push(["Nameservers", data.nameservers.map(n => n.ldhName || n.unicodeName).filter(Boolean).join(", ")]);
    }

    result.innerHTML = `
      <h3>RDAP result</h3>
      <div class="result-table">
        ${rows.map(([k,v]) => `<div class="key">${escapeHTML(k)}</div><div class="value">${escapeHTML(v)}</div>`).join("")}
      </div>`;
  } catch (error) {
    result.innerHTML = `<div class="error">
      Lookup failed. The RDAP registry may not support this object, may be temporarily unavailable,
      or your browser/network may block the request. <small>${escapeHTML(error.message)}</small>
    </div>`;
  }
}

$("#refreshBtn").addEventListener("click", refresh);
$("#lookupForm").addEventListener("submit", e => {
  e.preventDefault();
  rdapLookup($("#lookupInput").value.trim());
});

refresh();
