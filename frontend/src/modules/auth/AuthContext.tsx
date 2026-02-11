import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { setToken as setApiToken, setUnauthorizedHandler } from '../../../services/api';

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
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

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    setTokenState(storedToken);
    setApiToken(storedToken);

    setUnauthorizedHandler(() => {
      logout(false);
      redirectToLogin();
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = (newToken: string) => {
    setTokenState(newToken);
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setApiToken(newToken);
  };

  const logout = (redirect = true) => {
    setTokenState(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setApiToken(null);
    if (redirect) {
      redirectToLogin();
    }
  };

  const value: AuthContextValue = {
    token,
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
