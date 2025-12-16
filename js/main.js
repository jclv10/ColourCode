import { Application, Assets, Sprite } from 'pixi.js';
import { Figura } from './Figura.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { Nivel } from './Nivel.js';


(async () => {

    //INICIALIZAR APLICACIÓN ///////////////////////////////////////////////////////////////////

    // Create a new application
    const app = new Application();

    // Initialize the application
    await app.init({
        background: '#1099bb',
        resizeTo: window,
        backgroundAlpha: 0.7
    });

    // Quitar barras de scroll
    app.canvas.style.position = 'absolute';

    // Append the application canvas to the document body
    document.body.appendChild(app.canvas);

    // Set wallpaper background image stretched to screen
    try{
        const wp = await Assets.load('images/wallpaper2.png');
        const bg = new Sprite(wp);
        bg.anchor.set(0);
        bg.x = 0; bg.y = 0;
        bg.zIndex = 0;
        const fitBg = () => { bg.width = app.screen.width; bg.height = app.screen.height; };
        fitBg();
        app.stage.addChild(bg);
        if(!app.stage.sortableChildren) app.stage.sortableChildren = true;
        // Keep background sized on resize
        //window.addEventListener('resize', fitBg);
    }catch(e){ console.error('Failed to load wallpaper background', e); }



    // Dynamic scaling relative to 1080p baseline
    const baseHeight = 1080;
    const scaleFactor = Math.max(0.5, app.screen.height / baseHeight);
    Figura.escala_imagenes_origen = 0.5 * scaleFactor;
    Figura.escala_imagenes_seleccionadas = 1.3 * scaleFactor;

    // Expose Figura and wire app reference
    try{ window.Figura = Figura; }catch(e){}
    Figura.appRef = app;

    // Initialize selector and level runtime modules
    SeleccionarNivel.init(app, scaleFactor);
    Nivel.init(app, scaleFactor);

    // Load solutions and show selector
    try{
        const res = await fetch('./Solucionario.json');
        const json = await res.json();
        const keys = Object.keys(json).filter(k=>/^nivel\d+$/i.test(k)).sort((a,b)=> parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,'')));
        const levelSolutions = keys.map(k => { const entry = json[k]; const arr = Array.isArray(entry) ? entry[0] : []; return Array.isArray(arr) ? arr.slice() : []; });
        SeleccionarNivel.setSolutions(levelSolutions);
    }catch(e){ console.error('Failed to load Solucionario.json', e); }

    SeleccionarNivel.show();

})();

