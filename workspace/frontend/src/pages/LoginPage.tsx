import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { type UserRole, useSessionStore } from '../stores/sessionStore'

const TEST_ACCOUNTS: Array<{ username: string; password: string; role: UserRole; label: string }> = [
  { username: 'admin', password: 'admin123', role: 'admin', label: 'Admin' },
  { username: 'manager', password: 'manager123', role: 'manager', label: 'Manager' },
  { username: 'editor', password: 'editor123', role: 'editor', label: 'Editor' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', label: 'Viewer' },
]

const roleOptions: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'admin', label: 'Admin', description: '전체 운영 및 설정 관리' },
  { value: 'manager', label: 'Manager', description: '프로젝트와 검증 흐름 관리' },
  { value: 'editor', label: 'Editor', description: '공간 편집과 장치 배치' },
  { value: 'viewer', label: 'Viewer', description: '모니터링과 읽기 전용 확인' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useSessionStore((state) => state.setSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => navigate('/')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])
  const selectedRole = useMemo(() => roleOptions.find((option) => option.value === role) ?? roleOptions[0]!, [role])

  const fillAccount = (account: typeof TEST_ACCOUNTS[number]) => {
    setUsername(account.username)
    setPassword(account.password)
    setRole(account.role)
    setError('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('사용자 이름과 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    window.setTimeout(() => {
      setSession({
        username: username.trim(),
        role,
      })
      setLoading(false)
      navigate('/home')
    }, 260)
  }

  return (
    <section className="login-page" style={{ minHeight: '100vh' }}>
      <div className="login-panel">
        <button
          type="button"
          className="login-close"
          aria-label="Close"
          onClick={handleClose}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="login-accent" aria-hidden="true" />
        <div className="login-header">
          <span className="login-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </span>
          <div>
            <span className="topbar-kicker">Account Access</span>
            <h1>로그인 및 계정 추가</h1>
            <p>Spatial Twin Platform 작업 권한을 선택하고 세션을 시작합니다.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>사용자 이름</span>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin123"
              autoComplete="current-password"
            />
          </label>

          <div className="login-role-field">
            <span>계정 역할</span>
            <div className="login-role-grid" role="radiogroup" aria-label="계정 역할 선택">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`login-role-card ${role === option.value ? 'active' : ''}`}
                  onClick={() => setRole(option.value)}
                  aria-pressed={role === option.value}
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? '세션 생성 중...' : `${selectedRole.label} 계정으로 시작`}
          </button>
        </form>

        <div className="login-test-accounts">
          <span>테스트 계정 빠른 선택</span>
          <div>
            {TEST_ACCOUNTS.map((account) => (
              <button key={account.username} type="button" onClick={() => fillAccount(account)}>
                {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
