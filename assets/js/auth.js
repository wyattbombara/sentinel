/* Sign-up and sign-in behaviour, shared by /signup and /login. */
window.Auth = (() => {
  'use strict';

  const { api, esc, qs } = window.Sentinel;

  function note(html, kind = 'error') {
    const el = document.getElementById('note');
    el.hidden = false;
    el.className = `form-note form-note--${kind}`;
    el.innerHTML = html;
  }

  function clearErrors() {
    document.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
    document.querySelectorAll('.field input').forEach((el) => el.removeAttribute('aria-invalid'));
    const el = document.getElementById('note');
    el.hidden = true;
  }

  function showFieldErrors(errors) {
    let first = null;
    for (const [field, message] of Object.entries(errors || {})) {
      const slot = document.getElementById(`error-${field}`);
      const input = document.getElementById(field);
      if (slot) slot.textContent = message;
      if (input) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
    }
    if (first) first.focus();
    return Boolean(first);
  }

  /** Where to land after a successful sign-in. */
  function destination() {
    const next = qs('next');
    if (next) {
      try {
        const url = new URL(next, location.href);
        const app = new URL('app.html', location.href);
        if (url.origin === app.origin && url.pathname === app.pathname) return url.href;
      } catch { /* use the default destination */ }
    }
    return qs('from') === 'extension' ? 'welcome.html' : 'app.html';
  }

  async function finish() {
    // Pass the session to the extension if it is installed, then move on.
    try { await window.Sentinel.pairExtension(); } catch { /* extension optional */ }
    location.href = destination();
  }

  async function setupGoogle() {
    const button = document.getElementById('google');
    let config = { googleEnabled: false };
    try { config = await api('/auth/config'); } catch { /* server unreachable */ }

    if (!config.googleEnabled) {
      button.disabled = true;
      button.title = 'Google sign-in is not configured on this server yet';
      button.insertAdjacentHTML('afterend',
        '<p class="small muted" style="margin:8px 0 0;text-align:center">Google sign-in is not configured on this server yet &mdash; use email below.</p>');
      return;
    }
    button.onclick = () => {
      const next = encodeURIComponent(destination());
      location.href = `/api/v1/auth/google/start?next=${next}`;
    };
  }

  function init(mode) {
    const form = document.getElementById('form');
    const submit = document.getElementById('submit');
    const label = submit.textContent;
    const plans = { free: ['Free', '$0'], pro: ['Pro', '$15/month'], max: ['Max', '$40/month'], ultimate: ['Ultimate', '$100/month'] };
    const selectedPlan = qs('plan');
    if (mode === 'signup' && Object.hasOwn(plans, selectedPlan)) {
      const selected = plans[selectedPlan];
      const summary = document.createElement('p');
      summary.className = 'form-note';
      summary.textContent = `${selected[0]} · ${selected[1]} — planned launch pricing. Subscriptions are not available yet.`;
      form.before(summary);
    }

    if (!window.SENTINEL_API_ENABLED) {
      note('Accounts are coming soon. Sign-up and sign-in are not available yet. <a href="app.html">Preview the dashboard</a>.', 'info');
      form.addEventListener('submit', (ev) => ev.preventDefault());
      return;
    }
    document.getElementById('authFields').disabled = false;
    document.getElementById('google').disabled = false;
    clearErrors();

    setupGoogle();

    const error = qs('error');
    if (error) note(`Google sign-in was cancelled or failed (<code>${esc(error)}</code>). Try again or use your email.`);
    if (qs('from') === 'extension') {
      note('Sign in here and the Sentinel extension will switch on automatically.', 'ok');
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (submit.disabled || !form.reportValidity()) return;
      clearErrors();

      const data = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span>' + (mode === 'signup' ? 'Creating account' : 'Signing in');

      try {
        await api(mode === 'signup' ? '/auth/signup' : '/auth/login', { method: 'POST', body: data });
        submit.innerHTML = 'Success ✓';
        await finish();
      } catch (err) {
        submit.disabled = false;
        submit.textContent = label;
        if (!showFieldErrors(err.errors)) note(esc(err.message));
      }
    });
  }

  return { init };
})();
