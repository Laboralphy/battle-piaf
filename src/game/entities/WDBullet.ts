import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { WDPlayer } from './WDPlayer';
import { WDFire } from './WDFire';
import type { SoundId } from '../SoundManager';
import WEAPON_DATA from '../../data/weapons.json';
import { TILE_SIZE } from '../consts';

/**
 * Fast straight-line projectile fired by a player.
 * Travels horizontally at constant speed (12 px/tick) and dies after 60 ticks.
 *
 * Sprite: 16×16 tile from `wdspr_fire_z2.png`.
 * - Animation 0 (tile 0): right-facing bullet.
 * - Animation 1 (tile 1): left-facing bullet.
 *
 * Tangibility mask ensures a bullet only collides with the opposing player
 * (never with its own owner).
 */
export class WDBullet extends WDFire {
    readonly soundOnFire: SoundId = 'shoot-bullet';
    readonly soundOnExplosion: SoundId = 'hit';

    constructor(owner: WDPlayer) {
        super(owner);

        this.state.damage = WEAPON_DATA.bullet.damage;
        this.state.cost = WEAPON_DATA.bullet.cost;

        this.setSize(TILE_SIZE / 2, TILE_SIZE / 2);
        this.setScale(1);
        this.vReference.set(8, 8);

        // Tangibility: bullet of player 0 = 2 (010b), player 1 = 1 (001b)
        // Players have mask 5 (101b) and 6 (110b), so:
        //   player 0 (101) & bullet of player 1 (001) = 001 → hit
        //   player 1 (110) & bullet of player 0 (010) = 010 → hit
        //   player 0 (101) & its own bullet (010)     = 000 → no hit (self-immunity)
        const channel = 2 - owner.nCode;
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(-8, -6), new Vector2D(7, -1)),
            channel
        );

        /** Right-facing animation: tile 0 in the sprite sheet. */
        const animRight = new FairyAnimation();
        animRight.setFrameRange(0, 1);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        /** Left-facing animation: tile 1 in the sprite sheet. */
        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(1, 1);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(this.nFace === 1 ? 0 : 1);

        this.bMortal = true;
        this._initFlight();
    }

    /** Set the initial position (offset from owner), speed, and lifetime. */
    private _initFlight(): void {
        this.oFlight.vPosition.set(this.oOwner.oFlight.vPosition);
        this.oFlight.vPosition.add(new Vector2D(this.nFace * 16, -20));
        this.oFlight.vSpeed.set(this.nFace * 12, 0);
        this.oFlight.vAccel.set(0, 0);
        this.nTime = 60;
    }
}
