import { Vector2D } from '../core/Vector2D.js';
import { FairyFlight } from './FairyFlight.js';
import { Horde } from '../core/Horde.js';

/** Any object that can participate in collision detection. */
export interface ICollidable {
    /** Physics state; `vNewPosition` is used for the current-tick overlap test. */
    oFlight: FairyFlight;
    /** The bounding shape, pre-linked to `oFlight`. */
    oBoundingShape: FairyCollisionShape;
    /** The spatial sector this object is currently registered in (managed by FairyCollider). */
    _collisionSector: FairyCollisionSector | null;
}

/**
 * Abstract base for collision shapes.
 * Each shape carries a `tangibilityMask`: two objects only collide when
 * `(maskA & maskB) !== 0`.  A mask of 0 never hits anything.
 */
export abstract class FairyCollisionShape {
    /** String identifier for the concrete shape type (e.g. 'Rect'). */
    readonly shapeType: string;
    /** Shape-specific data (e.g. corner offsets). */
    protected oShape: unknown;
    /** The flight object whose `vNewPosition` anchors this shape. */
    protected oFlight!: FairyFlight;
    /** Bitmask controlling which other shapes this one can collide with. */
    tangibilityMask = 1;

    constructor(shapeType: string, shape: unknown) {
        this.shapeType = shapeType;
        this.oShape = shape;
    }

    /** Link the shape to a flight so it can read the current position. */
    setFlight(flight: FairyFlight): void {
        this.oFlight = flight;
    }

    /** Set the tangibility bitmask. */
    setTangibilityMask(mask: number): void {
        this.tangibilityMask = mask;
    }

    /** Return the current tangibility bitmask. */
    getTangibilityMask(): number {
        return this.tangibilityMask;
    }

    /** Test overlap against another shape. Returns false if masks don't intersect. */
    abstract hit(other: FairyCollisionShape): boolean;

    /** Helper: squared Euclidean distance between two points. */
    protected squareDistance(x1: number, y1: number, x2: number, y2: number): number {
        return (x2 - x1) ** 2 + (y2 - y1) ** 2;
    }
}

/**
 * Axis-aligned bounding rectangle.
 * `v1` is the top-left offset and `v2` is the bottom-right offset,
 * both relative to `oFlight.vNewPosition`.
 */
export class FairyCollisionRect extends FairyCollisionShape {
    /** Top-left corner offset relative to the owner's position. */
    private v1: Vector2D;
    /** Bottom-right corner offset relative to the owner's position. */
    private v2: Vector2D;

    constructor(v1: Vector2D, v2: Vector2D) {
        super('Rect', [v1, v2]);
        this.v1 = v1;
        this.v2 = v2;
    }

    /**
     * Return the absolute world-space corner positions for the current tick.
     * Uses `vNewPosition` so collision tests reflect the position after physics.
     */
    getPoints(): [Vector2D, Vector2D] {
        const pos = this.oFlight.vNewPosition;
        return [
            new Vector2D(this.v1.x + pos.x, this.v1.y + pos.y),
            new Vector2D(this.v2.x + pos.x, this.v2.y + pos.y),
        ];
    }

    /** Test AABB overlap, taking tangibility masks into account. */
    hit(other: FairyCollisionShape): boolean {
        if ((other.tangibilityMask & this.tangibilityMask) === 0) {return false;}
        if (other instanceof FairyCollisionRect) {return this.hitRect(other);}
        return false;
    }

    /** Core AABB vs AABB separation-axis test. */
    private hitRect(other: FairyCollisionRect): boolean {
        const [myUpper, myLower] = this.getPoints();
        const [otherUpper, otherLower] = other.getPoints();

        if (otherLower.y < myUpper.y) {
            return false;
        }
        if (otherLower.x < myUpper.x) {
            return false;
        }
        if (otherUpper.y > myLower.y) {
            return false;
        }
        if (otherUpper.x > myLower.x) {
            return false;
        }
        return true;
    }
}

/**
 * A single cell of the spatial hash grid.
 * Holds all collidable objects whose `vNewPosition` falls within this cell.
 */
export class FairyCollisionSector {
    /** Live objects registered in this sector. */
    readonly aObjects = new Horde<ICollidable>();

    constructor() {
        this.aObjects.setIndex('__collisionIndex');
    }

