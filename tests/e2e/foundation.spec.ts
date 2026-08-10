import { expect, test } from '@playwright/test';

test('operator surface reports live readiness and the honest production boundary', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Emergency resource directory verification',
  );
  await expect(page.getByRole('status')).toHaveText(/not yet in production/iu);
  await expect(page.getByRole('heading', { name: 'Real calls are disabled.' })).toBeVisible();
  await expect(page.getByText('api', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('worker', { exact: true }).first()).toBeVisible();
});

test('operator health is dependency-aware JSON, not an open socket check', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    service: 'operator',
    status: 'ready',
    checks: [{ code: 'api_ready', ok: true }],
  });
});
