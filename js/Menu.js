import { Container, Assets, Sprite, Circle, Graphics, Text, TextStyle } from 'pixi.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { Figura } from './Figura.js';
import { Tutorial } from './Tutorial.js';
import { Database as DB } from './Database.js';

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
      this.menuTexture = await Assets.load('/images/menu.png');
    }

    const sprite = new Sprite(this.menuTexture);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    sprite.on('pointertap', (e) => this._onTap(e));

    this.container.addChild(sprite);
    this.sprite = sprite;

    this._fit();

    // Add user emoji button above tutorial
    this._addUserButton();

    // Show user form popup if not set or skipped
    const profile = this._getUserProfile();
    if(!profile || profile.skipped){
      this._showUserPopup(profile);
    }

    // Add explicit Tutorial button on the menu
    this._addTutorialButton();

    // Removed: reset progress button now lives inside the user popup

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

    // Place user button above tutorial button
    if(this._userBtn && this._tutorialBtn){
      const bw = Math.floor(this._userBtn.width);
      const bh = Math.floor(this._userBtn.height);
      const gap = Math.floor(16 * this.scaleFactor);
      this._userBtn.x = this._tutorialBtn.x;
      this._userBtn.y = Math.max(0, this._tutorialBtn.y - (bh + gap));
    }

    // Place reset button below tutorial button
    // Reset button removed from menu; now part of user popup
  },

  _onTap(e){
    if(!this.sprite || !this.menuTexture) return;

    // Get local coordinates relative to sprite center (anchor 0.5)
    const local = this.sprite.toLocal(e.global);
    const dx = local.x;
    const dy = local.y;

    // Keep click region near the wheel area without custom containsPoint overrides.
    // This avoids fragile interaction internals on some browsers/GPUs.
    const rx = Math.max(1, this.sprite.width * 0.5);
    const ry = Math.max(1, this.sprite.height * 0.5);
    const nx = dx / rx;
    const ny = dy / ry;
    if((nx * nx + ny * ny) > 1.0) return;

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
  },

  _addUserButton(){
    const cont = new Container();
    const bw = Math.floor(64 * this.scaleFactor);
    const bh = Math.floor(64 * this.scaleFactor);
    const br = Math.floor(20 * this.scaleFactor);
    const bg = new Graphics();
    bg.beginFill(0x8e44ad).drawRoundedRect(0, 0, bw, bh, br).endFill();
    const emoji = this._getUserEmoji();
    const tt = new Text(emoji, new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(36 * this.scaleFactor) }));
    tt.anchor.set(0.5); tt.x = bw/2; tt.y = bh/2;
    cont.addChild(bg); cont.addChild(tt);
    cont.eventMode = 'static'; cont.cursor = 'pointer';
    cont.on('pointertap', () => this._showUserPopup(this._getUserProfile()));
    this.container.addChild(cont);
    this._userBtn = cont;

    // Place above tutorial button
    if(this._tutorialBtn){
      const margin = Math.floor(16 * this.scaleFactor);
      cont.x = this._tutorialBtn.x;
      cont.y = Math.max(0, this._tutorialBtn.y - (bh + margin));
    }
  },

  

  _getUserProfile(){
    try{
      const raw = localStorage.getItem('userProfile');
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },

  _setUserProfile(profile){
    try{ localStorage.setItem('userProfile', JSON.stringify(profile)); }catch(e){}
    // Update emoji button
    if(this._userBtn){
      try{
        const emoji = this._getUserEmoji();
        const label = this._userBtn.children?.find(c => c instanceof Text);
        if(label) label.text = emoji;
      }catch(e){}
    }
  },

  _getUserEmoji(){
    const p = this._getUserProfile();
    if(!p || p.skipped) return '👤';
    if(p.genere === 'home') return '👦';
    if(p.genere === 'dona') return '👧';
    if(p.genere === 'altre') return '👤';
    return '👤';
  },

  // Build alpha map for the current menu texture and set precise hit testing
  _enableAlphaHitTesting(sprite){
    const tex = sprite?.texture;
    if(!tex) return;
    try{
      const canvas = this._getTextureCanvas(tex);
      if(!canvas) return;
      const w = canvas.width, h = canvas.height;
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, w, h);
      this._menuAlpha = img.data; // RGBA array
      this._menuAlphaW = w; this._menuAlphaH = h;
      const anchorX = sprite.anchor?.x ?? 0.5;
      const anchorY = sprite.anchor?.y ?? 0.5;
      const frame = tex?.frame; // pixel-space rect within baseTexture
      const bt = tex?.baseTexture;
      const btW = bt?.width || w; // pixel width of base texture
      const btH = bt?.height || h; // pixel height of base texture
      const tw = tex?.width || (frame?.width ?? w); // local units width
      const th = tex?.height || (frame?.height ?? h); // local units height
      const fX = frame?.x || 0;
      const fY = frame?.y || 0;
      const fW = frame?.width || btW;
      const fH = frame?.height || btH;
      const threshold = 12; // slightly higher to ignore anti-aliased fringe
      // Override containsPoint for pixel-perfect hit test
      sprite.containsPoint = (global) => {
        const local = sprite.toLocal(global);
        // Reject outside the sprite's local bounds
        const lx = local.x + tw * anchorX;
        const ly = local.y + th * anchorY;
        if(lx < 0 || ly < 0 || lx >= tw || ly >= th) return false;
        // Map local units (0..tw, 0..th) to pixel coords within base texture frame
        const px = Math.floor(fX + (lx / tw) * fW);
        const py = Math.floor(fY + (ly / th) * fH);
        if(px < 0 || py < 0 || px >= this._menuAlphaW || py >= this._menuAlphaH) return false;
        const idx = (py * this._menuAlphaW + px) * 4 + 3; // alpha channel
        const a = this._menuAlpha[idx] || 0;
        return a >= threshold;
      };
    }catch(e){ /* fallback silently */ }
  },

  // Obtain a canvas for the texture source (image -> canvas)
  _getTextureCanvas(texture){
    const base = texture?.baseTexture;
    const res = base?.resource;
    const source = (res && (res.source || res.element)) || null;
    try{
      if(source && (source.naturalWidth || source.width)){
        const w = source.naturalWidth || source.width;
        const h = source.naturalHeight || source.height;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(source, 0, 0, w, h);
        return cv;
      }
    }catch(e){}
    try{ return this.app?.renderer?.extract?.canvas(base); }catch(e){ return null; }
  },

  // Draw a semi-transparent overlay showing the clickable area (sampled grid)
  _drawHitAreaDebug(sprite, step = 4){
    if(!this._menuAlpha || !this._menuAlphaW || !this._menuAlphaH) return;
    try{ if(this._hitAreaDebug){ this._hitAreaDebug.parent && this._hitAreaDebug.parent.removeChild(this._hitAreaDebug); this._hitAreaDebug.destroy && this._hitAreaDebug.destroy({ children: true }); this._hitAreaDebug = null; } }catch(e){}
    const g = new Graphics();
    const w = this._menuAlphaW, h = this._menuAlphaH;
    const threshold = 8;
    g.beginFill(0x2ecc71, 0.25);
    for(let y = 0; y < h; y += step){
      for(let x = 0; x < w; x += step){
        const idx = (y * w + x) * 4 + 3;
        const a = this._menuAlpha[idx] || 0;
        if(a >= threshold){
          g.drawRect(x, y, step, step);
        }
      }
    }
    g.endFill();
    // Attach overlay to the sprite to inherit position/scale automatically
    const anchorX = sprite.anchor?.x ?? 0.5;
    const anchorY = sprite.anchor?.y ?? 0.5;
    g.x = -w * anchorX;
    g.y = -h * anchorY;
    g.eventMode = 'none'; // non-interactive; do not block pointer
    sprite.addChild(g);
    this._hitAreaDebug = g;
  },

  _showUserPopup(existing){
    // Create DOM overlay form
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.width = 'min(420px, 90vw)';
    box.style.background = '#fff';
    box.style.borderRadius = '12px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    box.style.padding = '20px 24px';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.color = '#000';

    const title = document.createElement('h2');
    title.textContent = 'Perfil d’usuari';
    title.style.margin = '0 0 12px 0';
    title.style.color = '#000';

    const close = document.createElement('button');
    close.textContent = '✖';
    close.title = 'Tancar';
    close.style.float = 'right';
    close.style.border = 'none';
    close.style.background = 'transparent';
    close.style.fontSize = '18px';
    close.style.cursor = 'pointer';
    close.style.color = '#000';
    close.onclick = () => {
      // mark skipped if no data
      const profile = this._getUserProfile();
      if(!profile){ this._setUserProfile({ skipped: true }); }
      overlay.remove();
    };

    const form = document.createElement('form');
    const readOnly = !!(existing && existing.skipped === false);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const edat = Number(ageInput.value);
      const genere = genderSelect.value;
      const ma_habil = handSelect.value;
      // Add user emoji button above tutorial
      if(!(genere === 'home' || genere === 'dona' || genere === 'altre')){ alert('Gènere invàlid'); return; }
      if(!(ma_habil === 'esquerra' || ma_habil === 'dreta')){ alert('Mà hàbil invàlida'); return; }
      try{
        // Disable actions during submit
        submit.disabled = true; cancel.disabled = true;
        statusEl.textContent = 'Guardant…';
        const res = await DB.createUsuari({ edat, genere, ma_habil });
        const profile = { id_usuari: res.id_usuari, edat: res.edat, genere: res.genere, ma_habil: res.ma_habil, skipped: false };
        this._setUserProfile(profile);
        overlay.remove();
      }catch(e){
        const msg = 'Error guardant usuari: ' + (e?.message || '');
        statusEl.textContent = msg;
      }finally{
        submit.disabled = false; cancel.disabled = false;
      }
    };

    const labelStyle = 'display:block;margin:10px 0 6px;font-weight:bold;color:#000;';
    const inputStyle = 'width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font-size:14px;color:#000;background:#fff;';

    const ageLabel = document.createElement('label');
    ageLabel.textContent = 'Edat (1-99)';
    ageLabel.style = labelStyle;
    const ageInput = document.createElement('input');
    ageInput.type = 'number';
    ageInput.min = '1';
    ageInput.max = '99';
    ageInput.required = true;
    if(readOnly) ageInput.disabled = true;
    ageInput.style = inputStyle;
    ageInput.value = existing?.edat ?? '';

    const genderLabel = document.createElement('label');
    genderLabel.textContent = 'Gènere (selecciona Home, Dona o Altre/Prefereix no dirho)';
    genderLabel.style = labelStyle;
    const genderSelect = document.createElement('select');
    genderSelect.required = true;
    if(readOnly) genderSelect.disabled = true;
    genderSelect.style = inputStyle;
    const optPlaceholderGender = document.createElement('option'); optPlaceholderGender.value = ''; optPlaceholderGender.textContent = 'Selecciona gènere'; optPlaceholderGender.disabled = true; optPlaceholderGender.selected = !readOnly;
    const optHome = document.createElement('option'); optHome.value = 'home'; optHome.textContent = 'Home (noi)';
    const optDona = document.createElement('option'); optDona.value = 'dona'; optDona.textContent = 'Dona (noia)';
    const optAltre = document.createElement('option'); optAltre.value = 'altre'; optAltre.textContent = 'Altre / Prefereix no dirho';
    genderSelect.appendChild(optPlaceholderGender); genderSelect.appendChild(optHome); genderSelect.appendChild(optDona); genderSelect.appendChild(optAltre);
    if(readOnly && existing?.genere){ genderSelect.value = existing.genere; }

    const handLabel = document.createElement('label');
    handLabel.textContent = 'Mà hàbil (selecciona Esquerra o Dreta)';
    handLabel.style = labelStyle;
    const handSelect = document.createElement('select');
    handSelect.required = true;
    if(readOnly) handSelect.disabled = true;
    handSelect.style = inputStyle;
    const optPlaceholderHand = document.createElement('option'); optPlaceholderHand.value = ''; optPlaceholderHand.textContent = 'Selecciona mà hàbil'; optPlaceholderHand.disabled = true; optPlaceholderHand.selected = !readOnly;
    const optEsq = document.createElement('option'); optEsq.value = 'esquerra'; optEsq.textContent = 'Esquerra';
    const optDreta = document.createElement('option'); optDreta.value = 'dreta'; optDreta.textContent = 'Dreta';
    handSelect.appendChild(optPlaceholderHand); handSelect.appendChild(optEsq); handSelect.appendChild(optDreta);
    if(readOnly && existing?.ma_habil){ handSelect.value = existing.ma_habil; }

    const statusEl = document.createElement('div');
    statusEl.style = 'margin-top:8px;color:#2c3e50;font-size:13px;min-height:18px;';

    const actions = document.createElement('div');
    actions.style = 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px;';
    // Reset progress button inside the popup
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Esborrar progrés';
    reset.style = 'padding:8px 12px;border:none;border-radius:8px;background:#e74c3c;color:#fff;font-weight:bold;cursor:pointer;margin-right:auto;';
    reset.onclick = () => {
      const ok = window.confirm('Això esborrarà el progrés i el perfil. Vols continuar?');
      if(!ok) return;
      try{ localStorage.removeItem('userProfile'); }catch(e){}
      try{ localStorage.removeItem('completedLevels'); }catch(e){}
      try{ localStorage.removeItem('completedWithExtras'); }catch(e){}
      try{ localStorage.removeItem('abandonedLevels'); }catch(e){}
      try{ localStorage.removeItem('currentDifficultyPage'); }catch(e){}
      try{
        if(SeleccionarNivel && SeleccionarNivel.completedLevels){
          SeleccionarNivel.completedLevels.clear();
          SeleccionarNivel.saveCompleted && SeleccionarNivel.saveCompleted();
        }
        if(SeleccionarNivel && SeleccionarNivel.completedWithExtras){
          SeleccionarNivel.completedWithExtras.clear();
          SeleccionarNivel.saveCompletedWithExtras && SeleccionarNivel.saveCompletedWithExtras();
        }
        if(SeleccionarNivel && SeleccionarNivel.abandonedLevels){
          SeleccionarNivel.abandonedLevels.clear();
          SeleccionarNivel.saveAbandoned && SeleccionarNivel.saveAbandoned();
        }
        if(SeleccionarNivel){
          SeleccionarNivel.currentPage = 0;
        }
      }catch(e){}
      if(this._userBtn){
        try{
          const label = this._userBtn.children?.find(c => c instanceof Text);
          if(label) label.text = '👤';
        }catch(e){}
      }
      // Close current popup and prompt for new profile
      overlay.remove();
      this._showUserPopup(null);
    };
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Desar'; submit.style = 'padding:8px 12px;border:none;border-radius:8px;background:#2ecc71;color:#fff;font-weight:bold;cursor:pointer;';
    if(readOnly) submit.style.display = 'none';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel·lar'; cancel.style = 'padding:8px 12px;border:none;border-radius:8px;background:#bdc3c7;color:#2c3e50;font-weight:bold;cursor:pointer;';
    cancel.onclick = () => { overlay.remove(); };

    form.appendChild(ageLabel); form.appendChild(ageInput);
    form.appendChild(genderLabel); form.appendChild(genderSelect);
    form.appendChild(handLabel); form.appendChild(handSelect);
    // Put reset on the left (auto margin), cancel and submit on the right
    actions.appendChild(reset);
    actions.appendChild(cancel);
    actions.appendChild(submit);
    // Ensure submit button is inside the form so onsubmit triggers
    form.appendChild(statusEl);
    form.appendChild(actions);

    box.appendChild(close);
    box.appendChild(title);
    box.appendChild(form);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
};

export default Menu;
