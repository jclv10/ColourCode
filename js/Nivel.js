import { Container, Graphics, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { Figura } from './Figura.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { ValidarResultado } from './ValidarResultado.js';

let levelUiContainer = null;
let backBtn = null;
let resetSelectedBtn = null;
let modalContainer = null;
let timerText = null;
let levelStartTime = null;
let currentGrid = [];
let currentLevel = null;

const baseHeight = 1080;

async function createGrid(app, gridCount = 18, cols = 3, startXRatio = 2 / 3, texturePrefix = 'images/bloque', textureExt = '.png', padding = { top: 24, bottom: 24, innerH: 24, innerV: 24 }){
  const rows = Math.ceil(gridCount / cols);
  const rightStartX = Math.floor(startXRatio * app.screen.width);
  const gridWidth = app.screen.width - rightStartX - (padding.innerH || 0);
  const availableHeight = app.screen.height - (padding.top || 0) - (padding.bottom || 0);
  const cellW = gridWidth / cols;
  const cellH = availableHeight / rows;
  const gridFigures = [];
  for (let i = 0; i < gridCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = Math.floor(rightStartX + (padding.innerH || 0)/2 + col * cellW + cellW / 2);
    const y = Math.floor((padding.top || 0) + row * cellH + cellH / 2);
    const texturePath = `${texturePrefix}${i + 1}${textureExt}`;
    const fig = await Figura.create(app, x, y, `grid_${i + 1}`, texturePath, true);
    if(levelUiContainer && fig && fig.parent){ try{ fig.parent.removeChild(fig); }catch(e){} try{ levelUiContainer.addChild(fig); }catch(e){} }
    gridFigures.push(fig);
  }
  return gridFigures;
}

const removeBackButton = () => { if(backBtn){ try{ backBtn.parent && backBtn.parent.removeChild(backBtn); backBtn.destroy && backBtn.destroy({ children: true }); }catch(e){} backBtn = null; } };
const addBackButton = (app, scaleFactor) => {
  if(backBtn) return;
  const w = Math.floor(160*scaleFactor), h = Math.floor(48*scaleFactor), r = Math.floor(12*scaleFactor);
  const c = new Container();
  const g = new Graphics();
  g.beginFill(0x34495e).drawRoundedRect(0, 0, w, h, r).endFill();
  const t = new Text('Volver', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(20*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
  t.anchor.set(0.5);
  t.x = w/2; t.y = h/2;
  c.addChild(g); c.addChild(t);
  c.x = Math.floor(24*scaleFactor); c.y = Math.floor(24*scaleFactor);
  c.eventMode = 'static'; c.cursor = 'pointer';
  c.on('pointertap', async () => { await backToSelector(); });
  levelUiContainer.addChild(c);
  backBtn = c;
};

const hideValidationUi = () => { try{ if(Figura._validateButton) Figura._validateButton.visible = false; }catch(e){} try{ if(Figura._validateLabel) Figura._validateLabel.visible = false; }catch(e){} };
const showValidationUi = () => { try{ if(Figura._validateButton) Figura._validateButton.visible = true; }catch(e){} try{ if(Figura._validateLabel) Figura._validateLabel.visible = true; }catch(e){} };

const removeTimer = (app) => { if(timerText){ try{ timerText.parent && timerText.parent.removeChild(timerText); timerText.destroy && timerText.destroy(); }catch(e){} timerText = null; } levelStartTime = null; try{ app.ticker.remove(updateTimer); }catch(e){} };
const formatElapsed = (ms) => { const totalSec = Math.floor(ms/1000); const minutes = Math.floor(totalSec/60); const seconds = totalSec % 60; const pad = (n) => n.toString().padStart(2,'0'); return `⌛ ${pad(minutes)} : ${pad(seconds)}`; };
const updateTimer = () => { const app = Figura.appRef; if(!levelStartTime || !timerText || !app) return; const now = performance.now(); const elapsed = now - levelStartTime; timerText.text = formatElapsed(elapsed); };
const addTimer = (app, scaleFactor) => { removeTimer(app); const style = new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(24*scaleFactor), fontWeight: 'bold', fill: 0x2c3e50 }); const t = new Text('⌛ 00 : 00', style); t.anchor.set(0.5); const leftThirdW = Math.floor(app.screen.width / 3); t.x = Math.floor(leftThirdW / 2); t.y = Math.floor(app.screen.height / 8); levelUiContainer.addChild(t); timerText = t; levelStartTime = performance.now(); app.ticker.add(updateTimer); };

const addResetSelectedButton = async (app) => {
  if(resetSelectedBtn){ try{ resetSelectedBtn.parent && resetSelectedBtn.parent.removeChild(resetSelectedBtn); resetSelectedBtn.destroy && resetSelectedBtn.destroy({ children: true }); }catch(e){} resetSelectedBtn = null; }
  try{
    const tex = await Assets.load('images/btnReset.png');
    const spr = new Sprite(tex);
    spr.anchor.set(0.5);
    const leftThirdW = Math.floor(app.screen.width / 3);
    spr.x = Math.floor(leftThirdW / 2);
    spr.y = Math.round(app.screen.height * 5 / 6);
    const s = Math.max(0.6, Math.min(1.2, app.screen.height / baseHeight));
    spr.scale.set(s);
    spr.eventMode = 'static';
    spr.cursor = 'pointer';
    spr.zIndex = 5000;
    spr.on('pointertap', () => {
      try{
        const stackCopy = Figura.selectedStack.slice();
        stackCopy.forEach(f => { try{ f.descentralize(); }catch(e){} });
        Figura.selectedStack = [];
        try{ Figura.updateSelectionUI && Figura.updateSelectionUI(); }catch(e){}
      }catch(e){ console.error('Failed to reset selection', e); }
    });
    app.stage.addChild(spr);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
    resetSelectedBtn = spr;
  }catch(e){ console.error('Failed to load images/btnReset.png', e); }
};

const removeResetSelectedButton = () => {
  if(resetSelectedBtn){
    try{ resetSelectedBtn.parent && resetSelectedBtn.parent.removeChild(resetSelectedBtn); }catch(e){}
    try{ resetSelectedBtn.destroy && resetSelectedBtn.destroy({ children: true }); }catch(e){}
    resetSelectedBtn = null;
  }
};

const clearGrid = () => { if(currentGrid && currentGrid.length){ currentGrid.forEach(fig => { try{ fig.parent && fig.parent.removeChild(fig); fig.destroy && fig.destroy(); }catch(e){} }); currentGrid = []; } };

export const Nivel = {
  init(app, scaleFactor){
    this.app = app; this.scaleFactor = scaleFactor || Math.max(0.5, app.screen.height / baseHeight);
    levelUiContainer = new Container();
    levelUiContainer.zIndex = 2;
    app.stage.addChild(levelUiContainer);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;

    Figura.onValidation = (success) => {
      if(success && currentLevel != null){
        try{ SeleccionarNivel.completedLevels.add(currentLevel); SeleccionarNivel.saveCompleted(); }catch(e){}
        this.showVictoryModal();
      }
    };
  },

  async loadLevel(levelNumber, selectorModule){
    const app = this.app; const scaleFactor = this.scaleFactor;
    // Ensure previous grid figuras are removed before creating a new grid
    clearGrid();
    currentLevel = levelNumber;
    if(selectorModule){ selectorModule.hide(); }
    levelUiContainer.visible = true;
    try{ if(Figura.selectionContainer){ Figura.selectionContainer.eventMode = 'passive'; Figura.selectionContainer.interactiveChildren = true; } }catch(e){}
    try{ const stackCopy = (Figura.selectedStack || []).slice(); stackCopy.forEach(f => { try{ f.descentralize(); }catch(e){} }); Figura.selectedStack = []; try{ Figura.updateSelectionUI && Figura.updateSelectionUI(); }catch(e){} }catch(e){}
    try{ if(Figura.selectionContainer) Figura.selectionContainer.visible = true; }catch(e){}
    // Resolve composition from difficulties using global levelNumber (1-based)
    let solucion = [];
    try{
      const diffs = selectorModule?.difficulties || [];
      const globalIdx0 = Math.max(0, (levelNumber|0) - 1);
      const page = Math.floor(globalIdx0 / 25);
      const within = globalIdx0 % 25;
      // Tint wallpaper according to difficulty page
      try{ if(Figura && Figura.setWallpaperTint) Figura.setWallpaperTint(page); }catch(e){}
      const pageArr = Array.isArray(diffs[page]) ? diffs[page] : [];
      solucion = Array.isArray(pageArr[within]) ? pageArr[within] : [];
    }catch(e){ solucion = []; }
    Figura.figura_final = solucion;
    await Figura.applyFinal();
    showValidationUi();
    currentGrid = await createGrid(app, 18, 3, 2/3, 'images/bloque', '.png', { top: Math.floor(125*scaleFactor), bottom: Math.floor(100*scaleFactor), innerH: Math.floor(24*scaleFactor), innerV: Math.floor(24*scaleFactor) });
    addBackButton(app, scaleFactor);
    await addResetSelectedButton(app);
    addTimer(app, scaleFactor);
  },

  async backToSelector(){ await backToSelector(); },

  cleanupLevelUi(){
    const app = this.app || Figura.appRef;
    clearGrid();
    removeBackButton();
    removeResetSelectedButton();
    hideValidationUi();
    if(app) removeTimer(app);
    try{ if(Figura.selectionContainer) Figura.selectionContainer.visible = false; }catch(e){}
    try{ Figura.selectedStack = []; }catch(e){}
    try{ Figura.figura_final = []; ValidarResultado.applyFinal(Figura); }catch(e){}
    if(levelUiContainer) levelUiContainer.visible = false;
  },

  showVictoryModal(){
    const app = this.app; const scaleFactor = this.scaleFactor;
    if(!app) return;
    this.hideModal();
    try{ app.ticker.remove(updateTimer); }catch(e){}
    try{ if(Figura.selectionContainer){ Figura.selectionContainer.eventMode = 'none'; Figura.selectionContainer.interactiveChildren = false; } }catch(e){}
    try{
      const center = Array.isArray(Figura.posicion_central) ? Figura.posicion_central : [app.screen.width/2, app.screen.height/2];
      const cx = Math.floor(center[0]);
      const cy = Math.floor(center[1]);
      (Figura.selectedStack || []).forEach(f => { try{ f.eventMode = 'none'; f.cursor = null; }catch(e){} try{ f.x = cx; f.y = cy; }catch(e){} });
    }catch(e){}
    const endTime = performance.now();
    const elapsedMs = levelStartTime ? (endTime - levelStartTime) : 0;
    const timeText = formatElapsed(elapsedMs);
    const finalCount = Array.isArray(Figura.figura_final) ? Math.floor(Figura.figura_final.length / 2) : 0;
    const selectedCount = Array.isArray(Figura.selectedStack) ? Figura.selectedStack.length : 0;
    const extra = selectedCount - finalCount;
    let performanceMsg = '';
    if(extra > 0) performanceMsg = 'Lo puedes hacer mejor';
    else if(extra === 0) performanceMsg = 'Muy bien!';
    else performanceMsg = 'No sabía que se podía hacer eso. Increíble';

    const overlay = new Graphics();
    overlay.beginFill(0x000000, 0.55).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
    overlay.eventMode = 'static';
    const panelW = Math.floor(Math.min(640*scaleFactor, app.screen.width*0.92));
    const panelH = Math.floor(Math.min(360*scaleFactor, app.screen.height*0.8));
    const panelX = Math.floor((app.screen.width - panelW)/2);
    const panelY = Math.floor((app.screen.height - panelH)/2);
    const panel = new Graphics();
    panel.beginFill(0xffffff).drawRoundedRect(panelX, panelY, panelW, panelH, Math.floor(18*scaleFactor)).endFill();
    panel.lineStyle(3, 0x2ecc71).drawRoundedRect(panelX, panelY, panelW, panelH, Math.floor(18*scaleFactor));
    const title = new Text('Victoria!', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(38*scaleFactor), fontWeight: '900', fill: 0x2ecc71 }));
    title.anchor.set(0.5); title.x = panelX + panelW/2; title.y = panelY + Math.floor(60*scaleFactor);
    const timeLabel = new Text(timeText, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(24*scaleFactor), fill: 0x2c3e50 }));
    timeLabel.anchor.set(0.5); timeLabel.x = panelX + panelW/2; timeLabel.y = panelY + Math.floor(120*scaleFactor);
    const perfLabel = new Text(performanceMsg, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(22*scaleFactor), fill: 0x2c3e50 }));
    perfLabel.anchor.set(0.5); perfLabel.x = panelX + panelW/2; perfLabel.y = panelY + Math.floor(160*scaleFactor);
    const makeBtn = (label, fill, cb) => {
      const bw = Math.floor(180*scaleFactor), bh = Math.floor(48*scaleFactor), br = Math.floor(12*scaleFactor);
      const cont = new Container();
      const bg = new Graphics();
      bg.beginFill(fill).drawRoundedRect(-bw/2, -bh/2, bw, bh, br).endFill();
      const tt = new Text(label, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(18*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
      tt.anchor.set(0.5);
      const maxTextW = bw - Math.floor(16*scaleFactor);
      if(tt.width > maxTextW){ const factor = maxTextW / tt.width; tt.scale.set(Math.max(0.6, factor)); }
      cont.addChild(bg); cont.addChild(tt);
      cont.eventMode = 'static'; cont.cursor = 'pointer';
      cont.on('pointertap', cb);
      return cont;
    };
    const btnRepeat = makeBtn('Repetir', 0x3498db, async () => { this.hideModal(); await this.loadLevel(currentLevel, SeleccionarNivel); });
    const btnNext = makeBtn('Avanzar al siguiente nivel', 0x27ae60, async () => { this.hideModal(); const next = (currentLevel || 1) + 1; if(next <= (SeleccionarNivel.levelSolutions || []).length){ await this.loadLevel(next, SeleccionarNivel); }else{ await backToSelector(); } });
    const btnMenu = makeBtn('Volver al menú principal', 0x7f8c8d, async () => { this.hideModal(); await backToSelector(); });
    const btnY = panelY + panelH - Math.floor(70*scaleFactor);
    btnRepeat.x = panelX + Math.floor(panelW/2) - Math.floor(240*scaleFactor); btnRepeat.y = btnY;
    btnNext.x = panelX + Math.floor(panelW/2); btnNext.y = btnY;
    btnMenu.x = panelX + Math.floor(panelW/2) + Math.floor(240*scaleFactor); btnMenu.y = btnY;
    modalContainer = new Container();
    modalContainer.zIndex = 9999;
    modalContainer.addChild(overlay);
    modalContainer.addChild(panel);
    modalContainer.addChild(title);
    modalContainer.addChild(timeLabel);
    modalContainer.addChild(perfLabel);
    modalContainer.addChild(btnRepeat);
    modalContainer.addChild(btnNext);
    modalContainer.addChild(btnMenu);
    app.stage.addChild(modalContainer);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
  },

  hideModal(){ if(modalContainer){ try{ modalContainer.parent && modalContainer.parent.removeChild(modalContainer); modalContainer.destroy && modalContainer.destroy({ children: true }); }catch(e){} modalContainer = null; } },
};

async function backToSelector(){
  const app = Figura.appRef;
  removeResetSelectedButton();
  SeleccionarNivel && SeleccionarNivel.show();
}

export default Nivel;
