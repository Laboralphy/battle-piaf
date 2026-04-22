import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
// Circular imports resolved via live bindings (body-only references).
import { ChaseChoosePlatformState } from './ChaseChoosePlatformState.js';
import { tryCreateCrateChase } from './ChaseCrateState.js';

/** Duration of the ponder pause in ticks (~0.5 s at 60 Hz). */
const PONDER_DURATION = 30;

/**
 * Ponder state: a deliberate pause before committing to a new station.
 *
 * Triggered by ChaseProceedToPlatformState when the target has not been
 * reached after a timeout, or by StationState when the opponent changes row.
 * The drone stands still for PONDER_DURATION ticks, then hands off to
 * ChaseChoosePlatformState which scores platforms and builds a fresh path.
 */
export class PonderState implements IState<AIContext> {
    private _remaining = 0;

    onEnter(_ctx: AIContext): void {
        this._remaining = PONDER_DURATION;
        console.log('ponder state', Date.now());
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        // Stand still while pondering.
        ctx.input.releaseAll();

        if (this._remaining <= 0) {
            return this._nextState(ctx);
        }

        this._remaining--;
        return null;
    }

    onExit(_ctx: AIContext): void {}

    private _nextState(ctx: AIContext): IState<AIContext> {
        return tryCreateCrateChase(ctx) ?? new ChaseChoosePlatformState();
    }
}
