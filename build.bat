@echo off
chcp 65001 > nul
title AgenteMonitoreo — Build
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     Agente Monitoreo Remoto — Proceso de Build   ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: ── Verificar que nssm.exe existe en la raíz ─────────────────────────────────
if not exist "nssm.exe" (
    echo [ERROR] No se encontro nssm.exe en la raiz del proyecto.
    echo         Descargalo desde: https://nssm.cc/download
    echo         y coloca nssm.exe junto a este archivo build.bat
    pause
    exit /b 1
)

:: ── Verificar que Inno Setup está instalado ───────────────────────────────────
set ISCC=""
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" (
    set ISCC="%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
)
if %ISCC%=="" (
    echo [ERROR] No se encontro Inno Setup 6.
    echo         Instalalo desde: https://jrsoftware.org/isdl.php
    pause
    exit /b 1
)

:: ── Verificar que pkg está instalado globalmente ──────────────────────────────
where pkg >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] pkg no esta instalado globalmente. Instalando...
    call npm install -g pkg
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar pkg.
        pause
        exit /b 1
    )
)

:: ── Paso 1: Instalar dependencias ────────────────────────────────────────────
echo [1/3] Instalando dependencias npm...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install fallo.
    pause
    exit /b 1
)
echo       OK
echo.

:: ── Paso 2: Empaquetar con pkg ────────────────────────────────────────────────
echo [2/3] Empaquetando con pkg (puede tardar 1-2 minutos)...
if not exist "dist" mkdir dist
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] pkg fallo. Revisa los errores arriba.
    pause
    exit /b 1
)
echo       OK — dist\AgenteMonitoreo.exe generado
echo.

:: ── Paso 3: Generar instalador con Inno Setup ────────────────────────────────
echo [3/3] Generando instalador con Inno Setup...
%ISCC% "AgenteMonitoreo.iss"
if %errorlevel% neq 0 (
    echo [ERROR] Inno Setup fallo. Revisa AgenteMonitoreo.iss
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║   Build completado exitosamente                  ║
echo ╠══════════════════════════════════════════════════╣
echo ║   Instalador: dist\InstalarAgenteMonitoreo.exe   ║
echo ╚══════════════════════════════════════════════════╝
echo.
pause