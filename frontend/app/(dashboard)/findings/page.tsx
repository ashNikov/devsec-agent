'use client'

import { useEffect, useState } from 'react'
import { findingsApi } from '@/lib/api'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badge'

const MOCK_FINDINGS = [
  { id: 1, title: 'AWS Access Key exposed in .env', file: 'ashflix-api/.env', line: 12, repo: 'ashflix-api', tool: 'Gitleaks', severity: 'critical', status: 'open', age: '2m ago' },
  { id: 2, title: 'Paystack Secret Key in plaintext', file: 'ashflix-api/.env', line: 18, repo: 'ashflix-api', tool: 'Gitleaks', severity: 'critical', status: 'open', age: '2m ago' },
  { id: 3, title: 'Supabase Service Key exposed', file: 'ashflix-api/.env', line: 23, repo: 'ashflix-api', tool: 'Gitleaks', severity: 'critical', status: 'open', age: '2m ago' },
  { id: 4, title: 'CORS misconfiguration — all origins allowed', file: 'backend/main.py', line: 45, repo: 'price-transparency', tool: 'GitHub Scanner', severity: 'high', status: 'open', age: '15m ago' },
  { id: 5, title: 'nginx:1.19 — CVE-2021-23017 (Remote DoS)', file: 'Dockerfile', line: 3, repo: 'ashflix-api', tool: 'Trivy', severity: 'high', status: 'open', age: '1h ago' },
  { id: 6, title: 'GCP bucket publicly readable', file: 'terraform/storage.tf', line: 8, repo: 'devsec-agent', tool: 'GCP Scanner', severity: 'high', status: 'open', age: '2h ago' },
  { id: 7, title: 'JWT secret too short (< 32 chars)', file: 'auth/jwt_handler.py', line: 7, repo: 'devsec-agent', tool: 'Gitleaks', severity: 'medium', status: 'open', age: '3h ago' },
  { id: 8, title: 'Debug mode enabled in production', file: 'config.py', line: 2, repo: 'footyiq-backend', tool: 'GitHub Scanner', severity: 'medium', status: 'open', age: '1h ago' },
  { id: 9, title: 'Hardcoded DB password in test file', file: 'tests/conftest.py', line: 15, repo: 'footyiq-backend', tool: 'Gitleaks', severity: 'medium', status: 'open', age: '1h ago' },
  { id: 10, title: 'Outdated python-jose dependency', file: 'requirements.txt', line: 14, repo: 'sabitech-app', tool: 'Trivy', severity: 'low', status: 'resolved', age: '5h ago' },
]

const SEVERITY_OPTS = ['all', 'critical', 'high', 'medium', 'low', 'info']
const STATUS_OPTS = ['all', 'open', 'resolved']

export default function FindingsPage() {
  const [findings, setFindings] = useState(MOCK_FINDINGS)
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [resolving, setResolving] = useState<number | null>(null)

  useEffect(() => {
    findingsApi.list().then(f => { if (f?.length) setFindings(f) }).catch(() => {})
  }, [])

  const filtered = findings.filter(f =>
    (severity === 'all' || f.severity === severity) &&
    (status === 'all' || f.status === status)
  )

  const handleResolve = async (id: number) => {
    setResolving(id)
    try {
      await findingsApi.resolve(id)
      setFindings(fs => fs.map(f => f.id === id ? { ...f, status: 'resolved' } : f))
    } catch {
      setFindings(fs => fs.map(f => f.id === id ? { ...f, status: 'resolved' } : f))
    } finally {
      setResolving(null)
    }
  }

  const filterBtn = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: active ? 'rgba(0,229,160,0.1)' : 'var(--elevated)',
    border: `1px solid ${active ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-sec)',
    transition: 'all 0.15s',
  })

  const counts = {
    critical: findings.filter(f => f.severity === 'critical' && f.status === 'open').length,
    high: findings.filter(f => f.severity === 'high' && f.status === 'open').length,
    open: findings.filter(f => f.status === 'open').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Critical', count: counts.critical, color: '#FF4757' },
          { label: 'High', count: counts.high, color: '#FFB340' },
          { label: 'Open', count: counts.open, color: 'var(--text-sec)' },
        ].map(p => (
          <div key={p.label} style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: p.color, fontFamily: 'var(--fh)' }}>{p.count}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 2 }}>Severity:</span>
          {SEVERITY_OPTS.map(s => (
            <button key={s} onClick={() => setSeverity(s)} style={filterBtn(severity === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 2 }}>Status:</span>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatus(s)} style={filterBtn(status === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 130px 90px 80px 80px 100px', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 16 }}>
          {['', 'FINDING', 'REPOSITORY', 'TOOL', 'SEVERITY', 'STATUS', 'ACTION'].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No findings match your filters
          </div>
        ) : filtered.map((f, i) => (
          <div
            key={f.id}
            style={{ display: 'grid', gridTemplateColumns: '24px 1fr 130px 90px 80px 80px 100px', padding: '13px 20px', gap: 16, alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: f.status === 'resolved' ? 0.55 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.status === 'open' ? ({ critical: '#FF4757', high: '#FFB340', medium: '#3B82F6', low: '#00E5A0' }[f.severity] || '#8B95A8') : '#3D4557' }} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fm)', marginTop: 2 }}>{f.file}:{f.line}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{f.age}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{f.repo}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.tool}</div>
            <SeverityBadge severity={f.severity as any} />
            <StatusBadge status={f.status as any} />
            {f.status === 'open' ? (
              <button
                onClick={() => handleResolve(f.id)}
                disabled={resolving === f.id}
                style={{ padding: '5px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-sec)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
              >
                {resolving === f.id ? '…' : 'Resolve'}
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resolved</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
