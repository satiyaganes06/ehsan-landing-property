// Local, repeatable import. Original archives and old media files are never deleted.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');
const manifest = require('./project-archive-manifest.cjs');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));
const repo = path.resolve(__dirname, '../..');
const source = '/Users/amir/ehsan projects';
const prisma = new PrismaClient();
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function snapshot(client, references) {
  return {
    projects: await client.project.findMany({ where: { reference: { in: references } }, orderBy: { reference: 'asc' }, include: { translations: true, media: { orderBy: { id: 'asc' }, include: { media: true } } } }),
    blocks: await client.textBlock.findMany({ where: { OR: references.map(reference => ({ key: { endsWith: `.${reference}` } })) }, orderBy: { key: 'asc' }, include: { translations: true } }),
  };
}
async function run() {
  if (manifest.some(item => item.reference === 'proj-15')) throw new Error('Widuri cannot be imported.');
  const fallbackPath = path.join(repo, 'data/projects.json');
  const fallbackOriginal = await fs.readFile(fallbackPath, 'utf8');
  const fallback = JSON.parse(fallbackOriginal);
  const widuriFallback = fingerprint(fallback['proj-15']);
  const widuriBefore = await snapshot(prisma, ['proj-15']);
  const before = await snapshot(prisma, manifest.map(item => item.reference));
  if (before.projects.length !== manifest.length) throw new Error('Missing project match; no records changed.');
  const backupDir = await fs.mkdtemp('/private/tmp/ehsan-project-import-');
  await fs.writeFile(path.join(backupDir, 'before.json'), JSON.stringify({ before, widuriBefore }, null, 2));
  await fs.writeFile(path.join(backupDir, 'projects.json'), fallbackOriginal);
  const prepared = [];
  for (const item of manifest) {
    const media = [];
    for (const archiveName of item.archives) {
      const archive = path.join(source, `${archiveName}.zip`);
      const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
      if (entries.some(entry => entry.startsWith('/') || entry.split('/').includes('..') || !/^(content\.txt|images\/[^/]+\.(jpg|jpeg|png))$/i.test(entry))) throw new Error(`Unsafe archive: ${archiveName}`);
      const directory = path.join(repo, 'assets/img/project-imports', archiveName);
      await fs.mkdir(directory, { recursive: true });
      execFileSync('unzip', ['-o', '-q', archive, '-d', directory]);
      for (const entry of entries.filter(entry => entry.startsWith('images/'))) {
        // Mawar has three smaller copies of the same photos; use the full-size copies.
        if (archiveName === 'taman-mawar-ehsan-rembau' && /1024x576/.test(entry)) continue;
        const number = Number(path.basename(entry).slice(0, 2));
        let role = media.length === 0 ? 'hero' : 'gallery';
        if (/logo/i.test(entry)) role = 'logo';
        if (archiveName === 'ehsan-residence-sepang') {
          if (number === 13) role = 'location';
          else if ((number >= 14 && number <= 32) || number >= 40) role = 'facilities';
          else if (number >= 33 && number <= 39) role = 'interior';
        }
        if (archiveName === 'taman-sri-ehsan-kluang' && number >= 15 && number <= 27) role = 'interior';
        if (archiveName === 'mutiara-austin-residence' && number >= 6) role = 'facilities';
        const filename = `project-imports/${archiveName}/${entry}`;
        const info = await sharp(path.join(directory, entry)).metadata();
        const stat = await fs.stat(path.join(directory, entry));
        media.push({ filename, storageKey: `legacy:img/${filename}`, mimeType: /png$/i.test(entry) ? 'image/png' : 'image/jpeg', width: info.width, height: info.height, bytes: stat.size, role });
      }
    }
    prepared.push({ ...item, media, content: { template: 'widuri-sections-v1', sourceOnly: true, ...item.content } });
  }
  if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ backupDir, dryRun: prepared.map(item => ({ reference: item.reference, name: item.name, images: item.media.length })) }, null, 2)); return; }
  await prisma.$transaction(async tx => {
    for (const item of prepared) {
      const old = before.projects.find(project => project.reference === item.reference);
      await tx.revision.create({ data: { entityType: 'project_archive_import', entityId: old.id, snapshot: JSON.parse(JSON.stringify(old)) } });
      const facts = item.content.facts || [];
      const area = facts.find(([label]) => /area|house size/i.test(label))?.[1] || null;
      const price = facts.find(([label]) => label === 'Starting price')?.[1] || null;
      await tx.project.update({ where: { id: old.id }, data: { status: item.status, yearStart: item.yearStart || null, yearEnd: item.yearEnd || null, latitude: null, longitude: null, units: item.units || null, areaText: area, priceRange: price, occupancy: null, gdvMillions: null, relatedReferences: [] } });
      await tx.projectTranslation.update({ where: { projectId_locale: { projectId: old.id, locale: 'EN' } }, data: { name: item.name, location: item.location, description: item.description, amenities: item.content.facilities || [], certificate: null } });
      // Replace links only, keeping all old media records/files recoverable.
      await tx.projectMedia.deleteMany({ where: { projectId: old.id } });
      for (const [sortOrder, image] of item.media.entries()) {
        const { role, ...fields } = image;
        const row = await tx.media.upsert({ where: { storageKey: image.storageKey }, create: { ...fields, altText: `${item.name} ${role === 'logo' ? 'logo' : 'project image'}` }, update: {} });
        await tx.projectMedia.create({ data: { projectId: old.id, mediaId: row.id, role, sortOrder } });
      }
      for (const [key, value] of [[`project.content.${item.reference}`, item.content], [`project.enquiry.${item.reference}`, { enabled: false, interest: '', sections: { cta: false, fit: false, shuttle: false, certificate: false } }]]) {
        const block = await tx.textBlock.upsert({ where: { key }, create: { key, label: 'Project section content', kind: 'configuration', group: 'project' }, update: {} });
        await tx.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } }, create: { textBlockId: block.id, locale: 'EN', value }, update: { value } });
      }
    }
    if (fingerprint(await snapshot(tx, ['proj-15'])) !== fingerprint(widuriBefore)) throw new Error('Widuri changed; rolling back.');
  }, { timeout: 120000 });
  for (const item of prepared) {
    fallback[item.reference] = { name: item.name, location: item.location, status: item.status === 'COMPLETED' ? 'Completed' : item.status === 'ONGOING' ? 'Ongoing' : 'Future', description: item.description, year: item.yearStart || '', yearEnd: item.yearEnd || '', units: item.units || '', content: item.content, enquiry: { enabled: false, interest: '', sections: { cta: false, fit: false, shuttle: false, certificate: false } }, media: { thumbnail: item.media[0].filename, image: item.media.filter(image => ['hero', 'gallery'].includes(image.role)).map(image => image.filename), blueprint: [], ...Object.fromEntries(['logo', 'location', 'facilities', 'interior'].map(role => [role, item.media.filter(image => image.role === role).map(image => image.filename)])) } };
  }
  if (fingerprint(fallback['proj-15']) !== widuriFallback) throw new Error('Widuri fallback changed.');
  // Preserve the literal source text of unmatched records, especially Widuri.
  const references = new Set(prepared.map(item => item.reference));
  const updatedFallback = fallbackOriginal.replace(/^  "(proj-\d+)": \{[\s\S]*?(?=,\r?\n  "proj-|\r?\n\})/gm, (original, reference) => references.has(reference) ? `  "${reference}": ${JSON.stringify(fallback[reference], null, 2).replace(/\n/g, '\n  ')}` : original);
  assertFallback(updatedFallback, fallback);
  await fs.writeFile(fallbackPath, updatedFallback);
  const report = { backupDir, updated: prepared.map(item => ({ reference: item.reference, name: item.name, images: item.media.length })), widuriUnchanged: true, unmatchedUnchanged: ['proj-1', 'proj-7', 'proj-10', 'proj-11'] };
  await fs.writeFile(path.join(backupDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
function assertFallback(source, expected) {
  if (JSON.stringify(JSON.parse(source)) !== JSON.stringify(expected)) throw new Error('Fallback serialization mismatch.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
