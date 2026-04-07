import { Vector2D } from '../core/Vector2D.js';
import { FairyFlight } from '../engine/FairyFlight.js';

/**
 * Physics state for a player character.
 * Extends `FairyFlight` with:
 * - A downward speed cap to prevent terminal-velocity overshoots.
 * - A `vShock` impulse that is applied each tick and decays exponentially,
 *   used to knock the player back when hit by a missile.
 */
export class WDPlayerFlight extends FairyFlight {
    /**
     * Knock-back impulse added to the player's position each tick.
     * Decays by a factor of ~1/1.3 per tick until it falls below 0.1,
     * at which point it is zeroed out.
     */
    vShock = new Vector2D(0, 0);

    /**
     * Extends base physics with a downward speed cap and the shock impulse.
     * Called each tick before collision handlers run.
     */
    override proceed(): void {
        super.proceed();

        // Cap downward speed
        if (this.vNewSpeed.y > 5) {
            this.vNewSpeed.y = 5;
        }

        this._applyShock();
    }

    /** Apply `vShock` to the candidate position and decay it toward zero. */
    private _applyShock(): void {
        if (this.vShock.x === 0 && this.vShock.y === 0) {
            return;
        }
        this.vNewPosition.add(this.vShock);
        const d = this.vShock.distance() / 1.3;
        this.vShock.normalize().mul(d);
        if (d < 0.1) {
            this.vShock.x = this.vShock.y = 0;
        }
    }
}
