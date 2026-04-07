import { Vector2D } from '../core/Vector2D.js';

/**
 * Physics state for a single sprite.
 * Each tick, `proceed()` computes the next position/speed into `vNew*` vectors.
 * After collision observers have run, `postProceed()` commits the `vNew*` values
 * back to the canonical `v*` vectors.
 * This two-step design lets collision handlers read and modify `vNew*` before
 * the values are finalised.
 */
export class FairyFlight {
    /** Last committed position (world space, pixels). */
    vPosition = new Vector2D();
    /** Last committed speed (pixels per tick). */
    vSpeed = new Vector2D();
    /** Last committed acceleration (pixels per tick²). */
    vAccel = new Vector2D();

    /** Candidate position for the current tick, writable by collision handlers. */
    vNewPosition = new Vector2D();
    /** Candidate speed for the current tick, writable by collision handlers. */
    vNewSpeed = new Vector2D();
    /** Candidate acceleration for the current tick, writable by collision handlers. */
    vNewAccel = new Vector2D();

    /**
     * Integrate physics: compute `vNew*` from the current committed values.
     * Does not write to `vPosition`/`vSpeed`/`vAccel`; call `postProceed` for that.
     */
    proceed(): void {
        this.vNewAccel.set(this.vAccel);
        this.vNewSpeed.set(this.vSpeed).add(this.vAccel);
        this.vNewPosition.set(this.vPosition).add(this.vNewSpeed);
    }

    /**
     * Commit `vNew*` values to `v*`, finalising the tick.
     * Called after all collision observers have had a chance to adjust `vNew*`.
     */
    postProceed(): void {
        this.vPosition.set(this.vNewPosition);
        this.vSpeed.set(this.vNewSpeed);
        this.vAccel.set(this.vNewAccel);
    }
}
