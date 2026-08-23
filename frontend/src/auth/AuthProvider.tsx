import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError, apiRequest } from '../lib/api-client';
import {
  loginRequest,
  logoutRequest,
  refreshRequest,
} from './auth.api';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './auth-context';
import type { AuthSession, LoginInput } from './auth.types';
import {
  clearStoredRefreshToken,
  storedRefreshToken,
  storeRefreshToken,
} from './session-storage';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    storedRefreshToken() ? 'restoring' : 'anonymous',
  );
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshPromise = useRef<Promise<AuthSession> | null>(null);

  const establish = useCallback((next: AuthSession) => {
    sessionRef.current = next;
    storeRefreshToken(next.refreshToken);
    setSession(next);
    setStatus('authenticated');
    return next;
  }, []);

  const clear = useCallback(() => {
    sessionRef.current = null;
    clearStoredRefreshToken();
    setSession(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    const refreshToken = storedRefreshToken();
    if (!refreshToken) return;
    let active = true;
    void refreshRequest(refreshToken)
      .then((next) => {
        if (active) establish(next);
      })
      .catch(() => {
        if (active) clear();
      });
    return () => {
      active = false;
    };
  }, [clear, establish]);

  const refreshSession = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    const refreshToken = storedRefreshToken();
    if (!refreshToken) {
      clear();
      throw new ApiError(401, 'Tu sesión finalizó. Ingresa nuevamente.');
    }
    const operation = refreshRequest(refreshToken)
      .then(establish)
      .catch((error: unknown) => {
        clear();
        throw error;
      });
    refreshPromise.current = operation;
    try {
      return await operation;
    } finally {
      if (refreshPromise.current === operation) refreshPromise.current = null;
    }
  }, [clear, establish]);

  const login = useCallback(
    async (input: LoginInput) => {
      establish(await loginRequest(input));
    },
    [establish],
  );

  const logout = useCallback(async () => {
    const accessToken = sessionRef.current?.accessToken;
    try {
      if (accessToken) await logoutRequest(accessToken);
    } finally {
      clear();
    }
  }, [clear]);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const accessToken = sessionRef.current?.accessToken;
      if (!accessToken) {
        throw new ApiError(401, 'Tu sesión finalizó. Ingresa nuevamente.');
      }
      try {
        return await apiRequest<T>(path, { ...options, accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const renewed = await refreshSession();
        return apiRequest<T>(path, {
          ...options,
          accessToken: renewed.accessToken,
        });
      }
    },
    [refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      hasPermission: (permission) =>
        session?.user.permissions.includes(permission) ?? false,
      login,
      logout,
      request,
      status,
      user: session?.user ?? null,
    }),
    [login, logout, request, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

