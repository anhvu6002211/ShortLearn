import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
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

interface RefreshTokensPayload {
  access_token: string;
  access_token_expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  session_id: string;
}

type AuthenticatedRequest = (
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
) => Promise<Response>;

export interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  authenticatedRequest: AuthenticatedRequest;
  establishSession: (response: AuthResponse) => void;
  replaceSession: (session: AuthSession | null) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_SESSION_STORAGE_KEY = 'shortlearn.auth-session.v1';
const ACCESS_TOKEN_SAFETY_MARGIN_MS = 30_000;

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

function isValidStoredSession(value: unknown): value is AuthSession {
  const session = value as Partial<AuthSession> | null;
  return Boolean(
    session &&
      session.user &&
      typeof session.user.id === 'string' &&
      typeof session.user.email === 'string' &&
      typeof session.accessToken === 'string' &&
      typeof session.refreshToken === 'string' &&
      typeof session.sessionId === 'string' &&
      typeof session.accessTokenExpiresAt === 'number' &&
      typeof session.refreshTokenExpiresAt === 'number',
  );
}

async function loadStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredSession(parsed)) {
      await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    // Refresh token hết hạn thì phiên không thể xoay vòng — xóa để tránh kẹt trạng thái.
    if (parsed.refreshTokenExpiresAt <= Date.now()) {
      await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function persistStoredSession(session: AuthSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ghi SecureStore thất bại không được chặn luồng đăng nhập; session memory vẫn dùng được.
  }
}

async function deleteStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Xóa thất bại thì lần restore sau sẽ tự loại bỏ khi validate.
  }
}

function isRefreshTokensPayload(value: unknown): value is RefreshTokensPayload {
  const tokens = value as Partial<RefreshTokensPayload> | null;
  return Boolean(
    tokens &&
      typeof tokens.access_token === 'string' &&
      typeof tokens.refresh_token === 'string' &&
      typeof tokens.session_id === 'string' &&
      typeof tokens.access_token_expires_in === 'number' &&
      typeof tokens.refresh_token_expires_in === 'number',
  );
}

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession> | null>(null);

  const setActiveSession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const stored = await loadStoredSession();
      if (isMounted && stored) {
        sessionRef.current = stored;
        setSession(stored);
      }
      if (isMounted) setIsRestoring(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const clearStoredSessionState = useCallback(() => {
    refreshPromiseRef.current = null;
    sessionRef.current = null;
    setSession(null);
    void deleteStoredSession();
  }, []);

  const refreshActiveSession = useCallback(
    (current: AuthSession): Promise<AuthSession> => {
      const ongoing = refreshPromiseRef.current;
      if (ongoing) return ongoing;

      const task = (async (): Promise<AuthSession> => {
        if (current.refreshTokenExpiresAt <= Date.now()) {
          throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const response = await apiRequest(
          '/auth/refresh',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: current.refreshToken }),
          },
          5000,
        );
        if (!response.ok) {
          throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const body: unknown = await response.json();
        const tokens = (body as { tokens?: unknown })?.tokens;
        if (!isRefreshTokensPayload(tokens)) {
          throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        const now = Date.now();
        const next: AuthSession = {
          user: current.user,
          accessToken: tokens.access_token,
          accessTokenExpiresAt: now + Math.max(0, tokens.access_token_expires_in) * 1000,
          refreshToken: tokens.refresh_token,
          refreshTokenExpiresAt: now + Math.max(0, tokens.refresh_token_expires_in) * 1000,
          sessionId: tokens.session_id,
        };
        sessionRef.current = next;
        setSession(next);
        void persistStoredSession(next);
        return next;
      })();

      refreshPromiseRef.current = task;
      task.catch(() => {
        // Refresh thất bại nghĩa là phiên server đã thu hồi/hết hạn: dọn local để UI về trạng thái guest.
        clearStoredSessionState();
      });
      task.finally(() => {
        if (refreshPromiseRef.current === task) refreshPromiseRef.current = null;
      });
      return task;
    },
    [clearStoredSessionState],
  );

  const establishSession = useCallback(
    (response: AuthResponse) => {
      const next = createSession(response);
      refreshPromiseRef.current = null;
      setActiveSession(next);
      void persistStoredSession(next);
    },
    [setActiveSession],
  );

  const replaceSession = useCallback(
    (nextSession: AuthSession | null) => {
      refreshPromiseRef.current = null;
      setActiveSession(nextSession);
      if (nextSession) void persistStoredSession(nextSession);
      else void deleteStoredSession();
    },
    [setActiveSession],
  );

  const clearSession = useCallback(() => {
    const current = sessionRef.current;
    if (current?.refreshToken) {
      // Thu hồi phiên trên server (best-effort); dù mạng lỗi vẫn phải dọn local để logout ngay.
      void apiRequest(
        '/auth/logout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: current.refreshToken }),
        },
        5000,
      ).catch(() => {});
    }
    clearStoredSessionState();
  }, [clearStoredSessionState]);

  const authenticatedRequest = useCallback<AuthenticatedRequest>(
    async (path, init = {}, timeoutMs) => {
      let current = sessionRef.current;
      if (!current) throw new AuthSessionRequiredError();

      if (current.accessTokenExpiresAt - ACCESS_TOKEN_SAFETY_MARGIN_MS <= Date.now()) {
        try {
          current = await refreshActiveSession(current);
        } catch (error) {
          if (error instanceof AuthSessionRequiredError) throw error;
          throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }

      const sendWithToken = (token: string): Promise<Response> => {
        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return apiRequest(path, { ...init, headers }, timeoutMs);
      };

      const response = await sendWithToken(current.accessToken);
      if (response.status !== 401) return response;

      try {
        const refreshed = await refreshActiveSession(sessionRef.current ?? current);
        return await sendWithToken(refreshed.accessToken);
      } catch (error) {
        if (error instanceof AuthSessionRequiredError) throw error;
        throw new AuthSessionRequiredError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
    },
    [refreshActiveSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session && session.user.status === 'active'),
      isRestoring,
      authenticatedRequest,
      establishSession,
      replaceSession,
      clearSession,
    }),
    [authenticatedRequest, clearSession, establishSession, isRestoring, replaceSession, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
