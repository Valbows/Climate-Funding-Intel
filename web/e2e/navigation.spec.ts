import { test, expect } from '@playwright/test'

// Navigates from the dashboard (/) to a company detail page via the funding list link.
// Falls back to a direct company URL if the list is empty (e.g., when live data is disabled).

test('dashboard -> company detail navigation', async ({ page }) => {
  await page.goto('/')

  // Dashboard smoke checks
  await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible()
  await expect(page.getByTestId('funding-events')).toBeVisible()

  const firstItem = page.locator('[data-testid="funding-events"] ul li a').first()
  const count = await page.locator('[data-testid="funding-events"] ul li a').count()

  if (count > 0) {
    await firstItem.click()
  } else {
    // Fallback: direct visit to an example company page
    await page.goto('/companies/example-co')
  }

  // Company page assertions
  await expect(page).toHaveURL(/\/companies\//)
  await expect(page.getByRole('heading', { name: /company bio/i })).toBeVisible()
})
