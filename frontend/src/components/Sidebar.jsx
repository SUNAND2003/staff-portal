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
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();

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
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50
          flex min-h-screen w-72 flex-col
          border-r border-white/10 bg-black
          px-4 py-4
          transition-transform duration-300
          md:static
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <button onClick={() => setMobileOpen(false)} className="mb-2 ml-auto text-white md:hidden">
          <X size={24} />
        </button>

        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "12px 16px", marginBottom: "40px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <img src={logo} alt="Hexa Logo" style={{
            width: "200px", height: "auto", marginTop: "20px",
            objectFit: "contain", left: "10%",
            transform: "translateX(-10%)", filter: "brightness(0) invert(1)",
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

        <div className="border-t border-white/10 pt-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-2xl bg-red-600 px-4 py-4 text-sm font-bold text-white transition-all duration-300 hover:bg-red-500"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}