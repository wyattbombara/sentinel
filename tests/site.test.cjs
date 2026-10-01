const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const RELEASE = 'https://github.com/zzilinct/Sentinel/releases/tag/v1.7.0';
const BASES = ['https://sentinel.test/', 'https://sentinel.test/sentinel/'];

// Model only the DOM operations used by the marketing scripts. Initialization
// and event handlers run from the shipped files, not copies of their behavior.
class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.attributes = {};
    this.handlers = {};
    this.nodes = new Map();
    this.lists = new Map();
    this.textContent = '';
    this.style = { setProperty() {} };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, on = !classes.has(name)) { on ? classes.add(name) : classes.delete(name); return on; }
    };
  }
  set innerHTML(value) {
    this.html = value;
    for (const [selector, attr] of [['[data-answer]', 'answer'], ['.res', 'i']]) {
      const matches = [...value.matchAll(new RegExp(`data-${attr}="(\\d+)"`, 'g'))];
      this.lists.set(selector, matches.map(m => new Element({ [attr]: m[1] })));
    }
  }
  get innerHTML() { return this.html || ''; }
  querySelector(selector) {
    if (this.lists.has(selector)) return this.lists.get(selector)[0] || null;
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) { return this.lists.get(selector) || []; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); }
  async emit(name, event = {}) { for (const handler of this.handlers[name] || []) await handler({ preventDefault() {}, ...event }); }
  click() { return this.emit('click'); }
  focus() { this.focused = true; }
  appendChild(child) { this.child = child; }
}

function homepage({ noObserver = false, hero = false, game = false, reduced = false } = {}) {
  const timers = new Map();
  const timeouts = [];
  const observers = [];
  let sequence = 0;
  let requests = 0;
  const form = new Element();
  form.elements = { url: { value: 'https://example.com' } };
  const out = new Element();
  const stage = hero ? new Element() : null;
  const gameNode = game ? new Element() : null;
  const cards = ['scam', 'virus', 'malware'].map((threat, index) => {
    const card = new Element({ threat });
    card.querySelector('h3').textContent = threat;
    const buttons = ['yellow', 'orange', 'red'].map(sev => new Element({ sev }));
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === [2, 1, 0][index])));
    card.lists.set('[data-sev]', buttons);
    return card;
  });
  const nodes = new Map([
    ['[data-stage]', stage], ['[data-game]', gameNode],
    ['[data-try-form]', form], ['[data-try-out]', out]
  ]);
  const document = {
    body: new Element(), activeElement: { tagName: 'BODY' }, handlers: {},
    querySelector: selector => nodes.get(selector) || null,
    querySelectorAll: selector => selector === '[data-trio]' ? cards : [],
    createElement: () => new Element(),
    addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); }
  };
  const sandbox = {
    document, location: new URL(BASES[1]), navigator: { platform: 'Win32', userAgent: '' },
    matchMedia: () => ({ matches: reduced }), scrollY: 0, innerHeight: 800,
    requestAnimationFrame: callback => callback(), addEventListener() {},
    setTimeout: callback => { timeouts.push(callback); return timeouts.length; },
    setInterval: callback => { const id = ++sequence; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
    fetch: () => { requests++; throw new Error('Unexpected request from preview'); }
  };
  sandbox.window = sandbox;
  if (!noObserver) sandbox.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    unobserve() {}
    disconnect() {}
  };
  vm.createContext(sandbox);
  for (const name of ['static', 'masks', 'site', 'home']) vm.runInContext(read(`assets/js/${name}.js`), sandbox);
  return {
    sandbox, form, out, stage, game: gameNode, cards, timers,
    requests: () => requests,
    async tick() { for (const callback of [...timers.values()]) callback(); await Promise.resolve(); },
    visible(target, isIntersecting = true) {
      observers.filter(observer => observer.target === target).forEach(observer => observer.callback([{ target, isIntersecting }], observer));
    },
    async flush() {
      for (let i = 0; i < 100; i++) {
        timeouts.splice(0).forEach(callback => callback());
        await new Promise(resolve => setImmediate(resolve));
        if (!timeouts.length) return;
      }
      throw new Error('Preview timers did not settle');
    }
  };
}

function htmlBase(file, href) {
  const html = read(file);
  const match = html.match(/<base href="([^"]+)"/);
  if (!match) return new URL('.', href);
  const base = { href: new URL(match[1], href).href };
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(inline, { document: { querySelector: () => base }, URL, location: new URL(href) });
  return new URL(base.href, href);
}

