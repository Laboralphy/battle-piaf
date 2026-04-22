import { NavNode } from './NavNode.js';
import { TILE_SIZE } from './NavConsts';

/**
 * A platform is a group of horizontally adjacent NavNodes sharing the same row.
 * It is the basic unit of topology — a surface the player can stand on.
 */
export class Platform {
    /** All nodes that make up this platform, sorted left to right. */
    readonly nodes: NavNode[];
    /** Tile row of the floor tile. */
    readonly row: number;
    /** World-space y of a player standing on this platform (= row * TILE_SIZE). */
    readonly y: number;
    /** Left pixel boundary (left edge of leftmost tile). */
    readonly xMin: number;
    /** Right pixel boundary (right edge of rightmost tile). */
    readonly xMax: number;
    /** Platform width in pixels. */
    readonly width: number;
    /** Centre x of the platform in pixels. */
    readonly centerX: number;
    /**
     * True when all floor tiles are semi-solid (code 1) — the platform can be
     * dropped through from above.
     */
    readonly isSemiSolid: boolean;

    constructor(nodes: NavNode[], isSemiSolid: boolean) {
        this.nodes      = nodes;
        this.row        = nodes[0].row;
        this.y          = this.row * TILE_SIZE;
        this.xMin       = nodes[0].x - (TILE_SIZE >> 1);
        this.xMax       = nodes[nodes.length - 1].x + (TILE_SIZE >> 1);
        this.width      = this.xMax - this.xMin;
        this.centerX    = (this.xMin + this.xMax) >> 1;
        this.isSemiSolid = isSemiSolid;
    }

    /** True if the given pixel x falls within this platform's horizontal span. */
    containsX(px: number): boolean {
        return px >= this.xMin && px <= this.xMax;
    }

    /** Number of tiles this platform spans. */
    get tileWidth(): number {
        return this.nodes.length;
    }
}
