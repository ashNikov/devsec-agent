'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { provisionApi, getTokenClaims } from '@/lib/api'

const ACTION_MAP: Record<string, string> = {
  'CI/CD pipeline':     'add_cicd',
  '.gitignore':         'add_gitignore',
  'Dockerfile':         'add_dockerfile',
  'branch protection':  'enforce_branch_protection',
}

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
  const [busy,   setBusy]   = useState<Record<string, boolean>>({})
  const [errs,   setErrs]   = useState<Record<string, string>>({})

  const claims = typeof window !== 'undefined' ? getTokenClaims() : null
  const isOwner = claims?.role === 'owner'

  const loadScan = () =>
    provisionApi.scan()
      .then(data => setFindings(Array.isArray(data?.findings) ? data.findings : []))
      .catch(() => setError('Failed to load provisioning scan'))
      .finally(() => setLoading(false))

  useEffect(() => { loadScan() }, [])

  async function handleFix(repo: string, missingLabel: string, defaultBranch: string = 'main') {
    const action = ACTION_MAP[missingLabel]
    if (!action) return
    const key = `${repo}::${missingLabel}`
    setErrs(e => ({ ...e, [key]: '' }))
    setBusy(b => ({ ...b, [key]: true }))
    try {
      const req = await provisionApi.requestFix(repo, action, defaultBranch)
      const approvalId = req?.approval_id
      if (!approvalId) throw new Error('No approval id')
      await provisionApi.approve(approvalId)
      const res = await provisionApi.applyFix(approvalId, repo, action, defaultBranch)
      if (res?.status === 'error') throw new Error(res?.error || 'Fix failed')
      await loadScan()
    } catch (e: any) {
      setErrs(er => ({ ...er, [key]: e?.message || 'Failed' }))
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

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
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {f.missing.map((m: string) => {
                    const fixable = !!ACTION_MAP[m]
                    const key = `${f.repo}::${m}`
                    const isBusy = !!busy[key]
                    const errMsg = errs[key]
                    return (
                      <span key={m} style={{ fontSize: 11, color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px' }}>
                        <span style={{ color: '#FF4757' }}>✕</span> No {m}
                        {fixable && isOwner && (
                          <button
                            onClick={() => handleFix(f.repo, m, f.default_branch)}
                            disabled={isBusy}
                            style={{ marginLeft: 4, fontSize: 10, fontWeight: 600, color: isBusy ? 'var(--text-muted)' : '#00E5A0', background: 'transparent', border: `1px solid ${isBusy ? 'var(--border)' : '#00E5A030'}`, borderRadius: 4, padding: '1px 7px', cursor: isBusy ? 'default' : 'pointer' }}>
                            {isBusy ? 'Fixing…' : 'Fix'}
                          </button>
                        )}
                        {errMsg && <span style={{ color: '#FF4757', fontSize: 10 }}>{errMsg}</span>}
                      </span>
                    )
                  })}
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
