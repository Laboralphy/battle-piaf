import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { Platform } from '../navigation/Platform.js';
import { NavEdge, EdgeKind } from '../navigation/NavEdge.js';
import { PonderState } from './PonderState.js';
import { StationState } from './StationState.js';
// Circular imports: body-only references resolved via live bindings.
import { ChaseChoosePlatformState } from './ChaseChoosePlatformState.js';
import { tryCreateCrateChase } from './ChaseCrateState.js';

/** Pixel tolerance for considering a waypoint "reached". */
const WAYPOINT_REACH_X = 24;
const WAYPOINT_REACH_Y = 36;

/** Ticks before giving up and returning to PonderState (~10 s at 60 Hz). */
const CHASE_TIMEOUT = 600;

/**
 * Path-execution state.
 *
 * Follows the A* edge list received from ChaseChoosePlatformState toward the
 * chosen station platform. Transitions:
 *
 *   → StationState          when the drone arrives on the target platform
 *   → ChaseChoosePlatformState  when the opponent changes platform row (path stale)
 *   → PonderState           when the timeout expires without arrival
 */
export class ChaseProceedToPlatformState implements IState<AIContext> {
    private _timer = 0;
    private _opponentRow = -1;

    private _path: NavEdge[];

    constructor(
        private readonly _platform: Platform | null,
        path: NavEdge[]
    ) {
        this._path = [...path];
    }

    onEnter(ctx: AIContext): void {
        this._timer = 0;
        const op = ctx.topology.platformAt(
            ctx.opponent.oFlight.vPosition.x,
            ctx.opponent.oFlight.vPosition.y
        );
        this._opponentRow = op?.row ?? -1;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        const { player, opponent, input, topology, profile } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        // Opportunistically chase any live crate that has spawned.
        const crateChase = tryCreateCrateChase(ctx);
        if (crateChase) {
            return crateChase;
        }

        // Transition: opponent moved to a different platform row — replan.
        const op = topology.platformAt(ox, oy);
        if (op !== null && op.row !== this._opponentRow) {
            return new ChaseChoosePlatformState();
        }

        // Transition: timeout — give up and ponder a new strategy.
        if (++this._timer >= CHASE_TIMEOUT) {
            return new PonderState();
        }

        // Transition: arrived on the target platform.
        if (this._platform !== null) {
            const current = topology.platformAt(px, py);
            if (current === this._platform && this._path.length === 0) {
                return new StationState(this._platform);
            }
        }

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
        } else if (this._platform !== null) {
            // Path exhausted but not confirmed on platform yet — move directly.
            this._moveDirect(ctx, this._platform.centerX, this._platform.y);
        }

        // Spontaneous random jump (profile-driven dodging).
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

        if (dx > 8) {
            input.pressRight();
        } else if (dx < -8) {
            input.pressLeft();
        }

        switch (kind) {
            case EdgeKind.JumpUp:
                if (player.bOnFloor) {
                    input.pressJump();
                }
                break;
            case EdgeKind.DropThrough:
                if (player.bOnFloor) {
                    input.pressDrop();
                }
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
