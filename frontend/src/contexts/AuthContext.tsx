import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiRequest, getToken, setToken } from "@/api/client";
import type { AuthResponse, UserRole, UserSummary, Wallet } from "@/types";

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  institution?: string;
  course?: string;
  headline?: string;
  bio?: string;
  avg_tokens_per_session?: number;
}

interface AuthContextValue {
  user: UserSummary | null;
  wallet: Wallet | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setWallet(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<AuthResponse>("/api/auth/me");
      setUser(data.user);
      setWallet(data.wallet ?? null);
    } catch {
      setToken(null);
      setUser(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    setUser(data.user);
    setWallet(data.wallet ?? null);
    return data;
  };

  const register = async (payload: RegisterPayload) => {
    const data = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.access_token);
    setUser(data.user);
    setWallet(data.wallet ?? null);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setWallet(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, wallet, loading, login, register, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
