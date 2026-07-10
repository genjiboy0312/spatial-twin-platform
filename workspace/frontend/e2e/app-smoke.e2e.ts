import { expect, test } from '@playwright/test'

const routes = [
  ['Projects', '/projects'],
  ['Editor', '/editor/demo'],
  ['Alignment', '/alignment'],
  ['Point Cloud', '/point-cloud'],
  ['Coverage', '/coverage'],
  ['Pathfinding', '/pathfinding'],
  ['Validation', '/validation'],
  ['Export', '/export'],
  ['Monitor', '/monitor'],
  ['Settings', '/settings'],
] as const

test.describe('app navigation smoke', () => {
  for (const [title, path] of routes) {
    test(`${title} route renders`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('main').getByRole('heading').first()).toBeVisible({ timeout: 20_000 })
    })
  }
})
