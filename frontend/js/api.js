import { getToken, setToken, clearToken } from './auth.js';

const API_BASE = window.API_BASE_URL || window.location.origin;

async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (response.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      throw new Error('Oturum süreniz doldu');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Bir hata oluştu');
    return data;
  } catch (err) {
    if (err.message === 'Oturum süreniz doldu') throw err;
    throw new Error(err.message || 'Sunucuya bağlanılamadı');
  }
}

export async function login(email, password) {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.data?.session?.access_token) setToken(res.data.session.access_token);
  return res;
}

export async function signup(data) {
  const res = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.data?.session?.access_token) setToken(res.data.session.access_token);
  return res;
}

export async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  clearToken();
}

export async function getProfile() {
  return api('/api/auth/me');
}

export async function updateProfile(data) {
  return api('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getAppointments() {
  return api('/api/appointments');
}

export async function createAppointment(data) {
  return api('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAppointment(id, data) {
  return api(`/api/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelAppointment(id) {
  return api(`/api/appointments/${id}`, { method: 'DELETE' });
}

export async function getDoctors() {
  return api('/api/doctors');
}

export async function getDoctor(id) {
  return api(`/api/doctors/${id}`);
}

export async function getAvailability(doctorId, date) {
  const params = new URLSearchParams({ doctor_id: doctorId, date });
  return api(`/api/availability?${params}`);
}

export async function generateSlots(doctorId, startDate, endDate) {
  return api('/api/availability/generate', {
    method: 'POST',
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  });
}
