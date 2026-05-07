export class WinnerScreen {
    cvsRender: HTMLCanvasElement | null = null;
    cvsBg: HTMLCanvasElement;
    cvsText: HTMLCanvasElement;
    cvsFader: HTMLCanvasElement;

    constructor(width: number, height: number) {
        this.cvsBg = document.createElement('canvas');
        this.cvsBg.width = width;
        this.cvsBg.height = height;

        this.cvsText = document.createElement('canvas');
        this.cvsText.width = width;
        this.cvsText.height = height;

        this.cvsFader = document.createElement('canvas');
        this.cvsFader.width = width;
        this.cvsFader.height = height;
    }

    captureRenderingScreen(cvs: HTMLCanvasElement): void {
        this.cvsRender = cvs;
        const ctx = this.cvsBg.getContext('2d')!;
        ctx.clearRect(0, 0, this.cvsBg.width, this.cvsBg.height);
        ctx.drawImage(cvs, 0, 0);
    }

    renderScore(winner: string, score1: number, score2: number): void {
        const ctx = this.cvsText.getContext('2d')!;
        const w = this.cvsText.width;
        const h = this.cvsText.height;
        ctx.clearRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(winner, w / 2, h / 2 - 20);
        ctx.font = '14px monospace';
        ctx.fillText(`${score1}  —  ${score2}`, w / 2, h / 2 + 32);
    }

    doFade(time: number): void {
        const ctx = this.cvsFader.getContext('2d')!;
        const w = this.cvsFader.width;
        const h = this.cvsFader.height;
        ctx.clearRect(0, 0, w, h);
        // time 0 → white, full opacity
        // time 0.5 → gray (127,127,127), 75% alpha
        // time 1 → black, 50% alpha
        const t = Math.max(0, Math.min(1, time));
        const channel = Math.round(255 * (1 - t));
        const alpha = t <= 0.5 ? 1 - t * 0.5 : 0.75 - (t - 0.5) * 0.5;
        ctx.fillStyle = `rgba(${channel},${channel},${channel},${alpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    render(): void {
        if (!this.cvsRender) {
            return;
        }
        const ctx = this.cvsRender.getContext('2d')!;
        const w = this.cvsRender.width;
        const h = this.cvsRender.height;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.cvsBg, 0, 0, w, h);
        ctx.drawImage(this.cvsFader, 0, 0, w, h);
        ctx.drawImage(this.cvsText, 0, 0, w, h);
    }
}
