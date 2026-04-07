// index.js - Punto de entrada del agente
// Se ejecuta en segundo plano como servicio Windows

const config      = require('./Config');
const db          = require('./Db');
const { getIdentidad }    = require('./Identidad');
const { consultarEstado, enviarPing } = require('./Api');

// ─── Estado en memoria ────────────────────────────────────────────────────────
let jornadaActiva   = false;   // true cuando estamos monitoreando
let jornadaActualId = null;    // ID de la jornada en curso
let appsPermitidas  = [];      // lista que vendrá del servidor

// Importamos el monitor pero solo lo inicializamos cuando haya jornada activa
// (se cargará en Parte 2)
let monitor = null;

// ─── Identidad ────────────────────────────────────────────────────────────────
const { windowsUsername, nombreEquipo, agentUuid } = getIdentidad();

console.log('─────────────────────────────────────────');
console.log(' Agente de Monitoreo de Jornadas Remotas');
console.log('─────────────────────────────────────────'); 
console.log(` Usuario  : ${windowsUsername}`);
console.log(` Equipo   : ${nombreEquipo}`);
console.log(` AgentID  : ${agentUuid}`);
console.log(` Servidor : ${config.SERVER_URL}`);
console.log('─────────────────────────────────────────');
console.log(' Estado   : ESPERANDO JORNADA...');
console.log('');

// ─── Recuperar jornada pendiente de reporte (por si el agente se reinició) ───
const jornadaPendiente = db.get('jornada_activa_id');
const reportePendiente = db.get('reporte_enviado');

if (jornadaPendiente && reportePendiente === '0') {
  console.log(`[init] Hay un reporte pendiente de la jornada ${jornadaPendiente}.`);
  console.log('[init] Se intentará enviar cuando haya conexión.');
  // El manejo del reenvío se implementa en Parte 3
}

// ─── Loop principal de polling ────────────────────────────────────────────────
async function tick() {
  const respuesta = await consultarEstado(windowsUsername);

  // Sin respuesta del servidor → seguir esperando silenciosamente
  if (!respuesta) return;

  const { estado, jornada_id, hora_inicio, hora_fin, apps_permitidas } = respuesta;

  // ── Caso: jornada se activó y no estábamos monitoreando ──────────────────
  if (estado === 'activa' && !jornadaActiva) {
    console.log(`\n[polling] Jornada ${jornada_id} ACTIVADA`);
    console.log(`[polling] Horario: ${hora_inicio} - ${hora_fin}`);
    console.log(`[polling] Apps requeridas: ${apps_permitidas.join(', ')}`);

    jornadaActiva   = true;
    jornadaActualId = jornada_id;
    appsPermitidas  = apps_permitidas || [];

    // Guardar en SQLite por si se reinicia el equipo
    db.set('jornada_activa_id', jornada_id);
    db.set('reporte_enviado', '0');

    iniciarMonitoreo(jornada_id, appsPermitidas, hora_fin);
    return;
  }

  // ── Caso: jornada se desactivó externamente (admin la canceló) ───────────
  if (estado !== 'activa' && jornadaActiva) {
    console.log(`\n[polling] Jornada ${jornadaActualId} finalizada por el servidor.`);
    await finalizarJornada('servidor');
    return;
  }

  // ── Caso: sigue activa, enviar ping ──────────────────────────────────────
  if (estado === 'activa' && jornadaActiva) {
    await enviarPing(windowsUsername, jornadaActualId);
  }
}

// ─── Iniciar monitoreo ────────────────────────────────────────────────────────
function iniciarMonitoreo(jornadaId, apps, horaFin) {
  console.log('[monitor] Iniciando captura de actividad...\n');

  // PARTE 2: aquí se montará el motor de monitoreo
  // Por ahora solo dejamos el placeholder con la firma correcta
  // monitor = require('./monitor');
  // monitor.iniciar(jornadaId, apps, () => finalizarJornada('horario'));

  // Verificar fin de jornada por horario cada minuto
  const [hFin, mFin] = horaFin.split(':').map(Number);
  const checkHorario = setInterval(() => {
    const ahora = new Date();
    if (ahora.getHours() >= hFin && ahora.getMinutes() >= mFin) {
      clearInterval(checkHorario);
      finalizarJornada('horario');
    }
  }, 60_000);
}

// ─── Finalizar jornada ────────────────────────────────────────────────────────
async function finalizarJornada(motivo) {
  console.log(`\n[jornada] Finalizando por: ${motivo}`);

  if (monitor) {
    monitor.detener();
  }

  // PARTE 3: aquí se calculará el reporte y se enviará
  // const reporte = calcularReporte(jornadaActualId, windowsUsername);
  // const ok = await enviarReporte(reporte);
  // db.set('reporte_enviado', ok ? '1' : '0');

  // Resetear estado en memoria
  jornadaActiva   = false;
  jornadaActualId = null;
  appsPermitidas  = [];
  monitor         = null;

  console.log('[agente] Volviendo a modo ESPERA...\n');
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
tick(); // Primera consulta inmediata al iniciar

const intervalo = config.POLLING_INTERVALO_SEG * 1000;
setInterval(tick, intervalo);

// Capturar cierre limpio del proceso
process.on('SIGINT',  () => { console.log('\n[agente] Detenido.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[agente] Detenido.'); process.exit(0); });