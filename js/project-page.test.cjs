const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function render(data) {
  const root = { dataset: {}, innerHTML: '', querySelector: () => ({ remove() {} }) };
  const context = { window: {}, document: { getElementById: () => root, querySelector: () => ({ hidden: false }) }, imgUrl: value => value };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/project-page.js`, 'utf8'), context);
  context.window.ProjectPage.generic(data);
  return root.innerHTML;
}
test('all imported projects render only archive sections and assets', () => {
  const projects = JSON.parse(fs.readFileSync(`${__dirname}/../data/projects.json`, 'utf8'));
  const manifest = require('../ehsan-property-admin/scripts/project-archive-manifest.cjs');
  for (const entry of manifest) {
    const data = projects[entry.reference];
    const html = render(data);
    assert.match(html, /data-project-section="overview"/);
    assert.match(html, /data-project-section="specifications"/);
    for (const unsupported of ['fit', 'shuttle', 'certificate', 'cta']) assert.ok(!html.includes(`data-project-section="${unsupported}"`), `${entry.reference}: ${unsupported}`);
    assert.ok(!html.includes('google.com/maps'), entry.reference);
    assert.ok(!html.includes('proj-widuri'), entry.reference);
    for (const filename of Object.values(data.media).flat().filter(Boolean)) assert.ok(fs.existsSync(`${__dirname}/../assets/img/${filename}`), filename);
  }
});
test('new empty templates hide unused sections', () => {
  const html = render({ name: 'New project', location: '', content: { template: 'widuri-sections-v1' }, media: {}, enquiry: { sections: { cta: false } } });
  assert.ok(!html.includes('<section'));
});
test('supplied text is escaped, never executable markup', () => {
  const html = render({ name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', content: { template: 'widuri-sections-v1', sourceOnly: true }, media: {} });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;img'));
});
