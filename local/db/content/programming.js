// Las lecciones conservan un formato común: concepto, asociaciones, sintaxis,
// escritura, depuración, aplicación, caso límite y reto sin plantilla.
export function lesson({ slug, title, body, points, terms, gap, edge, tasks, language }) {
  const pairs = Object.fromEntries(terms.map(([term, meaning]) => [term, meaning]));
  const exercise = (index, data) => ({ slug: `${slug}-e${index}`, ...data,
    vocab: terms.map(([term]) => `${language === 'python' ? 'Py · ' : 'SQL · '}${term}`) });
  const code = (index, task, debug = false) => exercise(index, {
    type: 'fill_blank', prompt: debug ? `Depura el código: ${task.goal}` : task.goal,
    question: language === 'python'
      ? 'Las entradas cambian en cada prueba. Guarda la respuesta en resultado.'
      : 'Ejecuta tu consulta sobre los datos de ejemplo. Respeta las columnas solicitadas.',
    hint: task.hint,
    payload: { editor: true, language, starter: debug ? task.bug : (task.starter ?? ''),
      cases: task.cases, ordered: task.ordered ?? false,
      context: task.context ?? '' },
    solution: { value: task.code },
    explanation: task.why,
  });
  return {
    slug, title, introTitle: title, introBody: body,
    introPoints: [...points, `Ejemplo resuelto:\n${tasks[0].code}\n${tasks[0].why}`],
    exercises: [
      exercise(1, { type: 'choose_translation', prompt: `¿Qué significa ${terms[0][0]}?`,
        payload: { options: terms.map(([, meaning]) => meaning) },
        solution: { value: terms[0][1] }, explanation: `${terms[0][0]}: ${terms[0][1]}. ${points[0]}` }),
      exercise(2, { type: 'match_pairs', prompt: 'Conecta cada herramienta con su función.',
        payload: { left: terms.map(([term]) => term), right: terms.map(([, meaning]) => meaning) },
        solution: { pairs }, explanation: terms.map(([term, meaning]) => `${term}: ${meaning}`).join('\n') }),
      exercise(3, { type: 'fill_blank', prompt: gap[0], question: gap[1],
        payload: { bank: [gap[2], ...gap[3]] }, solution: { value: gap[2] }, explanation: gap[4] }),
      code(4, tasks[0]),
      code(5, tasks[0], true),
      code(6, tasks[1]),
      exercise(7, { type: 'choose_translation', prompt: edge[0],
        payload: { options: edge[1] }, solution: { value: edge[1][0] }, explanation: edge[2] }),
      code(8, tasks[2]),
    ],
  };
}

export function unit(slug, title, subtitle, language, lessons) {
  const vocabulary = new Map();
  for (const entry of lessons) for (const [term, meaning] of entry.terms) {
    const key = `${language === 'python' ? 'Py · ' : 'SQL · '}${term}`;
    vocabulary.set(key, { es: key, en: meaning, pos: 'concept',
      exampleEs: entry.tasks[0].code, exampleEn: entry.tasks[0].why });
  }
  return { slug, track: language, title, subtitle, description: subtitle,
    color: language === 'python' ? 'amber' : 'violet', icon: language === 'python' ? 'book' : 'table',
    vocabulary: [...vocabulary.values()],
    lessons: lessons.map((entry) => lesson({ ...entry, language })) };
}

export function pyTask(goal, code, cases, why, { starter = '', bug = 'resultado = None', hint = '', files = null } = {}) {
  return { goal, code, why, starter, bug, hint,
    context: 'Escribe Python 3. Solo se permiten math, json y sqlite3; los archivos y las bases de datos son de práctica en memoria.',
    cases: cases.map((globals, i) => ({ name: `Caso ${i + 1}`, globals, ...(files ? { files: files[i] } : {}) })) };
}
