import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { taskAPI } from '../services/api';

const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,
      lastFetchedAs: null, // ✅ track which role last fetched

      fetchTasks: async (isManager = false) => {
        set({ isLoading: true, error: null });
        try {
          const response = isManager
            ? await taskAPI.getAllTasks()
            : await taskAPI.getMyTasks();

          const tasks = Array.isArray(response)
            ? response
            : (response?.tasks || response?.data || []);

          set({ tasks, isLoading: false, lastFetchedAs: isManager ? 'manager' : 'employee' });
          return tasks;
        } catch (e) {
          const errorMsg = e.message || 'Failed to fetch tasks';
          set({ error: errorMsg, isLoading: false });
          throw e;
        }
      },

      createTask: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const task = await taskAPI.createTask(data);
          // ✅ unwrap if backend wraps in { task: ... }
          const created = task?.task || task;
          set((state) => ({ tasks: [created, ...state.tasks], isLoading: false }));
          return created;
        } catch (e) {
          const errorMsg = e.message || 'Failed to create task';
          set({ error: errorMsg, isLoading: false });
          throw e;
        }
      },

      updateTask: async (id, data) => {
        set({ error: null });
        try {
          const response = await taskAPI.updateTask(id, data);
          const updated = response?.task || response;
          set((state) => ({
            tasks: state.tasks.map((t) => (t._id === id ? { ...t, ...updated } : t)),
          }));
          return updated;
        } catch (e) {
          const errorMsg = e.message || 'Failed to update task';
          set({ error: errorMsg });
          throw e;
        }
      },

      deleteTask: async (id) => {
        set({ error: null });
        try {
          await taskAPI.deleteTask(id);
          set((state) => ({ tasks: state.tasks.filter((t) => t._id !== id) }));
        } catch (e) {
          const errorMsg = e.message || 'Failed to delete task';
          set({ error: errorMsg });
          throw e;
        }
      },

      // ✅ Call this on logout so stale tasks don't show for next user
      clearTasks: () => set({ tasks: [], lastFetchedAs: null, error: null }),

      getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'task-storage', // localStorage key
      // ✅ Only persist tasks list — don't persist loading/error state
      partialize: (state) => ({
        tasks: state.tasks,
        lastFetchedAs: state.lastFetchedAs,
      }),
    }
  )
);

export default useTaskStore;