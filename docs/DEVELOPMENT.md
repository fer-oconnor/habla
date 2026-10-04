# Desarrollo y reproducción

La raíz contiene la versión web final. `local/` contiene la edición Express de práctica local. Instala y ejecuta cada una desde su propio directorio: sus dependencias, persistencia e identidad son independientes.

## Web final: vista previa local

Requisitos: Node.js **22.13 o superior**, npm y un navegador moderno con WebAssembly. Se recomienda **Node.js 24**, fijado en `.nvmrc` y utilizado por CI. No necesitas instalar Python para ejecutar el laboratorio web.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cynical_cassandra_nova.sql
npm run dev
```

`install:ci` usa el lockfile. La compilación genera `dist/server/wrangler.json`, necesario para el comando de migración. La migración crea las tablas de la base D1 simulada en `.wrangler/state`; ejecútala una sola vez sobre una base nueva. Al cambiar el esquema, genera y aplica nuevas migraciones en orden, sin editar las ya aplicadas.

El perfil portable es el predeterminado para una copia limpia. `npm run dev` inicia Vinext con recarga, inicialmente en el puerto `5173`. Abre la URL que imprima. Para una vista previa de la compilación:

```sh
npm start
```

Ese comando inicia Wrangler en loopback, utilizando el artefacto generado y el mismo estado local. No publica el proyecto.

### Identidad de desarrollo

En el servidor de desarrollo portable y solo sobre loopback, visita:

```text
/signin-with-chatgpt?return_to=/
```

Se crea una identidad ficticia para comprobar los flujos. `/signout-with-chatgpt?return_to=/` cierra esa sesión de prueba. Esta simulación no se incluye en la compilación de producción ni sustituye la identidad de Sites.

El panel del creador requiere `HABLA_OWNER_USER_ID`. Para comprobarlo con la identidad ficticia y ejecutar los cuatro controles de navegador, crea `.dev.vars` en la raíz antes de iniciar el servidor:

```dotenv
HABLA_OWNER_USER_ID=local_seedy
```

Ese valor corresponde exclusivamente a la sesión simulada de desarrollo. No subas IDs de cuentas reales ni archivos `.dev.vars`.

### Scripts de la raíz

| Comando | Uso |
| --- | --- |
| `npm run install:ci` | Instalar versiones fijadas en el lockfile |
| `npm run dev` | Servidor de desarrollo con recarga |
| `npm run build` | Compilar el Worker y los recursos |
| `npm start` | Vista previa local del artefacto compilado |
| `npm run lint` | Revisar la edición web con ESLint; la edición local usa su suite Node |
| `npm run db:generate` | Generar una migración tras cambiar el esquema Drizzle |
| `npm test` | Comprobar integridad del currículo, sintaxis JavaScript, acceso y autorización del creador con SQLite de prueba |
| `npm run test:browser` | Ejecutar controles de navegador en serie sobre la vista previa local |

La primera ejecución del laboratorio descarga Pyodide 0.29.2 desde jsDelivr. Una API local operativa no basta si el navegador no puede descargar ese entorno.

## Alojamiento de la web

La demo usa Sites, un Worker y el binding D1 `DB`. `.openai/hosting.json` declara los recursos y `drizzle/` conserva las migraciones. El servicio de alojamiento debe proporcionar identidad autenticada y aplicar las migraciones a su base de producción.

El repositorio no contiene tokens de despliegue, IDs privados de cuentas, una base de datos de producción ni el secreto del creador. Configura `HABLA_OWNER_USER_ID` en el gestor de secretos del alojamiento para habilitar `/admin`; si no lo configuras, el panel queda cerrado.

Si adaptas la aplicación a otro proveedor, implementa primero una verificación real de identidad y un adaptador de persistencia. No trates las cabeceras `oai-authenticated-user-*` enviadas por un navegador como prueba suficiente de autenticación.

## Edición local

Requisitos: Node.js **22.13 o superior**, npm y Python **3.11 o superior con SQLite**. Se recomienda **Node.js 24**. El adaptador local usa la dependencia opcional `better-sqlite3` cuando está disponible y recurre a `node:sqlite`, incluido en Node, si no puede cargar el módulo nativo. Ambos utilizan el mismo archivo SQLite; no es necesario instalar un compilador C++ para usar la reserva integrada.

```sh
cd local
npm ci
npm run setup
npm start
```

Abre `http://localhost:3000`. El servidor escucha en `127.0.0.1`. La aplicación crea el archivo `local/data/habla.db`, aplica el esquema y carga el catálogo. El arranque también actualiza el catálogo si cambia su versión, conservando avances.

Si el sistema no encuentra Python, crea `local/.env`:

```dotenv
PYTHON_BIN=/ruta/a/python3
PORT=3000
DATABASE_FILE=data/habla.db
```

En Windows puedes usar una ruta absoluta al ejecutable. En un equipo con Anaconda en su ubicación habitual, el servidor intenta detectarlo. No hacen falta claves de API para practicar con esta edición.

### Scripts locales

| Comando, desde `local/` | Uso |
| --- | --- |
| `npm run setup` | Crear o actualizar esquema y contenido sin borrar progreso |
| `npm start` | Iniciar el servidor local |
| `npm run dev` | Iniciar con `node --watch` |
| `npm test` | Ejecutar pruebas con bases temporales |
| `npm run verify:curriculum` | Comprobar soluciones y plantillas del currículo |
| `npm run db:reset -- --yes` | Borrar la base y reiniciar una instalación de prueba |

