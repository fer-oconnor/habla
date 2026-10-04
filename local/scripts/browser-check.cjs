const {chromium} = require(process.env.HABLA_PLAYWRIGHT_PACKAGE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// This flow creates test profiles. Only allow a disposable local server.
const target = new URL(process.env.HABLA_TEST_URL || 'http://127.0.0.1:3100');
assert.ok(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname),
  'HABLA_TEST_URL must point to an HTTP loopback server, never a deployed instance.');
assert.ok(!target.username && !target.password, 'Credentials must not appear in the test URL.');
const baseUrl = target.origin;
const artifacts = process.env.HABLA_BROWSER_ARTIFACTS || path.join(__dirname, '..', 'browser-artifacts');
const launchOptions = { headless: true };
if (process.env.HABLA_BROWSER_CHANNEL) launchOptions.channel = process.env.HABLA_BROWSER_CHANNEL;

(async () => {
  const browser=await chromium.launch(launchOptions);
  try {
  const context=await browser.newContext({viewport:{width:1365,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(baseUrl);
  await page.getByRole('button',{name:'Empezar como invitado',exact:true}).click();
  await page.locator('#ob-name').fill('Prueba del editor');
  await page.getByRole('button',{name:'Empezar a aprender',exact:true}).click();
  await page.getByRole('tab',{name:/Python/}).click();
  await page.getByRole('button',{name:/Lección 1: Tu primer programa/}).click();
  await page.getByRole('button',{name:'¡Vamos!',exact:true}).click();
  await page.getByRole('radio').filter({hasText:'Asigna un valor a un nombre'}).click();
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  for(const [left,right] of [['=','Asigna un valor a un nombre'],['int','Representa un número entero'],['str','Representa texto']]) {
    await page.getByRole('button',{name:left,exact:true}).click();
    await page.getByRole('button',{name:right,exact:true}).click();
  }
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByRole('radio').filter({hasText:/^\w?\s*=$/}).click();
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Escribe tu código Python'});
  await editor.fill('resultado = puntos\n# volveré después');
  await page.getByText('Guardado · puedes cerrar y volver después.',{exact:true}).waitFor();
  await page.reload();
  assert.equal(await editor.inputValue(),'resultado = puntos\n# volveré después');
  await page.getByRole('button',{name:'▶ Ejecutar pruebas',exact:true}).click();
  await page.getByText(/Todas las pruebas pasan/).waitFor();
  fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'python-editor.png'),fullPage:true});
  await page.getByRole('button',{name:'Salir de la lección'}).click({trial:true});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Salir de la lección'}).click();
  await page.getByText(/Retomar: Tu primer programa/).waitFor();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.equal(await editor.inputValue(),'resultado = puntos\n# volveré después');
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await editor.fill('resultado = puntos');
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await editor.fill('resultado = monedas * 2');
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByRole('radio').filter({hasText:'No, distingue mayúsculas'}).click();
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await editor.fill('resultado = nombre');
  await page.getByRole('button',{name:'Comprobar',exact:true}).click();
  await page.getByRole('button',{name:'Ver resultados',exact:true}).click();
  await page.getByRole('heading',{name:'¡Lección superada!'}).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('10 XP'));
  await page.screenshot({path:path.join(artifacts,'result.png'),fullPage:true});
  await page.goto(`${baseUrl}/profile`);
  await page.getByRole('link',{name:'Crear cuenta conservando mi progreso'}).waitFor();
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseUrl}/learn`);
  await page.getByRole('tab',{name:/Python/}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
  await page.setViewportSize({width:1365,height:1000});
  // Recorre las lecciones SQL existentes y abre el primer laboratorio escrito.
  const {correctAnswerFor}=await import('../tests/helpers.js');
  const csrf=(await context.cookies()).find(cookie=>cookie.name==='habla_csrf').value;
  const headers={'x-habla-csrf':decodeURIComponent(csrf)};
  const course=await (await page.request.get(`${baseUrl}/api/v1/units?track=sql`)).json();
  const sqlLessons=course.units.flatMap(unit=>unit.lessons);
  for(const lesson of sqlLessons.slice(0,6)) {
    const started=await (await page.request.post(`${baseUrl}/api/v1/attempts`,{headers,data:{lessonId:lesson.id}})).json();
    for(const exercise of started.attempt.exercises) {
      const response=await page.request.put(`${baseUrl}/api/v1/attempts/${started.attempt.id}/answers/${exercise.id}`,{headers,data:{answer:await correctAnswerFor(exercise)}});
      assert.equal((await response.json()).correct,true);
    }
    assert.equal((await (await page.request.post(`${baseUrl}/api/v1/attempts/${started.attempt.id}/complete`,{headers})).json()).result.passed,true);
  }
  const next=await (await page.request.post(`${baseUrl}/api/v1/attempts`,{headers,data:{lessonId:sqlLessons[6].id}})).json();
  for(const exercise of next.attempt.exercises.slice(0,3)) {
    await page.request.put(`${baseUrl}/api/v1/attempts/${next.attempt.id}/answers/${exercise.id}`,{headers,data:{answer:await correctAnswerFor(exercise)}});
  }
  await page.goto(`${baseUrl}/lesson/${sqlLessons[6].id}`);
  await page.getByRole('textbox',{name:'Escribe tu código SQL'}).fill('SELECT name, price FROM products WHERE 1=1;');
  await page.getByRole('button',{name:'▶ Ejecutar pruebas',exact:true}).click();
  await page.getByText(/Todas las pruebas pasan/).waitFor();
  await page.screenshot({path:path.join(artifacts,'sql-editor.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('OK: lección completa, ejecución, borrador, recarga, reanudación, XP, perfil y móvil. Sin errores JavaScript.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exit(1);});
