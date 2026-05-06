import React from "react";
import "./states.css";

const ErrorState: React.FC<{ message?: string }> = ({
  message = "Algo salió mal",
}) => {
  return (
    <div className="state-container">
      <p className="state-error">{message}</p>
    </div>
  );
};

export default ErrorState;