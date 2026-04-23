import { FairyImageLoader } from './FairyImageLoader.js';
import { FairyInputState } from './FairyInputState.js';
import { FairySequencer } from './FairySequencer.js';
import { FairyCollider } from './FairyCollision.js';
import { FairyMatrix } from './FairyMatrix.js';
import { FairyLayer } from './FairyLayer.js';
import { Fairies } from './Fairies.js';
import { Fairy } from './Fairy.js';
import { IFairyLayer } from './IFairyLayer';

/**
 * Base engine class.  Subclasses override the four state hooks to implement a game.
 *
 * **Lifecycle states (managed by `FairySequencer`):**
 * 1. `stateEngineInitializing` – one-shot synchronous setup; kicks off resource loading.
 * 2. `stateResourceLoading`    – polls `FairyImageLoader` until all assets are ready.
 * 3. `stateGameInitializing`   – one-shot; builds layers, creates sprites, loads level.
 * 4. `stateGameRunning`        – called every RAF frame; runs game logic then `_updateFrame`.
 *
 * **Rendering:** `_updateFrame` calls `proceed` then `render` on every layer.
 * Rendering is throttled to every other tick (`_frame & 1`) to target ~30 fps
 * when the browser delivers 60 Hz animation frames.
 */
export class FairyEngine {
    /** Manages all loaded sprite-sheet images. */
    protected _images = new FairyImageLoader();
    /** Current keyboard and mouse input snapshot. */
    protected _input = new FairyInputState();
    /** Spatial hash collider shared by all sprite layers. */
    protected _collider: FairyCollider | null = null;

    /** The game canvas element. */
    private _canvas: HTMLCanvasElement | null = null;
    /** 2D rendering context for the main canvas. */
    private _ctx: CanvasRenderingContext2D | null = null;
    /** Ordered list of renderable/tickable layers (background, tiles, sprites…). */
    private _layers: IFairyLayer[] = [];
    /** State machine that drives the engine lifecycle. */
    private _seq = new FairySequencer();
    /** `requestAnimationFrame` handle, or null when the loop is stopped. */
    private _rafId: number | null = null;
    /** Monotonically increasing tick counter; used for 30fps render throttle. */
    private _frame = 0;

    /** Bound input handlers — stored so they can be removed by `destroy()`. */
    private _onKeyDown = (e: KeyboardEvent) => this._input.setKeyState(e.keyCode || e.which, true);
    private _onKeyUp = (e: KeyboardEvent) => this._input.setKeyState(e.keyCode || e.which, false);
    private _onMouseMove = (e: MouseEvent) => this._input.setMouseXY(e.clientX, e.clientY);
    private _onMouseDown = (e: MouseEvent) => {
        this._input.setMouseButton(e.button, true);
        return false;
    };
    private _onMouseUp = (e: MouseEvent) => {
        this._input.setMouseButton(e.button, false);
        return false;
    };

    constructor() {
        this._seq.addState('stateEngineInitializing', () => this._doEngineInit());
        this._seq.addState('stateResourceLoading', () => this._doResourceLoading());
        this._seq.addState('stateGameInitializing', () => this._doGameInit());
        this._seq.addState('stateGameRunning', () => this._doGameRunning());
    }

    /** Allow subclasses to register additional FSM states. */
    protected addState(name: string, handler: () => string | null | undefined): void {
        this._seq.addState(name, handler);
    }

    // ── State machine internals ──────────────────────────────────────────────

    /** Run `stateEngineInitializing`, fire off async resource loading, advance to loading state. */
    private _doEngineInit(): string {
        this.stateEngineInitializing();
        this.stateResourceLoading(); // fire-and-forget async loading
        return 'stateResourceLoading';
    }

    /** Poll the image loader; advance to game init once all assets are ready. */
    private _doResourceLoading(): string | null {
        return this._images.complete() ? 'stateGameInitializing' : null;
    }

    /** Run `stateGameInitializing` then advance to the running state. */
    private _doGameInit(): string {
        this.stateGameInitializing();
        return 'stateGameRunning';
    }

    /** Run `stateGameRunning`, update all layers, then check for a state transition. */
    private _doGameRunning(): string | null {
        const next = this.stateGameRunning() ?? null;
        this._updateFrame();
        return next;
    }

    // ── Overridable hooks (subclasses implement these) ───────────────────────

    /** Called once during engine initialisation. Override to do early setup. */
    protected stateEngineInitializing(): void {}

    /**
     * Called once to kick off asset loading.
     * Override and call `this.loadImage(...)` for each required image.
     * May be async; the engine polls `FairyImageLoader.complete()` each tick.
     */
    protected stateResourceLoading(): void | Promise<void> {}

    /** Called once when assets are ready. Override to build layers and sprites. */
    protected stateGameInitializing(): void {}

    /**
     * Called every tick while the game is running.
     * Override to implement per-frame game logic (input, AI, scoring…).
     * Return a non-empty string to transition the engine to a different state;
     * return null or undefined to keep running.
     */
    protected stateGameRunning(): string | null | undefined {
        return null;
    }

    // ── Canvas ───────────────────────────────────────────────────────────────

    /** Assign the `<canvas>` element and extract its 2D context. */
    setCanvas(canvas: HTMLCanvasElement): void {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d')!;
    }

