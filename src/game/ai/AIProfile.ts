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

    // ── Preferred horizontal firing distance ───────────────────────────────
    /**
     * Minimum preferred horizontal distance from the opponent (px).
     * BasicState backs away when closer than this.
     * StationState uses the midpoint of [min, max] to score candidate platforms.
     */
    readonly preferredDistMin: number;
    /**
     * Maximum preferred horizontal distance from the opponent (px).
     * BasicState moves closer when farther than this.
     * StationState uses the midpoint of [min, max] to score candidate platforms.
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
 * Stations itself 3–6 tiles from the opponent, fires at a steady pace,
 * and briefly evades after taking a hit.
 */
export const PROFILE_HUNTER: AIProfile = {
    name: 'Hunter',
    initialState: 'chase',
    preferredDistMin: 96,  // 3 tiles
    preferredDistMax: 192, // 6 tiles
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
 * Stations itself close (2–5 tiles), fires at a high rate, never evades.
 */
export const PROFILE_BERSERKER: AIProfile = {
    name: 'Berserker',
    initialState: 'chase',
    preferredDistMin: 64,  // 2 tiles
    preferredDistMax: 160, // 5 tiles
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
 * CAUTIOUS — long-range sniper.
 * Stations itself 5–9 tiles away, fires steadily, retreats when hit.
 */
export const PROFILE_CAUTIOUS: AIProfile = {
    name: 'Cautious',
    initialState: 'chase',
    preferredDistMin: 160, // 5 tiles
    preferredDistMax: 288, // 9 tiles
    attackRangeX: 200,
    attackRangeY: 64,
    disengageX: 80,
    disengageY: 40,
    fireCooldown: 18,
    evadeOnHit: true,
    evadeDuration: 90,
    randomJumpChance: 0.01,
} as const;
