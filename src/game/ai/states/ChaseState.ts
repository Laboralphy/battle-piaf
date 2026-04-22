import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { EdgeKind } from '../navigation/NavEdge.js';
// Circular import: ChaseState ↔ AttackState reference each other only inside
// method bodies, so the JS module system resolves the cycle via live bindings.
import { AttackState } from './AttackState.js';
import { PonderState } from './PonderState.js';

/** Replan cooldown range in ticks (randomized each cycle to break repetition). */
const REPLAN_MIN = 10;
const REPLAN_MAX = 90;
/** Pixel tolerance for considering a waypoint "reached". */
const WAYPOINT_REACH_X = 24;
const WAYPOINT_REACH_Y = 36;
/** Ticks before giving up and transitioning to PonderState (~10 s at 60 Hz). */
const CHASE_TIMEOUT = 600;

/**
 * Chase state: navigate toward the opponent using A* over the NavGraph.
 *
 * Uses profile values for attack-range thresholds.
 * Transitions to AttackState when the opponent is within range, or to
 * PonderState when the target has not been reached after CHASE_TIMEOUT ticks.
 */
export class ChaseState implements IState<AIContext> {
    private _timer = 0;

    onEnter(ctx: AIContext): void {
        ctx.path = [];
        ctx.replanCooldown = 0;
        this._timer = 0;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        const { player, opponent, input, graph, query, profile } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        // Transition: close enough to engage.
        if (Math.abs(ox - px) < profile.attackRangeX && Math.abs(oy - py) < profile.attackRangeY) {
            return new AttackState();
        }

        // Transition: target not reached after timeout — step back and ponder.
        this._timer++;
        if (this._timer >= CHASE_TIMEOUT) {
            return new PonderState();
        }

        // Replan path periodically.
        if (ctx.replanCooldown <= 0) {
            const fromNode = graph.findBelow(px, py);
            const toNode = graph.findNearest(ox, oy);
            if (fromNode && toNode && fromNode !== toNode) {
                ctx.path = query.findPath(fromNode, toNode);
            }
            ctx.replanCooldown = REPLAN_MIN + Math.floor(Math.random() * (REPLAN_MAX - REPLAN_MIN));
        } else {
            ctx.replanCooldown--;
        }

        input.releaseAll();

        if (ctx.path.length > 0) {
            const edge = ctx.path[0];
            const wp = edge.to;

            if (player.bOnFloor && Math.abs(px - wp.x) < WAYPOINT_REACH_X && Math.abs(py - wp.y) < WAYPOINT_REACH_Y) {
                ctx.path.shift();
            } else {
                this._followEdge(ctx, edge.kind, wp.x, wp.y);
            }
        } else {
            this._moveDirect(ctx, ox, oy);
        }

        // Spontaneous random jump (profile-driven).
        if (
            profile.randomJumpChance > 0 &&
            player.bOnFloor &&
            Math.random() < profile.randomJumpChance
        ) {
            input.pressJump();
        }

        return null;
    }

    onExit(_ctx: AIContext): void {}

    private _followEdge(ctx: AIContext, kind: EdgeKind, tx: number, ty: number): void {
        const { player, input } = ctx;
        const dx = tx - player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;

        if (dx > 8) {
            input.pressRight();
        } else if (dx < -8) {
            input.pressLeft();
        }

        switch (kind) {
            case EdgeKind.JumpUp:
                // Jump as soon as grounded — no horizontal alignment check.
                // The JumpUp edge only exists when the target is within the jump
                // envelope, so horizontal movement during the jump carries the AI
                // there. Waiting to align first risks walking off the platform edge.
                if (player.bOnFloor) {
                    input.pressJump();
                }
                break;

            case EdgeKind.DropThrough:
                // Press down to fall through the semi-solid tile below.
                if (player.bOnFloor) {
                    input.pressDrop();
                }
                break;

            case EdgeKind.FallOff:
                // Just walk toward the edge — gravity does the rest.
                // No extra input needed beyond the horizontal movement above.
                break;

            // EdgeKind.Walk: horizontal movement above is sufficient.
        }
    }

    private _moveDirect(ctx: AIContext, tx: number, ty: number): void {
        const { player, input } = ctx;
        const dx = tx - player.oFlight.vPosition.x;
        const dy = ty - player.oFlight.vPosition.y;
        if (dx > 8) {
            input.pressRight();
        } else if (dx < -8) {
            input.pressLeft();
        }
        if (dy < -24 && player.bOnFloor) {
            input.pressJump();
        }
    }
}
