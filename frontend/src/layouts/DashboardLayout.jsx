import { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import useAuthStore from "../store/authStore";
import { Menu, User } from "lucide-react";

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  const initials = user?.name
    ? user.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "U";

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main */}
      <main className="flex-1 min-w-0 w-full flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 border-b border-white/10 px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-xl transition-all"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-wider text-white">HEXA</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/50 -mt-0.5">Staff Portal</p>
            </div>
          </div>

          <Link
            to="/profile"
            title="View Profile"
            className="flex items-center gap-2 rounded-xl bg-white/5 p-1.5 pr-2.5 hover:bg-white/10 transition-all border border-white/10"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {initials}
            </div>
            <div className="text-left hidden xs:block">
              <p className="text-xs font-bold text-white max-w-[90px] truncate leading-tight">{user?.name || "Staff"}</p>
              <p className="text-[10px] text-white/50 capitalize leading-none">{user?.role || "Employee"}</p>
            </div>
          </Link>
        </header>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-5 md:p-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}