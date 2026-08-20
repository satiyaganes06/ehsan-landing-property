/* =========================================================================
   event-detail.js — Event detail page data binding & interactions
   ========================================================================= */

// Event data repository
const EVENTS_DATA = {
  'event-1': {
    id: 'event-1',
    title: 'Residensi Mutiara Austin Grand Launch',
    category: 'Property Launch',
    date: 'September 15, 2024',
    dateTime: 'Sep 15, 2024 · 2:00 PM',
    location: 'Johor Bahru, Malaysia',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    price: 'FREE',
    attendees: '150 Attendees',
    capacity: 200,
    registered: 87,
    description: 'Join us for the grand launch of Residensi Mutiara Austin, a premium 650-unit high-rise residential development in Johor Bahru. Experience the architecture, meet our team, and discover exclusive investment opportunities in one of the region\'s most anticipated property launches.',
    agenda: [
      { time: '2:00 PM', title: 'Welcome & Arrival', description: 'Registration and networking' },
      { time: '2:30 PM', title: 'Project Presentation', description: 'Overview of Residensi Mutiara Austin' },
      { time: '3:15 PM', title: 'Site Tour & Display', description: 'Guided tour of show units' },
      { time: '4:00 PM', title: 'Q&A Session', description: 'Direct conversation with developers' },
      { time: '4:30 PM', title: 'Light Refreshments', description: 'Networking opportunity' }
    ],
    speakers: [
      { name: 'Tan Sri Ehsan', title: 'Founder & Chairman', image: 'https://i.pravatar.cc/150?u=ehsan-founder', bio: '20+ years in property development' },
      { name: 'Dato\' Development Director', title: 'Project Director', image: 'https://i.pravatar.cc/150?u=ehsan-director', bio: 'Lead developer of Mutiara Austin' }
    ],
    highlights: [
      'Exclusive preview of show units',
      'Discounted pre-launch pricing',
      'Special financing options',
      'Networking with investors',
      'Complimentary refreshments',
      'Exclusive event goody bag'
    ],
    relatedEvents: ['event-2', 'event-3']
  },
  'event-2': {
    id: 'event-2',
    title: 'Ehsan Widuri Putra Nilai Open House',
    category: 'Open House',
    date: 'October 8, 2024',
    dateTime: 'Oct 8, 2024 · 10:00 AM',
    location: 'Nilai, Negeri Sembilan',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    price: 'FREE',
    attendees: '200 Attendees',
    capacity: 300,
    registered: 145,
    description: 'Explore Ehsan Widuri Putra Nilai, a 490-unit mixed-use development in the heart of Nilai. Tour completed units, meet current residents, and learn about upcoming phases. This open house is your chance to experience the community and lifestyle we\'ve built.',
    agenda: [
      { time: '10:00 AM', title: 'Registration & Welcome', description: 'Check-in and welcome briefing' },
      { time: '10:30 AM', title: 'Completed Units Tour', description: 'Walk through finished residences' },
      { time: '11:30 AM', title: 'Resident Meet & Greet', description: 'Chat with current residents' },
      { time: '12:00 PM', title: 'Phase 2 Preview', description: 'Upcoming development plans' },
      { time: '12:30 PM', title: 'Lunch & Networking', description: 'Casual dining and discussions' }
    ],
    speakers: [
      { name: 'Project Manager', title: 'Ehsan Widuri Lead', image: 'https://i.pravatar.cc/150?u=ehsan-pm', bio: 'Overseeing Widuri\'s development' },
      { name: 'Resident Ambassador', title: 'Happy Resident', image: 'https://i.pravatar.cc/150?u=ehsan-resident', bio: '2-year Widuri resident' }
    ],
    highlights: [
      'Tour 3 different unit types',
      'Meet current residents',
      'Preview Phase 2 designs',
      'Investment consultation',
      'Free lunch provided',
      'Parking available'
    ],
    relatedEvents: ['event-1', 'event-3']
  },
  'event-3': {
    id: 'event-3',
    title: 'Property Investment Seminar 2024',
    category: 'Seminar',
    date: 'October 22, 2024',
    dateTime: 'Oct 22, 2024 · 6:00 PM',
    location: 'Kuala Lumpur, Malaysia',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    price: 'FREE',
    attendees: '300 Attendees',
    capacity: 400,
    registered: 256,
    description: 'Learn investment strategies for Malaysian property from industry experts. Ehsan will present market insights, ROI strategies, and how to identify high-potential developments. Perfect for both seasoned investors and those new to property investment.',
    agenda: [
      { time: '6:00 PM', title: 'Welcome & Keynote', description: 'Market overview 2024-2025' },
      { time: '6:30 PM', title: 'Investment Strategies', description: 'Maximizing property ROI' },
      { time: '7:00 PM', title: 'Panel Discussion', description: 'Q&A with industry experts' },
      { time: '7:45 PM', title: 'Networking Breaks', description: 'Meet investors & developers' },
      { time: '8:30 PM', title: 'Closing Remarks', description: 'Next steps & opportunities' }
    ],
    speakers: [
      { name: 'Chief Investment Officer', title: 'Ehsan CIO', image: 'https://i.pravatar.cc/150?u=ehsan-cio', bio: 'Investment strategy expert' },
      { name: 'Market Analyst', title: 'Real Estate Specialist', image: 'https://i.pravatar.cc/150?u=ehsan-analyst', bio: 'Market trends analyst' }
    ],
    highlights: [
      'Market insights & trends',
      'Investment case studies',
      'ROI calculation methods',
      'Risk management strategies',
      'Exclusive offers',
      'Networking dinner'
    ],
    relatedEvents: ['event-1', 'event-2']
  }
};

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

