"use client";
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [repos, setRepos] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [time, setTime] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const handleExpired = () => {
    sessionStorage.removeItem("agentsec_token");
    setToken(null);
    setUser(null);
    setRepos([]);
    setHealth(null);
    setSummary(null);
  };

  const authFetch = (url: string, headers: any) =>
    fetch(url, { headers }).then(r => {
      if (r.status === 401) { handleExpired(); throw new Error("expired"); }
      return r.json();
    });

  // ── JWT SILENT REFRESH ──────────────────────────────────
  const scheduleTokenRefresh = (jwt: string) => {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - 5 * 60 * 1000; // 5 min before expiry
      const delay = refreshAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          window.location.href = `${API_BASE}/auth/login`;
        }, delay);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");

    if (urlToken) {
      sessionStorage.setItem("agentsec_token", urlToken);
      window.history.replaceState({}, document.title, "/");
      setToken(urlToken);
      scheduleTokenRefresh(urlToken);
    } else {
      const stored = sessionStorage.getItem("agentsec_token");
      if (stored) { setToken(stored); scheduleTokenRefresh(stored); }
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    authFetch(`${API_BASE}/auth/me`, headers).then(setUser).catch(() => {});
    authFetch(`${API_BASE}/repos`, headers).then(data => setRepos(Array.isArray(data) ? data : [])).catch(() => {});
    setSummaryLoading(true);
    authFetch(`${API_BASE}/scan/summary`, headers).then(data => { setSummary(data); setSummaryLoading(false); }).catch(() => { setSummaryLoading(false); });
    fetch(`${API_BASE}/health`).then(r => r.json()).then(setHealth).catch(() => {});

    const t = setInterval(() => {
      setTime(new Date().toISOString().replace("T", " ").split(".")[0] + " UTC");
    }, 50);
    return () => clearInterval(t);
  }, [token]);

  const handleLogout = () => {
    sessionStorage.removeItem("agentsec_token");
    setToken(null);
    setUser(null);
    setRepos([]);
    setHealth(null);
    setSummary(null);
  };

  if (!authChecked) return null;

  if (!token) {
    return (
      <main style={{ minHeight: "100vh", background: "#0d1520", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ marginBottom: "2rem" }}>
            <svg width="80" height="80" viewBox="0 0 48 48" style={{ margin: "0 auto 1rem" }}>
              <circle cx="24" cy="24" r="22" fill="none" stroke="#00d4aa" strokeWidth="0.5" strokeDasharray="4 2" />
              <circle cx="24" cy="24" r="16" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="2 4" />
              <polygon points="24,8 38,16 38,32 24,40 10,32 10,16" fill="#0d1520" stroke="#00d4aa" strokeWidth="1.5"/>
              <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#00ff88" fontFamily="monospace">A</text>
            </svg>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#00ff88", letterSpacing: 4, marginBottom: 4 }}>
              AGENT<span style={{ color: "#00d4aa" }}>SEC</span>
            </div>
            <div style={{ fontSize: 11, color: "#4a7a5a", letterSpacing: 4, marginBottom: 4 }}>AUTONOMOUS DEVSECOPS</div>
            <div style={{ fontSize: 9, color: "#2a4a3a", letterSpacing: 3 }}>POWERED BY UWEM</div>
          </div>

          <div style={{ background: "#111a27", border: "0.5px solid #0e2a1a", borderRadius: 12, padding: "2rem", maxWidth: 380, margin: "0 auto" }}>
            <div style={{ fontSize: 13, color: "#4a7a5a", marginBottom: "1.5rem", letterSpacing: 1 }}>
              AUTONOMOUS SECURITY MONITORING
            </div>
            <div style={{ fontSize: 11, color: "#2a4a3a", marginBottom: "2rem" }}>
              Connect your GitHub to start scanning repos, detecting secrets, and monitoring vulnerabilities in real time.
            </div>
            <a href={`${API_BASE}/auth/login`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                background: "#00ff88", color: "#0d1520", padding: "12px 24px",
                borderRadius: 8, fontWeight: 700, fontSize: 13, letterSpacing: 2,
                cursor: "pointer", transition: "all 0.2s"
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0d1520">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                LOGIN WITH GITHUB
              </div>
            </a>
            <div style={{ marginTop: "1.5rem", fontSize: 9, color: "#2a4a3a", letterSpacing: 1 }}>
              SECURED WITH GITHUB OAUTH 2.0
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--agent-bg)", padding: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", borderBottom: "0.5px solid #0e2a1a", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#00d4aa" strokeWidth="0.5" strokeDasharray="4 2"
                style={{ animation: "spin-slow 12s linear infinite", transformOrigin: "24px 24px" }} />
              <circle cx="24" cy="24" r="16" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="2 4"
                style={{ animation: "spin-reverse 8s linear infinite", transformOrigin: "24px 24px" }} />
              <polygon points="24,8 38,16 38,32 24,40 10,32 10,16" fill="#0d1520" stroke="#00d4aa" strokeWidth="1.5"/>
              <line x1="24" y1="24" x2="24" y2="8" stroke="#00ff88" strokeWidth="1" opacity="0.6"
                style={{ animation: "radar-sweep 4s linear infinite", transformOrigin: "24px 24px" }} />
              <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#00ff88" fontFamily="monospace">A</text>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#00ff88", letterSpacing: 3 }}>
              AGENT<span style={{ color: "#00d4aa" }}>SEC</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a7a5a", letterSpacing: 4 }}>AUTONOMOUS DEVSECOPS</div>
            <div style={{ fontSize: 9, color: "#2a4a3a", letterSpacing: 3, marginTop: 2 }}>POWERED BY UWEM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={user.avatar_url} alt={user.login} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #00ff88" }} />
              <span style={{ fontSize: 10, color: "#00ff88", fontFamily: "monospace" }}>{user.login}</span>
            </div>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#00ff88", fontFamily: "monospace" }}>{time}</div>
            <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 4 }}>
              {health ? "● AGENT ONLINE" : "○ CONNECTING..."}
            </div>
          </div>
          <button onClick={handleLogout} style={{
            background: "transparent", border: "0.5px solid #2a4a3a", color: "#4a7a5a",
            padding: "4px 10px", borderRadius: 4, fontSize: 9, cursor: "pointer", letterSpacing: 1
          }}>
            LOGOUT
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: "2rem" }}>
        {[
          { label: "REPOS MONITORED", value: repos.length || "—", color: "#00ff88" },
          { label: "ACTIVE TOOLS", value: health ? Object.keys(health.tools || {}).length : "—", color: "#00d4aa" },
          { label: "CRITICAL FINDINGS", value: summaryLoading ? "..." : summary ? summary.critical_findings : "—", color: "#ff4444" },
          { label: "AGENT STATUS", value: health ? "ONLINE" : "—", color: "#00ff88" },
        ].map((m, i) => (
          <div key={i} className="agent-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#4a7a5a", letterSpacing: 2, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="agent-card">
          <div style={{ fontSize: 11, color: "#4a7a5a", letterSpacing: 3, marginBottom: 16 }}>GITHUB REPOSITORIES</div>
          <div style={{ position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00ff88, transparent)", animation: "scan-vertical 3s ease-in-out infinite" }} />
            {repos.length === 0 ? (
              <div style={{ color: "#4a7a5a", fontSize: 12 }}>Connecting to GitHub...</div>
            ) : repos.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #0e2a1a" }}>
                <span style={{ fontSize: 12, color: "#c8ffd4" }}>{r.name}</span>
                <span style={{ fontSize: 10, color: r.private ? "#ffaa00" : "#00d4aa", border: `0.5px solid ${r.private ? "#ffaa00" : "#00d4aa"}`, padding: "2px 6px", borderRadius: 4 }}>
                  {r.private ? "PRIVATE" : "PUBLIC"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="agent-card">
          <div style={{ fontSize: 11, color: "#4a7a5a", letterSpacing: 3, marginBottom: 16 }}>TOOL STATUS</div>
          {health ? Object.entries(health.tools || {}).map(([tool, status]: any, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #0e2a1a" }}>
              <span style={{ fontSize: 12, color: "#c8ffd4", textTransform: "uppercase", letterSpacing: 2 }}>{tool}</span>
              <span style={{ fontSize: 10, color: "#00ff88", animation: "pulse-green 2s ease-in-out infinite" }}>● {String(status).toUpperCase()}</span>
            </div>
          )) : (
            <div style={{ color: "#4a7a5a", fontSize: 12 }}>Connecting to agent...</div>
          )}
        </div>
      </div>
    </main>
  );
}
