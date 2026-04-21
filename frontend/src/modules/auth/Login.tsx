import React, { useState } from "react";
import "./Login.css";
import { authService } from "./auth.service";
import { useAuth } from "./AuthContext";

const Login: React.FC = () => {
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Todos los campos son obligatorios");
      return;
    }

    try {
      setLoading(true);

      const data = await authService.login(email, password);

      localStorage.setItem("token", data.token);

      setUser(data.user);

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>

        <p className="login-subtitle">
          <div className="login-divider" />
          Share the moment. Disappear.
        </p>

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

          {/* 🔥 ERROR UX */}
          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Cargando..." : "Enter"}
          </button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            className="login-link"
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