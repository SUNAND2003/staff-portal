// src/pages/AdminWorkTrack.jsx
// FIX: onClick={reload} → onClick={loadTasks} (reload was never defined)

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { workLogAPI, employeeAPI } from "../services/api";
import { Briefcase, Clock3, CheckCircle2, PlayCircle, PauseCircle, Menu, RefreshCw, Timer, Trash2, User, Users } from "lucide-react";

const formatTime = (seconds = 0) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hrs  = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs  > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const getTaskDuration = (task) => {
  if (!task) return 0;
  const status = String(task.status || "").toLowerCase().trim();
  const isPaused = status === "paused" || status === "on_hold" || status === "on-hold" || status === "hold" || Boolean(task.paused);
  const isCompleted = status === "completed" || Boolean(task.endTime) || Boolean(task.endedAt);

  // If paused or completed, duration is strictly frozen — NEVER add live Date.now()
  if (isPaused || isCompleted) {
    if (typeof task.durationSeconds === "number" && task.durationSeconds >= 0) return task.durationSeconds;
    if (typeof task.duration === "number" && task.duration >= 0) return task.duration;
    if (typeof task.savedElapsed === "number" && task.savedElapsed >= 0) return task.savedElapsed;
    const start = task.startTime || task.startedAt || task.createdAt;
    const end = task.endTime || task.endedAt;
    if (start && end) {
      const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
      return diff > 0 ? diff : 0;
    }
    return 0;
  }

  // If running / in_progress, accumulate base duration + current active segment
  const baseSeconds = Number(task.durationSeconds || task.duration || task.savedElapsed || 0);
  const start = task.startTime || task.startedAt;
  if (start && (status === "in_progress" || status === "running" || Boolean(task.running))) {
    const liveDiff = Math.max(0, Math.floor((Date.now() - new Date(start)) / 1000));
    return baseSeconds + liveDiff;
  }

  return baseSeconds;
};

const STATUS_META = {
  Completed:     { label: "Completed",   cls: "bg-emerald-100 text-emerald-700 border border-emerald-200", bar: 100 },
  Running:       { label: "Running",     cls: "bg-amber-100 text-amber-700 border border-amber-200",       bar: 65  },
  Paused:        { label: "Paused",      cls: "bg-blue-100 text-blue-700 border border-blue-200",          bar: 40  },
  "Not Started": { label: "Not Started", cls: "bg-slate-100 text-slate-500 border border-slate-200",       bar: 0   },
};

