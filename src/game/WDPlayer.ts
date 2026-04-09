import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { FairyInputState } from '../engine/FairyInputState.js';
import { Fairy, FairyBaseEvents } from '../engine/Fairy.js';
import { WDPlayerFlight } from './WDPlayerFlight.js';
import { WDFire } from './WDFire.js';
import { PlayerState } from './state/PlayerState.js';
import { Store } from '../store';

/** Weapons a player can fire. */
export const enum Weapon {
    WEAPON_BULLET,
    WEAPON_MISSILE,
    WEAPON_GRENADE,
}

/**
 * Key bindings for one player.
 * Values are browser key codes (see `FairyKeys`).
 */
export interface PlayerKeys {
    /** Move left. */
    left: number;
    /** Move right. */
    right: number;
    /** Jump (only when on a floor tile). */
    up: number;
    /** Fire a projectile. */
    fire: number;
    /** Drop through a semi-solid platform (optional). */
    down?: number;
}

/**
 * Event map for the player sprite.
 * Extends `FairyBaseEvents` with a `'damaged'` event carrying the amount dealt.
 */
export type WDPlayerEvents = FairyBaseEvents & {
    /** Emitted when the player is hit by a projectile, after hitpoints are updated. */
    damaged: { damage: number; damagedBy: WDFire };
};

/**
 * A playable character sprite.
 * Reads input each tick via `updateState` and exposes state flags that the game
 * loop (`WDGame`) reads to trigger jumps, firing, etc.
 *
 * Sprite sheet: `wdspr_pl_z2.png`.
 * - Player 0 (blue): tiles 0 (right) and 1 (left).
 * - Player 1 (red):  tiles 2 (right) and 3 (left).
 *
 * Tangibility mask: player 0 = 5 (101b), player 1 = 6 (110b).
 * This ensures each player is hit by the opponent's projectiles but not their own.
 */
export class WDPlayer extends Fairy<WDPlayerEvents> {
    /** Player index: 0 = blue player, 1 = red player. */
    readonly nCode: number;

    /** Horizontal movement intent this tick: -1 = left, 0 = still, 1 = right. */
    nDir: number = 0;
    /** Last horizontal facing direction: -1 = left, 1 = right. */
    nFace: number = 1;

    /** True when the player is resting on a floor tile this tick. */
    bOnFloor: boolean = false;
    /** Set to true by `updateState` when the fire key is pressed; consumed by WDGame. */
    bWantFire: boolean = false;
    /** Set to true by `updateState` when a jump is initiated; consumed by WDGame for sound. */
    bJustJumped: boolean = false;
    /** Set to true by `updateState` when the down key is pressed while on a floor; consumed by WDGame collision. */
    nWantDown: number = 0;

    /** Vertical speed applied when jumping (negative = upward). */
    readonly fJump = 6.9;
    /** Horizontal speed applied when moving left or right. */
    readonly fSpeed = 3;
    /** Weapon selected for the next shot; set by WDGame before spawning a projectile. */
    selectedWeapon: Weapon = Weapon.WEAPON_MISSILE;

    /** Fire spritesheet image used to draw the shield overlay. Set by WDGame after creation. */
    oFireImage: HTMLImageElement | null = null;

    readonly store = new Store<PlayerState>({
        hitPoints: 100,
        vitality: 100,
        power: 1,
        defense: 1,
        score: 0,
        bulletHitStreak: 0,
        displayed: false,
        energy: 100,
        maxEnergy: 100,
        shield: 2,
        shieldTime: 240,
    });

