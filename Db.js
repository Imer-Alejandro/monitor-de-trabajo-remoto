// Db.js - Base de datos SQLite local del agente (usando sql.js)
//
// DIFERENCIAS CLAVE vs better-sqlite3:
//   • sql.js carga la DB completa en memoria (Buffer).
//   • No existe db.prepare().get() / .run() / .all() — se usa db.exec() y db.run() con parámetros.
//   • Toda escritura debe ir seguida de persistDisk() para volcar el Buffer al archivo .db.
//   • La inicialización es ASÍNCRONA: llame a `await Db.init()` desde Index.js antes de usar el módulo.

const path   = require('path');
const os     = require('os');
const fs     = require('fs');

// ─── Rutas ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), 'AppData', 'Local', 'AgenteMonitoreo');
const DB_PATH  = path.join(DATA_DIR, 'agente.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let SQL = null;   // Clase initSqlJs
let db  = null;   // Instancia Database de sql.js

// ─── Persistencia en disco ────────────────────────────────────────────────────

function persistDisk() {
  // Exporta el estado en memoria al archivo .db
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Inicialización (debe llamarse una sola vez al arrancar) ──────────────────

async function init() {
  if (db) return; // Ya inicializado

  // Cargar sql.js (requiere el WASM embebido en el paquete sql.js de npm)
  SQL = await require('sql.js')();

  if (fs.existsSync(DB_PATH)) {
    // Leer DB existente desde disco
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[db] Base de datos cargada desde disco.');
  } else {
    db = new SQL.Database();
    console.log('[db] Nueva base de datos creada en memoria.');
  }

  // ─── Crear tablas si no existen ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS estado_local (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS actividad_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      jornada_id    INTEGER NOT NULL,
      timestamp     TEXT NOT NULL,
      app_activa    TEXT,
      es_requerida  INTEGER NOT NULL DEFAULT 0,
      activo        INTEGER NOT NULL DEFAULT 0,
      idle_seg      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_logs_jornada ON actividad_logs(jornada_id);
  `);

  persistDisk();
}

// ─── Helpers de estado_local ──────────────────────────────────────────────────

function get(clave) {
  const stmt = db.prepare('SELECT valor FROM estado_local WHERE clave = ?');
  stmt.bind([clave]);
  const found = stmt.step();
  const row   = found ? stmt.getAsObject() : null;
  stmt.free();
  return row ? row.valor : null;
}

function set(clave, valor) {
  db.run(
    'INSERT OR REPLACE INTO estado_local (clave, valor) VALUES (?, ?)',
    [clave, valor === null ? null : String(valor)]
  );
  persistDisk();
}

// ─── Helpers de actividad_logs ────────────────────────────────────────────────

function guardarLog(log) {
  db.run(
    `INSERT INTO actividad_logs
       (jornada_id, timestamp, app_activa, es_requerida, activo, idle_seg)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      log.jornada_id,
      log.timestamp,
      log.app_activa,
      log.es_requerida,
      log.activo,
      log.idle_seg,
    ]
  );
  persistDisk();
}

function getLogsPorJornada(jornada_id) {
  const rows  = [];
  const stmt  = db.prepare('SELECT * FROM actividad_logs WHERE jornada_id = ?');
  stmt.bind([jornada_id]);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function limpiarLogsJornada(jornada_id) {
  db.run('DELETE FROM actividad_logs WHERE jornada_id = ?', [jornada_id]);
  persistDisk();
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = { init, get, set, guardarLog, getLogsPorJornada, limpiarLogsJornada, db: () => db };