function renderEventContent(data) {
  // Hero section
  document.getElementById('eventHeroImage').src = data.image;
  document.getElementById('eventHeroBadge').textContent = data.category;
  document.getElementById('eventHeroTitle').textContent = data.title;
  document.getElementById('eventHeroDate').textContent = data.dateTime;

  // Quick facts
  document.getElementById('eventDateTime').textContent = data.dateTime;
  document.getElementById('eventLocation').textContent = data.location;
  document.getElementById('eventAttendees').textContent = data.attendees;
  document.getElementById('eventPrice').textContent = data.price;

  // Description
  document.getElementById('eventDescription').textContent = data.description;

  // Agenda
  const agendaContainer = document.getElementById('eventAgenda');
  agendaContainer.innerHTML = data.agenda.map(item => `
    <div class="event-agenda__item">
      <div class="event-agenda__time">${item.time}</div>
      <div>
        <h4 class="event-agenda__title">${item.title}</h4>
        <p class="event-agenda__desc">${item.description}</p>
      </div>
    </div>
  `).join('');

  // Speakers
  const speakersContainer = document.getElementById('eventSpeakers');
  speakersContainer.innerHTML = data.speakers.map(speaker => `
    <div class="event-speaker-card">
      <img src="${speaker.image}" alt="${speaker.name}" class="event-speaker-avatar" referrerPolicy="no-referrer">
      <h4 class="event-speaker-name">${speaker.name}</h4>
      <p class="event-speaker-title">${speaker.title}</p>
      <p class="event-speaker-bio">${speaker.bio}</p>
    </div>
  `).join('');

  // Highlights
  const highlightsContainer = document.getElementById('eventHighlights');
  highlightsContainer.innerHTML = data.highlights.map(h => `<li>${h}</li>`).join('');

  // Sidebar stats
  document.getElementById('eventCapacity').textContent = `${data.capacity}`;
  document.getElementById('eventRegistered').textContent = `${data.registered}`;
  document.getElementById('eventSpotsLeft').textContent = `${data.capacity - data.registered}`;

  // Related events
  const relatedContainer = document.getElementById('relatedEvents');
  relatedContainer.innerHTML = data.relatedEvents.map(eventId => {
    const relEvent = EVENTS_DATA[eventId];
    if (!relEvent) return '';
    return `
      <a href="event-detail.html?event=${eventId}" class="event-related-card">
        <img src="${relEvent.image}" alt="${relEvent.title}" class="event-related-img">
        <div class="event-related-info">
          <h4 class="event-related-title">${relEvent.title}</h4>
          <p class="event-related-date">${relEvent.date}</p>
        </div>
      </a>
    `;
  }).join('');
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
document.addEventListener('DOMContentLoaded', () => {
  ROOT.classList.add('is-ready');

  const eventId = getEventFromURL();
  const eventData = loadEventData(eventId);

  if (eventData) {
    renderEventContent(eventData);
    setupFormHandlers();
  }

  // Initialize scroll-based navbar
  const handleScroll = () => {
    const isScrolled = window.scrollY > 1;
    ROOT.classList.toggle('past-hero', isScrolled);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
});
