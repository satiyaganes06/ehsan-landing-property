const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname,'navbar.js'),'utf8');
function setup(page) {
  const listeners = {};
  const site = {page,url:path=>'https://example.test/'+path,define:(_,render)=>site.render=render};
  const document = {addEventListener:(name,callback)=>listeners[name]=callback,querySelectorAll:()=>[]};
  runInNewContext(source,{SITE:site,document});
  return {html:site.render(site),listeners,document};
}
test('every public page has a mobile menu with all navigation links',()=>{
  for (const page of ['index.html','about.html','projects.html','project-detail.html','events.html','event-detail.html','news.html','news-detail.html','project-licensing']) {
    const {html} = setup(page);
    assert.equal(html.includes('class="topnav__cta"'),false,page);
    const menu = html.match(/<details class="project-nav">([\s\S]*?)<\/details>/)?.[1];
    assert.ok(menu,page);
    assert.equal((menu.match(/<a /g)||[]).length,7,page);
    for (const label of ['Home','About','Projects','Gallery','Events','Contact','News']) assert.ok(menu.includes(`>${label}</a>`),`${page}: ${label}`);
  }
});
test('Escape closes the dropdown and returns focus to its toggle',()=>{
  const {listeners,document}=setup('index.html');
  let focused=false;
  const menu={open:true,contains:()=>true,querySelector:()=>({focus:()=>focused=true})};
  document.querySelectorAll=()=>[menu];
  listeners.keydown({key:'Escape'});
  assert.equal(menu.open,false); assert.equal(focused,true);
});
test('navigation and outside clicks close the dropdown',()=>{
  const {listeners,document}=setup('index.html');
  const menu={open:true,contains:()=>false};
  document.querySelectorAll=()=>[menu];
  listeners.click({target:{}}); assert.equal(menu.open,false);
  menu.open=true; menu.contains=()=>true;
  listeners.click({target:{closest:()=>({})}}); assert.equal(menu.open,false);
});
