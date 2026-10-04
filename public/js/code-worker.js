// Python + SQLite run in the visitor's browser, isolated from their cloud profile.
const INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.29.2/full/';
const ready = (async () => {
  importScripts(INDEX + 'pyodide.js');
  const python = await loadPyodide({indexURL:INDEX});
  await python.loadPackage('sqlite3');
  const response=await fetch('/code_runner.py');
  if(!response.ok) throw new Error('No se pudo cargar el laboratorio.');
  python.runPython(await response.text());
  return python;
})();
ready.then(()=>postMessage({ready:true})).catch(error=>postMessage({fatal:error.message}));
onmessage = async ({data}) => {
  try {
    const python=await ready;
    python.globals.set('browser_request',JSON.stringify(data));
    const result=JSON.parse(python.runPython('browser_run(browser_request)'));
    postMessage({id:data.id,...result});
  } catch(error) { postMessage({id:data.id,error:error.message}); }
};
