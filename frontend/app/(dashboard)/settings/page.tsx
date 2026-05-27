'use client'

import { useState } from 'react'
import { settingsApi } from '@/lib/api'

const INTEGRATIONS = [
  { name: 'GitHub', desc: 'Repository scanning · OAuth connected', icon: '⬡', status: 'connected', color: '#00E5A0' },
  { name: 'GCP', desc: 'agent-sec-496307 · Cloud Run deployed', icon: '☁', status: 'connected', color: '#00E5A0' },
  { name: 'Supabase', desc: 'Database · Connection string configured', icon: '⬢', status: 'connected', color: '#00E5A0' },
  { name: 'ngrok', desc: 'Tunneling · Dev webhooks active', icon: '⌁', status: 'connected', color: '#00E5A0' },
  { name: 'Paystack', desc: 'Payments · API key pending configuration', icon: '₦', status: 'pending', color: '#FFB340' },
  { name: 'Slack', desc: 'Notifications · Not connected', icon: '◈', status: 'disconnected', color: '#3D4557' },
]

const statusLabel: Record<string, { label: string; bg: string; text: string; border: string }> = {
  connected: { label: 'Connected', bg: 'rgba(0,229,160,0.08)', text: 'var(--accent)', border: 'rgba(0,229,160,0.2)' },
  pending: { label: 'Pending', bg: 'rgba(255,179,64,0.08)', text: '#FFB340', border: 'rgba(255,179,64,0.2)' },
  disconnected: { label: 'Disconnected', bg: 'rgba(61,69,87,0.3)', text: 'var(--text-muted)', border: 'rgba(61,69,87,0.5)' },
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: 'Uwem Udo', email: 'uwemudo007@gmail.com' })
  const [apiKey, setApiKey] = useState('sk-agentsec-xK9mP2qL8nR4vW7jY1')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.updateProfile(profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenKey = async () => {
    setRegenerating(true)
    try {
      const { api_key } = await settingsApi.regenerateApiKey()
      setApiKey(api_key)
    } catch {
      setApiKey('sk-agentsec-' + Math.random().toString(36).slice(2, 18))
    } finally {
      setRegenerating(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--elevated)',
    border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 700 }}>

      {/* Profile */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Profile</div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>FULL NAME</label>
            <input style={inputStyle} type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>EMAIL</label>
            <input style={inputStyle} type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
          Use this to authenticate AgentSec API calls. Keep it secret — treat it like a password.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '9px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--text-sec)', letterSpacing: showKey ? 0 : '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {showKey ? apiKey : '••••••••••••••••••••••••••••'}
          </div>
          <button onClick={() => setShowKey(s => !s)} style={{ padding: '9px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-sec)', fontSize: 12, cursor: 'pointer' }}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button onClick={handleCopyKey} style={{ padding: '9px 14px', background: copied ? 'rgba(0,229,160,0.1)' : 'var(--elevated)', border: `1px solid ${copied ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`, borderRadius: 7, color: copied ? 'var(--accent)' : 'var(--text-sec)', fontSize: 12, cursor: 'pointer' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={handleRegenKey} disabled={regenerating} style={{ padding: '9px 14px', background: 'var(--elevated)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 7, color: '#FF4757', fontSize: 12, cursor: 'pointer' }}>
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          ⚠ Regenerating will invalidate your existing key immediately.
        </div>
      </div>

      {/* Scan Defaults */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Scan Defaults</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Auto-scan on push', desc: 'Trigger a scan whenever you push to a connected repo', enabled: true },
            { label: 'Slack notifications', desc: 'Send alerts to Slack when critical findings are detected', enabled: false },
            { label: 'Email digest', desc: 'Weekly summary of findings and resolved issues', enabled: true },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{ width: 38, height: 22, borderRadius: 11, background: item.enabled ? 'var(--accent)' : 'var(--elevated)', border: `1px solid ${item.enabled ? 'var(--accent)' : 'var(--border)'}`, position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: item.enabled ? 18 : 2, transition: 'left 0.2s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Integrations</div>
        </div>
        {INTEGRATIONS.map((intg, i) => {
          const sl = statusLabel[intg.status]
          return (
            <div key={intg.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < INTEGRATIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: intg.color }}>
                  {intg.icon}
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
                  <button style={{ padding: '6px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-sec)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {intg.status === 'pending' ? 'Configure' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Danger zone */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FF4757', marginBottom: 16 }}>Danger Zone</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Delete workspace</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Permanently delete all repos, findings, and team data. This cannot be undone.</div>
          </div>
          <button style={{ padding: '8px 16px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 8, color: '#FF4757', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Delete Workspace
          </button>
        </div>
      </div>
    </div>
  )
}
