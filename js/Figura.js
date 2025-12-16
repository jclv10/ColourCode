import { text, th } from 'motion/react-client';
import { Application, Assets, path, Sprite, Graphics, Container, Text, TextStyle, RenderTexture } from 'pixi.js';
import { ElegirFigura } from './ElegirFigura.js';
import { ValidarResultado } from './ValidarResultado.js';

class Figura extends Sprite {
    static posicion_central = [0, 0];
    static escala_imagenes_origen = 0.5;
    static escala_imagenes_seleccionadas = 1.3;

    
    // Prefix for textures used in final target composition
    // Use 'images/' and pass filenames like 'bloque1.png' in figura_final
    static texturePrefix = 'images/';
    // Flat array [idOrPath, rotation, idOrPath, rotation, ...] describing the final stacked figuras
    static figura_final = [1, 0, 2, Math.PI / 2];
    // Internal: sprites created for figura_final (non-interactive)
    static _finalSprites = [];
    // UI elements for validation feedback
    static _validateButton = null;
    static _validateLabel = null;
    static validateMessageDurationMs = 1000;
    // Optional callback invoked after validation attempts: (success:boolean) => void
    static onValidation = null;
    // Stack of figuras that have been centralized (oldest -> newest)
    static selectedStack = [];
    // Configurable maximum number of selected figuras allowed
    static maxSelected = 6;
    // Reference to the PIXI Application (set from first Figura instance)
    static appRef = null;
    // Container for the left-side selection cells UI
    static selectionContainer = null;
    // Internal: ticker handler id flag to avoid double-registering
    static _selectionTickerRegistered = false;
    // Internal: flag to avoid rebuilding UI while dragging
    static _isDraggingSelection = false;
    // Visual cell layout settings
    static selectionCell = {
        width: 120,
        height: 120,
        gap: 24,
        leftOffset: 18,
        cols: 2
    };
    // Add figura to selected stack (most-recent at end) and update zIndex
    static addToSelected(figura){
        ElegirFigura.addToSelected(figura, this);
    }

    // Remove figura from selected stack and recompute zIndex
    static removeFromSelected(figura){
        ElegirFigura.removeFromSelected(figura, this);
    }

    // Ensure the selection UI container exists and is attached to the stage
    static ensureSelectionUI(){
        ElegirFigura.ensureSelectionUI(this);
    }

    // Create non-interactive stacked sprites based on figura_final
    static async applyFinal(){
        await ValidarResultado.applyFinal(this);
    }

    // Render left-side cells numbered 1..maxSelected and mark occupied slots
    static updateSelectionUI(){
        ElegirFigura.updateSelectionUI(this);
    }

    // Brief visual feedback when user attempts to select beyond capacity
    static flashSelectionFull(){
        ElegirFigura.flashSelectionFull(this);
    }
    constructor(app, x_origen = 0, y_origen = 0, nombre = "none", texture="images/formas-recortadas/test.png", isInteractive=true) {
        super(texture);
            this.app = app
            // ensure stage supports sorting by zIndex
            if(this.app && this.app.stage) this.app.stage.sortableChildren = true;
            // store global app reference for selection UI (only first set)
            if(!this.constructor.appRef && app) this.constructor.appRef = app;
            // ensure selection UI exists
            try{ this.constructor.ensureSelectionUI(); }catch(e){}
            this.anchor.set(0.5)
            this.x = x_origen
            this.y = y_origen
            this.x_origen = x_origen
            this.y_origen = y_origen
            this.nombre = nombre;
            // zIndex used by PIXI when sortableChildren = true
            this.zIndex = 0;

        if(isInteractive){
            this.eventMode = 'static';
            this.cursor = 'pointer';

            //Variables para controlar eventos de clic y arrastre
            this.isDraggable = false;
            this.dragStart = null;
            this.hasMoved = false;


            this.startX = 0;
            this.startY = 0;

            this.initialArea = null;
            this.hasLeftInitialArea = false;

            // Registrar el eventos de la figura
            this
                .on("pointerdown", this.onPointerDown)
                .on("pointermove", this.onPointerMove)
                .on("pointerup", this.onPointerUp);
        }

        // Center target moved from 1/2 to 2/3 of Y axis
        Figura.posicion_central = [this.app.screen.width / 2, Math.round(this.app.screen.height * 2 / 3)];
        this.isCentralizedFlag = false;

    
    }

    static async create(app, x_origen = 0, y_origen = 0, nombre = "none", path_textura, isInteractive=true) {
        try {
            const texture = await Assets.load(path_textura);
            texture.source.scaleMode = "nearest";
            const figura = new Figura(app, x_origen, y_origen, nombre, texture, isInteractive);
            // Persist the source path for reliable retrieval later
            try{ figura.originalTexturePath = path_textura; }catch(e){}
            //console.log("Figura creada: " + figura.status());

            if(!isInteractive){
                // ensure stage supports sorting by zIndex
                if(app && app.stage) app.stage.sortableChildren = true;
                app.stage.addChild(figura);
                return figura;
            }else{
                //Las figuras son demasiado grandes.
                figura.scale = this.escala_imagenes_origen;
                // No placeholder debug graphic; add the figura directly
                
                app.stage.addChild(figura);
                return figura;

                //Crear gráfico para definir hitArea
                //const hitArea = new Graphics();
                //figura.addChild(hitArea);

            }

        } catch (error) {
            console.error("Error al cargar la textura: ", error);
            return new Figura(app, x_origen, y_origen, nombre, null, isInteractive);
        }
    }

