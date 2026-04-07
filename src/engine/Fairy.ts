import { Vector2D } from '../core/Vector2D.js';
import { Observatory } from '../core/Observatory.js';
import { FairyAnimation } from './FairyAnimation.js';
import { FairyFlight } from './FairyFlight.js';
import {
    FairyCollider,
    FairyCollisionShape,
    FairyCollisionSector,
    ICollidable,
    FairyCollisionRect,
} from './FairyCollision.js';

/**
 * Base class for all sprites (players, projectiles, effects).
 * Owns physics (`oFlight`), animation, collision, and a generic data store.
 * Each tick, `proceed()` updates physics, notifies 'move' observers (for collision
 * response), commits physics, and advances the animation. When `bMortal` is true,
 * `nTime` counts down and `bDead` is set to true when it reaches zero.
 */
export class Fairy implements ICollidable {
    /** Physics state: position, speed, acceleration, and their next-tick candidates. */
    oFlight: FairyFlight = new FairyFlight();
    /** Currently playing animation, or null if none. */
    oAnimation: FairyAnimation | null = null;
    /** The sprite sheet image to draw from. Set by FairyEngine.createFairy. */
    oImage: HTMLImageElement | null = null;
    /** The canvas 2D context to render into. Set by Fairies.linkFairy. */
    oContext: CanvasRenderingContext2D | null = null;
    /** The spatial hash collider shared across all sprites. Set by FairyEngine.createFairy. */
    oCollider: FairyCollider | null = null;
    /** The bounding shape used for collision detection. */
    oBoundingShape!: FairyCollisionShape;
    /**
     * Event hub. Observers listen for 'move' (fired each tick after physics,
     * before postProceed) and 'dead' (fired when bDead becomes true).
     */
    readonly oObservatory = new Observatory<Fairy, FairyFlight>();
    /** Arbitrary key/value store for game-specific per-sprite data. */
    readonly oData: Record<string, unknown> = {};

    /** Current collision sector (managed by FairyCollider; do not write directly). */
    _collisionSector: FairyCollisionSector | null = null;

    /** Sprite width in pixels (before zoom). */
    nWidth = 0;
    /** Sprite height in pixels (before zoom). */
    nHeight = 0;
    /** Rendered width in pixels (after zoom). */
    nZWidth = 0;
    /** Rendered height in pixels (after zoom). */
    nZHeight = 0;
    /** Horizontal zoom factor. */
    fXZoom = 1;
    /** Vertical zoom factor. */
    fYZoom = 1;

    /**
     * Rendering anchor point.
     * The sprite is drawn so that its top-left corner is at `(vPosition - vReference)`.
     * Also the centre of the bounding box in most sprites.
     */
    readonly vReference = new Vector2D(0, 0);

    /** Whether `proceed` and `render` should run. */
    bActive = true;
    /** Whether this sprite should be drawn. */
    bVisible = true;
    /** When true, `nTime` counts down each tick and kills the sprite at zero. */
    bMortal = false;
    /** Set to true to remove the sprite on the next cleanup pass. */
    bDead = false;
    /** Remaining ticks before death (only relevant when `bMortal` is true). */
    nTime = 0;

    /** When true, the collision bounding box is drawn in red during `render`. */
    bDebug: boolean = false;

    /** All animation clips available for this sprite; indexed by `playAnimation`. */
    readonly aAnimations: FairyAnimation[] = [];

    /** Replace the default FairyFlight with a subclass (e.g. WDPlayerFlight). */
    setFlight(flight: FairyFlight): void {
        this.oFlight = flight;
    }

    /** Unregister from the collider. Called automatically when the sprite is removed. */
    free(): void {
        if (this.oCollider) {
            this.oCollider.unregisterObject(this);
            this.oCollider = null;
        }
    }

    /** Store an arbitrary value under `key` in the per-sprite data bag. */
    setData(key: string, value: unknown): void {
        this.oData[key] = value;
    }

    /** Retrieve a value from the per-sprite data bag, or null if absent. */
    getData(key: string): unknown {
        return this.oData[key] ?? null;
    }

    /** Set the sprite sheet image to draw from. */
    setImage(image: HTMLImageElement): void {
        this.oImage = image;
    }

    /** Set the canvas context to render into. */
    setContext(ctx: CanvasRenderingContext2D): void {
        this.oContext = ctx;
    }

