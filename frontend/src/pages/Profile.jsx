// src/pages/Profile.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";

import { getSession, logout } from "../utils/auth";
import { authAPI } from "../services/api";

import {
  Camera,
  Save,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  CalendarDays,
  User,
  ShieldCheck,
  Pencil,
  LogOut,
} from "lucide-react";

export default function Profile() {

  const navigate = useNavigate();

  // Read session once — AuthGuard in AppRoutes already guarantees it exists
  const session = getSession();

  // Local Storage Key
  const storageKey = `hexa-profile-${session?.username || "guest"}`;

  // Default Profile based on session
  const defaultProfile = {
    name: session?.name || "Employee",
    email: `${session?.username || "user"}@example.com`,
    phone: "+91 9876543210",
    location: "Kerala, India",
    department: session?.role === "admin" ? "Administration" : "MERN Stack Developer",
    role: session?.role === "admin" ? "Administrator" : "Frontend Developer",
    employeeId: session?.employeeId || "HEXA-0000",
    joinDate: "2025-01-15",
    about: "Creative frontend developer passionate about building modern and responsive user interfaces.",
    image: "https://i.pravatar.cc/300?img=12",
  };

  const [isEdit, setIsEdit] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [tempProfile, setTempProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);

  // Fetch employee details from backend using auth/me endpoint
  const fetchEmployeeDetails = async () => {
    try {
      const response = await authAPI.getMe();
      const employee = response?.user || response;
      
      if (employee) {
        const fetchedProfile = {
          name: employee.name || session.name || "Employee",
          email: employee.email || `${session.username}@example.com`,
          phone: employee.phone || "+91 9876543210",
          location: employee.address || "Kerala, India",
          department: employee.department || (session.role === "admin" ? "Administration" : "Department"),
          role: employee.designation || employee.role || (session.role === "admin" ? "Administrator" : "Employee"),
          employeeId: employee.employeeId || session.employeeId || "HEXA-0000",
          joinDate: employee.joiningDate || "2025-01-15",
          about: employee.bio || "Professional",
          image: employee.avatar ? `https://i.pravatar.cc/300?img=${employee.avatar}` : `https://i.pravatar.cc/300?img=${Math.floor(Math.random() * 70)}`,
        };
        
        setProfile(fetchedProfile);
        setTempProfile(fetchedProfile);
      }
    } catch (err) {
      console.error("Error fetching employee details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load saved profile from localStorage or fetch from backend
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      setProfile(parsed);
      setTempProfile(parsed);
      setLoading(false);
    } else {
      fetchEmployeeDetails();
    }
  }, [storageKey]);

  // Persist profile changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(profile));
  }, [profile, storageKey]);

  const handleChange = (e) => {
    setTempProfile({ ...tempProfile, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setTempProfile({ ...tempProfile, image: reader.result });
    reader.readAsDataURL(file);
  };

  const handleEdit   = () => { setTempProfile(profile); setIsEdit(true); };
  const handleSave   = () => { setProfile(tempProfile); setIsEdit(false); };
  const handleCancel = () => { setTempProfile(profile); setIsEdit(false); };
  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-slate-200 border-t-slate-800 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-4 sm:px-5 md:px-6 lg:px-8">

        {/* HEADER */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-5 text-white shadow-2xl sm:p-7 lg:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-white/5" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <User className="h-8 w-8 sm:h-10 sm:w-10" />
                <h1 className="text-2xl font-black sm:text-3xl lg:text-4xl">
                  {session?.role === "admin" ? "Admin Profile" : "Employee Profile"}
                </h1>
              </div>
              <p className="mt-2 text-sm text-white/80 sm:text-base">
                Manage your profile information and personal details
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              {!isEdit && (
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:w-auto"
                >
                  <Pencil size={18} /> Edit Profile
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 sm:w-auto"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">

          {/* LEFT CARD */}
          <div className="rounded-[32px] border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-2xl sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <img
                  src={tempProfile.image}
                  alt="profile"
                  className="h-32 w-32 rounded-full border-4 border-slate-200 object-cover shadow-xl sm:h-36 sm:w-36"
                />
                {isEdit && (
                  <>
                    <label
                      htmlFor="profile-upload"
                      className="absolute bottom-2 right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-[#111827] to-[#374151] text-white shadow-lg transition-all duration-300 hover:scale-110"
                    >
                      <Camera size={18} />
                    </label>
                    <input id="profile-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </>
                )}
              </div>
              <h2 className="mt-5 break-words text-2xl font-black text-gray-900">{tempProfile.name}</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">{tempProfile.role}</p>
              <span className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                <ShieldCheck size={14} /> {tempProfile.employeeId}
              </span>
              <div className="mt-6 w-full rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm leading-7 text-gray-600">{tempProfile.about}</p>
              </div>
              <div className="mt-6 flex w-full flex-col gap-4">
                <InfoCard icon={<Mail size={20} />}   title="Email Address" value={tempProfile.email}    color="bg-blue-100 text-blue-600" />
                <InfoCard icon={<Phone size={20} />}  title="Phone Number"  value={tempProfile.phone}    color="bg-emerald-100 text-emerald-600" />
                <InfoCard icon={<MapPin size={20} />} title="Location"      value={tempProfile.location} color="bg-red-100 text-red-600" />
              </div>
            </div>
          </div>

          {/* RIGHT CARD */}
          <div className="rounded-[32px] border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-2xl sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <ShieldCheck size={26} className="text-slate-700" />
              <h2 className="text-2xl font-black text-gray-900 sm:text-3xl">Profile Information</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField label="Full Name"      name="name"       value={tempProfile.name}       onChange={handleChange} disabled={!isEdit} />
              <InputField label="Email Address"  name="email"      value={tempProfile.email}      onChange={handleChange} disabled={!isEdit} />
              <InputField label="Phone Number"   name="phone"      value={tempProfile.phone}      onChange={handleChange} disabled={!isEdit} />
              <InputField label="Department"     name="department" value={tempProfile.department} onChange={handleChange} disabled={!isEdit} />
              <InputField label="Role"           name="role"       value={tempProfile.role}       onChange={handleChange} disabled={!isEdit} />
              <InputField label="Employee ID"    name="employeeId" value={tempProfile.employeeId} onChange={handleChange} disabled={true} />
              <InputField label="Join Date"      name="joinDate"   value={tempProfile.joinDate}   onChange={handleChange} disabled={!isEdit} type="date" />
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-gray-600">Location</label>
              <textarea rows={3} name="location" value={tempProfile.location} onChange={handleChange} disabled={!isEdit}
                className={`w-full rounded-3xl border border-gray-200 p-4 text-sm outline-none transition-all duration-300 ${isEdit ? "bg-white focus:border-[#111827] focus:shadow-lg" : "bg-slate-100"}`}
              />
            </div>
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-gray-600">About</label>
              <textarea rows={5} name="about" value={tempProfile.about} onChange={handleChange} disabled={!isEdit}
                className={`w-full rounded-3xl border border-gray-200 p-4 text-sm leading-7 outline-none transition-all duration-300 ${isEdit ? "bg-white focus:border-[#111827] focus:shadow-lg" : "bg-slate-100"}`}
              />
            </div>
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MiniCard icon={<Building2 size={20} />}    title="Department" value={tempProfile.department} />
              <MiniCard icon={<Briefcase size={20} />}    title="Role"       value={tempProfile.role} />
              <MiniCard icon={<CalendarDays size={20} />} title="Join Date"  value={tempProfile.joinDate} />
            </div>
            {isEdit && (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button onClick={handleSave}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] px-6 py-4 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:w-auto"
                >
                  <Save size={18} /> Save Changes
                </button>
                <button onClick={handleCancel}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-4 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-slate-50 hover:shadow-lg sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}


function InputField({ label, name, value, onChange, disabled, type = "text" }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-600">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} disabled={disabled}
        className={`w-full rounded-3xl border border-gray-200 p-4 text-sm font-medium text-gray-700 outline-none transition-all duration-300 ${disabled ? "bg-slate-100" : "bg-white focus:border-[#111827] focus:shadow-lg"}`}
      />
    </div>
  );
}

function InfoCard({ icon, title, value, color }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 transition-all duration-300 hover:bg-white hover:shadow-lg sm:flex-row sm:items-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500">{title}</p>
        <h3 className="mt-1 break-all text-sm font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );
}

function MiniCard({ icon, title, value }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 transition-all duration-300 hover:bg-white hover:shadow-lg">
      <div className="mb-3 text-slate-700">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <h3 className="mt-1 break-words text-sm font-bold text-gray-900">{value}</h3>
    </div>
  );
}