**`db:reset` destruye todo el progreso de la base configurada.** Una actualización de contenido no requiere ese comando. Antes de trasladar el progreso local a otro ordenador, conserva la base SQLite con una copia coherente; copiar únicamente el código no conserva los perfiles.

## Verificación

Los controles de la web cubren acceso a todas las lecciones, estados dañados, fallos de persistencia, ejecución de soluciones, alternativas válidas, borradores, continuidad entre contextos, autorización del creador y consentimiento. Las pruebas del navegador usan el perfil ficticio local y algunas guardan respuestas de ejemplo: ejecútalas en serie sobre una base de desarrollo, nunca contra la demo con usuarios reales.

Con el servidor de desarrollo iniciado y la base de vista previa preparada, ejecuta desde la raíz:

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Las pruebas del backend utilizan `node:sqlite` en memoria para simular la interfaz D1; no necesitan el servidor ni una base con perfiles. La comprobación estática fija el hash y los tamaños del catálogo final, revisa la sintaxis JavaScript y verifica que los controles de navegador rechacen destinos ajenos a loopback.

Playwright está declarado como dependencia de desarrollo. El comando de instalación descarga Chromium para las comprobaciones; no es necesario para usar la aplicación. `test:browser` ejecuta los cuatro controles de forma secuencial y se detiene si falla uno.

`HABLA_TEST_URL` cambia el origen de la vista previa, por defecto `http://127.0.0.1:5173`. Solo admite `localhost`, `127.0.0.1` o `[::1]`, sin rutas, credenciales, parámetros ni fragmentos. Por ejemplo, para otro puerto:

```sh
HABLA_TEST_URL=http://127.0.0.1:5175 npm run test:browser
```

En PowerShell, establece la variable antes del comando:

```powershell
$env:HABLA_TEST_URL = 'http://127.0.0.1:5175'
npm run test:browser
```

De forma opcional, `HABLA_BROWSER_CHANNEL=msedge` usa una instalación compatible de Microsoft Edge en lugar del Chromium descargado. En PowerShell: `$env:HABLA_BROWSER_CHANNEL = 'msedge'`. `HABLA_BROWSER_EXECUTABLE` permite indicar un ejecutable concreto y tiene prioridad sobre el canal.

### Verificación de la publicación

Ejecutada el **4 de octubre de 2026**, con Windows y Node.js **24.19.0**. Los flujos web se ejecutaron secuencialmente sobre D1 local, con un perfil ficticio, Microsoft Edge en modo headless y Playwright **1.62.1**. La edición local utilizó Python **3.12** y el controlador integrado `node:sqlite`.

| Comprobación | Resultado |
| --- | --- |
| `npm ci`, raíz y `local/` | Instalación completa desde ambos lockfiles |
| `npm run build` | Compilación web correcta |
| `npm test`, raíz | Catálogo final íntegro; sintaxis de 50 archivos JS; acceso libre a 72 lecciones; autorización y privacidad del creador |
| `npm run lint` | 0 errores; 5 advertencias heredadas en módulos DOM |
| `npm run test:browser` | Cuatro controles correctos; 265 modelos ejecutables, 199 soluciones distintas y 14 alternativas verificadas |
| Navegación web | Borradores recuperados, XP idempotente, fallos de guardado recuperables y panel con consentimiento |
| Interfaz web | Teclado, ausencia de desbordamiento a 320–1920 px, contraste sobre fondos sólidos y movimiento reducido |
| `npm test`, `local/` | 79 pruebas, 14 suites, 0 fallos |
| `npm run verify:curriculum`, `local/` | 198 programas, 596 casos y 66 plantillas de depuración; sin fallos |

CI ejecuta las comprobaciones estáticas y de API, lint, compilación web y la suite y el catálogo locales en Ubuntu con Node.js 24 y Python 3.12. Las pruebas de navegador se ejecutan por separado con la vista previa y Chromium o el canal configurado.

Las pruebas locales están en `local/tests/`: autenticación, aislamiento, calificación, persistencia, recorrido, repasos, rachas y ejercicios de programación. Sus bases temporales mantienen los controles separados de los perfiles reales.

Una comprobación de contraste o de ancho de ventana no demuestra accesibilidad completa. Tampoco un test funcional demuestra resistencia del intérprete a código hostil: consulta el alcance de [SECURITY.md](../SECURITY.md).

## Modificar contenido

El currículo final consumido por la web está en `app/curriculum.json`. Los scripts de revisión y exportación mantienen instrucciones, casos y referencias. Las fuentes locales están en `local/db/content/`.

Conserva los IDs de las lecciones y ejercicios que ya tengan avances guardados. Un cambio del contenido debe revisar el resultado esperado, las alternativas válidas y el contrato que ve el alumno. La exportación no debe depender de una base de datos con perfiles reales.

## Archivos que deben permanecer privados

No versiones `.env`, `.dev.vars`, tokens, cookies, perfiles de navegador, archivos SQLite de usuarios, backups, estado de Wrangler o capturas con datos reales. Las imágenes de `docs/images/` deben mostrar datos ficticios de la vista previa. `node_modules/`, `dist/` y estados de ejecución se generan a partir del código.
