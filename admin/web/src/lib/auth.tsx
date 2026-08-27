import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { Me } from '../api/types';

interface AuthApi {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (resource: string, action: string) => boolean;
}

const AuthCtx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const user = await api.get<Me>('/api/auth/me');
      setMe(user);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    await api.post('/api/auth/login', { email, password });
    await refresh();
  };

  const logout = async () => {
    await api.post('/api/auth/logout');
    setMe(null);
  };

  const can = (resource: string, action: string) => Boolean(me?.permissions.includes(`${resource}:${action}`));

  return <AuthCtx.Provider value={{ me, loading, login, logout, can }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
