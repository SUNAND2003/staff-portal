// src/pages/AdminTasks.jsx
import { useState, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import AdminSidebar from "../layouts/AdminSidebar";
import { taskAPI, employeeAPI } from "../services/api";

const STATUS_STYLES = {
  pending:     { label: "Pending",     cls: "bg-amber-100 text-amber-700"    },
  in_progress: { label: "In Progress", cls: "bg-indigo-100 text-indigo-700"  },
  completed:   { label: "Completed",   cls: "bg-emerald-100 text-emerald-700"},
  on_hold:     { label: "On Hold",     cls: "bg-purple-100 text-purple-700"  },
};

const PRIORITY_STYLES = {
  high:   "bg-red-100 text-red-600 border border-red-200",
  medium: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  low:    "bg-slate-100 text-slate-600 border border-slate-200",
};

const normaliseStatus   = (s = "") => s.toLowerCase().replace(" ", "_");
const normalisePriority = (p = "") => p.toLowerCase();

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
};

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, bg }) {
  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-4 rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${bg}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="mt-0.5 text-3xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
      {initials(name)}
    </div>
  );
}

function TaskRow({ task, onEdit, onDelete, onStatusChange }) {
  const status   = STATUS_STYLES[normaliseStatus(task.status)]      || STATUS_STYLES.pending;
  const priority = PRIORITY_STYLES[normalisePriority(task.priority)] || PRIORITY_STYLES.medium;

  const assignedName =
    typeof task.assignedTo === "object"
      ? task.assignedTo?.name || "—"
      : task.assignedTo || "—";

  const assignedDept =
    typeof task.assignedTo === "object"
      ? task.assignedTo?.department || ""
      : "";

  const overdue =
    task.dueDate &&
    normaliseStatus(task.status) !== "completed" &&
    new Date(task.dueDate) < new Date();

  return (
    <tr className="border-b border-gray-50 transition-all hover:bg-slate-50">
      <td className="px-5 py-4">
        <div className="max-w-xs">
          <p className="font-semibold text-gray-900">{task.title}</p>
          {task.description && (
            <p className="mt-0.5 truncate text-xs text-gray-400">{task.description}</p>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Avatar name={assignedName} />
          <div>
            <p className="text-sm font-semibold text-gray-800">{assignedName}</p>
            {assignedDept && <p className="text-xs text-gray-400">{assignedDept}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${priority}`}>
          {normalisePriority(task.priority).toUpperCase()}
        </span>
      </td>
      <td className="px-5 py-4">
        <select
          value={normaliseStatus(task.status)}
          onChange={(e) => onStatusChange(task._id, e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400"
        >
          {Object.entries(STATUS_STYLES).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </td>
      <td className="px-5 py-4">
        <span className={`text-sm font-semibold ${overdue ? "text-red-500" : "text-gray-700"}`}>
          {formatDate(task.dueDate)}
          {overdue && <span className="ml-1 text-[10px]">⚠ overdue</span>}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(task)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task._id)}
            className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 transition-all hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function TaskModal({ task, employees, onClose, onSaved }) {
  const isEdit = !!task?._id;

  const [form, setForm] = useState({
    title:       task?.title       || "",
    description: task?.description || "",
    priority:    normalisePriority(task?.priority || "medium"),
    status:      normaliseStatus(task?.status     || "pending"),
    assignedTo:
      typeof task?.assignedTo === "object"
        ? task.assignedTo?._id || ""
        : task?.assignedTo || "",
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
  });
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setError("");
    if (!form.title.trim())  { setError("Title is required.");         return; }
    if (!form.assignedTo)    { setError("Please select an employee."); return; }
    if (!form.dueDate)       { setError("Due date is required.");      return; }

    setSubmitting(true);
    try {
      const payload = {
        title:       form.title,
        description: form.description,
        priority:    form.priority,
        status:      form.status,
        assignedTo:  form.assignedTo,
        dueDate:     form.dueDate,
      };
      let saved;
      if (isEdit) {
        saved = await taskAPI.updateTask(task._id, payload);
      } else {
        saved = await taskAPI.createTask(payload);
      }
      onSaved(saved?.task || saved, isEdit);
    } catch (err) {
      setError(err.message || "Failed to save task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-2xl font-black text-gray-900">
            {isEdit ? "Edit Task" : "+ New Task"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-gray-500 hover:bg-red-100 hover:text-red-500"
          >✕</button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Task Title *</label>
            <input
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="Enter task title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="Task details..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Assign To *</label>
            <select
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">— Select Employee —</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}{emp.department ? ` (${emp.department})` : ""}{emp.employeeId ? ` · ${emp.employeeId}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Priority</label>
            <select
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Status</label>
            <select
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(STATUS_STYLES).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-600">Due Date *</label>
            <input
              type="date"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-100 px-6 py-5">
          <button
            onClick={onClose}
            className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-slate-50"
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminTasks() {
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [tasks,          setTasks]          = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [editTask,       setEditTask]       = useState(null);
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search,         setSearch]         = useState("");
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskAPI.getAllTasks();
      const list = Array.isArray(data) ? data : (data?.tasks || data?.data || []);
      setTasks(list);
    } catch (err) {
      console.error("Load tasks failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await employeeAPI.getAll();
      const list = Array.isArray(data) ? data : (data?.employees || data?.data || []);
      setEmployees(list);
    } catch (err) {
      console.error("Load employees failed:", err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadEmployees();
    const id = setInterval(loadTasks, 30_000);
    return () => clearInterval(id);
  }, [loadTasks, loadEmployees]);

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setTasks((prev) => prev.map((t) => (t._id === saved._id ? saved : t)));
    } else {
      setTasks((prev) => [saved, ...prev]);
    }
    setShowModal(false);
    setEditTask(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updated = await taskAPI.updateTask(id, { status: newStatus });
      const saved = updated?.task || updated;
      setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, ...saved } : t)));
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await taskAPI.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const total      = tasks.length;
  const pending    = tasks.filter((t) => normaliseStatus(t.status) === "pending").length;
  const inProgress = tasks.filter((t) => normaliseStatus(t.status) === "in_progress").length;
  const completed  = tasks.filter((t) => normaliseStatus(t.status) === "completed").length;
  const overdue    = tasks.filter(
    (t) => t.dueDate && normaliseStatus(t.status) !== "completed" && new Date(t.dueDate) < new Date()
  ).length;

  const filtered = tasks.filter((t) => {
    const matchStatus   = filterStatus   === "all" || normaliseStatus(t.status)     === filterStatus;
    const matchPriority = filterPriority === "all" || normalisePriority(t.priority) === filterPriority;
    const assignedName  = typeof t.assignedTo === "object" ? t.assignedTo?.name || "" : t.assignedTo || "";
    const matchSearch   = !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      assignedName.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  });

  return (
    // ✅ Use same layout pattern as AdminPanel — AdminSidebar directly, no DashboardLayout
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">

        {/* MOBILE HEADER */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-black px-6 py-4 shadow-2xl md:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-white">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-black text-white">Task Management</h1>
          <div className="w-6" />
        </div>

        <div className="p-4 md:p-6">

          {/* HEADER */}
          <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <h1 className="text-3xl font-black md:text-4xl">Task Management</h1>
                <p className="mt-2 text-white/70">Create, assign and track all employee tasks</p>
              </div>
              <button
                onClick={() => { setEditTask(null); setShowModal(true); }}
                className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl"
              >
                + New Task
              </button>
            </div>
          </div>

          {/* STATS */}
          <div className="mb-8 flex flex-wrap gap-4">
            <StatCard icon="📋" label="Total"       value={total}      bg="bg-slate-100"   />
            <StatCard icon="🕒" label="Pending"     value={pending}    bg="bg-amber-100"   />
            <StatCard icon="⚡" label="In Progress" value={inProgress} bg="bg-indigo-100"  />
            <StatCard icon="✅" label="Completed"   value={completed}  bg="bg-emerald-100" />
            {overdue > 0 && (
              <StatCard icon="⚠️" label="Overdue"   value={overdue}    bg="bg-red-100"     />
            )}
          </div>

          {/* FILTERS */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[28px] border border-gray-200 bg-white/95 p-4 shadow-sm">
            <div className="relative min-w-[220px] flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, employees…"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[["all","All"],["pending","Pending"],["in_progress","In Progress"],["completed","Completed"],["on_hold","On Hold"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilterStatus(val)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    filterStatus === val
                      ? "bg-[#111827] text-white shadow"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                  }`}>{label}</button>
              ))}
            </div>

            <div className="flex gap-1.5">
              {[["all","All"],["high","HIGH"],["medium","MED"],["low","LOW"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilterPriority(val)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    filterPriority === val
                      ? "bg-[#111827] text-white shadow"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                  }`}>{label}</button>
              ))}
            </div>

            <span className="ml-auto text-xs font-medium text-gray-400">
              {loading ? "Loading…" : `${filtered.length} task${filtered.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white/95 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    {["Task","Assigned To","Priority","Status","Due Date","Actions"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center text-sm text-gray-400">Loading tasks…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <p className="text-lg font-bold text-gray-400">No tasks found</p>
                        <p className="mt-1 text-xs text-gray-300">Try a different filter or create a new task</p>
                      </td>
                    </tr>
                  ) : filtered.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      onEdit={(t) => { setEditTask(t); setShowModal(true); }}
                      onDelete={(id) => setDeleteConfirm(id)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <TaskModal
          task={editTask}
          employees={employees}
          onClose={() => { setShowModal(false); setEditTask(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-gray-200 bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">🗑</div>
            <h3 className="text-xl font-black text-gray-900">Delete Task?</h3>
            <p className="mt-2 text-sm text-gray-500">This action cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600 hover:bg-slate-50"
              >Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}