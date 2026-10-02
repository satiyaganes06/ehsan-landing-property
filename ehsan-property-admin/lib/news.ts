import { z } from 'zod';

const safeUrl = z.string().max(2000).refine(value => { try { return !value || ['http:', 'https:'].includes(new URL(value, 'https://ehsan.invalid').protocol); } catch { return false; } }, 'Use a safe image or source URL.');
export const newsArticleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), title: z.string().min(1).max(500),
  date: z.string().datetime({ offset: true }), excerpt: z.string().max(2000), body: z.string().max(50000),
  subtitle: z.string().max(200).default(''), thumbnail: safeUrl.default(''),
  images: z.array(safeUrl).max(40), videos: z.array(safeUrl).max(10), source: safeUrl,
  published: z.boolean(), archived: z.boolean(),
});
export const newsSchema = z.object({ articles: z.array(newsArticleSchema).max(500).refine(articles => new Set(articles.map(article => article.id)).size === articles.length, 'Article IDs must be unique.') });
export type NewsArticle = z.infer<typeof newsArticleSchema>;
export const latestNews = (articles: NewsArticle[]) => [...articles].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
