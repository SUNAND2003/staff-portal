import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const data = await authAPI.login(credentials);

          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });

          return {
            success: true,
            user: data.user,
          };
        } catch (err) {
          set({
            error: err.message,
            isLoading: false,
          });

          return {
            success: false,
            error: err.message,
          };
        }
      },

     // ✅ COMPLETE LOGOUT
logout: async () => {
  try {
    await authAPI.logout();
  } catch (error) {
    console.log('Logout API error:', error);
  }

  // Reset Zustand state
  set({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Clear persisted Zustand storage
  localStorage.removeItem('auth-storage');

  // Clear all auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('session');

  sessionStorage.clear();

  // Clear Zustand persist cache
  try {
    useAuthStore.persist.clearStorage();
  } catch (error) {
    console.log(error);
  }
},

      updateUser: (updates) => {
        set((state) => ({
          user: {
            ...state.user,
            ...updates,
          },
        }));
      },

      clearError: () =>
        set({
          error: null,
        }),

      isManager: () => {
        const { user } = get();

        return (
          user?.role === 'manager' ||
          user?.role === 'admin'
        );
      },

      isAdmin: () =>
        get().user?.role === 'admin',
    }),
    {
      name: 'auth-storage',

      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated:
          state.isAuthenticated,
      }),
    }
  )
);

export { useAuthStore };
export default useAuthStore;