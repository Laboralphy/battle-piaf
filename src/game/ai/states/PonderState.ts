import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { ChaseState } from './ChaseState.js';
import { Platform } from '../navigation/Platform.js';

/** Duration of the ponder pause in ticks (~0.5 s at 60 Hz). */
const PONDER_DURATION = 30;

/**
 * Ponder state: a deliberate pause where the drone steps back and reconsiders
 * its approach before committing to a new strategy.
 *
 * Triggered by ChaseState when the target has not been reached after a timeout.
 *
 * Tactical logic:
 *   1. Determine which platform the opponent is currently on.
 *   2. If there are other platforms at the same height, pick the one closest to
 *      the drone and set it as the interim navigation goal (future: StationState).
 *   3. For now always fall back to a fresh ChaseState after the pause — the
 *      topology query result is stored on ctx for ChaseState to reuse once a
 *      proper positioning state is available.
 */
export class PonderState implements IState<AIContext> {
    private _remaining = 0;

    onEnter(ctx: AIContext): void {
        this._remaining = PONDER_DURATION;
        this._analyse(ctx);
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        // Stand still while pondering.
        ctx.input.releaseAll();

        if (this._remaining <= 0) {
            return new ChaseState();
        }

        this._remaining--;
        return null;
    }

    onExit(_ctx: AIContext): void {}

    /**
     * Analyse the arena topology and log the tactical assessment.
     * Future: set a ctx.targetPlatform that ChaseState / a new StationState
     * will navigate toward instead of always heading directly at the opponent.
     */
    private _analyse(ctx: AIContext): void {
        const { topology, opponent } = ctx;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        const opponentPlatform = topology.platformAt(ox, oy);

        if (!opponentPlatform) {
            // Opponent is airborne — nothing useful to analyse right now.
            return;
        }

        const peers = topology.platformsAtSameHeight(opponentPlatform);
        if (peers.length === 0) {
            // Opponent is on the only platform at this height — no alternative.
            return;
        }

        // Pick the peer platform whose centre is closest to the drone.
        const px = ctx.player.oFlight.vPosition.x;
        let best: Platform | null = null;
        let bestDist = Infinity;
        for (const plat of peers) {
            const dist = Math.abs(plat.centerX - px);
            if (dist < bestDist) {
                bestDist = dist;
                best = plat;
            }
        }

        // `best` is the tactically preferred platform at the opponent's height.
        // TODO: navigate toward best.centerX instead of rushing at the opponent.
        void best;
    }
}
