/* Optional metadata for the pinned release; the release-page link always works. */
(() => {
  'use strict';
  const button = document.querySelector('[data-installer]');
  const meta = document.querySelector('[data-installer-meta]');
  if (!button || !meta) return;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

  fetch(`https://api.github.com/repos/${button.dataset.releases}/releases/tags/${encodeURIComponent(button.dataset.releaseTag)}`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((release) => {
      const asset = release && (release.assets || []).find((a) => a.name === 'Sentinel-Setup.exe');
      if (asset) {
        meta.innerHTML = `<span>Version ${esc(String(release.tag_name).replace(/^v/, ''))}</span><span>${mb(asset.size)}</span><span>Windows 10 &amp; 11, 64-bit</span>`;
        return;
      }
      // Missing assets or unavailable metadata must not disable the release page.
    })
    .catch(() => { /* Keep the pinned link and static version details when offline or rate-limited. */ });
})();
