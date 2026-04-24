import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { WDPlayer } from './WDPlayer';
import { WDFire } from './WDFire';
import type { SoundId } from '../SoundManager';
import WEAPON_DATA from '../../data/weapons.json';
import { TILE_SIZE } from '../consts';

/**
 * Plasma ball projectile — behaves identically to WDBullet but uses
 * tiles 9 (right) and 10 (left) from `wdspr_fire_z2.png`, and spawns
 * a WDPlasmaImpact on explosion instead of WDBulletExplosion.
 */
export class WDPlasmaBall extends WDFire {
    readonly soundOnFire: SoundId = 'shoot-plasma';
    readonly soundOnExplosion: SoundId = 'hit';

    constructor(owner: WDPlayer) {
        super(owner);

        this.state.damage = WEAPON_DATA.plasma.damage;
        this.state.cost = WEAPON_DATA.plasma.cost;

        this.setSize(TILE_SIZE / 2, TILE_SIZE / 2);
        this.setScale(1);
        this.vReference.set(8, 8);

        const channel = 2 - owner.nCode;
        this.setBoundingShape(
            new FairyCollisionRect(new Vector2D(-8, -6), new Vector2D(7, -1)),
            channel
        );

        /** Right-facing animation: tile 9. */
        const animRight = new FairyAnimation();
        animRight.setFrameRange(9, 1);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        /** Left-facing animation: tile 10. */
        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(10, 1);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(this.nFace === 1 ? 0 : 1);

        this.bMortal = true;
        this._initFlight();
    }

    private _initFlight(): void {
        this.oFlight.vPosition.set(this.oOwner.oFlight.vPosition);
        this.oFlight.vPosition.add(new Vector2D(this.nFace * 16, -20));
        this.oFlight.vSpeed.set(this.nFace * 12, 0);
        this.oFlight.vAccel.set(0, 0);
        this.nTime = 60;
    }
}
