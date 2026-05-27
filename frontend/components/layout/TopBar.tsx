'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/repos': 'Repositories',
  '/findings': 'Security Findings',
  '/team': 'Team',
  '/settings': 'Settings',
  '/billing': 'Billing & Plans',
}

interface TopBarProps {
  userInitials?: string
  onScanAll?: () => void
  scanning?: boolean
}

export function TopBar({ userInitials = 'UU', onScanAll, scanning }: TopBarProps) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] || 'AgentSec'

  return (
    <header style={{
      height: 54, flexShrink: 0,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 26px',
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--fh)' }}>
        {title}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Project badge */}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--elevated)', padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border)', fontFamily: 'var(--fm)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          agent-sec-496307
        </div>
        {/* Scan all */}
        {onScanAll && (
          <button onClick={onScanAll} disabled={scanning} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: scanning ? 'var(--accent-dim)' : 'var(--elevated)', border: `1px solid ${scanning ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 6, color: scanning ? 'var(--accent)' : 'var(--text-sec)', fontSize: 11, fontWeight: 500, cursor: scanning ? 'not-allowed' : 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            {scanning ? 'Scanning…' : 'Scan All'}
          </button>
        )}
        {/* Avatar */}
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 10, fontWeight: 700 }}>
          {userInitials}
        </div>
      </div>
    </header>
  )
}
