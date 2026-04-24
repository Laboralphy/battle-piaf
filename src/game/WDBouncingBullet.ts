import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { WDPlayer } from './WDPlayer.js';
import { WDFire } from './WDFire.js';
import type { SoundId } from './SoundManager.js';
import WEAPON_DATA from '../data/weapons.json';

/** Horizontal travel speed (px/tick) — both before and after the bounce. */
const BULLET_SPEED = 8;
/** Lifetime of the initial horizontal leg (ticks). */
const INITIAL_LIFETIME = 120;
/** Lifetime of the diagonal leg after the bounce (ticks). */
const POST_BOUNCE_LIFETIME = 90;

/**
 * Bouncing bullet projectile.
 *
 * Phase 1 — horizontal travel:
 *   Fired in the owner's facing direction (X+ or X-) at constant speed.
 *   No gravity. Lifetime: INITIAL_LIFETIME ticks.
 *
 * Phase 2 — first solid-tile hit → bounce:
 *   X component reverses, a random Y component (±BULLET_SPEED, i.e. ±45°) is added.
 *   Lifetime resets to POST_BOUNCE_LIFETIME ticks.
 *
 * Phase 3 — second solid-tile hit → explodes normally.
 *
 * Sprite tiles in wdspr_fire_z2.png (16×16 grid):
 *   70 → X+          (right horizontal)
 *   71 → X-          (left horizontal)
 *   72 → X+ Y-       (right-up diagonal)
 *   73 → X+ Y+       (right-down diagonal)
 *   74 → X- Y+       (left-down diagonal)
 *   75 → X- Y-       (left-up diagonal)
 *
 * Six single-frame animations are pre-built (indices 0–5 in `aAnimations`).
 * `playAnimation(i)` switches the visual immediately.
 */
export class WDBouncingBullet extends WDFire {
    readonly soundOnFire: SoundId = 'shoot-bullet';
    readonly soundOnExplosion: SoundId = 'hit';

    /** True after the first land hit. Next collision will explode the projectile. */
    private _bounced = false;

    constructor(owner: WDPlayer) {
        super(owner);

        this.state.damage = WEAPON_DATA.bouncingBullet.damage;
        this.state.cost   = WEAPON_DATA.bouncingBullet.cost;

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        // Tangibility: same scheme as WDBullet.
        // bullet of player 0 → channel 2 (010b), player 1 → channel 1 (001b)
        const channel = 2 - owner.nCode;
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(-6, -6), new Vector2D(5, 5)),
            channel
        );

        // Build six single-frame animations, one per travel direction.
        // aAnimations index → tile:
        //   0 → 70 (X+)    1 → 71 (X-)
        //   2 → 72 (X+Y-)  3 → 73 (X+Y+)
        //   4 → 74 (X-Y+)  5 → 75 (X-Y-)
        for (let tile = 70; tile <= 75; tile++) {
            const anim = new FairyAnimation();
            anim.setFrameRange(tile, 1);
            anim.setNoLoop();
            this.aAnimations.push(anim);
        }

        // Initial visual: face right (anim 0) or face left (anim 1).
        this.playAnimation(this.nFace === 1 ? 0 : 1);

        this.bMortal = true;

        // Initial position: slightly ahead of and above the owner.
        this.oFlight.vPosition.set(owner.oFlight.vPosition);
        this.oFlight.vPosition.add(new Vector2D(this.nFace * 16, -20));
        // Horizontal travel, no gravity.
        this.oFlight.vSpeed.set(this.nFace * BULLET_SPEED, 0);
        this.oFlight.vAccel.set(0, 0);
        this.nTime = INITIAL_LIFETIME;
    }

    /**
     * Called by `WDGame._checkProjectileLandCollision` when the centre of this
     * projectile enters a solid tile.
     *
     * @returns `true`  — bounce was applied; caller must NOT explode the projectile.
     *          `false` — already bounced; caller should explode it normally.
     */
    tryBounce(): boolean {
        if (this._bounced) {
            return false;
        }
        this._bounced = true;

        // Reverse X and randomly add an upward or downward Y component.
        this.oFlight.vNewSpeed.x = -this.oFlight.vNewSpeed.x;
        this.oFlight.vNewSpeed.y = Math.random() < 0.5 ? -BULLET_SPEED : BULLET_SPEED;

        this._updateAnim();

        // Reset lifetime for the post-bounce diagonal leg.
        this.nTime = POST_BOUNCE_LIFETIME;
        return true;
    }

    /**
     * Select the animation that matches the current travel direction.
     * Must be called after `vNewSpeed` has been updated.
     */
    private _updateAnim(): void {
        const vx = this.oFlight.vNewSpeed.x;
        const vy = this.oFlight.vNewSpeed.y;
        let idx: number;
        if (vy === 0) {
            // Horizontal (initial state only).
            idx = vx >= 0 ? 0 : 1;
        } else if (vx >= 0) {
            // Going right: up (72→idx 2) or down (73→idx 3).
            idx = vy < 0 ? 2 : 3;
        } else {
            // Going left: down (74→idx 4) or up (75→idx 5).
            idx = vy > 0 ? 4 : 5;
        }
        this.playAnimation(idx);
    }
}
