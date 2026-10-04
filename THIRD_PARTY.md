# Código y recursos de terceros

HABLA incluye código propio de la aplicación, su currículo y pruebas, junto con infraestructura y componentes de código abierto. La licencia MIT de la aplicación conserva la licencia declarada en la edición local original; no sustituye las licencias de las dependencias.

- **Vinext, React, Next.js y Cloudflare**: infraestructura de interfaz, compilación y ejecución web. Las versiones utilizadas están fijadas en `package-lock.json`.
- **Starter de Sites**: helpers de compilación, desarrollo y autenticación. Se conserva su aviso MIT en `build/sites-vite-plugin.LICENSE`.
- **shadcn y bibliotecas de interfaz**: componentes incluidos bajo `components/` y estilos. Se conserva el aviso de los estilos vendorizados en `vendor/shadcn-tailwind-4.13.0.LICENSE.md`.
- **Pyodide**: Python y SQLite en el navegador, cargados desde su distribución pública. La aplicación no redistribuye una copia del intérprete en este repositorio.
- **Express, better-sqlite3 y demás dependencias de la edición local**: versiones y licencias distribuidas por sus respectivos paquetes npm.

La estructura y los helpers heredados se distinguen de la lógica de HABLA en [la arquitectura](docs/ARCHITECTURE.md). Este repositorio presenta el producto y sus decisiones técnicas sin atribuirse la autoría de las bibliotecas o del starter.
