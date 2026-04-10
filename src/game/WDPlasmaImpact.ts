import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation, LoopType } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';

/** Ticks each animation frame is held. */
const ANIM_TICK_DURATION = 4;

/**
 * One-shot impact effect spawned when a plasma ball hits a player.
 * Plays a 3-step yoyo sequence (tile 41 → 42 → 41, 16×16, row 1 of
 * `wdspr_fire_z2.png`) and dies when the time is up.
 *
 * Tangibility mask 0: purely visual; never participates in collision.
 */
export class WDPlasmaImpact extends Fairy {
    /**
     * @param x - World-space X coordinate at the centre of the impact.
     * @param y - World-space Y coordinate at the centre of the impact.
     */
    constructor(x: number, y: number) {
        super();

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        // Tiles 41–42 = row 1 (ySrc=16), cols 9–10.
        // Yoyo over 2 frames produces the 41 → 42 → 41 sequence.
        const anim = new FairyAnimation();
        anim.setFrameRange(9, 3);
        anim.setFrameSource(0, 16);
        anim.setLoop(LoopType.Forward, 1, ANIM_TICK_DURATION, 1);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);

        this.bMortal = true;
        this.nTime = ANIM_TICK_DURATION * 3;
    }
}
