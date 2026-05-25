import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('imports fixture media and filters cutting assets by tag', async ({ page, request }) => {
  execFileSync('npm', ['run', 'fixtures'], {
    stdio: 'inherit',
    env: { ...process.env, AI_MEDIA_DATA_DIR: '.data/e2e' }
  });

  const importResponse = await request.post('/api/dev/import-fixtures', { data: {} });
  expect(importResponse.ok()).toBe(true);
  expect(await importResponse.json()).toMatchObject({ indexed: 2, skipped: 1 });

  const drainResponse = await request.post('/api/jobs/drain', { data: { limit: 20 } });
  expect(drainResponse.ok()).toBe(true);
  expect(await drainResponse.json()).toMatchObject({
    summary: {
      failed: 0
    }
  });

  await page.goto('/');

  await expect(page.getByText('AI 素材库')).toBeVisible();
  await expect(page.getByRole('button', { name: /factory_cutting\.jpg/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /sewing_line\.jpg/ })).toBeVisible();

  await page.getByRole('button', { name: '裁剪布料' }).click();

  await expect(page.getByRole('button', { name: /factory_cutting\.jpg/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /sewing_line\.jpg/ })).not.toBeVisible();
});
