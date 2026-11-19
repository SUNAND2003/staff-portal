// src/pages/Profile.jsx

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import useAuthStore from "../store/authStore";
import { profileAPI, authAPI } from "../services/api";
import { getAvatarUrl } from "../utils/helpers";
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
  Trash2,
  Upload,
  Loader,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

// Helper to optimize/compress image client-side before upload (< 40KB)
const compressImage = (file, maxSize = 320, quality = 0.88) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Crop square from center
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
          img,
          startX, startY, minDim, minDim, // source crop
          0, 0, maxSize, maxSize          // destination
        );

        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Also convert to Blob for multipart upload
        canvas.toBlob(
          (blob) => {
            resolve({ dataUrl, blob, file: new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) });
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const fileInputRef = useRef(null);

  const getAvatarKey = (u) => `hexa_avatar_cache_${u?._id || u?.employeeId || u?.username || "me"}`;

  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const initialCachedAvatar =
    user?.avatarUrl ||
    (typeof window !== "undefined" ? localStorage.getItem(getAvatarKey(user)) : "") ||
    "";

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    location: user?.address || "",
    department: user?.department || "",
    role: user?.designation || user?.role || "",
    employeeId: user?.employeeId || "",
    joinDate: "",
    about: user?.bio || "",
    avatarUrl: initialCachedAvatar,
  });

  const [tempProfile, setTempProfile] = useState({ ...profile });

  // Load user profile from backend API
  const fetchProfile = async () => {
    try {
      setLoading(true);
      let userData = null;

      try {
        userData = await profileAPI.get();
      } catch (e) {
        // Fallback to authAPI.getMe() or stored user
        try {
          const res = await authAPI.getMe();
          userData = res?.user || res;
        } catch {
          userData = user || {};
        }
      }

      if (!userData) {
        userData = user || {};
      }

      const avatarKey = getAvatarKey(userData || user);
      const localCached = typeof window !== "undefined" ? localStorage.getItem(avatarKey) : "";
      const effectiveAvatar = userData.avatarUrl || user?.avatarUrl || localCached || "";

      // Keep cache fresh if backend returned an avatar
      if (userData.avatarUrl && typeof window !== "undefined") {
        localStorage.setItem(avatarKey, userData.avatarUrl);
      } else if (!userData.avatarUrl && effectiveAvatar) {
        // If backend was empty but local has an avatar, automatically re-sync to backend MongoDB
        profileAPI.update({ avatarUrl: effectiveAvatar }).catch(() => {});
      }

      const formatted = {
        name: userData.name || user?.name || "Employee",
        email: userData.email || user?.email || "",
        phone: userData.phone || user?.phone || "",
        location: userData.address || user?.address || "Kerala, India",
        department: userData.department || user?.department || (user?.role === "admin" ? "Administration" : "Engineering"),
        role: userData.designation || userData.role || user?.designation || user?.role || "Employee",
        employeeId: userData.employeeId || user?.employeeId || "HEXA-0000",
        joinDate: userData.joiningDate ? new Date(userData.joiningDate).toISOString().slice(0, 10) : "2025-01-15",
        about: userData.bio || user?.bio || "Team member at Hexa Branding.",
        avatarUrl: effectiveAvatar,
      };

      setProfile(formatted);
      setTempProfile(formatted);

      if (effectiveAvatar && effectiveAvatar !== user?.avatarUrl) {
        updateUser({ avatarUrl: effectiveAvatar });
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      toast.error("Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setTempProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Image Upload Handler (runs client-side compression then saves to backend & local cache)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading("Optimizing and saving photo...");

    try {
      // 1. Optimize image client-side to clean square JPEG (~25KB)
      const { dataUrl, file: compressedFile } = await compressImage(file, 320, 0.88);

      // 2. Immediately cache in localStorage and local state (instant update)
      const avatarKey = getAvatarKey(user);
      if (typeof window !== "undefined") {
        localStorage.setItem(avatarKey, dataUrl);
      }
      setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
      setTempProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
      updateUser({ avatarUrl: dataUrl });

      // 3. Persist to MongoDB Atlas via PATCH /api/profile
      // Base64 Data URI stores permanently in DB with zero dependency on ephemeral disk
      try {
        await profileAPI.update({ avatarUrl: dataUrl });
      } catch (updateErr) {
        console.warn("Direct avatar update:", updateErr?.message);
      }

      // 4. Also call multipart upload endpoint
      try {
        const uploadRes = await profileAPI.uploadAvatar(compressedFile);
        if (uploadRes?.avatarUrl) {
          const finalUrl = uploadRes.avatarUrl;
          if (typeof window !== "undefined") {
            localStorage.setItem(avatarKey, finalUrl);
          }
          setProfile((prev) => ({ ...prev, avatarUrl: finalUrl }));
          setTempProfile((prev) => ({ ...prev, avatarUrl: finalUrl }));
          updateUser({ avatarUrl: finalUrl });
        }
      } catch (uploadErr) {
        console.warn("Multipart avatar upload fallback:", uploadErr?.message);
      }

      toast.success("Profile photo updated successfully!", { id: toastId });
    } catch (err) {
      console.error("Failed to update profile image:", err);
      toast.error(err.message || "Failed to upload image. Please try again.", { id: toastId });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove Profile Photo
  const handleRemoveAvatar = async () => {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return;

    setUploadingImage(true);
    const toastId = toast.loading("Removing photo...");

    try {
      const avatarKey = getAvatarKey(user);
      if (typeof window !== "undefined") {
        localStorage.removeItem(avatarKey);
      }

      // Clear from backend
      try {
        await profileAPI.deleteAvatar();
      } catch {}
      try {
        await profileAPI.update({ avatarUrl: "" });
      } catch {}

      setProfile((prev) => ({ ...prev, avatarUrl: "" }));
      setTempProfile((prev) => ({ ...prev, avatarUrl: "" }));
      updateUser({ avatarUrl: "" });

      toast.success("Profile photo removed.", { id: toastId });
    } catch (err) {
      console.error("Failed to remove avatar:", err);
      toast.error("Failed to remove photo.", { id: toastId });
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Text Details to Backend
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!tempProfile.name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Saving profile changes...");

    try {
      const payload = {
        name: tempProfile.name.trim(),
        email: tempProfile.email.trim(),
        phone: tempProfile.phone.trim(),
        address: tempProfile.location.trim(),
        bio: tempProfile.about.trim(),
        department: tempProfile.department.trim(),
        designation: tempProfile.role.trim(),
      };

      const updated = await profileAPI.update(payload);

      setProfile({ ...tempProfile });
      setIsEdit(false);

      if (updated) {
        updateUser({
          name: updated.name || tempProfile.name,
          email: updated.email || tempProfile.email,
          phone: updated.phone || tempProfile.phone,
          address: updated.address || tempProfile.location,
          bio: updated.bio || tempProfile.about,
          department: updated.department || tempProfile.department,
          designation: updated.designation || tempProfile.role,
        });
      }

      toast.success("Profile updated successfully!", { id: toastId });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error(err.message || "Failed to save profile changes.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempProfile({ ...profile });
    setIsEdit(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = tempProfile.name
    ? tempProfile.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <div className="text-center">
            <Loader size={36} className="mx-auto mb-3 animate-spin text-slate-800" />
            <p className="text-sm font-semibold text-slate-500">Loading your profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-4 sm:px-5 md:px-6 lg:px-8">
        {/* HEADER HERO */}
        <div className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#374151] p-5 text-white shadow-2xl sm:p-7 lg:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-white/5 blur-xl" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-black sm:text-3xl lg:text-4xl">
                  {user?.role === "admin" ? "Admin Profile" : "Employee Profile"}
                </h1>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-white/80">
                Manage your personal information, profile photo, and contact details
              </p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:w-auto">
              {!isEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempProfile({ ...profile });
                    setIsEdit(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:bg-slate-50 active:scale-95 sm:w-auto cursor-pointer"
                >
                  <Pencil size={16} /> Edit Profile
                </button>
              ) : (
                <div className="flex w-full sm:w-auto gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 sm:flex-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-60"
                  >
                    {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-rose-600/80 hover:border-rose-500 sm:w-auto cursor-pointer"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          {/* LEFT CARD - PROFILE PHOTO & SUMMARY */}
          <div className="rounded-[28px] sm:rounded-[32px] border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-xl sm:p-6">
            <div className="flex flex-col items-center text-center">
              {/* AVATAR WITH PHOTO UPLOAD OVERLAY */}
              <div className="relative group">
                {getAvatarUrl(tempProfile.avatarUrl) ? (
                  <img
                    src={getAvatarUrl(tempProfile.avatarUrl)}
                    alt={tempProfile.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    className="h-32 w-32 sm:h-36 sm:w-36 rounded-full border-4 border-slate-200/80 object-cover shadow-xl transition-all group-hover:brightness-90"
                  />
                ) : null}
                {!getAvatarUrl(tempProfile.avatarUrl) && (
                  <div className="flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-full border-4 border-slate-200/80 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-3xl sm:text-4xl font-black text-white shadow-xl">
                    {initials}
                  </div>
                )}

                {/* CAMERA BADGE / TRIGGER */}
                <label
                  htmlFor="profile-upload-input"
                  className="absolute bottom-1 right-1 flex h-10 w-10 sm:h-11 sm:w-11 cursor-pointer items-center justify-center rounded-full bg-slate-900 hover:bg-indigo-600 text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white"
                  title="Upload profile picture"
                >
                  {uploadingImage ? <Loader size={18} className="animate-spin" /> : <Camera size={18} />}
                </label>

                {/* HIDDEN FILE INPUT */}
                <input
                  ref={fileInputRef}
                  id="profile-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </div>

              {/* PHOTO ACTION BUTTONS */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <Upload size={13} />
                  <span>{getAvatarUrl(tempProfile.avatarUrl) ? "Change Photo" : "Upload Photo"}</span>
                </button>

                {getAvatarUrl(tempProfile.avatarUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingImage}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                    title="Remove profile picture"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <h2 className="mt-4 break-words text-xl sm:text-2xl font-black text-gray-900">
                {tempProfile.name}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm font-semibold text-gray-500">
                {tempProfile.role || "Team Member"}
              </p>

              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>{tempProfile.employeeId}</span>
              </span>

              {/* BIO BOX */}
              <div className="mt-5 w-full rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">About</p>
                <p className="text-xs sm:text-sm leading-relaxed text-gray-600">
                  {tempProfile.about || "No bio added yet."}
                </p>
              </div>

              {/* CONTACT DETAILS LIST */}
              <div className="mt-4 flex w-full flex-col gap-3">
                <InfoCard
                  icon={<Mail size={18} />}
                  title="Email Address"
                  value={tempProfile.email || "Not specified"}
                  color="bg-blue-100 text-blue-600"
                />
                <InfoCard
                  icon={<Phone size={18} />}
                  title="Phone Number"
                  value={tempProfile.phone || "Not specified"}
                  color="bg-emerald-100 text-emerald-600"
                />
                <InfoCard
                  icon={<MapPin size={18} />}
                  title="Location"
                  value={tempProfile.location || "Not specified"}
                  color="bg-rose-100 text-rose-600"
                />
              </div>
            </div>
          </div>

          {/* RIGHT CARD - DETAILED EDITABLE PROFILE INFO */}
          <div className="rounded-[28px] sm:rounded-[32px] border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-xl sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900">Profile Information</h2>
                  <p className="text-xs text-gray-500">Official staff and employment record</p>
                </div>
              </div>

              {isEdit && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  Editing Mode Active
                </span>
              )}
            </div>

            {/* FORM FIELDS */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
              <InputField
                label="Full Name"
                name="name"
                value={tempProfile.name}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="Enter full name"
              />
              <InputField
                label="Email Address"
                name="email"
                type="email"
                value={tempProfile.email}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="employee@hexabranding.com"
              />
              <InputField
                label="Phone Number"
                name="phone"
                value={tempProfile.phone}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="+91 9876543210"
              />
              <InputField
                label="Department"
                name="department"
                value={tempProfile.department}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="Design, Development, etc."
              />
              <InputField
                label="Designation / Role"
                name="role"
                value={tempProfile.role}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="UI Designer, Full Stack, etc."
              />
              <InputField
                label="Employee ID"
                name="employeeId"
                value={tempProfile.employeeId}
                disabled={true}
              />
            </div>

            {/* ADDRESS / LOCATION */}
            <div className="mt-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Location / Address
              </label>
              <textarea
                rows={2}
                name="location"
                value={tempProfile.location}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="City, State, Country"
                className={`w-full rounded-2xl border border-gray-200 p-3.5 text-sm outline-none transition-all duration-300 ${
                  isEdit ? "bg-white focus:border-slate-900 focus:shadow-md" : "bg-slate-50 text-gray-700"
                }`}
              />
            </div>

            {/* BIO / ABOUT */}
            <div className="mt-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Professional Bio / About
              </label>
              <textarea
                rows={4}
                name="about"
                value={tempProfile.about}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder="Write a brief professional summary..."
                className={`w-full rounded-2xl border border-gray-200 p-3.5 text-sm leading-relaxed outline-none transition-all duration-300 ${
                  isEdit ? "bg-white focus:border-slate-900 focus:shadow-md" : "bg-slate-50 text-gray-700"
                }`}
              />
            </div>

            {/* HIGHLIGHT MINI CARDS */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniCard icon={<Building2 size={18} />} title="Department" value={tempProfile.department || "General"} />
              <MiniCard icon={<Briefcase size={18} />} title="Designation" value={tempProfile.role || "Staff"} />
              <MiniCard icon={<CalendarDays size={18} />} title="Joined" value={tempProfile.joinDate || "Recent"} />
            </div>

            {/* SAVE / CANCEL BUTTONS IN EDIT MODE */}
            {isEdit && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row border-t border-gray-100 pt-6">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:bg-slate-800 active:scale-95 sm:w-auto cursor-pointer disabled:opacity-60"
                >
                  {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-700 transition-all duration-300 hover:bg-slate-50 sm:w-auto cursor-pointer"
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

function InputField({ label, name, value, onChange, disabled, type = "text", placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full rounded-2xl border border-gray-200 p-3.5 text-sm font-medium text-gray-800 outline-none transition-all duration-300 ${
          disabled ? "bg-slate-50 text-gray-600" : "bg-white focus:border-slate-900 focus:shadow-md"
        }`}
      />
    </div>
  );
}

function InfoCard({ icon, title, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition-all hover:bg-white hover:shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
        <h4 className="mt-0.5 truncate text-xs font-bold text-gray-900">{value}</h4>
      </div>
    </div>
  );
}

function MiniCard({ icon, title, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-sm">
      <div className="mb-2 text-slate-700">{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <h4 className="mt-0.5 truncate text-xs font-bold text-gray-900">{value}</h4>
    </div>
  );
}
