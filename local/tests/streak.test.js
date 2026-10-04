// Verificacion 6: rachas en dias consecutivos, dias omitidos y cambio de fecha.
//
// La racha depende del reloj, asi que estas pruebas llaman directamente a
// `applyLessonPass` con la fecha que queremos simular (el parametro `at`).
// Es exactamente la misma funcion que usa POST /attempts/:id/complete.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, playAttempt, signInAsGuest, startTestServer } from './helpers.js';

let server;
let db;
let applyLessonPass;
let getProgressSummary;
let dayInTimeZone;

before(async () => {
  server = await startTestServer();
  const dbModule = await import('../db/index.js');
  db = dbModule.getDb();
  const progressModule = await import('../server/services/progress.service.js');
  applyLessonPass = progressModule.applyLessonPass;
  getProgressSummary = progressModule.getProgressSummary;
  ({ dayInTimeZone } = await import('../server/lib/dates.js'));
});
after(async () => { await server.close(); });

/** Crea un usuario de prueba directamente en la base de datos. */
async function makeUser(timezone = 'Europe/Madrid') {
  const { createGuest } = await import('../server/services/auth.service.js');
  return createGuest({ displayName: 'Racha', timezone });
}

/** Marca una leccion como superada en la fecha indicada. */
function pass(user, lessonId, isoDate, xp = 10) {
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, status, best_correct,
                                    attempts_count, xp_earned, first_passed_at, last_attempt_at)
       VALUES (?, ?, 'completed', 8, 1, ?, ?, ?)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         status = 'completed',
         attempts_count = lesson_progress.attempts_count + 1,
         last_attempt_at = excluded.last_attempt_at`
    ).run(user.id, lessonId, xp, isoDate, isoDate);

    return applyLessonPass({
      db,
      userId: user.id,
      lessonId,
      timezone: user.timezone,
      xpReward: xp,
      at: new Date(isoDate),
    });
  });
  return run();
}

function lessonIds(count) {
  return db.prepare('SELECT id FROM lessons ORDER BY global_order LIMIT ?')
    .all(count)
    .map((row) => row.id);
}

describe('Racha diaria', () => {
  test('tres dias consecutivos dan racha 3 y el logro streak_3', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1, l2, l3] = lessonIds(3);

    const day1 = pass(user, l1, '2026-03-02T10:00:00.000Z');
    assert.equal(day1.streak, 1);
    const day2 = pass(user, l2, '2026-03-03T10:00:00.000Z');
    assert.equal(day2.streak, 2);
    const day3 = pass(user, l3, '2026-03-04T10:00:00.000Z');
    assert.equal(day3.streak, 3);
    assert.ok(day3.achievementsEarned.includes('streak_3'));

    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
    assert.equal(progress.current_streak, 3);
    assert.equal(progress.longest_streak, 3);
    assert.equal(progress.last_active_day, '2026-03-04');
    assert.equal(progress.xp, 30);
  });

  test('varias lecciones el mismo dia NO suben la racha varias veces', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1, l2, l3] = lessonIds(3);

    pass(user, l1, '2026-03-02T09:00:00.000Z');
    pass(user, l2, '2026-03-02T12:00:00.000Z');
    const third = pass(user, l3, '2026-03-02T20:00:00.000Z');

    assert.equal(third.streak, 1, 'sigue siendo el primer dia');
    const daily = db
      .prepare('SELECT * FROM daily_activity WHERE user_id = ? AND activity_day = ?')
      .get(user.id, '2026-03-02');
    assert.equal(daily.goal_lessons, 3, 'pero si cuentan 3 lecciones para el objetivo');
    assert.equal(daily.xp_earned, 30);
  });

  test('la MISMA leccion dos veces el mismo dia cuenta una sola vez', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1] = lessonIds(1);

    pass(user, l1, '2026-03-02T09:00:00.000Z', 10);
    const repeat = pass(user, l1, '2026-03-02T18:00:00.000Z', 0); // repetir: 0 XP

    assert.equal(repeat.countedToday, false);
    const daily = db
      .prepare('SELECT * FROM daily_activity WHERE user_id = ? AND activity_day = ?')
      .get(user.id, '2026-03-02');
    assert.equal(daily.goal_lessons, 1);
    assert.equal(daily.xp_earned, 10);
  });

  test('un dia omitido reinicia la racha a 1', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1, l2, l3] = lessonIds(3);

    pass(user, l1, '2026-03-02T10:00:00.000Z');   // dia 2  -> racha 1
    pass(user, l2, '2026-03-03T10:00:00.000Z');   // dia 3  -> racha 2
    const afterGap = pass(user, l3, '2026-03-06T10:00:00.000Z'); // faltan 4 y 5

    assert.equal(afterGap.streak, 1, 'la racha se rompio');
    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
    assert.equal(progress.current_streak, 1);
    assert.equal(progress.longest_streak, 2, 'la mejor racha se conserva');
  });

  test('si el ultimo dia activo quedo lejos, GET /progress muestra racha 0', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1] = lessonIds(1);
    pass(user, l1, '2020-01-01T10:00:00.000Z');

    const summary = getProgressSummary({
      id: user.id, timezone: 'Europe/Madrid', dailyGoal: 1,
    });
    assert.equal(summary.currentStreak, 0, 'la racha mostrada caduca');
    assert.equal(summary.longestStreak, 1, 'pero el record se guarda');
    assert.equal(summary.xp, 10);
  });

  test('el dia de actividad usa la zona horaria del perfil', async () => {
    // 2026-03-02T23:30Z son las 00:30 del dia 3 en Madrid (UTC+1).
    const instant = new Date('2026-03-02T23:30:00.000Z');
    assert.equal(dayInTimeZone(instant, 'UTC'), '2026-03-02');
    assert.equal(dayInTimeZone(instant, 'Europe/Madrid'), '2026-03-03');
    assert.equal(dayInTimeZone(instant, 'America/Mexico_City'), '2026-03-02');

    const madrid = await makeUser('Europe/Madrid');
    const [l1] = lessonIds(1);
    const result = pass(madrid, l1, '2026-03-02T23:30:00.000Z');
    assert.equal(result.day, '2026-03-03', 'para Madrid ya es el dia siguiente');

    // Y con ese usuario, una leccion a las 08:00 UTC del dia 3 sigue siendo el
    // mismo dia: la racha no sube.
    const [, l2] = lessonIds(2);
    const same = pass(madrid, l2, '2026-03-03T08:00:00.000Z');
    assert.equal(same.day, '2026-03-03');
    assert.equal(same.streak, 1);
  });

  test('cambiar la zona horaria hacia atras no rompe la racha', async () => {
    const user = await makeUser('Europe/Madrid');
    const [l1, l2] = lessonIds(2);
    pass(user, l1, '2026-03-05T10:00:00.000Z');

    // El usuario viaja y su zona pasa a una donde aun es el dia 4.
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run('Pacific/Niue', user.id);
    const moved = { ...user, timezone: 'Pacific/Niue' };
    const backwards = pass(moved, l2, '2026-03-05T05:00:00.000Z'); // dia 4 en Niue

    assert.equal(backwards.day, '2026-03-04');
    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id);
    assert.equal(progress.current_streak, 1, 'la racha no baja');
    assert.equal(progress.last_active_day, '2026-03-05', 'ni retrocede el ultimo dia activo');
  });
});

describe('Objetivo diario', () => {
  test('el objetivo se cumple al alcanzar el numero de lecciones elegido', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Objetivo', 'Europe/Madrid');
    await client.patch('/api/v1/me', { dailyGoal: 2 });

    const first = await client.get('/api/v1/progress');
    assert.equal(first.data.today.goal, 2);
    assert.equal(first.data.today.goalMet, false);

    for (let step = 0; step < 2; step += 1) {
      const units = await client.get('/api/v1/units');
      const next = units.data.units.flatMap((unit) => unit.lessons)
        .find((lesson) => lesson.status === 'available');
      const started = await client.post('/api/v1/attempts', { lessonId: next.id });
      await playAttempt(client, started.data.attempt, 8);
    }

    const after = await client.get('/api/v1/progress');
    assert.equal(after.data.today.lessons, 2);
    assert.equal(after.data.today.goalMet, true);
    assert.equal(after.data.week.length, 7);
    assert.equal(after.data.week[6].lessons, 2, 'el ultimo dia de la semana es hoy');
  });
});
