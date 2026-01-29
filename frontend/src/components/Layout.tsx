import { ReactNode } from "react";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="layout-container">
      <header className="layout-header">
        <h1 className="layout-logo">EXPOSE</h1>
        <button className="layout-logout">Logout</button>
      </header>

      <nav className="layout-nav">
        <span>Home</span>
        <span>Capture</span>
        <span>Explore</span>
      </nav>

      <main className="layout-content">
  <div className="layout-inner">
    {children}
  </div>
</main>
    </div>
  );
};

export default Layout;