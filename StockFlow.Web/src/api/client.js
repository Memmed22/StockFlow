import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5000/api' });

api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('stockflow_user') || 'null');
  if (user) {
    config.headers['X-User-Role'] = user.role;
    config.headers['X-User-Id'] = user.id;
  }
  return config;
});

export const productsApi = {
  getAll: (search) => api.get('/products', { params: { search } }),
  search: (query) => api.get('/products/search', { params: { query } }),
  getById: (id) => api.get(`/products/${id}`),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

export const stockApi = {
  stockIn: (data) => api.post('/stock/in', data),
  getMovements: ({ query, page = 1, pageSize = 20 } = {}) =>
    api.get('/stock/movements', { params: { query: query || undefined, page, pageSize } }),
};

export const salesApi = {
  create: (data) => api.post('/sales', data),
  getAll: (date) => api.get('/sales', { params: { date } }),
  getById: (id) => api.get(`/sales/${id}`),
};

export const returnsApi = {
  process: (data) => api.post('/returns', data),
};

export const usersApi = {
  login: (data) => api.post('/users/login', data),
  create: (data) => api.post('/users', data),
  getAll: () => api.get('/users'),
  delete: (id) => api.delete(`/users/${id}`),
};

export const customersApi = {
  getAll: (search) => api.get('/customers', { params: { search } }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  recordPayment: (id, data) => api.post(`/customers/${id}/payment`, data),
};

export const cashClosingApi = {
  openingStatus: () => api.get('/cashclosings/opening/status'),
  createOpening: (data) => api.post('/cashclosings/opening', data),
  preview: () => api.get('/cashclosings/preview'),
  create: (data) => api.post('/cashclosings', data),
  getAll: () => api.get('/cashclosings'),
};

export const reportsApi = {
  dailySales: (from, to) => api.get('/reports/daily-sales', { params: { from, to } }),
  salesPerUser: (from, to) => api.get('/reports/sales-per-user', { params: { from, to } }),
  stock: () => api.get('/reports/stock'),
  detailed: (from, to) => api.get('/reports/detailed', { params: { from, to } }),
};
