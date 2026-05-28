'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authApi } from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Dashboard',    icon: '▦' },
  { href: '/repos',     label: 'Repositories', icon: '⎇' },
  { href: '/findings',  label: 'Findings',     icon: '◎' },
  { href: '/team',      label: 'Team',         icon: '⊙' },
  { href: '/billing',   label: 'Billing',      icon: '▣' },
  { href: '/settings',  label: 'Settings',     icon: '⚙' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user,       setUser]       = useState<any>(null)
  const [collapsed,  setCollapsed]  = useState(false)
  const [sched,      setSched]      = useState({ pct: 0, label: '—' })

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    const total = 48 * 60
    let remaining = total
    const id = setInterval(() => {
      remaining = remaining > 0 ? remaining - 1 : total
      const m = Math.floor(remaining / 60)
      const pct = ((total - remaining) / total) * 100
      setSched({ pct, label: `${m}m` })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('agentsec_token')
    router.push('/login')
  }

  const initials = user?.login
    ? user.login.slice(0, 2).toUpperCase()
    : user?.sub
      ? user.sub.slice(0, 2).toUpperCase()
      : '??'

  const w = collapsed ? 56 : 220

  return (
    <div style={{ width: w, minWidth: w, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', transition: 'width 0.2s ease, min-width 0.2s ease', overflow: 'hidden' }}>

      {/* Logo + hamburger */}
      <div style={{ padding: collapsed ? '16px 0' : '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: 60 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', lineHeight: 1 }}>
                Agent<span style={{ color: 'var(--accent)' }}>Sec</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.3px' }}>BETA · Phase 3</div>
            </div>
          </div>
        )}

        {/* Hamburger */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: collapsed ? 16 : 18,
              height: 2,
              background: 'var(--text-muted)',
              borderRadius: 2,
              transition: 'all 0.2s',
              transform: collapsed && i === 1 ? 'scaleX(0.6)' : 'scaleX(1)',
            }} />
          ))}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '12px 6px' : '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={collapsed ? item.label : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, padding: collapsed ? '9px 0' : '8px 10px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: active ? 'rgba(0,229,160,0.1)' : 'transparent', border: `1px solid ${active ? 'rgba(0,229,160,0.2)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 15, color: active ? 'var(--accent)' : 'var(--text-muted)', width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ fontSize: 13, color: active ? 'var(--accent)' : 'var(--text-sec)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{item.label}</span>}
              </div>
            </Link>
          )
        })}

        {/* Admin — owner only */}
        {user?.role === 'owner' && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <Link href="/admin" style={{ textDecoration: 'none' }} title={collapsed ? 'Admin' : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, padding: collapsed ? '9px 0' : '8px 10px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: pathname === '/admin' ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${pathname === '/admin' ? 'rgba(59,130,246,0.25)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (pathname !== '/admin') e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (pathname !== '/admin') e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 15, color: pathname === '/admin' ? '#3B82F6' : 'var(--text-muted)', width: 18, textAlign: 'center', flexShrink: 0 }}>⌘</span>
                {!collapsed && <span style={{ fontSize: 13, color: pathname === '/admin' ? '#3B82F6' : 'var(--text-sec)', fontWeight: pathname === '/admin' ? 600 : 400 }}>Admin</span>}
              </div>
            </Link>
          </>
        )}
      </nav>

      {/* Auto-scan countdown */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Next auto-scan</span>
            <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--fm)' }}>{sched.label}</span>
          </div>
          <div style={{ height: 3, background: 'var(--elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sched.pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 1s linear' }} />
          </div>
        </div>
      )}

      {/* User + logout */}
      <div style={{ padding: collapsed ? '10px 0' : '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,229,160,0.15)', border: '1px solid rgba(0,229,160,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            {initials}
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, lineHeight: 1.2, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.sub || '…'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role || 'member'}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={handleLogout} title="Logout"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 4 }}>
            →
          </button>
        )}
      </div>
    </div>
  )
}
