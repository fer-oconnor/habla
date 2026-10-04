// ---------------------------------------------------------------------------
// Todos los textos de la interfaz, en un solo sitio.
//
// La interfaz esta en INGLES; lo que se aprende (espanol o SQL) viene del
// servidor. Para traducir la interfaz en el futuro: copia el objeto `en`,
// cambia los valores y elige el idioma en `setLocale()`.
// ---------------------------------------------------------------------------

export const en = {
  app: {
    name: 'Habla',
    tagline: 'Learn Python and SQL by writing code',
    loading: 'Loading…',
    retry: 'Try again',
    dismiss: 'Dismiss',
    cancel: 'Cancel',
    save: 'Save',
    saved: 'Saved',
    close: 'Close',
    back: 'Back',
    offline: 'You appear to be offline.',
    genericError: 'Something went wrong. Please try again.',
    sessionExpired: 'Your session has expired. Please sign in again.',
  },

  nav: {
    learn: 'Learn',
    practice: 'Practice',
    words: 'Words',
    profile: 'Profile',
  },

  welcome: {
    title: 'Habla',
    subtitle: 'Learn Python and SQL with practical coding challenges and saved progress.',
    benefits: [
      'Eight exercises per lesson — about five minutes.',
      'Real explanations after every answer, not just a tick.',
      'Your streak, XP and mistakes are saved for you.',
    ],
    guest: 'Try as a guest',
    guestHint: 'No email needed. Your progress stays in this browser while your session lasts.',
    or: 'or',
    signIn: 'Sign in',
    signUp: 'Create account',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    name: 'Your name',
    namePlaceholder: 'How should we call you?',
    haveAccount: 'Already have an account?',
    noAccount: 'New here?',
    creating: 'Creating your account…',
    signingIn: 'Signing you in…',
    startingGuest: 'Setting up your guest session…',
  },

  onboarding: {
    title: 'Let’s set you up',
    subtitle: 'Two quick questions. You can change both later in your profile.',
    nameLabel: 'What should we call you?',
    goalLabel: 'How many lessons a day?',
    goalHint: 'Your daily goal. Pick something you will actually do.',
    goals: {
      1: { title: 'Casual', detail: '1 lesson a day — about 5 minutes' },
      2: { title: 'Steady', detail: '2 lessons a day — about 10 minutes' },
      3: { title: 'Serious', detail: '3 lessons a day — about 15 minutes' },
    },
    timezoneLabel: 'Your time zone',
    timezoneHint: 'We use it to decide when your day ends, for streaks and daily goals.',
    detected: 'Detected automatically',
    start: 'Start learning',
  },

  learn: {
    greeting: (name) => `Hello, ${name}`,
    goalTitle: 'Today’s goal',
    goalProgress: (done, goal) => `${done} of ${goal} lesson${goal === 1 ? '' : 's'}`,
    goalMet: 'Daily goal complete. Nice one!',
    goalTodo: (left) => `${left} more to hit today’s goal.`,
    continueLesson: 'Continue',
    startLesson: 'Start lesson',
    reviewLesson: 'Practise again',
    lockedHint: 'Finish the lesson before this one to unlock it.',
    unit: (n) => `Unit ${n}`,
    lesson: (n) => `Lesson ${n}`,
    status: { locked: 'Locked', available: 'Ready', completed: 'Completed' },
    bestScore: (correct, total) => `Best: ${correct}/${total}`,
    courseDone: 'You finished every lesson in this course. Keep your streak alive with Practice.',
    switchCourse: 'Course',
    allCoursesDone: 'Nothing left here — try the other course or Practice.',
  },

  lesson: {
    intro: 'In this lesson',
    startNow: 'Let’s go',
    quit: 'Leave lesson',
    quitConfirm: 'Leave this lesson? Your answers so far are saved — you can come back and carry on.',
    progress: (current, total) => `${current} of ${total}`,
    check: 'Check',
    continueBtn: 'Continue',
    finish: 'See results',
    correct: 'Correct!',
    wrong: 'Not quite',
    correctAnswerIs: 'Correct answer:',
    yourAnswer: 'You answered:',
    why: 'Why',
    typeHere: 'Type your answer',
    chooseOption: 'Choose one option',
    tapWords: 'Tap the words in the right order',
    tapToRemove: 'Tap a word to put it back',
    emptySentence: 'Your sentence appears here',
    matchPairs: 'Tap a term, then its meaning',
    pairsLeft: 'Term',
    pairsRight: 'Meaning',
    matched: 'Matched',
    listen: 'Play audio',
    listenAgain: 'Play again',
    listenSlow: 'Play slowly',
    audioUnavailable: 'Audio is not available in this browser',
    readingAlternative: 'Reading alternative',
    readingAlternativeHint:
      'Your browser has no speech voice for this language, so here is the sentence written out. You can finish the lesson normally.',
    resuming: 'Picking up where you left off…',
    answerSaved: 'Answer already saved — showing your result.',
  },

  result: {
    passedTitle: 'Lesson complete!',
    failedTitle: 'Good effort',
    passedBody: (xp) => (xp > 0 ? `You earned ${xp} XP.` : 'Practice round — no new XP this time.'),
    failedBody: (need, total) =>
      `You need ${need} of ${total} correct to pass. Have another go — your answers are saved.`,
    practiceTitle: 'Practice done',
    score: 'Score',
    accuracy: 'Accuracy',
    xp: 'XP',
    continueBtn: 'Continue',
    retryBtn: 'Try this lesson again',
    practiceMistakes: 'Practise my mistakes',
    reviewTitle: 'Your answers',
    newAchievement: 'New achievement!',
    backToLearn: 'Back to Learn',
  },

  practice: {
    title: 'Practice',
    subtitle: 'Short sessions built from your own mistakes.',
    fromMistakes: (n) => `${n} exercise${n === 1 ? '' : 's'} you got wrong before.`,
    fromReview: 'No mistakes pending — here is a mixed review of what you have studied.',
    start: 'Start practice',
    nothingYet: 'Nothing to practise yet',
    nothingYetBody:
      'Practice is built from exercises you have already seen. Finish your first lesson and come back.',
    goToFirstLesson: 'Go to the first lesson',
    noXpNote: 'Practice saves your results and clears your mistakes, but does not give XP or unlock lessons.',
    pendingCount: (n) => `${n} pending mistake${n === 1 ? '' : 's'}`,
    allClear: 'No mistakes pending. Well done.',
  },

  words: {
    title: 'Words',
    subtitle: 'Everything you have met in an exercise, with an example.',
    search: 'Search',
    searchPlaceholder: 'Search a term or a meaning',
    allUnits: 'All units',
    empty: 'No terms yet',
    emptyBody: 'Finish a lesson and the terms you meet will appear here.',
    noMatches: 'Nothing matches that search.',
    seen: (n) => `Seen ${n} time${n === 1 ? '' : 's'}`,
    speak: 'Hear it',
    speakExample: 'Hear the example',
    count: (n) => `${n} term${n === 1 ? '' : 's'}`,
  },

  profile: {
    title: 'Profile',
    guestBadge: 'Guest session',
    guestNote:
      'You are using a guest session. Your progress lives in this browser — create an account to keep it anywhere.',
    stats: 'Your numbers',
    xp: 'Total XP',
    streak: 'Current streak',
    longest: 'Best streak',
    lessons: 'Lessons passed',
    accuracy: 'Correct answers',
    words: 'Terms learnt',
    days: (n) => `${n} day${n === 1 ? '' : 's'}`,
    week: 'This week',
    achievements: 'Achievements',
    locked: 'Not yet',
    earnedOn: (date) => `Earned ${date}`,
    settings: 'Settings',
    nameLabel: 'Display name',
    goalLabel: 'Daily goal',
    timezoneLabel: 'Time zone',
    soundLabel: 'Sound and speech',
    soundHint: 'Turn off to silence the audio buttons.',
    courseLabel: 'Course shown in Learn',
    signOut: 'Sign out',
    signOutConfirm: 'Sign out now?',
    signOutGuestConfirm:
      'You are a guest: signing out ends this session and you will not be able to get back to this progress. Continue?',
  },

  achievements: {
    first_lesson: 'First steps',
    five_lessons: 'Picking up speed',
    streak_3: 'Three in a row',
  },
};

