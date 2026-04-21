import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { setToken as setApiToken, setUnauthorizedHandler } from '../../../services/api';
import { authService } from './auth.service';

type AuthUser = {
  id: number;
  email?: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
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

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);

    const bootstrapAuth = async () => {
      if (!storedToken) {
        cleanupAuth();
        return;
      }

      setTokenState(storedToken);
      setApiToken(storedToken);

      if (storedUser) {
        try {
          setUserState(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }

      try {
        const response = await authService.getMe();

        if (!active) return;

        setUserState(response.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      } catch {
        if (!active) return;
        cleanupAuth();
      }
    };

    const cleanupAuth = () => {
      setTokenState(null);
      setUserState(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setApiToken(null);
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
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));

    setApiToken(newToken);
  };

  const logout = (redirect = true) => {
    setTokenState(null);
    setUserState(null);

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);

    setApiToken(null);

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

  const value: AuthContextValue = {
    token,
    user,
    isAuthenticated: Boolean(token),
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