import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { PublicTeacherPage } from "@/pages/PublicTeacherPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { SessionRoomPage } from "@/pages/SessionRoomPage";
import { SessionsHistoryPage } from "@/pages/SessionsHistoryPage";
import { TeacherDashboardPage } from "@/pages/TeacherDashboardPage";
import { WalletPage } from "@/pages/WalletPage";
import type { UserRole } from "@/types";

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB] text-sm text-slate-500">
        Carregando ExtraAula...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/marketplace" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/t/:qrSlug" element={<PublicTeacherPage />} />

            <Route
              path="/requests"
              element={
                <ProtectedRoute roles={["STUDENT", "TEACHER", "ADMIN"]}>
                  <RequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <ProtectedRoute roles={["STUDENT", "TEACHER", "ADMIN"]}>
                  <SessionsHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId"
              element={
                <ProtectedRoute roles={["STUDENT", "TEACHER", "ADMIN"]}>
                  <SessionRoomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute roles={["STUDENT", "TEACHER", "ADMIN"]}>
                  <WalletPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
