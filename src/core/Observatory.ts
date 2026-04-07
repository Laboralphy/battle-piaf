import { Observer } from './Observer.js';

/**
 * Named-event pub/sub hub.
 * Observers are registered under string event names and notified in insertion order.
 * A slot can be nulled out with `detach` without disrupting other indices.
 */
export class Observatory<TSender = unknown, TData = unknown> {
    /** Map from event name to the ordered list of observers (null slots are detached). */
    private _observers: Map<string, Array<Observer<TSender, TData> | null>> = new Map();

    /**
     * Register an observer for the given event.
     * @returns The slot index that can later be passed to `detach`.
     */
    attach(event: string, observer: Observer<TSender, TData>): number {
        if (!this._observers.has(event)) {
            this._observers.set(event, []);
        }
        const list = this._observers.get(event)!;
        const index = list.length;
        list.push(observer);
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

    /** Call every active observer registered for `event` with the given sender and data. */
    notify(sender: TSender, event: string, data: TData): void {
        const list = this._observers.get(event);
        if (!list) {return;}
        for (const observer of list) {
            if (observer !== null) {
                observer.notify(sender, data);
            }
        }
    }
}
