import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { ChaseState } from './ChaseState.js';

/**
 * Evade state: move away from the opponent for a profile-defined duration.
 *
 * Triggered by `AIController` when the player takes a hit (only for profiles
 * with `evadeOnHit: true`). Returns to ChaseState when the timer expires.
 */
export class EvadeState implements IState<AIContext> {
    private _remaining = 0;

    onEnter(ctx: AIContext): void {
        this._remaining = ctx.profile.evadeDuration;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        if (this._remaining <= 0) {
            return new ChaseState();
        }
        this._remaining--;

        const { player, opponent, input, profile } = ctx;
        const dx = opponent.oFlight.vPosition.x - player.oFlight.vPosition.x;

        input.releaseAll();

        // Run away from the opponent.
        if (dx > 0) {
            input.pressLeft();
        } else {
            input.pressRight();
        }

        // Random jump while evading.
        if (player.bOnFloor && Math.random() < Math.max(profile.randomJumpChance, 0.05)) {
            input.pressJump();
        }

        return null;
    }

    onExit(_ctx: AIContext): void {}
}
