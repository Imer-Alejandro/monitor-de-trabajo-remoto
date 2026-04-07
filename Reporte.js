const db = require('./Db');
const config = require('./Config');
const { enviarReporte } = require('./Api');

function parseTimestamp(isoString) {
  return new Date(isoString);
}

function calcularDuracionTotalSeg(logs) {
  if (!logs.length) return 0;
  const timestamps = logs.map(log => parseTimestamp(log.timestamp).getTime()).sort((a, b) => a - b);
  const primer = timestamps[0];
  const ultimo = timestamps[timestamps.length - 1];
  return Math.max(config.CAPTURA_INTERVALO_SEG, Math.round((ultimo - primer) / 1000) + config.CAPTURA_INTERVALO_SEG);
}

function agruparPorApp(logs) {
  const resumen = new Map();
  for (const log of logs) {
    const app = log.app_activa || 'desconocido';
    const actual = resumen.get(app) || { segundos: 0, eventos: 0 };
    actual.segundos += config.CAPTURA_INTERVALO_SEG;
    actual.eventos += 1;
    resumen.set(app, actual);
  }
  return Array.from(resumen.entries()).map(([nombre, data]) => ({
    nombre,
    segundos: data.segundos,
    pct: 0,
  }));
}

function calcularReporte(jornadaId, windowsUsername) {
  const logs = db.getLogsPorJornada(jornadaId);
  const duracionTotalSeg = calcularDuracionTotalSeg(logs);
  const totalRequeridoSeg = logs.filter(log => log.es_requerida === 1).length * config.CAPTURA_INTERVALO_SEG;
  const totalExternasSeg = logs.filter(log => log.activo === 1 && log.es_requerida === 0).length * config.CAPTURA_INTERVALO_SEG;
  const totalInactivoSeg = logs.filter(log => log.activo === 0).length * config.CAPTURA_INTERVALO_SEG;
  const totalActivoSeg = duracionTotalSeg - totalInactivoSeg;

  const detalleApps = agruparPorApp(logs).map(app => ({
    ...app,
    pct: duracionTotalSeg > 0 ? Number(((app.segundos / duracionTotalSeg) * 100).toFixed(1)) : 0,
  }));

  return {
    jornada_id: jornadaId,
    windows_user: windowsUsername,
    pct_apps_requeridas: duracionTotalSeg > 0 ? Number(((totalRequeridoSeg / duracionTotalSeg) * 100).toFixed(1)) : 0,
    pct_apps_externas: duracionTotalSeg > 0 ? Number(((totalExternasSeg / duracionTotalSeg) * 100).toFixed(1)) : 0,
    pct_inactividad: duracionTotalSeg > 0 ? Number(((totalInactivoSeg / duracionTotalSeg) * 100).toFixed(1)) : 0,
    pct_activo_total: duracionTotalSeg > 0 ? Number(((totalActivoSeg / duracionTotalSeg) * 100).toFixed(1)) : 0,
    cambios_contexto: Number(db.get('cambios_contexto') || '0'),
    duracion_total_seg: duracionTotalSeg,
    detalle_apps: detalleApps,
  };
}

async function generarYEnviarReporte(jornadaId, windowsUsername) {
  const reporte = calcularReporte(jornadaId, windowsUsername);
  const ok = await enviarReporte(reporte);
  db.set('reporte_enviado', ok ? '1' : '0');
  return ok;
}

module.exports = { calcularReporte, generarYEnviarReporte };
