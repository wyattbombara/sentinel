/* Runs before first paint: opt in to reveal animations only when JS is available. */
document.documentElement.classList.add('js');
if (!('IntersectionObserver' in window)) document.documentElement.classList.add('no-io');
// Failed or delayed scripts must never leave the page's content invisible.
window.sentinelRevealFallback = setTimeout(() => document.documentElement.classList.add('no-io'), 4000);
