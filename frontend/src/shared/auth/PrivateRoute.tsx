import React from 'react';
import { useAuth, redirectToLogin } from '../../modules/auth/AuthContext';

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

const PrivateRoute: React.FC<Props> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) {
    redirectToLogin();
    return null;
  }

  if (requireAdmin && !isAdmin) {
    window.location.replace('/user/dashboard');
    return null;
  }

  return <>{children}</>;
};

export default PrivateRoute;