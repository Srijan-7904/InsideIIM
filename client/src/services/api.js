import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export async function login(username, password) {
  const { data } = await api.post('/api/auth/login', { username, password });
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  return data;
}

export async function searchCompany(companyName) {
  const { data } = await api.post('/api/research', { companyName });
  return data;
}

export async function startResearch(companyName) {
  const { data } = await api.post('/api/research/start', { companyName });
  return data;
}

export async function getResearchStatus(jobId) {
  const { data } = await api.get(`/api/research/status/${jobId}`);
  return data;
}
