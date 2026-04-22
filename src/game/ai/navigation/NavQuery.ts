import { NavNode } from './NavNode.js';
import { NavEdge } from './NavEdge.js';

/** Internal A* search entry. */
interface SearchEntry {
    node: NavNode;
    g: number;
    f: number;
    prev: SearchEntry | null;
    /** Edge that was used to reach this node. */
    edge: NavEdge | null;
}

/**
 * A* pathfinder over a NavGraph.
 * Returns a list of edges to traverse — the `to` field of each edge is the
 * next waypoint, in order from the current position to the destination.
 */
export class NavQuery {
    /**
     * Find a path from `from` to `to`.
     *
     * @returns Ordered list of edges to follow.  Empty when already at the
     *          destination or when no path exists.
     */
    findPath(from: NavNode, to: NavNode): NavEdge[] {
        if (from === to) {
            return [];
        }

        const open = new Map<NavNode, SearchEntry>();
        const closed = new Set<NavNode>();

        open.set(from, { node: from, g: 0, f: this._h(from, to), prev: null, edge: null });

        while (open.size > 0) {
            // Pop the open entry with the lowest f score.
            let current: SearchEntry | null = null;
            for (const entry of open.values()) {
                if (!current || entry.f < current.f) {
                    current = entry;
                }
            }
            if (!current) {
                break;
            }
            if (current.node === to) {
                return this._reconstruct(current);
            }

            open.delete(current.node);
            closed.add(current.node);

            for (const edge of current.node.edges) {
                const neighbour = edge.to;
                if (closed.has(neighbour)) {
                    continue;
                }
                const g = current.g + edge.cost;
                const existing = open.get(neighbour);
                if (!existing || g < existing.g) {
                    open.set(neighbour, {
                        node: neighbour,
                        g,
                        f: g + this._h(neighbour, to),
                        prev: current,
                        edge,
                    });
                }
            }
        }

        return []; // no path found
    }

    private _h(a: NavNode, b: NavNode): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private _reconstruct(entry: SearchEntry): NavEdge[] {
        const path: NavEdge[] = [];
        let e: SearchEntry | null = entry;
        while (e && e.edge) {
            path.unshift(e.edge);
            e = e.prev;
        }
        return path;
    }
}
