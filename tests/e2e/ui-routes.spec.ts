import { expect, test } from '@playwright/test';

const navItems = [
  { label: '素材库', path: '/', marker: 'search' as const },
  { label: '导入来源', path: '/sources', marker: 'heading' as const, title: '导入来源' },
  { label: '任务队列', path: '/tasks', marker: 'heading' as const, title: '任务队列' },
  { label: '标签管理', path: '/tags', marker: 'heading' as const, title: '标签与主题管理' },
  { label: '设置', path: '/settings', marker: 'heading' as const, title: '设置' }
] as const;

test.describe('UI route shell', () => {
  test('sidebar matches design nav and routes resolve', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'AI 素材库', level: 1 })).toBeVisible();
    await expect(page.locator('.bg-\\[\\#1a1d24\\]')).toBeVisible();

    for (const item of navItems) {
      await page.getByRole('link', { name: item.label }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path === '/' ? '/$' : item.path}$`));

      if (item.marker === 'search') {
        await expect(page.getByPlaceholder('搜索文件名、标签、字幕内容...')).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: item.title, level: 1 })).toBeVisible();
      }
    }
  });

  test('active nav state highlights current route', async ({ page }) => {
    await page.goto('/sources');

    const sourcesLink = page.getByRole('link', { name: '导入来源' });
    await expect(sourcesLink).toHaveClass(/bg-\[#4a6fa5\]/);
  });
});
