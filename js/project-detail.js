/* Where published content comes from.

   Unset, the site reads the checked-in data/*.json exactly as before, so
   nothing changes until you decide to switch. Point it at the deployed panel
   to serve content straight from the CMS:

     <script>window.EHSAN_CMS_ORIGIN = 'https://admin.ehsanproperty.com';</script>

   Set it before this script loads (a <script> tag in the page head does it).
*/
function cmsUrl(file, fallback) {
  const origin = window.EHSAN_CMS_ORIGIN;
  return origin ? origin.replace(/\/$/, '') + '/api/public/' + file : SITE.url(fallback);
}

/* =========================================================================
   project-detail.js — Fetch from JSON, media switching, lightbox & maps
   ========================================================================= */

// Projects data will be loaded from JSON
let PROJECTS_DATA = {};
let currentMediaType = 'image';

/* ===== Load Projects from JSON ===== */
async function loadProjectsData() {
  try {
    const response = await fetch(cmsUrl('projects.json', 'data/projects.json?v=20260915.1'));
    if (!response.ok) throw new Error('Failed to load projects');
    PROJECTS_DATA = await response.json();
    return true;
  } catch (error) {
    console.error('Error loading projects:', error);
    return false;
  }
}

/* ===== Lightbox Gallery Controller ===== */
class LightboxGallery {
  constructor(images) {
    this.images = images || [];
    this.currentIndex = 0;
    this.lightbox = document.getElementById('lightbox');
    this.lightboxImage = document.getElementById('lightboxImage');
    this.lightboxCurrent = document.getElementById('lightboxCurrent');
    this.lightboxTotal = document.getElementById('lightboxTotal');
    this.closeBtn = document.getElementById('lightboxClose');
    this.prevBtn = document.getElementById('lightboxPrev');
    this.nextBtn = document.getElementById('lightboxNext');

    this.closeBtn.addEventListener('click', () => this.close());
    this.prevBtn.addEventListener('click', () => this.prev());
    this.nextBtn.addEventListener('click', () => this.next());
    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox || e.target.classList.contains('lightbox__backdrop')) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!this.lightbox.classList.contains('is-active')) return;
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'Escape') this.close();
    });
  }

  open(index) {
    this.currentIndex = index;
    this.lightboxTotal.textContent = this.images.length;
    this.render();
    this.lightbox.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.lightbox.classList.remove('is-active');
    document.body.style.overflow = '';
  }

  render() {
    const img = this.images[this.currentIndex];
    this.lightboxImage.src = imgUrl(img);
    this.lightboxCurrent.textContent = this.currentIndex + 1;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.render();
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.render();
  }

  setImages(images) {
    this.images = images;
    this.currentIndex = 0;
  }
}

