import { Observer } from '../core/Observer.js';
import { AIController } from './ai/AIController.js';
import { PROFILE_HUNTER } from './ai/AIProfile.js';
import { Vector2D } from '../core/Vector2D.js';
import { FairyEngine } from '../engine/FairyEngine.js';
import { FairyFlight } from '../engine/FairyFlight.js';
import { FairyKeys } from '../engine/FairyKeys.js';
import { FairyLevelBuilder } from '../engine/FairyLevelBuilder.js';
import { FairyMatrix } from '../engine/FairyMatrix.js';
import { Fairies } from '../engine/Fairies.js';
import { WDBullet } from './WDBullet.js';
import { WDPlayer } from './WDPlayer.js';
import { WDPlayerFlight } from './WDPlayerFlight.js';
import { FairyCollisionRect, ICollidable } from '../engine/FairyCollision.js';
import { Fairy } from '../engine/Fairy.js';
import { SoundManager } from './SoundManager.js';
import { LevelData, LEVELS } from './levels';
import { WDMissile } from './WDMissile.js';
import { WDGrenade } from './WDGrenade.js';
import { WDFire } from './WDFire.js';
import { WDExhaust } from './WDExhaust.js';
import { WDExplosion } from './WDExplosion.js';
import { WDBulletExplosion } from './WDBulletExplosion.js';
import { WDPlasmaBall } from './WDPlasmaBall.js';
import { WDPlasmaImpact } from './WDPlasmaImpact.js';
import { CrateBonus, WDCrate } from './WDCrate.js';
import { WDBonusIndicator } from './WDBonusIndicator.js';
import { WDSkull } from './WDSkull.js';
import { WDSkullGrenade } from './WDSkullGrenade.js';
import { WDFlame } from './WDFlame.js';
import { TILE_DATA } from './tile-animations';
import LOOT_DATA from '../data/loot.json';
import { FairyLayer } from '../engine/FairyLayer';

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
        down: FairyKeys.NUMPAD[2],
        fire: FairyKeys.NUMPAD.ENTER,
    },
] as const;

export type WDGameOptions = {
    aiControlled: boolean;
};

/** Assumed tick rate (RAF at ~60 Hz, proceed runs every tick). */
const TICKS_PER_SECOND = 60;
/** Base delay between two crate spawns, in ticks. */
const CRATE_TIME_TO_SPAWN = 10 * TICKS_PER_SECOND;
/** Random variance added to the spawn delay (±), in ticks. */
const CRATE_SPAWN_VARIANCE = 5 * TICKS_PER_SECOND;
/** How long a crate stays on screen before disappearing on its own, in ticks. */
const CRATE_TIME_TO_LIVE = 15 * TICKS_PER_SECOND;
/** Minimum delay before the skull appears (inactive → active), in ticks. */
const SKULL_DEACTIVATION_MIN_DURATION = 20 * TICKS_PER_SECOND;
/** Maximum delay before the skull appears (inactive → active), in ticks. */
const SKULL_DEACTIVATION_MAX_DURATION = 60 * TICKS_PER_SECOND;
/** How long the skull stays on screen (active → inactive), in ticks. */
const SKULL_ACTIVATION_DURATION = 30 * TICKS_PER_SECOND;

/** Probability (0–1) that a missile/grenade explosion spawns a WDFlame. */
const FLAME_CHANCE = 0.33;
/** How long a grounded flame stays alive, in ticks (~4 s at 60 Hz). */
const FLAME_DURATION = 8 * TICKS_PER_SECOND;

/** Vertical pixel difference above which the higher player throws a grenade instead of a bullet. */
const GRENADE_HEIGHT_THRESHOLD = 96;
/** Duration of the death sequence in ticks (1 s at 60 Hz). */
const DEATH_SEQUENCE_TICKS = 60;
/** Ticks between each explosion during the death sequence (~160 ms). */
const DEATH_EXPLOSION_INTERVAL = 10;
/** Number of explosions spawned during the death sequence. */
const DEATH_EXPLOSION_COUNT = 6;
/** Bonus score awarded to the player who lands the killing blow. */
const SCORE_DESTROYING_FOE = 1000;
/** Delay before a dead player respawns, in ticks (~4 s at 60 Hz). */
const RESPAWN_DELAY_TICKS = Math.trunc(2 * TICKS_PER_SECOND);
/** Max ticks between two bullet/plasma hits for the auto-missile to trigger. */
const TWO_HIT_MISSILE_DELAY = Math.trunc(3 * TICKS_PER_SECOND);
/** Vertical speed (px/tick) of the angled bullets in triple-bullet mode. */
const TRIPLE_BULLET_VSPEED = 2;
/** Duration of a round, in ticks (~3 min at 60 Hz). */
const ROUND_DURATION_TICKS = 3 * 60 * TICKS_PER_SECOND;
/** How long the winner screen stays up before the next round starts, in ticks. */
const ROUND_OVER_DISPLAY_TICKS = 5 * TICKS_PER_SECOND;

