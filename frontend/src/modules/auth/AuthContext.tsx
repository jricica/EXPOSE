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
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'auth_token';

const redirectToLogin = () => {
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
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    const bootstrapAuth = async () => {
      if (!storedToken) {
        if (!active) return;
        setTokenState(null);
        setUser(null);
        localStorage.removeItem('auth_user');
        setApiToken(null);
        return;
      }

      setTokenState(storedToken);
      setApiToken(storedToken);

      try {
        const response = await authService.getMe();
        if (!active) return;
        setUser(response.user);
        localStorage.setItem('auth_user', JSON.stringify(response.user));
      } catch {
        if (!active) return;
        setTokenState(null);
        setUser(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem('auth_user');
        setApiToken(null);
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
  setUser(userData);
  localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
  localStorage.setItem('auth_user', JSON.stringify(userData));
  setApiToken(newToken);
};

  const logout = (redirect = true) => {
  setTokenState(null);
  setUser(null);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem('auth_user');
  setApiToken(null);

  if (redirect) {
    redirectToLogin();
  }
};

  const value: AuthContextValue = {
  token,
  user,
  isAuthenticated: Boolean(token),
  login,
  logout,
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
export { redirectToLogin };
