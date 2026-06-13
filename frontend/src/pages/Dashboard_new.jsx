import { useEffect, useState, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { attendanceAPI, punchAPI } from "../services/api";
import useAuthStore from "../store/authStore";
import { Clock, Coffee, LogOut, AlertTriangle, CheckCircle2, Loader } from "lucide-react";
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
  const timerRef = useRef(null);

  // Load today's attendance and punch records
  const loadAttendanceData = async () => {
    try {
      const data = await attendanceAPI.getToday();
      setAttendance(data);

      // Calculate elapsed time
      if (data?.checkIn && !data?.checkOut) {
        const checkInTime = new Date(data.checkIn).getTime();
        const elapsed = Math.floor((Date.now() - checkInTime) / 1000);
        const breakSecs = (data.breaks || []).reduce((sum, b) => {
          if (b.end) return sum + (b.end - b.start) / 1000;
          return sum;
        }, 0);
        setWorkTime(Math.max(0, elapsed - breakSecs));
      } else if (data?.workSeconds) {
        setWorkTime(data.workSeconds);
      }

      const punches = await punchAPI.getTodayPunches();
      setPunches(punches?.punches || punches || []);
    } catch (err) {
      console.error("Error loading attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
    const interval = setInterval(loadAttendanceData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update work time timer
  useEffect(() => {
    if (!attendance?.checkIn || attendance?.checkOut) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setWorkTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attendance]);

  const handlePunch = async (action, status) => {
    setPunching(true);
    try {
      const response = await punchAPI.recordPunch({ action, status });
      
      if (response?.success) {
        toast.success(`${action} recorded successfully!`);
        loadAttendanceData();
      } else {
        toast.error(response?.message || "Failed to record punch");
      }
    } catch (err) {
      toast.error(err.message || "Error recording punch");
    } finally {
      setPunching(false);
    }
  };

  const confirmCheckOut = () => {
    setShowModal(false);
    handlePunch("Punch Out", "Completed");
  };

  const canPunchIn = !attendance?.checkIn && !attendance?.checkOut;
  const canPunchOut = attendance?.checkIn && !attendance?.checkOut;
  const canBreakStart = attendance?.checkIn && !attendance?.checkOut && attendance?.status !== "on_break";
  const canBreakEnd = attendance?.status === "on_break";
  const isCheckedOut = attendance?.checkOut;

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <Loader size={48} className="animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: "24px", background: "#f8fafc", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", margin: "0 0 24px" }}>
          Welcome, {user?.name || "Employee"}
        </h1>

        {/* Status Section */}
        <div style={{ 
          background: "#ffffff", 
          borderRadius: 16, 
          padding: "24px",
          marginBottom: 24,
          border: "1px solid #e2e8f0" 
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", margin: 0 }}>Today's Status</h2>
            {!isCheckedOut && attendance?.checkIn && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0"
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                Working
              </span>
            )}
            {isCheckedOut && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                background: "#eef2ff",
                color: "#3730a3",
                border: "1px solid #c7d2fe"
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
                Completed
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>CHECK IN</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                {formatTimeHM(attendance?.checkIn)}
              </p>
            </div>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>CHECK OUT</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                {formatTimeHM(attendance?.checkOut)}
              </p>
            </div>
          </div>
        </div>

        {/* Timers */}
        {attendance?.checkIn && !isCheckedOut && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: "24px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #10b981"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Clock size={18} color="#10b981" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>WORK TIME</span>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: 36, 
                fontWeight: 700, 
                color: "#0f172a", 
                fontFamily: "monospace" 
              }}>
                {formatTime(workTime)}
              </p>
            </div>
            <div style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: "24px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #f59e0b"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Coffee size={18} color="#f59e0b" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>BREAK TIME</span>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: 36, 
                fontWeight: 700, 
                color: "#0f172a", 
                fontFamily: "monospace" 
              }}>
                {formatTime(breakTime)}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "24px",
          marginBottom: 24,
          border: "1px solid #e2e8f0"
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {canPunchIn && (
              <button
                onClick={() => handlePunch("Punch In", "Working")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <CheckCircle2 size={16} />
                Punch In
              </button>
            )}
            {canBreakStart && (
              <button
                onClick={() => handlePunch("Break Start", "On Break")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#f59e0b",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <Coffee size={16} />
                Break
              </button>
            )}
            {canBreakEnd && (
              <button
                onClick={() => handlePunch("Break End", "Working")}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#06b6d4",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <CheckCircle2 size={16} />
                Resume Work
              </button>
            )}
            {canPunchOut && (
              <button
                onClick={() => setShowModal(true)}
                disabled={punching}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: punching ? "not-allowed" : "pointer",
                  opacity: punching ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <LogOut size={16} />
                Check Out
              </button>
            )}
          </div>
        </div>

        {/* Punch History */}
        {punches.length > 0 && (
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "24px",
            border: "1px solid #e2e8f0"
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Today's Activity</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {punches.map((p) => (
                <div
                  key={p._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{p.action}</span>
                  <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                    {formatTimeHM(p.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Check Out Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "32px 28px 24px",
            width: "100%",
            maxWidth: 380,
            boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fffbeb",
              border: "2px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <AlertTriangle size={28} color="#f59e0b" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
              Confirm Check Out
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
              Are you sure? This action cannot be undone.
            </p>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "14px 28px",
              marginBottom: 20
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>TOTAL WORK TIME</span>
              <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
                {formatTime(workTime)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569"
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckOut}
                disabled={punching}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: punching ? "not-allowed" : "pointer",
                  border: "none",
                  background: "#ef4444",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: punching ? 0.7 : 1
                }}
              >
                <LogOut size={16} />
                Check Out
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
