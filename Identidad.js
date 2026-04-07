// identidad.js - Resuelve quién es este agente
const os = require('os');
const crypto = require('crypto');
const db = require('./Db');

function getIdentidad() {
  // Username de Windows (ej: "juan.perez")
  const windowsUsername = os.userInfo().username;
  const nombreEquipo    = os.hostname();

  // UUID persistente: se genera una sola vez y queda guardado en SQLite
  let agentUuid = db.get('agent_uuid');
  if (!agentUuid) {
    agentUuid = crypto.randomUUID();
    db.set('agent_uuid', agentUuid);
    console.log(`[identidad] Nuevo agente registrado: ${agentUuid}`);
  }

  return { windowsUsername, nombreEquipo, agentUuid };
}

module.exports = { getIdentidad };