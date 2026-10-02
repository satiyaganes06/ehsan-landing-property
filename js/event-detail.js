/* Where published content comes from.

   Unset, the site reads the checked-in data/*.json exactly as before, so
   nothing changes until you decide to switch. Point it at the deployed panel
   to serve content straight from the CMS:

     <script>window.EHSAN_CMS_ORIGIN = 'https://admin.ehsanproperty.com';</script>

   Set it before this script loads (a <script> tag in the page head does it).
*/
function cmsUrl(file, fallback) {
  const origin = window.EHSAN_CMS_ORIGIN || window.SITE?.adminOrigin;
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
function setupFormHandlers(eventData) {
  const shareLinks = document.querySelectorAll('.event-share-btn');
  const pageUrl = location.href.split('#')[0];
  const shareUrls = [
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(eventData.title)}`,
    `mailto:?subject=${encodeURIComponent(eventData.title)}&body=${encodeURIComponent(pageUrl)}`,
  ];
  shareLinks.forEach((link, index) => {
    link.setAttribute('aria-label', link.title);
    if (shareUrls[index]) {
      link.href = shareUrls[index];
      if (index < 2) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    } else {
      link.addEventListener('click', async e => {
        e.preventDefault();
        try { await navigator.clipboard.writeText(pageUrl); link.textContent = '✓'; link.setAttribute('aria-label', 'Link copied'); }
        catch { link.textContent = 'Unavailable'; }
      });
    }
  });
  const form = document.getElementById('eventRegisterForm');
  if (form) {
    const consentLabel = document.createElement('label'); consentLabel.className = 'project-enquiry-consent';
    const consent = document.createElement('input'); consent.type = 'checkbox'; consent.required = true; consentLabel.append(consent, ' I agree to be contacted about this registration.');
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const submit = form.querySelector('[type="submit"]'); submit.before(consentLabel); form.append(status);
    const renderedAt = Date.now();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const phone = document.getElementById('registerPhone').value;

      if (!form.reportValidity()) return;
      submit.disabled = true; status.textContent = 'Sending…';
      try {
        const response = await fetch(`${window.SITE.adminOrigin}/api/public/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, interest: eventData.title, message: `Event registration request: ${eventData.title}`, consent: consent.checked, renderedAt }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not send your registration. Please try again.');
        form.reset(); status.textContent = 'Your registration request has been received. Our team will contact you to confirm the details.';
      } catch (error) { status.textContent = error.message || 'Could not send your registration. Please try again.'; }
      finally { submit.disabled = false; }
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
    Object.values(EVENTS_DATA).forEach(event => {
      if (event.image?.startsWith('/media/')) event.image = SITE.adminOrigin + event.image;
      event.speakers?.forEach(speaker => { if (speaker.image?.startsWith('/media/')) speaker.image = SITE.adminOrigin + speaker.image; });
    });
  } catch (err) {
    console.error('Could not load events:', err);
    setText('eventHeroTitle', 'Event unavailable');
    setText('eventDescription',
      'This event could not be loaded. Please go back to the events list, or email info@ehsanproperty.com.');
    document.getElementById('eventRegisterForm')?.closest('aside')?.setAttribute('hidden', '');
    return;
  }

  const eventId = getEventFromURL();
  const eventData = loadEventData(eventId);

  if (eventData) {
    renderEventContent(eventData);
    setupFormHandlers(eventData);
  } else {
    setText('eventHeroTitle', 'Event not found');
    setText('eventDescription',
      'We could not find that event. Browse all upcoming events instead.');
    document.getElementById('eventRegisterForm')?.closest('aside')?.setAttribute('hidden', '');
  }
});
