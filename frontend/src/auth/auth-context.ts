import { createContext } from 'react';
import type { AuthenticatedUser, LoginInput } from './auth.types';

export type AuthStatus = 'anonymous' | 'authenticated' | 'restoring';

export interface AuthContextValue {
  hasPermission: (permission: string) => boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  status: AuthStatus;
  user: AuthenticatedUser | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

