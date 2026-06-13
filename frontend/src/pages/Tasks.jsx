// src/pages/Tasks.jsx

import DashboardLayout from "../layouts/DashboardLayout";
import { useState, useEffect, useCallback } from "react";
import { taskAPI, employeeAPI } from "../services/api";
import useTaskStore from "../store/taskStore";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

const getAuthUser = () => {
  try {
    const state = JSON.parse(localStorage.getItem("auth-storage") || "{}");
    return state?.state?.user || null;
  } catch {
    return null;
  }
};

// ─── Normalise DB values to display values ────────────────────────────────────
const normaliseStatus = (s = "") => {
  const map = {
    pending:     "Pending",
    in_progress: "In Progress",
    completed:   "Completed",
    on_hold:     "On Hold",
  };
  return map[s.toLowerCase().replace(" ", "_")] || s;
};

const normalisePriority = (p = "") => p.toUpperCase();

const STATUS_STYLES = {
  Pending:       "bg-amber-100 text-amber-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Completed:     "bg-emerald-100 text-emerald-700",
  "On Hold":     "bg-purple-100 text-purple-700",
};

const PRIORITY_STYLES = {
  HIGH:   "bg-red-100 text-red-600 border border-red-200",
  MEDIUM: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  LOW:    "bg-slate-100 text-slate-600 border border-slate-200",
};

// Status values the backend accepts
const DB_STATUSES = ["pending", "in_progress", "completed", "on_hold"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-4 rounded-[30px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${bg}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
        <h2 className="mt-1 text-3xl font-black text-gray-900">{value}</h2>
      </div>
    </div>
  );
}

