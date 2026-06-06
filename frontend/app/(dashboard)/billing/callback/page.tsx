'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function BillingCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference') || searchParams.get('trxref') || ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!reference) {
      setStatus('error')
      setMessage('No payment reference found.')
      return
    }

    const verify = async () => {
      try {
        const token = localStorage.getItem('agentsec_token')
        const res = await fetch(`${API_URL}/billing/verify/${reference}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data.status === 'success') {
          setStatus('success')
          setMessage('Your plan has been upgraded to Pro!')
          setTimeout(() => router.push('/billing'), 4000)
        } else {
          setStatus('error')
          setMessage(data.detail || 'Payment verification failed.')
        }
      } catch (err) {
        setStatus('error')
        setMessage('Could not verify payment. Please contact support.')
      }
    }

    verify()
  }, [reference])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 40px', textAlign: 'center', maxWidth: 420, width: '100%' }}>

        {status === 'loading' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', margin: '0 auto 24px', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Verifying payment...</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Payment confirmed!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 24 }}>{message}</p>
            <div style={{ padding: '10px 16px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, color: 'var(--accent)', fontSize: 12 }}>
              Redirecting to billing in a few seconds...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Verification failed</h2>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 24 }}>{message}</p>
            <Link href="/billing" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--accent)', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Back to Billing
            </Link>
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 24 }}>
          Reference: <code style={{ background: 'var(--elevated)', padding: '2px 6px', borderRadius: 4 }}>{reference || 'none'}</code>
        </p>
      </div>
    </div>
  )
}
