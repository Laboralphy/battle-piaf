/**
 * Generic state interface for a finite state machine.
 *
 * Each `onUpdate` call may return a new state to transition into,
 * or `null` to remain in the current state.
 */
export interface IState<TContext> {
    /** Called once when the FSM enters this state. */
    onEnter(ctx: TContext): void;
    /**
     * Called every tick while this state is active.
     * Return a new state to trigger a transition, or `null` to stay.
     */
    onUpdate(ctx: TContext): IState<TContext> | null;
    /** Called once just before the FSM leaves this state. */
    onExit(ctx: TContext): void;
}
