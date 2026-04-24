import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation, LoopType } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';

/** Ticks each animation frame is held. */
const ANIM_TICK_DURATION = 4;
/** Number of frames in the impact animation. */
const ANIM_FRAME_COUNT = 3;

/**
 * One-shot impact effect spawned when a projectile hits a player or a tile.
 * Plays a 3-frame animation once and then dies.
 *
 * All frames are 16×16 tiles on row 1 (ySrc = 16) of `wdspr_fire_z2.png`.
 * The starting tile is caller-supplied:
 *   6 → bullet impact  (tiles 6–8)
 *   9 → plasma impact  (tiles 9–11)
 *
 * Tangibility mask 0: purely visual; never participates in collision.
 */
export class WDImpact extends Fairy {
    /**
     * @param x          - World-space X coordinate at the centre of the effect.
     * @param y          - World-space Y coordinate at the centre of the effect.
     * @param frameStart - Index of the first tile in the animation strip.
     */
    constructor(x: number, y: number, frameStart: number) {
        super();

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        const anim = new FairyAnimation();
        anim.setFrameRange(frameStart, ANIM_FRAME_COUNT);
        anim.setFrameSource(0, 0);
        anim.setLoop(LoopType.Forward, 1, ANIM_TICK_DURATION, 1);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);

        this.bMortal = true;
        this.nTime = ANIM_TICK_DURATION * ANIM_FRAME_COUNT;
    }
}
