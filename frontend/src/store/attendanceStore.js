import { create } from "zustand";
import { attendanceAPI, punchAPI } from "../services/api";

export const useAttendanceStore = create((set, get) => ({
  // Current attendance state
  attendance: null,
  punches: [],
  
  // UI states
  isLoading: false,
  isRecording: false,
  error: null,
  
  // Local state for UI responsiveness (will sync with server)
  workTime: 0,
  breakTime: 0,
  
  // Fetch today's attendance and punch records from API
  fetchTodayAttendance: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await attendanceAPI.getToday();
      set({ attendance: data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // Record punch (in/out/break start/end)
  recordPunch: async (action, status = null) => {
    set({ isRecording: true, error: null });
    try {
      const response = await attendanceAPI.checkIn();
      if (response?.success) {
        // Refresh attendance data from server
        await get().fetchTodayAttendance();
        set({ isRecording: false });
        return { success: true, data: response };
      } else {
        throw new Error(response?.message || "Failed to record punch");
      }
    } catch (err) {
      set({ error: err.message, isRecording: false });
      throw err;
    }
  },

  // Check in
  checkIn: async () => {
    set({ isRecording: true, error: null });
    try {
      await attendanceAPI.checkIn();
      await get().fetchTodayAttendance();
      set({ isRecording: false });
    } catch (err) {
      set({ error: err.message, isRecording: false });
      throw err;
    }
  },

  // Check out
  checkOut: async () => {
    set({ isRecording: true, error: null });
    try {
      await attendanceAPI.checkOut();
      await get().fetchTodayAttendance();
      set({ isRecording: false });
    } catch (err) {
      set({ error: err.message, isRecording: false });
      throw err;
    }
  },

  // Start break
  startBreak: async () => {
    set({ isRecording: true, error: null });
    try {
      await attendanceAPI.breakStart();
      await get().fetchTodayAttendance();
      set({ isRecording: false });
    } catch (err) {
      set({ error: err.message, isRecording: false });
      throw err;
    }
  },

  // End break
  endBreak: async () => {
    set({ isRecording: true, error: null });
    try {
      await attendanceAPI.breakEnd();
      await get().fetchTodayAttendance();
      set({ isRecording: false });
    } catch (err) {
      set({ error: err.message, isRecording: false });
      throw err;
    }
  },

  // Update local work/break time (for UI timer)
  updateWorkTime: () =>
    set((state) => ({
      workTime: state.workTime + 1,
    })),

  updateBreakTime: () =>
    set((state) => ({
      breakTime: state.breakTime + 1,
    })),

  // Reset timers
  resetTimers: () =>
    set({
      workTime: 0,
      breakTime: 0,
    }),

  // Clear error
  clearError: () =>
    set({ error: null }),

  // Export/download my punch history
  downloadMyPunchHistory: async (filter = {}) => {
    try {
      const response = await punchAPI.getMyPunches(filter);
      return response?.punches || [];
    } catch (err) {
      console.error("Error in downloadMyPunchHistory store action:", err);
      throw err;
    }
  },

  // Export/download all employee punches
  downloadAllEmployeePunches: async (date = 'all') => {
    try {
      const response = await punchAPI.getAllPunches({ date, limit: 100000 });
      return response?.punches || [];
    } catch (err) {
      console.error("Error in downloadAllEmployeePunches store action:", err);
      throw err;
    }
  },
}));