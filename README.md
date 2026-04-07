# Battle Piaf

A 2-player local multiplayer arena shooter running in the browser.

## Gameplay

Two players face each other in a tile-based arena and try to score points by hitting the opponent with homing missiles. There is no win condition or timer yet — the game runs indefinitely and scores accumulate.

### Controls

| Action     | Player 1 (blue)  | Player 2 (red)   |
|------------|------------------|------------------|
| Move left  | `S`              | Numpad `4`       |
| Move right | `F`              | Numpad `6`       |
| Jump       | `E`              | Numpad `8`       |
| Fire       | `D`              | Numpad `5`       |

### Mechanics

- **Gravity** pulls players downward constantly. Players can jump when standing on a floor tile.
- **Missiles** are homing: after being fired they accelerate horizontally and gently steer toward the vertical centre of the enemy. They are slow enough at launch to be dodgeable.
- **Exhaust trail** — a smoke particle effect is emitted from the rear of every missile in flight.
- **Explosions** — a short animation plays at the point of impact when a missile hits a player.
- **Knock-back** — a hit player receives a directional impulse that decays over several frames.
- **Score** — the shooter's score increments by 1 on each hit. Scores are displayed in the HTML overlay.
- **Player-player collision** — players that overlap are deflected away from each other based on their relative positions and speeds.

### Arena

The arena is a 20×15 tile grid (640×480 px). Tiles have one of three collision modes:

| Character | Solidity    | Behaviour                                         |
|-----------|-------------|---------------------------------------------------|
| `.`       | None        | Decorative / air — players pass through freely    |
| `*`       | Semi-solid  | Floor only — blocks downward movement, passable from below and sides |
| `#`       | Fully solid | Blocks from all four directions (floor, ceiling, left wall, right wall) |

Two levels are currently defined (`level-0.json` and `level-1.json`). Level 0 is loaded at startup. Tile animations (lava flicker, water ripple, sparkle) are supported via the level builder.

Arena boundaries: the left and top walls are hard stops; the right wall bounces players back.

## Technical overview

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5 |
| Build | esbuild (bundle to `public/dist/game.js`) |
| Rendering | HTML5 Canvas 2D API |
| Audio | Howler.js |
| Linting | ESLint + typescript-eslint |
| Formatting | Prettier |

### Source structure

```
src/
  core/
    Vector2D.ts        — 2D mutable vector math
    Observer.ts        — single observer (callback + context)
    Observatory.ts     — named-event pub/sub hub
    Horde.ts           — growable array with O(1) reverse lookup
  engine/
    FairyEngine.ts     — base engine: lifecycle, layers, RAF loop
    FairyFlight.ts     — two-step physics (proceed / postProceed)
    FairyAnimation.ts  — frame-based animation state machine
    Fairy.ts           — base sprite class
    Fairies.ts         — sprite layer container
    FairyLayer.ts      — static background layer
    FairyMatrix.ts     — scrollable tile-map layer
    FairyTile.ts       — individual tile (gfx index + collision code + animation)
    FairyLevelBuilder.ts — text-encoded level parser
    FairyCollision.ts  — AABB collision with spatial hash grid
    FairyInputState.ts — flat keyboard/mouse state snapshot
    FairyKeys.ts       — browser key code constants
    FairyImageLoader.ts — async image loader/cache
    FairySequencer.ts  — finite-state machine (engine lifecycle)
  game/
    WDGame.ts          — main game class: init, loop, collision handlers
    WDPlayer.ts        — player sprite (input, animation, physics)
    WDPlayerFlight.ts  — player physics with gravity cap and knock-back shock
    WDFire.ts          — abstract base for projectiles
    WDBullet.ts        — straight-line bullet (unused in current build)
    WDMissile.ts       — homing missile with exhaust trail
    WDExhaust.ts       — smoke particle spawned by missiles
    WDExplosion.ts     — one-shot explosion effect on impact
    SoundManager.ts    — Howler wrapper with random variant selection
  data/
    levels.ts          — exports all level JSON arrays
    level-0.json       — level 0 tile data
    level-1.json       — level 1 tile data
    tile-def.ts        — tile code reference / documentation
public/
  assets/
    images/            — sprite sheets and background
    sounds/ogg|mp3/    — jump, shoot, hit sound effects
  dist/
    game.js            — bundled output (generated)
  index.html           — game page with score overlay
```

### Engine design notes

- **Two-step physics**: `FairyFlight.proceed()` writes candidate values into `vNewPosition`/`vNewSpeed`. Collision observers (attached to each sprite's `oObservatory`) run and may adjust those candidates. `FairyFlight.postProceed()` then commits them. This lets multiple collision systems (land tiles, sprites) modify the same frame's motion without fighting each other.
- **Tangibility masks**: each sprite's bounding shape carries a bitmask. Two shapes only test for overlap when `(maskA & maskB) !== 0`. This gives self-immunity to projectiles without any `if (owner === this)` checks.
- **Render throttle**: `proceed()` runs every RAF frame (~60 Hz); `render()` runs every other frame (~30 Hz) to reduce draw calls.

## Development

```bash
npm install          # install dependencies
npm run dev          # build, watch, and serve at http://localhost:8000
npm run build        # one-shot production build
npm run check        # TypeScript type check (no emit)
npm run lint         # ESLint
npm run fix          # Prettier format + ESLint auto-fix
```
