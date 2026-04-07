import { FairyAnimation } from './FairyAnimation.js';

/**
 * A single cell in a `FairyMatrix` tile map.
 * Holds the graphical tile index (`nGfx`), the logical code used for collision
 * (`nCode`), and an optional animation that can cycle the tile's graphics.
 */
export class FairyTile {
    /** Logical collision code: 0 = air, 1 = semi-solid, 2 = fully solid, etc. */
    nCode = 0;
    /** Graphical tile index into the sprite sheet (row-major, 0-based). */
    nGfx = 0;
    /** Animation for this tile. Static tiles use LoopType.None; animated tiles loop. */
    readonly oAnimation = new FairyAnimation();

    constructor() {
        this.oAnimation.setFrameRange(0, 1);
        this.oAnimation.setNoLoop();
    }

    /**
     * Returns true if the tile is currently animated (loop type is not None
     * and the animation has not finished its last pass).
     */
    isDynamic(): boolean {
        return this.oAnimation.nLoopType > 0 && !this.oAnimation.bOver;
    }

    /** Set the graphical tile index. */
    setGfx(n: number): void {
        this.nGfx = n;
    }

    /** Set the logical collision code. */
    setCode(n: number): void {
        this.nCode = n;
    }

    /** Return the logical collision code. */
    getCode(): number {
        return this.nCode;
    }

    /**
     * Advance the tile animation by one tick.
     * When the frame changes, `nGfx` is updated so the matrix redraws the tile.
     */
    proceed(): void {
        this.oAnimation.proceed();
        if (this.oAnimation.isFrameChanged()) {
            this.setGfx(this.oAnimation.nFrameIndex + this.oAnimation.nFrameStart);
        }
    }
}