    /** Attach the spatial hash collider. */
    setCollider(collider: FairyCollider): void {
        this.oCollider = collider;
    }

    /**
     * Attach a bounding shape and set its tangibility mask.
     * The shape is automatically linked to `oFlight` so it tracks the current position.
     */
    setBoundingShape(shape: FairyCollisionShape, tangibilityMask: number): void {
        this.oBoundingShape = shape;
        shape.setFlight(this.oFlight);
        shape.setTangibilityMask(tangibilityMask);
    }

    /** Set the unscaled sprite dimensions and recompute the zoomed dimensions. */
    setSize(w: number, h: number): void {
        this.nWidth = w;
        this.nHeight = h;
        this._applyScale();
    }

    /**
     * Set the zoom factor(s) and recompute the rendered dimensions.
     * A scale of 0 in either axis hides the sprite (`bVisible = false`).
     * @param xz - Horizontal zoom (and vertical if `yz` is omitted).
     * @param yz - Optional separate vertical zoom.
     */
    setScale(xz: number, yz?: number): void {
        this.fXZoom = xz;
        this.fYZoom = yz ?? xz;
        this.setVisible(this.fXZoom * this.fYZoom !== 0);
        this._applyScale();
    }

    /** Recompute `nZWidth`/`nZHeight` from the current size and zoom. */
    private _applyScale(): void {
        this.nZWidth = Math.trunc(this.nWidth * this.fXZoom);
        this.nZHeight = Math.trunc(this.nHeight * this.fYZoom);
    }

    /**
     * Activate one of the animation clips from `aAnimations`.
     * Out-of-range indices fall back to a frozen single-frame animation at frame 0.
     */
    playAnimation(index: number): void {
        if (index >= 0 && index < this.aAnimations.length) {
            this.oAnimation = this.aAnimations[index];
        } else {
            this.oAnimation = new FairyAnimation();
            this.oAnimation.setFrameRange(0, 0);
            this.oAnimation.setNoLoop();
        }
        this.oAnimation.resetLoop();
    }

    /**
     * Advance the sprite by one tick.
     * Order: physics → register in collider → notify 'move' observers
     *        → commit physics → advance animation → decrement life timer.
     * Subclasses can override to add custom per-tick logic.
     */
    proceed(): void {
        if (!this.bActive) {return;}

        this.oFlight.proceed();
        if (this.oCollider) {
            this.oCollider.registerObject(this);
        }
        this.oObservatory.notify(this, 'move', this.oFlight);
        this.oFlight.postProceed();

        this.oAnimation?.proceed();

        if (this.bMortal) {
            this.bDead ||= --this.nTime <= 0;
        }
        if (this.bDead) {
            this.oObservatory.notify(this, 'dead', this.oFlight);
        }
    }

    /** Show or hide the sprite without affecting physics or collision. */
    setVisible(b: boolean): void {
        this.bVisible = b;
    }

    /**
     * Draw the current animation frame onto `oContext`.
     * Source rect: `(sx, ySrc, nWidth, nHeight)` from `oImage`.
     * Destination: `(vPosition - vReference)`, size `(nZWidth, nZHeight)`.
     * No-op if the sprite is invisible or any required resource is missing.
     */
    render(): void {
        if (!this.bVisible || !this.oImage || !this.oContext || !this.oAnimation) {return;}
        const sx = Math.floor(
            (this.oAnimation.nFrameIndex + this.oAnimation.nFrameStart) * this.nWidth +
                this.oAnimation.xSrc
        );
        this.oContext.drawImage(
            this.oImage,
            sx,
            this.oAnimation.ySrc,
            this.nWidth,
            this.nHeight,
            Math.floor(this.oFlight.vPosition.x - this.vReference.x),
            Math.floor(this.oFlight.vPosition.y - this.vReference.y),
            this.nZWidth,
            this.nZHeight
        );
        if (this.bDebug && this.oBoundingShape) {
            this.oContext.strokeStyle = 'red';
            this.oContext.lineWidth = 1;
            const [v1, v2] = (this.oBoundingShape as FairyCollisionRect).getPoints();
            this.oContext.strokeRect(v1.x, v1.y, v2.x - v1.x - 1, v2.y - v1.y - 1);
        }
    }
}
