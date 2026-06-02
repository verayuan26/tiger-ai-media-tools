@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ========================================
echo   AI Media Tools - Update
echo ========================================
echo.

call :ENSURE_NODE
if errorlevel 1 (
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git not found: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] Not a git repo. Clone the project first.
  pause
  exit /b 1
)

echo [1/4] git pull...
git pull --ff-only
if errorlevel 1 (
  echo [ERROR] git pull failed. Resolve conflicts and retry.
  pause
  exit /b 1
)
echo.

echo [2/4] npm install...
if exist "node_modules" (
  rmdir /s /q "node_modules" 2>nul
)
call npm install --no-bin-links
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo.

echo [3/4] Building...
call "node_modules\.bin\tsc.cmd" --noEmit
if errorlevel 1 (
  echo [ERROR] Typecheck failed.
  pause
  exit /b 1
)

call "node_modules\.bin\vite.cmd" build
if errorlevel 1 (
  echo [ERROR] Vite build failed.
  pause
  exit /b 1
)
echo.

echo [4/4] Update done.
echo   Run start.bat to launch. URL: http://127.0.0.1:8787
echo.
pause
goto :EOF

:ENSURE_NODE
call :LOAD_NODE_PATH
where node >nul 2>&1
if not errorlevel 1 exit /b 0
set "PROJECT_ROOT=%~dp0"
if "!PROJECT_ROOT:~-1!"=="\" set "PROJECT_ROOT=!PROJECT_ROOT:~0,-1!"
powershell -NoProfile -ExecutionPolicy Bypass -File "!PROJECT_ROOT!\scripts\install-node-windows.ps1" -ProjectRoot "!PROJECT_ROOT!"
if errorlevel 1 exit /b 1
call :LOAD_NODE_PATH
where node >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:LOAD_NODE_PATH
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%AppData%\npm;%PATH%"
if exist "%~dp0.tools\node\node.exe" set "PATH=%~dp0.tools\node;%PATH%"
if exist "%~dp0.tools\node-path.txt" (
  set /p "NODE_HOME=" < "%~dp0.tools\node-path.txt"
  if defined NODE_HOME set "PATH=!NODE_HOME!;%PATH%"
)
exit /b 0
