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
          const style = new TextStyle({ fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: 0x00aa00, align: 'center' });
          cls._validateLabel = new Text('', style);
          cls._validateLabel.anchor.set(0.5);
          cls._validateLabel.zIndex = 10001;
          app.stage.addChild(cls._validateLabel);
        }
        cls._validateLabel.visible = true;
        cls._validateLabel.text = '';
        cls._validateLabel.style.fill = 0x00aa00;
        cls._validateLabel.x = Math.round(app.screen.width / 2);
        cls._validateLabel.y = Math.round(app.screen.height / 6);
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
    if(centered.length === 0 || finals.length === 0){
      ValidarResultado.showValidateMessage(false, 'Estas figuras no coinciden', cls);
      return;
    }
    const size = Math.max(256, Math.ceil(Math.max(app.screen.width, app.screen.height) / 2));
    const rtA = RenderTexture.create({ width: size, height: size });
    const rtB = RenderTexture.create({ width: size, height: size });
    const tempA = new Container();
    const tempB = new Container();
    const bgA = new Graphics().beginFill(0xffffff).drawRect(0,0,size,size).endFill();
    const bgB = new Graphics().beginFill(0xffffff).drawRect(0,0,size,size).endFill();
    tempA.addChild(bgA);
    tempB.addChild(bgB);
    const cloneInto = (srcList, target) => {
      srcList.forEach((s)=>{
        const spr = new Sprite(s.texture);
        spr.anchor.set(0.5);
        spr.x = size/2;
        spr.y = size/2;
        const sx = (s.scale?.x != null) ? s.scale.x : (typeof s.scale === 'number' ? s.scale : 1);
        const sy = (s.scale?.y != null) ? s.scale.y : (typeof s.scale === 'number' ? s.scale : 1);
        spr.scale.set(sx, sy);
        spr.rotation = s.rotation || 0;
        target.addChild(spr);
      });
    };
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
    const sum = (buf) => { let s = 0; for(let i=0;i<buf.length;i++) s = (s + buf[i]) >>> 0; return s; };
    if(!a || !b || a.length !== b.length){
      equal = false;
    }else{
      for(let i=0;i<a.length;i++){
        if(a[i] !== b[i]){ mismatches++; equal = false; break; }
      }
    }
    try{ console.log('[Validate] size', size, 'lenA', a.length, 'lenB', b.length, 'sumA', sum(a), 'sumB', sum(b), 'mismatchCount', mismatches); }catch(e){}
    ValidarResultado.showValidateMessage(equal, equal ? 'Victoria' : 'Estas figuras no coinciden', cls);
    try{ if(typeof cls.onValidation === 'function') cls.onValidation(equal); }catch(e){}
    rtA.destroy(true); rtB.destroy(true);
    tempA.destroy({ children: true }); tempB.destroy({ children: true });
  },

  showValidateMessage(success, text, FiguraCls){
    const cls = FiguraCls; const app = cls.appRef; if(!app) return;
    try{
      if(!cls._validateLabel){
        const style = new TextStyle({ fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: 0x00aa00, align: 'center' });
        cls._validateLabel = new Text('', style);
        cls._validateLabel.anchor.set(0.5);
        cls._validateLabel.zIndex = 10001;
        app.stage.addChild(cls._validateLabel);
      }
      cls._validateLabel.text = text || '';
      cls._validateLabel.style.fill = success ? 0x2ecc71 : 0xe74c3c;
      cls._validateLabel.x = Math.round(app.screen.width / 2);
      cls._validateLabel.y = Math.round(app.screen.height / 6);
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
