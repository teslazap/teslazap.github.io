"use strict";
// Server-side helpers live on the IPng server (CORS allows this site only)
const API = "https://www.ipng.za.net/api/";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function getJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Plain-text fetch with timeout, for the address-echo endpoints
async function getText(url, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return (await r.text()).trim();
  } finally { clearTimeout(t); }
}

// v4.ipng.za.net has only an A record, v6.ipng.za.net only an AAAA record.
// The answer must look like an address of the expected family, otherwise it is ignored.
const ownIp = (host, fam) => getText(`https://${host}/api/myip.php`)
  .then((s) => (/^[0-9a-f.:]{2,45}$/i.test(s) && (fam === 6 ? s.includes(":") : !s.includes(":")) ? s : null))
  .catch(() => null);
/*
async function geoMap(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}where.php?ip=${encodeURIComponent(ips.join(","))}`);
    return d.results || {};
  } catch { return {}; }
}
*/
async function geoMap(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}where.php?ip=${encodeURIComponent(ips.join(","))}`);
    return d.results || {};
  } catch (e) { console.error("where.php failed:", e); return {}; }
}

async function hostnames(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}hostname-lookup.php?ip=${encodeURIComponent(ips.join(","))}`);
    const list = Array.isArray(d.results) ? d.results : [d];
    return Object.fromEntries(list.map((r) => [r.ip, r.hostname]));
  } catch (e) { console.error("hostname-lookup.php failed:", e); return {}; }
}

