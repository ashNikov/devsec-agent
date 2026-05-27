'use client'

import { useState } from 'react'

const PLANS = [
  {
    name: 'Starter',
    badge: 'Free Beta',
    price: 0,
    period: '',
    desc: 'Perfect for solo engineers and small projects',
    features: [
      '5 repositories',
      '4 scanning tools (Gitleaks, Trivy, GitHub, GCP)',
      'Secrets & misconfiguration detection',
      '7-day finding history',
      'Email alerts',
      'Community support',
    ],
    cta: 'Current Plan',
    current: true,
    color: 'var(--accent)',
  },
  {
    name: 'Pro',
    badge: 'Launching Soon',
    price: 29,
    period: '/mo',
    desc: 'For growing teams that need more power',
    features: [
      'Unlimited repositories',
      'All 4 scanning tools',
      'Auto-remediation suggestions',
      '90-day finding history',
      'Slack & email notifications',
      'Priority support',
      'API access',
      'Custom scan schedules',
    ],
    cta: 'Get Notified',
    current: false,
    color: '#3B82F6',
  },
  {
    name: 'Team',
    badge: 'Launching Soon',
    price: 79,
    period: '/mo',
    desc: 'For security-conscious engineering teams',
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Multi-agent AI brain (Gemini + Claude)',
      'Security intelligence memory layer',
      'Advanced dashboard & reporting',
      'SSO & audit logs',
      'Dedicated Slack support',
      'SLA guarantees',
    ],
    cta: 'Get Notified',
    current: false,
    color: '#FFB340',
  },
]

export default function BillingPage() {
  const [notified, setNotified] = useState<string[]>([])

  const handleNotify = (plan: string) => {
    setNotified(n => [...n, plan])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Current plan banner */}
      <div style={{ background: 'linear-gradient(135deg, rgba(0,229,160,0.08), rgba(0,229,160,0.03))', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 12, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>CURRENT PLAN</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)' }}>Starter Beta <span style={{ fontSize: 14, color: 'var(--accent)' }}>· Free</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 4 }}>Payments powered by Paystack · NGN billing available at launch</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>GCP Free Trial</div>
          <div style={{ fontSize: 13, color: 'var(--text-sec)', fontFamily: 'var(--fm)', marginTop: 2 }}>Expires Aug 13, 2026</div>
          <div style={{ marginTop: 8, padding: '3px 10px', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', borderRadius: 5, color: 'var(--accent)', fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
            $300 CREDIT ACTIVE
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {PLANS.map(plan => (
          <div
            key={plan.name}
            style={{
              background: plan.current ? 'linear-gradient(160deg, rgba(0,229,160,0.06), rgba(0,229,160,0.02))' : 'var(--surface)',
              border: `1px solid ${plan.current ? 'rgba(0,229,160,0.3)' : 'var(--border)'}`,
              borderRadius: 14,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Badge */}
            <div style={{ padding: '2px 8px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 5, color: plan.color, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignSelf: 'flex-start', marginBottom: 14, letterSpacing: '0.3px' }}>
              {plan.badge}
            </div>

            {/* Name + price */}
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fh)', marginBottom: 4 }}>{plan.name}</div>
            <div style={{ marginBottom: 8 }}>
              {plan.price === 0 ? (
                <span style={{ fontSize: 32, fontWeight: 700, color: plan.color, fontFamily: 'var(--fh)' }}>Free</span>
              ) : (
                <>
                  <span style={{ fontSize: 32, fontWeight: 700, color: plan.color, fontFamily: 'var(--fh)' }}>${plan.price}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 2 }}>{plan.period}</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 22 }}>{plan.desc}</div>

            {/* CTA */}
            {plan.current ? (
              <div style={{ padding: '9px 16px', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 22 }}>
                ✓ Current Plan
              </div>
            ) : notified.includes(plan.name) ? (
              <div style={{ padding: '9px 16px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, textAlign: 'center', marginBottom: 22 }}>
                ✓ You'll be notified
              </div>
            ) : (
              <button
                onClick={() => handleNotify(plan.name)}
                style={{ padding: '9px 16px', background: 'var(--elevated)', border: `1px solid ${plan.color}40`, borderRadius: 8, color: plan.color, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 22 }}
              >
                {plan.cta}
              </button>
            )}

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Paystack note */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>
          ₦
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Nigerian payment support via Paystack</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            When paid plans launch, billing will be available in NGN via Paystack — no USD card required. Flutterwave also supported.
          </div>
        </div>
      </div>

      {/* Invoice history placeholder */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Invoice History</div>
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No invoices yet · You are on the free beta plan
        </div>
      </div>
    </div>
  )
}