const es = {
  ...en,
  app:{...en.app,tagline:'Aprende Python y SQL programando',loading:'Cargando…',retry:'Reintentar',dismiss:'Cerrar',cancel:'Cancelar',save:'Guardar',saved:'Guardado',close:'Cerrar',back:'Volver',genericError:'Algo ha fallado. Vuelve a intentarlo.',sessionExpired:'Tu sesión ha caducado. Vuelve a entrar.'},
  nav:{learn:'Aprender',practice:'Practicar',words:'Conceptos',profile:'Perfil'},
  welcome:{...en.welcome,subtitle:'Python y SQL: 72 lecciones para aprender escribiendo código.',
    benefits:['Retos de escritura y depuración con pruebas reales.','Explicaciones, XP, rachas y repaso de tus errores.','Avances y borradores guardados para seguir donde lo dejaste.'],
    guest:'Empezar como invitado',guestHint:'Sin correo. Conserva este navegador para retomar tu perfil; crea una cuenta para recuperarlo al cambiar de navegador.',or:'o',signIn:'Iniciar sesión',signUp:'Crear cuenta',email:'Correo',password:'Contraseña',passwordHint:'Al menos 8 caracteres.',name:'Tu nombre',namePlaceholder:'¿Cómo te llamas?',haveAccount:'¿Ya tienes cuenta?',noAccount:'¿Aún no tienes cuenta?',creating:'Creando cuenta…',signingIn:'Entrando…',startingGuest:'Preparando tu perfil…'},
  onboarding:{...en.onboarding,title:'Prepara tu aventura',subtitle:'Elige tu nombre y una meta diaria.',nameLabel:'¿Cómo te llamas?',goalLabel:'¿Cuántas lecciones al día?',goalHint:'Elige una meta que puedas mantener.',
    goals:{1:{title:'Tranquilo',detail:'1 lección al día'},2:{title:'Constante',detail:'2 lecciones al día'},3:{title:'Intensivo',detail:'3 lecciones al día'}},timezoneLabel:'Zona horaria',timezoneHint:'La usamos para calcular tus días de práctica y rachas.',detected:'Detectada automáticamente',start:'Empezar a aprender'},
  learn:{...en.learn,greeting:name=>`Hola, ${name}`,goalTitle:'Tu meta de hoy',goalProgress:(done,goal)=>`${done} de ${goal} lecciones`,goalMet:'¡Meta diaria completada!',goalTodo:left=>`Te quedan ${left} para completar la meta.`,continueLesson:'Continuar',startLesson:'Empezar lección',reviewLesson:'Practicar de nuevo',lockedHint:'Aprueba la lección anterior para desbloquear esta.',unit:n=>`Unidad ${n}`,lesson:n=>`Lección ${n}`,status:{locked:'Bloqueada',available:'Disponible',completed:'Completada'},bestScore:(correct,total)=>`Mejor: ${correct}/${total}`,courseDone:'¡Curso completado! Sigue reforzando lo aprendido en Practicar.',switchCourse:'Curso'},
  lesson:{...en.lesson,intro:'Lo que vas a aprender',startNow:'¡Vamos!',quit:'Salir de la lección',quitConfirm:'¿Salir? Tus respuestas y tu borrador se guardan para continuar después.',progress:(current,total)=>`${current} de ${total}`,check:'Comprobar',continueBtn:'Continuar',finish:'Ver resultados',correct:'¡Correcto!',wrong:'Todavía no',correctAnswerIs:'Una solución correcta:',yourAnswer:'Tu respuesta:',why:'Por qué',typeHere:'Escribe tu respuesta',chooseOption:'Elige una opción',tapWords:'Ordena las piezas',tapToRemove:'Pulsa para devolver una pieza',emptySentence:'Tu respuesta aparece aquí',matchPairs:'Une cada concepto con su significado',pairsLeft:'Concepto',pairsRight:'Significado',matched:'Conectado',resuming:'Continuando donde lo dejaste…',answerSaved:'Respuesta ya guardada: mostrando el resultado.'},
  result:{...en.result,passedTitle:'¡Lección superada!',failedTitle:'Sigue practicando',passedBody:xp=>xp>0?`Has ganado ${xp} XP.`:'Repaso completado: sin XP adicionales.',failedBody:(need,total)=>`Necesitas ${need} de ${total} aciertos. Puedes repetir y repasar tus errores.`,practiceTitle:'Repaso completado',score:'Resultado',accuracy:'Aciertos',continueBtn:'Continuar',retryBtn:'Repetir lección',practiceMistakes:'Repasar mis errores',reviewTitle:'Tus respuestas',newAchievement:'¡Nuevo logro!',backToLearn:'Volver a Aprender'},
  practice:{...en.practice,title:'Practicar',subtitle:'Repasa tus errores y lo que ya has aprendido.',fromMistakes:n=>`${n} ejercicios que puedes reforzar.`,fromReview:'Sin errores pendientes: repasamos contenido que has estudiado.',start:'Empezar o retomar repaso',nothingYet:'Aún no hay nada que repasar',nothingYetBody:'Termina una lección y vuelve para practicar.',goToFirstLesson:'Ir a Aprender',noXpNote:'El repaso guarda resultados y resuelve errores, sin XP ni desbloqueos adicionales.',pendingCount:n=>`${n} errores pendientes`,allClear:'¡Sin errores pendientes!'},
  words:{...en.words,title:'Conceptos',subtitle:'Las herramientas que has descubierto, con ejemplos.',search:'Buscar',searchPlaceholder:'Busca un concepto o significado',allUnits:'Todas las unidades',empty:'Aún no hay conceptos',emptyBody:'Los conceptos aparecen al practicar una lección.',noMatches:'Sin resultados.',seen:n=>`Visto ${n} veces`,count:n=>`${n} conceptos`},
  profile:{...en.profile,title:'Perfil',guestBadge:'Perfil de invitado',guestNote:'Tu progreso está en SQLite en este ordenador. El navegador recuerda tu perfil. Crea una cuenta sin perder avances para poder entrar aunque borres cookies o cambies de navegador.',stats:'Tus estadísticas',xp:'XP totales',streak:'Racha actual',longest:'Mejor racha',lessons:'Lecciones superadas',accuracy:'Respuestas correctas',words:'Conceptos descubiertos',days:n=>`${n} días`,week:'Esta semana',achievements:'Logros',locked:'Pendiente',settings:'Ajustes',nameLabel:'Nombre',goalLabel:'Meta diaria',timezoneLabel:'Zona horaria',soundLabel:'Sonido',soundHint:'Activa o desactiva sonidos de la interfaz.',courseLabel:'Curso activo',signOut:'Cerrar sesión',signOutConfirm:'¿Cerrar sesión?',signOutGuestConfirm:'Tu progreso seguirá en el disco, pero cerrar sesión elimina el acceso automático a este invitado. Crea una cuenta antes para poder recuperarlo. ¿Cerrar sesión?'},
};
const locales = { en, es };
let current = 'es';

export function setLocale(code) {
  if (locales[code]) current = code;
}

/** Diccionario activo. Uso: `t().learn.goalTitle` */
export function t() {
  return locales[current];
}

export default t;
