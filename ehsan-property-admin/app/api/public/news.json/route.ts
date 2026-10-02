import { publicRoute } from '@/lib/server/route';
import { readNews } from '@/lib/server/news';
import { latestNews } from '@/lib/news';

export const runtime = 'nodejs';
export const GET = publicRoute(async () => {
  const { articles } = await readNews();
  return Response.json({ articles: latestNews(articles.filter(article => article.published && !article.archived && Date.parse(article.date) <= Date.now())) }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
});
