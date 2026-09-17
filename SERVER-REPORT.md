# Sentinel: backend and release gaps

Reviewed September 17, 2026. The repository contains a static website; no server or API implementation exists. The rows below describe missing functionality and assumptions in the existing browser code, not defects verified against a running server.

## Missing API services

All existing API URLs begin with `/api/v1` and expect a backend on the website's origin.

| Feature | Existing endpoints | What is missing / user impact |
| --- | --- | --- |
| Email accounts | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | Account database, credential validation, password hashing and session management. No real accounts or sign-in can work. `/auth/me` must return `{ user }` or a 401, not a static HTML page. |
| Google sign-in | `GET /auth/config`, `GET /auth/google/start` | Provider registration, callback route, state validation and sessions. `/auth/config` expects `googleEnabled`. No callback handler exists in this repo. |
| Extension pairing | `POST /auth/extension-token` | Short-lived scoped token issuance and validation in the extension. Requires actual sign-in and extension origin allowlisting. |
| Activity and counts | `GET /stats` | Per-user event storage and aggregation. UI expects `flagged`, `counts.suspicious`, `counts.likely_scam`, `counts.confirmed_scam`, and `recent` records with host, level and timestamp. |
| Public threat metrics | `GET /threat-stats` | Threat feeds, ingestion jobs and verifiable aggregate counts. The prior homepage's 400,000 threats, 89 checks and 0% false alarms were hard-coded, not backed by this repository. Unsupported metrics were removed. |
| Link scans | `POST /scan` | Actual threat lookup, scoring and research service. UI sends `{ url, fresh: true }` and expects `{ verdict }`. A verdict needs a label, score, badge, host/url, reasons and sources. No link is currently inspected. |
| Scam reports | `POST /report` | Validation, abuse controls, persistent storage and review. UI sends a URL and `phishing` category. |
| Trusted/blocked sites | `GET /sites/overrides`, `POST /sites/override` | Per-user persistence and enforcement in the extension. Read expects `{ overrides }`; write sends `{ host, action }`, including `clear`. |
| AI provider list | `GET /ai/providers` | Provider configuration and connection state. UI expects provider IDs, names, model, vendor, accent, key/console URLs, and connected state. |
| AI connections | `POST /ai/connect`, `POST /ai/disconnect` | Credential validation, encrypted key storage, deletion and access controls. The existing page's encryption promise cannot be verified until this is built. |
| AI chat | `POST /ai/chat` | Server-side calls to the configured providers, authentication, limits and error handling. UI sends `{ provider, messages }`, expects `{ reply }`. No keys should be embedded in the static site. |

For API failures the existing client understands `{ error: { message, code, errors } }`, where `errors` maps form fields to messages. Return appropriate HTTP errors and JSON; never route `/api/*` to the marketing homepage. The client now rejects HTML fallback responses, times out stalled requests and does not call the API in preview mode.

## Billing and plan enforcement

There is no checkout, payment provider, subscription database, webhook handler, billing portal, cancellation flow or quota enforcement. These have no existing endpoint contract. The `?plan=` links previously had no visible effect; signup now shows the selected plan and clearly says subscriptions are unavailable. It does not purchase, provision or activate a plan.

| Plan | Monthly price | Live scanning | Researched link scans/week | File scans/week |
| --- | ---: | --- | ---: | ---: |
| Free | $0 | None | 10 basic link scans (no research) | 5 |
| Pro | $15 | 24 hours/week | 40 | 40 |
| Max | $40 | 96 hours/week | 100 | 100 |
| Ultimate | $100 | 24/7, no weekly hour cap | 500 | 500 |

Ultimate includes every Max feature. These limits are planned website offerings and need backend accounting before sale. Prices and entitlements must be chosen server-side; do not trust a browser-provided plan name or amount.

## Extension and desktop release gaps

- Neither `sentinel-chrome-latest.zip` (the old button target) nor `sentinel-companion-latest.zip` (the old metadata target) exists. They also described different products. The download page now shows an unavailable state and the release metadata no longer advertises a nonexistent build.
- `SENTINEL_EXTENSION_IDS` is empty. An actual published or development extension ID is needed for messaging. No extension manifest, source, release pipeline or message handlers are included in this repository.
- A ping response only proves the extension answered. The dashboard now says “Extension detected” rather than claiming protection is active.
- File analysis, email scanning, download monitoring and blocking malicious pages require the extension/desktop implementation as well as backend integrations. The dashboard currently only contains a link-check UI; file and email submission UIs also remain unimplemented.

## Other advertised features requiring implementation or verification

- Two-factor authentication, failed-login lockout, session/device listing and revocation are advertised on the homepage but have neither UI nor server handlers here.
- Research isolation, refusal to access private networks, threat-feed integration, domain/certificate inspection and file-fingerprint lookup need implementation. They cannot be verified from the static site.
- The privacy page describes addresses-only collection, while product copy describes email analysis and server-side page research. Decide the actual data flow and retention, then reconcile that copy before launch. Existing privacy and terms text has not been treated as evidence of an implemented backend.
- The AI connection copy promises encrypted key storage and implies API usage stays on a consumer chat plan. Verify provider-specific API billing and data handling before enabling it; no integration exists to establish those claims.
- Account recovery, email verification, account deletion and any support mailbox workflow are not implemented in the repo.
- API origin handling currently assumes the same host as the website. A separate API host would need deliberate client configuration, session and cross-origin handling. Static hosting alone cannot provide these endpoints.

## Website fixes included

- Installed the supplied PNG logo throughout brand headers, footers, welcome page, browser icons, social image reference and a real web manifest.
- Restored account forms, page headers, cards, typography, status messages, legal/download layouts and missing dashboard color variables. Scoped page navigation so the homepage's fixed-header rules no longer overlap it.
- Added responsive four-tier pricing, the requested prices and Ultimate benefits; selected-plan summaries are visible on signup.
- Fixed pricing links, mask-section links, the dead security-settings anchor and JavaScript navigation to absent extensionless pages. Font paths work from subdirectories.
- Disabled unavailable account submissions and API traffic by default. Dashboard preview and AI coming-soon dialog remain navigable. Downloads no longer point to missing files. Welcome URL parameters no longer claim successful pairing.
- Added mobile-menu state synchronization, Escape/outside-click dismissal, keyboard focus handling for the workspace dialog and a no-IntersectionObserver fallback. Reduced-motion users do not get repeating hero scans.
- Hardened API response handling, request timeouts, sign-in return destinations and verdict score rendering. Fixed removal of the last saved site, action failures, duplicate chat requests and ISO activity timestamps.

## Validation

Run `node --test tests/site.test.cjs` for local-link and fragment checks, JavaScript parsing, pricing assertions, preview API suppression, malformed API responses, timeout behavior and verdict escaping. Browser checks cover desktop/mobile layouts, signup and dashboard preview, navigation and workspace dismissal. Live authentication, billing, scanning, extension protection and AI integrations cannot be tested until they exist.
