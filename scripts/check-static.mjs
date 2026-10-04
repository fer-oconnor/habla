import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const manifest=JSON.parse(fs.readFileSync('scripts/curriculum-integrity.json','utf8'));
const bytes=fs.readFileSync('app/curriculum.json');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256,'The final curriculum changed. Review intentional changes and update scripts/curriculum-integrity.json.');
const catalog=JSON.parse(bytes);
for(const [key,count] of Object.entries(manifest.counts)) assert.equal(catalog[key].length,count,key);
assert.equal(catalog.exercises.filter(e=>e.payload.editor).length,265);
for(const e of catalog.exercises.filter(e=>e.payload.editor)) {
  assert.ok(e.payload.instructions?.output,e.slug);
  assert.ok(e.payload.instructions?.example,e.slug);
  assert.equal(e.expected.length,e.payload.cases.length,e.slug);
}
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?walk(file):/\.(?:js|cjs|mjs)$/.test(entry.name)?[file]:[];
});
const files=[...walk('public/js'),...walk('scripts'),...walk('app')];
for(const file of files) {
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});
  assert.equal(check.status,0,file+'\n'+check.stderr);
}
// Check the browser harness before importing Playwright or making requests.
for(const url of ['https://habla-python-sql.fernandino.chatgpt.site','https://example.com','http://127.0.0.1:5173/learn']) {
  const check=spawnSync(process.execPath,['-e',"require('./scripts/qa-browser.cjs')"],{env:{...process.env,HABLA_TEST_URL:url},encoding:'utf8',windowsHide:true});
  assert.notEqual(check.status,0,'Browser checks must reject '+url);
  assert.match(check.stderr,/loopback origin/);
}
console.log(JSON.stringify({curriculumIntegrity:true,counts:manifest.counts,codeEditors:265,javascriptSyntaxFiles:files.length,productionBrowserTestsRefused:true}));
