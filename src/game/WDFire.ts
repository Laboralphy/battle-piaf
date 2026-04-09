import { Fairy, FairyBaseEvents } from '../engine/Fairy.js';
import { FairyFlight } from '../engine/FairyFlight.js';
import { WDPlayer } from './WDPlayer.js';
import type { SoundId } from './SoundManager.js';
import { WeaponState } from './state/WeaponState.js';
import { Observatory } from '../core/Observatory.js';

/**
 * Event map for all projectiles.
 * Extends `FairyBaseEvents` with a `'fire'` event that fires on the first tick,
 * allowing game-level listeners to react (play a sound, spawn effects, etc.)
 * without the projectile needing a direct reference to the sound system.
 */
export type WDFireEvents = FairyBaseEvents & {
    /** Emitted once on the first tick, just before the projectile's physics runs. */
    fire: FairyFlight;
};

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
 *
 * `TEvents` allows further subclasses to extend the event map while keeping
 * the `'fire'` event available.
 */
export abstract class WDFire<TEvents extends WDFireEvents = WDFireEvents> extends Fairy<TEvents> {
    /** The player who fired this projectile; receives the score on a hit. */
    readonly oOwner: WDPlayer;
    /** Firing direction inherited from the owner: -1 = left, 1 = right. */
    readonly nFace: number;
    /** Sound to play when this projectile fires. Declared by each subclass. */
    abstract readonly soundOnFire: SoundId;
    /** Sound to play when this projectile explodes on impact. Declared by each subclass. */
    abstract readonly soundOnExplosion: SoundId;

    private _fired = false;
    private readonly _state: WeaponState;

    constructor(owner: WDPlayer) {
        super();
        this.oOwner = owner;
        this.nFace = owner.nFace;
        this._state = {
            damage: 0,
            cost: 0,
        };
    }

    /** Weapon stats (damage, etc.) for this projectile. */
    get state(): WeaponState {
        return this._state;
    }

    /**
     * Fires a `'fire'` event on the first tick, then delegates to `Fairy.proceed`.
     * Subclasses that override `proceed` must call `super.proceed()` to preserve this.
     */
    override proceed(): void {
        if (!this._fired) {
            this._fired = true;
            (this.oObservatory as unknown as Observatory<Fairy, WDFireEvents>).notify(
                this,
                'fire',
                this.oFlight
            );
        }
        super.proceed();
    }
}
