import React, { useEffect, useState } from "react";
import { HttpError } from "../../../services/api";
import { useAuth } from "../auth/AuthContext";
import { postService } from "../posts/post.service";
import { FeedCursor, } from "../posts/post.service";
import { PostItem } from "../posts/post.types";


const Feed: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  // estado para filtro
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const loadPosts = async (cursor?: FeedCursor, isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const response = await postService.listFeed(20, cursor);

      const newPosts = response.posts || [];
      const pagination = response.pagination || { nextCursor: null };

      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setNextCursor(pagination.nextCursor);
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
    loadPosts(undefined, true);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && nextCursor) {
      loadPosts(nextCursor);
    }
  };

  const handleSetLike = async (postId: number, liked: boolean) => {
    try {
      const state = await postService.setLike(postId, liked);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, likes: state.likes, likedByMe: state.likedByMe }
            : post,
        ),
      );
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message || `Error ${err.status}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se pudo actualizar el like');
      }
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
            {isAuthenticated && (
              <span style={{ marginLeft: 12, color: post.likedByMe ? '#7CFC9A' : '#aaa' }}>
                {post.likedByMe ? 'Te gusta' : 'Aun no te gusta'}
              </span>
            )}

            {post.createdAt && (
              <span style={{ marginLeft: 12 }}>
                Publicado: {new Date(post.createdAt).toLocaleString()}
              </span>
            )}
          </div>

          {isAuthenticated && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSetLike(post.id, !Boolean(post.likedByMe))}
                style={{
                  border: '1px solid #555',
                  borderRadius: 6,
                  padding: '6px 10px',
                  background: post.likedByMe ? '#173824' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {post.likedByMe ? 'Ya no me gusta' : 'Me gusta'}
              </button>

              <button
                onClick={() => setExpandedPostId((prev) => (prev === post.id ? null : post.id))}
                style={{
                  border: '1px solid #555',
                  borderRadius: 6,
                  padding: '6px 10px',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {expandedPostId === post.id ? 'Ocultar detalles' : 'Mostrar detalles'}
              </button>
            </div>
          )}

          {expandedPostId === post.id && (
            <section style={{ marginTop: 12, borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Comentarios y Actividad</h4>
              <input
                type="text"
                value={commentDrafts[post.id] ?? ''}
                onChange={(event) =>
                  setCommentDrafts((drafts) => ({
                    ...drafts,
                    [post.id]: event.target.value,
                  }))
                }
                placeholder="Escribe un comentario..."
                style={{
                  width: '100%',
                  border: '1px solid #444',
                  borderRadius: 6,
                  padding: '8px 10px',
                  background: '#121212',
                  color: '#f3f3f3',
                }}
              />
            </section>
          )}
        </article>
      ))}

      {nextCursor && (
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