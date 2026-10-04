// Regenerate teaching content from ../local without opening any learner database.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runReference} from './curriculum-runtime.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.HABLA_CURRICULUM_OUTPUT
  ? path.resolve(process.env.HABLA_CURRICULUM_OUTPUT)
  : path.join(root,'app','curriculum.json');
const previous=JSON.parse(fs.readFileSync(path.join(root,'app','curriculum.json'),'utf8'));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'habla-curriculum-'));
const databaseFile=path.join(temporary,'curriculum.db');
const savedDatabaseFile=process.env.DATABASE_FILE;
process.env.DATABASE_FILE=databaseFile;
let closeDatabase=()=>{};
try {
  const {getDb,closeDb}=await import('../local/db/index.js');
  closeDatabase=closeDb;
  const {seed}=await import('../local/db/seed.js');
  seed();
  const db=getDb();
  const tracks=db.prepare('SELECT * FROM tracks WHERE active=1 ORDER BY position').all();
  const lessons=db.prepare('SELECT l.* FROM lessons l JOIN tracks t ON t.slug=l.track WHERE t.active=1 ORDER BY global_order').all();
  const units=db.prepare('SELECT u.* FROM units u JOIN tracks t ON t.slug=u.track WHERE t.active=1 ORDER BY u.position').all();
  const lessonIds=new Set(lessons.map(x=>x.id));
  const exercises=db.prepare('SELECT * FROM exercises ORDER BY position').all().filter(x=>lessonIds.has(x.lesson_id)).map(x=>({...x,payload:JSON.parse(x.payload||'{}'),solution:JSON.parse(x.solution||'{}')}));
  const vocab=db.prepare('SELECT v.* FROM vocabulary v JOIN units u ON u.id=v.unit_id JOIN tracks t ON t.slug=u.track WHERE t.active=1 ORDER BY v.id').all();
  const links=db.prepare('SELECT * FROM exercise_vocabulary').all().filter(x=>exercises.some(e=>e.id===x.exercise_id));

  // The final web catalog keeps IDs from an older installation. Preserve that
  // public contract by slug, rather than depending on a private historical DB.
  const ids=(rows,oldRows,kind)=>new Map(rows.map(row=>{
    const old=oldRows.find(item=>item.slug===row.slug);
    assert.ok(old,`No stable ${kind} ID for ${row.slug}. Register new content IDs deliberately before exporting.`);
    return [row.id,old.id];
  }));
  const unitMap=ids(units,previous.units,'unit');
  const lessonMap=ids(lessons,previous.lessons,'lesson');
  const exerciseMap=ids(exercises,previous.exercises,'exercise');
  const vocabMap=new Map();
  for(const unit of units) {
    const current=vocab.filter(v=>v.unit_id===unit.id).sort((a,b)=>a.id-b.id);
    const old=previous.vocab.filter(v=>v.unit_id===unitMap.get(unit.id)).sort((a,b)=>a.id-b.id);
    assert.equal(current.length,old.length,`Vocabulary changed in ${unit.slug}; review stable term IDs before exporting.`);
    current.forEach((term,index)=>vocabMap.set(term.id,old[index].id));
  }
  units.forEach(x=>x.id=unitMap.get(x.id));
  lessons.forEach(x=>{x.id=lessonMap.get(x.id);x.unit_id=unitMap.get(x.unit_id);});
  exercises.forEach(x=>{x.id=exerciseMap.get(x.id);x.lesson_id=lessonMap.get(x.lesson_id);});
  vocab.forEach(x=>{x.id=vocabMap.get(x.id);x.unit_id=unitMap.get(x.unit_id);});
  links.forEach(x=>{x.exercise_id=exerciseMap.get(x.exercise_id);x.vocabulary_id=vocabMap.get(x.vocabulary_id);});

  const cache=new Map();
  for(const ex of exercises.filter(x=>x.payload.editor)) {
    const key=JSON.stringify([ex.payload,ex.solution]);
    if(!cache.has(key)) {
      const result=runReference({language:ex.payload.language,payload:ex.payload,code:ex.solution.value,reference:ex.solution.value});
      if(result.status!==0) throw new Error(result.stderr||result.error?.message||'Python reference execution failed.');
      const execution=JSON.parse(result.stdout);
      if(!execution.correct) throw new Error(ex.slug+': '+JSON.stringify(execution));
      cache.set(key,execution.checks.map(x=>x.expected));
    }
    ex.expected=cache.get(key);
  }
  const catalog={tracks,units,lessons,exercises,vocab,links,achievements:db.prepare('SELECT * FROM achievements').all()};
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(catalog));
  process.env.HABLA_CURRICULUM_OUTPUT=output;
  console.log(JSON.stringify({tracks:tracks.length,lessons:lessons.length,exercises:exercises.length,programs:cache.size,stableIdsPreserved:true,learnerDatabaseRead:false}));
  await import('./refine-curriculum.mjs');
} finally {
  closeDatabase();
  if(savedDatabaseFile===undefined) delete process.env.DATABASE_FILE;
  else process.env.DATABASE_FILE=savedDatabaseFile;
  // Only files inside this freshly created temporary directory are removed.
  for(const suffix of ['', '-wal', '-shm', '-journal']) {
    const file=databaseFile+suffix;
    if(fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmdirSync(temporary);
}
