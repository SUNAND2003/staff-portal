import logo from "../assets/images/logo.png";

import {
  LayoutDashboard,
  BarChart3,
  ListTodo,
  Users,
  CalendarDays,
  LogOut,
  X,
  Clock,
  User,
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleLogout = async () => {
    try {
      await useAuthStore.getState().logout();
      navigate("/login", { replace: true });
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const menus = [
    { name: "Dashboard",   path: "/dashboard",   icon: <LayoutDashboard size={22} /> },
    { name: "Reports",     path: "/reports",     icon: <BarChart3 size={22} /> },
    { name: "Tasks",       path: "/tasks",       icon: <ListTodo size={22} /> },  // ✅ employee tasks only
    { name: "Attendance",  path: "/attendance",  icon: <Clock size={22} /> },
    { name: "WorkTracker", path: "/worktracker", icon: <Users size={22} /> },
    { name: "Leave",       path: "/leave",       icon: <CalendarDays size={22} /> },
    { name: "Profile",     path: "/profile",     icon: <User size={22} /> },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* DESKTOP PLACEHOLDER SPACER (keeps adjacent content aligned while sidebar is fixed) */}
      <div className="hidden md:block w-72 flex-shrink-0" aria-hidden="true" />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-72 flex-shrink-0 flex-col
          border-r border-white/10 bg-black
          px-4 py-4
          overflow-y-auto
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between pb-2 md:hidden">
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">Navigation</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "8px 16px", marginBottom: "20px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <img src={logo} alt="Hexa Logo" style={{
            width: "180px", height: "auto", marginTop: "10px",
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }} />
        </div>

        <nav className="mt-2 flex flex-1 flex-col gap-3">
          {menus.map((menu, i) => {
            const active = location.pathname === menu.path;
            return (
              <Link
                key={i}
                to={menu.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-4 rounded-2xl px-4 py-4
                  text-[15px] font-semibold transition-all duration-300
                  ${active
                    ? "bg-white text-black"
                    : "bg-white/5 text-white hover:bg-white hover:text-black"
                  }
                `}
              >
                {menu.icon}
                <span>{menu.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
          {/* USER PROFILE PILL */}
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 hover:bg-white/10 transition-all border border-white/10 text-white group"
            title="View Profile"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name || "Avatar"}
                className="h-10 w-10 rounded-xl object-cover border border-white/20 shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                {user?.name ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight group-hover:text-emerald-400 transition-colors">
                {user?.name || "Employee"}
              </p>
              <p className="truncate text-xs text-white/50 capitalize mt-0.5">
                {user?.designation || user?.department || user?.role || "Staff"}
              </p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-2xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:bg-red-500 cursor-pointer"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}