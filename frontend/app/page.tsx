'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── ICON COMPONENTS ───────────────────────────────────────

function ShieldIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

// ── STEP CARD ─────────────────────────────────────────────

function StepCard({ num, icon, title, desc }: { num: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '28px 24px',
      position: 'relative',
      flex: '1 1 200px',
    }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--accent)', marginBottom: 16, opacity: 0.7 }}>{num}</div>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', marginBottom: 16,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.6 }}>{desc}</div>
    </div>
  )
}

// ── PRICING CARD ──────────────────────────────────────────

function PricingCard({
  name, price, desc, features, cta, ctaHref, highlight
}: {
  name: string; price: string; desc: string; features: string[];
  cta: string; ctaHref: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? 'rgba(0,229,160,0.05)' : 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: highlight ? '1px solid rgba(0,229,160,0.3)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '36px 32px',
      flex: '1 1 280px',
      maxWidth: 380,
      position: 'relative',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 700,
          padding: '3px 14px', borderRadius: '0 0 8px 8px', fontFamily: 'var(--fm)',
          letterSpacing: '0.05em',
        }}>
          MOST POPULAR
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--accent)' : 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--fm)' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--fh)', lineHeight: 1 }}>{price}</span>
        {price !== 'Free' && <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>/mo</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 28, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ marginTop: 1, flexShrink: 0 }}><CheckIcon /></div>
            <span style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>
      <Link href={ctaHref} style={{
        display: 'block', textAlign: 'center', padding: '12px 0',
        background: highlight ? 'var(--accent)' : 'transparent',
        color: highlight ? 'var(--bg)' : 'var(--accent)',
        border: `1px solid ${highlight ? 'var(--accent)' : 'rgba(0,229,160,0.4)'}`,
        borderRadius: 10, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', fontFamily: 'var(--fb)',
        transition: 'opacity 0.15s',
      }}>
        {cta}
      </Link>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Handle GitHub OAuth callback
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const auth = params.get('auth')
    if (token && auth === 'success') {
      localStorage.setItem('agentsec_token', token)
      router.push('/dashboard')
      return
    }
    // Redirect already-logged-in users
    const stored = localStorage.getItem('agentsec_token')
    if (stored) {
      router.push('/dashboard')
    }
  }, [router])

  const scrollToHow = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--fb)' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        background: 'rgba(7,9,15,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
            <ShieldIcon size={16} color="var(--bg)" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--fh)' }}>
            Agent<span style={{ color: 'var(--accent)' }}>Sec</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--text-sec)', textDecoration: 'none', padding: '7px 14px' }}>
            Sign in
          </Link>
          <Link href="/register" style={{
            fontSize: 13, fontWeight: 600, color: 'var(--bg)',
            background: 'var(--accent)', padding: '7px 18px',
            borderRadius: 8, textDecoration: 'none',
          }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ textAlign: 'center', padding: '100px 24px 80px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: 100, padding: '5px 14px', marginBottom: 36,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--fm)', letterSpacing: '0.04em' }}>
            Autonomous DevSecOps — Phase 5
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800,
          fontFamily: 'var(--fh)',
          lineHeight: 1.1,
          color: 'var(--text)',
          marginBottom: 24,
          letterSpacing: '-0.02em',
        }}>
          Security that works<br />
          <span style={{ color: 'var(--accent)' }}>while you ship.</span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--text-sec)', lineHeight: 1.7,
          maxWidth: 560, margin: '0 auto 44px',
        }}>
          AgentSec watches your GitHub repos and GCP infrastructure 24/7 — detecting secrets, scanning for CVEs, and fixing issues autonomously. No security engineer required.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{
            padding: '14px 32px', background: 'var(--accent)',
            color: 'var(--bg)', borderRadius: 10, fontWeight: 700, fontSize: 15,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Get Started Free
          </Link>
          <button onClick={scrollToHow} style={{
            padding: '14px 28px',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, fontWeight: 600, fontSize: 15,
            cursor: 'pointer', fontFamily: 'var(--fb)',
            backdropFilter: 'blur(8px)',
          }}>
            See how it works
          </button>
        </div>

        {/* Mini terminal badge */}
        <div style={{
          marginTop: 60,
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 20px',
          fontFamily: 'var(--fm)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>$</span>
          <span style={{ color: 'var(--text-sec)' }}>agentsec scan</span>
          <span style={{ color: 'var(--accent)' }}>--all-repos</span>
          <span style={{
            marginLeft: 8, background: 'rgba(0,229,160,0.12)',
            color: 'var(--accent)', padding: '2px 8px', borderRadius: 4, fontSize: 11,
          }}>3 secrets rotated · 0 CVEs</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--accent)', letterSpacing: '0.12em', marginBottom: 14, textTransform: 'uppercase' }}>
            How It Works
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Four steps. Fully autonomous.
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StepCard
            num="01"
            icon={<ScanIcon />}
            title="Scan"
            desc="Gitleaks hunts exposed secrets. Trivy scans for CVEs. SonarCloud runs SAST. All repos, all the time — auto-discovered as you add them."
          />
          <StepCard
            num="02"
            icon={<BrainIcon />}
            title="Reason"
            desc="A multi-agent Claude brain (Haiku → Sonnet → Python Judge) prioritizes findings by severity and business impact. No alert fatigue."
          />
          <StepCard
            num="03"
            icon={<WrenchIcon />}
            title="Remediate"
            desc="Secrets get rotated in GCP Secret Manager. IAM bindings get cleaned. Dockerfiles get hardened. High-risk fixes require your approval first."
          />
          <StepCard
            num="04"
            icon={<BellIcon />}
            title="Alert"
            desc="Real-time Slack push notifications with interactive APPROVE / REJECT buttons. Know the moment something breaks — and approve the fix in one tap."
          />
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '40px 24px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 32 }}>
          {[
            { value: '6hrs', label: 'Autonomous scan interval' },
            { value: '5', label: 'Active security scanners' },
            { value: '<30s', label: 'Slack alert latency' },
            { value: '16', label: 'DB tables, production-ready' },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--accent)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--accent)', letterSpacing: '0.12em', marginBottom: 14, textTransform: 'uppercase' }}>
            Pricing
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Start free. Scale when you need it.
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          <PricingCard
            name="Free"
            price="Free"
            desc="Everything you need to get started with automated security scanning."
            features={[
              '1 connected repository',
              'Secret detection (Gitleaks)',
              'Vulnerability scanning (Trivy)',
              'Slack alerts',
              'Up to 3 team members',
              'Manual scans on demand',
            ]}
            cta="Get Started Free"
            ctaHref="/register"
          />
          <PricingCard
            name="Pro"
            price="₦15,000"
            desc="Unlimited repos, auto-remediation, and the full multi-agent brain."
            features={[
              'Unlimited repositories',
              'Auto-remediation — secrets, IAM, Dockerfiles',
              'Multi-agent brain (Haiku + Sonnet + Judge)',
              'Scan history + trend charts',
              'Approval workflow (Slack APPROVE/REJECT)',
              'Unlimited team members',
              'SonarCloud SAST integration',
              'Priority support',
            ]}
            cta="Upgrade to Pro"
            ctaHref="/register"
            highlight
          />
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: 780, margin: '0 auto', textAlign: 'center',
          background: 'rgba(0,229,160,0.05)',
          border: '1px solid rgba(0,229,160,0.2)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: 24, padding: '60px 40px',
        }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--text)', marginBottom: 14, letterSpacing: '-0.02em' }}>
            Your repos are being watched.<br />
            <span style={{ color: 'var(--accent)' }}>Make sure it's you.</span>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-sec)', marginBottom: 32, lineHeight: 1.6 }}>
            Connect your first repo in under 2 minutes. No credit card required.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{
              padding: '13px 28px', background: 'var(--accent)',
              color: 'var(--bg)', borderRadius: 10, fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
            }}>
              Get Started Free
            </Link>
            <button
              onClick={() => window.location.href = `${API_URL}/auth/login`}
              style={{
                padding: '13px 24px', background: 'rgba(255,255,255,0.06)',
                color: 'var(--text)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'var(--fb)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldIcon size={13} color="var(--bg)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--fh)' }}>
            Agent<span style={{ color: 'var(--accent)' }}>Sec</span>
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} ashTech (ashNikov Technologies)
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Sign in', href: '/login' },
            { label: 'Register', href: '/register' },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontSize: 12, color: 'var(--text-sec)', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}
