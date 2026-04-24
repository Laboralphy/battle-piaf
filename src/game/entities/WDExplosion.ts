import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation, LoopType } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { Fairy } from '../../engine/Fairy';
import { TILE_SIZE } from '../consts';

/** Ticks each animation frame is held. */
const ANIM_TICK_DURATION = 4;
/** Number of frames in the explosion animation. */
const ANIM_FRAME_COUNT = 5;

/**
 * One-shot explosion effect spawned when a missile hits a player.
 * Plays a 5-frame animation once (32×32 tiles starting at x=192, y=0
 * in `wdspr_fire_z2.png`) and dies when the animation ends.
 *
 * Tangibility mask 0: purely visual; never participates in collision.
 */
export class WDExplosion extends Fairy {
    /**
     * @param x - World-space X coordinate at the centre of the explosion.
     * @param y - World-space Y coordinate at the centre of the explosion.
     */
    constructor(x: number, y: number) {
        super();

        this.setSize(TILE_SIZE, TILE_SIZE);
        this.setScale(1);
        // Reference at the visual centre so the explosion is centred on the impact point.
        this.vReference.set(16, 16);

        // Tangibility mask 0: never matches anything
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        // 5-frame explosion starting at x=192 (frame 6 at 32px stride), y=0
        const anim = new FairyAnimation();
        anim.setFrameRange(6, ANIM_FRAME_COUNT);
        anim.setLoop(LoopType.Forward, 1, ANIM_TICK_DURATION, 1);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);

        this.bMortal = true;
        this.nTime = ANIM_TICK_DURATION * ANIM_FRAME_COUNT;
    }
}
