// config.js - Configuración central del agente
// Editar SERVER_URL antes de distribuir el .exe

const config = {
  // URL base del servidor corporativo
  SERVER_URL: 'http://localhost:9000/',

  // Cada cuántos segundos consulta si hay jornada activa (modo espera)
  POLLING_INTERVALO_SEG: 30,

  // Cada cuántos segundos captura actividad (modo monitoreo)
  CAPTURA_INTERVALO_SEG: 5,

  // Segundos de inactividad de periféricos para considerar al usuario inactivo
  UMBRAL_IDLE_SEG: 100, // 5 minutos

  // Rutas de la API
  RUTAS: {
    ESTADO:  '/api/jornada/estado',
    REPORTE: '/api/jornada/reporte',
    PING:    '/api/jornada/ping',
  },

  // Mapeo de nombres de apps mostrados por active-win a nombres ejecutables
  APP_NAME_MAPPING: {
    'Microsoft Excel': 'excel.exe',
    'Microsoft Outlook': 'outlook.exe',
    'Microsoft Edge': 'edge.exe',
    'Google Chrome': 'chrome.exe',
    'Visual Studio Code': 'code.exe',
    'VS Code': 'code.exe',
    'Microsoft Teams': 'teams.exe',
    'Mozilla Firefox': 'firefox.exe',
    'Notepad': 'notepad.exe',
    'Slack': 'slack.exe',
    'Discord': 'discord.exe',
  },
};

module.exports = config;