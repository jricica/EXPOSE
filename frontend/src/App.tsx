import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './modules/auth/Login';
import Register from './modules/auth/Register';
import Feed from './modules/feed/Feed';
import Profile from './modules/profile/Profile';
import PrivateRoute from './shared/auth/PrivateRoute';
import { useAuth } from './modules/auth/AuthContext';
import UserDashboard from './modules/dashboard/UserDashboard';
import AdminDashboard from './modules/dashboard/AdminDashboard';
import NotFound from './NotFound';

const RootRedirect = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={isAdmin ? '/admin/dashboard' : '/user/dashboard'} replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/user/dashboard"
        element={
          <PrivateRoute>
            <UserDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <PrivateRoute requireAdmin>
            <AdminDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/feed"
        element={
          <PrivateRoute>
            <Feed />
          </PrivateRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;