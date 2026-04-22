/** Determines which FSM state the AI starts in. */
export type AIStrategy = 'null' | 'basic' | 'chase' | 'chase-debug';

/**
 * Defines the personality and tactical parameters of an AI player.
 * Pass a profile to `AIController` at construction time; it never changes
 * during a match.
 */
export interface AIProfile {
    /** Human-readable label (for debugging / UI). */
    readonly name: string;
    /** Initial FSM state. Replaces the former `usePaths` boolean. */
    readonly initialState: AIStrategy;

    // ── Preferred horizontal distance (BasicState only) ────────────────────
    /**
     * Minimum preferred horizontal distance from the opponent (px).
     * BasicState backs away when closer than this.
     * Unused for 'null' and 'chase' strategies.
     */
    readonly preferredDistMin: number;
    /**
     * Maximum preferred horizontal distance from the opponent (px).
     * BasicState moves closer when farther than this.
     * Unused for 'null' and 'chase' strategies.
     */
    readonly preferredDistMax: number;

    // ── Attack ─────────────────────────────────────────────────────────────
    /**
     * Horizontal distance (px) within which ChaseState transitions to AttackState.
     * Unused for 'null' and 'basic' strategies.
     */
    readonly attackRangeX: number;
    /** Vertical distance (px) for the attack-range check. */
    readonly attackRangeY: number;
    /**
     * Horizontal distance (px) above which AttackState transitions back to ChaseState.
     * Unused for 'null' and 'basic' strategies.
     */
    readonly disengageX: number;
    /** Vertical distance (px) for the disengage check. */
    readonly disengageY: number;
    /** Ticks between fire attempts (lower = more aggressive). */
    readonly fireCooldown: number;

    // ── Evasion ────────────────────────────────────────────────────────────
    /** Switch to EvadeState for a moment after taking a hit? */
    readonly evadeOnHit: boolean;
    /** Duration of the evasion phase (ticks). */
    readonly evadeDuration: number;
    /**
     * Probability per tick of a spontaneous jump in any state (0–1).
     * Simulates projectile dodging without explicit projectile tracking.
     */
    readonly randomJumpChance: number;
}

// ── Preset profiles ────────────────────────────────────────────────────────

/**
 * NULL — does nothing. Useful for isolated testing and AI design analysis.
 */
export const PROFILE_NULL: AIProfile = {
    name: 'Null',
    initialState: 'null',
    preferredDistMin: 0,
    preferredDistMax: 0,
    attackRangeX: 0,
    attackRangeY: 0,
    disengageX: 0,
    disengageY: 0,
    fireCooldown: 0,
    evadeOnHit: false,
    evadeDuration: 0,
    randomJumpChance: 0,
} as const;

/**
 * BASIC — ranged shooter that keeps its distance.
 * Positions itself 4–6 tiles away horizontally, matches the opponent's height,
 * fires only when in position, and hops randomly to dodge projectiles.
 */
export const PROFILE_BASIC: AIProfile = {
    name: 'Basic',
    initialState: 'basic',
    preferredDistMin: 128, // 4 tiles
    preferredDistMax: 192, // 6 tiles
    attackRangeX: 0,
    attackRangeY: 0,
    disengageX: 0,
    disengageY: 0,
    fireCooldown: 25,
    evadeOnHit: false,
    evadeDuration: 0,
    randomJumpChance: 0.025,
} as const;

/**
 * HUNTER — aggressive chaser.
 * Navigates toward the opponent with A*, attacks at close range,
 * and briefly evades after taking a hit.
 */
export const PROFILE_HUNTER: AIProfile = {
    name: 'Hunter',
    initialState: 'chase',
    preferredDistMin: 0,
    preferredDistMax: 0,
    attackRangeX: 120,
    attackRangeY: 48,
    disengageX: 160,
    disengageY: 72,
    fireCooldown: 20,
    evadeOnHit: true,
    evadeDuration: 60,
    randomJumpChance: 0,
} as const;

/**
 * BERSERKER — maximum aggression.
 * Chases relentlessly, fires at a high rate, never evades.
 */
export const PROFILE_BERSERKER: AIProfile = {
    name: 'Berserker',
    initialState: 'chase',
    preferredDistMin: 0,
    preferredDistMax: 0,
    attackRangeX: 180,
    attackRangeY: 96,
    disengageX: 240,
    disengageY: 120,
    fireCooldown: 10,
    evadeOnHit: false,
    evadeDuration: 0,
    randomJumpChance: 0,
} as const;

/**
 * CAUTIOUS — keeps distance, fires frequently, retreats when hit.
 */
export const PROFILE_CAUTIOUS: AIProfile = {
    name: 'Cautious',
    initialState: 'chase',
    preferredDistMin: 0,
    preferredDistMax: 0,
    attackRangeX: 200,
    attackRangeY: 64,
    disengageX: 80,
    disengageY: 40,
    fireCooldown: 18,
    evadeOnHit: true,
    evadeDuration: 90,
    randomJumpChance: 0.01,
} as const;
