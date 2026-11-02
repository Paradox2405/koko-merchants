# Koko merchants directory
1. Push this folder to a **public** GitHub repo.
2. Settings > Secrets and variables > Actions > New secret: `KOKO_TOKEN` = your Strapi token.
3. Settings > Pages > Deploy from branch > `main` / root.
4. Actions > "Refresh merchants" > Run workflow (first fill). It then runs monthly on its own.
Local test: `KOKO_TOKEN=xxx node scripts/fetch-merchants.mjs` then `npx serve .`
