import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation, LoopType } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';

/** Ticks each animation frame is held. */
const ANIM_TICK_DURATION = 6;
/** Number of frames in the exhaust animation. */
const ANIM_FRAME_COUNT = 4;

/**
 * Short-lived smoke/exhaust particle spawned behind a `WDMissile`.
 * Plays a 4-frame animation once (tiles 3–6 at y=0 in `wdspr_fire_z2.png`)
 * and dies when the animation ends.
 *
 * Tangibility mask 0: never collides with anything.
 */
export class WDExhaust extends Fairy {
    /**
     * @param x - World-space X coordinate to spawn the particle at.
     * @param y - World-space Y coordinate to spawn the particle at.
     */
    constructor(x: number, y: number) {
        super();

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        // Tangibility mask 0: never matches anything, but keeps oBoundingShape defined
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        // Tiles 3-6 at y=0 in wdspr_fire_z2.png — play once then die
        const anim = new FairyAnimation();
        anim.setFrameRange(3, ANIM_FRAME_COUNT);
        anim.setLoop(LoopType.Forward, 1, ANIM_TICK_DURATION, 1);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);

        this.bMortal = true;
        this.nTime = ANIM_TICK_DURATION * ANIM_FRAME_COUNT;
    }
}
