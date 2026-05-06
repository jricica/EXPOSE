import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { postService } from '../posts/post.service';
import type { PostItem } from '../posts/post.types';
import { motion, Variants } from 'framer-motion';
import { Shield, Users, Activity, Flag, AlertTriangle, FileText, CheckCircle, ArrowRight, TrendingUp } from 'lucide-react';
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
        const message = err instanceof Error ? err.message : 'No se pudo cargar el panel de admin';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const summary = useMemo(() => {
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((acc, post) => acc + (post.likes || 0), 0);
    const totalComments = posts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
    const reportedPosts = posts.filter((post) => (post.reportsCount || 0) > 0).length;

    const topPost = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];

    return {
      totalPosts,
      totalLikes,
      totalComments,
      reportedPosts,
      topPost,
    };
  }, [posts]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const hasAlerts = summary.reportedPosts > 0;

  return (
    <Layout>
      <div className="dash-container">
        
        {/* TOP BAR / QUICK ACTIONS */}
        <motion.div 
          className="dash-top-bar"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="dash-time">
            <Activity size={16} color="#f97316" />
            <span style={{ color: '#f97316', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Sistema Operativo</span>
          </div>
          <button className="dash-btn-primary admin-btn" onClick={() => navigate('/feed')}>
            <Flag size={18} /> Moderar Feed
          </button>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HERO SECTION */}
          <motion.section className="dash-hero admin-hero" variants={itemVariants}>
            <div className="dash-hero-bg admin-bg"></div>
            <div className="dash-hero-content">
              <div className="dash-badge admin-badge">
                <Shield size={14} /> Acceso Nivel 0
              </div>
              <h1 className="dash-title">
                Comando <span className="text-gradient admin-gradient">Central</span>
              </h1>
              <p className="dash-subtitle" style={{ maxWidth: '400px' }}>
                Vista satelital de la plataforma. Analiza engagement, modera usuarios y garantiza la integridad de la red.
              </p>
            </div>
            
            <div className="dash-hero-stats">
              <motion.div className="hero-stat-card glow-red" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}><Flag size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">{summary.reportedPosts}</span>
                  <span className="stat-label">Reportados</span>
                </div>
              </motion.div>
              <motion.div className="hero-stat-card glow-blue" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}><FileText size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">{summary.totalPosts}</span>
                  <span className="stat-label">Total Posts</span>
                </div>
              </motion.div>
              <motion.div className="hero-stat-card glow-purple" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}><Users size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">{summary.totalComments + summary.totalLikes}</span>
                  <span className="stat-label">Interacciones</span>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Sincronizando base de datos...</div>
          ) : error ? (
            <div className="admin-error-panel">{error}</div>
          ) : (
            <section className="dash-main-grid">
              
              {/* COLUMN 1: Trending */}
              <div className="dash-col-left">
                <motion.div variants={itemVariants} className="insight-card glass-panel premium-border">
                  <div className="insight-header">
                    <TrendingUp size={20} color="#f97316" />
                    <h3 style={{ color: '#fff' }}>Contenido Viral</h3>
                  </div>
                  <div className="insight-body">
                    {summary.topPost ? (
                      <div className="action-card top-post-card">
                        <div className="action-text" style={{ width: '100%' }}>
                          <h3 className="post-quote">"{summary.topPost.content}"</h3>
                          <div className="post-metrics">
                            <span className="metric-pill likes"><CheckCircle size={14}/> {summary.topPost.likes || 0} Likes</span>
                            <span className="metric-pill comments"><FileText size={14}/> {summary.topPost.commentCount || 0} Comentarios</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state">No hay contenido viral analizado.</div>
                    )}
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="insight-card glass-panel premium-border">
                  <div className="insight-header">
                    <Activity size={20} color="#3b82f6" />
                    <h3 style={{ color: '#fff' }}>Salud del Sistema</h3>
                  </div>
                  <div className="insight-body stats-grid">
                     <div className="stat-box">
                       <div className="stat-box-value">{summary.totalLikes}</div>
                       <div className="stat-box-label">Likes Emitidos</div>
                     </div>
                     <div className="stat-box">
                       <div className="stat-box-value">{summary.totalPosts}</div>
                       <div className="stat-box-label">Publicaciones</div>
                     </div>
                     <div className="stat-box">
                       <div className="stat-box-value">{((summary.totalLikes / Math.max(summary.totalPosts, 1)) * 100).toFixed(1)}%</div>
                       <div className="stat-box-label">Engagement</div>
                     </div>
                  </div>
                </motion.div>
              </div>

              {/* COLUMN 2: Alerts */}
              <div className="dash-col-right">
                <motion.div variants={itemVariants} className={`insight-card glass-panel alert-panel ${hasAlerts ? 'is-danger' : 'is-safe'}`}>
                  <div className="insight-header">
                    <AlertTriangle size={24} color={hasAlerts ? '#f43f5e' : '#10b981'} />
                    <h3 style={{ color: hasAlerts ? '#f43f5e' : '#10b981', fontSize: '1.3rem' }}>
                      Estado de Seguridad
                    </h3>
                  </div>
                  <div className="insight-body">
                    {hasAlerts ? (
                      <div className="alert-content">
                        <div className="pulsing-dot danger"></div>
                        <div className="alert-text">
                          <strong>Acción Inmediata Requerida</strong>
                          <p>El sistema ha detectado <span>{summary.reportedPosts}</span> publicación(es) que exceden el umbral máximo de reportes de la comunidad.</p>
                          <button className="resolve-btn" onClick={() => navigate('/feed')}>Revisar ahora <ArrowRight size={14}/></button>
                        </div>
                      </div>
                    ) : (
                      <div className="alert-content">
                        <div className="pulsing-dot safe"></div>
                        <div className="alert-text">
                          <strong>Operación Normal</strong>
                          <p>No se ha detectado comportamiento anómalo. La comunidad cumple con los lineamientos comunitarios.</p>
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
