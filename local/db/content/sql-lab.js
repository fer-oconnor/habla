// Datos locales y desechables: nunca se ejecuta código del alumno en habla.db.
const DATA = `
CREATE TABLE students(id INTEGER PRIMARY KEY, name TEXT, age INTEGER, city TEXT, grade REAL);
INSERT INTO students VALUES (1,'Ana',19,'Madrid',8.5),(2,'Luis',22,'Sevilla',6.0),
(3,'Marta',20,'Madrid',9.1),(4,'Diego',25,'Valencia',NULL);
CREATE TABLE customers(id INTEGER PRIMARY KEY, name TEXT, city TEXT, email TEXT);
INSERT INTO customers VALUES (1,'Ana','Madrid','ana@ejemplo.test'),(2,'Luis','Sevilla',NULL),
(3,'Marta','Madrid','marta@ejemplo.test'),(4,'Diego','Valencia',NULL);
CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL, stock INTEGER);
INSERT INTO products VALUES (1,'Teclado','Tecnologia',30,8),(2,'Raton','Tecnologia',20,0),
(3,'Cuaderno','Papeleria',5,15),(4,'Lapiz','Papeleria',2,30);
CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INTEGER, product_id INTEGER, quantity INTEGER, status TEXT, ordered_at TEXT);
INSERT INTO orders VALUES (1,1,1,2,'paid','2026-01-01'),(2,1,3,4,'paid','2026-01-02'),
(3,2,2,1,'pending','2026-02-03'),(4,3,1,1,'paid','2026-02-04'),(5,3,4,10,'cancelled','2026-03-05');
CREATE TABLE employees(id INTEGER PRIMARY KEY, name TEXT, department TEXT, salary INTEGER, manager_id INTEGER);
INSERT INTO employees VALUES (1,'Eva','Datos',4000,NULL),(2,'Leo','Datos',2500,1),
(3,'Sara','Ventas',3000,1),(4,'Omar','Ventas',2000,3),(5,'Nora','Datos',2500,1);
`;
const EXTRA = `
INSERT INTO students VALUES (5,'Nora',18,'Bilbao',7.2),(6,'Eva',22,'Madrid',NULL);
INSERT INTO customers VALUES (5,'Nora','Bilbao',NULL);
INSERT INTO products VALUES (5,'Monitor','Tecnologia',120,2);
INSERT INTO orders VALUES (6,5,5,2,'paid','2026-03-06'),(7,2,3,3,'paid','2026-03-07');
INSERT INTO employees VALUES (6,'Paz','Soporte',1800,NULL);
`;
export const SQL_CONTEXT = `SQLite · Tablas disponibles (abre Datos para ver sus filas):
students(id, name, age, city, grade)
customers(id, name, city, email)
products(id, name, category, price, stock)
orders(id, customer_id, product_id, quantity, status, ordered_at)
employees(id, name, department, salary, manager_id)
Los pedidos relacionan customers.id con customer_id y products.id con product_id.
Fechas en YYYY-MM-DD. NULL representa un dato desconocido.`;
export const SQL_CASES = [
  { name: 'Tienda inicial', setup: DATA },
  { name: 'Nuevos clientes y pedidos', setup: DATA + EXTRA },
  { name: 'Sin pedidos ni estudiantes', setup: DATA + 'DELETE FROM orders; DELETE FROM students;' },
];
export function sqlTask(goal, code, why, { starter = '', bug = 'SELEC * FROM students;', ordered = false, hint = '' } = {}) {
  return { goal, code, why, starter, bug, ordered, hint, context: SQL_CONTEXT, cases: SQL_CASES };
}
