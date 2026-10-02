// Read-only integration checks. Run while the public and admin servers are up.
const site = process.env.QA_SITE_ORIGIN || 'http://localhost:8899';
const cms = process.env.QA_CMS_ORIGIN || 'http://localhost:3001';
let checks = 0;
const failures = [];
async function check(url, expected = 200) {
  const response = await fetch(url);
  checks++;
  if (response.status !== expected) failures.push(`${response.status} (expected ${expected}): ${url}`);
  return response;
}
const projects = await (await check(`${cms}/api/public/projects.json`)).json();
const news = await (await check(`${cms}/api/public/news.json`)).json();
const events = await (await check(`${cms}/api/public/events.json`)).json();
await check(`${cms}/api/public/landing.json`);
for (const path of ['/index.html', '/html/about.html', '/html/projects.html', '/html/news.html', '/html/events.html']) await check(site + path);
const assets = new Set();
function image(value) {
  if (!value || /^https?:\/\//.test(value)) return;
  assets.add(value.startsWith('/media/') ? cms + value : value.startsWith('/') ? site + value : value.startsWith('assets/') ? `${site}/${value}` : `${site}/assets/img/${value}`);
}
for (const [id, project] of Object.entries(projects)) {
  await check(`${site}/html/project-detail.html?project=${id}`);
  const share = await (await check(`${cms}/api/public/share/project/${id}`)).text();
  if (!share.includes('og:image') || !share.includes('twitter:card')) failures.push(`Missing share metadata: ${id}`);
  for (const item of [...(project.media?.image || []), ...(project.media?.blueprint || [])]) image(typeof item === 'string' ? item : item.src);
}
for (const article of news.articles) {
  await check(`${site}/html/news-detail.html?news=${article.id}`);
  const share = await (await check(`${cms}/api/public/share/news/${article.id}`)).text();
  if (!share.includes('og:image') || !share.includes('twitter:card')) failures.push(`Missing share metadata: ${article.id}`);
  image(article.image); image(article.thumbnail);
  for (const path of article.images || []) image(path);
}
for (const [id, event] of Object.entries(events)) {
  await check(`${site}/html/event-detail.html?event=${id}`);
  image(event.image);
}
for (const url of assets) await check(url);
for (const path of ['projects', 'news', 'events', 'enquiries', 'users']) await check(`${cms}/api/${path}`, 401);
for (const body of [{}, { name: 'QA invalid', email: 'not-email', message: 'Invalid test', consent: true }]) {
  const response = await fetch(`${cms}/api/public/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  checks++; if (response.status !== 400) failures.push(`Invalid enquiry accepted: ${response.status}`);
}
console.log(JSON.stringify({ checks, projects: Object.keys(projects).length, news: news.articles.length, events: Object.keys(events).length, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
