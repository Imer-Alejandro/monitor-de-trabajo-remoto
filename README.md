# Agente de Monitoreo de Jornadas Remotas

## Parte 1 — Base del agente + polling

### Estructura del proyecto
```
agente-monitoreo/
├── package.json
└── src/
    ├── index.js      ← punto de entrada, loop de polling
    ├── config.js     ← URL del servidor y parámetros
    ├── db.js         ← SQLite local (2 tablas)
    ├── identidad.js  ← lee windows_username, genera UUID
    ├── api.js        ← GET /estado · POST /reporte · POST /ping
    ├── monitor.js    ← PARTE 2: captura de actividad
    └── reporte.js    ← PARTE 3: cálculo de métricas y envío
```

### Instalación
```bash
npm install
```

### Configuración
Antes de distribuir, editar `src/config.js`:
```js
SERVER_URL: 'https://tu-servidor.com'
```

### Correr en desarrollo
```bash
npm start
```

### Lo que hace esta parte
- Lee el `windows_username` del sistema operativo automáticamente
- Genera un UUID único para este agente y lo persiste en SQLite
- Consulta `GET /api/jornada/estado?windows_user=xxx` cada 30 segundos
- Cuando el servidor devuelve `estado: 'activa'`, dispara el monitoreo
- Cuando la jornada finaliza (por horario o por el servidor), vuelve a esperar
- Recupera estados pendientes si el equipo se reinició a mitad de jornada

### Respuesta esperada de GET /api/jornada/estado
```json
{
  "estado": "activa",
  "jornada_id": 12,
  "hora_inicio": "08:00",
  "hora_fin": "17:00",
  "apps_permitidas": ["chrome.exe", "excel.exe", "teams.exe"]
}
```
Valores posibles de `estado`: `pendiente` · `activa` · `finalizada` · `sin_jornada`

### Base de datos local
Ubicación: `%LOCALAPPDATA%\AgenteMonitoreo\agente.db`

Tablas:
- `estado_local` — clave/valor: agent_uuid, jornada_activa_id, reporte_enviado
- `actividad_logs` — registros capturados durante la jornada (se llena en Parte 2)

---
## Próximas partes
- **Parte 2**: motor de monitoreo (apps activas, idle, clasificación)
- **Parte 3**: cálculo de los 5 porcentajes y POST /reporte
- **Parte 4**: servicio Windows + empaquetado a .exe