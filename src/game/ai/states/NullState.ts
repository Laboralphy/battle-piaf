import { IState } from '../fsm/IState.js';
import { AIContext } from '../AIContext.js';

/** Does nothing. Active when PROFILE_NULL is used. */
export class NullState implements IState<AIContext> {
    onEnter(_ctx: AIContext): void {}
    onUpdate(ctx: AIContext): IState<AIContext> | null {
        ctx.input.releaseAll();
        return null;
    }
    onExit(_ctx: AIContext): void {}
}
