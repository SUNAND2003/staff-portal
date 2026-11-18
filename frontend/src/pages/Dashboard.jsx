import { useEffect, useState, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { attendanceAPI, punchAPI } from "../services/api";
import useAuthStore from "../store/authStore";
import { Clock, Coffee, LogOut, AlertTriangle, CheckCircle2, Loader, Play, Sparkles, Calendar, Wifi, WifiOff, ShieldAlert, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const formatTime = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const formatTimeHM = (date) => {
  if (!date) return "--";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [punches, setPunches] = useState([]);
  const [workTime, setWorkTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [networkError, setNetworkError] = useState(null);

  // Track what is currently ticking: "work" | "break" | null
  const tickingRef = useRef(null);
  const timerRef = useRef(null);

  const startTicking = (mode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    tickingRef.current = mode;
    if (!mode) return;
    timerRef.current = setInterval(() => {
      if (tickingRef.current === "work") setWorkTime((p) => p + 1);
      if (tickingRef.current === "break") setBreakTime((p) => p + 1);
    }, 1000);
  };

  const stopTicking = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    tickingRef.current = null;
  };

  // Load today's attendance and punch records
  const loadAttendanceData = async () => {
    try {
      const data = await attendanceAPI.getToday();
      setAttendance(data);

      if (data?.checkIn && !data?.checkOut) {
        // --- Recalculate work seconds and break seconds from scratch ---
        const checkInMs = new Date(data.checkIn).getTime();
        const now = Date.now();

        const breaks = data.breaks || [];
        let totalBreakMs = 0;
        breaks.forEach((b) => {
          const bStart = new Date(b.start).getTime();
          const bEnd = b.end ? new Date(b.end).getTime() : now;
          totalBreakMs += bEnd - bStart;
        });

        const totalElapsedMs = now - checkInMs;
        const workMs = Math.max(0, totalElapsedMs - totalBreakMs);

        setWorkTime(Math.floor(workMs / 1000));
        setBreakTime(Math.floor(totalBreakMs / 1000));

        // Start the correct timer
        if (data.status === "on_break") {
          startTicking("break");
        } else {
          startTicking("work");
        }
      } else {
        // Checked out or not started — show final values, stop timers
        stopTicking();
        if (data?.workSeconds) setWorkTime(data.workSeconds);
        if (data?.breakSeconds) setBreakTime(data.breakSeconds);
      }

      const punchData = await punchAPI.getTodayPunches();
      setPunches(punchData?.punches || punchData || []);
    } catch (err) {
      console.error("Error loading attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
    const interval = setInterval(loadAttendanceData, 30000); // sync every 30s
    return () => {
      clearInterval(interval);
      stopTicking();
    };
  }, []);

  const handlePunch = async (action, status) => {
    setPunching(true);

    // Optimistically flip the timer before the API call returns
    if (action === "Punch In")    startTicking("work");
    if (action === "Break Start") startTicking("break");
    if (action === "Break End")   startTicking("work");
    if (action === "Punch Out")   stopTicking();

    try {
      const response = await punchAPI.recordPunch({ action, status });
      if (response?.success) {
        toast.success(`${action} recorded successfully!`);
        loadAttendanceData(); // re-sync from server
      } else {
        toast.error(response?.message || "Failed to record punch");
        loadAttendanceData(); // revert optimistic state
      }
    } catch (err) {
      const errMsg = err?.message || "Error recording punch";
      const isNetworkRestricted =
        err?.code === "UNAUTHORIZED_NETWORK" ||
        err?.status === 403 ||
        errMsg.toLowerCase().includes("unauthorized network") ||
        errMsg.toLowerCase().includes("restricted to the company") ||
        errMsg.toLowerCase().includes("hexa_5g");

      if (isNetworkRestricted) {
        setNetworkError({
          title: "Unauthorized Network Detected",
          message:
            err?.data?.message ||
            errMsg ||
            "Attendance punch is restricted to the company office network (HEXA_5G). Please connect to HEXA_5G Wi-Fi to punch.",
          clientIp: err?.data?.clientIp || "",
          ssid: err?.data?.allowedWifiSsid || "HEXA_5G",
        });
        toast.error("Punch blocked: Connect to HEXA_5G Wi-Fi to punch.", {
          duration: 5000,
        });
      } else {
        toast.error(errMsg);
      }
      loadAttendanceData();
    } finally {
      setPunching(false);
    }
  };

  const confirmCheckOut = () => {
    setShowModal(false);
    handlePunch("Punch Out", "Completed");
  };

  const canPunchIn    = !attendance?.checkIn && !attendance?.checkOut;
  const canPunchOut   = attendance?.checkIn && !attendance?.checkOut;
  const canBreakStart = attendance?.checkIn && !attendance?.checkOut && attendance?.status !== "on_break";
  const canBreakEnd   = attendance?.status === "on_break";
  const isCheckedOut  = Boolean(attendance?.checkOut);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader size={36} className="animate-spin text-indigo-600" />
            <p className="text-sm font-semibold text-slate-500">Loading your workspace...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const todayDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <DashboardLayout>
      <div className="w-full max-w-6xl mx-auto space-y-6">

        {/* HERO / WELCOME BANNER */}
        <div className="relative overflow-hidden rounded-[28px] sm:rounded-[34px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5 blur-xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-xs font-semibold tracking-wider uppercase mb-1">
                <Calendar size={14} className="text-emerald-400" />
                <span>{todayDateFormatted}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                Welcome back, {user?.name?.split(" ")[0] || "Employee"}! 👋
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-white/70">
                {user?.department ? `${user.department} • ` : ""}Track your daily work hours and punch activity
              </p>
            </div>

            {/* LIVE STATUS PILL & NETWORK BADGE */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white/90 backdrop-blur-md border border-white/15 shadow-sm"
                title="Punches are secured and restricted to HEXA_5G office Wi-Fi"
              >
                <Wifi size={13} className="text-emerald-400" />
                <span>HEXA_5G Network</span>
              </div>

              {!attendance?.checkIn && !isCheckedOut && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white/80 backdrop-blur-md border border-white/10">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Not Clocked In
                </div>
              )}

              {!isCheckedOut && attendance?.checkIn && (
                <div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold backdrop-blur-md shadow-sm border ${
                  attendance?.status === "on_break"
                    ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                }`}>
                  <span className="relative flex h-2 w-2">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      attendance?.status === "on_break" ? "bg-amber-400" : "bg-emerald-400"
                    }`} />
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${
                      attendance?.status === "on_break" ? "bg-amber-500" : "bg-emerald-500"
                    }`} />
                  </span>
                  {attendance?.status === "on_break" ? "On Break" : "Currently Working"}
                </div>
              )}

              {isCheckedOut && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500/20 text-indigo-300 px-4 py-2.5 text-xs font-bold backdrop-blur-md border border-indigo-400/30">
                  <CheckCircle2 size={14} className="text-indigo-400" />
                  Work Day Completed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STATS & TIMERS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Check In */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-500">Check In</span>
              <span className="h-7 w-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={15} />
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-slate-900">
              {formatTimeHM(attendance?.checkIn)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">First punch of day</p>
          </div>

          {/* Check Out */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-500">Check Out</span>
              <span className="h-7 w-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <LogOut size={15} />
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-slate-900">
              {formatTimeHM(attendance?.checkOut)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">End of shift</p>
          </div>

          {/* Live Work Time */}
          <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
            tickingRef.current === "work"
              ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200/80"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-500">Work Time</span>
              <span className={`h-7 w-7 rounded-xl flex items-center justify-center ${
                tickingRef.current === "work" ? "bg-emerald-100 text-emerald-700 animate-pulse" : "bg-slate-100 text-slate-500"
              }`}>
                <Clock size={15} />
              </span>
            </div>
            <p className={`text-lg sm:text-2xl font-bold font-mono ${
              tickingRef.current === "work" ? "text-emerald-700" : "text-slate-900"
            }`}>
              {formatTime(workTime)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {tickingRef.current === "work" ? "Active timer running" : "Accumulated time"}
            </p>
          </div>

          {/* Live Break Time */}
          <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
            tickingRef.current === "break"
              ? "bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20"
              : "bg-white border-slate-200/80"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-500">Break Time</span>
              <span className={`h-7 w-7 rounded-xl flex items-center justify-center ${
                tickingRef.current === "break" ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-slate-100 text-slate-500"
              }`}>
                <Coffee size={15} />
              </span>
            </div>
            <p className={`text-lg sm:text-2xl font-bold font-mono ${
              tickingRef.current === "break" ? "text-amber-700" : "text-slate-900"
            }`}>
              {formatTime(breakTime)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {tickingRef.current === "break" ? "Break timer running" : "Total break taken"}
            </p>
          </div>
        </div>

        {/* ACTION CONTROLS */}
        <div style={{ background: "#ffffff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {canPunchIn && (
              <button
                type="button"
                onClick={() => handlePunch("Punch In", "Working")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.15s ease",
                }}
              >
                <CheckCircle2 size={16} /> Start Work
              </button>
            )}

            {canBreakStart && (
              <button
                type="button"
                onClick={() => handlePunch("Break Start", "On Break")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#f59e0b",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.15s ease",
                }}
              >
                <Coffee size={16} /> Start Break
              </button>
            )}

            {canBreakEnd && (
              <button
                type="button"
                onClick={() => handlePunch("Break End", "Working")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#06b6d4",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.15s ease",
                }}
              >
                <CheckCircle2 size={16} /> Resume Work
              </button>
            )}

            {canPunchOut && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.15s ease",
                }}
              >
                <LogOut size={16} /> Check Out
              </button>
            )}

            {isCheckedOut && (
              <div
                style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "center",
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} color="#10b981" />
                <span>You have completed your shift for today.</span>
              </div>
            )}
          </div>
        </div>

        {/* TODAY'S PUNCH TIMELINE */}
        <div className="rounded-[28px] sm:rounded-[32px] border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">Today's Punch Log</h2>
              <p className="text-xs sm:text-sm text-slate-500">Live timestamped record of today's activities</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {punches.length} {punches.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {punches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <Clock size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No punch activity recorded yet today</p>
              <p className="text-xs text-slate-400 mt-0.5">Click "Start Work" to record your first punch</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {punches.map((p, idx) => {
                const isCheckIn  = p.action === "Punch In";
                const isCheckOut = p.action === "Punch Out";
                const isBreak    = p.action?.includes("Break");

                return (
                  <div key={p._id || idx} className="flex items-center justify-between py-3 sm:py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCheckIn
                          ? "bg-emerald-100 text-emerald-700"
                          : isCheckOut
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {isCheckIn && <CheckCircle2 size={16} />}
                        {isCheckOut && <LogOut size={16} />}
                        {isBreak && <Coffee size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{p.action}</p>
                        <p className="text-xs text-slate-400 capitalize">{p.status || "Recorded"}</p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                      {formatTimeHM(p.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* CHECK OUT CONFIRMATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
              <AlertTriangle size={26} />
            </div>
            <h3 className="text-xl font-black text-center text-slate-900">Confirm Check Out</h3>
            <p className="mt-1 text-center text-xs sm:text-sm text-slate-500">
              Are you sure you want to clock out for the day? This will complete your attendance record.
            </p>

            <div className="my-5 rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Work Time</p>
              <p className="mt-0.5 text-2xl font-mono font-black text-slate-900">{formatTime(workTime)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCheckOut}
                disabled={punching}
                className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-sm font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-500 transition-all disabled:opacity-60"
              >
                <LogOut size={16} />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNAUTHORIZED NETWORK DETECTED MODAL */}
      {networkError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-[28px] border border-rose-200/80 bg-white p-6 sm:p-7 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 shadow-inner">
              <WifiOff size={32} className="animate-pulse" />
            </div>

            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
                <ShieldAlert size={13} />
                Network Restriction Active
              </span>
            </div>

            <h3 className="text-xl font-black text-center text-slate-900">
              Unauthorized Network Detected
            </h3>

            <p className="mt-2 text-center text-xs sm:text-sm text-slate-600 leading-relaxed">
              Attendance punch is restricted to the company office network (<strong className="text-slate-900">{networkError.ssid || "HEXA_5G"}</strong>). Please connect to <strong className="text-indigo-600">{networkError.ssid || "HEXA_5G"}</strong> Wi-Fi to punch.
            </p>

            <div className="my-5 rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Required Office Wi-Fi</span>
                <span className="font-bold text-emerald-600 font-mono flex items-center gap-1.5">
                  <Wifi size={13} /> {networkError.ssid || "HEXA_5G"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Your Current Network IP</span>
                <span className="font-mono text-slate-700 font-bold truncate max-w-[190px]" title={networkError.clientIp}>
                  {networkError.clientIp || "Mobile Data / External"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 mb-5 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                Please disconnect from personal mobile data or hotspot and connect your device to <strong>{networkError.ssid || "HEXA_5G"}</strong>.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNetworkError(null)}
              className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 text-sm transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
