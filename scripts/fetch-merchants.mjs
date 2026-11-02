// Fetches all merchants from the Strapi CMS and writes data/merchants.json
// Usage: KOKO_TOKEN=xxx node scripts/fetch-merchants.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = "https://cms.paykoko.com";
const TOKEN = process.env.KOKO_TOKEN;
const OUT = "data/merchants.json";
if (!TOKEN) { console.error("KOKO_TOKEN is not set"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(n, tries = 4) {
  const url = `${BASE}/api/merchant-webs?populate=*&pagination[pageSize]=100&pagination[page]=${n}`;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`Page ${n} attempt ${i} failed: ${e.message}`);
      if (i === tries) throw e;
      await sleep(1500 * i);
    }
  }
}

const abs = (u) => (!u ? null : u.startsWith("/") ? BASE + u : u);
const clean = (s) => (typeof s === "string" ? s.trim() : "") || null;
const kw = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

function normalize(m) {
  const tags = (m.tags || []).map((t) => clean(t.tag_name)).filter(Boolean);
  const cats = (m.campaign_merchant_categories || []).map((c) => clean(c.categoryName)).filter(Boolean);
  const types = (m.merchant_types || []).map((t) => clean(t.Type)).filter(Boolean);
  const keywords = [m.primaryKeyword, m.secondaryKeyword, m.tertiaryKeyword].flatMap(kw);
  const name = clean(m.merchantName) || `Merchant ${m.id}`;
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(m.merchantDiscount || "");
  return {
    id: m.id,
    name,
    discount: clean(m.merchantDiscount),
    discountPct: pct ? Number(pct[1]) : 0,
    discountNote: clean(m.merchantDiscountSecondTag),
    start: m.discountStartDate || null,
    end: m.discountEndDate || null,
    online: !!m.doesOnline,
    social: !!m.doesSocial,
    offline: !!m.doesOffline,
    siteUrl: clean(m.siteUrl),
    socialUrl: clean(m.socialUrl),
    types, tags, categories: cats,
    locations: (m.offlineLocations || []).map((l) => ({
      outlet: clean(l.outletName), address: clean(l.addressLine1),
      map: clean(l.mapLink), branch: clean(l.branch),
    })),
    logo: abs(m.rectBubbleUrl?.url ?? m.rectBubbleUrl?.formats?.thumbnail?.url),
    banner: abs(m.rectBannerUrl?.url ?? m.rectBannerUrl?.formats?.small?.url ?? m.rectBannerLink),
    updatedAt: m.updatedAt || null,
    search: [name, ...keywords, ...tags].join(" ").toLowerCase(),
  };
}

const first = await fetchPage(1);
const { pageCount, total } = first.meta.pagination;
console.log(`Expecting ${total} merchants over ${pageCount} pages`);
const raw = [...first.data];
for (let p = 2; p <= pageCount; p++) {
  await sleep(300);
  raw.push(...(await fetchPage(p)).data);
}

const merchants = [...new Map(raw.map((m) => [m.id, normalize(m)])).values()];

// safety check: never overwrite with a clearly broken result
let prev = 0;
try { prev = JSON.parse(await readFile(OUT, "utf8")).count || 0; } catch {}
if (merchants.length < total * 0.95 || (prev && merchants.length < prev * 0.8)) {
  console.error(`Aborting: got ${merchants.length}, expected ~${total}, previous ${prev}`);
  process.exit(1);
}

merchants.sort((a, b) => a.name.localeCompare(b.name));
await mkdir("data", { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: merchants.length, merchants }));
console.log(`Wrote ${merchants.length} merchants to ${OUT}`);
