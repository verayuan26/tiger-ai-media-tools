import { expect, test } from '@playwright/test';

test.describe('EGO-14 library + detail 1:1 walkthrough', () => {
  test.beforeEach(async ({ request }) => {
    const importResponse = await request.post('/api/dev/import-fixtures', { data: {} });
    expect(importResponse.ok()).toBeTruthy();
    await request.post('/api/jobs/drain', { data: { limit: 20 } });
  });

  test('library shell matches design structure', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'AI 素材库', level: 1 })).toBeVisible();
    await expect(page.locator('.bg-\\[\\#1a1d24\\]')).toBeVisible();
    await expect(page.getByPlaceholder('搜索文件名、标签、字幕内容...')).toBeVisible();
    await expect(page.getByRole('button', { name: /筛选/ })).toBeVisible();
    const cuttingCard = page.getByRole('button', { name: /factory_cutting\.jpg/ });
    await expect(cuttingCard).toBeVisible();
    await expect(cuttingCard.getByText('裁剪布料')).toBeVisible();

    await page.getByRole('button', { name: /筛选/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: '裁剪布料' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('detail page sections and back navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /factory_cutting\.jpg/ }).click();
    await expect(page).toHaveURL(/\/asset\//);

    await expect(page.getByRole('heading', { level: 1 }).filter({ hasText: /factory_cutting/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: '文件信息' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '标签' })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制路径' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '在文件夹中显示' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '重新解析' })).toBeDisabled();

    await page.locator('header button, .border-b button').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByPlaceholder('搜索文件名、标签、字幕内容...')).toBeVisible();
  });
});
