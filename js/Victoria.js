import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Figura } from './Figura.js';

export const Victoria = {
  _modal: null,

  hide(app){
    const m = this._modal;
    if(m){
      try{ m.parent && m.parent.removeChild(m); }catch(e){}
      try{ m.destroy && m.destroy({ children: true }); }catch(e){}
      this._modal = null;
    }
  },

  show({ app, scaleFactor, currentLevel, timeText, onRepeat, onNext, onBackToMenu, onContinue }){
    if(!app) return;
    this.hide(app);

    // Disable selection interaction and center selected figures visually
    try{
      if(Figura.selectionContainer){ Figura.selectionContainer.eventMode = 'none'; Figura.selectionContainer.interactiveChildren = false; }
      const center = Array.isArray(Figura.posicion_central) ? Figura.posicion_central : [app.screen.width/2, app.screen.height/2];
      const cx = Math.floor(center[0]);
      const cy = Math.floor(center[1]);
      (Figura.selectedStack || []).forEach(f => { try{ f.eventMode = 'none'; f.cursor = null; }catch(e){} try{ f.x = cx; f.y = cy; }catch(e){} });
    }catch(e){}

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

    // Performance message based on extra selected figures vs final target
    const finalCount = Array.isArray(Figura.figura_final) ? Math.floor(Figura.figura_final.length / 2) : 0;
    const selectedCount = Array.isArray(Figura.selectedStack) ? Figura.selectedStack.length : 0;
    const extra = selectedCount - finalCount;

    const titleColor = extra > 0 ? 0xf1c40f : 0x2ecc71;
    const title = new Text('Victòria!', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(38*scaleFactor), fontWeight: '900', fill: titleColor }));
    title.anchor.set(0.5); title.x = panelX + panelW/2; title.y = panelY + Math.floor(60*scaleFactor);

    const timeLabel = new Text(timeText || '', new TextStyle({ fontFamily: 'Arial', fontSize: Math.floor(24*scaleFactor), fill: 0x2c3e50 }));
    timeLabel.anchor.set(0.5); timeLabel.x = panelX + panelW/2; timeLabel.y = panelY + Math.floor(120*scaleFactor);

    let performanceMsg = '';
    if(extra > 0) performanceMsg = '\nLa imatge es veu bé! \nPerò has posat algunes peces que no necessites.';
    else if(extra === 0) performanceMsg = '\nPerfecte! Ho has aconseguit!';
    else performanceMsg = '\nNo sabia que es podia fer això. Increïble!';

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

    const restoreAfterClose = () => {
      try{
        if(Figura.selectionContainer){ Figura.selectionContainer.eventMode = 'passive'; Figura.selectionContainer.interactiveChildren = true; }
        (Figura.selectedStack || []).forEach(f => { try{ f.eventMode = 'none'; f.cursor = null; }catch(e){} });
      }catch(e){}
    };

    const btnRepeat = makeBtn('Repetir', 0x3498db, () => { try{ onRepeat && onRepeat(); }catch(e){} });
    const shouldShowContinue = extra !== 0;
    const btnContinue = makeBtn('Continuar', 0xf1c40f, () => { try{ this.hide(app); }catch(e){} try{ restoreAfterClose(); }catch(e){} try{ onContinue && onContinue(); }catch(e){} });
    const btnNext = makeBtn('Avançar al següent nivell', 0x27ae60, () => { try{ onNext && onNext(); }catch(e){} });
    const btnMenu = makeBtn('Tornar al menú principal', 0x7f8c8d, () => { try{ onBackToMenu && onBackToMenu(); }catch(e){} });

    const btnY = panelY + panelH - Math.floor(70*scaleFactor);
    const buttons = [btnRepeat, btnNext, btnMenu];
    for(let i=0;i<buttons.length;i++){
      const colCenterX = panelX + Math.floor(((i + 0.5) * panelW) / 3);
      buttons[i].x = colCenterX;
      buttons[i].y = btnY;
    }
    // Place "Continuar" above "Avançar al següent nivell" only when needed
    if(shouldShowContinue){
      btnContinue.x = btnNext.x;
      btnContinue.y = btnY - Math.floor(60*scaleFactor);
    }

    const modal = new Container();
    modal.zIndex = 9999;
    modal.addChild(overlay);
    modal.addChild(panel);
    modal.addChild(title);
    modal.addChild(timeLabel);
    modal.addChild(perfLabel);
    modal.addChild(btnRepeat);
    if(shouldShowContinue) modal.addChild(btnContinue);
    modal.addChild(btnNext);
    modal.addChild(btnMenu);
    app.stage.addChild(modal);
    if(!app.stage.sortableChildren) app.stage.sortableChildren = true;

    this._modal = modal;
  }
};

export default Victoria;
