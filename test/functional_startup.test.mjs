/**
 * The functional page must get past renderer setup in a real browser.
 * three.js setPixelRatio() calls this.setSize(); the size cap must not call back into that.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

const html = readFileSync(new URL('../functional-test.html', import.meta.url), 'utf8');
const bootStart = html.indexOf('<script id="dh-functional-boot">');
const bootEnd = html.indexOf('</script>', bootStart);
const boot = html.slice(bootStart, bootEnd);

test('size cap does not call setPixelRatio after setSize is replaced', () => {
  assert.match(boot, /origSetPixelRatio\(1\)/);
  assert.match(boot, /origSetSize\(bw, bh, false\)/);
  const apply = boot.slice(boot.indexOf('function apply()'), boot.indexOf('r.setPixelRatio'));
  assert.equal(apply.includes('setPixelRatio'), false);
  assert.equal(apply.includes('origSetPixelRatio'), false);
});

test('three.js setPixelRatio/setSize coupling no longer overflows', () => {
  function Renderer() {
    this.domElement = { style: {} };
    this.calls = 0;
    this.setSize = function (w, h) {
      this.calls++;
      if (this.calls > 8) throw new Error('setSize called ' + this.calls);
      this.size = [w, h];
    };
    this.setPixelRatio = function (v) {
      this.ratio = v;
      this.setSize(2, 2, false);
    };
  }
  const r = new Renderer();
  const origSetPixelRatio = r.setPixelRatio.bind(r);
  const origSetSize = r.setSize.bind(r);
  origSetPixelRatio(1);
  function apply() { origSetSize(160, 120, false); r.domElement.style.width = '320px'; }
  r.setPixelRatio = function () { apply(); };
  r.setSize = function () { apply(); };
  apply();
  r.setPixelRatio(2);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.size, [160, 120]);
  assert.ok(r.calls < 8);
  assert.equal(r.domElement.style.width, '320px');
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('headless Chrome creates the canvas, story popup, and diagnostics', async () => {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] !== '/functional-test.html') {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  const port = await listen(server);
  const profile = mkdtempSync(tmpdir() + '/dh-ft-chrome-');
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=9333', '--remote-allow-origins=*',
    'about:blank',
  ], { stdio: 'ignore' });
  let ws;
  const logs = [];
  try {
    const list = await waitForList();
    const page = list.find((t) => t.type === 'page') || list[0];
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
        logs.push(text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        logs.push(String(msg.params.exceptionDetails && (msg.params.exceptionDetails.text || msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || 'exception'));
      }
    };
    const send = (method, params) => new Promise((resolve) => {
      const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params }));
    });
    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/functional-test.html` });
    const deadline = Date.now() + 45000;
    let state = {};
    while (Date.now() < deadline) {
      const res = await send('Runtime.evaluate', { expression: `({
        canvas: document.querySelectorAll('canvas').length,
        banner: !!(document.getElementById('dhFuncBanner') && document.getElementById('dhFuncBanner').textContent),
        diag: !!document.getElementById('dhFuncDiag'),
        pop: !!document.getElementById('sPop'),
        buf: (document.querySelector('canvas') || {}).width || 0
      })`, returnByValue: true });
      state = res.result && res.result.result && res.result.result.value || {};
      if (state.canvas && state.banner && state.diag && state.pop) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    const joined = logs.join('\n');
    assert.equal(/Maximum call stack size exceeded|scope missing|nodes is not defined|reading 'value'/.test(joined), false, joined.slice(0, 700));
    assert.ok(state.canvas >= 1, JSON.stringify(state) + '\n' + joined.slice(0, 800));
    assert.equal(state.banner, true, JSON.stringify(state));
    assert.equal(state.diag, true, JSON.stringify(state));
    assert.equal(state.pop, true, JSON.stringify(state));
    assert.ok(state.buf > 0 && state.buf <= 480, JSON.stringify(state));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
  }
});

async function waitForList() {
  const deadline = Date.now() + 15000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/list');
      if (res.ok) {
        const list = await res.json();
        if (list.length) return list;
      }
    } catch (e) { last = String(e); }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('chrome debug port not ready ' + last);
}
