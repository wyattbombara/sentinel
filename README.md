<!-- built-from -->
> **This repository holds build output.** The site is generated from
> [zzilinct/Sentinel](https://github.com/zzilinct/Sentinel) (`web/`) by
> `scripts/publish-site.js`. Edit the source there; changes made here are
> overwritten on the next publish.

# Sentinel website

Static product preview. There is currently no API, account service, payment integration or downloadable extension in this repository.

To preview locally, run `python -m http.server 8765 --bind 127.0.0.1` from this directory, then open `http://127.0.0.1:8765/index.html`.

Run the dependency-free regression checks with `node --test tests/site.test.cjs` (Node 18 or later).

The original supplied logo is `assets/img/sentinel.png`. Navigation, browser icons, the manifest and every threat illustration use it. `assets/js/masks.js` adds severity cues: a normal yellow shield, angular orange details, and red horns. These variants are shared by the marketing demos, threat cards and dashboard verdicts.

`assets/js/config.js` keeps online features disabled until a backend is implemented. See [SERVER-REPORT.md](SERVER-REPORT.md) for the existing API expectations and outstanding work. Keep this disabled until the API is ready; toggling it does not create a backend.

Pricing: Free $0, Pro $15/month, Max $40/month, Ultimate $100/month. Ultimate includes every Max feature, uncapped live scanning hours, 500 researched link scans per week and 500 virus/malware scans per week. These are planned offerings, not enforced subscriptions.

For a future extension release, publish a ZIP in `downloads/`, then set `available`, `version` and a site-relative `download` URL in `downloads/latest.json`. The page only enables downloading after the archive responds successfully and is not an HTML fallback page.
