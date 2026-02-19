import { Container, Graphics, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { Figura } from './Figura.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { ValidarResultado } from './ValidarResultado.js';
import { Victoria } from './Victoria.js';

let levelUiContainer = null;
let finalAreaBox = null;
let centerAreaBox = null;
let backBtn = null;
let resetSelectedBtn = null;
let modalContainer = null; // legacy; victory modal moved to Victoria.js
let timerText = null;
let levelStartTime = null;
let currentGrid = [];
let currentLevel = null;
let levelTitleText = null;

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
const addTimer = (app, scaleFactor) => {
  removeTimer(app);
  const style = new TextStyle({
    fontFamily: 'Arial',
    fontSize: Math.floor(48 * scaleFactor), // doubled size
    fontWeight: 'bold',
    fill: 0x2c3e50,
    // Improve readability with outline and shadow
    stroke: 0xffffff,
    strokeThickness: Math.max(2, Math.floor(4 * scaleFactor)),
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 2,
    dropShadowAngle: Math.PI / 6,
    dropShadowDistance: Math.max(2, Math.floor(2 * scaleFactor))
  });
  const t = new Text('⌛ 00 : 00', style);
  t.anchor.set(0.5);
  const leftThirdW = Math.floor(app.screen.width / 3);
  t.x = Math.floor(leftThirdW / 2);
  t.y = Math.floor(app.screen.height / 8);
  levelUiContainer.addChild(t);
  timerText = t;
  levelStartTime = performance.now();
  app.ticker.add(updateTimer);
};

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

const removeAreaBoxes = (app) => {
  try{
    if(finalAreaBox){ finalAreaBox.parent && finalAreaBox.parent.removeChild(finalAreaBox); finalAreaBox.destroy && finalAreaBox.destroy(); finalAreaBox = null; }
    if(centerAreaBox){ centerAreaBox.parent && centerAreaBox.parent.removeChild(centerAreaBox); centerAreaBox.destroy && centerAreaBox.destroy(); centerAreaBox = null; }
  }catch(e){}
};

const addAreaBoxes = (app, scaleFactor) => {
  removeAreaBoxes(app);
  const stroke = 0x2c3e50;
  const fill = 0xffffff;
  const r = Math.floor(18 * scaleFactor);
  const size = Math.floor(Math.min(app.screen.width, app.screen.height) * 0.32);
  const w = size;
  const h = size;
  const makeBox = () => {
    const g = new Graphics();
    g.lineStyle(3, stroke, 1);
    g.beginFill(fill, 1);
    g.drawRoundedRect(-w/2, -h/2, w, h, r);
    g.endFill();
    g.zIndex = 0.9; // below sprites (>=1), above background
    return g;
  };
  const boxFinal = makeBox();
  boxFinal.x = Math.round(app.screen.width / 2);
  boxFinal.y = Math.round(app.screen.height / 3);
  const boxCenter = makeBox();
  boxCenter.x = Math.round(app.screen.width / 2);
  boxCenter.y = Math.round(app.screen.height * 2 / 3);
  app.stage.addChild(boxFinal);
  app.stage.addChild(boxCenter);
  if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
  finalAreaBox = boxFinal;
  centerAreaBox = boxCenter;
};

const removeLevelTitle = () => {
  if(levelTitleText){
    try{ levelTitleText.parent && levelTitleText.parent.removeChild(levelTitleText); }catch(e){}
    try{ levelTitleText.destroy && levelTitleText.destroy(); }catch(e){}
    levelTitleText = null;
  }
};

const addLevelTitle = (app, scaleFactor) => {
  removeLevelTitle();
  // Create a centered title above the figura_final area
  const titleStr = `Nivel ${currentLevel ?? ''}`;
  const style = new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(42*scaleFactor), fontWeight: '900', fill: 0x000000 });
  const t = new Text(titleStr, style);
  t.anchor.set(0.5);
  t.x = Math.floor(app.screen.width / 2);
  // Match the selector title height: selector uses marginTop=160*scaleFactor and places at marginTop*0.5
  t.y = Math.floor(80 * scaleFactor);
  try{ t.zIndex = 5; }catch(e){}
  levelUiContainer.addChild(t);
  levelTitleText = t;
};

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
        const appRef = this.app;
        try{ appRef && appRef.ticker && appRef.ticker.remove(updateTimer); }catch(e){}
        const endTime = performance.now();
        const elapsedMs = levelStartTime ? (endTime - levelStartTime) : 0;
        const timeText = formatElapsed(elapsedMs);
        Victoria.show({
          app: appRef,
          scaleFactor: this.scaleFactor,
          currentLevel,
          timeText,
          onRepeat: async () => {
            try{ Victoria.hide(appRef); }catch(e){}
            await this.loadLevel(currentLevel, SeleccionarNivel);
          },
          onNext: async () => {
            try{ Victoria.hide(appRef); }catch(e){}
            const diffs = SeleccionarNivel?.difficulties || [];
            const next = (currentLevel || 1) + 1;
            const totalPages = Array.isArray(diffs) ? diffs.length : 0;
            const totalLevels = totalPages * 25;
            const levelHasData = (n) => {
              const idx0 = Math.max(0, (n|0) - 1);
              const p = Math.floor(idx0 / 25);
              const w = idx0 % 25;
              const pageArr = Array.isArray(diffs[p]) ? diffs[p] : [];
              const entry = pageArr[w];
              return Array.isArray(entry) && entry.length > 0;
            };
            if(next <= totalLevels && levelHasData(next)){
              await this.loadLevel(next, SeleccionarNivel);
            }else{
              await backToSelector();
            }
          },
          onBackToMenu: async () => {
            try{ Victoria.hide(appRef); }catch(e){}
            await backToSelector();
          }
        });
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
      // Use plain wallpaper and tint according to difficulty page
      try{ if(Figura && Figura.setWallpaperTexture) await Figura.setWallpaperTexture('plain'); }catch(e){}
      try{ if(Figura && Figura.setWallpaperTint) Figura.setWallpaperTint(page); }catch(e){}
      const pageArr = Array.isArray(diffs[page]) ? diffs[page] : [];
      solucion = Array.isArray(pageArr[within]) ? pageArr[within] : [];
    }catch(e){ solucion = []; }
    Figura.figura_final = solucion;
    await Figura.applyFinal();
    addAreaBoxes(app, scaleFactor);
    addLevelTitle(app, scaleFactor);
    showValidationUi();
    currentGrid = await createGrid(app, 18, 3, 2/3, 'images/bloque', '.png', { top: Math.floor(125*scaleFactor), bottom: Math.floor(100*scaleFactor), innerH: Math.floor(24*scaleFactor), innerV: Math.floor(24*scaleFactor) });
    addBackButton(app, scaleFactor);
    await addResetSelectedButton(app);
    addTimer(app, scaleFactor);
  },
  
  cleanupLevelUi(){
    const app = this.app || Figura.appRef;
    // Remove grid figures and UI buttons
    clearGrid();
    removeBackButton();
    removeResetSelectedButton();
    // Remove area boxes and level title
    if(app) removeAreaBoxes(app);
    removeLevelTitle();
    // Hide validation UI and timer
    hideValidationUi();
    if(app) removeTimer(app);
    // Fully disable and clear selection UI while in selector
    try{
      if(Figura.selectionContainer){
        Figura.selectionContainer.visible = false;
        Figura.selectionContainer.eventMode = 'none';
        Figura.selectionContainer.interactiveChildren = false;
        try{ Figura.selectionContainer.removeChildren(); }catch(e){}
      }
    }catch(e){}
    // Reset stacks and clear final sprites
    try{ Figura.selectedStack = []; }catch(e){}
    try{ Figura.figura_final = []; ValidarResultado.applyFinal(Figura); }catch(e){}
    // Hide and clear the level container
    if(levelUiContainer){
      try{ levelUiContainer.removeChildren(); }catch(e){}
      levelUiContainer.visible = false;
    }
  },
  
};

async function backToSelector(){
  const app = Figura.appRef;
  // Proactively cleanup all level UI elements before showing selector
  try{ Nivel.cleanupLevelUi && Nivel.cleanupLevelUi(); }catch(e){}
  try{ removeResetSelectedButton(); }catch(e){}
  // Hide any victory modal if present
  try{ Victoria && Victoria.hide && Victoria.hide(app); }catch(e){}
  // Show selector (it also performs its own cleanup/tinting)
  try{ SeleccionarNivel && SeleccionarNivel.show && SeleccionarNivel.show(); }catch(e){}
}

export default Nivel;
