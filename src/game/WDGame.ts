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
import { WDCrate } from './WDCrate.js';

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

/** Assumed tick rate (RAF at ~60 Hz, proceed runs every tick). */
const TICKS_PER_SECOND = 60;
/** Base delay between two crate spawns, in ticks. */
const CRATE_TIME_TO_SPAWN = 10 * TICKS_PER_SECOND;
/** Random variance added to the spawn delay (±), in ticks. */
const CRATE_SPAWN_VARIANCE = 5 * TICKS_PER_SECOND;
/** How long a crate stays on screen before disappearing on its own, in ticks. */
const CRATE_TIME_TO_LIVE = 15 * TICKS_PER_SECOND;
/** Vertical pixel difference above which the higher player throws a grenade instead of a bullet. */
const GRENADE_HEIGHT_THRESHOLD = 96;
/** Duration of the death sequence in ticks (1 s at 60 Hz). */
const DEATH_SEQUENCE_TICKS = 60;
/** Ticks between each explosion during the death sequence (~160 ms). */
const DEATH_EXPLOSION_INTERVAL = 10;
/** Number of explosions spawned during the death sequence. */
const DEATH_EXPLOSION_COUNT = 6;

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


    /** Death sequence countdown per player (-1 = alive, ≥0 = dying). */
    private _deathTimers: [number, number] = [-1, -1];

    /** Valid tile positions (col, row) where a crate can be spawned. Built once at init. */
    private _crateSpawnPositions: Array<{ col: number; row: number }> = [];
    /** Currently live crate, or null if none is on screen. */
    private _activeCrate: WDCrate | null = null;
    /** Countdown to the next crate spawn (ticks). */
    private _crateTimer = 0;
    /** Countdown until the active crate expires (ticks). */
    private _crateTTLTimer = 0;

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
            p.oFireImage = this._images.get('spr_fire')!;
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
                    const shooter = damagedBy.oOwner;
                    const victim  = sender as WDPlayer;
                    shooter.store.state.score += damage;

                    if (victim.store.state.hitPoints <= 0 && this._deathTimers[victim.nCode] < 0) {
                        this._startDeathSequence(victim);
                    } else if (damagedBy instanceof WDBullet) {
                        if (++shooter.store.state.bulletHitStreak >= 2) {
                            shooter.store.state.bulletHitStreak = 0;
                            this._autoFireMissile(shooter, victim);
                        }
                    } else {
                        shooter.store.state.bulletHitStreak = 0;
                    }
                })
            );
            this._players[i] = p;
        }

        this._crateSpawnPositions = this._buildCrateSpawnList();
        this._crateTimer = CRATE_TIME_TO_SPAWN;
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
            if (this._deathTimers[player.nCode] >= 0) {
                this._updateDeathSequence(player);
            } else {
                player.updateState(this._input);
                if (player.bJustJumped) {
                    this._sounds.play('jump');
                    player.bJustJumped = false;
                }
            }
        }

        for (const player of this._players) {
            if (player.bWantFire && this._deathTimers[player.nCode] < 0) {
                player.bWantFire = false;
                const enemy = this._players[1 - player.nCode];
                const heightDiff = enemy.oFlight.vPosition.y - player.oFlight.vPosition.y;
                const projectile = heightDiff > GRENADE_HEIGHT_THRESHOLD
                    ? new WDGrenade(player)
                    : new WDBullet(player);
                this._fireProjectile(player, projectile);
            }
        }

        this._updateCrate();
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

    // ── Death sequence ────────────────────────────────────────────────────────

    /**
     * Begin the death sequence for `player`.
     * Freezes their physics, resets their streak, and starts the countdown.
     */
    private _startDeathSequence(player: WDPlayer): void {
        this._deathTimers[player.nCode] = DEATH_SEQUENCE_TICKS;
        player.oFlight.vSpeed.set(0, 0);
        player.oFlight.vAccel.set(0, 0);
        player.store.state.bulletHitStreak = 0;
        player.oBoundingShape.setTangibilityMask(0);
    }

    /**
     * Called every tick while a player is in their death sequence.
     * Blinks the player, spawns explosions at regular intervals,
     * and hides the player permanently when the sequence ends.
     */
    private _updateDeathSequence(player: WDPlayer): void {
        const timer = --this._deathTimers[player.nCode];

        // Blink: alternate visibility every 4 ticks.
        player.bVisible = (timer % 4) >= 2;

        // Spawn one explosion every DEATH_EXPLOSION_INTERVAL ticks.
        const elapsed = DEATH_SEQUENCE_TICKS - timer;
        if (elapsed % DEATH_EXPLOSION_INTERVAL === 0 &&
            elapsed / DEATH_EXPLOSION_INTERVAL < DEATH_EXPLOSION_COUNT) {
            const ox = (Math.random() - 0.5) * 32;
            const oy = (Math.random() - 0.5) * 32;
            const ex = this.createFairy(
                this._sprites,
                'spr_fire',
                new WDExplosion(
                    player.oFlight.vPosition.x + ox,
                    player.oFlight.vPosition.y + oy - 16
                )
            );
            ex.setScale(1 + Math.random() * 0.25);
        }

        // Sequence over: hide the player permanently.
        if (timer <= 0) {
            player.bVisible = false;
            this._deathTimers[player.nCode] = -1;
        }
    }

    // ── Projectile firing ─────────────────────────────────────────────────────

    /**
     * Attempt to fire a pre-constructed projectile for `shooter`.
     * Cancels silently if the shooter cannot afford the weapon's energy cost.
     * Attaches sound and land-collision observers on success.
     */
    private _fireProjectile(shooter: WDPlayer, projectile: WDFire): void {
        if (shooter.store.state.energy < projectile.state.cost) {
            projectile.bDead = true;
            return;
        }
        shooter.store.state.energy -= projectile.state.cost;
        this.createFairy(this._sprites, 'spr_fire', projectile);
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
    }

    /**
     * Automatically fire a homing missile from `shooter` toward `target`.
     * Triggered after two consecutive WDBullet hits on the same target.
     * Silently cancelled if the shooter lacks the energy.
     */
    private _autoFireMissile(shooter: WDPlayer, target: WDPlayer): void {
        const missile = new WDMissile(shooter, target, (x, y) =>
            this.createFairy(this._sprites, 'spr_fire', new WDExhaust(x, y))
        );
        this._fireProjectile(shooter, missile);
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
            } else if (other instanceof WDCrate && !other.bDead) {
                // Crate pickup: notify the crate (emits 'picked'), crate marks itself dead.
                other.pickup(player);
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

    // ── Crate spawning ────────────────────────────────────────────────────────

    /**
     * Scan the tile map and return every position where a crate can legally appear:
     * - The tile itself is solid or semi-solid (code ≥ 1).
     * - The tile directly above it is empty (code 0), so the crate is visible.
     */
    private _buildCrateSpawnList(): Array<{ col: number; row: number }> {
        const positions: Array<{ col: number; row: number }> = [];
        for (let row = 1; row < 15; row++) {
            for (let col = 0; col < 20; col++) {
                if (
                    this._land.getTileCode(col, row) >= 1 &&
                    this._land.getTileCode(col, row - 1) === 0
                ) {
                    positions.push({ col, row });
                }
            }
        }
        return positions;
    }

    /**
     * Pick a random valid tile from `_crateSpawnPositions`, instantiate a `WDCrate`,
     * attach the `'picked'` observer, and start its TTL countdown.
     * Does nothing if there are no valid spawn positions.
     */
    private _spawnCrate(): void {
        if (this._crateSpawnPositions.length === 0) {
            return;
        }
        const { col, row } = this._crateSpawnPositions[
            Math.floor(Math.random() * this._crateSpawnPositions.length)
        ];
        const crate = this.createFairy(this._sprites, 'spr_fire', new WDCrate());
        crate.placeOnTile(col, row);
        crate.oFlight.vSpeed.set(0, -4);
        crate.oObservatory.attach(
            'move',
            new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                this._crateLandCollision(sender as WDCrate, flight)
            )
        );
        crate.oObservatory.attach(
            'picked',
            new Observer(this, (_sender, { player }) => {
                // WDGame receives the pickup here — apply power-up effects in future.
                console.log(`Player ${player.nCode} picked up a crate`);
            })
        );
        this._activeCrate = crate;
        this._crateTTLTimer = CRATE_TIME_TO_LIVE;
    }

    /**
     * 'move' observer for crate-vs-land collision.
     * Applies a downward speed cap and floor detection (semi-solid and fully solid tiles).
     */
    private _crateLandCollision(crate: WDCrate, flight: FairyFlight): void {
        if (flight.vNewSpeed.y > 5) {
            flight.vNewSpeed.y = 5;
        }

        if (flight.vNewPosition.y > flight.vPosition.y) {
            const bottomY = flight.vNewPosition.y + 8;
            const tileX1  = Math.floor(flight.vNewPosition.x - 8) >> 5;
            const tileX2  = Math.floor(flight.vNewPosition.x + 7) >> 5;
            const tileY   = Math.floor(bottomY) >> 5;
            const subY    = Math.floor(bottomY) % 32;

            if (subY < 16) {
                const code = Math.max(
                    this._land.getTileCode(tileX1, tileY),
                    this._land.getTileCode(tileX2, tileY)
                );
                if (code >= 1) {
                    flight.vNewPosition.y = (tileY << 5) - 9;
                    flight.vNewSpeed.y = 0;
                }
            }
        }
    }

    /**
     * Called every tick.
     * - When no crate is active: count down the spawn timer and spawn when it expires.
     * - When a crate is active: count down its TTL and expire it if time is up.
     * - When the active crate has been collected (bDead): clear the reference and
     *   reset the spawn timer for the next cycle.
     */
    private _updateCrate(): void {
        if (this._activeCrate !== null) {
            if (this._activeCrate.bDead) {
                // Crate was collected or expired — schedule next spawn.
                this._activeCrate = null;
                this._crateTimer =
                    CRATE_TIME_TO_SPAWN +
                    Math.floor((Math.random() * 2 - 1) * CRATE_SPAWN_VARIANCE);
            } else if (--this._crateTTLTimer <= 0) {
                // TTL expired — remove crate without triggering a pickup event.
                this._activeCrate.bDead = true;
            }
        } else {
            if (--this._crateTimer <= 0) {
                this._spawnCrate();
            }
        }
    }

    // ── Score display ─────────────────────────────────────────────────────────

    /**
     * For each player whose store has been invalidated, flush the changed state
     * to the corresponding DOM elements and mark the store as up-to-date.
     */
    private _updateScoreDisplay(): void {
        for (let i = 0; i < 2; i++) {
            const player = this._players[i];
            if (player.store.dirty.has('score') && this._scoreEls[i]) {
                this._scoreEls[i]!.textContent = String(player.store.state.score);
            }
            if (player.store.dirty.has('hitPoints') && this._hpBarEls[i]) {
                this._hpBarEls[i]!.style.width = player.store.state.hitPoints + '%';
            }
            player.store.validate();
        }
    }
}
