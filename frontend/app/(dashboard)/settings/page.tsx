'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, settingsApi, orgApi } from '@/lib/api'

const INTEGRATION_ICONS: Record<string, string> = {
  GitHub: '⬡', GCP: '☁', Supabase: '⬢', ngrok: '⌁', Paystack: '₦', Slack: '◈',
}
const INTEGRATION_COLORS: Record<string, string> = {
  GitHub: '#00E5A0', GCP: '#00E5A0', Supabase: '#00E5A0',
  ngrok: '#00E5A0', Paystack: '#FFB340', Slack: '#00E5A0',
}

const statusLabel: Record<string, { label: string; bg: string; text: string; border: string }> = {
  connected:    { label: 'Connected',    bg: 'rgba(0,229,160,0.08)',  text: 'var(--accent)',    border: 'rgba(0,229,160,0.2)' },
  pending:      { label: 'Pending',      bg: 'rgba(255,179,64,0.08)', text: '#FFB340',           border: 'rgba(255,179,64,0.2)' },
  disconnected: { label: 'Disconnected', bg: 'rgba(61,69,87,0.3)',    text: 'var(--text-muted)', border: 'rgba(61,69,87,0.5)' },
}

export default function SettingsPage() {
  const router         = useRouter()
  const searchParams   = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const [githubMsg,    setGithubMsg]    = useState('')
  const [user,         setUser]         = useState<any>(null)
  const [email,        setEmail]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [apiKey,       setApiKey]       = useState('')
  const [showKey,      setShowKey]      = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [intgLoading,  setIntgLoading]  = useState(true)
  const [showDelete,   setShowDelete]   = useState(false)
  const [deleteInput,  setDeleteInput]  = useState('')
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => {
    // Handle GitHub connect callback
    const githubStatus = searchParams.get('github')
    const githubLogin  = searchParams.get('login')
    if (githubStatus === 'connected') {
      setGithubMsg(`✓ GitHub connected as @${githubLogin}`)
      // Refresh integrations
      setTimeout(() => window.location.href = '/settings', 2000)
    } else if (githubStatus === 'error') {
      setGithubMsg('✗ GitHub connect failed — try again')
    }

    authApi.me().then(u => {
      setUser(u)
      setEmail(u.sub || u.email || '')
    }).catch(() => {})

    // Fetch real integration status from backend
    const token = localStorage.getItem('agentsec_token')
    fetch('http://localhost:8000/org/integrations/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => setIntegrations([]))
      .finally(() => setIntgLoading(false))
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaved(false); setSaveError('')
    try {
      await authApi.updateProfile(email)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateKey = async () => {
    setCreating(true)
    try {
      const res = await settingsApi.createApiKey('Dashboard Key')
      setApiKey(res.key)
      setShowKey(true)
    } catch (e: any) {
      alert(e.message || 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'var(--elevated)',
    border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    try {
      await orgApi.deleteWorkspace()
      localStorage.removeItem('agentsec_token')
      router.push('/login')
    } catch (e: any) {
      alert(e.message || 'Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 700 }}>

      {/* Profile */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Profile</div>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>EMAIL</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>ROLE</label>
            <input style={{ ...inputStyle, color: 'var(--text-muted)' }} type="text" value={user?.role || '—'} readOnly />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>PLAN</label>
            <input style={{ ...inputStyle, color: 'var(--text-muted)' }} type="text" value={user?.plan || '—'} readOnly />
          </div>
          {saveError && <div style={{ fontSize: 12, color: '#FF4757' }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Saved</span>}
          </div>
        </form>
      </div>

      {/* API Key */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>API Key</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
          Use this to authenticate AgentSec API calls from CI/CD pipelines. Key is only shown once.
        </div>
        {apiKey ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ flex: 1, padding: '9px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {showKey ? apiKey : '••••••••••••••••••••••••••••'}
              </div>
              <button onClick={() => setShowKey(s => !s)} style={{ padding: '9px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-sec)', fontSize: 12, cursor: 'pointer' }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button onClick={handleCopy} style={{ padding: '9px 14px', background: copied ? 'rgba(0,229,160,0.1)' : 'var(--elevated)', border: `1px solid ${copied ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`, borderRadius: 7, color: copied ? 'var(--accent)' : 'var(--text-sec)', fontSize: 12, cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#FFB340' }}>⚠ Save this key now — it will NOT be shown again.</div>
          </>
        ) : (
          <button onClick={handleCreateKey} disabled={creating}
            style={{ padding: '9px 20px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sec)', fontSize: 13, fontWeight: 500, cursor: creating ? 'wait' : 'pointer' }}>
            {creating ? 'Generating…' : 'Generate API Key'}
          </button>
        )}
      </div>

      {/* Integrations — live from backend */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Integrations</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {githubMsg && (
              <span style={{ fontSize: 12, color: githubMsg.startsWith('✓') ? 'var(--accent)' : '#FF4757' }}>{githubMsg}</span>
            )}
            {!intgLoading && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {integrations.filter(i => i.status === 'connected').length}/{integrations.length} connected
              </div>
            )}
          </div>
        </div>

        {intgLoading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Checking integrations…</div>
        ) : integrations.map((intg, i) => {
          const sl = statusLabel[intg.status] || statusLabel.disconnected
          const icon = INTEGRATION_ICONS[intg.name] || '◉'
          const color = intg.status === 'connected' ? '#00E5A0' : intg.status === 'pending' ? '#FFB340' : '#3D4557'
          return (
            <div key={intg.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < integrations.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{intg.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{intg.desc}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '3px 10px', borderRadius: 5, background: sl.bg, border: `1px solid ${sl.border}`, color: sl.text, fontSize: 11, fontWeight: 600 }}>
                  {sl.label}
                </div>
                {intg.status !== 'connected' && (
                  <button
                    onClick={() => {
                      if (intg.name === 'GitHub') {
                        const token = localStorage.getItem('agentsec_token')
                        window.location.href = `http://localhost:8000/auth/github-connect?token=${token}`
                      } else if (intg.name === 'Paystack') window.open('https://dashboard.paystack.com', '_blank')
                      else if (intg.name === 'Slack') window.open('https://api.slack.com/apps', '_blank')
                    }}
                    style={{ padding: '6px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-sec)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {intg.status === 'pending' ? 'Configure' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,15,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 14, padding: 32, width: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FF4757', fontFamily: 'var(--fh)', marginBottom: 8 }}>Delete Workspace</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 6 }}>
              This will permanently delete your workspace, all repositories, findings, team members and billing data.
            </p>
            <p style={{ fontSize: 13, color: '#FF4757', fontWeight: 600, marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 8 }}>
                Type <span style={{ color: '#FF4757', fontFamily: 'var(--fm)' }}>DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: `1px solid ${deleteInput === 'DELETE' ? 'rgba(255,71,87,0.5)' : 'var(--border)'}`, borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--fm)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowDelete(false); setDeleteInput('') }}
                style={{ flex: 1, padding: '9px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sec)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== 'DELETE' || deleting}
                style={{ flex: 1, padding: '9px', background: deleteInput === 'DELETE' ? 'rgba(255,71,87,0.15)' : 'var(--elevated)', border: `1px solid ${deleteInput === 'DELETE' ? 'rgba(255,71,87,0.4)' : 'var(--border)'}`, borderRadius: 8, color: deleteInput === 'DELETE' ? '#FF4757' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                {deleting ? 'Deleting…' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FF4757', marginBottom: 16 }}>Danger Zone</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Delete workspace</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Permanently delete all repos, findings, and team data. Cannot be undone.</div>
          </div>
          <button onClick={() => setShowDelete(true)}
            style={{ padding: '8px 16px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 8, color: '#FF4757', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Delete Workspace
          </button>
        </div>
      </div>
    </div>
  )
}
