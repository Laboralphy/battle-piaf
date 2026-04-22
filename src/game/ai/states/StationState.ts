import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { Platform } from '../navigation/Platform.js';
import { PonderState } from './PonderState.js';
import { tryCreateCrateChase } from './ChaseCrateState.js';

/**
 * Station state: hold a chosen platform and fire at the opponent from range.
 *
 * The drone keeps its horizontal position near the platform's centre and fires
 * on the profile cooldown. When the opponent changes platform row the tactical
 * situation has changed enough to warrant re-evaluation, so the drone returns
 * to PonderState.
 *
 * Transitions:
 *   → PonderState  when the opponent moves to a different platform row
 */
/** Ticks the opponent must be off the expected row before re-evaluating (~1 s). */
const REPLAN_DELAY = 60;

export class StationState implements IState<AIContext> {
    private _opponentRow = -1;
    private _fireCooldown = 0;
    /** Counts consecutive ticks where the opponent is not on the expected row. */
    private _staleTimer = 0;

    constructor(private readonly _platform: Platform) {}

    onEnter(ctx: AIContext): void {
        this._fireCooldown = 0;
        this._staleTimer = 0;
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

        // Re-evaluate only after the opponent has been off the expected row for
        // REPLAN_DELAY consecutive ticks — brief jumps do not trigger a replan.
        const op = topology.platformAt(ox, oy);
        if (op === null || op.row !== this._opponentRow) {
            if (++this._staleTimer >= REPLAN_DELAY) {
                return new PonderState();
            }
        } else {
            this._staleTimer = 0;
        }

        input.releaseAll();

        // The opponent's side relative to the drone determines the required face.
        const requiredFace = ox >= px ? 1 : -1;

        if (this._fireCooldown <= 0) {
            // Only press a direction if not already facing the opponent.
            // nFace persists when nDir=0, so no press is needed when already correct —
            // pressing unnecessarily would drift the drone 3 px toward the opponent
            // every shot.
            if (player.nFace !== requiredFace) {
                if (requiredFace === 1) {
                    input.pressRight();
                } else {
                    input.pressLeft();
                }
            }
            input.pressFire();
            this._fireCooldown = profile.fireCooldown;
        } else {
            this._fireCooldown--;
            // No position correction for now — observing natural drift behaviour.
        }

        // Jump to roughly match the opponent's height when they are higher.
        if (oy < py - 32 && player.bOnFloor) {
            input.pressJump();
        }

        // Spontaneous random jump for projectile dodging.
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
}
