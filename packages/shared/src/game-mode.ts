/**
 * Label lobby & mode permainan Dota.
 *
 * Sumber: OpenDota `/constants/lobby_type` dan `/constants/game_mode`
 * (diambil 17 Okt 2026), diberi nama yang enak dibaca.
 */

export const LOBBY_LABELS: Record<number, string> = {
  0: 'Unranked',
  1: 'Practice',
  2: 'Tournament',
  3: 'Tutorial',
  4: 'Co-op Bots',
  // 5, 6, dan 7 sama-sama ranked (team / solo / umum).
  5: 'Ranked',
  6: 'Ranked',
  7: 'Ranked',
  8: '1v1 Mid',
  9: 'Battle Cup',
  10: 'Local Bots',
  11: 'Spectator',
  12: 'Event',
  13: 'Gauntlet',
  14: 'New Player',
  15: 'Featured',
};

export const GAME_MODE_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  6: 'Intro',
  7: 'Diretide',
  8: 'Reverse Captains Mode',
  9: 'Greeviling',
  10: 'Tutorial',
  11: 'Mid Only',
  12: 'Least Played',
  13: 'Limited Heroes',
  14: 'Compendium',
  15: 'Custom',
  16: 'Captains Draft',
  17: 'Balanced Draft',
  18: 'Ability Draft',
  19: 'Event',
  20: 'All Random Deathmatch',
  21: '1v1 Mid',
  22: 'All Draft',
  23: 'Turbo',
  24: 'Mutation',
  25: 'Coaches Challenge',
};

/** `DOTA_GAMEMODE_TURBO`. Turbo bukan lobby terpisah, melainkan game mode. */
const TURBO_GAME_MODE = 23;
/** Lobby ranked: team matchmaking, solo matchmaking, dan ranked umum. */
const RANKED_LOBBY_TYPES = new Set([5, 6, 7]);

export interface MatchMode {
  /** Ringkasan: "Ranked" | "Unranked" | "Turbo" | "Battle Cup" | ... */
  label: string;
  /** Nama mode, mis. "All Draft"; kosong untuk Turbo (sudah tercakup label). */
  mode: string;
  /** Siap tampil: "Ranked · All Draft", "Turbo", "Battle Cup · All Pick". */
  detail: string;
  ranked: boolean;
  turbo: boolean;
}

/**
 * Terjemahkan `lobby_type` + `game_mode` menjadi label yang bisa dibaca.
 *
 * Turbo dideteksi dari `game_mode` (23), bukan dari lobby, karena Turbo bisa
 * dimainkan di lobby normal.
 */
export function describeMatchMode(lobbyType: number, gameMode: number): MatchMode {
  if (gameMode === TURBO_GAME_MODE) {
    return { label: 'Turbo', mode: '', detail: 'Turbo', ranked: false, turbo: true };
  }

  const lobbyLabel = LOBBY_LABELS[lobbyType] ?? `Lobby ${lobbyType}`;
  const modeLabel = GAME_MODE_LABELS[gameMode];
  // `game_mode` 0 berarti "Unknown" -> jangan ditampilkan sebagai mode.
  const mode =
    modeLabel === undefined ? `Mode ${gameMode}` : modeLabel === 'Unknown' ? '' : modeLabel;

  return {
    label: lobbyLabel,
    mode,
    detail: mode === '' ? lobbyLabel : `${lobbyLabel} · ${mode}`,
    ranked: RANKED_LOBBY_TYPES.has(lobbyType),
    turbo: false,
  };
}
