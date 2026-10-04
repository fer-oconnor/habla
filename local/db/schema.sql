-- ---------------------------------------------------------------------------
-- Habla - esquema de base de datos (SQLite)
--
-- Todo el script usa "IF NOT EXISTS", asi que se puede ejecutar muchas veces
-- sin borrar datos ni duplicar tablas (npm run setup es repetible).
--
-- Reglas generales:
--  * Las fechas se guardan SIEMPRE en UTC, en formato ISO-8601
--    ("2026-09-15T18:04:22.123Z"), como TEXT.
--  * El "dia de actividad" (activity_day) se guarda como 'YYYY-MM-DD' ya
--    calculado con la zona horaria del usuario (ver server/lib/dates.js).
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;

-- === Rutas de aprendizaje (tracks) ========================================
-- Habla tiene dos cursos activos independientes: "python" y "sql". Cada uno tiene
-- sus unidades, sus desbloqueos y su progreso por separado.
CREATE TABLE IF NOT EXISTS tracks (
  slug          TEXT    PRIMARY KEY,
  position      INTEGER NOT NULL,
  title         TEXT    NOT NULL,
  subtitle      TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  content_lang  TEXT    NOT NULL DEFAULT 'es',  -- idioma que se lee en voz alta
  speech        INTEGER NOT NULL DEFAULT 1 CHECK (speech IN (0, 1)),
  term_label    TEXT    NOT NULL DEFAULT 'Spanish',
  meaning_label TEXT    NOT NULL DEFAULT 'English',
  color         TEXT    NOT NULL DEFAULT 'teal',
  icon          TEXT    NOT NULL DEFAULT 'sun'
);

-- === Usuarios =============================================================
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    UNIQUE,              -- NULL para invitados
  password_hash     TEXT,                        -- NULL para invitados
  display_name      TEXT    NOT NULL,
  is_guest          INTEGER NOT NULL DEFAULT 0 CHECK (is_guest IN (0, 1)),
  daily_goal        INTEGER NOT NULL DEFAULT 1 CHECK (daily_goal IN (1, 2, 3)),
  timezone          TEXT    NOT NULL DEFAULT 'UTC',
  sound_enabled     INTEGER NOT NULL DEFAULT 1 CHECK (sound_enabled IN (0, 1)),
  onboarding_done   INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_done IN (0, 1)),
  active_track      TEXT    NOT NULL DEFAULT 'sql',
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  -- Un invitado no tiene email ni contrasena; una cuenta real tiene los dos.
  CHECK (
    (is_guest = 1 AND email IS NULL AND password_hash IS NULL) OR
    (is_guest = 0 AND email IS NOT NULL AND password_hash IS NOT NULL)
  )
);

-- === Sesiones (persistentes en SQLite, no en memoria) =====================
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT    PRIMARY KEY,             -- token aleatorio (hex)
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  last_seen_at  TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- === Contenido del curso ==================================================
CREATE TABLE IF NOT EXISTS units (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  track       TEXT    NOT NULL DEFAULT 'spanish',
  position    INTEGER NOT NULL,                  -- orden global entre todas
  track_position INTEGER NOT NULL DEFAULT 1,     -- orden dentro de su track
  title       TEXT    NOT NULL,                  -- titulo visible en la interfaz
  subtitle    TEXT    NOT NULL,
  description TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT 'teal',
  icon        TEXT    NOT NULL DEFAULT 'sun'
);
-- Los indices de `track` se crean en db/index.js (migrate), despues de los
-- ALTER TABLE, para que tambien funcionen en bases de datos antiguas.

CREATE TABLE IF NOT EXISTS lessons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  slug          TEXT    NOT NULL UNIQUE,
  track         TEXT    NOT NULL DEFAULT 'spanish',
  position      INTEGER NOT NULL,                -- orden dentro de la unidad
  global_order  INTEGER NOT NULL UNIQUE,         -- orden entre TODAS las lecciones
  track_order   INTEGER NOT NULL DEFAULT 1,      -- orden dentro del track (desbloqueos)
  title         TEXT    NOT NULL,
  intro_title   TEXT    NOT NULL,
  intro_body    TEXT    NOT NULL,                -- que se va a aprender
  intro_points  TEXT    NOT NULL,                -- JSON: ["...", "..."]
  xp_reward     INTEGER NOT NULL DEFAULT 10,
  pass_threshold INTEGER NOT NULL DEFAULT 6,     -- aciertos necesarios
  UNIQUE (unit_id, position)
);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);

CREATE TABLE IF NOT EXISTS exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  slug          TEXT    NOT NULL UNIQUE,
  position      INTEGER NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN (
                  'choose_translation',  -- elegir traduccion entre opciones
                  'fill_blank',          -- completar una frase
                  'word_order',          -- ordenar palabras
                  'match_pairs',         -- emparejar palabra / significado
                  'listen_choose'        -- escuchar y elegir
                )),
  prompt        TEXT    NOT NULL,                -- instruccion del ejercicio
  question      TEXT,                            -- frase/palabra mostrada
  hint          TEXT,
  audio_text    TEXT,                            -- texto que lee SpeechSynthesis
  payload       TEXT    NOT NULL,                -- JSON publico (opciones, fichas...)
  solution      TEXT    NOT NULL,                -- JSON PRIVADO (nunca al cliente antes de responder)
  explanation   TEXT    NOT NULL,                -- explicacion pedagogica
  UNIQUE (lesson_id, position)
);
CREATE INDEX IF NOT EXISTS idx_exercises_lesson ON exercises(lesson_id);

