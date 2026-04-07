import { Vector2D } from '../core/Vector2D.js';
import { FairyAnimation } from '../engine/FairyAnimation.js';
import { FairyCollisionRect } from '../engine/FairyCollision.js';
import { FairyInputState } from '../engine/FairyInputState.js';
import { Fairy } from '../engine/Fairy.js';
import { WDPlayerFlight } from './WDPlayerFlight.js';

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
export class WDPlayer extends Fairy {
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
    /** Accumulated score: incremented each time an enemy projectile hits this player. */
    nScore = 0;
    /** Weapon selected for the next shot; set by WDGame before spawning a projectile. */
    selectedWeapon: Weapon = Weapon.WEAPON_MISSILE;


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

        if (input.getKeyState(keys.right)) {this.nDir++;}
        if (input.getKeyState(keys.left))  {this.nDir--;}

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
}
