/** Mutable 2D vector used for positions, speeds, and accelerations throughout the engine. */
export class Vector2D {
    /** Horizontal component. */
    x: number = 0;
    /** Vertical component. */
    y: number = 0;

    /**
     * @param x - Initial x value, or an object with x/y properties to copy.
     * @param y - Initial y value (ignored when x is an object).
     */
    constructor(x?: number | { x: number; y: number }, y?: number) {
        if (x !== undefined) {
            this.set(x as number, y as number);
        }
    }

    /**
     * Set both components. Accepts scalar pair or another vector-like object.
     * Throws if either value is NaN.
     */
    set(x: number | { x: number; y: number }, y?: number): this {
        if (typeof x === 'object') {
            return this.set(x.x, x.y);
        }
        this.x = x;
        this.y = y!;
        if (isNaN(this.x) || isNaN(this.y)) {
            throw new Error('Vector2D: invalid coordinates');
        }
        return this;
    }

    /** Add another vector in place and return `this`. */
    add(v: Vector2D): this {
        return this.set(this.x + v.x, this.y + v.y);
    }

    /** Scale both components by `n` in place and return `this`. */
    mul(n: number): this {
        return this.set(this.x * n, this.y * n);
    }

    /** Divide both components by `n` in place. A zero divisor is silently ignored. */
    div(n: number): this {
        if (n !== 0) {
            this.set(this.x / n, this.y / n);
        }
        return this;
    }

    /** Return a new vector with the same components. */
    clone(): Vector2D {
        return new Vector2D(this.x, this.y);
    }

    /** Euclidean length (magnitude) of the vector. */
    distance(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /** Normalize to unit length in place. A zero-length vector is left unchanged. */
    normalize(): this {
        return this.div(this.distance());
    }
}
