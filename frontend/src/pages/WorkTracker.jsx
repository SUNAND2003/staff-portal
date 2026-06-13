// src/pages/WorkTracker.jsx
// FIX: Restored Start / Pause / Resume buttons.
// Strategy:
//   - addLog()  → POST /worklogs  (creates on backend, returns saved log with _id)
//   - endLog()  → PATCH /worklogs/:id/end  (marks complete on backend)
//   - Start / Pause / Resume are pure client-side state (no backend endpoint for them)
//   - Local task state merged with server _id so endLog can fire correctly

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { workLogAPI } from "../services/api";
import {
  Clock3, CheckCircle2, PlayCircle, Plus, Timer,
  PauseCircle, RotateCcw, Briefcase, ChevronDown, ChevronUp, Target,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (seconds) => {
  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs  > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const nowStr = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-4 rounded-[30px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
        <h2 className="mt-1 text-3xl font-black text-gray-900">{value}</h2>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onStart, onPause, onResume, onComplete }) {
  const isRunning   = task.running;
  const isPaused    = task.paused;
  const isCompleted = task.completed;

  const statusLabel = isCompleted ? "Completed" : isRunning ? "Running" : isPaused ? "Paused" : "Idle";

  const statusStyles = {
    Completed: "bg-emerald-100 text-emerald-600",
    Running:   "bg-indigo-100 text-indigo-600",
    Paused:    "bg-amber-100 text-amber-600",
    Idle:      "bg-slate-100 text-slate-600",
  };

  const progress = isCompleted ? 100 : isRunning ? 65 : isPaused ? 35 : 0;

  const Btn = ({ onClick, Icon: I, label, gradient }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl ${gradient}`}
    >
      <I size={15} />
      {label}
    </button>
  );

  return (
    <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex flex-wrap justify-between gap-5">

        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className={`text-[17px] font-bold text-gray-900 ${isCompleted ? "line-through opacity-60" : ""}`}>
              {task.title}
            </h3>
            <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${statusStyles[statusLabel]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>

          {task.description && (
            <p className="mb-5 text-sm leading-7 text-gray-500">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {task.startTime && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                Start: {task.startTime}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-gray-900">
              <Timer size={13} />
              {formatTime(task.elapsed)}
            </div>
            {isCompleted && task.endTime && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">
                End: {task.endTime}
              </div>
            )}
          </div>
        </div>

        {/* ACTION BUTTONS — all four states */}
        <div className="flex flex-wrap items-start gap-2">
          {!isRunning && !isPaused && !isCompleted && (
            <Btn onClick={onStart} Icon={PlayCircle} label="Start"
              gradient="bg-gradient-to-r from-[#111827] to-[#374151]" />
          )}
          {isRunning && (
            <Btn onClick={onPause} Icon={PauseCircle} label="Pause"
              gradient="bg-gradient-to-r from-amber-500 to-yellow-500" />
          )}
          {isPaused && (
            <Btn onClick={onResume} Icon={RotateCcw} label="Resume"
              gradient="bg-gradient-to-r from-sky-500 to-cyan-500" />
          )}
          {!isCompleted && (
            <Btn onClick={onComplete} Icon={CheckCircle2} label="Complete"
              gradient="bg-gradient-to-r from-emerald-500 to-green-500" />
          )}
        </div>

      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCompleted
              ? "bg-gradient-to-r from-emerald-500 to-green-400"
              : "bg-gradient-to-r from-[#111827] to-[#4b5563]"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WorkTracker() {
  // tasks: local state with client-side running/paused/completed flags
  // each task also carries serverId (_id from backend) for endLog()
  const [tasks,         setTasks]         = useState([]);
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [error,         setError]         = useState("");

  // ── Seed from backend on mount (so refreshing the page shows old logs) ──────
  const loadFromServer = useCallback(async () => {
    try {
      const data = await workLogAPI.getMyLogs();
      const arr  = Array.isArray(data) ? data : data?.logs || [];

      // Map server logs → local task shape (don't overwrite already-loaded local tasks)
      setTasks((prev) => {
        // keep any task already in local state (has local edits)
        const existingIds = new Set(prev.map((t) => t.serverId));
        const incoming = arr
          .filter((l) => !existingIds.has(l._id))
          .map((l) => ({
            id:           l._id,          // local key
            serverId:     l._id,
            title:        l.title,
            description:  l.description || "",
            running:      !l.endTime && !!l.startTime,
            paused:       false,
            completed:    !!l.endTime,
            startedAt:    l.startTime ? new Date(l.startTime).getTime() : null,
            elapsed:      l.endTime
              ? Math.floor((new Date(l.endTime) - new Date(l.startTime)) / 1000)
              : l.startTime
              ? Math.floor((Date.now() - new Date(l.startTime)) / 1000)
              : 0,
            savedElapsed: 0,
            startTime:    l.startTime
              ? new Date(l.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : null,
            endTime: l.endTime
              ? new Date(l.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : null,
          }));
        return [...prev, ...incoming];
      });
    } catch (e) {
      console.error("WorkTracker load error:", e);
    }
  }, []);

  useEffect(() => { loadFromServer(); }, [loadFromServer]);

  // ── Client-side timer ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTasks((prev) =>
        prev.map((task) =>
          task.running
            ? {
                ...task,
                elapsed:
                  task.savedElapsed +
                  Math.floor((Date.now() - task.startedAt) / 1000),
              }
            : task
        )
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const update = (id, patch) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const startTask = (id) =>
    update(id, { running: true, paused: false, startedAt: Date.now(), startTime: nowStr() });

  const pauseTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    update(id, { running: false, paused: true, savedElapsed: t.elapsed });
  };

  const resumeTask = (id) =>
    update(id, { running: true, paused: false, startedAt: Date.now() });

  // Complete: call backend if we have a serverId, otherwise just mark done locally
  const completeTask = async (id) => {
    const t = tasks.find((x) => x.id === id);
    const end = nowStr();

    // optimistic UI
    update(id, { running: false, paused: false, completed: true, savedElapsed: t.elapsed, endTime: end });

    if (t.serverId) {
      try {
        await workLogAPI.endLog(t.serverId);
      } catch (e) {
        console.error("endLog failed:", e);
      }
    }
  };

  // ── Add task: POST to backend, store returned _id as serverId ────────────────
  const addTask = async () => {
    if (!title.trim()) return;
    setError("");

    const localId = Date.now();

    // Optimistic — add immediately so UI feels instant
    setTasks((prev) => [
      {
        id:           localId,
        serverId:     null,   // filled after API responds
        title:        title.trim(),
        description:  description.trim(),
        running:      false,
        paused:       false,
        completed:    false,
        startedAt:    null,
        elapsed:      0,
        savedElapsed: 0,
        startTime:    null,
        endTime:      null,
      },
      ...prev,
    ]);

    setTitle("");
    setDescription("");

    try {
      const saved = await workLogAPI.addLog({
        title:       title.trim(),
        description: description.trim(),
      });
      // Attach the server _id so Complete can call endLog
      setTasks((prev) =>
        prev.map((t) =>
          t.id === localId ? { ...t, serverId: saved?._id || saved?.id || null } : t
        )
      );
    } catch (e) {
      setError(e.message || "Failed to save task.");
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeTasks    = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) =>  t.completed);
  const totalTime      = tasks.reduce((acc, t) => acc + t.elapsed, 0);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-8 rounded-[34px] bg-gradient-to-r from-[#111827] to-[#374151] p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 backdrop-blur-md">
                  <Briefcase size={30} />
                </div>
                <div>
                  <h1 className="text-3xl font-black md:text-4xl">Work Tracker</h1>
                  <p className="mt-2 text-white/80">Manage and track employee work efficiently</p>
                </div>
              </div>
            </div>
          </div>

          {/* STATS */}
          <div className="mb-8 flex flex-wrap gap-5">
            <StatCard icon={Clock3}     label="Total Time" value={formatTime(totalTime)}           color="bg-gradient-to-r from-[#111827] to-[#374151]" />
            <StatCard icon={PlayCircle} label="Running"    value={activeTasks.filter((t) => t.running).length}  color="bg-gradient-to-r from-indigo-500 to-purple-600" />
            <StatCard icon={Target}     label="Completed"  value={completedTasks.length}            color="bg-gradient-to-r from-emerald-500 to-green-500" />
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
          )}

          {/* ADD TASK */}
          <div className="mb-8 rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-md">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Plus size={22} /></div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create Task</h2>
                <p className="mt-1 text-sm text-gray-500">Add employee work tasks</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <input
                type="text" placeholder="Task title" value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                className="min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
              />
              <input
                type="text" placeholder="Description (optional)" value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
              />
              <button onClick={addTask}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                <Plus size={17} /> Add Task
              </button>
            </div>
          </div>

          {/* ACTIVE TASKS */}
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-2xl font-black text-gray-900">Active Tasks</h2>
              <span className="rounded-full bg-gradient-to-r from-[#111827] to-[#374151] px-3 py-1 text-xs font-bold text-white">{activeTasks.length}</span>
            </div>
            {activeTasks.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-gray-300 bg-white/95 p-12 text-center shadow-sm backdrop-blur-md">
                <Briefcase size={54} className="mx-auto text-gray-300" />
                <h3 className="mt-5 text-2xl font-bold text-gray-700">No Active Tasks</h3>
                <p className="mt-2 text-gray-400">Create tasks to start tracking work.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStart={()   => startTask(task.id)}
                    onPause={()   => pauseTask(task.id)}
                    onResume={()  => resumeTask(task.id)}
                    onComplete={() => completeTask(task.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* COMPLETED */}
          {completedTasks.length > 0 && (
            <div>
              <button onClick={() => setShowCompleted(!showCompleted)} className="mb-5 flex items-center gap-2">
                <h2 className="text-2xl font-black text-gray-900">Completed Tasks</h2>
                {showCompleted ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
              </button>
              {showCompleted && (
                <div className="space-y-5">
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStart={()   => startTask(task.id)}
                      onPause={()   => pauseTask(task.id)}
                      onResume={()  => resumeTask(task.id)}
                      onComplete={() => completeTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}