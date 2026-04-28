import { WDGame } from '../game/WDGame.js';
import { Marquee } from './Marquee.js';
import { MARQUEE_TEXT } from './text';

function setActive(id: string, active: boolean): void {
    document.getElementById(id)?.setAttribute('data-active', String(active));
}

function gameStart(aiControlled: boolean): void {
    setActive('menu', false);
    setActive('game-screen', true);
    setActive('round-timer', true);
    setActive('controls', true);

    const game = new WDGame({ aiControlled });
    game.start();
}

export function initMenu(): void {
    const menuEl = document.getElementById('menu');
    if (menuEl) {
        new Marquee(menuEl, MARQUEE_TEXT);
    }

    document.getElementById('btn-1p')?.addEventListener('click', () => gameStart(true));
    document.getElementById('btn-2p')?.addEventListener('click', () => gameStart(false));
}
