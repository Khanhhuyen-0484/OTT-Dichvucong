import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import Profile from "./pages/Profile.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import { useAuth } from "./context/AuthContext.jsx";

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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/profile" element={<Profile />} />
<<<<<<< HEAD
      <Route
        path="/admin"
        element={<Navigate to="/admin/dashboard" replace />}
      />
      <Route
        path="/admin/chat"
        element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/admin/dashboard"
        element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/admin/documents"
        element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/admin/ai"
        element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />}
      />
=======
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/chat" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/dashboard" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/documents" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
      <Route path="/admin/ai" element={isAdmin ? <AdminPanel /> : <Navigate to="/auth" replace />} />
>>>>>>> 49573e7 (update videocall)
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}