/** The panel session (issued by Apps Script, 12 h) in localStorage, with change notifications. */
export type SessionStore = {
  get(): string | null;
  set(session: string, expiresAt: number): void;
  clear(): void;
  subscribe(fn: () => void): () => void;
};

const KEY = 'kt-admin-session';

export function createSessionStore(storage: Storage, now: () => number = Date.now): SessionStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  const read = (): { session: string; expiresAt: number } | null => {
    try {
      const v = JSON.parse(storage.getItem(KEY) ?? 'null');
      return v && typeof v.session === 'string' && typeof v.expiresAt === 'number' ? v : null;
    } catch {
      return null;
    }
  };
  return {
    get() {
      const v = read();
      return v && v.expiresAt > now() ? v.session : null;
    },
    set(session, expiresAt) {
      try {
        storage.setItem(KEY, JSON.stringify({ session, expiresAt }));
      } catch {
        // Private mode: the session lives until the tab closes.
      }
      emit();
    },
    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        // ignore
      }
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
