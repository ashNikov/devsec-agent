'use client'

import { useEffect, useState } from 'react'
import { reposApi } from '@/lib/api'

const langColor: Record<string, string> = {
  Python: '#3B82F6', TypeScript: '#FFB340', JavaScript: '#F7DF1E',
}

export default function ReposPage() {
  const [repos,    setRepos]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg,  setScanMsg]  = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [connectUrl,  setConnectUrl]  = useState('')

  useEffect(() => {
    reposApi.list()
      .then(data => {
        // Backend returns GitHub repo objects
        setRepos(Array.isArray(data) ? data : [])
      })
      .catch(() => setRepos([]))
      .finally(() => setLoading(false))
  }, [])

  const handleScanAll = async () => {
    setScanning(true); setScanMsg('')
    try {
      await reposApi.triggerScan()
      setScanMsg('Scan triggered — check Slack for results')
      setTimeout(() => setScanMsg(''), 8000)
    } catch (e: any) {
      setScanMsg(e.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  // Normalise GitHub API repo shape
  const normalised = repos.map(r => ({
    id:       r.id,
    name:     r.name || r.repo_name,
    fullName: r.full_name || `ashNikov/${r.name || r.repo_name}`,
    branch:   r.default_branch || 'main',
    language: r.language || 'Unknown',
    private:  r.private ?? false,
    url:      r.html_url || r.repo_url || '',
    updated:  r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${normalised.length} repositories · ashNikov`}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleScanAll}
            disabled={scanning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: scanning ? 'var(--elevated)' : 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: scanning ? 'wait' : 'pointer' }}
          >
            {scanning ? 'Scanning…' : '▶ Scan All'}
          </button>
          <button
            onClick={() => setShowConnect(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Connect Repo
          </button>
        </div>
      </div>

      {scanMsg && (
        <div style={{ padding: '9px 14px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>
          ✓ {scanMsg}
        </div>
      )}

      {/* Connect modal */}
      {showConnect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,15,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, width: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 6 }}>Connect Repository</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 20 }}>Enter a GitHub repo URL to add it to your workspace.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>GITHUB URL</label>
              <input type="text" value={connectUrl} onChange={e => setConnectUrl(e.target.value)} placeholder="https://github.com/ashNikov/my-repo"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConnect(false)} style={{ flex: 1, padding: '9px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sec)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => setShowConnect(false)} style={{ flex: 1, padding: '9px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px 120px', padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 16 }}>
          {['REPOSITORY', 'BRANCH', 'LANGUAGE', 'VISIBILITY', 'UPDATED'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading repositories…</div>
        ) : normalised.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No repositories found</div>
        ) : normalised.map((repo, i) => (
          <div key={repo.id ?? i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px 120px', padding: '14px 20px', gap: 16, alignItems: 'center', borderBottom: i < normalised.length - 1 ? '1px solid var(--border)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)', fontWeight: 500 }}>
                {repo.fullName}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{repo.branch}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: langColor[repo.language] || '#8B95A8' }} />
              <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{repo.language}</span>
            </div>
            <div style={{ fontSize: 11, color: repo.private ? '#FFB340' : 'var(--text-sec)', fontFamily: 'var(--fm)' }}>
              {repo.private ? 'Private' : 'Public'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repo.updated}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
