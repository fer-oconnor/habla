let worker=null,ready=null,sequence=0,queue=Promise.resolve();
function initialize() {
  if(ready) return ready;
  worker=new Worker('/js/code-worker.js?v=studio20261003');
  ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{stop();reject(new Error('La primera carga del laboratorio tarda demasiado. Comprueba la conexión y vuelve a ejecutar.'));},90000);
    const receive=({data})=>{if(data.ready||data.fatal){clearTimeout(timer);worker?.removeEventListener('message',receive);data.fatal?reject(new Error(data.fatal)):resolve();}};
    worker.addEventListener('message',receive);
    worker.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('No se pudo cargar Python. Comprueba la conexión y vuelve a intentarlo.'));},{once:true});
  }).catch(error=>{stop();throw error;});
  return ready;
}
function stop(){worker?.terminate();worker=null;ready=null;}
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function warmLaboratory(){initialize().catch(()=>{});}
export function runCode(job,code){
  const result=queue.catch(()=>{}).then(async()=>{
    await initialize();const id=++sequence;
    const execution=await new Promise((resolve,reject)=>{
      const current=worker;
      const cleanup=()=>{clearTimeout(timer);current.removeEventListener('message',receive);};
      const receive=({data})=>{if(data.id!==id)return;cleanup();data.error?reject(new Error(data.error)):resolve(data);};
      const timer=setTimeout(()=>{cleanup();stop();reject(new Error('Tiempo agotado. Revisa los bucles: tu borrador está guardado.'));},6000);
      current.addEventListener('message',receive);current.postMessage({id,code,language:job.language,payload:job.payload});
    });
    execution.checks=execution.checks.map((check,i)=>{
      const expected=job.expected[i],actual=check.actual;
      const rows=x=>job.payload.ordered?x:[...x].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
      const passed=!check.error&&actual&&(job.language==='python'?canonical(actual.value)===canonical(expected.value):canonical(actual.columns)===canonical(expected.columns)&&canonical(rows(actual.rows))===canonical(rows(expected.rows)));
      return {...check,expected,passed:!!passed};
    });
    execution.correct=execution.checks.every(x=>x.passed);return execution;
  });
  queue=result;return result;
}
