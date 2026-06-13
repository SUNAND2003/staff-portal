/**
 * Format a Date as "YYYY-MM-DD" using IST (Asia/Kolkata) local time.
 * Avoids UTC rollover: 10:23 AM IST = 04:53 AM UTC so toISOString()
 * would report the previous calendar day.
 */
const toLocalDateStr = (d = new Date()) => {
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y   = ist.getFullYear();
  const m   = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Returns today's date string as "YYYY-MM-DD" in IST
 */
const todayStr = () => toLocalDateStr();

/**
 * Convert a Date to "YYYY-MM-DD" in IST
 */
const toDateStr = (date) => toLocalDateStr(new Date(date));

/**
 * Count working days between two dates (inclusive), Mon-Fri
 */
const countWorkingDays = (start, end) => {
  let count = 0;
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Generate array of date strings for a month
 */
const getDatesInMonth = (year, month) => {
  const dates = [];
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
};

/**
 * Get start and end of week containing the given date
 */
const getWeekRange = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: toDateStr(start),
    end: toDateStr(end),
  };
};

module.exports = { todayStr, toDateStr, countWorkingDays, getDatesInMonth, getWeekRange };