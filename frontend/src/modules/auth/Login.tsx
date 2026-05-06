import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";
import { authService, resolveAuthToken } from "./auth.service";
import { useAuth } from "./AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isAdmin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = useMemo(() => searchParams.get("from") || "", [searchParams]);

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Todos los campos son obligatorios");
      return;
    }

    try {
      setLoading(true);

      const data = await authService.login(email.trim(), password);
      const accessToken = resolveAuthToken(data);

      if (!accessToken) {
        throw new Error("No se recibio token de acceso");
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
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesion";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>

        <p className="login-subtitle">Entrá al canal. Nada aquí está hecho para quedarse.</p>
        <div className="login-divider" />

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Alias o email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Clave de acceso"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
          {loading ? "Abriendo canal..." : "Entrar"}
          </button>
        </form>

        <div className="login-footer">
          <Link className="login-link" to="/register">
          No tienes acceso? Crear identidad
          </Link>
        </div>

        <div className="login-info">
        <p>Sin perfiles públicos. Sin seguidores. Sin historial permanente.</p>
        <p>Las publicaciones nacen en el momento y desaparecen en 24H.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;