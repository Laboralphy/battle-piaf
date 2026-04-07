import { Fairy } from '../engine/Fairy.js';
import { WDPlayer } from './WDPlayer.js';

/**
 * Abstract base class for all projectiles fired by a player.
 * Carries a reference to the owning player and inherits the player's facing
 * direction at the time of firing.
 *
 * Concrete subclasses: `WDBullet` (straight-line), `WDMissile` (homing).
 */
export abstract class WDFire extends Fairy {
    /** The player who fired this projectile; receives the score on a hit. */
    readonly oOwner: WDPlayer;
    /** Firing direction inherited from the owner: -1 = left, 1 = right. */
    readonly nFace: number;

    constructor(owner: WDPlayer) {
        super();
        this.oOwner = owner;
        this.nFace = owner.nFace;
    }
}
