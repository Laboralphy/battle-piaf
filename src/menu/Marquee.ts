const SCROLL_SPEED_PX_S = 130; // pixels per second — tweak to taste

export class Marquee {
    private readonly _span: HTMLSpanElement;
    private readonly _messages: string[];
    private _index = 0;

    constructor(parent: HTMLElement, messages: string[]) {
        this._messages = messages;

        const bar = document.createElement('div');
        bar.className = 'marquee-bar';

        this._span = document.createElement('span');
        this._span.className = 'marquee-text';
        bar.appendChild(this._span);
        parent.appendChild(bar);

        this._span.addEventListener('animationend', () => {
            this._index = (this._index + 1) % this._messages.length;
            this._play();
        });

        this._play();
    }

    private _play(): void {
        const text = this._messages[this._index];
        this._span.textContent = text;

        // Reset animation so it restarts cleanly on every message
        this._span.style.animation = 'none';
        void this._span.offsetWidth; // force reflow

        // Compute duration from text width + viewport width for constant speed
        const distance = window.innerWidth + this._span.scrollWidth;
        const duration = distance / SCROLL_SPEED_PX_S;
        this._span.style.animation = `marquee-scroll ${duration.toFixed(2)}s linear`;
    }
}
