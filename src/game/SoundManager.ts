import { Howl } from 'howler';

/**
 * Maps each sound ID to its channel and [ogg, mp3] source pairs.
 * Sounds on the same channel are mutually exclusive: playing one stops the previous.
 * Sounds with no channel (null) always play freely on top of everything else.
 */
const SOUND_SRCS: Record<string, { channel: string | null; srcs: string[][] }> = {
    'shoot-bullet': { channel: 'shoot', srcs: [['ogg/shoot-3.ogg', 'mp3/shoot-3.mp3']] },
    'shoot-plasma': { channel: 'shoot', srcs: [['ogg/shoot-6.ogg', 'mp3/shoot-6.mp3']] },
    'shoot-missile': { channel: 'missile', srcs: [['ogg/missile-1.ogg', 'mp3/missile-1.mp3']] },
    'shoot-grenade': { channel: 'missile', srcs: [['ogg/shoot-8.ogg', 'mp3/shoot-8.mp3']] },
    'shoot-flame': {
        channel: 'missile',
        srcs: [['ogg/ignite-dynamite.ogg', 'mp3/ignite-dynamite.mp3']],
    },
    'explosion-missile': {
        channel: 'explosion',
        srcs: [['ogg/explosion-charge.ogg', 'mp3/explosion-charge.mp3']],
    },
    'explosion-die': {
        channel: 'explosion',
        srcs: [['ogg/explosion-0.ogg', 'mp3/explosion-0.mp3']],
    },
    jump: { channel: 'jump', srcs: [['ogg/jump-0.ogg', 'mp3/jump-0.mp3']] },
    land: {
        channel: 'jump',
        srcs: [['ogg/smooth-landing-sand.ogg', 'mp3/smooth-landing-sand.mp3']],
    },
    hit: { channel: 'hit', srcs: [['ogg/hit-gravel.ogg', 'mp3/hit-gravel.mp3']] },
    hurt: { channel: 'hit', srcs: [['ogg/alert-0.ogg', 'mp3/alert-0.mp3']] },
    pick: { channel: null, srcs: [['ogg/pick-0.ogg', 'mp3/pick-0.mp3']] },
    spawn: { channel: null, srcs: [['ogg/spawn-0.ogg', 'mp3/spawn-0.mp3']] },
    'laughing-skull': {
        channel: null,
        srcs: [['ogg/laughing-skull.ogg', 'mp3/laughing-skull.mp3']],
    },
};

/** The set of named sounds available in the game. */
export type SoundId = keyof typeof SOUND_SRCS;

/**
 * Thin wrapper around Howler that loads all game sounds at construction time
 * and plays a random variant on demand.
 *
 * Sounds assigned to a channel are mutually exclusive within that channel:
 * playing a new sound stops the previously playing one on the same channel.
 * Sounds with channel null always layer freely.
 */
export class SoundManager {
    /** Map from sound ID to the array of `Howl` instances for each variant. */
    private _variants: Map<SoundId, Howl[]> = new Map();
    /** Currently playing Howl per channel name. */
    private _channelActive: Map<string, Howl> = new Map();

    /**
     * Load all sound variants from `basePath`.
     * @param basePath - Root folder that contains `ogg/` and `mp3/` sub-folders.
     */
    constructor(basePath = 'assets/sounds') {
        for (const [id, { srcs }] of Object.entries(SOUND_SRCS) as [
            SoundId,
            { channel: string | null; srcs: string[][] },
        ][]) {
            this._variants.set(
                id,
                srcs.map(
                    (s) =>
                        new Howl({
                            src: s.map((f) => `${basePath}/${f}`),
                            preload: true,
                        })
                )
            );
        }
    }

    /** Currently playing background music instance, or null if none. */
    private _bgm: Howl | null = null;

    /**
     * Start streaming a background music file.
     * Stops any previously playing BGM first.
     * @param src - Path(s) to the music file (e.g. ['assets/musics/theme.ogg', 'assets/musics/theme.mp3']).
     * @param volume - Playback volume, 0.0–1.0 (default 0.5).
     */
    startBGM(src: string | string[], volume = 0.5): void {
        this.stopBGM();
        this._bgm = new Howl({
            src: Array.isArray(src) ? src : [src],
            html5: true,
            loop: true,
            volume,
        });
        this._bgm.play();
    }

    /** Stop and unload the current background music, if any. */
    stopBGM(): void {
        if (this._bgm) {
            this._bgm.stop();
            this._bgm.unload();
            this._bgm = null;
        }
    }

    /**
     * Play a random variant of the named sound.
     * If the sound belongs to a channel, any sound currently playing on that
     * channel is stopped first. Silently ignored if the sound ID is unknown.
     */
    play(id: SoundId): void {
        const entry = SOUND_SRCS[id];
        const variants = this._variants.get(id);
        if (!variants?.length) {
            return;
        }
        if (entry.channel !== null) {
            this._channelActive.get(entry.channel)?.stop();
        }
        const howl = variants[Math.floor(Math.random() * variants.length)];
        howl.play();
        if (entry.channel !== null) {
            this._channelActive.set(entry.channel, howl);
        }
    }
}
