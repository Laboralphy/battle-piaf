import { Observer } from '../core/Observer.js';
import { Vector2D } from '../core/Vector2D.js';
import { FairyEngine } from '../engine/FairyEngine.js';
import { FairyFlight } from '../engine/FairyFlight.js';
import { FairyKeys } from '../engine/FairyKeys.js';
import { FairyLevelBuilder } from '../engine/FairyLevelBuilder.js';
import { FairyMatrix } from '../engine/FairyMatrix.js';
import { Fairies } from '../engine/Fairies.js';
import { LoopType } from '../engine/FairyAnimation.js';
import { WDBullet } from './WDBullet.js';
import { WDPlayer } from './WDPlayer.js';
import { WDPlayerFlight } from './WDPlayerFlight.js';
import { ICollidable } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';
import { SoundManager } from './SoundManager.js';
import { LEVELS } from '../data/levels.js';
import { WDMissile } from './WDMissile.js';
import { WDFire } from './WDFire.js';
import { WDExhaust } from './WDExhaust.js';
import { WDExplosion } from './WDExplosion.js';

/**
 * Keyboard bindings for each player.
 * Player 0 uses SEDF keys; player 1 uses the numeric keypad.
 */
const PLAYER_KEYS = [
    {
        left: FairyKeys.ALPHANUM.S,
        right: FairyKeys.ALPHANUM.F,
        up: FairyKeys.ALPHANUM.E,
        fire: FairyKeys.ALPHANUM.D,
    },
    {
        left: FairyKeys.NUMPAD[4],
        right: FairyKeys.NUMPAD[6],
        up: FairyKeys.NUMPAD[8],
        fire: FairyKeys.NUMPAD[5],
    },
] as const;

/**
 * Main game class for Battle Piaf.
 * Extends `FairyEngine` and implements the four lifecycle hooks:
 * resource loading, game init, and the per-tick running loop.
 *
 * Two players fire homing missiles at each other in a tile-based arena.
 * Score is tracked per player and displayed in the HTML overlay.
 */
export class WDGame extends FairyEngine {
    /** The tile-map layer used for land collision queries. */
    private _land!: FairyMatrix;
    /** The sprite layer containing players, projectiles, and effects. */
    private _sprites!: Fairies;
    /** The two player sprites, indexed by player code (0 and 1). */
    private _players: WDPlayer[] = [];

    /** DOM elements for the per-player score display. */
    private _scoreEls: [HTMLElement | null, HTMLElement | null] = [null, null];
    /** Sound manager for jump, shoot, and hit effects. */
    private _sounds = new SoundManager();

    // ── Resource loading ─────────────────────────────────────────────────────

    /** Load all required sprite-sheet and background images. */
    protected override async stateResourceLoading(): Promise<void> {
        await Promise.all([
            this.loadImage('assets/images/wdbob_land0_z2.png', 'bob'),
            this.loadImage('assets/images/wdspr_fire_z2.png', 'spr_fire'),
            this.loadImage('assets/images/background.png', 'bg'),
            this.loadImage('assets/images/wdspr_pl_z2.png', 'spr_pl'),
        ]);
    }

    // ── Game initializing ────────────────────────────────────────────────────

