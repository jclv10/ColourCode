import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Figura } from './Figura.js';
import { Nivel } from './Nivel.js';
import { Menu } from './Menu.js';

export const SeleccionarNivel = {
  init(app, scaleFactor){
    this.app = app;
    this.scaleFactor = scaleFactor || 1;
    this.selectorContainer = new Container();
    this.selectorContainer.zIndex = 1;
    app.stage.addChild(this.selectorContainer);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
    this.completedLevels = new Set((() => { try{ return JSON.parse(localStorage.getItem('completedLevels') || '[]'); }catch{ return []; } })());
    // Difficulty paging (0: Starter, 1: Junior, 2: Expert, 3: Master)
    try{
      const stored = parseInt(localStorage.getItem('currentDifficultyPage') || '0', 10);
      this.currentPage = isNaN(stored) ? 0 : stored;
    }catch{ this.currentPage = 0; }
    this.arrowLeft = null;
    this.arrowRight = null;
  },

  // Accept difficulties as array of arrays: [Starter[], Junior[], Expert[], Master[]]
  setSolutions(difficulties){ this.difficulties = Array.isArray(difficulties) ? difficulties : []; },

  saveCompleted(){ try{ localStorage.setItem('completedLevels', JSON.stringify(Array.from(this.completedLevels))); }catch(e){} },

  async show(){
    const app = this.app; const scaleFactor = this.scaleFactor;
    // Delegate to Nivel for cleanup of level UI
    try{ Nivel.cleanupLevelUi(); }catch(e){}
    // Hide selection UI and validation
    try{ if(Figura.selectionContainer) Figura.selectionContainer.visible = false; }catch(e){}
    try{ Figura.figura_final = []; Figura.applyFinal(); }catch(e){}

    const container = this.selectorContainer;
    container.removeChildren();
    container.visible = true;
    const totalPages = Array.isArray(this.difficulties) ? this.difficulties.length : 0;
    if(totalPages === 0) return;
    this.currentPage = Math.max(0, Math.min(totalPages - 1, this.currentPage));
    try{ localStorage.setItem('currentDifficultyPage', String(this.currentPage)); }catch(e){}
    // Use plain wallpaper and tint by current difficulty page
    try{ if(Figura && Figura.setWallpaperTexture) await Figura.setWallpaperTexture('plain'); }catch(e){}
    try{ if(Figura && Figura.setWallpaperTint) Figura.setWallpaperTint(this.currentPage); }catch(e){}

    // Compute page area and layout
    const marginSide = Math.floor(64 * scaleFactor);
    const marginBottom = Math.floor(64 * scaleFactor);
    const marginTop = Math.floor(160 * scaleFactor);
    const usableW = app.screen.width - marginSide * 2;
    const usableH = app.screen.height - marginTop - marginBottom;
    const areaW = Math.floor(usableW * 0.85);
    const areaH = Math.floor(usableH * 0.85);
    const areaX = Math.floor((app.screen.width - areaW) / 2);
    const areaY = Math.floor(marginTop + (usableH - areaH) / 2);

    // Title centered at top, indicating current difficulty
    const difficultyNames = ['Starter', 'Junior', 'Expert', 'Master'];
    const titleText = difficultyNames[Math.max(0, Math.min(difficultyNames.length - 1, this.currentPage))] || 'Starter';
    const title = new Text(titleText, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(46*scaleFactor), fontWeight: '900', fill: 0x000000 }));
    title.anchor.set(0.5);
    title.x = Math.floor(app.screen.width / 2);
    // Place above the grid area without overlapping
    title.y = Math.floor(marginTop * 0.5);
    container.addChild(title);
    const pageLevels = this.difficulties[this.currentPage] || [];
    // Force 5x5 grid layout
    const cols = 5;
    const rows = 5;
    const pageCount = cols * rows; // always 25 cells
    const gap = Math.floor(18*scaleFactor);
    const cellW = Math.floor((areaW - (cols-1)*gap) / cols);
    const cellH = Math.floor((areaH - (rows-1)*gap) / rows);

    for(let i=0;i<pageCount;i++){
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = areaX + col * (cellW + gap);
      const y = areaY + row * (cellH + gap);
      const idx = this.currentPage * 25 + i + 1; // global level number (1-based)
      const completed = this.completedLevels.has(idx);
      const hasData = Array.isArray(pageLevels[i]) && pageLevels[i].length > 0;
      const btn = new Graphics();
      const color = completed ? 0x2ecc71 : (hasData ? 0x3498db : 0x7f8c8d);
      btn.beginFill(color).drawRoundedRect(0, 0, cellW, cellH, Math.floor(14*scaleFactor)).endFill();
      btn.x = x; btn.y = y;
      if(hasData){
        btn.eventMode = 'static'; btn.cursor = 'pointer';
        btn.on('pointertap', () => Nivel.loadLevel(idx, this));
      }else{
        btn.eventMode = 'none'; btn.cursor = null;
      }

      const txt = new Text(String(idx), new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(32*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
      txt.anchor.set(0.5); txt.x = x + cellW/2; txt.y = y + cellH/2;

      container.addChild(btn);
      container.addChild(txt);
    }

    this.addResetProgressButton();
    this.addDifficultyArrows(areaX, areaY, areaW, areaH, totalPages);
    this.addBackToMenuButton();
  },

  hide(){ if(this.selectorContainer) this.selectorContainer.visible = false; },

  addBackToMenuButton(){
    const app = this.app; const scaleFactor = this.scaleFactor; const container = this.selectorContainer;
    if(this.backBtn){ try{ this.backBtn.parent && this.backBtn.parent.removeChild(this.backBtn); this.backBtn.destroy && this.backBtn.destroy({ children: true }); }catch(e){} this.backBtn = null; }
    const w = Math.floor(220*scaleFactor), h = Math.floor(44*scaleFactor), r = Math.floor(10*scaleFactor);
    const c = new Container();
    const g = new Graphics();
    g.beginFill(0x34495e).drawRoundedRect(0, 0, w, h, r).endFill();
    const t = new Text('Volver al menú', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(18*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
    t.anchor.set(0.5); t.x = w/2; t.y = h/2;
    c.addChild(g); c.addChild(t);
    c.x = Math.floor(24*scaleFactor);
    c.y = Math.floor(24*scaleFactor);
    c.eventMode = 'static'; c.cursor = 'pointer';
    c.on('pointertap', () => { try{ this.hide(); }catch(e){} try{ Menu.show && Menu.show(); }catch(e){} });
    container.addChild(c);
    this.backBtn = c;
  },

  addResetProgressButton(){
    const app = this.app; const scaleFactor = this.scaleFactor; const container = this.selectorContainer;
    if(this.resetBtn){ try{ this.resetBtn.parent && this.resetBtn.parent.removeChild(this.resetBtn); this.resetBtn.destroy && this.resetBtn.destroy({ children: true }); }catch(e){} this.resetBtn = null; }
    const w = Math.floor(220*scaleFactor), h = Math.floor(44*scaleFactor), r = Math.floor(10*scaleFactor);
    const c = new Container();
    const g = new Graphics();
    g.beginFill(0xe74c3c).drawRoundedRect(0, 0, w, h, r).endFill();
    const t = new Text('Borrar progreso', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(18*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
    t.anchor.set(0.5); t.x = w/2; t.y = h/2;
    c.addChild(g); c.addChild(t);
    c.x = Math.floor(app.screen.width - w - 24*scaleFactor);
    c.y = Math.floor(24*scaleFactor);
    c.eventMode = 'static'; c.cursor = 'pointer';
    c.on('pointertap', () => this.showConfirmResetModal());
    container.addChild(c);
    this.resetBtn = c;
  },

  addDifficultyArrows(areaX, areaY, areaW, areaH, totalPages){
    const app = this.app; const scaleFactor = this.scaleFactor; const container = this.selectorContainer;
    // Remove previous arrows
    if(this.arrowLeft){ try{ this.arrowLeft.parent && this.arrowLeft.parent.removeChild(this.arrowLeft); this.arrowLeft.destroy && this.arrowLeft.destroy({ children: true }); }catch(e){} this.arrowLeft = null; }
    if(this.arrowRight){ try{ this.arrowRight.parent && this.arrowRight.parent.removeChild(this.arrowRight); this.arrowRight.destroy && this.arrowRight.destroy({ children: true }); }catch(e){} this.arrowRight = null; }

    const centerY = areaY + Math.floor(areaH / 2);
    const makeArrow = (direction) => {
      const w = Math.floor(64*scaleFactor), h = Math.floor(64*scaleFactor);
      const g = new Graphics();
      g.beginFill(0x34495e).drawRoundedRect(-w/2, -h/2, w, h, Math.floor(12*scaleFactor)).endFill();
      const tri = new Graphics();
      tri.beginFill(0xffffff);
      if(direction === 'left'){
        tri.moveTo( w*0.2, 0);
        tri.lineTo( w*0.6, -h*0.35);
        tri.lineTo( w*0.6,  h*0.35);
      }else{
        tri.moveTo(-w*0.2, 0);
        tri.lineTo(-w*0.6, -h*0.35);
        tri.lineTo(-w*0.6,  h*0.35);
      }
      tri.endFill();
      const c = new Container();
      c.addChild(g); c.addChild(tri);
      tri.x = 0; tri.y = 0;
      c.eventMode = 'static'; c.cursor = 'pointer';
      return c;
    };

    if(this.currentPage > 0){
      const left = makeArrow('left');
      left.x = areaX - Math.floor(80*scaleFactor);
      left.y = centerY;
      left.on('pointertap', () => { this.currentPage = Math.max(0, this.currentPage - 1); try{ localStorage.setItem('currentDifficultyPage', String(this.currentPage)); }catch(e){} this.show(); });
      container.addChild(left);
      this.arrowLeft = left;
    }
    if(this.currentPage < totalPages - 1){
      const right = makeArrow('right');
      right.x = areaX + areaW + Math.floor(80*scaleFactor);
      right.y = centerY;
      right.on('pointertap', () => { this.currentPage = Math.min(totalPages - 1, this.currentPage + 1); try{ localStorage.setItem('currentDifficultyPage', String(this.currentPage)); }catch(e){} this.show(); });
      container.addChild(right);
      this.arrowRight = right;
    }
  },

  showConfirmResetModal(){
    const app = this.app; const scaleFactor = this.scaleFactor;
    this.hideModal();
    const overlay = new Graphics();
    overlay.beginFill(0x000000, 0.55).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
    overlay.eventMode = 'static';

    const panelW = Math.floor(Math.min(560*scaleFactor, app.screen.width*0.9));
    const panelH = Math.floor(Math.min(280*scaleFactor, app.screen.height*0.7));
    const panelX = Math.floor((app.screen.width - panelW)/2);
    const panelY = Math.floor((app.screen.height - panelH)/2);
    const panel = new Graphics();
    panel.beginFill(0x2c3e50).drawRoundedRect(panelX, panelY, panelW, panelH, Math.floor(16*scaleFactor)).endFill();
    panel.lineStyle(3, 0x34495e).drawRoundedRect(panelX, panelY, panelW, panelH, Math.floor(16*scaleFactor));

    const title = new Text('ADVERTENCIA', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(34*scaleFactor), fontWeight: '900', fill: 0xf1c40f }));
    title.anchor.set(0.5); title.x = panelX + panelW/2; title.y = panelY + Math.floor(60*scaleFactor);

    const msg = new Text('Quieres eliminar tu progreso?', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(22*scaleFactor), fill: 0xffffff }));
    msg.anchor.set(0.5); msg.x = panelX + panelW/2; msg.y = panelY + Math.floor(120*scaleFactor);

    const makeBtn = (label, fill, cb) => {
      const bw = Math.floor(120*scaleFactor), bh = Math.floor(44*scaleFactor), br = Math.floor(10*scaleFactor);
      const cont = new Container();
      const bg = new Graphics();
      bg.beginFill(fill).drawRoundedRect(-bw/2, -bh/2, bw, bh, br).endFill();
      const tt = new Text(label, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(18*scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
      tt.anchor.set(0.5);
      cont.addChild(bg); cont.addChild(tt);
      cont.eventMode = 'static'; cont.cursor = 'pointer';
      cont.on('pointertap', cb);
      return cont;
    };

    const btnYes = makeBtn('Sí', 0xe74c3c, () => {
      this.completedLevels.clear();
      this.saveCompleted();
      this.hideModal();
      this.show();
    });
    const btnNo = makeBtn('No', 0x7f8c8d, () => this.hideModal());
    btnYes.x = panelX + panelW/2 - Math.floor(80*scaleFactor);
    btnNo.x  = panelX + panelW/2 + Math.floor(80*scaleFactor);
    const btnY = panelY + panelH - Math.floor(60*scaleFactor);
    btnYes.y = btnY; btnNo.y = btnY;

    this.modalContainer = new Container();
    this.modalContainer.zIndex = 9999;
    this.modalContainer.addChild(overlay);
    this.modalContainer.addChild(panel);
    this.modalContainer.addChild(title);
    this.modalContainer.addChild(msg);
    this.modalContainer.addChild(btnYes);
    this.modalContainer.addChild(btnNo);
    app.stage.addChild(this.modalContainer);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
  },

  hideModal(){
    const m = this.modalContainer;
    if(m){ try{ m.parent && m.parent.removeChild(m); m.destroy && m.destroy({ children: true }); }catch(e){} this.modalContainer = null; }
  },
};

export default SeleccionarNivel;
