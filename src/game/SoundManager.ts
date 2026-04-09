import { Howl } from 'howler';

/**
 * Maps each sound ID to explicit [ogg, mp3] source pairs for each variant.
 * To add a new variant, drop the files in the sounds folders and add an entry here.
 */
const SOUND_SRCS: Record<string, string[][]> = {
    jump: [['ogg/jump-0.ogg', 'mp3/jump-0.mp3']],
    'shoot-bullet': [['ogg/shoot-2.ogg', 'mp3/shoot-2.mp3']],
    'shoot-missile': [['ogg/missile-1.ogg', 'mp3/missile-1.mp3']],
    hit: [['ogg/impact-1.ogg', 'mp3/impact-1.mp3']],
    'explosion-missile': [['ogg/impact-3.ogg', 'mp3/impact-3.mp3']],
    'shoot-grenade': [['ogg/missile-0.ogg', 'mp3/missile-0.mp3']],
    hurt: [['ogg/alert-0.ogg', 'mp3/alert-0.mp3']],
};

/** The set of named sounds available in the game. */
export type SoundId = keyof typeof SOUND_SRCS;

/**
 * Thin wrapper around Howler that loads all game sounds at construction time
 * and plays a random variant on demand.
 */
export class SoundManager {
    /** Map from sound ID to the array of `Howl` instances for each variant. */
    private _variants: Map<SoundId, Howl[]> = new Map();

    /**
     * Load all sound variants from `basePath`.
     * @param basePath - Root folder that contains `ogg/` and `mp3/` sub-folders.
     */
    constructor(basePath = 'assets/sounds') {
        for (const [id, srcSets] of Object.entries(SOUND_SRCS) as [SoundId, string[][]][]) {
            this._variants.set(
                id,
                srcSets.map(
                    (srcs) =>
                        new Howl({
                            src: srcs.map((s) => `${basePath}/${s}`),
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
        if (!variants?.length) {
            return;
        }
        const howl = variants[Math.floor(Math.random() * variants.length)];
        howl.play();
    }
}
