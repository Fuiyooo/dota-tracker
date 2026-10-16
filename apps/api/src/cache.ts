export const TTL_FOREVER = Number.POSITIVE_INFINITY;

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Cache TTL in-memory.
 *
 * - `getOrSet` menggabungkan permintaan bersamaan untuk key yang sama, jadi
 *   10 request "profil 1061259054" hanya menghasilkan 1 panggilan HTTP.
 * - `maxEntries` membatasi memori: entri terlama dibuang saat penuh, sehingga
 *   TTL_FOREVER tetap aman dipakai untuk detail match.
 * - `clock` bisa disuntik di test supaya waktu tidak perlu ditunggu sungguhan.
 */
export class TtlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    private readonly maxEntries = 500,
    private readonly clock: () => number = Date.now,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.clock() + ttlMs });
  }

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const inFlight = this.pending.get(key);
    if (inFlight !== undefined) return inFlight as Promise<T>;

    const promise = factory()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
