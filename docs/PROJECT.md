# Proyecto y decisiones de producto

HABLA parte de una pregunta concreta: ¿cómo ayudar a una persona a practicar Python y SQL sin que tenga que preparar un entorno antes de entender su primera línea de código?

La respuesta es una aplicación en español que une currículo, ejecución, feedback y continuidad. Cada lección tiene un objetivo pequeño, ocho ejercicios y una combinación de reconocimiento, razonamiento, escritura y depuración. El estudiante ve las entradas y los resultados esperados para entender qué se le pide, puede experimentar antes de enviar y recibe una explicación cuando comprueba su respuesta.

## El producto final

La raíz del repositorio corresponde a HABLA Studio, la experiencia web final. Sus dos cursos suman 24 unidades, 72 lecciones y 576 ejercicios; 265 tienen un editor de código. Python llega hasta proyectos que procesan datos y usan SQLite, y SQL llega hasta ventanas, transacciones, índices e informes.

El recorrido está abierto: terminar una lección nunca es requisito para abrir otra. La recomendación sigue el orden del curso, pero un alumno que ya conoce un tema puede saltarlo. Un intento reciente puede retomarse por separado, con respuestas y borradores guardados.

XP, metas, rachas y logros muestran actividad y continuidad. No se presentan como pruebas de eficacia educativa; el proyecto no publica resultados de aprendizaje medidos ni cifras de usuarios que no se hayan recogido.

## Problemas resueltos y compromisos

| Problema | Decisión | Compromiso |
| --- | --- | --- |
| Instalar Python antes de empezar crea fricción | Ejecutar Python y SQLite con Pyodide en el navegador | Primera descarga y dependencia de WebAssembly/CDN |
| Memorizar una solución no demuestra comprensión | Comparar resultados sobre varios casos | Los casos son finitos y el cliente puede manipular sus resultados |
| Perder un borrador interrumpe la práctica | Guardar borradores e intentos en D1 | El guardado necesita una API disponible |
| Dos dispositivos pueden pisar el avance | Revisión optimista, lote atómico e idempotencia | Los conflictos persistentes requieren reintentar |
| Un avance corrupto no debería inutilizar el curso | Lectura defensiva y práctica temporal | Una ronda temporal no se sincroniza después |
| Una recomendación puede convertirse en un bloqueo | Acceso libre a todas las lecciones | El alumno debe decidir si necesita repasar fundamentos |
| El creador necesita una visión del aprendizaje | Resumen opcional autorizado en el servidor | Solo representa a quienes eligen compartirlo |
| La instalación original ya tiene perfiles | Mantener una edición local independiente | No hay sincronización automática con el perfil web |

## Qué permite revisar este repositorio

El proyecto muestra la conexión entre decisiones de producto y código: editor y corrector, modelo persistente, privacidad por usuario, actualizaciones concurrentes, recuperación ante fallos y diseño adaptable. La documentación enlaza los módulos que implementan cada decisión y conserva los controles de calidad para que las afirmaciones se puedan inspeccionar.

También expone compromisos existentes: una interfaz DOM integrada en una capa React, estado de perfil agrupado en JSON y lógica web concentrada en un backend con verificación de tipos parcial. Son decisiones visibles que pueden discutirse y evolucionar; no se ocultan bajo una descripción genérica de tecnologías.

## Estado y oportunidades de evolución

La demo y el currículo final están disponibles. La edición local conserva su propio modelo de sesión y progreso. La publicación del código excluye bases personales, backups, estados del navegador y secretos.

Posibles siguientes pasos, **no funciones ya implementadas**:

- Separar el backend en servicios y reforzar contratos de tipos.
- Añadir una migración explícita y consentida entre progreso local y web.
- Ampliar comprobaciones con lectores de pantalla y dispositivos físicos.
- Medir aprendizaje y usabilidad con un estudio antes de afirmar impacto educativo.
- Definir un modelo de aislamiento adicional si se necesitara ejecutar código remoto fuera del navegador.

La [arquitectura](ARCHITECTURE.md), la [guía de desarrollo](DEVELOPMENT.md) y el [modelo de seguridad](../SECURITY.md) completan esta lectura del proyecto.
