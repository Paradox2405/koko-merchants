// Generates the crawlable pages from data/merchants.json. No dependencies, no token.
// Usage (from the repo root): node scripts/build-site.mjs
//
// Writes:  stores/<slug>/, locations/<slug>/, how-koko-works/, sitemap.xml
// Updates: the <!-- seo:NAME:start/end --> regions of index.html
//
// Output depends only on the data file (dates come from its generatedAt, never
// the clock), so re-running without new data produces no diff.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

const BASE_URL = "https://paradox2405.github.io/koko-merchants"; // no trailing slash
const SITE_NAME = "Koko Partner Merchants Directory (Unofficial)";
const MIN_MERCHANTS = 15; // hubs below this are too thin to publish
const MAX_LIST = 100; // merchants listed on one hub
const HOME_CARDS = 48; // matches PAGE in index.html
const MAX_OUTLETS = 3; // outlets shown per merchant on a city hub
const GUIDE_CHECKED = "2026-11-07"; // update when re-checking the guide against paykoko.com

const OFFICIAL_SITE = "https://www.paykoko.com/";
const APP_STORE = "https://apps.apple.com/lk/app/koko-buy-now-pay-later/id1568237541";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.sl.koko.bnpl";

// Tags people shop by. Left out on purpose: channel and promo tags (socialmedia,
// instore, ecommerce, shoplocal, arrivals, deals, featured_stores, alldeals) and
// "shoes", which would duplicate the footwear hub.
const TAGS = {
  fashion: ["fashion", "Fashion Stores"],
  electronics: ["electronics", "Electronics Stores"],
  women: ["for-women", "Stores for Women"],
  lifestyle: ["lifestyle", "Lifestyle Stores"],
  appliances: ["appliances", "Home Appliance Stores"],
  men: ["for-men", "Stores for Men"],
  mobile: ["mobile-phones", "Mobile Phone Shops"],
  beauty: ["beauty", "Beauty Stores"],
  health: ["health", "Health Stores"],
  cosmetics: ["cosmetics", "Cosmetics Stores"],
  automotive: ["automotive", "Automotive Stores"],
  kokofood: ["food", "Restaurants and Food Shops"],
  footwear: ["footwear", "Footwear and Shoe Stores"],
  travel: ["travel", "Travel Services"],
  kids: ["kids", "Kids' Stores"],
  toys: ["toys", "Toy Shops"],
  watches: ["watches", "Watch Shops"],
  sports: ["sports", "Sports Stores"],
  fitness: ["fitness", "Fitness Stores"],
  grocery: ["grocery", "Grocery Stores"],
  supplement: ["supplements", "Supplement Stores"],
  gaming: ["gaming", "Gaming Stores"],
  pets: ["pets", "Pet Stores"],
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const num = (n) => n.toLocaleString("en-US");
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const byName = (a, b) => a.name.localeCompare(b.name);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const chans = (m) => [m.offline && "In-store", m.online && "Online", m.social && "Social"].filter(Boolean);
const extLink = (href, text) => `<a href="${esc(href)}" target="_blank" rel="nofollow noopener">${esc(text)}</a>`;

const data = JSON.parse(await readFile("data/merchants.json", "utf8"));
const ALL = data.merchants || [];
if (!ALL.length || !data.generatedAt) { console.error("data/merchants.json has no merchants; nothing to build"); process.exit(1); }

const refTime = Date.parse(data.generatedAt);
const updated = fmtDate(data.generatedAt);
const lastmod = data.generatedAt.slice(0, 10);

// "Active" means on the data's date, not today's, because these pages stay static until the next refresh.
const isActive = (m) => !!m.discount && (!m.start || refTime >= Date.parse(m.start)) && (!m.end || refTime <= Date.parse(m.end) + 864e5 - 1);
const hasSite = (m) => !!safeUrl(m.siteUrl);
const score = (m) => (isActive(m) ? 4 : 0) + (hasSite(m) ? 2 : 0) + (m.locations.length ? 1 : 0);
const listable = (m) => !/^[\d\s+()-]+$/.test(m.name) && !/^Merchant \d+$/.test(m.name); // skip names that are just phone numbers or ids
const ranked = (ms) => ms.filter(listable).sort((a, b) => score(b) - score(a) || byName(a, b));

// ---------- hubs ----------
const branchKey = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const tagHubs = Object.entries(TAGS)
  .map(([tag, [slug, label]]) => ({
    kind: "tag", tag, slug, label, path: `stores/${slug}/`,
    filter: `?tag=${encodeURIComponent(tag)}`,
    members: ALL.filter((m) => m.tags.includes(tag)),
  }))
  .filter((h) => h.members.length >= MIN_MERCHANTS)
  .sort((a, b) => b.members.length - a.members.length);

const cities = new Map(); // branch key -> { members: Set, names: { spelling: count } }
for (const m of ALL) {
  for (const l of m.locations) {
    const key = branchKey(l.branch);
    if (!key) continue;
    const c = cities.get(key) || { members: new Set(), names: {} };
    c.members.add(m);
    c.names[l.branch.trim()] = (c.names[l.branch.trim()] || 0) + 1;
    cities.set(key, c);
  }
}
// The "Colombo" hub also covers the numbered areas, matching what ?loc=Colombo returns in the app.
const matchesCity = (key, branch) => (key === "colombo" ? /^colombo( \d+)?$/.test(branchKey(branch)) : branchKey(branch) === key);
const cityHubs = [...cities.entries()]
  .map(([key, c]) => {
    const name = Object.entries(c.names).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const members = key === "colombo" ? ALL.filter((m) => m.locations.some((l) => matchesCity(key, l.branch))) : [...c.members];
    return { kind: "city", key, name, slug: slugify(key), path: `locations/${slugify(key)}/`, filter: `?loc=${encodeURIComponent(name)}`, members };
  })
  .filter((h) => h.members.length >= MIN_MERCHANTS && h.slug)
  .sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));

