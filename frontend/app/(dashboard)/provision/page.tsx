'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { provisionApi } from '@/lib/api'

function StatusBadge({ status }: { status: string }) {
  const compliant = status === 'COMPLIANT'
  const color = compliant ? '#00E5A0' : '#FFB340'
  const label = compliant ? 'Compliant' : 'Needs attention'
  return (
    <span style={{ padding: '4px 10px', borderRadius: 5, background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
      {label}
    </span>
  )
}

export default function ProvisionPage() {
  const [findings, setFindings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    provisionApi.scan()
      .then(data => setFindings(Array.isArray(data?.findings) ? data.findings : []))
      .catch(() => setError('Failed to load provisioning scan'))
      .finally(() => setLoading(false))
  }, [])

  const totalRepos     = findings.length
  const compliant      = findings.filter(f => f.status === 'COMPLIANT').length
  const needsAttention = totalRepos - compliant

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', margin: 0 }}>Provisioning</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Security baseline across all connected repos</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Repos',     value: totalRepos,     color: 'var(--accent)' },
          { label: 'Compliant',       value: compliant,      color: '#00E5A0' },
          { label: 'Need Attention',  value: needsAttention, color: '#FFB340' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--fm)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Repository Compliance</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalRepos} repos</span>
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Scanning repositories…</div>
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#FF4757', fontSize: 13 }}>{error}</div>
        ) : findings.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No repos scanned yet — connect a repo to run a compliance scan
          </div>
        ) : findings.map((f, i) => (
          <div key={f.repo ?? i}
            style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.status === 'COMPLIANT' ? '#00E5A0' : '#FFB340', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{f.repo}</span>
                {f.private && <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>private</span>}
              </div>
              {f.missing && f.missing.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.missing.map((m: string) => (
                    <span key={m} style={{ fontSize: 11, color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#FF4757' }}>✕</span> No {m}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <StatusBadge status={f.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
