import { createApp } from 'petite-vue';
import LEVEL_SRCS from '../data/levels';
import type { LevelData } from '../game/levels';

// ── Constants ─────────────────────────────────────────────────────────────────

const CODES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const META = '.*#@%$';
const META_MULT = 120;
const COLS = 20;
const ROWS = 15;
const TILE = 32;
const PAL_COLS = 6; // tiles per row in the palette grid
const PAL_W = PAL_COLS * TILE; // 192 px
const UNDO_LIMIT = 50;

// Solidity dot colours per meta index (index 0 = air, no dot)
const META_COLORS = ['', '#e8930a', '#d63030', '#9b30d6', '#2e9fd6', '#2ed68a'];

// ── Types ─────────────────────────────────────────────────────────────────────

type Cell = { c1: string; c2: string };
type Grid = Cell[][];

// ── Codec ─────────────────────────────────────────────────────────────────────

function gfxOf(c1: string, c2: string): number {
    const n1 = CODES.indexOf(c1 === ' ' ? '0' : c1);
    const n2 = META.indexOf(c2);
    return (n1 < 0 ? 0 : n1) + (n2 < 0 ? 0 : n2) * META_MULT;
}

function cellFromGfx(gfx: number): Cell | null {
    const c1Idx = gfx % META_MULT;
    const c2Idx = Math.floor(gfx / META_MULT);
    if (c1Idx >= CODES.length || c2Idx >= META.length) {
        return null;
    }
    return { c1: CODES[c1Idx], c2: META[c2Idx] };
}

function decodeLevel(rows: string[]): Grid {
    return Array.from({ length: ROWS }, (_, y) =>
        Array.from({ length: COLS }, (_, x) => {
            const raw = rows[y]?.[x * 2] ?? '0';
            return { c1: raw === ' ' ? '0' : raw, c2: rows[y]?.[x * 2 + 1] ?? '.' };
        })
    );
}

function encodeLevel(grid: Grid): string[] {
    return grid.map((row) => row.map((c) => c.c1 + c.c2).join(''));
}

function cloneGrid(g: Grid): Grid {
    return g.map((row) => row.map((c) => ({ ...c })));
}

// ── Canvas rendering ──────────────────────────────────────────────────────────

let spriteImg: HTMLImageElement | null = null;
let tilesPerRow = 0;

function drawSprite(ctx: CanvasRenderingContext2D, gfx: number, dx: number, dy: number): void {
    if (!spriteImg || tilesPerRow === 0) {
        return;
    }
    const sx = (gfx % tilesPerRow) * TILE;
    const sy = Math.floor(gfx / tilesPerRow) * TILE;
    ctx.drawImage(spriteImg, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
}

function renderGrid(grid: Grid, hover: { x: number; y: number } | null = null): void {
    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const { c1, c2 } = grid[y][x];
            drawSprite(ctx, gfxOf(c1, c2), x * TILE, y * TILE);
        }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE, 0);
        ctx.lineTo(x * TILE, ROWS * TILE);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE);
        ctx.lineTo(COLS * TILE, y * TILE);
        ctx.stroke();
    }

    if (hover && hover.x >= 0 && hover.x < COLS && hover.y >= 0 && hover.y < ROWS) {
        ctx.strokeStyle = 'rgba(255,220,0,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
    }
}

