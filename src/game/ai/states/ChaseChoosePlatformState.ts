import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { Platform } from '../navigation/Platform.js';
import { NavEdge } from '../navigation/NavEdge.js';
import { ChaseProceedToPlatformState } from './ChaseProceedToPlatformState.js';
import { PonderState } from './PonderState.js';

/**
 * Single-tick decision state.
 *
 * Reads the arena topology, scores all candidate platforms at the opponent's
 * height, picks the best one as a firing station, computes an A* path to it,
 * and immediately hands both to ChaseProceedToPlatformState via constructor
 * injection. No movement is produced in this state.
 *
 * Platform scoring (higher = better):
 *   - Distance from opponent close to the profile's preferred firing range
 *   - Wider platform preferred (more room to dodge)
 *   - Closer to the drone preferred (cheaper path)
 */
export class ChaseChoosePlatformState implements IState<AIContext> {
    onEnter(_ctx: AIContext): void {}

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        const platform = this._choosePlatform(ctx);
        const path = platform ? this._computePath(ctx, platform) : [];
        return new ChaseProceedToPlatformState(platform ?? this._currentPlatform(ctx), path);
    }

    onExit(_ctx: AIContext): void {}

    // ── Platform selection ─────────────────────────────────────────────────

    private _choosePlatform(ctx: AIContext): Platform | null {
        const { topology, opponent, player, profile } = ctx;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;
        const px = player.oFlight.vPosition.x;

        const opponentPlatform = topology.platformAt(ox, oy);
        if (!opponentPlatform) {
            // Opponent is airborne — no stable reference to score against.
            return this._currentPlatform(ctx);
        }

        const peers = topology.platformsAtSameHeight(opponentPlatform);
        if (peers.length === 0) {
            // No alternative platform at this height (e.g. opponent on ground floor).
            // Fall back to the opponent's own platform so the drone still navigates
            // toward the target rather than standing pat indefinitely.
            console.log('ChaseChoosePlatformState: no peers, targeting opponent platform', opponentPlatform.row);
            return opponentPlatform;
        }

        const idealDist = (profile.preferredDistMin + profile.preferredDistMax) / 2;

        let best: Platform | null = null;
        let bestScore = -Infinity;

        for (const plat of peers) {
            const horizDist = Math.abs(plat.centerX - ox);
            // Core: prefer platforms at the ideal firing distance from opponent.
            const distScore = -Math.abs(horizDist - idealDist);
            // Minor: wider platforms give more room to dodge incoming missiles.
            const widthScore = plat.width * 0.05;
            // Minor: prefer platforms already close to the drone (shorter path).
            const proximityScore = -Math.abs(plat.centerX - px) * 0.02;

            const score = distScore + widthScore + proximityScore;
            if (score > bestScore) {
                bestScore = score;
                best = plat;
            }
        }

        return best;
    }

    /** The platform the drone is currently standing on, or null if airborne. */
    private _currentPlatform(ctx: AIContext): Platform | null {
        const px = ctx.player.oFlight.vPosition.x;
        const py = ctx.player.oFlight.vPosition.y;
        return ctx.topology.platformAt(px, py);
    }

    // ── Path computation ───────────────────────────────────────────────────

    private _computePath(ctx: AIContext, platform: Platform): NavEdge[] {
        const { player, graph, query } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;

        const fromNode = graph.findBelow(px, py);
        if (!fromNode) {
            return [];
        }

        // Target the platform node horizontally closest to the drone.
        const toNode = platform.nodes.reduce((best, node) =>
            Math.abs(node.x - px) < Math.abs(best.x - px) ? node : best
        );

        if (fromNode === toNode) {
            return [];
        }

        return query.findPath(fromNode, toNode);
    }
}
