import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import useAuthStore from "../store/authStore";
import { attendanceAPI, punchAPI } from "../services/api";
import { Search, Download, Calendar, Clock } from "lucide-react";

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "--";

const STATUS_STYLE = {
  Present:  "bg-emerald-100 text-emerald-700",
  Late:     "bg-amber-100 text-amber-700",
  "On Leave": "bg-blue-100 text-blue-700",
  Absent:   "bg-slate-100 text-gray-500",
};

const ACTION_STYLE = {
  "Punch In":    "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Break Start": "bg-amber-100 text-amber-700 border border-amber-200",
  "Break End":   "bg-blue-100 text-blue-700 border border-blue-200",
  "Punch Out":   "bg-red-100 text-red-700 border border-red-200",
};

const localTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function EmployeeAttendance() {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [punchHistory, setPunchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingPunch, setExportingPunch] = useState(false);
  const [exportingAllPunch, setExportingAllPunch] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "punch"

  useEffect(() => { loadAttendance(); }, [filterMonth]);
 // Replace the punch useEffect:
useEffect(() => {
  if (activeTab === "punch") loadPunchHistory();
}, [activeTab, filterMonth]); // this is already correct, but ensure loadPunchHistory is stable

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const [year, month] = filterMonth.split("-");
      const data = await attendanceAPI.getMyAttendance({ year, month });
      const records = data?.records || data?.attendance || (Array.isArray(data) ? data : []);
      
      const mapped = records.map(r => {
        let displayStatus = "Absent";
        if (r.status === "working" || r.status === "checked_out" || r.status === "on_break") {
          displayStatus = r.isLate ? "Late" : "Present";
        } else if (r.status === "on_leave") {
          displayStatus = "On Leave";
        }
        return {
          ...r,
          status: displayStatus
        };
      });

      setAttendance(mapped);
    } catch (err) {
      console.error("Error loading attendance:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

const loadPunchHistory = async () => {
  try {
    setPunchLoading(true);
    const [year, month] = filterMonth.split("-");
    const data = await punchAPI.getMyPunches({ year, month });
    // handle multiple possible response shapes
    const punches = data?.punches || data?.data || (Array.isArray(data) ? data : []);
    setPunchHistory(punches);
  } catch (err) {
    console.error("Error loading punch history:", err);
    setPunchHistory([]);
  } finally {
    setPunchLoading(false);
  }
};
  // Stats
  const stats = {
    total:   attendance.length,
    present: attendance.filter((r) => r.status === "Present").length,
    absent:  attendance.filter((r) => r.status === "Absent").length,
    late:    attendance.filter((r) => r.status === "Late").length,
    onLeave: attendance.filter((r) => r.status === "On Leave").length,
  };

  const filtered = attendance.filter((r) => {
    const q = search.toLowerCase();
    return fmtDate(r.date).toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
  });

  // Export attendance summary CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const headers = ["Date", "Punch In", "Punch Out", "Hours Worked", "Status", "Notes"];
      const rows = filtered.map((r) => [
        fmtDate(r.date),
        fmtTime(r.checkIn),
        fmtTime(r.checkOut),
        r.totalHours ? `${r.totalHours}h` : "--",
        r.status,
        r.notes || "",
      ]);
      const csv = [
        `Employee: ${user?.name || ""}`,
        `Month: ${filterMonth}`,
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        "",
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      triggerDownload(csv, `attendance-summary-${filterMonth}.csv`);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Export full punch history CSV for current month
  const handleExportPunchHistory = async () => {
    setExportingPunch(true);
    try {
      const [year, month] = filterMonth.split("-");
      const data = await punchAPI.getMyPunches({ year, month });
      const punches = data?.punches || [];

      // Pair each Punch In with its next Punch Out per session
      const sortedP = [...punches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const getPunchOut = (p, list) => {
        const idx = list.indexOf(p);
        for (let i = idx + 1; i < list.length; i++) {
          if (list[i].action === "Punch Out") return fmtTime(list[i].timestamp);
        }
        return "--";
      };

      const headers = ["Date", "Punch In Time", "Punch Out Time", "Action", "Status"];
      const csv = [
        `Employee: ${user?.name || ""}  |  ID: ${user?.employeeId || ""}`,
        `Month: ${filterMonth}`,
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        "",
        headers.join(","),
        ...sortedP.map((p) => [
          fmtDate(p.timestamp),
          fmtTime(p.timestamp),
          p.action === "Punch In" ? getPunchOut(p, sortedP) : "--",
          p.action,
          p.status || "--"
        ].map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      triggerDownload(csv, `punch-history-${filterMonth}.csv`);
    } catch (err) {
      console.error("Punch export error:", err);
    } finally {
      setExportingPunch(false);
    }
  };

  // Export all-time punch history CSV
  const handleExportAllPunches = async () => {
    setExportingAllPunch(true);
    try {
      const data = await punchAPI.getMyPunches(); // No filter = all-time
      const punches = data?.punches || [];

      // Pair each Punch In with its next Punch Out per session
      const sortedAll = [...punches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const getPunchOutAll = (p, list) => {
        const idx = list.indexOf(p);
        for (let i = idx + 1; i < list.length; i++) {
          if (list[i].action === "Punch Out") return fmtTime(list[i].timestamp);
        }
        return "--";
      };

      const headers = ["Date", "Punch In Time", "Punch Out Time", "Action", "Status"];
      const csv = [
        `Employee: ${user?.name || ""}  |  ID: ${user?.employeeId || ""}`,
        `Export Date: ${new Date().toLocaleDateString("en-IN")}`,
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        `Total Records: ${punches.length}`,
        "",
        headers.join(","),
        ...sortedAll.map((p) => [
          fmtDate(p.timestamp),
          fmtTime(p.timestamp),
          p.action === "Punch In" ? getPunchOutAll(p, sortedAll) : "--",
          p.action,
          p.status || "--"
        ].map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      triggerDownload(csv, `all-time-punch-history.csv`);
    } catch (err) {
      console.error("All punch export error:", err);
    } finally {
      setExportingAllPunch(false);
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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">

        {/* HEADER */}
        <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-8 text-white shadow-2xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-black md:text-4xl">My Attendance</h1>
              <p className="mt-2 text-white/80">View your monthly punch in/out records</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="appearance-none rounded-2xl border border-white/10 bg-white/10 py-3 pl-4 pr-10 text-sm font-semibold text-white backdrop-blur-md outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                />
                <Calendar size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
              </div>
              {/* Download Attendance Summary */}
              <button
                onClick={handleExportCSV}
                disabled={exporting || filtered.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={15} />
                {exporting ? "Exporting..." : "Attendance CSV"}
              </button>
              {/* Download Full Punch History */}
              <button
                onClick={handleExportPunchHistory}
                disabled={exportingPunch || attendance.length === 0}
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock size={15} />
                {exportingPunch ? "Exporting..." : "Punch History CSV"}
              </button>
              {/* Download All-Time Punch History */}
              <button
                onClick={handleExportAllPunches}
                disabled={exportingAllPunch}
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={15} />
                {exportingAllPunch ? "Exporting..." : "All-Time Punch CSV"}
              </button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Days"  value={stats.total}   />
          <StatCard label="Present"     value={stats.present} />
          <StatCard label="Absent"      value={stats.absent}  />
          <StatCard label="Late"        value={stats.late}    />
          <StatCard label="On Leave"    value={stats.onLeave} />
        </section>

        {/* TABS */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab("summary")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              activeTab === "summary"
                ? "bg-gray-900 text-white shadow"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Attendance Summary
          </button>
          <button
            onClick={() => setActiveTab("punch")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              activeTab === "punch"
                ? "bg-gray-900 text-white shadow"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Full Punch Log
          </button>
        </div>

        {activeTab === "summary" && (
          <>
            {/* SEARCH */}
            <div className="mb-6 rounded-[32px] border border-gray-200 bg-white p-5 shadow-sm">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by date or status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                />
              </div>
            </div>

            {/* SUMMARY TABLE */}
            <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <h3 className="text-xl font-black text-gray-900">Attendance Records</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50">
                      {["Date", "Punch In", "Punch Out", "Hours Worked", "Status"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                          Loading attendance...
                        </div>
                      </td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">No attendance records found for this month</td></tr>
                    ) : (
                      filtered.map((record) => (
                        <tr key={record._id || record.date} className="transition-all hover:bg-slate-50">
                          <td className="px-5 py-4"><span className="text-sm font-semibold text-gray-900">{fmtDate(record.date)}</span></td>
                          <td className="px-5 py-4"><span className="font-mono text-xs text-gray-600">{fmtTime(record.checkIn)}</span></td>
                          <td className="px-5 py-4"><span className="font-mono text-xs text-gray-600">{fmtTime(record.checkOut)}</span></td>
                          <td className="px-5 py-4"><span className="text-sm font-semibold text-gray-900">{record.totalHours ? `${record.totalHours}h` : "--"}</span></td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${STATUS_STYLE[record.status]}`}>{record.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "punch" && (
          <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-black text-gray-900">Full Punch Log</h3>
                <p className="mt-1 text-sm text-gray-400">Every punch in, punch out &amp; break event</p>
              </div>
              <button
                onClick={handleExportPunchHistory}
                disabled={exportingPunch || attendance.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                {exportingPunch ? "Exporting..." : "Download CSV"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    {["Date", "Time", "Action", "Status"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {punchLoading ? (
                    <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                        Loading punch log...
                      </div>
                    </td></tr>
                  ) : punchHistory.length === 0 ? (
                    <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">No punch records found for this month</td></tr>
                  ) : (
                    punchHistory.map((p, i) => (
                      <tr key={p._id || i} className="transition-all hover:bg-slate-50">
                        <td className="px-5 py-4"><span className="text-sm font-semibold text-gray-900">{fmtDate(p.timestamp || p.date)}</span></td>
                        <td className="px-5 py-4"><span className="font-mono text-xs text-gray-600">{fmtTime(p.timestamp)}</span></td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${ACTION_STYLE[p.action] || "bg-gray-100 text-gray-600"}`}>{p.action}</span>
                        </td>
                        <td className="px-5 py-4"><span className="text-xs text-gray-500">{p.status || "--"}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[30px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <p className="text-sm text-gray-500">{label}</p>
      <h3 className="mt-3 text-4xl font-black text-gray-900">{value}</h3>
    </div>
  );
}