@echo off
setlocal

set PROJECT_PATH=\\wsl.localhost\Ubuntu-24.04\home\sylvansky\dev\samplepad4-editor
set LOCAL_BUILD=%TEMP%\samplepad4-editor-build

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install with: winget install OpenJS.NodeJS.LTS
  exit /b 1
)

if not exist "%PROJECT_PATH%" (
  echo Could not find project path: %PROJECT_PATH%
  exit /b 1
)

if exist "%LOCAL_BUILD%" rmdir /s /q "%LOCAL_BUILD%"
mkdir "%LOCAL_BUILD%"

echo Staging project to local build folder...
robocopy "%PROJECT_PATH%" "%LOCAL_BUILD%" /MIR /XD node_modules dist .git >nul
if errorlevel 8 (
  echo Failed staging project with robocopy.
  exit /b 1
)

pushd "%LOCAL_BUILD%"
if errorlevel 1 (
  echo Could not switch to local build path: %LOCAL_BUILD%
  exit /b 1
)

echo Installing dependencies...
call npm.cmd install
if errorlevel 1 goto :fail

echo Building Windows installer...
call npm.cmd run dist:win
if errorlevel 1 goto :fail

echo Copying dist output back to source project...
if not exist "%PROJECT_PATH%\dist" mkdir "%PROJECT_PATH%\dist"
robocopy "%LOCAL_BUILD%\dist" "%PROJECT_PATH%\dist" /E >nul
if errorlevel 8 goto :fail

echo Build completed. Check %PROJECT_PATH%\dist for the installer.
popd
exit /b 0

:fail
echo Build failed.
popd
exit /b 1
