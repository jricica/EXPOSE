import React from 'react';
import { useAuth, redirectToLogin } from '../../modules/auth/AuthContext';
import { Loader2 } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

const PrivateRoute: React.FC<Props> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

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