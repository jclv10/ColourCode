import { Container, Assets, Sprite, Circle, Graphics, Text, TextStyle } from 'pixi.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { Figura } from './Figura.js';
import { Tutorial } from './Tutorial.js';

export const Menu = {
  init(app, scaleFactor){
    this.app = app;
    this.scaleFactor = scaleFactor || 1;
    this.container = new Container();
    this.container.zIndex = 2;
    this.container.visible = false;
    app.stage.addChild(this.container);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
    this.sprite = null;
    this.menuTexture = null;
    this._boundResize = null;
  },

  async show(){
    if(!this.app) return;

    // Ensure selector is hidden while in menu
    try{ SeleccionarNivel.hide && SeleccionarNivel.hide(); }catch(e){}

    // Use logo wallpaper for the menu and keep it untinted
    try{ if(Figura && Figura.setWallpaperTexture){ await Figura.setWallpaperTexture('logo'); } }catch(e){}
    try{ if(Figura && Figura.wallpaperBgRef) Figura.wallpaperBgRef.tint = 0xFFFFFF; }catch(e){}

    this.container.removeChildren();
    this.container.visible = true;

    if(!this.menuTexture){
      this.menuTexture = await Assets.load('images/menu.png');
    }

    const sprite = new Sprite(this.menuTexture);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    // Restrict hits to a circle centered on the sprite to ignore transparent borders
    const radiusLocal = Math.min(this.menuTexture.width, this.menuTexture.height) * 0.48;
    sprite.hitArea = new Circle(0, 0, radiusLocal);

    sprite.on('pointertap', (e) => this._onTap(e));

    this.container.addChild(sprite);
    this.sprite = sprite;

    this._fit();

    // Add explicit Tutorial button on the menu
    this._addTutorialButton();

    // Handle window resize to keep menu centered and scaled
    this._unbindResize();
    this._boundResize = () => this._fit();
    window.addEventListener('resize', this._boundResize);
  },

  hide(){
    if(!this.container) return;
    this.container.visible = false;
    this._unbindResize();
  },

  _unbindResize(){
    if(this._boundResize){
      try{ window.removeEventListener('resize', this._boundResize); }catch(e){}
      this._boundResize = null;
    }
  },

  _fit(){
    if(!this.app || !this.sprite || !this.menuTexture) return;
    const { width: sw, height: sh } = this.app.screen;

    // Scale menu image to fit nicely on screen
    const maxW = sw * 0.6; // occupy ~60% of width
    const maxH = sh * 0.7; // occupy ~70% of height
    const sx = maxW / this.menuTexture.width;
    const sy = maxH / this.menuTexture.height;
    const scale = Math.min(sx, sy);
    this.sprite.scale.set(scale);

    // Center
    this.sprite.x = Math.floor(sw / 2);
    this.sprite.y = Math.floor(sh * 3 / 5);

    // If tutorial button exists, place it on the right side, vertically centered
    if(this._tutorialBtn){
      const margin = Math.floor(130 * this.scaleFactor);
      const btnW = Math.floor(this._tutorialBtn.width);
      const btnH = Math.floor(this._tutorialBtn.height);
      this._tutorialBtn.x = Math.floor(sw - margin - btnW);
      this._tutorialBtn.y = Math.floor(sh * 0.5 - btnH / 2);
    }
  },

  _onTap(e){
    if(!this.sprite || !this.menuTexture) return;

    // Get local coordinates relative to sprite center (anchor 0.5)
    const local = this.sprite.toLocal(e.global);
    const dx = local.x;
    const dy = local.y;

    // Only accept clicks within the circular hit area
    const r = Math.min(this.menuTexture.width, this.menuTexture.height) * 0.48;
    if(Math.hypot(dx, dy) > r) return; // ignore transparent space

    // Determine quadrant
    // Bottom-left: Starter (0)
    // Top-left: Junior (1)
    // Top-right: Expert (2)
    // Bottom-right: Master (3)
    let page = 0;
    if(dx < 0 && dy > 0) page = 0;           // Starter
    else if(dx < 0 && dy < 0) page = 1;      // Junior
    else if(dx > 0 && dy < 0) page = 2;      // Expert
    else if(dx > 0 && dy > 0) page = 3;      // Master

    try{ SeleccionarNivel.currentPage = page; }catch(e){}

    // Hide menu and show level selector for chosen difficulty
    this.hide();
    try{ SeleccionarNivel.show && SeleccionarNivel.show(); }catch(e){}
  },

  _addTutorialButton(){
    // Create a rounded rectangle button labeled "Tutorial"
    const bw = Math.floor(180 * this.scaleFactor);
    const bh = Math.floor(48 * this.scaleFactor);
    const br = Math.floor(12 * this.scaleFactor);
    const cont = new Container();
    const bg = new Graphics();
    bg.beginFill(0x3498db).drawRoundedRect(0, 0, bw, bh, br).endFill();
    const tt = new Text('Tutorial', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(18 * this.scaleFactor), fontWeight: 'bold', fill: 0xffffff }));
    tt.anchor.set(0.5); tt.x = bw/2; tt.y = bh/2;
    cont.addChild(bg); cont.addChild(tt);
    cont.eventMode = 'static'; cont.cursor = 'pointer';
    cont.on('pointertap', async () => { try{ await Tutorial.show(); }catch(e){} });
    this.container.addChild(cont);
    this._tutorialBtn = cont;
    this._fit();
  }
};

export default Menu;
