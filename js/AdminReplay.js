const label = document.getElementById('replayLabel');

window.__CCO_REPLAY_MODE__ = true;

const state = {
  app: null,
  difficulties: [],
  levelLoaded: null,
  currentSteps: [],
  currentStepIndex: -1,
  initialized: false,
  Application: null,
  Assets: null,
  Sprite: null,
  Figura: null,
  SeleccionarNivel: null,
  Nivel: null,
  Graphics: null,
  wallpaperBg: null,
  fitWallpaper: null,
  replayStartTsMs: null,
  fxLayer: null,
  fxTicker: null,
};

const PIXI_MODULE_URL = 'https://esm.sh/pixi.js@8.8.1?bundle';

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (url.includes('/api/partida') || url.includes('/api/results') || url.includes('/api/usuari')) {
    return new Response(JSON.stringify({ ok: true, replay: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

function setLabel(msg) {
  if (label) label.textContent = msg || '';
}

function formatRelativeMs(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalSec = Math.floor(safe / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `t+${mm}:${ss}`;
}

function toRotationRad(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (Number.isInteger(n) && n >= -4 && n <= 4) return n * (Math.PI / 2);
  return n;
}

function getGridFigureById(id) {
  const app = state.app;
  if (!app || !app.stage) return null;
  const name = `grid_${id}`;
  const stack = [...app.stage.children];
  while (stack.length) {
    const item = stack.pop();
    if (item && item.nombre === name) return item;
    if (item && item.children && item.children.length) {
      for (const ch of item.children) stack.push(ch);
    }
  }
  return null;
}

function clearSelectedStack() {
  const Figura = state.Figura;
  if (!Figura) return;
  try {
    const copy = (Figura.selectedStack || []).slice();
    copy.forEach((f) => {
      try {
        f.descentralize();
      } catch {}
    });
    Figura.selectedStack = [];
    try {
      Figura.updateSelectionUI && Figura.updateSelectionUI();
    } catch {}
  } catch {}
}

function ensureFxLayer() {
  if (!state.app || !state.Graphics) return null;
  if (state.fxLayer) return state.fxLayer;
  const layer = new state.Graphics();
  try {
    layer.zIndex = 300000;
  } catch {}
  try {
    layer.eventMode = 'none';
  } catch {}
  state.app.stage.addChild(layer);
  state.fxLayer = layer;
  if (!state.app.stage.sortableChildren) state.app.stage.sortableChildren = true;
  return layer;
}

function clearFx() {
  const layer = state.fxLayer;
  if (!layer) return;
  try {
    layer.clear();
  } catch {}
  if (state.fxTicker && state.app) {
    try {
      state.app.ticker.remove(state.fxTicker);
    } catch {}
    state.fxTicker = null;
  }
}

function validationColorForStep(step) {
  if (Number(step?.validado) !== 1) return null;
  if (Number(step?.sortir) === 1) return 0xe74c3c;
  if (Number(step?.superado) === 1) return 0x2ecc71;
  if (Number(step?.semi_superado) === 1 || Number(step?.continuar) === 1) return 0xf1c40f;
  return 0xe74c3c;
}

function drawCenteredValidationOutline(color) {
  const Figura = state.Figura;
  const layer = ensureFxLayer();
  if (!Figura || !layer) return;

  const stack = Array.isArray(Figura.selectedStack) ? Figura.selectedStack : [];
  for (const fig of stack) {
    if (!fig || !fig.getBounds) continue;
    let b;
    try {
      b = fig.getBounds();
    } catch {
      b = null;
    }
    if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) continue;
    const pad = 8;
    const x = b.x - pad;
    const y = b.y - pad;
    const w = b.width + pad * 2;
    const h = b.height + pad * 2;
    layer.lineStyle(5, color, 0.95);
    layer.beginFill(0x000000, 0);
    layer.drawRoundedRect(x, y, w, h, 10);
    layer.endFill();
  }
}

function flashAction(step, validationColor) {
  const layer = ensureFxLayer();
  if (!layer || !state.app) return;
  clearFx();
  layer.alpha = 1;

  const validarPressed = Number(step?.validado) === 1;
  if (validarPressed && validationColor != null) {
    drawCenteredValidationOutline(validationColor);
  }
}

function parseDifficulties(json) {
  const difficultyNames = ['Starter', 'Junior', 'Expert', 'Master'];
  const hasDifficulties = difficultyNames.some((name) => json && Object.prototype.hasOwnProperty.call(json, name));
  const difficulties = [];

  if (hasDifficulties) {
    for (let idx = 0; idx < difficultyNames.length; idx++) {
      const obj = json[difficultyNames[idx]] || {};
      const startLevel = idx * 25 + 1;
      const page = [];
      for (let i = 0; i < 25; i++) {
        const globalLevel = startLevel + i;
        const key = `nivel${globalLevel}`;
        const entry = obj[key];
        let arr = [];
        if (Array.isArray(entry)) {
          const maybe = entry[0];
          arr = Array.isArray(maybe) ? maybe.slice() : [];
        }
        page.push(arr);
      }
      difficulties.push(page);
    }
    return difficulties;
  }

  const keys = Object.keys(json || {})
    .filter((k) => /^nivel\d+$/i.test(k))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
  const flat = keys.map((k) => {
    const entry = json[k];
    const arr = Array.isArray(entry) ? entry[0] : [];
    return Array.isArray(arr) ? arr.slice() : [];
  });
  for (let i = 0; i < flat.length; i += 25) difficulties.push(flat.slice(i, i + 25));
  return difficulties;
}

async function initApp() {
  if (state.initialized) return;

  const pixi = await import(PIXI_MODULE_URL);
  const figuraMod = await import('/admin/js/Figura.js');
  const selMod = await import('/admin/js/SeleccionarNivel.js');
  const nivelMod = await import('/admin/js/Nivel.js');

  state.Application = pixi.Application;
  state.Assets = pixi.Assets;
  state.Sprite = pixi.Sprite;
  state.Graphics = pixi.Graphics;
  state.Figura = figuraMod.Figura;
  state.SeleccionarNivel = selMod.SeleccionarNivel;
  state.Nivel = nivelMod.Nivel;

  const { Application, Assets, Sprite, Figura, SeleccionarNivel, Nivel } = state;

  const app = new Application();
  await app.init({
    background: '#1099bb',
    resizeTo: window,
    backgroundAlpha: 0.7,
    preference: 'webgl',
    antialias: false,
  });
  app.canvas.style.position = 'absolute';
  app.canvas.style.inset = '0';
  app.canvas.style.pointerEvents = 'none';
  document.getElementById('app').appendChild(app.canvas);
  state.app = app;

  try {
    const wp = await Assets.load('/images/wallpaper-plain.png');
    const bg = new Sprite(wp);
    bg.anchor.set(0);
    bg.x = 0;
    bg.y = 0;
    bg.zIndex = 0;
    const fitBg = () => {
      bg.width = app.screen.width;
      bg.height = app.screen.height;
    };
    fitBg();
    app.stage.addChild(bg);
    state.wallpaperBg = bg;
    state.fitWallpaper = fitBg;
    if (!app.stage.sortableChildren) app.stage.sortableChildren = true;
    window.addEventListener('resize', fitBg);

    Figura.wallpaperBgRef = bg;
    Figura.wallpaperTintEnabled = false;
    Figura.setWallpaperTexture = async () => {
      try {
        const tex = await Assets.load('/images/wallpaper-plain.png');
        if (Figura.wallpaperBgRef) {
          Figura.wallpaperBgRef.texture = tex;
          if (state.fitWallpaper) state.fitWallpaper();
        }
      } catch {}
    };
  } catch {}

  const baseHeight = 1080;
  const scaleFactor = Math.max(0.5, app.screen.height / baseHeight);
  Figura.escala_imagenes_origen = 0.5 * scaleFactor;
  Figura.escala_imagenes_seleccionadas = 1.3 * scaleFactor;
  Figura.appRef = app;

  SeleccionarNivel.init(app, scaleFactor);
  Nivel.init(app, scaleFactor);

  const res = await fetch('/Solucionario.json');
  const json = await res.json();
  const difficulties = parseDifficulties(json);
  state.difficulties = difficulties;
  SeleccionarNivel.setSolutions(difficulties);

  try {
    if (SeleccionarNivel.selectorContainer) SeleccionarNivel.selectorContainer.visible = false;
  } catch {}

  state.initialized = true;
  ensureFxLayer();
  setLabel('Replay preparat.');
}

async function ensureLevel(levelNumber) {
  const n = Number(levelNumber);
  if (!Number.isInteger(n) || n <= 0) return false;
  if (state.levelLoaded === n) return true;

  await initApp();

  const { Nivel } = state;
  const selectorProxy = {
    difficulties: state.difficulties,
    hide() {},
    markLevelStarted() {},
    markLevelCompleted() {},
    markLevelAbandoned() {},
  };

  await Nivel.loadLevel(n, selectorProxy);

  try {
    const app = state.app;
    const stack = [...app.stage.children];
    while (stack.length) {
      const item = stack.pop();
      try {
        if (item && item.eventMode) item.eventMode = 'none';
        if (item && Object.prototype.hasOwnProperty.call(item, 'cursor')) item.cursor = 'default';
      } catch {}
      if (item && item.children && item.children.length) {
        for (const ch of item.children) stack.push(ch);
      }
    }
  } catch {}

  state.levelLoaded = n;
  return true;
}

function applyStep(step, stepIndex = 0, total = 0) {
  if (!step) {
    clearSelectedStack();
    setLabel('Sense pas actiu');
    return;
  }

  clearSelectedStack();

  for (let i = 1; i <= 5; i++) {
    const figId = Number(step[`figura_${i}`] || 0);
    if (!Number.isInteger(figId) || figId <= 0) continue;
    const rotationRaw = step[`rotacion_figura_${i}`];
    const fig = getGridFigureById(figId);
    if (!fig) continue;
    try {
      fig.centralize();
      fig.rotation = toRotationRad(rotationRaw);
    } catch {}
  }

  try {
    state.Figura && state.Figura.updateSelectionUI && state.Figura.updateSelectionUI();
  } catch {}

  const valColor = validationColorForStep(step);
  flashAction(step, valColor);

  const tsMs = new Date(step.tiempo_partida || 0).getTime();
  const relMs = Number.isFinite(tsMs) && Number.isFinite(state.replayStartTsMs)
    ? Math.max(0, tsMs - state.replayStartTsMs)
    : 0;
  const rel = Number.isFinite(tsMs) && Number.isFinite(state.replayStartTsMs)
    ? formatRelativeMs(relMs)
    : 't+00:00';

  try {
    state.Nivel && state.Nivel.setReplayElapsed && state.Nivel.setReplayElapsed(relMs);
  } catch {}

  const level = step.id_nivel ?? '-';
  const stateNum = step.id_num_estado_partida ?? '-';
  setLabel(`Replay · Nivell ${level} · Pas ${stepIndex + 1}/${total} · Estat ${stateNum} · ${rel}`);
}

async function setReplayData(payload) {
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  state.currentSteps = steps;
  state.currentStepIndex = -1;
  state.replayStartTsMs = null;

  if (!steps.length) {
    setLabel('Sense passos per reproduir.');
    return;
  }

  const firstMs = new Date(steps[0]?.tiempo_partida || 0).getTime();
  if (Number.isFinite(firstMs)) state.replayStartTsMs = firstMs;

  const first = steps[0];
  const level = Number(first?.id_nivel || 0);
  const ok = await ensureLevel(level);
  if (!ok) {
    setLabel('No s\'ha pogut carregar el nivell del replay.');
    return;
  }

  await showStep(0);
}

async function showStep(index) {
  if (!state.currentSteps.length) return;
  const i = Math.max(0, Math.min(state.currentSteps.length - 1, Number(index) || 0));
  state.currentStepIndex = i;

  const step = state.currentSteps[i];
  const level = Number(step?.id_nivel || 0);
  if (state.levelLoaded !== level) {
    const ok = await ensureLevel(level);
    if (!ok) return;
  }
  applyStep(step, i, state.currentSteps.length);
}

window.addEventListener('message', async (event) => {
  const data = event?.data || {};
  if (typeof data !== 'object' || !data.type) return;

  try {
    if (data.type === 'admin-replay-init') {
      await setReplayData(data.payload || {});
      return;
    }
    if (data.type === 'admin-replay-step') {
      await showStep(data.payload?.index ?? 0);
      return;
    }
    if (data.type === 'admin-replay-clear') {
      state.currentSteps = [];
      state.currentStepIndex = -1;
      state.replayStartTsMs = null;
      clearSelectedStack();
      clearFx();
      setLabel('Replay reiniciat.');
    }
  } catch (e) {
    setLabel(`Error replay: ${e?.message || 'desconegut'}`);
  }
});

initApp().catch((e) => {
  setLabel(`Error d'inicialització: ${e?.message || 'desconegut'}`);
});
