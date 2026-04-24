# AI System — battle-piaf

This document describes the complete AI architecture for the human-vs-computer mode.
The AI-controlled player is called the **drone**.

---

## Overview

```
WDGame
  └─ AIController          (one per drone)
       ├─ AIInput           (virtual keyboard)
       ├─ AIContext         (shared world snapshot passed to every state)
       ├─ StateMachine      (FSM driver)
       │    └─ IState       (active state receives onUpdate each tick)
       └─ Navigation
            ├─ NavGraph     (nodes + edges, built once from the tile map)
            ├─ NavQuery     (A* over NavGraph)
            └─ NavTopology  (platforms grouped from NavGraph nodes)
```

Each tick `AIController.update()` is called **before** `player.updateState(aiController.input)`.
The FSM ticks the active state, which reads the world through `AIContext` and writes
movement decisions to `AIInput`.

---

## 1. Navigation

### 1.1 Tile codes

| Code | Meaning              |
|------|----------------------|
| 0    | Empty / air          |
| 1    | Semi-solid platform  |
| 2+   | Full-solid wall/floor|

Semi-solid tiles (code 1) can be jumped up through from below.
When the player's feet enter the **top 16 px** of the tile, the engine snaps them
onto its surface. They can also drop through by pressing `down`.

### 1.2 NavNode — `navigation/NavNode.ts`

One node per standable tile position.
A tile at `(col, row)` becomes a node when:
- `floorCode >= 1` (solid or semi-solid), **and**
- `aboveCode === 0` (open space the player can stand in).

```
node.x  = col * 32 + 16   // pixel centre of the tile
node.y  = row * 32         // pixel y of the player's feet when standing here
```

### 1.3 NavEdge — `navigation/NavEdge.ts`

A directed connection between two nodes.

| EdgeKind      | Meaning                                                   | A* cost |
|---------------|-----------------------------------------------------------|---------|
| `Walk`        | Horizontal movement on the same platform row              | 1.0     |
| `FallOff`     | Walk off the edge and fall to a lower node                | 1.2     |
| `DropThrough` | Press `down` on a semi-solid tile to fall through         | 1.5     |
| `JumpUp`      | Jump to reach a higher node                               | 2.0     |

### 1.4 NavGraph — `navigation/NavGraph.ts`

Scans the tile map and builds the full node/edge graph.
Called once with `graph.build(land)` during `AIController` construction.

**Edge construction rules:**

- **Walk** — same row, `dx <= TILE_SIZE`.
- **JumpUp** — target is higher (`dy < 0`), horizontal reach
  `dx <= MAX_JUMP_HORIZONTAL` (~165 px), height `-dy <= MAX_JUMP_HEIGHT * 0.95 + snapBonus`.
  `snapBonus = 16 px` for semi-solid targets (the snap zone extends effective reach).
- **DropThrough** — target is lower, same column (`dx < TILE_SIZE`), source floor is
  semi-solid (code 1).
- **FallOff** — target is lower, horizontal offset (`dx >= TILE_SIZE`).

**Physics constants used for envelope calculations:**

| Constant                | Value            |
|-------------------------|------------------|
| Jump speed (upward)     | 6.9 px/tick      |
| Gravity                 | 0.25 px/tick²    |
| Max jump height         | ~95 px (≈3 tiles)|
| Player horizontal speed | 3 px/tick        |
| Max horizontal reach    | ~165 px          |
| Semi-solid snap zone    | 16 px            |

**Spatial queries:**

- `findNearest(px, py)` — Euclidean closest node; used to locate the opponent's position.
- `findBelow(px, py)` — nearest node within one tile horizontally, at or below `py`;
  used to locate the drone's current standing platform.

### 1.5 NavQuery — `navigation/NavQuery.ts`

A* pathfinder. Returns `NavEdge[]` — an ordered list of edges to traverse.

```
query.findPath(fromNode, toNode)  →  NavEdge[]
```

Heuristic: Euclidean distance between node centres.
Edge costs are defined in `NavEdge` (see table above).

### 1.6 Platform — `navigation/Platform.ts`

A group of horizontally contiguous same-row nodes forming one surface.

```
platform.row          // tile row
platform.y            // world-space y of the surface (feet level)
platform.xMin/xMax    // pixel boundaries
platform.centerX      // pixel centre of the platform
platform.width        // pixel width
platform.isSemiSolid  // true when every tile in the platform has code 1
platform.containsX(px)
```

### 1.7 NavTopology — `navigation/NavTopology.ts`

Groups all NavNodes into `Platform` objects and exposes arena-level spatial queries.
Built once with `topology.build(graph.nodes, land)` during `AIController` construction.

