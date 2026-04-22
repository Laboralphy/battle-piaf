import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';

/**
 * Basic state: ranged-shooter behavior for PROFILE_BASIC.
 *
 * Each tick:
 * 1. **Horizontal positioning** — maintain a preferred distance band
 *    (`preferredDistMin`–`preferredDistMax`) from the opponent.
 *    - Too close  → back away.
 *    - Too far    → move closer.
 *    - In band    → hold position.
 * 2. **Vertical positioning** — jump when the opponent is noticeably higher
 *    so projectiles have a chance of connecting.
 * 3. **Firing** — only fires while inside the distance band.
 *    The cooldown resets when out of position so the first shot after
 *    repositioning fires immediately.
 * 4. **Random jumps** — spontaneous hops to make the AI harder to hit,
 *    controlled by `profile.randomJumpChance`.
 *
 * Never transitions to another state.
 */
export class BasicState implements IState<AIContext> {
    private _fireCooldown = 0;
    /**
     * Hysteresis flag: true while the AI is actively backing away.
     * Prevents the rapid direction-flip that occurs when dist oscillates
     * around minD — once backing starts, the AI keeps backing until it
     * reaches minD + BACK_HYSTERESIS before switching to hold/approach.
     */
    private _backingAway = false;

    onEnter(_ctx: AIContext): void {
        this._fireCooldown = 0;
        this._backingAway = false;
    }

    onUpdate(ctx: AIContext): IState<AIContext> | null {
        const { player, opponent, input, profile } = ctx;
        const px = player.oFlight.vPosition.x;
        const py = player.oFlight.vPosition.y;
        const ox = opponent.oFlight.vPosition.x;
        const oy = opponent.oFlight.vPosition.y;

        const dx = ox - px; // positive = opponent is to the right
        const dist = Math.abs(dx);
        const { preferredDistMin: minD, preferredDistMax: maxD } = profile;
        /** Extra distance beyond minD before the AI stops backing away. */
        const BACK_HYSTERESIS = 32;

        // ── Update hysteresis flag ────────────────────────────────────────
        if (!this._backingAway && dist < minD) {
            this._backingAway = true;
        } else if (this._backingAway && dist > minD + BACK_HYSTERESIS) {
            this._backingAway = false;
        }

        input.releaseAll();

        // ── Horizontal positioning ────────────────────────────────────────
        if (this._backingAway) {
            // Too close — back away. Keep backing until minD + BACK_HYSTERESIS
            // to avoid flip-flopping on the minD boundary.
            if (dx > 0) input.pressLeft();
            else        input.pressRight();
        } else if (dist > maxD) {
            // Too far — move toward the opponent.
            if (dx > 0) input.pressRight();
            else        input.pressLeft();
        }
        // In band and not backing away: release all horizontal keys.
        // Facing direction is preserved from the last movement, which was
        // always toward the opponent (approaching from far) so aiming is correct.

        // ── Vertical positioning (height matching) ────────────────────────
        // Jump when the opponent is noticeably higher on screen (smaller y).
        if (py - oy > 32 && player.bOnFloor) {
            input.pressJump();
        }

        // ── Firing ───────────────────────────────────────────────────────
        const inPosition = dist >= minD && dist <= maxD;
        if (inPosition) {
            if (this._fireCooldown <= 0) {
                input.pressFire();
                this._fireCooldown = profile.fireCooldown;
            } else {
                this._fireCooldown--;
            }
        } else {
            // Reset so the first shot after repositioning fires immediately.
            this._fireCooldown = 0;
        }

        // ── Random evasive jump ───────────────────────────────────────────
        if (player.bOnFloor && Math.random() < profile.randomJumpChance) {
            input.pressJump();
        }

        return null;
    }

    onExit(_ctx: AIContext): void {}
}