const LEVEL_COLS = 20;
const LEVEL_ROWS = 15;

const SEMI_SOLID_TILE_SUB_Y = 16;

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
    /** The text layer is used to draw anything that is neither background, level nor sprite */
    private _text!: FairyLayer;

    /** The two player sprites, indexed by player code (0 and 1). */
    private _players: WDPlayer[] = [];

    /** DOM elements for the per-player score display. */
    private _scoreEls: [HTMLElement | null, HTMLElement | null] = [null, null];
    private _hpBarEls: [HTMLElement | null, HTMLElement | null] = [null, null];
    private _precisionEls: [HTMLElement | null, HTMLElement | null] = [null, null];

    /** Sound manager for jump, shoot, and hit effects. */
    private _sounds = new SoundManager();

    /** Death sequence countdown per player (-1 = alive, ≥0 = dying). */
    private _deathTimers: [number, number] = [-1, -1];
    /** Respawn countdown per player (-1 = not waiting, ≥0 = waiting to respawn). */
    private _respawnTimers: [number, number] = [-1, -1];
    /** Monotonically increasing tick counter; used to time the bullet-hit streak window. */
    private _gameTick = 0;

    /** Valid tile positions (col, row) where a crate can be spawned. Built once at init. */
    private _crateSpawnPositions: Array<{ col: number; row: number }> = [];
    /** All crates currently live on screen. */
    private _activeCrates: WDCrate[] = [];
    /** Countdown to the next crate spawn (ticks). */
    private _crateTimer = 0;

    /**
     * AI controller for player 1.
     * Set to `null` to run in two-player mode (both players use keyboard input).
     */
    private _aiController: AIController | null = null;

    /** Currently active skull sprite, or null when inactive. */
    private _skull: WDSkull | null = null;
    /** True while the skull is on screen. */
    private _skullActive = false;
    /** Countdown to the next skull state change (spawn or removal), in ticks. */
    private _skullTimer = 0;

    private _levelIndex: number;
    /** Countdown to end of the current round; reset to ROUND_DURATION_TICKS each round. */
    private _roundTimer = 0;
    /** Countdown during the winner screen (-1 while the game is running). */
    private _roundOverTimer = -1;

    constructor(private readonly _options: WDGameOptions) {
        super();
        this._levelIndex = Math.floor(Math.random() * LEVELS.length);
        this.addState('stateRoundReset', () => this._doRoundReset());
    }

    // ── Resource loading ─────────────────────────────────────────────────────

    /** Load all required sprite-sheet and background images for every level. */
    protected override async stateResourceLoading(): Promise<void> {
        const promises: Promise<HTMLImageElement>[] = [
            this.loadImage('assets/images/sprites/wdspr_fire_z2.png', 'spr_fire'),
            this.loadImage('assets/images/sprites/wdspr_pl_z2.png', 'spr_pl'),
        ];
        const seen = new Set<string>();
        for (const level of LEVELS) {
            const tilesId = `tiles:${level.tileset}`;
            if (!seen.has(tilesId)) {
                seen.add(tilesId);
                promises.push(this.loadImage(TILE_DATA[level.tileset].image, tilesId));
            }
            if (!seen.has(level.background)) {
                seen.add(level.background);
                promises.push(this.loadImage(level.background, level.background));
            }
        }
        await Promise.all(promises);
    }

    // ── Game initializing ────────────────────────────────────────────────────

    /** One-time setup: bind the canvas and locate the HUD DOM elements, then start the first round. */
    protected override stateGameInitializing(): void {
        const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
        this.setCanvas(canvas);
        this._scoreEls = [document.getElementById('score_0'), document.getElementById('score_1')];
        this._hpBarEls = [document.getElementById('hp-bar-0'), document.getElementById('hp-bar-1')];
        this._precisionEls = [
            document.getElementById('precision_0'),
            document.getElementById('precision_1'),
        ];
        this._initRound();
    }

    // ── Round initialisation ──────────────────────────────────────────────────

    /**
     * Build (or rebuild) all layers, load the current level, create fresh player
     * sprites with their observers, and reset every per-round counter.
     * Called on first game start and again after each round reset.
     */
    private _initRound(): void {
        const levelData = LEVELS[this._levelIndex];
        this.createBackgroundLayer(levelData.background, 640, 480);
        this._land = this.createMatrixLayer(
            `tiles:${levelData.tileset}`,
            LEVEL_COLS,
            LEVEL_ROWS,
            32,
            32
        );
        this.createCollider(LEVEL_COLS, LEVEL_ROWS, 32, 32);
        this._sprites = this.createFairyLayer();
        this._sprites.setYMax(480);
        this._text = this.createCanvasLayer();

        this._buildLevel(levelData);
        this._sounds.startBGM([
            `assets/musics/ogg/${levelData.music}.ogg`,
            `assets/musics/mp3/${levelData.music}.mp3`,
        ]);

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
                    const victim = sender as WDPlayer;
                    shooter.store.state.score += damage;
                    shooter.store.state.enemyHit++;

                    if (victim.store.state.hitPoints <= 0 && this._deathTimers[victim.nCode] < 0) {
                        shooter.store.state.score += SCORE_DESTROYING_FOE;
                        this._startDeathSequence(victim);
                    } else if (damagedBy instanceof WDBullet || damagedBy instanceof WDPlasmaBall) {
                        const ss = shooter.store.state;
                        if (
                            ss.bulletHitLastTick < 0 ||
                            this._gameTick - ss.bulletHitLastTick > TWO_HIT_MISSILE_DELAY
                        ) {
                            ss.bulletHitStreak = 0;
                        }
                        ss.bulletHitLastTick = this._gameTick;
                        if (++ss.bulletHitStreak >= 2) {
                            ss.bulletHitStreak = 0;
                            ss.bulletHitLastTick = -1;
                            this._autoFireMissile(shooter, victim);
                        }
                    } else {
                        shooter.store.state.bulletHitStreak = 0;
                        shooter.store.state.bulletHitLastTick = -1;
                    }
                })
            );
            p.oObservatory.attach(
                'death',
                new Observer(this, () => {
                    this._sounds.play('explosion-die');
                })
            );
            this._players[i] = p;
        }

        this._crateSpawnPositions = this._buildCrateSpawnList();
        this._activeCrates = [];
        this._crateTimer = CRATE_TIME_TO_SPAWN;

        this._skull = null;
        this._skullActive = false;
        this._skullTimer = this._randomSkullWaitDuration();

        this._deathTimers = [-1, -1];
        this._respawnTimers = [-1, -1];
        this._gameTick = 0;
        this._roundTimer = ROUND_DURATION_TICKS;
        this._roundOverTimer = -1;

        // Single-player mode: player 1 is controlled by AI.
        // Set to null here (and remove the AIController field) to restore two-player mode.
        this._aiController = this._options.aiControlled
            ? new AIController(
                  this._players[1],
                  this._players[0],
                  this._land,
                  PLAYER_KEYS[1],
                  { ...PROFILE_HUNTER, initialState: 'chase-debug' }, // swap for PROFILE_BASIC, PROFILE_HUNTER, PROFILE_BERSERKER, PROFILE_CAUTIOUS…
                  this._text.canvas,
                  () => this._activeCrates
              )
            : null;
    }

    get textLayer(): FairyLayer {
        return this._text;
    }

    // ── Game running ─────────────────────────────────────────────────────────

    /**
     * Per-tick game logic:
     * 1. Read input and update each player's state.
     * 2. Trigger jump sound when a player just jumped.
     * 3. Spawn a missile (with exhaust callback) when a player fires.
     * 4. Refresh the score display.
     */
    protected override stateGameRunning(): string | null {
        // Winner screen phase: freeze game logic and count down to next round.
        if (this._roundOverTimer >= 0) {
            if (--this._roundOverTimer <= 0) {
                return 'stateRoundReset';
            }
            return null;
        }

        this._gameTick++;
        for (const player of this._players) {
            if (this._deathTimers[player.nCode] >= 0) {
                this._updateDeathSequence(player);
            } else if (this._respawnTimers[player.nCode] >= 0) {
                this._updateRespawnTimer(player);
                for (const p of this._players) {
                    p.store.state.hitPoints = p.store.state.vitality;
                }
            } else {
                if (player.nCode === 1 && this._aiController) {
                    this._aiController.update();
                    player.updateState(this._aiController.input);
                } else {
                    player.updateState(this._input);
                }
                if (player.bJustJumped) {
                    this._sounds.play('jump');
                    player.bJustJumped = false;
                }
                if (player.bJustLanded) {
                    this._sounds.play('land');
                    player.bJustLanded = false;
                }
            }
        }

        for (const player of this._players) {
            if (player.bWantFire && this._deathTimers[player.nCode] < 0) {
                player.bWantFire = false;
                const enemy = this._players[1 - player.nCode];
                const heightDiff = enemy.oFlight.vPosition.y - player.oFlight.vPosition.y;
                if (heightDiff > GRENADE_HEIGHT_THRESHOLD) {
                    this._fireProjectile(player, new WDGrenade(player));
                } else if (player.store.state.plasmaBallCount > 0) {
                    player.store.state.plasmaBallCount--;
                    this._fireProjectile(player, new WDPlasmaBall(player));
                } else if (player.store.state.tripleBullet) {
                    this._fireTripleBullet(player);
                } else {
                    this._fireProjectile(player, new WDBullet(player));
                }
            }
        }

        this._updateCrate();
        this._updateSkull();
        this._updateScoreDisplay();

        if (--this._roundTimer <= 0) {
            this._drawWinnerScreen();
            this._roundOverTimer = ROUND_OVER_DISPLAY_TICKS;
        }

        return null;
    }

    // ── Level building ────────────────────────────────────────────────────────

    /**
     * Populate `_land` from a level data array using `FairyLevelBuilder`.
     * Registers animated tile codes K (lava), N (water), and Q (flicker).
     */
    private _buildLevel(data: LevelData): void {
        const levelMap = data.map;
        const animationData = TILE_DATA[data.tileset];
        const builder = new FairyLevelBuilder();
        builder.setMatrix(this._land);
        builder.nMetaMultiplier = 120;
        if (animationData) {
            Object.entries(animationData.animations).forEach(([key, value]) => {
                builder.addAnimation(
                    key,
                    value.start,
                    value.count,
                    value.loop.type,
                    value.loop.inc,
                    value.loop.dur,
                    value.loop.count
                );
            });
        }
        builder.build(levelMap);
    }

    // ── Death sequence ────────────────────────────────────────────────────────

    /**
     * Begin the death sequence for `player`.
     * Delegates player-side cleanup to `WDPlayer.die()`, which fires the `'death'` event
     * handled below to play the sound. This method only starts the timer.
     */
    private _startDeathSequence(player: WDPlayer): void {
        this._deathTimers[player.nCode] = DEATH_SEQUENCE_TICKS;
        player.die();
    }

    /**
     * Called every tick while a player is in their death sequence.
     * Blinks the player, spawns explosions at regular intervals,
     * and hides the player permanently when the sequence ends.
     */
    private _updateDeathSequence(player: WDPlayer): void {
        const timer = --this._deathTimers[player.nCode];

        // Blink: alternate visibility every 4 ticks.
        player.bVisible = timer % 4 >= 2;

        // Spawn one explosion every DEATH_EXPLOSION_INTERVAL ticks.
        const elapsed = DEATH_SEQUENCE_TICKS - timer;
        if (
            elapsed % DEATH_EXPLOSION_INTERVAL === 0 &&
            elapsed / DEATH_EXPLOSION_INTERVAL < DEATH_EXPLOSION_COUNT
        ) {
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

        // Sequence over: hide the player and start the respawn countdown.
        if (timer <= 0) {
            player.bVisible = false;
            this._deathTimers[player.nCode] = -1;
            this._respawnTimers[player.nCode] = RESPAWN_DELAY_TICKS;
        }
    }

    // ── Respawn ───────────────────────────────────────────────────────────────

    /** Tick the respawn countdown; call `_respawnPlayer` when it expires. */
    private _updateRespawnTimer(player: WDPlayer): void {
        if (--this._respawnTimers[player.nCode] <= 0) {
            this._respawnTimers[player.nCode] = -1;
            this._respawnPlayer(player);
        }
    }

    /**
     * Restore a dead player to full combat state at a random arena position.
     * Score is intentionally preserved.
     */
    private _respawnPlayer(player: WDPlayer): void {
        const ss = player.store.state;
        ss.hitPoints = ss.vitality;
        ss.energy = ss.maxEnergy;
        ss.power = 1;
        ss.shield = false;
        ss.shieldTime = 0;
        ss.powerBoostTime = 0;
        ss.plasmaBallCount = 0;
        ss.bulletHitStreak = 0;
        ss.bulletHitLastTick = -1;
        const spawnPos =
            this._crateSpawnPositions[Math.floor(Math.random() * this._crateSpawnPositions.length)];
        const spawnX = spawnPos.col * 32 + 16;
        const spawnY = spawnPos.row * 32 - 1;
        player.oFlight.vPosition.set(spawnX, spawnY);
        player.oFlight.vSpeed.set(0, 0);
        player.oFlight.vAccel.set(0, 0.25);
        player.oBoundingShape.setTangibilityMask(4 + player.nCode + 1);
        player.bControllable = true;
        player.bVisible = true;
        this._spawnRespawnSmoke(spawnX, spawnY);
    }

    /**
     * Spawn a cloud of exhaust particles around the respawn point.
     * Each particle drifts upward with a slight anti-gravity acceleration.
     */
    private _spawnRespawnSmoke(cx: number, cy: number): void {
        this._sounds.play('spawn');
        for (let i = 0; i < 12; i++) {
            const ox = (Math.random() - 0.5) * 32;
            const oy = (Math.random() - 0.5) * 32;
            const smoke = this.createFairy(
                this._sprites,
                'spr_fire',
                new WDExhaust(cx + ox, cy + oy)
            );
            smoke.aAnimations[0].nFrameDuration = 15;
            smoke.oFlight.vSpeed.set((Math.random() - 0.5) * 0.7, -(Math.random() * 1.5 + 0.2));
            smoke.oFlight.vAccel.set(0, -0.03);
            smoke.nTime = 60;
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
        shooter.store.state.fireCount++;
        this.createFairy(this._sprites, 'spr_fire', projectile);
        projectile.oObservatory.attach(
            'fire',
            new Observer(this, (sender: Fairy) => this._sounds.play((sender as WDFire).soundOnFire))
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
    /**
     * Fire three bullets in a spread pattern: one straight, one angled up, one angled down.
     * Only the center bullet pays the energy cost; the two angled ones are free.
     */
    private _fireTripleBullet(shooter: WDPlayer): void {
        const center = new WDBullet(shooter);
        this._fireProjectile(shooter, center);

        const up = new WDBullet(shooter);
        up.oFlight.vSpeed.y = -TRIPLE_BULLET_VSPEED;
        up.state.cost = 0;
        this._fireProjectile(shooter, up);

        const down = new WDBullet(shooter);
        down.oFlight.vSpeed.y = TRIPLE_BULLET_VSPEED;
        down.state.cost = 0;
        this._fireProjectile(shooter, down);
    }

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
        const wasOnFloor = player.bOnFloor;
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

            if (subY < SEMI_SOLID_TILE_SUB_Y) {
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
                        if (!wasOnFloor) {
                            player.bJustLanded = true;
                        }
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
            } else if (other instanceof WDSkullGrenade && !other.bDead) {
                // Skull grenade hit: apply fixed damage (no score awarded), shock, explode.
                const shieldActive = player.store.state.shield;
                const damage = Math.ceil(other.damage * (shieldActive ? 0.1 : 1));
                player.store.state.hitPoints = Math.max(0, player.store.state.hitPoints - damage);
                this._sounds.play('hurt');
                flight.vShock.set(other.oFlight.vSpeed);
                flight.vShock.y -= 2;
                this.createFairy(
                    this._sprites,
                    'spr_fire',
                    new WDExplosion(other.oFlight.vPosition.x, other.oFlight.vPosition.y)
                );
                this._sounds.play('explosion-missile');
                other.bDead = true;
                this._maybeSpawnFlame(other.oFlight.vPosition.x, other.oFlight.vPosition.y);
                if (player.store.state.hitPoints <= 0 && this._deathTimers[player.nCode] < 0) {
                    this._startDeathSequence(player);
                }
            } else if (other instanceof WDFlame && !other.bDead) {
                // Flame contact: fixed damage, knock back away from the flame, explode.
                const shieldActive = player.store.state.shield;
                const damage = Math.ceil(other.damage * (shieldActive ? 0.1 : 1));
                player.store.state.hitPoints = Math.max(0, player.store.state.hitPoints - damage);
                this._sounds.play('hurt');
                const shockX = player.oFlight.vPosition.x >= other.oFlight.vPosition.x ? 3 : -3;
                flight.vShock.set(shockX, -4);
                this.createFairy(
                    this._sprites,
                    'spr_fire',
                    new WDExplosion(other.oFlight.vPosition.x, other.oFlight.vPosition.y)
                );
                this._sounds.play('explosion-missile');
                other.bDead = true;
                if (player.store.state.hitPoints <= 0 && this._deathTimers[player.nCode] < 0) {
                    this._startDeathSequence(player);
                }
            }
        }
    }

    // ── Projectile helpers ────────────────────────────────────────────────────

    /** Spawn the appropriate explosion, play its sound, and mark the projectile dead. */
    private _explodeProjectile(fire: WDFire, x: number, y: number): void {
        const ex =
            fire instanceof WDPlasmaBall
                ? new WDPlasmaImpact(x, y)
                : fire instanceof WDBullet
                  ? new WDBulletExplosion(x, y)
                  : new WDExplosion(x, y);
        this.createFairy(this._sprites, 'spr_fire', ex);
        fire.bDead = true;
        this._sounds.play(fire.soundOnExplosion);
        if (fire instanceof WDMissile || fire instanceof WDGrenade) {
            this._maybeSpawnFlame(x, y);
        }
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
        for (let row = 1; row < LEVEL_ROWS; row++) {
            for (let col = 0; col < LEVEL_COLS; col++) {
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
     * attach observers, and push it into `_activeCrates`.
     * Does nothing if there are no valid spawn positions.
     * @param allowMultiCrate - When false (used when spawning from a MULTICRATE pickup),
     *   the MULTICRATE bonus is excluded to prevent cascading spawns.
     */
    private _spawnCrate(allowMultiCrate = true): void {
        if (this._crateSpawnPositions.length === 0) {
            return;
        }
        const { col, row } =
            this._crateSpawnPositions[Math.floor(Math.random() * this._crateSpawnPositions.length)];
        const lootEntries: Array<[CrateBonus, number]> = [
            [CrateBonus.MULTICRATE, LOOT_DATA.MULTICRATE],
            [CrateBonus.SHIELD, LOOT_DATA.SHIELD],
            [CrateBonus.POWERUP, LOOT_DATA.POWERUP],
            [CrateBonus.HEAL, LOOT_DATA.HEAL],
        ];
        const eligible = allowMultiCrate
            ? lootEntries
            : lootEntries.filter(([b]) => b !== CrateBonus.MULTICRATE);
        const total = eligible.reduce((sum, [, w]) => sum + w, 0);
        let remaining = Math.random() * total;
        let bonus: CrateBonus = eligible[eligible.length - 1][0];
        for (const [b, w] of eligible) {
            remaining -= w;
            if (remaining <= 0) {
                bonus = b;
                break;
            }
        }
        const crate = this.createFairy(this._sprites, 'spr_fire', new WDCrate(bonus));
        crate.placeOnTile(col, row);
        crate.oFlight.vSpeed.set(0, -4);
        crate.ttl = CRATE_TIME_TO_LIVE;
        crate.oObservatory.attach(
            'move',
            new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                this._crateLandCollision(sender as WDCrate, flight)
            )
        );
        crate.oObservatory.attach(
            'picked',
            new Observer(this, (sender, { player }) => {
                this._sounds.play('pick');
                const c = sender as WDCrate;
                this.createFairy(
                    this._sprites,
                    'spr_fire',
                    new WDBonusIndicator(c.bonus, c.oFlight.vPosition.x, c.oFlight.vPosition.y)
                );
                switch (c.bonus) {
                    case CrateBonus.HEAL: {
                        this._bonusHeal(player);
                        break;
                    }
                    case CrateBonus.SHIELD: {
                        this._bonusShield(player);
                        break;
                    }
                    case CrateBonus.POWERUP: {
                        this._bonusBoost(player);
                        break;
                    }
                    case CrateBonus.MULTICRATE: {
                        this._bonusMultiCrate();
                        break;
                    }
                    default: {
                        throw new Error(`Unexpected crate bonus: ${c.bonus}`);
                    }
                }
            })
        );
        this._activeCrates.push(crate);
    }

    /** Spawn 3–5 non-MULTICRATE crates immediately as a burst reward. */
    private _bonusMultiCrate(): void {
        const count = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
        for (let i = 0; i < count; i++) {
            this._spawnCrate(false);
        }
    }

    private _bonusHeal(player: WDPlayer): void {
        const ss = player.store.state;
        ss.hitPoints = Math.min(ss.vitality, ss.hitPoints + 30);
    }

    private _bonusShield(player: WDPlayer): void {
        player.store.state.shield = true;
        player.store.state.shieldTime = 6 * 60;
    }

    private _bonusBoost(player: WDPlayer): void {
        player.store.state.plasmaBallCount += 10;
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
            const tileX1 = Math.floor(flight.vNewPosition.x - 8) >> 5;
            const tileX2 = Math.floor(flight.vNewPosition.x + 7) >> 5;
            const tileY = Math.floor(bottomY) >> 5;
            const subY = Math.floor(bottomY) % 32;

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
     * - Ticks each active crate's TTL; marks it dead when time runs out.
     * - Removes dead crates from the list.
     * - Counts down the spawn timer independently; spawns a new crate when it fires.
     */
    private _updateCrate(): void {
        for (const crate of this._activeCrates) {
            if (!crate.bDead && --crate.ttl <= 0) {
                crate.bDead = true;
            }
        }
        this._activeCrates = this._activeCrates.filter((c) => !c.bDead);

        if (--this._crateTimer <= 0) {
            this._spawnCrate();
            this._crateTimer =
                CRATE_TIME_TO_SPAWN + Math.floor((Math.random() * 2 - 1) * CRATE_SPAWN_VARIANCE);
        }
    }

    // ── Flame spawning ────────────────────────────────────────────────────────

    /**
     * Always spawn a WDFlame at (x, y) with optional initial velocity.
     * Attaches 'move' (land collision) and 'smoke' observers.
     */
    private _spawnFlame(x: number, y: number, vx?: number, vy?: number): void {
        const flame = this.createFairy(
            this._sprites,
            'spr_fire',
            new WDFlame(x, y, vx, vy)
        ) as WDFlame;
        flame.oObservatory.attach(
            'move',
            new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                this._flameLandCollision(sender as WDFlame, flight)
            )
        );
        flame.oObservatory.attach(
            'smoke',
            new Observer(this, (_sender, { x: sx, y: sy }) => {
                const puff = this.createFairy(this._sprites, 'spr_fire', new WDExhaust(sx, sy));
                puff.oFlight.vAccel.set(0, -0.2);
            })
        );
    }

    /**
     * With probability FLAME_CHANCE, spawn a WDFlame at (x, y) with default
     * explosion-style random velocity.
     */
    private _maybeSpawnFlame(x: number, y: number): void {
        if (Math.random() < FLAME_CHANCE) {
            this._spawnFlame(x, y);
        }
    }

    /**
     * 'move' observer for WDFlame.
     * While airborne, stops the flame on semi-solid or fully solid tiles and
     * switches it to mortal mode (FLAME_DURATION ticks).
     * Kills the flame immediately if it falls off the bottom of the arena.
     */
    private _flameLandCollision(flame: WDFlame, flight: FairyFlight): void {
        if (flame.bGrounded) {
            return;
        }
        if (flight.vNewPosition.y > 480) {
            flame.bDead = true;
            return;
        }
        if (flight.vNewPosition.y > flight.vPosition.y) {
            const bottomY = flight.vNewPosition.y + 6;
            const tileX1 = Math.floor(flight.vNewPosition.x - 6) >> 5;
            const tileX2 = Math.floor(flight.vNewPosition.x + 6) >> 5;
            const tileY = Math.floor(bottomY) >> 5;
            const subY = Math.floor(bottomY) % 32;
            if (subY < 16) {
                const code = Math.max(
                    this._land.getTileCode(tileX1, tileY),
                    this._land.getTileCode(tileX2, tileY)
                );
                if (code >= 1) {
                    flight.vNewPosition.y = (tileY << 5) - 7;
                    flight.vNewSpeed.set(0, 0);
                    flight.vNewAccel.set(0, 0);
                    flame.bGrounded = true;
                    flame.bMortal = true;
                    flame.nTime = FLAME_DURATION;
                }
            }
        }
    }

    // ── Skull lifecycle ───────────────────────────────────────────────────────

    /** Pick a random wait duration between the min and max deactivation bounds. */
    private _randomSkullWaitDuration(): number {
        return (
            SKULL_DEACTIVATION_MIN_DURATION +
            Math.floor(
                Math.random() * (SKULL_DEACTIVATION_MAX_DURATION - SKULL_DEACTIVATION_MIN_DURATION)
            )
        );
    }

    /**
     * Called every tick.
     * Counts down `_skullTimer`; on expiry either spawns or removes the skull
     * and reschedules the opposite transition.
     */
    private _updateSkull(): void {
        if (--this._skullTimer > 0) {
            return;
        }
        if (this._skullActive) {
            if (this._skull) {
                this._spawnRespawnSmoke(
                    this._skull.oFlight.vPosition.x,
                    this._skull.oFlight.vPosition.y
                );
                this._skull.bDead = true;
                this._skull = null;
            }
            this._skullActive = false;
            this._skullTimer = this._randomSkullWaitDuration();
        } else {
            this._spawnSkull();
            this._skullActive = true;
            this._skullTimer = SKULL_ACTIVATION_DURATION;
        }
    }

    /** Instantiate a WDSkull, place it in the upper patrol zone, and attach observers. */
    private _spawnSkull(): void {
        const variant = Math.random() < 0.5 ? 0 : 1;
        const skull = this.createFairy(this._sprites, 'spr_fire', new WDSkull(variant)) as WDSkull;
        skull.oFlight.vPosition.set(
            96 + Math.floor(Math.random() * (640 - 192)),
            80 + Math.floor(Math.random() * 80)
        );
        this._spawnRespawnSmoke(skull.oFlight.vPosition.x, skull.oFlight.vPosition.y);
        skull.oObservatory.attach(
            'move',
            new Observer(this, (sender: Fairy, flight: FairyFlight) =>
                this._skullWallCollision(sender as WDSkull, flight)
            )
        );
        skull.oObservatory.attach(
            'throw',
            new Observer(this, (_sender, { x, y, face }) => this._skullThrow(x, y, face))
        );
        skull.oObservatory.attach(
            'drop',
            new Observer(this, (_sender, { x, y }) => this._skullDrop(x, y))
        );
        this._skull = skull;
    }

    /** Drop a WDFlame directly below the skull with no initial speed. */
    private _skullDrop(x: number, y: number): void {
        this._sounds.play('shoot-flame');
        this._spawnFlame(x, y, 0, 0);
    }

    /**
     * 'move' observer for the skull.
     * Reverses `nFace` (and zeroes horizontal speed for this tick) when the skull
     * would enter a fully solid tile or leave the arena boundaries.
     * Clamps the vertical position to the upper patrol zone.
     */
    private _skullWallCollision(skull: WDSkull, flight: FairyFlight): void {
        // Arena horizontal boundaries.
        if (flight.vNewPosition.x < 56) {
            flight.vNewPosition.x = 56;
            flight.vNewSpeed.x = 0;
            skull.nFace = 1;
        } else if (flight.vNewPosition.x > 584) {
            flight.vNewPosition.x = 584;
            flight.vNewSpeed.x = 0;
            skull.nFace = -1;
        } else {
            // Tile wall check: probe one pixel past the leading half-width (8 px).
            const tileY = Math.floor(flight.vNewPosition.y) >> 5;
            if (skull.nFace > 0) {
                const tileX = Math.floor(flight.vNewPosition.x + 9) >> 5;
                if (this._land.getTileCode(tileX, tileY) >= 2) {
                    skull.nFace = -1;
                    flight.vNewSpeed.x = 0;
                }
            } else {
                const tileX = Math.floor(flight.vNewPosition.x - 9) >> 5;
                if (this._land.getTileCode(tileX, tileY) >= 2) {
                    skull.nFace = 1;
                    flight.vNewSpeed.x = 0;
                }
            }
        }

        // Vertical patrol zone clamp (upper section of the level).
        if (flight.vNewPosition.y < 72) {
            flight.vNewPosition.y = 72;
        } else if (flight.vNewPosition.y > 200) {
            flight.vNewPosition.y = 200;
        }
    }

    /** Spawn a WDSkullGrenade at the skull's position and attach a land-collision observer. */
    private _skullThrow(x: number, y: number, face: number): void {
        this._sounds.play('shoot-grenade');
        const grenade = this.createFairy(
            this._sprites,
            'spr_fire',
            new WDSkullGrenade(x, y, face)
        ) as WDSkullGrenade;
        grenade.oObservatory.attach(
            'move',
            new Observer(this, (sender: Fairy) =>
                this._checkSkullGrenadeLandCollision(sender as WDSkullGrenade)
            )
        );
    }

    /**
     * 'move' observer for skull grenades.
     * Explodes the grenade when its centre enters a fully solid tile (code ≥ 2).
     */
    private _checkSkullGrenadeLandCollision(grenade: WDSkullGrenade): void {
        if (grenade.bDead) {
            return;
        }
        const rect = grenade.oBoundingShape as FairyCollisionRect;
        const [p1, p2] = rect.getPoints();
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        if (this._land.getTileCode(Math.floor(cx) >> 5, Math.floor(cy) >> 5) >= 2) {
            this.createFairy(this._sprites, 'spr_fire', new WDExplosion(cx, cy));
            this._sounds.play('explosion-missile');
            grenade.bDead = true;
            this._maybeSpawnFlame(cx, cy);
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
            if (
                (player.store.dirty.has('fireCount') || player.store.dirty.has('enemyHit')) &&
                this._precisionEls[i]
            ) {
                const { fireCount, enemyHit } = player.store.state;
                this._precisionEls[i]!.textContent = String(
                    fireCount > 0 ? Math.floor((100 * enemyHit) / fireCount) : 0
                );
            }
            player.store.validate();
        }
    }

    // ── Round over / reset ────────────────────────────────────────────────────

    /** Draw the winner overlay directly onto the game canvas. */
    private _drawWinnerScreen(): void {
        const canvas = this.getCanvas();
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, w, h);

        const s0 = this._players[0].store.state.score;
        const s1 = this._players[1].store.state.score;
        const winnerText =
            s0 > s1 ? 'PLAYER 1 WINS!' : s1 > s0 ? 'PLAYER 2 WINS!' : 'DRAW!';

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px monospace';
        ctx.fillText(winnerText, w / 2, h / 2 - 20);

        ctx.fillStyle = '#aaaaaa';
        ctx.font = '28px monospace';
        ctx.fillText(`${s0}  —  ${s1}`, w / 2, h / 2 + 32);
    }

    /**
     * FSM handler for the `stateRoundReset` state.
     * Stops the music, tears down all layers, picks a new random level (different
     * from the current one), and rebuilds the round via `_initRound`.
     */
    private _doRoundReset(): string {
        this._sounds.stopBGM();
        this.clearLayers();
        const prev = this._levelIndex;
        do {
            this._levelIndex = Math.floor(Math.random() * LEVELS.length);
        } while (LEVELS.length > 1 && this._levelIndex === prev);
        this._players = [];
        this._initRound();
        return 'stateGameRunning';
    }
}
