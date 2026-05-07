import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthContext";
import { Home, Compass, User as UserIcon, Shield, LogOut, MessageCircle } from "lucide-react";
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
          <div className="nav-brand" onClick={() => navigate(mainPath)}>
            EXPOSE
          </div>
          
          <div className="nav-divider"></div>

          <NavLink to={mainPath} className={`nav-link ${location.pathname === mainPath ? 'active' : ''}`}>
            <Home size={18} /> <span className="nav-text">Inicio</span>
          </NavLink>
          
          <NavLink to="/feed" className={`nav-link ${location.pathname === '/feed' ? 'active' : ''}`}>
            <Compass size={18} /> <span className="nav-text">Feed</span>
          </NavLink>
          
          <NavLink to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
            <UserIcon size={18} /> <span className="nav-text">Perfil</span>
          </NavLink>

          <NavLink to="/messages" className={`nav-link ${location.pathname === '/messages' ? 'active' : ''}`}>
            <MessageCircle size={18} /> <span className="nav-text">Mensajes</span>
          </NavLink>
          
          {isAdmin && (
            <NavLink to="/admin/dashboard" className={`nav-link ${location.pathname === '/admin/dashboard' ? 'active' : ''}`}>
              <Shield size={18} /> <span className="nav-text">Admin</span>
            </NavLink>
          )}

          {isAuthenticated ? (
            <>
              <div className="nav-divider"></div>
              <div className="nav-user">
                <span className="nav-username">{user?.display_name || user?.username || "Usuario"}</span>
                <button className="nav-logout" onClick={() => logout()} title="Cerrar sesión">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="nav-divider"></div>
              <NavLink to="/login" className="nav-link active">Login</NavLink>
            </>
          )}
        </nav>
      </div>

      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;