import React, { useState } from "react";
import "./PostCard.css";

type Props = {
  post: {
    id: number;
    username: string;
    content: string;
    image_url?: string;
    created_at: string;
    is_sensitive?: boolean;
  };
};

const PostCard: React.FC<Props> = ({ post }) => {
  const [showContent, setShowContent] = useState(!post.is_sensitive);

  const handleReport = async () => {
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          reason: "Contenido inapropiado",
        }),
      });

      alert("Reporte enviado");
    } catch {
      alert("Error al enviar reporte");
    }
  };

  return (
    <div className="post-card">

      {/* HEADER */}
      <div className="post-header">
        <span className="post-user">@{post.username}</span>
        <span className="post-time">
          {new Date(post.created_at).toLocaleTimeString()}
        </span>
      </div>

      {/* WARNING CONTENIDO SENSIBLE */}
      {post.is_sensitive && !showContent && (
        <div className="sensitive-warning">
          ⚠ Contenido sensible
          <button
            className="show-content-btn"
            onClick={() => setShowContent(true)}
          >
            Ver
          </button>
        </div>
      )}

      {/* CONTENT */}
      {showContent && (
        <>
          <div className="post-content">
            <p>{post.content}</p>
          </div>

          {post.image_url && (
            <img src={post.image_url} alt="post" className="post-image" />
          )}
        </>
      )}

      {/* ACTIONS */}
      <div className="post-actions">
        <button title="Like">❤️</button>
        <button title="Comentar">💬</button>
        <button title="Compartir">↗</button>
        <button title="Reportar" onClick={handleReport}>🚩</button>
      </div>

    </div>
  );
};

export default PostCard;