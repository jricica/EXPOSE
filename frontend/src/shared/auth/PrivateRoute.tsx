import React from 'react';
import { useAuth, redirectToLogin } from '../../modules/auth/AuthContext';

type Props = {
  children: React.ReactNode;
};

const PrivateRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    redirectToLogin();
    return null;
  }

  return <>{children}</>;
};

export default PrivateRoute;