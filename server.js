import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const KEY = process.env.TEAM_KEY;
if (!KEY) {
  console.error('Falta la variable TEAM_KEY (la clave del equipo).');
  process.exit(1);
}

const MEMBERS = {
  jorge: 'Jorge',
  nico: 'Nico',
  'claude-jorge': 'Claude de Jorge',
  'claude-nico': 'Claude de Nico',
};
const TASK_STATES = ['pendiente', 'en-curso', 'listo'];

// ---------- Persistencia: Postgres si hay DATABASE_URL, si no archivo JSON ----------
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
let pool = null;
if (process.env.DATABASE_URL) {
  const pg = (await import('pg')).default;
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
  });
  await pool.query('create table if not exists kv (k text primary key, v jsonb not null)');
}

let state = { seq: 0, messages: [], status: {}, tasks: [] };

async function load() {
  try {
    if (pool) {
      const r = await pool.query("select v from kv where k = 'state'");
      if (r.rows[0]) state = { ...state, ...r.rows[0].v };
    } else if (fs.existsSync(DATA_FILE)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    }
  } catch (e) {
    console.error('No pude cargar el estado, parto vacío:', e.message);
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      if (pool) {
        await pool.query(
          "insert into kv (k, v) values ('state', $1) on conflict (k) do update set v = excluded.v",
          [JSON.stringify(state)]
        );
      } else {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state));
      }
    } catch (e) {
      console.error('Error guardando:', e.message);
    }
  }, 400);
}
await load();

// ---------- Utilidades ----------
const seen = {}; // presencia en memoria: quién consultó por última vez
const now = () => new Date().toISOString();
const clip = (s, n) => String(s ?? '').slice(0, n);

function keyOk(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (_req, res) => res.send('ok'));

// Todo lo de /api exige la clave del equipo
app.use('/api', (req, res, next) => {
  if (!keyOk(req.get('x-team-key'))) return res.status(401).json({ error: 'Clave incorrecta' });
  next();
});

function who(req, res) {
  const w = String(req.body?.who ?? req.get('x-who') ?? '');
  if (!MEMBERS[w]) {
    res.status(400).json({ error: `"who" debe ser uno de: ${Object.keys(MEMBERS).join(', ')}` });
    return null;
  }
  seen[w] = now();
  return w;
}

// Estado completo (los clientes hacen polling aquí)
app.get('/api/state', (req, res) => {
  const w = String(req.get('x-who') ?? req.query.who ?? '');
  if (MEMBERS[w]) seen[w] = now();
  const since = Number(req.query.since) || 0;
  res.json({
    now: now(),
    members: MEMBERS,
    seen,
    status: state.status,
    tasks: state.tasks,
    messages: since ? state.messages.filter((m) => m.id > since) : state.messages.slice(-100),
    lastId: state.seq,
  });
});

// Mensaje al equipo (to opcional: dirigido a alguien)
app.post('/api/message', (req, res) => {
  const w = who(req, res);
  if (!w) return;
  const text = clip(req.body.text, 4000).trim();
  if (!text) return res.status(400).json({ error: 'Falta "text"' });
  const to = MEMBERS[req.body.to] ? req.body.to : null;
  const msg = { id: ++state.seq, who: w, to, text, at: now() };
  state.messages.push(msg);
  if (state.messages.length > 500) state.messages.splice(0, state.messages.length - 500);
  save();
  res.json(msg);
});

// Estado propio: qué estoy haciendo ahora
app.post('/api/status', (req, res) => {
  const w = who(req, res);
  if (!w) return;
  state.status[w] = {
    doing: clip(req.body.doing, 500),
    files: clip(req.body.files, 500),
    blocked: clip(req.body.blocked, 300),
    updated: now(),
  };
  save();
  res.json(state.status[w]);
});

// Tareas
app.post('/api/tasks', (req, res) => {
  const w = who(req, res);
  if (!w) return;
  const title = clip(req.body.title, 200).trim();
  if (!title) return res.status(400).json({ error: 'Falta "title"' });
  const task = {
    id: ++state.seq,
    title,
    note: clip(req.body.note, 1000),
    assignee: MEMBERS[req.body.assignee] ? req.body.assignee : null,
    state: TASK_STATES.includes(req.body.state) ? req.body.state : 'pendiente',
    createdBy: w,
    updated: now(),
  };
  state.tasks.push(task);
  save();
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const w = who(req, res);
  if (!w) return;
  const task = state.tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'No existe esa tarea' });
  if (TASK_STATES.includes(req.body.state)) task.state = req.body.state;
  if (req.body.assignee !== undefined) task.assignee = MEMBERS[req.body.assignee] ? req.body.assignee : null;
  if (req.body.note !== undefined) task.note = clip(req.body.note, 1000);
  if (req.body.title) task.title = clip(req.body.title, 200);
  task.updated = now();
  save();
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const w = who(req, res);
  if (!w) return;
  state.tasks = state.tasks.filter((t) => t.id !== Number(req.params.id));
  save();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Sala del equipo en el puerto ${PORT} (${pool ? 'Postgres' : 'archivo'})`));
