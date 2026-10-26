// ─── Real Backend API ─────────────────────────────────────────────────────────
// VITE_API_URL is baked in at build time (see vite.config.js for the guard).
// Strip trailing slashes: ".../api/" + "/auth/login" would otherwise produce
// "/api//auth/login" and the backend would answer 404 "Route not found".
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

const getToken = () => {
  try {
    const state = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    return state?.state?.token || null;
  } catch {
    return null;
  }
};

const request = async (method, path, body = null, isFormData = false) => {
  const token = getToken();

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const options = {
    method,
    headers,
    ...(body && { body: isFormData ? body : JSON.stringify(body) }),
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));

    // Handle authentication errors (401)
    if (res.status === 401) {
      if (token) {
        // An authenticated request was rejected -> the session really expired.
        // Clear auth and send the user back to the login screen.
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error(data.message || 'Session expired. Please login again.');
      }

      // No token was sent, so this is an unauthenticated call — most commonly a
      // failed login attempt. Show the server's real message ("Invalid username
      // or password.") instead of wiping state and reloading the page, which is
      // what used to happen and made every auth error look like a blank flash.
      throw new Error(data.message || 'Invalid username or password.');
    }

    // Handle authorization errors (403)
    if (res.status === 403) {
      throw new Error(data.message || 'Access denied. You do not have permission.');
    }

    // Handle other error responses — the backend's own message is shown verbatim
    // (e.g. "Route not found", "Database is not connected yet").
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    // A TypeError from fetch means the request never got a response: the server
    // was unreachable, the URL is wrong, or the response was blocked by CORS.
    // Report that accurately (and log the exact target so it can be diagnosed)
    // instead of labelling every failure a generic network problem.
    if (
      error instanceof TypeError &&
      /fetch|network|load failed/i.test(error.message || '')
    ) {
      const host = BASE_URL.replace(/^https?:\/\//, '').split('/')[0];
      console.error(`API request failed: ${method} ${BASE_URL}${path}`, error);
      throw new Error(
        `Network error: the server at ${host} could not be reached. ` +
          'Please check your connection and try again.',
        { cause: error }
      );
    }
    throw error;
  }
};

const get    = (path)         => request('GET',    path);
const post   = (path, body)   => request('POST',   path, body);
const patch  = (path, body)   => request('PATCH',  path, body);
const del    = (path)         => request('DELETE', path);
const upload = (path, form)   => request('POST',   path, form, true);

// ─── Keep mock data exports so existing imports don't break ───────────────────
export { generateId, mockDelay } from '../utils/helpers';

export const generateWeeklyData  = () => [];
export const generateMonthlyData = () => [];

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
  // credentials: { username, password, role? }
  login: (credentials) => post('/auth/login', credentials),

  logout: () => post('/auth/logout'),

  getMe: () => get('/auth/me'),

  forgotPassword: (email) => post('/auth/forgot-password', { email }),

  changePassword: (currentPassword, newPassword) =>
    patch('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Punch API ────────────────────────────────────────────────────────────────
export const punchAPI = {
  // Record a punch event
  recordPunch: (data) => post('/attendance/punch', data),

  // Get today's punches for current user
  getTodayPunches: () => get('/attendance/punches/today'),

  // Get all punches for current user
  getMyPunches: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/attendance/punches/my${params ? '?' + params : ''}`);
  },

  // Get all live punches for today (admin/manager)
  getLivePunches: (limit = 50, skip = 0) => 
    get(`/attendance/punches/live?limit=${limit}&skip=${skip}`),

  // Get punches for specific employee (admin/manager)
  getEmployeePunches: (employeeId, date = null) => {
    const dateParam = date ? `&date=${date}` : '';
    return get(`/attendance/punches/employee/${employeeId}?limit=50${dateParam}`);
  },

  // Get all punches with pagination (admin/manager)
  getAllPunches: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/attendance/punches/all${params ? '?' + params : ''}`);
  },
};

// ─── Attendance API ───────────────────────────────────────────────────────────

