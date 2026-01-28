import React from "react";
import "./Login.css";

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

        <div className="login-info">
          <p>No profiles. No likes.</p>
          <p>Posts disappear in 1 hour.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;