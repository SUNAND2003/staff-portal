// src/pages/LeaveManagement.jsx — FIXED
// Changes:
// 1. Now uses useLeaveStore for consistent state management
// 2. Leave type mapped to backend enum values
// 3. Days calculated from date range before submit
// 4. Proper error handling with toast notifications

import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { leaveAPI } from "../services/api";
import useAuthStore from "../store/authStore";
import useLeaveStore from "../store/leaveStore";
import { onLeaveUpdate } from "../utils/adminData";
import { CalendarDays, Plus, CheckCircle2, Clock3, FileText, User } from "lucide-react";
import toast from "react-hot-toast";

// FIX: map UI label → backend enum
const TYPE_MAP = {
  "Casual Leave":   "casual",
  "Sick Leave":     "sick",
  "Emergency Leave":"unpaid",
  "Vacation Leave": "annual",
};

const badgeStyle = (status) => {
  if (status === "Approved") return "bg-emerald-100 text-emerald-600";
  if (status === "Rejected")  return "bg-red-100 text-red-600";
  return "bg-amber-100 text-amber-600";
};

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-4 rounded-[30px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}><Icon size={26} /></div>
      <div>
        <p className="text-sm font-semibold text-gray-500">{title}</p>
        <h2 className="mt-1 text-3xl font-black text-gray-900">{value}</h2>
      </div>
    </div>
  );
}

function LeaveCard({ leave }) {
  // FIX: normalise field names from backend shape via mapLeave
  const employee  = leave.employee?.name  || leave.employee || "—";
  const leaveType = leave.type ? leave.type.charAt(0).toUpperCase() + leave.type.slice(1).replace(/_/g," ") : "—";
  const from      = leave.startDate ? new Date(leave.startDate).toLocaleDateString("en-IN") : leave.from || "—";
  const to        = leave.endDate   ? new Date(leave.endDate).toLocaleDateString("en-IN")   : leave.to   || "—";
  const status    = leave.status    ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1) : "Pending";

  return (
    <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">{employee}</h3>
            <span className={`rounded-full px-4 py-1 text-xs font-bold ${badgeStyle(status)}`}>{status}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-6">
            <div><p className="text-xs text-gray-400">Leave Type</p><h4 className="mt-1 text-sm font-bold text-gray-700">{leaveType}</h4></div>
            <div><p className="text-xs text-gray-400">From</p><h4 className="mt-1 text-sm font-bold text-gray-700">{from}</h4></div>
            <div><p className="text-xs text-gray-400">To</p><h4 className="mt-1 text-sm font-bold text-gray-700">{to}</h4></div>
          </div>
          <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs text-gray-400">Reason</p>
            <p className="mt-2 text-sm leading-7 text-gray-600">{leave.reason}</p>
          </div>
        </div>
        <div className="flex items-center justify-center">
          {status === "Pending"  && <div className="rounded-2xl bg-amber-100 px-5 py-3 text-sm font-bold text-amber-700">Waiting For Approval</div>}
          {status === "Approved" && <div className="rounded-2xl bg-emerald-100 px-5 py-3 text-sm font-bold text-emerald-700">Approved By Admin</div>}
          {status === "Rejected" && <div className="rounded-2xl bg-red-100 px-5 py-3 text-sm font-bold text-red-700">Rejected By Admin</div>}
        </div>
      </div>
    </div>
  );
}

export default function LeaveManagement() {
  const { user } = useAuthStore();
  const { leaves, isLoading, error: storeError, fetchLeaves, applyLeave } = useLeaveStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // form fields
  const [type, setType] = useState("Casual Leave");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  // Load leaves on mount
  useEffect(() => {
    fetchLeaves().catch((err) => {
      console.error("Failed to load leaves:", err);
      toast.error("Failed to load leaves");
    });
    
    // re-load when admin approves/rejects (leaveUpdate event)
    const unsub = onLeaveUpdate(() => {
      fetchLeaves().catch(console.error);
    });
    return unsub;
  }, [fetchLeaves]);

  // Submit to backend via store
  const addLeave = async () => {
    setError("");
    if (!from || !to || !reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (new Date(to) < new Date(from)) {
      setError("End date must be after start date.");
      return;
    }

    // calculate days (inclusive)
    const days = Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1;

    setLoading(true);
    try {
      await applyLeave({
        type: TYPE_MAP[type] || "casual",
        startDate: from,
        endDate: to,
        days,
        reason: reason.trim(),
      });

      // fire event so admin panel refreshes if open in same tab
      window.dispatchEvent(new CustomEvent("leaveUpdate"));

      toast.success("Leave request submitted successfully");
      setFrom("");
      setTo("");
      setReason("");
      setType("Casual Leave");
    } catch (e) {
      const errorMsg = e.message || "Failed to submit leave request.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const totalLeaves    = leaves.length;
  const approvedLeaves = leaves.filter((l) => l.status === "approved" || l.status === "Approved").length;
  const pendingLeaves  = leaves.filter((l) => l.status === "pending"  || l.status === "Pending").length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">

        {/* HEADER */}
        <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] to-[#374151] p-8 text-white shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 backdrop-blur-md">
              <CalendarDays size={30} />
            </div>
            <div>
              <h1 className="text-3xl font-black md:text-4xl">Leave Management</h1>
              <p className="mt-2 text-white/80">Manage employee leave requests professionally</p>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mb-8 flex flex-wrap gap-5">
          <StatCard title="Total Requests" value={totalLeaves}    icon={FileText}    color="bg-blue-100 text-blue-600"    />
          <StatCard title="Approved"        value={approvedLeaves} icon={CheckCircle2} color="bg-emerald-100 text-emerald-600" />
          <StatCard title="Pending"         value={pendingLeaves}  icon={Clock3}       color="bg-amber-100 text-amber-600"  />
        </div>

        {/* FORM */}
        <div className="mb-8 rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Plus size={22} /></div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Leave Request</h2>
              <p className="mt-1 text-sm text-gray-500">Submit employee leave requests</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
            >
              {Object.keys(TYPE_MAP).map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg" />
          </div>

          <textarea
            placeholder="Leave reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="mt-4 w-full rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
          />

          <button
            onClick={addLeave}
            className="mt-5 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-4 font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
          >
            <Plus size={18} />
            Submit Leave Request
          </button>
        </div>

        {/* LEAVE LIST */}
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><User size={22} /></div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">My Leave Requests</h2>
              <p className="mt-1 text-sm text-gray-500">Your submitted leave requests</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[32px] border border-gray-200 bg-white/95 p-12 text-center text-sm text-gray-400 shadow-sm">Loading…</div>
          ) : leaves.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-gray-300 bg-white/95 p-12 text-center shadow-sm backdrop-blur-md">
              <CalendarDays size={54} className="mx-auto text-gray-300" />
              <h3 className="mt-5 text-2xl font-bold text-gray-700">No Leave Requests</h3>
              <p className="mt-2 text-gray-400">Employee leave requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {leaves.map((leave) => <LeaveCard key={leave._id || leave.id} leave={leave} />)}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}