const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const window = {};
runInNewContext(readFileSync(__dirname+'/phone-codes.js','utf8'), {window,document:{body:{},querySelectorAll:()=>[]},MutationObserver:class{observe(){}}});
test('complete country list includes distinct countries sharing a calling code',()=>{
  assert.equal(window.EhsanPhone.countries.length,245);
  for(const iso of ['MY','CA','US','XK','AC','TA','IT','GB']) assert.ok(window.EhsanPhone.countries.some(row=>row[0]===iso));
});
test('phone composition preserves country-specific national prefixes',()=>{
  assert.equal(window.EhsanPhone.number('012-345 6789','MY'),'+60123456789');
  assert.equal(window.EhsanPhone.number('06 12345678','IT'),'+390612345678');
  assert.equal(window.EhsanPhone.number('+44 20 1234 5678','MY'),'+442012345678');
  assert.equal(window.EhsanPhone.number('','MY'),'');
});
