import React, { useState } from "react";
import "./Login.css";
import { authService } from "./auth.service";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

type LoginProps = {
  onSwitchToRegister: () => void;
};

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await authService.login(email, password);
      login(response.token.accessToken, response.user);
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>

        <p className="login-subtitle">Share the moment. Disappear.</p>
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

          {error && <p style={{ color: "#ff8a8a", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Entering..." : "Enter"}
          </button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            className="login-link"
            onClick={onSwitchToRegister}
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