/* ===== Carousel Controller ===== */
class Carousel {
  constructor() {
    this.track = document.getElementById('carouselTrack');
    this.container = document.getElementById('carousel');
    this.prevBtn = document.getElementById('carouselPrev');
    this.nextBtn = document.getElementById('carouselNext');
    this.currentSpan = document.getElementById('carouselCurrent');
    this.totalSpan = document.getElementById('carouselTotal');
    this.mediaSwitcher = document.getElementById('mediaSwitcher');

    this.currentIndex = 0;
    this.slides = [];
    this.autoPlayInterval = null;
    this.currentMedia = 'image';

    this.prevBtn.addEventListener('click', () => this.prev());
    this.nextBtn.addEventListener('click', () => this.next());

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // Touch swipe
    let touchStartX = 0;
    this.container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });
    this.container.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      if (touchStartX - touchEndX > 50) this.next();
      if (touchEndX - touchStartX > 50) this.prev();
    });

    // Media switcher
    const mediaBtns = this.mediaSwitcher.querySelectorAll('.media-switcher__btn');
    mediaBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchMedia(btn.dataset.media);
      });
    });
  }

  init(images) {
    this.slides = images || [];
    this.currentIndex = 0;
    this.render();
    this.autoPlay();
  }

  render() {
    this.track.innerHTML = '';
    this.slides.forEach((slide, idx) => {
      const slideEl = document.createElement('div');
      slideEl.className = 'carousel__slide' + (idx === 0 ? ' is-active' : '');

      if (typeof slide === 'string') {
        const img = document.createElement('img');
        img.src = imgUrl(slide);
        img.alt = `Project image ${idx + 1}`;
        slideEl.appendChild(img);
      }

      this.track.appendChild(slideEl);
    });

    this.totalSpan.textContent = this.slides.length;
    this.updateCounter();
  }

  updateCounter() {
    this.currentSpan.textContent = this.currentIndex + 1;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.updateSlides();
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.updateSlides();
  }

  updateSlides() {
    const slides = this.track.querySelectorAll('.carousel__slide');
    slides.forEach((slide, idx) => {
      slide.classList.toggle('is-active', idx === this.currentIndex);
    });
    this.updateCounter();
    this.resetAutoPlay();
  }

  autoPlay() {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
    this.autoPlayInterval = setInterval(() => this.next(), 5000);
  }

  resetAutoPlay() {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
    this.autoPlay();
  }

  switchMedia(mediaType) {
    currentMediaType = mediaType;

    // Update button states
    const btns = this.mediaSwitcher.querySelectorAll('.media-switcher__btn');
    btns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.media === mediaType);
    });

    // Update gallery display
    const imageContainer = document.getElementById('imageGalleryContainer');
    const blueprintContainer = document.getElementById('blueprintGalleryContainer');

    if (mediaType === 'blueprint') {
      imageContainer.style.display = 'none';
      blueprintContainer.style.display = 'grid';
    } else {
      imageContainer.style.display = 'grid';
      blueprintContainer.style.display = 'none';
    }
  }
}

/* ===== Project Data Loader ===== */
function getProjectFromURL() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('project') || 'proj-1').replace(/[.,;]+$/, '');
}

function loadProjectData(projectKey) {
  const data = PROJECTS_DATA[projectKey];
  if (!data) {
    console.error(`Project ${projectKey} not found`);
    return null;
  }
  return data;
}

function renderProjectContent(data) {
  // Header
  document.getElementById('projectStatus').textContent = data.status;
  document.getElementById('projectTitle').textContent = data.name;
  document.getElementById('projectLocation').textContent = data.location;
  document.getElementById('projectYear').textContent = data.status === 'Ongoing'
    ? `Target ${data.year}`
    : `Completed ${data.year}`;

  // Description
  document.getElementById('projectDescription').textContent = data.description;

  // Amenities
  const amenitiesContainer = document.getElementById('projectAmenities');
  if (data.amenities && data.amenities.length) {
    const amenitiesList = document.createElement('div');
    amenitiesList.className = 'project-amenities';
    amenitiesList.innerHTML = '<h3>Amenities & Features</h3><ul>' +
      data.amenities.map(a => `<li>${a}</li>`).join('') +
      '</ul>';
    amenitiesContainer.appendChild(amenitiesList);
  }

  // Specs - Content Grid
  const specsGridContainer = document.getElementById('projectSpecsGrid');
  if (specsGridContainer) {
    const specs = [
      { label: 'Units', value: data.units },
      { label: 'Land Area', value: data.area },
      { label: 'Price Range', value: data.priceRange },
      { label: 'Status', value: data.occupancy }
    ];
    specsGridContainer.innerHTML = specs.map(spec =>
      `<div><dt>${spec.label}</dt><dd>${spec.value}</dd></div>`
    ).join('');
  }

  // Certificate
  const certDiv = document.getElementById('projectCert');
  if (data.certificate) {
    certDiv.style.display = 'block';
    document.getElementById('projectCertText').textContent = data.certificate;
  } else {
    certDiv.style.display = 'none';
  }
}

