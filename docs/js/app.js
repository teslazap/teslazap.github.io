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
    const d = await getJSON(`${API}geo.php?ip=${encodeURIComponent(ips.join(","))}`);
    return d.results || {};
  } catch { return {}; }
}
*/
async function geoMap(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}geo.php?ip=${encodeURIComponent(ips.join(","))}`);
    return d.results || {};
  } catch (e) { console.error("geo.php failed:", e); return {}; }
}

async function hostnames(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}hostname-lookup.php?ip=${encodeURIComponent(ips.join(","))}`);
    const list = Array.isArray(d.results) ? d.results : [d];
    return Object.fromEntries(list.map((r) => [r.ip, r.hostname]));
  } catch (e) { console.error("hostname-lookup.php failed:", e); return {}; }
}
/*
async function hostnames(ips) {
  if (!ips.length) return {};
  try {
    const d = await getJSON(`${API}hostname-lookup.php?ip=${encodeURIComponent(ips.join(","))}`);
    const list = Array.isArray(d.results) ? d.results : [d];
    return Object.fromEntries(list.map((r) => [r.ip, r.hostname]));
  } catch { return {}; }
}
*/
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
