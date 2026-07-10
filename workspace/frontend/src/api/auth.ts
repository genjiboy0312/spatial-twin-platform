import { sendJson } from './client'
import type { UserRole } from '../stores/sessionStore'

export type LoginRequest = {
  username: string
  password: string
  role: UserRole
}

export type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  username: string
  role: UserRole
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return sendJson<LoginResponse, LoginRequest>('/api/auth/login', 'POST', payload)
}
