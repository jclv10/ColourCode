import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, ping } from './db.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  API_PORT = '3000',
  API_ALLOWED_ORIGINS = 'http://localhost:5173,http://192.168.1.15:5173',
  API_BASIC_USER,
  API_BASIC_PASS,
} = process.env;

app.use(express.json());

// CORS: allow dev origins
const allowed = new Set(
  API_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, allowed.has(origin));
    },
    credentials: true,
  })
);

// Optional Basic Auth middleware if creds provided
function requireBasicAuth(req, res, next) {
  if (!API_BASIC_USER || !API_BASIC_PASS) return next();
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Basic\s+(.*)$/i);
  if (!m) return res.status(401).json({ message: 'Unauthorized' });
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user === API_BASIC_USER && pass === API_BASIC_PASS) return next();
  return res.status(401).json({ message: 'Unauthorized' });
}

app.use('/api', requireBasicAuth);

// Static game assets/modules needed by admin replay host (/admin/replay)
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/admin/js', express.static(path.join(__dirname, '../js')));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.get('/Tutorial.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../Tutorial.json'));
});
app.get('/Solucionario.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../Solucionario.json'));
});

// Health check for DB
app.get('/api/health/db', async (req, res) => {
  try {
    const ok = await ping();
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Stubs: define later
app.get('/api/tutorial', async (req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});
app.get('/api/levels', async (req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});
app.post('/api/results', async (req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// Insert Partida action log
app.post('/api/partida', async (req, res) => {
  try {
    const {
      id_partida,
      id_usuari,
      id_num_estado_partida,
      id_nivel,
      figura_1,
      figura_2,
      figura_3,
      figura_4,
      figura_5,
      rotacion_figura_1,
      rotacion_figura_2,
      rotacion_figura_3,
      rotacion_figura_4,
      rotacion_figura_5,
      validado,
      reset,
      repetir,
      salir,
      avanzar,
      continuar,
      superado,
      semi_superado,
      volver_menu,
      tiempo_partida,
    } = req.body || {};

    const partidaIdRaw = id_partida == null ? null : Number(id_partida);
    const userId = Number(id_usuari);
    const stateNum = Number(id_num_estado_partida);
    const levelId = Number(id_nivel);
    const isValidated = Number(validado);
    const flagFields = {
      reset,
      repetir,
      salir,
      avanzar,
      continuar,
      superado,
      semi_superado,
      volver_menu,
    };
    const normalizedFlags = {};
    const figurasRaw = [figura_1, figura_2, figura_3, figura_4, figura_5];
    const rotationsRaw = [rotacion_figura_1, rotacion_figura_2, rotacion_figura_3, rotacion_figura_4, rotacion_figura_5];

    const figuras = figurasRaw.map((v) => (v == null ? null : Number(v)));
    const rotations = rotationsRaw.map((v) => (v == null ? null : Number(v)));

    if (partidaIdRaw != null && (!Number.isInteger(partidaIdRaw) || partidaIdRaw <= 0)) {
      return res.status(400).json({ message: 'Invalid id_partida' });
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid id_usuari' });
    }
    if (!Number.isInteger(stateNum) || stateNum <= 0) {
      return res.status(400).json({ message: 'Invalid id_num_estado_partida' });
    }
    if (!Number.isInteger(levelId) || levelId <= 0) {
      return res.status(400).json({ message: 'Invalid id_nivel' });
    }
    for (let i = 0; i < 5; i++) {
      const f = figuras[i];
      const r = rotations[i];
      if (f == null) {
        if (r != null) {
          return res.status(400).json({ message: `Invalid rotacion_figura_${i + 1}` });
        }
        continue;
      }
      if (!Number.isInteger(f) || f <= 0) {
        return res.status(400).json({ message: `Invalid figura_${i + 1}` });
      }
      if (!Number.isInteger(r) || r < 0 || r > 3) {
        return res.status(400).json({ message: `Invalid rotacion_figura_${i + 1}` });
      }
    }
    if (!(isValidated === 0 || isValidated === 1)) {
      return res.status(400).json({ message: 'Invalid validado' });
    }
    for (const [k, v] of Object.entries(flagFields)) {
      const n = v == null ? 0 : Number(v);
      if (!(n === 0 || n === 1)) {
        return res.status(400).json({ message: `Invalid ${k}` });
      }
      normalizedFlags[k] = n;
    }

    const ts = tiempo_partida ? new Date(tiempo_partida) : new Date();
    if (Number.isNaN(ts.getTime())) {
      return res.status(400).json({ message: 'Invalid tiempo_partida' });
    }

    const pool = getPool();
    let partidaId = partidaIdRaw;
    if (partidaId == null) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT COALESCE(MAX(`id_partida`), 0) + 1 AS nextId FROM `Partida` FOR UPDATE');
        partidaId = Number(rows?.[0]?.nextId || 1);
        await conn.commit();
      } catch (e) {
        try { await conn.rollback(); } catch (_) {}
        throw e;
      } finally {
        conn.release();
      }
    }

    let effectiveStateNum = stateNum;
    {
      const [stateRows] = await pool.execute(
        'SELECT COALESCE(MAX(`id_num_estado_partida`), 0) AS maxState FROM `Partida` WHERE `id_partida` = ?',
        [partidaId]
      );
      const maxState = Number(stateRows?.[0]?.maxState || 0);
      if (effectiveStateNum <= maxState) {
        effectiveStateNum = maxState + 1;
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO `Partida` (`id_partida`, `id_usuari`, `id_num_estado_partida`, `id_nivel`, `figura_1`, `rotacion_figura_1`, `figura_2`, `rotacion_figura_2`, `figura_3`, `rotacion_figura_3`, `figura_4`, `rotacion_figura_4`, `figura_5`, `rotacion_figura_5`, `validado`, `reset`, `repetir`, `salir`, `avanzar`, `continuar`, `superado`, `semi_superado`, `volver_menu`, `tiempo_partida`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [partidaId, userId, effectiveStateNum, levelId, figuras[0], rotations[0], figuras[1], rotations[1], figuras[2], rotations[2], figuras[3], rotations[3], figuras[4], rotations[4], isValidated, normalizedFlags.reset, normalizedFlags.repetir, normalizedFlags.salir, normalizedFlags.avanzar, normalizedFlags.continuar, normalizedFlags.superado, normalizedFlags.semi_superado, normalizedFlags.volver_menu, ts]
    );

    res.json({
      id_partida: partidaId,
      id_usuari: userId,
      id_num_estado_partida: effectiveStateNum,
      id_nivel: levelId,
      figura_1: figuras[0],
      rotacion_figura_1: rotations[0],
      figura_2: figuras[1],
      rotacion_figura_2: rotations[1],
      figura_3: figuras[2],
      rotacion_figura_3: rotations[2],
      figura_4: figuras[3],
      rotacion_figura_4: rotations[3],
      figura_5: figuras[4],
      rotacion_figura_5: rotations[4],
      validado: isValidated,
      reset: normalizedFlags.reset,
      repetir: normalizedFlags.repetir,
      salir: normalizedFlags.salir,
      avanzar: normalizedFlags.avanzar,
      continuar: normalizedFlags.continuar,
      superado: normalizedFlags.superado,
      semi_superado: normalizedFlags.semi_superado,
      volver_menu: normalizedFlags.volver_menu,
      tiempo_partida: ts.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create Usuari
app.post('/api/usuari', async (req, res) => {
  try {
    const { edat, genere, ma_habil } = req.body || {};
    const validGenere = genere === 'home' || genere === 'dona' || genere === 'altre';
    const validMa = ma_habil === 'esquerra' || ma_habil === 'dreta';
    const ageNum = Number(edat);
    if (!Number.isInteger(ageNum) || ageNum <= 0) {
      return res.status(400).json({ message: 'Invalid edat' });
    }
    if (!validGenere) {
      return res.status(400).json({ message: 'Invalid genere' });
    }
    if (!validMa) {
      return res.status(400).json({ message: 'Invalid ma_habil' });
    }
    const pool = getPool();
    const [result] = await pool.execute(
      'INSERT INTO `Usuari` (`edat`, `genere`, `ma_habil`) VALUES (?, ?, ?)',
      [ageNum, genere, ma_habil]
    );
    const id = result.insertId;
    res.json({ id_usuari: id, edat: ageNum, genere, ma_habil });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get Usuari by id
app.get('/api/usuari/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT `id_usuari`, `edat`, `genere`, `ma_habil` FROM `Usuari` WHERE `id_usuari` = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    const r = rows[0];
    res.json({ id_usuari: r.id_usuari, edat: r.edat, genere: r.genere, ma_habil: r.ma_habil });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Admin

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'colourcode2026';

// In-memory token store  { token -> expiresAt }
const adminTokens = new Map();
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function issueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query._token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const exp = adminTokens.get(token);
  if (!exp || Date.now() > exp) {
    adminTokens.delete(token);
    return res.status(401).json({ message: 'Session expired' });
  }
  next();
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

// Serve Admin.js from project js folder
app.get('/admin/Admin.js', (req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, '../js/Admin.js'));
});

// Serve AdminReplay.js from project js folder
app.get('/admin/AdminReplay.js', (req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, '../js/AdminReplay.js'));
});

// Serve admin panel HTML
app.get('/admin', (req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve admin replay HTML
app.get('/admin/replay', (req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, 'admin-replay.html'));
});

// Admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: issueToken() });
  }
  return res.status(401).json({ message: 'Invalid credentials' });
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) adminTokens.delete(token);
  res.json({ ok: true });
});

// GET /admin/data/partida  — supports filters: id_partida, id_usuari, id_nivel, validado, date_from, date_to
app.get('/admin/data/partida', requireAdminToken, async (req, res) => {
  try {
    const pool = getPool();
    const conditions = [];
    const params = [];

    const { id_partida, id_usuari, id_nivel, validado, date_from, date_to } = req.query;
    if (id_partida) {
      const n = Number(id_partida);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid id_partida' });
      conditions.push('`id_partida` = ?');
      params.push(n);
    }
    if (id_usuari) {
      const n = Number(id_usuari);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid id_usuari' });
      conditions.push('`id_usuari` = ?');
      params.push(n);
    }
    if (id_nivel) {
      const n = Number(id_nivel);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid id_nivel' });
      conditions.push('`id_nivel` = ?');
      params.push(n);
    }
    if (validado !== undefined && validado !== '') {
      const n = Number(validado);
      if (!(n === 0 || n === 1)) return res.status(400).json({ message: 'Invalid validado' });
      conditions.push('`validado` = ?');
      params.push(n);
    }
    if (date_from) {
      const d = new Date(String(date_from));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid date_from' });
      conditions.push('`tiempo_partida` >= ?');
      params.push(d);
    }
    if (date_to) {
      const d = new Date(String(date_to));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid date_to' });
      conditions.push('`tiempo_partida` <= ?');
      params.push(d);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await pool.execute(`SELECT * FROM \`Partida\` ${where} ORDER BY \`tiempo_partida\` DESC LIMIT 5000`, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /admin/data/partida/:id/steps — ordered playback for one partida
app.get('/admin/data/partida/:id/steps', requireAdminToken, async (req, res) => {
  try {
    const idPartida = Number(req.params.id);
    if (!Number.isInteger(idPartida) || idPartida <= 0) {
      return res.status(400).json({ message: 'Invalid id_partida' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM `Partida` WHERE `id_partida` = ? ORDER BY `id_num_estado_partida` ASC, `tiempo_partida` ASC',
      [idPartida]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Partida not found' });
    }

    const first = rows[0];
    const last = rows[rows.length - 1];

    res.json({
      partida: {
        id_partida: idPartida,
        id_usuari: first.id_usuari,
        id_nivel: first.id_nivel,
        passos: rows.length,
        inici: first.tiempo_partida,
        fi: last.tiempo_partida,
      },
      steps: rows,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /admin/data/usuari  — supports filters: id_usuari, genere, ma_habil, edat_min, edat_max
app.get('/admin/data/usuari', requireAdminToken, async (req, res) => {
  try {
    const pool = getPool();
    const conditions = [];
    const params = [];

    const { id_usuari, genere, ma_habil, edat_min, edat_max } = req.query;
    if (id_usuari) {
      const n = Number(id_usuari);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid id_usuari' });
      conditions.push('`id_usuari` = ?');
      params.push(n);
    }
    if (genere)    { conditions.push('`genere` = ?');    params.push(genere);            }
    if (ma_habil)  { conditions.push('`ma_habil` = ?');  params.push(ma_habil);          }
    if (edat_min)  {
      const n = Number(edat_min);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid edat_min' });
      conditions.push('`edat` >= ?');
      params.push(n);
    }
    if (edat_max)  {
      const n = Number(edat_max);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: 'Invalid edat_max' });
      conditions.push('`edat` <= ?');
      params.push(n);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await pool.execute(`SELECT * FROM \`Usuari\` ${where} ORDER BY \`id_usuari\` ASC LIMIT 5000`, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// End Admin

app.listen(Number(API_PORT), () => {
  console.log(`API listening on http://localhost:${API_PORT}`);
});
