import { test, expect } from '@playwright/test';
import path from 'node:path';

test('upload, profile, clean, explore, model, anomalies, report and mobile layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Turn raw data into insights.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /CLASSIFICATION Customer churn/ }).click();
  await expect(page.locator('.dataset-bar')).toContainText('classification.csv');
  await expect(page.locator('.stat-card').first()).toContainText('246');
  await page.screenshot({ path: '../docs/screenshots/overview.png', fullPage: true });
  const nav = (name: string) =>
    page.getByRole('navigation').getByRole('button', { name, exact: true });
  await nav('Data Quality').click();
  await expect(page.getByRole('heading', { name: 'How the score works' })).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /^Cleaning/ })
    .click();
  await page.getByLabel(/Remove duplicate rows/).check();
  await page.getByRole('button', { name: 'Apply selected changes' }).click();
  await expect(page.getByRole('heading', { name: 'Applied changes' })).toBeVisible();
  await expect(page.locator('.comparison')).toContainText('240');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('datapilot-cleaned.csv');
  await nav('EDA').click();
  await expect(page.getByRole('heading', { name: 'Spread & quartiles' })).toBeVisible();
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  await nav('Correlations').click();
  await expect(page.locator('.heatmap')).toBeVisible();
  await page.getByLabel('Correlation method').selectOption('spearman');
  await expect(page.getByRole('heading', { name: 'Spearman correlation matrix' })).toBeVisible();
  await nav('Outliers').click();
  await expect(page.getByRole('heading', { name: 'Potential numeric outliers' })).toBeVisible();
  await nav('Machine Learning').click();
  await page.getByLabel('Target column').selectOption('churn');
  await page.getByRole('button', { name: 'Confirm & train models' }).click();
  await expect(page.getByRole('heading', { name: 'Logistic Regression', exact: true })).toBeVisible(
    { timeout: 60_000 },
  );
  await expect(page.getByRole('heading', { name: 'Confusion matrix' })).toHaveCount(2);
  // Recharts animates paths for 1.5 seconds after the computed results arrive.
  await page.waitForTimeout(1600);
  await page.screenshot({ path: '../docs/screenshots/machine-learning.png', fullPage: true });
  await nav('Anomalies').click();
  await page.getByRole('button', { name: 'Run Isolation Forest' }).click();
  await expect(page.getByRole('heading', { name: 'Flagged row preview' })).toBeVisible();
  await nav('Report').click();
  await expect(page.getByRole('heading', { name: 'Main insights' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.locator('.print-title')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await nav('Overview').click();
  await page.getByRole('button', { name: 'Dark appearance' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Light appearance' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  await page.screenshot({
    path: '../docs/screenshots/mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await nav('Data Quality').click();
  await expect(page.getByRole('heading', { name: 'How the score works' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('real file upload and validation error feedback', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n') });
  await expect(page.locator('.error-banner')).toContainText('at least one data row');
  await page.locator('input[type=file]').setInputFiles(path.resolve('../examples/regression.csv'));
  await expect(page.locator('.dataset-bar')).toContainText('regression.csv');
  await expect(page.locator('.stat-card').first()).toContainText('245');
});
