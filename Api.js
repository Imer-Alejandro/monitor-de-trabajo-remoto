// api.js - Comunicación con el servidor corporativo
const axios = require('axios');
const config = require('./Config');   // <- sin .js

const cliente = axios.create({
  baseURL: config.SERVER_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

async function consultarEstado(windowsUsername) {
  try {
    const res = await cliente.get(config.RUTAS.ESTADO, {
      params: { windows_user: windowsUsername },
    });
    return res.data;
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}` : 'Sin conexión';
    console.warn(`[api] consultarEstado falló: ${msg}`);
    return null;
  }
}

async function enviarReporte(reporte) {
  try {
    await cliente.post(config.RUTAS.REPORTE, reporte);
    console.log('[api] Reporte enviado correctamente.');
    return true;
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}` : 'Sin conexión';
    console.warn(`[api] enviarReporte falló: ${msg}`);
    return false;
  }
}

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