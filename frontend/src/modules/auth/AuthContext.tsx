import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setToken as setApiToken, setUnauthorizedHandler } from '../../../services/api';
import { authService } from './auth.service';

type AuthUser = {
  id: number;
  email?: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  role?: number | string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: (redirect?: boolean) => void;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

export const redirectToLogin = () => {
  const current = `${window.location.pathname}${window.location.search}`;

  if (window.location.pathname === '/login') {
    window.location.replace('/login');
    return;
  }

  const params = new URLSearchParams();
  params.set('from', current);

  window.location.replace(`/login?${params.toString()}`);
};

const isAdminRole = (role: number | string | undefined): boolean => {
  if (role === undefined || role === null) return false;
  if (typeof role === 'string') {
    const normalized = role.trim().toLowerCase();
    return normalized === 'admin' || normalized === '0';
  }

  return role === 0;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    const t = localStorage.getItem(TOKEN_STORAGE_KEY) ?? localStorage.getItem('token');
    return t === 'null' || t === 'undefined' ? null : t;
  });
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser && storedUser !== 'null' && storedUser !== 'undefined') {
      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    setTokenState(null);
    setUserState(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('token');
    setApiToken(null);
  };

  useEffect(() => {
    let active = true;

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? localStorage.getItem('token');
    const bootstrapAuth = async () => {
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        console.warn("AuthContext: No valid token found in localStorage, clearing auth.");
        clearAuth();
        setIsLoading(false);
        return;
      }

      setTokenState(storedToken);
      setApiToken(storedToken);

      try {
        console.log("AuthContext: Fetching /auth/me...");
        const response = await authService.getMe();
        console.log("AuthContext: /auth/me success!", response);

        if (!active) return;

        setUserState(response.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      } catch (err: any) {
        console.error("AuthContext: /auth/me failed!", err);
        if (!active) return;
        
        // Only clear auth if the server explicitly rejected the token (401 or 403)
        // If it's a network error, 500, or 503, keep the session alive!
        if (err?.status === 401 || err?.status === 403) {
          console.warn("AuthContext: Token invalid, clearing auth.");
          clearAuth();
        } else {
          console.warn("AuthContext: Network or server error, maintaining session.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    setUnauthorizedHandler(() => {
      logout(false);
      redirectToLogin();
    });

    void bootstrapAuth();

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = (newToken: string, userData: AuthUser) => {
    setTokenState(newToken);
    setUserState(userData);

    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem('token', newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));

    setApiToken(newToken);
  };

  const logout = (redirect = true) => {
    clearAuth();

    if (redirect) {
      redirectToLogin();
    }
  };

  const setUser = (userData: AuthUser | null) => {
    setUserState(userData);

    if (userData) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  const isAdmin = useMemo(() => isAdminRole(user?.role), [user?.role]);

  const value: AuthContextValue = {
    token,
    user,
    isAuthenticated: Boolean(token),
    isAdmin,
    isLoading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;