    /** Add `obj` to this sector. */
    registerObject(obj: ICollidable): void {
        this.aObjects.link(obj);
    }

    /** Remove `obj` from this sector. */
    unregisterObject(obj: ICollidable): void {
        const i = this.aObjects.find(obj);
        if (i >= 0) {this.aObjects.unlink(i);}
    }

    /** Return all objects in this sector that overlap with `subject`. */
    getCollisioningObjects(subject: ICollidable): ICollidable[] {
        const results: ICollidable[] = [];
        const n = this.aObjects.getCount();
        for (let i = 0; i < n; i++) {
            const candidate = this.aObjects.get(i);
            if (candidate && candidate !== subject) {
                if (subject.oBoundingShape.hit(candidate.oBoundingShape)) {
                    results.push(candidate);
                }
            }
        }
        return results;
    }
}

/**
 * Spatial hash grid for broad-phase collision detection.
 * The world is divided into a fixed grid of `FairyCollisionSector` cells.
 * Each tick, objects register themselves in the cell that contains their
 * `vNewPosition`.  To query, the 3×3 neighbourhood of cells around the
 * subject is searched and each candidate is tested with `hit`.
 */
export class FairyCollider {
    /** 2D grid of sectors, indexed as `_grid[row][col]`. */
    private _grid: FairyCollisionSector[][] = [];
    private _cols = 0;
    private _rows = 0;
    /** Width of each sector in pixels. */
    private _sectorW = 0;
    /** Height of each sector in pixels. */
    private _sectorH = 0;

    /** Initialise the grid dimensions. Must be called before use. */
    setSize(cols: number, rows: number, sectorW: number, sectorH: number): void {
        this._cols = cols;
        this._rows = rows;
        this._sectorW = sectorW;
        this._sectorH = sectorH;
        this._grid = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => new FairyCollisionSector())
        );
    }

    /** Return the sector that contains pixel coordinate `(x, y)`, or null if out of bounds. */
    private getSectorAt(x: number, y: number): FairyCollisionSector | null {
        const col = Math.floor(x / this._sectorW);
        const row = Math.floor(y / this._sectorH);
        if (row < 0 || col < 0 || row >= this._rows || col >= this._cols) {return null;}
        return this._grid[row][col];
    }

    /** Remove `obj` from whatever sector it is currently registered in. */
    unregisterObject(obj: ICollidable): void {
        if (obj._collisionSector) {
            obj._collisionSector.unregisterObject(obj);
            obj._collisionSector = null;
        }
    }

    /**
     * Place `obj` in the sector that matches its current `vNewPosition`.
     * If it is already in the correct sector, this is a no-op.
     * If it has moved to a different sector, the old registration is removed first.
     */
    registerObject(obj: ICollidable): void {
        const sector = this.getSectorAt(obj.oFlight.vNewPosition.x, obj.oFlight.vNewPosition.y);
        if (obj._collisionSector !== null) {
            if (obj._collisionSector === sector) {return;}
            this.unregisterObject(obj);
        }
        obj._collisionSector = sector;
        if (sector) {sector.registerObject(obj);}
    }

    /**
     * Return all collidable objects that overlap with `obj`.
     * Searches the 3×3 neighbourhood of sectors around `obj`'s `vNewPosition`
     * and runs `hit` against each candidate.
     */
    getCollisioningObjects(obj: ICollidable): ICollidable[] {
        const neighbours = new Horde<ICollidable>();
        const pos = obj.oFlight.vNewPosition;
        for (let dy = -this._sectorH; dy <= this._sectorH; dy += this._sectorH) {
            for (let dx = -this._sectorW; dx <= this._sectorW; dx += this._sectorW) {
                const sector = this.getSectorAt(pos.x + dx, pos.y + dy);
                if (!sector) {continue;}
                const n = sector.aObjects.getCount();
                for (let i = 0; i < n; i++) {
                    const candidate = sector.aObjects.get(i);
                    if (candidate && candidate !== obj) {
                        neighbours.link(candidate);
                    }
                }
            }
        }

        const results: ICollidable[] = [];
        const n = neighbours.getCount();
        for (let i = 0; i < n; i++) {
            const candidate = neighbours.get(i);
            if (candidate && obj.oBoundingShape.hit(candidate.oBoundingShape)) {
                results.push(candidate);
            }
        }
        return results;
    }
}
