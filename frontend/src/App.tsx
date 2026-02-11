import React, { useEffect, useState } from "react";
import Profile from "./modules/profile/Profile";
import Login from "./modules/auth/Login";
import Feed from "./modules/feed/Feed";
import { AuthProvider } from "./modules/auth/AuthContext";
import PrivateRoute from "./shared/auth/PrivateRoute";

const RouterSwitch: React.FC = () => {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (path === "/login") return <Login />;
  if (path === "/profile") {
    return (
      <PrivateRoute>
        <Profile />
      </PrivateRoute>
    );
  }

  // Default route: feed (pública)
  return <Feed />;
};

function App() {
  return (
    <AuthProvider>
      <RouterSwitch />
    </AuthProvider>
  );
}

export default App;
