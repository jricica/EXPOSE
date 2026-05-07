import { useEffect, useMemo, useState } from 'react';
import { HttpError } from '../../../services/api';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { postService, type FeedCursor } from '../posts/post.service';
import type { PostItem } from '../posts/post.types';
import './Feed.css';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [submittingCommentFor, setSubmittingCommentFor] = useState<number | null>(null);
  const [hasNewPosts, setHasNewPosts] = useState(false);

  const loadPosts = async (cursor?: FeedCursor, initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);

      const response = await postService.listFeed(20, cursor);

      if (initial) {
        setPosts(response.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(response.posts || [])]);
      }

      setNextCursor(response.pagination?.nextCursor || null);
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message || `Error ${err.status}`);
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando el feed');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPosts(undefined, true);
  }, []);

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
    const sseUrl = apiBase.startsWith('http')
      ? `${apiBase}/posts/events`
      : `${window.location.origin}${apiBase}/posts/events`;

    const es = new EventSource(sseUrl);

    es.addEventListener('new_post', (event) => {
      try {
        const data = JSON.parse(event.data) as { userId: number };
        if (data.userId !== user?.id) {
          setHasNewPosts(true);
        }
      } catch {
        // ignorar eventos malformados
      }
    });

    return () => es.close();
  }, [user?.id]);

  const handleRefreshFeed = () => {
    setHasNewPosts(false);
    void loadPosts(undefined, true);
  };

  const filteredPosts = useMemo(() => {
    if (!showOnlyMine || !user) return posts;
    return posts.filter((post) => post.userId === user.id);
  }, [posts, showOnlyMine, user]);

  const handleSetLike = async (postId: number, liked: boolean) => {
    try {
      const state = await postService.setLike(postId, liked);
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: state.likes, likedByMe: state.likedByMe } : post)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar like');
    }
  };

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    try {
      setPublishing(true);
      setError(null);

      const created = await postService.createPost(draft.trim());
      setDraft('');
      setPosts((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el post');
    } finally {
      setPublishing(false);
    }
  };

  const handleSendComment = async (postId: number) => {
    const content = commentDrafts[postId]?.trim() || '';

    if (!content) {
      return;
    }

    try {
      setSubmittingCommentFor(postId);
      await postService.addComment(postId, content);
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentCount: (post.commentCount || 0) + 1,
              }
            : post,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comentar');
    } finally {
      setSubmittingCommentFor(null);
    }
  };

  return (
    <Layout>
      <section className="feed-shell">
        <div className="feed-topbar">
          <h2>Feed en vivo</h2>
          <button className="feed-filter" onClick={() => setShowOnlyMine((value) => !value)}>
            {showOnlyMine ? 'Mostrando: mis posts' : 'Mostrando: todo'}
          </button>
        </div>

        <form className="feed-create" onSubmit={handlePublish}>
          <textarea
            placeholder="Comparte algo con tu comunidad..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={280}
          />
          <div className="feed-create-footer">
            <span>{280 - draft.length} caracteres</span>
            <button type="submit" disabled={publishing || !draft.trim()}>
              {publishing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>

        {hasNewPosts ? (
          <button className="feed-new-posts-banner" onClick={handleRefreshFeed}>
            Hay nuevos posts — clic para actualizar
          </button>
        ) : null}

        {error ? <p className="feed-error">{error}</p> : null}
        {loading ? <p className="feed-empty">Cargando publicaciones...</p> : null}

        {!loading && filteredPosts.length === 0 ? (
          <p className="feed-empty">No hay publicaciones para este filtro todavia.</p>
        ) : null}

        {filteredPosts.map((post) => (
          <article key={post.id} className="feed-card">
            <div className="feed-author">
              <strong>{post.author?.displayName || post.author?.username || `Usuario #${post.userId}`}</strong>
              <span>@{post.author?.username || `user${post.userId}`}</span>
            </div>
            <p className="feed-content">{post.content}</p>
            <div className="feed-meta">
              <span>{post.likes || 0} likes</span>
              <span>{post.commentCount || 0} comentarios</span>
              <span>{new Date(post.createdAt).toLocaleString()}</span>
            </div>

            <div className="feed-actions">
              <button onClick={() => handleSetLike(post.id, !Boolean(post.likedByMe))}>
                {post.likedByMe ? 'Quitar like' : 'Dar like'}
              </button>
              <button onClick={() => setExpandedPostId((id) => (id === post.id ? null : post.id))}>
                {expandedPostId === post.id ? 'Ocultar' : 'Comentar'}
              </button>
            </div>

            {expandedPostId === post.id ? (
              <div className="feed-comment-box">
                <input
                  type="text"
                  placeholder="Escribe un comentario"
                  value={commentDrafts[post.id] || ''}
                  onChange={(event) =>
                    setCommentDrafts((prev) => ({
                      ...prev,
                      [post.id]: event.target.value,
                    }))
                  }
                />
                <button
                  onClick={() => void handleSendComment(post.id)}
                  disabled={submittingCommentFor === post.id || !(commentDrafts[post.id] || '').trim()}
                >
                  {submittingCommentFor === post.id ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {nextCursor ? (
          <button className="feed-load-more" onClick={() => void loadPosts(nextCursor)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar mas'}
          </button>
        ) : null}
      </section>
    </Layout>
  );
};

export default Feed;