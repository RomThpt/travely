import { createMMKV } from 'react-native-mmkv';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * MMKV is synchronous, which lets the persisted zustand store hydrate before the first
 * render and avoids the empty-then-populated flash on the Trips screen. Version 4 is a
 * Nitro module, so it needs the new architecture, which this app runs.
 */

export const storage = createMMKV({ id: 'travely' });

/** Typed zustand persist storage that keeps its own JSON encoding. */
export function createMmkvPersistStorage<S>(): PersistStorage<S> {
  return {
    getItem: (name) => {
      const raw = storage.getString(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        storage.remove(name);
        return null;
      }
    },
    setItem: (name, value) => {
      storage.set(name, JSON.stringify(value));
    },
    removeItem: (name) => {
      storage.remove(name);
    },
  };
}

/** Async face of the same store, for persisters that expect a promise-based API. */
export const asyncMmkvStorage = {
  getItem: async (key: string): Promise<string | null> => storage.getString(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.remove(key);
  },
};
