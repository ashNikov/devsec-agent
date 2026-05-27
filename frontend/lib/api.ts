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

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (org_name: string, email: string, password: string) =>
    request<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ org_name, email, password }),
    }),
  me: () => request<{ email: string; org_id: string; role: string; plan: string }>('/auth/me'),
}

// Dashboard
export const dashApi = {
  getStats: () => request<any>('/api/dashboard/stats'),
}

// Repos
export const reposApi = {
  list: () => request<any[]>('/api/repos'),
  scan: (repoId: number) =>
    request<any>(`/api/repos/${repoId}/scan`, { method: 'POST' }),
}

// Findings
export const findingsApi = {
  list: () => request<any[]>('/api/findings'),
  resolve: (id: number) =>
    request<any>(`/api/findings/${id}/resolve`, { method: 'PATCH' }),
}

// Team
export const teamApi = {
  list: () => request<any[]>('/api/team'),
  invite: (email: string, role: string = 'viewer') =>
    request<void>('/api/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
}

// Settings
export const settingsApi = {
  regenerateApiKey: () =>
    request<{ api_key: string }>('/api/settings/api-key/regenerate', { method: 'POST' }),
  updateProfile: (data: { name: string; email: string }) =>
    request<void>('/api/settings/profile', { method: 'PATCH', body: JSON.stringify(data) }),
}
