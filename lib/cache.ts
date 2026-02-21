type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TtlCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: K, value: V) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}
