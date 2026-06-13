import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { mapAttendanceRecord } from "../utils/adminData";
import { Radio, Search, RefreshCw, Menu, Download, Calendar, User, X } from "lucide-react";
import { attendanceAPI, punchAPI, employeeAPI } from "../services/api";
const ACTION_STYLE = {
  "Punch In":    { pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Punch In"    },
  "Break Start": { pill: "bg-amber-100 text-amber-700 border border-amber-200",       dot: "bg-amber-400",   label: "Break Start" },
  "Break End":   { pill: "bg-blue-100 text-blue-700 border border-blue-200",          dot: "bg-blue-400",    label: "Break End"   },
  "Punch Out":   { pill: "bg-red-100 text-red-700 border border-red-200",             dot: "bg-red-500",     label: "Punch Out"   },
};

const STATUS_STYLE = {
  Present:  "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Late:     "bg-amber-100 text-amber-700 border border-amber-200",
  "On Leave": "bg-blue-100 text-blue-700 border border-blue-200",
  Absent:   "bg-slate-100 text-gray-500 border border-gray-200",
};

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "--";

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function AdminAttendance() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Validate admin role
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);
  const [mobileOpen,        setMobileOpen]        = useState(false);
  const [search,            setSearch]            = useState("");
  const [attendance,        setAttendance]        = useState([]);
  const [liveFeed,          setLiveFeed]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [exporting,         setExporting]         = useState(false);
  const [exportingPunch,    setExportingPunch]    = useState(false);
  const [exportAllDates,    setExportAllDates]    = useState(false);
  const [exportMode,        setExportMode]        = useState("range"); // "range" | "month" | "all"
  const [exportMonth,       setExportMonth]       = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newCount,          setNewCount]          = useState(0);
  const [flashIds,          setFlashIds]          = useState(new Set());
  const [punchExportDate,      setPunchExportDate]      = useState(todayStr());
  const [punchExportEndDate,   setPunchExportEndDate]   = useState(todayStr());
  const [allEmployees,         setAllEmployees]         = useState([]);
  const [selectedEmployee,     setSelectedEmployee]     = useState(null);   // { id, name } | null = all
  const [empSearch,            setEmpSearch]            = useState("");
  const [empDropOpen,          setEmpDropOpen]          = useState(false);
  const empDropRef = useRef(null);
  const feedRef    = useRef(null);
  const prevIds    = useRef(new Set());

  // Close employee dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (empDropRef.current && !empDropRef.current.contains(e.target)) setEmpDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

 const reload = useCallback(async () => {
  setLoading(true);
  try {
    // Attendance table — check-in/check-out summary per employee
    const records = await attendanceAPI.getAllAttendance();
    const mapped  = (records || []).map(mapAttendanceRecord);
    setAttendance(mapped);

    // Live feed — every punch event from MongoDB (works across all browsers)
    const liveData = await punchAPI.getLivePunches(100, 0);
    const feed = (liveData?.punches || []).map((p) => ({
      _id:          p._id,
      employeeId:   p.employeeId,
      employeeName: p.employeeName,
      action:       p.action,   // "Punch In" | "Break Start" | "Break End" | "Punch Out"
      timestamp:    p.timestamp,
      status:       p.status,
    }));

    // Detect new punch events since last poll
    const currentIds = new Set(feed.map((f) => f._id));
    const newIds     = [...currentIds].filter((id) => !prevIds.current.has(id));

    if (newIds.length > 0 && prevIds.current.size > 0) {
      setNewCount((n) => n + newIds.length);
      setFlashIds(new Set(newIds));
      setTimeout(() => setFlashIds(new Set()), 3000);
      if (feedRef.current) feedRef.current.scrollTop = 0;
    }

    prevIds.current = currentIds;
    setLiveFeed(feed);
  } catch (e) {
    console.error("AdminAttendance reload error:", e);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { reload(); }, [reload]);

// Load full employee list once for the dropdown (independent of today's attendance)
useEffect(() => {
  employeeAPI.getAll({ status: "active", limit: 1000 })
    .then((data) => {
      const list = (data?.employees || data || [])
        .map((e) => ({ id: e.employeeId || e._id, name: e.name }))
        .filter((e) => e.id && e.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllEmployees(list);
    })
    .catch(() => {});
}, []);

// Poll every 5 seconds — much faster live updates across browsers
useEffect(() => {
  const id = setInterval(reload, 5000);
  return () => clearInterval(id);
}, [reload]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const exportDate = new Date().toLocaleDateString("en-IN");
      const headers = ["Date", "Employee ID", "Name", "Department", "Check In", "Check Out", "Hours", "Status"];
      const rows = filtered.map((r) => [
        r.date || new Date().toLocaleDateString("en-IN"),
        r.id,
        r.name,
        r.department,
        r.checkIn,
        r.checkOut,
        r.hours,
        r.status,
      ]);
      const csv = [
        `Export Date: ${exportDate}`,
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      triggerDownload(csv, `attendance-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      console.error("Error exporting:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPunchLog = async () => {
    setExportingPunch(true);
    try {
      let queryParams;
      let headerLabel;
      let filename;
      const empTag  = selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.id})` : "All Employees";
      const empFile = selectedEmployee ? `-${selectedEmployee.id}` : "";

      if (exportMode === "all") {
        queryParams = { date: "all", limit: 100000 };
        headerLabel = `All-Time Punch Log — ${empTag}`;
        filename    = `all-time-punch-log${empFile}.csv`;
      } else if (exportMode === "month") {
        const [y, m] = exportMonth.split("-");
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const startDate = `${y}-${m}-01`;
        const endDate   = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
        queryParams = { startDate, endDate, limit: 100000 };
        const monthLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
        headerLabel = `Punch Log — ${monthLabel} — ${empTag}`;
        filename    = `punch-log-${exportMonth}${empFile}.csv`;
      } else {
        // custom date range — always send startDate/endDate
        const start = punchExportDate;
        const end   = punchExportEndDate || punchExportDate;
        queryParams = { startDate: start, endDate: end, limit: 100000 };
        if (start === end) {
          headerLabel = `Punch Log ${start} — ${empTag}`;
          filename    = `punch-log-${start}${empFile}.csv`;
        } else {
          headerLabel = `Punch Log ${start} to ${end} — ${empTag}`;
          filename    = `punch-log-${start}-to-${end}${empFile}.csv`;
        }
      }

      if (selectedEmployee) queryParams.employeeId = selectedEmployee.id;

      console.log("[PunchExport] params:", queryParams);
      const data = await punchAPI.getAllPunches(queryParams);
      console.log("[PunchExport] response:", data);

      const punches = Array.isArray(data?.punches) ? data.punches : [];

      if (punches.length === 0) {
        alert("No punch records found for the selected filter. Try a different date range or employee.");
        return;
      }

      // Pair each Punch In with its next Punch Out (same employee, same date)
      const punchOutMap = new Map();
      const sorted = [...punches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      sorted.forEach((p) => {
        if (p.action === "Punch Out") {
          const key = `${p.employeeId}|${p.date || new Date(p.timestamp).toISOString().split('T')[0]}`;
          if (!punchOutMap.has(key)) punchOutMap.set(key, p.timestamp);
        }
      });
      // Build a map of Punch In → Punch Out time by grouping per employee+date
      const sessionMap = new Map();
      sorted.forEach((p) => {
        const date = p.date || (p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : "");
        const key = `${p.employeeId}|${date}`;
        if (!sessionMap.has(key)) sessionMap.set(key, []);
        sessionMap.get(key).push(p);
      });
      const getPunchOutTime = (p) => {
        const date = p.date || (p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : "");
        const key = `${p.employeeId}|${date}`;
        const group = sessionMap.get(key) || [];
        const idx = group.indexOf(p);
        for (let i = idx + 1; i < group.length; i++) {
          if (group[i].action === "Punch Out") {
            return new Date(group[i].timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
          }
        }
        return "--";
      };

      const headers = ["Date", "Punch In Time", "Punch Out Time", "Employee ID", "Employee Name", "Action", "Status"];
      const rows = punches.map((p) => [
        p.date || (p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : "--"),
        p.timestamp ? new Date(p.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--",
        p.action === "Punch In" ? getPunchOutTime(p) : "--",
        p.employeeId || "--",
        p.employeeName || "--",
        p.action || "--",
        p.status || "--",
      ]);

      const csv = [
        headerLabel,
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        `Total Records: ${punches.length}`,
        "",
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      triggerDownload(csv, filename);
    } catch (err) {
      console.error("[PunchExport] error:", err);
      alert(`Export failed: ${err.message || "Unknown error — check browser console."}`);
    } finally {
      setExportingPunch(false);
    }
  };

  const triggerDownload = (csv, filename) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = attendance.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q)
    );
  });

  // Employee dropdown: prefer full list from API, fall back to today's attendance
  const employeeList = allEmployees.length > 0
    ? allEmployees
    : Array.from(
        new Map(attendance.map((r) => [r.id, { id: r.id, name: r.name }])).values()
      ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredEmpList = employeeList.filter((e) =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes flashBg { 0%,100%{ background:transparent } 20%{ background:rgba(71,74,207,.12) } }
        @keyframes flashRow{ 0%,100%{ background:transparent } 20%{ background:rgba(16,185,129,.08) } }
        .row-new { animation: slideIn .3s ease; }
        .row-flash { animation: flashBg 3s ease forwards; }
        .feed-box { max-height:460px; overflow-y:auto; }
        .feed-box::-webkit-scrollbar { width:4px; }
        .feed-box::-webkit-scrollbar-thumb { background:#3f3f46; border-radius:999px; }
      `}</style>

      <div className="flex min-h-screen bg-white">
        <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <div className="relative overflow-hidden bg-black border-b border-zinc-800 px-6 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="text-white md:hidden" onClick={() => setMobileOpen(true)}><Menu size={24} /></button>
                <div>
                  <h1 className="text-xl font-black text-white">Attendance</h1>
                  <p className="text-xs text-white/50">Live employee punch records</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold text-white">{user?.name}</p>
                  <p className="text-xs text-white/50">Administrator</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#111827] shadow-lg">
                  {user?.name?.[0] || "A"}
                </div>
                <button onClick={reload} className="rounded-xl border border-white/10 bg-white/10 p-3 text-white transition-all hover:bg-white/20">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="mx-auto w-full max-w-7xl space-y-6 p-5 md:p-7">

            {/* ATTENDANCE TABLE */}
            <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Attendance Report</h2>
                  <p className="mt-1 text-sm text-gray-500">Updated live — auto-refreshes every 5 seconds</p>
                </div>
                <div className="flex flex-col gap-3 w-full lg:w-auto lg:flex-row lg:items-center">
                  <div className="relative w-full lg:w-72">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search employee..."
                      className="w-full rounded-2xl border border-gray-200 bg-slate-100 py-3 pl-11 pr-4 text-sm text-gray-800 outline-none transition-all focus:border-[#111827] focus:bg-white placeholder-gray-400" />
                  </div>
                  <button
                    onClick={handleExportCSV}
                    disabled={exporting || filtered.length === 0}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Download size={16} />
                    {exporting ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-20 text-center text-sm text-gray-400">Loading attendance data...</div>
              ) : attendance.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm text-gray-400">No attendance data yet. Employees need to punch in from their dashboard.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[820px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-slate-50">
                        {["Employee ID", "Name", "Department", "Check In", "Check Out", "Hours", "Status"].map((h) => (
                          <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={r.id ?? i} className="border-b border-gray-50 transition-all hover:bg-slate-50">
                          <td className="px-5 py-4"><span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">{r.id}</span></td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <img src={`https://i.pravatar.cc/40?img=${r.avatar || 20}`} alt="" className="h-9 w-9 rounded-full border border-gray-200" />
                              <span className="font-semibold text-gray-800">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-500">{r.department}</td>
                          <td className="px-5 py-4 font-semibold text-gray-700">{r.checkIn}</td>
                          <td className="px-5 py-4 font-semibold text-gray-700">{r.checkOut}</td>
                          <td className="px-5 py-4"><span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-gray-700 border border-gray-200">{r.hours}</span></td>
                          <td className="px-5 py-4"><span className={`rounded-xl px-3 py-1 text-xs font-bold ${STATUS_STYLE[r.status] || STATUS_STYLE.Absent}`}>{r.status}</span></td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="py-16 text-center text-sm text-gray-400">No records match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* LIVE FEED */}
            <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Radio size={20} className="text-indigo-700" />
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">Live Punch Log</h2>
                    <p className="mt-1 text-sm text-gray-500">Real-time employee punch activity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {newCount > 0 && (
                    <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">+{newCount} new</span>
                  )}
                  <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>
              </div>

              <div ref={feedRef} className="feed-box divide-y divide-gray-100">
                {liveFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Radio size={42} className="mb-4 text-gray-300" />
                    <p className="font-semibold text-gray-500">No activity yet</p>
                    <p className="mt-1 text-xs text-gray-400">Employees punch in from the dashboard</p>
                  </div>
                ) : liveFeed.map((item, i) => {
                 const meta = ACTION_STYLE[item.action] || ACTION_STYLE["Punch In"];
                  const isNew  = flashIds.has(item._id);
                  return (
                    <div key={item._id ?? i} className={`flex items-center gap-4 px-6 py-4 transition-all hover:bg-slate-50 ${isNew ? "row-new row-flash" : ""}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} ${isNew ? "animate-pulse" : ""}`} />
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.pill}`}>{meta.label}</span>
                      <span className="hidden rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200 sm:inline">{item.employeeId}</span>
                      <span className="hidden max-w-[150px] truncate text-sm font-semibold text-gray-700 md:inline">{item.employeeName}</span>
                      <div className="flex-1" />
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{fmtTime(item.timestamp)}</p>
                        <p className="text-xs text-gray-400">{fmtDate(item.timestamp)}</p>
                      </div>
                      <span className="hidden rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-gray-500 border border-gray-200 sm:inline">{item.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PUNCH LOG EXPORT */}
            <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="text-2xl font-black text-gray-900">Export Punch Log</h2>
                <p className="mt-1 text-sm text-gray-500">Download all employee punch events as CSV</p>
              </div>
              <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Export Range</label>
                  <div className="flex gap-2">
                    {[
                      { key: "range", label: "Date Range" },
                      { key: "month", label: "Month" },
                      { key: "all",   label: "All-Time" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setExportMode(key); setExportAllDates(key === "all"); setSelectedEmployee(null); setEmpSearch(""); }}
                        className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${
                          exportMode === key
                            ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {exportMode === "month" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Select Month</label>
                    <div className="relative">
                      <input
                        type="month"
                        value={exportMonth}
                        onChange={(e) => setExportMonth(e.target.value)}
                        className="rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold text-gray-800 outline-none transition-all focus:border-[#111827] focus:bg-white"
                      />
                      <Calendar size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                )}

                {exportMode === "range" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Start Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={punchExportDate}
                          max={punchExportEndDate}
                          onChange={(e) => setPunchExportDate(e.target.value)}
                          className="rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold text-gray-800 outline-none transition-all focus:border-[#111827] focus:bg-white"
                        />
                        <Calendar size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">End Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={punchExportEndDate}
                          min={punchExportDate}
                          onChange={(e) => setPunchExportEndDate(e.target.value)}
                          className="rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold text-gray-800 outline-none transition-all focus:border-[#111827] focus:bg-white"
                        />
                        <Calendar size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </>
                )}
                
                {/* EMPLOYEE FILTER — autocomplete */}
                <div className="flex flex-col gap-1.5" ref={empDropRef}>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Employee</label>
                  <div className="relative">
                    {/* Input always visible — shows selected name or search text */}
                    <User size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                    <input
                      type="text"
                      value={selectedEmployee ? selectedEmployee.name : empSearch}
                      onChange={(e) => {
                        setSelectedEmployee(null);
                        setEmpSearch(e.target.value);
                        setEmpDropOpen(true);
                      }}
                      onFocus={() => setEmpDropOpen(true)}
                      placeholder="All Employees"
                      className="w-full min-w-[220px] rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-semibold text-gray-800 outline-none transition-all focus:border-[#111827] focus:bg-white placeholder-gray-400"
                    />
                    {(selectedEmployee || empSearch) && (
                      <button
                        type="button"
                        onClick={() => { setSelectedEmployee(null); setEmpSearch(""); setEmpDropOpen(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-200"
                      >
                        <X size={13} className="text-gray-400" />
                      </button>
                    )}

                    {/* Suggestion list */}
                    {empDropOpen && (
                      <div className="absolute z-20 mt-2 w-full min-w-[240px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                        <div className="max-h-52 overflow-y-auto">
                          {/* "All Employees" option always first */}
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setSelectedEmployee(null); setEmpSearch(""); setEmpDropOpen(false); }}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${!selectedEmployee && !empSearch ? "font-bold text-gray-900 bg-slate-50" : "text-gray-500"}`}
                          >
                            <User size={13} className="text-gray-400 shrink-0" />
                            All Employees
                          </button>

                          {filteredEmpList.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-gray-400">No employees found</p>
                          ) : filteredEmpList.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setSelectedEmployee(e); setEmpSearch(""); setEmpDropOpen(false); }}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${selectedEmployee?.id === e.id ? "font-bold text-gray-900 bg-indigo-50" : "text-gray-700"}`}
                            >
                              <span className="rounded-lg bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 shrink-0">{e.id}</span>
                              <span className="truncate">{e.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleExportPunchLog}
                  disabled={exportingPunch}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Download size={16} />
                  {exportingPunch
                    ? "Downloading..."
                    : exportMode === "all"
                      ? `Download All-Time${selectedEmployee ? ` · ${selectedEmployee.name}` : ""}`
                      : exportMode === "month"
                        ? `Download ${exportMonth}${selectedEmployee ? ` · ${selectedEmployee.name}` : ""}`
                        : `Download CSV${selectedEmployee ? ` · ${selectedEmployee.name}` : ""}`}
                </button>
                <p className="text-xs text-gray-400 sm:ml-auto sm:text-right">
                  Includes: Punch In, Punch Out,<br className="hidden sm:block" /> Break Start &amp; Break End events
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}