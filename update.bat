@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ========================================
echo   AI Media Tools - Update
echo ========================================
echo.

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

echo [1/1] git pull...
git pull --ff-only
if errorlevel 1 (
  echo [ERROR] git pull failed. Resolve conflicts and retry.
  pause
  exit /b 1
)

echo.
echo Update done. Run start.bat to apply changes.
echo.
pause
