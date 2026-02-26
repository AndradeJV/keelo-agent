import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { googleConfig, isGoogleConfigured } from './config';

// =============================================================================
// Types
// =============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: 'user' | 'admin';
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: () => void;
  loginWithCredentials: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'keelo_token';
const USER_KEY = 'keelo_user';

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'demo@keelo.dev',
  name: 'Demo User',
  avatar: undefined,
  role: 'admin',
};

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// Demo Auth Provider (no Google dependency)
// =============================================================================

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedAuth = localStorage.getItem('keelo_demo_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      setUser(DEMO_USER);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(() => {
    localStorage.setItem('keelo_demo_auth', 'true');
    setIsAuthenticated(true);
    setUser(DEMO_USER);
  }, []);

  const loginWithCredentials = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    // In demo mode, just do a normal demo login
    login();
    return { success: true };
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('keelo_demo_auth');
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return 'demo-token';
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, loginWithCredentials, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Google Auth Provider (uses useGoogleLogin — requires GoogleOAuthProvider)
// =============================================================================

function GoogleAuthProviderInner({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setUser(parsed);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        setIsLoading(true);

        const res = await fetch(`${API_BASE}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Auth failed' }));
          throw new Error(error.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Google auth error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
    },
  });

  const login = useCallback(() => {
    googleLogin();
  }, [googleLogin]);

  const loginWithCredentials = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, loginWithCredentials, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Exported Provider
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  if (!isGoogleConfigured()) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }

  return (
    <GoogleOAuthProvider clientId={googleConfig.clientId}>
      <GoogleAuthProviderInner>{children}</GoogleAuthProviderInner>
    </GoogleOAuthProvider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export for Login page
export { isGoogleConfigured };
