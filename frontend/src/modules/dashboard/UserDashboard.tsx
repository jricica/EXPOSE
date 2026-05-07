import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { motion, Variants } from 'framer-motion';
import { 
  Sparkles, ArrowRight, Activity, Zap, User as UserIcon, 
  MessageSquare, Heart, TrendingUp, Clock, Plus
} from 'lucide-react';
import './Dashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Bienvenido');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const hour = currentTime.getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
    return () => clearInterval(timer);
  }, [currentTime]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }
  };

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
            <Clock size={16} />
            <span>{currentTime.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <button className="dash-btn-primary" onClick={() => navigate('/feed')}>
            <Plus size={18} /> Nueva Publicación
          </button>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HERO SECTION */}
          <motion.section className="dash-hero" variants={itemVariants}>
            <div className="dash-hero-bg"></div>
            <div className="dash-hero-content">
              <div className="dash-badge">
                <Sparkles size={14} /> Nivel 1 • Activo
              </div>
              <h1 className="dash-title">
                {greeting},<br/>
                <span className="text-gradient">{user?.display_name || user?.username || 'Usuario'}</span>
              </h1>
              <p className="dash-subtitle">
                Este es tu centro de control. Descubre tendencias, interactúa con la comunidad y haz oír tu voz.
              </p>
            </div>
            
            <div className="dash-hero-stats">
              <motion.div className="hero-stat-card glow-blue" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}><MessageSquare size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">12</span>
                  <span className="stat-label">Posts</span>
                </div>
              </motion.div>
              <motion.div className="hero-stat-card glow-red" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}><Heart size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">48</span>
                  <span className="stat-label">Me gusta</span>
                </div>
              </motion.div>
              <motion.div className="hero-stat-card glow-purple" whileHover={{ scale: 1.05 }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}><TrendingUp size={20} /></div>
                <div className="stat-info">
                  <span className="stat-value">+15%</span>
                  <span className="stat-label">Impacto</span>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* MAIN GRID */}
          <section className="dash-main-grid">
            
            {/* COLUMN 1: Actions */}
            <div className="dash-col-left">
              <motion.div variants={itemVariants}>
                <Link to="/feed" className="action-card interactive-card">
                  <div className="action-icon blue">
                    <Activity size={24} />
                  </div>
                  <div className="action-text">
                    <h3>Explorar el Feed</h3>
                    <p>Únete a la conversación global</p>
                  </div>
                  <ArrowRight className="action-arrow" size={20} />
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link to="/profile" className="action-card interactive-card">
                  <div className="action-icon purple">
                    <UserIcon size={24} />
                  </div>
                  <div className="action-text">
                    <h3>Configurar Perfil</h3>
                    <p>Personaliza tu identidad</p>
                  </div>
                  <ArrowRight className="action-arrow" size={20} />
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link to="/messages" className="action-card interactive-card">
                  <div className="action-icon blue">
                    <MessageSquare size={24} />
                  </div>
                  <div className="action-text">
                    <h3>Mensajes Directos</h3>
                    <p>Habla con otros usuarios en privado</p>
                  </div>
                  <ArrowRight className="action-arrow" size={20} />
                </Link>
              </motion.div>
            </div>

            {/* COLUMN 2: Trending / Tips */}
            <div className="dash-col-right">
              <motion.div variants={itemVariants} className="insight-card glass-panel">
                <div className="insight-header">
                  <Zap size={20} className="text-yellow-400" />
                  <h3>Consejos de Crecimiento</h3>
                </div>
                <div className="insight-body">
                  <div className="tip-item">
                    <div className="tip-dot"></div>
                    <div>
                      <strong>Sé constante</strong>
                      <p>Publicar regularmente aumenta tu visibilidad un 30% en la red.</p>
                    </div>
                  </div>
                  <div className="tip-item">
                    <div className="tip-dot" style={{ background: '#a78bfa', boxShadow: '0 0 10px rgba(167,139,250,0.6)' }}></div>
                    <div>
                      <strong>Interactúa</strong>
                      <p>Dar likes y comentar fortalece tus conexiones de forma natural.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

          </section>

        </motion.div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
