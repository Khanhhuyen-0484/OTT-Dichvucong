import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import CallManager from "./components/CallManager.jsx";
import { useAuth } from "./context/AuthContext.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Auth = lazy(() => import("./pages/Auth.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.jsx"));
const AdminServices = lazy(() => import("./pages/AdminServices.jsx"));
const AdminCreateService = lazy(() => import("./pages/AdminCreateService.jsx"));
const AdminStatistics = lazy(() => import("./pages/AdminStatistics.jsx"));
const AdminDossierDetail = lazy(() => import("./pages/AdminDossierDetail.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const ServiceList = lazy(() => import("./pages/ServiceList.jsx"));
const ServiceWizard = lazy(() => import("./pages/ServiceWizard.jsx"));
const TrackApplication = lazy(() => import("./pages/TrackApplication.jsx"));
const MyApplications = lazy(() => import("./pages/MyApplications.jsx"));
const ApplicationDetail = lazy(() => import("./pages/ApplicationDetail.jsx"));

function PageLoader() {
  return <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">Đang tải...</div>;
}

export default function App() {
  const { user, ready } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">
        Đang tải hệ thống...
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<ServiceList />} />
          <Route path="/services/:serviceId" element={<ServiceWizard />} />
          <Route path="/track" element={<TrackApplication />} />
          <Route path="/my-applications" element={user ? <MyApplications /> : <Navigate to="/auth" replace />} />
          <Route path="/my-applications/:applicationCode" element={user ? <ApplicationDetail /> : <Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/auth" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/chat" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/dashboard" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/documents" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/dossiers/:dossierId" element={isAdmin ? <AdminDossierDetail /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/ai" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/users" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/services" element={isAdmin ? <AdminServices /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/services/create" element={isAdmin ? <AdminCreateService /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/services/:serviceId/edit" element={isAdmin ? <AdminCreateService /> : <Navigate to="/auth" replace />} />
          <Route path="/admin/statistics" element={isAdmin ? <AdminStatistics /> : <Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user ? <CallManager /> : null}
      </>
    </Suspense>
  );
}
