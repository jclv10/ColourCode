import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

// Selection stack + UI logic extracted from Figura
export const ElegirFigura = {
  addToSelected(figura, FiguraCls){
    const cls = FiguraCls;
    const existing = cls.selectedStack.indexOf(figura);
    if(existing !== -1) cls.selectedStack.splice(existing, 1);
    if(existing === -1 && cls.selectedStack.length >= cls.maxSelected){
      try{ ElegirFigura.flashSelectionFull(cls); }catch(e){}
      return;
    }
    cls.selectedStack.push(figura);
    const len = cls.selectedStack.length;
    cls.selectedStack.forEach((f, i) => {
      const z = cls.maxSelected - (len - 1 - i);
      try{ f.zIndex = z; }catch(e){}
    });
    try{ ElegirFigura.updateSelectionUI(cls); }catch(e){}
  },

  removeFromSelected(figura, FiguraCls){
    const cls = FiguraCls;
    const idx = cls.selectedStack.indexOf(figura);
    if(idx !== -1) cls.selectedStack.splice(idx, 1);
    try{ figura.zIndex = 0; }catch(e){}
    const len = cls.selectedStack.length;
    cls.selectedStack.forEach((f, i) => {
      const z = cls.maxSelected - (len - 1 - i);
      try{ f.zIndex = z; }catch(e){}
    });
    try{ ElegirFigura.updateSelectionUI(cls); }catch(e){}
  },

  ensureSelectionUI(FiguraCls){
    const cls = FiguraCls;
    if(!cls.appRef) return;
    if(cls.selectionContainer) return;
    try{
      const app = cls.appRef;
      const container = new Container();
      container.name = 'selection-ui';
      container.zIndex = 100000;
      container.x = 0;
      container.y = 0;
      cls.selectionContainer = container;
      if(app.stage){
        if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
        app.stage.addChild(container);
      }
      cls._selectionTickerRegistered = false;
      ElegirFigura.updateSelectionUI(cls);
    }catch(e){}
  },

  updateSelectionUI(FiguraCls){
    const cls = FiguraCls;
    if(!cls.appRef) return;
    if(cls._isDraggingSelection) return;
    ElegirFigura.ensureSelectionUI(cls);
    const app = cls.appRef;
    const container = cls.selectionContainer;
    if(!container) return;
    try{
      container.eventMode = 'passive';
      container.interactiveChildren = true;
      container.sortableChildren = true;
    }catch(e){}
    container.removeChildren();

    const n = cls.maxSelected;
    const cols = cls.selectionCell.cols || 2;
    const rows = Math.ceil(n / cols);
    const w = cls.selectionCell.width;
    const h = cls.selectionCell.height;
    const gap = cls.selectionCell.gap;
    const leftThirdWidth = Math.floor(app.screen.width / 3);

    const sampleStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 32, // doubled size to match visibility goal
      fontWeight: 'bold',
      fill: 0x000000,
      align: 'center',
      stroke: 0xffffff,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 1,
      dropShadowAngle: Math.PI / 6,
      dropShadowDistance: 2
    });
    const sampleLabel = new Text('0', sampleStyle);
    const labelHeight = sampleLabel.height;
    const labelMargin = 8;

    const rowBlock = labelHeight + labelMargin + h;
    const totalHeight = rows * rowBlock + (rows - 1) * gap;
    const startY = Math.round(app.screen.height / 2 - totalHeight / 2);

    const totalGridWidth = cols * w + (cols - 1) * gap;
    const left = Math.max(0, Math.round((leftThirdWidth - totalGridWidth) / 2));

    const recomputeZ = () => {
      const len = cls.selectedStack.length;
      cls.selectedStack.forEach((f, i2) => {
        const z = cls.maxSelected - (len - 1 - i2);
        try{ f.zIndex = z; }catch(e){}
      });
    };

    let dragInfo = null;

    for(let i = 0; i < n; i++){
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = left + col * (w + gap);
      const y = startY + row * (rowBlock + gap) + labelHeight + labelMargin;

      const occupied = i < cls.selectedStack.length;
      const borderColor = 0x999999;
      const borderRadius = 10;
      const border = new Graphics();
      if(occupied){
        // Transparent interior; only draw a subtle outline to keep grid visible
        border.lineStyle(2, borderColor, 0.8);
        border.drawRoundedRect(x, y, w, h, borderRadius);
      }else{
        border.beginFill(borderColor);
        border.drawRoundedRect(x, y, w, h, borderRadius);
        border.endFill();
      }
      try{ border.zIndex = 1; }catch(e){}
      const inset = 4;
      container.addChild(border);
      if(!occupied){
        const inner = new Graphics();
        inner.beginFill(0xffffff);
        inner.drawRoundedRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(6, borderRadius - 2));
        inner.endFill();
        try{ inner.zIndex = 2; }catch(e){}
        container.addChild(inner);
      }

      if(occupied){
        try{
          const src = cls.selectedStack[i];
          const tex = src && src.texture ? src.texture : null;
          if(tex){
            const thumb = new Sprite(tex);
            thumb.anchor.set(0.5);
            const availableH = Math.max(1, h * 0.78);
            const availableW = Math.max(1, w * 0.86);
            const texW = tex.width || (thumb.width || 1);
            const texH = tex.height || (thumb.height || 1);
            const scaleX = availableW / (texW * (Math.abs(src.scale?.x || 1)));
            const scaleY = availableH / (texH * (Math.abs(src.scale?.y || 1)));
            const fitFactor = Math.min(scaleX, scaleY, 1);
            const srcScaleX = src.scale?.x || 1;
            const srcScaleY = src.scale?.y || 1;
            thumb.scale.x = srcScaleX * fitFactor;
            thumb.scale.y = srcScaleY * fitFactor;
            thumb.rotation = src.rotation || 0;
            thumb.x = x + w / 2;
            thumb.y = y + h / 2 + 6;
            try{ thumb.eventMode = 'static'; }catch(e){}
            thumb.cursor = 'pointer';
            try{ thumb.zIndex = 10; }catch(e){}

            const onPointerDown = (e) => {
              const pos = e.global;
              cls._isDraggingSelection = true;
              dragInfo = { index: i, sprite: thumb, offsetX: pos.x - thumb.x, offsetY: pos.y - thumb.y, startX: pos.x, startY: pos.y, hasMoved: false };
            };
            const onPointerMove = (e) => {
              if(!dragInfo || dragInfo.sprite !== thumb) return;
              const pos = e.global;
              thumb.x = pos.x - dragInfo.offsetX;
              thumb.y = pos.y - dragInfo.offsetY;
              if(!dragInfo.hasMoved){
                const dx = Math.abs(pos.x - dragInfo.startX);
                const dy = Math.abs(pos.y - dragInfo.startY);
                if(dx > 3 || dy > 3) dragInfo.hasMoved = true;
              }
            };
            const onPointerUp = (e) => {
              if(!dragInfo || dragInfo.sprite !== thumb) return;
              const pos = e.global;
              const leftLimit = leftThirdWidth;
              if(pos.x > leftLimit){
                const fig = cls.selectedStack[dragInfo.index];
                try{ fig.descentralize(); }catch(err){}
                ElegirFigura.removeFromSelected(fig, cls);
                recomputeZ();
                dragInfo = null;
                cls._isDraggingSelection = false;
                ElegirFigura.updateSelectionUI(cls);
                return;
              }
              if(!dragInfo.hasMoved){
                try{
                  const f = cls.selectedStack[dragInfo.index];
                  if(f) f.clic_figura();
                }catch(err){}
                dragInfo = null;
                cls._isDraggingSelection = false;
                return;
              }
              const relX = Math.max(0, Math.min(leftThirdWidth, pos.x));
              const relY = pos.y;
              let targetCol = Math.round((relX - left) / (w + gap));
              targetCol = Math.max(0, Math.min(cols - 1, targetCol));
              let targetRow = Math.round((relY - (startY + labelHeight + labelMargin)) / (rowBlock + gap));
              targetRow = Math.max(0, Math.min(rows - 1, targetRow));
              let targetIndex = targetRow * cols + targetCol;
              targetIndex = Math.max(0, Math.min(cls.selectedStack.length - 1, targetIndex));
              const fromIndex = dragInfo.index;
              if(fromIndex !== targetIndex){
                const a = cls.selectedStack[fromIndex];
                const b = cls.selectedStack[targetIndex];
                cls.selectedStack[fromIndex] = b;
                cls.selectedStack[targetIndex] = a;
                recomputeZ();
              }
              dragInfo = null;
              cls._isDraggingSelection = false;
              ElegirFigura.updateSelectionUI(cls);
            };
            thumb.on('pointerdown', onPointerDown);
            thumb.on('pointermove', onPointerMove);
            thumb.on('pointerup', onPointerUp);
            thumb.on('pointerupoutside', onPointerUp);
            container.addChild(thumb);
          }
        }catch(e){}
      }
      const numStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 32, // doubled size
        fontWeight: 'bold',
        fill: 0x2c3e50,
        align: 'center',
        stroke: 0xffffff,
        strokeThickness: 2,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 1,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 2
      });
      const numTxt = new Text(String(i+1), numStyle);
      numTxt.x = x + (w - numTxt.width) / 2;
      numTxt.y = y - labelMargin - numTxt.height;
      container.addChild(numTxt);
    }
  },

  flashSelectionFull(FiguraCls){
    const cls = FiguraCls;
    const c = cls.selectionContainer;
    if(!c) return;
    const origScaleX = c.scale.x;
    const origScaleY = c.scale.y;
    let step = 0;
    const steps = 8;
    const interval = setInterval(() => {
      step++;
      const s = 1 + 0.04 * Math.sin((Math.PI * step) / steps);
      c.scale.set(s, s);
      if(step >= steps){
        clearInterval(interval);
        c.scale.set(origScaleX, origScaleY);
      }
    }, 30);
  },
};

export default ElegirFigura;
