import pino, { type Logger } from 'pino';

const redactedPaths = [
  'apiKey',
  'authorization',
  'databaseUrl',
  'headers.authorization',
  'password',
  'req.headers.authorization',
  'token',
];

export function createLogger(service: string): Logger {
  return pino({
    base: { service },
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: {
      paths: redactedPaths,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
