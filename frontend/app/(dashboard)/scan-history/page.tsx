'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { request } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const trendColor = (t: string) =>
  t === 'IMPROVING' ? '#00E5A0' : t === 'WORSENING' ? '#FF4757' : '#FFB340'

const trendIcon = (t: string) =>
  t === 'IMPROVING' ? '↑' : t === 'WORSENING' ? '↓' : '→'

export default function ScanHistoryPage() {
  const [scans,   setScans]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    request<any[]>('/history/scans?limit=50')
      .then(data => setScans(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load scan history'))
      .finally(() => setLoading(false))
  }, [])

  const totalScans    = scans.length
  const totalSecrets  = scans.reduce((a, s) => a + (s.secrets_found || 0), 0)
  const totalCritical = scans.reduce((a, s) => a + (s.critical_count || 0), 0)
  const withBrain     = scans.filter(s => s.brain_winner).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', margin: 0 }}>Scan History</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Agent memory — every scan logged automatically</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Scans',     value: totalScans,    color: 'var(--accent)' },
          { label: 'Secrets Found',   value: totalSecrets,  color: '#FF4757' },
          { label: 'Critical Issues', value: totalCritical, color: '#FFB340' },
          { label: 'Brain Analyses',  value: withBrain,     color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--fm)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recent Scans</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalScans} records</span>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 80px 80px 120px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
          {['REPO', 'SCANNED AT', 'SECRETS', 'VULNS', 'CRITICAL', 'BRAIN WINNER', 'STATUS'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading scan history…</div>
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#FF4757', fontSize: 13 }}>{error}</div>
        ) : scans.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No scans yet — run a scan from the dashboard to populate history
          </div>
        ) : scans.map((scan, i) => (
          <div key={scan.id ?? i}
            style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 80px 80px 120px 100px', padding: '13px 20px', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

            {/* Repo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--fm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.repo}</span>
            </div>

            {/* Scanned at */}
            <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>
              {new Date(scan.scanned_at).toLocaleString()}
            </div>

            {/* Secrets */}
            <div style={{ fontSize: 12, color: scan.secrets_found > 0 ? '#FF4757' : 'var(--text-muted)', fontWeight: scan.secrets_found > 0 ? 600 : 400 }}>
              {scan.secrets_found ?? 0}
            </div>

            {/* Vulns */}
            <div style={{ fontSize: 12, color: scan.vulns_found > 0 ? '#FFB340' : 'var(--text-muted)' }}>
              {scan.vulns_found ?? 0}
            </div>

            {/* Critical */}
            <div style={{ fontSize: 12, color: scan.critical_count > 0 ? '#FF4757' : 'var(--text-muted)', fontWeight: scan.critical_count > 0 ? 700 : 400 }}>
              {scan.critical_count ?? 0}
            </div>

            {/* Brain winner */}
            <div style={{ fontSize: 11 }}>
              {scan.brain_winner ? (
                <span style={{ padding: '3px 8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 5, color: '#3B82F6', fontWeight: 600 }}>
                  {scan.brain_winner}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>

            {/* Status */}
            <div>
              <span style={{ padding: '3px 8px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 5, fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
                {scan.status || 'complete'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
