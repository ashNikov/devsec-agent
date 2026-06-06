'use client'

import { useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'var(--elevated)',
    border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Something went wrong')
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
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

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 4 }}>Forgot password</h2>
        <p style={{ color: 'var(--text-sec)', fontSize: 13, marginBottom: 26 }}>Enter your email and we'll send a reset link</p>

        {sent ? (
          <div style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 7, padding: '16px', color: 'var(--accent)', fontSize: 13, textAlign: 'center' }}>
            ✅ Reset link sent! Check your inbox.
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Didn't get it? Check spam or try again.</p>
          </div>
        ) : (
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
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 18 }}>
          Remember it?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 20 }}>
        Protected by JWT auth · rate limited · GCP Cloud Run
      </p>
    </>
  )
}
