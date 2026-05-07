import { Container, Graphics, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { Menu } from './Menu.js';
import { Figura } from './Figura.js';
import { Nivel } from './Nivel.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';

export const Tutorial = {
  init(app, scaleFactor){
    this.app = app;
    this.scaleFactor = scaleFactor || 1;
    this.container = new Container();
    this.container.zIndex = 5000;
    this.container.visible = false;
    if(app.stage){
      if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
      app.stage.addChild(this.container);
    }
    // Optional legacy texts API; JSON will override if present
    this.texts = [];
    this.textStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: Math.floor(28 * this.scaleFactor),
      fill: 0x000000,
      wordWrap: true,
      wordWrapWidth: Math.floor(app.screen.width * 0.38)
    });
    // Pages loaded from Tutorial.json: [{ image, text, tex }]
    this._pages = [];
    this._current = 0;
    this._imageSprite = null;
    this._textLabel = null;
    this._arrowRight = null;
    this._arrowLeft = null;
    this._backBtn = null;
    this._playBtn = null;
  },

  setTexts(arr){
    if(Array.isArray(arr)) this.texts = arr.slice();
  },

  async _ensurePages(){
    // If pages already loaded, keep them
    if(Array.isArray(this._pages) && this._pages.length > 0) return;
    // Try to load from Tutorial.json first
    try{
      const res = await fetch('/Tutorial.json');
      if(res && res.ok){
        const data = await res.json();
        let candidates = [];
        // Flexible formats supported:
        // { pages: [{ image: 'images/tutorial1.png', text: '...' }, ...] }
        // [ { image: '...', text: '...' }, ... ]
        // { tutorial1: { image, text }, tutorial2: { ... } }
        if(Array.isArray(data)) candidates = data;
        else if(Array.isArray(data?.pages)) candidates = data.pages;
        else if(data && typeof data === 'object') candidates = Object.values(data);
        const pages = [];
        for(const entry of candidates){
          const rawImage = (entry && (entry.image || entry.img || entry.path || entry.imagen || entry.imagen_es)) || null;
          const text = (entry && (entry.text || entry.descripcion || entry.descripcion_es || entry.texto)) || '';
          let image = rawImage;
          if(image && !/^https?:\/\//i.test(image) && !image.startsWith('/images/')){
            image = image.startsWith('images/') ? `/${image}` : `/images/${image}`;
          }
          if(!image) continue;
          try{
            const tex = await Assets.load(image);
            pages.push({ image, text, tex });
          }catch(e){ /* skip invalid image */ }
        }
        if(pages.length > 0){
          this._pages = pages;
          return;
        }
      }
    }catch(e){ /* ignore and fallback */ }

    // Fallback: scan images/tutorialN.png and use legacy texts if present
    const pages = [];
    for(let i=1;i<=50;i++){
      const path = `/images/tutorial${i}.png`;
      try{
        const tex = await Assets.load(path);
        if(tex){
          const txt = this.texts[i-1] || `Tutorial ${i}`;
          pages.push({ image: path, text: txt, tex });
        }
      }catch(e){ /* ignore missing */ }
    }
    this._pages = pages;
  },

  _layout(){
    const app = this.app;
    const scale = this.scaleFactor;
    this.container.removeChildren();

    if(!this._pages || this._pages.length === 0){
      const info = new Text('No s’han trobat tutorials', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(32*scale), fill: 0xe74c3c }));
      info.anchor.set(0.5);
      info.x = Math.floor(app.screen.width / 2);
      info.y = Math.floor(app.screen.height / 2);
      this.container.addChild(info);
      this._addBackButton();
      return;
    }

    const page = this._pages[this._current];
    const tex = page.tex;
    const img = new Sprite(tex);
    img.anchor.set(0.5);
    // Place image on the left side
    img.x = Math.floor(app.screen.width * 0.23); // tiny shift to the left
    img.y = Math.floor(app.screen.height * 0.55); // slightly lower
    // Fit image within left half, preserving aspect
    const maxW = Math.floor(app.screen.width * 0.45);
    const maxH = Math.floor(app.screen.height * 0.7);
    const sx = maxW / tex.width;
    const sy = maxH / tex.height;
    const fit = Math.min(sx, sy) * 0.88; // slightly smaller
    img.scale.set(fit);
    this.container.addChild(img);
    this._imageSprite = img;

    // Text on the right side
    const textStr = page.text || `Tutorial ${this._current + 1}`;
    const sideMargin = Math.floor(24 * scale);
    const textX = Math.min(
      Math.floor(img.x + img.width / 2 + Math.max(16 * scale, 20)),
      Math.floor(app.screen.width - sideMargin)
    );
    const availableRight = Math.max(120, Math.floor(app.screen.width - sideMargin - textX));
    const label = new Text(textStr, this.textStyle);
    label.style.wordWrap = true;
    // Constrain text so it doesn't extend beyond 80% of screen width
    const maxEndX = Math.floor(app.screen.width * 0.8);
    const limitWidth = Math.max(0, maxEndX - textX);
    const wrapWidth = Math.max(60, Math.min(availableRight, limitWidth));
    label.style.wordWrapWidth = wrapWidth;
    label.anchor.set(0, 0.5);
    label.x = textX;
    label.y = Math.floor(app.screen.height * 0.5);
    this.container.addChild(label);
    this._textLabel = label;

    if(this._pages.length > 1){
      this._addArrows();
    }
    if(this._current === this._pages.length - 1){
      this._addPlayButton();
    }
    this._addBackButton();
  },

  _addArrows(){
    const app = this.app;
    const scale = this.scaleFactor;
    const hasPrev = this._current > 0;
    const hasNext = this._current < this._pages.length - 1;

    // Right arrow (next)
    const aw = Math.floor(48 * scale), ah = Math.floor(72 * scale);
    if(hasNext){
      const r = new Graphics();
      r.beginFill(0x2c3e50).moveTo(0, -ah/2).lineTo(aw, 0).lineTo(0, ah/2).lineTo(0, -ah/2).endFill();
      r.x = Math.floor(app.screen.width * 0.93);
      r.y = Math.floor(app.screen.height * 0.5);
      r.eventMode = 'static'; r.cursor = 'pointer';
      r.on('pointertap', () => {
        if(this._current < this._pages.length - 1){
          this._current++;
          this._layout();
        }
      });
      this.container.addChild(r);
      this._arrowRight = r;
    }

    // Left arrow (previous)
    if(hasPrev){
      const l = new Graphics();
      l.beginFill(0x2c3e50).moveTo(0, 0).lineTo(aw, -ah/2).lineTo(aw, ah/2).lineTo(0, 0).endFill();
      l.x = Math.floor(app.screen.width * 0.07);
      l.y = Math.floor(app.screen.height * 0.5);
      l.eventMode = 'static'; l.cursor = 'pointer';
      l.on('pointertap', () => {
        if(this._current > 0){
          this._current--;
          this._layout();
        }
      });
      this.container.addChild(l);
      this._arrowLeft = l;
    }
  },

  _addBackButton(){
    const app = this.app;
    const scale = this.scaleFactor;
    const bw = Math.floor(220 * scale), bh = Math.floor(56 * scale), br = Math.floor(14 * scale);
    const cont = new Container();
    const bg = new Graphics();
    bg.beginFill(0x7f8c8d).drawRoundedRect(0, 0, bw, bh, br).endFill();
    const tt = new Text('Tornar al menú', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(20*scale), fontWeight: 'bold', fill: 0xffffff }));
    tt.anchor.set(0.5);
    tt.x = bw/2; tt.y = bh/2;
    cont.addChild(bg); cont.addChild(tt);
    cont.x = Math.floor(app.screen.width * 0.05);
    cont.y = Math.floor(app.screen.height * 0.88);
    cont.eventMode = 'static'; cont.cursor = 'pointer';
    cont.on('pointertap', () => { this.hide(); Menu && Menu.show && Menu.show(); });
    this.container.addChild(cont);
    this._backBtn = cont;
  },

  _addPlayButton(){
    const app = this.app;
    const scale = this.scaleFactor;
    const bw = Math.floor(180 * scale), bh = Math.floor(56 * scale), br = Math.floor(14 * scale);
    const cont = new Container();
    const bg = new Graphics();
    bg.beginFill(0x27ae60).drawRoundedRect(0, 0, bw, bh, br).endFill();
    const tt = new Text('A jugar!', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(22 * scale), fontWeight: 'bold', fill: 0xffffff }));
    tt.anchor.set(0.5);
    tt.x = bw / 2;
    tt.y = bh / 2;
    cont.addChild(bg);
    cont.addChild(tt);
    const centerTargetX = Math.floor(app.screen.width / 2 - bw / 2);
    const textRight = this._textLabel ? Math.floor(this._textLabel.x + this._textLabel.width) : Math.floor(app.screen.width * 0.58);
    const minRightOfTextX = textRight + Math.floor(20 * scale);
    const maxX = Math.floor(app.screen.width - bw - 24 * scale);
    cont.x = Math.min(maxX, Math.max(centerTargetX, minRightOfTextX));
    cont.y = this._textLabel
      ? Math.floor(this._textLabel.y - bh / 2)
      : Math.floor(app.screen.height * 0.84);
    cont.eventMode = 'static';
    cont.cursor = 'pointer';
    cont.on('pointertap', async () => {
      try{ this.hide(); }catch(e){}
      try{ await Nivel.loadLevel(1, SeleccionarNivel); }catch(e){}
    });
    this.container.addChild(cont);
    this._playBtn = cont;
  },

  async show(){
    if(!this.app) return;
    // Keep the existing wallpaper from menu (do not change texture or tint here)
    // Hide menu while tutorial is visible
    try{ Menu.hide && Menu.hide(); }catch(e){}

    this.container.visible = true;
    await this._ensurePages();
    // Always start from the first tutorial page when opening
    this._current = 0;
    this._layout();
  },

  hide(){
    this.container.visible = false;
  }
};

export default Tutorial;
