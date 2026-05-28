'use client'

import { useEffect, useState } from 'react'
import { teamApi } from '@/lib/api'

const roleColor: Record<string, { bg: string; text: string; border: string }> = {
  owner:  { bg: 'rgba(0,229,160,0.1)',    text: 'var(--accent)',    border: 'rgba(0,229,160,0.25)' },
  admin:  { bg: 'rgba(59,130,246,0.1)',   text: '#3B82F6',          border: 'rgba(59,130,246,0.25)' },
  member: { bg: 'rgba(139,149,168,0.1)',  text: 'var(--text-sec)',  border: 'rgba(139,149,168,0.2)' },
  viewer: { bg: 'rgba(139,149,168,0.1)',  text: 'var(--text-sec)',  border: 'rgba(139,149,168,0.2)' },
}

export default function TeamPage() {
  const [members,     setMembers]     = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting,    setInviting]    = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [emailSent,   setEmailSent]   = useState(false)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    teamApi.list()
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true); setError(''); setInviteToken('')
    try {
      const res = await teamApi.invite(inviteEmail)
      setInviteToken(res.token || '')
      setEmailSent(res.email_sent === true)
      setInviteEmail('')
    } catch (err: any) {
      setError(err.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleCopy = () => {
    if (inviteToken) {
      navigator.clipboard.writeText(inviteToken).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Members */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Team Members</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : members.map((m: any, i: number) => {
          const rc = roleColor[m.role] || roleColor.viewer
          const initials = (m.email || '??').slice(0, 2).toUpperCase()
          return (
            <div key={m.user_id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    Joined {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '3px 10px', borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text, fontSize: 11, fontWeight: 600 }}>
                  {(m.role || 'member').toUpperCase()}
                </div>
                {m.role !== 'owner' && (
                  <button style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 6, color: '#FF4757', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Invite a Team Member</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          An invite token will be generated — share it with the invitee to accept via the onboarding link.
        </div>

        {error && (
          <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 7, padding: '9px 14px', color: '#FF4757', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Token display */}
        {inviteToken && (
          <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>
              {emailSent ? '✓ Invite email sent + token generated:' : '✓ Invite token generated — share this with the invitee:'}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '8px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {inviteToken}
              </div>
              <button onClick={handleCopy}
                style={{ padding: '8px 14px', background: copied ? 'rgba(0,229,160,0.1)' : 'var(--elevated)', border: `1px solid ${copied ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`, borderRadius: 7, color: copied ? 'var(--accent)' : 'var(--text-sec)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              ⚠ Token expires in 7 days · Only share via secure channel
            </div>
          </div>
        )}

        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>EMAIL ADDRESS</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@company.com" required
              style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <button type="submit" disabled={inviting || !inviteEmail}
            style={{ padding: '9px 20px', background: inviting ? 'var(--elevated)' : 'var(--accent)', border: 'none', borderRadius: 8, color: inviting ? 'var(--text-muted)' : 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: inviting ? 'wait' : 'pointer', whiteSpace: 'nowrap' as const }}>
            {inviting ? 'Generating…' : 'Generate Invite'}
          </button>
        </form>
      </div>

      {/* Role permissions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Role Permissions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12 }}>
          {[
            ['', 'Owner', 'Admin', 'Viewer'],
            ['View findings & repos', '✓', '✓', '✓'],
            ['Trigger scans', '✓', '✓', '✗'],
            ['Manage integrations', '✓', '✓', '✗'],
            ['Invite team members', '✓', '✗', '✗'],
            ['Manage billing', '✓', '✗', '✗'],
          ].map((row, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {row.map((cell, j) => (
                <div key={j} style={{ fontSize: i === 0 ? 10 : 12, color: cell === '✓' ? 'var(--accent)' : cell === '✗' ? 'var(--text-muted)' : i === 0 && j === 0 ? 'var(--text-muted)' : j === 0 ? 'var(--text-sec)' : 'var(--text)', fontWeight: i === 0 ? 600 : 400, borderBottom: i < 5 ? '1px solid var(--border)' : 'none', paddingBottom: i < 5 ? 10 : 0, paddingTop: i > 0 ? 2 : 0, textAlign: j > 0 ? 'center' as const : 'left' as const }}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