    /**
     * Build all layers, load a random level, create both players, and
     * attach collision observers to each player.
     */
    protected override stateGameInitializing(): void {
        const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
        this.setCanvas(canvas);

        this.createBackgroundLayer('bg', 640, 480);
        this._land = this.createMatrixLayer('bob', 20, 15, 32, 32);
        this.createCollider(20, 15, 32, 32);
        this._sprites = this.createFairyLayer();

        const levelData = LEVELS[0];
        this._buildLevel(levelData);
        this._scoreEls = [document.getElementById('score_0'), document.getElementById('score_1')];

        for (let i = 0; i < 2; i++) {
            const p = this.createFairy(this._sprites, 'spr_pl', new WDPlayer(i)) as WDPlayer;
            p.setData('keys', PLAYER_KEYS[i]);
            p.oObservatory.attach(
                'move',
                new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                    this._playerLandCollision(sender as WDPlayer, flight as WDPlayerFlight)
                )
            );
            p.oObservatory.attach(
                'move',
                new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                    this._playerFairyCollision(sender as WDPlayer, flight as WDPlayerFlight)
                )
            );
            this._players[i] = p;
        }
    }

    // ── Game running ─────────────────────────────────────────────────────────

    /**
     * Per-tick game logic:
     * 1. Read input and update each player's state.
     * 2. Trigger jump sound when a player just jumped.
     * 3. Spawn a missile (with exhaust callback) when a player fires.
     * 4. Refresh the score display.
     */
    protected override stateGameRunning(): null {
        for (const player of this._players) {
            player.updateState(this._input);
            if (player.bJustJumped) {
                this._sounds.play('jump');
                player.bJustJumped = false;
            }
        }

        for (const player of this._players) {
            if (player.bWantFire) {
                const enemy = this._players[1 - player.nCode];
                this.createFairy(
                    this._sprites,
                    'spr_fire',
                    new WDMissile(player, enemy, (x, y) =>
                        this.createFairy(this._sprites, 'spr_fire', new WDExhaust(x, y))
                    )
                );
                this._sounds.play('shoot');
                player.bWantFire = false;
            }
        }

        this._updateScoreDisplay();
        return null;
    }

    // ── Level building ────────────────────────────────────────────────────────

    /**
     * Populate `_land` from a level data array using `FairyLevelBuilder`.
     * Registers animated tile codes K (lava), N (water), and Q (flicker).
     */
    private _buildLevel(data: string[]): void {
        const builder = new FairyLevelBuilder();
        builder.setMatrix(this._land);
        builder.nMetaMultiplier = 120;
        builder.addAnimation('K.', 20, 3, LoopType.Yoyo, 1, 20, 0);
        builder.addAnimation('N.', 23, 2, LoopType.Forward, 1, 64, 0);
        builder.addAnimation('Q.', 26, 3, LoopType.Yoyo, 1, 8, 0);
        builder.build(data);
    }

    // ── Collision handlers ────────────────────────────────────────────────────

    /**
     * 'move' observer for player-vs-land collision.
     * Enforces arena boundaries and responds to tile codes:
     * - Code ≥ 1 (semi-solid `*` and fully solid `#`): floor collision while falling.
     * - Code ≥ 2 (fully solid `#` only): ceiling collision while rising, wall collision.
     *
     * Modifies `flight.vNewPosition` and `flight.vNewSpeed` in-place to push the
     * player out of colliding geometry before `postProceed` commits the values.
     */
    private _playerLandCollision(player: WDPlayer, flight: WDPlayerFlight): void {
        // Arena boundary enforcement
        if (flight.vNewPosition.y < 64) {
            flight.vNewPosition.y = 64;
            flight.vNewSpeed.y = 0;
        }
        if (flight.vNewPosition.x < 48) {
            flight.vNewPosition.x = 48;
            flight.vNewSpeed.x = 0;
        }
        if (flight.vNewPosition.x > 592) {
            flight.vNewPosition.x = 592;
            flight.vNewSpeed.x = -flight.vNewSpeed.x; // bounce off right wall
        }
        if (flight.vNewSpeed.y > 14) {
            flight.vNewSpeed.y = 14;
        }

        // Tile floor collision (semi-solid * and fully solid #, only while falling)
        player.bOnFloor = false;
        if (flight.vNewSpeed.y > 0) {
            const tileX1 = Math.floor(flight.vNewPosition.x - 8) >> 5;
            const tileX2 = Math.floor(flight.vNewPosition.x + 8) >> 5;
            const tileY = Math.floor(flight.vNewPosition.y + 1) >> 5;
            const subY = Math.floor(flight.vNewPosition.y + 1) % 32;

            if (
                subY < 16 &&
                (this._land.getTileCode(tileX1, tileY) > 0 ||
                    this._land.getTileCode(tileX2, tileY) > 0)
            ) {
                flight.vNewPosition.y = (tileY << 5) - 1;
                flight.vNewSpeed.y = 0;
                player.bOnFloor = true;
            }
        }

        // Tile ceiling collision (fully solid # only, while rising)
        if (flight.vNewSpeed.y < 0) {
            const tileX1 = Math.floor(flight.vNewPosition.x - 8) >> 5;
            const tileX2 = Math.floor(flight.vNewPosition.x + 8) >> 5;
            const tileY = Math.floor(flight.vNewPosition.y - 16) >> 5;

            if (
                this._land.getTileCode(tileX1, tileY) >= 2 ||
                this._land.getTileCode(tileX2, tileY) >= 2
            ) {
                flight.vNewPosition.y = ((tileY + 1) << 5) + 15; // push head just below tile bottom
                flight.vNewSpeed.y = 0;
            }
        }

        // Tile wall collision (fully solid # only, horizontal movement)
        // Two vertical probes span the player body (feet−2 and head+2)
        const wallTileY1 = Math.floor(flight.vNewPosition.y - 2) >> 5;
        const wallTileY2 = Math.floor(flight.vNewPosition.y - 14) >> 5;

        if (flight.vNewSpeed.x > 0) {
            const tileX = Math.floor(flight.vNewPosition.x + 9) >> 5;
            if (
                this._land.getTileCode(tileX, wallTileY1) >= 2 ||
                this._land.getTileCode(tileX, wallTileY2) >= 2
            ) {
                flight.vNewPosition.x = (tileX << 5) - 9; // push right edge to left face of tile
                flight.vNewSpeed.x = 0;
            }
        } else if (flight.vNewSpeed.x < 0) {
            const tileX = Math.floor(flight.vNewPosition.x - 9) >> 5;
            if (
                this._land.getTileCode(tileX, wallTileY1) >= 2 ||
                this._land.getTileCode(tileX, wallTileY2) >= 2
            ) {
                flight.vNewPosition.x = ((tileX + 1) << 5) + 8; // push left edge to right face of tile
                flight.vNewSpeed.x = 0;
            }
        }
    }

    /**
     * 'move' observer for player-vs-sprite collision.
     * Handles two cases:
     * - **Player-player**: deflect the moving player based on relative position.
     * - **Player-projectile** (`WDFire`): award a point to the shooter, apply a
     *   knock-back shock to the hit player, spawn an explosion, and destroy the missile.
     */
    private _playerFairyCollision(player: WDPlayer, flight: WDPlayerFlight): void {
        if (!player.oCollider) {return;}
        const collisions = player.oCollider.getCollisioningObjects(player) as ICollidable[];

        for (const other of collisions) {
            if (other instanceof WDPlayer) {
                // Player-player collision: deflect based on relative position
                const diff = new Vector2D(
                    flight.vNewPosition.x - other.oFlight.vPosition.x,
                    flight.vNewPosition.y - other.oFlight.vPosition.y
                );
                diff.normalize().mul(flight.vNewSpeed.distance() / 1.3);
                flight.vNewSpeed.set(diff);
            } else if (other instanceof WDFire) {
                // Missile hit: award score, apply shock, spawn explosion, destroy missile
                other.oOwner.nScore++;
                flight.vShock.set(other.oFlight.vSpeed);
                flight.vShock.y -= 2;
                this.createFairy(this._sprites, 'spr_fire',
                    new WDExplosion(other.oFlight.vPosition.x, other.oFlight.vPosition.y)
                );
                (other as Fairy).bDead = true;
                this._sounds.play('hit');
            }
        }
    }

    // ── Score display ─────────────────────────────────────────────────────────

    /**
     * Write both player scores to the view state and, when a value has changed,
     * update the corresponding DOM elements.
     */
    private _updateScoreDisplay(): void {
        for (let i = 0; i < 2; i++) {
            this.setViewVariable(`score${i}`, this._players[i].nScore);
        }
        const view = this.updateView();
        if (!view.invalid) {
            for (let i = 0; i < 2; i++) {
                if (this._scoreEls[i]) {
                    this._scoreEls[i]!.textContent = String(view[`score${i}`]);
                }
            }
        }
    }
}
