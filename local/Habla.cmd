@echo off
rem Keep this launcher in ASCII for cmd.exe compatibility.
setlocal
cd /d "%~dp0"

if /i "%~1"=="/web" (
  start "" "https://habla-python-sql.fernandino.chatgpt.site"
  exit /b 0
)

title HABLA - edicion local
where node >nul 2>&1
if errorlevel 1 (
  echo Instala Node.js 22.13 o superior y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo No se encuentra npm. Revisa la instalacion de Node.js.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando las dependencias de esta copia...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm run setup
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo HABLA local: abre la direccion que muestre el servidor.
echo Manten esta ventana abierta. Ctrl+C detiene el servidor.
echo El progreso se guarda aqui y no se sincroniza con la demo.
echo.
node "%~dp0server\server.js"
endlocal