    /** Return the canvas element. */
    getCanvas(): HTMLCanvasElement {
        return this._canvas!;
    }

    /** Throw if `setCanvas` has not been called yet. */
    private _requireCanvas(): void {
        if (!this._ctx) {
            throw new Error('FairyEngine: call setCanvas() first!');
        }
    }

    // ── Layer factories ──────────────────────────────────────────────────────

    /** Remove all layers (useful when transitioning between game states). */
    clearLayers(): void {
        this._layers = [];
    }

    /** Create and configure the shared spatial hash collider. */
    createCollider(cols: number, rows: number, sectorW: number, sectorH: number): void {
        this._collider = new FairyCollider();
        this._collider.setSize(cols, rows, sectorW, sectorH);
    }

    /**
     * Create a static background layer from a pre-loaded image and add it to the stack.
     * The image is baked into an off-screen canvas and composited every render frame.
     */
    createBackgroundLayer(imageId: string, w: number, h: number): FairyLayer {
        this._requireCanvas();
        const layer = new FairyLayer();
        layer.setSize(w, h);
        layer.setImage(this._images.get(imageId)!);
        layer.setContext(this._ctx!);
        this._layers.push(layer);
        return layer;
    }

    /**
     * Create a tile-map layer and add it to the stack.
     * The returned `FairyMatrix` can be populated via `FairyLevelBuilder`.
     */
    createMatrixLayer(
        imageId: string,
        cols: number,
        rows: number,
        tileW: number,
        tileH: number
    ): FairyMatrix {
        this._requireCanvas();
        const matrix = new FairyMatrix();
        matrix.setRenderingCanvas(this._canvas!);
        matrix.setImage(this._images.get(imageId)!);
        matrix.setSize(cols, rows, tileW, tileH);
        this._layers.push(matrix);
        return matrix;
    }

    /**
     * Create an empty sprite layer and add it to the stack.
     * Use `createFairy` to populate it.
     */
    createFairyLayer(): Fairies {
        this._requireCanvas();
        const fairies = new Fairies();
        fairies.setContext(this._ctx!);
        this._layers.push(fairies);
        return fairies;
    }

    /**
     * Create a simple canvas, good for displayin anything that is not a sprite or tileset
     */
    createCanvasLayer(): FairyLayer {
        this._requireCanvas();
        const canvas = this._canvas!;
        const layer = new FairyLayer();
        layer.setSize(canvas.width, canvas.height);
        layer.setContext(this._ctx!);
        this._layers.push(layer);
        return layer;
    }

    /**
     * Instantiate a sprite, attach resources, and add it to `layer`.
     * The return type matches the concrete subtype passed as `fairy`, so the caller
     * retains access to subclass-specific properties and the correct `oObservatory`
     * event map without needing a cast.
     * @param layer   - The `Fairies` layer to add the sprite to.
     * @param imageId - Key of the pre-loaded sprite sheet image.
     * @param fairy   - The sprite instance (defaults to a plain `Fairy`).
     */
    createFairy<T extends Fairy>(layer: Fairies, imageId: string, fairy: T = new Fairy() as T): T {
        fairy.setImage(this._images.get(imageId)!);
        if (this._collider) {
            fairy.setCollider(this._collider);
        }
        layer.linkFairy(fairy);
        return fairy;
    }

    /**
     * Begin loading a sprite-sheet image asynchronously.
     * @param src - URL of the image file.
     * @param id  - Key used to retrieve the image later via `_images.get(id)`.
     */
    loadImage(src: string, id: string): Promise<HTMLImageElement> {
        return this._images.load(id, src);
    }

    // ── Main loop (requestAnimationFrame) ────────────────────────────────────

    /** Start the `requestAnimationFrame` loop and bind input event listeners. */
    start(): void {
        this._bindInputEvents();
        const loop = () => {
            try {
                this._seq.tick();
            } catch (e) {
                console.error(e);
                return; // stop on error
            }
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    /** Cancel the animation frame loop. */
    stop(): void {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    /**
     * Stop the loop, remove all input event listeners, and drop all layers.
     * Call this when discarding the engine so the instance can be garbage collected.
     */
    destroy(): void {
        this.stop();
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        if (this._canvas) {
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener(
                'mousedown',
                this._onMouseDown as unknown as EventListener
            );
            this._canvas.removeEventListener(
                'mouseup',
                this._onMouseUp as unknown as EventListener
            );
        }
        this.clearLayers();
    }

    /**
     * Advance all layers by one tick and render every other tick (~30 fps on 60 Hz displays).
     * Physics and animation advancement always run at full tick rate; the throttle
     * only reduces canvas draw calls for compatibility with slower hardware.
     */
    private _updateFrame(): void {
        this._frame++;
        for (const layer of this._layers) {
            layer.proceed();
            if (this._frame & 1) {
                layer.render();
            }
        }
    }

    // ── Input handling ────────────────────────────────────────────────────────

    /** Attach keyboard and mouse event listeners to the window and canvas. */
    private _bindInputEvents(): void {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        if (this._canvas) {
            this._canvas.addEventListener('mousemove', this._onMouseMove);
            this._canvas.addEventListener(
                'mousedown',
                this._onMouseDown as unknown as EventListener
            );
            this._canvas.addEventListener('mouseup', this._onMouseUp as unknown as EventListener);
        }
    }
}
