/**
 * A generic reactive state container.
 *
 * Wraps an object in a `Proxy` so that any direct property assignment
 * automatically registers the property name in `dirty`.  Consumers check
 * `dirty` (or `isDirty()`) to know which properties changed, then call
 * `validate()` to clear the set.
 *
 * @typeParam T - A plain object type whose properties are the tracked state.
 *
 * @example
 * const store = new Store({ score: 0, hp: 100 });
 * store.state.score += 10;          // dirty → Set { 'score' }
 * store.state.hp = 80;              // dirty → Set { 'score', 'hp' }
 * if (store.dirty.has('hp')) { ... }
 * store.validate();                 // dirty → Set {}
 *
 * @note Only direct property assignments are intercepted.  Mutations of
 * nested objects (e.g. `store.state.arr.push(x)`) will not mark dirty.
 */
export class Store<T extends object> {
    /** The proxied state object.  Assign to its properties as normal. */
    readonly state: T;
    /** Set of property names written since the last `validate()` call. */
    readonly dirty = new Set<string>();

    constructor(initial: T) {
        this.state = new Proxy(initial, {
            set: (target: T, prop: string | symbol, value: unknown): boolean => {
                (target as Record<string | symbol, unknown>)[prop] = value;
                if (typeof prop === 'string') {
                    this.dirty.add(prop);
                }
                return true;
            },
        });
    }

    /** Returns true if any property has been written since the last `validate()`. */
    get invalid(): boolean {
        return this.dirty.size > 0;
    }

    /** Clear the dirty set.  Call this after consuming the changed state. */
    validate(): void {
        this.dirty.clear();
    }
}
