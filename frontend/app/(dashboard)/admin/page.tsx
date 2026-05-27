'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, dashApi } from '@/lib/api'

const PHASES = [
  { num: 1, name: 'Core Scanner + GitHub OAuth',          status: 'complete', date: 'Apr 2026' },
  { num: 2, name: 'JWT Auth + Rate Limiting + Dashboard', status: 'complete', date: 'May 21 2026' },
  { num: 3, name: 'SaaS Foundation + Full UI',            status: 'active',   date: 'May 27 2026' },
  { num: 4, name: 'Multi-agent Brain + Intelligence',     status: 'pending',  date: '—' },
  { num: 5, name: 'Production + YC W2027 Launch',         status: 'pending',  date: '—' },
]

const DONE_ITEMS = [
  'JWT auth + rate limiting',
  'SaaS org/user/billing DB models',
  'Email/password register + login',
  'Full SaaS UI — all 6 pages',
  'UI wired to live backend data',
  '/findings endpoint with 5min cache',
  'Paystack billing endpoints',
  'CI/CD pipeline (Gitleaks + Trivy + SonarCloud)',
  'GCP Cloud Run deployment',
  'Admin panel — owner only',
]

const PENDING_ITEMS = [
  'Connect Repo button — save to DB',
  'GitHub OAuth connect flow',
  'Resolve finding — persist to DB',
  'Team invite — send actual email',
  'Settings profile update',
  'Sidebar collapsible',
  'Fonts (Syne/DM Sans)',
  '"Phase: undefined" dashboard bug',
  'Scan Now per-repo button',
]