function renderPalette(selectedGfx: number): void {
    const canvas = document.getElementById('palette-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    if (!spriteImg || tilesPerRow === 0) {
        canvas.height = TILE;
        ctx.fillStyle = '#14141e';
        ctx.fillRect(0, 0, PAL_W, TILE);
        return;
    }

    const sheetRowCount = Math.floor(spriteImg.height / TILE);
    const totalTiles = tilesPerRow * sheetRowCount;
    const palRowCount = Math.ceil(totalTiles / PAL_COLS);
    canvas.height = palRowCount * TILE;

    ctx.fillStyle = '#14141e';
    ctx.fillRect(0, 0, PAL_W, canvas.height);

    for (let gfx = 0; gfx < totalTiles; gfx++) {
        const px = (gfx % PAL_COLS) * TILE;
        const py = Math.floor(gfx / PAL_COLS) * TILE;

        drawSprite(ctx, gfx, px, py);

        const c1Idx = gfx % META_MULT;
        const c2Idx = Math.floor(gfx / META_MULT);
        const encodable = c1Idx < CODES.length && c2Idx < META.length;

        if (!encodable) {
            // Non-encodable tiles: dark overlay so the user knows they can't be placed
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(px, py, TILE, TILE);
        } else if (c2Idx > 0) {
            // Solidity dot (bottom-left corner)
            ctx.fillStyle = META_COLORS[c2Idx];
            ctx.fillRect(px + 2, py + TILE - 7, 6, 6);
        }

        if (gfx === selectedGfx) {
            ctx.strokeStyle = 'rgba(255,220,0,0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        }
    }
}

// ── App ───────────────────────────────────────────────────────────────────────


const LAND_TILES = 'assets/images/land-tiles/';
const BACKGROUNDS_PATH = 'assets/images/backgrounds/';

const TILESHEETS: Record<string, string> = {
    wdbob_land0_z2: `${LAND_TILES}wdbob_land0_z2.png`,
};

const BACKGROUNDS: Record<string, string> = {
    'background-0': `${BACKGROUNDS_PATH}background-0.png`,
};

function makeApp() {
    let painting = false;
    let hover: { x: number; y: number } | null = null;

    const app = {
        levelKeys: Object.keys(LEVEL_SRCS),
        grid: decodeLevel(LEVEL_SRCS[Object.keys(LEVEL_SRCS)[0]].map),
        undoStack: [] as Grid[],
        selectedGfx: 0,
        levelName: 'my-level',
        loadSource: Object.keys(LEVEL_SRCS)[0],
        tileSheet: 'wdbob_land0_z2',
        background: 'background-0',

        get canUndo() {
            return this.undoStack.length > 0;
        },

        // ── Lifecycle ────────────────────────────────────────────────────────

        mounted() {
            this.loadTilesheet();
            this._setupGridEvents();
            this._setupPaletteEvents();
        },

        loadTilesheet() {
            const src = TILESHEETS[this.tileSheet];
            if (!src) {
                return;
            }
            const img = new Image();
            img.src = src;
            img.onload = () => {
                spriteImg = img;
                tilesPerRow = Math.floor(img.width / TILE);
                renderGrid(this.grid);
                renderPalette(this.selectedGfx);
            };
        },

        // ── Toolbar actions ──────────────────────────────────────────────────

        loadLevel() {
            const level = LEVEL_SRCS[this.loadSource];
            if (!level) {
                return;
            }
            this.grid = decodeLevel(level.map);
            this.undoStack.length = 0;
            // sync selectors to match the loaded level
            const tsKey = Object.keys(TILESHEETS).find((k) => TILESHEETS[k] === level.tileset);
            if (tsKey) {
                this.tileSheet = tsKey;
            }
            const bgKey = Object.keys(BACKGROUNDS).find((k) => BACKGROUNDS[k] === level.background);
            if (bgKey) {
                this.background = bgKey;
            }
            this.loadTilesheet();
        },

        clearLevel() {
            this._pushUndo();
            this.grid = Array.from({ length: ROWS }, () =>
                Array.from({ length: COLS }, () => ({ c1: '0', c2: '.' }))
            );
            renderGrid(this.grid);
        },

        undo() {
            const prev = this.undoStack.pop();
            if (prev) {
                this.grid = prev;
                renderGrid(this.grid, hover);
            }
        },

        downloadJSON() {
            const levelData: LevelData = {
                tileset: TILESHEETS[this.tileSheet] ?? '',
                background: BACKGROUNDS[this.background] ?? '',
                map: encodeLevel(this.grid),
                music: '',
            };
            const json = JSON.stringify(levelData, null, 4) + '\n';
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
                download: `${this.levelName || 'level'}.json`,
            });
            a.click();
            URL.revokeObjectURL(a.href);
        },

        // ── Internal ─────────────────────────────────────────────────────────

        _pushUndo() {
            this.undoStack.push(cloneGrid(this.grid));
            if (this.undoStack.length > UNDO_LIMIT) {
                this.undoStack.shift();
            }
        },

        _paintAt(x: number, y: number) {
            if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
                return;
            }
            const cell = cellFromGfx(this.selectedGfx);
            if (!cell) {
                return;
            }
            this.grid[y][x] = cell;
            renderGrid(this.grid, hover);
        },

        _setupGridEvents() {
            const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;

            const cellAt = (e: MouseEvent) => {
                const r = canvas.getBoundingClientRect();
                return {
                    x: Math.floor((e.clientX - r.left) / TILE),
                    y: Math.floor((e.clientY - r.top) / TILE),
                };
            };

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 2) {
                    e.preventDefault();
                    this._pushUndo();
                    const { x, y } = cellAt(e);
                    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                        this.grid[y][x] = { c1: '0', c2: '.' };
                        renderGrid(this.grid, hover);
                    }
                    return;
                }
                if (e.button !== 0) {
                    return;
                }
                this._pushUndo();
                painting = true;
                const { x, y } = cellAt(e);
                this._paintAt(x, y);
            });

            canvas.addEventListener('mousemove', (e) => {
                const { x, y } = cellAt(e);
                hover = { x, y };
                if (painting) {
                    this._paintAt(x, y);
                } else {
                    renderGrid(this.grid, hover);
                }
            });

            canvas.addEventListener('mouseup', () => {
                painting = false;
            });
            canvas.addEventListener('mouseleave', () => {
                painting = false;
                hover = null;
                renderGrid(this.grid);
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        },

        _setupPaletteEvents() {
            const canvas = document.getElementById('palette-canvas') as HTMLCanvasElement;

            canvas.addEventListener('click', (e) => {
                const r = canvas.getBoundingClientRect();
                const col = Math.floor((e.clientX - r.left) / TILE);
                const row = Math.floor((e.clientY - r.top) / TILE);
                const gfx = row * PAL_COLS + col;
                if (cellFromGfx(gfx) === null) {
                    return;
                } // non-encodable
                this.selectedGfx = gfx;
                renderPalette(gfx);
            });
        },
    };

    return app;
}

createApp(makeApp()).mount('#editor');