function getStatus(task) {
  const status = String(task?.status || "").toLowerCase().trim();
  if (status === "completed" || Boolean(task?.endTime) || Boolean(task?.endedAt)) return "Completed";
  if (status === "paused" || status === "on_hold" || status === "on-hold" || status === "hold" || Boolean(task?.paused)) return "Paused";
  if (status === "in_progress" || status === "running" || Boolean(task?.running)) return "Running";
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

  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [tasks,            setTasks]            = useState([]);
  const [employees,        setEmployees]        = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [filter,           setFilter]           = useState("All");
  const [search,           setSearch]           = useState("");
  const [confirmId,        setConfirmId]        = useState(null);
  const [loading,          setLoading]          = useState(false);

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

  const loadEmployees = useCallback(async () => {
    try {
      const data = await employeeAPI.getAll();
      const list = Array.isArray(data) ? data : (data?.employees || data?.data || []);
      setEmployees(list);
    } catch (err) {
      console.error("Error loading employees for work track:", err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadEmployees();
    const id = setInterval(loadTasks, 5000);
    return () => clearInterval(id);
  }, [loadTasks, loadEmployees]);

  // Live timer tick for running logs
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id) => {
    try {
      await workLogAPI.deleteLog(id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      setConfirmId(null);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const getEmployeeInfo = useCallback((task) => {
    if (task?.employee && typeof task.employee === "object" && task.employee.name) {
      return {
        id: task.employee._id || task.employeeId || "",
        name: task.employee.name,
        department: task.employee.department || "",
        employeeId: task.employee.employeeId || task.employeeId || "",
        avatar: task.employee.avatar || "",
      };
    }
    const rawId = typeof task?.employee === "string" ? task.employee : (task?.employeeId || "");
    if (rawId && Array.isArray(employees)) {
      const found = employees.find((e) => e._id === rawId || e.employeeId === rawId || e.id === rawId);
      if (found) {
        return {
          id: found._id || found.employeeId || "",
          name: found.name,
          department: found.department || "",
          employeeId: found.employeeId || "",
          avatar: found.avatar || "",
        };
      }
    }
    return {
      id: task?.employeeId || "",
      name: task?.employeeName || (task?.employeeId ? `Employee ${task.employeeId}` : "Unassigned / General"),
      department: task?.department || "",
      employeeId: task?.employeeId || "",
      avatar: "",
    };
  }, [employees]);

  const total      = tasks.length;
  const running    = tasks.filter((t) => t.status === "in_progress" || t.status === "running").length;
  const paused     = tasks.filter((t) => t.status === "paused" || t.status === "on_hold").length;
  const completed  = tasks.filter((t) => t.status === "completed").length;
  const totalSecs  = tasks.reduce((acc, t) => acc + getTaskDuration(t), 0);

  const filtered = tasks.filter((task) => {
    const status = getStatus(task);
    const matchFilter = filter === "All" || status === filter;
    const emp = getEmployeeInfo(task);

    const matchEmployee =
      selectedEmployee === "All" ||
      emp.id === selectedEmployee ||
      emp.employeeId === selectedEmployee ||
      emp.name.toLowerCase() === selectedEmployee.toLowerCase() ||
      task.employee?._id === selectedEmployee;

    const matchSearch =
      !search ||
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(search.toLowerCase()) ||
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      emp.department.toLowerCase().includes(search.toLowerCase());

    return matchFilter && matchEmployee && matchSearch;
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
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, descriptions, employees..."
                className="min-w-[200px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
              />

              {/* EMPLOYEE FILTER DROPDOWN */}
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-400" />
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs font-bold text-gray-700 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg cursor-pointer"
                >
                  <option value="All">All Employees ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp._id || emp.employeeId} value={emp._id || emp.employeeId || emp.name}>
                      {emp.name} {emp.department ? `(${emp.department})` : ""} {emp.employeeId ? `· ${emp.employeeId}` : ""}
                    </option>
                  ))}
                </select>
              </div>

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

                const durationSecs = getTaskDuration(task);
                const emp = getEmployeeInfo(task);

                return (
                  <div key={task._id} className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-2xl">
                    <div className="flex flex-wrap justify-between gap-5">

                      <div className="flex-1">
                        {/* PROMINENT EMPLOYEE BADGE (WHICH EMPLOYEE) */}
                        <div className="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-white px-3.5 py-2 w-fit shadow-xs">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[11px] font-black text-white shadow-sm ring-2 ring-indigo-200">
                            {emp.name?.[0]?.toUpperCase() || "E"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Employee:</span>
                            <span className="font-extrabold text-gray-900 text-sm">
                              {emp.name}
                            </span>
                            {emp.department && (
                              <span className="rounded-lg bg-white border border-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-700 shadow-2xs">
                                {emp.department}
                              </span>
                            )}
                            {emp.employeeId && (
                              <span className="rounded-lg bg-indigo-100/90 border border-indigo-200 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-800">
                                ID: {emp.employeeId}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                        </div>
                        {task.description && (
                          <p className="mb-4 text-sm leading-6 text-gray-500">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {(task.startTime || task.startedAt) && (
                            <span className="rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                              Start: {new Date(task.startTime || task.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                          {(task.endTime || task.endedAt) && (
                            <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                              End: {new Date(task.endTime || task.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                          {task.date && (
                            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                              {task.date}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4">
                        <div className="rounded-2xl bg-slate-50 px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-[#111827]">
                            <Timer size={15} className={status === "Running" ? "text-emerald-500 animate-pulse" : status === "Paused" ? "text-amber-500" : "text-gray-400"} />
                            <p className="text-sm font-bold">{formatTime(durationSecs)}</p>
                          </div>
                          <p className="mt-1 text-xs font-semibold capitalize text-gray-400">
                            {status === "Paused" ? "paused (stopped)" : status === "Running" ? "running" : "duration"}
                          </p>
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
                    <ProgressBar pct={status === "Completed" ? 100 : status === "Running" ? 65 : 40} />
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