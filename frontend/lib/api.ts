const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('agentsec_token')
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })

  if (res.status === 401) {
    localStorage.removeItem('agentsec_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  register: (org_name: string, email: string, password: string) =>
    request<{ access_token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ org_name, email, password }),
    }),
  me: () => request<any>('/auth/me'),
  updateProfile: (email: string) =>
    request<any>('/auth/profile', {
      method: 'PATCH', body: JSON.stringify({ email }),
    }),
}

export const dashApi = {
  health:  () => request<any>('/health'),
  summary: () => request<any>('/scan/summary'),
  orgMe:   () => request<any>('/org/me'),
  history: () => request<any[]>('/history/scans'),
}

export const reposApi = {
  list:       () => request<any[]>('/repos'),
  triggerScan: () => request<any>('/scheduler/trigger', { method: 'POST' }),
  scanRepo:   (repo_name: string) =>
    request<any>('/scan/repo', { method: 'POST', body: JSON.stringify({ repo_name }) }),
  addRepo:    (repo_name: string, repo_url: string) =>
    request<any>('/org/repos', { method: 'POST', body: JSON.stringify({ repo_name, repo_url }) }),
}

export const findingsApi = {
  list:     () => request<any[]>('/findings'),
  resolved: () => request<{ resolved_ids: number[] }>('/findings/resolved'),
  resolve:  (id: string | number) =>
    request<any>(`/findings/${id}/resolve`, { method: 'PATCH' }),
}

export const teamApi = {
  list:   () => request<any[]>('/org/members'),
  invite: (email: string) =>
    request<any>('/org/invite', { method: 'POST', body: JSON.stringify({ email }) }),
}

export const settingsApi = {
  createApiKey: (name: string) =>
    request<{ key: string; warning: string }>('/org/api-keys', {
      method: 'POST', body: JSON.stringify({ name }),
    }),
}

export const billingApi = {
  status:     () => request<any>('/billing/status'),
  initialize: () =>
    request<{ checkout_url: string; reference: string }>('/billing/initialize', {
      method: 'POST',
      body: JSON.stringify({ callback_url: `${window.location.origin}/billing/callback` }),
    }),
}
