// The website and the CMS are separate deployments.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.setHeader('Allow', 'GET, HEAD').status(405).end();
  const origin = process.env.EHSAN_CMS_ORIGIN;
  let html;
  if (origin) {
    try {
      const response = await fetch(new URL('/api/public/company-facts', origin), {
        redirect: 'error', signal: AbortSignal.timeout(7000)
      });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('text/html')) throw new Error('CMS unavailable');
      html = await response.text();
    } catch {
      return res.status(503).setHeader('Retry-After', '60').end('Company facts are temporarily unavailable.');
    }
  } else {
    html = await readFile(path.join(process.cwd(), 'ai-instructions/index.html'), 'utf8');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).end(req.method === 'HEAD' ? undefined : html);
}
