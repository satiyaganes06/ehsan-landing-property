import 'server-only';
import { prisma } from './prisma';
import { newsSchema } from '../news';
import importedNews from '../../data/news.json';

export const newsKey = 'news.articles';
export async function readNews() {
  const row = await prisma.textBlock.findUnique({ where: { key: newsKey }, include: { translations: { where: { locale: 'EN' } } } });
  const data = (row?.translations[0]?.value ?? importedNews) as { articles: Array<Record<string, unknown>> };
  return newsSchema.parse({ articles: data.articles.map(article => ({ ...article, thumbnail: article.thumbnail ?? (article.images as string[] | undefined)?.[0] ?? '', subtitle: article.subtitle ?? '' })) });
}
