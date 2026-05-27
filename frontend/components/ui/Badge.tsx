import React from 'react'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type Status = 'open' | 'resolved' | 'ignored' | 'active' | 'pending' | 'connected' | 'disconnected'

const SEV_STYLES: Record<Severity, { bg: string; color: string }> = {
  critical: { bg: 'rgba(255,23,68,0.15)', color: '#FF1744' },
  high:     { bg: 'rgba(255,71,87,0.15)', color: '#FF4757' },
  medium:   { bg: 'rgba(255,179,64,0.12)', color: '#FFB340' },
  low:      { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  info:     { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV_STYLES[severity] || SEV_STYLES.info
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.6px', textTransform: 'uppercase',
      fontFamily: 'var(--fm)',
      display: 'inline-block',
    }}>
      {severity}
    </span>
  )
}

export function StatusBadge({ status }: { status: Status | string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    open:         { bg: 'var(--red-dim)',    color: 'var(--red)',    label: 'Open' },
    resolved:     { bg: 'var(--accent-dim)', color: 'var(--accent)', label: 'Resolved' },
    ignored:      { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', label: 'Ignored' },
    active:       { bg: 'var(--accent-dim)', color: 'var(--accent)', label: 'Active' },
    pending:      { bg: 'var(--yellow-dim)', color: 'var(--yellow)', label: 'Pending' },
    connected:    { bg: 'var(--accent-dim)', color: 'var(--accent)', label: 'Connected' },
    disconnected: { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', label: 'Disconnected' },
  }
  const s = styles[status] || { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600,
      display: 'inline-block',
    }}>
      {s.label}
    </span>
  )
}

export function StatusDot({ status }: { status: 'clean' | 'warning' | 'critical' | 'scanning' | 'active' | string }) {
  const colors: Record<string, string> = {
    clean:    'var(--accent)',
    active:   'var(--accent)',
    warning:  'var(--yellow)',
    critical: 'var(--red)',
    scanning: 'var(--blue)',
  }
  const c = colors[status] || 'var(--text-muted)'
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      background: c, display: 'inline-block', flexShrink: 0,
      boxShadow: `0 0 5px ${c}88`,
    }} />
  )
}
