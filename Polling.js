const config = require('./Config');
const { consultarEstado } = require('./Api');

let timer = null;
let backoffMs = config.POLLING_INTERVALO_SEG * 1000;
let offline = false;
let active = false;

function scheduleNext(delay) {
  clearTimeout(timer);
  timer = setTimeout(() => tick(), delay);
}

async function tick() {
  if (!active) return;

  try {
    const estado = await consultarEstado(PollingAgent.windowsUsername);
    if (estado) {
      offline = false;
      backoffMs = config.POLLING_INTERVALO_SEG * 1000;
      PollingAgent.onEstado(estado);
    } else {
      if (!offline) {
        console.warn('[polling] Estado OFFLINE. Reduciendo frecuencia de consultas.');
      }
      offline = true;
      backoffMs = Math.min(backoffMs * 2, 5 * 60 * 1000);
    }
  } catch (err) {
    console.warn('[polling] Error inesperado en tick:', err.message || err);
    offline = true;
    backoffMs = Math.min(backoffMs * 2, 5 * 60 * 1000);
  } finally {
    if (!active) return;
    const delay = offline ? backoffMs : config.POLLING_INTERVALO_SEG * 1000;
    scheduleNext(delay);
  }
}

const PollingAgent = {
  windowsUsername: null,
  onEstado: null,
  start(windowsUsername, onEstado) {
    this.windowsUsername = windowsUsername;
    this.onEstado = onEstado;
    if (active) return;
    active = true;
    backoffMs = config.POLLING_INTERVALO_SEG * 1000;
    offline = false;
    tick();
  },
  stop() {
    active = false;
    clearTimeout(timer);
  },
};

module.exports = PollingAgent;
