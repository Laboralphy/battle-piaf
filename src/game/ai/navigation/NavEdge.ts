import { NavNode } from './NavNode.js';

/** How the AI traverses this edge. */
export const enum EdgeKind {
    /** Horizontal movement on the same platform. */
    Walk,
    /** Upward jump to reach a higher platform. */
    JumpUp,
    /**
     * Drop through a semi-solid (code 1) tile directly below.
     * Requires pressing the `down` key while grounded.
     * Only generated when the source node's floor tile has code 1.
     */
    DropThrough,
    /**
     * Walk off the edge of a platform and fall to a lower node.
     * No special input — just move horizontally until the player steps off.
     */
    FallOff,
}

/** A directed connection from one NavNode to another. */
export class NavEdge {
    readonly to: NavNode;
    readonly kind: EdgeKind;
    /** A* cost for traversing this edge. */
    readonly cost: number;

    constructor(to: NavNode, kind: EdgeKind) {
        this.to = to;
        this.kind = kind;
        this.cost =
            kind === EdgeKind.Walk       ? 1   :
            kind === EdgeKind.FallOff    ? 1.2 :
            kind === EdgeKind.DropThrough ? 1.5 :
            /* JumpUp */                   2;
    }
}
