import { useEffect, useMemo, useState } from 'react';
import { HttpError } from '../../../services/api';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { postService, type FeedCursor } from '../posts/post.service';
import type { PostItem } from '../posts/post.types';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Send, MessageSquare, Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { messageService } from '../messages/message.service';
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
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const loadPosts = async (cursor?: FeedCursor, initial = false) => {
    try {
      if (initial) setLoading(true);
      else setLoadingMore(true);

      setError(null);
      const response = await postService.listFeed(20, cursor);

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
    void loadPosts(undefined, true);
  }, []);

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
      setError(err instanceof Error ? err.message : 'Error al marcar');
    }
  };

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;

    try {
      setPublishing(true);
      const created = await postService.createPost(draft.trim());
      setDraft('');
      setPosts((prev) => [created, ...prev]);
    } catch {
      setError('No se pudo transmitir el rastro.');
    } finally {
      setPublishing(false);
    }
  };

  const handleStartMessage = async (userId: number) => {
    if (userId === user?.id) return;
    try {
      const convo = await messageService.createDirectConversation(userId);
      navigate('/messages', { state: { conversationId: convo.conversationId } });
    } catch (err) {
      setError('No se pudo iniciar la conversación privada.');
    }
  };

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
            <button className="btn-refresh" onClick={() => loadPosts(undefined, true)} disabled={loading}>
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              className={`btn-filter ${showOnlyMine ? 'active' : ''}`} 
              onClick={() => setShowOnlyMine(!showOnlyMine)}
            >
              {showOnlyMine ? 'Mis rastros' : 'Todo el canal'}
            </button>
          </div>
        </header>

        <form className="feed-transmit-card" onSubmit={handlePublish}>
          <textarea
            placeholder="¿Qué quieres dejar ir hoy?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
          />
          <div className="transmit-footer">
            <span className="char-count">{280 - draft.length}</span>
            <button type="submit" disabled={publishing || !draft.trim()}>
              {publishing ? 'Transmitiendo...' : 'Transmitir'}
              <Send size={14} />
            </button>
          </div>
        </form>

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
                      <div className="sender-avatar">∅</div>
                      <div>
                        <span className="sender-name">Origen #{String(post.id).slice(-4)}</span>
                        <span className="transmission-time">{new Date(post.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <button className="card-opt"><MoreHorizontal size={18} /></button>
                  </div>

                  <div className="card-body">
                    <p>{post.content}</p>
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
                        onClick={() => {}}
                      >
                        <MessageCircle size={18} />
                        <span>{post.commentCount || 0}</span>
                      </button>
                    </div>

                    <button 
                      className="btn-message-sender"
                      onClick={() => handleStartMessage(post.userId)}
                      disabled={post.userId === user?.id}
                      title="Mensaje privado"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>
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