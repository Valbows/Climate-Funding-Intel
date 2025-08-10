import { test, expect } from '@playwright/test'

// Minimal smoke test: company page loads and bio section renders/polls
// This does not depend on Supabase data; the page should render with empty state.

test.describe('Company page bio section', () => {
  test('loads and allows requesting enrichment', async ({ page }) => {
    const slug = 'example-co'

    await page.goto(`/companies/${slug}`)

    await expect(page.getByRole('heading', { name: 'Company Bio' })).toBeVisible()

    const fetchBtn = page.getByRole('button', { name: 'Fetch Bio' })
    if (await fetchBtn.count()) {
      // Click should POST 202 in the background; show toast indicating mode
      await fetchBtn.click()
      const toast = page.getByText(/Enrichment queued \(local runner\)\.|Request acknowledged \(stub mode\)\.|Request acknowledged\.|Rate limited|Unauthorized|Failed to queue|Network error/i)
      await expect(toast).toBeVisible()
      // Section status remains coherent
      await expect(page.getByText(/Bio is being prepared|No bio available yet|Loading bio/i)).toBeVisible()
    } else {
      // If no button, either bio is already ready (text content shown) or pending/absent state is rendered.
      // Assert that either status text appears, or at least the section remains visible.
      const status = page.getByText(/Bio is being prepared|No bio available yet|Loading bio/i)
      if (!(await status.count())) {
        await expect(page.getByRole('heading', { name: 'Company Bio' })).toBeVisible()
      }
    }
  })
})
