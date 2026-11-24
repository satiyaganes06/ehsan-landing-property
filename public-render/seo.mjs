export const origin = 'https://ehsanproperty.com';
export const templates = { projects: 'project', events: 'event', news: 'news' };
export const mainPaths = ['/', '/about', '/projects', '/events', '/news', '/project-licensing/', '/ai-instructions/'];
export function records(kind, data) {
  return kind === 'news' ? data.articles.filter(a => a.published && !a.archived && Date.parse(a.date) <= Date.now()) : Object.values(data);
}
export function slug(r) {
  return String(r.slug || r.name || r.title || r.id || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80);
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function sitemap(paths) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...new Set(paths)].map(p => '  <url><loc>' + origin + escape(p) + '</loc></url>').join('\n') + '\n</urlset>\n';
}
export function archive(template, kind, items) {
  const links = items.map(r => '<li><a href="/' + kind + '/' + slug(r) + '">' + escape(r.title) + '</a></li>');
  return template.replace(/<!-- public-links -->[\s\S]*?<!-- end-public-links -->/, () =>
    '<!-- public-links --><ul>' + links.join('\n') + '</ul><!-- end-public-links -->');
}
export function detail(template, kind, r) {
  const name = r.name || r.title;
  const title = escape(r.seo?.metaTitle || name + ' | Ehsan Plant & Property');
  const summary = escape(r.excerpt || r.description || [name,r.location].filter(Boolean).join(' in '));
  const url = origin + '/' + kind + '/' + slug(r);
  const seo = r.seo || {};
  const canonical = /^https?:\/\//i.test(seo.canonicalUrl || '') ? seo.canonicalUrl : url;
  const cover = r.thumbnail || r.image || r.media?.thumbnail || r.media?.image?.[0];
  const rawImage = seo.ogImage || (cover === 'widuri/elevation-front.jpg' ? 'widuri/social-cover.jpg' : cover);
  let image = origin + '/assets/logo/epp_logo.png';
  if (typeof rawImage === 'string' && rawImage && !rawImage.startsWith('//')) {
    const path = rawImage.replace(/^\/live-site\/assets\//, '/assets/');
    if (/^https?:\/\//i.test(path) || path.startsWith('/') || path.startsWith('assets/')) image = new URL(path,origin).href;
    else if (!path.includes(':') && !path.split('/').includes('..')) image = new URL('/assets/img/' + path,origin).href;
  }
  const socialTitle = seo.ogTitle ? escape(seo.ogTitle) : title;
  const socialDescription = escape(seo.ogDescription || seo.metaDescription || r.excerpt || r.description || name);
  const crumbs = { '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement: [
    ['Home',origin + '/'], [kind[0].toUpperCase() + kind.slice(1),origin + '/' + kind], [name,url]
  ].map(([name,item],i) => ({'@type':'ListItem',position:i+1,name,item})) };
  const article = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: name,
    mainEntityOfPage: url, datePublished: r.date, image,
    publisher: {'@type': 'Organization', name: 'Ehsan Plant & Property', url: origin}
  };
  const schemas = kind === 'news' ? [crumbs, article] : [crumbs];
  const head = `<title>${title}</title>
<meta name="description" content="${r.seo?.metaDescription ? escape(r.seo.metaDescription) : summary}">
<link rel="canonical" href="${escape(canonical)}">
<meta name="robots" content="${seo.robotsIndex === false ? 'noindex' : 'index'}, ${seo.robotsFollow === false ? 'nofollow' : 'follow'}">
<meta property="og:title" content="${socialTitle}">
<meta property="og:description" content="${socialDescription}">
<meta property="og:url" content="${escape(canonical)}">
<meta property="og:type" content="${kind === 'news' ? 'article' : 'website'}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:alt" content="${escape(seo.ogImageAlt || r.imageAlts?.[cover] || name)}">
<meta name="twitter:title" content="${socialTitle}">
<meta name="twitter:description" content="${socialDescription}">
<meta name="twitter:image" content="${escape(image)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(schemas).replace(/</g,'\\u003c')}</script>`;
  return template.replace(/<title>.*?<\/title>/, () => head)
    .replace(/(id="eventHeroTitle">)<\/h1>/, (_,start) => start + escape(name) + '</h1>')
    .replace(/(id="(?:projectDescription|eventDescription)">)<\/p>/, (_,start) => start + summary + '</p>')
    .replace('<p class="project-loading" role="status">Loading project…</p>', '')
    .replace('<main class="widuri-experience" id="widuriExperience" hidden></main>', () => {
      const facts = [['Location', r.location], ['Development status', r.status], ['Units', r.units]]
        .filter(([, value]) => value);
      return `<main class="widuri-experience" id="widuriExperience"><section><h1>${escape(name)}</h1>
        ${r.enquiry?.sections?.overview === false ? '' : `<p>${summary}</p>`}
        ${r.enquiry?.sections?.specifications === false ? '' : `<dl class="project-facts">${facts.map(([label,value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`}
        ${r.buyerNotes ? '<h2>Buyer information</h2>' + r.buyerNotes.split(/\n\n/).map(p => '<p>' + escape(p) + '</p>').join('') : ''}
        <a href="/projects">Browse all projects</a></section></main>`;
    })
    .replace(/(id="(eventDateTime|eventLocation|eventHeroDate)">)<\/(div|p)>/g, (_,start,id,tag) =>
      start + escape(id === 'eventLocation' ? r.location : r.dateTime || r.date) + '</' + tag + '>')
    .replace('<noscript>Please enable JavaScript to read this article.</noscript>', '')
    .replace('<p role="status">Loading article…</p>', () => '<h1>' + escape(name) + '</h1><p>' + summary + '</p>' + newsText(r.body));
}

// Render the published article as plain text paragraphs before the rich-text client loads.
function newsText(body) {
  const text = String(body || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean)
    .map(line => '<p>' + escape(line).replace(/&amp;(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, '&$1;') + '</p>').join('');
}
