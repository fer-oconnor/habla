import { api } from '../api.js?v=studio20261003';
import { el } from '../dom.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';
import { warmLaboratory } from '../laboratory.js?v=studio20261003';

function pythonValue(value) {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (Array.isArray(value)) return '[' + value.map(pythonValue).join(', ') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).map(([key,item]) => pythonValue(key) + ': ' + pythonValue(item)).join(', ') + '}';
  return JSON.stringify(value);
}

export function buildCodeEditor(exercise,{onChange,attemptId}) {
  warmLaboratory();
  const payload = exercise.payload;
  const key = `habla.code.${store.user.id}.${attemptId}.${exercise.id}`;
  let local = null;
  try { local = JSON.parse(localStorage.getItem(key)); } catch { /* almacenamiento opcional */ }
  const restored = local && typeof local.code==='string' && typeof local.at==='string' && (!exercise.draftUpdatedAt || local.at > exercise.draftUpdatedAt);
  let value = restored ? local.code : (exercise.draft ?? payload.starter ?? '');
  let timer = null, queue = Promise.resolve(), locked = false;
  const temporary=api.isTemporaryAttempt(attemptId);
  const status = el('span',{class:'faint',role:'status',text:temporary?'Práctica sin guardar · esta ronda no se sincroniza con tu cuenta.':'El progreso y el código se guardan automáticamente.'});
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
        const saved=await api.draft(attemptId,exercise.id,code);
        if (!locked && code === value) status.textContent = saved.temporary?'Práctica sin guardar · esta ronda no se sincroniza con tu cuenta.':'Guardado · puedes cerrar y volver después.';
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
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)) {event.preventDefault();run.click();}
  });
  input.addEventListener('blur',save);
  const output = el('div',{class:'code-output',role:'status','aria-live':'polite'});
  const run = el('button',{class:'btn btn--ghost',type:'button',text:'▶ Ejecutar pruebas'});
  run.addEventListener('click',async () => {
    run.disabled = true;
    output.replaceChildren(el('p',{text:'Preparando y ejecutando el laboratorio… La primera vez puede tardar unos segundos.'}));
    try {
      await save();
      showExecution(await api.run(attemptId,exercise.id,value));
    } catch (error) { output.replaceChildren(el('p',{text:error.message})); }
    finally { run.disabled = locked; }
  });
  function showExecution(execution) {
    const children = [el('p',{text:api.isTemporaryAttempt(attemptId)
      ? (execution.correct?'✓ Todas las pruebas pasan. Ronda de práctica sin guardar.':'Revisa los resultados y la explicación. Esta ronda no se guarda.')
      : execution.correct
      ? (locked ? '✓ Todas las pruebas pasan. Respuesta guardada.' : '✓ Todas las pruebas pasan. Pulsa Comprobar para guardar la respuesta.')
      : (locked ? 'Resultado guardado. Repasa la explicación y vuelve a intentarlo en una nueva ronda.' : 'Revisa los resultados y ajusta tu código. Puedes ejecutar de nuevo.')})];
    if (execution.error) children.push(el('pre',{class:'code-block',text:execution.error}));
    for (const check of execution.checks ?? []) {
      const details = el('details',{},el('summary',{text:`${check.passed ? '✓' : '✗'} ${check.name}`}));
      if (check.error) details.append(el('pre',{class:'code-block',text:check.error}));
      else if (payload.language === 'python') details.append(el('pre',{class:'code-block',text:
        `Tu resultado: ${pythonValue(check.actual?.value)}\nEsperado: ${pythonValue(check.expected?.value)}`}));
      else details.append(el('p',{text:'Tu resultado'}),table(check.actual?.columns ?? [],check.actual?.rows ?? []),
        el('p',{text:'Resultado esperado'}),table(check.expected?.columns ?? [],check.expected?.rows ?? []));
      if (!check.passed) details.open = true;
      children.push(details);
    }
    output.replaceChildren(...children);
  }
  const guide = payload.instructions;
  function table(columns,rows) {
    const head = el('thead',{},el('tr',{},...columns.map(c => el('th',{scope:'col',text:c}))));
    const body = el('tbody',{},...rows.map(row => el('tr',{},...row.map(value =>
      el('td',{text:value === null ? 'NULL' : String(value)})))));
    return el('div',{class:'code-table-scroll'},el('table',{class:'code-table'},head,body),
      rows.length ? null : el('p',{class:'faint',text:'Sin filas (resultado vacío).'}));
  }
  const instructions = guide ? el('section',{class:'code-guide stack--tight','aria-label':'Datos y resultado del ejercicio'},
    el('h3',{text:payload.language === 'python' ? 'Datos que ya tienes' : 'Tablas del primer caso'}),
    payload.language === 'python' ? (guide.inputs.length
      ? el('div',{},...guide.inputs.map(entry => el('p',{},el('code',{text:entry.name}),` · ${entry.type}`,el('pre',{class:'code-block',text:`${entry.name} = ${entry.value}`}))))
      : el('p',{text:'No hay variables de entrada en este ejercicio.'})) : null,
    ...(guide.files ?? []).map(file => el('div',{},el('p',{text:`Archivo virtual ya disponible: ${file.name}`}),el('pre',{class:'code-block',text:file.content}))),
    ...(guide.tables ?? []).map(entry => el('details',{open:true},el('summary',{text:entry.name}),
      el('p',{class:'faint',text:entry.columns.map(c => `${c.name} (${c.type})`).join(' · ')}),
      table(entry.columns.map(c => c.name),entry.rows))),
    el('h3',{text:'Qué debe producir tu código'}),
    el('p',{text:guide.output}),guide.order ? el('p',{text:guide.order}) : null,
    el('p',{text:`Ejemplo esperado · ${guide.example.name}`}),
    guide.example.text ? el('pre',{class:'code-block',text:guide.example.text}) : table(guide.example.columns,guide.example.rows),
    ...(guide.notes ?? []).map(note => el('p',{class:'faint',text:note}))) : null;
  const data = el('details',{class:'code-data'},el('summary',{text:'Todos los casos de prueba y detalles del entorno'}),
    el('pre',{class:'code-block',text:payload.context ?? ''}),
    ...(payload.cases ?? []).map((entry) => el('details',{},
      el('summary',{text:entry.name}),
      el('pre',{class:'code-block',text:entry.setup ?? [
        ...Object.entries(entry.globals ?? {}).map(([name,value]) => `${name} = ${pythonValue(value)}`),
        ...Object.entries(entry.files ?? {}).map(([name,value]) => `Archivo virtual ${name}:\n${value}`),
      ].join('\n')}))));
  const reset = el('button',{class:'btn btn--quiet',type:'button',text:'Restaurar plantilla',
    onClick:() => {
      if (value && !window.confirm('¿Reemplazar el borrador por la plantilla del ejercicio?')) return;
      input.value = payload.starter ?? '';
      input.dispatchEvent(new Event('input'));
    }});
  const node = el('div',{class:'exercise code-exercise stack--tight'},
    el('p',{class:'exercise__prompt',text:exercise.prompt}),
    el('p',{class:'exercise__hint',text:exercise.question}),
    exercise.hint ? el('p',{class:'faint',text:exercise.hint}) : null,
    instructions,data,el('label',{for:input.id,text:payload.language === 'sql' ? 'Tu consulta SQL' : 'Tu programa Python'}),
    input,el('p',{class:'faint',text:'Tab cambia de control · Ctrl+Enter o ⌘+Enter ejecuta las pruebas.'}),el('div',{class:'row'},run,reset),status,output);
  return {
    node,getAnswer:() => value.trim() ? value : null,
    focus:() => input.focus({preventScroll:true}),flushDraft:save,
    showResult(result) {
      locked = true;
      clearTimeout(timer);
      input.value = typeof result.yourAnswer === 'string' ? result.yourAnswer : value;
      input.disabled = run.disabled = reset.disabled = true;
      status.textContent = result.temporary?'Respuesta corregida · no se ha añadido al progreso.':'Respuesta guardada en tu progreso.';
      if(!result.temporary) try { localStorage.removeItem(key); } catch { /* opcional */ }
      if (result.execution) showExecution(result.execution);
    },
  };
}
