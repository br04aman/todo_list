// ——— API Client for Express Backend ———

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ——— Token Management ———
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ——— Fetch Wrapper ———
async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // for cookies (refresh token)
  });

  // Auto-refresh on 401/403
  if ((res.status === 401 || res.status === 403) && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ error: 'Request failed' }));
        throw err;
      }
      return retryRes.json();
    } else {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw { error: 'Session expired' };
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw err;
  }

  return res.json();
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      setTokens(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ——— Auth API ———
export async function register(email: string, password: string) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.accessToken) {
    setTokens(data.accessToken);
  }
  return data;
}

export async function login(email: string, password: string, mfaToken?: string) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, mfaToken }),
  });
  if (data.accessToken) {
    setTokens(data.accessToken);
  }
  return data;
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    clearTokens();
  }
}

export async function getMe() {
  return apiFetch('/api/auth/me');
}

export function getGoogleOAuthUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

export function getGitHubOAuthUrl(): string {
  return `${API_BASE}/api/auth/github`;
}

// ——— MFA API ———
export async function setupMfa() {
  return apiFetch('/api/auth/mfa/setup', { method: 'POST' });
}

export async function verifyMfa(token: string) {
  return apiFetch('/api/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function disableMfa(token: string) {
  return apiFetch('/api/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ——— Tasks API ———
export interface TaskData {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  userId: string;
}

export async function getTasks(): Promise<TaskData[]> {
  return apiFetch('/api/tasks');
}

export async function createTask(text: string): Promise<TaskData> {
  return apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function toggleTask(id: string, completed: boolean): Promise<TaskData> {
  return apiFetch(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ completed }),
  });
}

export async function updateTaskText(id: string, text: string): Promise<TaskData> {
  return apiFetch(`/api/tasks/${id}/text`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
}

export async function deleteTask(id: string) {
  return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
}

export async function clearAllTasks() {
  return apiFetch('/api/tasks', { method: 'DELETE' });
}

export async function clearCompletedTasks() {
  return apiFetch('/api/tasks?completed=true', { method: 'DELETE' });
}

// ——— Payments API ———
export async function createPaymentOrder() {
  return apiFetch('/api/payments/create-order', { method: 'POST' });
}

export async function verifyPayment(data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiFetch('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPremiumStatus() {
  return apiFetch('/api/payments/status');
}
