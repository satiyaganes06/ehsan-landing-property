/* First party, cookieless traffic measurement. Page query strings and visitor
   identities are never sent. Admin previews and Do Not Track are respected. */
(() => {
  if (window.parent !== window || new URLSearchParams(location.search).has('landing-editor') || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  try {
    const key = 'ehsan.analytics.session';
    const sessionId = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
    let source = '';
    if (document.referrer) { const previous = new URL(document.referrer); if (previous.origin !== location.origin) source = previous.hostname; }
    const device = matchMedia('(max-width: 767px)').matches ? 'Mobile' : matchMedia('(max-width: 1023px)').matches ? 'Tablet' : 'Desktop';
    const admin = window.SITE?.adminOrigin || 'http://localhost:3001';
    fetch(`${admin}/api/public/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, path: location.pathname, source, device }), keepalive: true }).catch(() => {});
  } catch (_) { /* Storage restrictions must never affect the website. */ }
})();