function renderWiduriStory(data) {
  const story = document.getElementById('widuriStory');
  if (!story) return;

  story.hidden = false;
  story.innerHTML = `
    <div class="widuri-story__inner">
      <div class="widuri-story__lead">
        <p class="widuri-story__eyebrow">Ehsan Widuri at Bandar Baru Nilai</p>
        <h2>A connected place to <em>live well.</em></h2>
        <p>${data.description}</p>
        <a class="widuri-story__cta" href="../index.html#contact">Register interest <span aria-hidden="true">↗</span></a>
      </div>
      <div class="widuri-story__facts" aria-label="Ehsan Widuri highlights">
        <div><strong>Freehold</strong><span>Long term ownership</span></div>
        <div><strong>730 to 980</strong><span>Square feet of flexible living</span></div>
        <div><strong>2 to 4</strong><span>Bedroom layout choices</span></div>
        <div><strong>20 min</strong><span>Approximate drive to KLIA</span></div>
      </div>
    </div>
  `;
}

function renderWiduriExperience(data) {
  const experience = document.getElementById('widuriExperience');
  if (!experience) return;

  const asset = (file) => SITE.url(`assets/img/widuri/source/${file}`);
  const layouts = [
    { key: 'a', title: 'Type A', size: '890 sq ft', file: 'WIDURI-FLOOR-PLAN-01.jpg', details: ['3 bedrooms', '2 bathrooms', '1 parking', '132 homes'] },
    { key: 'b', title: 'Type B', size: '850 sq ft', file: 'WIDURI-FLOOR-PLAN-02.jpg', details: ['3 bedrooms', '2 bathrooms', '1 parking', '132 homes'] },
    { key: 'c', title: 'Type C', size: '730 sq ft', file: 'WIDURI-FLOOR-PLAN-03.jpg', details: ['2 bedrooms', '2 bathrooms', '1 parking', '88 homes'] },
    { key: 'd', title: 'Type D', size: '950 sq ft', file: 'WIDURI-FLOOR-PLAN-04.jpg', details: ['4 bedrooms', '2 bathrooms', '2 parking', 'Dual key option'] },
    { key: 'e', title: 'Type E', size: '980 sq ft', file: 'WIDURI-FLOOR-PLAN-05.jpg', details: ['4 bedrooms', '2 bathrooms', '2 parking', '44 homes'] }
  ];
  const gallery = [
    ['SwimmingPool2_A-DESKTOP-OB2275O-scaled.jpg', 'Swimming pool'],
    ['WadingPool-DESKTOP-OB2275O-scaled.jpg', 'Wading pool'],
    ['GazeboAndBBQ-DESKTOP-OB2275O-scaled.jpg', 'Gazebo and barbecue area'],
    ['IndoorGym_1-DESKTOP-OB2275O-scaled.jpg', 'Indoor gym'],
    ['OutdoorGym-DESKTOP-OB2275O-scaled.jpg', 'Outdoor gym'],
    ['LibraryOutdoorReading_A-DESKTOP-OB2275O-scaled.jpg', 'Outdoor reading area'],
    ['PlayGround_A-DESKTOP-OB2275O-scaled.jpg', 'Playground'],
    ['GuessWaiting-DESKTOP-OB2275O-scaled.jpg', 'Guest waiting lounge'],
    ['OfficeSpace-DESKTOP-OB2275O-scaled.jpg', 'Office spaces'],
    ['BusinessEntrance-DESKTOP-OB2275O-1.jpg', 'Main entrance']
  ];

  document.querySelector('.hero-wrapper')?.setAttribute('hidden', '');
  experience.hidden = false;
  experience.innerHTML = `
    <section class="widuri-hero" id="overview">
      <img class="widuri-hero__image" src="${asset('NewArealView-DESKTOP-OB2275O-1.jpg')}" alt="Ehsan Widuri at Bandar Baru Nilai" fetchpriority="high">
      <div class="widuri-hero__wash"></div>
      <div class="widuri-hero__content">
        <p class="widuri-kicker">Ehsan Plant and Property presents</p>
        <h1>Ehsan <em>Widuri</em></h1>
        <p class="widuri-hero__place">Bandar Baru Nilai</p>
        <a class="widuri-button widuri-button--light" href="#enquire">Register your interest <span aria-hidden="true">↗</span></a>
      </div>
      <div class="widuri-hero__note"><span>Freehold serviced apartments</span><span>Target 2028</span></div>
    </section>

    <section class="widuri-overview" aria-labelledby="widuriOverviewTitle">
      <div class="widuri-section-heading">
        <p class="widuri-kicker">01 / Overview</p>
        <h2 id="widuriOverviewTitle">A place to live close to <em>what matters.</em></h2>
      </div>
      <div class="widuri-overview__copy">
        <p>${data.description}</p>
        <p>Designed for everyday ease, Ehsan Widuri brings homes, workspaces and shared lifestyle spaces together in one connected address.</p>
      </div>
      <div class="widuri-stat-grid" aria-label="Project highlights">
        <div><strong>490</strong><span>Serviced apartment homes</span></div>
        <div><strong>730 to 980</strong><span>Square feet of flexible living</span></div>
        <div><strong>2 to 4</strong><span>Bedroom layouts</span></div>
        <div><strong>30</strong><span>Lifestyle facilities</span></div>
      </div>
    </section>

    <section class="widuri-location" id="location" aria-labelledby="widuriLocationTitle">
      <div class="widuri-location__visual"><img src="${asset('3.map-amenities-01-1.jpg')}" alt="Map of Ehsan Widuri surrounding amenities"></div>
      <div class="widuri-location__content">
        <p class="widuri-kicker">02 / Location</p>
        <h2 id="widuriLocationTitle">A connected life, from <em>Nilai onwards.</em></h2>
        <p>Set within an established education and airport linked township, Widuri makes the places you use most feel close at hand.</p>
        <div class="widuri-route-list">
          <span>PLUS Highway</span><span>ELITE Highway</span><span>Nilai Labu Enstek Expressway</span><span>Approx. 20 minutes to KLIA</span>
        </div>
      </div>
    </section>

    <section class="widuri-shuttle" aria-labelledby="widuriShuttleTitle">
      <div class="widuri-shuttle__content">
        <p class="widuri-kicker">Everyday connections</p>
        <h2 id="widuriShuttleTitle">No car? <em>No problem.</em></h2>
        <p>A complimentary shuttle route connects residents with nearby campuses, shopping and rail links.</p>
        <div class="widuri-shuttle__stops"><span>INTI</span><span>MILA</span><span>USIM</span><span>Nilai University</span><span>AEON Mall</span><span>KTM Nilai</span></div>
      </div>
      <img src="${asset('2.shuttle-service-01-1_final.jpg')}" alt="Ehsan Widuri shuttle service route">
    </section>

    <section class="widuri-neighbourhood" id="amenities" aria-labelledby="widuriAmenitiesTitle">
      <div class="widuri-section-heading">
        <p class="widuri-kicker">03 / Around Widuri</p>
        <h2 id="widuriAmenitiesTitle">Everything nearby, <em>nothing ordinary.</em></h2>
      </div>
      <div class="widuri-neighbourhood__grid">
        <article><h3>Learning</h3><p>MILA University<br>Nilai University<br>USIM<br>INTI International University</p></article>
        <article><h3>Retail</h3><p>MesaMall<br>AEON Mall Nilai<br>Lotus’s Nilai<br>Mitsui Outlet Park KLIA</p></article>
        <article><h3>Wellbeing</h3><p>Aurelius Hospital<br>Selgate Sepang Hospital<br>Putrajaya Hospital<br>Nilai Springs Golf and Country Club</p></article>
        <article><h3>Leisure</h3><p>National Sports Complex<br>Melati Hill Hiking Trail<br>Putrajaya Botanical Park<br>Splash Mania Water Park</p></article>
      </div>
    </section>

    <section class="widuri-layouts" id="layouts" aria-labelledby="widuriLayoutsTitle">
      <div class="widuri-layouts__intro">
        <p class="widuri-kicker">04 / Layouts</p>
        <h2 id="widuriLayoutsTitle">A layout for the life you are <em>making.</em></h2>
        <p>Five practical layouts from 730 to 980 square feet, made for first homes, families and flexible living.</p>
      </div>
      <div class="widuri-layout-tabs" role="tablist" aria-label="Unit layouts">
        ${layouts.map((layout, index) => `<button class="widuri-layout-tab${index === 0 ? ' is-active' : ''}" type="button" role="tab" aria-selected="${index === 0}" data-layout="${layout.key}"><span>${layout.title}</span><small>${layout.size}</small></button>`).join('')}
      </div>
      <div class="widuri-layout-stage">
        <button class="widuri-plan" id="widuriPlanButton" type="button" aria-label="View Type A floor plan larger"><img id="widuriPlanImage" src="${asset(layouts[0].file)}" alt="Type A floor plan"></button>
        <div class="widuri-layout-details" id="widuriLayoutDetails">
          <p class="widuri-kicker">Type A / 890 sq ft</p><h3>Room for more <em>possibility.</em></h3><ul>${layouts[0].details.map(detail => `<li>${detail}</li>`).join('')}</ul><a class="widuri-button" href="#enquire">Enquire about this home <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>

    <section class="widuri-facilities" id="facilities" aria-labelledby="widuriFacilitiesTitle">
      <div class="widuri-facilities__intro">
        <p class="widuri-kicker">05 / Facilities and gallery</p>
        <h2 id="widuriFacilitiesTitle">Spaces to enjoy, made for <em>every day.</em></h2>
        <p>Explore the places for movement, rest, work and play, all within the development.</p>
      </div>
      <div class="widuri-facilities__grid" id="gallery">
        ${gallery.map(([file, label], index) => `<button class="widuri-facility-item" type="button" data-gallery-index="${index}" aria-label="View ${label} larger"><img src="${asset(file)}" alt="${label}"><span>${String(index + 1).padStart(2, '0')} / ${label}</span></button>`).join('')}
      </div>
      <div class="widuri-facilities__list">Swimming pool · Children’s pool · Jogging track · Kids waterplay · Playground · Gazebo · Barbecue pit · Reading room · Multipurpose hall · Sauna · Indoor gym · Outdoor gym · Yoga room · Games room · EV charging</div>
    </section>

    <section class="widuri-fit" aria-labelledby="widuriFitTitle">
      <p class="widuri-kicker">07 / Is Widuri for you?</p>
      <h2 id="widuriFitTitle">Built for different lives, with one <em>shared address.</em></h2>
      <div class="widuri-fit__grid">
        <article><span>01</span><h3>Property investors</h3><p>University rental demand, dual key potential and a connected Nilai location.</p></article>
        <article><span>02</span><h3>Airport professionals</h3><p>An approximate 20 minute drive to KLIA and straightforward highway access.</p></article>
        <article><span>03</span><h3>First home buyers</h3><p>Freehold homes from RM296,000 with practical layouts for today and tomorrow.</p></article>
        <article><span>04</span><h3>Families</h3><p>Spacious homes, lifestyle facilities and schools and healthcare within reach.</p></article>
      </div>
    </section>

    <section class="widuri-enquire" id="enquire">
      <div><p class="widuri-kicker">Ehsan Widuri, Bandar Baru Nilai</p><h2>Find your place at <em>Widuri.</em></h2></div>
      <a class="widuri-button widuri-button--light" href="../index.html#contact">Contact sales <span aria-hidden="true">↗</span></a>
    </section>
    <dialog class="widuri-lightbox" id="widuriLightbox"><button class="widuri-lightbox__close" type="button" aria-label="Close image">×</button><img id="widuriLightboxImage" src="" alt=""></dialog>
  `;

  const layoutDetails = experience.querySelector('#widuriLayoutDetails');
  const planImage = experience.querySelector('#widuriPlanImage');
  const planButton = experience.querySelector('#widuriPlanButton');
  const lightbox = experience.querySelector('#widuriLightbox');
  const lightboxImage = experience.querySelector('#widuriLightboxImage');
  const renderLayout = (layout) => {
    planImage.src = asset(layout.file);
    planImage.alt = `${layout.title} floor plan`;
    planButton.setAttribute('aria-label', `View ${layout.title} floor plan larger`);
    layoutDetails.innerHTML = `<p class="widuri-kicker">${layout.title} / ${layout.size}</p><h3>Room for more <em>possibility.</em></h3><ul>${layout.details.map(detail => `<li>${detail}</li>`).join('')}</ul><a class="widuri-button" href="#enquire">Enquire about this home <span aria-hidden="true">↗</span></a>`;
  };
  experience.querySelectorAll('.widuri-layout-tab').forEach((button) => {
    button.addEventListener('click', () => {
      const layout = layouts.find((item) => item.key === button.dataset.layout);
      if (!layout) return;
      experience.querySelectorAll('.widuri-layout-tab').forEach((tab) => { tab.classList.toggle('is-active', tab === button); tab.setAttribute('aria-selected', String(tab === button)); });
      renderLayout(layout);
    });
  });
  const openLightbox = (file, label) => { lightboxImage.src = asset(file); lightboxImage.alt = label; lightbox.showModal(); };
  planButton.addEventListener('click', () => openLightbox(planImage.getAttribute('src').replace(SITE.url('assets/img/widuri/source/'), ''), planImage.alt));
  experience.querySelectorAll('.widuri-facility-item').forEach((button) => button.addEventListener('click', () => {
    const [file, label] = gallery[Number(button.dataset.galleryIndex)];
    openLightbox(file, label);
  }));
  lightbox.querySelector('.widuri-lightbox__close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) lightbox.close(); });
}

function renderImageGallery(data, lightbox) {
  const galleryContainer = document.getElementById('imageGalleryContainer');
  if (!galleryContainer || !data.media.image || !data.media.image.length) return;

  const images = data.media.image;
  const maxDisplay = 6;
  const displayCount = Math.min(images.length, maxDisplay);
  const hasMore = images.length > maxDisplay;
  const moreCount = images.length - maxDisplay;

  let html = '';
  for (let i = 0; i < displayCount; i++) {
    const isLast = i === displayCount - 1 && hasMore;
    html += `
      <div class="gallery-item" data-index="${i}">
        <img class="gallery-item__image" src="${imgUrl(images[i])}" alt="Project image ${i + 1}" loading="lazy">
        ${isLast ? `<div class="gallery-item__overlay"><div class="gallery-item__overlay-text">+${moreCount}</div></div>` : ''}
      </div>
    `;
  }

  galleryContainer.innerHTML = html;

  // Add click handlers
  galleryContainer.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      lightbox.open(index);
    });
  });
}

