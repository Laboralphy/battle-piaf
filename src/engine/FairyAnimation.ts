/** Animation playback mode. */
export const enum LoopType {
    /** No animation; the frame stays fixed. */
    None = 0,
    /** Frames advance from start to end, then loop (or stop after `nLoopCount` passes). */
    Forward = 1,
    /** Frames advance from end to start, then loop. */
    Backward = 2,
    /** Frames ping-pong between start and end. */
    Yoyo = 3,
}

/**
 * Drives frame-based sprite animation.
 * Each tick, `proceed()` advances an internal elapsed counter and advances
 * `nFrameIndex` when the counter reaches `nFrameDuration`.
 * The rendered source X is `(nFrameIndex + nFrameStart) * spriteWidth + xSrc`.
 */
export class FairyAnimation {
    /** Current frame offset within the range (0 … nFrameCount-1). */
    nFrameIndex = 0;
    /** First tile index in the sprite sheet (column in sprite-width units). */
    nFrameStart = 0;
    /** Number of frames in this animation clip. */
    nFrameCount = 0;
    /** Number of ticks each frame is held before advancing. */
    nFrameDuration = 0;
    /** Accumulated ticks since the last frame advance. */
    nFrameElapsed = 0;
    /** How many frames to advance per tick (usually 1 or -1). */
    nFrameIncrement = 0;
    /** Current direction of travel through frames (+1 forward, -1 backward, 0 stopped). */
    nLoopDirection = 0;
    /** Playback mode (None / Forward / Backward / Yoyo). */
    nLoopType: LoopType = LoopType.None;
    /** Remaining loop repetitions (ignored when `bEternal` is true). */
    nLoopCount = 0;
    /** Initial number of loops set at construction. */
    nLoopInitialCount = 0;
    /** Frame index frozen at when the animation ends (`bOver` becomes true). */
    nLoopFinalFrame = 0;
    /** True once the animation has played through all its loops. */
    bOver = false;
    /** True when `nLoopInitialCount === 0`, meaning the animation loops forever. */
    bEternal = false;
    /** Set to true for one tick whenever `nFrameIndex` changes. Consumed by `isFrameChanged`. */
    bFrameChanged = false;

    /** Pixel offset added to the source X when sampling the sprite sheet. */
    xSrc = 0;
    /** Pixel offset added to the source Y when sampling the sprite sheet. */
    ySrc = 0;

    /** Internal handler called when a loop boundary is reached. */
    private _loopHandler: () => void = () => {};

    /**
     * Set the clip range: the first frame tile index and the number of frames.
     * Resets `nFrameIndex` to 0.
     */
    setFrameRange(start: number, count: number): void {
        this.nFrameStart = start;
        this.nFrameCount = count;
        this.nFrameIndex = 0;
    }

    /**
     * Set a pixel offset within the sprite sheet, applied in addition to the
     * frame-stride calculation.  Useful for addressing rows that don't start at y=0
     * or for sheets where tiles of different sizes coexist.
     */
    setFrameSource(x: number, y: number): void {
        this.xSrc = x;
        this.ySrc = y;
    }

    /** Configure the animation to play once and then freeze on the last frame. */
    setNoLoop(): void {
        this.setLoop(LoopType.None, 0, 0, 1);
    }

    /**
     * Configure playback parameters and reset the animation to frame 0.
     * @param type  - Loop mode.
     * @param inc   - Frame increment per tick (usually 1).
     * @param dur   - Ticks per frame.
     * @param count - Number of full passes before stopping (0 = infinite).
     */
    setLoop(type: LoopType, inc: number, dur: number, count: number): void {
        this.nLoopType = type;
        this.nFrameDuration = dur;
        this.nFrameIncrement = inc;
        this.nLoopInitialCount = count;
        this.resetLoop();
    }

    /** Reset the animation back to frame 0 and restart the loop counter. */
    resetLoop(): void {
        this.bOver = false;
        this.nFrameIndex = 0;
        this.nFrameElapsed = 0;
        this.bEternal = this.nLoopInitialCount === 0;
        this.nLoopCount = this.bEternal ? 1 : this.nLoopInitialCount;

        switch (this.nLoopType) {
            case LoopType.None: {
                this.nLoopDirection = 0;
                this._loopHandler = () => this._proceedLoopNone();
                break;
            }
            case LoopType.Forward: {
                this.nLoopDirection = 1;
                this._loopHandler = () => this._proceedLoopForward();
                break;
            }
            case LoopType.Backward: {
                this.nLoopDirection = -1;
                this._loopHandler = () => this._proceedLoopBackward();
                break;
            }
            case LoopType.Yoyo: {
                this.nLoopDirection = 1;
                this._loopHandler = () => this._proceedLoopYoyo();
                break;
            }
            default: {
                throw new ReferenceError(`Invalid loop type: ${this.nLoopType}`);
            }
        }
    }

    /**
     * Advance the animation by one tick.
     * Has no effect when `bOver` is true or `nFrameIncrement` is 0.
     */
    proceed(): void {
        if (this.bOver || this.nFrameIncrement === 0) {
            return;
        }
        this.nFrameElapsed += this.nFrameIncrement;
        const prevFrame = this.nFrameIndex;
        while (this.nFrameElapsed >= this.nFrameDuration) {
            this._proceedFrame();
            this.nFrameElapsed -= this.nFrameDuration;
        }
        this.bFrameChanged ||= prevFrame !== this.nFrameIndex;
    }

    /**
     * Returns true if the frame changed since the last call and clears the flag.
     * Used by `FairyTile` to know when to redraw.
     */
    isFrameChanged(): boolean {
        const changed = this.bFrameChanged;
        this.bFrameChanged = false;
        return changed;
    }

    /** Advance by one frame unit and handle loop boundaries. */
    private _proceedFrame(): void {
        this.nFrameIndex += this.nLoopDirection;
        if (this.nFrameIndex >= this.nFrameCount || this.nFrameIndex < 0) {
            if (!this.bEternal) {
                this.bOver = --this.nLoopCount <= 0;
            }
            if (this.bOver) {
                this.nFrameIndex = this.nLoopFinalFrame;
            } else {
                this._loopHandler();
            }
        }
    }

    /** Loop boundary handler for LoopType.None: stop advancing. */
    private _proceedLoopNone(): void {
        this.nLoopDirection = 0;
    }

    /** Loop boundary handler for LoopType.Forward: wrap to frame 0. */
    private _proceedLoopForward(): void {
        this.nLoopDirection = 1;
        this.nFrameIndex = 0;
    }

    /** Loop boundary handler for LoopType.Backward: wrap to last frame. */
    private _proceedLoopBackward(): void {
        this.nLoopDirection = -1;
        this.nFrameIndex = this.nFrameCount - 1;
    }

    /** Loop boundary handler for LoopType.Yoyo: reverse direction and step one frame. */
    private _proceedLoopYoyo(): void {
        if (this.nLoopDirection > 0) {
            this._proceedLoopBackward();
        } else {
            this._proceedLoopForward();
        }
        this.nFrameIndex += this.nLoopDirection;
    }
}
