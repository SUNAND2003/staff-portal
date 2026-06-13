import { Menu } from "lucide-react";

export default function MobileTopbar() {
  return (
    <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50">

      <div className="flex items-center gap-3">

        <img
          src="https://cdn-icons-png.flaticon.com/512/5968/5968705.png"
          alt="logo"
          className="w-10 h-10 rounded-xl bg-white p-2"
        />

        <div>

          <h1 className="text-xl font-bold leading-none">
            HEXA
          </h1>

          <p className="text-xs text-slate-400">
            Branding
          </p>

        </div>

      </div>

      <button>

        <Menu size={28} />
 
      </button>

    </div>
  );
}