// api.js - Comunicación con el servidor corporativo
const axios = require('axios');
const config = require('./Config');

const cliente = axios.create({
  baseURL: config.SERVER_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});
   
/**
 * Consulta el estado de jornada para este usuario.
 * Devuelve null si hay error de red (el agente sigue esperando).
 *
 * Respuesta esperada del servidor:
 * {
 *   estado: 'pendiente' | 'activa' | 'finalizada' | 'sin_jornada',
 *   jornada_id: 12,
 *   hora_inicio: '08:00',
 *   hora_fin: '17:00',
 *   apps_permitidas: ['chrome.exe', 'excel.exe', 'teams.exe']
 * }
 */
async function consultarEstado(windowsUsername) {
  try {
    const res = await cliente.get(config.RUTAS.ESTADO, {
      params: { windows_user: windowsUsername },
    });
    return res.data;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status}`
      : 'Sin conexión';
    console.warn(`[api] consultarEstado falló: ${msg}`);
    return null;
  }
}

/**
 * Envía el reporte final de la jornada.
 * Devuelve true si el servidor lo aceptó, false si hubo error.
 *
 * Body que se envía:
 * {
 *   jornada_id, windows_user,
 *   pct_apps_requeridas, pct_apps_externas,
 *   pct_inactividad, pct_activo_total,
 *   cambios_contexto, duracion_total_seg,
 *   detalle_apps: [{ nombre, segundos, pct }]
 * }
 */
async function enviarReporte(reporte) {
  try {
    await cliente.post(config.RUTAS.REPORTE, reporte);
    console.log('[api] Reporte enviado correctamente.');
    return true;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status}`
      : 'Sin conexión';
    console.warn(`[api] enviarReporte falló: ${msg}`);
    return false;
  }
}

/**
 * Ping liviano para que el servidor sepa que el agente sigue activo.
 * Fallo silencioso — no es crítico.
 */
async function enviarPing(windowsUsername, jornadaId) {
  try {
    await cliente.post(config.RUTAS.PING, {
      windows_user: windowsUsername,
      jornada_id: jornadaId,
    });
  } catch (_) {
    // silencioso
  }
}

module.exports = { consultarEstado, enviarReporte, enviarPing };