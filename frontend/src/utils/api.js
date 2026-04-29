import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => Promise.reject(err));

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((p) => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
      }
      original._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) { isRefreshing = false; window.dispatchEvent(new Event('auth:logout')); return Promise.reject(error); }
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;
        localStorage.setItem('accessToken', newAccess);
        localStorage.setItem('refreshToken', newRefresh);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(err);
      } finally { isRefreshing = false; }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password, tenantSlug) => api.post('/auth/login', { email, password, tenantSlug }),
  logout: (logoutAll = false) => api.post('/auth/logout', { logoutAll }),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  listRoles: () => api.get('/users/roles/list'),
};

export const tenantsAPI = {
  current: () => api.get('/tenants/current'),
  update: (data) => api.patch('/tenants/current', data),
  stats: () => api.get('/tenants/current/stats'),
  roles: () => api.get('/tenants/current/roles'),
  createRole: (data) => api.post('/tenants/current/roles', data),
  updateRole: (id, data) => api.patch(`/tenants/current/roles/${id}`, data),
  auditLogs: (params) => api.get('/tenants/current/audit-logs', { params }),
};

export default api;

// ── BOMs API ────────────────────────────────────────────────
export const bomsAPI = {
  list: (params) => api.get('/boms', { params }),
  stats: () => api.get('/boms/stats'),
  get: (id) => api.get(`/boms/${id}`),
  create: (data) => api.post('/boms', data),
  update: (id, data) => api.patch(`/boms/${id}`, data),
  publish: (id) => api.post(`/boms/${id}/publish`),
  archive: (id) => api.post(`/boms/${id}/archive`),
  delete: (id) => api.delete(`/boms/${id}`),
  addItems: (id, items) => api.post(`/boms/${id}/items`, { items }),
  updateItem: (id, itemId, data) => api.patch(`/boms/${id}/items/${itemId}`, data),
  deleteItem: (id, itemId) => api.delete(`/boms/${id}/items/${itemId}`),
  importItems: (id, rows) => api.post(`/boms/${id}/import`, { rows }),
};

// ── RFQs API ────────────────────────────────────────────────
export const rfqsAPI = {
  list: (params) => api.get('/rfqs', { params }),
  stats: () => api.get('/rfqs/stats'),
  get: (id) => api.get(`/rfqs/${id}`),
  getByToken: (token) => api.get(`/rfqs/token/${token}`),
  create: (data) => api.post('/rfqs', data),
  update: (id, data) => api.patch(`/rfqs/${id}`, data),
  importFromBom: (id, bomId) => api.post(`/rfqs/${id}/import-bom`, { bomId }),
  addVendors: (id, vendorIds) => api.post(`/rfqs/${id}/vendors`, { vendorIds }),
  removeVendor: (id, vendorId) => api.delete(`/rfqs/${id}/vendors/${vendorId}`),
  send: (id) => api.post(`/rfqs/${id}/send`),
  close: (id) => api.post(`/rfqs/${id}/close`),
  cancel: (id) => api.post(`/rfqs/${id}/cancel`),
  delete: (id) => api.delete(`/rfqs/${id}`),
};

// ── Quotes API ──────────────────────────────────────────────
export const quotesAPI = {
  list: (params) => api.get('/quotes', { params }),
  get: (id) => api.get(`/quotes/${id}`),
  submitByToken: (token, data) => api.post(`/quotes/submit/${token}`, data),
  evaluate: (id, data) => api.post(`/quotes/${id}/evaluate`, data),
  withdraw: (id) => api.post(`/quotes/${id}/withdraw`),
  compare: (rfqId) => api.get(`/quotes/compare/${rfqId}`),
};

// ── Bidding API ─────────────────────────────────────────────
export const biddingAPI = {
  list: (params) => api.get('/bidding', { params }),
  get: (id) => api.get(`/bidding/${id}`),
  getByRfq: (rfqId) => api.get(`/bidding/rfq/${rfqId}`),
  create: (data) => api.post('/bidding', data),
  startRound: (id) => api.post(`/bidding/${id}/start-round`),
  endRound: (id) => api.post(`/bidding/${id}/end-round`),
  leaderboard: (id, round) => api.get(`/bidding/${id}/leaderboard`, { params: round ? { round } : {} }),
  placeBid: (token, amount) => api.post(`/bidding/bid/${token}`, { amount }),
};

