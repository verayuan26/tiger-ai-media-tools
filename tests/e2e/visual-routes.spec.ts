import { expect, test } from '@playwright/test';

const routes = [
  { name: 'library', path: '/' },
  { name: 'sources', path: '/sources' },
  { name: 'tasks', path: '/tasks' },
  { name: 'tags', path: '/tags' },
  { name: 'settings', path: '/settings' }
] as const;

test.describe('UI visual regression', () => {
  test.beforeEach(async ({ request }) => {
    const importResponse = await request.post('/api/dev/import-fixtures', { data: {} });
    expect(importResponse.ok()).toBeTruthy();
    await request.post('/api/jobs/drain', { data: { limit: 20 } });
  });

  for (const route of routes) {
    test(`${route.name} shell matches baseline`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02
      });
    });
  }
});
