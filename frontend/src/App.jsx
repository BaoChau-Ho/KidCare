import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import SetPassword from './pages/SetPassword.jsx'
import AdminRequests from './pages/AdminRequests.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import RoleGuard from './components/RoleGuard.jsx'
// UC-03
import UsersPage from './pages/admin/UsersPage.jsx'
// UC-05, UC-04, UC-15
import ClassesPage from './pages/classes/ClassesPage.jsx'
import ChildrenPage from './pages/children/ChildrenPage.jsx'
import ChildDetailPage from './pages/children/ChildDetailPage.jsx'
import ReportsPage from './pages/manager/ReportsPage.jsx'
// UC-06, UC-08, UC-10, UC-12, UC-13 (giáo viên)
import AttendancePage from './pages/teacher/AttendancePage.jsx'
import LeaveRequestsPage from './pages/teacher/LeaveRequestsPage.jsx'
import ActivitiesPage from './pages/teacher/ActivitiesPage.jsx'
import TeacherPickupsPage from './pages/teacher/PickupsPage.jsx'
import NotifyPage from './pages/teacher/NotifyPage.jsx'
// UC-07, UC-08, UC-11 (phụ huynh)
import ParentDashboard from './pages/parent/ParentDashboard.jsx'
import ParentLeavePage from './pages/parent/LeavePage.jsx'
import ParentPickupsPage from './pages/parent/PickupsPage.jsx'
// UC-09 (nhân viên y tế)
import HealthPage from './pages/medical/HealthPage.jsx'
import HealthDetailPage from './pages/medical/HealthDetailPage.jsx'
// UC-14 (mọi vai trò)
import NotificationsPage from './pages/NotificationsPage.jsx'

const ALL = ['ADMIN', 'MANAGER', 'TEACHER', 'MEDICAL_STAFF', 'PARENT']
const only = (roles, el) => <RoleGuard roles={roles}>{el}</RoleGuard>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<SetPassword mode="reset" />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route path="/admin" element={<AdminRequests />} />
      <Route path="/admin/users" element={only(['ADMIN'], <UsersPage />)} />

      <Route path="/manager" element={<Navigate to="/manager/classes" replace />} />
      <Route path="/manager/classes" element={only(['MANAGER'], <ClassesPage />)} />
      <Route path="/manager/children" element={only(['MANAGER'], <ChildrenPage />)} />
      <Route path="/manager/children/:id" element={only(['MANAGER'], <ChildDetailPage />)} />
      <Route path="/manager/reports" element={only(['MANAGER'], <ReportsPage />)} />

      <Route path="/teacher" element={only(['TEACHER'], <AttendancePage />)} />
      <Route path="/teacher/leave" element={only(['TEACHER'], <LeaveRequestsPage />)} />
      <Route path="/teacher/activities" element={only(['TEACHER'], <ActivitiesPage />)} />
      <Route path="/teacher/pickups" element={only(['TEACHER'], <TeacherPickupsPage />)} />
      <Route path="/teacher/notify" element={only(['TEACHER'], <NotifyPage />)} />

      <Route path="/parent" element={only(['PARENT'], <ParentDashboard />)} />
      <Route path="/parent/leave" element={only(['PARENT'], <ParentLeavePage />)} />
      <Route path="/parent/pickups" element={only(['PARENT'], <ParentPickupsPage />)} />

      <Route path="/medical" element={only(['MEDICAL_STAFF'], <HealthPage />)} />
      <Route path="/medical/children/:id" element={only(['MEDICAL_STAFF'], <HealthDetailPage />)} />

      <Route path="/notifications" element={only(ALL, <NotificationsPage />)} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
