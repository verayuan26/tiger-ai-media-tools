import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('imports fixture media and filters cutting assets by tag', async ({ page, request }) => {
  execFileSync('npm', ['run', 'fixtures'], { stdio: 'inherit' });

  const importResponse = await request.post('/api/dev/import-fixtures', { data: {} });
  expect(importResponse.ok()).toBe(true);

  const drainResponse = await request.post('/api/jobs/drain', { data: { limit: 20 } });
  expect(drainResponse.ok()).toBe(true);

  await page.goto('/');

  await expect(page.getByText('AI 素材库')).toBeVisible();
  await expect(page.getByRole('button', { name: /factory_cutting\.jpg/ })).toBeVisible();

  await page.getByRole('button', { name: '裁剪布料' }).click();

  await expect(page.getByRole('button', { name: /factory_cutting\.jpg/ })).toBeVisible();
});
