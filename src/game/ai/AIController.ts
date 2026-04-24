import { Observer } from '../../core/Observer.js';
import { WDPlayer, PlayerKeys } from '../entities/WDPlayer';
import { WDCrate } from '../entities/WDCrate';
import { FairyMatrix } from '../../engine/FairyMatrix.js';
import { AIInput } from './AIInput.js';
import { AIContext } from './AIContext.js';
import { AIProfile, PROFILE_NULL } from './AIProfile.js';
import { StateMachine } from './fsm/StateMachine.js';
import { IState } from './fsm/IState.js';
import { NavGraph } from './navigation/NavGraph.js';
import { NavQuery } from './navigation/NavQuery.js';
import { NavTopology } from './navigation/NavTopology.js';
import { ChaseChoosePlatformState } from './states/ChaseChoosePlatformState.js';
import { BasicState } from './states/BasicState.js';
import { NullState } from './states/NullState.js';
import { EvadeState } from './states/EvadeState.js';

/**
 * AI brain for one player.
 *
 * The `profile` parameter determines the overall behavior style.
 * Use one of the preset profiles from `AIProfile.ts` or supply a custom object.
 *
 * Usage (once per tick, before `player.updateState`):
 * ```ts
 * aiController.update();
 * player.updateState(aiController.input);
 * ```
 */
export class AIController {
    /** Virtual keyboard fed into the player's `updateState`. */
    readonly input: AIInput;
    private readonly _fsm: StateMachine<AIContext>;
    private readonly _ctx: AIContext;

    /**
     * @param player   - The AI-controlled WDPlayer.
     * @param opponent - The player the AI targets.
     * @param land     - The arena tile map (must already be populated).
     * @param keys     - Key bindings assigned to `player` (same as in WDGame).
     * @param profile  - Behavior profile. Defaults to PROFILE_HUNTER.
     * @param debugCanvas - Use this to print debug information
     */
    constructor(
        player: WDPlayer,
        opponent: WDPlayer,
        land: FairyMatrix,
        keys: PlayerKeys,
        profile: AIProfile,
        debugCanvas: HTMLCanvasElement,
        getCrates: () => WDCrate[] = () => []
    ) {
        this.input = new AIInput(keys);

        const graph = new NavGraph();
        graph.build(land);

        const topology = new NavTopology();
        topology.build(graph.nodes, land);

        this._ctx = {
            player,
            opponent,
            input: this.input,
            land,
            graph,
            query: new NavQuery(),
            topology,
            profile,
            crates: getCrates,
            debugCanvas,
        };

        this._fsm = new StateMachine<AIContext>(this._ctx);
        this._fsm.transition(this._initialState(profile));

        // React to hits: switch to EvadeState if the profile calls for it.
        if (profile.evadeOnHit) {
            player.oObservatory.attach(
                'damaged',
                new Observer(this, () => {
                    this._fsm.transition(new EvadeState());
                })
            );
        }
    }

    /**
     * Tick the AI.
     * Must be called once per game tick **before** `player.updateState(this.input)`.
     */
    update(): void {
        this._fsm.update();
    }

    /** Choose the opening state based on the profile's navigation strategy. */
    private _initialState(profile: AIProfile): IState<AIContext> {
        switch (profile.initialState) {
            case 'null': {
                return new NullState();
            }
            case 'basic': {
                return new BasicState();
            }
            case 'chase':
            case 'chase-debug': {
                return new ChaseChoosePlatformState();
            }
            default: {
                throw new ReferenceError(`${profile.initialState} is unknown state`);
            }
        }
    }
}
