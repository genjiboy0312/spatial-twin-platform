import { expect, test, type Page } from '@playwright/test'

async function mockAuthApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/api/auth/login') {
      const payload = JSON.parse(request.postData() ?? '{}') as { username?: string }
      const username = payload.username ?? 'viewer'
      const role = username === 'admin' || username === 'manager' || username === 'editor' ? username : 'viewer'
      await route.fulfill({
        json: {
          access_token: `token-${username}`,
          token_type: 'bearer',
          username,
          role,
        },
      })
      return
    }

    if (url.pathname === '/api/auth/me') {
      const token = request.headers().authorization?.replace('Bearer ', '') ?? ''
      const username = token.replace('token-', '') || 'viewer'
      const role = username === 'admin' || username === 'manager' || username === 'editor' ? username : 'viewer'
      await route.fulfill({ json: { username, role } })
      return
    }

    if (url.pathname === '/api/buildings') {
      await route.fulfill({ json: [] })
      return
    }

    await route.fulfill({ json: {} })
  })
}

test.describe('account session workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
  })

  test('login stores backend session and topbar account switch re-authenticates', async ({ page }) => {
    await page.goto('/login')
    await page.locator('.login-test-accounts button').filter({ hasText: 'Editor' }).click()
    await page.locator('.login-submit').click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.locator('.topbar-account-button').filter({ hasText: 'Editor' })).toBeVisible()

    await page.locator('.topbar-account-button').click()
    await page.getByRole('menuitem', { name: /Manager/ }).click()

    await expect(page.locator('.topbar-account-button').filter({ hasText: 'Manager' })).toBeVisible()
  })
})
