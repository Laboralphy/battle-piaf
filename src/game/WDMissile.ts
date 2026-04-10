import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { WDPlayer } from './WDPlayer.js';
import { WDFire } from './WDFire.js';
import type { SoundId } from './SoundManager.js';
import WEAPON_DATA from '../data/weapons.json';

/** Maximum vertical homing speed in pixels per tick. */
const MAX_VSPEED = 2.5;
/** Vertical nudge applied per tick toward the target's vertical centre. */
const VACCEL = 0.18;
/** Spawn one exhaust particle every N ticks. */
const EXHAUST_INTERVAL = 3;

/**
 * Homing missile fired by a player.
 * Travels horizontally with constant acceleration and gradually steers
 * toward the vertical centre of the target player.  The homing uses
 * exponential damping (`vSpeed.y * 0.9`) to avoid oscillation near the
 * target altitude.  Dies after 90 ticks.
 *
 * Spawns `WDExhaust` trail particles at the rear via a callback to stay
 * decoupled from `FairyEngine`.
 *
 * Sprite: 32×16 tile from `wdspr_fire_z2.png`, row 1 (ySrc = 16).
 * - Animation 0 (tile 32–33): right-facing missile.
 * - Animation 1 (tile 34–35): left-facing missile.
 */
export class WDMissile extends WDFire {
    readonly soundOnFire: SoundId = 'shoot-missile';
    readonly soundOnExplosion: SoundId = 'explosion-missile';

    /** The player this missile is steering toward. */
    private _target: WDPlayer;
    /** Factory callback that spawns an exhaust particle at (x, y). */
    private _spawnExhaust: (x: number, y: number) => void;
    /** Ticks elapsed since the last exhaust particle was spawned. */
    private _exhaustTimer = 0;

    constructor(owner: WDPlayer, target: WDPlayer, spawnExhaust: (x: number, y: number) => void) {
        super(owner);

        this.state.damage = WEAPON_DATA.missile.damage;
        this.state.cost = WEAPON_DATA.missile.cost;

        this._target = target;
        this._spawnExhaust = spawnExhaust;

        this.setSize(32, 16);
        this.setScale(1);
        // Reference at the horizontal centre, top edge, so the missile tip leads.
        this.vReference.set(16, 0);

        // Tangibility mirrors WDBullet: channel 2 for player-0's missile, 1 for player-1's.
        const channel = 2 - owner.nCode;
        const rx1 = owner.nFace === 1 ? 0 : -13;
        const rx2 = owner.nFace === 1 ? 13 : 0;
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(rx1, 6), new Vector2D(rx2, 11)),
            channel
        );

        // Sheet is 512px wide (32 tiles/row at 16px).
        // Tiles 32-33 wrap to row 1: x=0,  y=16 → 32px-stride frame 0 + ySrc=16
        // Tiles 34-35 wrap to row 1: x=32, y=16 → 32px-stride frame 1 + ySrc=16
        const animRight = new FairyAnimation();
        animRight.setFrameRange(0, 1);
        animRight.setFrameSource(0, 16);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(1, 1);
        animLeft.setFrameSource(0, 16);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(this.nFace === 1 ? 0 : 1);

        this.bMortal = true;
        this._initFlight();
    }

    /**
     * Per-tick update: steer vertically toward the target's centre, spawn exhaust,
     * then delegate to `Fairy.proceed` for physics and lifetime.
     */
    override proceed(): void {
        // Nudge vertical speed toward the vertical center of the target sprite
        const targetCenterY =
            this._target.oFlight.vPosition.y - this._target.vReference.y + this._target.nHeight / 2;
        const missileCenterY = this.oFlight.vPosition.y + this.nHeight / 2;
        const dy = targetCenterY - missileCenterY;
        this.oFlight.vSpeed.y = this.oFlight.vSpeed.y * 0.9 + Math.sign(dy) * VACCEL;
        if (this.oFlight.vSpeed.y > MAX_VSPEED) {
            this.oFlight.vSpeed.y = MAX_VSPEED;
        }
        if (this.oFlight.vSpeed.y < -MAX_VSPEED) {
            this.oFlight.vSpeed.y = -MAX_VSPEED;
        }

        // Exhaust trail: spawn a particle at the rear of the missile
        if (++this._exhaustTimer >= EXHAUST_INTERVAL) {
            this._exhaustTimer = 0;
            this._spawnExhaust(
                this.oFlight.vPosition.x - this.nFace * 16,
                this.oFlight.vPosition.y + 8
            );
        }

        super.proceed();
    }

    /**
     * Set the initial position (offset ahead of the owner), initial speed,
     * constant horizontal acceleration, and lifetime.
     */
    private _initFlight(): void {
        this.oFlight.vPosition.set(this.oOwner.oFlight.vPosition);
        this.oFlight.vPosition.add(new Vector2D(this.nFace * 16, -20));
        this.oFlight.vSpeed.set(this.nFace * 5, 0); // starts slower than bullet (12)
        this.oFlight.vAccel.set(this.nFace * 0.1, 0); // constant horizontal acceleration
        this.nTime = 90;
    }
}
