// src/utils/adminData.js
import { attendanceAPI, leaveAPI, taskAPI, workLogAPI } from "../services/api";

export const getLiveAttendance   = () => attendanceAPI.getAllAttendance();
export const getAttendanceReport = () => attendanceAPI.getAllAttendance();
export const getLeaveRequests    = () => leaveAPI.getAllLeaves();
export const approveLeaveRequest = (id, note = "") => leaveAPI.approveLeave(id, note);
export const rejectLeaveRequest  = (id, note = "") => leaveAPI.rejectLeave(id, note);

export const updateLeaveRequest = async (id, status, note = "") => {
  if (status === "Approved")      await leaveAPI.approveLeave(id, note);
  else if (status === "Rejected") await leaveAPI.rejectLeave(id, note);
  window.dispatchEvent(new CustomEvent("leaveUpdate"));
  return leaveAPI.getAllLeaves();
};

export const onLeaveUpdate = (cb) => {
  window.addEventListener("leaveUpdate", cb);
  return () => window.removeEventListener("leaveUpdate", cb);
};

export const getWorkTasks = () => workLogAPI.getAllLogs();
export const getAllTasks   = () => taskAPI.getAllTasks();

// ── STATUS MAP ────────────────────────────────────────────────────────────────
// Attendance schema status enum: working | on_break | checked_out | absent | on_leave
const STATUS_MAP = {
  working:     "Present",
  on_break:    "On Break",
  checked_out: "Present",
  absent:      "Absent",
  on_leave:    "On Leave",
};

// ── mapAttendanceRecord ───────────────────────────────────────────────────────
// Handles two backend shapes:
//
// Shape A — populated (backend does .populate('employee')):
//   { employee: { name, department, employeeId, avatar }, employeeId, checkIn, ... }
//
// Shape B — flat (backend does NOT populate):
//   { employeeId, employeeName, department, checkIn, ... }
//
// Attendance schema stores employeeId as a denormalized String at top level.
// employee.name / employee.department only exist when populate('employee') is used.
export const mapAttendanceRecord = (r) => {
  const empObj = r.employee && typeof r.employee === "object" ? r.employee : {};

  const name       = empObj.name       || r.employeeName  || r.name       || "—";
  const department = empObj.department || r.department                    || "—";
  // employeeId is stored as String on the Attendance doc itself (denormalized)
  const empId      = r.employeeId      || empObj.employeeId               || "—";
  const avatar     = empObj.avatar     ?? r.avatar        ?? null;

  // ✅ FIX: derive a clean display status including "Late" for late check-ins
  let displayStatus = STATUS_MAP[r.status] || "Absent";
  if (r.isLate && displayStatus === "Present") displayStatus = "Late";

  return {
    id:         empId,
    name,
    department,
    avatar,

    checkIn:    r.checkIn  ? new Date(r.checkIn).toLocaleTimeString("en-IN",  { hour: "2-digit", minute: "2-digit" }) : "—",
    checkOut:   r.checkOut ? new Date(r.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—",
    // totalHours is a Number stored on the Attendance doc (set on checkOut)
    hours:      r.totalHours ? `${r.totalHours}h` : "—",
    status:     displayStatus,

    // ✅ rawDate: prefer r.date (YYYY-MM-DD string from schema) for TZ-safe filtering
    rawDate:    r.date || r.checkIn || r.createdAt || null,

    isLate:     r.isLate,
    _raw:       r,
  };
};

// ── mapLeave ──────────────────────────────────────────────────────────────────
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—";

export const mapLeave = (l) => ({
  id:         l._id,
  employee:   l.employee?.name || l.employeeName || "—",
  employeeId: l.employee?.employeeId || l.employeeId || "—",
  department: l.employee?.department || "—",
  type:       cap(l.type),
  from:       l.startDate ? new Date(l.startDate).toLocaleDateString("en-IN") : "—",
  to:         l.endDate   ? new Date(l.endDate).toLocaleDateString("en-IN")   : "—",
  days:       l.days,
  reason:     l.reason,
  status:     cap(l.status),
  _raw:       l,
});