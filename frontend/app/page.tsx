"use client";
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [repos, setRepos] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [time, setTime] = useState("");
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/repos`).then(r => r.json()).then(setRepos).catch(() => {});
    fetch(`${API_BASE}/health`).then(r => r.json()).then(setHealth).catch(() => {});
    const t = setInterval(() => {
      setTime(new Date().toISOString().replace("T", " ").split(".")[0] + " UTC");
      setAngle(a => (a + 1) % 360);
    }, 50);
    return () => clearInterval(t);
  }, []);

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
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#00ff88", fontFamily: "monospace" }}>{time}</div>
          <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 4 }}>
            {health ? "● AGENT ONLINE" : "○ CONNECTING..."}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: "2rem" }}>
        {[
          { label: "REPOS MONITORED", value: repos.length || "—", color: "#00ff88" },
          { label: "ACTIVE TOOLS", value: health ? Object.keys(health.tools || {}).length : "—", color: "#00d4aa" },
          { label: "CRITICAL FINDINGS", value: "0", color: "#ff4444" },
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
