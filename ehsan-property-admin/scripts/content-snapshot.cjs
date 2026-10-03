/* Content only: never export users, passwords, sessions, enquiries or analytics. */
const {PrismaClient} = require('@prisma/client');
const {readFile, writeFile, mkdir, copyFile} = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const snapshotPath = path.join(root, 'ehsan-property-admin/data/content-snapshot.json');
const prisma = new PrismaClient();
const models = ['media','project','projectTranslation','projectMedia','event','eventTranslation','award','awardTranslation','textBlock','textBlockTranslation','seoMeta','redirect'];
async function exportContent() {
  const tables = {};
  await prisma.$transaction(async db => {
    for (const model of models) tables[model] = (await db[model].findMany()).map(row => {
      const copy = {...row}; delete copy.createdById; return copy;
    });
  }, {isolationLevel:'RepeatableRead', timeout:30000});
  await writeFile(snapshotPath, JSON.stringify({version:1,exportedAt:new Date().toISOString(),tables},null,2)+'\n');
  for (const kind of ['projects','events','landing','news','project-licensing']) {
    const response = await fetch(`http://localhost:3001/api/public/${kind}.json`);
    if (!response.ok) throw new Error(`Public ${kind} export failed (${response.status})`);
    const payload = await response.json();
    if (kind === 'landing') delete payload.testimonials;
    const uploads = new Set();
    const localize = value => {
      if (typeof value === 'string') {
        const upload = value.match(/^\/media\/uploads\/(.+)$/);
        if (upload) {uploads.add(upload[1]); return `/assets/img/admin-uploads/${upload[1]}`;}
        return value.replace(/^\/live-site\/assets\//, '/assets/');
      }
      if (Array.isArray(value)) return value.map(localize);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localize(v)]));
      return value;
    };
    const publicPayload = localize(payload);
    for (const relative of uploads) {
      if (relative.split('/').includes('..')) throw new Error('Invalid upload path');
      const target = path.join(root,'assets/img/admin-uploads',relative);
      await mkdir(path.dirname(target),{recursive:true});
      await copyFile(path.join(root,'ehsan-property-admin/uploads',relative),target);
    }
    await writeFile(path.join(root,'data',`${kind}.json`),JSON.stringify(publicPayload,null,2)+'\n');
  }
  console.log('Exported admin content and five public content snapshots (no private records).');
}
async function restoreContent() {
  if (!process.argv.includes('--apply')) throw new Error('Restore updates content. Review the snapshot and pass --apply explicitly.');
  const snapshot = JSON.parse(await readFile(snapshotPath,'utf8'));
  if (snapshot.version !== 1 || models.some(model=>!Array.isArray(snapshot.tables?.[model]))) throw new Error('Invalid snapshot');
  await prisma.$transaction(async db => {
    for (const model of models) for (const source of snapshot.tables[model]) {
      const row = {...source};
      for (const key of ['createdAt','updatedAt','publishedAt','scheduledFor','startsAt','endsAt','scoredAt']) if (row[key]) row[key] = new Date(row[key]);
      delete row.createdById;
      await db[model].upsert({where:{id:row.id},create:row,update:row});
    }
  }, {timeout:60000});
  console.log('Restored content without deleting unrelated records or changing accounts.');
}
(process.argv[2] === 'export' ? exportContent() : process.argv[2] === 'restore' ? restoreContent() : Promise.reject(new Error('Use export or restore --apply')))
  .catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
