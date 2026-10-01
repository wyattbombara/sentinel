/* Runs before first paint: opt in to reveal animations only when JS is available. */
document.documentElement.classList.add('js');
if (!('IntersectionObserver' in window)) document.documentElement.classList.add('no-io');

// Fail open: if a script errors or never arrives, show everything rather than a blank page.
// .no-io is the "reveal all" switch; site.js sets Site.ready once its observers are running.
const revealAll = () => document.documentElement.classList.add('no-io');
addEventListener('error', (ev) => {
  // Runtime errors target window; failed loads target the element. A missing image is harmless.
  const failed = ev.target === window || /^(SCRIPT|LINK)$/.test(ev.target.tagName);
  if (failed && !(window.Site && window.Site.ready)) revealAll();
}, true);
setTimeout(() => { if (!(window.Site && window.Site.ready)) revealAll(); }, 3000);

// Installable web app. Service workers need HTTPS (or localhost in development).
const secureContext = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
// A static export ships no service worker, and may live under a subpath.
if ('serviceWorker' in navigator && secureContext && !window.SENTINEL_STATIC) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
