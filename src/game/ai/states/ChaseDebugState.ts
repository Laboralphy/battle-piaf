import { AIContext } from '../AIContext.js';
import { ChaseState } from './ChaseState.js';
import { IState } from '../fsm/IState.js';
import { EdgeKind } from '../navigation/NavEdge.js';
import { NavNode } from '../navigation/NavNode.js';

/** Stroke colour per edge kind. */
const EDGE_COLORS: Record<EdgeKind, string> = {
    [EdgeKind.Walk]: '#00cc44', // green
    [EdgeKind.JumpUp]: '#4488ff', // blue
    [EdgeKind.DropThrough]: '#ff8800', // orange
    [EdgeKind.FallOff]: '#ffee00', // yellow
};

/**
 * Debug overlay for ChaseState.
 * Extends ChaseState so all navigation logic runs unchanged.
 * After each tick, draws the NavGraph onto `ctx.debugCanvas` when provided:
 *
 *   - All edges, colour-coded by kind (semi-transparent)
 *   - All nodes as small dots
 *   - Current A* path as a bright white line from the AI's feet
 *   - "From" node (nearest below AI) in cyan
 *   - "To" node (nearest to opponent) in red
 *   - AI position in cyan, opponent position in red
 */
export class ChaseDebugState extends ChaseState {
    override onUpdate(ctx: AIContext): IState<AIContext> | null {
        const next = super.onUpdate(ctx);
        this._draw(ctx);
        return next;
    }

    private _draw(ctx: AIContext): void {
        const canvas = ctx.debugCanvas;
        if (!canvas) {
            return;
        }
        const dc = canvas.getContext('2d');
        if (!dc) {
            return;
        }

        dc.clearRect(0, 0, canvas.width, canvas.height);

        const { graph, player, opponent } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        // ── All edges (semi-transparent, colour by kind) ──────────────────
        dc.lineWidth = 1;
        dc.globalAlpha = 0.25;
        const edges: Set<EdgeKind> = new Set([
            // EdgeKind.DropThrough,
            EdgeKind.JumpUp,
            // EdgeKind.FallOff,
            // EdgeKind.Walk,
        ]);
        for (const node of graph.nodes) {
            for (const edge of node.edges) {
                if (edges.has(edge.kind)) {
                    dc.strokeStyle = EDGE_COLORS[edge.kind];
                    dc.beginPath();
                    dc.moveTo(node.x, node.y);
                    dc.lineTo(edge.to.x, edge.to.y);
                    dc.stroke();
                }
            }
        }

        // ── All nodes ─────────────────────────────────────────────────────
        dc.globalAlpha = 0.6;
        dc.fillStyle = '#ffffff';
        for (const node of graph.nodes) {
            dc.beginPath();
            dc.arc(node.x, node.y, 3, 0, Math.PI * 2);
            dc.fill();
        }

        // ── Highlight fromNode and toNode ─────────────────────────────────
        const fromNode = graph.findBelow(px, py);
        const toNode = graph.findNearest(ox, oy);
        dc.globalAlpha = 1;
        this._drawNode(dc, fromNode, '#00ffff', 6); // cyan = AI's platform
        this._drawNode(dc, toNode, '#ff4444', 6); // red  = target platform

        // ── Current A* path ───────────────────────────────────────────────
        if (ctx.path.length > 0) {
            dc.strokeStyle = '#ffffff';
            dc.lineWidth = 2;
            dc.globalAlpha = 0.9;
            dc.beginPath();
            dc.moveTo(px, py);
            for (const edge of ctx.path) {
                dc.lineTo(edge.to.x, edge.to.y);
            }
            dc.stroke();
        }

        // ── Player and opponent positions ─────────────────────────────────
        dc.globalAlpha = 1;
        this._drawCross(dc, px, py, '#00ffff', 8); // cyan = AI
        this._drawCross(dc, ox, oy, '#ff4444', 8); // red  = opponent

        // ── Legend ───────────────────────────────────────────────────────
        this._drawLegend(dc);

        dc.globalAlpha = 1;
    }

    private _drawNode(
        dc: CanvasRenderingContext2D,
        node: NavNode | null,
        color: string,
        r: number
    ): void {
        if (!node) {
            return;
        }
        dc.fillStyle = color;
        dc.beginPath();
        dc.arc(node.x, node.y, r, 0, Math.PI * 2);
        dc.fill();
    }

    private _drawCross(
        dc: CanvasRenderingContext2D,
        x: number,
        y: number,
        color: string,
        size: number
    ): void {
        dc.strokeStyle = color;
        dc.lineWidth = 2;
        dc.beginPath();
        dc.moveTo(x - size, y);
        dc.lineTo(x + size, y);
        dc.moveTo(x, y - size);
        dc.lineTo(x, y + size);
        dc.stroke();
    }

    private _drawLegend(dc: CanvasRenderingContext2D): void {
        const entries: [string, string][] = [
            [EDGE_COLORS[EdgeKind.Walk], 'Walk'],
            [EDGE_COLORS[EdgeKind.JumpUp], 'JumpUp'],
            [EDGE_COLORS[EdgeKind.DropThrough], 'DropThrough'],
            [EDGE_COLORS[EdgeKind.FallOff], 'FallOff'],
        ];
        dc.font = '11px monospace';
        dc.globalAlpha = 0.85;
        let y = 14;
        for (const [color, label] of entries) {
            dc.fillStyle = color;
            dc.fillRect(6, y - 9, 14, 10);
            dc.fillStyle = '#ffffff';
            dc.fillText(label, 24, y);
            y += 14;
        }
    }
}
