/**
 * Efficient growable array container with optional O(1) reverse-lookup via WeakMap.
 * Removal is O(1) by default (swap-with-last) or order-preserving (pack).
 */
export class Horde<T extends object> {
    /** Backing array; slots may be null after removal. */
    private _items: Array<T | null> = [];
    /** Maps each live item to its current index when index tracking is enabled. */
    private _indexMap = new WeakMap<T, number>();
    /** Whether O(1) lookup via `_indexMap` is active. */
    private _trackIndices = false;

    /**
     * Enable O(1) item lookup via `find`.
     * The legacy string parameter is kept for API compatibility but is not used.
     */
    setIndex(_legacyPropName: string): void {
        this._trackIndices = true;
        for (let i = 0; i < this._items.length; i++) {
            const item = this._items[i];
            if (item !== null) {this._indexMap.set(item, i);}
        }
    }

    /** Return the tracked index of `o`, or -1 if not found (requires `setIndex`). */
    getItemIndex(o: T): number {
        return this._indexMap.get(o) ?? -1;
    }

    /**
     * Append `o` to the container.
     * @returns The index at which the item was stored.
     */
    link(o: T): number {
        const n = this._items.push(o) - 1;
        if (this._trackIndices) {this._indexMap.set(o, n);}
        return n;
    }

    /**
     * Remove the item at index `n`.
     * By default uses swap-with-last for O(1) removal.
     * Pass `keepOrder = true` to use null-then-pack instead (preserves insertion order).
     */
    unlink(n: number, keepOrder = false): void {
        const item = this._items[n];
        if (item !== null && this._trackIndices) {
            this._indexMap.delete(item);
        }
        if (n === this._items.length - 1) {
            this._items.pop();
        } else if (keepOrder) {
            this._items[n] = null;
            this.pack();
        } else {
            const last = this._items.pop()!;
            this._items[n] = last;
            if (this._trackIndices && last !== null) {this._indexMap.set(last, n);}
        }
    }

    /** Remove all null slots, compacting the array and rebuilding the index map. */
    pack(): void {
        this._items = this._items.filter((item): item is T => item !== null);
        if (this._trackIndices) {
            for (let i = 0; i < this._items.length; i++) {
                this._indexMap.set(this._items[i] as T, i);
            }
        }
    }

    /**
     * Find the index of `o`.
     * Uses the WeakMap for O(1) lookup when index tracking is on, linear scan otherwise.
     * Returns -1 if not found.
     */
    find(o: T): number {
        if (this._trackIndices) {
            const n = this.getItemIndex(o);
            if (n >= 0) {return n;}
        }
        return this._items.findIndex((item) => item === o);
    }

    /** Return the item at index `i`, or null if the slot is empty or out of range. */
    get(i: number): T | null {
        return this._items[i] ?? null;
    }

    /** Overwrite the item at index `i`. */
    set(i: number, x: T): void {
        this._items[i] = x;
    }

    /** Number of slots (including null gaps if any). */
    getCount(): number {
        return this._items.length;
    }

    /** Iterate over all non-null items using a snapshot (safe against mutation during callback). */
    each(callback: (item: T) => void): void {
        const snapshot = this._items.filter((item): item is T => item !== null);
        for (const item of snapshot) {
            callback(item);
        }
    }
}
