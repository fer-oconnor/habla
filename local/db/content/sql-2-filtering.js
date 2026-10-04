// ---------------------------------------------------------------------------
// SQL - Unidad 2: Filtering rows
// Misma tabla `students` y formato declarativo que la primera unidad SQL.
// ---------------------------------------------------------------------------

export default {
  slug: 'sql-filtering',
  track: 'sql',
  title: 'Filtering rows',
  subtitle: 'WHERE, comparisons, AND / OR, LIKE, NULL',
  description:
    'Stop reading whole tables. Describe the rows you actually want and let the database throw the rest away.',
  color: 'teal',
  icon: 'filter',

  vocabulary: [
    { es: 'WHERE', en: 'keep only the rows that match a condition', pos: 'keyword', exampleEs: 'SELECT * FROM students WHERE age > 20;', exampleEn: 'Only students over 20.' },
    { es: 'a condition', en: 'a test that is true or false for each row', pos: 'concept', exampleEs: 'age > 20 is a condition.', exampleEn: 'It is checked once per row.' },
    { es: '=', en: 'is equal to', pos: 'operator', exampleEs: "WHERE city = 'Madrid'", exampleEn: 'Students from Madrid.' },
    { es: '<>', en: 'is not equal to', pos: 'operator', exampleEs: "WHERE city <> 'Madrid'", exampleEn: 'Students not from Madrid.' },
    { es: '>', en: 'is greater than', pos: 'operator', exampleEs: 'WHERE age > 20', exampleEn: 'Older than 20.' },
    { es: '>=', en: 'is greater than or equal to', pos: 'operator', exampleEs: 'WHERE age >= 20', exampleEn: '20 or older.' },
    { es: '<', en: 'is less than', pos: 'operator', exampleEs: 'WHERE grade < 7', exampleEn: 'Grade below 7.' },
    { es: 'AND', en: 'both conditions must be true', pos: 'keyword', exampleEs: "WHERE age > 20 AND city = 'Madrid'", exampleEn: 'Over 20 AND from Madrid.' },
    { es: 'OR', en: 'at least one condition must be true', pos: 'keyword', exampleEs: "WHERE city = 'Madrid' OR city = 'Sevilla'", exampleEn: 'From either city.' },
    { es: 'NOT', en: 'flips a condition', pos: 'keyword', exampleEs: "WHERE NOT city = 'Madrid'", exampleEn: 'Everyone except Madrid.' },
    { es: 'BETWEEN', en: 'inside a range, both ends included', pos: 'keyword', exampleEs: 'WHERE age BETWEEN 19 AND 22', exampleEn: '19, 20, 21 and 22 all count.' },
    { es: 'IN', en: 'matches any value in a list', pos: 'keyword', exampleEs: "WHERE city IN ('Madrid', 'Sevilla')", exampleEn: 'Shorter than a chain of ORs.' },
    { es: 'LIKE', en: 'matches a text pattern', pos: 'keyword', exampleEs: "WHERE name LIKE 'A%'", exampleEn: 'Names starting with A.' },
    { es: '%', en: 'in LIKE: any number of characters', pos: 'symbol', exampleEs: "LIKE '%a'", exampleEn: 'Anything ending in a.' },
    { es: 'NULL', en: 'no value at all — not zero, not empty text', pos: 'concept', exampleEs: 'Diego has grade NULL.', exampleEn: 'The grade is simply unknown.' },
    { es: 'IS NULL', en: 'test for a missing value', pos: 'keyword', exampleEs: 'WHERE grade IS NULL;', exampleEn: 'Students with no grade yet.' },
    { es: 'IS NOT NULL', en: 'test that a value exists', pos: 'keyword', exampleEs: 'WHERE grade IS NOT NULL;', exampleEn: 'Students who do have a grade.' },
    { es: 'single quotes', en: "the ' ' around text values in SQL", pos: 'concept', exampleEs: "WHERE city = 'Madrid'", exampleEn: 'Numbers need no quotes; text does.' },
  ],

  lessons: [
    // === Leccion 1 ========================================================
    {
      slug: 'sql-where-basics',
      title: 'Asking for fewer rows',
      introTitle: 'WHERE',
      introBody:
        '«WHERE» adds a condition. The database checks it once per row and keeps only the rows where it is true. Text goes in single quotes; numbers do not.',
      introPoints: [
        'WHERE comes after FROM and before ORDER BY.',
        "Text: «WHERE city = 'Madrid'». Numbers: «WHERE age = 20».",
        'In SQL, equality is a single «=», not «==».',
      ],
      exercises: [
        {
          slug: 'sql-u2-l1-e1',
          type: 'choose_translation',
          prompt: 'Which query returns only students aged over 20?',
          payload: {
            options: [
              'SELECT * FROM students WHERE age > 20;',
              'SELECT * FROM students IF age > 20;',
              'SELECT * WHERE age > 20 FROM students;',
              'SELECT age > 20 FROM students;',
            ],
          },
          solution: { value: 'SELECT * FROM students WHERE age > 20;' },
          explanation:
            'The clause order is SELECT … FROM … WHERE …. SQL has no «IF» for filtering rows.',
          vocab: ['WHERE', '>'],
        },
        {
          slug: 'sql-u2-l1-e2',
          type: 'fill_blank',
          prompt: 'Complete: only students from Madrid.',
          question: "SELECT * FROM students WHERE city ___ 'Madrid';",
          payload: { bank: ['=', '==', 'IS', 'LIKE'] },
          solution: { value: '=', accepted: ['='] },
          explanation:
            'SQL compares with a single «=». Programmers coming from other languages reach for «==» — SQL does not accept it.',
          vocab: ['=', 'single quotes'],
        },
        {
          slug: 'sql-u2-l1-e3',
          type: 'match_pairs',
          prompt: 'Match each operator with its meaning.',
          payload: {
            left: ['=', '<>', '>=', '<'],
            right: [
              'is less than',
              'is equal to',
              'is greater than or equal to',
              'is not equal to',
            ],
          },
          solution: {
            pairs: {
              '=': 'is equal to',
              '<>': 'is not equal to',
              '>=': 'is greater than or equal to',
              '<': 'is less than',
            },
          },
          explanation:
            '«<>» is the standard "not equal". Most databases also accept «!=», but «<>» works everywhere.',
          vocab: ['=', '<>', '>=', '<'],
        },
        {
          slug: 'sql-u2-l1-e4',
          type: 'choose_translation',
          prompt: 'Why does «WHERE city = Madrid» (no quotes) fail?',
          payload: {
            options: [
              'Without quotes, SQL looks for a COLUMN called Madrid',
              'Because city names must be uppercase',
              'Because WHERE only works with numbers',
              'It does not fail; quotes are optional',
            ],
          },
          solution: { value: 'Without quotes, SQL looks for a COLUMN called Madrid' },
          explanation:
            "Quotes are how SQL tells text values from column names. «'Madrid'» is the word; «Madrid» would be a column.",
          vocab: ['single quotes'],
        },
        {
          slug: 'sql-u2-l1-e5',
          type: 'word_order',
          prompt: 'Build the query: names of students with a grade below 7.',
          payload: { tokens: ['7', 'SELECT', 'grade', 'WHERE', 'students', 'name', 'FROM', '<'] },
          solution: {
            value: 'SELECT name FROM students WHERE grade < 7',
            accepted: [
              'select name from students where grade < 7',
              'select name from students where grade < 7;',
            ],
          },
          explanation:
            'Notice that «grade» appears in WHERE but not in SELECT. You can filter on a column without displaying it.',
          vocab: ['WHERE', '<'],
        },
        {
          slug: 'sql-u2-l1-e6',
          type: 'choose_translation',
          prompt: 'Which query is in the right clause order?',
          payload: {
            options: [
              'SELECT * FROM students WHERE age > 19 ORDER BY age;',
              'SELECT * FROM students ORDER BY age WHERE age > 19;',
              'SELECT * WHERE age > 19 ORDER BY age FROM students;',
              'WHERE age > 19 SELECT * FROM students;',
            ],
          },
          solution: { value: 'SELECT * FROM students WHERE age > 19 ORDER BY age;' },
          explanation:
            'Memorise the skeleton: SELECT → FROM → WHERE → ORDER BY → LIMIT. Filtering happens before sorting.',
          vocab: ['WHERE', 'ORDER BY'],
        },
        {
          slug: 'sql-u2-l1-e7',
          type: 'fill_blank',
          prompt: 'Complete: students who are exactly 20.',
          question: 'SELECT * FROM students ___ age = 20;',
          payload: { bank: ['WHERE', 'HAVING', 'WHEN', 'FILTER'] },
          solution: { value: 'WHERE', accepted: ['where'] },
          explanation:
            '«WHERE» filters rows. («HAVING» exists too, but it filters groups — you will meet it in unit 3.)',
          vocab: ['WHERE'],
        },
        {
          slug: 'sql-u2-l1-e8',
          type: 'word_order',
          prompt: "Build the query: every column, for students from 'Sevilla'.",
          payload: { tokens: ["'Sevilla'", 'SELECT', 'city', 'students', '=', 'WHERE', 'FROM', '*'] },
          solution: {
            value: "SELECT * FROM students WHERE city = 'Sevilla'",
            accepted: [
              "select * from students where city = 'sevilla'",
              'select * from students where city = sevilla',
            ],
          },
          explanation:
            'Text comparisons in SQL are usually case-insensitive for keywords but case-SENSITIVE for values, so spell the city exactly as it is stored.',
          vocab: ['WHERE', '=', 'single quotes'],
        },
      ],
    },

    // === Leccion 2 ========================================================
    {
      slug: 'sql-combining-conditions',
      title: 'Combining conditions',
      introTitle: 'AND, OR, IN, BETWEEN',
      introBody:
        'One condition is rarely enough. «AND» demands both, «OR» accepts either, and «IN» / «BETWEEN» are shortcuts that keep long queries readable.',
      introPoints: [
        'AND is stricter than OR: it returns fewer rows, never more.',
        "«city IN ('Madrid','Sevilla')» replaces two ORs.",
        '«age BETWEEN 19 AND 22» includes both 19 and 22.',
      ],
      exercises: [
        {
          slug: 'sql-u2-l2-e1',
          type: 'choose_translation',
          prompt: "Which query returns students over 20 who are ALSO from Madrid?",
          payload: {
            options: [
              "SELECT * FROM students WHERE age > 20 AND city = 'Madrid';",
              "SELECT * FROM students WHERE age > 20 OR city = 'Madrid';",
              "SELECT * FROM students WHERE age > 20, city = 'Madrid';",
              "SELECT * FROM students WHERE age > 20 & city = 'Madrid';",
            ],
          },
          solution: { value: "SELECT * FROM students WHERE age > 20 AND city = 'Madrid';" },
          explanation:
            '"Also" means both must be true, so «AND». Commas and «&» do not join conditions in SQL.',
          vocab: ['AND'],
        },
        {
          slug: 'sql-u2-l2-e2',
          type: 'choose_translation',
          prompt: 'Which one always returns MORE rows (or the same), never fewer?',
          payload: {
            options: [
              'A OR B',
              'A AND B',
              'A AND NOT B',
              'They always return the same number',
            ],
          },
          solution: { value: 'A OR B' },
          explanation:
            'OR keeps a row if either test passes, so it is the looser filter. AND has to satisfy both, so it can only narrow the result.',
          vocab: ['OR', 'AND'],
        },
        {
          slug: 'sql-u2-l2-e3',
          type: 'fill_blank',
          prompt: 'Complete: students from Madrid or from Sevilla.',
          question: "WHERE city = 'Madrid' ___ city = 'Sevilla'",
          payload: { bank: ['OR', 'AND', 'IN', 'NOT'] },
          solution: { value: 'OR', accepted: ['or'] },
          explanation:
            'A student cannot live in two cities at once, so «AND» here would return zero rows. That mistake is extremely common.',
          vocab: ['OR'],
        },
        {
          slug: 'sql-u2-l2-e4',
          type: 'match_pairs',
          prompt: 'Match each keyword with what it expresses.',
          payload: {
            left: ['AND', 'OR', 'IN', 'BETWEEN'],
            right: [
              'inside a range, ends included',
              'both must be true',
              'matches any value in a list',
              'at least one must be true',
            ],
          },
          solution: {
            pairs: {
              AND: 'both must be true',
              OR: 'at least one must be true',
              IN: 'matches any value in a list',
              BETWEEN: 'inside a range, ends included',
            },
          },
          explanation:
            '«IN» and «BETWEEN» add no new power — they are shorter ways to write chains of OR and AND.',
          vocab: ['AND', 'OR', 'IN', 'BETWEEN'],
        },
        {
          slug: 'sql-u2-l2-e5',
          type: 'choose_translation',
          prompt: 'Which values does «WHERE age BETWEEN 19 AND 22» accept?',
          payload: {
            options: [
              '19, 20, 21 and 22',
              '20 and 21 only',
              '19 and 22 only',
              'Anything above 19',
            ],
          },
          solution: { value: '19, 20, 21 and 22' },
          explanation:
            '«BETWEEN» is inclusive at both ends. If you want to exclude them, write «age > 19 AND age < 22».',
          vocab: ['BETWEEN'],
        },
        {
          slug: 'sql-u2-l2-e6',
          type: 'word_order',
          prompt: "Build the condition: city is Madrid or Sevilla, using IN.",
          payload: { tokens: ['IN', 'city', "('Madrid',", "'Sevilla')", 'WHERE'] },
          solution: {
            value: "WHERE city IN ('Madrid', 'Sevilla')",
            accepted: [
              "where city in ('madrid', 'sevilla')",
              'where city in madrid sevilla',
            ],
          },
          explanation:
            'The list goes in round brackets, values separated by commas. Adding a third city means adding one more value, not another OR.',
          vocab: ['IN'],
        },
        {
          slug: 'sql-u2-l2-e7',
          type: 'fill_blank',
          prompt: 'Complete: everyone EXCEPT students from Valencia.',
          question: "WHERE city ___ 'Valencia'",
          payload: { bank: ['<>', '=', 'IN', 'LIKE'] },
          solution: { value: '<>', accepted: ['<>', '!='] },
          explanation:
            '«<>» means "not equal". «WHERE NOT city = \'Valencia\'» says the same thing in more words.',
          vocab: ['<>', 'NOT'],
        },
        {
          slug: 'sql-u2-l2-e8',
          type: 'word_order',
          prompt: 'Build the query: names of students aged 19 to 22, sorted by age.',
          payload: { tokens: ['22', 'SELECT', 'AND', 'name', 'BETWEEN', 'FROM', 'age', 'students', 'WHERE', '19', 'ORDER', 'BY', 'age'] },
          solution: {
            value: 'SELECT name FROM students WHERE age BETWEEN 19 AND 22 ORDER BY age',
            accepted: [
              'select name from students where age between 19 and 22 order by age',
              'select name from students where age between 19 and 22 order by age;',
            ],
          },
          explanation:
            'Here «AND» belongs to BETWEEN, not to a second condition — that is the one place where AND is part of another keyword.',
          vocab: ['BETWEEN', 'WHERE', 'ORDER BY'],
        },
      ],
    },

    // === Leccion 3 ========================================================
    {
      slug: 'sql-patterns-nulls',
      title: 'Patterns and missing data',
      introTitle: 'LIKE and NULL',
      introBody:
        '«LIKE» searches inside text using «%» as a wildcard. And NULL means "no value at all" — it needs its own test, «IS NULL», because nothing is ever equal to NULL.',
      introPoints: [
        "«LIKE 'A%'» = starts with A. «LIKE '%a'» = ends with a.",
        'NULL is not 0 and not an empty string: it is unknown.',
        '«= NULL» never works. Always «IS NULL» / «IS NOT NULL».',
      ],
      exercises: [
        {
          slug: 'sql-u2-l3-e1',
          type: 'choose_translation',
          prompt: "Which names does «WHERE name LIKE 'A%'» match?",
          payload: {
            options: [
              'Names that start with A, like Ana',
              'Names that end with A, like Marta',
              'Names that contain an A anywhere',
              'Only the exact name "A%"',
            ],
          },
          solution: { value: 'Names that start with A, like Ana' },
          explanation:
            '«%» stands for any characters, including none. So the pattern «A%» means "A followed by anything".',
          vocab: ['LIKE', '%'],
        },
        {
          slug: 'sql-u2-l3-e2',
          type: 'fill_blank',
          prompt: 'Complete: names that contain the letters "ar" anywhere.',
          question: "WHERE name LIKE '___'",
          payload: { bank: ['%ar%', 'ar%', '%ar', 'ar'] },
          solution: { value: '%ar%', accepted: ['%ar%'] },
          explanation:
            'A «%» on each side means "anything, then ar, then anything". That matches Marta.',
          vocab: ['LIKE', '%'],
        },
        {
          slug: 'sql-u2-l3-e3',
          type: 'choose_translation',
          prompt: 'Diego has no grade yet. What is stored in his grade column?',
          payload: {
            options: [
              'NULL — no value at all',
              '0',
              'An empty piece of text',
              'The word "none"',
            ],
          },
          solution: { value: 'NULL — no value at all' },
          explanation:
            'NULL means unknown. A grade of 0 would mean "he sat the exam and scored zero"; NULL means "we do not know". Keeping them apart matters.',
          vocab: ['NULL'],
        },
        {
          slug: 'sql-u2-l3-e4',
          type: 'choose_translation',
          prompt: 'Which query finds students with no grade?',
          payload: {
            options: [
              'SELECT * FROM students WHERE grade IS NULL;',
              'SELECT * FROM students WHERE grade = NULL;',
              'SELECT * FROM students WHERE grade = 0;',
              "SELECT * FROM students WHERE grade = '';",
            ],
          },
          solution: { value: 'SELECT * FROM students WHERE grade IS NULL;' },
          explanation:
            '«= NULL» is never true, not even for a NULL, because SQL cannot say whether two unknowns are equal. That is why «IS NULL» exists.',
          vocab: ['IS NULL', 'NULL'],
        },
        {
          slug: 'sql-u2-l3-e5',
          type: 'match_pairs',
          prompt: 'Match each test with what it finds.',
          payload: {
            left: ['IS NULL', 'IS NOT NULL', "LIKE 'M%'", "LIKE '%o'"],
            right: [
              'values that end in o',
              'rows with no value',
              'values that start with M',
              'rows that do have a value',
            ],
          },
          solution: {
            pairs: {
              'IS NULL': 'rows with no value',
              'IS NOT NULL': 'rows that do have a value',
              "LIKE 'M%'": 'values that start with M',
              "LIKE '%o'": 'values that end in o',
            },
          },
          explanation:
            'Remember which side the «%» sits on: at the end for "starts with", at the beginning for "ends with".',
          vocab: ['IS NULL', 'IS NOT NULL', 'LIKE', '%'],
        },
        {
          slug: 'sql-u2-l3-e6',
          type: 'fill_blank',
          prompt: 'Complete: only students who DO have a grade.',
          question: 'WHERE grade ___',
          payload: { bank: ['IS NOT NULL', 'IS NULL', '<> NULL', '= NULL'] },
          solution: { value: 'IS NOT NULL', accepted: ['is not null'] },
          explanation:
            '«IS NOT NULL» is the partner of «IS NULL». «<> NULL» looks reasonable but is never true.',
          vocab: ['IS NOT NULL'],
        },
        {
          slug: 'sql-u2-l3-e7',
          type: 'word_order',
          prompt: 'Build the query: students whose name starts with M.',
          payload: { tokens: ["'M%'", 'SELECT', 'name', 'LIKE', 'FROM', 'students', 'WHERE', '*'] },
          solution: {
            value: "SELECT * FROM students WHERE name LIKE 'M%'",
            accepted: [
              "select * from students where name like 'm%'",
              'select * from students where name like m%',
            ],
          },
          explanation:
            'The pattern is a text value, so it goes in single quotes just like any other string.',
          vocab: ['LIKE', '%', 'WHERE'],
        },
        {
          slug: 'sql-u2-l3-e8',
          type: 'choose_translation',
          prompt: 'Which query returns students from Madrid who already have a grade?',
          payload: {
            options: [
              "SELECT * FROM students WHERE city = 'Madrid' AND grade IS NOT NULL;",
              "SELECT * FROM students WHERE city = 'Madrid' OR grade IS NOT NULL;",
              "SELECT * FROM students WHERE city = 'Madrid' AND grade <> NULL;",
              "SELECT * FROM students WHERE city IS 'Madrid' AND grade IS NOT NULL;",
            ],
          },
          solution: { value: "SELECT * FROM students WHERE city = 'Madrid' AND grade IS NOT NULL;" },
          explanation:
            'Three rules at once: «=» for text values, «AND» for "both", and «IS NOT NULL» for "has a value". You now have a full working WHERE clause.',
          vocab: ['WHERE', 'AND', 'IS NOT NULL'],
        },
      ],
    },
  ],
};
