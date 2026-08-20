/* =========================================================================
   project-detail.js — Fetch from JSON, media switching, lightbox & maps
   ========================================================================= */

// Projects data will be loaded from JSON
let PROJECTS_DATA = {};
let currentMediaType = 'image';

/* ===== Load Projects from JSON ===== */
async function loadProjectsData() {
  try {
    const response = await fetch('projects.json');
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
    this.lightboxImage.src = `assets/img/${img}`;
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
        img.src = `assets/img/${slide}`;
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
  return params.get('project') || 'proj-1';
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
  document.getElementById('projectYear').textContent = `Completed ${data.year}`;

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
        <img class="gallery-item__image" src="assets/img/${images[i]}" alt="Project image ${i + 1}" loading="lazy">
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
        <img class="gallery-item__image" src="assets/img/${blueprints[i]}" alt="Blueprint ${i + 1}" loading="lazy">
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
        <img src="assets/img/${proj.media.image[0]}" alt="${proj.name}" loading="lazy">
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

  // Initialize scroll-based navbar slide-down
  const handleScroll = () => {
    const isScrolled = window.scrollY > 1;
    ROOT.classList.toggle('past-hero', isScrolled);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
});
