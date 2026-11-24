import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Coins,
  Compass,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Sparkles,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { NotificationItem } from "@/types";
import { cn, formatDateTime } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, wallet, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;
    apiRequest<NotificationItem[]>("/api/notifications")
      .then(setNotifications)
      .catch(() => {});
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    await apiRequest("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const navItems = [
    ...(user?.role === "ADMIN"
      ? [{ to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard }]
      : []),
    ...(user?.role === "TEACHER"
      ? [{ to: "/teacher", label: "Painel do Professor", icon: GraduationCap }]
      : []),
    { to: "/marketplace", label: "Marketplace", icon: Compass },
    ...(user && user.role !== "ADMIN"
      ? [
          { to: "/requests", label: "Negociações", icon: Handshake },
          { to: "/sessions", label: "Atendimentos", icon: MessageSquare },
          { to: "/wallet", label: "Carteira & Tokens", icon: WalletIcon },
        ]
      : []),
  ];

  const roleLabel =
    user?.role === "ADMIN"
      ? "Administrador"
      : user?.role === "TEACHER"
      ? "Professor"
      : "Aluno";

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to={user ? (user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/teacher" : "/marketplace") : "/"} className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  Extra<span className="text-indigo-600">Aula</span>
                </span>
                <p className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:block">
                  Mentoria sob demanda
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {user && wallet && (
              <Link
                to="/wallet"
                className="hidden items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100/70 sm:flex"
                title="Saldo disponível em tokens"
              >
                <Coins className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-mono">{wallet.balance}</span>
                <span className="font-normal text-amber-700">tokens</span>
                {wallet.locked_balance > 0 && (
                  <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-mono text-amber-900">
                    +{wallet.locked_balance} bloq.
                  </span>
                )}
              </Link>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative rounded-lg border border-slate-200/80 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Notificações"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-elevated">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Notificações
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Marcar lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">
                          Nenhuma notificação por enquanto.
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setNotifOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={cn(
                              "w-full rounded-lg p-2.5 text-left transition hover:bg-slate-50",
                              !n.is_read && "bg-indigo-50/50"
                            )}
                          >
                            <p className="text-xs font-semibold text-slate-800">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {formatDateTime(n.created_at)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold text-slate-800">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-slate-500">{roleLabel}</p>
                </div>
                <img
                  src={
                    user.avatar_url ||
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                      user.name
                    )}`
                  }
                  alt={user.name}
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                />
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  Criar conta
                </Link>
              </div>
            )}

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100"
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
