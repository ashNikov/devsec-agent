'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, dashApi } from '@/lib/api'

const PHASES = [
  { num: 1, name: 'Core Scanner + GitHub OAuth',         status: 'complete' },
  { num: 2, name: 'JWT Auth + Rate Limiting + Dashboard', status: 'complete' },
  { num: 3, name: 'SaaS Foundation + Full UI',            status: 'active'   },
  { num: 4, name: 'Multi-agent Brain + Intelligence Layer', status: 'pending' },
  { num: 5, name: 'Production + YC W2027 Launch',          status: 'pending' },
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

export default function AdminPage() {
  const router  = useRouter()
  const [project, setProject] = useState<any>(null)
  const [health,  setHealth]  = useState<any>(null)
  const [user,    setUser]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me().then(u => {
      setUser(u)
      if (u.role !== 'owner') {
        router.replace('/dashboard')
      }
    }).catch(() => router.replace('/login'))

    Promise.allSettled([
      fetch('http://localhost:8000/project/status').then(r => r.json()).then(setProject),
      dashApi.health().then(setHealth),
    ]).finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading admin panel…
    </div>
  )

  if (user?.role !== 'owner') return null

  const progress = project?.current_phase_progress ?? 0
  const toolStatuses = health?.tools || {}
  const sonar = health?.sonarcloud || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>

      {/* Header banner */}
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{project?.updated_at}</div>
        </div>
      </div>

      {/* Current phase + progress */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Phase {project?.current_phase} — {project?.current_phase_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Next: {project?.next_phase}
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: progress >= 80 ? 'var(--accent)' : progress >= 50 ? '#FFB340' : '#FF4757', fontFamily: 'var(--fh)' }}>
            {progress}%
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 8, background: 'var(--elevated)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progress >= 80 ? 'var(--accent)' : progress >= 50 ? '#FFB340' : '#FF4757', borderRadius: 4, transition: 'width 0.6s ease' }} />
        </div>

        {/* Phase timeline */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {PHASES.map(p => (
            <div key={p.num} style={{ flex: 1, padding: '10px 12px', background: 'var(--elevated)', border: `1px solid ${p.status === 'complete' ? 'rgba(0,229,160,0.3)' : p.status === 'active' ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.status === 'complete' ? 'var(--accent)' : p.status === 'active' ? '#3B82F6' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--bg)', fontWeight: 700, flexShrink: 0 }}>
                  {p.status === 'complete' ? '✓' : p.num}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.status === 'complete' ? 'var(--accent)' : p.status === 'active' ? '#3B82F6' : 'var(--text-muted)' }}>
                  P{p.num}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{p.name}</div>
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

      {/* Stack */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Stack</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {project?.stack && Object.entries(project.stack).map(([key, val]: any) => (
            <div key={key} style={{ padding: '10px 14px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.4px', marginBottom: 4 }}>{key.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.4 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool health + SonarCloud */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Live Tool Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries({ ...toolStatuses, sonarcloud: sonar.status || 'unknown' }).map(([tool, status]: any) => {
              const color = status === 'active' ? '#00E5A0' : status === 'error' ? '#FF4757' : '#FFB340'
              return (
                <div key={tool} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-sec)', textTransform: 'capitalize' }}>{tool}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{status.toUpperCase()}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>AI MODEL</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--fm)' }}>{health?.model}</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>SonarCloud</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Quality Gate', value: sonar.quality_gate, color: sonar.quality_gate === 'OK' ? '#00E5A0' : '#FF4757' },
              { label: 'Total Issues', value: sonar.total_issues, color: 'var(--text-sec)' },
              { label: 'Security Issues', value: sonar.security_issues, color: sonar.security_issues > 0 ? '#FF4757' : '#00E5A0' },
              { label: 'Project', value: sonar.project, color: 'var(--text-muted)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 12, color: row.color, fontWeight: 600, fontFamily: 'var(--fm)' }}>{String(row.value ?? '—')}</span>
              </div>
            ))}
          </div>
          {sonar.dashboard_url && (
            <a href={sonar.dashboard_url} target="_blank" rel="noreferrer"
              style={{ display: 'block', marginTop: 14, fontSize: 11, color: '#3B82F6', textDecoration: 'none' }}>
              → View SonarCloud Dashboard ↗
            </a>
          )}
        </div>
      </div>

      {/* Tiers */}
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
