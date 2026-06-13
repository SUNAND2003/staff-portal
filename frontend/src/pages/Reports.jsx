// src/pages/Reports.jsx
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import useAuthStore from "../store/authStore";
import { attendanceAPI, reportsAPI } from "../services/api";
import { mapAttendanceRecord } from "../utils/adminData";
import {
  Search, Activity, Users, Clock3, Download,
  Radio, ChevronDown, UserCheck, Coffee,
  Calendar, CheckSquare, TrendingUp, AlertCircle,
  BarChart2, Clock, Award, Zap,
} from "lucide-react";

// ─── Style maps ───────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  working:     { label: "Working",     cls: "bg-emerald-100 text-emerald-700" },
  on_break:    { label: "On Break",    cls: "bg-amber-100 text-amber-700"     },
  checked_out: { label: "Checked Out", cls: "bg-slate-100 text-slate-600"     },
  absent:      { label: "Absent",      cls: "bg-red-100 text-red-600"         },
  on_leave:    { label: "On Leave",    cls: "bg-purple-100 text-purple-700"   },
};

const TABLE_STATUS_STYLE = {
  Present:    "bg-emerald-100 text-emerald-700",
  "On Break": "bg-amber-100 text-amber-700",
  Late:       "bg-amber-100 text-amber-700",
  "On Leave": "bg-purple-100 text-purple-700",
  Absent:     "bg-slate-100 text-slate-500",
};

const TASK_STATUS_STYLE = {
  completed:   "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  pending:     "bg-amber-100 text-amber-700",
  on_hold:     "bg-slate-100 text-slate-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const localTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toLocalDay = (iso) => {
  if (!iso) return null;
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
};

const passesDateFilter = (r, filterType, startDate, endDate) => {
  const rawDate = r.rawDate;
  if (!rawDate) return true;
  const recordDateStr =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
      ? rawDate.slice(0, 10)
      : new Date(rawDate).toLocaleDateString("en-CA");
  const todayStr = localTodayStr();
  if (filterType === "today") return recordDateStr === todayStr;
  const rd = toLocalDay(rawDate);
  const today = toLocalDay(todayStr);
  if (filterType === "week") {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    return rd >= from && rd <= today;
  }
  if (filterType === "month") {
    const from = new Date(today); from.setDate(today.getDate() - 29);
    return rd >= from && rd <= today;
  }
  if (filterType === "custom" && startDate && endDate) {
    const from = toLocalDay(startDate);
    const to   = toLocalDay(endDate);
    if (to) to.setHours(23, 59, 59, 999);
    return rd >= from && rd <= to;
  }
  return true;
};

const unwrap = (data, ...keys) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data[k])) return data[k];
  return [];
};

const buildFilter = (filterType, startDate, endDate) => {
  if (filterType === "today")  return { filter: "today" };
  if (filterType === "week")   return { filter: "week" };
  if (filterType === "month")  return { filter: "month" };
  if (filterType === "custom" && startDate && endDate)
    return { filter: "custom", from: startDate, to: endDate };
  return { filter: "month" };
};

