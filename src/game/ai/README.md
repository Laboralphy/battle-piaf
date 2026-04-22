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

| Constant             | Value           |
|----------------------|-----------------|
| Jump speed (upward)  | 6.9 px/tick     |
| Gravity              | 0.25 px/tick²   |
| Max jump height      | ~95 px (≈3 tiles)|
| Player horizontal speed | 3 px/tick    |
| Max horizontal reach | ~165 px         |
| Semi-solid snap zone | 16 px           |

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
The reconstructed path is stored in `ctx.path` and consumed front-to-back by `ChaseState`.

### 1.6 Platform — `navigation/Platform.ts`

A group of horizontally contiguous same-row nodes forming one surface.

```
platform.row        // tile row
platform.y          // world-space y of the surface (feet level)
platform.xMin/xMax  // pixel boundaries (left edge of leftmost / right edge of rightmost tile)
platform.centerX    // pixel centre of the platform
platform.width      // pixel width
platform.isSemiSolid // true when every tile in the platform has code 1
platform.containsX(px)  // true when px is within the horizontal span
```

### 1.7 NavTopology — `navigation/NavTopology.ts`

Groups all NavNodes into `Platform` objects and exposes arena-level spatial queries.
Built once with `topology.build(graph.nodes, land)` during `AIController` construction.

**Building logic:**
1. Nodes are grouped by row.
2. Within each row, nodes are sorted by column, then split into runs where
   consecutive columns differ by more than 1 (gap in the platform).
3. Each run becomes one `Platform`. `isSemiSolid` is true only when every tile in the
   run has code 1.

**Queries:**

| Method                          | Returns                                                         |
|---------------------------------|-----------------------------------------------------------------|
| `platformAt(px, py)`            | Platform the entity stands on, or `null` if airborne           |
| `platformOf(node)`              | Platform that owns a specific NavNode                          |
| `platformsAtRow(row)`           | All platforms at a given tile row                              |
| `platformsAtSameHeight(ref)`    | All platforms at the same row as `ref`, excluding `ref` itself |
| `isAirborne(px, py)`            | `true` when no platform contains the position                  |

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

Read-only world snapshot plus mutable state fields, passed to every `IState` each tick.

```typescript
interface AIContext {
    player:        WDPlayer;          // the drone
    opponent:      WDPlayer;          // the human player
    input:         AIInput;           // virtual keyboard the state writes to
    land:          FairyMatrix;       // arena tile map
    graph:         NavGraph;
    query:         NavQuery;
    topology:      NavTopology;
    path:          NavEdge[];         // current A* path (mutable, consumed by ChaseState)
    replanCooldown: number;           // ticks before next replan
    profile:       AIProfile;        // active personality (read-only)
    debugCanvas?:  HTMLCanvasElement; // optional overlay for NavGraph visualisation
}
```

### 2.4 AIInput — `AIInput.ts`

Extends `FairyInputState` (the same type the human keyboard produces) so it can be
passed directly to `player.updateState()`.

States call these each tick:

```typescript
input.releaseAll()   // clear all keys at the start of each tick
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
                   ┌──────────────────────────────────────────────┐
                   │               [hit received]                  │
                   │         (only if evadeOnHit=true)             ▼
  [start] ──► NullState     EvadeState ◄──────────── any state
                   │              │
  [start] ──► BasicState         └── timer expired ──► ChaseState
                   │                                        │
  [start] ──► ChaseState ◄── PonderState                   │
                   │              ▲                         │
                   │         timeout (600 t)                │
                   │              │                         ▼
                   └──────────────┘              AttackState
                                                      │
                                              disengage range
                                                      │
                                                      ▼
                                                 ChaseState
```

### 3.1 NullState — `states/NullState.ts`

Releases all keys every tick. Never transitions. Used by `PROFILE_NULL` for testing.

### 3.2 BasicState — `states/BasicState.ts`

Ranged-shooter behavior. Does not use NavGraph or A*.

Each tick:
1. **Horizontal positioning** — maintain `preferredDistMin`–`preferredDistMax` from opponent.
   - Too close → back away (with 32 px hysteresis to avoid flip-flopping on the boundary).
   - Too far → approach.
   - In band → hold.
2. **Vertical** — jump when opponent is >32 px higher.
3. **Fire** — only while in the distance band; cooldown resets when out of position so
   the first shot after repositioning fires immediately.
4. **Random jumps** — controlled by `profile.randomJumpChance`.

Never transitions to another state.

### 3.3 ChaseState — `states/ChaseState.ts`

Navigates toward the opponent using A* over the NavGraph.

**Each tick:**
1. Check attack range → transition to `AttackState` if `|dx| < attackRangeX && |dy| < attackRangeY`.
2. Increment timeout timer → transition to `PonderState` after 600 ticks.
3. Replan path every 10–90 ticks (randomised to break repetition).
4. Advance to the next waypoint when `bOnFloor && |dx| < 24 && |dy| < 36`.
5. Follow the current edge kind:
   - `Walk` — horizontal movement only.
   - `JumpUp` — jump immediately on grounding, no prior alignment check.
   - `DropThrough` — press `down` when grounded.
   - `FallOff` — horizontal movement only (gravity does the rest).
6. If no path exists, move directly toward the opponent.
7. Spontaneous random jump per `profile.randomJumpChance`.

### 3.4 ChaseDebugState — `states/ChaseDebugState.ts`