function setupWiduriSectionMotion() {
  const sections = document.querySelectorAll('.widuri-experience > section:not(.widuri-hero)');
  if (!sections.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  sections.forEach((section) => section.classList.add('widuri-reveal'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    sections.forEach((section) => section.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14 });

  sections.forEach((section) => observer.observe(section));
}

function renderBlueprintGallery(data, lightbox) {
  const blueprintContainer = document.getElementById('blueprintGalleryContainer');
  if (!blueprintContainer || !data.media.blueprint || !data.media.blueprint.length) {
    blueprintContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--c-dim);">No blueprints available</p>';
    return;
  }

  const blueprints = data.media.blueprint;
  const maxDisplay = 6;
  const displayCount = Math.min(blueprints.length, maxDisplay);
  const hasMore = blueprints.length > maxDisplay;
  const moreCount = blueprints.length - maxDisplay;

  let html = '';
  for (let i = 0; i < displayCount; i++) {
    const isLast = i === displayCount - 1 && hasMore;
    html += `
      <div class="gallery-item" data-index="${i}">
        <img class="gallery-item__image" src="${imgUrl(blueprints[i])}" alt="Blueprint ${i + 1}" loading="lazy">
        ${isLast ? `<div class="gallery-item__overlay"><div class="gallery-item__overlay-text">+${moreCount}</div></div>` : ''}
      </div>
    `;
  }

  blueprintContainer.innerHTML = html;

  // Add click handlers for blueprints
  blueprintContainer.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      lightbox.setImages(blueprints);
      lightbox.open(index);
    });
  });
}

