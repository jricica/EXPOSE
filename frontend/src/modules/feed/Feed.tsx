import { useEffect, useMemo, useRef, useState } from 'react';
import { HttpError } from '../../../services/api';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { postService, type FeedCursor, type FeedScope } from '../posts/post.service';
import type { PostComment, PostItem } from '../posts/post.types';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Send, MessageSquare, Heart, MessageCircle, MoreHorizontal, Trash2, ImagePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { messageService } from '../messages/message.service';
import { relationshipService } from '../relationships/relationship.service';
import { type PublicUser, userService } from '../users/user.service';
import './Feed.css';

const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedScope, setFeedScope] = useState<FeedScope>('general');
  const [ttlMinutes, setTtlMinutes] = useState(24 * 60);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [openCommentsByPost, setOpenCommentsByPost] = useState<Record<number, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<number, PostComment[]>>({});
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState<Record<number, boolean>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<number, string>>({});
  const [brokenAvatarByPost, setBrokenAvatarByPost] = useState<Record<number, boolean>>({});
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [userSearch, setUserSearch] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<PublicUser[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadPosts = async (cursor?: FeedCursor, initial = false, scope: FeedScope = feedScope) => {
    try {
      if (initial) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      const response = await postService.listFeed(20, cursor, scope);

      if (initial) setPosts(response.posts || []);
      else setPosts((prev) => [...prev, ...(response.posts || [])]);

      setNextCursor(response.pagination?.nextCursor || null);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Error cargando el feed';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPosts(undefined, true, feedScope);
  }, [feedScope]);

  useEffect(() => {
    if (!user?.id) return;

    const loadFollowing = async () => {
      try {
        const list = await relationshipService.listFollowing(user.id);
        setFollowingIds(new Set(list.map((item) => Number(item.targetUserId))));
      } catch {
        setFollowingIds(new Set());
      }
    };

    void loadFollowing();
  }, [user?.id]);

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
    void loadPosts(undefined, true, feedScope);
  };

  const handleSearchUsers = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = userSearch.trim();
    if (query.length < 2) {
      setSearchedUsers([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const results = await userService.searchUsers(query);
      setSearchedUsers(results.filter((item) => item.id !== user?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar usuarios.');
    } finally {
      setSearchingUsers(false);
    }
  };

  const filteredPosts = useMemo(() => posts, [posts]);

  const handleSetLike = async (postId: number, liked: boolean) => {
    try {
      const state = await postService.setLike(postId, liked);
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: state.likes, likedByMe: state.likedByMe } : post)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar');
    }
  };

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;

    try {
      setPublishing(true);
      let mediaUrl: string | undefined;

      if (selectedImage) {
        const uploaded = await postService.uploadPostImage(selectedImage);
        mediaUrl = uploaded.url;
      }

      const created = await postService.createPost(draft.trim(), { ttlMinutes, mediaUrl });
      setDraft('');
      setSelectedImage(null);
      setPosts((prev) => [created, ...prev]);
    } catch {
      setError('No se pudo transmitir el rastro.');
    } finally {
      setPublishing(false);
    }
  };

  const handleStartMessage = async (post: PostItem) => {
    if (post.userId === user?.id) return;
    try {
      const convo = await messageService.createDirectConversation(post.userId);
      const contentSnippet = post.content.length > 80 ? `${post.content.slice(0, 80)}...` : post.content;
      navigate('/messages', {
        state: {
          conversationId: convo.conversationId,
          prefill: `Sobre tu post #${post.id}: "${contentSnippet}"`,
          postReference: {
            postId: post.id,
            preview: contentSnippet,
          },
        },
      });
    } catch (err) {
      setError('No se pudo iniciar la conversación privada.');
    }
  };

  const handleStartMessageWithUser = async (targetUserId: number) => {
    if (!user || targetUserId === user.id) return;
    try {
      const convo = await messageService.createDirectConversation(targetUserId);
      navigate('/messages', { state: { conversationId: convo.conversationId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el chat directo.');
    }
  };

  const handleDeletePost = async (postId: number) => {
    try {
      await postService.deletePost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el post.');
    }
  };

  const handleToggleFollow = async (targetUserId: number) => {
    if (!user || targetUserId === user.id) {
      return;
    }

    const isFollowing = followingIds.has(targetUserId);

    try {
      if (isFollowing) {
        await relationshipService.unfollow(targetUserId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        return;
      }

      await relationshipService.follow(targetUserId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.add(targetUserId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el follow.');
    }
  };

  const handleToggleComments = async (postId: number) => {
    const willOpen = !openCommentsByPost[postId];
    setOpenCommentsByPost((prev) => ({ ...prev, [postId]: willOpen }));

    if (!willOpen || commentsByPost[postId]) {
      return;
    }

    try {
      setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: true }));
      const response = await postService.listComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: response.comments }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar comentarios.');
    } finally {
      setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleAddComment = async (postId: number) => {
    const content = (commentDraftByPost[postId] || '').trim();
    if (!content) {
      return;
    }

    try {
      const created = await postService.addComment(postId, content);
      setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), created] }));
      setCommentDraftByPost((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) => prev.map((post) =>
        post.id === postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comentar.');
    }
  };

  const getGeneratedAlias = (userId: number): string => {
    const adjectives = [
      'Neon',
      'Silver',
      'Velvet',
      'Amber',
      'Nova',
      'Midnight',
      'Aether',
      'Solar',
      'Echo',
      'Crimson',
    ];
    const nouns = [
      'Comet',
      'Cipher',
      'Orbit',
      'Ghost',
      'Voyager',
      'Mirage',
      'Pulse',
      'Sparrow',
      'Drift',
      'Halo',
    ];

    const adjective = adjectives[Math.abs(userId) % adjectives.length];
    const noun = nouns[Math.floor(Math.abs(userId) / adjectives.length) % nouns.length];
    return `${adjective} ${noun}`;
  };

  const getStableAlias = (post: PostItem): string => {
    if (post.author?.displayName?.trim()) return post.author.displayName.trim();
    return getGeneratedAlias(post.userId);
  };

  const getInitials = (label: string) =>
    label
      .replace('@', '')
      .split(' ')
      .map((chunk) => chunk[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const formatDuration = (totalSeconds: number): string => {
    const seconds = Math.max(0, totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }

    return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  };

  const getRemainingLabel = (post: PostItem): string => {
    const remainingSeconds = Math.floor((new Date(post.expiresAt).getTime() - nowMs) / 1000);
    if (remainingSeconds <= 0) {
      return 'Expirado';
    }

    return formatDuration(remainingSeconds);
  };

  const wheelProgress = ttlMinutes / (24 * 60);

  return (
    <Layout>
      <div className="feed-container">
        <header className="feed-header">
          <div className="feed-title-block">
            <span className="channel-tag">CHANNEL / ANONYMOUS / 24H</span>
            <h1>Flujo de Realidad</h1>
            <p>Pensamientos efímeros que existen solo mientras los miras.</p>
          </div>
          
          <div className="feed-controls">
            <button className="btn-refresh" onClick={handleRefreshFeed} disabled={loading}>
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="feed-scope-toggle">
              <button
                className={`btn-filter ${feedScope === 'general' ? 'active' : ''}`}
                onClick={() => setFeedScope('general')}
              >
                General
              </button>
              <button
                className={`btn-filter ${feedScope === 'following' ? 'active' : ''}`}
                onClick={() => setFeedScope('following')}
              >
                Following
              </button>
            </div>
          </div>
        </header>

        <section className="user-search-card">
          <form className="user-search-form" onSubmit={handleSearchUsers}>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar usuarios"
              minLength={2}
            />
            <button type="submit" disabled={searchingUsers || userSearch.trim().length < 2}>
              {searchingUsers ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {searchedUsers.length > 0 && (
            <div className="user-search-results">
              {searchedUsers.map((searchedUser) => {
                const alias = getGeneratedAlias(searchedUser.id);
                const isFollowing = followingIds.has(searchedUser.id);

                return (
                  <div key={searchedUser.id} className="user-result-item">
                    <div className="user-result-meta">
                      <span className="user-result-name">{alias}</span>
                      <span className="user-result-username">ID anónimo #{String(searchedUser.id).slice(-4)}</span>
                    </div>
                    <div className="user-result-actions">
                      <button
                        type="button"
                        className={`result-follow-btn ${isFollowing ? 'active' : ''}`}
                        onClick={() => handleToggleFollow(searchedUser.id)}
                      >
                        {isFollowing ? 'Siguiendo' : 'Seguir'}
                      </button>
                      <button
                        type="button"
                        className="result-message-btn"
                        onClick={() => handleStartMessageWithUser(searchedUser.id)}
                      >
                        Mensaje
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <form className="feed-transmit-card" onSubmit={handlePublish}>
          <textarea
            placeholder="¿Qué quieres dejar ir hoy?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
          />
          <div className="transmit-footer">
            <span className="char-count">{280 - draft.length}</span>
            <div className="transmit-options">
              <div className="ttl-wheel-wrap">
                <div
                  className="ttl-wheel"
                  style={{
                    background: `conic-gradient(#eeeeee ${wheelProgress * 360}deg, rgba(255,255,255,0.15) ${wheelProgress * 360}deg)`,
                  }}
                >
                  <div className="ttl-wheel-inner">
                    <span className="ttl-wheel-title">Duración</span>
                    <span className="ttl-wheel-value">{formatDuration(ttlMinutes * 60)}</span>
                  </div>
                </div>
                <input
                  className="ttl-range"
                  type="range"
                  min={1}
                  max={24 * 60}
                  step={1}
                  value={ttlMinutes}
                  onChange={(e) => setTtlMinutes(Number(e.target.value))}
                  aria-label="Duración del post en minutos"
                />
                <span className="ttl-range-hint">1 min - 24 horas</span>
              </div>

              <button type="button" className="btn-attach" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={14} />
                Imagen
              </button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
              />
              {selectedImage && <span className="selected-image-name">{selectedImage.name}</span>}
            </div>
            <button type="submit" disabled={publishing || !draft.trim()}>
              {publishing ? 'Transmitiendo...' : 'Transmitir'}
              <Send size={14} />
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
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="feed-error-notice"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="feed-status"
            >
              Sintonizando frecuencias...
            </motion.div>
          ) : (
            <div className="feed-items-grid">
              {filteredPosts.map((post, index) => (
                <motion.article 
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="transmission-card"
                >
                  <div className="card-header">
                    <div className="sender-info">
                      <div className="sender-avatar">
                        {post.author?.avatarUrl && !brokenAvatarByPost[post.id] ? (
                          <img
                            src={post.author.avatarUrl}
                            alt={getStableAlias(post)}
                            className="sender-avatar-img"
                            onError={() => setBrokenAvatarByPost((prev) => ({ ...prev, [post.id]: true }))}
                          />
                        ) : (
                          <span>{getInitials(getStableAlias(post))}</span>
                        )}
                      </div>
                      <div>
                        <span className="sender-name">{getStableAlias(post)}</span>
                        <span className="transmission-time">
                          {new Date(post.createdAt).toLocaleTimeString()} · {getRemainingLabel(post)}
                        </span>
                      </div>
                    </div>
                    <div className="card-opt-group">
                      {post.userId === user?.id && (
                        <button
                          className="card-opt delete"
                          onClick={() => handleDeletePost(post.id)}
                          title="Eliminar post"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button className="card-opt" title="Más opciones"><MoreHorizontal size={18} /></button>
                    </div>
                  </div>
                  <div className="card-body">
                    <p>{post.content}</p>
                    {post.media_url && (
                      <img className="post-media" src={post.media_url} alt="Imagen del post" />
                    )}
                  </div>

                  <div className="card-footer">
                    <div className="footer-actions">
                      <button 
                        className={`action-btn ${post.likedByMe ? 'active' : ''}`}
                        onClick={() => handleSetLike(post.id, !post.likedByMe)}
                      >
                        <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} />
                        <span>{post.likes || 0}</span>
                      </button>
                      
                      <button 
                        className="action-btn"
                        onClick={() => handleToggleComments(post.id)}
                      >
                        <MessageCircle size={18} />
                        <span>{post.commentCount || 0}</span>
                      </button>

                      {post.userId !== user?.id && (
                        <button
                          className={`action-btn follow-btn ${followingIds.has(post.userId) ? 'active' : ''}`}
                          onClick={() => handleToggleFollow(post.userId)}
                        >
                          {followingIds.has(post.userId) ? 'Siguiendo' : 'Seguir'}
                        </button>
                      )}
                    </div>

                    <button 
                      className="btn-message-sender"
                      onClick={() => handleStartMessage(post)}
                      disabled={post.userId === user?.id}
                      title="Mensaje privado sobre este post"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>

                  {openCommentsByPost[post.id] && (
                    <div className="comments-panel">
                      {loadingCommentsByPost[post.id] ? (
                        <p className="comments-loading">Cargando comentarios...</p>
                      ) : (
                        <>
                          <div className="comments-list">
                            {(commentsByPost[post.id] || []).map((comment) => (
                              <div key={comment.commentId} className="comment-item">
                                <span className="comment-alias">{getGeneratedAlias(comment.userId)}</span>
                                <p>{comment.content}</p>
                              </div>
                            ))}
                          </div>
                          <div className="comment-compose">
                            <input
                              type="text"
                              placeholder="Escribe un comentario"
                              value={commentDraftByPost[post.id] || ''}
                              onChange={(e) => setCommentDraftByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                              maxLength={500}
                            />
                            <button type="button" onClick={() => handleAddComment(post.id)}>Enviar</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.article>
              ))}
            </div>
          )}
        </AnimatePresence>

        {nextCursor && (
          <button className="btn-load-more" onClick={() => loadPosts(nextCursor)} disabled={loadingMore}>
            {loadingMore ? 'Recuperando más rastros...' : 'Cargar más transmisiones'}
          </button>
        )}
      </div>
    </Layout>
  );
};

export default Feed;