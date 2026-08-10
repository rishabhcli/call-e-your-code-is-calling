interface ServiceStatus {
  readonly service: string;
  readonly status: 'ready' | 'not_ready' | 'unreachable';
  readonly version?: string;
  readonly checks?: readonly { readonly code: string; readonly ok: boolean }[];
}

export const dynamic = 'force-dynamic';

async function readService(
  name: string,
  expectedService: string,
  url: string,
  expectedVersion: string | undefined,
): Promise<ServiceStatus> {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4_000) });
    const body = (await response.json()) as ServiceStatus;
    const ready =
      response.ok &&
      body.status === 'ready' &&
      body.service === expectedService &&
      expectedVersion !== undefined &&
      body.version === expectedVersion;
    return { ...body, status: ready ? 'ready' : 'not_ready' };
  } catch {
    return { service: name, status: 'unreachable' };
  }
}

export default async function OperatorPage() {
  const endpoints = [
    ['API and provider boundary', 'api', process.env['API_INTERNAL_URL']],
    ['Worker lease loop', 'worker', process.env['WORKER_INTERNAL_URL']],
  ] as const;
  const statuses = await Promise.all(
    endpoints.map(([name, service, url]) =>
      url === undefined
        ? Promise.resolve<ServiceStatus>({ service: name, status: 'unreachable' })
        : readService(name, service, `${url}/readyz`, process.env['APP_VERSION']),
    ),
  );

  return (
    <main>
      <header className="masthead">
        <div>
          <p className="eyebrow">Operator system ledger</p>
          <h1>Emergency resource directory verification</h1>
          <p className="lede">
            Every phone statement is evidence at a time. Unknown, refused, and unreachable outcomes
            remain unknown.
          </p>
        </div>
        <div className="production-state" role="status">
          <span aria-hidden="true" />
          Not yet in production
        </div>
      </header>

      <section aria-labelledby="runtime-heading" className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live development topology</p>
            <h2 id="runtime-heading">Readiness, not promises</h2>
          </div>
          <p>
            These states are fetched from dependency-aware readiness endpoints on every request.
          </p>
        </div>
        <ul className="service-grid">
          {statuses.map((status) => (
            <li className={`service service-${status.status}`} key={status.service}>
              <span className="service-state">{status.status.replace('_', ' ')}</span>
              <strong>{status.service}</strong>
              <p>
                {status.checks
                  ?.map((check) => `${check.code}: ${check.ok ? 'pass' : 'fail'}`)
                  .join(' · ') ?? 'No readiness document was available.'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="boundary-note" aria-labelledby="boundary-heading">
        <p className="eyebrow">Current limitation</p>
        <h2 id="boundary-heading">Real calls are disabled.</h2>
        <p>
          No call can be created from this foundation surface. A later call path must first compile
          an inspectable plan, prove a current approval, enforce opt-out and contact windows, and
          persist one stable idempotency key.
        </p>
      </section>
    </main>
  );
}
