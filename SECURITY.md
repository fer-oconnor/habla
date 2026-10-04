# Seguridad y privacidad

HABLA es una aplicación de autoaprendizaje. La versión web y la edición local tienen modelos de confianza distintos; las restricciones del corrector no sustituyen una frontera de seguridad del sistema operativo.

## Web final

- Python y SQL se ejecutan mediante Pyodide en un Web Worker del navegador del alumno. El código no se ejecuta en el servidor y no puede consultar D1 a través del laboratorio.
- El corrector limita importaciones, atributos, operaciones, tamaños y tiempo. SQL usa bases en memoria, sin adjuntar bases ni cargar extensiones. El módulo del navegador termina el Worker si una ejecución excede el límite.
- El backend valida los resultados reportados frente a referencias del catálogo, pero el cliente puede manipular su propio código y sus resultados. No uses esta evaluación para certificar conocimientos o tomar decisiones de selección sin controles adicionales.
- La autenticación depende de las cabeceras verificadas que proporciona Sites. Un despliegue fuera de esa infraestructura necesita una autenticación real y no debe confiar en cabeceras enviadas por el visitante.
- Los intentos se consultan con su propietario. Las mutaciones comprueban el origen y utilizan revisión optimista y lotes D1 atómicos.

La primera carga del laboratorio usa el CDN de Pyodide; la web requiere conexión para autenticación, API y guardado. El Worker ejecuta en el dispositivo del alumno: sus límites reducen bloqueos accidentales, pero no garantizan un consumo de recursos nulo.

## Privacidad de perfiles

D1 conserva información personal del perfil, respuestas, borradores y avance. Un alumno accede a sus registros mediante su identidad. No se publican estas bases, sesiones o registros en el repositorio.

El panel del creador requiere el secreto `HABLA_OWNER_USER_ID` y una identidad verificada coincidente. Si falta el secreto, rechaza el acceso. Solo incluye participantes que hayan aceptado compartir con la versión vigente del aviso.

El resumen compartido incluye nombre de perfil, lecciones completadas por curso, respuestas/aciertos agregados, XP y última actividad. El panel no muestra el correo, respuestas individuales ni código escrito. Se puede retirar la elección desde Perfil manteniendo el progreso y el acceso al curso.

La práctica temporal cuando falla el guardado no concede XP ni se sincroniza después. Una base ilegible no se reinicia automáticamente.

## Edición local

La edición `local/` escucha en loopback. Cada ejecución crea un proceso Python con `-I -S`, tiempo máximo, límite de salida y restricciones del lenguaje. Los archivos de los ejercicios son virtuales y SQLite se limita a memoria en el laboratorio.

**No está preparada para servir ejecución de código arbitrario a usuarios de internet.** No expongas este servidor local a peticiones hostiles basándote únicamente en el filtrado AST, una lista de atributos o un proceso separado. Un servicio de esa clase necesita aislamiento y controles adicionales diseñados para ese escenario.

Las cuentas locales guardan contraseñas derivadas con `scrypt` y sal aleatoria. Las sesiones y el progreso viven en SQLite. El archivo `local/data/habla.db` y cualquier backup pueden contener información personal y deben permanecer privados. `db:reset -- --yes` elimina los datos de la base configurada.

## Notificación de un problema

No publiques contraseñas, tokens, datos de usuarios ni un procedimiento de explotación en un issue abierto. Si GitHub muestra la opción de **notificar una vulnerabilidad de forma privada**, úsala. Si no está disponible, abre un issue sin detalles sensibles para solicitar un canal privado.

Incluye la edición afectada, el comportamiento esperado, el impacto y una reproducción con datos ficticios. No pruebes fallos sobre perfiles de otras personas ni ejecutes controles que modifiquen la demo de producción.