    status() {
        return this.nombre + " está en la posición " + this.x + ", " + this.y;
    }

    cargartextura(path_textura) {
        Assets.load(path_textura).then((texture) => {
            this.texture = texture;
            try{ this.originalTexturePath = path_textura; }catch(e){}
        }).catch((error) => {
            console.error("Error al cargar la textura: ", error);
        });
    }

    centralize(){
        const cls = this.constructor;
        // If selecting a new figura would exceed capacity, refuse and flash UI
        const alreadySelected = cls.selectedStack.indexOf(this) !== -1;
        if(!alreadySelected && cls.selectedStack.length >= cls.maxSelected){
            try{ cls.flashSelectionFull(); }catch(e){}
            return;
        }

        const pos = cls.posicion_central;
        this.x = pos[0];
        this.y = pos[1];
        this.scale = cls.escala_imagenes_seleccionadas;
        //this.scale.y = 1.3;
        this.isCentralizedFlag = true;
        
        //Cuando se centraliza, actualizamos startX/Y
        //this.startX = pos[0];
        //this.startY = pos[1];
        // Update selection stack and zIndex ordering
        try{ cls.addToSelected(this); }catch(e){ console.error('addToSelected error', e); }
    }

    descentralize(){
        this.x = this.x_origen;
        this.y = this.y_origen;
        this.scale = this.constructor.escala_imagenes_origen;
        //this.scale.y = 1;
        this.rotation = 0;
        this.isCentralizedFlag = false;

        //Cuando se descentraliza, actualizamos startX/Y
        //this.startX = this.x_origen;
        //this.startY = this.y_origen;
        // Remove from selection stack and update zIndex ordering
        try{ this.constructor.removeFromSelected(this); }catch(e){ console.error('removeFromSelected error', e); }

    }    

    onPointerDown(e) {

        // Reinicia estado movimiento
        this.hasMoved = false;
        // Marca el inicio del arrastre si la figura está centralizada
        if(this.isCentralizedFlag){
            this.isDraggable = true;
            // Posición inicial del puntero respecto a la escena
            const pos = e.global;
            // Calcula la distancia entre donde está el puntero y el origen del sprite. 
            // Con esto, al mover, mantenemos la misma relación (el cursor “se queda” en la misma parte del sprite).        
            this.dragStart = {
                x: pos.x - this.x,
                y: pos.y - this.y
            };

            // Guardamos la posición inicial REAL de la figura (el centro)
            this.startX = this.x;
            this.startY = this.y;


            //Guardamos el área inicial para detectar si se sale de ella
            const topLeftLocal = {
                x: this.x - this.width * this.anchor.x,
                y: this.y - this.height * this.anchor.y
            };

            /*
            // Convertir a coordenadas globales
            //const topLeftGlobal = this.parent.toGlobal(topLeftLocal);

            // Ahora puedes calcular las otras esquinas también en global:
            
            this.initialArea = {
                topLeft: topLeftGlobal,
                topRight: { x: topLeftGlobal.x + this.width, y: topLeftGlobal.y },
                bottomLeft: { x: topLeftGlobal.x, y: topLeftGlobal.y + this.height },
                bottomRight: { x: topLeftGlobal.x + this.width, y: topLeftGlobal.y + this.height }
            };
            */

            this.initialArea = {
                topLeft: topLeftLocal,
                topRight: { x: topLeftLocal.x + this.width, y: topLeftLocal.y },
                bottomLeft: { x: topLeftLocal.x, y: topLeftLocal.y + this.height },
                bottomRight: { x: topLeftLocal.x + this.width, y: topLeftLocal.y + this.height }
            };


            this.hasLeftInitialArea = false;

        }

        //La acción del clic no se maneja en pointerup para distinguir entre clic y arrastre
    }

    onPointerMove(e) {

        // La función solo seguirá si se puede arrastrar
        if (!this.isDraggable) return;

        // Calcula la nueva posición de la figura preservando el offset guardado en dragStart
        const pos = e.global;
        const newX = pos.x - this.dragStart.x;
        const newY = pos.y - this.dragStart.y;
        const clickToDragThreshold = 0;

        // Si se movió lo suficiente, consideramos que es arrastre, no click
        if (!this.hasMoved && (
            Math.abs(newX - this.startX) > clickToDragThreshold || 
            Math.abs(newY - this.startY) > clickToDragThreshold
        )) {
            this.hasMoved = true;
            this.alpha = 0.7; // Opcional: cambia la apariencia al arrastrar
        }
        // Actualiza la posición de la figura
        this.x = newX;
        this.y = newY;

        // --- DETECTAR SI RATÓN SALE DEL ÁREA ORIGINAL ---
        if (this.hasMoved && !this.hasLeftInitialArea) {

            //const pointerX = pos.x;
            //const pointerY = pos.y;

            const isOutside =
            pos.x < this.initialArea.topLeft.x ||
            pos.x > this.initialArea.topRight.x ||
            pos.y < this.initialArea.topLeft.y ||
            pos.y > this.initialArea.bottomLeft.y;

            if (isOutside && !this.hasLeftInitialArea) {
                this.hasLeftInitialArea = true;
                //console.log("El ratón ha salido del área");

                // Dejamos de arrastrar
                this.isDraggable = false;
                this.alpha = 1;
                // Volver a posición original
                this.descentralize();
                
            }
        }
    
    }

