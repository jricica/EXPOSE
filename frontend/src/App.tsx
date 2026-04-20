import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Profile from "./modules/profile/Profile";
import Login from "./modules/auth/Login";
import Register from "./modules/auth/Register";
import PrivateRoute from "./shared/auth/PrivateRoute";
import { useAuth } from "./modules/auth/AuthContext";

function App() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  if (path === "/login") {
    return <Login onSwitchToRegister={() => navigate("/register")} />;
  }

  if (path === "/register") {
    return <Register onBack={() => navigate("/login")} />;
  }

  if (path === "/profile") {
    return (
      <PrivateRoute>
        <Profile />
      </PrivateRoute>
    );
  }

  return <Navigate to={isAuthenticated ? "/profile" : "/login"} replace />;
}

export default App;