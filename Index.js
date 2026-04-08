// Index.js - Punto de entrada del agente
// Se ejecuta en segundo plano como servicio Windows

const config = require('./Config');
const db = require('./Db');
const { getIdentidad } = require('./Identidad');
const Polling = require('./Polling');
const monitor = require('./Monitor');
const { generarYEnviarReporte } = require('./Reporte');
const { enviarPing } = require('./Api');

// ─── ARRANQUE ASÍNCRONO ───────────────────────────────────────────────────────
// sql.js requiere cargar el módulo WASM antes de cualquier operación sobre la DB.
// Todo el código de inicialización se mueve dentro de main().

async function main() {

  // 1. Inicializar la base de datos (carga el WASM y el archivo .db del disco)
  await db.init();

  // ─── Estado en memoria ────────────────────────────────────────────────────

  let jornadaActiva    = false;
  let jornadaActualId  = null;
  let appsPermitidas   = [];
  let horarioFin       = null;
  let finTimer         = null;

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

  // 2. Verificar si quedó un reporte pendiente de la sesión anterior
  const jornadaPendiente = db.get('jornada_activa_id');
  const reportePendiente = db.get('reporte_enviado');
  if (jornadaPendiente && reportePendiente === '0') {
    console.log(`[init] Hay un reporte pendiente de la jornada ${jornadaPendiente}.`);
    console.log('[init] Se intentará enviar cuando haya conexión.');
    setTimeout(() => reintentarReportesPendientes(), 5000);
  }

  // ─── Helpers de horario ───────────────────────────────────────────────────

  function validarHora(hora) {
    if (typeof hora !== 'string') return false;
    const partes = hora.split(':').map(Number);
    return (
      partes.length === 2 &&
      partes.every(num => Number.isInteger(num) && num >= 0 && num < 60) &&
      partes[0] < 24
    );
  }

  function buildHorario(horaInicio, horaFin, now = new Date()) {
    const [hInicio, mInicio] = horaInicio.split(':').map(Number);
    const [hFin, mFin]       = horaFin.split(':').map(Number);

    const inicio = new Date(now);
    inicio.setHours(hInicio, mInicio, 0, 0);

    const fin = new Date(now);
    fin.setHours(hFin, mFin, 0, 0);
    if (fin <= inicio) fin.setDate(fin.getDate() + 1);

    return { inicio, fin };
  }

  // ─── Control de jornada ───────────────────────────────────────────────────

  function iniciarMonitoreo(jornadaId, apps, inicio, fin) {
    console.log('[monitor] Iniciando captura de actividad...');

    Polling.stop();

    jornadaActiva   = true;
    jornadaActualId = jornadaId;
    appsPermitidas  = apps || [];
    horarioFin      = fin;

    db.set('jornada_activa_id', jornadaId);
    db.set('reporte_enviado',   '0');
    db.set('jornada_hora_inicio', inicio.toISOString());
    db.set('jornada_hora_fin',    fin.toISOString());

    monitor.iniciar(jornadaId, appsPermitidas);

    const msHastaFin = Math.max(0, fin.getTime() - Date.now());
    finTimer = setTimeout(() => finalizarJornada('horario'), msHastaFin + 500);
  }

  async function finalizarJornada(motivo) {
    if (!jornadaActiva) {
      console.log('[jornada] No hay jornada activa para finalizar.');
      return;
    }

    console.log(`\n[jornada] Finalizando por: ${motivo}`);
    if (finTimer) { clearTimeout(finTimer); finTimer = null; }

    monitor.detener();

    const ok = await generarYEnviarReporte(jornadaActualId, windowsUsername);
    if (!ok) console.warn('[jornada] No se pudo enviar el reporte. Quedará pendiente.');

    jornadaActiva   = false;
    jornadaActualId = null;
    appsPermitidas  = [];
    horarioFin      = null;

    Polling.start(windowsUsername, manejarEstado);
    console.log('[agente] Volviendo a modo ESPERA...\n');
  }

  async function manejarEstado(respuesta) {
    if (!respuesta) {
      console.log('[polling] No se recibió respuesta del servidor.');
      return;
    }

    const { estado, jornada_id, hora_inicio, hora_fin, apps_permitidas } = respuesta;

    if (!validarHora(hora_inicio) || !validarHora(hora_fin)) {
      console.warn('[polling] Formato de horario inválido recibido del servidor.');
      return;
    }

    const ahora = new Date();
    const { inicio, fin } = buildHorario(hora_inicio, hora_fin, ahora);

    if (estado === 'activa' && !jornadaActiva) {
      if (ahora < inicio) {
        console.log(`[polling] Jornada ${jornada_id} aún no inicia. Comienza a las ${hora_inicio}.`);
        return;
      }
      if (ahora >= fin) {
        console.log(`[polling] Jornada ${jornada_id} ya finalizó según el horario ${hora_inicio} - ${hora_fin}.`);
        return;
      }
      if (jornadaActualId && jornadaActualId === jornada_id) {
        console.log('[polling] Ya existe una jornada activa con el mismo ID, evitando doble inicio.');
        return;
      }

      console.log(`\n[polling] Jornada ${jornada_id} ACTIVADA`);
      console.log(`[polling] Horario: ${hora_inicio} - ${hora_fin}`);
      console.log(`[polling] Apps requeridas: ${apps_permitidas?.join(', ') || 'Ninguna'}`);

      iniciarMonitoreo(jornada_id, apps_permitidas || [], inicio, fin);
      return;
    }

    if (estado !== 'activa' && jornadaActiva) {
      console.log(`\n[polling] Jornada ${jornadaActualId} finalizada por el servidor.`);
      await finalizarJornada('servidor');
      return;
    }

    if (estado === 'activa' && jornadaActiva && jornada_id === jornadaActualId) {
      if (ahora >= horarioFin) {
        await finalizarJornada('horario');
        return;
      }
      await enviarPing(windowsUsername, jornadaActualId);
    }
  }

  // 3. Arrancar el ciclo de polling
  Polling.start(windowsUsername, manejarEstado);

  process.on('SIGINT',  () => { console.log('\n[agente] Detenido.'); process.exit(0); });
  process.on('SIGTERM', () => { console.log('\n[agente] Detenido.'); process.exit(0); });
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
main().catch(err => {
  console.error('[agente] Error fatal en la inicialización:', err);
  process.exit(1);
});