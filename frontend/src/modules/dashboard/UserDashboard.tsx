import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { motion, Variants } from 'framer-motion';
import {
  ArrowRight,
  Activity,
  User as UserIcon,
  MessageSquare,
  Clock,
  Plus,
  TimerReset,
  EyeOff,
  ShieldOff,
} from 'lucide-react';
import './Dashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Bienvenida');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const hour = currentTime.getHours();

    if (hour < 12) setGreeting('Amaneció');
    else if (hour < 18) setGreeting('Sigue circulando');
    else setGreeting('La noche escucha');

    return () => clearInterval(timer);
  }, [currentTime]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0.25 } },
  };

  return (
    <Layout>
      <div className="dash-container">
        <motion.div
          className="dash-top-bar"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="dash-time">
            <Clock size={16} />
            <span>
              {currentTime.toLocaleDateString('es-ES', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>

          <button className="dash-btn-primary" onClick={() => navigate('/feed')}>
            <Plus size={17} /> Revelar algo
          </button>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.section className="dash-hero" variants={itemVariants}>
            <div className="dash-hero-bg"></div>

            <div className="dash-hero-content">
              <div className="dash-badge">
                <EyeOff size={14} /> Identidad oculta
              </div>

              <h1 className="dash-title">
                {greeting}.<br />
                <span className="text-gradient">
                  {user?.display_name || user?.username || 'Anónimo'}
                </span>
              </h1>

              <p className="dash-subtitle">
                EXPOSE es un espacio temporal: lo que aparece hoy desaparece pronto.
                Publica sin perfiles, sin likes visibles y sin dejar una huella permanente.
              </p>
            </div>

            <div className="dash-hero-stats">
              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <TimerReset size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">24H</span>
                  <span className="stat-label">Duración</span>
                </div>
              </motion.div>

              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <EyeOff size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Perfiles</span>
                </div>
              </motion.div>

              <motion.div className="hero-stat-card" whileHover={{ scale: 1.03 }}>
                <div className="stat-icon-wrapper">
                  <ShieldOff size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">NO</span>
                  <span className="stat-label">Capturas</span>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <section className="dash-main-grid">
            <div className="dash-col-left">
              <motion.div variants={itemVariants}>
                <Link to="/feed" className="action-card interactive-card">
                  <div className="action-icon">
                    <Activity size={24} />
                  </div>
                  <div className="action-text">
                    <h3>Entrar al flujo</h3>
                    <p>Lee publicaciones anónimas antes de que desaparezcan.</p>
                  </div>
                  <ArrowRight className="action-arrow" size={20} />
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link to="/profile" className="action-card interactive-card">
                  <div className="action-icon">
                    <UserIcon size={24} />
                  </div>
                  <div className="action-text">
                    <h3>Identidad temporal</h3>
                    <p>Tu presencia existe aquí, pero no tiene que seguirte afuera.</p>
                  </div>
                  <ArrowRight className="action-arrow" size={20} />
                </Link>
              </motion.div>
            </div>

            <div className="dash-col-right">
              <motion.div variants={itemVariants} className="insight-card glass-panel">
                <div className="insight-header">
                  <MessageSquare size={20} />
                  <h3>Reglas del silencio</h3>
                </div>

                <div className="insight-body">
                  <div className="tip-item">
                    <div className="tip-dot"></div>
                    <div>
                      <strong>Publica en el momento</strong>
                      <p>EXPOSE funciona para pensamientos, fotos y textos que existen ahora, no para construir una identidad perfecta.</p>
                    </div>
                  </div>

                  <div className="tip-item">
                    <div className="tip-dot"></div>
                    <div>
                      <strong>No persigas validación</strong>
                      <p>La idea no es acumular likes. La idea es soltar algo y dejar que desaparezca.</p>
                    </div>
                  </div>

                  <div className="tip-item">
                    <div className="tip-dot"></div>
                    <div>
                      <strong>Todo caduca</strong>
                      <p>Cada publicación tiene tiempo limitado. Lo efímero es parte central de la experiencia.</p>
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