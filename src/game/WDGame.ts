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
import { WDPlayer, Weapon } from './WDPlayer.js';
import { WDPlayerFlight } from './WDPlayerFlight.js';
import { ICollidable, FairyCollisionRect } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';
import { SoundManager } from './SoundManager.js';
import { LEVELS } from '../data/levels.js';
import { WDMissile } from './WDMissile.js';
import { WDGrenade } from './WDGrenade.js';
import { WDFire } from './WDFire.js';
import { WDExhaust } from './WDExhaust.js';
import { WDExplosion } from './WDExplosion.js';
import { WDBulletExplosion } from './WDBulletExplosion.js';

/**
 * Keyboard bindings for each player.
 * Player 0 uses SEDF keys; player 1 uses the numeric keypad.
 */
const PLAYER_KEYS = [
    {
        left: FairyKeys.ALPHANUM.Q,
        right: FairyKeys.ALPHANUM.D,
        up: FairyKeys.ALPHANUM.Z,
        fire: FairyKeys.SPACE,
        down: FairyKeys.ALPHANUM.S,
    },
    {
        left: FairyKeys.NUMPAD[4],
        right: FairyKeys.NUMPAD[6],
        up: FairyKeys.NUMPAD[8],
        fire: FairyKeys.NUMPAD.ENTER,
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
    private _hpBarEls: [HTMLElement | null, HTMLElement | null] = [null, null];

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
        this._sprites.setYMax(480);

        const levelData = LEVELS[0];
        this._buildLevel(levelData);
        this._scoreEls = [document.getElementById('score_0'), document.getElementById('score_1')];
        this._hpBarEls = [document.getElementById('hp-bar-0'), document.getElementById('hp-bar-1')];

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
            p.oObservatory.attach(
                'damaged',
                new Observer(this, (sender: Fairy, { damage, damagedBy }) => {
                    this._sounds.play('hurt');
                    const oDamager = damagedBy.oOwner;
                    oDamager.nScore += damage;
                    const oVictim = sender as WDPlayer;
                    const hp = oVictim.state.hitpoints;
                    this.setViewVariable('hp' + oVictim.nCode, hp);
                })
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
                const roll = Math.random();
                player.selectedWeapon =
                    roll < 0.33
                        ? Weapon.WEAPON_BULLET
                        : roll < 0.66
                          ? Weapon.WEAPON_MISSILE
                          : Weapon.WEAPON_GRENADE;
                const enemy = this._players[1 - player.nCode];
                let projectile: WDFire;
                if (player.selectedWeapon === Weapon.WEAPON_BULLET) {
                    projectile = this.createFairy(this._sprites, 'spr_fire', new WDBullet(player));
                } else if (player.selectedWeapon === Weapon.WEAPON_MISSILE) {
                    projectile = this.createFairy(
                        this._sprites,
                        'spr_fire',
                        new WDMissile(player, enemy, (x, y) =>
                            this.createFairy(this._sprites, 'spr_fire', new WDExhaust(x, y))
                        )
                    );
                } else {
                    projectile = this.createFairy(this._sprites, 'spr_fire', new WDGrenade(player));
                }
                projectile.oObservatory.attach(
                    'fire',
                    new Observer(this, (sender: Fairy) =>
                        this._sounds.play((sender as WDFire).soundOnFire)
                    )
                );
                projectile.oObservatory.attach(
                    'move',
                    new Observer(this, (sender: Fairy) =>
                        this._checkProjectileLandCollision(sender as WDFire)
                    )
                );
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

        const rect = player.oBoundingShape as FairyCollisionRect;

        // Tile wall collision (fully solid # only) — resolved first so that
        // floor/ceiling probes are never inside a wall column.
        // Two vertical probes: near feet (p2.y-1) and near head (p1.y+1)
        {
            const [p1, p2] = rect.getPoints();
            // Probe rows anchored to vPosition (last committed tick), not vNewPosition.
            // This prevents the bottom probe from landing inside the floor tile while
            // falling, which would cause a false horizontal push on every landing.
            const bottomOffset = p2.y - flight.vNewPosition.y; // v2.y offset (= 0)
            const topOffset = p1.y - flight.vNewPosition.y; // v1.y offset (= -31)
            const wallTileY1 = Math.floor(flight.vPosition.y + bottomOffset - 1) >> 5;
            const wallTileY2 = Math.floor(flight.vPosition.y + topOffset + 1) >> 5;
            const rightOffset = p2.x - flight.vNewPosition.x; // v2.x offset of right edge
            const leftOffset = p1.x - flight.vNewPosition.x; // v1.x offset of left edge

            if (flight.vNewPosition.x > flight.vPosition.x) {
                const tileX = Math.floor(p2.x + 1) >> 5;
                if (
                    this._land.getTileCode(tileX, wallTileY1) >= 2 ||
                    this._land.getTileCode(tileX, wallTileY2) >= 2
                ) {
                    // snap right edge 1px left of tile face
                    flight.vNewPosition.x = (tileX << 5) - 1 - rightOffset;
                    flight.vNewSpeed.x = 0;
                }
            } else if (flight.vNewPosition.x < flight.vPosition.x) {
                const tileX = Math.floor(p1.x - 1) >> 5;
                if (
                    this._land.getTileCode(tileX, wallTileY1) >= 2 ||
                    this._land.getTileCode(tileX, wallTileY2) >= 2
                ) {
                    // snap left edge to tile right face
                    flight.vNewPosition.x = ((tileX + 1) << 5) - leftOffset;
                    flight.vNewSpeed.x = 0;
                }
            }
        }

        // Tile floor collision (semi-solid * and fully solid #, only while falling)
        player.bOnFloor = false;
        if (flight.vNewPosition.y > flight.vPosition.y) {
            const [p1, p2] = rect.getPoints();
            const tileX1 = Math.floor(p1.x) >> 5;
            const tileX2 = Math.floor(p2.x) >> 5;
            const tileY = Math.floor(p2.y + 1) >> 5;
            const subY = Math.floor(p2.y + 1) % 32;
            // Row just above the floor tile — probes whose column contains a solid tile
            // here are inside a wall and must not trigger floor detection.
            const bodyRow = tileY - 1;

            if (subY < 16) {
                const code1 =
                    this._land.getTileCode(tileX1, bodyRow) < 2
                        ? this._land.getTileCode(tileX1, tileY)
                        : 0;
                const code2 =
                    this._land.getTileCode(tileX2, bodyRow) < 2
                        ? this._land.getTileCode(tileX2, tileY)
                        : 0;
                const maxCode = Math.max(code1, code2);
                if (maxCode > 0) {
                    const bMustStabilize =
                        maxCode === 2 || (maxCode === 1 && player.nWantDown === 0);
                    if (bMustStabilize) {
                        // p2.y (bottom edge, v2.y=0) snapped 1px above tile top
                        flight.vNewPosition.y = (tileY << 5) - 1;
                        flight.vNewSpeed.y = 0;
                        player.bOnFloor = true;
                    }
                }
            }
        }
        if (player.nWantDown > 0) {
            --player.nWantDown;
        }

        // Tile ceiling collision (fully solid # only, while rising)
        if (flight.vNewPosition.y < flight.vPosition.y) {
            const [p1, p2] = rect.getPoints();
            const tileX1 = Math.floor(p1.x) >> 5;
            const tileX2 = Math.floor(p2.x) >> 5;
            const tileY = Math.floor(p1.y) >> 5; // top edge (head)

            if (
                this._land.getTileCode(tileX1, tileY) >= 2 ||
                this._land.getTileCode(tileX2, tileY) >= 2
            ) {
                // p1.y (top edge, v1.y=-31) snapped to tile bottom: pos.y = (tileY+1)*32 + 31
                flight.vNewPosition.y = ((tileY + 1) << 5) + 31;
                flight.vNewSpeed.y = 0;
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
        if (!player.oCollider) {
            return;
        }
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
                flight.vShock.set(other.oFlight.vSpeed);
                flight.vShock.y -= 2;
                player.hitBy(other);
                this._explodeProjectile(
                    other,
                    other.oFlight.vPosition.x,
                    other.oFlight.vPosition.y
                );
            }
        }
    }

    // ── Projectile helpers ────────────────────────────────────────────────────

    /** Spawn the appropriate explosion, play its sound, and mark the projectile dead. */
    private _explodeProjectile(fire: WDFire, x: number, y: number): void {
        const ex = fire instanceof WDBullet ? new WDBulletExplosion(x, y) : new WDExplosion(x, y);
        this.createFairy(this._sprites, 'spr_fire', ex);
        fire.bDead = true;
        this._sounds.play(fire.soundOnExplosion);
    }

    /**
     * 'move' observer for projectile-vs-land collision.
     * Checks the centre of the bounding box against the tile map;
     * explodes the projectile if it enters a fully solid tile (#, code ≥ 2).
     */
    private _checkProjectileLandCollision(fire: WDFire): void {
        if (fire.bDead) {
            return;
        }
        const rect = fire.oBoundingShape as FairyCollisionRect;
        const [p1, p2] = rect.getPoints();
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        if (this._land.getTileCode(Math.floor(cx) >> 5, Math.floor(cy) >> 5) >= 2) {
            this._explodeProjectile(fire, cx, cy);
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
                if (this._hpBarEls[i]) {
                    this._hpBarEls[i]!.style.width = String(view[`hp${i}`]) + '%';
                }
            }
        }
    }
}
