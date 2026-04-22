import { FairyInputState } from '../../engine/FairyInputState.js';
import { PlayerKeys } from '../WDPlayer.js';

/**
 * Virtual input layer for an AI-controlled player.
 * Extends `FairyInputState` so it can be passed directly to
 * `WDPlayer.updateState()` in place of the keyboard input.
 *
 * The AI writes to this each tick via the helper methods,
 * then hands it to the player's `updateState`.
 */
export class AIInput extends FairyInputState {
    private readonly _bindings: PlayerKeys;

    constructor(keys: PlayerKeys) {
        super();
        this._bindings = keys;
    }

    /** Clear all action keys at the start of each tick before the AI writes new ones. */
    releaseAll(): void {
        this.setKeyState(this._bindings.left, false);
        this.setKeyState(this._bindings.right, false);
        this.setKeyState(this._bindings.up, false);
        this.setKeyState(this._bindings.fire, false);
        if (this._bindings.down !== undefined) {
            this.setKeyState(this._bindings.down, false);
        }
    }

    pressLeft(): void { this.setKeyState(this._bindings.left, true); }
    pressRight(): void { this.setKeyState(this._bindings.right, true); }
    /** Request a jump. Only takes effect when the player is on the floor. */
    pressJump(): void { this.setKeyState(this._bindings.up, true); }
    pressFire(): void { this.setKeyState(this._bindings.fire, true); }
    /** Request a drop-through on semi-solid platforms. */
    pressDrop(): void {
        if (this._bindings.down !== undefined) {
            this.setKeyState(this._bindings.down, true);
        }
    }
}
