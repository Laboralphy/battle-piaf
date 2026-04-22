import { NavEdge } from './NavEdge.js';
import { TILE_SIZE } from './NavConsts';

/**
 * A standable position in the arena, derived from the tile map.
 * Each node corresponds to one floor tile that has open space directly above it.
 */
export class NavNode {
    /** Tile column (0–19). */
    readonly col: number;
    /** Tile row of the floor tile (0–14). */
    readonly row: number;
    /** World-space pixel x at the horizontal centre of this tile. */
    readonly x: number;
    /**
     * World-space pixel y of the player's feet when standing on this tile.
     * Equals `row * TILE_SIZE` — the top pixel of the floor tile.
     */
    readonly y: number;
    /** Outgoing edges to reachable neighbour nodes. */
    readonly edges: NavEdge[] = [];

    constructor(col: number, row: number) {
        this.col = col;
        this.row = row;
        this.x = col * TILE_SIZE + (TILE_SIZE >> 1);
        this.y = row * TILE_SIZE;
    }
}
