import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import Database from './sqlite-adapter.mjs';
import { runReference } from './curriculum-runtime.mjs';
import { basics, basicExercises, goals } from './curriculum-review.mjs';

const file = process.env.HABLA_CURRICULUM_OUTPUT ? path.resolve(process.env.HABLA_CURRICULUM_OUTPUT) : new URL('../app/curriculum.json', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
if (catalog.reviewVersion === '20261003-instructions-1') {
  console.log('La revisión docente ya está aplicada.');
  process.exit(0);
}
const identities = catalog.exercises.map(e => [e.id, e.slug, e.lesson_id]);
const find = id => catalog.exercises.find(e => e.id === id);
const lab = find(196).payload;

for (let i = 0; i < basics.length; i++) {
  const l = catalog.lessons.find(l => l.id === 13 + i);
  const [title, intro, body, points] = basics[i];
  Object.assign(l, {title, intro_title:intro, intro_body:body, intro_points:JSON.stringify(points)});
}
Object.assign(catalog.units.find(u => u.id === 5), {title:'Lee los datos', description:'Aprende a elegir columnas, ordenar resultados y limitar filas con consultas SQL.'});
Object.assign(catalog.units.find(u => u.id === 6), {title:'Filtra las filas', description:'Selecciona datos con condiciones, patrones y valores desconocidos.'});

for (const [id, [prompt, explanation, values, question]] of Object.entries(basicExercises)) {
  const e = find(Number(id));
  Object.assign(e, {prompt, explanation});
  if (question) e.question = question;
  if (values) {
    if (Array.isArray(values)) {
      const key = e.payload.options ? 'options' : 'bank';
      const correctIndex = e.payload[key].indexOf(e.solution.value);
      e.payload[key] = values;
      e.solution = {value:values[Math.max(0, correctIndex)]};
    } else {
      e.payload.left = Object.keys(values);
      e.payload.right = Object.values(values);
      e.solution = {pairs:values};
    }
  }
  if (e.type === 'word_order') e.solution.accepted = [e.solution.value, e.solution.value + ';'];
}
find(144).payload.options[3] = "SELECT * FROM students WHERE city = 'Madrid' AND grade IS NULL;";
// Esta respuesta escrita se ejecuta, en vez de aceptar consultas inválidas por normalización de texto.
Object.assign(find(119), {
  hint:'SELECT elige las columnas; * representa todas y FROM introduce la tabla.',
  payload:{editor:true, language:'sql', starter:'-- Escribe aquí tu SELECT\n', cases:structuredClone(lab.cases), ordered:false, context:lab.context},
});
const glossary = {
  SELECT:'elige las columnas del resultado', FROM:'indica la tabla de origen', '*':'todas las columnas',
  'a table':['tabla','una colección de filas y columnas'], 'a row':['fila','un registro, por ejemplo un estudiante'],
  'a column':['columna','un tipo de dato de cada registro'], 'a query':['consulta','una instrucción SQL; SELECT lee datos y otras instrucciones pueden modificarlos'],
  'a result set':['conjunto de resultados','las filas y columnas que devuelve una consulta'], AS:'cambia el nombre de una columna en el resultado',
  'ORDER BY':'ordena las filas', ASC:'ordena de menor a mayor', DESC:'ordena de mayor a menor', LIMIT:'limita la cantidad de filas',
  DISTINCT:'elimina filas duplicadas del resultado', 'a semicolon':['punto y coma','el símbolo ; separa sentencias SQL'],
  WHERE:'conserva las filas que cumplen una condición', 'a condition':['condición','una comparación que se evalúa para cada fila'],
  '=':'igual a', '<>':'distinto de', '>':'mayor que', '>=':'mayor o igual que', '<':'menor que',
  AND:'deben cumplirse las dos condiciones', OR:'debe cumplirse al menos una condición', NOT:'niega una condición',
  BETWEEN:'dentro de un intervalo, incluidos ambos extremos', IN:'coincide con un valor de una lista', LIKE:'coincide con un patrón de texto',
  '%':'en LIKE, cero o más caracteres', NULL:'valor desconocido; no es cero ni texto vacío',
  'IS NULL':'comprueba si el dato es desconocido', 'IS NOT NULL':'comprueba si el dato está presente',
  'single quotes':['comillas simples','delimitan textos en SQL, por ejemplo \'Madrid\''],
};
for (const v of catalog.vocab.filter(v => v.unit_id === 5 || v.unit_id === 6)) {
  const definition = glossary[v.term_es];
  assert.ok(definition, v.term_es);
  if (Array.isArray(definition)) [v.term_es, v.term_en] = definition;
  else v.term_en = definition;
  if (!/SELECT|WHERE|ORDER|LIKE/.test(v.example_es)) v.example_es = v.term_es + ': ' + v.term_en;
  v.example_en = v.term_en;
}

const sqlNotes = {
  'sql-write-select':'Escribe una consulta completa, no solo el nombre de una tabla. Las tablas ya están creadas; no copies los INSERT de los datos de prueba.',
  'sql-count':'Si orders está vacía, COUNT(*) devuelve una fila con 0. COUNT(grade) ignora las notas NULL.',
  'sql-sum-average':'SUM y AVG sobre ninguna fila devuelven NULL, no 0. No sustituyas NULL salvo que el ejercicio lo pida.',
  'sql-inner-join':'La relación puede producir varias filas por cliente. No uses DISTINCT si se pide una fila por pedido.',
  'sql-left-join':'Cuenta o.id, no COUNT(*), si quieres que un cliente sin pedidos tenga un recuento de 0. Filtrar la tabla derecha en WHERE puede eliminar esos clientes.',
  'sql-join-revenue':'Los ingresos se calculan solo con pedidos paid (pagados). pending significa pendiente y cancelled, cancelado. La tienda es una simplificación: usa el precio actual del producto.',
  'sql-ranking':'RANK deja huecos después de empates y DENSE_RANK no. ORDER BY dentro de OVER define el cálculo, no garantiza por sí solo el orden final de las filas.',
  'sql-running-lag':'Añade ORDER BY ordered_at, id fuera de OVER si también necesitas presentar las filas en ese orden.',
  'sql-transactions':'Todos los cambios afectan solo a una copia de práctica. Termina con un SELECT después de COMMIT o ROLLBACK para mostrar el estado final.',
  'sql-indexes':'El índice no cambia qué filas devuelve SELECT. En estas prácticas se comprueba el resultado de la consulta; la creación del índice es parte de la técnica que debes practicar, no una medición de rendimiento.',
  'sql-data-quality':'Compartir una ciudad no convierte dos clientes en duplicados. Antes de deduplicar personas habría que definir una clave y una regla de identidad.',
};
for (const l of catalog.lessons) {
  if (sqlNotes[l.slug]) {
    const points = JSON.parse(l.intro_points);
    points.splice(Math.max(0, points.length - 1), 0, sqlNotes[l.slug]);
    l.intro_points = JSON.stringify(points);
  }
}
const variables = catalog.lessons.find(l => l.slug === 'py-variables');
variables.intro_body = 'Una variable es un nombre asociado a un valor. Habla prepara las variables de entrada antes de ejecutar tu programa: por ejemplo, puntos ya puede valer 10. Tu tarea es calcular una respuesta y asignarla a resultado, en minúsculas. resultado es el nombre que lee el corrector de Habla, no una palabra especial de Python.';
variables.intro_points = JSON.stringify([
  'En una asignación como copia = energia, Python lee el valor de energia (derecha) y lo guarda con el nombre copia (izquierda). Si energia vale 7, copia queda con 7.',
  'Los nombres de variables se escriben sin comillas. "energia" es un texto literal; energia es una variable. El signo = asigna; == compara.',
  'Las entradas aparecen en el ejercicio y cambian en cada prueba. No las redefinas con un valor fijo ni uses input().',
  'Guarda tu respuesta en resultado. print() solo muestra un mensaje: no sustituye esa asignación. No escribas return fuera de una función.',
  'Ejecutar pruebas permite corregir el borrador. Comprobar registra la respuesta; tu código se guarda automáticamente mientras escribes.',
]);

// Representación de ejemplos en sintaxis Python (no true/null de JSON).
function python(value) {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (Array.isArray(value)) return '[' + value.map(python).join(', ') + ']';
  if (typeof value === 'object') return '{' + Object.entries(value).map(([k,v]) => python(k) + ': ' + python(v)).join(', ') + '}';
  return JSON.stringify(value);
}
function type(value) {
  return value === null ? 'None (sin valor)' : Array.isArray(value) ? 'lista' : ({string:'texto',number:'número',boolean:'booleano (True o False)',object:'diccionario'})[typeof value];
}
function reference(e) {
  const run = runReference({language:e.payload.language,payload:e.payload,code:e.solution.value,reference:e.solution.value});
  assert.equal(run.status, 0, run.stderr);
  const execution = JSON.parse(run.stdout);
  assert.ok(execution.correct, e.slug + ': ' + run.stdout);
  return execution.checks.map(c => c.expected);
}
const expectedCache = new Map();
for (const e of catalog.exercises.filter(e => e.payload.editor)) {
  const debug = e.position === 5;
  const task = debug ? find(e.id - 1) : e;
  e.prompt = (debug ? 'Corrige la plantilla para cumplir este objetivo: ' : '') + (goals[task.id] ?? task.prompt.replace(/^Devuelve /, 'Obtén '));
  // Casos antes triviales: ahora hay un pedido huérfano y un empleado que supera a su responsable.
  if (task.id === 424) e.payload.cases[1].setup += "\nINSERT INTO orders VALUES(98,999,1,1,'paid','2026-04-01');";
  if (task.id === 358) e.payload.cases[1].setup += "\nINSERT INTO employees VALUES(98,'Lia','Datos',4500,1);";
  // La secuencia de ventana y la presentación son decisiones distintas en SQL.
  if ([380,382,384].includes(task.id)) {
    e.solution.value = e.solution.value.replace(/;$/, ' ORDER BY ordered_at,id;');
    e.payload.ordered = true;
  }
  const cacheKey = JSON.stringify([e.payload.language,e.payload.cases,e.solution.value]);
  if (!expectedCache.has(cacheKey)) expectedCache.set(cacheKey, reference(e));
  e.expected = expectedCache.get(cacheKey);
  if (e.payload.language === 'python') {
    e.question = 'Las variables indicadas ya existen. Usa sus valores y guarda la respuesta final en resultado (en minúsculas). No uses input(), no copies un valor fijo del ejemplo y no te limites a print(). Si defines una función, guarda también el resultado de llamarla.';
    const first = e.payload.cases[0];
    const inputs = Object.entries(first.globals ?? {}).map(([name,value]) => ({name, value:python(value), type:[...new Set(e.payload.cases.map(c => type(c.globals[name])))].join(' o ')}));
    const outputTypes = [...new Set(e.expected.map(x => type(x.value)))];
    e.payload.instructions = {
      inputs,
      files:Object.entries(first.files ?? {}).map(([name,content]) => ({name,content})),
      output:task.id === 550 ? 'Una tupla, guardada en resultado. En las pruebas se representa como una secuencia de valores.' : 'Guarda en resultado: ' + outputTypes.join(' o ') + '.',
      example:{name:first.name, text:'resultado debe valer ' + (task.id === 550 ? '(' + e.expected[0].value.map(python).join(', ') + (e.expected[0].value.length === 1 ? ',' : '') + ')' : python(e.expected[0].value))},
      notes:[debug ? 'La plantilla contiene un error. Puedes cambiarla o reescribirla: debe cumplir el mismo objetivo con todas las entradas.' : 'Escribe tu programa debajo. Los datos del ejemplo no son líneas que debas copiar.',
        'Se comprueba la respuesta en todos los casos, no que copies exactamente la solución. Las técnicas propuestas son una guía de práctica; el corrector compara los valores.'],
    };
    if (!debug && !e.payload.starter) e.payload.starter = '# Las variables de entrada ya existen.\n# Calcula la respuesta y asígnala a resultado.\n';
    if (task.id === 436) {
      e.hint = 'Usa una asignación con resultado a la izquierda del = y puntos a la derecha. No escribas comillas ni redefinas puntos.';
      e.explanation = 'resultado = puntos lee el valor actual de puntos y lo asigna a resultado. Por ejemplo, con puntos=10, resultado vale 10; con puntos=-3, vale -3. Resultado con mayúscula es otro nombre y el corrector no lo lee. resultado = "puntos" guardaría un texto, no el número.';
    }
  } else {
    e.question = 'La base de práctica ya contiene las tablas y los datos. Escribe SQL de SQLite; no necesitas conectar a una base real. Cada prueba empieza con una copia nueva. Si haces cambios, termina con un SELECT que muestre el resultado solicitado.';
    const db = new Database(':memory:');
    db.exec(e.payload.cases[0].setup);
    const available = db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(x => x.name);
    const relevant = available.filter(name => new RegExp('\\b' + name + '\\b', 'i').test(e.solution.value));
    const tables = relevant.map(name => {
      const schema = db.prepare('PRAGMA table_info(' + name + ')').all();
      return {name, columns:schema.map(c => ({name:c.name,type:c.type})), rows:db.prepare('SELECT * FROM ' + name).raw().all()};
    });
    db.close();
    e.payload.instructions = {
      tables, columns:e.expected[0].columns,
      output:'Devuelve únicamente estas columnas y en este orden: ' + e.expected[0].columns.join(', ') + '. Respeta exactamente sus nombres; usa AS para los alias.',
      order:e.payload.ordered ? 'El orden de las filas forma parte del resultado. Añade un ORDER BY final con los criterios del enunciado.' : 'No se exige un orden de filas. Puedes añadir ORDER BY, pero no alteres las filas ni las columnas solicitadas.',
      example:{name:e.payload.cases[0].name, columns:e.expected[0].columns, rows:e.expected[0].rows},
      notes:[debug ? 'La plantilla contiene un error. Corrígela para resolver el objetivo, no solo para que ejecute sin errores.' : 'Las tablas de arriba muestran los datos del primer caso. Los otros casos añaden datos o dejan tablas vacías.',
        'Se comprueban los nombres de columnas, los valores y las repeticiones. Una consulta equivalente puede ser válida sin copiar la solución; la técnica propuesta es una guía de práctica.',
        ...(relevant.includes('orders') ? ['orders.customer_id se relaciona con customers.id y orders.product_id con products.id. paid = pagado; pending = pendiente; cancelled = cancelado.'] : []),
        ...(relevant.includes('employees') ? ['employees.manager_id se relaciona con employees.id; NULL significa que no hay responsable indicado.'] : []),
      ],
    };
    if (task.id === 424) e.explanation += ' En el segundo caso, el pedido 98 referencia al cliente inexistente 999 y debe aparecer; en los demás no hay pedidos huérfanos.';
    if (task.id === 358) e.explanation += ' En el segundo caso, Lia cobra 4500 y su responsable Eva 4000: Lia debe aparecer.';
    if (!debug && !e.payload.starter) e.payload.starter = '-- Las tablas ya están preparadas.\n-- Escribe tu consulta; usa un SELECT final para mostrar la respuesta.\n';
  }
}
catalog.reviewVersion = '20261003-instructions-1';
assert.deepEqual(catalog.exercises.map(e => [e.id,e.slug,e.lesson_id]), identities);
fs.writeFileSync(file, JSON.stringify(catalog));
console.log(JSON.stringify({lessons:catalog.lessons.length, exercises:catalog.exercises.length, editors:catalog.exercises.filter(e => e.payload.editor).length, distinctPrograms:expectedCache.size, identitiesPreserved:true}));