for (const h of [...tagHubs, ...cityHubs]) h.set = new Set(h.members);
const hubText = (h) => (h.kind === "tag" ? h.label : `Koko shops in ${h.name}`);

// The hubs of `pool` that share the most merchants with `hub`.
function related(hub, pool, limit) {
  return pool
    .filter((o) => o !== hub)
    .map((o) => ({ hub: o, n: hub.members.reduce((c, m) => c + (o.set.has(m) ? 1 : 0), 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || hubText(a.hub).localeCompare(hubText(b.hub)))
    .slice(0, limit);
}

// ---------- shared markup ----------
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

function headMeta({ title, description, path, prefix = "", type = "website" }) {
  const url = `${BASE_URL}/${path}`;
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="en_LK">
<meta name="twitter:card" content="summary">`;
}

const breadcrumbs = (name, path) => jsonLd({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Koko shops in Sri Lanka", item: `${BASE_URL}/` },
    { "@type": "ListItem", position: 2, name, item: `${BASE_URL}/${path}` },
  ],
});

const DISCLAIMER = "Unofficial directory, not affiliated with Koko or any merchant. Discounts and locations change often, so confirm with the merchant or the Koko app before you buy.";

function footerNav(prefix) {
  const link = (h) => `<a href="${prefix}${h.path}">${esc(hubText(h))}</a>`;
  return `<nav class="foot-nav" aria-label="Browse the directory">
    <a href="${prefix}">All Koko shops</a>
    <a href="${prefix}how-koko-works/">How Koko works</a>
    ${tagHubs.slice(0, 6).map(link).join("\n    ")}
    ${cityHubs.slice(0, 6).map(link).join("\n    ")}
  </nav>`;
}

function page({ title, description, path, crumb, body }) {
  const prefix = "../".repeat(path.split("/").filter(Boolean).length);
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headMeta({ title, description, path, prefix })}
<link rel="stylesheet" href="${prefix}assets/site.css">
<script>try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch{}</script>
${breadcrumbs(crumb, path)}
</head>
<body>
<div class="wrap prose">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}">Koko shops in Sri Lanka</a> <span aria-hidden="true">›</span> ${esc(crumb)}</nav>
${body}
  <footer>
  ${footerNav(prefix)}
  <p>${DISCLAIMER}</p>
  </footer>
</div>
</body>
</html>
`;
}

// ---------- hub pages ----------
function merchantRow(m, hub) {
  const badge = isActive(m)
    ? ` <span class="badge">${esc(m.discount)}${m.end ? ` until ${esc(fmtDate(m.end))}` : ""}</span>`
    : "";
  const site = safeUrl(m.siteUrl);
  const tags = m.tags.filter((t) => TAGS[t]).slice(0, 4).map((t) => `<span class="chip">${esc(t === "kokofood" ? "food" : t)}</span>`).join("");
  let outlets = "";
  if (hub.kind === "city") {
    const seen = new Set();
    const here = m.locations.filter((l) => {
      if (!matchesCity(hub.key, l.branch)) return false;
      const addr = (l.address || l.outlet || l.branch).toLowerCase();
      if (seen.has(addr)) return false; // the CMS repeats some outlets
      seen.add(addr);
      return true;
    });
    const items = here.slice(0, MAX_OUTLETS).map((l) => {
      const map = safeUrl(l.map);
      return `<li>${esc(l.address || l.outlet || l.branch)}${map ? ` ${extLink(map, "Map")}` : ""}</li>`;
    }).join("");
    const extra = here.length > MAX_OUTLETS ? `<li>and ${here.length - MAX_OUTLETS} more</li>` : "";
    outlets = `<ul class="outlets">${items}${extra}</ul>`;
  }
  return `<li class="mcard">
      <div class="top">${logoTile(m)}<div><strong>${esc(m.name)}</strong>${badge}</div></div>
      <div class="meta">${chans(m).join(" · ")}${site ? ` · ${extLink(site, "Website")}` : ""}</div>
      ${outlets}${tags ? `<div class="chips">${tags}</div>` : ""}
    </li>`;
}

function hubPage(hub) {
  const n = hub.members.length;
  const online = hub.members.filter((m) => m.online).length;
  const offline = hub.members.filter((m) => m.offline).length;
  const social = hub.members.filter((m) => m.social).length;
  const active = hub.members.filter(isActive).length;
  const list = ranked(hub.members).slice(0, MAX_LIST);
  const prefix = "../../";
  const isTag = hub.kind === "tag";
  const phrase = isTag ? hub.label.toLowerCase() : `shops in ${hub.name}`;

  const h1 = isTag ? `${hub.label} That Accept Koko in Sri Lanka` : `Koko Shops in ${hub.name}`;
  const title = isTag ? `${h1} (${num(n)})` : `${h1}: ${plural(n, "Store")} That Accept Koko Pay`;
  const description = isTag
    ? `Browse ${num(n)} ${phrase} in Sri Lanka that accept Koko Pay, with ${num(online)} online and ${num(offline)} in-store. Unofficial directory, updated ${updated}.`
    : `Find ${plural(n, "merchant")} with outlets in ${hub.name} that accept Koko Pay, with addresses and map links. Unofficial directory, updated ${updated}.`;

  const relTags = related(hub, tagHubs, 6);
  const relCities = related(hub, cityHubs, 6);
  const relLinks = (rel) => rel.map((r) => `<a class="chip-link" href="${prefix}${r.hub.path}">${esc(r.hub.kind === "tag" ? r.hub.label : r.hub.name)} <span>${num(r.n)}</span></a>`).join("\n      ");
  const commonly = relTags.slice(0, 3).map((r) => r.hub.label.toLowerCase());

  const intro = isTag
    ? `The directory lists ${plural(n, "merchant")} under ${esc(phrase)} that accept Koko: ${num(online)} sell online, ${num(offline)} have in-store outlets and ${num(social)} sell through social media.${relCities.length ? ` Many have outlets in ${esc(relCities.slice(0, 3).map((r) => r.hub.name).join(", "))}.` : ""}`
    : `${plural(n, "merchant")} that accept Koko list an outlet in ${esc(hub.name)}.${commonly.length ? ` The most common types here are ${esc(commonly.join(", ").replace(/, ([^,]*)$/, " and $1"))}.` : ""} Addresses and map links are shown below.`;
  const discountLine = active ? ` ${plural(active, "listing")} had an active discount on that date.` : "";

  const body = `  <h1>${esc(h1)}</h1>
  <p class="lede">${intro}</p>
  <p class="sub">Data updated ${esc(updated)}.${discountLine} Koko splits a purchase into 3 instalments: <a href="${prefix}how-koko-works/">see how it works</a>. Confirm with the merchant or the Koko app before you buy.</p>
  <p><a class="cta" href="${prefix}${hub.filter}">Search and filter all ${esc(phrase)}</a></p>
  <h2>${list.length < n ? `${num(list.length)} of ${num(n)} merchants` : `All ${plural(n, "merchant")}`}</h2>
  <ul class="mlist">
    ${list.map((m) => merchantRow(m, hub)).join("\n    ")}
  </ul>
  ${relTags.length ? `<h2>${isTag ? "Related store types" : `What you can buy in ${esc(hub.name)}`}</h2>
  <div class="hub-links">
      ${relLinks(relTags)}
  </div>` : ""}
  ${relCities.length ? `<h2>${isTag ? `Where to find ${esc(phrase)}` : "Nearby and related locations"}</h2>
  <div class="hub-links">
      ${relLinks(relCities)}
  </div>` : ""}`;

  return page({ title, description, path: hub.path, crumb: isTag ? hub.label : hub.name, body });
}

// ---------- guide ----------
function guidePage() {
  const path = "how-koko-works/";
  const prefix = "../";
  const links = [...tagHubs.slice(0, 6), ...cityHubs.slice(0, 4)]
    .map((h) => `<a class="chip-link" href="${prefix}${h.path}">${esc(h.kind === "tag" ? h.label : h.name)}</a>`).join("\n    ");
  const body = `  <h1>How Koko Pay Works in Sri Lanka</h1>
  <p class="lede">Koko is a buy now, pay later service in Sri Lanka. It lets you split a purchase into 3 equal instalments over 60 days at 0% interest, online and in participating stores.</p>
  <p class="sub">This is an independent, unofficial guide based on <a href="${OFFICIAL_SITE}" rel="noopener">Koko's website</a> and terms, last checked on ${esc(fmtDate(GUIDE_CHECKED))}. Terms can change, so check the Koko app or website for the current version.</p>

  <h2>How to pay with Koko</h2>
  <ol>
    <li>Download the Koko app (<a href="${APP_STORE}" rel="noopener">App Store</a> or <a href="${PLAY_STORE}" rel="noopener">Google Play</a>).</li>
    <li><strong>Online:</strong> choose Koko as your payment method at checkout.</li>
    <li><strong>In-store:</strong> scan the merchant's QR code with the Koko app and tap to pay.</li>
    <li>Pay the first of 3 instalments at purchase, then the rest over 60 days.</li>
  </ol>
  <p>For example, a Rs. 9,000 purchase would split into 3 payments of Rs. 3,000 at 0% interest.</p>

  <h2>Koko Pay FAQ</h2>
  <h3>Does Koko charge interest or fees?</h3>
  <p>Koko advertises 0% interest and says there are "no admin fees, mark-ups or hidden charges". A fee can apply if you reschedule too often, as described below.</p>
  <h3>What happens if I can't pay on time?</h3>
  <p>Koko says each customer gets 2 free reschedules a year, and each one after that costs a flat Rs. 500, paid when you reschedule. A reschedule extends a payment by up to two weeks. You request it in the app, before the instalment's due date.</p>
  <h3>Can I use a debit card?</h3>
  <p>Yes. Koko says you can use a debit or credit card.</p>
  <h3>How much can I spend?</h3>
  <p>Koko evaluates each purchase rather than publishing a fixed limit. It says new customers have tighter limits, and that a longer history of successful repayments makes higher spending more likely.</p>
  <h3>How do refunds work?</h3>
  <p>Once the merchant starts a refund, Koko returns the money to the card you paid with. Koko says it takes 3 to 5 working days to reach your account.</p>
  <h3>Who can use Koko?</h3>
  <p>Koko's terms require you to be at least 18 years old. See <a href="${OFFICIAL_SITE}terms" rel="noopener">the full terms</a> for the other requirements.</p>

  <h2>Where can I use Koko?</h2>
  <p>This directory lists ${plural(ALL.length, "merchant")} that accept Koko, as of ${esc(updated)}. <a href="${prefix}">Search all Koko shops</a>, or start with one of these:</p>
  <div class="hub-links">
    ${links}
  </div>`;
  return page({
    title: "How Koko Pay Works in Sri Lanka: Fees and FAQ (Unofficial)",
    description: "An unofficial guide to Koko Pay in Sri Lanka: 3 instalments over 60 days at 0% interest, how to pay online and in-store, rescheduling fees, refunds and limits.",
    path,
    crumb: "How Koko works",
    body,
  });
}

// ---------- homepage ----------
function region(html, name, content) {
  const re = new RegExp(`(<!-- seo:${name}:start -->)[\\s\\S]*?(<!-- seo:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`index.html is missing the seo:${name} markers`);
  return html.replace(re, (_, a, b) => `${a}\n${content}\n${b}`);
}

// index.html owns the SHOW_IMAGES switch, so the static pages follow it too.
const SHOW_IMAGES = /const SHOW_IMAGES = true/.test(await readFile("index.html", "utf8"));

// Same markup as logoHTML() in index.html: logo, then banner, then the letter tile if neither exists or loads.
function logoTile(m) {
  const src = SHOW_IMAGES ? safeUrl(m.logo) || safeUrl(m.banner) : null;
  const img = src ? `<img ${safeUrl(m.logo) ? "" : 'class="fill" '}loading="lazy" alt="" src="${esc(src)}" onerror="this.remove()">` : "";
  return `<div class="logo" style="--h:${hue(m.name)}"><span>${esc(m.name.charAt(0).toUpperCase())}</span>${img}</div>`;
}

// Same markup as cardHTML() in index.html, but not clickable until the app takes over.
function homeCard(m) {
  const chips = m.tags.slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join("") + (m.tags.length > 3 ? `<span class="chip">+${m.tags.length - 3}</span>` : "");
  const badge = isActive(m) ? `<span class="badge">${esc(m.discount)}</span>` : "";
  return `<article class="card"><div class="top">${logoTile(m)}<div><div class="name">${esc(m.name)}</div>${badge}</div></div><div class="ch">${chans(m).map((c) => `<span class="pill">${c}</span>`).join("")}</div><div class="chips">${chips}</div></article>`;
}

async function buildHome() {
  const n = ALL.length;
  const rounded = num(Math.floor(n / 100) * 100);
  const online = ALL.filter((m) => m.online).length;
  const offline = ALL.filter((m) => m.offline).length;
  const social = ALL.filter((m) => m.social).length;
  const links = (hubs, text) => hubs.map((h) => `<a class="chip-link" href="${h.path}">${esc(text(h))} <span>${num(h.members.length)}</span></a>`).join("\n      ");

  let html = await readFile("index.html", "utf8");
  html = region(html, "head", `${headMeta({
    title: `Koko Pay Shops in Sri Lanka: ${rounded}+ Stores That Accept Koko`,
    description: `Search ${num(n)} shops in Sri Lanka that accept Koko Pay, online and in-store. Filter by product, city and discount. Unofficial directory, updated ${updated}.`,
    path: "",
  })}
${jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${BASE_URL}/`, inLanguage: "en" })}`);
  html = region(html, "updated", `${num(n)} stores that accept Koko. Updated ${esc(updated)}.`);
  html = region(html, "intro", `<p class="lede">Find shops in Sri Lanka that accept Koko buy now, pay later: ${num(online)} online, ${num(offline)} with in-store outlets and ${num(social)} on social media. This is an independent directory, not run by Koko. <a href="how-koko-works/">How Koko works</a>.</p>`);
  html = region(html, "grid", ranked(ALL).slice(0, HOME_CARDS).sort(byName).map(homeCard).join("\n"));
  html = region(html, "browse", `<section class="browse" aria-label="Browse the directory">
    <h2>Koko shops by product type</h2>
    <div class="hub-links">
      ${links(tagHubs, (h) => h.label)}
    </div>
    <h2>Koko shops by location</h2>
    <div class="hub-links">
      ${links(cityHubs, (h) => h.name)}
    </div>
    <h2>New to Koko?</h2>
    <p><a href="how-koko-works/">How Koko Pay works: instalments, fees and FAQ</a></p>
  </section>`);
  await writeFile("index.html", html);
}

// ---------- write everything ----------
for (const dir of ["stores", "locations", "how-koko-works"]) await rm(dir, { recursive: true, force: true });

async function writePage(path, html) {
  await mkdir(path, { recursive: true });
  await writeFile(`${path}index.html`, html);
}
for (const hub of [...tagHubs, ...cityHubs]) await writePage(hub.path, hubPage(hub));
await writePage("how-koko-works/", guidePage());
await buildHome();

const urls = [
  ["", lastmod],
  ["how-koko-works/", GUIDE_CHECKED],
  ...[...tagHubs, ...cityHubs].map((h) => [h.path, lastmod]),
];
await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([p, d]) => `  <url><loc>${esc(`${BASE_URL}/${p}`)}</loc><lastmod>${d}</lastmod></url>`).join("\n")}
</urlset>
`);

console.log(`Built ${tagHubs.length} product hubs, ${cityHubs.length} city hubs, 1 guide, ${urls.length} sitemap URLs`);
