'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { authApi } from '@/lib/api'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/repos': 'Repositories',
  '/findings': 'Security Findings',
  '/team': 'Team',
  '/settings': 'Settings',
  '/billing': 'Billing & Plans',
}

export function TopBar() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] || 'Dashboard'
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {})
  }, [])

  const initials = user?.login
    ? user.login.slice(0, 2).toUpperCase()
    : user?.sub
      ? user.sub.slice(0, 2).toUpperCase()
      : 'UU'

  const displayName = user?.name || user?.login || user?.sub || user?.email?.split('@')[0] || 'User'
  const displayRole = user?.role || 'owner'

  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', flexShrink: 0,
    }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', margin: 0 }}>
        {title}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* GCP badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px rgba(0,229,160,0.6)' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--fm)', fontWeight: 500 }}>agent-sec-496307</span>
        </div>
        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,229,160,0.15)', border: '1px solid rgba(0,229,160,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
              {initials}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.2 }}>{displayName}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{displayRole}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