const buildAttendanceFilter = (filterType, startDate, endDate) => {
  if (filterType === "today") return { date: localTodayStr() };
  const now = new Date();
  if (filterType === "week") {
    const from = new Date(now); from.setDate(now.getDate() - 6);
    return { from: from.toLocaleDateString("en-CA"), to: now.toLocaleDateString("en-CA") };
  }
  if (filterType === "month") {
    const from = new Date(now); from.setDate(now.getDate() - 29);
    return { from: from.toLocaleDateString("en-CA"), to: now.toLocaleDateString("en-CA") };
  }
  if (filterType === "custom" && startDate && endDate)
    return { from: startDate, to: endDate };
  return {};
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, bg, accent }) {
  return (
    <div className="rounded-[30px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <h2 className="mt-2 text-4xl font-black text-gray-900">{value}</h2>
          {sub && <p className="mt-2 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bg}`}>
          <Icon size={24} />
        </div>
      </div>
      {accent !== undefined && (
        <div className="mt-4">
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-[#111827] to-[#374151] transition-all duration-700"
              style={{ width: `${Math.min(100, accent)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-indigo-100 text-xs font-bold text-indigo-700">
      {initials(name)}
    </div>
  );
}

// Simple bar chart using divs (no charting library needed)
function BarChart({ data, maxVal, color = "bg-[#111827]" }) {
  if (!data || data.length === 0) return (
    <div className="flex h-32 items-center justify-center text-sm text-gray-300">No data</div>
  );
  const max = maxVal || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative w-full" style={{ height: "96px" }}>
            <div
              className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ${color} opacity-90`}
              style={{ height: `${Math.max(4, (d.value / max) * 96)}px` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[9px] font-bold text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Employee Report View ──────────────────────────────────────────────────────
function EmployeeReportView({ filterType, startDate, endDate }) {
  const { user } = useAuthStore();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport();
  }, [filterType, startDate, endDate]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = buildFilter(filterType, startDate, endDate);
      const data = await reportsAPI.get(params);
      setReport(data);
    } catch (e) {
      console.error("Employee report error:", e);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!report) return;
    setExporting(true);
    try {
      const lines = [
        `Employee Report — ${user?.name || ""}`,
        `Period: ${filterType}${startDate ? ` (${startDate} to ${endDate})` : ""}`,
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        "",
        "=== ATTENDANCE SUMMARY ===",
        `Total Days,${report.totalDays}`,
        `Present Days,${report.presentDays}`,
        `Absent Days,${report.absentDays}`,
        `Late Days,${report.lateDays}`,
        `Total Hours,${report.totalHours}h`,
        `Avg Hours/Day,${report.avgHours}h`,
        `Break Time,${report.totalBreak}h`,
        `Attendance %,${report.attendancePercent}%`,
        `Leave Days,${report.leaveDays}`,
        "",
        "=== TASK SUMMARY ===",
        `Total Tasks,${report.taskStats?.total}`,
        `Completed,${report.taskStats?.completed}`,
        `In Progress,${report.taskStats?.inProgress}`,
        `Pending,${report.taskStats?.pending}`,
        `On Hold,${report.taskStats?.onHold}`,
        "",
        "=== WEEKLY HOURS ===",
        "Day,Work Hours,Break Hours",
        ...(report.weeklyData || []).map((d) => `${d.day},${d.work},${d.break}`),
      ];
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `my-report-${filterType}-${localTodayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
    </div>
  );

  if (!report) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle size={48} className="mb-4 text-gray-300" />
      <p className="font-semibold text-gray-500">Could not load report</p>
      <button onClick={loadReport} className="mt-4 rounded-2xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white">Retry</button>
    </div>
  );

  const attendancePercent = report.attendancePercent ?? 0;
  const taskComplete = report.taskStats?.total > 0
    ? Math.round((report.taskStats.completed / report.taskStats.total) * 100)
    : 0;

  const statCards = [
    {
      label: "Days Present",
      value: `${report.presentDays}/${report.totalDays}`,
      sub: `${report.lateDays} late arrival${report.lateDays !== 1 ? "s" : ""}`,
      icon: Calendar,
      bg: "bg-emerald-100 text-emerald-600",
      accent: attendancePercent,
    },
    {
      label: "Total Hours",
      value: `${report.totalHours}h`,
      sub: `avg ${report.avgHours}h/day`,
      icon: Clock,
      bg: "bg-indigo-100 text-indigo-600",
      accent: Math.min(100, (report.avgHours / 8) * 100),
    },
    {
      label: "Attendance",
      value: `${attendancePercent}%`,
      sub: `${report.absentDays} absent day${report.absentDays !== 1 ? "s" : ""}`,
      icon: TrendingUp,
      bg: attendancePercent >= 80 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600",
      accent: attendancePercent,
    },
    {
      label: "Tasks Done",
      value: `${report.taskStats?.completed ?? 0}/${report.taskStats?.total ?? 0}`,
      sub: `${report.taskStats?.inProgress ?? 0} in progress`,
      icon: CheckSquare,
      bg: "bg-blue-100 text-blue-600",
      accent: taskComplete,
    },
  ];

  const weekBarData = (report.weeklyData || []).map((d) => ({ label: d.day, value: d.work }));
  const monthBarData = (report.monthlyData || []).map((d) => ({ label: String(d.date), value: d.hours }));

  return (
    <div className="space-y-8">

      {/* Export button row */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50"
        >
          <Download size={15} />
          {exporting ? "Exporting..." : "Export Report CSV"}
        </button>
      </div>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, sub, icon, bg, accent }) => (
          <StatCard key={label} label={label} value={value} sub={sub} icon={icon} bg={bg} accent={accent} />
        ))}
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Weekly hours chart */}
        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900">Weekly Hours</h3>
              <p className="text-sm text-gray-400">Average work hours by day of week</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <BarChart2 size={18} />
            </div>
          </div>
          <BarChart data={weekBarData} maxVal={10} color="bg-indigo-500" />
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>0h</span>
            <span className="font-semibold text-gray-600">Target: 8h/day</span>
            <span>10h+</span>
          </div>
        </div>

        {/* Monthly daily hours */}
        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900">Daily Hours</h3>
              <p className="text-sm text-gray-400">Hours worked per day this period</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Activity size={18} />
            </div>
          </div>
          <BarChart data={monthBarData.slice(0, 30)} maxVal={12} color="bg-emerald-500" />
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>0h</span>
            <span className="font-semibold text-gray-600">Break time: {report.totalBreak}h total</span>
            <span>12h+</span>
          </div>
        </div>
      </div>

      {/* Attendance breakdown + Task breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Attendance breakdown */}
        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Attendance Breakdown</h3>
              <p className="text-sm text-gray-400">For selected period</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Present",      value: report.presentDays, total: report.totalDays, color: "bg-emerald-500" },
              { label: "Absent",       value: report.absentDays,  total: report.totalDays, color: "bg-red-400"     },
              { label: "Late Arrivals",value: report.lateDays,    total: report.totalDays, color: "bg-amber-400"   },
              { label: "Leave Days",   value: report.leaveDays,   total: report.totalDays, color: "bg-purple-400"  },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">{label}</span>
                    <span className="font-black text-gray-900">{value} <span className="font-normal text-gray-400">days ({pct}%)</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
            <Award size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              Attendance rate: <span className={`font-black ${attendancePercent >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{attendancePercent}%</span>
            </span>
          </div>
        </div>

        {/* Task breakdown */}
        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <CheckSquare size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Task Summary</h3>
              <p className="text-sm text-gray-400">Your assigned tasks</p>
            </div>
          </div>
          {(report.taskStats?.total ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckSquare size={36} className="mb-3 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">No tasks assigned for this period</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {[
                  { label: "Completed",   value: report.taskStats.completed,  color: "bg-emerald-500", badge: TASK_STATUS_STYLE.completed   },
                  { label: "In Progress", value: report.taskStats.inProgress, color: "bg-blue-500",    badge: TASK_STATUS_STYLE.in_progress },
                  { label: "Pending",     value: report.taskStats.pending,    color: "bg-amber-400",   badge: TASK_STATUS_STYLE.pending     },
                  { label: "On Hold",     value: report.taskStats.onHold,     color: "bg-slate-400",   badge: TASK_STATUS_STYLE.on_hold     },
                ].map(({ label, value, color, badge }) => {
                  const pct = report.taskStats.total > 0 ? Math.round((value / report.taskStats.total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold ${badge}`}>{label}</span>
                        </div>
                        <span className="font-black text-gray-900">{value} <span className="font-normal text-gray-400">({pct}%)</span></span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                <Zap size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Completion rate: <span className={`font-black ${taskComplete >= 70 ? "text-emerald-600" : "text-amber-600"}`}>{taskComplete}%</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly data table */}
      {report.monthlyData && report.monthlyData.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h3 className="text-xl font-black text-gray-900">Daily Attendance Log</h3>
            <p className="mt-1 text-sm text-gray-400">{report.monthlyData.length} days in selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[400px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  {["Day", "Hours Worked", "Status"].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.monthlyData.map((d, i) => (
                  <tr key={i} className="transition-all hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-gray-900">Day {d.date}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(100, (d.hours / 10) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{d.hours}h</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold capitalize ${
                        d.status === "present"   ? "bg-emerald-100 text-emerald-700" :
                        d.status === "late"      ? "bg-amber-100 text-amber-700"     :
                        "bg-slate-100 text-slate-500"
                      }`}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Report View (original) ─────────────────────────────────────────────
function AdminReportView({ filterType, startDate, endDate }) {
  const { user } = useAuthStore();
  const [reports,     setReports]     = useState([]);
  const [liveData,    setLiveData]    = useState([]);
  const [presentList, setPresentList] = useState([]);
  const [stats, setStats] = useState({
    totalEmployees: "—", todayPresent: "—", todayOnBreak: "—",
    todayAbsent: "—", pendingLeaves: "—", openTasks: "—",
  });
  const [loading, setLoading]   = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const prevCountRef = useRef(0);
  const [search, setSearch] = useState("");

  const loadAdminReport = async () => {
    try {
      const data = await reportsAPI.getAdminStats();
      if (!data) return;
      setStats({
        totalEmployees: String(data.totalEmployees ?? "—"),
        todayPresent:   String(data.todayPresent   ?? "—"),
        todayOnBreak:   String(data.todayOnBreak   ?? "—"),
        todayAbsent:    String(data.todayAbsent    ?? "—"),
        pendingLeaves:  String(data.pendingLeaves  ?? "—"),
        openTasks:      String(data.openTasks      ?? "—"),
      });
      const attendance = unwrap(data.todayAttendance || data, "todayAttendance");
      setLiveData(attendance);
      const present = attendance.filter((a) => a.checkIn && !a.checkOut);
      setPresentList(present.map(mapAttendanceRecord));
      const newCount = attendance.filter((a) => a.checkIn).length;
      if (newCount > prevCountRef.current) setLastSeen((n) => n + (newCount - prevCountRef.current));
      prevCountRef.current = newCount;
    } catch (e) { console.error("Admin report failed:", e); }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const filterParams = buildAttendanceFilter(filterType, startDate, endDate);
      const raw  = await attendanceAPI.getAllAttendance(filterParams);
      const rows = unwrap(raw, "attendance", "data", "records").map(mapAttendanceRecord);
      setReports(rows);
    } catch (e) {
      console.error("Attendance fetch failed:", e);
      setReports([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAdminReport(); loadAttendance(); }, []);
  useEffect(() => { loadAttendance(); }, [filterType, startDate, endDate]);
  useEffect(() => {
    const t1 = setInterval(loadAdminReport, 10_000);
    const t2 = setInterval(loadAttendance,  30_000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [filterType, startDate, endDate]);
  useEffect(() => {
    const handler = () => { loadAdminReport(); loadAttendance(); };
    window.addEventListener("punch", handler);
    return () => window.removeEventListener("punch", handler);
  }, []);

  const handleExport = () => {
    const exportDate = new Date().toLocaleDateString("en-IN");
    const headers = ["Date","Employee ID","Name","Department","Check In","Check Out","Hours","Status"];
    const rows = filtered.map((r) =>
      [`"${r.date || ""}"`,`"${r.id}"`,`"${r.name}"`,`"${r.department}"`,`"${r.checkIn}"`,`"${r.checkOut}"`,`"${r.hours}"`,`"${r.status}"`].join(",")
    );
    const csv = [`Export Date: ${exportDate}`, `Filter: ${filterType}`, headers.map(h=>`"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `attendance-${filterType}-${localTodayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    return (r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.department||"").toLowerCase().includes(q))
      && passesDateFilter(r, filterType, startDate, endDate);
  });

  const statCards = [
    { label: "Total Employees", value: stats.totalEmployees, sub: "",                                icon: Users,     bg: "bg-indigo-100 text-indigo-600"   },
    { label: "Present Today",   value: stats.todayPresent,   sub: `${stats.todayOnBreak} on break`, icon: UserCheck, bg: "bg-emerald-100 text-emerald-600" },
    { label: "Absent Today",    value: stats.todayAbsent,    sub: "",                                icon: Activity,  bg: "bg-red-100 text-red-600"         },
    { label: "Pending Leaves",  value: stats.pendingLeaves,  sub: `${stats.openTasks} open tasks`,  icon: Clock3,    bg: "bg-amber-100 text-amber-600"     },
  ];

  return (
    <div className="space-y-8">
      {/* STATS */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, sub, icon, bg }) => (
          <StatCard key={label} label={label} value={value} sub={sub} icon={icon} bg={bg} />
        ))}
      </section>

      {/* PRESENT + LIVE FEED */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        {/* Present Employees */}
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-emerald-500" />
                <h2 className="text-xl font-black text-gray-900">Present Now</h2>
              </div>
              <p className="mt-1 text-sm text-gray-400">{presentList.length} employee{presentList.length !== 1 ? "s" : ""} currently in</p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {presentList.filter((r) => r._raw?.status === "working").length} working
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                <Coffee size={10} />
                {presentList.filter((r) => r._raw?.status === "on_break").length} break
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 440 }}>
            {presentList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserCheck size={40} className="mb-3 text-gray-200" />
                <p className="font-semibold text-gray-400">No one is in yet</p>
                <p className="mt-1 text-xs text-gray-300">Employees appear here when they punch in</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {presentList.map((r, i) => {
                  const onBreak = r._raw?.status === "on_break";
                  return (
                    <div key={r.id || i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-slate-50 p-3 transition-all hover:bg-white hover:shadow-md">
                      <div className="relative shrink-0">
                        <Avatar name={r.name} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${onBreak ? "bg-amber-400" : "bg-emerald-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                        <p className="truncate text-xs text-gray-400">{r.department || r.id}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold ${onBreak ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {onBreak ? "Break" : "Working"}
                        </span>
                        <p className="mt-1 text-[10px] text-gray-400">{r.checkIn}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Feed */}
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Radio size={22} className="text-indigo-500" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">Live Activity Feed</h2>
                <p className="mt-1 text-sm text-gray-400">Today's attendance · refreshes every 10s</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastSeen > 0 && (
                <button onClick={() => setLastSeen(0)} className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700">+{lastSeen} new</button>
              )}
              <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
          </div>
          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: 440 }}>
            {liveData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Radio size={42} className="mb-4 text-gray-300" />
                <p className="font-semibold text-gray-500">No attendance yet today</p>
                <p className="mt-1 text-xs text-gray-400">Employees appear here when they punch in</p>
              </div>
            ) : (
              [...liveData].filter((a) => a.checkIn).sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn)).map((item, i) => {
                const empName = item.employee?.name       || item.employeeName || "—";
                const empDept = item.employee?.department || item.department   || "—";
                const empId   = item.employeeId                                || "—";
                const badge   = STATUS_BADGE[item.status] || STATUS_BADGE.absent;
                return (
                  <div key={item._id || i} className="flex items-center gap-3 px-6 py-4 transition-all hover:bg-slate-50">
                    <div className="relative shrink-0">
                      <Avatar name={empName} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${item.status === "on_break" ? "bg-amber-400" : item.checkOut ? "bg-slate-400" : "bg-emerald-500"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{empName}</p>
                      <p className="truncate text-xs text-gray-400">{empDept} · {empId}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                      <p className="mt-1 text-xs font-bold text-gray-900">{fmtTime(item.checkIn)}</p>
                      {item.checkOut && <p className="text-[10px] text-gray-400">out {fmtTime(item.checkOut)}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ATTENDANCE TABLE */}
      <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Attendance Report</h2>
            <p className="mt-1 text-sm text-gray-500">{loading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""} found`}</p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full lg:w-80">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, department…"
                className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-gray-700 outline-none transition-all focus:border-[#111827] focus:bg-white focus:shadow-lg" />
            </div>
            <button onClick={handleExport} className="flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl whitespace-nowrap">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-slate-50">
                {["Date","Employee ID","Name","Department","Check In","Check Out","Hours","Status"].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-20 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-sm text-gray-400">No records for this period.</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={`${r.id}-${i}`} className="border-b border-gray-50 transition-all hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{r.date || "—"}</td>
                    <td className="px-5 py-4"><span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{r.id}</span></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={r.name} /><span className="font-semibold text-gray-900">{r.name}</span></div></td>
                    <td className="px-5 py-4 text-gray-500">{r.department}</td>
                    <td className="px-5 py-4 font-semibold text-gray-700">{r.checkIn}</td>
                    <td className="px-5 py-4 font-semibold text-gray-700">{r.checkOut}</td>
                    <td className="px-5 py-4"><span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-gray-700">{r.hours}</span></td>
                    <td className="px-5 py-4"><span className={`rounded-xl px-3 py-1 text-xs font-bold ${TABLE_STATUS_STYLE[r.status] || "bg-slate-100 text-slate-500"}`}>{r.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [filterType, setFilterType] = useState("month");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">

        {/* HEADER */}
        <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-8 text-white shadow-2xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-black md:text-4xl">
                {isAdmin ? "Reports & Analytics" : "My Reports"}
              </h1>
              <p className="mt-2 text-white/80">
                {isAdmin
                  ? "Live attendance, present employees and productivity overview"
                  : `Attendance, tasks and performance — ${user?.name || ""}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none rounded-2xl border border-white/10 bg-white/10 py-3 pl-4 pr-10 text-sm font-semibold text-white backdrop-blur-md outline-none [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  {isAdmin && <option value="today">Today</option>}
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
              </div>
              {filterType === "custom" && (
                <div className="flex gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur-md outline-none" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur-md outline-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROLE-AWARE BODY */}
        {isAdmin
          ? <AdminReportView filterType={filterType} startDate={startDate} endDate={endDate} />
          : <EmployeeReportView filterType={filterType} startDate={startDate} endDate={endDate} />
        }

      </div>
    </DashboardLayout>
  );
}