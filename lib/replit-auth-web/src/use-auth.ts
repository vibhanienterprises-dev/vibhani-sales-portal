import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refetch: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const baseUrl = import.meta.env.VITE_API_URL;
    if (!baseUrl || !baseUrl.startsWith("http")) {
      throw new Error(`[Auth] VITE_API_URL is invalid: "${baseUrl}"`);
    }
    fetch(`${baseUrl}/api/auth/user`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL;
    if (!baseUrl || !baseUrl.startsWith("http")) {
      throw new Error(`[Auth] VITE_API_URL is invalid: "${baseUrl}"`);
    }
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Login failed" };
      }
      setTick((t) => t + 1);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — please try again" };
    }
  }, []);

  const logout = useCallback(async () => {
    const baseUrl = import.meta.env.VITE_API_URL;
    if (!baseUrl || !baseUrl.startsWith("http")) {
      throw new Error(`[Auth] VITE_API_URL is invalid: "${baseUrl}"`);
    }
    await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refetch,
  };
}
