import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import Database from './sqlite-adapter.mjs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import catalog from '../app/curriculum.json' with {type:'json'};
import * as normalize from '../app/normalize.js';
import * as creator from '../app/creator-summary.js';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const sqlite=new Database(':memory:');
sqlite.exec(fs.readFileSync('drizzle/0000_cynical_cassandra_nova.sql','utf8'));
const db={prepare(sql){let args=[];const stmt=sqlite.prepare(sql),q={bind(...values){args=values;return q;},async first(){return stmt.get(...args)??null;},async all(){return {results:stmt.all(...args)};},run(){return {meta:{changes:stmt.run(...args).changes}};}};return q;},async batch(statements){return sqlite.transaction(()=>statements.map(q=>q.run()))();}};
const env={DB:db,HABLA_OWNER_USER_ID:'owner'},exports={};
const source=ts.transpileModule(fs.readFileSync('app/backend.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>n==='cloudflare:workers'?{env}:n==='./curriculum.json'?{default:catalog}:n==='./normalize.js'?normalize:n==='./creator-summary.js'?creator:null,Request,Response,URL,Intl,Date,JSON,Map,Set,crypto,console});
async function request(user,path,method='GET',body) {
  const r=await exports.handle(new Request('https://habla-python-sql.fernandino.chatgpt.site/api/v1/'+path,{method,
    headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'test@example.test'}:{}),...(method==='GET'?{}:{Origin:'https://habla-python-sql.fernandino.chatgpt.site','Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:r.status,data:await r.json()};
}
const insert=sqlite.prepare('INSERT INTO learners(id,state,updated_at) VALUES(?,?,?)'),stored=id=>sqlite.prepare('SELECT state,revision FROM learners WHERE id=?').get(id);
for(const l of catalog.lessons) {
  assert.equal((await request('new','lessons/'+l.id)).status,200,l.slug);
  const attempt=await request('new','attempts','POST',{lessonId:l.id});assert.equal(attempt.status,200,l.slug);
  assert.equal(attempt.data.attempt.lesson.id,l.id);assert.equal(attempt.data.attempt.exercises.length,8);
}
assert.equal(JSON.parse(stored('new').state).xp,0);
for(const track of ['sql','python']) {
  const c=await request('new','units?track='+track);assert.equal(c.status,200);
  assert.ok(c.data.units.flatMap(u=>u.lessons).every(l=>l.status==='available'));
  assert.equal(c.data.nextLesson.trackOrder,1);assert.equal(c.data.resumeLesson.trackOrder,36);
}
const saved={user:{displayName:'Con avances',onboardingDone:true,timezone:'Europe/Madrid',dailyGoal:2,progressSharing:false,progressNoticeVersion:creator.PROGRESS_NOTICE_VERSION},
  lessonProgress:{13:{status:'completed',bestCorrect:8,attempts:3,xpEarned:10},55:{status:'completed',bestCorrect:7,attempts:2,xpEarned:10},90:{status:'completed',bestCorrect:8,attempts:1,xpEarned:10}},daily:{'2026-10-02':{lessons:[13,55,90],xp:30}},reviews:{},vocabulary:{},achievements:{first_lesson:'2026-10-02'},answered:24,correct:23,xp:30,custom:'keep this too'};
insert.run('saved',JSON.stringify(saved),'2026-10-02');const before=stored('saved');
assert.equal((await request('saved','progress')).data.xp,30);
assert.equal((await request('saved','units?track=sql')).data.nextLesson.id,14);
assert.equal((await request('saved','units?track=python')).data.nextLesson.id,56);
assert.deepEqual(stored('saved'),before,'Read-only views must not rewrite a valid profile');
const last=await request('saved','attempts','POST',{lessonId:54});assert.equal(last.status,200);
assert.deepEqual(JSON.parse(stored('saved').state).lessonProgress,saved.lessonProgress);
assert.equal(JSON.parse(stored('saved').state).xp,30);
assert.equal(JSON.parse(stored('saved').state).custom,saved.custom);
for(const [index,progress] of [undefined,null,'invalid',42,{13:null,14:'locked',55:{status:'nonsense'}}].entries()) {
  const id='invalid_'+index;insert.run(id,JSON.stringify({...saved,lessonProgress:progress,daily:{broken:null},reviews:{bogus:null}}),'2026-10-02');
  const snapshot=stored(id);const c=await request(id,'units?track=python');assert.equal(c.status,200);assert.equal(c.data.units.flatMap(u=>u.lessons).length,36);
  assert.ok(c.data.units.flatMap(u=>u.lessons).every(l=>l.status==='available'));
  assert.equal((await request(id,'progress')).status,200);assert.deepEqual(stored(id),snapshot);
  assert.equal((await request(id,'attempts','POST',{lessonId:90})).status,200);
  const after=JSON.parse(stored(id).state);assert.equal(after.xp,30);assert.equal(after.custom,saved.custom);
  if(progress!==undefined&&(!progress||typeof progress!=='object')) assert.deepEqual(after._preservedProgress.lessonProgress,progress);
}
insert.run('broken','{not valid JSON','2026-10-02');const broken=stored('broken');
assert.equal((await request('broken','me')).data.user.progressUnavailable,true);
assert.equal((await request('broken','units?track=sql')).status,200);
assert.equal((await request('broken','attempts','POST',{lessonId:54})).status,503);
assert.equal((await request('broken','lessons/54/preview')).status,200);assert.deepEqual(stored('broken'),broken);
assert.equal((await request('owner','admin/learners')).status,200,'A malformed profile must not crash the creator panel');
env.DB={prepare(){throw new Error('Simulated storage failure');}};
assert.equal((await request('saved','me')).data.user.progressUnavailable,true);
assert.equal((await request('saved','units?track=python')).data.progressUnavailable,true);
assert.equal((await request('saved','lessons/90')).status,200);
const preview=await request('saved','lessons/54/preview');assert.equal(preview.status,200);assert.equal(preview.data.attempt.temporary,true);
assert.equal((await request('saved','attempts','POST',{lessonId:90})).status,503);
const e=catalog.exercises.find(e=>e.lesson_id===54&&!e.payload.editor&&e.type==='choose_translation');
const right=await request('saved',`lessons/54/check/${e.id}`,'POST',{answer:e.solution.value});assert.equal(right.status,200);assert.equal(right.data.correct,true);assert.equal(right.data.temporary,true);
const wrong=await request('saved',`lessons/54/check/${e.id}`,'POST',{answer:e.payload.options.find(x=>x!==e.solution.value)});assert.equal(wrong.data.correct,false);
assert.equal((await request(null,'lessons/54/preview')).status,401);assert.equal((await request('saved','lessons/999')).status,404);
env.DB=db;assert.deepEqual(JSON.parse(stored('saved').state).lessonProgress,saved.lessonProgress);assert.equal(JSON.parse(stored('saved').state).xp,30);
const integrity=JSON.parse(fs.readFileSync('scripts/curriculum-integrity.json','utf8'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('app/curriculum.json')).digest('hex'),integrity.sha256,'Final content, IDs, exercises and solutions must remain unchanged');
sqlite.close();console.log(JSON.stringify({all72LessonsOpenForNewUser:true,recommendationInOrder:true,resumeSeparate:true,savedDataPreserved:true,missingAndInvalidProgress:true,malformedRecordUntouched:true,storageFailureNoSavePractice:true,correctionStillWorks:true,catalogUnchanged:true}));
