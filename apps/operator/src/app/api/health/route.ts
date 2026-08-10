import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const apiUrl = process.env['API_INTERNAL_URL'];
  const version = process.env['APP_VERSION'];
  if (apiUrl === undefined || version === undefined) {
    return NextResponse.json(
      {
        service: 'operator',
        status: 'not_ready',
        version: version ?? 'unknown',
        checks: [{ code: 'api_url_configured', ok: false, latencyMilliseconds: 0 }],
      },
      { status: 503 },
    );
  }

  const startedAt = performance.now();
  try {
    const response = await fetch(`${apiUrl}/readyz`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json();
    const apiReady =
      response.ok &&
      typeof body === 'object' &&
      body !== null &&
      'status' in body &&
      body.status === 'ready' &&
      'service' in body &&
      body.service === 'api' &&
      'version' in body &&
      body.version === version;
    return NextResponse.json(
      {
        service: 'operator',
        status: apiReady ? 'ready' : 'not_ready',
        version,
        checks: [
          {
            code: 'api_ready',
            ok: apiReady,
            latencyMilliseconds: Math.round(performance.now() - startedAt),
          },
        ],
      },
      { status: apiReady ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        service: 'operator',
        status: 'not_ready',
        version,
        checks: [
          {
            code: 'api_ready',
            ok: false,
            latencyMilliseconds: Math.round(performance.now() - startedAt),
          },
        ],
      },
      { status: 503 },
    );
  }
}
