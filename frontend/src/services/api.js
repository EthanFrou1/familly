import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'auth_token'
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
export const getToken = () => localStorage.getItem(TOKEN_KEY)

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  acceptInvitation: (token, password) => api.post('/auth/accept-invitation', { token, password }),
}

export const membersApi = {
  getAll: () => api.get('/members'),
  getById: (id) => api.get(`/members/${id}`),
  create: (data) => api.post('/members', data),
  update: (id, data) => api.put(`/members/${id}`, data),
  delete: (id) => api.delete(`/members/${id}`),
  updateProfilePicture: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.put(`/members/${id}/profile-picture`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  exportBirthdays: () => api.get('/members/export/birthdays.ics', { responseType: 'blob' }),
  getCalendarUrl: () => api.get('/members/export/calendar-url'),
}

export const relationsApi = {
  getAll: () => api.get('/relations'),
  getByMember: (memberId) => api.get(`/relations/member/${memberId}`),
  create: (data) => api.post('/relations', data),
  delete: (id) => api.delete(`/relations/${id}`),
}

export const photosApi = {
  getAll: (category) => api.get('/photos', { params: { category } }),
  getByMember: (memberId) => api.get(`/photos/member/${memberId}`),
  upload: (file, category, eventId, expiresAt) => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    if (eventId) form.append('eventId', eventId)
    if (expiresAt) form.append('expiresAt', expiresAt)
    return api.post('/photos', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  delete: (id) => api.delete(`/photos/${id}`),
}

export const eventsApi = {
  getAll: () => api.get('/events'),
  getUpcoming: (days = 7) => api.get('/events/upcoming', { params: { days } }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
}

export const adminApi = {
  generateInvitation: (email, role, memberId, appUrl, firstName, familyGroupName) =>
    api.post('/auth/invitations', { email, role, memberId, appUrl, firstName, familyGroupName }),
  getMemberAccountStatus: (memberId) => api.get(`/auth/member/${memberId}/account-status`),
}

export const familiesApi = {
  getAll: () => api.get('/families'),
  create: (name) => api.post('/families', { name }),
  delete: (id) => api.delete(`/families/${id}`),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (familyGroupName) => api.put('/settings', { familyGroupName }),
}

export const activityLogsApi = {
  getAll: (limit = 30) => api.get('/activity-logs', { params: { limit } }),
}

export const pushApi = {
  getVapidPublicKey: () => api.get('/push/vapid-public-key'),
  subscribe: (endpoint, p256dh, auth) => api.post('/push/subscribe', { endpoint, p256dh, auth }),
  unsubscribe: (endpoint) => api.delete('/push/unsubscribe', { data: { endpoint } }),
}

export default api
