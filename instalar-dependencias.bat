@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
 echo ERRO: Node.js/npm nao encontrado.
 pause
 exit /b 1
)
echo Instalando versao disponivel do MediaPipe...
call npm install --no-save --no-audit --no-fund @mediapipe/tasks-vision@latest
if errorlevel 1 (
 echo ERRO: npm falhou. Verifique a rede ou o registro npm.
 pause
 exit /b 1
)
if not exist "node_modules\@mediapipe\tasks-vision\vision_bundle.mjs" (
 echo ERRO: vision_bundle.mjs nao encontrado no pacote.
 pause
 exit /b 1
)
if not exist "vendor" mkdir "vendor"
if not exist "vendor\wasm" mkdir "vendor\wasm"
copy /Y "node_modules\@mediapipe\tasks-vision\vision_bundle.mjs" "vendor\vision_bundle.mjs" >nul
xcopy /E /I /Y "node_modules\@mediapipe\tasks-vision\wasm\*" "vendor\wasm\" >nul
if errorlevel 1 (
 echo ERRO: nao foi possivel copiar os arquivos WASM.
 pause
 exit /b 1
)
if not exist "vendor\hand_landmarker.task" (
 echo Baixando modelo de reconhecimento...
 powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' -OutFile 'vendor/hand_landmarker.task' -ErrorAction Stop; exit 0 } catch { Write-Host $_; exit 1 }"
 if errorlevel 1 (
  echo ERRO: download do modelo falhou. Tente em outra rede.
  pause
  exit /b 1
 )
)
if not exist "vendor\hand_landmarker.task" (
 echo ERRO: arquivo do modelo ausente.
 pause
 exit /b 1
)
echo.
echo INSTALACAO CONCLUIDA. Abra index.html pelo Live Server.
pause
