const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, 'public-data.js'), 'utf8');
function setup({ cached, embedded = false, fail = false } = {}) {
  let stored = cached && JSON.stringify(cached);
  const requests = [], preloads = [];
  const projects = { 'proj-15': { name: 'Widuri', media: { image: ['widuri/hero.jpg'] } } };
  const window = {}; window.parent = embedded ? {} : window;
  runInNewContext(source, { window, URL, URLSearchParams, Date, location: { hostname: 'localhost', origin: 'http://localhost:8899', pathname: '/html/project-detail.html', search: '?project=proj-15' },
    document: { currentScript: { src: 'http://localhost:8899/js/public-data.js' }, createElement: () => ({}), head: { append: node => preloads.push(node) } },
    sessionStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    fetch: async url => { requests.push(String(url)); if (fail && requests.length === 1) throw new Error('Offline'); return { ok: true, json: async () => projects }; },
  });
  return { api: window.EhsanPublicData, requests, preloads, projects, saved: () => stored };
}
test('fresh list data renders without a project request', async () => {
  const projects = { 'proj-15': { name: 'Cached', media: { image: ['hero.jpg'] } } };
  const ctx = setup({ cached: { savedAt: Date.now(), projects, landing: { projects } } });
  assert.equal((await ctx.api.getProjects())['proj-15'].name, 'Cached');
  assert.equal(ctx.requests.length, 0);
  assert.equal(ctx.api.getLanding().projects['proj-15'].name, 'Cached');
  assert.equal(ctx.preloads[0].href, 'http://localhost:8899/assets/img/hero.jpg');
});
test('cold visits start early and reuse the in-flight request', async () => {
  const ctx = setup(); assert.equal(ctx.requests.length, 1);
  await Promise.all([ctx.api.getProjects(), ctx.api.getProjects()]);
  assert.equal(ctx.requests.length, 1);
});
test('expired data is refreshed', async () => {
  const ctx = setup({ cached: { savedAt: Date.now() - 61_000, projects: {} } });
  assert.equal((await ctx.api.getProjects())['proj-15'].name, 'Widuri');
  assert.equal(ctx.requests.length, 1);
});
test('preview drafts never reuse or write public session storage', async () => {
  const cached = { savedAt: Date.now(), projects: { private: true } };
  const ctx = setup({ cached, embedded: true }); await ctx.api.getProjects();
  ctx.api.saveLanding({ projects: { draft: true } });
  assert.equal(ctx.requests.length, 1); assert.equal(ctx.saved(), JSON.stringify(cached));
});
test('unavailable service falls back to static project data', async () => {
  const ctx = setup({ fail: true }); await ctx.api.getProjects();
  assert.equal(ctx.requests.length, 2); assert.match(ctx.requests[1], /data\/projects.json/);
});
