import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthContext";
import { Home, Radio, UserRound, Shield, LogOut } from "lucide-react";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const location = useLocation();

  const mainPath = isAdmin ? "/admin/dashboard" : "/user/dashboard";

  return (
    <div className="layout-container">
      <div className="floating-nav-wrapper">
        <nav className="floating-nav">
          <button className="nav-brand" onClick={() => navigate(mainPath)}>
            EXPOSE
          </button>

          <span className="nav-status">24H CHANNEL</span>

          <div className="nav-links">
            <NavLink to={mainPath} className={`nav-link ${location.pathname === mainPath ? "active" : ""}`}>
              <Home size={16} />
              <span className="nav-text">Inicio</span>
            </NavLink>

            <NavLink to="/feed" className={`nav-link ${location.pathname === "/feed" ? "active" : ""}`}>
              <Radio size={16} />
              <span className="nav-text">Canal</span>
            </NavLink>

            <NavLink to="/profile" className={`nav-link ${location.pathname === "/profile" ? "active" : ""}`}>
              <UserRound size={16} />
              <span className="nav-text">Identidad</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin/dashboard"
                className={`nav-link ${location.pathname === "/admin/dashboard" ? "active" : ""}`}
              >
                <Shield size={16} />
                <span className="nav-text">Admin</span>
              </NavLink>
            )}
          </div>

          {isAuthenticated ? (
            <div className="nav-user">
              <span className="nav-username">{user?.display_name || user?.username || "ANON"}</span>
              <button className="nav-logout" onClick={() => logout()} title="Cerrar sesión">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="nav-login">
              Acceso
            </NavLink>
          )}
        </nav>
      </div>

      <main className="layout-main">{children}</main>
    </div>
  );
};

export default Layout;