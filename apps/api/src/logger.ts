import pino from 'pino';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error'];

export type LogFields = Record<string, unknown>;

function resolveLevel(): string {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (raw === 'silent') return 'silent';
  return LEVELS.includes(raw) ? raw : 'info';
}

/**
 * Logger terstruktur berbasis pino.
 *
 * Antarmuka sengaja dipertahankan `logger.info(msg, fields)` (urutan lama)
 * supaya seluruh pemanggil tidak perlu diubah; pino sendiri memakai urutan
 * sebaliknya, jadi dibalik di sini.
 */
const instance = pino({
  level: resolveLevel(),
  // pid/hostname dihilangkan supaya baris log tetap ringkas untuk pemakaian pribadi.
  base: undefined,
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function emit(level: Level, msg: string, fields?: LogFields): void {
  instance[level](fields ?? {}, msg);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
};
