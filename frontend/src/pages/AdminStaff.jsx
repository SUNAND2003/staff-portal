// src/pages/AdminStaff.jsx

import {
  useState,
  useEffect,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import useAuthStore from "../store/authStore";
import AdminSidebar from "../layouts/AdminSidebar";
import { employeeAPI } from "../services/api";

import {
  Users,
  Plus,
  Eye,
  EyeOff,
  Shield,
  User,
  CheckCircle2,
  XCircle,
  Trash2,
  X,
  Menu,
  LogOut,
  Lock,
} from "lucide-react";

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function AdminStaff() {

  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Validate admin role on component mount
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Password reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmployeeId, setResetEmployeeId] = useState(null);
  const [resetEmployeeName, setResetEmployeeName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    department: "",
    email: "",
    designation: "",
    phone: "",
    role: "employee",
  });

  // Load employees on mount
  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    try {
      setInitialLoading(true);
      const response = await employeeAPI.getAll();
      setStaffList(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setFormError("Failed to load employees");
    } finally {
      setInitialLoading(false);
    }
  };

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");

    const { name, username, password, department } = form;

    if (!name.trim() || !username.trim() || !password.trim() || !department.trim()) {
      setFormError("Name, username, password, and department are required.");
      return;
    }

    if (username.length < 3) {
      setFormError("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      ['email', 'designation', 'phone'].forEach((k) => {
        if (!payload[k]?.trim()) delete payload[k];
      });

      const newEmployee = await employeeAPI.create(payload);

      setFormSuccess(`Employee created — ID: ${newEmployee.employeeId}`);
      setForm({
        name: "",
        username: "",
        password: "",
        department: "",
        email: "",
        designation: "",
        phone: "",
        role: "employee",
      });
      setShowForm(false);
      await refresh();
    } catch (error) {
      setFormError(error.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(employeeId) {
    try {
      await employeeAPI.toggleStatus(employeeId);
      await refresh();
    } catch (error) {
      console.error("Error toggling employee status:", error);
      setFormError(error.message || "Failed to toggle employee status");
    }
  }

  async function handleDelete(employeeId) {
    if (!window.confirm("Remove this employee permanently? This cannot be undone.")) return;
    try {
      await employeeAPI.delete(employeeId);
      setFormSuccess("Employee deleted successfully");
      await refresh();
    } catch (error) {
      console.error("Error deleting employee:", error);
      setFormError(error.message || "Failed to delete employee");
    }
  }

  function openResetModal(employeeId, employeeName) {
    setResetEmployeeId(employeeId);
    setResetEmployeeName(employeeName);
    setNewPassword("");
    setResetError("");
    setResetModalOpen(true);
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError("");

    if (!newPassword || newPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }

    setResetLoading(true);
    try {
      await employeeAPI.resetPassword(resetEmployeeId, newPassword);

      setFormSuccess(`Password reset for ${resetEmployeeName} successfully`);
      setResetModalOpen(false);
      setNewPassword("");
      setResetEmployeeId(null);
      setResetEmployeeName("");
      setResetError("");
      await refresh(); // ← refresh pulls updated plainPassword from backend
    } catch (error) {
      console.error("Reset password error:", error);
      setResetError(error.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const employees = staffList.filter((s) => s.role === "employee");
  const activeCount = employees.filter((s) => s.status === "active").length;
  const inactiveCount = employees.filter((s) => s.status !== "active").length;

  return (
    <div className="flex min-h-screen bg-white">

      {/* SIDEBAR */}
      <AdminSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER */}
        <div className="relative overflow-hidden bg-black border-b border-zinc-800 px-6 py-5 shadow-2xl">
          <div className="flex items-center justify-between">

            {/* LEFT */}
            <div className="flex items-center gap-4">
              <button
                className="text-white md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={24} />
              </button>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-white">{user?.name}</p>
                <p className="text-xs text-white/50">Administrator</p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#111827] shadow-lg">
                {user?.name?.[0] || "A"}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>

          </div>
        </div>
        {/* END HEADER */}

        {/* CONTENT */}
        <div className="mx-auto w-full max-w-7xl p-5 md:p-7">

          {/* TOP */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-gray-900">Staff Management</h2>
              <p className="mt-2 text-sm text-gray-500">
                Create and manage employee accounts professionally
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setFormError("");
                setFormSuccess("");
              }}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Cancel" : "New Employee"}
            </button>
          </div>

          {/* STATS */}
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total Employees"
              value={employees.length}
              color="bg-blue-100 text-blue-700"
              icon={<Users size={22} />}
            />
            <StatCard
              label="Active"
              value={activeCount}
              color="bg-emerald-100 text-emerald-700"
              icon={<CheckCircle2 size={22} />}
            />
            <StatCard
              label="Inactive"
              value={inactiveCount}
              color="bg-red-100 text-red-700"
              icon={<XCircle size={22} />}
            />
          </div>

          {/* SUCCESS */}
          {formSuccess && !showForm && (
            <div className="mb-6 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={18} />
              {formSuccess}
              <button
                className="ml-auto text-emerald-500 hover:text-emerald-700"
                onClick={() => setFormSuccess("")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* FORM */}
          {showForm && (
            <div className="mb-7 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-6 text-2xl font-black text-gray-900">Create Employee Account</h3>
              <form onSubmit={handleCreate}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Full Name">
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Employee name"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    />
                  </Field>
                  <Field label="Username">
                    <input
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      placeholder="Username"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Password (min 6 chars)"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    />
                  </Field>
                  <Field label="Department">
                    <input
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      placeholder="Department"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                    />
                  </Field>
                  <Field label="Role">
                    <select
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:shadow-lg"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Field>
                  <Field label="Employee ID">
                    <input
                      value="Auto-generated"
                      disabled
                      className="w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-slate-100 px-4 py-3 text-sm text-gray-400"
                    />
                  </Field>
                </div>

                {formError && (
                  <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {formError}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-70"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Plus size={15} />
                    )}
                    Create Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAFF TABLE */}
          <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-slate-700" />
                <h3 className="text-2xl font-black text-gray-900">All Staff</h3>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-gray-600">
                  {staffList.length} total
                </span>
              </div>
              <button
                onClick={() => setShowAllPasswords(!showAllPasswords)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
                  showAllPasswords
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : "bg-blue-100 text-blue-700 border border-blue-200"
                }`}
              >
                {showAllPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showAllPasswords ? "Hide All Passwords" : "Show All Passwords"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    {["Employee ID", "Name", "Username", "Password", "Department", "Role", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {initialLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                        Loading employees...
                      </td>
                    </tr>
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                        No staff found.
                      </td>
                    </tr>
                  ) : staffList.map((s) => (
                    <tr
                      key={s.employeeId}
                      className="transition-all duration-300 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                          {s.employeeId}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#111827] to-[#374151] text-xs font-bold text-white shadow-md">
                            {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-gray-600">{s.username}</span>
                      </td>

                      {/* PASSWORD — read directly from s.plainPassword (returned by backend) */}
                      <td className="px-5 py-4">
                        {s.plainPassword ? (
                          <span className="font-mono text-xs text-gray-600 select-all">
                            {showAllPasswords ? s.plainPassword : "••••••••"}
                          </span>
                        ) : (
                          <span className="text-xs italic text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">{s.department}</td>
                      <td className="px-5 py-4">
                        {s.role === "admin" ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                            <Shield size={11} />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            <User size={11} />
                            Employee
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {s.status === "active" ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 size={11} />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                            <XCircle size={11} />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {s.username !== "admin" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggle(s.employeeId)}
                              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all duration-300 ${
                                s.status === "active"
                                  ? "border border-red-200 bg-red-100 text-red-600 hover:bg-red-200"
                                  : "border border-emerald-200 bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                              }`}
                            >
                              {s.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              title="Reset password"
                              onClick={() => openResetModal(s.employeeId, s.name)}
                              className="rounded-xl p-2 text-gray-400 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Lock size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(s.employeeId)}
                              className="rounded-xl p-2 text-gray-400 transition-all duration-300 hover:bg-red-50 hover:text-red-500"
                              title="Delete employee"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs italic text-gray-400">Protected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        {/* END CONTENT */}

        {/* PASSWORD RESET MODAL */}
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
              <h3 className="mb-6 text-2xl font-black text-gray-900">Reset Password</h3>
              <p className="mb-4 text-sm text-gray-600">
                Resetting password for <strong>{resetEmployeeName}</strong>
              </p>

              <form onSubmit={handleResetPassword}>
                <Field label="New Password">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-[#111827] focus:bg-white focus:shadow-lg"
                  />
                </Field>

                {/* ← was formError (wrong state), now correctly uses resetError */}
                {resetError && (
                  <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {resetError}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-70"
                  >
                    {resetLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Lock size={15} />
                    )}
                    Reset Password
                  </button>
                  <button     
                    type="button"
                    onClick={() => {
                      setResetModalOpen(false);
                      setNewPassword("");
                      setResetError("");
                    }}
                    className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      {/* END MAIN */}

    </div>
  );
}

// ─────────────────────────────────────────────
// FIELD
// ─────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// STAT CARD
// ───────────────────────────────────────────── 

function StatCard({ label, value, color, icon }) {
  return (
    <div className="rounded-[30px] border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <h3 className="text-4xl font-black text-gray-900">{value}</h3>
      <p className="mt-2 text-sm font-semibold text-gray-500">{label}</p>
    </div>
  );
}