import { Fairy } from '../engine/Fairy.js';
import { WDPlayer } from './WDPlayer.js';
import type { SoundId } from './SoundManager.js';

/**
 * Abstract base class for all projectiles fired by a player.
 * Carries a reference to the owning player and inherits the player's facing
 * direction at the time of firing.
 *
 * On the first tick, fires a `'fire'` event on `oObservatory` so that game-level
 * listeners (e.g. WDGame) can react (play a sound, spawn effects, etc.) without
 * needing a direct reference to the sound system.
 *
 * Concrete subclasses: `WDBullet` (straight-line), `WDMissile` (homing).
 */
export abstract class WDFire extends Fairy {
    /** The player who fired this projectile; receives the score on a hit. */
    readonly oOwner: WDPlayer;
    /** Firing direction inherited from the owner: -1 = left, 1 = right. */
    readonly nFace: number;
    /** Sound to play when this projectile fires. Declared by each subclass. */
    abstract readonly soundOnFire: SoundId;
    abstract readonly soundOnExplosion: SoundId;

    private _fired = false;

    constructor(owner: WDPlayer) {
        super();
        this.oOwner = owner;
        this.nFace = owner.nFace;
    }

    /**
     * Fires a `'fire'` event on the first tick, then delegates to `Fairy.proceed`.
     * Subclasses that override `proceed` must call `super.proceed()` to preserve this.
     */
    override proceed(): void {
        if (!this._fired) {
            this._fired = true;
            this.oObservatory.notify(this, 'fire', this.oFlight);
        }
        super.proceed();
    }
}
