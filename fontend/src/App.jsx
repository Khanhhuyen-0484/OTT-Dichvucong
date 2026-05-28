import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Profile from "./pages/Profile.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import AdminServices from "./pages/AdminServices.jsx";
import AdminCreateService from "./pages/AdminCreateService.jsx";
import AdminStatistics from "./pages/AdminStatistics.jsx";
import AdminDossierDetail from "./pages/AdminDossierDetail.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ServiceList from "./pages/ServiceList.jsx";
import ServiceWizard from "./pages/ServiceWizard.jsx";
import TrackApplication from "./pages/TrackApplication.jsx";
import MyApplications from "./pages/MyApplications.jsx";
import ApplicationDetail from "./pages/ApplicationDetail.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { user, ready } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">Đang tải hệ thống...</div>;
  }

  return (
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
      <Route path="/admin/services" element={isAdmin ? <AdminServices /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/services/create" element={isAdmin ? <AdminCreateService /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/services/:serviceId/edit" element={isAdmin ? <AdminCreateService /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/statistics" element={isAdmin ? <AdminStatistics /> : <Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
