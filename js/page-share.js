(() => {
  const admin = (window.EHSAN_CMS_ORIGIN || window.SITE?.adminOrigin || 'http://localhost:3001').replace(/\/$/, '');
  window.EhsanShare = {
    render({ kind, id, title, description, image }, target) {
      if (!target) return;
      const url = `${admin}/api/public/share/${kind}/${encodeURIComponent(id)}`;
      const setMeta = (name, content, property = true) => {
        const attribute = property ? 'property' : 'name';
        let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
        if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, name); document.head.append(tag); }
        tag.content = content || '';
      };
      setMeta('og:title', title); setMeta('og:description', description); setMeta('og:type', kind === 'news' ? 'article' : 'website'); setMeta('og:url', url); setMeta('og:image', image); setMeta('og:image:alt', title); setMeta('og:site_name', 'Ehsan Plant & Property');
      setMeta('twitter:card', 'summary_large_image', false); setMeta('twitter:title', title, false); setMeta('twitter:description', description, false); setMeta('twitter:image', image, false); setMeta('description', description, false);
      const area = document.createElement('div'); area.className = 'page-share'; area.setAttribute('aria-label', `Share this ${kind}`);
      const share = document.createElement('button'); share.type = 'button';
      if (kind === 'project') {
        share.innerHTML = 'Share <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>';
      } else { share.textContent = 'Share article ↗'; }
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
      const links = document.createElement('div'); links.className = 'page-share'; links.hidden = true;
      const status = document.createElement('span'); status.className = 'page-share__status'; status.setAttribute('role', 'status');
      const encoded = encodeURIComponent(url), caption = encodeURIComponent(title);
      for (const [label, href] of [['WhatsApp', `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encoded}`], ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`], ['X', `https://twitter.com/intent/tweet?url=${encoded}&text=${caption}`]]) {
        const link = document.createElement('a'); link.textContent = label; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `Share on ${label} (opens a new tab)`); links.append(link);
      }
      share.setAttribute('aria-expanded', 'false');
      share.addEventListener('click', async () => {
        if (navigator.share) { try { await navigator.share({ title, text: description, url }); return; } catch (error) { if (error.name === 'AbortError') return; } }
        links.hidden = !links.hidden; share.setAttribute('aria-expanded', String(!links.hidden));
      });
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied.'; }
        catch { status.textContent = 'Copy this link: '; const field = document.createElement('input'); field.readOnly = true; field.value = url; field.setAttribute('aria-label', 'Share link'); status.append(field); field.select(); }
      });
      area.append(share); if (kind !== 'project') area.append(copy); area.append(status, links); target.append(area);
    },
  };
})();
