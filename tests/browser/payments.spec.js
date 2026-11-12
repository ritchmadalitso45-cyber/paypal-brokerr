import { test, expect } from '@playwright/test'

const operation = { id: 'OP-1', kind: 'reminder', resource_id: 'INV-1', status: 'proposed', created_at: '2026-01-01T12:00:00', expires_at: '2099-01-01T12:00:00', payload: { subject: 'Reminder', note: 'Please pay the outstanding invoice.' } }
test.beforeEach(async ({ page }) => {
  await page.route('**/src/lib/client.js', route => route.fulfill({ contentType: 'text/javascript', body: `export async function api(path, options = {}) { const response = await fetch('/api/v1' + path, {method: options.method || 'GET', headers: {'Content-Type': 'application/json'}, body: options.body ? JSON.stringify(options.body) : undefined}); const data = response.status === 204 ? null : await response.json(); if (!response.ok) throw new Error(data.detail); return data; }` }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/dashboard') ? { outstanding_by_currency: { GBP: 40, USD: 50 }, overdue_by_currency: { GBP: 10 }, invoice_count: 2, transaction_count: 1, alert_count: 0, as_of: '2026-11-12T12:00:00' }
      : path.endsWith('/integrations') ? { paypal: { configured: true }, openai: false }
        : path.endsWith('/invoices') ? { items: [{ id: 'INV-1', customer: 'client@example.com', currency: 'GBP', outstanding: 40, status: 'SENT', due_date: '2026-01-01' }] }
          : path.endsWith('/operations') ? { items: [operation] }
            : path.endsWith('/transactions') ? { items: [] }
              : path.endsWith('/workflows') ? { items: [] } : operation
    return route.fulfill({ json: data })
  })
  await page.goto('/tests/ui-harness.html')
})

test('dashboard preserves separate currencies and removes fictional revenue', async ({ page }) => {
  await expect(page.getByText('Outstanding invoices')).toHaveCount(2)
  await expect(page.getByText('40.00', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('USD', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('$47,240')).toHaveCount(0)
})
test('reminder creation proposes and explicit review approves once', async ({ page }) => {
  let sent = 0
  await page.route('**/operations/OP-1/approve', route => { sent++; return route.fulfill({ json: { ...operation, status: 'succeeded' } }) })
  await page.getByRole('button', { name: 'invoices', exact: true }).click()
  await page.getByRole('button', { name: 'Draft reminder', exact: true }).click()
  await page.getByLabel('Reminder message').fill('Please pay the outstanding invoice.')
  await page.getByRole('button', { name: 'Create proposal', exact: true }).click()
  await expect(page.getByText('Reminder drafted.', { exact: false })).toBeVisible()
  expect(sent).toBe(0)
  await page.getByRole('button', { name: 'Open Approvals', exact: true }).click()
  await page.getByRole('button', { name: 'Review details' }).click()
  await expect(page.getByText('Please pay the outstanding invoice.', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Approve this action' }).click()
  await expect(page.getByRole('button', { name: 'Approve this action' })).toHaveCount(0)
  expect(sent).toBe(1)
})
test('uncertain operation cannot be blindly approved again', async ({ page }) => {
  await page.route('**/operations/OP-1/approve', route => route.fulfill({ status: 502, json: { detail: 'Provider unavailable' } }))
  await page.route('**/operations/OP-1', route => route.fulfill({ json: { ...operation, status: 'unknown' } }))
  await page.getByRole('button', { name: 'approvals', exact: true }).click()
  await page.getByRole('button', { name: 'Review details' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Approve this action' }).click()
  await expect(page.getByRole('button', { name: 'Approve this action' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Record verified outcome' })).toBeVisible()
})
test('transaction empty state and mobile layout render without demo rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'transactions', exact: true }).click()
  await expect(page.getByText('No matching transactions.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export this page as CSV' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/mobile-transactions.png', fullPage: true })
})
