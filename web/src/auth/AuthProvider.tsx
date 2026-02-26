import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { googleConfig, githubConfig, isGoogleConfigured, isGithubConfigured, isSocialLoginConfigured } from './config';

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
  loginWithCredentials: (username: string, password: string) => Promise<{ success: boolean; error?: string; code?: string; email?: string }>;
  loginWithGithub: () => void;
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
// GitHub OAuth Helper
// =============================================================================

function openGithubOAuth() {
  const clientId = githubConfig.clientId;
  if (!clientId) return;

  const redirectUri = `${window.location.origin}/callback`;
  const scope = 'user:email';
  const state = crypto.randomUUID();

  // Store state for CSRF validation
  sessionStorage.setItem('github_oauth_state', state);

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
  window.location.href = url;
}

async function exchangeGithubCode(code: string): Promise<{ token: string; user: User } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Auth failed' }));
      console.error('GitHub auth error:', error);
      return null;
    }

    const data = await res.json();
    return { token: data.token, user: data.user };
  } catch (error) {
    console.error('GitHub exchange error:', error);
    return null;
  }
}

// =============================================================================
// Demo Auth Provider (no Google/GitHub dependency)
// =============================================================================

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for GitHub OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state && isGithubConfigured()) {
      const savedState = sessionStorage.getItem('github_oauth_state');
      if (state === savedState) {
        sessionStorage.removeItem('github_oauth_state');
        handleGithubCallback(code);
        return;
      }
    }

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
    } else {
      const savedAuth = localStorage.getItem('keelo_demo_auth');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
        setUser(DEMO_USER);
      }
    }
    setIsLoading(false);
  }, []);

  async function handleGithubCallback(code: string) {
    setIsLoading(true);
    const result = await exchangeGithubCode(code);
    if (result) {
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setIsAuthenticated(true);
    }
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    setIsLoading(false);
  }

  const login = useCallback(() => {
    localStorage.setItem('keelo_demo_auth', 'true');
    setIsAuthenticated(true);
    setUser(DEMO_USER);
  }, []);

  const loginWithCredentials = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string; code?: string; email?: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error, code: data.code, email: data.email };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.removeItem('keelo_demo_auth');
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGithub = useCallback(() => {
    openGithubOAuth();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('keelo_demo_auth');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return localStorage.getItem(TOKEN_KEY) || 'demo-token';
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, loginWithCredentials, loginWithGithub, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Full Auth Provider (Google + GitHub + credentials)
// =============================================================================

function FullAuthProviderInner({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Restore session from localStorage on mount + handle GitHub callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state && isGithubConfigured()) {
      const savedState = sessionStorage.getItem('github_oauth_state');
      if (state === savedState) {
        sessionStorage.removeItem('github_oauth_state');
        handleGithubCallback(code);
        return;
      }
    }

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

  async function handleGithubCallback(code: string) {
    setIsLoading(true);
    const result = await exchangeGithubCode(code);
    if (result) {
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setIsAuthenticated(true);
    }
    window.history.replaceState({}, '', window.location.pathname);
    setIsLoading(false);
  }

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

  const loginWithCredentials = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string; code?: string; email?: string }> => {
    try {
      setIsLoading(true);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error, code: data.code, email: data.email };
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

  const loginWithGithub = useCallback(() => {
    openGithubOAuth();
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
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, loginWithCredentials, loginWithGithub, logout, getAccessToken }}>
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
    // No Google configured — use DemoAuthProvider which also supports GitHub + credentials
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }

  return (
    <GoogleOAuthProvider clientId={googleConfig.clientId}>
      <FullAuthProviderInner>{children}</FullAuthProviderInner>
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
export { isGoogleConfigured, isGithubConfigured, isSocialLoginConfigured };
