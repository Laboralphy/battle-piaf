import { Fairy } from './Fairy.js';
import { IFairyLayer } from './IFairyLayer';

/**
 * Layer that owns and manages a collection of sprites.
 * `proceed()` runs every tick for all fairies; dead fairies are cleaned up
 * afterwards.  `render()` draws them all in insertion order.
 * New fairies pushed during `proceed()` (e.g. spawned by a collision handler)
 * are picked up in the same tick because `for...of` on the live array sees
 * elements appended after iteration started.
 */
export class Fairies implements IFairyLayer {
    /** All currently live sprites in this layer. */
    private _fairies: Fairy[] = [];
    /** Canvas context shared with every fairy that is linked into this layer. */
    private _ctx: CanvasRenderingContext2D | null = null;
    /** Y coordinate below which any fairy is immediately killed. Defaults to Infinity (off). */
    private _yMax = Infinity;
    /** Scale factor applied to render positions of all fairies in this layer. */
    private _renderScale = 1;

    /** Set the bottom boundary: any fairy whose Y position exceeds this is marked dead. */
    setYMax(yMax: number): void {
        this._yMax = yMax;
    }

    /**
     * Set the render-position scale factor for all fairies in this layer.
     * Call before linking any fairies (already-linked fairies are not updated).
     * Use e.g. `TILE_SIZE / PHYSICAL_TILE_SIZE` when the physics world is larger
     * than the display canvas.
     */
    setRenderScale(scale: number): void {
        this._renderScale = scale;
    }

    /** Set the rendering context that will be passed to each linked fairy. */
    setContext(ctx: CanvasRenderingContext2D): void {
        this._ctx = ctx;
    }

    /**
     * Add a fairy to this layer.
     * Assigns the layer's canvas context to the fairy and appends it to the list.
     */
    linkFairy(fairy: Fairy): void {
        fairy.setContext(this._ctx!);
        fairy.renderScale = this._renderScale;
        this._fairies.push(fairy);
    }

    /**
     * Advance all fairies by one tick, then remove any that are marked dead.
     */
    proceed(): void {
        let hasDeadFairies = false;
        for (const fairy of this._fairies) {
            fairy.proceed();
            if (fairy.oFlight.vPosition.y > this._yMax) {
                fairy.bDead = true;
            }
            hasDeadFairies ||= fairy.bDead;
        }
        if (hasDeadFairies) {
            this._removeDeadFairies();
        }
    }

    /** Draw all fairies in insertion order. */
    render(): void {
        for (const fairy of this._fairies) {
            fairy.render();
        }
    }

    /**
     * Sweep the fairy list from the end, removing dead entries using swap-with-last
     * for O(1) removal.  Calls `free()` on each removed fairy to unregister it from
     * the collider.
     */
    private _removeDeadFairies(): void {
        for (let i = this._fairies.length - 1; i >= 0; i--) {
            if (this._fairies[i].bDead) {
                this._fairies[i].free();
                // swap-with-last for O(1) removal
                const last = this._fairies.pop()!;
                if (i < this._fairies.length) {
                    this._fairies[i] = last;
                }
            }
        }
    }
}
