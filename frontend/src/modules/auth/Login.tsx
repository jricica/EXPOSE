import React, { useState } from "react";
import "./Login.css";
import Register from "./Register";
import { authService } from "./auth.service";
import { useAuth } from "./AuthContext";

const Login: React.FC = () => {
  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">EXPOSE</h1>

        <p className="login-subtitle">
        <div className="login-divider" />
          Share the moment. Disappear.
        </p>

        <form className="login-form">
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
          />

          <button type="submit" className="login-button">
            Enter
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