import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { OktaAuth, AuthState } from '@okta/okta-auth-js';
import { oktaConfig, isOktaConfigured } from './config';

// =============================================================================
// Types
// =============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// Okta Client
// =============================================================================

let oktaAuth: OktaAuth | null = null;

if (isOktaConfigured()) {
  oktaAuth = new OktaAuth({
    issuer: oktaConfig.issuer,
    clientId: oktaConfig.clientId,
    redirectUri: oktaConfig.redirectUri,
    scopes: oktaConfig.scopes,
    pkce: oktaConfig.pkce,
  });
}

// =============================================================================
// Demo User (quando Okta não está configurado)
// =============================================================================

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'demo@keelo.dev',
  name: 'Demo User',
  avatar: undefined,
};

// =============================================================================
// Provider Component
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      if (!oktaAuth) {
        // Demo mode - auto login
        const savedAuth = localStorage.getItem('keelo_demo_auth');
        if (savedAuth === 'true') {
          setIsAuthenticated(true);
          setUser(DEMO_USER);
        }
        setIsLoading(false);
        return;
      }

      try {
        // Handle callback
        if (window.location.pathname === '/callback') {
          await oktaAuth.handleLoginRedirect();
          window.location.replace('/');
          return;
        }

        // Check existing session
        const isAuth = await oktaAuth.isAuthenticated();
        setIsAuthenticated(isAuth);

        if (isAuth) {
          const userInfo = await oktaAuth.getUser();
          setUser({
            id: userInfo.sub || '',
            email: userInfo.email || '',
            name: userInfo.name || userInfo.email || '',
            avatar: typeof userInfo.picture === 'string' ? userInfo.picture : undefined,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    if (oktaAuth) {
      oktaAuth.authStateManager.subscribe((authState: AuthState) => {
        setIsAuthenticated(authState.isAuthenticated || false);
      });
    }
  }, []);

  const login = useCallback(async () => {
    if (!oktaAuth) {
      // Demo mode
      localStorage.setItem('keelo_demo_auth', 'true');
      setIsAuthenticated(true);
      setUser(DEMO_USER);
      return;
    }

    await oktaAuth.signInWithRedirect();
  }, []);

  const logout = useCallback(async () => {
    if (!oktaAuth) {
      // Demo mode
      localStorage.removeItem('keelo_demo_auth');
      setIsAuthenticated(false);
      setUser(null);
      return;
    }

    await oktaAuth.signOut();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!oktaAuth) {
      return 'demo-token';
    }

    const tokenManager = oktaAuth.tokenManager;
    const accessToken = await tokenManager.get('accessToken');
    return accessToken ? (accessToken as { accessToken: string }).accessToken : null;
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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

export { isOktaConfigured };

