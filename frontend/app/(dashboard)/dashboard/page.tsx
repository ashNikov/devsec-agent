'use client'

import { useEffect, useState } from 'react'
import { dashApi } from '@/lib/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const SCAN_ACTIVITY = [
  { day: 'Mon', scans: 12, findings: 5 },
  { day: 'Tue', scans: 19, findings: 11 },
  { day: 'Wed', scans: 8, findings: 3 },
  { day: 'Thu', scans: 24, findings: 18 },
  { day: 'Fri', scans: 31, findings: 22 },
  { day: 'Sat', scans: 14, findings: 6 },
  { day: 'Sun', scans: 21, findings: 9 },
]

const SEVERITY_DATA = [
  { severity: 'Critical', count: 3, fill: '#FF4757' },
  { severity: 'High', count: 7, fill: '#FFB340' },
  { severity: 'Medium', count: 12, fill: '#3B82F6' },
  { severity: 'Low', count: 18, fill: '#00E5A0' },
  { severity: 'Info', count: 5, fill: '#8B95A8' },
]

const RECENT_SCANS = [
  { repo: 'ashflix-api', tool: 'Gitleaks', findings: 3, severity: 'critical', time: '2m ago', status: 'done' },
  { repo: 'devsec-agent', tool: 'Trivy', findings: 0, severity: 'clean', time: '8m ago', status: 'done' },
  { repo: 'price-transparency', tool: 'GitHub Scanner', findings: 1, severity: 'high', time: '15m ago', status: 'done' },
  { repo: 'footyiq-backend', tool: 'GCP Scanner', findings: 2, severity: 'medium', time: '1h ago', status: 'done' },
  { repo: 'agentsec-frontend', tool: 'Gitleaks', findings: 0, severity: 'clean', time: '2h ago', status: 'done' },
]

const TOOLS = [
  { name: 'Gitleaks', version: 'v8.18.2', scans: 89, status: 'active' },
  { name: 'Trivy', version: 'v0.50.1', scans: 58, status: 'active' },
  { name: 'GitHub Scanner', version: 'v2.1', scans: 147, status: 'active' },
  { name: 'GCP Scanner', version: 'v1.3', scans: 34, status: 'active' },
]

const severityColor: Record<string, string> = {
  critical: '#FF4757', high: '#FFB340', medium: '#3B82F6', low: '#00E5A0', clean: '#00E5A0',
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent || 'var(--text)', fontFamily: 'var(--fh)', lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'var(--text-sec)', fontSize: 12, marginTop: 8 }}>{sub}</div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 12, padding: '8px 12px',
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ repos: 8, findings: 45, scans: 328, resolved: 30 })

  useEffect(() => {
    dashApi.getStats().then(setStats).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="REPOS MONITORED" value={stats.repos} sub="4 tools active" />
        <StatCard label="OPEN FINDINGS" value={stats.findings} sub="3 critical · 7 high" accent="#FF4757" />
        <StatCard label="TOTAL SCANS" value={stats.scans} sub="Last 30 days" />
        <StatCard label="RESOLVED" value={stats.resolved} sub={`${Math.round((stats.resolved / (stats.findings + stats.resolved)) * 100)}% resolution rate`} accent="#00E5A0" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Scan activity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Scan Activity</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last 7 days</div>
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
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={SCAN_ACTIVITY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              <Area type="monotone" dataKey="scans" stroke="#00E5A0" strokeWidth={2} fill="url(#scanGrad)" dot={false} />
              <Area type="monotone" dataKey="findings" stroke="#FF4757" strokeWidth={2} fill="url(#findGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Findings by Severity</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Current open findings</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={SEVERITY_DATA} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="severity" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {SEVERITY_DATA.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Recent scans */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Recent Scans</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECENT_SCANS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < RECENT_SCANS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: severityColor[s.severity] || '#8B95A8', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{s.repo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.tool}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 12, color: s.findings > 0 ? severityColor[s.severity] : 'var(--text-sec)', fontWeight: 500 }}>
                    {s.findings > 0 ? `${s.findings} issue${s.findings > 1 ? 's' : ''}` : 'Clean'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{s.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tool status */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Tool Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TOOLS.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fm)', marginTop: 1 }}>{t.version} · {t.scans} scans</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E5A0', boxShadow: '0 0 6px rgba(0,229,160,0.6)' }} />
                  <span style={{ fontSize: 10, color: '#00E5A0', fontWeight: 600 }}>ACTIVE</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