function assertLocal(value, base, siteRoot) {
  const url = new URL(value, base);
  assert.equal(url.origin, new URL(siteRoot).origin);
  assert.ok(url.pathname.startsWith(new URL(siteRoot).pathname), `${value} escapes ${siteRoot}`);
  const target = decodeURIComponent(url.pathname.slice(new URL(siteRoot).pathname.length)) || 'index.html';
  assert.ok(fs.existsSync(path.join(root, target)), `Missing ${target} from ${base}`);
  if (url.hash && target.endsWith('.html')) assert.ok(read(target).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing fragment ${value}`);
}

test('all HTML links, fragments and assets resolve at root and under /sentinel/', () => {
  for (const siteRoot of BASES) for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${file}`);
    const base = htmlBase(file, new URL(file, siteRoot).href);
    for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|data:)/.test(value) || value === '/sentinel/') continue;
      assertLocal(value, base, siteRoot);
    }
  }
});

test('nested 404s load assets and recover to the actual site home', () => {
  for (const siteRoot of BASES) for (const missing of ['missing/page', 'missing/deeper/page/']) {
    const base = htmlBase('404.html', new URL(missing, siteRoot).href);
    assert.equal(base.href, siteRoot);
    for (const [, value] of read('404.html').matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^https?:/.test(value) || value === '/sentinel/') continue;
      assertLocal(value, base, siteRoot);
    }
  }
});

test('font imports and font-face URLs stay within each deployment', () => {
  for (const siteRoot of BASES) {
    const cssUrl = new URL('assets/css/sentinel.css', siteRoot);
    const imported = read('assets/css/sentinel.css').match(/@import url\('([^']+)'\)/)[1];
    assertLocal(imported, cssUrl, siteRoot);
    const fontCss = new URL(imported, cssUrl);
    for (const [, font] of read('assets/fonts/fonts.css').matchAll(/src: url\('([^']+)'\)/g)) assertLocal(font, fontCss, siteRoot);
  }
});

test('manifest launch, scope, icons and shortcuts resolve inside the static site', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const siteRoot of BASES) {
    const base = new URL('manifest.webmanifest', siteRoot);
    assert.equal(new URL(manifest.scope, base).href, siteRoot);
    assert.equal(new URL(manifest.id, base).href, siteRoot);
    assertLocal(manifest.start_url, base, siteRoot);
    for (const icon of manifest.icons) assertLocal(icon.src, base, siteRoot);
    for (const shortcut of manifest.shortcuts) {
      assertLocal(shortcut.url, base, siteRoot);
      for (const icon of shortcut.icons) assertLocal(icon.src, base, siteRoot);
    }
  }
});

