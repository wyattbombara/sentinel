/* A release link is exposed only when a real archive has been published. */
(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('downloads/latest.json', { signal: controller.signal });
    if (!response.ok) return;
    const info = await response.json();
    if (!info.available || !info.download || !info.version) return;
    const url = new URL(info.download, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.zip')) return;
    const archive = await fetch(url.href, { method: 'HEAD', signal: controller.signal });
    if (!archive.ok || (archive.headers.get('content-type') || '').includes('text/html')) return;
    const link = document.getElementById('dl');
    link.href = url.href;
    link.download = '';
    link.removeAttribute('aria-disabled');
    link.textContent = 'Download browser extension';
    document.getElementById('meta').textContent = `Version ${info.version}`;
    document.getElementById('installGuide').hidden = false;
  } catch { /* Keep the visible coming-soon message when no release is available. */ }
  finally { clearTimeout(timer); }
})();
