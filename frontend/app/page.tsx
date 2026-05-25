"use client";
import { useEffect, useState, useRef } from "react";

const API_BASE = "http://localhost:8000";
const TOOLS = ["gitleaks","trivy","github","gcp","sonarcloud"];
const TOOL_DESC: Record<string,string> = {
  gitleaks:"Secret Detection", trivy:"Vuln Scanner",
  github:"Repo Monitor", gcp:"Cloud IAM", sonarcloud:"SAST Analysis"
};

export default function Home() {
  const [repos,          setRepos]          = useState<any[]>([]);
  const [health,         setHealth]         = useState<any>(null);
  const [summary,        setSummary]        = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [scheduler,      setScheduler]      = useState<any>(null);
  const [time,           setTime]           = useState("");
  const [token,          setToken]          = useState<string|null>(null);
  const [user,           setUser]           = useState<any>(null);
  const [authChecked,    setAuthChecked]    = useState(false);
  const [project,        setProject]        = useState<any>(null);
  const [compliance,     setCompliance]     = useState<any[]>([]);
  const [scanning,       setScanning]       = useState(false);
  const [scanMsg,        setScanMsg]        = useState("");
  const [radarAngle,     setRadarAngle]     = useState(0);
  const [logs,           setLogs]           = useState<string[]>([
    "[INFO]  AgentSec initialized — v2.0.0",
    "[INFO]  Waiting for authentication...",
  ]);
  const [remResult,      setRemResult]      = useState<any>(null);
  const [remLoading,     setRemLoading]     = useState<string|null>(null);
  const [approvals,      setApprovals]      = useState<any[]>([]);
  const [approvalHistory,setApprovalHistory]= useState<any[]>([]);
  const [appLoading,     setAppLoading]     = useState<string|null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (line: string) => setLogs(l => [...l.slice(-40), line]);

  const handleExpired = () => {
    sessionStorage.removeItem("agentsec_token");
    setToken(null); setUser(null);
    setRepos([]); setHealth(null); setSummary(null);
  };

  const authFetch = (url: string, headers: any) =>
    fetch(url, { headers }).then(r => {
      if (r.status === 401) { handleExpired(); throw new Error("expired"); }
      return r.json();
    });

  const scheduleTokenRefresh = (jwt: string) => {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      const refreshAt = payload.exp * 1000 - 5 * 60 * 1000;
      const delay = refreshAt - Date.now();
      if (delay > 0) setTimeout(() => { window.location.href = `${API_BASE}/auth/login`; }, delay);
    } catch(e) {}
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      sessionStorage.setItem("agentsec_token", urlToken);
      window.history.replaceState({}, document.title, "/");
      setToken(urlToken); scheduleTokenRefresh(urlToken);
    } else {
      const stored = sessionStorage.getItem("agentsec_token");
      if (stored) { setToken(stored); scheduleTokenRefresh(stored); }
    }
    setAuthChecked(true);
  }, []);

  const fetchApprovals = (h: any) => {
    authFetch(`${API_BASE}/approvals/pending`, h).then(setApprovals).catch(() => {});
    authFetch(`${API_BASE}/approvals/all`, h).then(setApprovalHistory).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    addLog("[INFO]  Loading secrets from GCP Secret Manager...");
    authFetch(`${API_BASE}/auth/me`, h).then(d => { setUser(d); addLog(`[OK]    Authenticated as ${d.login}`); }).catch(() => {});
    fetch(`${API_BASE}/project/status`).then(r=>r.json()).then(setProject).catch(()=>{});
    fetch(`${API_BASE}/provision/scan`, {headers:h}).then(r=>r.json()).then(d=>setCompliance(d.findings||[])).catch(()=>{});
    fetch(`${API_BASE}/health`).then(r=>r.json()).then(d => {
      setHealth(d);
      const active = Object.values(d.tools||{}).filter((v:any)=>v==="active").length;
      addLog(`[OK]    ${active}/${Object.keys(health.tools).length + 1} tools active`);
    }).catch(() => {});
    authFetch(`${API_BASE}/repos`, h).then(d => {
      const arr = Array.isArray(d) ? d : [];
      setRepos(arr); addLog(`[OK]    ${arr.length} repositories discovered`);
    }).catch(() => {});
    setSummaryLoading(true);
    authFetch(`${API_BASE}/scan/summary`, h).then(d => {
      setSummary(d); setSummaryLoading(false);
      if (d.critical_findings !== null) addLog(`[WARN]  ${d.critical_findings} critical findings in last scan`);
    }).catch(() => { setSummaryLoading(false); });
    authFetch(`${API_BASE}/scheduler/status`, h).then(d => {
      setScheduler(d); addLog(`[INFO]  Scheduler — next scan: ${d.next_run||"unknown"}`);
    }).catch(() => {});
    fetchApprovals(h);
    // Poll approvals every 15s
    const pollId = setInterval(() => fetchApprovals({ Authorization: `Bearer ${token}` }), 15000);
    const clock  = setInterval(() => setTime(new Date().toISOString().replace("T"," ").split(".")[0]+" UTC"), 50);
    return () => { clearInterval(pollId); clearInterval(clock); };
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => setRadarAngle(a => (a+2)%360), 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const triggerScan = async () => {
    if (scanning || !token) return;
    setScanning(true); setScanMsg("Scanning all repos...");
    addLog("[INFO]  Multi-repo scan triggered — scanning all repos");
    try {
      const r = await fetch(`${API_BASE}/scheduler/trigger`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      if (r.status === 401) { handleExpired(); return; }
      setScanMsg("Scan complete — Slack report sent");
      addLog("[OK]    Multi-repo scan complete — Claude Haiku analyzed all repos");
      addLog("[INFO]  Slack alert dispatched with per-repo breakdown");
      setTimeout(() => {
        const h = { Authorization:`Bearer ${token}` };
        fetch(`${API_BASE}/health`).then(r=>r.json()).then(setHealth);
        authFetch(`${API_BASE}/scan/summary`, h).then(d => { setSummary(d); setSummaryLoading(false); });
        authFetch(`${API_BASE}/scheduler/status`, h).then(setScheduler);
        addLog("[OK]    Dashboard refreshed");
        setScanning(false);
      }, 8000);
    } catch(e) { addLog("[ERR]   Scan trigger failed"); setScanning(false); }
  };

  const runRemediation = async (label: string, endpoint: string, method: string) => {
    if (!token) return;
    setRemLoading(label); setRemResult(null);
    addLog(`[INFO]  Running: ${label}...`);
    try {
      const r = await fetch(`${API_BASE}${endpoint}`, { method, headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" } });
      if (r.status === 401) { handleExpired(); return; }
      const d = await r.json();
      setRemResult({ label, data:d, ok:true });
      addLog(`[OK]    ${label} complete`);
    } catch(e) {
      setRemResult({ label, data:{ error:"Request failed" }, ok:false });
      addLog(`[ERR]   ${label} failed`);
    } finally { setRemLoading(null); }
  };

  const testApproval = async () => {
    if (!token) return;
    addLog("[INFO]  Creating test approval request...");
    try {
      const r = await fetch(`${API_BASE}/approvals/test`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      const d = await r.json();
      addLog(`[OK]    Approval request created — ID: ${d.approval_id}`);
      addLog("[INFO]  Check Slack for notification");
      fetchApprovals({ Authorization:`Bearer ${token}` });
    } catch(e) { addLog("[ERR]   Test approval failed"); }
  };

  const handleApproval = async (id: string, action: "approve"|"reject") => {
    if (!token) return;
    setAppLoading(id);
    addLog(`[INFO]  ${action === "approve" ? "Approving" : "Rejecting"} action ${id}...`);
    try {
      const r = await fetch(`${API_BASE}/approvals/${id}/${action}`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      const d = await r.json();
      if (d.ok) {
        addLog(`[OK]    Action ${id} — ${action}d by ${user?.login}`);
        fetchApprovals({ Authorization:`Bearer ${token}` });
      } else {
        addLog(`[ERR]   ${d.error}`);
      }
    } catch(e) { addLog(`[ERR]   Approval action failed`);
    } finally { setAppLoading(null); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("agentsec_token");
    setToken(null); setUser(null); setRepos([]); setHealth(null); setSummary(null);
  };

  if (!authChecked) return null;

  if (!token) return (
    <main style={{minHeight:"100vh",background:"#070a0e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@600;700&display=swap');
        @keyframes spin-slow{to{transform:rotate(360deg)}}
        @keyframes spin-rev{to{transform:rotate(-360deg)}}
        @keyframes radar{to{transform:rotate(360deg)}}
        .login-btn:hover{background:rgba(57,255,20,0.25)!important}
      `}</style>
      <div style={{textAlign:"center",padding:"2rem"}}>
        <div style={{marginBottom:"2rem"}}>
          <svg width="88" height="88" viewBox="0 0 48 48" style={{margin:"0 auto 1rem",display:"block"}}>
            <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(0,212,255,0.4)" strokeWidth="0.5" strokeDasharray="4 2" style={{animation:"spin-slow 12s linear infinite",transformOrigin:"24px 24px"}}/>
            <circle cx="24" cy="24" r="16" fill="none" stroke="rgba(57,255,20,0.35)" strokeWidth="0.5" strokeDasharray="2 4" style={{animation:"spin-rev 8s linear infinite",transformOrigin:"24px 24px"}}/>
            <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="#070a0e" stroke="#00d4ff" strokeWidth="1.2"/>
            <line x1="24" y1="24" x2="24" y2="4" stroke="#39ff14" strokeWidth="1" opacity="0.7" style={{animation:"radar 4s linear infinite",transformOrigin:"24px 24px"}}/>
            <text x="24" y="29" textAnchor="middle" fontSize="12" fontWeight="700" fill="#39ff14" fontFamily="monospace">A</text>
          </svg>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:"2rem",fontWeight:700,color:"#39ff14",letterSpacing:"0.12em",marginBottom:4}}>AGENT<span style={{color:"#00d4ff"}}>SEC</span></div>
          <div style={{fontSize:"0.62rem",color:"#3a5a6a",letterSpacing:"0.18em"}}>AUTONOMOUS DEVSECOPS AGENT</div>
          <div style={{fontSize:"0.55rem",color:"#1a2a3a",letterSpacing:"0.15em",marginTop:4}}>ashNikov Technologies — v2.0.0</div>
        </div>
        <div style={{background:"#0d1117",border:"1px solid rgba(0,212,255,0.12)",borderRadius:10,padding:"2rem",maxWidth:360,margin:"0 auto"}}>
          <div style={{fontSize:"0.65rem",color:"#3a5a6a",letterSpacing:"0.12em",marginBottom:"1rem"}}>CONNECT YOUR GITHUB TO BEGIN</div>
          <a href={`${API_BASE}/auth/login`} style={{textDecoration:"none"}}>
            <div className="login-btn" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"rgba(57,255,20,0.12)",color:"#39ff14",border:"1px solid #39ff14",padding:"11px 24px",borderRadius:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:"0.72rem",letterSpacing:"0.08em",cursor:"pointer",transition:"all 0.2s"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#39ff14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              LOGIN WITH GITHUB
            </div>
          </a>
          <div style={{fontSize:"0.55rem",color:"#1a2a3a",letterSpacing:"0.1em",marginTop:"1.25rem"}}>SECURED WITH GITHUB OAUTH 2.0 + JWT</div>
        </div>
      </div>
    </main>
  );

  const critCount   = summaryLoading ? "..." : summary?.critical_findings ?? "—";
  const vulnCount   = summaryLoading ? "..." : summary?.vulnerabilities   ?? "—";
  const secretCount = summaryLoading ? "..." : summary?.secrets           ?? "—";
  const sonarCount   = summaryLoading ? "..." : summary?.sonar_issues ?? "—";
  const sonarGate    = summaryLoading ? "..." : summary?.sonar_gate   ?? "—";
  const toolStatuses = {...(health?.tools || {}), sonarcloud: health?.sonarcloud?.status || "checking"};
  const rad = radarAngle * Math.PI / 180;
  const sweepX = 100 + 90 * Math.sin(rad);
  const sweepY = 100 - 90 * Math.cos(rad);
  const largeArc = radarAngle > 180 ? 1 : 0;

  return (
    <main style={{minHeight:"100vh",background:"#070a0e",color:"#c8d8e8",fontFamily:"'JetBrains Mono',monospace",paddingBottom:"2rem"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Rajdhani:wght@600;700&display=swap');
        *{box-sizing:border-box}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sweep{to{left:200%}}
        @keyframes scanline{from{top:-2px}to{top:100%}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,184,0,0.4)}50%{box-shadow:0 0 0 6px rgba(255,184,0,0)}}
        .scanline-wrap{position:relative;overflow:hidden}
        .scanline-wrap::after{content:'';position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(57,255,20,0.4),transparent);animation:scanline 3s ease-in-out infinite;pointer-events:none}
        .scan-btn{padding:6px 18px;border-radius:4px;border:1px solid #39ff14;background:rgba(57,255,20,0.1);color:#39ff14;font-family:'JetBrains Mono',monospace;font-size:.65rem;font-weight:700;cursor:pointer;letter-spacing:.08em;transition:all .2s;position:relative;overflow:hidden}
        .scan-btn:hover:not(:disabled){background:rgba(57,255,20,0.2)}
        .scan-btn:disabled{opacity:.45;cursor:not-allowed}
        .scan-btn.active::after{content:'';position:absolute;left:-100%;top:0;bottom:0;width:60%;background:linear-gradient(90deg,transparent,rgba(57,255,20,0.3),transparent);animation:sweep 1s infinite}
        .tool-card{background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.1);border-radius:6px;padding:10px 12px;transition:border-color .2s}
        .tool-card:hover{border-color:rgba(0,212,255,0.25)}
        .hdot{width:7px;height:7px;border-radius:50%;display:inline-block}
        .hdot.active{background:#39ff14;animation:blink 2s infinite}
        .hdot.error{background:#ff2d55;animation:blink .8s infinite}
        .hdot.checking{background:#ffb800;animation:blink .5s infinite}
        .repo-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(0,212,255,0.06);animation:fadeUp .3s ease}
        .rem-btn{display:block;width:100%;margin-bottom:6px;padding:7px 10px;background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.12);border-radius:4px;color:#6a9aaa;font-family:'JetBrains Mono',monospace;font-size:.6rem;cursor:pointer;text-align:left;transition:all .15s;letter-spacing:.04em}
        .rem-btn:hover{border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.08);color:#9ab8c8}
        .rem-btn:disabled{opacity:.4;cursor:not-allowed}
        .app-card{padding:10px 12px;border-radius:5px;margin-bottom:8px;border:1px solid rgba(255,184,0,0.3);background:rgba(255,184,0,0.06);animation:fadeUp .3s ease,pulse 2s infinite}
        .app-btn{padding:5px 12px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:.58rem;font-weight:700;cursor:pointer;border:none;transition:all .15s;letter-spacing:.06em}
        .app-btn:disabled{opacity:.4;cursor:not-allowed}
        .log-box{background:#030507;border-top:1px solid rgba(0,212,255,0.1);padding:.75rem 1.25rem;max-height:140px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(0,212,255,0.15) transparent;font-size:.6rem;line-height:1.8}
        .sep{background:rgba(0,212,255,0.08);display:grid;gap:1px}
        .pn{background:#070a0e;padding:1rem 1.25rem}
        .pt{font-family:'Rajdhani',sans-serif;font-size:.62rem;font-weight:600;letter-spacing:.15em;color:#3a5a6a;text-transform:uppercase;margin-bottom:.85rem;display:flex;align-items:center;gap:6px}
        .pt::before{content:'//';color:#00d4ff}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.15);border-radius:2px}
      `}</style>

      {/* TOPBAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".75rem 1.5rem",borderBottom:"1px solid rgba(0,212,255,0.12)",background:"rgba(7,10,14,0.98)",position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:"1.3rem",fontWeight:700,color:"#00d4ff",letterSpacing:".08em"}}>
          AGENT<span style={{color:"#39ff14"}}>SEC</span>
          <span style={{fontSize:".55rem",color:"#2a4a5a",marginLeft:12,letterSpacing:".1em"}}>v2.0.0</span>
          {approvals.length > 0 && (
            <span style={{marginLeft:12,fontSize:".6rem",background:"rgba(255,184,0,0.15)",border:"1px solid rgba(255,184,0,0.4)",color:"#ffb800",padding:"2px 8px",borderRadius:3,animation:"blink 1s infinite"}}>
              ⚠ {approvals.length} PENDING APPROVAL{approvals.length>1?"S":""}
            </span>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"1.25rem",fontSize:".62rem",color:"#3a5a6a"}}>
          <span>GCP: agent-sec-496307</span>
          <span style={{color:"#1a2a3a"}}>|</span>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:3,background:"rgba(255,45,85,0.1)",border:"1px solid rgba(255,45,85,0.3)",color:"#ff2d55",fontSize:".6rem",fontWeight:700,letterSpacing:".1em"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#ff2d55",display:"inline-block",animation:"blink 1s infinite"}}/>
            THREAT: HIGH
          </div>
          <span style={{color:"#1a2a3a"}}>|</span>
          <span style={{color:"#4a6a7a"}}>{time}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:".85rem"}}>
          <button className={`scan-btn${scanning?" active":""}`} onClick={triggerScan} disabled={scanning}>
            {scanning ? "SCANNING ALL REPOS..." : "▶ RUN SCAN"}
          </button>
          {user && (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.login} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid #00d4ff"}}/>
                : <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(0,212,255,0.15)",border:"1.5px solid #00d4ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".6rem",color:"#00d4ff",fontWeight:700}}>{user.login?.slice(0,2).toUpperCase()}</div>
              }
              <span style={{fontSize:".62rem",color:"#6a9aaa"}}>{user.login}</span>
            </div>
          )}
          <button onClick={handleLogout} style={{background:"transparent",border:"1px solid rgba(0,212,255,0.15)",color:"#3a5a6a",padding:"4px 10px",borderRadius:3,fontSize:".58rem",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>LOGOUT</button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="sep" style={{gridTemplateColumns:"repeat(6,1fr)",marginBottom:1}}>
        {[
          {label:"Critical Findings", value:critCount,        color:"#ff2d55", sub:"immediate action"},
          {label:"Vulnerabilities",   value:vulnCount,        color:"#ff6b2b", sub:"from Trivy scan"},
          {label:"Secrets Detected",  value:secretCount,      color:"#ffb800", sub:"from Gitleaks"},
          {label:"SonarCloud Issues",  value:sonarCount,       color:"#a855f7", sub:`gate: ${sonarGate}`},
          {label:"Repos Monitored",   value:repos.length||"—",color:"#00d4ff", sub:"all repos scanned"},
          {label:"Tools Active",      value:`${Object.values(toolStatuses).filter((v:any)=>v==="active").length||"—"}/5`, color:"#39ff14", sub:"all systems"},
        ].map((s,i) => (
          <div key={i} className="pn" style={{textAlign:"center"}}>
            <div style={{fontSize:".58rem",color:"#3a5a6a",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:"1.9rem",fontWeight:700,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:".55rem",color:"#2a4a5a",marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* PENDING APPROVALS BANNER */}
      {approvals.length > 0 && (
        <div style={{background:"rgba(255,184,0,0.08)",borderBottom:"1px solid rgba(255,184,0,0.2)",padding:".75rem 1.5rem",display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
          <span style={{fontSize:".65rem",color:"#ffb800",fontWeight:700,letterSpacing:".1em"}}>⚠ PENDING APPROVALS</span>
          {approvals.map((a:any) => (
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,184,0,0.08)",border:"1px solid rgba(255,184,0,0.25)",borderRadius:4,padding:"4px 10px"}}>
              <span style={{fontSize:".6rem",color:"#ffb800",fontFamily:"'JetBrains Mono',monospace"}}>[{a.id}]</span>
              <span style={{fontSize:".6rem",color:"#9ab8c8"}}>{a.action}</span>
              <span style={{fontSize:".55rem",color:"#3a5a6a"}}>expires in {a.expires_in}s</span>
              <button className="app-btn" style={{background:"rgba(57,255,20,0.15)",color:"#39ff14",border:"1px solid rgba(57,255,20,0.4)"}}
                disabled={appLoading===a.id} onClick={() => handleApproval(a.id,"approve")}>
                {appLoading===a.id ? "..." : "✓ APPROVE"}
              </button>
              <button className="app-btn" style={{background:"rgba(255,45,85,0.15)",color:"#ff2d55",border:"1px solid rgba(255,45,85,0.4)"}}
                disabled={appLoading===a.id} onClick={() => handleApproval(a.id,"reject")}>
                {appLoading===a.id ? "..." : "✗ REJECT"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="sep" style={{gridTemplateColumns:"260px 1fr 240px"}}>

        {/* LEFT */}
        <div className="pn">
          <div className="pt">Tool Health</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:"1.25rem"}}>
            {TOOLS.map(t => {
              const status = toolStatuses[t] || "checking";
              return (
                <div key={t} className="tool-card">
                  <div style={{fontSize:".65rem",fontWeight:700,color:"#9ab8c8",marginBottom:3}}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
                  <div style={{fontSize:".58rem",display:"flex",alignItems:"center",gap:4}}>
                    <span className={`hdot ${status==="active"?"active":status==="error"?"error":"checking"}`}/>
                    <span style={{color:status==="active"?"#39ff14":status==="error"?"#ff2d55":"#ffb800"}}>{status.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:".55rem",color:"#3a5a6a",marginTop:2}}>{TOOL_DESC[t]}</div>
                </div>
              );
            })}
          </div>

          <div className="pt">Repo Compliance</div>
          <div style={{display:"flex",flexDirection:"column",gap:"5px",marginBottom:".5rem"}}>
            {compliance.length === 0 ? (
              <div style={{color:"#2a4a5a",fontSize:".6rem",padding:"1rem 0",textAlign:"center"}}>Scanning repos...</div>
            ) : compliance.map((r:any,i:number) => {
              const total = 4;
              const missing = r.missing?.length || 0;
              const score = missing;
              const pct = Math.round((score/total)*100);
              const color = missing === 0 ? "#39ff14" : missing <= 1 ? "#ffb800" : missing <= 2 ? "#ff6b2b" : "#ff2d55";
              return (
                <div key={i} style={{background:"rgba(0,212,255,0.03)",border:`1px solid ${color}22`,borderRadius:"4px",padding:"6px 8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3px"}}>
                    <span style={{fontSize:".62rem",fontWeight:600,color:"#c8d8e8"}}>{r.repo}</span>
                    <span style={{fontSize:".58rem",fontWeight:700,color,background:`${color}15`,padding:"1px 6px",borderRadius:"3px"}}>
                      {missing === 0 ? "✓ COMPLIANT" : `${missing}/${total} missing`}
                    </span>
                  </div>
                  {missing > 0 && (
                    <div style={{fontSize:".55rem",color:"#3a6a7a",lineHeight:1.4}}>
                      {r.missing.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt" style={{marginTop:".75rem"}}>Scheduler</div>
          <div style={{fontSize:".6rem"}}>
            {[
              {k:"Status",   v:scheduler?.running!==false?"RUNNING":"PAUSED", c:scheduler?.running!==false?"#39ff14":"#ff2d55"},
              {k:"Interval", v:"6 hours", c:"#00d4ff"},
              {k:"Next Run", v:scheduler?.next_run||"—", c:"#c8d8e8"},
              {k:"Agent",    v:health?"ONLINE":"OFFLINE", c:health?"#39ff14":"#ff2d55"},
            ].map((r,i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(0,212,255,0.06)"}}>
                <span style={{color:"#3a5a6a"}}>{r.k}</span>
                <span style={{color:r.c,fontWeight:500}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div className="pn">
          <div className="pt">
            GitHub Repositories
            <span style={{color:"#2a4a5a",fontSize:".55rem",marginLeft:"auto"}}>{repos.length} repos — all scanning on next run</span>
          </div>
          <div className="scanline-wrap">
            {repos.length === 0
              ? <div style={{color:"#2a4a5a",fontSize:".65rem",padding:"2rem 0",textAlign:"center"}}>Connecting to GitHub...</div>
              : repos.map((r:any,i:number) => (
                <div key={i} className="repo-row">
                  <div>
                    <div style={{fontSize:".68rem",color:"#9ab8c8",fontWeight:500}}>{r.name}</div>
                    <div style={{fontSize:".55rem",color:"#3a5a6a",marginTop:2}}>{r.description||"No description"}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:".55rem",color:r.private?"#ffb800":"#00d4ff",border:`1px solid ${r.private?"rgba(255,184,0,0.3)":"rgba(0,212,255,0.3)"}`,padding:"2px 7px",borderRadius:3}}>
                      {r.private?"PRIVATE":"PUBLIC"}
                    </span>
                    <span style={{fontSize:".55rem",color:"#39ff14"}}>●</span>
                  </div>
                </div>
              ))
            }
          </div>
          {scanMsg && (
            <div style={{marginTop:"1.25rem",padding:"10px 14px",background:"rgba(57,255,20,0.06)",border:"1px solid rgba(57,255,20,0.2)",borderRadius:5,fontSize:".62rem",color:"#39ff14"}}>
              ✓ {scanMsg}
            </div>
          )}

          {/* APPROVAL HISTORY */}
          {approvalHistory.length > 0 && (
            <div style={{marginTop:"1.5rem"}}>
              <div className="pt">Approval History</div>
              {approvalHistory.slice(0,5).map((a:any) => (
                <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(0,212,255,0.06)",fontSize:".6rem"}}>
                  <span style={{color:"#3a5a6a",fontFamily:"'JetBrains Mono',monospace"}}>[{a.id}]</span>
                  <span style={{color:"#6a8a9a",flex:1,marginLeft:8}}>{a.action}</span>
                  <span style={{color:a.status==="approved"?"#39ff14":a.status==="rejected"?"#ff2d55":a.status==="expired"?"#3a5a6a":"#ffb800",fontWeight:700,letterSpacing:".06em"}}>
                    {a.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="pn">
          <div className="pt">Scan Summary</div>
          {[
            {label:"Critical", value:critCount,   bg:"rgba(255,45,85,0.1)",  border:"rgba(255,45,85,0.25)",  c:"#ff2d55"},
            {label:"Vulns",    value:vulnCount,   bg:"rgba(255,107,43,0.1)", border:"rgba(255,107,43,0.25)", c:"#ff6b2b"},
            {label:"Secrets",  value:secretCount, bg:"rgba(255,184,0,0.1)",  border:"rgba(255,184,0,0.25)",  c:"#ffb800"},
          ].map((s,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:6,background:s.bg,border:`1px solid ${s.border}`,borderRadius:5}}>
              <span style={{fontSize:".6rem",color:"#6a8a9a",letterSpacing:".08em"}}>{s.label}</span>
              <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:"1.3rem",fontWeight:700,color:s.c}}>{s.value}</span>
            </div>
          ))}

          <div className="pt" style={{marginTop:"1.25rem"}}>Remediation</div>
          {[
            {label:"Fix IAM Bindings",  endpoint:"/remediate/iam",           method:"POST"},
            {label:"Harden Dockerfile", endpoint:"/remediate/dockerfile",    method:"POST"},
            {label:"Rotate JWT Secret", endpoint:"/remediate/rotate-secret", method:"POST"},
            {label:"Full Report",       endpoint:"/remediate/report",        method:"GET"},
          ].map((a,i) => (
            <button key={i} className="rem-btn" disabled={!!remLoading}
              onClick={() => runRemediation(a.label, a.endpoint, a.method)}>
              {remLoading===a.label ? "⟳ running..." : `▸ ${a.label}`}
            </button>
          ))}

          {remResult && (
            <div style={{marginTop:"1rem",padding:"10px 12px",background:remResult.ok?"rgba(57,255,20,0.05)":"rgba(255,45,85,0.05)",border:`1px solid ${remResult.ok?"rgba(57,255,20,0.2)":"rgba(255,45,85,0.2)"}`,borderRadius:5,animation:"fadeUp .3s ease"}}>
              <div style={{fontSize:".58rem",color:remResult.ok?"#39ff14":"#ff2d55",fontWeight:700,marginBottom:6,letterSpacing:".08em"}}>
                {remResult.ok?"✓":"✗"} {remResult.label}
              </div>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"'JetBrains Mono',monospace",fontSize:".55rem",color:"#6a8a9a",maxHeight:140,overflowY:"auto"}}>
                {JSON.stringify(remResult.data,null,2)}
              </pre>
            </div>
          )}

          <div className="pt" style={{marginTop:"1.25rem"}}>Approval Workflow</div>
          <button className="rem-btn" onClick={testApproval}>
            ▸ Test Approval Request
          </button>
          <div style={{fontSize:".55rem",color:"#2a4a5a",marginTop:4,lineHeight:1.6}}>
            Creates a test HIGH-risk approval. Check Slack + banner above.
          </div>

          <div className="pt" style={{marginTop:"1.25rem"}}>Agent</div>
          <div style={{fontSize:".58rem",color:"#3a5a6a",lineHeight:1.8}}>
            <div>Model: <span style={{color:"#00d4ff"}}>{health?.model || "unknown"}</span></div>
            <div>Project: <span style={{color:"#6a9aaa"}}>agent-sec-496307</span></div>
            <div>Phase: <span style={{color:"#39ff14"}}>{project ? `${project.current_phase} — ${project.current_phase_name} (${project.current_phase_progress}%)` : "loading..."}</span></div>
            <div>Built by: <span style={{color:"#6a9aaa"}}>Uwem — ashNikov</span></div>
          </div>
        </div>
      </div>

      {/* TERMINAL LOG */}
      <div className="log-box" ref={logRef}>
        {logs.map((line,i) => {
          const c = line.startsWith("[OK]")?"#39ff14":line.startsWith("[WARN]")?"#ffb800":line.startsWith("[ERR]")?"#ff2d55":"#3a5a6a";
          return <div key={i} style={{color:c,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}><span style={{color:"#1a2a3a"}}>▸ </span>{line}</div>;
        })}
        {scanning && <div style={{color:"#00d4ff"}}><span style={{color:"#1a2a3a"}}>▸ </span><span style={{animation:"blink .8s infinite",display:"inline-block"}}>█</span></div>}
      </div>
    </main>
  );
}
