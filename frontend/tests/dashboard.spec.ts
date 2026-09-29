import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
const titanic = path.resolve('../examples/titanic.csv');
const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true });
async function openBuilder(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(titanic);
  await expect(page.locator('.dataset-bar')).toContainText('titanic.csv');
  await nav(page, 'Dashboard Builder').click();
  await expect(page.getByRole('button', { name: 'Generate Dashboard', exact: true })).toBeVisible();
}
const widget = (page: Page, name: string) =>
  page.locator('.bi-widget').filter({ has: page.getByRole('heading', { name, exact: true }) });

test('Titanic dashboard generation, shared filters, charts, persistence and presentation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openBuilder(page);
  await page.getByRole('button', { name: 'Generate Dashboard', exact: true }).click();
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('891');
  await expect(widget(page, 'Records by sex')).toBeVisible();
  await expect(widget(page, 'age vs fare')).toBeVisible();
  await page.getByLabel('Dashboard title').fill('Titanic passenger overview');
  await page.getByLabel('Filter field', { exact: true }).selectOption('sex');
  await page.getByLabel('Values for sex', { exact: true }).selectOption('"female"');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('314');
  await expect(widget(page, 'Records by sex').locator('.bi-category-buttons')).toContainText(
    'female314',
  );
  await page.getByRole('button', { name: 'Add visual', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'KPI card', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Average fare');
  await page.getByRole('combobox', { name: 'KPI metric', exact: true }).selectOption('column');
  await page.getByRole('combobox', { name: 'Aggregation', exact: true }).selectOption('average');
  await page.getByRole('combobox', { name: 'KPI column', exact: true }).selectOption('fare');
  await expect(widget(page, 'Average fare').getByTestId('kpi-value')).toHaveText('44.48');
  await page.getByRole('button', { name: 'Save Dashboard', exact: true }).click();
  await expect(page.locator('.bi-message')).toContainText('Dashboard saved');
  await page.getByRole('button', { name: 'Presentation Mode', exact: true }).click();
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.locator('.bi-fields')).not.toBeVisible();
  await expect(page.locator('.bi-settings')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Add visual', exact: true })).not.toBeVisible();
  await page.screenshot({ path: '../docs/screenshots/bi-presentation.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.bi-toolbar')).not.toBeVisible();
  await expect(page.locator('.bi-display-title')).toHaveText('Titanic passenger overview');
  await page.emulateMedia({ media: 'screen' });
  await page.reload();
  await page.locator('input[type=file]').setInputFiles(titanic);
  await expect(page.locator('.dataset-bar')).toContainText('titanic.csv');
  await nav(page, 'Dashboard Builder').click();
  await expect(page.getByLabel('Dashboard title')).toHaveValue('Titanic passenger overview');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('314');
  await expect(widget(page, 'Average fare').getByTestId('kpi-value')).toHaveText('44.48');
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('891');
  // Clicking an actual Recharts bar updates the shared cross-filter.
  await widget(page, 'Records by sex').locator('.recharts-bar-rectangle').first().click();
  await expect(page.locator('.bi-cross')).toContainText('male');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('577');
  await page.locator('.bi-cross').click();
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('891');
  await page.screenshot({ path: '../docs/screenshots/bi-builder.png', fullPage: true });
  await page.getByRole('button', { name: 'Duplicate Average fare', exact: true }).click();
  await expect(widget(page, 'Average fare (copy)')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Average fare (copy)', exact: true }).click();
  await expect(widget(page, 'Average fare (copy)')).toHaveCount(0);
  await nav(page, 'Overview').click();
  await expect(page.locator('.stat-card').first()).toContainText('891');
  await nav(page, 'Dashboard Builder').click();
  await expect(page.getByLabel('Dashboard title')).toHaveValue('Titanic passenger overview');
  await page.getByRole('button', { name: 'Reset Dashboard', exact: true }).click();
  await expect(page.locator('.bi-widget')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('BI table sorting, pagination, search and cleaned dataset reuse', async ({ page }) => {
  await openBuilder(page);
  await page.getByRole('button', { name: 'Add visual', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.locator('.bi-table-footer')).toContainText('891 matching rows');
  await page.getByRole('button', { name: 'Next page Table', exact: true }).click();
  await expect(page.locator('.bi-table-footer')).toContainText('Page 2 / 90');
  await page.locator('.bi-table th').getByRole('button', { name: 'age', exact: true }).click();
  await expect(page.locator('.bi-table-footer')).toContainText('Page 1 / 90');
  await page.getByLabel('Search Table', { exact: true }).fill('female');
  await expect(page.locator('.bi-table-footer')).toContainText('314 matching rows');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /^Cleaning/ })
    .click();
  await page.getByLabel(/Remove duplicate rows/).check();
  await page.getByRole('button', { name: 'Apply selected changes' }).click();
  await expect(page.getByRole('heading', { name: 'Applied changes' })).toBeVisible();
  await nav(page, 'Dashboard Builder').click();
  await page.getByRole('button', { name: 'Generate Dashboard', exact: true }).click();
  await expect(widget(page, 'Missing values').getByTestId('kpi-value')).toHaveText('0');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).not.toHaveText('891');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('numeric, date and Boolean slicers plus all chart variants', async ({ page }) => {
  const csv =
    'date,group,sales,cost,flag\n' +
    Array.from(
      { length: 20 },
      (_, i) =>
        `2024-01-${String(i + 1).padStart(2, '0')},${i % 2 ? 'B' : 'A'},${i + 1},${(i + 1) * 3},${(i + 1) % 2 === 0}\n`,
    ).join('');
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'bi-time.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.dataset-bar')).toContainText('bi-time.csv');
  await nav(page, 'Dashboard Builder').click();
  await page.getByRole('button', { name: 'Generate Dashboard', exact: true }).click();
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('20');
  await expect(widget(page, 'Average sales over time')).toBeVisible();
  await page.getByLabel('Filter field', { exact: true }).selectOption('sales');
  await page.getByLabel('Minimum sales').fill('10');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('11');
  await page.getByLabel('Filter field', { exact: true }).selectOption('date');
  await page.getByLabel('End date').fill('2024-01-15');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('6');
  await page.getByLabel('Filter field', { exact: true }).selectOption('flag');
  await page.getByLabel('Values for flag', { exact: true }).selectOption('[true]');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('3');
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('20');
  await page.getByRole('button', { name: 'Edit Records by group', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Visual test');
  for (const type of ['horizontal', 'pie', 'donut']) {
    await page.getByRole('combobox', { name: 'Visual type', exact: true }).selectOption(type);
    await expect(widget(page, 'Visual test').locator('.recharts-wrapper')).toBeVisible();
    await expect(widget(page, 'Visual test').locator('.bi-widget-error')).toHaveCount(0);
  }
  const slice = widget(page, 'Visual test').locator('.recharts-pie-sector path').first();
  await slice.scrollIntoViewIfNeeded();
  // A donut's bounding-box center may be in its hole. Click actual painted geometry.
  const point = await slice.evaluate((element) => {
    const shape = element as SVGGeometryElement;
    const bounds = shape.getBBox();
    const transform = shape.getScreenCTM();
    if (!transform) throw new Error('Slice is not rendered');
    for (let x = 1; x < 10; x++) {
      for (let y = 1; y < 10; y++) {
        const candidate = new DOMPoint(
          bounds.x + (bounds.width * x) / 10,
          bounds.y + (bounds.height * y) / 10,
        );
        if (shape.isPointInFill(candidate)) {
          const screen = candidate.matrixTransform(transform);
          return { x: screen.x, y: screen.y };
        }
      }
    }
    throw new Error('No painted slice point found');
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.bi-cross')).toContainText('group');
  await expect(widget(page, 'Total records').getByTestId('kpi-value')).toHaveText('10');
  await page.locator('.bi-cross').click();
  await page.getByRole('combobox', { name: 'Visual type', exact: true }).selectOption('histogram');
  await page
    .getByRole('combobox', { name: 'X-axis / category', exact: true })
    .selectOption('sales');
  await expect(widget(page, 'Visual test').locator('.recharts-wrapper')).toBeVisible();
  await page.getByRole('combobox', { name: 'Visual type', exact: true }).selectOption('line');
  await page.getByRole('combobox', { name: 'X-axis / category', exact: true }).selectOption('date');
  await page.getByRole('combobox', { name: 'Aggregation', exact: true }).selectOption('average');
  await page.getByRole('combobox', { name: 'Y-axis / measure', exact: true }).selectOption('sales');
  await page.getByRole('combobox', { name: 'Date grouping', exact: true }).selectOption('day');
  await expect(widget(page, 'Visual test').locator('.recharts-line')).toBeVisible();
  await page.getByRole('combobox', { name: 'Visual type', exact: true }).selectOption('area');
  await expect(widget(page, 'Visual test').locator('.recharts-area')).toBeVisible();
  await page.getByRole('combobox', { name: 'Width', exact: true }).selectOption('2');
  await expect(widget(page, 'Visual test')).toHaveClass(/bi-wide/);
  await page.getByRole('button', { name: 'Move Visual test earlier', exact: true }).click();
  await expect(page.locator('.bi-widget').nth(2)).toHaveAttribute('aria-label', 'Visual test');
});
