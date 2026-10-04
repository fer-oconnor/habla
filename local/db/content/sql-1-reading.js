// ---------------------------------------------------------------------------
// SQL - Unidad 1: Reading data
//
// Formato declarativo de unidades, lecciones y ejercicios; cada pregunta
// con `track: 'sql'`. Este curso no usa ejercicios de audio: un SELECT no se
// aprende escuchandolo.
//
// Todo el curso gira alrededor de UNA tabla imaginaria, `students`, para que
// el alumno no tenga que recordar esquemas nuevos en cada ejercicio:
//
//   students
//   ┌────┬─────────┬──────┬───────────┬───────┐
//   │ id │ name    │ age  │ city      │ grade │
//   ├────┼─────────┼──────┼───────────┼───────┤
//   │ 1  │ Ana     │ 19   │ Madrid    │ 8.5   │
//   │ 2  │ Luis    │ 22   │ Sevilla   │ 6.0   │
//   │ 3  │ Marta   │ 20   │ Madrid    │ 9.1   │
//   │ 4  │ Diego   │ 25   │ Valencia  │ NULL  │
//   └────┴─────────┴──────┴───────────┴───────┘
// ---------------------------------------------------------------------------

export default {
  slug: 'sql-reading-data',
  track: 'sql',
  title: 'Reading data',
  subtitle: 'SELECT, FROM, column lists, ORDER BY, LIMIT',
  description:
    'Your first questions to a database. Ask for rows, pick the columns you care about, sort the answer and cut it down to a handful of rows.',
  color: 'violet',
  icon: 'table',

  vocabulary: [
    { es: 'SELECT', en: 'choose which columns to show', pos: 'keyword', exampleEs: 'SELECT name FROM students;', exampleEn: 'Show only the name column.' },
    { es: 'FROM', en: 'name the table to read from', pos: 'keyword', exampleEs: 'SELECT * FROM students;', exampleEn: 'Read from the students table.' },
    { es: '*', en: 'all columns', pos: 'symbol', exampleEs: 'SELECT * FROM students;', exampleEn: 'Show every column.' },
    { es: 'a table', en: 'a grid of rows and columns, like one sheet in a spreadsheet', pos: 'concept', exampleEs: 'The students table has 4 rows.', exampleEn: 'Each table stores one kind of thing.' },
    { es: 'a row', en: 'one record: one student, one order, one thing', pos: 'concept', exampleEs: 'Row 1 is Ana, 19, Madrid.', exampleEn: 'A row holds all the data about one item.' },
    { es: 'a column', en: 'one field that every row has', pos: 'concept', exampleEs: 'The age column holds numbers.', exampleEn: 'Columns give rows their shape.' },
    { es: 'a query', en: 'a question you send to the database', pos: 'concept', exampleEs: 'SELECT * FROM students; is a query.', exampleEn: 'A query asks; it does not change anything.' },
    { es: 'a result set', en: 'the rows a query gives back', pos: 'concept', exampleEs: 'That query returned 4 rows.', exampleEn: 'The answer to a query is itself a table.' },
    { es: 'AS', en: 'rename a column in the result', pos: 'keyword', exampleEs: 'SELECT name AS student FROM students;', exampleEn: 'The column is labelled student.' },
    { es: 'ORDER BY', en: 'sort the rows', pos: 'keyword', exampleEs: 'SELECT * FROM students ORDER BY age;', exampleEn: 'Youngest first.' },
    { es: 'ASC', en: 'sort smallest first (the default)', pos: 'keyword', exampleEs: 'ORDER BY age ASC', exampleEn: 'Ascending: 19, 20, 22, 25.' },
    { es: 'DESC', en: 'sort largest first', pos: 'keyword', exampleEs: 'ORDER BY age DESC', exampleEn: 'Descending: 25, 22, 20, 19.' },
    { es: 'LIMIT', en: 'return at most this many rows', pos: 'keyword', exampleEs: 'SELECT * FROM students LIMIT 3;', exampleEn: 'Give me three rows, no more.' },
    { es: 'DISTINCT', en: 'drop duplicate rows from the result', pos: 'keyword', exampleEs: 'SELECT DISTINCT city FROM students;', exampleEn: 'Each city appears once.' },
    { es: 'a semicolon', en: 'the ; that ends a SQL statement', pos: 'concept', exampleEs: 'SELECT * FROM students;', exampleEn: 'One statement, one semicolon.' },
  ],

  lessons: [
    // === Leccion 1 ========================================================
    {
      slug: 'sql-select-basics',
      title: 'Your first query',
      introTitle: 'SELECT … FROM …',
      introBody:
        'A database is a set of tables. A table is a grid: each row is one thing, each column is one fact about it. SQL asks questions with two words: SELECT (which columns) and FROM (which table).',
      introPoints: [
        'SELECT says WHAT you want; FROM says WHERE it lives.',
        '«*» is shorthand for "every column".',
        'Every statement ends with a semicolon: «;»',
      ],
      exercises: [
        {
          slug: 'sql-u1-l1-e1',
          type: 'choose_translation',
          prompt: 'In a table of students, what is one row?',
          payload: {
            options: [
              'One student, with all their data',
              'One fact about every student',
              'The name of the table',
              'The number of students',
            ],
          },
          solution: { value: 'One student, with all their data' },
          explanation:
            'A row is one record — one student. A column is one fact (name, age, city) shared by every row. Getting these two words the right way round makes the rest of SQL easy.',
          vocab: ['a row', 'a column', 'a table'],
        },
        {
          slug: 'sql-u1-l1-e2',
          type: 'choose_translation',
          prompt: 'Which query shows every column of every student?',
          payload: {
            options: [
              'SELECT * FROM students;',
              'SELECT students FROM *;',
              'GET ALL FROM students;',
              'SHOW students ALL;',
            ],
          },
          solution: { value: 'SELECT * FROM students;' },
          explanation:
            'The shape is always SELECT <columns> FROM <table>. «*» means "all columns", so this returns the whole table.',
          vocab: ['SELECT', 'FROM', '*'],
        },
        {
          slug: 'sql-u1-l1-e3',
          type: 'match_pairs',
          prompt: 'Match each piece of SQL with what it does.',
          payload: {
            left: ['SELECT', 'FROM', '*', ';'],
            right: [
              'names the table to read',
              'ends the statement',
              'chooses which columns to show',
              'all columns',
            ],
          },
          solution: {
            pairs: {
              SELECT: 'chooses which columns to show',
              FROM: 'names the table to read',
              '*': 'all columns',
              ';': 'ends the statement',
            },
          },
          explanation:
            'Four symbols, and you can already read most simple queries. SQL keywords are conventionally written in CAPITALS, but the database does not care.',
          vocab: ['SELECT', 'FROM', '*', 'a semicolon'],
        },
        {
          slug: 'sql-u1-l1-e4',
          type: 'fill_blank',
          prompt: 'Complete the query: show every column of the students table.',
          question: 'SELECT * ___ students;',
          payload: { bank: ['FROM', 'IN', 'OF', 'TABLE'] },
          solution: { value: 'FROM', accepted: ['from'] },
          explanation:
            '«FROM» always introduces the table. There is no «IN» or «OF» in a basic SELECT.',
          vocab: ['FROM'],
        },
        {
          slug: 'sql-u1-l1-e5',
          type: 'word_order',
          prompt: 'Build the query: show only the name column from students.',
          payload: { tokens: ['students', 'SELECT', 'FROM', 'name'] },
          solution: {
            value: 'SELECT name FROM students',
            accepted: ['select name from students', 'select name from students;'],
          },
          explanation:
            'Instead of «*» you list the columns you want. Asking for less data is faster and easier to read.',
          vocab: ['SELECT', 'FROM'],
        },
        {
          slug: 'sql-u1-l1-e6',
          type: 'choose_translation',
          prompt: 'How do you ask for two columns, name and city?',
          payload: {
            options: [
              'SELECT name, city FROM students;',
              'SELECT name AND city FROM students;',
              'SELECT name city FROM students;',
              'SELECT (name city) FROM students;',
            ],
          },
          solution: { value: 'SELECT name, city FROM students;' },
          explanation:
            'Columns are separated by commas. «AND» is for conditions, not for lists of columns.',
          vocab: ['SELECT'],
        },
        {
          slug: 'sql-u1-l1-e7',
          type: 'fill_blank',
          prompt: 'The query «SELECT * FROM students;» gives back 4 rows. What do we call that answer?',
          question: 'The answer to a query is called a ___ set.',
          payload: { bank: ['result', 'table', 'query', 'column'] },
          solution: { value: 'result', accepted: ['result', 'result set'] },
          explanation:
            'The answer is a "result set" — and it is itself a table of rows and columns. That is why you can sort it, cut it, or feed it into another query.',
          vocab: ['a result set', 'a query'],
        },
        {
          slug: 'sql-u1-l1-e8',
          type: 'word_order',
          prompt: 'Build the query: show the id and the name of every student.',
          payload: { tokens: ['name', 'SELECT', 'students', 'id,', 'FROM'] },
          solution: {
            value: 'SELECT id, name FROM students',
            accepted: ['select id, name from students', 'select id name from students'],
          },
          explanation:
            'Column order in SELECT is the column order you get back. «SELECT name, id» would return the same data with the columns swapped.',
          vocab: ['SELECT', 'FROM'],
        },
      ],
    },

    // === Leccion 2 ========================================================
    {
      slug: 'sql-sorting',
      title: 'Sorting results',
      introTitle: 'ORDER BY',
      introBody:
        'Rows come back in no guaranteed order. «ORDER BY» fixes that: name a column and the database sorts by it — smallest first by default, or largest first with DESC.',
      introPoints: [
        '«ORDER BY age» sorts youngest first (ASC is the default).',
        '«ORDER BY age DESC» sorts oldest first.',
        'ORDER BY always comes after FROM.',
      ],
      exercises: [
        {
          slug: 'sql-u1-l2-e1',
          type: 'choose_translation',
          prompt: 'Which query lists students from youngest to oldest?',
          payload: {
            options: [
              'SELECT * FROM students ORDER BY age;',
              'SELECT * FROM students SORT age;',
              'SELECT * ORDER BY age FROM students;',
              'ORDER BY age SELECT * FROM students;',
            ],
          },
          solution: { value: 'SELECT * FROM students ORDER BY age;' },
          explanation:
            'The clause order is fixed: SELECT … FROM … ORDER BY …. Swapping the clauses is a syntax error, not a style choice.',
          vocab: ['ORDER BY'],
        },
        {
          slug: 'sql-u1-l2-e2',
          type: 'match_pairs',
          prompt: 'Match each keyword with its effect.',
          payload: {
            left: ['ORDER BY', 'ASC', 'DESC', 'LIMIT'],
            right: [
              'largest or latest first',
              'sort the rows',
              'at most this many rows',
              'smallest first (default)',
            ],
          },
          solution: {
            pairs: {
              'ORDER BY': 'sort the rows',
              ASC: 'smallest first (default)',
              DESC: 'largest or latest first',
              LIMIT: 'at most this many rows',
            },
          },
          explanation:
            'ASC is the default, so you rarely write it. DESC is the one you have to remember.',
          vocab: ['ORDER BY', 'ASC', 'DESC', 'LIMIT'],
        },
        {
          slug: 'sql-u1-l2-e3',
          type: 'fill_blank',
          prompt: 'Complete: list students with the highest grade first.',
          question: 'SELECT * FROM students ORDER BY grade ___;',
          payload: { bank: ['DESC', 'ASC', 'TOP', 'HIGH'] },
          solution: { value: 'DESC', accepted: ['desc'] },
          explanation:
            '«DESC» is short for descending: 9.1, 8.5, 6.0. Without it you would get the lowest grades first.',
          vocab: ['DESC'],
        },
        {
          slug: 'sql-u1-l2-e4',
          type: 'choose_translation',
          prompt: 'What does «SELECT * FROM students ORDER BY name;» give you?',
          question: 'SELECT * FROM students ORDER BY name;',
          payload: {
            options: [
              'All students, in alphabetical order by name',
              'Only the name column',
              'All students, in reverse alphabetical order',
              'Only students whose name starts with A',
            ],
          },
          solution: { value: 'All students, in alphabetical order by name' },
          explanation:
            'ORDER BY changes the ORDER of the rows, never which rows or columns you get. Text sorts alphabetically; numbers sort numerically.',
          vocab: ['ORDER BY', 'ASC'],
        },
        {
          slug: 'sql-u1-l2-e5',
          type: 'word_order',
          prompt: 'Build the query: every student, sorted by city.',
          payload: { tokens: ['city', 'SELECT', 'ORDER', 'students', 'FROM', 'BY', '*'] },
          solution: {
            value: 'SELECT * FROM students ORDER BY city',
            accepted: [
              'select * from students order by city',
              'select * from students order by city;',
            ],
          },
          explanation:
            '«ORDER BY» is two words that always travel together, like a single keyword.',
          vocab: ['ORDER BY'],
        },
        {
          slug: 'sql-u1-l2-e6',
          type: 'choose_translation',
          prompt: 'Which query returns only the 3 oldest students?',
          payload: {
            options: [
              'SELECT * FROM students ORDER BY age DESC LIMIT 3;',
              'SELECT * FROM students LIMIT 3 ORDER BY age DESC;',
              'SELECT TOP 3 * FROM students ORDER BY age;',
              'SELECT * FROM students ORDER BY age LIMIT 3;',
            ],
          },
          solution: { value: 'SELECT * FROM students ORDER BY age DESC LIMIT 3;' },
          explanation:
            'Sort first, then cut. «ORDER BY age LIMIT 3» would give the three YOUNGEST, because ASC is the default. And LIMIT always comes last.',
          vocab: ['LIMIT', 'DESC', 'ORDER BY'],
        },
        {
          slug: 'sql-u1-l2-e7',
          type: 'fill_blank',
          prompt: 'Complete: give me at most 5 rows.',
          question: 'SELECT * FROM students ___ 5;',
          payload: { bank: ['LIMIT', 'TOP', 'MAX', 'ONLY'] },
          solution: { value: 'LIMIT', accepted: ['limit'] },
          explanation:
            '«LIMIT 5» means "5 or fewer". If the table only has 4 rows you simply get 4 — it is not an error.',
          vocab: ['LIMIT'],
        },
        {
          slug: 'sql-u1-l2-e8',
          type: 'word_order',
          prompt: 'Build the query: the single student with the best grade.',
          payload: { tokens: ['1', 'grade', 'SELECT', 'DESC', 'students', 'ORDER', 'LIMIT', 'BY', 'FROM', '*'] },
          solution: {
            value: 'SELECT * FROM students ORDER BY grade DESC LIMIT 1',
            accepted: [
              'select * from students order by grade desc limit 1',
              'select * from students order by grade desc limit 1;',
            ],
          },
          explanation:
            '"Sort by best, then take one" is the standard SQL way to find a maximum row. Remember the full order: SELECT, FROM, ORDER BY, LIMIT.',
          vocab: ['ORDER BY', 'DESC', 'LIMIT'],
        },
      ],
    },

    // === Leccion 3 ========================================================
    {
      slug: 'sql-columns-names',
      title: 'Naming and tidying',
      introTitle: 'AS and DISTINCT',
      introBody:
        'Two small tools that make results readable: «AS» renames a column in the answer, and «DISTINCT» removes duplicate rows.',
      introPoints: [
        '«SELECT name AS student» labels the column "student".',
        '«SELECT DISTINCT city» lists each city once.',
        'Neither one changes the data stored in the table.',
      ],
      exercises: [
        {
          slug: 'sql-u1-l3-e1',
          type: 'choose_translation',
          prompt: 'What does «SELECT name AS student FROM students;» change?',
          question: 'SELECT name AS student FROM students;',
          payload: {
            options: [
              'Only the column label in the result',
              'The column name stored in the table',
              'The order of the rows',
              'Which rows come back',
            ],
          },
          solution: { value: 'Only the column label in the result' },
          explanation:
            '«AS» is cosmetic: it renames the column in THIS answer. The table on disk is untouched.',
          vocab: ['AS'],
        },
        {
          slug: 'sql-u1-l3-e2',
          type: 'fill_blank',
          prompt: 'Complete: label the city column "hometown".',
          question: 'SELECT city ___ hometown FROM students;',
          payload: { bank: ['AS', 'IS', 'LIKE', 'NAMED'] },
          solution: { value: 'AS', accepted: ['as'] },
          explanation:
            'The pattern is «<column> AS <new label>». Many databases also let you drop the AS, but writing it is clearer.',
          vocab: ['AS'],
        },
        {
          slug: 'sql-u1-l3-e3',
          type: 'choose_translation',
          prompt: 'The city column holds: Madrid, Sevilla, Madrid, Valencia. What does «SELECT DISTINCT city FROM students;» return?',
          payload: {
            options: [
              '3 rows: Madrid, Sevilla, Valencia',
              '4 rows: Madrid, Sevilla, Madrid, Valencia',
              '1 row: Madrid',
              '2 rows: Sevilla, Valencia',
            ],
          },
          solution: { value: '3 rows: Madrid, Sevilla, Valencia' },
          explanation:
            '«DISTINCT» collapses repeated rows into one. Madrid appears twice in the table but once in the answer.',
          vocab: ['DISTINCT'],
        },
        {
          slug: 'sql-u1-l3-e4',
          type: 'match_pairs',
          prompt: 'Match each tool with what it is for.',
          payload: {
            left: ['AS', 'DISTINCT', 'ORDER BY', 'LIMIT'],
            right: [
              'remove duplicate rows',
              'cut the answer short',
              'rename a column in the answer',
              'sort the answer',
            ],
          },
          solution: {
            pairs: {
              AS: 'rename a column in the answer',
              DISTINCT: 'remove duplicate rows',
              'ORDER BY': 'sort the answer',
              LIMIT: 'cut the answer short',
            },
          },
          explanation:
            'All four shape the ANSWER, not the stored data. A SELECT never modifies a table.',
          vocab: ['AS', 'DISTINCT', 'ORDER BY', 'LIMIT'],
        },
        {
          slug: 'sql-u1-l3-e5',
          type: 'word_order',
          prompt: 'Build the query: list each city once.',
          payload: { tokens: ['city', 'DISTINCT', 'students', 'SELECT', 'FROM'] },
          solution: {
            value: 'SELECT DISTINCT city FROM students',
            accepted: [
              'select distinct city from students',
              'select distinct city from students;',
            ],
          },
          explanation:
            '«DISTINCT» goes right after SELECT, before the column list. It applies to the whole row of the result.',
          vocab: ['DISTINCT'],
        },
        {
          slug: 'sql-u1-l3-e6',
          type: 'choose_translation',
          prompt: 'Which query is written correctly?',
          payload: {
            options: [
              'SELECT DISTINCT city FROM students ORDER BY city;',
              'SELECT city DISTINCT FROM students;',
              'DISTINCT SELECT city FROM students;',
              'SELECT city FROM DISTINCT students;',
            ],
          },
          solution: { value: 'SELECT DISTINCT city FROM students ORDER BY city;' },
          explanation:
            'The skeleton never changes: SELECT [DISTINCT] columns FROM table [ORDER BY …] [LIMIT …].',
          vocab: ['DISTINCT', 'ORDER BY'],
        },
        {
          slug: 'sql-u1-l3-e7',
          type: 'fill_blank',
          prompt: 'Type the query that shows all columns of the students table.',
          question: '___',
          hint: 'Four characters of SQL, a table name, and a semicolon.',
          solution: {
            value: 'SELECT * FROM students;',
            accepted: ['select * from students', 'select * from students;'],
          },
          explanation:
            'This is the query you will type most often in your life. Whenever you meet a new table, run it first to see what is inside.',
          vocab: ['SELECT', 'FROM', '*'],
        },
        {
          slug: 'sql-u1-l3-e8',
          type: 'word_order',
          prompt: 'Build the query: the 2 alphabetically first names, labelled "student".',
          payload: { tokens: ['student', 'SELECT', 'name', 'AS', 'FROM', 'students', 'ORDER', 'BY', 'name', 'LIMIT', '2'] },
          solution: {
            value: 'SELECT name AS student FROM students ORDER BY name LIMIT 2',
            accepted: [
              'select name as student from students order by name limit 2',
              'select name as student from students order by name limit 2;',
            ],
          },
          explanation:
            'Four clauses in one query, each in its fixed slot. You can now read and write a complete SELECT.',
          vocab: ['AS', 'ORDER BY', 'LIMIT'],
        },
      ],
    },
  ],
};
