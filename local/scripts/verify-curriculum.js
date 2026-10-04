import assert from 'node:assert/strict';
import { UNITS,contentSummary } from '../db/content/index.js';
import { evaluateCode } from '../server/services/code.service.js';
import { gradeAnswer } from '../server/services/grading.js';

let programs = 0, cases = 0, broken = 0;
const failures = [];
for (const unit of UNITS) for (const lesson of unit.lessons) {
  for (const exercise of lesson.exercises) {
    if (!exercise.payload?.editor) {
      if (exercise.type !== 'word_order') {
        const answer = exercise.type === 'match_pairs' ? exercise.solution.pairs : exercise.solution.value;
        assert.equal((await gradeAnswer({...exercise,payload:exercise.payload ?? {}},answer)).correct,true,exercise.slug);
      }
      continue;
    }
    // El ejercicio de depuración comparte contrato con el ejercicio de escritura.
    if (exercise.slug.endsWith('-e5')) {
      const invalid = await evaluateCode(exercise,exercise.payload.starter);
      if (invalid.correct) failures.push(`${exercise.slug}: la plantilla rota ya pasa`);
      broken += 1;
      continue;
    }
    const result = await evaluateCode(exercise,exercise.solution.value);
    programs += 1;
    cases += result.checks?.length ?? 0;
    if (!result.correct) failures.push(`${exercise.slug}: ${JSON.stringify(result)}`);
  }
  console.log(`✓ ${lesson.slug}`);
}
console.log(JSON.stringify({content:contentSummary(),programs,cases,broken,failures},null,2));
assert.equal(failures.length,0,'Hay ejercicios que deben repararse.');
