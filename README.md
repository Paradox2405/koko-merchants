# Koko Partner Merchants Directory: Search Koko BNPL Stores in Sri Lanka

A free, fast, searchable directory of merchants that accept **Koko** (Buy Now, Pay Later, "BNPL") in Sri Lanka. Find online stores, in-store outlets and social sellers that offer Koko, filter by category, and check current Koko discounts in one place.

**Live site:** https://paradox2405.github.io/koko-merchants/

## Why this exists

Koko works with over a thousand merchants, but there is currently no easy way to browse or search them all. This directory gathers the merchant list into one page so you can quickly answer questions like:

- Which stores accept Koko near me?
- Which fashion, electronics, fitness or grocery stores offer Koko?
- Which Koko merchants have an active discount right now?
- Does this shop accept Koko online, in-store, or through social media?

## Features

- Search by merchant name, keywords and tags
- Filter by tag, category and channel (online, in-store, social)
- "Active discounts only" filter that checks discount start and end dates
- Sort by name, highest discount, or recently updated
- Merchant details: discount value and validity, website and social links, and every outlet with a Google Maps link
- Mobile-first, lightweight and dark-mode friendly
- Shareable links: filters and searches are saved in the page URL

## Disclaimer

**This is an unofficial, independent project. It is not affiliated with, endorsed by, or sponsored by Koko or any listed merchant.**

- The directory is compiled from publicly available merchant information about stores that partner with Koko, gathered to make it easier for people to find them.
- "Koko" and all merchant names, logos and trademarks belong to their respective owners. They are used here only to identify the merchants.
- Merchant lists, discounts, validity dates and store locations change often. The data is refreshed about once a month, so it may be out of date or incomplete. **Always confirm a merchant's participation, discount and terms with the merchant or in the official Koko app before you buy.**
- The information is provided "as is" with no warranty of any kind. This site is not financial advice and does not process payments or hold any customer data.
- If you are a rights holder or merchant and want something corrected or removed, please open an issue in this repository.

## How it works

The site is static, with no server. A GitHub Actions workflow fetches the merchant data on the 1st of each month, or whenever you press "Run workflow", saves it as `data/merchants.json`, regenerates the crawlable pages, and commits the result. The API token is stored only as an encrypted GitHub secret and never appears in the site or the repository.

```
.
├─ index.html                      # the search app (build fills its seo: regions)
├─ assets/site.css                 # styles shared by all pages
├─ data/merchants.json             # generated data, do not edit by hand
├─ stores/, locations/             # generated product and city pages
├─ how-koko-works/, sitemap.xml    # generated guide and sitemap
├─ scripts/fetch-merchants.mjs     # fetch and clean script
├─ scripts/build-site.mjs          # page generator
└─ .github/workflows/refresh.yml   # monthly + manual refresh
```

## Run it yourself

1. Fork or clone this repo (keep it public for free GitHub Pages hosting).
2. Add a repository secret named `KOKO_TOKEN` (Settings → Secrets and variables → Actions).
3. Set Settings → Actions → General → Workflow permissions to "Read and write".
4. Run Actions → "Refresh merchants" → Run workflow.
5. Enable Settings → Pages → Deploy from branch → `main` / root.

To test locally: `KOKO_TOKEN=yourtoken node scripts/fetch-merchants.mjs` (optional, the data is committed), then `node scripts/build-site.mjs`, then `npx serve .` and open the printed address.

If you fork this or move it to a custom domain, change `BASE_URL` in `scripts/build-site.mjs` and rebuild.

Merchant logos and banners are off by default. To show them, set `SHOW_IMAGES = true` in `index.html` only after confirming you are allowed to display them.

## Frequently asked questions

**Is this the official Koko merchant list?**
No. It is an independent directory built from public information. Check the official Koko app for the authoritative list.

**How often is it updated?**
Monthly, plus manual refreshes when needed. The last update date is shown at the top of the page.

**A merchant is missing or wrong. What should I do?**
Open an issue here, and confirm the details with the merchant directly.

## Keywords

Koko merchants, Koko BNPL Sri Lanka, Koko partner stores, buy now pay later Sri Lanka, Koko discounts, Koko online stores, Koko in-store outlets, shops that accept Koko, Koko merchant list, Koko pay later.
