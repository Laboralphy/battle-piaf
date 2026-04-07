import { FairyTile } from './FairyTile.js';

/** Entry tracking a tile that has an active animation and needs per-tick redraws. */
interface DynamicTileEntry {
    x: number;
    y: number;
    tile: FairyTile;
}

/**
 * A scrollable tile-map layer.
 * The full tile map is rendered into an internal off-screen canvas; only
 * animated ("dynamic") tiles are redrawn each tick.  On `render`, the
 * off-screen canvas is composited onto the main canvas at the scroll offset
 * set by `lookAt`.
 *
 * Supports optional sub- and over-matrices for parallax layers (scrolled at a
 * different factor than the main matrix).
 */
export class FairyMatrix {
    /** 2D grid of tiles, indexed as `_grid[row][col]`. */
    private _grid: FairyTile[][] = [];
    private _cols = 0;
    private _rows = 0;
    /** Width of each tile in pixels. */
    private _tileW = 0;
    /** Height of each tile in pixels. */
    private _tileH = 0;
    /** The sprite-sheet image containing all tile graphics. */
    private _image: HTMLImageElement | null = null;
    /** Off-screen canvas onto which tiles are rendered. */
    private _canvas: HTMLCanvasElement;
    /** Rendering context for the off-screen canvas. */
    private _ctx: CanvasRenderingContext2D;
    /** The main canvas context to composite onto. */
    private _renderCtx: CanvasRenderingContext2D | null = null;
    /** Horizontal scroll offset applied during `render` (negative = shifted left). */
    private _xLook = 0;
    /** Vertical scroll offset applied during `render`. */
    private _yLook = 0;
    /** True when a full redraw of all tiles is needed. */
    private _invalid = true;
    /** Tiles with active animations that must be redrawn each tick. */
    private _dynamicTiles: DynamicTileEntry[] = [];

    /** Optional background (behind) parallax matrix. */
    private _subMatrix: FairyMatrix | null = null;
    private _subLookX = 0;
    private _subLookY = 0;
    /** Optional foreground (in front) parallax matrix. */
    private _overMatrix: FairyMatrix | null = null;
    private _overLookX = 0;
    private _overLookY = 0;

    constructor() {
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d')!;
    }

    /** Set the sprite-sheet image and mark the map dirty for a full redraw. */
    setImage(image: HTMLImageElement): void {
        this._image = image;
        this._invalid = true;
    }

    /** Provide the main canvas onto which the tile map is composited. */
    setRenderingCanvas(canvas: HTMLCanvasElement): void {
        this._renderCtx = canvas.getContext('2d')!;
    }

    /** Initialise the grid dimensions and resize the off-screen canvas. */
    setSize(cols: number, rows: number, tileW: number, tileH: number): void {
        this._cols = cols;
        this._rows = rows;
        this._tileW = tileW;
        this._tileH = tileH;
        this._grid = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => new FairyTile())
        );
        this._canvas.width = tileW * cols;
        this._canvas.height = tileH * rows;
        this._ctx = this._canvas.getContext('2d')!;
        this._invalid = true;
    }

    /**
     * Set the camera scroll position.
     * `(x, y)` is the world-space coordinate of the top-left viewport corner.
     * Sub- and over-matrices are scrolled at their respective parallax factors.
     */
    lookAt(x: number, y: number): void {
        this._xLook = Math.floor(-x);
        this._yLook = Math.floor(-y);
        this._subMatrix?.lookAt(x * this._subLookX, y * this._subLookY);
        this._overMatrix?.lookAt(x * this._overLookX, y * this._overLookY);
    }

    /**
     * Attach a background parallax matrix.
     * @param xFactor - Horizontal parallax ratio relative to this matrix's scroll.
     * @param yFactor - Vertical parallax ratio.
     */
    setSubMatrix(matrix: FairyMatrix, xFactor: number, yFactor: number): void {
        this._subMatrix = matrix;
        this._subLookX = xFactor;
        this._subLookY = yFactor;
    }

    /**
     * Attach a foreground parallax matrix.
     * @param xFactor - Horizontal parallax ratio relative to this matrix's scroll.
     * @param yFactor - Vertical parallax ratio.
     */
    setOverMatrix(matrix: FairyMatrix, xFactor: number, yFactor: number): void {
        this._overMatrix = matrix;
        this._overLookX = xFactor;
        this._overLookY = yFactor;
    }

    /**
     * Return the tile at grid position `(x, y)`.
     * Throws if the coordinates are out of range.
     */
    getTile(x: number, y: number): FairyTile {
        if (y < 0 || y >= this._grid.length || x < 0 || x >= (this._grid[y]?.length ?? 0)) {
            throw new Error(`FairyMatrix: (${x}, ${y}) is out of range.`);
        }
        return this._grid[y][x];
    }

    /** Set the graphical tile index at `(x, y)` and mark the map dirty. */
    setTileGfx(x: number, y: number, gfx: number): void {
        this.getTile(x, y).setGfx(gfx);
        this._invalid = true;
    }

    /** Set the logical collision code at `(x, y)` and mark the map dirty. */
    setTileCode(x: number, y: number, code: number): void {
        this.getTile(x, y).setCode(code);
        this._invalid = true;
    }

    /** Return the logical collision code at `(x, y)`. */
    getTileCode(x: number, y: number): number {
        return this.getTile(x, y).getCode();
    }

    /** Force a full redraw of all tiles on the next `render` call. */
    invalidate(): void {
        this._invalid = true;
    }

    /**
     * Advance all dynamic (animated) tiles by one tick and redraw them.
     * Tiles whose animations have ended are removed from the dynamic list.
     */
    proceed(): void {
        for (const entry of this._dynamicTiles) {
            entry.tile.proceed();
            this._drawTile(entry.x, entry.y);
        }
        this._dynamicTiles = this._dynamicTiles.filter((e) => e.tile.isDynamic());
    }

    /**
     * Composite the tile map onto the main canvas.
     * If the map is dirty (`_invalid`), all tiles are redrawn first.
     */
    render(): void {
        if (this._invalid) {this._drawAllTiles();}
        this._renderCtx!.drawImage(this._canvas, this._xLook, this._yLook);
    }

    /** Redraw a single tile at grid position `(x, y)` on the off-screen canvas. */
    private _drawTile(x: number, y: number): void {
        const tile = this.getTile(x, y);
        const tilesPerRow = Math.floor(this._image!.width / this._tileW);
        const srcX = (tile.nGfx % tilesPerRow) * this._tileW;
        const srcY = Math.floor(tile.nGfx / tilesPerRow) * this._tileH;
        const dstX = x * this._tileW;
        const dstY = y * this._tileH;

        this._ctx.clearRect(dstX, dstY, this._tileW, this._tileH);
        this._ctx.drawImage(
            this._image!,
            srcX,
            srcY,
            this._tileW,
            this._tileH,
            dstX,
            dstY,
            this._tileW,
            this._tileH
        );
    }

    /**
     * Clear the off-screen canvas and redraw every tile.
     * Repopulates `_dynamicTiles` with any tiles that have active animations.
     */
    private _drawAllTiles(): void {
        this._dynamicTiles = [];
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        for (let y = 0; y < this._rows; y++) {
            for (let x = 0; x < this._cols; x++) {
                this._drawTile(x, y);
                const tile = this.getTile(x, y);
                if (tile.isDynamic()) {
                    this._dynamicTiles.push({ x, y, tile });
                }
            }
        }
        this._invalid = false;
    }
}
