/* Share recently published data across list/detail navigation, not private drafts. */
(() => {
  const base = new URL('../', document.currentScript.src).href;
  const admin = (window.EHSAN_CMS_ORIGIN || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3001' : location.origin)).replace(/\/$/, '');
  const key = `ehsan:published:${admin}`;
  const lifetime = 60_000;
  const preview = window.parent !== window || /\/preview\//.test(location.pathname) || new URLSearchParams(location.search).has('landing-editor');
  let projectsRequest;
  const read = () => {
    if (preview) return null;
    try { const item = JSON.parse(sessionStorage.getItem(key)); return item && Date.now() - item.savedAt < lifetime ? item : null; } catch { return null; }
  };
  const save = (projects, landing) => {
    if (preview) return;
    try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), projects, landing })); } catch { /* Storage may be disabled or full. */ }
  };
  const preloadHero = projects => {
    const slug = location.pathname.match(/\/projects\/([^/]+)\/?$/)?.[1];
    const project = projects?.[new URLSearchParams(location.search).get('project')] || (slug && Object.values(projects || {}).find(item => (item.slug || String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) === slug));
    const image = project?.media?.image?.[0] || project?.media?.thumbnail;
    if (!image) return;
    const link = document.createElement('link'); link.rel = 'preload'; link.as = 'image';
    link.href = /^(https?:)?\/\//.test(image) || image.startsWith('/') ? image : new URL(`assets/img/${image}`, base).href;
    link.fetchPriority = 'high'; document.head.append(link);
  };
  const getProjects = () => {
    const cached = read();
    if (cached?.projects) { preloadHero(cached.projects); return Promise.resolve(cached.projects); }
    if (!projectsRequest) projectsRequest = (async () => {
      let response;
      try { response = await fetch(`${admin}/api/public/projects.json`); if (!response.ok) throw new Error('Project service unavailable'); }
      catch { response = await fetch(new URL('data/projects.json?v=20260915.1', base)); }
      if (!response.ok) throw new Error('Failed to load projects');
      const projects = await response.json(); save(projects); preloadHero(projects); return projects;
    })();
    return projectsRequest;
  };
  window.EhsanPublicData = { getProjects, getLanding: () => read()?.landing, saveLanding: landing => save(landing.projects, landing) };
  // Start before fonts and the page's presentation scripts finish loading.
  if (/\/project-detail\.html$|\/projects\/[^/]+\/?$|\/preview\/project\.html$/.test(location.pathname)) getProjects().catch(() => {});
})();
