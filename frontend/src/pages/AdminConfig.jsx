import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../layouts/AdminSidebar";
import useAuthStore from "../store/authStore";
import { configAPI } from "../services/api";
import { Clock, LogOut, Menu, CheckCircle2, AlertCircle, X, Wifi, Shield, ShieldCheck, ShieldAlert, Globe, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminConfig() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Validate admin role
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    punchInTime: "09:00",
    punchOutTime: "20:00",
    lateThresholdMinutes: 15,
    breakDurationMinutes: 60,
    notes: "",
    networkRestrictionEnabled: true,
    allowedWifiSsid: "HEXA_5G",
    allowedIpv6Prefixes: "2405:201:f006:b86f",
    allowedIpv4Addresses: "49.47.199.103, 192.168.29.",
    allowedSubnets: "192.168.29.",
    allowAdminBypass: true,
  });
  const [detectedClientIp, setDetectedClientIp] = useState("");
  const [copiedIp, setCopiedIp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await configAPI.getWorkingHours();
      if (data) {
        setFormData({
          punchInTime: data.punchInTime || "09:00",
          punchOutTime: data.punchOutTime || "20:00",
          lateThresholdMinutes: data.lateThresholdMinutes !== undefined ? data.lateThresholdMinutes : 15,
          breakDurationMinutes: data.breakDurationMinutes !== undefined ? data.breakDurationMinutes : 60,
          notes: data.notes || "",
          networkRestrictionEnabled: data.networkRestrictionEnabled !== undefined ? data.networkRestrictionEnabled : true,
          allowedWifiSsid: data.allowedWifiSsid || "HEXA_5G",
          allowedIpv6Prefixes: Array.isArray(data.allowedIpv6Prefixes)
            ? data.allowedIpv6Prefixes.join(", ")
            : (data.allowedIpv6Prefixes || "2405:201:f006:b86f"),
          allowedIpv4Addresses: Array.isArray(data.allowedIpv4Addresses)
            ? data.allowedIpv4Addresses.join(", ")
            : (data.allowedIpv4Addresses || "49.47.199.103, 192.168.29."),
          allowedSubnets: Array.isArray(data.allowedSubnets)
            ? data.allowedSubnets.join(", ")
            : (data.allowedSubnets || "192.168.29."),
          allowAdminBypass: data.allowAdminBypass !== undefined ? data.allowAdminBypass : true,
        });

        if (data.detectedClientIp) {
          setDetectedClientIp(data.detectedClientIp);
        }
      }
    } catch (err) {
      console.error("Error loading config:", err);
      setError("Failed to load working hours configuration");
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  // Load working hours configuration
  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name.includes("Minutes") ? parseInt(value) || 0 : value,
    }));
    setError("");
  };

  const handleUseCurrentIp = () => {
    if (!detectedClientIp) return;
    // Check if IPv6 or IPv4
    if (detectedClientIp.includes(":")) {
      // IPv6: use /64 prefix (first 4 segments)
      const segments = detectedClientIp.split(":").slice(0, 4).join(":");
      const current = formData.allowedIpv6Prefixes ? formData.allowedIpv6Prefixes.split(",").map(s => s.trim()) : [];
      if (!current.includes(segments)) {
        const updated = [...current, segments].filter(Boolean).join(", ");
        setFormData(prev => ({ ...prev, allowedIpv6Prefixes: updated }));
        toast.success(`Added current IPv6 prefix: ${segments}`);
      } else {
        toast.info("Current IPv6 prefix already in allowed list");
      }
    } else {
      // IPv4
      const current = formData.allowedIpv4Addresses ? formData.allowedIpv4Addresses.split(",").map(s => s.trim()) : [];
      if (!current.includes(detectedClientIp)) {
        const updated = [...current, detectedClientIp].filter(Boolean).join(", ");
        setFormData(prev => ({ ...prev, allowedIpv4Addresses: updated }));
        toast.success(`Added current IPv4: ${detectedClientIp}`);
      } else {
        toast.info("Current IP already in allowed list");
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.punchInTime || !formData.punchOutTime) {
      setError("Punch in and punch out times are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        allowedIpv6Prefixes: (formData.allowedIpv6Prefixes || "").split(",").map((s) => s.trim()).filter(Boolean),
        allowedIpv4Addresses: (formData.allowedIpv4Addresses || "").split(",").map((s) => s.trim()).filter(Boolean),
        allowedSubnets: (formData.allowedSubnets || "").split(",").map((s) => s.trim()).filter(Boolean),
      };

      const response = await configAPI.updateWorkingHours(payload);
      setSuccess("Configuration updated successfully!");
      toast.success("Configuration updated!");
      
      // Update the form with saved data
      if (response.config) {
        setFormData({
          punchInTime: response.config.punchInTime,
          punchOutTime: response.config.punchOutTime,
          lateThresholdMinutes: response.config.lateThresholdMinutes,
          breakDurationMinutes: response.config.breakDurationMinutes,
          notes: response.config.notes || "",
          networkRestrictionEnabled: response.config.networkRestrictionEnabled !== undefined ? response.config.networkRestrictionEnabled : true,
          allowedWifiSsid: response.config.allowedWifiSsid || "HEXA_5G",
          allowedIpv6Prefixes: Array.isArray(response.config.allowedIpv6Prefixes)
            ? response.config.allowedIpv6Prefixes.join(", ")
            : (response.config.allowedIpv6Prefixes || ""),
          allowedIpv4Addresses: Array.isArray(response.config.allowedIpv4Addresses)
            ? response.config.allowedIpv4Addresses.join(", ")
            : (response.config.allowedIpv4Addresses || ""),
          allowedSubnets: Array.isArray(response.config.allowedSubnets)
            ? response.config.allowedSubnets.join(", ")
            : (response.config.allowedSubnets || ""),
          allowAdminBypass: response.config.allowAdminBypass !== undefined ? response.config.allowAdminBypass : true,
        });
      }
    } catch (err) {
      console.error("Error saving config:", err);
      setError(err.message || "Failed to save configuration");
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* SIDEBAR */}
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-black border-b border-zinc-800 px-6 py-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="text-white md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={24} />
              </button>
            </div>

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
        <div className="mx-auto w-full max-w-4xl p-5 md:p-7">
          
          {/* HEADING */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Clock size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">Working Hours Configuration</h2>
                <p className="mt-1 text-sm text-gray-500">Set company-wide punch in/out times and break policies</p>
              </div>
            </div>
          </div>

          {/* ALERTS */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-emerald-700">{success}</p>
              <button
                onClick={() => setSuccess("")}
                className="ml-auto text-emerald-500 hover:text-emerald-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* FORM */}
          {loading ? (
            <div className="flex items-center justify-center rounded-[32px] border border-gray-200 bg-white p-12 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                <span className="text-sm font-semibold text-gray-600">Loading configuration...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
              
              {/* PUNCH TIMES */}
              <div className="mb-8">
                <h3 className="mb-5 text-lg font-bold text-gray-900">Daily Working Hours</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">
                      Punch In Time
                    </label>
                    <input
                      type="time"
                      name="punchInTime"
                      value={formData.punchInTime}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">
                      Punch Out Time
                    </label>
                    <input
                      type="time"
                      name="punchOutTime"
                      value={formData.punchOutTime}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                    />
                  </div>
                </div>
              </div>

              {/* POLICIES */}
              <div className="mb-8 border-t border-gray-100 pt-8">
                <h3 className="mb-5 text-lg font-bold text-gray-900">Attendance Policies</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">
                      Late Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      name="lateThresholdMinutes"
                      value={formData.lateThresholdMinutes}
                      onChange={handleChange}
                      min="0"
                      max="120"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                    />
                    <p className="mt-2 text-xs text-gray-500">Minutes after punch in time to mark as late</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">
                      Break Duration (minutes)
                    </label>
                    <input
                      type="number"
                      name="breakDurationMinutes"
                      value={formData.breakDurationMinutes}
                      onChange={handleChange}
                      min="0"
                      max="240"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                    />
                    <p className="mt-2 text-xs text-gray-500">Recommended daily break duration</p>
                  </div>
                </div>
              </div>

              {/* COMPANY NETWORK & WI-FI RESTRICTION */}
              <div className="mb-8 border-t border-gray-100 pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Wifi size={18} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">Company Network Restriction</h3>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Restrict employee attendance punches to the official office Wi-Fi network (<span className="font-semibold text-slate-800">{formData.allowedWifiSsid || "HEXA_5G"}</span>).
                    </p>
                  </div>

                  {/* RESTRICTION TOGGLE */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="networkRestrictionEnabled"
                      checked={formData.networkRestrictionEnabled}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-3 text-xs font-bold uppercase tracking-wider text-gray-700">
                      {formData.networkRestrictionEnabled ? "Enforced" : "Disabled"}
                    </span>
                  </label>
                </div>

                {/* DETECTED IP BANNER */}
                {detectedClientIp && (
                  <div className="mb-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Globe size={18} className="text-indigo-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-indigo-950">Detected Current IP Address</p>
                        <p className="font-mono text-xs text-indigo-700 font-semibold break-all">{detectedClientIp}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseCurrentIp}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-50 shadow-sm transition-all shrink-0"
                    >
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Add to Allowed IPs
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-2">
                      Allowed Wi-Fi SSID Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="allowedWifiSsid"
                        value={formData.allowedWifiSsid}
                        onChange={handleChange}
                        placeholder="e.g. HEXA_5G"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-all duration-300 focus:border-indigo-500 focus:bg-white focus:shadow-lg"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">SSID displayed in alerts and headers for employees</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-2">
                      Allowed IPv6 Prefix (e.g. JioFiber /64)
                    </label>
                    <input
                      type="text"
                      name="allowedIpv6Prefixes"
                      value={formData.allowedIpv6Prefixes}
                      onChange={handleChange}
                      placeholder="e.g. 2405:201:f006:b86f"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-800 outline-none transition-all duration-300 focus:border-indigo-500 focus:bg-white focus:shadow-lg"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">Matches client IPv6 beginning with this prefix</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-2">
                      Allowed Public IPv4 Addresses
                    </label>
                    <input
                      type="text"
                      name="allowedIpv4Addresses"
                      value={formData.allowedIpv4Addresses}
                      onChange={handleChange}
                      placeholder="e.g. 49.47.199.103, 192.168.29."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-800 outline-none transition-all duration-300 focus:border-indigo-500 focus:bg-white focus:shadow-lg"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">Comma-separated office public IPv4 addresses</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-2">
                      Allowed Local Subnets
                    </label>
                    <input
                      type="text"
                      name="allowedSubnets"
                      value={formData.allowedSubnets}
                      onChange={handleChange}
                      placeholder="e.g. 192.168.29."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-800 outline-none transition-all duration-300 focus:border-indigo-500 focus:bg-white focus:shadow-lg"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">Local Wi-Fi gateway subnet (e.g. 192.168.29.)</p>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              <div className="mb-8 border-t border-gray-100 pt-8">
                <label className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="E.g., Special working hours on weekends, holidays, etc."
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-300 focus:border-blue-500 focus:bg-white focus:shadow-lg"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-8">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Save Configuration
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={loadConfig}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg"
                >
                  Reset
                </button>
              </div>

            </form>
          )}

        </div>
        {/* END CONTENT */}

      </div>
      {/* END MAIN */}

    </div>
  );
}
