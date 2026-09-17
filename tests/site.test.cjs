const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function context(fetch, enabled = true, href = 'https://sentinel.test/site/login.html') {
  const url = new URL(href);
  const sandbox = { window: { SENTINEL_API_ENABLED: enabled }, fetch, AbortController, setTimeout, clearTimeout, URL, URLSearchParams, location: url };
  vm.createContext(sandbox);
  vm.runInContext(read('assets/js/sentinel.js'), sandbox);
  return sandbox;
}

test('preview mode never makes API requests', async () => {
  let calls = 0;
  const c = context(() => { calls++; }, false);
  await assert.rejects(c.window.Sentinel.api('/auth/signup', {method:'POST',body:{email:'test@example.com'}}), /coming soon/);
  assert.equal(calls, 0);
});

test('HTML hosting fallbacks cannot count as successful API responses', async () => {
  const c = context(async () => new Response('<html>Home page</html>', {status:200}));
  await assert.rejects(c.window.Sentinel.api('/auth/login'), /could not load/);
});

test('API preserves field errors, handles JSON and accepts no-content responses', async () => {
  const c = context(async () => new Response(JSON.stringify({error:{message:'Invalid email',code:'validation',errors:{email:'Enter an email'}}}), {status:400}));
  await assert.rejects(c.window.Sentinel.api('/auth/signup'), err => err.status === 400 && err.errors.email === 'Enter an email');
  c.fetch = async () => new Response(JSON.stringify({user:{name:'Test'}}));
  assert.equal((await c.window.Sentinel.api('/auth/me')).user.name, 'Test');
  c.fetch = async () => new Response(null, {status:204});
  assert.equal(await c.window.Sentinel.api('/auth/logout'), null);
});

test('hung API calls are aborted and return a usable message', async () => {
  const c = context((url, {signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name:'AbortError'})))));
  c.setTimeout = callback => setTimeout(callback, 5);
  await assert.rejects(c.window.Sentinel.api('/scan'), /took too long/);
});

test('verdict content is escaped and risk scores cannot inject HTML', () => {
  const c = context();
  const html = c.window.Sentinel.verdictCard({badge:'red',label:'<script>bad</script>',score:'"><img src=x>',reasons:[{text:'<b>unsafe</b>'}]});
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Risk score 0/100'));
  assert.ok(c.window.Sentinel.verdictCard({score:999}).includes('Risk score 100/100'));
});

test('all local HTML links, fragments and asset references resolve', () => {
  const failures = [];
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${file}`);
    for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|data:)/.test(value)) continue;
      const url = new URL(value, `https://test.invalid/${file}`);
      const target = url.pathname.slice(1) || 'index.html';
      if (!fs.existsSync(path.join(root, target))) { failures.push(`${file}: ${value}`); continue; }
      if (url.hash && target.endsWith('.html') && !read(target).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) failures.push(`${file}: ${value}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every script parses, including inline scripts', () => {
  for (const file of fs.readdirSync(path.join(root, 'assets/js'))) new vm.Script(read(`assets/js/${file}`), {filename:file});
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    for (const [, script] of read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script, {filename:file});
  }
});

test('pricing has four distinct plans with the requested monthly prices', () => {
  const cards = [...read('index.html').matchAll(/<article class="plan[^\"]*"[\s\S]*?<\/article>/g)].map(m=>m[0]);
  assert.equal(cards.length, 4);
  for (const [name, price] of [['Free','0'], ['Pro','15'], ['Max','40'], ['Ultimate','100']]) {
    const card = cards.find(c => c.includes(`class="plan__name">${name}<`));
    assert.ok(card?.includes(`<b>$${price}</b>`), name);
  }
  assert.ok(cards[3].includes('Everything in Max'));
  assert.ok(cards[3].includes('500'));
});

test('sign-in ignores external or malformed return destinations', async () => {
  for (const next of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/other.html', 'app.html']) {
    const c = context(undefined, true, `https://sentinel.test/site/login.html?next=${encodeURIComponent(next)}`);
    c.location = { href: c.location.href, search: c.location.search };
    let submit;
    const nodes = new Map();
    const node = id => {
      if (!nodes.has(id)) nodes.set(id, {textContent:'Sign in',disabled:false,hidden:true,insertAdjacentHTML(){}, reportValidity(){return true;},addEventListener(type, callback){if (type === 'submit') submit = callback;}});
      return nodes.get(id);
    };
    c.document = {getElementById:node,querySelectorAll:()=>[]};
    c.FormData = class {entries(){return [['email','test@example.com'],['password','testpassword1']];}};
    c.window.Sentinel.api = async route => route === '/auth/config' ? {googleEnabled:false} : {};
    c.window.Sentinel.pairExtension = async () => false;
    vm.runInContext(read('assets/js/auth.js'), c);
    c.window.Auth.init('login');
    await submit({preventDefault(){}});
    assert.equal(new URL(c.location.href, 'https://sentinel.test/site/login.html').href, 'https://sentinel.test/site/app.html', next);
  }
});
