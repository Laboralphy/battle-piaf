import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation, LoopType } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';

/** Ticks each animation frame is held. */
const ANIM_TICK_DURATION = 4;
/** Number of frames in the explosion animation. */
const ANIM_FRAME_COUNT   = 3;

/**
 * One-shot explosion effect spawned when a bullet hits a player.
 * Plays a 3-frame animation once (16×16 tiles starting at tile 38,
 * i.e. xSrc=0, ySrc=16 with nFrameStart=6 in `wdspr_fire_z2.png`)
 * and dies when the animation ends.
 *
 * Tangibility mask 0: purely visual; never participates in collision.
 */
export class WDBulletExplosion extends Fairy {
    /**
     * @param x - World-space X coordinate at the centre of the explosion.
     * @param y - World-space Y coordinate at the centre of the explosion.
     */
    constructor(x: number, y: number) {
        super();

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        // Tangibility mask 0: never matches anything
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)),
            0
        );

        // 3-frame explosion: tile 38 = row 1 col 6 → xSrc=0, ySrc=16, frameStart=6
        const anim = new FairyAnimation();
        anim.setFrameRange(6, ANIM_FRAME_COUNT);
        anim.setFrameSource(0, 16);
        anim.setLoop(LoopType.Forward, 1, ANIM_TICK_DURATION, 1);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);

        this.bMortal = true;
        this.nTime = ANIM_TICK_DURATION * ANIM_FRAME_COUNT;
    }
}
