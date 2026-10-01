<!-- built-from -->
> **This repository holds build output.** The site is generated from
> [zzilinct/Sentinel](https://github.com/zzilinct/Sentinel) (`web/`) by
> `scripts/publish-site.js`. Edit the source there; changes made here are
> overwritten on the next publish.

# Sentinel website

Static product preview. This export has no API, account service or payment integration. Website submissions do not scan links; the homepage examples use verdicts baked into `assets/js/static.js`.

To preview locally, run `python -m http.server 8765 --bind 127.0.0.1` from this directory, then open `http://127.0.0.1:8765/index.html`.

Run the dependency-free regression checks with `node --test tests/site.test.cjs` (Node 18 or later).

If the environment blocks the test runner from spawning a child process, run `node tests/site.test.cjs` instead. Both commands execute the same tests. Checks cover root and `/sentinel/` deployments, nested 404 recovery, fonts, manifest targets, preview submissions, homepage compatibility, severity controls, release metadata failures, script parsing and pricing.

The download page and preview notices link to [Sentinel v1.7.0](https://github.com/zzilinct/Sentinel/releases/tag/v1.7.0). `assets/js/download.js` optionally retrieves metadata for that tag; missing assets, rate limiting or offline requests leave the release-page link available.

Fonts and manifest URLs are relative to their files, so they work at the domain root and under the GitHub Pages `/sentinel/` path. The manifest opens the preview homepage and links to existing marketing pages. `404.html` sets a site-root base before loading assets, with a fallback for root-hosted local previews.

`assets/js/masks.js` provides shared SVG brand and threat glyphs. `site.js` supplies the navigation, reveals and an `IntersectionObserver` fallback; `home.js` uses that fallback for the hero and game as well as severity cards.

Pricing shown in the preview: Free $0, Pro $15/month, Max $40/month and Ultimate $100/month. This static website does not sell subscriptions or enforce quotas. [SERVER-REPORT.md](SERVER-REPORT.md) is an older backend-gap report, not a description of a running service in this export.
