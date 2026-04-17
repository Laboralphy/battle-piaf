import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';
import { CrateBonus } from './WDCrate.js';

/** Tile index in wdspr_fire_z2.png (16×16) for each bonus icon. */
const BONUS_TILE: Record<CrateBonus, number> = {
    [CrateBonus.HEAL]: 24,
    [CrateBonus.SHIELD]: 25,
    [CrateBonus.POWERUP]: 26,
    [CrateBonus.MULTICRATE]: 27,
};

/**
 * Short-lived floating sprite spawned when a player picks up a crate.
 * Rises upward (vy = −2, ay = 0.1) and disappears after ~1 second (60 ticks).
 * No collision — purely cosmetic.
 *
 * Sprite sheet: `wdspr_fire_z2.png`, 16×16.
 *   tile 24 — heal
 *   tile 25 — shield
 *   tile 26 — powerup
 */
export class WDBonusIndicator extends Fairy {
    /**
     * @param bonus - Which bonus icon to display.
     * @param x     - World-space X at spawn (centre of the picked crate).
     * @param y     - World-space Y at spawn (centre of the picked crate).
     */
    constructor(bonus: CrateBonus, x: number, y: number) {
        super();

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        const anim = new FairyAnimation();
        anim.setFrameRange(BONUS_TILE[bonus], 1);
        anim.setNoLoop();
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        this.oFlight.vPosition.set(x, y);
        this.oFlight.vSpeed.set(0, -3);
        this.oFlight.vAccel.set(0, 0.1);

        this.bMortal = true;
        this.nTime = 33;
    }
}