**Building logic:**
1. Nodes are grouped by row.
2. Within each row, nodes are sorted by column, then split into runs where
   consecutive columns differ by more than 1 (gap in the platform).
3. Each run becomes one `Platform`. `isSemiSolid` is true only when every tile
   in the run has code 1.

**Queries:**

| Method                          | Returns                                                          |
|---------------------------------|------------------------------------------------------------------|
| `platformAt(px, py)`            | Platform the entity stands on, or `null` if airborne            |
| `platformOf(node)`              | Platform that owns a specific NavNode                           |
| `platformsAtRow(row)`           | All platforms at a given tile row                               |
| `platformsAtSameHeight(ref)`    | All platforms at the same row as `ref`, excluding `ref` itself  |
| `isAirborne(px, py)`            | `true` when no platform contains the position                   |

---

## 2. Finite State Machine (FSM)

### 2.1 IState — `fsm/IState.ts`

```typescript
interface IState<TContext> {
    onEnter(ctx: TContext): void;
    onUpdate(ctx: TContext): IState<TContext> | null;   // return non-null to transition
    onExit(ctx: TContext): void;
}
```

### 2.2 StateMachine — `fsm/StateMachine.ts`

Holds one active state. Each tick:
1. Calls `current.onUpdate(ctx)`.
2. If a new state is returned, calls `current.onExit(ctx)`, then `next.onEnter(ctx)`,
   then sets `current = next`.

Transitions can also be triggered externally via `fsm.transition(next)` — used by
`AIController` when the player takes a hit.

### 2.3 AIContext — `AIContext.ts`

Shared read-only world snapshot plus mutable state, passed to every `IState` each tick.
Path and per-state data are **not** stored here — they travel via constructor injection
so ownership stays explicit.

```typescript
interface AIContext {
    player:    WDPlayer;          // the drone
    opponent:  WDPlayer;          // the human player
    input:     AIInput;           // virtual keyboard the state writes to
    land:      FairyMatrix;       // arena tile map
    graph:     NavGraph;
    query:     NavQuery;
    topology:  NavTopology;
    profile:   AIProfile;         // active personality (read-only)
    crates:    () => readonly WDCrate[];  // live crate list (polled each tick)
    debugCanvas?: HTMLCanvasElement;
}
```

### 2.4 AIInput — `AIInput.ts`

Extends `FairyInputState` (the same type the human keyboard produces) so it can be
passed directly to `player.updateState()`.

States call these each tick:

```typescript
input.releaseAll()   // must be called at the start of each tick
input.pressLeft()
input.pressRight()
input.pressJump()
input.pressFire()
input.pressDrop()    // drop through semi-solid platforms
```

---

## 3. States

### State transition diagram

```
                 [hit received, evadeOnHit=true]
                           │
                           ▼
  [start] ──► NullState    EvadeState ◄──── any chase/station state
                                │
                         timer expires
                                │
                                ▼
  [start] ──► BasicState  (never transitions)

  [start] ──► ChaseChoosePlatformState ◄──────────────────────────┐
                    │  (single-tick scorer)                        │
                    ▼                                              │
            ChaseProceedToPlatformState ──── crate spotted ──► ChaseCrateState
                    │   │   │                                      │
              arrived│   │timeout                           crate gone│timeout
                     │   │                                      │      │
                     ▼   ▼                                      ▼      ▼
               StationState   PonderState ◄─── replan ── ChaseChoosePlatformState
                    │              │
              opponent row         └── always ──► ChaseChoosePlatformState
              changed (1 s)
                    │
                    ▼
               PonderState
```

### 3.1 NullState — `states/NullState.ts`

Releases all keys every tick. Never transitions. Used by `PROFILE_NULL` for testing.

### 3.2 BasicState — `states/BasicState.ts`

Ranged-shooter behavior. Does not use NavGraph or A*.

Each tick:
1. **Horizontal positioning** — maintain `preferredDistMin`–`preferredDistMax` from opponent.
   - Too close → back away (32 px hysteresis to avoid flip-flopping on the boundary).
   - Too far → approach.
   - In band → hold.
2. **Vertical** — jump when opponent is >32 px higher.
3. **Fire** — only while in the distance band; cooldown resets when out of position so
   the first shot after repositioning fires immediately.
4. **Random jumps** — controlled by `profile.randomJumpChance`.

Never transitions to another state.

### 3.3 ChaseChoosePlatformState — `states/ChaseChoosePlatformState.ts`

Single-tick decision state. Produces no movement.

