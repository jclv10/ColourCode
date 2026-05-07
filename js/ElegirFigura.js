import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { ValidarResultado } from './ValidarResultado.js';

// Selection stack + UI logic extracted from Figura
export const ElegirFigura = {
  addToSelected(figura, FiguraCls){
    const cls = FiguraCls;
    const existing = cls.selectedStack.indexOf(figura);
    if(existing !== -1) cls.selectedStack.splice(existing, 1);
    if(existing === -1 && cls.selectedStack.length >= cls.maxSelected){
      // Show message and flash the attempted figura's grid cell in red
      try{ ValidarResultado.showValidateMessage(false, 'Només pots utilitzar 5 peces alhora', cls); }catch(e){}
      try{
        const bg = figura?._gridBackgroundRef;
        const dims = figura?._gridCellDims || {};
        const parent = bg?.parent;
        if(bg && parent){
          const w = Math.round(dims.w || (bg.width || 100));
          const h = Math.round(dims.h || (bg.height || 100));
          const r = Math.round(dims.r || 10);
          const overlay = new Graphics();
          overlay.beginFill(0xe74c3c, 0.9).drawRoundedRect(-w/2, -h/2, w, h, r).endFill();
          overlay.x = bg.x; overlay.y = bg.y;
          try{ overlay.zIndex = -0.5; }catch(e){}
          parent.addChild(overlay);
          let step = 0; const steps = 20;
          const interval = setInterval(() => {
            step++;
            overlay.alpha = Math.max(0, 0.9 * (1 - step / steps));
            if(step >= steps){
              clearInterval(interval);
              try{ parent.removeChild(overlay); overlay.destroy && overlay.destroy(); }catch(e){}
            }
          }, 30);
        }
      }catch(e){}
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
    const labelHeight = 0; // No longer need height since labels are on the side
    const labelMargin = 0; // No longer need margin

    const rowBlock = h; // Just the cell height, no label above
    const totalHeight = rows * rowBlock + (rows - 1) * gap;
    const startY = Math.round(app.screen.height / 2 - totalHeight / 2);

    const totalGridWidth = cols * w + (cols - 1) * gap;
    const left = Math.max(0, Math.round((leftThirdWidth - totalGridWidth) / 2) + (cls.selectionCell.leftOffset || 0));

    const recomputeZ = () => {
      const len = cls.selectedStack.length;
      cls.selectedStack.forEach((f, i2) => {
        const z = cls.maxSelected - (len - 1 - i2);
        try{ f.zIndex = z; }catch(e){}
      });
    };

    let dragInfo = null;

    // Helper to snap any rotation to exact quarter turns (0, 90, 180, 270)
    const snapQuarter = (rad) => {
      const step = Math.PI / 2;
      let k = Math.round((rad || 0) / step);
      // Normalize to [0, 2π)
      k = ((k % 4) + 4) % 4;
      return k * step;
    };

    for(let i = 0; i < n; i++){
      const row = (n - 1) - Math.floor(i / cols); // Reverse order: bottom to top
      const col = i % cols;
      const x = left + col * (w + gap);
      const y = startY + row * (rowBlock + gap);

      const occupied = i < cls.selectedStack.length;
      const borderColor = 0x999999;
      const borderRadius = 10;
      const border = new Graphics();
      border.lineStyle(4, borderColor, 1); // Same thick stroke for all cells
      if(occupied){
        // Transparent interior; only draw a subtle outline to keep grid visible
        border.beginFill(0x000000, 0); // Transparent fill needed for stroke to render
        border.drawRoundedRect(x, y, w, h, borderRadius);
        border.endFill();
      }else{
        border.beginFill(borderColor);
        border.drawRoundedRect(x, y, w, h, borderRadius);
        border.endFill();
      }
      try{ border.zIndex = 1; }catch(e){}
      try{ border.eventMode = 'none'; }catch(e){} // Disable interaction to prevent blocking
      const inset = 4;
      container.addChild(border);
      if(!occupied){
        const inner = new Graphics();
        inner.beginFill(0xffffff);
        inner.drawRoundedRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(6, borderRadius - 2));
        inner.endFill();
        try{ inner.zIndex = 2; }catch(e){}
        try{ inner.eventMode = 'none'; }catch(e){} // Disable interaction to prevent blocking
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
            // Use raw rotation without snapping if currently animating, otherwise snap to 90° steps
            thumb.rotation = (src._isAnimatingRotation) ? (src.rotation || 0) : snapQuarter(src.rotation || 0);
            thumb.x = x + w / 2;
            thumb.y = y + h / 2;
            try{ thumb.eventMode = 'static'; }catch(e){}
            thumb.cursor = 'pointer';
            try{ thumb.zIndex = 10; }catch(e){}

            const onPointerDown = (e) => {
              const pos = e.global;
              cls._isDraggingSelection = true;
              dragInfo = { index: i, sprite: thumb, offsetX: pos.x - thumb.x, offsetY: pos.y - thumb.y, startX: pos.x, startY: pos.y, hasMoved: false };
              try{ thumb.zIndex = 10000; }catch(e){} // Bring to front during drag
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
                // Clicking on figura in cell does nothing - all interactions via buttons or dragging
                dragInfo = null;
                cls._isDraggingSelection = false;
                return;
              }
              const relX = Math.max(0, Math.min(leftThirdWidth, pos.x));
              const relY = pos.y;
              let targetCol = Math.round((relX - left) / (w + gap));
              targetCol = Math.max(0, Math.min(cols - 1, targetCol));
              let visualRow = Math.round((relY - startY) / (rowBlock + gap));
              visualRow = Math.max(0, Math.min(rows - 1, visualRow));
              // Reverse the row since cells are displayed bottom-to-top
              let targetRow = (rows - 1) - visualRow;
              let targetIndex = targetRow * cols + targetCol;
              targetIndex = Math.max(0, Math.min(cls.selectedStack.length - 1, targetIndex));
              const fromIndex = dragInfo.index;
              if(fromIndex !== targetIndex){
                // Remove the dragged element
                const draggedElement = cls.selectedStack[fromIndex];
                cls.selectedStack.splice(fromIndex, 1);
                // Insert it at the target position
                cls.selectedStack.splice(targetIndex, 0, draggedElement);
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

      // Add control buttons for occupied cells - arrange horizontally
      if(occupied){
        const btnSize = 32;
        const btnSpacing = 12;
        const btnStyle = new TextStyle({
          fontFamily: 'Arial',
          fontSize: 20,
          fontWeight: 'bold',
          fill: 0xffffff,
          align: 'center'
        });
        const numStyle = new TextStyle({
          fontFamily: 'Arial',
          fontSize: 32,
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

        const cellCenterX = x + w / 2;
        const sideBtnOffset = Math.floor(w / 2) + 22; // symmetric distance from cell, slightly closer
        const leftBtnX = cellCenterX - sideBtnOffset;
        const rightBtnX = cellCenterX + sideBtnOffset;
        const removeBtnX = rightBtnX + btnSize + btnSpacing;
        const numberX = leftBtnX - 35;
        const centerY = y + h / 2;

        // 1. Number label
        const numText = new Text(String(i+1), numStyle);
        numText.anchor.set(0.5);
        numText.x = numberX;
        numText.y = centerY;
        numText.eventMode = 'none';
        container.addChild(numText);

        // 2. Turn left button (⟲)
        const btnLeftTurn = new Text('⟲', btnStyle);
        btnLeftTurn.anchor.set(0.5, 0.5);
        btnLeftTurn.x = leftBtnX;
        btnLeftTurn.y = centerY;
        btnLeftTurn.eventMode = 'static';
        btnLeftTurn.cursor = 'pointer';
        const btnLeftBg = new Graphics();
        btnLeftBg.beginFill(0x3498db);
        btnLeftBg.drawCircle(0, 0, btnSize / 2);
        btnLeftBg.endFill();
        btnLeftBg.x = leftBtnX;
        btnLeftBg.y = centerY;
        btnLeftBg.eventMode = 'none';
        container.addChild(btnLeftBg);
        container.addChild(btnLeftTurn);
        btnLeftTurn.on('pointertap', () => {
          try{
            const fig = cls.selectedStack[i];
            if(fig){
              const startRot = fig.rotation || 0;
              const endRot = startRot - Math.PI / 2;
              const duration = 300; // milliseconds
              let elapsed = 0;
              const app = cls.appRef;
              fig._isAnimatingRotation = true; // Flag to skip snapQuarter
              const animHandler = () => {
                elapsed += 16;
                const progress = Math.min(elapsed / duration, 1);
                fig.rotation = startRot + (endRot - startRot) * progress;
                // Update the UI to show the rotating figura
                ElegirFigura.updateSelectionUI(cls);
                if(progress >= 1){
                  fig.rotation = endRot;
                  fig._isAnimatingRotation = false;
                  if(app) app.ticker.remove(animHandler);
                }
              };
              if(app) app.ticker.add(animHandler);
            }
          }catch(e){}
        });
        // 4. Turn right button (⟳)
        const btnRightTurn = new Text('⟳', btnStyle);
        btnRightTurn.anchor.set(0.5, 0.5);
        btnRightTurn.x = rightBtnX;
        btnRightTurn.y = centerY;
        btnRightTurn.eventMode = 'static';
        btnRightTurn.cursor = 'pointer';
        const btnRightBg = new Graphics();
        btnRightBg.beginFill(0x3498db);
        btnRightBg.drawCircle(0, 0, btnSize / 2);
        btnRightBg.endFill();
        btnRightBg.x = rightBtnX;
        btnRightBg.y = centerY;
        btnRightBg.eventMode = 'none';
        container.addChild(btnRightBg);
        container.addChild(btnRightTurn);
        btnRightTurn.on('pointertap', () => {
          try{
            const fig = cls.selectedStack[i];
            if(fig){
              const startRot = fig.rotation || 0;
              const endRot = startRot + Math.PI / 2;
              const duration = 300; // milliseconds
              let elapsed = 0;
              const app = cls.appRef;
              fig._isAnimatingRotation = true; // Flag to skip snapQuarter
              const animHandler = () => {
                elapsed += 16;
                const progress = Math.min(elapsed / duration, 1);
                fig.rotation = startRot + (endRot - startRot) * progress;
                // Update the UI to show the rotating figura
                ElegirFigura.updateSelectionUI(cls);
                if(progress >= 1){
                  fig.rotation = endRot;
                  fig._isAnimatingRotation = false;
                  if(app) app.ticker.remove(animHandler);
                }
              };
              if(app) app.ticker.add(animHandler);
            }
          }catch(e){}
        });
        // 5. Remove button (❌)
        const btnRemove = new Text('❌', btnStyle);
        btnRemove.anchor.set(0.5);
        btnRemove.x = removeBtnX;
        btnRemove.y = centerY;
        btnRemove.eventMode = 'static';
        btnRemove.cursor = 'pointer';
        const btnRemoveBg = new Graphics();
        btnRemoveBg.beginFill(0xe74c3c);
        btnRemoveBg.drawCircle(0, 0, btnSize / 2);
        btnRemoveBg.endFill();
        btnRemoveBg.x = removeBtnX;
        btnRemoveBg.y = centerY;
        btnRemoveBg.eventMode = 'none';
        container.addChild(btnRemoveBg);
        container.addChild(btnRemove);
        btnRemove.on('pointertap', () => {
          try{
            const fig = cls.selectedStack[i];
            if(fig){
              fig.descentralize();
              ElegirFigura.removeFromSelected(fig, cls);
            }
          }catch(e){}
        });
      }

      // Only show number for unoccupied cells (occupied cells show it in the button row)
      if(!occupied){
        const numStyle = new TextStyle({
          fontFamily: 'Arial',
          fontSize: 32,
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
        numTxt.anchor.set(0.5);
        numTxt.x = x - 80; // Same position as occupied cells
        numTxt.y = y + h / 2; // Vertically centered with cell
        try{ numTxt.eventMode = 'none'; }catch(e){} // Disable interaction to prevent blocking
        container.addChild(numTxt);
      }
    }
    // Reposition the Validate button to keep desired margin from the selected stack
    try{ ValidarResultado.positionValidateButton(FiguraCls); }catch(e){}
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
