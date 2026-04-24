import { Vector2D } from '../../core/Vector2D';
import { FairyAnimation } from '../../engine/FairyAnimation';
import { FairyCollisionRect } from '../../engine/FairyCollision';
import { Fairy, FairyBaseEvents } from '../../engine/Fairy';
import { WDPlayer } from './WDPlayer';
import { PHYSICAL_TILE_SIZE, TILE_SIZE } from '../consts';

/** What the crate contains. Determines the icon drawn on it and the effect on pickup. */
export const enum CrateBonus {
    HEAL = 0,
    SHIELD = 1,
    POWERUP = 2,
    MULTICRATE = 3,
}

/**
 * Event map for the crate sprite.
 * Extends `FairyBaseEvents` with a `'picked'` event carrying the player who
 * collected the crate.
 */
export type WDCrateEvents = FairyBaseEvents & {
    /** Emitted when a player touches the crate, before the crate is marked dead. */
    picked: { player: WDPlayer };
};

/**
 * A static power-up crate that appears on top of solid or semi-solid tiles.
 *
 * Sprite sheet: `wdspr_fire_z2.png`, 16×16 source tile, rendered at 1× (16×16).
 * Tile index 2, single frame, no animation.
 *
 * Tangibility mask 7 (111b) ensures it collides with both players
 * (player 0 = 101b, player 1 = 110b).
 *
 * When a player walks into the crate, call `pickup(player)` to emit the
 * `'picked'` event and mark the crate for removal.  WDGame listens to this
 * event to apply the power-up effect.
 */
export class WDCrate extends Fairy<WDCrateEvents> {
    readonly bonus: CrateBonus;
    /** Remaining ticks before the crate expires on its own. Set by WDGame at spawn time. */
    ttl = 0;

    constructor(bonus: CrateBonus) {
        super();
        this.bonus = bonus;

        this.setSize(TILE_SIZE / 2, TILE_SIZE / 2);
        this.setScale(1);
        // vReference at (8, 8): centre of the rendered 16×16 sprite.
        this.vReference.set(8, 7);

        // Constant downward gravity, same as players.
        this.oFlight.vAccel.set(0, 0.25);

        // Single static frame at tile index 2.
        const anim = new FairyAnimation();
        anim.setFrameRange(2, 1);
        anim.setNoLoop();
        this.aAnimations.push(anim);
        this.playAnimation(0);

        // Collide with both players: mask 7 (111b) & player 5 (101b) = 5 ≠ 0,
        //                                           mask 7 (111b) & player 6 (110b) = 6 ≠ 0.
        this.setBoundingShape(new FairyCollisionRect(new Vector2D(-8, -8), new Vector2D(8, 8)), 7);
    }

    /**
     * Place the crate on top of the solid tile at grid position `(col, row)`.
     * The crate's centre is horizontally centred over the tile and sits flush
     * against its top edge.
     * @param col - Tile column index (0-based).
     * @param row - Tile row index (0-based); the crate appears above this row.
     * @param tileSize - Size of a single tile in pixels (default 32).
     */
    placeOnTile(col: number, row: number, tileSize = PHYSICAL_TILE_SIZE): void {
        this.oFlight.vPosition.set(
            col * tileSize + tileSize / 2, // horizontally centred over the tile
            row * tileSize - 8 // vertically: bottom of 16px crate flush with tile top
        );
    }

    /**
     * Notify the `'picked'` event and mark the crate for removal.
     * Called by `WDGame` when a player's collision rect overlaps this crate.
     * @param player - The player who collected the crate.
     */
    pickup(player: WDPlayer): void {
        this.oObservatory.notify(this, 'picked', { player });
        this.bDead = true;
    }
}