**Each tick (exactly one):**
1. Find the opponent's current platform via `topology.platformAt()`.
2. Score all peer platforms at the same height using three criteria:
   - **Distance score** — prefer horizontal distance from opponent close to `(preferredDistMin + preferredDistMax) / 2`. Weight: 1.0.
   - **Width score** — wider platforms offer more dodging room. Weight: 0.05.
   - **Proximity score** — prefer platforms already close to the drone (shorter path). Weight: 0.02.
3. Compute an A* path to the winning platform (targeting the node closest to the drone).
4. Immediately transition to `ChaseProceedToPlatformState(platform, path)`.

Fallbacks: if the opponent is airborne → target the drone's own platform; if no peer platforms exist → target the opponent's platform directly.

### 3.4 ChaseProceedToPlatformState — `states/ChaseProceedToPlatformState.ts`

Path-execution state. Follows the A* edge list computed by `ChaseChoosePlatformState`.

**Each tick:**
1. Check for live crates → transition to `ChaseCrateState` if found.
2. Check opponent's platform row against the row recorded at `onEnter` → if changed, transition to `ChaseChoosePlatformState` (path is stale).
3. Increment timeout → transition to `PonderState` after 600 ticks.
4. Check arrival: if drone is on the target platform and path is empty → transition to `StationState`.
5. Follow the current edge:
   - `Walk` — horizontal movement.
   - `JumpUp` — jump immediately when grounded (no alignment wait).
   - `DropThrough` — press `down` when grounded.
   - `FallOff` — horizontal movement only.
6. If path is exhausted but not yet on platform → `_moveDirect` to platform centre.
7. Spontaneous random jump per `profile.randomJumpChance`.

### 3.5 StationState — `states/StationState.ts`

Hold the chosen platform and fire at the opponent from range.

**Each tick:**
1. Check for live crates → transition to `ChaseCrateState` if found.
2. Track opponent's platform row; if they are off the expected row for **60 consecutive ticks** (~1 s) → transition to `PonderState`. Brief jumps do not trigger a replan.
3. Face the opponent and fire on `profile.fireCooldown`.
   - Only presses a direction key when `player.nFace !== requiredFace` to avoid drifting 3 px toward the opponent every shot.
4. Jump when opponent is >32 px higher.
5. Spontaneous random jump per `profile.randomJumpChance`.

### 3.6 ChaseCrateState — `states/ChaseCrateState.ts`

Navigate toward a live crate and pick it up. Does not fire.

Constructed by the `tryCreateCrateChase(ctx)` helper, which:
- Filters `ctx.crates()` to live crates only.
- Finds the closest one by Euclidean distance.
- Computes an A* path to it.
- Returns a ready `ChaseCrateState`, or `null` if no crates exist.

`tryCreateCrateChase` is called opportunistically at the start of every tick in
`ChaseProceedToPlatformState`, `StationState`, and `PonderState`.

**Each tick:**
1. If crate is dead (picked up or expired) → `ChaseChoosePlatformState`.
2. Increment timeout → `PonderState` after 600 ticks.
3. Follow path to crate; when path exhausted, `_moveDirect` with a near-zero
   dead zone so the drone walks off platform edges to reach crates below.
   Also presses `down` when the crate is directly below on a semi-solid platform.

### 3.7 PonderState — `states/PonderState.ts`

30-tick pause (~0.5 s). The drone stands still.

At the end of the pause, `_nextState()` is called:
1. If any live crate exists → `ChaseCrateState`.
2. Otherwise → `ChaseChoosePlatformState`.

### 3.8 EvadeState — `states/EvadeState.ts`

Move away from the opponent for `profile.evadeDuration` ticks.

Triggered externally by `AIController` on the `'damaged'` observer event (only when
`profile.evadeOnHit = true`).

- Random jump chance is `max(profile.randomJumpChance, 0.05)` to dodge follow-up shots.
- Returns to `ChaseChoosePlatformState` when timer expires.

---

## 4. AIProfile — `AIProfile.ts`

A profile is a plain object that tunes all behavior parameters. Set at construction,
never changed during a match.

```typescript
interface AIProfile {
    name:             string;
    initialState:     'null' | 'basic' | 'chase' | 'chase-debug';
    preferredDistMin: number;   // px — used by ChaseChoosePlatformState scoring
    preferredDistMax: number;   // px — used by ChaseChoosePlatformState scoring
    attackRangeX:     number;   // px — unused in current chase pipeline (legacy)
    attackRangeY:     number;   // px
    disengageX:       number;   // px
    disengageY:       number;   // px
    fireCooldown:     number;   // ticks between shots (StationState)
    evadeOnHit:       boolean;  // trigger EvadeState on hit?
    evadeDuration:    number;   // ticks of evasion
    randomJumpChance: number;   // probability per tick of a spontaneous jump (0–1)
}
```

