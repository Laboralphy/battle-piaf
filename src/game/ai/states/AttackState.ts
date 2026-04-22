import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';
import { ChaseState } from './ChaseState.js';

/** Minimum ticks the AI stays in AttackState before reconsidering distance. */
const MIN_ATTACK_TICKS = 30;

/**
 * Attack state: stay near the opponent and fire repeatedly.
 *
 * Fire cooldown and disengage thresholds come from the active profile.
 * Returns to ChaseState when the opponent moves out of the profile's disengage range.
 */
export class AttackState implements IState<AIContext> {
    private _fireCooldown = 0;
    private _stayTicks = 0;

    onEnter(_ctx: AIContext): void {
        this._fireCooldown = 0;
        this._stayTicks = MIN_ATTACK_TICKS;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        const { player, opponent, input, profile } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        if (this._stayTicks > 0) {
            this._stayTicks--;
        }

        // Transition: opponent too far — resume chasing.
        if (
            this._stayTicks <= 0 &&
            (Math.abs(ox - px) > profile.disengageX || Math.abs(oy - py) > profile.disengageY)
        ) {
            return new ChaseState();
        }

        input.releaseAll();

        // Keep facing and drifting toward the opponent.
        const dx = ox - px;
        if (dx > 16) {
            input.pressRight();
        } else if (dx < -16) {
            input.pressLeft();
        }

        // Jump to match vertical position when the opponent is higher.
        if (oy < py - 32 && player.bOnFloor) {
            input.pressJump();
        }

        // Fire on cooldown.
        if (this._fireCooldown <= 0) {
            input.pressFire();
            this._fireCooldown = profile.fireCooldown;
        } else {
            this._fireCooldown--;
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
}
