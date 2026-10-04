// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Preserve the existing untyped D1/catalog adapter; behavioral checks run it against SQLite.
// @ts-nocheck
import catalog from './curriculum.json';
import { env } from 'cloudflare:workers';
import { matchesAccepted, normalizeText, answerDigest } from './normalize.js';
import { participantSummary, PROGRESS_NOTICE_VERSION } from './creator-summary.js';

const lessons = new Map(catalog.lessons.map(x => [x.id,x]));
const exercises = new Map(catalog.exercises.map(x => [x.id,x]));
const units = new Map(catalog.units.map(x => [x.id,x]));
const iso = () => new Date().toISOString();
function fail(status,message,details) { throw Object.assign(new Error(message),{status,details}); }
const canonical = value => JSON.stringify(sortObject(value));
function sortObject(value) {
  if(Array.isArray(value)) return value.map(sortObject);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortObject(value[k])]));
  return value;
}
function database() { if(!env.DB) fail(503,'El guardado no está disponible. Tu código permanece en el navegador.'); return env.DB; }
function isCreator(identity) { return !!identity && typeof env.HABLA_OWNER_USER_ID==='string' && !!env.HABLA_OWNER_USER_ID && identity.id===env.HABLA_OWNER_USER_ID; }
function publicUser(identity,user) { return {...user,isCreator:isCreator(identity),progressSharing:user.progressSharing===true,progressNoticeVersion:user.progressNoticeVersion||null}; }
async function creatorDashboard(identity,url) {
  if(!isCreator(identity)) fail(403,'Este panel es privado y solo puede abrirlo el creador de Habla.');
  const pageText=url.searchParams.get('page')||'1';
  if(!/^\d{1,4}$/.test(pageText)||Number(pageText)<1||Number(pageText)>201) fail(400,'Página no válida.');
  const page=Number(pageText),limit=50,offset=(page-1)*limit,db=database();
  // No SELECT state/data: solo los campos necesarios y un agregado de actividad.
  const visibility="json_extract(CASE WHEN json_valid(l.state) THEN l.state ELSE '{}' END,'$.user.progressSharing')=1 AND json_extract(CASE WHEN json_valid(l.state) THEN l.state ELSE '{}' END,'$.user.progressNoticeVersion')=?";
  const totals=await db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(COALESCE(json_extract(l.state,'$.answered'),0)),0) AS answered,
    COALESCE(SUM(COALESCE(json_extract(l.state,'$.correct'),0)),0) AS correct
    FROM learners l WHERE ${visibility}`).bind(PROGRESS_NOTICE_VERSION).first();
  const rows=await db.prepare(`SELECT l.id,
    json_extract(l.state,'$.user.displayName') AS display_name,
    json_extract(l.state,'$.lessonProgress') AS lesson_progress,
    json_extract(l.state,'$.answered') AS answered,
    json_extract(l.state,'$.correct') AS correct,
    json_extract(l.state,'$.xp') AS xp,
    (SELECT MAX(a.updated_at) FROM attempts a WHERE a.user_id=l.id) AS last_activity_at
    FROM learners l WHERE ${visibility}
    ORDER BY last_activity_at DESC,l.id ASC LIMIT ? OFFSET ?`)
    .bind(PROGRESS_NOTICE_VERSION,limit,offset).all();
  return {participants:rows.results.map(row=>participantSummary(row,catalog,identity.id)),
    total:Number(totals.total),page,pageSize:limit,hasNext:offset+rows.results.length<Number(totals.total),
    accuracy:Number(totals.answered)?Math.round(Number(totals.correct)/Number(totals.answered)*100):null,
    answered:Number(totals.answered),generatedAt:iso()};
}
function blank(identity) { return {
  user:{id:identity.id,email:identity.email,displayName:identity.name.slice(0,40),isGuest:false,
    activeTrack:'sql',timezone:'Europe/Madrid',dailyGoal:1,soundEnabled:false,onboardingDone:false},
  lessonProgress:{},reviews:{},vocabulary:{},daily:{},achievements:{},xp:0,answered:0,correct:0,
}; }
const record = value => !!value && typeof value==='object' && !Array.isArray(value);
const count = value => Number.isFinite(value) && value>=0 ? value : 0;
// Read old or partially damaged profiles without discarding recoverable data.
// Invalid fields are kept inside the same private record before a future write.
function safeState(raw,identity) {
  const base=blank(identity),s={...base,...raw};
  const preserve=(key,value)=>{s._preservedProgress={...(record(s._preservedProgress)?s._preservedProgress:{}),[key]:value};};
  s.user={...base.user,...(record(raw.user)?raw.user:{})};
  if(!record(raw.user)&&raw.user!==undefined) preserve('user',raw.user);
  s.user.id=identity.id;s.user.email=identity.email;
  if(typeof s.user.displayName!=='string') s.user.displayName=base.user.displayName;
  if(!catalog.tracks.some(t=>t.slug===s.user.activeTrack)) s.user.activeTrack='sql';
  if(![1,2,3].includes(s.user.dailyGoal)) s.user.dailyGoal=1;
  try {new Intl.DateTimeFormat('es',{timeZone:s.user.timezone}).format();} catch {s.user.timezone='Europe/Madrid';}
  for(const key of ['lessonProgress','reviews','vocabulary','daily','achievements']) {
    s[key]=record(raw[key])?{...raw[key]}:{};
    if(raw[key]!==undefined&&!record(raw[key])) preserve(key,raw[key]);
  }
  for(const [id,p] of Object.entries(s.lessonProgress)) {
    if(!record(p)) {preserve('lessonProgress.'+id,p);s.lessonProgress[id]={};continue;}
    for(const key of ['bestCorrect','attempts','xpEarned']) if(p[key]!==undefined&&count(p[key])!==p[key]) preserve('lessonProgress.'+id+'.'+key,p[key]);
    s.lessonProgress[id]={...p,bestCorrect:count(p.bestCorrect),attempts:count(p.attempts),xpEarned:count(p.xpEarned)};
  }
  for(const [d,p] of Object.entries(s.daily)) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||!record(p)||!Array.isArray(p.lessons)) {
      preserve('daily.'+d,p);delete s.daily[d];
    } else {if(p.xp!==undefined&&count(p.xp)!==p.xp)preserve('daily.'+d+'.xp',p.xp);s.daily[d]={...p,lessons:[...p.lessons],xp:count(p.xp)};}
  }
  for(const key of ['reviews','vocabulary']) for(const [id,p] of Object.entries(s[key])) {
    if(!record(p)||(key==='reviews'&&!exercises.has(Number(id)))) {preserve(key+'.'+id,p);delete s[key][id];}
  }
  for(const key of ['xp','answered','correct']) {s[key]=count(raw[key]);if(raw[key]!==undefined&&s[key]!==raw[key]) preserve(key,raw[key]);}
  return s;
}
async function learner(identity) {
  const db=database();
  await db.prepare('INSERT OR IGNORE INTO learners(id,state,updated_at) VALUES(?,?,?)').bind(identity.id,JSON.stringify(blank(identity)),iso()).run();
  const row=await db.prepare('SELECT state,revision FROM learners WHERE id=?').bind(identity.id).first();
  let raw;try {raw=JSON.parse(row.state);} catch { /* keep the original row untouched */ }
  if(!record(raw)) return {state:blank(identity),revision:row.revision,canSave:false};
  return {state:safeState(raw,identity),revision:row.revision,canSave:true};
}
async function openAttempts(userId) {
  const data=await database().prepare("SELECT data FROM attempts WHERE user_id=? AND status='in_progress' ORDER BY id DESC").bind(userId).all();
  return data.results.flatMap(x=>{try {const a=JSON.parse(x.data);return record(a)&&Array.isArray(a.exerciseIds)&&record(a.answers)&&record(a.drafts)?[a]:[];}catch {return [];}});
}
async function ownedAttempt(userId,id) {
  const row=await database().prepare('SELECT data FROM attempts WHERE id=? AND user_id=?').bind(id,userId).first();
  if(!row) fail(404,'Este intento no existe en tu perfil.');
  return JSON.parse(row.data);
}
// A single D1 batch is atomic. A unique write token gates the attempt update:
// racing devices can neither overwrite newer drafts nor award XP twice.
async function mutate(identity,operation) {
  for(let retry=0;retry<5;retry++) {
    const {state,revision,canSave}=await learner(identity);
    if(!canSave) fail(503,'No se puede leer el progreso guardado. El registro original se conserva; puedes practicar sin guardar.');
    const change=await operation(state);
    if(change.readOnly) return change.response;
    const token=crypto.randomUUID(), now=iso(), db=database();
    const statements=[db.prepare('UPDATE learners SET state=?,revision=revision+1,write_token=?,updated_at=? WHERE id=? AND revision=?')
      .bind(JSON.stringify(state),token,now,identity.id,revision)];
    if(change.attempt) {
      const a=change.attempt;
      statements.push(db.prepare(`INSERT INTO attempts(id,user_id,lesson_id,status,data,updated_at)
        SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM learners WHERE id=? AND write_token=?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=excluded.updated_at WHERE attempts.user_id=excluded.user_id`)
        .bind(a.id,identity.id,a.lessonId,a.status,JSON.stringify(a),now,identity.id,token));
    }
    const result=await db.batch(statements);
    if(result[0].meta.changes===1) return change.response;
  }
  fail(409,'Hay otro dispositivo guardando avances. Inténtalo de nuevo: tu respuesta no se ha perdido.');
}
function lessonExercises(id) { return catalog.exercises.filter(x=>x.lesson_id===id).sort((a,b)=>a.position-b.position); }
function accessible(s,id) {
  const l=lessons.get(id); if(!l) fail(404,'No existe esta lección.');
  return l;
}
function publicTrack(t,s) { return {slug:t.slug,title:t.title,subtitle:t.subtitle,description:t.description,
  contentLang:t.content_lang,speech:!!t.speech,termLabel:t.term_label,meaningLabel:t.meaning_label,color:t.color,icon:t.icon,
  lessons:catalog.lessons.filter(l=>l.track===t.slug).length,
  completed:catalog.lessons.filter(l=>l.track===t.slug && s.lessonProgress[l.id]?.status==='completed').length}; }
function course(s,track,open) {
  const t=catalog.tracks.find(x=>x.slug===track); if(!t) fail(400,'Elige Python o SQL.');
  const flat=catalog.lessons.filter(x=>x.track===track).sort((a,b)=>a.track_order-b.track_order).map(l=>{
    const p=s.lessonProgress[l.id]||{}, a=open.find(x=>x.lessonId===l.id);
    const status=p.status==='completed'?'completed':'available';
    return {id:l.id,slug:l.slug,title:l.title,position:l.position,trackOrder:l.track_order,
      exerciseCount:lessonExercises(l.id).length,xpReward:l.xp_reward,passThreshold:l.pass_threshold,status,
      bestCorrect:p.bestCorrect||0,attempts:p.attempts||0,xpEarned:p.xpEarned||0,
      inProgress:a?{id:a.id,total_count:a.exerciseIds.length,answered:Object.keys(a.answers).length}:null};
  });
  const out=catalog.units.filter(u=>u.track===track).sort((a,b)=>a.track_position-b.track_position).map(u=>{
    const ls=flat.filter(l=>lessons.get(l.id).unit_id===u.id);
    return {id:u.id,slug:u.slug,track:u.track,position:u.track_position,title:u.title,subtitle:u.subtitle,
      description:u.description,color:u.color,icon:u.icon,lessons:ls,completedLessons:ls.filter(l=>l.status==='completed').length};
  });
  const next=flat.find(l=>l.status!=='completed')||null;
  const resume=flat.filter(l=>l.inProgress).sort((a,b)=>b.inProgress.id-a.inProgress.id)[0]||null;
  return {track:publicTrack(t,s),units:out,totals:{lessons:flat.length,completed:flat.filter(l=>l.status==='completed').length},nextLesson:next,resumeLesson:resume};
}
function lessonIntro(l) { const u=units.get(l.unit_id),t=catalog.tracks.find(x=>x.slug===l.track); return {
  id:l.id,slug:l.slug,title:l.title,position:l.position,trackOrder:l.track_order,
  track:{slug:t.slug,title:t.title,contentLang:t.content_lang,speech:!!t.speech},unit:{slug:u.slug,title:u.title,color:u.color},
  intro:{title:l.intro_title,body:l.intro_body,points:JSON.parse(l.intro_points||'[]')},
  exerciseCount:lessonExercises(l.id).length,xpReward:l.xp_reward,passThreshold:l.pass_threshold,
  navigation:{previous:catalog.lessons.find(x=>x.track===l.track&&x.track_order===l.track_order-1)?.id??null,
    next:catalog.lessons.find(x=>x.track===l.track&&x.track_order===l.track_order+1)?.id??null},
}; }
function correctText(e) { return e.type==='match_pairs'?Object.entries(e.solution.pairs||{}).map(([l,r])=>`${l} = ${r}`).join(' · '):String(e.solution.value||''); }
function shufflePayload(e) {
  const payload={...e.payload}; let seed=e.id;
  for(const key of ['options','bank','tokens','right']) if(Array.isArray(payload[key])) {
    payload[key]=[...payload[key]];
    for(let i=payload[key].length-1;i>0;i--) { seed=(seed*1664525+1013904223)>>>0; const j=seed%(i+1); [payload[key][i],payload[key][j]]=[payload[key][j],payload[key][i]]; }
  }
  return payload;
}
function describe(a) {
  const l=lessons.get(a.lessonId), lesson=l?{id:l.id,slug:l.slug,title:l.title,passThreshold:l.pass_threshold,xpReward:l.xp_reward}:null;
  const es=a.exerciseIds.map((id,index)=>{ const e=exercises.get(id),answer=a.answers[id],draft=a.drafts[id]; return {
    id:e.id,slug:e.slug,type:e.type,prompt:e.prompt,question:e.question,hint:e.hint,payload:shufflePayload(e),
    audioText:e.audio_text,answered:!!answer,index,result:answer?answerView(e,answer):undefined,
    draft:answer?undefined:draft?.code??null,draftUpdatedAt:answer?undefined:draft?.at??null,
  }; });
  const first=es.findIndex(e=>!e.answered);
  const out={id:a.id,kind:a.kind,status:a.status,lesson,total:es.length,answered:Object.keys(a.answers).length,
    correctSoFar:Object.values(a.answers).filter(x=>x.correct).length,cursor:first<0?es.length-1:first,
    startedAt:a.startedAt,completedAt:a.completedAt||null,exercises:es};
  if(a.status==='completed') out.result={correct:a.correct,total:es.length,percent:Math.round(a.correct/es.length*100),
    passed:a.passed,xpAwarded:a.xpAwarded,passThreshold:lesson?.passThreshold??null,kind:a.kind,completedAt:a.completedAt,
    review:es.map(e=>({exerciseId:e.id,slug:e.slug,type:e.type,prompt:e.prompt,question:e.question,
      correct:e.result.correct,yourAnswer:e.result.yourAnswer,correctAnswer:e.result.correctAnswer,explanation:e.result.explanation}))};
  return out;
}
function answerView(e,row) { return {correct:row.correct,yourAnswer:row.answer,correctAnswer:correctText(e),explanation:e.explanation,
  answeredAt:row.at,spoken:e.audio_text,perPair:row.perPair,execution:row.execution}; }
function codeExercise(a,id) {
  if(a.status!=='in_progress'||a.answers[id]) fail(409,'Esta respuesta ya está guardada. Repite la lección para volver a probar.');
  if(!a.exerciseIds.includes(id)) fail(400,'El ejercicio no pertenece al intento.');
  const e=exercises.get(id); if(!e?.payload.editor) fail(400,'Este ejercicio no tiene editor.'); return e;
}
function validateCode(code) { if(typeof code!=='string'||code.length>8000) fail(400,'El código debe tener como máximo 8000 caracteres.'); }
function reportedExecution(e,reported) {
  const incoming=reported?.checks;
  if(!Array.isArray(incoming)||incoming.length!==e.payload.cases.length) fail(400,'Ejecuta las pruebas de tu código antes de comprobarlo.');
  const checks=e.payload.cases.map((c,i)=>{
    const actual=incoming[i]?.actual,expected=e.expected[i],error=incoming[i]?.error;
    let passed=false;
    if(!error && actual) {
      if(e.payload.language==='python') passed=canonical(actual.value)===canonical(expected.value);
      else if(Array.isArray(actual.columns)&&Array.isArray(actual.rows)) {
        const rows=x=>e.payload.ordered?x:[...x].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
        passed=canonical(actual.columns)===canonical(expected.columns)&&canonical(rows(actual.rows))===canonical(rows(expected.rows));
      }
    }
    return {name:c.name,passed,expected,actual,error:error?String(error).slice(0,300):undefined};
  });
  return {correct:checks.every(x=>x.passed),checks,output:checks.at(-1)?.actual};
}
function grade(e,answer,reported) {
  if(e.payload.editor) { validateCode(answer); const execution=reportedExecution(e,reported); return {correct:execution.correct,answer,execution}; }
  const exact=x=>String(x).trim().toLowerCase();
  if(e.type==='choose_translation'||e.type==='listen_choose') {
    if(typeof answer!=='string'||!e.payload.options.some(x=>exact(x)===exact(answer))) fail(400,'Selecciona una opción del ejercicio.');
    return {correct:exact(answer)===exact(e.solution.value),answer};
  }
  if(e.type==='fill_blank') {
    if(typeof answer!=='string'||answer.length>8000) fail(400,'Escribe una respuesta válida.');
    const accepted=[e.solution.value,...(e.solution.accepted||[])];
    if(e.payload.bank?.length && !e.payload.bank.some(x=>exact(x)===exact(answer))) fail(400,'Selecciona una opción disponible.');
    return {correct:e.payload.bank?.length?accepted.some(x=>exact(x)===exact(answer)):matchesAccepted(answer,accepted).correct,answer};
  }
  if(e.type==='word_order') {
    const tokens=Array.isArray(answer)?answer:typeof answer==='string'?answer.split(/\s+/):null;
    if(!tokens) fail(400,'Ordena las palabras del ejercicio.');
    const remaining=[...e.payload.tokens];
    for(const token of tokens) { const index=remaining.findIndex(x=>normalizeText(x)===normalizeText(token)); if(index<0) fail(400,'Utiliza solo las palabras del ejercicio.'); remaining.splice(index,1); }
    return {correct:matchesAccepted(tokens.join(' '),[e.solution.value,...(e.solution.accepted||[])]).correct,answer:tokens};
  }
  if(e.type==='match_pairs') {
    if(!answer||typeof answer!=='object'||Array.isArray(answer)||Object.keys(answer).length!==e.payload.left.length) fail(400,'Relaciona todos los conceptos.');
    const perPair={}; for(const left of e.payload.left) {
      const entry=Object.entries(answer).find(([k])=>normalizeText(k)===normalizeText(left));
      if(!entry||!e.payload.right.some(x=>normalizeText(x)===normalizeText(entry[1]))) fail(400,'Usa los conceptos disponibles.');
      perPair[left]=normalizeText(entry[1])===normalizeText(e.solution.pairs[left]);
    }
    return {correct:Object.values(perPair).every(Boolean),answer,perPair};
  }
  fail(400,'Tipo de ejercicio desconocido.');
}
function day(s,at=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:s.user.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at); }
function shifted(d,n) { const date=new Date(d+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+n); return date.toISOString().slice(0,10); }
function summary(s) {
  const today=day(s),allDays=Object.keys(s.daily).filter(d=>s.daily[d].lessons.length).sort();
  let longest=0,count=0,last=null;
  for(const d of allDays) { count=last&&shifted(last,1)===d?count+1:1; longest=Math.max(longest,count); last=d; }
  const current=last && (last===today||last===shifted(today,-1))?count:0;
  const daily=d=>({day:d,label:new Intl.DateTimeFormat('es',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')),
    lessons:s.daily[d]?.lessons.length||0,xp:s.daily[d]?.xp||0,goalMet:(s.daily[d]?.lessons.length||0)>=s.user.dailyGoal});
  const pending=Object.keys(s.reviews).filter(id=>!s.reviews[id].resolved);
  return {xp:s.xp,lessonsPassed:catalog.lessons.filter(l=>s.lessonProgress[l.id]?.status==='completed').length,lessonsTotal:catalog.lessons.length,
    currentStreak:current,longestStreak:longest,lastActiveDay:last,today:{...daily(today),timezone:s.user.timezone,goal:s.user.dailyGoal},
    week:Array.from({length:7},(_,i)=>daily(shifted(today,i-6))),
    achievements:catalog.achievements.map(a=>({...a,earned:!!s.achievements[a.code],earnedAt:s.achievements[a.code]||null})),
    tracks:catalog.tracks.map(t=>({...publicTrack(t,s),pendingReviews:pending.filter(id=>lessons.get(exercises.get(Number(id)).lesson_id).track===t.slug).length})),
    pendingReviews:pending.length,vocabulary:{learned:catalog.vocab.filter(v=>s.vocabulary[v.id]).length,total:catalog.vocab.length},
    accuracy:{answered:s.answered,correct:s.correct,percent:s.answered?Math.round(s.correct/s.answered*100):0}};
}
function vocabulary(s,query) {
  const search=(query.get('search')||'').toLowerCase(),track=query.get('track'),unit=query.get('unit');
  const words=catalog.vocab.filter(v=>s.vocabulary[v.id]).map(v=>{ const u=units.get(v.unit_id),p=s.vocabulary[v.id]; return {
    id:v.id,es:v.term_es,en:v.term_en,exampleEs:v.example_es,exampleEn:v.example_en,partOfSpeech:v.part_of_speech,
    track:u.track,unit:{slug:u.slug,title:u.title},timesSeen:p.count,firstSeenAt:p.first,lastSeenAt:p.last};
  }).filter(v=>(!track||v.track===track)&&(!unit||v.unit.slug===unit)&&(!search||(v.es+' '+v.en).toLowerCase().includes(search)));
  const us=catalog.units.filter(u=>(!track||u.track===track)&&catalog.vocab.some(v=>v.unit_id===u.id&&s.vocabulary[v.id])).map(u=>({slug:u.slug,title:u.title,position:u.track_position}));
  return {words,units:us,total:words.length};
}
function updateUser(s,body) {
  if(['id','email','isCreator','isAdmin','role','userId'].some(key=>body[key]!==undefined)) fail(403,'No puedes cambiar la identidad ni los permisos desde tu perfil.');
  if(body.progressNoticeVersion!==undefined) {
    if(body.progressNoticeVersion!==PROGRESS_NOTICE_VERSION||typeof body.progressSharing!=='boolean') fail(400,'Selecciona si quieres compartir tu resumen de progreso.');
    s.user.progressNoticeVersion=PROGRESS_NOTICE_VERSION;s.user.progressSharing=body.progressSharing;s.user.progressNoticeSeenAt=iso();
  } else if(body.progressSharing!==undefined) fail(400,'Lee el aviso de progreso antes de cambiar esta elección.');
  if(body.displayName!==undefined) { if(typeof body.displayName!=='string'||!body.displayName.trim()||body.displayName.length>40) fail(400,'Escribe un nombre de 1 a 40 caracteres.'); s.user.displayName=body.displayName.trim(); }
  if(body.activeTrack!==undefined) { if(!catalog.tracks.some(t=>t.slug===body.activeTrack)) fail(400,'Elige Python o SQL.'); s.user.activeTrack=body.activeTrack; }
  if(body.dailyGoal!==undefined) { if(![1,2,3].includes(body.dailyGoal)) fail(400,'Elige un objetivo de 1, 2 o 3 lecciones.'); s.user.dailyGoal=body.dailyGoal; }
  if(body.timezone!==undefined) { try { new Intl.DateTimeFormat('es',{timeZone:body.timezone}).format(); } catch { fail(400,'Zona horaria no válida.'); } s.user.timezone=body.timezone; }
  for(const key of ['onboardingDone','soundEnabled']) if(body[key]!==undefined) { if(typeof body[key]!=='boolean') fail(400,'Preferencia no válida.'); s.user[key]=body[key]; }
}
async function dispatch(request,identity,path,body) {
  const method=request.method,url=new URL(request.url);
  if(path==='health') return {status:'ok',courses:2,lessons:72,exercises:576};
  if(!identity) fail(401,'Entra con ChatGPT para cargar tu progreso.');
  if(path==='admin/learners') {
    if(!isCreator(identity)) fail(403,'Este panel es privado y solo puede abrirlo el creador de Habla.');
    if(method!=='GET') fail(405,'Este panel es solo de consulta.');
    return creatorDashboard(identity,url);
  }
  // Course material and correction do not depend on a readable/writable profile.
  // This explicit no-save practice path never updates attempts, scores or XP.
  const material=path.match(/^lessons\/(\d+)(?:\/(preview|check)(?:\/(\d+))?)?$/);
  if(material) {
    const id=Number(material[1]),l=accessible(null,id),action=material[2];
    if(!action&&method==='GET') return {lesson:lessonIntro(l)};
    if(action==='preview'&&method==='GET') {
      const es=lessonExercises(id),a={id:Date.now()*1000+crypto.getRandomValues(new Uint16Array(1))[0]%1000,lessonId:id,kind:'lesson',status:'in_progress',exerciseIds:es.map(e=>e.id),answers:{},drafts:{},startedAt:iso()};
      return {attempt:{...describe(a),temporary:true},jobs:Object.fromEntries(es.filter(e=>e.payload.editor).map(e=>[e.id,{language:e.payload.language,payload:e.payload,expected:e.expected}]))};
    }
    if(action==='check'&&method==='POST') {
      const e=exercises.get(Number(material[3]));if(!e||e.lesson_id!==id) fail(400,'El ejercicio no pertenece a esta lección.');
      return {...answerView(e,{...grade(e,body.answer,body.execution),at:iso()}),temporary:true};
    }
    fail(405,'Operación no permitida.');
  }
  let s,unavailable=false;
  try {const stored=await learner(identity);s=stored.state;unavailable=!stored.canSave;}
  catch(error) {if(method!=='GET') throw error;console.error('Habla progress unavailable',error.message);s=blank(identity);unavailable=true;}
  s.user.email=identity.email;
  if(unavailable) s.user.progressUnavailable=true;
  if(path==='me'&&method==='GET') return {user:publicUser(identity,s.user)};
  if(path==='me'&&method==='PATCH') return mutate(identity,state=>{updateUser(state,body);return {response:{user:publicUser(identity,state.user)}};});
  if(path==='tracks'&&method==='GET') return {tracks:catalog.tracks.map(t=>publicTrack(t,s))};
  if(path==='units'&&method==='GET') {
    let open=[];try {if(!unavailable) open=await openAttempts(identity.id);} catch {unavailable=true;}
    return {...course(s,url.searchParams.get('track')||s.user.activeTrack,open),progressUnavailable:unavailable};
  }
  if(path==='progress'&&method==='GET') return {...summary(s),progressUnavailable:unavailable};
  if(path==='vocabulary'&&method==='GET') return vocabulary(s,url.searchParams);
  if(path==='attempts'&&method==='POST') return mutate(identity,async state=>{
    const kind=body.kind==='practice'?'practice':'lesson',lessonId=kind==='lesson'?Number(body.lessonId):null;
    if(kind==='lesson') accessible(state,lessonId);
    const open=await openAttempts(identity.id), existing=open.find(a=>a.kind===kind&&(kind==='practice'||a.lessonId===lessonId));
    if(existing) return {readOnly:true,response:{attempt:describe(existing),resumed:true}};
    let ids,source;
    if(kind==='lesson') ids=lessonExercises(lessonId).map(x=>x.id);
    else {
      ids=Object.keys(state.reviews).filter(id=>!state.reviews[id].resolved).map(Number).filter(id=>!body.track||lessons.get(exercises.get(id).lesson_id).track===body.track).slice(0,8);
      source=ids.length?'mistakes':'review';
      if(!ids.length) ids=catalog.exercises.filter(e=>state.lessonProgress[e.lesson_id]&&(!body.track||lessons.get(e.lesson_id).track===body.track)).sort(()=>Math.random()-.5).slice(0,8).map(e=>e.id);
      if(!ids.length) fail(409,'Completa tu primera lección para empezar el repaso.',{reason:'no_practice_content'});
    }
    if(open.length>=80) fail(429,'Termina uno de tus intentos pendientes antes de abrir otro.');
    const a={id:Date.now()*1000+crypto.getRandomValues(new Uint16Array(1))[0]%1000,lessonId,kind,status:'in_progress',exerciseIds:ids,answers:{},drafts:{},startedAt:iso()};
    return {attempt:a,response:{attempt:describe(a),resumed:false,practiceSource:source}};
  });
  const match=path.match(/^attempts\/(\d+)(?:\/(answers|drafts|run)\/(\d+)|\/(complete))?$/);
  if(match) {
    const id=Number(match[1]),action=match[2]||match[4],exerciseId=Number(match[3]);
    if(!action&&method==='GET') return {attempt:describe(await ownedAttempt(identity.id,id))};
    if(!((action==='answers'||action==='drafts')&&method==='PUT'||(action==='run'||action==='complete')&&method==='POST')) fail(405,'Operación no permitida.');
    return mutate(identity,async state=>{
      const a=await ownedAttempt(identity.id,id);
      if(action==='drafts'||action==='run') {
        const e=codeExercise(a,exerciseId); validateCode(body.code); a.drafts[exerciseId]={code:body.code,at:iso()};
        return {attempt:a,response:action==='drafts'?{saved:true}:{job:{language:e.payload.language,payload:e.payload,expected:e.expected}}};
      }
      if(action==='answers') {
        if(!a.exerciseIds.includes(exerciseId)) fail(400,'Este ejercicio no pertenece a tu intento.');
        const e=exercises.get(exerciseId),old=a.answers[exerciseId];
        const digest=e.payload.editor?'code:'+body.answer:answerDigest(body.answer);
        if(old) { if(old.digest!==digest) fail(409,'Esta respuesta ya está guardada. Inicia otra ronda para cambiarla.'); return {readOnly:true,response:{...answerView(e,old),repeated:true}}; }
        if(a.status!=='in_progress') fail(409,'El intento ya está terminado.');
        const graded=grade(e,body.answer,body.execution),now=iso(),answer={...graded,digest,at:now};
        if(JSON.stringify(answer).length>120000) fail(400,'El resultado es demasiado grande.');
        a.answers[exerciseId]=answer; delete a.drafts[exerciseId];
        state.answered++; if(graded.correct) state.correct++;
        if(graded.correct) { if(state.reviews[exerciseId]) state.reviews[exerciseId].resolved=true; }
        else state.reviews[exerciseId]={misses:(state.reviews[exerciseId]?.misses||0)+1,resolved:false};
        for(const link of catalog.links.filter(x=>x.exercise_id===exerciseId)) {
          const v=state.vocabulary[link.vocabulary_id]||{count:0,first:now}; v.count++;v.last=now;state.vocabulary[link.vocabulary_id]=v;
        }
        return {attempt:a,response:{...answerView(e,answer),repeated:false,progress:{answered:Object.keys(a.answers).length,total:a.exerciseIds.length,correctSoFar:Object.values(a.answers).filter(x=>x.correct).length}}};
      }
      if(action==='complete') {
        if(a.status==='completed') return {readOnly:true,response:{result:describe(a).result,alreadyCompleted:true,newAchievements:[]}};
        const missing=a.exerciseIds.filter(id=>!a.answers[id]); if(missing.length) fail(400,'Responde a todos los ejercicios antes de terminar.',{missingExerciseIds:missing});
        a.correct=Object.values(a.answers).filter(x=>x.correct).length;a.passed=false;a.xpAwarded=0;a.completedAt=iso();a.status='completed';
        const earned=[];
        if(a.kind==='lesson') {
          const l=lessons.get(a.lessonId),p=state.lessonProgress[l.id]||{status:'available',bestCorrect:0,attempts:0,xpEarned:0};
          a.passed=a.correct>=l.pass_threshold;a.xpAwarded=a.passed&&!p.xpEarned?l.xp_reward:0;
          p.status=p.status==='completed'||a.passed?'completed':'available';p.bestCorrect=Math.max(p.bestCorrect,a.correct);p.attempts++;p.xpEarned+=a.xpAwarded;
          state.lessonProgress[l.id]=p;state.xp+=a.xpAwarded;
          if(a.passed) { const d=day(state),daily=state.daily[d]||{lessons:[],xp:0}; if(!daily.lessons.includes(l.id)) daily.lessons.push(l.id);daily.xp+=a.xpAwarded;state.daily[d]=daily; }
          const stats=summary(state),codes=[];
          if(stats.lessonsPassed>=1) codes.push('first_lesson');if(stats.lessonsPassed>=5) codes.push('five_lessons');if(stats.longestStreak>=3) codes.push('streak_3');
          for(const code of codes) if(!state.achievements[code]) {state.achievements[code]=a.completedAt;earned.push(code);}
        }
        return {attempt:a,response:{result:describe(a).result,alreadyCompleted:false,newAchievements:earned}};
      }
    });
  }
  fail(404,'No existe esta operación.');
}
export async function handle(request) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try {
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/v1\//,'');
    let body={};
    if(!['GET','HEAD'].includes(request.method)) {
      const origin=request.headers.get('origin');
      if(!origin||![url.origin,'https://habla-python-sql.fernandino.chatgpt.site'].includes(origin)||request.headers.get('sec-fetch-site')==='cross-site') fail(403,'Petición de otro sitio rechazada.');
      const text=await request.text();if(text.length>150000) fail(413,'La respuesta es demasiado grande.');
      if(text&&!request.headers.get('content-type')?.includes('application/json')) fail(400,'Formato de petición no válido.');
      try {body=text?JSON.parse(text):{};} catch {fail(400,'No se puede leer la respuesta.');}
      if(!body||typeof body!=='object'||Array.isArray(body)) fail(400,'Petición no válida.');
    }
    const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
    let name=email?.split('@')[0]||'Estudiante';
    if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8') {
      try { name=decodeURIComponent(request.headers.get('oai-authenticated-user-full-name')||name); } catch { /* opcional */ }
    }
    const data=await dispatch(request,id&&email?{id,email,name}:null,path,body);
    return new Response(JSON.stringify(data),{headers});
  } catch(error) {
    const status=error.status||503;if(status>=500) console.error('Habla storage request failed',error.message);
    return new Response(JSON.stringify({error:{code:'habla_'+status,message:status>=500?'No se pudo cargar o guardar el progreso. Tu código no se ha borrado; vuelve a intentarlo.':error.message,details:error.details}}),{status,headers});
  }
}