// Expand an IPv6 address into eight 16-bit integers (null if invalid)
function ipv6Groups(ip) {
  ip = ip.split("%")[0].toLowerCase();
  if (!/^[0-9a-f:]+$/.test(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let g = head;
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    g = [...head, ...Array(missing).fill("0"), ...tail];
  }
  if (g.length !== 8 || !g.every((x) => /^[0-9a-f]{1,4}$/.test(x))) return null;
  return g.map((x) => parseInt(x, 16));
}

const hex2 = (n) => n.toString(16).padStart(2, "0");

// Describe the interface identifier (last 64 bits) of an IPv6 address
function iidInfo(ip) {
  const g = ipv6Groups(ip);
  if (!g) return null;
  const b = [];
  for (let i = 4; i < 8; i++) b.push(g[i] >> 8, g[i] & 0xff);

  // Modified EUI-64: ff:fe in the middle, U/L bit flipped
  if (b[3] === 0xff && b[4] === 0xfe) {
    const mac = [b[0] ^ 0x02, b[1], b[2], b[5], b[6], b[7]];
    if (!(mac[0] & 0x01)) {
      return {
        kind: "eui64",
        mac: mac.map(hex2).join(":").toUpperCase(),
        local: (mac[0] & 0x02) !== 0,
      };
    }
  }
  // Upper 48 bits of the ID all zero: typical of manual or DHCPv6 assignment
  if (g[4] === 0 && g[5] === 0 && g[6] === 0) return { kind: "low" };
  return { kind: "random" };
}

function iidText(ip) {
  const r = iidInfo(ip);
  if (!r) return null;
  if (r.kind === "eui64") {
    return `EUI-64, MAC ${r.mac}` +
      (r.local ? " (locally administered)" : "");
  }
  if (r.kind === "low") return "Low-numbered ID (manual or DHCPv6 assignment), no MAC embedded.";
  return "Randomized, no MAC embedded.";
}

function card(id, fam, ip, g, host) {
  const body = $(id).querySelector(".body");
  body.className = "body";
  if (!ip) { body.innerHTML = `<p class="none">No ${fam} connectivity detected from this browser.</p>`; return; }
  const cc = (g?.country_code || "").toLowerCase();
  const rows = [
    ["City", g?.city],
    ["Region", g?.region],
    ["Timezone", g?.timezone?.id],
    ["Coordinates", g?.latitude != null ? `${g.latitude.toFixed(2)}, ${g.longitude.toFixed(2)}` : null],
    ["ISP", g?.connection?.isp],
    ["ASN", g?.connection?.asn ? "AS" + g.connection.asn : null],
    ["Interface ID", fam === "IPv6" ? iidText(ip) : null],
    ["Hostname", host],
  ].filter((r) => r[1]);
  body.innerHTML =
    `<div class="head">` +
    (/^[a-z]{2}$/.test(cc) ? `<img class="flag" src="flags/${cc}.svg" alt="" onerror="this.style.visibility='hidden'">` : "") +
    `<div class="country">${esc(g?.country || "Location unavailable")}</div></div>` +
    `<div class="ip">${esc(ip)}</div>` +
    `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
    `<button type="button" data-whois="${esc(ip)}">WHOIS</button>`;
}

function verdict(g4, g6) {
  const el = $("verdict");
  el.hidden = true;
  el.className = "verdict";
  if (!g4?.country_code || !g6?.country_code) return;
  el.hidden = false;
  if (g4.country_code === g6.country_code) {
    el.textContent = `Both connections appear to come from ${g4.country}.`;
  } else {
    el.classList.add("diff");
    el.textContent = `Your IPv4 and IPv6 connections appear to come from different countries (${g4.country} and ${g6.country}). ` +
      "This can happen with IPv6 tunnel brokers, VPNs that handle only one protocol, or address databases that are out of date.";
  }
}

async function scan() {
  document.querySelectorAll(".fam .body").forEach((b) => { b.className = "body muted"; b.textContent = "Detecting..."; });
  $("verdict").hidden = true;
  const [ip4, ip6] = await Promise.all([ownIp("v4.ipng.za.net", 4), ownIp("v6.ipng.za.net", 6)]);
  const found = [ip4, ip6].filter(Boolean);
  const [geo, hn] = await Promise.all([geoMap(found), hostnames(found)]);
  const g4 = ip4 ? geo[ip4] : null;
  const g6 = ip6 ? geo[ip6] : null;
  card("c4", "IPv4", ip4, g4, hn[ip4]);
  card("c6", "IPv6", ip6, g6, hn[ip6]);
  verdict(g4, g6);
}

// WHOIS (RDAP) through the IPng server, shown in a dialog
async function whois(ip) {
  $("wt").textContent = "WHOIS " + ip;
  $("wb").innerHTML = '<p class="muted">Looking up...</p>';
  $("wd").showModal();
  try {
    const d = await getJSON(`${API}whois.php?ip=${encodeURIComponent(ip)}`, 12000);
    if (d.error) throw new Error(d.error);
    const rows = [
      ["Network name", d.name], ["Handle", d.handle], ["Range", d.range], ["CIDR", d.cidr],
      ["Country", d.country], ["Type", d.type],
      ["Registered", d.events?.registration], ["Last changed", d.events?.["last changed"]],
    ].filter((r) => r[1]);
    let h = `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;

    // MAC address embedded in an EUI-64 IPv6 address, with IEEE vendor
    if (d.mac) {
      const m = d.mac;
      const mr = [
        ["MAC address", m.address],
        ["Vendor", m.locally_administered ? "None (locally administered address)" : (m.vendor?.organization || "Not found in the IEEE registry")],
        ["Registry", m.vendor?.registry],
        ["Prefix", m.vendor?.prefix],
        ["Vendor address", m.vendor?.address],
      ].filter((r) => r[1]);
      h += `<h3>MAC address (IEEE)</h3><dl>${mr.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    }

    (d.contacts || []).forEach((c) => {
      const cr = [["Name", c.fn], ["Organization", c.org], ["Email", c.email]].filter((r) => r[1]);
      if (cr.length) h += `<h3>${esc((c.roles || ["contact"]).join(", "))}</h3><dl>${cr.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    });
    $("wb").innerHTML = h || '<p class="muted">No details returned.</p>';
  } catch (e) {
    $("wb").innerHTML = `<p class="err">Lookup failed: ${esc(e.message)}</p>`;
  }
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-whois]");
  if (b) whois(b.dataset.whois);
});
$("again").addEventListener("click", scan);
scan();
