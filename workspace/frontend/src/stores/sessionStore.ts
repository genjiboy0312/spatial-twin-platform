import { create } from 'zustand'

export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer'

export type SessionUser = {
  username: string
  role: UserRole
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
  const safeRole: UserRole = role === 'manager' || role === 'editor' || role === 'viewer' || role === 'admin' ? role : DEFAULT_USER.role

  return {
    username,
    role: safeRole,
  }
}

function writeSession(user: SessionUser) {
  localStorage.setItem('spatial_user_name', user.username)
  localStorage.setItem('spatial_user_role', user.role)
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
    writeSession(DEFAULT_USER)
    set({ user: DEFAULT_USER })
  },
}))
