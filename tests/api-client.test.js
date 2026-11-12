import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApi, ApiError } from '../src/lib/api.js'

test('attaches Firebase token and idempotency key without service credentials', async () => {
  let sent
  const api = createApi({ baseUrl: 'https://example.test/', getToken: async () => 'firebase-token', fetcher: async (url, options) => { sent = { url, ...options }; return Response.json({ id: 'OP-1' }, { status: 201 }) } })
  assert.deepEqual(await api('/invoices/INV-1/reminders', { method: 'POST', key: 'unique-key', body: { note: 'Please pay' } }), { id: 'OP-1' })
  assert.equal(sent.url, 'https://example.test/api/v1/invoices/INV-1/reminders')
  assert.equal(sent.headers.Authorization, 'Bearer firebase-token')
  assert.equal(sent.headers['Idempotency-Key'], 'unique-key')
  assert.deepEqual(JSON.parse(sent.body), { note: 'Please pay' })
})
test('refreshes rejected Firebase session once', async () => {
  const refreshes = []; let calls = 0
  const api = createApi({ getToken: async force => { refreshes.push(force); return 'token' }, fetcher: async () => ++calls === 1 ? Response.json({}, { status: 401 }) : Response.json({ role: 'viewer' }) })
  assert.equal((await api('/session')).role, 'viewer')
  assert.deepEqual(refreshes, [false, true])
})
test('does not retry uncertain writes or forbidden requests', async () => {
  let calls = 0
  const api = createApi({ getToken: async () => 'token', fetcher: async () => { calls++; throw new TypeError('offline') } })
  await assert.rejects(api('/operations/OP-1/approve', { method: 'POST' }), /Check the operation/)
  assert.equal(calls, 1)
  const forbidden = createApi({ getToken: async () => 'token', fetcher: async () => Response.json({ detail: 'Not a member' }, { status: 403 }) })
  await assert.rejects(forbidden('/dashboard'), error => error instanceof ApiError && error.status === 403)
})
test('supports empty successful response and rejects untrusted paths', async () => {
  const api = createApi({ getToken: async () => 'token', fetcher: async () => new Response(null, { status: 204 }) })
  assert.equal(await api('/workflows/WF-1', { method: 'DELETE' }), null)
  await assert.rejects(api('//attacker.invalid'), /Invalid API path/)
})
