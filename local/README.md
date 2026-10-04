# HABLA · Edición local

Aprende Python y SQL escribiendo, ejecutando y depurando código. Esta edición funciona en tu ordenador con JavaScript, Express y SQLite, sin servicios externos ni claves de API.

El catálogo final contiene **2 cursos, 24 unidades, 72 lecciones y 576 ejercicios**. Cada curso tiene 12 unidades, 36 lecciones y 288 ejercicios. Hay **264 ejercicios con editor**, que combinan escritura, depuración, aplicación y retos.

[Volver al proyecto y a la demo web](../README.md)

## Arranque rápido

Requisitos: **Node.js 22.13 o superior**, npm y **Python 3.11 o superior** con el módulo estándar `sqlite3`. Usa `python` en Windows o `python3` en macOS/Linux; `PYTHON_BIN` en `.env` permite elegir otro intérprete.

Desde la raíz del repositorio:

```sh
cd local
npm ci
npm run setup
npm start
```

Abre **http://127.0.0.1:3000** y elige **Empezar como invitado**. Tras instalar las dependencias, no necesitas conexión para practicar. `npm run dev` reinicia el servidor al editar el código.

En Windows, `Habla.cmd` instala las dependencias si faltan, prepara el catálogo y arranca esta copia. Mantén su ventana abierta; `Ctrl+C` detiene el servidor. `Detener Habla.cmd` identifica únicamente el proceso iniciado desde esta carpeta por el lanzador. `Habla.cmd /web` abre la demo alojada.

## Qué puedes probar

- Cursos independientes de Python y SQL, con desbloqueos propios.
- Corrección por comportamiento sobre varios casos, admitiendo soluciones equivalentes.
- Conceptos, asociaciones, sintaxis, escritura, depuración y retos; apruebas con 6 de 8 aciertos.
- Borradores, respuestas y lecciones pendientes que se recuperan al volver.
- XP, objetivo diario, rachas según tu zona horaria y logros, sin duplicar recompensas.
- Repasos de los errores pendientes.
- Invitados y cuentas locales; convertir un invitado en cuenta conserva su identidad y progreso.

En Python, guarda la respuesta en `resultado`. **Datos de prueba y entorno** muestra las entradas y archivos virtuales; en SQL, muestra el esquema y datos de SQLite. **Ejecutar pruebas** permite experimentar; **Comprobar** registra una respuesta y presenta la solución y explicación.

## Arquitectura y persistencia

```text
public/                    Interfaz, estilos y recursos propios
server/routes/             API REST bajo /api/v1
server/services/           Autenticación, corrección, intentos y progreso
server/lib/code_runner.py  Laboratorio Python y SQLite de práctica
db/content/                Catálogo declarativo y datos sintéticos
db/schema.sql              Modelo relacional
db/index.js                SQLite y migraciones compatibles
db/seed.js                 Actualización idempotente del catálogo
tests/                     Pruebas con bases temporales independientes
data/                      Datos locales; excluidos de Git
```

Un servidor sirve interfaz y API desde el mismo origen. SQLite guarda sesiones, intentos, borradores y progreso. `better-sqlite3` es un controlador opcional: si no hay un binario compatible, la aplicación usa el SQLite integrado en Node (`node:sqlite`), sin necesitar un compilador C++. Ambos controladores conservan el mismo archivo de datos. `HABLA_SQLITE_DRIVER=node` permite seleccionar explícitamente el integrado. Las respuestas se corrigen en el servidor y las soluciones se entregan después de responder.

`npm run setup` crea `.env` a partir de `.env.example` si falta y actualiza esquema y catálogo **sin borrar progreso**. Mantiene identificadores y avances de instalaciones anteriores. El catálogo activo contiene exclusivamente Python y SQL; el modelo admite historial archivado.

Por defecto, la base es `data/habla.db` y el servidor escucha únicamente en `127.0.0.1`. Puedes configurar `PORT`, `DATABASE_FILE`, `PYTHON_BIN`, `SESSION_DAYS`, `COOKIE_SECURE` y `TRUSTED_ORIGINS` en `.env`.

Los perfiles y avances son **independientes de la edición web**. Una cuenta local permite volver a entrar desde otro navegador del mismo servidor; no sincroniza con otra instalación. Borrar cookies y almacenamiento sin crear antes una cuenta puede impedir recuperar automáticamente al invitado.

La base contiene perfiles, sesiones y respuestas: consérvala privada. El repositorio distribuye solo código, contenido sintético y configuración de ejemplo.

## Verificación

```sh
npm test
npm run verify:curriculum
```

La suite contiene **79 pruebas** de autenticación, aislamiento, persistencia, reanudación, respuestas idempotentes, desbloqueos, XP, rachas, repasos y ejecución. Cada archivo usa una base temporal nueva y no utiliza `data/habla.db`.

La verificación del catálogo ejecuta **198 soluciones de referencia sobre 596 casos**, comprueba **66 plantillas de depuración** deliberadamente incorrectas y valida las soluciones de ejercicios conceptuales.

La comprobación opcional de navegador usa Playwright, dependencia de desarrollo del proyecto raíz, y un servidor con datos desechables:

```sh
# Terminal 1, dentro de local/; sintaxis de macOS/Linux
PORT=3100 DATABASE_FILE=data/browser-test.db npm start

# Terminal 2, dentro de local/
npm run test:browser
```

En PowerShell, fija las variables antes de arrancar:

```powershell
$env:PORT = '3100'
$env:DATABASE_FILE = 'data/browser-test.db'
npm start
```

Si falta Chromium, ejecuta `npx playwright install chromium` desde la raíz. `HABLA_TEST_URL` permite otro puerto de loopback; se rechazan destinos remotos. `HABLA_BROWSER_CHANNEL` permite elegir un navegador instalado, por ejemplo `msedge`. `HABLA_PLAYWRIGHT_PACKAGE` y `HABLA_BROWSER_ARTIFACTS` permiten configurar Playwright y la carpeta de capturas. El script crea perfiles de prueba y capturas en `browser-artifacts/`.

`npm run db:reset -- --yes` elimina el progreso de la base configurada: resérvalo para instalaciones desechables. Para actualizar, usa `npm run setup`.

## Alcance del laboratorio

Cada ejecución utiliza un proceso Python independiente, límites de tiempo y tamaño, validación de AST y una selección de funciones y atributos. Solo se permiten `math`, `json` y `sqlite3`. Los archivos son virtuales y SQLite usa bases en memoria, sin acceso a la base de progreso.

Estas medidas permiten practicar localmente. **El ejecutor no es un sandbox de producción para aceptar código arbitrario de usuarios remotos:** carece de aislamiento mediante contenedores y límites de memoria del sistema operativo. Ese servicio requiere una arquitectura de ejecución aislada.

El servidor incorpora cookies HttpOnly, contraseñas derivadas con scrypt, controles de origen y CSRF, CSP y limitación de intentos de acceso. Mantén esta edición en loopback y consulta [la política de seguridad](../SECURITY.md).
