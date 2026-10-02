/* Generate local static indexes. Production hosts use root routing config. */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = record => String(record.slug || record.name || record.title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80);
for (const kind of ['about','projects','events','news']) {
  const directory = path.join(root, kind); await mkdir(directory, {recursive:true});
  await writeFile(path.join(directory, 'index.html'), await readFile(path.join(root, 'html', `${kind}.html`)));
  if (kind === 'about') continue;
  let data;
  try {const response = await fetch(`http://localhost:3001/api/public/${kind}.json`, {signal:AbortSignal.timeout(5000)}); if (!response.ok) throw new Error('Unavailable'); data = await response.json();}
  catch {data = JSON.parse(await readFile(path.join(root, 'data', `${kind}.json`), 'utf8'));}
  const records = kind === 'news' ? data.articles.filter(item => item.published && !item.archived) : Object.values(data);
  const template = await readFile(path.join(root, 'html', `${kind === 'projects' ? 'project' : kind === 'events' ? 'event' : 'news'}-detail.html`));
  for (const record of records) {const name = slug(record); if (!name || !/^[a-z0-9-]+$/.test(name)) continue; const target = path.join(directory, name); await mkdir(target, {recursive:true}); await writeFile(path.join(target, 'index.html'), template);}
}
