import { describe, expect, it } from 'vitest';
import { accountIdToSteamId64, parseSteamIdInput, steamId64ToAccountId } from './steam-id.js';

describe('accountIdToSteamId64', () => {
  it('mengubah account_id menjadi SteamID64', () => {
    expect(accountIdToSteamId64(123456789)).toBe('76561198083722517');
    expect(accountIdToSteamId64(1)).toBe('76561197960265729');
    expect(accountIdToSteamId64(4294967295)).toBe('76561202255233023');
  });

  it('menolak account_id yang tidak wajar', () => {
    for (const bad of [0, -1, 1.5, 4294967296, Number.NaN]) {
      expect(() => accountIdToSteamId64(bad)).toThrow(RangeError);
    }
  });
});

describe('steamId64ToAccountId', () => {
  it('mengubah SteamID64 menjadi account_id', () => {
    expect(steamId64ToAccountId('76561198083722517')).toBe(123456789);
  });

  it('tidak kehilangan presisi (jebakan Number)', () => {
    // Dibuktikan dulu bahwa cara Number memang salah:
    expect(Number('76561197960265729') - 76561197960265728).toBe(0);
    // Lalu cara BigInt memberi hasil yang benar:
    expect(steamId64ToAccountId('76561197960265729')).toBe(1);
  });

  it('bolak-balik selalu konsisten', () => {
    for (const accountId of [1, 2, 123456789, 4294967295]) {
      expect(steamId64ToAccountId(accountIdToSteamId64(accountId))).toBe(accountId);
    }
  });

  it('menolak SteamID64 yang tidak valid', () => {
    expect(() => steamId64ToAccountId('123')).toThrow(RangeError);
    expect(() => steamId64ToAccountId('bukan-angka')).toThrow(RangeError);
    // 76561197960265728 adalah basisnya sendiri -> account_id 0, tidak sah
    expect(() => steamId64ToAccountId('76561197960265728')).toThrow(RangeError);
  });
});

describe('parseSteamIdInput', () => {
  it('mengenali account_id', () => {
    expect(parseSteamIdInput('123456789')).toEqual({ kind: 'accountId', accountId: 123456789 });
  });

  it('mengenali SteamID64', () => {
    expect(parseSteamIdInput('76561198083722517')).toEqual({
      kind: 'steamId64',
      accountId: 123456789,
      steamId64: '76561198083722517',
    });
  });

  it('mengenali URL profil Steam', () => {
    expect(parseSteamIdInput('https://steamcommunity.com/profiles/76561198083722517')).toEqual({
      kind: 'steamId64',
      accountId: 123456789,
      steamId64: '76561198083722517',
    });
  });

  it('mengenali URL vanity', () => {
    expect(parseSteamIdInput('https://steamcommunity.com/id/gaben')).toEqual({
      kind: 'vanity',
      vanity: 'gaben',
    });
  });

  it('mengenali vanity polos', () => {
    expect(parseSteamIdInput('gaben')).toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('mengenali SteamID3', () => {
    expect(parseSteamIdInput('[U:1:123456789]')).toEqual({
      kind: 'accountId',
      accountId: 123456789,
    });
  });

  it('mengenali URL OpenDota', () => {
    expect(parseSteamIdInput('https://www.opendota.com/players/123456789')).toEqual({
      kind: 'accountId',
      accountId: 123456789,
    });
  });

  it('memangkas spasi di ujung', () => {
    expect(parseSteamIdInput('  gaben  ')).toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('menandai input yang tidak dikenali', () => {
    expect(parseSteamIdInput('')).toEqual({ kind: 'invalid', input: '' });
    expect(parseSteamIdInput('nama dengan spasi')).toEqual({
      kind: 'invalid',
      input: 'nama dengan spasi',
    });
    expect(parseSteamIdInput('https://example.com/apa-saja')).toEqual({
      kind: 'invalid',
      input: 'https://example.com/apa-saja',
    });
    // deretan angka yang bukan account_id maupun SteamID64
    expect(parseSteamIdInput('99999999999999999')).toEqual({
      kind: 'invalid',
      input: '99999999999999999',
    });
  });
});
