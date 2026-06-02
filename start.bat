@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

if /i "%~1"=="--local-run" goto MAIN

if /i "%AI_MEDIA_LOCAL_WORKSPACE%"=="1" goto USE_LOCAL_WORKSPACE

echo %CD%| findstr /i /c:"C:\Mac\Home" >nul
if errorlevel 1 goto MAIN

set "PROJECT_SOURCE=%~dp0"
if "!PROJECT_SOURCE:~-1!"=="\" set "PROJECT_SOURCE=!PROJECT_SOURCE:~0,-1!"

set "LOCAL_WS=%LOCALAPPDATA%\ai-media-tools\workspace"

:USE_LOCAL_WORKSPACE
if not defined PROJECT_SOURCE (
  set "PROJECT_SOURCE=%~dp0"
  if "!PROJECT_SOURCE:~-1!"=="\" set "PROJECT_SOURCE=!PROJECT_SOURCE:~0,-1!"
)
set "LOCAL_WS=%LOCALAPPDATA%\ai-media-tools\workspace"

echo.
echo [INFO] Using Windows local workspace for npm.
echo        Source: !PROJECT_SOURCE!
echo        Workspace: !LOCAL_WS!
echo.

set "PROJECT_ROOT=!PROJECT_SOURCE!"
if "!PROJECT_ROOT:~-1!"=="\" set "PROJECT_ROOT=!PROJECT_ROOT:~0,-1!"
powershell -NoProfile -ExecutionPolicy Bypass -File "!PROJECT_ROOT!\scripts\sync-windows-workspace.ps1" -SourceRoot "!PROJECT_SOURCE!" -LocalRoot "!LOCAL_WS!"
if errorlevel 1 (
  echo [ERROR] Sync to local workspace failed.
  pause
  exit /b 1
)

cmd /c ""!LOCAL_WS!\start.bat" --local-run "!PROJECT_SOURCE!""
set "EXIT_CODE=!errorlevel!"
pause
exit /b !EXIT_CODE!

:MAIN
if /i "%~1"=="--local-run" (
  set "PROJECT_SOURCE=%~2"
  if "!PROJECT_SOURCE:~-1!"=="\" set "PROJECT_SOURCE=!PROJECT_SOURCE:~0,-1!"
  set "AI_MEDIA_DATA_DIR=!PROJECT_SOURCE!\.data"
  cd /d "%LOCALAPPDATA%\ai-media-tools\workspace"
  if errorlevel 1 (
    echo [ERROR] Local workspace missing. Run start.bat from the Mac share once to sync.
    exit /b 1
  )
  echo.
  echo ========================================
  echo   AI Media Tools - Start [local copy]
  echo ========================================
  echo   Source: !PROJECT_SOURCE!
  echo   Data:   !AI_MEDIA_DATA_DIR!
  echo.
) else (
  echo.
  echo ========================================
  echo   AI Media Tools - Start
  echo ========================================
  echo.
)

call :ENSURE_NODE
if errorlevel 1 (
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Reinstall Node.js.
  pause
  exit /b 1
)

where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo [WARN] ffmpeg not in PATH. Video/audio features may fail.
  echo        https://ffmpeg.org/download.html
  echo.
)

call :ENSURE_DEPS
if errorlevel 1 (
  pause
  exit /b 1
)

call :ENSURE_ENV
if errorlevel 1 (
  pause
  exit /b 1
)

echo [3/4] Building...
call :RUN_BUILD
if errorlevel 1 (
  pause
  exit /b 1
)
echo.

set "APP_PORT=8787"
if exist ".env" (
  for /f "usebackq tokens=2 delims==" %%P in (`findstr /b /i "AI_MEDIA_PORT=" ".env" 2^>nul`) do (
    set "APP_PORT=%%P"
  )
)
set "APP_PORT=!APP_PORT: =!"
if "!APP_PORT!"=="" set "APP_PORT=8787"
set "APP_URL=http://127.0.0.1:!APP_PORT!"

set "ROOT_DIR=%CD%"
if "!ROOT_DIR:~-1!"=="\" set "ROOT_DIR=!ROOT_DIR:~0,-1!"

echo [4/4] Starting server...
echo   URL: !APP_URL!
echo   Logs: window titled "AI Media Server"
echo.

if defined AI_MEDIA_DATA_DIR (
  start "AI Media Server" /D "!ROOT_DIR!" cmd /k "set AI_MEDIA_DATA_DIR=!AI_MEDIA_DATA_DIR!&& set PATH=!PATH!&& npm run start"
) else (
  start "AI Media Server" /D "!ROOT_DIR!" cmd /k "set PATH=!PATH!&& npm run start"
)

echo Waiting for server, then opening browser...
set /a WAIT_SEC=0

:WAIT_FOR_SERVER
timeout /t 1 /nobreak >nul
set /a WAIT_SEC+=1

powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', !APP_PORT!); $c.Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 goto OPEN_BROWSER

if !WAIT_SEC! lss 90 goto WAIT_FOR_SERVER

echo [WARN] Timeout waiting for port !APP_PORT!. Will open browser anyway.
echo.

:OPEN_BROWSER
echo Launching browser: !APP_URL!
start "" "!APP_URL!"

echo.
echo ========================================
echo   Ready
echo ========================================
echo   Browser: !APP_URL!
echo   Stop: close the "AI Media Server" window.
if defined PROJECT_SOURCE (
  echo   Code synced from: !PROJECT_SOURCE!
  echo   Re-run start.bat on Mac share after code changes.
)
echo.
if /i not "%~1"=="--local-run" pause
goto :EOF

