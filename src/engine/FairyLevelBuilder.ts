import { FairyMatrix } from './FairyMatrix.js';
import { LoopType } from './FairyAnimation.js';

/** Stored animation parameters for a specific two-character tile code. */
interface AnimDef {
    frameStart: number;
    frameCount: number;
    loopType: LoopType;
    loopInc: number;
    loopDur: number;
    loopCount: number;
}

/**
 * Parses a text-based level description and populates a `FairyMatrix`.
 *
 * Each cell in the level string is encoded as two characters:
 * - **Character 1** (base-62 tile index): maps into the `CODES` alphabet to give
 *   a raw tile index (0–61).
 * - **Character 2** (meta code): one of `.*#@%$` which encodes the collision code
 *   (0–5) and, scaled by `nMetaMultiplier`, is added to the tile index to select
 *   the correct row in the sprite sheet.
 *
 * Meta code semantics (as used by the game):
 * - `.` (0) – non-solid (air / decorative)
 * - `*` (1) – semi-solid (floor only: blocks falling, passable from below/sides)
 * - `#` (2) – fully solid (blocks from all directions)
 * - `@`, `%`, `$` (3–5) – reserved / game-specific
 *
 * Tile animations can be registered with `addAnimation` before calling `build`.
 * Any cell whose two-character code matches a registered animation will have
 * that animation applied to its `FairyTile`.
 */
export class FairyLevelBuilder {
    /** Base-62 alphabet mapping the first character of each cell to a tile index. */
    private static readonly CODES =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // 62 chars
    /**
     * Ordered list of meta characters.  The index of a character in this string
     * is the collision code stored in the tile, and `index * nMetaMultiplier` is
     * added to the base tile index to address the correct sprite-sheet row.
     */
    private static readonly META_CODES = '.*#@%$';

    /**
     * Multiplier applied to the meta-code index when computing the final tile
     * graphic index.  Should match the number of tile variants per row in the
     * sprite sheet (e.g. 120 means each meta row starts 120 tiles apart).
     */
    nMetaMultiplier = 64;

    /** The matrix to populate. Must be set before calling `build`. */
    private _matrix: FairyMatrix | null = null;
    /** Map from two-character codes to animation parameters. */
    private _anims = new Map<string, AnimDef>();

    /** Set the target tile matrix. */
    setMatrix(matrix: FairyMatrix): void {
        this._matrix = matrix;
    }

    /**
     * Register an animation for all tiles whose two-character code matches `code`.
     * @param code       - Two-character tile code (e.g. `'K.'`).
     * @param frameStart - First frame index in the sprite sheet.
     * @param frameCount - Number of frames in the animation.
     * @param loopType   - Playback mode.
     * @param loopInc    - Frame increment per tick.
     * @param loopDur    - Ticks per frame.
     * @param loopCount  - Number of passes (0 = infinite).
     */
    addAnimation(
        code: string,
        frameStart: number,
        frameCount: number,
        loopType: LoopType,
        loopInc: number,
        loopDur: number,
        loopCount: number
    ): void {
        this._anims.set(code, { frameStart, frameCount, loopType, loopInc, loopDur, loopCount });
    }

    /**
     * Parse the level rows and write every cell into the matrix.
     * Each row string must be exactly `cols * 2` characters long.
     * A leading space in the first character is treated as `'0'` (tile index 0).
     */
    build(rows: string[]): void {
        const matrix = this._matrix!;
        for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            const colCount = Math.floor(row.length / 2);
            for (let x = 0; x < colCount; x++) {
                let c1 = row[x * 2];
                const c2 = row[x * 2 + 1];
                const code = c1 + c2;

                if (c1 === ' ') {c1 = '0';}
                const n1 = FairyLevelBuilder.CODES.indexOf(c1);
                const n2 = FairyLevelBuilder.META_CODES.indexOf(c2) * this.nMetaMultiplier;

                matrix.setTileGfx(x, y, n1 + n2);
                matrix.setTileCode(x, y, FairyLevelBuilder.META_CODES.indexOf(c2));

                const anim = this._anims.get(code);
                if (anim) {
                    const tileAnim = matrix.getTile(x, y).oAnimation;
                    tileAnim.setFrameRange(anim.frameStart, anim.frameCount);
                    tileAnim.setLoop(anim.loopType, anim.loopInc, anim.loopDur, anim.loopCount);
                }
            }
        }
    }
}
