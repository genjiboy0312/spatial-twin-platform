const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const API_TOKEN_KEY = 'spatial_api_access_token'

export function getApiToken(): string | null {
  return localStorage.getItem(API_TOKEN_KEY)
}

export function setApiToken(token: string | null) {
  if (token) {
    localStorage.setItem(API_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(API_TOKEN_KEY)
  }
}

export function authHeaders(): HeadersInit {
  const token = getApiToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: authHeaders() })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(payload?.detail ?? `GET ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function sendJson<TResponse, TPayload>(path: string, method: 'POST' | 'PATCH' | 'PUT', payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(errorPayload?.detail ?? `${method} ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<TResponse>
}
