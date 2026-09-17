/* Shared helpers for every Sentinel page: API access, mask rendering, verdicts. */
window.Sentinel = (() => {
  'use strict';

  const API = '/api/v1';

  /* --------------------------------------------------------------- fetch */

  async function api(path, { method = 'GET', body } = {}) {
    if (!window.SENTINEL_API_ENABLED) {
      throw Object.assign(new Error('This feature is coming soon. Sentinel accounts and online services are not available yet.'), { code: 'service_unavailable' });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(API + path, {
        method,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: body ? JSON.stringify(body) : undefined
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }

      if (!res.ok) {
        const err = new Error((data && data.error && data.error.message) || `Request failed (${res.status})`);
        err.status = res.status;
        err.code = data && data.error && data.error.code;
        err.errors = (data && data.error && data.error.errors) || {};
        throw err;
      }
      if (res.status !== 204 && (!data || typeof data !== 'object')) {
        throw Object.assign(new Error('Sentinel could not load this feature. Please try again later.'), { code: 'invalid_response' });
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The request took too long. Please try again.');
      if (err instanceof TypeError) throw new Error('Could not reach Sentinel. Check your connection and try again.');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* ---------------------------------------------------------------- masks */

  const MASK_PATHS = `
    <path fill="currentColor" fill-rule="evenodd" d="M32 5c13.2 0 23 4.3 23 10.8 0 15.8-7.4 36.6-23 43.9C16.4 52.4 9 31.6 9 15.8 9 9.3 18.8 5 32 5Zm-9.8 20.4c-3 0-5.1 2-5.1 4.7s2.1 4.7 5.1 4.7 5.1-2 5.1-4.7-2.1-4.7-5.1-4.7Zm19.6 0c-3 0-5.1 2-5.1 4.7s2.1 4.7 5.1 4.7 5.1-2 5.1-4.7-2.1-4.7-5.1-4.7Z"/>
    <path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" d="M22.5 42.2c2.7 3.6 5.9 5.4 9.5 5.4s6.8-1.8 9.5-5.4"/>`;

  function mask(className = '') {
    return `<svg viewBox="0 0 64 64" class="${className}" aria-hidden="true">${MASK_PATHS}</svg>`;
  }

  const COLORS = { yellow: '#f5c542', orange: '#f08a24', red: '#e0413e', green: '#48b07a' };

  const LABELS = {
    yellow: 'Suspicious',
    orange: 'Likely scam',
    red: 'Confirmed scam'
  };

  function badge(tone, label) {
    return `<span class="mask-badge mask-badge--${tone}">${mask()}${label || LABELS[tone] || ''}</span>`;
  }

  /* ------------------------------------------------------------- verdicts */

  function verdictCard(verdict) {
    const tone = Object.hasOwn(COLORS, verdict.badge) ? verdict.badge : 'green';
    const color = COLORS[tone];
    const score = Number.isFinite(Number(verdict.score)) ? Math.max(0, Math.min(100, Number(verdict.score))) : 0;
    const reasons = (verdict.reasons || []).slice(0, 5);
    return `
      <div class="verdict-card">
        <div class="verdict-card__head">
          <span class="verdict-card__mask" style="color:${color}">${mask()}</span>
          <div>
            <div class="verdict-card__level" style="color:${color}">${esc(verdict.label)}</div>
            <div class="verdict-card__host">${esc(verdict.host || verdict.url || '')}</div>
          </div>
        </div>
        <div class="meter"><i style="width:${score}%;background:${color}"></i></div>
        <ul class="reasons">
          ${reasons.map((r) => `<li>${esc(r.text)}</li>`).join('') || '<li>Nothing suspicious about this address.</li>'}
        </ul>
        <p class="small muted" style="margin:14px 0 0">
          Risk score ${score}/100 &middot; checked against ${esc((verdict.sources || ['heuristics']).join(', ').replace(/_/g, ' '))}
        </p>
      </div>`;
  }

  /* ---------------------------------------------------------------- utils */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /** Header sign-in state, shared by the marketing pages. */
  async function paintHeader() {
    const slot = document.querySelector('[data-auth-slot]');
    if (!slot) return null;
    if (!window.SENTINEL_API_ENABLED) return null;
    try {
      const { user } = await api('/auth/me');
      if (!user) throw new Error('Not signed in');
      slot.innerHTML = `<a class="btn btn--sm btn--gold" href="app.html">Open Sentinel</a>`;
      return user;
    } catch {
      slot.innerHTML = `
        <a class="btn btn--sm btn--ghost" href="login.html">Sign in</a>
        <a class="btn btn--sm btn--gold" href="signup.html">Get Sentinel</a>`;
      return null;
    }
  }

  /**
   * Hand the freshly-signed-in session to the installed extension, so the user
   * does not have to sign in twice.
   */
  async function pairExtension() {
    const ids = (window.SENTINEL_EXTENSION_IDS || []).filter(Boolean);
    if (!ids.length || !window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return false;
    let token;
    try { ({ token } = await api('/auth/extension-token', { method: 'POST' })); } catch { return false; }

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 1500);
      let remaining = ids.length;
      let paired = false;
      for (const id of ids) {
        try {
          chrome.runtime.sendMessage(id, { type: 'sentinel:connect', token }, (res) => {
            void chrome.runtime.lastError;
            if (res && res.ok) paired = true;
            if (--remaining === 0) { clearTimeout(timer); resolve(paired); }
          });
        } catch {
          if (--remaining === 0) { clearTimeout(timer); resolve(paired); }
        }
      }
    });
  }

  return { api, mask, badge, verdictCard, esc, qs, paintHeader, pairExtension, COLORS, LABELS };
})();
