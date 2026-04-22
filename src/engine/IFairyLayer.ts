/** A layer that can be ticked and rendered each frame. */
export interface IFairyLayer {
    proceed(): void;
    render(): void;
}
