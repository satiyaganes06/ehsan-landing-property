// Generate crawlable public pages from the same published feeds as the website.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {archive, detail, mainPaths, records, sitemap, slug, templates} from '../public-render/seo.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = [...mainPaths];
for (const kind of ['about', ...Object.keys(templates)]) {
  const directory = path.join(root, kind);
  await mkdir(directory, {recursive:true});
  const index = await readFile(path.join(root, 'html', kind + '.html'), 'utf8');
  await writeFile(path.join(directory, 'index.html'), index);
  if (kind === 'about') continue;
  let data;
  try {
    const response = await fetch(new URL('/api/public/' + kind + '.json', process.env.EHSAN_CMS_ORIGIN || 'http://localhost:3001'), {signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Public feed unavailable');
    data = await response.json();
  } catch (error) {
    if (process.env.EHSAN_CMS_ORIGIN) throw error;
    data = JSON.parse(await readFile(path.join(root, 'data', kind + '.json'), 'utf8'));
  }
  if (kind !== "projects") await writeFile(path.join(directory, "index.html"), archive(index, kind, records(kind, data)));
  const template = await readFile(path.join(root, 'html', templates[kind] + '-detail.html'), 'utf8');
  for (const record of records(kind, data)) {
    const name = slug(record);
    if (!name || paths.includes('/' + kind + '/' + name)) throw new Error('Missing or duplicate slug in ' + kind);
    if (record.seo?.robotsIndex !== false) paths.push('/' + kind + '/' + name);
    const target = path.join(directory, name);
    await mkdir(target, {recursive:true});
    await writeFile(path.join(target, 'index.html'), detail(template, kind, record));
  }
}
await writeFile(path.join(root, 'sitemap.xml'), sitemap(paths));