function timeAgo(dateStr: string) {
  const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

export default function AdminPage() {
  const router   = useRouter()
  const [project,  setProject]  = useState<any>(null)
  const [health,   setHealth]   = useState<any>(null)
  const [user,     setUser]     = useState<any>(null)
  const [commits,  setCommits]  = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchData = useCallback(async () => {
    await Promise.allSettled([
      fetch('http://localhost:8000/project/status').then(r => r.json()).then(setProject),
      dashApi.health().then(setHealth),
    ])
    setLastRefresh(new Date())
  }, [])

  const fetchCommits = useCallback(async () => {
    try {
      // Fetch all branches first
      const branchRes = await fetch('https://api.github.com/repos/ashNikov/devsec-agent/branches')
      const branchData = await branchRes.json()
      setBranches(Array.isArray(branchData) ? branchData : [])

      // Fetch commits from all branches
      const allCommits: any[] = []
      const seen = new Set<string>()

      for (const branch of (Array.isArray(branchData) ? branchData : [])) {
        const res = await fetch(
          `https://api.github.com/repos/ashNikov/devsec-agent/commits?sha=${branch.name}&per_page=10`
        )
        const data = await res.json()
        if (Array.isArray(data)) {
          for (const c of data) {
            if (!seen.has(c.sha)) {
              seen.add(c.sha)
              allCommits.push({ ...c, branch: branch.name })
            }
          }
        }
      }

      // Sort by date desc
      allCommits.sort((a, b) =>
        new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
      )
      setCommits(allCommits.slice(0, 20))
    } catch (e) {
      setCommits([])
    }
  }, [])

  useEffect(() => {
    authApi.me().then(u => {
      setUser(u)
      if (u.role !== 'owner') router.replace('/dashboard')
    }).catch(() => router.replace('/login'))

    fetchData().finally(() => setLoading(false))
    fetchCommits()

    // Auto-refresh every 30 seconds
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [router, fetchData, fetchCommits])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading admin panel…
    </div>
  )

  if (user?.role !== 'owner') return null

  const progress = project?.current_phase_progress ?? 65
  const tools    = health?.tools || {}
  const sonar    = health?.sonarcloud || {}
  const sonarStatus = sonar.status || 'unknown'
  const toolsWithSonar = { ...tools, sonarcloud: sonarStatus }
  const activeTools = Object.values(toolsWithSonar).filter((v: any) => v === 'active').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.03))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 12, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>ADMIN · OWNER ONLY</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)' }}>
            {project?.project || 'AgentSec'} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>v{project?.version}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 4 }}>{project?.commercial_focus}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last commit</div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--fm)', marginTop: 2 }}>{project?.last_commit}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
            Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString()}
          </div>
          <button onClick={fetchData} style={{ marginTop: 6, padding: '3px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 5, color: '#3B82F6', fontSize: 11, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Phase progress */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Phase {project?.current_phase} — {project?.current_phase_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Next: {project?.next_phase}</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: progress >= 80 ? 'var(--accent)' : '#FFB340', fontFamily: 'var(--fh)' }}>
            {progress}%
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--elevated)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progress >= 80 ? 'var(--accent)' : '#FFB340', borderRadius: 4, transition: 'width 0.6s ease' }} />
        </div>

        {/* Phase timeline */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PHASES.map(p => (
            <div key={p.num} style={{ flex: 1, padding: '10px 12px', background: 'var(--elevated)', border: `1px solid ${p.status === 'complete' ? 'rgba(0,229,160,0.3)' : p.status === 'active' ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.status === 'complete' ? 'var(--accent)' : p.status === 'active' ? '#3B82F6' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--bg)', fontWeight: 700, flexShrink: 0 }}>
                  {p.status === 'complete' ? '✓' : p.num}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.status === 'complete' ? 'var(--accent)' : p.status === 'active' ? '#3B82F6' : 'var(--text-muted)' }}>P{p.num}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 9, color: p.status === 'complete' ? 'var(--accent)' : p.status === 'active' ? '#3B82F6' : 'var(--text-muted)', fontFamily: 'var(--fm)' }}>{p.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Done vs Pending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 14 }}>✓ Done ({DONE_ITEMS.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DONE_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#FFB340', marginBottom: 14 }}>⏳ Pending ({PENDING_ITEMS.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PENDING_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFB340', flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commits */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recent Commits</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              All branches · {branches.length} branch{branches.length !== 1 ? 'es' : ''}: {branches.map(b => b.name).join(', ')}
            </div>
          </div>
          <a href="https://github.com/ashNikov/devsec-agent/commits" target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'none' }}>
            View on GitHub ↗
          </a>
        </div>

        {commits.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading commits…</div>
        ) : commits.map((c, i) => (
          <div key={c.sha} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: i < commits.length - 1 ? '1px solid var(--border)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {/* Avatar */}
            {c.author?.avatar_url ? (
              <img src={c.author.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--elevated)', flexShrink: 0 }} />
            )}
            {/* Message */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.commit.message.split('\n')[0]}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {c.commit.author.name} · {timeAgo(c.commit.author.date)}
              </div>
            </div>
            {/* Branch */}
            <div style={{ padding: '2px 8px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, fontSize: 10, color: '#3B82F6', fontFamily: 'var(--fm)', flexShrink: 0 }}>
              {c.branch}
            </div>
            {/* Hash */}
            <a href={c.html_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--fm)', textDecoration: 'none', flexShrink: 0 }}>
              {c.sha.slice(0, 7)}
            </a>
          </div>
        ))}
      </div>

      {/* Stack + Tool health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Stack</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {project?.stack && Object.entries(project.stack).map(([key, val]: any) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.3px' }}>{key.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: 'var(--text-sec)', textAlign: 'right', maxWidth: 180 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tool health */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
              Live Tool Health <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>· {activeTools}/5 active</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(toolsWithSonar).map(([tool, status]: any) => {
                const color = status === 'active' ? '#00E5A0' : status === 'error' ? '#FF4757' : '#FFB340'
                return (
                  <div key={tool} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sec)', textTransform: 'capitalize' }}>{tool}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: status === 'active' ? `0 0 5px ${color}` : 'none' }} />
                      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{status.toUpperCase()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--fm)' }}>
              {health?.model}
            </div>
          </div>

          {/* SonarCloud */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>SonarCloud</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Quality Gate',    value: sonar.quality_gate,    color: sonar.quality_gate === 'OK' ? '#00E5A0' : '#FF4757' },
                { label: 'Total Issues',    value: sonar.total_issues,    color: 'var(--text-sec)' },
                { label: 'Security Issues', value: sonar.security_issues, color: sonar.security_issues > 0 ? '#FF4757' : '#00E5A0' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: 11, color: row.color, fontWeight: 600 }}>{String(row.value ?? '—')}</span>
                </div>
              ))}
            </div>
            {sonar.dashboard_url && (
              <a href={sonar.dashboard_url} target="_blank" rel="noreferrer"
                style={{ display: 'block', marginTop: 12, fontSize: 11, color: '#3B82F6', textDecoration: 'none' }}>
                → SonarCloud Dashboard ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Commercial tiers */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Commercial Tiers</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {project?.tiers && Object.entries(project.tiers).map(([tier, desc]: any) => (
            <div key={tier} style={{ padding: '12px 16px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: tier === 'free' ? 'var(--accent)' : '#FFB340', fontWeight: 700, letterSpacing: '0.4px', marginBottom: 6 }}>
                {tier.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