    constructor(nCode: number) {
        super();
        this.nCode = nCode;
        this.setSize(32, 32);
        this.setScale(1);
        // vReference at (16, 31): bottom-centre of the sprite is the physics anchor.
        this.vReference.set(16, 31);

        const flight = new WDPlayerFlight();
        this.setFlight(flight);
        flight.vPosition.set(
            Math.floor(Math.random() * 600),
            440 - Math.floor(Math.random() * 400)
        );
        // Constant downward gravity.
        flight.vAccel.set(0, 0.25);

        // Tangibility: player 0 = 5 (101b), player 1 = 6 (110b)
        // This means each player collides with the enemy's bullets but not their own.
        const PLAYER_THICKNESS = 13;
        this.setBoundingShape(
            new FairyCollisionRect(
                new Vector2D(-PLAYER_THICKNESS + 1, -31),
                new Vector2D(PLAYER_THICKNESS, 0)
            ),
            4 + nCode + 1
        );

        // Animation 0: facing right; Animation 1: facing left
        const animRight = new FairyAnimation();
        animRight.setFrameRange(nCode * 2, 1);
        animRight.setNoLoop();
        this.aAnimations.push(animRight);

        const animLeft = new FairyAnimation();
        animLeft.setFrameRange(nCode * 2 + 1, 1);
        animLeft.setNoLoop();
        this.aAnimations.push(animLeft);

        this.playAnimation(0);
    }

    /**
     * Read the current input state and update movement, jump, and fire flags.
     * Must be called once per tick before the physics `proceed`.
     * Consumes the jump and fire keys (sets them to false) to prevent auto-repeat.
     */
    updateState(input: FairyInputState): void {
        const keys = this.getData('keys') as PlayerKeys;
        this.nDir = 0;

        if (input.getKeyState(keys.right)) {
            this.nDir++;
        }
        if (input.getKeyState(keys.left)) {
            this.nDir--;
        }

        if (input.getKeyState(keys.up)) {
            if (this.bOnFloor) {
                this.oFlight.vSpeed.y = -this.fJump;
                this.bJustJumped = true;
            }
            input.setKeyState(keys.up, false);
        }

        if (input.getKeyState(keys.fire)) {
            this.bWantFire = true;
            input.setKeyState(keys.fire, false);
        }

        if (keys.down !== undefined && input.getKeyState(keys.down)) {
            if (this.bOnFloor) {
                this.nWantDown = 15;
            }
            input.setKeyState(keys.down, false);
        }

        this.oFlight.vSpeed.x = this.nDir * this.fSpeed;
        this._updateFace();
    }

    /** Update `nFace` and switch to the matching animation when the player changes direction. */
    private _updateFace(): void {
        if (this.nDir === -1) {
            this.nFace = -1;
            this.playAnimation(1);
        } else if (this.nDir === 1) {
            this.nFace = 1;
            this.playAnimation(0);
        }
    }

    proceed() {
        super.proceed();
        const ss = this.store.state;
        ss.energy = Math.min(ss.maxEnergy, ss.energy + 1);
        if (ss.shield > 0) {
            if (ss.shieldTime > 0) {
                ss.shieldTime--;
            } else {
                ss.shield = 0;
            }
        }
    }

    hitBy(wdf: WDFire) {
        const damage = Math.ceil(
            wdf.state.damage * wdf.oOwner.store.state.power * this.store.state.defense
        );
        this.store.state.hitPoints = Math.max(0, this.store.state.hitPoints - damage);
        this.oObservatory.notify(this, 'damaged', {
            damage,
            damagedBy: wdf,
        });
    }

    /**
     * Draw the player sprite then, if a front shield is active (shield >= 1),
     * overlay the shield tile from the fire spritesheet.
     *
     * Shield tiles in wdspr_fire_z2.png (16 × 32, stride = 16 px):
     *   tile 22 (sx = 352): left-facing shield — shown when player faces x−
     *   tile 23 (sx = 368): right-facing shield — shown when player faces x+
     */
    override render(): void {
        super.render();
        if (this.store.state.shield < 1 || !this.oFireImage || !this.oContext) {
            return;
        }
        const SHIELD_W = 16;
        const SHIELD_H = 32;
        const TILE_STRIDE = 16;
        const facingRight = this.nFace === 1;
        const tileIndex = facingRight ? 23 : 22;
        const sx = tileIndex * TILE_STRIDE;
        const playerDestX = Math.floor(this.oFlight.vPosition.x - this.vReference.x);
        const playerDestY = Math.floor(this.oFlight.vPosition.y - this.vReference.y);
        const destX = facingRight ? playerDestX + this.nZWidth : playerDestX - SHIELD_W;
        this.oContext.drawImage(
            this.oFireImage,
            sx,
            0,
            SHIELD_W,
            SHIELD_H,
            destX,
            playerDestY,
            SHIELD_W,
            SHIELD_H
        );
    }
}
