import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from './cache.js';

describe('TtlCache', () => {
  it('mengembalikan nilai di dalam TTL', () => {
    const cache = new TtlCache(10, () => 1000);
    cache.set('a', 1, 5000);
    expect(cache.get<number>('a')).toBe(1);
  });

  it('kedaluwarsa setelah TTL lewat', () => {
    let now = 0;
    const cache = new TtlCache(10, () => now);
    cache.set('a', 1, 1000);

    now = 999;
    expect(cache.get<number>('a')).toBe(1);

    now = 1000;
    expect(cache.get<number>('a')).toBeUndefined();
  });

  it('membuang entri tertua saat maxEntries tercapai', () => {
    const cache = new TtlCache(2, () => 0);
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.set('c', 3, 1000);

    expect(cache.get<number>('a')).toBeUndefined();
    expect(cache.get<number>('b')).toBe(2);
    expect(cache.get<number>('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('menimpa nilai lama tanpa menambah entri', () => {
    const cache = new TtlCache(2, () => 0);
    cache.set('a', 1, 1000);
    cache.set('a', 2, 1000);

    expect(cache.get<number>('a')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('getOrSet memanggil factory sekali untuk 5 permintaan bersamaan', async () => {
    const cache = new TtlCache(10, () => 0);
    const factory = vi.fn(async () => 'nilai');

    const results = await Promise.all(
      Array.from({ length: 5 }, () => cache.getOrSet('k', 1000, factory)),
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['nilai', 'nilai', 'nilai', 'nilai', 'nilai']);
  });

  it('getOrSet memakai cache pada pemanggilan berikutnya', async () => {
    const cache = new TtlCache(10, () => 0);
    const factory = vi.fn(async () => 42);

    await cache.getOrSet('k', 1000, factory);
    const second = await cache.getOrSet('k', 1000, factory);

    expect(second).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('tidak menyimpan hasil yang melempar error', async () => {
    const cache = new TtlCache(10, () => 0);
    const factory = vi.fn(async () => {
      throw new Error('gagal');
    });

    await expect(cache.getOrSet('k', 1000, factory)).rejects.toThrow('gagal');
    await expect(cache.getOrSet('k', 1000, factory)).rejects.toThrow('gagal');

    expect(factory).toHaveBeenCalledTimes(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('delete dan clear membuang entri', () => {
    const cache = new TtlCache(10, () => 0);
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);

    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
  });
});
