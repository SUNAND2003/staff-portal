export const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

export const formatHours = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const formatTimeFromDate = (date) => {
  if (!date) return '--:--';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export const formatFullDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getAvatarColor = (name, colors) => {
  if (!name || !colors) return colors?.[0] || '';
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

export const calculatePercentage = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

export const isLateArrival = (checkInTime, expectedTime = '09:00') => {
  if (!checkInTime) return false;
  const [eh, em] = expectedTime.split(':').map(Number);
  const d = new Date(checkInTime);
  const checkInMinutes = d.getHours() * 60 + d.getMinutes();
  const expectedMinutes = eh * 60 + em;
  return checkInMinutes > expectedMinutes + 10;
};

export const getDaysBetween = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.abs(e - s);
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

export const getWeekDates = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const week = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    week.push(current);
  }
  return week;
};

export const getMonthDates = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
};

export const truncate = (str, n = 30) => {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
};

export const classNames = (...classes) => classes.filter(Boolean).join(' ');

export const generateId = () => Math.random().toString(36).slice(2, 10);

export const mockDelay = (ms = 800) => new Promise((res) => setTimeout(res, ms));

export const WORKING_HOURS_TARGET = 8 * 3600; // 8 hours in seconds

export const getProductivityScore = (workedSeconds) => {
  const ratio = workedSeconds / WORKING_HOURS_TARGET;
  if (ratio >= 1) return 100;
  return Math.round(ratio * 100);
};

export const getStatusLabel = (status) => {
  const labels = {
    idle: 'Not Started',
    working: 'Working',
    on_break: 'On Break',
    checked_out: 'Checked Out',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    on_leave: 'On Leave',
    half_day: 'Half Day',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
    in_progress: 'In Progress',
    completed: 'Completed',
    on_hold: 'On Hold',
  };
  return labels[status] || status;
};