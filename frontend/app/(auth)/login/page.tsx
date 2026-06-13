'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const anim = (i: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateX(0)' : 'translateX(40px)',
    filter: mounted ? 'blur(0)' : 'blur(8px)',
    transition: 'opacity .7s ease, transform .7s ease, filter .7s ease',
    transitionDelay: `${i * 0.12}s`,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { access_token } = await authApi.login(email, password)
      localStorage.setItem('agentsec_token', access_token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubLogin = () => {
    window.location.href = `${API_URL}/auth/login`
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'var(--elevated)',
    border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 36, ...anim(0) }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)' }}>
            Agent<span style={{ color: 'var(--accent)' }}>Sec</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Autonomous DevSecOps Security</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, ...anim(1) }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 4 }}>Welcome back</h2>
        <p style={{ color: 'var(--text-sec)', fontSize: 13, marginBottom: 26 }}>Sign in to your AgentSec workspace</p>

        {/* GitHub OAuth Button */}
        <button
          onClick={handleGitHubLogin}
          style={{
            width: '100%', padding: '10px 16px', background: 'var(--elevated)',
            border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Continue with GitHub
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>or sign in with email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 7, padding: '9px 13px', color: 'var(--red)', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>EMAIL</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>PASSWORD</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: 0, lineHeight: 1 }}>
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 4 }}>
            <Link href="/forgot-password" style={{ color: 'var(--accent)', fontSize: 12 }}>Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 18 }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create one</Link>
        </p>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 20, ...anim(2) }}>
        Protected by JWT auth · rate limited · GCP Cloud Run
      </p>
    </>
  )
}