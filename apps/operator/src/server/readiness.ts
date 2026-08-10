import type { Pool } from 'pg';

export interface ReadinessCheck {
  readonly code: string;
  readonly ok: boolean;
  readonly latencyMilliseconds: number;
}

export interface ReadinessDocument {
  readonly service: string;
  readonly status: 'ready' | 'not_ready';
  readonly version: string;
  readonly checkedAt: string;
  readonly checks: readonly ReadinessCheck[];
  readonly capabilities: readonly string[];
}

export async function checkDatabase(pool: Pool): Promise<ReadinessCheck> {
  const startedAt = performance.now();
  try {
    const result = await pool.query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM app_schema_migrations WHERE version = '0001_runtime_readiness') AS present",
    );
    return {
      code: 'database_schema_current',
      ok: result.rows[0]?.present === true,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      code: 'database_schema_current',
      ok: false,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
    };
  }
}

export async function checkHttpReadiness(
  url: string,
  code: string,
  expectedService: string,
  expectedVersion: string,
): Promise<ReadinessCheck> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    const body: unknown = await response.json();
    const ready =
      typeof body === 'object' &&
      body !== null &&
      'status' in body &&
      body.status === 'ready' &&
      'service' in body &&
      body.service === expectedService &&
      'version' in body &&
      body.version === expectedVersion &&
      response.ok;
    return {
      code,
      ok: ready,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      code,
      ok: false,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
    };
  }
}
