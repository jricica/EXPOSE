import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { postService } from '../posts/post.service';
import type { PostItem } from '../posts/post.types';
import { motion, Variants } from 'framer-motion';
import { Shield, Activity, Flag, AlertTriangle, FileText, CheckCircle, ArrowRight, EyeOff } from 'lucide-react';
import './Dashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await postService.listFeed(50);
        setPosts(response.posts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el panel de control');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const summary = useMemo(() => {
    const totalPosts = posts.length;
    const totalComments = posts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
    const reportedPosts = posts.filter((post) => (post.reportsCount || 0) > 0).length;
    const topPost = [...posts].sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))[0];

    return { totalPosts, totalComments, reportedPosts, topPost };
  }, [posts]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
  };

  const hasAlerts = summary.reportedPosts > 0;

  return (
    <Layout>
      <div className="dash-container">
        <motion.div className="dash-top-bar" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}>
          <div className="dash-time">
            <Activity size={16} />
            <span>Panel de control / canal activo</span>
          </div>

          <button className="dash-btn-primary admin-btn" onClick={() => navigate('/feed')}>
            <Flag size={17} /> Revisar canal
          </button>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.section className="dash-hero admin-hero" variants={itemVariants}>
            <div className="dash-hero-bg admin-bg"></div>

            <div className="dash-hero-content">
              <div className="dash-badge admin-badge">
                <Shield size={14} /> Acceso restringido
              </div>

              <h1 className="dash-title">
                Control del <span className="text-gradient admin-gradient">canal</span>
              </h1>

              <p className="dash-subtitle" style={{ maxWidth: '430px' }}>
                Vista interna para revisar actividad, detectar reportes y mantener el flujo anónimo bajo control sin romper la experiencia efímera.
              </p>
            </div>

            <div className="dash-hero-stats">
              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <Flag size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{summary.reportedPosts}</span>
                  <span className="stat-label">Reportes</span>
                </div>
              </motion.div>

              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{summary.totalPosts}</span>
                  <span className="stat-label">Rastros</span>
                </div>
              </motion.div>

              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <EyeOff size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">24H</span>
                  <span className="stat-label">Caducidad</span>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Leyendo actividad del canal...
            </div>
          ) : error ? (
            <div className="admin-error-panel">{error}</div>
          ) : (
            <section className="dash-main-grid">
              <div className="dash-col-left">
                <motion.div variants={itemVariants} className="insight-card glass-panel premium-border">
                  <div className="insight-header">
                    <FileText size={20} />
                    <h3>Último rastro relevante</h3>
                  </div>

                  <div className="insight-body">
                    {summary.topPost ? (
                      <div className="action-card top-post-card">
                        <div className="action-text" style={{ width: '100%' }}>
                          <h3 className="post-quote">"{summary.topPost.content}"</h3>
                          <div className="post-metrics">
                            <span className="metric-pill likes">
                              <CheckCircle size={14} /> {summary.topPost.likes || 0} marcas
                            </span>
                            <span className="metric-pill comments">
                              <FileText size={14} /> {summary.topPost.commentCount || 0} ecos
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state">No hay rastros suficientes para analizar.</div>
                    )}
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="insight-card glass-panel premium-border">
                  <div className="insight-header">
                    <Activity size={20} />
                    <h3>Estado del flujo</h3>
                  </div>

                  <div className="insight-body stats-grid">
                    <div className="stat-box">
                      <div className="stat-box-value">{summary.totalComments}</div>
                      <div className="stat-box-label">Ecos</div>
                    </div>

                    <div className="stat-box">
                      <div className="stat-box-value">{summary.totalPosts}</div>
                      <div className="stat-box-label">Rastros</div>
                    </div>

                    <div className="stat-box">
                      <div className="stat-box-value">{summary.reportedPosts}</div>
                      <div className="stat-box-label">Alertas</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="dash-col-right">
                <motion.div
                  variants={itemVariants}
                  className={`insight-card glass-panel alert-panel ${hasAlerts ? 'is-danger' : 'is-safe'}`}
                >
                  <div className="insight-header">
                    <AlertTriangle size={22} />
                    <h3>Seguridad del canal</h3>
                  </div>

                  <div className="insight-body">
                    {hasAlerts ? (
                      <div className="alert-content">
                        <div className="pulsing-dot danger"></div>
                        <div className="alert-text">
                          <strong>Revisión requerida</strong>
                          <p>
                            El canal detectó <span>{summary.reportedPosts}</span> publicación(es) marcadas por la comunidad.
                          </p>
                          <button className="resolve-btn" onClick={() => navigate('/feed')}>
                            Revisar ahora <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="alert-content">
                        <div className="pulsing-dot safe"></div>
                        <div className="alert-text">
                          <strong>Canal estable</strong>
                          <p>No hay señales críticas. El flujo anónimo se mantiene dentro de los límites esperados.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;