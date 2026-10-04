@echo off
rem Stop only the server started by Habla.cmd from this checkout.
rem Keep this file in ASCII for cmd.exe compatibility.
setlocal
set "HABLA_SERVER_PATH=%~dp0server\server.js"
powershell -NoProfile -Command "$servers = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($env:HABLA_SERVER_PATH) }); if ($servers.Count -eq 0) { Write-Host 'No se encontro un servidor iniciado por Habla.cmd en esta carpeta. Si usas npm start, pulsa Ctrl+C en su terminal.' } else { foreach ($server in $servers) { Stop-Process -Id $server.ProcessId; Write-Host ('Servidor HABLA detenido: ' + $server.ProcessId) } }"
endlocal
