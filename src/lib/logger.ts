/**
 * Structured JSON logger with level filtering and request-ID correlation.
 *
 * Set LOG_LEVEL=debug|info|warn|error to control verbosity (default: info).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? LEVELS.info;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),

  /** Create a child logger that attaches a request ID to every entry. */
  withRequestId: (requestId: string) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, { requestId, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, { requestId, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, { requestId, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, { requestId, ...meta }),
  }),
};
