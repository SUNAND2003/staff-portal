import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { punchAPI } from "../services/api";
import {
  getAttendanceReport, getLeaveRequests,
  approveLeaveRequest, rejectLeaveRequest,
  getWorkTasks, mapAttendanceRecord, mapLeave,
} from "../utils/adminData";
import {
  LogOut, TrendingUp, Menu, CheckCircle2,
  CalendarDays, Briefcase, RefreshCw, XCircle, Clock,
} from "lucide-react";

const STATUS_STYLE = {
  Present:  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  Absent:   { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500"     },
  Late:     { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
  "On Leave":{ bg: "bg-blue-100",  text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Validate admin role on component mount and refresh
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [attendance,   setAttendance]   = useState([]);
  const [leaves,       setLeaves]       = useState([]);
  const [workTasks,    setWorkTasks]    = useState([]);
  const [lastSync,     setLastSync]     = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading,      setLoading]      = useState(true);
  const [livePunch,    setLivePunch]    = useState([]);

  const refreshLivePunches = useCallback(async () => {
    try {
      const data = await punchAPI.getLivePunches(50, 0);
      setLivePunch(data.punches || []);
    } catch (error) {
      console.error("Error fetching live punches:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [att, lvs, tasks] = await Promise.all([
        getAttendanceReport(),
        getLeaveRequests(),
        getWorkTasks(),
        refreshLivePunches(),
      ]);
      setAttendance((att || []).map(mapAttendanceRecord));
      setLeaves((lvs || []).map(mapLeave));
      setWorkTasks(tasks || []);
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Admin refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, [refreshLivePunches]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh every 30 seconds for live feel
  useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Poll for live punches every 5 seconds
  useEffect(() => {
    const id = setInterval(refreshLivePunches, 5000);
    return () => clearInterval(id);
  }, [refreshLivePunches]);

  // Listen for local punch events (from same browser)
  useEffect(() => {
    const handlePunch = (e) => {
      refreshLivePunches();
    };
    window.addEventListener("punch", handlePunch);
    return () => window.removeEventListener("punch", handlePunch);
  }, [refreshLivePunches]);

  const presentCount  = attendance.filter((r) => r.status === "Present").length;
  const absentCount   = attendance.filter((r) => r.status === "Absent").length;
  const lateCount     = attendance.filter((r) => r.isLate).length;
  const onLeaveCount  = leaves.filter((l) => l.status === "Approved").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const runningTasks  = workTasks.filter((t) => t.status === "in_progress").length;
  const doneTasks     = workTasks.filter((t) => t.status === "completed").length;

  const STATS = [
    { label: "Present Today",  value: String(presentCount),  icon: <CheckCircle2 size={22} />, color: "bg-emerald-100 text-emerald-700", trend: `of ${attendance.length} employees` },
    { label: "Absent Today",   value: String(absentCount),   icon: <XCircle size={22} />,      color: "bg-red-100 text-red-700",         trend: `${lateCount} arrived late`         },
    { label: "Approved Leave", value: String(onLeaveCount),  icon: <CalendarDays size={22} />, color: "bg-blue-100 text-blue-700",       trend: `${pendingLeaves} pending approval` },
    { label: "Running Tasks",  value: String(runningTasks),  icon: <Briefcase size={22} />,    color: "bg-purple-100 text-purple-700",   trend: `${doneTasks} completed`            },
  ];

  const filtered = filterStatus === "All" ? attendance : attendance.filter((r) => r.status === filterStatus);

  const handleLeaveAction = async (id, action) => {
    try {
      if (action === "Approved") await approveLeaveRequest(id);
      else await rejectLeaveRequest(id);
      await refresh();
    } catch (e) {
      console.error("Leave action error:", e);
    }
  };

  const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-black px-6 py-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-white md:hidden" onClick={() => setMobileOpen(true)}><Menu size={24} /></button>
            </div>
            <div className="flex items-center gap-4">
              {lastSync && (
                <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 backdrop-blur-md sm:flex">
                  <RefreshCw size={13} /> {lastSync}
                </div>
              )}
              <button onClick={refresh} className="rounded-xl bg-white/10 p-2 text-white transition-all hover:bg-white/20">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-white">{user?.name}</p>
                <p className="text-xs text-white/60">Administrator</p>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mx-auto w-full max-w-7xl p-5 md:p-7">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900">Good Morning, {user?.name} 👋</h2>
            <p className="mt-2 text-sm text-gray-500">Here's what's happening today.</p>
          </div>

          {/* STATS */}
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-[30px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{s.label}</p>
                    <h3 className="mt-3 text-4xl font-black text-gray-900">{s.value}</h3>
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-400"><TrendingUp size={12} />{s.trend}</p>
                  </div>
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${s.color}`}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* LIVE PUNCH DATA */}
          {livePunch.length > 0 && (
            <div className="mb-8 overflow-hidden rounded-[32px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm backdrop-blur-md">
              <div className="border-b border-blue-100 px-6 py-5">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-blue-600" />
                  <h3 className="text-2xl font-black text-gray-900">Live Punch Activity</h3>
                </div>
                <p className="mt-1 text-sm text-gray-500">Real-time attendance updates</p>
              </div>
              <div className="max-h-64 divide-y divide-blue-100 overflow-y-auto">
                {livePunch.map((entry) => {
                  const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  const isCheckIn = entry.action === "Punch In";
                  const isCheckOut = entry.action === "Punch Out";
                  const isBreakStart = entry.action === "Break Start";
                  const isBreakEnd = entry.action === "Break End";
                  
                  let bgColor = "bg-blue-50";
                  let iconColor = "text-blue-600";
                  if (isCheckIn) { bgColor = "bg-emerald-50"; iconColor = "text-emerald-600"; }
                  else if (isCheckOut) { bgColor = "bg-red-50"; iconColor = "text-red-600"; }
                  else if (isBreakStart || isBreakEnd) { bgColor = "bg-amber-50"; iconColor = "text-amber-600"; }
                  
                  return (
                    <div key={entry._id} className={`flex items-center justify-between px-6 py-4 ${bgColor} transition-all hover:bg-opacity-75`}>
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconColor} bg-white`}>
                          {isCheckIn && <CheckCircle2 size={18} />}
                          {isCheckOut && <XCircle size={18} />}
                          {(isBreakStart || isBreakEnd) && <Clock size={18} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{entry.employeeName}</p>
                          <p className="text-xs text-gray-600">{entry.action} · {entry.employeeId}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">{timestamp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ATTENDANCE TABLE */}
          <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm backdrop-blur-md">
            <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-black text-gray-900">Attendance Report</h3>
                <p className="mt-1 text-sm text-gray-500">Daily employee attendance overview</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["All", "Present", "Late", "Absent", "On Leave"].map((status) => (
                  <button key={status} onClick={() => setFilterStatus(status)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${filterStatus === status ? "bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg" : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"}`}>
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    {["Employee", "Employee ID", "Punch In", "Punch Out", "Hours", "Status"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={6} className="py-16 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-16 text-center text-sm text-gray-400">No attendance records found.</td></tr>
                  ) : filtered.map((r, i) => {
                    const st = STATUS_STYLE[r.status] || STATUS_STYLE["Absent"];
                    return (
                      <tr key={i} className="transition-all hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#111827] to-[#374151] text-xs font-bold text-white shadow-md">
                              {r.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                            </div>
                            <span className="text-sm font-bold text-gray-900">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4"><span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{r.id || "—"}</span></td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-700">{r.checkIn}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-700">{r.checkOut}</td>
                        <td className="px-5 py-4"><span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-gray-700">{r.hours}</span></td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${st.bg} ${st.text} ${st.border}`}>
                            <span className={`h-2 w-2 rounded-full ${st.dot}`} />{r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PENDING LEAVES */}
          {leaves.filter(l => l.status === "Pending").length > 0 && (
            <div className="mt-6 overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <h3 className="text-2xl font-black text-gray-900">Pending Leave Requests</h3>
                <p className="mt-1 text-sm text-gray-500">{leaves.filter(l => l.status === "Pending").length} awaiting your approval</p>
              </div>
              <div className="divide-y divide-gray-100">
                {leaves.filter(l => l.status === "Pending").map((l) => (
                  <div key={l.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{l.name} <span className="font-normal text-gray-400">({l.employeeId})</span></p>
                      <p className="text-xs text-gray-500">{l.type} · {l.startDate} – {l.endDate} · {l.days} day(s)</p>
                      <p className="mt-1 text-xs text-gray-400 italic">"{l.reason}"</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLeaveAction(l.id, "Approved")} className="rounded-xl bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-200 transition-all">Approve</button>
                      <button onClick={() => handleLeaveAction(l.id, "Rejected")} className="rounded-xl bg-red-100 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-200 transition-all">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
