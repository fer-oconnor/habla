const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium,base,launchOptions,prepareLearner}=require('./qa-browser.cjs');
const catalog = JSON.parse(fs.readFileSync('app/curriculum.json','utf8'));
const editors = catalog.exercises.filter(e => e.payload.editor);
for (const e of editors) {
  assert.ok(e.payload.instructions?.output, e.slug);
  assert.ok(e.payload.instructions?.example, e.slug);
  assert.equal(e.expected.length, e.payload.cases.length);
  if (e.payload.language === 'sql') assert.deepEqual(e.payload.instructions.columns, e.expected[0].columns);
  else assert.deepEqual(e.payload.instructions.inputs.map(x => x.name), Object.keys(e.payload.cases[0].globals));
}
assert.equal(catalog.lessons.length,72);
assert.equal(catalog.exercises.length,576);
assert.ok(catalog.exercises.find(e => e.id===122).payload.bank.every(x => !['==','IS','LIKE'].includes(x)));
assert.ok(!catalog.exercises.find(e => e.id===144).payload.options.some(x => x.includes("city IS 'Madrid'")));

(async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.addCookies([{name:'__sites_local_auth',value:'1',url:base}]);
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e => errors.push(e.message));
  try {
    await prepareLearner(page);
    const before = await page.evaluate(async () => (await import('/js/api.js?v=studio20261003')).api.progress());
    const seen = new Set(); let checked=0;
    for (const e of editors) {
      if (process.argv.includes('--ui-only')) break;
      const key=JSON.stringify([e.payload.language,e.payload.cases,e.solution.value]);
      if (seen.has(key)) continue; seen.add(key);
      const result = await page.evaluate(async e => {
        const {runCode} = await import('/js/laboratory.js?v=studio20261003');
        return runCode({language:e.payload.language,payload:e.payload,expected:e.expected},e.solution.value);
      },e);
      assert.equal(result.correct,true,e.slug+': '+JSON.stringify(result));
      checked++; if(checked%40===0) console.log('Soluciones verificadas: '+checked);
    }
    for (const [id,code,valid] of [
      [436,'resultado = puntos',true],[436,'resultado = 10',false],
      [436,'resultado = "puntos"',false],[436,'Resultado = puntos',false],[436,'print(puntos)',false],
      [204,'select name from products where stock > 0 and price >= 20',true],
      [198,'SELECT name FROM customers;',false],
      [119,'SELECT id, name, age, city, grade FROM students',true],
      [119,'SELECT FROM students',false],
      [228,'SELECT SUM(quantity) AS units FROM orders',true],
      [228,'SELECT COALESCE(SUM(quantity),0) AS units FROM orders',false],
      [424,'SELECT id FROM orders WHERE 0',false],[358,'SELECT name FROM employees WHERE 0',false],
      [380,'SELECT id,SUM(quantity) OVER(ORDER BY ordered_at,id ROWS UNBOUNDED PRECEDING) AS running_units FROM orders ORDER BY ordered_at,id',true],
    ]) {
      const e = catalog.exercises.find(e => e.id===id);
      const result = await page.evaluate(async ({e,code}) => {
        const {runCode} = await import('/js/laboratory.js?v=studio20261003');
        return runCode({language:e.payload.language,payload:e.payload,expected:e.expected},code);
      },{e,code});
      assert.equal(result.correct,valid,'Alternativa '+id+': '+code);
    }
    // Un intento real de práctica local permite verificar el borrador sin conceder XP.
    const attempt = await page.evaluate(async () => (await import('/js/api.js?v=studio20261003')).api.startLesson(55));
    const target = attempt.attempt.exercises.find(e => e.id===436);
    const draft='resultado = puntos\n# guardado tras la revisión';
    await page.evaluate(async ({attemptId,target,draft}) => {
      const {api}=await import('/js/api.js?v=studio20261003');
      await api.draft(attemptId,target.id,draft);
    },{attemptId:attempt.attempt.id,target,draft});
    const mount = async (exercise,attemptId) => page.evaluate(async ({exercise,attemptId}) => {
      const {buildCodeEditor}=await import('/js/views/code-editor.js?v=studio20261003');
      const {store}=await import('/js/store.js?v=studio20261003');
      store.user=(await (await import('/js/api.js?v=studio20261003')).api.me()).user;
      document.querySelector('#view').replaceChildren(buildCodeEditor(exercise,{attemptId}).node);
    },{exercise,attemptId});
    const saved = await page.evaluate(async id => (await import('/js/api.js?v=studio20261003')).api.attempt(id),attempt.attempt.id);
    await mount(saved.attempt.exercises.find(e => e.id===436),attempt.attempt.id);
    await page.getByRole('heading',{name:'Datos que ya tienes'}).waitFor();
    assert.equal(await page.locator('textarea').inputValue(),draft);
    assert.ok((await page.locator('.code-guide').innerText()).includes('resultado debe valer 10'));
    fs.mkdirSync('work/screenshots',{recursive:true});
    await page.screenshot({path:'work/screenshots/python-review.png',fullPage:true});
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#view')?.textContent.includes('SQL'));
    const reloaded = await page.evaluate(async id => (await import('/js/api.js?v=studio20261003')).api.attempt(id),attempt.attempt.id);
    assert.equal(reloaded.attempt.id,attempt.attempt.id);
    assert.equal(reloaded.attempt.exercises.find(e => e.id===436).draft,draft);
    await mount(catalog.exercises.find(e => e.id===288),attempt.attempt.id);
    await page.getByRole('heading',{name:'Tablas del primer caso'}).waitFor();
    assert.ok((await page.locator('.code-guide').innerText()).includes('name, revenue'));
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'work/screenshots/sql-review-mobile.png',fullPage:true});
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) console.log(await page.evaluate(() => [...document.querySelectorAll('#view *')].filter(e => e.getBoundingClientRect().right > innerWidth).slice(0,12).map(e => ({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:'work/screenshots/sql-review-mobile.png',fullPage:true});
    const mobile=await browser.newContext({storageState:await context.storageState(),viewport:{width:390,height:844}});
    const second=await mobile.newPage();await second.goto(base+'/learn');
    const resume=await second.evaluate(async id => (await import('/js/api.js?v=studio20261003')).api.attempt(id),attempt.attempt.id);
    assert.equal(resume.attempt.exercises.find(e => e.id===436).draft,draft);
    const after = await page.evaluate(async () => (await import('/js/api.js?v=studio20261003')).api.progress());
    assert.equal(after.xp,before.xp); assert.equal(after.lessonsPassed,before.lessonsPassed);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({codeExercises:editors.length,distinctSolutions:checked,alternatives:14,draftReload:true,crossDeviceResume:true,progressUnchanged:true,mobileNoOverflow:true,pageErrors:errors}));
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
