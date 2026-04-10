declare module 'petite-vue' {
    interface App {
        mount(el: string | Element | null): App;
        unmount(): void;
        directive(name: string, def: object): App;
    }
    export function createApp(data?: object): App;
    export function nextTick(fn: () => void): Promise<void>;
}
