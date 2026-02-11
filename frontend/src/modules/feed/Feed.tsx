import React, { useEffect, useState } from "react";
import { get, HttpError } from "../../../services/api";
import { useAuth } from "../auth/AuthContext";

type Post = {
  id: number;
  content: string;
  createdAt?: string;
  expiresAt?: string;
  likes?: number;
  likedByMe?: boolean;
  userId?: number;
};

const Feed: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await get<Post[]>("/posts");
        if (!cancelled) {
          setPosts(data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof HttpError) {
          setError(err.message || `Error ${err.status}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Error desconocido al cargar el feed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={{ padding: "1rem" }}>Cargando feed...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1rem", color: "#b00020" }}>
        Error al cargar el feed: {error}
        {!isAuthenticated && " (puedes iniciar sesión para más contenido)"}
      </div>
    );
  }

  if (!posts.length) {
    return <div style={{ padding: "1rem" }}>No hay publicaciones aún.</div>;
  }

  return (
    <div style={{ padding: "1rem", display: "grid", gap: "12px" }}>
      {posts.map((post) => (
        <article
          key={post.id}
          style={{
            border: "1px solid #222",
            borderRadius: 8,
            padding: "12px 14px",
            background: "#0f0f0f",
            color: "#f3f3f3",
          }}
        >
          <p style={{ margin: 0 }}>{post.content}</p>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            <span>{post.likes ?? 0} likes</span>
            {post.createdAt && (
              <span style={{ marginLeft: 12 }}>
                Publicado: {new Date(post.createdAt).toLocaleString()}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export default Feed;
