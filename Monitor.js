const activeWin = require('active-win');
const config = require('./Config');
const db = require('./Db');

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

function normalizarApp(appName) {
  if (!appName) return 'desconocido';
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

async function capturarActividad(jornadaId, appsPermitidas) {
  const windowInfo = await activeWin();
  const appName = windowInfo?.owner?.name || 'desconocido';
  const activo = !esAppIgnorada(appName) && appName !== 'desconocido';
  const esRequerida = esAppRequerida(appName, appsPermitidas);
  const idleSeg = activo ? 0 : config.CAPTURA_INTERVALO_SEG;

  db.guardarLog({
    jornada_id: jornadaId,
    timestamp: new Date().toISOString(),
    app_activa: appName,
    es_requerida: esRequerida ? 1 : 0,
    activo: activo ? 1 : 0,
    idle_seg: idleSeg,
  });

  if (lastApp && lastApp !== appName) {
    db.set('cambios_contexto', Number(db.get('cambios_contexto') || '0') + 1);
  }

  lastApp = appName;
}

function iniciar(jornadaId, appsPermitidas) {
  lastApp = null;
  db.set('cambios_contexto', '0');

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
}

module.exports = { iniciar, detener };