    onPointerUp() {
        if (!this.hasMoved) {
            //console.log("CLICK en la figura");
                this.clic_figura();
        }else if(!this.isDraggable){
                //Arrastrar sobre figura en coord original da problemas, así que actualizamos startX/Y
                //console.log("El ratón se ha soltado en la posición original de la figura");
                this.startX = this.x;
                this.startY = this.y;
            } else {
            //console.log("El ratón no ha salido del área");
            this.alpha = 1;
            // Dejar figura en la posición central
            this.x = this.startX;
            this.y = this.startY;
        }
        // Dejamos de arrastrar
        this.isDraggable = false;
        this.hasMoved = false;
    }

    clic_figura() {

        if(this.isCentralizedFlag){
            //Rotar 90 grados con animación
            let animacion = true;

            //Establecemos angulos fijos para evitar errores de precisión al clicar varias veces
            const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI];
            let currentRotation = this.rotation % (2 * Math.PI);
            if (currentRotation < 0) currentRotation += 2 * Math.PI;
            // Buscar el índice del ángulo más cercano
            let closestIndex = 0;
            let minDiff = Math.abs(currentRotation - angles[0]);

            for (let i = 1; i < angles.length; i++) {
                const diff = Math.abs(currentRotation - angles[i]);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                }
            }
            const nextIndex = (closestIndex + 1) % angles.length;

            //console.log("current rotation " + currentRotation )
            //console.log("next rotation " + angles[nextIndex] )
            
            //Animación rotación
            this.app.ticker.add((time) => {
                // Booleano para parar animación
                if(!animacion) return;
                
                this.rotation += 0.2 * time.deltaTime;

                // Keep replica thumbnails in sync while rotating
                try{ this.constructor.updateSelectionUI(); }catch(e){}

                if (this.rotation >= angles[nextIndex]) {
                    "Fin animación"
                    if(this.rotation >= 2 * Math.PI){
                        this.rotation = 0;
                    }else{
                        this.rotation = angles[nextIndex];
                    }
                    
                
                    animacion = false;
                }

            });
        
        }else{

        this.centralize();

        }

    }

    // Generate flat array of centered figuras [filename, rotation, ...], update figura_final and re-render
    static async debugFinal(){
        const cls = this;
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI];
        // Sort centered figuras by zIndex ascending (lowest at bottom)
        const centered = cls.selectedStack.slice().sort((a,b) => (a.zIndex||0) - (b.zIndex||0));
        const out = [];
        centered.forEach(f => {
            // Prefer persisted path set during create/cargartextura
            let p = f.originalTexturePath || null;
            if(!p){
                // Fallbacks: attempt to derive from texture resource
                try{
                    const raw = f.texture?.baseTexture?.resource?.url
                        || f.texture?.baseTexture?.resource?.src
                        || (f.texture?.textureCacheIds ? f.texture.textureCacheIds[0] : null)
                        || null;
                    if(raw){
                        const parts = String(raw).split('?')[0].split('#')[0].split('/');
                        const filename = parts[parts.length - 1];
                        p = filename || raw;
                    }
                }catch(e){}
            }
            if(!p) p = 'unknown';
            // Only return filename (basename)
            try{
                const parts2 = String(p).split('?')[0].split('#')[0].split('/');
                p = parts2[parts2.length - 1];
            }catch(e){}
            // Snap rotation to allowed angles
            let r = f.rotation || 0;
            r = ((r % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
            let closest = angles[0];
            let minDiff = Math.abs(r - closest);
            for(let i=1;i<angles.length;i++){
                const d = Math.abs(r - angles[i]);
                if(d < minDiff){ minDiff = d; closest = angles[i]; }
            }
            out.push(p, closest);
        });
        // Update figura_final and re-render final stack
        try{
            cls.figura_final = out;
            console.log('debugFinal -> figura_final updated:', out);
            await cls.applyFinal();
        }catch(e){ console.error('debugFinal: failed to apply figura_final', e); }
        return out;
    }

    // Pixel-by-pixel validation: render centered stack and figura_final stack and compare
    static validateAgainstFinal(){
        ValidarResultado.validateAgainstFinal(this);
    }

    static _showValidateMessage(success, text){
        ValidarResultado.showValidateMessage(success, text, this);
    }










}

export { Figura };
// Expose globally for console usage
try{ if(typeof window !== 'undefined') window.Figura = Figura; }catch(e){}