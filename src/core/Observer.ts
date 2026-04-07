/** Signature for the callback invoked when an observer is notified. */
export type NotifyCallback<TSender, TData> = (sender: TSender, data: TData) => void;

/**
 * A single subscriber in the observer pattern.
 * Wraps a `(sender, data)` callback together with the `this` context it should run under.
 */
export class Observer<TSender = unknown, TData = unknown> {
    /** The `this` context passed to the callback when notified. */
    private _instance: unknown;
    /** The callback function to invoke. */
    private _method: NotifyCallback<TSender, TData>;

    /**
     * @param instance - The object that will be `this` inside `method`.
     * @param method   - The function to call on notification.
     */
    constructor(instance: unknown, method: NotifyCallback<TSender, TData>) {
        this._instance = instance;
        this._method = method;
    }

    /** Invoke the callback with the given sender and data. */
    notify(sender: TSender, data: TData): void {
        this._method.call(this._instance, sender, data);
    }
}
