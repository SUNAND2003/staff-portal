// src/pages/AdminWorkTrack.jsx
// FIX: onClick={reload} → onClick={loadTasks} (reload was never defined)

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { workLogAPI } from "../services/api";
import { Briefcase, Clock3, CheckCircle2, PlayCircle, PauseCircle, Menu, RefreshCw, Timer, Trash2 } from "lucide-react";

const formatTime = (seconds = 0) => {
  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs  > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const STATUS_META = {
  Completed:     { label: "Completed",   cls: "bg-emerald-100 text-emerald-700 border border-emerald-200", bar: 100 },
  Running:       { label: "Running",     cls: "bg-amber-100 text-amber-700 border border-amber-200",       bar: 65  },
  Paused:        { label: "Paused",      cls: "bg-blue-100 text-blue-700 border border-blue-200",          bar: 40  },
  "Not Started": { label: "Not Started", cls: "bg-slate-100 text-slate-500 border border-slate-200",       bar: 0   },
};

function getStatus(task) {
  if (task.status === "completed")  return "Completed";
  if (task.status === "in_progress") return "Running";
  if (task.status === "paused")     return "Paused";
  return "Not Started";
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-[30px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${color}18` }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
          <h3 className="mt-1 text-3xl font-black text-gray-900">{value}</h3>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gradient-to-r from-[#111827] to-[#4b5563] transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminWorkTrack() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [tasks,      setTasks]      = useState([]);
  const [filter,     setFilter]     = useState("All");
  const [search,     setSearch]     = useState("");
  const [confirmId,  setConfirmId]  = useState(null);
  const [loading,    setLoading]    = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workLogAPI.getAllLogs();
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading work logs:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const id = setInterval(loadTasks, 5000);
    return () => clearInterval(id);
  }, [loadTasks]);

  const handleDelete = async (id) => {
    try {
      await workLogAPI.deleteLog(id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      setConfirmId(null);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const total      = tasks.length;
  const running    = tasks.filter((t) => t.status === "in_progress").length;
  const paused     = tasks.filter((t) => t.status === "paused").length;
  const completed  = tasks.filter((t) => t.status === "completed").length;
  const totalSecs  = tasks.reduce((acc, t) => acc + (t.duration || 0), 0);

  const filtered = tasks.filter((task) => {
    const status = getStatus(task);
    const matchFilter = filter === "All" || status === filter;
    const matchSearch =
      !search ||
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

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
                <h1 className="text-xl font-black text-white">Work Track</h1>
                <p className="text-xs text-white/50">Employee task tracking admin panel</p>
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
              {/* FIX: was onClick={reload} — function is named loadTasks */}
              <button
                onClick={loadTasks}
                className="rounded-xl border border-white/10 bg-white/10 p-3 text-white transition-all duration-300 hover:bg-white/20"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mx-auto w-full max-w-6xl p-5 md:p-7">

          {/* STATS */}
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Briefcase}   label="Total Tasks" value={total}     color="#6366f1" />
            <StatCard icon={PlayCircle}  label="Running"     value={running}   color="#f59e0b" />
            <StatCard icon={PauseCircle} label="Paused"      value={paused}    color="#3b82f6" />
            <StatCard icon={CheckCircle2} label="Completed"  value={completed} color="#10b981" />
          </div>

          {/* TOTAL TIME */}
          <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#111827] to-[#374151] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Clock3 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/70">Total Tracked Time</p>
                <h2 className="mt-1 text-3xl font-black">{formatTime(totalSecs)}</h2>
              </div>
            </div>
          </div>

          {/* FILTERS */}
          <div className="mb-6 rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
              />
              <div className="flex flex-wrap gap-2">
                {["All", "Running", "Paused", "Completed", "Not Started"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 ${
                      filter === f
                        ? "bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-slate-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TASK LIST */}
          {filtered.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
              <Briefcase size={50} className="mx-auto text-gray-300" />
              <h3 className="mt-5 text-2xl font-bold text-gray-700">No Tasks Found</h3>
              <p className="mt-2 text-gray-400">Employees will appear here when tasks are created.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filtered.map((task) => {
                const status = getStatus(task);
                const meta   = STATUS_META[status];
                const isConfirming = confirmId === task._id;

                return (
                  <div key={task._id} className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-2xl">
                    <div className="flex flex-wrap justify-between gap-5">

                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                        </div>
                        {task.description && (
                          <p className="mb-5 text-sm leading-7 text-gray-500">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          {task.createdAt && (
                            <span className="rounded-xl bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-700">
                              Created: {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                          )}
                          {task.endedAt && (
                            <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
                              Ended: {new Date(task.endedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4">
                        <div className="rounded-2xl bg-slate-50 px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-[#111827]">
                            <Timer size={15} />
                            <p className="text-sm font-bold">{formatTime(task.duration || 0)}</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">duration</p>
                        </div>

                        {!isConfirming ? (
                          <button
                            onClick={() => setConfirmId(task._id)}
                            className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition-all duration-300 hover:bg-red-200"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Sure?</span>
                            <button onClick={() => handleDelete(task._id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white transition-all duration-300 hover:bg-red-600">Yes</button>
                            <button onClick={() => setConfirmId(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-gray-600 transition-all duration-300 hover:bg-slate-200">No</button>
                          </div>
                        )}
                      </div>

                    </div>
                    <ProgressBar pct={meta.bar} />
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