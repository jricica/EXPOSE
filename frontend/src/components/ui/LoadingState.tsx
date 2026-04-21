import React from "react";
import "./states.css";

const LoadingState: React.FC = () => {
  return (
    <div className="state-container">
      <div className="loader" />
      <p>Cargando...</p>
    </div>
  );
};

export default LoadingState;