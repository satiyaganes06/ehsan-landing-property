import {readFile} from 'node:fs/promises';
import {archive, detail, mainPaths, records, sitemap, slug, templates} from '../public-render/seo.mjs';

async function feed(kind) {
  let data;
  if (process.env.EHSAN_CMS_ORIGIN) {
    const address = new URL('/api/public/' + kind + '.json', process.env.EHSAN_CMS_ORIGIN);
    const response = await fetch(address, {redirect:'error', signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Public feed unavailable');
    data = await response.json();
  } else {
    data = JSON.parse(await readFile('data/' + kind + '.json', 'utf8'));
  }
  return data;
}

async function published(kind) { return records(kind, await feed(kind)); }

export default async function handler(req, res) {
  if (!['GET','HEAD'].includes(req.method)) return res.setHeader('Allow','GET, HEAD').status(405).end();
  const {kind, name} = req.query;
  let body;
  try {
    if (kind === 'sitemap') {
      const groups = await Promise.all(Object.keys(templates).map(async key =>
        (await published(key)).filter(r => r.seo?.robotsIndex !== false).map(r => '/' + key + '/' + slug(r))));
      body = sitemap([...mainPaths, ...groups.flat()]);
      res.setHeader('Content-Type','application/xml; charset=utf-8');
    } else if (Object.hasOwn(templates, kind) && req.query.view === 'feed') {
      const data = await feed(kind);
      body = JSON.stringify(kind === 'news' ? {articles: records(kind, data)} : data);
      res.setHeader('Content-Type','application/json; charset=utf-8');
    } else if (['news','events'].includes(kind) && req.query.view === 'archive') {
      body = archive(await readFile('html/' + kind + '.html','utf8'), kind, await published(kind));
      res.setHeader('Content-Type','text/html; charset=utf-8');
    } else {
      if (typeof kind !== 'string' || !Object.hasOwn(templates, kind) || typeof name !== 'string') return res.status(404).end();
      const record = (await published(kind)).find(r => slug(r) === name);
      if (!record) return res.status(404).end('Page not found');
      const template = await readFile('html/' + templates[kind] + '-detail.html', 'utf8');
      body = detail(template, kind, record);
      res.setHeader('Content-Type','text/html; charset=utf-8');
    }
  } catch {
    return res.setHeader('Retry-After','60').status(503).end('Temporarily unavailable');
  }
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
  return res.status(200).end(req.method === 'HEAD' ? undefined : body);
}
