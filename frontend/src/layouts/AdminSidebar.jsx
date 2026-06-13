// src/layouts/AdminSidebar.jsx

import logo from "../assets/images/logo.png";

import {
  LayoutDashboard,
  Clock3,
  BarChart3,
  Users,
  CalendarDays,
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
      icon: <LayoutDashboard size={20} />,
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

      {/* SIDEBAR */}
      <aside
        className={`
          fixed left-0 top-0 z-50
          flex min-h-screen w-72 flex-col
          border-r border-white/10
          bg-black
          px-4 py-2
          transition-transform duration-300
          md:static
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >

        {/* MOBILE CLOSE */}
        <div className="flex justify-end p-2 md:hidden">
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>
        </div>

        {/* LOGO */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 16px",
          marginBottom: "40px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <img
            src={logo}
            alt="Hexa Logo"
            style={{
              width: "200px",
              height: "auto",
              marginTop: "20px",
              objectFit: "contain",
              left: "10%",
              transform: "translateX(-10%)",
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

        {/* LOGOUT */}
        <div className="px-4 pb-4">

          <div className="mb-3 h-px bg-white/10" />

          <button
            onClick={handleLogout}
            className="
              flex w-full items-center gap-4
              rounded-2xl
              bg-red-600 px-4 py-4
              text-sm font-bold text-white
              transition-all duration-300
              hover:bg-red-500
            "
          >

            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500">
              <LogOut size={18} />
            </span>

            Logout

          </button>

        </div>

      </aside>

    </>
  );
}