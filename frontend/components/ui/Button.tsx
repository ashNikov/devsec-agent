import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const styles = {
  primary: {
    background: 'var(--accent)', color: 'var(--bg)',
    border: '1px solid transparent', fontWeight: 700,
  },
  secondary: {
    background: 'var(--elevated)', color: 'var(--text-sec)',
    border: '1px solid var(--border)', fontWeight: 500,
  },
  ghost: {
    background: 'transparent', color: 'var(--text-sec)',
    border: '1px solid transparent', fontWeight: 500,
  },
  danger: {
    background: 'var(--red-dim)', color: 'var(--red)',
    border: '1px solid rgba(255,71,87,0.25)', fontWeight: 600,
  },
}

const sizes = {
  sm: { padding: '5px 12px', fontSize: 11, borderRadius: 6 },
  md: { padding: '8px 16px', fontSize: 13, borderRadius: 7 },
  lg: { padding: '11px 22px', fontSize: 14, borderRadius: 8 },
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        fontFamily: 'var(--fb)',
        ...styles[variant],
        ...sizes[size],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.7s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
        </svg>
      ) : icon}
      {children}
    </button>
  )
}
