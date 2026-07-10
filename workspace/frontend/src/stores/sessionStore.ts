import { create } from 'zustand'

export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer'

export type SessionUser = {
  username: string
  role: UserRole
  accessToken?: string | null
}

type SessionState = {
  user: SessionUser
  setSession: (user: SessionUser) => void
  setRole: (role: UserRole) => void
  logout: () => void
}

const DEFAULT_USER: SessionUser = {
  username: 'admin',
  role: 'admin',
}

function readSession(): SessionUser {
  const username = localStorage.getItem('spatial_user_name') || DEFAULT_USER.username
  const role = localStorage.getItem('spatial_user_role')
  const accessToken = localStorage.getItem('spatial_api_access_token')
  const safeRole: UserRole = role === 'manager' || role === 'editor' || role === 'viewer' || role === 'admin' ? role : DEFAULT_USER.role

  return {
    username,
    role: safeRole,
    accessToken,
  }
}

function writeSession(user: SessionUser) {
  localStorage.setItem('spatial_user_name', user.username)
  localStorage.setItem('spatial_user_role', user.role)
  if (user.accessToken) {
    localStorage.setItem('spatial_api_access_token', user.accessToken)
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  user: readSession(),
  setSession: (user) => {
    writeSession(user)
    set({ user })
  },
  setRole: (role) => {
    const current = readSession()
    const next = { ...current, role }
    writeSession(next)
    set({ user: next })
  },
  logout: () => {
    localStorage.removeItem('spatial_api_access_token')
    writeSession(DEFAULT_USER)
    set({ user: DEFAULT_USER })
  },
}))
