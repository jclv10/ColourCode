import { Container, Graphics, RenderTexture, Sprite, Text, TextStyle } from 'pixi.js';

// Validation UI + pixel compare logic extracted from Figura
export const ValidarResultado = {
  async applyFinal(FiguraCls){
    const cls = FiguraCls;
    const app = cls.appRef;
    if(!app || !app.stage) return;
    app.stage.sortableChildren = true;
    if(cls._finalSprites && cls._finalSprites.length){
      try{ cls._finalSprites.forEach(s => s.parent && s.parent.removeChild(s)); }catch(e){}
      cls._finalSprites = [];
    }
    const x = Math.round(app.screen.width / 2);
    const y = Math.round(app.screen.height / 3);
    const arr = Array.isArray(cls.figura_final) ? cls.figura_final.slice() : [];
    for(let i = 0; i < arr.length; i += 2){
      const idOrPath = arr[i];
      const rotation = arr[i+1] ?? 0;
      if(idOrPath == null) continue;
      let path_textura = '';
      if(typeof idOrPath === 'number'){
        path_textura = `${cls.texturePrefix}bloque${idOrPath}.png`;
      }else if(typeof idOrPath === 'string'){
        path_textura = idOrPath.includes('/') ? idOrPath : `${cls.texturePrefix}${idOrPath}`;
      }else{
        continue;
      }
      try{
        const sprite = await cls.create(app, x, y, `final-${i/2}`, path_textura, false);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.rotation = rotation || 0;
        sprite.scale = cls.escala_imagenes_seleccionadas;
        sprite.zIndex = 1 + i/2;
        cls._finalSprites.push(sprite);
      }catch(e){ console.error('applyFinal: failed to load', path_textura, e); }
    }
    const hasFinal = cls._finalSprites && cls._finalSprites.length > 0;
    if(hasFinal){
      try{
        if(!cls._validateLabel){
          const style = new TextStyle({ fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: 0x000000, align: 'center' });
          cls._validateLabel = new Text('', style);
          cls._validateLabel.anchor.set(0.5);
          cls._validateLabel.zIndex = 10001;
          app.stage.addChild(cls._validateLabel);
        }
        // Prepare label out of the way; will show only on failure
        cls._validateLabel.visible = false;
        cls._validateLabel.text = '';
        cls._validateLabel.x = Math.round(app.screen.width / 2);
        cls._validateLabel.y = Math.round(app.screen.height * 0.12);
      }catch(e){}
      try{
        if(!cls._validateButton){
          const btn = new Container();
          btn.zIndex = 10000;
          const w = 180, h = 50, r = 12;
          const bg = new Graphics();
          bg.beginFill(0x2d7ef7);
          bg.drawRoundedRect(-w/2, -h/2, w, h, r);
          bg.endFill();
          const txtStyle = new TextStyle({ fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', fill: 0xffffff });
          const label = new Text('Validar', txtStyle);
          label.anchor.set(0.5);
          btn.addChild(bg);
          btn.addChild(label);
          btn.eventMode = 'static';
          btn.cursor = 'pointer';
          btn.on('pointertap', () => { try{ ValidarResultado.validateAgainstFinal(cls); }catch(e){ console.error(e); } });
          app.stage.addChild(btn);
          cls._validateButton = btn;
        }
        cls._validateButton.visible = true;
        cls._validateButton.x = Math.round(app.screen.width / 2);
        // Place Validate button near bottom
        cls._validateButton.y = Math.round(app.screen.height * 12 / 14);
      }catch(e){}
    }else{
      try{ if(cls._validateLabel) cls._validateLabel.visible = false; }catch(e){}
      try{ if(cls._validateButton) cls._validateButton.visible = false; }catch(e){}
    }
  },

  validateAgainstFinal(FiguraCls){
    const cls = FiguraCls;
    const app = cls.appRef;
    if(!app || !app.renderer) return;
    const centered = cls.selectedStack.slice().sort((a,b)=> (a.zIndex||0)-(b.zIndex||0));
    const finals = cls._finalSprites.slice().sort((a,b)=> (a.zIndex||0)-(b.zIndex||0));
    if(centered.length === 0){
      ValidarResultado.showValidateMessage(false, 'Todavía no has seleccionado ninguna figura', cls);
      return;
    }
    if(finals.length === 0){
      ValidarResultado.showValidateMessage(false, 'Estas figuras no coinciden', cls);
      return;
    }

    // Consistent offscreen size
    const size = Math.max(256, Math.ceil(Math.max(app.screen.width, app.screen.height) / 2));
    // Robust per-pixel compare parameters
    const ANGLES = [0, Math.PI/2, Math.PI, 3*Math.PI/2, 2*Math.PI];
    const alphaThreshold = 8;       // transparent if alpha below this
    const channelTolerance = 8;     // color channel tolerance
    const alphaTolerance = 8;       // alpha tolerance
    const maxMismatchRatio = 0.001; // allow up to 0.1% mismatched pixels

    const rtA = RenderTexture.create({ width: size, height: size });
    const rtB = RenderTexture.create({ width: size, height: size });
    const tempA = new Container();
    const tempB = new Container();
    const bgA = new Graphics().beginFill(0xffffff).drawRect(0,0,size,size).endFill();
    const bgB = new Graphics().beginFill(0xffffff).drawRect(0,0,size,size).endFill();
    tempA.addChild(bgA);
    tempB.addChild(bgB);

    const snapAngle = (r) => {
      if(!r) return 0;
      r = ((r % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
      let best = ANGLES[0]; let min = Math.abs(r - best);
      for(let i=1;i<ANGLES.length;i++){
        const d = Math.abs(r - ANGLES[i]);
        if(d < min){ min = d; best = ANGLES[i]; }
      }
      return best >= 2*Math.PI ? 0 : best;
    };

    // Helpers to detect filename for special-case rotation handling
    const getFilename = (spriteLike) => {
      try{
        const raw = spriteLike.originalTexturePath
          || spriteLike.texture?.baseTexture?.resource?.url
          || spriteLike.texture?.baseTexture?.resource?.src
          || (spriteLike.texture?.textureCacheIds ? spriteLike.texture.textureCacheIds[0] : '')
          || '';
        const clean = String(raw).split('?')[0].split('#')[0];
        const parts = clean.split('/');
        return parts[parts.length - 1] || clean;
      }catch(e){ return ''; }
    };
    const isBloque4 = (spriteLike) => {
      try{
        const name = getFilename(spriteLike).toLowerCase();
        return name === 'bloque4.png' || name.includes('bloque4.png');
      }catch(e){ return false; }
    };

    const cloneInto = (srcList, target) => {
      srcList.forEach((s)=>{
        const spr = new Sprite(s.texture);
        spr.anchor.set(0.5);
        spr.x = size/2;
        spr.y = size/2;
        const sx = (s.scale?.x != null) ? s.scale.x : (typeof s.scale === 'number' ? s.scale : 1);
        const sy = (s.scale?.y != null) ? s.scale.y : (typeof s.scale === 'number' ? s.scale : 1);
        spr.scale.set(sx, sy);
        // Special-case: ignore rotation for bloque4.png and assume 0
        spr.rotation = isBloque4(s) ? 0 : snapAngle(s.rotation || 0);
        try{ spr.roundPixels = true; }catch(e){}
        try{ const bt = spr.texture?.baseTexture; if(bt && bt.scaleMode != null){ bt.scaleMode = 0; } }catch(e){}
        target.addChild(spr);
      });
    };

    const prevRound = app.renderer.roundPixels ?? false;
    try{ app.renderer.roundPixels = true; }catch(e){}

    cloneInto(centered, tempA);
    cloneInto(finals, tempB);
    app.renderer.render(tempA, { renderTexture: rtA, clear: true });
    app.renderer.render(tempB, { renderTexture: rtB, clear: true });
    const canvasA = app.renderer.extract.canvas(rtA);
    const canvasB = app.renderer.extract.canvas(rtB);
    const a = canvasA.getContext('2d').getImageData(0, 0, canvasA.width, canvasA.height).data;
    const b = canvasB.getContext('2d').getImageData(0, 0, canvasB.width, canvasB.height).data;

    let equal = true;
    let mismatches = 0;
    const pixelCount = a && b && a.length === b.length ? (a.length >>> 2) : 0;
    if(!a || !b || a.length !== b.length){
      equal = false;
    }else{
      for(let i=0;i<a.length;i+=4){
        const ar = a[i], ag = a[i+1], ab = a[i+2], aa = a[i+3];
        const br = b[i], bg = b[i+1], bb = b[i+2], ba = b[i+3];
        const aTrans = aa < alphaThreshold;
        const bTrans = ba < alphaThreshold;
        if(aTrans && bTrans) continue;
        if(aTrans !== bTrans){ mismatches++; continue; }
        const dr = Math.abs(ar - br);
        const dg = Math.abs(ag - bg);
        const db = Math.abs(ab - bb);
        const da = Math.abs(aa - ba);
        if(dr > channelTolerance || dg > channelTolerance || db > channelTolerance || da > alphaTolerance){
          mismatches++;
        }
      }
      const maxMismatches = Math.floor(pixelCount * maxMismatchRatio);
      if(mismatches > maxMismatches){ equal = false; }
    }

    try{ app.renderer.roundPixels = prevRound; }catch(e){}
    // Only show failure message; success uses a separate victory popup
    if(!equal){
      ValidarResultado.showValidateMessage(false, '¡Ups! Las piezas no encajan. ¡Intenta otra vez!', cls);
    }
    try{ if(typeof cls.onValidation === 'function') cls.onValidation(equal); }catch(e){}
    rtA.destroy(true); rtB.destroy(true);
    tempA.destroy({ children: true }); tempB.destroy({ children: true });
  },

  showValidateMessage(success, text, FiguraCls){
    const cls = FiguraCls; const app = cls.appRef; if(!app) return;
    try{
      if(!cls._validateLabel){
        const style = new TextStyle({ fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: 0x000000, align: 'center' });
        cls._validateLabel = new Text('', style);
        cls._validateLabel.anchor.set(0.5);
        cls._validateLabel.zIndex = 10001;
        app.stage.addChild(cls._validateLabel);
      }
      // On success, do not show any label; popup handles feedback
      if(success){
        cls._validateLabel.visible = false;
        cls._validateLabel.alpha = 0;
        if(cls._validateLabel._fadeTimer){ clearTimeout(cls._validateLabel._fadeTimer); }
        return;
      }
      // Show error message positioned away from figura_final
      cls._validateLabel.text = text || 'Estas figuras no coinciden';
      cls._validateLabel.style.fill = 0xe74c3c;
      cls._validateLabel.x = Math.round(app.screen.width / 2);
      cls._validateLabel.y = Math.round(app.screen.height * 0.12);
      cls._validateLabel.visible = true;
      cls._validateLabel.alpha = 1;
      const duration = cls.validateMessageDurationMs || 1000;
      if(cls._validateLabel._fadeTimer){ clearTimeout(cls._validateLabel._fadeTimer); }
      cls._validateLabel._fadeTimer = setTimeout(() => {
        try{ cls._validateLabel.alpha = 0; }catch(e){}
      }, duration);
    }catch(e){ console.error(e); }
  },
};

export default ValidarResultado;
