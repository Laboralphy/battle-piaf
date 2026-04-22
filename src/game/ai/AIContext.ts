import { WDPlayer } from '../WDPlayer.js';
import { FairyMatrix } from '../../engine/FairyMatrix.js';
import { NavGraph } from './navigation/NavGraph.js';
import { NavQuery } from './navigation/NavQuery.js';
import { NavTopology } from './navigation/NavTopology.js';
import { NavEdge } from './navigation/NavEdge.js';
import { AIInput } from './AIInput.js';
import { AIProfile } from './AIProfile.js';

/**
 * Shared context object passed to every AI state each tick.
 * States read world data from it and write movement decisions to `input`.
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
    /**
     * Current planned path as an ordered list of edges to traverse.
     * States consume edges from the front as waypoints are reached.
     */
    path: NavEdge[];
    /** Ticks remaining before the path is replanned. */
    replanCooldown: number;
    /** Active behavior profile (set at construction, never changed). */
    profile: AIProfile;
    /** USe this to display navgraph information */
    debugCanvas?: HTMLCanvasElement;
}
