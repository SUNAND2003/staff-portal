import { create } from 'zustand';
import { leaveAPI } from '../services/api';

const useLeaveStore = create((set, get) => ({
  leaves: [],
  leaveBalance: null,
  isLoading: false,
  error: null,

  fetchLeaves: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await leaveAPI.getMyLeaves();
      const leaves = response?.leaves || response || [];
      set({ leaves, isLoading: false });
      return leaves;
    } catch (e) {
      const errorMsg = e.message || 'Failed to fetch leaves';
      set({ error: errorMsg, isLoading: false });
      throw e;
    }
  },

  fetchLeaveBalance: async () => {
    set({ error: null });
    try {
      const data = await leaveAPI.getLeaveBalance();
      set({ leaveBalance: data });
      return data;
    } catch (e) {
      const errorMsg = e.message || 'Failed to fetch leave balance';
      set({ error: errorMsg });
      throw e;
    }
  },

  applyLeave: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const leave = await leaveAPI.applyLeave(data);
      set((state) => ({ leaves: [leave, ...state.leaves], isLoading: false }));
      return { success: true, leave };
    } catch (e) {
      const errorMsg = e.message || 'Failed to apply leave';
      set({ error: errorMsg, isLoading: false });
      throw e;
    }
  },

  cancelLeave: async (id) => {
    set({ error: null });
    try {
      await leaveAPI.cancelLeave(id);
      set((state) => ({ leaves: state.leaves.filter((l) => l._id !== id) }));
    } catch (e) {
      const errorMsg = e.message || 'Failed to cancel leave';
      set({ error: errorMsg });
      throw e;
    }
  },

  approveLeave: async (id, note = '') => {
    set({ error: null });
    try {
      await leaveAPI.approveLeave(id, note);
      set((state) => ({
        leaves: state.leaves.map((l) => l._id === id ? { ...l, status: 'approved' } : l),
      }));
    } catch (e) {
      const errorMsg = e.message || 'Failed to approve leave';
      set({ error: errorMsg });
      throw e;
    }
  },

  rejectLeave: async (id, note = '') => {
    set({ error: null });
    try {
      await leaveAPI.rejectLeave(id, note);
      set((state) => ({
        leaves: state.leaves.map((l) => l._id === id ? { ...l, status: 'rejected' } : l),
      }));
    } catch (e) {
      const errorMsg = e.message || 'Failed to reject leave';
      set({ error: errorMsg });
      throw e;
    }
  },

  getLeavesByStatus: (status) => {
    return get().leaves.filter((l) => l.status === status);
  },

  getLeaveBalance: () => {
    const { leaves } = get();
    const approved = leaves.filter((l) => l.status === 'approved');
    const used = {};
    approved.forEach((l) => {
      used[l.type] = (used[l.type] || 0) + l.days;
    });
    return used;
  },

  clearError: () => set({ error: null }),
}));

export default useLeaveStore;