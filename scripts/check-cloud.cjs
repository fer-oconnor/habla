const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium,base,launchOptions,prepareLearner}=require('./qa-browser.cjs');
const catalog=JSON.parse(fs.readFileSync('app/curriculum.json','utf8'));
const answer=e=>e.type==='match_pairs'?e.solution.pairs:e.type==='word_order'?e.solution.value.split(/\s+/):e.solution.value;
(async()=>{
  const browser=await chromium.launch(launchOptions);
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(base);await page.getByRole('link',{name:'Entrar con ChatGPT'}).waitFor();
    await page.getByRole('link',{name:'Entrar con ChatGPT'}).click();
    await prepareLearner(page);
    const before=await page.evaluate(async()=> (await import('/js/api.js?v=studio20261003')).api.progress());
    const tracks=await page.evaluate(async()=>{const {api}=await import('/js/api.js?v=studio20261003');return api.tracks();});
    assert.equal(tracks.tracks.length,2);assert.ok(tracks.tracks.every(t=>t.lessons===36));
    const first=catalog.lessons.filter(l=>l.track==='python').sort((a,b)=>a.track_order-b.track_order)[0];
    let attempt=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');await api.updateMe({activeTrack:'python'});return (await api.startLesson(id)).attempt;},first.id);
    const firstExercises=catalog.exercises.filter(e=>e.lesson_id===first.id).sort((a,b)=>a.position-b.position);
    for(const e of firstExercises.slice(0,3)) await page.evaluate(async ({id,ex,answer})=>{const {api}=await import('/js/api.js?v=studio20261003');await api.answer(id,ex,answer);},{id:attempt.id,ex:e.id,answer:answer(e)});
    await page.goto(base+'/lesson/'+first.id);
    const start=page.getByRole('button',{name:/Empezar lección|Start lesson/});if(await start.count())await start.click();
    const editor=page.locator('textarea.code-editor');await editor.waitFor({timeout:20000});
    const target=firstExercises[3];const draft=target.solution.value+'\n# borrador sincronizado';
    await editor.fill(draft);
    await page.getByText('Guardado · puedes cerrar y volver después.',{exact:true}).waitFor({timeout:10000});
    await page.reload();
    if(await start.count())await start.click();
    await editor.waitFor();assert.equal(await editor.inputValue(),draft);
    await page.getByRole('button',{name:'▶ Ejecutar pruebas'}).click();
    await page.getByText('✓ Todas las pruebas pasan. Pulsa Comprobar para guardar la respuesta.',{exact:true}).waitFor({timeout:100000});
    fs.mkdirSync('work/screenshots',{recursive:true});await page.screenshot({path:'work/screenshots/python-cloud.png',fullPage:true});
    for(const e of firstExercises.slice(3)) {
      const result=await page.evaluate(async({id,ex,answer})=>{const {api}=await import('/js/api.js?v=studio20261003');return api.answer(id,ex,answer);},{id:attempt.id,ex:e.id,answer:answer(e)});
      assert.equal(result.correct,true,e.slug);
    }
    const firstCompletion=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return api.complete(id);},attempt.id);
    assert.equal(firstCompletion.result.xpAwarded,before.tracks.find(t=>t.slug==='python').completed?0:10);
    const repeat=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return api.complete(id);},attempt.id);
    assert.equal(repeat.alreadyCompleted,true);
    const sql=catalog.lessons.filter(l=>l.track==='sql').sort((a,b)=>a.track_order-b.track_order);
    for(const l of sql.slice(0,6)) {
      const a=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return (await api.startLesson(id)).attempt;},l.id);
      for(const e of catalog.exercises.filter(e=>e.lesson_id===l.id)) await page.evaluate(async({id,ex,answer})=>{const {api}=await import('/js/api.js?v=studio20261003');return api.answer(id,ex,answer);},{id:a.id,ex:e.id,answer:answer(e)});
      await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return api.complete(id);},a.id);
    }
    const sqlAttempt=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return (await api.startLesson(id)).attempt;},sql[6].id);
    const sqlEx=catalog.exercises.find(e=>e.lesson_id===sql[6].id&&e.payload.editor);
    const sqlResult=await page.evaluate(async({id,ex,code})=>{const {api}=await import('/js/api.js?v=studio20261003');return api.run(id,ex,code);},{id:sqlAttempt.id,ex:sqlEx.id,code:sqlEx.solution.value});
    assert.equal(sqlResult.correct,true);
    const other=await browser.newContext({storageState:await context.storageState(),viewport:{width:390,height:844}});
    const mobile=await other.newPage();await mobile.goto(base+'/learn');await mobile.getByRole('link',{name:'Perfil',exact:true}).first().waitFor();
    const saved=await mobile.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');return {attempt:(await api.attempt(id)).attempt,progress:await api.progress()};},sqlAttempt.id);
    assert.equal(saved.attempt.id,sqlAttempt.id);assert.ok(saved.progress.lessonsPassed>=7);assert.ok(saved.progress.xp>=70);
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'work/screenshots/mobile-cloud.png',fullPage:true});
    const anonymous=await browser.newContext();const anon=await anonymous.newPage();await anon.goto(base);
    const unauthorized=await anon.request.get(base+'/api/v1/attempts/'+attempt.id);assert.equal(unauthorized.status(),401);
    const crossSite=await context.request.patch(base+'/api/v1/me',{headers:{Origin:'https://example.com'},data:{displayName:'No permitido'}});assert.equal(crossSite.status(),403);
    // Run the actual browser runtime against every distinct model, not text matching.
    const models=[];const seen=new Set();for(const e of catalog.exercises.filter(e=>e.payload.editor)) {const key=JSON.stringify([e.payload,e.solution]);if(!seen.has(key)){seen.add(key);models.push(e);}}
    let checked=0;
    for(const e of models) {
      const result=await page.evaluate(async e=>{const {runCode}=await import('/js/laboratory.js?v=studio20261003');return runCode({language:e.payload.language,payload:e.payload,expected:e.expected},e.solution.value);},e);
      assert.equal(result.correct,true,e.slug+': '+JSON.stringify(result));checked++;
      if(checked%40===0)console.log('Programas verificados: '+checked+'/'+models.length);
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({tracks:2,lessons:72,exercises:576,models:checked,draftReload:true,mobileResume:true,noDuplicateXP:true,anonymousBlocked:true,crossOriginBlocked:true,pageErrors:errors}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
