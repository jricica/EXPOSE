import { useEffect, useMemo, useState } from 'react';
import { HttpError } from '../../../services/api';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { postService, type FeedCursor } from '../posts/post.service';
import type { PostItem } from '../posts/post.types';
import './Feed.css';

const mockPosts: PostItem[] = [
  {
    id: 9001,
    userId: 1,
    content: 'Vi algo hoy y todavía no sé si era mejor contarlo o fingir que nunca pasó.',
    likes: 18,
    likedByMe: false,
    commentCount: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  } as PostItem,
  {
    id: 9002,
    userId: 2,
    content: 'Hay cosas que solo se pueden decir cuando nadie sabe quién las dijo.',
    likes: 31,
    likedByMe: true,
    commentCount: 7,
    createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
  } as PostItem,
  {
    id: 9003,
    userId: 3,
    content: 'Esto desaparece en unas horas. Tal vez por eso por fin me atreví a escribirlo.',
    likes: 12,
    likedByMe: false,
    commentCount: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  } as PostItem,
];

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
      const message =
        err instanceof HttpError
          ? err.message || `Error ${err.status}`
          : err instanceof Error
            ? err.message
            : 'Error cargando el feed';

      if (initial) {
        setPosts(mockPosts);
        setError('Modo visual activo: mostrando transmisiones locales mientras el backend no responde.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPosts(undefined, true);
  }, []);

  const filteredPosts = useMemo(() => {
    if (!showOnlyMine || !user) return posts;
    return posts.filter((post) => post.userId === user.id);
  }, [posts, showOnlyMine, user]);

  const handleSetLike = async (postId: number, liked: boolean) => {
    const isMockPost = postId >= 9000;

    if (isMockPost) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: liked ? (post.likes || 0) + 1 : Math.max((post.likes || 0) - 1, 0),
                likedByMe: liked,
              }
            : post,
        ),
      );
      return;
    }

    try {
      const state = await postService.setLike(postId, liked);
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: state.likes, likedByMe: state.likedByMe } : post)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la marca');
    }
  };

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.trim()) return;

    try {
      setPublishing(true);
      setError(null);

      const created = await postService.createPost(draft.trim());
      setDraft('');
      setPosts((prev) => [created, ...prev]);
    } catch {
      const localPost = {
        id: Date.now(),
        userId: user?.id || 0,
        content: draft.trim(),
        likes: 0,
        likedByMe: false,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      } as PostItem;

      setDraft('');
      setPosts((prev) => [localPost, ...prev]);
      setError('Modo visual activo: el backend no respondió, pero tu transmisión quedó visible localmente.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSendComment = async (postId: number) => {
    const content = commentDrafts[postId]?.trim() || '';

    if (!content) return;

    const isMockPost = postId >= 9000;

    if (isMockPost) {
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post)),
      );
      return;
    }

    try {
      setSubmittingCommentFor(postId);
      await postService.addComment(postId, content);
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la respuesta');
    } finally {
      setSubmittingCommentFor(null);
    }
  };

  return (
    <Layout>
      <section className="feed-shell">
        <div className="feed-hero">
          <div>
            <span className="feed-kicker">Canal anónimo / 24H</span>
            <h1>Flujo temporal</h1>
            <p>Publicaciones hechas en el momento. Sin perfil. Sin historial. Sin promesa de quedarse.</p>
          </div>

          <button className="feed-filter" onClick={() => setShowOnlyMine((value) => !value)}>
            {showOnlyMine ? 'Mis rastros' : 'Todo el canal'}
          </button>
        </div>

        <form className="feed-create" onSubmit={handlePublish}>
          <textarea
            placeholder="Escribe algo que no quieras cargar mañana..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={280}
          />
          <div className="feed-create-footer">
            <span>{280 - draft.length} caracteres antes del silencio</span>
            <button type="submit" disabled={publishing || !draft.trim()}>
              {publishing ? 'Transmitiendo...' : 'Transmitir'}
            </button>
          </div>
        </form>

        {error ? <p className="feed-notice">{error}</p> : null}
        {loading ? <p className="feed-empty">Abriendo canal...</p> : null}

        {!loading && filteredPosts.length === 0 ? (
          <p className="feed-empty">No hay rastros visibles en este filtro.</p>
        ) : null}

        <div className="feed-list">
          {filteredPosts.map((post) => (
            <article key={post.id} className="feed-card">
              <div className="feed-card-header">
                <div className="feed-avatar">∅</div>
                <div>
                  <p className="feed-author">Origen desconocido</p>
                  <span>{new Date(post.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <p className="feed-content">{post.content}</p>

              <div className="feed-meta">
                <span>{post.likes || 0} marcas</span>
                <span>{post.commentCount || 0} ecos</span>
              </div>

              <div className="feed-actions">
                <button onClick={() => handleSetLike(post.id, !Boolean(post.likedByMe))}>
                  {post.likedByMe ? 'Borrar marca' : 'Marcar'}
                </button>
                <button onClick={() => setExpandedPostId((id) => (id === post.id ? null : post.id))}>
                  {expandedPostId === post.id ? 'Ocultar eco' : 'Dejar eco'}
                </button>
              </div>

              {expandedPostId === post.id ? (
                <div className="feed-comment-box">
                  <input
                    type="text"
                    placeholder="Responde sin firmar..."
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
        </div>

        {nextCursor ? (
          <button className="feed-load-more" onClick={() => void loadPosts(nextCursor)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Abrir más rastros'}
          </button>
        ) : null}
      </section>
    </Layout>
  );
};

export default Feed;