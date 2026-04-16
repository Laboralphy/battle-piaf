import { LoopType } from '../engine/FairyAnimation';
import TILES from '../data/tilesets.json';

export type AnimationLoop = {
    type: LoopType;
    inc: number;
    dur: number;
    count: number;
};

export type AnimationDefinition = {
    start: number;
    count: number;
    loop: AnimationLoop;
};

export type TileAnimationDefinition = {
    image: string;
    animations: Record<string, AnimationDefinition>;
};

export const TILE_DATA: Record<string, TileAnimationDefinition> = TILES;
