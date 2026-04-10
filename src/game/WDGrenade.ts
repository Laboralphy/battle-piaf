import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { FairyFlight } from '../engine/FairyFlight.js';
import { WDPlayer } from './WDPlayer.js';
import { WDFire } from './WDFire.js';
import type { SoundId } from './SoundManager.js';
import WEAPON_DATA from '../data/weapons.json';

/** Launch angle from horizontal (radians). */
const GRENADE_ANGLE = Math.PI / 4;
/** Total launch speed (pixels/tick) — comparable to the missile's initial speed. */
const GRENADE_SPEED = 5;
/** Horizontal component of the launch speed (before adding the player's own X speed). */
const GRENADE_INITIAL_X_SPEED = Math.cos(GRENADE_ANGLE) * GRENADE_SPEED;
/** Vertical component of the launch speed (upward). */
const GRENADE_INITIAL_Y_SPEED = Math.sin(GRENADE_ANGLE) * GRENADE_SPEED;
/** Maximum downward speed (pixels/tick). */
const GRENADE_MAX_Y_SPEED = 8;

/**
 * Physics for a grenade: standard integration plus a downward speed cap.
 */
class WDGrenadeFlight extends FairyFlight {
    override proceed(): void {
        super.proceed();
        if (this.vNewSpeed.y > GRENADE_MAX_Y_SPEED) {
            this.vNewSpeed.y = GRENADE_MAX_Y_SPEED;
        }
    }
}

/**
 * Grenade projectile thrown in an arc by a player.
 * Affected by gravity; explodes on contact with a solid tile or a player.
 *
 * Sprite: 16×16 tiles from `wdspr_fire_z2.png`.
 * - Tile 7 (x=112, y=0): right-facing grenade.
 * - Tile 8 (x=128, y=0): left-facing grenade.
 */
export class WDGrenade extends WDFire {
    readonly soundOnFire: SoundId = 'shoot-grenade';
    readonly soundOnExplosion: SoundId = 'explosion-missile';

    constructor(owner: WDPlayer) {
        super(owner);

        this.state.damage = WEAPON_DATA.grenade.damage;
        this.state.cost = WEAPON_DATA.grenade.cost;

        this.setSize(16, 16);
        this.setScale(1);
        this.vReference.set(8, 8);

        // setFlight before setBoundingShape so the shape links to the new flight
        const flight = new WDGrenadeFlight();
        this.setFlight(flight);

        // Tangibility mirrors WDBullet/WDMissile
        const channel = 2 - owner.nCode;
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(-6, -6), new Vector2D(5, 5)),
            channel
        );

        const animRight = new FairyAnimation();
        animRight.setFrameRange(7, 1);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(8, 1);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(this.nFace === 1 ? 0 : 1);

        // Gravity
        flight.vAccel.set(0, 0.25);

        // Initial position: slightly ahead of and above the owner
        flight.vPosition.set(owner.oFlight.vPosition);
        flight.vPosition.add(new Vector2D(this.nFace * 16, -20));

        // Initial speed: launch angle + owner's current horizontal speed
        flight.vSpeed.set(
            owner.oFlight.vSpeed.x + GRENADE_INITIAL_X_SPEED * this.nFace,
            -GRENADE_INITIAL_Y_SPEED
        );
    }
}
