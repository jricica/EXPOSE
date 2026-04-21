import React from "react";
import "./states.css";

const EmptyState: React.FC<{ message?: string }> = ({
  message = "No hay contenido aún",
}) => {
  return (
    <div className="state-container">
      <p className="state-text">{message}</p>
    </div>
  );
};

export default EmptyState;