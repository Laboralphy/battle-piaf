import { WDGame } from '../game/WDGame.js';
import { Marquee } from './Marquee.js';
import { MARQUEE_TEXT } from './text';
import { LEVELS } from '../game/levels.js';

function setActive(id: string, active: boolean): void {
    document.getElementById(id)?.setAttribute('data-active', String(active));
}

export function initMenu(): void {
    const menuEl = document.getElementById('menu');
    if (menuEl) {
        new Marquee(menuEl, MARQUEE_TEXT);
    }
}

export function gameStart(): void {
    globalThis.removeEventListener('keydown', gameStart);
    setActive('menu', false);
    setActive('game-screen', true);
    setActive('controls', true);

    const game = new WDGame({ aiControlled: true });
    game.start();
}
