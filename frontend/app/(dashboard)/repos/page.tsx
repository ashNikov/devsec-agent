'use client'

import { useEffect, useState } from 'react'
import { reposApi } from '@/lib/api'

const langColor: Record<string, string> = {
  Python: '#3B82F6', TypeScript: '#FFB340', JavaScript: '#F7DF1E',
}

export default function ReposPage() {
  const [repos,       setRepos]       = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [scanningAll, setScanningAll] = useState(false)
  const [scanningRepo, setScanningRepo] = useState<string | null>(null)
  const [scanResults,  setScanResults]  = useState<Record<string, any>>({})
  const [showConnect,  setShowConnect]  = useState(false)
  const [connectName,  setConnectName]  = useState('')
  const [connectUrl,   setConnectUrl]   = useState('')
  const [connecting,   setConnecting]   = useState(false)
  const [connectMsg,   setConnectMsg]   = useState('')
  const [msg,          setMsg]          = useState('')

  useEffect(() => {
    reposApi.list()
      .then(data => setRepos(Array.isArray(data) ? data : []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false))
  }, [])

  const handleScanAll = async () => {
    setScanningAll(true); setMsg('')
    try {
      await reposApi.triggerScan()
      setMsg('Scan triggered — check Slack for results')
      setTimeout(() => setMsg(''), 8000)
    } catch (e: any) {
      setMsg(e.message || 'Scan failed')
    } finally {
      setScanningAll(false)
    }
  }

  const handleScanRepo = async (repoName: string) => {
    setScanningRepo(repoName)
    try {
      const result = await reposApi.scanRepo(repoName)
      setScanResults(prev => ({ ...prev, [repoName]: result }))
    } catch (e: any) {
      setScanResults(prev => ({ ...prev, [repoName]: { error: e.message } }))
    } finally {
      setScanningRepo(null)
    }
  }

  const handleConnect = async () => {
    if (!connectName) return
    setConnecting(true); setConnectMsg('')
    try {
      await reposApi.addRepo(connectName, connectUrl)
      setConnectMsg('Repo connected successfully')
      setConnectName(''); setConnectUrl('')
      setTimeout(() => { setShowConnect(false); setConnectMsg('') }, 2000)
    } catch (e: any) {
      setConnectMsg(e.message || 'Failed to connect repo')
    } finally {
      setConnecting(false)
    }
  }

  const normalised = repos.map(r => ({
    id:       r.id,
    name:     r.name || r.repo_name,
    fullName: r.full_name || `ashNikov/${r.name || r.repo_name}`,
    branch:   r.default_branch || 'main',
    language: r.language || 'Unknown',
    private:  r.private ?? false,
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
          <button onClick={handleScanAll} disabled={scanningAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: scanningAll ? 'var(--elevated)' : 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: scanningAll ? 'wait' : 'pointer' }}>
            {scanningAll ? 'Scanning…' : '▶ Scan All'}
          </button>
          <button onClick={() => setShowConnect(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Connect Repo
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '9px 14px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>
          ✓ {msg}
        </div>
      )}

      {/* Connect modal */}
      {showConnect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,15,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, width: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 6 }}>Connect Repository</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 20 }}>Add a repo to your AgentSec workspace for scanning.</p>

            {connectMsg && (
              <div style={{ padding: '8px 12px', background: connectMsg.includes('success') ? 'rgba(0,229,160,0.08)' : 'rgba(255,71,87,0.08)', border: `1px solid ${connectMsg.includes('success') ? 'rgba(0,229,160,0.2)' : 'rgba(255,71,87,0.2)'}`, borderRadius: 7, color: connectMsg.includes('success') ? 'var(--accent)' : '#FF4757', fontSize: 12, marginBottom: 14 }}>
                {connectMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>REPO NAME</label>
                <input type="text" value={connectName} onChange={e => setConnectName(e.target.value)} placeholder="my-repo"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', marginBottom: 5 }}>GITHUB URL (optional)</label>
                <input type="text" value={connectUrl} onChange={e => setConnectUrl(e.target.value)} placeholder="https://github.com/ashNikov/my-repo"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowConnect(false); setConnectMsg('') }}
                style={{ flex: 1, padding: '9px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sec)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleConnect} disabled={connecting || !connectName}
                style={{ flex: 1, padding: '9px', background: connecting ? 'var(--elevated)' : 'var(--accent)', border: 'none', borderRadius: 8, color: connecting ? 'var(--text-muted)' : 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: connecting ? 'wait' : 'pointer' }}>
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 80px 110px 110px', padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 16 }}>
          {['REPOSITORY', 'BRANCH', 'LANGUAGE', 'VISIBILITY', 'UPDATED', 'ACTION'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading repositories…</div>
        ) : normalised.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No repositories found</div>
        ) : normalised.map((repo, i) => {
          const result = scanResults[repo.name]
          const isScanning = scanningRepo === repo.name
          return (
            <div key={repo.id ?? i}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 80px 110px 110px', padding: '14px 20px', gap: 16, alignItems: 'center', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)', fontWeight: 500 }}>{repo.fullName}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{repo.branch}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: langColor[repo.language] || '#8B95A8' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{repo.language}</span>
                </div>
                <div style={{ fontSize: 11, color: repo.private ? '#FFB340' : 'var(--text-sec)' }}>
                  {repo.private ? 'Private' : 'Public'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repo.updated}</div>
                <button onClick={() => handleScanRepo(repo.name)} disabled={isScanning || !!scanningRepo}
                  style={{ padding: '6px 14px', background: isScanning ? 'rgba(0,229,160,0.08)' : 'var(--elevated)', border: `1px solid ${isScanning ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`, borderRadius: 6, color: isScanning ? 'var(--accent)' : 'var(--text-sec)', fontSize: 11, fontWeight: 500, cursor: isScanning ? 'wait' : 'pointer' }}>
                  {isScanning ? 'Scanning…' : 'Scan Now'}
                </button>
              </div>
              {/* Scan result row */}
              {result && (
                <div style={{ padding: '8px 20px 10px 52px', background: result.error ? 'rgba(255,71,87,0.04)' : 'rgba(0,229,160,0.03)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  {result.error ? (
                    <span style={{ color: '#FF4757' }}>✗ {result.error}</span>
                  ) : result.skipped ? (
                    <span style={{ color: 'var(--text-muted)' }}>Skipped — large repo (covered by scheduled scan)</span>
                  ) : (
                    <span style={{ color: result.total > 0 ? '#FFB340' : 'var(--accent)' }}>
                      {result.total > 0
                        ? `⚠ ${result.total} potential secret${result.total > 1 ? 's' : ''} found in ${result.files_checked} files`
                        : `✓ Clean — ${result.files_checked} files checked`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
