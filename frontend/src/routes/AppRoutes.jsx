import { Routes, Route, Navigate } from "react-router-dom";

import Login               from "../pages/Login";
import Dashboard          from "../pages/Dashboard";
import Reports            from "../pages/Reports";
import Tasks              from "../pages/Tasks";
import LeaveManagement    from "../pages/LeaveManagement";
import WorkTracker        from "../pages/WorkTracker";
import EmployeeAttendance from "../pages/EmployeeAttendance";
import AdminPanel         from "../pages/AdminPanel";
import AdminAttendance    from "../pages/AdminAttendance";
import AdminLeave         from "../pages/AdminLeave";
import AdminWorkTrack     from "../pages/AdminWorkTrack";
import AdminStaff         from "../pages/AdminStaff";
import AdminTasks         from "../pages/AdminTasks";
import AdminConfig        from "../pages/AdminConfig";
import AuthGuard          from "../components/AuthGuard";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Employee + Manager + Admin — all authenticated users */}
      <Route path="/dashboard"   element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/reports"     element={<AuthGuard><Reports /></AuthGuard>} />
      <Route path="/tasks"       element={<AuthGuard><Tasks /></AuthGuard>} />
      <Route path="/leave"       element={<AuthGuard><LeaveManagement /></AuthGuard>} />
      <Route path="/worktracker" element={<AuthGuard><WorkTracker /></AuthGuard>} />
      <Route path="/attendance"  element={<AuthGuard><EmployeeAttendance /></AuthGuard>} />

      {/* Admin + Manager only */}
      <Route path="/admin"            element={<AuthGuard role="admin"><AdminPanel /></AuthGuard>}/>
      <Route path="/admin/attendance" element={<AuthGuard role="admin"><AdminAttendance /></AuthGuard>}/>
      <Route path="/admin/leave"      element={<AuthGuard role="admin"><AdminLeave /></AuthGuard>}/>
      <Route path="/admin/worktrack"  element={<AuthGuard role="admin"><AdminWorkTrack /></AuthGuard>}/>
      <Route path="/admin/staff"      element={<AuthGuard role="admin"><AdminStaff /></AuthGuard>}/>
      <Route path="/admin/tasks"      element={<AuthGuard role="admin"><AdminTasks /></AuthGuard>} />
      <Route path="/admin/config"     element={<AuthGuard role="admin"><AdminConfig /></AuthGuard>} />

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}