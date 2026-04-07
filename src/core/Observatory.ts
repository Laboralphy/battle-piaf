import { Observer } from './Observer.js';

/**
 * Named-event pub/sub hub with per-event payload typing.
 *
 * `TEventMap` is a record that maps each event name to its payload type, e.g.:
 * ```ts
 * type MyEvents = { move: FairyFlight; damaged: { damage: number } };
 * const obs = new Observatory<Fairy, MyEvents>();
 * obs.notify(fairy, 'damaged', { damage: 10 }); // ✓ type-checked
 * ```
 *
 * Observers are registered under string event names and notified in insertion
 * order.  A slot can be nulled out with `detach` without disrupting other indices.
 * Internally all observers are stored as `unknown` to accommodate the heterogeneous
 * payload types; the public API is fully typed via generic method signatures.
 */
export class Observatory<TSender, TEventMap extends Record<string, unknown>> {
    /** Map from event name to the ordered list of observers (null slots are detached). */
    private _observers: Map<string, Array<Observer<TSender, unknown> | null>> = new Map();

    /**
     * Register an observer for the named event.
     * The observer's data type must match the payload declared in `TEventMap`.
     * @returns The slot index that can later be passed to `detach`.
     */
    attach<K extends keyof TEventMap & string>(
        event: K,
        observer: Observer<TSender, TEventMap[K]>
    ): number {
        if (!this._observers.has(event)) {
            this._observers.set(event, []);
        }
        const list = this._observers.get(event)!;
        const index = list.length;
        list.push(observer as Observer<TSender, unknown>);
        return index;
    }

    /**
     * Remove the observer at `index` from the given event.
     * The slot is set to null; other indices are unaffected.
     */
    detach(event: string, index: number): void {
        const list = this._observers.get(event);
        if (list) {
            list[index] = null;
        }
    }

    /**
     * Call every active observer registered for `event` with the given sender and data.
     * The data type is inferred from `TEventMap[K]`.
     */
    notify<K extends keyof TEventMap & string>(
        sender: TSender,
        event: K,
        data: TEventMap[K]
    ): void {
        const list = this._observers.get(event);
        if (!list) {
            return;
        }
        for (const observer of list) {
            if (observer !== null) {
                observer.notify(sender, data as unknown);
            }
        }
    }
}
