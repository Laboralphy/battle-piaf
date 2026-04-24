import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { FairyFlight } from '../../engine/FairyFlight';
import { Fairy } from '../../engine/Fairy';
import { TILE_SIZE } from '../consts';

/** Hit points removed from a player on direct contact (before shield reduction). */
export const SKULL_GRENADE_DAMAGE = 20;

const GRENADE_ANGLE = Math.PI / 4;
const GRENADE_SPEED = 5;
const GRENADE_INITIAL_X_SPEED = Math.cos(GRENADE_ANGLE) * GRENADE_SPEED;
const GRENADE_INITIAL_Y_SPEED = Math.sin(GRENADE_ANGLE) * GRENADE_SPEED;
const GRENADE_MAX_Y_SPEED = 8;

class WDSkullGrenadeFlight extends FairyFlight {
    override proceed(): void {
        super.proceed();
        if (this.vNewSpeed.y > GRENADE_MAX_Y_SPEED) {
            this.vNewSpeed.y = GRENADE_MAX_Y_SPEED;
        }
    }
}

/**
 * Grenade thrown by the WDSkull NPC.
 *
 * Same arc physics as WDGrenade (gravity + downward speed cap) but has no
 * player owner — damage is a fixed value and no score is awarded on hit.
 *
 * Tangibility mask 7 (111b) hits both players (mask 5 = 101b, mask 6 = 110b).
 * Land collision and player-hit handling are managed externally by WDGame.
 *
 * Sprite: wdspr_fire_z2.png, 16×16.
 *   Tile 7 — right-facing (face = 1)
 *   Tile 8 — left-facing  (face = −1)
 */
export class WDSkullGrenade extends Fairy {
    /** Fixed damage dealt on contact (before shield reduction). */
    readonly damage = SKULL_GRENADE_DAMAGE;

    /**
     * @param x    - World-space X of the skull's centre at throw time.
     * @param y    - World-space Y of the skull's centre at throw time.
     * @param face - Skull's facing direction: 1 = right, -1 = left.
     */
    constructor(x: number, y: number, face: number) {
        super();

        this.setSize(TILE_SIZE / 2, TILE_SIZE / 2);
        this.setScale(1);
        this.vReference.set(8, 8);

        const flight = new WDSkullGrenadeFlight();
        this.setFlight(flight);

        // Hits both players.
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(-6, -6), new Vector2D(5, 5)), 7);

        const animRight = new FairyAnimation();
        animRight.setFrameRange(7, 1);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(8, 1);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(face === 1 ? 0 : 1);

        flight.vAccel.set(0, 0.25);
        // Spawn offset: slightly ahead of and below the skull's centre.
        flight.vPosition.set(x + face * 16, y + 4);
        // Arc launch with a slight random lateral spread (±0.75 px/tick).
        const spread = (Math.random() - 0.5) * 1.5;
        flight.vSpeed.set(GRENADE_INITIAL_X_SPEED * face + spread, -GRENADE_INITIAL_Y_SPEED);
    }
}