export const attendanceAPI = {
  checkIn: () => post('/attendance/checkin'),

  checkOut: () => post('/attendance/checkout'),

  breakIn:  () => post('/attendance/break/start'),
  breakOut: () => post('/attendance/break/end'),

  // alias used in some components
  breakStart: () => post('/attendance/break/start'),
  breakEnd:   () => post('/attendance/break/end'),

  getToday: () => get('/attendance/today'),

  // filter: { month, year } or { from, to }
  getMyAttendance: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/attendance/my${params ? '?' + params : ''}`);
  },

  // Admin/Manager — filter: { date, department }
  getAllAttendance: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/attendance/all${params ? '?' + params : ''}`);
  },

  // filter: { month, year, employeeId }
  getReport: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/attendance/report${params ? '?' + params : ''}`);
  },
};

// ─── Task API ─────────────────────────────────────────────────────────────────

export const taskAPI = {
  // filter: { status, priority }
  getMyTasks: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/tasks/my${params ? '?' + params : ''}`);
  },

  // Admin/Manager — filter: { status, priority, assignedTo, department }
  getAllTasks: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/tasks/all${params ? '?' + params : ''}`);
  },

  getById: (id) => get(`/tasks/${id}`),

  // data: { title, description, assignedTo, priority, dueDate, tags }
  createTask: (data) => post('/tasks', data),

  // data: { status, progress, title, description, priority, dueDate }
  updateTask: (id, data) => patch(`/tasks/${id}`, data),

  deleteTask: (id) => del(`/tasks/${id}`),
};

// ─── Leave API ────────────────────────────────────────────────────────────────

export const leaveAPI = {
  // filter: { status, type }
  getMyLeaves: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/leaves/my${params ? '?' + params : ''}`);
  },

  getLeaveBalance: () => get('/leaves/balance'),

  // Admin/Manager — filter: { status, type, department }
  getAllLeaves: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/leaves/all${params ? '?' + params : ''}`);
  },

  getById: (id) => get(`/leaves/${id}`),

  // data: { type, startDate, endDate, reason }
  applyLeave: (data) => post('/leaves', data),

  cancelLeave: (id) => patch(`/leaves/${id}/cancel`),

  // note is optional
  approveLeave: (id, note = '') => patch(`/leaves/${id}/approve`, { note }),

  rejectLeave: (id, note = '') => patch(`/leaves/${id}/reject`, { note }),
};

// ─── Employee API ─────────────────────────────────────────────────────────────

export const employeeAPI = {
  // filter: { department, role, status, search }
  getAll: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/employees${params ? '?' + params : ''}`);
  },

  getById: (id) => get(`/employees/${id}`),

  // data: { username, password, name, department, role, email, designation, phone }
  create: (data) => post('/employees', data),

  // data: any updatable fields
  update: (id, data) => patch(`/employees/${id}`, data),

  toggleStatus: (id) => patch(`/employees/${id}/toggle-status`),

  resetPassword: (id, newPassword) => patch(`/employees/${id}/reset-password`, { newPassword }),

  delete: (id) => del(`/employees/${id}`),

  // filter: { month, year }
  getAttendanceSummary: (id, filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/employees/${id}/attendance-summary${params ? '?' + params : ''}`);
  },
};

// ─── Work Log API ─────────────────────────────────────────────────────────────

export const workLogAPI = {
  getToday: () => get('/worklogs/today'),

  // filter: { from, to, date }
  getMyLogs: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/worklogs${params ? '?' + params : ''}`);
  },

  // Admin/Manager
  getAllLogs: (filter = {}) => {
    const params = new URLSearchParams(filter).toString();
    return get(`/worklogs/all${params ? '?' + params : ''}`);
  },

  // data: { title, description, tags }
  addLog: (data) => post('/worklogs', data),

  endLog: (id) => patch(`/worklogs/${id}/end`),

  deleteLog: (id) => del(`/worklogs/${id}`),
};

// ─── Reports API ──────────────────────────────────────────────────────────────

export const reportsAPI = {
  // filter: 'today' | 'week' | 'month' | 'custom'
  // params: { filter, from, to, employeeId }
  get: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/reports${query ? '?' + query : ''}`);
  },

  // Admin dashboard stats
  getAdminStats: () => get('/reports/admin'),
};

// ─── Profile API ──────────────────────────────────────────────────────────────

export const profileAPI = {
  get: () => get('/profile'),

  // data: { name, email, phone, address, bio, designation, skills, emergencyContact }
  update: (data) => patch('/profile', data),

  // avatarFile: File object
  uploadAvatar: (avatarFile) => {
    const form = new FormData();
    form.append('avatar', avatarFile);
    return upload('/profile/avatar', form);
  },

  deleteAvatar: () => del('/profile/avatar'),
};

// ─── Config API ───────────────────────────────────────────────────────────────

export const configAPI = {
  getWorkingHours: () => get('/config/working-hours'),

  // data: { punchInTime, punchOutTime, lateThresholdMinutes, breakDurationMinutes, notes }
  updateWorkingHours: (data) => patch('/config/working-hours', data),
};

// ─── Keep MOCK exports so any component that imports them doesn't crash ────────
export const MOCK_USER      = {};
export const MOCK_EMPLOYEES = [];
export const MOCK_TASKS     = [];
export const MOCK_LEAVES    = [];
export const MOCK_WORK_LOGS = [];