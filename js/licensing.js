(async () => {
  const root = document.getElementById('licensing-records');
  let data;
  try { const response = await fetch(`${SITE.adminOrigin}/api/public/project-licensing.json`, { cache: 'no-store' }); if (!response.ok) throw new Error('Unavailable'); data = await response.json(); }
  catch (_) { try { const response = await fetch(SITE.url('data/project-licensing.json')); if (!response.ok) throw new Error('Unavailable'); data = await response.json(); } catch (_) { root.textContent = 'Licensing information is currently unavailable. Please contact our team.'; return; } }
  document.getElementById('licensing-title').textContent = data.title;
  document.getElementById('licensing-intro').textContent = data.intro;
  document.title = `${data.title} — Ehsan Plant & Property`;
  root.replaceChildren();
  const nav = document.getElementById('licensing-nav');
  nav.setAttribute('role', 'tablist');
  const activate = id => {
    for (const panel of root.children) panel.hidden = panel.id !== id;
    for (const tab of nav.children) { const selected = tab.getAttribute('aria-controls') === id; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; }
  };
  for (const record of data.records.filter(record => record.published)) {
    const section = document.createElement('section'); section.className = 'licensing-record'; section.id = record.id;
    const heading = document.createElement('h2'); heading.textContent = record.project;
    const phase = document.createElement('p'); phase.className = 'licensing-phase'; phase.textContent = record.phase;
    const notice = document.createElement('p'); notice.className = 'licensing-notice'; notice.textContent = record.notice;
    const fields = document.createElement('dl'); fields.className = 'licensing-fields';
    for (const field of record.fields) {
      const row = document.createElement('div'); row.className = `licensing-field${field.value.length > 240 ? ' licensing-field--wide' : ''}`;
      const label = document.createElement('dt'); label.textContent = field.label;
      const value = document.createElement('dd');
      const restrictions = field.value.match(/(?:^|\s)(?:i|ii|iii|iv)\)\s*[\s\S]*?(?=\s+(?:i|ii|iii|iv)\)|$)/g);
      if (/sekatan/i.test(field.label) && restrictions?.length > 1) { const list = document.createElement('ol'); for (const text of restrictions) { const item = document.createElement('li'); item.textContent = text.trim().replace(/^(?:i|ii|iii|iv)\)\s*/, ''); list.append(item); } value.append(list); }
      else value.textContent = field.value;
      row.append(label, value); fields.append(row);
    }
    section.append(heading, phase, notice, fields); root.append(section);
    section.setAttribute('role', 'tabpanel'); section.setAttribute('aria-labelledby', `tab-${record.id}`);
    const tab = document.createElement('button'); tab.type = 'button'; tab.id = `tab-${record.id}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', record.id); tab.textContent = `${record.project} · ${record.phase}`;
    tab.addEventListener('click', () => { activate(record.id); history.replaceState(null, '', `#${record.id}`); });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const tabs = [...nav.children]; const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].click(); tabs[next].focus();
    });
    nav.append(tab);
  }
  if (!root.children.length) root.textContent = 'No licensing information is currently published.';
  else activate([...root.children].some(panel => `#${panel.id}` === location.hash) ? location.hash.slice(1) : root.firstElementChild.id);
})();
