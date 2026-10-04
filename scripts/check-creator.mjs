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
const env={HABLA_OWNER_USER_ID:'creator_test',DB:{
  prepare(sql) {
    let args=[];const statement=sqlite.prepare(sql);
    const query={bind(...values){args=values;return query;},
      async first(){return statement.get(...args)??null;},
      async all(){return {results:statement.all(...args)};},
      run(){return {meta:{changes:statement.run(...args).changes}};}};
    return query;
  },
  async batch(statements) {return sqlite.transaction(()=>statements.map(q=>q.run()))();},
}};
const source=ts.transpileModule(fs.readFileSync('app/backend.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(source,{exports,require:name=>{
  if(name==='cloudflare:workers')return {env};
  if(name==='./curriculum.json')return {default:catalog};
  if(name==='./normalize.js')return normalize;
  if(name==='./creator-summary.js')return creator;
  throw new Error('Unexpected module '+name);
},Request,Response,URL,Intl,Date,JSON,Map,Set,crypto,console});
const notice=creator.PROGRESS_NOTICE_VERSION;
function state(name,sharing,version=notice) {return {user:{id:'unused',email:'private@example.test',displayName:name,timezone:'Europe/Madrid',onboardingDone:true,progressSharing:sharing,progressNoticeVersion:version},
  lessonProgress:{13:{status:'completed'},55:{status:'completed'}},daily:{},reviews:{},vocabulary:{},achievements:{},answered:10,correct:8,xp:20};}
const insert=sqlite.prepare('INSERT INTO learners(id,state,updated_at) VALUES(?,?,?)');
insert.run('creator_test',JSON.stringify(state('Creador',true)),'2026-10-01T10:00:00Z');
insert.run('learner_test',JSON.stringify(state('<script>alert(1)</script>',true)),'2026-10-01T10:00:00Z');
insert.run('legacy_test',JSON.stringify(state('No informado',true,null)),'2026-10-01T10:00:00Z');
insert.run('private_test',JSON.stringify(state('No comparte',false)),'2026-10-01T10:00:00Z');
sqlite.prepare('INSERT INTO attempts(id,user_id,lesson_id,status,data,updated_at) VALUES(?,?,?,?,?,?)')
  .run(1,'learner_test',13,'in_progress',JSON.stringify({answers:{97:{answer:'NO EXPONER',correct:true}},drafts:{119:{code:'CODIGO PRIVADO'}}}),'2026-10-02T15:00:00Z');
async function request(user,path,method='GET',body) {
  const response=await exports.handle(new Request('https://habla-python-sql.fernandino.chatgpt.site/api/v1/'+path,{method,
    headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'verified@example.test'}:{}),
      ...(method==='GET'?{}:{Origin:'https://habla-python-sql.fernandino.chatgpt.site','Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,data:await response.json()};
}
assert.equal((await request(null,'admin/learners')).status,401);
assert.equal((await request('learner_test','admin/learners')).status,403);
assert.equal((await request('learner_test','me','PATCH',{isCreator:true})).status,403);
assert.equal((await request('learner_test','me','PATCH',{id:'creator_test'})).status,403);
assert.equal((await request('creator_test','admin/learners','POST',{})).status,405);
const before=sqlite.prepare('SELECT state,updated_at FROM learners WHERE id=?').get('learner_test');
const dashboard=await request('creator_test','admin/learners');
assert.equal(dashboard.status,200);assert.equal(dashboard.data.total,2);
assert.equal(dashboard.data.accuracy,80);
const student=dashboard.data.participants.find(x=>!x.isYou);
assert.equal(student.lastActivityAt,'2026-10-02T15:00:00Z');
assert.deepEqual(student.tracks.map(t=>t.completed),[1,1]);
for(const key of ['email','id','answers','drafts','user_id','state','data','code']) assert.ok(!Object.hasOwn(student,key));
assert.ok(!JSON.stringify(dashboard.data).includes('NO EXPONER'));
assert.ok(!JSON.stringify(dashboard.data).includes('CODIGO PRIVADO'));
assert.deepEqual(sqlite.prepare('SELECT state,updated_at FROM learners WHERE id=?').get('learner_test'),before);
assert.equal((await request('creator_test','admin/learners?page=0')).status,400);
assert.equal((await request('creator_test','admin/learners?page=1%20OR%201=1')).status,400);
const off=await request('learner_test','me','PATCH',{progressSharing:false,progressNoticeVersion:notice});
assert.equal(off.status,200);assert.equal(off.data.user.isCreator,false);
assert.equal((await request('creator_test','admin/learners')).data.total,1);
const unchanged=JSON.parse(sqlite.prepare('SELECT state FROM learners WHERE id=?').get('learner_test').state);
assert.equal(unchanged.xp,20);assert.equal(unchanged.lessonProgress[55].status,'completed');
assert.equal((await request('private_test','me','PATCH',{progressSharing:true})).status,400);
assert.equal((await request('creator_test','me')).data.user.isCreator,true);
for(let i=0;i<51;i++) insert.run('page_test_'+i,JSON.stringify(state('Participante '+i,true)),'2026-10-01T10:00:00Z');
const firstPage=(await request('creator_test','admin/learners?page=1')).data;
const secondPage=(await request('creator_test','admin/learners?page=2')).data;
assert.equal(firstPage.total,52);assert.equal(firstPage.participants.length,50);assert.equal(firstPage.hasNext,true);
assert.equal(secondPage.participants.length,2);assert.equal(secondPage.hasNext,false);
env.HABLA_OWNER_USER_ID='';assert.equal((await request('creator_test','admin/learners')).status,403);
sqlite.close();
console.log(JSON.stringify({creatorOnly:true,noPrivilegeEscalation:true,legacyAndPrivateExcluded:true,minimalProjection:true,withdrawalImmediate:true,progressPreserved:true,readOnly:true,pagination:true,missingConfigDenied:true}));
