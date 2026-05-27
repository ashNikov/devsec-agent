'use client'

import { useEffect, useState } from 'react'
import { findingsApi } from '@/lib/api'

const SEVERITY_OPTS = ['all', 'critical', 'high', 'medium', 'low']
const STATUS_OPTS   = ['all', 'open', 'resolved']

const sevColor: Record<string, string> = {
  critical: '#FF4757', high: '#FFB340', medium: '#3B82F6', low: '#00E5A0',
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = sevColor[severity] || '#8B95A8'
  return (
    <div style={{ padding: '3px 8px', borderRadius: 4, background: `${color}15`, border: `1px solid ${color}40`, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', display: 'inline-block' }}>
      {severity.toUpperCase()}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'open' ? '#FF4757' : '#00E5A0'
  return (
    <div style={{ padding: '3px 8px', borderRadius: 4, background: `${color}10`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 600, display: 'inline-block' }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  )
}

export default function FindingsPage() {
  const [findings,  setFindings]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [severity,  setSeverity]  = useState('all')
  const [status,    setStatus]    = useState('all')
  const [resolved,  setResolved]  = useState<Set<string>>(new Set())

  useEffect(() => {
    findingsApi.list()
      .then(data => setFindings(Array.isArray(data) ? data : []))
      .catch(() => setFindings([]))
      .finally(() => setLoading(false))
  }, [])

  const handleResolve = (id: string) => {
    setResolved(s => new Set([...s, id]))
  }

  const withStatus = findings.map(f => ({
    ...f,
    status: resolved.has(f.id) ? 'resolved' : f.status || 'open',
  }))

  const filtered = withStatus.filter(f =>
    (severity === 'all' || f.severity === severity) &&
    (status   === 'all' || f.status   === status)
  )

  const counts = {
    critical: withStatus.filter(f => f.severity === 'critical' && f.status !== 'resolved').length,
    high:     withStatus.filter(f => f.severity === 'high'     && f.status !== 'resolved').length,
    open:     withStatus.filter(f => f.status !== 'resolved').length,
  }

  const filterBtn = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: active ? 'rgba(0,229,160,0.1)' : 'var(--elevated)',
    border: `1px solid ${active ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-sec)', transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Critical', count: counts.critical, color: '#FF4757' },
          { label: 'High',     count: counts.high,     color: '#FFB340' },
          { label: 'Open',     count: counts.open,     color: 'var(--text-sec)' },
        ].map(p => (
          <div key={p.label} style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: p.color, fontFamily: 'var(--fh)' }}>{p.count}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.label}</span>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Scanning… (first load takes ~15s)</div>}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Severity:</span>
          {SEVERITY_OPTS.map(s => (
            <button key={s} onClick={() => setSeverity(s)} style={filterBtn(severity === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Status:</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 140px 100px 80px 80px 90px', padding: '11px 20px', borderBottom: '1px solid var(--border)', gap: 16 }}>
          {['', 'FINDING', 'REPOSITORY', 'TOOL', 'SEVERITY', 'STATUS', 'ACTION'].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Running live scan — this takes up to 15 seconds on first load…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {findings.length === 0 ? 'No findings detected — your project looks clean 🎉' : 'No findings match your filters'}
          </div>
        ) : filtered.map((f, i) => (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 140px 100px 80px 80px 90px', padding: '13px 20px', gap: 16, alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: f.status === 'resolved' ? 0.5 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.status === 'resolved' ? '#3D4557' : (sevColor[f.severity] || '#8B95A8') }} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fm)', marginTop: 2 }}>
                {f.file}{f.line ? `:${f.line}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--fm)' }}>{f.repo}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.tool}</div>
            <SeverityBadge severity={f.severity} />
            <StatusBadge status={f.status} />
            {f.status !== 'resolved' ? (
              <button onClick={() => handleResolve(f.id)}
                style={{ padding: '5px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-sec)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                Resolve
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
