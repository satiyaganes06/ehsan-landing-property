const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));
const prisma = new PrismaClient();
const backup = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
async function run() {
  const projects = await prisma.project.findMany({ where: { reference: 'proj-15' }, orderBy: { reference: 'asc' }, include: { translations: true, media: { orderBy: { id: 'asc' }, include: { media: true } } } });
  const blocks = await prisma.textBlock.findMany({ where: { key: { endsWith: '.proj-15' } }, orderBy: { key: 'asc' }, include: { translations: true } });
  assert.deepEqual(JSON.parse(JSON.stringify({ projects, blocks })), backup.widuriBefore);
  const previous = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[2]), 'projects.json'), 'utf8'));
  const current = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/projects.json'), 'utf8'));
  for (const reference of ['proj-1', 'proj-7', 'proj-10', 'proj-11', 'proj-15']) assert.deepEqual(current[reference], previous[reference]);
  const manifest = require('./project-archive-manifest.cjs');
  for (const entry of manifest) {
    const project = await prisma.project.findUnique({ where: { reference: entry.reference }, include: { translations: { where: { locale: 'EN' } }, media: true } });
    assert.equal(project.translations[0].description, entry.description);
    assert.equal(project.translations[0].location, entry.location);
    assert.equal(project.media.length, Object.values(current[entry.reference].media).flat().filter(Boolean).length - 1);
    assert.equal(project.latitude, null);
    assert.equal(project.longitude, null);
  }
  console.log('Verified all 11 project records and image counts. Widuri and the 4 unmatched fallback records are unchanged.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
