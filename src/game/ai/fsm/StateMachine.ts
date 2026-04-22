import { IState } from './IState.js';

/**
 * Generic finite state machine.
 * Holds one active state at a time and forwards `update()` calls to it.
 * When `onUpdate` returns a new state, the FSM calls `onExit` on the old
 * state and `onEnter` on the new one automatically.
 */
export class StateMachine<TContext> {
    private _current: IState<TContext> | null = null;
    private readonly _ctx: TContext;

    constructor(ctx: TContext) {
        this._ctx = ctx;
    }

    /** The currently active state, or null before the first transition. */
    get current(): IState<TContext> | null {
        return this._current;
    }

    /**
     * Immediately switch to `next`.
     * Calls `onExit` on the outgoing state and `onEnter` on the incoming one.
     */
    transition(next: IState<TContext>): void {
        this._current?.onExit(this._ctx);
        this._current = next;
        this._current.onEnter(this._ctx);
    }

    /**
     * Tick the active state.
     * If `onUpdate` returns a new state, transitions to it in the same tick.
     */
    update(): void {
        if (!this._current) {
            return;
        }
        const next = this._current.onUpdate(this._ctx);
        if (next) {
            this.transition(next);
        }
    }
}
