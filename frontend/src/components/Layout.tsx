import { ReactNode } from "react";
import { useAuth } from "../modules/auth/AuthContext";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { isAuthenticated, logout } = useAuth();

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("popstate"));
  };

  return (
    <div className="layout-container">
      <header className="layout-header">
        <h1 className="layout-logo" onClick={() => navigateTo("/")} style={{ cursor: "pointer" }}>
          EXPOSE
        </h1>
        {isAuthenticated ? (
          <button className="layout-logout" onClick={() => logout()}>
            Logout
          </button>
        ) : (
          <button className="layout-logout" onClick={() => navigateTo("/login")}>
            Login
          </button>
        )}
      </header>

      <nav className="layout-nav">
        <span onClick={() => navigateTo("/")}>Home</span>
        <span onClick={() => navigateTo("/profile")}>Profile</span>
        <span>Explore</span>
      </nav>

      <main className="layout-content">
        <div className="layout-inner">{children}</div>
      </main>
    </div>
  );
};

export default Layout;