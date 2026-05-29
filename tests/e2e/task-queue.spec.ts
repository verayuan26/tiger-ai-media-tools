import { expect, test, type APIRequestContext } from '@playwright/test';

type QueueSummaryResponse = { summary: { pending: number } };
type AssetsResponse = { assets: Array<{ id: string }> };

/** Re-import fixtures and reset jobs so the shared E2E DB has pending work. */
async function seedPendingQueueWork(request: APIRequestContext): Promise<void> {
  const importResponse = await request.post('/api/dev/import-fixtures', { data: {} });
  expect(importResponse.ok()).toBe(true);

  const readPending = async (): Promise<number> => {
    const response = await request.get('/api/queue');
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as QueueSummaryResponse;
    return body.summary.pending;
  };

  let pending = await readPending();
  if (pending > 0) {
    return;
  }

  const assetsResponse = await request.get('/api/assets');
  expect(assetsResponse.ok()).toBe(true);
  const { assets } = (await assetsResponse.json()) as AssetsResponse;
  expect(assets.length).toBeGreaterThan(0);

  for (const asset of assets) {
    const reanalyze = await request.post(`/api/assets/${asset.id}/reanalyze`);
    expect(reanalyze.ok()).toBe(true);
  }

  pending = await readPending();
  expect(pending).toBeGreaterThan(0);
}

test.describe('Task queue (EGO-58)', () => {
  test.beforeEach(async ({ request }) => {
    await seedPendingQueueWork(request);
  });

  test('shows auto-process controls and concurrent limit from settings', async ({ page }) => {
    await page.goto('/tasks');

    await expect(page.getByRole('heading', { name: '任务队列', level: 1 })).toBeVisible();
    await expect(page.getByLabel('自动处理')).toBeVisible();
    await expect(page.getByRole('button', { name: '处理队列' })).toBeVisible();
    await expect(page.getByText(/并发上限：\d+（来自设置）/)).toBeVisible();
    await expect(page.getByText(/自动处理已开启/)).toBeVisible();
  });

  test('supports selecting pending/failed rows and batch retry affordance', async ({ page }) => {
    await page.route('**/api/jobs/drain', (route) => route.abort('failed'));

    await page.goto('/tasks');
    await page.getByLabel('自动处理').click();

    await expect(page.getByRole('button', { name: '处理队列' })).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByLabel(/全选可操作用务/)).toBeVisible();
    await expect(page.getByRole('button', { name: '重试所选失败任务' })).toBeDisabled();

    const firstSelectable = page.getByRole('checkbox', { name: /选择任务/ }).first();
    await expect(firstSelectable).toBeVisible();
    await expect(firstSelectable).toBeEnabled();
    await firstSelectable.check();
    await expect(page.getByRole('button', { name: '重试所选失败任务' })).toBeEnabled();
  });

  test('auto-drains pending jobs without repeated manual clicks', async ({ page, request }) => {
    const summaryBefore = await request.get('/api/queue');
    expect(summaryBefore.ok()).toBe(true);
    const before = (await summaryBefore.json()) as { summary: { pending: number } };
    expect(before.summary.pending).toBeGreaterThan(0);

    await page.goto('/tasks');
    await expect(page.getByText('自动处理已开启')).toBeVisible();

    await expect
      .poll(
        async () => {
          const response = await request.get('/api/queue');
          const body = (await response.json()) as { summary: { pending: number } };
          return body.summary.pending;
        },
        { timeout: 30_000, message: 'pending count should reach 0 via auto drain' }
      )
      .toBe(0);
  });

  test('manual drain button clears remaining pending work', async ({ page, request }) => {
    await page.goto('/tasks');
    await page.getByLabel('自动处理').click();

    await page.getByRole('button', { name: '处理队列' }).click();

    await expect
      .poll(
        async () => {
          const response = await request.get('/api/queue');
          const body = (await response.json()) as { summary: { pending: number } };
          return body.summary.pending;
        },
        { timeout: 30_000 }
      )
      .toBe(0);
  });
});
