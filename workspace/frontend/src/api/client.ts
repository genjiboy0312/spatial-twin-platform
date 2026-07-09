const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function sendJson<TResponse, TPayload>(path: string, method: 'POST' | 'PATCH' | 'PUT', payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<TResponse>
}