function renderRelatedProjects(currentProjectKey) {
  const relatedContainer = document.getElementById('relatedProjects');
  if (!relatedContainer) return;

  const allProjects = Object.entries(PROJECTS_DATA).filter(([key]) => key !== currentProjectKey);
  const related = allProjects.sort(() => Math.random() - 0.5).slice(0, 3);

  relatedContainer.innerHTML = related.map(([key, proj]) => `
    <a href="project-detail.html?project=${key}" class="related-project-card">
      <div class="related-project-card__image">
        <img src="${imgUrl(proj.media.image[0])}" alt="${proj.name}" loading="lazy">
      </div>
      <div class="related-project-card__body">
        <h3 class="related-project-card__title">${proj.name}</h3>
        <p class="related-project-card__meta">${proj.location}</p>
        <span class="related-project-card__cta">View project →</span>
      </div>
    </a>
  `).join('');
}

function renderGoogleMap(data) {
  const mapContainer = document.getElementById('projectMap');
  if (!mapContainer || !data.coordinates) return;

  const { lat, lng } = data.coordinates;
  const mapURL = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3984.${Math.floor(Math.random() * 1000000)}!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0x0!2z${lat},${lng}!5e0!3m2!1sen!2smy!4v${Date.now()}`;

  mapContainer.innerHTML = `
    <iframe src="https://www.google.com/maps?q=${lat},${lng}&output=embed"
            width="100%"
            height="100%"
            style="border:none;"
            allowfullscreen=""
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade">
    </iframe>
  `;
}

function configureMediaSwitcher(data) {
  const mediaSwitcher = document.getElementById('mediaSwitcher');
  const hasBlueprint = data.media.blueprint && data.media.blueprint.length > 0;

  const blueprintBtn = mediaSwitcher.querySelector('[data-media="blueprint"]');
  blueprintBtn.style.display = hasBlueprint ? 'flex' : 'none';
}

/* ===== Initialize ===== */
const ROOT = document.documentElement;

/* An image value is either a bare name under assets/img (legacy content) or
   an absolute URL (uploaded to blob storage). Pass the latter through. */
function imgUrl(name) {
  return /^(https?:)?\/\//.test(name) || name.startsWith('/')
    ? name
    : SITE.url('assets/img/' + name);
}


document.addEventListener('DOMContentLoaded', async () => {
  ROOT.classList.add('is-ready');

  // Load projects from JSON
  const loaded = await loadProjectsData();
  if (!loaded) {
    console.error('Failed to load project data');
    return;
  }

  const projectKey = getProjectFromURL();
  const projectData = loadProjectData(projectKey);

  if (projectData) {
    const isWiduri = projectKey === 'proj-15';
    document.body.classList.toggle('project--widuri', isWiduri);
    document.title = `${projectData.name} | Ehsan Plant & Property`;

    if (isWiduri) {
      renderWiduriExperience(projectData);
      setupWiduriSectionMotion();
    } else {
      const carousel = new Carousel();
      carousel.init(projectData.media.image);

      const lightbox = new LightboxGallery(projectData.media.image);
      renderImageGallery(projectData, lightbox);
      renderBlueprintGallery(projectData, lightbox);

      renderProjectContent(projectData);
      configureMediaSwitcher(projectData);
      renderRelatedProjects(projectKey);
      renderGoogleMap(projectData);
    }
  }

  // Initialize scroll-based navbar slide-down
  const handleScroll = () => {
    const isScrolled = window.scrollY > 1;
    ROOT.classList.toggle('past-hero', isScrolled);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
});
