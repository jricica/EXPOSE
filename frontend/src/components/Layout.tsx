import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthContext";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  const mainPath = isAdmin ? "/admin/dashboard" : "/user/dashboard";

  return (
    <div className="layout-container">
      <header className="layout-header">
        <h1 className="layout-logo" onClick={() => navigate(mainPath)}>
          EXPOSE
        </h1>
        {isAuthenticated ? (
          <div className="layout-user-actions">
            <span className="layout-user-pill">{user?.display_name || user?.username || "Cuenta"}</span>
            <button className="layout-logout" onClick={() => logout()}>
              Salir
            </button>
          </div>
        ) : (
          <button className="layout-logout" onClick={() => navigate("/login")}>Login</button>
        )}
      </header>

      <nav className="layout-nav">
        <NavLink to={mainPath}>Inicio</NavLink>
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/profile">Perfil</NavLink>
        {isAdmin && <NavLink to="/admin/dashboard">Admin</NavLink>}
      </nav>

      <main className="layout-content">
        <div className="layout-inner">{children}</div>
      </main>
    </div>
  );
};

export default Layout;