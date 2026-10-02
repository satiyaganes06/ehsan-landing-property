/* The editor inventories the real rendered homepage, preserving its markup and
   animations. Rich text is rebuilt using safe formatting tags and styles. */
(async () => {
  const adminOrigin = window.SITE?.adminOrigin || 'http://localhost:3001';
  const isAboutPage = /\/about\.html$/.test(location.pathname);
  let published;
  try {
    const response = await fetch(`${adminOrigin}/api/public/landing.json`, { cache: 'no-store' });
    if (response.ok) published = await response.json();
  } catch (_) { /* A complete static fallback remains available offline. */ }
  const imageUrl = value => value && (value.startsWith('/media/') || value.startsWith('/live-site/')) ? adminOrigin + value : value;
  const plain = value => String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const setText = (root, selector, value) => { const node = root.querySelector(selector); if (node && value != null) node.textContent = plain(value); };
  const setImage = (root, value, alt) => { if (!value) return; const image = root.querySelector('img'); if (image) { image.src = imageUrl(value); if (alt) image.alt = plain(alt); } };
  if (published) {
    const projectTemplate = document.querySelector('[data-project-id]');
    Object.keys(published.projects || {}).forEach(reference => {
      if (!projectTemplate || [...document.querySelectorAll('[data-project-id]')].some(card => card.dataset.projectId === reference)) return;
      const card = projectTemplate.cloneNode(true);
      card.dataset.projectId = reference;
      card.tabIndex = 0; card.setAttribute('role', 'link');
      card.addEventListener('keydown', event => { if (event.key === 'Enter') card.click(); });
      card.removeAttribute('data-reveal');
      card.addEventListener('click', () => { if (!new URLSearchParams(location.search).has('landing-editor')) location.href = window.SITE.url(`html/project-detail.html?project=${encodeURIComponent(reference)}`); });
      projectTemplate.parentElement.append(card);
    });
    document.querySelectorAll('[data-project-id]').forEach(card => {
      const project = published.projects?.[card.dataset.projectId];
      if (!project) { card.hidden = true; return; }
      setText(card, '.pcard__name', project.name);
      setText(card, '.pcard__loc', project.location);
      setText(card, '.pcard__desc', project.description);
      setText(card, '.tag', project.status);
      if (project.year) {
        const year = card.querySelector('.pcard__yr');
        if (year) { year.textContent = project.year; if (project.yearEnd) { const end = document.createElement('small'); end.textContent = project.yearEnd; year.append(end); } }
      }
      const dateParts = [project.year, project.yearEnd].flatMap(value => String(value || '').match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
      card.dataset.cmsYear = String(Math.max(0, ...dateParts));
      const thumbnail = project.media?.thumbnail || project.media?.image?.[0];
      if (thumbnail) setImage(card, /^https?:|^\//.test(thumbnail) ? thumbnail : window.SITE.url(`assets/img/${thumbnail}`), project.name);
    });
    const ledger = document.querySelector('.ledger');
    const latest = card => Number(card.dataset.cmsYear || 0);
    if (ledger) [...ledger.querySelectorAll(':scope > .pcard')]
      .sort((a, b) => latest(b) - latest(a))
      .forEach(card => ledger.append(card));
    const eventTemplate = document.querySelector('.event-card');
    Object.keys(published.events || {}).forEach(reference => {
      if (!eventTemplate || [...document.querySelectorAll('.event-card')].some(card => new URL(card.href).searchParams.get('event') === reference)) return;
      const card = eventTemplate.cloneNode(true);
      card.href = `html/event-detail.html?event=${encodeURIComponent(reference)}`;
      card.removeAttribute('data-reveal');
      eventTemplate.parentElement.append(card);
    });
    document.querySelectorAll('.event-card').forEach(card => {
      const event = published.events?.[new URL(card.href).searchParams.get('event')];
      if (!event) { card.hidden = true; return; }
      card.dataset.cmsRecord = event.id;
      setText(card, '.event-title', event.title); setText(card, '.event-category', event.category);
      setText(card, '.event-date-value', event.date); setImage(card, event.image, event.title);
      const stats = card.querySelectorAll('.event-stats span');
      [event.location, event.attendees || '', event.dateTime?.split('·').pop()?.trim() || ''].forEach((value, index) => { if (stats[index]) stats[index].textContent = value; });
    });
    const populate = (selector, items, paint) => {
      const cards = [...document.querySelectorAll(selector)];
      const template = cards[0];
      if (!template || !items) return;
      items.forEach((item, index) => {
        const card = cards[index] || template.cloneNode(true);
        if (!cards[index]) { card.removeAttribute('data-reveal'); template.parentElement.append(card); }
        card.dataset.cmsRecord = item.reference;
        card.hidden = false;
        paint(card, item);
      });
      cards.slice(items.length).forEach(card => { card.hidden = true; });
    };
    populate('.award-card', published.awards ? [...published.awards].sort((a, b) => Number(b.year) - Number(a.year)) : undefined, (card, item) => {
      setText(card, '.award-card__name', item.name); setText(card, '.award-card__desc', item.description);
      setText(card, '.award-card__year', item.year); setImage(card, item.image, item.name);
    });
    populate('[data-story]', published.testimonials, (card, item) => {
      setText(card, '.story__quote', item.quote); setText(card, '.story__name', item.author);
      setText(card, '.story__role', item.role); setText(card, '.story__label', item.groupLabel); setImage(card, item.image, item.author);
    });
    document.querySelectorAll('[data-story]').forEach(card => {
      const activate = () => document.querySelectorAll('[data-story]').forEach(story => {
        story.classList.toggle('is-active', story === card);
        story.querySelector('.story__body')?.setAttribute('aria-hidden', String(story !== card && matchMedia('(min-width: 1024px)').matches));
      });
      card.addEventListener('mouseenter', activate); card.addEventListener('focus', activate);
    });
  }
  if (/\/projects\.html$/.test(location.pathname)) {
    window.projectContentReady = true;
    window.dispatchEvent(new Event('ehsan:projects-ready'));
    return;
  }
  document.querySelectorAll('.awards-grid').forEach(grid => [...grid.querySelectorAll('.award-card')].sort((a, b) => Number(b.querySelector('.award-card__year')?.textContent) - Number(a.querySelector('.award-card__year')?.textContent)).forEach(card => grid.append(card)));
  const targets = new Map();
  // Never insert saved HTML into the live DOM. Rebuild only supported formatting
  // from an inert template, without URLs, event handlers, embeds or arbitrary CSS.
  function richFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const output = document.createDocumentFragment();
    const copy = (source, destination) => {
      if (source.nodeType === Node.TEXT_NODE) { destination.append(document.createTextNode(source.textContent)); return; }
      if (source.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'FORM'].includes(source.tagName)) return;
      const tag = source.tagName.toLowerCase();
      const element = document.createElement(['strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'br'].includes(tag) ? tag : 'span');
      if (['p', 'div'].includes(tag) && ((source.parentElement || source.parentNode).children.length > 1 || source.style.textAlign)) element.style.display = 'block';
      for (const property of ['color', 'backgroundColor']) {
        const color = source.style[property];
        if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(color)) element.style[property] = color;
      }
      const size = { 'ql-size-small': '.75em', 'ql-size-large': '1.5em', 'ql-size-huge': '2.5em' };
      Object.entries(size).forEach(([name, value]) => { if (source.classList.contains(name)) element.style.fontSize = value; });
      for (const align of ['left', 'center', 'right', 'justify']) {
        if (source.classList.contains(`ql-align-${align}`) || source.style.textAlign === align) { element.style.textAlign = align; element.style.display = 'block'; }
      }
      [...source.childNodes].forEach(child => copy(child, element));
      destination.append(element);
    };
    [...template.content.childNodes].forEach(child => copy(child, output));
    return output;
  }
  const fields = [];
  const roots = [...document.querySelectorAll(isAboutPage ? '.topnav, .content > section, .site-footer, .assistant' : '.topnav, .stage, .prelude, #gallery, #record, #news, #events, #awards, #testimonials, #commitment, #doctrine, #contact, .site-footer, .assistant')];
  const allowedUrl = value => {
    try { return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value, location.href).protocol); }
    catch (_) { return false; }
  };
  const editorStyle = document.createElement('style');
  editorStyle.textContent = '[hidden]{display:none!important}';
  document.head.append(editorStyle);
  roots.forEach((root, index) => {
    const ownId = isAboutPage && root.id && !['awards', 'commitment', 'doctrine'].includes(root.id) ? (root.id.startsWith('about-') ? root.id : `about-${root.id}`) : root.id;
    const group = ownId || (root.classList.contains('stage') ? 'hero' : root.classList.contains('prelude') ? 'about' : root.classList.contains('assistant') ? 'assistant' : root.classList.contains('site-footer') ? 'chrome-11' : `chrome-${index}`);
    root.dataset.cmsSection = group;
    const visit = (element, path) => {
      if (element.matches('script, style, svg, noscript, [data-cms-fixed], [data-news-list]')) return;
      if (element.parentElement?.hasAttribute('data-clone') && element.getAttribute('aria-hidden') === 'true') return;
      if (element.hasAttribute('data-count')) {
        const key = `${group}:${path}:count`;
        targets.set(key, { node: element, type: 'count', original: element.dataset.count });
        fields.push({ key, group, type: 'number', label: `Statistic: ${element.closest('li')?.textContent.trim() || element.textContent}`, value: element.dataset.count });
        return;
      }
      [...element.childNodes].forEach((node, i) => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
        const key = `${group}:${path}:text:${i}`;
        targets.set(key, { node, type: 'text', original: node.textContent });
        const managed = Boolean(element.closest('.scale, .pcard, .event-card, .award-card, [data-story]'));
        const category = element.closest('.section__head, h1, h2, h3, h4, .hero__eyebrow') ? 'Heading' : element.closest('.hero__actions, .btn, .topnav, .site-footer, .events-footer') ? 'Links and buttons' : element.closest('form') ? 'Form labels' : 'Content';
        const label = element.matches('em') ? 'Highlighted words' : element.className?.includes('eyebrow') ? 'Brand label' : element.closest('h1') ? (element.className?.includes('accent') ? 'Highlighted headline' : 'Headline') : element.closest('h2') ? 'Section title' : element.className?.includes('ghost') ? 'Section number' : element.className?.includes('label') ? 'Label' : element.className?.includes('copy') || element.className?.includes('lede') ? 'Introduction' : node.textContent.trim().slice(0, 65);
        if (/\w/.test(node.textContent)) fields.push({ key, group, type: 'text', category, managed, label, value: node.textContent });
      });
      for (const attribute of ['src', 'alt', 'href', 'placeholder', 'aria-label']) {
        if (!element.hasAttribute(attribute)) continue;
        const key = `${group}:${path}:${attribute}`;
        const value = element.getAttribute(attribute);
        targets.set(key, { node: element, type: attribute, original: value });
        const managed = Boolean(element.closest('.scale, .pcard, .event-card, .award-card, [data-story]'));
        const category = ['src', 'alt'].includes(attribute) ? 'Images' : attribute === 'href' ? 'Links and buttons' : 'Accessibility';
        fields.push({ key, group, type: attribute, category, managed, label: attribute === 'src' ? (group === 'hero' ? 'Background image' : (element.alt || 'Image').slice(0, 65)) : attribute === 'alt' ? 'Image description' : attribute === 'href' ? `${element.textContent.trim() || 'Link'} destination` : attribute === 'placeholder' ? 'Input placeholder' : 'Accessible label', value });
      }
      [...element.children].forEach((child, i) => visit(child, `${path}.${child.dataset.projectId || child.dataset.cmsRecord || i}`));
    };
    visit(root, '0');
    const key = `${group}:visible`;
    targets.set(key, { node: root, type: 'visible', original: 'true' });
    fields.push({ key, group, type: 'visible', label: 'Show this section', value: 'true' });
    if (root.parentElement?.classList.contains('content') && !root.classList.contains('about-close')) {
      targets.set(`${group}:order`, { node: root, type: 'order', original: String(index) });
      fields.push({ key: `${group}:order`, group, type: 'number', label: 'Section position (lower numbers appear first)', value: String(index) });
    }
  });
  const statistics = document.querySelector('.prelude .scale');
  const legacyStatisticValue = node => {
    const entry = [...targets.entries()].find(([, target]) => target.node === node);
    const value = entry ? published?.values?.[entry[0]] ?? entry[1].original : node?.textContent || '';
    const template = document.createElement('template');
    template.innerHTML = value;
    return template.content.textContent.trim();
  };
  const defaultStatistics = statistics ? [...statistics.children].map((card, index) => {
    const labels = [...card.querySelector('.scale__l').childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    const amount = legacyStatisticValue(card.querySelector('[data-count]'));
    const numeric = Number(amount);
    const value = Number.isFinite(numeric) ? numeric.toLocaleString('en-US', { maximumFractionDigits: 6 }) : amount;
    const unit = card.querySelector('sup') ? legacyStatisticValue(card.querySelector('sup').firstChild) : '';
    return { id: `stat-${index}`, value: `${value}${unit ? ` ${unit}` : ''}`, title: labels.map(legacyStatisticValue).join(' ') };
  }) : [];
  if (statistics) fields.push({ key: 'about:statistics', group: 'about', type: 'cards', category: 'Statistics', label: 'Statistic cards', value: JSON.stringify(defaultStatistics) });
  fields.forEach(field => { if (field.type === 'number' && field.key.includes(':count') && targets.get(field.key)?.node.closest('.scale')) field.managed = true; });
  const statisticGroups = [
    { element: statistics, key: 'about:statistics', defaults: defaultStatistics, numberClass: 'scale__n', labelClass: 'scale__l', tag: 'li', rendered: undefined },
  ];
  const legacyAttribute = (node, type) => {
    const entry = [...targets.entries()].find(([, target]) => target.node === node && target.type === type);
    return entry ? published?.values?.[entry[0]] ?? entry[1].original : node.getAttribute(type) || '';
  };
  const headingHtml = element => {
    if (!element) return '';
    const clone = element.cloneNode(true);
    const originalWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const pairs = [];
    while (originalWalker.nextNode() && cloneWalker.nextNode()) pairs.push([originalWalker.currentNode, cloneWalker.currentNode]);
    pairs.forEach(([original, copied]) => {
      const entry = [...targets.entries()].find(([, target]) => target.node === original && target.type === 'text');
      if (!entry || typeof published?.values?.[entry[0]] !== 'string') return;
      const value = published.values[entry[0]];
      if (published.values[`${entry[0]}:format`] === 'html') copied.replaceWith(richFragment(value));
      else copied.textContent = value;
    });
    return clone.innerHTML;
  };
  const groupedHeadings = roots.map(root => {
    const head = root.querySelector('.section__head') || (root.id === 'contact' ? root.querySelector('.outro__in') : null);
    if (!head) return null;
    const group = root.dataset.cmsSection;
    const nodes = { label: head.querySelector('.section__label'), title: head.querySelector('.section__title, .outro__motto'), introduction: head.querySelector('.section__lede') };
    const defaults = Object.fromEntries(Object.entries(nodes).map(([key, node]) => [key, headingHtml(node)]));
    fields.forEach(field => { const target = targets.get(field.key)?.node; if (target && Object.values(nodes).some(node => node?.contains(target))) field.managed = true; });
    fields.push({ key: `${group}:heading`, group, type: 'heading', category: 'Heading', label: 'Section heading', value: JSON.stringify(defaults) });
    return { group, nodes, defaults, rendered: null };
  }).filter(Boolean);
  if (isAboutPage) roots.filter(root => root.dataset.cmsSection.startsWith('about-')).forEach(root => {
    const candidates = [...root.querySelectorAll('p, blockquote, figcaption, h3, dt, dd, li, .seal')].filter(node => !node.closest('.section__head') && !node.querySelector('a'));
    candidates.filter(node => !candidates.some(parent => parent !== node && parent.contains(node))).forEach((node, index) => {
      fields.forEach(field => { const target = targets.get(field.key)?.node; if (target && node.contains(target)) field.managed = true; });
      const key = `${root.dataset.cmsSection}:content:${index}`;
      const original = headingHtml(node);
      targets.set(key, { node, type: 'html', original });
      fields.push({ key, group: root.dataset.cmsSection, type: 'html', category: node.matches('h3') ? 'Heading' : 'Content', label: node.matches('dd') ? node.previousElementSibling?.textContent.trim() || 'Value' : node.textContent.trim().slice(0, 65), value: original });
    });
  });
  const enquiryForm = document.querySelector('#contact [data-enquiry-form]');
  const enquiryIntro = document.querySelector('#contact .enquiry__intro');
  const defaultForm = enquiryForm ? {
    title: headingHtml(enquiryIntro?.querySelector('.enquiry__title')),
    subtitle: headingHtml(enquiryIntro?.querySelector('.enquiry__note')),
    button: legacyStatisticValue(enquiryForm.querySelector('[type="submit"]').firstChild),
    fields: [...enquiryForm.querySelectorAll('.field')].map(container => {
      const input = container.querySelector('input, select, textarea');
      const liveLabel = container.querySelector('label');
      const labelHtml = headingHtml(liveLabel);
      const template = document.createElement('template'); template.innerHTML = labelHtml; template.content.querySelector('abbr')?.remove();
      const options = input.tagName === 'SELECT' ? [...input.options] : [];
      return { id: input.name, label: template.innerHTML.trim(), type: input.tagName === 'TEXTAREA' ? 'textarea' : input.tagName === 'SELECT' ? 'select' : input.type,
        placeholder: options.length ? legacyStatisticValue(options[0].firstChild) : legacyAttribute(input, 'placeholder'),
        required: input.required, wide: container.classList.contains('field--wide'), help: '',
        options: options.slice(1).map(option => legacyStatisticValue(option.firstChild)),
      };
    }),
  } : null;
  let renderedForm;
  if (enquiryForm) {
    fields.forEach(field => { const node = targets.get(field.key)?.node; if (node && (enquiryForm.contains(node) || enquiryIntro?.contains(node))) field.managed = true; });
    fields.push({ key: 'contact:form', group: 'contact', type: 'contact-form', category: 'Enquiry form', label: 'Enquiry form', value: JSON.stringify(defaultForm) });
  }
  const gallery = document.querySelector('#gallery .gallery-rows');
  const defaultPhotos = gallery ? [...gallery.querySelectorAll('.hscroll__track > .hscroll__half:first-child img')].map((image, index) => ({ id: `gallery-${index}`, src: legacyAttribute(image, 'src'), alt: legacyAttribute(image, 'alt') })) : [];
  if (gallery) {
    fields.forEach(field => { const target = targets.get(field.key)?.node; if (target && gallery.contains(target)) field.managed = true; });
    fields.push({ key: 'gallery:images', group: 'gallery', type: 'gallery-images', category: 'Images', label: 'Gallery images', value: JSON.stringify(defaultPhotos) });
  }
  let renderedPhotos;
  const balanceStatistics = () => {
    statisticGroups.forEach(({ element: statistics, numberClass }) => {
    if (!statistics || !statistics.children.length) return;
    const maximum = Math.max(1, Math.min(6, Math.floor((statistics.clientWidth + 1) / 177)));
    const count = statistics.children.length;
    const columns = Math.ceil(count / Math.ceil(count / maximum));
    statistics.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    statistics.querySelectorAll(`.${numberClass}`).forEach(number => {
      number.style.fontSize = '';
      const available = number.clientWidth;
      const required = number.scrollWidth;
      if (available && required > available) {
        const size = parseFloat(getComputedStyle(number).fontSize);
        number.style.fontSize = `${size * available / required * .97}px`;
      }
    });
    });
  };
  if (typeof ResizeObserver !== 'undefined') statisticGroups.forEach(({ element }) => { if (element) new ResizeObserver(balanceStatistics).observe(element); });
  document.fonts?.ready.then(balanceStatistics);
  for (const [selector, key, label, type] of [
    ['title', 'seo:title', 'Browser title', 'text'],
    ['meta[name="description"]', 'seo:description', 'Search description', 'content'],
  ]) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const original = type === 'text' ? node.textContent : node.getAttribute(type);
    const fieldKey = isAboutPage ? key.replace('seo:', 'about-seo:') : key;
    targets.set(fieldKey, { node, type, original });
    fields.push({ key: fieldKey, group: 'seo', type: isAboutPage ? 'plain' : 'text', category: isAboutPage ? 'Search settings' : undefined, label, value: original });
  }
  const settings = [
    ['--brass', 'Brand accent', '#ebf212'],
    ['--brass-ink', 'Readable accent text', '#585c00'],
    ['--c-ground', 'Section background', '#ffffff'],
    ['--c-ink', 'Main text', '#12110d'],
    ['--c-dim', 'Secondary text', '#55534a'],
  ];
  settings.forEach(([key, label, value]) => fields.push({ key: `theme:${key}`, group: 'theme', type: 'color', label, value }));
  fields.push({ key: 'motion:enabled', group: 'theme', type: 'visible', label: 'Enable animations', value: 'true' });
  if (document.getElementById('doctrine') && !isAboutPage) fields.push({ key: 'doctrine:background', group: 'doctrine', type: 'src', label: 'Background photograph', value: 'assets/img/background/bg-3.jpg' });
  function apply(values = {}) {
    targets.forEach((target, key) => {
      const { node, type, original } = target;
      const value = typeof values[key] === 'string' ? values[key] : original;
      if (type === 'html') node.replaceChildren(richFragment(value));
      else if (type === 'text') {
        const rich = (values[`${key}:format`] === 'html' && Object.hasOwn(values, key) && node.nodeType !== Node.ELEMENT_NODE) || target.rich;
        if (rich) {
          if (!target.rich) {
            const wrapper = document.createElement('span');
            wrapper.className = 'cms-rich';
            node.replaceWith(wrapper);
            target.node = wrapper;
            target.rich = true;
          }
          if (values[`${key}:format`] === 'html' && Object.hasOwn(values, key)) {
            target.node.replaceChildren(richFragment(value));
            if (/^\s/.test(original)) target.node.prepend(document.createTextNode(' '));
            if (/\s$/.test(original)) target.node.append(document.createTextNode(' '));
          } else target.node.textContent = value;
        } else node.textContent = value;
      }
      else if (type === 'visible') node.hidden = value === 'false' || values[`${key.replace(/:visible$/, '')}:deleted`] === 'true';
      else if (type === 'order') return;
      else if (type === 'count') {
        if (Number.isFinite(Number(value))) {
          node.dataset.count = value;
          const decimals = Number(node.dataset.dp || 0);
          node.textContent = Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
      }
      else if (!['src', 'href'].includes(type) || allowedUrl(value)) node.setAttribute(type, isAboutPage && ['src', 'href'].includes(type) && /^(assets\/|html\/|index\.html)/.test(value) ? window.SITE.url(value) : value);
    });
    groupedHeadings.forEach(heading => {
      const raw = values[`${heading.group}:heading`] ?? JSON.stringify(heading.defaults);
      if (raw === heading.rendered) return;
      try {
        const data = JSON.parse(raw);
        Object.entries(heading.nodes).forEach(([key, node]) => {
          if (!node) return;
          const fragment = richFragment(String(data[key] || ''));
          node.hidden = !fragment.textContent.trim();
          node.replaceChildren(fragment);
        });
        heading.rendered = raw;
      } catch (_) { /* Preserve valid heading if saved input is malformed. */ }
    });
    if (enquiryForm) {
      const raw = values['contact:form'] ?? JSON.stringify(defaultForm);
      if (raw !== renderedForm) {
        try {
          const config = JSON.parse(raw);
          if (!Array.isArray(config.fields) || config.fields.length > 20 || new Set(config.fields.map(field => field.id)).size !== config.fields.length) throw new Error('Invalid form');
          const fragment = document.createDocumentFragment();
          config.fields.forEach(field => {
            if (!/^[a-zA-Z0-9_-]{1,100}$/.test(field.id) || !['text', 'email', 'tel', 'textarea', 'select'].includes(field.type)) throw new Error('Invalid field');
            const container = document.createElement('div'); container.className = `field${field.wide ? ' field--wide' : ''}`;
            const label = document.createElement('label'); label.className = 'field__label'; label.htmlFor = `enquiry-${field.id}`; label.append(richFragment(String(field.label || '')));
            if (field.required) { const marker = document.createElement('abbr'); marker.title = 'required'; marker.textContent = ' *'; label.append(marker); }
            const input = document.createElement(field.type === 'textarea' ? 'textarea' : field.type === 'select' ? 'select' : 'input');
            input.id = label.htmlFor; input.name = field.id; input.required = Boolean(field.required);
            input.className = `field__input${field.type === 'textarea' ? ' field__input--area' : field.type === 'select' ? ' field__input--select' : ''}`;
            if (field.type === 'select') {
              const prompt = document.createElement('option'); prompt.value = ''; prompt.textContent = field.placeholder || 'Select an option'; input.append(prompt);
              (field.options || []).forEach(text => { const option = document.createElement('option'); option.textContent = text; option.value = text; input.append(option); });
            } else { input.placeholder = field.placeholder || ''; if (field.type === 'textarea') input.rows = 4; else input.type = field.type; }
            if (['name', 'email', 'phone'].includes(field.id)) input.autocomplete = { name: 'name', email: 'email', phone: 'tel' }[field.id];
            container.append(label, input);
            if (field.help) { const help = document.createElement('p'); help.className = 'field__help'; help.id = `${input.id}-help`; help.append(richFragment(String(field.help))); input.setAttribute('aria-describedby', help.id); container.append(help); }
            fragment.append(container);
          });
          const actions = enquiryForm.querySelector('.enquiry__actions');
          enquiryForm.querySelectorAll('.field').forEach(field => field.remove()); enquiryForm.insertBefore(fragment, actions);
          actions.querySelector('[type="submit"]').textContent = config.button || 'Send enquiry';
          for (const [selector, key] of [['.enquiry__title', 'title'], ['.enquiry__note', 'subtitle']]) { const node = enquiryIntro?.querySelector(selector); if (node) { const content = richFragment(String(config[key] || '')); node.hidden = !content.textContent.trim(); node.replaceChildren(content); } }
          renderedForm = raw;
        } catch (_) { /* Preserve the previous form for malformed settings. */ }
      }
    }
    if (gallery) {
      const raw = values['gallery:images'] ?? JSON.stringify(defaultPhotos);
      if (raw !== renderedPhotos) {
        try {
          const photos = JSON.parse(raw);
          if (!Array.isArray(photos) || photos.length > 30) throw new Error('Invalid gallery');
          const rows = [...gallery.querySelectorAll('.hscroll')];
          const perRow = Math.ceil(photos.length / rows.length);
          rows.forEach((row, index) => {
            const items = photos.slice(index * perRow, (index + 1) * perRow);
            row.hidden = !items.length;
            const track = row.querySelector('.hscroll__track');
            const half = document.createElement('div'); half.className = 'hscroll__half';
            items.forEach(photo => {
              if (!allowedUrl(photo.src) || !/^https?:$/.test(new URL(photo.src, location.href).protocol)) return;
              const figure = document.createElement('figure'); figure.className = 'gallery-shot';
              const image = document.createElement('img'); image.src = imageUrl(photo.src); image.alt = String(photo.alt || ''); image.loading = 'lazy'; image.decoding = 'async';
              figure.append(image); half.append(figure);
            });
            const clone = half.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
            track.replaceChildren(half, clone);
          });
          gallery.hidden = !photos.length;
          renderedPhotos = raw;
        } catch (_) { /* Keep the previous usable carousel. */ }
      }
    }
    statisticGroups.forEach(group => {
      const statistics = group.element;
      if (!statistics) return;
      const raw = values[group.key] ?? JSON.stringify(group.defaults);
      if (raw !== group.rendered) {
        try {
          const cards = JSON.parse(raw);
          if (!Array.isArray(cards) || cards.length > 30) throw new Error('Invalid statistic cards');
          const fragment = document.createDocumentFragment();
          cards.forEach(card => {
            const item = document.createElement(group.tag);
            const number = document.createElement('span'); number.className = group.numberClass;
            const amount = document.createElement('span');
            amount.textContent = `${String(card.value || '')}${card.unit ? ` ${card.unit}` : ''}`;
            number.append(amount);
            const label = document.createElement('span'); label.className = group.labelClass;
            const title = document.createElement('span'); title.append(richFragment(String(card.title || ''))); label.append(title);
            if (card.subtitle) { const subtitle = document.createElement('span'); subtitle.append(richFragment(String(card.subtitle))); label.append(document.createTextNode(' '), subtitle); }
            item.append(number, label); fragment.append(item);
          });
          statistics.replaceChildren(fragment);
          statistics.hidden = cards.length === 0;
          balanceStatistics();
          group.rendered = raw;
        } catch (_) { /* Keep the previous usable grid for malformed data. */ }
      }
    });
    document.querySelectorAll('[data-clone]').forEach(track => {
      const originals = track.firstElementChild?.querySelectorAll('img');
      [...track.children].slice(1).forEach(copy => copy.querySelectorAll('img').forEach((image, index) => {
        if (originals?.[index]) { image.src = originals[index].src; image.alt = originals[index].alt; }
      }));
    });
    [...targets.entries()].filter(([, target]) => target.type === 'order')
      .sort(([a, first], [b, second]) => (Number(values[a] ?? first.original) || 0) - (Number(values[b] ?? second.original) || 0))
      .forEach(([, target]) => { const parent = target.node.parentElement; const closing = isAboutPage ? parent.querySelector(':scope > .about-close') : null; parent.insertBefore(target.node, closing); });
    document.querySelectorAll('.topnav a, nav[aria-label="Section navigation"] a, .hero__actions a').forEach(link => {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const section = roots.find(root => root.id === url.hash.slice(1) || root.dataset.cmsSection === (url.hash.slice(1) === 'prelude' ? 'about' : url.hash.slice(1)));
      if (section) { const group = section.dataset.cmsSection; link.hidden = values[`${group}:deleted`] === 'true' || values[`${group}:visible`] === 'false'; }
    });
    settings.forEach(([key, , original]) => {
      const value = values[`theme:${key}`] || original;
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        document.documentElement.style.setProperty(key, value);
        if (key === '--brass') document.documentElement.style.setProperty('--accent', value);
        document.querySelector('.content')?.style.setProperty(key, value);
      }
    });
    const savedBackground = values['doctrine:background'];
    const background = isAboutPage && savedBackground && /^assets\//.test(savedBackground) ? window.SITE.url(savedBackground) : savedBackground;
    editorStyle.textContent = '[hidden]{display:none!important}' +
      (background && allowedUrl(background) ? `#doctrine::before{background-image:linear-gradient(rgba(8,8,6,.82),rgba(8,8,6,.82)),url(${JSON.stringify(background).replace(/</g, '')})}` : '') +
      (values['motion:enabled'] === 'false' ? '*,*::before,*::after{animation:none!important;transition:none!important}[data-reveal],[data-ripple]{opacity:1!important;transform:none!important}.hero-camera{transform:none!important}' : '');
  }
  const editing = new URLSearchParams(location.search).get('landing-editor') === '1' && parent !== window;
  if (editing) {
    const send = () => parent.postMessage({ type: 'ehsan:landing-fields', fields }, adminOrigin);
    window.addEventListener('message', event => {
      if (event.origin !== adminOrigin || event.source !== parent) return;
      if (event.data?.type === 'ehsan:landing-request') send();
      if (event.data?.type === 'ehsan:landing-preview') apply(event.data.values);
      if (event.data?.type === 'ehsan:landing-focus') {
        const root = roots.find(element => element.dataset.cmsSection === event.data.group);
        root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    send();
    document.addEventListener('click', event => {
      if (event.target.closest('a, .pcard')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  }
  if (!editing) apply(published?.values);
  window.projectContentReady = true;
  window.dispatchEvent(new Event('ehsan:projects-ready'));
})();