test('preview submissions give an available next step without API calls or self redirects', async () => {
  const preview = homepage();
  await preview.form.emit('submit');
  assert.equal(preview.requests(), 0);
  assert.match(preview.out.innerHTML, /isn&rsquo;t available/);
  assert.match(preview.out.innerHTML, /v1\.7\.0/);
  assert.match(preview.out.innerHTML, /href="download.html"/);
  assert.doesNotMatch(preview.out.innerHTML, /#try|live site/);
});

test('without IntersectionObserver, hero, game, cards and link form still initialize', async () => {
  const preview = homepage({ noObserver: true, hero: true, game: true, reduced: true });
  await preview.flush();
  assert.ok(preview.stage.classList.contains('is-in'));
  assert.match(preview.game.querySelector('[data-game-stage]').innerHTML, /data-answer/);
  assert.ok(preview.cards.every(card => card.child.handlers.click.length === 1));
  await preview.form.emit('submit');
  assert.match(preview.out.innerHTML, /href="download.html"/);
  assert.equal(preview.requests(), 0);
});

test('severity cycles wrap, pause and resume, and selecting a stage stops cycling', async () => {
  const preview = homepage();
  const card = preview.cards[0];
  const buttons = card.querySelectorAll('[data-sev]');
  const selected = () => buttons.find(button => button.getAttribute('aria-pressed') === 'true').dataset.sev;
  preview.visible(card);
  assert.equal(preview.timers.size, 1);
  for (const severity of ['yellow', 'orange', 'red']) { await preview.tick(); assert.equal(selected(), severity); }
  await card.child.click();
  assert.equal(preview.timers.size, 0);
  preview.visible(card, false);
  preview.visible(card);
  assert.equal(preview.timers.size, 0, 'A user pause must survive leaving and reentering the viewport');
  await card.child.click();
  await preview.tick();
  assert.equal(selected(), 'yellow');
  await buttons[1].click();
  assert.equal(selected(), 'orange');
  assert.equal(preview.timers.size, 0);
  await preview.flush();
  assert.match(card.querySelector('[data-example]').innerHTML, /netflix-account-update/);
});

test('cards cycle independently, stop offscreen and respect reduced motion', async () => {
  const preview = homepage();
  const [first, second] = preview.cards;
  preview.visible(first);
  preview.visible(second);
  assert.equal(preview.timers.size, 2);
  preview.visible(first, false);
  assert.equal(preview.timers.size, 1);
  await preview.tick();
  assert.equal(first.querySelectorAll('[data-sev]')[2].getAttribute('aria-pressed'), 'true');
  assert.equal(second.querySelectorAll('[data-sev]')[2].getAttribute('aria-pressed'), 'true');
  const reduced = homepage({ reduced: true });
  reduced.cards.forEach(card => reduced.visible(card));
  assert.equal(reduced.timers.size, 0);
});

test('mask examples escape verdict text from the baked data', async () => {
  const preview = homepage();
  preview.sandbox.SENTINEL_DEMO.masks.scam.yellow.context = '<img src=x onerror=alert(1)>';
  await preview.cards[0].querySelectorAll('[data-sev]')[0].click();
  const html = preview.cards[0].querySelector('[data-example]').innerHTML;
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});

test('all release links point to the requested v1.7.0 release', () => {
  const links = [...read('download.html').matchAll(/href="(https:\/\/github.com\/zzilinct\/Sentinel\/releases[^\"]*)"/g)];
  assert.ok(links.length >= 4);
  for (const [, link] of links) assert.equal(link, RELEASE);
  assert.match(read('download.html'), /data-release-tag="v1\.7\.0"/);
});

test('release metadata is pinned and never disables the release page on failures', async () => {
  for (const outcome of ['asset', 'no-assets', 'rate-limit', 'offline']) {
    const button = new Element({ releases: 'zzilinct/Sentinel', releaseTag: 'v1.7.0' });
    button.setAttribute('href', RELEASE);
    const meta = new Element();
    meta.innerHTML = 'Version 1.7.0';
    const requests = [];
    vm.runInNewContext(read('assets/js/download.js'), {
      document: { querySelector: selector => selector === '[data-installer]' ? button : meta },
      fetch: async url => {
        requests.push(url);
        if (outcome === 'offline') throw new Error('Offline');
        return { ok: outcome !== 'rate-limit', json: async () => ({ tag_name: 'v1.7.0', assets: outcome === 'asset' ? [{ name: 'Sentinel-Setup.exe', size: 10485760 }] : [] }) };
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests, ['https://api.github.com/repos/zzilinct/Sentinel/releases/tags/v1.7.0']);
    assert.equal(button.getAttribute('href'), RELEASE);
    assert.notEqual(button.getAttribute('aria-disabled'), 'true');
    assert.match(meta.innerHTML, /1\.7\.0/);
    if (outcome === 'asset') assert.match(meta.innerHTML, /10 MB/);
  }
});

test('hidden reveals fail open when a script errors or site.js never becomes ready', () => {
  const boot = (ready) => {
    const classes = new Set();
    let onError;
    let timer;
    const win = {
      IntersectionObserver: class {},
      document: { documentElement: { classList: { add: c => classes.add(c) } } },
      location: { protocol: 'file:', hostname: '' },
      navigator: {},
      addEventListener: (type, fn) => { if (type === 'error') onError = fn; },
      setTimeout: fn => { timer = fn; }
    };
    win.window = win;
    vm.runInNewContext(read('assets/js/boot.js'), win);
    if (ready) win.Site = { ready: true };
    return { classes, error: target => onError({ target: target === 'window' ? win : { tagName: target } }), timeout: () => timer() };
  };
  let b = boot(false); b.error('IMG'); assert.ok(!b.classes.has('no-io'), 'a missing image keeps the animations');
  b.error('SCRIPT'); assert.ok(b.classes.has('no-io'), 'a script that fails to load reveals everything');
  b = boot(false); b.error('window'); assert.ok(b.classes.has('no-io'), 'a runtime error reveals everything');
  b = boot(false); b.timeout(); assert.ok(b.classes.has('no-io'), 'site.js never running reveals everything');
  b = boot(true); b.error('window'); b.timeout(); assert.ok(!b.classes.has('no-io'), 'once reveals run, later errors leave them alone');
  assert.match(read('assets/js/site.js'), /window\.Site\.ready = true/);
});

test('every script parses, including inline scripts', () => {
  for (const file of fs.readdirSync(path.join(root, 'assets/js'))) new vm.Script(read(`assets/js/${file}`), { filename: file });
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    for (const [, script] of read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script, { filename: file });
  }
});

test('pricing has four distinct plans with the requested monthly prices', () => {
  for (const file of ['index.html', 'pricing.html']) {
    const cards = [...read(file).matchAll(/<article class="plan[^\"]*"[\s\S]*?<\/article>/g)].map(m => m[0]);
    assert.equal(cards.length, 4);
    for (const [name, price] of [['Free', '0'], ['Pro', '15'], ['Max', '40'], ['Ultimate', '100']]) {
      const card = cards.find(c => c.includes(`class="plan__name">${name}<`));
      assert.ok(card?.includes(`<b>$${price}</b>`), `${file}: ${name}`);
    }
    assert.ok(cards[3].includes('Everything in Max'));
    assert.ok(cards[3].includes('500'));
  }
});
