'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { dashApi } from '@/lib/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const SEVERITY_DATA = [
  { severity: 'Critical', count: 0, fill: '#FF4757' },
  { severity: 'High',     count: 0, fill: '#FFB340' },
  { severity: 'Medium',   count: 0, fill: '#3B82F6' },
  { severity: 'Low',      count: 0, fill: '#00E5A0' },
  { severity: 'Info',     count: 0, fill: '#8B95A8' },
]

const tooltipStyle = {
  background: 'var(--elevated)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '8px 12px',
}

function StatCard({ label, value, sub, accent }: { label: string; value: any; sub: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent || 'var(--text)', fontFamily: 'var(--fh)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ color: 'var(--text-sec)', fontSize: 12, marginTop: 8 }}>{sub}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [health,   setHealth]   = useState<any>(null)
  const [summary,  setSummary]  = useState<any>(null)
  const [org,      setOrg]      = useState<any>(null)
  const [history,  setHistory]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [brainResult, setBrainResult] = useState<any>(null)
  const [brainLoading, setBrainLoading] = useState(false)


  const runBrainAnalysis = async () => {
    setBrainLoading(true)
    try {
      const token = localStorage.getItem('agentsec_token')
      const res = await fetch('http://localhost:8000/agent/brain', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      setBrainResult(data)
    } catch (e) { console.error('Brain failed', e) }
    finally { setBrainLoading(false) }
  }

  useEffect(() => {
    Promise.allSettled([
      dashApi.health().then(setHealth),
      dashApi.summary().then(setSummary),
      dashApi.orgMe().then(setOrg),
      dashApi.history().then(setHistory),
    ]).finally(() => setLoading(false))
  }, [])

  // Tool statuses from health
  const tools = health?.tools || {}
  const toolList = [
    { name: 'Gitleaks',       key: 'gitleaks',   version: 'v8.18.2' },
    { name: 'Trivy',          key: 'trivy',      version: 'v0.50.1' },
    { name: 'GitHub Scanner', key: 'github',     version: 'v2.1'    },
    { name: 'GCP Scanner',    key: 'gcp',        version: 'v1.3'    },
    { name: 'SonarCloud',     key: 'sonarcloud', version: 'SAST'    },
  ]

  // SonarCloud status comes from health.sonarcloud.status
  const sonarStatus = health?.sonarcloud?.status || 'checking'
  const toolsWithSonar = { ...tools, sonarcloud: sonarStatus }

  const activeTools = Object.values(toolsWithSonar).filter((v: any) => v === 'active').length

  // Stat card values from real data — use history length for repo count
  const repoCount = history.length > 0
    ? [...new Set(history.map((s: any) => s.repo))].length
    : org?.repo_count ?? '—'
  const criticalCount = summary?.critical_findings ?? '—'
  const vulnCount    = summary?.vulnerabilities ?? '—'
  const secretCount  = summary?.secrets ?? '—'

  // Build chart data from scan history
  const chartData = history.slice(0, 7).reverse().map((s: any, i: number) => ({
    day: new Date(s.scanned_at).toLocaleDateString('en', { weekday: 'short' }),
    scans: 1,
    findings: (s.secrets_found || 0) + (s.vulns_found || 0),
  }))

  // Severity bar from summary
  const severityData = [
    { severity: 'Critical', count: summary?.critical_findings ?? 0, fill: '#FF4757' },
    { severity: 'High',     count: summary?.vulnerabilities   ?? 0, fill: '#FFB340' },
    { severity: 'Secrets',  count: summary?.secrets           ?? 0, fill: '#FFB340' },
    { severity: 'Sonar',    count: summary?.sonar_issues      ?? 0, fill: '#3B82F6' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="REPOS MONITORED"  value={repoCount}     sub={`${activeTools} tools active`} />
        <StatCard label="CRITICAL FINDINGS" value={criticalCount} sub={`${secretCount ?? 0} secrets · ${vulnCount ?? 0} vulns`} accent="#FF4757" />
        <StatCard label="VULNERABILITIES"  value={vulnCount}     sub="from Trivy scan" />
        <StatCard label="SECRETS DETECTED" value={secretCount}   sub="from Gitleaks" accent="#FFB340" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Scan activity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Scan Activity</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last {history.length} scans</div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ label: 'Scans', color: 'var(--accent)' }, { label: 'Findings', color: '#FF4757' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? 'Loading scan history…' : 'No scan history yet — trigger a scan to start'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="findGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4757" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#FF4757" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />
                <Area type="monotone" dataKey="scans"    stroke="#00E5A0" strokeWidth={2} fill="url(#scanGrad)" dot={false} />
                <Area type="monotone" dataKey="findings" stroke="#FF4757" strokeWidth={2} fill="url(#findGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Findings by Type</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Current scan summary</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={severityData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="severity" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#00E5A0" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Recent scans */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Recent Scans</div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? 'Loading…' : 'No scans yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.slice(0, 6).map((s: any, i: number) => {
                const findings = (s.secrets_found || 0) + (s.vulns_found || 0)
                const ago = new Date(s.scanned_at)
                const diff = Math.round((Date.now() - ago.getTime()) / 60000)
                const timeStr = diff < 60 ? `${diff}m ago` : `${Math.round(diff/60)}h ago`
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: findings > 0 ? '#FF4757' : '#00E5A0', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{s.repo}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {s.secrets_found || 0} secrets · {s.vulns_found || 0} vulns
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 12, color: findings > 0 ? '#FF4757' : 'var(--text-sec)', fontWeight: 500 }}>
                        {findings > 0 ? `${findings} issue${findings > 1 ? 's' : ''}` : 'Clean'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeStr}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tool status */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Tool Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {toolList.map((t, i) => {
              const status = toolsWithSonar[t.key] || 'checking'
              const color  = status === 'active' ? '#00E5A0' : status === 'error' ? '#FF4757' : '#FFB340'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fm)', marginTop: 1 }}>{t.version}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: status === 'active' ? '0 0 6px rgba(0,229,160,0.6)' : 'none' }} />
                    <span style={{ fontSize: 10, color, fontWeight: 600 }}>{status.toUpperCase()}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {health?.model && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>AI MODEL</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{health.model}</div>
            </div>
          )}
        </div>
      </div>

      {/* BRAIN */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: '20px 24px', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>🧠 Multi-Agent Brain Analysis</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Claude Haiku + Sonnet + Python Judge</div>
          </div>
          <button onClick={runBrainAnalysis} disabled={brainLoading} style={{ padding: '8px 18px', background: brainLoading ? 'var(--elevated)' : 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, color: '#3B82F6', fontSize: 13, fontWeight: 600, cursor: brainLoading ? 'wait' : 'pointer' }}>
            {brainLoading ? '🔄 Analyzing...' : '▶ Run Analysis'}
          </button>
        </div>
        {brainResult && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 6, fontSize: 11, color: '#00E5A0' }}>Winner: {brainResult.winner?.split('-').slice(1,3).join(' ')}</div>
              <div style={{ padding: '6px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, fontSize: 11, color: '#3B82F6' }}>Score: {brainResult.winner_score}</div>
              <div style={{ padding: '6px 14px', background: 'rgba(255,179,64,0.08)', border: '1px solid rgba(255,179,64,0.2)', borderRadius: 6, fontSize: 11, color: '#FFB340' }}>Tokens: {brainResult.total_tokens}</div>
              {brainResult.brain_b_skipped && <div style={{ padding: '6px 14px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 6, fontSize: 11, color: '#00E5A0' }}>✓ Brain B skipped</div>}
            </div>
            <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 16, fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', fontFamily: 'var(--fm)' }}>
              {brainResult.analysis}
            </div>
          </div>
        )}
        {!brainResult && !brainLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
            Click "Run Analysis" to trigger the multi-agent brain
          </div>
        )}
      </div>
    </div>
  )
}
