import { useState } from "react";
import "./Login.css";
import { authService } from "./auth.service";
import { useAuth } from "./AuthContext";

interface RegisterProps {
  onBack: () => void;
}

const Register = ({ onBack }: RegisterProps) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !email || !password || !confirmPassword) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError("");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>
        <p className="login-subtitle">Create your anonymous access.</p>

        <div className="login-divider" />

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            className="login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />

          <input
            type="email"
            placeholder="Email address"
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

          <input
            type="password"
            placeholder="Confirm password"
            className="login-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p style={{ color: "#ff4444", fontSize: "0.8rem", margin: "10px 0" }}>{error}</p>}

          <button className="login-button">Register</button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            className="login-link"
            onClick={onBack}
            disabled={loading}
          >
            Already have an account? Login
          </button>
        </div>

        <div className="login-info">
          <p>No profiles. No likes.</p>
          <p>Posts disappear in 1 hour.</p>
        </div>
      </div>
    </div>
  );
};

export default Register;