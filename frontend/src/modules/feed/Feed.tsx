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
  const { isAuthenticated, user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // estado para filtro
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const loadPosts = async (pageNum: number, isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      
      const response = await get<any>(`/posts?page=${pageNum}&limit=20`);
      console.log('Feed data received:', response);

      const newPosts = response.posts || [];
      const pagination = response.pagination || { hasNext: false };

      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      
      setHasNext(pagination.hasNext);
      setPage(pageNum);
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message || `Error ${err.status}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido al cargar el feed");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPosts(1, true);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasNext) {
      loadPosts(page + 1);
    }
  };

  // posts filtrados - Asegurar que posts sea un array
  const filteredPosts = Array.isArray(posts)
    ? (showOnlyMine && user
      ? posts.filter((post) => post.userId === user.id)
      : posts)
    : [];

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

  if (!filteredPosts.length) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          opacity: 0.85,
        }}
      >
        <div style={{ fontSize: 42 }}>📭</div>
        <h3 style={{ marginTop: 12 }}>Nada por aquí</h3>

        <p style={{ fontSize: 14 }}>
          {showOnlyMine
            ? "Todavía no has publicado nada."
            : "Cuando haya publicaciones, aparecerán aquí."}
        </p>

        {isAuthenticated && (
          <button
            onClick={() => setShowOnlyMine(!showOnlyMine)}
            style={{ marginTop: 16 }}
          >
            {showOnlyMine ? "Ver todos los posts" : "Ver solo mis posts"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", display: "grid", gap: "12px" }}>
      {isAuthenticated && (
        <button
          onClick={() => setShowOnlyMine(!showOnlyMine)}
          style={{
            marginBottom: "1rem",
            alignSelf: "flex-start",
          }}
        >
          {showOnlyMine ? "Ver todos los posts" : "Mis posts"}
        </button>
      )}

      {filteredPosts.map((post) => (
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

      {hasNext && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            marginTop: "1rem",
            padding: "10px",
            background: "transparent",
            border: "1px solid #444",
            color: "#fff",
            borderRadius: "4px",
            cursor: loadingMore ? "not-allowed" : "pointer"
          }}
        >
          {loadingMore ? "Cargando más..." : "Cargar más"}
        </button>
      )}
    </div>
  );
};

export default Feed;