Extends `ChaseState`. After each tick, draws a debug overlay on `ctx.debugCanvas`:
- All edges, colour-coded by kind (semi-transparent).
- All nodes as dots.
- Current A* path as a white line.
- `fromNode` (drone's platform) in cyan; `toNode` (opponent's platform) in red.
- Drone and opponent positions as crosses.
- Legend.

Activate with `initialState: 'chase-debug'` in the profile.

### 3.5 AttackState — `states/AttackState.ts`

Stay near the opponent and fire repeatedly.
- Minimum dwell: 30 ticks before reconsidering distance.
- Fires on `profile.fireCooldown` interval.
- Drifts horizontally toward the opponent; jumps if opponent is >32 px higher.
- Returns to `ChaseState` when `|dx| > disengageX || |dy| > disengageY`.

### 3.6 EvadeState — `states/EvadeState.ts`

Move away from the opponent for `profile.evadeDuration` ticks.
- Triggered externally by `AIController` on the `'damaged'` observer event.
- Random jump chance is `max(profile.randomJumpChance, 0.05)` to dodge follow-up shots.
- Returns to `ChaseState` when timer expires.

### 3.7 PonderState — `states/PonderState.ts`

A deliberate 30-tick pause (≈0.5 s) triggered by `ChaseState` timeout.
The drone stands still while the `_analyse()` method:
1. Finds the opponent's current platform via `topology.platformAt()`.
2. Finds all peer platforms at the same height via `topology.platformsAtSameHeight()`.
3. Identifies the peer closest to the drone — this is the **tactically preferred position**.

Currently always returns to `ChaseState` after the pause.
**Future:** navigate toward the identified platform instead of rushing directly at the opponent.

---

## 4. AIProfile — `AIProfile.ts`

A profile is a plain object that tunes all behavior parameters. It is set at
construction time and never changes during a match.

```typescript
interface AIProfile {
    name:             string;
    initialState:     'null' | 'basic' | 'chase' | 'chase-debug';
    preferredDistMin: number;   // px — BasicState: start backing below this
    preferredDistMax: number;   // px — BasicState: approach above this
    attackRangeX:     number;   // px — ChaseState → AttackState trigger
    attackRangeY:     number;   // px
    disengageX:       number;   // px — AttackState → ChaseState trigger
    disengageY:       number;   // px
    fireCooldown:     number;   // ticks between shots
    evadeOnHit:       boolean;  // trigger EvadeState on hit?
    evadeDuration:    number;   // ticks of evasion
    randomJumpChance: number;   // probability per tick of a spontaneous jump (0–1)
}
```

### Preset profiles

| Profile          | Strategy     | Behaviour                                                |
|------------------|--------------|----------------------------------------------------------|
| `PROFILE_NULL`   | `null`       | Does nothing. For isolated testing.                      |
| `PROFILE_BASIC`  | `basic`      | Ranged shooter, stays 4–6 tiles away, hops to dodge.    |
| `PROFILE_HUNTER` | `chase`      | Aggressive chaser, evades after being hit.               |
| `PROFILE_BERSERKER` | `chase`   | Maximum aggression, never evades, high fire rate.        |
| `PROFILE_CAUTIOUS` | `chase`    | Large attack range, long evasion, random dodges.         |

---

## 5. AIController — `AIController.ts`

Entry point. Owns the FSM, the nav system, and the virtual input.

```typescript
new AIController(player, opponent, land, keys, profile, debugCanvas?)
```

Construction sequence:
1. Create `AIInput` with the player's key bindings.
2. `NavGraph.build(land)` — scan tile map, build nodes and edges.
3. `NavTopology.build(graph.nodes, land)` — group nodes into platforms.
4. Populate `AIContext`.
5. Create `StateMachine`, transition to `_initialState(profile)`.
6. If `profile.evadeOnHit`, attach an `Observer` on the player's `'damaged'` event that
   immediately transitions to `EvadeState`.

Per tick: `aiController.update()` → `fsm.update()` → active state ticks.

---

## 6. Integration in WDGame

```typescript
// Initialisation
this._aiController = new AIController(
    this._players[1],   // drone
    this._players[0],   // human
    this._land,
    PLAYER_KEYS[1],
    PROFILE_NULL        // change profile here to enable AI
);

// Each tick (stateGameRunning)
if (player.nCode === 1 && this._aiController) {
    this._aiController.update();
    player.updateState(this._aiController.input);
} else {
    player.updateState(this._input);
}
```

To activate a different profile, replace `PROFILE_NULL` with any of the preset
profiles imported from `AIProfile.ts`.

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
│   ├── NavConsts.ts       TILE_SIZE = 32
│   ├── NavNode.ts
│   ├── NavEdge.ts         EdgeKind enum + cost table
│   ├── NavGraph.ts        build() + findNearest() + findBelow()
│   ├── NavQuery.ts        A* → NavEdge[]
│   ├── Platform.ts
│   └── NavTopology.ts     build() + platformAt() + platformsAtSameHeight() …
└── states/
    ├── NullState.ts
    ├── BasicState.ts
    ├── ChaseState.ts
    ├── ChaseDebugState.ts
    ├── AttackState.ts
    ├── EvadeState.ts
    └── PonderState.ts
```

---

## 8. Known limitations / planned work

- **PonderState tactical routing** — `_analyse()` identifies the best same-height
  platform but currently still falls back to `ChaseState`. A future `StationState`
  will navigate the drone to that position and hold it.
- **Positioning in BasicState** — no NavGraph usage; the drone may get stuck behind
  a wall when trying to maintain preferred distance.
- **Weapon** — a Chinese-lantern projectile (floating balloon that explodes with a
  firework effect) is planned as a new weapon type.
