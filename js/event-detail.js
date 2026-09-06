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
   event-detail.js — Event detail page data binding & interactions
   ========================================================================= */

// Event data, loaded from events.json — the same file the listing page reads.
let EVENTS_DATA = {};

// Load event from URL parameter
const ROOT = document.documentElement;

function getEventFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('event') || 'event-1';
}

function loadEventData(eventId) {
  const data = EVENTS_DATA[eventId];
  if (!data) {
    console.error(`Event ${eventId} not found`);
    return null;
  }
  return data;
}

/* Several blocks in event-detail.html (speakers, highlights, related events)
   are commented out. getElementById returns null for those, so every write
   below goes through these helpers rather than dereferencing directly — one
   missing block must not abort the rest of the render. */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function renderEventContent(data) {
  // Hero section
  const hero = document.getElementById('eventHeroImage');
  if (hero) {
    hero.src = data.image;
    hero.alt = data.title;
  }
  setText('eventHeroBadge', data.category);
  setText('eventHeroTitle', data.title);
  setText('eventHeroDate', data.dateTime);

  // Quick facts
  setText('eventDateTime', data.dateTime);
  setText('eventLocation', data.location);
  setText('eventAttendees', data.attendees);
  setText('eventPrice', data.price);

  // Description
  setText('eventDescription', data.description);

  // Agenda
  setHTML('eventAgenda', (data.agenda || []).map(item => `
    <div class="event-agenda__item">
      <div class="event-agenda__time">${item.time}</div>
      <div>
        <h4 class="event-agenda__title">${item.title}</h4>
        <p class="event-agenda__desc">${item.description}</p>
      </div>
    </div>
  `).join(''));

  // Speakers
  setHTML('eventSpeakers', (data.speakers || []).map(speaker => `
    <div class="event-speaker-card">
      <img src="${speaker.image}" alt="${speaker.name}" class="event-speaker-avatar" referrerpolicy="no-referrer">
      <h4 class="event-speaker-name">${speaker.name}</h4>
      <p class="event-speaker-title">${speaker.title}</p>
      <p class="event-speaker-bio">${speaker.bio}</p>
    </div>
  `).join(''));

  // Highlights
  setHTML('eventHighlights', (data.highlights || []).map(h => `<li>${h}</li>`).join(''));

  // Sidebar stats
  setText('eventCapacity', `${data.capacity}`);
  setText('eventRegistered', `${data.registered}`);
  setText('eventSpotsLeft', `${data.capacity - data.registered}`);

  // Related events
  setHTML('relatedEvents', (data.relatedEvents || []).map(eventId => {
    const relEvent = EVENTS_DATA[eventId];
    if (!relEvent) return '';
    return `
      <a href="event-detail.html?event=${encodeURIComponent(eventId)}" class="event-related-card">
        <img src="${relEvent.image}" alt="${relEvent.title}" class="event-related-img" referrerpolicy="no-referrer">
        <div class="event-related-info">
          <h4 class="event-related-title">${relEvent.title}</h4>
          <p class="event-related-date">${relEvent.date}</p>
        </div>
      </a>
    `;
  }).join(''));
}

// Form handling
function setupFormHandlers() {
  const form = document.getElementById('eventRegisterForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const phone = document.getElementById('registerPhone').value;

      // Simulate submission
      console.log('Registration submitted:', { name, email, phone });

      // Reset form
      form.reset();

      // Show success message
      alert('Thank you for registering! We\'ll send you a confirmation email shortly.');
    });
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  ROOT.classList.add('is-ready');

  // Initialize scroll-based navbar. Registered before the fetch so the topnav
  // still behaves if the data never arrives.
  const handleScroll = () => {
    const isScrolled = window.scrollY > 1;
    ROOT.classList.toggle('past-hero', isScrolled);
  };
  window.addEventListener('scroll', handleScroll, { passive: true });

  try {
    const res = await fetch(cmsUrl('events.json', 'data/events.json'));
    if (!res.ok) throw new Error(`events.json → ${res.status}`);
    EVENTS_DATA = await res.json();
  } catch (err) {
    console.error('Could not load events:', err);
    setText('eventHeroTitle', 'Event unavailable');
    setText('eventDescription',
      'This event could not be loaded. Please go back to the events list, or email info@ehsanproperty.com.');
    return;
  }

  const eventId = getEventFromURL();
  const eventData = loadEventData(eventId);

  if (eventData) {
    renderEventContent(eventData);
    setupFormHandlers();
  } else {
    setText('eventHeroTitle', 'Event not found');
    setText('eventDescription',
      'We could not find that event. Browse all upcoming events instead.');
  }
});
