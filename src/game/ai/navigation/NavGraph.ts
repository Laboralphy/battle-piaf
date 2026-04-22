import { FairyMatrix } from '../../../engine/FairyMatrix.js';
import { NavNode } from './NavNode.js';
import { NavEdge, EdgeKind } from './NavEdge.js';
import { TILE_SIZE } from './NavConsts';

/**
 * Player physics constants (mirrors WDPlayer / WDPlayerFlight).
 * Used to compute reachable jump distances between nodes.
 */
const JUMP_SPEED = 6.9; // px/tick (upward initial speed)
const GRAVITY = 0.25; // px/tick²
/** Maximum height the player can reach in a single jump (px). */
const MAX_JUMP_HEIGHT = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY); // ~95 px ≈ 2.97 tiles
/** Ticks to reach apex. */
const TICKS_TO_APEX = JUMP_SPEED / GRAVITY; // ~27.6 ticks
/** Horizontal player speed (px/tick). */
const PLAYER_SPEED = 3;
/** Max horizontal reach during a full ascent (one side). */
const MAX_JUMP_HORIZONTAL = PLAYER_SPEED * TICKS_TO_APEX * 2; // ~165 px
/**
 * Semi-solid platforms snap the player onto their surface when the player's
 * feet enter the top 16 px of the tile from below.
 * This adds 16 px of effective upward reach when the target tile is semi-solid.
 */
const SEMI_SOLID_SNAP_ZONE = 16; // px

/**
 * Navigation graph for the arena.
 * Nodes are standable tile positions; edges encode walk, jump, and drop connections.
 * Call `build()` once after the tile map is populated.
 */
export class NavGraph {
    readonly nodes: NavNode[] = [];

    /**
     * Scan the tile map and build the full node/edge graph.
     * A tile at (col, row) becomes a node when its code ≥ 1 and the tile directly
     * above (row−1) has code 0 (open space the player can stand in).
     */
    build(land: FairyMatrix): void {
        this.nodes.length = 0;

        for (let row = 1; row <= 14; row++) {
            for (let col = 0; col < 20; col++) {
                let floorCode = 0;
                let aboveCode = 0;
                try {
                    floorCode = land.getTileCode(col, row);
                } catch {
                    continue;
                }
                try {
                    aboveCode = land.getTileCode(col, row - 1);
                } catch {
                    continue;
                }
                if (floorCode >= 1 && aboveCode === 0) {
                    this.nodes.push(new NavNode(col, row));
                }
            }
        }

        this._buildEdges(land);
    }

    /**
     * Return the node whose centre is closest (Euclidean) to `(px, py)`.
     * Returns null only when the graph is empty.
     */
    findNearest(px: number, py: number): NavNode | null {
        if (this.nodes.length === 0) {
            return null;
        }
        let best = this.nodes[0];
        let bestSq = Infinity;
        for (const node of this.nodes) {
            const dx = node.x - px;
            const dy = node.y - py;
            const sq = dx * dx + dy * dy;
            if (sq < bestSq) {
                bestSq = sq;
                best = node;
            }
        }
        return best;
    }

    /**
     * Return the node directly below `(px, py)` — i.e. the nearest node whose
     * x is within one tile and whose y is ≥ py (at or below the position).
     * Falls back to `findNearest` when no such node exists.
     */
    findBelow(px: number, py: number): NavNode | null {
        let best: NavNode | null = null;
        let bestDy = Infinity;
        for (const node of this.nodes) {
            if (Math.abs(node.x - px) > TILE_SIZE) {
                continue;
            }
            const dy = node.y - py;
            if (dy >= 0 && dy < bestDy) {
                bestDy = dy;
                best = node;
            }
        }
        return best ?? this.findNearest(px, py);
    }

    // ── Edge construction ────────────────────────────────────────────────────

    private _buildEdges(land: FairyMatrix): void {
        for (const a of this.nodes) {
            // The tile code of a's floor determines whether drop-through is possible.
            const aFloorCode = this._tileCode(land, a.col, a.row);

            for (const b of this.nodes) {
                if (a === b) {
                    continue;
                }

                const dx = Math.abs(b.x - a.x);
                // dy > 0 means b is lower on screen (larger y = further down).
                const dy = b.y - a.y;

                // Walk: same platform row, adjacent tile.
                if (a.row === b.row && dx <= TILE_SIZE) {
                    a.edges.push(new NavEdge(b, EdgeKind.Walk));
                    continue;
                }

                // Jump up: b is higher, within the physics-derived jump envelope.
                // For semi-solid targets (code 1) the player is snapped up onto the
                // surface as soon as their feet enter the top SEMI_SOLID_SNAP_ZONE px
                // of the tile, so the required jump height is reduced by that amount.
                if (dy < 0 && dx <= MAX_JUMP_HORIZONTAL) {
                    const bFloorCode = this._tileCode(land, b.col, b.row);
                    const snapBonus = bFloorCode === 1 ? SEMI_SOLID_SNAP_ZONE : 0;
                    if (-dy <= MAX_JUMP_HEIGHT * 0.95 + snapBonus) {
                        a.edges.push(new NavEdge(b, EdgeKind.JumpUp));
                        continue;
                    }
                }

                // Downward connections — b is below a.
                if (dy > 0 && dx <= MAX_JUMP_HORIZONTAL) {
                    if (dx < TILE_SIZE) {
                        // Same column: the only way down is through the floor tile.
                        // This is only possible when that tile is semi-solid (code 1).
                        // Full-solid (code ≥ 2) tiles cannot be dropped through.
                        if (aFloorCode === 1) {
                            a.edges.push(new NavEdge(b, EdgeKind.DropThrough));
                        }
                        // Full-solid: no edge — the player must walk to an edge instead.
                    } else {
                        // Horizontal offset: the player walks off the platform edge and falls.
                        a.edges.push(new NavEdge(b, EdgeKind.FallOff));
                    }
                }
            }
        }
    }

    /** Return a tile code, or 0 if the coordinates are out of range. */
    private _tileCode(land: FairyMatrix, col: number, row: number): number {
        try {
            return land.getTileCode(col, row);
        } catch {
            return 0;
        }
    }
}
