// src/layouts/AdminSidebar.jsx

import logo from "../assets/images/logo.png";

import {
  LayoutDashboard,
  Clock3,
  BarChart3,
  Users,
  CalendarDays,
  ListTodo,
  X,
  LogOut,
  Settings,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import useAuthStore from "../store/authStore";

export default function AdminSidebar({
  mobileOpen,
  setMobileOpen,
}) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const menus = [
    {
      name: "Dashboard",
      path: "/admin",
      icon: <LayoutDashboard size={20} />,
    },
    {
      name: "Attendance",
      path: "/admin/attendance",
      icon: <BarChart3 size={20} />,
    },
    {
      name: "Leave Management",
      path: "/admin/leave",
      icon: <CalendarDays size={20} />,
    },
    {
      name: "Work Track",
      path: "/admin/worktrack",
      icon: <Clock3 size={20} />,
    },
    {
      name: "Tasks",
      path: "/admin/tasks",
      icon: <ListTodo size={20} />,
    },
    {
      name: "Staff Management",
      path: "/admin/staff",
      icon: <Users size={20} />,
    },
    {
      name: "Configuration",
      path: "/admin/config",
      icon: <Settings size={20} />,
    },
  ];

  const handleLogout = async () => {
    try {
      await useAuthStore.getState().logout();

      navigate("/login", {
        replace: true,
      });

      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* DESKTOP PLACEHOLDER SPACER (keeps adjacent content aligned while sidebar is fixed) */}
      <div className="hidden md:block w-72 flex-shrink-0" aria-hidden="true" />

      {/* FIXED SIDEBAR */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-72 flex-shrink-0 flex-col
          border-r border-white/10
          bg-black
          px-4 py-2
          overflow-y-auto
          transition-transform duration-300
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >

        {/* MOBILE CLOSE */}
        <div className="flex items-center justify-between p-2 pb-0 md:hidden">
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">Admin Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 active:scale-95 transition-all"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* LOGO */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "8px 16px",
          marginBottom: "20px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <img
            src={logo}
            alt="Hexa Logo"
            style={{
              width: "180px",
              height: "auto",
              marginTop: "10px",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
            }}
          />
        </div>

        {/* MENU */}
        <nav className="mt-2 flex flex-1 flex-col gap-3 px-4">

          {menus.map((menu, index) => {

            const isActive =
              location.pathname === menu.path;

            return (

              <Link
                key={index}
                to={menu.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-4
                  rounded-2xl px-4 py-4
                  text-sm font-semibold
                  transition-all duration-300
                  ${
                    isActive
                      ? "bg-white text-black"
                      : "bg-white/5 text-white hover:bg-white hover:text-black"
                  }
                `}
              >

                <span
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-2xl
                    ${
                      isActive
                        ? "bg-black text-white"
                        : "bg-white/10"
                    }
                  `}
                >
                  {menu.icon}
                </span>

                <span>{menu.name}</span>

              </Link>

            );

          })}

        </nav>

        {/* PROFILE & LOGOUT */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          <div className="mb-2 h-px bg-white/10" />

          {/* ADMIN PROFILE PILL */}
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 hover:bg-white/10 transition-all border border-white/10 text-white group"
            title="View Profile"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name || "Admin"}
                className="h-10 w-10 rounded-xl object-cover border border-white/20 shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-xs font-bold text-white shadow-sm">
                {user?.name ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "A"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight group-hover:text-amber-400 transition-colors">
                {user?.name || "Administrator"}
              </p>
              <p className="truncate text-xs text-white/50 capitalize mt-0.5">
                {user?.role || "Admin"}
              </p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="
              flex w-full items-center gap-4
              rounded-2xl
              bg-red-600 px-4 py-3
              text-sm font-bold text-white
              transition-all duration-300
              hover:bg-red-500 cursor-pointer
            "
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500">
              <LogOut size={16} />
            </span>
            Logout
          </button>
        </div>

      </aside>

    </>
  );
}