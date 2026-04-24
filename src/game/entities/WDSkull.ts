import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { Fairy, FairyBaseEvents } from '../../engine/Fairy';
import { TILE_SIZE } from '../consts';

export type WDSkullEvents = FairyBaseEvents & {
    /** Emitted each time the skull wants to throw a grenade (variant 0). */
    throw: { x: number; y: number; face: number };
    /** Emitted each time the skull wants to drop a flame (variant 1). */
    drop: { x: number; y: number };
};

/** Horizontal patrol speed (pixels/tick), close to player fSpeed = 3. */
const SKULL_SPEED = 2.5;
/** How often the skull throws a grenade, in ticks (~3 s at 60 Hz). */
export const SKULL_GRENADE_THROWING_MIN_TIME = Math.trunc(2.5 * 60);
export const SKULL_GRENADE_THROWING_MAX_TIME = Math.trunc(3 * 60);
export const SKULL_FLAME_DROPPING_MIN_TIME = Math.trunc(1.5 * 60);
export const SKULL_FLAME_DROPPING_MAX_TIME = Math.trunc(4 * 60);
/** Sinusoidal buoyancy: angular frequency (radians/tick). */
const SKULL_BUOYANCY_FREQ = 0.05;
/**
 * Sinusoidal buoyancy: peak vertical speed amplitude (pixels/tick).
 * With freq = 0.05 the position oscillates ±(amp/freq) ≈ ±24 px around
 * the spawn height, giving a gentle floating bob.
 */
const SKULL_BUOYANCY_AMP = 1.2;

/**
 * Non-player hovering skull that patrols the upper area of the level.
 *
 * - Moves horizontally at SKULL_SPEED, reversing direction on solid walls
 *   (handled by a 'move' observer attached in WDGame).
 * - Vertical motion is purely sinusoidal (no gravity): speed oscillates
 *   as A·sin(phase·freq), producing a ±24 px bob around the spawn height.
 * - Throws a WDSkullGrenade every SKULL_GRENADE_THROWING_TIME ticks via
 *   the 'throw' event; WDGame listens and spawns the projectile.
 * - Tangibility mask 0 — the skull cannot be hit by projectiles.
 *
 * Sprite: wdspr_fire_z2.png, 16×16, tile 37, single static frame.
 */
export class WDSkull extends Fairy<WDSkullEvents> {
    /** Current facing / patrol direction: -1 = left, 1 = right. */
    nFace: number;
    /** 0 = grenade-throwing skull (tile 37), 1 = flame-dropping skull (tile 36). */
    readonly variant: number;
    /** Phase accumulator for the buoyancy sine (ticks). */
    private _buoyancyPhase = 0;
    /** Countdown to the next action (throw or drop), in ticks. */
    private _actionTimer: number;

    /**
     * @param variant - 0 = grenade thrower (tile 37, default), 1 = flame dropper (tile 36).
     */
    constructor(variant = 0) {
        super();

        this.variant = variant;

        this.setSize(TILE_SIZE / 2, TILE_SIZE / 2);
        this.setScale(1);
        this.vReference.set(8, 8);

        // No collision — the skull is purely a hazard, not a target.
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(0, 0), new Vector2D(0, 0)), 0);

        const anim = new FairyAnimation();
        // Variant 0: tile 37 (grenade thrower); variant 1: tile 36 (flame dropper).
        anim.setFrameRange(variant === 1 ? 36 : 37, 1);
        anim.setNoLoop();
        this.aAnimations.push(anim);
        this.playAnimation(0);

        // Start moving in a random direction.
        this.nFace = Math.random() < 0.5 ? -1 : 1;

        // Stagger the first action so multiple skulls don't all fire at t=0.
        this._actionTimer = 0;
        this.resetActionTimer();
    }

    resetActionTimer() {
        switch (this.variant) {
            case 0: {
                this._actionTimer =
                    1 +
                    SKULL_GRENADE_THROWING_MIN_TIME +
                    Math.floor(
                        Math.random() *
                            (SKULL_GRENADE_THROWING_MAX_TIME - SKULL_GRENADE_THROWING_MIN_TIME)
                    );
                break;
            }
            case 1: {
                this._actionTimer =
                    1 +
                    SKULL_FLAME_DROPPING_MIN_TIME +
                    Math.floor(
                        Math.random() *
                            (SKULL_FLAME_DROPPING_MAX_TIME - SKULL_FLAME_DROPPING_MIN_TIME)
                    );
                break;
            }
            default: {
                // No weapon maybe...
                break;
            }
        }
    }

    override proceed(): void {
        this._buoyancyPhase++;

        // Horizontal: constant speed in the current facing direction.
        // Vertical: sinusoidal bob; vAccel stays zero to prevent drift.
        this.oFlight.vSpeed.set(
            SKULL_SPEED * this.nFace,
            Math.sin(this._buoyancyPhase * SKULL_BUOYANCY_FREQ) * SKULL_BUOYANCY_AMP
        );
        this.oFlight.vAccel.set(0, 0);

        super.proceed();

        if (--this._actionTimer <= 0) {
            this.resetActionTimer();
            if (this.variant === 1) {
                this.oObservatory.notify(this, 'drop', {
                    x: this.oFlight.vPosition.x,
                    y: this.oFlight.vPosition.y,
                });
            } else {
                this.oObservatory.notify(this, 'throw', {
                    x: this.oFlight.vPosition.x,
                    y: this.oFlight.vPosition.y,
                    face: this.nFace,
                });
            }
        }
    }
}
