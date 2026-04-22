import { IFairyLayer } from './IFairyLayer';

/**
 * A static background layer that renders a pre-drawn image onto the main canvas.
 * The image is drawn once into an internal off-screen canvas via `setImage`,
 * then composited onto the main canvas on every `render` call.
 */
export class FairyLayer implements IFairyLayer {
    /** Off-screen canvas holding the baked background image. */
    private _canvas: HTMLCanvasElement;
    /** Rendering context for the off-screen canvas. */
    private _ctx: CanvasRenderingContext2D;
    /** The main canvas context to composite onto. */
    private _finalCtx: CanvasRenderingContext2D | null = null;

    constructor() {
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d')!;
    }

    get canvas() {
        return this._canvas;
    }

    /** Resize the off-screen canvas. Call before `setImage`. */
    setSize(w: number, h: number): void {
        this._canvas.width = w;
        this._canvas.height = h;
    }

    /** Bake the image into the off-screen canvas at (0, 0). */
    setImage(image: HTMLImageElement): void {
        this._ctx.drawImage(image, 0, 0);
    }

    /** Set the main canvas context onto which the layer will be composited. */
    setContext(ctx: CanvasRenderingContext2D): void {
        this._finalCtx = ctx;
    }

    /** No per-tick logic for a static background layer. */
    proceed(): void {}

    /** Composite the off-screen canvas onto the main canvas at the origin. */
    render(): void {
        this._finalCtx!.drawImage(this._canvas, 0, 0);
    }
}
