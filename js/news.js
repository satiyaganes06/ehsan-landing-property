(async () => {
  const list = document.querySelector('[data-news-list]');
  const detail = document.querySelector('[data-news-detail]');
  if (!list && !detail) return;
  const admin = window.SITE?.adminOrigin || 'http://localhost:3001';
  const url = path => window.SITE.url(path);
  const imageUrl = path => /^https?:/.test(path) ? path : /^\/(media|live-site)\//.test(path) ? admin + path : url(path.replace(/^\//, ''));
  let payload;
  try { const response = await fetch(`${admin}/api/public/news.json`, { cache: 'no-store' }); if (!response.ok) throw new Error('Unavailable'); payload = await response.json(); }
  catch (_) {
    try { const response = await fetch(url('data/news.json')); if (!response.ok) throw new Error('Unavailable'); payload = await response.json(); }
    catch (_) { (list || detail).textContent = 'News is temporarily unavailable. Please try again later.'; return; }
  }
  const articles = (payload.articles || []).filter(article => article.published && !article.archived && Date.parse(article.date) <= Date.now()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
  const date = value => new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
  const safeBody = html => {
    const source = document.createElement('template'); source.innerHTML = html;
    const result = document.createDocumentFragment();
    const copy = (node, parent) => {
      if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG', 'SVG', 'MATH', 'FORM'].includes(node.tagName)) return;
      const element = document.createElement(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'].includes(node.tagName.toLowerCase()) ? node.tagName.toLowerCase() : 'span');
      for (const property of ['color', 'backgroundColor']) if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(node.style[property])) element.style[property] = node.style[property];
      if (['left', 'center', 'right', 'justify'].includes(node.style.textAlign)) element.style.textAlign = node.style.textAlign;
      for (const [name, size] of Object.entries({ 'ql-size-small': '.75em', 'ql-size-large': '1.5em', 'ql-size-huge': '2.5em' })) if (node.classList.contains(name)) element.style.fontSize = size;
      for (const alignment of ['center', 'right', 'justify']) if (node.classList.contains(`ql-align-${alignment}`)) element.style.textAlign = alignment;
      [...node.childNodes].forEach(child => copy(child, element)); parent.append(element);
    };
    [...source.content.childNodes].forEach(node => copy(node, result)); return result;
  };
  if (list) {
    const limit = Number(list.dataset.newsLimit || 0);
    const search = document.querySelector('[data-news-search]');
    const pagination = document.querySelector('[data-news-pagination]');
    let page = 0;
    const pageSize = 6;
    const paint = () => {
      let items = articles.filter(article => !search?.value || `${article.title} ${article.excerpt}`.toLowerCase().includes(search.value.toLowerCase()));
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, pages - 1);
      items = limit ? items.slice(0, limit) : items.slice(page * pageSize, (page + 1) * pageSize);
      const fragment = document.createDocumentFragment();
      items.forEach(article => {
        const card = document.createElement('a'); card.className = 'news-card'; card.href = url(`html/news-detail.html?news=${encodeURIComponent(article.id)}`);
        const thumbnail = article.thumbnail ?? article.images[0];
        if (thumbnail) { const image = document.createElement('img'); image.src = imageUrl(thumbnail); image.alt = article.title; image.loading = 'lazy'; image.decoding = 'async'; card.append(image); }
        const body = document.createElement('div'); body.className = 'news-card__body';
        const time = document.createElement('time'); time.dateTime = article.date; time.textContent = date(article.date);
        const title = document.createElement('h3'); title.textContent = article.title;
        const excerpt = document.createElement('p'); excerpt.textContent = article.subtitle || '';
        const more = document.createElement('span'); more.className = 'news-card__more'; more.textContent = 'Read more ↗';
        body.append(time, title, excerpt, more); card.append(body); fragment.append(card);
      });
      if (!items.length) { const empty = document.createElement('p'); empty.textContent = search?.value ? 'No news matches your search.' : 'No news published yet.'; fragment.append(empty); }
      list.replaceChildren(fragment);
      if (pagination) {
        pagination.replaceChildren();
        const count = document.createElement('p'); count.textContent = total ? `Showing ${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} of ${total} ${total === 1 ? 'article' : 'articles'}` : 'No articles'; pagination.append(count);
        const button = (label, next, disabled = false) => { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.disabled = disabled; if (next === page && /^\d+$/.test(label)) item.setAttribute('aria-current', 'page'); item.addEventListener('click', () => { page = next; paint(); list.scrollIntoView({ block: 'start', behavior: 'auto' }); }); pagination.append(item); };
        if (pages > 1) { button('Previous', page - 1, page === 0); for (let i = 0; i < pages; i++) button(String(i + 1), i); button('Next', page + 1, page === pages - 1); }
      }
    };
    search?.addEventListener('input', () => { page = 0; paint(); }); paint();
  }
  if (detail) {
    const article = articles.find(item => item.id === new URLSearchParams(location.search).get('news'));
    if (!article) { detail.textContent = 'This article is not available.'; return; }
    document.title = `${article.title} — Ehsan News`;
    const header = document.createElement('header'); header.className = 'section__head';
    const time = document.createElement('p'); time.className = 'section__label'; time.textContent = `Published ${date(article.date)}`;
    const title = document.createElement('h1'); title.className = 'section__title'; title.textContent = article.title; header.append(time, title);
    const summary = document.createElement('p'); summary.className = 'section__lede'; summary.textContent = article.excerpt; header.append(summary);
    const hero = document.createElement('figure'); hero.className = 'news-article__hero';
    const leadImage = article.thumbnail || article.images[0];
    if (leadImage) { const image = document.createElement('img'); image.src = imageUrl(leadImage); image.alt = article.title; image.fetchPriority = 'high'; image.decoding = 'async'; hero.append(image); }
    const body = document.createElement('div'); body.className = 'news-body'; body.append(safeBody(article.body));
    const gallery = document.createElement('div'); gallery.className = 'news-gallery';
    article.images.filter(path => path !== leadImage).forEach((path, i) => { const image = document.createElement('img'); image.src = imageUrl(path); image.alt = `${article.title} — additional photo ${i + 1}`; image.loading = 'lazy'; image.decoding = 'async'; gallery.append(image); });
    const videos = document.createElement('div'); videos.className = 'news-gallery';
    (article.videos || []).filter(path => { try { return ['http:', 'https:'].includes(new URL(path).protocol); } catch (_) { return false; } }).forEach(path => { const video = document.createElement('video'); video.src = path; video.controls = true; video.preload = 'none'; videos.append(video); });
    detail.replaceChildren(header);
    if (leadImage) detail.append(hero);
    detail.append(body);
    if (gallery.childElementCount) { const galleryHeading = document.createElement('h2'); galleryHeading.className = 'news-article__gallery-title'; galleryHeading.textContent = 'In pictures'; detail.append(galleryHeading, gallery); }
    if (videos.childElementCount) detail.append(videos);
    window.EhsanShare?.render({ kind: 'news', id: article.id, title: article.title, description: article.subtitle || article.excerpt, image: imageUrl(article.thumbnail || article.images[0] || 'assets/logo/epp_logo.png') }, header);
    try { const source = new URL(article.source); if (['https:', 'http:'].includes(source.protocol)) { const link = document.createElement('a'); link.className = 'topnav__cta news-related'; link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Read related article ↗'; detail.append(link); } } catch (_) { /* Optional link is hidden when empty or invalid. */ }
  }
})();
