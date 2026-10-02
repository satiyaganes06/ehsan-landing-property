import { loadEnvConfig } from '@next/env';
import { PrismaClient, Prisma } from '@prisma/client';
import seed from '../data/news.json';

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async tx => {
    const block = await tx.textBlock.upsert({ where: { key: 'news.articles' }, create: { key: 'news.articles', label: 'News', kind: 'configuration', group: 'news' }, update: {} });
    const old = await tx.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } } });
    const current = (old?.value ?? seed) as unknown as typeof seed;
    const articles = current.articles.map(article => {
      const edited = seed.articles.find(item => item.id === article.id);
      return edited ? { ...article, title: edited.title, subtitle: edited.subtitle, excerpt: edited.excerpt, body: edited.body, thumbnail: article.thumbnail ?? edited.thumbnail, source: '' } : article;
    });
    // Preserve the previous collection in the existing revision system.
    if (old) await tx.revision.create({ data: { entityType: 'text_block_translation', entityId: old.id, snapshot: old as unknown as Prisma.InputJsonValue } });
    const value = { articles } as unknown as Prisma.InputJsonValue;
    await tx.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } }, create: { textBlockId: block.id, locale: 'EN', value }, update: { value } });
    console.log(`Updated editorial copy for ${articles.length} news articles.`);
  });
}
main().finally(() => prisma.$disconnect());