-- Vocabulario del curso (catalogo). Lo que el usuario "ha visto" se registra
-- aparte, en user_vocabulary.
CREATE TABLE IF NOT EXISTS vocabulary (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  term_es     TEXT    NOT NULL UNIQUE,
  term_en     TEXT    NOT NULL,
  example_es  TEXT    NOT NULL,
  example_en  TEXT    NOT NULL,
  part_of_speech TEXT
);
CREATE INDEX IF NOT EXISTS idx_vocabulary_unit ON vocabulary(unit_id);

-- Que ejercicio introduce que palabra (para marcar vocabulario como visto)
CREATE TABLE IF NOT EXISTS exercise_vocabulary (
  exercise_id   INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, vocabulary_id)
);

-- === Intentos y respuestas ===============================================
CREATE TABLE IF NOT EXISTS attempts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id      INTEGER REFERENCES lessons(id) ON DELETE CASCADE, -- NULL en repaso mixto
  kind           TEXT    NOT NULL CHECK (kind IN ('lesson', 'practice')),
  status         TEXT    NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
  exercise_ids   TEXT    NOT NULL,        -- JSON con el orden fijado del intento
  total_count    INTEGER NOT NULL,
  correct_count  INTEGER NOT NULL DEFAULT 0,
  passed         INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0, 1)),
  xp_awarded     INTEGER NOT NULL DEFAULT 0,
  started_at     TEXT    NOT NULL,
  completed_at   TEXT,
  -- Un intento de leccion necesita leccion; uno de repaso puede no tenerla.
  CHECK (kind = 'practice' OR lesson_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_attempts_user   ON attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_lesson ON attempts(user_id, lesson_id);

-- La clave primaria compuesta garantiza UNA sola respuesta por ejercicio e
-- intento: reenviar la misma respuesta devuelve el resultado guardado y
-- cambiarla se rechaza (idempotencia).
CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id    INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  exercise_id   INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  answer        TEXT    NOT NULL,        -- JSON con lo que envio el usuario
  answer_digest TEXT    NOT NULL,        -- forma normalizada, para comparar reenvios
  is_correct    INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  answered_at   TEXT    NOT NULL,
  PRIMARY KEY (attempt_id, exercise_id)
);

-- === Progreso =============================================================
CREATE TABLE IF NOT EXISTS user_progress (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp                INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  lessons_passed    INTEGER NOT NULL DEFAULT 0 CHECK (lessons_passed >= 0),
  current_streak    INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak    INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_day   TEXT,                 -- 'YYYY-MM-DD' en zona del usuario
  updated_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id      INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status         TEXT    NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available', 'completed')),
  best_correct   INTEGER NOT NULL DEFAULT 0,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  xp_earned      INTEGER NOT NULL DEFAULT 0,   -- 10 como maximo (solo 1a vez)
  first_passed_at TEXT,
  last_attempt_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);

-- Actividad por dia (para objetivo diario y racha).
-- goal_lessons cuenta LECCIONES DISTINTAS superadas ese dia.
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_day  TEXT    NOT NULL,            -- 'YYYY-MM-DD' zona del usuario
  goal_lessons  INTEGER NOT NULL DEFAULT 0 CHECK (goal_lessons >= 0),
  xp_earned     INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL,
  PRIMARY KEY (user_id, activity_day)
);

-- Lecciones que ya han contado para el objetivo de un dia concreto.
-- Impide que la misma leccion cuente dos veces el mismo dia.
CREATE TABLE IF NOT EXISTS daily_lesson_credit (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_day TEXT    NOT NULL,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (user_id, activity_day, lesson_id)
);

-- Errores pendientes de repaso. Se crean/actualizan al fallar y se marcan
-- resueltos al acertar el mismo ejercicio.
CREATE TABLE IF NOT EXISTS review_items (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id   INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  misses        INTEGER NOT NULL DEFAULT 1 CHECK (misses >= 0),
  resolved      INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
  last_missed_at TEXT   NOT NULL,
  resolved_at   TEXT,
  PRIMARY KEY (user_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_review_pending ON review_items(user_id, resolved);

-- Vocabulario que el usuario ya ha encontrado en ejercicios
CREATE TABLE IF NOT EXISTS user_vocabulary (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  times_seen    INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT    NOT NULL,
  last_seen_at  TEXT    NOT NULL,
  PRIMARY KEY (user_id, vocabulary_id)
);

-- === Logros ===============================================================
CREATE TABLE IF NOT EXISTS achievements (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT    NOT NULL REFERENCES achievements(code) ON DELETE CASCADE,
  earned_at  TEXT    NOT NULL,
  PRIMARY KEY (user_id, code)
);

-- === Control de versiones del contenido ==================================
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempt_drafts (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(attempt_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS recovery_keys (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
