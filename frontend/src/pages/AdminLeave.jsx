// src/pages/AdminLeave.jsx
// FIX 1: leave.employee is a populated object {_id,name,employeeId,...} — extract .name
// FIX 2: filter buttons missing key prop (React warning)

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { getLeaveRequests, updateLeaveRequest, onLeaveUpdate } from "../utils/adminData";
import { CalendarDays, CheckCircle2, XCircle, Clock3, FileText, Menu, RefreshCw } from "lucide-react";

const LEAVE_BADGE = {
  Approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Rejected: "bg-red-100 text-red-700 border border-red-200",
  Pending:  "bg-amber-100 text-amber-700 border border-amber-200",
};

// FIX: safely extract name whether employee is a string or populated object
const getEmployeeName = (leave) =>
  leave.employee?.name || leave.employee || leave.employeeName || "—";

// FIX: safely extract type — backend returns lowercase enum e.g. "casual"
const getLeaveType = (leave) => {
  const t = leave.type || "";
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
};

// FIX: capitalise status from backend lowercase "pending" → "Pending"
const getStatus = (leave) => {
  const s = leave.status || "pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function StatCard({ icon: Icon, title, value, color }) {
  return (
    <div className="flex-1 min-w-[220px] rounded-[30px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${color}18` }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">{title}</p>
          <h2 className="mt-1 text-3xl font-black text-gray-900">{value}</h2>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeave() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [leaves,     setLeaves]     = useState([]);
  const [filter,     setFilter]     = useState("All");
  const [loading,    setLoading]    = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests();
      setLeaves(data || []);
    } catch (error) {
      console.error("Failed to load leaves:", error);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);
  useEffect(() => { return onLeaveUpdate(reload); }, []);

  const handleLeave = async (id, action) => {
    try {
      const updatedLeaves = await updateLeaveRequest(id, action);
      setLeaves(updatedLeaves || []);
    } catch (error) {
      console.error("Failed to update leave:", error);
    }
  };

  const totalLeaves    = leaves.length;
  const approvedLeaves = leaves.filter((l) => (l.status || "").toLowerCase() === "approved").length;
  const pendingLeaves  = leaves.filter((l) => (l.status || "").toLowerCase() === "pending").length;
  const rejectedLeaves = leaves.filter((l) => (l.status || "").toLowerCase() === "rejected").length;

  const filtered =
    filter === "All"
      ? leaves
      : leaves.filter((l) => getStatus(l) === filter);

  return (
    <div className="flex min-h-screen bg-white">

      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER */}
        <div className="relative overflow-hidden bg-black border-b border-zinc-800 px-6 py-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-white md:hidden" onClick={() => setMobileOpen(true)}>
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-xl font-black text-white">Leave Management</h1>
                <p className="text-xs text-white/50">Review and manage employee leave requests</p>
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
              <button
                onClick={reload}
                className="rounded-xl border border-white/10 bg-white/10 p-3 text-white transition-all duration-300 hover:bg-white/20"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mx-auto w-full max-w-6xl p-5 md:p-7">

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900">Employee Leave Requests</h2>
            <p className="mt-2 text-sm text-gray-500">Review, approve and reject employee leave requests professionally</p>
          </div>

          {/* STATS */}
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FileText}     title="Total Requests" value={totalLeaves}    color="#2563eb" />
            <StatCard icon={CheckCircle2} title="Approved"       value={approvedLeaves} color="#16a34a" />
            <StatCard icon={Clock3}       title="Pending"        value={pendingLeaves}  color="#d97706" />
            <StatCard icon={XCircle}      title="Rejected"       value={rejectedLeaves} color="#dc2626" />
          </div>

          {/* FILTERS — FIX: added key prop */}
          <div className="mb-7 flex flex-wrap gap-3">
            {["All", "Pending", "Approved", "Rejected"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
                  filter === f
                    ? "bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                }`}
              >
                {f}
                {f !== "All" && (
                  <span className="ml-2 opacity-70">
                    ({leaves.filter((l) => getStatus(l) === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* LEAVE CARDS */}
          {filtered.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
              <CalendarDays size={52} className="mx-auto text-gray-300" />
              <h3 className="mt-5 text-2xl font-bold text-gray-700">No Leave Requests</h3>
              <p className="mt-2 text-gray-400">
                {filter === "All"
                  ? "Employees will appear here after submitting leave requests."
                  : `No ${filter.toLowerCase()} requests available.`}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filtered.map((leave) => {
                const status = getStatus(leave);
                return (
                  // FIX: key on the card element
                  <div
                    key={leave._id || leave.id}
                    className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-2xl"
                  >
                    <div className="flex flex-wrap justify-between gap-5">
                      <div className="flex-1">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                          {/* FIX: was {leave.employee} — now extracts .name safely */}
                          <h3 className="text-lg font-bold text-gray-900">{getEmployeeName(leave)}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${LEAVE_BADGE[status] || LEAVE_BADGE.Pending}`}>
                            {status}
                          </span>
                          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-gray-600">
                            {getLeaveType(leave)}
                          </span>
                        </div>

                        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays size={15} />
                          {leave.startDate
                            ? new Date(leave.startDate).toLocaleDateString("en-IN")
                            : leave.from || "—"}
                          <span className="font-bold">→</span>
                          {leave.endDate
                            ? new Date(leave.endDate).toLocaleDateString("en-IN")
                            : leave.to || "—"}
                          {leave.days && (
                            <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                              {leave.days}d
                            </span>
                          )}
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-sm leading-7 text-gray-600">{leave.reason}</p>
                        </div>
                      </div>

                      {status === "Pending" ? (
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => handleLeave(leave._id || leave.id, "Approved")}
                            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-emerald-700 hover:shadow-lg"
                          >
                            <CheckCircle2 size={16} /> Approve
                          </button>
                          <button
                            onClick={() => handleLeave(leave._id || leave.id, "Rejected")}
                            className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-red-600 hover:shadow-lg"
                          >
                            <XCircle size={16} /> Reject
                          </button>
                        </div>
                      ) : (
                        <div>
                          {status === "Approved" ? (
                            <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">
                              <CheckCircle2 size={16} /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-sm font-bold text-red-700">
                              <XCircle size={16} /> Rejected
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}