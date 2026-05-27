'use client'

import { useEffect, useState } from 'react'
import { reposApi } from '@/lib/api'

const MOCK_REPOS = [
  { id: 1, name: 'devsec-agent', branch: 'main', language: 'Python', issues: 0, lastScan: '8m ago', status: 'clean' },
  { id: 2, name: 'agentsec-frontend', branch: 'main', language: 'TypeScript', issues: 0, lastScan: '2h ago', status: 'clean' },
  { id: 3, name: 'ashflix-api', branch: 'main', language: 'Python', issues: 15, lastScan: '2m ago', status: 'critical' },
  { id: 4, name: 'price-transparency', branch: 'main', language: 'Python', issues: 1, lastScan: '15m ago', status: 'high' },
  { id: 5, name: 'footyiq-backend', branch: 'main', language: 'Python', issues: 2, lastScan: '1h ago', status: 'medium' },
  { id: 6, name: 'propforge-api', branch: 'main', language: 'Python', issues: 0, lastScan: '3h ago', status: 'clean' },
  { id: 7, name: 'sabitech-app', branch: 'main', language: 'TypeScript', issues: 3, lastScan: '5h ago', status: 'medium' },
  { id: 8, name: 'ashflix-frontend', branch: 'main', language: 'TypeScript', issues: 0, lastScan: '6h ago', status: 'clean' },
]

const statusColor: Record<string, string> = {
  critical: '#FF4757', high: '#FFB340', medium: '#3B82F6', clean: '#00E5A0',
}
const langColor: Record<string, string> = {
  Python: '#3B82F6', TypeScript: '#FFB340', JavaScript: '#F7DF1E',
}

export default function ReposPage() {
  const [repos, setRepos] = useState(MOCK_REPOS)
  const [scanning, setScanning] = useState<number | null>(null)
  const [showConnect, setShowConnect] = useState(false)

  useEffect(() => {
    reposApi.list().then(r => { if (r?.length) setRepos(r) }).catch(() => {})
  }, [])

  const handleScan = async (id: number) => {
    setScanning(id)
    try {
      await reposApi.scan(id)
      setTimeout(() => setScanning(null), 3000)
    } catch {
      setScanning(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{repos.length} repositories connected · ashNikov</div>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Connect Repo
        </button>
      </div>

      {/* Connect modal */}
      {showConnect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,15,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, width: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 6 }}>Connect Repository</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 20 }}>Enter a GitHub repo URL to start scanning it with AgentSec.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>GITHUB URL</label>
              <input
                type="text"
                placeholder="https://github.com/ashNikov/my-repo"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
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
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px 120px 120px', padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 16 }}>
          {['REPOSITORY', 'BRANCH', 'LANGUAGE', 'ISSUES', 'LAST SCAN', 'ACTION'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {repos.map((repo, i) => (
          <div
            key={repo.id}
            style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px 120px 120px', padding: '14px 20px', gap: 16, alignItems: 'center', borderBottom: i < repos.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Repo name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[repo.status] || '#8B95A8', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)', fontWeight: 500 }}>ashNikov/{repo.name}</div>
              </div>
            </div>
            {/* Branch */}
            <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{repo.branch}</div>
            {/* Language */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: langColor[repo.language] || '#8B95A8' }} />
              <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{repo.language}</span>
            </div>
            {/* Issues */}
            <div style={{ fontSize: 13, color: repo.issues > 0 ? statusColor[repo.status] : 'var(--text-sec)', fontWeight: repo.issues > 0 ? 600 : 400 }}>
              {repo.issues > 0 ? repo.issues : '—'}
            </div>
            {/* Last scan */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repo.lastScan}</div>
            {/* Action */}
            <button
              onClick={() => handleScan(repo.id)}
              disabled={scanning === repo.id}
              style={{ padding: '6px 14px', background: scanning === repo.id ? 'rgba(0,229,160,0.08)' : 'var(--elevated)', border: `1px solid ${scanning === repo.id ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`, borderRadius: 6, color: scanning === repo.id ? 'var(--accent)' : 'var(--text-sec)', fontSize: 11, fontWeight: 500, cursor: scanning === repo.id ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
            >
              {scanning === repo.id ? 'Scanning…' : 'Scan Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
