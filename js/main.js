import { Application, Assets, Sprite } from 'pixi.js';
import { Figura } from './Figura.js';
import { SeleccionarNivel } from './SeleccionarNivel.js';
import { Menu } from './Menu.js';
import { Tutorial } from './Tutorial.js';
import { Nivel } from './Nivel.js';
import { Logs } from './Logs.js';


(async () => {

    //INICIALIZAR APLICACIÓN ///////////////////////////////////////////////////////////////////

    // Create a new application
    const app = new Application();

    // Initialize the application
    await app.init({
        background: '#1099bb',
        resizeTo: window,
        backgroundAlpha: 0.7,
        preference: 'webgl',
        antialias: false,
    });

    // Quitar barras de scroll
    app.canvas.style.position = 'absolute';

    // Append the application canvas to the document body
    document.body.appendChild(app.canvas);

    // Set wallpaper background image stretched to screen
    try{
        const wp = await Assets.load('/images/wallpaper-plain.png');
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

        // Expose wallpaper reference and helpers to manage tint and texture
        try{
            Figura.wallpaperBgRef = bg;
            // Tint control flag: disabled by default; enable via Figura.setWallpaperTintEnabled(true)
            Figura.wallpaperTintEnabled = false;
            const tintMap = [0x2ecc71, 0xe67e22, 0xe74c3c, 0x9b59b6]; // green, orange, red, purple
            Figura.setWallpaperTint = (pageIdx) => {
                try{
                    if(!Figura.wallpaperTintEnabled) return; // no-op when disabled
                    const idx = Math.max(0, Math.min(tintMap.length-1, pageIdx|0));
                    const color = tintMap[idx] ?? 0xFFFFFF;
                    if(Figura.wallpaperBgRef) Figura.wallpaperBgRef.tint = color;
                }catch(e){}
            };
            Figura.setWallpaperTintEnabled = (on) => { try{ Figura.wallpaperTintEnabled = !!on; }catch(e){} };
            Figura.resetWallpaperSize = () => {
                try{
                    const appRef = Figura.appRef || app;
                    if(Figura.wallpaperBgRef && appRef){
                        Figura.wallpaperBgRef.width = appRef.screen.width;
                        Figura.wallpaperBgRef.height = appRef.screen.height;
                    }
                }catch(e){}
            };
            Figura._wallpaperCache = {};
            Figura.setWallpaperTexture = async (type) => {
                try{
                    const path = type === 'logo' ? '/images/wallpaper-logo.png' : '/images/wallpaper-plain.png';
                    let tex = Figura._wallpaperCache[path];
                    if(!tex){ tex = await Assets.load(path); Figura._wallpaperCache[path] = tex; }
                    if(Figura.wallpaperBgRef){
                        Figura.wallpaperBgRef.texture = tex;
                        Figura.wallpaperBgRef.tint = 0xFFFFFF; // reset tint when switching
                        Figura.resetWallpaperSize && Figura.resetWallpaperSize();
                    }
                }catch(e){ console.error('Failed to set wallpaper texture', e); }
            };
        }catch(e){}
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
    Menu.init(app, scaleFactor);
    Tutorial.init(app, scaleFactor);
    Logs.init();

    // Load solutions and show selector
    try{
        const res = await fetch('/Solucionario.json');
        const json = await res.json();

        // Detect difficulties shape or flat list
        const difficultyNames = ['Starter', 'Junior', 'Expert', 'Master'];
        const hasDifficulties = difficultyNames.some(name => json && Object.prototype.hasOwnProperty.call(json, name));
        let difficulties = [];

        if(hasDifficulties){
            // Build 4 pages (25 levels each) from difficulty objects
            difficulties = difficultyNames.map((name, idx) => {
                const obj = json[name] || {};
                const startLevel = idx * 25 + 1; // 1..25, 26..50, 51..75, 76..100
                const page = [];
                for(let i=0;i<25;i++){
                    const globalLevel = startLevel + i;
                    const key = `nivel${globalLevel}`;
                    const entry = obj[key];
                    let arr = [];
                    if(Array.isArray(entry)){
                        const maybe = entry[0];
                        arr = Array.isArray(maybe) ? maybe.slice() : [];
                    }
                    page.push(arr);
                }
                return page;
            });
        }else{
            // Fallback: flat list of nivelN entries
            const keys = Object.keys(json)
              .filter(k=>/^nivel\d+$/i.test(k))
              .sort((a,b)=> parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,'')));
            const flat = keys.map(k => {
                const entry = json[k];
                const arr = Array.isArray(entry) ? entry[0] : [];
                return Array.isArray(arr) ? arr.slice() : [];
            });
            for(let i=0;i<flat.length;i+=25){ difficulties.push(flat.slice(i, i+25)); }
        }

        SeleccionarNivel.setSolutions(difficulties);
    }catch(e){ console.error('Failed to load Solucionario.json', e); }

    // Show main menu first
    Menu.show();

})();