function TaskCard({ task, onStatusChange, onDelete, isEmployee }) {
  const displayStatus   = normaliseStatus(task.status);
  const displayPriority = normalisePriority(task.priority);
  const isCompleted     = task.status === "completed";

  const assignedName =
    typeof task.assignedTo === "object"
      ? task.assignedTo?.name || "—"
      : task.assignedTo || "—";

  const assignedInitials = assignedName
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className={`text-[17px] font-bold text-gray-900 ${isCompleted ? "line-through opacity-60" : ""}`}>
            {task.title}
          </h3>
          {task.priority && (
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${PRIORITY_STYLES[displayPriority] || PRIORITY_STYLES.MEDIUM}`}>
              {displayPriority}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[displayStatus] || ""}`}>
            {displayStatus}
          </span>
          {/* Status dropdown — sends DB values */}
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task._id, e.target.value)}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white"
          >
            {DB_STATUSES.map((s) => (
              <option key={s} value={s}>{normaliseStatus(s)}</option>
            ))}
          </select>

          {!isEmployee && (
            <button
              onClick={() => onDelete(task._id)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-all duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            >✕</button>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-gray-500">{task.description}</p>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        {assignedName !== "—" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#111827] to-[#374151] text-xs font-bold text-white">
              {assignedInitials}
            </div>
            {assignedName}
          </div>
        )}
        {task.dueDate && (
          <div className="text-sm text-gray-500">
            Due <span className="font-bold text-gray-800">{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>

      {task.progress !== undefined && task.progress > 0 && (
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                task.progress === 100
                  ? "bg-gradient-to-r from-emerald-500 to-green-400"
                  : task.progress > 40
                  ? "bg-gradient-to-r from-[#111827] to-[#374151]"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500"
              }`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <span className="min-w-[35px] text-right text-xs font-bold text-gray-500">{task.progress}%</span>
        </div>
      )}
    </div>
  );
}

export default function TaskManagement() {
  const authUser = getAuthUser();
  const { user } = useAuthStore();

  const { tasks, isLoading: loading, error: storeError, fetchTasks, createTask, updateTask, deleteTask } = useTaskStore();

  const isEmployee = authUser?.role === "employee";
  const isAdmin    = authUser?.role === "admin" || authUser?.role === "manager";

  const [employees,      setEmployees]      = useState([]);
  const [showModal,      setShowModal]      = useState(false);
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search,         setSearch]         = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", assignedTo: "", dueDate: "",
  });

  useEffect(() => {
    fetchTasks(isAdmin).catch((err) => {
      console.error("Failed to fetch tasks:", err);
      toast.error("Failed to load tasks");
    });
    const interval = setInterval(() => fetchTasks(isAdmin).catch(console.error), 30000);
    return () => clearInterval(interval);
  }, [fetchTasks, isAdmin]);

  const loadEmployees = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await employeeAPI.getAll();
      const list = Array.isArray(data) ? data : (data?.employees || data?.data || []);
      setEmployees(list);
    } catch (err) {
      console.error("Error loading employees:", err);
      toast.error("Failed to load employees");
    }
  }, [isAdmin]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateTask(id, { status: newStatus });
      toast.success("Task updated");
    } catch (err) {
      toast.error(err.message || "Failed to update task");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteTask(id);
      toast.success("Task deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete task");
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.title.trim()) { setError("Task title is required."); return; }
    if (!form.dueDate)      { setError("Due date is required.");   return; }

    const assignedToId = isEmployee
      ? authUser?._id
      : form.assignedTo || authUser?._id;

    if (isAdmin && !form.assignedTo) {
      setError("Please select an employee to assign this task.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title:       form.title,
        description: form.description,
        priority:    form.priority.toLowerCase(), // ✅ FIX: always lowercase for schema
        assignedTo:  assignedToId,
        dueDate:     form.dueDate,
        tags:        [],
      };
      await createTask(payload, isAdmin); // ✅ pass role so store re-fetches correct endpoint
      toast.success("Task created successfully");
      setForm({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
      setShowModal(false);
    } catch (err) {
      const msg = err.message || "Failed to create task.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats — use DB status values
  const total      = tasks.length;
  const pending    = tasks.filter((t) => t.status === "pending").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const completed  = tasks.filter((t) => t.status === "completed").length;

  // Filters — compare against DB status values
  const filtered = tasks.filter((task) => {
    const matchStatus   = filterStatus   === "all" || task.status   === filterStatus;
    const matchPriority = filterPriority === "all" || task.priority === filterPriority;
    const assignedName  = typeof task.assignedTo === "object" ? task.assignedTo?.name || "" : task.assignedTo || "";
    const matchSearch   = !search ||
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      assignedName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  });

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] to-[#374151] p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <h1 className="text-3xl font-black md:text-4xl">Task Management</h1>
                <p className="mt-2 text-white/80">
                  {isEmployee ? "Your assigned tasks" : "Manage employee tasks professionally"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-gray-900 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
              >
                + {isEmployee ? "Create Task" : "Add Task"}
              </button>
            </div>
          </div>

          {/* STATS */}
          <div className="mb-8 flex flex-wrap gap-5">
            <StatCard icon="📋" label="Total Tasks"  value={total}      bg="bg-slate-100"  />
            <StatCard icon="🕒" label="Pending"      value={pending}    bg="bg-amber-100"  />
            <StatCard icon="⚡" label="In Progress"  value={inProgress} bg="bg-indigo-100" />
            <StatCard icon="✅" label="Completed"    value={completed}  bg="bg-emerald-100"/>
          </div>

          {/* FILTERS */}
          <div className="mb-6 rounded-[30px] border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur-md">
            <div className="flex flex-wrap gap-4">
              <input
                type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
              />
              {/* Status filters use DB values */}
              <div className="flex flex-wrap gap-2">
                {[["all","All"],["pending","Pending"],["in_progress","In Progress"],["completed","Completed"],["on_hold","On Hold"]].map(([val, label]) => (
                  <button key={val} onClick={() => setFilterStatus(val)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      filterStatus === val
                        ? "bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                    }`}>{label}</button>
                ))}
              </div>
              {/* Priority filters use DB values */}
              <div className="flex flex-wrap gap-2">
                {[["all","All"],["high","HIGH"],["medium","MED"],["low","LOW"]].map(([val, label]) => (
                  <button key={val} onClick={() => setFilterPriority(val)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      filterPriority === val
                        ? "bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                    }`}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* TASKS LIST */}
          {loading ? (
            <div className="rounded-[32px] border border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
              <p className="text-gray-500">Loading tasks...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
              <h3 className="mt-5 text-2xl font-bold text-gray-700">No Tasks Found</h3>
              <p className="mt-2 text-gray-400">
                {isEmployee ? "No tasks assigned to you yet." : "Create a task to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filtered.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  isEmployee={isEmployee}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-2xl font-black text-gray-900">
                {isEmployee ? "Create Task" : "+ Add Task"}
              </h2>
              <button
                onClick={() => { setShowModal(false); setError(""); }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-gray-600 transition-all duration-300 hover:bg-red-100 hover:text-red-500"
              >✕</button>
            </div>

            {error && (
              <div className="mx-6 mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-600">Task Title *</label>
                  <input
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    placeholder="Enter task title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-600">Description</label>
                  <textarea
                    rows={4}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    placeholder="Task description..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* ✅ Priority — DB values (lowercase) */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-600">Priority</label>
                  <select
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="high">HIGH</option>
                    <option value="medium">MEDIUM</option>
                    <option value="low">LOW</option>
                  </select>
                </div>

                {/* ✅ Assign To */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-600">Assign To</label>
                  {isEmployee ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {(authUser?.name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{authUser?.name || "You"}</span>
                      <span className="ml-auto text-xs text-gray-400">Self-assigned</span>
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                      value={form.assignedTo}
                      onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    >
                      <option value="">— Select Employee —</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name}{emp.department ? ` (${emp.department})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-600">Due Date *</label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => { setShowModal(false); setError(""); }}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-4 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg sm:w-auto"
                >Cancel</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-4 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Saving…" : isEmployee ? "Create Task" : "+ Add Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}