import { FairyMatrix } from '../../../engine/FairyMatrix.js';
import { NavNode } from './NavNode.js';
import { Platform } from './Platform.js';
import { TILE_SIZE } from './NavConsts';

/**
 * Topology layer built on top of the NavGraph.
 *
 * Groups NavNodes into Platform objects (horizontally contiguous same-row
 * nodes) and exposes spatial queries that let states reason about the arena
 * layout rather than individual tiles.
 *
 * Call `build()` once after NavGraph.build() has populated its node list.
 */
export class NavTopology {
    readonly platforms: Platform[] = [];

    /**
     * Derive platforms from the node list.
     * Nodes are grouped by row; within each row, nodes whose columns are
     * adjacent (colDiff ≤ 1) are merged into one Platform.
     * A platform is marked semi-solid only when every one of its floor tiles
     * has tile code 1.
     */
    build(nodes: NavNode[], land: FairyMatrix): void {
        this.platforms.length = 0;

        // Group nodes by row.
        const byRow = new Map<number, NavNode[]>();
        for (const node of nodes) {
            let bucket = byRow.get(node.row);
            if (!bucket) {
                bucket = [];
                byRow.set(node.row, bucket);
            }
            bucket.push(node);
        }

        // For each row, sort by column and split into runs of adjacent tiles.
        for (const [row, rowNodes] of byRow) {
            rowNodes.sort((a, b) => a.col - b.col);

            let run: NavNode[] = [rowNodes[0]];

            const flushRun = (): void => {
                const isSemiSolid = run.every(n => this._tileCode(land, n.col, n.row) === 1);
                this.platforms.push(new Platform(run, isSemiSolid));
            };

            for (let i = 1; i < rowNodes.length; i++) {
                if (rowNodes[i].col - rowNodes[i - 1].col <= 1) {
                    run.push(rowNodes[i]);
                } else {
                    flushRun();
                    run = [rowNodes[i]];
                }
            }
            flushRun();

            void row; // used implicitly via node.row inside Platform constructor
        }
    }

    /**
     * Return the platform the entity is currently standing on.
     * Matches when the entity's pixel y is within half a tile of the platform's
     * y (top of floor tile) and the entity's x falls within the platform's span.
     * Returns null when the entity appears to be airborne.
     */
    platformAt(px: number, py: number): Platform | null {
        const tolerance = TILE_SIZE >> 1;
        for (const plat of this.platforms) {
            if (Math.abs(py - plat.y) <= tolerance && plat.containsX(px)) {
                return plat;
            }
        }
        return null;
    }

    /**
     * Return the platform that owns the given NavNode, or null if not found.
     */
    platformOf(node: NavNode): Platform | null {
        for (const plat of this.platforms) {
            if (plat.row === node.row) {
                for (const n of plat.nodes) {
                    if (n === node) {
                        return plat;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Return all platforms sharing the given tile row.
     */
    platformsAtRow(row: number): Platform[] {
        return this.platforms.filter(p => p.row === row);
    }

    /**
     * Return all platforms at the same row as the reference platform,
     * excluding the reference platform itself.
     */
    platformsAtSameHeight(ref: Platform): Platform[] {
        return this.platforms.filter(p => p.row === ref.row && p !== ref);
    }

    /**
     * True when no platform contains the given position — entity is airborne.
     */
    isAirborne(px: number, py: number): boolean {
        return this.platformAt(px, py) === null;
    }

    private _tileCode(land: FairyMatrix, col: number, row: number): number {
        try {
            return land.getTileCode(col, row);
        } catch {
            return 0;
        }
    }
}
