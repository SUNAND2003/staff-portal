import { useState } from "react";

import Sidebar from "../components/Sidebar";

import { Menu } from "lucide-react";

export default function DashboardLayout({ children }) {

  const [mobileOpen, setMobileOpen] = useState(false);

  return (

    <div className="flex min-h-screen bg-slate-100 overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main */}
      <main className="flex-1 w-full overflow-y-auto">

        {/* Mobile Header */}
        <div className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-30">

          <button
            onClick={() => setMobileOpen(true)}
            className="bg-slate-900 text-white p-3 rounded-xl"
          >

            <Menu size={24} />

          </button>

          <h1 className="text-2xl font-bold text-slate-800">
            HEXA
          </h1>

          <img
            src="https://i.pravatar.cc/40"
            alt="profile"
            className="w-10 h-10 rounded-full"
          />

        </div>

        {/* Content */}
        <div className="p-4 md:p-6">

          {children}

        </div>

      </main>

    </div>
  );
}