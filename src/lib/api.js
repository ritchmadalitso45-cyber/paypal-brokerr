export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}
export function createApi({ baseUrl = '', getToken, fetcher = fetch }) {
  return async function request(path, { method = 'GET', body, key, signal } = {}) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path')
    const send = async (refresh) => {
      const token = await getToken(refresh)
      if (!token) throw new ApiError('Please sign in again.', 401)
      return fetcher(`${baseUrl.replace(/\/$/, '')}/api/v1${path}`, {
        method, cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000),
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }
    let response
    try { response = await send(false); if (response.status === 401) response = await send(true) }
    catch (error) {
      if (error instanceof ApiError || error.name === 'AbortError') throw error
      throw new ApiError(method === 'GET' ? 'Could not reach the payment service.' : 'Connection interrupted. Check the operation or job status before retrying this action.', 0)
    }
    if (response.status === 204) return null
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(typeof data.detail === 'string' ? data.detail : response.status === 422 ? 'Please check the required fields and values.' : `Payment service returned ${response.status}.`, response.status)
    return data
  }
}
