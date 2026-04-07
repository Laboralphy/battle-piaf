/** A state handler: returns the name of the next state, null/undefined to stay, or a falsy value. */
export type StateHandler = () => string | null | undefined;

/**
 * Simple finite-state machine driven by a `tick()` call.
 * States are named functions registered with `addState`.  Each tick, the current
 * handler runs; if it returns a non-empty string, the machine transitions to that
 * state immediately.
 *
 * The first state registered automatically becomes the initial state.
 */
export class FairySequencer {
    /** Map from state name to its handler. */
    private _states = new Map<string, StateHandler>();
    /** The handler for the currently active state. */
    private _current: StateHandler = () => undefined;
    /** True until the first real state is registered via `addState`. */
    private _uninitialized = true;

    constructor() {
        this._states.set('stateNop', () => undefined);
        this._current = this._states.get('stateNop')!;
    }

    /**
     * Register a named state handler.
     * If this is the first state added, it becomes the initial active state.
     */
    addState(name: string, handler: StateHandler): void {
        this._states.set(name, handler);
        if (this._uninitialized) {
            this.setState(name);
            this._uninitialized = false;
        }
    }

    /**
     * Immediately switch to the named state.
     * Throws if the state name has not been registered.
     */
    setState(name: string): void {
        const handler = this._states.get(name);
        if (!handler) {throw new Error(`Sequencer: unknown state "${name}"`);}
        this._current = handler;
    }

    /**
     * Run the current state handler once.
     * If the handler returns a non-empty string, the machine transitions to that state.
     */
    tick(): void {
        const next = this._current();
        if (next) {
            this.setState(next);
        }
    }
}
