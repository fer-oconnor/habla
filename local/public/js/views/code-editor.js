import { api } from '../api.js?v=programming20261002';
import { el } from '../dom.js?v=programming20261002';
import { store } from '../store.js?v=programming20261002';

export function buildCodeEditor(exercise,{onChange,attemptId}) {
  const payload = exercise.payload;
  const key = `habla.code.${store.user.id}.${attemptId}.${exercise.id}`;
  let local = null;
  try { local = JSON.parse(localStorage.getItem(key)); } catch { /* almacenamiento opcional */ }
  const restored = local && (!exercise.draftUpdatedAt || local.at > exercise.draftUpdatedAt);
  let value = restored ? local.code : (exercise.draft ?? payload.starter ?? '');
  let timer = null, queue = Promise.resolve(), locked = false;
  const status = el('span',{class:'faint',role:'status',text:'El progreso y el código se guardan automáticamente.'});
  const input = el('textarea',{
    class:'input code-editor',id:`code-${exercise.id}`,rows:'10',maxlength:'8000',
    spellcheck:'false',autocapitalize:'off',autocomplete:'off',
    'aria-label':`Escribe tu código ${payload.language === 'sql' ? 'SQL' : 'Python'}`,
  });
  input.value = value;

  function save() {
    clearTimeout(timer);
    const code = value;
    queue = queue.catch(() => {}).then(async () => {
      if (locked) return;
      try {
        await api.draft(attemptId,exercise.id,code);
        if (!locked && code === value) status.textContent = 'Guardado · puedes cerrar y volver después.';
      } catch (error) {
        if (!locked) status.textContent = `Guardado en este navegador; pendiente en servidor. ${error.message}`;
      }
    });
    return queue;
  }
  input.addEventListener('input',() => {
    value = input.value;
    try { localStorage.setItem(key,JSON.stringify({code:value,at:new Date().toISOString()})); }
    catch { /* el servidor sigue guardando */ }
    status.textContent = 'Guardando…';
    clearTimeout(timer);
    timer = setTimeout(save,350);
    onChange?.();
  });
  input.addEventListener('keydown',(event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    input.setRangeText('    ',input.selectionStart,input.selectionEnd,'end');
    input.dispatchEvent(new Event('input'));
  });
  input.addEventListener('blur',save);
  const output = el('div',{class:'code-output',role:'status','aria-live':'polite'});
  const run = el('button',{class:'btn btn--ghost',type:'button',text:'▶ Ejecutar pruebas'});
  run.addEventListener('click',async () => {
    run.disabled = true;
    output.replaceChildren(el('p',{text:'Ejecutando…'}));
    try {
      await save();
      showExecution(await api.run(attemptId,exercise.id,value));
    } catch (error) { output.replaceChildren(el('p',{text:error.message})); }
    finally { run.disabled = locked; }
  });
  function showExecution(execution) {
    const children = [el('p',{text:execution.correct
      ? (locked ? '✓ Todas las pruebas pasan. Respuesta guardada.' : '✓ Todas las pruebas pasan. Pulsa Comprobar para guardar la respuesta.')
      : (locked ? 'Resultado guardado. Repasa la explicación y vuelve a intentarlo en una nueva ronda.' : 'Revisa los resultados y ajusta tu código. Puedes ejecutar de nuevo.')})];
    if (execution.error) children.push(el('pre',{class:'code-block',text:execution.error}));
    for (const check of execution.checks ?? []) {
      const details = el('details',{},el('summary',{text:`${check.passed ? '✓' : '✗'} ${check.name}`}),
        el('pre',{class:'code-block',text:check.error ?? JSON.stringify({obtenido:check.actual,esperado:check.expected},null,2)}));
      if (!check.passed) details.open = true;
      children.push(details);
    }
    output.replaceChildren(...children);
  }
  const data = el('details',{class:'code-data'},el('summary',{text:'Datos de prueba y entorno'}),
    el('pre',{class:'code-block',text:payload.context ?? ''}),
    ...(payload.cases ?? []).map((entry) => el('details',{},
      el('summary',{text:entry.name}),
      el('pre',{class:'code-block',text:entry.setup ?? JSON.stringify({entradas:entry.globals,archivos:entry.files},null,2)}))));
  const reset = el('button',{class:'btn btn--quiet',type:'button',text:'Restaurar plantilla',
    onClick:() => {
      if (value && !window.confirm('¿Reemplazar el borrador por la plantilla del ejercicio?')) return;
      input.value = payload.starter ?? '';
      input.dispatchEvent(new Event('input'));
    }});
  const node = el('div',{class:'exercise stack--tight'},
    el('p',{class:'exercise__prompt',text:exercise.prompt}),
    el('p',{class:'exercise__hint',text:exercise.question}),
    exercise.hint ? el('p',{class:'faint',text:exercise.hint}) : null,
    data,el('label',{for:input.id,text:payload.language === 'sql' ? 'Tu consulta SQL' : 'Tu programa Python'}),
    input,el('div',{class:'row'},run,reset),status,output);
  return {
    node,getAnswer:() => value.trim() ? value : null,
    focus:() => input.focus({preventScroll:true}),flushDraft:save,
    showResult(result) {
      locked = true;
      clearTimeout(timer);
      input.value = typeof result.yourAnswer === 'string' ? result.yourAnswer : value;
      input.disabled = run.disabled = reset.disabled = true;
      status.textContent = 'Respuesta guardada en tu progreso.';
      try { localStorage.removeItem(key); } catch { /* opcional */ }
      if (result.execution) showExecution(result.execution);
    },
  };
}
