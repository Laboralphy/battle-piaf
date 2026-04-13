import {LoopType} from "../engine/FairyAnimation";


export type AnimationLoop = {
    type: LoopType,
    inc: number,
    dur: number,
    count: number
}

export type AnimationDefinition = {
    start: number,
    count: number,
    loop: AnimationLoop
}

export type TileAnimationDefinition = {
    tileset: string,
    animations: Record<string, AnimationDefinition>
}

export const TILE_ANIMATIONS: Record<string, TileAnimationDefinition> = {
    wdbob_land0_z2: {
        tileset: 'assets/images/land-tiles/wdbob_land0_z2.png',
        animations: {
            'K.': {
                start: 20,
                count: 3,
                loop: {
                    type: LoopType.Yoyo,
                    inc: 1,
                    dur: 20,
                    count: 0
                }
            },
            'N.': {
                start: 23,
                count: 2,
                loop: {
                    type: LoopType.Yoyo,
                    inc: 1,
                    dur: 64,
                    count: 0
                }
            },
            'Q.': {
                start: 26,
                count: 3,
                loop: {
                    type: LoopType.Yoyo,
                    inc: 1,
                    dur: 8,
                    count: 0
                }
            }
        }
    }
}
