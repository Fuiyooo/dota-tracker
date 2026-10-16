type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return LEVELS[raw as Level] ?? LEVELS.info;
}

function emit(level: Level, msg: string, fields?: LogFields): void {
  if (LEVELS[level] < threshold()) return;

  // `fields` diletakkan lebih dulu supaya tidak bisa menimpa time/level/msg.
  const line = { ...fields, time: new Date().toISOString(), level, msg };
  const text = `${JSON.stringify(line)}\n`;
  if (level === 'warn' || level === 'error') process.stderr.write(text);
  else process.stdout.write(text);
}

/**
 * Logger JSON satu-baris. Sementara ini cukup; Bagian 12 akan menggantinya
 * dengan pino kalau memang diperlukan transport tambahan.
 */
export const logger = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
};