:ENSURE_DEPS
call :LOAD_NODE_PATH

call :VERIFY_DEPS
if not errorlevel 1 (
  echo [1/4] Dependencies OK.
  echo.
  exit /b 0
)

echo [1/4] Repairing optional native packages...
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\install-windows-optional-natives.ps1" -ProjectRoot "%CD%"
call :VERIFY_DEPS
if not errorlevel 1 (
  echo [1/4] Dependencies OK after native repair.
  echo.
  exit /b 0
)

echo [1/4] Installing dependencies...

call :CHECK_NODE_X64
if errorlevel 1 (
  echo [ERROR] Node is not x64. Re-run start.bat to install portable Node win-x64.
  exit /b 1
)
for /f "delims=" %%A in ('"%NODE_X64_EXE%" -p process.arch 2^>nul') do set "NODE_ARCH=%%A"
echo        Node arch: !NODE_ARCH!

if exist "node_modules" (
  echo        Cleaning node_modules...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\clean-node-modules.ps1" -ProjectRoot "%CD%"
  if errorlevel 1 exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\npm-install-windows.ps1" -ProjectRoot "%CD%"
if errorlevel 1 (
  echo [ERROR] npm install failed.
  echo        Set AI_MEDIA_LOCAL_WORKSPACE=1 and retry, or install:
  echo        - Python 3.12  -  VS 2022 Build Tools with C++ workload
  exit /b 1
)

call :VERIFY_DEPS
if not errorlevel 1 goto ENSURE_DEPS_DONE

if errorlevel 3 (
  echo [ERROR] better-sqlite3 native module failed to load.
  echo        Install VS Build Tools with C++ workload, then run start.bat again:
  echo        https://visualstudio.microsoft.com/visual-cpp-build-tools/
  exit /b 1
)

echo [ERROR] npm packages missing after install.
exit /b 1

:ENSURE_DEPS_DONE
echo.
exit /b 0

:VERIFY_DEPS
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\verify-windows-deps.ps1" -ProjectRoot "%CD%"
goto :eof

:ENSURE_ENV
if exist ".env" (
  echo [2/4] .env found.
  echo.
  exit /b 0
)

echo [2/4] Creating .env

if exist "scripts\env.defaults" (
  copy /Y "scripts\env.defaults" ".env" >nul
)

if not exist ".env" (
  powershell -NoProfile -Command "Copy-Item -LiteralPath (Join-Path '%CD%' 'scripts\env.defaults') -Destination (Join-Path '%CD%' '.env') -Force"
)

if not exist ".env" (
  echo [ERROR] Could not create .env
  exit /b 1
)

echo.
exit /b 0

:RUN_BUILD
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\run-windows-build.ps1" -ProjectRoot "%CD%"
exit /b %errorlevel%

:ENSURE_NODE
set "NODE_X64=%LOCALAPPDATA%\ai-media-tools\node-x64"
set "NODE_X64_EXE=%NODE_X64%\node.exe"

call :LOAD_NODE_PATH
call :CHECK_NODE_X64
if not errorlevel 1 goto ENSURE_NODE_OK

echo [INFO] Installing Node.js win-x64 for better-sqlite3...
echo        Target: %NODE_X64%
echo.

set "PROJECT_ROOT=%CD%"
if "!PROJECT_ROOT:~-1!"=="\" set "PROJECT_ROOT=!PROJECT_ROOT:~0,-1!"
powershell -NoProfile -ExecutionPolicy Bypass -File "!PROJECT_ROOT!\scripts\install-node-windows.ps1" -ProjectRoot "!PROJECT_ROOT!"
if errorlevel 1 exit /b 1

call :LOAD_NODE_PATH
call :CHECK_NODE_X64
if errorlevel 1 (
  echo [ERROR] Node x64 is not available after install.
  echo        Try: "%NODE_X64_EXE%" -v
  exit /b 1
)

:ENSURE_NODE_OK
if exist "!NODE_X64_EXE!" (
  for /f "delims=" %%V in ('"!NODE_X64_EXE!" -v 2^>nul') do echo [INFO] Node %%V ready at !NODE_X64!
) else (
  for /f "delims=" %%V in ('node -v 2^>nul') do echo [INFO] Node %%V ready
)
exit /b 0

:CHECK_NODE_X64
if not exist "%NODE_X64_EXE%" exit /b 1
set "PATH=%NODE_X64%;%PATH%"
set "NODE_ARCH="
for /f "delims=" %%A in ('"%NODE_X64_EXE%" -p process.arch 2^>nul') do set "NODE_ARCH=%%A"
if /i "!NODE_ARCH!"=="x64" exit /b 0
exit /b 1

:LOAD_NODE_PATH
set "NODE_X64=%LOCALAPPDATA%\ai-media-tools\node-x64"
set "NODE_X64_EXE=%NODE_X64%\node.exe"
if exist "%NODE_X64_EXE%" set "PATH=%NODE_X64%;%PATH%"
if exist "%CD%\.tools\node-path.txt" (
  set /p "NODE_HOME=" < "%CD%\.tools\node-path.txt"
  if defined NODE_HOME set "PATH=!NODE_HOME!;%PATH%"
)
if exist "%~dp0.tools\node\node.exe" set "PATH=%~dp0.tools\node;%PATH%"
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%AppData%\npm;%PATH%"
exit /b 0
