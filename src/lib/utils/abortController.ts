// AbortController shim.
// Modern browsers/Node ship a global AbortController; some embedded webviews
// and older runtimes do not. Use the native class when present, otherwise a
// minimal fake exposing the same surface the app uses.

export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(
  type: 'abort',
  listener: () => void,
  options?: {once?: boolean;})
  : void;
  removeEventListener(type: 'abort', listener: () => void): void;
  throwIfAborted(): void;
}

export interface AbortControllerLike {
  readonly signal: AbortSignalLike;
  abort(): void;
}

class FakeAbortSignal implements AbortSignalLike {
  private readonly listeners = new Set<() => void>();
  private abortedState = false;

  public get aborted(): boolean {
    return this.abortedState;
  }

  public addEventListener(
  type: 'abort',
  listener: () => void,
  options?: {once?: boolean;})
  : void {
    if (type !== 'abort') return;
    if (this.abortedState) {
      listener();
      return;
    }
    if (options?.once) {
      const once = () => {
        this.listeners.delete(once);
        listener();
      };
      this.listeners.add(once);
      return;
    }
    this.listeners.add(listener);
  }

  public removeEventListener(type: 'abort', listener: () => void): void {
    if (type === 'abort') this.listeners.delete(listener);
  }

  public throwIfAborted(): void {
    if (this.abortedState) throw new Error('Aborted');
  }

  public trigger(): void {
    if (this.abortedState) return;
    this.abortedState = true;
    this.listeners.forEach((listener) => listener());
    this.listeners.clear();
  }
}

class FakeAbortController implements AbortControllerLike {
  public readonly signal = new FakeAbortSignal();

  public abort(): void {
    this.signal.trigger();
  }
}

export function createAbortController(): AbortControllerLike {
  if (typeof globalThis.AbortController === 'function') {
    return new globalThis.AbortController() as unknown as AbortControllerLike;
  }
  return new FakeAbortController();
}

/** Convert the compatible signal to the DOM fetch type at the network edge. */
export function toFetchSignal(signal: AbortSignalLike): AbortSignal {
  return signal as unknown as AbortSignal;
}