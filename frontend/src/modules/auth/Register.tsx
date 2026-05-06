import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";
import { authService, resolveAuthToken } from "./auth.service";
import { useAuth } from "./AuthContext";

const pwdRules = [
  { id: "len",    label: "Mínimo 10 caracteres",          test: (p: string) => p.length >= 10 },
  { id: "upper",  label: "Una letra mayúscula (A–Z)",      test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",  label: "Una letra minúscula (a–z)",      test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",  label: "Un número (0–9)",               test: (p: string) => /\d/.test(p) },
  { id: "symbol", label: "Un símbolo (!@#$%^&*…)",        test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isAdmin } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pwdFocused, setPwdFocused] = useState(false);

  const redirectTo = useMemo(() => searchParams.get("from") || "", [searchParams]);

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);

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

    try {
      setLoading(true);
      setError("");

      const data = await authService.register(username.trim(), email.trim(), password);
      const accessToken = resolveAuthToken(data);

      if (!accessToken) {
        throw new Error("No se recibio token despues del registro");
      }

      login(accessToken, data.user);

      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }

      navigate(data.user.role === 0 || data.user.role === "admin" ? "/admin/dashboard" : "/user/dashboard", {
        replace: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar el registro";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>
        <p className="login-subtitle">Crea tu cuenta y entra al panel.</p>

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

          <div className="pwd-field-wrap">
            <input
              type="password"
              placeholder="Password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPwdFocused(true)}
              disabled={loading}
            />
            {(pwdFocused || password.length > 0) && (
              <ul className="pwd-rules">
                {pwdRules.map((r) => (
                  <li key={r.id} className={r.test(password) ? "rule-ok" : "rule-fail"}>
                    <span className="rule-icon">{r.test(password) ? "✓" : "○"}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            type="password"
            placeholder="Confirmar contraseña"
            className="login-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>

        <div className="login-footer">
          <Link className="login-link" to="/login">
            Ya tienes cuenta? Inicia sesion
          </Link>
        </div>

        <div className="login-info">
          <p>Tu experiencia se adapta al rol.</p>
          <p>Acceso directo a user o admin dashboard.</p>
        </div>
      </div>
    </div>
  );
};

export default Register;