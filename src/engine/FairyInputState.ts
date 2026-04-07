/** Snapshot of the mouse cursor state. */
export interface MouseState {
    /** Cursor X position in client (viewport) coordinates. */
    x: number;
    /** Cursor Y position in client (viewport) coordinates. */
    y: number;
    /** Button states indexed by button number (0 = primary, 1 = middle, 2 = secondary). */
    b: boolean[];
}

/**
 * Flat snapshot of all keyboard and mouse input.
 * Updated directly by the engine's `keydown`/`keyup`/`mousemove`/`mousedown`/`mouseup`
 * event listeners.  Game code reads state via `getKeyState`; it can also
 * consume a key press by calling `setKeyState(key, false)` to prevent
 * auto-repeat while the key is held.
 */
export class FairyInputState {
    /** Key-down state for key codes 0–255. */
    private _keys: boolean[] = new Array(256).fill(false);
    /** Current mouse cursor and button state. */
    private _mouse: MouseState = { x: 0, y: 0, b: [false, false, false, false] };

    /** Return true if the key with the given key code is currently pressed. */
    getKeyState(key: number): boolean {
        return this._keys[key] ?? false;
    }

    /** Set the pressed/released state for the given key code. */
    setKeyState(key: number, state: boolean): void {
        this._keys[key] = state;
    }

    /** Return the full mouse state object. */
    getMouseState(): MouseState {
        return this._mouse;
    }

    /** Update the mouse cursor position. */
    setMouseXY(x: number, y: number): void {
        this._mouse.x = x;
        this._mouse.y = y;
    }

    /** Set the pressed/released state for the given mouse button. */
    setMouseButton(button: number, state: boolean): void {
        this._mouse.b[button] = state;
    }
}
