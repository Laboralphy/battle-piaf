import { Howl } from 'howler';

/** The set of named sounds available in the game. */
export type SoundId = 'jump' | 'shoot' | 'hit';

/**
 * Maps each sound ID to the numbered file variants available for it
 * (e.g. `jump: [0]` means only `jump-0.ogg/mp3` exists).
 * To add a new variation, drop the file in the sounds folders and add its index here.
 */
const SOUND_VARIANTS: Record<SoundId, number[]> = {
    jump: [0],
    shoot: [0],
    hit: [0],
};

/**
 * Thin wrapper around Howler that loads all game sounds at construction time
 * and plays a random variant on demand.
 * Each sound is pre-loaded as both OGG and MP3 for broad browser support.
 */
export class SoundManager {
    /** Map from sound ID to the array of `Howl` instances for each variant. */
    private _variants: Map<SoundId, Howl[]> = new Map();

    /**
     * Load all sound variants from `basePath`.
     * @param basePath - Root folder that contains `ogg/` and `mp3/` sub-folders.
     */
    constructor(basePath = 'assets/sounds') {
        for (const [id, indices] of Object.entries(SOUND_VARIANTS) as [SoundId, number[]][]) {
            this._variants.set(
                id,
                indices.map(
                    (i) =>
                        new Howl({
                            src: [
                                `${basePath}/ogg/${id}-${i}.ogg`,
                                `${basePath}/mp3/${id}-${i}.mp3`,
                            ],
                            html5: true,
                        })
                )
            );
        }
    }

    /**
     * Play a random variant of the named sound.
     * Silently ignored if the sound ID has no registered variants.
     */
    play(id: SoundId): void {
        const variants = this._variants.get(id);
        if (!variants?.length) {return;}
        const howl = variants[Math.floor(Math.random() * variants.length)];
        howl.play();
    }
}
