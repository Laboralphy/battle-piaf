import { WDPlayer } from '../entities/WDPlayer';
import { WDCrate } from '../entities/WDCrate';
import { FairyMatrix } from '../../engine/FairyMatrix.js';
import { NavGraph } from './navigation/NavGraph.js';
import { NavQuery } from './navigation/NavQuery.js';
import { NavTopology } from './navigation/NavTopology.js';
import { AIInput } from './AIInput.js';
import { AIProfile } from './AIProfile.js';

/**
 * Shared context object passed to every AI state each tick.
 * States read world data from it and write movement decisions to `input`.
 *
 * Path and per-state data are passed between states via constructor injection,
 * not stored here. This keeps the context lean and ownership explicit.
 */
export interface AIContext {
    /** The AI-controlled player sprite. */
    player: WDPlayer;
    /** The human opponent sprite. */
    opponent: WDPlayer;
    /** Virtual keyboard the AI writes to before `player.updateState()` is called. */
    input: AIInput;
    /** The arena tile map, used for spatial queries. */
    land: FairyMatrix;
    /** Navigation graph (built once from the tile map). */
    graph: NavGraph;
    /** A* pathfinder. */
    query: NavQuery;
    /** Platform topology derived from the nav graph. */
    topology: NavTopology;
    /** Active behavior profile (set at construction, never changed). */
    profile: AIProfile;
    /** Returns the list of currently live crates. Called each tick so it always reflects the latest state. */
    crates: () => readonly WDCrate[];
    /** Optional canvas for NavGraph debug overlay. */
    debugCanvas?: HTMLCanvasElement;
}
