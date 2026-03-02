import React from "react";
import { useState } from "react";
import Spinner from "../../components/Spinner";
import "./Login.css";

const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    // Simulación de request al backend
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setLoading(false);
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
          />

          <input
            type="password"
            placeholder="Password"
            className="login-input"
          />

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? <Spinner /> : "Enter"}
          </button>
        </form>

        <div className="login-info">
          <p>No profiles. No likes.</p>
          <p>Posts disappear in 1 hour.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;