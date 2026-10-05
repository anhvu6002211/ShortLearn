import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { apiRequest } from '../services/api';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'pending_verification' | 'disabled' | 'deleted';
  emailVerified: boolean;
  currentLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  sessionId: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    display_name?: string | null;
    avatar_url?: string | null;
    status: AuthUser['status'];
    email_verified?: boolean;
    current_level: AuthUser['currentLevel'];
  };
  tokens: {
    access_token: string;
    access_token_expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
    session_id: string;
  };
}

type AuthenticatedRequest = (
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
) => Promise<Response>;

export interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  authenticatedRequest: AuthenticatedRequest;
  establishSession: (response: AuthResponse) => void;
  replaceSession: (session: AuthSession | null) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export class AuthSessionRequiredError extends Error {
  constructor(message = 'Bạn cần đăng nhập ShortLearn để sử dụng tính năng này.') {
    super(message);
    this.name = 'AuthSessionRequiredError';
  }
}

function createSession(response: AuthResponse): AuthSession {
  const now = Date.now();
  return {
    user: {
      id: response.user.id,
      email: response.user.email,
      displayName: response.user.display_name || null,
      avatarUrl: response.user.avatar_url || null,
      status: response.user.status,
      emailVerified: Boolean(response.user.email_verified),
      currentLevel: response.user.current_level,
    },
    accessToken: response.tokens.access_token,
    accessTokenExpiresAt: now + Math.max(0, response.tokens.access_token_expires_in) * 1000,
    refreshToken: response.tokens.refresh_token,
    refreshTokenExpiresAt: now + Math.max(0, response.tokens.refresh_token_expires_in) * 1000,
    sessionId: response.tokens.session_id,
  };
}

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  // Persistence and refresh rotation are intentionally added in the next roadmap item.
  const [session, setSession] = useState<AuthSession | null>(null);

  const establishSession = useCallback((response: AuthResponse) => {
    setSession(createSession(response));
  }, []);
  const replaceSession = useCallback((nextSession: AuthSession | null) => {
    setSession(nextSession);
  }, []);
  const clearSession = useCallback(() => setSession(null), []);

  const authenticatedRequest = useCallback<AuthenticatedRequest>(async (
    path,
    init = {},
    timeoutMs,
  ) => {
    if (!session) throw new AuthSessionRequiredError();
    if (session.accessTokenExpiresAt <= Date.now()) {
      throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.accessToken}`);
    return apiRequest(path, { ...init, headers }, timeoutMs);
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isAuthenticated: Boolean(session && session.user.status === 'active'),
    authenticatedRequest,
    establishSession,
    replaceSession,
    clearSession,
  }), [authenticatedRequest, clearSession, establishSession, replaceSession, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
