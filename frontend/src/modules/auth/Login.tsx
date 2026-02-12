import React, { useState } from "react";
import "./Login.css";
import Register from "./Register";
import { authService } from "./auth.service";
import { useAuth } from "./AuthContext";

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login: authLogin } = useAuth();

  if (!isLogin) return <Register onBack={() => setIsLogin(true)} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await authService.login(email, password);
      authLogin(response.token.accessToken);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>
        <p className="login-subtitle">
          Share the moment. Disappear.
        </p>

        <div className="login-divider" />

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username or email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p style={{ color: "#ff4444", fontSize: "0.8rem", margin: "10px 0" }}>{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Entering..." : "Enter"}
          </button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            className="login-link"
            onClick={() => setIsLogin(false)}
            disabled={loading}
          >
            Don't have an account? Register
          </button>
        </div>

        <div className="login-info">
          <p>No profiles. No likes.</p>
          <p>Posts disappear in hours.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;