### Preset profiles

| Profile             | Strategy | Behaviour                                                          |
|---------------------|----------|--------------------------------------------------------------------|
| `PROFILE_NULL`      | `null`   | Does nothing. For isolated testing.                                |
| `PROFILE_BASIC`     | `basic`  | Ranged shooter; stays 4–6 tiles away; hops to dodge.              |
| `PROFILE_HUNTER`    | `chase`  | Aggressive platform chaser; evades after being hit.               |
| `PROFILE_BERSERKER` | `chase`  | Maximum aggression; never evades; high fire rate.                 |
| `PROFILE_CAUTIOUS`  | `chase`  | Large attack range; long evasion; random dodges.                  |

---

## 5. AIController — `AIController.ts`

Entry point. Owns the FSM, the nav system, and the virtual input.

```typescript
new AIController(
    player,       // WDPlayer — the drone
    opponent,     // WDPlayer — the human
    land,         // FairyMatrix — arena tile map
    keys,         // PlayerKeys — drone's key bindings
    profile,      // AIProfile
    debugCanvas,  // HTMLCanvasElement — optional debug overlay
    getCrates     // () => WDCrate[] — live crate list supplier (default: () => [])
)
```

**Construction sequence:**
1. Create `AIInput` with the player's key bindings.
2. `NavGraph.build(land)` — scan tile map, build nodes and edges.
3. `NavTopology.build(graph.nodes, land)` — group nodes into platforms.
4. Populate `AIContext`.
5. Create `StateMachine`, transition to `_initialState(profile)`:
   - `'null'` → `NullState`
   - `'basic'` → `BasicState`
   - `'chase'` / `'chase-debug'` → `ChaseChoosePlatformState`
6. If `profile.evadeOnHit`, attach an `Observer` on the `'damaged'` event that
   immediately transitions the FSM to `EvadeState`.

Per tick: `aiController.update()` → `fsm.update()` → active state ticks.

---

## 6. Integration in WDGame

```typescript
// Initialisation (in _initRound)
this._aiController = new AIController(
    this._players[1],   // drone
    this._players[0],   // human
    this._land,
    PLAYER_KEYS[1],
    PROFILE_HUNTER,     // swap profile here
    this._text.canvas,  // debug canvas (the text layer)
    () => this._activeCrates
);

// Each tick (stateGameRunning)
if (player.nCode === 1 && this._aiController) {
    this._aiController.update();
    player.updateState(this._aiController.input);
} else {
    player.updateState(this._input);
}
```

To disable AI and restore two-player mode: pass `null` or set `_options.aiControlled = false`.

---

## 7. File map

```
src/game/ai/
├── AIController.ts
├── AIContext.ts
├── AIInput.ts
├── AIProfile.ts
├── fsm/
│   ├── IState.ts
│   └── StateMachine.ts
├── navigation/
│   ├── NavConsts.ts          TILE_SIZE = 32
│   ├── NavNode.ts
│   ├── NavEdge.ts            EdgeKind enum + cost table
│   ├── NavGraph.ts           build() + findNearest() + findBelow()
│   ├── NavQuery.ts           A* → NavEdge[]
│   ├── Platform.ts
│   └── NavTopology.ts        build() + platformAt() + platformsAtSameHeight() …
└── states/
    ├── NullState.ts
    ├── BasicState.ts
    ├── ChaseChoosePlatformState.ts   scores platforms, picks target, builds A* path
    ├── ChaseProceedToPlatformState.ts  follows path, detects arrival / stale opponent
    ├── StationState.ts               holds platform, fires, detects opponent row change
    ├── ChaseCrateState.ts            chases nearest crate; tryCreateCrateChase() helper
    ├── PonderState.ts                brief pause before next ChaseChoosePlatform cycle
    └── EvadeState.ts                 runs away after taking a hit
```

---

## 8. Known limitations / planned work

- **Platform scoring** — `preferredDistMin/Max` are used as a firing-range hint in
  `ChaseChoosePlatformState`, but profiles using `'chase'` currently set those fields
  to 0. A dedicated scoring weight for these profiles would sharpen platform selection.
- **BasicState nav** — no NavGraph usage; the drone can get stuck behind a wall when
  trying to maintain preferred distance. Considered low priority since `BasicState` is
  mainly a showcase profile.
- **Weapon** — a Chinese-lantern projectile (floating balloon that explodes with a
  firework effect) is planned as a new weapon type.
