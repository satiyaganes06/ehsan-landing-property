/* Progressive enhancement: real selects still own values and form validation. */
(() => {
  let sequence = 0;
  const enhance = select => {
    if (select.multiple || select.size > 1 || select.dataset.modernSelect) return;
    select.dataset.modernSelect = 'true';
    const wrapper = document.createElement('div'); wrapper.className = 'modern-select';
    const trigger = document.createElement('button'); trigger.type = 'button';
    trigger.className = `${select.className} modern-select__trigger`;
    const menu = document.createElement('div'); menu.className = 'modern-select__menu';
    menu.id = `modern-select-${++sequence}`; menu.role = 'listbox'; menu.hidden = true;
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'false');
    const label = select.getAttribute('aria-label') || [...(select.labels || [])].map(label => {
      const copy = label.cloneNode(true); copy.querySelectorAll('select, button').forEach(control => control.remove()); return copy.textContent.trim();
    }).join(' ') || select.name || 'Choose an option';
    trigger.setAttribute('aria-label', label);
    select.before(wrapper); wrapper.append(select, trigger); document.body.append(menu);
    select.classList.add('modern-select__native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    let active = 0;
    const sync = () => { const option = select.selectedOptions[0]; trigger.textContent = select.dataset.countryCodes && option ? `${option.value} ${option.dataset.dialCode}` : option?.label || 'Choose an option'; trigger.disabled = select.disabled; trigger.setAttribute('aria-required', String(select.required)); };
    const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); };
    const highlight = index => {
      const items = [...menu.children]; if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, index));
      items.forEach((item, i) => item.classList.toggle('is-active', i === active));
      trigger.setAttribute('aria-activedescendant', items[active].id);
      const item = items[active];
      if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
      else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
    };
    const choose = index => {
      const option = select.options[index]; if (!option || option.disabled) return;
      select.value = option.value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); sync(); close(); trigger.focus();
    };
    const open = () => {
      if (select.disabled) return;
      menu.replaceChildren();
      [...select.options].forEach((option, index) => {
        const item = document.createElement('div'); item.id = `${menu.id}-${index}`; item.role = 'option'; item.textContent = option.label;
        item.setAttribute('aria-selected', String(option.selected)); item.setAttribute('aria-disabled', String(option.disabled));
        item.addEventListener('pointerdown', event => { event.preventDefault(); choose(index); });
        menu.append(item);
      });
      const rect = trigger.getBoundingClientRect();
      const below = innerHeight - rect.bottom - 12, above = rect.top - 12;
      const upward = below < 160 && above > below;
      menu.style.width = `${rect.width}px`; menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8))}px`;
      menu.style.maxHeight = `${Math.min(280, Math.max(80, upward ? above : below))}px`;
      menu.style.top = upward ? 'auto' : `${rect.bottom + 6}px`; menu.style.bottom = upward ? `${innerHeight - rect.top + 6}px` : 'auto';
      menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); highlight(Math.max(0, select.selectedIndex));
    };
    trigger.addEventListener('click', event => { event.preventDefault(); menu.hidden ? open() : close(); });
    let search = '', lastKey = 0;
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Escape') close();
        else if (menu.hidden) open();
        else if (event.key === 'Enter' || event.key === ' ') choose(active);
        else highlight(event.key === 'Home' ? 0 : event.key === 'End' ? select.options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Tab') close();
      else if (event.key.length === 1) {
        search = Date.now() - lastKey > 700 ? event.key : search + event.key; lastKey = Date.now();
        if (menu.hidden) open();
        const match = [...select.options].findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(search.toLowerCase()));
        if (match >= 0) highlight(match);
      }
    });
    select.addEventListener('change', sync); select.addEventListener('focus', () => trigger.focus());
    select.addEventListener('invalid', event => { event.preventDefault(); trigger.focus(); trigger.setAttribute('aria-invalid', 'true'); });
    select.form?.addEventListener('reset', () => requestAnimationFrame(sync));
    document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target) && !menu.contains(event.target)) close(); });
    window.addEventListener('resize', close); window.addEventListener('scroll', event => { if (!menu.contains(event.target)) close(); }, true);
    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true });
    sync();
  };
  const scan = () => document.querySelectorAll('select:not([data-modern-select])').forEach(enhance);
  scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
