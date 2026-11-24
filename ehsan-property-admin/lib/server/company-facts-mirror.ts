import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { readCompanyFacts } from './company-facts';
import { renderCompanyFacts } from './company-facts-render.mjs';

export async function mirrorCompanyFacts(projects: Record<string, unknown>) {
  if (process.env.VERCEL) return;
  const dir = path.resolve(process.env.SITE_DATA_DIR ?? '../data', '../ai-instructions');
  const temp = path.join(dir, '.index-' + randomUUID());
  try {
    const html = renderCompanyFacts(await readCompanyFacts(), projects);
    await mkdir(dir, { recursive: true });
    await writeFile(temp, html);
    await rename(temp, path.join(dir, 'index.html'));
  } finally {
    await rm(temp, { force: true });
  }
}
