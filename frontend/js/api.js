import { getToken, setToken, clearToken } from './auth.js';

const BASE_URL = window.location.origin;

async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    clearToken();
    window.location.href = 'login.html';
    throw new Error('Oturum süreniz doldu');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Bir hata oluştu');
  }

  return data;
}

export async function login(email, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setToken(data.token);
  }
  if (data.user) {
    const { setUser } = await import('./auth.js');
    setUser(data.user);
  }
  return data;
}

export async function signup(data) {
  return api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  clearToken();
}

export async function getProfile() {
  return api('/api/auth/profile');
}

export async function updateProfile(data) {
  return api('/api/auth/profile', {
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

export async function cancelAppointment(id) {
  return api(`/api/appointments/${id}`, {
    method: 'DELETE',
  });
}

export async function getDoctors() {
  return api('/api/users/doctors');
}

export async function getDoctor(id) {
  return api(`/api/users/doctors/${id}`);
}

export async function getAvailability(doctorId, date) {
  return api(`/api/appointments/availability?doctorId=${doctorId}&date=${date}`);
}

export async function generateSlots(doctorId, startDate, endDate) {
  return api('/api/appointments/generate-slots', {
    method: 'POST',
    body: JSON.stringify({ doctorId, startDate, endDate }),
  });
}
