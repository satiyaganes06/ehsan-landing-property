const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readBoundedJson } = require('../lib/server/bounded-json.ts');
const { mediaPath, readMedia, copyMedia } = require('../lib/server/local-media.cjs');
const { parseEventStart } = require('../prisma/event-start.cjs');

test('JSON budget counts actual UTF-8 bytes, including when no length is declared', async () => {
  const body = JSON.stringify({ name: 'José' });
  const request = () => new Request('https://example.invalid', { method: 'POST', body });
  assert.deepEqual(await readBoundedJson(request(), Buffer.byteLength(body)), { ok: true, value: { name: 'José' } });
  assert.deepEqual(await readBoundedJson(request(), Buffer.byteLength(body) - 1), { ok: false, status: 413 });
  assert.deepEqual(await readBoundedJson(new Request('https://example.invalid'), 16), { ok: false, status: 400 });
});

test('local media round-trips a legacy filename and rejects ambiguous keys', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ehsan-media-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const key = '2024/07/old photo.jpg';
  const source = path.join(root, 'uploads');
  const target = path.join(root, 'public');
  await fs.writeFile(await mediaPath(source, key, true), 'fixture');
  await copyMedia(source, target, key);
  assert.equal((await readMedia(target, key)).toString(), 'fixture');
  await assert.rejects(mediaPath(source, '2024/../sample.jpg'));
  await fs.symlink(path.join(source, '2024'), path.join(source, 'linked'));
  await assert.rejects(readMedia(source, 'linked/07/old photo.jpg'));
});

test('Malaysian event imports preserve noon and midnight and reject impossible dates', () => {
  assert.equal(parseEventStart('Feb 29, 2024 · 12:00 PM').toISOString(), '2024-02-29T04:00:00.000Z');
  assert.equal(parseEventStart('Sep 15, 2024 · 12:00 AM').toISOString(), '2024-09-14T16:00:00.000Z');
  assert.throws(() => parseEventStart('Feb 29, 2025 · 2:00 PM'));
});

test('CSV keeps names and punctuation intact and marks formula-like fields as text', () => {
  const { csvCell } = require('../lib/server/csv-cell.ts');
  assert.equal(csvCell('Amir'), 'Amir');
  assert.equal(csvCell('A, "B"'), '"A, ""B"""');
  assert.equal(csvCell('+60123456789'), "'+60123456789");
  assert.equal(csvCell('=1+2'), "'=1+2");
});
