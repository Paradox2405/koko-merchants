# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An unofficial, static, searchable directory of merchants that accept Koko (BNPL) in Sri Lanka, hosted on GitHub Pages from `main` / root. There is no package.json, build step, framework, linter, or test suite.

## Commands

Run these from the repo root, because the script writes to a relative path (`data/merchants.json`).

```sh
# Serve the site locally (opening index.html via file:// won't work, it fetches the JSON)
npx serve .

# Regenerate pages from the committed data (no token needed; re-running without new data gives no diff)
node scripts/build-site.mjs

# Refresh the data (needs a CMS token; Node's built-in fetch, no dependencies)
KOKO_TOKEN=yourtoken node scripts/fetch-merchants.mjs        # bash
$env:KOKO_TOKEN='yourtoken'; node scripts/fetch-merchants.mjs # PowerShell
```

## Architecture

Data flows one way: Strapi CMS (`cms.paykoko.com`) → `scripts/fetch-merchants.mjs` → `data/merchants.json` → `scripts/build-site.mjs` (static pages) and `index.html` (search app in the browser). The token is only used by the script, and the site never calls the CMS.

- **`.github/workflows/refresh.yml`** runs both scripts monthly or on manual dispatch, using the `KOKO_TOKEN` secret, and commits the result as `merchant-bot` if it changed.
- **`scripts/fetch-merchants.mjs`** pages through the API, and `normalize()` maps raw CMS fields to the shape the frontend reads. It exits without writing if it gets under 95% of the API's reported total or under 80% of the previous count.
- **`scripts/build-site.mjs`** generates what search engines read: `stores/<slug>/` (curated `TAGS` map), `locations/<slug>/` (branches with at least `MIN_MERCHANTS` merchants), `how-koko-works/`, `sitemap.xml`, and the `<!-- seo:NAME:start/end -->` regions of `index.html`. `BASE_URL` sets the canonical domain.
- **`index.html`** is the search app, with its JS inline and CSS in `assets/site.css`. It loads the whole JSON once, then filters and sorts in memory (`apply()`) and renders 48 cards at a time (`more()`), replacing the pre-rendered cards.

## Things to know when changing code

- **Don't hand-edit generated output.** `stores/`, `locations/`, `how-koko-works/` and `sitemap.xml` are wiped and rewritten on each build, and so is anything between `seo:` markers in `index.html`. Edit `scripts/build-site.mjs` instead.
- **Don't hand-edit `data/merchants.json`.** It is generated, and it is a single ~3.9 MB line, so sample it (for example `head -c 800`) rather than reading it whole.
- **The frontend depends on the `normalize()` output.** Renaming or adding a field means changing both files. The change only reaches the data after the script is re-run.
- **Search matches a precomputed field.** `m.search` (name, keywords, tags) is built in the script, not the browser, so changing what is searchable also requires a data refresh.
- **Escape CMS values when rendering.** The UI is built from HTML template strings set via `innerHTML`, so CMS text must go through `esc()` and links through `safeUrl()`.
- **Filter state lives in the URL.** New text or select filters need adding to `FIELDS`; checkboxes (`act`, `img`) are handled separately in `readURL()`, `writeURL()`, and the reset handler.
- **`SHOW_IMAGES` stays `false`** unless permission to display merchant logos and banners has been confirmed. The data still includes the image URLs.
- **The root `merchants.json` is unused.** It is an empty placeholder; the site only reads `data/merchants.json`.
- **Hub categories come from `tags`, not `categories`.** `categories` holds campaign names such as "Birthday - Launchpad".
- **Static pages can't track the clock.** They judge discounts as active on the data's `generatedAt` date and state that date; keep output free of `Date.now()` so builds stay reproducible.
- **Guide facts need a source.** Check `how-koko-works` against paykoko.com (it needs a JS-capable browser) and update `GUIDE_CHECKED`. `koko.lk` is an unrelated travel site, so don't link it.
- **Keep the disclaimer.** The site must stay clearly unofficial and unaffiliated (footer and README).
