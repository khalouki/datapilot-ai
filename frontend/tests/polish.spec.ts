import { test, expect } from '@playwright/test';

test('startup theme, translation DOM and independently scrolling navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('datapilot-theme', 'dark'));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/static/**/*.js*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('.startup-splash')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  release();
  await expect(page.locator('.startup-splash')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.locator('html[translate=no],body[translate=no],.notranslate').count()).toBe(0);
  await page.setViewportSize({ width: 1280, height: 500 });
  const nav = page.getByRole('navigation');
  await nav.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'Light appearance' })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  await nav.evaluate((el) => {
    el.scrollTop = 0;
  });
  await nav.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.locator('.splash-logo').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});

test('real upload, failed actions, retries, duplicate guards and timeout clear loading', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.startup-splash')).toBeHidden();
  let release!: () => void;
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploads = 0;
  await page.route('**/api/upload', async (route) => {
    uploads++;
    await gate;
    await route.continue();
  });
  const file = {
    name: 'polish.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('x,y,group\n1,2,A\n2,4,B\n3,6,A\n4,8,B\n5,10,A\n6,12,B\n'),
  };
  const input = page.locator('input[type=file]').first();
  const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/upload') && r.ok());
  await input.setInputFiles(file);
  await expect(page.locator('.loading-overlay')).toBeVisible();
  await input.setInputFiles(file);
  expect(uploads).toBe(1);
  release();
  const datasetId = (await (await uploaded).json()).dataset_id;
  await expect(page.locator('.dataset-bar')).toContainText('polish.csv');
  const nav = (name: string) =>
    page.getByRole('navigation').getByRole('button', { name, exact: true });
  let edaCalls = 0;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/eda/**', async (route) => {
    edaCalls++;
    if (edaCalls === 1) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { detail: 'Analysis temporarily unavailable. Try again.' },
      });
    } else await route.continue();
  });
  await nav('EDA').click();
  await expect(page.locator('.loading-charts')).toBeVisible();
  release();
  await expect(page.locator('.loading-error [role=alert]')).toContainText(
    'temporarily unavailable',
  );
  await expect(page.locator('.loading-charts')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Spread & quartiles' })).toBeVisible();
  await nav('Overview').click();
  await nav('EDA').click();
  expect(edaCalls).toBe(2);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /^Cleaning/ })
    .click();
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let cleanCalls = 0;
  await page.route('**/api/clean/**', async (route) => {
    cleanCalls++;
    await gate;
    await route.fulfill({ status: 500, json: { detail: 'Cleaning failed. Please try again.' } });
  });
  await page.getByRole('button', { name: 'Apply selected changes' }).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole('button', { name: 'Applying changes…' })).toBeDisabled();
  await expect.poll(() => cleanCalls).toBe(1);
  release();
  await expect(page.getByRole('button', { name: 'Apply selected changes' })).toBeEnabled();
  await expect(page.locator('.error-banner')).toContainText('Cleaning failed');
  await nav('Dashboard Builder').click();
  await expect(page.getByRole('button', { name: 'Generate Dashboard' })).toBeVisible();
  // Let the initial empty query finish before intercepting the generated dashboard.
  await expect(page.locator('.bi-canvas-heading')).toContainText('6 / 6 records');
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let queries = 0;
  await page.route('**/api/dashboard/*/query', async (route) => {
    queries++;
    await gate;
    await route.fulfill({ status: 500, json: { detail: 'Dashboard query failed.' } });
  });
  await page.getByRole('button', { name: 'Generate Dashboard' }).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  await expect(page.locator('.loading-widget').first()).toBeVisible();
  await expect.poll(() => queries).toBe(1);
  release();
  await expect(page.getByRole('button', { name: 'Generate Dashboard' })).toBeEnabled();
  await expect(page.locator('.loading-widget')).toHaveCount(0);
  await expect(page.locator('.bi-widget').first()).toContainText('Unable to load');
  await page.unroute('**/api/dashboard/*/query');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-testid=kpi-value]').first()).toBeVisible();
  await page.clock.install();
  await page.route('**/api/outliers/**', async () => {});
  await nav('Outliers').click();
  await expect(page.locator('.loading-table')).toBeVisible();
  await page.clock.fastForward(60_001);
  await expect(page.locator('.loading-error [role=alert]')).toContainText('timed out');
  await expect(page.locator('.loading-table')).toHaveCount(0);
  await page.request.delete(`/api/datasets/${datasetId}`);
});

test('model, anomaly and download buttons recover after failures; insights remain translatable', async ({
  page,
}) => {
  await page.goto('/');
  const response = page.waitForResponse((r) => r.url().includes('/api/examples/') && r.ok());
  await page.getByRole('button', { name: /CLASSIFICATION Customer churn/ }).click();
  const id = (await (await response).json()).dataset_id;
  await expect(page.locator('.dataset-bar')).toBeVisible();
  const nav = (name: string) =>
    page.getByRole('navigation').getByRole('button', { name, exact: true });
  await nav('Machine Learning').click();
  await page.getByLabel('Target column').selectOption('churn');
  let release!: () => void;
  let gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/ml/train/**', async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      json: { detail: 'Model training unavailable. Please retry.' },
    });
  });
  await page.getByRole('button', { name: 'Confirm & train models' }).click();
  await expect(page.getByRole('button', { name: 'Training models…' })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: 'Confirm & train models' })).toBeEnabled();
  await expect(page.locator('.error-banner')).toContainText('Model training unavailable');
  await nav('Anomalies').click();
  gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/anomalies/**', async (route) => {
    await gate;
    await route.fulfill({
      status: 500,
      json: { detail: 'Anomaly detection failed. Please retry.' },
    });
  });
  await page.getByRole('button', { name: 'Run Isolation Forest' }).click();
  await expect(page.getByRole('button', { name: 'Detecting anomalies…' })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: 'Run Isolation Forest' })).toBeEnabled();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /^Cleaning/ })
    .click();
  gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/download/cleaned/**', async (route) => {
    await gate;
    await route.fulfill({ status: 500, json: { detail: 'Download preparation failed.' } });
  });
  await page.getByRole('link', { name: 'Download CSV' }).click();
  await expect(page.getByRole('link', { name: 'Preparing download…' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  release();
  await expect(page.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('.download-error')).toContainText('Download preparation failed');
  await nav('Report').click();
  await expect(page.getByRole('heading', { name: 'Main insights' })).toBeVisible();
  const insight = page.locator('.insight-list').first();
  // DOM compatibility check: dynamic prose is text, with no translate-blocking ancestor.
  await expect(insight).toBeVisible();
  expect(
    await insight.evaluate(
      (el) => !!el.textContent?.trim() && !el.closest('[translate="no"],.notranslate'),
    ),
  ).toBe(true);
  await page.request.delete(`/api/datasets/${id}`);
});
