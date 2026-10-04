const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,base,launchOptions,prepareLearner}=require('./qa-browser.cjs');
const catalog=JSON.parse(fs.readFileSync('app/curriculum.json','utf8'));
const lastLesson=track=>catalog.lessons.filter(l=>l.track===track).sort((a,b)=>b.track_order-a.track_order)[0];
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
async function contrast(page) {
  return page.evaluate(()=>{
    const rgba=s=>(s.match(/[\d.]+/g)||[]).map(Number),blend=(top,bottom)=>{const a=top[3]??1;return [0,1,2].map(i=>top[i]*a+bottom[i]*(1-a));};
    const luminance=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
    const failures=[];
    for(const e of document.querySelectorAll('body *')) {
      if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||e.closest('[aria-hidden=true],.sr-only')||e.matches(':disabled')||!e.getClientRects().length)continue;
      const rect=e.getBoundingClientRect();if(rect.width===0||rect.height===0||rect.right<0)continue;
      const styles=getComputedStyle(e);if(styles.visibility==='hidden')continue;
      let bg=[255,255,255];const parents=[];for(let p=e;p;p=p.parentElement)parents.unshift(p);
      for(const p of parents)bg=blend(rgba(getComputedStyle(p).backgroundColor),bg);
      const fg=blend(rgba(styles.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const large=parseFloat(styles.fontSize)>=24||(parseFloat(styles.fontSize)>=18.66&&parseInt(styles.fontWeight)>=600),min=large?3:4.5;
      if(ratio+0.02<min)failures.push({text:e.textContent.trim().slice(0,80),class:e.className,color:styles.color,bg,ratio:Math.round(ratio*100)/100,min});
    }
    return failures;
  });
}
(async()=>{
  const browser=await chromium.launch(launchOptions),context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addCookies([{name:'__sites_local_auth',value:'1',url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync('work/screenshots',{recursive:true});
  try {
    await prepareLearner(page);
    const before=await (await context.request.get(base+'/api/v1/progress')).json();
    const contrastFailures=[];
    for(const width of [320,390,768,1280,1920]) {
      await page.setViewportSize({width,height:900});assert.equal(await overflow(page),false,'Course overflow '+width);
      contrastFailures.push(...await contrast(page));
      const links=page.locator('a[data-lesson-id]');assert.equal(await links.count(),36);
      assert.equal(await page.locator('a[data-lesson-id][aria-disabled=true],button.lesson-node:disabled').count(),0);
      if(width===1280||width===390)await page.screenshot({path:`work/screenshots/studio-learn-${width}.png`,fullPage:false});
    }
    for(const track of ['sql','python']) {
      await page.getByRole('button',{name:new RegExp(track==='sql'?'SQL':'Python')}).click();
      await page.locator(`a[data-lesson-id="${lastLesson(track).id}"]`).waitFor();
      const href=await page.locator(`a[data-lesson-id="${lastLesson(track).id}"]`).getAttribute('href');assert.equal(href,'/lesson/'+lastLesson(track).id);
      await page.keyboard.press('Tab');await page.locator(`a[data-lesson-id="${lastLesson(track).id}"]`).focus();
      const focus=await page.locator(`a[data-lesson-id="${lastLesson(track).id}"]`).evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth)}));assert.notEqual(focus.style,'none');assert.ok(focus.width>=2);
      await page.keyboard.press('Enter');await page.getByRole('heading',{name:lastLesson(track).title,exact:true,level:1}).waitFor();
      assert.ok(await page.getByRole('link',{name:'Anterior',exact:false}).count());
      await page.getByRole('link',{name:'Anterior',exact:false}).click();
      await page.waitForURL('**/lesson/'+(lastLesson(track).id-1));
      await page.getByRole('link',{name:'Siguiente',exact:false}).click();await page.waitForURL('**/lesson/'+lastLesson(track).id);
      await page.getByRole('link',{name:'Todas las lecciones',exact:true}).click();await page.getByRole('heading',{name:'Aprende a tu ritmo.'}).waitFor();
    }
    for(const path of ['/admin','/profile','/practice','/words']) {
      await page.goto(base+path);await page.locator('#app').waitFor({state:'visible'});await page.waitForTimeout(300);
      for(const width of [390,768,1280]) {await page.setViewportSize({width,height:900});assert.equal(await overflow(page),false,path+' overflow '+width);contrastFailures.push(...await contrast(page));}
    }
    // Controlled API fixtures: no progress and stale "locked" markers must not
    // disable links. The real backend new-user cases live in check-access.mjs.
    await page.route('**/api/v1/progress',route=>route.fulfill({json:null}));
    await page.route('**/api/v1/units?*',async route=>{const response=await route.fetch(),data=await response.json();data.units.forEach(u=>u.lessons.forEach(l=>l.status='locked'));await route.fulfill({response,json:data});});
    await page.goto(base+'/learn');await page.getByRole('heading',{name:'Aprende a tu ritmo.'}).waitFor();assert.equal(await page.locator('a[data-lesson-id]').count(),36);
    await page.locator('a[data-lesson-id]').last().click();await page.locator('.intro-card').waitFor();
    await page.unroute('**/api/v1/progress');await page.unroute('**/api/v1/units?*');
    // Simulate D1 save failure, then use the actual database-independent grader.
    await page.route('**/api/v1/attempts',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:{message:'Fallo de guardado simulado'}}}):route.continue());
    const lesson=lastLesson('sql'),es=catalog.exercises.filter(e=>e.lesson_id===lesson.id).sort((a,b)=>a.position-b.position);
    await page.goto(base+'/lesson/'+lesson.id);await page.locator('.notice--warning').waitFor();
    await page.getByRole('button',{name:'¡Vamos!',exact:true}).click();
    await page.getByText(es[0].solution.value,{exact:true}).locator('..').focus();await page.keyboard.press('Space');
    await page.getByRole('button',{name:'Comprobar',exact:true}).focus();await page.keyboard.press('Space');
    await page.locator('.feedback--right').waitFor();
    const temporaryId=await page.evaluate(async id=>{const {api}=await import('/js/api.js?v=studio20261003');const a=(await api.practiceWithoutSaving(id)).attempt;window.studioTemporaryId=a.id;return a.id;},lesson.id);
    for(const e of es) {
      const answer=e.type==='match_pairs'?e.solution.pairs:e.type==='word_order'?e.solution.value.split(/\s+/):e.solution.value;
      const result=await page.evaluate(async({id,ex,answer})=>(await import('/js/api.js?v=studio20261003')).api.answer(id,ex,answer),{id:temporaryId,ex:e.id,answer});assert.equal(result.correct,true,e.slug);
    }
    await page.evaluate(id=>import('/js/main.js?v=studio20261003').then(m=>m.navigate('/result/'+id)),temporaryId);
    await page.locator('.result .notice--warning').waitFor();assert.ok((await page.locator('.result').innerText()).includes('sin guardar'));
    await page.getByRole('button',{name:'Siguiente lección',exact:true}).click();await page.waitForURL('**/learn');
    await page.unroute('**/api/v1/attempts');
    // A failed lesson can still navigate forward, with no passing prerequisite.
    const failedLesson=25,failedExercises=catalog.exercises.filter(e=>e.lesson_id===failedLesson).sort((a,b)=>a.position-b.position);
    const failedId=await page.evaluate(async id=>(await (await import('/js/api.js?v=studio20261003')).api.practiceWithoutSaving(id)).attempt.id,failedLesson);
    for(const e of failedExercises) {
      const wrong=e.payload.editor?'SELECT 0 AS incorrect;':e.type==='match_pairs'?Object.fromEntries(e.payload.left.map((left,i)=>[left,e.payload.right[(i+1)%e.payload.right.length]])):
        e.type==='word_order'?[...e.payload.tokens].reverse():e.payload.options?.find(x=>x!==e.solution.value)??e.payload.bank?.find(x=>x!==e.solution.value)??'respuesta incorrecta';
      await page.evaluate(async({id,ex,answer})=>(await import('/js/api.js?v=studio20261003')).api.answer(id,ex,answer),{id:failedId,ex:e.id,answer:wrong});
    }
    await page.evaluate(id=>import('/js/main.js?v=studio20261003').then(m=>m.navigate('/result/'+id)),failedId);
    await page.locator('.result').waitFor();const failedResult=await page.evaluate(async id=>(await (await import('/js/api.js?v=studio20261003')).api.attempt(id)).attempt.result,failedId);assert.equal(failedResult.passed,false);
    await page.getByRole('button',{name:'Siguiente lección',exact:true}).click();await page.waitForURL('**/lesson/26');await page.locator('.intro-card').waitFor();
    // Recover from a write failure halfway through a normal saved attempt.
    await page.route('**/api/v1/attempts/*/answers/*',route=>route.fulfill({status:503,json:{error:{message:'Fallo al guardar la respuesta'}}}));
    await page.goto(base+'/lesson/55');await page.getByRole('button',{name:'¡Vamos!',exact:true}).click();
    const pyFirst=catalog.exercises.find(e=>e.lesson_id===55&&e.position===1);
    await page.getByText(pyFirst.solution.value,{exact:true}).click();await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    await page.getByRole('button',{name:'Seguir practicando sin guardar',exact:true}).click();await page.locator('.feedback--right').waitFor();await page.locator('.notice--warning').waitFor();
    await page.unroute('**/api/v1/attempts/*/answers/*');
    const after=await (await context.request.get(base+'/api/v1/progress')).json();assert.equal(after.xp,before.xp);assert.equal(after.lessonsPassed,before.lessonsPassed);assert.equal(after.accuracy.answered,before.accuracy.answered);
    // Editor keyboard: Tab leaves the field; Ctrl+Enter can execute tests.
    await page.evaluate(async()=>{const {api}=await import('/js/api.js?v=studio20261003'),{store}=await import('/js/store.js?v=studio20261003'),{buildCodeEditor}=await import('/js/views/code-editor.js?v=studio20261003');store.user=(await api.me()).user;const a=(await api.practiceWithoutSaving(55)).attempt;document.querySelector('#view').replaceChildren(buildCodeEditor(a.exercises.find(e=>e.payload.editor),{attemptId:a.id}).node);});
    const editor=page.locator('textarea');await editor.focus();await page.keyboard.press('Tab');assert.equal(await page.locator('textarea:focus').count(),0,'Editor must not trap keyboard focus');
    for(const width of [320,390,768,1280]) {await page.setViewportSize({width,height:900});assert.equal(await overflow(page),false,'Editor overflow '+width);contrastFailures.push(...await contrast(page));}
    await page.screenshot({path:'work/screenshots/studio-editor-1280.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.locator('.code-editor').evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration)<0.01));
    assert.deepEqual(errors,[]);assert.deepEqual(contrastFailures,[],'Text contrast below WCAG AA (computed solid backgrounds)');
    console.log(JSON.stringify({allLessonsLinked:true,keyboardNavigation:true,previousNextWithoutCompletion:true,failedResultCanContinue:true,missingProgressAndStaleLocks:true,noSavePracticeAndCorrection:true,midAttemptSaveFailure:true,progressUnchanged:true,responsiveWidths:[320,390,768,1280,1920],editorNoKeyboardTrap:true,textContrastAA:true,reducedMotion:true,pageErrors:errors}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
