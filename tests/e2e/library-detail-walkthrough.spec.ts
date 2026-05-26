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
    await expect(page.getByRole('button', { name: '在文件夹中显示' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '重新解析' })).toBeEnabled();

    await page.locator('header button, .border-b button').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByPlaceholder('搜索文件名、标签、字幕内容...')).toBeVisible();
  });

  test('video detail exposes precision analyze confirmation', async ({ page }) => {
    await page.goto('/');
    const videoCard = page.getByRole('button', { name: /\.mp4|\.mov|视频/i }).first();
    if ((await videoCard.count()) === 0) {
      test.skip(true, 'No video fixture available in library');
    }

    await videoCard.click();
    await expect(page.getByRole('button', { name: '开启精查模式' })).toBeEnabled();
    await page.getByRole('button', { name: '开启精查模式' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('每 3 秒抽一帧');
    await page.getByRole('button', { name: '确认开启' }).click();
    await expect(page.getByText('已开启精查模式并加入解析队列')).toBeVisible();
  });
});
