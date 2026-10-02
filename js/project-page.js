/* Shared, mobile-first project presentation. No invented project copy. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const section = (key, title, content) => `<section class="project-chapter" data-project-section="${key}" id="project-${key}"><p class="project-eyebrow">${escape(title)}</p>${content}</section>`;
  const picture = (src, alt, priority = false) => `<button type="button" class="project-picture" aria-label="View ${escape(alt)} full size"><img src="${escape(src)}" alt="${escape(alt)}" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'}></button>`;
  function sectionMotion(root) {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
    const sections = [...root.querySelectorAll(':scope > section:not([hidden])'), document.querySelector('#project-enquiry')].filter(element => element && !element.hidden);
    const running = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        entry.target.dataset.motion = 'revealed';
        if (preference.matches) return;
        [...entry.target.children].filter(child => !child.hidden).forEach((child, index) => {
          const animation = child.animate([
            { opacity: 0, transform: 'translateY(24px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 650, delay: Math.min(index * 75, 225), easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'backwards' });
          running.add(animation);
          animation.finished.then(() => running.delete(animation), () => running.delete(animation));
        });
      });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
    sections.forEach(section => { section.dataset.motion = 'pending'; observer.observe(section); });
    preference.addEventListener('change', () => {
      if (!preference.matches) return;
      observer.disconnect();
      running.forEach(animation => animation.cancel());
      sections.forEach(section => { section.dataset.motion = 'revealed'; });
    });
  }
  function hero(data, src) {
    const formIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';
return `<header class="project-lead${src ? ' project-lead--has-image' : ''}" data-project-section="hero" id="project-hero"><div class="project-lead__copy"><a class="project-back" href="projects.html">← All projects</a><h1>${escape(data.name)}</h1><p class="project-lead__location">${escape(data.location)}</p><div class="project-lead__actions">${data.enquiry?.enabled ? `<a class="project-primary" href="#project-enquiry">Register your interest ${formIcon}</a>` : '<a class="project-primary" href="../index.html#contact">Contact our team ↗</a>'}<div data-project-share></div></div></div>${src ? `<div class="project-picture project-picture--static"><img src="${escape(src)}" alt="${escape(data.name)}" fetchpriority="high"></div>` : ''}</header>`;
  }
  function generic(data) {
    if (data.content?.template === 'widuri-sections-v1') return structured(data);
    const root = document.getElementById('widuriExperience');
    document.querySelector('.hero-wrapper').hidden = true;
    root.hidden = false;
    const lead = data.media?.image?.[0] || data.media?.thumbnail;
    // The original demo seeded unrelated proj-*.jpg photos into every gallery
    // and blueprint list. Keep the assigned cover, not those sample fillers.
    // Real uploaded media and project-specific folders remain untouched.
    const demoPhoto = image => /^proj-[^/]+\.jpg$/i.test(image);
    const images = [...new Set(data.media?.image || [])].filter(image => image === lead || !demoPhoto(image));
    const plans = [...new Set(data.media?.blueprint || [])].filter(image => !demoPhoto(image));
    const facts = [['Units', data.units], ['Land area', data.area], ['Price / value', data.priceRange], ['Status', data.occupancy || data.status], ['Year', data.yearEnd || data.year]] .filter(([, value]) => value);
    root.innerHTML = hero(data, lead ? imgUrl(lead) : '')
      + (data.description ? section('overview', 'Overview', `<h2>About this project</h2><p class="project-prose">${escape(data.description)}</p>`) : '')
      + (facts.length ? section('specifications', 'Project at a glance', `<dl class="project-facts">${facts.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`) : '')
      + (data.amenities?.length ? section('amenities', 'Features & amenities', `<h2>Details that make a difference</h2><ul class="project-feature-list">${data.amenities.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`) : '')
      + (plans.length ? section('layouts', 'Floor plans', `<h2>Explore the layouts</h2><div class="project-picture-grid">${plans.map((image, i) => picture(imgUrl(image), `${data.name} floor plan ${i + 1}`)).join('')}</div>`) : '')
      + (images.length > 1 ? section('facilities', 'In pictures', `<h2>A closer look</h2><div class="project-picture-grid">${images.slice(1).map((image, i) => picture(imgUrl(image), `${data.name} photo ${i + 2}`)).join('')}</div>`) : '')
      + (data.coordinates ? section('location', 'Location', `<h2>${escape(data.location)}</h2><iframe class="project-map" title="Map of ${escape(data.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(data.coordinates.lat + ',' + data.coordinates.lng)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`) : '')
      + (data.certificate ? section('certificate', 'Completion', `<h2>Project record</h2><p class="project-prose">${escape(data.certificate)}</p>`) : '')
      + section('cta', 'Speak to our team', `<h2>Find out more about ${escape(data.name)}</h2><a class="project-primary" href="${data.enquiry?.enabled ? '#project-enquiry' : '../index.html#contact'}">Contact sales ↗</a>`);
  }
  // Same section order as Widuri; a section exists only when it has content.
  function structured(data) {
    const root = document.getElementById('widuriExperience');
    document.querySelector('.hero-wrapper').hidden = true;
    root.hidden = false;
    const content = data.content;
    root.dataset.projectTemplate = content.template;
    const media = data.media || {};
    const list = items => `<ul class="project-feature-list">${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
    const gallery = (items, label) => `<div class="project-picture-grid">${items.map((image, i) => picture(imgUrl(image), `${data.name} ${label} ${i + 1}`)).join('')}</div>`;
    const facts = content.facts?.length ? content.facts : content.sourceOnly ? [] : [['Units', data.units], ['Area', data.area], ['Starting price', data.priceRange]].filter(([, value]) => value);
    const facilities = content.facilities?.length ? content.facilities : data.amenities || [];
    const photos = [...new Set([...(media.image || []).slice(1), ...(media.interior || [])])];
    const locationImages = media.location || [];
    const logo = media.logo?.[0];
    root.innerHTML = hero(data, media.image?.[0] || media.thumbnail ? imgUrl(media.image?.[0] || media.thumbnail) : '')
      + (data.description || logo || content.updates?.length ? section('overview', 'Overview', `${logo ? `<img class="widuri-project-logo" src="${escape(imgUrl(logo))}" alt="${escape(data.name)} logo">` : ''}${data.description ? `<h2>About this project</h2><p class="project-prose">${escape(data.description)}</p>` : ''}${(content.updates || []).map(update => `<p class="project-prose">${escape(update)}</p>`).join('')}`) : '')
      + (facts.length ? section('specifications', 'Project at a glance', `<dl class="project-facts">${facts.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`) : '')
      + (content.access?.length || content.locationText || locationImages.length || data.coordinates ? section('location', 'Location & access', `${content.locationText ? `<p class="project-prose">${escape(content.locationText)}</p>` : ''}${content.access?.length ? `${list(content.access)}<p class="project-prose">Distances and travel times are approximate, as supplied in the project information.</p>` : ''}${locationImages.length ? gallery(locationImages, 'location map') : ''}${data.coordinates && !content.sourceOnly ? `<iframe class="project-map" title="Map of ${escape(data.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(data.coordinates.lat + ',' + data.coordinates.lng)}&output=embed" loading="lazy"></iframe>` : ''}`) : '')
      + (content.shuttle?.length || media.shuttle?.length ? section('shuttle', 'Shuttle connections', `${content.shuttle?.length ? list(content.shuttle) : ''}${media.shuttle?.length ? gallery(media.shuttle, 'shuttle route') : ''}`) : '')
      + (content.neighbourhood?.length ? section('amenities', 'Neighbourhood', `<div class="project-import-cards">${content.neighbourhood.map(group => `<article><h3>${escape(group.title)}</h3>${list(group.items)}</article>`).join('')}</div>`) : '')
      + (content.layouts?.length || media.blueprint?.length ? section('layouts', 'Layouts', `${content.layouts?.length ? `<div class="project-import-cards">${content.layouts.map(layout => `<article><h3>${escape(layout.name)}</h3>${list(layout.details)}</article>`).join('')}</div>` : ''}${media.blueprint?.length ? gallery(media.blueprint, 'floor plan') : ''}`) : '')
      + (facilities.length || media.facilities?.length ? section('facilities', 'Facilities & features', `${facilities.length ? list(facilities) : ''}${media.facilities?.length ? gallery(media.facilities, 'facilities') : ''}`) : '')
      + (photos.length ? section('gallery', 'Project gallery', gallery(photos, 'project photo')) : '')
      + (content.fit?.length ? section('fit', 'Who it is for', list(content.fit)) : '')
      + (data.certificate ? section('certificate', 'Completion', `<p class="project-prose">${escape(data.certificate)}</p>`) : '')
      + (!content.sourceOnly && data.enquiry?.sections?.cta !== false ? section('cta', 'Speak to our team', `<h2>Find out more about ${escape(data.name)}</h2><a class="project-primary" href="${data.enquiry?.enabled ? '#project-enquiry' : '../index.html#contact'}">Contact sales ↗</a>`) : '');
    if (content.sourceOnly) root.querySelector('.project-primary')?.remove();
  }
  function enhance(data, isWiduri) {
    const root = document.getElementById('widuriExperience');
    document.body.classList.add('project--modern');
    const navbar = document.querySelector('.topnav');
    const alignHero = () => { if (navbar) document.body.style.setProperty('--project-nav-height', `${navbar.getBoundingClientRect().height}px`); };
    alignHero();
    if (navbar && 'ResizeObserver' in window) new ResizeObserver(alignHero).observe(navbar);
    else window.addEventListener('resize', alignHero);
    const menu = document.querySelector('.project-nav');
    document.addEventListener('click', event => { if (menu && !menu.contains(event.target)) menu.open = false; });
    document.addEventListener('keydown', event => { if (menu?.open && event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); } });
    menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    document.querySelector('.project-loading')?.remove();
    if (isWiduri) {
      const oldHero = root.querySelector('.widuri-hero');
      const src = oldHero.querySelector('img').src;
      oldHero.outerHTML = hero(data, src);
      const overview = root.querySelector('.widuri-overview');
      overview.querySelector('.widuri-overview__copy').prepend(overview.querySelector('h2'));
      const keys = { '.widuri-overview': 'overview', '.widuri-stat-grid': 'specifications', '.widuri-location': 'location', '.widuri-shuttle': 'shuttle', '.widuri-neighbourhood': 'amenities', '.widuri-layouts': 'layouts', '.widuri-facilities': 'facilities', '.widuri-fit': 'fit', '.widuri-enquire': 'cta' };
      Object.entries(keys).forEach(([selector, key]) => root.querySelector(selector)?.setAttribute('data-project-section', key));
      const facts = root.querySelector('.widuri-stat-grid');
      const factsSection = document.createElement('section'); factsSection.className = 'project-chapter'; factsSection.dataset.projectSection = 'specifications';
      factsSection.innerHTML = '<p class="project-eyebrow">Project at a glance</p>';
      facts.removeAttribute('data-project-section'); root.querySelector('.widuri-overview').after(factsSection); factsSection.append(facts);
      root.querySelectorAll('a').forEach(link => { if (link.textContent.includes('Enquire about this home')) link.remove(); });
      root.querySelectorAll('.widuri-kicker').forEach(label => { label.textContent = label.textContent.replace(/^\d+\s*\/\s*/, ''); });
    }
    root.querySelectorAll('[data-project-section]').forEach(element => { element.hidden = data.enquiry?.sections?.[element.dataset.projectSection] === false; });
    root.querySelector('.project-back')?.remove();
    root.querySelectorAll('.widuri-fit__grid article > span').forEach(number => number.remove());
    root.querySelectorAll('.widuri-neighbourhood article p').forEach(paragraph => {
      const list = document.createElement('ul');
      paragraph.innerHTML.split(/<br\s*\/?\s*>/i).forEach(item => { const entry = document.createElement('li'); entry.textContent = new DOMParser().parseFromString(item, 'text/html').body.textContent; list.append(entry); });
      paragraph.replaceWith(list);
    });
    root.querySelectorAll('[data-project-section="facilities"] .widuri-facilities__grid, [data-project-section="facilities"] .project-picture-grid, [data-project-section="gallery"] .project-picture-grid').forEach(track => {
      const slides = [...track.children];
      if (slides.length < 2) return;
      track.classList.add('project-gallery-slider');
      track.setAttribute('role', 'region'); track.setAttribute('aria-label', 'Project image gallery');
      const controls = document.createElement('div'); controls.className = 'project-gallery-controls';
      const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '←'; previous.setAttribute('aria-label', 'Previous gallery image');
      const next = document.createElement('button'); next.type = 'button'; next.textContent = '→'; next.setAttribute('aria-label', 'Next gallery image');
      const dots = document.createElement('div'); dots.className = 'project-gallery-dots'; dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', 'Choose gallery position');
      let active = 0;
      const go = index => track.scrollTo({ left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      const positions = Array.from({ length: Math.min(3, slides.length) }, (_, index) => Math.round(index * (slides.length - 1) / (Math.min(3, slides.length) - 1)));
      positions.forEach((slideIndex, index) => {
        const dot = document.createElement('button'); dot.type = 'button'; dot.setAttribute('aria-label', `Gallery position ${index + 1} of ${positions.length}`); dot.addEventListener('click', () => go(slideIndex)); dots.append(dot);
      });
      controls.append(previous, dots, next); track.after(controls);
      const update = () => {
        active = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - slides[0].offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - slides[0].offsetLeft - track.scrollLeft) ? index : best, 0);
        slides.forEach((slide, index) => { slide.classList.toggle('is-gallery-active', index === active); });
        const activeDot = Math.round(active * (positions.length - 1) / (slides.length - 1));
        [...dots.children].forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === activeDot)));
        previous.disabled = active === 0; next.disabled = active === slides.length - 1;
      };
      const move = direction => go(Math.max(0, Math.min(slides.length - 1, active + direction)));
      previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
      track.addEventListener('scroll', update, { passive: true });
      track.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } });
      if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
      update();
    });
    if (root.querySelector('[data-project-section="hero"]').hidden) {
      const identity = document.createElement('header'); identity.className = 'project-identity';
      const title = document.createElement('h1'); title.textContent = data.name;
      const place = document.createElement('p'); place.textContent = data.location;
      identity.append(title, place); root.prepend(identity);
    }
    // One accessible native dialog for gallery images, plans and maps.
    let dialog = root.querySelector('dialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'widuri-lightbox'; dialog.innerHTML = '<button type="button" class="widuri-lightbox__close" aria-label="Close image">×</button><img alt="">'; root.append(dialog); dialog.querySelector('button').addEventListener('click', () => dialog.close()); dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }); }
    dialog.setAttribute('aria-label', 'Full size project image');
    const large = dialog.querySelector('img');
    const open = img => { large.src = img.src; large.alt = img.alt; dialog.showModal(); };
    root.querySelectorAll('img').forEach(img => {
      if (img.closest('dialog')) return;
      if (img.closest('.project-lead') || img.classList.contains('widuri-project-logo')) {
        if (img.classList.contains('widuri-project-logo')) {
          const frame = document.createElement('div'); frame.className = 'project-picture project-picture--static';
          const previous = img.closest('button');
          if (previous) { previous.replaceWith(frame); frame.append(img); }
          else { img.before(frame); frame.append(img); }
        }
        return;
      }
      let button = img.closest('button');
      if (button && isWiduri && !button.classList.contains('project-picture')) return; // Existing floor-plan / gallery controls.
      if (!button) { button = document.createElement('button'); button.type = 'button'; button.className = 'project-picture'; img.before(button); button.append(img); }
      button.setAttribute('aria-label', `View ${img.alt || data.name} full size`);
      button.addEventListener('click', () => open(img));
      if (!img.hasAttribute('fetchpriority')) { img.loading = 'lazy'; img.decoding = 'async'; }
    });
    const viewerPrevious = document.createElement('button'); viewerPrevious.type = 'button'; viewerPrevious.className = 'project-lightbox-arrow project-lightbox-arrow--previous'; viewerPrevious.setAttribute('aria-label', 'Previous expanded image'); viewerPrevious.textContent = '←';
    const viewerNext = document.createElement('button'); viewerNext.type = 'button'; viewerNext.className = 'project-lightbox-arrow project-lightbox-arrow--next'; viewerNext.setAttribute('aria-label', 'Next expanded image'); viewerNext.textContent = '→';
    dialog.append(viewerPrevious, viewerNext);
    let viewerImages = [], viewerIndex = 0;
    const moveViewer = direction => {
      if (!viewerImages.length) return;
      viewerIndex = (viewerIndex + direction + viewerImages.length) % viewerImages.length;
      large.src = viewerImages[viewerIndex].src; large.alt = viewerImages[viewerIndex].alt;
    };
    dialog.addEventListener('toggle', () => {
      if (!dialog.open) return;
      const gallery = [...root.querySelectorAll('.project-gallery-slider img')];
      viewerImages = gallery.some(img => img.src === large.src) ? gallery : [];
      viewerIndex = Math.max(0, viewerImages.findIndex(img => img.src === large.src));
      viewerPrevious.hidden = viewerNext.hidden = viewerImages.length < 2;
    });
    viewerPrevious.addEventListener('click', () => moveViewer(-1));
    viewerNext.addEventListener('click', () => moveViewer(1));
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); moveViewer(event.key === 'ArrowLeft' ? -1 : 1);
    });
    window.EhsanShare?.render({ kind: 'project', id: new URLSearchParams(location.search).get('project'), title: data.name, description: data.description || data.location, image: imgUrl(data.media.thumbnail || data.media.image[0] || '../../assets/logo/epp_logo.png') }, root.querySelector('[data-project-share]'));
    if (data.enquiry?.enabled) {
      root.querySelectorAll('a[href="#enquire"], a[href="../index.html#contact"]').forEach(link => link.href = '#project-enquiry');
      document.querySelector('.topnav__cta')?.setAttribute('href', '#project-enquiry');
    }
    window.dispatchEvent(new CustomEvent('project-page-ready'));
    sectionMotion(root);
  }
  window.ProjectPage = { generic, enhance };
})();
