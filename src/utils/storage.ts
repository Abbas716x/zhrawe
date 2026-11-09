const memory = new Map<string, string>();

export const localStore = {
  get(key: string): string | null {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
    } catch (error) {
      console.warn("Local storage is unavailable; using in-memory storage.", error);
    }

    return memory.get(key) ?? null;
  },

  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Could not persist data in local storage.", error);
    }
  },

  remove(key: string): void {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn("Could not remove local storage data.", error);
    }
  }
};
