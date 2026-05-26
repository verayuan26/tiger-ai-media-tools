import { expect, test } from '@playwright/test';

test('imports fixture media and filters cutting assets by tag', async ({ page, request }) => {
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

  await page.getByRole('button', { name: '筛选' }).click();
  await page.getByRole('menuitemcheckbox', { name: '裁剪布料' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: /factory_cutting\.jpg/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /sewing_line\.jpg/ })).not.toBeVisible();
});
