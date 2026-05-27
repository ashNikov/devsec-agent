export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type RepoStatus = 'clean' | 'warning' | 'critical' | 'scanning'
export type FindingStatus = 'open' | 'resolved' | 'ignored'

export interface Repo {
  id: string
  name: string
  full_name: string
  status: RepoStatus
  findings_count: number
  last_scan: string | null
  branch: string
  language: string
  enabled: boolean
}

export interface Finding {
  id: string
  severity: Severity
  title: string
  description: string
  file_path: string
  repo_name: string
  tool: string
  status: FindingStatus
  created_at: string
  remediation?: string
}

export interface ScanResult {
  id: string
  repo_name: string
  status: 'completed' | 'running' | 'failed'
  findings_count: number
  created_at: string
  duration_ms: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'viewer'
  avatar_initials: string
  last_active: string
}

export interface DashStats {
  total_scans: number
  open_findings: number
  repos_count: number
  last_scan_time: string | null
  findings_by_severity: Record<Severity, number>
  scan_history: { day: string; scans: number; findings: number }[]
}
