// config.js - Configuración central del agente
// Editar SERVER_URL antes de distribuir el .exe

const config = {
  // URL base del servidor corporativo
  SERVER_URL: 'https://tu-servidor.com',

  // Cada cuántos segundos consulta si hay jornada activa (modo espera)
  POLLING_INTERVALO_SEG: 30,

  // Cada cuántos segundos captura actividad (modo monitoreo)
  CAPTURA_INTERVALO_SEG: 5,

  // Segundos de inactividad de periféricos para considerar al usuario inactivo
  UMBRAL_IDLE_SEG: 300, // 5 minutos

  // Rutas de la API
  RUTAS: {
    ESTADO:  '/api/jornada/estado',
    REPORTE: '/api/jornada/reporte',
    PING:    '/api/jornada/ping',
  },
};

module.exports = config;