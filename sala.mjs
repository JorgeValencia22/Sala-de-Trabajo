#!/usr/bin/env node
// CLI de la Sala del Equipo — para que cada Claude (o tú) lea y escriba sin abrir el navegador.
// Requiere Node 18+. Configura una vez:
//   SALA_URL  = https://tu-sala.onrender.com
//   SALA_KEY  = la clave del equipo
//   SALA_WHO  = jorge | nico | claude-jorge | claude-nico
// (o crea un archivo .sala.json junto a este script con {"url":"","key":"","who":""})
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(dir, '.sala.json'), 'utf8')); } catch {}
const URL_ = (process.env.SALA_URL || cfg.url || '').replace(/\/$/, '');
const KEY = process.env.SALA_KEY || cfg.key;
const WHO = process.env.SALA_WHO || cfg.who;
if (!URL_ || !KEY || !WHO) {
  console.error('Falta configuración: SALA_URL, SALA_KEY y SALA_WHO (o .sala.json).');
  process.exit(1);
}

async function call(p, method = 'GET', body) {
  const r = await fetch(URL_ + p, {
    method,
    headers: { 'content-type': 'application/json', 'x-team-key': KEY, 'x-who': WHO },
    body: body ? JSON.stringify({ ...body, who: WHO }) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('Error:', j.error || r.status); process.exit(1); }
  return j;
}

const ago = (iso) => { if (!iso) return 'nunca'; const s = (Date.now() - new Date(iso)) / 1000;
  return s < 60 ? 'hace segundos' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : s < 86400 ? `hace ${Math.floor(s / 3600)} h` : `hace ${Math.floor(s / 86400)} d`; };

const [cmd, ...rest] = process.argv.slice(2);
const text = rest.join(' ');

if (cmd === 'leer') {
  const s = await call('/api/state');
  console.log('== EQUIPO ==');
  for (const [id, n] of Object.entries(s.members)) {
    const st = s.status[id] || {};
    console.log(`- ${n} (${id}) [visto ${ago(s.seen[id])}]: ${st.doing || '(sin estado)'}${st.files ? ' | archivos: ' + st.files : ''}${st.blocked ? ' | BLOQUEADO: ' + st.blocked : ''} (${ago(st.updated)})`);
  }
  console.log('\n== TAREAS ==');
  for (const t of s.tasks.filter((t) => t.state !== 'listo'))
    console.log(`#${t.id} [${t.state}] ${t.title} → ${s.members[t.assignee] || 'sin asignar'}${t.note ? ' — ' + t.note : ''}`);
  console.log('\n== ÚLTIMOS MENSAJES ==');
  for (const m of s.messages.slice(-15))
    console.log(`[${new Date(m.at).toLocaleString('es-CL')}] ${s.members[m.who]}${m.to ? ' → ' + s.members[m.to] : ''}: ${m.text}`);
} else if (cmd === 'estado') {
  // node sala.mjs estado "haciendo X" ["archivos"] ["bloqueado por"]
  const [doing, files, blocked] = rest;
  if (!doing) { console.error('Uso: estado "qué haces" ["archivos"] ["bloqueo"]'); process.exit(1); }
  await call('/api/status', 'POST', { doing, files, blocked });
  console.log('Estado actualizado.');
} else if (cmd === 'msg') {
  // node sala.mjs msg "texto"   |   node sala.mjs msg --a claude-nico "texto"
  let to; let t = rest;
  if (rest[0] === '--a') { to = rest[1]; t = rest.slice(2); }
  await call('/api/message', 'POST', { text: t.join(' '), to });
  console.log('Mensaje enviado.');
} else if (cmd === 'tarea') {
  // node sala.mjs tarea "título" [--para claude-jorge]
  let assignee; let t = rest;
  const i = rest.indexOf('--para');
  if (i >= 0) { assignee = rest[i + 1]; t = rest.slice(0, i); }
  const r = await call('/api/tasks', 'POST', { title: t.join(' '), assignee });
  console.log(`Tarea #${r.id} creada.`);
} else if (cmd === 'mover') {
  // node sala.mjs mover 12 en-curso|listo|pendiente
  await call('/api/tasks/' + rest[0], 'PATCH', { state: rest[1] });
  console.log('Tarea actualizada.');
} else {
  console.log('Comandos: leer | estado "..." ["archivos"] ["bloqueo"] | msg [--a quien] "texto" | tarea "título" [--para quien] | mover <id> <pendiente|en-curso|listo>');
}
