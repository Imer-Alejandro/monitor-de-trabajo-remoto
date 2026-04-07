const activeWin = require('active-win');
const config = require('./Config');
const db = require('./Db');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const IGNORED_APPS = new Set([
  'explorer.exe',
  'taskmgr.exe',
  'lockapp.exe',
  'searchapp.exe',
  'applicationframehost.exe',
  'systemsettings.exe',
  'shellexperiencehost.exe',
]);

let captureTimer = null;
let lastApp = null;
let idleCheckTimer = null;
let cachedIdleTime = 0;

function normalizarApp(appName) {
  if (!appName) return 'desconocido';
  
  // Primero, mapear nombre de ventana a ejecutable
  if (config.APP_NAME_MAPPING[appName]) {
    return config.APP_NAME_MAPPING[appName].toLowerCase();
  }
  
  return appName.toLowerCase();
}

function esAppIgnorada(appName) {
  const nombre = normalizarApp(appName);
  return IGNORED_APPS.has(nombre);
}

function esAppRequerida(appName, appsPermitidas) {
  if (!appsPermitidas || !appsPermitidas.length) return false;
  const nombre = normalizarApp(appName);
  return appsPermitidas.some(app => normalizarApp(app) === nombre);
}

// Obtener tiempo idle de forma asincrónica sin bloquear
async function updateIdleTime() {
  try {
    const { stdout } = await execAsync('powershell -command "try { Add-Type -AssemblyName System.Windows.Forms; $lastInput = [System.Windows.Forms.Control]::LastInputTime; $idleTime = [System.Environment]::TickCount - $lastInput; Write-Output ($idleTime / 1000) } catch { Write-Output 0 }"');
    cachedIdleTime = parseFloat(stdout.trim()) || 0;
  } catch (err) {
    console.warn('[monitor] Error obteniendo idle time:', err.message || err);
    cachedIdleTime = 0; // Asumir activo si falla
  }
}

function startIdleTimeUpdater() {
  updateIdleTime(); // Primera ejecución inmediata
  idleCheckTimer = setInterval(() => {
    updateIdleTime();
  }, config.CAPTURA_INTERVALO_SEG * 1000); // Cada 5 segundos
}

function stopIdleTimeUpdater() {
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
    idleCheckTimer = null;
  }
}

async function capturarActividad(jornadaId, appsPermitidas) {
  const windowInfo = await activeWin();
  const appName = windowInfo?.owner?.name || 'desconocido';
  const esIgnorada = esAppIgnorada(appName);
  const esRequerida = esAppRequerida(appName, appsPermitidas);
  const idleSec = cachedIdleTime; // Usar valor cacheado, no bloquear
  const activo = !esIgnorada && idleSec < config.UMBRAL_IDLE_SEG;

  db.guardarLog({
    jornada_id: jornadaId,
    timestamp: new Date().toISOString(),
    app_activa: appName,
    es_requerida: esRequerida ? 1 : 0,
    activo: activo ? 1 : 0,
    idle_seg: Math.round(idleSec),
  });

  if (lastApp && lastApp !== appName) {
    db.set('cambios_contexto', Number(db.get('cambios_contexto') || '0') + 1);
  }

  lastApp = appName;
}

function iniciar(jornadaId, appsPermitidas) {
  lastApp = null;
  cachedIdleTime = 0;
  db.set('cambios_contexto', '0');

  startIdleTimeUpdater(); // Iniciar actualizador en background

  async function loop() {
    try {
      await capturarActividad(jornadaId, appsPermitidas);
    } catch (err) {
      console.warn('[monitor] Error capturando actividad:', err.message || err);
    } finally {
      captureTimer = setTimeout(loop, config.CAPTURA_INTERVALO_SEG * 1000);
    }
  }

  loop();
}

function detener() {
  if (captureTimer) {
    clearTimeout(captureTimer);
    captureTimer = null;
  }
  stopIdleTimeUpdater();
}

module.exports = { iniciar, detener, normalizarApp };
