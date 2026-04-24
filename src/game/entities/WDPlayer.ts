import { Vector2D } from '../../core/Vector2D.js';
import { FairyAnimation } from '../../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../../engine/FairyCollision.js';
import { FairyInputState } from '../../engine/FairyInputState.js';
import { Fairy, FairyBaseEvents } from '../../engine/Fairy.js';
import { WDPlayerFlight } from '../WDPlayerFlight.js';
import { WDFire } from './WDFire';
import { PlayerState } from '../state/PlayerState.js';
import { Store } from '../../store';
import { TILE_SIZE } from '../consts';

/** Weapons a player can fire. */
export const enum Weapon {
    WEAPON_BULLET,
    WEAPON_MISSILE,
    WEAPON_GRENADE,
}

const SHIELD_DEFENSE_VALUE = 0.1;

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
    /** Emitted by `die()` after physics and combat state are reset. */
    death: Record<string, never>;
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
    /** Set to true by WDGame when the player first touches a floor tile; consumed by WDGame for sound. */
    bJustLanded: boolean = false;
    /** Set to true if this entity is controllable by player. */
    bControllable: boolean = true;
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
        score: 0,
        bulletHitStreak: 0,
        bulletHitStreakMax: 0,
        bulletHitStreakTime: 0,
        bulletHitLastTick: -1,
        displayed: false,
        energy: 100,
        maxEnergy: 100,
        shield: false,
        shieldTime: 0,
        powerBoostTime: 0,
        fireCount: 0,
        enemyHit: 0,
        specialWeapon: 0,
        specialWeaponAmmo: 0,
        defaultWeapon: 0,
    });

    /**
     * Freeze physics, reset all combat state, disable collision, and fire a
     * `'death'` event so observers (e.g. WDGame) can react (play sound, start timer…).
     */
    die(): void {
        this.bControllable = false;
        this.oFlight.vSpeed.set(0, 0);
        this.oFlight.vAccel.set(0, 0);
        const ss = this.store.state;
        ss.shield = false;
        ss.shieldTime = 0;
        ss.powerBoostTime = 0;
        ss.specialWeapon = 0;
        ss.specialWeaponAmmo = 0;
        ss.defaultWeapon = 2;
        ss.bulletHitStreak = 0;
        ss.bulletHitLastTick = -1;
        this.oBoundingShape.setTangibilityMask(0);
        this.oObservatory.notify(this, 'death', {});
    }

    constructor(nCode: number) {
        super();
        this.nCode = nCode;
        this.setSize(TILE_SIZE, TILE_SIZE);
        this.setScale(1);
        // vReference at (16, 31): bottom-centre of the sprite is the physics anchor.
        this.vReference.set(16, 31);

        const flight = new WDPlayerFlight();
        this.setFlight(flight);
        flight.vPosition.set(
            Math.floor(Math.random() * 18 * 32),
            10 * 32 - Math.floor(Math.random() * 8 * 32)
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

        /**
         * Keys
         */
        if (this.bControllable) {
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
        if (ss.shield) {
            if (ss.shieldTime > 0) {
                ss.shieldTime--;
            } else {
                ss.shield = false;
            }
        }
    }

    hitBy(wdf: WDFire) {
        const damage = Math.ceil(
            wdf.state.damage *
                wdf.oOwner.store.state.power *
                (this.store.state.shield ? SHIELD_DEFENSE_VALUE : 1)
        );
        this.store.state.hitPoints = Math.max(0, this.store.state.hitPoints - damage);
        this.oObservatory.notify(this, 'damaged', {
            damage,
            damagedBy: wdf,
        });
    }

    /**
     * Draw the player sprite then, if a shield is active (shield >= 1),
     * overlay both shield tiles from the fire spritesheet.
     *
     * Shield tiles in wdspr_fire_z2.png (16 × 32, stride = 16 px):
     *   tile 22 (sx = 352): always drawn on the left side
     *   tile 23 (sx = 368): always drawn on the right side
     */
    override render(): void {
        super.render();
        if (!this.store.state.shield || !this.oFireImage || !this.oContext) {
            return;
        }
        const SHIELD_W = TILE_SIZE / 2;
        const SHIELD_H = TILE_SIZE;
        const TILE_STRIDE = TILE_SIZE / 2;
        const s = this.renderScale;
        const playerDestX = Math.floor((this.oFlight.vPosition.x - this.vReference.x) * s);
        const playerDestY = Math.floor((this.oFlight.vPosition.y - this.vReference.y) * s);
        // Left shield (tile 22)
        this.oContext.drawImage(
            this.oFireImage,
            22 * TILE_STRIDE,
            0,
            SHIELD_W,
            SHIELD_H,
            playerDestX - SHIELD_W,
            playerDestY,
            SHIELD_W,
            SHIELD_H
        );
        // Right shield (tile 23)
        this.oContext.drawImage(
            this.oFireImage,
            23 * TILE_STRIDE,
            0,
            SHIELD_W,
            SHIELD_H,
            playerDestX + this.nZWidth,
            playerDestY,
            SHIELD_W,
            SHIELD_H
        );
    }
}
