import { route, json } from '@/lib/server/route';
import { prisma } from '@/lib/server/prisma';
import { readNews, newsKey } from '@/lib/server/news';
import { newsSchema } from '@/lib/news';
import { recordAudit, recordRevision } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const GET = route({ resource: 'block', action: 'read' }, async () => json(await readNews()));
export const PUT = route({ resource: 'block', action: 'update' }, async ({ request, user }) => {
  const next = newsSchema.parse(await request.json());
  const current = await readNews();
  const previous = new Map(current.articles.map(article => [article.id, article]));
  if (current.articles.some(article => !next.articles.some(item => item.id === article.id))) return json({ message: 'Archive articles so they can be restored later.' }, 400);
  for (const article of next.articles) {
    const old = previous.get(article.id);
    if (!old && !user.permissions.has('event:create')) return json({ message: 'You cannot create news articles.' }, 403);
    if ((!old && article.published) || (old && old.published !== article.published)) if (!user.permissions.has('event:publish')) return json({ message: 'You cannot publish news articles.' }, 403);
    if (old && old.archived !== article.archived && !user.permissions.has('event:delete')) return json({ message: 'You cannot archive news articles.' }, 403);
  }
  const block = await prisma.textBlock.upsert({ where: { key: newsKey }, create: { key: newsKey, label: 'News', kind: 'configuration', group: 'news' }, update: {} });
  const existing = await prisma.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } } });
  if (existing) recordRevision('text_block_translation', existing.id, existing, user.id);
  await prisma.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } }, create: { textBlockId: block.id, locale: 'EN', value: next }, update: { value: next } });
  recordAudit({ actorId: user.id, action: 'news.updated', entityType: 'block', entityId: block.id });
  return json(next);
});