// ── Evaluations API ─────────────────────────────────────────
export const evaluationsAPI = {
  list: (params) => api.get('/evaluations', { params }),
  get: (id) => api.get(`/evaluations/${id}`),
  create: (data) => api.post('/evaluations', data),
  score: (id, data) => api.post(`/evaluations/${id}/score`, data),
  finalize: (id) => api.post(`/evaluations/${id}/finalize`),
};

// ── Purchase Orders API (Stage 9) ───────────────────────────
export const posAPI = {
  list: (params) => api.get('/purchase-orders', { params }),
  stats: () => api.get('/purchase-orders/stats'),
  get: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.patch(`/purchase-orders/${id}`, data),
  approve: (id, data) => api.post(`/purchase-orders/${id}/approve`, data),
  reject: (id, data) => api.post(`/purchase-orders/${id}/reject`, data),
  cancel: (id) => api.post(`/purchase-orders/${id}/cancel`),
};

// ── Reports API (Stage 11) ──────────────────────────────────
export const reportsAPI = {
  dashboard: (params) => api.get('/reports/dashboard', { params }),
  vendors: (params) => api.get('/reports/vendors', { params }),
  rfqs: (params) => api.get('/reports/rfqs', { params }),
  spend: (params) => api.get('/reports/spend', { params }),
  auditSummary: (params) => api.get('/reports/audit-summary', { params }),
};

// ── Vendors API ─────────────────────────────────────────────
export const vendorsAPI = {
  list:       (params) => api.get('/vendors', { params }),
  stats:      ()       => api.get('/vendors/stats'),
  get:        (id)     => api.get(`/vendors/${id}`),
  approve:    (id, data) => api.post(`/vendors/${id}/approve`, data),
  reject:     (id, data) => api.post(`/vendors/${id}/reject`, data),
  suspend:    (id, data) => api.post(`/vendors/${id}/suspend`, data),
  delete:     (id)     => api.delete(`/vendors/${id}`),
  compliance: (id)     => api.get(`/vendors/${id}/compliance`),
  performance:(id, params) => api.get(`/vendors/${id}/performance`, { params }),
  register:   (data)   => api.post('/vendors/register', data),
};

// ── Backup API ───────────────────────────────────────────────
export const backupAPI = {
  list:     (params) => api.get('/backup', { params }),
  create:   (data)   => api.post('/backup', data),
  get:      (id)     => api.get(`/backup/${id}`),
  download: (id)     => api.get(`/backup/${id}/download`, { responseType: 'blob' }),
  restore:  (id, data) => api.post(`/backup/${id}/restore`, data),
  confirm:  (jobId, token) => api.post(`/backup/restore/${jobId}/confirm`, { confirmationToken: token }),
  purge:    ()       => api.post('/backup/purge'),
};

// ── AI API (commercial module) ───────────────────────────────
export const aiAPI = {
  providers:     { list: () => api.get('/ai/providers'), create: (d) => api.post('/ai/providers', d), update: (id,d) => api.patch(`/ai/providers/${id}`,d), delete: (id) => api.delete(`/ai/providers/${id}`), test: (id) => api.post(`/ai/providers/${id}/test`) },
  insights:      { list: (p) => api.get('/ai/insights',{params:p}), get: (id) => api.get(`/ai/insights/${id}`), create: (d) => api.post('/ai/insights',d) },
  chat:          { list: () => api.get('/ai/chat'), get: (id) => api.get(`/ai/chat/${id}`), send: (d) => api.post('/ai/chat',d) },
  context:       () => api.get('/ai/context'),
};

// ── System Settings API ──────────────────────────────────────
export const settingsAPI = {
  getAll:    ()           => api.get('/settings'),
  get:       (category)  => api.get(`/settings/${category}`),
  update:    (category, data) => api.patch(`/settings/${category}`, data),
  testEmail: ()           => api.post('/settings/email/test'),
};

// ── Setup Wizard API (first-run only) ────────────────────────
export const setupAPI = {
  status:     () => api.get('/setup/status'),
  initialize: (data) => api.post('/setup/initialize', data),
};


// ── Compatibility helper — thin wrapper matching the old fetch-style signature
// Allows pages to call: await apiCall('/path', { method:'POST', body: JSON.stringify(data) })
// while going through the axios interceptor (token refresh, auth headers)
export async function apiCall(path, opts = {}) {
  const method = (opts.method || 'GET').toLowerCase();
  const body   = opts.body ? JSON.parse(opts.body) : undefined;
  const config = body ? { data: body } : {};
  const response = await api({ method, url: path, ...config });
  return response.data;
}
