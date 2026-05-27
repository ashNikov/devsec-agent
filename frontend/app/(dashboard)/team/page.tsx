'use client'

import { useEffect, useState } from 'react'
import { teamApi } from '@/lib/api'

const MOCK_MEMBERS = [
  { id: 1, name: 'Uwem Udo', email: 'uwemudo007@gmail.com', role: 'owner', avatar: 'UU', joined: 'Apr 2026', lastActive: 'now' },
  { id: 2, name: 'Pepsy Ntuen', email: 'pepsy@nvidia.com', role: 'viewer', avatar: 'PN', joined: 'May 2026', lastActive: '2d ago' },
]

const roleColor: Record<string, { bg: string; text: string; border: string }> = {
  owner: { bg: 'rgba(0,229,160,0.1)', text: 'var(--accent)', border: 'rgba(0,229,160,0.25)' },
  admin: { bg: 'rgba(59,130,246,0.1)', text: '#3B82F6', border: 'rgba(59,130,246,0.25)' },
  viewer: { bg: 'rgba(139,149,168,0.1)', text: 'var(--text-sec)', border: 'rgba(139,149,168,0.2)' },
}

export default function TeamPage() {
  const [members, setMembers] = useState(MOCK_MEMBERS)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    teamApi.list().then(m => { if (m?.length) setMembers(m) }).catch(() => {})
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true); setError(''); setSuccess('')
    try {
      await teamApi.invite(inviteEmail, inviteRole)
      setSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    } catch (err: any) {
      setError(err.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Members */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Team Members</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{members.length} member{members.length !== 1 ? 's' : ''} · Starter Beta plan</div>
          </div>
        </div>

        {members.map((m, i) => {
          const rc = roleColor[m.role] || roleColor.viewer
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {m.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined {m.joined}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active {m.lastActive}</div>
                <div style={{ padding: '3px 10px', borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text, fontSize: 11, fontWeight: 600 }}>
                  {m.role.toUpperCase()}
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

      {/* Invite form */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Invite a Team Member</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>They'll receive an email invite to join your AgentSec workspace.</div>

        {success && (
          <div style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 7, padding: '9px 14px', color: 'var(--accent)', fontSize: 13, marginBottom: 14 }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 7, padding: '9px 14px', color: '#FF4757', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>EMAIL ADDRESS</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ width: 120 }}>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>ROLE</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail}
            style={{ padding: '9px 20px', background: inviting ? 'var(--elevated)' : 'var(--accent)', border: 'none', borderRadius: 8, color: inviting ? 'var(--text-muted)' : 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: inviting ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Permissions note */}
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
                <div key={j} style={{
                  fontSize: i === 0 ? 10 : 12,
                  color: cell === '✓' ? 'var(--accent)' : cell === '✗' ? 'var(--text-muted)' : i === 0 && j === 0 ? 'var(--text-muted)' : j === 0 ? 'var(--text-sec)' : 'var(--text)',
                  fontWeight: i === 0 ? 600 : 400,
                  letterSpacing: i === 0 ? '0.4px' : 0,
                  borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                  paddingBottom: i < 5 ? 10 : 0,
                  paddingTop: i > 0 ? 2 : 0,
                  textAlign: j > 0 ? 'center' : 'left',
                }}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
