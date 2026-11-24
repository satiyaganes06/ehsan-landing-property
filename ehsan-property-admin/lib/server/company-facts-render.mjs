// Used by both the live public endpoint and the static site's HTML export.
function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function renderCompanyFacts(data, projects) {
  const questions = data.questions.filter(row => row.label?.trim() && row.value?.trim());
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://ehsanproperty.com/ai-instructions/#buyer-questions',
    mainEntity: questions.map(row => ({
      '@type': 'Question', name: row.label,
      acceptedAnswer: {'@type': 'Answer', text: row.value}
    }))
  };
  const entries = rows => rows.map(row => `<div><dt>${escape(row.label)}</dt><dd>${escape(row.value)}</dd></div>`).join('\n');
  const portfolio = Object.values(projects).filter(p => p.name && /^[a-z0-9-]+$/.test(p.slug));
  const projectRows = portfolio.map(p => `<article><h3><a href="/projects/${escape(p.slug)}">${escape(p.name)}</a></h3>
<p class="location">${[p.location, p.status].filter(Boolean).map(escape).join(' · ')}</p><p>${escape(p.description)}</p></article>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(data.title)}</title><meta name="description" content="${escape(data.introduction)}">
<link rel="canonical" href="https://ehsanproperty.com/ai-instructions/"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/company-facts.css">
${questions.length ? `<script type="application/ld+json">${JSON.stringify(faq).replace(/</g, '\\u003c')}</script>` : ''}</head>
<body><div data-component="navbar"><nav><a href="/">Ehsan Plant &amp; Property</a></nav></div>
<main class="company-facts">
<header><h1>${escape(data.title)}</h1><p>${escape(data.introduction)}</p></header>
<section><h2>Company profile</h2><dl>${entries(data.facts)}</dl>
<p>Company profile reviewed <time datetime="${escape(data.reviewed)}">${escape(data.reviewed)}</time>. <a href="/about">Read the company history</a>.</p></section>
<section><h2>Projects by location</h2><div class="facts-projects">${projectRows || '<p>No projects are currently published.</p>'}</div><a href="/projects">Search the full portfolio</a></section>
${questions.length ? `<section id="buyer-questions"><h2>Buyer questions</h2>${questions.map(row => `<h3>${escape(row.label)}</h3><p>${escape(row.value)}</p>`).join('')}</section>` : ''}
<nav aria-label="Buyer resources"><a href="/project-licensing/">Check licences and permits</a><a href="/#contact">Send a project enquiry</a></nav>
</main><div data-component="footer"><footer><a href="/">Ehsan Property home</a></footer></div>
<script src="/components/registry.js"></script><script src="/components/navbar.js"></script><script src="/components/footer.js"></script><script src="/components/mount.js"></script></body></html>\n`;
}
