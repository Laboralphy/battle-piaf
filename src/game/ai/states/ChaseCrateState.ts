import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { WDCrate } from '../../WDCrate.js';
import { NavEdge, EdgeKind } from '../navigation/NavEdge.js';
// Body-only circular imports resolved via live bindings.
import { ChaseChoosePlatformState } from './ChaseChoosePlatformState.js';
import { PonderState } from './PonderState.js';

/**
 * Shared helper: if any live crate exists, return a ChaseCrateState targeting
 * the closest one. Returns null when no crates are present.
 * Call this from any state that should opportunistically react to a crate spawn.
 */
export function tryCreateCrateChase(ctx: AIContext): ChaseCrateState | null {
    const liveCrates = ctx.crates().filter(c => !c.bDead);
    if (liveCrates.length === 0) {
        return null;
    }
    const px = ctx.player.oFlight.vPosition.x;
    const py = ctx.player.oFlight.vPosition.y;
    let best = liveCrates[0];
    let bestDist = Infinity;
    for (const crate of liveCrates) {
        const dx = crate.oFlight.vPosition.x - px;
        const dy = crate.oFlight.vPosition.y - py;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
            bestDist = dist;
            best = crate;
        }
    }
    const fromNode = ctx.graph.findBelow(px, py);
    const toNode = ctx.graph.findNearest(best.oFlight.vPosition.x, best.oFlight.vPosition.y);
    const path =
        fromNode && toNode && fromNode !== toNode
            ? ctx.query.findPath(fromNode, toNode)
            : [];
    return new ChaseCrateState(best, path);
}

/** Pixel tolerance for considering a waypoint reached. */
const WAYPOINT_REACH_X = 24;
const WAYPOINT_REACH_Y = 36;
/** Ticks before giving up and returning to PonderState. */
const CHASE_TIMEOUT = 600;

/**
 * Navigate toward a live crate and pick it up.
 *
 * The crate pickup itself is handled by WDGame's collision system — this state
 * only needs to steer the drone close enough. The drone does not fire while
 * chasing a crate.
 *
 * Transitions:
 *   → ChaseChoosePlatformState  if the crate disappears (picked up or expired)
 *   → PonderState               on timeout
 */
export class ChaseCrateState implements IState<AIContext> {
    private _path: NavEdge[];
    private _timer = 0;

    constructor(
        private readonly _crate: WDCrate,
        path: NavEdge[]
    ) {
        this._path = [...path];
    }

    onEnter(_ctx: AIContext): void {
        this._timer = 0;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        // Crate was collected or expired — resume normal behavior.
        if (this._crate.bDead) {
            return new ChaseChoosePlatformState();
        }

        if (++this._timer >= CHASE_TIMEOUT) {
            return new PonderState();
        }

        const { player, input } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const cx = this._crate.oFlight.vPosition.x;
        const cy = this._crate.oFlight.vPosition.y;

        input.releaseAll();

        if (this._path.length > 0) {
            const edge = this._path[0];
            const wp = edge.to;
            if (
                player.bOnFloor &&
                Math.abs(px - wp.x) < WAYPOINT_REACH_X &&
                Math.abs(py - wp.y) < WAYPOINT_REACH_Y
            ) {
                this._path.shift();
            } else {
                this._followEdge(ctx, edge.kind, wp.x, wp.y);
            }
        } else {
            // Path exhausted — move directly toward the crate.
            this._moveDirect(ctx, cx, cy);
        }

        return null;
    }

    onExit(_ctx: AIContext): void {}

    private _followEdge(ctx: AIContext, kind: EdgeKind, tx: number, ty: number): void {
        const { player, input } = ctx;
        const dx = tx - player.oFlight.vPosition.x;
        if (dx > 8) input.pressRight();
        else if (dx < -8) input.pressLeft();

        switch (kind) {
            case EdgeKind.JumpUp:
                if (player.bOnFloor) input.pressJump();
                break;
            case EdgeKind.DropThrough:
                if (player.bOnFloor) input.pressDrop();
                break;
            case EdgeKind.FallOff:
            default:
                break;
        }
    }

    private _moveDirect(ctx: AIContext, tx: number, ty: number): void {
        const { player, input } = ctx;
        const dx = tx - player.oFlight.vPosition.x;
        const dy = ty - player.oFlight.vPosition.y;

        // When the crate is below, use a near-zero dead zone so the drone
        // keeps walking toward the edge and falls off rather than stopping short.
        const deadZone = dy > 16 ? 1 : 8;
        if (dx > deadZone) input.pressRight();
        else if (dx < -deadZone) input.pressLeft();

        if (dy < -24 && player.bOnFloor) input.pressJump();

        // Drop through a semi-solid platform when the crate is directly below.
        if (dy > 16 && player.bOnFloor) input.pressDrop();
    }
}
