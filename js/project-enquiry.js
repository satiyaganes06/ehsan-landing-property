(async () => {
  const projects = window.EhsanPublicData ? await window.EhsanPublicData.getProjects().catch(() => ({})) : {};
  const reference = SITE.recordId('projects', projects);
  if (!reference) return;
  const admin = (window.EHSAN_CMS_ORIGIN || window.SITE?.adminOrigin || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3001' : '')).replace(/\/$/, '');
  if (!admin) return;
  let payload;
  try {
    payload = window.EhsanPublicData?.getLanding();
    if (!payload) { const response = await fetch(`${admin}/api/public/landing.json`, { cache: 'no-store' }); if (!response.ok) return; payload = await response.json(); window.EhsanPublicData?.saveLanding(payload); }
  } catch { return; }
  const settings = payload.projects?.[reference]?.enquiry;
  if (!settings?.enabled || !settings.interest) return;
  const defaults = {
    title: 'Send an enquiry', subtitle: 'Our team will follow up by email or phone. Fields marked with an asterisk are required.', button: 'Send enquiry',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: 'Phone', type: 'tel', placeholder: '01x-xxx xxxx' },
      { id: 'interest', label: 'Interested in', type: 'select' },
      { id: 'message', label: 'Message', type: 'textarea', required: true, wide: true },
    ],
  };
  let config = defaults;
  try { const saved = JSON.parse(payload.values?.['contact:form'] || 'null'); if (saved?.fields) config = { ...defaults, ...saved }; } catch { /* Use the standard form. */ }
  config.fields = config.fields.map(field => field.id === 'phoneCountry' ? {...field,id:'phone',type:'tel',options:[],placeholder:'Phone number'} : field);
  const text = html => { const template = document.createElement('template'); template.innerHTML = String(html || ''); return template.content.textContent.trim(); };
  const rich = (element, html) => {
    const template = document.createElement('template'); template.innerHTML = String(html || '');
    const copy = (source, parent) => {
      if (source.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(source.textContent)); return; }
      if (source.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'IMG', 'SVG', 'IFRAME', 'OBJECT', 'FORM'].includes(source.tagName)) return;
      const tag = source.tagName.toLowerCase(); const node = document.createElement(['strong', 'b', 'em', 'i', 'u', 's', 'br', 'span'].includes(tag) ? tag : 'span');
      if (['p', 'div'].includes(tag)) node.style.display = 'block';
      for (const property of ['color', 'backgroundColor']) if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(source.style[property])) node.style[property] = source.style[property];
      [...source.childNodes].forEach(child => copy(child, node)); parent.append(node);
    };
    [...template.content.childNodes].forEach(node => copy(node, element));
  };
  const section = document.createElement('section'); section.id = 'project-enquiry'; section.className = 'content project-enquiry';
  const inner = document.createElement('div'); inner.className = 'section';
  const header = document.createElement('header'); header.className = 'section__head';
  const label = document.createElement('p'); label.className = 'section__label'; label.textContent = 'Contact';
  const heading = document.createElement('h2'); heading.className = 'section__title'; heading.append('Everyone can '); const emphasis = document.createElement('em'); emphasis.textContent = 'own a house.'; heading.append(emphasis); header.append(label, heading);
  const layout = document.createElement('div'); layout.className = 'enquiry';
  const intro = document.createElement('div'); intro.className = 'enquiry__intro';
  const title = document.createElement('h3'); title.className = 'enquiry__title'; rich(title, config.title);
  const subtitle = document.createElement('p'); subtitle.className = 'enquiry__note'; rich(subtitle, config.subtitle); intro.append(title, subtitle);
  const form = document.createElement('form'); form.className = 'enquiry__form';
  // Keep the essential submission fields even if removed from the homepage form.
  const fields = [...config.fields];
  for (const field of defaults.fields) if (!fields.some(item => item.id === field.id)) fields.push(field);
  fields.forEach(field => {
    const wrap = document.createElement('div'); wrap.className = `field${field.wide ? ' field--wide' : ''}`;
    const fieldLabel = document.createElement('label'); fieldLabel.className = 'field__label'; fieldLabel.htmlFor = `project-enquiry-${field.id}`; rich(fieldLabel, field.label);
    const required = field.required || ['name', 'email', 'message'].includes(field.id);
    if (required) fieldLabel.append(' *');
    const type = field.id === 'interest' ? 'text' : field.type;
    const input = document.createElement(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
    if (input.tagName === 'INPUT') input.type = ['text', 'email', 'tel'].includes(type) ? type : 'text';
    input.name = field.id; input.id = fieldLabel.htmlFor; input.className = `field__input${type === 'textarea' ? ' field__input--area' : ''}`; input.required = Boolean(required); input.placeholder = field.placeholder || '';
    if (type === 'select') { const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = field.placeholder || 'Select an option'; input.append(placeholder); (field.options || []).forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; input.append(option); }); }
    if (field.id === 'interest') { input.value = settings.interest; input.readOnly = true; input.setAttribute('aria-readonly', 'true'); }
    wrap.append(fieldLabel);
    if (field.id === 'phone') {
      const phoneGroup = document.createElement('div'); phoneGroup.className = 'project-phone';
      const country = document.createElement('select'); country.name = 'phoneCountry'; country.className = 'field__input project-phone__country'; country.setAttribute('aria-label', 'Phone country code'); country.autocomplete = 'tel-country-code';
      [['MY', 'Malaysia', '+60'], ['SG', 'Singapore', '+65'], ['ID', 'Indonesia', '+62'], ['TH', 'Thailand', '+66'], ['BN', 'Brunei', '+673'], ['PH', 'Philippines', '+63'], ['VN', 'Vietnam', '+84'], ['CN', 'China', '+86'], ['HK', 'Hong Kong', '+852'], ['IN', 'India', '+91'], ['AU', 'Australia', '+61'], ['NZ', 'New Zealand', '+64'], ['GB', 'United Kingdom', '+44'], ['US', 'United States / Canada', '+1'], ['AE', 'United Arab Emirates', '+971']].forEach(([iso, name, code]) => {
        const option = document.createElement('option'); option.value = code; option.textContent = `${iso} ${code}`; option.label = `${name} (${code})`; option.defaultSelected = iso === 'MY'; country.append(option);
      });
      input.type = 'tel'; input.autocomplete = 'tel-national'; input.inputMode = 'tel'; input.maxLength = 24;
      phoneGroup.append(country, input); wrap.append(phoneGroup);
    } else { wrap.append(input); }
    if (field.help) { const help = document.createElement('p'); help.className = 'field__help'; help.id = `${input.id}-help`; rich(help, field.help); input.setAttribute('aria-describedby', help.id); wrap.append(help); } form.append(wrap);
  });
  const actions = document.createElement('div'); actions.className = 'enquiry__actions';
  const trap = document.createElement('input'); trap.name = 'website'; trap.type = 'text'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); trap.className = 'project-enquiry-trap';
  const button = document.createElement('button'); button.type = 'submit'; button.className = 'enquiry__submit'; button.textContent = text(config.button) || 'Send enquiry';
  const status = document.createElement('p'); status.className = 'enquiry__status'; status.setAttribute('role', 'status');
  actions.append(button, status); form.append(trap, actions); layout.append(intro, form); inner.append(header, layout); section.append(inner);
  document.querySelector('footer')?.before(section);
  // Project calls to action should lead to the on-page form when enabled.
  document.querySelectorAll('#widuriExperience a[href="#enquire"], #widuriExperience a[href="../index.html#contact"]').forEach(link => {
    link.setAttribute('href', '#project-enquiry');
  });
  const renderedAt = Date.now();
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    button.disabled = true; status.textContent = 'Sending…';
    const values = Object.fromEntries(new FormData(form));
    const phoneNumber = String(values.phone || '').trim().replace(/[\s().-]/g, '');
    const phone = window.EhsanPhone?.number(phoneNumber, values.phoneCountry) || phoneNumber;
    const extra = fields.filter(field => !['name', 'email', 'phone', 'interest', 'message'].includes(field.id)).map(field => `${text(field.label)}: ${values[field.id] || ''}`).join('\n');
    try {
      const response = await fetch(`${admin}/api/public/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name, email: values.email, phone, message: `${values.message}${extra ? '\n\n' + extra : ''}`, interest: settings.interest, projectReference: reference, website: values.website, renderedAt }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not send your enquiry.');
      form.reset(); form.elements.namedItem('interest').value = settings.interest; status.textContent = 'Thank you. Your enquiry has been received and our team will contact you.';
    } catch (error) { status.textContent = error.message || 'Could not send your enquiry. Please try again.'; }
    finally { button.disabled = false; }
  });
})();
