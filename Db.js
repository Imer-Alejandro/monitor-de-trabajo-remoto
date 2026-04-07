// db.js - Base de datos SQLite local del agente
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Guardar la DB en AppData del usuario para que persista entre reinicios
const DATA_DIR = path.join(os.homedir(), 'AppData', 'Local', 'AgenteMonitoreo');
const DB_PATH  = path.join(DATA_DIR, 'agente.db');

// Crear directorio si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Optimizaciones SQLite para escritura frecuente
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ─── Crear tablas si no existen ──────────────────────────────────────────────

db.exec(`
  -- Estado e identidad del agente (clave-valor)
  CREATE TABLE IF NOT EXISTS estado_local (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  -- Logs de actividad capturados durante la jornada
  CREATE TABLE IF NOT EXISTS actividad_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id    INTEGER NOT NULL,
    timestamp     TEXT NOT NULL,
    app_activa    TEXT,
    es_requerida  INTEGER NOT NULL DEFAULT 0,  -- 1 si está en apps_permitidas
    activo        INTEGER NOT NULL DEFAULT 0,  -- 1 si hubo actividad de periféricos
    idle_seg      INTEGER NOT NULL DEFAULT 0
  );

  -- Índice para consultas rápidas por jornada
  CREATE INDEX IF NOT EXISTS idx_logs_jornada ON actividad_logs(jornada_id);
`);

// ─── Helpers de estado_local ─────────────────────────────────────────────────

const getEstado = db.prepare('SELECT valor FROM estado_local WHERE clave = ?');
const setEstado = db.prepare(
  'INSERT OR REPLACE INTO estado_local (clave, valor) VALUES (?, ?)'
);

function get(clave) {
  const row = getEstado.get(clave);
  return row ? row.valor : null;
}

function set(clave, valor) {
  setEstado.run(clave, valor === null ? null : String(valor));
}

// ─── Helpers de actividad_logs ───────────────────────────────────────────────

const insertLog = db.prepare(`
  INSERT INTO actividad_logs (jornada_id, timestamp, app_activa, es_requerida, activo, idle_seg)
  VALUES (@jornada_id, @timestamp, @app_activa, @es_requerida, @activo, @idle_seg)
`);

function guardarLog(log) {
  insertLog.run(log);
}

function getLogsPorJornada(jornada_id) {
  return db.prepare('SELECT * FROM actividad_logs WHERE jornada_id = ?').all(jornada_id);
}

function limpiarLogsJornada(jornada_id) {
  db.prepare('DELETE FROM actividad_logs WHERE jornada_id = ?').run(jornada_id);
}

module.exports = { get, set, guardarLog, getLogsPorJornada, limpiarLogsJornada, db };