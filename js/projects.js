(() => {
  function initialise() {
    const ledger = document.querySelector('.ledger');
    if (!ledger) return;
    const cards = [...ledger.querySelectorAll(':scope > .pcard')].filter(card => !card.hidden);
    const archive = /\/projects\.html$/.test(location.pathname);
    let page = 0;
    const search = document.querySelector('[data-project-search]');
    const stateFilter = document.querySelector('[data-project-state]');
    const states = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'];
    const stateOf = card => {
      const location = card.querySelector('.pcard__loc')?.textContent.toLowerCase() || '';
      return states.find(state => location.includes(state.toLowerCase()) || (state === 'Pulau Pinang' && location.includes('penang')) || (state === 'Negeri Sembilan' && /n\.?\s*sembilan/.test(location))) || '';
    };
    if (stateFilter) {
      const available = new Set(cards.map(stateOf).filter(Boolean));
      states.filter(state => available.has(state)).forEach(state => { const option = document.createElement('option'); option.value = state; option.textContent = state; stateFilter.append(option); });
    }
    const nav = document.querySelector('[data-project-pagination]');
    const paint = () => {
      const filtered = cards.filter(card => (!search?.value || card.textContent.toLowerCase().includes(search.value.trim().toLowerCase())) && (!stateFilter?.value || stateOf(card) === stateFilter.value));
      const size = archive ? 6 : 3;
      const pages = Math.max(1, Math.ceil(filtered.length / size));
      page = Math.min(page, pages - 1);
      const visible = new Set(filtered.slice(page * size, (page + 1) * size));
      cards.forEach(card => card.classList.toggle('project-page-hidden', !visible.has(card)));
      if (!nav) return;
      nav.replaceChildren();
      const count = document.createElement('p'); count.textContent = filtered.length ? `Showing ${page * size + 1}–${Math.min(filtered.length, (page + 1) * size)} of ${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}` : 'No matching projects'; nav.append(count);
      const button = (label, next, disabled = false) => { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.disabled = disabled; if (next === page && /^\d+$/.test(label)) item.setAttribute('aria-current', 'page'); item.addEventListener('click', () => { page = next; paint(); ledger.scrollIntoView({ block: 'start', behavior: 'auto' }); }); nav.append(item); };
      if (pages > 1) { button('Previous', page - 1, page === 0); for (let i = 0; i < pages; i++) button(String(i + 1), i); button('Next', page + 1, page === pages - 1); }
    };
    search?.addEventListener('input', () => { page = 0; paint(); });
    stateFilter?.addEventListener('change', () => { page = 0; paint(); });
    paint();
  }
  if (window.projectContentReady) initialise();
  else window.addEventListener('ehsan:projects-ready', initialise, { once: true });
})();
