import { prisma } from '@/lib/server/prisma';
import { readNews } from '@/lib/server/news';
import { mediaUrl } from '@/lib/server/media-url';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const plain = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Social crawlers get complete metadata without executing the static site's JS.
 * Visitors continue to the same published project/article, not an admin screen.
 */
export const GET = publicRoute<{ kind: string; id: string }>(async ({ params, request }) => {
  const { kind, id } = params;
  if (!['project', 'news'].includes(kind) || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response('Not found', { status: 404 });
  const origin = request.nextUrl.origin;
  const landing = new URL(process.env.NEXT_PUBLIC_LANDING_URL || (['localhost', '127.0.0.1'].includes(request.nextUrl.hostname) ? 'http://localhost:8899/' : 'https://ehsanproperty.com/'));
  if (!['https:', 'http:'].includes(landing.protocol)) throw new Error('Invalid landing URL configuration');
  if (!landing.pathname.endsWith('/')) landing.pathname += '/';
  let title = '', description = '', image = '', published = '';
  if (kind === 'project') {
    const project = await prisma.project.findFirst({ where: { reference: id, publishState: 'PUBLISHED' }, include: { translations: { where: { locale: 'EN' } }, media: { orderBy: { sortOrder: 'asc' }, include: { media: true } } } });
    const translation = project?.translations[0];
    if (!project || !translation) return new Response('Not found', { status: 404 });
    title = translation.name;
    description = plain(translation.description || `${translation.name} in ${translation.location}. Discover this Ehsan development.`).slice(0, 200);
    const thumbnail = project.media.find(item => item.role === 'thumbnail') || project.media.find(item => ['hero', 'gallery'].includes(item.role));
    if (thumbnail) image = new URL(mediaUrl(thumbnail.media.storageKey), origin).href;
  } else {
    const { articles } = await readNews();
    const article = articles.find(item => item.id === id && item.published && !item.archived && Date.parse(item.date) <= Date.now());
    if (!article) return new Response('Not found', { status: 404 });
    title = article.title;
    description = plain(article.subtitle || article.excerpt).slice(0, 200);
    published = article.date;
    const thumbnail = article.thumbnail || article.images[0];
    if (thumbnail) image = new URL(thumbnail.startsWith('/media/') || thumbnail.startsWith('/live-site/') ? thumbnail : `live-site/${thumbnail.replace(/^\//, '')}`, origin).href;
    if (thumbnail && /^https?:\/\//.test(thumbnail)) image = thumbnail;
  }
  if (!image) image = new URL('/live-site/assets/logo/epp_logo.png', origin).href;
  const destination = new URL(kind === 'project' ? 'html/project-detail.html' : 'html/news-detail.html', landing);
  destination.searchParams.set(kind === 'project' ? 'project' : 'news', id);
  const shareUrl = new URL(`/api/public/share/${kind}/${encodeURIComponent(id)}`, origin).href;
  const meta = (name: string, value: string, property = true) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escape(value)}">`;
  const html = `<!doctype html><html lang="en" prefix="og: https://ogp.me/ns#"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} — Ehsan Plant &amp; Property</title>
${meta('description', description, false)}<link rel="canonical" href="${escape(shareUrl)}">
${meta('og:title', title)}${meta('og:description', description)}${meta('og:type', kind === 'news' ? 'article' : 'website')}${meta('og:url', shareUrl)}${meta('og:site_name', 'Ehsan Plant & Property')}${meta('og:locale', 'en_MY')}${meta('og:image', image)}${meta('og:image:alt', title)}
${meta('twitter:card', 'summary_large_image', false)}${meta('twitter:title', title, false)}${meta('twitter:description', description, false)}${meta('twitter:image', image, false)}${meta('twitter:image:alt', title, false)}${published ? meta('article:published_time', published) : ''}
</head><body><main><img src="${escape(image)}" alt="${escape(title)}" style="max-width:100%;height:auto"><h1>${escape(title)}</h1><p>${escape(description)}</p><a href="${escape(destination.href)}">View ${kind === 'news' ? 'article' : 'project'}</a></main><script>location.replace(${JSON.stringify(destination.href).replace(/</g, '\\u003c')});</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
});
