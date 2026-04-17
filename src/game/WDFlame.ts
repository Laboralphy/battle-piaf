import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation, LoopType } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy, FairyBaseEvents } from '../engine/Fairy.js';
import WEAPON_DATA from '../data/weapons.json';

export type WDFlameEvents = FairyBaseEvents & {
    /** Emitted every SMOKE_INTERVAL ticks so WDGame can spawn a WDExhaust puff. */
    smoke: { x: number; y: number };
};

/** Ticks between smoke puffs (~750 ms at 60 Hz). */
const SMOKE_INTERVAL = 45;

/**
 * Flame hazard spawned from large explosions (missile / grenade / skull grenade).
 *
 * **Airborne phase** — launched upward with a random horizontal speed in [-1, +1]
 * and falls under normal gravity (vAccel.y = 0.25, same as players).
 * Land collision is handled externally by a 'move' observer in WDGame:
 * on touching a semi-solid or fully solid tile the flame transitions to the
 * grounded phase.
 *
 * **Grounded phase** — speed and acceleration are zeroed; `bMortal` and `nTime`
 * are set by WDGame (to FLAME_DURATION ticks) so the flame expires on its own.
 *
 * Tangibility mask 7 (111b): can collide with both players.
 * On contact WDGame applies `damage`, knocks the player back, spawns a WDExplosion,
 * and marks this flame dead.
 *
 * Sprite: wdspr_fire_z2.png, 16×32, tile 28, 4-frame looped animation (~200 ms/frame).
 */
export class WDFlame extends Fairy<WDFlameEvents> {
    /** Hit points removed from a player on contact (before shield reduction). */
    readonly damage: number = WEAPON_DATA.flame.damage;
    /** True once the flame has settled on a solid tile. */
    bGrounded = false;
    /** Countdown to the next smoke puff (ticks). */
    private _smokeTimer = SMOKE_INTERVAL;

    /**
     * @param x  - World-space X of the spawn point.
     * @param y  - World-space Y of the spawn point.
     * @param vx - Initial horizontal speed (default: random in [-1, +1]).
     * @param vy - Initial vertical speed   (default: -1, upward).
     */
    constructor(x: number, y: number, vx = Math.random() * 2 - 1, vy = -1) {
        super();

        this.setSize(16, 32);
        this.setScale(1);
        // Anchor near the base so the flame sits flush on the ground when grounded.
        this.vReference.set(8, 28);

        // Hits both players.
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(-6, -6), new Vector2D(6, 6)), 7);

        const anim = new FairyAnimation();
        anim.setFrameRange(28, 4);
        // ~200 ms/frame at 60 Hz ≈ 12 ticks; count 0 = eternal loop.
        anim.setLoop(LoopType.Forward, 1, 12, 0);
        this.aAnimations.push(anim);
        this.playAnimation(0);

        this.oFlight.vPosition.set(x, y);
        // Random horizontal spread, always launched upward.
        this.oFlight.vSpeed.set(vx, vy);
        // Same gravity as players.
        this.oFlight.vAccel.set(0, 0.25);
    }

    override proceed(): void {
        super.proceed();
        if (--this._smokeTimer <= 0) {
            this._smokeTimer = SMOKE_INTERVAL;
            this.oObservatory.notify(this, 'smoke', {
                x: this.oFlight.vPosition.x,
                y: this.oFlight.vPosition.y - (this.nZHeight >> 1),
            });
        }
    }
}
